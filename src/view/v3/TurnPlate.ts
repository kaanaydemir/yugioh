// TurnPlate — the small v3 plate that announces a flow moment on its owner's side (docs/v3/A6_PLAN.md
// F1 / F2, lane A6-B step B1; KO-4: never a full-width band). One component for every plate of the
// lane: the turn plate ("OYUNCU 2 · TUR 4"), the battle plate ("SAVAŞ AŞAMASI"); later the
// "DÜELLO!" plate (large), the deck-out, curtain and result plates. V3_A6_B only (the callers gate).
//
//   const plate = TurnPlate.show(scene, { player: 1, kind: 'turn', segments: turnPlateText(…) });
//   await plate.settled;                         // 450 ms: slid in, stamped, settled back 1 px
//   await plate.shrinkTo(hud.turnBadgeRect());   // the tail: three hops into the turn badge (120 ms)
//
// Look (S-1 frame language, palette only, whole pixels, no alpha / ADD / scale / rotation — KO-1/2/3):
//   body     frameRectV3 bands (night1 over night0), 1-px ink outline, corners cut
//   trim     the owner's tone (P1 cyan, P2 crimson; the battle plate crimson), one tone up at rest;
//            it appears in two palette steps (trim two tones down + night0 body → one down → rest)
//   text     md glyphs with an ink outline, stamped one letter per frame: a letter's first frame is
//            white and 1 px high, then it drops into place in its own tone (the "damga")
//   node     after the slide one light node runs the trim once (the plate is never quite still)
// Motion (scene clock: speed / hit-stop aware):
//   0–120    slides 12 px in from the screen edge on its side, 1 px past its rest (ease-out)
//   67…      letters stamp (one per frame; `lettersPerFrame` 2 for the short battle beat)
//   360–450  settles the 1 px back; `settled` resolves at 450 (the battle plate: 240–300)
//   shrink   three hops (40 ms each) toward a target rect, each a smaller plate on a straight
//            whole-pixel line, the last one exactly the target's frame in white; then it is gone
// Placement: P1 bottom-left, left-aligned with its LP panel, just above the mini-hand row (so the
// face-down mini cards never sit on it); P2 top-right, right-aligned with its panel, below its
// mini-hand row. REDUCED_MOTION (KO-9): no slide, no node, letters at once, the shrink is a
// two-step fade in place.

import type Phaser from 'phaser';
import { PAL, RAMPS, type Ramp } from '../../art/palette';
import type { Trim } from '../../art/frame-v3';
import { PixelCanvas } from '../../art/pixel';
import type { PlayerId } from '../../engine/types';
import { DEPTH, panelRect, type Rect } from '../layout';
import { ICON } from '../ui-textures';
import { REDUCED_MOTION, settle } from './motion';
import { bodyV3, canvasTexture, capYV3, flatTrim, glyphTexture, iconTexture, iconTones, layoutLine, trimPixels, TrimGfx, type TrimNode } from './hudSkin';

/** What the plate says: coloured runs of text (laid out as one line). */
export interface PlateSegment {
  text: string;
  color: number;
}

export type PlateKind = 'turn' | 'battle';

export interface PlateSpec {
  /** Whose side the plate sits on (its trim tone for 'turn'). */
  player: PlayerId;
  kind: PlateKind;
  segments: readonly PlateSegment[];
  /** Letters stamped per frame (default 1; the battle beat uses 2 to be read inside 300 ms). */
  lettersPerFrame?: number;
}

/** When the plate settles its 1 px back and when it is settled (ms): the turn beat 360–450, battle 240–300. */
export function plateTiming(kind: PlateKind): { settleAt: number; settledMs: number } {
  return kind === 'battle' ? { settleAt: 240, settledMs: 300 } : { settleAt: PLATE.settleAt, settledMs: PLATE.settledMs };
}

