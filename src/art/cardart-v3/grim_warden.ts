// Card art v3 — Hortlak Muhafız (grim_warden, R2 "Fener Bekçisi": DARK fiend, the lantern warden).
// Style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts, spec docs/v3/YENI_KARTLAR.md §8 R2:
// "Mezarlık sisinde muhafız, feneri izleyiciye uzatmış (en parlak nokta), kafeste göz ışığı."
//
// A NATIVE drawing (no sprite crop) of the rig's character and materials (src/art/monsters-v3/grim_warden-rig.ts, its
// design note in docs/v3/oturum-b/grim_warden.md), facing right, ONE key light from the top left. Composition: a
// three-quarter figure, hunched, the hood pushed forward; the near arm thrust out at the viewer so the SOUL LANTERN
// hangs big in the right foreground (it reads closer than the head) — the "L" of the spec: the upright halberd and
// body, the horizontal arm, the lantern at its end.
//   hood     the deep grave-shroud cowl (stone2 lit crown / stone1 side / stone0 under the brow, void0 opening), a
//            ragged brim over the helm's brow, two tatters on its back edge;
//   helm     the rig's cage-helm redrawn at card density (HELM map): a PALE BONE skull (stone4 lit cranium and
//            cheekbone, stone3 bone, stone2 crevices, void0 socket / nose / tooth gaps) caged in DARK iron (two
//            meridian bars over the face, crown ring, jaw and chin bands, the nape plate, a knob) — the iron a value
//            below the bone so it reads "bone behind bars" at 1×; ONE eye light in the socket (light layer: 2×2
//            leaf4 core, leaf3 / leaf2 halo — never outlined);
//   body     the shroud falling in long planes (stone2 | stone1 | stone0 across the form, stone0 / void0 creases),
//            bleeding off the bottom edge into the mist;
//   arm      a bell sleeve with a ragged hanging underside, the bony fist (earth4 / earth3 / earth2) round a short
//            iron chain (stone3 / stone1 links), the LANTERN (LANTERN map: stone4 / stone3 / stone2 / stone1 iron —
//            ring, stepped roof, brim, two posts, foot plate) whose glass and soul fire are the light layer (leaf2
//            pane, leaf3 aura, leaf4 flame) = the picture's brightest point and its focus;
//   soul     the lantern's green bounce: the 1-px edge of every cloth / iron / bone plane that FACES the lantern
//            takes leaf1 (leaf2 close by) — the under-light on the sleeve, the cowl's lip, the robe front (the rig's
//            "soul bounce"); the floor pool under it (stepped leaf1 / leaf2, light);
//   halberd  the gravedigger's spade-halberd upright behind him in the far bone hand: earth2 / earth1 haft, an iron
//            spade with a crescent beard;
//   ground   the kit's DARK recipe: night0 / void0 sky, the eclipse (void1 → void2 → void3 corona, night0 disc)
//            framing the lantern; ink floor, void1 horizon; far graves (a headstone, a leaning cross, a slab) as
//            void1 silhouettes; graveyard mist (flat void1 / void2 lenses, unoutlined) across the shroud's foot.
// The shadow-side rim (IŞ-7) is the DARK recipe's void3, the only rim colour of the picture.
// small (44×34): the same picture drawn by hand at 1× (SMALL map): hood, cage with the eye, the arm and the lantern
// — the lantern a 7×10 block with a leaf4 flame so it stays the brightest point at 1× and in the 16×12 field mini.
// Living (6 frames × 150 ms, palette swaps + ≤ 1 px): the soul fire flickers (tip up / down, aura breathing, the
// bounce flickering with it) and the eye light scans once (one px forward in frames 3–4).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { CARD_LIGHT, ink, litEdge, paintBackdrop, patch } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type V = readonly [number, number];
const W = 88;
const H = 68;
const L = CARD_LIGHT.v2;

// ================================================================ geometry (big px)

const HORIZON = 52;
/** the lantern map's origin (top-left) and its flame centre = the focus */
const LAN_X = 59;
const LAN_Y = 35;
const LX = LAN_X + 7;
const FOCUS: V = [LX, 49];
/** the eclipse: 4 px up-left of the flame, the lantern in its dark disc, the cowl's brow against the corona */
const ECLIPSE: V = [62, 42];
const ECLIPSE_R = 27;
/** helm map origin (big px) */
const HELM_X = 37;
const HELM_Y = 12;

