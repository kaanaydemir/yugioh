// Sazlık Balıkçılı v3 — the "wader" rig: Pose → pixels.
//
// A NEW body plan (no biped, no serpent, no quadruped): a tall thin heron swordmaster standing on ONE 2-px leg in a
// patch of dark still water. A teardrop body at 60 % height, an S-neck (a cubic chain keyed per pose and rasterised,
// never rotated as a sprite), a small white head with an ink crown stripe and two trailing ink plumes, and a long
// horizontal BEAK BLADE (gold base, steel blade, one white glint). The wingtips are a straw "mino" cloak hanging low at
// the back in woven tiers. Reeds and the still-water patch are a ground layer inside the frame; low mist bands drift
// across the ankle (light-like vapour: flat stepped runs, never alpha, never outlined).
//
//   - every part is a flat polygon / chain filled with ONE tone and then split into flat value planes measured from
//     its own edges toward / away from the key light (lit, body, shade; REHBER IŞ-3); no gradients, no dither;
//   - ONE key light from the screen's top-left: `light` = the frame edge it comes from ('left' P1, 'right' the P2
//     relight sheet, mirrored by flipX it is lit from the top-left again). Planes are chosen per light (IŞ-1/2);
//   - light (eye, beak glint, needle lines, droplets, mist, moon streak) is painted after the outline (IŞ-9).
// Frame 96×84; 1 art px = 1 game px; the anchor (AX, GY) is the planted foot on the waterline.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ik2, lightOf, type Light } from '../rigkit';
import { Comp, bands, bezier, castOn, clamp, fatPath, hash2, mixPoly, shift, type Pt, type Tones } from './reed_heron-kit';
import { paintWisp } from './reed_heron-mist';

export const W = 96;
export const H = 84;
export const AX = 38;
export const GY = 74;

export const enum Part {
  none = 0,
  pond,
  reedB,
  wingF,
  leg2,
  leg,
  body,
  neck,
  head,
  beak,
  wing,
  cloak,
  reedF,
}
const HERON: readonly number[] = [Part.wingF, Part.leg2, Part.leg, Part.body, Part.neck, Part.head, Part.beak, Part.wing, Part.cloak];

const TAU = Math.PI * 2;
const rnd = Math.round;

// ---------------------------------------------------------------- pose

export interface Pose {
  /** body root offset from the anchor (px; + right / + down) */
  bx: number;
  by: number;
  /** chest breath (px up of the upper body points) */
  br: number;
  /** neck chain: two control points and the head centre, relative to the body root */
  n1x: number;
  n1y: number;
  n2x: number;
  n2y: number;
  hx: number;
  hy: number;
  /** beak angle (rad, 0 = level right, + = tip down) and extra reach (px, the smear / thrust) */
  ba: number;
  bl: number;
  /** wings: open 0…1 (the one wing fan), forward wrap 0…1 (guard cloak) */
  wo: number;
  wf: number;
  /** straw-cloak hem sway (px) and plume / throat-feather phases (0…1) */
  sway: number;
  plume: number;
  throat: number;
  /** planted foot: x offset from the anchor, lift (px) */
  fx: number;
  fl: number;
  /** second leg 0 tucked … 1 out; its foot relative to the anchor */
  l2: number;
  l2x: number;
  l2y: number;
  /** reeds: sway phase 0…1, amplitude (px), flattened 0…1 (downdraft), grown 0…1 (summon pop) */
  reed: number;
  reedA: number;
  reedFlat: number;
  reedGrow: number;
  /** water: drawn 0/1, ripple-line phase 0…1, falling drop stage (−1 none, 0 forming, 1 falling, 2…3 ripple),
   *  the single death ripple ring 0 (none) … 1 (widest) */
  pond: number;
  rip: number;
  drop: number;
  ring: number;
  /** ankle mist: drift phase 0…1 and amount 0 (none) … 1 (normal low bands) … 2 (the summon wall) */
  mist: number;
  mistK: number;
  /** summon: the mist wall's bands slide apart by this many px */
  part: number;
  /** heron drawn 0/1 (summon: hidden in the mist wall) */
  show: number;
  /** eye 0 shut … 1 open; summon glint stage 0 none, 1 = 1 px, 2 = 3-px cross */
  eye: number;
  glint: number;
  /** attack: 1-frame white needle line along the beak, droplet flick phase (0 none), release smear 0/1,
   *  horizontal mist trail behind the glide 0…1 */
  needle: number;
  drops: number;
  smear: number;
  trail: number;
  /** travel: a 1-px ripple dot under each foot 0/1 */
  dots: number;
  /** hit: plumage ruffle 0/1/2; hitMagic: lit plumage edges 0…1 */
  ruffle: number;
  rim: number;
  /** death: mist front 0 (none) … 1 (covers the head), motes 0 (none) … 1; revive gather = the same run backwards */
  cover: number;
  motes: number;
  /** summon: the heron is a dark shape inside the fog (night tones, ink outline; the glint is the only light) 0/1 */
  sil: number;
  /** attack: the aim glint (1 white px at the beak tip, the freeze), the deflect spark at the tip (blocked TING) */
  aim: number;
  spark: number;
  /** attack: the thrust smear (a 2-px speed streak behind the head on the beak's row) 0/1 */
  streak: number;
  /** global phase 0…1 */
  t: number;
}

export const NEUTRAL: Pose = {
  bx: 0, by: 0, br: 0,
  n1x: 13, n1y: -39, n2x: 0, n2y: -47, hx: 8, hy: -55,
  ba: 0, bl: 0,
  wo: 0, wf: 0,
  sway: 0, plume: 0, throat: 0,
  fx: 0, fl: 0,
  l2: 0, l2x: -6, l2y: -1,
  reed: 0, reedA: 1, reedFlat: 0, reedGrow: 1,
  pond: 1, rip: 0, drop: -1, ring: 0,
  mist: 0, mistK: 1, part: 0, show: 1,
  eye: 1, glint: 0,
  needle: 0, drops: 0, smear: 0, trail: 0, dots: 0,
  ruffle: 0, rim: 0,
  cover: 0, motes: 0,
  sil: 0, aim: 0, spark: 0, streak: 0,
  t: 0,
};
export const pose = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

