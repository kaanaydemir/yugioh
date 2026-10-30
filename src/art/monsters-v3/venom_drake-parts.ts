// Zehir Ejderi v3 — the PART PAINTERS (body tube, dorsal spikes, vestigial wing-fins, tail blade) and the
// light / matter effects (eye glint, venom in the maw, glowing spine, drip, spit, spray, splash). The head
// assembly is ./venom_drake-head.ts, the floor and the death / revive passes ./venom_drake-fx.ts.
// Pose fields reused from the serpent plan (docs in ./venom_drake-build.ts): fin.h / fin.ph = the dorsal
// spikes' height and ripple, crown = the vestigial wing-fins' spread (0 folded … 1 open), fan = the tail
// blade's spread.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { V } from '../rigkit/geom';
import { hash2 } from '../rigkit/passes/types';
import { SECTIONS, along, type SerpentRig, type TubeField } from './coral_serpent-plan';
import { paintBody, THROAT } from './venom_drake-body';
import { BUILD, TONES } from './venom_drake-build';
import { fangTip, headFrame, paintEye, paintGlint, paintMaw } from './venom_drake-head';
import type { Ctx, Part, Pose } from './venom_drake-types';

export type { Ctx, Part, Pose };
const [N0, G0, G1, G2, G3] = TONES.scale;
const BONE = TONES.bone;
const VENOM = TONES.venom;
type Pt = readonly [number, number];

// ------------------------------------------------------------------ the summon's mist body (fx.form / fx.skin)

/** Normalised place along the whole tube (0 the tail's tip … 1 the head's joint). */
function placeOf(rig: SerpentRig, s: number): number {
  const total = rig.len.tail + rig.len.front + rig.len.back + rig.len.neck;
  return (s + rig.len.tail) / Math.max(1, total);
}

/** The mist tones a hide tone turns into while the body is still toxic vapour. */
const MIST = new Map<number, number>([[N0, PAL.night1], [G0, PAL.night1], [G1, PAL.night2], [G2, PAL.leaf0], [G3, PAL.leaf1], [TONES.vein[0], PAL.leaf1], [TONES.vein[1], PAL.leaf2], [TONES.belly[0], PAL.night2], [TONES.belly[1], PAL.night2], [TONES.belly[2], PAL.leaf0]]);

interface BodyPaint { readonly canvas: PixelCanvas; readonly field: TubeField; readonly far: Uint8Array }
const bodyPaints = new WeakMap<SerpentRig, Map<string, BodyPaint>>();
const FAR_SECTION = SECTIONS.indexOf('back');

/** The whole tube, painted once per (rig, light, fx) and split by section between the two slots. */
function bodyOf(ctx: Ctx): BodyPaint {
  let m = bodyPaints.get(ctx.rig);
  if (!m) bodyPaints.set(ctx.rig, (m = new Map()));
  const fx = ctx.pose.fx;
  const key = `${ctx.light.from}|${fx.form}|${fx.skin}|${fx.glow}|${Math.floor(fx.flow)}`;
  const hit = m.get(key);
  if (hit) return hit;
  const c = new PixelCanvas(ctx.w, ctx.h);
  const f = paintBody(c, ctx.rig, ctx.light, { belly: BUILD.belly, vein: fx.glow });
  const far = new Uint8Array(ctx.w * ctx.h);
  for (let y = f.y0; y <= f.y1; y++)
    for (let x = f.x0; x <= f.x1; x++) {
      const i = y * f.w + x;
      const k = f.sec[i];
      if (k < 0) continue;
      far[i] = k === FAR_SECTION ? 1 : 0;
      if (fx.form >= 1 && fx.skin >= 1) continue;
      const u = placeOf(ctx.rig, f.s[i]);
      if (u > fx.form) {
        c.erase(x, y);
        continue;
      }
      if (fx.skin < 1 && u < 1 - fx.skin) {
        const col = c.get(x, y);
        // vapour: flat bands, with 2x2 wisps of venom light drifting through (never a per-pixel speckle)
        const wisp = hash2((x >> 1) + Math.floor(fx.flow), (y >> 1) - Math.floor(fx.flow / 2), 5) < 0.1;
        c.set(x, y, wisp ? PAL.leaf1 : MIST.get(col as number) ?? PAL.night2);
      }
    }
  const out: BodyPaint = { canvas: c, field: { ...f, sec: f.sec.slice(), s: f.s.slice(), v: f.v.slice(), r: f.r.slice(), nx: f.nx.slice(), ny: f.ny.slice(), nz: f.nz.slice() }, far };
  if (m.size > 3) m.clear();
  m.set(key, out);
  return out;
}

