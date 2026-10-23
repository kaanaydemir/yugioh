// Taş Muhafız v3 (A3 pilot, Y8) — the MATTER and LIGHT the anims throw around: the boulder torn out
// of the floor (a hand map, the near hand's prop), the dig's crack and crater, dirt clods, low dust,
// stone chips, the roar's rock spikes and rune sparks.
//
// Every effect is a pure function of the frame's pose (its fx channels and props): no randomness, no
// state between frames (A3_MIMARI §3.3). Matter keeps the material's rules: earth ramp for the boulder
// and the dirt, stone ramp for chips and spikes, value planes by pixel counts, a 1-px lit edge only
// on light-facing sides (P1 lit from the top-left; P2 drawn lit from the right and shown flipped).
//   boulder   propN slot (outlined with the body); in the floor it is clipped at the hole's near lip
//   spikes    front slot (outlined: solid rock)
//   floor     fx slot, after the outline: the crack and the crater only where the frame is still
//             empty (they lie on the floor behind the body), the hole's near lip over the boulder
//             (it sits in the hole), clods, dust, chips and sparks over everything

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { V } from '../rigkit/geom';
import { DIG, OX, OY } from './stone_sentinel-build';
import type { Ctx, Part } from './stone_sentinel-parts';


// ------------------------------------------------------------------ the boulder (13 × 11)

const BKEY: Readonly<Record<string, number>> = Object.freeze({
  '0': PAL.earth0,
  '1': PAL.earth1,
  '2': PAL.earth2,
  '3': PAL.earth3,
  '4': PAL.earth4,
  f: PAL.leaf1,
  g: PAL.leaf2,
  h: PAL.leaf3,
});

/**
 * Lit from the top-left: a flat lit top (earth3, earth4 only on its top-left rim) with a moss tuft,
 * the front-left face mid (earth2) with one crack, the right face and the dirt-caked underside dark
 * (earth1, earth0 at the bottom corners). The P2 map is its mirror: a rock has no handedness, so the
 * flipped P2 sprite shows the same rock lit from the screen's top-left.
 */
const BOULDER_P1: readonly string[] = [
  '..4ghg3......',
  '.43fgf332....',
  '43333333221..',
  '333333222111.',
  '3222222111111',
  '3220222111110',
  '322012111111.',
  '22022111111..',
  '.1211111110..',
  '.011111100...',
  '..0001000....',
];
const BOULDER_P2: readonly string[] = BOULDER_P1.map((r) => [...r].reverse().join(''));
/** The boulder's centre in its map (the rock prop's point). */
export const BOULDER_C: V = [6, 5];
export const BOULDER_W = 13;
export const BOULDER_H = 11;

/** v1 px → frame px. */
const f1 = (x: number, y: number): V => [x + OX, y + OY];

/** The dig spot in the frame (the centre of the hole). */
export const DIG_AT: V = f1(DIG[0], DIG[1]);
/** The hole's near lip row (frame px): a boulder in the floor shows only above it. */
export const LIP_Y = DIG_AT[1] + 1;

/** The rock's centre this frame (whole px), or null when it is not shown. */
export function rockAt(ctx: { rig: Ctx['rig'] }): V | null {
  const r = ctx.rig.props.rock;
  if (!r || r.show <= 0) return null;
  return [Math.round(r.at[0]), Math.round(r.at[1])];
}

function stampRock(q: PixelCanvas, rows: readonly string[], c: V, clipY: number, tone?: (ch: string) => number | null): void {
  const x0 = c[0] - BOULDER_C[0];
  const y0 = c[1] - BOULDER_C[1];
  for (let j = 0; j < rows.length; j++) {
    const y = y0 + j;
    if (y > clipY) break;
    for (let i = 0; i < rows[j].length; i++) {
      const ch = rows[j][i];
      if (ch === '.') continue;
      const col = tone ? tone(ch) : BKEY[ch];
      if (col !== null && col !== undefined) q.set(x0 + i, y, col);
    }
  }
}

