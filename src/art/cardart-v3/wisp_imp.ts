// Card art v3 — Tüy Hayalet (wisp_imp, R3 "Down Wisp", DARK fiend): "a ghost peeking out of a heap of feathers in
// the moonlight, one feather adrift" (docs/v3/YENI_KARTLAR.md R3, style sheet docs/v3/KART_RESIMLERI.md, contract
// ./_types.ts). A NATIVE painting (no sprite pixels, no rig import: it survives any rig rewrite), drawn on the
// sprite's own model (src/art/monsters-v3/wisp_imp-rig.ts): the same tear-drop silhouette (a round white hood that
// flows into a feathered body and ends in a question-mark tail), the same round void0 face hollow with two gold dot
// eyes, the same feather ramp void1 · void2 · void3 · void4 · white — card and board show the same creature.
//
// Round 3 (2026-11-01): the round-2 body was six separately inked plumes hanging under the face; on the face it read
// as a squid / a beard and did not match the sprite's sack-like tear-drop. The body is now ONE silhouette like the
// rig's (hood ∪ tapered skirt, outlined once) with feather texture inside it, and the feathers that do read as
// separate objects are the ones that SHOULD: the plume tips sticking out of the back, the heap, the loose feather.
//
// Composition (big px, 88×68; facing right, the lead room on the right):
//   moon      the DARK recipe's eclipse used as the moon: its dark disc sits behind the hood, the stepped violet
//             corona rings the dome (the white hood reads against night0, the corona frames the face).
//   hood      a round ellipsoid in three planes (white lit · void4 · void3) with a COWLICK curling forward on the
//             crown (it echoes the "?").
//   face      a round hollow on the hood's front (void0, an ink brow overhang, a void1 lower lip) with TWO DOT EYES
//             (gold3, ONE white glint = the picture's focus) high and forward: the ghost looks up at the feather.
//   body      a tear-drop skirt hanging from the hood and sweeping back-down-left to the tail root: four feather strips
//             along it (the light-facing half-vane a value up, a crease where the next strip overlaps, lilac tips
//             that cut the hem into feather points), planes from its curvature, the recipe's void3 rim.
//   plumes    two plume tips sticking out of the back edge (drawn behind the body: roof tiles, only the tips show).
//   tail      the question-mark tail: one long feather curling up behind the body on the left.
//   hand      one tiny three-feather hand reaching up toward the loose feather (the directional line:
//             tail → eyes → hand → feather).
//   heap      a low mound of down with feathers lying on it, fanned from both sides (each feather inked, quilled).
//   feather   one loose feather adrift in the lead room (light layer: moonlit, not outlined).
// small: a hand-drawn 44×34 map (S_SUBJECT) on the same composition, made from the big geometry at 1× and then
//        corrected by hand (sampled creases, plumes and the tail break into noise at 1×): white hood, round hollow,
//        cowlick, the tear-drop with two creases, two back plume tips, the ? curl, the hand, five heap feathers.
//        Hand-placed eyes and drifting feather (light layer). Judged at 1× on the face.
// icon: a hand-drawn 16×12 field icon (wispImpIcon) — the averaged mini loses the eyes; see its comment.
// Living art (A5_PLAN §3.7.6): 6 frames × 150 ms — the loose feather rocks / drifts ≤ 1 px, the eyes blink once.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ink, paintBackdrop, patch, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type V = readonly [number, number];

/** The sprite's feather ramp, dark → light. */
const F = [PAL.void1, PAL.void2, PAL.void3, PAL.void4, PAL.white] as const;

// ================================================================ geometry (big px)

/** Hood ellipsoid. */
const HX = 43;
const HY = 21;
const HRX = 14.5;
const HRY = 13.5;
/** The face hollow: a round ellipse on the hood's front, a white rim still around it (the sprite's face). */
const FX = 49.5;
const FY = 22;
const FRX = 6.6;
const FRY = 6.4;
/** The eyes: top-left corner of each dot (near dot 3×4, far dot 2×4); the near glint is the focus. */
const EYE_N: V = [47, 19];
const EYE_F: V = [52, 19];
const FOCUS: V = [47, 19];

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Inside the hood? and its plane (ramp index) under the key light (top left). */
const inHood = (x: number, y: number) => ((x - HX) / HRX) ** 2 + ((y - HY) / HRY) ** 2 <= 1;
function hoodTone(x: number, y: number): number {
  const nx = (x - HX) / HRX;
  const ny = (y - HY) / HRY;
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  const l = -nx * 0.62 - ny * 0.62 + nz * 0.48;
  return l > 0.52 ? 4 : l > -0.1 ? 3 : 2;
}
/** Inside the face hollow? */
const inFace = (x: number, y: number) => ((x - FX) / FRX) ** 2 + ((y - FY) / FRY) ** 2 <= 1;

