// Card art v3 — Uçurum Büyücüsü (abyss_magus, 6★ DARK spellcaster): the v3 sprite's own pixels, 1:1, in a card pose
// (style sheet docs/v3/KART_RESIMLERI.md §5 — the approved-still monsters keep the board's pixels, never scaled;
// contract ./_types.ts). Wired as the v3 card-face picture by src/art/cardart-v3/lane-e.ts and, under V3_CARDS, by
// src/art/monsters-v3/abyss_magus.ts (`portrait`); tests/e/abyss_magus-card.test.ts holds the kit budgets and the
// 1× read (lead, brightOff, value order, a corona under the subject's lit planes, white on the visor only).
//
// The pose is the sprite's victory call (src/art/monsters-v3/abyss_magus-anims.ts, victory f3) without its floor ring and
// star burst: the staff thrust up with the orb high, the free hand raised with a void flame, the cloak flung back — the
// magus summoning the abyss. Drawn by the sprite's own rig (drawMagus), so card and board show the same character.
//
// Value plan (the 1× read; KART_RESIMLERI §3 value order): cardLight() relights the sprite for the card — the key light
// falls on the HEAD (horn bands and helm planes one ramp step up: the horned helm is the lightest broad shape), the
// breastplate and the robe one step down into shadow, and white stays on the visor alone (the visor + the pink eye are
// the hottest pixels: the focus). The eclipse is the DARK recipe one step quiet (void0 → void1 → void2 corona, night0
// disc) centred on the head, so every lit plane of the subject — and its void3 rim — sits above the corona's
// brightest tone; the rim is lit by the corona only (the hem and robe below fall into plain shadow).
//
// big (88×68)   the figure from the horn tips to the knees (1:1 — the sprite is never enlarged, §5), the eclipse ringing
//               the horned helm, the void flame at the left and the caged orb at the right as void4-hearted secondary
//               lights; ink floor with a void1 horizon and the light's pool.
// small (44×34) the SAME picture, closer (§1 route 1): a 1:1 crop on the horns, the helm, the pauldrons and the caged orb.
//               The staff stands upright, a px nearer and 6 px higher so the whole cage stands above the eye line with
//               open sky between visor and shaft (§2 lead); the raised hand keeps only the sprite's own small flame (the
//               orb is the one secondary light). Hand corrections at 1× / ×6 (shots/e/abyss_magus/r1/): despeckle(), the
//               hand-made fleck map HAND_FIX (patch), unchecker() (no 2×2 checkers at 1×).
// Light layer (never outlined): the void flame (big, a hand-drawn 7×12 teardrop), the orb's heart, three motes (big).
// Living (6 frames × 140 ms, A5_PLAN §3.7.6): palette swaps and ≤ 2 px moves — the flame licks, the orb's heart beats,
// the motes spiral in. Frame 0 (the still every in-game face shows today) has the orb's heart at its peak.
// Colours only from PAL (the rig and the kit).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { OX, OY, drawMagus, eyePoint, gripPoint, orbCenter, pose, type Pose } from '../monsters-v3/abyss_magus-rig';
import { framePose } from '../monsters-v3/abyss_magus-anims';
import { BACKDROPS, paintBackdrop, patch, recolor, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type V = readonly [number, number];

const FRAMES = 6;

/** The hand version's staff (v1 frame px: grip x / y) and its crop's top-left (sprite frame px). */
const SMALL_GX = 55;
const SMALL_GY = 29;
const SMALL_X = 28;
const SMALL_Y = 9;

/** The card pose: victory f3 (staff up, void flame raised, cloak flung back), without its floor ring and star burst. */
function cardPose(o: Partial<Pose> = {}): Pose {
  return pose({ ...framePose('victory', 3), aura: 0, star: 0, t: 0, ...o });
}

const POSE_BIG = cardPose();
/**
 * The hand version's correction: the staff upright, 1 px nearer and raised 6 px, so the whole caged orb stands
 * ABOVE the eye line beside the horn tips — open sky between the visor and the shaft (§2 "başın önünde hava"); the
 * raised hand keeps only the sprite's own small flame (the orb is the picture's one secondary light).
 */
const POSE_SMALL = cardPose({ gx: SMALL_GX, gy: SMALL_GY, sa: 0 });

function sprite(o: Pose): PixelCanvas {
  const p = new PixelCanvas(112, 116);
  drawMagus(p, o, 'left');
  return p;
}

/** Sprite-frame → picture crops (1:1, frame px of the picture's top-left). */
const BIG_CROP: V = [4, 10];
const SMALL_CROP: V = [SMALL_X, SMALL_Y];

const sub = (a: V, c: V): V => [Math.round(a[0]) - c[0], Math.round(a[1]) - c[1]];

/** The near eye (the focus) in each picture's own px. */
const FOCUS = sub(eyePoint(POSE_BIG), BIG_CROP);
const FOCUS_SMALL = sub(eyePoint(POSE_SMALL), SMALL_CROP);

/**
 * The eclipse frames the HEAD (horns + helm), not the eye: centred on the head's middle, its dark disc wide enough
 * that the whole horned helm stands on night0 and the corona runs in open sky around it (only the horn tips touch
 * its inner step). Backdrop geometry is in big px (the small canvas halves it).
 */
const HEAD_BIG: V = [FOCUS[0] - 5, FOCUS[1] - 6];
const BIG_R = 32;
const HEAD_SMALL: V = [(FOCUS_SMALL[0] - 5) * 2, (FOCUS_SMALL[1] - 6) * 2];
const SMALL_R = 40;

/**
 * The hand pass of the 44×34 picture (KART_RESIMLERI §1 route 3: the subject dumped as an ASCII map at ×6 and
 * corrected by hand, then stamped with patch()). Keys as asciiMap writes them: k ink, 5–9 night0–4, s steel,
 * 0–4 void0–4, c mag1. '.' leaves the pixel, '_' erases it. Each fix is a 1-px fleck that read as grit at ×6 and
 * as mush at 1×:
 *   - the lone sparkles in the sky (above the cage, beside the horn) go;
 *   - the long horn's lit edge is 2 px wide over its last four rows (a 1-px void4 diagonal broke into dots),
 *     the short horn's the same over two;
 *   - the cage prong tips, the orb's lowest row, the helm's side edge, the brow (its single mag1 spill goes:
 *     the eye's mag is the face's only colour), the cheek's lit edge (one night4 column), the collar and the
 *     staff's first shadow pixel join their planes;
 *   - the last row runs under the card's dark bezel (y 33): it repeats row 32, so the bezel never hides a fleck.
 */
const HAND_KEY: Readonly<Record<string, number>> = {
  k: PAL.ink,
  '7': PAL.night2,
  '8': PAL.night3,
  '9': PAL.night4,
  s: PAL.steel,
  '2': PAL.void2,
  '3': PAL.void3,
  '4': PAL.void4,
};
const HAND_FIX: readonly (readonly [number, number, string])[] = [
  [37, 1, '_'],
  [29, 7, '_'],
  [32, 3, '8'],
  [42, 3, '8'],
  [2, 9, '4'],
  [3, 10, '4'],
  [4, 11, '4'],
  [9, 8, '4'],
  [36, 11, '2'],
  [20, 15, '3'],
  [25, 16, 's'],
  [38, 16, '3'],
  [12, 17, '2'],
  [23, 19, '3'],
  [14, 21, '9'],
  [14, 22, '9'],
  [18, 26, '8'],
  [16, 27, '8'],
  [26, 29, 'k'],
];

function handFix(p: PixelCanvas): void {
  for (const [x, y, ch] of HAND_FIX) patch(p, [ch], HAND_KEY, x, y);
  for (let x = 0; x < p.w; x++) {
    const c = p.get(x, p.h - 2);
    if (c === null) p.erase(x, p.h - 1);
    else p.set(x, p.h - 1, c);
  }
}

/** Light tones the card rim (void3) never covers: the orb's heart, the eyes, the gem, glints. */
const KEEP: readonly number[] = [PAL.void4, PAL.white, PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag4];

// ================================================================ the light layer

/** The void flame: a 5×9 teardrop, base on the raised palm. a void2 skin, b void3 body, c void4 core, w white heart. */
const FLAME: readonly (readonly string[])[] = [
  ['...a...', '...a...', '..aa...', '..aba..', '.abba..', '.abcba.', 'abccba.', 'abcwcba', 'abcwcba', '.abcba.', '..bcb..', '...b...'],
  ['....a..', '...a...', '...aa..', '..aba..', '..abba.', '.abcba.', 'abccba.', 'abccwba', 'abcwcba', '.abcba.', '..bcb..', '...b...'],
  ['.......', '...a...', '...a...', '..aba..', '..abba.', '.abcba.', '.abccba', 'abcwcba', 'abcwcba', '.abcba.', '..bwb..', '...b...'],
  ['..a....', '..a....', '..aa...', '..aba..', '.abba..', '.abcba.', 'abccba.', 'abwccba', 'abcwcba', '.abcba.', '..bcb..', '...b...'],
  ['...a...', '...aa..', '...aa..', '..aba..', '..abba.', '.abcba.', '.abccba', 'abcwcba', 'abccwba', '.abcba.', '..bcb..', '...b...'],
  ['.......', '..a....', '..aa...', '..aba..', '.abba..', '.abcba.', 'abccba.', 'abcwcba', 'abcwcba', '.abwba.', '..bcb..', '...b...'],
];
const FLAME_KEY: Readonly<Record<string, number>> = { a: PAL.void2, b: PAL.void3, c: PAL.void3, w: PAL.void4 };

function flame(p: PixelCanvas, baseX: number, baseY: number, f: number): void {
  const rows = FLAME[f % FLAME.length];
  const half = rows[0].length >> 1;
  for (let j = 0; j < rows.length; j++)
    for (let i = 0; i < rows[j].length; i++) {
      const c = FLAME_KEY[rows[j][i]];
      if (c !== undefined) p.set(baseX - half + i, baseY - rows.length + 1 + j, c);
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

function motes(p: PixelCanvas, cx: number, cy: number, f: number, n: number): void {
  for (let m = 0; m < n; m++) {
    const path = MOTES[m];
    const [dx, dy] = path[(f + m * 2) % path.length];
    const near = Math.abs(dx) + Math.abs(dy) < 15;
    if (p.get(cx + dx, cy + dy) === PAL.ink) continue;
    p.set(cx + dx, cy + dy, near ? PAL.void4 : PAL.void3);
  }
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
 * The card's value plan (KART_RESIMLERI §3 "öznenin aydınlık düzlemleri resmin en açık geniş alanlarıdır"): the
 * sprite is lit for the arena, where every part sits in the same light. On the card the key light falls on the
 * HEAD — the horns and the helm go one step up their ramps (void horn bands, slate helm planes), so the horned
 * helm is the lightest broad shape at 1× — and the cloth below the pauldrons goes one step down into the shadow
 * (the robe never competes with the head; the tabard's sigil keeps one void3 cross, its white centre drops to
 * void4: white is the visor's alone). Palette steps only, on the sprite before the crop (sprite frame px).
 */
const HEAD_UP: Readonly<Record<number, number>> = {
  [PAL.void1]: PAL.void2,
  [PAL.void2]: PAL.void3,
  [PAL.void3]: PAL.void4,
  [PAL.night3]: PAL.night4,
  [PAL.night4]: PAL.steel,
};
const CLOTH_DOWN: Readonly<Record<number, number>> = {
  [PAL.void2]: PAL.void1,
  [PAL.void3]: PAL.void2,
  [PAL.void4]: PAL.void3,
  [PAL.white]: PAL.void4,
  [PAL.night4]: PAL.night3,
  [PAL.steel]: PAL.night4,
};

const BREAST_DOWN: Readonly<Record<number, number>> = {
  [PAL.steel]: PAL.night4,
  [PAL.mist]: PAL.steel,
};

function cardLight(spr: PixelCanvas, o: Pose): void {
  const [ex, ey] = eyePoint(o);
  const grip = gripPoint(o)[0];
  // the head: the horns and the helm above the visor row (the staff and its cage stay as drawn)
  recolor(spr, HEAD_UP, (x, y) => y >= ey - 17 && y < ey && x >= ex - 24 && x <= ex + 6);
  // the robe: everything under the pauldrons, except the staff, its fist and the raised flame hand
  recolor(spr, CLOTH_DOWN, (x, y) => y >= ey + 21 && Math.abs(x - grip) > 3);
  // the breastplate under the pauldrons: its steel plane and glint one step down (the chest is not a second focus)
  recolor(spr, BREAST_DOWN, (x, y) => y >= ey + 13 && y < ey + 21 && x < grip - 3);
  // white is the visor's alone: every other glint (helm peak, pauldron corner, orb highlight) takes the next tone
  recolor(spr, { [PAL.white]: PAL.mist }, (x, y) => (y < ey - 1 || y > ey + 1) && x <= grip - 3);
  recolor(spr, { [PAL.white]: PAL.void4 }, (x, y) => (y < ey - 1 || y > ey + 1) && x > grip - 3);
}

// ================================================================ the two sizes

/** The eclipse, one step quieter than the arena's DARK (void0 → void1 → void2 corona, night0 disc): the subject's
 *  lit planes (void3 / void4 horns, the steel helm, the void3 rim) all sit ABOVE the corona's brightest tone. */
const QUIET_DARK = { ...BACKDROPS.DARK, tones: [PAL.void0, PAL.void1, PAL.void2, PAL.night0] };

/**
 * The rim light comes from the corona behind the head (IŞ-7): it edges the silhouette only where it stands in front
 * of the eclipse (within its outer radius + a step), so the robe and the hem below fall into plain shadow and the
 * void3 edge leads the eye up to the helm instead of drawing a lit outline round the whole figure.
 */
function lit(c: V, r: number, k: number): (x: number, y: number) => boolean {
  const cx = c[0] / k;
  const cy = c[1] / k;
  const rr = (r + 4) / k;
  return (x, y) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= rr;
}

function big(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, QUIET_DARK, { focus: HEAD_BIG, radius: BIG_R, pool: true });
  const spr = sprite(POSE_BIG);
  cardLight(spr, POSE_BIG);
  l.subject.blit(spr.crop(BIG_CROP[0], BIG_CROP[1], 88, 68), 0, 0);
  despeckle(l.subject);
  rim(l.subject, PAL.void3, { skip: KEEP, only: lit(HEAD_BIG, BIG_R, 1) });
  const [ox, oy] = sub(orbCenter(POSE_BIG), BIG_CROP);
  // the raised free hand: the flame stands on its palm (the sprite's own 3-px flame is under it)
  const hand = sub([POSE_BIG.bx + OX + POSE_BIG.dx, POSE_BIG.by + OY + POSE_BIG.bob - 4], BIG_CROP);
  flame(l.light, hand[0], hand[1], f);
  orbHeart(l.light, ox, oy, f);
  motes(l.light, ox, oy, f, 3);
}

function small(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, QUIET_DARK, { focus: HEAD_SMALL, radius: SMALL_R, horizon: 100, split: 54 });
  const spr = sprite(POSE_SMALL);
  cardLight(spr, POSE_SMALL);
  l.subject.blit(spr.crop(SMALL_CROP[0], SMALL_CROP[1], 44, 34), 0, 0);
  despeckle(l.subject);
  rim(l.subject, PAL.void3, { skip: KEEP, only: lit(HEAD_SMALL, SMALL_R, 2) });
  handFix(l.subject);
  const [ox, oy] = sub(orbCenter(POSE_SMALL), SMALL_CROP);
  orbHeart(l.light, ox, oy, f);
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
