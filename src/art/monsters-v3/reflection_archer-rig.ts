// Yansıyan Okçu v3 — the "light-woven moon archer and its living reflection" rig: Pose → pixels.
//
// A tall, slim archer woven of light (white / mist planes, a 1-px water4 glass edge on the shadow side), a moon-blue
// tabard, a gold crescent-moon crown standing behind the head, two light ribbons of hair streaming back and a tall
// gold crescent bow. It stands in a puddle of light; in the puddle lives its INVERTED, dark-blue reflection
// (YENI_KARTLAR §C4): driven by its own skeleton, mirrored at the puddle's far water line and foreshortened, a dark
// night silhouette with a fixed-size hood, down-hanging crescent-crown horns and a light-blue bow arc on the lit
// water1 sheet of the puddle, rippled by the puddle's rings. The puddle is a flat iso ellipse inside the
// tile (≤ 40×16): a 1-px specular rim, a sparse water-line haze and a drifting sheen — the tile shows through. The reflection has its own pose (`R`): it lags, leads, looks at the
// viewer, breaks first in death.
//
//   - every part is a flat polygon / tube shaded by flat value planes measured from its own edges (IŞ-3);
//     hard parts move by whole pixels and never rotate as sprites; limbs are 2-link IK tubes;
//   - ONE key light from the screen's top-left: `light` = the frame edge it comes from ('left' P1, 'right' the P2
//     relight sheet); planes are chosen per light;
//   - the figure is outlined in PAL.ink; the puddle and the reflection are floor (no ink outline, their own rim);
//   - light (eyes, chest gem, bow string, light arrow, bow-horn glow, crown glint, motes, flashes) is painted after
//     the outline and never outlined (IŞ-9).
// Frame 76×92; 1 art px = 1 game px; the root R (RX, GY) is the ground point between the feet.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ik2, lightOf, type Light } from '../rigkit';
import {
  Comp, DEG, GLASS, GOLD, GOLD_FAR, LIGHTW, LIGHTW_FAR, ROBE, ROBE_FAR, bands, boxOf, cleanCrumbs, hash2, taperPoly, tubePoly, type Pt, type Tones,
} from './reflection_archer-kit';

export const W = 76;
export const H = 92;
export const RX = 30;
export const GY = 64;
/** The floor-mirror foreshortening of the cinematic twins (the arrow under the floor, the motes, the panes). */
export const KR = 0.45;
/**
 * The puddle and the reflection in it (board readability, crit r2): the ATK/DEF badge covers the tile's whole
 * front half (tile centre + 7 … + 15 px), so the puddle lies on the tile's back/side half — a flat iso 2:1
 * ellipse from the feet toward the tile's RIGHT corner on screen (the P1 sheet: in front of the archer; the P2
 * relight sheet is mirrored by flipX, so there it lies behind the archer's back and still lands on screen right,
 * clear of the up-left neighbour's badge). The inverted reflection hangs from the puddle's far water line
 * (`my`, behind the archer's feet), offset by `rdx` beside the archer so its body clears the archer's legs,
 * foreshortened by `kr` (crit r3: 0.36 — a ~20-px twin with a readable hood, crown and bow), its crown tips
 * ending just above the badge (GY + 5). The puddle reaches back toward the tile's far corner to hold it.
 */
export interface PuddleGeo {
  /** ellipse centre and radii (frame px) */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** the reflection's x offset and its mirror line (its feet), its foreshortening */
  rdx: number;
  my: number;
  kr: number;
}
const GEO_L: PuddleGeo = { cx: RX + 11, cy: GY - 6, rx: 19, ry: 11, rdx: 13, my: GY - 18, kr: 0.36 };
const GEO_R: PuddleGeo = { cx: RX - 10, cy: GY - 6, rx: 18, ry: 11, rdx: -15, my: GY - 18, kr: 0.36 };
/** The puddle geometry of a sheet ('left' = the P1 sheet, 'right' = the P2 relight sheet, shown flipped). */
export const puddleGeo = (lightFrom: 'left' | 'right'): PuddleGeo => (lightFrom === 'right' ? GEO_R : GEO_L);
/** The geometry of the sheet being drawn (set by drawArcher; drawing is synchronous). */
let G: PuddleGeo = GEO_L;
/** The P1 sheet's puddle (kept for older callers). */
export const PCX = GEO_L.cx;
export const PCY = GEO_L.cy;
export const PRX = GEO_L.rx;
export const PRY = GEO_L.ry;

export const enum Part {
  none = 0,
  crown,
  hair,
  bow,
  armF,
  legF,
  robeB,
  legN,
  torso,
  robeF,
  head,
  armN,
}

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rnd = Math.round;
const fl = Math.floor;

// ---------------------------------------------------------------- pose

export interface Pose {
  /** whole-body sink (px, + down; the feet stay) */
  py: number;
  /** hip x shift (weight transfer) */
  hx: number;
  /** chest rise (breath, − up) and lean of the chest over the hips (px, + toward the foe) */
  ty: number;
  lean: number;
  /** head offset; look 0 = profile toward the foe, 1 = turned to the viewer (the reflection's moment) */
  hdx: number;
  hdy: number;
  look: number;
  /** eyes 0 dark … 1 gold … 2 white; lid 0 open, 1 half, 2 shut */
  eye: number;
  lid: number;
  /** bow (far) hand target rel. R, bow tilt (deg, 0 = upright, belly toward the foe), bow in front of the body */
  bx: number;
  by: number;
  ba: number;
  bowFront: number;
  /** draw (near) hand target rel. R; draw 1 = the string runs to that hand */
  nx: number;
  ny: number;
  draw: number;
  /** light arrow: 0 none, 1 nocked … 3 blazing (charge); shot = release streak 0…1 */
  arrow: number;
  shot: number;
  /** feet: x shifts and lifts */
  nfx: number;
  nfl: number;
  ffx: number;
  ffl: number;
  /** hair ribbons: wave phase (turns), amplitude, lift; tabard hem sway (px, + forward) */
  hair: number;
  hairK: number;
  hairY: number;
  cloth: number;
  /** crown glow 0…3; the anim's one glint (0 none, 1 = 1 px, 2 = cross) on the crown's front horn */
  crownG: number;
  glint: number;
  /** bow-horn glow 0…3, chest gem 0…3 */
  bowG: number;
  gem: number;
  /** the archer's vertical scale (summon: it unfolds up out of the mirror line) */
  k: number;
  /** puddle: presence 0…1, ripple phase (−1 none), crack 0…1, glow 0…2, splash crown 0…1 */
  pud: number;
  rip: number;
  crack: number;
  pudG: number;
  splash: number;
  /** reflection: visibility 0…1 (rises out of the surface), break 0…1 (shards) */
  rv: number;
  rbreak: number;
  /** the reflection's arrow under the floor (attack): 0 none, else its run 0…1 to the puddle's front edge */
  under: number;
  /** guard: the mirror pane between bow and string 0…1, its shimmer phase */
  pane: number;
  paneP: number;
  /** hitMagic: glass flash 0…1; flat 1 = death's "flat" archer without planes; shatter 0…1; dissolve 0…1 */
  flash: number;
  flat: number;
  shatter: number;
  diss: number;
  gather: boolean;
  /** summon: the falling drop's height above the ground (−1 none) */
  drop: number;
  /** light sparks phase (0 none), the release smear, 1-px tremble (alternating 1 / 2) */
  spark: number;
  smear: number;
  shake: number;
  /** motes rising off the puddle: phase (−1 none) */
  mote: number;
  /** global phase 0…1 */
  t: number;
  /** the reflection's own pose (null: mirror this one) */
  R: Pose | null;
}

export const NEUTRAL: Pose = {
  py: 0, hx: 0, ty: 0, lean: 0, hdx: 0, hdy: 0, look: 0, eye: 1, lid: 0,
  bx: 12, by: -29, ba: 6, bowFront: 0, nx: 7, ny: -27, draw: 0, arrow: 0, shot: 0,
  nfx: 0, nfl: 0, ffx: 0, ffl: 0,
  hair: 0, hairK: 1, hairY: 0, cloth: 0,
  crownG: 1, glint: 0, bowG: 1, gem: 1,
  k: 1,
  pud: 1, rip: 0, crack: 0, pudG: 1, splash: 0,
  rv: 1, rbreak: 0, under: 0,
  pane: 0, paneP: 0,
  flash: 0, flat: 0, shatter: 0, diss: 0, gather: false,
  drop: -1, spark: 0, smear: 0, shake: 0, mote: -1,
  t: 0, R: null,
};
export const pose = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

// ---------------------------------------------------------------- skeleton

