// Kalkan Devi v3 — the PART PAINTERS (biped v1 slots, A3_MIMARI §3.3 PartPainter).
//
// Every rigid part (shield, pauldron, gauntlet, breastplate slice, belt, tassets, sabaton, visor) is a
// hand map or the procedural shield moved by WHOLE pixels by round(point − its rest place), so the rest pose
// composes exactly and no hard part ever turns by a fraction of a pixel (REHBER IŞ-12). The near arm is
// the one part that swings: flat three-band iron blocks along the rig's bones (shield_titan-kit.ts limb),
// with the gauntlet map at its end. The shield is the SILHOUETTE; the giant is only the pauldron, the
// gauntlet on the rim, the boot, a slice of belt and the eyes in the sight slot.
//
// Creases (IŞ-5): the gauntlet, the pauldron and the shield each lay a one-step crease on what is behind
// them. Light (IŞ-9): the eyes, the crest's windows, the rim glint and every flash are drawn after the
// outline in the 'glow' slot, only inside the carving they belong to.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { bipedNeutral, bipedRig, type BipedPart, type BipedPose, type BipedProp, type BipedRig } from '../bodyplans/biped/v1';
import type { PartCtx, PlanPose } from '../bodyplans/types';
import { BUILD, type TitanFx } from './shield_titan-build';
import { dustPuff, chipBurst, sparkBurst } from './shield_titan-fx';
import { BELT, CHEST, FIST, GAUNTLET, GAUNTLET_C, PAULDRON, SABATON, TASSETS, VISOR } from './shield_titan-maps';
import { BRONZE, IRON, KEY, creaseAround, darkIron, limb, relitChar, stampRows, stepDown, stepUp, type V } from './shield_titan-kit';
import { CREST, CREST_AT, SH, SLOT, SW, shieldRows, stampShield } from './shield_titan-shield';

export type Pose = PlanPose<BipedPose, TitanFx>;
export type Ctx = PartCtx<Pose, BipedRig>;
export type Part = BipedPart<TitanFx>;

// ------------------------------------------------------------------ rest skeleton, displacement

export const REST_RIG: BipedRig = bipedRig(BUILD, bipedNeutral(BUILD));
const GROUND = BUILD.root[1];
/** The shield's top-left corner at rest (frame px): its foot stands on the floor line (row 53 = y 72). */
export const SHIELD_REST: V = [27, 19];

/** The planted shield: the prop sits on the floor at its place; `d` moves it from there (px). */
export const planted = (d: V = [0, 0]): BipedProp => ({ at: 'floor', a: 0, show: 1, off: [SHIELD_REST[0] - BUILD.root[0] + d[0], SHIELD_REST[1] - BUILD.root[1] + d[1]] });

const disp = (p: V, rest: V): V => [Math.round(p[0] - rest[0]), Math.round(p[1] - rest[1])];

export interface Places {
  helm: V;
  pauldron: V;
  chest: V;
  belt: V;
  sabaton: V;
  shield: V;
}

/** The whole-pixel top-left of the shield, the displacement of every other rigid part (frame px). */
export function placesOf(rig: BipedRig, fx?: Readonly<TitanFx>): Places {
  const r = REST_RIG;
  const rise = Math.round(fx?.rise ?? 0);
  const ph = disp(rig.head, r.head);
  const ps = disp(rig.shoulderN, r.shoulderN);
  const pc = disp(rig.chest, r.chest);
  const pp = disp(rig.pelvis, r.pelvis);
  const pf = disp(rig.footN, r.footN);
  const sp = rig.props.shield?.at ?? SHIELD_REST;
  return {
    helm: [ph[0], ph[1] + rise],
    pauldron: [ps[0] + Math.round(fx?.padX ?? 0), ps[1] + Math.round(fx?.padY ?? 0) + rise],
    chest: [pc[0], pc[1] + rise],
    belt: [pp[0], pp[1] + rise],
    sabaton: [pf[0], pf[1] + rise],
    shield: [Math.round(sp[0]), Math.round(sp[1]) + rise],
  };
}

/** The shield's lean (fx.tilt): row j (0 = the top rim) steps out past the foot by whole pixels, the foot never moves. */
export function shearOf(tilt: number): ((row: number) => number) | undefined {
  const t = tilt ?? 0;
  if (!t) return undefined;
  return (j) => Math.round((t * (SH - 1 - j)) / (SH - 1));
}

