// Neon Tower — hologram creature baking (owner B2, docs/v3/ARENA_NEON_TOWER.md §9; J3: big, blue-white / violet).
// Pure PixelCanvas code (no Phaser, no Math.random): turns a creature's own v3 idle frame into a hologram frame.
//
//   * the frame is cropped to the union box, mirrored when the creature faces left, and enlarged by `look.scale`
//     with a nearest-neighbour pass (1.5× / 1.75× = 2-px and 1-px source pixels alternating: the stipple and the
//     scan lines below hide the unevenness, and the creature is finally ~120–140 px tall instead of ~90)
//   * tone mapping: the source luminance is cut into SIX hard bands by quantiles of the creature itself (deep shadow,
//     shadow, mid, light, ice, white), so every creature gets the full ramp whatever its own palette: crystal =
//     deep blue shadow bands, cyan mid, white-ice highlights; magus = ink-violet shadows, violet mid, magenta-lilac
//     highlights, white sparks
//   * facets glow: where a band meets a darker band the pixel is one tone brighter (the wire-frame look of the concept)
//   * translucency WITHOUT alpha: every 3rd row is a scan line (two tones down, the darkest tones drop out), the deep
//     shadow is a checker; only the outline rim and the lit planes are solid
//   * a bright 1-px rim round the silhouette (white on the edges facing the top-left light), a lit scan band whose
//     height is different in every frame, so one pass of the loop is one sweep from the head to the feet
//   * opacity steps for the flicker: `dimFrame` thins a baked frame with a 4×4 Bayer mask (75 % / 50 % of the body
//     pixels stay, the rim stays), so the idle flicker is a swap of pre-baked images, never a blend
// The result is opaque or fully transparent per pixel: palcheck never sees a blended colour.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';

export interface HoloLook {
  /** six tones, dark → light (ramp[5] is white-ish) */
  ramp: readonly [number, number, number, number, number, number];
  /** the creature faces left in the arena (the right hologram): mirror the frames */
  flip: boolean;
  /** nearest-neighbour enlargement of the v3 frame (the target height is ~120–140 px) */
  scale: number;
  /** quantile edges of the six tone bands (fractions of the interior pixels below each edge) */
  bands: readonly [number, number, number, number, number];
}

export const HOLO_LOOKS: readonly [HoloLook, HoloLook] = [
  // Kristal Ejder: deep blue, blue, bright azure, ice, pale ice, white
  { ramp: [PAL.water0, PAL.water1, PAL.water2, PAL.water3, PAL.water4, PAL.white], flip: false, scale: 4 / 3, bands: [0.1, 0.28, 0.5, 0.74, 0.9] },
  // Uçurum Büyücüsü: ink violet, violet, bright violet, magenta, lilac, white
  { ramp: [PAL.void1, PAL.void2, PAL.void3, PAL.mag3, PAL.void4, PAL.white], flip: true, scale: 1.5, bands: [0.18, 0.4, 0.66, 0.87, 0.97] },
];

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Union of the opaque bounds of `frames` (all the same size), or null. */
export function unionBounds(frames: readonly PixelCanvas[]): Box | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (const f of frames) {
    const b = f.bounds();
    if (!b) continue;
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w - 1);
    y1 = Math.max(y1, b.y + b.h - 1);
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Size of a baked frame for a union box (the frame sits on its own bottom-centre anchor: see holoAnchor). */
export function holoSize(box: Box, look: HoloLook): { w: number; h: number } {
  return { w: Math.ceil(box.w * look.scale), h: Math.ceil(box.h * look.scale) };
}

/** The feet anchor (source anchorX / anchorY) inside a baked frame. */
export function holoAnchor(anchor: { x: number; y: number }, box: Box, look: HoloLook): { x: number; y: number } {
  const ax = anchor.x - box.x;
  const ay = anchor.y - box.y;
  const { w } = holoSize(box, look);
  const sx = Math.round((ax + 0.5) * look.scale);
  return { x: look.flip ? w - sx : sx, y: Math.round((ay + 1) * look.scale) - 1 };
}

function lum(c: number): number {
  return ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** The enlarged, cropped, mirrored silhouette + luminance of one source frame. */
interface Plane {
  w: number;
  h: number;
  op: Uint8Array;
  lum: Float32Array;
}
function plane(src: PixelCanvas, box: Box, look: HoloLook): Plane {
  const { w, h } = holoSize(box, look);
  const op = new Uint8Array(w * h);
  const L = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ox = look.flip ? w - 1 - x : x;
      const sx = box.x + Math.min(box.w - 1, Math.floor(ox / look.scale));
      const sy = box.y + Math.min(box.h - 1, Math.floor(y / look.scale));
      const c = src.get(sx, sy);
      if (c !== null && src.isOpaque(sx, sy)) {
        op[y * w + x] = 1;
        L[y * w + x] = lum(c);
      }
    }
  return { w, h, op, lum: L };
}

