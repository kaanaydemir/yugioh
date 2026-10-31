// Saman Korkuluk v3 — the straw scarecrow token rig: Pose → pixels.
//
// A straw-bundle scarecrow on a wooden stake: a dry pole planted in a little dirt mound, a cross bar for arms with
// an old faded-indigo jacket pulled over it (a red patch on the breast, open at the front where the straw stuffing
// shows), straw fans sticking out of the cuffs, a rope belt and a ragged straw skirt below the hem, a burlap sack
// head tied at the neck with twine, two button eyes and a stitched mouth, a floppy brown felt hat with a red band
// and a straw sprig. A crow (a dark silhouette with a warm eye) lands on the near shoulder now and then.
//
//   - every part is a flat polygon shaded by flat value planes measured from its own edges (lit toward the key
//     light, a shade band away), 1-px ink seams between parts and a 1-px ink outline round the silhouette;
//   - parts move by WHOLE pixels; the stake frame is only turned for the topple (death / revive) — pose geometry
//     re-rasterised each frame, never a rotated sprite;
//   - ONE key light from the frame's top-left ('left' = P1) or top-right ('right' = the P2 relight sheet);
//   - light (button-eye glow, the stake's "tok" flash, flecks of straw in the air, magic sparks) is painted after
//     the outline and never outlined (IŞ-9).
// Frame 68×62; 1 art px = 1 game px; the root (RX, GY) is the foot of the stake on the ground.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { Comp, bands, drawCrow, fleck, hash2, plane, rnd, strand, turn, unturn, type CrowMode, type Pt, type Side } from './straw_decoy_token-kit';

export const W = 68;
export const H = 62;
export const RX = 36;
export const GY = 58;
/** local heights over the foot of the stake */
const BAR = -32;
const HEAD = -42;

export interface Pose {
  /** px the upper body leans at the bar height (+ toward the foe); the stake shears with it */
  lean: number;
  /** stake above the ground (summon fall), px */
  lift: number;
  /** topple (rad, + = falls back to the frame's left about the foot) */
  topple: number;
  /** bar tip offsets (px, + down): far (left) and near (right) */
  aL: number;
  aR: number;
  /** sleeve cuff swing (px, + right) far / near, extra sleeve droop (px) */
  slL: number;
  slR: number;
  droop: number;
  /** straw hands: flutter (px) far / near, curl 0…1 (guard: the fingers fold down), spread 0…1 (fingers flung open) */
  fiL: number;
  fiR: number;
  curl: number;
  spread: number;
  /** head offset (px) and the hat on it (offset, tilt −1…1), hat 1 on / 0 free at (hfx, hfy) rel the root */
  hx: number;
  hy: number;
  hatX: number;
  hatY: number;
  hatTilt: number;
  hat: number;
  hfx: number;
  hfy: number;
  /** eyes 0 dull, 1 glint, 2 lit (summon / magic); look −1…1 (px, + toward the foe); mouth 0 stitch, 1 gape, 2 wince */
  eye: number;
  look: number;
  mouth: number;
  /** skirt tips sway (px), jacket hem flap (px), rope-end sway (px), straw on end 0…1 (hitMagic) */
  skirt: number;
  flap: number;
  rope: number;
  bristle: number;
  /** crow: mode (null none), feet (rel the root), facing, wing phase */
  crow: CrowMode | null;
  cx: number;
  cy: number;
  cf: Side;
  wing: number;
  /** summon pieces: straw wrapped 0…1, jacket on 0…1 and its offset while it flies in, head on 0/1 and its drop */
  wrap: number;
  jk: number;
  jkx: number;
  jky: number;
  hd: number;
  hdy: number;
  /** a free head (fallen off): 1 at (hfx2, hfy2) rel the root */
  hdFree: number;
  hfx2: number;
  hfy2: number;
  /** death: rope undone 0…1, jacket deflated 0…1, straw spilled on the floor 0…1 */
  untie: number;
  deflate: number;
  spill: number;
  /** the ground mound 0…1 (summon) */
  mound: number;
  /** fx: straw flecks in the air (phase 0 none … 1), their direction (−1 back, +1 forward); dust 0…1; magic 0…1;
   *  the stake's planting flash 0…1; fall speed lines 0…1; whole-frame tremble (px); straw smear on release */
  fleck: number;
  fdir: number;
  dust: number;
  zap: number;
  flash: number;
  speed: number;
  shake: number;
  smear: number;
  /** last-150-ms dissolve 0…1 (death) / gather (revive, the same front backwards) */
  diss: number;
  t: number;
}

