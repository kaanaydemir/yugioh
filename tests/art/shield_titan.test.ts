// Kalkan Devi (shield_titan) v3 — a hand-built rig (docs/v3/oturum-f/shield_titan.md §1–§5, §12): the art registers
// under ?look=v3 (no exclusion left), validateArt (normal tier) is clean, every anim exists with its marks, the points
// sit on every frame, the idle is alive without carrying the body off f0, the feet and the shield's foot never slide in
// idle / guard / transitions, P2 is a relight of the same silhouette, the attack's muzzle is the slab's rim reaching
// forward and the boss flares on contact, the death ends as the LID lying low over him (boss up, giant hidden but for
// the peek) and the revive starts from it, the summon starts with the slab lying low and the giant hauling, the palette
// keeps gold3 / gold4 for the light, and the card picture paints at both sizes within the kit budgets.

import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/shield_titan';
import indexSrc from '../../src/art/monsters/index.ts?raw';
import card from '../../src/art/cardart-v3/shield_titan';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { PixelCanvas } from '../../src/art/pixel';
import { PAL } from '../../src/art/palette';
import { drawFrame, frameDelta, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';

const BASE = ['idle', 'guard', 'attack', 'roar', 'hit'] as const;
const EXTRA = ['summon', 'death', 'revive', 'special', 'hitHeavy', 'hitMagic', 'toGuard', 'fromGuard'] as const;
const ALL: readonly AnyMonsterAnim[] = [...BASE, ...EXTRA];
type Spec = { frames: number; holds?: number[]; marks?: Record<string, number> };
const specOf = (a: AnyMonsterAnim): Spec => (art.anims as Record<string, Spec>)[a] ?? (art.extraAnims as Record<string, Spec>)[a];

const opaque = (p: PixelCanvas): number => {
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) n++;
  return n;
};
const count = (p: PixelCanvas, c: number): number => {
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y) && p.get(x, y) === c) n++;
  return n;
};
const topRow = (p: PixelCanvas): number => p.bounds()!.y;
const PALETTE = new Set<number>(Object.values(PAL));
const FORBIDDEN = new Set<number>([PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.crim0, PAL.crim1, PAL.crim2, PAL.crim3, PAL.crim4,
  PAL.teal0, PAL.teal1, PAL.teal2, PAL.teal3, PAL.teal4, PAL.mag0, PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag4]);

