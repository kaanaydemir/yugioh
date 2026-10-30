// Çelik Susturucu v3 — the PART PAINTERS (biped v1 slots).
//
// Rigid plates (hood, chest, abdomen, pelvis, shoulder drums, feet) are the role maps of
// ./steel_silencer-maps.ts moved by WHOLE pixels from the plan's solved joints (REHBER IŞ-12: nothing hard
// ever turns by a fraction of a pixel); the pistons (arms, legs, exhaust stacks) are band-shaded tubes
// drawn along the solved bones (steel_silencer-kit.ts), the forearm's rod telescoping out of its sleeve
// (fx.extN / extF) and ending in the silencing cone. Light (the visor eye, the chest sigil, the cones'
// lenses, the rings, the exhaust puffs) is drawn after the outline in the 'glow' / 'fx' slots and is
// never outlined (IŞ-9).

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import type { BipedPart, BipedPose, BipedRig } from '../bodyplans/biped/v1';
import { bipedNeutral, bipedRig } from '../bodyplans/biped/v1';
import type { PartCtx, PlanPose } from '../bodyplans/types';
import type { V } from '../rigkit/geom';
import { crumblePass, drawDebris, reassemblePass, type CrumbleStyle, type Debris } from '../rigkit/passes';
import { BUILD, type SilencerFx } from './steel_silencer-build';
import { ABDOMEN, CHEST, DRUM, FOOT, HOOD, PELVIS, SIGIL_AT, VISOR, toneOf, type RoleMap } from './steel_silencer-maps';
import { BRONZE_B, BRONZE_FAR, STEEL_B, STEEL_FAR, arc, crease, darker, disc, lightVec, tube } from './steel_silencer-kit';

export type Pose = PlanPose<BipedPose, SilencerFx>;
export type Ctx = PartCtx<Pose, BipedRig>;
export type Part = BipedPart<SilencerFx>;

/** The rig of the rest pose: every rigid part's displacement is measured from it. */
export const REST_RIG: BipedRig = bipedRig(BUILD, bipedNeutral(BUILD));
const rnd = Math.round;
const disp = (p: V, rest: V): V => [rnd(p[0] - rest[0]), rnd(p[1] - rest[1])];

export interface Places {
  hood: V;
  chest: V;
  abs: V;
  pelvis: V;
  drumN: V;
  drumF: V;
  footN: V;
  footF: V;
  stack: V;
}

/** The whole-pixel displacement of every rigid part this frame. */
export function placesOf(rig: BipedRig, fx: Readonly<SilencerFx>): Places {
  const r = REST_RIG;
  const ch = disp(rig.chest, r.chest);
  return {
    hood: ((d) => [d[0], d[1] + rnd(fx.hoodY)] as V)(disp(rig.head, r.head)),
    chest: [ch[0] + rnd(fx.chestX), ch[1] + rnd(fx.chestY)],
    abs: ((d) => [d[0], d[1] + rnd(fx.absY)] as V)(disp(rig.waist, r.waist)),
    pelvis: disp(rig.pelvis, r.pelvis),
    drumN: ((d) => [d[0], d[1] + rnd(fx.drumN)] as V)(disp(rig.shoulderN, r.shoulderN)),
    drumF: ((d) => [d[0], d[1] + rnd(fx.drumF)] as V)(disp(rig.shoulderF, r.shoulderF)),
    footN: disp(rig.footN, r.footN),
    footF: disp(rig.footF, r.footF),
    stack: [ch[0], ch[1] + rnd(fx.stackY)],
  };
}

/** px of a frame the summon's rise keeps under the floor: nothing is drawn below the ground line. */
function clipGround(q: PixelCanvas, ground: number): void {
  for (let y = ground; y < q.h; y++) for (let x = 0; x < q.w; x++) if (q.isOpaque(x, y)) q.erase(x, y);
}

/** Stamp a role map into `q` displaced by d (and by its own rest origin plus `at`). */
function stampRoles(q: PixelCanvas, m: RoleMap, d: V, right: boolean, at: V = [0, 0], tint?: (c: number) => number): void {
  m.rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const t = toneOf(row[i], right);
      if (t !== null) q.set(m.x + at[0] + d[0] + i, m.y + at[1] + d[1] + j, tint ? tint(t) : t);
    }
  });
}

const isRight = (ctx: Ctx) => ctx.light.from === 'right';

// ------------------------------------------------------------------ rigid parts

