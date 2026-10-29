// Ayna Kalkanı — the v3 look (lane A5-A step A-4; reworked by the user's decision of 24 Oct: "the old
// mirror shield was huge and beautiful" — docs/v3/A5_PLAN.md top note, REHBER EF-2). Behind V3_A5_A only:
// mirror_barrier.ts hands over on its first line; v1 and the plain v3 look keep the dome of ./_mirror.ts
// (mirrorDomeTB) byte-identical. No registrations here.
//
// The old dome's shape and size come back as the centrepiece — an ellipsoid of hex glass over the
// defender's WHOLE monster row (the same geometry as ./_mirror.ts, so the same bounding box) — drawn in the
// v3 pixel language: 1-px hex seams and a 1-px outline in palette tones, clear cells (EF-2 is met by the
// see-through honeycomb, never by shrinking it), the glass seen edge-on as a 2×2 checker band, a crisp
// specular streak; no dithered haze, no full-screen flash, no camera shake. What v3 made better stays:
// the v3 trap opening, the attacker's own strike, every victim's own v3 death in a readable order, the
// card continuity, the v3 sounds and today's camera calls.
//   0        the trap opening (trapOpeningV3: the card springs up, burst, "TUZAK!", Ayna's glint); its
//            lean stays as it is. The attacker waits in its declaration's charge hold.
//   220      DOME — `raise`: the floor ring draws itself round the defender's row from the front, then
//            the hex cells materialize from the floor up (each cell: 2 frames white seams + a glass
//            flash, 2 frames mag4, then its own tone) — ≈ 330 ms (fix round 1: from 250 / 380); the magenta light
//            pool spreads under the dome; while it stands a sheen band slides over the cells. Today's
//            dome lean (mirror_barrier.ts:57) is called here, same target and options (user decision:
//            the camera does not change). mirrorRaise (4 plate ticks spread over the build)
//   ≈ 650    CATCH — `catch`: the attack meets the shell high on the side facing the attacker (the old
//            streak's 0.72 rad), on its contact frame — a ranged strike's bolt (5 px, attribute colours,
//            white core) leaves the muzzle on the attack's own release frame; a melee body steps 10 px
//            toward the dome on whole pixels into its own impact frame and its blow streaks off its muzzle
//            (as the old dome's streak did for every attacker). 60 ms hit-stop. The whole dome IGNITES (the
//            old dome's pink-white glass, user decision 24 Oct "never smaller or duller"): every cell's pane
//            lights as a mag4 / mag3 checker on its inset pixels (white / mag4 round the struck point), its
//            seams mag4 / white — held through the hit-stop, then stepped down (≈ 8 frames in all, then a
//            quarter for 2); the struck cell flares as a white checker for 2 frames (still glass); a ripple
//            of lit seams runs over the whole dome (190 ms); a big whole-pixel star, pixel sparks, a magenta
//            floor flash; the dome itself trembles 1 px (local, never the camera). The body steps back
//            home. mirrorCatch
//   +0…+34   CHARGE: the seams heat up cell by cell (the hot cells light their panes), the light
//            gathers at the struck point (a growing whole-pixel star, motes drawn in) — the old charge beat,
//            cut to 2 frames (fix round 1, A5A-C1-02: the first beam leaves ≤ 180 ms after the catch)
//   ≈ +94    REFLECTION, one by one — `beam:<i>`: the first departure lights every seam and pane for a
//            frame (mag4; white only within WHITE_DISC_R of the struck point — fix round 2, A5A-C2-06: from
//            the catch on, the glass is white only there, EF-4 with every lane's HUD), the panes for 2 more, and
//            splays 7 stray 1-px reflections off the dome (the old "many beams"); then for every
//            attack-position monster of the attacking side, nearest to the struck point first, a beam
//            arcs from the struck point to the monster's core in 120 ms (7 px: mag2 / mag3 / mag4 / white
//            core — the old glowing band's width — a hard white head; fanned apart like the old ones); its
//            contact is that monster's own death (the v3 death kit: the v3 art's death pose, the old
//            art's reaction + material break), a 1-px white / magenta rim on its silhouette, a 2-frame
//            white star; the beam swells to 9 px (3-px white core) for 2 frames, then thins out by steps
//            (EF-13); a short floor strip of light. The next beam leaves 220 ms after the previous
//            contact (BEAM_GAP; 150 ms after a victim with a v3 death pose, BEAM_GAP_POSED — its long
//            pose keeps the landings apart), timed on the live show clock (hit-stops included); each
//            departure sends a small ripple over the dome. mirrorBeam, one step up per victim
//   last+120 BREAK — `break`: the dome breaks out from the struck point (340 ms, as the old one): on the
//            break frame a crack network runs out of the struck point (7 jagged 1-px rays with a branch
//            each, white then mag4, 2 frames); the cells go front-loaded (eased out: ≥ a quarter of them in
//            the first 50 ms, so the frame after the sound shows the dome breaking — fix round 2,
//            A5A-C2-02), every cell into 2–3 whole-pixel shards of its seams that fall to the floor under
//            them, rest and fade by palette steps; the floor ring steps out, the light pool goes out. Never
//            on a victim's burst: after an old-art victim (whose death bursts with its generic shatter
//            ≈ 130 ms after the contact) the break waits BREAK_CLEAR after that burst. mirrorBreak
//   with it  EXIT — `exit`: on the break the trap card lies down on its tile and leaves for the graveyard
//            from there in parallel with the shatter (card continuity), its landing kept ≥ 167 ms clear of
//            every victim's card landing (exitLanding); the camera relaxes (ctx.unfocus(320), as today).
// Fix round 1 (A5A-C1-02): tbMirror / P2 1.93 s, Direct 1.98 s, a5MirrorSlice 2.33 s, a5MirrorTriple
// 2.28 s (budgets 2.1 / 2.35 / 2.6 s; were 2.1 / 2.35 / 2.6+).
// Depths: the far shell is drawn behind the defender row's units (as the old one), the near glass in
// front of them but behind anything standing in front of the dome (the old near glass covered every unit).
// Under REDUCED_MOTION the particles and shards are halved (fxCount) and the dome does not tremble.

import type Phaser from 'phaser';
import type { PlayerId } from '../../engine/types';
import { ATTRIBUTE_RAMP, PAL, RAMPS } from '../../art/palette';
import type { PixelCanvas } from '../../art/pixel';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { BOARD_MID_COL, BOARD_OX, BOARD_OY, DEPTH, LANE_COLS, TILE_H, TILE_W, type XY, isoToScreen, monsterRow, screenToIso, zoneXY } from '../../view/layout';
import { lightBeam, lightFlash, lightPool, type LightHandle } from '../../view/light';
import { REDUCED_MOTION } from '../../view/v3/motion';
import { wait } from '../../vfx/core';
import { showClock } from '../../duel/showclock';
import { Sparks as PxSparks, stopTime } from '../../vfx/combat';
import { E, Raster, onFrame, qbez, run } from '../../vfx/setpieces';
import { fx, type CinematicContext } from '../api';
import { TK, type EvOf, all, lerpXY, live, norm, other, sub, takeAttack } from '../battle/_kit';
import { canHandOver, strikeStartFrame } from '../_v3/clash';
import { cardLeaves, flightMs } from '../_v3/card';
import { fxCount, fxRng, rimFlash } from '../_v3/spellfx';
import { atFrame, panAt, play as playV3, soundsOf, takeCharge } from '../_v3/sound';
import type { SfxHandle } from '../../audio/sfx';
import { isRanged } from './chains_of_light';
import { trapOpening, type Opening } from './_opening';

type ActCtx = CinematicContext<EvOf<'activate'>>;

// ================================================================ timing (ms, scene clock, t = 0 at activate)

/**
 * The dome starts to build as the trap card comes up (trapOpeningV3: standUp 220 ms + its 40 ms hit-stop;
 * fix round 1, C1-02: from its stand-up's last frames, so the reflections fit the named budget).
 */
export const DOME_AT = 220;
/** The build: the floor ring, then the cells from the floor up (the old dome's 380 ms; fix round 1: 330). */
export const BUILD_MS = 330;
/** The earliest contact: the dome is complete (every cell shown and settled). */
export const CATCH_AT = DOME_AT + BUILD_MS + 17;
/** Kept for the old name (the v3 panel of A-4 started here). */
export const PANEL_AT = DOME_AT;
/**
 * The attacker may let go from the trap's first frame on: its attack was declared and is already
 * coming (the slow wind-ups of the v3 art still meet the dome only after it is complete).
 */
const LAUNCH_MIN = 0;
/** A ranged strike's bolt: muzzle → shell (4 frames). */
const PROJ_MS = 66;
/** A melee lunge never takes less than this (whole-pixel steps you can read). */
const LUNGE_MIN = 160;
/** The contact hit-stop (A5 §3.3 YAKALAMA). */
const CATCH_STOP = 60;
/** The melee body thrown back home after the catch. */
const BOUNCE_MS = 150;
/** The ripple of lit seams over the dome after the catch (the old dome's 190 ms). */
export const RIPPLE_MS = 190;
/**
 * The charge (seams heat up, the light gathers at the struck point): starts this long after the hit-stop …
 * (fix round 1, C1-02: folded into the catch — the ignition's frames keep playing under the charge and the
 * first beam, so the first reflection leaves 120 ms after the contact: the hit-stop + the charge; A5 §3.3
 * YAKALAMA 520 → YANSIMA 700 ms)
 */
export const CHARGE_AT = 0;
/** … and lasts this long; the first reflection leaves when it is full. */
export const CHARGE_MS = 34;
/** A reflection: the head's travel, and the gap from one contact to the next beam (A5 §3.3). */
export const BEAM_MS = 120;
export const BEAM_GAP = 220;
/**
 * The gap after a victim that dies on its own v3 death pose (fix round 1, C1-02): its pose starts on the
 * contact frame and carries the hit itself (the crack, the collapse), so the next beam may leave 150 ms
 * after it (the beat floor) — two v3 deaths of ≈ 1.2 s each still fit the two-victim budget (2.35 s).
 */
export const BEAM_GAP_POSED = 150;
/** The dome breaks this long after the last contact. */
const BREAK_AFTER = 120;
/**
 * Fix round 2 (A5A-C2-02): the break never shares a frame with a victim's own burst (an old-art death bursts,
 * with its generic 'shatter' sound, ≈ 130 ms after its contact; two glass sounds on one frame read as one):
 * after such a last victim it waits this long after the burst …
 */
export const BREAK_CLEAR = 100;
/** … but never longer than this after the last contact (a burst that never comes). */
const BREAK_WAIT_CAP = 420;
/**
 * From the catch on, the glass is white only this close (px) to the struck point (fix round 2, A5A-C2-06): the
 * first departure lit every seam white (≈ 1800 px, 1.8 % of the frame with every lane's HUD, EF-4 ≤ 1.5 %);
 * now the seams and panes light mag4 / pink and only ≈ 150–300 px round the struck point burn white.
 */