export interface Skel {
  pel: Pt;
  C: Pt;
  neck: Pt;
  head: Pt;
  sh1: Pt;
  sh2: Pt;
  el1: Pt;
  w1: Pt;
  el2: Pt;
  w2: Pt;
  hip1: Pt;
  hip2: Pt;
  kn1: Pt;
  kn2: Pt;
  an1: Pt;
  an2: Pt;
  /** bow: grip, up axis (unit), belly axis (unit), top / bottom horn, nock (string middle or the draw hand) */
  grip: Pt;
  bu: Pt;
  bb: Pt;
  top: Pt;
  bot: Pt;
  nock: Pt;
  /** arrow tail and point (when nocked) */
  atail: Pt;
  apt: Pt;
  gem: Pt;
  eye: Pt;
}

export const ARM1 = 7.5;
export const ARM2 = 7.5;
export const LEG = 9.6;
export const BOW_L = 15;
export const BOW_BULGE = 5;
export const ARROW_L = 21;

const reach = (a: Pt, b: Pt, len: number): Pt => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy);
  return d <= len ? b : [a[0] + (dx / d) * len, a[1] + (dy / d) * len];
};

export function skeleton(o: Pose): Skel {
  const pel: Pt = [RX + o.hx, GY - 21 + o.py];
  const C: Pt = [pel[0] + o.lean, pel[1] - 13 + o.ty];
  const neck: Pt = [C[0] + 1, C[1] - 3];
  const head: Pt = [neck[0] + 1 + o.hdx, neck[1] - 4 + o.hdy];
  const sh1: Pt = [C[0] + 2, C[1] - 1];
  const sh2: Pt = [C[0] - 2, C[1] - 2];
  const w2 = reach(sh2, [RX + o.bx, GY + o.by], ARM1 + ARM2 - 0.2);
  const el2 = ik2(sh2, w2, ARM1, ARM2, 1) as Pt;
  const w1 = reach(sh1, [RX + o.nx, GY + o.ny], ARM1 + ARM2 - 0.2);
  const el1 = ik2(sh1, w1, ARM1, ARM2, o.draw > 0 ? -1 : 1) as Pt;
  const hip1: Pt = [pel[0] + 2, pel[1]];
  const hip2: Pt = [pel[0] - 2, pel[1] - 1];
  const an1: Pt = [RX + 4 + o.nfx, GY - 3 - o.nfl];
  const an2: Pt = [RX - 4 + o.ffx, GY - 3 - o.ffl];
  const kn1 = ik2(hip1, an1, LEG, LEG, -1) as Pt;
  const kn2 = ik2(hip2, an2, LEG, LEG, -1) as Pt;
  const a = o.ba * DEG;
  const bu: Pt = [Math.sin(a), -Math.cos(a)];
  const bb: Pt = [Math.cos(a), Math.sin(a)];
  const grip: Pt = [w2[0] + bb[0] * 1, w2[1] + bb[1] * 1];
  const top: Pt = [grip[0] + bu[0] * BOW_L - bb[0] * BOW_BULGE, grip[1] + bu[1] * BOW_L - bb[1] * BOW_BULGE];
  const bot: Pt = [grip[0] - bu[0] * BOW_L - bb[0] * BOW_BULGE, grip[1] - bu[1] * BOW_L - bb[1] * BOW_BULGE];
  const mid: Pt = [(top[0] + bot[0]) / 2, (top[1] + bot[1]) / 2];
  const nock: Pt = o.draw > 0 ? [w1[0] + 1, w1[1]] : mid;
  // the arrow lies from the nock through the grip and on
  const ax = grip[0] - nock[0];
  const ay = grip[1] - nock[1];
  const al = Math.hypot(ax, ay) || 1;
  const atail: Pt = nock;
  const apt: Pt = [grip[0] + (ax / al) * 6, grip[1] + (ay / al) * 6];
  return {
    pel, C, neck, head, sh1, sh2, el1, w1, el2, w2, hip1, hip2, kn1, kn2, an1, an2,
    grip, bu, bb, top, bot, nock, atail, apt,
    gem: [C[0] + 2, C[1] + 3],
    eye: [head[0] + 2, head[1] - 1],
  };
}

// ---------------------------------------------------------------- view (the archer, or its mirror in the puddle)

interface View {
  /** frame px of a skeleton point */
  T: (p: Pt) => Pt;
  /** vertical factor of local offsets (head, crown) */
  hk: number;
  refl: boolean;
}

function mainView(k: number): View {
  return { T: (p) => [p[0], GY - (GY - p[1]) * k], hk: k, refl: false };
}
function reflView(kr = G.kr, dx = G.rdx, my = G.my): View {
  return { T: (p) => [p[0] + dx, my + (GY - p[1]) * kr], hk: -Math.max(0.55, kr * 1.4), refl: true };
}

interface Ctx {
  comp: Comp;
  light: Light;
  o: Pose;
  sk: Skel;
  v: View;
}

const layer = () => new PixelCanvas(W, H);

// ---------------------------------------------------------------- figure parts

function drawCrown(c: Ctx): void {
  const { sk, v, light } = c;
  const [hx, hy] = v.T(sk.head);
  const k = v.hk;
  // a crescent moon standing behind the head: its bowl passes behind the hood, the horns rise either side
  const q = layer();
  const cx = hx - 0.5;
  const cy = hy - 9 * k;
  const ak = Math.max(0.3, Math.abs(k));
  const sgn = k < 0 ? -1 : 1;
  for (let y = -16; y <= 16; y++)
    for (let x = -9; x <= 9; x++) {
      const ux = x + 0.5;
      const uy = ((y + 0.5) / ak) * sgn;
      const out = ux * ux + uy * uy <= 6.5 * 6.5;
      const iy = uy + 3;
      const inn = ux * ux + iy * iy <= 6 * 6;
      if (out && !inn) q.set(rnd(cx + x), rnd(cy + y), GOLD.M);
    }
  bands(q, GOLD, light, 1, 1);
  c.comp.add(q, Part.crown, {});
}

function drawHair(c: Ctx, far: boolean): void {
  const { sk, v, light, o } = c;
  const t: Tones = far ? LIGHTW_FAR : LIGHTW;
  const [hx, hy] = v.T(sk.head);
  const s = v.hk;
  // two ribbons of light from the back of the head, streaming back and down; the wave runs root → tip
  const root: Pt = [hx - 3 + (far ? 1 : 0), hy + (-2 + (far ? 1 : 0) - o.hairY) * s];
  const n = 4;
  const pts: Pt[] = [root];
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    const wave = Math.sin((o.hair - u * 0.6 + (far ? 0.25 : 0)) * TAU) * o.hairK * (0.4 + u * 1.3);
    const x = root[0] - u * (far ? 8 : 10) - (far ? 0 : 1) * u * u * 2;
    const y = root[1] + (u * (far ? 13 : 11) + wave) * s;
    pts.push([x + wave * 0.3, y]);
  }
  const q = layer();
  for (let i = 0; i < n; i++) {
    const wa = (far ? 2.4 : 3.2) * (1 - i / n) + 1.2;
    const wb = (far ? 2.4 : 3.2) * (1 - (i + 1) / n) + 1.2;
    q.poly(taperPoly(pts[i], pts[i + 1], wa, wb), t.M);
  }
  bands(q, t, light, 1, 1, far ? {} : { rim: GLASS });
  c.comp.add(q, Part.hair, {});
}

function drawBow(c: Ctx): void {
  const { sk, v, light, o } = c;
  const q = layer();
  const n = 14;
  const side: Pt[] = [];
  const other: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const s = -1 + (2 * i) / n;
    const cx = sk.grip[0] + sk.bu[0] * s * BOW_L - sk.bb[0] * BOW_BULGE * s * s;
    const cy = sk.grip[1] + sk.bu[1] * s * BOW_L - sk.bb[1] * BOW_BULGE * s * s;
    const hw = 0.55 + 1.7 * (1 - s * s);
    // the belly is thicker outward (crescent): the outer edge bulges, the inner edge follows the string side
    const ox = cx + sk.bb[0] * hw * 1.2;
    const oy = cy + sk.bb[1] * hw * 1.2;
    const ix = cx - sk.bb[0] * hw * 0.8;
    const iy = cy - sk.bb[1] * hw * 0.8;
    side.push(v.T([ox, oy]));
    other.unshift(v.T([ix, iy]));
  }
  q.poly([...side, ...other], GOLD.M);
  bands(q, o.bowFront > 0 ? GOLD : GOLD, light, 1, 1);
  // a grip wrap (2 px, moon-blue) where the hand closes
  const [gx, gy] = v.T(sk.grip);
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -2; dx <= 2; dx++) if (q.isOpaque(rnd(gx) + dx, rnd(gy + dy * v.hk))) q.set(rnd(gx) + dx, rnd(gy + dy * v.hk), dy === -1 ? ROBE.L : ROBE.M);
  c.comp.add(q, Part.bow, { out: PAL.night2 });
}