// ------------------------------------------------------------------ small helpers

const rigid = (layer: string, map: { x: number; y: number; rows: readonly string[] }, at: (ctx: Ctx) => V, crease = true): Part => ({
  layer,
  seam: 'none',
  paint: (ctx) => {
    const d = at(ctx);
    const q = ctx.canvas();
    stampRows(q, map.rows, map.x + d[0], map.y + d[1], ctx.light, ctx.rig.ground);
    darkIron(q);
    if (crease) creaseAround(ctx.dst, q, 1);
    return q;
  },
});

const clipBelow = (q: PixelCanvas, ground: number): void => {
  for (let y = ground + 1; y < q.h; y++) for (let x = 0; x < q.w; x++) if (q.isOpaque(x, y)) q.erase(x, y);
};

// ------------------------------------------------------------------ the shield

/** The plates: the slab as a grid of 6 × 9 chunks that fall apart (death) and fly back (revive). */
const CW = 6;
const CH = 9;
// prettier-ignore
const SCATTER: readonly number[] = [-11, -6, -1, 3, 7, -9, -3, 1, 5, 8, -12, -7, -2, 2, 6, -10, -5, 0, 4, 8, -13, -8, -3, 1, 5, -11, -6, -1, 3, 7];
const PILE: readonly number[] = [0, 1, 0, 2, 0, 1, 0, 0, 2, 1, 2, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 0, 2, 0, 0, 1, 0, 1, 2];
function plateSlab(q: PixelCanvas, ctx: Ctx, x0: number, y0: number): void {
  const rows = shieldRows(ctx.light);
  const p = ctx.pose.fx.plates;
  const sh = shearOf(ctx.pose.fx.tilt);
  const ground = ctx.rig.ground;
  const nR = Math.ceil(SH / CH);
  const nC = Math.ceil(SW / CW);
  for (let cy = 0; cy < nR; cy++)
    for (let cx = 0; cx < nC; cx++) {
      const k = cy * nC + cx;
      // the top plates give first; a plate falls along its own arc, faster the further it has dropped
      const delay = 0.035 * cy + (k % 3) * 0.03;
      const t = Math.max(0, Math.min(1, (p - delay) / (1 - delay)));
      const rowTop = y0 + cy * CH;
      const rowBot = Math.min(SH, (cy + 1) * CH) - 1;
      const restBottom = y0 + rowBot;
      const fall = Math.max(0, ground - PILE[k % PILE.length] - restBottom);
      const dy = Math.round(fall * t * t);
      const dx = Math.round(SCATTER[k % SCATTER.length] * (1 - (1 - t) * (1 - t)));
      void rowTop;
      for (let j = cy * CH; j <= rowBot; j++) {
        const y = y0 + j + dy;
        if (y > ground) continue;
        const shx = sh ? Math.round(sh(j) * (1 - t)) : 0;
        for (let i = cx * CW; i < Math.min(SW, (cx + 1) * CW); i++) {
          const ch = rows[j][i];
          if (ch === '.') continue;
          const c = KEY[ch];
          if (c !== undefined) q.set(x0 + shx + i + dx, y, c);
        }
      }
    }
}

function shield(ctx: Ctx): PixelCanvas {
  const pl = placesOf(ctx.rig, ctx.pose.fx);
  const q = ctx.canvas();
  if (ctx.pose.fx.plates > 0) {
    plateSlab(q, ctx, pl.shield[0], pl.shield[1]);
    return q;
  }
  // HA-12: on the release frame the slab drags a 2-px smear of its own iron behind it (toward where it was)
  const prev = ctx.smearRig?.props.shield;
  if (prev && prev.show > 0) {
    const dx = pl.shield[0] - Math.round(prev.at[0]);
    const dy = pl.shield[1] - Math.round(prev.at[1]) - Math.round(ctx.pose.fx.rise ?? 0);
    const L = Math.hypot(dx, dy);
    if (L > 0.5) {
      const rows = shieldRows(ctx.light);
      for (const k of [2, 1]) {
        const sx = pl.shield[0] - Math.round((dx / L) * k);
        const sy = pl.shield[1] - Math.round((dy / L) * k);
        for (let j = 0; j < rows.length; j++) {
          const y = sy + j;
          if (y > ctx.rig.ground) break;
          for (let i = 0; i < rows[j].length; i++) if (rows[j][i] !== '.') q.set(sx + i, y, k === 2 ? IRON[0] : IRON[1]);
        }
      }
    }
  }
  stampShield(q, ctx.light, pl.shield[0], pl.shield[1], ctx.rig.ground, shearOf(ctx.pose.fx.tilt));
  return q;
}

