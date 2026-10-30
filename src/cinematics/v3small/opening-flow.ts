// v3 lane A6-B (step B-open) — the opening's "DÜELLO!" beat (F0) behind V3_A6_B (docs/v3/A6_PLAN.md
// §3 F0, §5.1 hook table, §5.3 row B-open). Fills V3HOOKS.duelPlate and V3HOOKS.hudIn (contract S-8);
// with the flag off nothing here runs and today's flow/opening.ts plays (the full-width "DÜELLO!"
// band, the HUD in one frame). The landing (the camera rig's descent), the duelists' entrance, the
// coin toss and its lean (flow/opening.ts:163) are today's code, untouched: these hooks start after
// the coin has gone home, and they make no camera call of their own (KO-10).
//
// The "DÜELLO!" beat (t = 0 ≈ 3.78 s into the opening, where today's band slammed in):
//   0        hudIn('duel'): the HUD arrives — P1's panel from the bottom left, P2's from the top right,
//            the bar (+ turn badge, toolbar) from the top, the buttons from the right, 40 ms apart,
//            120 ms each on whole pixels; each piece comes complete — body, words, numbers — its trim
//            two tones down, then one, then at rest (HudV3.arrive, A6B-8: no frame without its
//            numbers, no single-frame pop; 240 ms in all)
//   0        the large plate drops in under the phase bar, above the board's top corner (clear of
//            every deal path); its letters stamp one per frame from its first frame (A6B-8: never a plate
//            without its word), the duelists' marks and a 1-px thump at 117 ms, a glint sweeps the
//            word, a light node runs its trim (DuelPlate)
//   0–290    the floor answers from the board's middle: a stepped light ripple runs outward, every
//            zone pad one tone up (night1 → night2, a flash of two at its peak) as the ripple passes,
//            then back (the stepped light layer: pad pixels only, never a wash)
//   240      both sides answer in their colours: their trims run once from the podiums and their pads
//            swell back toward the middle, as at a turn start (the calm arena's pulseSide)
//   +420     the deal (lane A6-A's hook, or today's code) — it never passes under the plate
//   turn 1   the plate leaves in two palette steps as the first turn plate comes (v3small/turn.ts)
// skipIntro, hudIn('skip'): the HUD is already on screen — nothing moves, its trims wake in the same
// order (one white frame, then one tone up). hudIn('finally'): a running arrival ends at once.
// REDUCED_MOTION (KO-9): the plate is there at once, the HUD comes in two palette steps without a
// slide, no floor wave. Sounds: ui3DuelStart and ui3PanelIn (lane A6-A's recipes); while ui3DuelStart
// is still A56.0's silent skeleton, today's band sounds stand in on the same beats (cardSlam at 0,
// impactHeavy on the thump).

import { PAL } from '../../art/palette';
import type { PlayerId } from '../../engine/types';
import { BOARD_CENTER, LANES, zoneXY, type BoardSpot } from '../../view/layout';
import { V3_A6_B } from '../../view/v3flags';
import { REDUCED_MOTION } from '../../view/v3/motion';
import { HudV3, ui3Ready, ui3Sfx } from '../../view/v3/hudV3';
import { DUEL_PLATE, DuelPlate } from '../../view/v3/TurnPlate';
import { bg, fs, lightFlash, type Ctx } from '../flow/_kit';
import { V3HOOKS, type HudInAt } from './_hooks';

const FRAME = 1000 / 60;

/** The beat's timings (ms at 1×) and the floor ripple. */
export const OPENING_V3 = Object.freeze({
  /** The ripple's speed out from the board's middle (iso px per ms: y counts double) and each pad's flash. */
  waveSpeed: 0.45,
  padR: 24,
  padMs: 260,
  padLevel: 0.9,
  /** Both sides answer: their trims run and their pads swell (pulseSide). */
  sidesAt: 240,
  /** The thump after the last letter (DuelPlate: the frame after the "!" stamps). */
  thumpAt: Math.round((DUEL_PLATE.stampFrame + 7) * FRAME),
});

const ZONES: readonly (readonly [BoardSpot, number])[] = [
  ['monster', LANES],
  ['spellTrap', LANES],
  ['field', 1],
  ['deck', 1],
  ['graveyard', 1],
];

/** Every zone pad of both sides with the ms the ripple reaches it (iso distance from the board's middle). */
export function rippleZones(): { x: number; y: number; at: number }[] {
  const C = BOARD_CENTER;
  const out: { x: number; y: number; at: number }[] = [];
  for (const p of [0, 1] as PlayerId[])
    for (const [spot, n] of ZONES)
      for (let i = 0; i < n; i++) {
        const z = zoneXY(p, spot, i);
        out.push({ x: z.x, y: z.y, at: Math.round(Math.hypot(z.x - C.x, 2 * (z.y - C.y)) / OPENING_V3.waveSpeed) });
      }
  return out.sort((a, b) => a.at - b.at);
}

/** The "DÜELLO!" beat (F0): the large plate, its floor wave and sounds. Resolves when the plate has entered. */
async function duelPlateV3(ctx: Ctx<'gameStart'>): Promise<void> {
  const sc = ctx.scene;
  const v = ctx.views;
  const plate = DuelPlate.show(sc);
  // the gold chord (lane A6-A's ui3DuelStart); today's band sounds stand in while it is the skeleton
  const fallback = !ui3Ready('ui3DuelStart');
  ui3Sfx('ui3DuelStart', {}, 'cardSlam', { volume: 0.7, pitch: 0.8 });
  if (fallback) bg(ctx.wait(OPENING_V3.thumpAt).then(() => ctx.sfx('impactHeavy', { volume: 0.55, pitch: 0.85 })));
  if (!REDUCED_MOTION) {
    // the floor answers from the board's middle: a stepped ripple, each pad one tone up as it passes
    for (const z of rippleZones()) bg(ctx.wait(z.at).then(() => lightFlash(sc, z.x, z.y, PAL.white, fs(OPENING_V3.padR), OPENING_V3.padMs, { intensity: OPENING_V3.padLevel })));
    // …and both sides answer in their colours: their trims run once from the podiums, their pads swell
    bg(ctx.wait(OPENING_V3.sidesAt).then(() => Promise.all([v.board.pulseSide(0), v.board.pulseSide(1)])));
  }
  await plate.entered;
}

/** The HUD's arrival at the opening's three sites (F0 hudIn); never locks the input, idempotent. */
function hudInV3(ctx: Ctx<'gameStart'>, at: HudInAt): void {
  const h = ctx.views.hud as unknown;
  if (!(h instanceof HudV3)) {
    ctx.views.hud.setVisible(true);
    return;
  }
  if (at === 'finally') {
    h.settleArrival();
    h.setVisible(true);
    return;
  }
  // 'duel': hidden for the descent → it slides in; 'skip': already on screen → its trims wake, nothing moves
  h.arrive(at === 'skip' && h.isShown ? 'wake' : 'slide');
  ui3Sfx('ui3PanelIn', { volume: 0.6 });
}

if (V3_A6_B) {
  V3HOOKS.duelPlate = duelPlateV3;
  V3HOOKS.hudIn = hudInV3;
}
