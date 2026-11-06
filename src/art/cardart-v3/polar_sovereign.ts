// Card art v3 — Kutup Hükümdarı (polar_sovereign, EARTH, the Kutup family's ace): the sprite's own pixels, 1:1, in a
// new composition (style sheet docs/v3/KART_RESIMLERI.md §5, contract ./_types.ts; YENI_KARTLAR §C15 "alçak açıdan
// Hükümdar, mızrak kalkık, arkada pusula gülü biçimli alan çizgileri").
//
// big (88×68)   a low view of the sovereign filling the card: the compass spear raised high in the fist, the crown
//               spinning wide on its pin, the copper chest blazing (the core seam white-hot = the card's brightest
//               point, the EARTH sun behind it), the needle pauldrons spread; behind him a compass rose of field lines
//               (eight rays, the N ray longest) drawn one tone up on the backdrop, iron dust riding them.
//               In front of the backdrop the rose is drawn again as FIELD LINES in the two poles: the rays and the
//               dial behind his back half in fire (N), behind his front half in water (S) — the orange-left /
//               blue-right split of the storyboard, echoed by the sprite's own pole rims.
// small (44×34) the SAME picture at half size (the whole figure: crown, raised spear point, the pole split, the
//               plinth's top at the frame's foot): the big subject reduced, the backdrop and rose native.
// Living (4 frames, 160 ms): the crown turns, the rings climb the chest, the rose rays flow outward.
// Colours only from PAL (the sprite's tones folded to the card budget).

import { PixelCanvas } from '../pixel';
import { PAL } from '../palette';
import { drawSovereign, pose, skeleton, W as SW, H as SH } from '../monsters-v3/polar_sovereign-rig';
import { newLayers, paintBackdrop, recolor, reduceLight, reduceSubject } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

/** sprite frame → big picture offset (frame px → picture px 1:1) */
const BIG_DX = -11;
const BIG_DY = -12;

const cardPose = (f: number) =>
  pose({
    nx: 24, ny: -50, sa: -98, fx: -27, fy: -42, eye: 2, core: 3, rings: 2, climb: 0.1 + (f % 4) / 16,
    rose: (f % 4) / 16, roseY: 1, poleN: 2, poleS: 2, tip: 2.5, dust: -1, spool: (f % 4) / 8, t: f / 4,
  });

const CORE = skeleton(cardPose(0)).core;
const FOCUS = [CORE[0] + BIG_DX, CORE[1] + BIG_DY] as const;
/** the small picture's focus: the same chest core at half size */
const FOCUS_SMALL = [Math.floor(FOCUS[0] / 2), Math.floor(FOCUS[1] / 2)] as const;

/** The card's tone budget (≤ 20 with the backdrop): the sprite's rarest tones folded into their neighbours. */
const FOLD: Readonly<Record<number, number>> = {
  [PAL.stone4]: PAL.stone3,
  [PAL.mist]: PAL.steel,
  [PAL.gold0]: PAL.gold1,
  [PAL.night2]: PAL.stone0,
  [PAL.skin3]: PAL.gold4,
  [PAL.fire0]: PAL.ink,
  [PAL.water0]: PAL.stone0,
  [PAL.water1]: PAL.water2,
  [PAL.water3]: PAL.water4,
  [PAL.cyan4]: PAL.white,
  [PAL.gold2]: PAL.gold1,
  [PAL.fire1]: PAL.fire2,
};

function sprite(f: number): PixelCanvas {
  const p = new PixelCanvas(SW, SH);
  drawSovereign(p, cardPose(f), 'left');
  return recolor(p, FOLD);
}

/** One step up the backdrop's own tones (field lines never add a tone: they brighten what is under them). */
const UP: Readonly<Record<number, number>> = { [PAL.stone0]: PAL.earth0, [PAL.earth0]: PAL.earth1, [PAL.earth1]: PAL.earth2, [PAL.earth2]: PAL.earth3 };

