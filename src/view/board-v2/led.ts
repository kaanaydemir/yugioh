// Arena v2 LED boards (the ribbons along the stand walls) and the hanging scoreboard.
//
// Nothing here repaints a canvas at runtime: the unlit LED matrix of each board is a static
// texture, the chase / waving-flag boards play pre-drawn frame sheets, and every lit letter is a
// small glyph image (LED font sheets per colour scheme) moved along the sheared wall. Letters
// stay upright, step whole along the slope, sit inside the band with a 1-px margin, and a
// letter that would be cut by a board end or covered by a tower mast is simply not shown.
// The scoreboard shows live content — both players' LP, the turn, an active-player light — and
// uses its ticker line only for short event flashes ('TUZAK!').

import Phaser from 'phaser';
import { AK2, LED_FX_FRAMES, type LedScheme, arenaV2Layout } from '../../art/arena-v2';
import { LED_GH, SCORE_CABLE, SCORE_H, SCORE_SCREEN, SCORE_W, ledAdvance } from '../../art/arena-v2/props';
import type { LedBoard } from '../../art/arena-v2/stands';
import { PAL, PLAYER_COLOR } from '../../art/palette';
import type { PlayerId } from '../../engine/types';
import { type BoardCtx, D2 } from './types';

type Img = Phaser.GameObjects.Image;

interface Glyph {
  ch: string;
  code: number;
  s: number;
  w: number;
}

function layoutText(text: string): { glyphs: Glyph[]; w: number } {
  const glyphs: Glyph[] = [];
  let s = 0;
  for (const ch of text) {
    const adv = ledAdvance(ch);
    if (ch !== ' ') glyphs.push({ ch, code: ch.charCodeAt(0), s, w: adv - 1 });
    s += adv;
  }
  return { glyphs, w: Math.max(1, s) };
}

interface Board {
  b: LedBoard;
  mode: 'text' | 'chase' | 'flag';
  bg: Img;
  fx: Img | null;
  fxHot: Img | null;
  covered: Uint8Array;
  scheme: LedScheme;
  letters: Img[];
  glyphs: Glyph[];
  tw: number;
  offset: number;
  frame: number;
}

/** The LED ribbons along the stand walls. */
export class LedBoards {
  private boards: Board[] = [];
  private clock = 0;
  private hot = false;

  constructor(private readonly ctx: BoardCtx) {
    const sc = ctx.scene;
    const L = arenaV2Layout();
    L.stands.boards.forEach((b, i) => {
      const mode = b.mode;
      const bg = ctx.add(sc.add.image(b.x, b.y, AK2.ledBg(i)).setOrigin(0).setDepth(D2.led));
      const fx = mode === 'text' ? null : ctx.add(sc.add.image(b.x, b.y, AK2.ledFx(i, false), '0').setOrigin(0).setDepth(D2.led + 0.01));
      const fxHot = mode === 'text' ? null : ctx.add(sc.add.image(b.x, b.y, AK2.ledFx(i, true), '0').setOrigin(0).setDepth(D2.led + 0.01).setVisible(false));
      this.boards.push({ b, mode, bg, fx, fxHot, covered: L.boardCovered[i], scheme: b.stand === 0 ? 'c' : 'r', letters: [], glyphs: [], tw: 1, offset: i * 37, frame: i * 3 });
    });
  }

  /** Text for every text board: the first one shows `near`, the others `other(stand)`. */
  setTexts(near: string, other: (stand: 0 | 1) => string): void {
    let first = true;
    this.boards.forEach((B) => {
      if (B.mode !== 'text') return;
      const txt = first ? near : other(B.b.stand);
      first = false;
      const lay = layoutText(txt);
      B.glyphs = lay.glyphs;
      B.tw = lay.w;
      this.place(B);
    });
  }

  tick(dt: number, heat: number): void {
    const hot = heat > 0.5;
    if (hot !== this.hot) {
      this.hot = hot;
      for (const B of this.boards) {
        B.fx?.setVisible(!hot);
        B.fxHot?.setVisible(hot);
        for (const l of B.letters) l.setTexture(AK2.ledFont(hot ? 'h' : B.scheme), l.frame.name);
      }
    }
    // scroll 2 px along the wall every 90 ms (letters move; nothing is repainted)
    this.clock += dt;
    if (this.clock < 90) return;
    this.clock %= 90;
    for (const B of this.boards) {
      if (B.mode === 'text') {
        B.offset += 2;
        this.place(B);
      } else {
        B.frame++;
        const n = LED_FX_FRAMES[B.mode];
        const f = String(B.frame % n);
        B.fx?.setFrame(f);
        B.fxHot?.setFrame(f);
      }
    }
  }