export const NEUTRAL: Pose = {
  lean: 0, lift: 0, topple: 0, aL: 0, aR: 0, slL: 0, slR: 0, droop: 0, fiL: 0, fiR: 0, curl: 0, spread: 0,
  hx: 0, hy: 0, hatX: 0, hatY: 0, hatTilt: 0, hat: 1, hfx: -10, hfy: 0,
  eye: 1, look: 0, mouth: 0, skirt: 0, flap: 0, rope: 0, bristle: 0,
  crow: null, cx: 0, cy: 0, cf: 1, wing: 0,
  wrap: 1, jk: 1, jkx: 0, jky: 0, hd: 1, hdy: 0, hdFree: 0, hfx2: 0, hfy2: 0,
  untie: 0, deflate: 0, spill: 0, mound: 1,
  fleck: 0, fdir: -1, dust: 0, zap: 0, flash: 0, speed: 0, shake: 0, smear: 0, diss: 0, t: 0,
};
export const pose = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

export const enum Part {
  none = 0,
  mound,
  stake,
  bar,
  handF,
  sleeveF,
  skirt,
  torso,
  belt,
  handN,
  sleeveN,
  collar,
  head,
  hat,
  floor,
}

// ---------------------------------------------------------------- skeleton

export interface Skel {
  /** foot of the stake (world), the turn */
  foot: Pt;
  t: number;
  /** bar tips (world) */
  barL: Pt;
  barR: Pt;
  /** cuffs (world) far / near */
  cuffL: Pt;
  cuffR: Pt;
  /** head centre (world), chest (core) */
  head: Pt;
  core: Pt;
  /** the near straw hand's tip (the attack's contact point) */
  tipR: Pt;
}

const sh = (o: Pose, h: number) => rnd((o.lean * h) / -BAR);

export function skeleton(o: Pose): Skel {
  const fx = RX;
  const fy = GY - o.lift;
  const t = o.topple;
  const P = (lx: number, ly: number): Pt => turn(fx, fy, lx, ly, t);
  const s = sh(o, -BAR);
  const barL = P(-15 + s, BAR + o.aL);
  const barR = P(15 + s, BAR + o.aR);
  const cuffL = P(-12 + s + o.slL, BAR + 1 + rnd((o.aL * 12) / 15) + o.droop);
  const cuffR = P(12 + s + o.slR, BAR + 1 + rnd((o.aR * 12) / 15) + o.droop);
  const head = o.hdFree ? ([fx + o.hfx2, fy + o.hfy2] as Pt) : P(1 + o.hx + sh(o, -HEAD), HEAD + o.hy - o.hdy);
  const core = P(sh(o, 28), -27);
  const spreadX = 5 + rnd(o.spread * 2) - rnd(o.curl * 2);
  const tipR = P(12 + s + o.slR + spreadX + 1, BAR + rnd((o.aR * 12) / 15) + o.droop + rnd(o.curl * 3));
  return { foot: [fx, fy], t, barL, barR, cuffL, cuffR, head, core, tipR };
}

// ---------------------------------------------------------------- parts

type Tones = { lit: number; base: number; shade: number; deep?: number };
const JACKET: Tones = { lit: PAL.steel, base: PAL.night4, shade: PAL.night3, deep: PAL.night2 };
const SACK: Tones = { lit: PAL.earth4, base: PAL.earth3, shade: PAL.earth2 };
const HAT: Tones = { lit: PAL.earth2, base: PAL.earth1, shade: PAL.earth0 };

function layer(): PixelCanvas {
  return new PixelCanvas(W, H);
}

/** Polygon in the stake frame (local points rel the foot), turned with the topple. */
function lpoly(q: PixelCanvas, o: Pose, pts: readonly Pt[], c: number): void {
  const fx = RX;
  const fy = GY - o.lift;
  q.poly(
    pts.map(([x, y]) => {
      const [a, b] = turn(fx, fy, x, y, o.topple);
      return [rnd(a), rnd(b)] as Pt;
    }),
    c,
  );
}
function lline(q: PixelCanvas, o: Pose, a: Pt, b: Pt, c: number): void {
  const fx = RX;
  const fy = GY - o.lift;
  const A = turn(fx, fy, a[0], a[1], o.topple);
  const B = turn(fx, fy, b[0], b[1], o.topple);
  strand(q, A[0], A[1], B[0], B[1], c);
}