function plate(map: RoleMap, key: keyof Places, o: { layer: string; dy?: number } ): Part {
  return {
    layer: o.layer,
    seam: 'none',
    paint: (ctx) => {
      const d = placesOf(ctx.rig, ctx.pose.fx)[key];
      const q = ctx.canvas();
      stampRoles(q, map, [d[0], d[1] + (o.dy ?? 0)], isRight(ctx));
      crease(ctx.dst, q, ctx.light);
      clipGround(q, ctx.rig.ground);
      return q;
    },
  };
}

/** The shoulder drum of a side: the map centred on the shoulder joint, the far one a value darker. */
function drumPart(side: 'N' | 'F'): Part {
  return {
    layer: side === 'N' ? 'shoulderN' : 'shoulderF',
    seam: 'none',
    paint: (ctx) => {
      const sh = side === 'N' ? REST_RIG.shoulderN : REST_RIG.shoulderF;
      const d = placesOf(ctx.rig, ctx.pose.fx)[side === 'N' ? 'drumN' : 'drumF'];
      const q = ctx.canvas();
      stampRoles(q, DRUM, d, isRight(ctx), [rnd(sh[0]) - 6, rnd(sh[1]) - 5], side === 'F' ? (c) => (c === PAL.ink ? c : darkerTone(c)) : undefined);
      crease(ctx.dst, q, ctx.light);
      clipGround(q, ctx.rig.ground);
      return q;
    },
  };
}
const darkerTone = (c: number) => darker(c, 1);

// ------------------------------------------------------------------ limbs

/** A hinge: a short steel cylinder across a joint, perpendicular to the bisector of the two bones. */
function axle(q: PixelCanvas, at: V, a: V, b: V, bands: readonly [number, number, number, number], light: Ctx['light']): void {
  // the bisector of the two bones as seen from the joint; the axle runs across it
  const va: V = [a[0] - at[0], a[1] - at[1]];
  const vb: V = [b[0] - at[0], b[1] - at[1]];
  const la = Math.hypot(va[0], va[1]) || 1;
  const lb = Math.hypot(vb[0], vb[1]) || 1;
  let bx = va[0] / la + vb[0] / lb;
  let by = va[1] / la + vb[1] / lb;
  const bl = Math.hypot(bx, by);
  if (bl < 0.3) {
    bx = 1;
    by = 0;
  } else {
    bx /= bl;
    by /= bl;
  }
  // the knuckle sits on the outside of the bend: a rounded block 5×4, lit by band
  const cx = at[0] - bx * 1.2;
  const cy = at[1] - by * 1.2;
  disc(q, cx, cy, 2.9, bands, light);
  q.set(Math.round(cx - 0.5), Math.round(cy - 0.5), bands[3]);
}

/** The cone's geometry at a wrist: the axis (unit), the mouth centre, the half-widths. */
export function coneAt(wrist: V, dir: number, ext: number): { base: V; mouth: V; axis: V; len: number; r0: number; r1: number } {
  const axis: V = [Math.cos(dir), Math.sin(dir)];
  const base: V = [wrist[0] + axis[0] * ext, wrist[1] + axis[1] * ext];
  const len = 8;
  return { base, mouth: [base[0] + axis[0] * len, base[1] + axis[1] * len], axis, len, r0: 2.4, r1: 5.2 };
}

/** The wrist the cone rides this frame (the rod telescoped out by fx.ext, the cone's own lag fx.cone), and the cone's axis angle. */
export function wristOf(rig: BipedRig, fx: Readonly<SilencerFx>, side: 'N' | 'F'): { wrist: V; dir: number; end: V } {
  const limb = side === 'N' ? rig.armN : rig.armF;
  const e = Math.max(0, side === 'N' ? fx.extN : fx.extF);
  const end: V = [limb.end[0], limb.end[1] + rnd(side === 'N' ? fx.coneN : fx.coneF)];
  const fdx = end[0] - limb.mid[0];
  const fdy = end[1] - limb.mid[1];
  const fl = Math.hypot(fdx, fdy) || 1;
  return { wrist: [end[0] + (fdx / fl) * e, end[1] + (fdy / fl) * e], dir: limb.dir, end };
}

