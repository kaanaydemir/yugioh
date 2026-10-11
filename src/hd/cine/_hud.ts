// HD trial cine — screen-space pieces drawn for 960×540: the damage number (the shipped game's bold 7×11 digit
// font, doubled and re-finished with a 1 px HD outline, rounded corners, 6-band tone ramp and bevel), the ATK/DEF
// badge (crisp 5×7 digits on a lit plate), the 2.35:1 letterbox and the ace name plate.

import Phaser from 'phaser';
import { PAL, PLAYER_RAMP, type Ramp } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { drawGlyph, getFont } from '../../art/font';
import type { PlayerId } from '../../engine/types';
import { DEPTH } from '../../view/layout';
import { HD_H, HD_W } from '../contracts';
import { pixelText } from '../../ui/text';
import { E, type Cine } from './_kit';

// ================================================================ HD damage digits

// The shipped game's damage glyphs (src/vfx/numbers.ts), 7×11 with 2 px strokes.
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
  '-': ['.....', '.....', '.....', '.....', '.....', '#####', '#####', '.....', '.....', '.....', '.....'],
  '+': ['......', '......', '......', '..##..', '..##..', '######', '######', '..##..', '..##..', '......', '......'],
};

type NumSheet = 'damage' | 'flash' | 'heal';
const NUM_RAMP: Record<NumSheet, { body: Ramp; shadow: number; edge: number }> = {
  // dark → light
  damage: { body: [PAL.crim1, PAL.crim2, PAL.crim3, PAL.crim4, PAL.white], shadow: PAL.crim0, edge: PAL.ink },
  flash: { body: [PAL.mist, PAL.white, PAL.white, PAL.white, PAL.white], shadow: PAL.night3, edge: PAL.ink },
  heal: { body: [PAL.leaf1, PAL.leaf2, PAL.leaf3, PAL.leaf4, PAL.white], shadow: PAL.leaf0, edge: PAL.ink },
};
const K = 2; // glyph scale
const PAD = 3; // outline (1) + shadow (2)

function glyphMask(ch: string): { w: number; h: number; m: Uint8Array } {
  const rows = GLYPHS[ch];
  const gw = rows[0].length;
  const gh = rows.length;
  const w = gw * K;
  const h = gh * K;
  const m = new Uint8Array(w * h);
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < gw && y < gh && rows[y][x] === '#';
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      if (!at(x, y)) continue;
      for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) m[(y * K + j) * w + x * K + i] = 1;
      // round convex corners of the doubled strokes (the HD finish: no 2 px stair corners)
      const cut = (dx: number, dy: number, px: number, py: number) => {
        if (!at(x + dx, y) && !at(x, y + dy) && !at(x + dx, y + dy)) m[(y * K + py) * w + x * K + px] = 0;
      };
      cut(-1, -1, 0, 0);
      cut(1, -1, K - 1, 0);
      cut(-1, 1, 0, K - 1);
      cut(1, 1, K - 1, K - 1);
    }
  return { w, h, m };
}

function numKey(s: NumSheet): string {
  return `hd:cine:num:${s}`;
}

