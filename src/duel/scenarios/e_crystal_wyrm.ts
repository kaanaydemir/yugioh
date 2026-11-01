// Lane E — Kristal Ejder (crystal_wyrm) card-art QA stages: the v3 card picture in the hand (1× face), on the
// board and in the summon. Only the card picture changed (src/art/cardart-v3/crystal_wyrm.ts); the sprite did not.
//   node tools/shot.mjs "?dev=duel&s=eWyrmHand&look=v3" --fresh --step 1500 --out shots/e/crystal_wyrm/hand.png
// P2 stages are the mirrored twins (active: 1): the card picture is NOT relit for P2 (KART_RESIMLERI §3).
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { StageSpec } from '../scenario';

function stage(p: PlayerId): StageSpec {
  const me = { hand: ['ember_wolf', 'crystal_wyrm', 'judgment_bolt', 'tide_golem'] as const, monsters: ['stone_sentinel', null, 'lumen_sprite'] as const };
  const them = { monsters: [null, 'tide_golem', null] as const };
  return p === 0 ? { p0: { ...me, hand: [...me.hand], monsters: [...me.monsters] }, p1: { monsters: [...them.monsters] } } : { active: 1, p1: { ...me, hand: [...me.hand], monsters: [...me.monsters] }, p0: { monsters: [...them.monsters] } };
}

const summon =
  (p: PlayerId): Step =>
  (D) =>
    ({ type: 'normalSummon', player: p, uid: D.uid('crystal_wyrm', p), zone: 1, tributes: [D.uid('stone_sentinel', p), D.uid('lumen_sprite', p)] }) as Action;

const PACK: Record<string, Scenario> = {
  eWyrmHand: { desc: 'Kristal Ejder (P1): elde v3 kart resmi', stage: stage(0), steps: [] },
  eWyrmHandP2: { desc: 'Kristal Ejder (P2): elde v3 kart resmi — aynalı', stage: stage(1), steps: [] },
  eWyrmSummon: { desc: 'Kristal Ejder (P1): iki kurbanla çağrı — kart yüzü uçuşta', stage: stage(0), steps: [summon(0)] },
  eWyrmSummonP2: { desc: 'Kristal Ejder (P2): iki kurbanla çağrı', stage: stage(1), steps: [summon(1)] },
};

export default PACK;
