// Card art v3 — Hortlak Muhafız (grim_warden, R2 "Fener Bekçisi": DARK fiend, the lantern warden).
// Style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts, spec docs/v3/YENI_KARTLAR.md §8 R2:
// "Mezarlık sisinde muhafız, feneri izleyiciye uzatmış (en parlak nokta), kafeste göz ışığı."
//
// A NATIVE drawing (no sprite crop; the same character and materials as the rig's design note in
// docs/v3/oturum-b/grim_warden.md), facing right, ONE key light from the top left:
//   hood     a tall grave-shroud cowl (stone2 lit, stone1 side, stone0 under the brow, a stone3 1-px lit edge), its
//            opening a void0 cavity;
//   helm     inside it the iron cage-helm: three bars bowing round the skull into a crown knob, a cheek ring (iron =
//            stone4 lit / stone3 / stone1 shadow column), the skull's bone (earth3 / earth2) behind the bars, a row of
//            earth4 teeth, and ONE eye light between two bars (light layer: leaf4 core, leaf3 under — never outlined);
//   body     the shroud falling in long folds (stone2 | stone1 | stone0 planes across the form, void0 / stone0
//            creases), a tattered front and back hem;
//   arm      the "L": the near arm held straight out in a bell sleeve with a ragged underside, a bone hand (earth4 /
//            earth3 / earth2), a short iron chain and the SOUL LANTERN — iron roof, corner posts and foot (subject),
//            its glass and the soul fire (light layer: leaf2 glass, leaf3 round the flame, leaf4 flame) = the
//            picture's brightest point and the focus;
//   halberd  the gravedigger's spade-halberd upright behind him in the far bone hand: earth2 / earth1 haft, an iron
//            spade blade with a crescent beard;
//   ground   the kit's DARK recipe: night0 / void0 sky, the eclipse (void1 → void2 → void3 corona, night0 disc) centred
//            between the cowl and the lantern so the lantern glows in the darkest disc and the cowl's front reads
//            against the corona; ink floor, void1 horizon; far graves (a headstone, a leaning cross) as void1
//            silhouettes on the horizon; the lantern's stepped green pool on the floor (light layer); graveyard mist
//            (flat void1 lenses, unoutlined) across the hem.
// The shadow-side rim (IŞ-7) is the DARK recipe's void3 (the only rim colour of the picture).
// small (44×34): the same picture drawn by hand at 1× (SMALL map): cowl, cage, eye, the arm and the
// lantern — the lantern a 5×6 block with a 2-px leaf4 flame so it is still the brightest point at 1×
// and in the 16×12 field mini (where it survives as one bright green cell next to the cowl).
// Living (6 frames × 150 ms, palette swaps + ≤ 1 px): the soul fire flickers (flame tip up / down, the
// leaf3 / leaf4 core breathing) and the eye light scans once (it slides one px between two bars).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { CARD_LIGHT, ink, litEdge, paintBackdrop, patch, recolor, rim, steppedEllipse } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type V = readonly [number, number];
const W = 88;
const H = 68;
const L = CARD_LIGHT.v2;

// ================================================================ geometry (big px)

const HORIZON = 52;
/** the lantern's flame centre: the focus */
const FOCUS: V = [69, 48];
/** the eclipse: behind the cowl's front, the lantern inside its dark disc */
const ECLIPSE: V = [58, 31];
const ECLIPSE_R = 30;
/** the lantern's centre column and its glass panes (big px) */
const LX = 69;

