// Art Lab C — "Uçurum Büyücüsü" (variant C "Orijinal Neon, Yüksek Detay"): the ORIGINAL Neon
// Düello abyss magus (src/art/monsters/abyss_magus.ts) redrawn with variant A's craft.
//
// Identity kept from the original: a dark armoured sorcerer that FLOATS (hover 6) — a horned great
// helm in profile with a glowing magenta visor slit and a crest fin, two violet horns sweeping back
// and hooking up, a violet cowl with an abyss gem at the throat, broad steel pauldrons, a steel
// breastplate and a steel tabard with the abyssal eye sigil over a violet pleated skirt with a rune
// band and a pointed hem, a long night-blue cape (violet lining) behind, violet bell sleeves, a
// gauntlet round a void staff with a crescent claw holding the void orb. Same colours (steel armour,
// void cloth, night cape, magenta glow), same silhouette family, proportions ×1.2.
//
// What changed is the craft: the magus' own ramps derived from the neon palette (9 steel, 8 void,
// 8 cape, 6 glow tones; wizard-maps.ts), hand-authored rigid parts (helm + crest + vents, horns,
// visor glows, pauldrons with lames, gauntlets round the shaft, gem, sigil, orbs with a drawn
// swirl), cloth in clean tone bands with hand-placed fold clusters (the skirt's pleats, the cape's
// three folds and its turned violet lining) that lag behind the body, a selective outline (ink on
// the shadow side, a darker tone of the part's own ramp on its lit top / back edges) and a void
// rim on the front edges away from the key light, with a crimson bounce from the P2 mat under the
// hem. Every frame is an explicitly keyed pose with its own hold; lean, squash and the collapse are
// drawn by moving the skeleton (waist, neck, helm, hands) and re-laying the cloth — the sprite is
// never scaled, rotated or shaken.
//
// Drawn facing RIGHT (the lab mirrors it), 1 art px = 1 game px, key light from the upper left
// (the original's). Frame and anchor: see FRAME below.

import { PixelCanvas } from '../../art/pixel';
import type { LabAnim, LabFramePoints, LabMonsterArt, WizardAnim } from '../types';
import {
  C_ARMOR,
  C_CAPE,
  C_GLOW,
  C_INK,
  C_VOID,
  BREASTPLATE,
  BUCKLE,
  GEM,
  GEM_DIM,
  GLYPHS,
  HANDS,
  HELM,
  HORN_FAR,
  HORN_NEAR,
  ORBS,
  ORB_SWIRL,
  PAULDRON_BACK,
  PAULDRON_FRONT,
  SIGIL,
  VISOR,
  type HandKind,
  type VisorKind,
} from './wizard-maps';
import { bands, bez, clamp, clip, composite, edge, foldBands, hash2, ik, info, lerp, linePx, rimPass, selectiveOutline, stamp, stepColor, type FoldBand, type V2 } from './wizard-rig';

// ------------------------------------------------------------------ frame

const W = 119;
const H = 121;
/** anchor column (body centre) and anchor row (the hem's lowest row at rest, floating) */
const GX = 47;
const GY = 95;
const HOVER = 6;
/** the floor under the float (frame row) */
const FY = GY + HOVER;

const A = C_ARMOR;
const V = C_VOID;
const CP = C_CAPE;
const GL = C_GLOW;
const INK = C_INK.ink;

// ------------------------------------------------------------------ pose

interface Pose {
  /** Summon: px the whole magus is still below its float (clipped at the floor line). */
  sink: number;
  /** Float bob (px, + down) and whole-body shift (px, + forward). */
  bob: number;
  dx: number;
  /** Waist drop (px): the skirt shortens over a sunk / collapsed body. */
  waist: number;
  /** Neck offset from the waist (+x lean forward, +y squash down). */
  neck: V2;
  /** Helm offset from the neck; its tilt (whole-pixel row shear, + = crown forward). */
  head: V2;
  tilt: number;
  visor: VisorKind;
  /** Skirt: hem lag (px at the hem, + forward), hem widening, front pleat swing. */
  sway: number;
  flare: number;
  /** Cape: tip lag (px), flare 0..1 (lifts out and up), wrap 0..1 (pulled round the body). */
  capeX: number;
  capeY: number;
  capeFlare: number;
  wrap: number;
  /** Phase of the hem / cape ripple (0..1). */
  t: number;
  /** Front hand (the grip) relative to the neck; its gauntlet; the sleeve bell droop + lag. */
  hand: V2;
  glove: HandKind | 'none';
  droop: number;
  lag: number;
  /** Back hand relative to the neck. */
  back: V2;
  /** Staff angle (deg, 0 up, + top forward), grip → top length. */
  staff: number;
  hold: number;
  /** Dropped staff: foot position (frame px) — the hand lets go. */
  free: V2 | null;
  staffBehind: boolean;
  /** The staff head + orb pass behind the body too (wind-up). */
  orbBehind: boolean;
  /** Orb map, swirl quarter turn, glow 0..1, drawn sparkles, release burst. */
  orb: number;
  swirl: number;
  glow: number;
  spark: number;
  flash: number;
  /** Runes (hem glyphs, sigil, cuff) brightness 0..2. */
  rune: number;
  /** Summon: the void rift on the floor (0 none .. 1 open). */
  rift: number;
  /** Death: erosion progress 0..1. */
  erode: number;
}

const REST: Pose = {
  sink: 0,
  bob: 0,
  dx: 0,
  waist: 0,
  neck: [0, 0],
  head: [0, 0],
  tilt: 0,
  visor: 'open',
  sway: 0,
  flare: 0,
  capeX: 0,
  capeY: 0,
  capeFlare: 0,
  wrap: 0,
  t: 0,
  hand: [17, 21],
  glove: 'grip',
  droop: 3,
  lag: 0,
  back: [-15, 21],
  staff: 3,
  hold: 22,
  free: null,
  staffBehind: false,
  orbBehind: false,
  orb: 0,
  swirl: 0,
  glow: 0.5,
  spark: 0,
  flash: 0,
  rune: 0.6,
  rift: 0,
  erode: 0,
};

const STAFF_LEN = 54;

interface Geo {
  waist: V2;
  neck: V2;
  helm: V2;
  hemY: number;
  grip: V2;
  bhand: V2;
  dir: V2;
  top: V2;
  foot: V2;
  orb: V2;
  orbR: number;
  eye: V2;
}

function staffDir(deg: number): V2 {
  const r = (deg * Math.PI) / 180;
  return [Math.sin(r), -Math.cos(r)];
}

