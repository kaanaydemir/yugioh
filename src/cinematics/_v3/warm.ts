// v3 POSE WARMING (A2 tech review r2 #12): the v3 sheets are painted lazily in the background
// (src/art/textures.ts); a pose a cinematic needs before the painter reached it was painted
// synchronously on first use — on the contact (hit-stop) frame for a reaction or a death (a 150–
// 420 ms freeze). The kits ask for their poses AHEAD, when the cinematic that will need them starts:
//
//   warmPoses(id, player, ['summon'])          a summon handler, before the card flight / tributes
//   warmPoses(id, player, REACTION_POSES)      attackDeclare (attacker + target), a spell's target
//
// warmMonsterSheet paints those anims first, in short background slices (no synchronous paint);
// MonsterUnit also warms the reactions of every unit as it enters the field. A no-op in the old
// look, for complete sheets and for synchronously built ones (?test, tools).

import type { MonsterId } from '../../data/cards';
import type { PlayerId } from '../../engine/types';
import type { AnyMonsterAnim } from '../../art/types';
import { monsterSheetKey, warmMonsterSheet } from '../../art/textures';
import { LOOK_V3 } from '../../view/layout';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { unitSheetKey } from '../../duel/unit-variant';

/** The poses a blow on a unit may need (recoils, the guard brace / break, the death). */
export const REACTION_POSES: readonly AnyMonsterAnim[] = ['hitMagic', 'hitHeavy', 'death', 'toGuard', 'fromGuard'];

/** Paint these poses of a monster's sheet (as `player` would show it) first, in the background. */
export function warmPoses(id: MonsterId, player: PlayerId, anims: readonly AnyMonsterAnim[]): void {
  if (!LOOK_V3) return;
  try {
    warmMonsterSheet(monsterSheetKey(id, player), anims);
  } catch (e) {
    console.warn('[warm] poses', e);
  }
}

/** warmPoses for a unit on the field: the sheet it really shows (a variant's, src/duel/unit-variant.ts; else warmPoses' own). */
export function warmUnitPoses(u: MonsterUnit, anims: readonly AnyMonsterAnim[]): void {
  if (!LOOK_V3) return;
  try {
    warmMonsterSheet(unitSheetKey(u), anims);
  } catch (e) {
    console.warn('[warm] poses', e);
  }
}
