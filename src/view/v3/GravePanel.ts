// The graveyard inspect panel (K11) — lane interface S-9 (docs/v3/A6_PLAN.md §4.1, §5.0.4).
// A56.0 STUB with the frozen signatures: today clicking a graveyard does nothing, so the stub opens
// nothing and reports itself closed. Lane A6-A (step A6) fills it; lane A6-B wires the click (B3:
// HumanInput, the bot's wait while it is open, S3) against these signatures from day one.
//
//   await openGravePanel(scene, views, player, { cards: state.players[player].graveyard.map(...) });
//   if (gravePanelOpen(scene)) await whenGravePanelClosed(scene);

import type Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import type { PlayerId } from '../../engine/types';
import type { DuelViews } from '../../duel/types';

export interface GravePanelOpts {
  /** The graveyard's cards as in the engine state (bottom → top). The panel shows the newest first. */
  cards?: readonly CardId[];
  /** How it was opened (focus / keyboard hints). */
  via?: 'mouse' | 'key' | 'touch';
  /** Called once when the panel has closed. */
  onClose?: () => void;
}

/** Open `player`'s graveyard panel; resolves when it has closed again. Stub: nothing opens. */
export async function openGravePanel(scene: Phaser.Scene, views: DuelViews, player: PlayerId, opts: GravePanelOpts = {}): Promise<void> {
  void scene;
  void views;
  void player;
  opts.onClose?.();
}

/** Is a graveyard panel open in `scene`? Stub: never. */
export function gravePanelOpen(scene: Phaser.Scene): boolean {
  void scene;
  return false;
}

/** Resolves when the open panel (if any) has closed. Stub: at once. */
export function whenGravePanelClosed(scene: Phaser.Scene): Promise<void> {
  void scene;
  return Promise.resolve();
}
