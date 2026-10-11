// Arena v2 stadium art: the stadium floor around the platform and the two iso stands behind it.
//
// The stands are a "square bowl": the stand height is a step function of m = min(c, r) — tiers
// rise going away from the field along both back sides and meet in a mitred corner behind the
// board's top corner. Each pixel is ray-cast against that heightfield (exact, crisp), so risers,
// treads, the front wall, the back wall and the roof all line up with the 2:1 projection.
//
// The crowd is drawn in CROWD_FRAMES frames (bobbing, cheering, arms up) over the static layer;
// flags, banners, phone lights and the LED boards are separate (animated at runtime).

import type { PlayerId } from '../../engine/types';
import { getFont } from '../font';
import { PAL } from '../palette';
import { type Color, PixelCanvas, mulberry32 } from '../pixel';
import { FACE_T, GC0, GC1, GR0, GR1, HH, HW, P, STAD_RECT, STAND, STAND_C, STAND_FAR, TOWERS, gridAt, tierC, tierZ } from './geom';
import { bayer, clamp01, coarseNoise, linePx } from './util';

export const CROWD_FRAMES = 8;
const N = STAND.tiers;
const D = STAND.depth;
const ROOF_Z = (): number => tierZ(N - 1) + STAND.back;
/** Grid "m" of the back wall (behind the last tread). */
const M_BACK = STAND_C - N * D;
const ROOF_DEPTH = 0.35;

type HitKind = 'floor' | 'wall' | 'riser' | 'tread' | 'back' | 'roof' | 'sky';
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
  // front wall
  let z = zAt(STAND_C);
  if (z <= tierZ(0)) return { kind: 'wall', k: 0, m: STAND_C, z, u };
  for (let k = 0; k < N; k++) {
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

/** Fan color share: the left stand (P1's flank) leans cyan, the right stand (behind P2) crimson. */
function fanSide(u: number, rnd: () => number): PlayerId {
  const pLeft = clamp01(0.5 - u * 0.09);
  return rnd() < pLeft ? 0 : 1;
}

export interface StandsArt {
  base: PixelCanvas;
  crowd: PixelCanvas[];
  /** Spots where a flag pole rises (world px of the pole foot) + fan side. */
  flags: { x: number; y: number; side: PlayerId; design: number; phase: number; row: number }[];
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
}

// ---------------------------------------------------------------- floor

function floorColor(c: number, r: number, x: number, y: number, n: number): Color {
  // big iso checker (2×2 tiles) of a dark rubber floor, a little noise
  const cc = Math.floor((c + 0.5) / 2);
  const rr = Math.floor((r + 0.5) / 2);
  let v = (cc + rr) & 1 ? 1.15 : 0.85;
  v += (n - 0.5) * 0.5;
  let col: Color = v > 1.1 ? (bayer(x, y) < 5 ? PAL.night2 : PAL.night1) : v > 0.75 ? PAL.night1 : bayer(x, y) < 8 ? PAL.night1 : PAL.night0;
  // painted lines: a boundary rectangle around the platform and a center line across
  const L0c = GC0 - 0.55;
  const L1c = GC1 + 0.55;
  const L0r = GR0 - 0.55;
  const L1r = GR1 + 0.55;
  const onLine = (a: number, b: number) => Math.abs(a - b) * 2 * HH < 0.9;
  const inR = r > L0r - 0.02 && r < L1r + 0.02;
  const inC = c > L0c - 0.02 && c < L1c + 0.02;
  if ((inR && (onLine(c, L0c) || onLine(c, L1c))) || (inC && (onLine(r, L0r) || onLine(r, L1r)))) col = bayer(x, y) < 13 ? PAL.steel : PAL.night3;
  // a second, dashed line further out
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
    if (Math.abs(d - 0.45) * 2 * HH < 0.9 && (c - ac) * (ac === L0c ? 1 : -1) > 0 && (r - ar) * (ar === L0r ? 1 : -1) > 0) col = PAL.steel;
  }
  return col;
}

// ---------------------------------------------------------------- people

