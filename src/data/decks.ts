// Card pools and deck factories. The classic game always plays DEFAULT_DECK (20 cards, both sides);
// the 'expanded' pool adds every newer card and builds a seeded 20-card deck per side.
//
// Selecting the pool (v3 look only; with the v1 look the classic deck is always used):
//   URL  ?deck=expanded          globalThis.__NEON_DECK = 'expanded'
// TODO(deck builder): the real deck-builder UI replaces the sampler (docs/KART_TASLAGI_CANAVAR.md).
//
// Rules for a deck: every card id at most once (the five seals are five different cards, so a
// 20-card sample may hold any subset of them). The sampler keeps all spells + traps (so the rules
// stay covered) and draws 12 monsters from the whole monster roster with the seeded generator.

import { ALL_CARDS, CARDS, DEFAULT_DECK, SEAL_IDS, isMonster, type Attribute, type CardDef, type CardId, type MonsterCardDef } from './cards';
import { makeRng } from '../engine/rng';

export type DeckPool = 'default' | 'expanded';

export const DECK_SIZE = 20;
export const DECK_MONSTERS = 12;

/** Every card of the 'expanded' pool (monsters, spells and traps). */
export const EXPANDED_POOL: readonly CardId[] = ALL_CARDS.map((c) => c.id);

/** Detects the pool of this page: expanded only with the v3 look and `?deck=expanded` / `__NEON_DECK`. */
export function detectDeckPool(): DeckPool {
  try {
    const g = globalThis as { __NEON_DECK?: unknown; __NEON_LOOK?: unknown };
    let look: unknown = g.__NEON_LOOK;
    let deck: unknown = g.__NEON_DECK;
    if (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined') {
      const q = new URLSearchParams(location.search);
      if (look !== 'v1' && look !== 'v3') look = q.get('look');
      if (deck !== 'expanded' && deck !== 'default') deck = q.get('deck');
    }
    return look === 'v3' && deck === 'expanded' ? 'expanded' : 'default';
  } catch {
    return 'default';
  }
}

/** Seeded 20-card deck of `side` from the expanded pool: all non-monsters + 12 distinct monsters. */
export function expandedDeck(seed: number, side: 0 | 1): CardId[] {
  const rng = makeRng((seed ^ Math.imul(side + 1, 0x9e3779b1) ^ 0x5eed5eed) >>> 0);
  const monsters = ALL_CARDS.filter(isMonster).map((c) => c.id);
  const rest = ALL_CARDS.filter((c) => !isMonster(c)).map((c) => c.id);
  for (let i = monsters.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [monsters[i], monsters[j]] = [monsters[j], monsters[i]];
  }
  return [...monsters.slice(0, DECK_MONSTERS), ...rest].slice(0, DECK_SIZE);
}

/** The two decks of a game for `pool` (undefined: the classic deck for both). */
export function decksFor(pool: DeckPool, seed: number): [CardId[], CardId[]] | undefined {
  if (pool !== 'expanded') return undefined;
  return [expandedDeck(seed, 0), expandedDeck(seed, 1)];
}

// ======================================================================== deck builder rules
// A builder deck (docs/DESTE_KURMA.md): exactly DECK_SIZE cards, every id at most once (singleton),
// at least DECK_MIN_MONSTERS monsters and at most DECK_MAX_HIGH monsters of Level >= DECK_HIGH_LEVEL
// (tribute-heavy). The pool is ALL_CARDS read at call time: nothing here counts cards.

export const DECK_MIN_MONSTERS = 6;
export const DECK_HIGH_LEVEL = 7;
export const DECK_MAX_HIGH = 4;
/** Level-curve buckets: levels 1..7 and "8+". */
export const CURVE_BUCKETS = 8;

export type DeckIssueCode = 'size' | 'dupe' | 'unknown' | 'monsters' | 'high';

export interface DeckIssue {
  code: DeckIssueCode;
  /** Turkish reason shown in the builder. */
  text: string;
}

