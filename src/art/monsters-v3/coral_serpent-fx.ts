// Mercan Yılanı v3 (A4.1) — the EXTRAS' painters on the 'serpent' type (part 2: summon, death, revive,
// hitMagic) and the member's full parts table. No default export (the registry imports this file at boot
// and gets nothing; nothing heavy at load).
//
//   FOAM     (front slot, before the outline: a "pass part") the water death and revive — rigkit foamPass /
//            surgePass in the frame's pattern space (./coral_serpent-parts PATTERN: every painted pixel's
//            still px), so the foam rides the body. Order: the top of the rest silhouette first (the
//            head, the neck, then the coil — the body melts down into the floor). The coral crown is
//            stone: it never foams (it sinks onto the heap, fx.sink); matter (drops, spray) never foams.
//   FLOOR    (fx slot, after the outline, only on EMPTY pixels: the floor is behind everything standing
//            on it, and the body keeps its own outline) the summon's whirlpool (fx.whirl), the shed
//            water's splash ring (fx.ring), the death's puddle and the revive's currents running back
//            into the coil (fx.puddle, fx.inflow). Water on the floor is flat: bands ≥ 2 px, a 1-px lit lip
//            on its far edge, short water4 glints — no dither, no alpha (MA-4).
//   FLICKER  (glow slot: light, after the outline) the hitMagic spell in the scales: the scale-row teeth
//            (the darker band's 2-px teeth on the mid / shadow boundary) burn cyan / white, a different
//            set of rows every frame (fx.flicker).

import { PAL } from '../palette';
import { clamp } from '../rigkit/geom';
import { foamPass, surgePass, hash2, type FoamStyle } from '../rigkit/passes';
import { FRAME, TONES } from './coral_serpent-build';
import { BACK, BODY, CROWN, FAN, FIN, HEAD, JAW, MATTER, NO_PATTERN, PATTERN, WATER, type Ctx, type Part } from './coral_serpent-parts';

const [W0, W1, W2, W3, W4] = TONES.scale;

// ------------------------------------------------------------------ the foam pass (death / revive)

/** the water's foam crest: white over water4, the meltwater running down in water3 (REHBER §2.3 Su) */
const FOAM_STYLE: FoamStyle = { crest: [PAL.white, W4], drip: W3 };
/** the water line's rows: above the fallen head (progress 0) … the low heap's top (1: what the death kit breaks) */
const FOAM_LINE = { top: 52, floor: 77, wave: { amp: 1.6, len: 21 }, drips: { share: 0.16, len: 4 }, seed: 17 };

/** part ids (1-based in the parts table's order) that never melt: the coral crown (stone), matter */
let NEVER: ReadonlySet<number> = new Set();

function foamPart(ctx: Ctx): null {
  const pass = ctx.pose.pass ?? {};
  const t = pass.foam ?? 0;
  const surge = pass.surge;
  if (!(t > 0) && !(surge !== undefined && surge < 1)) return null;
  const o = {
    top: FOAM_LINE.top,
    floor: FOAM_LINE.floor,
    style: FOAM_STYLE,
    keep: (part: number) => NEVER.has(part),
    drips: FOAM_LINE.drips,
    seed: FOAM_LINE.seed,
  };
  if (t > 0) foamPass(ctx.comp, { ...o, t, wave: { ...FOAM_LINE.wave, phase: t * 0.6 } });
  else {
    const u = surge as number;
    surgePass(ctx.comp, { ...o, t: u, wave: { ...FOAM_LINE.wave, phase: (1 - u) * 0.6 } });
  }
  return null;
}

// ------------------------------------------------------------------ the floor (after the outline, on empty px)

/** The floor round the coil (frame px): centre and the widest radii a puddle / ring reaches (≥ 2 px margin). */
const FLOOR = { c: [33, 80] as const, rx: 27, ry: 8.4 };
/** pixel-art ellipse test on the floor plane: d = normalised radius (1 = the edge) */
const floorD = (x: number, y: number, rx: number, ry: number) => Math.hypot((x + 0.5 - FLOOR.c[0]) / rx, (y + 0.5 - FLOOR.c[1]) / ry);

