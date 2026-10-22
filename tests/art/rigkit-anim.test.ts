// A3 Y3 — pose algebra, the anim compiler and validateArt (A3_MIMARI §3.2, §12).

import { describe, expect, it } from 'vitest';
import { AnimGrammarError, BEAT_MARKS, DRAFT_GUARD_HOLDS, compileAnims, draftGuardTransitions, type AnimDef, type AnimDefs } from '../../src/art/rigkit/anim';
import { RECOIL_LAG, definePose, lerpBy, phase, poseEqual } from '../../src/art/rigkit/pose';
import { drawFrame, frameDelta, validateArt, type Finding } from '../../src/art/rigkit/validate';
import { PAL } from '../../src/art/palette';
import type { PixelCanvas } from '../../src/art/pixel';
import type { AnimSpec, AnyMonsterAnim, MonsterArt } from '../../src/art/types';
import type { MonsterId } from '../../src/data/cards';
import wyrmV3 from '../../src/art/monsters-v3/crystal_wyrm';
import magusV3 from '../../src/art/monsters-v3/abyss_magus';
import { FX_ANIMS, FX_COMPILED, FX_KIT, fixtureArt } from './fixtures/rigkit-creature-art';

// ------------------------------------------------------------------ a small synthetic pose

interface TP {
  x: number;
  v: readonly [number, number];
  w: { a: number; b: number; at?: readonly [number, number] };
  tail: number;
  flag: boolean;
  name: string;
}
const TK = definePose<TP>({ x: 0, v: [0, 0], w: { a: 0, b: 0 }, tail: 0, flag: false, name: 'rest' }, { wing: ['w'], tail: ['tail'] }, { head: ['x'], armN: ['v'], tail: ['tail'], wingN: ['w'] });
const A: TP = { x: 0, v: [0, 10], w: { a: 0, b: 4 }, tail: 0, flag: false, name: 'a' };
const B: TP = { x: 10, v: [10, 20], w: { a: 8, b: 0, at: [2, 2] }, tail: 1, flag: true, name: 'b' };

describe('pose algebra', () => {
  it('lerp is the identity at the ends, discrete fields included', () => {
    expect(poseEqual(TK.lerp(A, B, 0), A)).toBe(true);
    expect(poseEqual(TK.lerp(A, B, 1), B)).toBe(true);
    expect(poseEqual(TK.lerp(A, B, -0.5), A)).toBe(true);
    expect(TK.lerp(A, B, 0)).not.toBe(A); // a copy
  });

  it('lerp in between: numbers, tuples and nested objects; discrete fields from b; a one-sided field is kept', () => {
    const m = TK.lerp(A, B, 0.25);
    expect(m.x).toBe(2.5);
    expect(m.v).toEqual([2.5, 12.5]);
    expect(m.w).toEqual({ a: 2, b: 3, at: [2, 2] });
    expect(m.flag).toBe(true);
    expect(m.name).toBe('b');
  });

  it('over merges nested objects, replaces tuples and skips undefined', () => {
    const p = TK.over(A, { w: { a: 5 } as TP['w'], v: [1, 1], x: undefined });
    expect(p).toEqual({ ...A, w: { a: 5, b: 4 }, v: [1, 1] });
    expect(TK.pose({ x: 3 })).toEqual({ ...TK.neutral, x: 3 });
  });

  it('mix lags (or leads) a group and keeps the body at t', () => {
    const m = TK.mix(A, B, 0.5, { wing: 0.15, tail: -0.25 });
    expect(m.x).toBe(5);
    expect(m.w.a).toBeCloseTo(8 * 0.35, 12);
    expect(m.tail).toBe(0.75);
    expect(TK.mix(A, B, 0.5, { wing: 0.8 }).w).toEqual(A.w); // not started yet
    expect(poseEqual(TK.mix(A, B, 0.5), TK.lerp(A, B, 0.5))).toBe(true);
  });

  it('recoil: f0 is the struck key, f1 the in-between of the compressed key and the reel (HA-22)', () => {
    const struck = TK.over(A, { x: -4 });
    const keys = [TK.over(A, { x: -6, w: { a: 2, b: 4 } }), TK.over(A, { x: 2, w: { a: 6, b: 4 } }), A];
    const r = TK.recoil(struck, keys);
    expect(r.length).toBe(4);
    expect(poseEqual(r[0], struck)).toBe(true);
    expect(r[0]).not.toBe(struck);
    expect(r[1].x).toBe(-2); // body halfway
    expect(r[1].w.a).toBeCloseTo(2 + 4 * (0.5 - RECOIL_LAG), 12); // the carried group trails
    expect(poseEqual(r[2], keys[1])).toBe(true);
    expect(poseEqual(r[3], keys[2])).toBe(true);
  });

  it('regions and only(): a struck key keeps its regions, the rest is the base', () => {
    const f = TK.regionFields(['head', 'tail']);
    expect([...f].sort()).toEqual(['tail', 'x']);
    const p = TK.only(B, A, f);
    expect(p).toEqual({ ...A, x: 10, tail: 1 });
  });

  it('definePose refuses unknown fields and a field in two groups', () => {
    expect(() => definePose<TP>(A, { g: ['nope' as keyof TP] }, {})).toThrow(/not a pose field/);
    expect(() => definePose<TP>(A, { g: ['x'], h: ['x'] }, {})).toThrow(/groups/);
    expect(() => definePose<TP>(A, {}, { head: ['nope' as keyof TP] })).toThrow(/not a pose field/);
  });

  it('phase runs one cycle and wraps on the last frame (HA-7); lerpBy gives each field its own t', () => {
    expect([0, 1, 2, 3, 4].map((f) => phase(f, 5))).toEqual([0, 0.25, 0.5, 0.75, 0]);
    expect(phase(0, 1)).toBe(0);
    const p = lerpBy(A, B, (k) => (k === 'x' ? 1 : 0));
    expect(p.x).toBe(10);
    expect(p.v).toEqual(A.v);
  });
});