function bodyPart(layer: 'back' | 'body', wantFar: 0 | 1): Part {
  return {
    layer,
    seam: 'selout',
    paint(ctx) {
      const b = bodyOf(ctx);
      const c = ctx.canvas();
      const W = ctx.w;
      const f = b.field;
      for (let y = f.y0; y <= f.y1; y++)
        for (let x = f.x0; x <= f.x1; x++) {
          const i = y * W + x;
          if (f.sec[i] < 0 || b.far[i] !== wantFar) continue;
          const col = b.canvas.get(x, y);
          if (col !== null) c.set(x, y, col);
        }
      return c;
    },
  };
}
export const BACK = bodyPart('back', 1);
export const BODY = bodyPart('body', 0);

// ------------------------------------------------------------------ neck geometry helpers

const neckRadius = (rig: SerpentRig, s: number) => {
  const [r0, r1] = rig.radius.neck;
  return r0 + (r1 - r0) * Math.pow(Math.max(0, Math.min(1, s / (rig.len.neck || 1))), rig.build.neck.taper);
};

/** A point on the neck's dorsal contour at arc length s (px from the neck's root), with the outward (dorsal) normal and the head-ward tangent. */
function dorsalAt(rig: SerpentRig, s: number): { p: V; n: V; t: V } {
  const a = along(rig.neck, s);
  const t = a.t;
  const n: V = [t[1], -t[0]]; // the ventral side is (−t.y, t.x): dorsal is its opposite
  const r = neckRadius(rig, s);
  return { p: [a.p[0] + n[0] * (r - 0.4), a.p[1] + n[1] * (r - 0.4)], n, t };
}

// ------------------------------------------------------------------ dorsal spikes

const SPIKE = { from: 5, step: 5, last: 8 };

interface Spike { base: V; tip: V; w: V }
function spikesOnNeck(rig: SerpentRig, scale: number, ph: number): Spike[] {
  const out: Spike[] = [];
  const L = rig.len.neck;
  for (let s = SPIKE.from; s < L - SPIKE.last; s += SPIKE.step) {
    const d = dorsalAt(rig, s);
    const bell = Math.sin((Math.PI * (s - 2)) / L);
    const ripple = 1 + 0.05 * Math.sin(2 * Math.PI * (s / 15 - ph));
    const h = Math.max(2.5, (3.6 + 3.6 * bell) * scale * ripple);
    // the spike leans back toward the tail
    const dir: V = [d.n[0] * 0.8 - d.t[0] * 0.6, d.n[1] * 0.8 - d.t[1] * 0.6];
    const l = Math.hypot(dir[0], dir[1]) || 1;
    out.push({ base: d.p, tip: [d.p[0] + (dir[0] / l) * h, d.p[1] + (dir[1] / l) * h], w: [d.t[0] * 2, d.t[1] * 2] });
  }
  return out;
}

export const SPIKES: Part = {
  layer: 'fin',
  seam: 'selout',
  paint(ctx) {
    const c = ctx.canvas();
    const rig = ctx.rig;
    const fin = ctx.pose.fin;
    if (ctx.pose.fx.form < 1 || ctx.pose.fx.skin < 0.4) return c;
    const L = ctx.light;
    for (const sp of spikesOnNeck(rig, fin.h, fin.ph)) {
      const a: Pt = [sp.base[0] - sp.w[0], sp.base[1] - sp.w[1]];
      const b: Pt = [sp.base[0] + sp.w[0], sp.base[1] + sp.w[1]];
      const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const side = (a[0] - sp.tip[0]) * L.v[0] + (a[1] - sp.tip[1]) * L.v[1] > (b[0] - sp.tip[0]) * L.v[0] + (b[1] - sp.tip[1]) * L.v[1];
      c.poly([a, sp.tip, mid], side ? G2 : G0);
      c.poly([mid, sp.tip, b], side ? G0 : G2);
      if (Math.hypot(sp.tip[0] - sp.base[0], sp.tip[1] - sp.base[1]) > 2.6) c.set(Math.round(sp.tip[0]), Math.round(sp.tip[1]), BONE[3]);
    }
    // the tail's small spikes along its upper side
    const T = rig.tail;
    for (let i = 3; i < T.length - 2; i += 2) {
      const p = T[i];
      const h = 2 - i / T.length;
      c.poly([[p[0] - 1, p[1] - 0.5], [p[0] + 0.5, p[1] - h * 1.1 - 0.5], [p[0] + 1.2, p[1] - 0.5]] as Pt[], G2);
    }
    return c;
  },
};

