// Card art v3 — Bozkır Boynuzlusu (steppe_spiralhorn, WIND beast): "batan güneşin önünde havada antilop, sarmal
// boynuzlar silüet" (YENI_KARTLAR C11). Style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts.
//
// big (88×68)   the saiga IN THE AIR, mid-bound, legs stretched fore and aft — the board sprite's own pixels, 1:1, drawn
//               from the rig in its long-bound pose (never scaled) — in front of a low setting sun: a two-step stepped
//               disc (gold1 / gold2) behind the head so the two corkscrew horns stand in silhouette against it, their
//               gold4 tips the brightest point (the focus). Sky: the WIND bands (night0 / leaf0), a night0 steppe floor
//               with the leaf1 horizon line and two flat leaf1 grass tufts; a foreground clump of feather grass (leaf
//               blades, white plumes) under the leap fills the lower left. The shadow-side rim is the sun's gold2.
// small (44×34) the SAME picture, closer: a 1:1 crop of the same sprite frame — horns, head with the drooping nose,
//               the forequarters — on the same sun (hand-placed for the 1× window, not a reduction).
// Living (3 frames, 160 ms): the horn-tip wind curls peel off and drift back (the whistle), the mane ripples.
// Colours only from PAL.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { drawSpiralhorn, H, W, type Pose } from '../monsters-v3/steppe_spiralhorn-rig';
import { summonPose } from '../monsters-v3/steppe_spiralhorn-anims';
import { paintBackdrop, rim, type BackdropRecipe } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

/** The near horn tip in BIG px (the focus) and in SMALL px. */
const FOCUS = [60, 10] as const;
const FOCUS_SMALL = [15, 5] as const;
/** Sprite frame → picture offsets (frame px + offset = picture px, 1:1). */
const BIG_AT = [5, -4] as const;
const SMALL_AT = [-40, -9] as const;

/** WIND's sky, floor and horizon; the sunset's stepped disc and rim in gold (the setting sun). */
const SUNSET: BackdropRecipe = {
  kind: 'WIND',
  shape: 'sun',
  tones: [PAL.gold1, PAL.gold2],
  sky: [PAL.night0, PAL.leaf0],
  split: 30,
  floor: PAL.night0,
  horizonLine: PAL.leaf1,
  rim: PAL.gold2,
};

const CURL = [0.15, 0.45, 0.75] as const;

function leapPose(f: number): Pose {
  return { ...summonPose(1), wake: -1, dust: -1, seeds: -1, mane: f / 3 };
}

/** The sprite frame as matter (no light) and its light (the wind curls) separately. */
function sprite(f: number): { body: PixelCanvas; light: PixelCanvas } {
  const body = new PixelCanvas(W, H);
  drawSpiralhorn(body, { ...leapPose(f), curl: -1 }, 'left');
  const all = new PixelCanvas(W, H);
  drawSpiralhorn(all, { ...leapPose(f), curl: CURL[f % CURL.length] }, 'left');
  const light = new PixelCanvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = all.get(x, y);
      if (c !== null && c !== body.get(x, y)) light.set(x, y, c);
    }
  return { body, light };
}

/** A foreground clump of feather grass (Stipa): leaning blades and two white plumes, outlined. */
function grassClump(w: number, h: number, x0: number, y0: number): PixelCanvas {
  const q = new PixelCanvas(w, h);
  const blades: [number, number, number][] = [
    [0, 13, 4],
    [4, 16, 5],
    [8, 12, 4],
    [11, 9, 3],
  ];
  for (const [dx, hh, lean] of blades) {
    const bx = x0 + dx;
    q.poly(
      [
        [bx, y0],
        [bx + 3, y0],
        [bx + 2 + lean, y0 - hh],
      ],
      PAL.leaf2,
    );
  }
  // planes: the light-facing (left) edge leaf3, the rest leaf2, the base leaf1
  const src = q.clone();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!src.isOpaque(x, y)) continue;
      if (y >= y0 - 2) q.set(x, y, PAL.leaf1);
      else if (!src.isOpaque(x - 1, y)) q.set(x, y, PAL.leaf3);
    }
  q.outline(PAL.ink);
  return q;
}

function plumes(p: PixelCanvas, pts: readonly (readonly [number, number])[]): void {
  for (const [x, y] of pts) {
    p.set(x, y, PAL.white).set(x + 1, y, PAL.white).set(x + 1, y - 1, PAL.white).set(x + 2, y - 1, PAL.mist);
  }
}

function big(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, SUNSET, { focus: [56, 20], radius: 26 });
  // two flat steppe tufts on the floor band (the horizon line's tone)
  for (const [x, w] of [[6, 7], [70, 9]] as const) for (let i = 0; i < w; i++) l.backdrop.vline(x + i, 50 - ((i * 3) % 3) - (i % 2), 50, PAL.leaf1);
  const s = sprite(f);
  l.subject.blit(grassClump(88, 68, 26, 67), 0, 0);
  l.subject.blit(s.body, BIG_AT[0], BIG_AT[1]);
  rim(l.subject, PAL.gold2, { skip: [PAL.gold3, PAL.gold4, PAL.white, PAL.mist] });
  l.light.blit(s.light, BIG_AT[0], BIG_AT[1]);
  plumes(l.light, [
    [30, 52],
    [38, 50],
  ]);
}

function small(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, SUNSET, { focus: [28, 16], radius: 26 });
  const s = sprite(f);
  l.subject.blit(s.body, SMALL_AT[0], SMALL_AT[1]);
  rim(l.subject, PAL.gold2, { skip: [PAL.gold3, PAL.gold4, PAL.white, PAL.mist] });
  l.light.blit(s.light, SMALL_AT[0], SMALL_AT[1]);
}

const art: CardArtV3 = {
  id: 'steppe_spiralhorn',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 3,
  holdMs: 160,
  big,
  small,
};

export default art;