/** One arm: upper piston, elbow joint, forearm sleeve + telescoping rod, the cone. */
function drawArm(ctx: Ctx, side: 'N' | 'F', q: PixelCanvas): void {
  const rig = ctx.rig;
  const limb = side === 'N' ? rig.armN : rig.armF;
  const fx = ctx.pose.fx;
  const far = side === 'F';
  const bz = far ? BRONZE_FAR : BRONZE_B;
  const st = far ? STEEL_FAR : STEEL_B;
  const ext = Math.max(0, side === 'N' ? fx.extN : fx.extF);
  const coneDy = Math.round(side === 'N' ? fx.coneN : fx.coneF);
  const root = limb.root;
  const mid = limb.mid;
  const end: V = [limb.end[0], limb.end[1] + coneDy];
  // upper arm: bronze piston with two collar grooves
  tube(q, root, mid, 3.7, bz, ctx.light, { grooves: [0.38, 0.7] });
  // forearm: bronze sleeve over the first half, the steel rod out of it to the wrist (and beyond, telescoping)
  const fdx = end[0] - mid[0];
  const fdy = end[1] - mid[1];
  const fl = Math.hypot(fdx, fdy) || 1;
  const along = (t: number): V => [mid[0] + (fdx * t), mid[1] + (fdy * t)];
  const ux = fdx / fl;
  const uy = fdy / fl;
  const tip: V = [end[0] + ux * ext, end[1] + uy * ext];
  tube(q, along(0.45), tip, 1.9, st, ctx.light, { flat: true });
  tube(q, mid, along(0.62), 3.4, bz, ctx.light, { grooves: [0.46], r1: 3.2 });
  // the sleeve's mouth ring (a steel lip where the rod comes out)
  tube(q, along(0.58), along(0.66), 3.3, st, ctx.light);
  // elbow axle: a short steel cylinder across the joint, a bolt on its end
  axle(q, mid, limb.root, end, st, ctx.light);
  // the cone cuff on the rod: a bronze flare along the fist's axis
  drawCone(ctx, q, tip, limb.dir, 0, far);
}

function drawCone(ctx: Ctx, q: PixelCanvas, wrist: V, dir: number, ext: number, far: boolean): void {
  const bz = far ? BRONZE_FAR : BRONZE_B;
  const st = far ? STEEL_FAR : STEEL_B;
  const c = coneAt(wrist, dir, ext);
  // the cone body: bronze, flaring; the last third a steel lip
  tube(q, c.base, c.mouth, c.r0, bz, ctx.light, { r1: c.r1, grooves: [0.5], rim: { from: 0.78, bands: st } });
  // a steel neck ring where it meets the rod
  tube(q, [c.base[0] - c.axis[0] * 1, c.base[1] - c.axis[1] * 1], [c.base[0] + c.axis[0] * 1.2, c.base[1] + c.axis[1] * 1.2], 2.7, st, ctx.light);
  // the mouth: a dark cavity ellipse across the lip
  const nx = -c.axis[1];
  const ny = c.axis[0];
  for (let y = Math.floor(c.mouth[1] - 7); y <= Math.ceil(c.mouth[1] + 7); y++)
    for (let x = Math.floor(c.mouth[0] - 7); x <= Math.ceil(c.mouth[0] + 7); x++) {
      const px = x + 0.5 - c.mouth[0];
      const py = y + 0.5 - c.mouth[1];
      const a = px * c.axis[0] + py * c.axis[1];
      const n = px * nx + py * ny;
      if ((a / 1.6) ** 2 + (n / (c.r1 - 1.1)) ** 2 <= 1 && a >= -0.8) q.set(x, y, PAL.void0);
    }
}

function limbPart(side: 'N' | 'F'): Part {
  return {
    layer: side === 'N' ? 'armN' : 'armF',
    seam: 'none',
    paint: (ctx) => {
      const q = ctx.canvas();
      drawArm(ctx, side, q);
      crease(ctx.dst, q, ctx.light);
      clipGround(q, ctx.rig.ground);
      return q;
    },
  };
}