export const WHITE_DISC_R = 11;
/** The break's crack network: rays out of the struck point (jagged 1-px, one branch each), their reach (px). */
export const CRACK_RAYS = 7;
const CRACK_REACH = [30, 58] as const;
/** The break-out of the cells (the old dome's 340 ms). */
export const SHATTER_MS = 340;
/** Two graveyard landings are at least this far apart (A5 §3.0 EF-12). */
export const LAND_GAP = 150;
/**
 * How long a victim's death takes from the beam's contact to its card landing on the graveyard
 * (the v3 death kit, measured in shots/v3/a56/baseline/measure-v3-a56-0.json: v3 art with a death
 * pose ≈ 1.05–1.12 s, the old art ≈ 0.52 s). Only used to keep two landings apart; the real landing
 * times decide the trap card's own exit.
 */
const DEATH_EST = { pose: 1220, legacy: 520 } as const;
/**
 * Where the attack meets the shell: high on the dome (the old streak's 0.72 rad), on the side facing the
 * attacker — the reflections then fan down from it to every victim, over the units in front.
 */
const STRUCK_EL = 0.72;
/** A melee body's step toward the dome before its blow streaks off (the old lunge: 8 px). */
const MELEE_STEP = 10;
/**
 * The catch ignites the dome (the old dome's pink-white glass, ≈ 8 frames): in dome frames after the catch
 * (the hit-stop holds frame 0, ≈ 4 rendered frames) every cell's pane is lit up to `lit` — hot (white)
 * round the struck point up to `hot` — then a quarter of the glass up to `fade`, then the ripple and the
 * charge carry on.
 */
export const IGNITE = { hot: 1, lit: 3, fade: 5 } as const;
/** How far round the struck point (lattice units: about the struck cell and its ring) the glass burns white. */
const HOT_R = 0.3;
/**
 * How far round the struck point the seams burn white on the first reflection's flash frame (lattice units,
 * about a third of the cells; mag4 further out): the whole frame stays ≤ 1.5 % white with the HUD (EF-4).
 */
const FLASH_WHITE_R = 0.6;

// ================================================================ pure helpers (tested)

