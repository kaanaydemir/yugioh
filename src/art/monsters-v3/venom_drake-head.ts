// Zehir Ejderi v3 — THE HEAD ASSEMBLY on the serpent type: a faceted dragon head drawn per frame from
// polygons in HEAD-LOCAL space (x forward along the snout, y down, origin at the head joint) — every
// facet carries a local normal, so the planes follow the key light in every pose and in both views
// (P1 / the P2 relight) and turn with the head's tilt (pose.tilt, via rig.turn) and the jaw (rig.jawA).
// Parts: CROWN (the swept horns, behind the skull), JAW (the mouth's inside, the lower jaw, its tusks),
// HEAD (skull, brow, cheek, the upper fangs, the eye, the nostril), MAW (light slot: the venom glow in the
// open mouth and in the throat). The eye is a whole-pixel stamp (it never turns).
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { Light } from '../rigkit/light';
import type { V } from '../rigkit/geom';
import { SECTIONS, type SerpentRig } from './coral_serpent-plan';
import { HEAD_AXIS, JOINT, TONES, headRest, HEAD_LOCAL } from './venom_drake-build';
import type { Ctx, Part } from './venom_drake-types';

void SECTIONS;
const [N0, G0, G1, G2, G3] = TONES.scale;
const BONE = TONES.bone;
const HEAD_RAMP = [N0, G0, G1, G2];
const TH = [-0.3, 0.18, 0.54];
const A0 = (HEAD_AXIS * Math.PI) / 180;

type Pt = readonly [number, number];
interface Frame {
  /** head-local → frame px (posed: tilt, shift) */
  at(p: Pt, jaw?: boolean): V;
  /** local normal (x, y, z) → world n·L on this light */
  shade(n: readonly [number, number, number], light: Light, jaw?: boolean, bias?: number): number;
  theta: number;
}

/** The head's frame for a rig (rigid: turn about the rest joint, then the whole-px shift; the jaw turns about the hinge first). */
export function headFrame(rig: SerpentRig): Frame {
  const rj = rig.pivot;
  const ct = Math.cos(rig.turn);
  const st = Math.sin(rig.turn);
  const hx = HEAD_LOCAL.hinge[0];
  const hy = HEAD_LOCAL.hinge[1];
  const ja = Math.max(0, rig.jawA);
  const cj = Math.cos(ja);
  const sj = Math.sin(ja);
  const theta = A0 + rig.turn;
  return {
    theta,
    at(p, jaw = false) {
      let [lx, ly] = p;
      if (jaw) [lx, ly] = [hx + (lx - hx) * cj - (ly - hy) * sj, hy + (lx - hx) * sj + (ly - hy) * cj];
      const r = headRest(lx, ly);
      return [rj[0] + (r[0] - rj[0]) * ct - (r[1] - rj[1]) * st + rig.shift[0], rj[1] + (r[0] - rj[0]) * st + (r[1] - rj[1]) * ct + rig.shift[1]];
    },
    shade(n, light, jaw = false, bias = 0) {
      const a = theta + (jaw ? ja : 0);
      const nx = n[0] * Math.cos(a) - n[1] * Math.sin(a);
      const ny = n[0] * Math.sin(a) + n[1] * Math.cos(a);
      return nx * light.v[0] + ny * light.v[1] + n[2] * light.v[2] + light.lift + bias;
    },
  };
}

const toneAt = (ramp: readonly number[], I: number, th: readonly number[] = TH): number => {
  let k = 0;
  while (k < th.length && I >= th[k]) k++;
  return ramp[Math.min(k, ramp.length - 1)];
};

/** Fill a local polygon with the tone its normal gets. */
function facet(c: PixelCanvas, F: Frame, light: Light, pts: readonly Pt[], n: readonly [number, number, number], ramp: readonly number[], o: { jaw?: boolean; bias?: number; th?: readonly number[] } = {}): void {
  const I = F.shade(n, light, o.jaw, o.bias ?? 0);
  c.poly(pts.map((p) => F.at(p, o.jaw)) as Pt[], toneAt(ramp, I, o.th));
}

