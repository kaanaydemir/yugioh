// Mühürlü Baş (seal_head) v3 — "the Gaze" rig: Pose → pixels.
//
// A severed obsidian colossus head floating in three-quarter view, facing right: a flat slab brow with a stepped
// three-fin crest down the back, ONE huge open eye socket (the seal's eye, magenta), a broad nose slab, a lower jaw
// hanging ajar on two bronze straps that carry a chain loop, a bronze-ringed glyph disc on the forehead, a broken neck
// stump leaking seal light with three loose chains below, and three basalt shards orbiting it.
//
// Everything is drawn from polygons in the head's LOCAL space (origin = skull centre) through one transform T (offset,
// tilt about the neck, jaw rotation about the hinge): flat value planes (lit band toward the key light, shade band
// away), 1-px creases between slabs, bronze as the only warm colour, the seal glow (mag ramp) as the only emissive.
// One key light from the screen's top-left ('left' = P1, 'right' = the P2 relight sheet; flipX makes it top-left again).
// Light (eye lens, disc glyph, seam, sparks, motes, rings) is painted after the ink outline and never outlined (IŞ-9).
// Frame 96×92, 1 art px = 1 game px; the floor anchor is (48, 84) and the head hovers above it.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { lightOf, run, type Light } from '../rigkit';
import { BRONZE, Comp, MAG, OBS, OBS_FAR, bands, clamp, layer as kitLayer, lerp, planes, spline, type Pt, type Tones } from './seal_head-kit';

const kitRelease = (_q: PixelCanvas): void => {};

export const W = 100;
export const H = 94;
export const AX = 50;
export const AY = 86;
/** Skull centre at rest. */
export const OX = 50;
export const OY = 38;
/** Neck pivot (local): the head tilts about it; the jaw hinge (local). */
const NECK: Pt = [-12, 16];
const HINGE: Pt = [-8, 15];

const DEG = Math.PI / 180;
const rnd = Math.round;
const sin = Math.sin;
const cos = Math.cos;

// ---------------------------------------------------------------- pose

export interface Pose {
  /** skull offset (whole px) */
  dx: number;
  dy: number;
  /** head tilt in degrees (+ = chin up / back) and jaw opening in degrees (rest 6, slam 0) */
  rot: number;
  jaw: number;
  /** near eye level 0…4 (mag ramp; 0 = socket dark) and how open the socket glow is 0…1 (point → full) */
  eye: number;
  eyeOpen: number;
  /** far socket slit 0…2, forehead disc glow 0…4, neck seam glow 0…4 */
  far: number;
  disc: number;
  seam: number;
  /** chains: sway phase 0…1 (loose chains), sway amplitude px, tautness 0…1 (straight), hood 0…1 (crossed over the eye) */
  chT: number;
  chA: number;
  taut: number;
  hood: number;
  /** how many chains exist: 0…3 loose chains, 4 = and the loop under the jaw (revive re-links them one by one) */
  nch: number;
  /** a link clinks (hops 1 px) 0…1 */
  clink: number;
  /** strap state: 0 on, 1 creaking (taut, shifted 1 px), 2 snapped, 3 re-linked flash */
  strap: number;
  /** shards: orbit angles (deg) and orbit radius scale ×100, shell 0…1 (the guard shell in front) */
  s1: number;
  s2: number;
  s3: number;
  sr: number;
  shell: number;
  /** brow crack 0…1, a chunk dropped 0…1 (hitHeavy) */
  crack: number;
  chunk: number;
  /** plates flash negative bands 0…1 (hitMagic), glyph lines scattered outward 0…1 */
  flash: number;
  scatter: number;
  /** death / revive: slabs split apart 0…1 */
  split: number;
  /** summon / revive: rows from this y down are cut off (the floor crack; 0 = none), floor crack glow 0…3, chains rising out of the crack 0…1 */
  clip: number;
  crackF: number;
  riser: number;
  /** stepped iso rings leaving the forehead disc: their ages (0 = just born) */
  rings: readonly number[];
  /** motes (seal light leaking up): 0…1 amount, phase 0…1, source x / y (frame px; 0 = the neck seam) */
  motes: number;
  moteT: number;
  mx: number;
  my: number;
  /** a glint on the lit edge 0 / 1 / 2 (stone4 cross), sparks (void4) amount 0…1 at the strap */
  glint: number;
  sparks: number;
  /** one-shot phase 0…1 (loop seams) */
  t: number;
}

export const NEUTRAL: Pose = {
  dx: 0,
  dy: 0,
  rot: 0,
  jaw: 12,
  eye: 3,
  eyeOpen: 1,
  far: 1,
  disc: 3,
  seam: 3,
  chT: 0,
  chA: 1.5,
  taut: 0,
  hood: 0,
  nch: 4,
  clink: 0,
  strap: 0,
  s1: 20,
  s2: 140,
  s3: 250,
  sr: 100,
  shell: 0,
  crack: 0,
  chunk: 0,
  flash: 0,
  scatter: 0,
  split: 0,
  clip: 0,
  crackF: 0,
  riser: 0,
  rings: [],
  motes: 0,
  moteT: 0,
  mx: 0,
  my: 0,
  glint: 0,
  sparks: 0,
  t: 0,
};
export const pose = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

// ---------------------------------------------------------------- effects

const inFrame = (x: number, y: number) => x >= 2 && x <= CW - 3 && y >= 2 && y <= CH - 3;

/** stepped iso rings (2:1 diamonds) leaving the forehead disc */
function ringsFx(f: Frame): void {
  const { o } = f;
  if (!o.rings.length) return;
  f.after.push((p) => {
    const c = T(f, DISC[0], DISC[1]);
    for (const age of o.rings) {
      const r = Math.round((5 + age * 4) * f.k);
      const col = age <= 1 ? MAG[3] : age <= 3 ? MAG[2] : MAG[1];
      for (let dy = -r; dy <= r; dy++) {
        const dx = 2 * (r - Math.abs(dy));
        for (const sx of [-1, 1]) {
          for (const k of [0, 1]) {
            const x = c[0] + sx * (dx - k);
            const y = c[1] + dy;
            if (inFrame(x, y)) p.set(x, y, col);
          }
        }
      }
    }
  });
}

