// v3 motion preference, the A6 time table and whole-pixel curves — contract S-6 (docs/v3/A6_PLAN.md
// §1.3, §4.1, §4.4 KO-2 / KO-6 / KO-9; A5_PLAN.md reads REDUCED_MOTION too). Written in A56.0 and
// FROZEN: the lanes read it, never change it (changes only through the orchestrator).
//
//   import { A6_MS, REDUCED_MOTION, budgetMs, overshoot, settle, snap } from '../view/v3/motion';
//   const ms = budgetMs(A6_MS.set);                 // 400 (300 with reduced motion)
//   card.y = settle(y0, y1, t);                      // whole pixels, monotonic, ends exactly on y1
//   card.x = overshoot(2)(x0, x1, t);                // at most 2 px past x1, then back (none if reduced)
//
// REDUCED_MOTION (KO-9: no shake, no overshoot, no breathing, no trails; durations ≤ normal) comes
// from the OS (`prefers-reduced-motion: reduce`) or the URL (`?motion=reduced`); tests set
// globalThis.__NEON_MOTION = 'reduced' | 'full' before this module loads. It is a v3 setting: in v1
// it is always false (v1 stays exactly as it is).

import { LOOK_V3 } from '../layout';

// ---------------------------------------------------------------- reduced motion

/** Reduced motion from the inputs (pure). `param` is ?motion=, `override` globalThis.__NEON_MOTION. */
export function resolveReducedMotion(i: { look: boolean; mediaReduce?: boolean; param?: string | null; override?: string | null }): boolean {
  if (!i.look) return false;
  const o = (i.override ?? '').toLowerCase();
  if (o === 'reduced') return true;
  if (o === 'full') return false;
  const p = (i.param ?? '').toLowerCase();
  if (p === 'reduced') return true;
  if (p === 'full') return false;
  return !!i.mediaReduce;
}

function detectReducedMotion(): boolean {
  let mediaReduce = false;
  let param: string | null = null;
  let override: string | null = null;
  try {
    if (typeof matchMedia === 'function') mediaReduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    /* no media queries */
  }
  try {
    if (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined') param = new URLSearchParams(location.search).get('motion');
  } catch {
    /* no location */
  }
  try {
    const g = (globalThis as { __NEON_MOTION?: unknown }).__NEON_MOTION;
    if (typeof g === 'string') override = g;
  } catch {
    /* ignore */
  }
  return resolveReducedMotion({ look: LOOK_V3, mediaReduce, param, override });
}

/** Reduced motion is asked for (v3 only; decided once at module init). */
export const REDUCED_MOTION: boolean = detectReducedMotion();

// ---------------------------------------------------------------- A6_MS (A6 §1.3)

/**
 * One row of the A6 time table (game ms at 1×, from the start of the event / action):
 *  - today   the current v3 value it replaces (measure-v3-pilot.json / A0 opening.txt)
 *  - max     the A6 target (the event's whole presentation); min where the plan gives a range
 *  - lock    the part that keeps the input locked (≤ today wherever both exist: KO-6)
 *  - tail    ornament after the input returns (≤ 250 ms, cancelled by the next action: KO-6)
 *  - reduced the target with reduced motion, where the storyboard gives one (≤ max: KO-9)
 *  - keys    the measure / film keys the row is checked on
 */
export interface MsRow {
  readonly today?: number;
  readonly min?: number;
  readonly max: number;
  readonly lock?: number;
  readonly tail?: number;
  readonly reduced?: number;
  readonly keys: readonly string[];
  readonly note: string;
}

const row = (r: MsRow): MsRow => Object.freeze({ ...r, keys: Object.freeze([...r.keys]) });

/** The A6 time table (A6_PLAN.md §1.3, every row). No budget is raised over today's v3 value. */
export const A6_MS = Object.freeze({
  /** The opening (gameStart) film: today 5333 ms, A0 target ≤ 5.5 s; skippable ×4 as today. */
  gameStart: row({ today: 5333, max: 5333, keys: ['opening'], note: '?mode=hotseat&seed=1&holdIntro=1 — to input' }),
  /** skipIntro opening + the first turn. */
  skipIntro: row({ today: 2750, max: 2750, keys: ['openingSkip'], note: 'skipIntro opening + first turn' }),
  /** The HUD's arrival (whole-pixel slide); never locks. */
  hudIn: row({ today: 17, min: 160, max: 240, lock: 0, keys: ['opening', 'openingSkip'], note: 'today: one frame' }),
  /** End of turn → input for the next player. */
  turnCycle: row({ today: 2033, max: 1250, keys: ['flowTurnP1', 'flowEndPhase'], note: 'endTurn → inputReady' }),
  /** turnStart. */
  turnStart: row({ today: 1166, max: 600, lock: 450, keys: ['flowTurnP1', 'flowTurnP2'], note: 'turnStart event' }),
  /** phaseChange draw / main / end. */
  phaseChange: row({ today: 183, max: 150, lock: 120, keys: ['flowEndPhase'], note: 'today 150–183' }),
  /** phaseChange to battle. */
  phaseBattle: row({ today: 1216, max: 300, lock: 300, tail: 250, keys: ['flowBattle', 'flowBattleP2'], note: 'phaseChange battle' }),
  /** draw (deck → hand). */
  draw: row({ today: 366, min: 330, max: 360, lock: 330, keys: ['flowTurnP1', 'endTurnDraw'], note: 'draw event' }),
  /** setMonster / setSpellTrap. */
  set: row({ today: 767, max: 400, lock: 400, tail: 200, reduced: 300, keys: ['smbSetMonster', 'smbSetP2'], note: 'set event (K4)' }),
  /** Tribute set: the tribute (≤ 500) then the set (≤ 400). */
  setTribute: row({ today: 1200, max: 900, keys: ['smbSetTribute'], note: 'tribute 433 + set 767 today; ≤ 500 + 400' }),
  /** discard, one card. */
  discard: row({ today: 983, max: 800, keys: ['flowDiscard', 'flowDiscardP2'], note: 'discard event' }),
  /** discard, two cards. */
  discard2: row({ today: 1166, max: 950, keys: ['flowDiscard2'], note: 'two discards' }),
  /** lpGain. */
  lpGain: row({ today: 583, max: 400, keys: ['lumenGain', 'spHeal'], note: 'lpGain event' }),
  /** LP flow of a damage (A2). */
  lpDamage: row({ today: 400, max: 400, keys: ['atkTargetDestroyed'], note: 'damage LP roll' }),
  /** Decision, SUMMON window, CPU / scenario response: no card marking (S-15). */
  decisionFast: row({ today: 317, max: 120, lock: 120, keys: ['tbChasm'], note: 'summon end → activate' }),
  /** Decision, attack window or a human response (the marking stays). */
  decision: row({ today: 317, max: 300, lock: 300, keys: ['trapDecline', 'tbDecline'], note: 'decision event' }),
  /** deckOut. */
  deckOut: row({ today: 2650, max: 1400, keys: ['flowDeckOut', 'flowDeckOutP1'], note: 'deckOut event' }),
  /** gameOver (to the game-over prompt; the plan's range 3000–3500 around today's 3450). */
  gameOver: row({ today: 3450, min: 3000, max: 3500, keys: ['flowLethal', 'flowLethalP2', 'flowSurrender'], note: 'gameOver event' }),
  /** Target pick: the candidates' marks are up (never locks). */
  targetsVisible: row({ today: 17, max: 100, lock: 0, keys: ['a6TargetSpell'], note: 'today < 1 frame (floor only)' }),
  /** Invalid click: the answer starts within one frame and is over by 180 ms (never locks). */
  invalidClick: row({ min: 0, max: 180, lock: 0, keys: ['a6Invalid', 'a6Reject'], note: 'starts ≤ 1 frame (17 ms)' }),
  /** Graveyard panel open. */
  gravePanelOpen: row({ max: 220, keys: ['a6Grave'], note: 'panel mode' }),
  /** Graveyard panel close. */
  gravePanelClose: row({ max: 140, keys: ['a6Grave'], note: 'panel mode' }),
  /** Any ornament tail after the input returns (KO-6). */
  tail: row({ max: 250, keys: [], note: 'cancellable by the next action' }),
} satisfies Record<string, MsRow>);

export type A6MsKey = keyof typeof A6_MS;

/** A row's target for this page: `reduced` (or max) with reduced motion, else max. */
export function budgetMs(r: MsRow, reduced: boolean = REDUCED_MOTION): number {
  return reduced ? Math.min(r.max, r.reduced ?? r.max) : r.max;
}

// ---------------------------------------------------------------- whole-pixel curves (KO-2)

/** A whole-pixel motion curve: position at t ∈ [0, 1] from `from` to `to` (integers out). */
export type PxCurve = (from: number, to: number, t: number) => number;

const clamp01 = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t);

