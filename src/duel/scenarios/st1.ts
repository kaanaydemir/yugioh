// QA scenarios for the spell / trap batch 1 (docs/KART_TASLAGI_BUYU_TUZAK.md): one per card family, both players
// for the traps. Every stage is authored for the 5 + 5 board (zones: 5) — open with the v3 look and zones=5:
//   node tools/shot.mjs "?dev=duel&s=st1Draw&look=v3&zones=5&deck=expanded" --fresh --film 24 --every 120 --cols 6 --out shots/v3/st1/draw.png
// The new cards play through the DEFAULT presentation of their event kinds (signature cinematics come later).
import type { Scenario, Step } from '../scenarios';
import type { CardId } from '../../data/cards';
import type { PlayerId } from '../../engine/types';

const Z5 = 5 as const;

const act = (id: CardId, p: PlayerId, extra: Record<string, unknown> = {}): Step => (D) =>
  ({ type: 'activateSpell', player: p, uid: D.uid(id, p), ...extra }) as never;
const mon = (p: PlayerId, index: number) => ({ kind: 'monster' as const, ref: { player: p, zone: 'monster' as const, index } });
const card = (p: PlayerId, zone: 'spellTrap' | 'field', index: number) => ({ kind: 'card' as const, ref: { player: p, zone, index } });
const attack = (p: PlayerId, attackerZone: number, targetZone: number | null): Step => ({ type: 'attack', player: p, attackerZone, targetZone });
const battle = (p: PlayerId): Step => ({ type: 'enterBattle', player: p });
const respond = (id: CardId, p: PlayerId): Step => (D) => ({ type: 'respond', player: p, uid: D.uid(id, p) });
const pickTarget = (p: PlayerId, owner: PlayerId, index: number): Step => ({ type: 'chooseTarget', player: p, target: { player: owner, zone: 'monster', index } });
const discard = (id: CardId, p: PlayerId): Step => (D) => ({ type: 'discard', player: p, uids: [D.uid(id, p)] });
const summon = (id: CardId, zone: number, p: PlayerId, tributes: CardId[] = []): Step => (D) => ({
  type: 'normalSummon',
  player: p,
  uid: D.uid(id, p),
  zone,
  tributes: tributes.map((t) => D.uid(t, p)),
});
const set = (id: CardId, zone: number, p: PlayerId): Step => (D) => ({ type: 'setMonster', player: p, uid: D.uid(id, p), zone, tributes: [] });

const FILL = Array.from({ length: 8 }, () => 'stone_sentinel' as CardId);

