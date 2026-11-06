// Lane E — Uçurum Büyücüsü (abyss_magus) card-art QA stages: the v3 card picture in the hand (1× face), on the
// board and in the summon's flying card. Only the card picture changed (src/art/cardart-v3/abyss_magus.ts); the
// sprite did not.
//   node tools/shot.mjs "?dev=duel&s=eMagusHand&look=v3" --fresh --step 1500 --out shots/e/abyss_magus/hand.png
//   node tools/shot.mjs "?dev=duel&s=eMagusInspect&look=v3" --fresh --step 2500 --out shots/e/abyss_magus/inspect.png
// P2 stages are the mirrored twins (active: 1): the card picture is NOT relit for P2 (KART_RESIMLERI §3).
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { StageSpec } from '../scenario';

function stage(p: PlayerId): StageSpec {
  const me = { hand: ['ember_wolf', 'abyss_magus', 'judgment_bolt', 'crystal_wyrm'] as const, monsters: ['stone_sentinel', null, null] as const };
  const them = { monsters: [null, 'tide_golem', null] as const };
  return p === 0
    ? { p0: { ...me, hand: [...me.hand], monsters: [...me.monsters] }, p1: { monsters: [...them.monsters] } }
    : { active: 1, p1: { ...me, hand: [...me.hand], monsters: [...me.monsters] }, p0: { monsters: [...them.monsters] } };
}

const summon =
  (p: PlayerId): Step =>
  (D) =>
    ({ type: 'normalSummon', player: p, uid: D.uid('abyss_magus', p), zone: 1, tributes: [D.uid('stone_sentinel', p)] }) as Action;

/** Hover the magus card in the hand: the inspect panel opens on it (the 2× face). */
const inspect: Step[] = [
  { ui: 'move', at: { xy: [320, 250] }, ms: 50 },
  { ui: 'move', at: { hand: 1 }, ms: 500 },
];

const PACK: Record<string, Scenario> = {
  eMagusHand: { desc: 'Uçurum Büyücüsü (P1): elde v3 kart resmi', stage: stage(0), steps: [] },
  eMagusHandP2: { desc: 'Uçurum Büyücüsü (P2): elde v3 kart resmi — aynalı', stage: stage(1), steps: [] },
  eMagusInspect: { desc: 'Uçurum Büyücüsü (P1): elde üzerine gelince inceleme paneli (2× kart)', stage: stage(0), steps: inspect },
  eMagusInspectP2: { desc: 'Uçurum Büyücüsü (P2): inceleme paneli — aynalı', stage: stage(1), steps: inspect },
  eMagusSummon: { desc: 'Uçurum Büyücüsü (P1): kurbanla çağrı — kart yüzü uçuşta', stage: stage(0), steps: [summon(0)] },
  eMagusSummonP2: { desc: 'Uçurum Büyücüsü (P2): kurbanla çağrı', stage: stage(1), steps: [summon(1)] },
};

export default PACK;
