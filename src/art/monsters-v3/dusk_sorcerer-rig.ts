// Akşam Büyücüsü v3 — the "comet coat" rig: Pose → pixels.
//
// A NEW body plan (not the magus' column): a leaning, floating master caster whose silhouette is a
// diagonal sweep — a wide-brimmed pointed hat, a short silver beard under two violet eyes, a high collar
// that flares like bat wings, a long swept coat whose two fork-tipped tails stream back like a comet's, ONE
// raised casting hand carrying a violet flame (it burns in idle too) and a floating crescent-moon staff
// that is never held: it orbits the flame (geometry, drawn at any angle — no sprite is ever rotated),
// plus a star-dust sash trailing from the belt. Violet + moon-silver + midnight; gold only as small trim.
//
//   - cloth (coat, tails, skirt, sleeves, collar, hat) is shaded by flat value planes measured from the
//     part's own edges (lit band toward the key light, shade band away from it, 1-px separations where it
//     laps over another part): no per-row gradients, no dither;
//   - small rigid details (face, hands, boots, buckle) are hand-placed maps moved by whole pixels;
//   - ONE key light from the screen's top-left: `light` = the frame edge it comes from ('left' P1, 'right'
//     the P2 relight sheet, mirrored by flipX it is lit from the screen's top-left again). Every lit /
//     shaded plane is chosen per light, never mirrored afterwards;
//   - light (eyes, flame, gems, star-dust) is painted after the outline and never outlined (IŞ-9).
// Frame 128×108; 1 art px = 1 game px; the root R (belt centre) is the origin of every part.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { edgeRim, ik2, lightOf, run, spans, widenTeeth, type Light } from '../rigkit';
import { Comp, planes } from './dusk_sorcerer-kit';
import { drawFlame, flameTop } from './dusk_sorcerer-fx';
import { BEARD, BOOT_F, BOOT_B, FACE, HANDS, type HandKind } from './dusk_sorcerer-maps';
import { paintMoon, moonGeom, moonTips, type MoonGeom } from './dusk_sorcerer-moon';

export type { HandKind, MoonGeom };

/** Frame size, root position and the ground. */
export const W = 128;
export const H = 116;
/** Root (belt centre) at pose 0: x, y. */
export const RX = 60;
export const RY = 73;
/** Anchor (ground point between the feet) and hover. */
export const GROUND_Y = 106;
export const HOVER = 6;

export const enum Part {
  none = 0,
  tailB,
  tailA,
  sash,
  boot2,
  arm2,
  collarB,
  skirt,
  boot1,
  torso,
  vest,
  collarF,
  head,
  hat,
  arm1,
  shell,
  moon,
  flame,
  fx,
}

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rnd = Math.round;
const fl = Math.floor;

// ---------------------------------------------------------------- pose

export interface Pose {
  /** whole-body offset (px) and float (px, + = down) */
  dx: number;
  bob: number;
  /** upper body forward lean (px; bust 0.5×, head 1×) and sink (px: the upper body drops toward the hem) */
  lean: number;
  sink: number;
  /** head offset (px), eye brightness 0…1.5, squint 0…1 */
  hx: number;
  hy: number;
  eye: number;
  squint: number;
  /** brim tilt (px the front end rises over the back end), hat tip lag (px, + forward) and droop (px, + down), the whole hat's offset (px: it flies off in a hit) */
  tilt: number;
  tipX: number;
  tipY: number;
  hatX: number;
  hatY: number;
  /** beard sway (px) */
  beard: number;
  /** near (casting) hand relative to the root (px), its kind, elbow side (+1 down / −1 up), sleeve droop and lag */
  nx: number;
  ny: number;
  hand: HandKind;
  elbow: number;
  drape: number;
  slag: number;
  /** far hand relative to the root */
  fx: number;
  fy: number;
  fhand: HandKind;
  /** coat: tail swing (px at the tips, + = lifts / swings forward), phase of the tail wave (0…1), skirt flare (px), collar spread 0…1, hem wave phase */
  tailA: number;
  tailB: number;
  tailT: number;
  flare: number;
  collar: number;
  hemT: number;
  /** boots relative to the root (px): near boot toe x / y, far boot toe x / y */
  b1x: number;
  b1y: number;
  b2x: number;
  b2y: number;
  /** sash: wave phase 0…1, length 0…1 */
  sashT: number;
  sashL: number;
  /** flame: size 0…1.4 (0 = out), shape phase (0…1), offset from the hand (px) */
  flame: number;
  flameT: number;
  fdx: number;
  fdy: number;
  /** moon: centre rel. to the root (px), the way the hollow faces (deg), scale (0 = hidden), depth (−1 behind the hand, +1 in front) */
  mx: number;
  my: number;
  ma: number;
  ms: number;
  mz: number;
  /** moon smear: ghost copies trailing along (−dx, −dy) per step; count */
  msx: number;
  msy: number;
  msn: number;
  /** moon tips glint 0…1 */
  mglow: number;
  /** guard cloak shell 0…1 (spread in front of the body) */
  wrap: number;
  /** charge: motes streaming into the hand / moon 0…1 */
  charge: number;
  /** floor ring 0…1 (the slam rings the floor); its centre rel. to the root (px) */
  ring: number;
  rx: number;
  ry: number;
  /** dissolve front 0…1 (top → down); gather = the same front run as a materialising (stars); rise 0…1: the body is cut at a line sinking into the floor; gate 0…1: the moon gate under the feet */
  diss: number;
  gather: boolean;
  rise: number;
  gate: number;
  /** hitMagic crackle 0…1, global phase 0…1 (cloth that runs once through a one-shot) */
  zap: number;
  t: number;
}