function drawArm(c: Ctx, near: boolean): void {
  const { sk, v, light } = c;
  const sh = v.T(near ? sk.sh1 : sk.sh2);
  const el = v.T(near ? sk.el1 : sk.el2);
  const w = v.T(near ? sk.w1 : sk.w2);
  const t = near ? LIGHTW : LIGHTW_FAR;
  const q = layer();
  q.poly(taperPoly(sh, el, 3.6, 3), t.M);
  q.poly(taperPoly(el, w, 3, 2.4), t.M);
  q.disc(rnd(w[0] - 0.5), rnd(w[1] - 0.5), 1.4, t.M);
  bands(q, t, light, 1, 1, near ? { rim: GLASS } : {});
  // a gold bracer on the forearm
  const g = near ? GOLD : GOLD_FAR;
  const bx = el[0] + (w[0] - el[0]) * 0.55;
  const by = el[1] + (w[1] - el[1]) * 0.55;
  q.poly(tubePoly([bx - (w[0] - el[0]) * 0.12, by - (w[1] - el[1]) * 0.12], [bx + (w[0] - el[0]) * 0.12, by + (w[1] - el[1]) * 0.12], 3.4), g.M);
  c.comp.add(q, near ? Part.armN : Part.armF, { out: near ? PAL.steel : undefined });
}

function drawLeg(c: Ctx, near: boolean): void {
  const { sk, v, light, o } = c;
  const hip = v.T(near ? sk.hip1 : sk.hip2);
  const kn = v.T(near ? sk.kn1 : sk.kn2);
  const an = v.T(near ? sk.an1 : sk.an2);
  const t = near ? LIGHTW : LIGHTW_FAR;
  const q = layer();
  q.poly(taperPoly(hip, kn, 4.4, 3.4), t.M);
  q.poly(taperPoly(kn, an, 3.4, 2.6), t.M);
  // pointed light boot: toe forward
  const lift = near ? o.nfl : o.ffl;
  const sole = v.T([0, GY - lift])[1];
  const ax = an[0];
  const ay = an[1];
  if (v.refl) q.poly([[ax - 1.5, ay], [ax + 1.5, ay], [ax + 4, sole], [ax - 2, sole]], t.M);
  else q.poly([[ax - 1.5, ay - 1], [ax + 1.5, ay - 1], [ax + 5, sole], [ax - 2, sole]], t.M);
  bands(q, t, light, 1, 1, near ? { rim: GLASS } : {});
  // gold anklet
  const g = near ? GOLD : GOLD_FAR;
  const ar = v.T([0, (near ? sk.an1 : sk.an2)[1] - 1])[1];
  for (let x = rnd(ax) - 2; x <= rnd(ax) + 1; x++) if (q.isOpaque(x, rnd(ar))) q.set(x, rnd(ar), x <= rnd(ax) - 1 ? g.L : g.M);
  c.comp.add(q, near ? Part.legN : Part.legF, { out: near ? PAL.steel : undefined });
}

function drawRobe(c: Ctx, front: boolean): void {
  const { sk, v, light, o } = c;
  const [px, py] = sk.pel;
  const hem = GY - 9;
  const t = front ? ROBE : ROBE_FAR;
  const q = layer();
  const sw = o.cloth;
  let pts: Pt[];
  if (front)
    // the front panel: waist → a pointed hem forward, two ≥ 2-px teeth
    pts = [[px - 1, py - 3], [px + 4, py - 3], [px + 8 + sw * 0.6, hem - 3], [px + 8 + sw, hem + 1], [px + 4 + sw, hem - 1], [px + 2 + sw * 0.8, hem + 2], [px - 1 + sw * 0.5, hem - 1]];
  else pts = [[px - 4, py - 3], [px + 1, py - 3], [px + 1 + sw * 0.4, hem - 2], [px - 3 + sw * 0.7, hem], [px - 5 + sw * 0.8, hem - 2], [px - 9 + sw, hem + 1], [px - 7 + sw * 0.6, hem - 5]];
  q.poly(pts.map(v.T), t.M);
  // a broad lit plane on the light side of each panel (the back panel's edge catches the light past the body)
  bands(q, t, light, 3, 1);
  // gold hem trim (1 px along the bottom edge)
  const b = boxOf(q);
  if (b)
    for (let x = b.x0; x <= b.x1; x++) {
      let yb = -1;
      for (let y = b.y1; y >= b.y0; y--) if (q.isOpaque(x, y)) { yb = y; break; }
      if (yb >= 0 && !v.refl) q.set(x, yb, front ? GOLD.M : GOLD_FAR.M);
    }
  c.comp.add(q, front ? Part.robeF : Part.robeB, { out: front ? PAL.night2 : undefined });
}

function drawTorso(c: Ctx): void {
  const { sk, v, light } = c;
  const [px, py] = sk.pel;
  const [cx, cy] = sk.C;
  const q = layer();
  // a slim bodice of light: narrow waist, shoulders, a high collar under the chin
  const pts: Pt[] = [
    [px - 3, py - 1], [px + 3, py - 1], [cx + 3, cy + 5], [cx + 4, cy], [cx + 3, cy - 2], [cx + 2, cy - 4], [cx - 1, cy - 4], [cx - 4, cy - 2], [cx - 4, cy + 2], [cx - 3, cy + 6],
  ];
  q.poly(pts.map(v.T), LIGHTW.M);
  bands(q, LIGHTW, light, 2, 2, { rim: GLASS });
  // waist sash (moon-blue, 2 px)
  const [, wy] = v.T([0, py - 2]);
  for (let y = rnd(wy) - 1; y <= rnd(wy); y++) for (let x = rnd(px) - 4; x <= rnd(px) + 4; x++) if (q.isOpaque(x, y)) q.set(x, y, y === rnd(wy) - 1 ? ROBE.L : ROBE.M);
  c.comp.add(q, Part.torso, { out: PAL.steel });
}

function drawHead(c: Ctx): void {
  const { sk, v, light, o } = c;
  const [hx, hy] = v.T(sk.head);
  const s = v.hk;
  const P = (pts: Pt[]) => pts.map(([dx, dy]) => [hx + dx, hy + dy * s] as Pt);
  // a moon-blue hood, open toward the foe on a smooth mask of light (turned: the mask faces the viewer)
  const q = layer();
  q.poly(P([[-4, -5], [1, -5], [3, -4], [4, -2], [4, 2], [2, 4], [-2, 5], [-5, 3], [-5, -2]]), ROBE.M);
  // the hood's back catches the key light: a broad lit plane (steel over moon-blue) on the light side
  bands(q, { ...ROBE, L: PAL.steel }, light, 3, 1);
  c.comp.add(q, Part.head, { out: PAL.steel });
  const m = layer();
  if (o.look >= 0.5) m.poly(P([[-3, -3], [2, -3], [3, -1], [3, 2], [1, 4], [-2, 4], [-3, 2]]), LIGHTW.M);
  else m.poly(P([[0, -3], [3, -3], [5, -1], [5, 1], [3, 3], [1, 4], [0, 2]]), LIGHTW.M);
  // the profile's front (toward the foe, away from the key light) turns into the shade: lit cheek, mist, steel brow
  bands(m, LIGHTW, light, 2, o.look >= 0.5 ? 1 : 3);
  c.comp.add(m, Part.head, {});
}

/** The whole figure (archer or reflection) into p (no outline). */
function drawFigure(p: PixelCanvas, o: Pose, light: Light, v: View): Comp {
  const sk = skeleton(o);
  const comp = new Comp(p);
  const c: Ctx = { comp, light, o, sk, v };
  drawCrown(c);
  if (!v.refl) {
    drawHair(c, true);
    drawHair(c, false);
  }
  if (o.bowFront <= 0) drawBow(c);
  drawArm(c, false);
  drawLeg(c, false);
  drawRobe(c, false);
  drawLeg(c, true);
  drawTorso(c);
  drawRobe(c, true);
  drawHead(c);
  if (o.bowFront > 0) drawBow(c);
  drawArm(c, true);
  return comp;
}

// ---------------------------------------------------------------- the puddle and the reflection

/** Inside test of the puddle scaled by s (1 = full): the flat iso ellipse round the feet. Returns the squared
 *  normalised distance (≤ 1 inside; the rim ≈ 0.8…1). */
function inPuddle(x: number, y: number, s: number): number {
  if (s <= 0) return 99;
  const k = Math.min(1, s);
  const ax = (x + 0.5 - pcx(k)) / (G.rx * s);
  const ay = (y + 0.5 - pcy(k)) / (G.ry * s);
  return ax * ax + ay * ay;
}
/** The puddle's centre while it spreads (s < 1): it opens out of the feet toward its own centre. */
const pcx = (s: number): number => RX + (G.cx - RX) * s;
const pcy = (s: number): number => GY + (G.cy - GY) * s;


