// Card pools and deck factories. The classic game plays DEFAULT_DECK (the original 20 cards, both sides,
// engine default); the 'expanded' pool adds every newer card and builds a seeded 40-card deck per side
// (24 monsters + 16 spells/traps drawn from ALL non-monster cards, so every card gets dealt over seeds).
//
// Selecting the pool (v3 look only; with the v1 look the classic deck is always used):
//   URL  ?deck=expanded          globalThis.__NEON_DECK = 'expanded'
//
// Deck BUILDER rules (validateDeck, docs/DESTE_KURMA.md): DECK_MIN..DECK_MAX cards (40..80), at most 3 copies
// of a card (the five seal pieces: 1 each), monsters >= 40% of the deck, Sv7+ monsters <= 20% of the deck.
// These rules apply to the builder / pickers only: the engine still starts a game with ANY deck.

import { ALL_CARDS, CARDS, DEFAULT_DECK, SEAL_IDS, isMonster, type Attribute, type CardDef, type CardId, type MonsterCardDef } from './cards';
import { makeRng } from '../engine/rng';

export type DeckPool = 'default' | 'expanded';

/** Smallest / largest legal builder deck. */
export const DECK_MIN = 40;
export const DECK_MAX = 80;
/** The default size: presets, the classic doubled deck, the CPU sampler and "Rastgele doldur". */
export const DECK_SIZE = DECK_MIN;
/** Copies of one card allowed (the five seals: 1). */
export const MAX_COPIES = 3;
export const SEAL_COPIES = 1;
/** Sampler split of a 40-card deck. */
export const DECK_MONSTERS = 24;

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

/** Spells/traps in a sampled deck (the rest are monsters). */
export const DECK_SPELLTRAPS = DECK_SIZE - DECK_MONSTERS;

/** True for the five seal pieces (the "Beş Mühür" set). */
export function isSealCard(id: string): boolean {
  return (SEAL_IDS as readonly string[]).includes(id);
}

/** Copies of `id` a deck may hold. */
export function maxCopies(id: string): number {
  return isSealCard(id) ? SEAL_COPIES : MAX_COPIES;
}

function shuffleWith<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** `slots` cards from the shuffled `list`: each card 1 copy, 2 with ~30% chance when `dup(id)` allows. */
function sampleCopies(list: readonly CardId[], slots: number, rng: () => number, dup: (id: CardId) => boolean): CardId[] {
  const out: CardId[] = [];
  for (const id of list) {
    if (out.length >= slots) break;
    out.push(id);
    if (out.length < slots && dup(id) && rng() < 0.3) out.push(id);
  }
  return out;
}

/**
 * Seeded 40-card deck of `side` from the expanded pool: 24 monsters (Sv7+ one copy each, seals one copy,
 * the rest up to two) + 16 spells/traps drawn from ALL non-monster cards. Always passes validateDeck.
 */
export function expandedDeck(seed: number, side: 0 | 1): CardId[] {
  const rng = makeRng((seed ^ Math.imul(side + 1, 0x9e3779b1) ^ 0x5eed5eed) >>> 0);
  const monsters = shuffleWith(ALL_CARDS.filter(isMonster), rng);
  const rest = shuffleWith(ALL_CARDS.filter((c) => !isMonster(c)).map((c) => c.id), rng);
  const lowDup = (id: CardId) => {
    const d = CARDS[id];
    return !isSealCard(id) && !(isMonster(d) && d.level >= DECK_HIGH_LEVEL);
  };
  const picked = sampleCopies(monsters.map((m) => m.id), DECK_MONSTERS, rng, lowDup);
  return [...picked, ...sampleCopies(rest, DECK_SPELLTRAPS, rng, (id) => !isSealCard(id))];
}

/** The two decks of a game for `pool` (undefined: the classic deck for both). */
export function decksFor(pool: DeckPool, seed: number): [CardId[], CardId[]] | undefined {
  if (pool !== 'expanded') return undefined;
  return [expandedDeck(seed, 0), expandedDeck(seed, 1)];
}

// ======================================================================== deck builder rules
// A builder deck (docs/DESTE_KURMA.md): DECK_MIN..DECK_MAX cards, every id at most maxCopies(id) times,
// monsters >= 40% of the deck and monsters of Level >= DECK_HIGH_LEVEL <= 20% (tribute-heavy).
// Both ratios are measured on max(size, DECK_MIN) so a half-built deck is not judged on a tiny size.
// The pool is ALL_CARDS read at call time: nothing here counts cards.

export const DECK_HIGH_LEVEL = 7;
export const MIN_MONSTER_RATIO = 0.4;
export const MAX_HIGH_RATIO = 0.2;
/** Monsters a deck of `size` cards needs. */
export function minMonsters(size: number): number {
  return Math.ceil(Math.max(size, DECK_MIN) * MIN_MONSTER_RATIO);
}
/** Sv7+ monsters a deck of `size` cards may hold. */
export function maxHigh(size: number): number {
  return Math.floor(Math.max(size, DECK_MIN) * MAX_HIGH_RATIO);
}
/** The limits at the smallest legal deck (kept for the UI / tests that quote them). */
export const DECK_MIN_MONSTERS = minMonsters(DECK_MIN);
export const DECK_MAX_HIGH = maxHigh(DECK_MIN);
/** Level-curve buckets: levels 1..7 and "8+". */
export const CURVE_BUCKETS = 8;

