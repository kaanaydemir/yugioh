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
import { REST_RIG, SEAM_REACH, fistAt, partName, placesOf, retoneLava, type Ctx } from './magma_titan-parts';

const rnd = Math.round;
const inFrame = (p: PixelCanvas, x: number, y: number) => x >= 2 && x < p.w - 2 && y >= 2 && y < p.h - 2;
const setIf = (p: PixelCanvas, x: number, y: number, c: number, over = false) => {
  if (inFrame(p, x, y) && (over || !p.isOpaque(x, y))) p.set(x, y, c);
};

// ------------------------------------------------------------------ molten (summon)

/** Basalt tone → its molten tone, by heat level 3 (molten) / 2 (hot) / 1 (red crust). */
// molten: lit fire3 · mid fire2 · shadow fire1 · cuts fire0, the glass edges fire4 (the seams burn fire4 over
// it); hot: one step down; the red crust: only the lit plane still glows (fire1, its glass fire2), the mid
// and shadow planes are basalt already
const MOLTEN_MAP: readonly Readonly<Record<number, number>>[] = [
  {},
  { [PAL.stone4]: PAL.fire2, [PAL.stone3]: PAL.fire2, [PAL.stone2]: PAL.fire1 },
  { [PAL.stone4]: PAL.fire3, [PAL.stone3]: PAL.fire3, [PAL.stone2]: PAL.fire2, [PAL.stone1]: PAL.fire1, [PAL.stone0]: PAL.fire0, [PAL.night0]: PAL.night0 },
  { [PAL.stone4]: PAL.fire4, [PAL.stone3]: PAL.fire4, [PAL.stone2]: PAL.fire3, [PAL.stone1]: PAL.fire2, [PAL.stone0]: PAL.fire1, [PAL.night0]: PAL.fire0 },
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
const BASALT_CRACKS = { cell: 10, density: 0.45, crackWidth: 1.1, fallFrom: 0.2, fallShare: 0.65 } as const;
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
    minChunk: 4,
    chunk: 4,
    spread: 60,
    ...BASALT_CRACKS,
  };
  // the revive's closing fractures stay dark basalt grooves: the light that comes back is the titan's OWN
  // seams filling out from the relit core (fx.lit — the still's broken 2:1 stairs, radiating from the core and
  // cooling toward the light's front), not a lit cell network (its straight runs meeting at right angles
  // read as masonry)
  const debris = dying ? crumblePass(ctx.comp, { ...common, t: pass.crumble }) : reassemblePass(ctx.comp, { ...common, t: pass.reassemble!, glow: 0 });
  // the closing cracks carry the light only inside its radius (it fills out from the relit core): past it they
  // close dark (the lava there is re-toned cold by the glow slot anyway) — on the body and on the chunks flying
  // back (a chunk keeps the crack pixels it broke with; it is judged where it belongs, at its notch)
  if (rising && ctx.pose.fx.lit < 1) {
    const [cx, cy] = coreAt(ctx);
    const R = ctx.pose.fx.lit * SEAM_REACH;
    const lit = (c: number | null) => c === PAL.fire1 || c === PAL.fire2 || c === PAL.fire3;
    const far = (x: number, y: number) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > R;
    const p = ctx.dst;
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < p.w; x++) if (lit(p.get(x, y)) && far(x, y)) p.set(x, y, PAL.night0);
    DEBRIS.set(ctx.dst, {
      chunks: debris.chunks.map((ch) => {
        if (!ch.px.some((v, k) => k % 3 === 2 && lit(v))) return ch;
        const px = ch.px.slice();
        for (let k = 0; k < px.length; k += 3) if (lit(px[k + 2]) && far(px[k], px[k + 1])) px[k + 2] = PAL.night0;
        return { ...ch, px };
      }),
    });
    return null;
  }
  DEBRIS.set(ctx.dst, debris);
  return null;
}

