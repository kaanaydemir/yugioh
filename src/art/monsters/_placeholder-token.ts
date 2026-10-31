// Placeholder art for the Saman Korkuluk token (straw_decoy_token, docs/v3/YENI_KARTLAR.md S9): a small straw
// scarecrow on a stake — burlap sack head with stitched eyes, a cross bar with straw tufts at the hands, a straw
// skirt. Used only while the token has no art of its own (src/art/monsters/index.ts asks the real registries
// first). Palette only (earth + gold ramps), 1-px ink outline, whole pixels. 48 px frame.
//   idle: the straw sways and a tuft lifts; roar: shakes; attack: a lean; hit: a white frame; guard: sags.

import { PAL, RAMPS } from '../palette';
import { PixelCanvas } from '../pixel';
import { CARD_ART_H, CARD_ART_W, type MonsterAnim, type MonsterArt } from '../types';

const F = 48;
const CX = 24;
const BASE = 42;
const E = RAMPS.earth;
const G = RAMPS.gold;

interface Pose {
  lean: number; // px the head / bar shift sideways
  sway: number; // straw tufts sway
  dy: number;
  sag: number;
  flash?: boolean;
}

function paint(p: PixelCanvas, q: Pose): void {
  const t = (c: number) => (q.flash ? PAL.white : c);
  const top = BASE - 30 + q.dy + q.sag;
  // stake
  p.rect(CX - 1, top + 6, 3, BASE - top - 6, t(E[1]));
  p.vline(CX - 1, top + 6, BASE - 1, t(E[2]));
  // ground tuft
  p.ellipse(CX, BASE, 6, 2, t(G[1]));
  // cross bar (arms) with straw hands
  const by = top + 11;
  const bx = CX + q.lean;
  p.rect(bx - 13, by, 27, 2, t(E[2]));
  p.hline(bx - 13, bx + 13, by, t(E[3]));
  for (const s of [-1, 1]) {
    const hx = bx + s * 14;
    p.line(hx, by, hx + s * 2, by - 2 + q.sway, t(G[3]));
    p.line(hx, by + 1, hx + s * 3, by + 2 + q.sway, t(G[2]));
    p.line(hx, by + 1, hx + s * 2, by + 4, t(G[3]));
  }
  // straw body (a tied bundle) + skirt
  p.poly([[bx - 5, by + 2], [bx + 5, by + 2], [bx + 7 + q.sway, by + 15], [bx - 7 + q.sway, by + 15]], t(G[2]));
  for (let x = bx - 4; x <= bx + 4; x += 2) p.line(x, by + 3, x + q.sway + (x < bx ? -1 : 1), by + 14, t(G[3]));
  p.hline(bx - 5, bx + 5, by + 6, t(E[1])); // the twine
  p.set(bx + 4, by + 3, t(G[4]));
  // head: burlap sack
  const hy = top + 1;
  const hx = bx + Math.sign(q.lean);
  p.ellipse(hx, hy + 4, 5, 5, t(E[3]));
  p.ellipse(hx - 1, hy + 3, 3, 3, t(E[4]));
  p.hline(hx - 3, hx + 3, hy + 9, t(E[1])); // neck tie
  // stitched eyes (facing right) + a mouth seam
  p.set(hx + 1, hy + 3, t(PAL.ink));
  p.set(hx + 3, hy + 3, t(PAL.ink));
  p.hline(hx, hx + 3, hy + 6, t(E[1]));
  // a straw tuft on top
  p.line(hx - 1, hy - 1, hx - 2 + q.sway, hy - 4, t(G[3]));
  p.line(hx + 1, hy - 1, hx + 2 + q.sway, hy - 3, t(G[4]));
  p.outline(PAL.ink);
}

function pose(anim: MonsterAnim, f: number): Pose {
  switch (anim) {
    case 'idle':
      return { lean: 0, sway: [0, 1, 0, -1][f] ?? 0, dy: 0, sag: 0 };
    case 'roar':
      return { lean: [0, 1, -1, 0][f] ?? 0, sway: [1, -1, 1, 0][f] ?? 0, dy: [0, -1, -1, 0][f] ?? 0, sag: 0 };
    case 'attack':
      return { lean: [-1, -2, 3, 1][f] ?? 0, sway: [0, -1, 1, 0][f] ?? 0, dy: 0, sag: 0 };
    case 'hit':
      return { lean: [-2, -1][f] ?? 0, sway: -1, dy: 0, sag: 0, flash: f === 0 };
    case 'guard':
      return { lean: 0, sway: 0, dy: 0, sag: [2, 3][f] ?? 2 };
  }
}

let cached: MonsterArt | null = null;

/** The straw scarecrow placeholder art (cached). */
export function placeholderToken(): MonsterArt {
  if (cached) return cached;
  cached = {
    id: 'straw_decoy_token',
    w: F,
    h: F,
    anchorX: CX,
    anchorY: BASE,
    hover: 0,
    muzzle: { x: CX + 16, y: BASE - 18 },
    core: { x: CX, y: BASE - 14 },
    anims: {
      idle: { frames: 4, fps: 4, loop: true },
      roar: { frames: 4, fps: 8, loop: false },
      attack: { frames: 4, fps: 10, loop: false },
      hit: { frames: 2, fps: 8, loop: false },
      guard: { frames: 2, fps: 3, loop: true },
    },
    attackImpactFrame: 2,
    draw(p: PixelCanvas, anim: MonsterAnim, frame: number) {
      paint(p, pose(anim, frame));
    },
    portrait(p: PixelCanvas) {
      // dusk field: earth bands, a gold horizon, the scarecrow centred
      for (let y = 0; y < CARD_ART_H; y++) p.hline(0, CARD_ART_W - 1, y, y < 20 ? (y < 8 ? E[0] : y < 15 ? E[1] : G[1]) : y % 3 ? G[1] : G[0]);
      p.hline(0, CARD_ART_W - 1, 20, G[3]);
      const s = new PixelCanvas(F, F);
      paint(s, pose('idle', 0));
      p.blit(s.crop(8, 8, 32, 34), 6, 0);
    },
  };
  return cached;
}