export interface DeckStats {
  size: number;
  monsters: number;
  spells: number;
  traps: number;
  /** Monsters of Level >= DECK_HIGH_LEVEL. */
  high: number;
  /** Monsters per level: index 0 = Level 1 ... index 7 = Level 8 and up. */
  curve: number[];
  /** Ids present more than once (each listed once). */
  dupes: string[];
  /** Ids that are not in the card pool (a saved deck after a card was removed). */
  unknown: string[];
}

export interface DeckCheck {
  ok: boolean;
  issues: DeckIssue[];
  stats: DeckStats;
}

export function isCardId(id: unknown): id is CardId {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(CARDS, id);
}

export function deckStats(ids: readonly string[]): DeckStats {
  const st: DeckStats = { size: ids.length, monsters: 0, spells: 0, traps: 0, high: 0, curve: new Array<number>(CURVE_BUCKETS).fill(0), dupes: [], unknown: [] };
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      if (!st.dupes.includes(id)) st.dupes.push(id);
    }
    seen.add(id);
    if (!isCardId(id)) {
      if (!st.unknown.includes(id)) st.unknown.push(id);
      continue;
    }
    const d = CARDS[id];
    if (isMonster(d)) {
      st.monsters++;
      if (d.level >= DECK_HIGH_LEVEL) st.high++;
      st.curve[Math.min(CURVE_BUCKETS, Math.max(1, d.level)) - 1]++;
    } else if (d.kind === 'spell') st.spells++;
    else st.traps++;
  }
  return st;
}

/** The reasons (Turkish) a deck is not playable; `ok` when there are none. */
export function validateDeck(ids: readonly string[]): DeckCheck {
  const stats = deckStats(ids);
  const issues: DeckIssue[] = [];
  if (stats.unknown.length) issues.push({ code: 'unknown', text: `Eksik kart: ${stats.unknown.length} (artık oyunda yok)` });
  if (stats.dupes.length) {
    const names = stats.dupes.map((d) => (isCardId(d) ? CARDS[d].name : d)).slice(0, 2).join(', ');
    issues.push({ code: 'dupe', text: `Her karttan en çok 1 tane: ${names}${stats.dupes.length > 2 ? '…' : ''}` });
  }
  if (stats.size < DECK_SIZE) issues.push({ code: 'size', text: `Deste ${DECK_SIZE} kart olmalı: ${DECK_SIZE - stats.size} eksik` });
  else if (stats.size > DECK_SIZE) issues.push({ code: 'size', text: `Deste ${DECK_SIZE} kart olmalı: ${stats.size - DECK_SIZE} fazla` });
  if (stats.monsters < DECK_MIN_MONSTERS) issues.push({ code: 'monsters', text: `En az ${DECK_MIN_MONSTERS} canavar gerekir (şimdi ${stats.monsters})` });
  if (stats.high > DECK_MAX_HIGH) issues.push({ code: 'high', text: `En çok ${DECK_MAX_HIGH} canavar Sv ${DECK_HIGH_LEVEL}+ olabilir (şimdi ${stats.high})` });
  return { ok: issues.length === 0, issues, stats };
}

/** Would adding `id` to `ids` break a rule that adding more cards can never fix (dupe / too many / high cap)? */
export function addBlocker(ids: readonly string[], id: CardId): string | null {
  if (ids.includes(id)) return 'Bu kart destede zaten var';
  if (ids.length >= DECK_SIZE) return `Deste dolu (${DECK_SIZE}/${DECK_SIZE})`;
  const d = CARDS[id];
  if (d && isMonster(d) && d.level >= DECK_HIGH_LEVEL && deckStats(ids).high >= DECK_MAX_HIGH) return `En çok ${DECK_MAX_HIGH} canavar Sv ${DECK_HIGH_LEVEL}+ olabilir`;
  return null;
}

