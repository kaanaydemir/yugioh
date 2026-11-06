// Card art v3 — Kadran Soytarısı (dial_jester, LIGHT, Büyücü): the sprite's own pixels, 1:1, in a new composition
// (style sheet docs/v3/KART_RESIMLERI.md §5, contract ./_types.ts; YENI_KARTLAR §C2 "Takla atan soytarı parayı
// kaldırmış, arkada kareyi dolduran kadran").
//
// big (88×68)   the jester mid-somersault, legs tucked, the gold coin flung up in the near hand, in front of a giant
//               midnight clock dial that fills the frame (gold bezel, 12 marks, the two hands one tick before
//               twelve). The brightest point is the coin's rim glint; the LIGHT halo sits behind the coin.
// small (44×34) the SAME picture, closer: a 1:1 crop of the sprite — the dial face, the cap's points and the coin —
//               on the giant dial's upper arc.
// Living (4 frames, 150 ms): the coin flips a quarter (face → edge → face), the cogs turn, the giant minute hand
// trembles on the last tick. Colours only from PAL.

import { PixelCanvas } from '../pixel';
import { PAL } from '../palette';
import { drawJester, pose, skeleton, H as SH, W as SW } from '../monsters-v3/dial_jester-rig';
import { clockDir } from '../monsters-v3/dial_jester-kit';
import { ink, paintBackdrop } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

const CW = [1, 0.7, 1, 0.85];
const SPIN = -28;
/** A hand target given in SCREEN px (rel the root, lifted by `air`) → the rig's body-frame target (the rig turns
 *  hand targets with the body about the mid-body bc = (0, −19)). */
function bodyTarget(x: number, y: number): [number, number] {
  const a = (-SPIN * Math.PI) / 180;
  const vx = x;
  const vy = y + 19;
  return [Math.round(vx * Math.cos(a) - vy * Math.sin(a)), Math.round(vx * Math.sin(a) + vy * Math.cos(a) - 19)];
}
const NEAR = bodyTarget(13, -36);
const FAR = bodyTarget(-13, -26);
const cardPose = (f: number) =>
  pose({
    air: 7, spin: SPIN, tuck: 0.85, lean: 0, nx: NEAR[0], ny: NEAR[1], fx: FAR[0], fy: FAR[1], mouth: 3, eye: 1.8, look: 1,
    hour: 300, min: 60, cw: CW[f % 4], gear: (f % 4) / 8, key: 40 + (f % 4) * 45, h1x: -1, h2x: 1, h1y: 1, h2y: 1,
  });

/** Where the sprite frame sits in the big picture, and the small crop (sprite px → picture px 1:1). */
const BIG_DX = 19;
const BIG_DY = -8;
const SMALL_CROP = [10, 17, 44, 34] as const;
/** The coin centre (frame px) — the card's brightest point sits on its upper-left rim. */
const COIN = skeleton(cardPose(0)).coinC;
const FOCUS = [Math.round(COIN[0] + BIG_DX - 3), Math.round(COIN[1] + BIG_DY - 4)] as const;
const FOCUS_SMALL = [Math.round(COIN[0] - SMALL_CROP[0] - 3), Math.round(COIN[1] - SMALL_CROP[1] - 4)] as const;

function sprite(f: number): PixelCanvas {
  const p = new PixelCanvas(SW, SH);
  drawJester(p, cardPose(f), 'left');
  return p;
}

/** The giant dial behind: a gold bezel ring, a midnight face lit from the top-left, 12 marks, two hands. */
function bigDial(s: PixelCanvas, cx: number, cy: number, r: number, f: number, k: number): void {
  const lit = (x: number, y: number) => (x - cx) * -0.56 + (y - cy) * -0.83;
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > r) continue;
      const l = lit(x + 0.5, y + 0.5) / Math.max(1, d);
      if (d > r - 3 * k) s.set(x, y, l > 0.35 ? PAL.gold3 : l < -0.4 ? PAL.gold1 : PAL.gold2);
      else if (d > r - 3 * k - 1) s.set(x, y, PAL.gold0);
      else s.set(x, y, l > 0.2 && d > r * 0.45 ? PAL.night3 : PAL.night2);
    }
  // marks: quarters long (gold), the rest short (mist)
  for (let i = 0; i < 12; i++) {
    const [ux, uy] = clockDir(i * 30);
    const q = i % 3 === 0;
    const r0 = r - 3 * k - 1 - (q ? 4 * k : 2 * k);
    const r1 = r - 3 * k - 1.5;
    for (let t = r0; t <= r1; t += 0.5)
      for (let w = 0; w < (q ? 2 : 1) * k; w++) s.set(Math.round(cx - 0.5 + ux * t - uy * w * 0.6), Math.round(cy - 0.5 + uy * t + ux * w * 0.6), q ? PAL.gold3 : PAL.mist);
  }
  // hands: one tick before twelve (the minute hand trembles on its last tick)
  const hand = (a: number, L: number, wd: number, c: number) => {
    const [ux, uy] = clockDir(a);
    for (let t = 0; t <= L; t += 0.5)
      for (let w = -wd / 2; w <= wd / 2; w += 0.5) s.set(Math.round(cx - 0.5 + ux * t - uy * w), Math.round(cy - 0.5 + uy * t + ux * w), c);
  };
  hand(352, r * 0.45, 2.2 * k, PAL.gold2);
  hand(354 + [0, 1.5, 0, -1][f % 4], r * 0.72, 1.2 * k, PAL.gold3);
  s.disc(cx, cy, 2 * k, PAL.gold3);
  s.set(Math.round(cx - 1), Math.round(cy - 1), PAL.gold4);
}

function big(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'LIGHT', { focus: FOCUS, radius: 18 });
  const s = l.subject;
  bigDial(s, 38, 37, 31, f, 1);
  ink(s);
  const sp = sprite(f);
  s.blit(sp, BIG_DX, BIG_DY);
  // light: the coin rim blazes (the card's brightest pixel)
  const [fx, fy] = FOCUS;
  l.light.rect(fx, fy, 2, 2, PAL.white);
  for (const [dx, dy] of [[-2, 0], [3, 0], [0, -2], [0, 3]] as const) l.light.set(fx + dx, fy + dy, PAL.gold4);
}

function small(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'LIGHT', { focus: FOCUS_SMALL, horizon: 40, radius: 12 });
  const s = l.subject;
  bigDial(s, 8, 34, 26, f, 1);
  ink(s);
  const sp = sprite(f).crop(SMALL_CROP[0], SMALL_CROP[1], SMALL_CROP[2], SMALL_CROP[3]);
  s.blit(sp, 0, 0);
  const [fx, fy] = FOCUS_SMALL;
  l.light.set(fx, fy, PAL.white).set(fx + 1, fy, PAL.gold4).set(fx, fy + 1, PAL.gold4);
}

const art: CardArtV3 = {
  id: 'dial_jester',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 150,
  big,
  small,
};

export default art;
