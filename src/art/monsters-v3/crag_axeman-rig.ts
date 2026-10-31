// Kaya Baltacı v3 — the "mountain barbarian" rig: Pose → skeleton → pixels.
//
// A BROAD TRIANGLE on short thick legs set wide: a bare skin chest under a shaggy fur mantle, a fur cloak hanging down
// the back, a small sunk head with a shaved crown, a top-knot and two fire-red war-paint stripes, a braided stone-grey
// beard with stone beads swinging on the chest, leather breeches and fur-cuffed boots. On the near shoulder rests the
// signature second mass: a single-bit CRESCENT AXE carved from one rock (flat facets, an edge line, three chip notches)
// on a vine-wrapped haft — "a man with a half-moon on his shoulder".
//
//   - every part is a polygon given flat value planes measured from its own edges (lit band toward the key light, shade
//     band away from it): no gradients, no dither; ONE key light from the screen's top-left (`light`: 'left' for P1,
//     'right' for the P2 relight sheet; flipped by flipX it is lit from the top-left again);
//   - the feet are planted (two-bone IK) and never move in idle / guard / transitions;
//   - six FACINGS drawn as their own layouts (3/4 right, side, back 3/4, back, mirrored 3/4, front) carry the attack's
//     360° spin — never a sprite flip of the body;
//   - every coordinate goes through a rigid placement `Xf`, so the death's two halves are re-rasterised on tilted
//     skeletons (never sprite-rotated);
//   - light (eyes, the Yarık seam, sparks, the axe glint, dust) is painted after the outline and never outlined (IŞ-9).
// Frame 88×88, 1 art px = 1 game px; the anchor (AX, GY) is the floor point between the boots.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ik2, lightOf, type Light } from '../rigkit';
import {
  AX, BEARD, Comp, GY, H, HAFT, SEAM_X, W, axeUV, FUR, FUR_FAR, HIDE, IDENT, ROCK, SKIN, SKIN_FAR, WOOD, WOOL, WOOL_FAR, bands, clamp, hash2, layer as kitLayer, lerp, planes,
  ribbon, spline, tube, xf, xfInv, type Pt, type Tones, type Xf,
} from './crag_axeman-kit';
import { boulderFx, burnPass, dustFx, floorSeamFx, seamFx, sparkFx, chipFx, clodFx, smearFx, gatherFx } from './crag_axeman-fx';

export { W, H, GY, AX, HAFT, SEAM_X };
/** The whole haft, butt to head centre (the hand slides along it: hl is the grip → head part). */
const HAFT_ALL = 36;

const DEG = Math.PI / 180;
const rnd = Math.round;
const sin = Math.sin;
const cos = Math.cos;

// ---------------------------------------------------------------- pose

/** Facing layouts of the body (the spin): 0 3/4 right · 1 side · 2 back 3/4 · 3 back · 4 back 3/4 left · 5 3/4 left · 6 front. */
export type Facing = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Pose {
  /** facing layout (0 = the normal 3/4 right) */
  fc: Facing;
  /** pelvis drop (px: the knees bend, the boots stay), upper-body lean (px, + forward), breath (px, + = chest down), shoulder heave (px, − = up) */
  sink: number;
  lean: number;
  chy: number;
  shr: number;
  /** head offset (px), head tilt (−1 / 0 / 1: the neck roll), eyes 0 shut … 1 open … 2 glare, mouth 0 shut / 1 open (nara) */
  hx: number;
  hy: number;
  tilt: number;
  eye: number;
  mouth: number;
  /** near (axe) hand target and far hand target, relative to the anchor; fh 1 = the far hand grips the haft g2 px from the near grip (+ toward the head) */
  nx: number;
  ny: number;
  fx: number;
  fy: number;
  fh: number;
  g2: number;
  /** ag 1 = the axe is out of the hand: its grip point is (agx, agy) relative to the anchor (death / revive) */
  ag: number;
  agx: number;
  agy: number;
  /** axe: haft angle (deg, 0 = right, −90 = up), haft length grip → head centre (px; foreshortened in the spin), blade side (±1), layer (−1 behind the body, 0 on the shoulder under the head, 1 in front), clip the axe at the floor line (1 = buried: the bite) */
  ba: number;
  hl: number;
  /** the haft's foreshortening in the spin (1 = flat to the view) */
  fore: number;
  hd: number;
  az: number;
  bury: number;
  /** boots: near / far offsets (px; negative y = lifted) */
  f1x: number;
  f1y: number;
  f2x: number;
  f2y: number;
  /** followers: beard-bead swing (px), cloak swing (px, + forward), fur hem phase 0…1, mantle lift (px) */
  bead: number;
  cape: number;
  hem: number;
  mant: number;
  /** war paint 0 normal / 1 flashing (hitMagic); body rigid shudder 0/1/2 (hitMagic) */
  paint: number;
  shud: number;
  /** effects: arc smear of the axe head 0/1, axe-edge glint 0/1/2 (1 px / 3-px cross), sparks / chips / dust / clods phase (0 = none), the floor-tap spark 0/1 */
  smear: number;
  glint: number;
  spark: number;
  chips: number;
  dust: number;
  clods: number;
  tap: number;
  /** a short floor seam from the axe head forward (px; 0 none), its brightness 0…1 */
  crack: number;
  crackK: number;
  /** death: the body seam climbs 0…1 (feet → crown), halves apart (px), halves' tilt (deg), seam-burn front 0…1; gather = the burn run backwards (revive) */
  seam: number;
  split: number;
  tilt2: number;
  burn: number;
  gather: boolean;
  /** summon: boulder state — 0 none, 1 whole (rolling: roll frame 0…3, rocking px), 2 punched (blade out), 3 split seam, 4 halves apart (k 0…1), 5 halves lying (sink step 0…3); the man hidden inside */
  bould: number;
  roll: number;
  rock: number;
  bk: number;
  hide: boolean;
  /** a floor seam where the boulder split (summon / roar), length px and brightness step */
  fseam: number;
  fseamK: number;
  /** phase of one-shots (0…1) */
  t: number;
}

