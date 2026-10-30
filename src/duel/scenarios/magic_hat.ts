// QA scenarios for Sihirli Şapka (magic_hat): the attacked monster and its decoys hide under shuffled hats.
//   node tools/shot.mjs "?dev=duel&s=mhDecoy&look=v3" --fresh --film 30 --every 100 --cols 6 --out shots/hat/decoy.png
//   (add &zones=5 for the 5 + 5 board; without look=v3 the legacy look plays)
// Naming: mh<Case>[P2]. P2 = player 2 is the DEFENDER (the hat's owner, hats on the upper half), P1 attacks.
// The attacker's pick reads the live state: 'Decoy' picks a decoy hat, 'Real' picks the hat on the monster.
import type { Scenario, Step } from '../scenarios';
import type { CardId } from '../../data/cards';
import type { Action, GameState, PlayerId } from '../../engine/types';

const atk = (p: PlayerId): Step => ({ type: 'attack', player: p, attackerZone: 0, targetZone: 0 });
const hatOn = (d: PlayerId): Step => (D) => ({ type: 'respond', player: d, uid: D.uid('magic_hat', d) });

type Qa = { state(): GameState };
/** The attacker's guess: the hat over the real monster (`real`) or the first decoy hat. */
const guess = (att: PlayerId, real: boolean): Step => (D) => {
  const s = (D as unknown as Qa).state();
  const def: PlayerId = att === 0 ? 1 : 0;
  const ms = s.players[def].monsters;
  const zone = ms.findIndex((m) => (real ? m?.hat === 'real' : m?.hat === 'decoy'));
  return zone < 0 ? null : ({ type: 'chooseTarget', player: att, target: { player: def, zone: 'monster', index: zone } } as Action);
};
const endTurn = (p: PlayerId): Step => ({ type: 'endTurn', player: p });

function hat(desc: string, defender: PlayerId, steps: (a: PlayerId, d: PlayerId) => Step[], crowded = false): Scenario {
  const a: PlayerId = defender === 0 ? 1 : 0;
  const me = { monsters: ['shade_assassin' as const] };
  const them = { monsters: ['lumen_sprite', null, crowded ? 'stone_sentinel' : null] as (CardId | null)[], spellTraps: ['magic_hat' as CardId] };
  return {
    desc,
    stage: { phase: 'battle', active: a, ...(a === 0 ? { p0: me, p1: them } : { p1: me, p0: them }) },
    steps: [atk(a), hatOn(defender), ...steps(a, defender)],
  };
}

const MH: Record<string, Scenario> = {
  mhDecoy: hat('Sihirli Şapka: P1 attacks, P2 hides, the attacker finds a decoy (pop, nothing happens)', 1, (a) => [guess(a, false)]),
  mhReal: hat('Sihirli Şapka: P1 attacks, P2 hides, the attacker finds the real monster (reveal + battle)', 1, (a) => [guess(a, true)]),
  mhDecoyP2: hat('Sihirli Şapka: P2 attacks, P1 hides, the attacker finds a decoy', 0, (a) => [guess(a, false)]),
  mhRealP2: hat('Sihirli Şapka: P2 attacks, P1 hides, the attacker finds the real monster', 0, (a) => [guess(a, true)]),
  mhShuffle: hat('Sihirli Şapka: only the activation and the shuffle (the pick is left waiting)', 1, () => []),
  mhShuffleP2: hat('Sihirli Şapka: only the activation and the shuffle, P1 defends', 0, () => []),
  mhCrowd: hat('Sihirli Şapka: a crowded side (one free zone): one decoy only', 1, (a) => [guess(a, true)], true),
  mhRestore: hat('Sihirli Şapka: a decoy is found, the turn ends: the hidden monster flips back up', 1, (a) => [guess(a, false), endTurn(a)]),
  mhRestoreP2: hat('Sihirli Şapka: a decoy is found, the turn ends (P1 defends)', 0, (a) => [guess(a, false), endTurn(a)]),
};

export default MH;