// ---------------------------------------------------------------- feathers (plumes: back tips, the heap)

/**
 * A feather: a quadratic curve root → tip bent by `bow` (px), a leaf profile of width `w`, two half-vanes split by
 * the quill, `tone` = the ramp index of its light-facing half (the other half one step down), barb splits near
 * `split` (0..1 along it, on the shade half).
 */
interface Plume {
  readonly r: V;
  readonly t: V;
  readonly w: number;
  readonly bow: number;
  readonly tone: number;
  readonly split: number;
}

/** Sample a plume's centre line (n + 1 points). */
function plumeLine(p: Plume, n = 24): V[] {
  const [rx, ry] = p.r;
  const [tx, ty] = p.t;
  const dx = tx - rx;
  const dy = ty - ry;
  const l = Math.hypot(dx, dy) || 1;
  const cx = (rx + tx) / 2 + (dy / l) * p.bow;
  const cy = (ry + ty) / 2 - (dx / l) * p.bow;
  const out: V[] = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const a = (1 - s) * (1 - s);
    const b = 2 * s * (1 - s);
    const c = s * s;
    out.push([a * rx + b * cx + c * tx, a * ry + b * cy + c * ty]);
  }
  return out;
}

/** Leaf half-width at s (0 root … 1 tip): a narrow calamus, a full vane, a pointed tip. */
const leaf = (w: number, s: number) => (w / 2) * Math.pow(Math.sin(Math.PI * Math.pow(clamp(s, 0, 1), 1.1)), 0.8);

/** The tone (ramp index) of plume `p` at (x, y), or −1 outside: lit / shade half-vanes, the quill, barbs, a lilac tip. */
function plumeAt(p: Plume, line: readonly V[], x: number, y: number): number {
  let best = Infinity;
  let bs = 0;
  let side = 0;
  const n = line.length - 1;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = line[i];
    const [bx, by] = line[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy || 1;
    const q = clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1);
    const ox = x - (ax + q * dx);
    const oy = y - (ay + q * dy);
    const d = ox * ox + oy * oy;
    if (d < best) {
      best = d;
      bs = (i + q) / n;
      const l = Math.sqrt(l2);
      // + = the half facing the key light (top left)
      const nx = dy / l;
      const ny = -dx / l;
      const s = ox * nx + oy * ny;
      const facing = nx * -0.7 + ny * -0.7;
      side = (s >= 0 ? 1 : -1) * (facing >= 0 ? 1 : -1) * (Math.abs(s) + 1e-6);
    }
  }
  const hw = leaf(p.w, bs);
  if (Math.sqrt(best) > hw + 0.25) return -1;
  const lit = side > 0;
  const a = Math.abs(side) / Math.max(1, hw); // 0 at the quill … 1 at the vane's edge
  // barbs: short lines slanting from the quill toward the tip on the shade half-vane (the feather's tell)
  const barb = (s0: number) => a > 0.3 && a < 0.92 && Math.abs(bs - s0 - 0.09 * a) < 0.02;
  let t = lit ? p.tone : p.tone - 1;
  if (Math.abs(side) < 0.55 && bs > 0.04 && bs < 0.9) t = p.tone - 2; // the quill seam
  if (bs > 0.76) t -= 1; // the lilac tip
  else if (!lit && (barb(p.split) || barb(p.split - 0.24))) t -= 1;
  return clamp(t, 0, 4);
}

/** The plume tips sticking out of the back edge (drawn BEHIND the body: only their tips show, like roof tiles). */
const BACK_PLUMES: readonly Plume[] = [
  { r: [35, 31], t: [18, 37], w: 7, bow: -1.6, tone: 4, split: 0.6 },
  { r: [34, 37], t: [19, 47], w: 7, bow: -1.4, tone: 3, split: 0.6 },
];

