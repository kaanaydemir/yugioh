// Bulut Yavrusu (cloud_hatchling) v3 — hand pieces shared by both forms (docs/v3/kart-a/cloud_hatchling.md
// §1.3, §3.4): the frame constants, the material table (hatchhide near / far, belly, cloud, eggshell,
// ivory, wing tip, claw), the seam / crease tables, the grown waist ring (ringPuffs: the 12 puff centres,
// exported so the growth's falling hour-puffs land on exactly these pixels), the tiny hiccup ring, the
// eggshell's zigzag rim and speckles, and a deterministic hash. No module state.

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import HIDE from '../materials/defs/hatchhide';
import { materialTable, seamFrom, stepDown, type Light, type StepTable, type V } from '../rigkit';

/** Frame (shared by the baby and the grown art: the special's hand-off needs identical frames, §1.2). */
export const W = 82;
export const H = 78;
/** anchor: the ground line between the feet */
export const AX = 40;
export const GY = 74;

/** the hide's tone thresholds: leaf4 is the big calm lit plane (§1.3), leaf1 only the deepest crease */
export const HIDE_TH: readonly number[] = [-0.5, -0.12, 0.2];

/** G-buffer material slots. */
export const M = { HIDE: 0, FAR: 1, BELLY: 2, CLOUD: 3, SHELL: 4, IVORY: 5, TIP: 6, CLAW: 7, CLOUDF: 8 } as const;

export const MATS = materialTable([
  { ramp: HIDE.draw.ramp, th: HIDE_TH },
  { ramp: HIDE.draw.far.ramp, th: HIDE_TH },
  { ramp: [PAL.earth2, PAL.earth3, PAL.earth4], th: [-0.95, -0.3] },
  { ramp: [PAL.steel, PAL.mist, PAL.white], th: [-0.3, 0.3] },
  { ramp: [PAL.earth3, PAL.earth4, PAL.skin4], th: [-0.2, 0.4] },
  { ramp: [PAL.earth2, PAL.earth3, PAL.earth4, PAL.skin4], th: [-0.45, 0.05, 0.5] },
  { ramp: [PAL.leaf1, PAL.leaf2, PAL.leaf3], th: [-0.35, 0.3] },
  { ramp: [PAL.skin3, PAL.skin4], th: [0.1] },
  { ramp: [PAL.night4, PAL.steel, PAL.mist], th: [-0.1, 0.48] },
]);

/** One step down every ramp of the card: the 1-px contact seam between parts. */
export const SEAM_T: StepTable = Object.freeze({
  ...stepDown([PAL.leaf0, PAL.leaf1, PAL.leaf2, PAL.leaf3, PAL.leaf4], 1, PAL.ink),
  ...stepDown([PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4, PAL.skin4], 1, PAL.ink),
  [PAL.white]: PAL.mist,
  [PAL.mist]: PAL.steel,
  [PAL.steel]: PAL.night4,
  [PAL.night4]: PAL.night3,
  [PAL.skin3]: PAL.skin2,
  [PAL.skin2]: PAL.skin1,
  [PAL.skin1]: PAL.skin0,
  [PAL.gold3]: PAL.gold2,
});
/** Two steps down: the junction crease (hide folds, the head over the body). */
export const CREASE_T: StepTable = Object.freeze({
  ...stepDown([PAL.leaf0, PAL.leaf1, PAL.leaf2, PAL.leaf3, PAL.leaf4], 2, PAL.ink),
  ...stepDown([PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4, PAL.skin4], 2, PAL.ink),
  [PAL.white]: PAL.steel,
  [PAL.mist]: PAL.steel,
  [PAL.steel]: PAL.night3,
  [PAL.night4]: PAL.night2,
  [PAL.skin3]: PAL.skin1,
  [PAL.skin2]: PAL.skin1,
});
export const SEAM = seamFrom(SEAM_T);
export const CREASE = seamFrom(CREASE_T);

export const isHide = (c: number | null): boolean => c === PAL.leaf0 || c === PAL.leaf1 || c === PAL.leaf2 || c === PAL.leaf3 || c === PAL.leaf4;
export const isCloud = (c: number | null): boolean => c === PAL.white || c === PAL.mist || c === PAL.steel;