const HOOD: readonly V[] = [
  [17, 30], [18.4, 21], [21.4, 13.6], [26, 8.4], [32, 5.4], [38.6, 5.2], [45, 7], [50, 10.4], [54, 14.6], [56.6, 18.6],
  [54.2, 18.6], [54.6, 23], [54.8, 29], [52.6, 33.4], [46, 35.6], [36, 36.4], [26, 35.4], [19.4, 33.8],
];
/** the opening the helm sits in */
const CAVITY: readonly V[] = [
  [38.4, 13.6], [44, 11.4], [50, 12.8], [54.4, 16], [55.4, 23], [55, 28.6], [52.4, 31.4], [43, 31.6], [37.6, 29.6], [35.6, 24], [36, 17.6],
];
/** the brim: the cowl's front lip hanging over the helm's crown (drawn over the helm) */
const BRIM: readonly V[] = [
  [44, 11.4], [48, 10.6], [52.4, 12], [55.6, 14.8], [57.4, 18.6], [55.2, 18], [53, 15.4], [50, 13.6], [46.6, 13],
];
const TATTERS: readonly (readonly V[])[] = [
  [[18.6, 22], [14.6, 26], [12.6, 31.4], [16.2, 29.6], [18, 28]],
  [[17.6, 30], [13.2, 34.6], [11.6, 38.6], [15.6, 36.4], [18.6, 34]],
];
const ROBE: readonly V[] = [
  [19, 31], [30, 33.4], [42, 34.4], [50, 33], [55.6, 37], [57.4, 45], [58, 54], [60.4, 62], [61, 68],
  [14, 68], [13.4, 60], [12.6, 50], [13.6, 41], [16, 35],
];
const SLEEVE: readonly V[] = [
  [42.6, 34.6], [48, 31.4], [55, 28.8], [60.6, 27.4], [64.2, 26.8], [65.6, 32.6], [63.6, 37], [62.2, 35],
  [60.6, 41.4], [58.4, 37.6], [55.6, 44], [53.2, 39], [50, 42.6], [48.6, 38.6], [44.6, 39.6],
];
const CUFF_BACK: readonly V[] = [
  [14.6, 37], [19.6, 36], [20.4, 43.4], [15.6, 45], [13.6, 41.4],
];
const BLADE: readonly V[] = [
  [11, 4.2], [14.8, 6.8], [16.4, 11], [15.8, 15.6], [11.2, 18.4], [6.4, 15.6], [5.6, 11], [7.2, 6.8],
];
const BEARD: readonly V[] = [
  [7, 15.6], [4.6, 14.6], [3, 16.6], [3, 21], [5, 23], [6.4, 20.6], [8.6, 21.4],
];
const HAFT_X = 9;

// ---------------------------------------------------------------- hand maps

/**
 * The cage helm at card density (17×18, facing right): k knob, I iron band, b meridian bar, P nape plate, h lit bone,
 * s bone, c crevice, o socket, n nose, t tooth, g tooth gap. The socket o (3×2) holds the eye (light layer).
 */
// prettier-ignore
const HELM: readonly string[] = [
  '........kk........',
  '.......IkkI.......',
  '.....IIIbbIIII....',
  '...PIIhbhhhhbI....',
  '..PPshhbhhhhhhbI..',
  '.PPPshhbhhhhhhbhh.',
  '.PPPshhbhhhhhhbhhs',
  'PPPPsshbhhhhhsbhss',
  'PPPPsssbcccccsbsss',
  'PPPPcssbcoooocbscs',
  'PPPPcssbcoooocbccs',
  'PPPPcssbccoocsbsns',
  '.PPPccsbshhhhsbcnc',
  '.PPIIIIIIIIIIIIIII',
  '..PcttttbtttttbttI',
  '...ctgtgbgtgtgbtg.',
  '....IIIIIIIIIIIII.',
  '......IIIIIIII....',
];
/** the socket's top-left cell (map coords, 4×3) */
const SOCK: V = [9, 9];

