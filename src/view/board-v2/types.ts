// Shared runtime types and sub-depths of the arena v2 board view (src/view/board-v2/).

import type Phaser from 'phaser';

type Img = Phaser.GameObjects.Image;
import { DEPTH } from '../layout';

/** Sub-depths inside the layout DEPTH bands. */
export const D2 = {
  sky: DEPTH.SKY,
  skyHot: DEPTH.SKY + 0.5,
  stars: DEPTH.SKY + 2,
  search: DEPTH.SKY + 5,
  stadium: DEPTH.STADIUM,
  stadiumHot: DEPTH.STADIUM + 0.5,
  crowd: DEPTH.STADIUM + 2,
  flags: DEPTH.STADIUM + 2.3,
  towers: DEPTH.STADIUM + 2.5,
  spot: DEPTH.STADIUM + 2.7,
  floorPool: DEPTH.STADIUM + 4,
  dronesBack: DEPTH.STADIUM + 6,
  deck: DEPTH.PLATFORM,
  faceLights: DEPTH.PLATFORM + 2,
  runner: DEPTH.PLATFORM + 3,
  tile: DEPTH.TILE,
  dark: DEPTH.TILE + 0.5,
  // emissive stadium things shine through the lights-off darkness
  phones: DEPTH.TILE + 0.6,
  led: DEPTH.TILE + 0.7,
  lamps: DEPTH.TILE + 0.8,
  bridgeFlow: DEPTH.TILE + 1,
  trim: DEPTH.TILE + 1.2,
  trimGlow: DEPTH.TILE + 1.3,
  halo: DEPTH.TILE + 1.5,
  tileGlow: DEPTH.TILE + 2,
  chevron: DEPTH.TILE + 2.5,
  lava: DEPTH.TILE + 3,
  lavaGlow: DEPTH.TILE + 3.5,
  pools: DEPTH.TILE + 5,
  cones: DEPTH.TILE + 6,
  hlFill: DEPTH.TILE_FX,
  hlOutline: DEPTH.TILE_FX + 1,
  hlMarch: DEPTH.TILE_FX + 2,
  hlTips: DEPTH.TILE_FX + 3,
  flash: DEPTH.TILE_FX + 5,
  motes: DEPTH.TILE_FX + 8,
  props: DEPTH.TILE_FX + 9,
} as const;

export interface Particle {
  img: Img;
  kind: 'mote' | 'spark' | 'ember' | 'ash' | 'confetti';
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  sway: number;
  phase: number;
  alpha: number;
  spin: number;
  alive: boolean;
}

/** 0→1→0 envelope: rise over `up`, hold, fall over `down` (k is 0..1 over the whole span). */
export function envelope(k: number, up: number, hold: number, down: number): number {
  const t = k * (up + hold + down);
  if (t < up) {
    const u = t / up;
    return 1 - (1 - u) * (1 - u);
  }
  if (t < up + hold) return 1;
  const d = Math.min(1, (t - up - hold) / down);
  return 1 - d * d;
}

/** Shared runtime services for the v2 sub-views (stadium, lava). */
export interface BoardCtx {
  readonly scene: Phaser.Scene;
  readonly rnd: () => number;
  add<T extends Phaser.GameObjects.GameObject>(o: T): T;
  remove(o: Phaser.GameObjects.GameObject): void;
  run(ms: number, fn: (k: number) => void, ease?: string, delay?: number): Promise<void>;
  spawn(kind: Particle['kind'], x: number, y: number, color: number, vy?: number): Particle | null;
  /** board time (ms) */
  readonly t: number;
}


/** How the crowd reacts (BoardView.crowd). */
export type CrowdReaction = 'cheer' | 'gasp' | 'roar';
