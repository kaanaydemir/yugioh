// Neon Tower painter: crowd — owner B1 (docs/v3/ARENA_NEON_TOWER.md §2 / §5 / §8).
// The spectator ATLAS: 8 looks × (10 shared + 2 × 5 team) frames of 12×13 px, pre-baked in code
// (pure PixelCanvas, no Math.random, no Phaser: runs in Node for tests). One texture, one grid:
//   row = look (0…7), column = frame id (CF_*), cell 12×13 (feet below the cell: the stands' railing hides
//   everything under row 12, seats.ts RAIL_H = 4 of the 16-px spectator cell).
// Spectators are drawn facing RIGHT (the left stand faces the platform that way; the right stand is the
// same art mirrored with Bob.flipX). Everything is darker than the platform: muted clothes, dark hair,
// skin tones from the lower half of the ramp; the only brighter pixels are the 2–3 px of a glow stick
// (team colour: blue on the left stand, crimson on the right).

import { PAL, RAMPS } from '../palette';
import { PixelCanvas } from '../pixel';

/** Texture key of the crowd atlas. */
export const NT_CROWD_KEY = 'nt:crowd';

/** Spectator frame size inside the atlas (the layer places it at feet.y − CROWD_CELL.h). */
export const CROWD_FW = 12;
export const CROWD_FH = 13;
export const CROWD_LOOKS = 8;

// ---- frame ids (columns of the atlas) ------------------------------------------------------------
/** Seated, breathing (shoulders 1 px up / down). */
export const CF_SIT0 = 0;
export const CF_SIT1 = 1;
/** Standing, small bounce. */
export const CF_STAND0 = 2;
export const CF_STAND1 = 3;
/** Clapping: hands together / apart. */
export const CF_CLAP0 = 4;
export const CF_CLAP1 = 5;
/** Gasp: hands to the cheeks (standing, frozen). */
export const CF_GASP = 6;
/** Both arms up, alternating (bare hands). */
export const CF_UP0 = 7;
export const CF_UP1 = 8;
/** Seated, leaning toward the platform. */
export const CF_LEAN = 9;
/** Team frames (stick in the raised hand): seated 3 sway frames, standing arms-up 2 frames. */
export const CF_STICK_SIT0 = 10; // …12
export const CF_STICK_UP0 = 13; // …14
/** Shared frames 0…9, then 5 frames per team (0 blue, 1 crimson). */
export const CROWD_SHARED = 10;
export const CROWD_TEAM = 5;
export const CROWD_COLS = CROWD_SHARED + 2 * CROWD_TEAM; // 20

/** Atlas column of a frame id for a team (0 blue / 1 red); shared ids ignore the team. */
export function crowdCol(id: number, team: 0 | 1): number {
  return id < CROWD_SHARED ? id : CROWD_SHARED + team * CROWD_TEAM + (id - CROWD_SHARED);
}

/** Frame name used in the Phaser texture: `<look>:<column>`. */
export function crowdFrameName(look: number, col: number): string {
  return `${look}:${col}`;
}

// ---- looks ------------------------------------------------------------------------------------------

type Hair = 'short' | 'long' | 'spiky' | 'bald' | 'cap';

interface Look {
  hair: Hair;
  /** hair / cap base + shade */
  h0: number;
  h1: number;
  /** skin base + shade */
  s0: number;
  s1: number;
  /** shirt base, shade, light edge */
  c0: number;
  c1: number;
  c2: number;
  /** trousers / lap */
  p: number;
}

const N = RAMPS.night;
const V = RAMPS.void;
const E = RAMPS.earth;
const G = RAMPS.gold;
const T = RAMPS.teal;
const K = RAMPS.skin;
const R = RAMPS.crim;
const C = RAMPS.cyan;