/** Victims in reflection order: nearest to the struck point first (A5 §3.3); ties keep the event order. */
export function reflectionOrder(cell: XY, cores: readonly XY[]): number[] {
  return cores
    .map((p, i) => ({ i, d: Math.hypot(p.x - cell.x, p.y - cell.y) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((o) => o.i);
}

/**
 * Fix round 3 (the graveyard's top card): the Director's syncs set a pile's top card from the ENGINE's destroy
 * order, so when the cards land in another order (nearest victim first) the top card flips on a frame where no
 * card lands. The slots stay nearest-first, but the victims of ONE owner (they share a pile) fill their slots in
 * engine order (`owners[i]` = the owner of victim i; victims are indexed in engine order).
 */
export function engineOrderPerOwner(order: readonly number[], owners: readonly number[]): number[] {
  const out = [...order];
  for (const o of new Set(owners)) {
    const slots = out.map((v, k) => (owners[v] === o ? k : -1)).filter((k) => k >= 0);
    const vs = slots.map((k) => out[k]).sort((a, b) => a - b);
    slots.forEach((k, j) => (out[k] = vs[j]));
  }
  return out;
}

/**
 * When each beam leaves (ms after the first one leaves): 220 ms after the previous contact, pushed later
 * when this victim's card would land within LAND_GAP (+ a little margin) of an earlier one's.
 */
export function beamSchedule(deathMs: readonly number[], o: { beamMs?: number; gap?: number; gaps?: readonly number[]; landGap?: number; ordered?: boolean } = {}): number[] {
  const beamMs = o.beamMs ?? BEAM_MS;
  const landGap = (o.landGap ?? LAND_GAP) + 20;
  const out: number[] = [];
  const lands: number[] = [];
  let at = 0;
  deathMs.forEach((d, k) => {
    // the gap after the previous contact: per victim (`gaps[k]`), else one for all
    if (k > 0) at = out[k - 1] + beamMs + (o.gaps?.[k] ?? o.gap ?? BEAM_GAP);
    // push this beam later until its landing keeps clear of every earlier landing
    for (let guard = 0; guard < 8; guard++) {
      const land = at + beamMs + d;
      // `ordered`: a card never lands before an earlier beam's (the pile's top card is the engine's last)
      const clash = lands.find((l) => Math.abs(land - l) < landGap || (o.ordered && land < l));
      if (clash === undefined) break;
      at += Math.max(1, clash + landGap - land);
    }
    out.push(at);
    lands.push(at + beamMs + d);
  });
  return out;
}

/**
 * The break-out front (fix round 2, A5A-C2-02): a cell breaks once brk · 0.7 + d · 0.3 < this, `el` ms after the
 * break — eased out, front-loaded (the old linear ramp released < 10 % of the cells in the first 50 ms, so the
 * 1× frame after the sound still showed a whole dome).
 */
export function shatterFront(el: number): number {
  const t = Math.max(0, el / SHATTER_MS);
  // eased out over SHATTER_MS (above the old line all the way), then on along the old line: the farthest cells
  // (key up to 0.7 + 0.3 · their lattice distance) go exactly when they did
  return (t < 1 ? 1 - (1 - t) ** 3 : t) * 1.15;
}
/** A cell's place in the break-out (its random part and its lattice distance from the struck point). */
export function shatterKey(brk: number, d: number): number {
  return brk * 0.7 + d * 0.3;
}

// ================================================================ the dome: shape and pixel field (pure)

const HW = TILE_W / 2;
const HH = TILE_H / 2;
const SQ3 = Math.sqrt(3);
/** The old dome's hex size in lattice units (./_mirror.ts HEX). */
const HEX = 0.13;

/** The old dome's ellipsoid (./_mirror.ts mirrorDomeTB, unchanged): over the defender's whole monster row. */
export interface DomeShape {
  /** Grid centre (the board's middle column, the defender's monster row) and the half axes (grid units / px). */
  a0: number;
  b0: number;
  ra: number;
  rb: number;
  rz: number;
  /** The hex lattice's side stretch (a wider v2 dome keeps its cells about a tile-scale wide). */
  huK: number;
  /** Screen centre of the floor ellipse. */
  c: XY;
  /** The old dome's raster box (x0 / y0 inclusive, x1 / y1 exclusive). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function domeShape(side: PlayerId): DomeShape {
  const a0 = BOARD_MID_COL;
  const b0 = monsterRow(side);
  // spanning the outer lanes (v1 cols 1–3 of 5, v2 cols 1–5 of 7) with 0.78 tiles to spare
  const ra = (LANE_COLS[LANE_COLS.length - 1] - LANE_COLS[0]) / 2 + 0.78;
  const rb = 1.02;
  const rz = 84 * TK;
  const c = isoToScreen(a0, b0);
  return {
    a0,
    b0,
    ra,
    rb,
    rz,
    huK: ra / 1.78,
    c,
    x0: Math.floor(c.x - (ra + rb) * HW) - 3,
    x1: Math.ceil(c.x + (ra + rb) * HW) + 3,
    y0: Math.floor(c.y - (ra + rb) * HH - rz) - 3,
    y1: Math.ceil(c.y + (ra + rb) * HH) + 3,
  };
}

/** The hex cell of a lattice point (./_mirror.ts hexAt): its axial coordinates and centre. */
function hexAt(u: number, v: number): { rx: number; rz: number; cu: number; cv: number } {
  const q = ((SQ3 / 3) * u - (1 / 3) * v) / HEX;
  const r = ((2 / 3) * v) / HEX;
  let rx = Math.round(q);
  let rz = Math.round(r);
  const ry = Math.round(-q - r);
  const dx = Math.abs(rx - q);
  const dy = Math.abs(ry - (-q - r));
  const dz = Math.abs(rz - r);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy <= dz) rz = -rx - ry;
  return { rx, rz, cu: HEX * SQ3 * (rx + rz / 2), cv: HEX * 1.5 * rz };
}

/** A deterministic 0…1 hash (./_mirror.ts). */
function hash01(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** What a dome pixel is. */
export const DOME_PX = { none: 0, glass: 1, seam: 2, rim: 3, spec: 4, spec2: 5, foot: 6 } as const;

export interface DomeCell {
  /** Lattice centre (u · huK, v: the side axis and the height). */
  cu: number;
  cv: number;
  /** 0…1: when it materializes in the build (the floor first, a little random). */
  born: number;
  /** 0…1 random: its place in the break (with its distance from the struck point). */
  brk: number;
  /** On the near (front) glass, or the far one. */
  near: boolean;
  /** Its seam pixels (world) and the floor y under each (where a shard of it lands). */
  seams: { x: number; y: number; f: number }[];
}

export interface DomeShell {
  /** DOME_PX per pixel (row-major over the box). */
  kind: Uint8Array;
  /** The pixel's cell (index into DomeField.cells), −1 = no glass here. */
  cell: Int32Array;
  /** Grazing level 0…3 (3 = the glass seen edge-on, along the outline). */
  fres: Uint8Array;
  /**
   * 1 = clear glass whose four neighbours are clear glass of the same cell: a lit cell's pane (the catch,
   * the charge's hottest cells) is a checker on these pixels only, so a 1-px dark gap keeps every seam
   * readable and the shell stays under half covered (EF-2).
   */
  inset: Uint8Array;
}

export interface DomeField {
  shape: DomeShape;
  w: number;
  h: number;
  near: DomeShell;
  far: DomeShell;
  cells: DomeCell[];
}

/**
 * Every pixel of the old dome's two shells (the same ray march as ./_mirror.ts: a pixel's floor point
 * slides 1/TILE_H grid units per px of height), classified once: the 1-px seams between hex cells (a
 * pixel whose right or lower neighbour lies in another cell), the 1-px outline of the near glass (and the
 * far glass's foot on the floor), the specular streak (the old one, light from the screen's upper left),
 * and the clear glass with its grazing level. The animation only picks tones per cell afterwards.
 */
export function domeField(shape: DomeShape): DomeField {
  const { a0, b0, ra, rb, rz, huK, x0, y0, x1, y1 } = shape;
  const w = x1 - x0;
  const h = y1 - y0;
  const n = w * h;
  const k = 1 / TILE_H;
  const qa = (k * k) / (ra * ra) + (k * k) / (rb * rb) + 1 / (rz * rz);
  const keyOf = [new Int32Array(n).fill(-1), new Int32Array(n).fill(-1)];
  const thick = new Float32Array(n);
  const U = [new Float32Array(n), new Float32Array(n)];
  const V = [new Float32Array(n), new Float32Array(n)];
  const Wr = [new Float32Array(n), new Float32Array(n)];
  const Z = [new Float32Array(n), new Float32Array(n)];
  const cellOf = new Map<number, number>();
  const cells: DomeCell[] = [];
  for (let j = 0; j < h; j++) {
    const q0 = (y0 + j - BOARD_OY) / HH;
    for (let i = 0; i < w; i++) {
      const P = (x0 + i + 0.5 - BOARD_OX) / HW;
      const A0 = (P + q0) / 2 - a0;
      const B0 = (q0 - P) / 2 - b0;
      const qb = 2 * k * (A0 / (ra * ra) + B0 / (rb * rb));
      const qc = (A0 * A0) / (ra * ra) + (B0 * B0) / (rb * rb) - 1;
      const disc = qb * qb - 4 * qa * qc;
      if (disc < 0) continue;
      const sq = Math.sqrt(disc);
      const idx = j * w + i;
      thick[idx] = sq / (2 * qa) / rz;
      for (let pass = 0; pass < 2; pass++) {
        // pass 0: the near shell (the larger height on this pixel's view ray), 1: the far one
        const z = pass === 0 ? (-qb + sq) / (2 * qa) : (-qb - sq) / (2 * qa);
        if (z < 0) continue;
        const u = (A0 + z * k) / ra;
        const wv = (B0 + z * k) / rb;
        const v = z / rz;
        const hx = hexAt(u * huK, v);
        const key = ((hx.rx + 512) * 1024 + (hx.rz + 512)) * 2 + pass;
        let c = cellOf.get(key);
        if (c === undefined) {
          c = cells.length;
          cellOf.set(key, c);
          const id = hx.rx * 131 + hx.rz * 17;
          cells.push({ cu: hx.cu, cv: hx.cv, born: Math.max(0, Math.min(1, hx.cv * 0.8 + hash01(id) * 0.2)), brk: hash01(id + 7 + pass * 3), near: pass === 0, seams: [] });
        }
        keyOf[pass][idx] = c;
        U[pass][idx] = u;
        V[pass][idx] = v;
        Wr[pass][idx] = wv;
        Z[pass][idx] = z;
      }
    }
  }
  const shell = (): DomeShell => ({ kind: new Uint8Array(n), cell: new Int32Array(n).fill(-1), fres: new Uint8Array(n), inset: new Uint8Array(n) });
  const near = shell();
  const far = shell();
  for (let pass = 0; pass < 2; pass++) {
    const S = pass === 0 ? near : far;
    const K = keyOf[pass];
    const at = (i: number, j: number): number => (i < 0 || j < 0 || i >= w || j >= h ? -1 : K[j * w + i]);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const idx = j * w + i;
        const c = K[idx];
        if (c < 0) continue;
        S.cell[idx] = c;
        const fr = 1 - Math.min(1, thick[idx] * 2.2);
        S.fres[idx] = fr >= 0.85 ? 3 : fr >= 0.7 ? 2 : fr >= 0.45 ? 1 : 0;
        const r = at(i + 1, j);
        const d = at(i, j + 1);
        const edge = r < 0 || d < 0 || at(i - 1, j) < 0 || at(i, j - 1) < 0;
        let kind: number = DOME_PX.glass;
        if (edge) kind = pass === 0 ? DOME_PX.rim : DOME_PX.foot;
        else if (r !== c || d !== c) kind = DOME_PX.seam;
        const u = U[pass][idx];
        const v = V[pass][idx];
        if (pass === 0 && kind !== DOME_PX.rim && Wr[pass][idx] > 0) {
          // the old specular streaks on the near glass (light from the upper left)
          if (Math.abs(u + 0.44 - (v - 0.62) * 0.35) < 0.025 && v > 0.42 && v < 0.86) kind = DOME_PX.spec;
          else if (Math.abs(u + 0.36 - (v - 0.62) * 0.35) < 0.012 && v > 0.55 && v < 0.75) kind = DOME_PX.spec2;
        }
        S.kind[idx] = kind;
        if (kind === DOME_PX.seam || kind === DOME_PX.foot) cells[c].seams.push({ x: x0 + i, y: y0 + j, f: Math.round(y0 + j + Z[pass][idx]) });
      }
    // the panes: clear glass with clear glass of its own cell on all four sides
    const clear = (i: number, j: number, c: number): boolean => i >= 0 && j >= 0 && i < w && j < h && S.cell[j * w + i] === c && S.kind[j * w + i] === DOME_PX.glass;
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const idx = j * w + i;
        const c = S.cell[idx];
        if (c >= 0 && S.kind[idx] === DOME_PX.glass && clear(i + 1, j, c) && clear(i - 1, j, c) && clear(i, j + 1, c) && clear(i, j - 1, c)) S.inset[idx] = 1;
      }
  }
  return { shape, w, h, near, far, cells };
}

/** One frame's look of the dome, per cell. */
export interface DomeLook {
  /** 0 not yet, 1 shown, 2 broken. */
  vis: Uint8Array;
  /** 0 its own tone, 1 one step up, 2 white seams, 3 the whole cell white (seams + glass). */
  heat: Uint8Array;
  /** Materializing: 2 = white seams + a glass flash, 1 = mag4 seams, 0 settled. */
  fresh: Uint8Array;
  /**
   * The glass lit up (the catch ignites every cell, the charge its hottest ones — the old dome's pink-white
   * glass): 0 off, 1 a quarter of the glass mag3 + mag4 seams, 2 the pane lit (mag4 / mag3 checker on the
   * inset pixels) + mag4 seams, 3 hot (white / mag4 pane, white seams).
   */
  glow: Uint8Array;
  /**
   * When set (from the catch on): the heat / glow white burns only inside this disc (world px, r² squared
   * radius) — mag4 outside it (EF-4; fix round 2, A5A-C2-06). The materializing seams and the specular streak
   * are not limited.
   */
  whiteDisc: { x: number; y: number; r2: number } | null;
}

export function domeLook(cells: number, shown = true): DomeLook {
  return { vis: new Uint8Array(cells).fill(shown ? 1 : 0), heat: new Uint8Array(cells), fresh: new Uint8Array(cells), glow: new Uint8Array(cells), whiteDisc: null };
}

/**
 * Paint one shell of the dome into `p` (its pixel (0, 0) = the box's top left): palette tones only, no
 * alpha; the glass is lit in 2×2 Bayer quarter steps (REHBER EF-6), never more than half its pixels.
 * Near glass: outline mag4, seams mag3 at grazing angles / mag2 where you look straight through, the old
 * dome's pink glass tint (mag2 on a quarter of the pixels where the glass is seen edge-on, half of them
 * along the outline, mag1 further in, clear in the middle), the white streak. Heat lights the seams by
 * steps (mag4, white) and the glass with them (a quarter mag3 / mag4: the ripple, the charge). Glow lights
 * the glass itself (the old dome's pink-white glass on the catch): a quarter of it, or the pane — a
 * mag4 / mag3 (hot: white / mag4) checker on the inset pixels, clear next to the seams, so the honeycomb
 * stays readable and under half the shell is covered. Far glass: seams mag1 / mag2 (lit: mag3 / mag4),
 * its foot on the floor mag2, a quarter mag1 tint edge-on.
 */
export function paintDomeShell(p: PixelCanvas, f: DomeField, which: 'near' | 'far', L: DomeLook): void {
  const S = which === 'near' ? f.near : f.far;
  const { w, h } = f;
  const { x0, y0 } = f.shape;
  const near = which === 'near';
  const disc = L.whiteDisc;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const idx = j * w + i;
      const c = S.cell[idx];
      if (c < 0 || L.vis[c] !== 1) continue;
      const kind = S.kind[idx];
      const heat = L.heat[c];
      const fresh = L.fresh[c];
      const glow = L.glow[c];
      const fr = S.fres[idx];
      // the 2×2 Bayer quarter pixels: b0 = the first quarter, b1 = its diagonal partner (b0 + b1 = the checker)
      const ex = ((x0 + i) & 1) === 0;
      const ey = ((y0 + j) & 1) === 0;
      const b0 = ex && ey;
      const b1 = !ex && !ey;
      // the heat / glow white: only inside the white disc once it is set (EF-4), mag4 outside it
      const W = disc && ((x0 + i - disc.x) ** 2 + (y0 + j - disc.y) ** 2 > disc.r2) ? PAL.mag4 : PAL.white;
      let col = -1;
      if (near) {
        if (kind === DOME_PX.rim) col = fresh >= 2 ? PAL.white : heat >= 2 || glow >= 3 ? W : PAL.mag4;
        else if (kind === DOME_PX.seam) col = fresh >= 2 ? PAL.white : heat >= 2 || glow >= 3 ? W : heat === 1 || fresh === 1 || glow >= 1 ? PAL.mag4 : fr >= 2 ? PAL.mag3 : PAL.mag2;
        else if (kind === DOME_PX.spec) col = PAL.white;
        else if (kind === DOME_PX.spec2) col = heat >= 2 || glow >= 2 ? W : PAL.mag4;
        // the struck panel flares as a white checker (every other pixel): still glass, what is behind shows through
        else if (heat >= 3) col = b0 || b1 ? W : -1;
        else if (fresh >= 2) col = b0 || b1 ? PAL.mag3 : -1;
        // the lit pane: a checker on the inset pixels (white / mag4 when hot, mag4 / mag3), clear by the seams
        // (fix round 3: the panes stay one value step darker than the seams beside them — the seams are white
        // in the hot disc, else mag4 — so the honeycomb net still reads at phone size)
        else if (glow >= 2) {
          const top = glow >= 3 && W === PAL.white ? PAL.mag4 : PAL.mag3;
          const low = top === PAL.mag4 ? PAL.mag3 : PAL.mag2;
          col = S.inset[idx] === 0 ? -1 : b0 ? top : b1 ? low : -1;
        }
        // the glass glows with its seams on the ripple / charge / the ignition's last step (a quarter of its pixels)
        else if (b0 && (heat >= 1 || glow >= 1)) col = heat >= 2 ? PAL.mag4 : PAL.mag3;
        // the pink glass tint, brighter where the glass is seen edge-on
        else if (b0) col = fr >= 2 ? PAL.mag2 : fr === 1 ? PAL.mag1 : -1;
        else if (b1 && fr >= 3) col = PAL.mag2;
      } else {
        if (kind === DOME_PX.seam || kind === DOME_PX.foot) col = heat >= 2 || fresh >= 2 || glow >= 3 ? PAL.mag4 : heat === 1 || fresh === 1 || glow >= 1 ? PAL.mag3 : kind === DOME_PX.foot || fr >= 2 ? PAL.mag2 : PAL.mag1;
        else if (heat >= 3) col = b0 || b1 ? PAL.mag4 : -1;
        else if (fresh >= 2) col = b0 || b1 ? PAL.mag1 : -1;
        else if (b0 && heat >= 2) col = PAL.mag2;
        else if (b0 && fr >= 2) col = PAL.mag1;
      }
      if (col >= 0) p.set(i, j, col);
    }
}

/** The dome's floor ellipse (its foot on the floor), whole pixels, front first (the old base ring). */
export function domeRing(shape: DomeShape, scale = 1): XY[] {
  const { a0, b0, ra, rb } = shape;
  const out: XY[] = [];
  const seen = new Set<number>();
  const n = 720;
  // the front: the ellipse's lowest point on screen (screen y grows with col + row)
  const front = Math.atan2(rb, ra);
  for (let i = 0; i < n; i++) {
    // from the front round both sides to the back
    const k = i / n;
    const side = i % 2 === 0 ? 1 : -1;
    const t = front + side * k * Math.PI;
    const p = isoToScreen(a0 + Math.cos(t) * ra * scale, b0 + Math.sin(t) * rb * scale);
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const key = y * 4096 + x;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ x, y });
  }
  return out;
}

