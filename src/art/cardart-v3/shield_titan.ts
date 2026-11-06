// Card art v3 — Kalkan Devi (shield_titan, EARTH warrior): a close-up of the wall waking (style sheet
// docs/v3/KART_RESIMLERI.md, contract ./_types.ts; design docs/v3/oturum-f/shield_titan.md §5).
//
// big   a NATIVE card-density painting (round 1: the EPX of the sprite crop is gone): a low camera up at the wall,
//       the tower shield filling x 30–80 and bleeding off the bottom, four rounded knuckles and fingertips hooked over
//       its arched rim, the sunstone boss at (54, 30) as the focus (iris rings in the light layer), the old giant's
//       bald dome, white brow, lit eye and white beard fully inside the frame past the shield's back edge.
// small the sprite's own pixels cropped to the bust (1× density), corrected by hand (the eye, the brow).
// Ground: the kit's EARTH recipe (horizon 48); rim earth3. The 16×12 mini card reads: a copper bar, a gold dot, a white blob.
// Living (2 frames, 260 ms): the sunstone breathes (core ↔ white-hot) and the iris ring steps out.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { W, H, drawTitan, pose } from '../monsters-v3/shield_titan-rig';
import { ink, paintBackdrop, patch, recolor, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

/** The posed sprite on its own frame (outline included), lit from the left. */
function sprite(f: number): PixelCanvas {
  const p = new PixelCanvas(W, H);
  drawTitan(p, pose({ boss: f % 2 ? 3 : 2, iris: f % 2 ? 2 : 1, courses: 1, glint: 1, gx: 2, cy: -1, bx: 1, nu: 24 }), 'left');
  return p;
}

// crop box of the bust in sprite px (44 × 34): the head at the left third, the boss right of centre
const BX = 18;
const BY = 15;
const BW = 44;
const BH = 34;
/** Light tones (painted after the outline, never outlined). */
const LIGHT = new Set<number>([PAL.gold3, PAL.gold4]);

/** The card's tighter palette (≤ 20 tones with the backdrop): the deepest bronze, skin crease and beard seam fold into
 *  their neighbours, the copper glint into the light's white-gold. */
const MERGE: Readonly<Record<number, number>> = { [PAL.gold0]: PAL.earth0, [PAL.skin0]: PAL.earth0, [PAL.stone2]: PAL.stone3, [PAL.fire4]: PAL.gold4 };

function split(src: PixelCanvas): { body: PixelCanvas; light: PixelCanvas } {
  recolor(src, MERGE);
  const body = src.clone();
  const light = new PixelCanvas(src.w, src.h);
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const c = src.get(x, y);
      if (c !== null && LIGHT.has(c)) {
        light.set(x, y, c);
        body.set(x, y, PAL.gold1);
      }
    }
  return { body, light };
}

/** Hand corrections of the small picture (1× density): the eye's white catch-light and the brow's tuft. */
const EYE_PATCH = ['bw', 'ik'];
const EYE_KEY = { b: PAL.white, w: PAL.stone4, i: PAL.ink, k: PAL.skin1 } as const;

// ================================================================ big: a NATIVE card-density painting (round 1 #11)
//
// Low camera looking up at the wall: the tower shield fills x 30–80 and bleeds off the bottom, its arched top under the
// four hooked fingers (x 40–56), the sunstone boss at (54, 30) the brightest point (iris rings in the light layer);
// the old giant's bald head, white brow, lit eye and white beard peek past the shield's back (left) edge fully inside
// the frame, his shoulder mass bleeding off the lower left. Flat bands only, one key light from the upper left.

const SH_X0 = 30;
const SH_X1 = 80;
const BOSS: readonly [number, number] = [54, 30];
/** The arched top of the shield: row of its top edge per column. */
const shTop = (x: number): number => {
  const e = Math.abs(x + 0.5 - (SH_X0 + SH_X1) / 2) / ((SH_X1 - SH_X0) / 2);
  return 5 + Math.floor(5 * e * e);
};

