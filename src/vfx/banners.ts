// Text banners (GAME_DESIGN §6 turnStart / phaseChange / trap opening / gameStart / gameOver).
//
//   await turnBanner(scene, 1, 3);                 // "OYUNCU 2 · TUR 3" sweeps in from P2's side
//   await phaseBanner(scene, 'battle');            // "SAVAŞ AŞAMASI" + red edge pulse
//   await trapBanner(scene);                       // "TUZAK!" letters slam down (magenta)
//   await banner(scene, 'YILDIRIM HÜKMÜ', { style: 'spell', sub: 'BÜYÜ KARTI' });
//   await duelStart(scene);                        // "DÜELLO!" gold slam with focus lines
//   await victory(scene, 0);                       // "KAZANAN: OYUNCU 1" + gold fireworks (stays up)
//   clearBanners(scene);                           // fade out a persistent victory screen
//
// Two motion families:
//  - sweep (turn / phase / spell): a slanted band with scrolling diagonal stripes wipes across,
//    the letters rush in from the opposite side with speed smears, a shine runs over them, then
//    the letters keep going and the band wipes off.
//  - slam (trap / big): the band slams open with a white frame, letters drop (or punch in from
//    the camera) one by one with squash, the last one triggers focus lines + shake; the banner
//    exits like a CRT switching off.
// Everything is screen-space (scrollFactor 0) at DEPTH.BANNER, self-cleaning; promises resolve
// when the banner has left the screen (victory: after the title landed + `hold`).

import Phaser from 'phaser';
import type { Phase, PlayerId } from '../engine/types';
import { PAL, PLAYER_RAMP, RAMPS, type Ramp } from '../art/palette';
import { DEPTH, GAME_H, GAME_W, UI } from '../view/layout';
import { TEX, shake } from './core';
import { pixelLetters, pixelText, upper, type PixelLetter, type TextSize } from '../ui/text';
import { E, Raster, Sparks, bayer, clamp01, lerp, onFrame, rampOf, rnd, rr, run, seg, sleep, snd } from './setpieces';

export type BannerStyle = 'turn' | 'phase' | 'trap' | 'spell' | 'big';

export interface BannerOpts {
  style?: BannerStyle;
  /** Accent color; snaps to its palette ramp (default per style: turn cyan, phase night, trap magenta, spell teal, big gold). */
  color?: number;
  /** Small second line under the band (e.g. 'BÜYÜ KARTI'). */
  sub?: string;
  /** Extra: hold time on screen in ms (default per style). */
  hold?: number;
  /** Extra: sweep direction, 1 = the band enters from the left (default), -1 = from the right. */
  dir?: 1 | -1;
  /** Extra: letter fill color (default white; gold for 'big'). */
  textColor?: number;
}

const TAU = Math.PI * 2;
const D = DEPTH.BANNER;
const CY = UI.bannerY;

interface StyleSpec {
  size: TextSize;
  /** Band height (px). */
  H: number;
  hold: number;
  ramp: Ramp;
  slam: boolean;
  /** Integer letter magnification on top of the font size (crisp). */
  mul?: number;
}

const STYLE: Record<BannerStyle, StyleSpec> = {
  turn: { size: 'lg', H: 40, hold: 380, ramp: RAMPS.cyan, slam: false },
  phase: { size: 'lg', H: 34, hold: 330, ramp: RAMPS.night, slam: false },
  spell: { size: 'lg', H: 40, hold: 620, ramp: RAMPS.teal, slam: false },
  trap: { size: 'xl', H: 54, hold: 460, ramp: RAMPS.mag, slam: true },
  big: { size: 'xl', H: 76, hold: 640, ramp: RAMPS.gold, slam: true, mul: 2 },
};

// =================================================================================== band

interface BandState {
  /** Horizontal extent of the band (unslanted mid-line x). */
  x0: number;
  x1: number;
  /** Vertical scale 0..1+ (slam open / collapse). */
  hK: number;
  /** White flash level 0..1 (dithered). */
  flash: number;
  /** Bright leading edge on the moving end: 1 = right end, -1 = left end, 0 = none. */
  lead: -1 | 0 | 1;
  /** Glint stripe x (or null). */
  glint: number | null;
  /** Letters in flight: smear streaks (x, y, len, dir). */
  smears: { x: number; y: number; len: number; dir: number; h: number }[];
}

const SLANT = 0.5; // band ends lean like "/"