function boulder(ctx: Ctx): PixelCanvas | null {
  const c = rockAt(ctx);
  if (!c) return null;
  const q = ctx.canvas();
  const rows = ctx.light.from === 'right' ? BOULDER_P2 : BOULDER_P1;
  const inFloor = ctx.rig.props.rock!.hand === null;
  const clip = inFloor ? LIP_Y : Infinity;
  // HA-12: on the release frame the rock drags a 2-px smear behind it (toward where it was), in its
  // own shadow tones, outlined with the body
  const prev = ctx.smearRig?.props.rock;
  if (prev && prev.show > 0) {
    const dx = c[0] - prev.at[0];
    const dy = c[1] - prev.at[1];
    const L = Math.hypot(dx, dy);
    if (L > 0.5)
      for (const k of [2, 1]) {
        const s: V = [c[0] - Math.round((dx / L) * k), c[1] - Math.round((dy / L) * k)];
        stampRock(q, rows, s, clip, (ch) => (ch === '0' || ch === '1' ? PAL.earth1 : k === 2 ? PAL.earth1 : PAL.earth2));
      }
  }
  stampRock(q, rows, c, clip);
  return q;
}

const RAMPS_EARTH = [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4] as const;
const RAMPS_LEAF = [PAL.leaf0, PAL.leaf1, PAL.leaf2, PAL.leaf3, PAL.leaf4] as const;
/** The rock's ramps by map letter (BKEY's tones): the earth ramp for the stone, the leaf ramp for its moss tuft. */
const BOULDER_RAMP: Readonly<Record<string, readonly [ramp: readonly number[], step: number]>> = Object.freeze({
  '0': [RAMPS_EARTH, 0],
  '1': [RAMPS_EARTH, 1],
  '2': [RAMPS_EARTH, 2],
  '3': [RAMPS_EARTH, 3],
  '4': [RAMPS_EARTH, 4],
  f: [RAMPS_LEAF, 1],
  g: [RAMPS_LEAF, 2],
  h: [RAMPS_LEAF, 3],
});
/** The key light (screen top-left) the thrown rock keeps on every turn. */
const ROCK_LIGHT: V = ((x: number, y: number): V => [x / Math.hypot(x, y), y / Math.hypot(x, y)])(-1, -1.15);
/** How many ramp steps a rim pixel moves per unit of facing turned toward / away from the light. */
const RELIGHT = 2.2;

/** The rock as the near hand carries it (`boulder`'s stamp, unclipped, no smear) with the ink edge the body's outline gives it. */
export function heldBoulder(): PixelCanvas {
  const q = new PixelCanvas(BOULDER_W + 2, BOULDER_H + 2);
  stampRock(q, BOULDER_P1, [BOULDER_C[0] + 1, BOULDER_C[1] + 1], Infinity);
  return q.outline(PAL.ink);
}

/**
 * The boulder as a drawing of its own: the rock the attack frames carry in the near hand — the SAME map
 * and tones `boulder` stamps (BOULDER_P1: on screen both sides show it, P2's map being its mirror shown
 * flipped) with the edge the body's outline pass gives it there (1-px ink, 4-connected) — turned `turn`
 * of `turns` steps of a clockwise revolution (the throw's spin). The shape and its features turn (the
 * moss tuft goes round, the crack with it); the light does not: every pixel is re-lit from the screen's
 * top-left, stepped up or down its ramp by how far its outward facing (from the rock's centre, a rim
 * pixel the most, the faces in the middle the least) turned toward or away from the light; the crack
 * stays a crease. Turn 0 is the held rock exactly. Whole pixels only, never scaled: a quarter turn maps
 * pixels onto pixels, an eighth takes each pixel's letter from the majority of its 4 × 4 sub-samples
 * (clean edges, whole tone patches). The recipe throw flies it (src/cinematics/recipe/projectiles/boulder.ts).
 */