// ---------------------------------------------------------------- tones

const PLUME: Tones = { L: PAL.white, M: PAL.mist, S: PAL.steel };
// the folded wing is plumage too: white on the lit top, mist body, steel only in the creases / underside
const WING: Tones = { L: PAL.white, M: PAL.mist, S: PAL.steel };
const FAR: Tones = { L: PAL.steel, M: PAL.night4, S: PAL.night3 };
const STRAW: Tones = { L: PAL.earth4, M: PAL.earth3, S: PAL.earth1 };
const LEG: Tones = { L: PAL.earth2, M: PAL.earth2, S: PAL.earth1 };

/** One step darker on the plumage / straw / leg ramps (crease and cast shadows). */
function darker(c: number): number {
  switch (c) {
    case PAL.white: return PAL.mist;
    case PAL.mist: return PAL.steel;
    case PAL.steel: return PAL.night4;
    case PAL.night4: return PAL.night3;
    case PAL.earth4: return PAL.earth3;
    case PAL.earth3: return PAL.earth2;
    case PAL.earth2: return PAL.earth1;
    default: return c;
  }
}

// ---------------------------------------------------------------- skeleton

export interface Skel {
  B: Pt;
  N0: Pt;
  N1: Pt;
  N2: Pt;
  Hd: Pt;
  beak0: Pt;
  dir: Pt;
  tip: Pt;
  foot: Pt;
  hip: Pt;
  knee: Pt;
  foot2: Pt;
  knee2: Pt;
  eye: Pt;
  core: Pt;
}

export function skeleton(o: Pose): Skel {
  const B: Pt = [AX + o.bx, GY + o.by];
  const at = (dx: number, dy: number): Pt => [B[0] + dx, B[1] + dy];
  const N0 = at(6, -33 - o.br);
  const N1 = at(o.n1x, o.n1y);
  const N2 = at(o.n2x, o.n2y);
  const Hd = at(o.hx, o.hy);
  const dir: Pt = [Math.cos(o.ba), Math.sin(o.ba)];
  const beak0: Pt = [Hd[0] + 3 + dir[0] * 0.5, Hd[1] + 0.5 + dir[1] * 3];
  const len = 16 + o.bl;
  const tip: Pt = [beak0[0] + dir[0] * len, beak0[1] + dir[1] * len];
  const foot: Pt = [AX + o.fx, GY - 1 - o.fl];
  const hip = at(1, -23);
  const knee = ik2(foot, hip, 12, 12, -1) as Pt;
  const foot2: Pt = [AX + o.l2x, GY + o.l2y];
  const knee2 = ik2(foot2, hip, 12, 12, -1) as Pt;
  return { B, N0, N1, N2, Hd, beak0, dir, tip, foot, hip, knee, foot2, knee2, eye: [rnd(Hd[0] + 1), rnd(Hd[1] - 1)], core: at(-2, -31) };
}

// ---------------------------------------------------------------- shapes (relative to the body root)

const BODY: Pt[] = [[-17, -25], [-11, -23], [-3, -22], [3, -23], [7, -27], [9, -32], [8, -36], [4, -39], [-3, -39], [-9, -36], [-14, -31]];
// near wing: folded on the body side / spread up and back / wrapped forward round the breast (the guard cloak)
const WING_FOLD: Pt[] = [[5, -37], [0, -39], [-6, -38], [-12, -34], [-17, -29], [-22, -25], [-14, -27], [-6, -30], [0, -32], [4, -34]];
const WING_OPEN: Pt[] = [[6, -36], [6, -45], [3, -53], [-3, -58], [-9, -59], [-13, -55], [-12, -49], [-9, -43], [-4, -37], [2, -32]];
// (the guard: a shoulder hump in front, a straight back line, the primaries crossing out past the tail to a point)
const WING_GUARD: Pt[] = [[11, -34], [8, -40], [1, -42], [-7, -40], [-15, -35], [-27, -26], [-17, -25], [-7, -23], [3, -23], [9, -27]];
// the straw cloak hangs from the wing's trailing edge; hem teeth are 3 px wide (MA-2)
// (its top starts UNDER the wing's coverts and it flares to the hem: a straw raincoat, never a box; the hem
// teeth are cut per column in drawCloak, so every pose keeps ragged ≥ 2-px teeth)
const CLOAK_FOLD: Pt[] = [[-4, -30], [-10, -32], [-15, -30], [-19, -26], [-23, -19], [-25, -13], [-21, -11], [-16, -10], [-11, -11], [-7, -12], [-5, -17], [-3, -24]];
const CLOAK_OPEN: Pt[] = [[-3, -58], [-10, -61], [-19, -63], [-28, -61], [-31, -56], [-28, -56], [-28, -51], [-25, -52], [-23, -47], [-20, -49], [-15, -45], [-9, -47]];
const CLOAK_GUARD: Pt[] = [[-4, -28], [-11, -30], [-16, -27], [-19, -22], [-22, -16], [-23, -10], [-18, -9], [-13, -8], [-8, -9], [-3, -10], [2, -13], [6, -20]];
// far wing (only behind an open wing): rises up and forward behind the neck
const FAR_FOLD: Pt[] = [[2, -36], [0, -38], [-2, -38], [-4, -37], [-2, -35], [0, -35], [1, -35]];
const FAR_OPEN: Pt[] = [[4, -37], [9, -47], [11, -57], [5, -64], [-3, -62], [-2, -53], [-1, -43]];