function drawBand(g: Raster, s: BandState, H: number, ramp: Ramp, el: number): void {
  const h = Math.round((H * s.hK) / 2) * 2;
  if (h < 1 || s.x1 <= s.x0) return;
  const top = CY - h / 2;
  const off = Math.floor(el * 0.05);
  const outer = s.hK > 0.4;
  for (let y = top; y < top + h; y++) {
    const dyc = y - CY;
    const shift = -dyc * SLANT;
    const xa = Math.max(0, Math.ceil(s.x0 + shift));
    const xb = Math.min(GAME_W - 1, Math.floor(s.x1 + shift));
    const row = y - top;
    for (let x = xa; x <= xb; x++) {
      let c: number;
      if (row === 0 || row === h - 1) c = ramp[4];
      else if (row === 1 || row === h - 2) c = ramp[3];
      else {
        const v = row / h;
        const stripe = (((x + y + off) % 14) + 14) % 14 < 6;
        if (v < 0.3) c = stripe ? ramp[2] : ramp[1];
        else c = stripe ? ramp[1] : ramp[0];
        if (row === 2 || row === h - 3) c = ramp[2];
      }
      // flash: tones step up the ramp (solid fills, no stipple)
      if (s.flash > 0.1) c = s.flash > 0.66 ? PAL.white : s.flash > 0.33 ? (c === ramp[0] || c === ramp[1] ? ramp[3] : ramp[4]) : c === ramp[0] ? ramp[1] : c === ramp[1] ? ramp[2] : ramp[3];
      g.px(x, y, c);
    }
    // bright leading edge (3 px, slanted with the band)
    if (s.lead !== 0) {
      const ex = s.lead > 0 ? s.x1 + shift : s.x0 + shift;
      for (let k = 0; k < 3; k++) {
        const xx = Math.round(ex - s.lead * k);
        if (xx >= 0 && xx < GAME_W) g.px(xx, y, k === 0 ? PAL.white : k === 1 ? ramp[4] : ramp[3]);
      }
    }
  }
  // outer accent rails (dashed, scrolling the other way)
  if (outer) {
    const rails = [top - 4, top + h + 3];
    rails.forEach((ry, i) => {
      const shift = -(ry - CY) * SLANT;
      const xa = Math.max(0, Math.ceil(s.x0 + shift));
      const xb = Math.min(GAME_W - 1, Math.floor(s.x1 + shift));
      for (let x = xa; x <= xb; x++) {
        const ph = (((x + (i ? off : -off) * 2) % 10) + 10) % 10;
        if (ph < 6) g.px(x, ry, ph < 1 ? ramp[4] : ramp[2]);
      }
    });
  }
  // glint: a bright slanted stripe crossing the band
  if (s.glint !== null) {
    for (let y = top + 1; y < top + h - 1; y++) {
      const gx = Math.round(s.glint - (y - CY) * 1.1);
      for (let k = 0; k < 4; k++) {
        const xx = gx + k;
        if (xx < 0 || xx >= GAME_W || xx < s.x0 - (y - CY) * SLANT || xx > s.x1 - (y - CY) * SLANT) continue;
        g.px(xx, y, k === 1 ? PAL.white : ramp[3]);
      }
      g.dpx(gx + 6, y, ramp[3], 0.5);
    }
  }
  // speed smears behind rushing letters: one streak per letter, dithered tail
  for (const m of s.smears) {
    const n = Math.round(m.len);
    const yy = Math.round(m.y);
    for (let k = 0; k < n; k++) {
      const xx = Math.round(m.x + m.dir * k);
      if (xx < 0 || xx >= GAME_W) continue;
      const f = k / Math.max(1, n);
      if (f > 0.35 && bayer(xx, yy) > 1 - (f - 0.35) / 0.65) continue;
      g.px(xx, yy, f < 0.25 ? ramp[4] : ramp[3]);
    }
  }
}

// =================================================================================== shared bits

interface Built {
  /** Letter magnification (multiply every setScale by it). */
  mul: number;
  band: Raster;
  state: BandState;
  letters: PixelLetter[];
  qh: number;
  stop: () => void;
  objs: Array<{ destroy(): void }>;
}

function letterHeight(size: TextSize): number {
  return size === 'xl' ? 21 : size === 'lg' ? 14 : 7;
}

function buildBanner(scene: Phaser.Scene, text: string, sp: StyleSpec, ramp: Ramp, textColor: number): Built {
  const objs: Array<{ destroy(): void }> = [];
  const band = new Raster(scene, 0, CY - sp.H, GAME_W, sp.H * 2, D);
  band.img.setScrollFactor(0);
  objs.push(band);
  const state: BandState = { x0: 0, x1: 0, hK: 1, flash: 0, lead: 0, glint: null, smears: [] };
  let letters: PixelLetter[] = [];
  try {
    letters = pixelLetters(scene, GAME_W / 2, CY + (sp.size === 'xl' ? 1 : 0), text, { size: sp.size, color: textColor, originX: 0.5, originY: 0.5, shadow: 1 }).letters;
  } catch (e) {
    console.warn('[banners] pixelLetters unavailable', e);
  }
  const mul = sp.mul ?? 1;
  if (mul !== 1) {
    // spread the laid-out letters around the center and magnify them (integer → crisp)
    for (const l of letters) {
      l.x = GAME_W / 2 + (l.x - GAME_W / 2) * mul;
      l.y = CY + (l.y - CY) * mul;
      l.obj.setScale(mul);
    }
  }
  for (const l of letters) {
    l.obj.setDepth(D + 3).setScrollFactor(0).setVisible(false);
    objs.push(l.obj);
  }
  const stop = onFrame(scene, (_dt, el) => band.draw((g) => drawBand(g, state, sp.H, ramp, el)));
  objs.push({ destroy: stop });
  return { mul, band, state, letters, qh: letterHeight(sp.size) * mul, stop, objs };
}

