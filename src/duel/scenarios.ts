// Named duel scenarios — a staged board + a list of actions — for QA, films and cinematic
// authors. Every cinematic path of the defaults is covered.
//
//   await __neon.duel.scenario('trapMirror')          // stage it and play every step
//   await __neon.duel.scenario('trapMirror', { film: true })  // steps start on the next freeze()
//   node tools/shot.mjs "?dev=duel&s=trapMirror" --film 24 --every 120   // same, from a URL
//
// A step is an Action, or a function (D) => Action that can look up uids with D.uid(cardId, owner),
// or (A56.0, docs/v3/A6_PLAN.md §4.1) a UI step: the mouse / keyboard of a person — move, click,
// key, wait — on the screen's targets, run by src/duel/qaInput.ts, so films and measurements also
// cover hovering, clicking and invalid clicks:
//   { ui: 'move', at: { hand: 2 }, ms: 120 }            // hover the 3rd hand card, then 120 ms
//   { ui: 'click', at: { menu: 'activateSpell' } }      // a row of the open action menu
//   { ui: 'click', at: { zone: [1, 'monster', 1] } }    // a board tile (its centre)
//   { ui: 'key', key: 'Escape' }   { ui: 'wait', ms: 300 }

import type { CardId } from '../data/cards';
import type { Action, PlayerId } from '../engine/types';
import type { BoardSpot } from '../view/layout';
import type { StageSpec } from './scenario';

export interface ScenarioApi {
  uid(cardId: CardId, owner?: PlayerId): number;
}

/** Where a UI step points (screen space; resolved when the step runs: src/duel/qaInput.ts uiPoint). */
export type UiTarget =
  /** The viewer's hand card i (left → right), at its resting place. */
  | { hand: number }
  /** A board spot's centre: [player, spot, index]. */
  | { zone: [PlayerId, BoardSpot, number] }
  /** The body of the monster in [player, zone]. */
  | { unit: [PlayerId, number] }
  /** A deck / graveyard pile's top. */
  | { pile: [PlayerId, 'deck' | 'graveyard'] }
  /** A HUD button. */
  | { button: 'battle' | 'endTurn' | 'menu' }
  /** The row of the open action menu with this option id (e.g. 'activateSpell', 'setMonster'). */
  | { menu: string }
  /** A raw game-pixel point (640×360). */
  | { xy: [number, number] }
  /** Card i of the open graveyard panel (lane A6-A registers the resolver; skipped without one). */
  | { panel: number };

/** One step of a person at the screen (A56.0). `ms`: wait after it (game ms; for 'wait' the wait). */
export interface UiStep {
  ui: 'move' | 'click' | 'key' | 'wait';
  at?: UiTarget;
  /** 'key': the KeyboardEvent key ('Escape', 'Enter', ' ', '1', 'b' …). */
  key?: string;
  ms?: number;
  /** 'click': the mouse button (default left). */
  button?: 'left' | 'right';
}

export type Step = Action | ((D: ScenarioApi) => Action | null) | UiStep;

/** Is this step a UI step? */
export function isUiStep(st: Step): st is UiStep {
  return typeof st === 'object' && st !== null && 'ui' in st;
}

export interface Scenario {
  desc: string;
  stage: StageSpec;
  steps: Step[];
}

const summon = (id: CardId, zone: number, tributes: CardId[] = [], player: PlayerId = 0): Step => (D) => ({
  type: 'normalSummon',
  player,
  uid: D.uid(id, player),
  zone,
  tributes: tributes.map((t) => D.uid(t, player)),
});