export const NEUTRAL: Pose = {
  dx: 0,
  bob: 0,
  lean: 0,
  sink: 0,
  hx: 0,
  hy: 0,
  eye: 1,
  squint: 0,
  tilt: 0,
  tipX: 0,
  tipY: 0,
  hatX: 0,
  hatY: 0,
  beard: 0,
  nx: 28,
  ny: -29,
  hand: 'open',
  elbow: 1,
  drape: 0,
  slag: 0,
  fx: -9,
  fy: -2,
  fhand: 'loose',
  tailA: 0,
  tailB: 0,
  tailT: 0,
  flare: 0,
  collar: 0.5,
  hemT: 0,
  b1x: 15,
  b1y: 27,
  b2x: -6,
  b2y: 27,
  sashT: 0,
  sashL: 1,
  flame: 1,
  flameT: 0,
  fdx: 0,
  fdy: 0,
  mx: 39,
  my: -36,
  ma: 200,
  ms: 1,
  mz: 1,
  msx: 0,
  msy: 0,
  msn: 0,
  mglow: 0,
  wrap: 0,
  charge: 0,
  ring: 0,
  rx: 30,
  ry: 34,
  diss: 0,
  gather: false,
  rise: 1,
  gate: 0,
  zap: 0,
  t: 0,
};

export const pose = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

// ---------------------------------------------------------------- tones

interface Tones {
  L: number;
  M: number;
  S: number;
  D: number;
}
const COAT: Tones = { L: PAL.night4, M: PAL.night3, S: PAL.night2, D: PAL.night1 };
const LINING: Tones = { L: PAL.void3, M: PAL.void2, S: PAL.void1, D: PAL.void0 };
const HAT: Tones = { L: PAL.void3, M: PAL.void2, S: PAL.void1, D: PAL.void0 };
const SILVER: Tones = { L: PAL.mist, M: PAL.steel, S: PAL.night4, D: PAL.night3 };
const SLEEVE: Tones = { L: PAL.night4, M: PAL.night3, S: PAL.night2, D: PAL.night1 };

// ---------------------------------------------------------------- geometry helpers

type Pt = readonly [number, number];

/** Everything the parts need about one frame: root, light, helpers. */
export interface Frame {
  p: PixelCanvas;
  comp: Comp;
  light: Light;
  /** +1 when the key light comes from the frame's right (P2 relight) */
  rs: 1 | -1;
  o: Pose;
  rx: number;
  ry: number;
  /** body-relative → frame px */
  at(x: number, y: number): Pt;
  /** light pixels (star-dust glints) painted after the outline */
  glints: [number, number, number][];
}

/** Fill a polygon (given in root-relative px) into a fresh layer, flat colour. */
function polyLayer(f: Frame, pts: readonly Pt[], c: number): PixelCanvas {
  const q = new PixelCanvas(W, H);
  q.poly(pts.map(([x, y]) => f.at(x, y)), c);
  return q;
}

/**
 * Flat three-band cloth planes (IŞ-3): the band facing the key light, the shade band away from it and the
 * bottom edge, the mid tone between. Measured by runs along the key's diagonal so a swept tail's bands
 * follow its own edges.
 */
function bands(q: PixelCanvas, t: Tones, light: Light, litW = 2, shW = 2, opt: { top?: number; bottom?: number } = {}): PixelCanvas {
  const ls = light.side;
  const top = opt.top ?? 1;
  const bottom = opt.bottom ?? 1;
  return planes(q, (x, y, src) => {
    const toLight = Math.min(run(src, x, y, ls, -1, litW + 1), run(src, x, y, ls, 0, litW + 1) + 1);
    const up = run(src, x, y, 0, -1, top + 1);
    if (up < top || toLight < litW) return t.L;
    const away = Math.min(run(src, x, y, -ls, 1, shW + 1), run(src, x, y, -ls, 0, shW + 1) + 1);
    const dn = run(src, x, y, 0, 1, bottom + 1);
    if (dn < bottom || away < shW) return t.S;
    return t.M;
  });
}

/** A smooth path through points (Catmull-Rom → polyline). */
function spline(pts: readonly Pt[], n = 8): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** The two edges of a tapered ribbon along `path` (widths w0 → w1): a closed polygon. */
function ribbon(path: readonly Pt[], w0: number, w1: number, prof?: (t: number) => number): Pt[] {
  const a: Pt[] = [];
  const b: Pt[] = [];
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    const q = path[Math.min(path.length - 1, i + 1)];
    const r = path[Math.max(0, i - 1)];
    let tx = q[0] - r[0];
    let ty = q[1] - r[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    const tt = i / (path.length - 1);
    const w = (prof ? prof(tt) : lerp(w0, w1, tt)) / 2;
    a.push([p[0] - ty * w, p[1] + tx * w]);
    b.push([p[0] + ty * w, p[1] - tx * w]);
  }
  return [...a, ...b.reverse()];
}

// ---------------------------------------------------------------- skeleton

export interface Skel {
  /** root, shoulders, neck, head anchor (the hat's brim centre), hands, elbows */
  R: Pt;
  chest: Pt;
  neck: Pt;
  head: Pt;
  sh1: Pt;
  sh2: Pt;
  el1: Pt;
  el2: Pt;
  h1: Pt;
  h2: Pt;
  flame: Pt;
}