// ================================================================ the dome at runtime

/** Where the attack meets the shell. */
interface DomeHit {
  x: number;
  y: number;
  /** Lattice point (u · huK, v). */
  hu: number;
  hv: number;
  /** Floor y under it. */
  floorY: number;
  /** On the near glass (facing the viewer) or the far one. */
  near: boolean;
  /** Its cell (−1: none found). */
  cell: number;
}

interface Shard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** The floor y it lands on. */
  f: number;
  /** Its tone: an index into SHARD_RAMP. */
  ci: number;
  shape: number;
  /** ms since it landed (−1 in the air). */
  landed: number;
}

/** Shard tones, dark → light (a landed shard steps down one tone every 60 ms after a 100 ms rest). */
const SHARD_RAMP = [PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag4, PAL.white] as const;
const SHARD_SHAPES: readonly (readonly [number, number][])[] = [[[0, 0]], [[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0], [0, 1]]];

/** Whole-pixel shards that fall to their own floor y, rest, and fade down SHARD_RAMP (no alpha). */
class ShardLayer {
  private readonly r: Raster;
  private readonly list: Shard[] = [];
  private dead = false;
  private stopFn: () => void;
  constructor(scene: Phaser.Scene, box: { x: number; y: number; w: number; h: number }, depth: number) {
    this.r = new Raster(scene, box.x, box.y, box.w, box.h, depth);
    this.stopFn = onFrame(scene, (dt) => this.tick(dt));
  }
  add(s: Shard): void {
    if (!this.dead) this.list.push(s);
  }
  get size(): number {
    return this.list.length;
  }
  private tick(dt: number): boolean {
    if (this.dead) return false;
    const s = dt / 1000;
    this.r.begin();
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      let ci = p.ci;
      if (p.landed < 0) {
        p.vy += 420 * s;
        p.x += p.vx * s;
        p.y += p.vy * s;
        if (p.y >= p.f) {
          p.y = p.f;
          p.landed = 0;
        }
      } else {
        p.landed += dt;
        ci -= Math.floor(Math.max(0, p.landed - 100) / 60);
        if (ci < 0) {
          this.list.splice(i, 1);
          continue;
        }
      }
      const c = SHARD_RAMP[ci];
      for (const [ox, oy] of SHARD_SHAPES[p.shape]) this.r.px(Math.round(p.x) + ox, Math.round(p.y) + oy, c);
    }
    this.r.end();
    return true;
  }
  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.stopFn();
    this.r.destroy();
  }
}

/**
 * The dome on the board: the field painted on three rasters (far glass behind the defender row's units,
 * near glass in front of them, the floor ring on the floor), animated per cell on the scene clock.
 */
class DomeV3 {
  readonly shape: DomeShape;
  readonly field: DomeField;
  private readonly scene: Phaser.Scene;
  private readonly nearR: Raster;
  private readonly farR: Raster;
  private readonly baseR: Raster;
  private readonly look: DomeLook;
  private readonly appear: Int32Array;
  private readonly ring: XY[];
  private readonly ringIn: XY[];
  private readonly nearShards: ShardLayer;
  private readonly farShards: ShardLayer;
  private readonly sparks: PxSparks;
  private readonly rnd: () => number;
  private frame = 0;
  private el = 0;
  private buildAt = -1;
  private ringK = 0;
  private ringFade = 0;
  private ripple: { at: number; hu: number; hv: number; ms: number; reach: number } | null = null;
  private struck: { cell: number; at: number } | null = null;
  private ignite: { at: number; hu: number; hv: number } | null = null;
  private charge = 0;
  private flashAt = -1;
  private flashHit: DomeHit | null = null;
  private brk: { at: number; hu: number; hv: number } | null = null;
  /** The break's crack network (fix round 2, A5A-C2-02): its pixels (with their reach from the struck point), its raster, its frame. */
  private cracks: { px: { x: number; y: number; d: number; tip: boolean }[]; ras: Raster; f: number; loop: number } | null = null;
  private trembleFrom = -1;
  private dead = false;
  private readonly stopFn: () => void;

  constructor(scene: Phaser.Scene, side: PlayerId, seed: number) {
    this.scene = scene;
    this.shape = domeShape(side);
    this.field = domeField(this.shape);
    const { x0, y0, c } = this.shape;
    const { w, h } = this.field;
    this.rnd = fxRng(seed);
    // the far glass behind the row's units (the old depth); the near glass in front of the row but
    // behind anything standing in front of the dome (the attacker's row)
    this.farR = new Raster(scene, x0, y0, w, h, DEPTH.UNIT + c.y - HH - 1);
    this.nearR = new Raster(scene, x0, y0, w, h, DEPTH.UNIT + c.y + HH + 0.5);
    this.baseR = new Raster(scene, x0, y0, w, h + 4, DEPTH.SHADOW - 1);
    this.look = domeLook(this.field.cells.length, false);
    this.appear = new Int32Array(this.field.cells.length).fill(-1);
    this.ring = domeRing(this.shape);
    this.ringIn = domeRing(this.shape, 0.93);
    const shardBox = { x: x0 - 40, y: y0 - 20, w: w + 80, h: h + 60 };
    this.farShards = new ShardLayer(scene, shardBox, DEPTH.UNIT + c.y - HH - 0.5);
    this.nearShards = new ShardLayer(scene, shardBox, DEPTH.UNIT + c.y + HH + 0.6);
    this.sparks = new PxSparks(scene, DEPTH.FX + 6);
    this.stopFn = onFrame(scene, (dt) => this.tick(dt));
  }

  /** The point of the shell facing `from` (a floor point) at elevation `el` (0 floor … π/2 crown). */
  point(from: XY, el: number): DomeHit {
    const { a0, b0, ra, rb, rz, huK, x0, y0 } = this.shape;
    const g = screenToIso(from.x, from.y);
    let du = (g.col - a0) / ra;
    let dw = (g.row - b0) / rb;
    const l = Math.hypot(du, dw) || 1;
    du /= l;
    dw /= l;
    const u = du * Math.cos(el);
    const w = dw * Math.cos(el);
    const v = Math.sin(el);
    const scr = isoToScreen(a0 + u * ra, b0 + w * rb);
    const x = Math.round(scr.x);
    const y = Math.round(scr.y - v * rz);
    // it faces the viewer when its normal leans toward the view ray (+col, +row, up)
    const near = (u / ra + w / rb) / TILE_H + v / rz > 0;
    const S = near ? this.field.near : this.field.far;
    let cell = -1;
    for (let r = 0; r < 4 && cell < 0; r++)
      for (let dy = -r; dy <= r && cell < 0; dy++)
        for (let dx = -r; dx <= r && cell < 0; dx++) {
          const i = x + dx - x0;
          const j = y + dy - y0;
          if (i < 0 || j < 0 || i >= this.field.w || j >= this.field.h) continue;
          cell = S.cell[j * this.field.w + i];
        }
    return { x, y, hu: u * huK, hv: v, floorY: Math.round(scr.y), near, cell };
  }

  /** Materialize (BUILD_MS): the floor ring, then the cells from the floor up. Resolves when every cell is shown. */
  build(): Promise<void> {
    this.buildAt = this.el;
    return new Promise((resolve) => {
      onFrame(this.scene, () => {
        if (this.dead || this.look.vis.every((v) => v !== 0)) {
          resolve();
          return false;
        }
        return true;
      });
    });
  }

  /**
   * The catch: every cell's glass ignites (IGNITE: the lit panes, white round the struck point), the struck
   * cell a white checker, a ripple of lit seams over the dome, a 1-px local tremble.
   */
  strike(hit: DomeHit): void {
    // from the catch on, the glass burns white only round the struck point (EF-4; fix round 2, A5A-C2-06)
    this.look.whiteDisc = { x: hit.x, y: hit.y, r2: WHITE_DISC_R * WHITE_DISC_R };
    if (hit.cell >= 0) this.struck = { cell: hit.cell, at: this.frame };
    this.ignite = { at: this.frame, hu: hit.hu, hv: hit.hv };
    this.ripple = { at: this.el, hu: hit.hu, hv: hit.hv, ms: RIPPLE_MS, reach: 2.2 };
    if (!REDUCED_MOTION) this.trembleFrom = this.frame;
  }

  /** A small ripple from the struck point (each reflection leaving). */
  pulse(hit: DomeHit): void {
    this.ripple = { at: this.el, hu: hit.hu, hv: hit.hv, ms: 150, reach: 1.2 };
    if (hit.cell >= 0) this.struck = { cell: hit.cell, at: this.frame - 2 };
  }

  /** 0…1: the seams heat up cell by cell. */
  setCharge(k: number): void {
    this.charge = Math.max(0, Math.min(1, k));
  }

  /**
   * The first reflection leaving: every seam lights up for a frame — white round the struck point, mag4
   * further out (EF-4: never a white sheet) — and mag4 the next frame; the panes light with them (2 frames,
   * then a quarter for 2). Its frame 0 is the next one painted (this is called between frames).
   */
  flash(hit: DomeHit): void {
    this.flashAt = this.frame + 1;
    this.flashHit = hit;
  }