  private place(B: Board): void {
    const cols = B.b.cols;
    const len = cols.length;
    const tw = B.tw;
    let used = 0;
    if (B.glyphs.length) {
      const off = ((B.offset % tw) + tw) % tw;
      for (let rep = -1; rep * tw - off < len; rep++) {
        for (const g of B.glyphs) {
          const i = g.s + rep * tw - off;
          if (i < 0 || i + g.w - 1 >= len) continue; // never a cut letter at a board end
          let hidden = false;
          for (let k = i; k < i + g.w; k++) if (B.covered[k]) hidden = true;
          if (hidden) continue;
          // the whole letter sits at its center column's band (+1 px margin): it stays in the band
          const ic = i + (g.w >> 1);
          const x = cols[i].x;
          const y = cols[ic].y + 1;
          let img = B.letters[used];
          if (!img) {
            img = this.ctx.add(this.ctx.scene.add.image(0, 0, AK2.ledFont(this.hot ? 'h' : B.scheme), String(g.code)).setOrigin(0).setDepth(D2.led + 0.02));
            B.letters.push(img);
          }
          img.setFrame(String(g.code)).setPosition(x, y).setVisible(true);
          used++;
        }
      }
    }
    for (let k = used; k < B.letters.length; k++) B.letters[k].setVisible(false);
  }
}

// ---------------------------------------------------------------- scoreboard

/** Where the scoreboard hangs (screen px of its housing's top-left): clear of the inspect panel. */
export const SCOREBOARD_XY = { x: 150, y: 22 } as const;

interface TextLine {
  imgs: Img[];
  scheme: LedScheme;
}

/** The hanging scoreboard: P1 LP | VS | P2 LP, LP bars, the turn line and event flashes. */
export class Scoreboard {
  private readonly sx: number;
  private readonly sy: number;
  private lines: Record<'lp0' | 'lp1' | 'vs' | 'turn', TextLine>;
  private lamps: Phaser.GameObjects.Rectangle[] = [];
  private bars: Phaser.GameObjects.Rectangle[] = [];
  private status: Phaser.GameObjects.Rectangle[] = [];
  private lp: [number, number] = [-1, -1];
  private lpMax = 4000;
  private turn: number | null = null;
  private active: PlayerId | null = null;
  private flashText: string | null = null;
  private flashScheme: LedScheme = 'g';
  private flashLeft = 0;
  private flashMs = 1;

  constructor(private readonly ctx: BoardCtx) {
    const sc = ctx.scene;
    const { x, y } = SCOREBOARD_XY;
    ctx.add(sc.add.image(x, y - SCORE_CABLE, AK2.scoreboard).setOrigin(0).setDepth(D2.led));
    this.sx = x + SCORE_SCREEN.x;
    this.sy = y + SCORE_SCREEN.y;
    const mk = (scheme: LedScheme): TextLine => ({ imgs: [], scheme });
    this.lines = { lp0: mk('c'), lp1: mk('r'), vs: mk('g'), turn: mk('w') };
    const rect = (rx: number, ry: number, w: number, h: number, c: number) => ctx.add(sc.add.rectangle(rx, ry, w, h, c).setOrigin(0).setDepth(D2.led + 0.02));
    // active-player lamps beside each LP
    this.lamps = [rect(this.sx + 2, this.sy + 3, 3, LED_GH, PAL.cyan0), rect(this.sx + SCORE_SCREEN.w - 5, this.sy + 3, 3, LED_GH, PAL.crim0)];
    // LP bars (1 px), P1 from the left, P2 from the right
    this.bars = [rect(this.sx + 2, this.sy + 11, 38, 1, PAL.cyan2), rect(this.sx + SCORE_SCREEN.w - 40, this.sy + 11, 38, 1, PAL.crim2)];
    for (let i = 0; i < 9; i++) this.status.push(rect(x + 28 + i * 4, y + SCORE_H - 3, 1, 1, PAL.night2));
    this.setText('vs', 'VS', this.sx + SCORE_SCREEN.w / 2, 'center');
    this.setScore(4000, 4000);
    this.setTurn(null, null);
  }

