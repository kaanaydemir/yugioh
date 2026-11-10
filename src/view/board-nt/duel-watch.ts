// Arena v4 step 4: what the reactive arena layers read from the duel (cheap polls, no events needed): the players' LP (the
// HUD's LP target — set the moment damage lands, also right for a staged board) and the active Field Spell's theme (the
// duel's FieldView, as glow.ts / floor.ts read it). Every read is guarded: outside a duel (previews) both return defaults.

import type Phaser from 'phaser';
import { fieldTheme, type SealTheme } from '../../art/arena-nt/floor';
import type { FieldView } from '../../duel/FieldView';
import type { PlayerId } from '../../engine/types';

/** At or under this LP a player's side of the arena raises the alarm (a quarter of the 4000 start LP; docs/GAME_DESIGN.md). */
export const LOW_LP = 1000;

interface DuelViews {
  views?: { field?: FieldView; hud?: { getLp(p: PlayerId): number } };
}

/** A player's LP as the HUD holds it (null outside a duel). */
export function readLp(scene: Phaser.Scene, p: PlayerId): number | null {
  try {
    const hud = (scene as unknown as DuelViews).views?.hud;
    const v = hud?.getLp(p);
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** Is `p` in the low-LP band (alive, at or under LOW_LP)? */
export function lowLp(scene: Phaser.Scene, p: PlayerId): boolean {
  const lp = readLp(scene, p);
  return lp !== null && lp > 0 && lp <= LOW_LP;
}

/**
 * The theme of the Field Spell that lights the board (the one that came up last when both players have one), polled at most
 * every 150 ms.
 */
export function fieldThemeWatcher(scene: Phaser.Scene): { current(t: number): Exclude<SealTheme, 'none'> | null } {
  let next = 0;
  let cur: Exclude<SealTheme, 'none'> | null = null;
  const seen: (string | null)[] = [null, null];
  let lastUp: 0 | 1 | null = null;
  return {
    current(t) {
      if (t < next) return cur;
      next = t + 150;
      const f = (scene as unknown as DuelViews).views?.field ?? null;
      const ids: (string | null)[] = [0, 1].map((p) => {
        try {
          const e = f?.entry(p as 0 | 1, 'field', 0);
          return e && e.tile.faceUp ? e.cardId : null;
        } catch {
          return null;
        }
      });
      for (const p of [0, 1] as const) if (ids[p] && ids[p] !== seen[p]) lastUp = p;
      seen[0] = ids[0];
      seen[1] = ids[1];
      const p = lastUp !== null && ids[lastUp] ? lastUp : ids[0] ? 0 : ids[1] ? 1 : null;
      const th = p === null ? 'none' : fieldTheme(ids[p]);
      cur = th === 'none' ? null : th;
      return cur;
    },
  };
}
