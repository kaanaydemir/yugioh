// zones5 scenarios: the 5 + 5 board (docs: layout.ts "?zones=5"). Open with the v3 look and zones=5:
//   node tools/shot.mjs "?dev=duel&s=z5Full&look=v3&zones=5" --fresh --out shots/v3/zones5/z5-full.png
// The zone count follows the board (buildStage default = LANES): without ?zones=5 they stage as a
// 3 + 3 board and entries for zones >= 3 are dropped.
import type { Scenario } from '../scenarios';

const FULL_P0 = {
  hand: ['ember_wolf', 'tide_golem', 'judgment_bolt', 'storm_hawk', 'healing_spring', 'mirror_barrier'],
  monsters: [
    'stone_sentinel',
    { id: 'tide_golem', position: 'defense' },
    'crystal_wyrm',
    { id: 'thorn_lurker', faceUp: false },
    'magma_titan',
  ],
  spellTraps: ['mirror_barrier', { id: 'dragon_blade', equippedTo: 2 }, 'chasm_trap', null, 'chains_of_light'],
  field: 'volcano_arena',
  graveyard: ['ember_wolf', 'judgment_bolt', 'stone_sentinel', 'volt_lizard'],
} as const;

const FULL_P1 = {
  hand: ['volt_lizard', 'lumen_sprite', 'soul_recall', 'shade_assassin', 'storm_hawk', 'tide_golem'],
  monsters: [
    'lumen_sprite',
    { id: 'abyss_magus', position: 'attack' },
    { id: 'stone_sentinel', position: 'defense' },
    'coral_serpent',
    { id: 'shade_assassin', faceUp: false },
  ],
  spellTraps: ['chasm_trap', null, { id: 'chains_of_light', faceUp: true }, 'mirror_barrier', { id: 'healing_spring', faceUp: true }],
  graveyard: ['ember_wolf', 'tide_golem'],
} as const;

const Z5: Record<string, Scenario> = {
  z5Empty: {
    desc: 'zones5: empty 5+5 board, both sides (hand of 3)',
    stage: { p0: { hand: ['ember_wolf', 'tide_golem', 'judgment_bolt'] }, p1: { hand: ['volt_lizard', 'shade_assassin'] } },
    steps: [],
  },
  z5Full: {
    desc: 'zones5: five monsters (big + small, ATK / DEF / face-down) and five spell/traps per side, field spells, piles, 6-card hand',
    stage: { p0: FULL_P0 as never, p1: FULL_P1 as never },
    steps: [],
  },
  z5FullCalm: {
    desc: 'zones5: z5Full without the field spell (the calm blue arena, to judge the pools and plates)',
    stage: { p0: { ...FULL_P0, field: undefined } as never, p1: FULL_P1 as never },
    steps: [],
  },
  z5FullP2: {
    desc: 'zones5: z5Full with player 2 to move',
    stage: { active: 1, p0: FULL_P0 as never, p1: FULL_P1 as never },
    steps: [],
  },
  z5Cmp: {
    desc: 'zones5 comparison: a board that fits 3 lanes (shoot with and without ?zones=5 for the side-by-side)',
    stage: { phase: 'battle', p0: { hand: ['ember_wolf'], monsters: ['stone_sentinel', 'ember_wolf', 'storm_hawk'], graveyard: ['volt_lizard'] }, p1: { monsters: ['shade_assassin', 'volt_lizard', { id: 'tide_golem', position: 'defense' }], spellTraps: ['mirror_barrier'] } },
    steps: [],
  },
  z5Hover: {
    desc: 'zones5: the pointer over lane 5 (own monster), then the outer pads (graveyard)',
    stage: { p0: { hand: ['ember_wolf', 'tide_golem'], monsters: [null, null, null, null, 'stone_sentinel'], graveyard: ['ember_wolf', 'judgment_bolt'] }, p1: { monsters: [null, null, null, null, 'volt_lizard'] } },
    steps: [
      { ui: 'move', at: { xy: [320, 250] }, ms: 50 },
      { ui: 'move', at: { zone: [0, 'monster', 4] }, ms: 250 },
      { ui: 'move', at: { zone: [1, 'monster', 4] }, ms: 250 },
      { ui: 'move', at: { pile: [0, 'graveyard'] }, ms: 300 },
    ],
  },
  z5Summon: {
    desc: 'zones5: Kor Kurdu is normal summoned into zone 4 (lane 5)',
    stage: { p0: { hand: ['ember_wolf'], monsters: ['stone_sentinel', null, 'storm_hawk'] }, p1: { monsters: [null, 'volt_lizard', null, 'tide_golem'] } },
    steps: [(D) => ({ type: 'normalSummon', player: 0, uid: D.uid('ember_wolf', 0), zone: 4, tributes: [] })],
  },
  z5Attack: {
    desc: 'zones5: Kor Kurdu in zone 4 attacks across into the opponent\'s zone 4 (shatters it)',
    stage: { phase: 'battle', p0: { monsters: ['stone_sentinel', null, 'storm_hawk', null, 'ember_wolf'] }, p1: { monsters: [null, 'volt_lizard', null, null, { id: 'shade_assassin', position: 'defense' }] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 4, targetZone: 4 }],
  },
};

export default Z5;