function legPart(side: 'N' | 'F'): Part {
  return {
    layer: side === 'N' ? 'legN' : 'legF',
    seam: 'none',
    paint: (ctx) => {
      const rig = ctx.rig;
      const leg = side === 'N' ? rig.legN : rig.legF;
      const far = side === 'F';
      const bz = far ? BRONZE_FAR : BRONZE_B;
      const st = far ? STEEL_FAR : STEEL_B;
      const q = ctx.canvas();
      // thigh: a fat bronze piston; shin: a steel rod in a bronze sleeve
      tube(q, leg.root, leg.mid, 4.0, bz, ctx.light, { grooves: [0.5] });
      tube(q, leg.mid, leg.end, 2.9, st, ctx.light, { r1: 2.6 });
      tube(q, leg.mid, [leg.mid[0] + (leg.end[0] - leg.mid[0]) * 0.5, leg.mid[1] + (leg.end[1] - leg.mid[1]) * 0.5], 3.6, bz, ctx.light, { grooves: [0.7] });
      axle(q, leg.mid, leg.root, leg.end, st, ctx.light);
      // the foot plate
      const d = placesOf(rig, ctx.pose.fx)[side === 'N' ? 'footN' : 'footF'];
      const f = side === 'N' ? REST_RIG.footN : REST_RIG.footF;
      stampRoles(q, FOOT, d, isRight(ctx), [rnd(f[0]) - 6, rnd(f[1]) - 7], far ? darkerTone : undefined);
      crease(ctx.dst, q, ctx.light);
      clipGround(q, rig.ground);
      return q;
    },
  };
}

/** The exhaust stacks behind the far shoulder: two dark steel pipes with bronze bands and wide rim caps. */
const stacks: Part = {
  layer: 'back',
  seam: 'none',
  paint: (ctx) => {
    const d = placesOf(ctx.rig, ctx.pose.fx).stack;
    const q = ctx.canvas();
    const L = ctx.light;
    const lean = ctx.pose.fx.lean2;
    // [base, top, radius]: the tall one behind the far shoulder, the short one beside the hood
    const defs: [V, V, number][] = [
      [[33, 33], [29 + lean, 17], 2.5],
      [[38, 30], [36 + lean, 21], 2.2],
    ];
    for (const [a, b, r] of defs) {
      const A: V = [a[0] + d[0], a[1] + d[1]];
      const B: V = [b[0] + d[0], b[1] + d[1]];
      const t = (k: number): V => [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k];
      tube(q, A, B, r, STEEL_FAR, L, { grooves: [0.3] });
      tube(q, t(0.5), t(0.62), r + 0.5, BRONZE_FAR, L, {});
      // the rim: a wider steel ring capping the pipe, the bore a dark ellipse in it
      tube(q, t(0.9), [B[0], B[1] - 1], r + 0.8, [PAL.night2, PAL.night3, PAL.night4, PAL.steel], L, {});
      const bx = rnd(B[0] - 0.5);
      const by = rnd(B[1] - 0.5);
      for (let k = -1; k <= 1; k++) q.set(bx + k, by, PAL.void0);
      q.set(bx - 1, by - 1, PAL.void0);
    }
    crease(ctx.dst, q, L);
    return q;
  },
};

// ------------------------------------------------------------------ torso

/** A dark strut that bridges any gap between the chest, the abdomen and the pelvis whatever the pose does. */
const spine: Part = {
  layer: 'torso',
  seam: 'none',
  paint: (ctx) => {
    const p = placesOf(ctx.rig, ctx.pose.fx);
    const q = ctx.canvas();
    const top = rnd(42 + p.chest[1]);
    const bottom = rnd(58 + p.pelvis[1]);
    const cx = rnd(46 + (p.abs[0] + p.chest[0] + p.pelvis[0]) / 3);
    for (let y = top; y <= bottom; y++) {
      for (let x = cx - 4; x <= cx + 3; x++) q.set(x, y, x < cx - 1 ? PAL.night1 : PAL.night0);
    }
    return q;
  },
};
const pelvisPart: Part = plate(PELVIS, 'pelvis', { layer: 'torso' });
const absPart: Part = plate(ABDOMEN, 'abs', { layer: 'torso' });
const chestPart: Part = plate(CHEST, 'chest', { layer: 'torso' });

const neck: Part = {
  layer: 'head',
  seam: 'none',
  paint: (ctx) => {
    const p = placesOf(ctx.rig, ctx.pose.fx);
    const q = ctx.canvas();
    const top = rnd(30 + p.hood[1]);
    const bottom = rnd(31 + p.chest[1]);
    for (let y = top; y <= bottom; y++) for (let x = 41; x <= 49; x++) q.set(x + rnd((p.hood[0] + p.chest[0]) / 2), y, x < 44 ? PAL.night1 : PAL.night0);
    return q;
  },
};