export const SCENARIOS: Record<string, Scenario> = {
  normalSummon: { desc: 'Kor Kurdu normal summon (fire)', stage: { p0: { hand: ['ember_wolf'] } }, steps: [summon('ember_wolf', 1)] },
  summonWind: { desc: 'Fırtına Atmacası normal summon (wind)', stage: { p0: { hand: ['storm_hawk'] } }, steps: [summon('storm_hawk', 1)] },
  summonEarth: { desc: 'Taş Muhafız normal summon (earth)', stage: { p0: { hand: ['stone_sentinel'] } }, steps: [summon('stone_sentinel', 1)] },
  summonDark: { desc: 'Gölge Suikastçı normal summon (dark)', stage: { p0: { hand: ['shade_assassin'] } }, steps: [summon('shade_assassin', 1)] },
  summonWater: { desc: 'Gelgit Golemi normal summon (water)', stage: { p0: { hand: ['tide_golem'] } }, steps: [summon('tide_golem', 1)] },
  lumenGain: { desc: 'Işık Perisi summon + 500 LP', stage: { p0: { hand: ['lumen_sprite'] } }, steps: [summon('lumen_sprite', 0)] },
  p2Summon: { desc: 'player 2 summons from the hidden hand (Şimşek Kertenkelesi)', stage: { active: 1, p1: { hand: ['volt_lizard'] } }, steps: [summon('volt_lizard', 1, [], 1)] },
  tributeWyrm: {
    desc: 'Kristal Ejder tribute summon (2 tributes, cut-in)',
    stage: { p0: { hand: ['crystal_wyrm'], monsters: ['stone_sentinel', null, 'lumen_sprite'] } },
    steps: [summon('crystal_wyrm', 1, ['stone_sentinel', 'lumen_sprite'])],
  },
  tributeTitan: { desc: 'Magma Titanı tribute summon + 500 burn', stage: { p0: { hand: ['magma_titan'], monsters: [null, 'storm_hawk'] } }, steps: [summon('magma_titan', 1, ['storm_hawk'])] },
  tributeMagus: {
    desc: 'Uçurum Büyücüsü tribute summon → destroys a set card',
    stage: { p0: { hand: ['abyss_magus'], monsters: ['shade_assassin'] }, p1: { spellTraps: [null, 'chains_of_light'] } },
    steps: [summon('abyss_magus', 0, ['shade_assassin']), { type: 'chooseTarget', player: 0, target: { player: 1, zone: 'spellTrap', index: 1 } }],
  },
  setAndFlip: {
    desc: 'set monster, set trap, flip summon Dikenli Pusucu → destroys a monster',
    stage: { p0: { hand: ['tide_golem', 'mirror_barrier'], monsters: [{ id: 'thorn_lurker', faceUp: false }] }, p1: { monsters: [null, 'ember_wolf'] } },
    steps: [
      (D) => ({ type: 'setMonster', player: 0, uid: D.uid('tide_golem', 0), zone: 2, tributes: [] }),
      (D) => ({ type: 'setSpellTrap', player: 0, uid: D.uid('mirror_barrier', 0), zone: 1 }),
      { type: 'flipSummon', player: 0, zone: 0 },
      { type: 'chooseTarget', player: 0, target: { player: 1, zone: 'monster', index: 1 } },
    ],
  },
  position: {
    desc: 'position changes both ways',
    stage: { p0: { monsters: ['stone_sentinel', { id: 'tide_golem', position: 'defense' }] } },
    steps: [
      { type: 'changePosition', player: 0, zone: 0 },
      { type: 'changePosition', player: 0, zone: 1 },
    ],
  },
  atkTargetDestroyed: {
    desc: 'Kristal Ejder (prism beam) destroys Uçurum Büyücüsü',
    stage: { phase: 'battle', p0: { monsters: [null, 'crystal_wyrm'] }, p1: { monsters: [null, 'abyss_magus'] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 1, targetZone: 1 }],
  },
  atkAttackerDestroyed: {
    desc: 'Kor Kurdu attacks a stronger monster and shatters',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [null, 'abyss_magus'] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 0, targetZone: 1 }],
  },
  atkBoth: {
    desc: 'equal ATK: both destroyed (+ 2 × Şimşek Kertenkelesi burn)',
    stage: { phase: 'battle', p0: { monsters: [null, 'volt_lizard'] }, p1: { monsters: ['volt_lizard'] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 1, targetZone: 0 }],
  },
  atkBlocked: {
    desc: 'Işık Perisi hits a higher DEF: blocked, attacker takes damage',
    stage: { phase: 'battle', p0: { monsters: [null, null, 'lumen_sprite'] }, p1: { monsters: [{ id: 'stone_sentinel', position: 'defense' }] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 2, targetZone: 0 }],
  },
  atkVsDefTide: {
    desc: 'Magma Titanı punches a defending Gelgit Golemi (+ golem counter 300)',
    stage: { phase: 'battle', p0: { monsters: ['magma_titan'] }, p1: { monsters: [null, { id: 'tide_golem', position: 'defense' }] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 0, targetZone: 1 }],
  },
  atkDirectHawk: {
    desc: 'Fırtına Atmacası direct attack over a defender',
    stage: { phase: 'battle', p0: { monsters: [null, 'storm_hawk'] }, p1: { monsters: ['stone_sentinel'] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 1, targetZone: null }],
  },
  atkDirectShade: { desc: 'Gölge Suikastçı direct attack', stage: { phase: 'battle', p0: { monsters: ['shade_assassin'] } }, steps: [{ type: 'attack', player: 0, attackerZone: 0, targetZone: null }] },
  atkShade: {
    desc: 'Gölge Adımı: shadow step behind Işık Perisi',
    stage: { phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: ['lumen_sprite'] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 0, targetZone: 0 }],
  },
  atkPierce: {
    desc: 'Mercan Yılanı water jet pierces a face-down defender (flip + piercing damage)',
    stage: { phase: 'battle', p0: { monsters: [null, 'coral_serpent'] }, p1: { monsters: [null, { id: 'storm_hawk', faceUp: false }] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 1, targetZone: 1 }],
  },
  atkFlipLurker: {
    desc: 'attack a face-down Dikenli Pusucu: flip, FLIP effect by the defender',
    stage: { phase: 'battle', p0: { monsters: ['stone_sentinel', 'ember_wolf'] }, p1: { monsters: [null, { id: 'thorn_lurker', faceUp: false }] } },
    steps: [
      { type: 'attack', player: 0, attackerZone: 1, targetZone: 1 },
      { type: 'chooseTarget', player: 1, target: { player: 0, zone: 'monster', index: 0 } },
    ],
  },
  atkWolfBurn: {
    desc: 'Kor Kurdu destroys Işık Perisi + 300 burn',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [null, null, 'lumen_sprite'] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 0, targetZone: 2 }],
  },
  atkGolemWave: {
    desc: 'Gelgit Golemi wave vs Gölge Suikastçı',
    stage: { phase: 'battle', p0: { monsters: ['tide_golem'] }, p1: { monsters: ['shade_assassin'] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 0, targetZone: 0 }],
  },
  atkBoulder: {
    desc: 'Taş Muhafız boulder vs Fırtına Atmacası',
    stage: { phase: 'battle', p0: { monsters: [null, 'stone_sentinel'] }, p1: { monsters: [null, 'storm_hawk'] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 1, targetZone: 1 }],
  },
  atkP2: {
    desc: 'player 2 attacks (mirrored): Uçurum Büyücüsü dark orb vs Kor Kurdu',
    stage: { phase: 'battle', active: 1, p1: { monsters: [null, 'abyss_magus'] }, p0: { monsters: [null, 'ember_wolf'] } },
    steps: [{ type: 'attack', player: 1, attackerZone: 1, targetZone: 1 }],
  },
  trapMirror: {
    desc: 'Ayna Kalkanı destroys every attacking-side monster in attack position',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf', 'magma_titan'] }, p1: { monsters: [null, 'stone_sentinel'], spellTraps: [null, 'mirror_barrier'] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 0, targetZone: 1 }, (D) => ({ type: 'respond', player: 1, uid: D.uid('mirror_barrier', 1) })],
  },
  trapChains: {
    desc: 'Işık Zincirleri negates the attack and ends the battle (turn passes)',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [null, 'lumen_sprite'], spellTraps: ['chains_of_light'] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 0, targetZone: 1 }, (D) => ({ type: 'respond', player: 1, uid: D.uid('chains_of_light', 1) })],
  },
  trapDecline: {
    desc: 'trap window declined, direct attack goes through',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { spellTraps: ['chains_of_light'] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 0, targetZone: null }, { type: 'respond', player: 1, uid: null }],
  },
  trapChasm: {
    desc: 'Yer Yarığı swallows a freshly summoned monster',
    stage: { p0: { hand: ['shade_assassin'] }, p1: { spellTraps: [null, null, 'chasm_trap'] } },
    steps: [summon('shade_assassin', 1), (D) => ({ type: 'respond', player: 1, uid: D.uid('chasm_trap', 1) })],
  },
  equipBlade: {
    desc: 'Ejder Kılıcı from the hand on Gölge Suikastçı',
    stage: { p0: { hand: ['dragon_blade'], monsters: [null, 'shade_assassin'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('dragon_blade', 0), zone: 1, target: { kind: 'monster', ref: { player: 0, zone: 'monster', index: 1 } } })],
  },
  equipSetBlade: {
    desc: 'a set Ejder Kılıcı activated on Kor Kurdu',
    stage: { p0: { spellTraps: ['dragon_blade'], monsters: ['ember_wolf'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('dragon_blade', 0), target: { kind: 'monster', ref: { player: 0, zone: 'monster', index: 0 } } })],
  },
  fieldVolcano: {
    desc: 'Volkan Arenası: FIRE +500, WATER −300',
    stage: { p0: { hand: ['volcano_arena'], monsters: ['ember_wolf', 'tide_golem'] }, p1: { monsters: [null, 'magma_titan', 'coral_serpent'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('volcano_arena', 0) })],
  },
  fieldReplace: {
    desc: 'a new Volkan Arenası replaces the opponent\'s',
    stage: { p0: { hand: ['volcano_arena'], monsters: ['ember_wolf'] }, p1: { field: 'volcano_arena' } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('volcano_arena', 0) })],
  },
  bolt: {
    desc: 'Yıldırım Hükmü on an equipped Kristal Ejder',
    stage: { p0: { hand: ['judgment_bolt'] }, p1: { monsters: [null, 'crystal_wyrm'], spellTraps: [null, { id: 'dragon_blade', equippedTo: 1 }] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('judgment_bolt', 0), target: { kind: 'monster', ref: { player: 1, zone: 'monster', index: 1 } } })],
  },
  boltSet: {
    desc: 'a set Yıldırım Hükmü on a face-down monster',
    stage: { p0: { spellTraps: [null, 'judgment_bolt'] }, p1: { monsters: [{ id: 'thorn_lurker', faceUp: false }] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('judgment_bolt', 0), target: { kind: 'monster', ref: { player: 1, zone: 'monster', index: 0 } } })],
  },
  heal: { desc: 'Şifa Pınarı +1000', stage: { p0: { hand: ['healing_spring'], lp: 2000 } }, steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('healing_spring', 0) })] },
  revive: {
    desc: 'Ruh Çağrısı revives the opponent\'s Magma Titanı (+ its burn)',
    stage: { p0: { hand: ['soul_recall'] }, p1: { graveyard: ['magma_titan'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('soul_recall', 0), target: { kind: 'graveyard', uid: D.uid('magma_titan', 1), toZone: 2 } })],
  },
  endTurnDraw: { desc: 'end turn → turn banner → draw', stage: { p0: { monsters: ['ember_wolf'] }, p1: { deck: ['crystal_wyrm', 'judgment_bolt'] } }, steps: [{ type: 'endTurn', player: 0 }] },
  discard: {
    desc: 'end phase hand limit: discard',
    stage: { p0: { hand: ['ember_wolf', 'tide_golem', 'storm_hawk', 'judgment_bolt', 'healing_spring', 'soul_recall', 'mirror_barrier'] } },
    steps: [{ type: 'endTurn', player: 0 }, (D) => ({ type: 'discard', player: 0, uids: [D.uid('storm_hawk', 0)] })],
  },
  deckOut: { desc: 'player 2 cannot draw: deck out', stage: { p1: { deck: [] } }, steps: [{ type: 'endTurn', player: 0 }] },
  lethal: { desc: 'lethal direct attack → game over', stage: { phase: 'battle', p0: { monsters: ['crystal_wyrm'] }, p1: { lp: 1000 } }, steps: [{ type: 'attack', player: 0, attackerZone: 0, targetZone: null }] },
  surrender: { desc: 'player 2 surrenders', stage: {}, steps: [{ type: 'surrender', player: 1 }] },
};