export function boulderTurn(turn: number, turns = 8): PixelCanvas {
  const rows = BOULDER_P1;
  const S = 17; // a 13 × 11 rock turned 45° fits in 15 × 15
  const q = new PixelCanvas(S + 2, S + 2);
  const a = ((((Math.round(turn) % turns) + turns) % turns) / turns) * Math.PI * 2;
  const [cs, sn] = [Math.cos(a), Math.sin(a)];
  const at = (i: number, j: number) => rows[j]?.[i] ?? '.';
  // the crack: an earth0 pixel inside the rock (all four neighbours rock) stays a crease whatever its turn
  const crease = (i: number, j: number) => at(i, j) === '0' && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([u, v]) => at(i + u, j + v) !== '.');
  // target → source by the inverse turn, about the rock's centre pixel (BOULDER_C)
  const src = (x: number, y: number): V => {
    const dx = x - (S + 2) / 2;
    const dy = y - (S + 2) / 2;
    return [cs * dx + sn * dy + BOULDER_C[0] + 0.5, -sn * dx + cs * dy + BOULDER_C[1] + 0.5];
  };
  const lit = (n: V) => n[0] * ROCK_LIGHT[0] + n[1] * ROCK_LIGHT[1];
  const R = 6;
  const SUB = 4;
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      // the letter most of the pixel's 4 × 4 sub-samples land on (rock if at least half of them do; a
      // crease if 7 of 16 fall on the crack, so a turned crack stays one pixel wide)
      const votes = new Map<string, number>();
      let rock = 0;
      let creases = 0;
      for (let v = 0; v < SUB; v++)
        for (let u = 0; u < SUB; u++) {
          const [sx, sy] = src(x + (u + 0.5) / SUB, y + (v + 0.5) / SUB);
          const i = Math.floor(sx);
          const j = Math.floor(sy);
          const ch = at(i, j);
          if (ch === '.') continue;
          rock++;
          if (crease(i, j)) creases++;
          votes.set(ch, (votes.get(ch) ?? 0) + 1);
        }
      if (rock * 2 < SUB * SUB) continue;
      if (creases * 16 >= SUB * SUB * 7) {
        q.set(x, y, PAL.earth0);
        continue;
      }
      let ch = '';
      let best = -1;
      for (const [c, n] of votes) if (n > best || (n === best && c > ch)) [ch, best] = [c, n];
      const [ramp, step] = BOULDER_RAMP[ch];
      // re-lit from the top-left: the facing of this pixel's place on the rock before and after the turn
      const [ox, oy] = src(x + 0.5, y + 0.5);
      const n0: V = [(ox - BOULDER_C[0] - 0.5) / R, (oy - BOULDER_C[1] - 0.5) / R];
      const n1: V = [cs * n0[0] - sn * n0[1], sn * n0[0] + cs * n0[1]];
      const s = step + Math.round((lit(n1) - lit(n0)) * RELIGHT);
      q.set(x, y, ramp[Math.max(0, Math.min(ramp.length - 1, s))]);
    }
  q.outline(PAL.ink);
  return q;
}

// ------------------------------------------------------------------ floor work: crack, crater

/** Set a pixel only where the frame is still empty (the floor behind the body). */
function behind(p: PixelCanvas, x: number, y: number, c: number): void {
  if (!p.isOpaque(x, y)) p.set(x, y, c);
}

/**
 * The crack the digging hand opens: dark fissures along the floor plane (foreshortened: long to the
 * sides, short in depth), growing with `t` (0…1); their lit lips one row above.
 */
function crack(p: PixelCanvas, t: number, at: V): void {
  const [cx, cy] = at;
  const n = Math.round(2 + 5 * t);
  const arms: readonly [number, number][] = [
    [-1, 0],
    [1, 0],
    [-1, -0.4],
    [1, 0.35],
  ];
  arms.forEach(([dx, dy], a) => {
    const len = a < 2 ? n : Math.round(n * 0.6);
    for (let k = 2; k <= len; k++) {
      const x = cx + Math.round(dx * k);
      const y = cy + Math.round(dy * k + (k % 3 === 0 ? (a % 2 ? 1 : -1) * 0.6 : 0));
      behind(p, x, y, k >= len - 1 ? PAL.earth1 : PAL.earth0);
    }
  });
  // the broken floor heaved up around the hand: two lit chips of floor at the crack's mouth
  if (t >= 0.5) {
    behind(p, cx - 3, cy - 1, PAL.earth3);
    behind(p, cx + 3, cy - 1, PAL.earth2);
  }
}

/**
 * The hole the boulder leaves: an ellipse on the floor (rx 6, ry 2) — the dark pit, its far inner
 * wall (earth1, the face looking at us), the near lip of heaved dirt (lit top earth3, earth2 under)
 * and loose clods on the rim. `c` 0…1 opens it with the tear (the lip grows first); 1…2 settles it:
 * dirt slides back in until the pit is a low mound of loose earth.
 */
