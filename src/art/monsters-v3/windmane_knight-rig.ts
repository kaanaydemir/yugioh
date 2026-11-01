// Fırtına Şövalyesi (windmane_knight) v3 — the "wind-maned foot knight" rig: Pose → pixels.
//
// A tall, heavy foot-knight in bright storm-steel plate (night3 / steel / mist), a barrel great helm with a
// barred grille and two gold eye-points behind the bars, and from the helm's crest a HUGE tawny horsehair mane
// (earth1–earth4 ribbons) that streams back like a comet tail. The near hand holds a heavy lance planted butt-down
// and tilted 15° forward (tip ≈ y 17, so the raised poses stay inside the 104×96 frame), a swallow-tail pennon
// below its head streaming the same way as the mane. The mane is the identity and the state meter: stream (calm),
// lash (the hit / the strike's second blow), spiral up (charge), taut blade (release), drape (guard), gathered
// (summon held breath), rigid (dead calm, then it snaps off whole).
//
//   - every hard part is a flat polygon / tube shaded by flat value planes measured from its own edges (a lit
//     band toward the key light, a shade band away from it) plus a geometric ridge split on the cuirass and the
//     helm: no gradients, no dither, no bevel;
//   - parts are laid back to front with rigkit composite(): the surface under a new part gets a one-step-down
//     seam, never ink; ONE p.outline(PAL.ink) after the body; the eye-points (and dust) after it, never outlined;
//   - hard parts move by WHOLE pixels; limbs are 2-link IK tubes; death pieces are geometry transformed
//     (rotation about a pivot) BEFORE rasterising, so a fallen piece is shaded by the same light as a standing one;
//   - ONE key light from the screen's top-left: `light` = the frame edge it comes from ('left' P1, 'right' P2).
// Frame 104×96; 1 art px = 1 game px; GY = ground line (sabaton soles).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { composite, ik2, lightOf, seamFrom, type Light, type StepTable, type V } from '../rigkit';

export const W = 104;
export const H = 96;
export const AX = 50;
/** pose x values are authored for an anchor at 47: everything is laid SHIFT px to the right */
const SHIFT = AX - 47;
export const GY = 91;

const DEG = Math.PI / 180;
const rnd = Math.round;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- tones

/** one step down — the seam laid on the surface under a new part (never ink inside the body) */
const SEAM: StepTable = Object.freeze({
  [PAL.white]: PAL.mist,
  [PAL.mist]: PAL.steel,
  [PAL.steel]: PAL.night3,
  [PAL.night3]: PAL.night2,
  [PAL.night2]: PAL.night0,
  [PAL.night0]: PAL.ink,
  [PAL.earth4]: PAL.earth3,
  [PAL.earth3]: PAL.earth2,
  [PAL.earth2]: PAL.earth1,
  [PAL.earth1]: PAL.earth0,
  [PAL.earth0]: PAL.ink,
  [PAL.stone2]: PAL.stone1,
  [PAL.stone1]: PAL.night0,
  [PAL.gold2]: PAL.gold1,
  [PAL.gold1]: PAL.earth0,
});
const seam = seamFrom(SEAM);
const down = (c: number) => SEAM[c] ?? PAL.ink;

interface Tones {
  d: number;
  m: number;
  l: number;
  h?: number;
}
const PLATE: Tones = { d: PAL.night3, m: PAL.steel, l: PAL.mist };
const PLATE_FAR: Tones = { d: PAL.night2, m: PAL.night3, l: PAL.steel };
const MAIL: Tones = { d: PAL.stone1, m: PAL.stone2, l: PAL.stone2 };
const TRIM: Tones = { d: PAL.gold1, m: PAL.gold1, l: PAL.gold2 };
const PENNON: Tones = { d: PAL.earth2, m: PAL.earth3, l: PAL.earth4 };
/** the mane ribbons from the top (lit) strand to the under strand */
const MANE_TONES = [PAL.earth4, PAL.earth3, PAL.earth3, PAL.earth2, PAL.earth2, PAL.earth1];
const NR = MANE_TONES.length;

// ---------------------------------------------------------------- pose

export interface Mane {
  /** base angle of the stream at the root (deg, screen: 180 = straight back / left, 270 = up) */
  th: number;
  /** length of the longest ribbon (px) */
  len: number;
  /** bend of the stream along its length (deg added at the tip; + = clockwise on screen) */
  curl: number;
  /** sag of the tip (px, + down), grows with s² */
  droop: number;
  /** travelling-wave amplitude (px) and phase (0…1, one loop) */
  amp: number;
  ph: number;
  /** fan of the ribbons (px between neighbours at the tip) */
  spread: number;
  /** tip flick (px, + up) on the top ribbons */
  flick: number;
  /** 0…1 frizz: the ribbons' tips split and kink (hitMagic) */
  frizz: number;
  /** draw in front of the helm (the lash over the helm) */
  front: boolean;
}

export interface Piece {
  dx: number;
  dy: number;
  /** rotation (deg) about the piece's pivot */
  rot: number;
}
export type PieceName = 'mane' | 'helm' | 'pauldF' | 'pauldB' | 'cuirass' | 'arms' | 'fauld' | 'lance';