// ------------------------------------------------------------------ the slumped hulk behind the plates (death / revive)

// prettier-ignore
const HULK: readonly string[] = [
  '.......SSSSSSSS...........',
  '.....SSMMMMMMMMSS.........',
  '...SSMMMMLLLLMMMMS........',
  '..SMMMMLLLLLLLLMMMSSSSS...',
  '.SMMMLLLLLLLLLLMMMSSLLMSS.',
  '.SMMLLLLLLLLLLMMMMSLLLLMSD',
  'SMMLLLLLLMMMMMMMMSSLLLLLMS',
  'SMLLLLLLMMMMMMMSSSSLvvvvMS',
  'SMLLLLMMMMMMMSSSSDDSLvkvLS',
  'SMLLMMMMMMSSSSSSDDDDSLLLMD',
  'SMMMMMMMSSSSSSSDDDDDDSSSSD',
  'DSMMMMSSSSSSSDDDDDDDDDDDDD',
  'DSSSMSSSSSSDDDDDDDDDDDDDD.',
  '.DDSSSSSSSDDDDDDDDDDDDD...',
  '...DDDDDDDDDDDDDDDDDD.....',
];
const HULK_AT: V = [26, 57];
function hulk(ctx: Ctx): PixelCanvas | null {
  if (!(ctx.pose.fx.plates > 0)) return null;
  const q = ctx.canvas();
  const dy = Math.round((ctx.pose.fx.rise ?? 0));
  // the hulk slumps with the plates falling away: it settles a pixel or two as they go
  const sag = Math.round(ctx.pose.fx.plates * 2);
  stampRows(q, HULK, HULK_AT[0], HULK_AT[1] + dy + sag, ctx.light, ctx.rig.ground);
  return q;
}

/** The shield's local → frame px (with the lean). */
function onShield(pl: Places, fx: Readonly<TitanFx>): (x: number, y: number) => V {
  const sh = shearOf(fx.tilt);
  return (x, y) => [pl.shield[0] + x + (sh ? sh(y) : 0), pl.shield[1] + y];
}

/** The tattered rag hung from the crown: three columns of crimson, a wave running down it, a torn end. */
function rag(q: PixelCanvas, at: (x: number, y: number) => V, pose: Pose, side: number): void {
  const amp = pose.fx.rag;
  if (!(amp > 0)) return;
  const ph = pose.clothPhase * Math.PI * 2;
  const L = 11;
  for (let j = 0; j < L; j++) {
    const t = j / (L - 1);
    const sway = Math.round(Math.sin(ph + j * 0.55) * amp * (0.2 + 1.3 * t) * 0.9);
    const w = j > L - 3 ? 2 : 3;
    for (let i = 0; i < w; i++) {
      const [x, y] = at(21 + i + sway + (w === 2 ? 0 : 0), 3 + j);
      const lit = side < 0 ? i === 0 : i === w - 1;
      const dark = side < 0 ? i === w - 1 : i === 0;
      q.set(x, y, lit ? PAL.crim3 : dark ? PAL.crim1 : PAL.crim2);
    }
  }
  // the torn tail: one notch
  const [tx, ty] = at(22 + Math.round(Math.sin(ph + (L - 1) * 0.55) * amp * 1.5), 3 + L);
  q.set(tx, ty, PAL.crim1);
}

/** The broken arrow lodged in the face, its splintered end past the rim; fx.arrow shakes the tail. */
function arrow(q: PixelCanvas, at: (x: number, y: number) => V, fx: Readonly<TitanFx>): void {
  const k = Math.round(fx.arrow);
  for (let x = 23; x <= 29; x++) q.set(...at(x, 34 + (x >= 27 ? k : 0)), x < 26 ? PAL.earth2 : PAL.earth3);
  q.set(...at(30, 34 + k), PAL.earth4);
  q.set(...at(31, 33 + k), PAL.earth4);
  q.set(...at(30, 35 + k), PAL.earth2);
}

