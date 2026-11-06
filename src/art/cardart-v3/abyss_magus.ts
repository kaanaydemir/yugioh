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
// tight — a small night0 disc behind the helm's dome, a void3 ring, void2 and void1 steps outside it (the void1 step
// wide enough to light the sky right of the staff) — and cardLight() relights the sprite for the card. The head is
// redrawn as a horned war-helm (HEAD_ROWS: the sprite's swept blade under a slanted peak read as a pointed hat at 1×):
// a round dome one step dimmer than the sprite's, and two horns that CURVE UP, dark (night1, a 1-px void2 crest),
// cutting across the lit void3 ring — at 1× the head reads "horns + orb". The face cavity under the visor drops to
// night0 so the white visor and the pink eye (the focus) are the hottest pixels; the chest gem is dimmed (the eye is the
// only pink). The cloak sail and the robe go one step down (the head wins the value order); the big's cloak gets one
// lit fold and a void2 hem. The void3 rim is lit only where the helm stands in front of the corona.
// The signature (what says "Uçurum"): an abyss rift opening in the floor at the staff's foot — an ink hole between a
// void2 far lip and a lit near wall (void3 crest, void2 face), monotone stairs widening to the corner — in both sizes
// (the small's floor comes up to row 26 so the rift fills 8 rows), with abyss motes rising out of it.
// big (88×68)   the figure from the horn tips to the knees (1:1 — the sprite is never enlarged, §5), the eclipse ringing
//               the horned helm, the void flame (asymmetric, a split tongue) on the raised palm at the left and the caged
//               orb at the right; ink floor with the void1 horizon and the rift running out of the bottom-right corner.
// small (44×34) the SAME picture, closer (§1 route 1): a 1:1 crop of the SAME pose (same staff angle) on the horned helm,
//               the pauldrons, the top of the tabard and the caged orb (2 px of sky above and right of the cage); the
//               horizon and the rift's near end come up behind the bust as the ground cue. Hand corrections at 1× / ×6
//               (shots/e/abyss_magus/r3/): despeckle(), the hand-made fleck map HAND_FIX (patch), unchecker().
// Light layer (never outlined): the void flame (big), the orb's heart, the orb motes (three big / two small), the abyss
// motes rising from the rift (both), the eye's mag glint (small).
// Living (6 frames × 140 ms, A5_PLAN §3.7.6): palette swaps and ≤ 2 px moves — the flame licks, the orb's heart beats,
// the motes spiral in, the abyss motes rise, the eye glints (small: 5–9 px change a frame). Frame 0 (the still every in-game face shows today) has the orb's heart at its peak.
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
const RADII_BIG = [10, 14, 17, 21] as const;
const RADII_SMALL = [9, 12, 15, 21] as const;

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
 * The void flame on the raised palm: an asymmetric 7×12 tongue (a second light against the dark sky) — a round mist-hearted belly, the body leaning back
 * (left, away from the corona) into a licking tip, and a split tongue peeling off on the right. Tops and bellies
 * alternate per frame (≤ 2 px moves). a void3 skin, b void4 body, c mist heart (it burns one step hotter than the
 * corona's rings beside it; white stays the visor's).
 */
const FLAME_TOP: readonly (readonly string[])[] = [
  ['.a.....', 'a......', 'a......', 'aa...a.', '.a..aa.', '.ab.a..'],
  ['.......', 'a......', '.a.....', 'aa....a', '.a...a.', '.abaa..'],
  ['.......', '.......', '.a.....', 'a....a.', 'aa..aa.', '.ab.a..'],
  ['a......', '.a.....', 'a......', 'aa..a..', '.a..a..', '.abaa..'],
  ['.......', 'a......', '.a.....', '.a...a.', 'aa...a.', '.abaa..'],
  ['.......', '.......', 'a......', 'aa...a.', '.a..aa.', '.ab.a..'],
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
 *   - the helm is redrawn (HEAD_ROWS): a dimmed round dome and two up-curving dark horns that cut across the lit ring;
 *   - the face cavity under the visor drops to night0 (the neck guard keeps its lit planes): the visor and eye pop;
 *   - the chest gem one step down (dark magenta): the eye is the only pink;
 *   - the cloak sail and the robe go one step down (they never compete with the head), the tabard's sigil keeps
 *     one void3 cross (its white centre drops to void4); the breastplate's steel one step down;
 *   - white is the visor's alone: every other glint takes mist (the pauldron's steel glint: the cool accent) or void4.
 */