/** The puddle rim's 1-px ring at scale s (d ≤ 1 with an outside 4-neighbour). */
const onRim = (x: number, y: number, s: number): boolean =>
  inPuddle(x, y, s) <= 1 && (inPuddle(x + 1, y, s) > 1 || inPuddle(x - 1, y, s) > 1 || inPuddle(x, y + 1, s) > 1 || inPuddle(x, y - 1, s) > 1);

/** The reflection's tone for a figure tone (dark blue: night / water darks, YENI_KARTLAR §C4). */
export const REFL_MAP = new Map<number, number>([
  [PAL.white, PAL.water2], [PAL.mist, PAL.water2], [PAL.steel, PAL.water1], [GLASS, PAL.water3],
  [PAL.night4, PAL.night3], [PAL.night3, PAL.night2], [PAL.night2, PAL.night1], [PAL.night1, PAL.night0],
  [PAL.gold4, PAL.water3], [PAL.gold3, PAL.water2], [PAL.gold2, PAL.water1], [PAL.gold1, PAL.night2],
]);

/** The reflection's value ladder (dark → light) for its light ramp. */
const REFL_LADDER: number[] = [PAL.night0, PAL.night1, PAL.night2, PAL.water1, PAL.water2, PAL.water3, PAL.water4];
/** The card art's lake keeps the original darker mapping. */
const REFL_MAP_DEEP = new Map<number, number>([
  [PAL.white, PAL.water2], [PAL.mist, PAL.water2], [PAL.steel, PAL.water1], [GLASS, PAL.water3],
  [PAL.night4, PAL.water1], [PAL.night3, PAL.night2], [PAL.night2, PAL.night1], [PAL.night1, PAL.night0],
  [PAL.gold4, PAL.water4], [PAL.gold3, PAL.water3], [PAL.gold2, PAL.water3], [PAL.gold1, PAL.water2],
]);

/** The mirror sheen: a 1-px iso-diagonal line of light drifting across the surface (x + 2·dy = c). */
function sheenAt(o: Pose, s: number): number {
  const ph = (((o.t * 2) % 1) + 1) % 1;
  return pcx(s) - G.rx * s - 6 + ph * (2 * G.rx * s + 12);
}

/** The still sheet's shade crescent (IŞ-1 / IŞ-3): past this squared radius, on the side away from the key light,
 *  the water1 sheet falls to water0 — the far end of the water turns from the light (lit / mid / shade planes). */
const SHADE_D = 0.6;

/** The puddle surface: see-through (the tile shows through a sparse 2×2 haze), a 1-px specular rim (lit on the
 *  far edge), a drifting sheen line and the ripple rings. Drawn under the reflection. */
function drawPuddle(p: PixelCanvas, o: Pose, light: Light): void {
  if (o.pud <= 0) return;
  const s = clamp(o.pud, 0, 1);
  const ys = Math.max(1, rnd(pcy(s) - G.ry * s - 1));
  const ye = Math.min(H - 2, rnd(pcy(s) + G.ry * s + 1));
  const ls = light.side;
  const glow = o.pudG >= 1.6;
  for (let y = ys; y <= ye; y++)
    for (let x = 1; x < W - 1; x++) {
      const d = inPuddle(x, y, s);
      if (d > 1) continue;
      const back = y + 0.5 < pcy(s);
      const lit = (x + 0.5 - pcx(s)) * ls > 0;
      if (onRim(x, y, s)) {
        // the specular rim: the far (back) lip catches the key light, the near lip is a dimmer water line
        p.set(x, y, back ? (lit ? PAL.white : PAL.mist) : lit ? PAL.steel : PAL.night4);
        continue;
      }
      // the haze: denser toward the rim, sparse in the middle (the floor / tile shows through the mirror)
      // the haze lies in water lines (whole rows, never speckle): every other row near the rim, every fourth inside
      const line = glow ? (d > 0.45 ? (y & 1) === 0 : (y & 3) === 0) : d > 0.6 && (y & 3) === 0;
      // crit r3: the still water is a lit water1 sheet (the dark twin's ground) once the puddle has settled; a
      // cracked puddle (death) goes back to the see-through glass lines
      const sheet = !glow && s >= 0.95 && o.crack <= 0;
      if (line && !sheet) p.set(x, y, glow ? (d > 0.45 ? PAL.mist : PAL.steel) : back ? PAL.steel : PAL.night4);
      else if (sheet) p.set(x, y, d > 0.82 ? PAL.night3 : !lit && d > SHADE_D ? PAL.water0 : PAL.water1);
    }
  // ripples: thin iso rings expanding from the feet (two, half a cycle apart)
  if (o.rip >= 0 && s >= 0.95)
    for (const ph of [o.rip % 1, (o.rip + 0.5) % 1]) {
      const r = 0.3 + ph * 0.62;
      const n = rnd(r * 64);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        if (Math.sin(a) < -0.3 && ph < 0.3) continue;
        const x = rnd(G.cx - 0.5 + Math.cos(a) * G.rx * r);
        const y = rnd(G.cy - 0.5 + Math.sin(a) * G.ry * r);
        if (inPuddle(x, y, 1) > 0.75) continue;
        p.set(x, y, ph < 0.3 ? PAL.mist : PAL.steel);
      }
    }
}

/**
 * The light pool at the feet (IŞ-1, golden rule 3): the light-woven archer spills its glow onto the still water it
 * stands in — a flat water2 band, SPILL px wide, hugging the figure's silhouette on the water. The puddle lies on the
 * archer's key-light-facing side of the sheet (P1: right of it; the P2 relight sheet: left, shown flipped), so the
 * band also lights the water's near end against the water0 shade crescent at its far end. Only the settled sheet's
 * open water1 (never the twin, the rim or the shade crescent); a cracked or glowing puddle has no sheet.
 */
const SPILL = 3;
function spillPass(p: PixelCanvas, fig: PixelCanvas, o: Pose, light: Light): void {
  if (o.pud < 0.95 || o.crack > 0 || o.pudG >= 1.6) return;
  const ls = light.side < 0 ? -1 : 1;
  const ys = Math.max(1, rnd(G.cy - G.ry));
  const ye = Math.min(H - 2, rnd(G.cy + G.ry));
  for (let y = ys; y <= ye; y++)
    for (let x = 1; x < W - 1; x++) {
      if (fig.isOpaque(x, y) || p.get(x, y) !== PAL.water1 || inPuddle(x, y, 1) > 0.82) continue;
      for (let k = 1; k <= SPILL; k++)
        if (fig.isOpaque(x + ls * k, y)) {
          p.set(x, y, PAL.water2);
          break;
        }
    }
}

/** The sheen line over the surface and the reflection (a mirror's specular streak). */
const TWIN_TONES = new Set<number>([PAL.night0, PAL.night1, PAL.night2, PAL.water2, PAL.water3, PAL.water4]);
function sheenPass(p: PixelCanvas, o: Pose): void {
  if (o.pud < 0.4 || o.crack > 0) return;
  const s = clamp(o.pud, 0, 1);
  const c = sheenAt(o, s);
  for (let y = rnd(pcy(s) - G.ry * s); y <= rnd(pcy(s) + G.ry * s); y++)
    for (let w = 0; w < 2; w++) {
      const x = rnd(c - 2 * (y - pcy(s))) + w;
      const d = inPuddle(x, y, s);
      if (d > 0.72) continue;
      // the streak lies on the open water only: it passes behind the twin (crit r3: it scribbled over its figure)
      const under = p.get(x, y);
      if (under !== null && TWIN_TONES.has(under)) continue;
      p.set(x, y, w === 0 && d < 0.35 ? PAL.white : PAL.mist);
    }
}

/** Does the reflection show at (x, y)? Only inside the puddle (the tile's back half, clear of the stat badge):
 *  whole in its middle, broken into water lines (every other row, the classic broken reflection) toward the rim.
 *  `rv` (the summon's surfacing) thins it the same way. */
function reflShows(x: number, y: number, rv: number): boolean {
  const d = inPuddle(x, y, 1);
  if (d > 1) return false;
  const a = (d < 0.9 ? 1 : 0.5) * rv;
  if (a >= 0.99) return true;
  if (a >= 0.49) return (y & 1) === 0;
  if (a >= 0.24) return (y & 3) === 0;
  return false;
}

/** The idle frames whose neighbours are the archer's quiet transitions: the reflection's shimmer beats (HA-17). */
const SHIMMER = [4, 5, 10, 13, 17];