function floorPart(ctx: Ctx): ReturnType<Part['paint']> {
  const { whirl, ring, puddle, inflow } = ctx.pose.fx;
  if (!(whirl > 0) && !(ring > 0) && !(puddle > 0)) return null;
  const c = ctx.canvas();
  const dst = ctx.dst;
  const lit = ctx.light.from === 'left' ? -1 : 1; // the side of the floor's lip that catches the key light
  const put = (x: number, y: number, col: number) => {
    if (x < 2 || y < 2 || x >= FRAME.w - 2 || y >= FRAME.h - 2 || dst.isOpaque(x, y)) return;
    c.set(x, y, col);
  };
  if (puddle > 0) paintPuddle(put, puddle, inflow, lit);
  if (whirl > 0) paintWhirl(put, whirl);
  if (ring > 0) paintRing(put, ring);
  return c;
}

type Put = (x: number, y: number, col: number) => void;

/**
 * The puddle: a flat ellipse of water on the floor — the body water1 (the floor's dark seen through
 * it), a 2-px water2 band inside the near edge (the shallow), the far lip a 1-px water3 line (it faces
 * the key light), two short water4 glints that keep their place; the revive's currents (inflow) run
 * over it toward the coil as 2–3-px water4 dashes, moving inward ≥ 1 px a frame.
 */
function paintPuddle(put: Put, p: number, inflow: number, lit: number): void {
  const rx = 10 + (FLOOR.rx - 10) * clamp(p, 0, 1);
  const ry = 3.4 + (FLOOR.ry - 3.4) * clamp(p, 0, 1);
  const x0 = Math.floor(FLOOR.c[0] - rx - 1);
  const x1 = Math.ceil(FLOOR.c[0] + rx + 1);
  const y0 = Math.floor(FLOOR.c[1] - ry - 1);
  const y1 = Math.ceil(FLOOR.c[1] + ry + 1);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const d = floorD(x, y, rx, ry);
      if (d > 1) continue;
      const far = y + 0.5 < FLOOR.c[1];
      // the lip: the outermost px ring (1 px), lit on the far edge, the near edge one value darker
      const edge = floorD(x, y + (far ? -1 : 1), rx, ry) > 1 || floorD(x + 1, y, rx, ry) > 1 || floorD(x - 1, y, rx, ry) > 1;
      if (edge) put(x, y, far ? W3 : W2);
      else put(x, y, !far && floorD(x, y + 2, rx, ry) > 1 ? W2 : W1);
    }
  // glints (fixed places on the surface, the light's side first)
  for (const [gx, gy, len] of [[-0.55 * lit, -0.25, 3], [0.35 * lit, 0.35, 2]] as const) {
    const x = Math.round(FLOOR.c[0] + gx * rx);
    const y = Math.round(FLOOR.c[1] + gy * ry);
    for (let k = 0; k < len; k++) if (floorD(x + k, y, rx, ry) < 0.85) put(x + k, y, W4);
  }
  if (inflow > 0) {
    // currents: dashes on four bearings, each sliding inward along its ray as the phase grows
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * Math.PI * 2 + 0.4;
      const along = ((1 - ((inflow * 1.6 + a * 0.37) % 1)) * 0.75 + 0.25) * 1; // 1 → 0.25 of the radius
      const x = Math.round(FLOOR.c[0] + Math.cos(ang) * rx * along);
      const y = Math.round(FLOOR.c[1] + Math.sin(ang) * ry * along);
      const dx = Math.cos(ang) > 0 ? -1 : 1; // the dash trails away from the coil
      for (let k = 0; k < 3; k++) if (floorD(x + k * dx, y, rx, ry) < 0.92) put(x + k * dx, y, k ? W3 : W4);
    }
  }
}

/**
 * The whirlpool (summon): it opens on the floor round the coil, spins (three log-spiral arms, water3 with
 * a water4 crest, on a water1 / water2 bowl, the dark water0 eye at its centre) and closes as the water
 * rises into the body; its rim foams in white dashes.
 */
function paintWhirl(put: Put, p: number): void {
  const open = clamp(p / 0.3, 0, 1);
  const close = clamp((p - 0.62) / 0.38, 0, 1);
  const R = (6 + (FLOOR.rx - 4 - 6) * open) * (1 - 0.55 * close);
  if (R < 2) return;
  const sq = FLOOR.ry / FLOOR.rx;
  const spin = p * Math.PI * 2 * 1.6;
  const x0 = Math.floor(FLOOR.c[0] - R - 1);
  const x1 = Math.ceil(FLOOR.c[0] + R + 1);
  const y0 = Math.floor(FLOOR.c[1] - R * sq - 1);
  const y1 = Math.ceil(FLOOR.c[1] + R * sq + 1);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - FLOOR.c[0];
      const dy = (y + 0.5 - FLOOR.c[1]) / sq;
      const rho = Math.hypot(dx, dy);
      if (rho > R) continue;
      const th = Math.atan2(dy, dx);
      if (rho < 2.2) {
        put(x, y, W0);
        continue;
      }
      // arms: three spirals winding in (θ + k·ln ρ), turning with the spin
      const arm = ((((th + 2.2 * Math.log(rho) - spin) / ((Math.PI * 2) / 3)) % 1) + 1) % 1;
      const rim = R - rho < 1.2;
      if (rim) put(x, y, hash2(Math.floor((th + spin) * 3), 0, 9) < 0.55 ? PAL.white : W4);
      else if (arm < 0.16) put(x, y, rho > R * 0.55 ? W4 : W3);
      else if (arm < 0.3) put(x, y, W3);
      else put(x, y, rho < R * 0.45 ? W1 : W2);
    }
}

