// Magma Titanı v3 (A4.1 part 2) — the EXTRAS' painters: what the summon, death, revive, hits and the
// special add to the part-1 painters (./magma_titan-parts.ts). No default export (the registry ignores
// this file); every painter is a pure function of the frame's channels (./magma_titan-build.ts TitanFx).
//
//   molten   (summon, before the outline) the fresh magma body: each rigid part shows the still's own
//            planes in fire tones by a level read from the crust front (fx.cool) — molten (lit fire4 ·
//            mid fire3 · shadow fire2 · cuts fire1), hot (one step down), red crust (lit fire1 · mid
//            fire0, the shadow already basalt) and then basalt —, block by block from the top down, so
//            the planes and creases of the still survive in fire and the basalt "cools onto it". The
//            glow slot reads the same levels: a seam in molten rock burns fire4, in the crust fire3.
//   crumble  (death / revive, before the outline) rigkit's crumble / reassemble passes in the parts' own
//            rest space (a crack stays on its block), in basalt tones (CRUMBLE_BASALT) and from the
//            core outward (the heart fails first); the lava is re-toned first so the chunks that break
//            off carry this frame's light (cold in a death). The revive closes the cracks with lava in
//            them only where the light has already come back (fx.lit).
//   debris   (after the outline) the broken-off chunks (rigkit drawDebris), never outlined.
//   floor    (summon, light) the crack in the floor under the feet (fx.fissure: a 1-px hairline that
//            splits into a fire3 vein with fire1 lips), the magma welling up around it (fx.pool: a 2:1
//            pool, fire2 rim · fire3 · a fire4 crest, behind the body: only where nothing is drawn),
//            and where a sunk body breaks the surface a fire4 / fire3 collar laps at it; the pool drains
//            back into the crack and cools (fx.pool 1 → 2).
//   splash   (hitHeavy, death) lava squirted out of the struck seams: six drops thrown up and out,
//            falling and cooling (fire4 → fire3 → fire2 → a stone1 bead); over the body only while
//            they are leaving the seam.
//   ball     (special) the fireball forming AT the core (fx.ball = radius px): a fire4 heart (gold4 / a
//            white centre at full heat), a fire3 body, fire2 tongues licking up off its top by frame;
//            the sparks it pulls in (fx.gather): six on fixed rays, streaking inward.
//   ash      (death) four embers rising off the cooling heap, cooling as they go.
// Light is drawn after the outline and never outlined (REHBER IŞ-9); matter (the molten re-tone, the
// cracks, the chunks) before it or as debris.

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import { crumblePass, drawDebris, reassemblePass, type CrumbleStyle, type Debris } from '../rigkit/passes';
import type { V } from '../rigkit/geom';
import { CORE_AT } from './magma_titan-maps';
import { REST_RIG, partName, placesOf, retoneLava, type Ctx } from './magma_titan-parts';

const rnd = Math.round;
const inFrame = (p: PixelCanvas, x: number, y: number) => x >= 2 && x < p.w - 2 && y >= 2 && y < p.h - 2;
const setIf = (p: PixelCanvas, x: number, y: number, c: number, over = false) => {
  if (inFrame(p, x, y) && (over || !p.isOpaque(x, y))) p.set(x, y, c);
};

// ------------------------------------------------------------------ molten (summon)

/** Basalt tone → its molten tone, by heat level 3 (molten) / 2 (hot) / 1 (red crust). */
const MOLTEN_MAP: readonly Readonly<Record<number, number>>[] = [
  {},
  { [PAL.stone4]: PAL.fire1, [PAL.stone3]: PAL.fire1, [PAL.stone2]: PAL.fire1, [PAL.stone1]: PAL.fire0 },
  { [PAL.stone4]: PAL.fire3, [PAL.stone3]: PAL.fire3, [PAL.stone2]: PAL.fire3, [PAL.stone1]: PAL.fire2, [PAL.stone0]: PAL.fire1, [PAL.night0]: PAL.fire0 },
  { [PAL.stone4]: PAL.fire4, [PAL.stone3]: PAL.fire4, [PAL.stone2]: PAL.fire4, [PAL.stone1]: PAL.fire3, [PAL.stone0]: PAL.fire2, [PAL.night0]: PAL.fire1 },
];
/** The crust front's row at fx.cool 0 and 1 (frame px): above the vents … under the soles. */
const COOL_TOP = 14;
const COOL_SPAN = 66;
const MOLTEN = new WeakMap<object, Map<number, number>>();

