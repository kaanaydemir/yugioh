// FRAME_V3 — the one frame language of the v3 card face (A5-B), card back (A6-A), HUD shell, plates,
// graveyard panel and prompts (A6-B). Contract S-1 (docs/v3/A5_PLAN.md §3.7.1, A6_PLAN.md F10).
// Written in A56.0 and FROZEN: a change of tone or rule goes through the orchestrator (e.g. after
// the A56.K checkpoint); no lane keeps its own copy of these tones.
//
// The rules (palette only, no bevel / gradient / dither / ADD glow, light from the top left — IŞ-1):
//   body     two flat bands inside: night1 (upper, lit) over night0
//   outline  1 px ink, corners cut (the corner pixels are not painted: empty on a fresh canvas, as
//            on today's cards)
//   trim     ONE 1-px line just inside the outline, in the kind's / owner's tone:
//              monster gold2 / gold3 · spell teal2 / teal3 · trap mag2 / mag3
//              P1 cyan2 / cyan3 (PLAYER_RAMP[0]) · P2 crim2 / crim3 (PLAYER_RAMP[1]) · neutral steel / mist
//            top and left edges one tone lighter (ramp[3]), bottom and right one tone darker (ramp[2]);
//            the horizontal edges own the corners (top-right light, bottom-left dark)
//   ace      3-px gold L corners one pixel inside the trim (top-left and bottom-right), gold4 joint
//
//   const p = new PixelCanvas(48, 68);
//   frameRectV3(p, 0, 0, 48, 68, FRAME_V3.trims.monster, { ace: true });
//   frameRectV3(p, x, y, 96, 20, trimV3('p1', +1));          // the active player's panel: trim one tone up

import { PAL, PLAYER_RAMP, RAMPS } from './palette';
import type { PixelCanvas } from './pixel';

/** A trim's tone ramp (dark → light, 5 steps) and the step its darker edge sits on (lighter = +1). */
export interface TrimRamp {
  readonly ramp: readonly [number, number, number, number, number];
  readonly base: number;
}

/** The two tones of a 1-px trim: `light` on the top / left edges, `dark` on the bottom / right. */
export interface Trim {
  readonly light: number;
  readonly dark: number;
}

export type TrimName = 'monster' | 'spell' | 'trap' | 'p1' | 'p2' | 'neutral';

const NEUTRAL_RAMP = [PAL.night3, PAL.night4, PAL.steel, PAL.mist, PAL.white] as const;

const TRIM_RAMPS: Readonly<Record<TrimName, TrimRamp>> = Object.freeze({
  monster: { ramp: RAMPS.gold, base: 2 },
  spell: { ramp: RAMPS.teal, base: 2 },
  trap: { ramp: RAMPS.mag, base: 2 },
  p1: { ramp: PLAYER_RAMP[0], base: 2 },
  p2: { ramp: PLAYER_RAMP[1], base: 2 },
  neutral: { ramp: NEUTRAL_RAMP, base: 2 },
});

/**
 * The trim of `name`, shifted `lift` ramp steps (+1 = one tone brighter, e.g. the active player's
 * panel or a hovered button; −2 = a disabled button). Clamped to the ramp.
 */
export function trimV3(name: TrimName, lift = 0): Trim {
  const r = TRIM_RAMPS[name];
  const at = (i: number) => r.ramp[Math.max(0, Math.min(4, i))];
  const d = r.base + Math.round(lift);
  return Object.freeze({ dark: at(d), light: at(d + 1) });
}

/** The tones and rules of the v3 frame (S-1). */
export const FRAME_V3 = Object.freeze({
  /** 1-px outer outline. */
  ink: PAL.ink,
  /** Upper (lit) body band. */
  bodyTop: PAL.night1,
  /** Lower body band. */
  bodyBottom: PAL.night0,
  /** Corner cut of the outline (px). */
  cut: 1,
  /** Inset of the trim line from the outer edge (px): just inside the outline. */
  trimInset: 1,
  /** The six trims at their base tone. */
  trims: Object.freeze({
    monster: trimV3('monster'),
    spell: trimV3('spell'),
    trap: trimV3('trap'),
    p1: trimV3('p1'),
    p2: trimV3('p2'),
    neutral: trimV3('neutral'),
  }) as Readonly<Record<TrimName, Trim>>,
  /** The ace corner ornament: L legs (px), tones. */
  ace: Object.freeze({ leg: 3, color: PAL.gold3, joint: PAL.gold4 }),
  /** The tone ramps behind the trims (for lanes that step a trim: trimV3). */
  ramps: TRIM_RAMPS,
});

