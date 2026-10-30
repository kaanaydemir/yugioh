// The Neon Tower layer contract (docs/v3/ARENA_NEON_TOWER.md §2). BoardViewNt (index.ts) owns the
// list of layers; every layer is one file in this folder with an owner header comment, a factory
// `createXLayer(ctx)` and a painter in src/art/arena-nt/<layer>.ts (textures built by the boot step
// src/boot/NN-arena-nt-<layer>.ts). A layer draws into its own NT_DEPTH band, never into another
// layer's, and must be cheap: no per-sprite tweens, a few timers on the scene clock (tick()).

import type Phaser from 'phaser';
import type { Attribute } from '../../data/cards';
import type { GameEvent, PlayerId } from '../../engine/types';
import type { CrowdReaction } from './api';
import { NT_DEBUG } from './flag';
import { ensureNtTexture } from './textures';
import type { PixelCanvas } from '../../art/pixel';

export type NtLayerName = 'platform' | 'floor' | 'pads' | 'wall' | 'stands' | 'crowd' | 'screens' | 'holograms' | 'lights';
/** The build-phase owner of a layer (docs §9). */
export type NtOwner = 'A1' | 'A2' | 'B1' | 'B2' | 'C';

/** Extra facts about an event that the layers cannot read from the event itself (resolved by the view from the cinematic context). */
export interface NtEventInfo {
  /** attackDeclare: the attacker's attribute (for the colour of the burst). */
  attackerAttribute?: Attribute | null;
}

export interface NtLayer {
  readonly name: NtLayerName;
  readonly owner: NtOwner;
  /** Ambient motion on scene time × timeScale (ms already scaled and capped, like BoardViewCalm.tick). */
  tick?(dt: number, t: number): void;
  /** The floodlights come on / go off (the intro ignition); `animate` false = at once. */
  setLights?(on: boolean, animate: boolean): Promise<void>;
  setActivePlayer?(player: PlayerId | null): void;
  /** A game event reached the cinematic director (summon, attack, damage …): short reactions (crowd, holograms, screens, lights). */
  onGameEvent?(ev: GameEvent, info?: NtEventInfo): void;
  /** BoardView.crowd(kind, side, power). */
  crowd?(kind: CrowdReaction, side: PlayerId | null, power: number): void;
  destroy(): void;
}

/** What a layer gets from the view. */
export interface NtCtx {
  readonly scene: Phaser.Scene;
  /** ?ntdebug level (0 off, 1 outlines, 2 + placeholder swatches). */
  readonly debug: number;
  /** Register a game object for destruction with the view. */
  add<T extends Phaser.GameObjects.GameObject>(o: T): T;
  /** Make (once) and return a layer texture key (boot built it already; this is the fallback). */
  texture(layer: string, key: string, paint: () => PixelCanvas): string;
}

export function makeCtx(scene: Phaser.Scene, objs: Phaser.GameObjects.GameObject[]): NtCtx {
  return {
    scene,
    debug: NT_DEBUG,
    add: (o) => {
      objs.push(o);
      return o;
    },
    texture: (layer, key, paint) => ensureNtTexture(scene, layer, key, paint),
  };
}

/**
 * The skeleton placeholder: with ?ntdebug=2 a layer shows its painter's swatch at the top-left of its
 * region and at its REAL depth, proving boot step → texture → object → depth. Off otherwise.
 */
export function placeholder(ctx: NtCtx, layer: string, key: string, paint: () => PixelCanvas, x: number, y: number, depth: number): Phaser.GameObjects.Image | null {
  if (ctx.debug < 2) return null;
  const tex = ctx.texture(layer, key, paint);
  return ctx.add(ctx.scene.add.image(x, y, tex).setOrigin(0).setDepth(depth));
}