function geometry(ps: Pose): Geo {
  const by = ps.bob + ps.sink;
  const waist: V2 = [GX + 1 + ps.dx, GY - 37 + by + ps.waist];
  const neck: V2 = [waist[0] + ps.neck[0], GY - 55 + by + ps.waist + ps.neck[1]];
  const helm: V2 = [neck[0] + ps.head[0], neck[1] + ps.head[1]];
  const hemY = GY + by;
  const grip: V2 = [neck[0] + ps.hand[0], neck[1] + ps.hand[1]];
  const bhand: V2 = [neck[0] + ps.back[0], neck[1] + ps.back[1]];
  const dir = staffDir(ps.staff);
  let top: V2;
  let foot: V2;
  if (ps.free) {
    foot = [ps.free[0], ps.free[1]];
    top = [foot[0] + dir[0] * STAFF_LEN, foot[1] + dir[1] * STAFF_LEN];
  } else {
    top = [grip[0] + dir[0] * ps.hold, grip[1] + dir[1] * ps.hold];
    foot = [grip[0] - dir[0] * (STAFF_LEN - ps.hold), grip[1] - dir[1] * (STAFF_LEN - ps.hold)];
  }
  const orbR = ORBS[ps.orb].ax;
  const orb: V2 = [Math.round(top[0] + dir[0] * (orbR + 3)), Math.round(top[1] + dir[1] * (orbR + 3))];
  const eye: V2 = [Math.round(helm[0]) + 7, Math.round(helm[1]) - 9];
  return { waist, neck, helm, hemY, grip, bhand, dir, top, foot, orb, orbR, eye };
}

// ------------------------------------------------------------------ part ids (erosion order)

const PART = { cape: 1, horn: 2, sleeve: 3, skirt: 4, staff: 5, armor: 6, helm: 7, visor: 8 } as const;

class Painter {
  readonly p = new PixelCanvas(W, H);
  readonly part = new Uint8Array(W * H);
  add(q: PixelCanvas, id: number, shade = 1): void {
    composite(this.p, q, shade);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (q.isOpaque(x, y)) this.part[y * W + x] = id;
  }
}

const layer = () => new PixelCanvas(W, H);

// ------------------------------------------------------------------ cloth: cape

function drawCape(pt: Painter, ps: Pose, g: Geo): void {
  const fl = ps.capeFlare;
  const [nx, ny] = g.neck;
  const top0: V2 = [nx - 11, ny + 3];
  const wr = ps.wrap;
  const tip: V2 = [GX - 33 + ps.dx * 0.5 + ps.capeX - fl * 4 + wr * 22, g.hemY - 1 + ps.capeY - fl * 10 - wr * 2];
  const outer = bez(top0, [top0[0] - 4 + wr * 3, top0[1] + 13 - fl * 3], [tip[0] + 9 + fl * 3 - wr * 4, tip[1] - 16 + fl * 4], tip, 18);
  // ripple travelling down the outer edge
  const edgePts: V2[] = outer.map(([x, y], i) => {
    const s = i / 18;
    return [x + Math.sin((s * 1.4 - ps.t) * Math.PI * 2) * 0.9 * s, y];
  });
  const R: V2 = [GX + 7 + ps.dx + ps.capeX * 0.25, g.hemY - 3 + ps.capeY * 0.3];
  const hem: V2[] = [];
  const N = 6;
  for (let i = 1; i < N; i++) {
    const s = i / N;
    const x = lerp(tip[0], R[0], s);
    const y = lerp(tip[1], R[1], s) + (i % 2 ? -3.5 - Math.sin((ps.t + s) * Math.PI * 2) * 0.8 : 0.5);
    hem.push([x, y]);
  }
  const shape: V2[] = [[nx + 7, ny + 3], ...edgePts, ...hem, R, [g.waist[0] + 5, g.waist[1] + 2]];
  // lining: the turned outer edge shows the violet inside, and under the hem
  const lin = layer();
  lin.poly(shape.map(([x, y]) => [x - 1.1 - fl, y + 0.8] as V2), V[4]);
  lin.poly(shape.map(([x, y]) => [x + 1.2, y + 1.4 + fl * 1.5] as V2), V[2]);
  edge(lin, -1, 0, () => V[5]);
  edge(lin, 0, 1, () => V[1]);
  pt.add(lin, PART.cape, 0);

  const q = layer();
  q.poly(shape, CP[3]);
  bands(q, (u, v) => {
    const i = u < 0.06 ? 7 : u < 0.16 ? 6 : u < 0.42 ? 5 : 4;
    return CP[clamp(i - (v > 0.9 ? 1 : 0), 0, 7)];
  });
  // folds: three creases fanning from under the shoulder blade to the hem notches — a lit ridge
  // left of each crease, a shadow wedge right of it widening toward the hem
  const folds: FoldBand[] = [];
  for (let i = 0; i < hem.length; i += 2) {
    const [hx, hy] = hem[i];
    const from: V2 = [nx - 8 + i * 1.5, ny + 8 + i * 2];
    const mid: V2 = [lerp(from[0], hx, 0.55) - 1 - fl * 3, lerp(from[1], hy, 0.55)];
    folds.push({ pts: bez(from, mid, [hx, hy], null, 16), ridge: i === 0 ? 2 : 1, lift: i === 0 ? 1 : 2, deep: 2, w0: 0, w1: i === 4 ? 2 : 3, fade: 3 });
  }
  foldBands(q, folds);
  pt.add(q, PART.cape, 0);
}

/**
 * Summon: the cape pulled round the FRONT of the body like a cocoon — its front edge runs down from
 * the near shoulder to the hem, further forward the tighter it is wrapped (wrap 1 covers the robe);
 * the turned edge shows the violet lining, two folds hang from the shoulders.
 */
function drawWrap(pt: Painter, ps: Pose, g: Geo): void {
  const wr = ps.wrap;
  const [nx, ny] = g.neck;
  const hy = g.hemY;
  const ex = GX + ps.dx + lerp(-6, 19, wr);
  const q = layer();
  const pts: V2[] = [[nx - 10, ny + 3], [nx - 2, ny + 1], [nx + 9, ny + 3], [ex + 1, hy - 8], [ex, hy - 1]];
  const n = 6;
  const x0 = GX + ps.dx - 17;
  for (let i = 1; i < n; i++) {
    const x = lerp(ex, x0, i / n);
    pts.push([x, hy - (i % 2 ? 3.5 : 0)]);
  }
  pts.push([x0, hy - 2], [x0 + 3, hy - 16], [nx - 12, ny + 12]);
  q.poly(pts, CP[5]);
  bands(q, (u, v) => CP[clamp((u < 0.12 ? 6 : u < 0.5 ? 5 : u < 0.85 ? 4 : 3) - (v > 0.9 ? 1 : 0), 0, 7)]);
  foldBands(q, [
    { pts: bez([nx - 5, ny + 8], [nx - 7, ny + 24], [GX + ps.dx - 9, hy - 3], null, 14), ridge: 2, lift: 1, deep: 2, w0: 0, w1: 3, fade: 3 },
    { pts: bez([nx + 3, ny + 8], [nx + 3, ny + 24], [GX + ps.dx + 3, hy - 3], null, 14), ridge: 1, lift: 1, deep: 2, w0: 0, w1: 3, fade: 3 },
  ]);
  edge(q, 1, 0, () => V[5]);
  pt.add(q, PART.cape, 1);
}

// ------------------------------------------------------------------ cloth: skirt + tabard