export const NEUTRAL: Pose = {
  fc: 0,
  sink: 0,
  lean: 0,
  chy: 0,
  shr: 0,
  hx: 0,
  hy: 0,
  tilt: 0,
  eye: 1,
  mouth: 0,
  nx: 13,
  ny: -32,
  fx: -12,
  fy: -26,
  fh: 0,
  g2: -14,
  ag: 0,
  agx: 0,
  agy: 0,
  ba: -120,
  hl: 28,
  fore: 1,
  hd: -1,
  az: 0,
  bury: 0,
  f1x: 0,
  f1y: 0,
  f2x: 0,
  f2y: 0,
  bead: 0,
  cape: 0,
  hem: 0,
  mant: 0,
  paint: 0,
  shud: 0,
  smear: 0,
  glint: 0,
  spark: 0,
  chips: 0,
  dust: 0,
  clods: 0,
  tap: 0,
  crack: 0,
  crackK: 1,
  seam: 0,
  split: 0,
  tilt2: 0,
  burn: 0,
  gather: false,
  bould: 0,
  roll: 0,
  rock: 0,
  bk: 0,
  hide: false,
  fseam: 0,
  fseamK: 0,
  t: 0,
};
export const pose = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

export { BLADE_PTS };

// ---------------------------------------------------------------- facing layouts

interface Layout {
  /** mirror of the body's internal offsets (+1 facing right, −1 facing left) */
  mx: 1 | -1;
  /** shoulder / chest half-width scale */
  sw: number;
  /** the back is turned to the viewer (the cloak covers the torso) */
  back: boolean;
  /** head drawing mode */
  head: 'r34' | 'side' | 'back34' | 'back' | 'front';
  /** cloak shows at the back edge / on both sides (front) */
  cloak: 'back' | 'both' | 'cover';
}
const LAYOUTS: Record<Facing, Layout> = {
  0: { mx: 1, sw: 1, back: false, head: 'r34', cloak: 'back' },
  1: { mx: 1, sw: 0.62, back: false, head: 'side', cloak: 'back' },
  2: { mx: 1, sw: 0.88, back: true, head: 'back34', cloak: 'cover' },
  3: { mx: 1, sw: 1, back: true, head: 'back', cloak: 'cover' },
  4: { mx: -1, sw: 0.88, back: true, head: 'back34', cloak: 'cover' },
  5: { mx: -1, sw: 0.9, back: false, head: 'r34', cloak: 'back' },
  6: { mx: 1, sw: 1, back: false, head: 'front', cloak: 'both' },
};

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
  /** head centre */
  Hd: Pt;
  Sn: Pt;
  Sf: Pt;
  En: Pt;
  Ef: Pt;
  Hn: Pt;
  Hf: Pt;
  /** the haft point held (the near hand, or the free axe's grip point) */
  G: Pt;
  /** haft direction (unit), butt end, head centre, blade normal (unit, toward the edge) */
  dir: Pt;
  butt: Pt;
  axe: Pt;
  nrm: Pt;
  /** the cutting edge's centre point (the muzzle) */
  edge: Pt;
  L: Layout;
}

function pick(a: Pt, b: Pt, l1: number, l2: number, px: number, py: number): Pt {
  const j1 = ik2(a, b, l1, l2, 1) as Pt;
  const j2 = ik2(a, b, l1, l2, -1) as Pt;
  return j1[0] * px + j1[1] * py >= j2[0] * px + j2[1] * py ? j1 : j2;
}

export function skeleton(o: Pose): Skel {
  const L = LAYOUTS[o.fc];
  const mx = L.mx;
  const R: Pt = [AX + 0.5 * mx, GY - 20 + o.sink];
  const H1: Pt = [R[0] + 5 * mx * L.sw, R[1]];
  const H2: Pt = [R[0] - 5 * mx * L.sw, R[1]];
  const A1: Pt = [AX + 8 + o.f1x, GY - 4 + o.f1y];
  const A2: Pt = [AX - 8 + o.f2x, GY - 4 + o.f2y];
  const K1 = pick(H1, A1, 9.5, 9, 1, -0.1);
  const K2 = pick(H2, A2, 9.5, 9, 1, -0.1);
  const C: Pt = [R[0] + (1 + o.lean) * mx, R[1] - 15 + o.chy];
  const Hd: Pt = [C[0] + (4 + o.hx) * mx, C[1] - 16 + o.hy - o.chy + Math.min(0, o.shr)];
  const Sn: Pt = [C[0] + 12 * mx * L.sw, C[1] - 7 + o.shr];
  const Sf: Pt = [C[0] - 12 * mx * L.sw, C[1] - 6 + o.shr];
  const dir: Pt = [cos(o.ba * DEG), sin(o.ba * DEG)];
  const nrm: Pt = [-dir[1] * o.hd, dir[0] * o.hd];
  const Hn: Pt = [AX + o.nx, GY + o.ny];
  const G: Pt = o.ag > 0 ? [AX + o.agx, GY + o.agy] : Hn;
  const axe: Pt = [G[0] + dir[0] * o.hl * o.fore, G[1] + dir[1] * o.hl * o.fore];
  const butt: Pt = [G[0] - dir[0] * (HAFT_ALL - o.hl) * o.fore, G[1] - dir[1] * (HAFT_ALL - o.hl) * o.fore];
  const Hf: Pt = o.fh > 0 ? [Hn[0] + dir[0] * o.g2, Hn[1] + dir[1] * o.g2] : [AX + o.fx, GY + o.fy];
  const En = pick(Sn, Hn, 10.5, 10, mx * 0.25, 1);
  const Ef = pick(Sf, Hf, 10.5, 10, -mx * 0.7, 1);
  const edge: Pt = [axe[0] + nrm[0] * 10.5, axe[1] + nrm[1] * 10.5];
  return { R, H1, H2, K1, K2, A1, A2, C, Hd, Sn, Sf, En, Ef, Hn, Hf, G, dir, butt, axe, nrm, edge, L };
}