/** Cracks across the face: two 4-connected paths revealed by fx.crack (the head travels). */
// prettier-ignore
const CRACKS: readonly (readonly V[])[] = [
  [[24, 21], [23, 21], [23, 22], [22, 22], [22, 23], [22, 24], [21, 24], [21, 25], [20, 25], [20, 26], [20, 27], [19, 27], [19, 28], [19, 29], [18, 29], [18, 30], [17, 30], [17, 31], [17, 32], [16, 32], [16, 33], [16, 34], [15, 34], [15, 35], [15, 36], [14, 36], [14, 37], [14, 38]],
  [[27, 36], [26, 36], [25, 36], [25, 37], [24, 37], [23, 37], [22, 37], [22, 38], [21, 38], [20, 38], [20, 39], [19, 39]],
  [[6, 44], [7, 44], [8, 44], [8, 45], [9, 45], [10, 45], [10, 46], [11, 46], [12, 46], [13, 46], [13, 47], [14, 47]],
];
function cracks(q: PixelCanvas, at: (x: number, y: number) => V, fx: Readonly<TitanFx>): void {
  const k = Math.min(1, fx.crack);
  if (!(k > 0)) return;
  for (const path of CRACKS) {
    const n = Math.round(path.length * k);
    for (let i = 0; i < n; i++) q.set(...at(path[i][0], path[i][1]), i < n - 1 || k >= 1 ? PAL.earth0 : PAL.ink);
  }
}

/** Where a fresh dent lands on the face (shield coords). */
const DENT_SPOTS: readonly V[] = [[13, 33], [14, 28], [17, 14], [26, 24]];
function freshDent(q: PixelCanvas, at: (x: number, y: number) => V, fx: Readonly<TitanFx>, side: number): void {
  const d = Math.round(fx.dent);
  if (d <= 0) return;
  const [cx, cy] = DENT_SPOTS[Math.max(0, Math.min(DENT_SPOTS.length - 1, Math.round(fx.dentAt)))];
  // a pit with a shadowed lip on the light's side and a lit lip opposite (the plate pushed in)
  const w = d >= 2 ? 4 : 3;
  const h = d >= 2 ? 3 : 2;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) q.set(...at(cx + i, cy + j), j === 0 || (side < 0 ? i === 0 : i === w - 1) ? PAL.earth1 : PAL.earth0);
  for (let i = 0; i < w; i++) q.set(...at(cx + i, cy + h), PAL.earth4); // the lit lip under the pit
  q.set(...at(side < 0 ? cx + w : cx - 1, cy), PAL.earth3);
}

/** What lives ON the shield and is outlined with it: the rag, the arrow, cracks and a fresh dent. */
function shieldFx(ctx: Ctx): PixelCanvas {
  const pl = placesOf(ctx.rig, ctx.pose.fx);
  const q = ctx.canvas();
  const at = onShield(pl, ctx.pose.fx);
  const side = ctx.light.side;
  const whole = !(ctx.pose.fx.plates > 0);
  if (whole) cracks(q, at, ctx.pose.fx);
  if (whole) freshDent(q, at, ctx.pose.fx, side);
  if (whole) rag(q, at, ctx.pose, side);
  if (whole) arrow(q, at, ctx.pose.fx);
  // the plate keeps the ground line: nothing under the floor
  clipBelow(q, ctx.rig.ground);
  return q;
}

// ------------------------------------------------------------------ the giant: boot, torso slice, pauldron, arm

function legN(ctx: Ctx): PixelCanvas {
  const rig = ctx.rig;
  const q = ctx.canvas();
  const rise = Math.round(ctx.pose.fx.rise ?? 0);
  const up = (v: V): V => [v[0], v[1] + rise];
  // the greave: hip → knee → ankle as two iron blocks (mostly behind the shield)
  limb(q, up(rig.legN.root), up(rig.legN.mid), ctx.light, { tones: IRON, w: [3.2, 2.8] });
  limb(q, up(rig.legN.mid), up([rig.legN.end[0], rig.legN.end[1]]), ctx.light, { tones: IRON, w: [2.8, 3] });
  const d = placesOf(rig, ctx.pose.fx).sabaton;
  stampRows(q, SABATON.rows, SABATON.x + d[0], SABATON.y + d[1], ctx.light, rig.ground);
  clipBelow(q, rig.ground);
  darkIron(q);
  creaseAround(ctx.dst, q, 1);
  return q;
}

const GROUND_AT = (ctx: Ctx) => ctx.rig.ground;
void GROUND_AT;

