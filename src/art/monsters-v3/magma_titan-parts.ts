// Magma Titanı v3 (A4.1) — the PART PAINTERS (biped v1 slots, A3_MIMARI §3.3 PartPainter).
//
// Rigid basalt parts are the still's own pixels (./magma_titan-maps.ts cutParts) moved by WHOLE pixels:
// each follows one point of the plan's solved skeleton by round(point − its rest place) plus its own
// follower channel (the boulders, the chest plate, the fists lag their joints by their own pixels:
// HA-6), so the rest pose composes the approved still exactly and no hard part ever turns by a
// fraction of a pixel (REHBER IŞ-12). A part lays its creases (fringe) on what is behind it, darken-
// only and never past the silhouette, so the overhang shadow of a boulder travels with the boulder.
//
// The lava is LIGHT (IŞ-9): every part records where its lava pixels landed this frame; the glow slot
// (after the outline) re-tones the ones still in view from the frame's channels — by kind and, for the
// seams, by their distance from the core, so a pulse leaves the core and runs outward (the seams follow
// the core with a lag). Idle f0's channels are the still's: every lava pixel keeps its still tone.
//
// The posed limbs (the punch, the guard X, the roar's flung arms) are drawn by ./magma_titan-limbs.ts
// along the solved bones; a limb near its rest hang is the still's own pixels (these painters).

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import type { BipedPart, BipedPose, BipedRig } from '../bodyplans/biped/v1';
import { bipedNeutral, bipedRig } from '../bodyplans/biped/v1';
import type { PartCtx, PlanPose } from '../bodyplans/types';
import type { V } from '../rigkit/geom';
import { BUILD, type TitanFx } from './magma_titan-build';
import { CORE_AT as CORE_C, LAVA, PART_ORDER, SLOT_OF, STILL_DRIP, STILL_EMBERS, cutParts, type LavaKind, type PartKey } from './magma_titan-maps';
import { armTurned, block, cutBand, fist, snapDir, type BlockOut } from './magma_titan-limbs';

export type Pose = PlanPose<BipedPose, TitanFx>;
export type Ctx = PartCtx<Pose, BipedRig>;
export type Part = BipedPart<TitanFx>;

// ------------------------------------------------------------------ rest skeleton, displacement

/** The rig of the rest pose: every part's displacement is measured from it. */
export const REST_RIG: BipedRig = bipedRig(BUILD, bipedNeutral(BUILD));

const rnd = (v: number) => Math.round(v);
const disp = (p: V, rest: V): V => [rnd(p[0] - rest[0]), rnd(p[1] - rest[1])];
const mid = (a: V, b: V, t = 0.5): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** The whole-pixel displacement of every rigid part this frame (frame px). */
export function placesOf(rig: BipedRig, fx: Readonly<TitanFx>): Record<PartKey, V> {
  const r = REST_RIG;
  const add = (d: V, x: number, y: number): V => [d[0] + rnd(x), d[1] + rnd(y)];
  const shN = disp(rig.shoulderN, r.shoulderN);
  const shF = disp(rig.shoulderF, r.shoulderF);
  const plate = disp(mid(rig.waist, rig.chest), mid(r.waist, r.chest));
  const head = disp(rig.head, r.head);
  return {
    u: disp(mid(rig.shoulderF, rig.armF.mid), mid(r.shoulderF, r.armF.mid)),
    f: add(disp(rig.armF.end, r.armF.end), fx.fistFx, fx.fistFy),
    b: add(shF, fx.bFx, fx.bFy),
    t: disp(mid(rig.hipF, rig.legF.mid), mid(r.hipF, r.legF.mid)),
    s: disp(mid(rig.legF.mid, rig.legF.end, 0.35), mid(r.legF.mid, r.legF.end, 0.35)),
    o: disp(rig.footF, r.footF),
    T: disp(mid(rig.hipN, rig.legN.mid), mid(r.hipN, r.legN.mid)),
    S: disp(mid(rig.legN.mid, rig.legN.end, 0.35), mid(r.legN.mid, r.legN.end, 0.35)),
    O: disp(rig.footN, r.footN),
    P: disp(rig.pelvis, r.pelvis),
    D: add(disp(rig.waist, r.waist), 0, fx.abdY),
    Y: add(disp(rig.chest, r.chest), 0, fx.yokeY),
    C: add(plate, fx.chestX, fx.chestY),
    H: head,
    J: add(head, 0, fx.jaw),
    U: disp(mid(rig.shoulderN, rig.armN.mid), mid(r.shoulderN, r.armN.mid)),
    E: disp(mid(rig.armN.mid, rig.armN.end), mid(r.armN.mid, r.armN.end)),
    F: add(disp(rig.armN.end, r.armN.end), fx.fistNx, fx.fistNy),
    B: add(shN, fx.bNx, fx.bNy),
  };
}

