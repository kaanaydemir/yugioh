// ResultPlate — the v3 result of a duel (docs/v3/A6_PLAN.md §3 F9, lane A6-B step B5; KO-1 … KO-12), and
// the game-over button row under it (Prompt.gameOver v3). Built only under V3_A6_B (the callers gate).
//
//   const plate = ResultPlate.show(scene, { winner: 0, reason: 'lp', viewerWon: null });
//   await plate.entered;                                   // opened, both lines stamped (~0.6 s at 1×)
//   const choice = await gameOverV3(scene, 0, 'lp', { menu: true });   // 'replay' | 'menu'
//
// Look (S-1 frame language, palette only, whole pixels; no alpha, ADD, scale or rotation):
//   body     220 × 40, frameRectV3 bands (night1 over night0), a 1-px ink outline with a 2-px corner cut,
//            the gold ace corners; ONE gold trim, one tone up at rest (gold3 / gold4)
//   line 1   md glyphs: "KAZANAN: OYUNCU 1" (hot-seat / demo; the winner in their own tone) or vsBot
//            "KAZANDIN!" (gold) / "KAYBETTİN" (crimson); a gold crown before a win
//   line 2   sm glyphs, mist: the reason — "Rakibin LP'si sıfırlandı" / "Rakibin destesi bitti" / "Rakip
//            teslim oldu" (vsBot, the person lost: "LP'n sıfırlandı" / "Desten bitti" / "Teslim oldun")
//   marks    the duelists' marks at the plate's ends (P1 cyan left, P2 crimson right — the "DÜELLO!"
//            plate's): the winner's lit, its centre blinking every 24 frames; the loser's dim
//   life     after the stamps: one white trim frame and a 1-px drop (the small object shakes, never the
//            screen); a white glint runs over line 1 one letter a frame; a light node runs the trim
//   fireworks (a win only) three small crisp bursts (≤ 31 px across) in the winner's half beside the plate: a 1-px shell
//            climbs 5 px a frame, then 12 rays open to r 11–15 stepping down the winner's ramp (gold for
//            the middle one), each head trailing back to the heart; the heads fall (drips), then crackle
// Placement: centred on the screen's middle column, 3 px under the phase bar — where the opening's
// "DÜELLO!" plate stood (the duel's two bookends) — above the board; the button row 5 px under it.
// Motion (frames at 60 fps, on the scene's tween clock: speed aware):
//   f0–5     opens in three steps (h 6 → 20 → 40 about its middle row, two frames each; the trim steps
//            gold1/gold2 → gold2/gold3 → rest)
//   f6…      line 1 stamps one letter a frame (a white frame 1 px high, then its tone), the crown and
//            the marks with the first letter; then line 2, two letters a frame (one white frame each)
//   +1       the thump (white trim, 1 px down for two frames); the glint; the node starts
//   leave    two palette steps out (letters one tone down, then only the dark frame), then gone
// Reduced motion (KO-9): there at once, no node, glint, thump or fireworks; it leaves in the same steps.

import type Phaser from 'phaser';
import { frameRectV3 } from '../../art/frame-v3';
import { PAL, PLAYER_RAMP, RAMPS, type Ramp } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import type { DuelViews } from '../../duel/types';
import type { PlayerId, WinReason } from '../../engine/types';
import { registerUiTarget } from '../../duel/qaInput';
import { sfx } from '../../audio/sfx';
import { Button } from '../Button';
import { DEPTH, GAME_H, GAME_W, UI, type Rect, type XY } from '../layout';
import { ICON, pushUiKeys } from '../ui-textures';
import { V3_A6_B } from '../v3flags';
import { REDUCED_MOTION } from './motion';
import { TrimGfx, canvasTexture, flatTrim, glyphTexture, iconTexture, iconTones, layoutLine, capYV3 } from './hudSkin';
import { duelMarkCanvas, plateTrim, type PlateSegment } from './TurnPlate';

const FRAME = 1000 / 60;

