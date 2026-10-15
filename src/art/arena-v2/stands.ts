// Arena v2 stadium art: the stadium floor (the pitch) around the platform and the two iso stands.
//
// The stands are a "square bowl": the stand height is a step function of m = min(c, r) — tiers
// rise going away from the field along both back sides and meet in a mitred corner behind the
// board's top corner. Each pixel is ray-cast against that heightfield (exact, crisp), so risers,
// treads, the front wall, the back wall and the roof all line up with the 2:1 projection.
//
// Value plan: the stands are a calm, dark mass (mostly muted night clothes, the team colours
// only bright in the two front rows, the back rows deeper in the roof's shadow) so the marble is
// the brightest area and the monsters the most saturated. Phone lights, flags and the LED boards
// are the bright accents. The crowd is cut into narrow chunks along each stand (so a wave can
// run along it), each with idle frames and "arms up" frames per fan side (BoardView.crowd).
//
// A dark players' booth breaks the right stand's front behind P2's podium, so P2's duelist
// reads against it instead of dissolving into the crimson crowd.

import type { PlayerId } from '../../engine/types';
import { getFont } from '../font';
import { PAL } from '../palette';
import { type Color, PixelCanvas, mulberry32 } from '../pixel';
import { FACE_T, GC0, GC1, GR0, GR1, HH, HW, P, STAD_RECT, STAND, STAND_C, STAND_FAR, TOWERS, gridAt, tierC, tierZ } from './geom';
import { linePx } from './util';

export const CROWD_FRAMES = 8;
/** Frames of the "arms up" sets (per fan side and all). */
export const CROWD_UP_FRAMES = 4;
/** Width (px) of one crowd chunk along a stand. */
export const CROWD_CHUNK_W = 32;
const N = STAND.tiers;
const D = STAND.depth;
const ROOF_Z = (): number => tierZ(N - 1) + STAND.back;
/** Grid "m" of the back wall (behind the last tread). */
const M_BACK = STAND_C - N * D;
const ROOF_DEPTH = 0.35;

/** The players' booth in the right stand behind P2's podium: along-stand range and the tiers it replaces. */
export const BOOTH = { a0: 3.45, a1: 5.05, tiers: 4 } as const;
const BOOTH_Z = (): number => tierZ(BOOTH.tiers);
const inBooth = (u: number) => u > 0 && u >= BOOTH.a0 && u <= BOOTH.a1;

type HitKind = 'floor' | 'wall' | 'riser' | 'tread' | 'back' | 'roof' | 'booth' | 'boothTop' | 'sky';
interface Hit {
  kind: HitKind;
  k: number;
  m: number;
  z: number;
  /** c − r (which stand: < 0 left, > 0 right) */
  u: number;
}

/** Ray-cast the stadium heightfield for the world pixel (x, y). */
function cast(x: number, y: number): Hit {
  const u = (x + 0.5 - 300) / HW;
  const Y = y + 0.5 - 66;
  const K = HH * Math.abs(u) - Y; // z(m) = 40 m + K
  const zAt = (m: number) => 2 * HH * m + K;
  const mFloor = (-FACE_T - K) / (2 * HH);
  if (mFloor >= STAND_C) return { kind: 'floor', k: -1, m: mFloor, z: -FACE_T, u };
  const booth = inBooth(u);
  // front wall (the booth raises it over the first tiers)
  let z = zAt(STAND_C);
  if (booth && z <= BOOTH_Z()) return { kind: 'booth', k: 0, m: STAND_C, z, u };
  if (!booth && z <= tierZ(0)) return { kind: 'wall', k: 0, m: STAND_C, z, u };
  if (booth) {
    const mTop = (BOOTH_Z() - K) / (2 * HH);
    if (mTop >= tierC(BOOTH.tiers)) return { kind: 'boothTop', k: BOOTH.tiers, m: mTop, z: BOOTH_Z(), u };
  }
  for (let k = booth ? BOOTH.tiers : 0; k < N; k++) {
    const ck = tierC(k);
    const mHit = (tierZ(k) - K) / (2 * HH);
    if (mHit >= ck - D) return { kind: 'tread', k, m: mHit, z: tierZ(k), u };
    z = zAt(ck - D);
    if (k + 1 < N && z <= tierZ(k + 1)) return { kind: 'riser', k: k + 1, m: ck - D, z, u };
  }
  // back wall behind the top tread
  z = zAt(M_BACK);
  if (z <= ROOF_Z()) return { kind: 'back', k: N, m: M_BACK, z, u };
  const mRoof = (ROOF_Z() - K) / (2 * HH);
  if (mRoof >= M_BACK - ROOF_DEPTH) return { kind: 'roof', k: N, m: mRoof, z: ROOF_Z(), u };
  return { kind: 'sky', k: -1, m: 0, z: 0, u };
}

/** Grid (c, r) of a hit (from m = min(c, r) and u = c − r). */
function hitCR(h: Hit): { c: number; r: number } {
  return h.u >= 0 ? { c: h.m + h.u, r: h.m } : { c: h.m, r: h.m - h.u };
}

/** Along-stand coordinate (grid units from the back corner) of a hit. */
function along(h: Hit): number {
  return Math.abs(h.u);
}

export interface CrowdChunk {
  /** world px of the chunk texture's top-left */
  x: number;
  y: number;
  w: number;
  h: number;
  stand: 0 | 1;
  /** along-stand position of the chunk's center (grid units from the back corner) */
  a: number;
  /** frames: 'i0'..'i7' idle, `u${0|1|'a'}:${f}` arms up (P1 fans / P2 fans / everyone) */
  frames: [string, PixelCanvas][];
}

