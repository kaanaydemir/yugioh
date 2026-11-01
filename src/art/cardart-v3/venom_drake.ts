// Card art v3 — Zehir Ejderi (venom_drake, DARK dragon): "Zehirli Toprak" (docs/v3/kart-a/venom_drake.md §7,
// style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
//
// big   88×68: the NATIVE card-density bust shared with the v3 cut-in (src/art/cutins-v3/_venom_drake-bust.ts,
//       painted here at S = 2 px per unit — one composition, one set of shapes, never the 1× sprite enlarged;
//       the crystal_wyrm card / cut-in pair's method). The forms, tones and parts are the final sprite's
//       (src/art/monsters-v3/venom_drake-rig.ts): the mag1 / void2 / void1 venomscale hide with a void3 lit edge,
//       the stone chitin (horns, quills, the last tail segments, the stinger), the leaf2 / leaf3 venom with the
//       leaf3 + gold3 hot band and ONE gold4 core pixel.
//         - the head enters low from the left on its neck (the neck bleeds off the bottom-left), a long low
//           wedge looking right at the right third, jaw cracked on the hiss, the throat sac glowing under it;
//         - the segmented scorpion TAIL arches in from the top-left over the head; the venom BULB hangs at the
//           upper right — the focus and the brightest point; the hooked stinger drips in front of the face;
//         - a drop falls from the stinger (a 2-px stepped trail) onto an etched ring of dead ground at the
//           bottom right: stone0 cracked floor with a leaf1 lip and one bubble, NO plant glyph — the flavour
//           ("bir daha yeşertmez") is told by the ground itself.
//       The shadow-side rim (IŞ-7) is the DARK card light's void3 (the sprite's leaf2 under-glow is the arena's).
// small 44×34 hand version: the same bust redrawn at S = 1 (the kit's preference 2: the same geometry at 1×
//       density), then corrected by hand with patch (SMALL_FIX): the bulb as a crisp acid drop with its gold4
//       core, the eye, the sac and the fang re-cut pixel by pixel. Same focus, same recipe, same light shape.
// Backdrop: the kit's DARK recipe (the void eclipse), its stepped corona centred 3 px behind the bulb.
// Living art (A5_PLAN §3.7.6), 6 frames × 150 ms, f0 = the reduced-motion frame: the stinger bead swells and
// lets go (palette steps on fixed pixels), the drop's head steps down its fixed trail, the bulb's hot band
// breathes (palette) and the ring's bubble swells and pops. Nothing moves more than 2 px.
// (critic art r1) the bulb's gold3 is a 3-px crescent on the core's lit side (never a gold lens); the eye
// gold2 + an ink slit (no gold3 lid); the head's mag1 top plane ≥ 2 px with a brow step and a nostril notch;
// the big card's jaw lifted (mag1 over void2) round a void0 gape, the sac smaller and joined to the jaw;
// the hand card's mouth closed to an ink line over a void1 jaw band, a 4-px hook off the bulb (no beak),
// no horn at its left edge; the drop is ONE head + one trailing pixel stepping down per frame (no dashed
// trail), the hand card's pit under its stinger.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { BUST_REST, paintVenomBust, type BustOut, type BustPose, type V } from '../cutins-v3/_venom_drake-bust';
import { paintBackdrop, patch } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

const FRAMES = 6;
/** the card pose: the cold stare with the jaw cracked on the hiss, the sac half full, the bulb ignited */
const POSE: BustPose = { ...BUST_REST, jaw: 0.78, sac: 1.6, hot: 1, bead: 2 };
/** per living frame: the stinger bead and the hot band */
/** (critic art r1) the hand card: the mouth closed to one ink line between the lip and the void1 jaw band, the head 2 px higher (the jaw in frame) */
const SMALL_POSE: Partial<BustPose> = { jaw: 0.08, hy: -1.4 };
const BEAD = [1, 2, 2, 3, 3, 1] as const;
const HOT = [1, 1, 2, 1, 1, 1] as const;

const HORIZON = 56;
/** the ring of dead ground (big px): centre and radii */
const RING = { x: 79, y: 61, rx: 7, ry: 2.5 } as const;

/** big: px per unit and the unit origin (the tail's top keeps ≥ 5 px from the top edge: no tangent) */
const BIG_S = 2.2;
const BIG_O: V = [-12, 2];
/** small: the same bust, closer (the head, the bulb, the drop): units x ≈ 11 … 44 at 1.32 px per unit */
const SMALL_S = 1.5;
/** (critic r5) the arch lowered over the head: big closes the dead pocket inside it, small keeps it whole under 2 px of air */
const ARCH_DROP_BIG = 1.8;
/** the hand card's tail rises from behind the horns and curls over the head to the chitin: the whole C reads at 1× */
const SMALL_TAIL: readonly [V, V, V, V] = [
  [15.6, 15.6],
  [14.0, 5.6],
  [21.4, 4.0],
  [27.2, 6.2],
];
const SMALL_O: V = [-20, -3];