const hoodPart: Part = {
  layer: 'head',
  seam: 'none',
  paint: (ctx) => {
    const d = placesOf(ctx.rig, ctx.pose.fx).hood;
    const q = ctx.canvas();
    stampRoles(q, HOOD, d, isRight(ctx));
    crease(ctx.dst, q, ctx.light);
    return q;
  },
};

// ------------------------------------------------------------------ light

/** The glow slot: the visor eye, the chest sigil, the cone lenses. */
const glow: Part = {
  layer: 'glow',
  seam: 'none',
  paint: (ctx) => {
    const fx = ctx.pose.fx;
    const rig = ctx.rig;
    const pl = placesOf(rig, fx);
    const q = ctx.canvas();
    const dst = ctx.dst;
    // ---- the eye: 3×2 violet in the hood's dark opening, scanning along its slot
    const eye = fx.eye;
    const ex = VISOR.x + 1 + pl.hood[0] + rnd(fx.scan);
    const ey = VISOR.y + 1 + pl.hood[1];
    const cav = (x: number, y: number) => {
      const c = dst.get(x, y);
      return c === PAL.void0 || c === PAL.void1;
    };
    const lid = fx.lid >= 1 ? 2 : fx.lid > 0 ? 1 : 0;
    const cells: [number, number, number][] = [];
    if (eye <= 0) {
      cells.push([1, 0, PAL.void1]);
    } else if (eye < 0.75) {
      cells.push([0, 1, PAL.void2], [1, 1, PAL.void3], [2, 1, PAL.void2]);
    } else if (eye < 1.5) {
      cells.push([0, 0, PAL.void2], [1, 0, PAL.void3], [2, 0, PAL.void3], [0, 1, PAL.void3], [1, 1, PAL.void4], [2, 1, PAL.void3]);
    } else {
      cells.push([0, 0, PAL.void3], [1, 0, PAL.void4], [2, 0, PAL.void4], [3, 0, PAL.void3], [0, 1, PAL.void4], [1, 1, PAL.white], [2, 1, PAL.white], [3, 1, PAL.void4], [1, -1, PAL.void2], [2, -1, PAL.void2], [1, 2, PAL.void2], [2, 2, PAL.void2]);
    }
    for (const [dx, dy, c] of cells) {
      if (lid === 2 && dy !== 1) continue;
      if (lid === 1 && dy === 0) continue;
      if (cav(ex + dx, ey + dy)) q.set(ex + dx, ey + dy, c);
    }
    // ---- the sigil: a ring with a slash on the chest spine (the mute mark)
    const s = fx.sigil;
    if (s > 0) {
      const sx = rnd(SIGIL_AT[0]) + pl.chest[0];
      const sy = rnd(SIGIL_AT[1]) + pl.chest[1];
      const ring = s < 0.5 ? PAL.mag0 : s < 1.5 ? PAL.mag1 : PAL.mag2;
      const slash = s < 0.5 ? PAL.mag0 : s < 1.5 ? PAL.mag2 : s < 2.5 ? PAL.mag3 : PAL.mag4;
      const sock = (x: number, y: number) => { const c = dst.get(x, y); return c === PAL.void0 || c === PAL.night1 || c === PAL.night0; };
      for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const) if (sock(sx + dx, sy + dy)) q.set(sx + dx, sy + dy, ring);
      if (sock(sx, sy)) q.set(sx, sy, slash);
    }
    // ---- the cone lenses (what shows of the palm emitter inside each mouth)
    for (const side of ['N', 'F'] as const) {
      const lvl = fx.emit;
      if (lvl <= 0) continue;
      const w = wristOf(rig, fx, side);
      const c = coneAt(w.wrist, w.dir, 0);
      const tones = lvl < 1.5 ? [PAL.mag1, PAL.mag2] : lvl < 2.5 ? [PAL.mag2, PAL.mag3] : [PAL.mag3, PAL.mag4];
      const nx = -c.axis[1];
      const ny = c.axis[0];
      // a 5-px bar across the lip: the emitter plate seen edge-on, brighter at its middle
      for (let k = -2; k <= 2; k++) {
        const px = rnd(c.mouth[0] - 0.5 + nx * k * 1.1);
        const py = rnd(c.mouth[1] - 0.5 + ny * k * 1.1);
        if (dst.isOpaque(px, py)) q.set(px, py, Math.abs(k) <= 1 ? tones[1] : tones[0]);
      }
      if (lvl >= 2.5) {
        const mx = rnd(c.mouth[0] - 0.5);
        const my = rnd(c.mouth[1] - 0.5);
        if (dst.isOpaque(mx, my)) q.set(mx, my, PAL.white);
      }
    }
    return q;
  },
};