const HOOD: readonly V[] = [
  [19.4, 21], [21.4, 14.2], [24.6, 9.8], [29, 7], [35.6, 6.2], [42.6, 8], [47.6, 11.6], [51.8, 16.4], [55.6, 21.8],
  [53.2, 22.8], [51.8, 26], [52, 32.6], [48, 37.4], [37, 38.4], [27, 37.6], [19, 35.6], [16.8, 28.4],
];
const CAVITY: readonly V[] = [
  [39.6, 13.8], [45.6, 14.2], [50, 18.6], [50.6, 25], [50.2, 31.6], [45.6, 35.6], [40, 35], [37.2, 28], [37, 20],
];
const SKULL: readonly V[] = [
  [38.6, 33.6], [38, 27], [38.8, 21.4], [41.4, 17.6], [44, 16.2], [47.2, 17.8], [49.6, 21.4], [50.6, 25], [50, 29.4], [48.8, 33.6],
];
const ROBE: readonly V[] = [
  [18, 33], [28, 33], [42, 35], [52, 37], [55.4, 45], [57.4, 54], [60.6, 61.4], [57.2, 62.6], [61, 68],
  [14, 68], [12.2, 62], [15, 60.6], [11.8, 53.4], [15.2, 52], [13.2, 44.6], [16.4, 43.6], [16.2, 37],
];
const SLEEVE: readonly V[] = [
  [43, 35.4], [52, 33.2], [60, 31.6], [66.4, 30.4], [67.4, 36], [63, 37.6], [61.6, 43.4], [58.8, 40.6],
  [56.4, 46.4], [53.6, 41.6], [50.4, 44.6], [49, 39.8], [44.6, 40],
];
const CUFF_BACK: readonly V[] = [
  [13.6, 38.6], [18.6, 37.4], [19.6, 44], [15, 45.4], [13, 42.4],
];
const BLADE: readonly V[] = [
  [14, 6], [17.8, 8.8], [19.8, 13], [19.2, 17], [14.6, 19.6], [9.8, 17.2], [8.4, 13], [10.4, 8.8],
];
const BEARD: readonly V[] = [
  [10.6, 17.6], [8.2, 16.2], [6.2, 18.2], [6.2, 22], [8.4, 23.6], [9.8, 21.6], [12, 22.4],
];
const HAFT_X = 12;

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