interface Reed {
  x: number;
  h: number;
  lean: number;
  ph: number;
  front: boolean;
  head: boolean;
  blade: number;
}
const REEDS: readonly Reed[] = [
  { x: -21, h: 29, lean: -2, ph: 0.0, front: false, head: true, blade: -1 },
  { x: -26, h: 18, lean: -3, ph: 0.35, front: false, head: false, blade: 0 },
  { x: 21, h: 25, lean: 2, ph: 0.6, front: false, head: true, blade: 1 },
  { x: -12, h: 10, lean: -1, ph: 0.15, front: true, head: false, blade: 0 },
  { x: 16, h: 13, lean: 1, ph: 0.8, front: true, head: false, blade: 1 },
];

// ---------------------------------------------------------------- frame

interface Frame {
  p: PixelCanvas;
  comp: Comp;
  light: Light;
  o: Pose;
  sk: Skel;
  /** the ground layer (pond + back reeds) before the heron covered it: what the death mist gives back */
  ground?: PixelCanvas;
  groundId?: Uint8Array;
}
const layer = () => new PixelCanvas(W, H);
const B = (f: Frame, pts: readonly Pt[]): Pt[] => shift(pts, f.sk.B[0], f.sk.B[1]);

// ---------------------------------------------------------------- ground layer: pond + reeds

/** The still-water patch (also used standalone by the cinematics: the pond stays home while the heron glides). */
export function drawPond(p: PixelCanvas, o: Pick<Pose, 'rip' | 'drop' | 'ring' | 'fx'> & { cx?: number }, legX: number | null): void {
  const cx = o.cx ?? AX + 5;
  const cy = GY;
  const q = layer();
  q.ellipse(cx, cy, 24, 6, PAL.water0);
  // darker deep middle, the far bank a night1 band, the near bank water0
  for (let y = cy - 6; y <= cy + 6; y++)
    for (let x = cx - 24; x <= cx + 24; x++) {
      if (!q.isOpaque(x, y)) continue;
      const dx = (x + 0.5 - cx) / 21;
      const dy = (y + 0.5 - cy) / 4.2;
      if (dx * dx + dy * dy < 1) q.set(x, y, PAL.night0);
      else if (y < cy) q.set(x, y, PAL.night1);
    }
  // ripple lines crawl outward along the surface (water1 dashes)
  const lines: [number, number, number][] = [[-14, -2, 4], [6, -3, 3], [-6, 3, 5], [12, 1, 4], [-18, 1, 3], [2, 4, 4]];
  lines.forEach(([x0, dy, len], i) => {
    const dir = x0 < 0 ? -1 : 1;
    const ph = (o.rip + i * 0.37) % 1;
    const off = rnd(ph * 4) * dir;
    const l = ph > 0.75 ? len - 1 : len;
    for (let k = 0; k < l; k++) {
      const x = cx + x0 + off + k;
      if (q.isOpaque(x, cy + dy) && q.get(x, cy + dy) === PAL.night0) q.set(x, cy + dy, PAL.water1);
    }
  });
  // the leg's reflection and its waterline ring
  if (legX !== null) {
    for (let y = cy; y <= cy + 2; y++) if (q.isOpaque(legX, y)) q.set(legX, y, PAL.night2);
    const rk = 1 + ((o.rip * 2) % 1 < 0.5 ? 0 : 1);
    for (let x = legX - 2 - rk; x <= legX + 3 + rk; x++) {
      if (x >= legX && x <= legX + 1) continue;
      if (q.isOpaque(x, cy - 1)) q.set(x, cy - 1, PAL.water1);
    }
  }
  // the drop's ripple (the single 1-px ellipse) and the death ring
  const ringAt = (rx: number, ry: number, c: number, x0: number) => {
    for (let y = cy - ry - 1; y <= cy + ry + 1; y++)
      for (let x = x0 - rx - 1; x <= x0 + rx + 1; x++) {
        const d = ((x + 0.5 - x0) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
        const di = ((x + 0.5 - x0) / (rx - 1)) ** 2 + ((y + 0.5 - cy) / Math.max(0.6, ry - 1)) ** 2;
        if (d <= 1 && di > 1 && q.isOpaque(x, y)) q.set(x, y, c);
      }
  };
  if (o.drop >= 2) ringAt(o.drop === 2 ? 3 : 5, o.drop === 2 ? 1 : 2, o.drop === 2 ? PAL.water3 : PAL.water1, AX + 25);
  if (o.ring > 0) ringAt(rnd(4 + o.ring * 14), rnd(1 + o.ring * 3.5), o.ring < 0.7 ? PAL.water3 : PAL.water1, cx - 2);
  return void p.blit(q, 0, 0);
}

function drawReeds(f: Frame, front: boolean): void {
  const { o, light } = f;
  const q = layer();
  const lit = light.side < 0 ? -1 : 1;
  for (const r of REEDS) {
    if (r.front !== front) continue;
    const h = rnd(r.h * clamp(o.reedGrow, 0, 1) * (1 - 0.45 * o.reedFlat));
    if (h < 2) continue;
    // a slow sway (once per loop) plus a quick tremor of the tip (four per loop): the wind combs the reeds
    const sway = o.reedA * (Math.sin(TAU * (o.reed + r.ph)) * 1.0 + Math.sin(TAU * (4 * o.reed + r.ph * 3)) * 0.9);
    const lean = r.lean + sway + o.reedFlat * (r.x < 4 ? -3 : 3);
    const bx = AX + r.x;
    const pts: Pt[] = [];
    for (let k = 0; k <= h; k++) {
      const u = k / h;
      pts.push([rnd(bx + lean * u * u), GY - 1 - k]);
    }
    // stem: leaf1 below, leaf2 above (the lit side gets the lighter tone on its 2-px top), a leaf0 spike
    pts.forEach(([x, y], k) => q.set(x, y, k < h * 0.45 ? PAL.leaf1 : PAL.leaf2));
    // the cattail head (2×4, earth2 with an earth1 shade column), a short spike above
    if (r.head && h > 10) {
      const [x, y] = pts[h - 3];
      q.rect(x, y - 1, 2, 4, PAL.earth2);
      q.vline(lit < 0 ? x + 1 : x, y + 1, y + 2, PAL.earth1);
      q.set(pts[h][0], pts[h][1] - 1, PAL.leaf1);
    }
    // one leaf blade arching off the stem
    if (h > 8) {
      const [sx, sy] = pts[rnd(h * 0.35)];
      const dir = r.blade === 0 ? (r.x < 0 ? -1 : 1) : r.blade;
      const L = rnd(5 + h * 0.15);
      const flick = o.reedA * Math.sin(TAU * (4 * o.reed + r.ph * 5 + 0.25));
      for (let k = 1; k <= L; k++) q.set(rnd(sx + dir * k), rnd(sy - k * 0.9 + (k * k) / (L * 1.6) + (flick * k * k) / (L * L) * 1.6), k < L / 2 ? PAL.leaf1 : PAL.leaf0);
    }
  }
  f.comp.add(q, front ? Part.reedF : Part.reedB, { out: PAL.leaf0 });
}

// ---------------------------------------------------------------- heron parts

function drawFarWing(f: Frame): void {
  const { o } = f;
  if (o.wo < 0.15) return;
  const q = layer();
  q.poly(B(f, mixPoly(FAR_FOLD, FAR_OPEN, o.wo)), FAR.M);
  bands(q, FAR, f.light, 2, 2);
  // primaries: 2-px straw teeth on the far edge (night3 seams)
  f.comp.add(q, Part.wingF, { out: PAL.night2 });
}

function legPair(f: Frame, foot: Pt, knee: Pt, part: Part, t: Tones): void {
  const q = layer();
  const { hip } = f.sk;
  const ls = f.light.side;
  const seg = (a: Pt, b: Pt) => {
    q.line(rnd(a[0]), rnd(a[1]), rnd(b[0]), rnd(b[1]), t.M);
    q.line(rnd(a[0]) + 1, rnd(a[1]), rnd(b[0]) + 1, rnd(b[1]), t.M);
  };
  seg(foot, knee);
  seg(knee, [hip[0], hip[1] + 2]);
  // the shade column is the one away from the light; a gold1 glint on the knee's lit side
  const src = q.clone();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!src.isOpaque(x, y)) continue;
      if (!src.isOpaque(x - ls, y)) q.set(x, y, t.S);
    }
  const kx = rnd(knee[0]) + (ls < 0 ? 0 : 1);
  q.set(kx, rnd(knee[1]), PAL.gold1);
  f.comp.add(q, part, { out: PAL.earth0 });
}

