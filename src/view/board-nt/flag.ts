// Neon Tower arena switch (docs/v3/ARENA_NEON_TOWER.md §1). Development phase: the new arena is
// OPT-IN with ?look=v3&arena=nt (or globalThis.__NEON_ARENA_NT = true before boot); the calm v3
// arena stays the default, v1 never changes. The final phase (owner C) flips the default HERE and
// nowhere else: change `DEFAULT_ON` to true (and keep `?arena=calm` as the opt-out).
//
// layout.ts is NOT touched: its ?arena= reader only knows 'v1' / 'v2' (any other value, 'nt'
// included, falls through to 'v1') and ignores the param completely under LOOK_V3.
//
// Decided once at module init, like the look. Every NT module checks ARENA_NT; with the v1 look it
// is always false, so no NT code runs and no NT texture is built.

import { LOOK_V3 } from '../layout';

/** The default after the final phase's flip (docs §10). Development: false. */
export const DEFAULT_ON = false;

function detect(): boolean {
  if (!LOOK_V3) return false;
  try {
    const g = (globalThis as { __NEON_ARENA_NT?: unknown }).__NEON_ARENA_NT;
    if (g === true || g === false) return g;
    if (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined') {
      const a = new URLSearchParams(location.search).get('arena');
      if (a === 'nt') return true;
      if (a === 'calm') return false;
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