/** motes of seal light rising off the neck seam (or off the slabs): deterministic, ≤ 12 px */
function motesFx(f: Frame): void {
  const { o } = f;
  if (o.motes <= 0) return;
  f.after.push((p) => {
    const n = Math.min(12, rnd(o.motes * 12));
    const sx = o.mx || T(f, -9, 26)[0];
    const sy = o.my || T(f, -9, 26)[1];
    for (let i = 0; i < n; i++) {
      const life = (o.moteT * 24 + i * 5.3) % 24;
      const x = rnd(sx - 10 + ((i * 7) % 21) + 2 * sin(life * 0.5 + i));
      const y = rnd(sy - life);
      const col = life < 8 ? MAG[3] : life < 16 ? MAG[2] : MAG[1];
      if (inFrame(x, y)) p.set(x, y, col);
    }
  });
}

/** the floor crack the head rises out of: jagged iso lines on the floor diamond, glowing by level */
function floorCrack(f: Frame): void {
  const { o } = f;
  if (o.crackF <= 0) return;
  f.after.push((p) => {
    const lvl = clamp(rnd(o.crackF), 1, 3);
    const sh = (a: Pt[]): Pt[] => a.map(([x, y]) => [x + 2, y + 2] as Pt);
    const line: Pt[] = sh([[30, 84], [34, 82], [38, 84], [43, 82], [48, 85], [53, 83], [58, 85], [62, 82], [66, 84]]);
    const line2: Pt[] = sh([[40, 87], [44, 86], [49, 88], [55, 86], [60, 87]]);
    const draw = (pts: Pt[], col: number) => {
      for (let i = 0; i < pts.length - 1; i++) p.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], col);
    };
    draw(line2, MAG[Math.max(0, lvl - 2)]);
    draw(line, MAG[lvl]);
    if (lvl >= 2) {
      p.line(40, 86, 38, 88, MAG[1]);
      p.line(55, 85, 57, 88, MAG[1]);
      p.line(64, 84, 68, 81, MAG[1]);
    }
    if (lvl >= 3) {
      p.line(45, 84, 43, 80, MAG[2]);
      p.line(60, 87, 61, 89, MAG[2]);
    }
  });
}

/** chains slithering up out of the crack (summon) */
function risers(f: Frame): void {
  const { o } = f;
  if (o.riser <= 0) return;
  const base: Pt[] = [[42, 85], [51, 87], [60, 85]];
  const hMax = [34, 44, 38];
  base.forEach(([bx, by], i) => {
    const h = hMax[i] * o.riser;
    const pts: Pt[] = [];
    for (let k = 0; k <= 4; k++) {
      const u = k / 4;
      pts.push([bx + 3 * sin(o.chT * 6.28 + u * 3 + i * 2) * u + (i - 1) * 3 * u, by - h * u]);
    }
    paintChain(f, spline(pts, 3), 3, i);
  });
}

/** the pixel slabs of a breaking head: back (crown, fins, stump), face, jaw; each drops and slides by `split` */
function splitSlabs(f: Frame): void {
  const { o, p, comp } = f;
  if (o.split <= 0) return;
  const W_ = p.w;
  const src = p.clone();
  const ids = comp.id.slice();
  p.clear();
  comp.id.fill(0);
  const dst = (id: number, xl: number, yl: number): number => {
    if (id === Part.cavity) return -1;
    if (id === Part.jaw || id === Part.teethLo) return 2;
    if (id === Part.strap) return yl > 18 ? 2 : xl < 10 ? 0 : 1;
    if (id === Part.chain || id === Part.shardFar || id === Part.shardNear) return xl < 10 ? 0 : 2;
    if (id === Part.stump || id === Part.fins) return 0;
    // the break: a jagged diagonal from the brow's front to the back of the jaw hinge
    const cut = -8 - 0.675 * (xl - 30) + (((xl + 40) >> 1) % 2 ? 1 : -1);
    return yl < cut ? 0 : 1;
  };
  const OFF: Pt[] = [
    [-9, 9],
    [4, 10],
    [8, 0],
  ];
  const t = o.split;
  // draw lowest-priority first: jaw, face, back
  for (const slab of [2, 1, 0]) {
    const [ox_, oy_] = OFF[slab];
    const mx = rnd(ox_ * t);
    const my = rnd(oy_ * t);
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < W_; x++) {
        if (!src.isOpaque(x, y)) continue;
        const id = ids[y * W_ + x];
        if (dst(id, x - f.ox, y - f.oy) !== slab) continue;
        const c = src.get(x, y)!;
        p.set(x + mx, y + my, c);
        comp.id[(y + my) * W_ + (x + mx)] = id;
      }
  }
}

/** the floor crack's cut: everything from `clip` down is under the floor */
function clipFloor(f: Frame): void {
  const { o, p } = f;
  if (o.clip <= 0) return;
  for (let y = o.clip; y < p.h; y++) for (let x = 0; x < p.w; x++) p.erase(x, y);
}

/** a hitMagic overload: diagonal negative bands on the stone (void1 / void2) */
function flashBands(f: Frame): void {
  const { o, p, comp } = f;
  if (o.flash <= 0) return;
  const shift = rnd(o.flash * 9);
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (!p.isOpaque(x, y)) continue;
      const id = comp.id[y * p.w + x];
      if (id !== Part.skull && id !== Part.plate && id !== Part.jaw && id !== Part.fins) continue;
      if (((x + y * 2 + shift) % 11) >= 4) continue;
      const c = p.get(x, y);
      if (c === OBS.S) p.set(x, y, PAL.void2);
      else if (c === OBS.M) p.set(x, y, PAL.void1);
      else if (c === OBS.L || c === OBS.E) p.set(x, y, PAL.void0);
    }
}

