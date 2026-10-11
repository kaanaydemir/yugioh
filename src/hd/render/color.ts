// HD render — color helpers: unpack/pack, perceptual (OKLab) mixing and hue-shifted ramp
// composition from the game palette (src/art/palette.ts).
//
// Rule of thumb for HD ramps (docs/STYLE_HD.md): 5–7 tones per material, shadows lean toward
// navy/purple, highlights toward warm gold, no dithering on creatures. The cleanest way to
// get that while staying inside the shipped palette is to EXTEND a palette ramp with a
// neighbouring palette hue at each end (e.g. hide = void1 → night ramp → white → gold4) —
// that is what `hueRamp` does. `mixOk` exists for the rare in-between tone an artist really
// needs; prefer palette colors.

import { PAL } from '../../art/palette';

export type RGB = [number, number, number];

export const rgbOf = (c: number): RGB => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
export const pack = (r: number, g: number, b: number): number =>
  ((Math.round(Math.max(0, Math.min(255, r))) << 16) | (Math.round(Math.max(0, Math.min(255, g))) << 8) | Math.round(Math.max(0, Math.min(255, b)))) >>> 0;
export const hex = (c: number): string => '#' + c.toString(16).padStart(6, '0');

const toLin = (v: number) => {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const toSrgb = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

/** sRGB color → OKLab [L, a, b]. */
export function oklab(c: number): RGB {
  const [r8, g8, b8] = rgbOf(c);
  const r = toLin(r8);
  const g = toLin(g8);
  const b = toLin(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab → sRGB color. */
export function fromOklab(L: number, A: number, B: number): number {
  const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3);
  const m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3);
  const s = Math.pow(L - 0.0894841775 * A - 1.291485548 * B, 3);
  return pack(
    toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  );
}

/** Perceptual mix of two colors (t = 0 → a, 1 → b). */
export function mixOk(a: number, b: number, t: number): number {
  const A = oklab(a);
  const B = oklab(b);
  return fromOklab(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

/** Perceived lightness (OKLab L, 0..1). */
export const lightness = (c: number): number => oklab(c)[0];

/**
 * Compose a hue-shifted ramp (dark → light) from palette colors: `shadow` tones are prepended
 * (navy / purple), `highlight` tones appended (warm). `drop` trims the core ramp first,
 * e.g. drop: { top: 1 } removes its lightest tone. Pure palette colors in, pure palette out.
 *
 *   hueRamp(RAMPS.gold, { shadow: [PAL.void1], highlight: [PAL.white] })
 *   // → void1, gold0, gold1, gold2, gold3, gold4, white  (7 tones, purple shadows)
 */
export function hueRamp(
  core: readonly number[],
  o: { shadow?: readonly number[]; highlight?: readonly number[]; drop?: { bottom?: number; top?: number } } = {},
): number[] {
  const c = core.slice(o.drop?.bottom ?? 0, core.length - (o.drop?.top ?? 0));
  return [...(o.shadow ?? []), ...c, ...(o.highlight ?? [])];
}

/** Index of the ramp tone closest (perceptually) to `c`. */
export function nearestTone(ramp: readonly number[], c: number): number {
  const q = oklab(c);
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < ramp.length; i++) {
    const p = oklab(ramp[i]);
    const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

/** Every color of the game palette (handy for "is this a palette color?" checks in tests). */
export const PALETTE_COLORS: ReadonlySet<number> = new Set(Object.values(PAL) as number[]);
