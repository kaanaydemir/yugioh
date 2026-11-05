// Card art v3 — Kutup Bobini (polar_coil, EARTH, Kutup ailesi): the sprite's own pixels, 1:1, in a new composition
// (style sheet docs/v3/KART_RESIMLERI.md §5, contract ./_types.ts; YENI_KARTLAR §C14 "ışıklı sarımlar, iki renkli
// çekirdek, yörüngede dikenler").
//
// big (88×68)   the living coil fully charged: both wire whips flung up, the light rings blazing up the copper turns,
//               the two-colour core slit white-hot (the card's brightest point, the EARTH sun sits behind it), three
//               iron-dust spikes orbiting it on an ellipse, their grain wake strung out behind them.
// small (44×34) the SAME picture, closer: a 1:1 crop of the sprite — helm and visor, the shoulder spools, the upper
//               winding and the core slit — with the three spikes drawn close in on a tilted orbit round the drum
//               (N crossing in front, S off the side, gold behind), the core slit still the brightest point.
// Living (4 frames, 160 ms): the spikes advance on their orbit, the rings climb a row, the spools turn.
// Colours only from PAL (the sprite's tones folded to the card budget).

import { PixelCanvas } from '../pixel';
import { PAL } from '../palette';
import { drawCoil, pose, skeleton, W as SW, H as SH } from '../monsters-v3/polar_coil-rig';
import { paintBackdrop, recolor } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

/** sprite frame → big picture offset (frame px → picture px 1:1) */
const BIG_DX = -5;
const BIG_DY = -6;
/** the sprite frame's crop that is the small picture */
const SMALL_CROP = [27, 19, 44, 34] as const;

const cardPose = (f: number) =>
  pose({
    nwx: 15, nwy: -12, nlag: -3, fwx: -14, fwy: -10, flag: 3,
    eye: 2, core: 2.6, ringB: 2, rings: 2, climb: 0.18 + (f % 4) / 26,
    sg: 1, orb: 0.855 + (f % 4) / 60, spinN: (f % 4) / 12, spinF: -(f % 4) / 12, dust: -1, t: f / 4,
  });

const CORE = skeleton(cardPose(0)).core;
const FOCUS = [CORE[0] + BIG_DX, CORE[1] + BIG_DY] as const;
const FOCUS_SMALL = [CORE[0] - SMALL_CROP[0], CORE[1] - SMALL_CROP[1]] as const;

/** The card's tone budget (≤ 20 with the backdrop): the sprite's rarest tones folded into their neighbours. */
const FOLD: Readonly<Record<number, number>> = {
  [PAL.stone4]: PAL.stone3,
  [PAL.gold0]: PAL.gold2,
  [PAL.night2]: PAL.stone0,
  [PAL.mist]: PAL.stone3,
  [PAL.skin3]: PAL.gold4,
  [PAL.fire0]: PAL.ink,
  [PAL.gold1]: PAL.gold2,
  // the S pole keeps its own blue (water4 core, water2 shaft): never folded to white
  [PAL.water1]: PAL.water2,
  [PAL.water3]: PAL.water4,
  [PAL.water0]: PAL.stone0,
  [PAL.steel]: PAL.stone3,
  [PAL.cyan4]: PAL.white,
};

function sprite(f: number, spikes = true): PixelCanvas {
  const p = new PixelCanvas(SW, SH);
  drawCoil(p, spikes ? cardPose(f) : { ...cardPose(f), sg: 0 }, 'left');
  return recolor(p, FOLD);
}

/** One step up the backdrop's own tones (field lines never add a tone: they brighten what is under them). */
const UP: Readonly<Record<number, number>> = { [PAL.stone0]: PAL.earth0, [PAL.earth0]: PAL.earth1, [PAL.earth1]: PAL.earth2, [PAL.earth2]: PAL.earth3 };

/**
 * The solenoid's magnetic field on the backdrop: loops leaving the top of the coil, swinging wide round both sides
 * and returning into its bottom (a 1-px line one tone up from the backdrop under it), drifting out with the frame.
 */
function fieldLines(p: PixelCanvas, cx: number, cy: number, f: number): void {
  const tones = new Set<number>();
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const c = p.get(x, y);
    if (c !== null) tones.add(c);
  }
  for (const side of [-1, 1])
    for (let k = 0; k < 3; k++) {
      const rx = 16 + k * 9 + (f % 4 === 3 ? 1 : 0);
      const ry = 22 + k * 5;
      let lx = NaN;
      let ly = NaN;
      for (let i = 0; i <= 160; i++) {
        const a = -Math.PI / 2 + (i / 160) * Math.PI;
        const x = Math.round(cx + side * Math.cos(a) * rx);
        const y = Math.round(cy + Math.sin(a) * ry);
        if (x === lx && y === ly) continue;
        lx = x;
        ly = y;
        // dashed by the frame: the field "flows" out of the top
        if (((i >> 3) + f + k) % 4 === 3) continue;
        const c = p.get(x, y);
        if (c === null) continue;
        const up = UP[c];
        if (up !== undefined && tones.has(up)) p.set(x, y, up);
      }
    }
}