// ------------------------------------------------------------------ tones

const ORDER_DARK: readonly number[] = [PAL.ink, PAL.night0, PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4];
const rankOf = (c: number) => ORDER_DARK.indexOf(c);

/** A crease pixel laid on what is behind (IŞ-5): only over basalt already there, only where it darkens it. */
function fringe(dst: PixelCanvas, x: number, y: number, tone: number): void {
  if (!dst.isOpaque(x, y)) return;
  const under = dst.get(x, y)!;
  const ru = rankOf(under);
  const rt = rankOf(tone);
  if (ru > 1 && rt >= 0 && rt < ru) dst.set(x, y, tone);
}

// ------------------------------------------------------------------ the frame's lava list

interface LavaAt {
  x: number;
  y: number;
  t: number;
  kind: LavaKind;
  d: number;
  /** the painter's index in the member's parts (planArt's part-id buffer) */
  part: number;
}
const FRAME_LAVA = new WeakMap<object, LavaAt[]>();
function lavaList(ctx: Ctx): LavaAt[] {
  let l = FRAME_LAVA.get(ctx.comp);
  if (!l) {
    l = [];
    FRAME_LAVA.set(ctx.comp, l);
  }
  return l;
}

/** Part index (1-based in the member's parts order, as planArt marks the part-id buffer). */
let PART_INDEX: Readonly<Record<string, number>> = {};
export function setPartIndex(names: readonly string[]): void {
  PART_INDEX = Object.freeze(Object.fromEntries(names.map((n, i) => [n, i + 1])));
}

/** Record lava pixels drawn this frame (frame px) for the glow pass. */
export function recordLava(ctx: Ctx, px: readonly { x: number; y: number; t: number; kind: LavaKind; d: number }[], dx = 0, dy = 0): void {
  const list = lavaList(ctx);
  const part = PART_INDEX[ctx.part] ?? 0;
  for (const p of px) list.push({ x: p.x + dx, y: p.y + dy, t: p.t, kind: p.kind, d: p.d, part });
}

// ------------------------------------------------------------------ rigid parts

/** Is the near / far arm drawn by the posed-limb painter this frame (not the still's hang)? */
export type ArmMode = (pose: Pose, rig: BipedRig) => boolean;
let NEAR_POSED: ArmMode = () => false;
let FAR_POSED: ArmMode = () => false;
export function setArmModes(near: ArmMode, far: ArmMode): void {
  NEAR_POSED = near;
  FAR_POSED = far;
}
const NEAR_ARM = new Set<PartKey>(['U', 'E', 'F']);
const FAR_ARM = new Set<PartKey>(['u', 'f']);

function rigid(key: PartKey): Part {
  return {
    layer: SLOT_OF[key],
    seam: 'none',
    paint: (ctx) => {
      if (NEAR_ARM.has(key) && NEAR_POSED(ctx.pose, ctx.rig)) return null;
      if (FAR_ARM.has(key) && FAR_POSED(ctx.pose, ctx.rig)) return null;
      const cut = cutParts()[key];
      const [dx, dy] = placesOf(ctx.rig, ctx.pose.fx)[key];
      const p2 = ctx.light.from === 'right';
      for (const f of cut.fringe) fringe(ctx.dst, f.x + dx, f.y + dy, f.c);
      const q = ctx.canvas();
      for (const b of cut.body) q.set(b.x + dx, b.y + dy, p2 ? b.c2 : b.c);
      clipGround(q, ctx.rig.ground);
      recordLava(ctx, cut.lava, dx, dy);
      return q;
    },
  };
}

/** Nothing is drawn under the ground line (a sunk foot, the summon's rise). */
function clipGround(q: PixelCanvas, ground: number): void {
  for (let y = ground; y < q.h; y++) for (let x = 0; x < q.w; x++) if (q.isOpaque(x, y)) q.erase(x, y);
}

// ------------------------------------------------------------------ light (after the outline)

const clampStep = (t: number, max: number) => Math.max(-1, Math.min(max, t));

/**
 * The heat step a lava pixel shows this frame (−1 = a cold night0 groove, 0 fire0 … 6 white), or null:
 * no light there this frame (a knuckle face at rest stays basalt).
 */