function drawSkirt(pt: Painter, ps: Pose, g: Geo): void {
  const [wx, wy] = g.waist;
  const hy = g.hemY;
  const len = Math.max(6, hy - wy);
  const sw = ps.sway;
  const fl = ps.flare;
  // lagging hem: x offset grows down the skirt
  const L = (x: number, y: number): V2 => [x + sw * Math.pow(clamp((y - wy) / len, 0, 1), 1.4), y];
  const tips: V2[] = [];
  const xs = [-17, -12.5, -8, -3.5, 1, 5.5, 10, 14.5, 19];
  for (let i = xs.length - 1; i >= 0; i--) {
    const tip = i % 2 === 0;
    const x = GX + ps.dx + xs[i] * (1 + fl * 0.04) + (i - 4) * fl * 0.35;
    const ph = Math.sin((ps.t + i * 0.13) * Math.PI * 2);
    const y = tip ? hy - Math.abs(i - 4) * 0.35 + (tip ? ph * 0.5 : 0) : hy - 4 - Math.abs(i - 4) * 0.2;
    tips.push(L(x + (tip ? ph * 0.6 : 0), y));
  }
  const shape: V2[] = [
    [wx - 7, wy - 1],
    [wx + 8, wy - 1],
    L(wx + 11 + fl * 0.4, wy + len * 0.35),
    L(GX + ps.dx + 18.5 + fl, hy - 6),
    ...tips,
    L(GX + ps.dx - 17 - fl, hy - 6),
    L(wx - 11 - fl * 0.4, wy + len * 0.4),
  ];
  const q = layer();
  q.poly(shape, V[4]);
  bands(q, (u, v) => {
    let i = u < 0.06 ? 6 : u < 0.32 ? 5 : u < 0.62 ? 4 : u < 0.86 ? 3 : 2;
    if (v < 0.12) i -= 1; // under the belt
    return V[clamp(i, 1, 6)];
  });
  // pleats: hand-placed creases from under the belt fanning out to the hem notches (tips[] runs
  // front → back: odd entries are the notches)
  const pleat = (ax: number, ay: number, k: number, bend: number, ridge: number, w1: number): FoldBand => {
    const from: V2 = [wx + ax, wy + ay];
    const to = tips[k];
    const mid: V2 = [lerp(from[0], to[0], 0.5) + bend, lerp(from[1], to[1], 0.5)];
    return { pts: bez(from, mid, [to[0], to[1] - 1], null, 16), ridge, lift: 1, deep: 2, w0: 0, w1, fade: 3 };
  };
  foldBands(q, [pleat(-6, 3, 7, -1, 2, 3), pleat(-3, 7, 5, 0, 1, 2), pleat(8, 3, 1, 1, 1, 3), pleat(6, 8, 3, 0, 1, 2)]);
  clip(q, (t) => {
    // the rune band above the hem: a dark embroidered strip with glyphs glowing in a wave
    const by = Math.round(hy - 11);
    for (let x = wx - 26; x < wx + 28; x++) {
      const [bx] = L(x, by);
      t.set(bx, by, V[1]);
      t.set(bx, by + 1, V[1]);
      t.set(bx, by + 2, V[1]);
      t.set(bx, by + 3, V[0]);
      t.set(bx, by - 1, V[2]);
    }
    for (let i = 0; i < 7; i++) {
      const [gx] = L(GX + ps.dx - 14 + i * 5, by);
      const lit = clamp((Math.sin((ps.t - i * 0.12) * Math.PI * 2) * 0.5 + 0.5) * ps.rune, 0, 2);
      const x0 = lit > 1.2 ? GL[4] : lit > 0.6 ? V[6] : lit > 0.25 ? V[5] : V[3];
      const y0 = lit > 1.2 ? GL[5] : lit > 0.45 ? GL[3] : V[5];
      const gm = GLYPHS[i % GLYPHS.length];
      for (let j = 0; j < 3; j++)
        for (let ii = 0; ii < 3; ii++) {
          const ch = gm[j][ii];
          if (ch !== '.') t.set(Math.round(gx) + ii - 1, by + j, ch === 'y' ? y0 : x0);
        }
    }
  });
  // hem underside
  edge(q, 0, 1, (c) => stepColor(c, -2));
  pt.add(q, PART.skirt, 1);

  // tabard: the steel front panel from the belt to a point below the hem
  const tb = layer();
  const tpts: V2[] = [[wx - 2.5, wy + 1], [wx + 4.5, wy + 1], L(wx + 5, wy + len * 0.5), L(wx + 5.5, hy - 3), L(wx + 1.5, hy + 1.5), L(wx - 2.5, hy - 3), L(wx - 3, wy + len * 0.5)];
  tb.poly(tpts, CP[5]);
  bands(tb, (u) => CP[u < 0.3 ? 6 : u < 0.68 ? 5 : 4]);
  edge(tb, 1, 0, () => CP[3]);
  edge(tb, -1, 0, () => CP[7]);
  clip(tb, (t) => {
    // a lit lip and a dark trim row across the bottom
    const yb = Math.round(hy - 6);
    for (let x = wx - 5; x < wx + 8; x++) {
      const [bx] = L(x, yb);
      t.set(bx, yb - 1, V[5]);
      t.set(bx, yb, V[3]);
      t.set(bx, yb + 1, CP[2]);
    }
    const [sx, sy] = L(wx + 1, wy + 9);
    const r = ps.rune;
    stamp(t, SIGIL, sx, sy, {
      key: {
        f: r > 0.5 ? V[6] : V[5],
        g: r > 0.9 ? V[7] : V[6],
        e: r > 0.4 ? V[5] : V[4],
        d: r > 0.3 ? V[4] : V[3],
        s: r > 1.3 ? GL[5] : r > 0.55 ? GL[3] : GL[2],
      },
    });
  });
  pt.add(tb, PART.armor, 1);
}

// ------------------------------------------------------------------ torso

function drawTorso(pt: Painter, ps: Pose, g: Geo): void {
  const [wx, wy] = g.waist;
  const [nx, ny] = g.neck;
  const q = layer();
  const lean = nx - wx;
  stamp(q, BREASTPLATE, wx, wy, { rowShift: (j) => (lean * (BREASTPLATE.ay - j)) / 18 });
  stamp(q, BUCKLE, wx + 1, wy);
  pt.add(q, PART.armor, 1);

  // cowl: violet cloth round the neck under the helm, the abyss gem at the throat
  const m = layer();
  m.poly([[nx - 8, ny + 2], [nx - 5, ny - 1.5], [nx, ny - 2.5], [nx + 6, ny - 1], [nx + 9, ny + 2], [nx + 5, ny + 5], [nx + 1, ny + 6], [nx - 4, ny + 5]], V[4]);
  bands(m, (u, v) => (v > 0.75 ? V[2] : u < 0.25 ? V[6] : u < 0.55 ? V[5] : u < 0.8 ? V[4] : V[3]));
  stamp(m, ps.glow > 0.3 ? GEM : GEM_DIM, nx + 1, ny + 3);
  pt.add(m, PART.armor, 1);
}

// ------------------------------------------------------------------ arms