  /**
   * Break: the cells break out from the struck point over SHATTER_MS, each into 2–3 whole-pixel shards of
   * its seams that fall to the floor under them; the floor ring steps out. Resolves when the cells are gone.
   */
  shatter(hit: DomeHit): Promise<void> {
    this.brk = { at: this.el, hu: hit.hu, hv: hit.hv };
    // the crack network, drawn on this very frame (the sound's): white, then mag4 the next frame, then gone
    this.cracks = { px: this.crackNet(hit), ras: new Raster(this.scene, this.shape.x0, this.shape.y0, this.field.w, this.field.h, DEPTH.UNIT + this.shape.c.y + HH + 0.7), f: 0, loop: this.scene.game.loop.frame };
    this.drawCracks();
    const { c } = this.shape;
    const n = fxCount(28);
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * Math.PI * 2;
      const sp = 40 + this.rnd() * 90;
      const p = { x: Math.round(c.x + (this.rnd() - 0.5) * 120 * TK), y: Math.round(c.y - this.shape.rz * (0.3 + this.rnd() * 0.6)) };
      this.sparks.add({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 30, ay: 260, drag: 1.5, life: 300 + Math.floor(this.rnd() * 300), delay: Math.floor(this.rnd() * SHATTER_MS * 0.7), colors: [PAL.white, PAL.mag4, PAL.mag3, PAL.mag2], shape: i % 3 === 0 ? 'plus' : 'px', fadeAt: 1 });
    }
    return new Promise((resolve) => {
      const stop = onFrame(this.scene, () => {
        if (this.dead || this.look.vis.every((v) => v === 2)) {
          resolve();
          stop();
          return false;
        }
        return true;
      });
    });
  }

  /**
   * The break's crack network: CRACK_RAYS jagged 1-px rays out of the struck point over the glass (both shells;
   * a ray stops where the glass ends), a vertex every 5–7 px with a 1–2 px sideways kink, one branch each at
   * 40–60 % of its reach. Each pixel keeps its reach from the struck point (white near it, mag4 further out).
   */
  private crackNet(hit: DomeHit): { x: number; y: number; d: number; tip: boolean }[] {
    const { x0, y0 } = this.shape;
    const { w, h, near, far } = this.field;
    const out: { x: number; y: number; d: number; tip: boolean }[] = [];
    const seen = new Set<number>();
    const onGlass = (x: number, y: number) => {
      const i = x - x0;
      const j = y - y0;
      if (i < 0 || j < 0 || i >= w || j >= h) return false;
      return near.cell[j * w + i] >= 0 || far.cell[j * w + i] >= 0;
    };
    const ray = (sx: number, sy: number, ang: number, reach: number, d0: number, branch: boolean): void => {
      let px = sx;
      let py = sy;
      let d = d0;
      let alive = true;
      while (alive && d - d0 < reach) {
        const step = 5 + Math.floor(this.rnd() * 3);
        const kink = (this.rnd() < 0.5 ? -1 : 1) * (1 + Math.floor(this.rnd() * 2));
        // the ray runs flatter on screen (the glass curves away), kinks sideways now and then
        const nx = Math.round(px + Math.cos(ang) * step - Math.sin(ang) * kink * 0.6);
        const ny = Math.round(py + Math.sin(ang) * step * 0.8 + Math.cos(ang) * kink * 0.6);
        const segD = d;
        bres(px, py, nx, ny, (x, y) => {
          if (!alive) return;
          if (!onGlass(x, y)) {
            alive = false;
            return;
          }
          const k = (y << 12) + x;
          if (seen.has(k)) return;
          seen.add(k);
          out.push({ x, y, d: segD + Math.hypot(x - px, y - py), tip: false });
        });
        if (!alive) break;
        if (branch && d - d0 >= reach * (0.4 + this.rnd() * 0.2) && d - d0 < reach * 0.6 + step) {
          branch = false;
          ray(nx, ny, ang + (this.rnd() < 0.5 ? -1 : 1) * (0.5 + this.rnd() * 0.3), reach * 0.4, d + step, false);
        }
        px = nx;
        py = ny;
        d += step;
      }
      // the last few pixels of a ray are its fading tip
      for (let q = out.length - 1, n = 0; q >= 0 && n < 3; q--, n++) out[q].tip = true;
    };
    for (let r = 0; r < CRACK_RAYS; r++) {
      const ang = ((r + 0.5) / CRACK_RAYS) * Math.PI * 2 + (this.rnd() - 0.5) * 0.5;
      const reach = CRACK_REACH[0] + this.rnd() * (CRACK_REACH[1] - CRACK_REACH[0]);
      ray(hit.x, hit.y, ang, reach, 0, true);
    }
    return out;
  }

  /** The crack network's frame: 0 white (mag4 out at the tips and past 60 % of the reach), 1 mag4 (white round the struck point), then gone. */
  private drawCracks(): void {
    const cr = this.cracks;
    if (!cr) return;
    if (cr.f >= 2) {
      cr.ras.destroy();
      this.cracks = null;
      return;
    }
    const r = cr.ras;
    r.begin();
    for (const q of cr.px) {
      const col = cr.f === 0 ? (q.tip ? PAL.mag3 : q.d <= CRACK_REACH[1] * 0.6 ? PAL.white : PAL.mag4) : q.d <= WHITE_DISC_R ? PAL.white : q.tip ? PAL.mag2 : PAL.mag4;
      r.px(q.x, q.y, col);
    }
    r.end();
  }

  private emitShards(ci: number): void {
    const cell = this.field.cells[ci];
    const layer = cell.near ? this.nearShards : this.farShards;
    const seams = cell.seams;
    if (!seams.length) return;
    const k = fxCount(cell.near ? 2 + Math.floor(this.rnd() * 2) : 1 + Math.floor(this.rnd() * 2));
    const { c } = this.shape;
    // its brightest shard keeps the cell's tone at the moment it breaks (4 white, 3 mag4, 2 mag3)
    const top = this.look.heat[ci] >= 2 ? 4 : cell.near ? 3 : 2;
    for (let j = 0; j < k; j++) {
      const q = seams[Math.floor(this.rnd() * seams.length)];
      const dx = q.x - c.x;
      const l = Math.abs(dx) || 1;
      layer.add({
        x: q.x,
        y: q.y,
        vx: (dx / l) * (14 + this.rnd() * 30) + (this.rnd() - 0.5) * 16,
        vy: -(16 + this.rnd() * 46),
        f: Math.max(q.y, q.f) + Math.floor(this.rnd() * 3),
        ci: j === 0 ? top : 2,
        shape: Math.floor(this.rnd() * SHARD_SHAPES.length),
        landed: -1,
      });
    }
  }

  private tick(dt: number): boolean {
    if (this.dead) return false;
    if (dt > 0) this.frame++;
    this.el += dt;
    const F = this.field;
    const L = this.look;
    const cells = F.cells;
    // build: the ring first (the first 30 %), the cells from the floor up (born ≤ progress)
    if (this.buildAt >= 0) {
      const t = Math.min(1, (this.el - this.buildAt) / BUILD_MS);
      this.ringK = Math.min(1, t / 0.3);
      const prog = (t - 0.08) / 0.8;
      for (let i = 0; i < cells.length; i++)
        if (this.appear[i] < 0 && cells[i].born <= prog) {
          this.appear[i] = this.frame;
          L.vis[i] = 1;
        }
    }
    // the break: cells go from the struck point out (and in a random order), each into shards — front-loaded
    // (shatterFront: eased out), the crack network on its first two frames
    if (this.brk) {
      // (one step per game frame after the one it was drawn on: called mid-frame, its white frame is rendered)
      const lf = this.scene.game.loop.frame;
      if (this.cracks && dt > 0 && lf > this.cracks.loop) {
        this.cracks.loop = lf;
        this.cracks.f++;
        this.drawCracks();
      }
      const tb = shatterFront(this.el - this.brk.at);
      for (let i = 0; i < cells.length; i++) {
        if (L.vis[i] === 2) continue;
        const d = Math.hypot(cells[i].cu - this.brk.hu, cells[i].cv - this.brk.hv);
        if (shatterKey(cells[i].brk, d) < tb) {
          if (L.vis[i] === 1) this.emitShards(i);
          L.vis[i] = 2;
        }
      }
      this.ringFade = Math.min(4, Math.floor(Math.max(0, this.el - this.brk.at) / 70));
    }
    // per-cell tones
    const rip = this.ripple;
    const rt = rip ? (this.el - rip.at) / rip.ms : 2;
    if (rip && rt >= 1) this.ripple = null;
    const sheenT = this.buildAt >= 0 ? ((this.el - this.buildAt) / 1500) % 1 : -1;
    const flashF = this.flashAt >= 0 ? this.frame - this.flashAt : 99;
    const ig = this.ignite;
    const igF = ig ? this.frame - ig.at : 99;
    if (ig && igF > IGNITE.fade) this.ignite = null;
    for (let i = 0; i < cells.length; i++) {
      const cl = cells[i];
      const age = this.appear[i] < 0 ? -1 : this.frame - this.appear[i];
      L.fresh[i] = age < 0 ? 0 : age < 2 ? 2 : age < 4 ? 1 : 0;
      let heat = 0;
      let glow = 0;
      if (rip && rt >= 0 && rt < 1) {
        const d = Math.hypot(cl.cu - rip.hu, cl.cv - rip.hv);
        const r = Math.max(0, 1 - Math.abs(d - rt * rip.reach) / 0.25) * (1 - rt);
        heat = r > 0.55 ? 2 : r > 0.2 ? 1 : 0;
      }
      // the catch ignites every cell's glass: hot round the struck point, the panes lit, then a quarter
      if (ig && igF >= 0 && igF <= IGNITE.fade) glow = igF <= IGNITE.hot && Math.hypot(cl.cu - ig.hu, cl.cv - ig.hv) < HOT_R ? 3 : igF <= IGNITE.lit ? 2 : 1;
      if (this.charge > 0) {
        const pulse = this.charge * (0.55 + 0.45 * Math.sin(this.el * 0.03 + cl.cu * 9 + cl.cv * 5));
        heat = Math.max(heat, pulse > 0.75 ? 2 : pulse > 0.35 ? 1 : 0);
        // the hot cells of the charge light their panes too (the old charge's glowing glass)
        if (pulse > 0.75) glow = Math.max(glow, 2);
      }
      if (flashF >= 0 && flashF <= 4) {
        const dF = this.flashHit ? Math.hypot(cl.cu - this.flashHit.hu, cl.cv - this.flashHit.hv) : 9;
        if (flashF === 0) heat = Math.max(heat, dF < FLASH_WHITE_R ? 2 : 1);
        else if (flashF === 1) heat = Math.max(heat, 1);
        glow = Math.max(glow, flashF === 0 && dF < HOT_R ? 3 : flashF <= 2 ? 2 : 1);
      }
      if (heat === 0 && glow === 0 && sheenT >= 0 && age >= 4) {
        // a sheen band slides over the glass (living detail): a diagonal of cells one tone up
        const s = cl.cu * 0.55 - cl.cv * 0.45;
        if (Math.abs(s - (sheenT * 3.2 - 1.6)) < 0.07) heat = 1;
      }
      L.heat[i] = heat;
      L.glow[i] = glow;
    }
    if (this.struck) {
      const sf = this.frame - this.struck.at;
      if (sf < 6) L.heat[this.struck.cell] = sf < 2 ? 3 : sf < 4 ? 2 : Math.max(1, L.heat[this.struck.cell]);
      else this.struck = null;
    }
    // the local tremble after the catch: ±1 px on whole pixels for 4 frames
    const tf = this.trembleFrom >= 0 ? this.frame - this.trembleFrom : 99;
    const off = tf < 4 ? [1, 0, -1, 0][tf] : 0;
    this.nearR.moveTo(this.shape.x0 + off, this.shape.y0);
    this.farR.moveTo(this.shape.x0 + off, this.shape.y0);
    this.nearR.begin();
    paintDomeShell(this.nearR.pc, F, 'near', L);
    this.nearR.end();
    this.farR.begin();
    paintDomeShell(this.farR.pc, F, 'far', L);
    this.farR.end();
    this.drawRing();
    return true;
  }

  /** The floor ring: drawn round from the front while building; steps out on the break. */
  private drawRing(): void {
    const r = this.baseR;
    r.begin();
    const tones = [
      [PAL.mag3, PAL.mag1, PAL.mag1],
      [PAL.mag2, PAL.mag1, PAL.mag0],
      [PAL.mag1, PAL.mag0, -1],
      [PAL.mag0, -1, -1],
    ];
    if (this.ringFade < 4 && this.ringK > 0) {
      const [main, under, inner] = tones[this.ringFade];
      const nOuter = Math.round(this.ring.length * this.ringK);
      for (let i = 0; i < nOuter; i++) {
        const q = this.ring[i];
        r.px(q.x, q.y, main);
        if (under >= 0) r.px(q.x, q.y + 1, under);
      }
      if (inner >= 0) {
        const nIn = Math.round(this.ringIn.length * this.ringK);
        for (let i = 0; i < nIn; i += 2) r.px(this.ringIn[i].x, this.ringIn[i].y, inner);
      }
    }
    r.end();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.stopFn();
    this.nearR.destroy();
    this.farR.destroy();
    this.baseR.destroy();
    this.cracks?.ras.destroy();
    this.cracks = null;
    this.sparks.release();
    // shards finish on their own clock; cleaned up once quiet (or on scene shutdown)
    const layers = [this.nearShards, this.farShards];
    const quiet = onFrame(this.scene, () => {
      if (layers.every((l) => l.size === 0)) {
        layers.forEach((l) => l.destroy());
        quiet();
        return false;
      }
      return true;
    });
  }
}