/** Plate geometry (game px). */
export const PLATE = Object.freeze({
  h: 20,
  /** Minimum width (the plan's ≈ 112: "OYUNCU 1 · TUR 4" + padding). */
  minW: 112,
  padX: 7,
  /** Caps top row inside the plate (accents above, cedillas below stay inside the trim). */
  capTop: 6,
  /** The slide-in distance from the screen edge (F1: 12 px) and the overshoot past rest (1 px). */
  slide: 12,
  over: 1,
  /** Gap kept clear for the mini-hand row between the panel and the plate. */
  miniRow: 14,
  /** Battle plate icon (swords) and its gap to the text. */
  iconGap: 3,
  /** Timeline (ms, 1×). */
  slideMs: 120,
  stampFrom: 67,
  settleAt: 360,
  settledMs: 450,
  hopMs: 40,
  nodeLapMs: 900,
});

const FRAME = 1000 / 60;

/** The plate's rest rect for `player` and width `w` (P1 above its panel's mini row, P2 below). */
export function plateRect(player: PlayerId, w: number): Rect {
  const r = panelRect(player);
  if (player === 0) return { x: r.x, y: r.y - PLATE.miniRow - PLATE.h, w, h: PLATE.h };
  return { x: r.x + r.w - w, y: r.y + r.h + PLATE.miniRow, w, h: PLATE.h };
}

/** The plate's width for its text (and the battle plate's icon, `iconW` px wide). */
export function plateWidth(segments: readonly PlateSegment[], kind: PlateKind, iconW = ICON_W): number {
  const textW = layoutLine(segments.map((s) => s.text).join(''), 'md').w;
  const icon = kind === 'battle' ? iconW + PLATE.iconGap : 0;
  return Math.max(PLATE.minW, textW + icon + 2 * PLATE.padX);
}

/** The ramp a plate's trim steps on. */
export function plateRamp(spec: Pick<PlateSpec, 'player' | 'kind'>): Ramp {
  if (spec.kind === 'battle') return RAMPS.crim;
  return spec.player === 0 ? RAMPS.cyan : RAMPS.crim;
}

/** The trim at an appear step: 0 = rest (one tone up from the frame's base), −1 / −2 the steps in. */
export function plateTrim(ramp: Ramp, step: number): Trim {
  const s = Math.max(-2, Math.min(0, Math.round(step)));
  const d = 3 + s; // rest: dark ramp[3], light ramp[4]; −1: 2 / 3; −2: 1 / 2
  return Object.freeze({ dark: ramp[d], light: ramp[d + 1] });
}

/** The plate body at an appear step (two flat bands at rest; night0 only while appearing). */
export function plateBody(w: number, h: number, step: number): PixelCanvas {
  return bodyV3(w, h, { bands: step >= 0 ? [PAL.night1, PAL.night0] : [PAL.night0, PAL.night0] });
}

/**
 * The texts of the turn plate (F1): hot-seat "OYUNCU 2 · TUR 4"; vsBot "SIRA SENDE · TUR 4" (the human)
 * or "BİLGİSAYAR · TUR 4" (the CPU); demo (CPU vs CPU) as hot-seat. The name in the owner's light tone,
 * the dot steel, "TUR n" white.
 */
export function turnPlateText(o: { mode: 'hotseat' | 'vsBot' | 'demo'; human: boolean; player: PlayerId; turn: number }): PlateSegment[] {
  const tone = (o.player === 0 ? RAMPS.cyan : RAMPS.crim)[3];
  const name = o.mode === 'vsBot' ? (o.human ? 'SIRA SENDE' : 'BİLGİSAYAR') : `OYUNCU ${o.player + 1}`;
  return [
    { text: name, color: tone },
    { text: ' · ', color: PAL.steel },
    { text: `TUR ${o.turn}`, color: PAL.white },
  ];
}

/** The battle plate's text (F2). */
export function battlePlateText(): PlateSegment[] {
  return [{ text: 'SAVAŞ AŞAMASI', color: PAL.white }];
}

// ================================================================ the component

interface Glyph {
  img: Phaser.GameObjects.Image;
  code: number;
  color: number;
  x: number;
  y: number;
  /** ms (from show) when it is stamped. */
  at: number;
}

/** The swords icon's drawn width (ICON.swords: 11 px + its 1-px ink outline each side). */
const ICON_W = 13;
const live = new Set<TurnPlate>();