export function skeleton(o: Pose): Skel {
  const rx = RX + o.dx;
  const ry = RY + o.bob;
  const sink = o.sink;
  const leanB = rnd(o.lean * 0.5);
  const leanH = rnd(o.lean);
  const R: Pt = [rx, ry];
  const chest: Pt = [rx + leanB + 1, ry - 11 + sink];
  const neck: Pt = [rx + leanB + 1, ry - 20 + sink];
  const head: Pt = [rx + 2 + leanH + o.hx, ry - 29 + sink + o.hy];
  const sh1: Pt = [rx + 9 + leanB, ry - 17 + sink];
  const sh2: Pt = [rx - 6 + leanB, ry - 18 + sink];
  const h1: Pt = [rx + o.nx, ry + o.ny];
  const h2: Pt = [rx + o.fx, ry + o.fy];
  const el1 = ik2(sh1, h1, 11, 11, o.elbow);
  const el2 = ik2(sh2, h2, 10, 10, -1);
  const flame: Pt = [h1[0] + o.fdx, h1[1] - 4 + o.fdy];
  return { R, chest, neck, head, sh1, sh2, el1, el2, h1, h2, flame };
}

// ---------------------------------------------------------------- the draw

export function drawSorcerer(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right'): void {
  const light = lightOf(lightFrom);
  const sk = skeleton(o);
  const comp = new Comp(p);
  const f: Frame = { p, comp, light, rs: light.side === 1 ? 1 : -1, o, rx: sk.R[0], ry: sk.R[1], at: (x, y) => [sk.R[0] + x, sk.R[1] + y], glints: [] };

  // ------------------------------------------------ the moon behind the hand (depth −1)
  const g = moonGeom(o, sk);
  if (o.mz < 0 && o.ms > 0) {
    const q = new PixelCanvas(W, H);
    paintMoon(q, g, light, o);
    comp.add(q, Part.moon, { out: PAL.ink });
  }

  drawTails(f, sk);
  drawSash(f, sk);
  {
    const q = new PixelCanvas(W, H);
    const [bx, by] = f.at(o.b2x, o.b2y);
    stampMap(q, BOOT_B, bx, by, light);
    comp.add(q, Part.boot2, { out: PAL.ink });
  }
  drawFarArm(f, sk);
  drawCollarBack(f, sk);
  {
    const q = new PixelCanvas(W, H);
    const [bx, by] = f.at(o.b1x, o.b1y);
    stampMap(q, BOOT_F, bx, by, light);
    comp.add(q, Part.boot1, { out: PAL.ink });
  }
  drawSkirt(f, sk);
  drawTorso(f, sk);
  drawShell(f, sk);
  drawCollarFront(f, sk);
  drawHead(f, sk);
  drawHat(f, sk);
  drawNearArm(f, sk);

  if (o.mz >= 0 && o.ms > 0) {
    const q = new PixelCanvas(W, H);
    paintMoon(q, g, light, o);
    comp.add(q, Part.moon, { out: PAL.ink });
  }

  // the body rising out of the floor: cut below a line that sinks into the gate
  if (o.rise < 1) {
    const cut = sk.R[1] + Math.round(-26 + 56 * clamp(o.rise, 0, 1));
    for (let y = cut; y < H; y++) for (let x = 0; x < W; x++) if (p.isOpaque(x, y) && comp.id[y * W + x] !== Part.moon) p.erase(x, y);
  }

  p.outline(PAL.ink);
  dissolvePass(f, sk);

  // ------------------------------------------------ light layer: unoutlined
  ringPass(f, sk);
  gatePass(f, sk);
  if (o.flame > 0 && !(o.diss > 0.75 && !o.gather)) drawFlame(p, sk.flame[0], sk.flame[1], o.flame, o.flameT, light, o.charge);
  paintEyesLight(f, sk);
  chargePass(f, sk);
  zapPass(f, sk);
  for (const [x, y, c] of f.glints) if (!p.isOpaque(x, y) || p.get(x, y) !== PAL.ink) p.set(x, y, c);
  if (o.mglow > 0 && o.ms > 0) moonTips(p, g, o.mglow);
}

// ---------------------------------------------------------------- map stamping

/** Stamp a role-lettered map at (ax, ay); lit / shade roles swap under the P2 light (IŞ-2). */
export function stampMap(q: PixelCanvas, m: { rows: readonly string[]; ox: number; oy: number }, ax: number, ay: number, light: Light): void {
  const x0 = fl(ax) + m.ox;
  const y0 = fl(ay) + m.oy;
  const swap = light.side === 1;
  for (let j = 0; j < m.rows.length; j++) {
    const row = m.rows[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      let c = KEY[ch];
      if (swap && SWAP[ch] !== undefined) c = KEY[SWAP[ch]];
      if (c !== undefined) q.set(x0 + i, y0 + j, c);
    }
  }
}

const KEY: Record<string, number> = {
  k: PAL.ink,
  '0': PAL.night0,
  '1': PAL.night1,
  '2': PAL.night2,
  '3': PAL.night3,
  '4': PAL.night4,
  s: PAL.steel,
  m: PAL.mist,
  n: PAL.night4,
  w: PAL.white,
  a: PAL.void0,
  b: PAL.void1,
  c: PAL.void2,
  d: PAL.void3,
  e: PAL.void4,
  g: PAL.gold2,
  G: PAL.gold3,
  h: PAL.gold1,
  u: PAL.gold4,
  f: PAL.skin0,
  F: PAL.skin1,
  q: PAL.skin2,
  Q: PAL.skin3,
};
/** letter → the letter it becomes under the right-hand light (lit ↔ shade of one ramp) */
const SWAP: Record<string, string> = { '4': '2', '2': '4', m: 'n', n: 'm', d: 'b', b: 'd', Q: 'F', F: 'Q', q: 'f', f: 'q', G: 'h', h: 'G' };

// ---------------------------------------------------------------- parts

/** Tail width profile: full at the root, fullest a third of the way, tapering to a forked tip. */
const tailProf = (w: number) => (t: number) => w * (0.7 + 0.5 * Math.sin(Math.min(1, t * 1.5) * Math.PI * 0.75)) * (1 - 0.7 * Math.max(0, (t - 0.55) / 0.45) ** 1.3) + 1.5;