export interface Pose {
  /** whole-body shift (px) */
  bx: number;
  by: number;
  /** hips sink (px): legs bend */
  crouch: number;
  /** shoulders' x shift relative to the hips (px; + forward) */
  lean: number;
  /** chest rise (px, − up) */
  chest: number;
  /** helm offset relative to the neck (px) */
  hx: number;
  hy: number;
  /** feet (absolute frame px, x of the ankle, y of the sole) and their lift (glide) */
  fbx: number;
  fby: number;
  ffx: number;
  ffy: number;
  /** front gauntlet / lance grip (absolute) */
  gx: number;
  gy: number;
  /** lance angle (deg, screen: −90 = straight up, 0 = forward), butt and tip distance from the grip, foreshortening */
  la: number;
  lb: number;
  lf: number;
  lsc: number;
  /** back gauntlet (absolute) */
  bgx: number;
  bgy: number;
  mane: Mane;
  /** pennon: 0 stream, 1 wrapped round the shaft, 2 taut, 3 frozen (no wave), 4 hanging limp, 5 lying flat */
  pen: number;
  /** pennon wave phase and fly length */
  pph: number;
  plen: number;
  /** eye-points 0 dark … 3 flare */
  eyes: number;
  /** a glint (IŞ-8, ≤ 1 per anim): size 0/1/2 on the front pauldron's lit edge */
  glint: number;
  /** dust puffs (after the outline, flat grey): x, y, radius */
  dust: readonly (readonly [number, number, number])[];
  /** wind streak lines behind (after the outline): x0, y, length */
  streaks: readonly (readonly [number, number, number])[];
  /** the mane snapped off the crest: drawn as one rigid detached piece (death) */
  snapped: boolean;
  /** death / revive piece transforms (geometry, before raster) */
  fall: Partial<Record<PieceName, Piece>>;
  /** the helm is gone: the gorget shows an empty dark collar */
  hollow: boolean;
  /** the mane piece shattered flat on the floor (0 none, 1 cracked, 2 shards) */
  shards: number;
  /** a 1-px speed smear ribbon behind the mane (px) */
  smear: number;
  /** only the empty boots stand: greaves + sabatons, no thighs (death end) */
  boots: boolean;
  /** a loose lock of hair drifting off the mane tip: offset from the tip (px), or null */
  loose: readonly [number, number] | null;
  /** the near hand let go of the lance: where it hangs (absolute, authored at anchor 47), or null = on the grip */
  hand: readonly [number, number] | null;
  /** the lance butt stays planted on the idle spot (idle, guard and the transitions: HA-9) — the angle and the
   * butt length then follow from the grip */
  planted: boolean;
}

export const NEUTRAL_MANE: Mane = { th: 192, len: 40, curl: -14, droop: 3, amp: 2.2, ph: 0, spread: -0.6, flick: 0, frizz: 0, front: false };

export const NEUTRAL: Pose = {
  bx: 0,
  by: 0,
  crouch: 0,
  lean: 0,
  chest: 0,
  hx: 0,
  hy: 0,
  fbx: 40,
  fby: GY,
  ffx: 55,
  ffy: GY,
  gx: 75,
  gy: 58,
  la: -75,
  lb: 33,
  lf: 43,
  lsc: 1,
  bgx: 38,
  bgy: 63,
  mane: NEUTRAL_MANE,
  pen: 0,
  pph: 0,
  plen: 15,
  eyes: 2,
  glint: 0,
  dust: [],
  streaks: [],
  snapped: false,
  fall: {},
  hollow: false,
  shards: 0,
  smear: 0,
  boots: false,
  loose: null,
  hand: null,
  planted: false,
};

// ---------------------------------------------------------------- skeleton

export interface Skel {
  hip: V;
  sB: V;
  sF: V;
  neck: V;
  helm: V;
  crest: V;
  grille: V;
  tip: V;
  butt: V;
  grip: V;
  maneTip: V;
  chest: V;
  feet: V;
}

const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const dirOf = (deg: number): V => [Math.cos(deg * DEG), Math.sin(deg * DEG)];

function rotAbout(p: V, c: V, deg: number): V {
  if (!deg) return p;
  const s = Math.sin(deg * DEG);
  const k = Math.cos(deg * DEG);
  const x = p[0] - c[0];
  const y = p[1] - c[1];
  return [c[0] + x * k - y * s, c[1] + x * s + y * k];
}
function xf(pts: readonly V[], pc: Piece | undefined, pivot: V): V[] {
  if (!pc) return pts.map((p) => p);
  return pts.map((p) => {
    const r = rotAbout(p, pivot, pc.rot);
    return [r[0] + pc.dx, r[1] + pc.dy] as V;
  });
}

/** The idle lance butt (the planted spot): grip (75, 58) + SHIFT, angle −75°, 33 px down the shaft. */
const BUTT0: V = [rnd(75 + SHIFT - Math.cos(-75 * DEG) * 33), rnd(58 - Math.sin(-75 * DEG) * 33)];

export function skeleton(P: Pose): Skel {
  const hip: V = [AX - 1 + rnd(P.bx), 61 + rnd(P.by) + rnd(P.crouch)];
  const L = rnd(P.lean);
  const C = rnd(P.chest);
  const sB: V = [hip[0] - 9 + L, hip[1] - 21 + C];
  const sF: V = [hip[0] + 9 + L, hip[1] - 20 + C];
  const neck: V = [hip[0] + 2 + L, hip[1] - 26 + C];
  const helm: V = [neck[0] + rnd(P.hx), neck[1] - 10 + rnd(P.hy)];
  const crest: V = [helm[0] - 3, helm[1] - 10];
  const grille: V = [helm[0] + 5, helm[1] - 1];
  const grip: V = [rnd(P.gx) + SHIFT, rnd(P.gy)];
  let d = dirOf(P.la);
  let lb = P.lb;
  if (P.planted) {
    const dx = grip[0] - BUTT0[0];
    const dy = grip[1] - BUTT0[1];
    lb = Math.hypot(dx, dy);
    d = [dx / lb, dy / lb];
  }
  const tip: V = [rnd(grip[0] + d[0] * P.lf * P.lsc), rnd(grip[1] + d[1] * P.lf * P.lsc)];
  const butt: V = P.planted ? BUTT0 : [rnd(grip[0] - d[0] * lb * P.lsc), rnd(grip[1] - d[1] * lb * P.lsc)];
  const chest: V = [hip[0] + 3 + L, hip[1] - 13 + C];
  const feet: V = [rnd((P.fbx + P.ffx) / 2) + SHIFT, GY];
  const ribbons = maneDrawn(P, crest);
  const top = ribbons[1];
  const maneTip = top[top.length - 1];
  return { hip, sB, sF, neck, helm, crest, grille, tip, butt, grip, maneTip, chest, feet };
}