/** The plate's geometry and timeline (game px; frames at 60 fps). */
export const RESULT = Object.freeze({
  w: 220,
  h: 40,
  /** Outline corner cut (a 1-px ink diagonal, as the "DÜELLO!" plate). */
  cut: 2,
  /** Rows between the phase bar's bottom and the plate's top (the "DÜELLO!" plate's place). */
  gapBelowBar: 3,
  /** Caps top rows of the two lines inside the plate. */
  line1Cap: 9,
  line2Cap: 26,
  /** The crown before a win's line 1 and its gap to the text. */
  crownGap: 4,
  /** The three opening heights (about the middle row), each shown `openFrames` frames. */
  openH: Object.freeze([6, 20, 40]),
  openFrames: 2,
  /** Line 2 stamps this many letters a frame. */
  line2PerFrame: 2,
  /** The thump after the last letter: frames 1 px down (the first with a white trim). */
  thumpFrames: 2,
  /** One lap of the trim's node, then a rest. */
  nodeLapMs: 1600,
  nodeRestMs: 400,
  /** Frames per exit step (two steps). */
  exitFrames: 2,
  /** Fireworks: launch delays after the plate opens (ms) — three, in the winner's half. */
  fireworksAt: Object.freeze([60, 240, 420]),
  /** Their sizes (× the burst radius 13): the gold middle one the biggest. */
  fireworkSizes: Object.freeze([1, 1.15, 0.85]),
  /** The marks' inset from the plate's ends and the winner's blink (frames). */
  markInset: 6,
  blinkFrames: 24,
  /** The button row under the plate. */
  btnGap: 5,
  btnH: 20,
  btnW: Object.freeze([104, 88]),
  btnSpace: 8,
  depth: DEPTH.HUD + 9,
});

/** The plate's rest rect: centred on the screen's middle column, `gapBelowBar` under the phase bar. */
export function resultPlateRect(): Rect {
  return { x: Math.round(GAME_W / 2 - RESULT.w / 2), y: UI.phaseBar.y + UI.phaseBar.h + RESULT.gapBelowBar, w: RESULT.w, h: RESULT.h };
}

// ================================================================ text

/** What the plate says (F9). `viewerWon`: vsBot — did the person at the screen win; null = hot-seat / demo. */
export interface ResultSpec {
  winner: PlayerId;
  reason: WinReason | null | undefined;
  viewerWon: boolean | null;
}

/** The reasons, from the winner's side (the plan's lines) and from a person who lost to the computer. */
export const RESULT_REASON: Readonly<Record<WinReason, string>> = Object.freeze({
  lp: "Rakibin LP'si sıfırlandı",
  deckout: 'Rakibin destesi bitti',
  surrender: 'Rakip teslim oldu',
});
export const RESULT_REASON_LOST: Readonly<Record<WinReason, string>> = Object.freeze({
  lp: "LP'n sıfırlandı",
  deckout: 'Desten bitti',
  surrender: 'Teslim oldun',
});

export interface ResultText {
  line1: PlateSegment[];
  line2: string;
  /** A win (a crown before line 1, the fireworks' fanfare) — false only for a person who lost to the computer. */
  win: boolean;
}

/** The plate's two lines (pure). */
export function resultText(spec: ResultSpec): ResultText {
  const r = spec.reason ?? null;
  if (spec.viewerWon === false) return { line1: [{ text: 'KAYBETTİN', color: PAL.crim3 }], line2: r ? RESULT_REASON_LOST[r] : '', win: false };
  const line2 = r ? RESULT_REASON[r] : '';
  if (spec.viewerWon === true) return { line1: [{ text: 'KAZANDIN!', color: PAL.gold4 }], line2, win: true };
  return {
    line1: [
      { text: 'KAZANAN: ', color: PAL.gold4 },
      { text: `OYUNCU ${spec.winner + 1}`, color: PLAYER_RAMP[spec.winner][3] },
    ],
    line2,
    win: true,
  };
}

// ================================================================ painters (pure)

/** The plate body at an opening / exit step: −2 / −1 (night0 bands, the step's baked trim) or 0 (rest, no trim). */
export function resultBody(h: number, step: number): PixelCanvas {
  const s = Math.max(-2, Math.min(0, Math.round(step)));
  const p = new PixelCanvas(RESULT.w, h);
  frameRectV3(p, 0, 0, RESULT.w, h, s >= 0 ? null : plateTrim(RAMPS.gold, s), {
    cut: h >= 8 ? RESULT.cut : 1,
    bands: s >= 0 ? [PAL.night1, PAL.night0] : [PAL.night0, PAL.night0],
    ace: s >= -1 && h >= 12,
  });
  return p;
}