/** The heat level of each part this frame (summon), or undefined when nothing is molten. */
export function moltenLevels(ctx: Ctx): ReadonlyMap<number, number> | undefined {
  return MOLTEN.get(ctx.comp);
}

export function moltenPart(ctx: Ctx): null {
  const fx = ctx.pose.fx;
  if (!(fx.molten > 0)) {
    MOLTEN.delete(ctx.comp);
    return null;
  }
  const p = ctx.dst;
  const id = ctx.comp.id;
  const W = p.w;
  // each part's level from the mean row of what it shows this frame (a block cools as a unit)
  const sum = new Map<number, [number, number]>();
  for (let i = 0; i < id.length; i++) {
    const k = id[i];
    if (!k || !p.isOpaque(i % W, (i / W) | 0)) continue;
    const s = sum.get(k);
    if (s) {
      s[0] += (i / W) | 0;
      s[1]++;
    } else sum.set(k, [(i / W) | 0, 1]);
  }
  const front = COOL_TOP + fx.cool * COOL_SPAN;
  const top = Math.ceil(fx.molten * 3);
  const levels = new Map<number, number>();
  for (const [k, [sy, n]] of sum) {
    const below = sy / n - front;
    levels.set(k, Math.min(top, below < 0 ? 0 : below < 6 ? 1 : below < 14 ? 2 : 3));
  }
  MOLTEN.set(ctx.comp, levels);
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < W; x++) {
      const L = levels.get(id[y * W + x]) ?? 0;
      if (!L) continue;
      const c = p.get(x, y);
      if (c === null) continue;
      const to = MOLTEN_MAP[L][c];
      if (to !== undefined) p.set(x, y, to);
    }
  return null;
}

// ------------------------------------------------------------------ crumble / reassemble (death, revive)

/**
 * Basalt breaking (the material's death pass 'crumble', revive 'reassemble'; A3_MIMARI §5): grooves two
 * steps down (the still's creases: lit → stone0, mid / shadow → night0), a recess one step down, chunks of
 * basalt, its cuts and its cold lava; no lip (a bright lip read as a scratch at 1× on the pilot). The
 * revive's closing cracks carry the lava's light: fire1 → fire2 → fire3.
 */
export const CRUMBLE_BASALT: CrumbleStyle = Object.freeze({
  groove: Object.freeze({ [PAL.stone4]: PAL.stone2, [PAL.stone3]: PAL.stone1, [PAL.stone2]: PAL.stone0, [PAL.stone1]: PAL.night0, [PAL.stone0]: PAL.night0 }),
  chunk: new Set<number>([PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4, PAL.night0, PAL.fire0, PAL.fire1]),
  recess: Object.freeze({ [PAL.stone4]: PAL.stone2, [PAL.stone3]: PAL.stone1, [PAL.stone2]: PAL.stone1, [PAL.stone1]: PAL.stone0, [PAL.stone0]: PAL.night0 }),
  glow: Object.freeze([PAL.fire1, PAL.fire2, PAL.fire3]),
});
/** Basalt breaks in big plates along a few long fractures (the still: plates ≥ 6 px split by creases). */
const BASALT_CRACKS = { cell: 10, density: 0.3, crackWidth: 0.9 } as const;
const DEBRIS = new WeakMap<PixelCanvas, Debris>();

