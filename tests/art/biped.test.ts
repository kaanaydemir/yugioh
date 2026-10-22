// A3 Y7 — the biped body plan, version v1 (docs/v3/A3_MIMARI.md §4.2, §12 "Gövde tipi (biped)"):
// the four paper members resolve, the foot invariants hold, IK is NaN-free and keeps limb lengths,
// joints() is defined on every frame, ≤ 40 parameters, the loop words cannot be called without a
// period / phase / amplitude, poseKnockPx agrees with the recoil words and the reaction kit, and
// planArt builds a plain MonsterArt with the plan fields (+ the cross build of control (b)).

import { describe, expect, it } from 'vitest';
import { v1 as biped } from '../../src/art/bodyplans/biped';
import {
  BIPED_ORDER,
  BIPED_REGIONS,
  BIPED_STATIONS,
  OUTLINE,
  PAPER,
  bipedHelpers,
  bipedSlotOf,
  checkBuild,
  delayed,
  handAt,
  loopTimes,
  paramCount,
  plus,
  restOf,
  type BipedBuild,
  type BipedPose,
  type BipedRig,
} from '../../src/art/bodyplans/biped/v1';
import { crossMember, planArt, versionDir, type PlanArt } from '../../src/art/bodyplans/types';
import { compileAnims } from '../../src/art/rigkit/anim';
import { definePose, poseEqual } from '../../src/art/rigkit/pose';
import type { V } from '../../src/art/rigkit/geom';
import { PixelCanvas } from '../../src/art/pixel';
import { MONSTER_ANIMS, MONSTER_ANIMS_EXTRA, WEIGHT_CLASSES, type AnyMonsterAnim } from '../../src/art/types';
import { guardPushPx } from '../../src/duel/motion';
import { PAPER_NAMES, paperMember, type PaperName } from '../../src/dev/previews/bodyplan';

const ALL_ANIMS: readonly AnyMonsterAnim[] = [...MONSTER_ANIMS, ...MONSTER_ANIMS_EXTRA];
const dist = (a: V, b: V) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const rigOf = (b: BipedBuild, d: Partial<BipedPose> = {}): BipedRig => biped.rig(b, { ...biped.neutral(b), ...d });

/** Every number reachable in a value (rig fields, nested). */
function numbers(v: unknown, out: number[] = []): number[] {
  if (typeof v === 'number') out.push(v);
  else if (Array.isArray(v)) for (const x of v) numbers(x, out);
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'build' && k !== 'rest') numbers(x, out);
  return out;
}

/** The compiled poses of a paper member (the same kit planArt builds). */
function compiled(name: PaperName) {
  const m = paperMember(name);
  const neutral = { ...biped.neutral(m.build), fx: { ...m.fx } };
  const kit = definePose(neutral, biped.groups as never, { ...biped.regions, extra: [...(biped.regions.extra ?? []), 'fx'] } as never);
  return { m, c: compileAnims(kit, m.anims as never) as ReturnType<typeof compileAnims<BipedPose & { fx: { eye: number } }>> };
}

/** A deterministic battery of poses: body, spine, head and arm offsets — never dx / lift / steps. */
function battery(): Partial<BipedPose>[] {
  const out: Partial<BipedPose>[] = [];
  for (let i = 0; i < 40; i++) {
    const s = (k: number) => Math.sin(i * 1.7 + k * 2.3);
    out.push({
      hip: { x: 4 * s(1), y: 3 * s(2), tilt: 2 * s(3) },
      lean: 0.3 * s(4),
      chestLean: 0.3 * s(5),
      twist: s(6),
      breath: 1.5 * s(7),
      head: { x: 3 * s(8), y: 3 * s(9), a: 0.3 * s(10), lag: Math.abs(s(11)) },
      armN: { hand: [30 * s(12), 30 * s(13)], bend: s(14) > 0 ? 1 : -1, grip: 'open' },
      armF: { hand: [30 * s(15), 30 * s(16)], bend: s(17) > 0 ? 1 : -1, grip: 'fist' },
    });
  }
  // extremes: the pelvis far above its reach, a hand on its shoulder, a straight-down crouch
  out.push({ hip: { x: 0, y: -60, tilt: 0 } }, { hip: { x: 25, y: 0, tilt: 0 } }, { hip: { x: 0, y: 12, tilt: 0 } });
  out.push({ armN: { hand: [0, -1000], bend: 1, grip: 'fist' } });
  return out;
}