export interface StandsArt {
  base: PixelCanvas;
  /** The stadium as lit by lava from the platform (walls, lower tiers): crossfaded at runtime. */
  hot: PixelCanvas;
  crowd: CrowdChunk[];
  /** Fan flags in the visible stands (world px of the pole foot) + fan side; small = a 6-px hand flag. */
  flags: { x: number; y: number; side: PlayerId; design: number; phase: number; row: number; small: boolean }[];
  /** Phone-light spots (world px). */
  phones: { x: number; y: number; side: PlayerId }[];
  /** Banners hung on the front wall: world px of the top-left anchor + length (px along x) + stand. */
  banners: { x: number; y: number; len: number; stand: 0 | 1; side: PlayerId; design: number }[];
  /** LED boards on the front wall: the pixel map of each board (columns along the wall). */
  boards: LedBoard[];
  /** Lamps along the roof edge (world px). */
  roofLights: { x: number; y: number }[];
  /** A spotlight path over the crowd (for the roving follow spot): per stand, endpoints in world px. */
  crowdSpan: { a: [number, number]; b: [number, number] }[];
  /** The players' booth: its LED strip pixels (world px) for a runtime chase. */
  boothLeds: { x: number; y: number }[];
}

export interface LedBoard {
  /** bounding box (world px) */
  x: number;
  y: number;
  w: number;
  h: number;
  /** board columns: screen x, screen y of the LED band's top row, u = column index along the board */
  cols: { x: number; y: number; u: number }[];
  rows: number;
  stand: 0 | 1;
  /** what it shows: scrolling text, a running chase, a waving team flag */
  mode: 'text' | 'chase' | 'flag';
}

/** LED band rows: a 7-row glyph plus a 1-px margin above and below (letters never leave the band). */
export const LED_ROWS = 9;

// ---------------------------------------------------------------- floor

/** The painted boundary rectangle on the pitch (grid lines at floor level). */
export const PITCH_LINES = { c0: GC0 - 0.55, c1: GC1 + 0.55, r0: GR0 - 0.55, r1: GR1 + 0.55 } as const;

function floorColor(c: number, r: number): Color {
  // a dark rubber pitch with broad mowing stripes along the duel axis (flat tones, no noise)
  const stripe = Math.floor((r + 40) / 1.5) & 1;
  let col: Color = stripe ? PAL.night1 : PAL.night0;
  // painted lines: a boundary rectangle around the platform and a dashed one further out
  const { c0: L0c, c1: L1c, r0: L0r, r1: L1r } = PITCH_LINES;
  const onLine = (a: number, b: number) => Math.abs(a - b) * 2 * HH < 0.9;
  const inR = r > L0r - 0.02 && r < L1r + 0.02;
  const inC = c > L0c - 0.02 && c < L1c + 0.02;
  if ((inR && (onLine(c, L0c) || onLine(c, L1c))) || (inC && (onLine(r, L0r) || onLine(r, L1r)))) col = PAL.night4;
  const dash = ((c + r) * 3) % 1 < 0.55;
  if (dash && ((inR && (onLine(c, L0c - 0.6) || onLine(c, L1c + 0.6))) || (inC && (onLine(r, L0r - 0.6) || onLine(r, L1r + 0.6))))) col = PAL.night3;
  // corner arcs (quarter circles at the line rectangle's corners)
  for (const [ac, ar] of [
    [L0c, L0r],
    [L1c, L0r],
    [L1c, L1r],
    [L0c, L1r],
  ] as const) {
    const d = Math.hypot(c - ac, r - ar);
    if (Math.abs(d - 0.45) * 2 * HH < 0.9 && (c - ac) * (ac === L0c ? 1 : -1) > 0 && (r - ar) * (ar === L0r ? 1 : -1) > 0) col = PAL.night4;
  }
  return col;
}

// ---------------------------------------------------------------- people

const SKIN = [PAL.skin1, PAL.skin2, PAL.skin2, PAL.skin3, PAL.skin1, PAL.skin2, PAL.skin0];
const HAIR = [PAL.ink, PAL.earth1, PAL.earth0, PAL.gold1, PAL.stone1, PAL.ink, PAL.earth1, PAL.night1];
/** Muted night clothes (most of the crowd): [lit top row, body]. */
const MUTED: [Color, Color][] = [
  [PAL.night3, PAL.night2],
  [PAL.night2, PAL.night1],
  [PAL.stone2, PAL.stone1],
  [PAL.night4, PAL.night3],
  [PAL.earth1, PAL.earth0],
  [PAL.void1, PAL.void0],
  [PAL.night3, PAL.night2],
  [PAL.water1, PAL.water0],
  [PAL.stone1, PAL.stone0],
];
const ACCENT: [Color, Color][] = [
  [PAL.stone3, PAL.stone2],
  [PAL.gold2, PAL.gold1],
  [PAL.steel, PAL.night4],
];
/** Team shirts: the full neon only in the two front rows; further back a calmer ramp. */
const FAN_SHIRTS_FRONT: Record<PlayerId, [Color, Color][]> = {
  0: [
    [PAL.cyan3, PAL.cyan2],
    [PAL.cyan2, PAL.cyan1],
  ],
  1: [
    [PAL.crim3, PAL.crim2],
    [PAL.crim2, PAL.crim1],
  ],
};
const FAN_SHIRTS_BACK: Record<PlayerId, [Color, Color][]> = {
  0: [
    [PAL.cyan2, PAL.cyan1],
    [PAL.cyan1, PAL.cyan0],
  ],
  1: [
    [PAL.crim2, PAL.crim1],
    [PAL.crim1, PAL.crim0],
  ],
};
/** One step darker (back rows sit in the roof's shadow). */
const DARKER = new Map<Color, Color>([
  [PAL.white, PAL.mist],
  [PAL.mist, PAL.steel],
  [PAL.steel, PAL.night4],
  [PAL.night4, PAL.night3],
  [PAL.night3, PAL.night2],
  [PAL.night2, PAL.night1],
  [PAL.night1, PAL.night0],
  [PAL.cyan4, PAL.cyan3],
  [PAL.cyan3, PAL.cyan2],
  [PAL.cyan2, PAL.cyan1],
  [PAL.cyan1, PAL.cyan0],
  [PAL.crim4, PAL.crim3],
  [PAL.crim3, PAL.crim2],
  [PAL.crim2, PAL.crim1],
  [PAL.crim1, PAL.crim0],
  [PAL.gold3, PAL.gold2],
  [PAL.gold2, PAL.gold1],
  [PAL.gold1, PAL.gold0],
  [PAL.stone3, PAL.stone2],
  [PAL.stone2, PAL.stone1],
  [PAL.stone1, PAL.stone0],
  [PAL.skin3, PAL.skin2],
  [PAL.skin2, PAL.skin1],
  [PAL.skin1, PAL.skin0],
  [PAL.earth2, PAL.earth1],
  [PAL.earth1, PAL.earth0],
  [PAL.water1, PAL.water0],
  [PAL.void1, PAL.void0],
]);
const dk = (c: Color, n: number): Color => {
  for (let i = 0; i < n; i++) c = DARKER.get(c) ?? c;
  return c;
};

