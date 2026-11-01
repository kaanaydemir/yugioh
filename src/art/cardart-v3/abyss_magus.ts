// Card art v3 — Uçurum Büyücüsü (abyss_magus, 6★ DARK spellcaster): the v3 sprite's own pixels, 1:1, in a card pose
// (style sheet docs/v3/KART_RESIMLERI.md §5 — the approved-still monsters keep the board's pixels, never scaled;
// contract ./_types.ts). Wired as the v3 card-face picture by src/art/cardart-v3/lane-e.ts and, under V3_CARDS, by
// src/art/monsters-v3/abyss_magus.ts (`portrait`); tests/e/abyss_magus-card.test.ts holds the kit budgets.
//
// The pose is the sprite's victory call (src/art/monsters-v3/abyss_magus-anims.ts, victory f3) without its floor ring and
// star burst: the staff thrust up with the orb high and forward, the free hand raised behind the head with a void flame,
// the cloak flung back — the magus summoning the abyss. Drawn by the sprite's own rig (drawMagus, key light from the
// screen's top left), so the card and the board show the same character pixel for pixel.
//
// big (88×68)   the figure from the horn tips to the knees (the hem bleeds off the bottom: it floats), 1:1 — horned
//               helm with the white visor slit, the slate pauldrons, the violet robe and cape, the staff and its caged
//               orb up at the right, the raised void flame at the left. Ground: the kit's DARK recipe — the eclipse
//               (dark disc + stepped void corona) centred 3 px behind the near eye, so helm and horns read against the
//               dark disc and the corona rings them; night0 / void0 sky, ink floor with a void1 horizon and its pool.
// small (44×34) the SAME picture, closer (KART_RESIMLERI §1 route 1): a 1:1 crop of the same pose on the horns, the helm,
//               the pauldrons, the chest gem, the orb and the flame. Hand corrections, all judged at 1× / ×6
//               (shots/e/abyss_magus/art*/): the staff stands 2 px nearer and upright (gx 54, sa 0) so the whole caged orb
//               fits beside the horns; no floor and a lower sky split (the closer crop puts the horizon under the window);
//               the eclipse is the same shape, closer (wider ring, centred 3 / 2 px behind the eye) and one step quieter
//               (HAND_DARK) so the horns crossing it stay brighter than the corona; despeckle() takes the sprite's 1-px
//               interior flecks, unchecker() turns its 1-px ink stairs into Ls (no 2×2 checkers at 1×); the flame burns one
//               step hotter (3×6, void3 / void4 / white) so it reads on the ring.
// Light layer (never outlined): the void flame (a hand-drawn 7×12 teardrop over the sprite's 3-px one; 3×6 in the hand),
// the orb's heart, and three motes falling into the orb (big).
// Living (6 frames × 140 ms, A5_PLAN §3.7.6): palette swaps and ≤ 2 px moves only — the flame licks (tip sways a pixel,
// its white heart flickers), the orb's heart beats (void3 → void4 → white), the motes spiral in one step a frame. The big
// subject layer (the sprite) is the same in every frame.
// Colours only from PAL (the rig and the kit).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { OX, OY, drawMagus, eyePoint, orbCenter, pose, type Pose } from '../monsters-v3/abyss_magus-rig';
import { framePose } from '../monsters-v3/abyss_magus-anims';
import { BACKDROPS, paintBackdrop, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type V = readonly [number, number];

const FRAMES = 6;

/** The card pose: victory f3 (staff up, void flame raised, cloak flung back), without its floor ring and star burst. */
function cardPose(o: Partial<Pose> = {}): Pose {
  return pose({ ...framePose('victory', 3), aura: 0, star: 0, t: 0, ...o });
}

const POSE_BIG = cardPose();
/** The hand version's correction: the staff upright and 2 px nearer, so the caged orb fits beside the horns. */
const POSE_SMALL = cardPose({ gx: 54, sa: 0 });

function sprite(o: Pose): PixelCanvas {
  const p = new PixelCanvas(112, 116);
  drawMagus(p, o, 'left');
  return p;
}

/** Sprite-frame → picture crops (1:1, frame px of the picture's top-left). */
const BIG_CROP: V = [4, 10];
const SMALL_CROP: V = [28, 13];

const sub = (a: V, c: V): V => [Math.round(a[0]) - c[0], Math.round(a[1]) - c[1]];

/** The near eye (the focus) in each picture's own px. */
const FOCUS = sub(eyePoint(POSE_BIG), BIG_CROP);
const FOCUS_SMALL = sub(eyePoint(POSE_SMALL), SMALL_CROP);

/** The eclipse sits a few px behind (up-left of) the eye, ringing the helm and the horns. */
const ECLIPSE: V = [FOCUS[0] - 3, FOCUS[1] - 2];
const ECLIPSE_SMALL: V = [(FOCUS_SMALL[0] - 3) * 2, (FOCUS_SMALL[1] - 2) * 2];

/**
 * The hand picture's eclipse: the DARK recipe one step quieter (void0 → void1 → void2 corona, night0 disc). At 1× the
 * corona runs right behind the horns, whose own planes are void1–void3: one step down keeps the horns, the visor and the
 * orb the brightest shapes (KART_RESIMLERI §3 "arka plan ışığı onlardan koyu kalır").
 */
const HAND_DARK = { ...BACKDROPS.DARK, tones: [PAL.void0, PAL.void1, PAL.void2, PAL.night0] };

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
/** The hand version's flame: 3×6, the same teardrop at 1× density (its heart flickers). */
const FLAME_SMALL: readonly (readonly string[])[] = [
  ['.a.', '.a.', 'aba', 'bcb', 'bwb', '.b.'],
  ['..a', '.a.', 'aba', 'bcb', 'bcb', '.b.'],
  ['.a.', '.aa', 'aba', 'bwb', 'bcb', '.b.'],
  ['a..', '.a.', 'aba', 'bcb', 'bwb', '.b.'],
  ['.a.', 'aa.', 'aba', 'bcb', 'bcb', '.b.'],
  ['...', '.a.', 'aba', 'bwb', 'bcb', '.b.'],
];
const FLAME_KEY: Readonly<Record<string, number>> = { a: PAL.void2, b: PAL.void3, c: PAL.void4, w: PAL.white };
/** The hand flame burns one step hotter: at 1× it stands on the corona's void ring and must stay the brighter shape. */
const FLAME_KEY_SMALL: Readonly<Record<string, number>> = { a: PAL.void3, b: PAL.void4, c: PAL.white, w: PAL.white };

function flame(p: PixelCanvas, baseX: number, baseY: number, f: number, set = FLAME, key = FLAME_KEY): void {
  const rows = set[f % set.length];
  const half = rows[0].length >> 1;
  for (let j = 0; j < rows.length; j++)
    for (let i = 0; i < rows[j].length; i++) {
      const c = key[rows[j][i]];
      if (c !== undefined) p.set(baseX - half + i, baseY - rows.length + 1 + j, c);
    }
}

/** The orb's heart (2×2 at its centre): void3 → void4 → white-centred → void4 … */
function orbHeart(p: PixelCanvas, cx: number, cy: number, f: number): void {
  const beat = [0, 1, 2, 2, 1, 0][f % FRAMES];
  const outer = beat === 0 ? PAL.void3 : PAL.void4;
  p.rect(cx - 1, cy, 2, 2, outer);
  if (beat === 2) p.set(cx - 1, cy, PAL.white);
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

// ================================================================ the two sizes

function big(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'DARK', { focus: ECLIPSE, pool: true });
  l.subject.blit(sprite(POSE_BIG).crop(BIG_CROP[0], BIG_CROP[1], 88, 68), 0, 0);
  rim(l.subject, PAL.void3, { skip: KEEP });
  const [ox, oy] = sub(orbCenter(POSE_BIG), BIG_CROP);
  // the raised free hand: the flame stands on its palm (the sprite's own 3-px flame is under it)
  const hand = sub([POSE_BIG.bx + OX + POSE_BIG.dx, POSE_BIG.by + OY + POSE_BIG.bob - 4], BIG_CROP);
  flame(l.light, hand[0], hand[1], f);
  orbHeart(l.light, ox, oy, f);
  motes(l.light, ox, oy, f, 3);
}

function small(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, HAND_DARK, { focus: ECLIPSE_SMALL, radius: 42, horizon: 100, split: 54 });
  l.subject.blit(sprite(POSE_SMALL).crop(SMALL_CROP[0], SMALL_CROP[1], 44, 34), 0, 0);
  despeckle(l.subject);
  rim(l.subject, PAL.void3, { skip: KEEP });
  const [ox, oy] = sub(orbCenter(POSE_SMALL), SMALL_CROP);
  orbHeart(l.light, ox, oy, f);
  // the raised flame (the fist bleeds off the back edge; its 3-px sprite flame is under this one)
  const hand = sub([POSE_SMALL.bx + OX + POSE_SMALL.dx, POSE_SMALL.by + OY + POSE_SMALL.bob - 4], SMALL_CROP);
  flame(l.light, hand[0], hand[1], f, FLAME_SMALL, FLAME_KEY_SMALL);
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
