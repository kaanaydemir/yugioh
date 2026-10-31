// Neon Tower layer: CROWD → the EMPTY STANDS' SEAT LIGHTS (owner decision: no spectators in the arena).
// The tiers keep their seats (src/art/arena-nt/crowd.ts: folding stadium seats, a few folded up, a few with a forgotten gold
// scarf), every seat back carries a tiny LED. The venue is empty but switched on:
//   - idle: every LED glows on standby; a few twinkle (each on its own seeded schedule); every ~8 s a slow light wave rolls
//     across each stand along the tiers (the two sides never in step);
//   - REACTIONS (the old crowd API: cheer / gasp / roar / lean per side, power 0.5…2, driven by the same game events) become
//     light shows on that side's seats: cheer = a ripple running outward from the platform then a short chase; roar = two
//     soft strobes then a fast chase; gasp = the LEDs drop out and come back one by one; lean = a soft ripple. gameOver = the
//     winner's stands keep chasing (sticky);
//   - ignition (setLights): the tiers switch on row by row, front row first.
// One tiny atlas, one Blitter per stand row (at seatDepth(row), between the railings: seats.ts depth contract), zero tweens or
// timers: frames only change when a seat's own level changes; the tick returns at once unless the 10 Hz step turned (≈25 Hz
// while a reaction runs). crowd() stays on the layer API (BoardView.crowd forwards here): it is harmless, only lights react.

import Phaser from 'phaser';
import type { GameEvent, PlayerId } from '../../engine/types';
import { NT_SEATS_KEY, SEAT_FH, SEAT_FW, seatFrameName, seatsAtlas } from '../../art/arena-nt/crowd';
import type { CrowdReaction } from './api';
import { type NtCtx, type NtLayer } from './layer';
import { SEATS, rowRange } from './seats';
import { ALL_STANDS } from './seats';
import { ensureNtTexture } from './textures';

/** Register the seats atlas and its frames once (boot step 26 and, as a fallback, the layer). */
export function ensureCrowdTextures(scene: Phaser.Scene): void {
  ensureNtTexture(scene, 'crowd', NT_SEATS_KEY, () => seatsAtlas().canvas);
  const tex = scene.textures.get(NT_SEATS_KEY);
  for (const [name, r] of Object.entries(seatsAtlas().frames)) if (!tex.has(name)) tex.add(name, 0, r.x, r.y, r.w, r.h);
}

// ---- constants ---------------------------------------------------------------------------------------------

/** Idle quantum (ms) and reaction quantum (ms). */
const Q = 100;
const QR = 40;
/** Idle wave: period per side (ms), phase offsets, speed (px of wave coordinate per ms). */
const WAVE_P = [8200, 9400] as const;
const WAVE_OFF = [1800, 6100] as const;
const WAVE_V = 0.16;
/** Twinkle slot (ms) and the share of seats that twinkle in a slot. */
const TW_SLOT = 300;
const TW_SHARE = 0.035;

const R_CHEER = 1;
const R_GASP = 2;
const R_ROAR = 3;
const R_LEAN = 4;
const PRIO = [0, 2, 2, 3, 1] as const;

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

function durationOf(k: number, p: number): number {
  switch (k) {
    case R_CHEER:
      return 700 + 340 * Math.min(p, 1.3);
    case R_ROAR:
      return 1000 + 600 * p;
    case R_GASP:
      return 600 + 260 * Math.min(p, 1.5);
    default:
      return 500 + 200 * p;
  }
}

export interface CrowdDebug {
  react(kind: CrowdReaction, side: PlayerId | null, power?: number): void;
  readonly seats: number;
  /** ms spent in the layer's tick since creation, and the number of ticks that did work. */
  readonly stats: { ms: number; ticks: number; work: number };
}