/** A bell sleeve along shoulder → elbow → wrist, widening, its bell hanging below the cuff. */
function sleeve(q: PixelCanvas, s: V2, e: V2, w: V2, w0: number, w1: number, w2: number, droop: number, lag: number, ramp: (u: number) => number): void {
  const pts = [s, e, w];
  const ws = [w0, w1, w2];
  const up: V2[] = [];
  const dn: V2[] = [];
  for (let i = 0; i < 3; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(2, i + 1)];
    let ux = b[0] - a[0];
    let uy = b[1] - a[1];
    const l = Math.hypot(ux, uy) || 1;
    ux /= l;
    uy /= l;
    let nx = -uy;
    let ny = ux;
    if (ny < 0 || (ny === 0 && nx < 0)) {
      nx = -nx;
      ny = -ny;
    }
    const h = ws[i] / 2;
    up.push([pts[i][0] - nx * h, pts[i][1] - ny * h]);
    dn.push([pts[i][0] + nx * h, pts[i][1] + ny * h]);
  }
  const hang: V2 = [dn[2][0] - 1 + lag, dn[2][1] + droop];
  const hang2: V2 = [lerp(dn[1][0], dn[2][0], 0.5) + lag * 0.5, lerp(dn[1][1], dn[2][1], 0.5) + droop * 0.5];
  q.poly([up[0], up[1], up[2], dn[2], hang, hang2, dn[1], dn[0]], V[4]);
  bands(q, (u) => ramp(u));
}

function drawFrontArm(pt: Painter, ps: Pose, g: Geo): void {
  const S: V2 = [g.neck[0] + 9, g.neck[1] + 6];
  const hand = g.grip;
  const el = ik(S, hand, 9, 9.5, 1);
  const dx = hand[0] - el[0];
  const dy = hand[1] - el[1];
  const l = Math.hypot(dx, dy) || 1;
  const wrist: V2 = [hand[0] - (dx / l) * 2.5, hand[1] - (dy / l) * 2.5];
  const q = layer();
  if (ps.glove !== 'none' && !ps.free) {
    sleeve(q, S, el, wrist, 6, 6, 9, ps.droop, ps.lag - ps.sway * 0.3, (u) => V[u < 0.22 ? 6 : u < 0.55 ? 5 : u < 0.85 ? 4 : 3]);
    edge(q, 0, 1, (c) => stepColor(c, -2));
    // the rune cuff, then the dark sleeve mouth
    const cx = wrist[0] - (dx / l) * 2;
    const cy = wrist[1] - (dy / l) * 2;
    clip(q, (t) => {
      for (const [x, y] of linePx(cx + (dy / l) * 5, cy - (dx / l) * 5, cx - (dy / l) * 5, cy + (dx / l) * 5)) t.set(x, y, ps.rune > 0.7 ? V[7] : V[6]);
    });
    q.disc(wrist[0] + (dx / l) * 0.5, wrist[1] + (dy / l) * 0.5, 1.6, V[0]);
  } else {
    // the limp arm of the collapse: the sleeve hangs from the shoulder
    sleeve(q, S, [S[0] + 3, S[1] + 8], [S[0] + 4, S[1] + 15], 6, 6, 8, ps.droop, ps.lag, (u) => V[u < 0.22 ? 6 : u < 0.55 ? 5 : u < 0.85 ? 4 : 3]);
  }
  pt.add(q, PART.sleeve, 1);
  if (ps.glove !== 'none') {
    const gq = layer();
    if (ps.free) stamp(gq, HANDS.limp, S[0] + 4, S[1] + 16);
    else stamp(gq, HANDS[ps.glove], hand[0], hand[1]);
    pt.add(gq, PART.armor, 1);
  }
}

function drawBackArm(pt: Painter, ps: Pose, g: Geo): void {
  const S: V2 = [g.neck[0] - 10, g.neck[1] + 6];
  const hand = g.bhand;
  const el = ik(S, hand, 9, 9, -1);
  const q = layer();
  sleeve(q, S, el, [hand[0] - 0.5, hand[1] - 2], 5, 5.5, 7.5, 3, -ps.sway * 0.3, (u) => V[u < 0.3 ? 4 : u < 0.75 ? 3 : 2]);
  stamp(q, HANDS.claw, hand[0], hand[1]);
  pt.add(q, PART.sleeve, 1);
}

// ------------------------------------------------------------------ helm + horns

function drawHead(pt: Painter, ps: Pose, g: Geo, part: 'far' | 'helm' | 'near'): void {
  const hx = Math.round(g.helm[0]);
  const hy = Math.round(g.helm[1]);
  const tilt = ps.tilt;
  // the helm tilts by whole-pixel row shifts around its throat (+ = crown forward)
  const shift = (rowsFromTop: number, total: number) => Math.round(tilt * ((total - rowsFromTop) / total));
  const q = layer();
  if (part === 'far') {
    stamp(q, HORN_FAR, hx + 3, hy - 15, { rowShift: (j) => shift(j - HORN_FAR.ay + 4, 19) });
    pt.add(q, PART.horn, 0);
    return;
  }
  if (part === 'near') {
    stamp(q, HORN_NEAR, hx - 3, hy - 13, { rowShift: (j) => shift(j - HORN_NEAR.ay + 6, 19) });
    pt.add(q, PART.horn, 1);
    return;
  }
  stamp(q, HELM, hx, hy, { rowShift: (j) => shift(j, 19) });
  pt.add(q, PART.helm, 1);
  const v = layer();
  stamp(v, VISOR[ps.visor], hx + 2, hy - 9, { rowShift: (j) => shift(10 + j, 19) });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (v.isOpaque(x, y) && pt.p.isOpaque(x, y)) pt.p.set(x, y, v.get(x, y)!), (pt.part[y * W + x] = PART.visor);
}

function drawPauldron(pt: Painter, g: Geo, front: boolean): void {
  const q = layer();
  if (front) stamp(q, PAULDRON_FRONT, g.neck[0] + 9, g.neck[1] + 5);
  else stamp(q, PAULDRON_BACK, g.neck[0] - 11, g.neck[1] + 5);
  pt.add(q, PART.armor, front ? 1 : 0);
}

// ------------------------------------------------------------------ staff + orb

function drawShaft(pt: Painter, ps: Pose, g: Geo): void {
  const q = layer();
  const px = linePx(g.foot[0], g.foot[1], g.top[0], g.top[1]);
  const n = px.length;
  // the second (shade) column / row sits on the side away from the key light
  const ox = Math.abs(g.dir[1]) > 0.5 ? 1 : 0;
  const oy = ox ? 0 : 1;
  px.forEach(([x, y], i) => {
    const dTop = n - 1 - i;
    q.set(x, y, V[4]);
    q.set(x + ox, y + oy, V[2]);
    // glowing wraps under the head, a steel collar, a steel ferrule at the foot
    if (dTop === 4 || dTop === 8) {
      q.set(x, y, V[7]);
      q.set(x + ox, y + oy, V[5]);
    } else if (dTop <= 1) {
      q.set(x, y, A[6]);
      q.set(x + ox, y + oy, A[3]);
    } else if (i <= 2) {
      q.set(x, y, i === 0 ? A[7] : A[5]);
      q.set(x + ox, y + oy, A[3]);
    }
  });
  pt.add(q, PART.staff, 1);
}

