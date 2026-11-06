// Card art v3 — Bozkır Boynuzlusu (steppe_spiralhorn, WIND beast): "batan güneşin önünde havada antilop, sarmal
// boynuzlar silüet" (YENI_KARTLAR C11). Style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts.
//
// big (88×68)   the saiga IN THE AIR, mid-bound, legs stretched fore and aft — the board sprite's own pixels, 1:1, drawn
//               from the rig in its long-bound pose (never scaled) — over the open STEPPE at dusk (r4: no sun disc, which
//               was crystal_wyrm's gold halo): a two-band dusk sky (night0 → the WIND leaf0 glow low over the land), a
//               few white feather-grass plumes drifting in it, a low wide horizon of stepped grass tufts (a leaf1 band,
//               leaf2 lit tops) and, filling the lower third behind the hooves, grass blades bending leeward in the wind;
//               a foreground clump of feather grass under the leap. The two corkscrew horns stand against the leaf0
//               glow, their gold4 tips the brightest point (the focus). The shadow-side rim is the WIND leaf3.
// small (44×34) the SAME picture, closer: a 1:1 crop of the same sprite frame — horns, head with the drooping nose,
//               the forequarters — over the same horizon (hand-placed for the 1× window, not a reduction).
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

/** The steppe at dusk: WIND's two sky bands (night0 → leaf0 low over the land), a night0 floor, the leaf1 horizon line
 *  and a WIND rim (leaf2, a value under the mane); no light disc (the land's own grass horizon is the picture). */
const STEPPE: BackdropRecipe = {
  kind: 'WIND',
  shape: 'gust',
  tones: [PAL.leaf1, PAL.leaf2],
  sky: [PAL.night0, PAL.leaf0],
  split: 24,
  floor: PAL.night0,
  horizonLine: PAL.leaf1,
  rim: PAL.leaf2,
};

/** The grass horizon: a leaf1 band of stepped tufts (2-px steps) with leaf2 lit tops, `hz` = the floor's first row. */
function horizon(p: PixelCanvas, hz: number, k: number): void {
  const w = p.w;
  for (let x = 0; x < w; x++) {
    // tufts: a slow swell and a 2-px step pattern, never a ruler
    const h = Math.round((3 + 2 * Math.sin(x * 0.21) + (((x >> 1) * 7) % 5 === 0 ? 2 : 0)) * k / 2) * 2;
    for (let y = hz - h; y < hz; y++) p.set(x, y, y === hz - h ? PAL.leaf2 : PAL.leaf1);
  }
}

/** The lower third: grass blades bending leeward (+x) in the wind, the lit (left) edge leaf2 on the near ones. */
function windGrass(p: PixelCanvas, y0: number, y1: number, f: number, step: number, hmin: number, hmax: number): void {
  for (let i = 0, x = 1; x < p.w; i++, x += step + (i % 3 === 0 ? 1 : 0)) {
    const h = hmin + ((i * 5) % (hmax - hmin + 1));
    const base = y1 - ((i * 3) % 3);
    // the gust leans every third blade one step further on alternate frames (the living picture)
    const lean = 3 + ((i + f) % 3 === 0 ? 1 : 0);
    for (let j = 0; j < h; j++) {
      const t = j / h;
      const xx = x + Math.round(lean * t * t * 1.6);
      const yy = base - j;
      if (yy < y0) break;
      p.set(xx, yy, PAL.leaf1);
      if (j < h - 2) p.set(xx + 1, yy, j > h * 0.4 ? PAL.leaf2 : PAL.leaf1);
    }
  }
}

/** Feather-grass plumes adrift in the sky: a white feather (4 px) with a mist fringe and tip. */
function skyPlume(p: PixelCanvas, x: number, y: number): void {
  // a soft tuft drifting level on the wind: two rows of white, a mist tip trailing
  p.set(x, y, PAL.white).set(x - 1, y, PAL.white).set(x - 2, y, PAL.white).set(x - 1, y - 1, PAL.white).set(x - 2, y - 1, PAL.mist).set(x - 3, y, PAL.mist).set(x + 1, y + 1, PAL.mist);
}

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
  paintBackdrop(l.backdrop, STEPPE, { shape: false, horizon: 44 });
  horizon(l.backdrop, 44, 1);
  // the lower third: grass bending in the wind behind the hooves (two depths: far, short; near, tall)
  windGrass(l.backdrop, 46, 54, f, 4, 3, 6);
  windGrass(l.backdrop, 50, 67, f + 1, 5, 7, 12);
  for (const [x, y] of [[14, 12], [30, 20], [82, 28], [8, 30]] as const) skyPlume(l.backdrop, x + (f % 2), y);
  const s = sprite(f);
  l.subject.blit(grassClump(88, 68, 26, 67), 0, 0);
  l.subject.blit(s.body, BIG_AT[0], BIG_AT[1]);
  rim(l.subject, STEPPE.rim, { skip: [PAL.gold3, PAL.gold4, PAL.white, PAL.mist] });
  l.light.blit(s.light, BIG_AT[0], BIG_AT[1]);
  plumes(l.light, [
    [30, 52],
    [38, 50],
  ]);
}

function small(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, STEPPE, { shape: false, horizon: 26, split: 12 });
  horizon(l.backdrop, 26, 0.6);
  windGrass(l.backdrop, 27, 33, f, 4, 3, 5);
  skyPlume(l.backdrop, 6 + (f % 2), 8);
  const s = sprite(f);
  l.subject.blit(s.body, SMALL_AT[0], SMALL_AT[1]);
  rim(l.subject, STEPPE.rim, { skip: [PAL.gold3, PAL.gold4, PAL.white, PAL.mist] });
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