function nearArm(ctx: Ctx): PixelCanvas {
  const rig = ctx.rig;
  const fx = ctx.pose.fx;
  const rise = Math.round(fx.rise ?? 0);
  const q = ctx.canvas();
  const sh: V = [rig.armN.root[0], rig.armN.root[1] + rise];
  const el: V = [rig.armN.mid[0], rig.armN.mid[1] + rise + Math.round(fx.limp * 3)];
  const hand: V = [rig.armN.end[0], rig.armN.end[1] + rise + Math.round(fx.fingY + fx.limp * 6)];
  limb(q, sh, el, ctx.light, { tones: IRON, w: [3.4, 3], cap: [0, 1] });
  limb(q, el, hand, ctx.light, { tones: IRON, w: [3, 3.4], cap: [0.5, 0] });
  // the bronze cuff round the wrist
  const a: V = [el[0] + (hand[0] - el[0]) * 0.55, el[1] + (hand[1] - el[1]) * 0.55];
  const b: V = [el[0] + (hand[0] - el[0]) * 0.82, el[1] + (hand[1] - el[1]) * 0.82];
  limb(q, a, b, ctx.light, { tones: BRONZE, w: [3.8, 3.8], cap: [0, 0.4] });
  const hx = Math.round(hand[0]);
  const hy = Math.round(hand[1]);
  if (ctx.pose.armN.grip === 'hold') stampRows(q, GAUNTLET.rows, hx - GAUNTLET_C[0], hy - GAUNTLET_C[1], ctx.light, rig.ground);
  else stampRows(q, FIST.rows, hx - 4, hy - 4, ctx.light, rig.ground);
  clipBelow(q, rig.ground);
  darkIron(q);
  creaseAround(ctx.dst, q, 1);
  return q;
}

// ------------------------------------------------------------------ light (after the outline)

const eyeTone = (eye: number, flare: number, row: number, core: boolean): number | null => {
  if (flare > 0.35) return PAL.white;
  if (eye >= 1.75) return core ? PAL.white : PAL.fire4;
  if (eye >= 0.9) return core ? PAL.fire4 : row === 0 ? PAL.fire3 : PAL.fire2;
  if (eye >= 0.45) return PAL.fire2;
  if (eye >= 0.2) return PAL.fire1;
  return null;
};

/** The window's frame position (shield-local sight slot → frame px), with the lean. */
function windowAt(ctx: Ctx): { x: number; y: number; at: (c: number, r: number) => V } {
  const pl = placesOf(ctx.rig, ctx.pose.fx);
  const sh = shearOf(ctx.pose.fx.tilt);
  return {
    x: pl.shield[0] + SLOT.x0,
    y: pl.shield[1] + SLOT.y0,
    at: (c, r) => [pl.shield[0] + SLOT.x0 + c + (sh ? sh(SLOT.y0 + r) : 0), pl.shield[1] + SLOT.y0 + r],
  };
}

/** Eye cells in the window: the left eye cols 1…3, the right 7…9; the lid decides the rows (the dark rows are 1…3). */
function eyeRows(lid: number): readonly number[] {
  if (lid < 0.5) return [1, 2, 3];
  if (lid < 1.5) return [1, 2];
  if (lid < 2.5) return [2];
  return [];
}