function drawStaffHead(pt: Painter, ps: Pose, g: Geo): void {
  const q = layer();
  const [ox, oy] = g.orb;
  const [dx, dy] = g.dir;
  const nx = -dy;
  const ny = dx;
  const R = g.orbR + 1.5;
  // crescent claw cupping the orb from below: two prongs whose tips curl up past its equator
  for (const side of [-1, 1]) {
    for (let k = 0; k <= 12; k++) {
      const th = (k / 12) * 1.95; // 0 = straight below the orb .. ~112°
      const along = -Math.cos(th) * R;
      const across = Math.sin(th) * R * side;
      const x = Math.round(ox + dx * along + nx * across);
      const y = Math.round(oy + dy * along + ny * across);
      const lit = side * nx < 0 || (side * nx === 0 && side < 0);
      q.set(x, y, k > 10 ? A[7] : lit ? A[5] : A[3]);
    }
  }
  // the socket where the claw meets the shaft
  const sx = Math.round(ox - dx * (R + 1));
  const sy = Math.round(oy - dy * (R + 1));
  q.set(sx, sy, A[5]);
  q.set(sx - 1, sy, A[6]);
  q.set(sx + 1, sy, A[3]);
  q.set(sx, sy + 1, A[2]);
  pt.add(q, PART.staff, 1);
  // the orb + its swirl (turned in quarter steps)
  const o = layer();
  stamp(o, ORBS[ps.orb], ox, oy);
  if (ps.orb !== 3 && ps.orb !== 4) {
    const sw = ORB_SWIRL[ps.orb];
    const turn = ((ps.swirl % 4) + 4) % 4;
    sw.rows.forEach((row, j) =>
      [...row].forEach((ch, i) => {
        if (ch === '.') return;
        let a = i - sw.ax;
        let b = j - sw.ay;
        for (let r = 0; r < turn; r++) [a, b] = [-b, a];
        const c = ({ b: V[1], c: V[2], d: V[3], e: V[4], f: V[5], t: GL[4] } as Record<string, number>)[ch];
        // the dark arms pass under the specular (the white stays on top)
        if (c === undefined || (ps.orb !== 2 && o.get(ox + a, oy + b) === GL[5])) return;
        o.set(ox + a, oy + b, c);
      }),
    );
  }
  pt.add(o, PART.staff, 0);
}

// ------------------------------------------------------------------ glow pass (unoutlined light)

const SPARKS: V2[][] = [
  [],
  [
    [-9, -3],
    [8, -7],
    [3, 9],
  ],
  [
    [-10, -5],
    [9, -9],
    [-7, 8],
    [11, 3],
    [0, -12],
  ],
];

function glowPass(p: PixelCanvas, ps: Pose, g: Geo): void {
  const put = (x: number, y: number, c: number) => {
    if (!p.isOpaque(x, y)) p.set(x, y, c);
  };
  const [ox, oy] = g.orb;
  SPARKS[ps.spark].forEach(([dx, dy], i) => {
    const x = ox + dx;
    const y = oy + dy;
    put(x, y, i % 2 ? GL[3] : V[7]);
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      put(x - 1, y, V[5]);
      put(x + 1, y, V[5]);
      put(x, y - 1, V[6]);
      put(x, y + 1, V[5]);
    }
  });
  if (ps.flash) {
    const r = g.orbR;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {
      const diag = dx !== 0 && dy !== 0;
      const from = r + (ps.flash === 1 ? 2 : 3);
      const to = from + (diag ? 1 : 3) - (ps.flash === 2 ? 1 : 0);
      for (let k = from; k <= to; k++) {
        const x = ox + Math.round((dx * k) / (diag ? 1.4 : 1));
        const y = oy + Math.round((dy * k) / (diag ? 1.4 : 1));
        put(x, y, ps.flash === 1 ? (k === from ? GL[5] : V[7]) : k === from ? V[6] : V[5]);
      }
    }
  }
  if (ps.visor === 'flare' || ps.visor === 'ignite') {
    // the visor's light streams forward out of the slit
    const [ex, ey] = g.eye;
    const n = ps.visor === 'ignite' ? 6 : 4;
    for (let i = 0; i < n; i++) put(ex + 5 + i, ey, i === 0 ? GL[4] : i < n - 2 ? GL[3] : GL[2]);
  }
}

// ------------------------------------------------------------------ rim + outline

const RIM = new Map<number, number>([
  [A[0], V[3]],
  [A[1], V[4]],
  [A[2], V[4]],
  [A[3], V[5]],
  [A[4], V[5]],
  [V[0], V[3]],
  [V[1], V[4]],
  [V[2], V[4]],
  [V[3], V[5]],
  [V[4], V[5]],
  [CP[0], V[3]],
  [CP[1], V[3]],
  [CP[2], V[4]],
  [CP[3], V[4]],
  [CP[4], V[5]],
]);

function finish(pt: Painter, ps: Pose, g: Geo): void {
  const p = pt.p;
  rimPass(p, (c, x, y) => {
    const id = pt.part[y * W + x];
    if (id === PART.staff) return null;
    return RIM.get(c) ?? null;
  });
  // crimson bounce from the P2 mat on the hem's underside
  const src = p.clone();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = src.get(x, y);
      if (c === null || src.isOpaque(x, y + 1) || y < g.hemY - 6) continue;
      const id = pt.part[y * W + x];
      if (id === PART.skirt || id === PART.cape) p.set(x, y, C_INK.bounce0);
    }
  selectiveOutline(p, FY, (_x, _y, side, nb) => {
    const k = info(nb);
    if (!k) return null;
    if (k.mat === 'glow') return GL[1];
    if (side === 'top' && k.mat === 'armor') return A[2];
    return null;
  });
}

// ------------------------------------------------------------------ summon rift

/**
 * The void rift on the mat the magus rises out of: an ellipse of the abyss (ink core, a violet swirl
 * ring, a bright lip at the back edge), drawn only around / under the body (its back half behind
 * the rising figure, its front half below the floor line, where the body is cut off).
 */
function drawRift(p: PixelCanvas, k: number): void {
  const cx = GX + 1;
  const cy = FY;
  const rx = 4 + 15 * k;
  const ry = 1.5 + 3.5 * k;
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
    for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      if (p.isOpaque(x, y)) continue;
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d = Math.hypot(dx, dy);
      if (d > 1) continue;
      const back = y < cy;
      let c: number;
      if (d > 0.82) c = back ? V[6] : V[4];
      else if (d > 0.62) c = back ? V[3] : V[2];
      else if (d > 0.4) c = hash2(x >> 1, y, 7) < 0.5 ? V[1] : V[2];
      else c = d > 0.2 ? V[0] : INK;
      p.set(x, y, c);
    }
}

// ------------------------------------------------------------------ death erosion