/**
 * The twin (crit r3): a crisp, hand-built inverted silhouette driven by the reflection's own skeleton (so it lags,
 * leads and looks at the viewer on its own). Squashing the full figure (skeleton or pixels) to ~20 px turned it into
 * a swirl; instead the body (feet → chin) is foreshortened by `kb` and the head, the crescent crown and the bow are
 * drawn at FIXED pixel sizes, so the three key shapes — hood, crown horns (pointing down), bow arc — always read.
 * Dark night body on the lit water, light-blue crown and bow lines, a 1-px water rim round it and a 2–3 px night3
 * lit plane on its key-light side (IŞ-1 / IŞ-3).
 */
interface TwinMap { hb: number; kb: number }
let TW: TwinMap = { hb: GY - 40, kb: 0.36 };
/** Source row (figure px) → the twin's output row (the body part; the head is placed at the chin + its radius). */
const twinY = (sy: number): number => G.my + (GY - Math.max(sy, TW.hb)) * TW.kb + Math.max(0, TW.hb - sy) * 0.6;
/** A skeleton point → the twin's frame px. */
const twinPt = (pt: Pt): Pt => [pt[0] + G.rdx, twinY(pt[1])];

function mirrorTwin(r: Pose, light: Light): PixelCanvas {
  const q = layer();
  const sk = skeleton({ ...r, bx: r.bx - 4, nx: r.nx - 4 });
  TW = { hb: sk.head[1] + 3, kb: G.kr * 0.95 };
  const P = (pt: Pt): Pt => { const [x, y] = twinPt(pt); return [x, y]; };
  const ls = light.side < 0 ? -1 : 1;
  const BODY = PAL.night1;
  const ROBE_C = PAL.night2;
  /** the hood is the twin's lightest dark (the archer's white hood, inverted in value but still its focal shape) */
  const HOOD = PAL.night0;
  // legs (the feet hang from the water line), the robe widening up toward its hem, the torso narrowing to the chin
  for (const [hp, an] of [[sk.hip2, sk.an2], [sk.hip1, sk.an1]] as const) {
    const [x0, y0] = P(an);
    const [x1, y1] = P(hp);
    q.thickLine(x0, y0, x1, y1, 2, BODY);
  }
  const hem = GY - 8;
  const pel = sk.pel;
  q.poly([P([pel[0] - 6, hem]), P([pel[0] + 6, hem]), P([pel[0] + 3.5, pel[1]]), P([pel[0] - 3.5, pel[1]])], ROBE_C);
  q.poly([P([pel[0] - 3, pel[1]]), P([pel[0] + 3, pel[1]]), P([sk.neck[0] + 2.5, sk.neck[1]]), P([sk.neck[0] - 2.5, sk.neck[1]])], BODY);
  // arms: the bow arm to the grip, the draw arm to its hand
  for (const [sh, el, w] of [[sk.sh2, sk.el2, sk.w2], [sk.sh1, sk.el1, sk.w1]] as const) {
    const a0 = P(sh), a1 = P(el), a2 = P(w);
    q.line(rnd(a0[0]), rnd(a0[1]), rnd(a1[0]), rnd(a1[1]), BODY).line(rnd(a1[0]), rnd(a1[1]), rnd(a2[0]), rnd(a2[1]), BODY);
  }
  // the hood: a fixed 5×5 round head below the chin
  const [hx, hy] = P(sk.head);
  const hcx = rnd(hx);
  const hcy = rnd(hy);
  for (let y = -2; y <= 3; y++) for (let x = -3; x <= 2; x++) { const ux = x + 0.5; const uy = y - 0.5; if (ux * ux + uy * uy <= 7.5) q.set(hcx + x, hcy + y, HOOD); }
  // the dark body's edge: a 1-px water rim OUTSIDE the silhouette (the lit water hugging the dark twin), water2 —
  // on the key-light side the body's own edge pixel lifts to night3 (its volume), never the bright azure
  const body = q.clone();
  const b = boxOf(body, 1);
  if (b)
    for (let y = b.y0; y <= b.y1; y++)
      for (let x = b.x0; x <= b.x1; x++) {
        if (body.get(x, y) !== null) {
          if (body.get(x, y) === HOOD) continue;
          // IŞ-1 / IŞ-3: the key-light side of the dark body is a lit PLANE, not a 1-px line — 3 px on the robe,
          // 2 px on the body; a thin limb (≤ 3 px across) keeps the 1-px edge so it does not turn wholly lit
          let toL = 0;
          while (toL < 4 && body.get(x + ls * (toL + 1), y) !== null) toL++;
          let toS = 0;
          while (toS < 4 && body.get(x - ls * (toS + 1), y) !== null) toS++;
          const litW = toL + toS + 1 <= 3 ? 1 : body.get(x, y) === ROBE_C ? 3 : 2;
          if (toL < litW) q.set(x, y, PAL.night3);
          continue;
        }
        if (body.get(x + 1, y) !== null || body.get(x - 1, y) !== null || body.get(x, y + 1) !== null || body.get(x, y - 1) !== null) q.set(x, y, PAL.water2);
      }
  // the hood's ring: a 1-px water line round the dark head (not where it joins the neck) — the round head reads
  for (let y = -3; y <= 4; y++)
    for (let x = -4; x <= 3; x++) {
      const X = hcx + x;
      const Y = hcy + y;
      if (body.get(X, Y) === HOOD) continue;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, c]) => body.get(X + a, Y + c) === HOOD);
      if (nb && y >= -1) q.set(X, Y, PAL.water2);
    }
  // the crescent crown, inverted: its two horns hang DOWN either side of the hood and curl in at the tips
  // (light-blue lines, the tips water4); the bowl passes behind the hood
  for (const d of [-1, 1]) {
    const horn: Pt[] = [[3, 0], [4, 1], [4, 2], [5, 3], [5, 4], [4, 5], [3, 6]];
    for (let i = 0; i < horn.length; i++) q.set(hcx + d * horn[i][0] - (d < 0 ? 1 : 0), hcy + horn[i][1], i >= 5 ? PAL.water4 : PAL.water3);
  }
  // the bow: a 1-px light-blue arc through the twin's horns and grip, a darker belly line, the string
  const n = 18;
  let prev: Pt | null = null;
  for (let i = 0; i <= n; i++) {
    const t = -1 + (2 * i) / n;
    const cx = sk.grip[0] + sk.bu[0] * t * BOW_L - sk.bb[0] * BOW_BULGE * t * t;
    const cy = sk.grip[1] + sk.bu[1] * t * BOW_L - sk.bb[1] * BOW_BULGE * t * t;
    const [x, y] = P([cx, cy]);
    const pt: Pt = [rnd(x), rnd(y)];
    if (prev) q.line(prev[0], prev[1], pt[0], pt[1], Math.abs(t) < 0.45 ? PAL.water4 : PAL.water3);
    if (Math.abs(t) < 0.6) q.set(pt[0] + (sk.bb[0] >= 0 ? 1 : -1), pt[1], PAL.water2);
    prev = pt;
  }
  const t0 = P(sk.top), t1 = P(sk.bot), nk = P(sk.nock);
  q.line(rnd(t0[0]), rnd(t0[1]), rnd(nk[0]), rnd(nk[1]), PAL.water1).line(rnd(nk[0]), rnd(nk[1]), rnd(t1[0]), rnd(t1[1]), PAL.water1);
  return q;
}