export interface FrameV3Opts {
  /** Fill the body bands (default true). false: outline + trim only (the inside is left as is). */
  body?: boolean;
  /** Where the lower band starts: a fraction of the height (0..1, default 0.5) or whole px (> 1). */
  split?: number;
  /** Body band tones (default FRAME_V3.bodyTop / bodyBottom). */
  bands?: readonly [number, number];
  /** Corner cut of the outline in px: 0 square, 1 (default, FRAME_V3.cut) or 2; clamped to 0..2. */
  cut?: number;
  /** Draw the ink outline (default true). */
  outline?: boolean;
  /** Draw the trim (default true; also skipped when `trim` is null). */
  trimLine?: boolean;
  /** Ace corners: true = top-left + bottom-right; or the corners to mark. */
  ace?: boolean | readonly ('tl' | 'tr' | 'bl' | 'br')[];
}

/**
 * Paint the v3 frame into `p` at (x, y) size w × h (whole pixels; see the header for the rules).
 * `trim` may be a Trim, a TrimName, or null (no trim). Everything is clipped to `p`.
 */
export function frameRectV3(p: PixelCanvas, x: number, y: number, w: number, h: number, trim: Trim | TrimName | null, opts: FrameV3Opts = {}): PixelCanvas {
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  if (w <= 0 || h <= 0) return p;
  // corner cut: 0 (square), 1 (today's cards: the corner pixel empty) or 2 (a 1-px ink diagonal)
  const cut = Math.max(0, Math.min(2, Math.round(opts.cut ?? FRAME_V3.cut)));
  const t: Trim | null = trim === null ? null : typeof trim === 'string' ? FRAME_V3.trims[trim] : trim;
  const [top, bottom] = opts.bands ?? [FRAME_V3.bodyTop, FRAME_V3.bodyBottom];
  // inside the outline: the body, two flat bands
  if (opts.body !== false && w > 2 && h > 2) {
    const s = opts.split ?? 0.5;
    const splitY = y + (s > 1 ? Math.round(s) : Math.round(h * Math.max(0, Math.min(1, s))));
    for (let yy = y + 1; yy < y + h - 1; yy++) p.hline(x + 1, x + w - 2, yy, yy < splitY ? top : bottom);
  }
  // the outline, corners cut
  if (opts.outline !== false) {
    const ink = FRAME_V3.ink;
    p.hline(x + cut, x + w - 1 - cut, y, ink);
    p.hline(x + cut, x + w - 1 - cut, y + h - 1, ink);
    p.vline(x, y + cut, y + h - 1 - cut, ink);
    p.vline(x + w - 1, y + cut, y + h - 1 - cut, ink);
    if (cut === 2) {
      p.set(x + 1, y + 1, ink).set(x + w - 2, y + 1, ink).set(x + 1, y + h - 2, ink).set(x + w - 2, y + h - 2, ink);
    }
    // the cut corner pixels are not painted (left as they are: transparent on a fresh canvas)
  }
  // the trim, one pixel inside: lighter on top / left, darker on bottom / right (the horizontal
  // edges own the corners); with a 2-px cut its corners stay off the ink diagonal
  const ins = FRAME_V3.trimInset;
  const tc = Math.max(0, cut - 1);
  if (t && opts.trimLine !== false && w - 2 * ins > 2 * tc && h - 2 * ins > 2 * tc) {
    const x0 = x + ins;
    const y0 = y + ins;
    const x1 = x + w - 1 - ins;
    const y1 = y + h - 1 - ins;
    p.vline(x0, y0 + tc, y1 - tc, t.light);
    p.vline(x1, y0 + tc, y1 - tc, t.dark);
    p.hline(x0 + tc, x1 - tc, y0, t.light);
    p.hline(x0 + tc, x1 - tc, y1, t.dark);
  }
  // ace: 3-px gold L corners one pixel inside the trim
  if (opts.ace) {
    const corners: readonly ('tl' | 'tr' | 'bl' | 'br')[] = opts.ace === true ? ['tl', 'br'] : opts.ace;
    const a = FRAME_V3.ace;
    const i0 = ins + 1;
    for (const c of corners) {
      const cx = c === 'tl' || c === 'bl' ? x + i0 : x + w - 1 - i0;
      const cy = c === 'tl' || c === 'tr' ? y + i0 : y + h - 1 - i0;
      const dx = c === 'tl' || c === 'bl' ? 1 : -1;
      const dy = c === 'tl' || c === 'tr' ? 1 : -1;
      for (let k = 1; k < a.leg; k++) {
        p.set(cx + dx * k, cy, a.color);
        p.set(cx, cy + dy * k, a.color);
      }
      p.set(cx, cy, a.joint);
    }
  }
  return p;
}