// ================================================================ small pieces

/**
 * Show time that runs on through hit-stops (fix round 1, C1-02): the speed still scales it and the duel
 * menu's pause stops it. The reflections' rhythm (the next beam 220 ms after a contact, the break 120 ms
 * after the last) is kept on this clock, so a victim's death hit-stop never stretches the gaps (a beam
 * that is due during a freeze simply starts moving when the freeze ends).
 */
function liveTimer(scene: Phaser.Scene): { now(): number; until(at: number): Promise<void>; stop(): void } {
  const clock = showClock(scene);
  let t = 0;
  const waits: { at: number; done: () => void }[] = [];
  const h = (_time: number, delta: number) => {
    if (!clock.paused) t += Math.min(50, delta) * clock.speed;
    for (let i = waits.length - 1; i >= 0; i--)
      if (t >= waits[i].at) {
        const w = waits[i];
        waits.splice(i, 1);
        w.done();
      }
  };
  // (Phaser.Scenes.Events.UPDATE / SHUTDOWN: this module imports Phaser for its types only)
  scene.events.on('update', h);
  const stop = () => {
    scene.events.off('update', h);
    for (const w of waits.splice(0)) w.done();
  };
  scene.events.once('shutdown', stop);
  return {
    now: () => t,
    until: (at) => (t >= at ? Promise.resolve() : new Promise<void>((done) => waits.push({ at, done }))),
    stop,
  };
}

/** Whole-pixel line (Bresenham), endpoints included. */
function bres(x0: number, y0: number, x1: number, y1: number, put: (x: number, y: number) => void): void {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 2000; n++) {
    put(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/** A whole-pixel path through points (connected, no duplicates). */
function pixelPath(pts: readonly XY[]): XY[] {
  const out: XY[] = [];
  let last = '';
  for (let i = 1; i < pts.length; i++)
    bres(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, (x, y) => {
      const k = `${x},${y}`;
      if (k === last) return;
      last = k;
      out.push({ x, y });
    });
  return out;
}

/**
 * A stroke along a whole-pixel path: `bands` from the outside in (the last one is the 1-px core), laid
 * across the path's local direction (vertical offsets on flat runs, horizontal on steep ones).
 */
function strokePath(r: Raster, path: readonly XY[], from: number, to: number, bands: readonly number[]): void {
  const half = bands.length - 1;
  for (let b = 0; b <= half; b++) {
    const col = bands[b];
    const off = half - b;
    for (let i = Math.max(0, from); i < Math.min(path.length, to); i++) {
      const q = path[i];
      const a = path[Math.max(0, i - 2)];
      const c = path[Math.min(path.length - 1, i + 2)];
      const flat = Math.abs(c.x - a.x) >= Math.abs(c.y - a.y);
      if (off === 0) r.px(q.x, q.y, col);
      else if (flat) {
        r.px(q.x, q.y - off, col);
        r.px(q.x, q.y + off, col);
      } else {
        r.px(q.x - off, q.y, col);
        r.px(q.x + off, q.y, col);
      }
    }
  }
}

/** A hard star (contact / head / gathering light): a white plus with tone tips. */
function star(r: Raster, p: XY, arm: number, tip: number, core: number = PAL.white): void {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  for (let k = -arm; k <= arm; k++) {
    const c = Math.abs(k) === arm ? tip : core;
    r.px(x + k, y, c);
    r.px(x, y + k, c);
  }
  if (arm >= 3) {
    // short diagonals for the big ones
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) r.px(x + dx, y + dy, tip);
  }
}

/**
 * The big catch star (the old dome's big white star, readable on the lit glass): a tapered plus — a 3×3
 * core and 3-px-thick arm roots, 1-px arms out to `arm`, `tip` on the ends — and short diagonal rays.
 */
function bigStar(r: Raster, p: XY, arm: number, tip: number, core: number = PAL.white): void {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const root = Math.max(1, Math.floor(arm / 3));
  for (let k = -arm; k <= arm; k++) {
    const a = Math.abs(k);
    const c = a === arm ? tip : core;
    r.px(x + k, y, c);
    r.px(x, y + k, c);
    if (a <= root) {
      // the thick root of each arm
      for (const s of [-1, 1]) {
        r.px(x + k, y + s, core);
        r.px(x + s, y + k, core);
      }
    }
  }
  const d = Math.max(2, Math.floor(arm / 3) + 1);
  for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    for (let k = 2; k < d; k++) r.px(x + dx * k, y + dy * k, core);
    r.px(x + dx * d, y + dy * d, tip);
  }
}

/**
 * A ranged strike's bolt from the muzzle into the shell (attribute colours, white core, whole pixels,
 * 5 px like the old streak's body). Resolves on its contact frame.
 */
function strikeBolt(scene: Phaser.Scene, from: XY, to: XY, ramp: readonly number[], depth: number): Promise<void> {
  const a = { x: Math.round(from.x), y: Math.round(from.y) };
  const b = { x: Math.round(to.x), y: Math.round(to.y) };
  const path = pixelPath([a, b]);
  const r = new Raster(scene, Math.min(a.x, b.x) - 8, Math.min(a.y, b.y) - 8, Math.abs(a.x - b.x) + 17, Math.abs(a.y - b.y) + 17, depth);
  return run(scene, PROJ_MS, (t) => {
    const head = Math.max(1, Math.round(Math.min(1, t) * (path.length - 1)) + 1);
    r.begin();
    // a tail of 18 px behind the head: ramp[1] edge → ramp[3] body → white core near the head
    strokePath(r, path, head - 18, head - 9, [ramp[1], ramp[2]]);
    strokePath(r, path, head - 9, head, [ramp[2], ramp[3], PAL.white]);
    star(r, path[head - 1], 2, ramp[4]);
    r.end();
  }).then(() => r.destroy());
}

/**
 * One reflected beam: a gentle fanned arc (as the old ones) from the struck point to a victim's core in
 * BEAM_MS — 7 px (mag2 edge / mag3 / mag4 / white core: the old glowing band's width) with a hard white
 * head; on contact a white star, the beam swells to 9 px with a 3-px white core for 2 frames, then thins
 * by steps (7 → 5 → 3 → 1 px) and is gone (EF-13). `onContact` runs on the contact frame.
 */
function arcBeam(scene: Phaser.Scene, from: XY, to: XY, fan: number, onContact: () => void): { contact: Promise<void>; done: Promise<void> } {
  const a = { x: Math.round(from.x), y: Math.round(from.y) };
  const b = { x: Math.round(to.x), y: Math.round(to.y) };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  const ctrl = { x: (a.x + b.x) / 2 + (-dy / l) * fan, y: (a.y + b.y) / 2 + (dx / l) * fan - 7 - Math.abs(fan) * 0.2 };
  const knots: XY[] = [];
  for (let k = 0; k <= 24; k++) {
    const q = qbez(a, ctrl, b, k / 24);
    knots.push({ x: Math.round(q.x), y: Math.round(q.y) });
  }
  const path = pixelPath(knots);
  const xs = path.map((q) => q.x);
  const ys = path.map((q) => q.y);
  const r = new Raster(scene, Math.min(...xs) - 9, Math.min(...ys) - 9, Math.max(...xs) - Math.min(...xs) + 19, Math.max(...ys) - Math.min(...ys) + 19, DEPTH.FX + 5);
  let hitFrame = -1;
  let frame = 0;
  let contacted!: () => void;
  const contact = new Promise<void>((r) => (contacted = r));
  const done = new Promise<void>((resolve) => {
    onFrame(scene, (dt, el) => {
      if (dt > 0) frame++;
      // the head lands on the frame its 120 ms are up (7 frames at 60 fps; no extra frame of waiting)
      const k = Math.min(1, el / (BEAM_MS - 8));
      if (k >= 1 && hitFrame < 0) {
        hitFrame = frame;
        try {
          onContact();
        } catch (e) {
          console.error('[mirror] contact', e);
        }
        contacted();
      }
      const head = hitFrame < 0 ? Math.max(1, Math.round(k * (path.length - 1)) + 1) : path.length;
      const after = hitFrame < 0 ? -1 : frame - hitFrame;
      r.begin();
      if (after < 0) {
        strokePath(r, path, 0, head, [PAL.mag2, PAL.mag3, PAL.mag4, PAL.white]);
        star(r, path[head - 1], 3, PAL.mag4);
      } else if (after < 2) {
        strokePath(r, path, 0, head, [PAL.mag2, PAL.mag3, PAL.mag4, PAL.white, PAL.white]);
        star(r, b, 5, PAL.mag4);
      } else if (after < 4) strokePath(r, path, 0, head, [PAL.mag2, PAL.mag3, PAL.mag4, PAL.white]);
      else if (after < 6) strokePath(r, path, 0, head, [PAL.mag2, PAL.mag3, PAL.mag4]);
      else if (after < 7) strokePath(r, path, 0, head, [PAL.mag2, PAL.mag4]);
      else if (after < 8) strokePath(r, path, 0, head, [PAL.mag3]);
      r.end();
      // done after the steps (8 rendered frames past contact; a hit-stop holds them)
      if (after >= 8) {
        r.destroy();
        resolve();
        return false;
      }
      return true;
    });
  });
  // a scene that shuts down mid-flight never leaves the contact hanging
  void done.then(() => contacted());
  return { contact, done };
}

/**
 * The catch on the shell: a big whole-pixel star (thick white, held through the hit-stop, then mag4, then
 * mag3), pixel sparks, the magenta floor flash under it.
 */