/** a chunk of the brow dropping (hitHeavy) */
function chunkFx(f: Frame): void {
  const { o } = f;
  if (o.chunk <= 0) return;
  const c = T(f, 30, -12);
  drawShard(f, c[0] + o.chunk * 9, c[1] + o.chunk * o.chunk * 40 + o.chunk * 6, 4, 2, true, Part.chunk);
}

/** the single glint of an anim: a stone4 cross on the lit corner of the crown */
function glintFx(f: Frame): void {
  const { o } = f;
  if (!o.glint) return;
  f.after.push((p) => {
    const c = T(f, f.light.side < 0 ? -17 : 25, -21);
    p.set(c[0], c[1], PAL.stone4);
    if (o.glint >= 2) {
      p.set(c[0] - 1, c[1], PAL.stone4);
      p.set(c[0] + 1, c[1], PAL.stone4);
      p.set(c[0], c[1] - 1, PAL.stone4);
      p.set(c[0], c[1] + 1, PAL.stone4);
    }
  });
}

/** two void4 sparks and loose link pieces where the strap snaps */
function sparksFx(f: Frame): void {
  const { o } = f;
  if (o.sparks <= 0) return;
  f.after.push((p) => {
    const c = T(f, 30, 20);
    const pts: Pt[] = [[2, -4], [-3, -2], [5, 2], [1, 6]];
    pts.slice(0, o.sparks >= 0.7 ? 4 : 2).forEach(([x, y]) => p.set(c[0] + x * (o.sparks >= 0.7 ? 1 : 0.6), c[1] + y, PAL.void4));
  });
}

// ---------------------------------------------------------------- frame

interface Frame {
  p: PixelCanvas;
  comp: Comp;
  light: Light;
  o: Pose;
  /** head origin in the frame (after offset) */
  ox: number;
  oy: number;
  /** tilt (rad, screen: + = clockwise) and the drawing scale (1 for the sprite; the cut-in redraws the head at ~3×) */
  th: number;
  k: number;
  after: ((p: PixelCanvas) => void)[];
}

const enum Part {
  none = 0,
  chainFar,
  shardFar,
  fins,
  stump,
  jaw,
  skull,
  plate,
  strap,
  disc,
  teeth,
  teethLo,
  cavity,
  chain,
  shardNear,
  chunk,
}

let CW = W;
let CH = H;
const layer = () => kitLayer(CW, CH);

/** local → frame (head tilt about the neck, then offset), rounded to whole pixels */
function T(f: Frame, x: number, y: number): Pt {
  const k = f.k;
  if (f.th === 0) return [rnd(f.ox + x * k), rnd(f.oy + y * k)];
  const c = cos(f.th);
  const s = sin(f.th);
  const rx = (x - NECK[0]) * k;
  const ry = (y - NECK[1]) * k;
  return [rnd(f.ox + NECK[0] * k + rx * c - ry * s), rnd(f.oy + NECK[1] * k + rx * s + ry * c)];
}
/** local → frame for a jaw point: jaw rotation about the hinge first (degrees), then T */
function TJ(f: Frame, x: number, y: number): Pt {
  const a = f.o.jaw * DEG;
  const c = cos(a);
  const s = sin(a);
  const rx = x - HINGE[0];
  const ry = y - HINGE[1];
  return T(f, HINGE[0] + rx * c - ry * s, HINGE[1] + rx * s + ry * c);
}
const mapPts = (f: Frame, pts: readonly Pt[], jaw = false): Pt[] => pts.map(([x, y]) => (jaw ? TJ(f, x, y) : T(f, x, y)));

/** fill a local polygon on a fresh layer */
function polyLayer(f: Frame, pts: readonly Pt[], c: number, jaw = false): PixelCanvas {
  const q = layer();
  q.poly(mapPts(f, pts, jaw), c);
  return q;
}

/** 1-px edge runs (the light-facing corner of a big plate): at most 4 px long */
function edgeRuns(q: PixelCanvas, t: Tones, light: Light, len = 3): void {
  const ls = light.side;
  planes(q, (x, y, src) => {
    const top = run(src, x, y, 0, -1, 2) === 0;
    const side = run(src, x, y, ls, 0, 2) === 0;
    if (top && run(src, x, y, ls, 0, len + 1) < len) return t.E;
    if (side && run(src, x, y, 0, -1, len + 1) < len) return t.E;
    return null;
  });
}

// ---------------------------------------------------------------- local geometry (origin = skull centre, +x forward)

const SKULL: Pt[] = [
  [-22, 14], [-26, 6], [-27, -6], [-22, -16], [-12, -22], [4, -25], [18, -23], [27, -18], [31, -14], [35, -11], [35, -7], [30, -6], [30, -2], [35, 4], [34, 9],
  [31, 10], [33, 14], [31, 18], [10, 19], [-6, 20], [-16, 19],
];
const CROWN: Pt[] = [[-22, -16], [-12, -22], [4, -25], [18, -23], [27, -18], [31, -14], [22, -12], [2, -13], [-14, -12]];
const BROW: Pt[] = [[-6, -13], [14, -15], [31, -14], [35, -11], [35, -7], [30, -6], [14, -8], [-4, -7]];
const BROW_SHADE: Pt[] = [[-5, -7], [14, -8], [30, -6], [31, -3], [14, -4], [-4, -2]];
const OCCIPUT: Pt[] = [[-26, 6], [-27, -6], [-22, -16], [-16, -14], [-15, 0], [-17, 12], [-22, 14]];
const CHEEK: Pt[] = [[-4, 2], [13, 0], [17, 8], [12, 18], [-6, 19]];
const NOSE: Pt[] = [[15, -8], [22, -8], [30, -2], [35, 4], [34, 9], [31, 10], [22, 11], [16, 7]];
const MUZZLE: Pt[] = [[18, 9], [31, 10], [33, 14], [31, 18], [14, 18]];
const EYE_SOCKET: Pt[] = [[-2, -10], [3, -11], [10, -10], [15, -6], [15, -4], [12, -1], [5, -1], [-1, -3], [-3, -6]];
const FAR_SLIT: Pt[] = [[27, -5], [32, -5], [32, -3], [28, -3]];
const JAW: Pt[] = [[-16, 18], [-6, 19], [10, 19], [28, 19], [34, 19], [35, 25], [33, 30], [26, 33], [10, 34], [-4, 32], [-14, 27]];
const CAVITY: Pt[] = [[-8, 17], [32, 17], [34, 26], [-6, 26]];
const STUMP: Pt[] = [
  [-23, 8], [5, 8], [6, 21], [4, 27], [2, 26], [0, 32], [-3, 28], [-6, 34], [-9, 29], [-12, 33], [-15, 28], [-18, 31], [-23, 25],
];
const FINS: Pt[][] = [
  [[-27, -11], [-27, -19], [-23, -24], [-19, -24], [-19, -14]],
  [[-19, -16], [-19, -27], [-14, -30], [-10, -30], [-10, -19]],
  [[-10, -20], [-10, -26], [-6, -28], [-2, -28], [-2, -21]],
];
/** disc centre (local) */
const DISC: Pt = [5, -17];