/** Erosion order per part: the cape's edges go first, the visor last. */
const ERODE_BASE: Record<number, number> = {
  [PART.cape]: 0,
  [PART.horn]: 0.1,
  [PART.sleeve]: 0.12,
  [PART.skirt]: 0.1,
  [PART.staff]: 0.18,
  [PART.armor]: 0.22,
  [PART.helm]: 0.3,
  [PART.visor]: 0.96,
};
const M = [V[0], V[1], V[2], V[3], V[4], V[5], V[6], V[7]];
const LUM = (c: number) => 0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255);
const M_LUM = M.map(LUM);
function voidIndex(c: number): number {
  const l = LUM(c);
  let best = 0;
  for (let i = 1; i < M.length; i++) if (Math.abs(M_LUM[i] - l) < Math.abs(M_LUM[best] - l)) best = i;
  return best;
}

/**
 * The body erodes into void pixels, drawn into the frame: from the silhouette edges inward (the
 * cape first, then cloth, armour, the helm; the visor's glow last) each pixel flares up the void
 * ramp and vanishes; one in six vanished pixels drifts up and away as a mote; what is left steps
 * gradually toward the void glow from the eroded edge inward.
 */
function erode(pt: Painter, e: number, g: Geo): void {
  const p = pt.p;
  const src = p.clone();
  const dist = new Float32Array(W * H).fill(99);
  const q: number[] = [];
  for (let i = 0; i < W * H; i++)
    if (!src.isOpaque(i % W, (i / W) | 0)) {
      dist[i] = 0;
      q.push(i);
    }
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi];
    const x = i % W;
    const y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const j = yy * W + xx;
      if (dist[j] > dist[i] + 1) {
        dist[j] = dist[i] + 1;
        q.push(j);
      }
    }
  }
  p.clear();
  const cx = g.waist[0];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = src.get(x, y);
      if (c === null) continue;
      const i = y * W + x;
      const part = pt.part[i];
      const base = ERODE_BASE[part] ?? 0.2;
      const T = part === PART.visor ? base : base + 0.5 * Math.min(1, dist[i] / 9) + 0.14 * hash2(x >> 1, y >> 1, 11) + 0.04 * hash2(x, y, 12);
      if (T >= e) {
        // what is left glows up the void ramp, from the eroded edge inward
        const k = clamp((e - (T - 0.35)) / 0.35, 0, 1);
        const mi = voidIndex(c);
        const lift = e < 0.3 || part === PART.visor ? 0 : Math.round(k * 2);
        p.set(x, y, lift ? M[clamp(mi + lift, 2, 6)] : c);
      } else if (T >= e - 0.07) {
        // the eroding rim flares: white-hot, then the magenta of the abyss
        p.set(x, y, (e - T) / 0.07 < 0.4 ? (hash2(x, y, 9) < 0.5 ? GL[4] : M[7]) : GL[3]);
      } else if (T >= e - 0.28 && hash2(x, y, 5) < 0.17) {
        const age = (e - 0.07 - T) / 0.21;
        const ddx = Math.round(Math.sign(x - cx) * age * (1 + 3 * hash2(x, y, 3)));
        const ddy = -Math.round(age * (3 + 9 * hash2(x, y, 4)));
        p.set(x + ddx, y + ddy, age < 0.45 ? M[5] : age < 0.75 ? M[4] : M[3]);
      }
    }
}

// ------------------------------------------------------------------ draw

function drawPose(ps: Pose): PixelCanvas {
  const g = geometry(ps);
  const pt = new Painter();
  drawCape(pt, ps, g);
  if (ps.staffBehind) drawShaft(pt, ps, g);
  if (ps.orbBehind) drawStaffHead(pt, ps, g);
  drawHead(pt, ps, g, 'far');
  if (ps.wrap <= 0.4) drawBackArm(pt, ps, g);
  drawSkirt(pt, ps, g);
  drawTorso(pt, ps, g);
  if (ps.wrap > 0.15) drawWrap(pt, ps, g);
  drawPauldron(pt, g, false);
  drawHead(pt, ps, g, 'helm');
  drawHead(pt, ps, g, 'near');
  drawPauldron(pt, g, true);
  if (!ps.staffBehind) drawShaft(pt, ps, g);
  drawFrontArm(pt, ps, g);
  if (!ps.orbBehind) drawStaffHead(pt, ps, g);
  // the floor: while the summon rises out of the rift nothing shows below the floor line
  if (ps.sink > HOVER) for (let y = FY + 1; y < H; y++) for (let x = 0; x < W; x++) pt.p.erase(x, y);
  finish(pt, ps, g);
  if (ps.rift > 0) drawRift(pt.p, ps.rift);
  glowPass(pt.p, ps, g);
  if (ps.erode > 0) erode(pt, ps.erode, g);
  return pt.p;
}

// ------------------------------------------------------------------ animations

type Key = Partial<Pose>;
interface AnimDef {
  keys: Key[];
  durations: number[];
  loop: boolean;
  marks?: Record<string, number>;
}

// idle: the float bobs 2 px (eased, with holds at the top and bottom); the cape tip and the skirt
// hem follow two frames late, the cape swinging back as the body rises; the hand rocks the staff
// ±2° a beat behind; the sleeve bell swings; the orb's swirl turns a quarter every three frames
// and its core swells once (f3–f4); a ripple runs along the hem and the cape's edge; the hem runes
// glow in a travelling wave; the visor flickers once (f10, 60 ms). No two neighbouring frames are
// the same — the loop seam (f11 → f0) keeps moving.
const I_BOB = [0, 0, -1, -1, -2, -2, -2, -2, -1, -1, 0, 0];
const I_CAPE_Y = [1, 0, 0, 0, -1, -1, -2, -2, -2, -1, -1, 0];
const I_CAPE_X = [0, 0, 1, 1, 1, 0, 0, -1, -1, -1, 0, 0];
const I_SWAY = [0, 0, 0, 1, 1, 1, 0, 0, -1, -1, -1, 0];
const I_STAFF = [3, 3, 4, 5, 5, 4, 3, 2, 1, 1, 2, 3];
const I_HAND = [0, 0, 0, 0, -1, -1, 0, 0, 0, 1, 1, 0];
const I_DROOP = [3, 3, 3, 2, 2, 2, 3, 3, 4, 4, 4, 3];
const I_LAG = [0, 0, 1, 1, 0, -1, -1, -1, 0, 1, 1, 0];
const I_ORB = [0, 0, 0, 4, 4, 0, 0, 0, 0, 0, 0, 0];

/** The collapsed heap the body dissolves from (the staff lies on the floor in front of it). */
const DEAD: Key = {
  sink: HOVER,
  dx: -1,
  waist: 11,
  neck: [5, 12],
  head: [3, 6],
  tilt: 4,
  visor: 'dim',
  glove: 'limp',
  free: [GX - 2, FY + 1],
  staff: 96,
  orb: 3,
  flare: 6,
  capeY: 1,
  capeX: 2,
  droop: 2,
  rune: 0.1,
  glow: 0.1,
};

