// Saman Korkuluklar (straw_decoys) — the pure pixel painters of its cinematic (src/cinematics/spells/straw_decoys.ts):
// the scarecrow in its build state and the crow (the hero beat) in its poses. Plain PixelCanvas work (no Phaser) so
// a review script can render them straight to PNG. Palette only, whole pixels, no randomness.

import { PAL } from '../../art/palette';
import type { PixelCanvas } from '../../art/pixel';

type XY = { x: number; y: number };
const R = Math.round;

// ================================================================ the scarecrow (local raster geometry)

/** Raster size and the floor point (the zone's centre) inside it. */
export const RW = 64;
export const RH = 150;
export const FX = 32;
export const FY = 140;
/** The stake's top above the floor when planted; the longest fall. */
export const STAKE_TOP = 26;
export const SKY = 100;
/** Nothing of the scene above this screen y (the HUD band). */
export const SKY_MIN_Y = 44;

export interface Build {
  /** the stake: visible, its offset above the planted pose (≤ 0 = in the air), sink (px into the floor), wobble */
  stake: boolean;
  stakeY: number;
  sink: number;
  wob: number;
  /** the stab squash: px wider (and the stake `sink`s as many px shorter) for the contact frames */
  squash1: number;
  /** the stab crater in the soil round the stake's foot: 0 none, 1 the contact (dark, chips flying), 2 open, 3 settling */
  crater: number;
  /** white silhouette frames (materialise / stab) */
  white: boolean;
  /** stab cracks on the tile (0 none, 1 fresh, 2 fading) */
  cracks: number;
  /** the falling streaks' length (px) */
  streak: number;
  /** straw wound on (0..1) */
  wrap: number;
  /** the twine turns' phase (rows climbed while winding) */
  twine: number;
  /** the coat: null = not yet, else its offset above (px); its hem flap (px) */
  coatY: number | null;
  flap: number;
  /** the sack head / the hat: null = not yet, else offset above (px); the head's squash (px) */
  headY: number | null;
  hatY: number | null;
  squash: number;
  /** the sleeves' angle step: 0 hanging … 3 over, 4 level */
  arm: number;
  /** the perched crow's weight on one sleeve: which local side (±1) and how far its tip dips (px) */
  dipDir: number;
  dip: number;
  /** the button eyes: 0 dark, 1 white core + gold4 cross, 2 gold4 + gold3 cross, 3 gold3, 4 gold2 */
  eyes: number;
  /** a shiver of the straw (the crow's caw, the lure): px */
  shiver: number;
}

export function freshBuild(): Build {
  return { stake: false, stakeY: -SKY, sink: 0, wob: 0, squash1: 0, crater: 0, white: false, cracks: 0, streak: 0, wrap: 0, twine: 0, coatY: null, flap: 0, headY: null, hatY: null, squash: 0, arm: 0, dipDir: 1, dip: 0, eyes: 0, shiver: 0 };
}

/** Sleeve angles (radians, + = down) per arm step: hanging, 45°, 15°, 8° over the level, level (a hair of droop). */
export const ARM_ANGLE = [1.25, 0.78, 0.26, -0.14, 0.06];
export const ARM_L = 8;
/** The head's centre (local) and the eyes. */
export const HEAD_CX = FX + 1;
export const HEAD_CY = FY - 25;
/** The straw bundle's half-width per row, from the foot (FY − 4) up (hand-tuned: a flared skirt, a waist, a chest). */
const WRAP_HW = [6, 6, 5, 5, 4, 4, 3, 4, 4, 4, 3, 4, 4, 4, 3, 3, 3, 3] as const;
/** Tufts [row, side, length] that pop on as the wind reaches them. */
const WRAP_TUFTS: readonly (readonly [number, number, number])[] = [
  [3, -1, 3],
  [7, 1, 3],
  [11, -1, 2],
  [14, 1, 2],
];
/** Stray single ends [row, side] poking out of the bundle. */
const WRAP_STRAYS: readonly (readonly [number, number])[] = [
  [1, 1],
  [5, -1],
  [9, 1],
  [12, -1],
  [16, 1],
];