/** A color wave runs over the letters (multiply tints only: the ink outline stays crisp). */
function shine(scene: Phaser.Scene, letters: PixelLetter[], wave: readonly number[], base: (l: PixelLetter) => number, step = 22): Promise<void> {
  const total = letters.length * step + 140;
  return run(scene, total, (_t, el) => {
    letters.forEach((l, i) => {
      const lt = el - i * step;
      if (!l.obj.active) return;
      const k = Math.floor(lt / 34);
      l.obj.setTint(k >= 0 && k < wave.length ? wave[k] : base(l));
    });
  });
}

/** Radial anime focus lines bursting out from the title (behind the band). */
function focusLines(scene: Phaser.Scene, ramp: Ramp, ms = 300, inner = 70): Promise<void> {
  const r = new Raster(scene, 0, 0, GAME_W, GAME_H, D - 1);
  r.img.setScrollFactor(0);
  const lines = Array.from({ length: 46 }, (_, i) => ({ a: (i / 46) * TAU + rr(-0.05, 0.05), r0: inner + rr(0, 60), w: rnd() < 0.3 ? 2 : 1, c: rnd() < 0.4 ? PAL.white : ramp[3] }));
  return run(scene, ms, (t) => {
    r.draw((g) => {
      const k = E.outCubic(t);
      for (const l of lines) {
        const ca = Math.cos(l.a);
        const sa = Math.sin(l.a) * 0.62;
        const a0 = l.r0 + k * 240;
        const a1 = l.r0 + 60 + k * 420;
        g.line(GAME_W / 2 + ca * a0, CY + sa * a0, GAME_W / 2 + ca * a1, CY + sa * a1, l.c, 1 - t * 0.8, l.w);
      }
    });
  }).then(() => r.destroy());
}

function dim(scene: Phaser.Scene, alpha: number, color: number = PAL.ink): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(0, 0, GAME_W, GAME_H, color, 1).setOrigin(0).setScrollFactor(0).setDepth(D - 2).setAlpha(alpha);
}

// =================================================================================== sweep