// ---------------------------------------------------------------- glyph

/** HEAD glyph, 5×5: ring + eye dot */
const GLYPH_HEAD = ['.###.', '#...#', '#.#.#', '#...#', '.###.'];

/** tone sets of the planes that face away from the light (the face front: nose, muzzle, jaw front) */
const OBS_FACE: Tones = { E: PAL.stone2, L: PAL.stone1, M: PAL.stone0, S: PAL.stone0, D: PAL.void0 };

// ---------------------------------------------------------------- parts

function paintFins(f: Frame): void {
  const { light } = f;
  FINS.forEach((fin, i) => {
    const q = polyLayer(f, fin, OBS.M);
    bands(q, OBS, light, 2, 2, { top: 1, bottom: 1 });
    if (i < 2) edgeRuns(q, OBS, light, 3);
    f.comp.add(q, Part.fins, { out: OBS.D });
  });
}

function paintStump(f: Frame): void {
  const q = polyLayer(f, STUMP, OBS_FAR.M);
  bands(q, OBS_FAR, f.light, 2, 3, { top: 1, bottom: 2 });
  f.comp.add(q, Part.stump);
}

function paintCavity(f: Frame): void {
  // the mouth: dark inside, a wedge of void between the lips
  const q = layer();
  q.poly(mapPts(f, CAVITY.slice(0, 2)).concat(mapPts(f, CAVITY.slice(2), true)), PAL.ink);
  f.comp.add(q, Part.cavity);
}

function paintJaw(f: Frame): void {
  const q = polyLayer(f, JAW, OBS.M, true);
  bands(q, OBS, f.light, 2, 3, { top: 1, bottom: 2 });
  // front of the jaw faces away from the light: a shadow plane at the chin
  const k = layer();
  k.poly(mapPts(f, [[20, 18], [33, 18], [33, 23], [31, 28], [25, 31], [20, 31]], true), OBS_FACE.M);
  bands(k, OBS_FACE, f.light, 1, 2, { top: 1, bottom: 1 });
  f.comp.add(q, Part.jaw, { out: PAL.ink });
  f.comp.add(k, Part.jaw, { in: OBS.D });
}

function paintSkull(f: Frame): void {
  const { light } = f;
  // the block (near side of the head: mid plane)
  const q = polyLayer(f, SKULL, OBS.M);
  bands(q, OBS, light, 3, 3, { top: 2, bottom: 3 });
  f.comp.add(q, Part.skull);
  // plates, each with its own flat bands and a crease where it overlaps
  const plate = (pts: Pt[], t: Tones, lw: number, sw: number, o: { top?: number; bottom?: number; edge?: boolean } = {}) => {
    const k = polyLayer(f, pts, t.M);
    bands(k, t, light, lw, sw, { top: o.top ?? 1, bottom: o.bottom ?? 1 });
    if (o.edge) edgeRuns(k, t, light, 3);
    f.comp.add(k, Part.plate, { in: t.D });
  };
  plate(OCCIPUT, OBS, 4, 2, { top: 2, bottom: 1, edge: true });
  plate(CROWN, OBS, 5, 1, { top: 4, bottom: 1, edge: true });
  plate(CHEEK, OBS, 2, 2, { top: 2, bottom: 2 });
  plate(MUZZLE, OBS_FACE, 2, 2, { top: 1, bottom: 1 });
  plate(NOSE, OBS_FACE, 3, 2, { top: 2, bottom: 2 });
  plate(BROW, OBS, 3, 3, { top: 3, bottom: 3, edge: true });
  // the overhang's shadow over the eye
  const sh = polyLayer(f, BROW_SHADE, OBS_FACE.M);
  f.comp.add(sh, Part.plate);
}

function paintSockets(f: Frame): void {
  const q = polyLayer(f, EYE_SOCKET, PAL.void0);
  f.comp.add(q, Part.plate, { in: PAL.ink });
  const s = polyLayer(f, FAR_SLIT, PAL.void0);
  f.comp.add(s, Part.plate, { in: PAL.ink });
  // nostril notch
  const n = layer();
  const c = T(f, 28, 7);
  n.rect(c[0], c[1], 2, 2, PAL.void0);
  f.comp.add(n, Part.plate);
}

/** a bronze strap band (local polygon) with its own planes, rivets and a lit top edge */
function paintStrapBand(f: Frame, pts: Pt[], jaw: boolean, rivet?: Pt): void {
  const q = polyLayer(f, pts, BRONZE.M, jaw);
  bands(q, BRONZE, f.light, 1, 1, { top: 1, bottom: 1 });
  f.comp.add(q, Part.strap, { in: BRONZE.D });
  if (rivet) {
    const r = jaw ? TJ(f, rivet[0], rivet[1]) : T(f, rivet[0], rivet[1]);
    f.after.push((p) => {
      if (p.isOpaque(r[0], r[1])) p.set(r[0], r[1], PAL.gold3);
    });
  }
}