/** deterministic hash 0…1 */
export function hash(a: number, b = 0, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
/** sub-age i (0…5) of the growth: 0 before its frame, 1 after (the six growth frames, §4.10) */
export const seg = (age: number, i: number): number => clamp01(age * 6 - i);

// ------------------------------------------------------------------ the grown waist ring (§1.1 item 5)

/** The ring's centre and radii (frame px; the grown body's waist). */
export const RING = Object.freeze({ cx: 40, cy: 60, rx: 24, ry: 6 });
export const RING_N = 12;

export interface RingPuff {
  /** hour 0…11 (0 = the 12 o'clock puff of the dial it came from) */
  readonly k: number;
  readonly x: number;
  readonly y: number;
  /** on the far half (behind the body) */
  readonly back: boolean;
}

/**
 * The 12 puff centres for an orbit phase (0…1 = one turn), frame px, whole pixels. The orbit runs
 * counter-clockwise seen from above: the near (front) half moves toward the viewer's left.
 */
export function ringPuffs(phase: number, o: { cy?: number; rx?: number; ry?: number } = {}): RingPuff[] {
  const cy = o.cy ?? RING.cy;
  const rx = o.rx ?? RING.rx;
  const ry = o.ry ?? RING.ry;
  const out: RingPuff[] = [];
  // evenly spaced ALONG the ellipse (arc length), not by angle: the side puffs never bunch into clusters
  // (critique r3 #7); a shift of 1/12 still maps the pattern onto itself
  const N = 360;
  const acc = [0];
  for (let i = 1; i <= N; i++) {
    const a0 = ((i - 1) / N) * Math.PI * 2;
    const a1 = (i / N) * Math.PI * 2;
    acc.push(acc[i - 1] + Math.hypot((Math.cos(a1) - Math.cos(a0)) * rx, (Math.sin(a1) - Math.sin(a0)) * ry));
  }
  const total = acc[N];
  const angleAt = (u: number): number => {
    const t = u * total;
    let i = 1;
    while (i < N && acc[i] < t) i++;
    const f = (t - acc[i - 1]) / Math.max(1e-9, acc[i] - acc[i - 1]);
    return ((i - 1 + f) / N) * Math.PI * 2;
  };
  for (let k = 0; k < RING_N; k++) {
    const a = angleAt(((k / RING_N + phase) % 1 + 1) % 1);
    const s = Math.sin(a);
    out.push({ k, x: Math.round(RING.cx + Math.cos(a) * rx), y: Math.round(cy + s * ry), back: s < -0.05 });
  }
  return out;
}

/** One ring puff: a 6×4 cloud lobe pixel stamp (white top-left, mist body, steel underside). */
export function ringPuff(p: PixelCanvas, x: number, y: number, light: Light, bright = false): void {
  const lit = light.side < 0 ? -1 : 1;
  const rows = ['.mmmm.', 'mmmmmm', 'mmmmmm', '.ssss.'];
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < 6; c++) {
      const ch = rows[r][c];
      if (ch === '.') continue;
      const cx = x - 3 + c;
      const cy = y - 2 + r;
      let col: number = ch === 's' ? PAL.steel : PAL.mist;
      if (r <= 1 && ch === 'm' && (lit < 0 ? c <= 3 : c >= 2)) col = PAL.white;
      if (bright && ch === 'm') col = PAL.white;
      p.set(cx, cy, col);
    }
}

/**
 * The ring's band: the iso ellipse the puffs ride on, 2 px thick (mist over steel; the lit top row
 * white on the near half). `half` picks the far (behind the body) or the near half.
 */
export function ringBand(p: PixelCanvas, cx: number, cy: number, rx: number, ry: number, half: 'back' | 'front'): void {
  const n = Math.ceil(Math.PI * 2 * rx * 1.2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const s = Math.sin(a);
    const back = s < -0.05;
    if ((half === 'back') !== back) continue;
    const x = Math.round(cx + Math.cos(a) * rx);
    const y = Math.round(cy + s * ry);
    p.set(x, y, back ? PAL.mist : PAL.white);
    p.set(x, y + 1, back ? PAL.steel : PAL.mist);
    if (!back) p.set(x, y + 2, PAL.steel);
  }
}

// ------------------------------------------------------------------ the hiccup ring (§4.1)

