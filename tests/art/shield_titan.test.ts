// Kalkan Devi (shield_titan) v3 on biped/v1: the art registers under ?look=v3, validateArt (normal tier) is clean,
// every base anim and extra exists with its marks, the muzzle / core / head points are on every frame, the idle
// stays alive (HA-18) without carrying the whole body off f0 (HA-21), the guard keeps the shield's foot planted,
// P2 is a relight of the same silhouette, the death's plates fall into a low heap and the revive mirrors it, the
// frames keep their margin, and the cut-in portrait and the card picture paint inside the palette.

import { describe, expect, it } from 'vitest';
import art, { TITAN } from '../../src/art/monsters-v3/shield_titan';
import card from '../../src/art/cardart-v3/shield_titan';
import cutinFactory from '../../src/art/cutins-v3/shield_titan';
import { renderArt } from '../../src/art/cardart-v3/_kit';
import { KIT } from '../../src/art/cutins/index';
import { PixelCanvas } from '../../src/art/pixel';
import { PAL } from '../../src/art/palette';
import { drawFrame, frameDelta, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';

const BASE = ['idle', 'guard', 'attack', 'roar', 'hit'] as const;
const EXTRA = ['summon', 'death', 'revive', 'hitHeavy', 'hitMagic', 'toGuard', 'fromGuard', 'victory'] as const;
const ALL: readonly AnyMonsterAnim[] = [...BASE, ...EXTRA];
type Spec = { frames: number; holds?: number[]; marks?: Record<string, number> };
const specOf = (a: AnyMonsterAnim): Spec => (art.anims as Record<string, Spec>)[a] ?? (art.extraAnims as Record<string, Spec>)[a];

const opaque = (p: PixelCanvas): number => {
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) n++;
  return n;
};
const PALETTE = new Set<number>(Object.values(PAL));