function carveFork(q: PixelCanvas, path: readonly Pt[], len: number): void {
  const end = path[path.length - 1];
  const dirs: Pt[] = [];
  const hits: number[] = [];
  void dirs;
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      if (!q.isOpaque(x, y)) continue;
      const de = Math.hypot(x + 0.5 - end[0], y + 0.5 - end[1]);
      if (de > len) continue;
      // distance to the centre line of the last stretch
      let dl = Infinity;
      for (let i = Math.max(0, path.length - 6); i + 1 < path.length; i++) {
        const [ax, ay] = path[i];
        const [bx, by] = path[i + 1];
        const vx = bx - ax;
        const vy = by - ay;
        const l2 = vx * vx + vy * vy || 1;
        const t = Math.max(0, Math.min(1, ((x + 0.5 - ax) * vx + (y + 0.5 - ay) * vy) / l2));
        dl = Math.min(dl, Math.hypot(x + 0.5 - (ax + vx * t), y + 0.5 - (ay + vy * t)));
      }
      // a V notch: wide at the tip, closing up the tail
      if (dl < 0.5 + (1 - de / len) * 1.2) hits.push(x, y);
    }
  for (let i = 0; i < hits.length; i += 2) q.erase(hits[i], hits[i + 1]);
}

function drawTails(f: Frame, sk: Skel): void {
  const { o, light } = f;
  const wave = (k: number, ph: number) => Math.sin((o.tailT + ph) * TAU) * k;
  const mk = (pts: readonly Pt[], swing: number, k: number, w0: number): { poly: Pt[]; path: Pt[] } => {
    const [root, mid1, mid2, tip] = pts;
    const a: Pt = [f.rx + root[0], f.ry + root[1]];
    const b: Pt = [f.rx + mid1[0] + swing * 0.2, f.ry + mid1[1] - swing * 0.15 + wave(0.7 * k, 0.1)];
    const c: Pt = [f.rx + mid2[0] + swing * 0.6, f.ry + mid2[1] - swing * 0.4 + wave(1.2 * k, 0.3)];
    const d: Pt = [f.rx + tip[0] + swing, f.ry + tip[1] - swing * 0.65 + wave(1.8 * k, 0.5)];
    const path = spline([a, b, c, d], 6);
    return { poly: ribbon(path, w0, 2, tailProf(w0)), path };
  };
  const tb = mk([[-4, 3], [-12, 10], [-21, 17], [-30, 22]], o.tailB, 1, 9);
  const ta = mk([[-5, -3], [-15, -1], [-27, 5], [-40, 13]], o.tailA, 1, 10);
  for (const [t, part] of [
    [tb, Part.tailB],
    [ta, Part.tailA],
  ] as const) {
    const q = new PixelCanvas(W, H);
    q.poly(t.poly, COAT.M);
    carveFork(q, t.path, 7);
    bands(q, COAT, light, 2, 3, { top: 1, bottom: 1 });
    // moon-silver piping on the underside edge, violet lining just above it
    planes(q, (x, y, s) => {
      const dn = run(s, x, y, 0, 1, 3);
      if (dn === 0 && run(s, x, y, 0, -1, 3) >= 2) return SILVER.M;
      if (dn === 1 && run(s, x, y, 0, -1, 3) >= 2) return LINING.M;
      return null;
    });
    widenTeeth(q, 0);
    f.comp.add(q, part, { out: PAL.night0 });
  }
}

function drawSash(f: Frame, sk: Skel): void {
  const { o, light } = f;
  const L = 16 * o.sashL;
  if (L < 3) return;
  const q = new PixelCanvas(W, H);
  const n = 10;
  const path: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = -5 - t * L * 1.1;
    const y = 1 + t * L * 0.55 + Math.sin((o.sashT + t * 0.9) * TAU) * (0.8 + t * 2.4);
    path.push([f.rx + x, f.ry + y]);
  }
  q.poly(ribbon(path, 3, 1.4), PAL.void2);
  bands(q, LINING, light, 1, 1, { top: 1, bottom: 1 });
  f.comp.add(q, Part.sash, { out: PAL.void0 });
}

function drawFarArm(f: Frame, sk: Skel): void {
  const { o, light } = f;
  const q = new PixelCanvas(W, H);
  const path = spline([sk.sh2, sk.el2, sk.h2], 6);
  q.poly(ribbon(path, 7, 6), COAT.S);
  bands(q, { L: COAT.M, M: COAT.S, S: COAT.D, D: COAT.D }, light, 1, 1);
  f.comp.add(q, Part.arm2, { out: PAL.night0 });
  const h = new PixelCanvas(W, H);
  stampMap(h, HANDS[o.fhand], sk.h2[0], sk.h2[1], light);
  f.comp.add(h, Part.arm2, { out: PAL.ink });
}

function drawCollarBack(f: Frame, sk: Skel): void {
  const { o, light } = f;
  const k = o.collar;
  const q = new PixelCanvas(W, H);
  const [nx, ny] = sk.neck;
  const tip: Pt = [nx - 14 - k * 6, ny - 7 - k * 4];
  const pts: Pt[] = [
    [nx + 2, ny + 3],
    [nx - 1, ny - 5],
    [nx - 6 - k * 3, ny - 9 - k * 2],
    tip,
    [nx - 12 - k * 4, ny - 1],
    [nx - 12, ny + 7],
    [nx - 4, ny + 9],
  ];
  q.poly(pts, COAT.M);
  bands(q, COAT, light, 2, 2);
  planes(q, (x, y, s) => {
    const toL = run(s, x, y, light.side, 0, 3);
    return toL < 1 && y < ny + 1 ? LINING.M : null;
  });
  f.comp.add(q, Part.collarB, { out: PAL.night0 });
}

