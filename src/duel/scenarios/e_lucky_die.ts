// Lane E — Talih Zarı (lucky_die) film / QA stages (docs/v3/YENI_KARTLAR.md §7 S12). Every stage is a 5 + 5 board.
//   node tools/shot.mjs "?dev=duel&s=eDie&look=v3" --fresh --film 30 --every 100 --cols 6 --out shots/e/lucky_die/take.png
// The roll is fixed by the stage's rng (engine/rng nextRandom; value = 1 + floor(r × 6)):
//   12345 → 6 (the stage default), 7 → 1, 9 → 2, 14 → 3, 1 → 4, 2 → 5.
// P2 stages are the mirrored twins (active: 1). The caster has three face-up monsters (plus, in eDieSolo, one face-down
// that is NOT boosted); the opponent's monsters are never boosted.
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';
import type { MonSpec, StageSpec } from '../scenario';

const die = (p: PlayerId): Step => (D) => ({ type: 'activateSpell', player: p, uid: D.uid('lucky_die', p) }) as Action;

const MINE: (MonSpec | null)[] = [null, 'crag_axeman', 'reed_heron', 'ember_wolf', null];
const THEIRS: (MonSpec | null)[] = [null, null, 'magma_titan', null, 'tide_golem'];

function stage(p: PlayerId, rng: number, o: { set?: boolean; mine?: (MonSpec | null)[] } = {}): StageSpec {
  const me = o.set
    ? { hand: ['tide_golem'] as CardId[], spellTraps: [null, null, 'lucky_die', null, null] as (CardId | null)[], monsters: o.mine ?? MINE }
    : { hand: ['ember_wolf', 'lucky_die', 'tide_golem'] as CardId[], monsters: o.mine ?? MINE };
  const them = { monsters: THEIRS };
  return p === 0 ? { zones: 5, rng, p0: me, p1: them } : { zones: 5, rng, active: 1, p1: me, p0: them };
}

const SOLO: (MonSpec | null)[] = [null, { id: 'kite_fencer', faceUp: false, position: 'defense' }, 'stone_sentinel', null, null];

const PACK: Record<string, Scenario> = {
  eDie: { desc: 'Talih Zarı (P1, elden): 6 gelir — havai fişek ve akor, üç canavar +600', stage: stage(0, 12345), steps: [die(0)] },
  eDieP2: { desc: 'Talih Zarı (P2, elden): 6 gelir — aynalı', stage: stage(1, 12345), steps: [die(1)] },
  eDieMid: { desc: 'Talih Zarı (P1, elden): 3 gelir — üç nota, +300', stage: stage(0, 14), steps: [die(0)] },
  eDieMidP2: { desc: 'Talih Zarı (P2, elden): 3 gelir', stage: stage(1, 14), steps: [die(1)] },
  eDieOne: { desc: 'Talih Zarı (P1, elden): 1 gelir — tek donuk "tok", +100', stage: stage(0, 7), steps: [die(0)] },
  eDieOneP2: { desc: 'Talih Zarı (P2, elden): 1 gelir', stage: stage(1, 7), steps: [die(1)] },
  eDieSet: { desc: 'Talih Zarı kapalıdan (P1): 4 gelir — zar kartın kendi karosundan atılır', stage: stage(0, 1, { set: true }), steps: [die(0)] },
  eDieSetP2: { desc: 'Talih Zarı kapalıdan (P2): 4 gelir', stage: stage(1, 1, { set: true }), steps: [die(1)] },
  eDieSolo: { desc: 'Talih Zarı (P1): 5 gelir — tek açık canavar (kapalı olan güçlenmez)', stage: stage(0, 2, { mine: SOLO }), steps: [die(0)] },
  eDieTwo: { desc: 'Talih Zarı (P1): 2 gelir', stage: stage(0, 9), steps: [die(0)] },
  // a person plays it with the mouse (the hand fan, the hover, then the card)
  eDiePlay: { desc: 'Talih Zarı (P1): elle oyna (6 gelir)', stage: stage(0, 12345), steps: [] },
};

export default PACK;
