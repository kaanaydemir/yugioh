// Scenario pack of lane A6-B (docs/v3/A6_PLAN.md §5.3): a6TargetAttack, a6TrapPrompt, a6TrapOpen, a6Curtain, a6LpBig, a6Block, a6Defeat.
// A56.0: created empty so the pack exists from day one; the lane fills it (Action steps and / or UI
// steps: src/duel/scenarios.ts UiStep). Shared UI scenarios live in ./a6-base.ts (frozen).
//
// B1 (F1 / F2): a6EndPhaseP2 — the P2 side of flowEndPhase (P2 leaves its battle phase, end phase,
// then P1's turn start and draw), so the turn / phase motion is filmed from both seats.
// B2 (F3): a6LpBig — 3000 damage at once (Uçurum Büyücüsü + Ejder Kılıcı, a direct attack: P2's
// counter counts 4000 → 1000, the 3-px shake), a6LpBigP2 its mirror (P1's panel), a6LowLpP1 — P1
// under 1000 LP when the turn passes to P1 (the low-LP pulse on the bottom panel; flowTurnLowLp is
// P2's).
// B3 (F4 / F5): a6TargetAttack — the attacker picked (white corners), a click on an own monster
// (invalid: the reject stamp, the attacker's corners one crimson frame), then a valid target;
// a6TributeUi — Kristal Ejder's two tributes picked by hand (white corners + "1/2"), an empty tile
// in between (invalid), then the zone; the P2 twins a6TargetSpellP2, a6InvalidP2, a6TargetAttackP2
// (the shared a6TargetSpell / a6Invalid of a6-base.ts mirrored: P2 at the screen, hot-seat).
// B4 (F6 / F7): a6Block — P2's Şimşek Kertenkelesi into P1's Taş Muhafız in defense (the block's shield +
// "BLOK", 600 recoil on P2's panel; atkBlocked / smbFlipAttacked are P1's); a6TrapPrompt — P1 attacks
// directly, P2 is asked (two traps on the prompt plate: hover, pick the 2nd, Esc = GEÇ); a6TrapPromptP2 its
// mirror (P1 asked, the plate bottom right); a6TrapOpen — a SUMMON window answered by a person (the
// S-15 fast decision, the marks come with the prompt; Enter = AÇ: Yer Yarığı opens); a6DeclineP2 — P2's
// attack, P1's scripted "Geç" (the marks on P1's side cool down); a6Curtain — hot-seat with the curtain:
// P1 ends the turn, the hand turns face down, the plate "SIRA: OYUNCU 2", a tap, P2's hand turns up;
// a6CurtainTrap — the trap question's curtain ("TUZAK SORUSU: OYUNCU 2"), the prompt, GEÇ, and the
// curtain back to P1. The prompt's cards / buttons are UI targets { trapPrompt: i | 'open' | 'pass' }
// (src/view/v3/TrapPromptV3.ts; skipped in v1 — the keys answer there too).
//   node tools/shot.mjs "?dev=duel&s=a6TargetAttack&look=v3" --fresh --film 36 --every 50 --cols 12
import type { Action } from '../../engine/types';
import type { Scenario, Step, UiTarget } from '../scenarios';
import type { DuelViews } from '../types';

/** What the steps below use of the QA object they receive at run time (window.__neon.duel, DuelQa). */
interface QaLike {
  views: DuelViews;
  dispatch(a: Action): Promise<void>;
}

/**
 * Hot-seat with the pass-device curtain on, then `a` dispatched WITHOUT waiting for its cinematics:
 * the curtain waits for a tap inside them, which the UI steps after this one give.
 */
const withCurtain =
  (a: Action): Step =>
  (D) => {
    const q = D as unknown as QaLike;
    q.views.info.curtain = true;
    void q.dispatch(a).catch(() => undefined);
    return null;
  };

/** A card / button of the open v3 trap prompt (registered by TrapPromptV3; absent in v1: the step is skipped). */
const prompt = (at: number | 'open' | 'pass'): UiTarget => ({ trapPrompt: at }) as unknown as UiTarget;

