// A4.1 step 2 — Magma Titanı v3 on biped/v1 (src/art/monsters-v3/_magma_titan.ts, NOT registered yet:
// the registry ignores '_' files): idle f0 is the approved still pixel for pixel (and so v1's outline),
// P2 is a relight (same silhouette, other light) in every frame of every anim, the five base anims and
// (part 2) the nine extras carry their marks and hold rules (validateArt clean), the lava keeps its one
// gold4 glint at rest, a resting titan is struck in any idle phase within 50 % (HA-21 phase) while the
// idle stays alive (HA-18), the feet change place only in the air, the punch leaves from the far lava
// fist, and the frames are deterministic. Part 2: the death drains the light before the core gutters and
// the basalt crumbles low, the revive re-ignites from the heap (the core first, the seams outward), the
// summon is poured out of the floor and ignites LAST, the special's fireball forms at the core and leaves
// on release within 900 ms, hitHeavy steps its rear foot back in the air, the guard transitions end on their poses.

import { describe, expect, it } from 'vitest';
import art, { TITAN } from '../../src/art/monsters-v3/_magma_titan';
import { MARKS } from '../../src/art/monsters-v3/magma_titan-anims';
import v1 from '../../src/art/monsters/magma_titan';
import { hasMonsterArtV3 } from '../../src/art/monsters';
import { PixelCanvas } from '../../src/art/pixel';
import { PAL } from '../../src/art/palette';
import { drawFrame, frameDelta, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim, MonsterAnim } from '../../src/art/types';
import { drawTitan } from '../../src/still/titan';

const BASE: readonly MonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit'];
const EXTRA = ['summon', 'death', 'revive', 'special', 'hitHeavy', 'hitMagic', 'victory', 'toGuard', 'fromGuard'] as const;
const ALL: readonly AnyMonsterAnim[] = [...BASE, ...EXTRA];
const specOf = (a: AnyMonsterAnim) => (art.anims as Record<string, { frames: number; holds?: number[]; marks?: Record<string, number> }>)[a] ?? art.extraAnims![a as (typeof EXTRA)[number]]!;
const msTo = (a: AnyMonsterAnim, f: number) => (specOf(a).holds ?? []).slice(0, f).reduce((x, y) => x + y, 0);
const count = (p: PixelCanvas, c: number) => {
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y) && p.get(x, y) === c) n++;
  return n;
};

