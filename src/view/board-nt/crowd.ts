// Neon Tower layer: CROWD (spectators) — owner B1 (docs/v3/ARENA_NEON_TOWER.md §6, §7, §8).
// ~110 spectators (9 looks; seated / standing / clapping / waving / arms up / head turned / glow stick, mirrored for the right stand)
// as Blitter bobs on ONE pre-baked atlas (src/art/arena-nt/crowd.ts): three blitters (one per stand row, at
// seatDepth(row) of seats.ts, i.e. between the rows' railings), one texture, zero per-spectator tweens or timers.
//
// Animation = pure function of the scene clock, evaluated at 8 Hz:
//   - every seat has its own group (4 groups with different breath / stick periods), its own phase offset and its
//     own mode (seated breathing, seated glow-stick sway, standing bounce, clapping). Frames only change when the
//     seat's own step turns, so no two spectators move together;
//   - a slow "mood" clock (every 700 ms) makes one seat stand up / start clapping for a few seconds, then sit down;
//   - REACTIONS (cheer / gasp / roar / lean per side, power 0.5…2) override the idle frames for a short time and
//     decay back: each seat joins after its own 0…220 ms delay and leaves after 0…300 ms (a ripple, not a switch),
//     a settle frame (standing) before sitting down. Victory (gameOver) is sticky.
// Nothing is allocated per frame (typed arrays, a frame-lookup table), nothing runs while nothing changes (the
// tick returns at once unless the 8 Hz step turned, or a reaction is active: then at ~20 Hz).
// Depth: above the stands' steps, below the platform; the railings of A2 cover the lowest 4 px of each cell.

import Phaser from 'phaser';
import type { GameEvent, PlayerId } from '../../engine/types';
import {
  CF_CLAP0,
  CF_GASP,
  CF_LEAN,
  CF_SIT0,
  CF_SIT1,
  CF_STAND0,
  CF_STAND1,
  CF_STICK_SIT0,
  CF_STICK_UP0,
  CF_TURN,
  CF_UP0,
  CF_WAVE0,
  CROWD_COLS,
  CROWD_LOOKS,
  NT_CROWD_KEY,
  crowdAtlas,
  crowdCol,
  crowdFrameName,
} from '../../art/arena-nt/crowd';
import type { CrowdReaction } from './api';
import { CROWD_CELL } from './layout-nt';
import { type NtCtx, type NtLayer } from './layer';
import { SEATS } from './seats';
import { ensureNtTexture } from './textures';

/** Register the crowd atlas and its frames once (boot step 26 and, as a fallback, the layer). */
export function ensureCrowdTextures(scene: Phaser.Scene): void {
  ensureNtTexture(scene, 'crowd', NT_CROWD_KEY, () => crowdAtlas().canvas);
  const tex = scene.textures.get(NT_CROWD_KEY);
  for (const [name, r] of Object.entries(crowdAtlas().frames)) if (!tex.has(name)) tex.add(name, 0, r.x, r.y, r.w, r.h);
}

// ---- constants ---------------------------------------------------------------------------------------------

/** Idle quantum (ms): the 8 Hz clock every idle loop counts in. */
const Q = 125;
/** Reaction quantum (ms): reaction frames are re-evaluated at ~20 Hz while one is active. */
const QR = 50;
/** The mood clock: one seat may change its idle mode every MOOD ms. */
const MOOD = 520;
const MAX_TEMP = 10;
/** Per-group periods in quanta: breath half period, glow-stick hold. */
const GROUP_BREATH = [13, 15, 17, 19] as const;
const GROUP_STICK = [3, 4, 3, 5] as const;
/** Glow-stick sway order: vertical, right, vertical, left. */
const STICK_SEQ = [0, 1, 0, 2] as const;
const SETTLE = 240;

// idle modes
const M_SIT = 0;
const M_STICK = 1;
const M_STAND = 2;
const M_CLAP = 3;
const M_WAVE = 4;
const M_TURN = 5;
const M_LEAN = 6;

// reaction kinds (0 = none)
const R_CHEER = 1;
const R_GASP = 2;
const R_ROAR = 3;
const R_LEAN = 4;

const SEAT_N = SEATS.length;