describe('biped v1: the plan object', () => {
  it('is pinned by its directory: id biped, version 1', () => {
    expect(biped.id).toBe('biped');
    expect(biped.version).toBe(1);
    expect(() => versionDir({}, 'v2', ['./v1/index.ts'])).toThrow(/does not exist/);
    expect(() => versionDir({}, 'next', ['./next/index.ts'])).toThrow(/not v<N>/);
  });

  it('has ≤ 40 parameters (§4.2): the leaves of a full build', () => {
    const full: Required<BipedBuild> = {
      ...PAPER.titan.build,
      lead: 'far',
      pelvis: 19,
      head: 10,
      spine: 0,
      headAt: [0, 0],
      stanceAt: 0,
      hipAt: 0,
      ankle: 4,
      farRise: 2,
      hands: { N: [0, 0], F: [0, 0] },
      knee: -1,
    };
    expect(paramCount(full)).toBeLessThanOrEqual(40);
    expect(paramCount(full)).toBe(30);
  });

  it('slots: far → near with one outline; the near arm under its pauldron, the far pauldron behind the chest; stations empty', () => {
    expect(BIPED_ORDER.filter((s) => s === OUTLINE)).toHaveLength(1);
    expect(new Set(BIPED_ORDER).size).toBe(BIPED_ORDER.length);
    const at = (s: string) => BIPED_ORDER.indexOf(s);
    expect(at('armN')).toBeLessThan(at('shoulderN'));
    expect(at('shoulderF')).toBeLessThan(at('torso'));
    expect(at('armN.tuck')).toBeLessThan(at('propF'));
    expect(at('propF')).toBeLessThan(at('armN'));
    expect(at('armF')).toBeLessThan(at('torso'));
    expect(at('torso')).toBeLessThan(at('armF.front'));
    expect(at('head')).toBeLessThan(at('armN'));
    expect(at('armN')).toBeLessThan(at('head.front'));
    expect(at('glow')).toBeGreaterThan(at(OUTLINE));
    for (const s of BIPED_STATIONS) expect(BIPED_ORDER).toContain(s);
    const n = biped.neutral(PAPER.sentinel.build);
    expect(bipedSlotOf(n, 'armN', 'armN')).toBe('armN');
    expect(bipedSlotOf({ ...n, slots: { armN: 'armN.tuck' } }, 'armN', 'armN')).toBe('armN.tuck');
  });

  it('regions: the struck chest moves the chest and head only, never the hips or feet (HA-21)', () => {
    expect(BIPED_REGIONS.chest).not.toContain('hip');
    expect(BIPED_REGIONS.chest).not.toContain('lean');
    expect(BIPED_REGIONS.head).toEqual(['head']);
    expect(BIPED_REGIONS.hips).toContain('hip');
  });
});

