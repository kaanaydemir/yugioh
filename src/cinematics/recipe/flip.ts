// The recipe layer — flips (docs/v3/A3_MIMARI.md §6.2, §6.4). A monster that does not draw its own flip
// (`custom.flip`) flips through the v3 flip of summon-b/flip.ts (≤ 0.6 s: the card turns, the body forms
// half-way through the turn in its guard pose and — flip summon — rises out of it with its own
// `fromGuard`), with the recipe's burst accent instead of the per-card `case` branches, which stay for
// the old look (§6.4: the branches are not bridged; this hook takes the v3 plan monster over at
// priority 10). Its pop-out palette comes through flipRamp (the recipe's `flip.ramp`, bridged).
// install.ts registers it (registerCardHook 'flip', priority 10) only in the v3 look and only for a
// monster with v3 art.

import { RAMPS } from '../../art/palette';
import type { FlipAccent, PresentationRecipe } from '../../presentation/types';
import { DEPTH } from '../../view/layout';
import { leaves, rocks, shadowWisps } from '../../vfx/particles';
import { sparkleBurst } from '../../vfx/summon';
import type { CardHookEvents, CinematicHandler } from '../_core/registry';
import { matterRamp } from '../_v3/presets';
import { burst } from '../summon-b/_kit';
import { flipV3With, type FlipAccentFn } from '../summon-b/flip';

/** The burst accents (the language of today's per-card branches, by kind). */
const ACCENTS: Readonly<Record<FlipAccent, FlipAccentFn>> = {
  // stone / earth: rocks kicked up off the card
  dust: (ctx, _id, x, y) => {
    rocks(ctx.scene, x, y - 4, { count: 8, speed: 1, depth: DEPTH.FX - 1 });
    ctx.sfx('earthQuake', { volume: 0.45, pitch: 1.2 });
  },
  // glass / light: a glint of the matter
  sparks: (ctx, id, x, y) => {
    void sparkleBurst(ctx.scene, x, y - 10, { ramp: matterRamp(id), count: 12, depth: DEPTH.FX + 1 });
    ctx.sfx('holyChime', { volume: 0.45, pitch: 1.35 });
  },
  // void / shadow: wisps along the floor
  mist: (ctx, _id, x, y) => {
    shadowWisps(ctx.scene, x, y, { radius: 14, count: 10, depth: DEPTH.FX - 1 });
    ctx.sfx('darkPulse', { volume: 0.45, pitch: 1.2 });
  },
  // plants: leaves torn up
  vines: (ctx, _id, x, y) => {
    leaves(ctx.scene, x, y - 10, { count: 10, speed: 1.3, depth: DEPTH.FX - 1 });
    ctx.sfx('groundCrack', { volume: 0.45, pitch: 1.1 });
  },
  // water: drops thrown up
  drop: (ctx, _id, x, y) => {
    burst(ctx.scene, x, y - 6, 16, { ramp: RAMPS.water, speed: [60, 150], up: 40, gravity: 360, life: [200, 380], depth: DEPTH.FX });
    ctx.sfx('waterSplash', { volume: 0.45, pitch: 1.2 });
  },
};

const NONE: FlipAccentFn = () => undefined;

/** The recipe flip (registerCardHook 'flip'): the v3 flip with the recipe's accent. */
export function recipeFlip(r: PresentationRecipe): CinematicHandler<CardHookEvents['flip']> {
  const accent = r.flip ? ACCENTS[r.flip.accent] : NONE;
  return (ctx) => flipV3With(ctx, accent);
}