// ---------------------------------------------------------------- frame

const enum Part {
  none = 0,
  cloak,
  armF,
  legF,
  legN,
  belt,
  torso,
  beard,
  mantle,
  axeBack,
  axe,
  head,
  armN,
  fist,
  boulder,
}

export interface Frame {
  p: PixelCanvas;
  comp: Comp;
  light: Light;
  o: Pose;
  sk: Skel;
  /** the rigid placement every coordinate goes through */
  T: Xf;
  /** the eye pixels found while drawing the head (light, painted after the outline) */
  eyes: Pt[];
  /** the war-paint stripe pixels */
  paint: Pt[];
}

const layer = () => kitLayer(W, H);

function tp(f: Frame, pts: readonly Pt[]): Pt[] {
  return f.T.a === 0 && f.T.dx === 0 && f.T.dy === 0 ? (pts as Pt[]) : pts.map((q) => xf(f.T, q));
}
function polyT(f: Frame, q: PixelCanvas, pts: readonly Pt[], c: number): void {
  q.poly(tp(f, pts), c);
}
function discT(f: Frame, q: PixelCanvas, c: Pt, r: number, col: number): void {
  const [x, y] = xf(f.T, c);
  q.disc(x, y, r, col);
}
/** Local offsets (facing right) → frame points around an origin, mirrored by the layout. */
const loc = (o: Pt, mx: number, pts: readonly (readonly [number, number])[], sx = 1): Pt[] => pts.map(([x, y]) => [o[0] + x * mx * sx, o[1] + y] as Pt);

function limb(f: Frame, a: Pt, b: Pt, w0: number, w1: number, t: Tones, part: Part, out?: number, litW = 2, shW = 2): void {
  const q = layer();
  const path: Pt[] = [a, b];
  polyT(f, q, ribbon(path, (k) => lerp(w0, w1, k)), t.M);
  discT(f, q, a, w0 / 2 - 0.2, t.M);
  discT(f, q, b, w1 / 2 - 0.2, t.M);
  bands(q, t, f.light, litW, shW);
  f.comp.add(q, part, { out: out ?? t.D });
}

// ---------------------------------------------------------------- cloak (fur, down the back)

function hemTeeth(pts: Pt[], x0: number, x1: number, y: number, n: number, ph: number, depth: number): void {
  // ≥ 2-px teeth along a hem from x0 to x1 (left → right), depth swaying with the hem phase
  for (let i = 0; i < n; i++) {
    const a = lerp(x0, x1, i / n);
    const b = lerp(x0, x1, (i + 1) / n);
    const d = depth + rnd(1.2 * sin((ph + i * 0.23) * Math.PI * 2)) + (i % 2);
    pts.push([a + 0.5, y]);
    pts.push([(a + b) / 2, y + d]);
  }
  pts.push([x1, y]);
}

function paintCloak(f: Frame): void {
  const { o, sk } = f;
  const L = sk.L;
  const mx = L.mx;
  const [cx, cy] = sk.C;
  const q = layer();
  const sway = o.cape;
  const hemY = GY - 13 + rnd(o.sink * 0.5);
  if (L.cloak === 'back' || L.cloak === 'both') {
    // hangs from behind the far shoulder down the back, flaring out; swings by `cape`
    const sides = L.cloak === 'both' ? [-1, 1] : [-1];
    for (const s of sides) {
      const sm = s * mx;
      const top: Pt = [cx + sm * 10 * L.sw, cy - 10];
      const outTop: Pt = [cx + sm * 17 * L.sw, cy - 7];
      const outHem: Pt = [cx + sm * (21 + (s < 0 ? -sway : sway) * 0.5), hemY];
      const inHem: Pt = [cx + sm * 8, hemY - 2];
      const pts: Pt[] = [top, outTop, ...spline([outTop, [cx + sm * (20 - sway * 0.3), cy + 6], outHem], 4).slice(1)];
      const tpts: Pt[] = [];
      if (sm < 0) hemTeeth(tpts, outHem[0], inHem[0], hemY, 4, o.hem, 3);
      else {
        hemTeeth(tpts, inHem[0], outHem[0], hemY, 4, o.hem, 3);
        tpts.reverse();
      }
      pts.push(...tpts, inHem, [cx + sm * 6, cy]);
      polyT(f, q, pts, FUR_FAR.M);
    }
  } else {
    // cover: the back is to the viewer — the cloak hangs over the whole torso
    const pts: Pt[] = [[cx - 13 * L.sw, cy - 11], [cx + 13 * L.sw, cy - 11], [cx + 18 * L.sw, cy - 4], [cx + (19 + sway * 0.4) * L.sw, hemY]];
    const tpts: Pt[] = [];
    hemTeeth(tpts, cx - (19 - sway * 0.4) * L.sw, cx + (19 + sway * 0.4) * L.sw, hemY, 8, o.hem, 3);
    tpts.reverse();
    pts.push(...tpts, [cx - (19 - sway * 0.4) * L.sw, hemY], [cx - 18 * L.sw, cy - 4]);
    polyT(f, q, pts, FUR.M);
  }
  const t = L.back ? FUR : { ...FUR_FAR, L: FUR.L };
  // fur: lit band toward the light, shade band away, and vertical tuft grooves (≥ 2 px apart, on the mid / shade only)
  const ls = f.light.side;
  planes(q, (x, y, src) => {
    let toL = 0;
    while (toL < 4 && src.isOpaque(x + ls * (toL + 1), y)) toL++;
    let up = 0;
    while (up < 2 && src.isOpaque(x, y - up - 1)) up++;
    if (toL < 3 || up < 1) return t.L;
    let away = 0;
    while (away < 3 && src.isOpaque(x - ls * (away + 1), y)) away++;
    let dn = 0;
    while (dn < 2 && src.isOpaque(x, y + dn + 1)) dn++;
    if (away < 2 || dn < 1) return t.S;
    const g = (x - rnd(o.hem * 2) + (y >> 2)) % 5;
    if (g === 0 && y > cy - 4) return t.S;
    return t.M;
  });
  f.comp.add(q, Part.cloak, { out: t.D });
}