function buildNumSheet(scene: Phaser.Scene, sheet: NumSheet): void {
  const key = numKey(sheet);
  if (scene.textures.exists(key)) return;
  const { body, shadow, edge } = NUM_RAMP[sheet];
  const chars = Object.keys(GLYPHS);
  const cells = chars.map((ch) => {
    const g = glyphMask(ch);
    const W = g.w + PAD + 1;
    const H = g.h + PAD + 1;
    const p = new PixelCanvas(W, H);
    const on = (x: number, y: number) => x >= 0 && y >= 0 && x < g.w && y < g.h && g.m[y * g.w + x] === 1;
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        if (!on(x, y)) continue;
        const t = y / (g.h - 1);
        // six clean tone bands: hot top, lit body, a mid band, a darker base
        let c = t < 0.1 ? body[3] : t < 0.46 ? body[2] : t < 0.56 ? body[3] : t < 0.82 ? body[2] : body[1];
        if (!on(x, y - 1)) c = t < 0.5 ? body[4] : body[3]; // lit top edges
        else if (!on(x - 1, y) && t < 0.55) c = body[3]; // lit left edges
        if (!on(x, y + 1)) c = body[0]; // dark underside
        else if (!on(x + 1, y) && t > 0.45) c = body[1];
        p.set(x + 1, y + 1, c);
      }
    // 1 px outline (8-neighbour), then a 2 px drop shadow down-right
    const solid = p.clone();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (solid.isOpaque(x, y)) continue;
        let near = false;
        for (let j = -1; j <= 1 && !near; j++) for (let i = -1; i <= 1; i++) if (solid.isOpaque(x + i, y + j)) near = true;
        if (near) p.set(x, y, edge);
      }
    const ol = p.clone();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (p.isOpaque(x, y)) continue;
        if (ol.isOpaque(x - 1, y - 1) || ol.isOpaque(x - 2, y - 2)) p.set(x, y, shadow);
      }
    return { ch, p, gw: g.w };
  });
  const SW = cells.reduce((n, c) => n + c.p.w, 0);
  const SH = Math.max(...cells.map((c) => c.p.h));
  const out = new PixelCanvas(SW, SH);
  let ox = 0;
  const frames: [string, number, number, number][] = [];
  for (const c of cells) {
    out.blit(c.p, ox, 0);
    frames.push([c.ch, ox, c.p.w, c.p.h]);
    ox += c.p.w;
  }
  const tex = scene.textures.addCanvas(key, out.toCanvas())!;
  for (const [ch, x, w, h] of frames) tex.add(ch, 0, x, 0, w, h);
}

function glyphAdvance(ch: string): number {
  return GLYPHS[ch][0].length * K + 2;
}

/**
 * A damage / heal number popping at (x, y): staggered per-digit pop with overshoot (a white flash frame first),
 * jolt, rise and fade. Resolves after the pop; the float and the clean-up continue on their own.
 */
export function hdNumber(c: Cine, x: number, y: number, amount: number, kind: 'damage' | 'heal' = 'damage'): Promise<void> {
  const scene = c.scene;
  buildNumSheet(scene, 'flash');
  buildNumSheet(scene, kind);
  const text = (kind === 'damage' ? '-' : '+') + String(Math.abs(Math.round(amount)));
  const cont = scene.add.container(Math.round(x), Math.round(y)).setDepth(DEPTH.FX_TOP + 50);
  c.own(() => cont.destroy());
  let total = 0;
  for (const ch of text) total += glyphAdvance(ch);
  total -= 2;
  let gx = -Math.floor(total / 2);
  const gs = [...text].map((ch, i) => {
    const im = scene.add.image(0, 0, numKey('flash'), ch).setOrigin(0.5, 0.5);
    const cx = gx + (GLYPHS[ch][0].length * K) / 2 + 1;
    gx += glyphAdvance(ch);
    cont.add(im);
    return { im, ch, cx, i };
  });
  // soft red bloom behind the digits (light, not pixels)
  const halo = c.soft(x, y, 'glow', kind === 'damage' ? PAL.crim3 : PAL.leaf3, total * 1.9, 70, 0, 'front');
  const POP = 230;
  const STAG = 34;
  const LIFE = 1500;
  const rise = 30;
  let popped = false;
  return new Promise((resolve) => {
    void c.run(LIFE, (_t, _dt, el) => {
      if (!cont.active) return;
      const sheet = el < 70 ? 'flash' : kind;
      for (const g of gs) {
        const lt = el - g.i * STAG;
        if (g.im.texture.key !== numKey(sheet)) g.im.setTexture(numKey(sheet), g.ch);
        const s = lt <= 0 ? 0 : lt < POP ? 1.9 - 0.9 * E.outBack(lt / POP, 3.2) : 1;
        // whole-pixel scales once settled; pop frames may overshoot freely
        g.im.setScale(Math.max(0, s));
        const wob = lt > POP ? Math.round(Math.sin((lt - POP) * 0.014 + g.i * 0.9)) : 0;
        g.im.setPosition(Math.round(g.cx * (lt < POP ? Math.max(1, s) : 1)), wob);
      }
      const jump = E.outQ(Math.min(1, el / 150)) * 12;
      const drift = E.outQ(Math.min(1, el / LIFE)) * rise;
      const jolt = el < 180 ? (Math.floor(el / 33) % 2 ? 2 : -2) * (el < 110 ? 1 : 0.5) : 0;
      cont.setPosition(Math.round(x + jolt), Math.round(y - jump - drift));
      const fadeAt = LIFE - 320;
      const a = el < fadeAt ? 1 : Math.max(0, 1 - (el - fadeAt) / 320);
      cont.setAlpha(a);
      halo.setPosition(cont.x, cont.y).setAlpha(0.55 * a * (el < 120 ? 1.6 - el / 200 : 1));
      if (!popped && el > POP + STAG * gs.length) {
        popped = true;
        resolve();
      }
    }).then(() => {
      cont.destroy();
      halo.destroy();
      if (!popped) resolve();
    });
  });
}

