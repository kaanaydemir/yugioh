// Zehir Ejderi v3 — the extras' painters (summon, death, revive, hitMagic) and the member's parts table.
//   FOAM    (front slot, before the outline: a pass part) the death melts the hide with rigkit foamPass /
//           surgePass (pose.pass.foam / .surge): a lumpy line runs down the frame, the hide above it is gone,
//           the new top is a crest of toxic froth (leaf4 over leaf3, broken in 2-px runs) and the sludge
//           runs in leaf2 streaks. The horns and the tail blade are bone: they never melt.
//   FLOOR   (fx slot, after the outline, only on EMPTY pixels) the summon's toxic mist (fx.mist), the
//           landing's ooze ring (fx.ring), the death's sludge puddle with its bubbles (fx.puddle,
//           fx.bubble). Flat bands >= 2 px, a 1-px lit lip, no dither, no alpha.
//   FLICKER (glow slot) the hitMagic spell in the scales (fx.flicker).
import { PAL } from '../palette';
import { clamp } from '../rigkit/geom';
import { foamPass, surgePass, hash2, type FoamStyle } from '../rigkit/passes';
import { FRAME, TONES } from './venom_drake-build';
import { CROWN, HEAD, JAW } from './venom_drake-head';
import { BACK, BLADE, BODY, EYE, GLOW, MATTER, SPIKES, WINGS, type Ctx, type Part } from './venom_drake-parts';

const [N0, G0, G1, G2, G3] = TONES.scale;

const FOAM_STYLE: FoamStyle = { crest: [PAL.leaf4, PAL.leaf3], drip: PAL.leaf2, broken: 0.35 };
const FOAM_LINE = { top: 30, floor: 77, wave: { amp: 1.6, len: 19 }, drips: { share: 0.16, len: 4 }, seed: 29 };
let NEVER: ReadonlySet<number> = new Set();

function foamPart(ctx: Ctx): null {
  const pass = ctx.pose.pass ?? {};
  const t = pass.foam ?? 0;
  const surge = pass.surge;
  if (!(t > 0) && !(surge !== undefined && surge < 1)) return null;
  const o = { top: FOAM_LINE.top, floor: FOAM_LINE.floor, style: FOAM_STYLE, keep: (part: number) => NEVER.has(part), drips: FOAM_LINE.drips, seed: FOAM_LINE.seed };
  if (t > 0) foamPass(ctx.comp, { ...o, t, wave: { ...FOAM_LINE.wave, phase: t * 0.6 } });
  else {
    const u = surge as number;
    surgePass(ctx.comp, { ...o, t: u, wave: { ...FOAM_LINE.wave, phase: (1 - u) * 0.6 } });
  }
  return null;
}

const FLOOR = { c: [32, 81] as const, rx: 27, ry: 8.4 };
const floorD = (x: number, y: number, rx: number, ry: number) => Math.hypot((x + 0.5 - FLOOR.c[0]) / rx, (y + 0.5 - FLOOR.c[1]) / ry);
type Put = (x: number, y: number, col: number) => void;

function floorPart(ctx: Ctx): ReturnType<Part['paint']> {
  const { mist, ring, puddle, bubble } = ctx.pose.fx;
  if (!(mist > 0) && !(ring > 0) && !(puddle > 0)) return null;
  const c = ctx.canvas();
  const dst = ctx.dst;
  const lit = ctx.light.from === 'left' ? -1 : 1;
  const put: Put = (x, y, col) => {
    if (x < 2 || y < 2 || x >= FRAME.w - 2 || y >= FRAME.h - 2 || dst.isOpaque(x, y)) return;
    c.set(x, y, col);
  };
  if (puddle > 0) paintPuddle(put, puddle, bubble, lit);
  if (mist > 0) paintMist(put, mist);
  if (ring > 0) paintRing(put, ring);
  return c;
}

/** The sludge: a flat ellipse, leaf0 body, a leaf1 shallow band inside the near edge, a lit leaf2 lip on the far edge, leaf3 glints, popping bubbles. */
function paintPuddle(put: Put, p: number, bubble: number, lit: number): void {
  const rx = 10 + (FLOOR.rx - 10) * clamp(p, 0, 1);
  const ry = 3.4 + (FLOOR.ry - 3.4) * clamp(p, 0, 1);
  for (let y = Math.floor(FLOOR.c[1] - ry - 1); y <= Math.ceil(FLOOR.c[1] + ry + 1); y++)
    for (let x = Math.floor(FLOOR.c[0] - rx - 1); x <= Math.ceil(FLOOR.c[0] + rx + 1); x++) {
      const d = floorD(x, y, rx, ry);
      if (d > 1) continue;
      const far = y + 0.5 < FLOOR.c[1];
      const edge = floorD(x, y + (far ? -1 : 1), rx, ry) > 1 || floorD(x + 1, y, rx, ry) > 1 || floorD(x - 1, y, rx, ry) > 1;
      if (edge) put(x, y, far ? G3 : G2);
      else put(x, y, !far && floorD(x, y + 2, rx, ry) > 1 ? G1 : G0);
    }
  for (const [gx, gy, len] of [[-0.5 * lit, -0.25, 3], [0.4 * lit, 0.3, 2]] as const) {
    const x = Math.round(FLOOR.c[0] + gx * rx);
    const y = Math.round(FLOOR.c[1] + gy * ry);
    for (let k = 0; k < len; k++) if (floorD(x + k, y, rx, ry) < 0.85) put(x + k, y, PAL.leaf3);
  }
  // bubbles: five stations on the sludge; `bubble` (a count) chooses which are up, which popped (a 2-px ring burst)
  const B: readonly [number, number][] = [[-0.55, -0.1], [-0.15, 0.4], [0.25, -0.35], [0.55, 0.25], [0.05, 0.05]];
  B.forEach(([bx, by], i) => {
    const ph = ((bubble + i * 2) % 5) / 5;
    const x = Math.round(FLOOR.c[0] + bx * rx);
    const y = Math.round(FLOOR.c[1] + by * ry);
    if (floorD(x, y, rx, ry) > 0.8 || p < 0.3) return;
    if (ph < 0.6) {
      put(x, y, G3);
      put(x + 1, y, G3);
      put(x, y - 1, PAL.leaf4);
      put(x + 1, y - 1, G2);
    } else if (ph < 0.8) {
      put(x - 1, y - 1, PAL.leaf4);
      put(x + 2, y - 1, PAL.leaf4);
      put(x, y + 1, G3);
      put(x + 1, y + 1, G3);
    }
  });
}