/** Eight distinct looks (hair style / hair colour / skin / clothes). Muted: darker than the platform. */
const LOOKS: readonly Look[] = [
  // 0 brown short hair, slate-blue jacket
  { hair: 'short', h0: E[1], h1: E[0], s0: K[2], s1: K[1], c0: N[3], c1: N[2], c2: N[4], p: N[1] },
  // 1 blonde long hair, dull crimson top
  { hair: 'long', h0: G[1], h1: G[0], s0: K[3], s1: K[2], c0: R[1], c1: R[0], c2: R[2], p: N[1] },
  // 2 violet spiky hair, dark violet hood
  { hair: 'spiky', h0: V[2], h1: V[1], s0: K[2], s1: K[1], c0: V[1], c1: V[0], c2: V[2], p: N[0] },
  // 3 black short hair, teal jacket
  { hair: 'short', h0: N[1], h1: PAL.ink, s0: K[1], s1: K[0], c0: T[1], c1: T[0], c2: T[2], p: N[1] },
  // 4 cap (slate), brown jacket
  { hair: 'cap', h0: N[2], h1: N[1], s0: K[1], s1: K[0], c0: E[1], c1: E[0], c2: E[2], p: N[0] },
  // 5 shaved head, violet top
  { hair: 'bald', h0: K[0], h1: K[0], s0: K[1], s1: K[0], c0: R[0], c1: PAL.ink, c2: R[1], p: N[1] },
  // 6 grey hair, steel-blue coat
  { hair: 'short', h0: N[4], h1: N[3], s0: K[3], s1: K[2], c0: N[2], c1: N[1], c2: N[3], p: N[0] },
  // 7 teal long hair, gold-brown top
  { hair: 'long', h0: C[1], h1: C[0], s0: K[2], s1: K[1], c0: G[0], c1: PAL.ink, c2: G[1], p: N[1] },
];

/** Glow stick colours per team: [body, tip]. Brightest pixels of the whole crowd. */
const STICK: readonly [number, number][] = [
  [C[2], C[3]],
  [R[2], R[3]],
];

// ---- poses ---------------------------------------------------------------------------------------------

type Arms = 'down' | 'clap0' | 'clap1' | 'up0' | 'up1' | 'gasp' | 'stick';

interface Pose {
  /** head top-left (the head is 6×5, hair spikes may rise 1 px above) */
  hx: number;
  hy: number;
  /** shoulder row */
  ty: number;
  /** torso left edge shift (leaning) */
  tx: number;
  arms: Arms;
  /** stick: 0 vertical, 1 leans right (toward the platform), 2 leans left, seated reach (half-raised) */
  stick?: 0 | 1 | 2;
  /** the stick hand is fully raised (standing cheer) instead of half raised (seated sway) */
  high?: boolean;
  /** standing: longer shirt before the trousers start */
  standing?: boolean;
}

function drawHead(p: PixelCanvas, L: Look, hx: number, hy: number, arms: Arms): void {
  const { s0, s1, h0, h1 } = L;
  // face block: 5 wide × 4 tall (x hx+1 … hx+5, y hy+1 … hy+4), chin one narrower
  p.rect(hx + 1, hy + 1, 5, 3, s0);
  p.rect(hx + 2, hy + 4, 3, 1, s1);
  p.set(hx + 1, hy + 4, s1);
  // far cheek shade + eye (one dark pixel near the front edge, brow row)
  p.set(hx + 1, hy + 2, s1);
  p.set(hx + 4, hy + 2, PAL.ink);
  p.set(hx + 5, hy + 2, s0);
  if (arms === 'gasp') p.set(hx + 4, hy + 4, PAL.ink); // open mouth
  switch (L.hair) {
    case 'short':
      p.rect(hx + 1, hy, 4, 1, h0);
      p.rect(hx, hy + 1, 6, 1, h0);
      p.set(hx, hy + 2, h1);
      p.set(hx, hy + 3, h1);
      p.set(hx + 5, hy + 1, h1);
      break;
    case 'long':
      p.rect(hx + 1, hy, 4, 1, h0);
      p.rect(hx, hy + 1, 6, 1, h0);
      p.rect(hx, hy + 2, 2, 4, h0);
      p.set(hx, hy + 5, h1);
      p.set(hx + 1, hy + 5, h1);
      p.set(hx + 5, hy + 1, h1);
      break;
    case 'spiky':
      p.rect(hx + 1, hy, 5, 1, h0);
      p.rect(hx, hy + 1, 6, 1, h0);
      p.set(hx + 1, hy - 1, h0);
      p.set(hx + 3, hy - 1, h0);
      p.set(hx + 5, hy - 1, h0);
      p.set(hx, hy + 2, h1);
      p.set(hx, hy + 3, h1);
      break;
    case 'bald':
      p.rect(hx + 1, hy, 4, 1, s0);
      p.rect(hx, hy + 1, 6, 1, s0);
      p.set(hx + 1, hy, s1);
      p.set(hx, hy + 2, s1);
      p.set(hx, hy + 3, s1);
      break;
    case 'cap':
      p.rect(hx + 1, hy, 4, 1, h0);
      p.rect(hx, hy + 1, 6, 1, h0);
      p.rect(hx + 6, hy + 1, 2, 1, h1); // brim toward the platform
      p.set(hx, hy + 2, h1);
      p.set(hx, hy + 3, h1);
      break;
  }
}