/** The heap's feathers lying on the mound, fanned from both sides, back to front. */
const HEAP: readonly Plume[] = [
  { r: [-2, 60], t: [19, 57], w: 8, bow: 1.5, tone: 2, split: 0.6 },
  { r: [90, 61], t: [66, 56], w: 8, bow: -1.5, tone: 2, split: 0.6 },
  { r: [62, 63], t: [36, 56], w: 8, bow: -1.5, tone: 2, split: 0.6 },
  { r: [12, 67], t: [35, 59], w: 9, bow: 1.5, tone: 3, split: 0.6 },
  { r: [78, 68], t: [53, 59], w: 9, bow: -1.5, tone: 3, split: 0.6 },
  { r: [-2, 70], t: [17, 63], w: 9, bow: 1, tone: 3, split: 0.6 },
  { r: [90, 71], t: [70, 63], w: 9, bow: -1, tone: 2, split: 0.6 },
  { r: [32, 72], t: [52, 62], w: 9.5, bow: 1.5, tone: 3, split: 0.6 },
  { r: [62, 73], t: [41, 64], w: 9.5, bow: -1.5, tone: 3, split: 0.6 },
  { r: [16, 74], t: [36, 67], w: 9, bow: 1, tone: 3, split: 0.6 },
];

// ---------------------------------------------------------------- the body (one silhouette with the hood)

/** The skirt's centre line: from the hood's middle down under the face, then back-down-left to the tail root. */
const SK0: V = [43, 24];
const SK1: V = [44, 47];
const SK2: V = [21, 54];
const SKN = 48;
const SK_LINE: V[] = Array.from({ length: SKN + 1 }, (_, i) => {
  const s = i / SKN;
  const a = (1 - s) * (1 - s);
  const b = 2 * s * (1 - s);
  const c = s * s;
  return [a * SK0[0] + b * SK1[0] + c * SK2[0], a * SK0[1] + b * SK1[1] + c * SK2[1]];
});
/** Half width along the skirt (s 0 = the hood's middle … 1 = the tail root): a full sack, then the taper. */
const skW = (s: number) => (s < 0.35 ? 14.6 - 2.4 * s : 2.6 + 11.2 * Math.pow((1 - s) / 0.65, 1.25));
/** Nearest point on the skirt line: s and the signed lateral offset d (+ = the up-left / back side). */
function skirtCoord(x: number, y: number): { s: number; d: number } {
  let best = Infinity;
  let bs = 0;
  let bd = 0;
  for (let i = 0; i < SKN; i++) {
    const [ax, ay] = SK_LINE[i];
    const [bx, by] = SK_LINE[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy || 1;
    const q = clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1);
    const ox = x - (ax + q * dx);
    const oy = y - (ay + q * dy);
    const dd = ox * ox + oy * oy;
    if (dd < best) {
      best = dd;
      bs = (i + q) / SKN;
      const l = Math.sqrt(l2);
      bd = (-dy / l) * ox + (dx / l) * oy;
    }
  }
  return { s: bs, d: bd };
}
/** Feather strips along the body (lateral), and where each one's pointed tip ends (s): back edge … belly. */
const STRIPS = 4;
const STRIP_END = [0.74, 1.0, 0.84, 0.62] as const;
/** The body's ramp index at (x, y), or −1 outside. */
function bodyTone(x: number, y: number): number {
  const { s, d } = skirtCoord(x, y);
  if (s <= 0) return -1;
  const w = skW(s);
  if (Math.abs(d) > w) return -1;
  const dn = clamp(-d / w, -1, 0.9999); // −1 = the lit back edge … 1 = the belly
  const q = ((dn + 1) / 2) * STRIPS;
  const k = Math.floor(q);
  const lu = q - k; // 0..1 across the strip
  const end = STRIP_END[k] - 0.2 * Math.abs(lu - 0.42) * 2; // the pointed tip: the strip's centre reaches furthest
  if (s > end) return -1;
  const nd = -dn;
  const nz = Math.sqrt(Math.max(0, 1 - nd * nd));
  let l = nd * 0.75 + nz * 0.5 - s * 0.35;
  if (lu < 0.42) l += 0.18; // the half-vane facing the light
  let t = l > 0.55 ? 4 : l > 0.12 ? 3 : l > -0.3 ? 2 : 1;
  if (s > end - 0.12) t -= 1; // the lilac tip
  if (lu > 0.82 && k < STRIPS - 1 && STRIP_END[k + 1] >= s) t -= 1; // the crease where the next strip overlaps
  return clamp(t, 0, 4);
}