function drawSkirt(f: Frame, sk: Skel): void {
  const { o, light } = f;
  const R = sk.R;
  const fl2 = o.flare;
  const w = (k: number, ph: number) => Math.sin((o.hemT + ph) * TAU) * k;
  // the front skirt streams back with the coat: its hem runs diagonally, highest at the front edge
  const pts: Pt[] = [
    [R[0] - 8, R[1] - 1],
    [R[0] + 10, R[1] - 1],
    [R[0] + 13 + fl2, R[1] + 7],
    [R[0] + 12 + fl2, R[1] + 14 + w(0.5, 0.1)],
    [R[0] + 8 + fl2 * 0.6, R[1] + 17 + w(0.7, 0.2)],
    [R[0] + 5, R[1] + 22 + w(0.8, 0.4)],
    [R[0] + 1, R[1] + 20 + w(0.9, 0.55)],
    [R[0] - 3, R[1] + 24 + w(0.9, 0.7)],
    [R[0] - 7, R[1] + 22 + w(1.1, 0.85)],
    [R[0] - 11, R[1] + 24 + w(0.9, 0.95)],
    [R[0] - 13 - fl2 * 0.5, R[1] + 16],
    [R[0] - 11, R[1] + 8],
  ];
  const q = new PixelCanvas(W, H);
  q.poly(pts, COAT.M);
  bands(q, COAT, light, 2, 3, { bottom: 2 });
  // violet facing along the front edge, a silver piping line on its outer edge
  const sp = spans(q);
  planes(q, (x, y, s) => {
    const ry = y - R[1];
    if (ry < 3) return null;
    const fromRight = run(s, x, y, 1, 0, 4);
    if (fromRight === 0) return SILVER.M;
    if (fromRight < 3) return LINING.M;
    return null;
  });
  void sp;
  widenTeeth(q, R[1] + 14);
  f.comp.add(q, Part.skirt, { out: PAL.night0 });
}

function drawTorso(f: Frame, sk: Skel): void {
  const { light } = f;
  const [cx, cy] = sk.chest;
  const q = new PixelCanvas(W, H);
  const pts: Pt[] = [
    [cx - 7, cy - 7],
    [cx - 3, cy - 10],
    [cx + 4, cy - 10],
    [cx + 9, cy - 7],
    [cx + 10, cy - 1],
    [cx + 8, cy + 9],
    [cx - 6, cy + 9],
    [cx - 8, cy + 1],
  ];
  q.poly(pts, COAT.M);
  bands(q, COAT, light, 2, 2);
  f.comp.add(q, Part.torso, { out: PAL.night0 });
  // violet vest between the lapels, a silver lapel line
  const v = new PixelCanvas(W, H);
  v.poly([[cx - 1, cy - 10], [cx + 5, cy - 9], [cx + 5, cy + 9], [cx + 1, cy + 9]], LINING.M);
  bands(v, LINING, light, 1, 1);
  f.comp.add(v, Part.vest, { out: SILVER.M });
  const b = new PixelCanvas(W, H);
  b.rect(cx - 7, cy + 7, 17, 3, PAL.night1);
  b.rect(cx + 1, cy + 6, 5, 5, PAL.gold2);
  b.rect(cx + 2, cy + 7, 3, 3, PAL.gold4);
  b.set(cx + 3, cy + 8, PAL.void3);
  f.comp.add(b, Part.vest, { out: PAL.ink });
}

function drawCollarFront(f: Frame, sk: Skel): void {
  const { o, light } = f;
  const k = o.collar;
  const [nx, ny] = sk.neck;
  const q = new PixelCanvas(W, H);
  const tip: Pt = [nx + 12 + k * 3, ny - 8 - k * 3];
  const pts: Pt[] = [
    [nx - 2, ny + 3],
    [nx + 2, ny - 4],
    [nx + 7, ny - 7],
    tip,
    [nx + 11, ny - 1],
    [nx + 12, ny + 5],
    [nx + 4, ny + 7],
  ];
  q.poly(pts, COAT.L);
  bands(q, COAT, light, 2, 2);
  planes(q, (x, y, s) => (run(s, x, y, -light.side, 0, 3) < 1 && y < ny ? LINING.M : null));
  f.comp.add(q, Part.collarF, { out: PAL.night0 });
}

function drawHead(f: Frame, sk: Skel): void {
  const { o, light } = f;
  const [hx, hy] = sk.head;
  const q = new PixelCanvas(W, H);
  stampMap(q, FACE, hx, hy, light);
  stampMap(q, BEARD, hx + rnd(o.beard * 0.5), hy, light);
  f.comp.add(q, Part.head, { out: PAL.ink });
}

