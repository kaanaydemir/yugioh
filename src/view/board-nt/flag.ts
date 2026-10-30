// Neon Tower arena switch (docs/v3/ARENA_NEON_TOWER.md §1). FINAL PHASE (owner C): under the v3 look the
// Neon Tower arena is now the DEFAULT. `?arena=old` (alias `?arena=calm`) keeps the previous v3 arena (the calm
// blue stadium: BoardViewCalm), `?arena=nt` forces the new one; globalThis.__NEON_ARENA_NT = true | false before
// boot overrides both. v1 never changes (no NT code runs and no NT texture is built without the v3 look).
//
// layout.ts is NOT touched: its ?arena= reader only knows 'v1' / 'v2' (any other value, 'nt'
// included, falls through to 'v1') and ignores the param completely under LOOK_V3.
//
// Decided once at module init, like the look. Every NT module checks ARENA_NT; with the v1 look it
// is always false, so no NT code runs and no NT texture is built.

import { LOOK_V3 } from '../layout';

/** The default after the final phase's flip (docs §10): the Neon Tower arena under the v3 look. */
export const DEFAULT_ON = true;

function detect(): boolean {
  if (!LOOK_V3) return false;
  try {
    const g = (globalThis as { __NEON_ARENA_NT?: unknown }).__NEON_ARENA_NT;
    if (g === true || g === false) return g;
    if (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined') {
      const a = new URLSearchParams(location.search).get('arena');
      if (a === 'nt') return true;
      if (a === 'old' || a === 'calm') return false;
    }
  } catch {
    /* no globals (tests, workers): fall through */
  }
  return DEFAULT_ON;
}

/** The Neon Tower arena is active (v3 look only). */
export const ARENA_NT: boolean = detect();

function detectDebug(): number {
  try {
    if (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined') {
      const n = Number(new URLSearchParams(location.search).get('ntdebug'));
      return Number.isFinite(n) ? n : 0;
    }
  } catch {
    /* ignore */
  }
  return 0;
}

/**
 * ?ntdebug=1 outlines the layout map (src/view/board-nt/layout-nt.ts) over the arena and labels each
 * rect; 2 also draws every layer's placeholder swatch at its real depth. QA / dev only.
 */
export const NT_DEBUG: number = ARENA_NT ? detectDebug() : 0;