/** The idle's travelling pulse on the seam network: ±1 step in bands 18 px apart, moving out with fx.wave. */
const pulseOf = (d: number, fx: Readonly<TitanFx>) => (fx.waveAmp > 0 ? Math.round(fx.waveAmp * Math.cos(2 * Math.PI * (d / 18 - fx.wave))) : 0);

export function heatStep(l: { t: number; kind: LavaKind; d: number; y?: number }, fx: Readonly<TitanFx>): number | null {
  const full = (v: number) => (v >= 2.3 ? 6 : v >= 1.8 ? 5 : 4);
  switch (l.kind) {
    case 'knuckle':
    case 'knuckleF': {
      const h = l.kind === 'knuckle' ? fx.heatN : fx.heatF;
      // the striking face lights only as the punch heats (a lit face at rest or in the drive read as
      // a glowing bar across the fist): fire3 at 1.4, white-hot at full heat
      return h < 1.4 ? null : h < 1.8 ? 3 : 6;
    }
    case 'melt':
    case 'meltF': {
      // the fist melts from the striking face back: t = −1 − px behind the face, d = its plane (2 = the
      // lit back of the hand, whose basalt crust holds longest). Full heat (≥ 1.8): gold4 · fire4 ·
      // fire3 bands 2 px each behind the white face; 1.4: fire4 · fire3; 1.0: a fire2 lip; cold: basalt
      const h = l.kind === 'melt' ? fx.heatN : fx.heatF;
      const behind = -1 - l.t;
      const lit = l.d === 2;
      if (h >= 1.8) return lit ? (behind < 1 ? 4 : behind < 3 ? 3 : null) : behind < 2 ? 5 : behind < 4 ? 4 : behind < 6 ? 3 : null;
      if (h >= 1.4) return lit ? (behind < 1 ? 3 : null) : behind < 1 ? 4 : behind < 3 ? 3 : null;
      return null;
    }
    case 'core': {
      // a heat RADIUS, not a uniform step: heating grows the heart outward (the inner pixels step
      // first, d = px from the core's centre), cooling darkens the rim first; at rest (core 1) every
      // pixel is the still's. Gold only at full heat (≥ 1.8) — below it the still's ONE gold4 glint
      // stays the only gold —, white only on the 2×2 centre at peak heat (≥ 2.3).
      const h = fx.core - 1;
      if (h === 0) return l.t;
      const step = h > 0 ? Math.max(0, Math.round(h * (3 - 0.5 * l.d))) : Math.min(0, Math.round(h * (1.2 + 0.45 * l.d)));
      if (l.t === 5) return fx.core < 0.8 ? clampStep(4 + step, 4) : 5;
      return clampStep(l.t + step, fx.core >= 2.3 && l.d < 1.2 ? 6 : fx.core >= 1.8 ? 5 : 4);
    }
    case 'eye':
      return clampStep(l.t + Math.round((fx.eye - 1) * 2), fx.eye >= 1.8 ? 5 : 4);
    case 'mouth':
      return clampStep(l.t + Math.round((fx.mouth - 1) * 2), fx.mouth >= 1.8 ? 5 : 4);
    case 'vent':
      return clampStep(l.t + Math.round((fx.vent - 1) * 2), fx.vent >= 1.8 ? 5 : 4);
    case 'finger':
    case 'fingerF': {
      // the finger gaps warm first (fire4 at most until the punch is at full heat: gold / white only then)
      const h = l.kind === 'finger' ? fx.heatN : fx.heatF;
      const c = l.kind === 'finger' ? fx.clenchN : fx.clenchF;
      return clampStep(l.t + Math.round(h * 1.2 + c * 0.6), h >= 2 ? 6 : h >= 1.8 ? 5 : 4);
    }
    case 'armN':
    case 'armF': {
      // a posed forearm's crack: the arm's heat running down to the fist, or the guard's bright seams
      const h = Math.max(l.kind === 'armN' ? fx.heatN : fx.heatF, fx.forearm);
      return clampStep(l.t + Math.round(h * 1.5) + (h > 0 ? 0 : pulseOf(l.d, fx)), h >= 1.8 ? 5 : 4);
    }
    case 'legF':
    case 'legN': {
      if (l.kind === 'legN' || fx.legHeat <= 0) return clampStep(l.t + Math.round((fx.seam - 1) * 1.5) + pulseOf(l.d, fx), 4);
      // the stomp's flare runs up the far leg from the foot: pixels under the run's front are lit
      const h = (77 - (l.y ?? 77)) / 16; // 0 the sole … 1 the hip
      const lit = h <= fx.legRun ? fx.legHeat : 0;
      return clampStep(l.t + Math.round(lit * 1.6 + (fx.seam - 1) * 1.5), fx.legHeat >= 1.5 ? 5 : 4);
    }
    default: {
      // a seam: its level, plus a pulse running outward from the core — bands of one step brighter /
      // one step darker 18 px apart, travelling with fx.wave, so the network averages to the still
      return clampStep(l.t + Math.round((fx.seam - 1) * 1.5) + pulseOf(l.d, fx), fx.seam >= 1.8 ? 5 : 4);
    }
  }
}