interface Person {
  x: number;
  y: number; // feet
  row: number;
  a: number;
  stand: 0 | 1;
  skin: Color;
  hair: Color | null;
  shirt: [Color, Color];
  headLeft: boolean;
  /** behaviour: 0 calm, 1 bobber, 2 cheerer (arms up), 3 clapper, 4 waver (one arm) */
  kind: number;
  phase: number;
  cap: Color | null;
  side: PlayerId;
  /** holds a tiny hand flag (its colour) */
  flag: Color | null;
}

type Pose = { lift: number; arms: 'none' | 'up' | 'left' | 'clap' | 'right'; flagUp: boolean };

function idlePose(q: Person, f: number): Pose {
  const ph = (f + q.phase) % CROWD_FRAMES;
  let lift = 0;
  let arms: Pose['arms'] = 'none';
  switch (q.kind) {
    case 1:
      lift = ph === 0 || ph === 1 ? 1 : 0;
      break;
    case 2:
      lift = ph < 3 ? 1 : 0;
      arms = ph < 4 ? 'up' : 'none';
      break;
    case 3:
      arms = ph % 2 === 0 ? 'clap' : 'none';
      break;
    case 4:
      arms = ph < 2 ? 'left' : ph < 4 ? 'up' : ph < 6 ? 'right' : 'up';
      break;
  }
  return { lift, arms, flagUp: ph % 2 === 0 };
}

function upPose(q: Person, f: number): Pose {
  const ph = (f + q.phase) % CROWD_UP_FRAMES;
  return { lift: [1, 2, 1, 0][ph], arms: ph === 3 ? (q.phase & 1 ? 'left' : 'right') : 'up', flagUp: ph % 2 === 0 };
}

function drawPerson(p: PixelCanvas, q: Person, pose: Pose, ox: number, oy: number): void {
  const x = q.x - ox;
  const y = q.y - oy - pose.lift;
  const [s0, s1] = q.shirt;
  // torso 3×3 (top row lit)
  for (let i = -1; i <= 1; i++) {
    p.set(x + i, y - 3, s0);
    p.set(x + i, y - 2, i === -1 ? s0 : s1);
    p.set(x + i, y - 1, s1);
  }
  // head 2×2
  const hx = q.headLeft ? x - 1 : x;
  p.set(hx, y - 5, q.cap ?? q.hair ?? q.skin).set(hx + 1, y - 5, q.cap ?? q.hair ?? q.skin);
  p.set(hx, y - 4, q.skin).set(hx + 1, y - 4, q.skin);
  // arms
  const arms = pose.arms;
  if (arms === 'up') {
    p.set(x - 2, y - 4, s0).set(x - 2, y - 5, q.skin);
    p.set(x + 2, y - 4, s0).set(x + 2, y - 5, q.skin);
  } else if (arms === 'left') {
    p.set(x - 2, y - 4, s0).set(x - 3, y - 5, q.skin);
  } else if (arms === 'right') {
    p.set(x + 2, y - 4, s0).set(x + 3, y - 5, q.skin);
  } else if (arms === 'clap') {
    p.set(x, y - 3, q.skin);
  }
  // a tiny hand flag held over the head: it flicks side to side
  if (q.flag !== null) {
    const fx = arms === 'left' ? x - 3 : x + 2;
    p.set(fx, y - 6, PAL.stone3);
    if (pose.flagUp) p.set(fx + 1, y - 7, q.flag).set(fx + 1, y - 6, q.flag);
    else p.set(fx - 1, y - 7, q.flag).set(fx - 1, y - 6, q.flag);
  }
}

// ---------------------------------------------------------------- build

/** The lava-lit stadium: walls and the lower tiers turn to warm, darker embers (flat tones). */
const HEAT_NEAR = new Map<Color, Color>([
  [PAL.night0, PAL.crim0],
  [PAL.night1, PAL.fire0],
  [PAL.night2, PAL.crim0],
  [PAL.night3, PAL.fire1],
  [PAL.night4, PAL.crim1],
  [PAL.steel, PAL.fire2],
  [PAL.mist, PAL.fire3],
  [PAL.cyan0, PAL.earth0],
  [PAL.cyan1, PAL.earth1],
  [PAL.crim1, PAL.fire1],
  [PAL.crim0, PAL.fire0],
  [PAL.gold0, PAL.fire0],
  [PAL.gold1, PAL.fire2],
  [PAL.stone1, PAL.earth0],
  [PAL.stone2, PAL.earth1],
]);
/** The middle tiers: the navy only warms a little (dusk tones), the top stays a night match. */
const HEAT_MID = new Map<Color, Color>([
  [PAL.night1, PAL.void0],
  [PAL.night2, PAL.void1],
  [PAL.night3, PAL.crim0],
  [PAL.cyan0, PAL.earth0],
  [PAL.cyan1, PAL.earth1],
  [PAL.crim1, PAL.crim0],
]);