function drawHat(f: Frame, sk: Skel): void {
  const { o, light } = f;
  const hx = sk.head[0] + o.hatX;
  const hy = sk.head[1] + o.hatY;
  const q = new PixelCanvas(W, H);
  const tl = o.tilt;
  const brim: Pt[] = [];
  const BW = 19;
  const yc = hy - 7;
  const sq = (t: number) => Math.max(0.42, Math.sqrt(Math.max(0, 1 - t * t)));
  const lift = (t: number) => (t < -0.5 ? (-0.5 - t) * 6 : 0) + (t > 0.7 ? (t - 0.7) * 3 : 0);
  const top = (t: number) => yc - 2.4 * sq(t) - t * tl * 0.5 - lift(t);
  const bot = (t: number) => yc + 2.1 * sq(t) - t * tl * 0.5 - lift(t) * 0.8;
  for (let i = 0; i <= 14; i++) {
    const t = -1 + (i / 14) * 2;
    brim.push([hx + 1 + t * BW, top(t)]);
  }
  for (let i = 14; i >= 0; i--) {
    const t = -1 + (i / 14) * 2;
    brim.push([hx + 1 + t * BW, bot(t)]);
  }
  q.poly(brim, HAT.M);
  bands(q, HAT, light, 2, 2, { top: 1, bottom: 1 });
  planes(q, (x, y, s) => (run(s, x, y, 0, 1, 2) < 1 ? HAT.D : null));
  f.comp.add(q, Part.hat, { out: PAL.ink });

  const c = new PixelCanvas(W, H);
  const base: Pt = [hx + 2, yc - 1];
  const spine = spline(
    [
      base,
      [hx + 1 + o.tipX * 0.2, yc - 6],
      [hx - 1 + o.tipX * 0.5, yc - 11 + o.tipY * 0.3],
      [hx - 6 + o.tipX * 0.8, yc - 15 + o.tipY * 0.6],
      [hx - 13 + o.tipX, yc - 15 + o.tipY],
    ],
    6,
  );
  c.poly(ribbon(spine, 17, 1.4, (t) => 15 * (1 - t) ** 0.9 + 1.5), HAT.M);
  bands(c, HAT, light, 2, 3);
  planes(c, (x, y, s) => (y >= yc - 3 && y <= yc - 1 && run(s, x, y, 0, 1, 12) > 0 ? PAL.night2 : null));
  f.comp.add(c, Part.hat, { out: HAT.D });
  const bk = new PixelCanvas(W, H);
  const bx = hx + 5;
  const by = yc - 3;
  bk.set(bx, by, PAL.gold3).set(bx + 1, by - 1, PAL.gold3).set(bx + 2, by - 1, PAL.gold2).set(bx + 3, by, PAL.gold3).set(bx + 3, by + 1, PAL.gold2);
  f.comp.add(bk, Part.hat, {});
  const tipP = spine[spine.length - 1];
  const st = new PixelCanvas(W, H);
  const tx = fl(tipP[0]);
  const ty = fl(tipP[1]);
  st.set(tx - 1, ty, PAL.gold3).set(tx, ty - 1, PAL.gold3).set(tx, ty, PAL.gold4).set(tx + 1, ty, PAL.gold3).set(tx, ty + 1, PAL.gold3);
  f.comp.add(st, Part.hat, { out: PAL.ink });
}

function drawNearArm(f: Frame, sk: Skel): void {
  const { o, light } = f;
  const q = new PixelCanvas(W, H);
  const path = spline([sk.sh1, sk.el1, sk.h1], 7);
  const rb = ribbon(path, 6, 12, (t) => (t < 0.45 ? 6.5 : 6.5 + (t - 0.45) * 10));
  q.poly(rb, SLEEVE.M);
  // the bell's drooping underside lags the arm
  const hx = sk.h1[0];
  const hy = sk.h1[1];
  const a = Math.atan2(sk.h1[1] - sk.el1[1], sk.h1[0] - sk.el1[0]);
  const nxv = -Math.sin(a);
  const nyv = Math.cos(a);
  const bx = hx - Math.cos(a) * 3 + nxv * 6;
  const by = hy - Math.sin(a) * 3 + nyv * 6;
  const mx = hx - Math.cos(a) * 10 + nxv * 5;
  const my = hy - Math.sin(a) * 10 + nyv * 5;
  q.poly([[bx, by], [bx - 5 + o.slag, by + 4 + o.drape], [mx - 2 + o.slag * 0.5, my + 2], [mx, my]], SLEEVE.M);
  bands(q, SLEEVE, light, 2, 2);
  f.comp.add(q, Part.arm1, { out: PAL.night1 });
  const cuff = new PixelCanvas(W, H);
  const cx = hx - Math.cos(a) * 4;
  const cy = hy - Math.sin(a) * 4;
  cuff.thickLine(cx + nxv * 6, cy + nyv * 6, cx - nxv * 6, cy - nyv * 6, 2, SILVER.M);
  f.comp.add(cuff, Part.arm1, {});
  const h = new PixelCanvas(W, H);
  stampMap(h, HANDS[o.hand], hx, hy, light);
  f.comp.add(h, Part.arm1, { out: PAL.ink });
  void edgeRim;
  void spans;
}

function paintEyesLight(f: Frame, sk: Skel): void {
  const { p, o } = f;
  const [hx, hy] = sk.head;
  const y = hy - 2 + (o.squint > 0.5 ? 1 : 0);
  const e = o.eye;
  const col = e > 1.2 ? PAL.white : e > 0.6 ? PAL.void4 : PAL.void3;
  const rim = e > 0.6 ? PAL.void3 : PAL.void2;
  p.set(hx - 1, y, rim).set(hx, y, col);
  p.set(hx + 4, y, rim).set(hx + 5, y, col).set(hx + 6, y, col);
}

// ---------------------------------------------------------------- guard shell

/**
 * The spread cloak (guard): a big sail hanging from the raised near hand to the hem in front of the body,
 * its violet lining turned outward, a silver edge, a small moon sigil. `wrap` swings it round from the back
 * (a sliver along the body's back edge at 0) to the front.
 */
