// Kabuk Zıpkıncı v3 — effect painters for the card's signature moments (pure PixelCanvas painters, palette only, whole
// pixels, deterministic; the cinematics place / time them, this file only draws). Nothing runs at import: every cache
// is filled on first use (boot-cost rule: this file is in the eager monsters-v3 glob).
//
//   harpoonFrame   the thrown harpoon on its own (the rig's own harpoon painter, same planes / lashing / barbs): flight,
//                  the reel back, the LP-panel stake (`bury` cuts the head into the panel), the death's standing harpoon
//   ropeLine       the 2-px rope (lit earth4/earth3 over earth1, NOT outlined) between two points: slack sag, taut
//                  (straight, one step brighter), a stick-slip wobble, the last 12 px wet
//   exitSpray      the contact's exit spray: a narrow fan of 3–4 streaks out of the target's FAR side along the throw,
//                  then 3 droplets landing as 1-px wet dots (not a splash crown, not a foam crash)
//   shroudWall     Körfez kalkanı: the standing wave wall round the tile ellipse (iso 64×32), back half / front half
//                  separately (back behind the sprite, front in front), rise 0 → 4 px then 2 px, a 3-px white foam crest
//                  running round it, the CURL where a targeting attempt hits it (up to 10 px, a white lip), and the
//                  collapse into a splash ring that soaks into the tile
//   korunuyorPlate the "KORUNUYOR" stamp: water1 plate, 1-px water4 border, white UI letters; `big` = the one-size-bigger
//                  34-ms pop (EF-9 style); `sink` slides it down 3 px and steps it out in 2 tone steps
//   splinters      the death's harpoon breaking: 6 driftwood bits (earth1/2) + the stone head falling flat, blinking out
//                  in palette steps

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { getFont } from '../font';
import { drawHarpooner, pose, W as RW, H as RH, AX, GY, HARP_L, skeleton } from './tide_harpooner-rig';
import { hash2, rope2, sagCurve, type Pt } from './tide_harpooner-kit';

const rnd = Math.round;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- the harpoon on its own

export interface HarpoonFrame {
  /** the rig-sized canvas (120×104) holding only the harpoon */
  px: PixelCanvas;
  /** tip, butt and line ring in that canvas's pixels */
  tip: Pt;
  butt: Pt;
  ring: Pt;
}

const HCACHE = new Map<string, HarpoonFrame>();

/**
 * The harpoon alone at angle `ha` (deg; 0 = pointing right, 180 = pointing left / reeled back head-first), its centre on
 * the canvas centre. `bury` px of the head are cut off (stuck in the LP panel); `smear` adds the release smear; `wet`
 * darkens nothing on the harpoon (the rope carries the wet tail) but is kept in the key for symmetry with the rope.
 */
export function harpoonFrame(ha: number, light: 'left' | 'right' = 'left', o: { bury?: number; smear?: number } = {}): HarpoonFrame {
  const a = Math.round(ha);
  const key = `${a}|${light}|${o.bury ?? 0}|${o.smear ?? 0}`;
  const hit = HCACHE.get(key);
  if (hit) return hit;
  const dx = Math.cos((a * Math.PI) / 180);
  const dy = Math.sin((a * Math.PI) / 180);
  const cx = RW / 2;
  const cy = RH / 2;
  const hx = rnd(cx - dx * HARP_L * 0.5) - AX;
  const hy = rnd(cy - dy * HARP_L * 0.5) - GY;
  const ps = pose({ shell: 0, ext: 0, eye: 0, legs: 0, nOn: 0, fOn: 0, rope: 0, coil: 0, held: 0, hx, hy, ha: a, smear: o.smear ?? 0 });
  const px = new PixelCanvas(RW, RH);
  drawHarpooner(px, ps, light);
  const sk = skeleton(ps);
  const tip: Pt = [rnd(sk.ht[0]), rnd(sk.ht[1])];
  if (o.bury && o.bury > 0) {
    // cut everything past (tip − bury) along the shaft: the head is IN the panel
    const lim = HARP_L - o.bury;
    for (let y = 0; y < RH; y++)
      for (let x = 0; x < RW; x++) {
        const along = (x + 0.5 - sk.hb[0]) * dx + (y + 0.5 - sk.hb[1]) * dy;
        if (along > lim) px.erase(x, y);
      }
  }
  const f: HarpoonFrame = { px, tip, butt: [rnd(sk.hb[0]), rnd(sk.hb[1])], ring: [rnd(sk.hring[0]), rnd(sk.hring[1])] };
  HCACHE.set(key, f);
  return f;
}