export class TurnPlate {
  /** Resolves when the plate has slid in, stamped its text and settled (450 ms at 1×). */
  readonly settled: Promise<void>;
  readonly spec: PlateSpec;
  readonly w: number;
  readonly h = PLATE.h;
  /** The rest rect (screen px). */
  readonly rect: Rect;
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Image;
  private readonly trim: TrimGfx;
  private readonly glyphs: Glyph[] = [];
  private readonly icon: Phaser.GameObjects.Image | null = null;
  private readonly ramp: Ramp;
  private readonly side: -1 | 1;
  private tween: Phaser.Tweens.Tween | null = null;
  private step = -3;
  private shrinking: Promise<void> | null = null;
  /** The plate is leaving (shrinkTo called): the appear timeline must not touch its pieces any more. */
  private leaving = false;
  private alive = true;
  private readonly onShutdown = () => this.destroy();
  private readonly onUpdate = (_t: number, dt: number) => this.trim.tick(dt * this.scene.tweens.timeScale);

  /** Show a plate (replacing any plate still on screen: one plate at a time). */
  static show(scene: Phaser.Scene, spec: PlateSpec): TurnPlate {
    for (const p of [...live]) p.destroy();
    return new TurnPlate(scene, spec);
  }

  /** The plate currently on screen (or null). */
  static current(): TurnPlate | null {
    for (const p of live) if (p.alive && !p.shrinking) return p;
    return null;
  }

  /** Remove every plate at once (a new turn, a restart, the end of the game). */
  static dismissAll(): void {
    for (const p of [...live]) p.destroy();
  }

  private constructor(scene: Phaser.Scene, spec: PlateSpec) {
    this.scene = scene;
    this.spec = spec;
    this.ramp = plateRamp(spec);
    const iconKey = spec.kind === 'battle' ? iconTexture(scene, ICON.swords, iconTones('fire', 1)) : null;
    const iconW = iconKey ? scene.textures.getFrame(iconKey).width : 0;
    this.w = plateWidth(spec.segments, spec.kind, iconW);
    this.rect = plateRect(spec.player, this.w);
    this.side = spec.player === 0 ? -1 : 1; // the screen edge it slides in from (−1 left, +1 right)
    const x0 = REDUCED_MOTION ? this.rect.x : this.rect.x + this.side * PLATE.slide;
    this.root = scene.add.container(x0, this.rect.y).setDepth(DEPTH.HUD + 8).setScrollFactor(0);
    this.body = scene.add.image(0, 0, this.bodyKey(this.w, this.h, -2)).setOrigin(0, 0);
    this.root.add(this.body);
    this.trim = new TrimGfx(scene, this.root, 0, 0, this.w, this.h);
    // the battle plate's crossed swords (re-toned to the crimson trim)
    let tx = PLATE.padX;
    if (iconKey) {
      const img = scene.add.image(PLATE.padX, 0, iconKey).setOrigin(0, 0).setVisible(false);
      img.y = Math.round((this.h - img.height) / 2);
      this.root.add(img);
      this.icon = img;
      tx += iconW + PLATE.iconGap;
    }
    this.layoutText(tx);
    this.applyStep(-2);
    live.add(this);
    scene.events.once('shutdown', this.onShutdown);
    scene.events.on('update', this.onUpdate);
    this.settled = this.play();
  }

  /** The plate is on screen (not destroyed). */
  get active(): boolean {
    return this.alive;
  }