/**
 * The tiny wind ring the hiccup releases (light pixels, never outlined): `big` false = the baby's 4×6
 * ring (hole 2 px), true = the grown fat ring 6×10 (2-px band, hole 2×6). `stage` 1 born, 2–3 drifting,
 * 4 popped into dots. (x, y) = the mouth.
 */
export function hiccupRing(p: PixelCanvas, x: number, y: number, stage: number, big: boolean): void {
  if (stage <= 0) return;
  const drift = big ? [0, 0, 3, 6, 7][stage] : [0, 0, 2, 4, 5][stage];
  const cx = x + drift + (big ? 3 : 2);
  const cy = y - (stage >= 3 ? 1 : 0);
  if (stage >= 4) {
    // popped: four dots (2-px puffs for the grown ring)
    const d = big ? 4 : 3;
    for (const [dx, dy] of [[-1, -d], [1, d], [d - 1, -1], [-d + 1, 1]] as const) {
      p.set(cx + dx, cy + dy, PAL.mist);
      if (big) p.set(cx + dx + 1, cy + dy, PAL.white);
    }
    return;
  }
  const rx = big ? 3 : 2;
  const ry = big ? 5 : 3;
  const band = big ? 2 : 1;
  for (let yy = -ry; yy <= ry; yy++)
    for (let xx = -rx; xx <= rx; xx++) {
      const d = (xx * xx) / (rx * rx) + (yy * yy) / (ry * ry);
      const din = (xx * xx) / Math.max(0.5, (rx - band) * (rx - band)) + (yy * yy) / Math.max(0.5, (ry - band) * (ry - band));
      if (d > 1.15 || din < 1) continue;
      // the leading (right) edge is the white lead, the rest mist
      p.set(cx + xx, cy + yy, xx > 0 ? PAL.white : PAL.mist);
    }
}

// ------------------------------------------------------------------ the eggshell

/** The zigzag rim of a half shell: x offsets from the rim's left end and the tooth heights. */
export const RIM_TEETH: readonly number[] = [0, 2, 0, 2, 1, 2, 0];

/** 2-px speckle clusters of the shell (offsets in a 12×14 egg box, shadow-plane picks happen in the rig). */
export const SPECKLES: readonly V[] = [
  [2, 3],
  [7, 5],
  [4, 8],
  [8, 10],
  [3, 11],
  [9, 2],
];

// ------------------------------------------------------------------ hand stamps (IŞ-2: _L / _R)

/** A hand-placed pixel map: rows of role chars ('.' = empty), anchored at its centre column / bottom row. */
export interface Stamp {
  readonly rows: readonly string[];
  /** anchor inside the map (col, row) */
  readonly ax: number;
  readonly ay: number;
}

/**
 * Lay a stamp: role char → colour. The map is authored for the P1 light (top-left); for the P2 relight
 * (`light.side` > 0) the map is mirrored about its anchor column (the _R map), so the lit plane stays on
 * the light's side. `flip` mirrors the shape itself (a part facing the other way).
 */
export function stampAt(p: PixelCanvas, s: Stamp, x: number, y: number, light: Light, key: Readonly<Record<string, number>>, flip = false): void {
  const mirror = (light.side > 0) !== flip;
  for (let r = 0; r < s.rows.length; r++) {
    const row = s.rows[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.' || ch === ' ') continue;
      const col = key[ch];
      if (col === undefined) continue;
      const dx = mirror ? s.ax - c : c - s.ax;
      p.set(x + dx, y + (r - s.ay), col);
    }
  }
}

/** The eggshell helmet (8×6, dome up, zigzag rim down): L lit skin4 · M earth4 · S earth3 · d earth2 speckle · r rim lip. */
export const SHELL_CAP: Stamp = {
  rows: ['..LLLM...', '.LLLMMMS.', 'LLLMMMdSS', 'LLMMMSSSd', 'LMMMSSSSS', 'L.M.S.S.S'],
  ax: 4,
  ay: 5,
};
/** The baby's chest tuft (a small cloud puff at the throat), 4×3; TUFT_UP bristles. */
export const TUFT: Stamp = { rows: ['.WW..', 'WWWM.', 'WWMMS', '.MSS.'], ax: 2, ay: 1 };
export const TUFT_UP: Stamp = { rows: ['W.W.W', 'WWMWM', 'WWMMS', 'WMMSS', '.SSS.'], ax: 2, ay: 2 };
export const SHELL_KEY: Readonly<Record<string, number>> = Object.freeze({ L: PAL.skin4, M: PAL.earth4, S: PAL.earth3, d: PAL.earth2, r: PAL.skin4 });