describe('biped v1: the four paper members (builds from the v1 rigs)', () => {
  it('every skeleton resolves (no problem, root on the anchor, inside the frame)', () => {
    for (const n of PAPER_NAMES) {
      const p = PAPER[n];
      expect(checkBuild(p.build, p.frame), n).toEqual([]);
      expect(biped.check!(p.build, { ...p.frame }), n).toEqual([]);
    }
    expect(PAPER.sentinel.build.farArm).toBe('shield');
    expect(PAPER.golem.build.lower).toBe('spout');
    expect(PAPER.assassin.build.preset).toBe('lithe');
    expect(PAPER.titan.build.preset).toBe('heavy');
  });

  it('the rest skeletons sit where the v1 rigs put them (±1.5 px)', () => {
    const near = (a: V, b: V) => expect(dist(a, b)).toBeLessThanOrEqual(1.5);
    const r = (n: PaperName) => rigOf(PAPER[n].build);
    near(r('sentinel').footN, [22, 60]);
    near(r('sentinel').footF, [37, 60]);
    near(r('sentinel').head, [31, 20.5]);
    near(r('sentinel').shoulderN, [17, 29]);
    near(r('titan').head, [46, 33]);
    near(r('titan').footF, [51, 77]);
    near(r('titan').shoulderF, [50, 29]);
    near(r('golem').head, [40.5, 19]);
    near(r('golem').pelvis, [30, 43]);
    near(r('assassin').footN, [33, 60]);
    near(r('assassin').footF, [10, 60]);
    near(r('assassin').armN.end, [42, 38]);
    near(r('assassin').pelvis, [23, 43]);
  });

  it('checkBuild catches a broken build', () => {
    const b = PAPER.sentinel.build;
    expect(checkBuild({ ...b, hunch: 0.6 }).join()).toMatch(/hunch/);
    expect(checkBuild({ ...b, height: 14 }).join()).toMatch(/torso/);
    expect(checkBuild({ ...b, stance: 60 }).join()).toMatch(/leg N out of reach/);
    expect(checkBuild({ ...b, hands: { N: [0, 30], F: [0, 0] } }).join()).toMatch(/hand N out of reach/);
    expect(checkBuild(b, { ...PAPER.sentinel.frame, anchor: [31, 60] }).join()).toMatch(/anchor/);
    expect(checkBuild({ ...b, arm: [NaN, 10] }).join()).toMatch(/finite/);
  });
});