function glow(ctx: Ctx): PixelCanvas | null {
  const p = ctx.dst;
  const fx = ctx.pose.fx;
  if (fx.plates > 0) return null; // the slab is in pieces: its carvings are gone
  const pl = placesOf(ctx.rig, fx);
  const at = onShield(pl, fx);
  const win = windowAt(ctx);
  const ok = (x: number, y: number) => y <= ctx.rig.ground && p.isOpaque(x, y);
  // the eyes — carried by the helm behind the slot (head displacement) and the gaze
  const dx = Math.round(ctx.pose.head.x) + Math.round(fx.eyeX);
  const dy = Math.round(ctx.pose.head.y) + Math.round(fx.eyeY);
  for (const row of eyeRows(fx.lid)) {
    for (const col of [1, 2, 3, 7, 8, 9]) {
      const c = col + dx;
      const r = row + dy;
      if (c < 1 || c > 9 || r < 1 || r > 3) continue;
      const inner = col === 3 || col === 7; // the cell next to the nose bridge burns hottest
      const t = eyeTone(fx.eye, fx.flare, row - eyeRows(fx.lid)[0], inner);
      if (t === null) continue;
      const [x, y] = win.at(c, r);
      if (ok(x, y)) p.set(x, y, t);
    }
  }
  // a blazing eye spills one step of red light into the dark visor round it
  if (fx.eye >= 1.75 && fx.lid < 2.5) {
    for (const col of [0, 4, 6, 10]) {
      const c = col + dx;
      if (c < 0 || c > 10) continue;
      for (const r of [2]) {
        const [x, y] = win.at(c, r + dy);
        if (ok(x, y) && p.get(x, y) === PAL.night0) p.set(x, y, PAL.fire1);
      }
    }
  }
  // the crest's windows: the tower is awake when the sun is up (the arrow slit, then the gate)
  const sun = fx.sun;
  if (sun >= 0.5 || fx.flare > 0.35) {
    const gate = sun >= 1.2 ? (sun >= 1.8 ? PAL.gold3 : PAL.gold2) : PAL.gold1;
    const win2 = fx.flare > 0.35 ? PAL.white : sun >= 1.8 ? PAL.gold4 : sun >= 1.2 ? PAL.gold3 : PAL.gold2;
    for (let j = 0; j < CREST.length; j++)
      for (let i = 0; i < CREST[j].length; i++) {
        if (CREST[j][i] !== 'v') continue;
        const [x, y] = at(CREST_AT[0] + i, CREST_AT[1] + j);
        if (!ok(x, y)) continue;
        if (j >= 6 && j <= 7) p.set(x, y, win2);
        else if (j >= 10 && sun >= 1.2) p.set(x, y, j === 10 ? gate : stepDown(gate, 1));
      }
  }
  // the bash / flare: the rim lights up (the iron frame's lit edge)
  if (fx.bash > 0 || fx.flare > 0.35) {
    const rows = shieldRows(ctx.light);
    const hot = Math.max(fx.bash, fx.flare);
    for (let j = 0; j < rows.length; j++)
      for (let i = 0; i < rows[j].length; i++) {
        const ch = rows[j][i];
        if (ch !== 'T' && ch !== 'H') continue;
        const [x, y] = at(i, j);
        if (ok(x, y)) p.set(x, y, hot >= 0.6 ? PAL.white : PAL.mist);
      }
  }
  // the travelling glint on the crown (≤ 1 per anim): 2 px, white leading a mist tail
  if (fx.glint > 0) {
    const xs: number[] = [];
    for (let x = 3; x <= SW - 4; x++) xs.push(x);
    const i = Math.max(0, Math.min(xs.length - 1, Math.round((fx.glint - 0.0001) * xs.length) - 1));
    const top = [6, 5, 5, 4, 3, 3, 2, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6];
    for (const [k, c] of [[0, PAL.white], [-1, PAL.mist]] as const) {
      const x = xs[Math.max(0, Math.min(xs.length - 1, i + k))];
      const [fxp, fyp] = at(x, top[x]);
      if (ok(fxp, fyp)) p.set(fxp, fyp, c);
    }
  }
  return null;
}

// ------------------------------------------------------------------ the visor behind the sight slot

function visor(ctx: Ctx): PixelCanvas {
  const q = ctx.canvas();
  const fx = ctx.pose.fx;
  if (fx.plates > 0) return q;
  const pl = placesOf(ctx.rig, fx);
  const win = windowAt(ctx);
  const sh = shearOf(fx.tilt);
  // the dark of the helm's interior fills the window, then the visor plates slide over it by the helm's own offset
  const hx = Math.max(-2, Math.min(2, Math.round(ctx.pose.head.x)));
  const hy = Math.max(-2, Math.min(2, Math.round(ctx.pose.head.y)));
  const rise = Math.round(fx.rise ?? 0);
  void pl;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 11; c++) q.set(...win.at(c, r), PAL.night0);
  for (let j = 0; j < VISOR.rows.length; j++) {
    const rr = j + hy;
    if (rr < 0 || rr > 4) continue;
    for (let i = 0; i < 11; i++) {
      const cc = i + hx;
      if (cc < 0 || cc > 10) continue;
      const ch = VISOR.rows[j][i];
      const col = KEY[relitChar(ch, ctx.light)];
      if (col !== undefined) q.set(...win.at(cc, rr), col);
    }
  }
  // the lid: iron plates sliding down over the eye band (rows 1…3) as the lid closes
  const lid = fx.lid;
  const covered = lid < 0.5 ? 0 : lid < 1.5 ? 1 : lid < 2.5 ? 2 : 3;
  void covered;
  const shut = lid < 0.5 ? [] : lid < 1.5 ? [3] : lid < 2.5 ? [1, 3] : [1, 2, 3];
  for (const r of shut) for (let c = 0; c < 11; c++) q.set(...win.at(c, r), r === 1 || r === 2 ? KEY[relitChar('M', ctx.light)] : KEY[relitChar('S', ctx.light)]);
  void sh;
  void rise;
  clipBelow(q, ctx.rig.ground);
  return q;
}