/** Paint one scarecrow in its build state on a cleared canvas (local pixels; the raster is flipped for P2). */
export function paintDecoyPx(p: PixelCanvas, b: Build, el: number): void {
  const fr = Math.floor(el / 160) % 4;
  const sway = [0, 1, 0, -1][fr] + (b.shiver ? (Math.floor(el / 40) % 2 ? b.shiver : -b.shiver) : 0);
  const white = b.white;
  const C = (c: number) => (white ? PAL.white : c);
  // ---- the stake (behind everything else)
  if (b.stake) {
    const top = FY - STAKE_TOP + R(b.stakeY) + b.sink;
    const planted = b.stakeY >= 0;
    const bot = planted ? FY : FY + 3 + R(b.stakeY);
    const W = 3 + b.squash1;
    for (let y = top; y <= bot; y++) {
      // the upper half leans with the wobble
      const dx = y < top + 12 ? b.wob : 0;
      // the point: tapering in the last three rows while it flies
      const fromBot = bot - y;
      const w = !planted && fromBot < 3 ? fromBot + 1 : W;
      const x0 = FX - 1 + dx + (W - w > 1 ? 1 : 0) - (planted ? Math.floor(b.squash1 / 2) : 0);
      for (let i = 0; i < w; i++) {
        // falling, the lit side catches the dusk (a 1-px earth4 rim, a gold4 tip) so it reads over the back wall
        const tone = y === top ? (planted ? PAL.earth4 : PAL.gold4) : i === 0 ? (planted ? PAL.earth3 : PAL.earth4) : i === w - 1 && w > 1 ? PAL.earth1 : PAL.earth2;
        p.set(x0 + i, y, C(tone));
      }
      // bark notches
      if ((y - top) % 7 === 4) p.set(x0 + 1, y, C(PAL.earth1));
    }
  }
  // ---- the straw bundle WOUND round the stake in turns (from the ground up): the wound edge is a slanted turn (higher
  // on the far side), 2–3 diagonal twine bands climb one row per frame while it winds (b.twine), the strand being
  // wound comes in on the wind (local left) and crosses the front, tufts pop on with a 1-px overshoot, stray ends
  // break the silhouette
  if (b.wrap > 0) {
    const yBot = FY - 4;
    const rows = WRAP_HW.length;
    const wound = b.wrap * rows;
    const winding = b.wrap < 1;
    for (let i = 0; i < rows; i++) {
      const y = yBot - i;
      const hw = WRAP_HW[i];
      for (let x = FX - hw; x <= FX + hw; x++) {
        const u = x - FX;
        // the turn's slant: the far (right) side is wound a row or two ahead of the near side
        const lim = wound + (winding ? Math.floor((u + 6) / 3) - 2 : 0);
        if (i >= lim) continue;
        let tone: number;
        if (u <= -hw + 1) tone = PAL.gold3;
        else if (u >= hw - 1) tone = PAL.gold1;
        else if (u < 0) tone = (u & 1) === 0 ? PAL.gold3 : PAL.gold2;
        else tone = (u & 1) === 0 ? PAL.gold2 : PAL.gold1;
        // the twine turns: diagonal bands (rising to the right), a lit edge over each
        if (i >= 3 && i <= rows - 2) {
          const m = (((i - b.twine + Math.floor((u + 8) / 2)) % 7) + 7) % 7;
          if (m === 0) tone = PAL.earth1;
          else if (m === 1 && u < 2) tone = PAL.gold4;
        }
        // the fresh straw just wound on (the edge of the turn)
        if (winding && i >= lim - 1) tone = PAL.gold4;
        p.set(x, y, C(tone));
      }
    }
    // the straws hanging at the foot
    if (b.wrap >= 0.2)
      for (const [x, len] of [
        [FX - 5, 2],
        [FX - 2, 3],
        [FX + 1, 2],
        [FX + 4, 3],
      ] as const)
        for (let k = 1; k <= len; k++) p.set(x + (k === len ? sway : 0), yBot + k, C(x < FX ? PAL.gold3 : PAL.gold2));
    // tufts: pop on as the wind reaches their row (one frame 1 px long), then sway
    for (const [ti, side, len] of WRAP_TUFTS) {
      if (wound < ti + 1) continue;
      const pop = winding && wound - (ti + 1) < 2.2 ? 1 : 0;
      const y = yBot - ti;
      const x0 = FX + side * (WRAP_HW[ti] + 1);
      const n = len + pop;
      for (let k = 0; k < n; k++) p.set(x0 + side * k + (k === n - 1 && side < 0 ? sway : 0), y - Math.floor((k + 1) / 2), C(side < 0 ? PAL.gold3 : PAL.gold2));
    }
    // stray ends (1 px, swaying) once the bundle is there
    for (const [ti, side] of WRAP_STRAYS)
      if (wound >= ti + 1) p.set(FX + side * (WRAP_HW[ti] + 1) + (side < 0 ? Math.min(0, sway) : Math.max(0, sway)), yBot - ti, C(side < 0 ? PAL.gold3 : PAL.gold2));
    // the strand being wound: in on the wind from the near side, across the front to the far side, just over the edge
    if (winding && wound > 1) {
      const ei = Math.min(rows - 1, Math.floor(wound));
      const ey = yBot - ei;
      const wv = (Math.floor(el / 36) & 1) as number;
      const pts: [number, number][] = [];
      for (let k = 0; k <= 9; k++) pts.push([FX - 11 + k, ey + 3 - Math.floor(k / 3) + (k < 3 ? wv : 0)]);
      for (let k = 1; k <= 4; k++) pts.push([FX - 2 + k, ey - Math.floor(k / 2)]);
      pts.forEach(([x, y], k) => p.set(x, y, C(k < 3 ? PAL.gold2 : k < 9 ? PAL.gold3 : PAL.gold4)));
    }
  }
  // ---- the coat (torso + sleeves + straw hands)
  if (b.coatY !== null) {
    const oy = R(b.coatY);
    const sh = FY - 21 + oy;
    const hem = FY - 11 + oy;
    for (let y = sh; y <= hem; y++) {
      const t = (y - sh) / (hem - sh);
      const hw = 5 + Math.round(t * (1 + b.flap));
      for (let x = FX - hw; x <= FX + hw; x++) {
        const u = x - FX;
        if (y === hem && (x & 1)) continue; // ragged hem
        let tone: number = u < -hw * 0.45 ? PAL.leaf2 : u > hw * 0.4 ? PAL.leaf0 : PAL.leaf1;
        const row = y - sh;
        const v = Math.round((4 - row) * 0.5);
        if (row < 4 && Math.abs(u) <= v) tone = PAL.gold2; // the straw in the open collar
        else if (row < 4 && u === -v - 1) tone = PAL.leaf3; // the lit lapel
        p.set(x, y, C(tone));
      }
    }
    p.set(FX + 2, FY - 16 + oy, C(PAL.earth2));
    p.set(FX + 3, FY - 16 + oy, C(PAL.earth2));
    p.set(FX + 2, FY - 15 + oy, C(PAL.earth1));
    p.set(FX + 3, FY - 15 + oy, C(PAL.earth2));
    const a = ARM_ANGLE[Math.max(0, Math.min(4, b.arm))];
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    for (const dir of [-1, 1]) {
      const sx = FX + dir * 4;
      const sy = sh + 1;
      const dip = dir === b.dipDir ? b.dip : 0;
      for (let d = 0; d <= ARM_L; d++) {
        const cx = sx + dir * ca * d;
        const cy = sy + sa * d + (dip * d) / ARM_L;
        for (let i = 0; i < 3; i++) {
          const px = R(cx - dir * sa * (i - 1) * 0.9);
          const py = R(cy + ca * (i - 1));
          p.set(px, py, C(i === 0 ? (dir < 0 ? PAL.leaf3 : PAL.leaf2) : i === 2 ? PAL.leaf0 : d === ARM_L ? PAL.leaf0 : PAL.leaf1));
        }
      }
      const hx = sx + dir * ca * (ARM_L + 1);
      const hy = sy + sa * (ARM_L + 1) + dip;
      const open = b.arm >= 2 ? 1 : 0;
      const fan: [number, number, number][] = [
        [-1 - open, PAL.gold3, 3],
        [0, PAL.gold3, 4],
        [1 + open, PAL.gold2, 3],
      ];
      for (const [k, tone, len] of fan) {
        const ang = a + k * 0.62;
        const ex = hx + dir * Math.cos(ang) * len;
        const ey = hy + Math.sin(ang) * len + (k === 0 ? sway * 0.5 : k < 0 && dir > 0 ? sway : 0);
        p.line(R(hx), R(hy), R(ex), R(ey), C(tone));
      }
    }
  }
  // ---- the sack head + the hat
  if (b.headY !== null) {
    const oy = R(b.headY);
    const cx = HEAD_CX;
    const cy = HEAD_CY + oy + b.squash;
    const rx = 5 + (b.squash > 0 ? 1 : 0);
    const ry = 4 - b.squash;
    for (let y = cy - ry; y <= cy + ry; y++)
      for (let x = cx - rx; x <= cx + rx; x++) {
        const dx = (x - cx) / (rx + 0.5);
        const dy = (y - cy) / (ry + 0.5);
        if (dx * dx + dy * dy > 1) continue;
        const l = dx + dy;
        p.set(x, y, C(l < -0.7 ? PAL.earth4 : l > 0.6 ? PAL.earth2 : PAL.earth3));
      }
    // the sackcloth SEAM: a darker sewn band down the back of the sack (its shadow side), stitched every other row
    for (let y = cy - ry + 1; y <= cy + ry - 1; y++) {
      const sx = cx - 3 + (y > cy + 1 ? 1 : 0);
      p.set(sx, y, C(PAL.earth2));
      if ((y - cy) & 1) p.set(sx + 1, y, C(PAL.earth1));
    }
    // the DRAWSTRING: the sack gathered at the neck (a 1-px ink cord, its knotted end hanging in front) and a tuft of
    // straw flaring out under it
    p.hline(cx - 3, cx + 2, cy + ry + 1, C(PAL.ink));
    p.set(cx + 3, cy + ry + 2, C(PAL.ink));
    p.set(cx + 3, cy + ry + 3, C(PAL.earth1));
    for (const [tx, ty, tc] of [
      [-4, 2, PAL.gold3],
      [-5, 3, PAL.gold4],
      [-2, 2, PAL.gold4],
      [0, 2, PAL.gold3],
      [1, 3, PAL.gold2],
      [4, 2, PAL.gold2],
    ] as const)
      p.set(cx + tx, cy + ry + ty, C(tc));
    // the STITCHED MOUTH (facing right): an ink seam with three cross stitches
    p.hline(cx + 1, cx + 4, cy + 2, C(PAL.ink));
    for (const sx of [cx + 1, cx + 3]) {
      p.set(sx, cy + 1, C(PAL.earth1));
      p.set(sx + 1, cy + 3, C(PAL.earth1));
    }
    // the BUTTON EYES: 2×2 dark buttons with a 1-px sheen (lit later, over the outline)
    if (b.eyes === 0)
      for (const ex of [cx, cx + 3]) {
        p.set(ex, cy - 1, C(PAL.night3));
        p.set(ex + 1, cy - 1, C(PAL.ink));
        p.set(ex, cy, C(PAL.ink));
        p.set(ex + 1, cy, C(PAL.ink));
      }
  }
  if (b.hatY !== null) {
    const oy = R(b.hatY);
    const cx = HEAD_CX;
    const brim = FY - 30 + oy;
    for (let x = cx - 7; x <= cx + 7; x++) {
      const drop = x >= cx + 6 ? 1 : 0;
      p.set(x, brim + drop, C(x < cx - 2 ? PAL.earth2 : PAL.earth1));
    }
    for (let y = brim - 4; y < brim; y++) {
      const hw = y === brim - 4 ? 2 : 3;
      for (let x = cx - hw; x <= cx + hw - (y === brim - 4 ? 1 : 0); x++) p.set(x, y, C(x < cx - 1 ? PAL.earth2 : y === brim - 1 ? PAL.earth0 : PAL.earth1));
    }
    p.set(cx + 4, brim - 2 + (fr === 1 ? -1 : 0), C(PAL.gold3));
  }
  p.outline(PAL.ink);
  // ---- unlit overlays (never outlined): the fall streaks, the cracks, the lit eyes
  if (b.streak > 0 && b.stake) {
    const top = FY - STAKE_TOP + R(b.stakeY);
    for (let k = 1; k <= b.streak; k++) {
      if (k % 3 === 0) continue;
      p.set(FX - 2, top - k, k < 6 ? PAL.gold4 : PAL.earth4);
      if (k % 2) p.set(FX + 2, top - k - 2, PAL.earth3);
    }
  }
  if (b.crater > 0) {
    // the stake punched into the soil: a dark hole round its foot, the soil heaved up in a lit rim, pushed out further
    // as it settles (3 states): earth0 hole, earth1 inner wall, earth3 / earth2 rim (lit on the far side)
    const k = b.crater;
    const rx = k === 1 ? 6 : k === 2 ? 7 : 7;
    const ry = 2.6;
    for (let x = FX - rx - 1; x <= FX + rx + 1; x++)
      for (let y = FY - 2; y <= FY + 4; y++) {
        const c = p.get(x, y);
        // never over the stake's wood (its ink outline at the foot is soil now)
        if (c !== null && c !== PAL.ink) continue;
        const dx = (x - FX) / (rx + 0.5);
        const dy = (y - (FY + 1)) / ry;
        const r2 = dx * dx + dy * dy;
        if (r2 > 1) continue;
        const far = y <= FY;
        let tone: number;
        if (r2 < 0.22) tone = PAL.earth0; // the hole
        else if (r2 < 0.5) tone = k === 3 ? PAL.earth0 : PAL.earth1; // its wall
        else if (far) tone = k === 1 ? (r2 > 0.8 ? PAL.earth4 : PAL.earth3) : k === 2 ? PAL.earth3 : PAL.earth2; // the heaved rim, lit
        else tone = k === 3 ? PAL.earth1 : PAL.earth2;
        p.set(x, y, tone);
      }
  }
  if (b.cracks > 0) {
    const tone = b.cracks === 1 ? PAL.ink : PAL.night1;
    const rays: [number, number][] = [
      [-2, 1],
      [2, 1],
      [-2, -1],
      [2, -1],
      [0, 1],
    ];
    rays.forEach(([dx, dy], i) => {
      const len = 3 + (i % 3);
      for (let k = 1; k <= len; k++) p.set(FX + dx * k + (dx > 0 ? 1 : -1), FY + 1 + Math.round(dy * k * 0.5), tone);
    });
  }
  if (b.headY !== null && b.eyes > 0) {
    const cx = HEAD_CX;
    const cy = HEAD_CY + R(b.headY) + b.squash;
    const core = b.eyes === 1 ? PAL.white : b.eyes === 2 ? PAL.gold4 : b.eyes === 3 ? PAL.gold3 : PAL.gold2;
    for (const ex of [cx, cx + 3]) {
      p.set(ex, cy - 1, core);
      p.set(ex + 1, cy - 1, core);
      p.set(ex, cy, core);
      p.set(ex + 1, cy, core);
      // the glint: a cross of light off each button (2 px at the flash, then 1 px)
      const arm = b.eyes === 1 ? 2 : b.eyes === 2 ? 1 : 0;
      const ct = b.eyes === 1 ? PAL.gold4 : PAL.gold3;
      for (let k = 1; k <= arm; k++) {
        p.set(ex, cy - 1 - k, ct);
        p.set(ex + 1, cy + k, ct);
        if (ex === cx) p.set(ex - k, cy, ct);
        else p.set(ex + 1 + k, cy - 1, ct);
      }
    }
  }
}