// ================================================================ ATK / DEF badge

const D5: Record<string, readonly string[]> = {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '#.#..', '..#..', '..#..', '..#..', '#####'],
  '2': ['.###.', '#...#', '....#', '..##.', '.#...', '#....', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
};
const SWORD = ['....#', '...#.', '#.#..', '.#...', '#.#..'];
const SHIELD = ['#####', '#...#', '#...#', '.#.#.', '..#..'];

function drawD5(p: PixelCanvas, x: number, y: number, s: string, c: number, shade: number): number {
  let cx = x;
  for (const ch of s) {
    const g = D5[ch];
    if (!g) continue;
    // a darker lower half gives the digits a little volume
    for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (g[j][i] === '#') p.set(cx + i, y + j, j >= 5 ? shade : c);
    cx += 6;
  }
  return cx - x - 1;
}

/** The badge canvas (player plate, ATK bright, DEF dim). */
export function badgeCanvas(player: PlayerId, atk: number, def: number, flash = false): PixelCanvas {
  const R = PLAYER_RAMP[player];
  const a = String(atk);
  const d = String(def);
  const aw = a.length * 6 - 1;
  const dw = d.length * 6 - 1;
  const W = 4 + 5 + 3 + aw + 5 + 5 + 3 + dw + 4;
  const H = 15;
  const p = new PixelCanvas(W, H);
  // plate: ink rim with clipped corners, night body, lit top rim in the owner's colour
  p.rect(1, 0, W - 2, H, PAL.ink).rect(0, 1, W, H - 2, PAL.ink);
  p.rect(1, 1, W - 2, H - 2, PAL.night0);
  p.rect(2, 2, W - 4, 5, PAL.night1);
  p.hline(2, W - 3, 1, R[2]);
  p.hline(3, W - 4, 1, R[3]);
  p.hline(2, W - 3, H - 2, R[0]);
  p.set(1, 2, R[1]).set(W - 2, 2, R[1]);
  // ATK half: lit backing
  const ax1 = 4 + 5 + 3 + aw + 2;
  p.rect(2, 2, ax1 - 2, H - 4, PAL.night1).rect(2, 2, ax1 - 2, 4, PAL.night2);
  p.stamp(SWORD, { '#': flash ? PAL.white : R[3] }, 4, 5);
  drawD5(p, 4 + 5 + 3, 4, a, flash ? PAL.white : PAL.white, flash ? PAL.white : PAL.mist);
  // separator
  p.vline(ax1 + 1, 3, H - 4, PAL.night3);
  const dx = ax1 + 4;
  p.stamp(SHIELD, { '#': PAL.steel }, dx, 5);
  drawD5(p, dx + 5 + 3, 4, d, PAL.steel, PAL.night4);
  return p;
}

