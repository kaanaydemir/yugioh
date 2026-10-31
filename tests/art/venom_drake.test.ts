// Zehir Ejderi (venom_drake) v3 art — the hand-rigged SCORPION WYVERN (docs/v3/kart-a/venom_drake.md §3):
// validateArt (ace tier) is clean, every anim and its marks exist, the muzzle is on every frame, the feet band
// (bottom 6 rows) stays fixed in idle / guard / toGuard / fromGuard, P2 is a relight of the same silhouette,
// the death leaves < 10 % of the idle body at its last frame, special f0 / f1 meet the held attack f1 (the
// direct-attack seam), the shared hole mask grows with its step, and the card picture paints at both sizes
// inside the palette.

import { describe, expect, it } from 'vitest';
import art, { VENOM_DRAKE_DISTINCTION } from '../../src/art/monsters-v3/venom_drake-wyvern';
import card from '../../src/art/cardart-v3/venom_drake';
import { holeAt } from '../../src/art/monsters-v3/venom_drake-holes';
import { PixelCanvas } from '../../src/art/pixel';
import { drawFrame, frameDelta, validateArt } from '../../src/art/rigkit';
import { PAL } from '../../src/art/palette';
import { renderArt } from '../../src/art/cardart-v3/_kit';
import type { AnyMonsterAnim } from '../../src/art/types';

const BASE: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit'];
const EXTRAS: readonly AnyMonsterAnim[] = ['toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive', 'special'];
type Spec = { frames: number; holds?: number[]; marks?: Record<string, number> };
const specOf = (a: AnyMonsterAnim): Spec => (art.anims as Record<string, Spec>)[a] ?? (art.extraAnims as Record<string, Spec>)[a];

const opaque = (p: PixelCanvas): number => {
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) n++;
  return n;
};
/** The opaque x range of the bottom 6 rows (tools/lib/framelib feetBand). */
const feet = (p: PixelCanvas): [number, number] => {
  let x0 = p.w;
  let x1 = -1;
  for (let y = p.h - 1; y >= 0; y--) {
    let any = false;
    for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) any = true;
    if (!any) continue;
    for (let yy = y; yy > y - 6; yy--) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, yy)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    break;
  }
  return [x0, x1];
};

