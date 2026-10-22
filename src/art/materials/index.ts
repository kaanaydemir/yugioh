// Material library — the registry (docs/v3/A3_MIMARI.md §2, §5). Every src/art/materials/defs/<id>.ts
// default-exports one MaterialDef (pure data); it is registered under its id (the file name), deep-
// frozen, and read with materialOf(id). Pure: no Phaser, safe in Node tools and tests.
//
//   materialOf('stone').draw.ramp        tones for the rigkit (a MaterialDef fits its RasterMatSource /
//                                        SeamSource / ToneSource structurally)
//   soundOf('hide')                      the hit-sound parameters a blow on it plays (follows `same`)
//   farOf(materialOf('hide'))            the far side's bands (its own, or the ramp stepped down once)
//
// In the game only src/audio/v3/materials.ts reads it (it builds the stone hit recipes at load; nothing
// plays them yet). The slice keeps its own tables (A3_MIMARI §5: they stay as they are); the v3 bridges
// of Y5 read a recipe's body material through here.

import type { MaterialDef, MaterialId, MaterialSound, ToneBands } from './types';

export * from './types';

const modules = import.meta.glob<{ default: MaterialDef }>('./defs/*.ts', { eager: true });

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}

const BY_ID = new Map<MaterialId, MaterialDef>();
for (const [path, mod] of Object.entries(modules)) {
  const file = path.slice(path.lastIndexOf('/') + 1).replace(/\.ts$/, '');
  const def = mod.default;
  if (!def || def.id !== file) throw new Error(`materials: ${path} must default-export the definition of '${file}' (got '${def?.id}')`);
  BY_ID.set(def.id, deepFreeze(def));
}

/** Every registered material id, sorted. */
export const MATERIAL_IDS: readonly MaterialId[] = Object.freeze([...BY_ID.keys()].sort());

export function hasMaterial(id: MaterialId): boolean {
  return BY_ID.has(id);
}

/** The definition of `id` (throws for an unknown id: a typo must not draw as nothing). */
export function materialOf(id: MaterialId): MaterialDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`materials: unknown material '${id}' (known: ${MATERIAL_IDS.join(', ')})`);
  return def;
}

/** The material whose hit-sound parameters a blow on `id` plays (follows `sound.same`). */
export function soundRootOf(id: MaterialId): MaterialId {
  const seen: MaterialId[] = [];
  let cur = id;
  for (;;) {
    if (seen.includes(cur)) throw new Error(`materials: sound alias cycle ${[...seen, cur].join(' → ')}`);
    seen.push(cur);
    const s = materialOf(cur).sound;
    if (!('same' in s)) return cur;
    cur = s.same;
  }
}

/** The hit-sound parameters of a blow on `id`. */
export function soundOf(id: MaterialId): MaterialSound {
  return materialOf(soundRootOf(id)).sound as MaterialSound;
}

/**
 * The far side's bands: the definition's own (the wyrm's far hide and glass have their own
 * thresholds), else — with farShift 1 — the ramp stepped down one value (its darkest tone takes the
 * seam step, so the far side never reaches below the material's own cut tone), else the near bands.
 */
export function farOf(def: MaterialDef): ToneBands {
  const d = def.draw;
  if (d.far) return d.far;
  if (d.farShift === 0) return { ramp: d.ramp, th: d.th };
  const r = d.ramp;
  const floor = d.seam === 'stepDown' ? r[0] : (d.seam[r[0]] ?? r[0]);
  return { ramp: [floor, ...r.slice(0, -1)], th: d.th };
}