const ST1: Record<string, Scenario> = {
  // ------------------------------------------------------------ card flow
  st1Draw: {
    desc: 'Kader Takası: draw 2, then the discard cost prompt (Main Phase), then the discard',
    stage: { zones: Z5, p0: { hand: ['fate_trade', 'ember_wolf', 'tide_golem'], deck: ['crystal_wyrm', 'judgment_bolt', ...FILL] } },
    steps: [act('fate_trade', 0), discard('tide_golem', 0)],
  },
  st1DrawP2: {
    desc: 'Kader Takası, player 2',
    stage: { zones: Z5, active: 1, p1: { hand: ['fate_trade', 'ember_wolf'], deck: ['crystal_wyrm', 'judgment_bolt', ...FILL] } },
    steps: [act('fate_trade', 1), discard('ember_wolf', 1)],
  },
  st1Cycle: {
    desc: 'Devir Daim: the last 3 graveyard cards go back to the deck (shuffle), 1 card is drawn',
    stage: { zones: Z5, p0: { hand: ['cycle_of_graves'], graveyard: ['stone_sentinel', 'ember_wolf', 'judgment_bolt', 'crystal_wyrm'], deck: FILL } },
    steps: [act('cycle_of_graves', 0)],
  },
  // ------------------------------------------------------------ summon helpers
  st1Tribute: {
    desc: 'Çifte Kurban, then Kristal Ejder (Level 7) is summoned with ONE tribute',
    stage: { zones: Z5, p0: { hand: ['double_offering', 'crystal_wyrm'], monsters: [null, null, 'ember_wolf'] } },
    steps: [act('double_offering', 0), summon('crystal_wyrm', 2, 0, ['ember_wolf'])],
  },
  st1Festival: {
    desc: 'Şenlik Meydanı: the square lands, a Level 4 monster is summoned, then a second one (the extra summon)',
    stage: { zones: Z5, p0: { hand: ['festival_square', 'ember_wolf', 'storm_hawk'] } },
    steps: [act('festival_square', 0), summon('ember_wolf', 1, 0), set('storm_hawk', 3, 0)],
  },
  // ------------------------------------------------------------ control
  st1Kneel: {
    desc: 'Diz Çöktürme: the strongest attacker kneels (defense position)',
    stage: { zones: Z5, p0: { hand: ['kneel_down'] }, p1: { monsters: [null, 'stone_sentinel', 'crystal_wyrm', { id: 'thorn_lurker', faceUp: false }] } },
    steps: [act('kneel_down', 0, { target: mon(1, 2) })],
  },
  st1Purge: {
    desc: 'Arınma Dalgası destroys a face-down trap (the opposing Volkan Arenası stays)',
    stage: { zones: Z5, p0: { hand: ['purging_wave'] }, p1: { spellTraps: [null, null, null, 'mirror_barrier'], field: 'volcano_arena' } },
    steps: [act('purging_wave', 0, { target: card(1, 'spellTrap', 3) })],
  },
  // ------------------------------------------------------------ combat boost
  st1Cry: {
    desc: 'Savaş Narası: +1000 ATK flips an even fight; the boost ends with the End Phase',
    stage: { zones: Z5, phase: 'main', p0: { hand: ['battle_cry'], monsters: [null, null, 'ember_wolf'] }, p1: { monsters: [null, null, 'shade_assassin'] } },
    steps: [act('battle_cry', 0, { target: mon(0, 2) }), battle(0), attack(0, 2, 2), { type: 'endTurn', player: 0 }],
  },
  st1Lance: {
    desc: 'Delici Mızrak: +300 ATK and piercing damage through a defender',
    stage: { zones: Z5, p0: { hand: ['piercing_lance'], monsters: [null, null, 'shade_assassin'] }, p1: { monsters: [null, null, { id: 'lumen_sprite', position: 'defense' }] } },
    steps: [act('piercing_lance', 0, { zone: 3, target: mon(0, 2) }), battle(0), attack(0, 2, 2)],
  },
  st1Charm: {
    desc: 'Koruyucu Tılsım: the equipped monster loses the fight but survives; the charm breaks',
    stage: {
      zones: Z5,
      phase: 'battle',
      p0: { monsters: [null, null, 'crystal_wyrm'] },
      p1: { monsters: [null, null, 'ember_wolf'], spellTraps: [null, null, { id: 'guardian_charm', equippedTo: 2 }] },
    },
    steps: [attack(0, 2, 2)],
  },
  // ------------------------------------------------------------ field spells
  st1Bay: {
    desc: 'Gelgit Körfezi: SU / RÜZGAR +400, ATEŞ -400 across both fields',
    stage: {
      zones: Z5,
      p0: { hand: ['tidal_bay'], monsters: ['tide_golem', 'storm_hawk', 'ember_wolf', null, 'wing_lady'] },
      p1: { monsters: [null, 'coral_serpent', 'ember_wolf', 'stone_sentinel'] },
    },
    steps: [act('tidal_bay', 0)],
  },
  st1Cavern: {
    desc: 'Gölge Mağarası: KARANLIK / TOPRAK +300, IŞIK -300 across both fields',
    stage: {
      zones: Z5,
      p0: { hand: ['shadow_cavern'], monsters: ['shade_assassin', 'stone_sentinel', null, 'lumen_sprite', 'volt_lizard'] },
      p1: { monsters: [null, 'dusk_sorcerer', 'tide_golem', 'grim_warden'] },
    },
    steps: [act('shadow_cavern', 0)],
  },
  // ------------------------------------------------------------ equip + trap protection family
  st1Seal: {
    desc: 'Büyü Mührü: Yıldırım Hükmü is negated and destroyed',
    stage: { zones: Z5, p0: { hand: ['judgment_bolt'] }, p1: { monsters: [null, null, 'crystal_wyrm'], spellTraps: [null, null, null, null, 'spell_seal'] } },
    steps: [act('judgment_bolt', 0, { target: mon(1, 2) }), respond('spell_seal', 1)],
  },
  st1SealP2: {
    desc: 'Büyü Mührü, player 1 answers a Volkan Arenası of player 2',
    stage: { zones: Z5, active: 1, p1: { hand: ['volcano_arena'] }, p0: { spellTraps: [null, 'spell_seal'] } },
    steps: [act('volcano_arena', 1), respond('spell_seal', 0)],
  },
  st1Tower: {
    desc: 'Devrilen Kule: the tribute-summoned Kristal Ejder (2800) is destroyed',
    stage: { zones: Z5, p0: { hand: ['crystal_wyrm'], monsters: [null, 'ember_wolf', null, 'tide_golem'] }, p1: { spellTraps: [null, null, 'toppling_tower'] } },
    steps: [summon('crystal_wyrm', 2, 0, ['ember_wolf', 'tide_golem']), respond('toppling_tower', 1)],
  },
  st1TowerRevive: {
    desc: 'Devrilen Kule answers a Special Summon (Ruh Çağrısı)',
    stage: { zones: Z5, p0: { hand: ['soul_recall'], graveyard: ['crystal_wyrm'] }, p1: { spellTraps: [null, null, null, 'toppling_tower'] } },
    steps: [
      (D) => ({ type: 'activateSpell', player: 0, uid: D.uid('soul_recall', 0), target: { kind: 'graveyard', uid: D.uid('crystal_wyrm', 0), toZone: 2 } }),
      respond('toppling_tower', 1),
    ],
  },
  // ------------------------------------------------------------ attack-window traps
  st1Home: {
    desc: 'Eve Dönüş: the attacker (with its sword) goes back to its owner\'s hand',
    stage: {
      zones: Z5,
      phase: 'battle',
      p0: { monsters: [null, null, 'ember_wolf', 'shade_assassin'], spellTraps: [null, null, { id: 'dragon_blade', equippedTo: 2 }] },
      p1: { monsters: [null, null, 'stone_sentinel'], spellTraps: [null, null, null, 'homecoming'] },
    },
    steps: [attack(0, 2, 2), respond('homecoming', 1)],
  },
  st1HomeP2: {
    desc: 'Eve Dönüş, player 1 bounces the attacker of player 2',
    stage: { zones: Z5, phase: 'battle', active: 1, p1: { monsters: [null, null, 'crystal_wyrm'] }, p0: { monsters: [null, null, 'stone_sentinel'], spellTraps: [null, 'homecoming'] } },
    steps: [attack(1, 2, 2), respond('homecoming', 0)],
  },
  st1Decoy: {
    desc: 'Sahte Hedef: the defender redirects the attack to the Kristal Ejder (4 candidates on 5 lanes)',
    stage: {
      zones: Z5,
      phase: 'battle',
      p0: { monsters: [null, null, 'shade_assassin'] },
      p1: { monsters: ['lumen_sprite', 'crystal_wyrm', 'lumen_sprite', { id: 'tide_golem', position: 'defense' }, { id: 'thorn_lurker', faceUp: false }], spellTraps: [null, null, null, null, 'decoy_target'] },
    },
    steps: [attack(0, 2, 0), respond('decoy_target', 1), pickTarget(1, 1, 1)],
  },
  st1Breath: {
    desc: 'Son Nefes: a direct hit drops player 2 below 1500, the trap gives 1500 back',
    stage: { zones: Z5, phase: 'battle', p0: { monsters: [null, null, 'ember_wolf'] }, p1: { lp: 2900, spellTraps: [null, null, null, 'last_breath'] } },
    steps: [attack(0, 2, null), respond('last_breath', 1)],
  },
  st1Sand: {
    desc: 'Kum Fırtınası: the attack is negated and all five attackers drop to defense',
    stage: {
      zones: Z5,
      phase: 'battle',
      p0: { monsters: ['ember_wolf', 'shade_assassin', 'volt_lizard', 'storm_hawk', 'crystal_wyrm'] },
      p1: { monsters: [null, null, 'stone_sentinel'], spellTraps: [null, null, null, 'sandstorm'] },
    },
    steps: [attack(0, 4, 2), respond('sandstorm', 1)],
  },
  st1Reinforce: {
    desc: 'Gizli Takviye: the attacked Kor Kurdu gets +1000 ATK / DEF and beats the Gölge Suikastçı',
    stage: {
      zones: Z5,
      phase: 'battle',
      p0: { monsters: [null, null, 'shade_assassin'] },
      p1: { monsters: [null, null, 'ember_wolf'], spellTraps: [null, null, null, 'hidden_reinforcement'] },
    },
    steps: [attack(0, 2, 2), respond('hidden_reinforcement', 1)],
  },
  st1ReinforceP2: {
    desc: 'Gizli Takviye, player 1 defends against player 2',
    stage: { zones: Z5, phase: 'battle', active: 1, p1: { monsters: [null, null, 'shade_assassin'] }, p0: { monsters: [null, null, 'ember_wolf'], spellTraps: [null, 'hidden_reinforcement'] } },
    steps: [attack(1, 2, 2), respond('hidden_reinforcement', 0)],
  },
  // ------------------------------------------------------------ full 5 + 5 board with the new cards (plates, numbers)
  st1Board: {
    desc: 'the 5 + 5 board with new cards everywhere: equips, a field spell, set traps, a full hand',
    stage: {
      zones: Z5,
      p0: {
        hand: ['fate_trade', 'double_offering', 'kneel_down', 'cycle_of_graves', 'battle_cry', 'purging_wave'],
        monsters: ['ember_wolf', 'tide_golem', 'crystal_wyrm', { id: 'thorn_lurker', faceUp: false }, 'storm_hawk'],
        spellTraps: [{ id: 'piercing_lance', equippedTo: 0 }, null, { id: 'guardian_charm', equippedTo: 2 }, 'spell_seal', 'homecoming'],
        field: 'tidal_bay',
        graveyard: ['stone_sentinel', 'judgment_bolt', 'lumen_sprite'],
      },
      p1: {
        hand: ['festival_square', 'shadow_cavern', 'tidal_bay', 'piercing_lance', 'guardian_charm', 'ember_wolf'],
        monsters: ['coral_serpent', 'shade_assassin', { id: 'stone_sentinel', position: 'defense' }, 'volt_lizard', { id: 'abyss_magus', position: 'attack' }],
        spellTraps: ['toppling_tower', 'decoy_target', 'last_breath', 'sandstorm', 'hidden_reinforcement'],
      },
    },
    steps: [],
  },
};

export default ST1;