/** The wooden stake: three value columns (lit / mid / shade), a knot, the sharpened foot in the mound. */
function stake(o: Pose, L: Side): PixelCanvas {
  const q = layer();
  const top = HEAD - 2;
  const s = sh(o, -top);
  const cols: [number, number][] = [
    [L, PAL.earth3],
    [0, PAL.earth2],
    [-L as number, PAL.earth1],
  ];
  for (const [dx, c] of cols) lline(q, o, [dx, 0], [dx + s, top], c);
  // the knot (a 2-px dark seam on the shaft, above the mound)
  lline(q, o, [0, -6], [0, -7], PAL.earth1);
  if (o.lift > 0) {
    // the sharpened foot (only seen in the air)
    lline(q, o, [0, 1], [0, 2], PAL.earth2);
  } else {
    // planted: nothing under the ground row (the topple turns the foot about the ground point)
    for (let y = GY + 1; y < H; y++) for (let x = 0; x < W; x++) q.erase(x, y);
  }
  return q;
}

/** The cross bar (two rows) — its ends show past the cuffs. */
function bar(o: Pose): PixelCanvas {
  const q = layer();
  const s = sh(o, -BAR);
  lline(q, o, [-15 + s, BAR + o.aL], [15 + s, BAR + o.aR], PAL.earth2);
  lline(q, o, [-15 + s, BAR + 1 + o.aL], [15 + s, BAR + 1 + o.aR], PAL.earth1);
  return q;
}

/** A straw hand: a fan of straw out of the cuff (side s), fluttering, curling (guard) or flung open. */
function hand(o: Pose, side: Side, L: Side): PixelCanvas {
  const q = layer();
  const s = sh(o, -BAR);
  const a = side < 0 ? o.aL : o.aR;
  const sl = side < 0 ? o.slL : o.slR;
  const fi = side < 0 ? o.fiL : o.fiR;
  const cx = side * 12 + s + sl;
  const cy = BAR + 1 + rnd((a * 12) / 15) + o.droop;
  const len = 5 + rnd(o.spread * 2) - rnd(o.curl * 2);
  const dn = rnd(o.curl * 3);
  const sp = rnd(o.spread * 2);
  // a short tied bunch at the cuff, then five straw spikes fanning out (gaps between them read as straw)
  lpoly(q, o, [[cx, cy - 1], [cx + side * 2, cy - 1], [cx + side * 2, cy + 3], [cx, cy + 3]], PAL.gold2);
  const tips: [Pt, number][] = [
    [[cx + side * (len - 1), cy - 3 - sp + fi + dn], PAL.gold3],
    [[cx + side * (len + 1), cy - 1 + fi + dn], side === L ? PAL.gold3 : PAL.gold2],
    [[cx + side * len, cy + 1 - fi + dn + rnd(sp / 2)], PAL.gold2],
    [[cx + side * (len - 1), cy + 3 + dn + sp], PAL.gold1],
    [[cx + side * (len - 4), cy + 5 + dn + sp - fi], PAL.gold1],
  ];
  const roots = [cy - 1, cy, cy + 1, cy + 2, cy + 3];
  tips.forEach(([t, c], i) => lline(q, o, [cx + side * 2, roots[i]], t, c));
  lline(q, o, [cx, cy - 1], [cx + side * 2, cy - 1], PAL.gold3);
  if (o.bristle > 0) {
    // magic: the straw stands on end
    lline(q, o, [cx + side, cy - 1], [cx + side * (len - 3), cy - 5], PAL.gold3);
    lline(q, o, [cx + side * 2, cy - 1], [cx + side * len, cy - 4], PAL.gold3);
  }
  return q;
}