// ------------------------------------------------------------------ effects (light matter, unoutlined)

/** Expanding silence rings: concentric arcs leaving a cone along its axis (phase 0…1). */
export function drawRings(q: PixelCanvas, mouth: V, dir: number, phase: number): void {
  if (phase <= 0 || phase >= 1) return;
  const tones = [PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag4];
  for (let k = 0; k < 3; k++) {
    const p = phase - k * 0.17;
    if (p <= 0 || p >= 1) continue;
    const dist = 2 + p * 14;
    const half = 0.6 + 0.45 * p; // the arc opens as it travels
    const rad = 8 + p * 10;
    const cx = mouth[0] + Math.cos(dir) * (dist - rad);
    const cy = mouth[1] + Math.sin(dir) * (dist - rad);
    const tone = tones[Math.min(3, Math.max(0, Math.round((1 - p) * 3.2)))];
    arc(q, cx, cy, rad, dir - half, dir + half, tone);
    if (p < 0.45) arc(q, cx, cy, rad + 1, dir - half * 0.85, dir + half * 0.85, PAL.mag1);
  }
}

/** The guard's ward: three standing arcs of rings in front of the near cone, shimmering. */
export function drawWard(q: PixelCanvas, mouth: V, dir: number, level: number, tick: number): void {
  if (level <= 0) return;
  const tones = level < 0.7 ? [PAL.mag0, PAL.mag1, PAL.mag1] : level < 1.4 ? [PAL.mag1, PAL.mag2, PAL.mag3] : [PAL.mag2, PAL.mag3, PAL.mag4];
  for (let k = 0; k < 3; k++) {
    const rad = 11 + k * 5;
    const half = 0.78 - k * 0.1;
    const cx = mouth[0] + Math.cos(dir) * (4 - 4);
    const cy = mouth[1] + Math.sin(dir) * 0;
    // each arc travels a pixel along the axis on its own beat (the shimmer)
    const sh = (tick + k) % 3 === 0 ? 1 : 0;
    arc(q, cx + Math.cos(dir) * sh, cy + Math.sin(dir) * sh, rad, dir - half, dir + half, tones[k]);
  }
}

/** Exhaust smoke: grey-blue clusters rising off the stack tops in a loop. */
export function drawPuffs(q: PixelCanvas, tops: readonly V[], phase: number): void {
  if (phase < 0) return;
  tops.forEach((t, i) => {
    for (let k = 0; k < 3; k++) {
      const p = (phase + i * 0.37 + k / 3) % 1;
      if (p > 0.92) continue;
      const y = Math.max(3, t[1] - 2 - p * 8);
      const x = t[0] - 1 - p * 5 - Math.sin((p + i) * 5) * 1.2;
      const r = p < 0.25 ? 1 : p < 0.7 ? 2 : 1;
      const tone = p < 0.3 ? PAL.steel : p < 0.65 ? PAL.night4 : PAL.night3;
      q.rect(rnd(x), rnd(y), r + 1, r, tone);
    }
  });
}

/** A steam burst (a vent): fatter, faster puffs fanning off each stack top for one beat (phase 0…1). */
export function drawSteam(q: PixelCanvas, tops: readonly V[], phase: number): void {
  if (phase <= 0 || phase >= 1) return;
  tops.forEach((t, i) => {
    for (let k = 0; k < 4; k++) {
      const p = Math.min(0.99, phase * (0.6 + k * 0.22));
      const fan = (k - 1.5) * 0.9 * (1 + i * 0.3);
      const x = t[0] + fan * p * 7 - p * 6;
      const y = Math.max(3, t[1] - 1 - p * (6 + k * 2));
      const r = 1 + Math.round((1 - Math.abs(p - 0.5) * 2) * 2);
      const tone = p < 0.3 ? PAL.white : p < 0.6 ? PAL.steel : PAL.night4;
      q.rect(rnd(x), rnd(y), r + 1, r, tone);
    }
  });
}