/** One spectator frame in a fresh 12×13 canvas. */
function drawSpectator(L: Look, pose: Pose, team: 0 | 1): PixelCanvas {
  const p = new PixelCanvas(CROWD_FW, CROWD_FH);
  const { hx, hy, ty, tx, arms } = pose;
  const bottom = CROWD_FH - 1;
  // torso: shoulders row (narrower), body, trousers / lap further down
  const x0 = 2 + tx;
  p.rect(x0 + 1, ty, 6, 1, L.c0);
  p.rect(x0, ty + 1, 8, bottom - ty, L.c0);
  p.rect(x0, ty + 1, 1, bottom - ty, L.c1); // far sleeve
  p.rect(x0 + 7, ty + 1, 1, bottom - ty, L.c1);
  p.set(x0 + 1, ty, L.c2); // shoulder glint (one px)
  const lap = ty + (pose.standing ? 5 : 4);
  if (lap <= bottom) p.rect(x0, lap, 8, bottom - lap + 1, L.p);
  // collar: skin under the chin
  p.set(hx + 3, ty, L.s1);
  p.set(hx + 4, ty, L.s1);
  drawHead(p, L, hx, hy, arms);
  const sleeve = L.c0;
  const hand = L.s0;
  switch (arms) {
    case 'down':
      break;
    case 'clap0':
      p.line(x0 + 1, ty + 1, 5, ty + 3, sleeve);
      p.line(x0 + 6, ty + 1, 6, ty + 3, sleeve);
      p.rect(5, ty + 2, 2, 2, hand);
      break;
    case 'clap1':
      p.set(x0 + 1, ty + 2, hand);
      p.set(x0 + 6, ty + 2, hand);
      p.vline(x0, ty + 1, ty + 2, sleeve);
      p.vline(x0 + 7, ty + 1, ty + 2, sleeve);
      break;
    case 'up0':
    case 'up1': {
      // left arm (far) at x 1, right arm (near the platform) at x 10; the alternate frame swaps heights
      const a = arms === 'up0' ? 5 : 3;
      const b = arms === 'up0' ? 3 : 5;
      p.vline(1, ty - a + 1, ty, sleeve);
      p.set(1, ty - a, hand);
      p.vline(10, ty - b + 1, ty, sleeve);
      p.set(10, ty - b, hand);
      p.set(2, ty, sleeve);
      p.set(9, ty, sleeve);
      break;
    }
    case 'gasp': {
      const hyc = hy + 3;
      p.vline(2, hyc + 1, ty + 1, sleeve);
      p.vline(9, hyc + 1, ty + 1, sleeve);
      p.rect(2, hyc - 1, 1, 2, hand);
      p.rect(9, hyc - 1, 1, 2, hand);
      break;
    }
    case 'stick': {
      const [body, tip] = STICK[team];
      const lean = pose.stick ?? 0;
      // the raised arm (toward the platform) + the free arm resting / waving
      if (pose.high) {
        // standing cheer: arm straight up on the right, free arm up on the left
        p.vline(10, ty - 3, ty, sleeve);
        p.set(10, ty - 4, hand);
        p.vline(1, ty - 2, ty, sleeve);
        p.set(1, ty - 3, hand);
        p.set(2, ty, sleeve);
        p.set(9, ty, sleeve);
        const base = ty - 5;
        if (lean === 0) {
          p.vline(10, base - 2, base, body);
          p.set(10, base - 3, tip);
        } else if (lean === 1) {
          p.set(10, base, body);
          p.set(11, base - 1, body);
          p.set(11, base - 2, body);
          p.set(11, base - 3, tip);
        } else {
          p.set(10, base, body);
          p.set(9, base - 1, body);
          p.set(9, base - 2, body);
          p.set(9, base - 3, tip);
        }
      } else {
        // seated sway: forearm half raised at the shoulder, stick above the fist
        p.vline(10, ty - 2, ty, sleeve);
        p.set(10, ty - 3, hand);
        const base = ty - 4;
        if (lean === 0) {
          p.vline(10, base - 2, base, body);
          p.set(10, base - 3, tip);
        } else if (lean === 1) {
          p.set(10, base, body);
          p.set(11, base - 1, body);
          p.set(11, base - 2, body);
          p.set(11, base - 3, tip);
        } else {
          p.set(10, base, body);
          p.set(9, base - 1, body);
          p.set(9, base - 2, body);
          p.set(9, base - 3, tip);
        }
        p.set(9, ty, sleeve);
      }
      break;
    }
  }
  return p;
}

