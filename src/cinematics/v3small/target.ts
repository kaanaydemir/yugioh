// v3 lane A6-B (B3) — the engine `target` event's default presentation (docs/v3/A6_PLAN.md §3 F4:
// "Motor target olayı") behind V3_A6_B. Fills V3HOOKS.target (contract S-8); with the flag off nothing
// here runs and today's lock-on reticles play (_defaults/battle.ts).
//
// Only cards WITHOUT their own target hook reach it (every current targeting card — Yıldırım Hükmü,
// Ruh Çağrısı, Ejder Kılıcı, Uçurum Büyücüsü, Dikenli Pusucu — consumes its target event in its own
// cinematic; card hooks are unchanged, F4). The body (src/view/v3/TargetMarks.ts lockTargets):
//   0–80     the same target corners as the human's pick appear 4 px out round every target and close
//            onto it in two steps (4 → 2 → 0 px)
//   80       the lock: one white contour frame on the unit, the corners white for that frame, a small
//            gold floor flash under it; ui3Lock (today's lockOn while A6-A's recipe is silent)
//   80–200   held; 200–240 one palette step down; gone at 240 ms (today: 230 ms reticles + 260 ms hold)
// No camera call (KO-10); whole pixels, palette tones (KO-1 … KO-3).

import { V3_A6_B } from '../../view/v3flags';
import { lockTargets } from '../../view/v3/TargetMarks';
import type { CinematicContext } from '../_core/types';
import type { GameEvent } from '../../engine/types';
import { V3HOOKS } from './_hooks';

type TargetCtx = CinematicContext<Extract<GameEvent, { type: 'target' }>>;

/** V3HOOKS.target: the corners close onto the targets (240 ms). */
export async function targetV3(ctx: TargetCtx): Promise<void> {
  await lockTargets(ctx.scene, ctx.views, ctx.ev.targets);
}

if (V3_A6_B) V3HOOKS.target = targetV3;