// ------------------------------------------------------------------ vestigial wing-fins

/**
 * The wing-fin: a short bone arm off the shoulder (the neck's dorsal contour about 12 px up), its wrist and
 * three finger-ribs with a dark membrane between them. crown 0 = folded back against the neck, 1 = a half fan.
 */
export const WINGS: Part = {
  layer: 'crown',
  seam: 'none',
  paint(ctx) {
    const c = ctx.canvas();
    const rig = ctx.rig;
    if (ctx.pose.fx.form < 1 || ctx.pose.fx.skin < 0.5) return c;
    const sp = Math.max(0, Math.min(1.2, ctx.pose.crown));
    const d = dorsalAt(rig, 20);
    const back: V = [-d.t[0], -d.t[1]];
    const P = (b: number, h: number): Pt => [d.p[0] + back[0] * b + d.n[0] * h, d.p[1] + back[1] * b + d.n[1] * h];
    const k = 0.9 + 0.5 * sp;
    const wrist = P(3.5 * k, 5.5 * k);
    const elbow = P(1.5, 3.2 * k);
    const tips: Pt[] = [P((6.5 + 4 * sp) * k, (6 + 2.4 * sp) * k), P((8 + 3 * sp) * k, (3 + 3 * sp) * k), P((6.5 + 1 * sp) * k, (0.6 + 1.6 * sp) * k)];
    const root = P(0.4, 0);
    c.poly([root, wrist, ...tips, P(2.4, -0.3)], G2);
    c.poly([root, wrist, tips[2], P(2.4, -0.3)], G1);
    const r = (v: number) => Math.round(v);
    for (let i = 0; i < tips.length; i++) {
      c.line(r(wrist[0]), r(wrist[1]), r(tips[i][0]), r(tips[i][1]), BONE[3]);
      c.set(r(tips[i][0]), r(tips[i][1]), BONE[4]);
    }
    c.line(r(root[0]), r(root[1]), r(elbow[0]), r(elbow[1]), BONE[2]);
    c.line(r(elbow[0]), r(elbow[1]), r(wrist[0]), r(wrist[1]), BONE[3]);
    c.line(r(tips[0][0]), r(tips[0][1]), r(tips[1][0]), r(tips[1][1]), G3);
    c.line(r(tips[1][0]), r(tips[1][1]), r(tips[2][0]), r(tips[2][1]), G3);
    return c;
  },
};

// ------------------------------------------------------------------ tail blade

export const BLADE: Part = {
  layer: 'fan',
  seam: 'selout',
  paint(ctx) {
    const c = ctx.canvas();
    const rig = ctx.rig;
    if (ctx.pose.fx.form < 0.2) return c;
    const tip = rig.tailTip;
    const nx = rig.tail[1][0] - tip[0];
    const ny = rig.tail[1][1] - tip[1];
    const l = Math.hypot(nx, ny) || 1;
    const dx = -nx / l;
    const dy = -ny / l;
    const px = -dy;
    const py = dx;
    const spread = 1 + 0.35 * ctx.pose.fan;
    const at = (a: number, b: number): Pt => [tip[0] + dx * a + px * b * spread, tip[1] + dy * a + py * b * spread];
    const L = ctx.light;
    const lit = px * L.v[0] + py * L.v[1] > 0;
    c.poly([at(-2.2, 0.5), at(0.5, 2.6), at(3, 0.8), at(5.6, 0), at(3, -0.8), at(0.5, -2.6), at(-2.2, -0.5)], BONE[2]);
    c.poly([at(-2.2, 0.5), at(0.5, 2.6), at(3, 0.8), at(5.6, 0), at(-1, 0)], lit ? BONE[3] : BONE[1]);
    c.poly([at(-2.2, -0.5), at(0.5, -2.6), at(3, -0.8), at(5.6, 0), at(-1, 0)], lit ? BONE[1] : BONE[3]);
    const q = at(5.6, 0);
    c.set(Math.round(q[0]), Math.round(q[1]), BONE[4]);
    return c;
  },
};

// ------------------------------------------------------------------ the eye (with the skull) and the light

export const EYE: Part = {
  layer: 'head',
  seam: 'none',
  paint(ctx) {
    if (ctx.pose.fx.form < 0.9) return null;
    const c = ctx.canvas();
    paintEye(c, ctx.rig, ctx.pose.fx);
    return c;
  },
};