// pose tables: heights chosen so a standing head tops out at row 1, a seated one at row 4
const SIT_Y = { hy: 4, ty: 9 };
const STAND_Y = { hy: 1, ty: 6 };

function poseOf(id: number): Pose {
  switch (id) {
    case CF_SIT0:
      return { hx: 3, tx: 0, arms: 'down', ...SIT_Y };
    case CF_SIT1:
      return { hx: 3, tx: 0, arms: 'down', hy: 3, ty: 8 };
    case CF_STAND0:
      return { hx: 3, tx: 0, arms: 'down', standing: true, ...STAND_Y };
    case CF_STAND1:
      return { hx: 3, tx: 0, arms: 'down', standing: true, hy: 2, ty: 7 };
    case CF_CLAP0:
      return { hx: 3, tx: 0, arms: 'clap0', standing: true, hy: 2, ty: 7 };
    case CF_CLAP1:
      return { hx: 3, tx: 0, arms: 'clap1', standing: true, hy: 1, ty: 6 };
    case CF_GASP:
      return { hx: 3, tx: 0, arms: 'gasp', standing: true, hy: 2, ty: 7 };
    case CF_UP0:
      return { hx: 3, tx: 0, arms: 'up0', standing: true, hy: 4, ty: 9 };
    case CF_UP1:
      return { hx: 3, tx: 0, arms: 'up1', standing: true, hy: 3, ty: 8 };
    case CF_LEAN:
      return { hx: 4, tx: 1, arms: 'down', hy: 5, ty: 9 };
    default: {
      // team frames
      const k = id - CROWD_SHARED;
      if (k < 3) return { hx: 3, tx: 0, arms: 'stick', stick: ([0, 1, 2] as const)[k], hy: 4, ty: 9 };
      return { hx: 3, tx: 0, arms: 'stick', stick: ([0, 1] as const)[k - 3], high: true, standing: true, hy: 4, ty: 9 };
    }
  }
}

export interface CrowdAtlas {
  canvas: PixelCanvas;
  /** frame name → rect (cells of the grid) */
  frames: Record<string, { x: number; y: number; w: number; h: number }>;
}

/** The whole atlas: CROWD_COLS × CROWD_LOOKS cells. */
export function paintCrowdAtlas(): CrowdAtlas {
  const canvas = new PixelCanvas(CROWD_COLS * CROWD_FW, CROWD_LOOKS * CROWD_FH);
  const frames: CrowdAtlas['frames'] = {};
  for (let look = 0; look < CROWD_LOOKS; look++) {
    for (let col = 0; col < CROWD_COLS; col++) {
      const id = col < CROWD_SHARED ? col : CROWD_SHARED + ((col - CROWD_SHARED) % CROWD_TEAM);
      const team = (col < CROWD_SHARED ? 0 : Math.floor((col - CROWD_SHARED) / CROWD_TEAM)) as 0 | 1;
      canvas.blit(drawSpectator(LOOKS[look], poseOf(id), team), col * CROWD_FW, look * CROWD_FH);
      frames[crowdFrameName(look, col)] = { x: col * CROWD_FW, y: look * CROWD_FH, w: CROWD_FW, h: CROWD_FH };
    }
  }
  return { canvas, frames };
}

let cached: CrowdAtlas | null = null;
/** The atlas, painted once. */
export function crowdAtlas(): CrowdAtlas {
  return (cached ??= paintCrowdAtlas());
}

/** Painter used by the boot step and the layer's fallback (texture = the atlas canvas). */
export function paintCrowd(): PixelCanvas {
  return crowdAtlas().canvas;
}
