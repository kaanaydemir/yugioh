// Kanat Hanımı (wing_lady) v3 — the "kestrel-winged swordswoman" rig: Pose → pixels.
//
// A lean young warrior woman (a walker) with LARGE kestrel wings from her shoulder blades: rufous-cream
// coverts (earth4 / earth3), earth2 flight feathers with slate bars (night2) and slate primaries (night3 /
// night2). At rest the wings stand half-raised in a "V" over her shoulders (the near wing up-and-back, the far
// wing up-and-forward behind her head). A dark green flight bodice and leggings (leaf0–leaf3) with gold trim,
// a short leaf-bladed sword hanging tip-down in the front hand, a white sash streaming back from the belt (her
// windsock), a long blue-black braid streaming back, a thin gold circlet with ONE green jewel (leaf4, gold4
// setting) — the brightest point and her "voice" light, drawn after the outline and never outlined.
//
//   - parts are polygons / tubes / ribbons in a body-local frame; the whole body is moved (bx, by) and rotated
//     (rot, about the hips or the feet) as GEOMETRY before rasterising, so a gliding or fallen body is shaded by
//     the same light as a standing one;
//   - a wing is a parametric span (root → wrist → tip, the leading edge) with a chord that widens to the
//     secondaries and tapers to a pointed kestrel tip; its colour bands run ALONG the chord (lesser coverts,
//     greater coverts, flight feathers, slate primaries) as flat polygons, the trailing edge is serrated by whole
//     pixels (feather tips), 3 one-pixel slate bars cross the flight feathers (the wings' only 1-px detail);
//   - flat tone planes measured from each part's own edges (lit toward the key light, dark away from it), laid
//     back to front with rigkit composite() one-step seams; ONE p.outline(PAL.ink) after the body; the jewel and
//     the blade glint after it;
//   - the head is a hand-made pixel map (three faces: calm, singing, struck), rotated whole-pixel with the body
//     only when the body itself is rotated (glide, fall) — in every hover frame its pixels are IDENTICAL (the
//     kestrel's locked head).
// Frame 84×72; 1 art px = 1 game px; GY = ground line (boot soles). Light: 'left' P1, 'right' P2 relight.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { cleanCrumbs, composite, ik2, lightOf, seamFrom, type Light, type StepTable, type V } from '../rigkit';

export const W = 84;
export const H = 72;
export const AX = 36;
export const GY = 68;

const DEG = Math.PI / 180;
const rnd = Math.round;

// ---------------------------------------------------------------- tones

/** one step down — the seam laid on the surface under a new part (never ink inside the body) */
const SEAM: StepTable = Object.freeze({
  [PAL.white]: PAL.mist,
  [PAL.mist]: PAL.steel,
  [PAL.steel]: PAL.night3,
  [PAL.night3]: PAL.night2,
  [PAL.night2]: PAL.night1,
  [PAL.night1]: PAL.ink,
  [PAL.earth4]: PAL.earth3,
  [PAL.earth3]: PAL.earth2,
  [PAL.earth2]: PAL.night2,
  [PAL.leaf3]: PAL.leaf2,
  [PAL.leaf2]: PAL.leaf1,
  [PAL.leaf1]: PAL.leaf0,
  [PAL.leaf0]: PAL.ink,
  [PAL.skin3]: PAL.skin2,
  [PAL.skin2]: PAL.earth2,
  [PAL.gold2]: PAL.gold1,
  [PAL.gold1]: PAL.night1,
});
const seam = seamFrom(SEAM);
const down = (c: number) => SEAM[c] ?? PAL.ink;
const UP: StepTable = Object.freeze({
  [PAL.earth2]: PAL.earth3,
  [PAL.earth3]: PAL.earth4,
  [PAL.earth4]: PAL.earth4,
  [PAL.night2]: PAL.steel,
  [PAL.night3]: PAL.steel,
});
const up = (c: number) => UP[c] ?? c;
/** the wing's shade step: stays inside its own ramp (never drops to the slate bar tone) */
const WDOWN: StepTable = Object.freeze({ [PAL.earth4]: PAL.earth3, [PAL.earth3]: PAL.earth2, [PAL.night3]: PAL.night2, [PAL.steel]: PAL.night3 });
const wdown = (c: number) => WDOWN[c] ?? c;

/**
 * Despeckle (IŞ-10): a pixel with no same-coloured opaque 4-neighbour takes the colour most of its opaque
 * 4-neighbours share (ink — the eye — is kept). One pass, read from a copy.
 */
function despeckle(p: PixelCanvas) {
  const src = p.clone();
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const c = src.get(x, y);
      if (c === null || c === PAL.ink) continue;
      const n: number[] = [];
      let same = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const d = src.get(x + dx, y + dy);
        if (d === null) continue;
        if (d === c) same = true;
        n.push(d);
      }
      if (same || n.length < 2) continue;
      let best = n[0];
      let bn = 0;
      for (const q of n) {
        if (q === PAL.ink) continue;
        const k = n.filter((v) => v === q).length;
        if (k > bn) [best, bn] = [q, k];
      }
      if (bn >= 2 || (bn === 1 && n.length === 2)) p.set(x, y, best);
    }
}