// ---------------------------------------------------------------- rope

export interface RopeOpts {
  /** px of sag at the middle (slack), 0 = straight */
  sag?: number;
  /** sideways bow (px) */
  side?: number;
  /** taut: straight and one tone brighter (haul 1) */
  taut?: boolean;
  /** 0…1: the last 12 px (at `to`) wet earth2 */
  wet?: number;
  /** stick-slip wobble amplitude (px) and phase (0…1): the slack after the rip-out */
  wobble?: number;
  phase?: number;
}

/** The rope between two points on `p` (whole pixels, not outlined). */
export function ropeLine(p: PixelCanvas, from: Pt, to: Pt, o: RopeOpts = {}): void {
  const n = Math.max(6, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 4));
  let pts = sagCurve(from, to, o.taut ? 0 : (o.sag ?? 4), o.side ?? 0, n);
  if (o.wobble) {
    const ph = o.phase ?? 0;
    const L = pts.length - 1;
    const nx = -(to[1] - from[1]);
    const ny = to[0] - from[0];
    const nl = Math.hypot(nx, ny) || 1;
    pts = pts.map(([x, y], i) => {
      const k = Math.sin((i / L) * Math.PI) * Math.sin((i / L) * TAU * 2 + ph * TAU) * o.wobble!;
      return [x + (nx / nl) * k, y + (ny / nl) * k] as Pt;
    });
  }
  const top = o.taut ? PAL.earth4 : PAL.earth3;
  const under = o.taut ? PAL.earth2 : PAL.earth1;
  rope2(p, pts, top, under, undefined, o.wet ? { len: rnd(12 * o.wet), top: PAL.earth2, under: PAL.earth1 } : undefined);
}

// ---------------------------------------------------------------- exit spray

/**
 * The puncture's exit spray at `at` (the target's far side), along the throw direction `dir` (unit): 3–4 narrow streaks
 * fanning ±16°, white heads, water4 bodies, growing then breaking into drops; from phase 0.6 three droplets land as 1-px
 * wet dots on the floor row `floorY`.
 */
export function exitSpray(p: PixelCanvas, at: Pt, dir: Pt, phase: number, floorY: number, seed = 1): void {
  const ph = Math.max(0, Math.min(1, phase));
  const base = Math.atan2(dir[1], dir[0]);
  for (let i = 0; i < 4; i++) {
    const a = base + ((i - 1.5) / 1.5) * 0.28 + (hash2(i, seed, 3) - 0.5) * 0.08;
    const len = (6 + i * 2 + hash2(i, seed, 5) * 4) * Math.min(1, ph * 2.2);
    const start = ph * 8;
    const gap = ph > 0.55 ? (ph - 0.55) * 14 : 0;
    for (let d = start; d < start + len; d += 0.6) {
      if (gap > 0 && ((d - start) % 4) < gap / 2) continue; // breaking into drops
      const x = rnd(at[0] + Math.cos(a) * d);
      const y = rnd(at[1] + Math.sin(a) * d + (d * d) / 90);
      const head = d > start + len - 2;
      p.set(x, y, head ? PAL.white : PAL.water4);
      if (!head && ph < 0.5) p.set(x, y + 1, PAL.water3);
    }
  }
  if (ph >= 0.6)
    for (let i = 0; i < 3; i++) {
      const x = rnd(at[0] + dir[0] * (10 + i * 6) + (hash2(i, seed, 9) - 0.5) * 6);
      const fall = Math.min(1, (ph - 0.6) / 0.3);
      const y = rnd(at[1] + (floorY - at[1]) * fall);
      p.set(x, y, fall >= 1 ? PAL.water3 : PAL.water4);
    }
}