/** True for the five seal pieces (the "Beş Mühür" set). */
export function isSealCard(id: string): boolean {
  return (SEAL_IDS as readonly string[]).includes(id);
}

/** Drops unknown ids and repeats from anything that claims to be a deck (saved JSON). */
export function repairDeck(raw: unknown): { cards: CardId[]; missing: number; repeats: number } {
  const cards: CardId[] = [];
  let missing = 0;
  let repeats = 0;
  if (Array.isArray(raw)) {
    for (const id of raw) {
      if (!isCardId(id)) missing++;
      else if (cards.includes(id)) repeats++;
      else cards.push(id);
    }
  }
  return { cards, missing, repeats };
}

/** Deterministic Fisher-Yates over a copy. */
function shuffled<T>(list: readonly T[], seed: number): T[] {
  const rng = makeRng(seed >>> 0);
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * "Rastgele doldur": keeps the cards already in `current` and adds seeded random ones until the
 * deck holds DECK_SIZE cards without breaking a rule. Monsters first (up to DECK_MIN_MONSTERS,
 * low levels), then about a third spells / traps, never above the high-level cap. Returns the new
 * list (the pool may be too small to fill: then as many as fit).
 */
export function autoFillDeck(current: readonly string[], seed: number, pool: readonly CardDef[] = ALL_CARDS): CardId[] {
  const deck: CardId[] = repairDeck(current).cards.slice(0, DECK_SIZE);
  const st = () => deckStats(deck);
  const free = shuffled(pool.filter((c) => !deck.includes(c.id)), seed);
  const take = (pred: (c: CardDef) => boolean): boolean => {
    const i = free.findIndex((c) => pred(c) && addBlocker(deck, c.id) === null);
    if (i < 0) return false;
    deck.push(free.splice(i, 1)[0].id);
    return true;
  };
  while (deck.length < DECK_SIZE && st().monsters < DECK_MIN_MONSTERS) if (!take((c) => isMonster(c) && c.level < DECK_HIGH_LEVEL)) break;
  const backRows = Math.max(0, Math.round(DECK_SIZE / 3) - (st().spells + st().traps));
  for (let k = 0; k < backRows && deck.length < DECK_SIZE; k++) if (!take((c) => !isMonster(c))) break;
  while (deck.length < DECK_SIZE) if (!take((c) => isMonster(c))) break;
  while (deck.length < DECK_SIZE) if (!take(() => true)) break;
  return deck;
}

// ======================================================================== preset decks
// Six themed starter / CPU decks. Each is a recipe: a few pinned cards plus a deterministic,
// role-weighted pick from the CURRENT pool (so new cards flow in), always legal by validateDeck.

export type PresetRole = 'aggro' | 'control' | 'support' | 'seal' | 'defense' | 'balanced';

export interface PresetDef {
  id: string;
  name: string;
  /** One Turkish line shown in the picker. */
  blurb: string;
  role: PresetRole;
  /** Preferred element (a bonus in the monster ranking). */
  attribute?: Attribute;
  /** Cards that must be in (all of them must exist: the preset test fails loudly otherwise). */
  pins: CardId[];
  /** How many spells + traps the deck aims for. */
  backRow: number;
}

export interface Preset {
  id: string;
  name: string;
  blurb: string;
  cards: CardId[];
}

export const PRESET_DEFS: readonly PresetDef[] = [
  { id: 'ates', name: 'Ateş Saldırı', blurb: 'Yüksek ATK, yakıp geçen hızlı saldırılar.', role: 'aggro', attribute: 'FIRE', pins: ['magma_titan', 'ember_wolf', 'storm_hawk', 'shade_assassin', 'judgment_bolt', 'dragon_blade', 'volcano_arena'], backRow: 6 },
  { id: 'su', name: 'Su Kontrol', blurb: 'Tuzaklar, delici hasar ve sabırlı savunma.', role: 'control', attribute: 'WATER', pins: ['coral_serpent', 'tide_golem', 'mirror_barrier', 'chains_of_light', 'chasm_trap', 'thorn_lurker'], backRow: 8 },
  { id: 'isik', name: 'Işık Destek', blurb: 'Can kazan, kartları geri getir, uzun oyna.', role: 'support', attribute: 'LIGHT', pins: ['crystal_wyrm', 'lumen_sprite', 'volt_lizard', 'hourglass_imp', 'healing_spring', 'soul_recall'], backRow: 7 },
  { id: 'muhur', name: 'Karanlık Mühür', blurb: 'Beş Mühür parçasını elde topla, anında kazan.', role: 'seal', attribute: 'DARK', pins: [...SEAL_IDS, 'wisp_imp', 'steel_silencer', 'soul_recall'], backRow: 5 },
  { id: 'toprak', name: 'Toprak Savunma', blurb: 'Kalın DEF, sağlam muhafızlar, geç ama kesin.', role: 'defense', attribute: 'EARTH', pins: ['stone_sentinel', 'shield_titan', 'thorn_lurker', 'windmane_knight', 'mirror_barrier', 'healing_spring'], backRow: 7 },
  { id: 'dengeli', name: 'Dengeli', blurb: 'Her elementten biraz; her duruma bir cevap.', role: 'balanced', pins: ['crystal_wyrm', 'abyss_magus', 'magma_titan', 'coral_serpent', 'ember_wolf', 'judgment_bolt', 'mirror_barrier'], backRow: 7 },
];

/** Back-row ranking per role, keyed by effect (unknown effects score 2). */
const BACK_SCORE: Record<string, Partial<Record<PresetRole, number>>> = {
  destroyOpponentMonster: { aggro: 7, control: 5, balanced: 5, defense: 3, support: 3, seal: 2 },
  gain1000: { support: 7, defense: 5, balanced: 4, control: 3, aggro: 1, seal: 2 },
  reviveFromGraveyard: { support: 6, seal: 4, balanced: 4, aggro: 3, control: 3, defense: 3 },
  equipAtk700: { aggro: 7, balanced: 3, support: 2, defense: 1, control: 1, seal: 2 },
  fieldVolcano: { aggro: 5, balanced: 3, control: 1, support: 1, defense: 1, seal: 1 },
  attackDestroyAllAttackPosition: { control: 7, defense: 6, balanced: 5, support: 3, aggro: 2, seal: 3 },
  attackNegateEndBattle: { control: 6, defense: 6, balanced: 4, support: 4, aggro: 2, seal: 4 },
  summonDestroy1000Plus: { control: 6, balanced: 4, defense: 4, aggro: 3, support: 2, seal: 3 },
};

const CONTROL_FX = new Set(['flipDestroyMonster', 'tributeSummonDestroySpellTrap', 'trapLock', 'declareAtkDebuff400', 'summonFreezeAttack', 'defenseAttackedBurn300']);
const SUPPORT_FX = new Set(['normalSummonGain500', 'summonFreezeAttack', 'windAura300', 'destroyedByBattleBurn500', 'ownSpellBurn300']);
const AGGRO_FX = new Set(['directAttack', 'piercing', 'battleDestroyBurn300', 'summonBurn500', 'summonTurnAtk500']);
const SEAL_FX = new Set(['noBattleDamageOnDestroy', 'trapLock', 'summonFreezeAttack']);
const DEFENSE_FX = new Set(['defenseAttackedBurn300', 'defenseAtkDebuff500', 'flipDestroyMonster']);

function monsterScore(d: MonsterCardDef, role: PresetRole, attr: Attribute | undefined): number {
  let s: number;
  switch (role) {
    case 'aggro':
      s = d.atk / 100 + (AGGRO_FX.has(d.effect) ? 6 : 0);
      break;
    case 'control':
      s = d.def / 160 + d.atk / 300 + (CONTROL_FX.has(d.effect) ? 8 : 0);
      break;
    case 'support':
      s = (d.atk + d.def) / 400 + (SUPPORT_FX.has(d.effect) ? 8 : 0);
      break;
    case 'seal':
      s = (SEAL_FX.has(d.effect) ? 8 : 0) + (d.atk + d.def) / 500 - d.level * 0.5;
      break;
    case 'defense':
      s = d.def / 100 + (DEFENSE_FX.has(d.effect) ? 6 : 0);
      break;
    default:
      s = (d.atk + d.def) / 200;
  }
  if (attr && d.attribute === attr) s += 14;
  if (d.level >= DECK_HIGH_LEVEL) s -= 3;
  return s;
}

/** Cards of `def.pins` that are not in the pool (empty for a healthy preset). */
export function missingPins(def: PresetDef, pool: readonly CardDef[] = ALL_CARDS): CardId[] {
  const ids = new Set(pool.map((c) => c.id));
  return def.pins.filter((id) => !ids.has(id));
}

/** Builds one preset from `pool`: pins first, then back row and monsters by role score; stable order. */
export function buildPreset(def: PresetDef, pool: readonly CardDef[] = ALL_CARDS): Preset {
  const order = new Map(pool.map((c, i) => [c.id, i]));
  const deck: CardId[] = [];
  for (const id of def.pins) if (order.has(id) && addBlocker(deck, id) === null) deck.push(id);
  const backScore = (c: CardDef) => (BACK_SCORE[(c as { effect: string }).effect]?.[def.role] ?? 2) + (def.attribute === 'FIRE' && (c as { effect: string }).effect === 'fieldVolcano' ? 3 : 0);
  const ranked = <T extends CardDef>(list: T[], score: (c: T) => number) => [...list].sort((a, b) => score(b) - score(a) || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const free = pool.filter((c) => !deck.includes(c.id));
  // back row up to the aim (counting pinned spells / traps)
  const backNow = () => deck.filter((id) => !isMonster(CARDS[id])).length;
  for (const c of ranked(free.filter((c) => !isMonster(c)), backScore)) {
    if (backNow() >= def.backRow || deck.length >= DECK_SIZE) break;
    deck.push(c.id);
  }
  // monsters: keep at least 5 low-level (<= 4) ones so the deck can summon without tributes
  const monsters = ranked(free.filter(isMonster), (c) => monsterScore(c, def.role, def.attribute));
  const lowNow = () => deck.filter((id) => { const d = CARDS[id]; return isMonster(d) && d.level <= 4; }).length;
  for (const c of monsters) {
    if (deck.length >= DECK_SIZE) break;
    if (deck.includes(c.id) || addBlocker(deck, c.id) !== null) continue;
    const slotsLeft = DECK_SIZE - deck.length - 1;
    if (c.level > 4 && lowNow() + slotsLeft < 5) continue;
    deck.push(c.id);
  }
  // pool too thin for a rule above: top up with anything legal
  for (const c of pool) if (deck.length < DECK_SIZE && !deck.includes(c.id) && addBlocker(deck, c.id) === null) deck.push(c.id);
  deck.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  return { id: def.id, name: def.name, blurb: def.blurb, cards: deck };
}

let presetCache: Preset[] | null = null;
let presetCachePool = -1;

/** The six presets built from the current pool (cached until the pool changes). */
export function presetDecks(): readonly Preset[] {
  if (!presetCache || presetCachePool !== ALL_CARDS.length) {
    presetCache = PRESET_DEFS.map((d) => buildPreset(d));
    presetCachePool = ALL_CARDS.length;
  }
  return presetCache;
}

export function presetById(id: string): Preset | undefined {
  return presetDecks().find((p) => p.id === id);
}

/** The classic 20-card deck as a plain list (the "Klasik Deste" entry of the pickers). */
export function classicDeck(): CardId[] {
  return [...DEFAULT_DECK];
}