function drawLegs(f: Frame): void {
  const { o, sk } = f;
  if (o.l2 > 0.05) legPair(f, sk.foot2, sk.knee2, Part.leg2, { L: PAL.earth1, M: PAL.earth1, S: PAL.earth0 });
  legPair(f, sk.foot, sk.knee, Part.leg, LEG);
}

function bodyPoly(f: Frame): Pt[] {
  const { o } = f;
  return B(f, BODY.map(([x, y]) => [x, y < -33 ? y - o.br : y] as Pt));
}

function drawBody(f: Frame): void {
  const q = layer();
  q.poly(bodyPoly(f), PLUME.M);
  // the plumage is the largest, brightest plane: a wide white back, mist in the middle, steel only underneath
  bands(q, PLUME, f.light, 5, 2, { top: 3, bottom: 2 });
  f.comp.add(q, Part.body, { out: PAL.steel });
}

function neckPath(f: Frame): Pt[] {
  const { sk } = f;
  return bezier(sk.N0, sk.N1, sk.N2, [sk.Hd[0] - 1, sk.Hd[1] + 1]);
}

function drawNeck(f: Frame): void {
  const { o, sk, light } = f;
  const q = layer();
  const path = neckPath(f);
  fatPath(q, path, (t) => 2.0 - 0.7 * t, PLUME.M);
  bands(q, PLUME, light, 2, 1, { top: 1, bottom: 0 });
  // the foreneck streak: a dotted night4 line just inside the front (right) edge, upper two-thirds
  for (let i = rnd(path.length * 0.25); i < path.length * 0.85; i += 3) {
    const [x, y] = path[i];
    const yy = rnd(y);
    let xr = rnd(x);
    while (q.isOpaque(xr + 1, yy)) xr++;
    if (q.isOpaque(xr - 1, yy)) q.set(xr - 1, yy, PAL.steel);
  }
  // throat plumes: long feathers hanging from the neck base (2-px teeth that sway)
  const sw = rnd(Math.sin(TAU * o.throat) * 1);
  const [bx, by] = [sk.N0[0] + 1, sk.N0[1] + 1];
  q.poly([[bx - 1, by - 2], [bx + 3, by - 1], [bx + 3 + sw, by + 5], [bx + 1 + sw, by + 6], [bx, by + 3]], PLUME.L);
  for (let y = by + 1; y <= by + 6; y++) for (let x = bx - 1; x <= bx + 4 + sw; x++) if (q.isOpaque(x, y) && !q.isOpaque(x + light.side * -1, y) && light.side > 0) q.set(x, y, PLUME.M);
  f.comp.add(q, Part.neck, { out: PAL.steel, skip: [Part.body] });
}

function drawHead(f: Frame): void {
  const { sk, light } = f;
  const [hx, hy] = sk.Hd;
  const q = layer();
  q.ellipse(hx + 0.5, hy + 0.5, 4, 3, PLUME.M);
  bands(q, PLUME, light, 2, 1, { top: 1, bottom: 1 });
  // the crown: a night1 cap and the eye stripe running back from the eye
  const ex = sk.eye[0];
  const ey = sk.eye[1];
  for (let x = rnd(hx) - 3; x <= ex - 1; x++) {
    if (q.isOpaque(x, ey)) q.set(x, ey, PAL.night1);
    if (x <= ex - 2 && q.isOpaque(x, ey - 1)) q.set(x, ey - 1, PAL.night1);
  }
  q.set(ex, ey, PAL.ink);
  if (q.isOpaque(ex + 1, ey)) q.set(ex + 1, ey, PAL.ink);
  f.comp.add(q, Part.head, { out: PAL.steel, skip: [Part.neck] });
}

