// Şifa Pınarı's spring. The faster cut that used to live here (ripples → teal geyser → droplets
// arcing into the LP panel; eruption at +150 ms, droplets from +340 ms reaching the panel
// ~0.37–0.44 s later) is now the library's own setpieces.healingFountain timing, so this is a thin
// wrapper that keeps the spell's call site and skips the library's opening chime (the spell
// opening has already played its own activation sound).

import type Phaser from 'phaser';
import type { PlayerId } from '../../engine/types';
import type { XY } from '../../view/layout';
import { healingFountain } from '../../vfx/setpieces';

/** Ripples, eruption (onErupt), droplets into the panel (onArrive on the first). Resolves when the last droplet has landed. */
export function quickFountain(scene: Phaser.Scene, player: PlayerId, toXY: XY, opts: { at: XY; onArrive?: () => void; onErupt?: () => void }): Promise<void> {
  return healingFountain(scene, player, toXY, { at: opts.at, onArrive: opts.onArrive, onErupt: opts.onErupt, chime: false });
}
