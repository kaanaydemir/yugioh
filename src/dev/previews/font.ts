// ?dev=font — pixel font specimen over a deliberately busy dithered background.
//   &page=main    pangrams at every size, card text box, LP line, DÜELLO! / TUZAK! (default)
//   &page=chars   full charset of sm and md, outline + plain, lg digits (&flat=1: plain backdrop)
//   &page=colors  every palette color, outline on/off, gradient tints
//   &page=anim    pixelLetters() banner + LP counter (use --film)
//   &page=zoom    a few lines at 1× for --clip zooms (&scale param of shot.mjs)
//   &page=metrics measured boxes around text + 200-case fuzz of measureText vs Phaser bounds
import type Phaser from 'phaser';
import { PAL, RAMPS } from '../../art/palette';
import { PixelCanvas, mulberry32 } from '../../art/pixel';
import { fontCharset } from '../../art/font';
import { measureText, pixelLetters, pixelText, revealText, typeText, upper, textMetrics, type TextSize } from '../../ui/text';
import type { DevPreview } from '../types';

const PANGRAM = 'Pijamalı hasta yağız şoföre çabucak güvendi.';
const CARD_TEXT = 'Kurbanla Çağrıldığında: rakibin 1 Büyü/Tuzak kartını yok et.';

/** Busy test background: dithered diagonal color bands + bright speckles + a checker strip. */
function busyBackground(scene: Phaser.Scene, key = 'dev-font-bg'): void {
  if (!scene.textures.exists(key)) {
    const p = new PixelCanvas(640, 360);
    const ramps = [RAMPS.night, RAMPS.cyan, RAMPS.void, RAMPS.crim, RAMPS.gold, RAMPS.teal, RAMPS.mag, RAMPS.fire, RAMPS.water, RAMPS.leaf];
    for (let y = 0; y < 360; y++) {
      for (let x = 0; x < 640; x++) {
        const band = Math.floor((x + y * 0.6) / 64);
        const ramp = ramps[band % ramps.length];
        const t = ((x + y * 0.6) % 64) / 64; // 0..1 inside the band
        const lvl = Math.floor(t * 16);
        const a = ramp[1 + (band % 2)];
        const b = ramp[3 + (band % 2)];
        p.set(x, y, PixelCanvas.ditherAt(x, y, lvl) ? b : a);
      }
    }
    const rnd = mulberry32(7);
    for (let i = 0; i < 2600; i++) p.set(Math.floor(rnd() * 640), Math.floor(rnd() * 360), rnd() < 0.5 ? PAL.white : PAL.ink);
    for (let x = 0; x < 640; x++) for (let y = 0; y < 360; y += 1) if (y % 40 === 0) p.set(x, y, PAL.gold4);
    scene.textures.addCanvas(key, p.toCanvas());
  }
  scene.add.image(0, 0, key).setOrigin(0, 0);
}

function label(scene: Phaser.Scene, x: number, y: number, s: string): void {
  pixelText(scene, x, y, s, { size: 'sm', color: PAL.gold3 });
}