const cache = new Map<string, BustOut>();
function bust(size: 'big' | 'small', f: number): BustOut {
  const k = `${size}:${f % FRAMES}`;
  let b = cache.get(k);
  if (!b) {
    const big = size === 'big';
    b = paintVenomBust(
      { ...POSE, ...(big ? {} : SMALL_POSE), bead: BEAD[f % FRAMES], hot: HOT[f % FRAMES] },
      big
        ? { S: BIG_S, w: 88, h: 68, ox: BIG_O[0], oy: BIG_O[1], lightFrom: 'left', rim: PAL.void3, cape: false, archDrop: ARCH_DROP_BIG, sacDrop: 0.5, liftJaw: true, sacK: 0.78, hornK: 0.72 }
        : { S: SMALL_S, w: 44, h: 34, ox: SMALL_O[0], oy: SMALL_O[1], lightFrom: 'left', rim: PAL.void3, cape: false, lite: true, tailPath: SMALL_TAIL, tailR: 0.45, sacDrop: 0, headKy: 1.25, sacK: 0.8, hornK: 0.4 },
    );
    cache.set(k, b);
  }
  return b;
}

const REF = bust('big', 0);
const FOCUS: V = REF.bulb;
const FOCUS_SMALL: V = bust('small', 0).bulb;

/**
 * The etched ring of dead ground on the floor (backdrop) + its bubble (light), at size scale k (1 big, 0.5 small).
 * (critic art r1) the hand card's pit sits under its own stinger (x ≤ 38, clear of the frame's edge) and 1 px
 * higher (off the bottom bezel).
 */
function paintRing(b: PixelCanvas, l: PixelCanvas, k: 1 | 0.5, f: number, atX?: number): void {
  const cx = atX ?? Math.round(RING.x * k);
  const cy = Math.round(RING.y * k) - (k === 1 ? 0 : 1);
  const rx = RING.rx * k;
  const ry = Math.max(1.2, RING.ry * k);
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
    for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) if (((x + 0.5 - cx - 0.5) / rx) ** 2 + ((y + 0.5 - cy - 0.5) / ry) ** 2 <= 1) b.set(x, y, PAL.stone0);
  // the leaf1 lip on the far (upper) rim and the ends; the near rim a night0 crack shadow
  const marks: [number, number, number][] = [];
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
    for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      if (b.get(x, y) !== PAL.stone0) continue;
      const out = (dx: number, dy: number) => b.get(x + dx, y + dy) !== PAL.stone0;
      if (out(0, -1) || out(-1, 0) || out(1, 0)) marks.push([x, y, PAL.leaf1]);
    }
  for (const [x, y, c] of marks) b.set(x, y, c);
  // cracks running out of the pit across the floor (night0): stepped, never 1-px diagonals
  if (k === 1) {
    for (const [x, y] of [[cx - 7, cy + 1], [cx - 8, cy + 1], [cx - 9, cy + 2], [cx - 10, cy + 2], [cx - 11, cy + 2], [cx + 2, cy + 3], [cx + 3, cy + 3], [cx + 3, cy + 4], [cx + 4, cy + 4], [cx + 5, cy + 5]] as const) b.set(x, y, PAL.night0);
    b.set(cx - 2, cy, PAL.night0).set(cx - 1, cy, PAL.night0).set(cx + 2, cy, PAL.night0);
  } else b.set(cx + 2, cy + 2, PAL.night0).set(cx + 3, cy + 2, PAL.night0);
  // the bubble: 2 px leaf2, f3 swells leaf3, f4 pops (a split), f5 the etch dot
  const ph = f % FRAMES;
  const bx = cx + (k === 1 ? 1 : 0);
  const by = cy - (k === 1 ? 1 : 0);
  // (critic art r1) the lip stays leaf1; the bubble is ONE leaf2 pixel that swells (f0 → f1) and pops (f2)
  if (k === 1) {
    if (ph === 0) l.set(bx, by, PAL.leaf2);
    else if (ph === 1) l.set(bx, by, PAL.leaf2).set(bx, by - 1, PAL.leaf1);
    else if (ph === 2) l.set(bx - 1, by, PAL.leaf1).set(bx + 1, by, PAL.leaf1);
    else if (ph >= 4) l.set(bx, by, PAL.leaf1);
  } else if (ph <= 1) l.set(bx, by, PAL.leaf2);
}

/**
 * The falling drop (light), palette steps on FIXED pixels (A5_PLAN §3.7.6). (critic art r1: never a fixed
 * dashed trail — it read as stitches) each frame shows only the drop's HEAD and one leaf2 pixel trailing it,
 * the head stepping down its column: f5 it lets go of the stinger (10 %), f0 … f3 it falls (30 / 50 / 70 /
 * 90 %), f4 it splashes on the pit's lip. Big: a 2×2 head; hand card: a 1-px head (≈ 2 px a frame).
 * f0 (the reduced-motion frame) holds the drop mid-fall.
 */
