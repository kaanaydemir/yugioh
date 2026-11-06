// Card art v3 — Uçurum Büyücüsü (abyss_magus, 6★ DARK spellcaster): the v3 sprite's own pixels, 1:1, in a card pose
// (style sheet docs/v3/KART_RESIMLERI.md §5 — the approved-still monsters keep the board's pixels, never scaled;
// contract ./_types.ts). Wired as the v3 card-face picture by src/art/cardart-v3/lane-e.ts and, under V3_CARDS, by
// src/art/monsters-v3/abyss_magus.ts (`portrait`); tests/e/abyss_magus-card.test.ts holds the kit budgets and the
// 1× read (lead, brightOff, value order, the horned helm cut against the lit corona, white on the visor only).
//
// The pose is the sprite's victory call (src/art/monsters-v3/abyss_magus-anims.ts, victory f3) without its floor ring and
// star burst: the staff thrust up with the orb high, the free hand raised with a void flame, the cloak flung back — the
// magus summoning the abyss. Drawn by the sprite's own rig (drawMagus), so card and board show the same character.
//
// Value plan (the 1× read; KART_RESIMLERI §3 / §4 "canavar ışığın önünde durur"): the full DARK eclipse rings the HEAD
// tight — night0 disc behind the helm, a 3-px void3 ring, void2 and void1 steps outside it — and cardLight() relights
// the sprite for the card: the horns go one step DOWN their void ramp, so the horned silhouette cuts dark across the
// lit ring; the helm's steel / mist planes stay the lightest broad shape and stand on the night0 disc; the face under
// the visor drops to night0 / ink, so the white visor and the pink eye (the focus) are the hottest pixels. The cloak sail
// and the robe go one step down (the head wins the value order), the pauldron keeps one mist glint (the one cool,
// non-violet accent besides the eye). The void3 rim is lit only where the helm stands in front of the corona.
// The signature (what says "Uçurum"): an abyss rift opening in the floor at the magus' feet — ink chasm, void1 far wall,
// void2 lips, flat bands (recipe tones only) — in both sizes, the ground cue the two pictures share.
//
// big (88×68)   the figure from the horn tips to the knees (1:1 — the sprite is never enlarged, §5), the eclipse ringing
//               the horned helm, the void flame (asymmetric, a split tongue) on the raised palm at the left and the caged
//               orb at the right; ink floor with the void1 horizon and the rift running out of the bottom-right corner.
// small (44×34) the SAME picture, closer (§1 route 1): a 1:1 crop of the SAME pose (same staff angle) on the horned helm,
//               the pauldrons, the top of the tabard and the caged orb (2 px of sky above and right of the cage); the
//               horizon and the rift's near end come up behind the bust as the ground cue. Hand corrections at 1× / ×6
//               (shots/e/abyss_magus/r3/): despeckle(), the hand-made fleck map HAND_FIX (patch), unchecker().
// Light layer (never outlined): the void flame (big), the orb's heart, three motes (big), the eye's mag glint (small).
// Living (6 frames × 140 ms, A5_PLAN §3.7.6): palette swaps and ≤ 2 px moves — the flame licks, the orb's heart beats,
// the motes spiral in, the eye glints. Frame 0 (the still every in-game face shows today) has the orb's heart at its peak.
// Colours only from PAL (the rig and the kit).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { OX, OY, drawMagus, eyePoint, gripPoint, orbCenter, pose, type Pose } from '../monsters-v3/abyss_magus-rig';
import { framePose } from '../monsters-v3/abyss_magus-anims';
import { BACKDROPS, paintBackdrop, patch, px, recolor, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type V = readonly [number, number];

const FRAMES = 6;

/** The staff's grip x (v1 frame px): the victory pose's 57 brought 2 px nearer (same angle), so the cage has sky
 * on both sides of it in the closer crop. */
const STAFF_GX = 55;
/** The raised free hand's x (v1 frame px): the victory pose's 21 thrust 3 px further out, so its flame burns on the
 * open sky beside the corona instead of over its rings. */
const HAND_BX = 18;

/** The card pose (both sizes): victory f3 (staff up, void flame raised, cloak flung back), without its floor ring and star burst. */
const POSE: Pose = pose({ ...framePose('victory', 3), aura: 0, star: 0, t: 0, gx: STAFF_GX, bx: HAND_BX });

function sprite(): PixelCanvas {
  const p = new PixelCanvas(112, 116);
  drawMagus(p, POSE, 'left');
  cardLight(p);
  return p;
}

/** Sprite-frame → picture crops (1:1, frame px of the picture's top-left). */
const BIG_CROP: V = [4, 10];
const SMALL_CROP: V = [35, 14];

const sub = (a: V, c: V): V => [Math.round(a[0]) - c[0], Math.round(a[1]) - c[1]];

/** The near eye (the focus) in each picture's own px. */
const EYE = eyePoint(POSE);
const FOCUS = sub(EYE, BIG_CROP);
const FOCUS_SMALL = sub(EYE, SMALL_CROP);

/**
 * The eclipse rings the HEAD tight, centred just behind the visor: the night0 disc holds the helm, the 3-px void3
 * ring runs through both horns (they cut dark across it) and past the helm's crown and cheek. Radii are picture px
 * (the sprite is 1:1 in both sizes, so the ring hugs the same head): disc, void3, void2, void1 outer edges.
 */
const ECLIPSE_C: V = [EYE[0], EYE[1] - 3];
const RADII_BIG = [12, 15, 18, 21] as const;
const RADII_SMALL = [12, 15, 17, 19] as const;

/**
 * The hand pass of the 44×34 picture (KART_RESIMLERI §1 route 3: the subject dumped as an ASCII map at ×6 and
 * corrected by hand, then stamped with patch()). Keys as asciiMap writes them: k ink, 5–9 night0–4, s steel,
 * 0–4 void0–4. '.' leaves the pixel, '_' erases it.
 */
const HAND_KEY: Readonly<Record<string, number>> = {
  k: PAL.ink,
  '5': PAL.night0,
  '6': PAL.night1,
  '7': PAL.night2,
  '8': PAL.night3,
  '9': PAL.night4,
  s: PAL.steel,
  m: PAL.mist,
  '0': PAL.void0,
  '1': PAL.void1,
  '2': PAL.void2,
  '3': PAL.void3,
};
const HAND_FIX: readonly (readonly [number, number, string])[] = [
  // the lone sparkles in the sky (one above-left of the cage, one right of it) and an ink fleck on the left edge go
  [25, 8, '_'],
  [40, 8, '_'],
  [0, 6, '_'],
  // the brow's single mag spill joins the brim (the eye's pink is the face's only colour)
  [16, 14, '3'],
];

function handFix(p: PixelCanvas): void {
  for (const [x, y, ch] of HAND_FIX) patch(p, [ch], HAND_KEY, x, y);
  // the last row runs under the card's dark bezel: it repeats the row above, so the bezel never hides a fleck
  for (let x = 0; x < p.w; x++) {
    const c = p.get(x, p.h - 2);
    if (c === null) p.erase(x, p.h - 1);
    else p.set(x, p.h - 1, c);
  }
}

/** Light tones the card rim (void3) never covers: the orb's heart, the eyes, the gem, glints. */
const KEEP: readonly number[] = [PAL.void4, PAL.white, PAL.mist, PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag4];

// ================================================================ the light layer

/**
 * The void flame on the raised palm: an asymmetric 7×10 tongue — a round mist-hearted belly, the body leaning back
 * (left, away from the corona) into a licking tip, and a split tongue peeling off on the right. Tops and bellies
 * alternate per frame (≤ 2 px moves). a void3 skin, b void4 body, c mist heart (it burns one step hotter than the
 * corona's rings beside it; white stays the visor's).
 */
const FLAME_TOP: readonly (readonly string[])[] = [
  ['a......', 'aa...a.', '.a..aa.', '.ab.a..'],
  ['.a.....', 'aa....a', '.a...a.', '.abaa..'],
  ['.......', 'a....a.', 'aa..aa.', '.ab.a..'],
  ['a......', 'aa..a..', '.a..a..', '.abaa..'],
  ['.a.....', '.a...a.', 'aa...a.', '.abaa..'],
  ['.......', 'aa...a.', '.a..aa.', '.ab.a..'],
];
const FLAME_BELLY: readonly (readonly string[])[] = [
  ['.abba..', 'abcba..', 'abccba.', 'abccba.', '.abba..', '..aa...'],
  ['.abba..', 'abccba.', 'abcba..', 'abccba.', '.abba..', '..aa...'],
];
const FLAME_KEY: Readonly<Record<string, number>> = { a: PAL.void3, b: PAL.void4, c: PAL.mist };

function flame(p: PixelCanvas, baseX: number, baseY: number, f: number): void {
  const rows = [...FLAME_TOP[f % FLAME_TOP.length], ...FLAME_BELLY[f % 2]];
  for (let j = 0; j < rows.length; j++)
    for (let i = 0; i < rows[j].length; i++) {
      const c = FLAME_KEY[rows[j][i]];
      if (c !== undefined) p.set(baseX - 3 + i, baseY - rows.length + 1 + j, c);
    }
}

/** The orb's heart (2×2 at its centre), strongest on frame 0 (the still every face shows): void4 → half → void3 … */
function orbHeart(p: PixelCanvas, cx: number, cy: number, f: number): void {
  const beat = [2, 1, 0, 0, 1, 2][f % FRAMES];
  p.rect(cx - 1, cy, 2, 2, beat === 0 ? PAL.void3 : PAL.void4);
  if (beat === 1) p.hline(cx - 1, cx, cy + 1, PAL.void3);
}

/** Three motes falling into the orb, each on its own spiral (offsets from the orb's centre), one step a frame. */
const MOTES: readonly (readonly V[])[] = [
  [[-11, -6], [-10, -7], [-8, -8], [-7, -8], [-6, -7], [-12, -5]],
  [[9, -10], [8, -8], [9, -6], [10, -5], [11, -8], [10, -11]],
  [[2, 12], [4, 11], [6, 10], [7, 8], [1, 13], [0, 13]],
];

function motes(p: PixelCanvas, sub: PixelCanvas, cx: number, cy: number, f: number, n: number): void {
  for (let m = 0; m < n; m++) {
    const path = MOTES[m];
    const [dx, dy] = path[(f + m * 2) % path.length];
    const near = Math.abs(dx) + Math.abs(dy) < 15;
    if (sub.get(cx + dx, cy + dy) !== null) continue;
    p.set(cx + dx, cy + dy, near ? PAL.void4 : PAL.void3);
  }
}

/** The eye's glint: the pink eye's far pixel flares mag4 on two frames of the six (a palette swap, 1 px). */
function eyeGlint(p: PixelCanvas, eye: V, f: number): void {
  if (f === 2 || f === 3) p.set(eye[0] + 5, eye[1], PAL.mag4);
}

// ================================================================ the hand correction (small)

/** Tones the hand pass never touches: the eyes, the gem, the orb's heart and the metal's one glint. */
const PROTECT: readonly number[] = [PAL.ink, PAL.white, PAL.mist, PAL.void4, PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag4];

/**
 * The hand pass of the 44×34 crop (KART_RESIMLERI §1: a crop is corrected for 1×): a 1-px fleck INSIDE the matter (all four
 * neighbours opaque and not ink) that matches none of them reads as noise at 1× — it takes the tone most of its
 * neighbours share (ties: the darker plane, so a fleck never brightens a shadow). Silhouette, outline and the glints stay.
 */
function despeckle(p: PixelCanvas): void {
  const fix: [number, number, number][] = [];
  for (let y = 1; y < p.h - 1; y++)
    for (let x = 1; x < p.w - 1; x++) {
      const c = p.get(x, y);
      if (c === null || PROTECT.includes(c)) continue;
      const nb = [p.get(x + 1, y), p.get(x - 1, y), p.get(x, y + 1), p.get(x, y - 1)];
      if (nb.some((n) => n === null || n === PAL.ink || n === c)) continue;
      const votes = new Map<number, number>();
      for (const n of nb) votes.set(n!, (votes.get(n!) ?? 0) + 1);
      let best = -1;
      let bestN = 0;
      for (const [t, k] of votes)
        if (k > bestN || (k === bestN && luma(t) < luma(best))) {
          best = t;
          bestN = k;
        }
      if (bestN >= 2) fix.push([x, y, best]);
    }
  for (const [x, y, c] of fix) p.set(x, y, c);
}

/**
 * The second hand pass: a 2×2 checkerboard in the finished picture reads as dither at 1× (§8, §10 ≤ 0.5 %). In this
 * crop they are the sprite's 1-px ink stairs (staff cage, sleeve, collar) and the orb's 1-px crescent diagonal. A stair
 * gets its corner filled (the matter's pixel of the pair, else the backdrop's, turns ink: an L instead of a diagonal);
 * a two-tone diagonal (the orb) takes the step down-right of it in the upper tone (a 2-px-wide crescent).
 */
function unchecker(l: ArtLayers): void {
  const at = (x: number, y: number) => l.light.get(x, y) ?? l.subject.get(x, y) ?? l.backdrop.get(x, y);
  for (let y = 0; y + 1 < l.subject.h; y++)
    for (let x = 0; x + 1 < l.subject.w; x++) {
      const a = at(x, y);
      const b = at(x + 1, y);
      if (a === null || b === null || a === b || at(x, y + 1) !== b || at(x + 1, y + 1) !== a) continue;
      const cells: [number, number][] = a === PAL.ink ? [[x + 1, y], [x, y + 1]] : b === PAL.ink ? [[x, y], [x + 1, y + 1]] : [];
      if (!cells.length) {
        if (l.subject.get(x + 1, y + 1) !== null && !PROTECT.includes(a)) l.subject.set(x + 1, y + 1, b);
        continue;
      }
      if (cells.some(([cx, cy]) => l.light.get(cx, cy) !== null)) continue;
      const own = cells.filter(([cx, cy]) => {
        const c = l.subject.get(cx, cy);
        return c !== null && !PROTECT.includes(c);
      });
      const [fx, fy] = own.length ? own.sort((p, q) => luma(l.subject.get(p[0], p[1])!) - luma(l.subject.get(q[0], q[1])!))[0] : cells[0];
      l.subject.set(fx, fy, PAL.ink);
    }
}

function luma(c: number): number {
  if (c < 0) return Infinity;
  return ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;
}

// ================================================================ the card light (both sizes)

/**
 * The card's value plan (KART_RESIMLERI §3 / §4), palette steps only, on the sprite before the crop (sprite frame px).
 * The sprite is lit for the arena, where every part sits in the same light; on the card:
 *   - the horns go one step DOWN their void ramp: a dark horned silhouette that cuts across the lit void3 ring;
 *   - the helm's slate planes go one step up (night3 → night4 → steel; its mist plane stays): the lightest broad shape;
 *   - the face under the visor drops to night0, the cheek guards one step: the visor and the eye pop;
 *   - the cloak sail and the robe go one step down (they never compete with the head), the tabard's sigil keeps
 *     one void3 cross (its white centre drops to void4); the breastplate's steel one step down;
 *   - white is the visor's alone: every other glint takes mist (the pauldron's steel glint: the cool accent) or void4.
 */
const HORN_DOWN: Readonly<Record<number, number>> = {
  [PAL.void0]: PAL.night0,
  [PAL.void1]: PAL.night0,
  [PAL.void2]: PAL.night1,
};
const HELM_UP: Readonly<Record<number, number>> = {
  [PAL.night3]: PAL.night4,
  [PAL.night4]: PAL.steel,
};
const FACE_DOWN: Readonly<Record<number, number>> = {
  [PAL.night1]: PAL.night0,
  [PAL.night2]: PAL.night1,
  [PAL.night3]: PAL.night2,
};
const CLOTH_DOWN: Readonly<Record<number, number>> = {
  [PAL.void2]: PAL.void1,
  [PAL.void3]: PAL.void2,
  [PAL.void4]: PAL.void3,
  [PAL.white]: PAL.void4,
  [PAL.night3]: PAL.night2,
  [PAL.night4]: PAL.night3,
  [PAL.steel]: PAL.night4,
};
const VOID_DOWN: Readonly<Record<number, number>> = {
  [PAL.void2]: PAL.void1,
  [PAL.void3]: PAL.void2,
};
const BREAST_DOWN: Readonly<Record<number, number>> = {
  [PAL.steel]: PAL.night4,
  [PAL.mist]: PAL.steel,
};

function cardLight(spr: PixelCanvas): void {
  const [ex, ey] = EYE;
  const grip = gripPoint(POSE)[0];
  const staff = (x: number) => Math.abs(x - grip) <= 3;
  const headBox = (x: number, y: number) => y >= ey - 16 && y < ey && x >= ex - 24 && x <= ex + 8 && x < grip - 3;
  // the horns (every void tone of the head box) down, the helm's slate up
  recolor(spr, HORN_DOWN, headBox);
  recolor(spr, HELM_UP, (x, y) => headBox(x, y) && x >= ex - 6);
  // the face under the visor and the cheek guards beside it
  recolor(spr, FACE_DOWN, (x, y) => y >= ey && y <= ey + 7 && x >= ex - 9 && x <= ex + 5);
  // the cloak sail (left of the robe) and the robe below the pauldrons, except the staff and its fist
  recolor(spr, CLOTH_DOWN, (x, y) => !staff(x) && ((y >= ey + 14 && x <= ex - 7) || y >= ey + 21));
  // the sleeves and the robe's lit panel between the pauldrons and the belt: their void one step down too
  recolor(spr, VOID_DOWN, (x, y) => !staff(x) && y >= ey + 9 && y < ey + 21 && !(y >= ey + 14 && x <= ex - 7));
  // the breastplate under the pauldrons: its steel plane and glint one step down (the chest is not a second focus)
  recolor(spr, BREAST_DOWN, (x, y) => y >= ey + 13 && y < ey + 21 && x > ex - 7 && x < grip - 3);
  // white is the visor's alone
  recolor(spr, { [PAL.white]: PAL.mist }, (x, y) => (y < ey - 1 || y > ey + 1) && x <= grip - 3);
  recolor(spr, { [PAL.white]: PAL.void4 }, (x, y) => (y < ey - 1 || y > ey + 1) && x > grip - 3);
}

// ================================================================ the backdrop (both sizes)

/** The DARK recipe's sky, floor and horizon (the light shape is the tight eclipse below, painted by hand). */
const DARK = BACKDROPS.DARK;

/** The eclipse: void1 → void2 → void3 stepped rings and the night0 disc, centred at (cx, cy) in picture px. */
function eclipse(p: PixelCanvas, c: V, radii: readonly number[]): void {
  const tones = [PAL.night0, PAL.void3, PAL.void2, PAL.void1];
  for (let i = radii.length - 1; i >= 0; i--) p.disc(c[0] + 0.5, c[1] + 0.5, radii[i], tones[i]);
}

/**
 * The abyss rift (the card's signature): the floor splits open at the staff's foot and the chasm widens out of the
 * picture's bottom-right corner toward the viewer. Rows as [y, x0, x1] (picture px, hand-set stairs, the far side
 * notched). The wall that faces the viewer (the right side of a crack running away up-left) is lit by the glow below:
 * a 2-px void1 band under its void2 lip; the near side is a void2 lip; between them the ink depth.
 */
const RIFT_BIG: readonly (readonly [number, number, number])[] = [
  [49, 64, 65],
  [50, 64, 67],
  [51, 64, 68],
  [52, 65, 67],
  [53, 65, 70],
  [54, 66, 72],
  [55, 66, 71],
  [56, 67, 74],
  [57, 66, 76],
  [58, 67, 75],
  [59, 68, 77],
  [60, 68, 80],
  [61, 69, 79],
  [62, 70, 82],
  [63, 69, 84],
  [64, 70, 83],
  [65, 71, 85],
  [66, 72, 87],
  [67, 71, 87],
];
const RIFT_SMALL: readonly (readonly [number, number, number])[] = [
  [30, 34, 36],
  [31, 34, 39],
  [32, 35, 41],
  [33, 35, 43],
];

function rift(p: PixelCanvas, rows: readonly (readonly [number, number, number])[]): void {
  for (const [y, x0, x1] of rows)
    for (let x = x0; x <= x1; x++) p.set(x, y, x === x0 || x === x1 ? PAL.void2 : x >= x1 - 2 ? PAL.void1 : PAL.void0);
  // the far lip: the crack's first row is lip all along
  const [y, x0, x1] = rows[0];
  p.hline(x0, x1, y, PAL.void2);
}

function backdrop(p: PixelCanvas, horizon: number, c: V, radii: readonly number[], rows: readonly (readonly [number, number, number])[]): void {
  paintBackdrop(p, DARK, { shape: false, horizon });
  eclipse(p, c, radii);
  // the floor and the horizon come back over the eclipse's lower steps (the light stands behind the ground)
  const y0 = px(p, horizon);
  for (let y = y0; y < p.h; y++) p.hline(0, p.w - 1, y, DARK.floor);
  p.hline(0, p.w - 1, y0, DARK.horizonLine);
  rift(p, rows);
}

// ================================================================ the two sizes

/** The rim (void3) is lit only where the helm stands in front of the corona: its back edge, above the shoulders. */
function helmRim(c: V, x0: number, y1: number): (x: number, y: number) => boolean {
  return (x, y) => y <= y1 && x >= x0 && Math.hypot(x - c[0], y - c[1]) <= 15;
}

function big(l: ArtLayers, f: number): void {
  const c = sub(ECLIPSE_C, BIG_CROP);
  backdrop(l.backdrop, ART_HORIZON_BIG, c, RADII_BIG, RIFT_BIG);
  const spr = sprite();
  l.subject.blit(spr.crop(BIG_CROP[0], BIG_CROP[1], 88, 68), 0, 0);
  despeckle(l.subject);
  rim(l.subject, PAL.void3, { skip: KEEP, only: helmRim(c, FOCUS[0] - 2, FOCUS[1] + 2) });
  const [ox, oy] = sub(orbCenter(POSE), BIG_CROP);
  // the raised free hand: the flame stands on its palm (the sprite's own 3-px flame is under it)
  const hand = sub([POSE.bx + OX + POSE.dx, POSE.by + OY + POSE.bob - 4], BIG_CROP);
  flame(l.light, hand[0], hand[1], f);
  orbHeart(l.light, ox, oy, f);
  motes(l.light, l.subject, ox, oy, f, 3);
}

const ART_HORIZON_BIG = 48;
/** The small's horizon (big px: small row 30): a closer crop of the same ground, cheated up behind the bust. */
const ART_HORIZON_SMALL = 60;

function small(l: ArtLayers, f: number): void {
  const c = sub(ECLIPSE_C, SMALL_CROP);
  backdrop(l.backdrop, ART_HORIZON_SMALL, c, RADII_SMALL, RIFT_SMALL);
  const spr = sprite();
  l.subject.blit(spr.crop(SMALL_CROP[0], SMALL_CROP[1], 44, 34), 0, 0);
  despeckle(l.subject);
  rim(l.subject, PAL.void3, { skip: KEEP, only: helmRim(c, FOCUS_SMALL[0] - 2, FOCUS_SMALL[1] + 2) });
  handFix(l.subject);
  const [ox, oy] = sub(orbCenter(POSE), SMALL_CROP);
  orbHeart(l.light, ox, oy, f);
  eyeGlint(l.light, FOCUS_SMALL, f);
  unchecker(l);
}

const art: CardArtV3 = {
  id: 'abyss_magus',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: FRAMES,
  holdMs: 140,
  big,
  small,
};

export default art;
