// The public surface every arena view of the v3 look serves to src/view/BoardView.ts (the facade
// the whole game talks to). BoardViewCalm (the current v3 arena) and BoardViewNt (Neon Tower) both
// implement it; BoardView holds one of them behind this type. Additive: `crowd` is optional (the
// calm arena has no crowd, BoardView.crowd() then stays the no-op it is today).

import type { ArenaTheme, ZoneHit } from '../../art/arena';
import type { PlayerId } from '../../engine/types';
import type { BoardSpot } from '../layout';
import type { CrowdReaction } from '../board-v2/types';

export type { CrowdReaction } from '../board-v2/types';

type Img = Phaser.GameObjects.Image;

export interface ArenaViewApi {
  readonly theme: ArenaTheme;
  readonly activePlayer: PlayerId | null;
  zoneAt(x: number, y: number): ZoneHit | null;
  tileImage(player: PlayerId, spot: BoardSpot, index?: number): Img | null;
  highlightZone(player: PlayerId, spot: BoardSpot, index: number, color: number | null): void;
  clearHighlights(): void;
  flashTile(player: PlayerId, spot: BoardSpot, index: number, color: number, ms?: number): Promise<void>;
  pulseSide(player: PlayerId): Promise<void>;
  setActivePlayer(player: PlayerId | null, animate?: boolean): void;
  setTheme(theme: ArenaTheme, animate?: boolean, from?: PlayerId | null): Promise<void>;
  setLights(on: boolean, animate?: boolean): Promise<void>;
  setTurn(turn: number | null): void;
  destroy(): void;
  /** The crowd reacts (Neon Tower only; the calm arena has none). */
  crowd?(kind: CrowdReaction, side: PlayerId | null, power?: number): void;
}