function crater(ctx: Ctx, c: number, at: V = DIG_AT, size: V = [6, 2.2], glow = 0): void {
  const p = ctx.dst;
  const [cx, cy] = at;
  const open = Math.min(1, c);
  const settle = Math.max(0, Math.min(1, c - 1));
  const rx = Math.max(1.5, size[0] * open) * (1 - 0.55 * settle);
  const ry = Math.max(1, size[1] * open) * (1 - 0.5 * settle);
  const pit = 1 - settle; // the pit's darkness left
  const owner = (x: number, y: number) => ctx.comp.owner(x, y);
  const rockId = ROCK_ID;
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const u = (x + 0.5 - (cx + 0.5)) / rx;
      const v = (y + 0.5 - (cy + 0.5)) / ry;
      const d = u * u + v * v;
      if (d > 1.0) continue;
      let col: number;
      if (v > 0.35 && d > 0.45) col = v > 0.7 ? PAL.earth2 : PAL.earth3; // the near lip (heaved dirt, lit top)
      else if (v < -0.3) col = pit > 0.5 ? PAL.earth1 : PAL.earth2; // the far inner wall
      else if (glow > 0 && d < 0.55) col = glow > 0.66 && d < 0.25 ? PAL.gold3 : glow > 0.33 ? PAL.gold2 : PAL.gold1; // the summon's light from below
      else col = pit > 0.66 ? PAL.ink : pit > 0.33 ? PAL.earth0 : PAL.earth1; // the pit
      const isLip = v > 0.35 && d > 0.45;
      // the lip lies in front of a boulder sitting in the hole; the rest of the hole is behind everything
      if (isLip && (owner(x, y) === rockId || (p.get(x, y) === PAL.ink && owner(x, y) === 0))) p.set(x, y, col);
      else behind(p, x, y, col);
    }
  // loose clods on the rim (lit tops), fewer as the hole settles
  if (open >= 0.6) {
    const k = size[0] / 6;
    const clods: readonly [number, number, number][] = [
      [-7, 0, PAL.earth2],
      [-6, -1, PAL.earth3],
      [7, 0, PAL.earth1],
      [6, 1, PAL.earth2],
      [-4, 2, PAL.earth2],
    ];
    clods.slice(0, settle > 0.5 ? 2 : 5).forEach(([dx, dy, col]) => behind(p, cx + Math.round(dx * k), cy + dy, col));
  }
}

/** The summon's hole under the body (frame px centre, half-axes): wider than the dig's, the column comes up out of it. */
const PIT_AT: V = f1(30, 60);
const PIT_SIZE: V = [13, 3];

/**
 * The floor broken open round the summon's hole: short fissures running out from its rim along the
 * floor plane (foreshortened), dark with a lit lip, longer as the hole opens (0…1), fading back to
 * hairlines as it closes (1…2).
 */
function pitCracks(p: PixelCanvas, c: number): void {
  const [cx, cy] = PIT_AT;
  const open = Math.min(1, c);
  const settle = Math.max(0, Math.min(1, c - 1));
  const rays: readonly [number, number, number][] = [
    // angle (deg, 0 = +x), length, rim offset
    [180, 6, 0],
    [200, 4, 1],
    [160, 3, 1],
    [0, 6, 0],
    [-20, 4, 1],
    [25, 4, 1],
  ];
  for (const [deg, L, o] of rays) {
    const a = (deg * Math.PI) / 180;
    const len = Math.round(L * open * (1 - 0.6 * settle));
    for (let k = 0; k < len; k++) {
      const r = PIT_SIZE[0] + 1 + o + k;
      const x = cx + Math.round(Math.cos(a) * r);
      const y = cy + Math.round(Math.sin(a) * r * (PIT_SIZE[1] / PIT_SIZE[0]) + (k % 3 === 2 ? 0.5 : 0));
      behind(p, x, y, k >= len - 1 || settle > 0.5 ? PAL.earth1 : PAL.earth0);
      if (settle < 0.5 && k < len - 1) behind(p, x, y - 1, PAL.earth3);
    }
  }
}

// ------------------------------------------------------------------ flying matter

/**
 * The places matter flies from (frame px): 0 the dig, 1 the shield's foot, 2 the shield's face, 3 the
 * near (back) heel, 4 the front foot, 5 the summon's hole (the body's centre on the floor), 6 the
 * chest (the heap's top), 7 the near heel stepped back (hitHeavy).
 */