/** A 4-connected 1-px line, only over opaque pixels when `onOpaque`. */
function line4(p: PixelCanvas, a: V, b: V, c: number, only?: (cur: number | null) => boolean): void {
  let x = Math.floor(a[0]);
  let y = Math.floor(a[1]);
  const x1 = Math.floor(b[0]);
  const y1 = Math.floor(b[1]);
  const dx = Math.abs(x1 - x);
  const dy = -Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let err = dx + dy;
  const put = (px: number, py: number) => {
    if (only && !only(p.get(px, py))) return;
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

/** Drop shadow (IŞ-6): `dst` pixels under `layer` shifted by (dx, dy), not covered by it, set to `to(c)`. */
function castShadow(dst: PixelCanvas, layer: PixelCanvas, dx: number, dy: number, to: (c: number) => number): void {
  const marks: number[] = [];
  for (let y = 0; y < dst.h; y++)
    for (let x = 0; x < dst.w; x++) {
      if (layer.isOpaque(x, y)) continue;
      const c = dst.get(x, y);
      if (c === null || c === PAL.ink) continue;
      if (layer.isOpaque(x - dx, y - dy)) marks.push(x, y);
    }
  for (let i = 0; i < marks.length; i += 2) dst.set(marks[i], marks[i + 1], to(dst.get(marks[i], marks[i + 1])!));
}

/** the cloth's one step darker (a crease / a cast shadow on the shroud) */
const clothDown = (c: number): number => (c === PAL.stone2 ? PAL.stone1 : c === PAL.stone1 ? PAL.stone0 : c === PAL.stone0 ? PAL.void0 : c);

/**
 * The parts are drafted in working tones and moved onto the warden's materials (shared with the rig's design note,
 * docs/v3/oturum-b/grim_warden.md): shroud stone2 lit / stone1 / stone0 / void0 folds; iron (cage, spade, chain,
 * lantern) stone4 / stone3 / stone1; bone (skull, hands) earth4 / earth3 / earth2; haft earth2 / earth1.
 */
const CLOTH_MAP: Readonly<Record<number, number>> = { [PAL.stone3]: PAL.stone2, [PAL.stone2]: PAL.stone1, [PAL.stone1]: PAL.stone0, [PAL.night0]: PAL.void0 };
const IRON_MAP: Readonly<Record<number, number>> = { [PAL.mist]: PAL.stone4, [PAL.steel]: PAL.stone3, [PAL.night3]: PAL.stone1 };
const BONE_MAP: Readonly<Record<number, number>> = { [PAL.stone4]: PAL.earth4, [PAL.stone3]: PAL.earth3, [PAL.stone2]: PAL.earth2 };
const remap = (p: PixelCanvas, m: Readonly<Record<number, number>>): PixelCanvas => recolor(p, m);

// ================================================================ parts

function paintHalberd(): PixelCanvas {
  const p = new PixelCanvas(W, H);
  // haft: earth2 lit column + body, earth1 on the shadow side (leans 1 px over its height)
  for (let y = 20; y < H; y++) {
    const x = HAFT_X + (y > 44 ? 0 : 1);
    p.set(x, y, PAL.earth2).set(x + 1, y, PAL.earth2).set(x + 2, y, PAL.earth1);
  }
  // socket collar
  p.rect(12, 19, 5, 3, PAL.steel);
  p.hline(12, 16, 19, PAL.mist);
  p.vline(16, 20, 21, PAL.night3);
  p.hline(13, 16, 21, PAL.night3);
  // beard (a crescent behind the spade, toward the back)
  fillBy(p, BEARD, (x, y) => (y < 18.6 || x < 7.4 ? PAL.mist : x < 9.6 ? PAL.steel : PAL.night3));
  // spade blade: lit half mist, shadow half steel, night3 along the shadow edge, a night3 ridge
  fillBy(p, BLADE, (x, y) => {
    if (!inPoly(BLADE, x + 1, y) || !inPoly(BLADE, x, y + 1)) return x < 14 && y < 15 ? PAL.mist : PAL.night3;
    return x < 14 ? PAL.mist : PAL.steel;
  });
  line4(p, [14, 9], [14, 17], PAL.night3, (c) => c !== null);
  return p;
}

function paintRobe(): PixelCanvas {
  const p = new PixelCanvas(W, H);
  // span of the robe on each row → planes across the form (lit third, mid, shadow side)
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
    return t < 0.27 ? PAL.stone3 : t < 0.66 ? PAL.stone2 : PAL.stone1;
  });
  // long folds: creases fanning from the shoulders (one step darker), a lit ridge left of each
  const folds: readonly [V, V][] = [
    [[24, 40], [20, 68]],
    [[33, 42], [32, 68]],
    [[43, 44], [48, 68]],
  ];
  for (const [a, b] of folds) {
    line4(p, [a[0] - 1, a[1] + 3], [b[0] - 1, b[1]], PAL.stone3, (c) => c === PAL.stone2);
    line4(p, a, b, PAL.night0, (c) => c === PAL.stone1);
    line4(p, a, b, PAL.stone1, (c) => c === PAL.stone2 || c === PAL.stone3);
  }
  // back cuff (the far arm reaching to the haft)
  const cuff = new PixelCanvas(W, H);
  fillBy(cuff, CUFF_BACK, (x, y) => (y < 40 ? PAL.stone3 : x < 16 ? PAL.stone2 : PAL.stone1));
  overInk(p, cuff);
  return p;
}

function paintFarHand(): PixelCanvas {
  const p = new PixelCanvas(W, H);
  // four knuckles wrapped round the haft, bone: stone4 tops, stone3 under
  patch(p, ['.44.', '4433', '4333', '3332', '.33.'], { '4': PAL.stone4, '3': PAL.stone3, '2': PAL.stone2 }, 10, 40);
  return p;
}