/** The helm's dome one step DOWN (steel → night4, mist → steel): the horns, not the crown's peak, are the head's shape. */
const HELM_DIM: Readonly<Record<number, number>> = {
  [PAL.steel]: PAL.night4,
  [PAL.mist]: PAL.steel,
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
const GEM_DOWN: Readonly<Record<number, number>> = {
  [PAL.mag4]: PAL.mag2,
  [PAL.mag3]: PAL.mag1,
  [PAL.mag2]: PAL.mag1,
  [PAL.mist]: PAL.void3,
  [PAL.white]: PAL.void3,
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
  // the helm's dome one step down; the horns are redrawn by hand (curved, dark, a void2 crest) — see horns()
  recolor(spr, HELM_DIM, (x, y) => headBox(x, y) && x >= ex - 6);
  horns(spr);
  // the face cavity under the visor only (the neck guard and cheek plate keep their lit planes: the head's contour)
  recolor(spr, FACE_DOWN, (x, y) => y >= ey && y <= ey + 4 && x >= ex - 4 && x <= ex + 5);
  // the cloak sail (left of the robe) and the robe below the pauldrons, except the staff and its fist
  recolor(spr, CLOTH_DOWN, (x, y) => !staff(x) && ((y >= ey + 14 && x <= ex - 7) || y >= ey + 21));
  // the sleeves and the robe's lit panel between the pauldrons and the belt: their void one step down too
  recolor(spr, VOID_DOWN, (x, y) => !staff(x) && y >= ey + 9 && y < ey + 21 && !(y >= ey + 14 && x <= ex - 7));
  // the breastplate under the pauldrons: its steel plane and glint one step down (the chest is not a second focus)
  recolor(spr, BREAST_DOWN, (x, y) => y >= ey + 13 && y < ey + 21 && x > ex - 7 && x < grip - 3);
  // the chest gem one step down (dark magenta, a void3 glint): the eye stays the picture's only pink
  recolor(spr, GEM_DOWN, (x, y) => y >= ey + 9 && y <= ey + 15 && x >= ex - 6 && x <= ex + 1);
  // white is the visor's alone
  recolor(spr, { [PAL.white]: PAL.mist }, (x, y) => (y < ey - 1 || y > ey + 1) && x <= grip - 3);
  recolor(spr, { [PAL.white]: PAL.void4 }, (x, y) => (y < ey - 1 || y > ey + 1) && x > grip - 3);
}

/**
 * The horned war-helm, redrawn for the card (sprite px, placed by the small's own px via SMALL_CROP so both sizes
 * carry it): the sprite's swept-back blade under a slanted peak reads as a hat brim at 1×, so on the card the dome is a
 * round skull-cap (night3, a night4 crown band, one steel glint at the lit back) and both horns CURVE UP — the near horn
 * a thick crescent from the side of the helm round to a tip at the top-left, the far horn a hook rising behind the dome.
 * Horns dark (night1 body, a 1-px void2 crest on the lit edge), inked all round: they cut dark across the lit void3
 * ring and keep their crest where they cross the night0 disc. Keys as HAND_KEY; '_' erases, '.' leaves.
 */
// prettier-ignore
const HEAD_ROWS: readonly string[] = [
  '__kkk__k2kk_____________', // 0
  '_kk2k__k26kk____________', // 1
  '_k26k__k266kk___________', // 2
  '_k26kk_kk266kk__________', // 3
  '_k266k__kk266kk_________', // 4
  '_k266kk__kk266kk________', // 5
  '_k2666kk__kkkkkkkk______', // 6
  '_kk2666kk__k9s9998k_____', // 7
  '__k22666kkk99999888k____', // 8
  '__kk226666k998888888k___', // 9
  '___kk2226666888888888k__', // 10
  '____kkk222668888888888k_', // 11
  '______kkk2266888888888k_', // 12
  '________kk666777777777k_', // 13
  '______kkk7777kk333333k__', // 14
];

function horns(spr: PixelCanvas): void {
  patch(spr, HEAD_ROWS, HAND_KEY, SMALL_CROP[0], SMALL_CROP[1]);
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
 * The abyss rift (the card's signature): where the staff meets the floor, the floor splits open and the chasm widens
 * toward the picture's bottom-right corner (toward the viewer). Rows as [y, x0, x1, wall] (picture px): both edges are
 * monotone stairs (the far edge creeps right 1 px every 3 rows, the near edge runs out 1-1-2), never stepping back.
 * One flat ink depth (the hole) between a 1-px void2 lip on the far (upper-left) edge and the near wall's lit face
 * (`wall` px, about a third of the width: a void2 crest, then void1 down to the near edge), lit by the glow below;
 * the first rows are all lip (the mouth at the staff). Abyss motes rise out of it (the light layer, riftMotes()).
 */
type RiftRow = readonly [number, number, number, number];
const RIFT_BIG: readonly RiftRow[] = [
  [49, 63, 64, 0], [50, 63, 65, 0], [51, 63, 66, 2], [52, 64, 68, 2],
  [53, 64, 69, 2], [54, 64, 70, 2], [55, 65, 72, 2], [56, 65, 73, 3],
  [57, 65, 74, 3], [58, 66, 76, 3], [59, 66, 77, 4], [60, 66, 78, 4],
  [61, 67, 80, 4], [62, 67, 81, 5], [63, 67, 82, 5], [64, 68, 84, 5],
  [65, 68, 85, 6], [66, 68, 86, 6], [67, 69, 87, 6],
];
const RIFT_SMALL: readonly RiftRow[] = [
  [26, 34, 35, 0], [27, 34, 36, 1], [28, 35, 38, 1], [29, 35, 39, 2],
  [30, 36, 40, 2], [31, 36, 41, 2], [32, 37, 42, 2], [33, 37, 43, 2],
];

function rift(p: PixelCanvas, rows: readonly RiftRow[]): void {
  for (const [y, x0, x1, wall] of rows)
    for (let x = x0; x <= x1; x++) p.set(x, y, x === x0 ? PAL.void2 : wall > 0 && x === x1 - wall + 1 ? PAL.void3 : x > x1 - wall ? PAL.void2 : PAL.ink);
  const [y, x0, x1] = rows[0];
  p.hline(x0, x1, y, PAL.void2);
}

function backdrop(p: PixelCanvas, horizon: number, c: V, radii: readonly number[], rows: readonly RiftRow[]): void {
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
  cloakForm(l.subject);
  rim(l.subject, PAL.void3, { skip: KEEP, only: helmRim(c, FOCUS[0] - 2, FOCUS[1] + 2) });
  const [ox, oy] = sub(orbCenter(POSE), BIG_CROP);
  // the raised free hand: the flame stands on its palm (the sprite's own 3-px flame is under it)
  const hand = sub([POSE.bx + OX + POSE.dx, POSE.by + OY + POSE.bob - 4], BIG_CROP);
  flame(l.light, hand[0], hand[1], f);
  orbHeart(l.light, ox, oy, f);
  motes(l.light, l.subject, ox, oy, f, 3);
  riftMotes(l.light, l.subject, RIFT_MOTES_BIG, f);
}

/**
 * The cloak sail's form (big only — the small crops above it): one lit fold (a 2-px night3 band, a night1 shadow
 * under it) running parallel to the flung edge across the flat night2 plane, and a 1-px void2 hem where the lining
 * turns out under it. Palette steps on the subject, picture px.
 */
function cloakForm(s: PixelCanvas): void {
  for (let y = 43; y <= 59; y++) {
    let e = -1;
    for (let x = 0; x < 34; x++)
      if (s.get(x, y) === PAL.night4) {
        e = x;
        break;
      }
    if (e < 0) continue;
    for (const [dx, from, to] of [
      [12, PAL.night2, PAL.night3],
      [13, PAL.night2, PAL.night3],
      [14, PAL.night2, PAL.night1],
    ] as const)
      if (s.get(e + dx, y) === from) s.set(e + dx, y, to);
  }
  for (let y = 56; y < s.h; y++)
    for (let x = 0; x < 32; x++) if (s.get(x, y) === PAL.void1 && s.get(x, y - 1) === PAL.night2) s.set(x, y, PAL.void2);
}

/**
 * Motes rising out of the rift (the abyss breathes): paths in picture px, one step (≤ 2 px) a frame, void3 in the hole
 * and void2 once they rise above the floor line. Never over the subject.
 */
const RIFT_MOTES_BIG: readonly (readonly V[])[] = [
  [[73, 64], [73, 62], [72, 60], [72, 58], [71, 56], [71, 54]],
  [[77, 60], [78, 58], [78, 56], [79, 54], [79, 52], [80, 50]],
];
const RIFT_MOTES_SMALL: readonly (readonly V[])[] = [
  [[38, 31], [38, 30], [37, 29], [37, 28], [37, 27], [36, 25]],
  [[40, 28], [41, 27], [41, 25], [42, 24], [42, 23], [41, 32]],
];

function riftMotes(p: PixelCanvas, subject: PixelCanvas, paths: readonly (readonly V[])[], f: number): void {
  const floor = paths === RIFT_MOTES_BIG ? ART_HORIZON_BIG : 26;
  for (let m = 0; m < paths.length; m++) {
    const [x, y] = paths[m][(f + m * 3) % paths[m].length];
    if (subject.get(x, y) !== null) continue;
    p.set(x, y, y > floor ? PAL.void3 : PAL.void2);
  }
}

const ART_HORIZON_BIG = 48;
/** The small's horizon (big px: small row 26): a closer crop of the same ground, cheated up behind the bust. */
const ART_HORIZON_SMALL = 52;

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
  motes(l.light, l.subject, ox, oy, f, 2);
  eyeGlint(l.light, FOCUS_SMALL, f);
  riftMotes(l.light, l.subject, RIFT_MOTES_SMALL, f);
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
