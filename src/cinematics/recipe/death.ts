// The recipe layer — deaths (docs/v3/A3_MIMARI.md §6.2). A monster that does not draw its own death
// (`custom.death`) dies through the one v3 death kit (_v3/death.ts deathV3): its `death` pose from
// wherever the blow left it, its accent from the 'dissolve' mark, the body breaking as its material on
// the last frame, the card born on the burst frame and flown to the graveyard. The material and the
// accent are the recipe's (deathPreset reads them through the §6.4 bridge); the recipe adds only its
// burst flourishes: the named set piece `death.onBurst` and recipe.hooks.onDeath. install.ts registers
// it (registerCardHook 'destroyed', priority 10) only in the v3 look and only for a monster with v3 art.
// A destroy the destroying card animates itself (a 'destroys' hook: Yıldırım Hükmü, a trap) and a card
// that is not a monster on the field fall through to the next handler, as the strikes kits' deaths do.

import type { PresentationRecipe } from '../../presentation/types';
import type { CardHookEvents, CinematicHandler } from '../_core/registry';
import { deathV3, matterRamp } from '../_v3/death';
import { sourceOwnsDeath } from '../strikes-b/_kit';
import { hooksOf } from './strike';
import { setPieceOf } from './summon';

/** The recipe death (registerCardHook 'destroyed'). */
export function recipeDeath(r: PresentationRecipe): CinematicHandler<CardHookEvents['destroyed']> {
  return async (ctx) => {
    if (ctx.ev.location !== 'monster' || sourceOwnsDeath(ctx)) return ctx.base();
    const hooks = await hooksOf(r);
    const piece = setPieceOf(r.death.onBurst);
    return deathV3(ctx, {
      fallback: () => ctx.base(),
      onBurst: (u, at) => {
        if (piece) {
          const now = Promise.resolve();
          try {
            void Promise.resolve(piece({ ctx, scene: ctx.scene, unit: u, recipe: r, home: at, ramp: matterRamp(u.cardId), land: now, peak: now, done: now, lead: 0 })).catch((e) => console.error('[recipe] burst piece', e));
          } catch (e) {
            console.error('[recipe] burst piece', e);
          }
        }
        try {
          hooks?.onDeath?.({ ctx, unit: u, recipe: r, at });
        } catch (e) {
          console.error('[recipe] death hook', e);
        }
      },
    });
  };
}