// ---------------------------------------------------------------- Körfez kalkanı: the wave wall

export interface WallOpts {
  /** wall height (px): 0 … 4 rising, 2 settled */
  height: number;
  /** foam crest position on the ring, 0…1 (0 = front centre, going round toward the right) */
  crest: number;
  /** a targeting attempt: where it hits the ring (0…1, same measure) and the curl 0…1 (→ 10 px) */
  curlAt?: number;
  curl?: number;
  /** the drop: 0 standing … 1 soaked into the tile (splash ring) */
  collapse?: number;
  /** the ellipse radii (default RING: the 64×32 tile; the cinematics pass the arena's tile) */
  rx?: number;
  ry?: number;
}

/** Iso ellipse of the tile (64×32 by default). */
export const RING = { rx: 32, ry: 16 };

/**
 * One half of the wall round the tile centred at (cx, cy) on `p`. `half` 'back' is the far arc (drawn BEHIND the unit),
 * 'front' the near arc (drawn in front; keep it low: EF-2, ≤ 8 % of the silhouette). Tones: water2 body, water3 middle
 * band, water4 top edge, the crest white.
 */
export function shroudWall(p: PixelCanvas, cx: number, cy: number, half: 'back' | 'front', o: WallOpts): void {
  const steps = 360;
  const col = o.collapse ?? 0;
  for (let i = 0; i < steps; i++) {
    const u = i / steps; // 0 = front centre
    const a = Math.PI / 2 + u * TAU; // screen angle (y down): π/2 = the near point
    const sx = Math.cos(a);
    const sy = Math.sin(a);
    const back = sy < 0;
    if ((half === 'back') !== back) continue;
    const r = 1 + col * 0.35;
    const x = rnd(cx + sx * (o.rx ?? RING.rx) * r);
    const y = rnd(cy + sy * (o.ry ?? RING.ry) * r);
    let h = o.height * (1 - col);
    // the curl: a bump of up to 10 px where the attempt hit, its lip curling over
    if (o.curl && o.curlAt !== undefined) {
      let d = Math.abs(u - o.curlAt);
      d = Math.min(d, 1 - d);
      const k = Math.max(0, 1 - d / 0.07);
      h = Math.max(h, 10 * o.curl * k * k * (3 - 2 * k));
    }
    const hh = rnd(h);
    if (col > 0 && hh <= 0) {
      // soaked: a broken 1-px splash ring
      if ((i & 3) !== 3) p.set(x, y, col < 0.6 ? PAL.water4 : PAL.water3);
      continue;
    }
    for (let k = 0; k <= hh; k++) {
      const c = k === hh ? PAL.water4 : k >= hh - 1 && hh >= 3 ? PAL.water3 : k === 0 ? PAL.water3 : PAL.water2;
      p.set(x, y - k, c);
    }
    // crest: a 3-px white foam run on the top edge
    let dc = Math.abs(u - o.crest);
    dc = Math.min(dc, 1 - dc);
    if (dc < 0.012 && hh >= 1) p.set(x, y - hh, PAL.white).set(x, y - hh - 1, PAL.white);
    // the curl's lip: white tipped over toward the outside
    if (o.curl && hh >= 6) {
      p.set(x, y - hh - 1, PAL.white);
      p.set(x + (sx > 0 ? 1 : -1), y - hh, PAL.white);
    }
  }
}

// ---------------------------------------------------------------- KORUNUYOR

const PLATE_CACHE = new Map<string, PixelCanvas>();

/**
 * The "KORUNUYOR" plate. `big` = the one-size-bigger pop frame (md letters), else sm letters. `fade` 0 / 1 / 2 steps the
 * plate out (2 tone steps, no alpha). Returns its own canvas (centre it above the crab).
 */
