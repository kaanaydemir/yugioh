// Hortlak Muhafız v3 — the PART PAINTERS (biped v1 slots, A3_MIMARI §3.3 PartPainter).
//
// Rigid parts (skull, jaw, horns, pauldrons, rib-cage, belt, boots) are hand-placed maps (./grim_warden-maps.ts)
// moved by WHOLE pixels: each follows one point of the plan's solved skeleton by round(point − its rest
// place) plus its own follower channel, so the rest pose composes exactly and no hard part ever turns by a
// fraction of a pixel (REHBER IŞ-12). Posed parts (the arms, the blade-arm, the legs, the far claw) are
// drawn along the solved bones (./grim_warden-limbs.ts). Light (eyes, rib glow, blade edge, lightning) is
// drawn in the slots after the outline.

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import type { BipedPart, BipedPose, BipedRig } from '../bodyplans/biped/v1';
import { bipedNeutral, bipedRig } from '../bodyplans/biped/v1';
import type { PartCtx, PlanPose } from '../bodyplans/types';
import type { V } from '../rigkit/geom';
import { dissolvePass } from '../rigkit/passes';
import { BUILD, type WardenFx } from './grim_warden-build';
import { BELT, BOOT_F, BOOT_N, HORN_F, HORN_N, JAW, PAULDRON_F, PAULDRON_N, RIBS, RIB_GAPS, SKULL, stampMap, type PartMap } from './grim_warden-maps';
import { BONE, BONE_FAR, CLOTH, CLOTH_FAR, IRON, IRON_FAR, blade, block, cloak, creaseBand, knob, snapDir } from './grim_warden-limbs';
import { boneChips, dustPuff, eyeArcs, eyeLight, floorCrack, pit } from './grim_warden-fx';

export type Pose = PlanPose<BipedPose, WardenFx>;
export type Ctx = PartCtx<Pose, BipedRig>;
export type Part = BipedPart<WardenFx>;

// ------------------------------------------------------------------ rest skeleton, displacement

/** The rig of the rest pose: every part's displacement is measured from it. */
export const REST_RIG: BipedRig = bipedRig(BUILD, bipedNeutral(BUILD));

const rnd = Math.round;
const disp = (p: V, rest: V): V => [rnd(p[0] - rest[0]), rnd(p[1] - rest[1])];

export interface Places {
  skull: V;
  horns: V;
  jaw: V;
  ribs: V;
  belt: V;
  padN: V;
  padF: V;
  bootN: V;
  bootF: V;
}

/** The whole-pixel displacement of each rigid part this frame (frame px). */
export function placesOf(rig: BipedRig, fx: Readonly<WardenFx>): Places {
  const r = REST_RIG;
  const head = disp(rig.head, r.head);
  const sN = disp(rig.shoulderN, r.shoulderN);
  const sF = disp(rig.shoulderF, r.shoulderF);
  const ch = disp(rig.chest, r.chest);
  return {
    skull: head,
    horns: [head[0] + rnd(fx.head2), head[1]],
    jaw: [head[0], head[1] + rnd(fx.jaw)],
    ribs: [ch[0], ch[1] + rnd(fx.chestY)],
    belt: disp(rig.pelvis, r.pelvis),
    padN: [sN[0], sN[1] + rnd(fx.padN)],
    padF: [sF[0], sF[1] + rnd(fx.padF)],
    bootN: disp(rig.footN, r.footN),
    bootF: disp(rig.footF, r.footF),
  };
}

/** Rows at or below the ground line are erased while the body is sunk in the floor (the summon / the revive). */
function sunk(ctx: Ctx): boolean {
  return ctx.rig.root[1] > ctx.rig.ground + 0.01;
}
function clipFloor(ctx: Ctx, q: PixelCanvas): PixelCanvas {
  if (!sunk(ctx)) return q;
  const g = ctx.rig.ground;
  for (let y = g; y < q.h; y++) for (let x = 0; x < q.w; x++) if (q.isOpaque(x, y)) q.erase(x, y);
  return q;
}

// ------------------------------------------------------------------ rigid parts