/** Sparks flying off a struck plate: white / violet pixels on rays from `at` (phase 0…1). */
export function drawSparks(q: PixelCanvas, at: V, phase: number): void {
  if (phase <= 0 || phase >= 1) return;
  const rays: [number, number][] = [[-1, -0.9], [0.9, -1], [-1.3, 0.2], [1.2, 0.3], [-0.4, -1.4], [0.4, 0.9]];
  rays.forEach(([dx, dy], i) => {
    const d = (3 + i) * phase * 2.4;
    const x = at[0] + dx * d;
    const y = at[1] + dy * d + phase * phase * 6;
    q.set(rnd(x), rnd(y), phase < 0.4 ? PAL.white : i % 2 ? PAL.mag4 : PAL.void4);
    if (phase < 0.3) q.set(rnd(x - dx), rnd(y - dy), PAL.mag3);
  });
}

/** Dust at the feet: earth-tone puffs lifting off the ground line (phase 0…1). */
export function drawDust(q: PixelCanvas, feet: readonly V[], ground: number, phase: number): void {
  if (phase <= 0 || phase >= 1) return;
  for (const f of feet)
    for (let k = 0; k < 4; k++) {
      const dir = k % 2 ? 1 : -1;
      const x = f[0] + dir * (2 + k * 2.2 * phase) + 4;
      const y = ground - 1 - Math.round(phase * (2 + k) * 0.7);
      const tone = phase < 0.4 ? PAL.earth4 : phase < 0.7 ? PAL.earth3 : PAL.earth2;
      q.rect(rnd(x), y - (k >> 1), 2 + (phase < 0.5 ? 1 : 0), 2, tone);
    }
}

const fxLayer: Part = {
  layer: 'fx',
  seam: 'none',
  paint: (ctx) => {
    const fx = ctx.pose.fx;
    const rig = ctx.rig;
    const q = ctx.canvas();
    const pl = placesOf(rig, fx);
    const tops: V[] = [[29 + fx.lean2 + pl.stack[0], 16 + pl.stack[1]], [36 + fx.lean2 + pl.stack[0], 20 + pl.stack[1]]];
    if (fx.puff >= 0) drawPuffs(q, tops, fx.puff);
    if (fx.vent > 0) drawSteam(q, tops, fx.vent);
    for (const side of ['N', 'F'] as const) {
      const ph = side === 'N' ? fx.ringN : fx.ringF;
      if (ph <= 0) continue;
      const w = wristOf(rig, fx, side);
      drawRings(q, coneAt(w.wrist, w.dir, 0).mouth, w.dir, ph);
    }
    if (fx.ward > 0) {
      const w = wristOf(rig, fx, 'N');
      drawWard(q, coneAt(w.wrist, w.dir, 0).mouth, w.dir, fx.ward, ctx.frame);
    }
    if (fx.spark > 0) drawSparks(q, [56 + pl.chest[0], 38 + pl.chest[1]], fx.spark);
    if (fx.dust > 0) drawDust(q, [[rig.footN[0], 0], [rig.footF[0], 0]], rig.ground, fx.dust);
    // the anim's one glint: a metal glint on the lit edge of the near drum's cap
    if (fx.glint > 0) {
      const gx = 58 + pl.drumN[0];
      const gy = 29 + pl.drumN[1];
      q.set(gx, gy, PAL.white);
      if (fx.glint >= 2) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) q.set(gx + dx, gy + dy, PAL.mist);
    }
    return q;
  },
};

// ------------------------------------------------------------------ death / revive: the plates break (rigkit crumble)