/** The baby's cowlick: a three-lobe cloud puff leaning back (W white · M mist · S steel), 10×7. */
export const COWLICK: Stamp = {
  rows: ['....WW....', '..WWWWW...', '.WWWWMWWW.', 'WWWMMWWWWM', 'WWMMSMWMMS', '.MMS.MMSS.', '..S...S...'],
  ax: 5,
  ay: 6,
};
export const COWLICK_UP: Stamp = {
  rows: ['...WW.....', '..WWWW.WW.', '.WWWMWWWWM', 'WWWMMMWWMS', 'WWMSSMMMS.', '.MSS.MMS..', '..S..SS...'],
  ax: 5,
  ay: 6,
};
export const CLOUD_KEY: Readonly<Record<string, number>> = Object.freeze({ W: PAL.white, M: PAL.mist, S: PAL.steel });

// ------------------------------------------------------------------ round cloud puffs (critique r1 #2)

/**
 * One round cloud puff painted by its geometry (never a lit ellipsoid band stack): a `white` cap toward
 * the key light, a `mist` body, a `steel` crescent underneath. `spike` > 0 stands the lobe on end
 * (hitMagic static): its rim breaks into 1-px points. Paints into `q` (a clear layer canvas).
 */
/** the far-side tones of a cloud lobe (the back half of the ring, in the body's shade) */
const DIM: Readonly<Record<number, number>> = Object.freeze({ [PAL.white]: PAL.mist, [PAL.mist]: PAL.steel, [PAL.steel]: PAL.night4 });

export function puffLobe(q: PixelCanvas, cx: number, cy: number, r: number, light: Light, spike = 0, dim = false): void {
  if (dim) {
    const t = new (q.constructor as new (w: number, h: number) => PixelCanvas)(q.w, q.h);
    puffLobe(t, cx, cy, r, light, spike, false);
    for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) if (t.isOpaque(x, y)) q.set(x, y, DIM[t.get(x, y)!] ?? t.get(x, y)!);
    return;
  }
  if (r < 0.8) return;
  const rx = r + 0.35;
  const ry = r * 0.9;
  const lit = light.side < 0 ? -1 : 1;
  const R = Math.ceil(Math.max(rx, ry) + 2);
  for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++)
    for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
      const u = (x + 0.5 - cx) / rx;
      const v = (y + 0.5 - cy) / ry;
      let d = u * u + v * v;
      if (spike > 0) {
        // points: every other rim direction reaches out by `spike` px
        const a = Math.atan2(v, u);
        const tooth = (Math.floor(((a + Math.PI) / (Math.PI * 2)) * Math.max(6, Math.round(r * 2.2))) % 2) * spike;
        const k = (r + tooth) / r;
        d = d / (k * k);
      }
      if (d > 1) continue;
      let col: number = PAL.mist;
      if (r >= 4.5) {
        // a big mass (critique r2 #1): a 2-px steel crescent along the underside, a broad white cap
        // toward the light, mist between — one cap, one crescent, no inner cobbles
        const ux = (x + 0.5 - cx) / rx;
        const uy = (y + 0.5 - cy - 2.2) / ry;
        const wx = (x + 0.5 - (cx + lit * r * 0.22)) / (rx * 0.78);
        const wy = (y + 0.5 - (cy - r * 0.28)) / (ry * 0.72);
        if (v > 0.15 && ux * ux + uy * uy > 1) col = PAL.steel;
        else if (wx * wx + wy * wy < 1) col = PAL.white;
        q.set(x, y, col);
        continue;
      }
      if (r < 2.2) col = v < -0.1 ? PAL.white : v > 0.45 ? PAL.steel : PAL.mist;
      else if (u * u + (v + 0.32) * (v + 0.32) > 1.0 && v > 0.3) col = PAL.steel;
      else if ((u - lit * 0.22) * (u - lit * 0.22) + (v + 0.2) * (v + 0.2) < 0.5) col = PAL.white;
      q.set(x, y, col);
    }
}