const rigid = (layer: string, map: PartMap, where: (ctx: Ctx) => V, crease = false): Part => ({
  layer,
  seam: 'none',
  paint: (ctx) => {
    const q = ctx.canvas();
    const px = stampMap(q, map, where(ctx), ctx.light);
    if (crease) {
      const mask = new Map<number, number>();
      for (let i = 0; i < px.length; i += 2) mask.set(px[i + 1] * q.w + px[i], 1);
      creaseBand(ctx.dst, mask, q.w, 1);
    }
    return clipFloor(ctx, q);
  },
});

// ------------------------------------------------------------------ the cloak and the rags

const cloakBack: Part = {
  layer: 'back',
  seam: 'none',
  paint: (ctx) => {
    const q = ctx.canvas();
    const r = ctx.rig;
    const fx = ctx.pose.fx;
    cloak(q, ctx.light, {
      top: [[r.shoulderN[0] - 1, r.shoulderN[1] - 4], [r.shoulderF[0] - 8, r.shoulderF[1] - 4]],
      hemY: r.pelvis[1] + 11,
      sway: rnd(fx.cloak),
      lift: rnd(fx.cloakY),
      phase: ctx.pose.clothPhase,
    });
    return clipFloor(ctx, q);
  },
};

/** Three torn rags hanging from the belt over the thighs: strips with ragged 2-px teeth. */
const rags: Part = {
  layer: 'lower',
  seam: 'none',
  paint: (ctx) => {
    const q = ctx.canvas();
    const p = placesOf(ctx.rig, ctx.pose.fx).belt;
    const ph = ctx.pose.clothPhase;
    const strips: readonly (readonly [x: number, len: number, w: number])[] = [
      [32, 11, 4],
      [37, 14, 5],
      [43, 10, 4],
    ];
    const p2 = ctx.light.from === 'right';
    strips.forEach(([sx, len, w], i) => {
      const wave = rnd(Math.sin((ph + i * 0.27) * Math.PI * 2) * 1.1 + ctx.pose.fx.cloak * 0.35);
      for (let r = 0; r < len; r++) {
        const depth = r / len;
        const dx = rnd(wave * depth);
        const y = 69 + p[1] + r;
        // a torn, 2-px-toothed hem: the last rows step in from the sides
        const cut = r >= len - 2 ? 1 : 0;
        for (let c = cut; c < w - cut; c++) {
          const x = sx + p[0] + dx + c;
          const fromLit = p2 ? w - 1 - c : c;
          q.set(x, y, CLOTH[fromLit === 0 ? 2 : c === (p2 ? 0 : w - 1) ? 0 : 1]);
        }
      }
    });
    return clipFloor(ctx, q);
  },
};

// ------------------------------------------------------------------ legs

function leg(side: 'N' | 'F'): Part {
  return {
    layer: side === 'N' ? 'legN' : 'legF',
    seam: 'none',
    paint: (ctx) => {
      const q = ctx.canvas();
      const r = ctx.rig;
      const l = side === 'N' ? r.legN : r.legF;
      const far = side === 'F';
      const hip = l.root;
      const knee = l.mid;
      const ank = l.end;
      const b = block(q, hip, knee, ctx.light, { w: [5, 4], tones: far ? BONE_FAR : BONE, cap: [0, 1] });
      block(q, knee, ank, ctx.light, { w: [5, 4], tones: far ? IRON_FAR : IRON, cap: [0, 1] });
      knob(q, [knee[0] + 0.5, knee[1]], 2.8, ctx.light, far ? IRON_FAR : IRON);
      const boot = side === 'N' ? BOOT_N : BOOT_F;
      const d = side === 'N' ? placesOf(r, ctx.pose.fx).bootN : placesOf(r, ctx.pose.fx).bootF;
      stampMap(q, boot, d, ctx.light);
      creaseBand(ctx.dst, b.mask, q.w, 1);
      return clipFloor(ctx, q);
    },
  };
}

// ------------------------------------------------------------------ arms