describe('biped v1: the skeleton solve', () => {
  it('a foot point is fixed while there is no step (whatever the body does)', () => {
    for (const n of PAPER_NAMES) {
      const b = PAPER[n].build;
      const r = restOf(b);
      for (const d of battery()) {
        const rig = rigOf(b, d);
        expect(rig.footN, n).toEqual(r.footN);
        expect(rig.footF, n).toEqual(r.footF);
        expect(rig.planted).toEqual({ N: true, F: true });
      }
    }
  });

  it('a step moves exactly its foot; dx / lift move the whole figure; a lifted foot is in the air', () => {
    const b = PAPER.titan.build;
    const r = restOf(b);
    const s = rigOf(b, { footF: { step: [3, 0], lift: 0 } });
    expect(s.footF).toEqual([r.footF[0] + 3, r.footF[1]]);
    expect(s.footN).toEqual(r.footN);
    const d = rigOf(b, { dx: 5 });
    expect(d.footN).toEqual([r.footN[0] + 5, r.footN[1]]);
    expect(d.pelvis[0]).toBeCloseTo(r.pelvis[0] + 5, 9);
    const l = rigOf(b, { footN: { step: [0, 0], lift: 2 } });
    expect(l.planted.N).toBe(false);
    expect(l.footN[1]).toBe(r.footN[1] - 2);
    const hop = rigOf(b, { lift: 3 });
    expect(hop.planted).toEqual({ N: false, F: false });
    expect(hop.ground).toBe(r.root[1]);
  });

  it('IK is NaN-free and keeps every limb length on all four members (battery + every compiled frame)', () => {
    for (const n of PAPER_NAMES) {
      const { m, c } = compiled(n);
      const b = m.build;
      const poses: BipedPose[] = battery().map((d) => ({ ...biped.neutral(b), ...d }));
      for (const a of ALL_ANIMS) {
        const ca = c.anims[a];
        if (ca) poses.push(...ca.poses);
      }
      // garbage in: NaN / ∞ offsets are read as 0, never reach the rig
      poses.push({ ...biped.neutral(b), lean: NaN, hip: { x: Infinity, y: NaN, tilt: 0 }, armN: { hand: [NaN, 3], bend: 1, grip: 'fist' } });
      for (const p of poses) {
        const rig = biped.rig(b, p);
        const ns = numbers(rig);
        expect(ns.every(Number.isFinite), `${n}: a non-finite rig value`).toBe(true);
        for (const arm of [rig.armN, rig.armF]) {
          expect(dist(arm.root, arm.mid)).toBeCloseTo(b.arm[0], 6);
          expect(dist(arm.mid, arm.end)).toBeCloseTo(b.arm[1], 6);
        }
        if (b.lower !== 'spout')
          for (const leg of [rig.legN, rig.legF]) {
            expect(dist(leg.root, leg.mid)).toBeCloseTo(b.leg[0], 6);
            expect(dist(leg.mid, leg.end)).toBeCloseTo(b.leg[1], 6);
          }
      }
    }
  });

  it('the pelvis yields to planted feet instead of tearing a leg (and does not in a sound pose)', () => {
    for (const n of PAPER_NAMES) {
      const b = PAPER[n].build;
      if (b.lower === 'spout') continue;
      const r = restOf(b);
      expect(rigOf(b).yield).toEqual([0, 0]);
      const up = rigOf(b, { hip: { x: 0, y: -60, tilt: 0 } });
      expect(up.yield[1], n).toBeGreaterThan(0);
      expect(up.footN).toEqual(r.footN);
      expect(up.footF).toEqual(r.footF);
      for (const [leg, foot] of [[up.legN, up.footN], [up.legF, up.footF]] as const) expect(dist(leg.end, [foot[0], foot[1] - r.ankle]), n).toBeLessThan(0.05);
    }
  });

  it('spout: the column stands on the ground between the feet and carries the pelvis', () => {
    const b = PAPER.golem.build;
    const rig = rigOf(b, { hip: { x: 2, y: 1, tilt: 0 } });
    expect(rig.spout).not.toBeNull();
    expect(rig.spout!.base[1]).toBe(b.root[1]);
    expect(rig.spout!.top).toEqual(rig.pelvis);
    expect(rigOf(PAPER.titan.build).spout).toBeNull();
  });

  it('head lag holds back the spine bend; props ride their hand', () => {
    const b = PAPER.sentinel.build;
    const bent = rigOf(b, { chestLean: 0.3 });
    const held = rigOf(b, { chestLean: 0.3, head: { x: 0, y: 0, a: 0, lag: 1 } });
    const rest = rigOf(b);
    expect(dist(bent.head, rest.head)).toBeGreaterThan(2);
    expect(dist(held.head, rest.head)).toBeLessThan(1e-9);
    expect(rest.props.shield.at).toEqual(rest.armF.end);
    expect(rest.props.shield.hand).toBe('F');
  });

  it('plan request R1: build.knee breaks the knees back (+1); absent = −1 = today, the feet and lengths stay', () => {
    const b = PAPER.titan.build;
    const fwd = rigOf(b, { hip: { x: 0, y: 3, tilt: 0 } });
    const same = rigOf({ ...b, knee: -1 }, { hip: { x: 0, y: 3, tilt: 0 } });
    const back = rigOf({ ...b, knee: 1 }, { hip: { x: 0, y: 3, tilt: 0 } });
    const { build: _b1, rest: _r1, ...joints1 } = same;
    const { build: _b2, rest: _r2, ...joints2 } = fwd;
    expect(joints1).toEqual(joints2);
    for (const s of ['legN', 'legF'] as const) {
      // facing right (+x forward): a forward knee sits in front of the hip → ankle line, a back knee behind it
      const side = (l: { root: V; mid: V; end: V }) => (l.end[0] - l.root[0]) * (l.mid[1] - l.root[1]) - (l.end[1] - l.root[1]) * (l.mid[0] - l.root[0]);
      expect(Math.sign(side(back[s]))).toBe(-Math.sign(side(fwd[s])));
      expect(back[s].end).toEqual(fwd[s].end);
      expect(dist(back[s].root, back[s].mid)).toBeCloseTo(b.leg[0], 6);
    }
    expect(back.footN).toEqual(fwd.footN);
    expect(checkBuild({ ...b, knee: 0 as unknown as 1 })).toEqual([expect.stringMatching(/knee/)]);
  });

  it('plan request R2: armN.aim turns the fist (rig dir) by its weight; w 0 = along the forearm', () => {
    const b = PAPER.titan.build;
    const arm = { hand: [6, -4] as V, bend: 1 as const, grip: 'fist' as const };
    const along = rigOf(b, { armN: arm });
    const fore = Math.atan2(along.armN.end[1] - along.armN.mid[1], along.armN.end[0] - along.armN.mid[0]);
    expect(along.armN.dir).toBeCloseTo(fore, 9);
    expect(rigOf(b, { armN: { ...arm, aim: { a: 2, w: 0 } } }).armN.dir).toBeCloseTo(fore, 9);
    expect(rigOf(b, { armN: { ...arm, aim: { a: 2, w: 1 } } }).armN.dir).toBeCloseTo(2, 9);
    const half = rigOf(b, { armN: { ...arm, aim: { a: fore + 0.6, w: 0.5 } } });
    expect(half.armN.dir).toBeCloseTo(fore + 0.3, 9);
    // the shorter way round across ±π, and the joints never move
    const wrap = rigOf(b, { armN: { ...arm, aim: { a: fore + 2 * Math.PI - 0.2, w: 1 } } });
    expect(wrap.armN.dir).toBeCloseTo(fore - 0.2, 9);
    expect([wrap.armN.mid, wrap.armN.end]).toEqual([along.armN.mid, along.armN.end]);
  });
});

