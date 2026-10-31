// Card art v3 — Uçurtma Eskrimci (kite_fencer, WIND warrior): "rising from his string, the kite cloak open, the rapier
// forward" (YENI_KARTLAR C9 "Kart resmi"; style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
//
// Source of the subject: the sprite rig itself (monsters-v3/kite_fencer-rig.ts drawFencer), posed for the picture and
// drawn 1:1 (never scaled): the fencer lifted off the floor, hanging under his fully open, billowed kite, legs dangling,
// the rapier thrust forward, the indicator panel lit (the card's mechanic: one more attack); the taut kite string runs
// from the kite's tail down out of the window's bottom-left — he rises FROM his string.
//   big (88×68)    the whole figure on the kit's WIND recipe: the gust arcs wrap the lit panel and the masked head.
//   small (44×34)  the SAME picture, closer (§1 rule 1): a 1:1 crop of the same frame on the head, the lit panel, the
//                  kite's crossing and the sword arm, with the gust arcs re-centred on the panel.
// Living (4 frames, 160 ms): the cloak breathes (billow 3 / 2), the ribbons flutter, the string hums 1 px.
// Colours only from PAL (the sprite and the kit); the panel's light is the brightest point (the focus).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { drawFencer, pose, type Pose } from '../monsters-v3/kite_fencer-rig';
import { paintBackdrop, recolor } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

/** Where the sprite frame's (0, 0) lands in the big picture, and the small picture's crop of the big one. */
const BIG_AT = [12, 4] as const;
const SMALL_CROP = [19, 5, 44, 34] as const;
/** The lit indicator panel (big px) — the brightest point — and the same point in small px. */
const FOCUS = [40, 22] as const;
const FOCUS_SMALL = [16, 16] as const;

const LOOP: readonly Partial<Pose>[] = [
  { kbl: 2, rph: 0, svib: 0 },
  { kbl: 2, rph: 0.25, svib: 1 },
  { kbl: 1, rph: 0.5, svib: 0 },
  { kbl: 1, rph: 0.75, svib: -1 },
];

/** The picture pose: lifted, hanging under the open kite, the rapier forward, the panel lit, the string taut. */
function cardPose(f: number): Pose {
  return pose({
    lift: 3,
    sink: 0,
    lean: 1,
    f1x: -5,
    f1y: -2,
    f2x: 3,
    f2y: -1,
    hx: 14,
    hy: 0,
    ba: -8,
    fx: -2,
    fy: -16,
    kx: -8,
    ky: -11,
    ka: 2,
    ko: 1.1,
    kh: 0.9,
    smode: 1,
    pinX: 4,
    pinY: 80,
    rlift: 2,
    lamp: 2,
    glint: 0,
    ...LOOP[f % LOOP.length],
  });
}

function sprite(f: number): PixelCanvas {
  const p = new PixelCanvas(72, 64);
  drawFencer(p, cardPose(f), 'left');
  return p;
}

function big(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'WIND', { focus: FOCUS, pool: false });
  const s = sprite(f);
  // matter → subject, the light pixels (panel, glint) → light: split by colour of the light-only tones
  l.subject.blit(s, BIG_AT[0], BIG_AT[1]);
  // colour budget (≤ 20): the shoes' deepest tone folds into the next one up
  recolor(l.subject, { [PAL.earth0]: PAL.earth1 });
  splitLight(l);
}

function small(l: ArtLayers, f: number, b: ArtLayers): void {
  paintBackdrop(l.backdrop, 'WIND', { focus: [FOCUS_SMALL[0] * 2, FOCUS_SMALL[1] * 2], horizon: 24, radius: 26 });
  const [x, y, w, h] = SMALL_CROP;
  l.subject.blit(b.subject.crop(x, y, w, h), 0, 0);
  l.light.blit(b.light.crop(x, y, w, h), 0, 0);
}

/** Move the panel's emissive pixels from the subject to the light layer (they are light, not matter: IŞ-9). */
function splitLight(l: ArtLayers): void {
  const s = l.subject;
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const c = s.get(x, y);
      if (c === null) continue;
      if (c === PAL.gold4 || c === PAL.fire4 || c === PAL.white) {
        l.light.set(x, y, c);
        // the matter under it: the panel's own cloth tone
        s.set(x, y, PAL.fire3);
      }
    }
}

const art: CardArtV3 = {
  id: 'kite_fencer',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 160,
  big,
  small,
};

export default art;
