// v3 lane A6-B (step B2) — the LP gain (F3) behind V3_A6_B (docs/v3/A6_PLAN.md §3 F3, §1.3 lpGain,
// KO-1…KO-12). Fills V3HOOKS.presentHeal (contracts S-8, S-14); with the flag off nothing here runs
// and today's presentHeal (_core/helpers.ts: v1's damageNumber + the LP roll, 583 ms) plays.
//
// lpGain (handler ≤ 400 ms — today 583; A6_MS.lpGain)
//   0      the gain number pops beside its panel (above P1's, below P2's, never over it): "+n" in the
//          HUD's own palette font (hudSkin PalText, leaf, 1-px ink outline) — one size up (lg, leaf4)
//          for exactly one frame, then md leaf3; a 3-px jump and a short float on whole pixels; it
//          fades in two palette steps (leaf2, leaf1) and goes at 1 s, by itself after the handler.
//          A small stepped leaf light under the duelist.
//   0      the LP counter counts up in leaf (HudV3.setLp, F3): the trim 2 white frames then leaf,
//          the finest wheel clicking digit by digit, the bar's new slice filling in 4-px steps
//          behind a 1-px white lead (past 4000: the bar's second lap), 3 pixels rising off it; the
//          last wheel lands white for a frame
//   360    the count has landed: the handler ends (the digits' 60-ms hold and the number's float
//          run on; nothing locks the input longer than the count)
// Why not the A2 impact number (_v3/number.ts, the plan's first pick for the format): its glyphs are
// centre-origin images, so odd-width glyphs sit on half pixels — in the HUD band that breaks KO-2
// (a6audit: 38 'pos' frames per gain), and its slam lasts two frames where F3 asks for one.
// Şifa Pınarı (lane A5-A) delivers its gain with ctx.play(li, { delivered: true }) (S-14): the
// default lpGain handler skips its heal stream and calls presentHeal — this hook. An undelivered gain
// keeps today's heal stream first (the default handler's), then this. Sound: ui3LpGain from the LP
// counter (HudV3.setLp); while that recipe is still A56.0's silent skeleton, today's 'heal' chime and
// 'lpUp' stand in on the same frame. No camera call (KO-10).

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { DEPTH, duelistXY, panelRect, type XY } from '../../view/layout';
import { V3_A6_B } from '../../view/v3flags';
import { PalText } from '../../view/v3/hudSkin';
import { textMetrics, type TextSize } from '../../ui/text';
import { REDUCED_MOTION } from '../../view/v3/motion';
import { LP_ROLL_MAX_MS } from '../_v3/budget';
import { fs, lightFlash, type AnyCtx, type EvOf } from '../flow/_kit';
import { lpPoint } from '../_core/helpers';
import { V3HOOKS } from './_hooks';

/** The B2 gain timings (ms at 1×; A6_MS.lpGain ≤ 400) and the gain number's geometry (px). */
export const HEAL_V3 = Object.freeze({
  /** The handler ends when the LP counter has landed (LpCounter: ≤ 360 ms). */
  handlerMs: 360,
  /** The number's centre: above P1's panel top / below P2's panel bottom (clear of both, any frame). */
  gapP1: 11,
  gapP2: 13,
  /** Its jump (px, ms) and float (px over its life): P2's is short — it rises toward its panel. */
  jump: 3,
  jumpMs: 120,
  riseP1: 10,
  riseP2: 4,
  /** Its palette fade: leaf2 at fade1, leaf1 at fade2, gone at lifeMs. */
  fade1: 760,
  fade2: 880,
  lifeMs: 1000,
  /** The leaf light under the duelist. */
  lightR: 22,
  lightMs: 320,
  lightLevel: 0.6,
});

/** Where the gain number pops: over the LP counter, just outside its panel (above P1's, below P2's). */
export function healNumberXY(ctx: AnyCtx, player: EvOf<'lpGain'>['player']): XY {
  const lp = lpPoint(ctx, player);
  const r = panelRect(player);
  return { x: Math.round(lp.x), y: player === 0 ? r.y - HEAL_V3.gapP1 : r.y + r.h + HEAL_V3.gapP2 };
}

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);