function drawReflection(p: PixelCanvas, o: Pose, light: Light): void {
  const r = o.R ?? o;
  if (o.rv <= 0 || o.pud < 0.95) return;
  const q = mirrorTwin(r, light);
  // no outline: the reflection is floor (a 1-px dark ring would turn the 14-px twin into a blob)
  // the reflection surfaces: its coverage rises with rv (it fades up through the dither, never a hard panel)
  const rv = clamp(o.rv, 0, 1);
  // ripple distortion: rows crossed by a ring shift a px sideways
  const shiftOf = (y: number): number => {
    if (o.rip < 0) return 0;
    const ph = o.rip % 1;
    const ry = G.cy + G.ry * (0.3 + ph * 0.62) * 0.6;
    if (Math.abs(y - ry) < 1) return fl(ph * 8) % 2 ? 1 : -1;
    return 0;
  };
  // the water's own shimmer: on the idle's quiet beats (the frames where the archer itself holds still) a band of
  // the twin's rows catches the light a step brighter, a different band each time — it keeps moving on its own
  const sk0 = rnd(o.t * 20);
  const at = o.rip >= 0 ? SHIMMER.indexOf(sk0) : -1;
  const shimmer = (y: number): boolean => at >= 0 && Math.abs(y - (rnd(G.my) + 2 + at * 2)) <= 1;
  // the reflection's face is the focal point (its eyes look at the viewer): its hood stays whole once surfaced
  const [fhx, fhy] = twinPt(skeleton(r).head);
  const face = (x: number, y: number): boolean => rv >= 0.9 && o.rbreak <= 0 && Math.abs(x + 0.5 - fhx) <= 6 && y + 0.5 - fhy >= -3.5 && y + 0.5 - fhy <= 7.5;
  for (let y = Math.max(1, rnd(G.cy - G.ry)); y < H - 1; y++) {
    const sh = shiftOf(y);
    for (let x = 1; x < W - 1; x++) {
      const c = q.get(x - sh, y);
      if (c === null) continue;
      if (face(x, y)) { /* the hood and the crown always read whole */ }
      else if (onRim(x, y, 1) || !reflShows(x, y, rv)) continue;
      p.set(x, y, shimmer(y) ? REFL_LADDER[clamp(REFL_LADDER.indexOf(c) + 1, 0, REFL_LADDER.length - 1)] ?? c : c);
    }
  }
  // the far water line the reflection hangs from: a 1-px glass line under its feet, lit where it touches them
  if (rv >= 0.45 && o.rbreak < 0.85) {
    const [fx0] = twinPt(skeleton(r).an2);
    const [fx1] = twinPt(skeleton(r).an1);
    for (let x = rnd(fx0) - 2; x <= rnd(fx1) + 2; x++) if (inPuddle(x, G.my - 1, 1) < 0.95 && !p.isOpaque(x, G.my - 1)) p.set(x, G.my - 1, x >= rnd(fx0) && x <= rnd(fx1) ? PAL.water3 : PAL.water1);
  }
  // eyes of the reflection (its own light: water4; turned to the viewer = two white eyes) — always whole
  if (r.eye > 0.05 && r.lid < 2 && o.rbreak < 0.4 && rv >= 0.45) {
    const sk = skeleton(r);
    const [hx, hy] = twinPt(sk.head);
    const ey = rnd(hy);
    const c = r.eye >= 1.6 ? PAL.white : PAL.water4;
    if (r.look >= 0.5) {
      p.set(rnd(hx) - 2, ey, c).set(rnd(hx) + 1, ey, c);
      p.set(rnd(hx) - 2, ey + 1, PAL.night0).set(rnd(hx) + 1, ey + 1, PAL.night0);
      // the dark face round the eyes (the 14-px twin's look must read at 1×): a night mask behind them
      for (const dx of [-3, -1, 0, 2]) p.set(rnd(hx) + dx, ey, PAL.night0);
      p.set(rnd(hx) - 2, ey - 1, PAL.night1).set(rnd(hx) + 1, ey - 1, PAL.night1);
    } else {
      p.set(rnd(hx) + 2, ey, c).set(rnd(hx) + 3, ey, PAL.water3);
    }
  }
}

/** Death: the puddle cracks (straight glass lines from the feet) and the reflection breaks into shards. */
function crackPass(p: PixelCanvas, o: Pose): void {
  if (o.crack <= 0) return;
  const rays: [number, number][] = [[-0.95, 0.2], [-0.5, 0.85], [0.15, 1], [0.7, 0.7], [1, 0.1], [-0.2, -0.9], [0.55, -0.8]];
  const L = Math.min(1, o.crack);
  for (let i = 0; i < rays.length; i++) {
    const [dx, dy] = rays[i];
    const len = (0.45 + hash2(i, 3, 5) * 0.55) * L;
    const n = 26;
    for (let j = 0; j <= n * len; j++) {
      const u = j / n;
      const jog = (hash2(i, fl(u * 6), 9) - 0.5) * 2;
      const x = rnd(G.cx - 0.5 + dx * G.rx * u + jog * 0.6);
      const y = rnd(G.cy - 0.5 + dy * G.ry * u);
      if (inPuddle(x, y, 1) > 0.95) continue;
      p.set(x, y, u < 0.3 ? PAL.white : PAL.mist);
    }
  }
  // the crack creeping on during the flat beat (crack > 1): a 1-px light bead runs out along two rays
  if (o.crack > 1) {
    const u = clamp(o.crack - 1, 0, 1);
    for (const [i, [dx, dy]] of [[1, rays[1]], [4, rays[4]]] as const) {
      const x = rnd(G.cx - 0.5 + dx * G.rx * (0.35 + u * 0.55));
      const y = rnd(G.cy - 0.5 + dy * G.ry * (0.35 + u * 0.55));
      p.set(x, y, PAL.white);
      void i;
    }
  }
  if (o.rbreak > 0) {
    // the reflection's shards: its pixels jump in 3×2 cells along the cracks, then sink out of the surface
    const src = p.clone();
    for (let y = Math.max(1, rnd(G.cy - G.ry)); y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        if (inPuddle(x, y, 1) > 1) continue;
        const c = src.get(x, y);
        if (c !== PAL.night0 && c !== PAL.night1 && c !== PAL.night2 && c !== PAL.water1 && c !== PAL.water2 && c !== PAL.water3 && c !== PAL.water4) continue;
        const cx = fl((x - G.cx) / 3);
        const cy = fl((y - G.my) / 2);
        const h = hash2(cx, cy, 31);
        if (h < o.rbreak * 0.9) {
          p.erase(x, y);
          const ox = rnd((hash2(cx, cy, 5) - 0.5) * 6 * o.rbreak);
          const oy = rnd(hash2(cx, cy, 6) * 3 * o.rbreak);
          const nx = x + ox;
          const ny = y + oy;
          if (o.rbreak < 0.85 && ny < H - 2 && inPuddle(nx, ny, 1) < 0.8) p.set(nx, ny, h < 0.25 ? PAL.water3 : PAL.water1);
        }
      }
  }
}

// ---------------------------------------------------------------- light layer

function lightPass(p: PixelCanvas, o: Pose, sk: Skel, v: View): void {
  interface Chain { set(x: number, y: number, c: number): Chain }
  const S: Chain = { set(x, y, c) { if (x >= 1 && y >= 1 && x < W - 1 && y < H - 1) p.set(x, y, c); return S; } };
  const set = (x: number, y: number, c: number): Chain => S.set(x, y, c);
  const T = v.T;
  // bow string (a thread of light)
  if (o.flat <= 0 && o.diss < 0.6) {
    const str = PAL.gold4;
    const top = T(sk.top);
    const bot = T(sk.bot);
    const nk = T(sk.nock);
    const line = (a: Pt, b: Pt) => {
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
      for (let i = 0; i <= n; i++) {
        const x = rnd(a[0] - 0.5 + ((b[0] - a[0]) * i) / n);
        const y = rnd(a[1] - 0.5 + ((b[1] - a[1]) * i) / n);
        if (!p.isOpaque(x, y) || p.get(x, y) === PAL.ink) set(x, y, o.draw > 0 && o.arrow >= 2 ? PAL.white : str);
      }
    };
    if (o.draw > 0) {
      line(top, nk);
      line(nk, bot);
    } else line(top, bot);
    // bow horns: the moon's points glow
    if (o.bowG > 0.05)
      for (const tip of [top, bot]) {
        const x = rnd(tip[0] - 0.5);
        const y = rnd(tip[1] - 0.5);
        set(x, y, o.bowG >= 2 ? PAL.white : PAL.gold4);
        if (o.bowG >= 2.5) set(x - 1, y, PAL.gold4).set(x + 1, y, PAL.gold4);
      }
  }
  // the light arrow
  if (o.arrow > 0 && o.draw > 0) {
    const a = T(sk.atail);
    const b = T(sk.apt);
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
    const dx = (b[0] - a[0]) / n;
    const dy = (b[1] - a[1]) / n;
    for (let i = 0; i <= n; i++) {
      const x = rnd(a[0] - 0.5 + dx * i);
      const y = rnd(a[1] - 0.5 + dy * i);
      set(x, y, i > n - 3 ? PAL.white : o.arrow >= 2 ? PAL.gold4 : PAL.gold3);
    }
    // the point: a 3-px light head; fletching: two mist barbs at the tail
    const hx = rnd(b[0] - 0.5);
    const hy = rnd(b[1] - 0.5);
    set(hx - 1, hy - 1, PAL.gold4).set(hx - 1, hy + 1, PAL.gold4);
    set(rnd(a[0] - 0.5) - 1, rnd(a[1] - 0.5) - 1, PAL.mist).set(rnd(a[0] - 0.5) - 1, rnd(a[1] - 0.5) + 1, PAL.mist);
    if (o.arrow >= 2.5) {
      set(hx + 1, hy, PAL.white).set(hx, hy - 1, PAL.white).set(hx, hy + 1, PAL.white);
      set(hx + 2, hy, PAL.gold4);
    }
  }
  // release: the arrow is gone — a light streak runs to the frame edge, a ring of light snaps at the bow
  if (o.shot > 0) {
    const g = T(sk.grip);
    const y = rnd(g[1] - 0.5);
    const x0 = rnd(g[0]) + 2;
    const len = rnd((W - 3 - x0) * clamp(o.shot, 0, 1));
    for (let x = x0; x <= x0 + len && x < W - 2; x++) {
      const u = (x - x0) / Math.max(1, len);
      set(x, y, u > 0.75 ? PAL.white : u > 0.35 ? PAL.gold4 : PAL.gold3);
      if (u > 0.82) set(x, y - 1, PAL.gold4).set(x, y + 1, PAL.gold4);
    }
    if (o.shot < 0.7) for (const [dx, dy] of [[0, -3], [0, 3], [2, -2], [2, 2], [3, 0]] as const) set(rnd(g[0]) + dx, y + dy, PAL.gold4);
  }
  // eyes (the archer: profile, both eye pixels toward the foe)
  if (o.eye > 0.05 && o.lid < 2 && o.flat <= 0 && o.diss < 0.5) {
    const [ex, ey] = T(sk.eye);
    const col = o.eye >= 1.6 ? PAL.white : o.eye >= 1 ? PAL.gold4 : PAL.gold3;
    set(rnd(ex - 0.5), rnd(ey - 0.5), col);
    if (o.lid === 0) set(rnd(ex - 0.5) - 1, rnd(ey - 0.5), o.eye >= 1.6 ? PAL.gold4 : PAL.gold3);
  }
  // the chest gem (a small crescent of light: the core)
  if (o.gem > 0.05 && o.flat <= 0 && o.diss < 0.5) {
    const [gx, gy] = T(sk.gem);
    const x = rnd(gx - 0.5);
    const y = rnd(gy - 0.5);
    set(x, y, o.gem >= 2 ? PAL.white : PAL.gold4);
    if (o.gem >= 1.5) set(x - 1, y, PAL.gold3).set(x, y + 1, PAL.gold3);
  }
  // the crown's horns
  if (o.crownG > 0.05 && o.flat <= 0 && o.diss < 0.5) {
    const [hx, hy] = T(sk.head);
    const yy = rnd(hy - 11.6 * v.hk);
    set(rnd(hx) + 5, yy, o.crownG >= 2 ? PAL.white : PAL.gold4);
    set(rnd(hx) - 6, yy, o.crownG >= 1.5 ? PAL.gold4 : PAL.gold3);
  }
  if (o.glint > 0) {
    const [hx, hy] = T(sk.head);
    const x = rnd(hx) + 5;
    const y = rnd(hy - 11.6 * v.hk);
    set(x, y, PAL.white);
    if (o.glint >= 2) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) set(x + dx, y + dy, PAL.gold4);
  }
}