function drawShell(f: Frame, sk: Skel): void {
  const { o, light } = f;
  if (o.wrap <= 0.02) return;
  const k = clamp(o.wrap, 0, 1);
  const R = sk.R;
  const [hx, hy] = sk.h1;
  const w = (a: number, ph: number) => Math.sin((o.hemT + ph) * TAU) * a;
  const full: Pt[] = [
    [hx + 3, hy - 2],
    [hx + 7, hy + 7],
    [hx + 8, R[1] + 6],
    [hx + 5, R[1] + 21 + w(0.8, 0.1)],
    [R[0] + 12, R[1] + 25 + w(1, 0.3)],
    [R[0] + 7, R[1] + 21 + w(1, 0.5)],
    [R[0] + 2, R[1] + 26 + w(1.1, 0.7)],
    [R[0] - 4, R[1] + 21 + w(1.1, 0.85)],
    [R[0] - 8, R[1] + 12],
    [R[0] - 8, R[1] - 12],
    [sk.sh1[0] - 1, sk.sh1[1] - 3],
    [sk.sh1[0] + 6, sk.sh1[1] - 1],
  ];
  const backX = R[0] - 7;
  const pts: Pt[] = full.map(([x, y]) => [lerp(backX + (x - backX) * 0.12, x, k), y] as Pt);
  const q = new PixelCanvas(W, H);
  q.poly(pts, LINING.M);
  const ls = light.side;
  planes(q, (x, y, s) => {
    const toLight = Math.min(run(s, x, y, ls, -1, 4), run(s, x, y, ls, 0, 4) + 1);
    const up = run(s, x, y, 0, -1, 2);
    const dn = run(s, x, y, 0, 1, 3);
    const edge = Math.min(run(s, x, y, 1, 0, 3), run(s, x, y, -1, 0, 3));
    if (up === 0 || dn === 0 && y > R[1] + 10) return SILVER.M;
    if (toLight < 2) return LINING.L;
    if (edge === 0 && toLight > 3) return SILVER.S;
    const away = Math.min(run(s, x, y, -ls, 1, 4), run(s, x, y, -ls, 0, 4) + 1);
    if (away < 3) return LINING.S;
    return LINING.M;
  });
  // a pale crescent sigil on the sail
  const cx = Math.round(lerp(backX, R[0] + 7, k));
  const cy = R[1] + 10;
  if (k > 0.6) {
    for (const [dx, dy] of [[0, -2], [-1, -1], [-1, 0], [-1, 1], [0, 2], [1, 2]] as const) q.set(cx + dx, cy + dy, SILVER.M);
    q.set(cx + 1, cy - 1, SILVER.S);
  }
  widenTeeth(q, R[1] + 15);
  f.comp.add(q, Part.shell, { out: PAL.void0 });
}

// ---------------------------------------------------------------- passes (light, dissolve)

/** Deterministic 0..1 hash of an integer cell. */
export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Star-dust dissolve / gather in 2×2 clusters of root space (the pattern rides the body, never crawls),
 * from the hat down. Dissolve: the front goes void0, then the clusters are gone and dusk dust rises off
 * them (a few gold stars among it). Gather: the same front runs backwards — the cluster just forming is a
 * lit star band (white / void4), the not-yet-formed clusters are empty and stars drift in toward the body.
 */
function dissolvePass(f: Frame, sk: Skel): void {
  const { p, comp, o } = f;
  if (o.diss <= 0) return;
  const R = sk.R;
  const front = 0.1;
  const gone: number[] = [];
  const mark: number[] = [];
  const motes: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!p.isOpaque(x, y)) continue;
      let part = comp.id[y * W + x] as Part;
      if (part === Part.none) {
        for (const [ddx, ddy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
          const nx = x + ddx;
          const ny = y + ddy;
          if (nx >= 0 && nx < W && ny >= 0 && ny < H && comp.id[ny * W + nx] !== Part.none) {
            part = comp.id[ny * W + nx] as Part;
            break;
          }
        }
      }
      if (part === Part.moon) continue;
      const rx = x - R[0];
      const ry = y - R[1];
      const cx = fl(rx / 2);
      const cy = fl(ry / 2);
      const u = clamp((ry + 52) / 84, 0, 1);
      const thr = 0.86 * u + 0.14 * hash2(cx, cy, 7);
      if (thr < o.diss - front) {
        gone.push(x, y);
        if (!o.gather && (rx & 1) === 0 && (ry & 1) === 0 && hash2(cx, cy, 11) < 0.16) {
          const rise = 2 + (o.diss - front - thr) * 70;
          if (rise < 18) {
            const gold = hash2(cx, cy, 19) < 0.22;
            motes.push(x + Math.round(Math.sin(cy * 1.7 + rise * 0.3)), y - Math.round(rise), gold ? (rise < 9 ? PAL.gold3 : PAL.gold2) : rise < 8 ? PAL.void2 : PAL.void1);
          }
        }
      } else if (thr < o.diss) mark.push(x, y);
    }
  for (let i = 0; i < gone.length; i += 2) {
    p.erase(gone[i], gone[i + 1]);
    comp.id[gone[i + 1] * W + gone[i]] = Part.none;
  }
  for (let i = 0; i < mark.length; i += 2) {
    if (p.get(mark[i], mark[i + 1]) === PAL.ink) continue;
    p.set(mark[i], mark[i + 1], o.gather ? ((fl((mark[i] - R[0]) / 2) + fl((mark[i + 1] - R[1]) / 2)) & 1 ? PAL.white : PAL.void4) : PAL.void0);
  }
  for (let i = 0; i < motes.length; i += 3) if (!p.isOpaque(motes[i], motes[i + 1])) p.set(motes[i], motes[i + 1], motes[i + 2]);
  if (o.gather) {
    // stars drifting in toward the forming band
    const n = 4;
    for (let i = 0; i < n; i++) {
      const a = hash2(i, 3, 5) * TAU;
      const d = (1 - o.diss) * 22 * (0.4 + hash2(i, 9, 2)) + 2;
      const bx = R[0] + 4 + Math.cos(a) * 12;
      const by = R[1] - 52 + o.diss * 84 + Math.sin(a) * 6;
      const sx = Math.round(bx + Math.cos(a) * d);
      const sy = Math.round(by + Math.sin(a) * d * 0.6 - d * 0.4);
      if (!p.isOpaque(sx, sy)) p.set(sx, sy, i % 3 === 0 ? PAL.white : i % 3 === 1 ? PAL.gold3 : PAL.void4);
    }
  }
}

