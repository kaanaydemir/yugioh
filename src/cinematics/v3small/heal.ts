// v3 lane A6-B (step B2) — the LP gain (F3) behind V3_A6_B (docs/v3/A6_PLAN.md §3 F3, §1.3 lpGain,
// KO-1…KO-12). Fills V3HOOKS.presentHeal (contracts S-8, S-14); with the flag off nothing here runs
// and today's presentHeal (_core/helpers.ts: v1's damageNumber + the LP roll, 583 ms) plays.
//
// lpGain (handler ≤ 400 ms — today 583; A6_MS.lpGain)
//   0      the gain number pops beside its panel (above P1's, below P2's): the A2 impact number in
//          leaf (_v3/number.ts, kind 'heal': one size up for its first frames, whole pixels; it
//          floats on by itself after the handler); a small stepped leaf light under the duelist
//   0      the LP counter counts up in leaf (HudV3.setLp, F3): the trim 2 white frames then leaf,
//          the finest wheel clicking digit by digit, the bar's new slice filling in 4-px steps
//          behind a 1-px white lead, 3 pixels rising off it; the last wheel lands white for a frame
//   360    the count has landed: the handler ends (the digits' 60-ms hold and the number's float
//          run on; nothing locks the input longer than the count)
// Şifa Pınarı (lane A5-A) delivers its gain with ctx.play(li, { delivered: true }) (S-14): the
// default lpGain handler skips its heal stream and calls presentHeal — this hook. An undelivered gain
// keeps today's heal stream first (the default handler's), then this. Sound: ui3LpGain from the LP
// counter (HudV3.setLp); while that recipe is still A56.0's silent skeleton, today's 'heal' chime and
// 'lpUp' stand in on the same frame. No camera call (KO-10).

import { PAL } from '../../art/palette';
import { sfx } from '../../audio/sfx';
import { DEPTH, duelistXY, panelRect, type XY } from '../../view/layout';
import { V3_A6_B } from '../../view/v3flags';
import { ui3Ready } from '../../view/v3/hudV3';
import { LP_ROLL_MAX_MS } from '../_v3/budget';
import { impactNumber } from '../_v3/number';
import { fs, lightFlash, type AnyCtx, type EvOf } from '../flow/_kit';
import { lpPoint } from '../_core/helpers';
import { V3HOOKS } from './_hooks';

/** The B2 gain timings (ms at 1×; A6_MS.lpGain ≤ 400). */
export const HEAL_V3 = Object.freeze({
  /** The handler ends when the LP counter has landed (LpCounter: ≤ 360 ms). */
  handlerMs: 360,
  /** The gain number: px between the panel edge and the number's centre, and how far it floats. */
  gap: 9,
  riseP1: 14,
  riseP2: 6,
  /** The leaf light under the duelist. */
  lightR: 22,
  lightMs: 320,
  lightLevel: 0.6,
});

/** Where the gain number pops: over the LP counter, just outside its panel (above P1's, below P2's). */
export function healNumberXY(ctx: AnyCtx, player: EvOf<'lpGain'>['player']): XY {
  const lp = lpPoint(ctx, player);
  const r = panelRect(player);
  return { x: Math.round(lp.x), y: player === 0 ? r.y - HEAL_V3.gap : r.y + r.h + HEAL_V3.gap };
}

/** presentHeal in the v3 look (F3): the number, the count, the light; ≤ 400 ms. */
export async function presentHealV3(ctx: AnyCtx, ev: EvOf<'lpGain'>, o: { at?: XY } = {}): Promise<void> {
  const sc = ctx.scene;
  const at = o.at ? { x: Math.round(o.at.x), y: Math.round(o.at.y) } : healNumberXY(ctx, ev.player);
  // today's chime stands in until lane A6-A writes ui3LpGain (the counter plays it, or 'lpUp')
  if (!ui3Ready('ui3LpGain')) sfx.play('heal', { volume: 0.7 });
  void impactNumber(sc, at.x, at.y, ev.amount, { kind: 'heal', size: 1, depth: DEPTH.HUD + 20, rise: ev.player === 0 ? HEAL_V3.riseP1 : HEAL_V3.riseP2 });
  const d = duelistXY(ev.player);
  void lightFlash(sc, d.x, d.y, PAL.leaf3, fs(HEAL_V3.lightR), HEAL_V3.lightMs, { intensity: HEAL_V3.lightLevel });
  void ctx.views.hud.setLp(ev.player, ev.lpAfter, true, { maxMs: LP_ROLL_MAX_MS });
  await ctx.wait(HEAL_V3.handlerMs);
}

if (V3_A6_B) V3HOOKS.presentHeal = presentHealV3;
