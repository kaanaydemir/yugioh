// Card art v3 — Mühürlü Baş (seal_head, the colossus head of the Beş Mühür set): the sprite's own pixels, 1:1, on the set's shared
// "Seal Eclipse" backdrop (docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
//
// big (88×68)   the head as the board draws it: crest, brow slab with the forehead disc, the huge eye socket at the eclipse's
//               centre, the straps and the chain loop, the torn neck stump with its seam. Backdrop: the kit's DARK eclipse plus
//               FIVE short stepped rays at the pentagon angles (the set's mark); a "pentad" of five dots sits in the top-left
//               corner, this card's vertex (the head, the apex) lit mag4, the other four mag2 (light layer).
// small (44×34) the SAME picture, closer: a 1:1 crop of the sprite on the eye, the brow and the strap.
// Living (4 frames, 170 ms): the sprite's own idle frames 0 / 3 / 6 / 9 (the eye swells, the forehead disc breathes, the chains swing).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { drawHead, pose, type Pose } from '../monsters-v3/seal_head-rig';
import { BACKDROPS, paintBackdrop } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

/** The eye socket's centre in BIG px (the eclipse is centred on it). */
const FOCUS = [44, 27] as const;
const FOCUS_SMALL = [22, 14] as const;
/**
 * This card's accent: the Gaze is CRIMSON. The set backdrop (eclipse, five rays, pentad) stays; the corona, the horizon line and the
 * rays take the piece's colour so the five cards tell apart at hand size (arm_l teal, leg_r earth, leg_l water; arm_r: cyan advised).
 */
const ACCENT = [PAL.crim0, PAL.crim1, PAL.crim2, PAL.night0] as const;
const RECIPE = { ...BACKDROPS.DARK, tones: ACCENT, horizonLine: PAL.crim1, rim: PAL.crim2 };
const RAY = PAL.crim1;

/**
 * The composition (not a crop of the idle frame): the head tilted up a little, the near eye on the eclipse's centre, one shard
 * high on the right and one low in front, the chains swinging over the floor and the torn neck pouring its seam light onto a
 * stepped floor pool. drawHead's own outline; the card keeps only what it adds (rays, pool, pentad) in its own layers.
 */
function headPose(f: number): Pose {
  const eye = [2, 3, 4, 3][f % 4];
  return pose({ rot: 4, jaw: 14, eye, disc: [3, 3, 4, 4][f % 4], seam: [3, 4, 3, 2][f % 4], s1: [-50, -46, -42, -46][f % 4], s2: 160, s3: 62, sr: 170, chT: [0.1, 0.35, 0.6, 0.85][f % 4], chA: 2.5, clink: f === 1 ? 1 : 0 });
}

/** The set's five rays: short stepped bars at -90, -18, 54, 126, 198 degrees round the eclipse centre. */
function rays(p: PixelCanvas, cx: number, cy: number, r0: number, len: number): void {
  for (const a of [-90, -18, 54, 126, 198]) {
    const c = Math.cos((a * Math.PI) / 180);
    const s = Math.sin((a * Math.PI) / 180);
    for (let t = r0; t <= r0 + len; t++) p.set(Math.round(cx + c * t * 1.0), Math.round(cy + s * t * 0.8), RAY);
  }
}

/** The pentad: five dots on a pentagon (apex up); vertex 0 (the head) is this card's own, lit mag4. */
function pentad(p: PixelCanvas, pts: readonly (readonly [number, number])[]): void {
  pts.forEach(([x, y], i) => p.set(x, y, i === 0 ? PAL.mag4 : PAL.mag2));
}

/** The seam light on the floor under the neck: a stepped 2:1 pool, light layer. */
function floorPool(p: PixelCanvas, cx: number, cy: number, rx: number): void {
  for (let i = 0; i < 3; i++) {
    const w = rx - i * 4;
    for (let x = -w; x <= w; x++) {
      const dy = Math.round((1 - Math.abs(x) / w) * (w / 2.2));
      p.set(cx + x, cy - dy, i === 0 ? PAL.mag1 : PAL.mag2);
      if (i === 0) p.set(cx + x, cy + dy, PAL.mag1);
    }
  }
}

function big(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, RECIPE, { focus: FOCUS });
  rays(l.backdrop, FOCUS[0], FOCUS[1], 24, 7);
  drawHead(l.subject, headPose(f), 'left', { ox: 36, oy: 33, k: 1 });
  floorPool(l.light, 29, 60, 13);
  pentad(l.light, [[7, 4], [10, 6], [9, 10], [5, 10], [4, 6]]);
}

function small(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, RECIPE, { focus: FOCUS_SMALL, horizon: 24 });
  rays(l.backdrop, FOCUS_SMALL[0], FOCUS_SMALL[1], 12, 4);
  drawHead(l.subject, headPose(f), 'left', { ox: 14, oy: 19, k: 1 });
  pentad(l.light, [[4, 2], [6, 3], [5, 6], [3, 6], [2, 3]]);
}

const art: CardArtV3 = {
  id: 'seal_head',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 170,
  big,
  small,
};

export default art;