const DEFS: Record<WizardAnim, AnimDef> = {
  idle: {
    loop: true,
    durations: [150, 130, 130, 140, 150, 150, 130, 130, 130, 140, 60, 140],
    keys: I_BOB.map((b, f) => ({
      bob: b,
      t: f / 12,
      capeY: I_CAPE_Y[f],
      capeX: I_CAPE_X[f],
      sway: I_SWAY[f],
      staff: I_STAFF[f],
      hand: [17, 21 + I_HAND[f]] as V2,
      droop: I_DROOP[f],
      lag: I_LAG[f],
      orb: I_ORB[f],
      swirl: Math.floor(f / 3),
      visor: f === 10 ? ('dim' as const) : ('open' as const),
    })),
  },

  // summon: a void rift opens on the mat; the magus rises out of it horns first, wrapped in its
  // cape, the visor dark (the frames cut it off at the floor line); clear of the floor a glint in
  // the slit, then it lifts into the air — the cape unfurls and flares, the visor IGNITES, the staff
  // is hoisted and the orb flares with sparks; land: it drops into its float with the staff
  // brought down hard (a squash, the cape still airborne), a rebound, rest.
  summon: {
    loop: false,
    marks: { land: 12 },
    durations: [90, 80, 80, 80, 80, 80, 70, 80, 70, 70, 80, 90, 120, 120, 130],
    keys: [
      { rift: 0.35, sink: 100, visor: 'off', wrap: 1, glow: 0 },
      { rift: 0.8, sink: 84, visor: 'off', wrap: 1, hand: [12, 22], staff: 0, glow: 0, orb: 3 },
      { rift: 1, sink: 70, visor: 'off', wrap: 1, hand: [12, 22], staff: 0, glow: 0, orb: 3, t: 0.1 },
      { rift: 1, sink: 55, visor: 'off', wrap: 1, hand: [12, 22], staff: 0, glow: 0, orb: 3, t: 0.2 },
      { rift: 1, sink: 40, visor: 'off', wrap: 1, hand: [12, 22], staff: 0, glow: 0, orb: 3, t: 0.3, rune: 0.2 },
      { rift: 1, sink: 26, visor: 'off', wrap: 0.95, hand: [12, 22], staff: 0, glow: 0.2, orb: 0, t: 0.4, rune: 0.3 },
      { rift: 0.9, sink: 13, visor: 'spark', wrap: 0.9, hand: [13, 21], staff: 1, glow: 0.3, orb: 0, t: 0.5, rune: 0.4 },
      { rift: 0.6, sink: 4, neck: [0, 1], visor: 'spark', wrap: 0.75, hand: [14, 21], staff: 2, glow: 0.4, orb: 0, t: 0.6, rune: 0.5, sway: 1 },
      { rift: 0.25, sink: -2, visor: 'ignite', wrap: 0.3, capeFlare: 0.6, capeY: 2, hand: [17, 15], staff: 0, orb: 4, glow: 1, rune: 1.4, t: 0.7, sway: -1, droop: 1 },
      { sink: -3, visor: 'flare', capeFlare: 1, capeY: 1, hand: [16, 11], hold: 22, staff: -2, orb: 1, spark: 1, swirl: 1, glow: 1, rune: 1.2, t: 0.8, sway: -2, droop: 0, lag: -1 },
      { sink: -3, visor: 'flare', capeFlare: 0.8, hand: [16, 10], hold: 22, staff: 4, orb: 1, spark: 2, swirl: 2, glow: 1, rune: 1, t: 0.9, sway: -1, droop: 1 },
      { sink: -2, visor: 'open', capeFlare: 0.5, capeY: -1, hand: [16, 12], hold: 22, staff: 4, orb: 1, spark: 1, swirl: 3, glow: 1, rune: 0.9, t: 0.95, sway: 0, droop: 1, lag: 1 },
      { sink: 2, waist: 1, neck: [0, 2], visor: 'open', capeFlare: 0.1, capeY: -4, capeX: 1, hand: [17, 22], staff: 3, orb: 4, flash: 2, glow: 1, rune: 1, t: 0, sway: 1, flare: 2, droop: 5, lag: 1 },
      { sink: -1, visor: 'open', capeY: 1, capeX: -1, hand: [17, 20], staff: 3, orb: 0, t: 0.05, sway: -1, droop: 2, lag: -1 },
      { t: 0.1 },
    ],
  },

  // attack: gather — the body coils back, the staff swings back over the shoulder (behind the helm
  // and the shoulder, the orb under the horns) and the orb charges in drawn steps (r5 → r6 → r7,
  // sparks) while the visor flares; held at full charge; whip — the staff passes over the helm and
  // forward (two in-betweens); release — the arm thrusts the staff at the dragon, forward and 27°
  // down, the orb bursts; follow-through with the cape flung back and the hem lagging; recovery.
  attack: {
    loop: false,
    marks: { charge: 2, release: 7 },
    durations: [100, 110, 140, 130, 150, 70, 60, 90, 90, 110, 110, 110, 120, 130],
    keys: [
      { bob: 1, neck: [-1, 1], hand: [16, 22], staff: 0, glow: 0.6 },
      { bob: 1, neck: [-2, 1], hand: [12, 7], staff: -20, staffBehind: true, orbBehind: true, orb: 4, visor: 'flare', capeX: 1, sway: 1, droop: 2, lag: 1, t: 0.1 },
      { bob: 1, dx: -1, neck: [-3, 1], hand: [9, 9], hold: 20, staff: -55, staffBehind: true, orbBehind: true, orb: 1, spark: 1, swirl: 1, visor: 'flare', capeX: 2, sway: 1, droop: 1, lag: 1, glow: 1, rune: 1, t: 0.2 },
      { bob: 1, dx: -2, neck: [-5, 2], hand: [7, 8], hold: 20, staff: -60, staffBehind: true, orbBehind: true, orb: 1, spark: 2, swirl: 2, visor: 'flare', capeX: 3, sway: 2, droop: 1, lag: 2, glow: 1, rune: 1.2, t: 0.3 },
      { bob: 1, dx: -2, neck: [-5, 2], hand: [7, 8], hold: 20, staff: -62, staffBehind: true, orbBehind: true, orb: 2, spark: 2, swirl: 3, visor: 'flare', capeX: 3, sway: 2, droop: 1, lag: 2, glow: 1, rune: 1.6, t: 0.4 },
      { neck: [0, 0], hand: [14, 3], hold: 20, staff: -6, staffBehind: true, orb: 2, spark: 1, swirl: 0, visor: 'flare', capeFlare: 0.2, sway: 0, droop: 0, lag: 0, glow: 1, rune: 1.4, t: 0.5 },
      { neck: [3, 1], hand: [21, 8], hold: 20, staff: 62, orb: 2, swirl: 1, visor: 'flare', capeFlare: 0.4, capeX: -1, sway: -1, droop: 1, lag: -1, glow: 1, rune: 1.2, t: 0.55 },
      { dx: 1, neck: [5, 2], hand: [24, 14], hold: 20, staff: 117, staffBehind: true, orb: 1, flash: 1, visor: 'flare', capeFlare: 0.7, capeX: -2, sway: -2, droop: 2, lag: -2, glow: 1, rune: 2, t: 0.6 },
      { dx: 1, neck: [6, 2], hand: [24, 14], hold: 20, staff: 117, staffBehind: true, orb: 0, flash: 2, visor: 'flare', capeFlare: 1, capeX: -3, sway: -3, droop: 3, lag: -3, glow: 1, rune: 1.5, t: 0.65 },
      { dx: 1, neck: [5, 2], hand: [24, 15], hold: 20, staff: 115, staffBehind: true, orb: 3, visor: 'open', capeFlare: 0.9, capeX: -4, sway: -3, droop: 4, lag: -2, glow: 0.4, rune: 1, t: 0.7 },
      { neck: [3, 1], hand: [22, 17], hold: 21, staff: 80, orb: 3, visor: 'open', capeFlare: 0.5, capeX: -3, sway: -2, droop: 4, lag: -1, glow: 0.3, rune: 0.8, t: 0.78 },
      { neck: [1, 0], hand: [19, 19], staff: 35, orb: 0, capeFlare: 0.2, capeX: -1, sway: 0, droop: 3, lag: 1, glow: 0.4, t: 0.86 },
      { neck: [0, 0], hand: [17, 21], staff: 8, orb: 0, capeX: 1, capeY: 1, sway: 1, droop: 3, lag: 1, t: 0.93 },
      { t: 0 },
    ],
  },

  // hit: the breath slams into the front — the body is knocked back, the helm thrown back (crown
  // back, visor squeezed to a slit), the staff arm flung up and out, the orb's light knocked out;
  // the cape and hem whip forward (they lag the body); a stagger with the visor flickering, the
  // cape swinging back past rest. It ends broken — death continues from here.
  hit: {
    loop: false,
    marks: { impact: 1 },
    durations: [40, 130, 130, 110, 100, 100],
    keys: [
      { neck: [1, 0], visor: 'flare' },
      { bob: -1, dx: -4, neck: [-4, 1], head: [-2, -2], tilt: -5, visor: 'squint', hand: [22, 9], staff: 40, orb: 3, capeX: 8, capeY: -5, sway: 3, flare: 1, droop: 1, lag: 2, glow: 0.2, rune: 0.2, t: 0.1 },
      { dx: -5, neck: [-5, 2], head: [-2, -1], tilt: -5, visor: 'squint', hand: [22, 11], staff: 42, orb: 3, capeX: 6, capeY: -4, sway: 3, flare: 1, droop: 2, lag: 2, glow: 0.2, rune: 0.2, t: 0.2 },
      { dx: -4, neck: [-4, 2], head: [-1, 0], tilt: -4, visor: 'dim', hand: [20, 15], staff: 28, orb: 0, capeX: 3, capeY: -2, sway: 2, droop: 3, lag: 1, glow: 0.3, rune: 0.3, t: 0.3 },
      { dx: -3, neck: [-3, 2], tilt: -2, visor: 'spark', hand: [19, 17], staff: 18, orb: 0, capeX: 0, sway: 1, droop: 4, lag: -1, glow: 0.3, rune: 0.3, t: 0.4 },
      { dx: -3, neck: [-3, 3], tilt: -2, visor: 'dim', hand: [18, 19], staff: 14, orb: 0, capeX: -1, sway: 0, droop: 4, lag: 0, glow: 0.3, rune: 0.3, t: 0.5 },
    ],
  },

  // death: a stagger (continuing the hit), the float fails — the magus drops, sinks to the floor and
  // folds into a kneeling heap, the helm bowing; the limp hand lets the staff go and it topples
  // forward onto the floor in front of the robe, the orb spent; a last glint in the visor; then
  // (dissolve) the body erodes into void pixels from the edges in — the cape first, the visor last.
  death: {
    loop: false,
    marks: { dissolve: 6 },
    durations: [130, 150, 120, 130, 140, 140, 90, 90, 90, 90, 90, 90, 90, 90, 90, 110, 80],
    keys: [
      { dx: -3, neck: [-2, 4], head: [1, 1], tilt: 1, visor: 'dim', hand: [17, 21], staff: 16, capeX: -1, orb: 0, glow: 0.3, rune: 0.3, droop: 4, t: 0.6 },
      { sink: 3, dx: -2, waist: 2, neck: [0, 6], head: [2, 2], tilt: 2, visor: 'dim', hand: [16, 23], staff: 22, capeY: -3, flare: 1, sway: 1, droop: 5, orb: 0, glow: 0.2, rune: 0.2, t: 0.7 },
      { sink: HOVER, dx: -2, waist: 5, neck: [1, 8], head: [2, 3], tilt: 2, visor: 'squint', glove: 'limp', free: [GX + 7, FY - 1], staff: 26, capeY: -2, flare: 3, droop: 4, orb: 0, glow: 0.2, rune: 0.2, t: 0.8 },
      { sink: HOVER, dx: -1, waist: 9, neck: [3, 10], head: [3, 5], tilt: 3, visor: 'dim', glove: 'limp', free: [GX + 3, FY], staff: 62, capeY: 0, capeX: 1, flare: 5, droop: 3, orb: 0, glow: 0.1, rune: 0.1, t: 0.9 },
      { ...DEAD, staff: 97, orb: 0, visor: 'dim', t: 0.95 },
      { ...DEAD, visor: 'spark', t: 1 },
      ...[0.12, 0.24, 0.36, 0.48, 0.6, 0.7, 0.8, 0.88, 0.94].map((e) => ({ ...DEAD, erode: e, visor: e < 0.5 ? ('dim' as const) : ('open' as const) })),
      { ...DEAD, erode: 0.985, visor: 'open' },
      { erode: 2 },
    ],
  },
};

