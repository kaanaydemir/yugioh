// Hortlak Muhafız v3 — the "grave knight" rig: Pose → skeleton → pixels.
//
// A HEAVY ARMOURED SKELETON, built from a wide, planted stance outward: two huge spiked charcoal pauldrons over a bare
// rib cage (violet-white lightning crawls through the gaps between the ribs and in the eye sockets, in idle too), a
// horned skull whose two lyre horns rise a head's height above the shoulders, a tattered black-violet cloak with a dull
// crimson lining trailing to the left (the back), and a two-handed bone-iron GREATBLADE held low in front: the point is
// dragged along the floor, so the silhouette is one long diagonal from the hands to the ground. Never a robe and never a
// round stone block: shoulders 55 px wide, a thin rib column between them, a blade 45 px long.
//
//   - every plate is drawn from polygons and measured flat value planes (lit band toward the key light, shade band away
//     from it, grooves for the lames): no gradients, no dither; ONE key light from the screen's top-left (`light`:
//     'left' for P1, 'right' for the P2 relight sheet, flipped by flipX it is lit from the top-left again);
//   - the feet are planted (the legs reach them by two-bone IK) and never move in idle / guard / transitions;
//   - light (eyes, rib charge, bolts, blade sparks) is painted after the outline and never outlined (IŞ-9).
// Frame 128×116, 1 art px = 1 game px; the pelvis root R is the origin of every part.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ik2, lightOf, type Light } from '../rigkit';
import { BONE, BONE_FAR, CLOAK, Comp, IRON, IRON_FAR, LINING, bands, layer as kitLayer, lerp, planes, ribbon, spline, type Pt, type Tones } from './grim_warden-kit';
import { bolt, dust, eyeBolts, eyeGlow, fork, gapCharge, motes } from './grim_warden-fx';

export const W = 128;
export const H = 116;
/** Floor line: the lowest row of the sabatons. */
export const GY = 108;
/** Anchor x (between the feet). */
export const AX = 59;
export const BLADE_LEN = 44;

const DEG = Math.PI / 180;
const rnd = Math.round;
const sin = Math.sin;
const cos = Math.cos;

// ---------------------------------------------------------------- pose

export interface Pose {
  /** pelvis drop (px: the knees bend, the feet stay) and the upper body's forward lean (px) / breath (px, + = down) */
  sink: number;
  lean: number;
  chy: number;
  /** rib cage heave (px, + = down): the ribs and their gaps only */
  rb: number;
  /** head offset from the neck (px), head turn (deg, + = chin up / back), jaw opening (deg), eye brightness 0…1.5 */
  hx: number;
  hy: number;
  hr: number;
  jaw: number;
  eye: number;
  /** blade: guard point relative to the pelvis (px), blade angle (deg, 0 = right, +90 = down), far hand distance down the grip */
  gx: number;
  gy: number;
  ba: number;
  g2: number;
  /** foot offsets (px; negative y = lifted): near / far ankle */
  f1x: number;
  f1y: number;
  f2x: number;
  f2y: number;
  /** pauldron lift (px, negative = up): near / far */
  p1: number;
  p2: number;
  /** cloak: hem swing (px, + = swings forward/right), wave phase 0…1, extra length (px), rag phase 0…1 */
  capeA: number;
  capeT: number;
  capeL: number;
  ragT: number;
  /** lightning: intensity 0…1.5 (eyes + rib gaps + bolts), shape seed, rib-gap crawl phase 0…1, bolts up the spine 0…1, blade sparks 0…1 */
  zap: number;
  zs: number;
  crawl: number;
  spine: number;
  bsp: number;
  /** afterimage arc of the cut: blade angle it starts at / ends at (deg), strength 0…1 (0 = none) */
  arcA: number;
  arcB: number;
  arc: number;
  /** floor dust 0…1 (age; 0 = none) at x */
  dust: number;
  dustX: number;
  /** guard: cloak wrapped in front 0…1 */
  wrap: number;
  /** dissolve front 0…1 (top → down) / gather mode (the same front run as a re-forming) / oy: px the body is sunk below the floor line (cut there) / grave pit glow 0…1 */
  diss: number;
  gather: boolean;
  oy: number;
  glow: number;
  /** bones scattered: death collapse 0…1 (the ribcage sags) */
  slump: number;
  /** ring of violet light on the floor 0…1 (roar / summon) */
  ring: number;
  /** phase of one-shots (0…1) */
  t: number;
}

export const NEUTRAL: Pose = {
  sink: 0,
  lean: 0,
  chy: 0,
  rb: 0,
  hx: 0,
  hy: 0,
  hr: 0,
  jaw: 0,
  eye: 0.8,
  gx: 24,
  gy: -2,
  ba: 40,
  g2: 11,
  f1x: 0,
  f1y: 0,
  f2x: 0,
  f2y: 0,
  p1: 0,
  p2: 0,
  capeA: 0,
  capeT: 0,
  capeL: 0,
  ragT: 0,
  zap: 0.5,
  zs: 0,
  crawl: 0,
  spine: 0,
  bsp: 0,
  arcA: 0,
  arcB: 0,
  arc: 0,
  dust: 0,
  dustX: 112,
  wrap: 0,
  diss: 0,
  gather: false,
  oy: 0,
  glow: 0,
  slump: 0,
  ring: 0,
  t: 0,
};
export const pose = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

// ---------------------------------------------------------------- skeleton