function pageMain(scene: Phaser.Scene): void {
  busyBackground(scene);
  let y = 2;
  const rows: [TextSize, string][] = [
    ['sm', PANGRAM],
    ['sm', upper(PANGRAM)],
    ['md', PANGRAM],
    ['md', upper(PANGRAM)],
  ];
  for (const [size, s] of rows) {
    pixelText(scene, 4, y, s, { size });
    y += textMetrics(size).lineHeight + 1;
  }
  pixelText(scene, 4, y, 'Yağız şoför', { size: 'lg', color: PAL.cyan3 });
  pixelText(scene, 636, y, 'LP 4000', { size: 'lg', color: PAL.gold3, originX: 1 });
  y += textMetrics('lg').lineHeight + 2;

  // card text boxes (92 px), left / center / right
  const boxW = 92;
  (['left', 'center', 'right'] as const).forEach((align, i) => {
    const bx = 4 + i * (boxW + 10);
    const m = measureText(CARD_TEXT, 'sm', boxW);
    const g = scene.add.graphics();
    g.fillStyle(PAL.night0, 0.0);
    g.lineStyle(1, PAL.gold3, 1);
    g.strokeRect(bx - 0.5, y - 0.5, boxW + 1, m.h + 1);
    pixelText(scene, bx + (align === 'center' ? boxW / 2 : align === 'right' ? boxW : 0), y, CARD_TEXT, {
      size: 'sm',
      maxWidth: boxW,
      align,
      originX: align === 'center' ? 0.5 : align === 'right' ? 1 : 0,
    });
  });
  // same text on a solid card panel
  const px = 4 + 3 * (boxW + 10);
  const m = measureText(CARD_TEXT, 'sm', boxW);
  const g = scene.add.graphics();
  g.fillStyle(PAL.night1, 1).fillRect(px - 2, y - 2, boxW + 4, m.h + 4);
  g.lineStyle(1, PAL.teal3, 1).strokeRect(px - 2.5, y - 2.5, boxW + 5, m.h + 5);
  pixelText(scene, px, y, CARD_TEXT, { size: 'sm', maxWidth: boxW, color: PAL.mist });
  // ink text straight on the busy art (plain, no outline) and SNES-style plain + drop shadow on a panel
  pixelText(scene, px + boxW + 10, y, CARD_TEXT, { size: 'sm', maxWidth: boxW, outline: false, color: PAL.ink });
  const sx = px + 2 * (boxW + 10) - 2;
  g.fillStyle(PAL.void1, 1).fillRect(sx - 2, y - 2, boxW + 6, m.h + 4);
  g.lineStyle(1, PAL.void3, 1).strokeRect(sx - 2.5, y - 2.5, boxW + 7, m.h + 5);
  pixelText(scene, sx, y, CARD_TEXT, { size: 'sm', maxWidth: boxW, outline: false, shadow: 1, color: PAL.void4 });
  y += m.h + 6;

  pixelText(scene, 4, y, 'LP 4000  ATK 2800 / DEF 2300', { size: 'sm' });
  pixelText(scene, 200, y, 'LP 4000  ATK 2800 / DEF 2300', { size: 'md', color: PAL.gold3 });
  y += textMetrics('md').lineHeight + 2;

  pixelText(scene, 160, y + 2, 'DÜELLO!', { size: 'xl', color: PAL.gold3, originX: 0.5, shadow: 1 });
  pixelText(scene, 480, y + 2, 'TUZAK!', { size: 'xl', color: PAL.mag3, originX: 0.5, shadow: 1 });
  y += textMetrics('xl').lineHeight + 2;
  pixelText(scene, 4, y, 'İĞÜŞÖÇ ığüşöç  KAZANDIN  Kurbanla Çağır  ★AS ♥ → ×3 … — 10% (x+y)=[a<b] ≥1000', { size: 'md', color: PAL.cyan4 });
  y += textMetrics('md').lineHeight + 4;

  // banner / HUD sizes
  const sira = pixelText(scene, 4, y, 'SIRA SENDE', { size: 'lg', shadow: 1 });
  sira.setTint(PAL.cyan4, PAL.cyan4, PAL.cyan2, PAL.cyan2);
  pixelText(scene, 200, y, 'KAZANAN: OYUNCU 2', { size: 'lg', color: PAL.crim3, shadow: 1 });
  pixelText(scene, 636, y - 6, '-2800', { size: 'xl', color: PAL.crim3, originX: 1 });
  y += textMetrics('lg').lineHeight + 2;
  pixelText(scene, 4, y, 'ÇEKME  ANA  SAVAŞ  BİTİŞ', { size: 'md', color: PAL.white });
  pixelText(scene, 200, y, 'Şifa Pınarı  +1000 LP', { size: 'md', color: PAL.teal3 });
  pixelText(scene, 360, y, 'Ayna Kalkanı', { size: 'md', color: PAL.mag3 });
  pixelText(scene, 460, y, 'Kristal Ejder ★7', { size: 'md', color: PAL.gold3 });
}