function strapQuad(f: Frame, x0: number, x1: number, creak: number): Pt[] {
  // one band from the skull (y 7) across the mouth gap to the jaw's underside (y 31): it follows the jaw's opening
  const a = T(f, x0, 7);
  const b = T(f, x1, 7);
  const c = TJ(f, x1 - creak, 31);
  const d = TJ(f, x0 - creak, 31);
  return [a, b, c, d];
}
function paintStraps(f: Frame): void {
  const { o } = f;
  const creak = o.strap === 1 ? 1 : 0;
  const tone: Tones = o.strap === 3 ? { E: PAL.gold4, L: PAL.gold4, M: PAL.gold3, S: PAL.gold2, D: PAL.gold1 } : BRONZE;
  const bandPoly = (pts: Pt[]) => {
    const q = layer();
    q.poly(pts, tone.M);
    bands(q, tone, f.light, 1, 1, { top: 1, bottom: 1 });
    f.comp.add(q, Part.strap, { in: tone.D });
  };
  bandPoly(strapQuad(f, -7, -2, creak));
  const rv = (x: number, y: number, jaw = false) => {
    const r = jaw ? TJ(f, x, y) : T(f, x, y);
    f.after.push((p) => {
      if (p.isOpaque(r[0], r[1])) p.set(r[0], r[1], PAL.gold4);
    });
  };
  if (o.strap !== 2) {
    bandPoly(strapQuad(f, 27, 32, creak));
  } else {
    // snapped: the muzzle strap hangs from the skull only, its jaw half is a stub
    bandPoly([T(f, 27, 9), T(f, 32, 9), T(f, 32, 15), T(f, 30, 18), T(f, 28, 15), T(f, 27, 17)]);
    bandPoly([TJ(f, 27, 26), TJ(f, 32, 26), TJ(f, 32, 31), TJ(f, 27, 31)]);
  }
  void rv;
}

function paintDisc(f: Frame): void {
  const [cx, cy] = DISC;
  const c = T(f, cx, cy);
  const q = layer();
  const ls = f.light.side;
  const R = Math.ceil(4.6 * f.k);
  for (let y = -R; y <= R; y++)
    for (let x = -R; x <= R; x++) {
      const d = Math.hypot(x, y) / f.k;
      if (d > 4.55) continue;
      let col: number = PAL.void0;
      if (d > 3.3) {
        const k = (x * -ls + y) / (Math.max(1, d)); // < 0: toward the light (top-left for P1)
        col = k < -0.45 ? BRONZE.L : k > 0.45 ? BRONZE.S : BRONZE.M;
        if (d > 4.2 && k > 0.2) col = BRONZE.D;
      }
      q.set(c[0] + x, c[1] + y, col);
    }
  f.comp.add(q, Part.disc);
}

const TOOTH: Tones = { E: PAL.stone4, L: PAL.stone3, M: PAL.stone3, S: PAL.stone2, D: PAL.stone0 };
function paintTeeth(f: Frame): void {
  // upper teeth under the lip (blocks, 4 px tall) and a few lower teeth rising from the jaw at the front
  for (let i = 0; i < 5; i++) {
    const x = 5 + i * 5.2;
    const q = layer();
    q.poly(mapPts(f, [[x, 18], [x + 3.8, 18], [x + 3.8, 22.5], [x + 1.9, 23.8], [x, 22.5]]), TOOTH.M);
    bands(q, TOOTH, f.light, 1, 1, { top: 1, bottom: 1 });
    f.comp.add(q, Part.teeth, { in: TOOTH.D });
  }
  for (let i = 0; i < 3; i++) {
    const x = 13 + i * 6;
    const q = layer();
    q.poly(mapPts(f, [[x, 27], [x + 3.6, 27], [x + 3.6, 24.4], [x + 1.8, 23], [x, 24.4]], true), TOOTH.M);
    bands(q, TOOTH, f.light, 1, 1, { top: 1, bottom: 1 });
    f.comp.add(q, Part.teethLo, { in: TOOTH.D });
  }
}

// ---------------------------------------------------------------- chains

/** a chain along a polyline: links every `step` px of arc length, alternating face-on ovals and edge-on bars */
function paintChain(f: Frame, path: readonly Pt[], step = 3, parity = 0): void {
  const q = layer();
  let acc = 0;
  let k = parity;
  let next = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const vert = Math.abs(b[1] - a[1]) >= Math.abs(b[0] - a[0]);
    while (next <= acc + L) {
      const u = L > 0 ? (next - acc) / L : 0;
      const x = rnd(lerp(a[0], b[0], u));
      const y = rnd(lerp(a[1], b[1], u));
      if (k % 2 === 0) {
        // face-on oval: 3 × 4 ring (4 × 3 when the chain runs sideways), a dark hole
        if (vert) {
          q.set(x, y - 1, PAL.gold3);
          q.set(x - 1, y, PAL.gold3);
          q.set(x + 1, y, PAL.gold2);
          q.set(x - 1, y + 1, PAL.gold2);
          q.set(x + 1, y + 1, PAL.gold1);
          q.set(x, y + 2, PAL.gold1);
        } else {
          q.set(x - 1, y - 1, PAL.gold3);
          q.set(x, y - 1, PAL.gold3);
          q.set(x - 1, y + 1, PAL.gold2);
          q.set(x, y + 1, PAL.gold1);
          q.set(x - 2, y, PAL.gold2);
          q.set(x + 1, y, PAL.gold1);
        }
      } else if (vert) {
        q.set(x, y - 1, PAL.gold2);
        q.set(x, y, PAL.gold2);
        q.set(x, y + 1, PAL.gold1);
      } else {
        q.set(x - 1, y, PAL.gold3);
        q.set(x, y, PAL.gold2);
        q.set(x + 1, y, PAL.gold1);
      }
      k++;
      next += step;
    }
    acc += L;
  }
  f.comp.add(q, Part.chain, { out: PAL.ink });
}

