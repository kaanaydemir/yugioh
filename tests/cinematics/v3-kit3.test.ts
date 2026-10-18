// v3 shared kits, part 3 (A2 fix round 1): the contact flash is shaped like light around the
// contact point (stepped bands, no straight cut, ≤ coverage of the silhouette), and the death
// pose's entry is chosen where the recoil on screen continues into it without a jump.

import { describe, expect, it } from 'vitest';
import { monsterArt } from '../../src/art/monsters';
import { PixelCanvas } from '../../src/art/pixel';
import { MONSTER_IDS } from '../../src/data/cards';
import { contactEdge, flashBands } from '../../src/cinematics/_v3/flash';
import { MAX_SKIP, SKIP_COST, chooseEntry } from '../../src/cinematics/_v3/posematch';

function idleMask(id: (typeof MONSTER_IDS)[number]): { mask: Uint8Array; w: number; h: number } {
  const art = monsterArt(id);
  const p = new PixelCanvas(art.w, art.h);
  art.draw(p, 'idle', 0);
  const mask = new Uint8Array(art.w * art.h);
  for (let i = 0; i < mask.length; i++) mask[i] = p.data[i * 4 + 3] >= 128 ? 1 : 0;
  return { mask, w: art.w, h: art.h };
}

describe('contact flash bands', () => {
  it('paint at most the coverage of every monster silhouette, from any side', () => {
    for (const id of MONSTER_IDS) {
      const { mask, w, h } = idleMask(id);
      for (const d of [{ x: 1, y: -0.5 }, { x: -1, y: 0.5 }, { x: 0, y: 1 }]) {
        for (const cover of [0.34, 0.4, 0.45, 0.9]) {
          const c = contactEdge(mask, w, h, d)!;
          expect(c).not.toBeNull();
          const b = flashBands(mask, w, h, c, d, cover);
          // with a tint the checkered band is full: core + band + a quarter of the edge
          let tinted = 0;
          for (let i = 0; i < b.band.length; i++) if (b.band[i] === 1 || b.band[i] === 2 || b.band[i] === 3) tinted++;
          expect(b.painted).toBeLessThanOrEqual(Math.min(0.5, cover) * b.total + 1);
          expect(tinted).toBeLessThanOrEqual(Math.min(0.5, cover) * b.total + 1);
          // only opaque pixels are lit (counted, one expect per case: a per-pixel expect made the
          // test timeout-flaky under load — A2 tech review r2 #15)
          let outside = 0;
          for (let i = 0; i < b.band.length; i++) if (b.band[i] && !mask[i]) outside++;
          expect(outside).toBe(0);
        }
      }
    }
  }, 60_000);

  it('light the struck side: the core is nearer the contact edge than the body centre', () => {
    const { mask, w, h } = idleMask('crystal_wyrm');
    let n = 0;
    let sx = 0;
    for (let i = 0; i < mask.length; i++) if (mask[i]) (n++, (sx += i % w));
    const cx = sx / n;
    const fromLeft = { x: 1, y: -0.5 };
    const b = flashBands(mask, w, h, contactEdge(mask, w, h, fromLeft)!, fromLeft, 0.4);
    let m = 0;
    let mx = 0;
    for (let i = 0; i < b.band.length; i++) if (b.band[i] === 1) (m++, (mx += i % w));
    expect(m).toBeGreaterThan(0);
    expect(mx / m).toBeLessThan(cx);
  });

  it('never cut the silhouette with one straight line: the lit edge is ragged (stepped + dithered)', () => {
    const { mask, w, h } = idleMask('abyss_magus');
    const d = { x: 0, y: 1 };
    const b = flashBands(mask, w, h, contactEdge(mask, w, h, d)!, d, 0.45);
    // rows that hold both lit and unlit opaque pixels: a horizontal cut would have ~none
    let mixed = 0;
    for (let y = 0; y < h; y++) {
      let lit = 0;
      let dark = 0;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!mask[i]) continue;
        if (b.band[i] === 1) lit++;
        else dark++;
      }
      if (lit && dark) mixed++;
    }
    expect(mixed).toBeGreaterThan(4);
  });
});

describe('death entry (pose match)', () => {
  it('starts the death on the frame the recoil continues into, skipping only when it pays', () => {
    // recoil frame 1 is almost the death's frame 0
    const delta = (r: number, j: number) => [[4, 4.5, 4.2, 3.9], [0.05, 3.9, 3.9, 4.6], [2.1, 4.3, 4.2, 4.5]][r][j];
    const e = chooseEntry('hitMagic', 3, 10, delta)!;
    expect(e).toMatchObject({ anim: 'hitMagic', hold: 1, start: 0 });
    // a skip costs SKIP_COST per frame
    const skip = chooseEntry('hit', 1, 10, (_r, j) => [3, 3, 0.2, 3][j])!;
    expect(skip.start).toBe(2);
    expect(skip.cost).toBeCloseTo(0.2 + 2 * SKIP_COST);
    // never more than MAX_SKIP frames, never past the death's second-to-last frame
    const far = chooseEntry('hit', 1, 4, (_r, j) => (j >= 2 ? 0 : 9))!;
    expect(far.start).toBeLessThanOrEqual(Math.min(MAX_SKIP, 4 - 2));
  });

  it('gives no entry when nothing is measurable', () => {
    expect(chooseEntry('hit', 2, 8, () => null)).toBeNull();
  });
});