interface Tones {
  d: number;
  m: number;
  l: number;
}
const LEGGING: Tones = { d: PAL.leaf0, m: PAL.leaf1, l: PAL.leaf2 };
const LEGGING_FAR: Tones = { d: PAL.leaf0, m: PAL.leaf0, l: PAL.leaf1 };
const BODICE: Tones = { d: PAL.leaf0, m: PAL.leaf1, l: PAL.leaf2 };
const SKIN: Tones = { d: PAL.skin2, m: PAL.skin3, l: PAL.skin3 };
/** the near arm in P1: its outer side faces away from the light */
const SKIN_SHADE: Tones = { d: PAL.skin2, m: PAL.skin2, l: PAL.skin2 };
const SKIN_FAR: Tones = { d: PAL.earth2, m: PAL.skin2, l: PAL.skin2 };
const BOOT: Tones = { d: PAL.night1, m: PAL.night2, l: PAL.night3 };
const GOLD: Tones = { d: PAL.gold1, m: PAL.gold2, l: PAL.gold2 };

/** wing band tones: lesser coverts, greater coverts, flight feathers, primaries, primary tips, bars */
interface WingTones {
  lc: number;
  gc: number;
  ff: number;
  pr: number;
  pt: number;
  bar: number;
}
const WING_NEAR: WingTones = { lc: PAL.earth4, gc: PAL.earth3, ff: PAL.earth2, pr: PAL.night3, pt: PAL.night2, bar: PAL.night2 };
const WING_FAR: WingTones = { lc: PAL.earth3, gc: PAL.earth2, ff: PAL.earth2, pr: PAL.night2, pt: PAL.night2, bar: PAL.night2 };

// ---------------------------------------------------------------- pose

export interface Wing {
  /** leading-edge angle at the root (deg, screen: 0 = forward/right, −90 = up, 180 = back) — body-local */
  a: number;
  /** span (px) */
  len: number;
  /** extra angle of the hand (wrist → tip) relative to the arm (deg; + = clockwise on screen) */
  bend: number;
  /** chord at the widest point (px) */
  chord: number;
  /** chord side: +1 = the trailing edge lies on the (sin a, −cos a) side (rear, the usual), −1 the other */
  side: 1 | -1;
  /** covert band depth (0…1 of the chord): the greater coverts' lower edge (the idle ripple moves it) */
  cv: number;
  /** primaries start (0…1 of the span) */
  ps: number;
}

export interface Ribbon {
  /** base angle at the root (deg, screen) */
  th: number;
  len: number;
  /** travelling wave amplitude (px) and phase (0…1) */
  amp: number;
  ph: number;
  /** tip lift (px, + up) */
  flick: number;
  /** bend toward the tip (deg) */
  curl: number;
}

export type Face = 'calm' | 'sing' | 'struck' | 'closed';

export interface Pose {
  /** whole-body shift (px) and rotation (deg, + clockwise) about the hips (piv 0) or the feet (piv 1) */
  bx: number;
  by: number;
  rot: number;
  piv: 0 | 1;
  /** hips sink (px): legs bend */
  crouch: number;
  /** shoulders' x shift over the hips (px; + forward) */
  lean: number;
  /** chest rise (px, − up) */
  chest: number;
  /** head offset over the neck (px) and the face */
  hx: number;
  hy: number;
  face: Face;
  /** extra head rotation (deg, + = chin down) — whole-pixel map rotation */
  hr: number;
  /** soles: back and front foot (body-local; x of the ankle, y of the sole) */
  fbx: number;
  fby: number;
  ffx: number;
  ffy: number;
  /** front (sword) hand and back hand (body-local) */
  gx: number;
  gy: number;
  rgx: number;
  rgy: number;
  /** sword angle (deg, screen, body-local: 90 = tip straight down, −90 = up, 0 = forward) */
  sa: number;
  /** sword hidden (dropped) */
  noSword: boolean;
  /** wings: near (camera side) and far */
  wn: Wing;
  wf: Wing;
  /** the near wing drawn in FRONT of the body (buckler guard, the clap, the cape) */
  nearFront: boolean;
  /** the far wing drawn in front of the torso (but behind the near arm) */
  farMid: boolean;
  /** the near wing drawn BEHIND the torso (the clap: both wings arc ahead of the body, the body stays clear) */
  nearBack: boolean;
  braid: Ribbon;
  sash: Ribbon;
  /** jewel: 0 dark, 1 dim (leaf3), 2 lit (leaf4), 3 flare (3-px cross) */
  jewel: number;
  /** the anim's ONE blade glint: 0 none, 1 dot, 2 cross (fixed pixel 5 px down the blade's lit edge) */
  glint: number;
}

export const WING_NEAR0: Wing = { a: -132, len: 28, bend: -14, chord: 10, side: 1, cv: 0.42, ps: 0.66 };
export const WING_FAR0: Wing = { a: -100, len: 24, bend: -16, chord: 8, side: 1, cv: 0.45, ps: 0.68 };
export const BRAID0: Ribbon = { th: 104, len: 15, amp: 1.2, ph: 0, flick: 0, curl: 34 };
export const SASH0: Ribbon = { th: 128, len: 7, amp: 1.2, ph: 0, flick: 0, curl: 24 };

export const NEUTRAL: Pose = {
  bx: 0,
  by: 0,
  rot: 0,
  piv: 0,
  crouch: 0,
  lean: 0,
  chest: 0,
  hx: 0,
  hy: 0,
  face: 'calm',
  hr: 0,
  fbx: 32,
  fby: GY,
  ffx: 40,
  ffy: GY,
  gx: 44,
  gy: 48,
  rgx: 31,
  rgy: 47,
  sa: 56,
  noSword: false,
  wn: WING_NEAR0,
  wf: WING_FAR0,
  nearFront: false,
  farMid: false,
  nearBack: false,
  braid: BRAID0,
  sash: SASH0,
  jewel: 2,
  glint: 0,
};