// ================================================================ the crow (the hero beat)

export type CrowPose = 'up' | 'mid' | 'down' | 'flare' | 'perch' | 'crouch' | 'caw' | 'cawEnd' | 'bob';
export const CW = 36;
export const CH = 28;
/** The crow's anchor inside its raster: perched, where its toes grip; flying, under its belly. */
export const CFX = 16;
export const CFY = 21;
/** The lowest pixel of any flying pose under the anchor (the down-stroke's wing tips), and the highest above it. */
export const CROW_LOW = 3;
export const CROW_HIGH = 12;

/**
 * ink k · feather bands: a stone0 (soft dark), 1 stone1 (coverts), 2 stone2 (primaries' edges) · b stone3 / c stone2
 * the beak · e gold4 the eye · l stone2 the legs. Every upper edge gets a mist / stone3 rim of evening light after.
 */
const CK: Record<string, number> = { k: PAL.ink, a: PAL.stone0, '1': PAL.stone1, '2': PAL.stone2, b: PAL.stone3, c: PAL.stone2, e: PAL.gold4, l: PAL.stone2 };

/** Flying: the body, level, facing right (20 × 5; its belly row is the anchor's row − 2). */
const FLY_BODY = [
  '..............kkk...',
  'kk.....kkkkkkkekkbb.',
  'kkkaakkkk11kkkkkcc..',
  '.kkkkkk1111kkkk.....',
  '..k.....kkkkk.......',
];
/** The near wing per stroke, placed against the body stamp (dx, dy from its top-left). */
const FLY_WING: Record<'up' | 'mid' | 'down', { dx: number; dy: number; rows: string[] }> = {
  up: {
    dx: 1,
    dy: -6,
    rows: ['..2.2.2......', '.k1k1k1k.....', '..kkkkkkk....', '...kkk1kkk...', '....kkk11k...', '.....kkk1k...', '......kkkk...'],
  },
  mid: {
    dx: -1,
    dy: -3,
    rows: ['.2.2.2.........', 'k1k1k1kkk......', '.kkkkkk11kkk...', '.....kkkkkkk...'],
  },
  down: {
    dx: 1,
    dy: 4,
    rows: ['......kkkkk....', '.....kkk11k....', '....kkk11k.....', '...kkk1kk......', '..k1k1k........', '..2.2.2........'],
  },
};
/** Braking to land: tilted up, both wings thrown up and forward (notched primaries), tail fanned, legs reaching. */
const FLARE = [
  '......2.2.2.......',
  '.....k1k1k1k......',
  '..2.kkkkkkk.......',
  '.k1kkkk1kkk.kkk...',
  '..kkkk11kk.kkkkk..',
  '...kkk1kkkkkkekbb.',
  '....kkkkkkkkkkcc..',
  '.....kkkkkkkk.....',
  '....kkkaakkk......',
  '...kk.kkkkk.......',
  '..k2k..kkk........',
  '..2.2...l.l.......',
  '........l..l......',
  '.......ll..ll.....',
];
/** Perched, facing right: the body with its folded wing (feather bands) and the tail down behind (12 × 9). */
const PERCH_BODY = [
  '......kkkk..',
  '....kkkkkkk.',
  '...kk11kkkkk',
  '..kk1111kkkk',
  '..k112211kkk',
  '.kk1222kkkk.',
  '.kk222kkkk..',
  'kk22.kkkk...',
  'k2....kk....',
];
const HEAD = ['.kkk.', 'kkkkk', 'kkkkk', 'kkkkk', '.kkk.'];