/** The cowlick on the crown, curling forward (it echoes the "?"): hand map, ink included. */
const COW_BIG = [
  '....kkkkk..',
  '..kkwwwwvk.',
  '.kwwvkkkvLk',
  'kwvk...kkk.',
  'kvk........',
  'kvk........',
];
const COW_KEY = { k: PAL.ink, w: PAL.white, v: PAL.void4, L: PAL.void3 };

/** The tail: ONE long quilled feather curled into a question mark behind the body (a path, tapering). */
const TAIL: readonly V[] = [
  [24, 52],
  [17, 56],
  [10.5, 54.5],
  [7.6, 48.5],
  [8.4, 42.5],
  [12.4, 38.9],
  [17, 39.9],
  [18.4, 43.9],
  [16, 46.7],
];
function tailTone(x: number, y: number): number {
  let best = Infinity;
  let bt = 0;
  let side = 0;
  const n = TAIL.length - 1;
  for (let i = 0; i < n; i++) {
    const a = TAIL[i];
    const b = TAIL[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    const q = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / l2, 0, 1);
    const ox = x - (a[0] + q * dx);
    const oy = y - (a[1] + q * dy);
    const d = ox * ox + oy * oy;
    if (d < best) {
      best = d;
      bt = (i + q) / n;
      const l = Math.sqrt(l2);
      side = ox * (dy / l) - oy * (dx / l); // + = the outer side of the (clockwise-drawn) curl
    }
  }
  const r = 3.9 - bt * 2.8;
  if (Math.sqrt(best) > r) return -1;
  if (bt > 0.82) return side > 0 ? 3 : 2; // the lilac tip
  if (Math.abs(side) < 0.5 && bt > 0.04) return 2; // the quill
  if (side > 0) return bt < 0.1 ? 3 : 4; // the outer edge catches the moon
  return bt < 0.1 ? 2 : 3;
}

/** The tiny three-feather hand reaching up toward the loose feather (ink included). */
const HAND_BIG = [
  '.......kkk.',
  '....kkkwwvk',
  '..kkwwkwvvk',
  '.kwwwvkvvLk',
  '.kwwwvvvLk.',
  '..kwwvvLLk.',
  '..kwvvLLk..',
  '.kwvvLkk...',
  '.kvLkk.....',
  '.kkk.......',
];
const HAND_KEY = { k: PAL.ink, w: PAL.white, v: PAL.void4, L: PAL.void3 };
const HAND_AT: V = [53, 30];

// ================================================================ painters

const lum = (c: number) => ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;

/** Close every 2×2 checker (a b / b a) of the subject by giving the darker line its corner pixel. */
function closeCheckers(p: PixelCanvas): void {
  for (let pass = 0; pass < 3; pass++) {
    let n = 0;
    for (let y = 0; y + 1 < p.h; y++)
      for (let x = 0; x + 1 < p.w; x++) {
        const a = p.get(x, y);
        const b = p.get(x + 1, y);
        if (a === null || b === null || a === b) continue;
        if (p.get(x, y + 1) !== b || p.get(x + 1, y + 1) !== a) continue;
        if (lum(a) < lum(b)) p.set(x + 1, y, a);
        else p.set(x, y, b);
        n++;
      }
    if (n === 0) return;
  }
}

/** One inked layer, painted pixel by pixel from a tone function of the pixel centre (big px). */
function inked(p: PixelCanvas, tone: (x: number, y: number) => number): PixelCanvas {
  const one = new PixelCanvas(p.w, p.h);
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const t = tone(x + 0.5, y + 0.5);
      if (t >= 0) one.set(x, y, F[t]);
    }
  return ink(one);
}

