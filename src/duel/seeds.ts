// Duel-start resets (v3 plan A1 item 12; docs/v3/A0_ENVANTER.md §5.2 "Tohumlar", R10).
//
// Module-level random streams (unit idle phases, ambient sparks, kit noise, shatter cuts, light
// phases …) used to run on across duels, so the same scenario after __neon.duel.restart() drew
// other numbers than on a fresh page and its film differed. Every such module registers a reset
// here, and DuelScene.create calls resetAtDuelStart() first thing: each duel starts from the
// streams' INITIAL state — the state of a fresh page load (on a page's first duel the resets change
// nothing).
//
//   const SEED0 = 0x2545f491;
//   let seed = SEED0;
//   onDuelStart(() => (seed = SEED0));
//
// The frozen QA clock (main.ts) registers too: while frozen it restarts from its fixed base, so a
// film of a restarted duel is a function of the code alone (tools/shot.mjs, tools/measure.mjs).
//
// Lazily loaded modules (the cinematic kits) register when they load; until then their streams are
// fresh anyway. This module imports nothing, so it is always fully initialised before any module
// that registers here runs its top level (no import cycle can reach it half-evaluated).

const hooks = new Set<() => void>();

/** Run `fn` at every duel start (before the duel builds anything). Returns an unregister function. */
export function onDuelStart(fn: () => void): () => void {
  hooks.add(fn);
  return () => {
    hooks.delete(fn);
  };
}

/** Reset every registered stream (DuelScene.create, first thing). */
export function resetAtDuelStart(): void {
  for (const f of hooks) {
    try {
      f();
    } catch (e) {
      console.error('[seeds] duel-start reset failed', e);
    }
  }
}