/** The lantern (15×23): m lit iron, s iron, n shade, d deep shade, g glass (light layer), . empty. */
// prettier-ignore
const LANTERN: readonly string[] = [
  '......mnn......',
  '.....m...n.....',
  '......msn......',
  '.....mmsnn.....',
  '....mmssnnn....',
  '...mmsssnnnn...',
  '..mmssssnnnnn..',
  '.mmmssssssnnnn.',
  'mmmmmsssssnnnnn',
  'ddddddddddddddd',
  '.msgggggggggnd.',
  '.msgggggggggnd.',
  '.msgggggggggnd.',
  '.msgggggggggnd.',
  '.msgggggggggnd.',
  '.msgggggggggnd.',
  '.msgggggggggnd.',
  '.msgggggggggnd.',
  '.msgggggggggnd.',
  '.msgggggggggnd.',
  'mmmmmsssssnnnnn',
  '.ddddddddddddd.',
  '...dd.....dd...',
];
/** the bony fist round the chain's ring (knuckles up, facing right) */
// prettier-ignore
const FIST: readonly string[] = [
  '.4443..',
  '444433.',
  '4343332',
  '3_3_3_2',
  '3_3_3__',
];
const FIST_X = 63;
const FIST_Y = 26;

// ================================================================ helpers

const inPoly = (pts: readonly V[], x: number, y: number): boolean => {
  const px = x + 0.5;
  const py = y + 0.5;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** Fill `pts` with a tone chosen per pixel (flat planes: the chooser returns a band, never a blend). */
function fillBy(p: PixelCanvas, pts: readonly V[], tone: (x: number, y: number) => number | null): void {
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (!inPoly(pts, x, y)) continue;
      const c = tone(x, y);
      if (c !== null) p.set(x, y, c);
    }
}

