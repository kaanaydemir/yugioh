// ?dev=arena4&s=<key>&look=v3 — arena v4 step 4 (reactive arena + living details) QA boards. Same as ?dev=duel&s=…
// (works with tools/shot.mjs --fresh), the scenarios below are registered into SCENARIOS:
//   a4Turn      stBoard-like board, player 1 ends the turn: the turn-change light sweep (P1 → P2)
//   a4Small     a small battle hit (300) + a destroyed monster: a short tile shockwave
//   a4Big       a big direct hit (2800) on player 2: a wide shockwave, the right hologram glitches, the low-LP alarm starts
//   a4LowLp     player 1 at 700 LP: the low-LP alarm idling on the cyan side
//   a4Volcano / a4Bay / a4Cavern / a4Festival   the board under each Field Spell (the arena's ambience)
// Debug hooks (window.__neon.ntReact, BOARD_V4 only): sweep(p), shock(p, spot, index, amount), glitch(), state().
import type { DevPreview } from '../types';
import { SCENARIOS, type Scenario } from '../../duel/scenarios';
import type { MonSpec } from '../../duel/scenario';
import type { CardId } from '../../data/cards';
import duelPreview from './duel';

const N = null;
const five = (...xs: (MonSpec | null)[]): (MonSpec | null)[] => [...xs, ...Array.from({ length: Math.max(0, 5 - xs.length) }, () => null)];

const P0 = {
  lp: 2650,
  hand: ['ashen_drake', 'judgment_bolt', 'windmane_knight', 'mirror_barrier', 'dawn_swords'] as CardId[],
  monsters: five('ember_wolf', 'crystal_wyrm', N, { id: 'shield_titan', position: 'defense' }, 'reed_heron'),
  spellTraps: [N, { id: 'chains_of_light', faceUp: false }, N, { id: 'mirror_barrier', faceUp: false }, N],
  graveyard: ['stone_sentinel', 'storm_hawk', 'healing_spring'] as CardId[],
};
const P1 = {
  lp: 3100,
  monsters: five('kite_fencer', 'polar_sovereign', N, 'abyss_magus', { id: 'thorn_lurker', faceUp: false, position: 'defense' }),
  spellTraps: [{ id: 'chasm_trap', faceUp: false }, N, N, { id: 'void_eye', faceUp: false }, N],
  graveyard: ['magma_titan', 'volt_lizard'] as CardId[],
};

const withField = (field: CardId, desc: string): Scenario => ({
  desc,
  stage: { zones: 5, turn: 7, p0: { ...P0, field } as never, p1: P1 as never },
  steps: [],
});

export const ARENA4_SCENARIOS: Record<string, Scenario> = {
  a4Turn: {
    desc: 'arena4: player 1 ends the turn — the turn-change light sweep in player 2 crimson',
    stage: { zones: 5, turn: 7, p0: P0 as never, p1: P1 as never },
    steps: [{ type: 'endTurn', player: 0 }],
  },
  a4Small: {
    desc: 'arena4: Kor Kurdu (1700) beats Sazlık Balıkçılı (1400): 300 damage, a small shockwave',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, 'ember_wolf') }, p1: { monsters: five(N, N, N, 'reed_heron') } },
    steps: [{ type: 'attack', player: 0, attackerZone: 1, targetZone: 3 }],
  },
  a4Big: {
    desc: 'arena4: Kristal Ejder attacks directly: 2800 damage, a wide shockwave, the right hologram glitches, the low-LP alarm',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'crystal_wyrm') }, p1: { lp: 3100, monsters: five() } },
    steps: [{ type: 'attack', player: 0, attackerZone: 2, targetZone: null }],
  },
  a4LowLp: {
    desc: 'arena4: player 1 at 700 LP — the low-LP alarm on the cyan side',
    stage: { zones: 5, turn: 7, p0: { ...P0, lp: 700 } as never, p1: P1 as never },
    steps: [],
  },
  a4Volcano: withField('volcano_arena', 'arena4: Volkan Arenası active (embers)'),
  a4Bay: withField('tidal_bay', 'arena4: Gelgit Körfezi active (caustics, teal)'),
  a4Cavern: withField('shadow_cavern', 'arena4: Gölge Mağarası active (darker hall, violet motes)'),
  a4Festival: withField('festival_square', 'arena4: Şenlik Meydanı active (confetti, lantern light)'),
};
Object.assign(SCENARIOS, ARENA4_SCENARIOS);

const preview: DevPreview = {
  name: 'arena4',
  description: 'arena v4 step 4 QA boards: &s=a4Turn|a4Small|a4Big|a4LowLp|a4Volcano|a4Bay|a4Cavern|a4Festival',
  create(scene, params) {
    return duelPreview.create(scene, params);
  },
};

export default preview;