const toneOfStep = (t: number) => (t < 0 ? PAL.night0 : LAVA[t]);

function emberTone(h: number): number | null {
  if (h < 0.4) return PAL.fire4;
  if (h < 0.55) return PAL.fire3;
  if (h < 0.85) return PAL.fire2;
  if (h < 1) return PAL.stone1;
  return null;
}

/** The ember loop: two embers per vent rise and cool; phase 0 is the still's four embers. */
function embers(p: PixelCanvas, ctx: Ctx): void {
  const fx = ctx.pose.fx;
  if (fx.ember < 0) return;
  const pl = placesOf(ctx.rig, fx);
  const vents: readonly { at: V; drift: number; h0: readonly [number, number] }[] = [
    { at: [21 + pl.B[0], 20 + pl.B[1]], drift: 0, h0: [1 / 9, 6 / 9] },
    { at: [48.7 + pl.b[0], 21 + pl.b[1]], drift: 3.5, h0: [1 / 9, 6 / 9] },
  ];
  for (const v of vents)
    for (const h0 of v.h0) {
      const h = (((h0 + fx.ember) % 1) + 1) % 1;
      const c = emberTone(h);
      if (c === null) continue;
      const x = Math.round(v.at[0] + v.drift * h);
      const y = Math.round(v.at[1] - h * 9);
      if (!p.isOpaque(x, y)) p.set(x, y, c);
    }
}

/** The far fist's drip: phase 0 is the still's 3-px drop (fire2 neck, fire3, fire4 head). */
function drip(p: PixelCanvas, ctx: Ctx): void {
  const fx = ctx.pose.fx;
  if (fx.drip < 0) return;
  const [dx, dy] = placesOf(ctx.rig, fx).f;
  if (fx.drip === 0) {
    STILL_DRIP.forEach(([x, y], i) => {
      if (!p.isOpaque(x + dx, y + dy)) p.set(x + dx, y + dy, [PAL.fire2, PAL.fire3, PAL.fire4][i]);
    });
    return;
  }
  const ph = fx.drip % 1;
  // forms (1 px), stretches (2–3 px), detaches and falls to the floor, a 1-px splash
  const x = 61 + dx;
  const top = 66 + dy;
  if (ph < 0.25) {
    const n = 1 + Math.floor(ph * 8);
    for (let i = 0; i < Math.min(3, n); i++) if (!p.isOpaque(x, top + i)) p.set(x, top + i, [PAL.fire2, PAL.fire3, PAL.fire4][Math.min(2, i + 3 - Math.min(3, n))]);
  } else if (ph < 0.7) {
    // it falls and cools in the air (a fire4 drop, a fire2 tail; a stone1 speck at the end), gone before
    // the floor band (HA-9 reads the lowest six rows for the feet)
    const k = (ph - 0.25) / 0.45;
    const y = Math.round(69 + k * 2);
    const head = k < 0.45 ? PAL.fire4 : k < 0.8 ? PAL.fire2 : PAL.stone1;
    if (y < ctx.rig.ground - 6) {
      if (!p.isOpaque(x, y)) p.set(x, y, head);
      if (k < 0.45 && !p.isOpaque(x, y - 1)) p.set(x, y - 1, PAL.fire2);
    }
  }
}

// ------------------------------------------------------------------ effects (light, after the outline)

const inFrame = (p: PixelCanvas, x: number, y: number) => x >= 2 && x < p.w - 2 && y >= 2 && y < p.h - 2;