/** The shed water's splash ring (summon land): a foam ring that runs out from the coil's foot, thins and breaks up. */
function paintRing(put: Put, p: number): void {
  const rx = 19 + 8 * clamp(p, 0, 1);
  const ry = rx * (FLOOR.ry / FLOOR.rx);
  const thick = p < 0.45 ? 2 : 1;
  const x0 = Math.floor(FLOOR.c[0] - rx - 2);
  const x1 = Math.ceil(FLOOR.c[0] + rx + 2);
  const y0 = Math.floor(FLOOR.c[1] - ry - 2);
  const y1 = Math.ceil(FLOOR.c[1] + ry + 2);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const d = floorD(x, y, rx, ry);
      if (d > 1 || d < 1 - thick / ry) continue;
      const th = Math.atan2((y + 0.5 - FLOOR.c[1]) / (FLOOR.ry / FLOOR.rx), x + 0.5 - FLOOR.c[0]);
      const seg = Math.floor((th + Math.PI) * 4);
      // it breaks up as it runs out: the later, the more gaps
      if (hash2(seg, 3, 13) < p * 0.7) continue;
      put(x, y, hash2(seg, 4, 13) < 0.5 ? PAL.white : W4);
    }
}

// ------------------------------------------------------------------ the spell in the scales (hitMagic)

/** the scale rows' burn: rows are 5-px bands of the still (the teeth's period); half of them burn a frame */
const FLICKER = { row: 5, share: 0.5 };

function flickerPart(ctx: Ctx): ReturnType<Part['paint']> {
  const n = ctx.pose.fx.flicker;
  if (!(n > 0)) return null;
  const dst = ctx.dst;
  const c = ctx.canvas();
  const W = FRAME.w;
  const body = new Set([PART_INDEX.back, PART_INDEX.body]);
  for (let y = 1; y < FRAME.h - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      if (!body.has(ctx.comp.owner(x, y))) continue;
      const col = dst.get(x, y);
      if (col !== W1 && col !== W0) continue;
      // a tooth: the darker band reaching into the mid plane
      const nb = [dst.get(x - 1, y), dst.get(x + 1, y), dst.get(x, y - 1), dst.get(x, y + 1)];
      if (!nb.includes(W2)) continue;
      const i = y * W + x;
      const sx = PATTERN.x[i];
      const sy = PATTERN.y[i];
      if (sx === NO_PATTERN) continue;
      const row = hash2(Math.floor(sx / FLICKER.row), Math.floor(sy / FLICKER.row), Math.round(n) * 7 + 3);
      if (row >= FLICKER.share) continue;
      c.set(x, y, row < FLICKER.share * 0.35 ? PAL.white : PAL.cyan4);
    }
  return c;
}

// ------------------------------------------------------------------ the parts table

/** The member's parts, in the order they are painted within a slot (the foam pass after the matter). */
export const PARTS: Readonly<Record<string, Part | null>> = Object.freeze({
  back: BACK,
  fin: FIN,
  fan: FAN,
  body: BODY,
  crown: CROWN,
  jaw: JAW,
  head: HEAD,
  matter: MATTER,
  water: WATER,
  foam: { layer: 'front', seam: 'none', paint: foamPart },
  floor: { layer: 'fx', seam: 'none', paint: floorPart },
  flicker: { layer: 'glow', seam: 'none', paint: flickerPart },
});

/** Part name → its 1-based id in the frame's part-id buffer (planArt: the parts table's order). */
export const PART_INDEX: Readonly<Record<string, number>> = Object.freeze(Object.fromEntries(Object.keys(PARTS).map((k, i) => [k, i + 1])));
NEVER = new Set([PART_INDEX.crown, PART_INDEX.matter]);