// ---------------------------------------------------------------- shading

/** Paint flat tone planes over a part's opaque pixels from its own edges: lit toward the key light, dark away. */
function shade(q: PixelCanvas, light: Light, t: Tones, o: { lw?: number; tw?: number; sw?: number; bw?: number; split?: (x: number, y: number) => number } = {}) {
  const lw = o.lw ?? 2;
  const tw = o.tw ?? 1;
  const sw = o.sw ?? 2;
  const bw = o.bw ?? 1;
  const src = q.clone();
  const side = light.side; // −1: light at the left
  const b = src.bounds();
  if (!b) return;
  const open = (x: number, y: number) => !src.isOpaque(x, y);
  const near = (x: number, y: number, dx: number, dy: number, k: number) => {
    for (let j = 1; j <= k; j++) if (open(x + dx * j, y + dy * j)) return true;
    return false;
  };
  for (let y = b.y; y < b.y + b.h; y++)
    for (let x = b.x; x < b.x + b.w; x++) {
      if (open(x, y)) continue;
      // split: +1 the lit plane, −1 the dark plane, 0 none (geometric ridge, chosen per light by the caller)
      const sp = o.split && side < 0 ? o.split(x, y) : 0;
      let c = t.m;
      if (near(x, y, -side, 0, sw)) c = t.d;
      else if (near(x, y, side, 0, lw) || near(x, y, 0, -1, tw)) c = t.l;
      else if (near(x, y, 0, 1, bw)) c = t.d;
      if (sp < 0 && c !== t.d) c = c === t.l ? t.m : t.d;
      q.set(x, y, c);
    }
}

function poly(pts: readonly V[], c: number): PixelCanvas {
  const q = new PixelCanvas(W, H);
  q.poly(pts.map((p) => [rnd(p[0]), rnd(p[1])] as const), c);
  return q;
}
function tube(a: V, b: V, w: number, c: number): PixelCanvas {
  const q = new PixelCanvas(W, H);
  q.thickLine(rnd(a[0]), rnd(a[1]), rnd(b[0]), rnd(b[1]), w, c);
  return q;
}

// ---------------------------------------------------------------- mane geometry

/** The five ribbons' centre paths (whole px), top strand first. */
export function manePaths(m: Mane, root: V): V[][] {
  const out: V[][] = [];
  const LEN = [0.84, 1, 0.96, 0.9, 0.78, 0.62];
  for (let i = 0; i < NR; i++) {
    const L = m.len * LEN[i];
    const r0: V = [root[0] - 1 - i * 0.9, root[1] + i * 2.3];
    const pts: V[] = [];
    let p: V = r0;
    const n = Math.max(2, Math.round(L / 2));
    for (let k = 0; k <= n; k++) {
      const s = (k / n) * L;
      const u = s / Math.max(1, m.len);
      const th = m.th + m.curl * u * u + (i - 2.5) * m.spread * 2.2 * u;
      const d = dirOf(th);
      if (k > 0) p = [p[0] + d[0] * (L / n), p[1] + d[1] * (L / n)];
      // travelling wave perpendicular to the stream, growing along it
      const perp: V = [-d[1], d[0]];
      const wave = m.amp * Math.sin((m.ph - s / 15 - i * 0.16) * Math.PI * 2) * Math.pow(u, 0.7);
      const sag = m.droop * u * u;
      const flick = i < 2 ? -m.flick * Math.max(0, u - 0.6) * 2.5 : 0;
      const kink = m.frizz * (k % 2 ? 1.6 : -1.6) * u * (i % 2 ? 1 : -1);
      pts.push([rnd(p[0] + perp[0] * (wave + kink)), rnd(p[1] + perp[1] * (wave + kink) + sag + flick)]);
    }
    out.push(pts);
  }
  return out;
}

/** Keep the stream's centre lines this far inside the frame (stroke radius + outline + the 2-px margin). */
const MANE_IN = 5;
/**
 * The mane's ribbons as drawn: the paths, moved as the death piece, then squeezed toward the crest on any axis
 * where they would leave the frame (a gust that would overshoot the 9 px of headroom bends lower instead).
 */
export function maneDrawn(P: Pose, crest: V): V[][] {
  const paths = manePaths(P.mane, crest).map((path) => xf(path, P.fall.mane, crest));
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const path of paths)
    for (const [x, y] of path) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  const [cx, cy] = crest;
  const kx0 = x0 < MANE_IN ? (cx - MANE_IN) / Math.max(1, cx - x0) : 1;
  const kx1 = x1 > W - 1 - MANE_IN ? (W - 1 - MANE_IN - cx) / Math.max(1, x1 - cx) : 1;
  const ky0 = y0 < MANE_IN ? (cy - MANE_IN) / Math.max(1, cy - y0) : 1;
  const ky1 = y1 > GY - 1 ? (GY - 1 - cy) / Math.max(1, y1 - cy) : 1;
  if (kx0 === 1 && kx1 === 1 && ky0 === 1 && ky1 === 1) return paths;
  return paths.map((path) =>
    path.map(([x, y]) => [rnd(cx + (x - cx) * (x < cx ? kx0 : kx1)), rnd(cy + (y - cy) * (y < cy ? ky0 : ky1))] as V),
  );
}

