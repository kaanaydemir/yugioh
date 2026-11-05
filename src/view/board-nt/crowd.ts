// Neon Tower layer: CROWD → the EMPTY STANDS' SEAT LIGHTS.
// Readability pass: idle seats stay at level 0 (dark slate) so bright cyan/crimson LEDs do not clutter the background.

import Phaser from 'phaser';
import type { GameEvent, PlayerId } from '../../engine/types';
import { NT_SEATS_KEY, SEAT_FH, SEAT_FW, seatFrameName, seatsAtlas } from '../../art/arena-nt/crowd';
import type { CrowdReaction } from './api';
import { type NtCtx, type NtLayer } from './layer';
import { ALL_STANDS, SEATS, rowRange } from './seats';
import { ensureNtTexture } from './textures';

export function ensureCrowdTextures(scene: Phaser.Scene): void {
  ensureNtTexture(scene, 'crowd', NT_SEATS_KEY, () => seatsAtlas().canvas);
  const tex = scene.textures.get(NT_SEATS_KEY);
  for (const [name, r] of Object.entries(seatsAtlas().frames)) if (!tex.has(name)) tex.add(name, 0, r.x, r.y, r.w, r.h);
}

const Q = 100;
const QR = 40;

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
  readonly stats: { ms: number; ticks: number; work: number };
}

export function createCrowdLayer(ctx: NtCtx): NtLayer {
  const scene = ctx.scene;
  ensureCrowdTextures(scene);
  const tex = scene.textures.get(NT_SEATS_KEY);

  const frames: Phaser.Textures.Frame[][][] = [0, 1].map((team) =>
    [0, 1, 2].map((v) => [0, 1, 2, 3].map((l) => tex.get(seatFrameName(team as 0 | 1, v, l)))),
  );

  const side = new Uint8Array(SEAT_N);
  const row = new Uint8Array(SEAT_N);
  const variant = new Uint8Array(SEAT_N);
  const dist = new Float32Array(SEAT_N);
  const seed = new Float32Array(SEAT_N);
  const cur = new Int8Array(SEAT_N).fill(-1);
  const bobs: Phaser.GameObjects.Bob[] = new Array(SEAT_N);

  const rowsUsed = Math.max(...SEATS.map((s) => s.row)) + 1;
  const rowBlitters: Phaser.GameObjects.Blitter[] = [];
  for (let r = 0; r < rowsUsed; r++) {
    const s0 = SEATS.find((s) => s.row === r);
    if (s0) rowBlitters[r] = ctx.add(scene.add.blitter(0, 0, NT_SEATS_KEY).setDepth(s0.depth));
  }
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
    const bob = rowBlitters[s.row].create(s.x - Math.floor(SEAT_FW / 2), s.y - SEAT_FH, frames[s.team][variant[i]][0]);
    bob.flipX = s.flipX;
    bobs[i] = bob;
    cur[i] = 0;
  }

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

  function idleLevel(_i: number, _t: number): number {
    return 0;
  }

  function rxLevel(_i: number, _t: number): number {
    return 0;
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

  function onGameEvent(_ev: GameEvent): void {
    /* keep seats dark during readability pass */
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