export function buildStands(): StandsArt {
  const R = STAD_RECT;
  const base = new PixelCanvas(R.w, R.h);
  const hot = new PixelCanvas(R.w, R.h);
  const roofLights: StandsArt['roofLights'] = [];
  const boothLeds: StandsArt['boothLeds'] = [];

  // ---- per-pixel cast: floor, walls, tiers, roof
  for (let y = 0; y < R.h; y++)
    for (let x = 0; x < R.w; x++) {
      const wx = x + R.x;
      const wy = y + R.y;
      const h = cast(wx, wy);
      if (h.kind === 'sky') continue;
      const { c, r } = hitCR(h);
      const leftStand = h.u < 0;
      const a = along(h);
      let col: Color;
      // how much the lava below would light this pixel: 2 near, 1 a little, 0 not at all
      let heat = 0;
      switch (h.kind) {
        case 'floor': {
          col = floorColor(c, r);
          // a gutter + shadow strip along the stand walls (solid)
          const toWall = (Math.min(c, r) - STAND_C) * 2 * HH;
          if (toWall < 2) col = PAL.ink;
          else if (toWall < 4) col = PAL.night0;
          heat = 0; // the floor's lava glow is a runtime light (smooth, no remap)
          break;
        }
        case 'wall': {
          const k = Math.round(tierZ(0) - h.z); // 0 = top of the wall
          if (k <= 0) col = PAL.night4;
          else if (k === 1) col = PAL.night2;
          else if (k >= STAND.wall - 1) col = PAL.ink;
          else col = (Math.floor(a * 10) & 1) === 0 && k > 9 ? PAL.night1 : PAL.night0;
          heat = 2;
          break;
        }
        case 'booth': {
          // the players' booth: lit roof lip, a crimson team strip, dark glass, a low wall
          const k = Math.round(BOOTH_Z() - h.z);
          const H = BOOTH_Z() + FACE_T;
          const edge = Math.min(a - BOOTH.a0, BOOTH.a1 - a) * 2 * HH; // px from the booth's ends
          if (k <= 0) col = PAL.night4;
          else if (k === 1) col = PAL.night2;
          else if (k === 2 || k === 4) col = PAL.crim0;
          else if (k === 3) {
            col = PAL.crim1;
            boothLeds.push({ x: wx, y: wy });
          } else if (k < H - 9) {
            col = PAL.night0;
            // mullions + a faint diagonal reflection on the glass
            if (Math.abs(((a - BOOTH.a0) * 10) % 2) < 0.25) col = PAL.night2;
            else if ((Math.floor(wx / 2) + k) % 23 === 0) col = PAL.night1;
          } else if (k < H - 1) col = (k - (H - 9)) % 4 === 0 ? PAL.night2 : PAL.night1;
          else col = PAL.ink;
          if (edge < 1) col = PAL.ink;
          else if (edge < 2 && k > 1) col = PAL.night2;
          heat = 2;
          break;
        }
        case 'boothTop': {
          const dm = (STAND_C - h.m) * 2 * HH;
          col = dm < 1 ? PAL.night3 : PAL.night1;
          heat = 1;
          break;
        }
        case 'riser': {
          // risers: vertical concrete faces; the right stand's face the light (upper left)
          col = leftStand ? PAL.night1 : PAL.night2;
          if (Math.round(tierZ(h.k) - h.z) === 0) col = leftStand ? PAL.night2 : PAL.night3; // lit nosing
          heat = h.k <= 1 ? 2 : h.k <= 3 ? 1 : 0;
          break;
        }
        case 'tread': {
          col = leftStand ? PAL.night1 : PAL.night2;
          // seat backs (rows of dim team-coloured seats; the crowd covers most of them)
          const s = (a * 13.33) % 1;
          if (s < 0.6) {
            const r2 = mulberry32(Math.floor(a * 13.33) * 97 + h.k * 13)();
            const side = r2 < 0.5 - (h.u * 0.09) / 1 ? 0 : 1;
            col = side === 0 ? (leftStand ? PAL.cyan0 : PAL.cyan1) : leftStand ? PAL.crim0 : PAL.crim1;
          }
          // aisles every few metres
          if (Math.abs(((a + 0.3) % 1.6) - 0.8) < 0.04) col = leftStand ? PAL.night2 : PAL.night3;
          heat = h.k <= 1 ? 2 : h.k <= 3 ? 1 : 0;
          break;
        }
        case 'back': {
          const k = Math.round(ROOF_Z() - h.z);
          col = k <= 0 ? PAL.night3 : PAL.night0;
          // private boxes: lit windows along the back wall
          if (k >= 2 && k <= 4 && Math.floor(a * 6) % 3 !== 0 && (a * 6) % 1 > 0.18) col = k === 2 ? PAL.gold1 : k === 3 ? PAL.gold0 : PAL.night1;
          break;
        }
        case 'roof': {
          const dm = (M_BACK - h.m) * 2 * HH; // px back from the roof edge
          col = dm < 1 ? PAL.night4 : dm < 2 ? PAL.night1 : PAL.ink;
          // trusses
          if (Math.abs(((a * 2.5) % 1) - 0.5) < 0.04) col = PAL.night1;
          break;
        }
        default:
          col = PAL.ink;
      }
      base.set(x, y, col);
      const hc = heat === 2 ? HEAT_NEAR.get(col) : heat === 1 ? HEAT_MID.get(col) : undefined;
      hot.set(x, y, hc ?? col);
    }

  // ---- roof edge lamps (small spots, blinking at runtime)
  for (const stand of [0, 1] as const) {
    for (let a = 0.4; a < STAND_FAR; a += 0.55) {
      const [x, y] = stand === 0 ? P(M_BACK, M_BACK + a, ROOF_Z()) : P(M_BACK + a, M_BACK, ROOF_Z());
      const px = Math.round(x);
      const py = Math.round(y) - 1;
      if (px < R.x || px >= R.x + R.w) continue;
      base.set(px - R.x, py - R.y, PAL.night3);
      hot.set(px - R.x, py - R.y, PAL.night3);
      roofLights.push({ x: px, y: py });
    }
  }

  // ---- crowd: people on every tread, drawn back to front
  const people: Person[] = [];
  const phones: StandsArt['phones'] = [];
  const pr = mulberry32(777);
  for (let k = N - 1; k >= 0; k--) {
    const mMid = tierC(k) - D / 2;
    for (const stand of [0, 1] as const) {
      for (let a = 0.04 + (k % 2) * 0.035; a < STAND_FAR; a += 0.075) {
        if (pr() < 0.07) continue; // an empty seat
        if (stand === 1 && k < BOOTH.tiers && a > BOOTH.a0 - 0.04 && a < BOOTH.a1 + 0.04) continue; // the booth
        const [fx, fy] = stand === 0 ? P(mMid, mMid + a, tierZ(k)) : P(mMid + a, mMid, tierZ(k));
        const x = Math.round(fx + (pr() - 0.5) * 0.8);
        const y = Math.round(fy);
        if (x < -72 || x > 712) continue; // well outside any camera move
        // fan sections: P1's fans fill the left stand's far end, P2's the right stand; the
        // sections near the back corner are mixed
        const section = Math.floor(a / 1.15);
        const secSide: PlayerId | null = a < 1.6 ? null : stand === 0 ? (section % 4 === 3 ? 1 : 0) : section % 5 === 4 ? 0 : 1;
        const side: PlayerId = secSide ?? (pr() < 0.5 ? 0 : 1);
        const roll = pr();
        // ~70 % muted clothes: the team colours are an accent, not the whole stand
        const fanShare = secSide === null ? 0.12 : 0.24;
        const front = k <= 1;
        const shirts = front ? FAN_SHIRTS_FRONT[side] : FAN_SHIRTS_BACK[side];
        const shirt = roll < fanShare ? shirts[Math.floor(pr() * shirts.length)] : roll < fanShare + 0.06 ? ACCENT[Math.floor(pr() * ACCENT.length)] : MUTED[Math.floor(pr() * MUTED.length)];
        // back rows sit deeper in the roof's shadow
        const depth = k >= 4 ? 2 : k >= 2 ? 1 : 0;
        const kindRoll = pr();
        const q: Person = {
          x,
          y,
          row: k,
          a,
          stand,
          skin: dk(SKIN[Math.floor(pr() * SKIN.length)], depth),
          hair: pr() < 0.7 ? HAIR[Math.floor(pr() * HAIR.length)] : null,
          shirt: [dk(shirt[0], depth), dk(shirt[1], depth)],
          headLeft: pr() < 0.5,
          kind: kindRoll < 0.24 ? 0 : kindRoll < 0.56 ? 1 : kindRoll < 0.72 ? 2 : kindRoll < 0.88 ? 3 : 4,
          phase: Math.floor(pr() * CROWD_FRAMES),
          cap: pr() < 0.1 ? dk(side === 0 ? PAL.cyan1 : PAL.crim1, depth) : null,
          side,
          flag: null,
        };
        if (secSide !== null && pr() < 0.05) q.flag = side === 0 ? (front ? PAL.cyan3 : PAL.cyan2) : front ? PAL.crim3 : PAL.crim2;
        people.push(q);
        if (pr() < 0.05) phones.push({ x: x + (pr() < 0.5 ? -2 : 2), y: y - 6, side });
      }
    }
  }

  // ---- fan flags: only where the camera sees them (screen y ≈ 8…140), more under the cones
  const flags: StandsArt['flags'] = [];
  const fr = mulberry32(31337);
  const coneX = TOWERS.map((t) => t.x);
  const cands = people.filter((q) => q.row >= 1 && q.y - 14 >= 8 && q.y <= 140 && q.x >= 8 && q.x <= 632 && !(q.stand === 1 && q.a > BOOTH.a0 - 0.4 && q.a < BOOTH.a1 + 0.4));
  const weight = (q: Person) => 1 + 3 * Math.max(...coneX.map((cx) => Math.exp(-(((q.x - cx) / 26) ** 2))));
  const taken: Person[] = [];
  const want = 30;
  for (let guard = 0; taken.length < want && guard < 4000; guard++) {
    const q = cands[Math.floor(fr() * cands.length)];
    if (!q || fr() * 4 > weight(q)) continue;
    if (taken.some((o) => Math.abs(o.x - q.x) < 10 && Math.abs(o.y - q.y) < 8)) continue;
    taken.push(q);
    const small = fr() < 0.4;
    flags.push({ x: q.x + (fr() < 0.5 ? -2 : 2), y: q.y - 4, side: q.side, design: Math.floor(fr() * 3), phase: Math.floor(fr() * 8), row: q.row, small });
  }

  // ---- crowd chunks: narrow slices along each stand, every frame set
  const crowd: CrowdChunk[] = [];
  for (const stand of [0, 1] as const) {
    const mine = people.filter((q) => q.stand === stand);
    const byChunk = new Map<number, Person[]>();
    for (const q of mine) {
      const ci = Math.floor((q.x + 96) / CROWD_CHUNK_W);
      const list = byChunk.get(ci) ?? [];
      list.push(q);
      byChunk.set(ci, list);
    }
    for (const [, list] of [...byChunk.entries()].sort((p1, p2) => p1[0] - p2[0])) {
      const x0 = Math.min(...list.map((q) => q.x)) - 4;
      const x1 = Math.max(...list.map((q) => q.x)) + 4;
      const y0 = Math.min(...list.map((q) => q.y)) - 10;
      const y1 = Math.max(...list.map((q) => q.y)) + 1;
      const w = x1 - x0 + 1;
      const h = y1 - y0 + 1;
      const frames: [string, PixelCanvas][] = [];
      for (let f = 0; f < CROWD_FRAMES; f++) {
        const p = new PixelCanvas(w, h);
        for (const q of list) drawPerson(p, q, idlePose(q, f), x0, y0);
        frames.push([`i${f}`, p]);
      }
      for (const who of [0, 1, 'a'] as const) {
        for (let f = 0; f < CROWD_UP_FRAMES; f++) {
          const p = new PixelCanvas(w, h);
          for (const q of list) drawPerson(p, q, who === 'a' || q.side === who ? upPose(q, f) : idlePose(q, f * 2), x0, y0);
          frames.push([`u${who}:${f}`, p]);
        }
      }
      const aMid = list.reduce((s, q) => s + q.a, 0) / list.length;
      crowd.push({ x: x0, y: y0, w, h, stand, a: aMid, frames });
    }
  }

  // ---- banners over the front wall railing and LED boards along the wall
  const banners: StandsArt['banners'] = [];
  const boards: LedBoard[] = [];
  const wallTop = tierZ(0);
  const mkBoard = (stand: 0 | 1, a0: number, a1: number, mode: LedBoard['mode']) => {
    const cols: LedBoard['cols'] = [];
    const [xa] = stand === 0 ? P(STAND_C, STAND_C + a0, wallTop) : P(STAND_C + a0, STAND_C, wallTop);
    const [xb] = stand === 0 ? P(STAND_C, STAND_C + a1, wallTop) : P(STAND_C + a1, STAND_C, wallTop);
    const x0 = Math.round(Math.min(xa, xb));
    const x1 = Math.round(Math.max(xa, xb));
    for (let x = x0; x <= x1; x++) {
      // the wall's top edge at this column
      const g = gridAt(x + 0.5, 0, 0); // only c − r matters
      const uu = g.c - g.r;
      const m = STAND_C;
      const c = uu >= 0 ? m + uu : m;
      const r = uu >= 0 ? m : m - uu;
      const [, yTop] = P(c, r, wallTop);
      cols.push({ x, y: Math.round(yTop) + 2, u: x - x0 });
    }
    const ys = cols.map((q) => q.y);
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys) + LED_ROWS;
    boards.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, cols, rows: LED_ROWS, stand, mode });
  };
  // (the left stand's near-corner stretch is left to the hanging scoreboard)
  mkBoard(0, 3.0, 5.4, 'text');
  mkBoard(0, 5.8, 9.5, 'chase');
  mkBoard(1, 0.5, 2.7, 'text');
  mkBoard(1, 5.45, 7.5, 'flag');
  mkBoard(1, 7.85, 10.0, 'text');
  // banners hang in the gaps between boards
  const bannerAt = (stand: 0 | 1, a: number, side: PlayerId, design: number) => {
    const [x, y] = stand === 0 ? P(STAND_C, STAND_C + a, wallTop + 2) : P(STAND_C + a, STAND_C, wallTop + 2);
    banners.push({ x: Math.round(x), y: Math.round(y), len: 22, stand, side, design });
  };
  bannerAt(0, 2.9, 0, 0);
  bannerAt(0, 5.7, 0, 1);
  bannerAt(1, 2.85, 1, 0);
  bannerAt(1, 7.75, 1, 1);

  // the follow-spot path over each stand (mid-height of the tiers)
  const kMid = Math.floor(N / 2);
  const mm = tierC(kMid) - D / 2;
  const crowdSpan: StandsArt['crowdSpan'] = [
    { a: P(mm, mm + 0.5, tierZ(kMid)), b: P(mm, mm + 8, tierZ(kMid)) },
    { a: P(mm + 0.5, mm, tierZ(kMid)), b: P(mm + 8, mm, tierZ(kMid)) },
  ];

  return { base, hot, crowd, flags, phones, banners, boards, roofLights, crowdSpan, boothLeds };
}