/** Vent flames (fx.vent > 1.3): a tongue out of each notch, taller with the vent, flickering by frame. */
function flames(p: PixelCanvas, ctx: Ctx): void {
  const fx = ctx.pose.fx;
  if (fx.vent <= 1.3) return;
  const pl = placesOf(ctx.rig, fx);
  const h = Math.min(7, Math.round((fx.vent - 1.3) * 6));
  // three flame shapes by frame (a column of widths and a sway), the far vent a frame out of step
  const SHAPES: readonly (readonly [w: number, dx: number][])[] = [
    [[3, 0], [3, 0], [2, 0], [2, 1], [1, 1], [1, 0], [1, 0]],
    [[3, 0], [2, 0], [2, -1], [1, -1], [1, 0], [1, 1], [1, 1]],
    [[3, 0], [3, 1], [2, 1], [1, 0], [1, -1], [1, -1], [1, 0]],
  ];
  const vents: readonly { at: V; k: number }[] = [
    { at: [21 + pl.B[0], 21 + pl.B[1]], k: ctx.frame },
    { at: [50 + pl.b[0], 21 + pl.b[1]], k: ctx.frame + 1 },
  ];
  for (const v of vents) {
    // at full eruption sparks leave the flame's tip: three embers on fixed arcs, a frame apart
    if (fx.vent >= 2)
      for (let s = 0; s < 3; s++) {
        const ph = ((v.k + s * 2) % 6) / 6;
        const x = Math.round(v.at[0] + (s - 1) * (2 + ph * 4));
        const y = Math.round(v.at[1] - h - 1 - ph * 6);
        if (inFrame(p, x, y)) p.set(x, y, ph < 0.4 ? PAL.fire4 : ph < 0.75 ? PAL.fire3 : PAL.fire2);
      }
    const shape = SHAPES[((v.k % 3) + 3) % 3];
    for (let i = 0; i < h; i++) {
      const [w, dx] = shape[i];
      const y = v.at[1] - i;
      const frac = i / Math.max(1, h - 1);
      const tone = i === 0 && fx.vent >= 2 ? PAL.gold4 : frac < 0.34 ? PAL.fire4 : frac < 0.7 ? PAL.fire3 : PAL.fire2;
      for (let j = 0; j < w; j++) {
        const x = Math.round(v.at[0] + dx - (w - 1) / 2 + j);
        if (inFrame(p, x, y)) p.set(x, y, tone);
      }
    }
  }
}

/** The core's flare ring on a release (fx.flash): eight short arcs on a 7-px ring, gold4 at full flash. */
function flashRing(p: PixelCanvas, ctx: Ctx): void {
  const fx = ctx.pose.fx;
  if (fx.flash <= 0) return;
  const d = placesOf(ctx.rig, fx).C;
  const cx = CORE_C[0] + d[0];
  const cy = CORE_C[1] + d[1];
  const tone = fx.flash >= 0.8 ? PAL.gold4 : PAL.fire4;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + Math.PI / 8;
    for (const da of [-0.12, 0.12]) {
      const x = Math.round(cx + Math.cos(a + da) * 7);
      const y = Math.round(cy + Math.sin(a + da) * 7);
      if (inFrame(p, x, y)) p.set(x, y, tone);
    }
  }
}

/** Magma off the far (lava) fist's knuckles after contact (fx.burst = phase 0…1): five drops thrown on, cooling, falling. */
function burst(p: PixelCanvas, ctx: Ctx): void {
  const fx = ctx.pose.fx;
  if (fx.burst <= 0 || fx.burst >= 1) return;
  const f = fistAt(ctx.rig, fx, 'F');
  const ph = fx.burst;
  const base = Math.atan2(f.dir[1], f.dir[0]);
  const DROPS: readonly [da: number, speed: number][] = [[-0.7, 0.8], [-0.35, 1.0], [0, 1.15], [0.3, 0.9], [0.65, 0.7]];
  const tone = ph < 0.25 ? PAL.gold4 : ph < 0.5 ? PAL.fire4 : ph < 0.78 ? PAL.fire3 : PAL.fire2;
  for (const [da, sp] of DROPS) {
    const r = (2 + ph * 9) * sp;
    const x = Math.round(f.knuckles[0] + Math.cos(base + da) * r);
    const y = Math.round(f.knuckles[1] + Math.sin(base + da) * r + ph * ph * 7);
    if (inFrame(p, x, y) && y < ctx.rig.ground) p.set(x, y, tone);
  }
}

/** Rock chips off the struck front (fx.chips = phase): three basalt chips and one ember thrown up and out. */
function chips(p: PixelCanvas, ctx: Ctx): void {
  const fx = ctx.pose.fx;
  if (fx.chips <= 0 || fx.chips >= 1) return;
  const d = placesOf(ctx.rig, fx).H;
  const ox = 52 + d[0];
  const oy = 34 + d[1];
  const ph = fx.chips;
  const CHIPS: readonly [vx: number, vy: number, tone: number, size: number][] = [
    [7, -6, PAL.stone3, 2],
    [10, -2, PAL.stone2, 1],
    [5, -9, PAL.stone2, 1],
    [9, -7, PAL.fire4, 1],
  ];
  for (const [vx, vy, tone, size] of CHIPS) {
    const x = Math.round(ox + vx * ph);
    const y = Math.round(oy + vy * ph + ph * ph * 10);
    for (let i = 0; i < size; i++) if (inFrame(p, x + i, y) && !p.isOpaque(x + i, y)) p.set(x + i, y, tone);
  }
}