function paintShield(q: PixelCanvas): void {
  for (let x = SH_X0; x <= SH_X1; x++) {
    const top = shTop(x);
    for (let y = top; y < 68; y++) {
      const fromL = x - SH_X0;
      const fromR = SH_X1 - x;
      const fromT = y - top;
      let c: number;
      if (fromL < 3 || fromR < 3 || fromT < 3) {
        // the bronze rim: lit on the left and the top, shade on the right
        const outer = fromL === 0 || fromR === 0 || fromT === 0;
        const lit = fromT < 3 || fromL < 3;
        c = outer ? (lit ? PAL.gold1 : PAL.earth0) : lit ? PAL.gold2 : PAL.gold1;
        // studs down the side rims every 6 px
        if (!outer && (fromL === 1 || fromR === 1) && fromT > 4 && (y - 2) % 6 === 0) c = fromL === 1 ? PAL.gold2 : PAL.gold1;
      } else {
        // the convex copper face: a lit band by the left rim, the sheen a third in, shade falling to the right
        const v = x - SH_X0 - 3;
        c = v < 3 ? PAL.fire2 : v < 9 ? PAL.fire3 : v < 21 ? PAL.fire2 : v < 36 ? PAL.fire1 : PAL.fire0;
        if (fromT === 3) c = c === PAL.fire3 ? PAL.fire2 : c === PAL.fire2 ? PAL.fire1 : PAL.fire0;
        // the bronze courses (masonry across the face): a lit top row, a shade row, rivets
        for (const cy of [44, 59]) {
          if (y === cy) c = (x - 2) % 5 === 0 ? PAL.gold1 : PAL.gold2;
          else if (y === cy + 1) c = PAL.gold1;
          else if (y === cy + 2) c = PAL.earth0;
          else if (y === cy - 1 && c !== PAL.fire0) c = c === PAL.fire3 ? PAL.fire2 : PAL.fire1;
        }
        // the course through the boss, broken by it
        if ((y === 29 || y === 30) && Math.abs(x - BOSS[0]) > 8) c = y === 29 ? PAL.gold2 : PAL.gold1;
        // the boss casts a crescent of shade down-right
        const dx = x - BOSS[0];
        const dy = y - BOSS[1];
        const d = Math.hypot(dx, dy);
        if (d < 10 && d >= 7.5 && dx + dy > 2) c = PAL.fire0;
      }
      q.set(x, y, c);
    }
  }
  // the boss: a bronze ring, a lit dome (upper left), the core (painted again as light)
  for (let y = BOSS[1] - 8; y <= BOSS[1] + 8; y++)
    for (let x = BOSS[0] - 8; x <= BOSS[0] + 8; x++) {
      const d = Math.hypot(x - BOSS[0], y - BOSS[1]);
      if (d > 7.5) continue;
      const lit = x - BOSS[0] + (y - BOSS[1]) < 0;
      q.set(x, y, d > 6.3 ? PAL.earth0 : d > 3.2 ? (lit ? PAL.gold2 : PAL.gold1) : PAL.gold1);
    }
  // the shield's back edge (its thickness), seen past the left rim
  for (let y = shTop(SH_X0) + 2; y < 68; y++) {
    q.set(SH_X0 - 1, y, PAL.gold1);
    q.set(SH_X0 - 2, y, PAL.earth0);
  }
}