/** Plate height and step of the opening at frame f (three steps, then rest). */
export function resultOpening(f: number, reduced = REDUCED_MOTION): { h: number; step: number } {
  if (reduced || f >= RESULT.openH.length * RESULT.openFrames) return { h: RESULT.h, step: 0 };
  const i = Math.max(0, Math.floor(f / RESULT.openFrames));
  return { h: RESULT.openH[i], step: i === 0 ? -2 : i === 1 ? -1 : 0 };
}

/** Frames of a firework's climb, and the burst's radius per frame (whole px). */
const FW_LAUNCH = 5;
const FW_R = [2, 4, 6, 8, 10, 11, 12, 13, 13, 13, 13, 13] as const;
/** The head's tone per burst frame: −1 white, else the ramp index. */
const FW_HEAD = [-1, -1, 4, 4, 4, 3, 3, 3, 2, 2, 1, 1] as const;

/**
 * One firework at frame f (pure): pixels relative to its burst point, palette tones; null once over.
 * The shell climbs 5 px a frame from 24 px below (a white head, a 2-px tail); the burst opens 12 rays
 * to r 13 × `size` (a white plus at its heart for two frames): each ray a head with a trail back toward
 * the heart (3 px while it opens, stepping down the ramp); from frame 6 the heads fall 1 px more each
 * frame, their trails turn into drips above them, and the last four frames crackle (alternate rays on
 * alternate frames).
 */
export function fireworkPixels(f: number, ramp: Ramp, size = 1): { x: number; y: number; c: number }[] | null {
  if (f < 0) return [];
  const out: { x: number; y: number; c: number }[] = [];
  if (f < FW_LAUNCH) {
    const y = 24 - 5 * f;
    out.push({ x: 0, y, c: PAL.white }, { x: 0, y: y + 1, c: ramp[3] }, { x: 0, y: y + 2, c: ramp[2] });
    return out;
  }
  const b = f - FW_LAUNCH;
  if (b >= FW_R.length) return null;
  const r = Math.max(1, Math.round(FW_R[b] * size));
  const head = FW_HEAD[b];
  const tone = (i: number) => (i < 0 ? PAL.white : ramp[Math.max(1, Math.min(4, i))]);
  const drop = b >= 6 ? b - 5 : 0;
  const trail = b <= 3 ? 3 : b <= 6 ? 2 : 1;
  const falling = b >= 6;
  for (let k = 0; k < 12; k++) {
    if (b >= 8 && (k + b) % 2 === 1) continue; // the crackle
    const a = (k / 12) * Math.PI * 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const hx = Math.round(dx * r);
    const hy = Math.round(dy * r) + drop;
    out.push({ x: hx, y: hy, c: tone(head) });
    for (let t = 1; t <= trail; t++) {
      // the trail tone: a white head's trail starts at the ramp's top
      const c = tone(head < 0 ? 5 - t : head - t);
      if (falling) out.push({ x: hx, y: hy - t, c });
      else if (r - t > 0) out.push({ x: Math.round(dx * (r - t)), y: Math.round(dy * (r - t)), c });
    }
  }
  if (b <= 1) for (const [x, y] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) out.push({ x, y, c: PAL.white });
  return out;
}

/** Frames a firework lasts. */
export const FIREWORK_FRAMES = FW_LAUNCH + FW_R.length;

/** Burst points (screen px) of the three fireworks: beside the plate, in the winner's half. */
export function fireworkPoints(winner: PlayerId, rect: Rect = resultPlateRect()): XY[] {
  const cx = rect.x + rect.w / 2;
  // P1's are mirrored about the screen's middle column: they sit left of the plate, P2's right of it
  const right: XY[] = [
    { x: rect.x + rect.w + 26, y: rect.y + 9 },
    { x: rect.x + rect.w + 40, y: rect.y + 35 },
    { x: rect.x + rect.w + 18, y: rect.y + 63 },
  ];
  return right.map((p) => (winner === 1 ? p : { x: Math.round(2 * cx - p.x), y: p.y }));
}