/** Round to a whole pixel (never -0). */
export function snap(v: number): number {
  const r = Math.round(v);
  return r === 0 ? 0 : r;
}

/**
 * Settle: a decelerating move on whole pixels (ease-out cubic, rounded). Monotonic, starts on
 * snap(from) and ends exactly on snap(to) at t = 1.
 */
export const settle: PxCurve = (from, to, t) => {
  const k = clamp01(t);
  if (k >= 1) return snap(to);
  const e = 1 - (1 - k) * (1 - k) * (1 - k);
  return snap(from + (to - from) * e);
};

/**
 * The overshoot curve itself (ignores REDUCED_MOTION): ease-out to `px` whole pixels past `to`
 * (capped at 2 px and at the move's own length, KO-2) by t = 0.7, then back onto `to` by t = 1.
 */
export function overshootCurve(px: number): PxCurve {
  const o = Math.max(0, Math.min(2, Math.round(px)));
  return (from, to, t) => {
    const k = clamp01(t);
    if (k >= 1) return snap(to);
    const dist = to - from;
    const over = Math.min(o, Math.abs(Math.round(dist))) * Math.sign(dist);
    if (k < 0.7) {
      const u = k / 0.7;
      const e = 1 - (1 - u) * (1 - u);
      return snap(from + (dist + over) * e);
    }
    const u = (k - 0.7) / 0.3;
    const e = u * u * (3 - 2 * u);
    return snap(to + over * (1 - e));
  };
}

/** Overshoot by at most `px` (≤ 2) whole pixels, then settle. With REDUCED_MOTION: plain settle (KO-9). */
export function overshoot(px: number, reduced: boolean = REDUCED_MOTION): PxCurve {
  return reduced ? settle : overshootCurve(px);
}

/** Step `n` evenly spaced whole-pixel stops between from and to (for stepped slides); n ≥ 1. */
export function pxSteps(from: number, to: number, n: number): number[] {
  const k = Math.max(1, Math.round(n));
  const out: number[] = [];
  for (let i = 1; i <= k; i++) out.push(snap(from + ((to - from) * i) / k));
  return out;
}
