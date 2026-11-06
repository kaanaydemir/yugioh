// Boşluk Gözü (void_eye) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
// "Bulutların arasından aşağı bakan dev göz, göz bebeğine doğru süzülen minik canavar silüetleri" (YENI_KARTLAR §7
// S3) — the image of the scene (src/cinematics/spells/void_eye.ts): the same vertical almond eye that tears the sky
// open, its iris turned DOWN, between two banks of night cloud; three tiny monster silhouettes float up toward the
// pupil on trails of violet motes.
//   backdrop  the kit's SPELL sky (night0 / night1, the lower band low under the cloud banks) WITHOUT its stock
//             portal: the eye's own light stands in for it (shape: false) — the rift glowing in the sky behind
//             the lids, a stepped vertical almond in void1 / void2 bands, exactly like the in-game rift.
//   subject   matter, ink outlined, ONE key light from the top left: two banks of night cloud that frame the eye
//             from both sides (night3 lit tops, night2 bodies, night1 shade bands), the lids (mist lip | night4
//             on the lit left, night2 on the right), the sclera (void0) and the iris rings (void1 limbal ring,
//             void2 / void3 fibres) turned DOWN, three monster silhouettes on a diagonal path rising out of the
//             left cloud bank toward the pupil — each smaller and more violet than the last (void0 → void1 →
//             void2), each with its own ink outline with a void3 rim on their shadow side.
//   light     the pupil's starry black with its stars, the bright pupil ring (void4), the white catch-light (the
//             single brightest point = the focus), the rift's white crack above and below the lids, the motes.
// The small picture (44×34) is the same composition painted again at 1× density by the same code (eye 13×21,
// iris r 4, two silhouettes, 2-px glow bands) — not a reduction — and corrected by hand (the pupil, the
// catch-light and the rift crack patched so they read at 1×).
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
  /** lid band width (the lit lip + skin; the in-game eye's lids) */
  lid: number;
  /** first row of the lower sky band */
  split: number;
  /** cloud puffs behind the eye: [cx, cy, r] (their union is the bank) */
  clouds: readonly (readonly [number, number, number])[];
  /** cloud puffs IN FRONT of the eye: they overlap the lids (the eye looks down between the clouds) */
  front: readonly (readonly [number, number, number])[];
  /** silhouettes: stamp index, top-left, fill, mirrored (they face the pupil); the far / big ones first */
  sil: readonly (readonly [number, number, number, number, boolean])[];
}

const BIG: Geo = {
  k: 2,
  eye: [44, 22],
  eh: 20,
  ew: 12,
  iris: 9,
  pupil: 4,
  look: 8,
  lid: 3,
  split: 54,
  clouds: [
    [3, 40, 7],
    [8, 52, 9],
    [19, 61, 8],
    [31, 67, 7],
    [85, 40, 7],
    [80, 52, 9],
    [69, 61, 8],
    [57, 67, 7],
  ],
  front: [
    [44, -5, 8],
    [33, -2, 5],
    [55, -2, 5],
    [29, 24, 4],
    [60, 26, 4],
  ],
  sil: [
    [0, 2, 46, PAL.void2, false],
    [5, 73, 44, PAL.void2, true],
    [1, 12, 31, PAL.void2, false],
    [4, 64, 31, PAL.void3, true],
    [4, 25, 37, PAL.void3, false],
  ],
};

const SMALL: Geo = {
  k: 1,
  eye: [22, 11],
  eh: 10,
  ew: 6,
  iris: 4,
  pupil: 2,
  look: 3,
  lid: 2,
  split: 27,
  clouds: [
    [1, 20, 4],
    [4, 27, 5],
    [10, 31, 4],
    [16, 35, 4],
    [43, 20, 4],
    [40, 27, 5],
    [34, 31, 4],
    [28, 35, 4],
  ],
  front: [
    [22, -3, 4],
    [15, 13, 2],
    [30, 14, 2],
  ],
  sil: [
    [3, 1, 21, PAL.void2, false],
    [6, 38, 20, PAL.void2, true],
    [7, 7, 14, PAL.void3, false],
    [7, 32, 14, PAL.void3, true],
  ],
};

// silhouettes ('#' body), drawn facing RIGHT (mirrored on the right side). big: a wolf (pointed ears, raised tail),
// a bat-winged drake, (2 unused), a bird; a horned demon head; small: a 4-px beast, a horned head, a bird
// prettier-ignore
const SILS: readonly (readonly string[])[] = [
  ['#.........#..', '##.......###.', '.#########.##', '.#########...', '..##...##....', '..#.....#....'],
  ['#...........#', '##...#.#...##', '###..###..###', '.###########.', '..#########..', '....#...#....'],
  ['.###.', '.###.', '..#..', '#####', '.###.', '.###.', '.#.#.'],
  ['...#', '####', '####', '#..#'],
  ['#.....#', '.##.##.', '..###..', '...#...'],
  ['#.......#', '##.....##', '.#.###.#.', '..#####..', '..##.##..', '..#####..', '...###...', '..#####..'],
  ['#.#', '###', '.#.'],
  ['##.##', '.###.'],
];