const ANCHOR: Pt[] = [[-20, 28], [-14, 31], [-9, 32]];
const LEN = [10, 13, 11];
/** loose chain from the stump: hanging path vs hooded path, blended */
function chainPath(f: Frame, i: number): Pt[] {
  const { o } = f;
  const a = ANCHOR[i];
  const ph = (o.chT + i * 0.31) * Math.PI * 2;
  const sw = o.chA * (1 - o.taut);
  const hang: Pt[] = [
    [a[0], a[1]],
    [a[0] + sw * 0.3 * sin(ph), a[1] + LEN[i] * 0.33],
    [a[0] + sw * 0.7 * sin(ph - 0.7), a[1] + LEN[i] * 0.66],
    [a[0] + sw * sin(ph - 1.4), a[1] + LEN[i]],
  ];
  if (i === 1 && o.clink > 0) hang[2] = [hang[2][0], hang[2][1] - 1];
  if (o.hood <= 0) return mapPts(f, spline(hang, 4));
  // hooded: arcs from the stump up the face, crossing the eye socket
  const H0: Pt[][] = [
    [[-20, 28], [-26, 8], [-8, -8], [13, -6]],
    [[-14, 31], [-20, 12], [3, 3], [21, -11]],
    [[-9, 32], [-12, 14], [9, 5], [27, 0]],
  ];
  const h = H0[i];
  const mixed = hang.map((pt, k) => [lerp(pt[0], h[k][0], o.hood), lerp(pt[1], h[k][1], o.hood)] as Pt);
  return mapPts(f, spline(mixed, 4));
}

/** the chain loop under the jaw between the two straps (an end may be free after the snap) */
function loopPath(f: Frame): Pt[] {
  const { o } = f;
  const sag = 8 - 5 * o.taut;
  const ph = sin((o.chT + 0.2) * Math.PI * 2);
  const pts: Pt[] = [[-4.5, 32], [2, 32 + sag * 0.9], [12, 32 + sag + ph * 0.8], [22, 32 + sag * 0.9], [29.5, 32]];
  if (o.strap === 2) {
    // free end: the muzzle side drops
    const free: Pt[] = [[-4.5, 32], [0, 32 + sag], [4, 32 + sag + 3 + ph], [6, 32 + sag + 8 + ph]];
    return mapPts(f, spline(free, 4), true);
  }
  return mapPts(f, spline(pts, 4), true);
}

// ---------------------------------------------------------------- shards

function shardPts(seed: number, sz: number): Pt[] {
  return seed === 0
    ? [[0, -sz], [sz * 0.8, -sz * 0.2], [sz * 0.5, sz * 0.9], [-sz * 0.7, sz * 0.6], [-sz * 0.8, -sz * 0.3]]
    : seed === 1
      ? [[-sz * 0.2, -sz], [sz, sz * 0.1], [sz * 0.2, sz], [-sz, sz * 0.4]]
      : [[0, -sz * 0.9], [sz * 0.9, -sz * 0.3], [sz * 0.7, sz * 0.8], [-sz * 0.3, sz], [-sz * 0.9, sz * 0.1]];
}
function drawShard(f: Frame, cx: number, cy: number, size: number, seed: number, near: boolean, part: number = near ? Part.shardNear : Part.shardFar): void {
  const q = layer();
  q.poly(shardPts(seed, size).map(([x, y]) => [rnd(cx + x), rnd(cy + y)] as Pt), OBS.M);
  bands(q, OBS, f.light, 1, 1, { top: 1, bottom: 1 });
  if (size >= 3.5) edgeRuns(q, OBS, f.light, 2);
  f.comp.add(q, part, { out: near ? PAL.ink : undefined });
}
const SHARDS: readonly { rx: number; ry: number; size: number; seed: number; slot: Pt }[] = [
  { rx: 34, ry: 20, size: 4, seed: 0, slot: [37, -14] },
  { rx: 30, ry: 22, size: 3, seed: 1, slot: [40, 4] },
  { rx: 36, ry: 18, size: 3, seed: 2, slot: [35, 22] },
];
/** the three shards: iso orbits round the head (angle deg: 0 = right, 90 = in front / below), or the guard shell's slots in front of the face */
function paintShards(f: Frame, want: 'near' | 'far'): void {
  const { o } = f;
  const ang = [o.s1, o.s2, o.s3];
  const rs = o.sr / 100;
  SHARDS.forEach((sh, i) => {
    const a = ang[i] * DEG;
    const wob = (o.s1 + i * 90) * DEG;
    const ox_ = f.ox + (1 + sh.rx * rs * cos(a)) * f.k;
    const oy_ = f.oy + (2 + sh.ry * rs * sin(a)) * f.k;
    const sx = f.ox + (sh.slot[0] + 2 * sin(wob)) * f.k;
    const sy = f.oy + (sh.slot[1] + 2 * cos(wob)) * f.k;
    const cx = lerp(ox_, sx, o.shell);
    const cy = lerp(oy_, sy, o.shell);
    const isNear = o.shell > 0.5 || sin(a) >= 0;
    if ((want === 'near') !== isNear) return;
    drawShard(f, cx, cy, sh.size * f.k, sh.seed, isNear);
  });
}

// ---------------------------------------------------------------- spill of the seal light on the stone, cracks

/** a flat 1–2 px violet band on stone within reach of a lit glyph: void1 on the shadow side, void2 toward the light */
function spill(f: Frame): void {
  const { o, p, comp, light } = f;
  const stone = (c: number | null) => c === OBS.S || c === OBS.M || c === OBS.L || c === OBS_FAR.M;
  const ring = (cx: number, cy: number, r0: number, r1: number, sx: number) => {
    for (let y = Math.floor(cy - r1); y <= Math.ceil(cy + r1); y++)
      for (let x = Math.floor(cx - r1 * sx); x <= Math.ceil(cx + r1 * sx); x++) {
        const d = Math.hypot((x - cx) / sx, y - cy);
        if (d < r0 || d > r1 || !p.isOpaque(x, y)) continue;
        const id = comp.id[y * p.w + x];
        if (id === Part.strap || id === Part.disc || id === Part.chain) continue;
        const c = p.get(x, y);
        if (!stone(c)) continue;
        const towardLight = (x - cx) * light.side < 0 || y < cy - 1;
        p.set(x, y, towardLight && c !== OBS.S ? PAL.void2 : PAL.void1);
      }
  };
  if (o.eye >= 2) {
    const c = T(f, 8, -5);
    ring(c[0], c[1], 8.2 * f.k, 9.6 * f.k, 1.35);
  }
  if (o.disc >= 2) {
    const c = T(f, DISC[0], DISC[1]);
    ring(c[0], c[1], 5.6 * f.k, 6.8 * f.k, 1);
  }
}

