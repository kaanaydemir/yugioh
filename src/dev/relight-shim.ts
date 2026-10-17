// DEV / TEST ONLY — never registered as a monster (src/art/monsters is untouched). A1 item 10:
// proves the P2 'relight' pipe before any v3 art exists (A2).
//
// relightShimArt(): the game's abyss_magus with `p2: 'relight'` whose draw(..., { lightFrom:
// 'right' }) returns, for the IDLE anim, the hand-painted still frame (src/still/magus-map.ts — lit
// from the FRAME's top-right, i.e. from the screen top-left once mirrored for player 2), moved by the
// original idle frame's float offset so the loop still bobs. Every other anim / frame — and every
// P1 draw — is the original art, so only P2's idle is relit (A1 has no relit poses yet).
//
// litBias(): a small pixel metric for "which side is the key light on", in SCREEN space (after
// the optional mirror), measured inside the figure (used by the relight preview and
// tests/art/relight-shim.test.ts). > 0 = lit from the screen left.
//
// Pure (no Phaser): safe in vitest.

import { monsterArt } from '../art/monsters';
import { PAL } from '../art/palette';
import { PixelCanvas } from '../art/pixel';
import type { DrawOpts, MonsterAnim, MonsterArt } from '../art/types';
import { drawMagus } from '../still/magus';

const BASE = monsterArt('abyss_magus');

/** The still frame (facing right, lit from the frame's top-right), drawn once. */
let still: PixelCanvas | null = null;
function stillFrame(): PixelCanvas {
  if (!still) {
    still = new PixelCanvas(BASE.w, BASE.h);
    drawMagus(still);
  }
  return still;
}

function originalFrame(anim: MonsterAnim, f: number): PixelCanvas {
  const p = new PixelCanvas(BASE.w, BASE.h);
  BASE.draw(p, anim, f);
  return p;
}

/** Overlap of two alpha masks with `b` moved by dy (pixels opaque in both). */
function overlap(a: PixelCanvas, b: PixelCanvas, dy: number): number {
  let n = 0;
  for (let y = 0; y < a.h; y++) {
    const yb = y - dy;
    if (yb < 0 || yb >= b.h) continue;
    for (let x = 0; x < a.w; x++) if (a.isOpaque(x, y) && b.isOpaque(x, yb)) n++;
  }
  return n;
}

/**
 * Vertical float offset of the original idle frame `f` against idle 0 (the dy in −4…4 whose
 * moved idle-0 mask best overlaps frame f). For abyss_magus this is its idle `bob`.
 */
const bobCache = new Map<number, number>();
export function idleBob(f: number): number {
  let dy = bobCache.get(f);
  if (dy === undefined) {
    const f0 = originalFrame('idle', 0);
    const fi = originalFrame('idle', f);
    let best = -1;
    dy = 0;
    for (let d = -4; d <= 4; d++) {
      const n = overlap(fi, f0, d);
      if (n > best || (n === best && Math.abs(d) < Math.abs(dy))) {
        best = n;
        dy = d;
      }
    }
    bobCache.set(f, dy);
  }
  return dy;
}

/** The test-only relit magus (see the header). Same id, size, anchor and anims as the original. */
export function relightShimArt(): MonsterArt {
  return {
    ...BASE,
    p2: 'relight',
    draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) {
      if (o?.lightFrom === 'right' && anim === 'idle') {
        p.blit(stillFrame(), 0, idleBob(frame));
        return;
      }
      BASE.draw(p, anim, frame);
    },
  };
}

// ---------------------------------------------------------------- light-side metric

function lum(c: number): number {
  return ((c >> 16) & 255) * 0.299 + ((c >> 8) & 255) * 0.587 + (c & 255) * 0.114;
}

/**
 * Screen-space side of the key light of a frame, measured INSIDE the figure (2 px in from the
 * silhouette, so the 1 px ink outline and the back-light rims — e.g. abyss_magus' void3 rim on
 * its frame-right edges — do not count):
 *  - bias: mean over horizontal interior runs (>= 4 px) of luminance(leftmost) − luminance(rightmost)
 *  - mass: geometric centre x − luminance-weighted centre x of the interior (px)
 * Both > 0 = brighter toward the screen left. `mirror` = shown with flipX (player 2).
 */
export function litBias(p: PixelCanvas, mirror = false): { bias: number; mass: number } {
  const solid = (x: number, y: number) => {
    const c = p.get(x, y);
    return c !== null && c !== PAL.ink;
  };
  const inner = (x: number, y: number) => {
    for (let d = -2; d <= 2; d++) if (!solid(x + d, y) || !solid(x, y + d)) return false;
    return true;
  };
  let runs = 0;
  let sum = 0;
  let n = 0;
  let sx = 0;
  let sl = 0;
  let sxl = 0;
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; ) {
      if (!inner(x, y)) {
        x++;
        continue;
      }
      const x0 = x;
      while (x < p.w && inner(x, y)) {
        const L = lum(p.get(x, y)!);
        sx += x;
        sl += L;
        sxl += x * L;
        n++;
        x++;
      }
      if (x - 1 - x0 >= 3) {
        sum += lum(p.get(x0, y)!) - lum(p.get(x - 1, y)!);
        runs++;
      }
    }
  }
  const bias = runs ? sum / runs : 0;
  const mass = n && sl ? sx / n - sxl / sl : 0;
  const k = mirror ? -1 : 1;
  return { bias: +(k * bias).toFixed(2), mass: +(k * mass).toFixed(2) };
}