function drawBeak(f: Frame): void {
  const { sk, o } = f;
  const q = layer();
  const len = 16 + o.bl;
  const [ux, uy] = sk.dir;
  const put = (s: number, dy: number, c: number) => q.set(rnd(sk.beak0[0] + ux * s), rnd(sk.beak0[1] + uy * s) + dy, c);
  if (o.smear) for (let s = -2; s < len - 2; s++) put(s, 0, PAL.stone2);
  for (let s = 0; s <= len; s++) {
    const t = s / len;
    if (t < 0.3) {
      put(s, -1, PAL.gold3);
      put(s, 0, PAL.gold2);
    } else if (t < 0.72) {
      put(s, -1, PAL.stone4);
      put(s, 0, PAL.stone2);
    } else put(s, 0, t > 0.95 ? PAL.stone4 : PAL.stone3);
  }
  f.comp.add(q, Part.beak, { out: PAL.night4 });
}

function drawWing(f: Frame): void {
  const { o, light, sk } = f;
  const fold = mixPoly(WING_FOLD, WING_GUARD, o.wf);
  const pts = B(f, mixPoly(fold, WING_OPEN, o.wo));
  const q = layer();
  q.poly(pts, WING.M);
  bands(q, WING, light, 2, 2, { top: 2, bottom: 1 });
  // feather tiers (MA-2, flat 1-px creases, never a speckle grid): the scapular edge 4 rows under the top line and
  // a covert tier 4 rows under it, both with 2-px teeth that point back; the primaries cross over the tail as two
  // steel quills running parallel to the underside in the rear third. The white lit rim stays clean.
  const src = q.clone();
  const bb = { x0: W, x1: -1 };
  const topY = new Int16Array(W).fill(-1);
  const botY = new Int16Array(W).fill(-1);
  for (let x = 0; x < W; x++)
    for (let y = 0; y < H; y++)
      if (src.isOpaque(x, y)) {
        if (topY[x] < 0) topY[x] = y;
        botY[x] = y;
        bb.x0 = Math.min(bb.x0, x);
        bb.x1 = Math.max(bb.x1, x);
      }
  if (bb.x1 >= 0 && o.wf >= 0.5 && o.wo < 0.2) {
    // FOLDED (guard / death): three overlapping feather tiers read top-down, flat bands per column measured from
    // the wing's own top edge — a white lit edge, the covert tier (mist) ending in a steel crease with 2-px teeth,
    // the secondary tier (mist) ending in a second toothed crease, the primaries (steel) — a night4 shadow band
    // along the underside where the wing meets the body, and 2–3 px primary tips hanging over the straw cloak in
    // the rear half (steel, a night4 last pixel)
    const span = bb.x1 - bb.x0;
    const rear = bb.x0 + span * 0.5;
    // the tiers follow the wing's back line smoothed over 5 columns (the stair-stepped top edge never zigzags
    // the creases); each crease is a sawtooth whose teeth step DOWN toward the tail (feather tips pointing back)
    const sTop = new Int16Array(W).fill(-1);
    for (let x = bb.x0; x <= bb.x1; x++) {
      let m = 9999;
      for (let k = -2; k <= 2; k++) if (x + k >= 0 && x + k < W && topY[x + k] >= 0) m = Math.min(m, topY[x + k]);
      sTop[x] = m === 9999 ? topY[x] : m;
    }
    for (let x = bb.x0; x <= bb.x1; x++) {
      if (topY[x] < 0) continue;
      const saw = Math.floor((((sk.B[0] - x) + 600) % 6) / 2);
      for (let y = topY[x]; y <= botY[x]; y++) {
        if (src.get(x, y) === null) continue;
        const d = y - sTop[x];
        let c: number;
        if (y === botY[x] && y - topY[x] > 2) c = PAL.night4;
        else if (y === topY[x]) c = PAL.white;
        else if (d < 4 + saw) c = PAL.mist;
        else if (d === 4 + saw) c = PAL.steel;
        else if (d === 5 + saw) c = PAL.white;
        else if (d < 9 + saw) c = PAL.mist;
        else if (d === 9 + saw) c = PAL.steel;
        else c = PAL.steel;
        q.set(x, y, c);
      }
      if (x < rear && botY[x] - topY[x] > 3) {
        const g = ((x - sk.B[0] + 90) % 3 + 3) % 3;
        const len = g === 2 ? 0 : 2 + ((Math.floor((x - sk.B[0] + 90) / 3) % 2) ? 1 : 0);
        for (let k = 1; k <= len; k++) q.set(x, botY[x] + k, k === len ? PAL.night4 : PAL.steel);
      }
    }
  } else if (bb.x1 >= 0) {
    const span = bb.x1 - bb.x0;
    const rear = bb.x0 + span * 0.42;
    const open = o.wo > 0.5;
    for (let x = bb.x0; x <= bb.x1; x++) {
      if (topY[x] < 0) continue;
      const h = botY[x] - topY[x];
      const tooth = ((x - sk.B[0] + 60) % 4) < 2 ? 0 : 1;
      const tiers = open ? [4, 9] : [4, 8];
      for (const d of tiers) {
        const y = topY[x] + d + tooth;
        if (h > d + 2 && src.get(x, y) !== null && y < botY[x] - 1) q.set(x, y, WING.S);
      }
      if (!open && x < rear && h > 4) {
        // primaries: two quills a row and three rows above the underside, crossing out past the tail
        for (const d of [2, 4]) {
          const y = botY[x] - d;
          if (y > topY[x] + 2 && src.get(x, y) !== null) q.set(x, y, d === 2 ? PAL.night4 : WING.S);
        }
      }
    }
  }
  f.comp.add(q, Part.wing, { out: PAL.steel });
  // cast shadow of the wing onto the body below it (IŞ-6)
  castOn(f.comp, q, 0, 1, [Part.body], darker);
}