/** Overlap contour of the cloud lobes: a soft one-step (white → mist) where a lobe lies over cloud (its own steel crescent does the separating), a step down over the hide. */
export const LOBE_SEAM = seamFrom(
  Object.freeze({
    ...SEAM_T,
    [PAL.white]: PAL.mist,
    [PAL.mist]: PAL.mist,
    [PAL.steel]: PAL.steel,
  }),
);

// ------------------------------------------------------------------ the eggshell cup (critique r1 #4)

/**
 * The half eggshell riding the tail tip, hand-placed (IŞ-2: an _L map for the P1 light, an _R map for
 * the P2 relight; same shape). The dome bulges back (left), the jagged rim faces the body (right): light
 * teeth (`i` skin3, the inner shell lip) between dark notches (`c` earth2, the cavity the tail goes
 * into). L skin4 · M earth4 · S earth3 · d earth2 speckles (2-px, shadow plane only). Anchor = where the
 * tail tip enters the cup. 10×8.
 */
export const SHELL_CUP_L: Stamp = {
  // (the top row: 3 skin4 teeth breaking the outline, the broken edge read at 1×; critique r2 #12)
  rows: ['..L.L.L...', '..LLLLM...', '..LLLLMMi.', '.LLLLMMcc.', 'LLLLMMMSi.', 'LLLMMSdcc.', 'LLMMMSdSi.', '.MMMSSScc.', '..MSSSSi..'],
  ax: 8,
  ay: 5,
};
export const SHELL_CUP_R: Stamp = {
  rows: ['..L.L.L...', '..SMMLL...', '..SMMLLLi.', '.SSMMLLcc.', 'SSSMMLLLi.', 'SdSMMLLcc.', 'SdSMMMLLi.', '.SSSMMLcc.', '..SSSMMi..'],
  ax: 8,
  ay: 5,
};
export const CUP_KEY: Readonly<Record<string, number>> = Object.freeze({ L: PAL.skin4, M: PAL.earth4, S: PAL.earth3, d: PAL.earth2, i: PAL.skin3, c: PAL.earth2 });

/** Lay the cup at the tail tip; `flip` turns the shape round (dome forward, rim toward the back), the light stays put. */
export function shellCup(q: PixelCanvas, x: number, y: number, light: Light, flip: boolean): void {
  const map = (light.side < 0) !== flip ? SHELL_CUP_L : SHELL_CUP_R;
  for (let r = 0; r < map.rows.length; r++) {
    const row = map.rows[r];
    for (let c = 0; c < row.length; c++) {
      const col = CUP_KEY[row[c]];
      if (col === undefined) continue;
      q.set(x + (flip ? map.ax - c : c - map.ax), y + r - map.ay, col);
    }
  }
}

// ------------------------------------------------------------------ enclosed pockets (critique r1 #4)

/**
 * Fill every enclosed transparent pocket (not reachable from the frame border) with the shadow tone of
 * what surrounds it, so p.outline() never turns a tail loop or a gap in the puff wall into a solid ink
 * hole: hide around → `leaf2`, cloud around → `steel`, else `night4`.
 */
export function fillPockets(p: PixelCanvas, floorY = H): void {
  const w = p.w;
  const h = p.h;
  const seen = new Uint8Array(w * h);
  const st: number[] = [];
  for (let x = 0; x < w; x++) st.push(x, 0, x, h - 1);
  for (let y = 0; y < h; y++) st.push(0, y, w - 1, y);
  while (st.length) {
    const y = st.pop()!;
    const x = st.pop()!;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const i = y * w + x;
    if (seen[i] || p.isOpaque(x, y)) continue;
    seen[i] = 1;
    st.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  // (never on the floor rows: the feet band stays where it was, HA-9)
  for (let y = 1; y < Math.min(h - 1, floorY); y++)
    for (let x = 1; x < w - 1; x++) {
      if (seen[y * w + x] || p.isOpaque(x, y)) continue;
      let hide = 0;
      let cloud = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const c = p.get(x + dx, y + dy);
        if (isHide(c)) hide++;
        else if (isCloud(c)) cloud++;
      }
      p.set(x, y, hide >= cloud && hide > 0 ? PAL.leaf2 : cloud > 0 ? PAL.steel : PAL.night4);
    }
}
