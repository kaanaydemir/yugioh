// A4.1 part 2 — rigkit/passes/foam: the water death 'foam' and its revive 'surge' (first user Mercan
// Yılanı, next Gelgit Golemi). A water line runs down the frame: pure, monotone for a body that stays put
// (wave phase held), the melted top a flat crest (white over water4, never a lone speckle), the parts
// that do not melt untouched, erased px released from their part, surge(t) = foam(1 − t).

import { describe, expect, it } from 'vitest';
import { PAL } from '../../src/art/palette';
import { PixelCanvas } from '../../src/art/pixel';
import { PartComp } from '../../src/art/rigkit/composite';
import { foamLevel, foamPass, surgePass, type FoamOpts } from '../../src/art/rigkit/passes/foam';

const W = 48;
const H = 40;
const BODY = 1;
const STONE = 2;

/** A water body (part 1: an ellipse, water2) with a stone block (part 2, stone3) on its top. */
function scene(): PartComp {
  const f = new PartComp(new PixelCanvas(W, H));
  const body = new PixelCanvas(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (((x - 24) / 20) ** 2 + ((y - 24) / 12) ** 2 <= 1) body.set(x, y, PAL.water2);
  f.add(body, BODY);
  const stone = new PixelCanvas(W, H);
  for (let y = 9; y < 14; y++) for (let x = 20; x < 27; x++) stone.set(x, y, PAL.stone3);
  f.add(stone, STONE);
  return f;
}

const opts = (t: number): FoamOpts => ({
  t,
  top: 10,
  floor: 36,
  style: { crest: [PAL.white, PAL.water4], drip: PAL.water3, broken: 0.3 },
  keep: (part) => part === STONE,
  wave: { amp: 1.6, len: 21, phase: 0.2 },
  drips: { share: 0.16, len: 4 },
  seed: 17,
});

function run(t: number, surge = false): PartComp {
  const f = scene();
  (surge ? surgePass : foamPass)(f, opts(t));
  return f;
}

const samePx = (a: PixelCanvas, b: PixelCanvas) => a.data.length === b.data.length && a.data.every((v, i) => v === b.data[i]);
const T = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

describe('rigkit passes/foam (the water death) and surge (its revive)', () => {
  it('t = 0 changes nothing; the same progress gives the same frame', () => {
    const f = scene();
    expect(foamPass(f, opts(0))).toEqual({ gone: 0, crest: 0 });
    expect(samePx(f.p, scene().p)).toBe(true);
    expect(samePx(run(0.45).p, run(0.45).p)).toBe(true);
  });

  it('the line only runs down: a px gone at t stays gone later, and an erased px leaves its part', () => {
    let prev = run(T[0]);
    for (const t of T.slice(1)) {
      const f = run(t);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          if (f.p.isOpaque(x, y)) expect(prev.p.isOpaque(x, y), `t ${t} (${x},${y}) came back`).toBe(true);
          else expect(f.id[y * W + x], `t ${t} (${x},${y})`).toBe(0);
        }
      prev = f;
    }
    // at t = 1 the body is gone down to the floor's lumps
    const end = run(1);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (end.id[y * W + x] === BODY) expect(y, `(${x},${y})`).toBeGreaterThanOrEqual(foamLevel(opts(1), x));
  });

  it('the melted top foams: white over water4 (flat crest rows, never a lone speckle), the kept stone untouched', () => {
    for (const t of T) {
      const f = scene();
      const r = foamPass(f, opts(t));
      const ref = scene();
      let white = 0;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const c = f.p.get(x, y);
          if (ref.id[y * W + x] === STONE) {
            expect(c, `t ${t} stone (${x},${y})`).toBe(PAL.stone3);
            continue;
          }
          if (c !== PAL.white) continue;
          white++;
          // a crest top sits on its under tone, and its row is the water line there
          if (f.id[(y + 1) * W + x] === BODY) expect(f.p.get(x, y + 1), `t ${t} (${x},${y + 1})`).toBe(PAL.water4);
          expect(y, `t ${t} (${x},${y})`).toBeGreaterThanOrEqual(foamLevel(opts(t), x));
          // flat bands: a white px always has foam (white / water4) beside it on its row or the next
          const foamy = (xx: number, yy: number) => f.p.get(xx, yy) === PAL.white || f.p.get(xx, yy) === PAL.water4;
          expect(foamy(x - 1, y) || foamy(x + 1, y) || foamy(x, y + 1), `t ${t} lone white (${x},${y})`).toBe(true);
        }
      // mid-melt the line cuts the body where it is thick: it foams (a 1-px sliver left at the end takes the under tone)
      if (t >= 0.3 && t <= 0.8) expect(white, `t ${t}`).toBeGreaterThan(0);
      expect(r.crest >= white, `t ${t}`).toBe(true);
    }
    expect(foamPass(scene(), opts(0.5)).gone).toBeGreaterThan(0);
  });

  it('surge(t) is foam(1 − t): the revive runs the same line back up', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) expect(samePx(run(t, true).p, run(1 - t).p), `t ${t}`).toBe(true);
  });
});
