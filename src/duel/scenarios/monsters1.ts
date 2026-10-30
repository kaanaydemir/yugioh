// QA scenarios for batch 1 of the expanded roster (docs/KART_TASLAGI_CANAVAR.md): one per effect template plus a
// full 5-lane board of the new monsters. They stage on the board's lanes (3 without ?zones=5, 5 with it; the
// effects work on both) and use the placeholder crystal totems until real art exists.
//
//   node tools/shot.mjs "?dev=duel&s=m1Aura&look=v3&zones=5&deck=expanded" --fresh --film 12 --every 150 --cols 4
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';

const attack = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });
const battle = (player: PlayerId = 0): Action => ({ type: 'enterBattle', player });
const summon = (id: CardId, zone: number, tributes: CardId[] = [], player: PlayerId = 0): Step => (D) => ({
  type: 'normalSummon',
  player,
  uid: D.uid(id, player),
  zone,
  tributes: tributes.map((t) => D.uid(t, player)),
});

const scenarios: Record<string, Scenario> = {
  m1Silencer: {
    desc: 'Çelik Susturucu: the opponent has a set Ayna Kalkanı, but while the silencer is face-up it cannot be activated — the attack lands',
    stage: {
      phase: 'battle',
      p0: { monsters: ['steel_silencer', null, 'shade_assassin'] },
      p1: { monsters: [{ id: 'ember_wolf', position: 'attack' }], spellTraps: ['mirror_barrier'] },
    },
    steps: [attack(2, 0)],
  },
  m1SilencerP2: {
    desc: 'Çelik Susturucu, player 2: it silences player 1’s set trap (mirrored)',
    stage: {
      active: 1,
      phase: 'battle',
      p1: { monsters: ['steel_silencer', null, 'shade_assassin'] },
      p0: { monsters: [{ id: 'ember_wolf', position: 'attack' }], spellTraps: ['chains_of_light'] },
    },
    steps: [attack(2, 0, 1)],
  },
  m1Seals: {
    desc: 'Beş Mühür: four seals in hand, the opponent ends the turn, the fifth piece is drawn — the duel is won on the spot',
    stage: {
      active: 1,
      p0: { hand: ['seal_head', 'seal_arm_r', 'seal_arm_l', 'seal_leg_r'], deck: ['seal_leg_l', 'stone_sentinel', 'stone_sentinel'] },
      p1: { monsters: ['stone_sentinel'] },
    },
    steps: [{ type: 'endTurn', player: 1 }],
  },
  m1Aura: {
    desc: 'Kanat Hanımı: summoned next to Fırtına Atmacası (ATK 1000 -> 1300); the lady herself and the other attributes stay',
    stage: { p0: { hand: ['wing_lady'], monsters: ['storm_hawk', null, 'ember_wolf'] }, p1: { monsters: ['shade_assassin'] } },
    steps: [summon('wing_lady', 1)],
  },
  m1AuraAttack: {
    desc: 'Kanat Hanımı’s aura in battle: the 1300-ATK hawk beats Gelgit Golemi (1100) it could not beat at 1000',
    stage: {
      phase: 'battle',
      p0: { monsters: ['storm_hawk', 'wing_lady'] },
      p1: { monsters: [{ id: 'tide_golem', position: 'attack' }] },
    },
    steps: [attack(0, 0)],
  },
  m1Debuff: {
    desc: 'Hortlak Muhafız: attacks Zehir Ejderi (2000); the target counts 1600 for this battle (2500 vs 1600)',
    stage: {
      phase: 'battle',
      p0: { monsters: [null, 'grim_warden'] },
      p1: { monsters: [{ id: 'venom_drake', position: 'attack' }, 'ember_wolf'] },
    },
    steps: [attack(1, 0)],
  },
  m1Shield: {
    desc: 'Kalkan Devi in defense: Gölge Suikastçı (1900) attacks it and counts 1400 against DEF 2600 — the attacker pays the difference',
    stage: {
      phase: 'battle',
      p0: { monsters: ['shade_assassin'] },
      p1: { monsters: [{ id: 'shield_titan', position: 'defense' }] },
    },
    steps: [attack(0, 0)],
  },
  m1Freeze: {
    desc: 'Kum Saati Cücesi: summoned, its owner picks one opposing monster that cannot attack next turn',
    stage: { p0: { hand: ['hourglass_imp'] }, p1: { monsters: ['ember_wolf', { id: 'shade_assassin', faceUp: false }, 'volt_lizard'] } },
    steps: [summon('hourglass_imp', 1), { type: 'chooseTarget', player: 0, target: { player: 1, zone: 'monster', index: 0 } }],
  },
  m1Knight: {
    desc: 'Fırtına Yeleli Şövalye: tribute summoned, enters the battle phase (ATK 2300 -> 2800) and attacks the same turn',
    stage: {
      p0: { hand: ['windmane_knight'], monsters: ['stone_sentinel', 'ember_wolf'] },
      p1: { monsters: [{ id: 'shade_assassin', position: 'attack' }, { id: 'ashen_drake', position: 'attack' }] },
    },
    steps: [summon('windmane_knight', 1, ['stone_sentinel', 'ember_wolf']), battle(), attack(1, 1)],
  },
  m1Sorcerer: {
    desc: 'Alacakaranlık Büyücüsü: every Spell its owner activates burns the opponent for 300 (Şifa Pınarı: +1000 LP, -300 for the rival)',
    stage: { p0: { hand: ['healing_spring'], monsters: ['dusk_sorcerer'] }, p1: { monsters: ['ember_wolf'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('healing_spring', 0) })],
  },
  m1Imp: {
    desc: 'Tüy Hayalet attacks Taş Muhafız and is destroyed — its owner takes no battle damage',
    stage: { phase: 'battle', p0: { monsters: ['wisp_imp'] }, p1: { monsters: [{ id: 'stone_sentinel', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  m1Board5: {
    desc: 'five lanes of the new monsters on both sides (placeholder totems in the 48 / 64 / 80 size classes) with set cards and a full hand',
    stage: {
      p0: {
        hand: ['seal_head', 'seal_arm_r', 'hourglass_imp', 'wisp_imp', 'venom_drake', 'ashen_drake'],
        monsters: ['dusk_sorcerer', { id: 'shield_titan', position: 'defense' }, 'wing_lady', { id: 'steel_silencer', position: 'attack' }, 'windmane_knight'],
        spellTraps: ['mirror_barrier', null, 'chasm_trap'],
      },
      p1: {
        hand: ['seal_leg_l', 'seal_leg_r', 'seal_arm_l'],
        monsters: ['grim_warden', 'storm_hawk', { id: 'wisp_imp', faceUp: false }, 'seal_head', 'ashen_drake'],
        spellTraps: [null, 'chains_of_light', null, 'judgment_bolt'],
      },
    },
    steps: [],
  },
};

export default scenarios;