function pageChars(scene: Phaser.Scene, params?: URLSearchParams): void {
  if (params?.get('flat')) scene.add.rectangle(0, 0, 640, 360, PAL.night2).setOrigin(0, 0);
  else busyBackground(scene);
  const chars = fontCharset('sm').join('');
  let y = 2;
  for (const size of ['sm', 'md'] as const) {
    for (const outline of [true, false]) {
      label(scene, 4, y, `${size} ${outline ? 'outline' : 'plain'}`);
      y += 11;
      const t = pixelText(scene, 4, y, chars, { size, outline, maxWidth: 632 });
      y += t.height + 3;
    }
  }
  pixelText(scene, 4, y, '0123456789 LP 8000', { size: 'lg', color: PAL.gold3 });
}

function pageColors(scene: Phaser.Scene): void {
  busyBackground(scene);
  const names = Object.keys(PAL) as (keyof typeof PAL)[];
  const colW = 80;
  names.forEach((name, i) => {
    const col = i % 8;
    const row = Math.floor(i / 8);
    const x = 4 + col * colW;
    const y = 2 + row * 24;
    pixelText(scene, x, y, `${name} Çağrı`, { size: 'sm', color: PAL[name] });
    pixelText(scene, x, y + 10, 'Düello', { size: 'md', color: PAL[name] });
  });
  const y0 = 2 + Math.ceil(names.length / 8) * 24 + 2;
  pixelText(scene, 4, y0, 'Outline AÇIK: Işık Zincirleri', { size: 'md', color: PAL.white });
  pixelText(scene, 4, y0 + 16, 'Outline KAPALI: Işık Zincirleri', { size: 'md', color: PAL.white, outline: false });
  pixelText(scene, 260, y0, 'Gölge Suikastçı', { size: 'lg', color: PAL.void3 });
  pixelText(scene, 260, y0 + 30, 'Gölge Suikastçı', { size: 'lg', color: PAL.void3, outline: false });
  const grad = pixelText(scene, 4, y0 + 34, 'ALTIN', { size: 'xl', shadow: 1 });
  grad.setTint(PAL.gold4, PAL.gold4, PAL.gold2, PAL.gold2);
}

function pageZoom(scene: Phaser.Scene): void {
  busyBackground(scene);
  pixelText(scene, 4, 4, PANGRAM, { size: 'sm' });
  pixelText(scene, 4, 16, upper(PANGRAM), { size: 'sm', color: PAL.cyan3 });
  pixelText(scene, 4, 28, CARD_TEXT, { size: 'sm', maxWidth: 92, color: PAL.white });
  pixelText(scene, 110, 28, 'ATK 2800 / DEF 2300', { size: 'sm', color: PAL.gold3 });
  pixelText(scene, 110, 40, 'İĞÜŞÖÇ ığüşöç Âlâ îû', { size: 'sm', color: PAL.white });
  pixelText(scene, 4, 80, PANGRAM, { size: 'md' });
  pixelText(scene, 4, 95, upper(PANGRAM), { size: 'md', color: PAL.crim3 });
  pixelText(scene, 4, 110, 'İĞÜŞÖÇ ığüşöç Âlâ îû 0123456789', { size: 'md', color: PAL.teal3 });
}

