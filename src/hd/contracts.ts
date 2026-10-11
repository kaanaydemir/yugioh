// HD TRIAL — shared contract for the "HD Neon" quality trial (see docs/STYLE_HD.md).
//
// The trial is a separate page (trial.html) with its own Phaser game at 960×540. It must not
// change the shipped game: nothing under src/hd/ may be imported by the existing game code,
// and the existing files are read-only for the trial (import from them freely).
//
// Composition rule: the arena keeps EXACTLY the current game's composition — the 640×360
// layout scaled ×1.5 into 960×540 (same board placement, same 5×5 iso grid, same zones).

import type { MonsterId } from '../data/cards';
import type { PlayerId } from '../engine/types';
import type { AnimSpec, MonsterAnim } from '../art/types';
import type { PixelCanvas } from '../art/pixel';
import { zoneCell, type BoardSpot, type XY } from '../view/layout';

export const HD_W = 960;
export const HD_H = 540;
/** HD space = current 640×360 layout × 1.5. */
export const HD_SCALE = 1.5;
/** 2:1 iso diamond tile in HD pixels (current 64×32 × 1.5). */
export const HD_TILE_W = 96;
export const HD_TILE_H = 48;
export const HD_BOARD_OX = 480; // 320 × 1.5
export const HD_BOARD_OY = 144; // 96 × 1.5

/** Center of grid tile (col, row) in HD screen pixels. */
export function hdIsoToScreen(col: number, row: number): XY {
  return { x: HD_BOARD_OX + (col - row) * (HD_TILE_W / 2), y: HD_BOARD_OY + (col + row) * (HD_TILE_H / 2) };
}

/** Screen center of a zone tile in HD pixels (same zones as the shipped game). */
export function hdZoneXY(player: PlayerId, spot: BoardSpot, index = 0): XY {
  const c = zoneCell(player, spot, index);
  return hdIsoToScreen(c.col, c.row);
}

/**
 * One rendered frame of an HD monster: the lit color sprite plus a tangent-space normal map
 * of the same size (RGB = normal * 0.5 + 0.5, standard for Phaser's Light2D; alpha = same
 * mask as color). Both are produced from the same 3D-ish volumes, so dynamic lights line up.
 */
export interface HDFrame {
  color: PixelCanvas;
  normal: PixelCanvas;
}

/**
 * HD monster art. Same semantics as MonsterArt (src/art/types.ts): drawn FACING RIGHT,
 * player 2 uses flipX (the normal map's X must be inverted by the consumer when flipped),
 * anchor = ground contact point, muzzle in the attack impact frame, core = visual center.
 * One sprite pixel = one HD pixel.
 */
export interface HDMonsterArt {
  id: MonsterId;
  w: number;
  h: number;
  anchorX: number;
  anchorY: number;
  hover: number;
  muzzle: { x: number; y: number };
  core: { x: number; y: number };
  anims: Record<MonsterAnim, AnimSpec>;
  attackImpactFrame: number;
  /** Deterministic; may be slow-ish (it is cached and built at boot / time-sliced). */
  render(anim: MonsterAnim, frame: number): HDFrame;
  /** Optional extra named points per frame for VFX sync (e.g. mouth per attack frame). */
  points?(anim: MonsterAnim, frame: number): Record<string, { x: number; y: number }>;
}

/**
 * An arena "theme" (atmosphere pack). The trial ships only 'neon', but the API must allow
 * future themes (festival, snow, space, volcano...) to be swapped in — possibly unlocked by
 * level or purchase later. A theme owns the sky, stadium, platform, tiles, ambient life and
 * its lighting mood; monsters never depend on a theme.
 */
export interface ArenaTheme {
  id: string;
  name: string;
  /** Ambient light color/intensity for Light2D and the default rim lights per player side. */
  lighting: {
    ambient: number;
    ambientIntensity: number;
    sideLight: Record<PlayerId, { color: number; intensity: number; radius: number }>;
  };
  /** Build every layer into the scene at the right depths; returns a handle. */
  build(scene: Phaser.Scene, opts: ArenaBuildOptions): ArenaHandle;
}

export interface ArenaBuildOptions {
  /** Environment pixel size in HD pixels: 1 = same density as monsters, 2 = chunky (HD-2D). */
  envPixel: 1 | 2;
  activePlayer?: PlayerId | null;
}

export interface ArenaHandle {
  setActivePlayer(p: PlayerId | null): void;
  /** Glow/flash a zone tile (summons, targets). */
  flashTile(player: PlayerId, spot: BoardSpot, index: number, color: number, ms?: number): Promise<void>;
  destroy(): void;
}