async function sweepBanner(scene: Phaser.Scene, text: string, sp: StyleSpec, ramp: Ramp, o: BannerOpts): Promise<void> {
  const dir = o.dir ?? 1;
  const textColor = o.textColor ?? PAL.white;
  const b = buildBanner(scene, text, sp, ramp, textColor);
  const { state, letters } = b;
  const slantW = sp.H * SLANT;
  const L = -slantW - 4;
  const R = GAME_W + slantW + 4;
  const hold = o.hold ?? sp.hold;

  // sub line in a little dark tab under the band
  let sub: Phaser.GameObjects.BitmapText | null = null;
  let tab: Raster | null = null;
  if (o.sub) {
    try {
      sub = pixelText(scene, GAME_W / 2, CY + sp.H / 2 + 9, upper(o.sub), { size: 'md', color: ramp[4], originX: 0.5, originY: 0.5 }).setDepth(D + 3).setScrollFactor(0).setVisible(false);
      b.objs.push(sub);
      tab = new Raster(scene, 0, CY + sp.H / 2, GAME_W, 20, D + 1);
      tab.img.setScrollFactor(0);
      b.objs.push(tab);
    } catch {
      sub = null;
    }
  }
  const drawTab = (k: number) => {
    if (!tab || !sub) return;
    const w = Math.round((sub.width + 24) * k);
    tab.draw((g) => {
      if (w < 2) return;
      const x0 = GAME_W / 2 - w / 2;
      const y0 = CY + sp.H / 2;
      g.poly(
        [
          { x: x0 - 4, y: y0 },
          { x: x0 + w + 4, y: y0 },
          { x: x0 + w - 4, y: y0 + 17 },
          { x: x0 + 4, y: y0 + 17 },
        ],
        PAL.ink,
      );
      g.line(x0 + 4, y0 + 17, x0 + w - 4, y0 + 17, ramp[3]);
      g.line(x0 + w + 3, y0 + 1, x0 + w - 4, y0 + 16, ramp[2]);
      g.line(x0 - 3, y0 + 1, x0 + 4, y0 + 16, ramp[2]);
    });
  };

  // ---- band wipes in
  state.lead = dir > 0 ? 1 : -1;
  if (dir > 0) {
    state.x0 = L;
    state.x1 = L;
  } else {
    state.x0 = R;
    state.x1 = R;
  }
  const IN = 170;
  const bandIn = run(scene, IN, (t) => {
    const k = E.outCubic(t);
    if (dir > 0) state.x1 = lerp(L, R, k);
    else state.x0 = lerp(R, L, k);
  }).then(() => (state.lead = 0));

  // ---- letters rush in from the far side (moving against the band's direction)
  const SLIDE = 230;
  const STAG = 11;
  const dist = 360;
  const order = dir > 0 ? letters.slice() : letters.slice().reverse(); // the leading letter first
  const lettersIn = (async () => {
    await sleep(scene, 105);
    order.forEach((l) => l.obj.setVisible(true).setPosition(l.x + dir * dist, l.y));
    await run(scene, SLIDE + STAG * order.length, (_t, el) => {
      state.smears = [];
      order.forEach((l, i) => {
        const t = clamp01((el - i * STAG) / SLIDE);
        const k = E.outExpo(t);
        const dx = dir * dist * (1 - k);
        l.obj.setPosition(l.x + Math.round(dx), l.y);
        l.obj.setVisible(l.obj.x > state.x0 - slantW && l.obj.x < state.x1 + slantW);
        // arrival squash
        const land = seg(t, 0.55, 1);
        l.obj.setScale(t < 0.55 ? 1.25 : lerp(1.25, 1, E.outBack(land)), t < 0.55 ? 0.85 : lerp(0.85, 1, E.outBack(land)));
        const speed = dist * (1 - E.outExpo(Math.min(1, t + 0.05))) * 0.35;
        if (t < 0.5 && speed > 3) state.smears.push({ x: l.obj.x + dir * (l.obj.displayWidth / 2 + 1), y: l.y + ((i % 3) - 1) * Math.round(b.qh * 0.3), len: Math.min(90, speed * 1.4), dir, h: b.qh });
      });
    });
    state.smears = [];
    order.forEach((l) => l.obj.setPosition(l.x, l.y).setScale(1).setVisible(true));
  })();
  snd('cardSlide', 0.7, 0.9);
  await Promise.all([bandIn, lettersIn]);

  // sub tab
  if (sub) {
    void run(scene, 140, (t) => {
      drawTab(E.outBack(t));
      sub!.setVisible(t > 0.3).setY(Math.round(CY + sp.H / 2 + 9 + (1 - t) * 4));
    });
  }

  // ---- hold: shine over the letters + glint across the band
  void shine(scene, dir > 0 ? letters : letters.slice().reverse(), waveFor(ramp, textColor), () => textColor);
  void run(scene, 300, (t) => (state.glint = dir > 0 ? lerp(-20, GAME_W + 40, E.inOutSine(t)) : lerp(GAME_W + 40, -20, E.inOutSine(t)))).then(() => (state.glint = null));
  await sleep(scene, hold);

  // ---- exit: letters keep going, the band wipes off after them
  const OUT = 200;
  state.lead = dir > 0 ? -1 : 1;
  if (sub) void run(scene, 120, (t) => {
    sub!.setAlpha(t < 0.5 ? 0.6 : 0.25);
    drawTab(1 - t);
  });
  snd('whoosh', 0.35, 1.3);
  await run(scene, OUT + 8 * order.length, (_t, el) => {
    state.smears = [];
    // the band retracts the way the letters fly, wiping them away as its end passes them
    const tb = clamp01((el - 40) / OUT);
    const kb = E.inCubic(tb);
    if (dir > 0) state.x1 = lerp(R, L, kb);
    else state.x0 = lerp(L, R, kb);
    order.forEach((l, i) => {
      const t = clamp01((el - i * 8) / (OUT * 0.85));
      const k = E.inQuad(t);
      l.obj.setPosition(l.x - dir * Math.round(k * 420), l.y).setScale(1 + k * 0.4, 1 - k * 0.2);
      const inside = dir > 0 ? l.obj.x < state.x1 + slantW : l.obj.x > state.x0 - slantW;
      l.obj.setVisible(inside);
      if (inside && t > 0.05 && t < 1) state.smears.push({ x: l.obj.x + dir * (l.obj.displayWidth / 2 + 1), y: l.y + ((i % 3) - 1) * Math.round(b.qh * 0.3), len: Math.min(80, k * 140), dir, h: b.qh });
    });
  });
  for (const ob of b.objs) ob.destroy();
}

// =================================================================================== slam