// ---------------------------------------------------------------- legs, belt

function paintLegs(f: Frame): void {
  const { sk } = f;
  const leg = (Hp: Pt, K: Pt, A: Pt, far: boolean) => {
    const part = far ? Part.legF : Part.legN;
    const wool = far ? WOOL_FAR : WOOL;
    const hide = far ? { L: HIDE.M, M: HIDE.S, S: HIDE.S, D: PAL.ink } : HIDE;
    const fur = far ? FUR_FAR : FUR;
    // thick thigh (breeches) and shin
    limb(f, Hp, K, 9, 8, wool, part, PAL.ink, 2, 2);
    const sh1: Pt = [lerp(K[0], A[0], 0.05), lerp(K[1], A[1], 0.05)];
    limb(f, sh1, A, 8, 7, hide, part, PAL.ink, 2, 2);
    // fur cuff at the top of the boot wrap (teeth hang down)
    const cq = layer();
    const cy = lerp(K[1], A[1], 0.32);
    const cx = lerp(K[0], A[0], 0.32);
    const cuff: Pt[] = [[cx - 5, cy - 2], [cx + 5, cy - 2], [cx + 5.5, cy + 1], [cx + 4, cy + 3], [cx + 2.5, cy + 1.5], [cx + 1, cy + 3], [cx - 0.5, cy + 1.5], [cx - 2, cy + 3], [cx - 3.5, cy + 1.5], [cx - 5, cy + 2]];
    polyT(f, cq, cuff, fur.M);
    bands(cq, fur, f.light, 2, 2);
    f.comp.add(cq, part, { out: fur.D });
    // boot: a heavy wrapped foot pointing right
    const bq = layer();
    const x = A[0];
    const y = A[1];
    polyT(f, bq, [[x - 5, y - 2], [x + 3, y - 2], [x + 7, y + 1], [x + 8, y + 4], [x - 5, y + 4]], hide.M);
    bands(bq, hide, f.light, 2, 1);
    f.comp.add(bq, part, { out: PAL.ink });
    // wrap bands across the boot (1-px seams, on the shade side only)
    for (const k of [0.55, 0.78]) {
      const yy = rnd(lerp(K[1], A[1], k));
      const xx = rnd(lerp(K[0], A[0], k));
      for (let dx = -3; dx <= 3; dx++) {
        const [px, py] = xf(f.T, [xx + dx, yy]);
        const X = rnd(px);
        const Y = rnd(py);
        if (f.comp.id[Y * W + X] === part && f.p.get(X, Y) === hide.M) f.p.set(X, Y, hide.S);
      }
    }
  };
  leg(sk.H2, sk.K2, sk.A2, true);
  leg(sk.H1, sk.K1, sk.A1, false);
}

function paintBelt(f: Frame): void {
  const { sk, o } = f;
  const mx = sk.L.mx;
  const [rx, ry] = sk.R;
  const sw = sk.L.sw;
  const q = layer();
  polyT(f, q, [[rx - 10 * sw, ry - 6], [rx + 10 * sw, ry - 6], [rx + 10 * sw, ry - 1], [rx - 10 * sw, ry - 1]], HIDE.M);
  bands(q, HIDE, f.light, 1, 1);
  f.comp.add(q, Part.belt, { out: PAL.ink });
  if (!sk.L.back) {
    // the front hide flap and a stone buckle
    const fl = layer();
    const bx = rx + 2 * mx;
    const sway = rnd(o.cape * 0.3);
    polyT(f, fl, [[bx - 3, ry - 2], [bx + 3, ry - 2], [bx + 3 + sway, ry + 7], [bx + sway, ry + 9], [bx - 3 + sway, ry + 7]], FUR.M);
    bands(fl, FUR, f.light, 1, 1);
    f.comp.add(fl, Part.belt, { out: FUR.D });
    const bk = layer();
    polyT(f, bk, [[bx - 2, ry - 6], [bx + 2, ry - 6], [bx + 2, ry - 1], [bx - 2, ry - 1]], ROCK.M);
    bands(bk, ROCK, f.light, 1, 1);
    f.comp.add(bk, Part.belt, { out: PAL.ink });
  }
}

// ---------------------------------------------------------------- torso, mantle, beard

const TORSO: readonly (readonly [number, number])[] = [
  [-14, -10], [-7, -12], [7, -12], [14, -10], [17, -5], [15, 2], [10, 11], [-8, 11], [-13, 3], [-16, -4],
];

/** Dark red-brown leather jerkin (the skin ramp's dark end: never read as skin — it sits between the lit arms). */
const LEATHER: Tones = { L: PAL.skin1, M: PAL.skin0, S: PAL.skin0, D: PAL.ink };
/** The chest inside the jerkin's opening: in the shadow of the beard and the leather (one step down from the arms). */
const SKIN_IN: Tones = { L: PAL.skin3, M: PAL.skin2, S: PAL.skin1, D: PAL.skin0 };