function mix(a: number, b: number): number {
  let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function kindOf(k: CrowdReaction | 'lean'): number {
  return k === 'cheer' ? R_CHEER : k === 'gasp' ? R_GASP : k === 'roar' ? R_ROAR : R_LEAN;
}

/** Duration of a reaction (ms) by kind and power. */
function durationOf(k: number, p: number): number {
  switch (k) {
    case R_CHEER:
      return 560 + 340 * Math.min(p, 1.3);
    case R_ROAR:
      return 900 + 600 * p;
    case R_GASP:
      return 520 + 300 * Math.min(p, 1.5);
    default:
      return 450 + 200 * p;
  }
}

/** Share of the seats that join a reaction (the rest keep their idle loop). */
function shareOf(k: number, p: number): number {
  switch (k) {
    case R_CHEER:
      return Math.min(0.97, 0.6 + 0.3 * p);
    case R_ROAR:
      return Math.min(1, 0.8 + 0.1 * p);
    case R_GASP:
      return Math.min(1, 0.7 + 0.3 * p);
    default:
      return 0.6;
  }
}

const PRIO = [0, 2, 2, 3, 1] as const;

export interface CrowdDebug {
  react(kind: CrowdReaction, side: PlayerId | null, power?: number): void;
  readonly seats: number;
  /** ms spent in the layer's tick since creation, and the number of ticks that did work. */
  readonly stats: { ms: number; ticks: number; work: number };
}

export function createCrowdLayer(ctx: NtCtx): NtLayer {
  const scene = ctx.scene;
  ensureCrowdTextures(scene);
  const tex = scene.textures.get(NT_CROWD_KEY);

  // ---- frame table: [look * CROWD_COLS + col] → Frame
  const frames: Phaser.Textures.Frame[] = new Array(CROWD_LOOKS * CROWD_COLS);
  for (let l = 0; l < CROWD_LOOKS; l++) for (let c = 0; c < CROWD_COLS; c++) frames[l * CROWD_COLS + c] = tex.get(crowdFrameName(l, c));

  // ---- per-seat state (typed arrays: no allocation after this point)
  const look = new Uint8Array(SEAT_N);
  const team = new Uint8Array(SEAT_N);
  const holder = new Uint8Array(SEAT_N);
  const baseMode = new Uint8Array(SEAT_N);
  const mode = new Uint8Array(SEAT_N);
  const grp = new Uint8Array(SEAT_N);
  const off = new Uint16Array(SEAT_N);
  const cur = new Int16Array(SEAT_N).fill(-1);
  const dly = new Float32Array(SEAT_N);
  const rel = new Float32Array(SEAT_N);
  const part = new Float32Array(SEAT_N);
  const bare = new Uint8Array(SEAT_N);
  const tempEnd = new Int32Array(SEAT_N).fill(-1);
  const bobs: Phaser.GameObjects.Bob[] = new Array(SEAT_N);
  const sideOf = new Uint8Array(SEAT_N);

  const rowBlitters: Phaser.GameObjects.Blitter[] = [];
  const rowsUsed = Math.max(...SEATS.map((s) => s.row)) + 1;
  for (let r = 0; r < rowsUsed; r++) {
    const row = SEATS.find((s) => s.row === r);
    if (!row) continue;
    rowBlitters[r] = ctx.add(scene.add.blitter(0, 0, NT_CROWD_KEY).setDepth(row.depth));
  }

  for (let i = 0; i < SEAT_N; i++) {
    const s = SEATS[i];
    sideOf[i] = s.side;
    team[i] = s.team;
    // looks: a seeded shuffle that avoids neighbours repeating (id-based hash, no Math.random)
    look[i] = Math.floor(mix(s.id, 11) * CROWD_LOOKS) % CROWD_LOOKS;
    if (i > 0 && look[i] === look[i - 1]) look[i] = (look[i] + 1 + Math.floor(mix(s.id, 12) * 6)) % CROWD_LOOKS;
    holder[i] = mix(s.id, 21) < 0.4 ? 1 : 0;
    baseMode[i] = holder[i] ? M_STICK : M_SIT;
    mode[i] = baseMode[i];
    grp[i] = Math.floor(mix(s.id, 31) * 4) & 3;
    off[i] = Math.floor(mix(s.id, 41) * 400);
    dly[i] = mix(s.id, 51) * 220;
    rel[i] = mix(s.id, 61) * 300;
    part[i] = mix(s.id, 71);
    bare[i] = mix(s.id, 81) < 0.3 ? 1 : 0;
    const col = crowdCol(CF_SIT0, 0);
    const bob = rowBlitters[s.row].create(s.x - CROWD_CELL.w / 2, s.y - CROWD_CELL.h, frames[look[i] * CROWD_COLS + col]);
    bob.flipX = s.flipX;
    bobs[i] = bob;
    cur[i] = col;
  }

  // ---- reaction state per side
  const rxKind = new Uint8Array(2);
  const rxT0 = new Float64Array(2);
  const rxUntil = new Float64Array(2);
  const rxThr = new Float32Array(2);
  const rxSticky = new Uint8Array(2);
  let rxActive = 0;

  let now = 0;
  let lastQ = -1;
  let lastQr = -1;
  let lastMood = -1;
  let tempCount = 0;
  let destroyed = false;
  // lights: the crowd steps up out of the dark with the stands (calm ignition: ~260 ms after the call)
  let litOn = true;
  let litFrom = -1;
  let litStep = 3;
  const stats = { ms: 0, ticks: 0, work: 0 };

  function applyLit(step: number): void {
    litStep = step;
    for (const b of rowBlitters) {
      if (!b) continue;
      b.setVisible(step > 0);
      b.setAlpha(step >= 2 ? 1 : 0.5);
    }
  }

  function idleCol(i: number, q: number): number {
    const o = q + off[i];
    const g = grp[i];
    switch (mode[i]) {
      case M_STICK:
        return crowdCol(CF_STICK_SIT0 + STICK_SEQ[Math.floor(o / GROUP_STICK[g]) & 3], team[i] as 0 | 1);
      case M_STAND:
        return crowdCol(Math.floor(o / 6) & 1 ? CF_STAND1 : CF_STAND0, 0);
      case M_CLAP:
        return crowdCol(CF_CLAP0 + ((o >> 1) & 1), 0);
      case M_WAVE:
        return crowdCol(CF_WAVE0 + ((o >> 1) & 1), 0);
      case M_TURN:
        return crowdCol(CF_TURN, 0);
      case M_LEAN:
        return crowdCol(CF_LEAN, 0);
      default:
        return crowdCol(Math.floor(o / GROUP_BREATH[g]) & 1 ? CF_SIT1 : CF_SIT0, 0);
    }
  }

  /** The reaction frame of seat i at time t, or -1 when the seat shows its idle frame. */
  function rxCol(i: number, t: number): number {
    const side = sideOf[i];
    const k = rxKind[side];
    if (k === 0) return -1;
    const start = rxT0[side] + dly[i];
    if (t < start || part[i] >= rxThr[side]) return -1;
    const end = rxUntil[side] + rel[i];
    if (t < end) {
      switch (k) {
        case R_GASP:
          return crowdCol(CF_GASP, 0);
        case R_LEAN:
          return crowdCol(CF_LEAN, 0);
        default: {
          const s = Math.floor((t + off[i] * 31) / (k === R_ROAR ? 100 : 140)) & 1;
          if (holder[i]) return crowdCol(CF_STICK_UP0 + s, team[i] as 0 | 1);
          if (k === R_ROAR || !bare[i]) return crowdCol(CF_UP0 + s, 0);
          return crowdCol(CF_CLAP0 + s, 0);
        }
      }
    }
    if (t < end + SETTLE && (k === R_CHEER || k === R_ROAR)) return crowdCol(CF_STAND0, 0);
    return -1;
  }

  function refresh(t: number, q: number): void {
    for (let i = 0; i < SEAT_N; i++) {
      let col = rxActive ? rxCol(i, t) : -1;
      if (col < 0) col = idleCol(i, q);
      if (col !== cur[i]) {
        cur[i] = col;
        bobs[i].setFrame(frames[look[i] * CROWD_COLS + col]);
      }
    }
  }

  function moodStep(step: number): void {
    // sit down the ones whose time is up
    for (let i = 0; i < SEAT_N; i++) {
      if (tempEnd[i] >= 0 && step >= tempEnd[i]) {
        tempEnd[i] = -1;
        mode[i] = baseMode[i];
        tempCount--;
      }
    }
    // a new one stands up / claps for 3…8 steps
    const h = mix(step, 91);
    const h2 = mix(step, 92);
    if (tempCount < MAX_TEMP && h < 0.9) {
      const i = Math.floor(mix(step, 93) * SEAT_N) % SEAT_N;
      if (tempEnd[i] < 0) {
        // clap / wave / stand up / turn to the neighbour / lean in: seated stick holders only wave their stick
        mode[i] = h2 < 0.25 ? M_CLAP : h2 < 0.45 ? M_STAND : h2 < 0.65 ? M_WAVE : h2 < 0.85 ? M_TURN : M_LEAN;
        if (holder[i] && mode[i] !== M_CLAP && mode[i] !== M_STAND) mode[i] = baseMode[i];
        tempEnd[i] = step + 3 + Math.floor(mix(step, 94) * 6);
        tempCount++;
      }
    }
  }

  function react(kind: CrowdReaction | 'lean', side: PlayerId | null, power = 1, delay = 0, sticky = false): void {
    if (destroyed) return;
    const k = kindOf(kind);
    const p = Math.max(0.5, Math.min(2, power));
    for (const s of [0, 1] as const) {
      if (side !== null && side !== s) continue;
      if (rxSticky[s] && !sticky) continue;
      const t0 = now + delay;
      const live = rxKind[s] !== 0 && now < rxUntil[s] + 600;
      if (live && PRIO[k] < PRIO[rxKind[s]]) continue;
      rxKind[s] = k;
      rxT0[s] = t0;
      rxUntil[s] = sticky ? Infinity : t0 + durationOf(k, p);
      rxThr[s] = shareOf(k, p);
      rxSticky[s] = sticky ? 1 : 0;
    }
    rxActive = rxKind[0] || rxKind[1] ? 1 : 0;
    lastQr = -1; // re-evaluate on the next tick
  }

  function onGameEvent(ev: GameEvent): void {
    switch (ev.type) {
      case 'gameStart':
        react('cheer', null, 0.8, 500);
        break;
      case 'summon': {
        // the entrance takes a moment: the crowd rises with the reveal
        const big = ev.method === 'tribute' || ev.method === 'special';
        react('cheer', ev.player, big ? 1.3 : 1, 420);
        break;
      }
      case 'flip':
        react('cheer', ev.player, 0.8, 250);
        break;
      case 'activate':
        react('cheer', ev.player, 0.7, 150);
        if (ev.kind === 'trap') react('gasp', ev.player === 0 ? 1 : 0, 0.7, 150);
        break;
      case 'attackDeclare':
        // the attacker's fans leap up, the defender's fans brace
        react('cheer', ev.player, 1, 0);
        react('gasp', ev.player === 0 ? 1 : 0, 0.5, 120);
        break;
      case 'damage': {
        const p = Math.max(0.5, Math.min(2, ev.amount / 1000));
        if (ev.amount >= 1500) {
          react('gasp', ev.player, p, 80);
          react('roar', ev.player === 0 ? 1 : 0, 1, 160);
        } else if (ev.amount > 0) {
          react('gasp', ev.player, p, 80);
          react('cheer', ev.player === 0 ? 1 : 0, Math.max(0.8, p), 160);
        }
        break;
      }
      case 'destroy':
        if (ev.location === 'monster') {
          react('gasp', ev.player, 0.8, 120);
          react('cheer', ev.player === 0 ? 1 : 0, 1, 200);
        }
        break;
      case 'lpGain':
        if (ev.amount >= 500) react('cheer', ev.player, 0.8, 200);
        break;
      case 'gameOver':
        react('gasp', ev.winner === 0 ? 1 : 0, 1.6, 300);
        react('roar', ev.winner, 2, 400, true);
        break;
      default:
        break;
    }
  }

  const debug: CrowdDebug = { react: (k, s, p) => react(k, s ?? null, p ?? 1), seats: SEAT_N, stats };
  const neon = (globalThis as { __neon?: Record<string, unknown> }).__neon;
  if (neon) neon.ntCrowd = debug;

  return {
    name: 'crowd',
    owner: 'B1',
    tick(_dt: number, t: number): void {
      now = t;
      const t0 = performance.now();
      stats.ticks++;
      if (litFrom >= 0) {
        const k = t - litFrom;
        const step = k < 260 ? 0 : k < 380 ? 1 : 3;
        if (step !== litStep) applyLit(step);
        if (step === 3) litFrom = -1;
      }
      if (!litOn && litFrom < 0) return;
      const q = Math.floor(t / Q);
      const qr = rxActive ? Math.floor(t / QR) : q;
      if (q === lastQ && qr === lastQr) return;
      stats.work++;
      if (lastMood < 0) lastMood = Math.floor(t / MOOD);
      const mstep = Math.floor(t / MOOD);
      for (let n = 0; lastMood < mstep && n < 4; n++) moodStep(++lastMood);
      lastMood = mstep;
      lastQ = q;
      lastQr = qr;
      if (rxActive) {
        // a reaction ends when both sides are past their release (+ settle)
        for (const s of [0, 1] as const) {
          if (rxKind[s] && t > rxUntil[s] + 300 + SETTLE + 220) {
            rxKind[s] = 0;
            rxSticky[s] = 0;
          }
        }
        rxActive = rxKind[0] || rxKind[1] ? 1 : 0;
      }
      refresh(t, q);
      stats.ms += performance.now() - t0;
    },
    setLights(on: boolean, animate: boolean): Promise<void> {
      litOn = on;
      if (!animate) {
        litFrom = -1;
        applyLit(on ? 3 : 0);
      } else if (on) {
        litFrom = now;
        applyLit(0);
      } else {
        litFrom = -1;
        applyLit(0);
      }
      return Promise.resolve();
    },
    crowd(kind: CrowdReaction, side: PlayerId | null, power: number): void {
      react(kind, side, power, 0);
    },
    onGameEvent,
    destroy(): void {
      destroyed = true;
      const n = (globalThis as { __neon?: Record<string, unknown> }).__neon;
      if (n && n.ntCrowd === debug) delete n.ntCrowd;
    },
  };
}