// ================================================================ the plate

interface Glyph {
  img: Phaser.GameObjects.Image;
  code: number;
  color: number;
  x: number;
  y: number;
  size: 'md' | 'sm';
  /** Frame it is stamped on. */
  at: number;
  line: 1 | 2;
}

const live = new Set<ResultPlate>();

export class ResultPlate {
  /** Resolves when the plate has opened, stamped both lines and thumped. */
  readonly entered: Promise<void>;
  readonly rect: Rect;
  readonly spec: ResultSpec;
  readonly text: ResultText;
  readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Image;
  private readonly trim: TrimGfx;
  private readonly glyphs: Glyph[] = [];
  private readonly crown: { img: Phaser.GameObjects.Image; x: number; y: number } | null = null;
  /** The duelists' marks at the plate's ends (P1 left, P2 right — as on the "DÜELLO!" plate): the winner's lit. */
  private readonly marks: Phaser.GameObjects.Image[] = [];
  private blink = -1;
  private holdMs = 0;
  private readonly fx: Phaser.GameObjects.Graphics;
  private readonly attached: { destroy(): void }[] = [];
  private tween: Phaser.Tweens.Tween | null = null;
  private leaving: Promise<void> | null = null;
  private alive = true;
  private lastKey = '';
  private readonly onShutdown = () => this.destroy();
  private entered_ = false;
  private readonly onUpdate = (_t: number, dt: number) => this.tick(dt * this.scene.tweens.timeScale);

  /** Show the plate (any earlier one goes at once). */
  static show(scene: Phaser.Scene, spec: ResultSpec): ResultPlate {
    for (const p of [...live]) p.destroy();
    return new ResultPlate(scene, spec);
  }

  /** The plate on screen in `scene` (not leaving), or null. */
  static current(scene?: Phaser.Scene): ResultPlate | null {
    for (const p of live) if (p.alive && !p.leaving && (!scene || p.scene === scene)) return p;
    return null;
  }

  private constructor(scene: Phaser.Scene, spec: ResultSpec) {
    this.scene = scene;
    this.spec = spec;
    this.text = resultText(spec);
    this.rect = resultPlateRect();
    const r = this.rect;
    this.root = scene.add.container(r.x, r.y).setDepth(RESULT.depth).setScrollFactor(0);
    this.body = scene.add.image(0, 0, this.bodyKey(RESULT.openH[0], -2)).setOrigin(0, 0);
    this.root.add(this.body);
    this.trim = new TrimGfx(scene, this.root, 0, 0, r.w, r.h, RESULT.cut);
    this.trim.setVisible(false);
    // line 1 (+ the crown of a win), centred
    const l1 = this.text.line1.map((s) => s.text).join('');
    const L1 = layoutLine(l1, 'md');
    const crownKey = this.text.win ? iconTexture(scene, ICON.crown, iconTones('gold', 1)) : null;
    const crownW = crownKey ? scene.textures.getFrame(crownKey).width : 0;
    const w1 = L1.w + (crownKey ? crownW + RESULT.crownGap : 0);
    let x1 = Math.round((r.w - w1) / 2);
    const y1 = capYV3('md', RESULT.line1Cap);
    if (crownKey) {
      const ch = scene.textures.getFrame(crownKey).height;
      const cy = RESULT.line1Cap + Math.round((7 - ch) / 2);
      const img = scene.add.image(x1, cy, crownKey).setOrigin(0, 0).setVisible(false);
      this.root.add(img);
      this.crown = { img, x: x1, y: cy };
      x1 += crownW + RESULT.crownGap;
    }
    // the duelists' marks, as the opening plate's: the winner's lit (its centre blinks), the loser's dim
    ([0, 1] as PlayerId[]).forEach((pl) => {
      const img = scene.add.image(pl === 0 ? RESULT.markInset : r.w - RESULT.markInset - 9, Math.round((r.h - 9) / 2), this.markKey(pl, 'white')).setOrigin(0, 0).setVisible(false);
      this.root.add(img);
      this.marks.push(img);
    });
    const colors1: number[] = [];
    for (const seg of this.text.line1) for (const ch of seg.text) if (ch !== ' ') colors1.push(seg.color);
    L1.glyphs.forEach((g, i) => {
      const color = colors1[i] ?? PAL.white;
      const img = scene.add.image(x1 + g.x, y1, glyphTexture(scene, g.code, 'md', color)).setOrigin(0, 0).setVisible(false);
      this.root.add(img);
      this.glyphs.push({ img, code: g.code, color, x: x1 + g.x, y: y1, size: 'md', at: STAMP0 + i, line: 1 });
    });
    // line 2, centred, two letters a frame after line 1
    const L2 = layoutLine(this.text.line2, 'sm');
    const x2 = Math.round((r.w - L2.w) / 2);
    const y2 = capYV3('sm', RESULT.line2Cap);
    const from2 = STAMP0 + L1.glyphs.length;
    L2.glyphs.forEach((g, i) => {
      const img = scene.add.image(x2 + g.x, y2, glyphTexture(scene, g.code, 'sm', PAL.mist)).setOrigin(0, 0).setVisible(false);
      this.root.add(img);
      this.glyphs.push({ img, code: g.code, color: PAL.mist, x: x2 + g.x, y: y2, size: 'sm', at: from2 + Math.floor(i / RESULT.line2PerFrame), line: 2 });
    });
    this.fx = scene.add.graphics().setDepth(RESULT.depth - 1).setScrollFactor(0);
    live.add(this);
    scene.events.once('shutdown', this.onShutdown);
    scene.events.on('update', this.onUpdate);
    this.entered = this.play();
  }