function catchBurst(scene: Phaser.Scene, at: XY, floorY: number, seed: number): void {
  const r = Raster.around(scene, at.x, at.y, 30, 30, DEPTH.FX + 6);
  let f = 0;
  onFrame(scene, (dt) => {
    if (dt > 0) f++;
    r.begin();
    if (f < 2) bigStar(r, at, 10, PAL.mag4);
    else if (f < 4) bigStar(r, at, 7, PAL.mag3, PAL.mag4);
    else if (f < 6) star(r, at, 3, PAL.mag2, PAL.mag3);
    r.end();
    if (f >= 6) {
      r.destroy();
      return false;
    }
    return true;
  });
  const rnd = fxRng(seed);
  const sp = new PxSparks(scene, DEPTH.FX + 7);
  const n = fxCount(22);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + rnd() * 0.4;
    const v = 60 + rnd() * 110;
    sp.add({ x: Math.round(at.x), y: Math.round(at.y), vx: Math.cos(ang) * v, vy: Math.sin(ang) * v * 0.7 - 10, drag: 3, ay: 80, life: 220 + Math.floor(rnd() * 220), colors: [PAL.white, PAL.mag4, PAL.mag3, PAL.mag2], shape: i % 3 === 0 ? 'plus' : 'px', fadeAt: 1 });
  }
  sp.release();
  void lightFlash(scene, at.x, floorY, PAL.mag4, 50 * TK, 420, { floorY, ring: true, intensity: 1.1, air: 0 });
}

/**
 * The light gathering at the struck point while the dome charges: a whole-pixel star growing in steps
 * (white / mag4 alternating every 2 frames) and motes drawn in. Returns a stopper.
 */
function gatherLight(scene: Phaser.Scene, at: XY, ms: number, seed: number): () => void {
  const r = Raster.around(scene, at.x, at.y, 40, 40, DEPTH.FX + 6);
  const rnd = fxRng(seed);
  const sp = new PxSparks(scene, DEPTH.FX + 6);
  const n = fxCount(12);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 18 + rnd() * 20;
    sp.add({ x: Math.round(at.x + Math.cos(a) * d), y: Math.round(at.y + Math.sin(a) * d * 0.6), tx: Math.round(at.x), ty: Math.round(at.y), life: Math.max(60, ms - Math.floor(rnd() * 60)), delay: Math.floor(rnd() * 50), colors: [PAL.mag4, PAL.white], shape: 'px', fadeAt: 1 });
  }
  sp.release();
  let f = 0;
  let stopped = false;
  const stop = onFrame(scene, (dt, el) => {
    if (stopped) return false;
    if (dt > 0) f++;
    const t = Math.min(1, el / ms);
    r.begin();
    star(r, at, 1 + Math.round(t * 4), Math.floor(f / 2) % 2 ? PAL.mag3 : PAL.mag4, Math.floor(f / 2) % 2 ? PAL.mag4 : PAL.white);
    r.end();
    return true;
  });
  return () => {
    if (stopped) return;
    stopped = true;
    stop();
    r.destroy();
  };
}

/**
 * Stray reflections splaying off the dome when the first beam leaves (the old "many beams"): 7 1-px
 * lines that shoot out 60–130 px (white while growing, mag3 after) and are drawn in again, ≈ 300 ms.
 */
function strayRays(scene: Phaser.Scene, at: XY, side: PlayerId, seed: number): void {
  const rnd = fxRng(seed);
  const rays = Array.from({ length: fxCount(7) }, (_, i) => ({
    a: -Math.PI / 2 + (i - 3) * 0.42 + (rnd() - 0.5) * 0.2 + (side === 0 ? 0.35 : -0.35),
    len: 60 + rnd() * 70,
    d: Math.floor(rnd() * 60),
  }));
  const r = Raster.around(scene, at.x, at.y, 300, 300, DEPTH.FX + 4);
  void run(scene, 300, (t, el) => {
    r.begin();
    for (const s of rays) {
      // each ray shoots out and keeps flying while its tail catches up (no dash left hanging still)
      const lt = Math.max(0, (el - s.d) / 150);
      if (lt <= 0 || t > 0.95) continue;
      const r0 = s.len * Math.max(0, lt - 0.42) * 1.55;
      const r1 = s.len * (E.outQuad(Math.min(1, lt)) + Math.max(0, lt - 1) * 0.5);
      if (r1 - r0 < 1) continue;
      const ca = Math.cos(s.a);
      const sa = Math.sin(s.a);
      const col = lt < 0.55 ? PAL.white : lt < 0.85 ? PAL.mag3 : PAL.mag2;
      bres(at.x + ca * r0, at.y + sa * r0, at.x + ca * r1, at.y + sa * r1, (x, y) => r.px(x, y, col));
    }
    r.end();
  }).then(() => r.destroy());
}

// ================================================================ the strike into the dome

interface StrikePlan {
  u: MonsterUnit;
  ranged: boolean;
  /** Attack frame it starts from (the declaration's held pose) and the contact / release frame. */
  f0: number;
  hit: number;
  /** From its launch to its contact with the shell (its bolt / blow streak included). */
  lead: number;
}

/** A ranged strike's colours (dark → light): the v3 slice monsters' own (as their charge glow), else the attribute's. */
const STRIKE_RAMP: Readonly<Record<string, readonly number[]>> = {
  crystal_wyrm: RAMPS.cyan,
  abyss_magus: RAMPS.void,
};

function strikeRamp(u: MonsterUnit): readonly number[] {
  return STRIKE_RAMP[u.cardId] ?? ATTRIBUTE_RAMP[u.attribute];
}

function planStrike(u: MonsterUnit | null): StrikePlan | null {
  if (!u || !u.sprite.active || !u.has('attack')) return null;
  const ranged = isRanged(u.cardId);
  const f0 = strikeStartFrame(u);
  const hit = Math.max(f0, ranged ? u.markFrame('attack', 'release', u.impactFrame) : u.impactFrame);
  const toHit = u.rangeMs('attack', f0, hit);
  return { u, ranged, f0, hit, lead: (ranged ? toHit : Math.max(LUNGE_MIN, toHit)) + PROJ_MS };
}

// ================================================================ the exit

/**
 * The spent trap leaves (trapExitV3's beats with a landing time; fix round 1, C1-02: it starts at the break,
 * not after the last victim's card): it lies down on its tile while the dome shatters, then is born from
 * there into its graveyard flight — landing at least LAND_GAP (+ a frame) clear of every victim's card
 * landing `lands()` (elapsed ms of `clock`: the known ones, or the death kit's estimate for a death still
 * on its way), before them if it can, else just after the one it would meet (A5 §3.0 EF-12).
 */
export function exitLanding(t0: number, lands: readonly number[], gap = LAND_GAP + 17): number {
  let t = t0;
  const sorted = [...lands].sort((a, b) => a - b);
  for (let guard = 0; guard < 16; guard++) {
    const clash = sorted.find((l) => Math.abs(t - l) < gap);
    if (clash === undefined) break;
    t = clash + gap;
  }
  return t;
}
async function exitAfter(ctx: ActCtx, op: Opening, clock: { now(): number }, lands: () => number[]): Promise<void> {
  const ev = ctx.ev;
  op.stopAura();
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid);
  if (gi < 0) return;
  const gEv = ctx.events[gi] as EvOf<'toGraveyard'>;
  ctx.consumeAt(gi);
  const { tile } = ctx.views.field.release(ev.uid);
  const from = tile ? { x: Math.round(tile.home.x), y: Math.round(tile.home.y) } : { x: Math.round(op.at.x), y: Math.round(op.at.y) };
  if (tile && tile.active && tile.standing) await tile.layDown(180);
  const top = ctx.views.field.pile(gEv.owner, 'graveyard').topXY();
  // cardLeaves: a 47 ms birth flash, a 50 ms lift, then the arc (flightMs by distance)
  const fly = 97 + flightMs(Math.hypot(top.x - from.x, top.y - from.y));
  const t0 = clock.now() + fly;
  const delay = Math.max(0, Math.ceil(exitLanding(t0, lands()) - t0));
  return cardLeaves(ctx, { owner: gEv.owner, cardId: ev.cardId, from, tile: tile && tile.active ? tile : null, delay });
}

// ================================================================ the scene