function paintTorso(f: Frame): void {
  const { sk } = f;
  const L = sk.L;
  const mx = L.mx;
  const C = sk.C;
  if (L.back) return; // the cloak covers it
  const q = layer();
  polyT(f, q, loc(C, mx, TORSO, L.sw), LEATHER.M);
  bands(q, LEATHER, f.light, 4, 2, { top: 1, bottom: 1 });
  f.comp.add(q, Part.torso, { out: PAL.ink });
  // the open V of the jerkin: the chest skin from the collar down to the belt (the beard hangs over its top)
  const v = layer();
  const vx = L.head === 'front' ? 0 : L.head === 'side' ? 9 : 4;
  const vw = L.head === 'side' ? 3 : 5.5;
  polyT(f, v, loc(C, mx, [[vx - vw, -12], [vx + vw + 1, -12], [vx + 2, 7], [vx, 9], [vx - 1.5, 7]], L.sw), SKIN_IN.M);
  bands(v, SKIN_IN, f.light, 2, 2, { top: 0, bottom: 2 });
  // the pec crease and the sternum groove (one ramp step darker, IŞ-5)
  planes(v, (x, y, src) => {
    const [bx, by] = xfInv(f.T, x, y);
    const lx = (bx - C[0]) * mx / L.sw - vx;
    const ly = by - C[1];
    if (Math.abs(ly - 1) < 0.6 && Math.abs(lx) > 0.5) return src.get(x, y) === SKIN_IN.S ? SKIN_IN.D : SKIN_IN.S;
    if (Math.abs(lx - 0.3) < 0.6 && ly > 2) return SKIN_IN.S;
    return null;
  });
  f.comp.add(v, Part.torso, { out: PAL.skin0 });
  // lacing: three 1-px crosses across the V
  for (const ly of [2, 5]) {
    for (const dx of [-1, 1]) {
      const [x, y] = xf(f.T, [C[0] + (vx + dx) * mx * L.sw, C[1] + ly + (dx < 0 ? 0 : 1)]);
      const X = rnd(x);
      const Y = rnd(y);
      if (f.comp.id[Y * W + X] === Part.torso) f.p.set(X, Y, PAL.earth1);
    }
  }
}

function paintMantle(f: Frame): void {
  const { sk, o } = f;
  const L = sk.L;
  const mx = L.mx;
  const [cx, cy0] = sk.C;
  const cy = cy0 - 1 + o.shr + o.mant;
  const sw = L.sw;
  const q = layer();
  // a thick fur collar over both shoulders: ≥ 2-px teeth along the lower edge
  const top = cy - 15;
  const pts: Pt[] = [[cx - 17 * sw, cy - 8], [cx - 13 * sw, top + 1], [cx - 5 * sw, top], [cx + 6 * sw, top], [cx + 14 * sw, top + 1], [cx + 19 * sw, cy - 8]];
  const tt: Pt[] = [];
  hemTeeth(tt, cx - 17 * sw, cx + 19 * sw, cy - 7, 8, o.hem * 2, 2);
  tt.reverse();
  // the lower edge dips in front of the chest (the opening under the beard): shallower in the middle
  const lower = tt.map(([x, y]) => [x, y - (L.back ? 0 : Math.max(0, 2.5 - Math.abs(x - (cx + 3 * mx)) / 4))] as Pt);
  pts.push(...lower);
  polyT(f, q, pts, FUR.M);
  const ls = f.light.side;
  planes(q, (x, y, src) => {
    let toL = 0;
    while (toL < 3 && src.isOpaque(x + ls * (toL + 1), y)) toL++;
    let up = 0;
    while (up < 3 && src.isOpaque(x, y - up - 1)) up++;
    if (up < 2 || toL < 2) return FUR.L;
    let dn = 0;
    while (dn < 2 && src.isOpaque(x, y + dn + 1)) dn++;
    if (dn < 2) return FUR.S;
    let away = 0;
    while (away < 3 && src.isOpaque(x - ls * (away + 1), y)) away++;
    if (away < 2) return FUR.S;
    // lit tufts: 2-px earth3 flecks in the mid plane, sparse
    if (((x >> 1) + (y >> 1) * 3) % 7 === 0 && up < 4) return FUR.L;
    return FUR.M;
  });
  f.comp.add(q, Part.mantle, { out: FUR.D });
}

/** Beard layouts in head-local px (facing right): the mass over the jaw and the braids (start x, start y, length). */
const BEARDS: Record<'r34' | 'side' | 'front' | 'back34', { mass: (readonly [number, number])[]; braids: [number, number, number][] }> = {
  r34: { mass: [[-1.5, -2], [0.5, -1], [3, 0], [7.5, 0], [8, 2], [7, 5], [5, 7], [1, 7], [-1.5, 3]], braids: [[1.5, 5, 9], [5, 5, 8]] },
  side: { mass: [[0, -2], [2, -1], [4, 0], [8.5, 0], [9, 2], [8, 5], [6, 7], [2, 7], [0, 3]], braids: [[3, 5, 9], [6.5, 5, 8]] },
  front: { mass: [[-6, -2], [-4, 0], [4, 0], [6, -2], [6.5, 3], [4, 7], [-4, 7], [-6.5, 3]], braids: [[-2.5, 5, 9], [2.5, 5, 9]] },
  back34: { mass: [[4, 1], [6.5, 1], [7, 4], [5, 6]], braids: [[5.5, 4, 7]] },
};

function paintBeard(f: Frame): void {
  const { sk, o } = f;
  const L = sk.L;
  if (L.head === 'back') return;
  const front = L.head === 'front';
  const mx = front ? 1 : L.mx;
  const [hx, hy] = sk.Hd;
  const B = BEARDS[L.head];
  const q = layer();
  // the beard mass over the jaw (moustache to chin), then the braids onto the chest; beads (2×2) swing by `bead`
  polyT(f, q, loc([hx, hy], mx, B.mass), BEARD.M);
  for (const [dx, y0, len] of B.braids) {
    const x0 = hx + dx * mx;
    const sw = o.bead * (len / 9);
    const path = spline([[x0, hy + y0], [x0 + sw * 0.4, hy + y0 + len * 0.5], [x0 + sw, hy + y0 + len]], 4);
    polyT(f, q, ribbon(path, (k) => lerp(3.6, 2.6, k)), BEARD.M);
  }
  bands(q, BEARD, f.light, 1, 1, { top: 1, bottom: 1 });
  // braid weave: a dark nick every 3 rows on the braids (mid plane only)
  planes(q, (x, y, src) => {
    const [, by] = xfInv(f.T, x, y);
    const c = src.get(x, y);
    if (c === BEARD.M && (rnd(by - hy) % 3 === 0) && by > hy + 7) return BEARD.S;
    return null;
  });
  f.comp.add(q, Part.beard, { out: BEARD.D });
  // stone beads
  for (const [dx, y0, len] of B.braids) {
    const x0 = hx + dx * mx + o.bead * (len / 9);
    const bq = layer();
    const [X, Y] = xf(f.T, [x0, hy + y0 + len + 1]);
    bq.rect(rnd(X) - 1, rnd(Y) - 1, 2, 2, PAL.stone3);
    bq.set(rnd(X) - 1 + (f.light.side < 0 ? 0 : 1), rnd(Y) - 1, PAL.stone4);
    f.comp.add(bq, Part.beard, { out: PAL.ink });
  }
  // the open mouth (nara): a dark hole in the beard under the moustache
  if (o.mouth > 0 && L.head !== 'back34') {
    const pts: [number, number][] = front ? [[-1, 2], [0, 2], [1, 2], [-1, 3], [0, 3], [1, 3], [0, 4]] : [[4, 2], [5, 2], [6, 2], [4, 3], [5, 3], [5, 4]];
    for (const [lx, ly] of pts) {
      const [x, y] = xf(f.T, [hx + lx * mx, hy + ly]);
      f.p.set(rnd(x), rnd(y), ly === 3 ? PAL.skin0 : PAL.ink);
    }
  }
}

