// QA scenarios for Kaya Baltacı (crag_axeman) — the v3 presentation (src/cinematics/kartc/crag_axeman*.ts):
//   node tools/shot.mjs "?dev=duel&s=caxAttack&look=v3&zones=5" --fresh --film 24 --every 100 --cols 6 --clip 150,40,340,240 --scale 2
// Kaya Baltacı: ATK 1600 / DEF 1300 (Sv4, no tribute). Five zones staged explicitly (no 3 → 5 lane shift).
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';

const N = null;
const attack = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });
const summon = (id: CardId, zone: number, tributes: CardId[] = [], player: PlayerId = 0): Step => (D) => ({
  type: 'normalSummon',
  player,
  uid: D.uid(id, player),
  zone,
  tributes: tributes.map((t) => D.uid(t, player)),
});

const scenarios: Record<string, Scenario> = {
  caxSummon: {
    desc: 'Kaya Baltacı: normal summon — the boulder rolls in, a still beat, the blade punches out, the seam splits it, the nara',
    stage: { zones: 5, p0: { hand: ['crag_axeman'] }, p1: { monsters: [N, N, 'volt_lizard', N, N] } },
    steps: [summon('crag_axeman', 2)],
  },
  caxSummonP2: {
    desc: 'Kaya Baltacı: player 2 summons it (relit, mirrored)',
    stage: { zones: 5, active: 1, p0: { monsters: [N, N, 'volt_lizard', N, N] }, p1: { hand: ['crag_axeman'] } },
    steps: [summon('crag_axeman', 2, [], 1)],
  },
  caxAttack: {
    desc: 'Dağ Yaran: spin, three steps, the bite, the seam runs and climbs the target (1600 vs thorn_lurker 600: destroyed)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'crag_axeman', N, N] }, p1: { monsters: [N, N, { id: 'thorn_lurker', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },
  caxAttackP2: {
    desc: 'Dağ Yaran as player 2 (the crackle run pans right → left)',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: [N, N, { id: 'thorn_lurker', position: 'attack' }, N, N] }, p1: { monsters: [N, N, 'crag_axeman', N, N] } },
    steps: [attack(2, 2, 1)],
  },
  caxAttackV3: {
    desc: 'Dağ Yaran on a v3 body (stone_sentinel 500, attack position): the seam climbs the drawn body',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'crag_axeman', N, N] }, p1: { monsters: [N, N, { id: 'stone_sentinel', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },
  caxDirect: {
    desc: 'direct attack: he bites the board edge, the seam runs off the board to the duelist, a light seam over the duelist',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'crag_axeman', N, N] } },
    steps: [attack(2, null)],
  },
  caxBlocked: {
    desc: 'blocked: stone_sentinel in defense (DEF 2100): the seam forks into a "Y" at the guard, he staggers back (500 recoil)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'crag_axeman', N, N] }, p1: { monsters: [N, N, { id: 'stone_sentinel', position: 'defense' }, N, N] } },
    steps: [attack(2, 2)],
  },
  caxLoser: {
    desc: 'the attacker loses (1600 vs shade_assassin 1900): struck where he bit, he splits there',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'crag_axeman', N, N] }, p1: { monsters: [N, N, { id: 'shade_assassin', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },
  caxHit: {
    desc: 'struck by a weaker attacker (lumen_sprite 400 vs 1600): withstands with a grunt, the attacker breaks',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'lumen_sprite', N, N] }, p1: { monsters: [N, N, { id: 'crag_axeman', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },
  caxKill: {
    desc: 'destroyed in battle (crystal_wyrm 2800 vs 1600): the axe bites, the seam climbs his centre line, he splits in two',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'crystal_wyrm', N, N] }, p1: { monsters: [N, N, { id: 'crag_axeman', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },
  caxKillP2: {
    desc: 'destroyed in battle as player 1 (the P2 wyrm attacks): the split mirrored',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: [N, N, { id: 'crag_axeman', position: 'attack' }, N, N] }, p1: { monsters: [N, N, 'crystal_wyrm', N, N] } },
    steps: [attack(2, 2, 1)],
  },
  caxGuard: {
    desc: 'defense holds (storm_hawk 1000 vs DEF 1300): the haft as a bar, the slap',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'storm_hawk', N, N] }, p1: { monsters: [N, N, { id: 'crag_axeman', position: 'defense' }, N, N] } },
    steps: [attack(2, 2)],
  },
  caxGuardDies: {
    desc: 'dies in defense (shade_assassin 1900 vs DEF 1300): the guard breaks into the split',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'shade_assassin', N, N] }, p1: { monsters: [N, N, { id: 'crag_axeman', position: 'defense' }, N, N] } },
    steps: [attack(2, 2)],
  },
  caxFlip: {
    desc: 'flip summon of a face-down Kaya Baltacı (the recipe flip, dust accent)',
    stage: { zones: 5, p0: { monsters: [N, N, { id: 'crag_axeman', faceUp: false, position: 'defense', enteredTurn: 1 }, N, N] } },
    steps: [{ type: 'flipSummon', player: 0, zone: 2 }],
  },
  caxPos: {
    desc: 'position change to defense: the haft comes across the chest (the slap)',
    stage: { zones: 5, p0: { monsters: [N, N, { id: 'crag_axeman', enteredTurn: 1 }, N, N] } },
    steps: [{ type: 'changePosition', player: 0, zone: 2 }],
  },
  caxRevive: {
    desc: 'Ruh Çağrısı revives Kaya Baltacı (the art\'s revive: the halves gather, the seam closes)',
    stage: { zones: 5, p0: { hand: ['soul_recall'], graveyard: ['crag_axeman'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('soul_recall', 0), target: { kind: 'graveyard', uid: D.uid('crag_axeman', 0), toZone: 2 } })],
  },
};

export default scenarios;