/** 1-px edge on the light-facing contour of a layer's lit facets (IŞ-8): the pixel whose lit-side neighbour is empty. */
function rim(c: PixelCanvas, light: Light, lit: readonly number[], tone: number): void {
  const sx = light.v2[0] < 0 ? -1 : 1;
  const hits: [number, number][] = [];
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      const col = c.get(x, y);
      if (col === null || !lit.includes(col)) continue;
      if (c.get(x, y - 1) === null || (c.get(x + sx, y) === null && c.get(x, y + 1) !== null)) hits.push([x, y]);
    }
  for (const [x, y] of hits) c.set(x, y, tone);
}

// ------------------------------------------------------------------ horns

/** A horn along a local spine: [x, y, half-width] samples, base → tip; the upper strip lit, the lower in shade. */
function horn(c: PixelCanvas, F: Frame, light: Light, spine: readonly (readonly [number, number, number])[], flare: number, dark = 0): void {
  const up: Pt[] = [];
  const dn: Pt[] = [];
  const mid: Pt[] = [];
  for (let i = 0; i < spine.length; i++) {
    const a = spine[Math.max(0, i - 1)];
    const b = spine[Math.min(spine.length - 1, i + 1)];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    const nx = -ty / l;
    const ny = tx / l;
    const [x, y, w] = spine[i];
    const k = flare * (i / (spine.length - 1)) * 1.4; // the flare swings the tip a little away from the skull
    up.push([x + nx * w - k * 0.3, y + ny * w - k]);
    dn.push([x - nx * w - k * 0.3, y - ny * w - k]);
    mid.push([x - k * 0.3, y - k]);
  }
  // the upper strip faces up / back (lit), the lower down (shade); the tip band (last third) takes the lightest tone
  facet(c, F, light, [...up, ...mid.slice().reverse()], [0, -0.75, 0.65], BONE.slice(0, 5), { th: [-0.35, 0.1, 0.45, 0.8], bias: -dark });
  facet(c, F, light, [...mid, ...dn.slice().reverse()], [0, 0.75, 0.65], BONE.slice(0, 5), { th: [-0.35, 0.1, 0.45, 0.8], bias: -dark });
}

export const HORN_MAIN: readonly (readonly [number, number, number])[] = [
  [2, -5, 2.8], [-2, -7.4, 2.6], [-6, -10, 2.2], [-10, -12, 1.7], [-14, -12.6, 1.1], [-17.5, -11.6, 0.5], [-19.5, -9.6, 0.1],
];
/** the far horn: shorter, behind the near one, one value darker */
export const HORN_FAR: readonly (readonly [number, number, number])[] = [
  [-1, -4.5, 2.2], [-5, -6, 2], [-9, -7, 1.5], [-13, -6.8, 0.9], [-16, -5.2, 0.2],
];
export const HORN_LOW: readonly (readonly [number, number, number])[] = [
  [-1.5, 1.8, 2.2], [-5, 2.8, 1.8], [-8.5, 4.6, 1.3], [-11.5, 7, 0.6], [-12.5, 9, 0.1],
];

export const CROWN: Part = {
  layer: 'crown',
  seam: 'selout',
  paint(ctx: Ctx) {
    const c = ctx.canvas();
    if (ctx.pose.fx.form < 0.9) return c;
    const F = headFrame(ctx.rig);
    horn(c, F, ctx.light, HORN_FAR, ctx.pose.crown, 0.35);
    horn(c, F, ctx.light, HORN_LOW, ctx.pose.crown * 0.5, 0.15);
    horn(c, F, ctx.light, HORN_MAIN, ctx.pose.crown);
    return c;
  },
};

// ------------------------------------------------------------------ the head