const SKIN = [PAL.skin1, PAL.skin2, PAL.skin2, PAL.skin3, PAL.skin1, PAL.skin3, PAL.skin0];
const HAIR = [PAL.ink, PAL.earth1, PAL.earth0, PAL.gold2, PAL.stone1, PAL.ink, PAL.earth2, PAL.night1];
/** Muted night clothes (most of the crowd): [lit top row, body]. */
const MUTED: [Color, Color][] = [
  [PAL.night3, PAL.night2],
  [PAL.night2, PAL.night1],
  [PAL.stone2, PAL.stone1],
  [PAL.stone3, PAL.stone2],
  [PAL.earth1, PAL.earth0],
  [PAL.void1, PAL.void0],
  [PAL.night4, PAL.night3],
  [PAL.water1, PAL.water0],
];
const ACCENT: [Color, Color][] = [
  [PAL.white, PAL.mist],
  [PAL.gold3, PAL.gold2],
  [PAL.mist, PAL.steel],
];
const FAN_SHIRTS: Record<PlayerId, [Color, Color][]> = {
  0: [
    [PAL.cyan3, PAL.cyan2],
    [PAL.cyan2, PAL.cyan1],
    [PAL.cyan4, PAL.cyan3],
  ],
  1: [
    [PAL.crim3, PAL.crim2],
    [PAL.crim2, PAL.crim1],
    [PAL.crim4, PAL.crim3],
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
  skin: Color;
  hair: Color | null;
  shirt: [Color, Color];
  headLeft: boolean;
  /** behaviour: 0 calm, 1 bobber, 2 cheerer (arms up), 3 clapper, 4 waver (one arm) */
  kind: number;
  phase: number;
  cap: Color | null;
  side: PlayerId;
}

function drawPerson(p: PixelCanvas, q: Person, f: number, ox: number, oy: number): void {
  const ph = (f + q.phase) % CROWD_FRAMES;
  let lift = 0;
  let arms: 'none' | 'up' | 'left' | 'clap' | 'right' = 'none';
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
  const x = q.x - ox;
  const y = q.y - oy - lift;
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
  p.set(hx, y - 4, q.skin).set(hx + 1, y - 4, q.hair && !q.cap ? q.skin : q.skin);
  // arms
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
}

// ---------------------------------------------------------------- build

export function buildStands(): StandsArt {
  const R = STAD_RECT;
  const base = new PixelCanvas(R.w, R.h);
  const rnd = mulberry32(4242);
  const n = coarseNoise(R.w, R.h, 16, 12, 9, 3);
  const roofLights: StandsArt['roofLights'] = [];

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
      switch (h.kind) {
        case 'floor': {
          col = floorColor(c, r, wx, wy, n[y * R.w + x]);
          // a gutter + shadow strip along the stand walls
          const toWall = (Math.min(c, r) - STAND_C) * 2 * HH;
          if (toWall < 2) col = PAL.ink;
          else if (toWall < 5) col = bayer(wx, wy) < 10 ? PAL.night0 : PAL.ink;
          break;
        }
        case 'wall': {
          const k = Math.round(tierZ(0) - h.z); // 0 = top of the wall
          if (k <= 0) col = PAL.night4;
          else if (k === 1) col = PAL.night2;
          else if (k >= STAND.wall - 1) col = PAL.ink;
          else col = (Math.floor(a * 10) & 1) === 0 && k > 9 ? PAL.night1 : PAL.night0;
          break;
        }
        case 'riser': {
          // risers: vertical concrete faces; the right stand's face the light (upper left)
          col = leftStand ? PAL.night1 : PAL.night2;
          if (Math.round(tierZ(h.k) - h.z) === 0) col = leftStand ? PAL.night2 : PAL.night3; // lit nosing
          break;
        }
        case 'tread': {
          col = leftStand ? PAL.night2 : PAL.night3;
          // seat backs (rows of colored seats; the crowd covers most of them)
          const s = (a * 13.33) % 1;
          if (s < 0.6) {
            const side = fanSide(h.u, mulberry32(Math.floor(a * 13.33) * 97 + h.k * 13));
            col = side === 0 ? (leftStand ? PAL.cyan1 : PAL.cyan2) : leftStand ? PAL.crim1 : PAL.crim2;
          }
          // aisles every few metres
          if (Math.abs(((a + 0.3) % 1.6) - 0.8) < 0.04) col = leftStand ? PAL.night3 : PAL.night4;
          break;
        }
        case 'back': {
          const k = Math.round(ROOF_Z() - h.z);
          col = k <= 0 ? PAL.night3 : PAL.night0;
          // private boxes: lit windows along the back wall
          if (k >= 2 && k <= 4 && Math.floor(a * 6) % 3 !== 0 && ((a * 6) % 1) > 0.18) col = k === 2 ? PAL.gold1 : bayer(wx, wy) < 8 ? PAL.gold0 : PAL.night1;
          break;
        }
        case 'roof': {
          const dm = (M_BACK - h.m) * 2 * HH; // px back from the roof edge
          col = dm < 1 ? PAL.night4 : dm < 2 ? PAL.night1 : bayer(wx, wy) < 3 ? PAL.night1 : PAL.ink;
          // trusses
          if (Math.abs(((a * 2.5) % 1) - 0.5) < 0.04) col = PAL.night1;
          break;
        }
        default:
          col = PAL.ink;
      }
      base.set(x, y, col);
    }

  // ---- roof edge lamps (small spots, blinking at runtime)
  for (const stand of [0, 1] as const) {
    for (let a = 0.4; a < STAND_FAR; a += 0.55) {
      const [x, y] = stand === 0 ? P(M_BACK, M_BACK + a, ROOF_Z()) : P(M_BACK + a, M_BACK, ROOF_Z());
      const px = Math.round(x);
      const py = Math.round(y) - 1;
      if (px < R.x || px >= R.x + R.w) continue;
      base.set(px - R.x, py - R.y, PAL.night3);
      roofLights.push({ x: px, y: py });
    }
  }

  // ---- crowd: people on every tread, drawn back to front
  const people: Person[] = [];
  const flags: StandsArt['flags'] = [];
  const phones: StandsArt['phones'] = [];
  const pr = mulberry32(777);
  for (let k = N - 1; k >= 0; k--) {
    const mMid = tierC(k) - D / 2;
    for (const stand of [0, 1] as const) {
      for (let a = 0.04 + (k % 2) * 0.035; a < STAND_FAR; a += 0.075) {
        if (pr() < 0.07) continue; // an empty seat
        const [fx, fy] = stand === 0 ? P(mMid, mMid + a, tierZ(k)) : P(mMid + a, mMid, tierZ(k));
        const x = Math.round(fx + (pr() - 0.5) * 0.8);
        const y = Math.round(fy);
        if (x < R.x + 4 || x > R.x + R.w - 4) continue;
        // fan sections: P1's fans fill the left stand's far end, P2's the right stand; the
        // sections near the back corner are mixed
        const section = Math.floor(a / 1.15);
        const secSide: PlayerId | null = a < 1.6 ? null : stand === 0 ? (section % 4 === 3 ? 1 : 0) : section % 5 === 4 ? 0 : 1;
        const side: PlayerId = secSide ?? (pr() < 0.5 ? 0 : 1);
        const roll = pr();
        const fanShare = secSide === null ? 0.25 : 0.5;
        const shirt = roll < fanShare ? FAN_SHIRTS[side][Math.floor(pr() * 3)] : roll < fanShare + 0.08 ? ACCENT[Math.floor(pr() * ACCENT.length)] : MUTED[Math.floor(pr() * MUTED.length)];
        // back rows sit deeper in the roof's shadow
        const depth = k >= 5 ? 2 : k >= 3 ? 1 : 0;
        const kindRoll = pr();
        const q: Person = {
          x,
          y,
          row: k,
          skin: dk(SKIN[Math.floor(pr() * SKIN.length)], depth > 1 ? 1 : 0),
          hair: pr() < 0.7 ? HAIR[Math.floor(pr() * HAIR.length)] : null,
          shirt: [dk(shirt[0], depth), dk(shirt[1], depth)],
          headLeft: pr() < 0.5,
          kind: kindRoll < 0.34 ? 0 : kindRoll < 0.62 ? 1 : kindRoll < 0.76 ? 2 : kindRoll < 0.9 ? 3 : 4,
          phase: Math.floor(pr() * CROWD_FRAMES),
          cap: pr() < 0.1 ? dk(side === 0 ? PAL.cyan2 : PAL.crim2, depth) : null,
          side,
        };
        people.push(q);
        if (pr() < (secSide === null ? 0.01 : 0.026) && k >= 1) flags.push({ x: x + (pr() < 0.5 ? -2 : 2), y: y - 4, side, design: Math.floor(pr() * 3), phase: Math.floor(pr() * 8), row: k });
        if (pr() < 0.05) phones.push({ x: x + (pr() < 0.5 ? -2 : 2), y: y - 6, side });
      }
    }
  }
  // crowd frames: same canvas size as the base (cropped by the caller to the union bounds)
  const crowd: PixelCanvas[] = [];
  for (let f = 0; f < CROWD_FRAMES; f++) {
    const p = new PixelCanvas(R.w, R.h);
    for (const q of people) drawPerson(p, q, f, R.x, R.y);
    crowd.push(p);
  }

  // ---- banners over the front wall railing and LED boards along the wall
  const banners: StandsArt['banners'] = [];
  const boards: LedBoard[] = [];
  const wallTop = tierZ(0);
  const ledRows = 7;
  const mkBoard = (stand: 0 | 1, a0: number, a1: number) => {
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
      cols.push({ x, y: Math.round(yTop) + 3, u: x - x0 });
    }
    const ys = cols.map((q) => q.y);
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys) + ledRows;
    boards.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, cols, rows: ledRows, stand });
  };
  mkBoard(0, 0.5, 2.6);
  mkBoard(0, 3.0, 5.4);
  mkBoard(0, 5.8, 9.5);
  mkBoard(1, 0.5, 2.7);
  mkBoard(1, 3.1, 5.6);
  mkBoard(1, 6.0, 10.0);
  // banners hang in the gaps between boards (plus one per stand over a board's end)
  const bannerAt = (stand: 0 | 1, a: number, side: PlayerId, design: number) => {
    const [x, y] = stand === 0 ? P(STAND_C, STAND_C + a, wallTop + 2) : P(STAND_C + a, STAND_C, wallTop + 2);
    banners.push({ x: Math.round(x), y: Math.round(y), len: 22, stand, side, design });
  };
  bannerAt(0, 2.9, 0, 0);
  bannerAt(0, 5.7, 0, 1);
  bannerAt(1, 3.0, 1, 0);
  bannerAt(1, 5.9, 1, 1);

  // the follow-spot path over each stand (mid-height of the tiers)
  const kMid = Math.floor(N / 2);
  const mm = tierC(kMid) - D / 2;
  const crowdSpan: StandsArt['crowdSpan'] = [
    { a: P(mm, mm + 0.5, tierZ(kMid)), b: P(mm, mm + 8, tierZ(kMid)) },
    { a: P(mm + 0.5, mm, tierZ(kMid)), b: P(mm + 8, mm, tierZ(kMid)) },
  ];

  // ---- contact shadow of the platform on the floor (dark band hugging the front faces)
  for (let y = 0; y < R.h; y++)
    for (let x = 0; x < R.w; x++) {
      const wx = x + R.x;
      const wy = y + R.y;
      const g = gridAt(wx + 0.5, wy + 0.5, -FACE_T);
      const inX = g.c > GC0 && g.c < GC1 + 0.18 && g.r > GR0 && g.r < GR1 + 0.18;
      if (!inX) continue;
      const out = Math.max(g.c - GC1, g.r - GR1); // grid units outside the front faces
      if (out > 0 && out < 0.18 && base.alpha(x, y) > 0) {
        const lv = out < 0.06 ? 16 : out < 0.12 ? 9 : 4;
        if (bayer(wx, wy) < lv) base.set(x, y, out < 0.06 ? PAL.ink : PAL.night0);
      }
    }
  return { base, crowd, flags, phones, banners, boards, roofLights, crowdSpan };
}