// ---------------------------------------------------------------- head

function paintHead(f: Frame): void {
  const { sk, o } = f;
  const L = sk.L;
  const mx = L.mx;
  const [hx, hy] = sk.Hd;
  const mode = L.head;
  const front = mode === 'front';
  const q = layer();
  // skull: a blunt block, the jaw hidden by the beard; the neck roll shifts the crown a px (tilt)
  const tl = o.tilt;
  const shape: [number, number][] = front
    ? [[-4 + tl, -8], [4 + tl, -8], [6, -6], [6, 2], [4, 4], [-4, 4], [-6, 2], [-6, -6]]
    : mode === 'side'
      ? [[-4 + tl, -8], [2 + tl, -8], [5, -6], [6, -3], [8, -1], [7, 0.5], [6, 2], [5, 4], [-3, 4], [-6, 1], [-6, -5]]
      : [[-4 + tl, -8], [2 + tl, -8], [5, -6], [6, -3], [7.5, -1], [6.5, 0.5], [6, 2], [5, 4], [-3, 4], [-6, 1], [-6, -5]];
  polyT(f, q, loc([hx, hy], front ? 1 : mx, shape), SKIN.M);
  bands(q, SKIN, f.light, 2, 2, { top: 1, bottom: 2 });
  // hair: shaved crown with a dark band at the back, a top-knot (back views: all hair)
  const hairT: Tones = { L: PAL.earth1, M: PAL.earth0, S: PAL.earth0, D: PAL.ink };
  const isHair = (lx: number, ly: number): boolean => {
    if (mode === 'back') return ly < 2 && Math.abs(lx) < 3.5 - ly * 0.3;
    if (mode === 'back34') return lx < 2 && ly < 1 && lx > -5 - ly;
    if (front) return ly < -6 && Math.abs(lx) < 2;
    return lx < -2 && lx > -5 && ly < -3;
  };
  const src = q.clone();
  planes(q, (x, y) => {
    const [bx, by] = xfInv(f.T, x, y);
    const lx = (bx - hx) * (front ? 1 : mx);
    const ly = by - hy;
    if (isHair(lx, ly)) return src.get(x, y) === SKIN.L ? hairT.L : hairT.M;
    return null;
  });
  f.comp.add(q, Part.head, { out: SKIN.D });
  // top-knot: a tuft tied with a stone ring at the back of the crown
  const kq = layer();
  const kx = hx + (front ? 0 : -2 * mx) + tl;
  polyT(f, kq, [[kx - 1.5, hy - 7], [kx + 1.5, hy - 7], [kx + 1, hy - 10], [kx - 1 - 2 * mx, hy - 12], [kx - 2, hy - 10]], PAL.earth0);
  f.comp.add(kq, Part.head, { out: PAL.ink });
  const rq = layer();
  polyT(f, rq, [[kx - 1.5, hy - 10], [kx + 1.5, hy - 10], [kx + 1.5, hy - 9], [kx - 1.5, hy - 9]], PAL.stone3);
  f.comp.add(rq, Part.head, { out: PAL.ink });
  // face features (frame pixels; eyes and paint are collected for the light pass)
  const at = (lx: number, ly: number): Pt => {
    const p = xf(f.T, [hx + lx * (front ? 1 : mx), hy + ly]);
    return [rnd(p[0]), rnd(p[1])];
  };
  const brow = (lx: number) => {
    const [x, y] = at(lx, -3);
    if (f.comp.id[y * W + x] === Part.head) f.p.set(x, y, SKIN.D);
  };
  if (mode === 'r34' || mode === 'side' || front) {
    const eyesX = front ? [-2, 2] : mode === 'side' ? [5] : [4];
    for (const ex of eyesX) {
      brow(ex - (front && ex < 0 ? 1 : 0));
      brow(ex + (front ? (ex < 0 ? 0 : 1) : 1));
      if (!front) brow(ex + 2);
      f.eyes.push(at(ex, -2));
      const [ux, uy] = at(ex, -1);
      if (f.comp.id[uy * W + ux] === Part.head) f.p.set(ux, uy, SKIN.S);
    }
    const stripes = front ? [-1, 1] : mode === 'side' ? [2, 4] : [1, 3];
    for (const sx of stripes) for (let ly = -7; ly <= -4; ly++) f.paint.push(at(sx, ly));
  }
  if (mode === 'back34') {
    // the ear on the cheek edge
    for (const [lx, ly] of [[4, -1], [4, 0]] as const) {
      const [x, y] = at(lx, ly);
      if (f.comp.id[y * W + x] === Part.head) f.p.set(x, y, SKIN.S);
    }
  }
}

// ---------------------------------------------------------------- arms

