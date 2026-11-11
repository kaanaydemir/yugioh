// Pure model of the builder's requirement meters (the bar under the title): one meter per rule of
// validateDeck — deck size, monster share, Lv7+ share, copy limits — with a fill, a met flag and the
// detailed reasons for the meter's tooltip. No Phaser here: tests/deck/builder_model.test.ts.

import { CARDS, type CardId } from '../../data/cards';
import { DECK_HIGH_LEVEL, DECK_MAX, DECK_MIN, MAX_COPIES, MAX_HIGH_RATIO, MIN_MONSTER_RATIO, maxHigh, minMonsters, validateDeck } from '../../data/decks';

export type MeterKey = 'cards' | 'monsters' | 'high' | 'copies';

export interface Meter {
  key: MeterKey;
  /** The word before the numbers ("Cards"). */
  label: string;
  /** The numbers ("34/40"); '' when the label says it all. */
  value: string;
  /** 0..1 */
  fill: number;
  met: boolean;
  /** Tooltip lines: the rule, then what is wrong (if anything). */
  tip: string[];
}

export interface MeterExtra {
  /** Cards dropped on load (no longer in the game). */
  missing?: number;
  /** Copies of retired cards swapped on load. */
  replaced?: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function deckMeters(cards: readonly string[], extra: MeterExtra = {}): Meter[] {
  const v = validateDeck(cards);
  const st = v.stats;
  const n = st.size;
  const issue = (code: string) => v.issues.filter((i) => i.code === code).map((i) => i.text);

  const sizeMet = n >= DECK_MIN && n <= DECK_MAX;
  const cards1: Meter = {
    key: 'cards',
    label: 'Cards',
    value: n <= DECK_MIN ? `${n}/${DECK_MIN}` : `${n}/${DECK_MAX}`,
    fill: n <= DECK_MIN ? clamp01(n / DECK_MIN) : 1,
    met: sizeMet,
    tip: [`A deck holds ${DECK_MIN}-${DECK_MAX} cards.`, ...issue('size'), ...(sizeMet ? [`${n} cards: OK.`] : [])],
  };

  const need = minMonsters(n);
  const monsters: Meter = {
    key: 'monsters',
    label: 'Monsters',
    value: `${st.monsters}/${need}`,
    fill: clamp01(st.monsters / need),
    met: st.monsters >= need,
    tip: [`At least ${Math.round(MIN_MONSTER_RATIO * 100)}% monsters (${minMonsters(DECK_MIN)} in ${DECK_MIN} cards, ${minMonsters(DECK_MAX)} in ${DECK_MAX}).`, ...issue('monsters')],
  };

  const cap = maxHigh(n);
  const high: Meter = {
    key: 'high',
    label: `Lv${DECK_HIGH_LEVEL}+`,
    value: `${st.high}/${cap}`,
    fill: clamp01(st.high / cap),
    met: st.high <= cap,
    tip: [`At most ${Math.round(MAX_HIGH_RATIO * 100)}% monsters of Lv ${DECK_HIGH_LEVEL}+ (${maxHigh(DECK_MIN)} in ${DECK_MIN} cards).`, ...issue('high')],
  };

  const distinct = Object.keys(st.counts).length;
  const bad = st.over.length + st.unknown.length;
  const lost: string[] = [];
  if (extra.missing) lost.push(`Missing cards: ${extra.missing} (removed from the game, dropped).`);
  if (extra.replaced) lost.push(`Retired cards: ${extra.replaced} cop${extra.replaced === 1 ? 'y' : 'ies'} swapped for a similar card. Save to clear.`);
  const overNames = st.over.map((id) => CARDS[id as CardId]?.name ?? id);
  const copies: Meter = {
    key: 'copies',
    label: `Max ${MAX_COPIES} copies`,
    value: '',
    fill: bad ? clamp01((distinct - st.over.length) / Math.max(1, distinct + st.unknown.length)) : 1,
    met: bad === 0,
    tip: [
      `Max ${MAX_COPIES} copies of a card. Seals and single-copy cards: 1.`,
      ...issue('copies'),
      ...(overNames.length > 2 ? [`All of them: ${overNames.join(', ')}`] : []),
      ...issue('unknown'),
      ...lost,
    ],
  };
  return [cards1, monsters, high, copies];
}