function drawCloak(f: Frame): void {
  const { o, light, sk } = f;
  const base = mixPoly(mixPoly(CLOAK_FOLD, CLOAK_GUARD, o.wf), CLOAK_OPEN, o.wo);
  // hem sway: the lower points move most (the five hem vertices 4…10)
  const pts = B(
    f,
    base.map(([x, y], i) => {
      const k = i >= 4 && i <= 10 ? 1 : i === 3 || i === 11 ? 0.5 : 0;
      return [x + o.sway * k, y] as Pt;
    }),
  );
  const q = layer();
  q.poly(pts, STRAW.M);
  // ragged hem: columns in 2–3 px groups lose 0–4 px from the bottom (a different length per group: teeth, MA-2)
  if (o.wo < 0.5) {
    for (let x = 0; x < W; x++) {
      let bot = -1;
      for (let y = H - 1; y >= 0; y--) if (q.isOpaque(x, y)) { bot = y; break; }
      if (bot < 0) continue;
      const g = Math.floor((x - sk.B[0] + 90) / 3);
      const cut = [0, 3, 1, 4, 0, 2, 3][((g % 7) + 7) % 7];
      for (let k = 0; k < cut; k++) q.erase(x, bot - k);
    }
  }
  bands(q, STRAW, light, 2, 2, { top: 1, bottom: 1 });
  // straw tiers (a mino): a ragged earth1 crease every 6 rows where the next tier's tips overlap, and earth2 straw
  // strands every 3 px in the body / shade planes; the lit plane stays calm (MA-2). The strands rustle with the phase.
  const src = q.clone();
  let top = H;
  for (let y = 0; y < H && top === H; y++) for (let x = 0; x < W; x++) if (src.isOpaque(x, y)) { top = y; break; }
  const rustle = Math.floor(o.t * 16) % 3;
  for (let y = top; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!src.isOpaque(x, y)) continue;
      const c = src.get(x, y);
      const col = Math.floor((x - sk.B[0] + 90) / 3);
      const r = y - top - (hash2(col, 5) < 0.5 ? 0 : 1);
      const inTier = ((r % 6) + 6) % 6;
      if (r > 2 && inTier === 0 && src.isOpaque(x, y + 1)) q.set(x, y, c === STRAW.L ? PAL.earth2 : PAL.earth1);
      else if (inTier >= 2 && c === STRAW.M && (x + rustle) % 3 === 0 && src.isOpaque(x, y + 1)) q.set(x, y, PAL.earth2);
    }
  f.comp.add(q, Part.cloak, { out: PAL.earth1, skip: [Part.reedB] });
}

// ---------------------------------------------------------------- after the outline

function plumes(f: Frame): void {
  const { o, sk, p } = f;
  const [hx, hy] = sk.Hd;
  const w = Math.sin(TAU * o.plume);
  const w2 = Math.sin(TAU * (o.plume - 0.25));
  const pl = (len: number, drop: number, wv: number, c: number) => {
    for (let k = 0; k <= len; k++) {
      const u = k / len;
      const x = rnd(hx - 3 - k);
      const y = rnd(hy - 1 + drop * u + wv * u * u * 1.5);
      if (!p.isOpaque(x, y) || p.get(x, y) === PAL.ink || k < 3) p.set(x, y, k > len - 3 ? PAL.night1 : PAL.ink);
    }
  };
  pl(10, 1, w, PAL.ink);
  pl(7, 3, w2, PAL.ink);
}

function eyeLight(f: Frame): void {
  const { o, sk, p } = f;
  if (o.eye <= 0) return;
  const [ex, ey] = sk.eye;
  p.set(ex, ey, PAL.gold4);
}

function beakGlint(f: Frame): void {
  const { o, sk, p } = f;
  const s = 9 + o.bl * 0.5;
  const x = rnd(sk.beak0[0] + sk.dir[0] * s);
  const y = rnd(sk.beak0[1] + sk.dir[1] * s) - 1;
  if (p.get(x, y) === PAL.stone4) p.set(x, y, PAL.white);
}

function needleLight(f: Frame): void {
  const { o, sk, p } = f;
  const [ux, uy] = sk.dir;
  if (o.needle > 0) {
    const len = 16 + o.bl;
    for (let s = 5; s <= len + 5; s++) {
      const x = rnd(sk.beak0[0] + ux * s);
      const y = rnd(sk.beak0[1] + uy * s) - (s <= len * 0.72 ? 1 : 0);
      p.set(x, y, PAL.white);
    }
  }
  if (o.drops > 0) {
    const [tx, ty] = sk.tip;
    const k = o.drops;
    p.set(rnd(tx + 2 + 3 * k), rnd(ty - 2 - 4 * k + 5 * k * k), PAL.water4);
    p.set(rnd(tx + 4 * k), rnd(ty - 1 - 2 * k + 6 * k * k), PAL.white);
  }
}

/** The moon's reflection on the still water: a full 1×6 white streak (+ a 3-px mist under-row), always drawn —
 *  in the near water right of the leg, clear of the reeds and the leg's ring. */
/** Attack lights: the freeze's aim glint at the tip, the thrust's speed streak behind the head, the TING spark. */
function strikeLight(f: Frame): void {
  const { o, sk, p } = f;
  const [tx, ty] = [rnd(sk.tip[0]), rnd(sk.tip[1])];
  if (o.aim) p.set(tx, ty, PAL.white);
  if (o.streak) {
    // a 2-row speed streak trailing the head on the beak's row: mist then steel, broken (light, not matter)
    const y = rnd(sk.beak0[1]);
    const x0 = rnd(sk.Hd[0]) - 5;
    for (let k = 0; k < 7; k++) if (!p.isOpaque(x0 - k, y) && k !== 3) p.set(x0 - k, y, k < 3 ? PAL.mist : PAL.steel);
    for (let k = 1; k < 5; k++) if (!p.isOpaque(x0 - k, y - 2)) p.set(x0 - k, y - 2, PAL.steel);
  }
  if (o.spark) {
    // the deflect: one cold spark at the tip — white core, stone4 rays (4 px up-right, 2 px elsewhere)
    p.set(tx, ty, PAL.white);
    for (const [dx, dy, n] of [[1, -1, 3], [-1, -1, 2], [1, 1, 2], [0, -1, 2], [1, 0, 2]] as const)
      for (let k = 1; k <= n; k++) p.set(tx + dx * k, ty + dy * k, k === 1 ? PAL.white : PAL.stone4);
  }
}