function paintClouds(p: PixelCanvas, g: Geo, list: Geo['clouds'] = g.clouds): void {
  const inside = (x: number, y: number) => list.some(([cx, cy, r]) => (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r + r);
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (!inside(x, y)) continue;
      // lit top band (k px), a lit left lip on each puff, the body, a shade band low on the puff
      let c: number = PAL.night2;
      if (!inside(x, y - g.k)) c = PAL.night3;
      else if (!inside(x - g.k, y - g.k) && !inside(x, y - 2 * g.k)) c = PAL.night3;
      else if (!inside(x, y + 3 * g.k) || list.every(([cx, cy, r]) => (x - cx) * (x - cx) + (y - cy) * (y - cy) > r * r * 0.35 || y < cy)) {
        if (list.some(([cx, cy, r]) => y > cy + r * 0.35 && (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r + r)) c = PAL.night1;
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
    for (let dx = -hw - g.lid; dx <= hw + g.lid; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      const a = Math.abs(dx);
      if (a > hw) {
        if (hw < 1 && a > 1) continue;
        // the in-game lids: the lit (left) lid a mist lip, night4 skin, night3 shade; the right lid night4 → night2
        const kk = a - hw;
        const L = [PAL.mist, PAL.night4, PAL.night3];
        const Rr = [PAL.night4, PAL.night3, PAL.night2];
        subject.set(x, y, (dx < 0 ? L : Rr)[Math.min(kk - 1, 2)]);
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

/** The rift's light behind the lids: a stepped vertical almond (void1 outer band, void2 inner band). */
function paintGlow(p: PixelCanvas, g: Geo): void {
  const [cx, cy] = g.eye;
  const band = 2 * g.k;
  const steps: [number, number][] = [
    [band * 2, PAL.void1],
    [band, PAL.void2],
  ];
  for (const [pad, c] of steps) {
    const eh = g.eh + pad + g.k;
    const ew = g.ew + pad;
    for (let dy = -eh; dy <= eh; dy++) {
      const hw = Math.floor(ew * (1 - (dy / eh) * (dy / eh)));
      for (let dx = -hw; dx <= hw; dx++) p.set(cx + dx, cy + dy, c);
    }
  }
}

/** The rift's crack in the sky above and below the lids (light layer): 1 px white with violet lips (big). */
function paintCrack(light: PixelCanvas, subject: PixelCanvas, g: Geo): void {
  const [cx, cy] = g.eye;
  const JAG = [0, 0, 1, 1, 0, 0, -1, -1];
  const ends: [number, number][] = [
    [0, cy - g.eh - 1],
    [cy + g.eh + 1, cy + g.eh + 6 * g.k],
  ];
  for (const [a, b] of ends)
    for (let y = a; y <= b; y++) {
      const x = cx + (g.k === 2 ? JAG[(y + 64) % JAG.length] : 0);
      if (subject.isOpaque(x, y)) continue;
      if (g.k === 2) {
        light.set(x, y, Math.abs(y - (cy - g.eh)) < 3 || Math.abs(y - (cy + g.eh)) < 3 ? PAL.void4 : PAL.white);
        if (!subject.isOpaque(x - 1, y)) light.set(x - 1, y, PAL.void3);
        if (!subject.isOpaque(x + 1, y)) light.set(x + 1, y, PAL.void3);
      } else light.set(x, y, y < 3 || y > b - 1 ? PAL.void3 : PAL.void4);
    }
}

function paint(l: ArtLayers, f: number, g: Geo): void {
  paintBackdrop(l.backdrop, 'SPELL', { focus: [BIG.eye[0], BIG.eye[1] + BIG.look], shape: false, horizon: 999, split: g.split * (2 / g.k) });
  paintGlow(l.backdrop, g);
  paintClouds(l.subject, g);
  const bob = f === 1 || f === 2 ? 1 : 0;
  const stamp = (i: number, flip: boolean) => {
    const rows = SILS[i];
    return flip ? rows.map((r) => [...r].reverse().join('')) : rows;
  };
  g.sil.forEach(([i, x, y, c, flip], n) => {
    const rows = stamp(i, flip);
    const yy = y - ((bob + n) % 2);
    const on = (rx: number, ry: number) => rows[ry]?.[rx] === '#';
    // its own ink outline first (it rises out of the cloud bank: the bank's matter must not swallow it)
    for (let ry = -1; ry <= rows.length; ry++)
      for (let rx = -1; rx <= rows[0].length; rx++)
        if (!on(rx, ry) && (on(rx - 1, ry) || on(rx + 1, ry) || on(rx, ry - 1) || on(rx, ry + 1))) l.subject.set(x + rx, yy + ry, PAL.ink);
    rows.forEach((r, ry) => [...r].forEach((ch, rx) => ch === '#' && l.subject.set(x + rx, yy + ry, c)));
  });
  rim(l.subject, PAL.void4, { skip: [PAL.night3, PAL.night2, PAL.night1, PAL.ink], only: (x, y) => g.sil.some(([i, sx, sy]) => x >= sx && x < sx + SILS[i][0].length && y >= sy - 1 && y < sy + SILS[i].length) });
  paintEye(l.subject, l.light, g, f);
  // the cloud lobes in front: over the lids, top and sides (the eye looks down between the clouds)
  paintClouds(l.subject, g, g.front);
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
  paintCrack(l.light, l.subject, g);
  // mote trails: from each silhouette's head (the corner that faces the eye) toward the pupil, stepping with f
  const [ex, ey] = [g.eye[0], g.eye[1] + g.look];
  g.sil.forEach(([i, x, y, , flip]) => {
    const w = SILS[i][0].length;
    const sx = flip ? x : x + w - 1;
    const sy = y - 1;
    const n = g.k === 2 ? 3 : 1;
    for (let j = 1; j <= n; j++) {
      const t = (j + (f % 2) * 0.5) / (n + 1.5);
      const mx = Math.round(sx + (ex - sx) * t * 0.45);
      const my = Math.round(sy + (ey - sy) * t * 0.45);
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
