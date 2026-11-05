// Monster variants (lane A shared infrastructure; docs/v3/kart-a/cloud_hatchling.md §3.3): a second,
// permanent form of a monster on the field — today cloud_hatchling's grown form. Art side only: the
// registry, the variant's own sheets (`mon:<id>:<name>`, `mon:<id>:<name>:p2`) and their warming.
// The unit side (which unit shows which variant, the MonsterUnit hooks) is src/duel/unit-variant.ts.
//
//   registerMonsterVariant('cloud_hatchling', { name: 'grown', art: () => grownArt, when: (slot) => … });
//   slotVariant(id, slot)          // the variant a field slot shows (null unless LOOK_V3)
//   ensureVariantSheet(scene, id, 'grown', player)   // prepares (no paint) and returns the sheet key
//
// A variant art is NOT a registry art (monsterArt(id) stays the base form), so textures.ts gives it
// its own frame cache (cacheOf → otherCaches) and a grid sheet (cropsArt is registry identity):
// its frames never collide with the base form's, although both arts carry the same id.
// Register a variant from a module WITHOUT a default export (src/art/monsters-v3/*.ts default exports
// are read as the card's v3 art), or from a `_`-prefixed file imported by the base art module.
// Nothing here runs in the v1 look: slotVariant returns null there, so no unit ever gets a variant.

import type Phaser from 'phaser';
import type { MonsterId } from '../data/cards';
import type { MonsterSlot, PlayerId } from '../engine/types';
import type { SfxName } from '../audio/sfx';
import { LOOK_V3 } from '../view/layout';
import type { AnyMonsterAnim, MonsterArt } from './types';
import { animList } from './animtime';
import { prepareMonsterSheet, relightsP2, warmMonsterSheet } from './textures';

/** One step of a rewind (lane D's "bilemedi" un-summon): play `anim` backwards on the unit's own anim keys. */
export interface RewindStep {
  anim: AnyMonsterAnim;
  reverse: true;
}

export interface MonsterVariant {
  /** The variant's name ('grown'); its sheets are `mon:<id>:<name>` / `mon:<id>:<name>:p2`. */
  name: string;
  /** The variant's art (same id as the base form; lazily read so the module order never matters). */
  art(): MonsterArt;
  /** Does this field slot show the variant? (Only asked in the v3 look.) */
  when(slot: MonsterSlot): boolean;
  /** The rewind of a unit in this variant (default: the base form's `[summon reversed]`). */
  rewind?: readonly RewindStep[];
  /** The voice of that rewind (rewindSfx), if any. */
  rewindSfx?: SfxName;
}

const VARIANTS = new Map<MonsterId, MonsterVariant[]>();

/** Register a variant of monster `id` (once per name; a second registration of a name replaces it). */
export function registerMonsterVariant(id: MonsterId, v: MonsterVariant): void {
  const list = VARIANTS.get(id) ?? [];
  const i = list.findIndex((o) => o.name === v.name);
  if (i >= 0) list[i] = v;
  else list.push(v);
  VARIANTS.set(id, list);
}

/** Does monster `id` have any registered variant? */
export function hasVariants(id: MonsterId): boolean {
  return (VARIANTS.get(id)?.length ?? 0) > 0;
}

function variantOfName(id: MonsterId, name: string): MonsterVariant | null {
  return VARIANTS.get(id)?.find((v) => v.name === name) ?? null;
}

/** The variant a field slot of monster `id` shows (the first registered one whose `when` holds), or null. Always null in the v1 look. */
export function slotVariant(id: MonsterId, slot: MonsterSlot): string | null {
  if (!LOOK_V3) return null;
  const list = VARIANTS.get(id);
  if (!list) return null;
  for (const v of list) if (v.when(slot)) return v.name;
  return null;
}

/** The art of variant `name` of monster `id`, or null when no such variant is registered. */
export function variantArt(id: MonsterId, name: string): MonsterArt | null {
  return variantOfName(id, name)?.art() ?? null;
}

/** The sheet key of a variant for `player`: `mon:<id>:<name>` (P1, and P2 of a 'mirror' art) / `mon:<id>:<name>:p2`. */
export function variantSheetKey(id: MonsterId, name: string, player: PlayerId): string {
  const base = `mon:${id}:${name}`;
  if (player !== 1) return base;
  const art = variantArt(id, name);
  return art && relightsP2(art) ? `${base}:p2` : base;
}

/** Which variant sheet a texture key is (`mon:<id>:<name>` / `…:p2`), or null for any other key. */
export function variantOfSheetKey(key: string | null | undefined): { id: MonsterId; name: string; p2: boolean } | null {
  if (!key || !key.startsWith('mon:')) return null;
  const parts = key.split(':');
  if (parts.length < 3 || parts.length > 4) return null;
  const id = parts[1] as MonsterId;
  const name = parts[2];
  if (name === 'p2' || !variantOfName(id, name)) return null;
  if (parts.length === 4 && parts[3] !== 'p2') return null;
  return { id, name, p2: parts.length === 4 };
}

/**
 * Prepare (register, paint later — textures.prepareMonsterSheet) the variant's sheet for `player`
 * once per key and scene, and return its key. No paint here: warmVariant paints in the background.
 */
export function ensureVariantSheet(scene: Phaser.Scene, id: MonsterId, name: string, player: PlayerId): string {
  const key = variantSheetKey(id, name, player);
  const art = variantArt(id, name);
  if (!art) return key;
  if (!scene.textures.exists(key)) prepareMonsterSheet(scene, art, { key, draw: key.endsWith(':p2') ? { lightFrom: 'right' } : undefined });
  return key;
}

/** Prepare both players' sheets of a variant and queue every anim of both for background painting. */
export function warmVariant(scene: Phaser.Scene, id: MonsterId, name: string): void {
  const art = variantArt(id, name);
  if (!art) return;
  const anims = animList(art);
  for (const p of [0, 1] as PlayerId[]) warmMonsterSheet(ensureVariantSheet(scene, id, name, p), anims);
}

/** The rewind steps of a unit of monster `id` in `variant` (null: the base form). The cross-lane contract (lane D). */
export function rewindAnims(id: MonsterId, variant: string | null): RewindStep[] {
  const v = variant ? variantOfName(id, variant) : null;
  return v?.rewind ? v.rewind.map((s) => ({ ...s })) : [{ anim: 'summon', reverse: true }];
}

/** The voice of that rewind (a variant's own), or null. */
export function rewindSfx(id: MonsterId, variant: string | null): SfxName | null {
  const v = variant ? variantOfName(id, variant) : null;
  return v?.rewindSfx ?? null;
}

/** TEST ONLY: forget every registered variant. */
export function _resetVariantsForTest(): void {
  VARIANTS.clear();
}