export const SPOTS: readonly V[] = [DIG_AT, f1(50, 60), f1(48, 42), f1(16, 60), f1(34, 60), PIT_AT, f1(30, 40), f1(14, 60)];

const spotOf = (i: number): V => SPOTS[Math.max(0, Math.min(SPOTS.length - 1, Math.round(i)))];

/** Dirt clods thrown off the dig / the torn boulder: 2-px clods on fixed arcs, phase t (0…1]. */
function dirt(p: PixelCanvas, t: number, from: V): void {
  const arcs: readonly [number, number, number][] = [
    // vx, vy (px over the burst), size
    [-9, -11, 2],
    [-4, -15, 1],
    [5, -12, 2],
    [9, -7, 1],
    [-12, -5, 1],
  ];
  const g = 22; // gravity over the burst (px)
  for (const [vx, vy, s] of arcs) {
    const x = Math.round(from[0] + vx * t);
    const y = Math.round(from[1] - 2 + vy * t + g * t * t);
    if (y > from[1] + 1) continue; // landed
    if (s === 2) {
      p.set(x, y, PAL.earth2).set(x + 1, y, PAL.earth1).set(x, y + 1, PAL.earth1).set(x + 1, y + 1, PAL.earth0);
    } else p.set(x, y, PAL.earth1);
  }
}

/**
 * A low dust puff rolling out along the floor to both sides of `from`: overlapping lobes (lit cap,
 * body, shadow crescent away from the light), growing then thinning with the phase t (0…1]. It thins
 * as solid clumps — the outer lobes go first, the inner ones shrink 3 → 2 rows and end as a 2-px clump
 * on the floor — never a checker of holes, a 1-px tip (no '+' shapes) or a lone pixel on the stone. It
 * stays behind a boulder sitting in the hole (the part-id buffer).
 */
function dust(ctx: Ctx, t: number, from: V): void {
  const p = ctx.dst;
  // the floor's earth, or the body's own stone ground to dust (the crumble)
  const [hi, mid, lo] = ctx.pose.fx.dustTone >= 0.5 ? [PAL.stone3, PAL.stone2, PAL.stone1] : [PAL.earth4, PAL.earth3, PAL.earth2];
  const lightSide = ctx.light.side;
  const grow = Math.min(1, t * 2.2);
  const fade = Math.max(0, (t - 0.45) / 0.55);
  const lobes: readonly [number, number, number][] = [
    [-6, 0, 1.8],
    [-3, -1, 2.2],
    [3, -1, 2],
    [6, 0, 1.6],
  ];
  const put = (x: number, y: number, c: number) => {
    if (y > from[1] + 1 || ctx.comp.owner(x, y) === ROCK_ID) return;
    p.set(x, y, c);
  };
  lobes.forEach(([ox, oy, r0], i) => {
    if ((i === 0 || i === 3) && fade > 0.55) return; // the outer lobes thin away first
    const r = r0 * (0.6 + 0.4 * grow) * (1 - 0.45 * fade);
    const cx = from[0] + 0.5 + ox * (0.7 + 0.6 * grow);
    const cy = from[1] + 0.5 + oy * grow;
    if (r < 1.3) {
      // the last of a lobe: one 2-px clump on the floor (mid + shadow), never a single pixel
      const x = Math.floor(cx - 1);
      const y = Math.min(from[1] + 1, Math.floor(cy));
      put(x, y, mid);
      put(x + 1, y, lo);
      return;
    }
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      const dy = y + 0.5 - cy;
      const hw = Math.sqrt(Math.max(0, r * r - dy * dy));
      if (hw < 1) continue; // no 1-px tips
      const x0 = Math.round(cx - hw);
      const x1 = Math.round(cx + hw) - 1;
      if (x1 - x0 < 1) continue;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const lit = -dx * lightSide - dy; // toward the light (top, light side)
        put(x, y, lit > r * 0.55 ? hi : lit < -r * 0.45 ? lo : mid);
      }
    }
  });
}