function drawMane(f: PixelCanvas, P: Pose, S: Skel, light: Light) {
  const paths = maneDrawn(P, S.crest);
  // under strand first, top strand last; each strand is a ribbon 3 px at the root → 2 px at the tip
  for (let i = NR - 1; i >= 0; i--) {
    const q = new PixelCanvas(W, H);
    const c = MANE_TONES[i];
    q.stroke(paths[i], i === 0 ? 3.4 : 4.6, 2, c);
    // the strand's tip: the last 4 px a step lighter on the lit strands (backlit hair), the under strands' tips one step darker
    const tip = paths[i].slice(-3);
    if (i <= 1) q.stroke(tip, 2.2, 2.2, PAL.earth4);
    // lit edge per light: the top ribbon's upper pixels stay earth4, the under strand's lower edge one step down
    if (i >= NR - 2) {
      const src = q.clone();
      const b = src.bounds();
      if (b)
        for (let y = b.y; y < b.y + b.h; y++)
          for (let x = b.x; x < b.x + b.w; x++) if (src.isOpaque(x, y) && !src.isOpaque(x, y + 1)) q.set(x, y, down(c));
    }
    composite(f, q, seam);
  }
  void light;
  if (P.smear > 0) {
    // a speed smear: one 1-px earth2 line trailing behind the stream, drawn as part of the silhouette
    const q = new PixelCanvas(W, H);
    const a = paths[2][paths[2].length - 1];
    q.hline(Math.max(3, rnd(a[0] - P.smear)), rnd(a[0]) - 1, rnd(a[1]), PAL.earth2);
    q.hline(Math.max(3, rnd(a[0] - P.smear * 0.6)), rnd(a[0]) - 1, rnd(a[1]) + 2, PAL.earth1);
    composite(f, q, seam);
  }
}

/** The mane after it hit the floor: flat comet shards lying behind the knight (death f5+). */
function drawManeShards(f: PixelCanvas, P: Pose, S: Skel) {
  const x0 = S.crest[0] - 2 + (P.fall.mane?.dx ?? 0);
  const y = GY;
  const lens = P.shards >= 2 ? [9, 6, 7, 4, 5] : [16, 10, 9];
  let x = rnd(x0);
  for (let i = 0; i < lens.length; i++) {
    const q = new PixelCanvas(W, H);
    const L = lens[i];
    if (x - L < 4) break;
    const top = y - 3 - (i % 2) - (P.shards < 2 && i === 0 ? 1 : 0);
    q.rect(x - L, top, L, y - top, MANE_TONES[i % 2 ? 2 : 1]);
    q.hline(x - L, x - 1, top, PAL.earth4);
    q.hline(x - L, x - 1, y - 1, MANE_TONES[4]);
    composite(f, q, seam);
    x -= L + (P.shards >= 2 ? 2 : 1);
    if (x < 6) break;
  }
}

// ---------------------------------------------------------------- body parts

function legOf(f: PixelCanvas, hipJ: V, ax: number, sole: number, light: Light, t: Tones, far: boolean, boots = false) {
  const ankle: V = [ax, sole - 5];
  const knee = ik2(hipJ, ankle, 13, 12, -1);
  // cuisse (thigh plate) and greave
  if (!boots) {
    const thigh = tube(hipJ, knee, far ? 7 : 8, t.m);
    shade(thigh, light, t, { lw: 2, sw: 2 });
    composite(f, thigh, seam);
  }
  const shin = tube(knee, ankle, far ? 6 : 7, t.m);
  // greave ridge: a vertical split one px behind the shin's middle
  const mid = (knee[0] + ankle[0]) / 2;
  shade(shin, light, t, { lw: 2, sw: 1, split: (x) => (light.side < 0 ? (x <= mid ? 1 : -1) : x >= mid ? 1 : -1) });
  composite(f, shin, seam);
  // poleyn (knee cop) with its wing
  const kq = new PixelCanvas(W, H);
  kq.disc(rnd(knee[0]) + 1, rnd(knee[1]), 3, t.m);
  kq.rect(rnd(knee[0]) - 3, rnd(knee[1]) - 1, 3, 3, t.m);
  shade(kq, light, t, { lw: 1, sw: 1 });
  composite(f, kq, seam);
  // sabaton: heel to a pointed toe, forward
  const sab = poly(
    [
      [ax - 4, sole],
      [ax - 4, sole - 4],
      [ax + 2, sole - 5],
      [ax + 6, sole - 2],
      [ax + 8, sole],
    ],
    t.m,
  );
  shade(sab, light, t, { lw: 1, sw: 1, tw: 1, bw: 0 });
  // sole row one step darker
  for (let x = ax - 4; x <= ax + 8; x++) if (sab.isOpaque(x, sole)) sab.set(x, sole, t.d);
  composite(f, sab, seam);
}