export interface Skel {
  R: Pt;
  H1: Pt;
  H2: Pt;
  K1: Pt;
  K2: Pt;
  A1: Pt;
  A2: Pt;
  C: Pt;
  N: Pt;
  S: Pt;
  Sh1: Pt;
  Sh2: Pt;
  E1: Pt;
  E2: Pt;
  Hn: Pt;
  Hf: Pt;
  G: Pt;
  tip: Pt;
  pommel: Pt;
  dir: Pt;
}

const SX = 3;

/** The one of the two IK solutions whose joint is farther toward (px, py). */
function pick(a: Pt, b: Pt, l1: number, l2: number, px: number, py: number): Pt {
  const j1 = ik2(a, b, l1, l2, 1);
  const j2 = ik2(a, b, l1, l2, -1);
  const s1 = j1[0] * px + j1[1] * py;
  const s2 = j2[0] * px + j2[1] * py;
  return s1 >= s2 ? j1 : j2;
}

export function skeleton(o: Pose): Skel {
  const R: Pt = [58, 80 + o.sink];
  const H1: Pt = [R[0] + 7, R[1] - 1];
  const H2: Pt = [R[0] - 7, R[1] - 1];
  const A1: Pt = [76 + o.f1x, 104 + o.f1y];
  const A2: Pt = [42 + o.f2x, 104 + o.f2y];
  // a deep crouch folds the knees: they stay above the floor line
  const k1 = pick(H1, A1, 15, 15, 1, 0.2);
  const k2 = pick(H2, A2, 15, 15, 1, 0.2);
  const K1: Pt = [k1[0], Math.min(k1[1], GY - 9)];
  const K2: Pt = [k2[0], Math.min(k2[1], GY - 9)];
  const C: Pt = [60 + o.lean, 59 + o.sink + o.chy];
  const N: Pt = [C[0] + 3 + o.lean * 0.3, C[1] - 15];
  const S: Pt = [N[0] + 4 + o.hx, N[1] - 8 + o.hy];
  const Sh1: Pt = [C[0] + 13, C[1] - 13 + o.p1 * 0.5];
  const Sh2: Pt = [C[0] - 13, C[1] - 12 + o.p2 * 0.5];
  const dir: Pt = [cos(o.ba * DEG), sin(o.ba * DEG)];
  // the point never goes below the floor line or out of the frame: the hands ride up / back with it (a planted blade)
  let gX = R[0] + o.gx;
  let gY = R[1] + o.gy;
  const lowY = gY + dir[1] * BLADE_LEN;
  if (lowY > GY - 2) gY -= lowY - (GY - 2);
  const farX = gX + dir[0] * BLADE_LEN;
  if (farX > W - 4) gX -= farX - (W - 4);
  const G: Pt = [gX, gY];
  const tip: Pt = [G[0] + dir[0] * BLADE_LEN, G[1] + dir[1] * BLADE_LEN];
  const pommel: Pt = [G[0] - dir[0] * 17, G[1] - dir[1] * 17];
  const Hn: Pt = [G[0] - dir[0] * 4, G[1] - dir[1] * 4];
  const Hf: Pt = [G[0] - dir[0] * o.g2, G[1] - dir[1] * o.g2];
  const E1 = pick(Sh1, Hn, 21, 21, 1, 0.5);
  const E2 = pick(Sh2, Hf, 21, 21, -0.2, 1);
  return { R, H1, H2, K1, K2, A1, A2, C, N, S, Sh1, Sh2, E1, E2, Hn, Hf, G, tip, pommel, dir };
}

// ---------------------------------------------------------------- frame helpers

const enum Part {
  none = 0,
  cape,
  legF,
  legN,
  pelvis,
  spine,
  ribs,
  armF,
  pauldF,
  sword,
  armN,
  pauldN,
  neck,
  hornF,
  jaw,
  skull,
  hornN,
  hand,
}

interface Frame {
  p: PixelCanvas;
  comp: Comp;
  light: Light;
  o: Pose;
  sk: Skel;
  /** deferred light pixels */
  after: ((p: PixelCanvas) => void)[];
}

const layer = () => kitLayer(W, H);
const P = (v: Pt): Pt => [rnd(v[0]), rnd(v[1])];

function rotPts(pts: readonly Pt[], ang: number, o: Pt): Pt[] {
  const c = cos(ang);
  const s = sin(ang);
  return pts.map(([x, y]) => [o[0] + x * c - y * s, o[1] + x * s + y * c]);
}

/** A bone-ish limb segment: tapered ribbon a → b, flat planes. */
function limb(f: Frame, a: Pt, b: Pt, w0: number, w1: number, t: Tones, part: Part, o: { litW?: number; shW?: number; sep?: number; bow?: number } = {}): void {
  const q = layer();
  const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const path = o.bow ? spline([a, [mid[0] + o.bow, mid[1]], b], 5) : [a, b];
  q.poly(ribbon(path, (k) => lerp(w0, w1, k)), t.M);
  q.disc(a[0], a[1], w0 / 2, t.M);
  q.disc(b[0], b[1], w1 / 2, t.M);
  bands(q, t, f.light, o.litW ?? 1, o.shW ?? 1);
  f.comp.add(q, part, { out: o.sep === 0 ? undefined : t.D });
}

// ---------------------------------------------------------------- cloak

