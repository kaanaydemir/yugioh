// Sihirli Şapka (magic_hat) — registrations. The scenes (rise, drop, shuffle, pick, pop, reveal, restore) live in
// ./_hat_v3.ts and serve both looks (the legacy look keeps straight slides, no sparkles or mist).
//
// activate  the common trap opening, then the shuffle (the hatsShuffled event right after the activation) while the
//           spent trap card leaves for the graveyard; the pending pick ('decision') plays last.
// events    hatChosen / decoyPopped / hatRevealed / hatRestore have their own handlers, so every path (human pick,
//           bot pick, end-of-turn restore) is animated wherever the engine batch puts them.

import { LANE_MID, zoneXY } from '../../view/layout';
import { fx, registerCardHook, registerEvent } from '../api';
import { lerpXY, seed } from '../battle/_kit';
import { trapExit, trapOpening } from './_opening';
import { hatChosenScene, hatRestoreScene, hatRevealedScene, hatsShuffledScene, decoyPoppedScene } from './_hat_v3';

registerCardHook(
  'magic_hat',
  'activate',
  async (ctx) => {
    const ev = ctx.ev;
    seed(ev.uid * 19 + 7);
    const hi = ctx.findType('hatsShuffled');
    const hEv = hi >= 0 ? (ctx.events[hi] as Extract<typeof ctx.events[number], { type: 'hatsShuffled' }>) : null;
    const trapAt = ev.zone !== null ? zoneXY(ev.player, 'spellTrap', ev.zone) : zoneXY(ev.player, 'spellTrap', LANE_MID);
    const mAt = hEv ? zoneXY(hEv.player, 'monster', hEv.sourceZone) : trapAt;
    const op = await trapOpening(ctx, { focus: lerpXY({ x: trapAt.x, y: trapAt.y - 30 }, { x: mAt.x, y: mAt.y - 20 }, 0.4) });
    const exit = trapExit(ctx, op);
    if (hi >= 0 && !ctx.isConsumed(hi)) await ctx.play(hi);
    await Promise.all([exit, op.banner]);
    await fx.playRun(ctx, fx.resolutionRun(ctx));
    await ctx.unfocus(320);
  },
  { name: 'tb:magic_hat:activate' },
);

const P = { priority: 10 };
registerEvent('hatsShuffled', hatsShuffledScene, { ...P, name: 'tb:magic_hat:shuffle' });
registerEvent('hatChosen', hatChosenScene, { ...P, name: 'tb:magic_hat:chosen' });
registerEvent('decoyPopped', decoyPoppedScene, { ...P, name: 'tb:magic_hat:pop' });
registerEvent('hatRevealed', hatRevealedScene, { ...P, name: 'tb:magic_hat:reveal' });
registerEvent('hatRestore', hatRestoreScene, { ...P, name: 'tb:magic_hat:restore' });