const ORDER: WizardAnim[] = ['summon', 'idle', 'attack', 'hit', 'death'];
const ANIMS = Object.fromEntries(ORDER.map((a) => [a, { durations: DEFS[a].durations, loop: DEFS[a].loop, ...(DEFS[a].marks ? { marks: DEFS[a].marks } : {}) }])) as Record<WizardAnim, LabAnim>;

function poseOf(anim: WizardAnim, f: number): Pose {
  const keys = DEFS[anim].keys;
  return { ...REST, ...keys[clamp(Math.floor(f), 0, keys.length - 1)] };
}

const wizard: LabMonsterArt<WizardAnim> = {
  id: 'c_wizard',
  name: 'Uçurum Büyücüsü',
  w: W,
  h: H,
  anchorX: GX,
  anchorY: GY,
  hover: HOVER,
  anims: ANIMS,
  draw(p: PixelCanvas, anim: WizardAnim, f: number) {
    const ps = poseOf(anim, f);
    if (ps.erode >= 1) return;
    p.blit(drawPose(ps), 0, 0);
  },
  points(anim: WizardAnim, f: number): LabFramePoints {
    const ps = poseOf(anim, f);
    const g = geometry(ps);
    return {
      core: { x: Math.round(g.waist[0]), y: Math.round(g.waist[1] - 6) },
      muzzle: { x: g.orb[0], y: g.orb[1] },
      orb: { x: g.orb[0], y: g.orb[1] },
      head: { x: Math.round(g.helm[0]) + 1, y: Math.round(g.helm[1]) - 10 },
      eyes: { x: g.eye[0], y: g.eye[1] },
    };
  },
};


export default wizard;
