// rigkit / light — the ONE key light of a v3 frame (REHBER IŞ-1, IŞ-2; A3_MIMARI §3.1).
//
// COPIED from the slice's module singleton (crystal_wyrm-gbuf.ts LIGHT / setLight / lx) and made a
// value: a frozen Light is built from DrawOpts.lightFrom and passed to every core call that lights
// something. There is no "current light" anywhere in the core.

import type { DrawOpts } from '../types';
import { n3, norm, type V, type V3 } from './geom';

export type LightFrom = 'left' | 'right';

export interface Light {
  /** the frame edge the key light comes from: 'left' = P1 and every default sheet, 'right' = P2 relight */
  readonly from: LightFrom;
  /** 3-D unit vector toward the light: (−0.5, −0.74, 0.46) normalised, x mirrored for 'right' */
  readonly v: V3;
  /** its screen-plane direction (unit 2-D) — edge facing, shard faces, lit lips */
  readonly v2: V;
  /** −1 when the light is at the frame's left, +1 at its right */
  readonly side: -1 | 1;
  /**
   * value lift added to every lit G-buffer pixel (Raster.render). A2: 0.1 for the P2 relight (the
   * relit side shows the creature's front, turned a little away from the light: the lift keeps P2
   * as bright as P1), 0 for P1.
   */
  readonly lift: number;
  /** mirror an x offset that encodes "toward the light" (authored for the P1 light) */
  lx(dx: number): number;
}

/** The A2 key light vectors (IŞ-1). */
export const LIGHT_V_LEFT: V3 = Object.freeze(n3(-0.5, -0.74, 0.46)) as V3;
export const LIGHT_V_RIGHT: V3 = Object.freeze(n3(0.5, -0.74, 0.46)) as V3;
/** A2 value lift of the P2 relight (crystal_wyrm-gbuf.ts setLight). */
export const P2_LIFT_A2 = 0.1;

export interface LightOpts {
  /** override the P2 relight's value lift (default P2_LIFT_A2; the P1 light never lifts) */
  readonly p2Lift?: number;
}

function make(from: LightFrom, lift: number): Light {
  const v = from === 'right' ? LIGHT_V_RIGHT : LIGHT_V_LEFT;
  const side: -1 | 1 = from === 'right' ? 1 : -1;
  return Object.freeze({
    from,
    v,
    v2: Object.freeze(norm([v[0], v[1]])) as V,
    side,
    lift,
    lx: (dx: number) => (side < 0 ? dx : -dx),
  });
}

const LEFT = make('left', 0);
const RIGHT = make('right', P2_LIFT_A2);

/**
 * The light of one frame: from DrawOpts (absent → 'left'), from a LightFrom, or a Light passed
 * through. Lights are immutable values (the two A2 lights are shared frozen constants).
 */
export function lightOf(o?: DrawOpts | LightFrom | Light, opts?: LightOpts): Light {
  if (o !== undefined && typeof o !== 'string' && 'v' in o && opts === undefined) return o;
  const from: LightFrom = o === undefined ? 'left' : typeof o === 'string' ? o : 'v' in o ? o.from : (o.lightFrom ?? 'left');
  if (from === 'left') return LEFT;
  if (opts?.p2Lift === undefined || opts.p2Lift === P2_LIFT_A2) return RIGHT;
  return make('right', opts.p2Lift);
}
