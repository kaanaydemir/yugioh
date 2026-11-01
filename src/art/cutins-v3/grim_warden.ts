// Hortlak Muhafız (grim_warden, R2 "Fener Bekçisi") — v3 ace cut-in portrait (200×144, faces right; ?look=v3 only, see
// src/art/cutins/index.ts), painted at the cut-in's own density (never the sprite enlarged). Self-contained: it shares
// no code with the rig (src/art/monsters-v3/grim_warden*), only the design (docs/v3/YENI_KARTLAR.md §8 R2).
//
// The close-up: the tattered grave-shroud cowl fills the left two thirds (stone ramp: stone3 lit crown, stone2 side,
// stone1 under the brow and down the front, stone1 / night0 fold creases, 1-px tatters along its back edge that
// flutter); in its void0 opening the IRON CAGE-HELM — three bars bowing round the skull and converging into a crown
// knob, a cheek ring — over the skull (stone bone in the cowl's shadow, a lit cheekbone, a nose hole, a row of teeth)
// with ONE EYE LIGHT in its socket (leaf4 core, white glint, leaf3 / leaf2 halo). Bottom right, the bone hand
// lifting the SOUL LANTERN on a short chain (iron roof, posts and foot; leaf glass; the soul fire).
// One key light from the frame's top-left (P2: a relit set, every band follows `lightFrom`; the silhouette is the
// same), flat value planes, 1-px ink outline, the DARK rim (void3) on the shadow side, lights drawn after the ink and
// never outlined. No dither, no gradients, palette only.
//
// Rhythm (holds, played once, the last frame held), cut to the DEFAULT cut-in beats (_v3/presets: flare 290, slam
// 370, exit 700 — a per-card RHYTHM entry would also need tests/presentation/accessors-v3.test.ts RHYTHM_TODAY):
//   f0   0–260  the stare in the dark: the eye a small cold light, the lantern low at the bottom edge, its fire dim
//   f1 260–370  [flare 290] the eye ignites (halo opens, two short scan streaks); the lantern swings up into view
//   f2 370–470  [slam 370] the soul fire BLAZES: white-hot core, the glass full, green light catches the cage bars,
//               the cowl's lip and the skull on the lantern's side
//   f3 470–580  the head pushes forward (2 px), the lantern at the top of its swing, the eye's cross glint
//   f4 580–700  the swing back: three soul wisps rise off the lantern's roof, the tatters stream
//   f5 700–     [exit] held while the band closes: lantern mid-swing, fire tall, two wisps still rising
// The lens glint: cutin.ts takes f0's brightest isolated pixel in the head region (top 45 %, right 60 % of the
// bounds) — the eye's white core; on f0 the lantern sits at the bottom edge, outside that region, and dim.

import type { CutinFactory } from '../cutins/index';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { lightOf } from '../rigkit/light';
import type { DrawOpts } from '../types';

type V = readonly [number, number];
const W = 200;
const H = 144;

interface Pose {
  /** head (cowl + cage + skull) offset */
  head: V;
  /** eye: 0 cold, 1 lit, 2 flare */
  eye: 0 | 1 | 2;
  /** the lantern's ring (top of the roof) position */
  lan: V;
  /** soul fire: 0 dim, 1 lit, 2 blaze */
  fire: 0 | 1 | 2;
  /** green light cast on the lantern side of the head */
  cast: boolean;
  /** soul wisps rising off the roof (0..3) */
  wisps: number;
  /** tatter phase */
  t: number;
  /** lantern size (critic r3: the lantern SWINGS TOWARD THE LENS on the slam — big in the foreground, the brightest point) */
  ls: number;
}

const POSES: readonly Pose[] = [
  { head: [0, 0], eye: 0, lan: [174, 118], fire: 0, cast: false, wisps: 0, t: 0, ls: 1 },
  { head: [0, 0], eye: 1, lan: [172, 84], fire: 1, cast: false, wisps: 0, t: 1, ls: 1.2 },
  { head: [1, 0], eye: 2, lan: [177, 60], fire: 2, cast: true, wisps: 0, t: 2, ls: 1.6 },
  { head: [2, 1], eye: 2, lan: [175, 56], fire: 2, cast: true, wisps: 1, t: 3, ls: 1.5 },
  { head: [1, 1], eye: 2, lan: [176, 64], fire: 2, cast: true, wisps: 3, t: 4, ls: 1.35 },
  { head: [1, 1], eye: 2, lan: [175, 60], fire: 2, cast: true, wisps: 2, t: 5, ls: 1.4 },
];
const HOLDS: readonly number[] = [260, 110, 100, 110, 120, 420];

// ================================================================ geometry (P1 frame px, head space before offset)

