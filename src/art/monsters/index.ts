// Monster art registry. Each monster lives in its own file `./<monster_id>.ts`
// with `export default` a MonsterArt. Files are discovered automatically.

import type { MonsterId } from '../../data/cards';
import { MONSTER_IDS } from '../../data/cards';
import type { MonsterArt } from '../types';
import { placeholderMonster } from './_placeholder';

const modules = import.meta.glob<{ default: MonsterArt }>(['./*.ts', '!./index.ts', '!./_*.ts'], { eager: true });

const REGISTRY = new Map<MonsterId, MonsterArt>();
for (const [path, mod] of Object.entries(modules)) {
  const art = mod.default;
  if (art && art.id) REGISTRY.set(art.id, art);
}

export function monsterArt(id: MonsterId): MonsterArt {
  return REGISTRY.get(id) ?? placeholderMonster(id);
}

export function hasMonsterArt(id: MonsterId): boolean {
  return REGISTRY.has(id);
}

export function allMonsterArt(): MonsterArt[] {
  return MONSTER_IDS.map(monsterArt);
}