// ------------------------------------------------------------------ the compiler

const FX_DEFS = FX_ANIMS as unknown as Record<string, AnimDef<unknown>>;
const ONE_SHOTS = Object.keys(FX_COMPILED.anims).filter((a) => a !== 'idle' && a !== 'guard') as AnyMonsterAnim[];

describe('anim compiler', () => {
  it('frames = holds = poses for every anim', () => {
    for (const [a, c] of Object.entries(FX_COMPILED.anims)) {
      expect(c!.spec.frames, a).toBe(c!.spec.holds!.length);
      expect(c!.poses.length, a).toBe(c!.spec.frames);
    }
  });

  it('marks come from the beat names and lie inside the anim', () => {
    for (const a of ONE_SHOTS) {
      const c = FX_COMPILED.anims[a]!;
      const def = FX_DEFS[a];
      const want: Record<string, number> = {};
      def.beats.forEach((b, i) => {
        const n = b.name ?? (i === 0 && def.struck ? 'struck' : undefined);
        if (n) for (const m of BEAT_MARKS[n]) want[m] = i;
      });
      expect(c.spec.marks ?? {}, a).toEqual(want);
      for (const f of Object.values(c.spec.marks ?? {})) expect(f! >= 0 && f! < c.spec.frames, a).toBe(true);
    }
    expect(FX_COMPILED.anims.attack!.spec.marks).toEqual({ charge: 1, release: 5, impact: 5, contact: 6, recover: 8 });
    expect(FX_COMPILED.anims.hit!.spec.marks).toEqual({ impact: 0, contact: 0, recover: 3 });
    expect(FX_COMPILED.anims.death!.spec.marks).toEqual({ impact: 0, contact: 0, dissolve: 4 });
  });

  it('one-shots end on the exact idle f0 pose (toGuard: guard f0); a held end stays on its last beat', () => {
    for (const a of ONE_SHOTS) {
      const c = FX_COMPILED.anims[a]!;
      const last = c.poses[c.poses.length - 1];
      const def = FX_DEFS[a];
      if (def.end === 'hold') {
        expect(c.poses.length, a).toBe(def.beats.length);
        continue;
      }
      expect(FX_KIT.equal(last, def.end === 'guard0' ? FX_COMPILED.guard0 : FX_COMPILED.idle0), a).toBe(true);
    }
    expect(FX_KIT.equal(FX_COMPILED.pose('toGuard', 99), FX_COMPILED.guard0)).toBe(true);
    expect(FX_KIT.equal(FX_COMPILED.pose('fromGuard', 4), FX_COMPILED.idle0)).toBe(true);
  });

  it('the struck frame changes only its regions’ fields (HA-21)', () => {
    for (const a of ['hit', 'hitHeavy', 'hitMagic', 'death'] as const) {
      const def = FX_DEFS[a];
      const keep = FX_KIT.regionFields(def.struck!.regions);
      const f0 = FX_COMPILED.anims[a]!.poses[0] as unknown as Record<string, unknown>;
      const base = FX_COMPILED.idle0 as unknown as Record<string, unknown>;
      const moved = Object.keys(base).filter((k) => !poseEqual(f0[k], base[k]));
      expect(moved.length, a).toBeGreaterThan(0);
      for (const k of moved) expect(keep.has(k as never), `${a}: ${k}`).toBe(true);
    }
    // the fixture keys the hit's tail in its struck key: the filter removed it
    expect(FX_COMPILED.anims.hit!.poses[0].tailAmp).toBe(FX_COMPILED.idle0.tailAmp);
  });

  it('follow carries the follower by its leader `lag` frames late (HA-6); phases wrap (HA-7)', () => {
    const def = FX_ANIMS.attack;
    const plain = compileAnims(FX_KIT, { ...FX_ANIMS, attack: { ...def, follow: undefined } }).anims.attack!;
    const c = FX_COMPILED.anims.attack!;
    const lean = plain.poses.map((p) => p.lean);
    const n = c.poses.length;
    for (let f = 0; f < n - 1; f++) {
      const before = f - 1 < 0 ? FX_COMPILED.idle0.lean : lean[f - 1];
      expect(c.poses[f].headA, `f${f}`).toBeCloseTo(plain.poses[f].headA + before - lean[f], 12);
      expect(c.poses[f].tail, `f${f}`).toBeCloseTo((FX_COMPILED.idle0.tail + f / (n - 1)) % 1, 12);
    }
    expect(FX_KIT.equal(c.poses[n - 1], FX_COMPILED.idle0)).toBe(true);
  });

  it('a smear frame (release only, HA-12) carries the previous frame’s pose', () => {
    const c = FX_COMPILED.anims.attack!;
    c.smearFrom.forEach((s, f) => {
      if (f === 5) expect(FX_KIT.equal(s!, c.poses[4])).toBe(true);
      else expect(s, `f${f}`).toBeUndefined();
    });
  });

  it('grammar errors throw AnimGrammarError', () => {
    const base = FX_ANIMS.roar;
    const bad = (roar: Partial<AnimDef<(typeof FX_COMPILED)['idle0']>>) => () => compileAnims(FX_KIT, { ...FX_ANIMS, roar: { ...base, ...roar } as typeof base });
    expect(bad({ beats: [{ ms: 80, key: {}, smear: true }] })).toThrow(AnimGrammarError);
    expect(bad({ beats: [{ name: 'release', ms: 80, key: {} }, { name: 'release', ms: 80, key: {} }] })).toThrow(/mark 'release'/);
    expect(bad({ beats: [{ ms: 80, key: {} }, { name: 'struck', ms: 50, key: {} }] })).toThrow(/frame 0/);
    expect(bad({ struck: { regions: ['head'] }, beats: [{ name: 'charge', ms: 80, key: {} }] })).toThrow(/struck/);
    expect(bad({ beats: [{ ms: 0, key: {} }] })).toThrow(/hold/);
    expect(bad({ beats: [{ ms: 80.5, key: {} }] })).toThrow(/hold/);
    expect(bad({ beats: [] })).toThrow(/no beats/);
    expect(bad({ follow: [{ field: 'guard', of: 'lean', lag: 1 }] })).toThrow(/follow/);
    expect(bad({ phase: ['cape'] })).toThrow(/phase/);
    expect(bad({ frames: { 40: (p) => p } })).toThrow(/no frame/);
    expect(() => compileAnims(FX_KIT, { ...FX_ANIMS, roar: undefined } as unknown as AnimDefs<(typeof FX_COMPILED)['idle0']>)).toThrow(/base anim/);
    expect(() => compileAnims(FX_KIT, { ...FX_ANIMS, idle: { ...FX_ANIMS.idle, holds: [100] } })).toThrow(/holds/);
  });

  it('the escape hatch patches one compiled frame', () => {
    const c = compileAnims(FX_KIT, { ...FX_ANIMS, roar: { ...FX_ANIMS.roar, frames: { 2: (p) => ({ ...p, jaw: 0.77 }) } } });
    expect(c.anims.roar!.poses[2].jaw).toBe(0.77);
    expect(FX_COMPILED.anims.roar!.poses[2].jaw).not.toBe(0.77);
  });

  it('draftGuardTransitions: 5 frames ≤ 0.4 s ending on guard f0 / idle f0; arms lead, the head comes last', () => {
    const idle0: TP = { x: 0, v: [0, 0], w: { a: 0, b: 0 }, tail: 0, flag: false, name: 'idle' };
    const guard0: TP = { x: 10, v: [10, 10], w: { a: 10, b: 10 }, tail: 10, flag: true, name: 'guard' };
    const d = draftGuardTransitions(TK, idle0, guard0);
    const loop = (p: TP) => ({ n: 1, at: () => p, holds: [100] });
    const one: AnimDef<TP> = { base: 'idle0', beats: [{ ms: 100, key: {} }], end: 'idle0' };
    const c = compileAnims(TK, { idle: loop(idle0), guard: loop(guard0), attack: one, roar: one, hit: one, toGuard: d.toGuard, fromGuard: d.fromGuard });
    for (const a of ['toGuard', 'fromGuard'] as const) {
      const s = c.anims[a]!.spec;
      expect(s.frames).toBe(5);
      expect(s.holds!.reduce((x, y) => x + y, 0)).toBeLessThanOrEqual(400);
      expect(s.holds).toEqual([...DRAFT_GUARD_HOLDS]);
    }
    expect(poseEqual(c.anims.toGuard!.poses[4], guard0)).toBe(true);
    expect(poseEqual(c.anims.fromGuard!.poses[4], idle0)).toBe(true);
    // progress per region on every in-between: arms (armN: v, wingN: w) ≥ body (tail) ≥ head (x)
    for (const p of c.anims.toGuard!.poses.slice(0, 4)) {
      expect(p.v[0]).toBeGreaterThan(p.tail);
      expect(p.w.a).toBeGreaterThan(p.tail);
      expect(p.tail).toBeGreaterThan(p.x);
    }
    for (const p of c.anims.fromGuard!.poses.slice(0, 4)) {
      expect(p.v[0]).toBeLessThan(p.tail); // from 10 down to 0: the arms are ahead
      expect(p.tail).toBeLessThan(p.x);
    }
  });

  it('toMonsterArt: specs, attackImpactFrame = release, points, P2 relight by default, frames drawn from the compiled poses', () => {
    const art = fixtureArt();
    expect(art.attackImpactFrame).toBe(5);
    expect(art.p2).toBe('relight');
    expect(art.anims.attack).toEqual(FX_COMPILED.anims.attack!.spec);
    expect(Object.keys(art.extraAnims!).sort()).toEqual(['death', 'fromGuard', 'hitHeavy', 'hitMagic', 'revive', 'summon', 'toGuard']);
    expect(art.muzzle).toEqual(art.points!('attack', 5).muzzle);
    // the last frame of a one-shot IS idle f0 in pixels, both lights
    for (const light of ['left', 'right'] as const) expect(frameDelta(drawFrame(art, 'attack', 10, light), drawFrame(art, 'idle', 0, light))).toBe(0);
  });
});