function capeShape(f: Frame): { q: PixelCanvas; left: (t: number) => number; top: number; hem: number } {
  const { o, sk } = f;
  const q = layer();
  const top = sk.C[1] - 17;
  const hem = 92 + o.capeL;
  const sh = sk.C[0];
  const wave = (t: number, ph: number) => sin((o.capeT - t * 0.6 + ph) * Math.PI * 2);
  const left = (t: number) => lerp(sh - 15, 20, Math.pow(t, 0.85)) + o.capeA * Math.pow(t, 1.3) + wave(t, 0) * 4.6 * t - o.wrap * 0 * t;
  const right = (t: number) => lerp(sh + 5, sh - 1, t) + o.capeA * 0.35 * t + wave(t, 0.25) * 1.2 * t;
  const pts: Pt[] = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([left(t), lerp(top, hem, t)]);
  }
  // torn hem: teeth ≥ 2 px wide, depth changing with the rag phase
  const x0 = left(1);
  const x1 = right(1);
  const nt = 6;
  for (let i = 0; i < nt; i++) {
    const a = lerp(x0, x1, i / nt);
    const b = lerp(x0, x1, (i + 1) / nt);
    const d = 5 + 3 * sin((o.ragT + i * 0.19) * Math.PI * 2) + (i % 2) * 3;
    pts.push([a + 1, hem - 1]);
    pts.push([(a + b) / 2, hem + d - 3]);
  }
  pts.push([x1, hem - 1]);
  for (let i = n; i >= 0; i--) {
    const t = i / n;
    pts.push([right(t), lerp(top, hem, t)]);
  }
  q.poly(pts, CLOAK.M);
  return { q, left, top, hem };
}

function paintCape(f: Frame): void {
  const { q, left, top, hem } = capeShape(f);
  const { light, o } = f;
  const ls = light.side;
  const foldA = (t: number) => left(t) + 8 + 2 * sin((o.capeT - t * 0.7) * Math.PI * 2 + 1);
  const foldB = (t: number) => left(t) + 16 + 2 * sin((o.capeT - t * 0.7 + 0.3) * Math.PI * 2 + 2);
  planes(q, (x, y, src) => {
    const t = (y - top) / (hem - top);
    // dull crimson lining shows in the torn hem: the lowest rows of the cloak
    const dn = (() => {
      let d = 0;
      while (d < 7 && src.isOpaque(x, y + d + 1)) d++;
      return d;
    })();
    if (dn < 4 && t > 0.62) return dn === 3 ? LINING.L : dn < 2 ? LINING.S : LINING.M;
    const toLight = (() => {
      let d = 0;
      while (d < 3 && src.isOpaque(x + ls * (d + 1), y)) d++;
      return d;
    })();
    if (toLight < 1) return CLOAK.L;
    const fa = Math.abs(x - foldA(t));
    const fb = Math.abs(x - foldB(t));
    if (fa < 1.6 || fb < 1.6) return CLOAK.S;
    const away = (() => {
      let d = 0;
      while (d < 3 && src.isOpaque(x - ls * (d + 1), y)) d++;
      return d;
    })();
    if (away < 2) return CLOAK.S;
    return CLOAK.M;
  });
  f.comp.add(q, Part.cape);
  void top;
}

// ---------------------------------------------------------------- legs, pelvis, spine

function paintLegs(f: Frame): void {
  const { sk } = f;
  const leg = (H: Pt, K: Pt, A: Pt, far: boolean) => {
    const bone = far ? BONE_FAR : BONE;
    const iron = far ? IRON_FAR : IRON;
    const part = far ? Part.legF : Part.legN;
    // thigh bone + iron cuisse, shin bone + iron greave, knee cop, sabaton
    limb(f, H, K, 5, 5, bone, part);
    const th0: Pt = [lerp(H[0], K[0], 0.2), lerp(H[1], K[1], 0.2)];
    const th1: Pt = [lerp(H[0], K[0], 0.85), lerp(H[1], K[1], 0.85)];
    limb(f, th0, th1, 7, 7, iron, part, { litW: 2, shW: 2 });
    limb(f, K, A, 5, 4, bone, part);
    const sh0: Pt = [lerp(K[0], A[0], 0.25), lerp(K[1], A[1], 0.25)];
    const sh1: Pt = [lerp(K[0], A[0], 0.95), lerp(K[1], A[1], 0.95)];
    limb(f, sh0, sh1, 6, 6, iron, part, { litW: 2, shW: 2 });
    // knee cop
    const kq = layer();
    kq.disc(K[0] + 1, K[1], 4.2, iron.M);
    kq.poly([[K[0] + 2, K[1] - 3], [K[0] + 5, K[1] - 6], [K[0] + 5, K[1] - 1]], iron.M);
    bands(kq, iron, f.light, 2, 2);
    f.comp.add(kq, part, { out: iron.D });
    // sabaton: a heavy plated foot pointing right
    const fq = layer();
    const x = A[0];
    const y = A[1];
    fq.poly([[x - 5, y - 2], [x + 3, y - 3], [x + 10, y + 2], [x + 10, y + 5], [x - 5, y + 5]], iron.M);
    fq.poly([[x - 4, y - 5], [x + 3, y - 5], [x + 3, y]], iron.M);
    bands(fq, iron, f.light, 1, 1);
    f.comp.add(fq, part, { out: iron.D });
  };
  leg(sk.H2, sk.K2, sk.A2, true);
  leg(sk.H1, sk.K1, sk.A1, false);
}