/** A sleeve over the bar (side s): a cloth tube from the shoulder to the cuff, hanging below the bar. */
function sleeve(o: Pose, side: Side, L: Side): PixelCanvas {
  const q = layer();
  const s = sh(o, -BAR);
  const a = side < 0 ? o.aL : o.aR;
  const sl = side < 0 ? o.slL : o.slR;
  const cy = BAR + 1 + rnd((a * 12) / 15) + o.droop;
  const d = rnd(o.deflate * 2);
  const jx = o.jkx;
  const jy = o.jky;
  const pts: Pt[] = [
    [side * 4 + s + jx, BAR - 2 + jy],
    [side * 12 + s + sl + jx, cy - 2 + jy],
    [side * 12 + s + sl + jx, cy + 2 + jy],
    [side * 10 + s + sl + jx, cy + 3 + d + jy],
    [side * 5 + s + jx, BAR + 5 + d + jy],
  ];
  lpoly(q, o, pts, JACKET.base);
  bands(q, L, JACKET.lit, JACKET.shade);
  // the cuff: a dark hem at the sleeve's end
  lline(q, o, [side * 12 + s + sl + jx, cy - 1 + jy], [side * 12 + s + sl + jx, cy + 2 + jy], JACKET.deep!);
  // a fold line along the near sleeve
  if (side > 0) lline(q, o, [6 + s + jx, BAR + 2 + jy], [9 + s + sl + jx, cy + 1 + jy], JACKET.shade);
  return q;
}

/** The straw under the hem: a ragged skirt of strands swaying in the wind (also the bare bundle in the summon). */
function skirt(o0: Pose, L: Side): PixelCanvas {
  const q = layer();
  const o = o0.topple ? { ...o0, topple: 0 } : o0;
  if (o.wrap <= 0) return q;
  const s = sh(o, 18);
  const k = Math.min(1, o.wrap);
  const top = -20;
  const bot = -12 + rnd((1 - k) * 4);
  const hw = rnd(5 * k);
  const sw = o.skirt;
  lpoly(q, o, [[-hw + s, top], [hw + s, top], [hw + 2 + s + sw, bot], [-hw - 2 + s + sw, bot]], PAL.gold2);
  for (let i = -hw - 1; i <= hw + 1; i++) {
    const tipY = bot + 1 + ((i * 7 + 21) % 3 === 0 ? 1 : 0) - (i === 0 ? 1 : 0);
    const x0 = i * 0.8 + s;
    const x1 = i * 1.2 + s + sw;
    const lit = i * L > 0;
    if ((i + 40) % 2 === 0) strand(q, RX + x0, GY - o.lift + top + 1, RX + x1, GY - o.lift + tipY, lit ? PAL.gold3 : PAL.gold1);
    else if (Math.abs(i) >= hw) strand(q, RX + x0, GY - o.lift + top + 3, RX + x1, GY - o.lift + tipY - 1, PAL.gold2);
  }
  if (o0.topple !== 0) {
    // the same skirt turned with the stake (inverse-mapped from the upright one)
    const r = layer();
    const fx = RX;
    const fy = GY - o.lift;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const [a, b] = unturn(fx, fy, x - fx, y - fy, o0.topple);
        const c = q.get(rnd(a), rnd(b));
        if (c !== null) r.set(x, y, c);
      }
    return r;
  }
  return q;
}

/** The straw torso (the bundle before the jacket is on): strands spiral round the stake as `wrap` grows. */
function bundle(o: Pose, L: Side): PixelCanvas {
  const q = layer();
  const k = Math.min(1, o.wrap);
  if (k <= 0) return q;
  const s = sh(o, 26);
  const hw = Math.max(1, rnd(6 * k));
  lpoly(q, o, [[-hw + 1 + s, -34], [hw - 1 + s, -34], [hw + s, -27], [hw - 1 + s, -20], [-hw + 1 + s, -20], [-hw + s, -27]], PAL.gold2);
  bands(q, L, PAL.gold3, PAL.gold1);
  // the wrap: diagonal binding strands
  for (let y = -32; y <= -22; y += 4) lline(q, o, [-hw + 1 + s, y + 2], [hw - 1 + s, y], PAL.gold1);
  return q;
}

