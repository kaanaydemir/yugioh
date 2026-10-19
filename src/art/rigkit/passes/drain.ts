// rigkit / passes / drain — the inner light retreats into the core (crystal death; A2 wyrm).
//
// COPIED from crystal_wyrm-rig.ts drainFront / drainedAt / DRAIN / drainLight, with the core point
// passed in (the wyrm kept it in a module singleton). drain → 1: the light leaves the extremities
// first; revive runs it back (drain → 0).

import { PAL } from '../../palette';
import type { PixelCanvas } from '../../pixel';
import type { StepTable } from '../composite';
import type { V } from '../geom';

/** One value down every ramp: what is left of the crystal once its light has gone out (A2 DRAIN). */
export const DRAIN_A2: StepTable = Object.freeze({
  [PAL.white]: PAL.mist,
  [PAL.mist]: PAL.steel,
  [PAL.steel]: PAL.night3,
  [PAL.night4]: PAL.night3,
  [PAL.night3]: PAL.night2,
  [PAL.night2]: PAL.night1,
  [PAL.night1]: PAL.night0,
  [PAL.cyan4]: PAL.cyan3,
  [PAL.cyan3]: PAL.cyan2,
  [PAL.cyan2]: PAL.cyan1,
  [PAL.cyan1]: PAL.cyan0,
  [PAL.cyan0]: PAL.night1,
  [PAL.gold4]: PAL.gold3,
  [PAL.gold3]: PAL.gold2,
  [PAL.gold2]: PAL.gold1,
  [PAL.gold1]: PAL.gold0,
  [PAL.crim1]: PAL.night1,
});

export interface DrainShape {
  /** px the front covers from drain 0 to 1. A2: 80. */
  readonly reach?: number;
  /** px the front starts inside the core. A2: 4. */
  readonly inset?: number;
}

/** Radius of the drain front: pixels farther from the core than this have lost their light. */
export function drainFront(drain: number, s: DrainShape = {}): number {
  return drain <= 0 ? Infinity : (1 - drain) * (s.reach ?? 80) - (s.inset ?? 4);
}

/** Has the light drained from pixel (x, y)? */
export function drainedAt(core: V, drain: number, x: number, y: number, s?: DrainShape): boolean {
  return Math.hypot(x + 0.5 - core[0], y + 0.5 - core[1]) > drainFront(drain, s);
}

/** Beyond the front every tone is one value down (`table`, default DRAIN_A2). */
export function drainLight(p: PixelCanvas, core: V, drain: number, o: DrainShape & { readonly table?: StepTable } = {}) {
  const table = o.table ?? DRAIN_A2;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const cur = p.get(x, y);
      if (cur === null || !drainedAt(core, drain, x, y, o)) continue;
      const to = table[cur];
      if (to !== undefined) p.set(x, y, to);
    }
}
