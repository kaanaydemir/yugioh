// ?dev=appicon[&id=<monster>] — the App Store icon (mobile/assets/icon.png) as pixel art: a 256×256
// composition at (192, 52), rendered at 4× by the screenshot tool to 1024×1024:
//   node tools/shot.mjs "?dev=appicon" --clip 192,52,256,256 --scale 4 --out mobile/assets/icon.png
// The two duellists' colours split the field on a diagonal (cyan / crimson: the "prism"), a summon
// circle glows under the creature, a few hard stars. No text (unreadable at home-screen size) and
// nothing important in the corners (iOS rounds them). &splash=1: the splash mark (transparent, no field).
import { monsterArt } from '../../art/monsters';
import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { monsterFrameName, monsterTextureKey } from '../../art/textures';
import type { MonsterId } from '../../data/cards';
import { canvasTexture } from '../../view/v3/hudSkin';
import type { DevPreview } from '../types';

const S = 256;
const X0 = 192;
const Y0 = 52;
/** The seam is the line x + y = SEAM: it runs through the summon circle's centre (128, 200). */
const SEAM = 328;

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number): number => (BAYER4[(x & 3) + ((y & 3) << 2)] + 0.5) / 16;

/** The field: night base, the two sides' tones stepping in toward the diagonal seam, the seam itself. */
function paintField(): PixelCanvas {
  const p = new PixelCanvas(S, S);
  const cyan = [PAL.night0, PAL.cyan0, PAL.cyan1] as const;
  const crim = [PAL.night0, PAL.crim0, PAL.crim1] as const;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      // signed distance to the seam (top-right → bottom-left diagonal), in px
      const d = (x + y - SEAM) / Math.SQRT2;
      const side = d < 0 ? cyan : crim;
      const k = Math.abs(d);
      // light falls off away from the seam and toward the frame edge (stepped, dithered between steps)
      const cx = (x - S / 2) / (S / 2);
      const cy = (y - S / 2) / (S / 2);
      const vig = Math.min(1, Math.sqrt(cx * cx + cy * cy));
      const lv = Math.max(0, 1 - k / 120) * 0.8 + (1 - vig) * 0.45;
      const t = Math.min(1.999, lv * 2);
      const i = Math.floor(t);
      const c = t - i > bayer(x, y) ? side[Math.min(2, i + 1)] : side[i];
      p.set(x, y, c);
    }
  // the seam: a hard white core with the two sides' light on either edge
  for (let x = 0; x < S; x++) {
    const y = SEAM - x;
    if (y < -2 || y > S + 1) continue;
    p.set(x, y, PAL.white);
    if (y + 1 < S) p.set(x, y + 1, PAL.crim3);
    if (y - 1 >= 0) p.set(x, y - 1, PAL.cyan3);
    if (y + 2 < S) p.set(x, y + 2, PAL.crim2);
    if (y - 2 >= 0) p.set(x, y - 2, PAL.cyan2);
  }
  // stars (a few, hard, off the seam)
  for (const [x, y, big] of [[46, 40, 1], [70, 22, 0], [204, 58, 1], [222, 92, 0], [34, 150, 0], [196, 214, 0], [58, 206, 1], [150, 30, 0]] as const) {
    p.set(x, y, PAL.white);
    if (big) {
      p.set(x - 1, y, PAL.cyan4).set(x + 1, y, PAL.cyan4).set(x, y - 1, PAL.cyan4).set(x, y + 1, PAL.cyan4);
    }
  }
  return p;
}

/** Summon circle under the creature: two stepped iso rings (cyan half / crimson half) and a gold inner ring. */
function paintCircle(transparentBg: boolean): PixelCanvas {
  const p = new PixelCanvas(S, S);
  if (!transparentBg) p.clear();
  const cx = S / 2;
  const cy = 200;
  const ring = (rx: number, ry: number, l: number, r: number) => {
    for (let a = 0; a < 720; a++) {
      const t = (a / 720) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(t) * rx);
      const y = Math.round(cy + Math.sin(t) * ry);
      p.set(x, y, x + y < SEAM ? l : r);
    }
  };
  // floor glow inside the circle (dithered, two steps)
  for (let y = cy - 30; y <= cy + 30; y++)
    for (let x = cx - 90; x <= cx + 90; x++) {
      const u = (x - cx) / 86;
      const v = (y - cy) / 28;
      const d = u * u + v * v;
      if (d > 1) continue;
      const lv = 1 - d;
      const c = x + y < SEAM ? (lv > 0.55 ? PAL.cyan2 : PAL.cyan1) : lv > 0.55 ? PAL.crim2 : PAL.crim1;
      if (lv > 0.25 || bayer(x, y) < lv * 3) p.set(x, y, c);
    }
  ring(92, 32, PAL.cyan3, PAL.crim3);
  ring(91, 31, PAL.cyan4, PAL.crim4);
  ring(70, 24, PAL.gold3, PAL.gold3);
  ring(48, 16, PAL.gold2, PAL.gold2);
  // rune ticks on the outer ring
  for (let k = 0; k < 16; k++) {
    const t = (k / 16) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(t) * 81);
    const y = Math.round(cy + Math.sin(t) * 28);
    p.set(x, y, PAL.gold4).set(x + 1, y, PAL.gold3);
  }
  return p;
}

const preview: DevPreview = {
  name: 'appicon',
  description: 'App Store icon (256×256 at 192,52; shoot --clip 192,52,256,256 --scale 4) &id=<monster> &splash=1',
  create(scene, params) {
    const id = (params.get('id') ?? 'crystal_wyrm') as MonsterId;
    const splash = params.get('splash') === '1';
    scene.cameras.main.setBackgroundColor(splash ? PAL.night0 : PAL.ink);
    if (!splash) scene.add.image(X0, Y0, canvasTexture(scene, 'appicon:field', paintField)).setOrigin(0);
    scene.add.image(X0, Y0, canvasTexture(scene, `appicon:circle:${splash ? 1 : 0}`, () => paintCircle(splash))).setOrigin(0);
    // the creature: idle frame 0 at a whole-number scale, feet on the circle's centre
    const art = monsterArt(id);
    const k = Math.max(1, Math.min(4, Math.floor(210 / Math.max(art.w, art.h))));
    scene.add
      .image(X0 + S / 2 + Math.round((art.w / 2 - art.anchorX) * k), Y0 + 204 + Math.round((art.h - art.anchorY) * k) - art.h * k, monsterTextureKey(id), monsterFrameName('idle', 0))
      .setOrigin(0.5, 0)
      .setScale(k);
  },
};

export default preview;