// ---------------------------------------------------------------- skeleton

export interface Skel {
  /** the body-local → frame transform */
  T: (p: V) => V;
  /** rotation of directions (deg added) */
  rot: number;
  hip: V;
  hipB: V;
  hipF: V;
  sh: V;
  shB: V;
  shF: V;
  neck: V;
  head: V;
  jewel: V;
  hand: V;
  rhand: V;
  tip: V;
  chest: V;
  feet: V;
  wnRoot: V;
  wfRoot: V;
  wnTip: V;
  wfTip: V;
  braidRoot: V;
  sashRoot: V;
}

const dirOf = (deg: number): V => [Math.cos(deg * DEG), Math.sin(deg * DEG)];
function rotAbout(p: V, c: V, deg: number): V {
  if (!deg) return p;
  const s = Math.sin(deg * DEG);
  const k = Math.cos(deg * DEG);
  const x = p[0] - c[0];
  const y = p[1] - c[1];
  return [c[0] + x * k - y * s, c[1] + x * s + y * k];
}

/** Hip centre at rest (body-local). */
const HIP0: V = [AX, 47];
/** The sword: blade length, grip length. */
export const BLADE = 12;

/** Wing leading edge at span fraction s (frame space). */
function wingLead(root: V, w: Wing, rot: number, s: number): V {
  const d1 = dirOf(w.a + rot);
  const d2 = dirOf(w.a + w.bend + rot);
  const WR = 0.42;
  if (s <= WR) return [root[0] + d1[0] * w.len * s, root[1] + d1[1] * w.len * s];
  const wr: V = [root[0] + d1[0] * w.len * WR, root[1] + d1[1] * w.len * WR];
  return [wr[0] + d2[0] * w.len * (s - WR), wr[1] + d2[1] * w.len * (s - WR)];
}

export function skeleton(P: Pose): Skel {
  const piv: V = P.piv === 1 ? [(P.fbx + P.ffx) / 2, GY] : HIP0;
  const T = (p: V): V => {
    const r = rotAbout(p, piv, P.rot);
    return [r[0] + P.bx, r[1] + P.by];
  };
  const hipL: V = [HIP0[0], HIP0[1] + P.crouch];
  const shL: V = [hipL[0] + 1 + P.lean, hipL[1] - 13 + P.chest];
  const neckL: V = [shL[0] + 1, shL[1] - 2];
  const headL: V = [neckL[0] + P.hx, neckL[1] - 4 + P.hy];
  const jewelL: V = [headL[0] + 2, headL[1] - 3];
  const handL: V = [P.gx, P.gy];
  const sd = dirOf(P.sa);
  const tipL: V = [handL[0] + sd[0] * (BLADE + 1), handL[1] + sd[1] * (BLADE + 1)];
  const hip = T(hipL);
  const sh = T(shL);
  const wnRoot = T([shL[0] - 3, shL[1] + 2]);
  const wfRoot = T([shL[0] - 3, shL[1]]);
  return {
    T,
    rot: P.rot,
    hip,
    hipB: T([hipL[0] - 2, hipL[1]]),
    hipF: T([hipL[0] + 2, hipL[1]]),
    sh,
    shB: T([shL[0] - 3, shL[1] + 1]),
    shF: T([shL[0] + 2, shL[1] + 1]),
    neck: T(neckL),
    head: T(headL),
    jewel: T(jewelL),
    hand: T(handL),
    rhand: T([P.rgx, P.rgy]),
    tip: T(tipL),
    chest: T([shL[0] + 1, shL[1] + 5]),
    feet: T([(P.fbx + P.ffx) / 2, (P.fby + P.ffy) / 2]),
    wnRoot,
    wfRoot,
    wnTip: wingLead(wnRoot, P.wn, P.rot, 1),
    wfTip: wingLead(wfRoot, P.wf, P.rot, 1),
    braidRoot: T([headL[0] - 4, headL[1] + 1]),
    sashRoot: T([hipL[0] - 3, hipL[1] - 3]),
  };
}

// ---------------------------------------------------------------- shading helpers

/** Flat tone planes over a part's opaque pixels from its own edges: lit toward the key light, dark away. */
function shade(q: PixelCanvas, light: Light, t: Tones, o: { lw?: number; tw?: number; sw?: number; bw?: number } = {}) {
  const lw = o.lw ?? 1;
  const tw = o.tw ?? 1;
  const sw = o.sw ?? 1;
  const bw = o.bw ?? 1;
  const src = q.clone();
  const side = light.side;
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
      let c = t.m;
      if (sw > 0 && near(x, y, -side, 0, sw)) c = t.d;
      else if ((lw > 0 && near(x, y, side, 0, lw)) || (tw > 0 && near(x, y, 0, -1, tw))) c = t.l;
      else if (bw > 0 && near(x, y, 0, 1, bw)) c = t.d;
      q.set(x, y, c);
    }
}

function tube(a: V, b: V, w: number, c: number): PixelCanvas {
  const q = new PixelCanvas(W, H);
  q.thickLine(rnd(a[0]), rnd(a[1]), rnd(b[0]), rnd(b[1]), w, c);
  return q;
}
function poly(pts: readonly V[], c: number): PixelCanvas {
  const q = new PixelCanvas(W, H);
  q.poly(pts.map((p) => [rnd(p[0]), rnd(p[1])] as const), c);
  return q;
}