  setScore(a: number, b: number): void {
    a = Math.max(0, Math.round(a));
    b = Math.max(0, Math.round(b));
    if (a === this.lp[0] && b === this.lp[1]) return;
    this.lpMax = Math.max(this.lpMax, a, b);
    this.lp = [a, b];
    this.setText('lp0', String(a), this.sx + 7, 'left');
    this.setText('lp1', String(b), this.sx + SCORE_SCREEN.w - 7, 'right');
    const w0 = Math.max(0, Math.round((38 * a) / this.lpMax));
    const w1 = Math.max(0, Math.round((38 * b) / this.lpMax));
    this.bars[0].setSize(w0, 1).setVisible(w0 > 0);
    this.bars[1].setPosition(this.sx + SCORE_SCREEN.w - 2 - w1, this.sy + 11).setSize(w1, 1).setVisible(w1 > 0);
  }

  setTurn(turn: number | null, active: PlayerId | null): void {
    this.turn = turn;
    this.active = active;
    if (this.flashLeft <= 0) this.showTurn();
  }

  flash(text: string, color: number | null, ms: number): void {
    this.flashText = text.toLocaleUpperCase('tr-TR');
    this.flashScheme = color === PAL.cyan3 || color === PLAYER_COLOR[0] ? 'c' : color === PAL.crim3 || color === PLAYER_COLOR[1] ? 'r' : 'g';
    this.flashLeft = ms;
    this.flashMs = ms;
    this.lines.turn.scheme = this.flashScheme;
    this.setText('turn', this.flashText, this.sx + SCORE_SCREEN.w / 2, 'center');
  }

  tick(dt: number, t: number, heat: number): void {
    const blink = Math.floor(t / 420) % 2 === 0;
    this.lamps[0].setFillStyle(this.active === 0 ? (blink ? PAL.cyan3 : PAL.cyan2) : PAL.cyan0);
    this.lamps[1].setFillStyle(this.active === 1 ? (blink ? PAL.crim3 : PAL.crim2) : PAL.crim0);
    const step = Math.floor(t / 110);
    this.status.forEach((r, i) => r.setFillStyle((step + i) % 9 === 0 ? (heat > 0.5 ? PAL.fire3 : PAL.gold3) : (step + i) % 9 === 1 ? PAL.gold1 : PAL.night2));
    if (this.flashLeft > 0) {
      this.flashLeft -= dt;
      // the flash blinks for its first half, then holds
      const k = 1 - this.flashLeft / this.flashMs;
      const on = k > 0.5 || Math.floor(t / 120) % 2 === 0;
      for (const im of this.lines.turn.imgs) if (im.active) im.setAlpha(on ? 1 : 0.25);
      if (this.flashLeft <= 0) {
        this.flashText = null;
        this.showTurn();
      }
    }
  }

  private showTurn(): void {
    this.lines.turn.scheme = 'w';
    const txt = this.turn === null ? 'NEON DÜELLO' : `TUR ${this.turn}`;
    this.setText('turn', txt, this.sx + SCORE_SCREEN.w / 2, 'center');
    for (const im of this.lines.turn.imgs) im.setAlpha(1);
  }

  private setText(which: keyof Scoreboard['lines'], text: string, x: number, align: 'left' | 'center' | 'right'): void {
    const line = this.lines[which];
    const lay = layoutText(text);
    const w = lay.w - 1;
    const x0 = Math.round(align === 'left' ? x : align === 'right' ? x - w : x - w / 2);
    const y = which === 'turn' ? this.sy + 16 : this.sy + 3;
    lay.glyphs.forEach((g, i) => {
      let img = line.imgs[i];
      if (!img) {
        img = this.ctx.add(this.ctx.scene.add.image(0, 0, AK2.ledFont(line.scheme), String(g.code)).setOrigin(0).setDepth(D2.led + 0.02));
        line.imgs.push(img);
      }
      img.setTexture(AK2.ledFont(line.scheme), String(g.code)).setPosition(x0 + g.s, y).setVisible(true).setAlpha(1);
    });
    for (let k = lay.glyphs.length; k < line.imgs.length; k++) line.imgs[k].setVisible(false);
  }
}

export { SCORE_W };