// ------------------------------------------------------------------ validateArt

const rules = (fs: readonly Finding[]) => fs.map((f) => `${f.rule} ${f.anim ?? '-'}`).sort();

/** A synthetic art whose specs break known rules; its frames are 1-px marks keyed by (anim, frame). */
function brokenArt(): MonsterArt {
  const spec = (holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames: holds.length, fps: 10, loop: false, holds, ...(marks ? { marks } : {}) });
  const draw = (p: PixelCanvas, anim: string, frame: number) => {
    p.rect(4, 4, 8, 8, PAL.mist);
    // the attack ends away from idle f0 (HA-14); everything else ends on it
    if (anim === 'attack' && frame === 9) p.rect(0, 0, 16, 16, PAL.white);
    if (anim === 'idle') p.set(frame, 0, PAL.steel);
  };
  return {
    id: 'broken' as unknown as MonsterId,
    w: 16,
    h: 16,
    anchorX: 8,
    anchorY: 15,
    hover: 0,
    muzzle: { x: 8, y: 8 },
    core: { x: 8, y: 8 },
    attackImpactFrame: 4,
    anims: {
      idle: { frames: 4, fps: 8, loop: true, holds: [120, 120, 120, 120] }, // HA-5
      guard: { frames: 2, fps: 6, loop: true, holds: [150, 160, 170] }, // SPEC: 3 holds for 2 frames
      // HA-1 no charge; HA-2 250; HA-3 release 90, longest after release, contact 120, recovery shortens; HA-14
      attack: spec([60, 90, 100, 110, 90, 120, 250, 140, 130, 100], { release: 4, impact: 4, contact: 5, recover: 7 }),
      roar: spec([100, 100, 100, 100], { charge: 0, release: 2, impact: 1, recover: 3 }), // HA-5, HA-1 impact ≠ release
      hit: spec([80, 90, 100, 110, 120, 130], { impact: 0, contact: 0, recover: 4 }), // HA-4 f0, f1, recover at 380
    },
    extraAnims: {
      death: spec([60, 90, 80, 70, 80, 90, 70, 60], { impact: 0, dissolve: 4 }), // HA-1 contact
      hitHeavy: spec([50, 60, 120, 130, 100, 100, 110], { impact: 0, contact: 0, recover: 4 }),
      hitMagic: spec([50, 60, 120, 110, 100, 110, 120], { impact: 0, contact: 0, recover: 4 }),
      summon: spec([90, 100, 110, 120, 130]), // HA-1 land
      toGuard: spec([40, 50, 50, 50, 60, 60, 70, 70, 80]), // HA-29 9 frames / 530 ms
      // no revive: §4.9
    },
    draw: (p, a, f) => draw(p, a, f),
    drawExtra: (p, a, f) => draw(p, a, f),
  };
}