/** The stomp's dust at the far foot (fx.dust = phase): two low puffs rolling out along the floor. */
function dust(p: PixelCanvas, ctx: Ctx): void {
  const fx = ctx.pose.fx;
  if (fx.dust <= 0 || fx.dust >= 1) return;
  const ph = fx.dust;
  const g = ctx.rig.ground - 1;
  const fx0 = Math.round(ctx.rig.footF[0]);
  const tone = ph < 0.4 ? PAL.stone2 : ph < 0.75 ? PAL.stone1 : PAL.stone0;
  const out = Math.round(6 + ph * 6);
  for (const side of [-1, 1]) {
    const x = fx0 + side * out;
    for (const [dx, dy] of [[0, 0], [side, 0], [0, -1]] as const) if (inFrame(p, x + dx, g + dy) && !p.isOpaque(x + dx, g + dy)) p.set(x + dx, g + dy, tone);
    if (ph < 0.5 && inFrame(p, x - side * 2, g) && !p.isOpaque(x - side * 2, g)) p.set(x - side * 2, g, PAL.stone1);
  }
}

/** IŞ-8: the anim's one stone4 glint on the near boulder's crag — 1 the 3-px cross, −1 off, 0 the still's pixel. */
function glint(p: PixelCanvas, ctx: Ctx): void {
  const fx = ctx.pose.fx;
  if (fx.glint === 0) return;
  const d = placesOf(ctx.rig, fx).B;
  const x = 17 + d[0];
  const y = 21 + d[1];
  if (p.get(x, y) !== PAL.stone4) return;
  if (fx.glint < 0) {
    p.set(x, y, PAL.stone3);
    return;
  }
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
    const c = p.get(x + dx, y + dy);
    if (c === PAL.stone2 || c === PAL.stone3) p.set(x + dx, y + dy, PAL.stone4);
  }
}

/**
 * The face by fx.expr (the still's sockets at rows 34–36, H's pixels): 1 narrowed (the outer pixel of each
 * 2×1 ember eye shut: a glare), 3 struck (both eyes squeezed to a fire1 crease), 4 roaring (the throat
 * between the mouth slit and the dropped jaw, fire4 with fire3 corners, and two basalt fangs hanging from
 * the jaw's top). A dropped jaw always shows its molten throat.
 */
function face(p: PixelCanvas, ctx: Ctx): void {
  const fx = ctx.pose.fx;
  const [dx, dy] = placesOf(ctx.rig, fx).H;
  const ex = Math.round(fx.expr);
  const isEye = (x: number, y: number) => {
    const c = p.get(x, y);
    return c !== null && LAVA.includes(c);
  };
  if (ex === 1 || ex === 3) {
    for (const [x, y, inner] of [[45, 34, false], [46, 34, true], [50, 34, true], [51, 34, false]] as const) {
      const X = x + dx;
      const Y = y + dy;
      if (!isEye(X, Y)) continue;
      if (ex === 1 && !inner) p.set(X, Y, PAL.night0);
      if (ex === 3) p.set(X, Y, inner ? PAL.fire1 : PAL.night0);
    }
  }
  const jaw = Math.round(fx.jaw);
  if (jaw >= 1) {
    for (let y = 37; y < 37 + jaw; y++)
      for (let x = 44; x <= 51; x++) p.set(x + dx, y + dy, x === 44 || x === 51 ? PAL.fire3 : PAL.fire4);
    if (ex === 4) for (const x of [45, 50]) p.set(x + dx, 36 + jaw + dy, PAL.stone2);
  }
}

function glow(ctx: Ctx): null {
  const p = ctx.dst;
  const fx = ctx.pose.fx;
  const list = FRAME_LAVA.get(ctx.comp) ?? [];
  for (const l of list) {
    if (ctx.comp.owner(l.x, l.y) !== l.part) continue;
    const t = heatStep(l, fx);
    if (t !== null) p.set(l.x, l.y, toneOfStep(t));
  }
  face(p, ctx);
  glint(p, ctx);
  embers(p, ctx);
  drip(p, ctx);
  flames(p, ctx);
  flashRing(p, ctx);
  burst(p, ctx);
  chips(p, ctx);
  dust(p, ctx);
  return null;
}

