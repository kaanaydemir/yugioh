// v3 lane A6-B (B4) — the trap window's decision (docs/v3/A6_PLAN.md §3 F7 "Tuzak penceresi", §1.3,
// contracts S-4 / S-15) behind V3_A6_B. Fills V3HOOKS.decision (contract S-8: battle/declare.ts calls
// it for trapResponse windows only); with the flag off nothing here runs and today's tb:decision plays.
//
//   summon window — the S-15 fast path: no card is marked and the presentation is over at once (the
//              same frame; A6_MS.decisionFast ≤ 120 ms), so Yer Yarığı follows the summon right away
//              when a CPU or a scenario answers. A person who is asked gets the marks WITH the question:
//              the v3 prompt calls openTrapMarks(scene).mark() when it opens (src/view/v3/TrapPromptV3.ts).
//              (The presentation cannot know a scripted answer in advance; marking at the prompt is what
//              keeps the CPU / scenario window fast and a person's window marked.)
//   attack window — A2's approved Chains timing: every face-down spell / trap card of the defender is
//              marked (TrapMarksV3: a 1-px magenta rim drawing itself round the card, then a running
//              light node; the pad lit in steps; ui3Decision) and the handler holds 300 ms
//              (A6_MS.decision lock 300; today 317). Every face-down card, not only the usable ones —
//              no new leak (§7.2).
//   both     — ctx.keep('trapPulse', marks) (S-4): trapOpeningV3 takes it and destroys it, tb:responseDeclined
//              takes it and settles it (the rims cool down in palette steps); an unmarked handle stays a
//              valid empty one.
// No dimming, no whole-tile fill, no ADD, no camera call (KO-3, KO-4, KO-10).

import { V3_A6_B } from '../../view/v3flags';
import { TrapMarksV3 } from '../../view/v3/TrapPromptV3';
import type { CinematicContext } from '../_core/types';
import type { GameEvent } from '../../engine/types';
import { V3HOOKS } from './_hooks';

type DecisionCtx = CinematicContext<Extract<GameEvent, { type: 'decision' }>>;

/** The v3 decision beats (ms at 1×; a wait resolves on the first frame at or past it: 290 → 300 ms). */
export const DECISION_V3_MS = Object.freeze({
  /** The marked window (attack): the handler's hold. */
  marked: 290,
});

/** Is this window the S-15 fast path (a summon window: nothing marked, over at once)? */
export function isFastWindow(ev: Extract<GameEvent, { type: 'decision' }>): boolean {
  return ev.pending.kind === 'trapResponse' && ev.pending.trigger.kind === 'summoned';
}

/** V3HOOKS.decision (trapResponse windows): the marks (attack window) or the fast path (summon window). */
export async function decisionV3(ctx: DecisionCtx): Promise<void> {
  const pd = ctx.ev.pending;
  if (pd.kind !== 'trapResponse') return ctx.base();
  // a stale handle of an earlier window goes first (as today's handler)
  ctx.take('trapPulse')?.destroy();
  const marks = new TrapMarksV3(ctx.scene, ctx.views, pd.player);
  ctx.keep('trapPulse', marks);
  if (isFastWindow(ctx.ev)) return;
  marks.mark();
  await ctx.wait(DECISION_V3_MS.marked);
}

if (V3_A6_B) V3HOOKS.decision = decisionV3;