function paintPelvis(f: Frame): void {
  const { sk, o } = f;
  const [rx, ry] = sk.R;
  // iliac wings: a wide bone bowl
  const q = layer();
  q.poly([[rx - 10, ry - 7], [rx + 11, ry - 7], [rx + 9, ry + 2], [rx + 3, ry + 5], [rx - 3, ry + 5], [rx - 9, ry + 2]], BONE.M);
  bands(q, BONE, f.light, 1, 1);
  f.comp.add(q, Part.pelvis, { out: BONE.D });
  // spine into the pelvis: handled in paintSpine. belt + buckle
  const b = layer();
  b.rect(rx - 11, ry - 8, 23, 4, IRON.M);
  bands(b, IRON, f.light, 1, 1);
  f.comp.add(b, Part.pelvis, { out: IRON.D });
  const bk = layer();
  bk.rect(rx + 1, ry - 9, 6, 6, IRON.L);
  bands(bk, IRON, f.light, 1, 1);
  bk.rect(rx + 3, ry - 7, 2, 2, PAL.void3);
  f.comp.add(bk, Part.pelvis, { out: IRON.D });
  // loin rag (dull crimson) + three tassets
  const lag = o.ragT;
  const rg = layer();
  const sw = rnd(1.2 * sin(lag * Math.PI * 2));
  const fl = GY - 3;
  rg.poly([[rx - 3, ry - 4], [rx + 4, ry - 4], [rx + 4 + sw, Math.min(fl - 3, ry + 12)], [rx + 1 + sw, Math.min(fl, ry + 15)], [rx - 3 + sw, Math.min(fl - 4, ry + 11)]], LINING.M);
  bands(rg, LINING, f.light, 1, 1);
  f.comp.add(rg, Part.pelvis, { out: LINING.D });
  const plate = (cx: number, w: number, h: number, far: boolean) => {
    const t = far ? IRON_FAR : IRON;
    const pq = layer();
    const fy = GY - 3;
    pq.poly([[cx - w / 2, ry - 4], [cx + w / 2, ry - 4], [cx + w / 2 - 1, Math.min(fy - 2, ry - 4 + h)], [cx, Math.min(fy, ry - 4 + h + 2)], [cx - w / 2 + 1, Math.min(fy - 2, ry - 4 + h)]], t.M);
    bands(pq, t, f.light, 1, 1);
    f.comp.add(pq, Part.pelvis, { out: t.D });
  };
  plate(rx - 8, 6, 9, true);
  plate(rx + 9, 7, 11, false);
  plate(rx + 5, 6, 8, false);
}

function paintSpine(f: Frame): void {
  const { sk, o } = f;
  // lumbar column: three vertebrae between the pelvis and the rib cage (left = back)
  const x0 = sk.C[0] - 8 + o.slump * -2;
  const y0 = sk.C[1] + 11;
  const x1 = sk.R[0] - 3;
  const y1 = sk.R[1] - 7;
  for (let i = 0; i < 3; i++) {
    const t = (i + 0.5) / 3;
    const x = lerp(x0, x1, t);
    const y = lerp(y0, y1, t);
    const q = layer();
    q.rect(rnd(x) - 3, rnd(y) - 2, 6, 4, BONE_FAR.M);
    bands(q, BONE_FAR, f.light, 1, 1);
    f.comp.add(q, Part.spine, { out: BONE_FAR.D });
  }
}

// ---------------------------------------------------------------- rib cage

/** Ribs: per rib [y offset from C, half width, tilt]. The gaps between them are the lightning slits. */
const RIBS: readonly (readonly [number, number, number])[] = [
  [-10, 10.5, 4],
  [-5, 11.5, 4],
  [0, 11.5, 4],
  [5, 10.5, 4],
  [10, 8.5, 3],
];

export interface RibGap {
  x0: number;
  x1: number;
  y: number;
  h: number;
}

export function ribGaps(sk: Skel, o: Pose): RibGap[] {
  const out: RibGap[] = [];
  for (let i = 0; i < RIBS.length - 1; i++) {
    const y = rnd(sk.C[1] + RIBS[i][0] + 2 + o.slump * i * 0.5 + o.rb);
    out.push({ x0: rnd(sk.C[0] - 6), x1: rnd(sk.C[0] + RIBS[i][1] - 3), y: y + 1, h: 2 });
  }
  return out;
}

function paintRibs(f: Frame): void {
  const { sk, o } = f;
  const [cx, cy] = sk.C;
  // the dark of the chest cavity behind the ribs
  const cav = layer();
  cav.ellipse(cx + 1, cy, 10.5, 14, PAL.void0);
  cav.rect(cx - 8, cy - 12, 17, 26, PAL.void0);
  const caq = cav.clone();
  caq.clear();
  f.comp.add(cav, Part.ribs);
  for (let i = 0; i < RIBS.length; i++) {
    const [dy, hw, tilt] = RIBS[i];
    const sag = o.slump * i * 0.8 + o.rb;
    const q = layer();
    const y = cy + dy + sag;
    // a rib bar: from the spine side (left) to the sternum (right), sloping down toward the front
    const path = spline([[cx - hw + 3, y - 1], [cx - 2, y - 2 + 0.5], [cx + hw - 3, y + tilt * 0.4], [cx + hw, y + tilt * 0.75]], 5);
    q.poly(ribbon(path, () => 3), BONE.M);
    bands(q, BONE, f.light, 1, 1);
    f.comp.add(q, Part.ribs, { out: BONE.D });
  }
  // sternum
  const st = layer();
  st.rect(cx + 8, cy - 11, 3, 22, BONE.M);
  st.poly([[cx + 7, cy + 10], [cx + 11, cy + 10], [cx + 9, cy + 14]], BONE.M);
  bands(st, BONE, f.light, 1, 1);
  f.comp.add(st, Part.ribs, { out: BONE.D });
  // spine side: a column of bone down the back edge
  const sp = layer();
  sp.rect(cx - 9, cy - 12, 3, 26, BONE_FAR.M);
  bands(sp, BONE_FAR, f.light, 1, 1);
  f.comp.add(sp, Part.ribs, { out: BONE_FAR.D });
}

// ---------------------------------------------------------------- pauldrons