describe('biped v1: joints()', () => {
  it('is defined on every frame of every anim of the four members (finite, the §9.1 names)', () => {
    for (const n of PAPER_NAMES) {
      const art = planArt(biped, paperMember(n));
      const b = PAPER[n].build;
      for (const a of ALL_ANIMS) {
        const spec = (art.anims as Record<string, { frames: number } | undefined>)[a] ?? art.extraAnims?.[a as never];
        if (!spec) continue;
        for (let f = 0; f < spec.frames; f++) {
          const j = art.joints(a, f);
          const names = ['head', 'hip', 'handN', 'footN', 'footF', ...(b.farArm === 'hidden' ? [] : ['handF'])];
          for (const k of names) {
            expect(j[k], `${n} ${a}:${f} ${k}`).toBeDefined();
            expect(Number.isFinite(j[k].x) && Number.isFinite(j[k].y)).toBe(true);
          }
        }
      }
    }
    expect(Object.keys(planArt(biped, paperMember('sentinel')).joints('idle', 0))).toContain('propF');
    expect(biped.joints({ ...PAPER.titan.build, farArm: 'hidden' }, rigOf(PAPER.titan.build), biped.neutral(PAPER.titan.build)).handF).toBeUndefined();
  });
});

describe('biped v1: the vocabulary', () => {
  const h = bipedHelpers(PAPER.sentinel.build);

  it('loop words cannot be called without a period, phase and amplitude (type and runtime)', () => {
    // @ts-expect-error a loop word has no default period / phase / amplitude
    expect(() => h.breathe({ amp: 1 })).toThrow(/required/);
    // @ts-expect-error … nor a default argument
    expect(() => h.breathe()).toThrow(/required/);
    // @ts-expect-error the phase is required too
    expect(() => h.weightShift({ periodMs: 1200, px: 1 })).toThrow(/required/);
    // @ts-expect-error and the amplitude
    expect(() => h.weightShift({ periodMs: 1200, phase: 0 })).toThrow(/required/);
    expect(() => h.breathe({ periodMs: 0, phase: 0, amp: 1 })).toThrow(/periodMs/);
    expect(() => h.breathe({ periodMs: NaN, phase: 0, amp: 1 })).toThrow();
    const w = h.breathe({ periodMs: 1000, phase: 0, amp: 2 });
    expect(w(0)).toEqual({ breath: 0 });
    expect(w(500).breath).toBeCloseTo(2, 9);
    expect(w(1000).breath).toBeCloseTo(0, 9);
    const s = h.weightShift({ periodMs: 800, phase: 0.25, px: 1.5 });
    expect(s(0).hip?.x).toBeCloseTo(1.5, 9);
    expect(delayed(s, 200)(200)).toEqual(s(0));
  });

  it('two members with different periods never share an idle by omission (the words are pure functions of their arguments)', () => {
    const a = bipedHelpers(PAPER.titan.build).breathe({ periodMs: 2200, phase: 0, amp: 1 });
    const b = bipedHelpers(PAPER.golem.build).breathe({ periodMs: 900, phase: 0.3, amp: 1 });
    expect([0, 300, 600].map((t) => a(t).breath)).not.toEqual([0, 300, 600].map((t) => b(t).breath));
  });

  it('plant / step / struck words; struck is region-only', () => {
    expect(h.plant('N')).toEqual({ footN: { step: [0, 0], lift: 0 } });
    expect(h.step('F', 3)).toEqual({ footF: { step: [3, 0], lift: 0 } });
    for (const power of [1, 2, 3] as const) {
      for (const region of ['head', 'chest', 'armN', 'armF', 'hips'] as const) {
        const d = h.struck(region, power);
        const allowed = new Set(BIPED_REGIONS[region] as readonly string[]);
        for (const k of Object.keys(d)) expect(allowed.has(k), `${region}: ${k}`).toBe(true);
        expect(Object.keys(d).length).toBeGreaterThan(0);
      }
      expect(Object.keys(h.struckBack(power)).sort()).toEqual(['chestLean', 'head']);
      expect(h.struckAbove(power).hip?.y).toBe(power);
    }
    // @ts-expect-error power is 1, 2 or 3
    expect(() => h.struck('head', 4)).toThrow(/power/);
  });

  it('recoilPush: the struck region leads on f0, by f2 the pelvis has travelled poseKnockPx[power], the feet stay planted', () => {
    for (const n of PAPER_NAMES) {
      const b = PAPER[n].build;
      const hb = bipedHelpers(b);
      for (const w of WEIGHT_CLASSES)
        for (const power of [1, 2, 3] as const) {
          const [f0, f1, f2] = hb.recoilPush(w, power);
          const fields = new Set([...(BIPED_REGIONS.chest as readonly string[]), ...(BIPED_REGIONS.head as readonly string[])]);
          for (const k of Object.keys(f0)) expect(fields.has(k), k).toBe(true);
          const k = biped.poseKnockPx(b, w)[power - 1];
          const rest = rigOf(b);
          const kit = definePose(biped.neutral(b), biped.groups as never, biped.regions as never);
          const r1 = biped.rig(b, kit.over(biped.neutral(b), f1));
          const r2 = biped.rig(b, kit.over(biped.neutral(b), f2));
          expect(rest.pelvis[0] - r2.pelvis[0]).toBeCloseTo(k, 9);
          expect(rest.pelvis[0] - r1.pelvis[0]).toBeLessThanOrEqual(k);
          expect(r2.footN).toEqual(rest.footN);
          expect(r2.footF).toEqual(rest.footF);
        }
    }
  });

  it('guardTuck / throwArc are reachable on every member (the arm never clamps)', () => {
    for (const n of PAPER_NAMES) {
      const b = PAPER[n].build;
      const hb = bipedHelpers(b);
      const kit = definePose(biped.neutral(b), biped.groups as never, biped.regions as never);
      const keys = [hb.guardTuck({ lead: 'arms', dropPx: 2 }), hb.guardTuck({ lead: 'shield', dropPx: 1 }), ...hb.throwArc({ from: 'handN', liftPx: 3 }), ...hb.throwArc({ from: 'handF', liftPx: 0 })];
      for (const d of keys) {
        const rig = biped.rig(b, kit.over(biped.neutral(b), d));
        expect(rig.armN.clamped || rig.armF.clamped, `${n} ${JSON.stringify(d)}`).toBe(false);
      }
      expect(hb.guardTuck({ lead: 'shield', dropPx: 1 }).slots).toEqual({ armN: 'armN.tuck' });
    }
    expect(hb5().length).toBe(5);
    function hb5() {
      return h.throwArc({ from: 'handN', liftPx: 2 });
    }
  });

  it('glue: handAt puts a hand at a shoulder-relative place', () => {
    for (const n of PAPER_NAMES) {
      const b = PAPER[n].build;
      const kit = definePose(biped.neutral(b), biped.groups as never, biped.regions as never);
      const rig = biped.rig(b, kit.over(biped.neutral(b), { armN: { hand: handAt(b, 'N', [5, -6]) }, armF: { hand: handAt(b, 'F', [-3, 8]) } }));
      expect(rig.armN.end[0] - rig.shoulderN[0]).toBeCloseTo(5, 9);
      expect(rig.armN.end[1] - rig.shoulderN[1]).toBeCloseTo(-6, 9);
      expect(rig.armF.end[0] - rig.shoulderF[0]).toBeCloseTo(-3, 9);
      expect(rig.armF.end[1] - rig.shoulderF[1]).toBeCloseTo(8, 9);
    }
  });

  it('glue: plus adds, loopTimes gives frame starts', () => {
    expect(plus({ hip: { x: 1 } }, { hip: { x: 2, y: 1 } }, { lean: 0.1 })).toEqual({ hip: { x: 3, y: 1 }, lean: 0.1 });
    expect(plus({ armN: { hand: [1, 2] } }, { armN: { hand: [3, -1], grip: 'open' } })).toEqual({ armN: { hand: [4, 1], grip: 'open' } });
    expect(loopTimes([100, 120, 80])).toEqual({ at: [0, 100, 220], total: 300 });
  });
});