function drawLance(f: PixelCanvas, P: Pose, S: Skel, light: Light) {
  const pc = P.fall.lance;
  const pivot = S.butt;
  const [butt, tip, grip] = xf([S.butt, S.tip, S.grip], pc, pivot);
  const len = Math.hypot(tip[0] - butt[0], tip[1] - butt[1]);
  if (len < 3) return;
  const d: V = [(tip[0] - butt[0]) / len, (tip[1] - butt[1]) / len];
  const at = (s: number): V => [butt[0] + d[0] * s, butt[1] + d[1] * s];
  const headL = Math.min(9, len * 0.2);
  // shaft: 2 px wood (earth1 lit, earth0 dark), lit stripe on the light side
  const q = new PixelCanvas(W, H);
  const a = at(0);
  const b = at(len - headL);
  q.thickLine(rnd(a[0]), rnd(a[1]), rnd(b[0]), rnd(b[1]), 2, PAL.earth1);
  shade(q, light, { d: PAL.earth0, m: PAL.earth1, l: PAL.earth1 }, { lw: 0, sw: 1, tw: 0, bw: 0 });
  composite(f, q, seam);
  // the steel butt cap
  const cap = new PixelCanvas(W, H);
  cap.thickLine(rnd(a[0]), rnd(a[1]), rnd(at(3)[0]), rnd(at(3)[1]), 2, PAL.night3);
  composite(f, cap, seam);
  // planted: the iron ferrule sunk in the tile (a fixed 5-px collar: the butt never shifts in the calm loops, HA-9)
  if (P.planted) {
    const fr = new PixelCanvas(W, H);
    fr.rect(BUTT0[0] - 2, GY - 2, 5, 2, PAL.night3);
    fr.hline(BUTT0[0] - 2, BUTT0[0] + 2, GY - 2, PAL.steel);
    composite(f, fr, seam);
  }
  // head: a leaf blade, widest a third of the way up
  const hb = at(len - headL);
  const hm = at(len - headL * 0.62);
  const perp: V = [-d[1], d[0]];
  const hw = 2.2;
  const head = poly([hb, [hm[0] + perp[0] * hw, hm[1] + perp[1] * hw], tip, [hm[0] - perp[0] * hw, hm[1] - perp[1] * hw]], PAL.steel);
  shade(head, light, { d: PAL.night3, m: PAL.steel, l: PAL.mist }, { lw: 1, sw: 1, tw: 1, bw: 1 });
  composite(f, head, seam);
  // the vamplate (cone guard) just ahead of the grip
  {
    const gs = Math.hypot(grip[0] - butt[0], grip[1] - butt[1]);
    const v0 = at(gs + 2);
    const v1 = at(gs + 6);
    const cone = poly(
      [
        [v0[0] + perp[0] * 3.5, v0[1] + perp[1] * 3.5],
        [v1[0] + perp[0] * 1.2, v1[1] + perp[1] * 1.2],
        [v1[0] - perp[0] * 1.2, v1[1] - perp[1] * 1.2],
        [v0[0] - perp[0] * 3.5, v0[1] - perp[1] * 3.5],
      ],
      PAL.steel,
    );
    shade(cone, light, PLATE, { lw: 1, sw: 1, tw: 1, bw: 1 });
    composite(f, cone, seam);
  }
  drawPennon(f, P, at, d, len, light);
}

function drawPennon(f: PixelCanvas, P: Pose, at: (s: number) => V, d: V, len: number, light: Light) {
  const s1 = len - 10;
  const s2 = len - 17;
  if (s2 < 2) return;
  const a1 = at(s1);
  const a2 = at(s2);
  const q = new PixelCanvas(W, H);
  const L = P.plen;
  if (P.pen === 5 || (Math.abs(d[1]) < 0.45 && a1[1] > GY - 12)) {
    // lying flat on the floor beside the fallen shaft
    const x = rnd(Math.min(a1[0], a2[0]));
    q.rect(x - 1, GY - 2, 12, 2, PENNON.m);
    q.hline(x - 1, x + 10, GY - 2, PENNON.l);
    q.set(x + 11, GY - 1, PENNON.m);
    q.hline(x + 4, x + 5, GY - 2, PAL.night2);
    composite(f, q, seam);
    return;
  }
  if (P.pen === 1) {
    // wrapped round the shaft by the thrust's inertia: a bunched roll plus a short forward tail
    const c = at(s1 - 2);
    q.disc(rnd(c[0]), rnd(c[1]), 3, PENNON.m);
    const t: V = [c[0] + d[0] * 7 + 1, c[1] + d[1] * 7 + 3];
    q.tri(rnd(c[0]), rnd(c[1]) - 1, rnd(c[0]), rnd(c[1]) + 2, rnd(t[0]), rnd(t[1]), PENNON.m);
    shade(q, light, PENNON, { lw: 1, sw: 1 });
    composite(f, q, seam);
    return;
  }
  // fly direction: back (left), or hanging down when limp
  let fly: V = P.pen === 4 ? [-0.25, 1] : [-1, P.pen === 2 ? -0.05 : 0.12];
  const fl = Math.hypot(fly[0], fly[1]);
  fly = [fly[0] / fl, fly[1] / fl];
  const nrm: V = [-fly[1], fly[0]];
  const still = P.pen === 2 || P.pen === 3 || P.pen === 4;
  const wv = (k: number) => (still ? 0 : Math.sin((P.pph - k * 0.18) * Math.PI * 2) * 1.3);
  const Lx = P.pen === 2 ? L + 3 : L;
  const pt = (base: V, s: number, w: number): V => [base[0] + fly[0] * s + nrm[0] * w, base[1] + fly[1] * s + nrm[1] * w];
  const m1 = pt(a1, Lx * 0.5, wv(1));
  const m2 = pt(a2, Lx * 0.5, wv(1.2));
  const t1 = pt(a1, Lx, wv(2) + 0.5);
  const t2 = pt(a2, Lx * 0.96, wv(2.3) - 0.5);
  const notch = pt([(a1[0] + a2[0]) / 2, (a1[1] + a2[1]) / 2], Lx * 0.68, wv(1.6));
  q.poly(
    [a1, m1, t1, notch, t2, m2, a2].map((p) => [rnd(p[0]), rnd(p[1])] as const),
    PENNON.m,
  );
  shade(q, light, PENNON, { lw: 0, tw: 1, sw: 0, bw: 1 });
  // the night2 stripe across the field, near the staff
  const st0 = pt([(a1[0] + a2[0]) / 2, (a1[1] + a2[1]) / 2], 3, 0);
  const st1 = pt([(a1[0] + a2[0]) / 2, (a1[1] + a2[1]) / 2], 5, wv(0.5));
  for (const s of [st0, st1]) {
    const x = rnd(s[0]);
    for (let y = rnd(s[1]) - 4; y <= rnd(s[1]) + 4; y++) if (q.isOpaque(x, y)) q.set(x, y, PAL.night2);
  }
  composite(f, q, seam);
}