/** Upper head facets (head-local). */
export const TOP: readonly Pt[] = [[-4.5, -4], [-1, -6.4], [4, -6.8], [9, -5.4], [14, -3.8], [19, -2], [22.5, 0], [21.6, 1.2], [13, -0.6], [7, -1.6], [0, -1.6]];
export const FACE: readonly Pt[] = [[-5.5, -1.5], [0, -1.7], [7, -1.7], [13, -0.7], [21.6, 1.2], [22, 2.6], [14, 3.4], [6, 3.6], [0, 4.2], [-5, 4]];
export const BROW: readonly Pt[] = [[3, -3.6], [9.5, -3.9], [12, -2.8], [10.5, -1.4], [3.5, -1.8]];
export const JOWL: readonly Pt[] = [[-5.5, 1.5], [0, 3], [7, 3.4], [3.5, 5.4], [-1, 6], [-5.5, 4.8]];

/** Upper fangs (local tip positions): [root x, root y, tip x, tip y]. */
export const FANGS: readonly (readonly [number, number, number, number])[] = [
  [17.2, 2.4, 17.6, 7.6],
  [11.5, 3.2, 11.9, 7.2],
];
/** Lower tusks (jaw-local): [root x, root y, tip x, tip y]. */
const TUSKS: readonly (readonly [number, number, number, number])[] = [[19.2, 3.6, 19.6, -0.6]];

/** The posed local → frame position of the upper-front fang's tip (the venom drop hangs from it). */
export function fangTip(rig: SerpentRig): V {
  return headFrame(rig).at([FANGS[0][2], FANGS[0][3]]);
}

function fang(c: PixelCanvas, F: Frame, light: Light, f: readonly [number, number, number, number], jaw: boolean): void {
  const [rx, ry, tx, ty] = f;
  const w = 1.5;
  const dx = Math.sign(ty - ry) === 0 ? 0 : 0;
  void dx;
  const pts: Pt[] = [[rx - w, ry], [rx + w, ry], [tx, ty]];
  facet(c, F, light, pts, [0.2, 0, 1], [BONE[2], BONE[3], BONE[4]], { jaw, th: [0.2, 0.55] });
}

export const HEAD: Part = {
  layer: 'head',
  seam: 'selout',
  paint(ctx: Ctx) {
    const c = ctx.canvas();
    if (ctx.pose.fx.form < 0.9) return c;
    const F = headFrame(ctx.rig);
    const L = ctx.light;
    facet(c, F, L, FACE, [0, 0.05, 1], HEAD_RAMP);
    facet(c, F, L, JOWL, [0, 0.7, 0.7], HEAD_RAMP);
    facet(c, F, L, TOP, [0.1, -0.85, 0.5], HEAD_RAMP, { bias: 0.12 });
    facet(c, F, L, BROW, [0.3, 0.5, 0.8], HEAD_RAMP, { bias: -0.15 });
    rim(c, L, [G2], G3);
    // the upper fangs hang over the lower lip
    for (const f of FANGS) fang(c, F, L, f, false);
    // the closed mouth's gape line (a 1-px dark lip line from the hinge to the snout)
    if (ctx.rig.jawA < 0.05) {
      const a = F.at([3, 3.3]);
      const b = F.at([21, 2.4]);
      c.line(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), N0);
    }
    // a nostril slit near the snout tip and a cheek scale line (a darker crease, 2 px)
    const nose = F.at([19, -1]);
    c.set(Math.round(nose[0]), Math.round(nose[1]), N0);
    return c;
  },
};

/** The jaw: the mouth's inside, the lower jaw, its tusks. */
export const JAW: Part = {
  layer: 'jaw',
  seam: 'selout',
  paint(ctx: Ctx) {
    const c = ctx.canvas();
    if (ctx.pose.fx.form < 0.9) return c;
    const F = headFrame(ctx.rig);
    const L = ctx.light;
    const open = ctx.rig.jawA > 0.04;
    if (open) {
      // the gape: palate (dark) between the upper lip and the lower jaw's inside
      c.poly([F.at([2, 2.4]), F.at([21.5, 2.4]), F.at([20.5, 3.8], true), F.at([2, 3.8], true)] as Pt[], N0);
      // lower teeth on the jaw's top edge
      for (const x of [8, 13]) {
        const t = F.at([x, 3.3], true);
        c.set(Math.round(t[0]), Math.round(t[1]), BONE[4]);
        c.set(Math.round(t[0]), Math.round(t[1]) - 1, BONE[3]);
      }
    }
    // the lower jaw's outer plane (side), its underside, the chin
    facet(c, F, L, [[0, 3.6], [12, 3.4], [20.8, 3.6], [20.2, 5.8], [12, 6.4], [4, 7.4], [-1, 6.6]], [0, 0.3, 0.9], HEAD_RAMP, { jaw: true, bias: -0.08 });
    facet(c, F, L, [[-1, 6.4], [4, 7.2], [12, 6.2], [20.2, 5.8], [19.4, 7], [11.5, 7.6], [4, 8.6], [-1.5, 7.8]], [0, 0.85, 0.5], HEAD_RAMP, { jaw: true });
    rim(c, L, [G2], G3);
    for (const t of TUSKS) fang(c, F, L, t, true);
    return c;
  },
};