/** Luminance thresholds of the six bands (quantiles of the interior pixels). */
function thresholds(p: Plane, look: HoloLook): number[] {
  const vals: number[] = [];
  for (let y = 1; y < p.h - 1; y++)
    for (let x = 1; x < p.w - 1; x++) {
      const i = y * p.w + x;
      if (p.op[i] && p.op[i - 1] && p.op[i + 1] && p.op[i - p.w] && p.op[i + p.w]) vals.push(p.lum[i]);
    }
  vals.sort((a, b) => a - b);
  if (!vals.length) return [0, 1, 2, 3, 4];
  return look.bands.map((q) => vals[Math.min(vals.length - 1, Math.floor(q * vals.length))]);
}

/**
 * Bake one hologram frame of `src` (a full creature frame), cropped to `box` (the union box of all the creature's
 * frames, so the cropped frames keep their registration). `index` / `count` place the scan band.
 */
export function bakeHoloFrame(src: PixelCanvas, box: Box, look: HoloLook, index: number, count: number, ref?: PixelCanvas): PixelCanvas {
  const R = look.ramp;
  const p = plane(src, box, look);
  const th = thresholds(ref ? plane(ref, box, look) : p, look);
  const { w, h } = p;
  const out = new PixelCanvas(w, h);
  const opq = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && p.op[y * w + x] === 1;
  const toneAt = (x: number, y: number): number => {
    const l = p.lum[y * w + x];
    let t = 0;
    while (t < 5 && l >= th[t]) t++;
    return t;
  };
  // the scan band of this frame: 4 rows, from above the head to below the feet over one loop
  const travel = h + 8;
  const band = Math.floor((index * travel) / count) - 4;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!opq(x, y)) continue;
      const left = !opq(x - 1, y);
      const right = !opq(x + 1, y);
      const up = !opq(x, y - 1);
      const down = !opq(x, y + 1);
      const inBand = y >= band && y < band + 4;
      let tone: number;
      if (left || right || up || down) {
        // the rim: bright, white where the edge faces the top-left light (the right creature: top-right)
        const lit = (look.flip ? right : left) || up;
        tone = lit ? 5 : 4;
        // a dark gap under the rim of the under side gives the line some weight
        if (down && !up && !left && !right && (x + y) % 3 === 0) tone = 3;
        if (lit && (x * 5 + y * 3) % 7 === 0) tone = 4;
      } else {
        let t = toneAt(x, y);
        // facet edges glow: a pixel on the boundary against a darker band, one tone brighter
        const lo = Math.min(t, opq(x - 1, y) ? toneAt(x - 1, y) : t, opq(x, y - 1) ? toneAt(x, y - 1) : t);
        if (lo < t && t >= 1 && t < 5) t = Math.min(5, t + 1);
        if (inBand) t = Math.min(5, t + 2);
        else {
          // scan lines: every 3rd row two tones down; deep shadow is a checker; the darkest tones drop out
          const scan = y % 3 === 1;
          if (scan) t -= 2;
          if (t <= 0 && (x + y) % 2 === 1) t = -1;
          else if (t < 0) t = -1;
          else if (t === 0 && scan) t = -1;
        }
        tone = t;
      }
      if (tone < 0) continue;
      out.set(x, y, R[Math.min(5, tone)]);
    }
  return out;
}

/**
 * The opacity step of a baked frame for the flicker: `level` 1 keeps 75 % of the body pixels, 2 keeps 50 %
 * (a 4×4 Bayer mask); the rim (pixels with a transparent neighbour) stays. Opaque or transparent only.
 */
export function dimFrame(f: PixelCanvas, level: 1 | 2): PixelCanvas {
  const out = new PixelCanvas(f.w, f.h);
  const cut = level === 1 ? 4 : 8;
  for (let y = 0; y < f.h; y++)
    for (let x = 0; x < f.w; x++) {
      if (!f.isOpaque(x, y)) continue;
      const edge = !f.isOpaque(x - 1, y) || !f.isOpaque(x + 1, y) || !f.isOpaque(x, y - 1) || !f.isOpaque(x, y + 1);
      if (!edge && BAYER[(y & 3) * 4 + (x & 3)] < cut) continue;
      out.set(x, y, f.get(x, y)!);
    }
  return out;
}

/**
 * The flash frame of a summon: the whole silhouette in the lightest tones (rim white, body white-ice with every 3rd
 * row one tone down so the creature still has form). `hot` = pure white body (the very first frame of the flare).
 */
export function bakeHoloFlash(src: PixelCanvas, box: Box, look: HoloLook, hot = false): PixelCanvas {
  const R = look.ramp;
  const p = plane(src, box, look);
  const { w, h } = p;
  const out = new PixelCanvas(w, h);
  const opq = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && p.op[y * w + x] === 1;
  const th = thresholds(p, look);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!opq(x, y)) continue;
      const edge = !opq(x - 1, y) || !opq(x + 1, y) || !opq(x, y - 1) || !opq(x, y + 1);
      let t = 5;
      if (!edge && !hot) {
        // keep the creature's form: the dark planes one step down
        const l = p.lum[y * w + x];
        t = l < th[1] ? 3 : l < th[3] ? 4 : 5;
        if (y % 3 === 1) t = Math.max(3, t - 1);
      }
      out.set(x, y, R[t]);
    }
  return out;
}