async function slamBanner(scene: Phaser.Scene, text: string, sp: StyleSpec, ramp: Ramp, o: BannerOpts & { punch?: boolean; keep?: boolean; stagger?: number; letterTint?: (l: PixelLetter) => number }): Promise<Built> {
  const textColor = o.textColor ?? (ramp === RAMPS.gold ? PAL.gold3 : PAL.white);
  const b = buildBanner(scene, text, sp, ramp, textColor);
  const { state, letters } = b;
  const hold = o.hold ?? sp.hold;
  const tintOf = (l: PixelLetter) => (o.letterTint ? o.letterTint(l) : textColor);
  letters.forEach((l) => l.obj.setTint(tintOf(l)));
  const dust = new Sparks(scene, D + 4);
  const stars = new Sparks(scene, D + 2);
  b.objs.push({ destroy: () => dust.close() }, { destroy: () => stars.close() });

  // dim the stage a little (trap: magenta tinted)
  const shade = dim(scene, 0, sp.ramp === RAMPS.mag ? PAL.mag0 : PAL.ink);
  b.objs.push(shade);
  void run(scene, 120, (t) => shade.setAlpha(0.45 * t));

  // ---- band slams open
  state.x0 = -40;
  state.x1 = GAME_W + 40;
  state.hK = 0;
  state.flash = 1;
  snd('cardSlam', 0.9, sp.size === 'xl' ? 0.8 : 1);
  await run(scene, 100, (t) => {
    state.hK = E.outBack(t);
    state.flash = 1 - t * 0.5;
  });
  state.hK = 1;
  void run(scene, 90, (t) => (state.flash = 0.5 * (1 - t)));

  // ---- letters: drop in from above (trap) or punch in from the camera (big)
  const STAG = o.stagger ?? (o.punch ? 48 : 40);
  const FALL = o.punch ? 110 : 105;
  const SETTLE = 150;
  const n = letters.length;
  const landed: boolean[] = letters.map(() => false);
  const shadowPx = sp.size === 'xl' ? 3 : 2;
  if (o.punch) letters.forEach((l) => l.obj.setDropShadow(0, 0, PAL.ink, 0));
  const flashLight = textColor === PAL.white ? ramp[4] : PAL.white;
  let impactDone = false;
  const impact = () => {
    impactDone = true;
    snd('impactHeavy', 0.9, o.punch ? 0.8 : 1);
    void focusLines(scene, ramp, 340, sp.H);
    void shake(scene, o.punch ? 320 : 240, o.punch ? 5 : 3);
    state.flash = 0.8;
    void run(scene, 150, (t) => (state.flash = 0.8 * (1 - E.outQuad(t))));
    dust.burst(26, () => {
      const a = rr(0, TAU);
      const v = rr(80, 230);
      return { x: GAME_W / 2 + rr(-90, 90), y: CY + rr(-6, 6), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, drag: 3, life: rr(240, 480), ramp: [PAL.white, ramp[4], ramp[3], ramp[2]], trail: true };
    });
  };
  await run(scene, STAG * (n - 1) + FALL + SETTLE, (_t, el) => {
    letters.forEach((l, i) => {
      const lt = el - i * STAG;
      if (lt < 0) return;
      l.obj.setVisible(true);
      if (lt < FALL) {
        const k = E.inQuad(lt / FALL);
        if (o.punch) {
          // from the camera: huge and faint → full size
          const sc = Math.max(1, Math.round(lerp(1 + 1.4 / b.mul, 1, k) * 4) / 4);
          l.obj.setScale(sc * b.mul).setPosition(l.x, l.y).setAlpha(1).setTint(flashLight);
        } else {
          l.obj.setPosition(l.x, l.y - Math.round((1 - k) * 74)).setScale(0.82 * b.mul, 1.3 * b.mul).setAlpha(1);
        }
        return;
      }
      if (!landed[i]) {
        landed[i] = true;
        l.obj.setAlpha(1).setTint(flashLight);
        if (o.punch) l.obj.setDropShadow(shadowPx, shadowPx, PAL.ink, 1);
        stars.add({ x: Math.round(l.x), y: Math.round(l.y + b.qh * 0.4), life: 90, ramp: [PAL.white, ramp[4]], tex: TEX.spark, scale: 3 });
        dust.burst(7, () => ({ x: l.x + rr(-6, 6), y: l.y + b.qh / 2 + 2, vx: rr(-70, 70), vy: rr(-60, -10), drag: 4, life: rr(160, 300), ramp: [PAL.white, ramp[4], ramp[3]], tex: rnd() < 0.3 ? TEX.plus : TEX.px1 }));
        if (i < n - 1) {
          snd(o.punch ? 'impactLight' : 'cardPlace', 0.5, 1 + i * 0.06);
          void shake(scene, 60, 1);
        } else if (!impactDone) impact();
      }
      const q = clamp01((lt - FALL) / SETTLE);
      if (q > 0.3) l.obj.setTint(tintOf(l));
      const sx = lerp(1.38, 1, E.outBack(q));
      const sy = lerp(0.64, 1, E.outBack(q));
      l.obj.setPosition(l.x, l.y + Math.round((1 - sy) * b.qh * 0.5)).setScale(sx * b.mul, sy * b.mul);
    });
  });
  letters.forEach((l) => l.obj.setPosition(l.x, l.y).setScale(b.mul).setTint(tintOf(l)));
  if (!impactDone) impact();

  // ---- hold: jitter (trap) / color wave / glint
  void shine(scene, letters, waveFor(ramp, textColor), tintOf, 26).then(() => letters.forEach((l) => l.obj.active && l.obj.setTint(tintOf(l))));
  if (!o.punch) {
    void run(scene, 220, (_t, el) => {
      const j = Math.floor(el / 34) % 2 ? 1 : -1;
      letters.forEach((l, i) => l.obj.active && l.obj.setPosition(l.x + (i % 2 ? j : -j) * (el < 180 ? 1 : 0), l.y));
    });
  }
  void run(scene, 340, (t) => (state.glint = lerp(-30, GAME_W + 40, E.inOutSine(t)))).then(() => (state.glint = null));
  if (o.keep) return b;
  await sleep(scene, hold);

  // ---- exit: CRT switch-off (squash to a line, the line shrinks to the center)
  snd('whoosh', 0.35, 1.6);
  await run(scene, 140, (t) => {
    const k = E.inCubic(t);
    state.hK = 1 - k * 0.94;
    letters.forEach((l) => l.obj.setScale((1 + k * 0.3) * b.mul, Math.max(0.05, 1 - k) * b.mul));
    shade.setAlpha(0.45 * (1 - t));
  });
  letters.forEach((l) => l.obj.setVisible(false));
  await run(scene, 100, (t) => {
    const k = E.inQuad(t);
    state.hK = 0.06;
    state.flash = 1;
    state.x0 = lerp(-40, GAME_W / 2 - 4, k);
    state.x1 = lerp(GAME_W + 40, GAME_W / 2 + 4, k);
  });
  for (const ob of b.objs) ob.destroy();
  return b;
}