/** The big subject, back to front: tail → back plumes → hood + body (one silhouette) + cowlick → heap → hand. */
function paintSubjectBig(p: PixelCanvas): void {
  const tail = inked(p, tailTone);
  rim(tail, PAL.void3, { skip: [PAL.void3, PAL.void2] });
  p.blit(tail, 0, 0);
  for (const pl of BACK_PLUMES) {
    const line = plumeLine(pl);
    p.blit(
      inked(p, (x, y) => plumeAt(pl, line, x, y)),
      0,
      0,
    );
  }
  // hood + body: the hood is in front down to its lower third (and always at the face), the skirt takes over below
  const body = new PixelCanvas(p.w, p.h);
  for (let py = 0; py < p.h; py++)
    for (let px = 0; px < p.w; px++) {
      const x = px + 0.5;
      const y = py + 0.5;
      const hood = inHood(x, y);
      if (hood && inFace(x, y)) {
        const lip = ((x - FX + 1.2) / FRX) ** 2 + ((y - FY + 2.2) / FRY) ** 2 > 1;
        body.set(px, py, y < FY - FRY + 2 ? PAL.ink : lip ? PAL.void1 : PAL.void0);
        continue;
      }
      const t = hood && y < HY + 3 ? -1 : bodyTone(x, y);
      if (t >= 0) body.set(px, py, F[t]);
      else if (hood) body.set(px, py, F[hoodTone(x, y)]);
    }
  ink(body);
  rim(body, PAL.void3, { skip: [PAL.void0, PAL.void1, PAL.void2, PAL.void3, PAL.ink] });
  patch(body, COW_BIG, COW_KEY, 38, 3);
  p.blit(body, 0, 0);
  // the heap: a low mound of down, then the feathers lying on it (each its own ink)
  const heap = new PixelCanvas(p.w, p.h);
  for (let py = 0; py < p.h; py++)
    for (let px = 0; px < p.w; px++)
      if (((px + 0.5 - 44) / 50) ** 2 + ((py + 0.5 - 76) / 15) ** 2 <= 1) heap.set(px, py, py < 64 ? PAL.void2 : PAL.void1);
  ink(heap);
  for (const pl of HEAP) {
    const line = plumeLine(pl);
    heap.blit(
      inked(p, (x, y) => plumeAt(pl, line, x, y)),
      0,
      0,
    );
  }
  p.blit(heap, 0, 0);
  patch(p, HAND_BIG, HAND_KEY, HAND_AT[0], HAND_AT[1]);
  closeCheckers(p);
}

// ---------------------------------------------------------------- small: the hand-drawn 1× subject
// The big geometry at 1× (hood ellipse, tear-drop skirt, plumes and heap feathers as leaves), then corrected by hand:
// the ? curl and the cowlick redrawn, two creases kept on the body, the back plumes cut to two small tips under the head (higher up they read as a beak), the heap
// cut to five feathers. k ink · w white · 4 void4 · 3 void3 · 2 void2 · 1 void1 · 0 void0.
const S_SUBJECT = [
  '............................................',
  '...................kkk......................',
  '..................kww4kk....................',
  '.................kw4kwwwkkk.................',
  '................kwwwwwwww44k................',
  '...............kwwwwwwwwww44k...............',
  '..............kwwwwwwwwww4444k..............',
  '..............kwwwwwwwwww4444k..............',
  '.............kwwwwwwwwwkkkk443k.............',
  '.............kwwwwwwww00000043k.............',
  '.............kwwwwwww000000033k.............',
  '.............kwwwwwww000000133k.............',
  '.............kwwwwwww400001122k.............',
  '.............kwwwwwww44111122k..............',
  '...........kk4wwwwww44443332kkkk............',
  '.........kk444wwwwww4444333kkwwk............',
  '........k33443wwwwww444433kkww4k............',
  '....kkkkk222kkkwwww4444333kw44k.............',
  '...kwwww4kkk333www44344333kkkk..............',
  '..kw44kk44k2333w4w4344323222k...............',
  '..kw4k..kk22122w44434432322k................',
  '.kw4k...kkk112ww44344323222k................',
  '.kw4k......kkkw34443323222k.................',
  '.kw44k......k434443323222k..................',
  '..kw44kk...k434333232222k...................',
  '..kww444kkk44433332222kk....................',
  '..kkkkkkk34333222222kk..........kkkkkkkkk...',
  '.k3333333k322222kkkk...........k333333333kk.',
  'k333333333kkkkkkkk........kkkkkkkk233333333k',
  '33322222kk44444444k......k44444444kk22223333',
  '2222222k4444444333kkkkkkkk3334444444kk222222',
  'kkk22kk4444433333kk444444kk33333444444k222kk',
  '..kkkk4443333333k44444433k1kk3333334444kkk..',
  '.k11k433333333kk44444333k1111k3333333344k1k.',
];
const S_KEY = { k: PAL.ink, w: PAL.white, '4': PAL.void4, '3': PAL.void3, '2': PAL.void2, '1': PAL.void1, '0': PAL.void0 };

// ---------------------------------------------------------------- light: the eyes and the loose feather

/** The loose feather adrift (big): vane white over void4, a void3 quill. */
const DRIFT_BIG = [
  '.........wv',
  '.......wwWv',
  '.....wwwWvv',
  '...wwwwWvv.',
  '..wwwWWvv..',
  '.wwWWvv....',
  'wwWvv......',
  'wWv........',
  'v..........',
];
const DRIFT_SMALL = ['...wv', '.wwWv', 'wWv..', 'v....'];
const DRIFT_KEY = { w: PAL.white, W: PAL.void4, v: PAL.void3 };

