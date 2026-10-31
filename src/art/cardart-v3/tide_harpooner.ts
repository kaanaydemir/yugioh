// Card art v3 — Kabuk Zıpkıncı (tide_harpooner, WATER ★ ace): "ay ışığında kabuğun ağzından çıkan yengeç, zıpkın sağ
// üste uzanıp kareden taşar, su tacı; en parlak nokta: zıpkın ucu" (YENI_KARTLAR C1, style sheet docs/v3/KART_RESIMLERI.md).
//
// Source of the subject: the sprite rig itself (monsters-v3/tide_harpooner-rig.ts drawHarpooner), posed for the picture and
// drawn 1:1 at the picture's own density (never scaled). big (88×68): the conch bleeds off the back (left) edge, the crab
// leans out of the nacre mouth, the big claw raises the harpoon on a diagonal so its stone head reaches into the top-right
// corner under the moonlight; a crown of water rises round the crab's feet. small (44×34): the SAME picture closer — the
// rig again 1:1, cropped on the eyes, the nacre lip and the harpoon head (the head moved 1 px in so it keeps its air).
// Ground: the kit's WATER recipe (a moonlight shaft falling from the top left onto the harpoon tip) with a floor pool.
// Living loop (4 frames, 160 ms): the tip glints 1 → cross → 1, the eye stalks swivel, the crown's droplets rise and fall.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { W as RW, H as RH, drawHarpooner, pose, skeleton, type Pose } from '../monsters-v3/tide_harpooner-rig';
import { paintBackdrop, recolor, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

const LOOP = [
  { eL: -12, eR: 22, glint: 1, crown: 0 },
  { eL: -8, eR: 24, glint: 2, crown: 1 },
  { eL: -6, eR: 22, glint: 1, crown: 2 },
  { eL: -10, eR: 20, glint: 0, crown: 1 },
] as const;

function cardPose(f: number): Pose {
  const L = LOOP[f % 4];
  return pose({
    sx: 2, sy: -2, eye: 1.15, eL: L.eL, eR: L.eR, nacre: 1,
    held: 1, ha: -78, grip: 0.5, hy: -6,
    fx: 6, fy: -44, coil: 1, rope: 0, sag: 8, swing: 4,
  });
}

/** The rig drawn for the picture; returns the frame and the harpoon tip (frame px). */
function rigFrame(f: number): { q: PixelCanvas; tip: readonly [number, number] } {
  const o = cardPose(f);
  const q = new PixelCanvas(RW, RH);
  drawHarpooner(q, o, 'left');
  const sk = skeleton(o);
  return { q, tip: [Math.round(sk.ht[0]), Math.round(sk.ht[1])] };
}

/** The tip glint (the picture's brightest point): 1 px → 3-px cross → 1 px, plus the light's own 2-px halo steps. */
function tipLight(l: PixelCanvas, x: number, y: number, g: number, small: boolean): void {
  l.set(x, y, PAL.white);
  if (g >= 2) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) l.set(x + dx, y + dy, PAL.white);
  if (!small && g >= 1) for (const [dx, dy] of [[2, -2], [-2, 2]] as const) l.set(x + dx, y + dy, PAL.water4);
}

/** A crown of water round the feet: droplet spikes on an iso arc (white tips, water4 / water3 bodies, ≥ 2 px). */
function crown(l: PixelCanvas, cx: number, cy: number, rx: number, ry: number, ph: number, small: boolean): void {
  const n = small ? 5 : 9;
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (0.06 + (0.88 * i) / (n - 1));
    const x = Math.round(cx - Math.cos(a) * rx);
    const y = Math.round(cy + Math.sin(a) * ry * 0.4);
    const hgt = (small ? 3 : 5) + ((i * 7) % 3) + (ph === 1 ? 1 : ph === 2 ? 2 : 0) * ((i % 2) ? 1 : 0);
    for (let k = 0; k < hgt; k++) {
      const c = k >= hgt - 1 ? PAL.white : k >= hgt - 3 ? PAL.water4 : PAL.water3;
      l.set(x, y - k, c);
      if (k < hgt - 1) l.set(x + 1, y - k, k >= hgt - 3 ? PAL.water4 : PAL.water2);
    }
    // a flung droplet over every other spike
    if (i % 2 === 0) l.set(x, y - hgt - 2 - ph, PAL.water4).set(x + 1, y - hgt - 2 - ph, PAL.water4);
  }
}

function paint(l: ArtLayers, f: number, small: boolean): void {
  const L = LOOP[f % 4];
  const { q, tip } = rigFrame(f);
  // where the tip lands in the window (big: the conch's apex sits at APEX, so the whole spiral shows)
  const T = small ? FOCUS_SMALL : FOCUS;
  const ox = T[0] - tip[0];
  const oy = T[1] - tip[1];
  void tip;
  paintBackdrop(l.backdrop, 'WATER', { focus: small ? [FOCUS_SMALL[0] * 2, FOCUS_SMALL[1] * 2] : FOCUS, horizon: small ? 62 : 52, pool: !small, radius: 28 });
  l.subject.blit(q, ox, oy);
  // the picture's colour budget (≤ 20): fold the sprite's rarest steps into their neighbours
  recolor(l.subject, PICTURE_FOLD);
  // the moonlit rim runs on the conch's shadow side only (the crab's thin limbs stay calm)
  const sub = l.subject.clone();
  rim(l.subject, PAL.water3, { only: (x, y) => { const c = sub.get(x, y); return c === PAL.earth1 || (c === PAL.earth2 && x < ox + 58); } });
  tipLight(l.light, T[0], T[1] + 1, L.glint, small);
  if (!small) crown(l.light, ox + 60, 66, 18, 6, L.crown, false);
}

/** sprite tone → picture tone (KART_RESIMLERI §7: ≤ 20 tones in a picture) */
const PICTURE_FOLD: Readonly<Record<number, number>> = {
  [PAL.night3]: PAL.night2,
  [PAL.fire3]: PAL.fire2,
  [PAL.water0]: PAL.night0,
  [PAL.earth0]: PAL.earth1,
  [PAL.stone1]: PAL.ink,
};

/** Big: the conch apex lands here; the harpoon tip (the brightest point, the focus) follows from the pose. */
const APEX = [10, 12] as const;
const SK0 = skeleton(cardPose(0));
const FOCUS = [APEX[0] + Math.round(SK0.ht[0]) - Math.round(SK0.apex[0]), APEX[1] + Math.round(SK0.ht[1]) - Math.round(SK0.apex[1])] as const;
/** Small: the same picture closer — the tip near the top-right corner, the crab's eyes and the nacre lip below-left. */
const FOCUS_SMALL = [34, 6] as const;

const art: CardArtV3 = {
  id: 'tide_harpooner',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 160,
  big(l: ArtLayers, f: number) {
    paint(l, f, false);
  },
  small(l: ArtLayers, f: number) {
    paint(l, f, true);
  },
};

export default art;