describe('shield_titan v3', () => {
  it('is a biped-plan art with the id, the frame and a filled distinction card', () => {
    expect(art.id).toBe('shield_titan');
    expect(art.bodyPlan.id).toBe('biped');
    expect([art.w, art.h]).toEqual([80, 80]);
    for (const v of Object.values(TITAN.distinction)) expect(String(v).length).toBeGreaterThan(40);
  });

  it('validateArt (normal tier) finds nothing', () => {
    expect(validateArt(art as never, { tier: 'normal' })).toEqual([]);
  });

  it('has every base anim and extra, with the base marks', () => {
    for (const a of ALL) expect(specOf(a), a).toBeTruthy();
    const m = specOf('attack').marks!;
    expect(m.charge).toBeLessThan(m.release);
    expect(m.release).toBe(m.impact);
    expect(m.contact).toBeGreaterThan(m.release);
    expect(specOf('death').marks!.dissolve).toBeGreaterThan(0);
    expect(specOf('summon').marks!.land).toBeGreaterThan(0);
    expect(specOf('revive').marks!.land).toBeGreaterThan(0);
  });

  it('draws only palette tones, and no frame touches the frame edge (margin ≥ 2)', () => {
    for (const a of ALL)
      for (let f = 0; f < specOf(a).frames; f++) {
        const p = drawFrame(art, a, f);
        for (let y = 0; y < p.h; y++)
          for (let x = 0; x < p.w; x++) {
            if (!p.isOpaque(x, y)) continue;
            expect(PALETTE.has(p.get(x, y)!), `${a}:${f} (${x},${y})`).toBe(true);
            expect(x >= 2 && y >= 2 && x < p.w - 2 && y < p.h - 2, `${a}:${f} margin (${x},${y})`).toBe(true);
          }
      }
  }, 60_000);

  it('puts the muzzle, the core and the head on the frame of every anim, at or above the floor', () => {
    for (const a of ALL)
      for (let f = 0; f < specOf(a).frames; f++) {
        const pt = art.points!(a, f);
        for (const n of ['muzzle', 'core', 'head'] as const) {
          expect(pt[n], `${a}:${f} ${n}`).toBeTruthy();
          expect(pt[n]!.y, `${a}:${f} ${n}`).toBeLessThanOrEqual(art.anchorY);
          expect(pt[n]!.x).toBeGreaterThanOrEqual(0);
          expect(pt[n]!.x).toBeLessThan(art.w);
        }
      }
  });

  it('keeps the idle alive (≥ 15 % of f0 per frame) without carrying the body off f0 (< 50 %), and the guard calmer', () => {
    const n = specOf('idle').frames;
    const f0 = drawFrame(art, 'idle', 0);
    const base = opaque(f0);
    let sum = 0;
    for (let f = 0; f < n; f++) {
      sum += frameDelta(drawFrame(art, 'idle', f), drawFrame(art, 'idle', (f + 1) % n));
      expect(frameDelta(drawFrame(art, 'idle', f), f0) / base, `idle ${f}`).toBeLessThan(0.5);
    }
    const idleD = sum / n;
    expect(idleD / base).toBeGreaterThanOrEqual(0.15);
    const g = specOf('guard').frames;
    let gs = 0;
    for (let f = 0; f < g; f++) gs += frameDelta(drawFrame(art, 'guard', f), drawFrame(art, 'guard', (f + 1) % g));
    expect(gs / g / idleD).toBeLessThan(0.8);
    expect(gs / g / idleD).toBeGreaterThan(0.3);
  });

  it('the struck first frames stay local (< 50 % of f0) and the feet band never slides in idle / guard', () => {
    const f0 = drawFrame(art, 'idle', 0);
    const base = opaque(f0);
    for (const a of ['hit', 'hitHeavy', 'hitMagic', 'death'] as const) expect(frameDelta(drawFrame(art, a, 0), f0) / base, a).toBeLessThan(0.5);
    const feet = (p: PixelCanvas) => {
      let x0 = 99;
      let x1 = -1;
      for (let y = 68; y <= 73; y++)
        for (let x = 0; x < p.w; x++)
          if (p.isOpaque(x, y)) {
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x);
          }
      return [x0, x1];
    };
    const ref = feet(f0);
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

  it('the bash drives the slab forward on the release and flares the rim on the contact', () => {
    const rel = specOf('attack').marks!.release;
    const cont = specOf('attack').marks!.contact;
    const a = art.points!('attack', 0).muzzle!;
    const b = art.points!('attack', rel).muzzle!;
    expect(b.x - a.x).toBeGreaterThanOrEqual(5);
    // the rim's lit edge is white on the contact frame (the flare), not on the release
    const white = (p: PixelCanvas) => {
      let n = 0;
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y) && p.get(x, y) === PAL.white) n++;
      return n;
    };
    expect(white(drawFrame(art, 'attack', cont))).toBeGreaterThan(white(drawFrame(art, 'attack', rel)) + 20);
  });

  it('the death ends in a low heap of plates and the revive starts from it, then stands whole', () => {
    const d = specOf('death').frames;
    const last = drawFrame(art, 'death', d - 1);
    let top = last.h;
    for (let y = 0; y < last.h && top === last.h; y++) for (let x = 0; x < last.w; x++) if (last.isOpaque(x, y)) top = y;
    expect(top).toBeGreaterThanOrEqual(art.anchorY - 24);
    const f0 = drawFrame(art, 'revive', 0);
    expect(frameDelta(f0, last) / opaque(last)).toBeLessThan(0.15);
    const rl = specOf('revive').frames - 1;
    expect(frameDelta(drawFrame(art, 'revive', rl), drawFrame(art, 'idle', 0))).toBe(0);
  });

  it('the summon comes up out of the floor and ends on idle f0', () => {
    const s = specOf('summon').frames;
    expect(opaque(drawFrame(art, 'summon', 0))).toBeLessThan(opaque(drawFrame(art, 'idle', 0)) / 6);
    expect(frameDelta(drawFrame(art, 'summon', s - 1), drawFrame(art, 'idle', 0))).toBeLessThan(120);
  });

  it('paints the card picture at both sizes inside the palette and the cut-in at its own density, both lights', () => {
    for (const size of ['big', 'small'] as const) {
      const r = renderArt(card, 0);
      const pic = size === 'big' ? r.bigPx : r.smallPx;
      expect([pic.w, pic.h]).toEqual(size === 'big' ? [88, 68] : [44, 34]);
      for (let y = 0; y < pic.h; y++) for (let x = 0; x < pic.w; x++) expect(PALETTE.has(pic.get(x, y)!), `${size} (${x},${y})`).toBe(true);
    }
    const cut = cutinFactory(KIT);
    expect(cut.id).toBe('shield_titan');
    expect([cut.w, cut.h]).toEqual([200, 144]);
    expect(cut.holds!.length).toBe(cut.frames);
    for (const light of ['left', 'right'] as const)
      for (let f = 0; f < cut.frames; f++) {
        const p = new PixelCanvas(cut.w, cut.h);
        cut.draw(p, f, { lightFrom: light });
        expect(opaque(p), `${light} ${f}`).toBeGreaterThan(5000);
        for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) expect(PALETTE.has(p.get(x, y)!)).toBe(true);
      }
  }, 60_000);
});