let badgeSeq = 0;

/** A lit ATK/DEF badge on the tile front; pops in (scale overshoot + white flash frame). Returns the image. */
export async function popBadge(c: Cine, player: PlayerId, x: number, y: number, atk: number, def: number): Promise<Phaser.GameObjects.Image> {
  const scene = c.scene;
  const key = `hd:cine:badge:${++badgeSeq}`;
  const keyF = `${key}:f`;
  scene.textures.addCanvas(key, badgeCanvas(player, atk, def).toCanvas());
  scene.textures.addCanvas(keyF, badgeCanvas(player, atk, def, true).toCanvas());
  const im = scene.add.image(Math.round(x), Math.round(y), keyF).setDepth(DEPTH.FX - 20).setScale(0.2);
  c.own(() => {
    im.destroy();
    if (scene.textures.exists(key)) scene.textures.remove(key);
    if (scene.textures.exists(keyF)) scene.textures.remove(keyF);
  });
  const glint = c.soft(x, y, 'glow', PLAYER_RAMP[player][3], 90, 26, 0, 'front');
  c.sound('cardPlace', 0.5, 1.4);
  await c.run(130, (t) => {
    im.setScale(lerp3(0.2, 1.35, E.outQ(t)));
    glint.setAlpha(0.8 * t);
  });
  im.setTexture(key);
  await c.run(190, (t) => {
    im.setScale(lerp3(1.35, 1, E.outBack(t, 2.4)));
    glint.setAlpha(0.8 * (1 - t));
  });
  im.setScale(1);
  glint.destroy();
  return im;
}

const lerp3 = (a: number, b: number, t: number) => a + (b - a) * t;

// ================================================================ letterbox + name plate

/** 2.35:1 bars that slide in over the screen edges (camera-zoom compensated). */
export class Letterbox {
  private top: Phaser.GameObjects.Rectangle;
  private bot: Phaser.GameObjects.Rectangle;
  private lineT: Phaser.GameObjects.Rectangle;
  private lineB: Phaser.GameObjects.Rectangle;
  /** Current bar height in screen px. */
  h = 0;
  readonly full = Math.round((HD_H - HD_W / 2.35) / 2);
  private stop: () => void;
  constructor(private c: Cine) {
    const s = c.scene;
    const mk = (color: number, alpha: number) => s.add.rectangle(0, 0, HD_W * 2, 10, color, alpha).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH.OVERLAY - 20);
    this.top = mk(PAL.ink, 1);
    this.bot = mk(PAL.ink, 1);
    this.lineT = mk(PAL.gold2, 0.9).setDepth(DEPTH.OVERLAY - 19);
    this.lineB = mk(PAL.gold2, 0.9).setDepth(DEPTH.OVERLAY - 19);
    this.stop = c.loop(() => {
      this.place();
      return true;
    });
    c.own(() => {
      this.stop();
      for (const r of [this.top, this.bot, this.lineT, this.lineB]) r.destroy();
    });
    this.place();
  }
  /** Screen y → the world y a scroll-factor-0 object needs under the current camera zoom. */
  private sy(y: number): number {
    const z = this.c.scene.cameras.main.zoom;
    return HD_H / 2 + (y - HD_H / 2) / z;
  }
  private place(): void {
    const z = this.c.scene.cameras.main.zoom;
    const h = Math.round(this.h);
    const vis = h > 0;
    const big = HD_H / z;
    this.top.setVisible(vis).setPosition(HD_W / 2, this.sy(h) - big).setSize(HD_W * 2, big).setDisplaySize(HD_W * 2, big);
    this.bot.setVisible(vis).setPosition(HD_W / 2, this.sy(HD_H - h)).setSize(HD_W * 2, big).setDisplaySize(HD_W * 2, big);
    const lw = 1 / z;
    this.lineT.setVisible(vis && h > 2).setPosition(HD_W / 2, this.sy(h)).setDisplaySize(HD_W * 2, lw).setAlpha(0.75 * Math.min(1, h / this.full));
    this.lineB.setVisible(vis && h > 2).setPosition(HD_W / 2, this.sy(HD_H - h - 1)).setDisplaySize(HD_W * 2, lw).setAlpha(0.75 * Math.min(1, h / this.full));
  }
  slide(to: number, ms: number): Promise<void> {
    const h0 = this.h;
    return this.c.run(ms, (t) => (this.h = h0 + (to - h0) * t), to > h0 ? E.outC : E.inOutQ);
  }
}