// ------------------------------------------------------------------ the eye (a whole-pixel stamp, never turned)

const EYE_FACE = (squint: number, eye: number): { rows: string[] } => {
  if (eye <= 0.01) return { rows: ['nnn', 'nnn'] };
  if (squint >= 0.8) return { rows: ['nnn', 'gGg'] };
  if (squint >= 0.4) return { rows: ['nnn', 'gpG', 'nnn'] };
  if (eye >= 1.5) return { rows: ['nnnn', 'gpGH', 'gpgG'] };
  return { rows: ['nnnn', 'gpGH', 'gpgg'] };
};

export const EYE_COLORS: Record<string, number> = { n: N0, g: TONES.eye[1], G: TONES.eye[2], p: N0, H: PAL.gold4 };

/** Stamp the eye at the rig's eye point. Returns its top-left px (for the glint). */
export function paintEye(c: PixelCanvas, rig: SerpentRig, fx: { eye: number; squint: number; glint: number }): void {
  const rows = EYE_FACE(fx.squint, fx.eye).rows;
  const ex = Math.round(rig.eye[0]) - 1;
  const ey = Math.round(rig.eye[1]) - 1;
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      c.set(ex + i, ey + j, EYE_COLORS[ch] ?? N0);
    }
  });
  // the brow's dark line above the eye (a 1-px shadow, wider when it narrows)
  if (fx.squint > 0.4) c.set(ex + 3, ey, N0);
}

/** The glint (light, after the outline): 1 px on the eye's white pixel, or the 3-px cross. */
export function paintGlint(c: PixelCanvas, rig: SerpentRig, glint: number): void {
  if (glint <= 0) return;
  const gx = Math.round(rig.eye[0]) + 1;
  const gy = Math.round(rig.eye[1]);
  c.set(gx, gy, PAL.white);
  if (glint >= 2) {
    c.set(gx + 1, gy, PAL.leaf4);
    c.set(gx, gy - 1, PAL.leaf4);
    c.set(gx, gy + 1, PAL.leaf4);
  }
}

/** Light: the venom glow in the open mouth (palate, throat, a hot core at the back). */
export function paintMaw(c: PixelCanvas, rig: SerpentRig, maw: number): void {
  if (maw <= 0.02 || rig.jawA <= 0.04) return;
  const F = headFrame(rig);
  const jawIn = (p: Pt) => F.at(p, true);
  const k = maw;
  // the glow fills the back half of the gape (throat to the middle of the tongue), a hot core at the root
  c.poly([F.at([4, 2.9]), F.at([13, 2.9]), jawIn([13, 3.5]), jawIn([4, 3.7])] as Pt[], k > 0.6 ? TONES.venom[1] : TONES.venom[0]);
  c.poly([F.at([4.5, 2.9]), F.at([9.5, 2.9]), jawIn([9.5, 3.5]), jawIn([4.5, 3.7])] as Pt[], k > 0.6 ? TONES.venom[2] : TONES.venom[1]);
  if (k > 0.85) {
    const t0 = jawIn([6, 3.4]);
    c.set(Math.round(t0[0]), Math.round(t0[1]), TONES.venom[3]);
  }
}

export { JOINT };
