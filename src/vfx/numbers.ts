// Damage / heal / stat numbers — chunky outlined pixel digits drawn here (independent of the UI font).
//
//   damageNumber(scene, x, y, 700, 'damage')   // −700, red, white flash frame, pops & floats away
//   damageNumber(scene, x, y, 1000, 'heal')    // +1000, green
//   statPop(scene, x, y, 1700, 2400)           // rolling counter → green pop, "+700", ▲ arrows
//
// Glyphs: bold 2px-stroke digits, 7×11 (the "1" is 6 wide), gradient fill from the kind's ramp,
// 1px ink outline and a 1px drop shadow. Sheets are built at boot (src/boot/13-vfx-combat.ts) or
// lazily on first use. Both functions resolve after the POP (≈0.45 s); the float/fade finishes
// and cleans up on its own.

import Phaser from 'phaser';
import { PAL, RAMPS, type Ramp } from '../art/palette';
import { PixelCanvas } from '../art/pixel';
import { DEPTH } from '../view/layout';
import { animate, E, onFrame } from './combat';

export type NumberKind = 'damage' | 'heal' | 'buff' | 'debuff';
type Sheet = NumberKind | 'flash' | 'stat';

const GLYPHS: Record<string, readonly string[]> = {
  '0': ['.#####.', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '.#####.'],
  '1': ['..##..', '.###..', '####..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '######'],
  '2': ['.#####.', '##...##', '.....##', '.....##', '....##.', '...##..', '..##...', '.##....', '##.....', '##.....', '#######'],
  '3': ['.#####.', '##...##', '.....##', '.....##', '..####.', '.....##', '.....##', '.....##', '.....##', '##...##', '.#####.'],
  '4': ['....##.', '...###.', '..####.', '.##.##.', '##..##.', '##..##.', '#######', '....##.', '....##.', '....##.', '....##.'],
  '5': ['#######', '##.....', '##.....', '######.', '.....##', '.....##', '.....##', '.....##', '.....##', '##...##', '.#####.'],
  '6': ['.#####.', '##...##', '##.....', '##.....', '######.', '##...##', '##...##', '##...##', '##...##', '##...##', '.#####.'],
  '7': ['#######', '.....##', '.....##', '....##.', '....##.', '...##..', '...##..', '..##...', '..##...', '..##...', '..##...'],
  '8': ['.#####.', '##...##', '##...##', '##...##', '.#####.', '##...##', '##...##', '##...##', '##...##', '##...##', '.#####.'],
  '9': ['.#####.', '##...##', '##...##', '##...##', '##...##', '.######', '.....##', '.....##', '.....##', '##...##', '.#####.'],
  '+': ['......', '......', '......', '..##..', '..##..', '######', '######', '..##..', '..##..', '......', '......'],
  '-': ['.....', '.....', '.....', '.....', '.....', '#####', '#####', '.....', '.....', '.....', '.....'],
  '^': ['.......', '.......', '...#...', '..###..', '.#####.', '#######', '..###..', '..###..', '..###..', '.......', '.......'],
  v: ['.......', '.......', '..###..', '..###..', '..###..', '#######', '.#####.', '..###..', '...#...', '.......', '.......'],
};
const CHARS = Object.keys(GLYPHS);
const GH = 11;
const CELL_H = GH + 3;

const RAMP: Record<Sheet, Ramp> = {
  damage: RAMPS.crim,
  heal: RAMPS.leaf,
  buff: RAMPS.gold,
  debuff: [PAL.void0, PAL.void2, PAL.crim2, PAL.mag3, PAL.mag4],
  flash: [PAL.night3, PAL.mist, PAL.white, PAL.white, PAL.white],
  stat: [PAL.night1, PAL.steel, PAL.mist, PAL.white, PAL.white],
};

function sheetKey(k: Sheet): string {
  return `fx:num:${k}`;
}

function glyphW(ch: string): number {
  return GLYPHS[ch][0].length;
}

/** Build every digit sheet (idempotent). Called by the boot step; also called lazily. */
export function buildNumberTextures(scene: Phaser.Scene): void {
  for (const kind of Object.keys(RAMP) as Sheet[]) {
    const key = sheetKey(kind);
    if (scene.textures.exists(key)) continue;
    const ramp = RAMP[kind];
    let W = 0;
    for (const ch of CHARS) W += glyphW(ch) + 3;
    const sheet = new PixelCanvas(W, CELL_H);
    const frames: [string, number, number][] = [];
    let ox = 0;
    for (const ch of CHARS) {
      const rows = GLYPHS[ch];
      const gw = rows[0].length;
      const p = new PixelCanvas(gw + 3, CELL_H);
      // fill: lit top rows → darker base, white glint on the top-left of the stroke
      for (let y = 0; y < GH; y++)
        for (let x = 0; x < gw; x++) {
          if (rows[y][x] !== '#') continue;
          const c = y <= 1 ? ramp[4] : y <= 5 ? ramp[3] : y <= 9 ? ramp[2] : ramp[1];
          p.set(x + 1, y + 1, c);
        }
      for (let y = 0; y < GH; y++)
        for (let x = 0; x < gw; x++) {
          if (rows[y][x] !== '#') continue;
          const up = y > 0 && rows[y - 1][x] === '#';
          const left = x > 0 && rows[y][x - 1] === '#';
          if (!up && !left && y < 6) p.set(x + 1, y + 1, PAL.white);
        }
      p.outline(PAL.ink, { corners: true });
      // drop shadow (down-right), only where empty
      const sh = p.clone();
      for (let y = 0; y < CELL_H; y++)
        for (let x = 0; x < gw + 3; x++) if (sh.isOpaque(x, y) && !p.isOpaque(x + 1, y + 1)) p.set(x + 1, y + 1, ramp[0]);
      sheet.blit(p, ox, 0);
      frames.push([ch, ox, gw + 3]);
      ox += gw + 3;
    }
    const tex = scene.textures.addCanvas(key, sheet.toCanvas())!;
    for (const [ch, x, w] of frames) tex.add(ch, 0, x, 0, w, CELL_H);
  }
}

interface Glyph {
  img: Phaser.GameObjects.Image;
  ch: string;
  cx: number;
}

/** Lay out a string of glyphs centered at (0, 0) inside a container. */
function makeGlyphs(scene: Phaser.Scene, c: Phaser.GameObjects.Container, text: string, sheet: Sheet): Glyph[] {
  let total = 0;
  for (const ch of text) total += glyphW(ch) + 1;
  total -= 1;
  let x = -Math.floor(total / 2);
  const out: Glyph[] = [];
  for (const ch of text) {
    const w = glyphW(ch);
    const img = scene.add.image(0, 0, sheetKey(sheet), ch).setOrigin(0.5, 0.5);
    // the cell is glyph + 1px outline left/top + outline/shadow right/bottom
    const cx = x + (w + 3) / 2 - 1;
    img.setPosition(cx, 0);
    c.add(img);
    out.push({ img, ch, cx });
    x += w + 1;
  }
  return out;
}

function setSheet(gs: Glyph[], sheet: Sheet): void {
  for (const g of gs) g.img.setTexture(sheetKey(sheet), g.ch);
}

export interface NumberOpts {
  /** Integer pixel scale (1 or 2). Default 1; 2 for duelist hits. */
  size?: 1 | 2;
  depth?: number;
  /** Float distance in px (default 18). */
  rise?: number;
}

/**
 * Pop a number at (x, y): staggered per-digit pop with overshoot (white flash frame for damage),
 * a little jolt, wobble while it floats up, then fade. Resolves after the pop (~0.45 s).
 */
export function damageNumber(scene: Phaser.Scene, x: number, y: number, amount: number, kind: NumberKind = 'damage', opts: NumberOpts = {}): Promise<void> {
  buildNumberTextures(scene);
  const neg = kind === 'damage' || kind === 'debuff';
  const text = (neg ? '-' : '+') + String(Math.abs(Math.round(amount)));
  const size = opts.size ?? 1;
  const c = scene.add.container(Math.round(x), Math.round(y)).setDepth(opts.depth ?? DEPTH.FX_TOP + 50);
  const gs = makeGlyphs(scene, c, text, kind === 'damage' ? 'flash' : kind);
  const rise = opts.rise ?? 18;
  const POP = 240;
  const STAG = 28;
  const LIFE = 1250;
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  let swapped = kind !== 'damage';
  let resolvePop!: () => void;
  const popped = new Promise<void>((r) => (resolvePop = r));
  let resolvedPop = false;
  onFrame(scene, (_dt, el) => {
    if (!c.active) return false;
    if (!swapped && el > 50) {
      swapped = true;
      setSheet(gs, kind);
    }
    gs.forEach((g, i) => {
      const lt = el - i * STAG;
      let s: number;
      if (lt <= 0) s = 0;
      else if (lt < POP) s = 1.75 - 0.75 * E.outBack(lt / POP, 3.4);
      else s = 1;
      g.img.setScale(Math.max(0, s) * size);
      const wob = lt > POP ? Math.round(Math.sin((lt - POP) * 0.016 + i * 0.9) * 0.9) : 0;
      g.img.setPosition(Math.round(g.cx * size), wob * size);
    });
    // jump, drift, fade
    const jump = E.outQ(Math.min(1, el / 140)) * 7;
    const drift = E.outQ(Math.min(1, el / LIFE)) * rise;
    const jolt = kind === 'damage' && el < 160 ? (Math.floor(el / 33) % 2 ? 1 : -1) * (el < 100 ? 2 : 1) : 0;
    c.setPosition(x0 + jolt, Math.round(y0 - jump - drift));
    const fadeAt = LIFE - 280;
    c.setAlpha(el < fadeAt ? 1 : Math.max(0, 1 - (el - fadeAt) / 280));
    if (!resolvedPop && el >= POP + STAG * (gs.length - 1) + 120) {
      resolvedPop = true;
      resolvePop();
    }
    return el < LIFE;
  }, () => {
    c.destroy();
    if (!resolvedPop) resolvePop();
  });
  return popped;
}

/**
 * ATK change pop at (x, y): the value rolls from → to (digits bump as they change), then flashes
 * green (up) or red (down) with a pop, a "+700"/"−300" delta jumps out above and little ▲/▼
 * arrows stream away. Resolves after the roll + pop (~0.75 s).
 */
export function statPop(scene: Phaser.Scene, x: number, y: number, from: number, to: number, opts: { depth?: number; size?: 1 | 2 } = {}): Promise<void> {
  buildNumberTextures(scene);
  const up = to >= from;
  const final: NumberKind = up ? 'heal' : 'damage';
  const size = opts.size ?? 1;
  const depth = opts.depth ?? DEPTH.FX_TOP + 50;
  const digits = Math.max(String(Math.round(from)).length, String(Math.round(to)).length);
  const c = scene.add.container(Math.round(x), Math.round(y)).setDepth(depth);
  const pad = (v: number) => String(Math.max(0, Math.round(v))).padStart(digits, ' ');
  let gs: Glyph[] = [];
  let shown = '';
  const ROLL = 520;
  const POP = 220;
  const LIFE = 1300;
  const render = (str: string, sheet: Sheet) => {
    const trimmed = str.trim();
    if (trimmed === shown && gs.length) {
      setSheet(gs, sheet);
      return;
    }
    const prev = shown;
    shown = trimmed;
    for (const g of gs) g.img.destroy();
    gs = makeGlyphs(scene, c, trimmed, sheet);
    // digits that changed this frame bump up a pixel
    gs.forEach((g, i) => {
      g.img.setScale(size);
      const changed = prev.length !== trimmed.length || prev[i] !== trimmed[i];
      g.img.setPosition(Math.round(g.cx * size), changed ? -size : 0);
    });
  };
  render(pad(from), 'stat');
  const arrows = scene.add.container(Math.round(x), Math.round(y)).setDepth(depth - 1);
  const arrowBits: { img: Phaser.GameObjects.Image; vx: number; vy: number; born: number }[] = [];
  let spawned = 0;
  let deltaShown = false;
  let resolvePop!: () => void;
  const popped = new Promise<void>((r) => (resolvePop = r));
  let resolved = false;
  onFrame(scene, (dt, el) => {
    if (!c.active) return false;
    if (el < ROLL) {
      const v = from + (to - from) * E.outQ(el / ROLL);
      render(pad(v), 'stat');
    } else {
      const pe = el - ROLL;
      render(pad(to), pe < 34 ? 'flash' : final);
      const s = pe < POP ? 1.6 - 0.6 * E.outBack(pe / POP, 3) : 1;
      gs.forEach((g) => {
        g.img.setScale(s * size);
        g.img.setPosition(Math.round(g.cx * size * s), 0);
      });
      if (!deltaShown) {
        deltaShown = true;
        void damageNumber(scene, x, y - 13 * size, Math.abs(to - from), up ? 'heal' : 'damage', { depth: depth + 1, rise: 10 });
      }
      if (!resolved && pe > POP) {
        resolved = true;
        resolvePop();
      }
    }
    // arrow particles
    if (dt > 0 && el > 80 && el < ROLL + 300 && spawned < 7 && el > spawned * 90) {
      spawned++;
      const img = scene.add.image(0, 0, sheetKey(final), up ? '^' : 'v').setScale(1);
      const ax = (spawned % 2 ? -1 : 1) * (8 + ((spawned * 5) % 9)) * size;
      img.setPosition(ax, up ? 4 : -6);
      arrows.add(img);
      arrowBits.push({ img, vx: 0, vy: up ? -26 : 22, born: el });
    }
    for (let i = arrowBits.length - 1; i >= 0; i--) {
      const a = arrowBits[i];
      const age = el - a.born;
      if (age > 520) {
        a.img.destroy();
        arrowBits.splice(i, 1);
        continue;
      }
      a.img.y = Math.round((up ? 4 : -6) + (a.vy * age) / 1000);
      a.img.setAlpha(age < 360 ? 1 : 1 - (age - 360) / 160);
      a.img.setVisible(Math.floor(age / 60) % 4 !== 3);
    }
    const fadeAt = LIFE - 250;
    c.setAlpha(el < fadeAt ? 1 : Math.max(0, 1 - (el - fadeAt) / 250));
    return el < LIFE;
  }, () => {
    c.destroy();
    arrows.destroy();
    if (!resolved) resolvePop();
  });
  void animate;
  return popped;
}