function paintArm(f: Frame, far: boolean, part: Part): void {
  const { sk } = f;
  const S = far ? sk.Sf : sk.Sn;
  const E = far ? sk.Ef : sk.En;
  const Hh = far ? sk.Hf : sk.Hn;
  const t = far ? SKIN_FAR : SKIN;
  // shoulder ball, upper arm (thick), forearm with a leather bracer
  const sep = far ? t.D : PAL.ink;
  limb(f, S, E, 9, 8, t, part, sep, 2, 2);
  limb(f, E, Hh, 8, 6.5, t, part, sep, 2, 2);
  const b0: Pt = [lerp(E[0], Hh[0], 0.35), lerp(E[1], Hh[1], 0.35)];
  const b1: Pt = [lerp(E[0], Hh[0], 0.82), lerp(E[1], Hh[1], 0.82)];
  const hide = far ? { L: HIDE.M, M: HIDE.S, S: HIDE.S, D: PAL.ink } : HIDE;
  limb(f, b0, b1, 8, 7, hide, part, PAL.ink, 1, 1);
}

function paintFist(f: Frame, far: boolean): void {
  const { sk } = f;
  const Hh = far ? sk.Hf : sk.Hn;
  const t = far ? SKIN_FAR : SKIN;
  const q = layer();
  discT(f, q, Hh, 3.3, t.M);
  bands(q, t, f.light, 2, 1);
  f.comp.add(q, Part.fist, { out: far ? t.D : PAL.ink });
}

// ---------------------------------------------------------------- the axe

/** Axe head outline in (u along the haft from the head centre, v toward the edge). */
/** The crescent: an outer arc (centre (0, BC), radius BR) whose horns curl back past the haft line, and two concave cheeks. */
const BC = 2;
const BRAD = 9.5;
const BLADE_PTS: readonly (readonly [number, number])[] = (() => {
  const pts: [number, number][] = [];
  for (let a = -112; a <= 112; a += 14) pts.push([BRAD * Math.sin(a * DEG), BC + BRAD * Math.cos(a * DEG)]);
  pts.push([7.4, 0.4], [5.4, 2.2], [3.3, 3], [2.2, 2], [-2.2, 2], [-3.3, 3], [-5.4, 2.2], [-7.4, 0.4]);
  return pts;
})();
const SOCKET: readonly (readonly [number, number])[] = [[-4, -3], [3, -3], [3.5, 2.5], [-4.5, 2.5]];
const POLL: readonly (readonly [number, number])[] = [[-3, -2], [-2.5, -5], [2, -5], [2.5, -2]];

function paintAxe(f: Frame, part: Part): void {
  const { sk, o } = f;
  // haft: from the butt through the grip to the socket
  const hq = layer();
  const top = axeUV(sk, 3, 0);
  polyT(f, hq, tube(sk.butt, top, 3.2), WOOD.M);
  bands(hq, WOOD, f.light, 1, 1);
  f.comp.add(hq, part, { out: WOOD.D });
  // vine wraps (3 bands of leaf, 2 px each) between the grip and the head
  for (const k of [-7, 6, 9.5]) {
    const c: Pt = [sk.G[0] + sk.dir[0] * k, sk.G[1] + sk.dir[1] * k];
    const a: Pt = [c[0] - sk.dir[0], c[1] - sk.dir[1]];
    const b: Pt = [c[0] + sk.dir[0], c[1] + sk.dir[1]];
    const vq = layer();
    polyT(f, vq, tube(a, b, 3.8), PAL.leaf2);
    bands(vq, { L: PAL.leaf2, M: PAL.leaf2, S: PAL.leaf1, D: PAL.leaf0 }, f.light, 1, 1, { top: 0, bottom: 1 });
    f.comp.add(vq, part, { out: PAL.leaf0 });
  }
  if (o.hl * o.fore < 6) return;
  // the stone head: socket, poll, the crescent blade with flat carved facets
  const sq = layer();
  polyT(f, sq, SOCKET.map(([u, v]) => axeUV(sk, u, v)), ROCK.S);
  polyT(f, sq, POLL.map(([u, v]) => axeUV(sk, u, v)), ROCK.S);
  bands(sq, { L: ROCK.M, M: ROCK.S, S: ROCK.D, D: PAL.stone0 }, f.light, 1, 1);
  const bq = layer();
  polyT(f, bq, BLADE_PTS.map(([u, v]) => axeUV(sk, u, v)), ROCK.M);
  if (o.bury > 0) for (let y = GY + 1; y < H; y++) for (let x = 0; x < W; x++) { bq.erase(x, y); sq.erase(x, y); }
  // carved facets: the edge band (1 px stone4, three chip notches), a bevel band inside it, and the two flat cheeks split
  // along the ridge u = 0 (the cheek facing the light stone3, the other stone2)
  const n = sk.nrm;
  const d = sk.dir;
  const dl = d[0] * f.light.v2[0] + d[1] * f.light.v2[1];
  const nl = n[0] * f.light.v2[0] + n[1] * f.light.v2[1];
  planes(bq, (x, y) => {
    const [bx, by] = xfInv(f.T, x, y);
    const rx = bx - sk.axe[0];
    const ry = by - sk.axe[1];
    const u = rx * d[0] + ry * d[1];
    const v = rx * n[0] + ry * n[1];
    const r = Math.hypot(u, v - BC);
    const lit = u * dl > 0 ? 1 : 0;
    if (r > BRAD - 1.3 && v > BC - 1) {
      const chip = Math.abs(u + 4) < 0.7 || Math.abs(u - 2) < 0.6 || Math.abs(u - 6.5) < 0.6;
      return chip ? ROCK.D : ROCK.L;
    }
    if (r > BRAD - 2.8 && v > BC - 1) return lit ? ROCK.M : ROCK.S;
    if (Math.abs(u) < 0.7 && v > 4) return nl > 0 ? ROCK.L : ROCK.M;
    return lit ? ROCK.M : ROCK.S;
  });
  f.comp.add(sq, part, { out: PAL.stone0 });
  f.comp.add(bq, part, { out: PAL.stone0 });
}