/** The far arm: a bare bone arm ending in a clawed hand, behind the body. */
const armF: Part = {
  layer: 'armF',
  seam: 'none',
  paint: (ctx) => {
    const q = ctx.canvas();
    const a = ctx.rig.armF;
    const T = BONE_FAR;
    block(q, a.root, a.mid, ctx.light, { w: [4, 3.4], tones: T, cap: [0, 1] });
    block(q, a.mid, a.end, ctx.light, { w: [3.4, 3], tones: T, cap: [0, 1] });
    knob(q, [a.mid[0] + 0.5, a.mid[1] + 0.5], 2.2, ctx.light, T);
    // the claw: a small hand and three hooked fingers along the forearm's direction
    const u = snapDir([a.end[0] - a.mid[0], a.end[1] - a.mid[1]]);
    const hand: V = [a.end[0] + u[0] * 3, a.end[1] + u[1] * 3];
    block(q, a.end, hand, ctx.light, { w: [3.4, 4], tones: BONE, cap: [0, 0.5] });
    for (const s of [-1, 0, 1] as const) {
      const n: V = [-u[1], u[0]];
      const base: V = [hand[0] + n[0] * s * 1.2, hand[1] + n[1] * s * 1.2];
      const tip: V = [hand[0] + u[0] * 4 + n[0] * s * 2, hand[1] + u[1] * 4 + n[1] * s * 2];
      q.line(Math.floor(base[0]), Math.floor(base[1]), Math.floor(tip[0]), Math.floor(tip[1]), s === 0 ? PAL.skin4 : PAL.earth4);
    }
    return clipFloor(ctx, q);
  },
};

/** What the blade painter leaves for the glow pass: the cutting-edge pixels and the tip of this frame. */
interface BladeInfo {
  edge: number[];
  tip: V;
}
const BLADES = new WeakMap<object, BladeInfo>();

/** Blade length (px) from the wrist; the reach is 13 (forearm) + this. */
export const BLADE_LEN = 19;

/** The near arm: bone upper arm, iron vambrace with an elbow spike, and the cleaver that IS the forearm's end. */
const armN: Part = {
  layer: 'armN',
  seam: 'none',
  paint: (ctx) => {
    const q = ctx.canvas();
    const r = ctx.rig;
    const a = r.armN;
    const sh = a.root;
    const up = block(q, sh, a.mid, ctx.light, { w: [5, 4.4], tones: BONE, cap: [0, 1] });
    const fore = block(q, a.mid, a.end, ctx.light, { w: [6, 5], tones: IRON, cap: [0, 1] });
    knob(q, [a.mid[0] + 0.5, a.mid[1] + 0.5], 3, ctx.light, IRON);
    // the elbow spike: a bone thorn pointing away from the body, back along the upper arm's line
    const ux = a.mid[0] - sh[0];
    const uy = a.mid[1] - sh[1];
    const sx = Math.sign(ux) || -1;
    q.set(Math.floor(a.mid[0]) + sx * 3, Math.floor(a.mid[1]), PAL.earth4);
    q.set(Math.floor(a.mid[0]) + sx * 4, Math.floor(a.mid[1]) + (uy > 0 ? 1 : -1), PAL.skin4);
    // the cleaver continues the forearm
    const stretch = ctx.smearFrom ? 2 : 0;
    const bl = blade(q, ctx.light, { root: a.end, dir: [Math.cos(a.dir), Math.sin(a.dir)], len: BLADE_LEN, width: 10, teeth: 4, stretch });
    // the smear (HA-12): the previous pose's blade tip dragged to this one, 2 px wide, iron
    if (ctx.smearRig) {
      const pv = blade(ctx.canvas(), ctx.light, { root: ctx.smearRig.armN.end, dir: [Math.cos(ctx.smearRig.armN.dir), Math.sin(ctx.smearRig.armN.dir)], len: BLADE_LEN, width: 10, teeth: 4 });
      const k = 0.3;
      q.thickLine(rnd(bl.tip[0] + (pv.tip[0] - bl.tip[0]) * k), rnd(bl.tip[1] + (pv.tip[1] - bl.tip[1]) * k), rnd(bl.tip[0]), rnd(bl.tip[1]), 2, PAL.steel);
    }
    BLADES.set(ctx.comp, { edge: bl.edge, tip: bl.tip });
    const mask = new Map<number, number>([...up.mask, ...fore.mask, ...bl.mask]);
    creaseBand(ctx.dst, mask, q.w, 2);
    for (let y = ctx.rig.ground; y < q.h; y++) for (let x = 0; x < q.w; x++) if (q.isOpaque(x, y)) q.erase(x, y);
    return q;
  },
};