/** Living detail: motes of light leaving the puddle's surface and drifting up (3 at a time). */
function motePass(p: PixelCanvas, o: Pose): void {
  if (o.mote < 0 || o.pud < 0.95) return;
  for (let i = 0; i < 3; i++) {
    const u = (o.mote + i / 3) % 1;
    const bx = G.cx + [-11, 9, -3][i] + rnd(Math.sin((u + i) * TAU) * 1.4);
    const y = rnd(G.cy - 2 - u * 22);
    const x = rnd(bx);
    if (x < 1 || y < 1 || x >= W - 1 || p.isOpaque(x, y)) continue;
    p.set(x, y, u < 0.5 ? PAL.gold4 : u < 0.8 ? PAL.mist : PAL.steel);
  }
}

/** Sparks of light (hits, release, flashes) round a point. */
function sparkPass(p: PixelCanvas, o: Pose, at: Pt): void {
  if (o.spark <= 0) return;
  const ph = o.spark;
  for (let i = 0; i < 6; i++) {
    const a = hash2(i, 3, 7) * TAU;
    const d = 2 + ph * (5 + hash2(i, 9, 2) * 6);
    const x = rnd(at[0] + Math.cos(a) * d);
    const y = rnd(at[1] + Math.sin(a) * d * 0.8 + ph * ph * 4);
    if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
    p.set(x, y, ph < 0.4 ? PAL.white : i % 2 ? PAL.gold4 : PAL.water4);
  }
}

/** Summon: the falling light drop, its streak, and the splash crown when it lands. */
function dropPass(p: PixelCanvas, o: Pose): void {
  if (o.drop >= 0) {
    const x = RX;
    const y = rnd(GY - o.drop);
    for (let i = 1; i < 10; i++) if (y - i - 2 > 1) p.set(x, y - i - 2, i < 4 ? PAL.gold4 : i < 7 ? PAL.mist : PAL.steel);
    p.rect(x - 1, y - 2, 3, 3, PAL.gold4);
    p.set(x, y - 3, PAL.white).set(x, y - 1, PAL.white).set(x, y, PAL.gold3);
  }
  if (o.splash > 0) {
    const k = o.splash;
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const r = 3 + k * 9;
      const h = Math.sin(k * Math.PI) * (4 + (i % 2) * 3);
      const x = rnd(RX + 0.5 + Math.cos(a) * r);
      const y = rnd(GY - 0.5 + Math.sin(a) * r * 0.48 - h);
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
      p.rect(x, y, 2, 1, k < 0.5 ? PAL.white : PAL.gold4);
      p.rect(x, y + 1, 2, 1, PAL.gold3);
    }
  }
}

/** Guard: a pane of mirror light between the bow and its string (a vertical glass shield). */
function panePass(p: PixelCanvas, o: Pose, sk: Skel, v: View): void {
  if (o.pane <= 0) return;
  const top = v.T(sk.top);
  const bot = v.T(sk.bot);
  const g = v.T(sk.grip);
  const y0 = rnd(top[1]) + 1;
  const y1 = rnd(bot[1]) - 1;
  const span = y1 - y0;
  for (let y = y0; y <= y1; y++) {
    const u = (y - y0) / Math.max(1, span);
    const bulge = (1 - (2 * u - 1) ** 2) * BOW_BULGE;
    const xs = rnd(top[0] + (bot[0] - top[0]) * u);
    const xe = rnd(xs + bulge * clamp(o.pane, 0, 1));
    const k = clamp(o.pane, 0, 1);
    for (let x = xs - rnd(3 * k); x < xe; x++) {
      if (x === xs) continue;
      if (p.isOpaque(x, y) && p.get(x, y) !== PAL.ink) continue;
      // diagonal shimmer bands run down the glass (paneP), the edge toward the foe is the bright one
      const band = (((x - y + fl(o.paneP * 9)) % 6) + 6) % 6;
      p.set(x, y, band < 2 ? PAL.white : band < 4 ? PAL.water4 : PAL.mist);
    }
  }
  void g;
}

// ---------------------------------------------------------------- body passes (on the figure canvas, before the outline)

/** hitMagic: the glass edges and the planes flash (lit plane → white, mid → water4 glass) over the struck top. */
function flashPass(p: PixelCanvas, o: Pose, sk: Skel, v: View): void {
  if (o.flash <= 0) return;
  const [, cy] = v.T(sk.C);
  const lim = o.flash >= 0.7 ? H : rnd(cy + 4);
  for (let y = 0; y < lim; y++)
    for (let x = 0; x < W; x++) {
      const c = p.get(x, y);
      if (c === null) continue;
      if (c === PAL.mist || c === GLASS) p.set(x, y, o.flash >= 0.5 ? PAL.water4 : PAL.mist);
      else if (c === PAL.steel) p.set(x, y, o.flash >= 0.5 ? PAL.mist : PAL.steel);
    }
}

/** Death's beat without a reflection: the archer goes flat — every plane collapses to one tone per material. */
function flatPass(p: PixelCanvas, o: Pose): void {
  if (o.flat <= 0) return;
  const b = boxOf(p);
  if (!b) return;
  for (let y = b.y0; y <= b.y1; y++)
    for (let x = b.x0; x <= b.x1; x++) {
      const c = p.get(x, y);
      if (c === null) continue;
      if (c === PAL.white || c === PAL.mist || c === GLASS) p.set(x, y, PAL.mist);
      else if (c === PAL.steel || c === PAL.night4) p.set(x, y, PAL.steel);
      else if (c === PAL.night3 || c === PAL.night2 || c === PAL.night1) p.set(x, y, PAL.night3);
      else if (c === PAL.gold4 || c === PAL.gold3 || c === PAL.gold2 || c === PAL.gold1) p.set(x, y, PAL.gold2);
    }
}

/** Death: glass cracks (straight white lines with lit lips) web out of the chest gem, then the body breaks into
 *  six hard-edged glass panes (angular sectors round the chest) that part, fall and land on whole pixels with
 *  1-px glints on their broken edges. The first break frame keeps the panes' real pixels (EF-12); `diss` drops
 *  whole panes (never a pixel dissolve). Revive (gather) runs the same panes back in. */
