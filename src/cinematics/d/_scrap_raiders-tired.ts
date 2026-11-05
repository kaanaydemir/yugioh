// Hurda Akıncıları (scrap_raiders) — the TIRED lock pose on a unit (?look=v3 only; registers no hook: the `_` file
// is loaded by the cinematics glob but only exports helpers). Used by ./scrap_raiders.ts and ./_scrap_raiders-fx.ts.
//
// The art's own guard is the RESTED defense (wheels on, the crew braced behind the ram). While the attackThenDefense
// lock lasts the unit shows the hidden 'tired' sheet instead (src/art/monsters-v3/_scrap_raiders-tired.ts, registered
// as a variant whose `when` is never true): the same frame names drawn through the lock, so every generic path —
// the guard loop, a guard hit's brace, the guard break into the death, the death planner — keeps working and simply
// shows the tired pixels (wheel flat on the floor, the wrench goblin hammering the axle).
//
// How: the unit's anim keys stay the art's own; only the sheet it SHOWS changes (MonsterUnit.sheetKey — the same
// lever the P2 relight and the lane-A variants use; UnitSprite.syncSheet moves every frame onto it by name). The
// MonsterUnit.sheetFor hook is chained once (the previous hook still answers every other unit), so a settle()
// between cinematics keeps the tired sheet while the lock lasts.
//
//   setTired(u, true)   // the End Phase wheel-off starts (call BEFORE playing toGuard: it is the tired toGuard)
//   setTired(u, false)  // the lock end (call when the tired fromGuard has reached the rested guard f0)
//   isTired(u)

import type Phaser from 'phaser';
import { ensureVariantSheet, warmVariant } from '../../art/variants';
import { finishMonsterSheet } from '../../art/textures';
import { MonsterUnit, UnitSprite } from '../../duel/MonsterUnit';
import { LOOK_V3 } from '../../view/layout';

const ID = 'scrap_raiders';
const TIRED = 'tired';
/** Per scene: the uids whose lock shows (survives a unit rebuilt for the same uid). */
const tiredUids = new WeakMap<Phaser.Scene, Set<number>>();

function setOf(sc: Phaser.Scene): Set<number> {
  let s = tiredUids.get(sc);
  if (!s) tiredUids.set(sc, (s = new Set()));
  return s;
}

export function isTired(u: MonsterUnit): boolean {
  return LOOK_V3 && u.cardId === ID && !!tiredUids.get(u.scene)?.has(u.uid);
}

let chained = false;
function chain(): void {
  if (chained) return;
  chained = true;
  const prev = MonsterUnit.sheetFor;
  MonsterUnit.sheetFor = (u) => (isTired(u) ? ensureVariantSheet(u.scene, ID, TIRED, u.player) : prev ? prev(u) : null);
}

/** Paint the tired sheets in the background (both players): call as the cart takes the field. */
export function warmTired(sc: Phaser.Scene): void {
  if (!LOOK_V3) return;
  warmVariant(sc, ID, TIRED);
}

/** Show (or stop showing) the tired sheet on this unit. */
export function setTired(u: MonsterUnit, on: boolean): void {
  if (!LOOK_V3 || u.cardId !== ID) return;
  chain();
  const set = setOf(u.scene);
  if (on === set.has(u.uid)) return;
  if (on) set.add(u.uid);
  else set.delete(u.uid);
  const s = u.sprite;
  if (!s.active) return;
  const sync = () => {
    if (s instanceof UnitSprite) s.syncSheet();
  };
  if (on) {
    const key = ensureVariantSheet(u.scene, ID, TIRED, u.player);
    // the frames a lock can show are painted now (never a blank frame on the swap)
    finishMonsterSheet(key, ['guard', 'toGuard', 'fromGuard', 'hit', 'hitHeavy', 'hitMagic', 'death']);
    u.sheetKey = key;
    sync();
  } else {
    // back to the unit's own sheet: the art's P1 sheet (or the P2 relight) by the same frame name
    const name = s.frame?.name;
    u.sheetKey = MonsterUnit.sheetFor?.(u) ?? (u.player === 1 && u.scene.textures.exists(u.p2Key) ? u.p2Key : u.p1Key);
    if (name !== undefined && u.scene.textures.get(u.animSheetKey).has(String(name))) s.setTexture(u.animSheetKey, name);
    sync();
  }
}

/** Forget a uid (it died / left the field). */
export function clearTired(sc: Phaser.Scene, uid: number): void {
  tiredUids.get(sc)?.delete(uid);
}
