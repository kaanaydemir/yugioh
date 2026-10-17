// Monster art registry. Each monster lives in its own file `./<monster_id>.ts`
// with `export default` a MonsterArt. Files are discovered automatically.
//
// v3 look (?look=v3, docs/ANIMASYON_PLANI.md): a redrawn monster lives in
// `src/art/monsters-v3/<monster_id>.ts` (same contract, `export default` a MonsterArt). Under the v3
// look monsterArt(id) returns it when it exists; a monster without v3 art keeps its old art. Without
// the switch the v3 files are never used.

import type { MonsterId } from '../../data/cards';
import { MONSTER_IDS } from '../../data/cards';
import type { MonsterArt } from '../types';
import { LOOK_V3 } from '../../view/layout';
import { placeholderMonster } from './_placeholder';

const modules = import.meta.glob<{ default: MonsterArt }>(['./*.ts', '!./index.ts', '!./_*.ts'], { eager: true });

const REGISTRY = new Map<MonsterId, MonsterArt>();
for (const [path, mod] of Object.entries(modules)) {
  const art = mod.default;
  if (art && art.id) REGISTRY.set(art.id, art);
}

const v3Modules = import.meta.glob<{ default: MonsterArt }>(['../monsters-v3/*.ts', '!../monsters-v3/_*.ts'], { eager: true });

const REGISTRY_V3 = new Map<MonsterId, MonsterArt>();
for (const mod of Object.values(v3Modules)) {
  const art = mod.default;
  if (art && art.id) REGISTRY_V3.set(art.id, art);
}

export function monsterArt(id: MonsterId): MonsterArt {
  if (LOOK_V3) {
    const v3 = REGISTRY_V3.get(id);
    if (v3) return v3;
  }
  return REGISTRY.get(id) ?? placeholderMonster(id);
}

/** The pre-v3 art of a monster, whatever the look (tools, comparisons). */
export function monsterArtV1(id: MonsterId): MonsterArt {
  return REGISTRY.get(id) ?? placeholderMonster(id);
}

/** The v3 (redrawn) art of a monster, whatever the look, or null if it has none yet. */
export function monsterArtV3(id: MonsterId): MonsterArt | null {
  return REGISTRY_V3.get(id) ?? null;
}

/** True when the monster has v3 (redrawn) art. */
export function hasMonsterArtV3(id: MonsterId): boolean {
  return REGISTRY_V3.has(id);
}

export function hasMonsterArt(id: MonsterId): boolean {
  return REGISTRY.has(id);
}

export function allMonsterArt(): MonsterArt[] {
  return MONSTER_IDS.map(monsterArt);
}