  /**
   * The tail: three hops toward `target` (a smaller plate each, on a straight whole-pixel line; the
   * last one is the target's own frame in white), then the plate is gone. `label` (optional) rides
   * the first two hops (e.g. "TUR 4", then "4"). Resolves when it is gone. With REDUCED_MOTION: two
   * palette steps out, in place.
   */
  shrinkTo(target: Rect, label: readonly string[] = [], onLand?: () => void): Promise<void> {
    if (this.shrinking) return this.shrinking;
    if (!this.alive) {
      onLand?.();
      return Promise.resolve();
    }
    // the appear timeline stops first (its frame / end callbacks see `leaving` and keep off the plate)
    this.leaving = true;
    const appear = this.tween;
    this.tween = null;
    appear?.stop();
    this.shrinking = this.runShrink(target, label, onLand);
    return this.shrinking;
  }

  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    live.delete(this);
    this.tween?.stop();
    this.tween = null;
    this.scene.events.off('shutdown', this.onShutdown);
    this.scene.events.off('update', this.onUpdate);
    this.trim.destroy();
    if (this.root.active) this.root.destroy();
  }

  // ---------------------------------------------------------------- internals

  private bodyKey(w: number, h: number, step: number): string {
    const s = step >= 0 ? 0 : -1;
    return canvasTexture(this.scene, `ui3:plate:body:${w}x${h}:${s}`, () => plateBody(w, h, s));
  }

  private layoutText(x0: number): void {
    const full = this.spec.segments.map((s) => s.text).join('');
    const L = layoutLine(full, 'md');
    // the colour of every drawn glyph (spaces draw nothing), in order
    const colors: number[] = [];
    for (const seg of this.spec.segments) for (const ch of seg.text) if (ch !== ' ') colors.push(seg.color);
    const y = capYV3('md', PLATE.capTop);
    const per = FRAME / Math.max(1, Math.round(this.spec.lettersPerFrame ?? 1));
    L.glyphs.forEach((g, i) => {
      const color = colors.length === L.glyphs.length ? colors[i] : PAL.white;
      const gx = x0 + g.x;
      const img = this.scene.add.image(gx, y, glyphTexture(this.scene, g.code, 'md', color)).setOrigin(0, 0).setVisible(false);
      this.root.add(img);
      // (+0.5 ms: the QA clock's frame is a hair under 1000 / 60 — still one letter per frame)
      this.glyphs.push({ img, code: g.code, color, x: gx, y, at: PLATE.stampFrom + Math.floor(i * per) - 0.5 });
    });
  }

  private applyStep(step: number): void {
    if (step === this.step) return;
    this.step = step;
    this.body.setTexture(this.bodyKey(this.w, this.h, step));
    this.trim.set(plateTrim(this.ramp, step));
    this.icon?.setVisible(step >= 0);
  }

  /** The appear → stamp → settle timeline (450 ms), on the scene's tween clock. */
  private play(): Promise<void> {
    const rest = this.rect.x;
    const from = rest + this.side * PLATE.slide;
    const over = rest - this.side * PLATE.over;
    const reduced = REDUCED_MOTION;
    // one lap of a white head with a light tail (visible on both trim tones), then the plate rests
    const node: TrimNode = { head: PAL.white, tail: [this.ramp[4], this.ramp[4]], lapMs: PLATE.nodeLapMs, restMs: 60000 };
    let nodeOn = false;
    const { settleAt, settledMs } = plateTiming(this.spec.kind);
    const frame = (ms: number) => {
      if (!this.alive || this.leaving) return;
      // two palette steps in: −2 (0–33 ms), −1 (33–67), rest
      this.applyStep(ms < 2 * FRAME - 0.5 ? -2 : ms < 4 * FRAME - 0.5 ? -1 : 0);
      if (!reduced) {
        const x = ms < PLATE.slideMs ? settle(from, over, ms / PLATE.slideMs) : ms < settleAt ? over : settle(over, rest, (ms - settleAt) / (settledMs - settleAt));
        this.root.x = x;
        if (!nodeOn && ms >= PLATE.slideMs) {
          nodeOn = true;
          this.trim.setNode(node);
        }
      }
      for (const g of this.glyphs) {
        const shown = reduced || ms >= g.at;
        g.img.setVisible(shown);
        if (!shown) continue;
        // the stamp: one white frame 1 px high, then the letter's own tone in place
        const fresh = !reduced && ms < g.at + FRAME - 0.5;
        g.img.setTexture(glyphTexture(this.scene, g.code, 'md', fresh ? PAL.white : g.color));
        g.img.y = fresh ? g.y - 1 : g.y;
      }
    };
    return this.timeline(settledMs, frame).then(() => {
      if (!this.alive || this.leaving) return;
      this.root.x = rest;
      this.applyStep(0);
      for (const g of this.glyphs) {
        g.img.setVisible(true).setTexture(glyphTexture(this.scene, g.code, 'md', g.color));
        g.img.y = g.y;
      }
    });
  }

  private async runShrink(target: Rect, label: readonly string[], onLand?: () => void): Promise<void> {
    const sc = this.scene;
    let landed = false;
    const land = () => {
      if (landed) return;
      landed = true;
      onLand?.();
    };
    if (REDUCED_MOTION) {
      // two palette steps out, in place
      await this.timeline(2 * PLATE.hopMs, (ms) => this.alive && this.applyStep(ms < PLATE.hopMs ? -1 : -2));
      this.destroy();
      land();
      return;
    }
    // the plate's own pieces go; each hop is a fresh small plate (body + trim [+ label])
    this.trim.setNode(null);
    this.root.removeAll(true);
    const hopRoot = sc.add.container(0, 0).setDepth(DEPTH.HUD + 8).setScrollFactor(0);
    this.root.add(hopRoot);
    this.root.setPosition(0, 0);
    const a = { x: this.rect.x + this.w / 2, y: this.rect.y + this.h / 2 };
    const b = { x: target.x + target.w / 2, y: target.y + target.h / 2 };
    const hops = [1 / 3, 2 / 3, 1].map((k, i) => {
      const w = Math.round(this.w + (target.w - this.w) * k);
      const h = Math.round(this.h + (target.h - this.h) * k);
      const x = i === 2 ? target.x : Math.round(a.x + (b.x - a.x) * k - w / 2);
      const y = i === 2 ? target.y : Math.round(a.y + (b.y - a.y) * k - h / 2);
      return { x, y, w, h, label: i < 2 ? label[i] ?? '' : '', last: i === 2 };
    });
    let shown = -1;
    const hop: { trim: TrimGfx | null } = { trim: null };
    const paint = (i: number) => {
      hopRoot.removeAll(true);
      hop.trim?.destroy();
      hop.trim = null;
      const H = hops[i];
      if (!H) return;
      if (!H.last) hopRoot.add(sc.add.image(H.x, H.y, this.bodyKey(H.w, H.h, 0)).setOrigin(0, 0));
      hop.trim = new TrimGfx(sc, hopRoot, H.x, H.y, H.w, H.h).set(H.last ? flatTrim(PAL.white) : plateTrim(this.ramp, i === 0 ? 0 : -1));
      if (H.label) {
        const L = layoutLine(H.label, 'md');
        const lx = Math.round(H.x + (H.w - L.w) / 2);
        const ly = H.y + Math.round((H.h - 15) / 2);
        for (const g of L.glyphs) hopRoot.add(sc.add.image(lx + g.x, ly, glyphTexture(sc, g.code, 'md', PAL.white)).setOrigin(0, 0));
      }
    };
    await this.timeline(3 * PLATE.hopMs, (ms) => {
      if (!this.alive) return;
      const i = Math.min(2, Math.floor((ms + 0.5) / PLATE.hopMs));
      if (i !== shown) {
        shown = i;
        paint(i);
        if (i === 2) land(); // the last hop is on the target: whatever it carries arrives now
      }
    });
    hop.trim?.destroy();
    this.destroy();
    land();
  }

  /** fn(ms) on the scene's tween clock from 0 to `ms` (speed / hit-stop aware); resolves at the end. */
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
          resolve();
        },
        onStop: () => resolve(),
      });
      this.tween = t;
    });
  }
}

/** Pixels of one plate at rest (tests / the dev page): body + trim, palette only (no text). */
export function plateCanvas(spec: Pick<PlateSpec, 'player' | 'kind' | 'segments'>, iconW = ICON_W): PixelCanvas {
  const w = plateWidth(spec.segments, spec.kind, iconW);
  const p = plateBody(w, PLATE.h, 0);
  const t = plateTrim(plateRamp(spec), 0);
  const tp = trimPixels(w, PLATE.h);
  for (const [x, y] of tp.light) p.set(x, y, t.light);
  for (const [x, y] of tp.dark) p.set(x, y, t.dark);
  return p;
}