/** A 4-connected whole-pixel line (each diagonal step adds its corner: no isolated stair pixels). */
function line4(q: PixelCanvas, a: V, b: V, put: (x: number, y: number) => void) {
  let x = rnd(a[0]);
  let y = rnd(a[1]);
  const x1 = rnd(b[0]);
  const y1 = rnd(b[1]);
  const n = Math.max(Math.abs(x1 - x), Math.abs(y1 - y));
  put(x, y);
  for (let k = 1; k <= n; k++) {
    const nx = rnd(a[0] + ((b[0] - a[0]) * k) / n);
    const ny = rnd(a[1] + ((b[1] - a[1]) * k) / n);
    if (nx !== x && ny !== y) put(nx, y);
    x = nx;
    y = ny;
    put(x, y);
  }
  void q;
}

// ---------------------------------------------------------------- wings

/**
 * One wing as flat chord bands. The span is sampled; each band is a polygon between two chord fractions; the
 * trailing edge carries whole-pixel feather serration (deeper on the primaries).
 */
export function paintWing(f: PixelCanvas, root: V, w: Wing, rot: number, tones: WingTones, light: Light, frontLayer = false) {
  const N = 18;
  const pts: { L: V; n: V; c: number; s: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const L = wingLead(root, w, rot, s);
    const L2 = wingLead(root, w, rot, Math.min(1, s + 0.02));
    const L1 = wingLead(root, w, rot, Math.max(0, s - 0.02));
    const dx = L2[0] - L1[0];
    const dy = L2[1] - L1[1];
    const dl = Math.hypot(dx, dy) || 1;
    const n: V = w.side > 0 ? [dy / dl, -dx / dl] : [-dy / dl, dx / dl];
    // chord: 70 % at the root, widest at the secondaries' end (s 0.45), a pointed kestrel tip
    const c = s < 0.45 ? w.chord * (0.7 + (0.3 * s) / 0.45) : w.chord * Math.pow(Math.max(0, 1 - (s - 0.45) / 0.55), 0.85);
    pts.push({ L, n, c, s });
  }
  /** serration: every third sample's trailing point juts out (feather tips), 2 px on the primaries */
  const serr = (i: number) => {
    const s = pts[i].s;
    if (s < 0.08 || s > 0.94) return 0;
    // the secondaries: small regular feather tips; the primaries: long separated fingers (cut below)
    if (s > w.ps) return 1.5;
    return i % 3 === 1 ? 1 : 0;
  };
  const P = (i: number, v: number, jut = 0): V => {
    const p = pts[i];
    const d = p.c * v + jut;
    return [p.L[0] + p.n[0] * d, p.L[1] + p.n[1] * d];
  };
  const band = (v0: number, v1: number, c: number, s0 = 0, s1 = 1, outer = false) => {
    const q = new PixelCanvas(W, H);
    const i0 = Math.round(s0 * N);
    const i1 = Math.round(s1 * N);
    const top: V[] = [];
    const bot: V[] = [];
    for (let i = i0; i <= i1; i++) {
      top.push(P(i, v0));
      bot.push(P(i, v1, outer ? serr(i) : 0));
    }
    q.poly([...top, ...bot.reverse()].map((p) => [rnd(p[0]), rnd(p[1])] as const), c);
    return q;
  };
  const q = new PixelCanvas(W, H);
  q.blit(band(0, 1, tones.ff, 0, 1, true), 0, 0);
  q.blit(band(0, w.cv, tones.gc), 0, 0);
  q.blit(band(0, 0.2, tones.lc, 0, Math.min(1, w.ps + 0.1)), 0, 0);
  // slate primaries (the outer hand), their tips one step darker
  q.blit(band(0.25, 1, tones.pr, w.ps, 1, true), 0, 0);
  q.blit(band(0.7, 1, tones.pt, w.ps + 0.08, 1, true), 0, 0);
  // light: a 2-px plane on the edges facing the key light (and the top) one step up, a 2-px plane on the far
  // side one step down (whole planes, never single edge pixels)
  const src = q.clone();
  const side = light.side;
  const b = src.bounds();
  const open = (x: number, y: number) => !src.isOpaque(x, y);
  if (b)
    for (let y = b.y; y < b.y + b.h; y++)
      for (let x = b.x; x < b.x + b.w; x++) {
        if (open(x, y)) continue;
        const c = src.get(x, y)!;
        if (open(x + side, y) || open(x + 2 * side, y) || open(x + 3 * side, y) || open(x, y - 1)) q.set(x, y, up(c));
        else if (open(x - side, y) || open(x - 2 * side, y)) q.set(x, y, wdown(c));
      }
  // the barring: evenly spaced short slate dashes in two rows ALONG the feathers' run (parallel to the
  // leading edge), the same length each, staggered like chevrons — never loose blobs
  const rows = [w.cv + (0.86 - w.cv) * 0.35, w.cv + (0.86 - w.cv) * 0.8];
  rows.forEach((v, r) => {
    const s0 = 0.1 + r * 0.06;
    const s1 = w.ps - 0.02;
    const step = 4 / N;
    for (let sb = s0; sb + 2 / N <= s1; sb += step) {
      const i = Math.round(sb * N);
      line4(q, P(i, v), P(Math.min(N, i + 1), v + 0.06), (x, y) => {
        const c = q.get(x, y);
        if (q.isOpaque(x, y) && c !== tones.lc && c !== PAL.earth4 && c !== tones.pr && c !== tones.pt) q.set(x, y, tones.bar);
      });
    }
  });
  // the primaries' fingers: 1-px gaps cut from the trailing edge inward (3 separate points beyond the hand)
  for (let k = 1; k <= 3; k++) {
    const sf = w.ps + ((1 - w.ps) * k) / 4.2;
    const i = Math.round(sf * N);
    if (i >= N) continue;
    line4(q, P(i, 0.5), P(Math.min(N, i + 1), 1.15, 1.5), (x, y) => q.erase(x, y));
  }
  // the alula: a small lit corner jutting off the leading edge at the wrist
  {
    const iw = Math.round(0.42 * N);
    const a = pts[iw];
    const tip: V = [a.L[0] - a.n[0] * 2 + (pts[iw + 1].L[0] - a.L[0]) * 1.2, a.L[1] - a.n[1] * 2 + (pts[iw + 1].L[1] - a.L[1]) * 1.2];
    const al = new PixelCanvas(W, H);
    al.poly([a.L, tip, pts[Math.min(N, iw + 2)].L].map((p) => [rnd(p[0]), rnd(p[1])] as const), tones.lc);
    al.poly([pts[iw - 1].L, a.L, pts[iw + 1].L].map((p) => [rnd(p[0]), rnd(p[1])] as const), tones.lc);
    q.blit(al, 0, 0);
  }
  composite(f, q, seam, frontLayer ? { top: 1, side: 1, bottom: 1 } : { top: 1, side: 1, bottom: 1 });
}