function paintHood(): PixelCanvas {
  const p = new PixelCanvas(W, H);
  const C: V = [34, 21];
  fillBy(p, HOOD, (x, y) => {
    const s = ((x + 0.5 - C[0]) * L[0] + (y + 0.5 - C[1]) * L[1]) / 14;
    return s > 0.42 ? PAL.stone3 : s > -0.38 ? PAL.stone2 : PAL.stone1;
  });
  fillBy(p, CAVITY, () => PAL.void0);
  // the cowl's lip round the opening: a 2-px band, lit on its upper / back run, stone1 under the chin
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = p.get(x, y);
      if (c === null || c === PAL.void0) continue;
      let near = false;
      for (let d = 1; d <= 1 && !near; d++) near = p.get(x + d, y) === PAL.void0 || p.get(x, y + d) === PAL.void0 || p.get(x - d, y) === PAL.void0 || p.get(x, y - d) === PAL.void0;
      if (!near) continue;
      p.set(x, y, PAL.stone1);
    }
  // fold seams down the cowl's back (one step darker than the plane they cross)
  line4(p, [30, 9], [24, 33], PAL.stone2, (c) => c === PAL.stone3);
  line4(p, [24, 14], [21, 30], PAL.stone1, (c) => c === PAL.stone2);
  // the cowl's thickness: a fold following the opening's back edge, 3 px behind it
  const fold: readonly V[] = [[38, 9], [35, 13], [34, 19], [34, 27], [36, 33]];
  for (let i = 0; i + 1 < fold.length; i++) line4(p, fold[i], fold[i + 1], PAL.stone1, (c) => c === PAL.stone2 || c === PAL.stone3);
  remap(p, CLOTH_MAP);
  const cav = (x: number, y: number) => p.get(x, y) === PAL.void0;
  // ---- the skull in the cage (faces right): stone2 bone, a lit stone3 cheek and crown on the light's
  // side, stone1 under the cheek line; a void0 socket (the eye light sits in it) and nose hole
  fillBy(p, SKULL, (x, y) => (!cav(x, y) || y < 18 ? null : y > 28 ? PAL.void0 : x < 43 && y < 27 && y > 19 ? PAL.earth3 : PAL.earth2));
  for (let y = 21; y <= 23; y++) for (let x = 44; x <= 47; x++) if (p.get(x, y) !== null && !(y === 23 && x === 47)) p.set(x, y, PAL.void0);
  p.set(49, 25, PAL.void0).set(49, 26, PAL.void0);
  p.set(41, 24, PAL.earth4).set(42, 24, PAL.earth4);
  const face = new Set<number>([PAL.void0, PAL.earth2, PAL.earth3, PAL.earth4]);
  // ---- the cage helm in the cavity: three bars converging into a pointed crown like a bird cage
  // (steel lit, night3 shadow column on the right), a mist knob at the crown
  const bars: readonly (readonly V[])[] = [
    [[39, 32], [38.6, 27], [39.4, 22], [41.4, 18.4], [43, 16.6]],
    [[43, 17], [43, 32]],
    [[48, 32], [48.4, 27], [47.8, 22], [46.2, 18.6], [44.4, 16.6]],
  ];
  for (const path of bars)
    for (let i = 0; i + 1 < path.length; i++) {
      line4(p, path[i], path[i + 1], PAL.stone3, (c) => face.has(c ?? -1));
      line4(p, [path[i][0] + 1, path[i][1]], [path[i + 1][0] + 1, path[i + 1][1]], PAL.stone1, (c) => face.has(c ?? -1));
    }
  // the near bar's lit run and the crown knob
  for (let y = 18; y <= 25; y++) for (let x = 38; x <= 41; x++) if (p.get(x, y) === PAL.stone3) p.set(x, y, PAL.stone4);
  p.set(43, 15, PAL.stone4).set(44, 15, PAL.stone3).set(43, 16, PAL.stone3).set(44, 16, PAL.stone1);
  // a ring round the cage at the cheek line (steel, night3 under)
  for (let x = 38; x <= 49; x++) {
    if (face.has(p.get(x, 27) ?? -1) && inPoly(CAVITY, x, 27)) p.set(x, 27, x < 41 ? PAL.stone4 : PAL.stone3);
    if (face.has(p.get(x, 28) ?? -1) && inPoly(CAVITY, x, 28)) p.set(x, 28, PAL.stone1);
  }
  // the skull's bone jaw under the cage: a lit stone4 row of teeth over stone3, gaps of void0
  for (let x = 38; x <= 48; x++) {
    if (inPoly(CAVITY, x, 32) && p.get(x, 32) !== PAL.stone3) p.set(x, 32, PAL.earth4);
    if (inPoly(CAVITY, x, 33) && p.get(x, 33) !== PAL.stone3) p.set(x, 33, x % 3 === 1 ? PAL.void0 : PAL.earth3);
  }
  return p;
}