function paintPauldron(f: Frame, far: boolean): void {
  const { sk, o } = f;
  const t = far ? IRON_FAR : IRON;
  const lift = far ? o.p2 : o.p1;
  const sh = far ? sk.Sh2 : sk.Sh1;
  const sc = far ? 0.88 : 1;
  const cx = sh[0] + (far ? -5 : 5);
  const cy = sh[1] + lift;
  const q = layer();
  const pt = (x: number, y: number): Pt => [cx + x * sc * (far ? -1 : 1) * (far ? 1 : 1), cy + y * sc];
  // a heavy dome that overhangs the shoulder; the far one is mirrored so it bulges AWAY from the body
  const dome: Pt[] = [[-14, 5], [-13, -2], [-9, -7], [-2, -9], [6, -8], [12, -4], [14, 2], [13, 8], [7, 9], [0, 10], [-8, 9]].map(([x, y]) => pt(x, y));
  q.poly(dome, t.M);
  // spikes
  const sp: [number, number, number, number, number][] = far
    ? [[-9, -6, -12, -16, 5], [-1, -8, -3, -18, 5], [7, -7, 5, -15, 4]]
    : [[-7, -7, -9, -16, 5], [0, -8, 1, -18, 5], [7, -6, 11, -15, 5]];
  for (const [bx, by, tx, ty, w] of sp) {
    const a = pt(bx - w / 2, by + 1);
    const b = pt(bx + w / 2, by + 1);
    q.poly([a, b, pt(tx, ty)], t.M);
  }
  const src = q.clone();
  // lames: grooves parallel to the top edge
  planes(q, (x, y, s) => {
    let d = 0;
    while (d < 12 && s.isOpaque(x, y - d - 1)) d++;
    // spikes are above the dome: only the dome lames get grooves
    const lit = (() => {
      let e = 0;
      while (e < 3 && s.isOpaque(x + f.light.side * (e + 1), y)) e++;
      return e;
    })();
    if (d === 5 || d === 6 || d === 11 || d === 12) return t.S;
    if (d === 0 || lit < 2) return t.L;
    const away = (() => {
      let e = 0;
      while (e < 3 && s.isOpaque(x - f.light.side * (e + 1), y)) e++;
      return e;
    })();
    let dn = 0;
    while (dn < 3 && s.isOpaque(x, y + dn + 1)) dn++;
    if (away < 2 || dn < 2) return t.S;
    return t.M;
  });
  void src;
  f.comp.add(q, far ? Part.pauldF : Part.pauldN, { out: t.D });
  // rivets: one lit pixel per lame row
  if (!far) {
    const dr = layer();
    for (const x of [-8, 0, 8]) dr.set(rnd(cx + x), rnd(cy - 1), IRON.L);
    f.after.push(() => void 0);
    void dr;
  }
}

// ---------------------------------------------------------------- arms and hands

function paintArm(f: Frame, far: boolean): void {
  const { sk } = f;
  const bone = far ? BONE_FAR : BONE;
  const iron = far ? IRON_FAR : IRON;
  const part = far ? Part.armF : Part.armN;
  const Sh = far ? sk.Sh2 : sk.Sh1;
  const E = far ? sk.E2 : sk.E1;
  const Hd = far ? sk.Hf : sk.Hn;
  limb(f, Sh, E, 5, 4, bone, part);
  limb(f, [lerp(E[0], Hd[0], 0.15), lerp(E[1], Hd[1], 0.15)], [lerp(E[0], Hd[0], 0.85), lerp(E[1], Hd[1], 0.85)], 6, 6, iron, part, { litW: 2, shW: 2 });
  // elbow cop with a back-swept spike
  const q = layer();
  q.disc(E[0], E[1], 3.5, iron.M);
  q.poly([[E[0] - 2, E[1] - 1], [E[0] - 7, E[1] - 4], [E[0] - 2, E[1] + 2]], iron.M);
  bands(q, iron, f.light, 1, 1);
  f.comp.add(q, part, { out: iron.D });
}

function paintHands(f: Frame): void {
  const { sk } = f;
  for (const [Hd, far] of [[sk.Hf, true], [sk.Hn, false]] as const) {
    const t = far ? BONE_FAR : BONE;
    const q = layer();
    const [x, y] = P(Hd);
    q.rect(x - 3, y - 3, 6, 5, t.M);
    q.rect(x - 2, y + 2, 4, 2, t.M);
    bands(q, t, f.light, 1, 1);
    // finger gaps
    q.set(x - 1, y + 1, t.D);
    q.set(x + 1, y + 1, t.D);
    q.set(x - 1, y + 2, t.D);
    q.set(x + 1, y + 2, t.D);
    f.comp.add(q, Part.hand, { out: t.D });
  }
}

// ---------------------------------------------------------------- the greatblade