  get active(): boolean {
    return this.alive;
  }

  /** The frame (from show) of the last stamped letter. */
  get lastStampFrame(): number {
    return this.glyphs.reduce((m, g) => Math.max(m, g.at), STAMP0);
  }

  /** Things that leave with the plate (a held light, …): destroyed when it leaves or is destroyed. */
  attach(d: { destroy(): void }): void {
    if (!this.alive) d.destroy();
    else this.attached.push(d);
  }

  /** Two palette steps out (letters one tone down, then only the dark frame), then gone. */
  leave(): Promise<void> {
    if (this.leaving) return this.leaving;
    if (!this.alive) return Promise.resolve();
    this.tween?.stop();
    this.tween = null;
    this.leaving = this.runLeave();
    return this.leaving;
  }

  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    live.delete(this);
    this.tween?.stop();
    this.tween = null;
    this.scene.events.off('shutdown', this.onShutdown);
    this.scene.events.off('update', this.onUpdate);
    for (const d of this.attached.splice(0)) d.destroy();
    this.trim.destroy();
    if (this.fx.active) this.fx.destroy();
    if (this.root.active) this.root.destroy();
  }

  // ---------------------------------------------------------------- internals

  private markKey(player: PlayerId, state: 'white' | 'rest' | 'blink' | 'dim'): string {
    return canvasTexture(this.scene, `ui3:duel:m:${player}:${state}`, () => duelMarkCanvas(player, state));
  }

  /** The node runs; once entered, the winner's mark blinks its centre every RESULT.blinkFrames. */
  private tick(dt: number): void {
    if (!this.alive) return;
    this.trim.tick(dt);
    if (!this.entered_ || this.leaving || REDUCED_MOTION) return;
    this.holdMs += dt;
    const b = Math.floor(this.holdMs / (RESULT.blinkFrames * FRAME)) % 2;
    if (b === this.blink) return;
    this.blink = b;
    const m = this.marks[this.spec.winner];
    m?.setTexture(this.markKey(this.spec.winner, b === 1 ? 'blink' : 'rest'));
  }

  private bodyKey(h: number, step: number): string {
    const s = Math.max(-2, Math.min(0, step));
    return canvasTexture(this.scene, `ui3:result:body:${h}:${s}`, () => resultBody(h, s));
  }

  /** The body at height h (about the middle row) and step. */
  private setBody(h: number, step: number): void {
    const key = `${h}:${step}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.body.setTexture(this.bodyKey(h, step));
    this.body.y = Math.round((RESULT.h - h) / 2);
    this.trim.setVisible(step >= 0 && h === RESULT.h);
  }

  /** The opening → stamps → thump → glint timeline (scene tween clock); fireworks start with the stamps. */
  private play(): Promise<void> {
    const r = this.rect;
    const last = this.lastStampFrame;
    const thumpAt = last + 1;
    const glintFrom = thumpAt + RESULT.thumpFrames;
    const n1 = this.glyphs.filter((g) => g.line === 1).length;
    const endFrame = glintFrom + n1 + 1;
    if (REDUCED_MOTION) {
      this.setBody(RESULT.h, 0);
      this.trim.set(plateTrim(RAMPS.gold, 0));
      for (const g of this.glyphs) g.img.setVisible(true);
      this.crown?.img.setVisible(true);
      this.marks.forEach((m, pl) => m.setVisible(true).setTexture(this.markKey(pl as PlayerId, pl === this.spec.winner ? 'rest' : 'dim')));
      return Promise.resolve();
    }
    // a person beaten by the computer gets no fireworks (no crown either): the plate stays sober
    if (this.text.win) this.fireworks();
    let nodeOn = false;
    const frame = (ms: number) => {
      if (!this.alive || this.leaving) return;
      const f = Math.floor((ms + 0.5) / FRAME);
      const o = resultOpening(f);
      this.setBody(o.h, o.step);
      // the thump: the plate 1 px down for two frames, its first frame a white trim
      const thump = f >= thumpAt && f < thumpAt + RESULT.thumpFrames;
      this.root.y = r.y + (thump ? 1 : 0);
      this.trim.set(f === thumpAt ? flatTrim(PAL.white) : plateTrim(RAMPS.gold, 0));
      if (!nodeOn && f >= thumpAt + RESULT.thumpFrames) {
        nodeOn = true;
        this.trim.setNode({ head: PAL.white, tail: [PAL.gold4, PAL.gold4, PAL.gold3], lapMs: RESULT.nodeLapMs, restMs: RESULT.nodeRestMs });
      }
      // the marks with the first letter (one white frame), then the winner's lit, the loser's dim
      this.marks.forEach((m, pl) => {
        const on = f >= STAMP0;
        m.setVisible(on);
        if (on) m.setTexture(this.markKey(pl as PlayerId, f === STAMP0 ? 'white' : pl === this.spec.winner ? 'rest' : 'dim'));
      });
      // the crown with the first letter (one white frame)
      if (this.crown) {
        const on = f >= STAMP0;
        this.crown.img.setVisible(on);
        if (on) this.crown.img.setTexture(iconTexture(this.scene, ICON.crown, f === STAMP0 ? iconTones('neutral', 3) : iconTones('gold', 1)) ?? this.crown.img.texture.key);
      }
      // letters: white and 1 px high on their stamp frame, then their tone; the glint passes over line 1
      let i1 = 0;
      for (const g of this.glyphs) {
        const shown = f >= g.at;
        g.img.setVisible(shown);
        if (!shown) continue;
        const fresh = f === g.at;
        const glint = g.line === 1 && f === glintFrom + i1;
        if (g.line === 1) i1++;
        g.img.setTexture(glyphTexture(this.scene, g.code, g.size, fresh || glint ? PAL.white : g.color));
        g.img.y = fresh ? g.y - 1 : g.y;
      }
    };
    return this.timeline(endFrame * FRAME, frame).then(() => {
      if (!this.alive || this.leaving) return;
      this.setBody(RESULT.h, 0);
      this.root.y = r.y;
      this.trim.set(plateTrim(RAMPS.gold, 0));
      for (const g of this.glyphs) {
        g.img.setVisible(true).setTexture(glyphTexture(this.scene, g.code, g.size, g.color));
        g.img.y = g.y;
      }
      if (this.crown) this.crown.img.setVisible(true).setTexture(iconTexture(this.scene, ICON.crown, iconTones('gold', 1)) ?? this.crown.img.texture.key);
      this.marks.forEach((m, pl) => m.setVisible(true).setTexture(this.markKey(pl as PlayerId, pl === this.spec.winner ? 'rest' : 'dim')));
      this.entered_ = true;
    });
  }

  /** Three small crisp fireworks in the winner's half (screen space, under the plate's depth). */
  private fireworks(): void {
    const sc = this.scene;
    const pts = fireworkPoints(this.spec.winner, this.rect);
    const ramps: Ramp[] = [PLAYER_RAMP[this.spec.winner], RAMPS.gold, PLAYER_RAMP[this.spec.winner]];
    const sizes = RESULT.fireworkSizes;
    const total = RESULT.fireworksAt[RESULT.fireworksAt.length - 1] + FIREWORK_FRAMES * FRAME + FRAME;
    const popped = new Set<number>();
    const g = this.fx;
    const tw = sc.tweens.addCounter({
      from: 0,
      to: total,
      duration: total,
      onUpdate: (t) => {
        if (!this.alive || !g.active) return;
        const ms = t.getValue() ?? 0;
        g.clear();
        pts.forEach((p, i) => {
          const f = Math.floor((ms - RESULT.fireworksAt[i] + 0.5) / FRAME);
          if (f === 5 && !popped.has(i)) {
            popped.add(i);
            sfx.play('fireBurst', { volume: 0.18, pitch: 1.7 + 0.15 * i });
          }
          const px = fireworkPixels(f, ramps[i], sizes[i]);
          if (!px) return;
          for (const q of px) {
            g.fillStyle(q.c, 1);
            g.fillRect(p.x + q.x, p.y + q.y, 1, 1);
          }
        });
      },
      onComplete: () => g.active && g.clear(),
    });
    this.attach({ destroy: () => tw.stop() });
  }

  private async runLeave(): Promise<void> {
    this.trim.setNode(null);
    this.fx.clear();
    this.root.y = this.rect.y;
    const steps = (ms: number) => {
      if (!this.alive) return;
      const s = ms < RESULT.exitFrames * FRAME - 0.5 ? -1 : -2;
      this.setBody(RESULT.h, 0);
      this.trim.set(plateTrim(RAMPS.gold, s));
      for (const g of this.glyphs) {
        g.img.y = g.y;
        g.img.setVisible(s === -1 && g.img.visible).setTexture(glyphTexture(this.scene, g.code, g.size, dimTone(g.color)));
      }
      this.crown?.img.setVisible(false);
      for (const m of this.marks) m.setVisible(s === -1 && m.visible).setTexture(this.markKey(this.marks.indexOf(m) as PlayerId, 'dim'));
    };
    await this.timeline(2 * RESULT.exitFrames * FRAME, steps);
    this.destroy();
  }

  /** fn(ms) on the scene's tween clock from 0 to `ms` (speed aware); resolves at the end. */
  private timeline(ms: number, fn: (ms: number) => void): Promise<void> {
    return new Promise((resolve) => {
      fn(0);
      const t = this.scene.tweens.addCounter({
        from: 0,
        to: ms,
        duration: ms,
        onUpdate: (tw) => fn(tw.getValue() ?? 0),
        onComplete: () => {
          fn(ms);
          if (this.tween === t) this.tween = null;
          resolve();
        },
        onStop: () => resolve(),
      });
      this.tween = t;
    });
  }
}

/** The frame line 1's first letter is stamped on (after the three opening steps). */
const STAMP0 = RESULT.openH.length * RESULT.openFrames;

/** One palette step down (a leaving letter). */
function dimTone(c: number): number {
  for (const ramp of [RAMPS.gold, RAMPS.crim, RAMPS.cyan, [PAL.night2, PAL.night3, PAL.night4, PAL.steel, PAL.mist, PAL.white] as const]) {
    const i = (ramp as readonly number[]).indexOf(c);
    if (i > 0) return ramp[i - 1];
  }
  return c;
}

// ================================================================ the game-over buttons (Prompt.gameOver v3)

export type GameOverChoiceV3 = 'replay' | 'menu';

/** Button i's rect under a plate (whole pixels; the row centred under it). */
export function resultButtonRects(plate: Rect, menu: boolean): Rect[] {
  const ws = menu ? [...RESULT.btnW] : [RESULT.btnW[0]];
  const total = ws.reduce((a, b) => a + b, 0) + (ws.length - 1) * RESULT.btnSpace;
  let x = Math.round(plate.x + plate.w / 2 - total / 2);
  const y = plate.y + plate.h + RESULT.btnGap;
  return ws.map((w) => {
    const r = { x, y, w, h: RESULT.btnH };
    x += w + RESULT.btnSpace;
    return r;
  });
}

/** The open row (QA: the scenarios' `{ result: 'replay' | 'menu' }` UI target). */
let openRow: { scene: Phaser.Scene; rects: Rect[] } | null = null;

if (V3_A6_B)
  registerUiTarget('result', (scene, _views: DuelViews, arg) => {
    const q = openRow;
    if (!q || q.scene !== scene) return null;
    const r = arg === 'menu' ? q.rects[1] : q.rects[0];
    return r ? { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) } : null;
  });

/**
 * The game over in v3 (Prompt.gameOver): the result plate the cinematic opened (or a new one, at once)
 * and a thin row under it — "TEKRAR OYNA" (Enter) and, with `menu`, "ANA MENÜ" (Esc) — in the F10
 * button skin. No dim, no second title: an invisible blocker keeps clicks off the board. On a choice
 * the row and the plate leave in two palette steps, then it resolves.
 */
export async function gameOverV3(scene: Phaser.Scene, winner: PlayerId, reason: WinReason | undefined, opts: { menu: boolean; viewerWon?: boolean | null }): Promise<GameOverChoiceV3> {
  const plate = ResultPlate.current(scene) ?? ResultPlate.show(scene, { winner, reason: reason ?? null, viewerWon: opts.viewerWon ?? null });
  const rects = resultButtonRects(plate.rect, opts.menu);
  const root = scene.add.container(0, 0).setDepth(DEPTH.OVERLAY).setScrollFactor(0);
  // eats clicks on the board and the HUD under it; draws nothing
  const blocker = scene.add.zone(0, 0, GAME_W, GAME_H).setOrigin(0).setInteractive();
  root.add(blocker);
  const again = new Button(scene, rects[0].x, rects[0].y, { w: rects[0].w, h: rects[0].h, label: 'TEKRAR OYNA', icon: ICON.replay, style: 'gold' });
  const back = opts.menu ? new Button(scene, rects[1].x, rects[1].y, { w: rects[1].w, h: rects[1].h, label: 'ANA MENÜ', icon: ICON.close, style: 'neutral' }) : null;
  const buttons = back ? [again, back] : [again];
  root.add(buttons);
  openRow = { scene, rects };
  // appear: two palette steps, rising 2 px onto the row (whole pixels), the first frame drawn now
  const rise = REDUCED_MOTION ? [0] : [2, 1, 0];
  const show = (k: number) => {
    const step = (REDUCED_MOTION ? 2 : Math.min(2, k)) as 0 | 1 | 2;
    for (const b of buttons) b.appearStep(step);
    root.y = rise[Math.min(rise.length - 1, k)];
  };
  show(0);
  await new Promise<void>((resolve) => {
    if (REDUCED_MOTION) return resolve();
    let k = 0;
    const ev = scene.time.addEvent({
      delay: 2 * FRAME,
      repeat: 1,
      callback: () => {
        k++;
        if (!root.active) return resolve();
        show(k);
        if (k >= 2) resolve();
      },
    });
    scene.events.once('shutdown', () => {
      ev.remove();
      resolve();
    });
  });
  if (root.active) {
    show(2);
    again.setAttention(true);
  }
  const choice = await new Promise<GameOverChoiceV3>((resolve) => {
    let done = false;
    const finish = (c: GameOverChoiceV3) => {
      if (done) return;
      done = true;
      release();
      resolve(c);
    };
    again.onClick = () => finish('replay');
    if (back) back.onClick = () => finish('menu');
    const release = pushUiKeys((e) => {
      if (done) return false;
      if (e.key === 'Enter') {
        again.click();
        return true;
      }
      if (e.key === 'Escape' && back) {
        back.click();
        return true;
      }
      return false;
    });
    scene.events.once('shutdown', () => finish('menu'));
  });
  openRow = null;
  // the row and the plate leave together (two palette steps)
  if (root.active) {
    for (const b of buttons) b.setAttention(false).appearStep(1);
    await Promise.all([plate.leave(), new Promise<void>((r) => scene.time.delayedCall(2 * FRAME, r))]);
    for (const b of buttons) b.appearStep(0);
    await new Promise<void>((r) => scene.time.delayedCall(2 * FRAME, r));
  } else plate.destroy();
  if (root.active) root.destroy();
  return choice;
}