// ---------------------------------------------------------------- cables + pitch props on the floor

export interface PitchLayout {
  /** junction box lights at the cables' far ends (world px) */
  boxLights: { x: number; y: number }[];
  /** maintenance LEDs along each cable run (world px), ordered from the platform outward */
  cableLeds: { x: number; y: number }[][];
  /** marker lights along the painted boundary line's two front sides (world px, in order) */
  markers: { x: number; y: number }[];
  /** the camera dolly's rail (world px of its two ends; the cart rides between them) */
  rail: { a: [number, number]; b: [number, number] };
  /** the standing camera operator (world px of the feet) */
  cameraman: { x: number; y: number };
  /** little status LEDs on the flight cases + the open case's monitor screen (world px) */
  caseLeds: { x: number; y: number; color: number }[];
  monitor: { x: number; y: number; w: number; h: number };
}

/** Cable runs, the dolly rail and the pitch-side props drawn into the stadium floor. */
export function drawPitch(base: PixelCanvas, hot: PixelCanvas, props: { cases: PixelCanvas[]; reel: PixelCanvas }): PitchLayout {
  const R = STAD_RECT;
  const both = (x: number, y: number, c: Color) => {
    base.set(x - R.x, y - R.y, c);
    hot.set(x - R.x, y - R.y, c);
  };
  const boxLights: PitchLayout['boxLights'] = [];
  const cableLeds: PitchLayout['cableLeds'] = [];
  const runs: [number, number][][] = [
    // lower left: from the P1 face out toward the screen edge
    [
      [0.6, GR1 + 0.02],
      [0.4, GR1 + 0.6],
      [-0.4, GR1 + 1.2],
      [-1.6, GR1 + 1.5],
    ],
    [
      [0.9, GR1 + 0.02],
      [0.8, GR1 + 0.7],
      [0.1, GR1 + 1.5],
      [-0.6, GR1 + 2.4],
    ],
    // lower right: from the right face toward the right edge
    [
      [GC1 + 0.02, 4.8],
      [GC1 + 0.7, 4.6],
      [GC1 + 1.3, 3.8],
      [GC1 + 2.6, 3.4],
    ],
    [
      [GC1 + 0.02, 4.4],
      [GC1 + 0.5, 4.1],
      [GC1 + 1.0, 3.2],
      [GC1 + 2.2, 2.5],
    ],
    // behind the platform: to the right stand's wall
    [
      [4.8, GR0 - 0.02],
      [4.9, GR0 - 0.4],
      [5.6, GR0 - 0.7],
      [6.6, STAND_C + 0.06],
    ],
    // behind on the left: to the left stand's wall
    [
      [GC0 - 0.02, 1.0],
      [GC0 - 0.45, 1.3],
      [GC0 - 0.75, 2.4],
      [STAND_C + 0.06, 3.4],
    ],
  ];
  for (const run of runs) {
    const pts: [number, number][] = [];
    for (let i = 0; i + 1 < run.length; i++) {
      const [c0, r0] = run[i];
      const [c1, r1] = run[i + 1];
      for (let t = 0; t < 1; t += 0.05) pts.push(P(c0 + (c1 - c0) * t, r0 + (r1 - r0) * t, -FACE_T));
    }
    pts.push(P(run[run.length - 1][0], run[run.length - 1][1], -FACE_T));
    const leds: { x: number; y: number }[] = [];
    let since = 0;
    for (let i = 1; i < pts.length; i++) {
      linePx(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], (x, y) => {
        both(x, y, PAL.ink);
        both(x, y + 1, PAL.ink);
        both(x, y - 1, PAL.night2);
        since++;
        if (since >= 7) {
          since = 0;
          leds.push({ x, y: y - 1 });
          both(x, y - 1, PAL.night3);
        }
      });
    }
    cableLeds.push(leds);
    // a small junction box with a status light at the cable's far end
    const end = pts[pts.length - 1];
    const ex = Math.round(end[0]);
    const ey = Math.round(end[1]);
    boxLights.push({ x: ex, y: ey - 2 });
    for (let j = 0; j < 3; j++) for (let i = 0; i < 5; i++) both(ex - 2 + i, ey - 3 + j, PAL.night1);
    for (let i = 0; i < 5; i++) both(ex - 2 + i, ey - 4, PAL.night3);
    // a yellow-black cable ramp across the first boundary line
    const mid = pts[Math.floor(pts.length * 0.42)];
    for (let i = -3; i <= 3; i++) both(Math.round(mid[0]) + i, Math.round(mid[1]), ((i + 9) >> 1) % 2 ? PAL.gold2 : PAL.ink);
  }

  // ---- marker lights along the boundary line's front sides
  const markers: PitchLayout['markers'] = [];
  const { c0, c1, r1 } = PITCH_LINES;
  for (let c = c0 + 0.5; c < c1; c += 0.5) {
    const [x, y] = P(c, r1, -FACE_T);
    markers.push({ x: Math.round(x), y: Math.round(y) - 1 });
  }
  for (let r = r1 - 0.5; r > PITCH_LINES.r0; r -= 0.5) {
    const [x, y] = P(c1, r, -FACE_T);
    markers.push({ x: Math.round(x), y: Math.round(y) - 1 });
  }
  for (const m of markers) {
    both(m.x - 1, m.y, PAL.ink);
    both(m.x + 1, m.y, PAL.ink);
    both(m.x, m.y, PAL.night3);
  }

  // ---- the camera dolly's rail along the P1 face (two rails on sleepers)
  const ra = P(-0.7, GR1 + 1.45, -FACE_T);
  const rb = P(1.55, GR1 + 1.45, -FACE_T);
  const rail = { a: [Math.round(ra[0]), Math.round(ra[1])] as [number, number], b: [Math.round(rb[0]), Math.round(rb[1])] as [number, number] };
  let n = 0;
  linePx(rail.a[0], rail.a[1], rail.b[0], rail.b[1], (x, y) => {
    if (n++ % 5 === 0) for (let k = -1; k <= 4; k++) both(x - 1, y + k, PAL.night0); // sleepers
    both(x, y, PAL.steel);
    both(x, y + 1, PAL.ink);
    both(x, y + 3, PAL.night4);
    both(x, y + 4, PAL.ink);
  });

  // ---- flight cases, a cable reel and a camera operator at the pitch side
  const stamp = (pc: PixelCanvas, x: number, y: number) => {
    for (let j = 0; j < pc.h; j++)
      for (let i = 0; i < pc.w; i++) {
        const c = pc.get(i, j);
        if (c !== null) both(x + i, y + j, c);
      }
  };
  const caseAt: [number, number, number][] = [
    [22, 286, 0],
    [36, 292, 1],
    [146, 302, 0],
    [470, 282, 2],
    [486, 287, 1],
    [610, 214, 0],
  ];
  const caseLeds: PitchLayout['caseLeds'] = [];
  for (const [x, y, v] of caseAt) {
    stamp(props.cases[v], x, y);
    if (v !== 2) caseLeds.push({ x: x + 11, y: y + 8, color: v === 0 ? PAL.leaf3 : PAL.gold3 });
  }
  stamp(props.reel, 112, 300);
  stamp(props.reel, 590, 232);
  const monitor = { x: 470 + 4, y: 282 + 1, w: 7, h: 2 };
  // a short cable from the open case to the cameraman
  linePx(486, 292, 548, 268, (x, y) => both(x, y, PAL.ink));
  return { boxLights, cableLeds, markers, rail, cameraman: { x: 556, y: 266 }, caseLeds, monitor };
}

