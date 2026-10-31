// Batch 2 deck rules (docs/v3/YENI_KARTLAR.md §0.2 / §1 + owner decisions 5 and 6): single-copy cards, the token
// outside the pool, Kutup Hükümdarı as a Sv8 card, the new preset pins.
import { describe, expect, it } from 'vitest';
import { CARDS, COLLECTIBLE_CARDS, isMonster, type CardId } from '../../src/data/cards';
import {
  DECK_MAX,
  EXPANDED_POOL,
  PRESET_DEFS,
  SINGLE_COPY_IDS,
  addBlocker,
  autoFillDeck,
  copiesOf,
  deckStats,
  expandedDeck,
  isSingleCopy,
  maxCopies,
  missingPins,
  presetDecks,
  repairDeck,
  validateDeck,
} from '../../src/data/decks';

const SINGLES: CardId[] = ['well_pail', 'void_eye', 'sweeping_gale', 'winnow_sieve', 'dial_jester'];
const low = COLLECTIBLE_CARDS.filter((c) => isMonster(c) && c.level < 7 && !isSingleCopy(c.id)).map((c) => c.id);
const back = COLLECTIBLE_CARDS.filter((c) => !isMonster(c) && !isSingleCopy(c.id)).map((c) => c.id);

describe('single-copy cards', () => {
  it('Kuyu Kovası, Boşluk Gözü, Süpürge Rüzgarı, Harman Eleği and Kadran Soytarısı: 1 copy', () => {
    expect([...SINGLE_COPY_IDS].sort()).toEqual([...SINGLES].sort());
    for (const id of SINGLES) expect(maxCopies(id), id).toBe(1);
    expect(maxCopies('auger_lance')).toBe(3);
    expect(maxCopies('polar_needle')).toBe(3);
  });

  for (const id of SINGLES)
    it(`${id}: a second copy is a 'copies' issue and is refused by the builder`, () => {
      const base = [...low.slice(0, 20), ...back.slice(0, 18)];
      const two = validateDeck([...base, id, id]);
      expect(two.issues.map((i) => i.code)).toContain('copies');
      expect(two.issues.find((i) => i.code === 'copies')!.text).toContain('tek kopyalık kart 1');
      expect(validateDeck([...base, id, low[0]]).ok).toBe(true);
      expect(addBlocker([id], id)).toMatch(/en çok 1/);
      expect(repairDeck([id, id, id]).cards).toEqual([id]);
    });

  it('autoFillDeck never adds a second copy (draw engine + seal deck), over many seeds and sizes', () => {
    const seed0: CardId[] = ['seal_head', 'seal_arm_r', 'seal_arm_l', 'seal_leg_r', 'seal_leg_l', 'well_pail', 'winnow_sieve'];
    for (let seed = 1; seed <= 25; seed++)
      for (const target of [40, 60, 80]) {
        const d = autoFillDeck(seed0, seed, COLLECTIBLE_CARDS, target);
        for (const id of SINGLES) expect(copiesOf(d, id), `${id} seed ${seed}`).toBeLessThanOrEqual(1);
        expect(validateDeck(d).ok, `seed ${seed} target ${target}`).toBe(true);
      }
  });

  it('the expanded sampler never deals two copies of a single-copy card', () => {
    for (let seed = 1; seed <= 60; seed++)
      for (const side of [0, 1] as const) {
        const d = expandedDeck(seed, side);
        for (const id of SINGLES) expect(copiesOf(d, id)).toBeLessThanOrEqual(1);
        expect(validateDeck(d).ok).toBe(true);
      }
  });
});

describe('pool and presets with batch 2', () => {
  it('the straw token is never in the pool, the stats or a repaired deck', () => {
    expect(EXPANDED_POOL).not.toContain('straw_decoy_token');
    expect(deckStats(['straw_decoy_token']).unknown).toEqual([]); // a real card id (it exists) …
    expect(addBlocker([], 'straw_decoy_token')).toBeNull(); // … the builder never lists it (pool = COLLECTIBLE_CARDS)
    expect(COLLECTIBLE_CARDS.some((c) => c.id === 'straw_decoy_token')).toBe(false);
  });

  it('Kutup Hükümdarı counts as a Sv7+ (Level 8) monster', () => {
    const st = deckStats(['polar_sovereign']);
    expect(st.high).toBe(1);
    expect(st.curve[7]).toBe(1);
    expect((CARDS.polar_sovereign as { level: number }).level).toBe(8);
  });

  it('the suggested pins exist and are in their presets (no Yaldızlı Kafes); every preset stays legal', () => {
    const pins: Record<string, CardId[]> = {
      ates: ['scrap_raiders', 'spite_axe'],
      su: ['tide_harpooner', 'reed_heron', 'tidal_bay', 'auger_lance'],
      isik: ['well_pail', 'winnow_sieve', 'reflection_archer'],
      toprak: ['mudgrasp_spirit', 'straw_decoys'],
      dengeli: ['void_eye', 'puppet_string'],
    };
    for (const def of PRESET_DEFS) expect(missingPins(def), def.id).toEqual([]);
    for (const p of presetDecks()) {
      for (const id of pins[p.id] ?? []) expect(p.cards, `${p.id} ${id}`).toContain(id);
      expect(validateDeck(p.cards).ok, p.id).toBe(true);
      expect(p.cards.length).toBeLessThanOrEqual(DECK_MAX);
      for (const id of SINGLES) expect(copiesOf(p.cards, id)).toBeLessThanOrEqual(1);
    }
  });
});