// the cowl's lower edge is TORN (critic pass-3 r1: a flat grey mass): ragged teeth of uneven length along the hem
const HOOD: readonly V[] = [
  [30, 82], [34, 58], [44, 36], [58, 20], [76, 9], [96, 5], [116, 8], [133, 18], [146, 31], [156, 44], [163, 52],
  [156, 56], [150, 60], [149, 82], [152, 104], [149, 118], [143, 112], [136, 124], [128, 116], [119, 127], [110, 117],
  [99, 128], [90, 119], [80, 131], [71, 118], [61, 126], [54, 115], [45, 121], [40, 108], [32, 112], [34, 98],
];
const CAVITY: readonly V[] = [
  [104, 30], [122, 30], [139, 38], [149, 53], [152, 72], [148, 92], [140, 106], [128, 112], [112, 110], [100, 94], [97, 68], [99, 44],
];
// critic pass-3 r1: an ORGANIC skull (the old one read as a TV / robot visor): a domed cranium wider than the jaw, a
// cheekbone that juts at the profile, a narrow maxilla, a separate mandible with a rounded chin
// critic r3: the skull read as a grey egg — a real PROFILE now: the brow ridge overhangs the socket, the nasal bone juts,
// the face steps back under the cheekbone, the maxilla juts again over the teeth; at the back the jaw NOTCH (the gap
// between the cranium and the jaw's hinge) breaks the oval
const SKULL: readonly V[] = [
  [108, 66], [105, 55], [109, 45], [118, 38], [130, 36], [141, 40], [147, 48], [150, 55], [146, 59], [148, 63], [152, 70],
  [149, 74], [145, 75], [147, 81], [143, 88], [119, 88], [116, 81], [112, 79], [114, 74],
];
const JAWBONE: readonly V[] = [[119, 90], [141, 90], [140, 98], [135, 103], [126, 104], [120, 99]];
const CAPE: readonly V[] = [
  [8, 144], [12, 126], [22, 110], [40, 104], [80, 108], [124, 110], [156, 112], [176, 124], [186, 144],
];
/**
 * The cage (the rig's helm, src/art/monsters-v3/grim_warden-rig.ts HELM): TWO meridian bars over the face — one over
 * the temple behind the socket, one in front of it — bowing round the skull into the crown knob, a crown (brow) ring,
 * a jaw band over the teeth and a chin band under them. The socket sits between the two bars.
 */
// critic pass-3 r1: only TWO bars (no brow ring / jaw / chin band frame), standing IN FRONT of the bone with a 1-px
// void0 shadow beside them, bolted into the jaw with a rivet at each foot
// critic r3: the two bars bracketed the face like parentheses (the "egg with a seam" read) — in this 3/4 close-up only
// the TEMPLE bar shows; the front one is behind the profile
const BARS: readonly (readonly V[])[] = [
  [[119, 92], [115, 76], [114, 60], [117, 46], [124, 31]],
];
const KNOB: V = [124, 28];
/** the eye socket centre (head space) */
const EYE: V = [133, 61];
/** fold wedges of the cowl (one value darker than the plane they lie on), converging toward the peak */
const FOLDS: readonly (readonly V[])[] = [
  [[94, 8], [88, 12], [62, 98], [72, 102]],
  [[70, 20], [64, 25], [40, 104], [49, 106]],
  [[102, 20], [97, 26], [90, 116], [99, 118]],
  [[150, 62], [148, 70], [144, 112], [150, 106]],
];
/** the cowl's back tatters: root on the hood's back edge, tip (fluttering) */
// critic r3: longer, streaming back (5 strips of uneven length, the tips flutter per frame)
const TATTERS: readonly (readonly [V, V])[] = [
  [[44, 40], [24, 62]],
  [[38, 62], [16, 92]],
  [[34, 82], [10, 116]],
  [[40, 98], [22, 134]],
  [[52, 112], [44, 142]],
];

// ================================================================ tokens
// The skull and the cage are painted with private tokens (never shown) and mapped onto the stone ramp after the
// cloth / iron re-mapping, so the bone reads PALE (stone4 / stone3 / stone2, void0 in the deepest hollows) and the
// cage DARK (stone2 lit / stone1 / stone0) — critic r1: earth bone in four bars read as carved wood in a birdcage.
const B4 = PAL.skin4;
const B3 = PAL.skin3;
const B2 = PAL.skin2;
const B1 = PAL.skin1;
const K3 = PAL.water3;
const K2 = PAL.water2;
const K1 = PAL.water1;
const TOK: Record<number, number> = {
  [B4]: PAL.stone4,
  [B3]: PAL.stone3,
  [B2]: PAL.stone2,
  [B1]: PAL.stone1,
  [K3]: PAL.stone2,
  [K2]: PAL.stone1,
  [K1]: PAL.stone0,
};

// ================================================================ helpers

const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const T = (pts: readonly V[], o: V): V[] => pts.map((p) => add(p, o));

function inPoly(pts: readonly V[], x: number, y: number): boolean {
  const px = x + 0.5;
  const py = y + 0.5;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function fillBy(p: PixelCanvas, pts: readonly V[], tone: (x: number, y: number) => number | null): void {
  let x0 = W;
  let y0 = H;
  let x1 = 0;
  let y1 = 0;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, Math.floor(x));
    y0 = Math.min(y0, Math.floor(y));
    x1 = Math.max(x1, Math.ceil(x));
    y1 = Math.max(y1, Math.ceil(y));
  }
  for (let y = Math.max(0, y0); y <= Math.min(p.h - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(p.w - 1, x1); x++) {
      if (!inPoly(pts, x, y)) continue;
      const c = tone(x, y);
      if (c !== null) p.set(x, y, c);
    }
}