/** The color wave used by shine() for a band ramp and a letter color. */
function waveFor(ramp: Ramp, textColor: number): number[] {
  if (textColor !== PAL.white) return [PAL.white, PAL.white, ramp[4]];
  if (ramp === RAMPS.night) return [PAL.cyan4, PAL.mist, PAL.cyan4];
  return [ramp[4], ramp[3], ramp[3], ramp[4]];
}

// =================================================================================== public API

/**
 * Generic banner. Resolves once it has left the screen.
 * Durations at speed 1: turn ≈1.0 s, phase ≈0.9 s, spell ≈1.2 s, trap ≈1.2 s, big ≈1.5 s.
 */
export async function banner(scene: Phaser.Scene, text: string, o: BannerOpts = {}): Promise<void> {
  const style = o.style ?? 'big';
  const sp = STYLE[style];
  const ramp = o.color !== undefined ? rampOf(o.color) : sp.ramp;
  const label = upper(text);
  try {
    if (sp.slam) await slamBanner(scene, label, sp, ramp, { ...o, punch: style === 'big' });
    else await sweepBanner(scene, label, sp, ramp, o);
  } catch (e) {
    console.error('[banners]', e);
  }
}

/** "OYUNCU 2 · TUR 3" — sweeps in from the player's side in their color (~1.0 s). */
export async function turnBanner(scene: Phaser.Scene, player: PlayerId, turn: number): Promise<void> {
  snd('turnStart', 0.8);
  await banner(scene, `OYUNCU ${player + 1} · TUR ${turn}`, { style: 'turn', color: PLAYER_RAMP[player][3], dir: player === 0 ? 1 : -1 });
}

const PHASE_LABEL: Record<Phase, string> = {
  draw: 'ÇEKME AŞAMASI',
  main: 'ANA AŞAMA',
  battle: 'SAVAŞ AŞAMASI',
  end: 'BİTİŞ AŞAMASI',
};

const PHASE_RAMP: Record<Phase, Ramp> = {
  draw: RAMPS.night,
  main: RAMPS.night,
  battle: RAMPS.crim,
  end: RAMPS.void,
};

/** Phase banner (~0.9 s). The battle phase adds a red edge pulse and slams harder. */
export async function phaseBanner(scene: Phaser.Scene, phase: Phase): Promise<void> {
  snd('phaseChange', 0.8, phase === 'battle' ? 0.8 : 1);
  if (phase === 'battle') void edgePulse(scene, PAL.crim2);
  const sp = { ...STYLE.phase, ramp: PHASE_RAMP[phase], hold: phase === 'battle' ? 420 : STYLE.phase.hold };
  try {
    await sweepBanner(scene, PHASE_LABEL[phase], sp, PHASE_RAMP[phase], { textColor: phase === 'main' ? PAL.gold4 : PAL.white });
  } catch (e) {
    console.error('[banners]', e);
  }
}

/** "TUZAK!" — magenta letters slam down one by one (~1.2 s). */
export async function trapBanner(scene: Phaser.Scene): Promise<void> {
  await banner(scene, 'TUZAK!', { style: 'trap' });
}