function drawHelm(f: PixelCanvas, P: Pose, S: Skel, light: Light) {
  const pc = P.fall.helm;
  const c = S.helm;
  const rel = (pts: readonly V[]) => xf(pts.map((p) => add(c, p)), pc, c);
  const shell = rel([
    [-7, -8],
    [-4, -10],
    [3, -10],
    [6, -8],
    [7, -3],
    [8, 0],
    [8, 6],
    [5, 9],
    [-6, 9],
    [-8, 5],
    [-8, -4],
  ]);
  const q = poly(shell, PAL.steel);
  // the side plane and the face plane meet at the front corner (x +2): per light, one of them is lit
  const ridge = (x: number, y: number) => {
    const r = rotAbout([x - (pc?.dx ?? 0), y - (pc?.dy ?? 0)], c, -(pc?.rot ?? 0));
    const front = r[0] - c[0] >= 3;
    return light.side < 0 ? (front ? -1 : 1) : front ? 1 : -1;
  };
  shade(q, light, PLATE, { lw: 2, tw: 2, sw: 1, bw: 1, split: ridge });
  // brow band and the breaths: a crease row under the brow (one step down)
  const brow = rel([
    [-8, -2],
    [8, -2],
  ]);
  const b0 = brow[0];
  const b1 = brow[1];
  if (!P.hollow) {
    const n = Math.max(1, Math.round(Math.hypot(b1[0] - b0[0], b1[1] - b0[1])));
    for (let k = 0; k <= n; k++) {
      const x = rnd(b0[0] + ((b1[0] - b0[0]) * k) / n);
      const y = rnd(b0[1] + ((b1[1] - b0[1]) * k) / n);
      if (q.isOpaque(x, y) && q.isOpaque(x, y - 1) && q.isOpaque(x, y + 1)) q.set(x, y, down(q.get(x, y)!));
    }
  }
  // the barred grille: dark field, two steel bars, on the face plane
  const gr = rel([
    [3, -4],
    [8, -4],
    [8, 4],
    [3, 4],
  ]);
  const g = poly(gr, PAL.night0);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (g.isOpaque(x, y) && q.isOpaque(x, y)) q.set(x, y, PAL.night0);
  for (const bx of [5, 7]) {
    const bar = rel([
      [bx, -4],
      [bx, 4],
    ]);
    const n = Math.max(1, Math.round(Math.hypot(bar[1][0] - bar[0][0], bar[1][1] - bar[0][1])));
    for (let k = 0; k <= n; k++) {
      const x = rnd(bar[0][0] + ((bar[1][0] - bar[0][0]) * k) / n);
      const y = rnd(bar[0][1] + ((bar[1][1] - bar[0][1]) * k) / n);
      if (q.get(x, y) === PAL.night0) q.set(x, y, light.side < 0 ? PAL.night3 : PAL.steel);
    }
  }
  composite(f, q, seam);
  // the crest ridge (gold trim) along the top
  const cr = rel([
    [-5, -12],
    [2, -12],
    [4, -10],
    [-5, -10],
  ]);
  const cq = poly(cr, PAL.gold1);
  shade(cq, light, TRIM, { lw: 1, tw: 1, sw: 1, bw: 0 });
  composite(f, cq, seam);
}

/** The two eye-points behind the grille (emissive: drawn after the outline, never outlined). */
function drawEyes(p: PixelCanvas, P: Pose, S: Skel) {
  if (P.eyes <= 0 || P.hollow) return;
  const pc = P.fall.helm;
  const c = S.helm;
  const [e1, e2] = xf(
    [
      [c[0] + 4, c[1] - 1],
      [c[0] + 6, c[1] - 1],
    ],
    pc,
    c,
  );
  const core = P.eyes >= 2 ? PAL.gold4 : PAL.gold3;
  for (const e of [e1, e2]) {
    const x = rnd(e[0]);
    const y = rnd(e[1]);
    if (!p.isOpaque(x, y)) continue;
    p.set(x, y, core);
    if (P.eyes >= 2 && p.isOpaque(x, y + 1)) p.set(x, y + 1, PAL.gold3);
  }
  if (P.eyes >= 3) {
    // the flare: the gold spills one px each way inside the grille field
    for (const e of [e1, e2]) {
      const x = rnd(e[0]);
      const y = rnd(e[1]);
      for (const [dx, dy] of [[0, -1], [-1, 0]] as const) if (p.get(x + dx, y + dy) === PAL.night0) p.set(x + dx, y + dy, PAL.gold3);
      p.set(x, y, PAL.white);
    }
  }
}

function drawPauldron(f: PixelCanvas, P: Pose, at: V, far: boolean, light: Light, pc: Piece | undefined) {
  const t = far ? PLATE_FAR : PLATE;
  const pts: V[] = far
    ? [
        [-6, -3],
        [-2, -6],
        [4, -5],
        [6, 0],
        [5, 5],
        [-4, 5],
        [-7, 2],
      ]
    : [
        [-7, -4],
        [-2, -7],
        [4, -6],
        [8, -3],
        [9, 3],
        [7, 7],
        [-1, 8],
        [-6, 5],
      ];
  const g = xf(
    pts.map((p) => add(at, p)),
    pc,
    at,
  );
  const q = poly(g, t.m);
  shade(q, light, t, { lw: 2, tw: 2, sw: 2, bw: 1 });
  // two lame creases (one step down) and the gold rim along the lowest lame
  const box = q.bounds();
  if (box) {
    const ys = far ? [box.y + 4] : [box.y + 4, box.y + 8];
    for (const y of ys) for (let x = box.x; x < box.x + box.w; x++) if (q.isOpaque(x, y) && q.isOpaque(x, y - 1) && q.isOpaque(x, y + 1)) q.set(x, y, down(q.get(x, y)!));
    if (!far) {
      const src = q.clone();
      for (let y = box.y; y < box.y + box.h; y++)
        for (let x = box.x; x < box.x + box.w; x++) {
          if (!src.isOpaque(x, y)) continue;
          if (!src.isOpaque(x, y + 1)) q.set(x, y, PAL.gold1);
          else if (!src.isOpaque(x, y + 2)) q.set(x, y, light.side < 0 ? (x < box.x + box.w / 2 ? PAL.gold2 : PAL.gold1) : x >= box.x + box.w / 2 ? PAL.gold2 : PAL.gold1);
        }
    }
  }
  composite(f, q, seam);
  void P;
}