/** The dust orbit: an ellipse of iron grains round the drum (back half behind the body, front half over it). */
function dustOrbit(subject: PixelCanvas, light: PixelCanvas, cx: number, cy: number, rx: number, ry: number, f: number): void {
  for (let i = 0; i < 64; i++) {
    if ((i + f * 2) % 4 === 3) continue;
    const a = (i / 64) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * rx);
    const y = Math.round(cy + Math.sin(a) * ry);
    if (x < 0 || y < 0 || x >= subject.w || y >= subject.h) continue;
    const front = Math.sin(a) > 0;
    if (!front && subject.get(x, y) !== null) continue;
    const c = (i + f) % 3 === 0 ? PAL.gold3 : PAL.stone3;
    if (front) light.set(x, y, c);
    else subject.set(x, y, c);
  }
}

function big(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'EARTH', { focus: FOCUS });
  const sk = skeleton(cardPose(f));
  fieldLines(l.backdrop, sk.cx + BIG_DX, sk.core[1] + BIG_DY, f);
  l.subject.blit(sprite(f), BIG_DX, BIG_DY);
  dustOrbit(l.subject, l.light, sk.cx + BIG_DX, sk.core[1] + BIG_DY + 1, sk.rx + 15, 7, f);
  // the hottest pixel of the core slit (light, never outlined)
  const [fx, fy] = FOCUS;
  l.light.set(fx, fy, PAL.white).set(fx - 1, fy, PAL.white).set(fx + 1, fy, PAL.white);
}

/** The spikes' pole colours: S (water: the one crossing the copper in front), N (fire), the gold binder — [head, lit, mid]. */
const SPIKE = [
  [PAL.water4, PAL.water4, PAL.water2],
  [PAL.fire4, PAL.fire3, PAL.fire2],
  [PAL.gold4, PAL.gold3, PAL.gold2],
] as const;

/**
 * An iron-dust spike for the small picture: a 7-px dart along (dx, dy) — mid body, a lit upper facet, an ink outline,
 * the hot head in the light layer (never outlined). `behind`: only where the subject is empty (the far half of the orbit).
 */
function dart(subject: PixelCanvas, light: PixelCanvas, x: number, y: number, dx: number, dy: number, i: number, behind: boolean): void {
  const q = new PixelCanvas(subject.w, subject.h);
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const [head, lit, mid] = SPIKE[i];
  const tip: [number, number] = [x + ux * 5, y + uy * 5];
  const back: [number, number] = [x - ux * 4, y - uy * 4];
  const nx = -uy * 2;
  const ny = ux * 2;
  q.poly([tip, [x + nx, y + ny], back, [x - nx, y - ny]], mid);
  q.poly([tip, [x + (ny < 0 ? nx : -nx), y + (ny < 0 ? ny : -ny)], [x, y]], lit);
  q.outline(PAL.ink);
  for (let yy = 0; yy < q.h; yy++)
    for (let xx = 0; xx < q.w; xx++) {
      const c = q.get(xx, yy);
      if (c === null || (behind && subject.get(xx, yy) !== null)) continue;
      subject.set(xx, yy, c);
    }
  if (!behind) {
    light.set(Math.round(tip[0] - ux), Math.round(tip[1] - uy), head);
    light.set(Math.round(tip[0]), Math.round(tip[1]), PAL.white);
  }
}

function small(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'EARTH', { focus: FOCUS_SMALL, horizon: 26, radius: 14 });
  const sk = skeleton(cardPose(f));
  fieldLines(l.backdrop, sk.cx - SMALL_CROP[0], sk.core[1] - SMALL_CROP[1], f);
  // the body without the rig's spikes (they orbit outside this crop): the card draws its own three, close in
  l.subject.blit(sprite(f, false).crop(SMALL_CROP[0], SMALL_CROP[1], SMALL_CROP[2], SMALL_CROP[3]), 0, 0);
  // "yörüngede dikenler": a tilted orbit round the drum at the core's height; its dust ellipse, then three spikes on
  // it a third of a turn apart — S (blue: it reads on the copper) crossing in front, N off the left side, gold off
  // the right shoulder behind — turning a step per frame
  const ox = sk.cx - SMALL_CROP[0];
  const oy = FOCUS_SMALL[1] + 1;
  const RX = 19;
  const RY = 6;
  dustOrbit(l.subject, l.light, ox, oy, RX, RY, f);
  for (let i = 0; i < 3; i++) {
    const a = Math.PI * 0.42 + (i * Math.PI * 2) / 3 - (f % 4) * 0.08;
    const x = Math.round(ox + Math.cos(a) * RX);
    const y = Math.round(oy + Math.sin(a) * RY);
    // heading along the orbit (counter-clockwise on screen) with a little tilt into it
    const dx = Math.sin(a);
    const dy = -Math.cos(a) * 0.45;
    dart(l.subject, l.light, x, y, dx, dy, i, Math.sin(a) < -0.1);
  }
  const [fx, fy] = FOCUS_SMALL;
  l.light.set(fx, fy, PAL.white).set(fx - 1, fy, PAL.white);
}

const art: CardArtV3 = {
  id: 'polar_coil',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 160,
  big,
  small,
};

export default art;