// ------------------------------------------------------------------ the posed arms (./magma_titan-limbs.ts)

/** Unite block masks (frame px → plane). */
function unite(...outs: BlockOut[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const o of outs) for (const [k, v] of o.mask) m.set(k, v);
  return m;
}

/**
 * The elbow's glowing crease (the still's elbow: a 2:1 stair of fire3 / fire2 in the crook): 3 px on the
 * forearm's start, on the side of the bend, only on its mid plane.
 */
function elbowCrack(q: PixelCanvas, arm: BipedRig['armN'], fore: BlockOut, kind: LavaKind): { x: number; y: number; t: number; kind: LavaKind; d: number }[] {
  const out: { x: number; y: number; t: number; kind: LavaKind; d: number }[] = [];
  const a = snapDir([arm.mid[0] - arm.root[0], arm.mid[1] - arm.root[1]]);
  const b = snapDir([arm.end[0] - arm.mid[0], arm.end[1] - arm.mid[1]]);
  // the crook is on the side the forearm turns toward
  const cross = a[0] * b[1] - a[1] * b[0];
  if (Math.abs(cross) < 0.2) return out;
  const side: V = cross > 0 ? [-b[1], b[0]] : [b[1], -b[0]];
  for (let k = 0; k < 3; k++) {
    const x = Math.floor(arm.mid[0] + b[0] * (1 + k) + side[0] * (2 - k * 0.5));
    const y = Math.floor(arm.mid[1] + b[1] * (1 + k) + side[1] * (2 - k * 0.5));
    if (fore.mask.get(y * q.w + x) === undefined) continue;
    out.push({ x, y, t: k === 0 ? 3 : 2, kind, d: 0 });
    q.set(x, y, k === 0 ? PAL.fire3 : PAL.fire2);
  }
  return out;
}

/** The fist's geometry this frame: its centre, its knuckles (the striking face) and its direction. */
export interface FistAt {
  centre: V;
  knuckles: V;
  dir: V;
  posed: boolean;
}
/** The still's hanging fists: centre and knuckles (the lower front of the fist) at rest. */
const STILL_FIST = { N: { centre: [20, 58] as V, knuckles: [23, 63] as V }, F: { centre: [59, 57] as V, knuckles: [61, 62] as V } };

export function fistAt(rig: BipedRig, fx: Readonly<TitanFx>, side: 'N' | 'F'): FistAt {
  const arm = side === 'N' ? rig.armN : rig.armF;
  const off: V = side === 'N' ? [Math.round(fx.fistNx), Math.round(fx.fistNy)] : [Math.round(fx.fistFx), Math.round(fx.fistFy)];
  if (!armTurned(rig, REST_RIG, side)) {
    const d = placesOf(rig, fx)[side === 'N' ? 'F' : 'f'];
    const s = STILL_FIST[side];
    return { centre: [s.centre[0] + d[0], s.centre[1] + d[1]], knuckles: [s.knuckles[0] + d[0], s.knuckles[1] + d[1]], dir: [0.45, 0.9], posed: false };
  }
  const u = snapDir([Math.cos(arm.dir), Math.sin(arm.dir)]);
  const flen = (side === 'F' ? 12 : 13) - (u[1] < -0.7 ? 3 : 0);
  const centre: V = [arm.end[0] + off[0], arm.end[1] + off[1]];
  return { centre, knuckles: [centre[0] + u[0] * (flen / 2 - 1), centre[1] + u[1] * (flen / 2 - 1)], dir: u, posed: true };
}

/**
 * An arm swung off its hang: upper arm, forearm (laid over it with a crease) and the fist along the
 * forearm (or its aim), all on the solved bones; the arm lays its crease band on the body behind it.
 */