export type DeckIssueCode = 'size' | 'copies' | 'unknown' | 'monsters' | 'high';

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
  /** Copies per known card id. */
  counts: Record<string, number>;
  /** Ids held in more copies than maxCopies allows (each listed once). */
  over: string[];
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
  const st: DeckStats = { size: ids.length, monsters: 0, spells: 0, traps: 0, high: 0, curve: new Array<number>(CURVE_BUCKETS).fill(0), counts: {}, over: [], unknown: [] };
  for (const id of ids) {
    if (!isCardId(id)) {
      if (!st.unknown.includes(id)) st.unknown.push(id);
      continue;
    }
    st.counts[id] = (st.counts[id] ?? 0) + 1;
    if (st.counts[id] > maxCopies(id) && !st.over.includes(id)) st.over.push(id);
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

/** Copies of `id` in `ids`. */
export function copiesOf(ids: readonly string[], id: string): number {
  let n = 0;
  for (const x of ids) if (x === id) n++;
  return n;
}

/** The reasons (Turkish) a deck is not playable; `ok` when there are none. */
export function validateDeck(ids: readonly string[]): DeckCheck {
  const stats = deckStats(ids);
  const issues: DeckIssue[] = [];
  if (stats.unknown.length) issues.push({ code: 'unknown', text: `Eksik kart: ${stats.unknown.length} (artık oyunda yok)` });
  if (stats.over.length) {
    const names = stats.over.map((d) => CARDS[d as CardId].name).slice(0, 2).join(', ');
    issues.push({ code: 'copies', text: `Çok kopya: ${names}${stats.over.length > 2 ? '…' : ''} (en çok ${MAX_COPIES}, Mühür ${SEAL_COPIES})` });
  }
  if (stats.size < DECK_MIN) issues.push({ code: 'size', text: `Deste en az ${DECK_MIN} kart olmalı: ${DECK_MIN - stats.size} eksik` });
  else if (stats.size > DECK_MAX) issues.push({ code: 'size', text: `Deste en çok ${DECK_MAX} kart olabilir: ${stats.size - DECK_MAX} fazla` });
  const need = minMonsters(stats.size);
  if (stats.monsters < need) issues.push({ code: 'monsters', text: `En az ${need} canavar gerek (şimdi ${stats.monsters})` });
  const cap = maxHigh(stats.size);
  if (stats.high > cap) issues.push({ code: 'high', text: `En çok ${cap} canavar Sv ${DECK_HIGH_LEVEL}+ olabilir (şimdi ${stats.high})` });
  return { ok: issues.length === 0, issues, stats };
}

/** Would adding `id` to `ids` break a rule that adding more cards can never fix (copies / full / high cap)? */
export function addBlocker(ids: readonly string[], id: CardId): string | null {
  const have = copiesOf(ids, id);
  const lim = maxCopies(id);
  if (have >= lim) return lim === 1 ? 'Bu karttan destede zaten var (en çok 1)' : `Bu karttan en çok ${lim} kopya (zaten ${have})`;
  if (ids.length >= DECK_MAX) return `Deste dolu (${DECK_MAX}/${DECK_MAX})`;
  const d = CARDS[id];
  if (d && isMonster(d) && d.level >= DECK_HIGH_LEVEL) {
    const cap = maxHigh(ids.length + 1);
    if (deckStats(ids).high >= cap) return `En çok ${cap} canavar Sv ${DECK_HIGH_LEVEL}+ olabilir`;
  }
  return null;
}

/**
 * Drops unknown ids and copies beyond maxCopies from anything that claims to be a deck (saved JSON),
 * and cuts the list at DECK_MAX. Order is kept.
 */
export function repairDeck(raw: unknown): { cards: CardId[]; missing: number; repeats: number; trimmed: number } {
  const cards: CardId[] = [];
  const have: Record<string, number> = {};
  let missing = 0;
  let repeats = 0;
  let trimmed = 0;
  if (Array.isArray(raw)) {
    for (const id of raw) {
      if (!isCardId(id)) missing++;
      else if ((have[id] ?? 0) >= maxCopies(id)) repeats++;
      else if (cards.length >= DECK_MAX) trimmed++;
      else {
        have[id] = (have[id] ?? 0) + 1;
        cards.push(id);
      }
    }
  }
  return { cards, missing, repeats, trimmed };
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
 * "Rastgele doldur": keeps the cards already in `current` and adds seeded random ones until the deck holds
 * `target` cards (default DECK_SIZE, clamped to DECK_MIN..DECK_MAX) without breaking a rule. Monsters first
 * (up to the monster minimum, low levels), then about a third spells / traps, never above the high-level cap.
 * Cards with the fewest copies are preferred, so the deck spreads over the pool before it repeats.
 * Returns the new list (the pool may be too small to fill: then as many as fit).
 */
export function autoFillDeck(current: readonly string[], seed: number, pool: readonly CardDef[] = ALL_CARDS, target: number = DECK_SIZE): CardId[] {
  const goal = Math.max(DECK_MIN, Math.min(DECK_MAX, Math.floor(target)));
  const deck: CardId[] = repairDeck(current).cards.slice(0, goal);
  const st = () => deckStats(deck);
  const free = shuffled(pool, seed);
  const take = (pred: (c: CardDef) => boolean): boolean => {
    for (let copies = 0; copies < MAX_COPIES; copies++) {
      const c = free.find((x) => pred(x) && copiesOf(deck, x.id) === copies && addBlocker(deck, x.id) === null);
      if (c) {
        deck.push(c.id);
        return true;
      }
    }
    return false;
  };
  const need = minMonsters(goal);
  while (deck.length < goal && st().monsters < need) if (!take((c) => isMonster(c) && c.level < DECK_HIGH_LEVEL)) break;
  const backRows = Math.max(0, Math.round(goal / 3) - (st().spells + st().traps));
  for (let k = 0; k < backRows && deck.length < goal; k++) if (!take((c) => !isMonster(c))) break;
  while (deck.length < goal) if (!take((c) => isMonster(c))) break;
  while (deck.length < goal) if (!take(() => true)) break;
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

/**
 * Candidates for a preset slot list: every card of `list` (already ranked best first) with up to `copies(c)`
 * copies; copy k of the card at rank i has priority i + k * spread, so strong cards double up before weak
 * ones appear at all.
 */
function copyOrder<T extends CardDef>(list: T[], spread: number, copies: (c: T) => number): T[] {
  const out: { c: T; pri: number }[] = [];
  list.forEach((c, i) => {
    for (let k = 0; k < copies(c); k++) out.push({ c, pri: i + k * spread });
  });
  return out.sort((a, b) => a.pri - b.pri).map((x) => x.c);
}

/** Builds one preset from `pool`: pins first, then back row and monsters by role score; stable order. */
export function buildPreset(def: PresetDef, pool: readonly CardDef[] = ALL_CARDS): Preset {
  const order = new Map(pool.map((c, i) => [c.id, i]));
  const deck: CardId[] = [];
  // pins: two copies each (one for the seals), they are the theme of the deck
  for (const id of def.pins) if (order.has(id) && addBlocker(deck, id) === null) deck.push(id);
  for (const id of def.pins) if (order.has(id) && !isSealCard(id) && deck.length < DECK_SIZE / 2 && addBlocker(deck, id) === null) deck.push(id);
  const backScore = (c: CardDef) => (BACK_SCORE[(c as { effect: string }).effect]?.[def.role] ?? 2) + (def.attribute === 'FIRE' && (c as { effect: string }).effect === 'fieldVolcano' ? 3 : 0);
  const ranked = <T extends CardDef>(list: T[], score: (c: T) => number) => [...list].sort((a, b) => score(b) - score(a) || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const all = [...pool];
  // back row up to the aim (counting pinned spells / traps), best cards first, strong ones doubled
  const backAim = def.backRow * 2;
  const backNow = () => deck.filter((id) => !isMonster(CARDS[id])).length;
  for (const c of copyOrder(ranked(all.filter((c) => !isMonster(c)), backScore), 6, (c) => (backScore(c) >= 5 ? 3 : 2))) {
    if (backNow() >= backAim || deck.length >= DECK_SIZE) break;
    if (addBlocker(deck, c.id) === null && copiesOf(deck, c.id) < 3) deck.push(c.id);
  }
  // monsters: keep at least 10 low-level (<= 4) ones so the deck can summon without tributes; Sv7+ one copy
  const monsters = ranked(all.filter(isMonster), (c) => monsterScore(c, def.role, def.attribute));
  const lowNow = () => deck.filter((id) => { const d = CARDS[id]; return isMonster(d) && d.level <= 4; }).length;
  for (const c of copyOrder(monsters, 8, (m) => (m.level >= DECK_HIGH_LEVEL ? 1 : 3))) {
    if (deck.length >= DECK_SIZE) break;
    if (addBlocker(deck, c.id) !== null) continue;
    const slotsLeft = DECK_SIZE - deck.length - 1;
    if (c.level > 4 && lowNow() + slotsLeft < 10) continue;
    deck.push(c.id);
  }
  // pool too thin for a rule above: top up with anything legal
  for (let copies = 0; copies < MAX_COPIES; copies++)
    for (const c of pool) if (deck.length < DECK_SIZE && copiesOf(deck, c.id) === copies && addBlocker(deck, c.id) === null) deck.push(c.id);
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

/**
 * The classic deck as a plain list (the "Klasik Deste" entry of the pickers): the original 20 cards twice
 * (40 cards, two copies each). The engine's own default (DEFAULT_DECK, 20 cards) is untouched.
 */
export function classicDeck(): CardId[] {
  return [...DEFAULT_DECK, ...DEFAULT_DECK];
}