function paintSword(f: Frame): void {
  const { sk, o, light } = f;
  const [gx, gy] = sk.G;
  const a = o.ba * DEG;
  const loc = (pts: readonly Pt[]): Pt[] => rotPts(pts, a, [gx, gy]);
  // blade: spear tip, a notched back edge, ricasso
  const blade: Pt[] = [
    [0, -3.6], [30, -3.6], [38, -2.8], [BLADE_LEN, 0], [37, 3.2],
    [33, 3.6], [31, 5.2], [27, 3.6], [22, 3.6], [20, 5.1], [16, 3.6], [11, 3.6], [9, 5], [5, 3.6], [0, 3.6],
  ];
  const q = layer();
  q.poly(loc(blade), IRON.M);
  const pn: Pt = [-sin(a), cos(a)];
  const lit = pn[0] * light.v2[0] + pn[1] * light.v2[1] > 0 ? 1 : -1;
  planes(q, (x, y) => {
    const u = (x + 0.5 - gx) * cos(a) + (y + 0.5 - gy) * sin(a);
    const v = ((x + 0.5 - gx) * pn[0] + (y + 0.5 - gy) * pn[1]) * lit;
    if (v > 2.2 && u > 2) return IRON.L;
    if (v > 0.7) return IRON.M;
    if (Math.abs(v) <= 0.7 && u > 3 && u < 36) return IRON.S;
    if (v < -2.6) return IRON.S;
    return IRON.M;
  });
  // the lit cutting edge: one pale line from the guard to the point
  planes(q, (x, y, s) => {
    const dx = lit * -pn[0];
    const dy = lit * -pn[1];
    void dx;
    void dy;
    const sx = Math.sign(lit * pn[0]);
    const sy = Math.sign(lit * pn[1]);
    const on = (s.isOpaque(x + sx, y) ? 0 : 1) + (s.isOpaque(x, y + sy) ? 0 : 1);
    const u = (x + 0.5 - gx) * cos(a) + (y + 0.5 - gy) * sin(a);
    return on > 0 && u > 5 && u < BLADE_LEN - 1 ? PAL.stone4 : null;
  });
  f.comp.add(q, Part.sword, { out: IRON.D });
  // crossguard: an iron bar with bone tusks curving toward the point
  const gq = layer();
  gq.poly(loc([[-2.5, -8.5], [2, -8.5], [3.5, -6], [2.5, 8.5], [-2.5, 8.5]]), IRON.M);
  gq.poly(loc([[2, -9], [6, -10], [3, -6]]), BONE.M);
  gq.poly(loc([[2, 9], [6, 10.5], [3, 6]]), BONE.M);
  bands(gq, IRON, light, 1, 1);
  f.comp.add(gq, Part.sword, { out: IRON.D });
  // grip wrapped in bone strips + skull pommel
  const grq = layer();
  grq.poly(loc([[-17, -1.8], [-2, -1.8], [-2, 1.8], [-17, 1.8]]), BONE.M);
  bands(grq, BONE, light, 1, 1);
  f.comp.add(grq, Part.sword, { out: BONE.D });
  const pq = layer();
  const pm = loc([[-19.5, 0]])[0];
  pq.disc(pm[0], pm[1], 3.2, BONE.M);
  bands(pq, BONE, light, 1, 1);
  f.comp.add(pq, Part.sword, { out: BONE.D });
}

// ---------------------------------------------------------------- neck, skull, horns

/** Local skull geometry (x forward, y down; origin = skull centre). */
const CRAN: Pt[] = [[-7, 0], [-7, -5], [-4, -9], [1, -11], [6, -10], [9, -6], [10, -2], [10, 2], [8, 5], [4, 6], [-3, 6], [-6, 4]];
/** Socket pixels (skull-local): near (wide, slanted) and far (narrow). */
const SOCK_N: Pt[] = [[1, -5], [2, -5], [3, -5], [4, -5], [0, -4], [1, -4], [2, -4], [3, -4], [4, -4], [0, -3], [1, -3], [2, -3], [3, -3], [1, -2], [2, -2], [3, -2]];
const SOCK_F: Pt[] = [[7, -5], [8, -5], [6, -4], [7, -4], [8, -4], [6, -3], [7, -3], [8, -3], [7, -2]];
const JAW: Pt[] = [[-4, 5], [8, 5], [8, 7], [6, 10], [0, 11], [-3, 9]];
const HORN_N: Pt[] = [[2, -7], [7, -9], [12, -11], [15, -15], [16, -21]];
const HORN_F: Pt[] = [[-3, -7], [-8, -9], [-13, -11], [-16, -15], [-17, -21]];

export interface HeadGeom {
  S: Pt;
  rot: number;
  /** skull-local → frame */
  at(x: number, y: number): Pt;
}

export function headGeom(sk: Skel, o: Pose): HeadGeom {
  const rot = o.hr * DEG;
  const S = sk.S;
  const c = cos(rot);
  const s = sin(rot);
  return { S, rot, at: (x, y) => [S[0] + x * c - y * s, S[1] + x * s + y * c] };
}

function paintNeck(f: Frame): void {
  const { sk } = f;
  const [nx, ny] = sk.N;
  const sx = sk.S[0];
  const sy = sk.S[1];
  // two vertebrae between the gorget and the skull
  for (let i = 0; i < 2; i++) {
    const t = (i + 0.5) / 2;
    const x = rnd(lerp(nx, sx - 2, t));
    const y = rnd(lerp(ny - 1, sy + 6, t));
    const q = layer();
    q.rect(x - 2, y - 2, 5, 4, BONE.M);
    bands(q, BONE, f.light, 1, 1);
    f.comp.add(q, Part.neck, { out: BONE.D });
  }
  // gorget: a plated iron collar
  const g = layer();
  g.poly([[nx - 9, ny + 1], [nx - 5, ny - 3], [nx + 6, ny - 3], [nx + 10, ny + 1], [nx + 8, ny + 5], [nx - 7, ny + 5]], IRON.M);
  bands(g, IRON, f.light, 1, 1);
  f.comp.add(g, Part.neck, { out: IRON.D });
}

function paintHorn(f: Frame, near: boolean): void {
  const hg = headGeom(f.sk, f.o);
  const t = near ? BONE : BONE_FAR;
  const pts = (near ? HORN_N : HORN_F).map(([x, y]) => hg.at(x, y));
  const q = layer();
  q.stroke(spline(pts, 6), 6, 1, t.M);
  bands(q, t, f.light, 1, 1);
  // ridges: one darker groove ring per 5 px, at the base only
  f.comp.add(q, near ? Part.hornN : Part.hornF, { out: t.D });
}