function paintSleeve(): PixelCanvas {
  const p = new PixelCanvas(W, H);
  fillBy(p, SLEEVE, (x, y) => {
    // top plane lit, the hanging bell mid, its inside / underside in shadow
    const top = 30.4 + ((66 - x) / 23) * 5; // the arm's top line falls toward the shoulder
    if (y < top + 2.4) return PAL.stone3;
    if (y < top + 5.6) return PAL.stone2;
    return PAL.stone1;
  });
  return p;
}

function paintHand(): PixelCanvas {
  const p = new PixelCanvas(W, H);
  // the near bone hand closed round the chain's ring, knuckles up
  patch(p, ['.44..', '4443.', '44333', '.3332', '..32.'], { '4': PAL.stone4, '3': PAL.stone3, '2': PAL.stone2 }, 66, 29);
  // chain: a vertical link, a link seen edge-on, a vertical link
  patch(p, ['s', 'n', 's', 'n'], { s: PAL.steel, n: PAL.night3 }, LX, 34);
  return p;
}

function paintLanternIron(): PixelCanvas {
  const p = new PixelCanvas(W, H);
  // ring, stepped roof, brim; corner posts; foot plate — mist top edge, steel lit left, night3 shadow right
  patch(
    p,
    [
      '.....mn......', // 38 ring
      '....msnn.....', // 39
      '...mssnnn....', // 40
      '..msssnnnn...', // 41
      '.mssssnnnnn..', // 42
      'mmmssssnnnnnn', // 43 brim
      'm...........n', // 44 posts
      'm...........n', // 45
      'm...........n', // 46
      's...........n', // 47
      's...........n', // 48
      's...........n', // 49
      's...........n', // 50
      's...........n', // 51
      's...........n', // 52
      'mssssssnnnnnn', // 53 foot plate
      '.ssssssnnnnn.', // 54
      '...sssnnnn...', // 55
    ],
    { m: PAL.mist, s: PAL.steel, n: PAL.night3 },
    LX - 6,
    38,
  );
  return p;
}

// ================================================================ the whole subject (big)

function paintSubjectBig(): PixelCanvas {
  const fig = new PixelCanvas(W, H);
  fig.blit(remap(paintHalberd(), IRON_MAP), 0, 0);
  overInk(fig, remap(paintFarHand(), BONE_MAP));
  overInk(fig, remap(paintRobe(), CLOTH_MAP));
  const hood = paintHood();
  castShadow(fig, hood, 1, 2, clothDown);
  overInk(fig, hood);
  const sleeve = remap(paintSleeve(), CLOTH_MAP);
  castShadow(fig, sleeve, 0, 2, clothDown);
  overInk(fig, sleeve);
  overInk(fig, remap(remap(paintHand(), BONE_MAP), IRON_MAP));
  overInk(fig, remap(paintLanternIron(), IRON_MAP));
  // one-px lit edge on the shroud's light-facing silhouette (stone2 → stone3, IŞ-8)
  litEdge(fig, 1, { only: (c, x, y) => c === PAL.stone2 && y < 46 });
  // the DARK light's rim on the shadow side of the shroud (the iron, bone and haft keep their own edges)
  rim(fig, PAL.void3, { skip: [PAL.stone4, PAL.stone3, PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4, PAL.void0], only: (x, y) => !(x >= LX - 7 && y >= 36 && y <= 57) && !(x < 21 && y < 25) });
  ink(fig);
  return fig;
}