/** Rest-space coordinates of a frame pixel of part `id` (the part's own whole-pixel displacement undone). */
function restOfParts(ctx: Ctx): (part: number, x: number, y: number) => V | null {
  const pl = placesOf(ctx.rig, ctx.pose.fx) as Record<string, V>;
  const handN: V = [rnd(ctx.rig.armN.end[0] - REST_RIG.armN.end[0]), rnd(ctx.rig.armN.end[1] - REST_RIG.armN.end[1])];
  const handF: V = [rnd(ctx.rig.armF.end[0] - REST_RIG.armF.end[0]), rnd(ctx.rig.armF.end[1] - REST_RIG.armF.end[1])];
  const memo = new Map<number, V | null>();
  const dOf = (part: number): V | null => {
    if (memo.has(part)) return memo.get(part)!;
    const n = partName(part);
    const d = n.length === 2 && n[0] === 'p' ? (pl[n[1]] ?? null) : n === 'armN' ? handN : n === 'armF' ? handF : null;
    memo.set(part, d);
    return d;
  };
  return (part, x, y) => {
    const d = dOf(part);
    return d ? [x - d[0], y - d[1]] : null;
  };
}

export function crumblePart(ctx: Ctx): null {
  const pass = ctx.pose.pass ?? {};
  const dying = (pass.crumble ?? 0) > 0;
  const rising = pass.reassemble !== undefined && pass.reassemble < 1;
  if (!dying && !rising) {
    DEBRIS.delete(ctx.dst);
    return null;
  }
  retoneLava(ctx);
  const common = {
    restOf: restOfParts(ctx),
    light: ctx.light,
    style: CRUMBLE_BASALT,
    floorY: ctx.rig.ground - 1,
    centreX: rnd(ctx.rig.pelvis[0]),
    origin: [CORE_AT[0], CORE_AT[1]] as V,
    minChunk: 3,
    chunk: 3,
    spread: 70,
    ...BASALT_CRACKS,
  };
  // the revive's cracks glow only once the light has come back to them (the core relights first)
  const debris = dying
    ? crumblePass(ctx.comp, { ...common, t: pass.crumble })
    : reassemblePass(ctx.comp, { ...common, t: pass.reassemble!, glow: Math.max(0, Math.min(1, ctx.pose.fx.lit * 1.1)) });
  DEBRIS.set(ctx.dst, debris);
  return null;
}

export function debrisPart(ctx: Ctx): null {
  const d = DEBRIS.get(ctx.dst);
  if (d) drawDebris(ctx.dst, d, { floorY: ctx.rig.ground - 1, comp: ctx.comp });
  DEBRIS.delete(ctx.dst);
  return null;
}

// ------------------------------------------------------------------ the floor (summon)

/** The crack in the floor under the feet: a jagged 2:1 vein across the tile (frame px), with two forks. */
const FISSURE: readonly (readonly V[])[] = [
  [[12, 76], [16, 76], [17, 75], [22, 75], [23, 74], [27, 74], [28, 75], [33, 75], [34, 74], [39, 74], [40, 75], [45, 75], [46, 74], [51, 74], [52, 75], [57, 75], [58, 74], [63, 74], [64, 75], [67, 75]],
  [[27, 74], [26, 73], [24, 73], [23, 72]],
  [[52, 75], [54, 76], [56, 76], [57, 77]],
];
const fissurePx = (() => {
  const out: V[] = [];
  const seen = new Set<number>();
  for (const path of FISSURE)
    for (let k = 1; k < path.length; k++) {
      const [x0, y0] = path[k - 1];
      const [x1, y1] = path[k];
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let s = 0; s <= n; s++) {
        const x = rnd(x0 + ((x1 - x0) * s) / n);
        const y = rnd(y0 + ((y1 - y0) * s) / n);
        if (!seen.has(y * 80 + x)) {
          seen.add(y * 80 + x);
          out.push([x, y]);
        }
      }
    }
  return out;
})();