/** The jacket's body: faded indigo, open at the front where the straw shows, a red patch, a dark hem. */
function torso(o: Pose, L: Side): PixelCanvas {
  const q = layer();
  const s = sh(o, 26) + o.jkx;
  const y = o.jky;
  const d = o.deflate;
  const w = (n: number) => rnd(n * (1 - 0.3 * d));
  const hem = -18 + rnd(d * 2);
  lpoly(q, o, [
    [-w(6) + s, -34 + y], [w(6) + s, -34 + y], [w(7) + s, -30 + y], [w(6) + s, -24 + y], [w(7) + 1 + s + o.flap, hem + y],
    [-w(7) + s, hem + y], [-w(6) + s, -24 + y], [-w(7) + s, -30 + y],
  ], JACKET.base);
  bands(q, L, JACKET.lit, JACKET.shade, null);
  // the body turns away from the light: a flat shadow plane on the far third
  plane(q, L, turn(RX, GY - o.lift, s + 1 + (L < 0 ? 1 : -1), -27, o.topple)[0], JACKET.base, JACKET.shade);
  // the hem row
  lline(q, o, [-w(7) + 1 + s, hem + y], [w(7) + s + o.flap, hem + y], JACKET.deep!);
  // the open front: straw stuffing between the lapels
  if (o.wrap > 0.5) {
    lpoly(q, o, [[2 + s, -33 + y], [4 + s, -33 + y], [4 + s, -25 + y], [3 + s, -25 + y]], PAL.gold1);
    lline(q, o, [3 + s, -32 + y], [3 + s, -27 + y], PAL.gold2);
  }
  lline(q, o, [1 + s, -34 + y], [2 + s, -24 + y], L < 0 ? JACKET.lit : JACKET.shade);
  lline(q, o, [5 + s, -34 + y], [4 + s, -24 + y], JACKET.deep!);
  // the red patch on the far breast (2 tones) and its stitched corner
  lpoly(q, o, [[-5 + s, -30 + y], [-3 + s, -30 + y], [-3 + s, -28 + y], [-5 + s, -28 + y]], PAL.crim2);
  lline(q, o, [-5 + s, -28 + y], [-3 + s, -28 + y], PAL.crim1);
  lline(q, o, [-3 + s, -30 + y], [-3 + s, -29 + y], L < 0 ? PAL.crim1 : PAL.crim3);
  // the button on the near lapel
  lline(q, o, [5 + s, -29 + y], [5 + s, -28 + y], PAL.stone3);
  return q;
}

/** The rope belt with its knot and loose end (undone in the death: the rope springs off). */
function belt(o: Pose): PixelCanvas {
  const q = layer();
  if (o.untie >= 1) return q;
  const s = sh(o, 23) + o.jkx;
  const y = -23 + o.jky;
  if (o.untie <= 0) {
    lline(q, o, [-6 + s, y], [6 + s, y], PAL.earth3);
    lpoly(q, o, [[3 + s, y - 1], [4 + s, y - 1], [4 + s, y + 1], [3 + s, y + 1]], PAL.earth2);
    lline(q, o, [4 + s, y + 1], [5 + s + o.rope, y + 4], PAL.earth3);
  } else {
    // snapped: two ends fly loose
    lline(q, o, [3 + s, y], [8 + s, y - 3], PAL.earth3);
    lline(q, o, [-6 + s, y], [-9 + s, y + 3], PAL.earth3);
  }
  return q;
}

/** Straw tufts out of the collar (under the head). */
function collar(o: Pose): PixelCanvas {
  const q = layer();
  const s = sh(o, 35);
  lline(q, o, [-2 + s, -34], [-4 + s, -37], PAL.gold3);
  lline(q, o, [-1 + s, -34], [-2 + s, -37], PAL.gold2);
  lline(q, o, [3 + s, -34], [5 + s, -37], PAL.gold3);
  return q;
}

