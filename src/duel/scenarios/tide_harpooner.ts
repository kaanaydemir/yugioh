// QA scenarios for Kabuk Zıpkıncı (tide_harpooner) — lane C, C1. Five zones staged explicitly (the 3→5 auto-shift never
// moves the UI-step coordinates). Film one with:
//   node tools/shot.mjs "?dev=duel&s=thpAttack&look=v3&zones=5" --fresh --film 24 --every 90 --cols 6 --clip 120,40,400,240
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
const bayOn = (player: PlayerId = 0): Step => (D) => ({ type: 'activateSpell', player, uid: D.uid('tidal_bay', player) });

const S: Record<string, Scenario> = {
  // ---------------------------------------------------------------- summon (tribute ace: the tide uncovers the conch + cut-in)
  thpSummon: {
    desc: 'Kabuk Zıpkıncı: tribute summon (1 tribute) — the tide uncovers the conch, cut-in, the conch sounds, the harpoon is planted',
    stage: { zones: 5, p0: { hand: ['tide_harpooner'], monsters: [N, N, 'stone_sentinel', N, N] }, p1: { monsters: [N, N, 'volt_lizard', N, N] } },
    steps: [summon('tide_harpooner', 2, ['stone_sentinel'])],
  },
  thpSummonP2: {
    desc: 'Kabuk Zıpkıncı: player 2 tribute summons it (relit P2 sheet, cut-in P2)',
    stage: { zones: 5, active: 1, p0: { monsters: [N, N, 'volt_lizard', N, N] }, p1: { hand: ['tide_harpooner'], monsters: [N, N, 'ember_wolf', N, N] } },
    steps: [summon('tide_harpooner', 2, ['ember_wolf'], 1)],
  },

  // ---------------------------------------------------------------- attack: twirl – throw – haul
  thpAttack: {
    desc: 'Zıpkın Atışı: twirl, throw, the harpoon pierces Taş Muhafız (attack position, 500), the PULL, reeled back, re-planted',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'tide_harpooner', N, N] }, p1: { monsters: [N, N, { id: 'stone_sentinel', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },
  thpAttackP2: {
    desc: 'Zıpkın Atışı as player 2 (the throw goes down-left)',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: [N, N, { id: 'stone_sentinel', position: 'attack' }, N, N] }, p1: { monsters: [N, N, 'tide_harpooner', N, N] } },
    steps: [attack(2, 2, 1)],
  },
  thpAttackVolt: {
    desc: 'Zıpkın Atışı into Şimşek Kertenkelesi (1500): the lizard’s own discharge trigger follows the kill',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'tide_harpooner', N, N] }, p1: { monsters: [N, N, { id: 'volt_lizard', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },
  thpAttackDiag: {
    desc: 'Zıpkın Atışı across lanes (zone 1 → zone 3): the rope runs diagonally',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, 'tide_harpooner', N, N, N] }, p1: { monsters: [N, N, N, { id: 'thorn_lurker', position: 'attack' }, N] } },
    steps: [attack(1, 3)],
  },
  thpDirect: {
    desc: 'direct attack: the harpoon flies over the field and stakes into the opponent LP panel, one haul jolts it, reeled back',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'tide_harpooner', N, N] } },
    steps: [attack(2, null)],
  },
  thpDirectP2: {
    desc: 'direct attack as player 2: the harpoon stakes into player 1’s LP panel',
    stage: { zones: 5, phase: 'battle', active: 1, p1: { monsters: [N, N, 'tide_harpooner', N, N] } },
    steps: [attack(2, null, 1)],
  },
  thpBlocked: {
    desc: 'blocked: the harpoon bites Taş Muhafız’s guard (DEF 2100), the haul moves it 1 px, it pops free (tang), reeled in',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'tide_harpooner', N, N] }, p1: { monsters: [N, N, { id: 'stone_sentinel', position: 'defense' }, N, N] } },
    steps: [attack(2, 2)],
  },
  thpLoses: {
    desc: 'the harpooner attacks Kristal Ejder (2800) and loses: the backlash, its burial death',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'tide_harpooner', N, N] }, p1: { monsters: [N, N, { id: 'crystal_wyrm', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },
  thpTrade: {
    desc: 'the harpooner attacks Kor Kurdu (1700 = 1700): both destroyed',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'tide_harpooner', N, N] }, p1: { monsters: [N, N, { id: 'ember_wolf', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },

  // ---------------------------------------------------------------- struck / guard / death
  thpHit: {
    desc: 'struck by a weaker attacker (Işık Perisi 400 vs 1700): the shell tok, it withstands, the attacker breaks',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'lumen_sprite', N, N] }, p1: { monsters: [N, N, { id: 'tide_harpooner', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },
  thpKill: {
    desc: 'destroyed in battle (Kristal Ejder 2800): drawn into the shell, buried in sand, the harpoon stays and splinters',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'crystal_wyrm', N, N] }, p1: { monsters: [N, N, { id: 'tide_harpooner', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },
  thpKillP2: {
    desc: 'player 1’s harpooner destroyed by player 2’s Kristal Ejder',
    stage: { zones: 5, phase: 'battle', active: 1, p1: { monsters: [N, N, 'crystal_wyrm', N, N] }, p0: { monsters: [N, N, { id: 'tide_harpooner', position: 'attack' }, N, N] } },
    steps: [attack(2, 2, 1)],
  },
  thpGuard: {
    desc: 'defense holds (Şimşek Kertenkelesi 1500 vs DEF 1500): withdrawn, the claw door, shuck + clack',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'volt_lizard', N, N] }, p1: { monsters: [N, N, { id: 'tide_harpooner', position: 'defense' }, N, N] } },
    steps: [attack(2, 2)],
  },
  thpGuardDies: {
    desc: 'dies in defense (Kor Kurdu 1700 vs DEF 1500): the guard breaks into the burial',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'ember_wolf', N, N] }, p1: { monsters: [N, N, { id: 'tide_harpooner', position: 'defense' }, N, N] } },
    steps: [attack(2, 2)],
  },

  // ---------------------------------------------------------------- Körfez kalkanı
  thpBayOn: {
    desc: 'Gelgit Körfezi activates: the harpooner plants and the standing wave wall rises round its tile (the shroud ring)',
    stage: { zones: 5, p0: { hand: ['tidal_bay'], monsters: [N, N, 'tide_harpooner', N, N] }, p1: { monsters: [N, N, 'ember_wolf', N, N] } },
    steps: [bayOn(0)],
  },
  thpBayOnP2: {
    desc: 'Gelgit Körfezi activates for player 2’s harpooner',
    stage: { zones: 5, active: 1, p1: { hand: ['tidal_bay'], monsters: [N, N, 'tide_harpooner', N, N] }, p0: { monsters: [N, N, 'ember_wolf', N, N] } },
    steps: [bayOn(1)],
  },
  thpBaySummon: {
    desc: 'tribute summoned while the Bay is already up: the 600 ms wall after the plant',
    stage: { zones: 5, p0: { field: 'tidal_bay', hand: ['tide_harpooner'], monsters: [N, N, 'stone_sentinel', N, N] }, p1: { monsters: [N, N, 'volt_lizard', N, N] } },
    steps: [summon('tide_harpooner', 2, ['stone_sentinel'])],
  },
  thpShroud: {
    desc: 'KORUNUYOR: P2 picks Kristal Ejder, clicks the shrouded harpooner (the reticle skids off the wave wall), then attacks Taş Muhafız',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { field: 'tidal_bay', monsters: [N, N, 'tide_harpooner', 'stone_sentinel', N] }, p1: { monsters: [N, N, 'crystal_wyrm', N, N] } },
    steps: [
      { ui: 'move', at: { unit: [1, 2] }, ms: 120 },
      { ui: 'click', at: { unit: [1, 2] }, ms: 300 },
      { ui: 'move', at: { unit: [0, 2] }, ms: 150 },
      { ui: 'click', at: { unit: [0, 2] }, ms: 1100 },
      { ui: 'move', at: { unit: [0, 3] }, ms: 150 },
      { ui: 'click', at: { unit: [0, 3] } },
    ],
  },
  thpShroudSpell: {
    desc: 'KORUNUYOR: P2’s Yıldırım Hükmü — a click on the shrouded harpooner is deflected, then Taş Muhafız is the target',
    stage: { zones: 5, active: 1, p0: { field: 'tidal_bay', monsters: [N, N, 'tide_harpooner', 'stone_sentinel', N] }, p1: { hand: ['judgment_bolt'], monsters: [N, N, 'volt_lizard', N, N] } },
    steps: [
      { ui: 'move', at: { hand: 0 }, ms: 120 },
      { ui: 'click', at: { hand: 0 }, ms: 250 },
      { ui: 'click', at: { menu: 'activateSpell' }, ms: 250 },
      { ui: 'move', at: { unit: [0, 2] }, ms: 150 },
      { ui: 'click', at: { unit: [0, 2] }, ms: 1100 },
      { ui: 'move', at: { zone: [0, 'monster', 3] }, ms: 150 },
      { ui: 'click', at: { zone: [0, 'monster', 3] } },
    ],
  },
};

export default S;