const PACK: Record<string, Scenario> = {
  a6EndPhaseP2: {
    desc: 'P2 battle → end phase → P1 turn (the mirror of flowEndPhase)',
    stage: { active: 1, phase: 'battle', p1: { monsters: ['ember_wolf'] }, p0: { deck: ['tide_golem'] } },
    steps: [{ type: 'endTurn', player: 1 }],
  },
  a6LpBig: {
    desc: 'LP: 3000 damage at once — Uçurum Büyücüsü with Ejder Kılıcı attacks directly (P2 4000 → 1000)',
    stage: { phase: 'battle', p0: { monsters: [null, 'abyss_magus'], spellTraps: [null, { id: 'dragon_blade', equippedTo: 1 }] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 1, targetZone: null }],
  },
  a6LpBigP2: {
    desc: 'LP: 3000 damage at once on P1 — P2\'s Uçurum Büyücüsü with Ejder Kılıcı attacks directly (P1 4000 → 1000)',
    stage: { phase: 'battle', active: 1, p1: { monsters: [null, 'abyss_magus'], spellTraps: [null, { id: 'dragon_blade', equippedTo: 1 }] } },
    steps: [{ type: 'attack', player: 1, attackerZone: 1, targetZone: null }],
  },
  a6TargetAttack: {
    desc: 'UI: Battle Phase — Kristal Ejder picked as the attacker, a click on the own Kor Kurdu (invalid), then Taş Muhafız as the target',
    stage: { phase: 'battle', p0: { monsters: ['crystal_wyrm', null, 'ember_wolf'] }, p1: { monsters: ['stone_sentinel', 'volt_lizard'] } },
    steps: [
      { ui: 'move', at: { unit: [0, 0] }, ms: 120 },
      { ui: 'click', at: { unit: [0, 0] }, ms: 300 },
      { ui: 'move', at: { unit: [1, 1] }, ms: 200 },
      { ui: 'move', at: { unit: [0, 2] }, ms: 120 },
      { ui: 'click', at: { unit: [0, 2] }, ms: 300 },
      { ui: 'move', at: { unit: [1, 0] }, ms: 200 },
      { ui: 'click', at: { unit: [1, 0] } },
    ],
  },
  a6TargetAttackP2: {
    desc: 'UI, P2 at the screen: Battle Phase — Kristal Ejder picked as the attacker, a click on the own Kor Kurdu (invalid), then Taş Muhafız as the target',
    stage: { phase: 'battle', active: 1, p1: { monsters: ['crystal_wyrm', null, 'ember_wolf'] }, p0: { monsters: ['stone_sentinel', 'volt_lizard'] } },
    steps: [
      { ui: 'move', at: { unit: [1, 0] }, ms: 120 },
      { ui: 'click', at: { unit: [1, 0] }, ms: 300 },
      { ui: 'move', at: { unit: [0, 1] }, ms: 200 },
      { ui: 'move', at: { unit: [1, 2] }, ms: 120 },
      { ui: 'click', at: { unit: [1, 2] }, ms: 300 },
      { ui: 'move', at: { unit: [0, 0] }, ms: 200 },
      { ui: 'click', at: { unit: [0, 0] } },
    ],
  },
  a6TargetSpellP2: {
    desc: 'UI, P2 at the screen: Yıldırım Hükmü from the hand — menu row "activate", then the target picked on the board',
    stage: { active: 1, p1: { hand: ['judgment_bolt', 'tide_golem'] }, p0: { monsters: ['volt_lizard', 'ember_wolf'] } },
    steps: [
      { ui: 'move', at: { hand: 0 }, ms: 120 },
      { ui: 'click', at: { hand: 0 }, ms: 250 },
      { ui: 'click', at: { menu: 'activateSpell' }, ms: 250 },
      { ui: 'move', at: { zone: [0, 'monster', 1] }, ms: 150 },
      { ui: 'click', at: { zone: [0, 'monster', 1] } },
    ],
  },
  a6InvalidP2: {
    desc: "UI, P2 at the screen: while picking Yıldırım Hükmü's target, a click on an own empty tile (invalid), then a valid target",
    stage: { active: 1, p1: { hand: ['judgment_bolt', 'tide_golem'] }, p0: { monsters: ['volt_lizard', 'ember_wolf'] } },
    steps: [
      { ui: 'move', at: { hand: 0 }, ms: 120 },
      { ui: 'click', at: { hand: 0 }, ms: 250 },
      { ui: 'click', at: { menu: 'activateSpell' }, ms: 250 },
      { ui: 'move', at: { zone: [1, 'monster', 1] }, ms: 100 },
      { ui: 'click', at: { zone: [1, 'monster', 1] }, ms: 300 },
      { ui: 'move', at: { zone: [0, 'monster', 0] }, ms: 150 },
      { ui: 'click', at: { zone: [0, 'monster', 0] } },
    ],
  },
  a6TributeUi: {
    desc: 'UI: Kristal Ejder from the hand — Kurbanla Çağır (2): the first tribute marked ("1/2"), an empty tile (invalid), the second tribute, then the zone',
    stage: { p0: { hand: ['crystal_wyrm', 'tide_golem'], monsters: ['stone_sentinel', null, 'lumen_sprite'] }, p1: { monsters: [null, 'volt_lizard'] } },
    steps: [
      { ui: 'move', at: { hand: 0 }, ms: 120 },
      { ui: 'click', at: { hand: 0 }, ms: 250 },
      { ui: 'click', at: { menu: 'normalSummon' }, ms: 250 },
      { ui: 'move', at: { unit: [0, 0] }, ms: 150 },
      { ui: 'click', at: { unit: [0, 0] }, ms: 250 },
      { ui: 'move', at: { zone: [0, 'monster', 1] }, ms: 100 },
      { ui: 'click', at: { zone: [0, 'monster', 1] }, ms: 300 },
      { ui: 'move', at: { unit: [0, 2] }, ms: 150 },
      { ui: 'click', at: { unit: [0, 2] }, ms: 300 },
      { ui: 'move', at: { zone: [0, 'monster', 1] }, ms: 150 },
      { ui: 'click', at: { zone: [0, 'monster', 1] } },
    ],
  },
  a6LockQa: {
    desc: 'QA stage (no steps): two P2 monsters and a set P2 card for the engine-target lock film (V3HOOKS.target: tools/shot.mjs --eval calls lockTargets; no current card reaches the default); P2\'s 3-card mini-hand, empty P2 graveyard and the decks for the hover routing shots (inspect.showPile)',
    stage: { p0: { monsters: ['crystal_wyrm'] }, p1: { hand: ['tide_golem', 'ember_wolf', 'judgment_bolt'], monsters: ['stone_sentinel', 'volt_lizard'], spellTraps: [{ id: 'chains_of_light', faceUp: false }] } },
    steps: [],
  },
  a6Block: {
    desc: "F6: P2's Şimşek Kertenkelesi attacks P1's Taş Muhafız in defense — blocked: the shield + BLOK over its DEF, 600 recoil on P2's panel",
    stage: { phase: 'battle', active: 1, p1: { monsters: [null, 'volt_lizard'] }, p0: { monsters: [null, { id: 'stone_sentinel', position: 'defense' }] } },
    steps: [{ type: 'attack', player: 1, attackerZone: 1, targetZone: 1 }],
  },
  a6TrapPrompt: {
    desc: 'F7: Kor Kurdu attacks directly; P2 (a person) is asked — the marks, the prompt plate with two traps (hover, the 2nd picked), Esc = GEÇ',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { spellTraps: ['chains_of_light', null, 'mirror_barrier'], hand: ['tide_golem', 'volt_lizard'] } },
    steps: [
      { type: 'attack', player: 0, attackerZone: 0, targetZone: null },
      { ui: 'wait', ms: 900 },
      { ui: 'move', at: prompt(0), ms: 350 },
      { ui: 'move', at: prompt(1), ms: 250 },
      { ui: 'key', key: '2', ms: 450 },
      { ui: 'move', at: prompt('pass'), ms: 200 },
      { ui: 'key', key: 'Escape' },
    ],
  },
  a6TrapPromptP2: {
    desc: "F7, the mirror: P2's Kor Kurdu attacks directly; P1 (a person) is asked — the prompt plate bottom right, the 1st trap picked, Esc = GEÇ",
    stage: { phase: 'battle', active: 1, p1: { monsters: ['ember_wolf'] }, p0: { spellTraps: ['chains_of_light', null, 'mirror_barrier'], hand: ['tide_golem', 'volt_lizard'] } },
    steps: [
      { type: 'attack', player: 1, attackerZone: 0, targetZone: null },
      { ui: 'wait', ms: 900 },
      { ui: 'move', at: prompt(0), ms: 350 },
      { ui: 'key', key: '1', ms: 450 },
      { ui: 'key', key: 'Escape' },
    ],
  },
  a6TrapOpen: {
    desc: 'F7 / S-15: Gölge Suikastçı summoned; P2 (a person) answers the SUMMON window — the fast decision, the marks come with the prompt; Enter = AÇ: Yer Yarığı',
    stage: { p0: { hand: ['shade_assassin'] }, p1: { spellTraps: [null, null, 'chasm_trap'], hand: ['tide_golem'] } },
    steps: [
      (D) => ({ type: 'normalSummon', player: 0, uid: D.uid('shade_assassin', 0), zone: 1, tributes: [] }),
      { ui: 'wait', ms: 900 },
      { ui: 'move', at: prompt(0), ms: 400 },
      { ui: 'key', key: 'Enter' },
    ],
  },
  a6DeclineP2: {
    desc: "F7: P2's Kor Kurdu attacks directly, P1's set trap window is declined (scripted): the marks on P1's side cool down, \"Geç\"",
    stage: { phase: 'battle', active: 1, p1: { monsters: ['ember_wolf'] }, p0: { spellTraps: [null, 'chains_of_light'] } },
    steps: [
      { type: 'attack', player: 1, attackerZone: 0, targetZone: null },
      { type: 'respond', player: 0, uid: null },
    ],
  },
  a6Curtain: {
    desc: 'F7 hot-seat curtain: P1 ends the turn — the hand turns face down, "SIRA: OYUNCU 2" over the hand band, a tap, P2\'s hand turns face up',
    stage: { p0: { hand: ['ember_wolf', 'tide_golem', 'judgment_bolt'], monsters: [null, 'stone_sentinel'] }, p1: { hand: ['volt_lizard', 'healing_spring', 'mirror_barrier'], deck: ['crystal_wyrm', 'storm_hawk'] } },
    // (the second tap is v1's: its full-screen curtain listens only once its title has slammed in)
    steps: [withCurtain({ type: 'endTurn', player: 0 }), { ui: 'wait', ms: 1800 }, { ui: 'click', at: { xy: [320, 200] }, ms: 1500 }, { ui: 'key', key: 'Enter' }],
  },
  a6CurtainTrap: {
    desc: 'F7: hot-seat with the curtain — P1 attacks; "TUZAK SORUSU: OYUNCU 2", Space; the prompt, Esc = GEÇ; the curtain back to P1, Space',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'], hand: ['tide_golem', 'judgment_bolt'] }, p1: { spellTraps: ['chains_of_light'], hand: ['volt_lizard', 'storm_hawk'] } },
    // (the waits leave v1's full-screen curtain time to start listening, so the key also runs in v1)
    steps: [
      withCurtain({ type: 'attack', player: 0, attackerZone: 0, targetZone: null }),
      { ui: 'wait', ms: 1800 },
      { ui: 'key', key: ' ', ms: 1200 },
      { ui: 'key', key: 'Escape', ms: 3200 },
      { ui: 'key', key: ' ', ms: 1500 },
      { ui: 'key', key: 'Enter' },
    ],
  },
  a6LowLpP1: {
    desc: 'turn start while P1 is under 1000 LP (the low-LP pulse on the bottom panel; the mirror of flowTurnLowLp)',
    stage: { active: 1, p1: { monsters: ['ember_wolf'] }, p0: { lp: 800, deck: ['crystal_wyrm'] } },
    steps: [{ type: 'endTurn', player: 1 }],
  },
};

export default PACK;