/** The moon gate under the feet (summon / revive): a stepped dark lens with a lit rim, stars circling it. */
function gatePass(f: Frame, sk: Skel): void {
  const { p, o } = f;
  if (o.gate <= 0) return;
  const cx = sk.R[0] + 4;
  const cy = GROUND_Y - 1;
  const a = 5 + 24 * o.gate;
  const b = 1.5 + 8.5 * o.gate;
  const inside = (x: number, y: number, ka: number, kb: number) => {
    const u = (x + 0.5 - cx) / ka;
    const v = (y + 0.5 - cy) / kb;
    return u * u + v * v < 1;
  };
  for (let y = Math.floor(cy - b - 1); y <= cy + b + 1; y++)
    for (let x = Math.floor(cx - a - 1); x <= cx + a + 1; x++) {
      if (!inside(x, y, a, b)) continue;
      const rim = !inside(x, y, a - 1.5, b - 1.2);
      const back = y + 0.5 < cy;
      let c: number;
      if (rim) c = back ? (o.gate > 0.6 && Math.abs(x + 0.5 - cx) < a * 0.3 ? PAL.void4 : PAL.void3) : PAL.void2;
      else c = inside(x, y, a * 0.72, b * 0.5) ? PAL.ink : PAL.void0;
      if (back) {
        if (!p.isOpaque(x, y)) p.set(x, y, c);
      } else if (!p.isOpaque(x, y) || c !== PAL.ink) p.set(x, y, c);
    }
  // stars circling the rim
  const n = 5;
  for (let i = 0; i < n; i++) {
    const ang = (o.t * 1.3 + i / n) * TAU;
    const sx = Math.round(cx + Math.cos(ang) * (a + 1));
    const sy = Math.round(cy + Math.sin(ang) * (b + 1));
    if (!p.isOpaque(sx, sy)) p.set(sx, sy, i % 2 ? PAL.gold3 : PAL.white);
  }
}

/** The slam's ring on the floor: two stepped violet ellipses (outer void3, inner void2) that widen and thin. */
function ringPass(f: Frame, sk: Skel): void {
  const { p, o } = f;
  if (o.ring <= 0) return;
  const cx = sk.R[0] + o.rx;
  const cy = sk.R[1] + o.ry;
  const a = 5 + 22 * o.ring;
  const b = a * 0.36;
  const ell = (x: number, y: number, ka: number, kb: number) => {
    const u = (x + 0.5 - cx) / ka;
    const v = (y + 0.5 - cy) / kb;
    return u * u + v * v;
  };
  for (let y = Math.floor(cy - b - 2); y <= cy + b + 2; y++)
    for (let x = Math.floor(cx - a - 2); x <= cx + a + 2; x++) {
      if (p.isOpaque(x, y)) continue;
      const e = ell(x, y, a, b);
      if (e < 1 && e > (1 - 1.7 / a) ** 2 * 1) p.set(x, y, o.ring < 0.55 ? PAL.void4 : PAL.void3);
      else if (o.ring > 0.25) {
        const e2 = ell(x, y, a * 0.66, b * 0.66);
        if (e2 < 1 && e2 > (1 - 1.3 / (a * 0.66)) ** 2) p.set(x, y, PAL.void2);
      }
    }
}

/** hitMagic: short crackles over the coat and the arm (white core, mag / void4 branches). */
function zapPass(f: Frame, sk: Skel): void {
  const { p, comp, o } = f;
  if (o.zap <= 0) return;
  const R = sk.R;
  const starts: [number, number, number, number][] = [
    [R[0] + 5, R[1] - 16, 0.55 * Math.PI, 0],
    [sk.h1[0] - 6, sk.h1[1] + 3, 0.2 * Math.PI, 1],
    [R[0] - 6, R[1] + 2, 0.7 * Math.PI, 2],
    [sk.head[0] + 8, sk.head[1] + 4, 0.3 * Math.PI, 3],
  ];
  const ph = fl(o.t * 16);
  for (const [x0, y0, a0, k] of starts) {
    const len = Math.round(2 + 6 * o.zap);
    let x = x0;
    let y = y0;
    for (let i = 0; i < len; i++) {
      const j = hash2(i, ph, k * 13 + 5);
      const a = a0 + (j - 0.5) * 1.8;
      x += Math.round(Math.cos(a) * 1.5);
      y += Math.round(Math.sin(a) * 1.5);
      const part = comp.id[y * W + x];
      if (!p.isOpaque(x, y) || part === Part.moon || part === Part.head) continue;
      p.set(x, y, i === 0 || (i === len - 1 && o.zap > 0.6) ? PAL.white : i % 2 ? PAL.void4 : PAL.mag3);
    }
  }
}

/** Motes streaming into the hand (charge): a few void4 / white pixels on inward spirals. */
function chargePass(f: Frame, sk: Skel): void {
  const { p, o } = f;
  if (o.charge <= 0) return;
  const [fx, fy] = sk.flame;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const ph = (o.t * 2 + i / n) % 1;
    const a = (i / n) * TAU + ph * 2.4;
    const d = (1 - ph) * (7 + 7 * o.charge) + 2;
    const x = Math.round(fx + Math.cos(a) * d);
    const y = Math.round(fy - 5 + Math.sin(a) * d * 0.7);
    if (!p.isOpaque(x, y)) p.set(x, y, ph > 0.7 ? PAL.white : ph > 0.35 ? PAL.void4 : PAL.void3);
  }
}