/** The 1× eyes: near dot 2×2 with the white glint, far dot 1×2. Origin = the near glint. */
const SMALL_EYES = ['wg.g', 'gg.g'];
const SMALL_EYES_BLINK = ['....', 'GG.G'];
const SMALL_EYES_AT: V = [23, 10];
const EYE_KEY = { w: PAL.white, g: PAL.gold3, G: PAL.gold2 };

/** The light layer: the eyes and the loose feather adrift, rocking ≤ 1 px; the eyes blink on frame 4. */
function paintLight(p: PixelCanvas, big: boolean, f: number): void {
  const rock = [0, 0, 1, 1, 0, 0][f % 6];
  const drift = [0, 0, 0, 1, 1, 0][f % 6];
  const blink = f === 4;
  if (big) {
    for (const [i, [x0, y0]] of [EYE_N, EYE_F].entries()) {
      const w = i === 0 ? 3 : 2; // the far eye a pixel narrower (the face turns toward the viewer's right)
      if (blink) {
        p.hline(x0, x0 + w - 1, y0 + 2, PAL.gold2);
        continue;
      }
      p.rect(x0, y0, w, 4, PAL.gold3);
      p.set(x0 + w - 1, y0 + 3, PAL.gold2);
      p.set(x0, y0, i === 0 ? PAL.white : PAL.gold4);
    }
    patch(p, DRIFT_BIG, DRIFT_KEY, 69 + drift, 6 + rock);
  } else {
    patch(p, blink ? SMALL_EYES_BLINK : SMALL_EYES, EYE_KEY, SMALL_EYES_AT[0], SMALL_EYES_AT[1]);
    patch(p, DRIFT_SMALL, DRIFT_KEY, 34 + drift, 3 + rock);
  }
}

const wispImpArt: CardArtV3 = {
  id: 'wisp_imp',
  focus: FOCUS,
  focusSmall: SMALL_EYES_AT,
  frames: 6,
  holdMs: 150,
  big(l: ArtLayers, f: number) {
    paintBackdrop(l.backdrop, 'DARK', { focus: [HX + 1, HY], radius: 28 });
    paintSubjectBig(l.subject);
    paintLight(l.light, true, f);
  },
  small(l: ArtLayers, f: number) {
    paintBackdrop(l.backdrop, 'DARK', { focus: [HX + 1, HY], radius: 28 });
    patch(l.subject, S_SUBJECT, S_KEY, 0, 0);
    closeCheckers(l.subject);
    paintLight(l.light, false, f);
  },
};

export default wispImpArt;

/**
 * The hand-drawn 16×12 field icon (the mini card's art window, cardface-v3 ICON registry): the 44×34 picture
 * averaged down loses the two eyes, so the icon keeps them as two gold3 pixels in the void0 hollow — the
 * one thing that must read on a card lying on the board. Same picture: cowlick, round white hood, the tear-drop
 * sweeping back into the ? curl, a back plume tip, the heap, the loose feather (void2 streak, top right).
 * Not wired yet (src/art/cardface-v3/index.ts is lane A5-B's registry).
 */
const ICON_16 = [
  '......kkk.......',
  '....kkwwwkk..V..',
  '...kwwwwww4k..V.',
  '..kwwwwkkkk4k.V.',
  '..kwwwkogog4k.V.',
  '..kwwww4oo44k...',
  '.kk4www44443k...',
  'kw4kk4w4433k....',
  'kw4k.k44332k....',
  '.kkLLLk432kLL...',
  'kLLDLLLkkkLLLDk.',
  'LLLLLDLLLLLLDLLL',
];
const ICON_KEY = {
  V: PAL.void2,
  k: PAL.ink,
  w: PAL.white,
  '4': PAL.void4,
  '3': PAL.void3,
  '2': PAL.void2,
  o: PAL.void0,
  g: PAL.gold3,
  L: PAL.void3,
  D: PAL.void2,
};
/** Paint the 16×12 field icon (backdrop night0 / ink bands, then the map). */
export function wispImpIcon(p: PixelCanvas): void {
  p.rect(0, 0, 16, 7, PAL.night0);
  p.rect(0, 7, 16, 5, PAL.ink);
  patch(p, ICON_16, ICON_KEY, 0, 0);
}
