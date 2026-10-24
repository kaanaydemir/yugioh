// RotSprite (src/art/rotsprite.ts): Scale2x choices, the lazy 8× up-scale, turned index maps — 0° is
// the source pixel for pixel, quarter turns are exact, no new colour ever appears, 1-px lines stay
// 1-px lines, the silhouette keeps its area — and the edge-band decisions that keep 1-px glyphs whole.

import { describe, expect, it } from 'vitest';
import { PixelCanvas } from '../../src/art/pixel';
import { INTERIOR, colorsOf, edgeDecisions, paintMap, quantizeDeg, rotMap, rotSprite, scale2x, upscale8 } from '../../src/art/rotsprite';

const X = 0xd8a040;
const Y = 0x203048;
const Z = 0x60c0e0;

/** A canvas from rows of characters: '.' empty, X / Y / Z the three test colours. */
function grid(rows: string[]): PixelCanvas {
  const p = new PixelCanvas(rows[0].length, rows.length);
  const key: Record<string, number> = { X, Y, Z };
  rows.forEach((r, y) => [...r].forEach((ch, x) => ch !== '.' && p.set(x, y, key[ch])));
  return p;
}

/** A deterministic card-like canvas: a 1-px outline, a lit band, noisy art and a digit row. */
function cardLike(w = 30, h = 40): PixelCanvas {
  const p = new PixelCanvas(w, h);
  let s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      p.set(x, y, edge ? Y : x === 1 || y === 1 ? X : [X, Y, Z][Math.floor(rnd() * 3)]);
    }
  return p;
}

const colourSet = (p: PixelCanvas): Set<number> => {
  const s = new Set<number>();
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const c = p.get(x, y);
    if (c !== null) s.add(c);
  }
  return s;
};

const opaque = (p: PixelCanvas): number => {
  let n = 0;
  for (let i = 3; i < p.data.length; i += 4) if (p.data[i]) n++;
  return n;
};

describe('rotsprite — Scale2x', () => {
  it('a lone pixel becomes a 2×2 block; a diagonal stays connected; an L corner is bevelled', () => {
    const lone = colorsOf(grid(['...', '.X.', '...']));
    const one = scale2x(lone, Int32Array.from(lone, (c, i) => (c < 0 ? -1 : i)), 3, 3);
    const at = (r: { col: Int32Array }, w: number, x: number, y: number) => r.col[y * w + x];
    for (const [x, y] of [[2, 2], [3, 2], [2, 3], [3, 3]]) expect(at(one, 6, x, y)).toBe(X);
    expect([...one.col].filter((c) => c === X).length).toBe(4);
    // a 2-px diagonal: the empty pixels beside it take its colour in the quarters that join it
    const diag = colorsOf(grid(['X.', '.X']));
    const two = scale2x(diag, Int32Array.from(diag, (c, i) => (c < 0 ? -1 : i)), 2, 2);
    expect(at(two, 4, 2, 1)).toBe(X); // bottom-left quarter of the empty (1, 0)
    expect(at(two, 4, 1, 2)).toBe(X); // top-right quarter of the empty (0, 1)
    // the index travels with the colour: those quarters show source pixel 0 and 3
    expect([two.idx[1 * 4 + 2], two.idx[2 * 4 + 1]].sort()).toEqual([0, 3]);
    // an L: the inner corner fills, the outer corner is cut
    const l = colorsOf(grid(['XX', 'X.']));
    const three = scale2x(l, Int32Array.from(l, (c, i) => (c < 0 ? -1 : i)), 2, 2);
    expect(at(three, 4, 2, 2)).toBe(X); // the empty corner's top-left quarter fills (inner corner)
    expect(at(three, 4, 0, 0)).toBe(-1); // the outer corner's top-left quarter is cut (the bevel)
    expect([at(three, 4, 1, 0), at(three, 4, 0, 1), at(three, 4, 1, 1)]).toEqual([X, X, X]);
  });
});