describe('magma_titan v3 (biped/v1, A4.1 part 1)', () => {
  it('is not registered yet (step 3 registers it with its recipe)', () => {
    expect(hasMonsterArtV3('magma_titan')).toBe(false);
    expect(art.id).toBe('magma_titan');
  });

  it("idle f0 is the approved still pixel for pixel, on v1's outline", () => {
    const a3 = drawFrame(art, 'idle', 0);
    const still = new PixelCanvas(80, 80);
    drawTitan(still);
    const ref = new PixelCanvas(v1.w, v1.h);
    v1.draw(ref, 'idle', 0);
    expect([art.w, art.h, art.anchorX, art.anchorY]).toEqual([v1.w, v1.h, v1.anchorX, v1.anchorY]);
    let inter = 0;
    let uni = 0;
    let opaque = 0;
    let equal = 0;
    for (let y = 0; y < art.h; y++)
      for (let x = 0; x < art.w; x++) {
        const a = a3.isOpaque(x, y);
        const b = ref.isOpaque(x, y);
        if (a && b) inter++;
        if (a || b) uni++;
        if (a) {
          opaque++;
          if (still.isOpaque(x, y) && still.get(x, y) === a3.get(x, y)) equal++;
        }
      }
    expect(inter / uni).toBe(1);
    expect(equal / opaque).toBe(1);
    expect(opaque).toBe(2575);
  });

  it('P2 is a relight: every frame of every anim keeps the P1 silhouette, and idle f0 really changes its light', () => {
    for (const anim of ALL)
      for (let f = 0; f < specOf(anim).frames; f++) {
        const p1 = drawFrame(art, anim, f, 'left');
        const p2 = drawFrame(art, anim, f, 'right');
        let diff = 0;
        for (let y = 0; y < art.h; y++) for (let x = 0; x < art.w; x++) if (p1.isOpaque(x, y) !== p2.isOpaque(x, y)) diff++;
        expect(diff, `${anim} f${f}`).toBe(0);
      }
    expect(frameDelta(drawFrame(art, 'idle', 0, 'left'), drawFrame(art, 'idle', 0, 'right'))).toBeGreaterThan(400);
  }, 60_000);

  it('marks, holds and out (validateArt): clean for every anim; the attack is stomp → drive → punch', () => {
    const findings = validateArt(art, { tier: 'normal', attack: 'melee' });
    expect(findings.map((x) => `${x.severity} ${x.rule} ${x.anim}: ${x.message}`)).toEqual([]);
    expect(Object.keys(art.extraAnims ?? {}).sort()).toEqual([...EXTRA].sort());
    const a = art.anims.attack;
    expect(a.marks).toMatchObject({ charge: 0, stomp: 3, drive: 5, press: 6, release: 8, impact: 8, contact: 8, recover: 10 });
    expect(MARKS.attack).toEqual({ stomp: 3, drive: 5, press: 6, contact: 8 });
    const rel = a.marks!.release!;
    expect(a.holds![rel]).toBeLessThanOrEqual(70);
    // the drive is a 2-frame press (drive → press, the recipe holds them while the unit travels): the press is
    // the longest hold of the wind-up, the two together ≥ 200 ms, and the press is a different frame (the
    // coil a pixel deeper and a step hotter: a travel never slides a frozen statue)
    const wind = a.holds!.slice(0, rel);
    expect(a.holds![MARKS.attack.press]).toBe(Math.max(...wind));
    expect(a.holds![MARKS.attack.drive] + a.holds![MARKS.attack.press]).toBeGreaterThanOrEqual(200);
    expect(frameDelta(drawFrame(art, 'attack', MARKS.attack.drive), drawFrame(art, 'attack', MARKS.attack.press))).toBeGreaterThan(100);
    // the declaration holds the charge frame: a readable gather (not idle f0 with a brighter core)
    expect(frameDelta(drawFrame(art, 'idle', 0), drawFrame(art, 'attack', a.marks!.charge!))).toBeGreaterThan(300);
    expect(art.anims.roar.marks).toMatchObject({ charge: 0, release: 3, recover: 7 });
    expect(art.anims.hit.marks).toMatchObject({ impact: 0, contact: 0, recover: 4 });
  });

  it('the lava keeps its ONE gold4 glint at rest: idle exactly one, guard and hit never more, no white', () => {
    for (const side of ['left', 'right'] as const) {
      for (let f = 0; f < specOf('idle').frames; f++) {
        const p = drawFrame(art, 'idle', f, side);
        expect(count(p, PAL.gold4), `${side} idle f${f}`).toBe(1);
        expect(count(p, PAL.white), `${side} idle f${f}`).toBe(0);
      }
      for (const anim of ['guard', 'hit'] as const)
        for (let f = 0; f < specOf(anim).frames; f++) {
          const p = drawFrame(art, anim, f, side);
          expect(count(p, PAL.gold4), `${side} ${anim} f${f}`).toBeLessThanOrEqual(1);
          expect(count(p, PAL.white), `${side} ${anim} f${f}`).toBe(0);
        }
      // full heat on the release: the core's white centre and the white-hot fist
      expect(count(drawFrame(art, 'attack', art.anims.attack.marks!.release!, side), PAL.white)).toBeGreaterThan(6);
    }
  });

  it('every idle frame stays within 50 % of the struck f0 (HA-21 phase), and the idle stays alive (HA-18)', () => {
    const n = specOf('idle').frames;
    for (const side of ['left', 'right'] as const) {
      const idle = Array.from({ length: n }, (_, k) => drawFrame(art, 'idle', k, side));
      const op = idle[0].coverage();
      const f0 = drawFrame(art, 'hit', 0, side);
      expect(frameDelta(idle[0], f0) / op).toBeLessThan(0.5);
      for (let k = 0; k < n; k++) expect(frameDelta(idle[k], f0) / op, `${side} idle f${k} → hit f0`).toBeLessThan(0.5);
      const ds = idle.map((p, k) => frameDelta(idle[(k + n - 1) % n], p));
      const mean = ds.reduce((s, d) => s + d, 0) / n;
      expect(mean / op, side).toBeGreaterThanOrEqual(0.15);
      expect(Math.max(...ds) / mean, side).toBeLessThanOrEqual(1.8);
    }
  });

  it('pins biped v1; the feet stay home except the stomp, which moves the far foot only while it is in the air', () => {
    expect(art.bodyPlan).toEqual({ id: 'biped', version: 1 });
    expect(art.knock).toBe('pose');
    const home = [art.rig('idle', 0).footN, art.rig('idle', 0).footF];
    for (const anim of ['idle', 'guard', 'roar', 'hit'] as const)
      for (let f = 0; f < specOf(anim).frames; f++) expect([art.rig(anim, f).footN, art.rig(anim, f).footF], `${anim} f${f}`).toEqual(home);
    const n = specOf('attack').frames;
    let moved = 0;
    for (let f = 0; f < n; f++) expect(art.rig('attack', f).footN, `attack f${f}`).toEqual(home[0]);
    for (let f = 1; f < n; f++) {
      const a = art.pose('attack', f - 1) as unknown as { footF: { step: readonly number[]; lift: number } };
      const b = art.pose('attack', f) as unknown as { footF: { step: readonly number[]; lift: number } };
      if (a.footF.step[0] === b.footF.step[0] && a.footF.step[1] === b.footF.step[1]) continue;
      moved++;
      expect(a.footF.lift > 0 || b.footF.lift > 0, `attack f${f - 1}→f${f}: the far foot slid`).toBe(true);
    }
    expect(moved).toBeGreaterThanOrEqual(2);
    expect(art.rig('attack', n - 1).footF).toEqual(home[1]);
    for (const v of Object.values(TITAN.distinction)) if (typeof v === 'string') expect(v.length).toBeGreaterThan(40);
  });

  it('every point stays in the frame and above the ground; the punch leaves from the far lava fist', () => {
    for (const a of BASE)
      for (let f = 0; f < specOf(a).frames; f++)
        for (const [k, v] of Object.entries(art.points!(a, f))) {
          expect(v!.y, `${a} f${f} ${k}`).toBeLessThanOrEqual(art.anchorY);
          expect(v!.x >= 0 && v!.x < art.w && v!.y >= 0, `${a} f${f} ${k}`).toBe(true);
        }
    const rel = art.anims.attack.marks!.release!;
    const m = art.points!('attack', rel).muzzle!;
    const p = drawFrame(art, 'attack', rel);
    // the muzzle sits on the white-hot knuckles, ahead of the body (P1 faces right)
    expect(m.x).toBeGreaterThan(70);
    let hot = 0;
    for (let y = Math.round(m.y) - 4; y <= Math.round(m.y) + 4; y++) for (let x = Math.round(m.x) - 4; x <= Math.round(m.x) + 1; x++) if (p.get(x, y) === PAL.white) hot++;
    expect(hot).toBeGreaterThan(3);
  });

  it('is deterministic: the same frame twice is the same pixels', () => {
    for (const a of BASE) {
      const f = Math.floor(specOf(a).frames / 2);
      expect(frameDelta(drawFrame(art, a, f), drawFrame(art, a, f)), a).toBe(0);
      expect(frameDelta(drawFrame(art, a, f, 'right'), drawFrame(art, a, f, 'right')), a).toBe(0);
    }
  });
});