// ---------------------------------------------------------------- ribbons (braid, sash)

export function ribbonPath(r: Ribbon, root: V, rot: number): V[] {
  const n = Math.max(3, Math.round(r.len / 1.5));
  const pts: V[] = [root];
  let p = root;
  for (let k = 1; k <= n; k++) {
    const u = k / n;
    const th = r.th + rot + r.curl * u * u;
    const d = dirOf(th);
    p = [p[0] + (d[0] * r.len) / n, p[1] + (d[1] * r.len) / n];
    const perp: V = [-d[1], d[0]];
    const wave = r.amp * Math.sin((r.ph - u * 0.9) * Math.PI * 2) * u;
    const flick = -r.flick * Math.max(0, u - 0.5) * 2;
    pts.push([p[0] + perp[0] * wave, p[1] + perp[1] * wave + flick]);
  }
  return pts.map(([x, y]) => [rnd(Math.max(3, Math.min(W - 4, x))), rnd(Math.max(3, Math.min(GY, y)))] as V);
}

function drawBraid(f: PixelCanvas, P: Pose, S: Skel) {
  const path = ribbonPath(P.braid, S.braidRoot, S.rot);
  const q = new PixelCanvas(W, H);
  // a solid 2-px plait (night2 body, never a hollow outline against the dark floor), night1 links every 3 px
  q.stroke(path, 3, 2, PAL.night2);
  for (let i = 2; i < path.length - 1; i += 3) {
    const [x, y] = path[i];
    if (q.isOpaque(x, y + 1)) q.set(x, y + 1, PAL.night1);
    else if (q.isOpaque(x - 1, y)) q.set(x - 1, y, PAL.night1);
  }
  // gold tie two links from the tip
  const t = path[Math.max(1, path.length - 3)];
  q.set(t[0], t[1], PAL.gold1);
  composite(f, q, seam);
}

function drawSash(f: PixelCanvas, P: Pose, S: Skel, light: Light) {
  // a soft knot at the belt's back and two THIN tails (≤ 2 px at the root, tapering to 1 px, curling with a
  // travelling wave): cloth, never a blade — mist with one white highlight pixel on the knot
  const long = ribbonPath({ ...P.sash, th: P.sash.th + 34, curl: P.sash.curl - 34, amp: P.sash.amp + 0.9 }, S.sashRoot, S.rot);
  const short = ribbonPath({ ...P.sash, len: P.sash.len * 0.6, th: P.sash.th - 34, ph: P.sash.ph + 0.35, curl: P.sash.curl + 40, amp: P.sash.amp + 0.6 }, S.sashRoot, S.rot);
  const q = new PixelCanvas(W, H);
  q.stroke(short, 1, 1, PAL.steel);
  q.stroke(long, 1, 1, PAL.mist);
  const r = S.sashRoot;
  q.set(rnd(r[0]), rnd(r[1]), PAL.mist);
  // the one highlight: a white pixel on the long tail's second link
  const hl = long[Math.min(2, long.length - 1)];
  q.set(hl[0], hl[1], PAL.white);
  void light;
  composite(f, q, seam);
}

// ---------------------------------------------------------------- body parts