describe('validateArt', () => {
  it('catches known violations (synthetic art)', () => {
    const f = validateArt(brokenArt(), { attack: 'melee' });
    const got = rules(f);
    for (const want of [
      'SPEC guard',
      '§4.9 revive',
      'HA-1 attack', // no charge
      'HA-1 roar', // impact ≠ release
      'HA-1 death', // no contact
      'HA-1 summon', // no land
      'HA-2 attack',
      'HA-3 attack',
      'HA-4 hit',
      'HA-5 idle',
      'HA-5 roar',
      'HA-14 attack',
      'HA-29 toGuard',
    ])
      expect(got, want).toContain(want);
    const ha3 = f.filter((x) => x.rule === 'HA-3').map((x) => x.message);
    expect(ha3.some((m) => /longest frame/.test(m))).toBe(true);
    expect(ha3.some((m) => /release f4 holds 90/.test(m))).toBe(true);
    expect(ha3.some((m) => /contact f5 holds 120/.test(m))).toBe(true);
    expect(ha3.some((m) => /recovery shortens/.test(m))).toBe(true);
    const ha4 = f.filter((x) => x.rule === 'HA-4').map((x) => x.message);
    expect(ha4.some((m) => /f0 holds 80/.test(m)) && ha4.some((m) => /f1 holds 90/.test(m)) && ha4.some((m) => /recover starts at 380/.test(m))).toBe(true);
    expect(f.find((x) => x.rule === 'HA-14')!.value).toBeGreaterThan(1.2);
    // hitHeavy / hitMagic keep the rhythm: no finding
    expect(got.filter((r) => / hit(Heavy|Magic)$/.test(r))).toEqual([]);
  });

  it('a clean compiled art (the fixture, normal tier) passes every rule', () => {
    expect(validateArt(fixtureArt(), { tier: 'normal', attack: 'melee' })).toEqual([]);
  }, 60_000);

  it('on the slice it reports only the deviations REHBER §10 documents', () => {
    // §10.6: the wyrm's death has no contact mark; the magus' attack none either (a projectile:
    // without the attack kind validateArt can only warn)
    const w = validateArt(wyrmV3, { tier: 'ace' });
    const m = validateArt(magusV3, { tier: 'ace' });
    expect(w.map((x) => [x.rule, x.anim, x.severity])).toEqual([['HA-1', 'death', 'error']]);
    expect(m.map((x) => [x.rule, x.anim, x.severity])).toEqual([['HA-1', 'attack', 'warn']]);
    expect(validateArt(magusV3, { tier: 'ace', attack: 'projectile', pixels: false })).toEqual([]);
  }, 120_000);
});