// Extra scenario packs: any `src/duel/scenarios/<name>.ts` with `export default { [name]: Scenario }`
// is merged in (later packs override earlier names). Cinematic authors add their own packs here.
for (const mod of Object.values(import.meta.glob<{ default: Record<string, Scenario> }>('./scenarios/*.ts', { eager: true }))) {
  Object.assign(SCENARIOS, mod.default ?? {});
}

// ---------------------------------------------------------------- 5-lane centring (?zones=5)
//
// The packs above were written for 3 + 3 zones (indices 0..2). On the 5-lane board those sit on the
// LEFT three lanes, so every stage that was authored for 3 zones (no explicit `zones: 5`, no index
// above 2 anywhere) is shifted one lane to the right — stage indices (monsters, spellTraps,
// equippedTo) and every zone number of its steps (action zone / attackerZone / targetZone, target
// refs, UI steps' zone / unit points). The scenarios of the zones5 pack (key z5*) and every stage
// that uses a zone above 2 are left alone. With 3 lanes nothing is touched: the getters return the
// authored objects. Lazy (first read), because the lane count is only known once layout.ts loaded.

/** Lane shift that centres the block of zone indices a scenario uses on the centre zone (2 of 5). */
function laneShiftFor(st: StageSpec, steps: Step[]): number {
  let lo = 99, hi = -1;
  const use = (i: number) => { lo = Math.min(lo, i); hi = Math.max(hi, i); };
  for (const side of [st.p0, st.p1]) {
    side?.monsters?.forEach((m, i) => { if (m) use(i); });
    side?.spellTraps?.forEach((m, i) => { if (m) use(i); });
  }
  for (const s of steps) {
    if (typeof s === 'function') continue;
    const o = s as unknown as Record<string, unknown>;
    for (const k of ['zone', 'attackerZone', 'targetZone']) if (typeof o[k] === 'number') use(o[k] as number);
  }
  if (hi < 0) return 1;
  return Math.max(0, Math.floor(2 - (lo + hi) / 2));
}


