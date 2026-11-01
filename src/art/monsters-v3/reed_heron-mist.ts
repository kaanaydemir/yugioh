// Sazlık Balıkçılı v3 — the marsh mist WISP: the one mist shape every heron moment paints (the rig's death cover,
// the summon's fog bank, the death's world wisps). Registers nothing; no default export (not an art module).
//
// A wisp is a short, flat, stepped lens of vapour 3–6 px tall, painted as at most three flat tone bands:
//   - a 1-px top edge (mist; steel on the far layer), shorter than the body so the crest steps in;
//   - the body (steel; night4 far), the widest rows;
//   - a 1-px underside (night4; night3 far), a little shorter again.
// The rows lean (each row shifts by `lean` px, so the wisp is a sheared, drifting shape), the left and right ends of
// every row are jittered per seed (never a symmetric egg), and the last 4 px of each row fray as a 2×2 Bayer checker
// (MA-4: partial cover is a pattern, never alpha). It is never outlined: mist is light-like vapour (IŞ-9), and it is
// never a 1-px line — the thinnest wisp still has its edge, its body and its underside.

import { PAL } from '../palette';

export interface Wisp {
  /** Centre x and top row y (whole px after rounding). */
  cx: number;
  y: number;
  /** Half width of the body rows (px) and height 3…6 rows. */
  hw: number;
  h: number;
  /** Shear per row (px, + = lower rows further right) and a seed for the end jitter. */
  lean?: number;
  seed: number;
  /** 0 = near (mist / steel / night4), 1 = far (steel / night4 / night3), 2 = thinning (night4 / night3 only). */
  tone?: 0 | 1 | 2;
  /** World x window the wisp is clipped to (the frayed ends are re-made at the clip, so a clip never cuts square). */
  clip?: readonly [number, number];
  /** World x ranges kept clear (a dark hole in the fog). */
  holes?: readonly (readonly [number, number])[];
}

/** Deterministic 0…1 hash of integers (local: the art layer never imports the cinematics). */
function h3(a: number, b: number, c: number): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const TONES: Record<0 | 1 | 2, readonly [number, number, number]> = {
  0: [PAL.mist, PAL.steel, PAL.night4],
  1: [PAL.steel, PAL.night4, PAL.night3],
  2: [PAL.night4, PAL.night3, PAL.night3],
};

/**
 * Paint one wisp through `run(y, x0, x1, colour)` (a PixelCanvas or a Graphics wrapper: whole-pixel runs).
 * Returns the rows it covered ([top, bottom]) or null when nothing was painted.
 */
export function paintWisp(run: (y: number, x0: number, x1: number, c: number) => void, w: Wisp): [number, number] | null {
  const h = Math.max(3, Math.min(6, Math.round(w.h)));
  const hw = Math.round(w.hw);
  if (hw < 3) return null;
  const tones = TONES[w.tone ?? 0];
  const y0 = Math.round(w.y);
  const lean = w.lean ?? 0;
  let painted = false;
  for (let r = 0; r < h; r++) {
    const y = y0 + r;
    const band = r === 0 ? 0 : r === h - 1 ? 2 : 1;
    const c = tones[band];
    // the row's reach: the crest is 3–5 px shorter, the underside 1–3 px, each end jittered on its own
    // (a cloud, not a bar: the body rows step in and out by up to 5 px per end, the crest sits over the fuller half)
    const inset = band === 0 ? 3 + Math.floor(h3(w.seed, r, 1) * 3) : band === 2 ? 1 + Math.floor(h3(w.seed, r, 2) * 3) : Math.floor(h3(w.seed, r, 3) * 2);
    const jl = Math.floor(h3(w.seed, r, 4) * (band === 1 ? 6 : 4));
    const jr = Math.floor(h3(w.seed, r, 5) * (band === 1 ? 6 : 4));
    const sh = Math.round(lean * (r - (h - 1) / 2));
    let x0 = Math.round(w.cx) - hw + inset + jl + sh;
    let x1 = Math.round(w.cx) + hw - inset - jr + sh;
    if (w.clip) {
      x0 = Math.max(x0, Math.round(w.clip[0]));
      x1 = Math.min(x1, Math.round(w.clip[1]));
    }
    if (x1 - x0 < 2) continue;
    // whole run, minus the frayed ends (2×2 Bayer over the last 4 px) and the holes
    let runX = -1;
    const flush = (x: number) => {
      if (runX >= 0 && x > runX) run(y, runX, x - 1, c);
      runX = -1;
    };
    // the crest breaks once: a 2–4 px gap at a seeded place in its middle third (two humps of vapour)
    const gapAt = band === 0 && x1 - x0 > 12 ? x0 + Math.round((x1 - x0) * (0.34 + 0.32 * h3(w.seed, 7, 7))) : -999;
    const gapW = 2 + Math.floor(h3(w.seed, 8, 8) * 3);
    for (let x = x0; x <= x1; x++) {
      const edge = Math.min(x - x0, x1 - x);
      let on = edge >= 4 || ((x >> 1) + (y >> 1)) % 2 === 0;
      if (x >= gapAt && x < gapAt + gapW) on = false;
      if (on && w.holes) for (const [a, z] of w.holes) if (x >= a && x <= z) on = false;
      if (on && runX < 0) runX = x;
      else if (!on) flush(x);
    }
    flush(x1 + 1);
    painted = true;
  }
  return painted ? [y0, y0 + h - 1] : null;
}
