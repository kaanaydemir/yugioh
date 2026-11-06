// QA scenarios for Bozkır Boynuzlusu (steppe_spiralhorn) — the v3 presentation (src/cinematics/kartc/steppe_spiralhorn*.ts):
//   node tools/shot.mjs "?dev=duel&s=sshAttack&look=v3&zones=5" --fresh --film 24 --every 100 --cols 6 --clip 120,40,400,240 --scale 2
// Bozkır Boynuzlusu: ATK 1500 / DEF 1400 (Sv4, no tribute). Five zones staged explicitly (no 3 → 5 lane shift).
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
  sshSummon: {
    desc: 'Bozkır Boynuzlusu: normal summon — the gust grass wave, one long bound in from off screen, the tiptoe landing, honk + flute',
    stage: { zones: 5, p0: { hand: ['steppe_spiralhorn'] }, p1: { monsters: [N, N, 'volt_lizard', N, N] } },
    steps: [summon('steppe_spiralhorn', 2)],
  },
  sshSummonP2: {
    desc: 'Bozkır Boynuzlusu: player 2 summons it (relit, mirrored; it bounds in from the right edge)',
    stage: { zones: 5, active: 1, p0: { monsters: [N, N, 'volt_lizard', N, N] }, p1: { hand: ['steppe_spiralhorn'] } },
    steps: [summon('steppe_spiralhorn', 2, [], 1)],
  },
  sshAttack: {
    desc: 'Bozkır Sıçrayışı: rear, three rising bounds, the upward horn toss, the seed burst (1500 vs thorn_lurker 600: destroyed)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'steppe_spiralhorn', N, N] }, p1: { monsters: [N, N, { id: 'thorn_lurker', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },
  sshAttackP2: {
    desc: 'Bozkır Sıçrayışı as player 2 (mirrored, the seeds drift right → left)',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: [N, N, { id: 'thorn_lurker', position: 'attack' }, N, N] }, p1: { monsters: [N, N, 'steppe_spiralhorn', N, N] } },
    steps: [attack(2, 2, 1)],
  },
  sshAttackV3: {
    desc: 'Bozkır Sıçrayışı on a v3 body (stone_sentinel 500, attack position)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'steppe_spiralhorn', N, N] }, p1: { monsters: [N, N, { id: 'stone_sentinel', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },
  sshDirect: {
    desc: 'direct attack: three bounds across the field and the toss at the duelist plate',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'steppe_spiralhorn', N, N] } },
    steps: [attack(2, null)],
  },
  sshBlocked: {
    desc: 'blocked: stone_sentinel in defense (DEF 2100): the horns lock with a clack, he slides back 6 px, no seeds (600 recoil)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'steppe_spiralhorn', N, N] }, p1: { monsters: [N, N, { id: 'stone_sentinel', position: 'defense' }, N, N] } },
    steps: [attack(2, 2)],
  },
  sshLoser: {
    desc: 'the attacker loses (1500 vs shade_assassin 1900): struck at the toss, he collapses into grass there',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'steppe_spiralhorn', N, N] }, p1: { monsters: [N, N, { id: 'shade_assassin', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },
  sshHit: {
    desc: 'struck by a weaker attacker (lumen_sprite 400 vs 1500): the head tossed back, the hide + horn tick; the attacker breaks',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'lumen_sprite', N, N] }, p1: { monsters: [N, N, { id: 'steppe_spiralhorn', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },
  sshKill: {
    desc: 'destroyed in battle (crystal_wyrm 2800 vs 1500): the graceful kneel, grass from the hooves up, the wind takes it, two plumes',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'crystal_wyrm', N, N] }, p1: { monsters: [N, N, { id: 'steppe_spiralhorn', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },
  sshKillP2: {
    desc: 'destroyed in battle as player 1 (the P2 wyrm attacks): the death mirrored, the stream blows leftward',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: [N, N, { id: 'steppe_spiralhorn', position: 'attack' }, N, N] }, p1: { monsters: [N, N, 'crystal_wyrm', N, N] } },
    steps: [attack(2, 2, 1)],
  },
  sshGuard: {
    desc: 'defense holds (storm_hawk 1000 vs DEF 1400): the pike fence takes it, the horn clack',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'storm_hawk', N, N] }, p1: { monsters: [N, N, { id: 'steppe_spiralhorn', position: 'defense' }, N, N] } },
    steps: [attack(2, 2)],
  },
  sshGuardDies: {
    desc: 'dies in defense (shade_assassin 1900 vs DEF 1400): the guard breaks into the grass death',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'shade_assassin', N, N] }, p1: { monsters: [N, N, { id: 'steppe_spiralhorn', position: 'defense' }, N, N] } },
    steps: [attack(2, 2)],
  },
  sshFlip: {
    desc: 'flip summon of a face-down Bozkır Boynuzlusu (the recipe flip, dust accent on the leaf ramp)',
    stage: { zones: 5, p0: { monsters: [N, N, { id: 'steppe_spiralhorn', faceUp: false, position: 'defense', enteredTurn: 1 }, N, N] } },
    steps: [{ type: 'flipSummon', player: 0, zone: 2 }],
  },
  sshPos: {
    desc: 'position change to defense: the horns come down into the pike fence (the clack)',
    stage: { zones: 5, p0: { monsters: [N, N, { id: 'steppe_spiralhorn', enteredTurn: 1 }, N, N] } },
    steps: [{ type: 'changePosition', player: 0, zone: 2 }],
  },
  sshRevive: {
    desc: "Ruh Çağrısı revives Bozkır Boynuzlusu (the art's revive: the wind runs backwards, the seeds gather into him)",
    stage: { zones: 5, p0: { hand: ['soul_recall'], graveyard: ['steppe_spiralhorn'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('soul_recall', 0), target: { kind: 'graveyard', uid: D.uid('steppe_spiralhorn', 0), toZone: 2 } })],
  },
};

export default scenarios;