// ------------------------------------------------------------------ matter in the light slot (dust, chips, sparks, the pit)


function floorFx(ctx: Ctx): PixelCanvas | null {
  const fx = ctx.pose.fx;
  const q = ctx.canvas();
  const pl = placesOf(ctx.rig, fx);
  const at = onShield(pl, fx);
  const dust = fx.dust > 0 || fx.chips > 0 || fx.spark > 0 || fx.pit > 0;
  if (!dust) return null;
  // 0 the slab's foot, 1 its front corner (where a bash lands), 2 the near boot (it rides the slab's own place)
  const spots: readonly V[] = [[pl.shield[0] + 15, GROUND], [pl.shield[0] + SW + 1, GROUND], [20 + pl.sabaton[0], GROUND]];
  const spot = (i: number): V => spots[Math.max(0, Math.min(spots.length - 1, Math.round(i)))];
  // the pit the summon rises out of: a dark ellipse in the floor, open then closing, behind everything
  if (fx.pit > 0) {
    const o = Math.min(1, fx.pit);
    const closing = fx.pit > 1 ? fx.pit - 1 : 0;
    const rx = Math.round((18 * o) * (1 - closing * 0.8));
    if (rx >= 2) {
      for (let y = -2; y <= 2; y++)
        for (let x = -rx; x <= rx; x++) {
          if ((x * x) / (rx * rx) + (y * y) / 6.5 > 1) continue;
          const X = 40 + x;
          const Y = 73 + y;
          if (!ctx.dst.isOpaque(X, Y)) q.set(X, Y, Math.abs(y) === 2 || Math.abs(x) >= rx - 1 ? PAL.earth0 : PAL.ink);
        }
    }
  }
  if (fx.dust > 0) dustPuff(q, spot(fx.dustAt), fx.dust, fx.dustTone > 0.5 ? 1 : 0, 1);
  if (fx.chips > 0) {
    const s = fx.chipsAt;
    const base: V = s === 0 ? at(21, 28) : s === 1 ? at(SW - 1, 26) : spot(s - 1);
    chipBurst(q, base, fx.chips, 1);
  }
  if (fx.spark > 0) {
    const s = fx.sparkAt;
    const base: V = s === 0 ? at(DENT_SPOTS[Math.max(0, Math.min(3, Math.round(fx.dentAt)))][0] + 1, DENT_SPOTS[Math.max(0, Math.min(3, Math.round(fx.dentAt)))][1]) : s === 1 ? at(SW, 26) : at(15, 51);
    sparkBurst(q, base, fx.spark, 1);
  }
  return q;
}

// ------------------------------------------------------------------ the parts table

/** The member's parts, in the order they are painted within a slot. */
export const PARTS: Readonly<Record<string, Part>> = Object.freeze({
  legN: { layer: 'legN', seam: 'none', paint: legN },
  chest: rigid('torso', CHEST, (c) => placesOf(c.rig, c.pose.fx).chest, false),
  tassets: rigid('torso', TASSETS, (c) => placesOf(c.rig, c.pose.fx).belt, false),
  belt: rigid('torso', BELT, (c) => placesOf(c.rig, c.pose.fx).belt),
  hulk: { layer: 'torso', seam: 'none', paint: hulk },
  shield: { layer: 'propF', seam: 'none', paint: shield },
  shieldFx: { layer: 'propF', seam: 'none', paint: shieldFx },
  visor: { layer: 'head.front', seam: 'none', paint: visor },
  armN: { layer: 'armN', seam: 'none', paint: nearArm },
  pauldron: rigid('shoulderN', PAULDRON, (c) => placesOf(c.rig, c.pose.fx).pauldron),
  glow: { layer: 'glow', seam: 'none', paint: glow },
  floor: { layer: 'fx', seam: 'none', paint: floorFx },
});

void stepUp;