/** "DÜELLO!" — gold letters punch in from the camera, focus lines + 5 px shake (~1.5 s). */
export async function duelStart(scene: Phaser.Scene): Promise<void> {
  await banner(scene, 'DÜELLO!', { style: 'big' });
}

// ---------------------------------------------------------------- red edge pulse (battle phase)

function vignetteKey(scene: Phaser.Scene, color: number): string {
  const key = `set:vignette:${color.toString(16)}`;
  if (scene.textures.exists(key)) return key;
  const W = 320;
  const Hh = 180;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = Hh;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(W, Hh);
  const r = (color >> 16) & 255;
  const gg = (color >> 8) & 255;
  const bl = color & 255;
  for (let y = 0; y < Hh; y++)
    for (let x = 0; x < W; x++) {
      const dx = Math.max(0, Math.abs(x - W / 2 + 0.5) / (W / 2) - 0.72) / 0.28;
      const dy = Math.max(0, Math.abs(y - Hh / 2 + 0.5) / (Hh / 2) - 0.62) / 0.38;
      const d = Math.min(1, Math.hypot(dx, dy));
      if (bayer(x, y) < d * d * 0.8) {
        const i = (y * W + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = gg;
        img.data[i + 2] = bl;
        img.data[i + 3] = 255;
      }
    }
  ctx.putImageData(img, 0, 0);
  scene.textures.addCanvas(key, c);
  return key;
}

/** Two quick colored pulses on the screen edges (stepped alpha). */
export function edgePulse(scene: Phaser.Scene, color: number = PAL.crim2, ms = 700): Promise<void> {
  const img = scene.add.image(0, 0, vignetteKey(scene, color)).setOrigin(0).setScale(2).setScrollFactor(0).setDepth(D - 3).setAlpha(0);
  return run(scene, ms, (t) => {
    const p = Math.max(0, Math.sin(t * Math.PI * 2 - 0.2)) * (1 - t * 0.5);
    img.setAlpha(p > 0.75 ? 0.6 : p > 0.45 ? 0.4 : p > 0.15 ? 0.2 : 0);
  }).then(() => img.destroy());
}

// =================================================================================== victory

interface VictoryState {
  dismiss: (ms: number) => void;
}
const victories = new WeakMap<Phaser.Scene, VictoryState>();

/**
 * Game over: the stage dims, "KAZANAN: OYUNCU 1" punches in (gold, the player name in the
 * winner's color), god rays turn behind it and gold fireworks keep bursting. Resolves after the
 * title landed + `hold` ms (default 1200) — show "Tekrar Oyna" then. The screen STAYS up (rays,
 * fireworks) until clearBanners(scene) or scene shutdown.
 */
export async function victory(scene: Phaser.Scene, player: PlayerId, o: { hold?: number } = {}): Promise<void> {
  clearBanners(scene, 0);
  const pr = PLAYER_RAMP[player];
  const objs: Array<{ destroy(): void }> = [];
  let dismissed = false;
  const shade = dim(scene, 0);
  objs.push(shade);
  void run(scene, 380, (t) => !dismissed && shade.setAlpha(0.55 * E.outQuad(t)));
  snd('victory', 1);

  // god rays (half-res raster, scaled ×2)
  const RW = 320;
  const RH = 150;
  const rays = new Raster(scene, 0, 0, RW, RH, D - 1, Phaser.BlendModes.ADD);
  rays.img.setScale(2).setScrollFactor(0).setPosition(0, CY - RH);
  objs.push(rays);
  const ang = new Float32Array(RW * RH);
  const rad = new Float32Array(RW * RH);
  for (let y = 0; y < RH; y++)
    for (let x = 0; x < RW; x++) {
      const dx = x + 0.5 - RW / 2;
      const dy = (y + 0.5 - RH / 2) * 1.6;
      ang[y * RW + x] = Math.atan2(dy, dx);
      rad[y * RW + x] = Math.hypot(dx, dy);
    }
  let raysOn = 0;
  const fw = new Sparks(scene, D - 0.5);
  const glitter = new Sparks(scene, D + 5);
  objs.push({ destroy: () => fw.close() }, { destroy: () => glitter.close() });
  let fwAcc = 0;
  const firework = (x: number, y: number, big: boolean) => {
    const rampF = rnd() < 0.3 ? pr : RAMPS.gold;
    const N = big ? 40 : 28;
    const sp = big ? rr(140, 180) : rr(95, 130);
    snd('fireBurst', 0.25, 1.6 + rnd() * 0.4);
    fw.burst(N, (i) => {
      const a = (i / N) * TAU + rr(-0.05, 0.05);
      const v = sp * rr(0.85, 1.05);
      return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 70, drag: 1.6, life: rr(750, 1050), ramp: [PAL.white, rampF[4], rampF[4], rampF[3], rampF[3], rampF[2]], trail: true, flicker: rnd() < 0.3, fade: 0.35, tex: i % 3 === 0 ? TEX.px2 : TEX.px1 };
    });
    // crackle glitter after the burst
    glitter.burst(big ? 10 : 6, () => ({ x: x + rr(-sp * 0.6, sp * 0.6), y: y + rr(-sp * 0.5, sp * 0.5), vy: rr(10, 30), life: rr(200, 400), delay: rr(380, 700), ramp: [PAL.white, PAL.gold4], tex: rnd() < 0.5 ? TEX.plus : TEX.px1, flicker: true }));
  };
  const rocket = () => {
    const x = rr(80, GAME_W - 80);
    const y = rr(36, 120);
    const sx = x + rr(-30, 30);
    const t = rr(450, 600) / 1000;
    const vy = (y - GAME_H - 10 - 0.5 * 160 * t * t) / t;
    fw.add({ x: sx, y: GAME_H + 10, vx: (x - sx) / t, vy, ay: 160, life: t * 1000, ramp: [PAL.gold4, PAL.gold3], trail: true, onDie: (px, py) => firework(px, py, rnd() < 0.5) });
  };
  const loop = onFrame(scene, (dt, el) => {
    rays.draw((g) => {
      if (raysOn <= 0.02) return;
      const rot = el * 0.00025;
      for (let y = 0; y < RH; y++)
        for (let x = 0; x < RW; x++) {
          const i = y * RW + x;
          const r = rad[i];
          if (r < 24) continue;
          const a = ang[i] + rot;
          const w = (((a / TAU) * 16) % 1 + 1) % 1;
          if (w > 0.42) continue;
          const fall = Math.max(0, 1 - r / 175);
          const core = w > 0.14 && w < 0.28;
          const lv = raysOn * fall * (w < 0.05 || w > 0.37 ? 0.45 : 1);
          if (core && bayer(x, y) < lv * 0.55) g.px(x, y, PAL.gold1);
          else if (bayer(x, y) < lv * 1.1) g.px(x, y, PAL.gold0);
        }
    });
    if (dismissed) return;
    fwAcc += dt;
    if (raysOn > 0.5 && fwAcc > 380) {
      fwAcc = 0;
      rocket();
    }
    if (dt > 0 && raysOn > 0.5 && rnd() < 0.25) glitter.add({ x: rr(0, GAME_W), y: -4, vx: rr(-8, 8), vy: rr(28, 52), wobble: 12, life: rr(2600, 4000), ramp: [PAL.gold4, PAL.gold3, PAL.gold2], tex: rnd() < 0.2 ? TEX.plus : TEX.px1, flicker: rnd() < 0.4 });
  });
  objs.push({ destroy: loop });

  const destroyAll = () => objs.forEach((ob) => ob.destroy());
  const state: VictoryState = {
    dismiss: () => {
      dismissed = true;
      destroyAll();
    },
  };
  victories.set(scene, state);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    dismissed = true;
    destroyAll();
    if (victories.get(scene) === state) victories.delete(scene);
  });

  await sleep(scene, 160);
  const title = `KAZANAN: OYUNCU ${player + 1}`;
  const nameStart = title.indexOf('OYUNCU');
  const built = await slamBanner(scene, title, { ...STYLE.big, H: 58, mul: 1 }, RAMPS.gold, {
    punch: true,
    keep: true,
    stagger: 34,
    letterTint: (l) => (l.index >= nameStart - 1 ? pr[3] : PAL.gold3),
  });
  objs.push(...built.objs);
  if (dismissed) {
    destroyAll();
    return;
  }
  void run(scene, 500, (t) => (raysOn = E.outQuad(t)));
  firework(GAME_W / 2 - 150, CY - 60, true);
  void sleep(scene, 160).then(() => !dismissed && firework(GAME_W / 2 + 160, CY - 70, true));
  void sleep(scene, 320).then(() => !dismissed && firework(GAME_W / 2, CY - 100, true));

  state.dismiss = (ms: number) => {
    if (dismissed) return;
    dismissed = true;
    if (ms <= 0) {
      destroyAll();
      return;
    }
    void run(scene, ms, (t) => {
      const a = 1 - t;
      const s = a > 0.66 ? 1 : a > 0.33 ? 0.6 : 0.25;
      built.letters.forEach((l) => l.obj.active && l.obj.setAlpha(s));
      built.band.img.setAlpha(s);
      shade.setAlpha(0.55 * a);
      raysOn = a;
    }).then(destroyAll);
  };
  await sleep(scene, o.hold ?? 1200);
}

/**
 * Fade out any persistent banner (the victory screen) over `ms` (0 = instantly).
 * Safe to call when nothing is up.
 */
export function clearBanners(scene: Phaser.Scene, ms = 300): void {
  const v = victories.get(scene);
  if (!v) return;
  victories.delete(scene);
  v.dismiss(ms);
}