function floor(p: PixelCanvas, ctx: Ctx): void {
  const fx = ctx.pose.fx;
  if (!(fx.fissure > 0) && !(fx.pool > 0)) return;
  const g = ctx.rig.ground;
  // the drained pool cools back into the crack (pool 1 → 2): its tones step down, then it is gone
  const drain = Math.max(0, Math.min(1, fx.pool - 1));
  const cool = drain > 0.66 ? 2 : drain > 0.33 ? 1 : 0;
  const tone = (t: number) => [PAL.fire0, PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4][Math.max(0, t - cool)];
  // the pool: a 2:1 ellipse around the feet (behind everything drawn), fire2 rim · fire3 · a fire4 crest
  const size = fx.pool > 1 ? 1 - drain : fx.pool;
  if (size > 0.05 && cool < 2) {
    const rx = 4 + size * 17;
    const ry = 1.5 + size * 3.5;
    const cx = 40;
    const cy = g - 3;
    for (let y = Math.floor(cy - ry); y < g + 1; y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const u = (x + 0.5 - cx) / rx;
        const v = (y + 0.5 - cy) / ry;
        const r = u * u + v * v;
        if (r > 1) continue;
        // the crest: the welling magma's hot band across the pool's far half; the rim one step cooler
        setIf(p, x, y, tone(r > 0.7 ? 2 : v < -0.15 && v > -0.6 ? 4 : 3));
      }
  }
  // the crack: a fire2 hairline that splits into a fire3 vein with fire1 lips (above and below)
  if (fx.fissure > 0 && cool < 2) {
    const wide = fx.fissure >= 0.6;
    for (const [x, y] of fissurePx) {
      setIf(p, x, y, tone(wide ? 3 : 2));
      if (wide) {
        setIf(p, x, y - 1, tone(1));
        if (y + 1 <= g) setIf(p, x, y + 1, tone(1));
      }
    }
  }
  // the collar: a sunk body breaks the magma's surface — it laps at it, fire4 over fire3, a pixel wider
  if (ctx.rig.root[1] > g && fx.pool > 0 && fx.pool <= 1) {
    let x0 = Infinity;
    let x1 = -Infinity;
    for (let x = 0; x < p.w; x++)
      if (ctx.comp.owner(x, g - 1) !== 0) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
    if (x0 <= x1)
      for (let x = x0 - 2; x <= x1 + 2; x++) {
        setIf(p, x, g - 1, PAL.fire4, true);
        setIf(p, x, g, PAL.fire3, true);
        if (x >= x0 && x <= x1 && (x - x0) % 5 === 2) setIf(p, x, g - 2, PAL.fire3, true);
      }
  }
}

// ------------------------------------------------------------------ splash (hitHeavy, death)

/** Six drops out of the chest / shoulder seams (rest frame px, the part they leave) and their throw (px). */
const DROPS: readonly { at: V; part: 'C' | 'B' | 'b'; v: V }[] = [
  { at: [27, 39], part: 'C', v: [-6, -8] },
  { at: [45, 42], part: 'C', v: [5, -9] },
  { at: [52, 41], part: 'C', v: [10, -5] },
  { at: [40, 46], part: 'C', v: [3, -4] },
  { at: [20, 25], part: 'B', v: [-7, -5] },
  { at: [51, 26], part: 'b', v: [8, -6] },
];

function splash(p: PixelCanvas, ctx: Ctx): void {
  const fx = ctx.pose.fx;
  const ph = fx.splash;
  if (!(ph > 0) || ph >= 1) return;
  const pl = placesOf(ctx.rig, fx);
  const tone = ph < 0.3 ? PAL.fire4 : ph < 0.55 ? PAL.fire3 : ph < 0.8 ? PAL.fire2 : PAL.stone1;
  for (const d of DROPS) {
    const o = pl[d.part];
    const x = rnd(d.at[0] + o[0] + d.v[0] * ph);
    const y = rnd(d.at[1] + o[1] + d.v[1] * ph + 16 * ph * ph);
    if (y >= ctx.rig.ground - 1) continue;
    const over = ph < 0.35;
    setIf(p, x, y, tone, over);
    // a fresh drop trails a fire2 tail back toward the seam (the pixel it came through)
    if (ph < 0.45) {
      const tx = rnd(d.at[0] + o[0] + d.v[0] * (ph - 0.12));
      const ty = rnd(d.at[1] + o[1] + d.v[1] * (ph - 0.12) + 16 * (ph - 0.12) * (ph - 0.12));
      if ((tx !== x || ty !== y) && Math.abs(tx - x) + Math.abs(ty - y) === 1) setIf(p, tx, ty, PAL.fire2, over);
    }
  }
}