export function createCrowdLayer(ctx: NtCtx): NtLayer {
  const scene = ctx.scene;
  ensureCrowdTextures(scene);
  const tex = scene.textures.get(NT_SEATS_KEY);

  // frame table [team][variant][level]
  const frames: Phaser.Textures.Frame[][][] = [0, 1].map((team) =>
    [0, 1, 2].map((v) => [0, 1, 2, 3].map((l) => tex.get(seatFrameName(team as 0 | 1, v, l)))),
  );

  // ---- per-seat data
  const side = new Uint8Array(SEAT_N);
  const row = new Uint8Array(SEAT_N);
  const variant = new Uint8Array(SEAT_N);
  /** ripple distance from the platform (in seat steps, rows count double) */
  const dist = new Float32Array(SEAT_N);
  /** idle wave coordinate (along the stand, tiers offset so the wave runs diagonally) */
  const wav = new Float32Array(SEAT_N);
  const seed = new Float32Array(SEAT_N);
  const cur = new Int8Array(SEAT_N).fill(-1);
  const bobs: Phaser.GameObjects.Bob[] = new Array(SEAT_N);

  const rowsUsed = Math.max(...SEATS.map((s) => s.row)) + 1;
  const rowBlitters: Phaser.GameObjects.Blitter[] = [];
  for (let r = 0; r < rowsUsed; r++) {
    const s0 = SEATS.find((s) => s.row === r);
    if (s0) rowBlitters[r] = ctx.add(scene.add.blitter(0, 0, NT_SEATS_KEY).setDepth(s0.depth));
  }
  // the platform-side end of each stand's rows (ripples start there)
  const edge = ALL_STANDS.map((b) => {
    let xa = Infinity;
    let xb = -Infinity;
    for (let k = 0; k < b.rows; k++) {
      const r = rowRange(b, k);
      xa = Math.min(xa, r.xa);
      xb = Math.max(xb, r.xb);
    }
    return { xa, xb };
  });
  for (let i = 0; i < SEAT_N; i++) {
    const s = SEATS[i];
    side[i] = s.side;
    row[i] = s.row;
    seed[i] = s.seed;
    const h = mix(s.id, 17);
    variant[i] = h < 0.08 ? 2 : h < 0.2 ? 1 : 0;
    const e = s.side === 0 ? Math.max(...edge.filter((_, bi) => ALL_STANDS[bi].side === 0).map((q) => q.xb)) : Math.min(...edge.filter((_, bi) => ALL_STANDS[bi].side === 1).map((q) => q.xa));
    dist[i] = Math.abs(e - s.x) / 8 + s.row * 2;
    wav[i] = (s.side === 0 ? s.x : 640 - s.x) + s.row * 10;
    const bob = rowBlitters[s.row].create(s.x - Math.floor(SEAT_FW / 2), s.y - SEAT_FH, frames[s.team][variant[i]][1]);
    bob.flipX = s.flipX;
    bobs[i] = bob;
    cur[i] = 1;
  }
  let maxDist = 0;
  for (let i = 0; i < SEAT_N; i++) maxDist = Math.max(maxDist, dist[i]);

  // ---- reaction state per side
  const rxKind = new Uint8Array(2);
  const rxT0 = new Float64Array(2);
  const rxUntil = new Float64Array(2);
  const rxPow = new Float32Array(2);
  const rxSticky = new Uint8Array(2);
  let rxActive = 0;

  let now = 0;
  let lastQ = -1;
  let lastQr = -1;
  let destroyed = false;
  let litOn = true;
  /** ignition start (ms of the layer clock), -1 = settled */
  let litFrom = -1;
  const stats = { ms: 0, ticks: 0, work: 0 };

  function setRowsVisible(t: number): boolean {
    let done = true;
    for (let r = 0; r < rowBlitters.length; r++) {
      const b = rowBlitters[r];
      if (!b) continue;
      if (!litOn) {
        b.setVisible(false);
        continue;
      }
      const at = litFrom < 0 ? -1 : litFrom + 240 + r * 70;
      const vis = at < 0 || t >= at;
      if (!vis) done = false;
      b.setVisible(vis);
    }
    return done;
  }

  /** Idle LED level of seat i at time t. */
  function idleLevel(i: number, t: number): number {
    const s = side[i];
    // the slow wave
    const u = (t + WAVE_OFF[s]) % WAVE_P[s];
    const front = u * WAVE_V - 30;
    const d = Math.abs(wav[i] - front);
    if (d < 7) return 2;
    // twinkles
    const slot = Math.floor((t + seed[i] * 977) / TW_SLOT);
    if (mix(i * 31 + 7, slot) < TW_SHARE) return 2;
    // a few seats stay dark (standby off) so the field of dots is not a grid
    return seed[i] < 0.12 ? 0 : 1;
  }

  /** Reaction level of seat i at time t, or -1 when the seat shows its idle level. */
  function rxLevel(i: number, t: number): number {
    const s = side[i];
    const k = rxKind[s];
    if (k === 0) return -1;
    const a = t - rxT0[s];
    if (a < 0) return -1;
    const end = rxUntil[s];
    if (t > end + 260 + seed[i] * 300) return -1;
    const p = rxPow[s];
    const di = dist[i];
    switch (k) {
      case R_CHEER:
      case R_LEAN: {
        const speed = k === R_CHEER ? 0.05 + 0.02 * p : 0.035;
        const front = a * speed;
        const off = front - di;
        if (off >= 0 && off < 1.5) return k === R_CHEER ? 3 : 2;
        if (off >= 1.5 && off < 3) return 2;
        if (k === R_LEAN || front < maxDist + 3) return off < 0 ? -1 : 1;
        // after the ripple: a three-step chase until the end
        return (Math.floor(di) + Math.floor(t / 90)) % 3 === 0 ? 3 : 1;
      }
      case R_ROAR: {
        // two soft strobes (≈ 4 Hz, never faster), then the chase
        const step = Math.floor(a / 120);
        if (step < 4) return step % 2 === 0 ? 3 : 1;
        return (Math.floor(di) + Math.floor(t / 70)) % 3 === 0 ? 3 : (Math.floor(di) + Math.floor(t / 70)) % 3 === 1 ? 2 : 1;
      }
      case R_GASP: {
        // drop out, then come back one by one (seeded order) at standby
        const back = 260 + seed[i] * 420 * Math.min(1.5, p);
        return a < back ? 0 : 1;
      }
      default:
        return -1;
    }
  }

  function refresh(t: number): void {
    for (let i = 0; i < SEAT_N; i++) {
      let l = rxActive ? rxLevel(i, t) : -1;
      if (l < 0) l = idleLevel(i, t);
      if (l !== cur[i]) {
        cur[i] = l;
        bobs[i].setFrame(frames[side[i]][variant[i]][l]);
      }
    }
  }

  function react(kind: CrowdReaction | 'lean', who: PlayerId | null, power = 1, delay = 0, sticky = false): void {
    if (destroyed) return;
    const k = kindOf(kind);
    const p = Math.max(0.5, Math.min(2, power));
    for (const s of [0, 1] as const) {
      if (who !== null && who !== s) continue;
      if (rxSticky[s] && !sticky) continue;
      const live = rxKind[s] !== 0 && now < rxUntil[s] + 600;
      if (live && PRIO[k] < PRIO[rxKind[s]]) continue;
      rxKind[s] = k;
      rxT0[s] = now + delay;
      rxUntil[s] = sticky ? Infinity : now + delay + durationOf(k, p);
      rxPow[s] = p;
      rxSticky[s] = sticky ? 1 : 0;
    }
    rxActive = rxKind[0] || rxKind[1] ? 1 : 0;
    lastQr = -1;
  }

  function onGameEvent(ev: GameEvent): void {
    switch (ev.type) {
      case 'gameStart':
        react('cheer', null, 0.8, 500);
        break;
      case 'summon': {
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
      if (litFrom >= 0 && setRowsVisible(t)) litFrom = -1;
      if (!litOn) return;
      const q = Math.floor(t / Q);
      const qr = rxActive ? Math.floor(t / QR) : q;
      if (q === lastQ && qr === lastQr) return;
      stats.work++;
      lastQ = q;
      lastQr = qr;
      if (rxActive) {
        for (const s of [0, 1] as const) {
          if (rxKind[s] && t > rxUntil[s] + 600) {
            rxKind[s] = 0;
            rxSticky[s] = 0;
          }
        }
        rxActive = rxKind[0] || rxKind[1] ? 1 : 0;
      }
      refresh(t);
      stats.ms += performance.now() - t0;
    },
    setLights(on: boolean, animate: boolean): Promise<void> {
      litOn = on;
      litFrom = on && animate ? now : -1;
      setRowsVisible(now);
      return Promise.resolve();
    },
    crowd(kind: CrowdReaction, who: PlayerId | null, power: number): void {
      react(kind, who, power, 0);
    },
    onGameEvent,
    destroy(): void {
      destroyed = true;
      const n = (globalThis as { __neon?: Record<string, unknown> }).__neon;
      if (n && n.ntCrowd === debug) delete n.ntCrowd;
    },
  };
}