/** The burlap sack head (centre hc world): tied at the neck, two button eyes, a stitched mouth, straw hair. */
function head(o: Pose, hc: Pt, L: Side): PixelCanvas {
  const q = layer();
  const cx = rnd(hc[0]);
  const cy = rnd(hc[1]);
  // straw hair at the back of the head, under the brim
  if (o.hat) {
    q.line(cx - 5, cy - 3, cx - 7, cy - 1 + rnd(o.fiL * 0.5), PAL.gold3);
    q.line(cx - 5, cy - 2, cx - 6, cy + 1, PAL.gold2);
  }
  q.ellipse(cx, cy, 5, 5, SACK.base);
  // the gathered neck under the twine
  q.rect(cx - 2, cy + 5, 5, 2, SACK.base);
  // the corner of the sack poking up at the back (seen when the hat is off)
  if (!o.hat) q.poly([[cx - 4, cy - 3], [cx - 6, cy - 6], [cx - 2, cy - 5]], SACK.base);
  bands(q, L, SACK.lit, SACK.shade);
  plane(q, L, cx + (L < 0 ? 2 : 0), SACK.base, SACK.shade);
  // twine tie
  q.hline(cx - 2, cx + 2, cy + 5, PAL.earth1);
  // burlap weave: two short dashes on the shaded cheek
  q.hline(cx - 2 * L, cx - 2 * L + 1, cy + 3, SACK.shade);
  // eyes: two buttons (far, near), facing right; look shifts them
  const lk = rnd(o.look);
  const eyeC = o.eye >= 2 ? PAL.gold4 : PAL.night1;
  for (const ex of [cx + lk, cx + 3 + lk]) {
    q.rect(ex, cy - 2, 2, 2, eyeC);
  }
  // mouth
  if (o.mouth === 1) {
    q.hline(cx + 1, cx + 4, cy + 2, PAL.ink);
    q.hline(cx + 2, cx + 3, cy + 3, PAL.ink);
    q.set(cx + 1, cy + 1, PAL.earth1).set(cx + 4, cy + 1, PAL.earth1);
  } else if (o.mouth === 2) {
    q.line(cx + 1, cy + 2, cx + 2, cy + 1, PAL.earth1);
    q.line(cx + 3, cy + 2, cx + 4, cy + 1, PAL.earth1);
    q.set(cx + 3, cy + 1, PAL.earth1);
  } else {
    q.hline(cx + 1, cx + 4, cy + 2, PAL.earth1);
    q.set(cx + 2, cy + 1, PAL.earth1).set(cx + 4, cy + 3, PAL.earth1);
  }
  return q;
}

/** The floppy felt hat with a red band and a straw sprig, brim centre (bx, by) world. */
function hat(o: Pose, bx: number, by: number, L: Side): PixelCanvas {
  const q = layer();
  const X = rnd(bx);
  const Y = rnd(by);
  const t = rnd(o.hatTilt);
  // crown (a dent in the top) and the brim (longer in front)
  q.poly([[X - 3, Y], [X - 2, Y - 5 - t], [X, Y - 5], [X + 1, Y - 4], [X + 3, Y - 6 + t], [X + 5, Y]], HAT.base);
  q.poly([[X - 6, Y + t], [X + 7, Y - t], [X + 8, Y + 1 - t], [X - 5, Y + 1 + t]], HAT.base);
  bands(q, L, HAT.lit, HAT.shade);
  // band
  q.line(X - 3, Y - 1, X + 4, Y - 1, PAL.crim1);
  q.set(X - 2 + (L < 0 ? 0 : 5), Y - 1, PAL.crim2);
  // the straw sprig in the band
  q.line(X - 3, Y - 2, X - 5, Y - 4, PAL.gold3);
  return q;
}

/** Spilled straw heaps and the dropped jacket/rope on the floor (death), world space. */
function floorPile(o: Pose, L: Side): PixelCanvas {
  const q = layer();
  if (o.spill <= 0) return q;
  const k = Math.min(1, o.spill);
  const heap = (cx: number, w: number, h: number) => {
    const ww = Math.max(2, rnd(w * k));
    const hh = Math.max(1, rnd(h * k));
    q.poly([[cx - ww, GY], [cx - ww + 2, GY - hh], [cx + ww - 2, GY - hh], [cx + ww, GY]], PAL.gold2);
  };
  heap(RX - 8, 6, 3);
  heap(RX + 7, 5, 2);
  heap(RX - 1, 4, 2);
  bands(q, L, PAL.gold3, PAL.gold1);
  // loose strands lying on the floor
  if (k > 0.5) {
    q.line(RX - 15, GY, RX - 12, GY - 1, PAL.gold3);
    q.line(RX + 12, GY - 1, RX + 15, GY, PAL.gold2);
  }
  return q;
}

/** Straw falling from the hem (mid-spill, in the air). */
function falling(o: Pose, q: PixelCanvas, L: Side): void {
  if (o.spill <= 0 || o.spill >= 0.9) return;
  const y0 = GY - 16 + rnd(o.spill * 10);
  for (const [dx, dy] of [[-5, 0], [-2, 3], [2, 1], [5, 4], [-7, 5]] as const) {
    const y = y0 + dy;
    if (y >= GY - 1) continue;
    q.line(RX + dx, y, RX + dx + (dx < 0 ? -1 : 1), y + 2, dx * L > 0 ? PAL.gold3 : PAL.gold2);
  }
}