/**
 * Paint the crow (facing right) in a pose on a cleared canvas. `tick` (0 none, 1, 2) draws the caw's sound ticks:
 * three short 1-px lines fanning from the open beak (1 near, 2 further out).
 */
export function paintCrowPx(p: PixelCanvas, pose: CrowPose, tick = 0): void {
  const flying = pose === 'up' || pose === 'mid' || pose === 'down';
  let head: XY;
  let beak: 'closed' | 'open' | 'half' = 'closed';
  let topRim = true;
  if (flying) {
    const x0 = CFX - 10;
    const y0 = CFY - 6;
    p.stamp(FLY_BODY, CK, x0, y0);
    const w = FLY_WING[pose];
    p.stamp(w.rows, CK, x0 + w.dx, y0 + w.dy);
    head = { x: x0 + 15, y: y0 + 1 };
  } else if (pose === 'flare') {
    const x0 = CFX - 9;
    const y0 = CFY - 13;
    p.stamp(FLARE, CK, x0, y0);
    head = { x: x0 + 12, y: y0 + 5 };
  } else {
    // perched: the body dips 1 px on the call (the legs fold), the head is thrown up and forward
    const dip = pose === 'caw' || pose === 'cawEnd' ? 1 : pose === 'crouch' ? 1 : 0;
    const bx = CFX - 6;
    const by = CFY - 11 + dip;
    p.stamp(PERCH_BODY, CK, bx, by);
    const hd: XY = pose === 'caw' ? { x: 2, y: -2 } : pose === 'cawEnd' ? { x: 1, y: -1 } : pose === 'crouch' ? { x: -1, y: 1 } : pose === 'bob' ? { x: 1, y: 1 } : { x: 0, y: 0 };
    head = { x: bx + 10 + hd.x, y: by - 2 + hd.y };
    // the neck: from the shoulders to the head (stretched on the call)
    p.thickLine(bx + 9, by + 1, head.x, head.y + 1, 2, PAL.ink);
    p.stamp(HEAD, CK, head.x - 2, head.y - 2);
    // legs and the toes gripping the sleeve
    for (const lx of [CFX - 1, CFX + 1]) for (let y = by + 9; y < CFY; y++) p.set(lx, y, PAL.stone2);
    p.hline(CFX - 2, CFX + 3, CFY, PAL.stone2);
    p.set(CFX - 3, CFY, PAL.stone1);
    // the throat hackles PUFF out on the call (ragged stone feathers under the beak)
    if (pose === 'caw' || pose === 'cawEnd') {
      const t: [number, number, number][] =
        pose === 'caw'
          ? [
              [1, 3, PAL.stone2],
              [2, 3, PAL.stone1],
              [3, 2, PAL.stone2],
              [2, 4, PAL.stone1],
              [0, 4, PAL.stone1],
            ]
          : [
              [1, 3, PAL.stone1],
              [2, 3, PAL.stone2],
            ];
      for (const [dx, dy, c] of t) p.set(head.x + dx, head.y + dy, c);
    }
    beak = pose === 'caw' ? 'open' : pose === 'cawEnd' ? 'half' : 'closed';
    topRim = true;
  }
  // the evening rim light on every upper edge (mist on the head and back, stone3 on the wings), a cool stone1 bounce
  // light on the lower edges — the silhouette separates from the dark floor and the back wall
  if (topRim) {
    const rim: XY[] = [];
    const under: XY[] = [];
    for (let y = 0; y < CH; y++)
      for (let x = 0; x < CW; x++) {
        const c = p.get(x, y);
        if (c === null) continue;
        if (c === PAL.ink || c === PAL.stone0) {
          if (p.get(x, y - 1) === null) rim.push({ x, y });
          else if (p.get(x, y + 1) === null) under.push({ x, y });
        }
      }
    for (const q of rim) p.set(q.x, q.y, Math.abs(q.x - head.x) <= 3 || (!flying && pose !== 'flare') ? PAL.mist : PAL.stone3);
    for (const q of under) p.set(q.x, q.y, PAL.stone1);
  }
  // the beak and the eye
  const bx = head.x + 3;
  const by = head.y;
  // (flying, the eye is in the stamp)
  if (flying || pose === 'flare') return;
  if (beak === 'open') {
    // wide open (2 px): the upper mandible tips up, the lower drops, the dark gape between
    p.hline(bx, bx + 2, by - 1, PAL.stone3);
    p.set(bx + 3, by - 2, PAL.stone3);
    p.set(bx, by, PAL.crim0);
    p.hline(bx, bx + 1, by + 1, PAL.crim0);
    p.hline(bx, bx + 2, by + 2, PAL.stone2);
    p.set(bx + 3, by + 3, PAL.stone2);
  } else if (beak === 'half') {
    p.hline(bx, bx + 3, by - 1, PAL.stone3);
    p.set(bx, by, PAL.crim0);
    p.hline(bx, bx + 2, by + 1, PAL.stone2);
  } else {
    p.hline(bx, bx + 3, by, PAL.stone3);
    p.set(bx + 4, by + 1, PAL.stone2);
    p.hline(bx, bx + 2, by + 1, PAL.stone2);
  }
  p.set(head.x + 1, head.y - 1, PAL.gold4);
  // the call's sound ticks: three 2-px strokes fanning out of the beak (up, ahead, down), further out on tick 2
  if (tick > 0 && beak === 'open') {
    const o = tick === 1 ? 2 : 5;
    const tc = tick === 1 ? PAL.mist : PAL.stone3;
    const tx = bx + 3 + o;
    const ty = by;
    p.set(tx, ty - 3 - (tick - 1), tc);
    p.set(tx + 1, ty - 4 - (tick - 1), tc);
    p.set(tx + 1, ty, tc);
    p.set(tx + 2, ty, tc);
    p.set(tx, ty + 3 + (tick - 1), tc);
    p.set(tx + 1, ty + 4 + (tick - 1), tc);
  }
}