function drawLeg(f: PixelCanvas, S: Skel, hipJ: V, sole: V, light: Light, far: boolean) {
  const ankle: V = S.T([sole[0], sole[1] - 3]);
  const toe: V = S.T([sole[0] + 3, sole[1] - 1]);
  const heel: V = S.T([sole[0] - 2, sole[1] - 1]);
  const knee = ik2(hipJ, ankle, 11, 9, -1);
  const t = far ? LEGGING_FAR : LEGGING;
  const thigh = tube(hipJ, knee, far ? 3 : 4, t.m);
  shade(thigh, light, t, { lw: far ? 1 : 2, sw: 1, tw: 0, bw: 0 });
  composite(f, thigh, seam);
  const shin = tube(knee, ankle, 3, t.m);
  shade(shin, light, t, { lw: 2, sw: 0, tw: 0, bw: 0 });
  composite(f, shin, seam);
  // boot: a short wedge, toe forward
  const bt = new PixelCanvas(W, H);
  const cuff: V = S.T([sole[0], sole[1] - 5]);
  bt.thickLine(rnd(cuff[0]), rnd(cuff[1]), rnd(ankle[0]), rnd(ankle[1]), 3, BOOT.m);
  bt.poly([heel, ankle, toe, S.T([sole[0] + 3, sole[1]]), S.T([sole[0] - 2, sole[1]])].map((p) => [rnd(p[0]), rnd(p[1])] as const), BOOT.m);
  shade(bt, light, far ? { d: PAL.night1, m: PAL.night1, l: PAL.night2 } : BOOT, { lw: 2, sw: 0, tw: 0, bw: 1 });
  // gold cuff ring
  const c2: V = S.T([sole[0], sole[1] - 5]);
  if (!far) bt.set(rnd(c2[0]), rnd(c2[1]), PAL.gold1);
  composite(f, bt, seam);
}

function drawTorso(f: PixelCanvas, P: Pose, S: Skel, light: Light) {
  const T = S.T;
  const h: V = [HIP0[0], HIP0[1] + P.crouch];
  const s: V = [h[0] + 1 + P.lean, h[1] - 13 + P.chest];
  // hips / legging seat
  const seat = poly([T([h[0] - 3, h[1] - 3]), T([h[0] + 3, h[1] - 3]), T([h[0] + 3, h[1] + 1]), T([h[0] - 3, h[1] + 1])], LEGGING.m);
  shade(seat, light, LEGGING);
  composite(f, seat, seam);
  // bodice: shoulders → bust → waist (narrow) → hips
  const body = poly(
    [
      T([s[0] - 4, s[1]]),
      T([s[0] + 2, s[1] - 1]),
      T([s[0] + 3, s[1] + 2]),
      T([s[0] + 4, s[1] + 4]),
      T([s[0] + 3, s[1] + 6]),
      T([s[0] + 2, s[1] + 9]),
      T([h[0] + 3, h[1] - 2]),
      T([h[0] - 3, h[1] - 2]),
      T([s[0] - 3, s[1] + 9]),
      T([s[0] - 4, s[1] + 4]),
    ],
    BODICE.m,
  );
  shade(body, light, BODICE, { lw: 2, sw: 1, tw: 1, bw: 0 });
  // leaf3 only as the lit EDGE of the bust (a 1-px rim on the light side, upper half only)
  {
    const src = body.clone();
    const bb = src.bounds();
    if (bb)
      for (let y = bb.y; y < bb.y + Math.min(7, bb.h); y++)
        for (let x = bb.x; x < bb.x + bb.w; x++)
          if (src.isOpaque(x, y) && !src.isOpaque(x + light.side, y) && src.isOpaque(x - light.side, y)) body.set(x, y, PAL.leaf3);
  }
  // the bodice's gold neckline: two pixels at the collar
  const nl = T([s[0] + 1, s[1]]);
  body.set(rnd(nl[0]), rnd(nl[1]), PAL.gold2);
  composite(f, body, seam);
  // belt: gold band at the waist (2 rows), its buckle a lit pixel at the front
  const belt = poly([T([s[0] - 3, s[1] + 10]), T([s[0] + 2, s[1] + 10]), T([h[0] + 3, h[1] - 2]), T([h[0] - 3, h[1] - 2])], GOLD.m);
  shade(belt, light, GOLD, { lw: 0, tw: 0, sw: 1, bw: 1 });
  composite(f, belt, seam);
  // the neck
  const nk = tube(T([s[0] + 1, s[1]]), S.neck, 2, SKIN.d);
  composite(f, nk, seam);
}

function drawArm(f: PixelCanvas, sh: V, hand: V, light: Light, t: Tones, bend: number, bracer: boolean) {
  const el = ik2(sh, hand, 6, 6, bend);
  const up1 = tube(sh, el, 2, t.m);
  composite(f, up1, seam);
  // the forearm: 3 px on the near (bracer) arm, a lit plane and a shade plane, the elbow a 1-step darker corner
  const fo = tube(el, hand, bracer ? 3 : 2, t.m);
  if (bracer) shade(fo, light, t, { lw: 1, sw: 1, tw: 0, bw: 0 });
  if (bracer) {
    // gold bracer on the forearm's middle
    const m: V = [(el[0] + hand[0] * 2) / 3, (el[1] + hand[1] * 2) / 3];
    fo.set(rnd(m[0]), rnd(m[1]), PAL.gold2);
    fo.set(rnd(el[0]), rnd(el[1]), t.d);
  }
  composite(f, fo, seam);
  const hq = new PixelCanvas(W, H);
  hq.rect(rnd(hand[0]) - 1, rnd(hand[1]) - 1, 2, 2, t.m);
  composite(f, hq, seam);
}