// ------------------------------------------------------------------ the fireball (special)

/** The core point this frame (frame px, unrounded): the pool's heart where the chest plate puts it. */
export function coreAt(ctx: Ctx): V {
  const d = placesOf(ctx.rig, ctx.pose.fx).C;
  return [CORE_AT[0] + d[0], CORE_AT[1] + d[1]];
}

function ball(p: PixelCanvas, ctx: Ctx): void {
  const fx = ctx.pose.fx;
  const r = fx.ball;
  if (!(r > 0)) return;
  const [cx, cy] = coreAt(ctx);
  const hot = fx.core >= 2.3;
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > r + 0.25) continue;
      const k = d / Math.max(0.5, r);
      setIf(p, x, y, k < 0.34 ? (hot && r >= 2.5 ? PAL.white : PAL.gold4) : k < 0.7 ? PAL.fire4 : PAL.fire3, true);
    }
  // three fire2 tongues lick up off its top (heights by frame: three silhouettes a loop)
  if (r >= 1.5) {
    const H: readonly (readonly number[])[] = [[1, 2, 1], [2, 1, 2], [1, 3, 1]];
    const h = H[ctx.frame % 3];
    [-1, 0, 1].forEach((s, i) => {
      const x = rnd(cx - 0.5 + s * Math.max(1, rnd(r * 0.55)));
      const top = rnd(cy - 0.5 - Math.sqrt(Math.max(0, r * r - (s * r * 0.55) ** 2)));
      for (let j = 1; j <= h[i] && r >= 2.5; j++) setIf(p, x, top - j, j === 1 ? PAL.fire3 : PAL.fire2, true);
      if (r < 2.5) setIf(p, x, top - 1, PAL.fire2, true);
    });
  }
}

/** Six sparks pulled in along fixed rays while the fireball forms (fx.gather 0 → 1: from 15 px out to its rim). */
const RAYS: readonly V[] = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [-1, 0]];
function gather(p: PixelCanvas, ctx: Ctx): void {
  const fx = ctx.pose.fx;
  const ph = fx.gather;
  if (!(ph > 0) || ph >= 1) return;
  const [cx, cy] = coreAt(ctx);
  const dist = Math.max(fx.ball + 2, 4) + (1 - ph) * 12;
  RAYS.forEach(([ux, uy], i) => {
    const l = Math.hypot(ux, uy);
    const r = dist + (i % 2) * 2;
    const x = Math.floor(cx + (ux / l) * r);
    const y = Math.floor(cy + (uy / l) * r);
    setIf(p, x, y, ph > 0.6 ? PAL.gold4 : PAL.fire4, true);
    // its streak: the pixel behind it on the ray (outward), axis rays only (a diagonal pair reads as two specks)
    if (ux === 0 || uy === 0) setIf(p, x + ux, y + uy, PAL.fire3, true);
  });
}

// ------------------------------------------------------------------ ash (death)

const ASH: readonly { at: V; drift: number; h0: number }[] = [
  { at: [30, 58], drift: -2, h0: 0 },
  { at: [44, 60], drift: 2, h0: 0.35 },
  { at: [36, 64], drift: -1, h0: 0.6 },
  { at: [50, 66], drift: 3, h0: 0.15 },
];
function ash(p: PixelCanvas, ctx: Ctx): void {
  const fx = ctx.pose.fx;
  if (!(fx.ash > 0)) return;
  for (const e of ASH) {
    const h = (fx.ash + e.h0) % 1;
    const c = h < 0.3 ? PAL.fire3 : h < 0.65 ? PAL.fire2 : h < 0.9 ? PAL.fire1 : null;
    if (c === null) continue;
    setIf(p, rnd(e.at[0] + e.drift * h), rnd(e.at[1] - h * 14), c);
  }
}

/** The extras' light, after the outline: the floor (behind), then what flies in front. */
export function extrasLight(ctx: Ctx): null {
  const p = ctx.dst;
  splash(p, ctx);
  ash(p, ctx);
  gather(p, ctx);
  ball(p, ctx);
  floor(p, ctx);
  return null;
}