function drawArm(f: PixelCanvas, sh: V, hand: V, light: Light, far: boolean, pc: Piece | undefined) {
  const t = far ? PLATE_FAR : PLATE;
  const [s, h] = xf([sh, hand], pc, sh);
  const elbow = ik2(s, h, 12, 12, far ? 1 : 1);
  const up = tube(s, elbow, far ? 5 : 6, t.m);
  shade(up, light, t, { lw: 1, sw: 1 });
  composite(f, up, seam);
  const fo = tube(elbow, h, far ? 5 : 6, t.m);
  shade(fo, light, t, { lw: 1, sw: 1 });
  composite(f, fo, seam);
  // couter (elbow cop)
  const cq = new PixelCanvas(W, H);
  cq.disc(rnd(elbow[0]), rnd(elbow[1]), far ? 2 : 3, t.m);
  shade(cq, light, t, { lw: 1, sw: 1, tw: 1, bw: 1 });
  composite(f, cq, seam);
  // gauntlet with its gold cuff
  const gq = new PixelCanvas(W, H);
  gq.rect(rnd(h[0]) - 2, rnd(h[1]) - 3, 5, 6, t.m);
  shade(gq, light, t, { lw: 1, sw: 1, tw: 1, bw: 1 });
  composite(f, gq, seam);
  if (!far) {
    const cuff = new PixelCanvas(W, H);
    const dx = h[0] - elbow[0];
    const dy = h[1] - elbow[1];
    const dl = Math.hypot(dx, dy) || 1;
    const c0: V = [h[0] - (dx / dl) * 4, h[1] - (dy / dl) * 4];
    cuff.thickLine(rnd(c0[0] - dy / dl * 3), rnd(c0[1] + dx / dl * 3), rnd(c0[0] + dy / dl * 3), rnd(c0[1] - dx / dl * 3), 2, PAL.gold1);
    shade(cuff, light, TRIM, { lw: 1, sw: 0, tw: 1, bw: 0 });
    composite(f, cuff, seam);
  }
}

function drawTorso(f: PixelCanvas, P: Pose, S: Skel, light: Light) {
  const hip = S.hip;
  const L = rnd(P.lean);
  const C = rnd(P.chest);
  const pcF = P.fall.fauld;
  const pcC = P.fall.cuirass;
  // fauld: the skirt of lames under the waist
  const fauld = xf(
    [
      [hip[0] - 9, hip[1] - 6],
      [hip[0] + 9, hip[1] - 6],
      [hip[0] + 12, hip[1] + 3],
      [hip[0] + 8, hip[1] + 5],
      [hip[0], hip[1] + 4],
      [hip[0] - 9, hip[1] + 5],
      [hip[0] - 12, hip[1] + 2],
    ],
    pcF,
    hip,
  );
  const fq = poly(fauld, PAL.steel);
  shade(fq, light, PLATE, { lw: 2, tw: 1, sw: 2, bw: 1 });
  const fb = fq.bounds();
  if (fb) for (const y of [fb.y + 3, fb.y + 6, fb.y + 9]) for (let x = fb.x; x < fb.x + fb.w; x++) if (fq.isOpaque(x, y) && fq.isOpaque(x, y - 1) && fq.isOpaque(x, y + 1)) fq.set(x, y, down(fq.get(x, y)!));
  composite(f, fq, seam);
  // the gambeson belt row between the fauld and the cuirass
  const belt = xf(
    [
      [hip[0] - 10 + L * 0.3, hip[1] - 8],
      [hip[0] + 11 + L * 0.3, hip[1] - 8],
      [hip[0] + 11, hip[1] - 5],
      [hip[0] - 10, hip[1] - 5],
    ],
    pcF,
    hip,
  );
  const bq = poly(belt, PAL.stone2);
  shade(bq, light, MAIL, { lw: 1, sw: 1, tw: 0, bw: 1 });
  composite(f, bq, seam);
  // cuirass: pigeon-breasted, the ridge curving from the gorget to the waist
  const top = (x: number, y: number): V => [hip[0] + x + L, hip[1] + y + C];
  const low = (x: number, y: number): V => [hip[0] + x + rnd(L * 0.4), hip[1] + y];
  const cu = xf(
    [low(-8, -6), low(8, -6), low(11, -10), top(14, -17), top(12, -22), top(6, -25), top(-3, -25), top(-10, -23), top(-12, -17), low(-9, -10)],
    pcC,
    hip,
  );
  const cq = poly(cu, PAL.steel);
  const rx0 = top(4, -24);
  const rx1 = low(6, -7);
  const ridge = (x: number, y: number) => {
    const r = rotAbout([x - (pcC?.dx ?? 0), y - (pcC?.dy ?? 0)], hip, -(pcC?.rot ?? 0));
    const t = clamp((r[1] - rx0[1]) / Math.max(1, rx1[1] - rx0[1]), 0, 1);
    const bulge = 2 * Math.sin(t * Math.PI);
    const xr = rx0[0] + (rx1[0] - rx0[0]) * t + bulge;
    const front = r[0] > xr;
    return light.side < 0 ? (front ? -1 : 1) : front ? 1 : -1;
  };
  shade(cq, light, PLATE, { lw: 2, tw: 2, sw: 2, bw: 1, split: ridge });
  // the plackart line (a crease a third of the way up)
  const cb = cq.bounds();
  if (cb) {
    const y = cb.y + cb.h - 6;
    for (let x = cb.x; x < cb.x + cb.w; x++) if (cq.isOpaque(x, y) && cq.isOpaque(x, y - 1) && cq.isOpaque(x, y + 1)) cq.set(x, y, down(cq.get(x, y)!));
  }
  composite(f, cq, seam);
  // gorget (or, without the helm, the empty dark collar)
  const nk = S.neck;
  const gq = poly(
    xf(
      [
        [nk[0] - 6, nk[1] - 1],
        [nk[0] + 5, nk[1] - 1],
        [nk[0] + 7, nk[1] + 3],
        [nk[0] - 7, nk[1] + 3],
      ],
      pcC,
      hip,
    ),
    PAL.steel,
  );
  shade(gq, light, PLATE, { lw: 1, sw: 1, tw: 1, bw: 0 });
  if (P.hollow) {
    const gb = gq.bounds();
    if (gb) for (let x = gb.x + 2; x < gb.x + gb.w - 2; x++) if (gq.isOpaque(x, gb.y)) gq.set(x, gb.y, PAL.night0);
  }
  composite(f, gq, seam);
}