function drawSword(f: PixelCanvas, P: Pose, S: Skel, light: Light) {
  if (P.noSword) return;
  const d = dirOf(P.sa + S.rot);
  const perp: V = [-d[1], d[0]];
  const g = S.hand;
  const at = (k: number): V => [g[0] + d[0] * k, g[1] + d[1] * k];
  // grip + pommel behind the hand
  const q = new PixelCanvas(W, H);
  const p0 = at(-3);
  q.thickLine(rnd(p0[0]), rnd(p0[1]), rnd(g[0]), rnd(g[1]), 1, PAL.earth2);
  q.set(rnd(p0[0]), rnd(p0[1]), PAL.gold1);
  composite(f, q, seam);
  // leaf blade: narrow at the guard, widest a third of the way, pointed
  const b0 = at(1.5);
  const bm = at(1.5 + BLADE * 0.45);
  const tip = at(BLADE + 1);
  const hw = 2;
  const blade = poly([b0, [bm[0] + perp[0] * hw, bm[1] + perp[1] * hw], tip, [bm[0] - perp[0] * hw, bm[1] - perp[1] * hw]], PAL.mist);
  shade(blade, light, { d: PAL.steel, m: PAL.mist, l: PAL.mist }, { lw: 1, sw: 1, tw: 0, bw: 0 });
  composite(f, blade, seam);
  // guard: gold wire across
  const gq = new PixelCanvas(W, H);
  const ga = at(0.6);
  gq.thickLine(rnd(ga[0] + perp[0] * 2), rnd(ga[1] + perp[1] * 2), rnd(ga[0] - perp[0] * 2), rnd(ga[1] - perp[1] * 2), 1, PAL.gold2);
  composite(f, gq, seam);
}

// ---------------------------------------------------------------- head (hand-made maps, facing right)

// keys: h hair (night1) · H hair lit (night2) · g circlet (gold2) · G circlet shade (gold1) · J jewel socket
// (painted after the outline) · S skin lit (skin3) · s skin shade (skin2) · f face front (skin3 lit P2, skin2 P1)
// · e eye (ink) · m mouth (earth2) · o open mouth (night1)
const HEAD_MAPS: Record<Face, readonly string[]> = {
  calm: [
    '..hhhh..',
    '.hHHHHh.',
    'hhGgggJ.',
    'hhhhSSSf',
    'hhhsSeSf',
    'hhhsSSSS',
    '.hhsSSm.',
    '.h.sSSf.',
    '....ss..',
  ],
  sing: [
    '...hhh..',
    '.hhHHHh.',
    'hhGgggJf',
    'hhhhSSeS',
    'hhhsSSSS',
    'hhhsSSSo',
    '.hhsSSoo',
    '.h..sSf.',
    '....ss..',
  ],
  struck: [
    '.hhhh...',
    'hHHHHh..',
    'hhGggJ..',
    'hhhSSSf.',
    'hhsSeSf.',
    'hhsSSSSS',
    '.hssSmS.',
    '.h.sSSf.',
    '....ss..',
  ],
  closed: [
    '..hhhh..',
    '.hHHHHh.',
    'hhGgggJ.',
    'hhhhSSSf',
    'hhhsSmSf',
    'hhhsSSSS',
    '.hhsSSm.',
    '.h.sSSf.',
    '....ss..',
  ],
};
const HEAD_W = 8;
const HEAD_H = 9;
/** the jewel's cell in every head map (col, row) */
function jewelCell(face: Face): V {
  const rows = HEAD_MAPS[face];
  for (let y = 0; y < rows.length; y++) {
    const x = rows[y].indexOf('J');
    if (x >= 0) return [x, y];
  }
  return [6, 2];
}

function headColor(k: string, light: Light): number | null {
  switch (k) {
    case 'h':
      return PAL.night1;
    case 'H':
      return PAL.night2;
    case 'g':
      return PAL.gold2;
    case 'G':
      return PAL.gold1;
    case 'J':
      return PAL.gold1;
    case 'S':
      return PAL.skin3;
    case 's':
      return PAL.skin2;
    case 'f':
      return light.side > 0 ? PAL.skin3 : PAL.skin2;
    case 'e':
      return PAL.ink;
    case 'm':
      return PAL.earth2;
    case 'o':
      return PAL.night1;
    default:
      return null;
  }
}

/**
 * Paint a head map with its top-left at the head origin, rotated by `deg` about the map's centre (whole-pixel
 * nearest sampling). Returns the jewel's frame pixel.
 */
function drawHead(f: PixelCanvas, P: Pose, S: Skel, light: Light): V {
  const rows = HEAD_MAPS[P.face];
  const deg = S.rot * 0.85 + P.hr;
  // the head origin: the head point is the map cell (3, 5) (behind the eye)
  const cx = S.head[0];
  const cy = S.head[1];
  const ox = 3.5;
  const oy = 5;
  const q = new PixelCanvas(W, H);
  const s = Math.sin(-deg * DEG);
  const k = Math.cos(-deg * DEG);
  const R = 7;
  for (let y = rnd(cy) - R; y <= rnd(cy) + R; y++)
    for (let x = rnd(cx) - R; x <= rnd(cx) + R; x++) {
      // inverse-rotate the target pixel centre into the map
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const mx = dx * k - dy * s + ox;
      const my = dx * s + dy * k + oy;
      const ix = Math.floor(mx);
      const iy = Math.floor(my);
      if (iy < 0 || iy >= HEAD_H || ix < 0 || ix >= HEAD_W) continue;
      const ch = rows[iy][ix];
      const c = headColor(ch, light);
      if (c !== null && q.inBounds(x, y)) q.set(x, y, c);
    }
  composite(f, q, seam);
  // the jewel's frame pixel: rotate its cell centre forward
  const [jx, jy] = jewelCell(P.face);
  const ddx = jx + 0.5 - ox;
  const ddy = jy + 0.5 - oy;
  const s2 = Math.sin(deg * DEG);
  const k2 = Math.cos(deg * DEG);
  return [Math.floor(cx + ddx * k2 - ddy * s2 - 0.5), Math.floor(cy + ddx * s2 + ddy * k2 - 0.5)];
}