/** hairline cracks in the stone (void0), and the brow crack of a heavy blow */
function cracks(f: Frame): void {
  const { o } = f;
  const line = (pts: Pt[]) => {
    const q = layer();
    q.polyline(mapPts(f, pts), PAL.void0);
    // only on the stone: keep the cut inside the body
    const { p, comp } = f;
    const b: number[] = [];
    for (let y = 0; y < q.h; y++)
      for (let x = 0; x < q.w; x++) if (q.isOpaque(x, y) && p.isOpaque(x, y) && (comp.id[y * p.w + x] === Part.skull || comp.id[y * p.w + x] === Part.plate)) b.push(x, y);
    for (let i = 0; i < b.length; i += 2) p.set(b[i], b[i + 1], PAL.void0);
    q.clear();
    kitRelease(q);
  };
  line([[-20, -2], [-17, 1], [-18, 5], [-14, 8]]);
  line([[8, 9], [10, 12], [9, 15]]);
  if (o.crack > 0) {
    const n = o.crack >= 0.6 ? 4 : 2;
    const full: Pt[] = [[2, -23], [4, -19], [3, -15], [7, -12], [8, -8], [6, -4]];
    const pts = full.slice(0, 2 + n);
    line(pts);
    if (o.crack >= 0.6) line([[4, -19], [10, -17], [13, -19]]);
  }
}

/** the jaw hinge: a round bronze stud with a dim seal dot */
function paintHinge(f: Frame): void {
  const c = T(f, -9, 14);
  const q = layer();
  for (let y = -3; y <= 3; y++)
    for (let x = -3; x <= 3; x++) {
      const d = Math.hypot(x, y);
      if (d > 3.2) continue;
      const k = (x * -f.light.side + y) / Math.max(1, d);
      q.set(c[0] + x, c[1] + y, d > 2.2 ? (k < -0.4 ? BRONZE.L : k > 0.4 ? BRONZE.D : BRONZE.M) : BRONZE.S);
    }
  q.set(c[0], c[1], PAL.mag1);
  f.comp.add(q, Part.strap, { in: BRONZE.D });
}

/** a bronze collar where the neck was torn off */
function paintCollar(f: Frame): void {
  const q = polyLayer(f, [[-23, 14], [6, 14], [6, 19], [-23, 19]], BRONZE.M);
  bands(q, BRONZE, f.light, 1, 1, { top: 1, bottom: 1 });
  f.comp.add(q, Part.strap, { in: BRONZE.D });
}

// ---------------------------------------------------------------- the shadow-side rim (obsidian separates from the floor)

function rimLight(f: Frame): void {
  const { p, comp, light } = f;
  const ls = light.side;
  const body = (id: number) => id === Part.skull || id === Part.plate || id === Part.jaw || id === Part.stump || id === Part.teeth;
  const pts: number[] = [];
  for (let y = 1; y < p.h - 1; y++)
    for (let x = 1; x < p.w - 1; x++) {
      if (!p.isOpaque(x, y) || !body(comp.id[y * p.w + x])) continue;
      const c = p.get(x, y);
      if (c !== OBS.S && c !== OBS_FAR.M && c !== OBS_FAR.S) continue;
      // empty on the shadow side or below
      if (!p.isOpaque(x - ls, y) || !p.isOpaque(x, y + 1)) pts.push(x, y);
    }
  for (let i = 0; i < pts.length; i += 2) p.set(pts[i], pts[i + 1], PAL.stone1);
}

// ---------------------------------------------------------------- light (after the outline)

/** per-row spans (local) of the eye lens, top → bottom */
const LENS: readonly (readonly [number, number, number])[] = [
  [-9, -2, 1],
  [-8, -3, 4],
  [-7, -3, 7],
  [-6, -3, 10],
  [-5, -2, 11],
  [-4, -1, 10],
  [-3, 1, 8],
  [-2, 3, 6],
];
function eyeLens(f: Frame, now: boolean): void {
  const { o } = f;
  const lvl = clamp(rnd(o.eye), 0, 4);
  const run_ = (p: PixelCanvas) => {
    const open = clamp(o.eyeOpen, 0, 1);
    // rows shown (all 8 when open, down to the two middle rows, then a point) and how far each row is shrunk
    const [r0, r1, shr] = open >= 0.85 ? [0, 7, 0] : open >= 0.55 ? [1, 6, 1] : open >= 0.3 ? [3, 4, 2] : [4, 4, 5];
    if (lvl <= 0) {
      const e = T(f, 6, -3);
      p.set(e[0], e[1], MAG[0]);
      p.set(e[0] + 1, e[1], MAG[0]);
      return;
    }
    for (let r = r0; r <= r1; r++) {
      const [ly, x0, x1] = LENS[r];
      let a = x0 + shr;
      let b = x1 - shr;
      if (a > b) {
        const m = (a + b) >> 1;
        a = m;
        b = m;
      }
      for (let x = a; x <= b; x++) {
        const edge = x === a || x === b || r === r0 || r === r1;
        const low = r >= 5;
        let level: number;
        if (lvl === 1) level = 1;
        else if (lvl === 2) level = edge || low ? 1 : 2;
        else if (lvl === 3) level = edge || low ? 2 : 3;
        else level = edge ? 3 : low ? 3 : 3;
        if (lvl === 1 && r < r1) continue;
        // the hot core: a 3 × 2 slit toward the front of the lens
        if (lvl >= 4 && x >= 5 && x <= 7 && ly >= -6 && ly <= -5) level = 4;
        const c = T(f, x + 2, ly);
        blk(f, p, c[0], c[1], MAG[level]);
      }
    }
  };
  if (now) run_(f.p);
  else f.after.push(run_);
}