function paintSkull(f: Frame): void {
  const { o } = f;
  const hg = headGeom(f.sk, o);
  const at = hg.at;
  const ja = o.jaw * DEG;
  // mandible: hinged at (-5, 3), swings down by `jaw`
  const jt: Pt[] = JAW.map(([x, y]) => {
    const dx = x + 5;
    const dy = y - 5;
    const c = cos(ja);
    const s = sin(ja);
    return at(-5 + dx * c - dy * s, 5 + dx * s + dy * c);
  });
  const jq = layer();
  if (o.jaw > 4) {
    // the open mouth: the black behind the teeth
    const mouth: Pt[] = [at(-4, 5), at(9, 5), jt[1], jt[0]];
    jq.poly(mouth, PAL.ink);
  }
  jq.poly(jt, BONE.M);
  bands(jq, BONE, f.light, 1, 1);
  f.comp.add(jq, Part.jaw, { out: BONE.D });
  const q = layer();
  q.poly(CRAN.map(([x, y]) => at(x, y)), BONE.M);
  bands(q, BONE, f.light, 2, 2);
  // sockets (the dark the light sits in): slanted, angry, the brow ridge sloping down toward the nose
  const put = (x: number, y: number, c: number) => {
    const pp = at(x, y);
    q.set(rnd(pp[0]), rnd(pp[1]), c);
  };
  for (const [x, y] of SOCK_N) put(x, y, PAL.void0);
  for (const [x, y] of SOCK_F) put(x, y, PAL.void0);
  // nasal cavity: an inverted heart
  for (const [x, y] of [[5, 0], [6, 0], [5, 1], [6, 1], [5, 2]] as const) put(x, y, PAL.void0);
  // cheekbone: a lit ridge under the socket, a crease behind it
  for (const x of [0, 1, 2, 3]) put(x, 0, BONE.L);
  for (const x of [-4, -3, -2, -1]) put(x, 1, BONE.D);
  // upper teeth: four 2-px teeth with dark gaps, the mouth line under them
  for (const x of [-1, 2, 5, 8]) for (const dx of [0, 1]) for (const y of [4, 5]) put(x + dx, y, dx === 0 ? BONE.L : BONE.M);
  for (const x of [1, 4, 7]) for (const y of [4, 5]) put(x, y, PAL.void0);
  for (let x = -2; x <= 9; x++) put(x, 6, o.jaw > 4 ? PAL.ink : BONE.D);
  f.comp.add(q, Part.skull, { out: BONE.D });
  // light: eyes (sockets 1,-4 / 7,-4 as drawn) + bolts
  const e1 = at(1, -4);
  const e2 = at(7, -4);
  const en = P(e1);
  const ef = P(e2);
  f.after.push((p) => {
    eyeGlow(p, en[0], en[1], 3, 2, o.eye);
    eyeGlow(p, ef[0], ef[1], 2, 2, o.eye * 0.9);
  });
}

// ---------------------------------------------------------------- light pass

function lightPass(f: Frame): void {
  const { p, o, sk } = f;
  const zap = o.zap;
  const hg = headGeom(sk, o);
  // rib gaps: a bright charge crawling through each slit
  const gaps = ribGaps(sk, o);
  gaps.forEach((g, i) => {
    const span = g.x1 - g.x0 + 1;
    const ph = (o.crawl + i * 0.27) % 1;
    const pos = g.x0 - 5 + ph * (span + 8);
    const on = zap > 0.15;
    if (on) gapCharge(p, g.x0, g.x1, g.y, g.h, rnd(pos), 6, zap);
    // a dim steady glow in the rest of the slit so the ribs are never dead
    for (let x = g.x0; x <= g.x1; x++) if (p.isOpaque(x, g.y) && p.get(x, g.y) === PAL.void0) p.set(x, g.y, zap > 0.3 ? PAL.void1 : PAL.void0);
  });
  // eye bolts
  if (o.zap > 0.7) {
    const e = P(hg.at(3, -5));
    eyeBolts(p, e, 6 + 7 * Math.min(1.4, zap - 0.4), o.zs * 3 + 1, o.spine > 0.5 ? 1 : o.zap > 1.1 ? 3 : 2, zap > 1.1 && o.spine <= 0.5);
    const e2 = P(hg.at(8, -5));
    if (zap > 1.1 && o.spine <= 0.5) eyeBolts(p, e2, 8, o.zs * 3 + 2, 1, true);
  }
  // bolts up the spine
  if (o.spine > 0) {
    const n = 2 + Math.round(o.spine * 2);
    for (let i = 0; i < n; i++) {
      // the burst climbs the back of the rib cage and leans away from the skull (up and to the left)
      const bx = sk.C[0] - 9 + i * 2;
      const by0 = sk.C[1] - 8;
      const l = 14 + o.spine * 16;
      const pts = bolt(p, [bx, by0], [bx - 6 - i * 4, by0 - l], o.zs * 5 + i, 3, o.spine > 0.7);
      if (pts.length > 6) fork(p, pts[Math.floor(pts.length * 0.5)], [-1, -1], 3, o.zs + i);
    }
  }
  // blade sparks: a little crawl along the cutting edge
  if (o.bsp > 0) {
    const a = o.ba * DEG;
    const k = 0.25 + 0.6 * ((o.crawl * 2) % 1);
    const px = sk.G[0] + cos(a) * BLADE_LEN * k;
    const py = sk.G[1] + sin(a) * BLADE_LEN * k;
    const lx = rnd(px);
    const ly = rnd(py);
    p.set(lx, ly - 1, PAL.void4);
    p.set(lx + 1, ly - 1, PAL.void3);
    if (o.bsp > 0.6) p.set(lx, ly - 2, PAL.white);
  }
}