/** The compass rose of field lines behind him: eight rays from the chest (N ray longest), dashed, flowing out. */
function roseLines(p: PixelCanvas, cx: number, cy: number, f: number): void {
  const tones = new Set<number>();
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const c = p.get(x, y);
    if (c !== null) tones.add(c);
  }
  for (let k = 0; k < 8; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 4;
    const len = k === 0 ? 70 : k % 2 ? 34 : 52;
    let lx = NaN;
    let ly = NaN;
    for (let i = 6; i < len; i++) {
      // flowing out: dashes march outward a step per frame
      if (((i >> 2) - f) % 3 === 0) continue;
      const x = Math.round(cx + Math.cos(a) * i);
      const y = Math.round(cy + Math.sin(a) * i * 0.8);
      if (x === lx && y === ly) continue;
      lx = x;
      ly = y;
      const c = p.get(x, y);
      if (c === null) continue;
      const up = UP[c];
      if (up !== undefined && tones.has(up)) p.set(x, y, up);
    }
  }
  // the rose's dial: a ring round the chest, one tone up
  for (let i = 0; i < 120; i++) {
    if ((i + f * 2) % 6 === 5) continue;
    const a = (i / 120) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * 30);
    const y = Math.round(cy + Math.sin(a) * 24);
    const c = p.get(x, y);
    if (c === null) continue;
    const up = UP[c];
    if (up !== undefined && tones.has(up)) p.set(x, y, up);
  }
}

/** The rose's field lines in the two poles, behind the figure (subject layer, under the sprite): rays from the
 *  chest (dashed, flowing out a step a frame), the back half fire, the front half water, and a two-colour dial. */
function poleField(p: PixelCanvas, cx: number, cy: number, f: number, box: { x0: number; y0: number; x1: number; y1: number }): void {
  const inBox = (x: number, y: number) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1;
  const col = (x: number, hot: boolean) => (x < cx ? (hot ? PAL.fire3 : PAL.fire2) : hot ? PAL.water4 : PAL.water2);
  for (let k = 0; k < 8; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 4 + Math.PI / 8;
    const len = k % 2 ? 40 : 54;
    for (let i = 34; i < len; i++) {
      if (((i >> 1) - f) % 4 === 0) continue;
      const x = Math.round(cx + Math.cos(a) * i);
      const y = Math.round(cy + Math.sin(a) * i * 0.78);
      if (!inBox(x, y) || p.isOpaque(x, y)) continue;
      p.set(x, y, col(x, i > len - 6));
    }
  }
  for (let i = 0; i < 140; i++) {
    if ((i + f * 3) % 7 >= 5) continue;
    const a = (i / 140) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * 38);
    const y = Math.round(cy + Math.sin(a) * 30);
    if (!inBox(x, y) || p.isOpaque(x, y)) continue;
    p.set(x, y, col(x, false));
  }
}

function big(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'EARTH', { focus: FOCUS });
  roseLines(l.backdrop, FOCUS[0], FOCUS[1], f);
  l.subject.blit(sprite(f), BIG_DX, BIG_DY);
  // the field lines live inside the figure's own box (behind it: never over a body pixel)
  const b = l.subject.bounds();
  if (b) poleField(l.subject, FOCUS[0], FOCUS[1], f, { x0: b.x, y0: b.y, x1: b.x + b.w - 1, y1: b.y + b.h - 1 });
  const [fx, fy] = FOCUS;
  l.light.set(fx, fy, PAL.white).set(fx - 1, fy, PAL.white).set(fx + 1, fy, PAL.white);
}

function small(l: ArtLayers, f: number, bigL?: ArtLayers): void {
  const B = bigL ?? (() => {
    const b = newLayers('big');
    big(b, f);
    return b;
  })();
  paintBackdrop(l.backdrop, 'EARTH', { focus: FOCUS });
  roseLines(l.backdrop, FOCUS_SMALL[0], FOCUS_SMALL[1], f);
  l.subject.blit(reduceSubject(B.subject), 0, 0);
  l.light.blit(reduceLight(B.light), 0, 0);
  const [fx, fy] = FOCUS_SMALL;
  l.light.set(fx, fy, PAL.white);
}

const art: CardArtV3 = {
  id: 'polar_sovereign',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 160,
  big,
  small,
};

export default art;