/** The two empty gauntlets lying on the floor (death end): small steel blocks with their gold cuffs. */
function gauntletsDown(f: PixelCanvas, light: Light) {
  for (const [x, w] of [
    [AX + 14, 6],
    [AX - 22, 5],
  ] as const) {
    const q = new PixelCanvas(W, H);
    q.rect(x, GY - 3, w, 3, PAL.steel);
    shade(q, light, w === 6 ? PLATE : PLATE_FAR, { lw: 1, sw: 1, tw: 1, bw: 0 });
    q.vline(x, GY - 3, GY - 1, PAL.gold1);
    composite(f, q, seam);
  }
}

// ---------------------------------------------------------------- frame

/** Draw one frame of the knight. */
export function drawKnight(p: PixelCanvas, P: Pose, lightFrom: 'left' | 'right' = 'left') {
  const light = lightOf(lightFrom);
  const S = skeleton(P);
  const f = new PixelCanvas(W, H);
  const hipB: V = [S.hip[0] - 5, S.hip[1] + 3];
  const hipF: V = [S.hip[0] + 5, S.hip[1] + 3];

  // 1. the mane (behind everything unless it lashes over the helm)
  if (P.shards > 0) drawManeShards(f, P, S);
  else if (!P.mane.front) drawMane(f, P, S, light);
  // 2. the far side: back arm, back pauldron, back leg
  if (!P.boots) drawArm(f, S.sB, [P.bgx + SHIFT + rnd(P.bx), P.bgy + rnd(P.by)], light, true, P.fall.arms);
  drawPauldron(f, P, S.sB, true, light, P.fall.pauldB);
  legOf(f, hipB, rnd(P.fbx) + SHIFT, rnd(P.fby), light, PLATE_FAR, true, P.boots);
  // 3. near leg, fauld, cuirass, gorget
  legOf(f, hipF, rnd(P.ffx) + SHIFT, rnd(P.ffy), light, PLATE, false, P.boots);
  drawTorso(f, P, S, light);
  if (P.loose) {
    const q = new PixelCanvas(W, H);
    const x = Math.max(5, rnd(S.maneTip[0] + P.loose[0]));
    const y = rnd(S.maneTip[1] + P.loose[1]);
    q.hline(x - 2, x + 1, y, PAL.earth3);
    q.hline(x - 1, x + 1, y + 1, PAL.earth2);
    composite(f, q, seam);
  }
  // 4. the helm and its crest
  if (!P.hollow || P.fall.helm) drawHelm(f, P, S, light);
  if (P.mane.front && P.shards === 0) drawMane(f, P, S, light);
  // 5. the lance (in front of the body), then the near arm over it, the pauldron on top
  drawLance(f, P, S, light);
  if (!P.boots) drawArm(f, S.sF, P.hand ? [P.hand[0] + SHIFT, P.hand[1]] : S.grip, light, false, P.fall.arms);
  else gauntletsDown(f, light);
  drawPauldron(f, P, [S.sF[0] + 1, S.sF[1]], false, light, P.fall.pauldF);

  f.outline(PAL.ink);
  // 6. light: the eye-points, the one glint
  drawEyes(f, P, S);
  if (P.glint > 0) {
    const g: V = [S.sF[0] + (light.side < 0 ? -4 : 5), S.sF[1] - 5];
    const put = (dx: number, dy: number) => {
      const c = f.get(g[0] + dx, g[1] + dy);
      if (c !== null && c !== PAL.ink) f.set(g[0] + dx, g[1] + dy, PAL.white);
    };
    put(0, 0);
    if (P.glint >= 2) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(dx, dy);
  }
  // 7. flat grey dust (stone2 body, stone3 crown) and wind streaks, inside the margins
  for (const [x, y, r] of P.dust) {
    const cx = rnd(x) + SHIFT;
    const cy = rnd(y);
    const rr = Math.max(1, rnd(r));
    for (let dy = -rr; dy <= 0; dy++)
      for (let dx = -rr - 1; dx <= rr + 1; dx++) {
        const X = cx + dx;
        const Y = cy + dy;
        if (X < 2 || X > W - 3 || Y < 2 || Y > H - 3) continue;
        if ((dx * dx) / ((rr + 1) * (rr + 1)) + (dy * dy) / (rr * rr) > 1) continue;
        if (f.isOpaque(X, Y) && f.get(X, Y) !== PAL.ink) continue;
        f.set(X, Y, dy <= -rr + 1 ? PAL.stone3 : PAL.stone2);
      }
  }
  for (const [x0, y, l] of P.streaks) {
    const Y = rnd(y);
    for (let x = rnd(x0) + SHIFT; x < rnd(x0 + l) + SHIFT; x++) if (x >= 2 && x <= W - 3 && !f.isOpaque(x, Y)) f.set(x, Y, PAL.stone3);
  }
  p.blit(f, 0, 0);
}