/** Ayna Kalkanı's activate hook, the v3 look (see the header). */
export async function mirrorV3(ctx: ActCtx): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const clock = liveTimer(sc);
  const runIdx = fx.resolutionRun(ctx);
  const kills = runIdx.filter((i) => {
    const e = ctx.events[i];
    return e.type === 'destroy' && e.location === 'monster' && e.sourceUid === ev.uid;
  });
  const killEvs = kills.map((i) => ctx.events[i] as EvOf<'destroy'>);
  const pend = ctx.before.pending;
  const trig = pend && pend.kind === 'trapResponse' && pend.trigger.kind === 'attackDeclared' ? pend.trigger : null;
  const attackerUid = trig?.attackerUid ?? killEvs[0]?.uid ?? null;
  const attacker = attackerUid !== null ? live(ctx.unit(attackerUid)) : null;
  const attackerSide = attacker?.player ?? killEvs[0]?.player ?? other(ev.player);
  const { hold, other: kept } = takeAttack(ctx);
  kept?.destroy();

  // ---- today's two camera calls, kept (user decision): the trap opening's lean (its own target) and
  // the dome lean of mirror_barrier.ts:57 — same targets and options, computed before anything moves
  const domeC = isoToScreen(BOARD_MID_COL, monsterRow(ev.player));
  const domeTop = { x: domeC.x, y: domeC.y - 40 * TK };
  const trapPt = ev.zone !== null ? zoneXY(ev.player, 'spellTrap', ev.zone) : zoneXY(ev.player, 'spellTrap', 1);
  const aCore0 = attacker?.core() ?? domeTop;
  const leanAt = { x: (domeTop.x * 2 + aCore0.x) / 3, y: (domeTop.y * 2 + aCore0.y) / 3 };

  // ---- the dome (exists from the start, shows nothing until it builds) and the point the attack meets
  const dome = new DomeV3(sc, ev.player, ev.uid * 7 + 1);
  const plan = planStrike(attacker);
  const aHome = attacker ? { x: attacker.home.x, y: attacker.home.y } : zoneXY(attackerSide, 'monster', 1);
  const hit = dome.point(aHome, STRUCK_EL);

  // ---- victims, in reflection order
  const victims = kills.map((i, k) => {
    const e = killEvs[k];
    const u = live(ctx.unit(e.uid));
    const z = zoneXY(e.player, 'monster', e.zone);
    return { i, e, u, core: u ? u.core() : { x: z.x, y: z.y - 14 } };
  });
  const order = engineOrderPerOwner(reflectionOrder(hit, victims.map((v) => v.core)), victims.map((v) => ctx.owner(v.e.uid))).map((k) => victims[k]);
  const posed = order.map((v) => !!v.u && v.u.has('death'));
  const gaps = order.map((_v, k) => (k > 0 && posed[k - 1] ? BEAM_GAP_POSED : BEAM_GAP));
  const departs = beamSchedule(order.map((_v, k) => (posed[k] ? DEATH_EST.pose : DEATH_EST.legacy)), { gaps, ordered: true });

  // ---- DOME (parallel with the opening): raise at DOME_AT, complete before CATCH_AT
  const { ra, rb, rz } = dome.shape;
  const lights: { pool: LightHandle | null } = { pool: null };
  const built = (async () => {
    await wait(sc, DOME_AT);
    void ctx.focus(leanAt, { zoom: 1.04, ms: 420, pan: 0.3 });
    playV3('mirrorRaise', { volume: 0.9, pan: panAt(domeC.x) }); // mark `raise`
    lights.pool = lightPool(sc, domeC.x, domeC.y - rz * 0.45, { color: PAL.mag3, spill: PAL.mag2, radius: (ra + rb) * (TILE_W / 2) * 0.85, floorY: domeC.y, intensity: 0.05, anim: 'breathe', fadeIn: 0 });
    lights.pool.setIntensity(0.85, BUILD_MS);
    await dome.build();
  })();

  // ---- the attacker lets its attack go so that it meets the shell just after the dome is complete;
  // `caught` resolves on the contact frame with what the body does after the hit-stop
  const launchAt = plan ? Math.max(LAUNCH_MIN, CATCH_AT - plan.lead) : CATCH_AT;
  const caught = (async (): Promise<() => Promise<void>> => {
    const none = () => Promise.resolve();
    await wait(sc, launchAt);
    if (!plan || !plan.u.sprite.active || plan.u.retired) {
      hold?.destroy();
      return none;
    }
    const u = plan.u;
    const s = u.sprite;
    // the strike continues from the pose the declaration holds now (its charge tremble stopped first)
    if (canHandOver(hold)) hold.handOver();
    else if (hold) await hold.release(60);
    const f0 = strikeStartFrame(u);
    hold?.dropMarks();
    sc.tweens.killTweensOf(s);
    u.posed = true;
    const voice = soundsOf(u.cardId);
    let charge: SfxHandle | null = null;
    if (voice) charge = takeCharge(u, voice.charge, { volume: 0.8, pan: panAt(u.home.x) });
    else ctx.sfx('whoosh', { volume: 0.5, pitch: plan.ranged ? 0.8 : 1.1 });
    if (plan.ranged) {
      // its own attack plays through; the bolt leaves the muzzle on the release frame
      let released!: () => void;
      const rel = new Promise<void>((r) => (released = r));
      atFrame(u, 'attack', plan.hit, () => released(), { maxMs: plan.lead + 400 });
      void u.playRange('attack', Math.min(f0, plan.hit));
      await Promise.race([rel, wait(sc, plan.lead - PROJ_MS + 120)]);
      charge?.stop(60);
      if (voice) playV3(voice.release, { volume: 0.85, pan: panAt(u.home.x) }); // mark `release`
      await strikeBolt(sc, u.worldPoint('muzzle'), hit, strikeRamp(u), DEPTH.FX + 4);
      return async () => {
        u.posed = false;
      };
    }
    // melee: the body steps toward the dome on whole pixels into its own impact frame, and the blow's
    // energy streaks off its muzzle into the shell (the old dome's streak, for every attacker)
    void u.playRange('attack', Math.min(f0, plan.hit), plan.hit);
    const r0 = { x: u.rest0.x, y: u.rest0.y };
    const dir = norm(sub({ x: hit.x, y: hit.floorY }, u.home));
    await run(sc, plan.lead - PROJ_MS, (t) => {
      if (!s.active) return;
      const e = t * t;
      s.setPosition(Math.round(r0.x + dir.x * MELEE_STEP * e), Math.round(r0.y + dir.y * MELEE_STEP * e));
    });
    charge?.stop(60);
    await strikeBolt(sc, u.worldPoint('muzzle'), hit, strikeRamp(u), DEPTH.FX + 4);
    // after the hit-stop the dome throws it back home while its attack finishes
    return async () => {
      if (!s.active || u.retired) return;
      void u.playRange('attack', plan.hit);
      const p0 = { x: s.x, y: s.y };
      await run(sc, BOUNCE_MS, (t) => {
        if (!s.active || u.retired) return;
        const e = 1 - (1 - t) * (1 - t);
        s.setPosition(Math.round(p0.x + (r0.x - p0.x) * e), Math.round(p0.y + (r0.y - p0.y) * e));
      });
      if (!u.retired) u.posed = false;
    };
  })();

  const op = await trapOpening(ctx, { focus: lerpXY({ x: trapPt.x, y: trapPt.y - 30 }, domeTop, 0.5) });
  const after = await caught;
  await built;

  // ---- CATCH — `catch`
  dome.strike(hit);
  catchBurst(sc, hit, hit.floorY, ev.uid * 31 + 3);
  playV3('mirrorCatch', { volume: 1, pan: panAt(hit.x) }); // mark `catch`
  sc.events.emit('v3:contact', attackerUid);
  lights.pool?.setIntensity(1.5, 60);
  await stopTime(sc, CATCH_STOP);
  void wait(sc, 120).then(() => lights.pool?.setIntensity(1, 260));
  const bounced = after();

  // ---- CHARGE (folded into the catch, C1-02): the seams heat up, the light gathers at the struck point while
  // the ignition's own frames play on; the first reflection leaves when it is full (catch + 120 ms)
  if (CHARGE_AT > 0) await wait(sc, CHARGE_AT);
  lights.pool?.setIntensity(1.45, CHARGE_MS);
  const stopGather = gatherLight(sc, hit, CHARGE_MS, ev.uid * 11 + 5);
  await run(sc, CHARGE_MS, (t) => dome.setCharge(E.inQuad(t)));

  // ---- REFLECTION, one by one — `beam:<i>`: the next beam leaves 220 ms after the previous contact (live
  // show time: a death's hit-stop does not stretch the gap), later only to keep the victims' graveyard
  // landings ≥ 150 ms apart (beamSchedule)
  stopGather();
  dome.flash(hit);
  strayRays(sc, hit, ev.player, ev.uid * 19 + 7);
  lights.pool?.setIntensity(1.9, 40);
  void wait(sc, 90).then(() => lights.pool?.setIntensity(0.9, 300));
  void run(sc, 190, (t) => dome.setCharge(1 - t));
  const deaths: Promise<unknown>[] = [];
  const beams: Promise<void>[] = [];
  // each victim's card landing (elapsed ms of the live clock): an estimate from its contact, the real one from its birth
  const lands: number[] = [];
  // each victim's burst (its card's birth: an old-art death's generic shatter sound plays on it), live clock ms
  const bursts: number[] = [];
  let burstSeen!: (k: number) => void;
  const lastBurst = new Promise<void>((r) => (burstSeen = (k) => k === order.length - 1 && r()));
  const t0 = clock.now();
  const nB = order.length;
  let lastContact = t0;
  for (let k = 0; k < order.length; k++) {
    const v = order[k];
    if (k > 0) await clock.until(Math.max(t0 + departs[k], lastContact + gaps[k]));
    const to = v.u && !v.u.retired && v.u.sprite.active ? v.u.core() : v.core;
    const dir = norm(sub(to, hit));
    const home = v.u ? { x: v.u.home.x, y: v.u.home.y } : zoneXY(v.e.player, 'monster', v.e.zone);
    // the beams leave the struck point fanned apart (as the old ones), so a row of them never overlaps
    const spread = nB > 1 ? (k - (nB - 1) / 2) * 7 : 0;
    const from = { x: hit.x + spread, y: hit.y + Math.round(Math.abs(spread) * 0.4) };
    const fan = (k - (nB - 1) / 2) * 14;
    if (k > 0) dome.pulse(hit);
    // the beam's light falls on the floor in a short strip under its lane (no air glow)
    void lightBeam(sc, from, to, PAL.mag3, 300, { air: false, floor: { from: { x: hit.x, y: hit.floorY }, to: home }, floorWidth: 10, intensity: 0.9 });
    const beam = arcBeam(sc, from, to, fan, () => {
      playV3('mirrorBeam', { volume: 0.9, pitch: Math.pow(2, (2 * k) / 12), pan: panAt(to.x) }); // mark `beam:<k>`
      lands[k] = clock.now() + (v.u && v.u.has('death') ? DEATH_EST.pose : DEATH_EST.legacy);
      // the victim's card is born on its burst frame: its landing = birth + flash + lift + arc
      const onBorn = () => {
        bursts[k] = clock.now();
        burstSeen(k);
        const top = ctx.views.field.pile(ctx.owner(v.e.uid), 'graveyard').topXY();
        // (+20 ms: the flash, lift and arc each end on a whole frame)
        lands[k] = clock.now() + 117 + flightMs(Math.hypot(top.x - home.x, top.y - home.y));
      };
      // the beam's light rims the struck body (an edge light, never a tint: A5 §3.0); the old art
      // shows its own hit frame — the death kit then breaks it (its contact flash is not played)
      if (v.u && !v.u.retired && v.u.sprite.active) {
        void rimFlash(sc, v.u.sprite, { ramp: [PAL.white, PAL.mag4, PAL.mag3, PAL.mag2], hold: 2 });
        if (!v.u.has('death')) void v.u.play(v.u.has('hitHeavy') ? 'hitHeavy' : 'hit', { hold: true });
      }
      void lightFlash(sc, to.x, home.y, PAL.mag4, 40 * TK, 360, { floorY: home.y, ring: true, air: 0 });
      deaths.push(ctx.isConsumed(v.i) ? Promise.resolve() : ctx.play(v.i, { hit: false, push: dir, onBorn }));
    });
    beams.push(beam.done);
    await beam.contact;
    lastContact = clock.now();
  }

  // ---- BREAK — `break`: 120 ms after the last contact (live), while the beams thin out and the deaths go on —
  // never on the same frame as the last victim's burst (fix round 2, A5A-C2-02): an old-art victim bursts with
  // its generic shatter ≈ 130 ms after its contact, so the break then comes BREAK_CLEAR after that burst
  await clock.until(lastContact + BREAK_AFTER);
  const lastK = order.length - 1;
  if (lastK >= 0 && !posed[lastK]) {
    if (bursts[lastK] === undefined) await Promise.race([lastBurst, clock.until(lastContact + BREAK_WAIT_CAP)]);
    if (bursts[lastK] !== undefined) await clock.until(bursts[lastK] + BREAK_CLEAR);
  }
  playV3('mirrorBreak', { volume: 0.9, pan: panAt(domeC.x) }); // mark `break`
  void lights.pool?.fadeOut(SHATTER_MS);
  const broken = dome.shatter(hit).then(() => dome.destroy());

  // ---- EXIT — `exit`: the trap card lies down during the shatter and flies, its landing clear of the
  // victims' landings by ≥ LAND_GAP (C1-02: no longer after the last victim's card); the camera relaxes
  void ctx.unfocus(320);
  const exit = exitAfter(ctx, op, clock, () => lands.filter((t) => Number.isFinite(t)));
  // every kill the reflections did not reach (should not happen) still plays
  for (const i of kills) if (!ctx.isConsumed(i)) deaths.push(ctx.play(i, { hit: true }));
  await all([...deaths, exit, broken, bounced, op.banner, ...beams]);
  clock.stop();
  await fx.playRun(ctx, fx.resolutionRun(ctx));
}