// ------------------------------------------------------------------ light: eyes, ribs, blade edge

const EYES = (ctx: Ctx): [V, V] => {
  const d = placesOf(ctx.rig, ctx.pose.fx).skull;
  return [[38 + d[0], 39 + d[1]], [43 + d[0], 39 + d[1]]];
};

const glow: Part = {
  layer: 'glow',
  seam: 'none',
  paint: (ctx) => {
    const q = ctx.canvas();
    const fx = ctx.pose.fx;
    // eyes
    const level = fx.flare >= 1 ? 2 : fx.eye;
    const [l, r] = EYES(ctx);
    eyeLight(q, l, level);
    eyeLight(q, r, level);
    // rib glow: the hollows between the ribs
    const d = placesOf(ctx.rig, fx).ribs;
    if (fx.rib > 0.05 || fx.flare > 0) {
      const lv = fx.flare > 0 ? 2.5 : fx.rib;
      RIB_GAPS.forEach(([gx, gy], i) => {
        const x = gx + d[0];
        const y = gy + d[1];
        if (!ctx.dst.isOpaque(x, y) || ctx.dst.get(x, y) === PAL.ink) return;
        const near = Math.abs(gx - 38.5) < 4;
        const tone = lv >= 2.5 ? PAL.cyan4 : lv >= 1.6 ? (near ? PAL.cyan3 : PAL.cyan2) : lv >= 0.7 ? (near && i % 2 === 0 ? PAL.cyan2 : PAL.cyan1) : PAL.cyan0;
        q.set(x, y, tone);
      });
    }
    // the blade's edge
    const b = BLADES.get(ctx.comp);
    if (b && fx.edge > 0) {
      b.edge.forEach((idx, i) => {
        const x = idx % q.w;
        const y = Math.floor(idx / q.w);
        let tone: number | null = null;
        if (fx.edge >= 3) tone = i % 3 === 0 ? PAL.white : PAL.cyan4;
        else if (fx.edge >= 2) tone = i % 2 === 0 ? PAL.cyan3 : null;
        else if (i % 5 === 2) tone = PAL.cyan2;
        if (tone !== null) q.set(x, y, tone);
      });
    }
    return clipFloor(ctx, q);
  },
};

/** The eye lightning (and the lightning that runs along the body in a spell / a roar). */
const arcs: Part = {
  layer: 'fx',
  seam: 'none',
  paint: (ctx) => {
    const q = ctx.canvas();
    const fx = ctx.pose.fx;
    const eyes = EYES(ctx);
    const centres: [V, V] = [[eyes[0][0] + 1, eyes[0][1] + 1], [eyes[1][0] + 1, eyes[1][1] + 1]];
    const inSocket = (x: number, y: number) => centres.some((c) => Math.abs(x - c[0]) <= 1 && Math.abs(y - c[1]) <= 1);
    eyeArcs(q, { eyes: centres, set: rnd(fx.arc), reach: fx.arcLen, skip: inSocket });
    return clipFloor(ctx, q);
  },
};

/** Floor matter: the grave's mouth (behind the body), dust, chips. */
const pitBack: Part = {
  layer: 'back',
  seam: 'none',
  paint: (ctx) => {
    const q = ctx.canvas();
    const fx = ctx.pose.fx;
    if (fx.pit > 0) {
      pit(q, rnd(ctx.rig.root[0]), ctx.rig.ground - 1, fx.pit, ctx.light.from === 'left');
    }
    return q;
  },
};
const floorFx: Part = {
  layer: 'front',
  seam: 'none',
  paint: (ctx) => {
    const q = ctx.canvas();
    const fx = ctx.pose.fx;
    if (fx.dust > 0) dustPuff(q, rnd(ctx.rig.root[0]) + 6, ctx.rig.ground - 1, fx.dust);
    return q;
  },
};
const chipsFx: Part = {
  layer: 'fx',
  seam: 'none',
  paint: (ctx) => {
    const q = ctx.canvas();
    const fx = ctx.pose.fx;
    if (fx.chips > 0) {
      const at: V = fx.chipsAt === 2 ? [rnd(ctx.rig.armN.end[0]), rnd(ctx.rig.armN.end[1]) + 8] : fx.chipsAt === 1 ? [rnd(ctx.rig.chest[0]) - 2, rnd(ctx.rig.chest[1]) + 4] : [rnd(ctx.rig.head[0]) - 3, rnd(ctx.rig.head[1])];
      boneChips(q, at, fx.chips);
    }
    if (fx.pit > 0 && fx.pit < 2) floorCrack(q, rnd(ctx.rig.root[0]), ctx.rig.ground + 1, Math.min(1, fx.pit), 3);
    return q;
  },
};