/** Looping 2.4 s demo (film it with --film): letter drop-in banner + tabular LP counter. */
function pageAnim(scene: Phaser.Scene): void {
  busyBackground(scene);
  const { letters } = pixelLetters(scene, 320, 120, 'DÜELLO!', { size: 'xl', color: PAL.gold3, originX: 0.5, originY: 0.5, shadow: 1 });
  const lp = pixelText(scene, 320, 220, 'LP 4000', { size: 'lg', color: PAL.cyan3, originX: 0.5 });
  // typewriter on a centered, wrapped card text: layout must not move while typing
  const panel = scene.add.graphics();
  const m = measureText(CARD_TEXT, 'sm', 92);
  panel.fillStyle(PAL.night1, 1).fillRect(320 - 50, 160 - 4, 100, m.h + 8);
  panel.lineStyle(1, PAL.mag3, 1).strokeRect(320 - 50.5, 160 - 4.5, 101, m.h + 9);
  const card = pixelText(scene, 320, 160, CARD_TEXT, { size: 'sm', maxWidth: 92, align: 'center', originX: 0.5, color: PAL.mist });
  let counter: Phaser.Tweens.Tween | undefined;
  const run = () => {
    letters.forEach((l, i) => {
      // one deterministic curve per letter: fall (stretched) → squash on impact → settle
      const d = { t: 0 };
      scene.tweens.killTweensOf(d);
      l.obj.setPosition(l.x, l.y - 70).setAlpha(0).setScale(1);
      scene.tweens.add({
        targets: d,
        t: 1,
        delay: i * 60,
        duration: 420,
        onUpdate: () => {
          const t = d.t;
          if (t < 0.4) {
            const k = t / 0.4;
            l.obj.setPosition(l.x, l.y - 70 * (1 - k * k)).setAlpha(Math.min(1, k * 3)).setScale(0.85, 1.3);
          } else if (t < 0.6) {
            const k = (t - 0.4) / 0.2;
            const sq = Math.sin(k * Math.PI);
            l.obj.setPosition(l.x, l.y + 2 * sq).setAlpha(1).setScale(1 + 0.3 * sq, 1 - 0.35 * sq);
          } else {
            const k = (t - 0.6) / 0.4;
            const wob = Math.sin(k * Math.PI * 2) * (1 - k) * 0.08;
            l.obj.setPosition(l.x, l.y).setScale(1 - wob, 1 + wob);
          }
        },
        onComplete: () => l.obj.setPosition(l.x, l.y).setScale(1).setAlpha(1),
      });
    });
    const o = { v: 4000 };
    lp.setText('LP 4000');
    counter?.stop();
    revealText(card, 0);
    scene.time.delayedCall(300, () => void typeText(scene, card, 60));
    counter = scene.tweens.add({ targets: o, v: 1200, delay: 700, duration: 800, ease: 'Cubic.Out', onUpdate: () => lp.setText(`LP ${Math.round(o.v)}`) });
  };
  run();
  scene.time.addEvent({ delay: 2400, loop: true, callback: run });
}

