// Lane E — Harman Eleği (winnow_sieve) film / QA stages (docs/v3/YENI_KARTLAR.md §7 S5). Every stage is a 5 + 5 board.
//   node tools/shot.mjs "?dev=duel&s=eSieve&look=v3" --fresh --film 30 --every 100 --cols 6 --out shots/e/winnow_sieve/take.png
// The caster holds two cards besides the sieve, so after the three draws the hand fans five cards and the choice is
// real. The "Auto" stages pick for the human (the discard action is dispatched after a short wait, so the sieve's
// waiting pose is filmed); eSieveUi clicks the two cards and confirms like a person. P2 stages are the mirrored
// twins (active: 1).
import type { Scenario, Step, UiStep } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';

const sieve = (p: PlayerId): Step => (D) => ({ type: 'activateSpell', player: p, uid: D.uid('winnow_sieve', p) }) as Action;
/** Discard two cards of `p`'s hand (by card id; looked up after the draws). */
const toss = (p: PlayerId, a: CardId, b: CardId): Step => (D) => ({ type: 'discard', player: p, uids: [D.uid(a, p), D.uid(b, p)] }) as Action;
const pause = (ms: number): UiStep => ({ ui: 'wait', ms });

const HAND: CardId[] = ['ember_wolf', 'winnow_sieve', 'tide_golem'];
/** deck[0] is drawn first: three named cards, then filler. */
const DECK: CardId[] = ['crystal_wyrm', 'judgment_bolt', 'reed_heron', 'kite_fencer', 'stone_sentinel'];
/** Four seals in the hand, the fifth on top of the deck: the first draw wins (no more draws, no discard). */
const SEAL_HAND: CardId[] = ['seal_head', 'seal_arm_r', 'seal_arm_l', 'seal_leg_r', 'winnow_sieve'];
const SEAL_DECK: CardId[] = ['seal_leg_l', 'reed_heron', 'stone_sentinel', 'kite_fencer'];

function hand(p: PlayerId): Scenario['stage'] {
  const me = { hand: HAND, deck: DECK, monsters: [null, 'crag_axeman', null, null, null] as (CardId | null)[] };
  const them = { monsters: [null, null, 'magma_titan', null, null] as (CardId | null)[] };
  return p === 0 ? { zones: 5, p0: me, p1: them } : { zones: 5, active: 1, p1: me, p0: them };
}

function set(p: PlayerId): Scenario['stage'] {
  const me = { hand: ['ember_wolf', 'tide_golem'] as CardId[], deck: DECK, spellTraps: [null, 'winnow_sieve', null, null, null] as (CardId | null)[], monsters: [null, 'reed_heron'] as (CardId | null)[] };
  const them = { monsters: [null, null, 'shade_assassin'] as (CardId | null)[] };
  return p === 0 ? { zones: 5, p0: me, p1: them } : { zones: 5, active: 1, p1: me, p0: them };
}

/** Only the sieve in the hand: after the draws the three new cards are the whole hand (two of them go). */
function bare(p: PlayerId): Scenario['stage'] {
  const me = { hand: ['winnow_sieve'] as CardId[], deck: ['storm_hawk', 'mirror_barrier', 'lumen_sprite'] as CardId[] };
  const them = { monsters: [null, 'ember_wolf'] as (CardId | null)[] };
  return p === 0 ? { zones: 5, p0: me, p1: them } : { zones: 5, active: 1, p1: me, p0: them };
}

function seals(p: PlayerId): Scenario['stage'] {
  const me = { hand: SEAL_HAND, deck: SEAL_DECK };
  const them = { monsters: [null, 'crystal_wyrm'] as (CardId | null)[] };
  return p === 0 ? { zones: 5, p0: me, p1: them } : { zones: 5, active: 1, p1: me, p0: them };
}

const PACK: Record<string, Scenario> = {
  eSieve: {
    desc: 'Harman Eleği (P1, elden): elek, üç kart ele zıplar; seçim beklenir; Gelgit Golemi + Kamış Balıkçılı samana döner',
    stage: hand(0),
    steps: [sieve(0), pause(900), toss(0, 'tide_golem', 'reed_heron')],
  },
  eSieveP2: {
    desc: 'Harman Eleği (P2, elden): aynalı',
    stage: hand(1),
    steps: [sieve(1), pause(900), toss(1, 'tide_golem', 'reed_heron')],
  },
  eSieveSet: {
    desc: 'Harman Eleği kapalıdan (P1): elek kartın kendi karosunda',
    stage: set(0),
    steps: [sieve(0), pause(700), toss(0, 'ember_wolf', 'judgment_bolt')],
  },
  eSieveSetP2: {
    desc: 'Harman Eleği kapalıdan (P2)',
    stage: set(1),
    steps: [sieve(1), pause(700), toss(1, 'ember_wolf', 'judgment_bolt')],
  },
  eSieveBare: {
    desc: 'Harman Eleği (P1): elde yalnız elek; çekilen üç karttan ikisi atılır',
    stage: bare(0),
    steps: [sieve(0), pause(600), toss(0, 'storm_hawk', 'lumen_sprite')],
  },
  eSieveSeal: {
    desc: 'Harman Eleği (P1): ilk çekilen kart beşinci mühür — düello kazanılır, atma yok',
    stage: seals(0),
    steps: [sieve(0)],
  },
  eSieveSealP2: {
    desc: 'Harman Eleği (P2): ilk çekilen kart beşinci mühür',
    stage: seals(1),
    steps: [sieve(1)],
  },
  // a person plays the choice with the mouse: the two cards are clicked in the fan, AT is confirmed with Enter
  eSieveUi: {
    desc: 'Harman Eleği (P1): seçim elle — iki karta tıklanır, AT onaylanır',
    stage: hand(0),
    steps: [sieve(0), pause(500), { ui: 'move', at: { hand: 1 }, ms: 260 }, { ui: 'click', at: { hand: 1 }, ms: 300 }, { ui: 'move', at: { hand: 3 }, ms: 260 }, { ui: 'click', at: { hand: 3 }, ms: 500 }, { ui: 'key', key: 'Enter', ms: 100 }],
  },
  eSievePlay: { desc: 'Harman Eleği (P1): elle oyna', stage: hand(0), steps: [] },
};

export default PACK;