/** Stone chips bursting off a struck face: lit 2-px chips and 1-px grit on fixed rays, phase t (0…1]. */
function chips(p: PixelCanvas, t: number, from: V, dir: number, floorY: number): void {
  const rays: readonly [number, number, number][] = [
    [7, -8, 2],
    [10, -2, 2],
    [5, -12, 1],
    [11, 4, 1],
    [3, -5, 1],
  ];
  const g = 14;
  for (const [vx, vy, s] of rays) {
    const x = Math.round(from[0] + dir * vx * t);
    const y = Math.round(from[1] + vy * t + g * t * t);
    if (y > floorY - 1) continue; // on the floor: gone among the rubble
    if (s === 2) p.set(x, y, PAL.stone4).set(x + dir, y, PAL.stone3).set(x, y + 1, PAL.stone2).set(x + dir, y + 1, PAL.stone1);
    else p.set(x, y, PAL.stone3);
  }
}

/** Rune sparks rising off the chest ᛉ (roar): gold motes drifting up and out, dimming with the phase. */
function sparks(p: PixelCanvas, t: number, from: V): void {
  const motes: readonly [number, number, number][] = [
    [-6, -14, 0],
    [4, -18, 0.15],
    [-2, -22, 0.3],
    [8, -11, 0.1],
    [-9, -9, 0.25],
  ];
  for (const [vx, vy, d] of motes) {
    const u = (t - d) / (1 - d);
    if (u <= 0 || u > 1) continue;
    const x = Math.round(from[0] + vx * u);
    const y = Math.round(from[1] + vy * u);
    p.set(x, y, u < 0.45 ? PAL.gold4 : u < 0.8 ? PAL.gold3 : PAL.gold2);
    if (u < 0.3) p.set(x, y + 1, PAL.gold2);
  }
}

// ------------------------------------------------------------------ the roar's rock spikes

/** Rock spikes heaved out of the floor by the shield slam, `h` 0…1 of their height. */
function spikes(ctx: Ctx): PixelCanvas | null {
  const h = ctx.pose.fx.spikes;
  if (!(h > 0)) return null;
  const q = ctx.canvas();
  const g = ctx.rig.ground;
  const lit = ctx.light.side; // −1: lit from the left
  const list: readonly [number, number][] = [
    // x (v1 px), full height
    [55, 10],
    [58, 7],
    [61, 5],
  ];
  for (const [vx, H] of list) {
    const ht = Math.round(H * h);
    if (ht < 2) continue; // a sunk spike is gone (no 1-px sliver)
    const x = vx + OX;
    for (let j = 0; j < ht; j++) {
      const y = g - j;
      const half = Math.max(0, Math.round(((ht - j) / ht) * 2.4 - 0.4));
      for (let i = -half; i <= half; i++) {
        const k = lit < 0 ? i + half : half - i; // px from the lit side
        const col = j === ht - 1 ? PAL.stone4 : k === 0 ? PAL.stone3 : k <= half ? PAL.stone2 : PAL.stone1;
        q.set(x + i, y, col);
      }
    }
  }
  return q;
}

// ------------------------------------------------------------------ the fx pass

let ROCK_ID = -1;
/** planArt's part id of the boulder (1-based in the member's parts order). */
export function setRockId(id: number): void {
  ROCK_ID = id;
}

function floorPass(ctx: Ctx): null {
  const fx = ctx.pose.fx;
  const p = ctx.dst;
  if (fx.crater > 0) crater(ctx, fx.crater);
  if (fx.pit > 0) {
    // the light comes up out of the hole while it is open, and dies as the blocks lock over it
    crater(ctx, fx.pit, PIT_AT, PIT_SIZE, fx.pit <= 1 ? 1 : Math.max(0, 1 - (fx.pit - 1) * 2.5));
    pitCracks(p, fx.pit);
  }
  if (fx.crack > 0) crack(p, fx.crack, spotOf(fx.crackAt));
  if (fx.dirt > 0) dirt(p, fx.dirt, spotOf(fx.dirtAt));
  if (fx.dust > 0) dust(ctx, fx.dust, spotOf(fx.dustAt));
  if (fx.chips > 0) chips(p, fx.chips, spotOf(fx.chipsAt), 1, ctx.rig.ground);
  if (fx.spark > 0) {
    const ch = ctx.rig.chest;
    sparks(p, fx.spark, [Math.round(ch[0]) + 2, Math.round(ch[1]) - 2]);
  }
  return null;
}

export const FX_PARTS: Readonly<Record<string, Part>> = Object.freeze({
  rock: { layer: 'propN', seam: 'none', paint: boulder },
  spikes: { layer: 'front', seam: 'none', paint: spikes },
  floor: { layer: 'fx', seam: 'none', paint: floorPass },
});