// ---------------------------------------------------------------- cables on the floor

/** Cable runs on the floor (grid polylines at floor level) drawn into the stadium base. */
export function drawCables(base: PixelCanvas): { x: number; y: number }[] {
  const R = STAD_RECT;
  const lights: { x: number; y: number }[] = [];
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
    for (let i = 1; i < pts.length; i++) {
      linePx(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], (x, y) => {
        base.set(x - R.x, y - R.y, PAL.ink);
        base.set(x - R.x, y + 1 - R.y, PAL.ink);
        base.set(x - R.x, y - 1 - R.y, bayer(x, y) < 10 ? PAL.night3 : PAL.night2);
      });
    }
    // a small junction box light at the cable's far end
    const end = pts[pts.length - 1];
    lights.push({ x: Math.round(end[0]), y: Math.round(end[1]) - 2 });
    base.rect(Math.round(end[0]) - 2 - R.x, Math.round(end[1]) - 3 - R.y, 5, 3, PAL.night1);
    base.rect(Math.round(end[0]) - 2 - R.x, Math.round(end[1]) - 4 - R.y, 5, 1, PAL.night3);
    // a yellow-black cable ramp across the first boundary line
    const mid = pts[Math.floor(pts.length * 0.42)];
    for (let i = -3; i <= 3; i++) base.set(Math.round(mid[0]) + i - R.x, Math.round(mid[1]) - R.y, ((i + 9) >> 1) % 2 ? PAL.gold2 : PAL.ink);
  }
  return lights;
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
      if ((y - top) % 23 === 11) set(xl - 1, y, PAL.crim3);
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