const PANES = 6;
function shatterPass(p: PixelCanvas, o: Pose, sk: Skel): void {
  if (o.shatter <= 0) return;
  const cx = sk.C[0];
  const cy = sk.C[1] + 4;
  const src = p.clone();
  // the sector boundaries (fixed, uneven, so the panes are not a pie)
  const cuts: number[] = [];
  for (let i = 0; i < PANES; i++) cuts.push(((i + 0.15 + hash2(i, 4, 61) * 0.7) / PANES) * TAU);
  const paneOf = (x: number, y: number): number => {
    let a = Math.atan2((y + 0.5 - cy) / 1.3, x + 0.5 - cx);
    if (a < 0) a += TAU;
    for (let i = PANES - 1; i >= 0; i--) if (a >= cuts[i]) return i;
    return PANES - 1;
  };
  const onCut = (x: number, y: number): boolean => paneOf(x, y) !== paneOf(x + 1, y) || paneOf(x, y) !== paneOf(x, y + 1);
  if (o.shatter < 0.3) {
    // the crack web from the chest gem along the pane cuts, growing frame by frame (never a repeated frame)
    const g = clamp(o.shatter / 0.28, 0, 1);
    for (let i = 0; i < PANES; i++) {
      const a = cuts[i];
      const len = (5 + hash2(i, 2, 41) * 16) * (0.35 + 0.65 * g);
      for (let d = 0; d < len; d++) {
        const x = rnd(cx + Math.cos(a) * d - 0.5);
        const y = rnd(cy + Math.sin(a) * d * 1.3 - 0.5);
        if (src.isOpaque(x, y) && src.get(x, y) !== PAL.ink) p.set(x, y, d < 3 ? PAL.white : PAL.water4);
      }
    }
    return;
  }
  p.clear();
  const k = (o.shatter - 0.3) / 0.7;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = src.get(x, y);
      if (c === null) continue;
      const i = paneOf(x, y);
      if (hash2(i, 7, 67) < (o.diss ?? 0)) continue;
      // the cut lines: a 1-px dark crack on the first break frame, then an open gap
      if (onCut(x, y) && c !== PAL.ink) {
        if (k < 0.25) p.set(x, y, PAL.ink);
        continue;
      }
      const a = (cuts[i] + cuts[(i + 1) % PANES] + (i === PANES - 1 ? TAU : 0)) / 2;
      const spread = 2 + hash2(i, 3, 71) * 4;
      const ox = rnd(Math.cos(a) * spread * k * 2.2);
      const fall = k * k * (10 + hash2(i, 5, 73) * 12);
      const oy = rnd(Math.sin(a) * spread * k * 1.2 + fall);
      const nx = x + ox;
      // the pane lands: nothing goes below the floor line
      const ny = Math.min(GY - 1, y + oy);
      if (nx < 1 || ny < 1 || nx >= W - 1) continue;
      const glassy = c === PAL.mist || c === PAL.white || c === PAL.steel || c === GLASS;
      // first break frame: real pixels; then the panes cool to glass (mist / water4), their ink edges thin to steel
      let col = c;
      if (k > 0.6) col = c === PAL.ink ? PAL.night2 : glassy ? (k > 0.8 ? PAL.water4 : PAL.mist) : c;
      p.set(nx, ny, col);
    }
  // glints: one bright pixel (two on alternate panes) on each pane's broken edge, sliding along it as it falls
  for (let i = 0; i < PANES; i++) {
    if (hash2(i, 7, 67) < (o.diss ?? 0)) continue;
    const a = cuts[i];
    const d = 4 + ((fl(k * 10) + i * 3) % 7);
    const x0 = rnd(cx + Math.cos(a) * d - 0.5);
    const y0 = rnd(cy + Math.sin(a) * d * 1.3 - 0.5);
    const am = (cuts[i] + cuts[(i + 1) % PANES] + (i === PANES - 1 ? TAU : 0)) / 2;
    const spread = 2 + hash2(i, 3, 71) * 4;
    const x = x0 + rnd(Math.cos(am) * spread * k * 2.2);
    const y = Math.min(GY - 1, y0 + rnd(Math.sin(am) * spread * k * 1.2 + k * k * (10 + hash2(i, 5, 73) * 12)));
    if (x < 1 || y < 1 || x >= W - 1 || !p.isOpaque(x, y)) continue;
    p.set(x, y, PAL.white);
    if (i % 2 === 0 && p.isOpaque(x + 1, y)) p.set(x + 1, y, PAL.gold4);
  }
}

// ---------------------------------------------------------------- draw

export function drawArcher(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right'): void {
  const light = lightOf(lightFrom);
  G = puddleGeo(lightFrom);
  const v = mainView(o.k);
  const sk = skeleton(o);

  // floor: the puddle, the reflection in it, cracks / shards
  drawPuddle(p, o, light);
  drawReflection(p, o, light);
  crackPass(p, o);
  sheenPass(p, o);

  // the archer on its own canvas: planes, crumbs, outline
  const fig = new PixelCanvas(W, H);
  const showFig = o.k > 0.05 && o.diss < 1;
  if (showFig) {
    const comp = drawFigure(fig, o, light, v);
    if (o.shake > 0) {
      // 1-px tremble: the head and crown rows jump alternately (whole px)
      const dx = o.shake === 1 ? -1 : 1;
      const src = fig.clone();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const id = comp.id[y * W + x]; if (id === Part.head || id === Part.crown) fig.erase(x, y); }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const id = comp.id[y * W + x]; if (id === Part.head || id === Part.crown) { const c = src.get(x, y); if (c !== null) fig.set(x + dx, y, c); } }
    }
    cleanCrumbs(fig);
    flashPass(fig, o, sk, v);
    flatPass(fig, o);
    fig.outline(PAL.ink);
    shatterPass(fig, o, sk);
    if (o.diss > 0 && o.shatter < 0.3) dissolvePass(fig, o);
    spillPass(p, fig, o, light);
    p.blit(fig, 0, 0);
  }

  // light layer
  if (showFig && o.shatter < 0.3) lightPass(p, o, sk, v);
  panePass(p, o, sk, v);
  motePass(p, o);
  dropPass(p, o);
  if (o.under > 0) underPass(p, o);
  sparkPass(p, o, o.smear > 0 || o.shot > 0 ? v.T(sk.grip) : v.T(sk.head));
}

/** The reflection's arrow, running UNDER the floor: a dark-bright streak inside the puddle toward the foe. */
function underPass(p: PixelCanvas, o: Pose): void {
  const u = clamp(o.under, 0, 1);
  const y = G.cy + 2;
  const x1 = rnd(G.cx - G.rx * 0.6 + G.rx * 1.6 * u);
  for (let x = x1 - 9; x <= x1; x++) {
    if (x < 1 || x >= W - 1) continue;
    const inside = inPuddle(x, y, 1) <= 0.85;
    const c = x >= x1 - 1 ? PAL.white : x >= x1 - 4 ? PAL.water4 : PAL.water3;
    if (inside) p.set(x, y, c);
    else if (x >= x1 - 2 && u >= 0.95) p.set(x, y, PAL.water4);
  }
}

/** Glass dust: the last shards thin out bottom-up into twinkles (the general "pixels" end, only the last frames). */
function dissolvePass(fig: PixelCanvas, o: Pose): void {
  const b = boxOf(fig);
  if (!b) return;
  for (let y = b.y0; y <= b.y1; y++)
    for (let x = b.x0; x <= b.x1; x++) {
      if (!fig.isOpaque(x, y)) continue;
      const h = hash2(fl(x / 2), fl(y / 2), 77);
      if (h < o.diss) fig.erase(x, y);
      else if (h < o.diss + 0.08) fig.set(x, y, o.gather ? PAL.gold4 : PAL.water4);
    }
}

/** The reflection alone (no puddle, no clip): the figure mirrored at the ground line, foreshortened by kr, in the
 *  reflection's dark blues with its own eyes — the card art's lake reflection. */
export function drawMirrorFigure(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right', kr: number): void {
  const light = lightOf(lightFrom);
  const q = layer();
  const v = reflView(kr, 0, GY);
  drawFigure(q, { ...o, k: 1 }, light, v);
  const b = boxOf(q);
  if (!b) return;
  for (let y = b.y0; y <= b.y1; y++)
    for (let x = b.x0; x <= b.x1; x++) {
      const c = q.get(x, y);
      if (c !== null) q.set(x, y, REFL_MAP_DEEP.get(c) ?? PAL.water1);
    }
  cleanCrumbs(q);
  q.outline(PAL.night0);
  p.blit(q, 0, 0);
  const [hx, hy] = v.T(skeleton(o).head);
  const ey = rnd(hy - 1 * v.hk);
  if (o.look >= 0.5) p.set(rnd(hx) - 2, ey, PAL.white).set(rnd(hx) + 1, ey, PAL.white);
  else p.set(rnd(hx) + 2, ey, PAL.water4).set(rnd(hx) + 3, ey, PAL.water3);
}