/** 4-connected 1-px line; `only` filters the pixels it may paint. */
function line4(p: PixelCanvas, a: V, b: V, c: number, only?: (cur: number | null, x: number, y: number) => boolean): void {
  let x = Math.round(a[0]);
  let y = Math.round(a[1]);
  const x1 = Math.round(b[0]);
  const y1 = Math.round(b[1]);
  const dx = Math.abs(x1 - x);
  const dy = -Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let err = dx + dy;
  const put = (px: number, py: number) => {
    if (only && !only(p.get(px, py), px, py)) return;
    p.set(px, py, c);
  };
  for (let g = 0; g < 999; g++) {
    put(x, y);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
      if (e2 <= dx) put(x, y);
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function path4(p: PixelCanvas, pts: readonly V[], c: number, only?: (cur: number | null, x: number, y: number) => boolean): void {
  for (let i = 0; i + 1 < pts.length; i++) line4(p, pts[i], pts[i + 1], c, only);
}

/** `top` over `dst` with a 1-px ink contact line on `dst` round it. */
function overInk(dst: PixelCanvas, top: PixelCanvas): void {
  const marks: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (top.isOpaque(x, y) || !dst.isOpaque(x, y)) continue;
      if (top.isOpaque(x - 1, y) || top.isOpaque(x + 1, y) || top.isOpaque(x, y - 1) || top.isOpaque(x, y + 1)) marks.push(x, y);
    }
  for (let i = 0; i < marks.length; i += 2) dst.set(marks[i], marks[i + 1], PAL.ink);
  dst.blit(top, 0, 0);
}

const CLOTH: readonly number[] = [PAL.night0, PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4];
const clothDown = (c: number): number => {
  const i = CLOTH.indexOf(c);
  return i > 0 ? CLOTH[i - 1] : c;
};

// ================================================================ the portrait

const factory: CutinFactory = () => ({
  id: 'grim_warden',
  w: W,
  h: H,
  frames: POSES.length,
  fps: 10,
  accent: PAL.leaf3,
  accentDark: PAL.leaf1,
  holds: HOLDS,
  p2: 'relight',
  draw(p: PixelCanvas, frame: number, o?: DrawOpts) {
    const P = POSES[Math.max(0, Math.min(POSES.length - 1, frame))];
    const L = lightOf(o);
    const [lx, ly] = L.v2;
    const side = L.side; // −1: light at the left
    const lit = (x: number, y: number, c: V, r: number) => ((x + 0.5 - c[0]) * lx + (y + 0.5 - c[1]) * ly) / r;
    const ho = P.head;

    // ---------------------------------------------------------------- cape (shoulders, behind)
    const body = new PixelCanvas(W, H);
    fillBy(body, CAPE, (x, y) => {
      const s = lit(x, y, [96, 128], 46);
      return s > 0.5 ? PAL.stone3 : s > -0.3 ? PAL.stone2 : PAL.stone1;
    });
    // shoulder folds
    for (const [a, b] of [
      [[60, 108], [52, 144]],
      [[100, 110], [104, 144]],
      [[140, 112], [150, 144]],
    ] as const) {
      line4(body, [a[0] + side, a[1] + 2], [b[0] + side, b[1]], PAL.stone3, (c) => c === PAL.stone2);
      line4(body, a, b, PAL.night0, (c) => c === PAL.stone1);
      line4(body, a, b, PAL.stone1, (c) => c === PAL.stone2 || c === PAL.stone3);
    }

    // ---------------------------------------------------------------- the cowl
    const hood = new PixelCanvas(W, H);
    const HD = T(HOOD, ho);
    const CV = T(CAVITY, ho);
    // critic r3: 4 tone planes (a lit crown plane stone4 → stone2 after the cloth map, then stone1 / stone0 / void0)
    fillBy(hood, HD, (x, y) => {
      const s = lit(x, y, add([92, 60], ho), 52);
      return s > 0.85 && y < 60 + ho[1] ? PAL.stone4 : s > 0.42 ? PAL.stone3 : s > -0.3 ? PAL.stone2 : PAL.stone1;
    });
    // tatters off the back edge (2-px strips, the tips flutter with the frame)
    TATTERS.forEach(([root, tip], i) => {
      const k = ((P.t + i) % 3) - 1;
      const r = add(root, ho);
      const t = add(tip, [ho[0] - (P.t >= 3 ? 4 : 0), ho[1] + k * 3]);
      // a hanging strip with a forked end
      fillBy(hood, [[r[0] + 2, r[1] - 3], [t[0] - 2, t[1]], [t[0] + 1, t[1] - 4], [t[0] + 3, t[1] + 1], [r[0] + 4, r[1] + 6]], (x, y) => (lit(x, y, [t[0] + 2, t[1] - 10], 3) > 0 ? PAL.stone2 : PAL.stone1));
    });
    // fold wedges: one value darker, a 1-px lit ridge on the edge toward the light
    for (const w0 of FOLDS) {
      const w = T(w0, ho);
      const marks: number[] = [];
      fillBy(hood, w, (x, y) => {
        marks.push(x, y);
        return null;
      });
      for (let i = 0; i < marks.length; i += 2) {
        const c = hood.get(marks[i], marks[i + 1]);
        if (c !== null) hood.set(marks[i], marks[i + 1], clothDown(c));
      }
      for (let i = 0; i < marks.length; i += 2) {
        const x = marks[i] + side;
        const y = marks[i + 1];
        if (inPoly(w, x, y)) continue;
        const c = hood.get(x, y);
        if (c === PAL.stone2 || c === PAL.stone1) hood.set(x, y, c === PAL.stone2 ? PAL.stone3 : PAL.stone2);
      }
    }
    // the opening: deep void0, a 2-px stone1 inner lip (the cloth's thickness in shadow)
    fillBy(hood, CV, () => PAL.void0);
    const lip: number[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = hood.get(x, y);
        if (c === null || c === PAL.void0) continue;
        for (let d = 1; d <= 2; d++)
          if (hood.get(x + d, y) === PAL.void0 || hood.get(x - d, y) === PAL.void0 || hood.get(x, y + d) === PAL.void0 || hood.get(x, y - d) === PAL.void0) {
            lip.push(x, y, d);
            break;
          }
      }
    for (let i = 0; i < lip.length; i += 3) hood.set(lip[i], lip[i + 1], lip[i + 2] === 1 ? PAL.night0 : PAL.stone1);

    // ---------------------------------------------------------------- skull + cage (inside the opening)
    const inCav = (x: number, y: number) => inPoly(CV, x, y);
    const SK = T(SKULL, ho);
    const eye = add(EYE, ho);
    fillBy(hood, SK, (x, y) => {
      if (!inCav(x, y)) return null;
      const s = lit(x, y, add([124, 68], ho), 24);
      // critic r3: the cranium behind the temple bar sits in the hood's shadow (one tone down) — the FACE is the lit plane
      const back = x < 116 + ho[0] + (y - ho[1] - 40) * 0.05;
      if (back) return s > 0.6 ? B3 : s > -0.2 ? B2 : B1;
      return s > 0.6 ? B4 : s > 0 ? B3 : s > -0.55 ? B2 : B1;
    });
    // the mandible (a separate bone under the mouth gap)
    const JB = T(JAWBONE, ho);
    fillBy(hood, JB, (x, y) => {
      if (!inCav(x, y)) return null;
      const s = lit(x, y, add([128, 96], ho), 10);
      return y >= 101 + ho[1] ? B1 : s > 0.4 ? B3 : B2;
    });
    // the near socket (holds the eye) and the FAR socket at the profile (dark, unlit), the brow ridge over them
    hood.ellipse(eye[0] + 0.5, eye[1] + 0.5, 6.2, 5.2, PAL.void0);
    fillBy(hood, T([[142, 56], [147, 56], [148, 66], [143, 67]], ho), () => PAL.void0);
    // a B2 ring of bone sunk round the sockets (they read deep, not as holes punched in a plate), the brow arching over
    hood.ellipseRing(eye[0] + 0.5, eye[1] + 0.5, 7.4, 6.4, B2);
    // critic r3: the socket SINKS — its upper half rimmed in B1 shadow under the brow, a second B2 ring round that
    for (let a = 0; a < 48; a++) {
      const an = (a / 48) * Math.PI * 2;
      if (Math.sin(an) > 0.1) continue;
      const x = Math.round(eye[0] + 0.5 + Math.cos(an) * 7.4);
      const y = Math.round(eye[1] + 0.5 + Math.sin(an) * 6.4);
      if (hood.get(x, y) === B2) hood.set(x, y, B1);
      const x2 = Math.round(eye[0] + 0.5 + Math.cos(an) * 8.6);
      const y2 = Math.round(eye[1] + 0.5 + Math.sin(an) * 7.6);
      const c2 = hood.get(x2, y2);
      if (c2 === B3 || c2 === B4) hood.set(x2, y2, B2);
    }
    path4(hood, T([[125, 56], [128, 54], [134, 53], [139, 54], [141, 56]], ho), B4, (c, x, y) => c !== null && c !== PAL.void0 && inPoly(SK, x, y));
    // the nose notch (a dark triangle under and between the sockets)
    hood.poly(T([[140, 69], [145, 69], [143, 77]], ho), PAL.void0);
    // the temple hollow behind the socket, the hollow under the cheekbone, the cheekbone's lit ridge
    fillBy(hood, T([[110, 56], [119, 52], [123, 60], [117, 67], [110, 65]], ho), (x, y) => (inPoly(SK, x, y) ? B2 : null));
    fillBy(hood, T([[117, 76], [131, 74], [136, 82], [122, 86], [116, 82]], ho), (x, y) => (inPoly(SK, x, y) ? B1 : null));
    // the cheekbone: a short lit ridge slanting up to the profile (not a full-width line)
    path4(hood, T([[131, 72], [137, 71], [142, 70]], ho), B4, (c, x, y) => c !== null && c !== PAL.void0 && inPoly(SK, x, y));
    path4(hood, T([[131, 73], [137, 72]], ho), B3, (c, x, y) => c !== null && c !== PAL.void0 && inPoly(SK, x, y));
    // critic r3: the hollow UNDER the cheekbone (a B1 wedge stepping back to the jaw notch) so the cheek juts
    fillBy(hood, T([[128, 75], [144, 74], [141, 79], [130, 82], [118, 81]], ho), (x, y) => (inPoly(SK, x, y) && !inPoly(T([[121, 84], [143, 84], [143, 92], [121, 92]], ho), x, y) ? B1 : null));
    path4(hood, T([[128, 71], [134, 69], [140, 68], [147, 69], [151, 71]], ho), B4, (c, x, y) => c !== null && c !== PAL.void0 && inPoly(SK, x, y));
    // the mouth: THREE irregular upper teeth and a missing one (no even comb), the dark gap, two lower stumps
    const TEETH: readonly (readonly [number, number, number])[] = [
      // x0, width, length
      [121, 4, 5],
      [126, 3, 4],
      [134, 4, 6],
      [139, 3, 3],
    ];
    for (let y = 85; y <= 91; y++)
      for (let x = 119; x <= 142; x++) if (inPoly(SK, x + ho[0], y + ho[1]) || inPoly(JB, x + ho[0], y + ho[1]) || y === 89 || y === 90) hood.set(x + ho[0], y + ho[1], inCav(x + ho[0], y + ho[1]) ? PAL.void0 : hood.get(x + ho[0], y + ho[1]) ?? PAL.void0);
    for (const [tx, tw, tl] of TEETH)
      for (let y = 85; y < 85 + tl; y++)
        for (let x = tx; x < tx + tw; x++) hood.set(x + ho[0], y + ho[1], y === 85 ? B4 : x === tx + tw - 1 ? B2 : B3);
    for (const [tx, tw] of [[123, 3], [136, 3]] as const)
      for (let y = 90; y <= 92; y++) for (let x = tx; x < tx + tw; x++) hood.set(x + ho[0], y + ho[1], y === 90 ? B3 : B2);
    // the cage bars: 3 px (lit column, mid, shade) + a 1-px void0 SHADOW on the bone beside the shade column
    const cageOnly = (c: number | null, x: number, y: number) => c !== null && inCav(x, y);
    const onBone = (c: number | null, x: number, y: number) => c !== null && inCav(x, y) && (c === B4 || c === B3 || c === B2 || c === B1);
    for (const bar of BARS) {
      const b = T(bar, ho);
      path4(hood, b.map(([x, y]) => [x - side * 2, y + 1] as V), PAL.void0, onBone);
      path4(hood, b.map(([x, y]) => [x - side, y] as V), K1, cageOnly);
      path4(hood, b.map(([x, y]) => [x + side, y] as V), K3, cageOnly);
      path4(hood, b, K2, cageOnly);
      // the rivet bolting the bar's foot into the bone
      const f = b[0];
      hood.set(f[0], f[1], K3).set(f[0] - side, f[1] + 1, K1);
    }
    // the crown knob
    const kn = add(KNOB, ho);
    hood.disc(kn[0] + 0.5, kn[1] + 0.5, 3.2, PAL.steel);
    hood.set(kn[0] + side, kn[1] - 1, PAL.mist).set(kn[0] + side * 2, kn[1], PAL.mist);
    hood.set(kn[0] - side, kn[1] + 1, PAL.night3).set(kn[0] - side * 2, kn[1], PAL.night3);

    // ---------------------------------------------------------------- the near arm and the lantern
    const arm = new PixelCanvas(W, H);
    const [rx0, ry0] = P.lan;
    const hand: V = [rx0 + 2, ry0 - 12];
    // the sleeve: rising from the bottom-right corner to the wrist, a ragged bell round the wrist
    const SL: V[] = [
      [hand[0] - 2, hand[1] + 2], [hand[0] + 10, hand[1] - 2], [hand[0] + 16, hand[1] + 8], [hand[0] + 34, hand[1] + 44],
      [W + 4, H + 2], [hand[0] + 14, H + 2], [hand[0] + 12, hand[1] + 30], [hand[0] + 6, hand[1] + 22], [hand[0] + 4, hand[1] + 12],
    ];
    // critic pass-3 r2: the sleeve read as a flat slab — FOLD BANDS run down it diagonally (a dark seam with a lit
    // lip above it), and its lantern-side edge tears into tatter teeth
    fillBy(arm, SL, (x, y) => {
      const s = lit(x, y, [hand[0] + 18, hand[1] + 26], 14);
      const f = (((x - hand[0]) * 0.55 - (y - hand[1]) + 400) | 0) % 11;
      const base = s > 0.4 ? PAL.stone3 : s > -0.35 ? PAL.stone2 : PAL.stone1;
      if (y > hand[1] + 8 && f <= 1) return PAL.stone1;
      if (y > hand[1] + 8 && f === 2) return base === PAL.stone1 ? PAL.stone2 : PAL.stone3;
      return base;
    });
    // tatter teeth along the sleeve's inner (left) edge, below the wrist bell: notches of uneven depth
    for (let i = 0; i < 9; i++) {
      const ty = hand[1] + 16 + i * 7;
      if (ty >= H) break;
      let lx = -1;
      for (let x = 0; x < W; x++) if (arm.isOpaque(x, ty)) { lx = x; break; }
      if (lx < 0) continue;
      const dep = [3, 5, 2, 4, 6, 3, 5, 2, 4][i];
      for (let k = 0; k < dep; k++) for (let yy = ty - (dep - k); yy <= ty; yy++) arm.erase(lx + k, yy);
    }
    // the bone hand: four finger bones curled over the ring (stone4 lit knuckles, stone2 gaps), a thumb
    const bone = new PixelCanvas(W, H);
    for (let i = 0; i < 4; i++) {
      const fx = hand[0] - 5 + i * 3;
      const fy = hand[1] - 3 + (i === 0 || i === 3 ? 1 : 0);
      fillBy(bone, [[fx, fy], [fx + 3, fy], [fx + 3, fy + 7], [fx, fy + 7]], (x, y) => (x === fx + 2 ? B1 : y < fy + 2 ? B4 : y > fy + 5 ? B2 : B3));
    }
    fillBy(bone, [[hand[0] + 6, hand[1] - 1], [hand[0] + 12, hand[1] - 2], [hand[0] + 12, hand[1] + 4], [hand[0] + 6, hand[1] + 5]], (x, y) => (lit(x, y, [hand[0] + 9, hand[1] + 1], 3) > 0 ? B3 : B2));
    overInk(arm, bone);
    // chain: a link from the fist to the ring
    const chain = new PixelCanvas(W, H);
    chain.frame(rx0 - 1, hand[1] + 6, 3, 5, PAL.steel);
    chain.set(rx0 + side, hand[1] + 7, PAL.mist);
    // lantern iron: ring, stepped roof, brim, corner posts, foot
    const lan = new PixelCanvas(W, H);
    const top = ry0;
    const iron = (x: number, y: number, edge: number) => {
      const s = lit(x, y, [rx0, y], edge);
      return s > 0.35 ? PAL.mist : s > -0.25 ? PAL.steel : PAL.night3;
    };
    const z = P.ls;
    const NR = Math.round(7 * z);
    const BR = Math.round(17 * z);
    const GW = Math.round(15 * z);
    lan.frame(rx0 - 2, top - 2, 5, 3, PAL.steel);
    for (let i = 0; i < NR; i++) {
      const hw = 2 + i * 2;
      for (let x = rx0 - hw; x <= rx0 + hw; x++) lan.set(x, top + 1 + i, iron(x, top + 1 + i, hw + 1));
    }
    for (let x = rx0 - BR; x <= rx0 + BR; x++) {
      lan.set(x, top + NR + 1, PAL.mist);
      lan.set(x, top + NR + 2, PAL.night3);
    }
    const g0 = top + NR + 3;
    const g1 = g0 + Math.round(23 * z);
    const PW = z > 1.3 ? 3 : 2;
    for (let y = g0; y <= g1; y++) {
      for (let x = rx0 - GW; x <= rx0 + GW; x++) {
        const post = x <= rx0 - GW + PW || x >= rx0 + GW - PW;
        lan.set(x, y, post ? iron(x, y, GW) : PAL.night0); // glass placeholder (painted by the light pass)
      }
    }
    for (let x = rx0 - BR; x <= rx0 + BR; x++) {
      lan.set(x, g1 + 1, PAL.mist);
      lan.set(x, g1 + 2, iron(x, g1 + 2, BR + 1));
      lan.set(x, g1 + 3, PAL.night3);
    }
    const FW = Math.round(9 * z);
    for (let x = rx0 - FW; x <= rx0 + FW; x++) lan.set(x, g1 + 4, iron(x, g1 + 4, FW + 1));
    overInk(arm, chain);
    overInk(arm, lan);

    // ---------------------------------------------------------------- composite, rim, ink
    const out = new PixelCanvas(W, H);
    out.blit(body, 0, 0);
    // the cowl's cast shadow on the shoulders (down, away from the light)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = out.get(x, y);
        if (c === null || hood.isOpaque(x, y)) continue;
        if (hood.isOpaque(x + side * 3, y - 4)) out.set(x, y, clothDown(c));
      }
    overInk(out, hood);
    overInk(out, arm);
    // the DARK rim (void3) on the shadow side of the cloth and bone silhouette
    const outside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !out.isOpaque(x, y);
    const rimPx: number[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = out.get(x, y);
        if (c === null || !CLOTH.includes(c)) continue;
        if (outside(x - side, y) || outside(x, y + 1)) rimPx.push(x, y);
      }
    for (let i = 0; i < rimPx.length; i += 2) out.set(rimPx[i], rimPx[i + 1], PAL.void3);
    out.outline(PAL.ink);
    // onto the warden's materials (the rig's design note, docs/v3/oturum-b/grim_warden.md): the shroud one value
    // down (stone2 lit / stone1 / stone0 / void0 folds), the iron on the stone ramp (stone4 / stone3 / stone1)
    // critic pass-3 r1: the black funeral shroud of the sprite (stone1 lit / stone0 / void0 folds / ink creases)
    const CL: Record<number, number> = { [PAL.stone4]: PAL.stone2, [PAL.stone3]: PAL.stone1, [PAL.stone2]: PAL.stone0, [PAL.stone1]: PAL.void0, [PAL.night0]: PAL.ink };
    const IR: Record<number, number> = { [PAL.mist]: PAL.stone4, [PAL.steel]: PAL.stone3, [PAL.night3]: PAL.stone1 };
    out.map((c) => CL[c] ?? c);
    out.map((c) => IR[c] ?? c);
    // the skull (cool pale bone) and the cage iron (a value darker than the bone): their own tokens, mapped last
    out.map((c) => TOK[c] ?? c);

    // ---------------------------------------------------------------- the lantern's stepped green UNDERLIGHT on the cloth
    // (critic pass-3 r1: the cowl was a flat grey mass): the black shroud near the glass lifts one tone into the leaf ramp
    // in two flat rings (stone1 → leaf1 / stone0, void0 → leaf0 near; stone1 → leaf0 farther), never on the skull
    if (P.fire >= 1) {
      const lcx = rx0;
      const lcy = (g0 + g1) / 2;
      const R0 = Math.round((P.fire === 2 ? 34 : 26) * Math.sqrt(z));
      const R1 = Math.round((P.fire === 2 ? 58 : 44) * Math.sqrt(z));
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const c = out.get(x, y);
          if (c === null || lan.isOpaque(x, y) || inPoly(CV, x, y)) continue;
          const d = Math.hypot((x - lcx) * 0.9, y - lcy);
          if (d > R1) continue;
          // critic pass-3 r2: on the SLEEVE the bounce is only its 1–2 px edge facing the flame (a whole green plane
          // read as a block beside the lantern)
          if (arm.isOpaque(x, y)) {
            const tx = Math.sign(lcx - x);
            const ty = Math.sign(lcy - y);
            const edge = !arm.isOpaque(x + tx, y) || !arm.isOpaque(x, y + ty) || !arm.isOpaque(x + 2 * tx, y + 2 * ty);
            if (!edge || d > R0) continue;
          }
          if (d <= R0) {
            if (c === PAL.stone1) out.set(x, y, PAL.leaf1);
            else if (c === PAL.stone0 || c === PAL.void0) out.set(x, y, PAL.leaf0);
          } else if (c === PAL.stone1) out.set(x, y, PAL.leaf0);
        }
    }

    // ---------------------------------------------------------------- lights (never outlined)
    const dark = (c: number | null) => c === PAL.void0 || c === PAL.ink || c === PAL.stone0;
    // green cast on the lantern's side of the head (blaze): cage bars, lip, skull edges facing right
    if (P.cast) {
      const marks: number[] = [];
      for (let y = 30 + ho[1]; y < 112 + ho[1]; y++)
        for (let x = 100; x < 160; x++) {
          const c = out.get(x, y);
          if (c === null || !inCav(x, y)) continue;
          const nb = out.get(x + 1, y);
          const faces = nb === PAL.void0 || nb === PAL.ink;
          if (!faces) continue;
          if (c === PAL.stone3 || c === PAL.stone4) marks.push(x, y, PAL.leaf3);
          else if (c === PAL.stone2) marks.push(x, y, PAL.leaf2);
        }
      for (let i = 0; i < marks.length; i += 3) out.set(marks[i], marks[i + 1], marks[i + 2]);
      // critic r3: the lantern UNDERLIGHTS the skull — every bone pixel of the lower face (cheek, maxilla, teeth, jaw)
      // whose neighbour below or toward the lantern is dark catches leaf; the jaw's lower edge glows
      const under: number[] = [];
      for (let y = 66 + ho[1]; y < 108 + ho[1]; y++)
        for (let x = 104; x < 156; x++) {
          const c = out.get(x, y);
          if (c === null || !inCav(x, y)) continue;
          if (c !== PAL.stone4 && c !== PAL.stone3 && c !== PAL.stone2) continue;
          const dn = out.get(x, y + 1);
          const rt = out.get(x - side, y);
          if (dark(dn) || (dark(rt) && y > 78 + ho[1])) under.push(x, y, c === PAL.stone2 ? PAL.leaf2 : PAL.leaf3);
        }
      for (let i = 0; i < under.length; i += 3) out.set(under[i], under[i + 1], under[i + 2]);
    }
    // the eye light (critic r2: a 2-px dot on a big skull read weakly — the eye now flares to a 3×3 core with a white
    // heart, its halo floods the socket and catches the cage bars round it)
    const [ex, ey] = eye;
    if (P.eye >= 1) {
      const R1 = P.eye === 2 ? 9 : 6;
      for (let y = ey - R1; y <= ey + R1; y++)
        for (let x = ex - R1 - 2; x <= ex + R1 + 2; x++) {
          const dx = (x - ex) / (R1 + 2);
          const dy = (y - ey) / R1;
          const d = dx * dx + dy * dy;
          if (d > 1) continue;
          const c = out.get(x, y);
          if (c === null) continue;
          // the halo fills the dark socket; iron / bone edges inside it catch the light
          if (dark(c)) out.set(x, y, d < 0.3 ? PAL.leaf2 : d < 0.65 ? PAL.leaf1 : c);
          else if (d < 0.8 && (c === PAL.stone2 || c === PAL.stone1)) out.set(x, y, d < 0.4 ? PAL.leaf3 : PAL.leaf2);
        }
    }
    out.rect(ex - 2, ey - 2, 5, 4, PAL.leaf3);
    out.rect(ex - 1, ey - 1, 3, 3, PAL.leaf4);
    out.set(ex, ey, PAL.white);
    if (P.eye === 2) {
      out.set(ex - 1, ey, PAL.white).set(ex + 1, ey, PAL.white).set(ex, ey - 1, PAL.white);
      // two short scan streaks out of the socket (forward and back), 1 px, leaf3 then leaf2
      for (let i = 1; i <= 7; i++) {
        out.set(ex + 5 + i, ey, i < 4 ? PAL.leaf4 : i < 6 ? PAL.leaf3 : PAL.leaf2);
        if (i <= 4) out.set(ex - 5 - i, ey, i < 2 ? PAL.leaf3 : PAL.leaf2);
      }
    }
    // the soul fire in the glass (critic r2: no flat diamond — a real flame with tone bands, the glass glowing round
    // it in rings, the light spilling onto the cage posts)
    const cx = rx0;
    const fb = g1 - 2;
    const fh = Math.round((P.fire === 0 ? 8 : P.fire === 1 ? 14 : 20) * z);
    const fcy = fb - fh * 0.42;
    const GI = GW - PW - 1;
    for (let y = g0; y <= g1; y++)
      for (let x = rx0 - GI; x <= rx0 + GI; x++) {
        const dx = (x - cx) / GI;
        const dy = (y - fcy) / (14 * z);
        const d = Math.sqrt(dx * dx + dy * dy);
        let c: number = PAL.leaf1;
        if (P.fire >= 1 && d < 0.8) c = PAL.leaf2;
        if (P.fire === 2 && d < 0.55) c = PAL.leaf3;
        if (P.fire === 0 && d < 0.5) c = PAL.leaf2;
        out.set(x, y, c);
      }
    // the panes' frame bars catch the light on their inner edge
    for (let y = g0; y <= g1; y++) {
      const k = Math.abs(y - fcy) < 9 * z ? (P.fire === 2 ? PAL.leaf3 : PAL.leaf2) : PAL.leaf1;
      out.set(rx0 - GW + PW, y, k).set(rx0 + GW - PW, y, k);
    }
    // the flame: a teardrop that leans and licks (tip swaying per frame), outer leaf3 → leaf4 body → white heart
    const sway = [0, 1, -1, 1, 0, -1][P.t % 6];
    for (let i = 0; i < fh; i++) {
      const y = fb - i;
      const u = i / fh;
      const hw = (u < 0.35 ? 3 + u * 10 : (1 - u) * 10) * z;
      const ox = Math.round(sway * u * u * 3 * z);
      for (let x = Math.round(cx + ox - hw); x <= Math.round(cx + ox + hw); x++) {
        const e = Math.abs(x - cx - ox) / Math.max(1, hw);
        const c = P.fire === 0 ? (e < 0.5 ? PAL.leaf3 : PAL.leaf2) : e > 0.7 ? PAL.leaf3 : PAL.leaf4;
        out.set(x, y, c);
      }
    }
    if (P.fire === 2)
      for (let i = 1; i < Math.round(fh * 0.55); i++) {
        const u = i / fh;
        const ox = Math.round(sway * u * u * 3 * z);
        out.set(cx + ox, fb - i, PAL.white);
        if (i < fh * 0.35) out.set(cx + ox - side, fb - i, PAL.white);
        if (z > 1.3 && i < fh * 0.3) out.set(cx + ox + side, fb - i, PAL.white);
      }
    // a base ember row under the flame
    for (let x = cx - Math.round(4 * z); x <= cx + Math.round(4 * z); x++) out.set(x, g1, PAL.leaf3);
    // soul wisps off the roof: small flames rising, leaf3 with leaf2 tails
    for (let w = 0; w < P.wisps; w++) {
      const wx = cx - 10 + w * 10;
      const wy = top - 6 - w * 4 - (P.t % 2) * 2;
      out.rect(wx - 1, wy, 3, 3, PAL.leaf3);
      out.set(wx, wy - 1, PAL.leaf3).set(wx, wy - 2, PAL.leaf2);
      out.set(wx, wy + 1, PAL.leaf4);
      out.set(wx - 1, wy + 3, PAL.leaf2).set(wx + 1, wy + 3, PAL.leaf2).set(wx, wy + 4, PAL.leaf1);
    }
    // the eye at full flare on the push (f3): a 4-arm cross glint
    if (P.t === 3) {
      for (let i = 2; i <= 4; i++) {
        out.set(ex, ey - 1 - i, i < 4 ? PAL.leaf4 : PAL.leaf3).set(ex, ey + i, i < 4 ? PAL.leaf3 : PAL.leaf2);
      }
    }
    p.blit(out, 0, 0);
  },
});

export default factory;