const P = PAL;
export const CRUMBLE_METAL: CrumbleStyle = Object.freeze({
  groove: Object.freeze({ [P.earth4]: P.earth2, [P.earth3]: P.earth1, [P.earth2]: P.earth0, [P.earth1]: P.earth0, [P.earth0]: P.night0, [P.steel]: P.night3, [P.night4]: P.night2, [P.night3]: P.night1, [P.night2]: P.night0, [P.night1]: P.night0 }),
  chunk: new Set<number>([P.earth0, P.earth1, P.earth2, P.earth3, P.earth4, P.night0, P.night1, P.night2, P.night3, P.night4, P.steel, P.void0]),
  recess: Object.freeze({ [P.earth4]: P.earth2, [P.earth3]: P.earth1, [P.earth2]: P.earth1, [P.earth1]: P.earth0, [P.earth0]: P.night0, [P.steel]: P.night3, [P.night4]: P.night2, [P.night3]: P.night2, [P.night2]: P.night1, [P.night1]: P.night0 }),
  glow: Object.freeze([P.mag1, P.mag2, P.mag3]),
});
const DEBRIS = new WeakMap<PixelCanvas, Debris>();
let NAMES: readonly string[] = [];
export function setPartNames(n: readonly string[]): void {
  NAMES = n;
}
function restOfParts(ctx: Ctx): (part: number, x: number, y: number) => V | null {
  const pl = placesOf(ctx.rig, ctx.pose.fx);
  const d: Record<string, V> = {
    hood: pl.hood, neck: pl.hood, chest: pl.chest, abdomen: pl.abs, pelvis: pl.pelvis, spine: pl.pelvis, drumN: pl.drumN, drumF: pl.drumF, stacks: pl.stack,
    legN: pl.footN, legF: pl.footF,
    armN: disp(ctx.rig.armN.end, REST_RIG.armN.end), armF: disp(ctx.rig.armF.end, REST_RIG.armF.end),
  };
  return (part, x, y) => {
    const v = d[NAMES[part - 1] ?? ''];
    return v ? [x - v[0], y - v[1]] : null;
  };
}
const crumblePart: Part = {
  layer: 'front',
  seam: 'none',
  paint: (ctx) => {
    const pass = ctx.pose.pass ?? {};
    const dying = (pass.crumble ?? 0) > 0;
    const rising = pass.reassemble !== undefined && pass.reassemble < 1;
    if (!dying && !rising) {
      DEBRIS.delete(ctx.dst);
      return null;
    }
    const common = { restOf: restOfParts(ctx), light: ctx.light, style: CRUMBLE_METAL, floorY: ctx.rig.ground - 1, centreX: rnd(ctx.rig.pelvis[0]), origin: [46, 36] as V, minChunk: 3, chunk: 3, spread: 60, cell: 9, density: 0.45, crackWidth: 1.1, fallFrom: 0.2, fallShare: 0.6 };
    DEBRIS.set(ctx.dst, dying ? crumblePass(ctx.comp, { ...common, t: pass.crumble }) : reassemblePass(ctx.comp, { ...common, t: pass.reassemble!, glow: 0.6 }));
    return null;
  },
};
const debrisPart: Part = {
  layer: 'fx',
  seam: 'none',
  paint: (ctx) => {
    const d = DEBRIS.get(ctx.dst);
    if (d) drawDebris(ctx.dst, d, { floorY: ctx.rig.ground - 1, comp: ctx.comp });
    DEBRIS.delete(ctx.dst);
    return null;
  },
};

// ------------------------------------------------------------------ hitMagic: scan-row tears (before the outline)

/** Static: a few bands of rows tear sideways by 1–2 px (whole pixels), the outline then follows the torn edge. */
const glitchPass: Part = {
  layer: 'front',
  seam: 'none',
  paint: (ctx) => {
    const g = ctx.pose.fx.glitch;
    if (g <= 0) return null;
    const p = ctx.dst;
    const f = ctx.frame;
    const bands: [number, number, number][] = [[38, 3, 2], [52, 2, -2], [64, 3, 1], [27, 2, -1], [76, 2, 2]];
    const n = Math.min(bands.length, Math.ceil(g * bands.length));
    for (let i = 0; i < n; i++) {
      const [y0, h, sx] = bands[(i + f) % bands.length];
      const dx = ((f + i) % 2 ? sx : -sx) * (g > 0.6 ? 1 : 1);
      for (let y = y0; y < y0 + h; y++) {
        const row: (number | null)[] = [];
        for (let x = 0; x < p.w; x++) row.push(p.isOpaque(x, y) ? p.get(x, y) : null);
        for (let x = 0; x < p.w; x++) if (row[x] !== null) p.erase(x, y);
        for (let x = 0; x < p.w; x++) {
          const c = row[x];
          const nx = x + dx;
          if (c !== null && nx >= 0 && nx < p.w) p.set(nx, y, c);
        }
      }
    }
    return null;
  },
};

export const PARTS: Record<string, Part> = {
  stacks,
  armF: limbPart('F'),
  drumF: drumPart('F'),
  legF: legPart('F'),
  legN: legPart('N'),
  spine,
  pelvis: pelvisPart,
  abdomen: absPart,
  chest: chestPart,
  neck,
  hood: hoodPart,
  armN: limbPart('N'),
  drumN: drumPart('N'),
  crumble: crumblePart,
  glitch: glitchPass,
  glow,
  fx: fxLayer,
  debris: debrisPart,
};
setPartNames(Object.keys(PARTS));

export { lightVec };