// ------------------------------------------------------------------ death / revive pass (dissolve)

/** The part → rest-space displacement of a pixel owned by it (part space: the pattern rides the parts). */
function restOfParts(ctx: Ctx, index: Readonly<Record<string, number>>): (part: number, x: number, y: number) => V | null {
  const pl = placesOf(ctx.rig, ctx.pose.fx);
  const r = ctx.rig;
  const by: (V | null)[] = [];
  const set = (name: string, d: V | null) => {
    if (index[name] !== undefined) by[index[name]] = d;
  };
  set('skull', pl.skull);
  set('horns', pl.horns);
  set('jaw', pl.jaw);
  set('ribs', pl.ribs);
  set('belt', pl.belt);
  set('pauldronN', pl.padN);
  set('pauldronF', pl.padF);
  set('armN', disp(r.shoulderN, REST_RIG.shoulderN));
  set('armF', disp(r.shoulderF, REST_RIG.shoulderF));
  set('legN', pl.bootN);
  set('legF', pl.bootF);
  set('cloak', disp(r.shoulderN, REST_RIG.shoulderN));
  set('rags', pl.belt);
  return (part, x, y) => {
    const d = by[part];
    return d ? [x - d[0], y - d[1]] : null;
  };
}

let PART_INDEX: Readonly<Record<string, number>> = {};

const dissolvePart: Part = {
  layer: 'front',
  seam: 'none',
  paint: (ctx) => {
    const t = ctx.pose.pass?.dissolve ?? 0;
    if (t <= 0) return null;
    // top of the figure (the horns) first: the front travels down; the violet motes rise off what is gone
    dissolvePass(ctx.comp, { diss: t, restOf: restOfParts(ctx, PART_INDEX), top: 18, span: 76, front: 0.12, frontTone: PAL.void0, moteNear: PAL.void3, moteFar: PAL.void2 });
    return null;
  },
};

// ------------------------------------------------------------------ the parts table

/** The member's parts, in the order they are painted within a slot. */
export const PARTS: Readonly<Record<string, Part>> = Object.freeze({
  pit: pitBack,
  cloak: cloakBack,
  armF,
  pauldronF: rigid('shoulderF', PAULDRON_F, (c) => placesOf(c.rig, c.pose.fx).padF),
  legF: leg('F'),
  legN: leg('N'),
  rags,
  ribs: rigid('torso', RIBS, (c) => placesOf(c.rig, c.pose.fx).ribs),
  belt: rigid('torso', BELT, (c) => placesOf(c.rig, c.pose.fx).belt),
  horns: {
    layer: 'head',
    seam: 'none',
    paint: (ctx) => {
      const q = ctx.canvas();
      const d = placesOf(ctx.rig, ctx.pose.fx).horns;
      stampMap(q, HORN_F, d, ctx.light);
      stampMap(q, HORN_N, d, ctx.light);
      return clipFloor(ctx, q);
    },
  },
  skull: rigid('head', SKULL, (c) => placesOf(c.rig, c.pose.fx).skull),
  jaw: rigid('head', JAW, (c) => placesOf(c.rig, c.pose.fx).jaw),
  armN,
  pauldronN: rigid('shoulderN', PAULDRON_N, (c) => placesOf(c.rig, c.pose.fx).padN, true),
  glow,
  arcs,
  chips: chipsFx,
  floor: floorFx,
  dissolve: dissolvePart,
});
PART_INDEX = Object.freeze(Object.fromEntries(Object.keys(PARTS).map((n, i) => [n, i + 1])));
