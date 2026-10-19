// rigkit / passes / cracks — fractures that grow over a part (crystal death; A2 wyrm).
//
// COPIED from crystal_wyrm-rig.ts cracksOn / LIP / HIDE_PX / GLASS_PX. Crack lines live in the space
// of the part they are on (the caller maps them with the part's own transform), so they move rigidly
// with it. Each grows from its first point once `progress` passes its `from`. While the inner light
// is still in the body a crack glows; where it has drained (`drained`) it is a dark groove; a 1-px
// lip one value lighter runs on its side toward the key light.

import { PAL } from '../../palette';
import type { PixelCanvas } from '../../pixel';
import type { StepTable } from '../composite';
import { lineWith } from '../edges';
import { clamp, dot, len, lerpV, norm, rnd, sub, type V } from '../geom';
import type { Light } from '../light';

export interface Crack {
  /** progress at which it starts to grow */
  readonly from: number;
  readonly pts: readonly V[];
}

/** One value up every ramp: the lit lip of a fracture (A2 LIP). */
export const LIP_A2: StepTable = Object.freeze({
  [PAL.night2]: PAL.night3,
  [PAL.night3]: PAL.steel,
  [PAL.steel]: PAL.mist,
  [PAL.mist]: PAL.white,
  [PAL.cyan0]: PAL.cyan1,
  [PAL.cyan1]: PAL.cyan2,
  [PAL.cyan2]: PAL.cyan3,
  [PAL.cyan3]: PAL.cyan4,
});
/** The surfaces a crack is drawn over (A2: the wyrm's hide and glass). */
export const HIDE_PX_A2: ReadonlySet<number> = new Set<number>([PAL.white, PAL.mist, PAL.steel, PAL.night3, PAL.night2, PAL.cyan2]);
export const GLASS_PX_A2: ReadonlySet<number> = new Set<number>([PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white, PAL.mist, PAL.steel]);

export interface CrackStyle {
  /** colours the crack may cover */
  readonly surface: ReadonlySet<number>;
  /** groove colour while lit / once drained */
  readonly lit: number;
  readonly dark: number;
  /** lip colour table (one value up) */
  readonly lip: StepTable;
}
/** A2 styles: the wyrm's hide (cyan3 glow / night2 groove) and glass (white / cyan0). */
export const CRACK_HIDE_A2: CrackStyle = Object.freeze({ surface: HIDE_PX_A2, lit: PAL.cyan3, dark: PAL.night2, lip: LIP_A2 });
export const CRACK_GLASS_A2: CrackStyle = Object.freeze({ surface: GLASS_PX_A2, lit: PAL.white, dark: PAL.cyan0, lip: LIP_A2 });

export interface CracksOpts {
  readonly style?: CrackStyle;
  /** has the light drained from (x, y)? (default: never) */
  readonly drained?: (x: number, y: number) => boolean;
  /** progress span over which one crack grows to full length. A2: 0.42. */
  readonly growSpan?: number;
}

/**
 * Draw the visible part of each crack over a part's layer (only over its own surface pixels): a
 * straight 1-px groove (glowing / dark) with a 1-px lip one value lighter toward the key light.
 */
export function cracksOn(c: PixelCanvas, light: Light, progress: number, list: readonly Crack[], o: CracksOpts = {}) {
  const style = o.style ?? CRACK_HIDE_A2;
  const surf = style.surface;
  const span = o.growSpan ?? 0.42;
  const W = c.w;
  for (const k of list) {
    const grow = clamp((progress - k.from) / span, 0, 1);
    if (grow <= 0) continue;
    const lens = [0];
    for (let i = 1; i < k.pts.length; i++) lens.push(lens[i - 1] + len(sub(k.pts[i], k.pts[i - 1])));
    const want = grow * lens[lens.length - 1];
    const groove = new Map<number, V>();
    const lips: [number, number][] = [];
    for (let i = 1; i < k.pts.length && lens[i - 1] < want; i++) {
      const t = clamp((want - lens[i - 1]) / (lens[i] - lens[i - 1] || 1), 0, 1);
      const a = k.pts[i - 1];
      const b = lerpV(a, k.pts[i], t);
      const d = norm(sub(k.pts[i], a));
      let n: V = [-d[1], d[0]];
      if (dot(n, light.v2) < 0) n = [-n[0], -n[1]];
      const off = rnd(n);
      lineWith(c, a, b, (x, y) => {
        groove.set(y * W + x, [x, y]);
        lips.push([x + off[0], y + off[1]]);
        return null;
      });
    }
    for (const [x, y] of lips) {
      if (groove.has(y * W + x)) continue;
      const cur = c.get(x, y);
      if (cur === null || !surf.has(cur)) continue;
      const up = style.lip[cur];
      if (up !== undefined) c.set(x, y, up);
    }
    for (const [x, y] of groove.values()) {
      const cur = c.get(x, y);
      if (cur === null || !surf.has(cur)) continue;
      const dark = o.drained ? o.drained(x, y) : false;
      c.set(x, y, dark ? style.dark : style.lit);
    }
  }
}