export function debrisPart(ctx: Ctx): null {
  const d = DEBRIS.get(ctx.dst);
  if (d) {
    const p = ctx.dst;
    const was = new Uint8Array(p.w * p.h);
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) was[y * p.w + x] = p.isOpaque(x, y) ? 1 : 0;
    drawDebris(p, d, { floorY: ctx.rig.ground - 1, comp: ctx.comp });
    // matter is outlined: a chip off the body on the open background (flying, or landed on the floor) gets
    // the body's 1-px ink contour on its background side (an unoutlined chip read as a grey smudge at 1×)
    const added: V[] = [];
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (!was[y * p.w + x] && p.isOpaque(x, y)) added.push([x, y]);
    for (const [x, y] of added)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (inFrame(p, nx, ny) && ny <= ctx.rig.ground && !p.isOpaque(nx, ny)) p.set(nx, ny, PAL.ink);
      }
  }
  DEBRIS.delete(ctx.dst);
  return null;
}

// ------------------------------------------------------------------ the floor (summon)

/**
 * The crack in the floor under the feet (frame px): the floor's own iso grain — 2:1 stair segments of uneven
 * lengths with flats and 1-px jogs between them (never a square wave of flat runs) — with two forks.
 */
const FISSURE: readonly (readonly V[])[] = [
  [[11, 76], [15, 74], [18, 74], [22, 76], [23, 75], [29, 72], [31, 72], [37, 75], [41, 75], [47, 72], [48, 73], [52, 75], [56, 73], [60, 73], [64, 75], [68, 73]],
  [[29, 72], [25, 70], [23, 70]],
  [[52, 75], [56, 77], [58, 77]],
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

/** Cooled crust floating on the pool: [u, v] in pool space (−1…1) and its half length px (a fire1 skin, a fire0 heart). */
const CRUST: readonly (readonly [u: number, v: number, half: number])[] = [
  [-0.62, 0.15, 2],
  [0.5, -0.25, 3],
  [0.12, 0.45, 1],
  [-0.2, -0.5, 2],
  [0.8, 0.3, 1],
];

function floor(p: PixelCanvas, ctx: Ctx): void {
  const fx = ctx.pose.fx;
  if (!(fx.fissure > 0) && !(fx.pool > 0)) return;
  const g = ctx.rig.ground;
  // the drained pool cools back into the crack (pool 1 → 2): its tones step down, then it is gone
  const drain = Math.max(0, Math.min(1, fx.pool - 1));
  const cool = drain > 0.66 ? 2 : drain > 0.33 ? 1 : 0;
  const tone = (t: number) => [PAL.fire0, PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4][Math.max(0, t - cool)];
  // the pool: a flattened ellipse round the feet (behind everything drawn) — a fire3 rim, a fire2 body with
  // cooled crust floating on it (fire1 skins, fire0 hearts); the only bright line is where the body breaks
  // its surface (the collar below)
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
        let t = r > 0.72 ? 3 : 2;
        for (const [cu, cv, half] of CRUST) {
          const du = Math.round((u - cu) * rx);
          if (Math.round((v - cv) * ry) === 0 && Math.abs(du) <= Math.round(half * Math.max(0.5, size))) t = du === 0 ? 0 : 1;
        }
        setIf(p, x, y, tone(t));
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
  // the collar: a sunk body breaks the magma's surface — its waterline is the front of an ellipse round it (in
  // the floor's 2:1, rising up its sides), fire4, with the body under it in the magma (fire3) and laps above it
  if (ctx.rig.root[1] > g && fx.pool > 0 && fx.pool <= 1) {
    let x0 = Infinity;
    let x1 = -Infinity;
    for (let x = 0; x < p.w; x++)
      if (ctx.comp.owner(x, g - 1) !== 0) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
    if (x0 <= x1) {
      const bx = (x0 + x1 + 1) / 2;
      const hw = (x1 - x0 + 1) / 2 + 2;
      for (let x = x0 - 2; x <= x1 + 2; x++) {
        // a parabola (the ellipse's front seen from above): the curve spread over the whole width, 4 px up
        // at the sides — never a ruler-straight bar under the body
        const u = Math.min(1, Math.abs(x + 0.5 - bx) / hw);
        const ya = g - 1 - Math.round(4 * u * u);
        for (let y = ya + 1; y <= g; y++) setIf(p, x, y, y === ya + 1 ? PAL.fire3 : PAL.fire2, true);
        setIf(p, x, ya, PAL.fire4, true);
        if ((x - x0) % 5 === 2) setIf(p, x, ya - 1, PAL.fire3, true);
      }
    }
  }
}

// ------------------------------------------------------------------ splash (hitHeavy, death)

/** Eight drops out of the struck seams (rest frame px, the part they leave) and their throw (px over the splash). */
const DROPS: readonly { at: V; part: 'C' | 'B' | 'b' | 'P'; v: V }[] = [
  { at: [26, 39], part: 'C', v: [-14, -16] },
  { at: [46, 43], part: 'C', v: [9, -20] },
  { at: [53, 42], part: 'C', v: [20, -12] },
  { at: [41, 47], part: 'C', v: [12, -6] },
  { at: [33, 43], part: 'C', v: [-7, -19] },
  { at: [55, 46], part: 'C', v: [22, -4] },
  { at: [21, 24], part: 'B', v: [-12, -10] },
  { at: [50, 25], part: 'b', v: [14, -13] },
];

function splash(p: PixelCanvas, ctx: Ctx): void {
  const fx = ctx.pose.fx;
  const ph = fx.splash;
  if (!(ph > 0) || ph >= 1) return;
  const pl = placesOf(ctx.rig, fx);
  // light thrown out of the seams: over the body too while it flies; it cools as it falls (a stone1 bead)
  const tone = ph < 0.3 ? PAL.fire4 : ph < 0.55 ? PAL.fire3 : ph < 0.8 ? PAL.fire2 : PAL.stone1;
  const at = (d: (typeof DROPS)[number], t: number): V => {
    const o = pl[d.part];
    return [rnd(d.at[0] + o[0] + d.v[0] * t), rnd(d.at[1] + o[1] + d.v[1] * t + 26 * t * t)];
  };
  for (const d of DROPS) {
    const [x, y] = at(d, ph);
    if (y >= ctx.rig.ground - 1) continue;
    const over = ph < 0.8;
    setIf(p, x, y, tone, over);
    // its tail: the pixel it came through (4-connected to the drop), hot while it flies fast
    if (ph < 0.65) {
      const [tx, ty] = at(d, ph - 0.06);
      const dx = Math.sign(tx - x);
      const dy = Math.sign(ty - y);
      const tail: V = Math.abs(tx - x) >= Math.abs(ty - y) ? [x + dx, y] : [x, y + dy];
      if (tail[0] !== x || tail[1] !== y) setIf(p, tail[0], tail[1], ph < 0.35 ? PAL.fire3 : PAL.fire2, over);
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
  launchTrail(p, ctx);
  const r = fx.ball;
  if (!(r > 0)) return;
  const [cx0, cy] = coreAt(ctx);
  const cx = cx0 + fx.ballX;
  // drawn like the core (the still's lava language), never a concentric glow: toward the key light (P1 the
  // frame's top-left, P2 its top-right) a fire4 heart, a fire3 body, a fire2 skin only on its shadow side;
  // a 1-px gold4 spark in the heart — white only as ONE 2×2 on the swing out, the frame before it leaves
  const L: V = ctx.light.from === 'right' ? [0.6, -0.8] : [-0.6, -0.8];
  const hc: V = [cx + L[0] * 0.35 * r, cy + L[1] * 0.35 * r];
  const white = fx.core >= 2.3 && fx.ballX >= 5 && r >= 3;
  const wx = Math.floor(hc[0] - 0.5);
  const wy = Math.floor(hc[1] - 0.5);
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const ox = x + 0.5 - cx;
      const oy = y + 0.5 - cy;
      const d = Math.hypot(ox, oy);
      if (d > r + 0.25) continue;
      const lit = (ox * L[0] + oy * L[1]) / Math.max(0.5, r);
      const dh = Math.hypot(x + 0.5 - hc[0], y + 0.5 - hc[1]) / Math.max(0.5, r);
      let tone: number;
      if (r < 3) tone = dh < 0.3 ? PAL.gold4 : dh < 0.75 ? PAL.fire4 : PAL.fire3;
      else if (white && (x === wx || x === wx + 1) && (y === wy || y === wy + 1)) tone = PAL.white;
      else if (d > r - 1.1) tone = lit < -0.15 ? PAL.fire2 : PAL.fire3;
      else if (!white && dh < 0.16) tone = PAL.gold4;
      else tone = dh < 0.45 ? PAL.fire4 : PAL.fire3;
      setIf(p, x, y, tone, true);
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

/** The release frame's trail (fx.launch): the ball's streak from the chest to where it left (fx.ballX px out). */
function launchTrail(p: PixelCanvas, ctx: Ctx): void {
  const fx = ctx.pose.fx;
  if (!(fx.launch > 0) || fx.ballX < 4) return;
  const [cx, cy] = coreAt(ctx);
  const x0 = Math.round(cx + 2);
  const x1 = Math.round(cx + fx.ballX);
  const y = Math.round(cy - 0.5);
  for (let x = x0; x <= x1; x++) {
    const k = (x - x0) / Math.max(1, x1 - x0);
    setIf(p, x, y, k > 0.55 ? PAL.fire4 : PAL.fire3, true);
    if (k > 0.3) setIf(p, x, y - 1, k > 0.75 ? PAL.fire4 : PAL.fire2, true);
    if (k > 0.6) setIf(p, x, y + 1, PAL.fire3, true);
  }
}

/** Six sparks pulled in along fixed rays while the fireball forms (fx.gather 0 → 1: from 15 px out to its rim). */
const RAYS: readonly V[] = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [-1, 0]];
function gather(p: PixelCanvas, ctx: Ctx): void {
  const fx = ctx.pose.fx;
  const ph = fx.gather;
  if (!(ph > 0) || ph >= 1) return;
  const [cx0, cy] = coreAt(ctx);
  const cx = cx0 + fx.ballX;
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
  { at: [30, 48], drift: -2, h0: 0 },
  { at: [44, 47], drift: 2, h0: 0.35 },
  { at: [37, 52], drift: -1, h0: 0.6 },
  { at: [52, 54], drift: 3, h0: 0.15 },
];
function ash(p: PixelCanvas, ctx: Ctx): void {
  const fx = ctx.pose.fx;
  if (!(fx.ash > 0)) return;
  for (const e of ASH) {
    const h = (fx.ash + e.h0) % 1;
    const c = h < 0.3 ? PAL.fire3 : h < 0.65 ? PAL.fire2 : h < 0.9 ? PAL.fire1 : null;
    if (c === null) continue;
    setIf(p, rnd(e.at[0] + e.drift * h), rnd(e.at[1] - h * 16), c, true);
  }
}

// ------------------------------------------------------------------ clash (victory)

/** Eight sparks off the igniting knuckles (fx.clash = phase): thrown out radially, falling and cooling. */
const CLASH: readonly V[] = [[-5, -7], [0, -9], [5, -7], [8, -2], [-8, -2], [-4, 3], [4, 3], [2, -11]];
function clash(p: PixelCanvas, ctx: Ctx): void {
  const fx = ctx.pose.fx;
  const ph = fx.clash;
  if (!(ph > 0) || ph >= 1) return;
  // off the hotter fist's knuckles (both fists posed and hot: between them)
  const n = fistAt(ctx.rig, fx, 'N');
  const f = fistAt(ctx.rig, fx, 'F');
  const both = n.posed && f.posed && fx.heatN > 0.5 && fx.heatF > 0.5;
  const k = both ? [(n.knuckles[0] + f.knuckles[0]) / 2, (n.knuckles[1] + f.knuckles[1]) / 2] : fx.heatF > fx.heatN ? f.knuckles : n.knuckles;
  const ox = k[0];
  const oy = k[1];
  const tone = ph < 0.3 ? PAL.gold4 : ph < 0.55 ? PAL.fire4 : ph < 0.8 ? PAL.fire3 : PAL.fire2;
  for (const [vx, vy] of CLASH) {
    const x = rnd(ox + vx * ph * 1.3);
    const y = rnd(oy + vy * ph * 1.3 + 9 * ph * ph);
    if (y < ctx.rig.ground - 1) setIf(p, x, y, tone, ph < 0.3);
  }
}

/** The extras' light, after the outline: the floor (behind), then what flies in front. */
export function extrasLight(ctx: Ctx): null {
  const p = ctx.dst;
  splash(p, ctx);
  clash(p, ctx);
  ash(p, ctx);
  gather(p, ctx);
  ball(p, ctx);
  floor(p, ctx);
  return null;
}