describe('venom_drake v3 (scorpion wyvern)', () => {
  it('is the hand rig with the id, the 100×92 frame, the anchor and a filled distinction card', () => {
    expect(art.id).toBe('venom_drake');
    expect([art.w, art.h, art.anchorX, art.anchorY]).toEqual([100, 92, 48, 86]);
    expect(art.p2).toBe('relight');
    expect(art.weight).toBe('medium');
    for (const v of Object.values(VENOM_DRAKE_DISTINCTION)) expect(String(v).length).toBeGreaterThan(40);
  });

  it('validateArt (ace tier, projectile) finds no error', () => {
    const errs = validateArt(art, { tier: 'ace', attack: 'projectile' }).filter((f) => f.severity === 'error');
    expect(errs).toEqual([]);
  });

  it('has every anim with the blueprint frame counts and marks', () => {
    const want: Record<string, number> = { idle: 18, guard: 8, toGuard: 6, fromGuard: 6, attack: 14, roar: 12, hit: 6, hitHeavy: 7, hitMagic: 7, summon: 15, death: 11, revive: 11, special: 12 };
    let total = 0;
    for (const a of [...BASE, ...EXTRAS]) {
      expect(specOf(a), a).toBeTruthy();
      expect(specOf(a).frames, a).toBe(want[a]);
      total += specOf(a).frames;
    }
    expect(total).toBe(133);
    expect(specOf('attack').marks).toMatchObject({ charge: 1, release: 6, impact: 6, contact: 9, recover: 10 });
    expect(specOf('death').marks).toMatchObject({ impact: 0, contact: 0, dissolve: 3 });
    expect(specOf('summon').marks!.land).toBe(4);
    expect(specOf('revive').marks!.land).toBe(7);
    // revive land at 500 ms (soul_recall's glide minimum; blueprint §4 revive)
    expect(specOf('revive').holds!.slice(0, 7).reduce((a, b) => a + b, 0)).toBe(500);
    // attack: charge → release 400 ms (HA-8)
    expect(specOf('attack').holds!.slice(1, 6).reduce((a, b) => a + b, 0)).toBe(400);
  });

  it('draws the muzzle on every frame of every anim', () => {
    for (const a of [...BASE, ...EXTRAS]) for (let f = 0; f < specOf(a).frames; f++) expect(art.points!(a, f).muzzle, `${a}:${f}`).toBeTruthy();
  });

  it('keeps the feet band fixed in idle / guard / toGuard / fromGuard (HA-9)', () => {
    const ref = feet(drawFrame(art, 'idle', 0));
    for (const a of ['idle', 'guard', 'toGuard', 'fromGuard'] as const)
      for (let f = 0; f < specOf(a).frames; f++) expect(feet(drawFrame(art, a, f)), `${a}:${f}`).toEqual(ref);
  });

  it('idle f0 holds a body and P2 is a relight with the same silhouette', () => {
    const p1 = drawFrame(art, 'idle', 0, 'left');
    const p2 = drawFrame(art, 'idle', 0, 'right');
    expect(opaque(p1)).toBeGreaterThan(2200);
    expect(opaque(p2)).toBe(opaque(p1));
    for (let y = 0; y < p1.h; y++) for (let x = 0; x < p1.w; x++) expect(p2.isOpaque(x, y)).toBe(p1.isOpaque(x, y));
    expect(frameDelta(p1, p2)).toBeGreaterThan(200); // the planes swap sides
  });

  it('the bulb carries the one gold4 pixel of idle f0', () => {
    const p = drawFrame(art, 'idle', 0);
    let n = 0;
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.get(x, y) === PAL.gold4) n++;
    expect(n).toBe(1);
  });

  it('the death eats the body away: < 10 % of idle f0 at its last frame', () => {
    const i0 = opaque(drawFrame(art, 'idle', 0));
    expect(opaque(drawFrame(art, 'death', specOf('death').frames - 1))).toBeLessThan(i0 * 0.1);
    // the lace (f6) is a body made of holes: well under the struck body
    expect(opaque(drawFrame(art, 'death', 6))).toBeLessThan(opaque(drawFrame(art, 'death', 2)) * 0.6);
  });

  it('special f0 is the held attack f1 pixel for pixel, special f1 within 1× idleΔ of it', () => {
    const a1 = drawFrame(art, 'attack', 1);
    expect(frameDelta(drawFrame(art, 'special', 0), a1)).toBe(0);
    let idleD = 0;
    const n = specOf('idle').frames;
    for (let f = 0; f < n; f++) idleD += frameDelta(drawFrame(art, 'idle', f), drawFrame(art, 'idle', (f + 1) % n));
    idleD /= n;
    expect(frameDelta(drawFrame(art, 'special', 1), a1)).toBeLessThanOrEqual(idleD);
  });

  it('the shared hole mask only grows with its step and the lace keeps strands', () => {
    let prev = -1;
    for (const step of [0, 1, 2, 3]) {
      let n = 0;
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (holeAt(x, y, step, 5)) n++;
      expect(n).toBeGreaterThan(prev);
      prev = n;
    }
    expect(prev).toBeLessThan(64 * 64 * 0.9);
  });

  it('the card picture paints at both sizes, palette only, with a body', () => {
    const pal = new Set<number>(Object.values(PAL) as number[]);
    const r = renderArt(card, 0);
    for (const pic of [r.bigPx, r.smallPx]) {
      let off = 0;
      for (let y = 0; y < pic.h; y++) for (let x = 0; x < pic.w; x++) {
        const c = pic.get(x, y);
        if (c !== null && !pal.has(c)) off++;
      }
      expect(off).toBe(0);
      expect(opaque(pic)).toBeGreaterThan(pic.w * pic.h * 0.9);
    }
    expect(r.bigPx.w).toBe(88);
    expect(r.smallPx.w).toBe(44);
  });
});