/** Draw a string with the sm/md pixel font into a PixelCanvas (glyph fill only). Returns the width. */
export function drawText(p: PixelCanvas, x: number, y: number, text: string, color: number, font: 'sm' | 'md' = 'sm'): number {
  const f = getFont(font);
  let cx = x;
  for (const ch of text) {
    const g = f.glyphs.get(ch.charCodeAt(0));
    if (!g) {
      cx += f.def.spaceW + 1;
      continue;
    }
    drawGlyph(p, g, f.def.cellH, cx, y, color);
    cx += g.w + 1;
  }
  return cx - x - 1;
}

export function textWidth(text: string, font: 'sm' | 'md' = 'sm'): number {
  const f = getFont(font);
  let w = 0;
  for (const ch of text) {
    const g = f.glyphs.get(ch.charCodeAt(0));
    w += (g ? g.w : f.def.spaceW) + 1;
  }
  return w - 1;
}

/**
 * The ace name plate in the lower letterbox bar: "KRİSTAL EJDER" slams in from the left with a white frame,
 * holds, then slides away. Screen-space, camera-zoom compensated.
 */
export async function namePlate(c: Cine, bar: Letterbox, name: string, sub: string, hold: number): Promise<void> {
  const s = c.scene;
  const big = pixelText(s, 0, 0, name, { size: 'xl', color: PAL.gold3, shadow: 1, originX: 0, originY: 0.5 }).setScrollFactor(0).setDepth(DEPTH.OVERLAY - 10);
  const small = pixelText(s, 0, 0, sub, { size: 'sm', color: PAL.gold4, originX: 0, originY: 0.5 }).setScrollFactor(0).setDepth(DEPTH.OVERLAY - 10);
  const streak = c.scene.add.rectangle(0, 0, 10, 2, PAL.gold4, 1).setOrigin(0, 0.5).setScrollFactor(0).setDepth(DEPTH.OVERLAY - 11);
  c.own(() => {
    big.destroy();
    small.destroy();
    streak.destroy();
  });
  const X = 40;
  const place = (dx: number, alpha: number, white: boolean) => {
    const z = s.cameras.main.zoom;
    const cy = HD_H - bar.full / 2 - 4;
    const wx = (sx: number) => HD_W / 2 + (sx - HD_W / 2) / z;
    const wy = (sy: number) => HD_H / 2 + (sy - HD_H / 2) / z;
    big.setPosition(wx(X + dx), wy(cy)).setScale(1 / z).setAlpha(alpha);
    small.setPosition(wx(X + 4 + dx * 1.4), wy(cy + 19)).setScale(1 / z).setAlpha(alpha);
    if (white) big.setTintFill(PAL.white);
    else big.setTint(PAL.gold3);
    streak.setPosition(wx(0), wy(cy + 13)).setDisplaySize(Math.max(0, X + dx + big.width - 6) / z, 1 / z).setAlpha(alpha * 0.8);
  };
  c.sound('cutIn', 0.6);
  await c.run(190, (t) => place(-260 * (1 - t), 1, t > 0.85), E.outExpo);
  await c.run(60, () => place(0, 1, true));
  await c.run(hold, (t) => place(Math.round(6 * t), 1, false));
  await c.run(220, (t) => place(6 + 40 * t, 1 - t, false), E.inQ);
  big.destroy();
  small.destroy();
  streak.destroy();
}