function paintGiant(q: PixelCanvas): void {
  const disc = (cx: number, cy: number, r: number, c: number) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) q.set(x, y, c);
  };
  // the shoulder mass + upper arm bleeding off the lower left (skin bands: lit top-left, shade toward the shield)
  for (let y = 38; y < 68; y++)
    for (let x = 0; x <= 27; x++) {
      const shoulder = Math.hypot(x - 9, y - 47) <= 12;
      const arm = y >= 48 && x >= 2 && x <= 22 - Math.floor((y - 48) * 0.2);
      if (!shoulder && !arm) continue;
      const lit = Math.hypot(x - 5, y - 42) < 7;
      q.set(x, y, lit ? PAL.skin3 : x > 17 || y > 62 ? PAL.skin1 : PAL.skin2);
    }
  // the leather bracer on the forearm and the fist clamping the shield's back edge
  for (let y = 52; y < 58; y++) for (let x = 16; x <= 24; x++) q.set(x, y, y === 52 ? PAL.earth2 : y > 55 ? PAL.earth1 : PAL.earth2);
  disc(27, 55, 4.2, PAL.skin2);
  q.set(25, 53, PAL.skin3).set(26, 53, PAL.skin3).set(28, 56, PAL.skin1).set(29, 57, PAL.skin1);
  for (const ky of [54, 56]) q.set(29, ky, PAL.skin1);
  // the bald head: one smooth dome, a single ear below it
  disc(21, 23, 9.2, PAL.skin2);
  for (let y = 14; y < 33; y++)
    for (let x = 11; x < 31; x++) {
      if (q.get(x, y) !== PAL.skin2) continue;
      const d = Math.hypot(x - 18, y - 19);
      if (d < 6.5) q.set(x, y, PAL.skin3);
      else if (x > 26 || y > 29) q.set(x, y, PAL.skin1);
    }
  disc(13.5, 26.5, 2.2, PAL.skin1);
  q.set(13, 26, PAL.skin2);
  // the white bushy brow overhanging the eye, the eye with its catch-light, the nose
  for (let x = 20; x <= 30; x++) {
    q.set(x, 22, x < 27 ? PAL.white : PAL.stone4);
    if (x > 21) q.set(x, 23, PAL.stone4);
  }
  q.set(30, 21, PAL.stone4).set(29, 21, PAL.white);
  q.set(25, 25, PAL.ink).set(26, 25, PAL.ink).set(25, 24, PAL.skin1).set(26, 26, PAL.skin1).set(27, 25, PAL.white);
  for (let y = 25; y <= 28; y++) q.set(29, y, PAL.skin2).set(28, y, y < 27 ? PAL.skin3 : PAL.skin2);
  // the white beard: from under the nose, spilling down the shield's back edge, combed strands, a braid tie
  for (let y = 28; y <= 52; y++) {
    const k = (y - 28) / 24;
    const xl = Math.round(14 - 3 * Math.sin(k * Math.PI) + k * 6);
    const xr = Math.round(31 - k * 4);
    for (let x = xl; x <= xr; x++) {
      if (y > 49 && (x < xl + 3 || x > xr - 2)) continue;
      // combed strands: long 1-px stone3 runs, shifted one column every 8 rows (no checkers)
      const strand = (x - Math.floor((y - 28) / 8)) % 4 === 0 && y > 31 && x > xl + 1 && x < xr - 1;
      const shade = x >= xr - 1 || y > 47;
      q.set(x, y, strand ? PAL.stone3 : shade ? PAL.stone3 : x < xl + 2 ? PAL.white : PAL.stone4);
    }
  }
  // the moustache (brightest white, lit side) and the braid end
  for (let x = 20; x <= 30; x++) q.set(x, 29, x < 26 ? PAL.white : PAL.stone4);
  for (let y = 53; y <= 58; y++) for (let x = 22; x <= 24; x++) q.set(x, y, y === 53 ? PAL.earth2 : x === 24 || (y - 54) % 3 === 2 ? PAL.stone3 : PAL.stone4);
  // the four huge fingers hooked over the rim: a knuckle ridge above it, rounded tips over its front, 1-px gaps
  // the back of the hand: four rounded knuckles behind the rim (not a bar)
  for (let i = 0; i < 4; i++) {
    const kx = Math.round(40 + i * 4.5);
    for (let dx = 0; dx < 4; dx++) {
      q.set(kx + dx, 5, PAL.skin2);
      q.set(kx + dx, 4, dx === 0 ? PAL.skin3 : PAL.skin2);
      if (dx === 1 || dx === 2) q.set(kx + dx, 3, PAL.skin3);
    }
  }
  for (let i = 0; i < 4; i++) {
    const x0 = 40 + i * 4.5;
    const len = i === 1 || i === 2 ? 7 : 6;
    for (let y = 6; y <= 5 + len; y++)
      for (let dx = 0; dx < 4; dx++) {
        const x = Math.round(x0 + dx);
        const tip = y === 5 + len;
        if (tip && (dx === 0 || dx === 3)) continue;
        q.set(x, y, dx === 0 ? PAL.skin3 : y === 7 ? PAL.skin1 : dx === 3 || tip ? PAL.skin1 : PAL.skin2);
      }
  }
}

/** Light layer: the sunstone core (gold4 white-hot centre), the iris rings stepping out, the one copper glint. */
function paintLight(l: PixelCanvas, f: number): void {
  for (let y = BOSS[1] - 14; y <= BOSS[1] + 14; y++)
    for (let x = BOSS[0] - 14; x <= BOSS[0] + 14; x++) {
      const d = Math.hypot(x - BOSS[0], y - BOSS[1]);
      if (d <= 3.6) l.set(x, y, d <= (f % 2 ? 2.8 : 2.4) ? PAL.gold4 : PAL.gold3);
      else if (Math.abs(d - 9.5) < 0.72 || (f % 2 && Math.abs(d - 12.5) < 0.72)) {
        if (x >= SH_X0 + 3 && x <= SH_X1 - 3) l.set(x, y, PAL.gold3);
      }
    }
  l.set(35, 12, PAL.gold4).set(36, 13, PAL.gold4);
}

function paintBig(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'EARTH', { focus: [BOSS[0], BOSS[1]], horizon: 48 });
  const q = l.subject;
  paintShield(q);
  paintGiant(q);
  ink(q);
  rim(q, PAL.earth3, { skip: [PAL.white, PAL.gold2, PAL.fire3, PAL.skin3, PAL.stone4] });
  paintLight(l.light, f);
}

const art: CardArtV3 = {
  id: 'shield_titan',
  focus: [54, 30],
  focusSmall: [29, 25],
  frames: 2,
  holdMs: 260,
  big(l, f) {
    paintBig(l, f);
  },
  small(l, f) {
    paintBackdrop(l.backdrop, 'EARTH', { focus: [62, 40], horizon: 54 });
    const { body, light } = split(sprite(f).crop(BX, BY, BW, BH));
    l.subject.blit(body, 0, 0);
    patch(l.subject, EYE_PATCH, EYE_KEY, 12, 16);
    l.light.blit(light, 0, 0);
  },
};
export default art;