/**
 * The gain number (F3): "+n" centred on (cx, cy), lg leaf4 for one frame, then md leaf3; jumps and
 * floats up on whole pixels, fades leaf2 → leaf1 and goes (HEAL_V3; scene clock — speed shortens it).
 * Reduced motion: no jump, no float.
 */
export function gainNumberV3(sc: Phaser.Scene, cx: number, cy: number, amount: number, o: { depth: number; rise: number }): void {
  const N = HEAL_V3;
  const text = `+${Math.abs(Math.round(amount))}`;
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  const c = sc.add.container(x0, y0).setDepth(o.depth);
  // centred on its ink (the digits' cap band), not on the font cell's empty rows
  const make = (size: TextSize, color: number): PalText => {
    const t = new PalText(sc, 0, 0, text, { size, color });
    const m = textMetrics(size);
    return t.setPosition(-Math.floor(t.width / 2), -(m.capTop + Math.floor(m.capHeight / 2)));
  };
  const big = make('lg', PAL.leaf4);
  const small = make('md', PAL.leaf3).setVisible(false);
  c.add([big.root, small.root]);
  // one size up for exactly ONE rendered frame, wherever in the frame the hook runs (inside an
  // update or between frames): settle on the first scene update after a render has happened
  let rendered = false;
  sc.game.events.once('postrender', () => (rendered = true));
  const settle = () => {
    if (!rendered) return;
    sc.events.off('update', settle);
    if (!c.active) return;
    big.setVisible(false);
    small.setVisible(true);
  };
  sc.events.on('update', settle);
  const draw = (el: number) => {
    if (!c.active) return;
    small.setColor(el >= N.fade2 ? PAL.leaf1 : el >= N.fade1 ? PAL.leaf2 : PAL.leaf3);
    if (REDUCED_MOTION) return;
    const jump = Math.round(easeOut(Math.min(1, el / N.jumpMs)) * N.jump);
    const drift = Math.round(easeOut(Math.min(1, el / N.lifeMs)) * o.rise);
    c.setPosition(x0, y0 - jump - drift);
  };
  draw(0);
  sc.tweens.addCounter({
    from: 0,
    to: N.lifeMs,
    duration: N.lifeMs,
    onUpdate: (tw) => draw(tw.getValue() ?? 0),
    onComplete: () => end(),
    onStop: () => end(),
  });
  const end = () => {
    sc.events.off('update', settle);
    if (c.active) c.destroy();
  };
}

/** presentHeal in the v3 look (F3): the number, the count, the light; ≤ 400 ms. */
export async function presentHealV3(ctx: AnyCtx, ev: EvOf<'lpGain'>, o: { at?: XY } = {}): Promise<void> {
  const sc = ctx.scene;
  const at = o.at ? { x: Math.round(o.at.x), y: Math.round(o.at.y) } : healNumberXY(ctx, ev.player);
  // the gain's sound is the counter's (ui3LpGain, today's 'lpUp' standing in): A6B-7 — the old 'heal' chime
  // layer sounded on that same frame (one sound a frame)
  gainNumberV3(sc, at.x, at.y, ev.amount, { depth: DEPTH.HUD + 20, rise: ev.player === 0 ? HEAL_V3.riseP1 : HEAL_V3.riseP2 });
  const d = duelistXY(ev.player);
  void lightFlash(sc, d.x, d.y, PAL.leaf3, fs(HEAL_V3.lightR), HEAL_V3.lightMs, { intensity: HEAL_V3.lightLevel });
  void ctx.views.hud.setLp(ev.player, ev.lpAfter, true, { maxMs: LP_ROLL_MAX_MS });
  await ctx.wait(HEAL_V3.handlerMs);
}

if (V3_A6_B) V3HOOKS.presentHeal = presentHealV3;