function farSlit(f: Frame): void {
  const { o } = f;
  if (o.far <= 0) return;
  f.after.push((p) => {
    const c = T(f, 23.5, -4.5);
    const col = o.far >= 2 ? MAG[2] : MAG[1];
    p.set(c[0] - 1, c[1], col);
    p.set(c[0], c[1], col);
    p.set(c[0] + 1, c[1], col);
  });
}

function discGlyph(f: Frame): void {
  const { o } = f;
  f.after.push((p) => {
    const c = T(f, DISC[0], DISC[1]);
    const lvl = clamp(rnd(o.disc), 0, 4);
    if (lvl <= 0 && o.scatter <= 0) return;
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 5; x++) {
        if (GLYPH_HEAD[y][x] !== '#') continue;
        const shade = x >= 3 || y >= 3;
        const lit = lvl >= 3 ? MAG[3] : MAG[lvl];
        const col = shade && lvl <= 3 ? MAG[Math.max(0, lvl - 1)] : lit;
        if (o.scatter > 0) {
          // the glyph's lines fly outward from the disc centre
          const dx = x - 2;
          const dy = y - 2;
          const k = 1 + rnd(o.scatter * 3);
          const gx = c[0] + dx * k;
          const gy = c[1] + dy * k;
          if (inFrame(gx, gy)) p.set(gx, gy, o.scatter > 0.6 ? MAG[2] : MAG[3]);
          if (o.scatter < 0.9) p.set(c[0] - 2 + x, c[1] - 2 + y, MAG[1]);
        } else blk(f, p, c[0] + Math.round((x - 2) * f.k) - (f.k > 1 ? 1 : 0), c[1] + Math.round((y - 2) * f.k) - (f.k > 1 ? 1 : 0), col);
      }
    if (lvl >= 4 && o.scatter <= 0) blk(f, p, c[0] - (f.k > 1 ? 1 : 0), c[1] - (f.k > 1 ? 1 : 0), MAG[4]);
  });
}

function seamLight(f: Frame): void {
  const { o } = f;
  const lvl = clamp(rnd(o.seam), 0, 4);
  if (lvl <= 0) return;
  f.after.push((p) => {
    const base = T(f, -9, 24);
    const zig: Pt[] = [[-10, 0], [-8, -1], [-6, 0], [-4, 0], [-2, -1], [0, 0], [2, 0], [4, -1], [6, 0], [8, 0], [9, -1]];
    zig.forEach(([x, y]) => p.set(base[0] + x, base[1] + y, MAG[Math.min(3, lvl)]));
    // a dim ember under the crack, and bleed lines up the stump
    zig.forEach(([x, y]) => {
      if (x % 4 === 0) p.set(base[0] + x, base[1] + y + 1, MAG[1]);
    });
    if (lvl >= 3) {
      [-10, -2, 6].forEach((x, k) => {
        for (let j = 0; j < 3; j++) p.set(base[0] + x + (j % 2), base[1] - 2 - j - k, MAG[1]);
      });
    }
    if (lvl >= 4) {
      p.set(base[0] + 0, base[1], MAG[4]);
      p.set(base[0] + 1, base[1], MAG[4]);
    }
  });
}

/** a light pixel: k × k px at the cut-in's density */
function blk(f: Frame, p: PixelCanvas, x: number, y: number, c: number): void {
  const n = Math.ceil(f.k);
  if (n <= 1) p.set(x, y, c);
  else p.rect(x, y, n, n, c);
}

// ---------------------------------------------------------------- frame

export function drawHead(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right' = 'left', at?: { ox: number; oy: number; k: number }): void {
  const light = lightOf(lightFrom);
  CW = p.w;
  CH = p.h;
  const f: Frame = {
    p,
    comp: new Comp(p),
    light,
    o,
    ox: at ? at.ox + o.dx * at.k : OX + o.dx,
    oy: at ? at.oy + o.dy * at.k : OY + o.dy,
    th: -o.rot * DEG,
    k: at ? at.k : 1,
    after: [],
  };
  // far chain + far shard
  if (o.nch >= 1) paintChain(f, chainPath(f, 0), 3, 0);
  paintShards(f, 'far');
  paintFins(f);
  paintStump(f);
  paintCollar(f);
  if (o.nch >= 2) paintChain(f, chainPath(f, 1), 3, 1);
  paintCavity(f);
  paintJaw(f);
  paintSkull(f);
  paintSockets(f);
  paintTeeth(f);
  paintStraps(f);
  paintHinge(f);
  paintDisc(f);
  cracks(f);
  spill(f);
  rimLight(f);
  // under a hood of chains the lens is painted before them (its glow shows only through the link gaps)
  const hooded = o.hood > 0.15;
  if (hooded) eyeLens(f, true);
  if (o.nch >= 4) paintChain(f, loopPath(f), 3, 0);
  if (o.nch >= 3) paintChain(f, chainPath(f, 2), 3, 0);
  paintShards(f, 'near');
  chunkFx(f);
  risers(f);
  flashBands(f);
  splitSlabs(f);
  clipFloor(f);
  p.outline(PAL.ink);
  if (!hooded) eyeLens(f, false);
  farSlit(f);
  discGlyph(f);
  seamLight(f);
  ringsFx(f);
  motesFx(f);
  if (o.clip > 0) f.after.push((q) => { for (let y = o.clip; y < q.h; y++) for (let x = 0; x < q.w; x++) q.erase(x, y); });
  floorCrack(f);
  glintFx(f);
  sparksFx(f);
  for (const a of f.after) a(p);
}

/** key points of a pose, frame pixels: the mouth gap (muzzle), the near eye (core), the skull centre (head) */
export function headPoints(o: Pose): { muzzle: Pt; core: Pt; head: Pt } {
  const f: Frame = { p: null as unknown as PixelCanvas, comp: null as unknown as Comp, light: lightOf('left'), o, ox: OX + o.dx, oy: OY + o.dy, th: -o.rot * DEG, k: 1, after: [] };
  return { muzzle: TJ(f, 32, 21), core: T(f, 8, -5), head: T(f, 0, 0) };
}