/** Glass + soul fire (light layer, big): leaf2 panes, leaf3 round the flame, leaf4 flame; `f` flickers. */
function paintLanternBig(l: PixelCanvas, f: number): void {
  const k = f % 6;
  for (let y = 44; y <= 52; y++) for (let x = LX - 5; x <= LX + 5; x++) l.set(x, y, PAL.leaf2);
  const tall = k === 1 || k === 4 ? 1 : k === 3 ? -1 : 0;
  const top = 46 - tall;
  // leaf3 aura round the flame: a stepped dome widening down to the foot
  for (let y = top - 1; y <= 52; y++)
    for (let x = LX - 4; x <= LX + 4; x++) {
      const dx = Math.abs(x - LX);
      const dy = y - (top - 1);
      if (dx <= 1 + Math.floor(dy / 2)) l.set(x, y, PAL.leaf3);
    }
  // flame: tip, then 3 wide, a 5-wide belly, back to 3 at the wick
  const rows: readonly number[] = [0, 1, 1, 2, 2, 1];
  for (let i = 0; i < rows.length; i++) for (let x = LX - rows[i]; x <= LX + rows[i]; x++) l.set(x, top + i, PAL.leaf4);
  if (k === 2 || k === 5) l.set(LX, top - 1, PAL.leaf4); // a lick above the tip
  // the wick
  l.set(LX, 52, PAL.leaf3);
}

function paintPool(l: PixelCanvas, subject: PixelCanvas, cx: number, cy: number, rx: number, ry: number, step: number): void {
  const pool = new PixelCanvas(l.w, l.h);
  steppedEllipse(pool, cx, cy, rx, ry, [PAL.leaf1, PAL.leaf2], step);
  for (let y = 0; y < l.h; y++)
    for (let x = 0; x < l.w; x++) {
      const c = pool.get(x, y);
      if (c !== null && !subject.isOpaque(x, y)) l.set(x, y, c);
    }
}

/** Far graves on the horizon (backdrop, void1 silhouettes): a headstone and a leaning cross. */
function paintGraves(b: PixelCanvas, k: 1 | 2): void {
  const s = (v: number) => Math.round(v / k);
  // headstone (big px) at the right, behind the lantern's pool
  const hs: readonly V[] = [[76, 52], [76, 46], [77.6, 43.6], [80, 42.6], [82.4, 43.6], [84, 46], [84, 52]];
  b.poly(hs.map(([x, y]) => [x / k, y / k] as V), PAL.void1);
  // a leaning cross further left of it
  b.thickLine(s(30), s(52), s(31), s(43), Math.max(1, 2 / k), PAL.void1);
  b.thickLine(s(27), s(46), s(34), s(45), Math.max(1, 2 / k), PAL.void1);
}

/** Graveyard mist: flat void1 lenses (3 px at the middle, 1 px at the ends) drifting across the hem (unoutlined, after the ink). */
function paintMist(s: PixelCanvas, strands: readonly (readonly [number, number, number])[]): void {
  for (const [x0, x1, y] of strands)
    for (let x = x0; x <= x1; x++) {
      const end = Math.min(x - x0, x1 - x);
      s.set(x, y, PAL.void1);
      if (end >= 4) s.set(x, y - 1, PAL.void1);
      if (end >= 9) s.set(x, y + 1, PAL.void1);
    }
}

// ================================================================ small (44×34): drawn by hand at 1×

