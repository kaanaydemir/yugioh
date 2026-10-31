// Boşluk Gözü (void_eye) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
// "Bulutların arasından aşağı bakan dev göz, göz bebeğine doğru süzülen minik canavar silüetleri" (YENI_KARTLAR §7
// S3) — the image of the scene (src/cinematics/spells/void_eye.ts): the same vertical almond eye that tears the sky
// open, its iris turned DOWN, between two banks of night cloud; three tiny monster silhouettes float up toward the
// pupil on trails of violet motes.
//   backdrop  the kit's SPELL recipe (night0 / night1 sky, the teal portal ring framing the eye: the spell cue);
//             no floor (a sky picture).
//   subject   matter, ink outlined, ONE key light from the top left: the cloud banks (night3 lit tops, night2 bodies,
//             night1 shade bands), the lids (mist lip | night4 on the lit left, night2 on the right), the sclera
//             (void0) and the iris rings (void1 limbal ring, void2 / void3 spokes), the silhouettes (night0 bodies
//             with a void3 rim on their shadow side).
//   light     the pupil's starry black with its stars, the bright pupil ring (void4), the white catch-light (the
//             single brightest point = the focus), the mote trails.
// The small picture (44×34) is the same composition painted again at 1× density by the same code (eye 13×21,
// iris r 4, two silhouettes) — not a reduction — and corrected by hand (the pupil and the catch-light patched so
// they read at 1×).
// Living art: 4 frames × 150 ms — the pupil's stars twinkle, the iris spokes turn one step, the silhouettes bob
// 1 px up (≤ 2 px motion), the mote trails step toward the pupil.

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import { ink, paintBackdrop, patch, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type XY = readonly [number, number];
const FRAMES = 4;

interface Geo {
  k: 1 | 2;
  eye: XY;
  eh: number;
  ew: number;
  iris: number;
  pupil: number;
  /** the iris looks down by this much */
  look: number;
  /** cloud puffs: [cx, cy, r] (their union is the bank) */
  clouds: readonly (readonly [number, number, number])[];
  /** silhouettes: stamp index, top-left */
  sil: readonly (readonly [number, number, number])[];
}

const BIG: Geo = {
  k: 2,
  eye: [44, 23],
  eh: 20,
  ew: 12,
  iris: 9,
  pupil: 4,
  look: 3,
  clouds: [
    [10, 62, 9],
    [21, 57, 8],
    [31, 64, 7],
    [57, 63, 7],
    [67, 56, 9],
    [79, 61, 8],
  ],
  sil: [
    [0, 6, 38],
    [1, 66, 32],
    [2, 22, 25],
  ],
};

const SMALL: Geo = {
  k: 1,
  eye: [22, 12],
  eh: 10,
  ew: 6,
  iris: 4,
  pupil: 2,
  look: 1,
  clouds: [
    [5, 31, 5],
    [11, 29, 4],
    [16, 33, 4],
    [29, 32, 4],
    [34, 28, 5],
    [40, 31, 4],
  ],
  sil: [
    [3, 5, 19],
    [4, 34, 16],
  ],
};

// silhouettes ('#' body); big: a wolf, a winged drake, a robed figure; small: 3-px beasts
// prettier-ignore
const SILS: readonly (readonly string[])[] = [
  ['..........#.', '.........###', '#..#######..', '.#########..', '..########..', '..##....##..', '..#......#..'],
  ['#.........#', '##...#...##', '.###.#.###.', '..#######..', '....###....', '.....#.....'],
  ['.###.', '.###.', '..#..', '#####', '.###.', '.###.', '.#.#.'],
  ['...#', '####', '####', '#..#'],
  ['##.##', '.###.', '..#..'],
];

function paintClouds(p: PixelCanvas, g: Geo): void {
  const inside = (x: number, y: number) => g.clouds.some(([cx, cy, r]) => (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r + r);
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (!inside(x, y)) continue;
      // lit top band (k px), a lit left lip on each puff, the body, a shade band low on the puff
      let c: number = PAL.night2;
      if (!inside(x, y - g.k)) c = PAL.night3;
      else if (!inside(x - g.k, y - g.k) && !inside(x, y - 2 * g.k)) c = PAL.night3;
      else if (!inside(x, y + 3 * g.k) || g.clouds.every(([cx, cy, r]) => (x - cx) * (x - cx) + (y - cy) * (y - cy) > r * r * 0.35 || y < cy)) {
        if (g.clouds.some(([cx, cy, r]) => y > cy + r * 0.35 && (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r + r)) c = PAL.night1;
      }
      p.set(x, y, c);
    }
}

function paintEye(subject: PixelCanvas, light: PixelCanvas, g: Geo, f: number): void {
  const [cx, cy] = g.eye;
  const iy = g.look;
  for (let dy = -g.eh; dy <= g.eh; dy++) {
    const fr = 1 - (dy / g.eh) * (dy / g.eh);
    const hw = Math.floor(g.ew * fr);
    for (let dx = -hw - 2; dx <= hw + 2; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      const a = Math.abs(dx);
      if (a > hw) {
        if (hw < 1 && a > 1) continue;
        const kk = a - hw;
        subject.set(x, y, dx < 0 ? (kk === 1 ? PAL.mist : PAL.night4) : kk === 1 ? PAL.night4 : PAL.night2);
        continue;
      }
      const ux = dx;
      const uy = dy - iy;
      const d = Math.sqrt(ux * ux + uy * uy);
      let c: number = PAL.void0;
      if (d <= g.pupil + 0.5) {
        light.set(x, y, PAL.ink);
        continue;
      }
      if (d <= g.pupil + 1.4) {
        light.set(x, y, PAL.void4);
        continue;
      }
      if (d <= g.iris - 2.2) c = PAL.void2;
      else if (d <= g.iris - 0.8) {
        const ang = Math.atan2(uy, ux);
        c = g.k === 1 ? PAL.void3 : (Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 12) + f) % 2 === 0 ? PAL.void3 : PAL.void2;
      } else if (d <= g.iris + 0.5) c = PAL.void1;
      if (a >= hw && d > g.iris + 0.5) c = dx > 0 ? PAL.ink : PAL.void1;
      subject.set(x, y, c);
    }
  }
  // the pupil's stars and the catch-light (light layer)
  const [px, py] = [cx, cy + iy];
  if (g.k === 2) {
    const stars: XY[] = [
      [-2, -1],
      [1, -2],
      [2, 1],
      [-1, 2],
    ];
    stars.forEach(([sx, sy], i) => light.set(px + sx, py + sy, (i + f) % 4 === 0 ? PAL.white : PAL.void3));
    light.set(px - 3, py - 3, PAL.white);
    light.set(px - 4, py - 3, PAL.white);
    light.set(px - 3, py - 4, PAL.white);
  } else {
    // hand-made at 1×: a 3×3 pupil with one twinkling star, the catch-light one pixel up-left
    patch(light, ['.k.', 'kvk', '.k.'], { k: PAL.ink, v: f % 2 ? PAL.void3 : PAL.ink }, px - 1, py - 1);
    light.set(px - 2, py - 2, PAL.white);
  }
}

function paint(l: ArtLayers, f: number, g: Geo): void {
  paintBackdrop(l.backdrop, 'SPELL', { focus: [BIG.eye[0], BIG.eye[1] + BIG.look], radius: 24, horizon: 999 });
  paintClouds(l.subject, g);
  const bob = f === 1 || f === 2 ? 1 : 0;
  g.sil.forEach(([i, x, y], n) => {
    const rows = SILS[i];
    const yy = y - ((bob + n) % 2);
    rows.forEach((r, ry) => [...r].forEach((ch, rx) => ch === '#' && l.subject.set(x + rx, yy + ry, PAL.void0)));
  });
  rim(l.subject, PAL.void3, { skip: [PAL.night3, PAL.night2, PAL.night1] });
  paintEye(l.subject, l.light, g, f);
  ink(l.subject);
  // hand clean-up at 1×: close the corner-only gaps of the outline (two ink pixels meeting on a diagonal over the
  // sky read as a 2×2 checker): the upper-right one of the pair is filled
  if (g.k === 1) {
    const p = l.subject;
    for (let y = 0; y + 1 < p.h; y++)
      for (let x = 0; x + 1 < p.w; x++) {
        const d1 = p.get(x, y) === PAL.ink && p.get(x + 1, y + 1) === PAL.ink && !p.isOpaque(x + 1, y) && !p.isOpaque(x, y + 1);
        const d2 = p.get(x + 1, y) === PAL.ink && p.get(x, y + 1) === PAL.ink && !p.isOpaque(x, y) && !p.isOpaque(x + 1, y + 1);
        if (d1) p.set(x + 1, y, PAL.ink);
        if (d2) p.set(x, y, PAL.ink);
      }
  }
  // mote trails: from each silhouette's head up toward the pupil, 3 dots (big) / 2 (small), stepping with f
  const [ex, ey] = [g.eye[0], g.eye[1] + g.look];
  g.sil.forEach(([i, x, y]) => {
    const w = SILS[i][0].length;
    const sx = x + (w >> 1);
    const sy = y - 1;
    const n = g.k === 2 ? 3 : 1;
    for (let j = 1; j <= n; j++) {
      const t = (j + (f % 2) * 0.5) / (n + 1.5);
      const mx = Math.round(sx + (ex - sx) * t * 0.55);
      const my = Math.round(sy + (ey + g.eh * 0.6 - sy) * t * 0.55);
      if (!l.subject.isOpaque(mx, my)) l.light.set(mx, my, j === n ? PAL.void4 : PAL.void3);
    }
  });
}

const art: CardArtV3 = {
  id: 'void_eye',
  focus: [BIG.eye[0] - 3, BIG.eye[1] + BIG.look - 3],
  frames: FRAMES,
  holdMs: 150,
  big: (l, f) => paint(l, f, BIG),
  small: (l, f) => paint(l, f, SMALL),
};

export default art;