/** World px of a point on the front edge of a stand's roof, `a` grid units out from the corner. */
export function roofPoint(stand: 0 | 1, a: number): [number, number] {
  return stand === 0 ? P(M_BACK, M_BACK + a, ROOF_Z()) : P(M_BACK + a, M_BACK, ROOF_Z());
}

/**
 * 1-bit LED strip of a text in the 'sm' font (rows 1..7 of the glyph cell: accents + caps).
 * `start[u]` is the first column of the glyph that column u belongs to (so a sheared LED wall
 * can keep every letter upright and step whole letters along the slope).
 */
export function ledText(text: string): { w: number; h: number; bits: Uint8Array; start: Int16Array } {
  const font = getFont('sm');
  const H = 7;
  const glyphs = [...text].map((ch) => font.glyphs.get(ch.charCodeAt(0)) ?? font.glyphs.get(32)!);
  const w = Math.max(1, glyphs.reduce((s, g) => s + g.w + 1, 0));
  const bits = new Uint8Array(w * H);
  const start = new Int16Array(w);
  let x = 0;
  for (const g of glyphs) {
    for (let j = 0; j < H; j++) for (let i = 0; i < g.w; i++) if (g.bits[(j + 1) * g.w + i]) bits[j * w + x + i] = 1;
    for (let i = 0; i <= g.w && x + i < w; i++) start[x + i] = x;
    x += g.w + 1;
  }
  return { w, h: H, bits, start };
}