export const GLOW: Part = {
  layer: 'glow',
  seam: 'none',
  paint(ctx) {
    const c = ctx.canvas();
    const rig = ctx.rig;
    const fx = ctx.pose.fx;
    if (fx.form < 1 || fx.skin < 1) {
      if (fx.eye > 0 && fx.form >= 0.9) paintGlint(c, rig, fx.glint);
      return c;
    }
    paintMaw(c, rig, fx.maw);
    paintGlint(c, rig, fx.glint);
    // the spikes' glow: a venom pixel at the base of every spike (hot when fx.glow >= 1.5)
    if (fx.glow > 0.05) {
      const col = fx.glow >= 1.5 ? VENOM[3] : fx.glow >= 0.5 ? VENOM[2] : VENOM[0];
      for (const sp of spikesOnNeck(rig, ctx.pose.fin.h, ctx.pose.fin.ph)) {
        const b: V = [sp.base[0] + (sp.tip[0] - sp.base[0]) * 0.28, sp.base[1] + (sp.tip[1] - sp.base[1]) * 0.28];
        c.set(Math.round(b[0]), Math.round(b[1]), col);
      }
    }
    return c;
  },
};

// ------------------------------------------------------------------ matter: the fang's drop, the spit, the spray, the splash

const GRAVITY = 24;
/** a >= 2-px venom cluster (a leaf3 body with a leaf4 glint), never a lone pixel */
function drop(c: PixelCanvas, x: number, y: number, big = false): void {
  const px = Math.round(x);
  const py = Math.round(y);
  c.set(px, py, VENOM[2]);
  c.set(px, py + 1, VENOM[1]);
  if (big) {
    c.set(px + 1, py, VENOM[2]);
    c.set(px + 1, py + 1, VENOM[1]);
    c.set(px, py, VENOM[3]);
  }
}

const SPRAY: readonly { readonly from: V; readonly v: V }[] = [
  { from: [14, 4], v: [14, -12] }, { from: [16, 5], v: [16, 0] }, { from: [11, 4], v: [10, 12] }, { from: [18, 3], v: [18, -6] }, { from: [8, 5], v: [6, 16] },
];
const SPLASH: readonly { readonly from: V; readonly v: V }[] = [
  { from: [4, -3], v: [-18, -14] }, { from: [10, -4], v: [-8, -22] }, { from: [16, 0], v: [14, -16] }, { from: [6, 3], v: [-22, 4] },
];

export const MATTER: Part = {
  layer: 'glow',
  seam: 'none',
  paint(ctx) {
    const c = ctx.canvas();
    const rig = ctx.rig;
    const fx = ctx.pose.fx;
    if (fx.form < 1 || fx.skin < 1) return c;
    if (fx.drip > 0 && fx.drip < 1) {
      const tip = fangTip(rig);
      const p = fx.drip;
      if (p < 0.34) {
        const y = Math.round(tip[1]) + 1;
        c.set(Math.round(tip[0]), y, VENOM[2]);
        if (p > 0.18) c.set(Math.round(tip[0]), y + 1, VENOM[1]);
      } else {
        const fall = ((p - 0.34) / 0.66) * 9;
        drop(c, tip[0], tip[1] + 2 + fall * fall * 0.12 + fall * 0.5);
      }
    }
    const mouth = rig.mouth;
    if (fx.spit > 0) {
      const ang = Math.atan2(rig.upperTip[1] - rig.hinge[1], rig.upperTip[0] - rig.hinge[0]) + rig.jawA * 0.4;
      const len = 2 + 3 * fx.spit;
      for (let i = 0; i < len; i++) {
        const x = mouth[0] + Math.cos(ang) * (1 + i);
        const y = mouth[1] + Math.sin(ang) * (1 + i);
        c.set(Math.round(x), Math.round(y), i < 2 ? VENOM[3] : VENOM[2]);
        if (i < len * 0.5) c.set(Math.round(x), Math.round(y) + 1, VENOM[1]);
      }
      drop(c, mouth[0] + Math.cos(ang) * (len + 1), mouth[1] + Math.sin(ang) * (len + 1), true);
    }
    const F = headFrame(rig);
    const spray = (table: readonly { from: V; v: V }[], p: number) => {
      if (p > 0.97) return;
      table.forEach((s, i) => {
        const t = p * 0.55 + i * 0.03;
        const o = F.at(s.from);
        drop(c, o[0] + s.v[0] * t, o[1] + s.v[1] * t + GRAVITY * t * t * 0.5, i % 2 === 0);
      });
    };
    if (fx.spray > 0) spray(SPRAY, fx.spray);
    if (fx.splash > 0) spray(SPLASH, fx.splash);
    return c;
  },
};