describe('shield_titan v3', () => {
  it('is a hand-built heavy relit art of 84×82 that the v3 registry no longer excludes', () => {
    expect(art.id).toBe('shield_titan');
    expect(art.bodyPlan).toBeUndefined();
    expect([art.w, art.h, art.anchorX, art.anchorY]).toEqual([84, 82, 34, 77]);
    expect(art.weight).toBe('heavy');
    expect(art.p2).toBe('relight');
    expect(indexSrc).toContain("'../monsters-v3/*.ts'");
    expect(indexSrc).not.toContain("'!../monsters-v3/shield_titan.ts'");
    expect(Object.keys(import.meta.glob('../../src/art/monsters-v3/_shield_titan.ts'))).toEqual([]);
    // the dropped cut-in (non-ace: S.climax never plays it) must not linger with the old rig's imports
    expect(Object.keys(import.meta.glob('../../src/art/cutins-v3/shield_titan.ts'))).toEqual([]);
  });

  it('validateArt (normal tier, melee) finds nothing', () => {
    expect(validateArt(art, { tier: 'normal', attack: 'melee' }).map((f) => `${f.severity} ${f.rule} ${f.anim}: ${f.message}`)).toEqual([]);
  });

  it('has every anim with holds and the marks of the storyboards', () => {
    for (const a of ALL) {
      expect(specOf(a), a).toBeTruthy();
      expect(specOf(a).holds?.length, a).toBe(specOf(a).frames);
    }
    expect(specOf('attack').marks).toMatchObject({ charge: 3, release: 6, impact: 6, contact: 7, recover: 9 });
    expect(art.attackImpactFrame).toBe(6);
    expect(specOf('roar').marks).toMatchObject({ charge: 1, release: 3, impact: 3, recover: 6 });
    expect(specOf('special').marks).toMatchObject({ charge: 2, release: 3, impact: 3, recover: 10 });
    for (const a of ['hit', 'hitHeavy', 'hitMagic'] as const) expect(specOf(a).marks, a).toMatchObject({ impact: 0, contact: 0 });
    expect(specOf('death').marks).toMatchObject({ impact: 0, contact: 0, dissolve: 6 });
    expect(specOf('summon').marks).toMatchObject({ land: 8 });
    expect(specOf('revive').marks).toMatchObject({ land: 7 });
    const total = ALL.reduce((n, a) => n + specOf(a).frames, 0);
    expect(total).toBe(129);
    expect(art.w * art.h * 4 * total).toBeLessThanOrEqual(3.6e6);
  });

  it('draws only palette tones (no cyan / crim / teal / mag), keeps a 2-px margin, and is deterministic', () => {
    for (const a of ALL)
      for (let f = 0; f < specOf(a).frames; f++)
        for (const light of ['left', 'right'] as const) {
          const p = drawFrame(art, a, f, light);
          for (let y = 0; y < p.h; y++)
            for (let x = 0; x < p.w; x++) {
              if (!p.isOpaque(x, y)) continue;
              const c = p.get(x, y)!;
              if (!PALETTE.has(c) || FORBIDDEN.has(c)) throw new Error(`${a}:${f} ${light} tone ${c.toString(16)} at (${x},${y})`);
              if (x < 2 || y < 2 || x >= p.w - 2 || y >= p.h - 2) throw new Error(`${a}:${f} ${light} margin (${x},${y})`);
            }
        }
    expect(frameDelta(drawFrame(art, 'attack', 7), drawFrame(art, 'attack', 7))).toBe(0);
  }, 60_000);

  it('puts every point on every frame, at or above the floor', () => {
    for (const a of ALL)
      for (let f = 0; f < specOf(a).frames; f++) {
        const pt = art.points!(a, f);
        for (const n of ['muzzle', 'core', 'head', 'hand', 'grip', 'feet'] as const) {
          expect(pt[n], `${a}:${f} ${n}`).toBeTruthy();
          expect(pt[n]!.y, `${a}:${f} ${n}`).toBeLessThanOrEqual(art.anchorY);
          expect(pt[n]!.x, `${a}:${f} ${n}`).toBeGreaterThanOrEqual(0);
          expect(pt[n]!.x, `${a}:${f} ${n}`).toBeLessThan(art.w);
        }
      }
  });

  it('keeps the idle alive (HA-18 ≥ 15 %) without carrying the body off f0, and the guard calmer (HA-19)', () => {
    for (const light of ['left', 'right'] as const) {
      const n = specOf('idle').frames;
      const idle = Array.from({ length: n }, (_, f) => drawFrame(art, 'idle', f, light));
      const base = opaque(idle[0]);
      let sum = 0;
      let max = 0;
      for (let f = 0; f < n; f++) {
        const d = frameDelta(idle[f], idle[(f + 1) % n]);
        sum += d;
        max = Math.max(max, d);
        expect(frameDelta(idle[f], idle[0]) / base, `idle ${f}`).toBeLessThan(0.5);
      }
      const idleD = sum / n;
      expect(idleD / base, light).toBeGreaterThanOrEqual(0.15);
      expect(max / idleD, light).toBeLessThanOrEqual(1.8);
      const g = specOf('guard').frames;
      let gs = 0;
      for (let f = 0; f < g; f++) gs += frameDelta(drawFrame(art, 'guard', f, light), drawFrame(art, 'guard', (f + 1) % g, light));
      expect(gs / g / idleD).toBeGreaterThan(0.3);
      expect(gs / g / idleD).toBeLessThan(0.8);
    }
  }, 60_000);

  it('the struck first frames stay local in every idle phase (KK-4) and the feet band never slides (HA-9)', () => {
    const idle = Array.from({ length: specOf('idle').frames }, (_, f) => drawFrame(art, 'idle', f));
    const base = opaque(idle[0]);
    for (const a of ['hit', 'hitHeavy', 'hitMagic', 'death'] as const) {
      const f0 = drawFrame(art, a, 0);
      expect(Math.max(...idle.map((i) => frameDelta(f0, i))) / base, a).toBeLessThan(0.5);
    }
    const feet = (p: PixelCanvas) => {
      const b = p.bounds()!;
      const bottom = b.y + b.h - 1;
      let x0 = 999;
      let x1 = -1;
      for (let y = bottom - 5; y <= bottom; y++)
        for (let x = 0; x < p.w; x++)
          if (p.isOpaque(x, y)) {
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x);
          }
      return [bottom, x0, x1];
    };
    const ref = feet(idle[0]);
    expect(ref[0]).toBe(art.anchorY + 1); // the ink line under the soles
    for (const a of ['idle', 'guard', 'toGuard', 'fromGuard'] as const) for (let f = 0; f < specOf(a).frames; f++) expect(feet(drawFrame(art, a, f)), `${a}:${f}`).toEqual(ref);
  });

  it('P2 is a relight: every frame keeps the P1 silhouette but not the tones', () => {
    for (const a of ALL)
      for (let f = 0; f < specOf(a).frames; f++) {
        const l = drawFrame(art, a, f, 'left');
        const r = drawFrame(art, a, f, 'right');
        for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) if (l.isOpaque(x, y) !== r.isOpaque(x, y)) throw new Error(`${a}:${f} silhouette differs at (${x},${y})`);
      }
    expect(frameDelta(drawFrame(art, 'idle', 0, 'left'), drawFrame(art, 'idle', 0, 'right'))).toBeGreaterThan(200);
  });

  it('keeps gold3 / gold4 for the light: idle shows only the sunstone core, the ward frames light rings and courses', () => {
    const idle0 = drawFrame(art, 'idle', 0);
    expect(count(idle0, PAL.gold3) + count(idle0, PAL.gold4)).toBeLessThanOrEqual(20);
    const charge = drawFrame(art, 'special', specOf('special').marks!.charge);
    expect(count(charge, PAL.gold3) + count(charge, PAL.gold4)).toBeGreaterThan(60);
  });

  it('the bash: the muzzle is the rim and it reaches forward on the release, the boss flares on the contact', () => {
    const m = specOf('attack').marks!;
    const a = art.points!('attack', 0).muzzle!;
    const b = art.points!('attack', m.release).muzzle!;
    expect(b.x - a.x).toBeGreaterThanOrEqual(12);
    expect(b.x).toBeLessThanOrEqual(art.w - 3);
    const hot = (f: number) => count(drawFrame(art, 'attack', f), PAL.gold4) + count(drawFrame(art, 'attack', f), PAL.gold3);
    expect(hot(m.contact)).toBeGreaterThan(hot(m.release) + 20);
  });

  it('the death closes the lid over him: the final frame is low (≥ anchorY − 24), the boss still glows, the revive starts from it', () => {
    const d = specOf('death').frames;
    const last = drawFrame(art, 'death', d - 1);
    expect(topRow(last)).toBeGreaterThanOrEqual(art.anchorY - 24);
    const b = last.bounds()!;
    expect(b.w).toBeGreaterThanOrEqual(50); // a long lid along the floor, not a heap
    expect(count(last, PAL.gold3) + count(last, PAL.gold4)).toBeGreaterThan(0); // the last pulse
    expect(count(last, PAL.skin2) + count(last, PAL.stone4)).toBeGreaterThan(0); // the peek: beard tip / fingers
    // the teeter: on f4–f5 the shield stands alone while he is folded low behind it
    expect(topRow(drawFrame(art, 'death', 4))).toBeLessThan(art.anchorY - 50);
    const r0 = drawFrame(art, 'revive', 0);
    expect(frameDelta(r0, last) / opaque(last)).toBeLessThan(0.15);
    const rl = specOf('revive').frames - 1;
    expect(frameDelta(drawFrame(art, 'revive', rl), drawFrame(art, 'idle', 0))).toBe(0);
  });

  it('the summon starts with the slab lying low and the giant hauling, stands tall by the land, and ends on idle f0', () => {
    const s0 = drawFrame(art, 'summon', 0);
    expect(topRow(s0)).toBeGreaterThan(art.anchorY - 40);
    expect(count(s0, PAL.skin2)).toBeGreaterThan(50); // the giant is real from frame 0
    const land = drawFrame(art, 'summon', specOf('summon').marks!.land);
    expect(topRow(land)).toBeLessThan(art.anchorY - 50);
    const s = specOf('summon').frames;
    expect(frameDelta(drawFrame(art, 'summon', s - 1), drawFrame(art, 'idle', 0))).toBe(0);
    // summon f1–f3 (the slab rising INTO view) is not the revive's f2–f4 (the lid lifted from under it)
    for (let k = 0; k < 3; k++) expect(frameDelta(drawFrame(art, 'summon', 1 + k), drawFrame(art, 'revive', 2 + k)) / opaque(drawFrame(art, 'idle', 0))).toBeGreaterThan(0.5);
  });

  it('paints the card picture at both sizes, every living frame, within the kit budgets', () => {
    for (let f = 0; f < (card.frames ?? 1); f++) {
      const r = renderArt(card, f);
      expect(r.auto).toBe(false);
      expect([r.bigPx.w, r.bigPx.h]).toEqual([88, 68]);
      expect([r.smallPx.w, r.smallPx.h]).toEqual([44, 34]);
      for (const [l, px, focus] of [[r.big, r.bigPx, card.focus], [r.small, r.smallPx, card.focusSmall!]] as const) {
        const st = artStats(l, px, focus, true);
        expect(st.offPalette).toBe(0);
        expect(st.isolated).toBeLessThanOrEqual(0.1);
        expect(st.colors).toBeLessThanOrEqual(20);
        expect(st.backdropColors).toBeLessThanOrEqual(6);
        expect(st.focusOk).toBe(true);
      }
    }
    // the face shows the small picture through portrait()
    const p = new PixelCanvas(44, 34);
    art.portrait!(p);
    expect(frameDelta(p, renderArt(card, 0).smallPx)).toBe(0);
  });
});
