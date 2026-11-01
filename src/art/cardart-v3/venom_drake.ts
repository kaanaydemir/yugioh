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

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { BUST_REST, paintVenomBust, type BustOut, type BustPose, type V } from '../cutins-v3/_venom_drake-bust';
import { paintBackdrop, patch } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

const FRAMES = 6;
/** the card pose: the cold stare with the jaw cracked on the hiss, the sac half full, the bulb ignited */
const POSE: BustPose = { ...BUST_REST, jaw: 0.62, sac: 1.6, hot: 1, bead: 2 };
/** per living frame: the stinger bead and the hot band */
const BEAD = [2, 2, 3, 3, 1, 1] as const;
const HOT = [1, 1, 2, 1, 1, 1] as const;

const HORIZON = 56;
/** the ring of dead ground (big px): centre and radii */
const RING = { x: 79, y: 61, rx: 7, ry: 2.5 } as const;

/** big: px per unit and the unit origin (the tail's top keeps ≥ 5 px from the top edge: no tangent) */
const BIG_S = 2.2;
const BIG_O: V = [-12, 5];
/** small: the same bust, closer (the head, the bulb, the drop): units x ≈ 11 … 44 at 1.32 px per unit */
const SMALL_S = 1.5;
const SMALL_O: V = [-20, -6];

const cache = new Map<string, BustOut>();
function bust(size: 'big' | 'small', f: number): BustOut {
  const k = `${size}:${f % FRAMES}`;
  let b = cache.get(k);
  if (!b) {
    const big = size === 'big';
    b = paintVenomBust(
      { ...POSE, bead: BEAD[f % FRAMES], hot: HOT[f % FRAMES] },
      big ? { S: BIG_S, w: 88, h: 68, ox: BIG_O[0], oy: BIG_O[1], lightFrom: 'left', rim: PAL.void3, cape: false } : { S: SMALL_S, w: 44, h: 34, ox: SMALL_O[0], oy: SMALL_O[1], lightFrom: 'left', rim: PAL.void3, cape: false, lite: true },
    );
    cache.set(k, b);
  }
  return b;
}

const REF = bust('big', 0);
const FOCUS: V = REF.bulb;
const FOCUS_SMALL: V = bust('small', 0).bulb;

/** The etched ring of dead ground on the floor (backdrop) + its bubble (light), at size scale k (1 big, 0.5 small). */
function paintRing(b: PixelCanvas, l: PixelCanvas, k: 1 | 0.5, f: number): void {
  const cx = Math.round(RING.x * k);
  const cy = Math.round(RING.y * k);
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
  if (k === 1) {
    if (ph <= 2) l.set(bx, by, PAL.leaf2).set(bx + 1, by, PAL.leaf2);
    else if (ph === 3) l.set(bx, by, PAL.leaf3).set(bx + 1, by, PAL.leaf3).set(bx, by - 1, PAL.leaf2).set(bx + 1, by - 1, PAL.leaf2);
    else if (ph === 4) l.set(bx - 1, by, PAL.leaf2).set(bx + 2, by, PAL.leaf2).set(bx, by - 2, PAL.leaf3);
    else l.set(bx, by, PAL.leaf1).set(bx + 1, by, PAL.leaf1);
  } else l.set(bx, by, ph === 3 ? PAL.leaf3 : ph === 5 ? PAL.leaf1 : PAL.leaf2);
}

/**
 * The falling drop (light), a palette cycle on FIXED pixels (A5_PLAN §3.7.6: no pixel moves more than 2 px):
 * the 2-px stepped trail from the stinger bead to the pit is always there in leaf1 (2 on, 2 off), and the
 * drop's head lights the trail pixels it passes — f2 just let go, f3 mid fall, f4 at the pit (the splash
 * lights the pit's lip), f0 / f1 / f5 nothing in the air (f0 is the reduced-motion frame).
 */
function paintDrop(l: PixelCanvas, sting: V, toY: number, k: 1 | 0.5, f: number): void {
  const ph = f % FRAMES;
  const x = sting[0];
  const y0 = sting[1] + (k === 1 ? 5 : 3);
  const y1 = toY - (k === 1 ? 3 : 2);
  const on = (y: number) => (y - y0) % 4 < 2;
  for (let y = y0; y <= y1; y++) if (on(y)) l.set(x, y, PAL.leaf1);
  const at = ph === 2 ? 0.12 : ph === 3 ? 0.55 : ph === 4 ? 1 : -1;
  if (at < 0) return;
  // the head: the lit pair of trail pixels nearest the fall's progress
  let y = Math.round(y0 + (y1 - y0) * at);
  while (y > y0 && !on(y)) y--;
  l.set(x, y, PAL.leaf3);
  if (on(y - 1)) l.set(x, y - 1, PAL.leaf2);
  else if (on(y + 1)) l.set(x, y + 1, PAL.leaf2);
}

function paintBig(l: ArtLayers, f: number): void {
  const b = bust('big', f);
  paintBackdrop(l.backdrop, 'DARK', { focus: [FOCUS[0] - 3, FOCUS[1]], radius: 20, horizon: HORIZON });
  paintRing(l.subject, l.light, 1, f);
  l.subject.blit(b.matter, 0, 0);
  l.light.blit(b.light, 0, 0);
  paintDrop(l.light, b.sting, RING.y, 1, f);
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
  paintRing(l.subject, l.light, 0.5, f);
  l.subject.blit(b.matter, 0, 0);
  l.light.blit(b.light, 0, 0);
  // hand corrections: the bulb as a crisp acid drop (the hot band, ONE gold4 core)
  const [bx, by] = b.bulb;
  patch(l.light, ['.bb.', 'bhcb', 'bbhb', '.dd.'], KEY, bx - 2, by - 2);
  paintDrop(l.light, b.sting, Math.round(RING.y / 2), 0.5, f);
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