// ---------------------------------------------------------------- floor and cut effects

/** The grave pit under the feet: a dark ellipse with a lit violet rim, brightness `glow` 0…1. */
function paintPit(p: PixelCanvas, glow: number, ring: number): void {
  if (glow > 0) {
    const rx = 15 + Math.round(glow * 15);
    const ry = Math.min(6, Math.round(rx * 0.22));
    p.ellipse(AX, GY - 1, rx, ry, PAL.ink);
    p.ellipse(AX, GY - 1, rx - 3, ry - 1, PAL.void0);
    p.ellipseRing(AX, GY - 1, rx, ry, glow > 0.6 ? PAL.void3 : PAL.void2);
    if (glow > 0.8) p.ellipseRing(AX, GY - 1, rx - 3, ry - 1, PAL.void4);
  }
  if (ring > 0) {
    const rx = 16 + Math.round(ring * 38);
    const ry = Math.min(6, Math.round(rx * 0.2));
    p.ellipseRing(AX, GY - 1, rx, ry, ring < 0.5 ? PAL.void4 : PAL.void3);
    if (ring < 0.7) p.ellipseRing(AX, GY - 1, rx - 2, ry - 1, PAL.void2);
  }
}

/** Afterimage arc of the cut: the swept sector behind the blade, three stepped tones, thickening toward the blade. */
function paintArc(p: PixelCanvas, o: Pose, sk: Skel): void {
  if (o.arc <= 0) return;
  const n = Math.max(2, Math.round(Math.abs(o.arcB - o.arcA) / 1.5));
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    const ang = (o.arcA + (o.arcB - o.arcA) * u) * DEG;
    const wd = (3 + 11 * u) * o.arc;
    const r1 = BLADE_LEN - 2;
    const r0 = r1 - wd;
    const col = u < 0.4 ? PAL.void2 : u < 0.75 ? PAL.void3 : PAL.void4;
    const c = cos(ang);
    const s2 = sin(ang);
    p.line(sk.G[0] + c * r0, sk.G[1] + s2 * r0, sk.G[0] + c * r1, sk.G[1] + s2 * r1, col);
  }
}

/** A cell hash in [0, 1) for 2×2 clusters. */
function cellNoise(x: number, y: number, seed: number): number {
  let h = ((x >> 1) * 374761393 + (y >> 1) * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * The revenant's dissolve (death) / re-forming (revive, gather): the body erodes from the horns down in 2×2 violet
 * clusters with a burning edge, motes rising off the front.
 */
function dissolve(p: PixelCanvas, front01: number, gather: boolean, seed: number): void {
  const b = p.bounds();
  if (!b || front01 <= 0) return;
  const top = b.y;
  const span = b.h + 18;
  const yf = top + front01 * span;
  const mo: [number, number, number][] = [];
  for (let y = b.y; y < b.y + b.h; y++)
    for (let x = b.x; x < b.x + b.w; x++) {
      if (!p.isOpaque(x, y)) continue;
      const n = cellNoise(x, y, seed);
      const t = y - (yf - n * 18);
      if (t < 0) {
        p.erase(x, y);
        if (n > 0.93 && y > yf - 26) mo.push([x, y - 4 - Math.round(n * 30) % 9, n > 0.97 ? 3 : 2]);
      } else if (t < 2) p.set(x, y, n > 0.5 ? PAL.void4 : PAL.void3);
      else if (t < 4) p.set(x, y, PAL.void2);
    }
  void gather;
  motes(p, mo.slice(0, 9));
}

// ---------------------------------------------------------------- the frame

function drawBody(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right'): void {
  const light = lightOf(lightFrom);
  const sk = skeleton(o);
  const f: Frame = { p, comp: new Comp(p), light, o, sk, after: [] };
  paintCape(f);
  paintLegs(f);
  paintArm(f, true);
  paintPelvis(f);
  paintSpine(f);
  paintRibs(f);
  paintNeck(f);
  paintPauldron(f, true);
  paintSword(f);
  paintArm(f, false);
  paintPauldron(f, false);
  paintHands(f);
  paintHorn(f, false);
  paintSkull(f);
  paintHorn(f, true);
  p.outline(PAL.ink);
  lightPass(f);
  for (const fn of f.after) fn(p);
  paintArc(p, o, sk);
}

export function drawWarden(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right' = 'left'): void {
  paintPit(p, o.glow, o.ring);
  if (o.oy === 0 && o.diss === 0) {
    drawBody(p, o, lightFrom);
  } else {
    const q = new PixelCanvas(W, H);
    drawBody(q, o, lightFrom);
    if (o.diss > 0) dissolve(q, o.diss, o.gather, o.zs + 3);
    // the body rises out of / sinks into the floor: shifted down by oy, cut at the floor line
    for (let y = 0; y < H; y++) {
      const sy = y - o.oy;
      if (sy < 0 || y > GY) continue;
      for (let x = 0; x < W; x++) {
        const c = q.get(x, sy);
        if (c !== null) p.set(x, y, c);
      }
    }
    if (o.oy > 0 && o.oy < 70) for (let x = AX - 14; x <= AX + 20; x++) if (p.isOpaque(x, GY)) p.set(x, GY, o.oy > 8 ? PAL.void4 : PAL.void3);
  }
  if (o.dust > 0) dust(p, o.dustX, GY - 1, o.dust, o.zs + 1, 1);
}
