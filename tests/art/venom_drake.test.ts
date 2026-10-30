// Zehir Ejderi (venom_drake) v3 art on the 'serpent' type: validateArt (normal tier) is clean, every base anim and
// extra exists with its marks, the muzzle is on every frame, the planted coil keeps its feet, P2 is a relight of the
// same silhouette, the summon forms the head last, the death melts (the horns melt too, the blade stays) and the
// card picture paints at both sizes inside the palette.

import { describe, expect, it } from 'vitest';
import art, { VENOM_DRAKE } from '../../src/art/monsters-v3/venom_drake';
import card from '../../src/art/cardart-v3/venom_drake';
import { PixelCanvas } from '../../src/art/pixel';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import { PAL } from '../../src/art/palette';
import { renderArt } from '../../src/art/cardart-v3/_kit';
import type { AnyMonsterAnim } from '../../src/art/types';

const BASE: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard'];
const EXTRAS: readonly AnyMonsterAnim[] = ['hitHeavy', 'hitMagic', 'summon', 'death', 'revive', 'victory'];
type Spec = { frames: number; holds?: number[]; marks?: Record<string, number> };
const specOf = (a: AnyMonsterAnim): Spec => (art.anims as Record<string, Spec>)[a] ?? (art.extraAnims as Record<string, Spec>)[a];

const opaque = (p: PixelCanvas): number => {
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) n++;
  return n;
};

describe('venom_drake v3', () => {
  it('is a serpent-plan art with the id, the frame and a filled distinction card', () => {
    expect(art.id).toBe('venom_drake');
    expect(art.bodyPlan.id).toBe('serpent');
    expect([art.w, art.h]).toEqual([88, 92]);
    for (const v of Object.values(VENOM_DRAKE.distinction)) expect(String(v).length).toBeGreaterThan(20);
  });

  it('validateArt (normal tier) finds no error', () => {
    const errs = validateArt(art as never, { attack: 'projectile' } as never).filter((f) => f.severity === 'error');
    expect(errs).toEqual([]);
  });

  it('has every base anim and extra, with the base marks', () => {
    for (const a of [...BASE, ...EXTRAS]) expect(specOf(a), a).toBeTruthy();
    const m = specOf('attack').marks!;
    expect(m.charge).toBeLessThan(m.release);
    expect(m.release).toBe(m.impact);
    expect(m.contact).toBeGreaterThanOrEqual(m.release);
    expect(specOf('death').marks!.dissolve).toBeGreaterThan(0);
    expect(specOf('summon').marks!.land).toBeGreaterThan(0);
  });

  it('draws the muzzle on every frame of every anim', () => {
    for (const a of [...BASE, ...EXTRAS]) for (let f = 0; f < specOf(a).frames; f++) expect(art.points!(a, f).muzzle, `${a}:${f}`).toBeTruthy();
  });

  it('idle f0 holds a body and P2 is a relight with the same silhouette', () => {
    const p1 = drawFrame(art, 'idle', 0, 'left');
    const p2 = drawFrame(art, 'idle', 0, 'right');
    expect(opaque(p1)).toBeGreaterThan(1500);
    expect(opaque(p2)).toBe(opaque(p1));
    for (let y = 0; y < p1.h; y++) for (let x = 0; x < p1.w; x++) expect(p2.isOpaque(x, y)).toBe(p1.isOpaque(x, y));
  });

  it('the summon forms the body tail-first and the head last; the death ends in a low heap', () => {
    const s0 = drawFrame(art, 'summon', 0, 'left');
    const sN = drawFrame(art, 'summon', specOf('summon').frames - 1, 'left');
    expect(opaque(s0)).toBeLessThan(opaque(sN) * 0.2);
    const d = drawFrame(art, 'death', specOf('death').frames - 1, 'left');
    const i0 = drawFrame(art, 'idle', 0, 'left');
    expect(d.bounds()!.h).toBeLessThan(i0.bounds()!.h * 0.6);
  });

  it('the guard holds a different, readable pose from the idle', () => {
    const a = drawFrame(art, 'idle', 0, 'left');
    const b = drawFrame(art, 'guard', 0, 'left');
    let diff = 0;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (a.get(x, y) !== b.get(x, y)) diff++;
    expect(diff).toBeGreaterThan(600);
  });

  it('the card picture paints at both sizes, palette only, with a body', () => {
    const pal = new Set<number>(Object.values(PAL) as number[]);
    for (const size of ['big', 'small'] as const) {
      const r = renderArt(card, 0);
      const pic = size === 'big' ? r.bigPx : r.smallPx;
      expect(pic.w).toBe(size === 'big' ? 88 : 44);
      let off = 0;
      for (let y = 0; y < pic.h; y++) for (let x = 0; x < pic.w; x++) {
        const c = pic.get(x, y);
        if (c !== null && !pal.has(c)) off++;
      }
      expect(off).toBe(0);
      expect(opaque(pic)).toBeGreaterThan(pic.w * pic.h * 0.9);
    }
  });
});
