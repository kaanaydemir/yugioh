// Deck persistence: 5 save slots + the "last used" choices, in localStorage (or any KV with
// getItem / setItem). Every storage access is wrapped: a blocked / full / corrupt storage never
// throws, the data then lives in memory for the session. A saved deck that names a card that no
// longer exists is repaired on load (the id is dropped and counted in `missing`).
//
//   const store = deckStore();                 // the game-wide singleton
//   store.setSlot(0, { name: 'Benim', cards });
//   const r = store.resolve(store.last('p1')); // { ref, name, cards, check } | null

import { DEFAULT_DECK, type CardId } from '../../data/cards';
import { classicDeck, presetById, presetDecks, repairDeck, validateDeck, type DeckCheck } from '../../data/decks';

export const SLOT_COUNT = 5;
export const NAME_MAX = 14;
export const STORE_KEY = 'neon-duello:decks';
const VERSION = 1;

/** 'klasik' | 'preset:<id>' | 'slot:<n>' */
export type DeckRef = string;
export type LastKey = 'p1' | 'p2' | 'cpu' | 'edit';

export interface SavedDeck {
  name: string;
  cards: CardId[];
  /** Ids dropped on load because the card no longer exists. */
  missing: number;
}

export interface DeckStoreData {
  v: number;
  slots: (SavedDeck | null)[];
  last: Partial<Record<LastKey, DeckRef>>;
}

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ResolvedDeck {
  ref: DeckRef;
  kind: 'klasik' | 'preset' | 'slot';
  name: string;
  cards: CardId[];
  check: DeckCheck;
  missing: number;
}

export const REF_CLASSIC: DeckRef = 'klasik';
export const slotRef = (n: number): DeckRef => `slot:${n}`;
export const presetRef = (id: string): DeckRef => `preset:${id}`;

export function cleanName(raw: unknown, fallback: string): string {
  const s = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) : '';
  return s || fallback;
}

/** Parses stored text into a safe DeckStoreData (anything wrong is dropped, never thrown). */
export function parseStore(text: string | null): DeckStoreData {
  const data: DeckStoreData = { v: VERSION, slots: new Array<SavedDeck | null>(SLOT_COUNT).fill(null), last: {} };
  if (!text) return data;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return data;
  }
  if (!raw || typeof raw !== 'object') return data;
  const o = raw as { slots?: unknown; last?: unknown };
  if (Array.isArray(o.slots)) {
    for (let i = 0; i < SLOT_COUNT; i++) {
      const s = o.slots[i] as { name?: unknown; cards?: unknown } | null | undefined;
      if (!s || typeof s !== 'object' || !Array.isArray(s.cards)) continue;
      const fixed = repairDeck(s.cards);
      data.slots[i] = { name: cleanName(s.name, `Deste ${i + 1}`), cards: fixed.cards, missing: fixed.missing };
    }
  }
  if (o.last && typeof o.last === 'object') {
    for (const k of ['p1', 'p2', 'cpu', 'edit'] as LastKey[]) {
      const v = (o.last as Record<string, unknown>)[k];
      if (typeof v === 'string' && v.length < 40) data.last[k] = v;
    }
  }
  return data;
}

export function serializeStore(d: DeckStoreData): string {
  return JSON.stringify({ v: VERSION, slots: d.slots.map((s) => (s ? { name: s.name, cards: s.cards } : null)), last: d.last });
}

function browserKv(): KV | null {
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    if (!ls) return null;
    // some browsers expose the object but throw on first use (private mode / blocked data)
    const probe = '__neon_probe';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

export class DeckStore {
  private data: DeckStoreData;
  private readonly kv: KV | null;
  /** False once a write failed (the data then only lives in memory). */
  persisted: boolean;

  constructor(kv: KV | null = browserKv()) {
    this.kv = kv;
    this.persisted = !!kv;
    this.data = this.read();
  }

  private read(): DeckStoreData {
    if (!this.kv) return parseStore(null);
    try {
      return parseStore(this.kv.getItem(STORE_KEY));
    } catch {
      this.persisted = false;
      return parseStore(null);
    }
  }

  private write(): void {
    if (!this.kv) return;
    try {
      this.kv.setItem(STORE_KEY, serializeStore(this.data));
    } catch {
      this.persisted = false;
    }
  }

  /** Re-read the storage (another tab saved). */
  reload(): void {
    this.data = this.read();
  }

  slot(n: number): SavedDeck | null {
    return this.data.slots[n] ?? null;
  }

  setSlot(n: number, deck: { name: string; cards: readonly CardId[] } | null): void {
    if (n < 0 || n >= SLOT_COUNT) return;
    this.data.slots[n] = deck ? { name: cleanName(deck.name, `Deste ${n + 1}`), cards: [...deck.cards], missing: 0 } : null;
    this.write();
  }

  last(key: LastKey): DeckRef | undefined {
    return this.data.last[key];
  }

  setLast(key: LastKey, ref: DeckRef): void {
    this.data.last[key] = ref;
    this.write();
  }

  /** Resolve a ref to a deck; null for an empty slot / unknown preset. */
  resolve(ref: DeckRef | undefined): ResolvedDeck | null {
    if (!ref || ref === REF_CLASSIC) {
      if (ref === undefined) return null;
      const cards = classicDeck();
      return { ref: REF_CLASSIC, kind: 'klasik', name: 'Klasik Deste', cards, check: validateDeck(cards), missing: 0 };
    }
    if (ref.startsWith('preset:')) {
      const p = presetById(ref.slice(7));
      return p ? { ref, kind: 'preset', name: p.name, cards: [...p.cards], check: validateDeck(p.cards), missing: 0 } : null;
    }
    if (ref.startsWith('slot:')) {
      const n = Number(ref.slice(5));
      const s = Number.isInteger(n) ? this.slot(n) : null;
      return s ? { ref, kind: 'slot', name: s.name, cards: [...s.cards], check: validateDeck(s.cards), missing: s.missing } : null;
    }
    return null;
  }

  /** Every pickable deck in menu order: classic, the presets, then the filled slots. */
  options(): ResolvedDeck[] {
    const out: ResolvedDeck[] = [this.resolve(REF_CLASSIC)!];
    for (const p of presetDecks()) out.push(this.resolve(presetRef(p.id))!);
    for (let i = 0; i < SLOT_COUNT; i++) {
      const r = this.resolve(slotRef(i));
      if (r) out.push(r);
    }
    return out;
  }
}

let singleton: DeckStore | null = null;

/** The game-wide store (created on first use). */
export function deckStore(): DeckStore {
  if (!singleton) singleton = new DeckStore();
  return singleton;
}

/** Test hook: forget the singleton. */
export function resetDeckStore(): void {
  singleton = null;
}

/**
 * The decks a match starts with. Both sides on the classic deck -> undefined, so the engine keeps
 * its own default (DEFAULT_DECK, or the ?deck=expanded sampler): the untouched default flow.
 */
export function matchDecks(a: ResolvedDeck | null, b: ResolvedDeck | null): [CardId[], CardId[]] | undefined {
  const classic = (r: ResolvedDeck | null) => !r || r.kind === 'klasik';
  if (classic(a) && classic(b)) return undefined;
  return [a ? [...a.cards] : [...DEFAULT_DECK], b ? [...b.cards] : [...DEFAULT_DECK]];
}
