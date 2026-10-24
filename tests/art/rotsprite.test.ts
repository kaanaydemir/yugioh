// RotSprite (src/art/rotsprite.ts): Scale2x choices, the lazy 8× up-scale, turned index maps — 0° is
// the source pixel for pixel, quarter turns are exact, no new colour ever appears, 1-px lines stay
// 1-px lines, the silhouette keeps its area — and the edge-band decisions that keep 1-px glyphs whole.

import { describe, expect, it } from 'vitest';
import { PixelCanvas } from '../../src/art/pixel';
import { INTERIOR, colorsOf, edgeDecisions, nearest8, paintMap, quantizeDeg, rotMap, rotSprite, scale2x, upscale8, type UpScaled } from '../../src/art/rotsprite';

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
    // half degrees (the hand's grid)
    expect([1.43, -1.43, 4.3, -4.3, 5.73, 0.2].map((d) => quantizeDeg(d, 0.5))).toEqual([1.5, -1.5, 4.5, -4.5, 5.5, 0]);
  });
});

// ---------------------------------------------------------------- the fast paths, against the plain algorithm

/** One Scale2x pass the plain way: every quadrant through the full rule (outside the canvas = empty). */
function plainPass(c: Int32Array, i: Int32Array, cw: number, ch: number): { col: Int32Array; idx: Int32Array } {
  const W2 = cw * 2;
  const oc = new Int32Array(W2 * ch * 2);
  const oi = new Int32Array(W2 * ch * 2);
  for (let y = 0; y < ch; y++)
    for (let x = 0; x < cw; x++) {
      const at = (xx: number, yy: number) => (xx < 0 || yy < 0 || xx >= cw || yy >= ch ? -1 : yy * cw + xx);
      const P = y * cw + x;
      const A = at(x, y - 1);
      const D = at(x, y + 1);
      const C = at(x - 1, y);
      const B = at(x + 1, y);
      const v = (r: number) => (r < 0 ? -1 : c[r]);
      const pick = [
        v(C) === v(A) && v(C) !== v(D) && v(A) !== v(B) ? A : P,
        v(A) === v(B) && v(A) !== v(C) && v(B) !== v(D) ? B : P,
        v(D) === v(C) && v(D) !== v(B) && v(C) !== v(A) ? C : P,
        v(B) === v(D) && v(B) !== v(A) && v(D) !== v(C) ? D : P,
      ];
      pick.forEach((r, q) => {
        const o = y * 2 * W2 + x * 2 + (q & 1) + (q >> 1) * W2;
        oc[o] = v(r);
        oi[o] = v(r) < 0 ? -1 : i[r];
      });
    }
  return { col: oc, idx: oi };
}

/** Scale2x ×3 the plain way, nothing lazy or skipped: the source index at each 8× pixel. */
function plainUp8(col: Int32Array, w: number, h: number): (bx: number, by: number) => number {
  let c: Int32Array = Int32Array.from(col);
  let i: Int32Array = Int32Array.from(col, (v, k) => (v < 0 ? -1 : k));
  let cw = w;
  let ch = h;
  for (let pass = 0; pass < 3; pass++) {
    ({ col: c, idx: i } = plainPass(c, i, cw, ch));
    cw *= 2;
    ch *= 2;
  }
  return (bx, by) => (bx < 0 || by < 0 || bx >= cw || by >= ch ? -1 : i[by * cw + bx]);
}

describe('rotsprite — the fast paths are the plain algorithm', () => {
  const sources = (): [Int32Array, number, number][] => {
    let s = 4242;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const out: [Int32Array, number, number][] = [];
    for (let t = 0; t < 12; t++) {
      const w = 1 + Math.floor(rnd() * 14);
      const h = 1 + Math.floor(rnd() * 14);
      out.push([Int32Array.from({ length: w * h }, () => (rnd() < 0.3 ? -1 : [0x10, 0x20, 0x30][Math.floor(rnd() * 3)])), w, h]);
    }
    const card = cardLike(30, 40);
    out.push([colorsOf(card), 30, 40], [edgeDecisions(colorsOf(card), 30, 40, 2), 30, 40]);
    return out;
  };

  it('upscale8 (inlined passes, 16-bit 4× level, the last pass read on demand) = three plain Scale2x passes', () => {
    for (const [col, w, h] of sources()) {
      const up = upscale8(col, w, h);
      const ref = plainUp8(col, w, h);
      for (let by = -2; by <= up.h + 1; by++) for (let bx = -2; bx <= up.w + 1; bx++) if (up.at(bx, by) !== ref(bx, by)) expect(up.at(bx, by), `${w}x${h} ${bx},${by}`).toBe(ref(bx, by));
      // scale2x itself (the A == D / B == C shortcut, inlined rules), against one plain pass
      const idx = Int32Array.from(col, (v, k) => (v < 0 ? -1 : k));
      const one = scale2x(col, idx, w, h);
      const plain = plainPass(col, idx, w, h);
      expect([...one.col]).toEqual([...plain.col]);
      expect([...one.idx]).toEqual([...plain.idx]);
    }
  });

  it("rotMap's flat shortcut (3 × 3 of one decision colour read from the source grid) changes no sample", () => {
    for (const [col, w, h] of sources()) {
      const up = upscale8(col, w, h);
      const slow: UpScaled = { sw: up.sw, sh: up.sh, w: up.w, h: up.h, at: (x, y) => up.at(x, y) };
      for (const deg of [-17, -6.5, -1.5, 1, 2.5, 4.5, 30, 90])
        for (const shift of [[0, 0], [0.3, -0.4]] as const) {
          const a = rotMap(up, deg, [w / 2, h / 2], shift);
          const b = rotMap(slow, deg, [w / 2, h / 2], shift);
          expect([...a.idx]).toEqual([...b.idx]);
        }
    }
  });

  it('nearest8 turns plain nearest: every output pixel shows the source pixel under its centre, nothing else', () => {
    const card = cardLike(30, 40);
    const col = colorsOf(card);
    const up = nearest8(col, 30, 40);
    for (const deg of [-5, 3.5, 12]) {
      const m = rotMap(up, deg, [15, 20]);
      const r = (deg * Math.PI) / 180;
      for (let j = 0; j < m.h; j++)
        for (let i = 0; i < m.w; i++) {
          const dx = i + 0.5 - m.px;
          const dy = j + 0.5 - m.py;
          const x = Math.floor(15 + dx * Math.cos(r) + dy * Math.sin(r));
          const y = Math.floor(20 - dx * Math.sin(r) + dy * Math.cos(r));
          const want = x < 0 || y < 0 || x >= 30 || y >= 40 || col[y * 30 + x] < 0 ? -1 : y * 30 + x;
          expect(m.idx[j * m.w + i], `${deg}° ${i},${j}`).toBe(want);
        }
    }
  });
});