/** The small picture's focus (the flame) in SMALL px, its lantern column and its eye. */
const FOCUS_SMALL: V = [35, 25];
// prettier-ignore
const SMALL_KEY: Readonly<Record<string, number>> = {
  k: PAL.ink, t: PAL.stone3, L: PAL.stone2, M: PAL.stone1, D: PAL.stone0, a: PAL.void0, d: PAL.void3,
  i: PAL.stone4, j: PAL.stone3, n: PAL.stone1, B: PAL.earth4, b: PAL.earth3, c: PAL.earth2, h: PAL.earth2, e: PAL.earth1,
};
// prettier-ignore
const SMALL: readonly string[] = [
  '............................................',
  '............................................',
  '............................................',
  '.......i......tttttt........................',
  '......iij....tLLLLLLLM......................',
  '.....iinjj..tLLLLLLMMMM.....................',
  '.....iinjn.tLLLLLLMMDDDM....................',
  '.....iinjn.LLLLLLMDaajaDM...................',
  '...ii.inn.tLLLLLLMDaaijnaDM.................',
  '...ij.jjn.LLLLLMMDaiajajaDM.................',
  '...ij.ijn.LLLLMMMDaicjaajaDM................',
  '....n.he..LLLMMMMDaibjaajaD.................',
  '......he..LLMMMMMDajcjccjc..................',
  '......he..LMMMMMMDaijjjjjj..................',
  '......he..LMMMMMDDanajaaja........BB........',
  '......he..MMMMMDDDajajaajd....LLLBBb........',
  '......he..MMMMDDDDDBBaBBaLLLLLLLLbbbc.......',
  '......he.LLkkkkkkkkkkkLLLMMMMMMMM.bc........',
  '......heLLLLLMMMMMMMDDMMMMDDDDDDD..j........',
  '......hLLLLLLMMMMMMMDDDDDDDDDDD....n........',
  '.....BBLMMLLLLMMMMMMDDDDDDDDDD.....in.......',
  '.....BbeDDLLLLMMMMMMDDDDDDDdD.....ijnn......',
  '.....bbe.LLLLLMMMMMMDDDDDDDd....iijjnnn.....',
  '......heLLLLLLMMMMMMDDDDDDDd....jaaaaan.....',
  '......heLLLLLLMMMMMMMDDDDDDd....jaaaaan.....',
  '......heLLLLLLMMMMMMMDDDDDDDd...jaaaaan.....',
  '......heLLLLLLMMMMMMMDDDDDDDd...jaaaaan.....',
  '......he.LLLLLLMMMMMMDDDDDDDd...jaaaaan.....',
  '......heLLLLLLMMMMMMMMDDDDDDd...ijjjnnn.....',
  '......heLLLLLLMMMMMMMDDDDDDd......jnn.......',
  '......heLLLLLLMMMMMMMMDDDDDDDd..............',
  '......heLLLLLLMMMMMMMMDDDDDDDd..............',
  '......he.LLLLLLMMMMMMMMDDDDDDDd.............',
  '......heLLLLLLMMMMMMMMMDDDDDDDd.............',
];

function paintSmallLantern(l: PixelCanvas, f: number): void {
  const k = f % 6;
  const rows = k === 1 || k === 4 ? ['22422', '23432', '34443', '33433', '23332'] : k === 3 ? ['22222', '22322', '23432', '34443', '23332'] : ['22322', '23432', '34443', '33433', '23332'];
  const key: Record<string, number> = { '2': PAL.leaf2, '3': PAL.leaf3, '4': PAL.leaf4 };
  patch(l, rows, key, 33, 23);
}

let SUBJ: PixelCanvas | null = null;
const subjectBig = (): PixelCanvas => (SUBJ ??= paintSubjectBig());

/** the eye light (light layer): leaf4 core, leaf3 below and behind it; it scans one px in frames 3–4 */
function paintEye(l: PixelCanvas, f: number, x: number, y: number): void {
  const dx = f % 6 === 3 || f % 6 === 4 ? -1 : 0;
  l.set(x + dx, y, PAL.leaf4).set(x + dx + 1, y, PAL.leaf4);
  l.set(x + dx, y + 1, PAL.leaf3).set(x + dx + 1, y + 1, PAL.leaf3);
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
    l.subject.blit(subjectBig(), 0, 0);
    paintMist(l.subject, [
      [8, 36, 62],
      [42, 64, 65],
      [70, 82, 58],
    ]);
    paintPool(l.light, l.subject, LX, 59, 14, 3, 6);
    paintLanternBig(l.light, f);
    paintEye(l.light, f, 44, 22);
  },
  small(l: ArtLayers, f: number) {
    paintBackdrop(l.backdrop, 'DARK', { focus: ECLIPSE, radius: ECLIPSE_R, horizon: HORIZON });
    paintGraves(l.backdrop, 2);
    patch(l.subject, SMALL, SMALL_KEY, 0, 0);
    ink(l.subject);
    paintMist(l.subject, [
      [4, 18, 31],
      [21, 31, 32],
    ]);
    paintPool(l.light, l.subject, LX, 59, 14, 3, 6);
    paintSmallLantern(l.light, f);
    // the eye: one leaf4 pixel, leaf3 behind it (scans one px back in frames 3–4)
    const dx = f % 6 === 3 || f % 6 === 4 ? -1 : 0;
    l.light.set(23 + dx, 11, PAL.leaf4).set(22 + dx, 11, PAL.leaf3);
  },
};

export default art;