function moonStreak(f: Frame): void {
  const { p, o } = f;
  if (!o.pond) return;
  const cx = AX + 8;
  const y = GY + 2;
  for (let x = cx; x < cx + 6; x++) p.set(x, y, PAL.white);
  for (let x = cx + 2; x < cx + 5; x++) p.set(x, y + 1, PAL.mist);
}

function dropLight(f: Frame): void {
  const { o, sk, p } = f;
  if (o.drop < 0 || o.drop >= 2) return;
  const [tx, ty] = sk.tip;
  if (o.drop === 0) p.set(rnd(tx) - 1, rnd(ty) + 1, PAL.water4);
  else {
    const y = rnd((ty + GY) / 2);
    p.set(rnd(tx) - 1, y, PAL.water4);
    p.set(rnd(tx) - 1, y - 1, PAL.water3);
  }
}

function mistLight(f: Frame): void {
  const { o, p } = f;
  if (o.mistK <= 0) return;
  // the low bank round the ankle: three marsh WISPS (reed_heron-mist.ts, 3-row stepped lenses with Bayer ends —
  // the same vapour as the summon's bank, the death's cover and the board's marsh): one behind the reeds on the
  // left, one over the far water on the right, one low over the near water; each breathes ±2 px on its own phase
  // (bounded: the bank never drifts away from idle f0). Never 1-px lines: the water's ripples are the only lines.
  const run = (y: number, x0: number, x1: number, c: number) => {
    for (let x = Math.max(3, x0); x <= Math.min(W - 4, x1); x++) if (p.inBounds(x, y)) p.set(x, y, c);
  };
  const low: [number, number, number, number, 0 | 1][] = [
    [-19, -10, 8, 3, 1],
    [14, -7, 10, 5, 1],
    [1, 0, 11, 7, 0],
  ];
  low.forEach(([cx, dy, hw, seed, tone], i) => {
    const sway = rnd(1.6 * Math.sin(TAU * (2 * o.mist + i * 0.27)));
    paintWisp(run, { cx: AX + cx + sway, y: GY + dy, h: 3, hw, lean: 0, seed: 70 + seed, tone });
  });
}

function trailLight(f: Frame): void {
  const { o, p, sk } = f;
  if (o.trail <= 0) return;
  // horizontal mist streaks behind the glide (left of the body), at three heights
  const rows: [number, number][] = [[-30, 14], [-22, 18], [-8, 12]];
  rows.forEach(([dy, len], i) => {
    const L = rnd(len * o.trail);
    const x1 = sk.B[0] - 18 - i * 2;
    for (let x = Math.max(3, x1 - L); x <= x1; x++) {
      const y = sk.B[1] + dy + (x < x1 - L * 0.6 ? 0 : 0);
      if (p.isOpaque(x, y)) continue;
      p.set(x, y, x < x1 - L * 0.5 ? PAL.night4 : PAL.steel);
    }
  });
}

function dotLight(f: Frame): void {
  const { o, p, sk } = f;
  if (!o.dots) return;
  for (const [x] of [sk.foot, sk.foot2]) {
    const xx = rnd(x);
    p.set(xx - 1, GY, PAL.water3).set(xx + 2, GY, PAL.water3).set(xx, GY + 1, PAL.water1).set(xx + 1, GY + 1, PAL.water1);
  }
}

function glintLight(f: Frame): void {
  const { o, sk, p } = f;
  if (o.glint <= 0) return;
  const [ex, ey] = sk.eye;
  // IŞ-8: gold4 1 px → a 3-px gold4 cross → 1 px (never a white star)
  p.set(ex, ey, PAL.gold4);
  if (o.glint >= 2) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) p.set(ex + dx, ey + dy, PAL.gold4);
}

function rimLight(f: Frame): void {
  const { o, p, comp } = f;
  if (o.rim <= 0) return;
  // hitMagic: the ink outline around the plumage burns water4 / white (light, never outlined)
  const src = p.clone();
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      if (src.get(x, y) !== PAL.ink) continue;
      let n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const id = comp.id[(y + dy) * W + x + dx];
        if (id === Part.body || id === Part.neck || id === Part.head || id === Part.wing) n++;
      }
      if (!n) continue;
      if (y % 2 === 0 || o.rim > 0.6) p.set(x, y, o.rim > 0.6 && (x + y) % 3 === 0 ? PAL.white : PAL.water4);
    }
}

function ruffle(f: Frame): void {
  const { o, p, comp } = f;
  if (!o.ruffle) return;
  // plumage ruffle: 2-px tufts lift off the back and neck edge (matter, before the outline)
  for (let x = 2; x < W - 2; x += 3) {
    for (let y = 2; y < H - 2; y++) {
      const id = comp.id[y * W + x];
      if (!p.isOpaque(x, y)) continue;
      if (id === Part.body || id === Part.wing || id === Part.neck) {
        if ((x + o.ruffle) % 2 === 0) {
          p.set(x, y - 1, id === Part.wing ? PAL.steel : PAL.mist);
          p.set(x + 1, y - 1, id === Part.wing ? PAL.steel : PAL.mist);
          if (o.ruffle === 2) p.set(x, y - 2, PAL.mist);
        }
      }
      break;
    }
  }
}

/** The summon: the heron as a dark shape inside the fog — lit plane night3, the rest night2 (the ink outline comes
 *  after); the eye glint is the only light on him, and the reveal to white is a value event. */