const FALL = [0.3, 0.5, 0.7, 0.9, -1, 0.1] as const;
function paintDrop(l: PixelCanvas, sting: V, lipY: number, k: 1 | 0.5, f: number): void {
  const ph = f % FRAMES;
  const x = sting[0];
  const y0 = sting[1] + (k === 1 ? 4 : 3);
  const y1 = lipY - (k === 1 ? 3 : 2);
  const t = FALL[ph];
  if (t >= 0) {
    const y = Math.round(y0 + (y1 - y0) * t);
    if (k === 1) l.set(x, y - 1, PAL.leaf2).set(x, y, PAL.leaf3).set(x + 1, y, PAL.leaf2).set(x, y + 1, PAL.leaf2).set(x + 1, y + 1, PAL.leaf2);
    else l.set(x, y - 1, PAL.leaf2).set(x, y, PAL.leaf3);
  } else if (k === 1) {
    // the splash crown on the lip
    l.set(x - 1, lipY - 1, PAL.leaf3).set(x, lipY - 2, PAL.leaf2).set(x + 2, lipY - 1, PAL.leaf3).set(x + 1, lipY - 2, PAL.leaf2).set(x - 2, lipY - 2, PAL.leaf1).set(x + 3, lipY - 2, PAL.leaf1);
  } else l.set(x - 1, lipY - 1, PAL.leaf3).set(x + 1, lipY - 1, PAL.leaf3);
}

/**
 * (critic r5, §2/§3) where the eclipse's lit corona (void3 / void2) runs behind the head, the head's lit top
 * plane would merge with it in the same violet: the corona steps down to void1 within 3 px of the head's hide
 * (an air gap cut into the backdrop under the bulb), so the skull's edge always meets a darker value.
 */
function gapUnderCorona(l: ArtLayers, belowY: number): void {
  const HIDE: ReadonlySet<number> = new Set<number>([PAL.mag1, PAL.void3, PAL.void2, PAL.void1, PAL.ink]);
  const edits: [number, number][] = [];
  for (let y = belowY; y < l.backdrop.h; y++)
    for (let x = 0; x < l.backdrop.w; x++) {
      if (l.subject.isOpaque(x, y)) continue;
      const c = l.backdrop.get(x, y);
      if (c !== PAL.void3 && c !== PAL.void2) continue;
      let near = false;
      for (let dy = -3; dy <= 3 && !near; dy++)
        for (let dx = -3; dx <= 3 && !near; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > 3 || y + dy < belowY) continue;
          const q = l.subject.get(x + dx, y + dy);
          if (q !== null && HIDE.has(q)) near = true;
        }
      if (near) edits.push([x, y]);
    }
  for (const [x, y] of edits) l.backdrop.set(x, y, PAL.void1);
}

function paintBig(l: ArtLayers, f: number): void {
  const b = bust('big', f);
  // (critic r5) the eclipse sits up-right of its old place and one step smaller: its corona clears the skull
  paintBackdrop(l.backdrop, 'DARK', { focus: [FOCUS[0] - 1, FOCUS[1] - 3], radius: 18, horizon: HORIZON });
  paintRing(l.subject, l.light, 1, f);
  l.subject.blit(b.matter, 0, 0);
  gapUnderCorona(l, b.bulb[1] + 6);
  l.light.blit(b.light, 0, 0);
  paintDrop(l.light, b.sting, Math.round(RING.y - RING.ry), 1, f);
}

// ---------------------------------------------------------------- small (S = 1 + the hand corrections)

const KEY: Record<string, number> = {
  k: PAL.ink,
  d: PAL.leaf2,
  b: PAL.leaf3,
  h: PAL.gold3,
  c: PAL.gold4,
  e: PAL.gold2,
  s: PAL.stone3,
  t: PAL.stone2,
  w: PAL.stone4,
  m: PAL.mag1,
  v: PAL.void1,
  u: PAL.void2,
  o: PAL.void0,
};

function paintSmall(l: ArtLayers, f: number): void {
  const b = bust('small', f);
  paintBackdrop(l.backdrop, 'DARK', { focus: [FOCUS_SMALL[0] * 2 - 3, FOCUS_SMALL[1] * 2], radius: 17, horizon: HORIZON });
  paintRing(l.subject, l.light, 0.5, f, b.sting[0] - 1);
  l.subject.blit(b.matter, 0, 0);
  l.light.blit(b.light, 0, 0);
  // hand corrections: the bulb as a crisp acid drop (the hot band, ONE gold4 core)
  const [bx, by] = b.bulb;
  // (critic r5) a 2×2 gold3 lens with the gold4 core at its upper left (the light), a leaf3 ring: no sparkle
  // (critic art r1) the gold3 is a 2-px crescent on the core's lit (upper-left) side, never a lens round it
  patch(l.light, ['.hb.', 'hcbb', 'bbbb', '.dd.'], KEY, bx - 2, by - 2);
  paintDrop(l.light, b.sting, Math.round((RING.y - RING.ry) / 2) - 1, 0.5, f);
}

const venomDrakeArt: CardArtV3 = {
  id: 'venom_drake' as CardArtV3['id'],
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: FRAMES,
  holdMs: 150,
  big: paintBig,
  small: paintSmall,
};

export default venomDrakeArt;