function posedArm(ctx: Ctx, side: 'N' | 'F'): PixelCanvas | null {
  const rig = ctx.rig;
  if (!armTurned(rig, REST_RIG, side)) return null;
  const arm = side === 'N' ? rig.armN : rig.armF;
  const far = side === 'F';
  const fx = ctx.pose.fx;
  const off: V = side === 'N' ? [fx.fistNx, fx.fistNy] : [fx.fistFx, fx.fistFy];
  const light = ctx.light;
  const q = ctx.canvas();
  // the still's proportions: a bulky upper arm, a short forearm, a huge fist centred on the hand point
  // the still's proportions: a bulky upper arm, a club forearm that thickens toward the wrist, and a
  // huge fist (13 px near, 12 far: the still's fists are ~14 across) centred on the hand point
  const up = block(q, arm.root, arm.mid, light, { w: far ? [9, 7] : [11, 9], far, cap: [0, 2], glass: !far, chamfer: [0, 2] });
  const qf = ctx.canvas();
  const kind: LavaKind = far ? 'armF' : 'armN';
  const u = snapDir([Math.cos(arm.dir), Math.sin(arm.dir)]);
  // a fist raised knuckles-up (the guard) is seen foreshortened: 3 px shorter
  const flen = (far ? 12 : 13) - (u[1] < -0.7 ? 3 : 0);
  const fwid = far ? 12 : 13;
  const wrist: V = [arm.end[0] - u[0] * (flen / 2) + Math.round(off[0]), arm.end[1] - u[1] * (flen / 2) + Math.round(off[1])];
  const fore = block(qf, arm.mid, wrist, light, { w: far ? [7, 8] : [8, 10], far, cap: [1, 1], glass: !far, chamfer: [1, 0], crack: { t: 2, kind, from: 0.15, to: 0.9, off: 0, jog: false } });
  // HA-12: on the release frame the fist drags a 2-px smear behind it along its travel (matter: outlined
  // with the body), the fist's own mid tone
  if (ctx.smearRig) {
    // only the striking arm smears: the hand that travelled further since the last key
    const travel = (a: BipedRig['armN'], b: BipedRig['armN']) => Math.hypot(a.end[0] - b.end[0], a.end[1] - b.end[1]);
    const mine = far ? travel(rig.armF, ctx.smearRig.armF) : travel(rig.armN, ctx.smearRig.armN);
    const other = far ? travel(rig.armN, ctx.smearRig.armN) : travel(rig.armF, ctx.smearRig.armF);
    const prev = (far ? ctx.smearRig.armF : ctx.smearRig.armN).end;
    const dv: V = [arm.end[0] - prev[0], arm.end[1] - prev[1]];
    if (mine > 3 && mine >= other) {
      const back = snapDir([-dv[0], -dv[1]]);
      for (const k of [2, 1]) fist(qf, [wrist[0] + back[0] * k, wrist[1] + back[1] * k], u, light, { len: flen, wid: fwid, far, kind: far ? 'fingerF' : 'finger' });
    }
  }
  // the fist over the forearm: the still's short wrist crease, a night0 cut on the forearm's shadow /
  // mid side only (a full band read as a bracelet)
  const qh = ctx.canvas();
  const fi = fist(qh, wrist, u, light, { len: flen, wid: fwid, far, kind: far ? 'fingerF' : 'finger' });
  const foreDark = new Map([...fore.mask].filter(([, pl]) => pl !== 2));
  for (const i of fi.mask.keys()) {
    const x = i % q.w;
    const y = Math.floor(i / q.w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const j = (y + dy) * q.w + (x + dx);
      if (!fi.mask.has(j) && foreDark.has(j)) qh.set(x + dx, y + dy, PAL.night0);
    }
  }
  qf.blit(qh, 0, 0);
  // the forearm and fist over the upper arm: a 1-px night0 cut on the upper arm around them
  cutBand(qf, q, unite(fore, fi), 1);
  q.blit(qf, 0, 0);
  // the whole arm over the body behind it: the still's night0 cut (1 px beside / above, 2 under it)
  cutBand(q, ctx.dst, unite(up, fore, fi), 2);
  clipGround(q, rig.ground);
  recordLava(ctx, [...up.lava, ...fore.lava, ...fi.lava]);
  void kind;
  return q;
}

setArmModes(
  (_p, rig) => armTurned(rig, REST_RIG, 'N'),
  (_p, rig) => armTurned(rig, REST_RIG, 'F'),
);

// ------------------------------------------------------------------ the parts table

const table: Record<string, Part> = {};
for (const k of PART_ORDER) {
  table[`p${k}`] = rigid(k);
  // the posed arms paint in their arm's slot, after its still parts (which step aside while posed)
  if (k === 'f') table.armF = { layer: 'armF', seam: 'none', paint: (ctx) => posedArm(ctx, 'F') };
  if (k === 'F') table.armN = { layer: 'armN', seam: 'none', paint: (ctx) => posedArm(ctx, 'N') };
}
table.glow = { layer: 'glow', seam: 'none', paint: glow };

export const PARTS: Readonly<Record<string, Part>> = Object.freeze(table);
setPartIndex(Object.keys(PARTS));
