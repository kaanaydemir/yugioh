// Unit variants (lane A shared infrastructure; docs/v3/kart-a/cloud_hatchling.md §3.3): which unit on
// the field shows which variant of its monster (src/art/variants.ts), and the small MonsterUnit hooks
// that make a unit show and play the variant's own sheets. Everything is additive: a unit without a
// variant takes exactly today's code path (every hook returns null / does nothing for it), and in the
// v1 look nothing is installed at all.
//
//   variantOf(u)                 // 'grown' | null — cinematics test variantOf(u) === 'grown'
//   setUnitVariant(u, 'grown')   // upgrade-only (never back to null while the unit lives)
//   unitFrame(u, anim, f, o?)    // THE helper for "the pixels this unit shows" (= monsterFrame(u.cardId…) without a variant)
//   unitSheetKey(u)              // the sheet the unit really shows (warmers)
//   variantTag(u)                // '' or ':<name>' — append to any per-card cache key of unit pixels
//
// FieldView.sync calls syncUidVariants(scene, state) first (the uid → variant map, read when a unit is
// BUILT: MonsterUnit.onBuilt), then syncSlotVariant(u, cardId, slot) for every face-up unit.

import type Phaser from 'phaser';
import type { MonsterId } from '../data/cards';
import type { GameState, MonsterSlot, Uid } from '../engine/types';
import type { AnyMonsterAnim, DrawOpts } from '../art/types';
import type { PixelCanvas } from '../art/pixel';
import { artFrame, monsterSheetKey, sheetAnimKey } from '../art/textures';
import { ensureVariantSheet, slotVariant, variantArt, variantSheetKey, warmVariant } from '../art/variants';
import { LOOK_V3 } from '../view/layout';
import { MonsterUnit } from './MonsterUnit';

const variants = new WeakMap<MonsterUnit, string>();
/** Per scene: uid → the variant its slot shows (rewritten by every FieldView.sync). */
const uidVariants = new WeakMap<Phaser.Scene, Map<Uid, string>>();

/** The variant this unit shows, or null (every unit without one). */
export function variantOf(u: MonsterUnit): string | null {
  return variants.get(u) ?? null;
}

/** '' for a unit without a variant, ':<name>' for one: per-card pixel caches add it to their key. */
export function variantTag(u: MonsterUnit): string {
  const v = variants.get(u);
  return v ? `:${v}` : '';
}

/**
 * Give a unit its variant (upgrade-only: a unit that has a variant keeps it until it retires; a
 * second call with the same name does nothing). Records the uid (a unit rebuilt later in the batch
 * is built in the variant), warms both players' sheets in the background, then swaps the art.
 * False when the variant is unknown or the unit already shows another one.
 */
export function setUnitVariant(u: MonsterUnit, name: string): boolean {
  const cur = variants.get(u);
  if (cur === name) return true;
  if (cur) return false;
  const art = variantArt(u.cardId, name);
  if (!art) return false;
  let m = uidVariants.get(u.scene);
  if (!m) uidVariants.set(u.scene, (m = new Map()));
  m.set(u.uid, name);
  warmVariant(u.scene, u.cardId, name);
  variants.set(u, name);
  u.setArt(art);
  return true;
}

/** FieldView.sync, first thing (v3): every face-up slot with a variant → its name; every other uid is dropped. */
export function syncUidVariants(scene: Phaser.Scene, state: GameState): void {
  let m = uidVariants.get(scene);
  if (!m) uidVariants.set(scene, (m = new Map()));
  m.clear();
  for (const ps of state.players)
    for (const slot of ps.monsters) {
      if (!slot || !slot.faceUp) continue;
      const v = slotVariant(state.cards[slot.uid].cardId as MonsterId, slot);
      if (v) m.set(slot.uid, v);
    }
}

/** FieldView.sync, per face-up unit (v3): upgrade a unit whose slot shows a variant it does not show yet. */
export function syncSlotVariant(u: MonsterUnit, cardId: MonsterId, slot: MonsterSlot): void {
  const v = slotVariant(cardId, slot);
  if (v && variantOf(u) !== v) setUnitVariant(u, v);
}

/** The variant a uid's slot showed at the last sync (or set by setUnitVariant since), or null. */
export function uidVariant(scene: Phaser.Scene, uid: Uid): string | null {
  return uidVariants.get(scene)?.get(uid) ?? null;
}

/**
 * Pixels of one frame of the unit's OWN art (its variant's, when it has one). `o` as the call site
 * passed it to monsterFrame before (byte-identical for every unit without a variant: u.art is then
 * monsterArt(u.cardId), the same object and frame cache).
 */
export function unitFrame(u: MonsterUnit, anim: AnyMonsterAnim, frame: number, o?: DrawOpts): PixelCanvas {
  return artFrame(u.art, anim, frame, o);
}

/**
 * The sheet to warm for the unit: its variant's sheet (u.sheetKey) when it has one, else exactly
 * what the warmers asked before — monsterSheetKey(u.cardId, u.player) (with its lazy-P2 side effect).
 */
export function unitSheetKey(u: MonsterUnit): string {
  return variants.has(u) ? u.sheetKey : monsterSheetKey(u.cardId, u.player);
}

let installed = false;

/** Install the MonsterUnit hooks (v3 only; once). FieldView calls it at module load. */
export function installUnitVariants(): void {
  if (installed || !LOOK_V3) return;
  installed = true;
  MonsterUnit.sheetFor = (u) => {
    const v = variants.get(u);
    return v ? ensureVariantSheet(u.scene, u.cardId, v, u.player) : null;
  };
  MonsterUnit.animSheetFor = (u) => {
    const v = variants.get(u);
    return v ? ensureVariantSheet(u.scene, u.cardId, v, 0) : null;
  };
  MonsterUnit.animKeyFor = (u, anim) => {
    const v = variants.get(u);
    return v ? sheetAnimKey(variantSheetKey(u.cardId, v, 0), anim) : null;
  };
  MonsterUnit.onBuilt = (u) => {
    const v = uidVariants.get(u.scene)?.get(u.uid);
    if (v) setUnitVariant(u, v);
  };
}
