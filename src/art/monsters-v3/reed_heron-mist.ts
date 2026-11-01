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
  /** A bank lens (an occluder): no crest break, 2-px Bayer hems, half the end jitter. */
  dense?: boolean;
  /** Explicit [crest, body, underside] colours (overrides `tone`); a null crest / underside row takes the body colour. */
  bands?: readonly [number | null, number, number | null];
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
    const c = w.bands ? (w.bands[band] ?? w.bands[1]) : tones[band];
    // the row's reach: the crest is 3–5 px shorter, the underside 1–3 px, each end jittered on its own
    // (a cloud, not a bar: the body rows step in and out by up to 5 px per end, the crest sits over the fuller half)
    const inset = band === 0 ? 3 + Math.floor(h3(w.seed, r, 1) * 3) : band === 2 ? 1 + Math.floor(h3(w.seed, r, 2) * 3) : Math.floor(h3(w.seed, r, 3) * 2);
    const jk = (band === 1 ? 6 : 4) / (w.dense ? 2 : 1);
    const jl = Math.floor(h3(w.seed, r, 4) * jk);
    const jr = Math.floor(h3(w.seed, r, 5) * jk);
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
    const gapAt = band === 0 && x1 - x0 > 12 && !w.dense ? x0 + Math.round((x1 - x0) * (0.34 + 0.32 * h3(w.seed, 7, 7))) : -999;
    const gapW = 2 + Math.floor(h3(w.seed, 8, 8) * 3);
    for (let x = x0; x <= x1; x++) {
      const edge = Math.min(x - x0, x1 - x);
      let on = edge >= (w.dense ? 2 : 4) || ((x >> 1) + (y >> 1)) % 2 === 0;
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

// ---------------------------------------------------------------- the summon's fog BANK (occluder)

/**
 * One lens of the summon's bank, relative to the heron's feet (x along his facing, + = toward the beak):
 * `dy` its top row above the floor, `h` its rows, `cx` / `hw` centre and half width, `start` the parting step
 * (0 … 2) on which it begins to tear down its centre line.
 */
export interface BankLens {
  dy: number;
  h: number;
  cx: number;
  hw: number;
  /** [crest, body, underside] (null: the body colour) — the bank is one mass with a few folds, never a stack of stripes. */
  bands: readonly [number | null, number, number | null];
  lean: number;
  start: number;
}

/**
 * The bank stands from the water line up past his crown (62 px), ten overlapping 6–7-row lenses (each one row over
 * the next, so the crest gaps and Bayer hems of one are backed by its neighbour), a little wider than the bird at
 * every height (head + beak, the neck, the teardrop body and the cloak, the leg): the bird can stand in it whole and
 * be hidden. Stepped by height: mist crests over the head, steel through the body, night4 on the water.
 * Parting order: the top four tear on step 0, the next three on step 1, the water lenses on step 2.
 */
const M = PAL.mist;
const S = PAL.steel;
const N4 = PAL.night4;
const N3 = PAL.night3;
export const SUMMON_BANK: readonly BankLens[] = [
  { dy: -62, h: 6, cx: 9, hw: 17, bands: [M, S, null], lean: 1, start: 0 },
  { dy: -57, h: 7, cx: 12, hw: 23, bands: [null, S, null], lean: -1, start: 0 },
  { dy: -51, h: 7, cx: 6, hw: 15, bands: [M, S, null], lean: 1, start: 0 },
  { dy: -45, h: 7, cx: 2, hw: 18, bands: [null, S, null], lean: -1, start: 0 },
  { dy: -39, h: 7, cx: -4, hw: 23, bands: [M, S, null], lean: 1, start: 1 },
  { dy: -33, h: 7, cx: -6, hw: 25, bands: [null, S, N4], lean: -1, start: 1 },
  { dy: -27, h: 7, cx: -8, hw: 25, bands: [S, N4, null], lean: 1, start: 1 },
  { dy: -21, h: 7, cx: -10, hw: 24, bands: [null, N4, null], lean: -1, start: 2 },
  { dy: -15, h: 7, cx: -10, hw: 22, bands: [S, N4, null], lean: 1, start: 2 },
  { dy: -9, h: 7, cx: -4, hw: 19, bands: [null, N4, N3], lean: -1, start: 2 },
];
/** The three parting moves (px each half drifts outward per step). */
export const BANK_PART_STEPS = [3, 3, 4] as const;

export interface BankState {
  /** 0 … 1: the bank rises off the water, lowest lens first, each widening in 3-px steps. */
  inK: number;
  /** Parting moves made so far (0 … 3). */
  steps: number;
  /** The downdraft's extra outward drift of every half (px) once parted. */
  push: number;
  /** 0 … 1: lenses dropped (seeded) and the rest at the far tone. */
  thin: number;
  /** Whole-px drift, odd lenses one way, even ones the other (the bank breathes while it stands). */
  drift?: number;
}

/**
 * Paint the bank through `run` at world feet `(fx, fy)`, facing `sgn`. `clip` = the world x window; `hole` = [x0, x1, y0, y1] kept clear (the glint's dark hole).
 */
export function paintBank(
  run: (y: number, x0: number, x1: number, c: number) => void,
  fx: number,
  fy: number,
  sgn: 1 | -1,
  st: BankState,
  o: { clip?: readonly [number, number]; hole?: readonly [number, number, number, number] | null } = {},
): void {
  SUMMON_BANK.forEach((L, i) => {
    if (st.thin > 0 && h3(i, 77, 3) < st.thin * 0.95) return;
    // the bank RISES off the water: the lowest lens first, each one widening from a third of its width to the
    // whole in 3-px steps (vapour gathering, never planks sliding in)
    const n = SUMMON_BANK.length;
    const k = Math.max(0, Math.min(1, (st.inK - ((n - 1 - i) / n) * 0.6) / 0.4));
    if (k <= 0) return;
    const hw = Math.max(4, L.hw - 3 * Math.round((L.hw * 0.66 * (1 - k) * (1 - k)) / 3));
    const thin = st.thin > 0.5 ? 2 : st.thin > 0.2 ? 1 : 0;
    const bands = thin === 0 ? L.bands : thin === 1 ? ([L.bands[0] === M ? S : L.bands[0] === S ? N4 : L.bands[0], L.bands[1] === S ? N4 : N3, null] as const) : ([null, N3, null] as const);
    const cx = fx + sgn * L.cx + (st.drift ?? 0) * (i % 2 ? 1 : -1);
    const y = fy + L.dy;
    const lean = L.lean * sgn;
    const seed = 101 + i * 17;
    let part = 0;
    for (let s = L.start; s < st.steps; s++) part += BANK_PART_STEPS[s] ?? 0;
    const holes = o.hole && o.hole[3] >= y && o.hole[2] <= y + L.h - 1 ? [[o.hole[0], o.hole[1]] as const] : undefined;
    if (part <= 0) {
      paintWisp(run, { cx, y, h: L.h, hw, lean, seed, bands, clip: o.clip, holes, dense: true });
      return;
    }
    // torn down the centre line: two halves, each with its own frayed ends, drifting outward
    const half = Math.max(4, Math.round(hw / 2) + 1);
    const out = part + st.push;
    paintWisp(run, { cx: cx - half - out, y, h: L.h, hw: half, lean, seed, bands, clip: o.clip, dense: true });
    paintWisp(run, { cx: cx + half + out, y, h: L.h, hw: half, lean: -lean, seed: seed + 1, bands, clip: o.clip, dense: true });
  });
}