// ---------------------------------------------------------------- the whole figure

const HEADC = new Set<number>([PAL.gold1, PAL.gold2, PAL.night1, PAL.night2, PAL.skin2, PAL.skin3]);

export function drawWingLady(p: PixelCanvas, P: Pose, lightFrom: 'left' | 'right' = 'left'): void {
  const light = lightOf(lightFrom);
  const S = skeleton(P);
  const f = new PixelCanvas(W, H);

  // 1 far wing (behind everything unless farMid)
  if (!P.farMid) paintWing(f, S.wfRoot, P.wf, S.rot, WING_FAR, light);
  if (P.nearBack) paintWing(f, S.wnRoot, P.wn, S.rot, WING_NEAR, light);
  // 3 back arm, back leg
  drawArm(f, S.shB, S.rhand, light, SKIN_FAR, 1, false);
  drawLeg(f, S, S.hipB, [P.fbx, P.fby], light, true);
  // 4 front leg
  drawLeg(f, S, S.hipF, [P.ffx, P.ffy], light, false);
  // 5 torso
  drawTorso(f, P, S, light);
  // 6 sash (streams from the belt's back)
  drawSash(f, P, S, light);
  if (P.farMid) paintWing(f, S.wfRoot, P.wf, S.rot, WING_FAR, light);
  // 7 near wing (behind the head and the sword arm) — or in front (buckler / clap / cape)
  if (!P.nearFront && !P.nearBack) paintWing(f, S.wnRoot, P.wn, S.rot, WING_NEAR, light);
  // 8 braid (hangs down her back over the wing roots), head
  drawBraid(f, P, S);
  const jewel = drawHead(f, P, S, light);
  if (P.nearFront) paintWing(f, S.wnRoot, P.wn, S.rot, WING_NEAR, light, true);
  // 9 sword, then the front arm over its grip
  drawSword(f, P, S, light);
  drawArm(f, S.shF, S.hand, light, light.side < 0 ? SKIN_SHADE : SKIN, 1, true);

  // the floor cuts anything that rotates below the sole line (a fall pivoting on the feet)
  for (let y = GY + 1; y < H; y++) for (let x = 0; x < W; x++) f.erase(x, y);
  cleanCrumbs(f);
  despeckle(f);
  f.outline(PAL.ink);

  // emissive: the jewel (never outlined) — it sits inside the head, so a covering wing hides it
  if (P.jewel > 0 && HEADC.has(f.get(jewel[0], jewel[1]) ?? -1)) {
    const core = P.jewel >= 2 ? PAL.leaf4 : PAL.leaf3;
    f.set(jewel[0], jewel[1], core);
    const setX = jewel[0] - 1;
    if (f.isOpaque(setX, jewel[1]) && f.get(setX, jewel[1]) !== PAL.ink) f.set(setX, jewel[1], PAL.gold4);
    if (P.jewel >= 3)
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1]] as const) {
        const x = jewel[0] + dx;
        const y = jewel[1] + dy;
        if (f.inBounds(x, y) && x > 1 && x < W - 2 && y > 1) f.set(x, y, PAL.leaf3);
      }
  }
  // the point: one white pixel on the blade's last lit pixel (it reads as a blade at 1×, not as a leg stripe)
  if (!P.noSword) {
    const d = dirOf(P.sa + S.rot);
    for (let k = BLADE + 1; k >= BLADE - 2; k--) {
      const x = rnd(S.hand[0] + d[0] * k);
      const y = rnd(S.hand[1] + d[1] * k);
      const c = f.get(x, y);
      if (c === PAL.mist || c === PAL.steel) {
        f.set(x, y, PAL.white);
        break;
      }
    }
  }
  // the blade glint (≤ 1 per anim)
  if (P.glint > 0 && !P.noSword) {
    const d = dirOf(P.sa + S.rot);
    const g: V = [rnd(S.hand[0] + d[0] * 6), rnd(S.hand[1] + d[1] * 6)];
    const put = (x: number, y: number) => {
      const c = f.get(x, y);
      if (c === PAL.mist || c === PAL.steel) f.set(x, y, PAL.white);
    };
    put(g[0], g[1]);
    if (P.glint >= 2) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(g[0] + dx, g[1] + dy);
  }
  p.blit(f, 0, 0);
}

/** The jewel's frame pixel of a pose (the `head` point). */
export function jewelOf(P: Pose): V {
  const S = skeleton(P);
  const [jx, jy] = jewelCell(P.face);
  const deg = S.rot * 0.85 + P.hr;
  const ddx = jx + 0.5 - 3.5;
  const ddy = jy + 0.5 - 5;
  const s2 = Math.sin(deg * DEG);
  const k2 = Math.cos(deg * DEG);
  return [Math.floor(S.head[0] + ddx * k2 - ddy * s2 - 0.5), Math.floor(S.head[1] + ddx * s2 + ddy * k2 - 0.5)];
}