// ---------------------------------------------------------------- the frame

export function drawStraw(p: PixelCanvas, o: Pose, light: 'left' | 'right'): void {
  const L: Side = light === 'left' ? -1 : 1;
  const k = new Comp(p);
  const sk = skeleton(o);
  // ground mound + the straw bits round it (static: the feet rows never move)
  if (o.mound > 0) {
    const m = layer();
    const r = Math.max(2, rnd(5 * Math.min(1, o.mound)));
    m.hline(RX - r, RX + r, GY, PAL.earth1);
    m.hline(RX - r + 2, RX + r - 2, GY - 1, PAL.earth2);
    m.set(RX + (L < 0 ? -r + 2 : r - 2), GY - 1, PAL.earth3);
    if (o.mound >= 1) m.line(RX + 6, GY, RX + 8, GY - 1, PAL.gold2);
    k.add(m, Part.mound, null);
  }
  k.add(floorPile(o, L), Part.floor, null);
  k.add(stake(o, L), Part.stake, PAL.ink, [Part.mound]);
  k.add(bar(o), Part.bar);
  if (o.wrap > 0.6 || o.jk > 0) {
    k.add(hand(o, -1, L), Part.handF);
  }
  if (o.jk > 0) k.add(sleeve(o, -1, L), Part.sleeveF);
  k.add(skirt(o, L), Part.skirt, PAL.ink, [Part.stake]);
  if (o.jk < 1 || o.jky !== 0) k.add(bundle(o, L), Part.torso);
  if (o.jk > 0) {
    k.add(torso(o, L), Part.torso);
    k.add(belt(o), Part.belt, null);
  }
  if (o.wrap > 0.6 || o.jk > 0) k.add(hand(o, 1, L), Part.handN);
  if (o.jk > 0) k.add(sleeve(o, 1, L), Part.sleeveN);
  if (o.wrap > 0.8) k.add(collar(o), Part.collar, null);
  if (o.hd > 0) k.add(head(o, sk.head, L), Part.head);
  if (o.hat > 0 && o.hd > 0) k.add(hat(o, sk.head[0] + o.hatX + 1, sk.head[1] - 5 + o.hatY, L), Part.hat);
  else if (o.hat <= 0 && o.hfy !== 0) k.add(hat(o, RX + o.hfx, GY + o.hfy, L), Part.hat);
  const fall = layer();
  falling(o, fall, L);
  k.add(fall, Part.floor, null);
  p.outline(PAL.ink);

  // ---- light layer (never outlined)
  // the crow (its own outline)
  if (o.crow) drawCrow(p, RX + o.cx, GY + o.cy, o.crow, o.wing, o.cf, L);
  // button-eye glints
  if (o.hd > 0 && o.eye >= 1) {
    const cx = rnd(sk.head[0]) + rnd(o.look);
    const cy = rnd(sk.head[1]);
    const gx = L < 0 ? 0 : 1;
    for (const ex of [cx, cx + 3]) p.set(ex + gx, cy - 2, o.eye >= 2 ? PAL.white : PAL.mist);
    if (o.eye >= 2) {
      // the lit buttons spill a little warm light (a 1-px halo cross round the near eye)
      p.set(cx + 3, cy - 3, PAL.gold3).set(cx + 6, cy - 2, PAL.gold3).set(cx + 6, cy - 1, PAL.gold3).set(cx + 2, cy - 1, PAL.gold4);
    }
  }
  // magic: straw tips burn white, sparks crawl the stake
  if (o.zap >= 0.5) {
    // every straw tip (a gold pixel with the outline under or beside it, out from the body) catches the glow
    const src = p.clone();
    const gold = (c: number | null) => c === PAL.gold1 || c === PAL.gold2 || c === PAL.gold3;
    for (let y = 2; y < GY - 8; y++)
      for (let x = 1; x < W - 1; x++) {
        if (!gold(src.get(x, y))) continue;
        const tipDown = src.get(x, y + 1) === PAL.ink && src.get(x, y + 2) === null;
        const tipSide = (src.get(x + 1, y) === PAL.ink && src.get(x + 2, y) === null) || (src.get(x - 1, y) === PAL.ink && src.get(x - 2, y) === null);
        if (tipDown || (tipSide && Math.abs(x - RX) > 10)) p.set(x, y, o.zap > 0.8 ? PAL.white : PAL.gold4);
      }
  }
  if (o.zap > 0) {
    const n = Math.ceil(o.zap * 6);
    for (let i = 0; i < n; i++) {
      const y = GY - 8 - ((i * 7 + rnd(o.t * 20)) % 40);
      const x = RX + ((i % 2) * 2 - 1) * (2 + (i % 3));
      if (p.isOpaque(x, y)) p.set(x, y, i % 2 ? PAL.white : PAL.gold4);
    }
    for (const c of [sk.tipR, [sk.cuffL[0] - 5, sk.cuffL[1] - 1] as Pt]) {
      p.set(rnd(c[0]), rnd(c[1]) - 1, PAL.white);
      p.set(rnd(c[0]), rnd(c[1]) - 2, PAL.gold4);
    }
  }
  // the planting flash at the foot ("tok"): a flat stepped crack-ring on the floor
  if (o.flash > 0) {
    const r = rnd(4 + o.flash * 5);
    const c = o.flash > 0.5 ? PAL.gold4 : PAL.gold3;
    for (const dx of [-r, -r + 1, r - 1, r]) p.set(RX + dx, GY + 1, c);
    p.set(RX - r + 2, GY, c).set(RX + r - 2, GY, c);
  }
  // dust at the foot
  if (o.dust > 0) {
    const r = 4 + rnd(o.dust * 6);
    const up = rnd(o.dust * 2);
    for (const s of [-1, 1]) {
      p.hline(RX + s * r - 1, RX + s * r, GY - 1 - up, PAL.earth3);
      p.hline(RX + s * (r + 2) - 1, RX + s * (r + 2), GY - 2 - up * 2, PAL.earth2);
    }
  }
  // falling speed lines over the stake (summon)
  if (o.speed > 0) {
    const top = rnd(skeleton(o).foot[1]) - 40;
    for (const dx of [-3, 0, 3]) {
      const len = 3 + rnd(o.speed * 4) - Math.abs(dx);
      for (let i = 0; i < len; i++) if (top - 2 - i >= 2) p.set(RX + dx, top - 2 - i, dx === 0 ? PAL.gold4 : PAL.earth4);
    }
  }
  // straw flecks in the air
  if (o.fleck > 0) {
    const ph = o.fleck;
    const hc = sk.head;
    const pts: [number, number, number][] = [
      [hc[0] + o.fdir * (4 + 8 * ph), hc[1] - 3 - 4 * ph, PAL.gold3],
      [hc[0] + o.fdir * (6 + 10 * ph), hc[1] + 1 - 2 * ph, PAL.gold2],
      [sk.core[0] + o.fdir * (6 + 9 * ph), sk.core[1] - 2 + 4 * ph, PAL.gold3],
      [sk.core[0] + o.fdir * (3 + 12 * ph), sk.core[1] + 4 + 5 * ph, PAL.gold2],
      [hc[0] + o.fdir * (2 + 6 * ph), hc[1] - 7 - 3 * ph, PAL.gold4],
    ];
    for (const [x, y, c] of pts) if (x >= 3 && x < W - 4 && y >= 3 && y < H - 3) fleck(p, x, y, o.fdir, c);
  }
  // release smear: two straw streaks trailing the near hand
  if (o.smear > 0) {
    const [tx, ty] = sk.tipR;
    p.hline(rnd(tx) - 6, rnd(tx) - 3, rnd(ty) - 1, PAL.gold3);
    p.hline(rnd(tx) - 7, rnd(tx) - 4, rnd(ty) + 2, PAL.gold2);
  }
  // dissolve (last frames of the death / first of the revive): the straw blows apart pixel by pixel
  if (o.diss > 0) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!p.isOpaque(x, y)) continue;
        if (hash2(x >> 1, y >> 1) < o.diss * (0.6 + 0.4 * ((GY - y) / 40))) p.erase(x, y);
      }
  }
  // a whole-frame tremble (hitMagic / topple bounce): whole px only
  if (o.shake) {
    const c = p.clone();
    p.clear();
    p.blit(c, o.shake, 0);
  }
}