describe('rotsprite — turning', () => {
  it('0° gives the source pixel for pixel (shifted onto the 1-px margin)', () => {
    for (const src of [cardLike(), cardLike(17, 9), grid(['X.Z', '.Y.', 'Z.X'])]) {
      const r = rotSprite(src, 0);
      expect(r.px.w).toBe(src.w + 4);
      expect(r.px.h).toBe(src.h + 4);
      for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) expect(r.px.get(x + 2, y + 2)).toBe(src.get(x, y));
      expect(opaque(r.px)).toBe(opaque(src));
    }
  });

  it('quarter turns are exact rotations', () => {
    const src = cardLike(12, 20);
    const r90 = rotSprite(src, 90);
    const r180 = rotSprite(src, 180);
    expect(opaque(r90.px)).toBe(opaque(src));
    // (x, y) → 90° clockwise about the centre: the source's left column becomes the top row
    const b90 = r90.px.bounds()!;
    expect([b90.w, b90.h]).toEqual([src.h, src.w]);
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) expect(r90.px.get(b90.x + (src.h - 1 - y), b90.y + x)).toBe(src.get(x, y));
    const b180 = r180.px.bounds()!;
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) expect(r180.px.get(b180.x + src.w - 1 - x, b180.y + src.h - 1 - y)).toBe(src.get(x, y));
  });

  it('never makes a colour: every output pixel is a source pixel', () => {
    const src = cardLike();
    const pal = colourSet(src);
    for (const a of [-7, -3, 1, 2, 4.5, 6, 13, 33]) for (const c of colourSet(rotSprite(src, a).px)) expect(pal.has(c), `${a}°`).toBe(true);
  });

  it('keeps 1-px lines as 1-px lines (one pixel per column, no gap) and the area within 3 %', () => {
    const line = new PixelCanvas(41, 3);
    for (let x = 0; x < 41; x++) line.set(x, 1, X);
    for (const a of [1, 2, 3, 5, 8, -4]) {
      const r = rotSprite(line, a).px;
      const b = r.bounds()!;
      for (let x = b.x; x < b.x + b.w; x++) {
        let n = 0;
        for (let y = 0; y < r.h; y++) if (r.get(x, y) !== null) n++;
        expect(n, `${a}° column ${x}`).toBe(1);
      }
    }
    const solid = cardLike(30, 40);
    for (const a of [1, 3, 6, -5, 17]) {
      const n = opaque(rotSprite(solid, a).px);
      expect(Math.abs(n - 1200) / 1200, `${a}°`).toBeLessThan(0.03);
    }
  });

  it('turns about the pivot: it lands on (x, y) and positive angles turn clockwise', () => {
    // a 1-px marker right of the centre moves down (screen y) when turned clockwise
    const p = new PixelCanvas(21, 21);
    for (let x = 10; x < 21; x++) p.set(x, 10, X);
    const r = rotSprite(p, 30);
    let sy = 0;
    let n = 0;
    for (let y = 0; y < r.px.h; y++) for (let x = Math.ceil(r.x) + 6; x < r.px.w; x++) if (r.px.get(x, y) !== null) {
      sy += y;
      n++;
    }
    expect(n).toBeGreaterThan(0);
    expect(sy / n).toBeGreaterThan(r.y);
    expect(Number.isInteger(r.x - 10.5)).toBe(true);
  });

  it('is deterministic, and one map recolours without a second turn (index maps)', () => {
    const src = cardLike();
    expect(rotSprite(src, 3).px.data).toEqual(rotSprite(src, 3).px.data);
    const col = colorsOf(src);
    const m = rotMap(upscale8(col, src.w, src.h), 4, [src.w / 2, src.h / 2]);
    const a = paintMap(m, (i) => (col[i] < 0 ? null : col[i]));
    const b = paintMap(m, (i) => (col[i] < 0 ? null : col[i] === X ? Z : col[i]));
    let changed = 0;
    for (let k = 0; k < m.idx.length; k++) if (m.idx[k] >= 0 && col[m.idx[k]] === X) changed++;
    let diff = 0;
    for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) diff++;
    expect(diff).toBe(changed);
    expect(changed).toBeGreaterThan(0);
  });
});

describe('rotsprite — edge-band decisions', () => {
  it('keeps the outer band, collapses the inside to one stand-in, leaves the empty empty', () => {
    const src = cardLike(10, 12);
    const col = colorsOf(src);
    const dec = edgeDecisions(col, 10, 12, 2);
    for (let y = 0; y < 12; y++)
      for (let x = 0; x < 10; x++) {
        const d = Math.min(x + 1, y + 1, 10 - x, 12 - y); // steps to the outside
        expect(dec[y * 10 + x], `${x},${y}`).toBe(d <= 2 ? col[y * 10 + x] : INTERIOR);
      }
    // a hole counts as outside too
    const holed = grid(['XXXXXXX', 'XXXXXXX', 'XXX.XXX', 'XXXXXXX', 'XXXXXXX']);
    const hd = edgeDecisions(colorsOf(holed), 7, 5, 1);
    expect(hd[1 * 7 + 3]).toBe(X); // next to the hole
    expect(hd[2 * 7 + 3]).toBe(-1);
    expect(hd[2 * 7 + 1]).toBe(INTERIOR);
  });

  it('a 1-px glyph inside the band-only decisions survives a small turn whole', () => {
    // a "0" digit (3 × 5, square corners) in the middle of a card: band decisions sample it plain nearest
    const p = new PixelCanvas(31, 41);
    p.rect(0, 0, 31, 41, Y);
    for (const [x, y] of [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2], [0, 3], [2, 3], [0, 4], [1, 4], [2, 4]]) p.set(14 + x, 18 + y, X);
    const W = p.w;
    const col = colorsOf(p);
    for (const a of [1, 2, 3]) {
      const m = rotMap(upscale8(edgeDecisions(col, W, p.h, 2), W, p.h), a, [W / 2, p.h / 2]);
      const out = paintMap(m, (i) => col[i]);
      let n = 0;
      for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) if (out.get(x, y) === X) n++;
      expect(n, `${a}°`).toBe(12);
    }
  });

  it('quantizeDeg snaps to whole steps (no −0)', () => {
    expect([2.86, -2.86, 0.4, -0.4, 6.3, 1.5].map((d) => quantizeDeg(d))).toEqual([3, -3, 0, 0, 6, 2]);
    expect(Object.is(quantizeDeg(-0.2), 0)).toBe(true);
    expect(quantizeDeg(4.2, 1.5)).toBe(4.5);
  });
});