describe('magma_titan v3 extras (A4.1 part 2)', () => {
  const WARM = new Set<number>([PAL.fire2, PAL.fire3, PAL.fire4, PAL.gold4, PAL.white]);
  /** warm (fire2 … white) pixels within r of a point, or (away) farther than r */
  const warm = (p: PixelCanvas, c: { x: number; y: number }, r: number, away: boolean) => {
    let n = 0;
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < p.w; x++) if (WARM.has(p.get(x, y) as number) && Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y) > r === away) n++;
    return n;
  };
  const core = (a: AnyMonsterAnim, f: number) => art.points!(a, f).core!;
  const home = () => [art.rig('idle', 0).footN, art.rig('idle', 0).footF];

  it('carries the marks the kits sync to, and the death / revive passes of basalt', () => {
    expect(art.passes).toEqual({ death: 'crumble', revive: 'reassemble' });
    expect(specOf('summon').marks).toMatchObject({ land: 7 });
    expect(specOf('revive').marks).toMatchObject({ land: 5 });
    expect(specOf('death').marks).toMatchObject({ impact: 0, contact: 0, dissolve: 5 });
    expect(specOf('special').marks).toMatchObject({ charge: 0, release: 5, recover: 7 });
    for (const a of ['hitHeavy', 'hitMagic'] as const) expect(specOf(a).marks).toMatchObject({ impact: 0, contact: 0 });
  });

  it('the death drains the light out of the seams first, the core gutters last, then the basalt crumbles low', () => {
    expect(drawFrame(art, 'death', 0).data).toEqual(drawFrame(art, 'hitHeavy', 0).data); // HA-24: a lethal hitHeavy hands over without a jump
    const dis = specOf('death').marks!.dissolve!;
    const away = Array.from({ length: dis }, (_, f) => warm(drawFrame(art, 'death', f), core('death', f), 6, true));
    for (let f = 2; f < dis; f++) expect(away[f], `death f${f}: the seams' light only drains`).toBeLessThanOrEqual(away[f - 1]);
    expect(away[dis - 1]).toBe(0);
    // the core still burns after the seams have (almost) gone dark, and is out from the dissolve on
    expect(warm(drawFrame(art, 'death', dis - 2), core('death', dis - 2), 3, false)).toBeGreaterThan(20);
    expect(away[dis - 2]).toBeLessThan(away[1] / 4);
    for (let f = dis - 1; f < specOf('death').frames; f++) expect(warm(drawFrame(art, 'death', f), core('death', f), 3, false), `death f${f}`).toBe(0);
    const last = drawFrame(art, 'death', specOf('death').frames - 1);
    const idle = drawFrame(art, 'idle', 0);
    expect(last.bounds()!.h).toBeLessThanOrEqual(Math.round(idle.bounds()!.h * 0.7)); // REHBER HA-27: the last frame low and collapsed
    expect(last.coverage()).toBeLessThan(idle.coverage() * 0.8);
    for (let y = art.anchorY + 2; y < art.h; y++) for (let x = 0; x < art.w; x++) expect(last.isOpaque(x, y), `death last (${x}, ${y})`).toBe(false);
  });

  it('the revive re-ignites from its own heap — the core first, the seams outward — and is not the summon', () => {
    const n = specOf('death').frames;
    const heap = drawFrame(art, 'death', n - 1);
    const rv0 = drawFrame(art, 'revive', 0);
    expect(Math.abs(rv0.bounds()!.h - heap.bounds()!.h)).toBeLessThanOrEqual(3);
    expect(frameDelta(heap, rv0) / heap.coverage()).toBeLessThan(0.1);
    expect(warm(rv0, core('revive', 0), 3, false)).toBe(0);
    expect(warm(drawFrame(art, 'revive', 1), core('revive', 1), 3, false)).toBeGreaterThan(20); // the core relights first
    for (const f of [0, 1, 2]) expect(warm(drawFrame(art, 'revive', f), core('revive', f), 6, true), `revive f${f}`).toBe(0); // the seams still cold
    const land = specOf('revive').marks!.land!;
    expect(warm(drawFrame(art, 'revive', land), core('revive', land), 6, true)).toBeGreaterThan(60);
    // the titan's own rhythm (a long ember wake, a sudden heave): it lands no later than the magus's revive
    // (450 ms, the slowest land the soul_recall ≤ 2.1 s budget is measured with) and later than the wyrm's
    expect(msTo('revive', land)).toBeLessThanOrEqual(450);
    expect(msTo('revive', land)).toBeGreaterThan(330);
  });

  it('the summon is poured: it rises out of the floor, plants on [land], stands dark, and the core ignites LAST', () => {
    expect(drawFrame(art, 'summon', 0).coverage()).toBeLessThan(400); // only the floor splitting
    const land = specOf('summon').marks!.land!;
    expect(msTo('summon', land)).toBeLessThanOrEqual(520);
    const [n0, f0] = home();
    for (let f = 0; f < land; f++) expect(art.rig('summon', f).footN[1], `summon f${f}: still in the magma`).toBeGreaterThan(n0[1]);
    for (let f = land; f < specOf('summon').frames; f++) expect([art.rig('summon', f).footN, art.rig('summon', f).footF], `summon f${f}`).toEqual([n0, f0]);
    // dark from the land until the spark, at least two beats; lit from then on
    let spark = land;
    while (warm(drawFrame(art, 'summon', spark), core('summon', spark), 3, false) === 0) spark++;
    expect(spark).toBeGreaterThanOrEqual(land + 2);
    for (let f = spark; f < specOf('summon').frames; f++) expect(warm(drawFrame(art, 'summon', f), core('summon', f), 3, false), `summon f${f}`).toBeGreaterThan(20);
  });

  it('the special: the fireball forms at the core, leaves on [release] (≤ 70 ms hold) and the whole effect fits 900 ms', () => {
    const s = specOf('special');
    const rel = s.marks!.release!;
    expect(msTo('special', s.frames)).toBeLessThanOrEqual(900);
    expect(s.holds![rel]).toBeLessThanOrEqual(70);
    // the core point rides on the ball as it pushes out of the chest: on release it is where the ball leaves
    expect(core('special', rel).x - core('special', 0).x).toBeGreaterThanOrEqual(10);
    // the full ball (a white centre) sits ahead of the chest on the beat before the release (P1 faces right)
    const pre = drawFrame(art, 'special', rel - 1);
    const c = core('special', rel - 1);
    let white = 0;
    for (let y = Math.round(c.y) - 3; y <= Math.round(c.y) + 3; y++) for (let x = Math.round(c.x) - 3; x <= Math.round(c.x) + 3; x++) if (pre.get(x, y) === PAL.white) white++;
    expect(white).toBeGreaterThan(2);
    expect(c.x).toBeGreaterThan(core('idle', 0).x + 4);
  });

  it('hitHeavy: the heavy class\'s 2-px shove, the REAR foot stepping back and home only in the air', () => {
    const n = specOf('hitHeavy').frames;
    const hip0 = art.joints('hitHeavy', 0).hip.x;
    expect(Math.max(...Array.from({ length: n }, (_, f) => hip0 - art.joints('hitHeavy', f).hip.x))).toBe(2);
    const [n0, f0] = home();
    let moved = 0;
    // the front (far) foot never leaves its place; the stance widens (HA-23), never narrows
    for (let f = 0; f < n; f++) expect(art.rig('hitHeavy', f).footF, `hitHeavy f${f}`).toEqual(f0);
    for (let f = 1; f < n; f++) {
      const a = art.pose('hitHeavy', f - 1) as unknown as { footN: { step: readonly number[]; lift: number } };
      const b = art.pose('hitHeavy', f) as unknown as { footN: { step: readonly number[]; lift: number } };
      if (a.footN.step[0] === b.footN.step[0] && a.footN.step[1] === b.footN.step[1]) continue;
      moved++;
      expect(a.footN.lift > 0 || b.footN.lift > 0, `hitHeavy f${f - 1}→f${f}: the foot slid`).toBe(true);
    }
    expect(moved).toBeGreaterThanOrEqual(2);
    expect(Math.min(...Array.from({ length: n }, (_, f) => art.rig('hitHeavy', f).footN[0] - n0[0]))).toBe(-3);
    expect(art.rig('hitHeavy', n - 1).footN).toEqual(n0);
  });

  it('the feet stay planted in every other extra', () => {
    const h = home();
    for (const a of ['death', 'revive', 'special', 'hitMagic', 'victory', 'toGuard', 'fromGuard'] as const)
      for (let f = 0; f < specOf(a).frames; f++) expect([art.rig(a, f).footN, art.rig(a, f).footF], `${a} f${f}`).toEqual(h);
  });

  it('every struck f0 is local in every idle phase (HA-21 phase < 50 %), P1 and P2', () => {
    const n = specOf('idle').frames;
    for (const side of ['left', 'right'] as const) {
      const idle = Array.from({ length: n }, (_, k) => drawFrame(art, 'idle', k, side));
      const op = idle[0].coverage();
      for (const a of ['hitHeavy', 'hitMagic', 'death'] as const) {
        const f0 = drawFrame(art, a, 0, side);
        for (let k = 0; k < n; k++) expect(frameDelta(idle[k], f0) / op, `${side} idle f${k} → ${a} f0`).toBeLessThan(0.5);
      }
    }
  });

  it('guard transitions end on their poses within 0.4 s', () => {
    for (const a of ['toGuard', 'fromGuard'] as const) {
      expect(specOf(a).frames).toBeGreaterThanOrEqual(5);
      expect(msTo(a, specOf(a).frames)).toBeLessThanOrEqual(400);
    }
    expect(drawFrame(art, 'toGuard', specOf('toGuard').frames - 1).data).toEqual(drawFrame(art, 'guard', 0).data);
    expect(drawFrame(art, 'fromGuard', specOf('fromGuard').frames - 1).data).toEqual(drawFrame(art, 'idle', 0).data);
  });

  it('the lava rule in the extras: hitHeavy and the guard transitions top out at fire4; hitMagic is the one overload', () => {
    for (const side of ['left', 'right'] as const) {
      for (const a of ['hitHeavy', 'toGuard', 'fromGuard'] as const)
        for (let f = 0; f < specOf(a).frames; f++) {
          const p = drawFrame(art, a, f, side);
          expect(count(p, PAL.gold4), `${side} ${a} f${f}`).toBeLessThanOrEqual(1);
          expect(count(p, PAL.white), `${side} ${a} f${f}`).toBe(0);
        }
      // the spell burns through the eyes on the struck frame (white), the surge front gold along the seams
      expect(count(drawFrame(art, 'hitMagic', 0, side), PAL.white)).toBeGreaterThan(0);
      expect(count(drawFrame(art, 'hitMagic', 1, side), PAL.gold4)).toBeGreaterThan(20);
    }
  });

  it('the victory is its own held pose: the near fist raised to the face, burning, one breath, held last', () => {
    const s = specOf('victory');
    const last = s.frames - 1;
    expect(s.holds![last]).toBe(Math.max(...s.holds!));
    expect(s.holds![last]).toBeGreaterThanOrEqual(300);
    // the hold breathes before it settles: the frames before the last one still move (core, boulders, heat)
    for (const f of [last - 2, last - 1]) expect(frameDelta(drawFrame(art, 'victory', f), drawFrame(art, 'victory', f + 1)), `victory f${f}`).toBeGreaterThan(30);
    expect(art.points!('victory', last).hand!.y).toBeLessThan(art.points!('idle', 0).hand!.y - 12);
    expect(count(drawFrame(art, 'victory', 3), PAL.white)).toBeGreaterThan(6); // the knuckles ignite
  });

  it('every point of every anim stays inside the frame and at or above the ground line', () => {
    for (const a of ALL)
      for (let f = 0; f < specOf(a).frames; f++)
        for (const [k, v] of Object.entries(art.points!(a, f))) {
          expect(v!.y, `${a} f${f} ${k}`).toBeLessThanOrEqual(art.anchorY);
          expect(v!.x >= 0 && v!.x < art.w && v!.y >= 0, `${a} f${f} ${k}`).toBe(true);
        }
  });

  it('the extras are deterministic: the same frame twice is the same pixels, P1 and P2', () => {
    for (const a of EXTRA)
      for (const f of [0, Math.floor(specOf(a).frames / 2), specOf(a).frames - 1])
        for (const side of ['left', 'right'] as const) expect(frameDelta(drawFrame(art, a, f, side), drawFrame(art, a, f, side)), `${a} f${f} ${side}`).toBe(0);
  });
});
