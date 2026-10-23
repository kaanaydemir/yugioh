// The recipe layer — flips (docs/v3/A3_MIMARI.md §6.2, §6.4). A monster that does not draw its own flip
// (`custom.flip`) flips through the v3 flip of summon-b/flip.ts (≤ 0.6 s: the card turns, the body forms
// half-way through the turn in its guard pose and — flip summon — rises out of it with its own
// `fromGuard`), with the recipe's burst accent instead of the per-card `case` branches, which stay for
// the old look (§6.4: the branches are not bridged; this hook takes the v3 plan monster over at
// priority 10). Its pop-out palette comes through flipRamp (the recipe's `flip.ramp`, bridged).
// A3 pilot fix: the recipe flip has no generic burst (flipV3With { burst: false }: no 80-px light pillar,
// no sparkle swarm, no attribute rock preset under the accent — the accent IS the burst), and the rise is
// scored with the character's own voice ('land') instead of the beasts' roarSmall growl.
// install.ts registers it (registerCardHook 'flip', priority 10) only in the v3 look and only for a
// monster with v3 art.

import { PAL, RAMPS } from '../../art/palette';
import type { FlipAccent, PresentationRecipe } from '../../presentation/types';
import { DEPTH } from '../../view/layout';
import { Sparks, sleep } from '../../vfx/combat';
import { leaves, shadowWisps } from '../../vfx/particles';
import { sparkleBurst } from '../../vfx/summon';
import type { CardHookEvents, CinematicHandler } from '../_core/registry';
import { matterRamp } from '../_v3/presets';
import { panAt, play, soundsOf } from '../_v3/sound';
import { floorCracks } from './setpieces/rockAssembly';
import { burst } from '../summon-b/_kit';
import { flipV3With, type FlipAccentFn } from '../summon-b/flip';

/** The burst accents (the language of today's per-card branches, by kind). */
const ACCENTS: Readonly<Record<FlipAccent, FlipAccentFn>> = {
  // stone / earth: the floor cracks round the card and a few whole-pixel chips jump off it (its voice's
  // knock; without a voice the old quake)
  dust: (ctx, id, x, y) => {
    const sc = ctx.scene;
    const cr = floorCracks(ctx, { x: Math.round(x), y: Math.round(y) }, Math.round(x * 7 + y), { n: 5, len: 9, from: 18 });
    void sleep(sc, 380).then(() => cr.close());
    const chips = new Sparks(sc, DEPTH.FX - 1);
    for (let i = 0; i < 6; i++) {
      const s = i % 2 ? 1 : -1;
      chips.add({ x: Math.round(x + s * (4 + i)), y: Math.round(y - 3), vx: s * (22 + i * 9), vy: -(55 + (i % 3) * 22), ay: 520, life: 330 + i * 25, colors: [PAL.stone4, PAL.stone3, PAL.stone2], shape: i % 3 ? 'px' : 'sq', size: 2, floor: Math.round(y + 1 + (i % 3)), bounce: 0.3, fadeAt: 1 });
    }
    chips.release();
    const v = soundsOf(id);
    if (v) play(v.land, { volume: 0.4, pan: panAt(x) });
    else ctx.sfx('earthQuake', { volume: 0.45, pitch: 1.2 });
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

/** The recipe flip (registerCardHook 'flip'): the v3 flip with the recipe's accent and its voice. */
export function recipeFlip(r: PresentationRecipe): CinematicHandler<CardHookEvents['flip']> {
  const accent = r.flip ? ACCENTS[r.flip.accent] : NONE;
  return (ctx) =>
    flipV3With(ctx, accent, {
      burst: false,
      rise: (c, u) => {
        const v = soundsOf(u.cardId);
        if (v) play(v.land, { volume: 0.6, pan: panAt(u.home.x) });
        else c.sfx(u.card.ace ? 'roarBig' : 'roarSmall', { volume: 0.55 });
      },
    });
}
