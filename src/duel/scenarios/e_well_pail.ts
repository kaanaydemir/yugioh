// Lane E — Kuyu Kovası (well_pail) film / QA stages (docs/v3/YENI_KARTLAR.md §7 S1). Every stage is a 5 + 5 board.
//   node tools/shot.mjs "?dev=duel&s=eWellPail&look=v3" --fresh --film 30 --every 100 --cols 6 --out shots/e/well_pail/take.png
// The caster holds a few cards so the two drawn cards land in a real hand fan; the deck's top two cards are
// named so the hand landing can be read in the film. P2 stages are the mirrored twins (active: 1).
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';

const pail = (p: PlayerId): Step => (D) => ({ type: 'activateSpell', player: p, uid: D.uid('well_pail', p) }) as Action;

const HAND: CardId[] = ['ember_wolf', 'well_pail', 'tide_golem'];
const DECK: CardId[] = ['crystal_wyrm', 'judgment_bolt', 'reed_heron', 'kite_fencer', 'stone_sentinel'];
/** Four seals in the hand, the fifth on top of the deck: the first draw wins the duel (no second draw). */
const SEAL_HAND: CardId[] = ['seal_head', 'seal_arm_r', 'seal_arm_l', 'seal_leg_r', 'well_pail'];
const SEAL_DECK: CardId[] = ['seal_leg_l', 'reed_heron', 'stone_sentinel', 'kite_fencer'];

function hand(p: PlayerId): Scenario['stage'] {
  const me = { hand: HAND, deck: DECK, monsters: [null, 'crag_axeman', null, null, null] as (CardId | null)[] };
  const them = { monsters: [null, null, 'magma_titan', null, null] as (CardId | null)[] };
  return p === 0 ? { zones: 5, p0: me, p1: them } : { zones: 5, active: 1, p1: me, p0: them };
}

function set(p: PlayerId): Scenario['stage'] {
  const me = { hand: ['ember_wolf', 'tide_golem'] as CardId[], deck: DECK, spellTraps: [null, null, 'well_pail', null, null] as (CardId | null)[], monsters: [null, 'reed_heron'] as (CardId | null)[] };
  const them = { monsters: [null, null, 'shade_assassin'] as (CardId | null)[] };
  return p === 0 ? { zones: 5, p0: me, p1: them } : { zones: 5, active: 1, p1: me, p0: them };
}

function seals(p: PlayerId): Scenario['stage'] {
  const me = { hand: SEAL_HAND, deck: SEAL_DECK };
  const them = { monsters: [null, 'crystal_wyrm'] as (CardId | null)[] };
  return p === 0 ? { zones: 5, p0: me, p1: them } : { zones: 5, active: 1, p1: me, p0: them };
}

const PACK: Record<string, Scenario> = {
  eWellPail: { desc: 'Kuyu Kovası (P1, elden): kuyu, çıkrık, kova; iki kart balık gibi ele sıçrar', stage: hand(0), steps: [pail(0)] },
  eWellPailP2: { desc: 'Kuyu Kovası (P2, elden): aynalı', stage: hand(1), steps: [pail(1)] },
  eWellPailSet: { desc: 'Kuyu Kovası kapalıdan (P1): kuyu kartın kendi karosunda', stage: set(0), steps: [pail(0)] },
  eWellPailSetP2: { desc: 'Kuyu Kovası kapalıdan (P2): kuyu kartın kendi karosunda', stage: set(1), steps: [pail(1)] },
  eWellPailSeal: { desc: 'Kuyu Kovası (P1): ilk çekilen kart beşinci mühür — düello kazanılır, ikinci çekiş yok', stage: seals(0), steps: [pail(0)] },
  eWellPailSealP2: { desc: 'Kuyu Kovası (P2): ilk çekilen kart beşinci mühür — düello kazanılır', stage: seals(1), steps: [pail(1)] },
  // a person plays it with the mouse (the hand fan, the hover, then the card)
  eWellPailPlay: { desc: 'Kuyu Kovası (P1): elle oyna', stage: hand(0), steps: [] },
};

export default PACK;