export function korunuyorPlate(big = false, fade = 0): PixelCanvas {
  const key = `${big}|${fade}`;
  const hit = PLATE_CACHE.get(key);
  if (hit) return hit;
  const font = getFont(big ? 'md' : 'sm');
  const text = 'KORUNUYOR';
  const cellH = font.def.cellH;
  let tw = 0;
  for (const ch of text) tw += (font.glyphs.get(ch.charCodeAt(0))?.w ?? 3) + 1;
  tw -= 1;
  const padX = big ? 5 : 4;
  const top = font.def.capTop;
  const capH = font.def.capH;
  const w = tw + padX * 2 + 2;
  const h = capH + (big ? 8 : 6);
  const p = new PixelCanvas(w, h);
  const fill = fade >= 2 ? PAL.night1 : fade >= 1 ? PAL.water0 : PAL.water1;
  const border = fade >= 2 ? PAL.water1 : fade >= 1 ? PAL.water3 : PAL.water4;
  const ink = fade >= 2 ? PAL.water3 : fade >= 1 ? PAL.water4 : PAL.white;
  p.rect(1, 0, w - 2, h, border).rect(0, 1, w, h - 2, border);
  p.rect(1, 1, w - 2, h - 2, fill);
  // a wave notch on the plate's lower border (the plate is water, not a pillow)
  for (let x = 3; x < w - 3; x += 6) p.set(x, h - 2, border).set(x + 1, h - 2, border);
  let x = padX + 1;
  const y = Math.floor((h - capH) / 2) - top;
  for (const ch of text) {
    const g = font.glyphs.get(ch.charCodeAt(0));
    if (!g) continue;
    for (let j = 0; j < cellH; j++) for (let i = 0; i < g.w; i++) if (g.bits[j * g.w + i]) p.set(x + i, y + j, ink);
    x += g.w + 1;
  }
  p.outline(PAL.ink);
  PLATE_CACHE.set(key, p);
  return p;
}

// ---------------------------------------------------------------- the harpoon splinters (death, +0.5 s)

/**
 * The standing harpoon breaking at `phase` 0…1 on a canvas of the rig's size: 6 driftwood bits fly out and fall flat on the
 * floor row, the stone head drops flat; from 0.7 they blink out in palette steps (earth2 → earth1 → gone).
 */
export function splinters(p: PixelCanvas, butt: Pt, phase: number, light: 'left' | 'right' = 'left'): void {
  const ph = Math.max(0, Math.min(1, phase));
  const fade = ph < 0.7 ? 0 : ph < 0.85 ? 1 : 2;
  if (fade >= 2) return;
  const ls = light === 'left' ? -1 : 1;
  for (let i = 0; i < 6; i++) {
    const h0 = 8 + i * 9; // where along the shaft the bit was
    const side = i % 2 ? 1 : -1;
    const vx = side * (4 + hash2(i, 2, 7) * 10);
    const t = Math.min(1, ph * 1.8);
    const x = rnd(butt[0] + vx * t);
    const y0 = butt[1] - h0;
    const y = rnd(Math.min(butt[1] - 1, y0 + (butt[1] - 1 - y0) * t * t));
    const flat = t >= 1;
    const len = 4 + (i % 3);
    const lit = fade ? PAL.earth2 : PAL.earth3;
    const dark = fade ? PAL.earth1 : PAL.earth2;
    for (let k = 0; k < len; k++) {
      const px = flat ? x + k - (len >> 1) : x + rnd((k - len / 2) * 0.5 * side);
      const py = flat ? y : y - k + (len >> 1);
      p.set(px, py, k === 0 || (ls < 0 ? k < len / 2 : k >= len / 2) ? lit : dark);
    }
  }
  // the stone head: falls straight, lands flat
  const t = Math.min(1, ph * 1.6);
  const hy = rnd(butt[1] - HARP_L + 8 + (HARP_L - 9) * t * t);
  const hx = butt[0] + 1;
  const flat = t >= 1;
  const head = flat ? ['.##..', '#####', '.##..'] : ['.#.', '###', '###', '#.#'];
  head.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === '#') p.set(hx + i - 2, (flat ? butt[1] - 2 : hy) + j, fade ? PAL.stone2 : j === 0 ? PAL.stone4 : PAL.stone3);
  });
}