/** Measured boxes (gold) drawn around text with every origin/align — they must hug the outline exactly. */
function pageMetrics(scene: Phaser.Scene): void {
  scene.add.rectangle(0, 0, 640, 360, PAL.night2).setOrigin(0, 0);
  const g = scene.add.graphics().setDepth(10);
  const box = (x: number, y: number, s: string, opts: Parameters<typeof pixelText>[4]) => {
    const t = pixelText(scene, x, y, s, opts);
    const m = measureText(s, opts?.size, opts?.maxWidth, opts?.outline ?? true);
    const left = Math.round(x) - (opts?.originX ?? 0) * m.w;
    const top = Math.round(y) - (opts?.originY ?? 0) * m.h;
    g.lineStyle(1, PAL.gold3, 1).strokeRect(Math.round(left) - 0.5, Math.round(top) - 0.5, m.w + 1, m.h + 1);
    if (t.width !== m.w || t.height !== m.h) {
      const msg = `metrics mismatch '${s}' ${opts?.size}: phaser ${t.width}x${t.height} vs ${m.w}x${m.h}`;
      console.error(msg);
      window.__neon.errors.push(msg);
    }
  };
  box(10, 10, 'Hİç', { size: 'sm' });
  box(60, 10, 'Hİç', { size: 'sm', outline: false });
  box(110, 10, 'Ağış', { size: 'md' });
  box(170, 10, 'Ağış', { size: 'md', outline: false });
  box(240, 10, 'ÇIĞ', { size: 'lg' });
  box(330, 10, 'Ü!', { size: 'xl' });
  box(470, 30, 'merkez', { size: 'md', originX: 0.5, originY: 0.5 });
  box(630, 10, 'sağ', { size: 'md', originX: 1 });
  box(10, 80, CARD_TEXT, { size: 'sm', maxWidth: 92 });
  box(160, 80, CARD_TEXT, { size: 'sm', maxWidth: 92, align: 'center', originX: 0.5 });
  box(300, 80, CARD_TEXT, { size: 'sm', maxWidth: 92, align: 'right', originX: 1 });
  box(320, 80, 'Ruh Çağrısı\nHerhangi bir mezarlıktan', { size: 'md', align: 'center' });
  box(10, 160, 'Volkan Arenası', { size: 'lg', maxWidth: 120 });
  box(200, 160, 'İki satır\nyazı', { size: 'xl', align: 'right' });
  box(400, 160, 'Kurbanla Çağrıldığında', { size: 'md', maxWidth: 70, outline: false });
  box(500, 160, 'Çokuzunbirkelimeburada', { size: 'sm', maxWidth: 50 });
  // pixelLetters must land exactly where pixelText draws the same glyphs
  for (const [size, align, ox] of [['xl', 'left', 0], ['md', 'center', 0.5], ['sm', 'right', 1], ['lg', 'center', 0.5]] as const) {
    const s = 'Kurbanla Çağır İŞ ★2';
    const ref = pixelText(scene, 333, 222, s, { size, align, originX: ox, originY: 0.5, maxWidth: 120 });
    const { letters } = pixelLetters(scene, 333, 222, s, { size, align, originX: ox, originY: 0.5, maxWidth: 120 });
    const chars = ref.getTextBounds().characters.filter((c) => c.char !== ' ');
    if (chars.length !== letters.length || letters.length < 15) window.__neon.errors.push(`pixelLetters count ${letters.length} vs ${chars.length}`);
    letters.forEach((l, i) => {
      const c = chars[i];
      const refLeft = ref.x - ref.displayOriginX + c.x;
      const refTop = ref.y - ref.displayOriginY + c.t;
      const left = l.obj.x - l.obj.displayOriginX;
      const top = l.obj.y - l.obj.displayOriginY;
      if (c.char !== l.ch || Math.abs(refLeft - left) > 0.01 || Math.abs(refTop - top) > 0.01) {
        const msg = `pixelLetters mismatch ${size} '${l.ch}' vs '${c.char}': ${left},${top} vs ${refLeft},${refTop}`;
        console.error(msg);
        window.__neon.errors.push(msg);
      }
      l.obj.destroy();
    });
    ref.destroy();
  }

  // random fuzz: sizes × outline × wrap widths
  const words = ['Kristal', 'Ejder', 'Işık', 'Perisi', 'ATK', '2800', 'Büyü/Tuzak', 'yok', 'et.', 'Ğ', 'İ', '★', '…'];
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 200; i++) {
    const n = 1 + Math.floor(rnd() * 8);
    const s = Array.from({ length: n }, () => words[Math.floor(rnd() * words.length)]).join(' ');
    const size = (['sm', 'md', 'lg', 'xl'] as const)[Math.floor(rnd() * 4)];
    const outline = rnd() < 0.7;
    const maxWidth = rnd() < 0.6 ? 30 + Math.floor(rnd() * 200) : undefined;
    const t = pixelText(scene, 0, 0, s, { size, outline, maxWidth, align: 'center' });
    const m = measureText(s, size, maxWidth, outline);
    if (t.width !== m.w || t.height !== m.h || (maxWidth && t.text.split('\n').length > 1 && m.w > maxWidth && !t.text.split('\n').some((l) => !l.includes(' ')))) {
      const msg = `fuzz mismatch '${s}' ${size} ${outline} ${maxWidth}: phaser ${t.width}x${t.height} vs ${m.w}x${m.h}`;
      console.error(msg);
      window.__neon.errors.push(msg);
    }
    t.destroy();
  }
}

const preview: DevPreview = {
  name: 'font',
  description: 'pixel fonts: &page=main|chars|colors|anim|zoom|metrics',
  create(scene, params) {
    const page = params.get('page') ?? 'main';
    const pages: Record<string, (s: Phaser.Scene, p: URLSearchParams) => void> = {
      main: pageMain,
      chars: pageChars,
      colors: pageColors,
      anim: pageAnim,
      zoom: pageZoom,
      metrics: pageMetrics,
    };
    (pages[page] ?? pageMain)(scene, params);
  },
};

export default preview;