describe('biped v1: poseKnockPx (§10.2)', () => {
  it('whole px, never above the kit knockPx of the class (guardPushPx + 1): the kit adds the rest', () => {
    for (const w of WEIGHT_CLASSES) {
      const k = biped.poseKnockPx(PAPER.sentinel.build, w);
      for (const power of [1, 2, 3] as const) {
        expect(Number.isInteger(k[power - 1])).toBe(true);
        expect(k[power - 1]).toBeGreaterThanOrEqual(1);
        expect(k[power - 1]).toBeLessThanOrEqual(guardPushPx({ weight: w } as never, power) + 1);
      }
    }
    // heavy: the kit keeps 0 / 0 / 1 (§10.2: "ağır sınıfta kalan çoğunlukla 0'dır, güç 3'te 1")
    const heavy = biped.poseKnockPx(PAPER.titan.build, 'heavy');
    expect([1, 2, 3].map((p) => guardPushPx({ weight: 'heavy' } as never, p) + 1 - heavy[p - 1])).toEqual([0, 0, 1]);
  });
});

describe('planArt on biped v1', () => {
  const arts = Object.fromEntries(PAPER_NAMES.map((n) => [n, planArt(biped, paperMember(n))])) as Record<PaperName, PlanArt>;

  it('a plain MonsterArt with the plan fields: bodyPlan, knock pose + poseKnockPx, joints, levels', () => {
    for (const n of PAPER_NAMES) {
      const art = arts[n];
      const m = paperMember(n);
      expect(art.id).toBe(m.id);
      expect(art.bodyPlan).toEqual({ id: 'biped', version: 1 });
      expect(art.knock).toBe('pose');
      expect(art.poseKnockPx).toEqual([...biped.poseKnockPx(m.build, m.weight)]);
      expect(art.p2).toBe('relight');
      expect([art.anchorX, art.anchorY]).toEqual([...m.frame.anchor]);
      expect(Object.values(art.levels).every((v) => v === 1)).toBe(true);
      expect(Object.keys(art.levels).sort()).toEqual(['attack', 'guard', 'hit', 'idle', 'roar']);
      expect(art.escapes).toEqual([]);
      expect(art.attackImpactFrame).toBe(art.anims.attack.marks?.release);
    }
    // the muzzle string names a joint: the sentinel releases from its near hand
    const s = arts.sentinel;
    const j = s.joints('attack', s.attackImpactFrame);
    expect(s.muzzle).toEqual({ x: Math.round(j.handN.x), y: Math.round(j.handN.y) });
  });

  it('draws every frame for P1 and P2: opaque pixels, nothing on the frame edge', () => {
    for (const n of PAPER_NAMES) {
      const art = arts[n];
      for (const a of MONSTER_ANIMS)
        for (let f = 0; f < art.anims[a].frames; f++)
          for (const lightFrom of ['left', 'right'] as const) {
            const p = new PixelCanvas(art.w, art.h);
            art.draw(p, a, f, { lightFrom });
            let opaque = 0;
            let edge = 0;
            for (let y = 0; y < art.h; y++)
              for (let x = 0; x < art.w; x++)
                if (p.isOpaque(x, y)) {
                  opaque++;
                  if (x === 0 || y === 0 || x === art.w - 1 || y === art.h - 1) edge++;
                }
            expect(opaque, `${n} ${a}:${f}`).toBeGreaterThan(200);
            expect(edge, `${n} ${a}:${f} edge`).toBe(0);
          }
    }
  });

  it('points are whole px on every frame and the core is the idle f0 core', () => {
    for (const n of PAPER_NAMES) {
      const art = arts[n];
      for (let f = 0; f < art.anims.attack.frames; f++) {
        const p = art.points!('attack', f);
        for (const v of Object.values(p)) expect(Number.isInteger(v!.x) && Number.isInteger(v!.y)).toBe(true);
        expect(p.feet).toBeDefined();
        expect(p.head).toBeDefined();
      }
      expect(art.core).toEqual(art.points!('idle', 0).core);
    }
  });

  it('the struck contact frame moves only the struck regions (HA-21)', () => {
    for (const n of PAPER_NAMES) {
      const { c } = compiled(n);
      const idle0 = c.idle0 as unknown as Record<string, unknown>;
      const f0 = c.pose('hit', 0) as unknown as Record<string, unknown>;
      const allowed = new Set([...(BIPED_REGIONS.chest as readonly string[]), ...(BIPED_REGIONS.head as readonly string[])]);
      for (const k of Object.keys(idle0)) if (!allowed.has(k)) expect(poseEqual(f0[k], idle0[k]), `${n} hit f0 moved ${k}`).toBe(true);
    }
  });

  it('a pose that sends a part to an unknown slot, a part on an unknown slot, a bad build: all throw', () => {
    const m = paperMember('sentinel');
    expect(() => planArt(biped, { ...m, parts: { ...m.parts, cape: { layer: 'cape', paint: () => null } } })).toThrow(/slot 'cape'/);
    expect(() => planArt(biped, { ...m, build: { ...m.build, hunch: 1 } })).toThrow(/hunch/);
    const bad = planArt(biped, { ...m, anims: { ...m.anims, roar: { base: 'idle0', beats: [{ ms: 100, key: { slots: { armN: 'nowhere' } } }], end: 'idle0' } } });
    const p = new PixelCanvas(bad.w, bad.h);
    expect(() => bad.draw(p, 'roar', 0)).toThrow(/nowhere/);
    // an extra slot through `order` is an L4 hatch, listed in escapes
    const cape = planArt(biped, { ...m, order: ['cape', ...biped.order], parts: { ...m.parts, cape: { layer: 'cape', paint: () => null } } });
    expect(cape.escapes).toEqual(['L4 order', 'L4 slot:cape']);
    const l3 = planArt(biped, { ...m, drawAnim: { roar: () => undefined } });
    expect(l3.levels.roar).toBe(3);
    expect(l3.levels.attack).toBe(1);
  });

  it('cross build (control b): the motion member\'s anims on the body member\'s build and parts', () => {
    const titan = paperMember('titan');
    const sentinel = paperMember('sentinel');
    const art = planArt(biped, crossMember(titan, sentinel));
    expect(art.w).toBe(titan.frame.w);
    expect(art.anims.attack.frames).toBe(arts.sentinel.anims.attack.frames);
    expect(art.anims.attack.holds).toEqual(arts.sentinel.anims.attack.holds);
    // the same offsets move the same joints on the other body: the hand's path relative to idle f0 is near-identical
    const path = (a: PlanArt) => Array.from({ length: a.anims.attack.frames }, (_, f) => {
      const j = a.joints('attack', f);
      const j0 = a.joints('idle', 0);
      return [j.handN.x - j0.handN.x, j.handN.y - j0.handN.y];
    });
    const A = path(arts.sentinel).flat();
    const B = path(art).flat();
    const cos = A.reduce((s, v, i) => s + v * B[i], 0) / Math.hypot(...A) / Math.hypot(...B);
    expect(cos).toBeGreaterThan(0.95);
  });
});