function lanes(): number {
  return (globalThis as { __NEON_LANES?: number }).__NEON_LANES ?? 3;
}

function stageIsThreeZone(st: StageSpec): boolean {
  if (st.zones === 5) return false;
  for (const side of [st.p0, st.p1]) {
    if (!side) continue;
    if ((side.monsters?.length ?? 0) > 3 || (side.spellTraps?.length ?? 0) > 3) return false;
  }
  return true;
}

function shiftStage(st: StageSpec, LANE_SHIFT: number): StageSpec {
  const side = (s: StageSpec['p0']): StageSpec['p0'] => {
    if (!s) return s;
    const o = { ...s };
    if (s.monsters) o.monsters = [...Array.from({ length: LANE_SHIFT }, () => null), ...s.monsters];
    if (s.spellTraps)
      o.spellTraps = [
        ...Array.from({ length: LANE_SHIFT }, () => null),
        ...s.spellTraps.map((x) => (x && typeof x === 'object' && x.equippedTo !== undefined ? { ...x, equippedTo: x.equippedTo + LANE_SHIFT } : x)),
      ];
    return o;
  };
  return { ...st, p0: side(st.p0), p1: side(st.p1) };
}

/** Shift every zone number of an action (or UI step) by one lane. Pure: returns a new object. */
function shiftStep(st: Action | UiStep, LANE_SHIFT: number): Action | UiStep {
  const o = { ...(st as unknown as Record<string, unknown>) };
  for (const k of ['zone', 'attackerZone', 'targetZone']) if (typeof o[k] === 'number') o[k] = (o[k] as number) + LANE_SHIFT;
  const ref = (r: unknown): unknown => {
    if (!r || typeof r !== 'object') return r;
    const q = { ...(r as Record<string, unknown>) };
    if (typeof q.index === 'number' && (q.zone === 'monster' || q.zone === 'spellTrap')) q.index += LANE_SHIFT;
    if (q.ref) q.ref = ref(q.ref);
    return q;
  };
  if (o.target) o.target = ref(o.target);
  const at = o.at as Record<string, unknown> | undefined;
  if (at && typeof at === 'object') {
    const a = { ...at };
    if (Array.isArray(a.zone) && (a.zone[1] === 'monster' || a.zone[1] === 'spellTrap')) a.zone = [a.zone[0], a.zone[1], (a.zone[2] as number) + LANE_SHIFT];
    if (Array.isArray(a.unit)) a.unit = [a.unit[0], (a.unit[1] as number) + LANE_SHIFT];
    o.at = a;
  }
  return o as unknown as Action | UiStep;
}

function shiftStepFn(st: Step, sh: number): Step {
  if (typeof st === 'function') return (D) => {
    const a = st(D);
    return a ? (shiftStep(a, sh) as Action) : a;
  };
  return shiftStep(st, sh) as Step;
}

for (const [key, sc] of Object.entries(SCENARIOS)) {
  if (/^z5/.test(key)) continue;
  const stage = sc.stage;
  const steps = sc.steps;
  let cache: { stage: StageSpec; steps: Step[] } | null = null;
  const resolved = () => {
    if (lanes() !== 5 || !stageIsThreeZone(stage)) return null;
    if (!cache) {
      const sh = laneShiftFor(stage, steps);
      cache = { stage: shiftStage(stage, sh), steps: steps.map((x) => shiftStepFn(x, sh)) };
    }
    return cache;
  };
  Object.defineProperty(sc, 'stage', { configurable: true, enumerable: true, get: () => resolved()?.stage ?? stage });
  Object.defineProperty(sc, 'steps', { configurable: true, enumerable: true, get: () => resolved()?.steps ?? steps });
}