/** The toxic mist (summon): clumps of fog on the floor round the coil that swell, drift and settle into the body. */
function paintMist(put: Put, p: number): void {
  const grow = clamp(p / 0.3, 0, 1);
  const fade = clamp((p - 0.7) / 0.3, 0, 1);
  const R = (7 + (FLOOR.rx - 3) * grow) * (1 - 0.5 * fade);
  const sq = FLOOR.ry / FLOOR.rx;
  const drift = Math.floor(p * 9);
  for (let y = Math.floor(FLOOR.c[1] - R * sq - 3); y <= Math.ceil(FLOOR.c[1] + R * sq + 1); y++)
    for (let x = Math.floor(FLOOR.c[0] - R - 1); x <= Math.ceil(FLOOR.c[0] + R + 1); x++) {
      const dx = x + 0.5 - FLOOR.c[0];
      const dy = (y + 0.5 - FLOOR.c[1]) / sq;
      const rho = Math.hypot(dx, dy);
      if (rho > R) continue;
      const n = hash2((x + drift) >> 1, (y - drift) >> 1, 41);
      const edge = (R - rho) / R;
      if (n > 0.2 + 0.7 * edge) continue;
      const hot = hash2((x - drift) >> 1, y >> 1, 43);
      put(x, y, hot < 0.1 ? G3 : n < 0.1 ? G2 : G1);
    }
}

function paintRing(put: Put, p: number): void {
  const rx = 22 + 7 * clamp(p, 0, 1);
  const ry = rx * (FLOOR.ry / FLOOR.rx);
  const thick = p < 0.45 ? 2 : 1;
  for (let y = Math.floor(FLOOR.c[1] - ry - 2); y <= Math.ceil(FLOOR.c[1] + ry + 2); y++)
    for (let x = Math.floor(FLOOR.c[0] - rx - 2); x <= Math.ceil(FLOOR.c[0] + rx + 2); x++) {
      const d = floorD(x, y, rx, ry);
      if (d > 1 || d < 1 - thick / ry) continue;
      const th = Math.atan2((y + 0.5 - FLOOR.c[1]) / (FLOOR.ry / FLOOR.rx), x + 0.5 - FLOOR.c[0]);
      const seg = Math.floor((th + Math.PI) * 4);
      if (hash2(seg, 3, 13) < p * 0.7) continue;
      put(x, y, hash2(seg, 4, 13) < 0.5 ? PAL.leaf4 : PAL.leaf3);
    }
}

const FLICKER = { row: 5, share: 0.6 };
function flickerPart(ctx: Ctx): ReturnType<Part['paint']> {
  const n = ctx.pose.fx.flicker;
  if (!(n > 0)) return null;
  const dst = ctx.dst;
  const c = ctx.canvas();
  const body = new Set([PART_INDEX.back, PART_INDEX.body]);
  for (let y = 1; y < FRAME.h - 1; y++)
    for (let x = 1; x < FRAME.w - 1; x++) {
      if (!body.has(ctx.comp.owner(x, y))) continue;
      const col = dst.get(x, y);
      if (col !== G1 && col !== G0) continue;
      const nb = [dst.get(x - 1, y), dst.get(x + 1, y), dst.get(x, y - 1), dst.get(x, y + 1)];
      if (!nb.includes(G2)) continue;
      const row = hash2(Math.floor(x / FLICKER.row), Math.floor(y / FLICKER.row), Math.round(n) * 7 + 3);
      if (row >= FLICKER.share) continue;
      c.set(x, y, row < FLICKER.share * 0.35 ? PAL.white : PAL.leaf4);
    }
  return c;
}
void N0;

export const PARTS: Readonly<Record<string, Part | null>> = Object.freeze({
  back: BACK,
  fin: SPIKES,
  wings: WINGS,
  fan: BLADE,
  body: BODY,
  crown: CROWN,
  jaw: JAW,
  head: HEAD,
  eye: EYE,
  foam: { layer: 'front', seam: 'none', paint: foamPart },
  glow: GLOW,
  matter: MATTER,
  floor: { layer: 'fx', seam: 'none', paint: floorPart },
  flicker: { layer: 'glow', seam: 'none', paint: flickerPart },
});

export const PART_INDEX: Readonly<Record<string, number>> = Object.freeze(Object.fromEntries(Object.keys(PARTS).map((k, i) => [k, i + 1])));
NEVER = new Set([PART_INDEX.fan]);