function silhouette(f: Frame): void {
  const { o, p, comp } = f;
  if (!o.sil) return;
  for (let i = 0; i < comp.id.length; i++) {
    if (!HERON.includes(comp.id[i])) continue;
    const x = i % W;
    const y = (i / W) | 0;
    const c = p.get(x, y);
    if (c === null) continue;
    p.set(x, y, c === PAL.white || c === PAL.earth4 || c === PAL.stone4 || c === PAL.gold3 ? PAL.night3 : PAL.night2);
  }
}

/** The death mist front: heron pixels under it step toward the mist (bottom up), and the edge band rolls. */
function coverPass(f: Frame): void {
  const { o, p, comp } = f;
  if (o.cover <= 0) return;
  const top = coverTop(o.cover);
  for (let y = top; y < H; y++)
    for (let x = 0; x < W; x++) {
      const id = comp.id[y * W + x];
      if (!HERON.includes(id)) continue;
      const c = p.get(x, y);
      if (c === null) continue;
      const depth = y - top;
      // the front edge is a 2×2 Bayer step (MA-4: partial cover, never alpha): the first 2 rows keep every other
      // 2×2 cell of the body as it was
      if (depth < 2 && ((x >> 1) + (y >> 1)) % 2 === 0) continue;
      if (depth > 8 + hash2(x >> 1, y >> 1, 7) * 4) {
        const g = f.ground?.get(x, y) ?? null;
        if (g === null) {
          p.erase(x, y);
          comp.id[y * W + x] = 0;
        } else {
          p.set(x, y, g);
          comp.id[y * W + x] = f.groundId![y * W + x];
        }
      } else {
        // flat fog volume, never the body's own stripes misted: a steel band under the front, night4 below it
        // (matter under fog has no detail)
        p.set(x, y, depth < 4 ? PAL.steel : PAL.night4);
      }
    }
}

function coverBands(f: Frame): void {
  const { o, p, sk } = f;
  if (o.cover <= 0) return;
  // the fog that swallows him: THREE wisps riding the cover line (reed_heron-mist.ts: 3–6 px stepped lenses — a
  // mist crest, a steel body, a night4 underside — frayed with 2×2 Bayer, ≥ 3 px of air between them). The front
  // wisp hugs the line, the two under it lean the other way; the whole stack climbs in 2-px steps with the line.
  // Under the stack the fog has already taken him: only the water and the reeds are left (coverPass). Near the top
  // the wisps thin to the far tone, narrow and drift apart left / right.
  const top = coverTop(o.cover);
  const off = 2 * rnd(o.cover * 4);
  const thin = o.cover > 0.9;
  const run = (y: number, x0: number, x1: number, c: number) => {
    for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) if (p.inBounds(x, y)) p.set(x, y, c);
  };
  // [dy under the front, height, half width, x offset, lean]
  const WISPS: [number, number, number, number, number][] = [
    [-3, 4, 15, -2, 1],
    [4, 5, 20, 3, -1],
    [12, 4, 23, -3, 1],
  ];
  WISPS.forEach(([dy, h, hw, dx, lean], i) => {
    // (the last frame keeps two thin far wisps: the bank is going, only the ground stays)
    if (thin && i === 2) return;
    // (never closer than 2 px to the frame's top edge: Sİ-2)
    const y = Math.max(2, top + dy);
    if (y > GY - 4) return;
    const dir = i % 2 ? 1 : -1;
    paintWisp(run, {
      cx: sk.B[0] - 3 + dx + dir * off,
      y,
      h: thin ? Math.max(3, h - 1) : h,
      hw: thin ? hw - 6 : hw,
      lean,
      seed: 41 + i * 7,
      tone: thin ? 2 : i === 0 ? 0 : 1,
      clip: [2, W - 3],
    });
  });
}

/** The death cover line (rises in whole 2-px steps: the fog climbs, it never slides). */
function coverTop(cover: number): number {
  return GY - 2 * rnd(cover * 33);
}

function moteLight(f: Frame): void {
  const { o, p, sk } = f;
  if (o.motes <= 0) return;
  // the head and beak tip break into mist motes that drift up and back (2-px runs, light)
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = hash2(i, 1, 9);
    const b = hash2(i, 2, 9);
    const x = rnd(sk.Hd[0] - 4 + a * 20 - o.motes * (3 + b * 6));
    const y = rnd(sk.Hd[1] - 1 + (b - 0.5) * 6 - o.motes * (4 + a * 8));
    const c = o.motes > 0.7 ? PAL.night4 : b > 0.5 ? PAL.mist : PAL.steel;
    if (o.motes > 0.9 && i % 2) continue;
    p.set(x, y, c);
    if (i % 3 !== 0) p.set(x + 1, y, c);
  }
}

// ---------------------------------------------------------------- main

export function drawHeron(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right'): void {
  const light = lightOf(lightFrom);
  const sk = skeleton(o);
  const comp = new Comp(p);
  const f: Frame = { p, comp, light, o, sk };

  if (o.pond) {
    const q = layer();
    drawPond(q, o, o.show && o.fl === 0 && o.cover < 0.15 ? rnd(sk.foot[0]) : null);
    comp.add(q, Part.pond, {});
  }
  if (o.pond) drawReeds(f, false);
  if (o.cover > 0) {
    f.ground = p.clone();
    f.groundId = comp.id.slice();
  }
  if (o.show) {
    drawFarWing(f);
    drawLegs(f);
    drawBody(f);
    drawNeck(f);
    drawHead(f);
    drawBeak(f);
    drawCloak(f);
    drawWing(f);
    ruffle(f);
  }
  silhouette(f);
  coverPass(f);
  if (o.pond) drawReeds(f, true);

  p.outline(PAL.ink);

  // light layer (never outlined)
  if (o.show) {
    if (o.cover < 0.85) plumes(f);
    if (o.cover < 0.8 && !o.sil) {
      eyeLight(f);
      beakGlint(f);
    }
    if (!o.sil) needleLight(f);
    strikeLight(f);
    rimLight(f);
  }
  moonStreak(f);
  dropLight(f);
  trailLight(f);
  dotLight(f);
  mistLight(f);
  coverBands(f);
  moteLight(f);
  glintLight(f);
}