/** A 1-px line (Bresenham), only over pixels `only` accepts. */
function line(p: PixelCanvas, a: V, b: V, c: number, only?: (cur: number | null) => boolean): void {
  let x = Math.floor(a[0]);
  let y = Math.floor(a[1]);
  const x1 = Math.floor(b[0]);
  const y1 = Math.floor(b[1]);
  const dx = Math.abs(x1 - x);
  const dy = -Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let err = dx + dy;
  for (let g = 0; g < 999; g++) {
    if (!only || only(p.get(x, y))) p.set(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/** Put `top` over `dst`: where `top`'s edge lies over matter, an ink contact line on `dst` (IŞ-9). */
function overInk(dst: PixelCanvas, top: PixelCanvas): void {
  const marks: number[] = [];
  for (let y = 0; y < dst.h; y++)
    for (let x = 0; x < dst.w; x++) {
      if (top.isOpaque(x, y) || !dst.isOpaque(x, y)) continue;
      if (top.isOpaque(x - 1, y) || top.isOpaque(x + 1, y) || top.isOpaque(x, y - 1) || top.isOpaque(x, y + 1)) marks.push(x, y);
    }
  for (let i = 0; i < marks.length; i += 2) dst.set(marks[i], marks[i + 1], PAL.ink);
  dst.blit(top, 0, 0);
}

/** Drop shadow (IŞ-6): `dst` pixels under `layer` shifted by (dx, dy), not covered by it, one step darker. */
function castShadow(dst: PixelCanvas, layer: PixelCanvas, dx: number, dy: number): void {
  const marks: number[] = [];
  for (let y = 0; y < dst.h; y++)
    for (let x = 0; x < dst.w; x++) {
      if (layer.isOpaque(x, y)) continue;
      const c = dst.get(x, y);
      if (c === null || c === PAL.ink) continue;
      if (layer.isOpaque(x - dx, y - dy)) marks.push(x, y);
    }
  for (let i = 0; i < marks.length; i += 2) dst.set(marks[i], marks[i + 1], clothDown(dst.get(marks[i], marks[i + 1])!));
}

/** the shroud's one step darker (a crease / a cast shadow) */
const clothDown = (c: number): number => (c === PAL.stone2 ? PAL.stone1 : c === PAL.stone1 ? PAL.stone0 : c === PAL.stone0 ? PAL.void0 : c);

/** a plane's tone from its position along the key light (s > hi lit, s < lo shade) */
const plane = (x: number, y: number, c: V, scale: number, hi: number, lo: number, t: readonly [number, number, number]): number => {
  const s = ((x + 0.5 - c[0]) * L[0] + (y + 0.5 - c[1]) * L[1]) / scale;
  return s > hi ? t[0] : s > lo ? t[1] : t[2];
};

// ================================================================ parts

function paintHalberd(): PixelCanvas {
  const p = new PixelCanvas(W, H);
  // haft: earth2 lit, earth1 shade
  for (let y = 18; y < H; y++) p.set(HAFT_X, y, PAL.earth2).set(HAFT_X + 1, y, PAL.earth2).set(HAFT_X + 2, y, PAL.earth1);
  // socket collar
  p.rect(HAFT_X - 1, 17, 5, 3, PAL.stone3);
  p.hline(HAFT_X - 1, HAFT_X + 2, 17, PAL.stone4);
  p.vline(HAFT_X + 3, 18, 19, PAL.stone1);
  p.hline(HAFT_X, HAFT_X + 3, 19, PAL.stone1);
  // beard (a crescent hook behind the spade): lit top, shade under
  fillBy(p, BEARD, (x, y) => (y < 17 ? PAL.stone4 : x < 5 ? PAL.stone3 : PAL.stone2));
  // spade blade: lit half stone4, shade half stone3, stone2 along the shadow edges, a ridge down the middle
  fillBy(p, BLADE, (x, y) => {
    if (!inPoly(BLADE, x + 1, y) || !inPoly(BLADE, x, y + 1)) return x < 11 && y < 12 ? PAL.stone4 : PAL.stone2;
    return x < 11 ? PAL.stone4 : PAL.stone3;
  });
  line(p, [11, 6], [11, 16], PAL.stone2, (c) => c !== null);
  return p;
}

function paintRobe(): PixelCanvas {
  const p = new PixelCanvas(W, H);
  // planes across the form on each row: lit third, mid, shadow side
  const span = new Map<number, [number, number]>();
  for (let y = 0; y < H; y++) {
    let a = -1;
    let b = -1;
    for (let x = 0; x < W; x++)
      if (inPoly(ROBE, x, y)) {
        if (a < 0) a = x;
        b = x;
      }
    if (a >= 0) span.set(y, [a, b]);
  }
  fillBy(p, ROBE, (x, y) => {
    const [a, b] = span.get(y)!;
    const t = (x - a) / Math.max(1, b - a);
    return t < 0.3 ? PAL.stone2 : t < 0.68 ? PAL.stone1 : PAL.stone0;
  });
  // long folds fanning from the shoulders: a crease one step darker, a lit ridge left of it
  const folds: readonly [V, V][] = [
    [[24, 38], [21, 68]],
    [[33, 40], [33, 68]],
    [[44, 42], [49, 68]],
  ];
  for (const [a, b] of folds) {
    line(p, [a[0] - 1, a[1] + 3], [b[0] - 1, b[1]], PAL.stone2, (c) => c === PAL.stone1);
    line(p, a, b, PAL.void0, (c) => c === PAL.stone0);
    line(p, a, b, PAL.stone0, (c) => c === PAL.stone1);
    line(p, a, b, PAL.stone1, (c) => c === PAL.stone2);
  }
  // the far cuff reaching back to the haft
  const cuff = new PixelCanvas(W, H);
  fillBy(cuff, CUFF_BACK, (x, y) => (y < 39 ? PAL.stone2 : x < 17 ? PAL.stone1 : PAL.stone0));
  overInk(p, cuff);
  return p;
}

function paintFarHand(): PixelCanvas {
  const p = new PixelCanvas(W, H);
  patch(p, ['.44.', '4433', '4332', '3332', '.32.'], { '4': PAL.earth4, '3': PAL.earth3, '2': PAL.earth2 }, HAFT_X - 1, 40);
  return p;
}

function paintHood(): PixelCanvas {
  const p = new PixelCanvas(W, H);
  const C: V = [34, 20];
  fillBy(p, HOOD, (x, y) => plane(x, y, C, 13, 0.5, -0.45, [PAL.stone2, PAL.stone1, PAL.stone0]));
  for (const t of TATTERS) fillBy(p, t, (_x, y) => (y < 28 ? PAL.stone1 : PAL.stone0));
  // fold seams down the cowl's back, one step darker than the plane they cross
  line(p, [31, 8], [24, 33], PAL.stone1, (c) => c === PAL.stone2);
  line(p, [25, 13], [21, 30], PAL.stone0, (c) => c === PAL.stone1);
  // the cowl's thickness: a fold behind the opening's back edge
  const fold: readonly V[] = [[37, 9], [33, 14], [32, 21], [33, 28], [35, 34]];
  for (let i = 0; i + 1 < fold.length; i++) line(p, fold[i], fold[i + 1], PAL.stone0, (c) => c === PAL.stone1);
  for (let i = 0; i + 1 < fold.length; i++) line(p, fold[i], fold[i + 1], PAL.stone1, (c) => c === PAL.stone2);
  fillBy(p, CAVITY, () => PAL.void0);
  // the helm in the opening
  const helm = paintHelm();
  p.blit(helm, 0, 0);
  // the brim over the helm's crown: stone1 face, a lit stone2 top run, stone0 under its edge (its shadow on the helm)
  const brim = new PixelCanvas(W, H);
  fillBy(brim, BRIM, (x, y) => (y < 13 || (x < 42 && y < 15) ? PAL.stone2 : PAL.stone1));
  castShadow(p, brim, 0, 1);
  overInk(p, brim);
  return p;
}

function paintHelm(): PixelCanvas {
  const p = new PixelCanvas(W, H);
  HELM.forEach((r, v) => {
    for (let u = 0; u < r.length; u++) {
      const ch = r[u];
      if (ch === '.') continue;
      const lit = u <= 9;
      let c: number;
      switch (ch) {
        case 'o':
        case 'g':
        case 'n':
          c = PAL.void0;
          break;
        case 't':
          c = v === 14 ? PAL.stone4 : PAL.stone3;
          break;
        case 'h':
          c = PAL.stone4;
          break;
        case 's':
          c = v <= 5 && lit ? PAL.stone4 : PAL.stone3;
          break;
        case 'c':
          c = PAL.stone2;
          break;
        case 'b':
          c = v <= 6 && lit ? PAL.stone2 : PAL.stone1;
          break;
        case 'P':
          c = v <= 6 ? PAL.stone2 : v <= 11 ? PAL.stone1 : PAL.stone0;
          break;
        case 'k':
          c = u === 7 && v === 0 ? PAL.stone4 : PAL.stone3;
          break;
        default:
          // bands: the crown ring lit on its back half, the jaw band mid, the chin band in shade
          c = v <= 2 ? (lit ? PAL.stone3 : PAL.stone2) : v >= 16 ? PAL.stone0 : lit ? PAL.stone2 : PAL.stone1;
      }
      p.set(HELM_X + u, HELM_Y + v, c);
    }
  });
  return p;
}

function paintSleeve(): PixelCanvas {
  const p = new PixelCanvas(W, H);
  fillBy(p, SLEEVE, (x, y) => {
    // the arm's top plane lit, the hanging bell mid, its underside in shade
    const top = 26.8 + ((64 - x) / 22) * 7.8;
    if (y < top + 2.6) return PAL.stone2;
    return PAL.stone1;
  });
  // a crease where the sleeve folds over the elbow
  line(p, [52, 32], [53, 38], PAL.stone0, (c) => c === PAL.stone1);
  // the bell's open mouth at the wrist (the dark inside)
  fillBy(p, [[62.4, 27.6], [64.4, 27.2], [65.2, 32], [63.4, 35.4], [62.4, 31]], () => PAL.void0);
  return p;
}

function paintFistChain(): PixelCanvas {
  const p = new PixelCanvas(W, H);
  patch(p, FIST, { '4': PAL.earth4, '3': PAL.earth3, '2': PAL.earth2 }, FIST_X, FIST_Y);
  // chain: a link face-on, one edge-on, a link face-on down to the ring
  patch(p, ['m.', 'mn', 'n.', 's.', 'sn', 'n.'], { m: PAL.stone4, s: PAL.stone3, n: PAL.stone1 }, LX - 1, FIST_Y + 5);
  return p;
}

function paintLanternIron(): PixelCanvas {
  const p = new PixelCanvas(W, H);
  const key: Record<string, number> = { m: PAL.stone4, s: PAL.stone3, n: PAL.stone2, d: PAL.stone1 };
  LANTERN.forEach((r, v) => {
    for (let u = 0; u < r.length; u++) {
      const ch = r[u];
      if (ch === '.' || ch === 'g') continue;
      p.set(LAN_X + u, LAN_Y + v, key[ch]);
    }
  });
  return p;
}

const glassAt = (x: number, y: number): boolean => LANTERN[y - LAN_Y]?.[x - LAN_X] === 'g';

/**
 * The soul bounce: matter pixels on a silhouette edge that FACES the lantern (the pixel one step toward the flame is
 * open) and within reach of it take leaf1 (leaf2 close by). `reach` breathes with the flicker.
 */
function soulBounce(fig: PixelCanvas, cx: number, cy: number, reach: number): void {
  const hits: number[] = [];
  const open = (x: number, y: number) => {
    const c = fig.get(x, y);
    return c === null || c === PAL.ink || glassAt(x, y);
  };
  for (let y = 0; y < fig.h; y++)
    for (let x = 0; x < fig.w; x++) {
      const c = fig.get(x, y);
      if (c === null || c === PAL.ink || c === PAL.void0 || glassAt(x, y)) continue;
      const dx = cx - x;
      const dy = cy - y;
      const d = Math.hypot(dx, dy);
      if (d > reach || d < 1) continue;
      // the edge's open side (sum of the open 4-neighbours' directions) must face the flame
      let nx = 0;
      let ny = 0;
      if (open(x + 1, y)) nx++;
      if (open(x - 1, y)) nx--;
      if (open(x, y + 1)) ny++;
      if (open(x, y - 1)) ny--;
      if (nx === 0 && ny === 0) continue;
      if ((nx * dx + ny * dy) / (Math.hypot(nx, ny) * d) < 0.35) continue;
      // light falls only on what the glass can see: nothing level with or above the lantern's roof on its right
      if (y < LAN_Y + 9 && x >= LAN_X - 1) continue;
      if (y > LAN_Y + 6 && x < LAN_X - 1) continue; // the robe below stays in the dark (a lit edge there reads as a vine)
      hits.push(x, y, d < reach * 0.5 ? PAL.leaf2 : PAL.leaf1);
    }
  for (let i = 0; i < hits.length; i += 3) fig.set(hits[i], hits[i + 1], hits[i + 2]);
}

// ================================================================ the whole subject (big)

function paintSubjectBig(): PixelCanvas {
  const fig = new PixelCanvas(W, H);
  fig.blit(paintHalberd(), 0, 0);
  overInk(fig, paintFarHand());
  overInk(fig, paintRobe());
  const hood = paintHood();
  castShadow(fig, hood, 1, 2);
  overInk(fig, hood);
  const sleeve = paintSleeve();
  castShadow(fig, sleeve, 0, 2);
  overInk(fig, sleeve);
  overInk(fig, paintFistChain());
  overInk(fig, paintLanternIron());
  // one-px lit edge on the shroud's light-facing silhouette (stone2 → stone3, IŞ-8): the cowl's crown, the sleeve's top
  litEdge(fig, 1, { only: (c, _x, y) => c === PAL.stone2 && y < 36 });
  // the DARK light's rim on the shroud's shadow side, on the OUTER silhouette only (contact lines are not a contour)
  outerRim(fig, PAL.void3, (c, x, y) => (c === PAL.stone2 || c === PAL.stone1 || c === PAL.stone0) && !(x < 21 && y < 40) && !(x >= LAN_X - 1 && y >= LAN_Y - 1));
  ink(fig);
  return fig;
}

/** IŞ-7 on the true outside: a matter pixel whose right / lower / lower-right neighbour is empty (not ink). */
function outerRim(fig: PixelCanvas, color: number, ok: (c: number, x: number, y: number) => boolean): void {
  const hits: number[] = [];
  const out = (x: number, y: number) => x >= 0 && y >= 0 && x < fig.w && y < fig.h && fig.get(x, y) === null;
  for (let y = 0; y < fig.h; y++)
    for (let x = 0; x < fig.w; x++) {
      const c = fig.get(x, y);
      if (c === null || c === PAL.ink || !ok(c, x, y)) continue;
      if (!(out(x + 1, y) || out(x, y + 1) || out(x + 1, y + 1))) continue;
      if (fig.get(x - 1, y) === null || fig.get(x, y - 1) === null) continue; // a 1-px sliver keeps its tone
      hits.push(x, y);
    }
  for (let i = 0; i < hits.length; i += 2) fig.set(hits[i], hits[i + 1], color);
}

let SUBJ: PixelCanvas | null = null;
const subjectBig = (): PixelCanvas => (SUBJ ??= paintSubjectBig());

/** Glass + soul fire (light layer, big): leaf2 pane, leaf3 aura round the flame, leaf4 flame; `f` flickers. */
function paintLanternBig(l: PixelCanvas, f: number): void {
  const k = f % 6;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (glassAt(x, y)) l.set(x, y, PAL.leaf2);
  const tall = k === 1 || k === 4 ? 1 : k === 3 ? -1 : 0;
  const g1 = LAN_Y + 19;
  const top = LAN_Y + 12 - tall;
  // leaf3 aura: a stepped dome round the flame (≤ 7 wide), the pane's foot row and corners stay leaf2
  const aura: readonly number[] = [0, 1, 1, 2, 2, 3, 3, 3, 3, 2];
  for (let i = 0; i < aura.length; i++) {
    const y = top - 1 + i;
    if (y >= g1) break;
    for (let x = LX - aura[i]; x <= LX + aura[i]; x++) if (glassAt(x, y)) l.set(x, y, PAL.leaf3);
  }
  // flame: a teardrop — pointed tip, a 5-wide belly, narrowing to the wick
  const rows: readonly number[] = [0, 0, 1, 1, 2, 2, 1];
  for (let i = 0; i < rows.length; i++) for (let x = LX - rows[i]; x <= LX + rows[i]; x++) if (top + i < g1) l.set(x, top + i, PAL.leaf4);
  if (k === 2 || k === 5) l.set(LX + (k === 2 ? 1 : -1), top, PAL.leaf4); // the tip licks sideways
}

/**
 * The lantern's light spilling into the graveyard (light layer, never over matter): the horizon line catches it
 * (leaf1, leaf2 nearest the lantern) and the headstone's face turned toward it takes a leaf1 edge.
 */
function paintSpill(l: ArtLayers, cx: number, hz: number, k: 1 | 2): void {
  const y = Math.round(hz / k);
  const r = Math.round(18 / k);
  const r2 = Math.round(7 / k);
  for (let x = cx - r; x <= cx + r; x++) if (!l.subject.isOpaque(x, y)) l.light.set(x, y, Math.abs(x - cx) <= r2 ? PAL.leaf2 : PAL.leaf1);
  // the headstone's lantern-side edge (its left face) and shoulder
  const hx = Math.round(76 / k);
  for (let yy = Math.round(44 / k); yy < y; yy++) if (!l.subject.isOpaque(hx, yy)) l.light.set(hx, yy, PAL.leaf1);
  if (k === 1) l.light.set(77, 43, PAL.leaf1).set(78, 42, PAL.leaf1);
}

/** Far graves on the horizon (backdrop, night0 silhouettes against the corona): a headstone, a leaning cross, a low slab. */
function paintGraves(b: PixelCanvas, k: 1 | 2): void {
  const s = (v: number) => v / k;
  const hs: readonly V[] = [[76, 52], [76, 45], [77.6, 42.6], [80, 41.6], [82.4, 42.6], [84, 45], [84, 52]];
  b.poly(hs.map(([x, y]) => [s(x), s(y)] as V), PAL.night0);
  b.rect(Math.round(s(70)), Math.round(s(48)), Math.max(1, Math.round(s(2))), Math.round(s(4)), PAL.night0);
  b.rect(Math.round(s(68)), Math.round(s(49)), Math.round(s(6)), Math.max(1, Math.round(s(2))), PAL.night0);
}

/** Graveyard mist: flat lenses (3 px at the middle, 1 px at the ends), unoutlined, after the ink. */
function paintMist(s: PixelCanvas, strands: readonly (readonly [number, number, number, number])[]): void {
  for (const [x0, x1, y, c] of strands)
    for (let x = x0; x <= x1; x++) {
      const end = Math.min(x - x0, x1 - x);
      s.set(x, y, c);
      if (end >= 4) s.set(x, y - 1, c);
      if (end >= 9) s.set(x, y + 1, c);
    }
}

/** the eye light (light layer): 2×2 leaf4 core in the socket, leaf3 behind; it slides one px forward in frames 3–4 */
function paintEyeBig(l: PixelCanvas, f: number): void {
  const dx = f % 6 === 3 || f % 6 === 4 ? 1 : 0;
  const x = HELM_X + SOCK[0] + 1 + dx;
  const y = HELM_Y + SOCK[1];
  l.set(x, y, PAL.leaf4).set(x + 1, y, PAL.leaf4).set(x, y + 1, PAL.leaf4).set(x + 1, y + 1, PAL.leaf3);
  // the halo inside the socket: leaf3 behind the core, leaf2 under it
  l.set(dx ? x - 1 : x + 2, y, PAL.leaf3);
  l.set(x - 1, y + 1, PAL.leaf2);
  l.set(x, y + 2, PAL.leaf2);
}

// ================================================================ small (44×34): drawn by hand at 1×

const FOCUS_SMALL: V = [33, 26];
// prettier-ignore
const SMALL_KEY: Readonly<Record<string, number>> = {
  k: PAL.ink, '0': PAL.stone0, '1': PAL.stone1, '2': PAL.stone2, '3': PAL.stone3, '4': PAL.stone4, a: PAL.void0,
  h: PAL.earth2, g: PAL.earth1, i: PAL.earth3, j: PAL.earth4, q: PAL.leaf1,
};
/** The small subject, drawn by hand at 1× (matter only: the outline is added by ink(); the glass is left empty). */
// prettier-ignore
const SMALL: readonly string[] = [
  '............................................',
  '............................................',
  '.....4..........2222........................',
  '....443.......22222222......................',
  '...44432.....22122222111....................',
  '...44433....2212222222222...................',
  '...44332...221222221a1111111................',
  '..444332..222122211a000011111...............',
  '.3424322..22122211a2441444130...............',
  '.322.32..222122111a234144a130...............',
  '.33.331..222111111a1331332120...............',
  '....hg...221111111a1111111110....ji.........',
  '....hg..1220111111aa14a4a41a0...jjii........',
  '....hg.01111111110aaa11111aa0..2jiih........',
  '....hg.0.1111111000aaaaaaaa2222aaih.........',
  '....hg...11111100000aaakk222222aa4..........',
  '....hg...111100000000kk22222221a11..........',
  '....hg..222222111111k22222211111.3..........',
  '....hg122222221111111k221111111.434.........',
  '...jji111022121111111k11q1111.1.432.........',
  '...jih0110221211011111kkk1k1k..44322........',
  '....ih.002221211011111aaakaka.4443322.......',
  '....hg.222221211011111a00a0aq444433222......',
  '....hg.222221211011111a00000q111111111......',
  '....hg.222221211011111a00000q43.....21......',
  '....hg.2222212110111110a0000q43.....21......',
  '....hg.2222212110111110a0000q43.....21......',
  '....hg.2222122110111110a0000q43.....21......',
  '....hg.2222122110111110a0000q43.....21......',
  '....hg.2222122110111110a0000q444433222......',
  '....hg.22221221101111100a0000.1111111.......',
  '....hg.22221221101111100a0000...............',
  '....hg.22221221101111100a0000...............',
  '....hg.22221221101111100a0000...............',
];

/** the small lantern's glass (x 31..35, y 24..28): leaf2 pane, leaf3 dome, leaf4 flame (flickers) */
function paintSmallLantern(l: PixelCanvas, f: number): void {
  const k = f % 6;
  const rows =
    k === 1 || k === 4
      ? ['23322', '23432', '34443', '34443', '23332']
      : k === 3
        ? ['22222', '22322', '34443', '34443', '23332']
        : ['22322', '23432', '34443', '34443', '23332'];
  patch(l, rows, { '2': PAL.leaf2, '3': PAL.leaf3, '4': PAL.leaf4 }, 31, 24);
}

const art: CardArtV3 = {
  id: 'grim_warden',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 6,
  holdMs: 150,
  big(l: ArtLayers, f: number) {
    paintBackdrop(l.backdrop, 'DARK', { focus: ECLIPSE, radius: ECLIPSE_R, horizon: HORIZON });
    paintGraves(l.backdrop, 1);
    const fig = subjectBig().clone();
    const k = f % 6;
    soulBounce(fig, LX, 47, k === 1 || k === 4 ? 23 : k === 3 ? 20 : 22);
    l.subject.blit(fig, 0, 0);
    paintMist(l.subject, [
      [2, 34, 62, PAL.void1],
      [28, 62, 65, PAL.void1],
    ]);
    paintSpill(l, LX + 2, HORIZON, 1);
    paintLanternBig(l.light, f);
    paintEyeBig(l.light, f);
  },
  small(l: ArtLayers, f: number) {
    paintBackdrop(l.backdrop, 'DARK', { focus: ECLIPSE, radius: ECLIPSE_R, horizon: HORIZON });
    paintGraves(l.backdrop, 2);
    patch(l.subject, SMALL, SMALL_KEY, 0, 0);
    outerRim(l.subject, PAL.void3, (c, x, y) => (c === PAL.stone2 || c === PAL.stone1 || c === PAL.stone0) && x > 9 && x < 29 && y < 30);
    ink(l.subject);
    paintMist(l.subject, [
      [1, 16, 31, PAL.void1],
      [14, 30, 32, PAL.void1],
    ]);
    paintSpill(l, 34, HORIZON, 2);
    paintSmallLantern(l.light, f);
    // the eye: one leaf4 pixel, leaf3 behind it (it slides one px forward in frames 3–4)
    const dx = f % 6 === 3 || f % 6 === 4 ? 1 : 0;
    l.light.set(24 + dx, 9, PAL.leaf4).set(25 - dx, 9, PAL.leaf3);
  },
};

export default art;