// ---------------------------------------------------------------- the body (one placement)

function drawBody(f: Frame, withAxe: boolean): void {
  const { o, sk } = f;
  const L = sk.L;
  const twoHanded = o.fh > 0;
  // the axe behind the body (az < 0); in the back facings the arms reach away from the viewer too
  const axeBack = o.az < 0 && withAxe;
  const armsBack = L.back;
  if (axeBack) paintAxe(f, Part.axeBack);
  if (armsBack) {
    paintArm(f, true, Part.armF);
    paintArm(f, false, Part.armN);
    paintFist(f, true);
    paintFist(f, false);
  }
  if (L.cloak !== 'cover') paintCloak(f);
  if (!armsBack) {
    paintArm(f, true, Part.armF);
    if (!twoHanded) paintFist(f, true);
  }
  paintLegs(f);
  paintBelt(f);
  paintTorso(f);
  if (L.cloak === 'cover') paintCloak(f);
  paintMantle(f);
  if (o.az === 0 && withAxe) paintAxe(f, Part.axeBack);
  paintHead(f);
  paintBeard(f);
  if (!armsBack) {
    paintArm(f, false, Part.armN);
    if (o.az > 0 && withAxe) paintAxe(f, Part.axe);
    if (twoHanded) paintFist(f, true);
    paintFist(f, false);
  }
}

// ---------------------------------------------------------------- draw

function newFrame(p: PixelCanvas, o: Pose, light: Light, T: Xf): Frame {
  return { p, comp: new Comp(p), light, o, sk: skeleton(o), T, eyes: [], paint: [] };
}

function lightPass(f: Frame): void {
  const { p, o } = f;
  // eyes: white 1 px (shut = a skin1 lid line)
  for (const [x, y] of f.eyes) {
    if (o.eye <= 0.2) p.set(x, y, PAL.skin1);
    else p.set(x, y, PAL.white);
    if (o.eye > 1.5) p.set(x + 1, y, PAL.white);
  }
  // war paint: two 1×4 fire stripes (body accent), flashing to a fire4 / white light in hitMagic
  for (const [x, y] of f.paint) {
    if (f.comp.id[y * W + x] !== Part.head) continue;
    p.set(x, y, o.paint > 0.5 ? (o.paint > 1.5 ? PAL.white : PAL.fire4) : PAL.fire2);
  }
}

/** Light pixels on the axe edge: the one glint (IŞ-8). */
function glintPass(f: Frame): void {
  const { o, sk, p } = f;
  if (o.glint <= 0) return;
  const [x, y] = xf(f.T, axeUV(sk, -3, 11.5));
  const X = rnd(x);
  const Y = rnd(y);
  p.set(X, Y, PAL.white);
  if (o.glint > 1.5) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) p.set(X + dx, Y + dy, PAL.white);
}

/** The split death: one placement per half, masked by the body-space seam line; the axe stays planted. */
function drawHalves(p: PixelCanvas, o: Pose, light: Light): Frame {
  const gap = o.split;
  const tilt = o.tilt2 * DEG;
  const halves: { T: Xf; keep: (bx: number) => boolean }[] = [
    { T: { a: -tilt, px: AX - 9, py: GY, dx: -Math.floor(gap / 2), dy: 0 }, keep: (bx) => bx < SEAM_X },
    { T: { a: tilt, px: AX + 11, py: GY, dx: Math.ceil(gap / 2), dy: 0 }, keep: (bx) => bx >= SEAM_X },
  ];
  let last: Frame | null = null;
  for (const hv of halves) {
    const q = new PixelCanvas(W, H);
    const fr = newFrame(q, o, light, hv.T);
    drawBody(fr, false);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!q.isOpaque(x, y)) continue;
        const [bx] = xfInv(hv.T, x, y);
        if (!hv.keep(bx)) q.erase(x, y);
      }
    q.outline(PAL.ink);
    lightPass(fr);
    // the cut edge: light pours out of the seam (white core at the cut, earth4 lips one px in)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!q.isOpaque(x, y)) continue;
        const [bx, by] = xfInv(hv.T, x, y);
        const dd = Math.abs(bx - (SEAM_X - 0.5));
        if (by < GY - 62) continue;
        if (dd < 1.1) q.set(x, y, o.burn > 0 ? PAL.earth4 : PAL.white);
        else if (dd < 2.1 && q.get(x, y) !== PAL.ink) q.set(x, y, PAL.earth4);
      }
    if (o.burn > 0) burnPass(q, hv.T, o.burn, o.gather);
    p.blit(q, 0, 0);
    last = fr;
  }
  return last!;
}

export function drawAxeman(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right'): void {
  const light = lightOf(lightFrom);
  let f: Frame;
  if (o.split > 0 || o.tilt2 > 0) {
    // floor seam under the halves first (light on the floor, behind the bodies)
    f = drawHalves(p, o, light);
    // the planted axe in front
    const af = newFrame(new PixelCanvas(W, H), o, light, IDENT);
    if (o.bury >= 0 && o.hl > 0) {
      paintAxe(af, Part.axe);
      af.p.outline(PAL.ink);
      glintPass(af);
      p.blit(af.p, 0, 0);
    }
    f = { ...f, p, sk: af.sk, T: IDENT };
  } else {
    f = newFrame(p, o, light, IDENT);
    if (!o.hide) drawBody(f, true);
    if (o.bould > 0) boulderFx(f, true);
    p.outline(PAL.ink);
    if (!o.hide) {
      lightPass(f);
      glintPass(f);
    }
    if (o.bould > 0) boulderFx(f, false);
    if (o.seam > 0) seamFx(f);
    if (o.burn > 0) burnPass(p, IDENT, o.burn, o.gather);
  }
  if (o.gather) gatherFx(f);
  smearFx(f);
  floorSeamFx(f);
  sparkFx(f);
  chipFx(f);
  clodFx(f);
  dustFx(f);
}

export { clamp, hash2 };