// ---------------------------------------------------------------- floodlight towers

/**
 * The six floodlight towers (lattice masts on concrete footings, a catwalk and the lamp bank
 * housing on top), drawn into one STAD_RECT-sized canvas that sits IN FRONT of the crowd.
 */
export function drawTowers(): PixelCanvas {
  const R = STAD_RECT;
  const p = new PixelCanvas(R.w, R.h);
  const set = (x: number, y: number, c: Color) => p.set(x - R.x, y - R.y, c);
  for (const t of TOWERS) {
    const top = t.y + 7; // the mast meets the catwalk under the lamp bank
    const H = t.baseY - top;
    for (let y = top; y <= t.baseY; y++) {
      const k = (y - top) / H; // 0 top … 1 foot
      const half = Math.round(2 + k * 2); // tapering mast
      const xl = t.baseX - half;
      const xr = t.baseX + half;
      set(xl, y, PAL.steel); // lit rail (light from the upper left)
      set(xr, y, PAL.night3);
      // X bracing between the rails
      const seg = 7;
      const j = (y - top) % seg;
      const w = xr - xl;
      const bx1 = xl + Math.round((j / seg) * w);
      const bx2 = xr - Math.round((j / seg) * w);
      if (bx1 > xl && bx1 < xr) set(bx1, y, PAL.night4);
      if (bx2 > xl && bx2 < xr) set(bx2, y, PAL.night2);
      if (j === 0) for (let x = xl + 1; x < xr; x++) set(x, y, PAL.night3);
      // a ladder light every so often
      if ((y - top) % 23 === 11) set(xl - 1, y, PAL.crim2);
    }
    // concrete footing
    for (let y = t.baseY - 1; y <= t.baseY + 2; y++) for (let x = t.baseX - 6; x <= t.baseX + 6; x++) set(x, y, y === t.baseY - 1 ? PAL.stone2 : y === t.baseY + 2 ? PAL.ink : PAL.stone1);
    // catwalk + railing under the lamp bank
    for (let x = t.x - 11; x <= t.x + 11; x++) {
      set(x, t.y + 7, PAL.night3);
      set(x, t.y + 8, PAL.ink);
      if ((x - t.x) % 3 === 0) set(x, t.y + 6, PAL.night2);
    }
    // lamp bank housing (4×3 lamps), tilted slightly toward the platform
    const lean = t.side === 0 ? 1 : -1;
    for (let j = -6; j <= 6; j++)
      for (let i = -10; i <= 10; i++) {
        const x = t.x + i;
        const y = t.y + j + Math.round((i * lean) / 7);
        const edge = j === -6 || j === 6 || i === -10 || i === 10;
        set(x, y, edge ? PAL.ink : j < -4 ? PAL.night2 : PAL.night1);
      }
    for (const q of towerLamps(t)) set(q.x, q.y, PAL.night0);
  }
  return p;
}

/** Lamp cells of a tower's bank (world px), matching drawTowers (for the lit overlay). */
export function towerLamps(t: { x: number; y: number; side: 0 | 1 }): { x: number; y: number }[] {
  const lean = t.side === 0 ? 1 : -1;
  const out: { x: number; y: number }[] = [];
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < 4; i++) {
      const lx = t.x - 9 + i * 5;
      for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 2; dy++) out.push({ x: lx + dx, y: t.y - 4 + j * 4 + dy + Math.round(((lx + dx - t.x) * lean) / 7) });
    }
  return out;
}

