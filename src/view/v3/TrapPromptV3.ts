// TrapPromptV3 — the v3 trap window of lane A6-B (docs/v3/A6_PLAN.md §3 F7, step B4; built and called
// only under V3_A6_B). Palette pixels on whole pixels: no dimming, no alpha fade, no ADD, no scaled or
// rotated image (KO-1 … KO-4); the stepped light layer only lights the defender's pads.
//
//   TrapMarksV3   the trap window's handle (contract S-4): the v3 decision hook keeps one under
//                 'trapPulse' in EVERY trapResponse window (src/cinematics/v3small/decision.ts).
//                 mark(): each of the defender's face-down spell / trap cards on the board gets a 1-px
//                 magenta rim that draws itself around the card (100 ms, the cards 60 ms apart in screen
//                 order) and then carries a running light node; its pad lights magenta in steps (a flash
//                 + a held stepped pool); ui3Decision. ALL face-down cards are marked, never only the
//                 usable ones (no extra leak, §7.2). settle(): the window closed with "Geç" — the rims
//                 step down mag2 → mag1 → mag0 (two frames a step) and go, the pools fade. destroy():
//                 gone at once (the trap opening takes the card over). The handle of the S-15 fast path
//                 (a summon window) starts empty: it marks nothing unless a person is asked after all —
//                 the prompt below calls openTrapMarks(scene)?.mark() when it opens.
//   trapPromptV3  the question (Prompt.trapResponse in v3): the board stays as it is (no dimming); a small
//                 plate on the defender's side of the screen — P2 under its panel (top right), P1 above
//                 the action buttons (bottom right; the inspect panel keeps the left column) — slides
//                 12 px in from the screen edge in two palette steps (1-px overshoot), "Tuzak açılsın
//                 mı?" stamps two letters a frame; the usable trap cards (48×68, createCardV3) turn face
//                 up in their sharp turn frames (≤ 300 ms in all; with lane A6-A off: one cut at the
//                 middle, never a squashed card), each in a 1-px magenta rim with a light node; the picked
//                 card's rim turns gold, its name sits on the info line; AÇ (Enter) / GEÇ (Esc) in the v3
//                 button skin, 1–9 pick a card. Hovering a card shows it in the inspect panel (opts.onFocus).
//                 The answer: AÇ — the card's rim one white frame pair, the card 2 px up (ui3Confirm); GEÇ —
//                 ui3Back; then the plate leaves the way it came (two palette steps, 100 ms).
// Reduced motion (KO-9): no rim tracing, no running nodes, no slide / overshoot, no stamping.
// Sounds: the ui3 family (today's sound stands in while lane A6-A's recipe is silent).
//
//   const marks = new TrapMarksV3(scene, views, 1);  marks.mark();  ctx.keep('trapPulse', marks);
//   const uid = await trapPromptV3(scene, 1, [{ uid: 12, cardId: 'chains_of_light' }], { onFocus });

import type Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import { cardDef } from '../../data/cards';
import { PAL, PLAYER_RAMP } from '../../art/palette';
import { PixelCanvas, type Pt } from '../../art/pixel';
import type { DuelViews } from '../../duel/types';
import type { PlayerId, Uid } from '../../engine/types';
import type { TileCard } from '../TileCard';
import { lightFlash, lightPool, type LightHandle } from '../light';
import { CARD_H, CARD_W, DEPTH, GAME_W, UI, type Rect } from '../layout';
import { Button } from '../Button';
import { ICON, type UiStyle, pushUiKeys } from '../ui-textures';
import { createCardV3, type CardV3 } from './CardV3';
import { PalText, TrimGfx, canvasTexture, capYV3, flatTrim, iconTexture, iconTones, plateBodyV3, styleTone, styleTrim, textWidthV3, ui3Sfx, type TrimNode } from './hudSkin';
import { REDUCED_MOTION, settle } from './motion';
import { ui3CardSfx } from './TargetMarks';
import { contour, paletteSteps, plateFrame } from './ui-kit';
import { V3_A6_B } from '../v3flags';
import { registerUiTarget } from '../../duel/qaInput';

const FRAME = 1000 / 60;

// ================================================================ the board marks (S-4)

/** Board-mark timings (ms at 1×, scene clock). */
export const TRAP_MARK = Object.freeze({
  /** The rim draws itself around the card. */
  traceMs: 100,
  /** Card i starts i × stagger after the first (screen order, left → right). */
  staggerMs: 60,
  /** The decision's marking beat (A2's approved Chains timing: A6_MS.decision lock 300). */
  holdMs: 300,
  /** One lap of the running node. */
  lapMs: 720,
  /** Settle: two frames per palette step (mag2 → mag1 → mag0, then gone). */
  settleStepMs: 2 * FRAME,
  /** The rim's depth: on the floor plane, over the lying card, under every unit (UNIT + y). */
  depth: DEPTH.CARD_ON_TILE + 2,
});

/** The rim's resting tone, the node's head and tail (bright → dim). */
const RIM = PAL.mag3;
/** The rim's outer line (one pixel further out, two steps darker: a stepped edge light, no soft halo). */
const RIM_OUTER = PAL.mag1;
const NODE_HEAD = PAL.white;
const NODE_TAIL: readonly number[] = [PAL.mag4, PAL.mag4, PAL.mag4];

/**
 * The 1-px contour of a card's current pixels as a closed path, clockwise (screen y down) from the
 * leftmost direction around the opaque pixels' centre: `px` at (x, y) in the world; the points are
 * world pixels. Pure (tests): every point is a contour pixel, each exactly once.
 */
export function contourPath(px: PixelCanvas, x: number, y: number): Pt[] {
  const c = contour(px, RIM);
  const pts: Pt[] = [];
  for (let yy = 0; yy < c.h; yy++) for (let xx = 0; xx < c.w; xx++) if (c.alpha(xx, yy) > 0) pts.push([xx, yy]);
  if (!pts.length) return [];
  let sx = 0;
  let sy = 0;
  for (const [a, b] of pts) {
    sx += a;
    sy += b;
  }
  const cx = sx / pts.length;
  const cy = sy / pts.length;
  const keyed = pts.map(([a, b]) => ({ a, b, ang: Math.atan2(b - cy, a - cx), d: (a - cx) * (a - cx) + (b - cy) * (b - cy) }));
  keyed.sort((p, q) => p.ang - q.ang || p.d - q.d);
  // c's (0, 0) is one pixel up-left of px's (0, 0) (contour() adds a 1-px border)
  return keyed.map((k) => [x - 1 + k.a, y - 1 + k.b] as Pt);
}

/**
 * The ring one pixel further out than contourPath (the rim's darker outer line, a stepped edge light):
 * world pixels at distance 2 from the card's opaque pixels, outside it. Unordered.
 */
export function outerRing(px: PixelCanvas, x: number, y: number): Pt[] {
  const c1 = contour(px, RIM);
  const c2 = contour(c1, RIM);
  const out: Pt[] = [];
  for (let yy = 0; yy < c2.h; yy++)
    for (let xx = 0; xx < c2.w; xx++) if (c2.alpha(xx, yy) > 0 && !px.isOpaque(xx - 2, yy - 2)) out.push([x - 2 + xx, y - 2 + yy]);
  return out;
}

/** What the rim of card `i` shows `el` ms after mark() (pure; tests). */
export interface RimFrame {
  /** Path pixels drawn from the start (0 = none, path.length = the whole rim). */
  drawn: number;
  /** Their tone (the settle steps darken it); null = gone. */
  tone: number | null;
  /** The running node's head index (−1 = none). */
  head: number;
  /** The outer line's tone (mag1 once the rim is whole; null = not shown). */
  outer: number | null;
}

/**
 * The rim of a marked card: hidden before its start (i × stagger), tracing for traceMs (the tip white),
 * then whole with a running node; after settle() (at `settledAt` ms) three palette steps down and gone.
 * Reduced motion: whole at once, no node.
 */
export function rimFrame(el: number, i: number, L: number, settledAt: number | null = null, reduced = REDUCED_MOTION): RimFrame {
  const none: RimFrame = { drawn: 0, tone: null, head: -1, outer: null };
  if (L <= 0) return none;
  if (settledAt !== null && el >= settledAt) {
    // the outer line goes first, the rim steps down mag2 → mag1 → mag0 and goes
    const steps = paletteSteps(RIM, 3, -1);
    const k = Math.floor((el - settledAt) / TRAP_MARK.settleStepMs + 1e-6);
    return k < steps.length ? { drawn: L, tone: steps[k], head: -1, outer: null } : none;
  }
  if (reduced) return { drawn: L, tone: RIM, head: -1, outer: RIM_OUTER };
  const t = el - i * TRAP_MARK.staggerMs;
  if (t < 0) return none;
  if (t < TRAP_MARK.traceMs) {
    const drawn = Math.max(1, Math.min(L, Math.ceil((t / TRAP_MARK.traceMs) * L)));
    return { drawn, tone: RIM, head: drawn - 1, outer: null };
  }
  const k = ((t - TRAP_MARK.traceMs) % TRAP_MARK.lapMs) / TRAP_MARK.lapMs;
  return { drawn: L, tone: RIM, head: Math.min(L - 1, Math.floor(k * L)), outer: RIM_OUTER };
}

interface TileMark {
  tile: TileCard;
  /** The card's spell / trap zone (the calm arena's pad flash). */
  index: number;
  path: Pt[];
  outerPts: Pt[];
  rim: Phaser.GameObjects.Graphics;
  node: Phaser.GameObjects.Graphics;
  pool: LightHandle | null;
  lit: boolean;
  /** What is drawn now (redraw only on change). */
  drawn: number;
  tone: number | null;
  outer: number | null;
}

const openMarks = new Map<Phaser.Scene, TrapMarksV3>();

/** The open trap window's handle in this scene (the prompt marks through it), or null. */
export function openTrapMarks(scene: Phaser.Scene): TrapMarksV3 | null {
  const m = openMarks.get(scene);
  return m && m.alive ? m : null;
}

/**
 * The trap window's handle (S-4) — duck-typed as battle/_kit's SetPulse (tiles + settle + destroy), so
 * tb:responseDeclined settles it and trapOpeningV3 destroys it, both unchanged.
 */
export class TrapMarksV3 {
  /** The defender's face-down spell / trap cards on the board (marked or not). */
  readonly tiles: TileCard[];
  readonly player: PlayerId;
  private readonly scene: Phaser.Scene;
  private readonly views: DuelViews;
  private readonly zoneOf = new Map<TileCard, number>();
  private marks: TileMark[] = [];
  private el = 0;
  private settledAt: number | null = null;
  private live = true;
  private started = false;
  private readonly onUpdate = (_t: number, dt: number) => this.tick(dt * this.scene.tweens.timeScale);
  private readonly onShutdown = () => this.destroy();

  constructor(scene: Phaser.Scene, views: DuelViews, player: PlayerId) {
    this.scene = scene;
    this.views = views;
    this.player = player;
    const entries = views.field
      .tiles()
      .filter((e) => e.player === player && e.spot === 'spellTrap' && !e.tile.faceUp && e.tile.active && !e.tile.standing)
      .sort((a, b) => a.tile.home.x - b.tile.home.x);
    for (const e of entries) this.zoneOf.set(e.tile, e.index);
    this.tiles = entries.map((e) => e.tile);
    openMarks.get(scene)?.destroy();
    openMarks.set(scene, this);
    scene.events.once('shutdown', this.onShutdown);
  }

  get alive(): boolean {
    return this.live;
  }

  /** The cards are marked (mark() ran). */
  get marked(): boolean {
    return this.started;
  }

  /** Mark the cards now (idempotent): rims trace in, nodes run, the pads light; ui3Decision. */
  mark(): void {
    if (!this.live || this.started) return;
    this.started = true;
    this.el = 0;
    const sc = this.scene;
    for (const tile of this.tiles) {
      if (!tile.active) continue;
      const cur = tile.currentPixels();
      const path = contourPath(cur.px, cur.x, cur.y);
      const outerPts = outerRing(cur.px, cur.x, cur.y);
      const rim = sc.add.graphics().setDepth(TRAP_MARK.depth);
      const node = sc.add.graphics().setDepth(TRAP_MARK.depth + 0.01);
      this.marks.push({ tile, index: this.zoneOf.get(tile) ?? 0, path, outerPts, rim, node, pool: null, lit: false, drawn: -1, tone: null, outer: null });
    }
    ui3Sfx('ui3Decision', { volume: 0.5 }, 'lockOn', { volume: 0.45, pitch: 0.7 });
    sc.events.on('update', this.onUpdate);
    this.tick(0);
  }

  /** The window closed with "Geç": the rims cool down in palette steps and go; the pads' light fades. */
  settle(_color?: number): void {
    if (!this.live) return;
    if (!this.started) return this.destroy();
    if (this.settledAt === null) this.settledAt = this.el;
    for (const m of this.marks) {
      void m.pool?.fadeOut(200);
      m.pool = null;
    }
    this.tick(0);
  }

  /** Gone at once (the trap opening takes over, the batch ended, a restart). */
  destroy(): void {
    if (!this.live) return;
    this.live = false;
    if (openMarks.get(this.scene) === this) openMarks.delete(this.scene);
    this.scene.events.off('update', this.onUpdate);
    this.scene.events.off('shutdown', this.onShutdown);
    for (const m of this.marks) {
      m.pool?.destroy();
      if (m.rim.active) m.rim.destroy();
      if (m.node.active) m.node.destroy();
    }
    this.marks = [];
  }

  private tick(dt: number): void {
    if (!this.live) return;
    this.el += dt;
    let any = false;
    this.marks.forEach((m, i) => {
      const f = rimFrame(this.el, i, m.path.length, this.settledAt);
      if (f.tone !== null) any = true;
      // the pad lights as the card's rim starts tracing (stepped flash + a held pool)
      if (!m.lit && f.drawn > 0 && this.settledAt === null) {
        m.lit = true;
        const h = m.tile.home;
        // the calm arena's own stepped pad flash (pad + zone line, a crisp ring) and a held stepped pool
        void this.views.board.flashTile(this.player, 'spellTrap', m.index, PAL.mag3, 360);
        void lightFlash(this.scene, h.x, h.y, PAL.mag3, 30, 420, { intensity: 0.6 });
        m.pool = lightPool(this.scene, h.x, h.y, { color: PAL.mag2, radius: 26, intensity: 0.7, fadeIn: 120 });
      }
      if (f.drawn !== m.drawn || f.tone !== m.tone || f.outer !== m.outer) {
        m.drawn = f.drawn;
        m.tone = f.tone;
        m.outer = f.outer;
        m.rim.clear();
        if (f.outer !== null) {
          m.rim.fillStyle(f.outer, 1);
          for (const p of m.outerPts) m.rim.fillRect(p[0], p[1], 1, 1);
        }
        if (f.tone !== null && f.drawn > 0) {
          m.rim.fillStyle(f.tone, 1);
          for (let k = 0; k < f.drawn; k++) m.rim.fillRect(m.path[k][0], m.path[k][1], 1, 1);
        }
      }
      m.node.clear();
      if (f.head >= 0 && f.tone !== null) {
        const L = m.path.length;
        const tracing = f.drawn < L;
        for (let k = NODE_TAIL.length; k >= 1; k--) {
          const j = f.head - k;
          if (j < 0 && tracing) continue;
          const p = m.path[(j + L) % L];
          m.node.fillStyle(NODE_TAIL[k - 1], 1).fillRect(p[0], p[1], 1, 1);
        }
        const p = m.path[f.head];
        m.node.fillStyle(NODE_HEAD, 1).fillRect(p[0], p[1], 1, 1);
      }
    });
    // settled and every rim gone: nothing left to show (the handle stays a valid, empty S-4 handle)
    if (this.settledAt !== null && !any) {
      for (const m of this.marks) {
        if (m.rim.active) m.rim.destroy();
        if (m.node.active) m.node.destroy();
      }
      this.marks = [];
      this.scene.events.off('update', this.onUpdate);
    }
  }
}

// ================================================================ the plate (shared with CurtainV3)

/**
 * A plate of the v3 family (S-1 body + one trim + a light node), appearing / leaving in palette steps:
 * step −2 (night0 body, trim two tones down), −1, 0 (rest). Its parts are children of `root`.
 */
export class PlateBox {
  readonly root: Phaser.GameObjects.Container;
  readonly w: number;
  readonly h: number;
  private readonly scene: Phaser.Scene;
  private readonly body: Phaser.GameObjects.Image;
  private readonly trim: TrimGfx;
  private style: UiStyle;
  private step = 9;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, style: UiStyle, depth: number) {
    this.scene = scene;
    this.w = w;
    this.h = h;
    this.style = style;
    this.root = scene.add.container(Math.round(x), Math.round(y)).setDepth(depth).setScrollFactor(0);
    this.body = scene.add.image(0, 0, this.bodyKey(-2)).setOrigin(0, 0);
    this.root.add(this.body);
    this.trim = new TrimGfx(scene, this.root, 0, 0, w, h);
    this.setStep(-2);
  }

  setStep(step: number): void {
    const s = Math.max(-2, Math.min(0, Math.round(step)));
    if (s === this.step) return;
    this.step = s;
    this.body.setTexture(this.bodyKey(s));
    this.trim.set(styleTrim(this.style, s));
  }

  /** A white trim for a frame pair (an answer) — null back to the style's trim. */
  flash(c: number | null): void {
    this.trim.set(c === null ? styleTrim(this.style, this.step) : flatTrim(c));
  }

  /** The plate takes the pointer (nothing under it is hovered or clicked through it). */
  takeInput(): void {
    this.body.setInteractive();
  }

  /** The running node (KO-3), or none. */
  setNode(on: boolean): void {
    const node: TrimNode | null = on && !REDUCED_MOTION ? { head: PAL.white, tail: [styleTone(this.style, 2), styleTone(this.style, 1)], lapMs: 2400, restMs: 700 } : null;
    this.trim.setNode(node);
  }

  tick(dt: number): void {
    this.trim.tick(dt);
  }

  setVisible(b: boolean): void {
    this.root.setVisible(b);
  }

  destroy(): void {
    this.trim.destroy();
    if (this.root.active) this.root.destroy();
  }

  private bodyKey(step: number): string {
    return canvasTexture(this.scene, `ui3:plate:box:${this.w}x${this.h}:${step >= 0 ? 0 : -1}`, () => plateBodyV3(this.w, this.h, step >= 0 ? 0 : -1));
  }
}

/** A plate folded to height `h` (the curtain's 90-ms fold, a leaving prompt): body + trim at `step`. */
export function foldedPlate(w: number, h: number, style: UiStyle, step: number): PixelCanvas {
  const p = new PixelCanvas(w, Math.max(2, h));
  if (h >= 4) plateFrame(p, 0, 0, w, h, styleTrim(style, 0), { step });
  else p.rect(0, 0, w, Math.max(2, h), styleTone(style, step + 1));
  return p;
}

// ================================================================ the question (Prompt.trapResponse v3)

/** The prompt plate's geometry and timeline (game px; ms at 1×). */
export const TRAP_Q = Object.freeze({
  /** Wide enough for the header: rune + "Tuzak açılsın mı?" (md, 100 px) + "OYUNCU n" (sm, 41 px). */
  minW: 176,
  padX: 8,
  gap: 6,
  h: 130,
  headCap: 6,
  ownerCap: 7,
  cardY: 21,
  infoCap: 93,
  btnY: 104,
  btnW: 62,
  btnH: 20,
  btnGap: 8,
  /** Screen margin, gap under the P2 panel, gap above the action buttons (P1). */
  margin: 4,
  gapPanel: 8,
  gapButtons: 8,
  /** The slide in from the screen edge (F1's plate motion) and its 1-px overshoot. */
  slide: 12,
  over: 1,
  slideMs: 120,
  settleAt: 150,
  settledMs: 200,
  stampFrom: 67,
  lettersPerFrame: 2,
  /** The cards turn face up: card i at flipFrom + i × flipStagger, each in flipMs (≤ 300 ms in all for 3). */
  flipFrom: 40,
  flipStagger: 40,
  flipMs: 180,
  /** The answer: the rim's white frames, then the plate leaves in outMs. */
  ackMs: 2 * FRAME,
  outMs: 100,
  depth: DEPTH.OVERLAY,
});

export interface TrapPromptOption {
  uid: Uid;
  cardId: CardId;
}

export interface TrapPromptOpts {
  /** The card under the pointer or picked (null: none): the caller shows it in the inspect panel. */
  onFocus?: (cardId: CardId | null) => void;
}

/** The plate's width for n usable cards (one to three: the spell / trap row). */
export function trapPromptWidth(n: number): number {
  const k = Math.max(1, Math.min(3, Math.round(n)));
  return Math.max(TRAP_Q.minW, k * CARD_W + (k - 1) * TRAP_Q.gap + 2 * TRAP_Q.padX);
}

/** The plate's rest rect: P2 under its panel (top right), P1 above the action buttons (bottom right). */
export function trapPromptRect(player: PlayerId, n: number): Rect {
  const w = trapPromptWidth(n);
  const x = GAME_W - TRAP_Q.margin - w;
  const y = player === 1 ? UI.p2Panel.y + UI.p2Panel.h + TRAP_Q.gapPanel : UI.buttons.y - TRAP_Q.gapButtons - TRAP_Q.h;
  return { x, y, w, h: TRAP_Q.h };
}

/** Card i's centre inside the plate (whole pixels). */
export function trapCardXY(i: number, n: number, w: number): { x: number; y: number } {
  const k = Math.max(1, Math.min(3, n));
  const cardsW = k * CARD_W + (k - 1) * TRAP_Q.gap;
  return { x: Math.round(w / 2 - cardsW / 2 + CARD_W / 2 + i * (CARD_W + TRAP_Q.gap)), y: TRAP_Q.cardY + CARD_H / 2 };
}

/** The plate's x at `ms` after it opened (slides in from the right screen edge, 1 px past, back). */
export function trapPromptX(rest: number, ms: number, reduced = REDUCED_MOTION): number {
  if (reduced) return rest;
  const from = rest + TRAP_Q.slide;
  const over = rest - TRAP_Q.over;
  if (ms < TRAP_Q.slideMs) return settle(from, over, ms / TRAP_Q.slideMs);
  if (ms < TRAP_Q.settleAt) return over;
  if (ms < TRAP_Q.settledMs) return settle(over, rest, (ms - TRAP_Q.settleAt) / (TRAP_Q.settledMs - TRAP_Q.settleAt));
  return rest;
}

/** The open prompt (QA: the scenarios' `{ trapPrompt: 'open' | 'pass' | i }` UI target). */
let openPrompt: { scene: Phaser.Scene; root: Phaser.GameObjects.Container; cards: { x: number; y: number }[]; open: { x: number; y: number }; pass: { x: number; y: number } } | null = null;

// QA (A56.0 UiStep extension, src/duel/qaInput.ts registerUiTarget): a card or a button of the open
// prompt in screen pixels — { trapPrompt: 0 } the first card, 'open' = AÇ, 'pass' = GEÇ
if (V3_A6_B)
  registerUiTarget('trapPrompt', (scene, _views, arg) => {
    const q = openPrompt;
    if (!q || q.scene !== scene || !q.root.active) return null;
    const at = arg === 'open' ? q.open : arg === 'pass' ? q.pass : typeof arg === 'number' ? q.cards[arg] : undefined;
    return at ? { x: Math.round(q.root.x + at.x), y: Math.round(q.root.y + at.y) } : null;
  });

interface PromptCard {
  opt: TrapPromptOption;
  card: CardV3;
  rim: TrimGfx;
  cx: number;
  cy: number;
  turned: boolean;
}

/**
 * The trap question (F7). Resolves with the chosen card's uid (AÇ) or null (GEÇ / Esc / a scripted
 * answer that sends Esc / the scene shutting down). Keys: 1–9 pick, Enter = AÇ, Esc = GEÇ.
 */
export function trapPromptV3(scene: Phaser.Scene, player: PlayerId, options: readonly TrapPromptOption[], opts: TrapPromptOpts = {}): Promise<Uid | null> {
  if (options.length === 0) return Promise.resolve(null);
  const n = options.length;
  const R = trapPromptRect(player, n);
  const w = R.w;
  const plate = new PlateBox(scene, trapPromptX(R.x, 0), R.y, w, TRAP_Q.h, 'trap', TRAP_Q.depth);
  const root = plate.root;
  plate.takeInput(); // the board under the plate is not hovered through it (HumanInput skips covered points)
  // the board: a person is asked — the defender's face-down cards are marked now if the decision
  // did not already (the S-15 fast path of a summon window)
  openTrapMarks(scene)?.mark();
  ui3Sfx('ui3Decision', { volume: 0.6 }, 'yourMove');

  // ---- header: the trap rune, the question (stamped), the asked player
  const iconKey = iconTexture(scene, ICON.trap, iconTones('trap', 1));
  let tx = TRAP_Q.padX;
  let icon: Phaser.GameObjects.Image | null = null;
  if (iconKey) {
    icon = scene.add.image(TRAP_Q.padX, 5, iconKey).setOrigin(0, 0).setVisible(false);
    root.add(icon);
    tx += icon.width + 3;
  }
  const question = new PalText(scene, tx, capYV3('md', TRAP_Q.headCap), 'Tuzak açılsın mı?', { size: 'md', color: PAL.white });
  root.add(question.root);
  question.reveal(0);
  const ownerTone = PLAYER_RAMP[player][3];
  const ownerText = `OYUNCU ${player + 1}`;
  const owner = new PalText(scene, w - TRAP_Q.padX - textWidthV3(ownerText, 'sm'), capYV3('sm', TRAP_Q.ownerCap), ownerText, { size: 'sm', color: ownerTone });
  root.add(owner.root);
  owner.setVisible(false);

  // ---- the cards (face down, then turned), each in its rim
  const cards: PromptCard[] = options.map((opt, i) => {
    const { x: cx, y: cy } = trapCardXY(i, n, w);
    const card = createCardV3(scene, opt.cardId, { x: cx, y: cy, faceUp: false, player });
    root.add(card);
    const rim = new TrimGfx(scene, root, cx - CARD_W / 2 - 2, cy - CARD_H / 2 - 2, CARD_W + 4, CARD_H + 4);
    rim.setVisible(false);
    card.setInteractive({ useHandCursor: true });
    return { opt, card, rim, cx, cy, turned: false };
  });

  // ---- the info line (the focused card's name) and the buttons
  const info = new PalText(scene, 0, capYV3('sm', TRAP_Q.infoCap), '', { size: 'sm', color: PAL.mag4 });
  root.add(info.root);
  const bx0 = Math.round(w / 2 - TRAP_Q.btnW - TRAP_Q.btnGap / 2);
  const openBtn = new Button(scene, bx0, TRAP_Q.btnY, { w: TRAP_Q.btnW, h: TRAP_Q.btnH, label: 'AÇ', icon: ICON.trap, style: 'trap' });
  const passBtn = new Button(scene, bx0 + TRAP_Q.btnW + TRAP_Q.btnGap, TRAP_Q.btnY, { w: TRAP_Q.btnW, h: TRAP_Q.btnH, label: 'GEÇ', style: 'neutral' });
  root.add([openBtn, passBtn]);
  openBtn.appearStep(0);
  passBtn.appearStep(0);
  const qa = {
    scene,
    root,
    cards: cards.map((c) => ({ x: c.cx, y: c.cy })),
    open: { x: bx0 + TRAP_Q.btnW / 2, y: TRAP_Q.btnY + TRAP_Q.btnH / 2 },
    pass: { x: bx0 + TRAP_Q.btnW + TRAP_Q.btnGap + TRAP_Q.btnW / 2, y: TRAP_Q.btnY + TRAP_Q.btnH / 2 },
  };
  openPrompt = qa;

  let selected = n === 1 ? 0 : -1;
  let hovered = -1;
  let shown = false; // step 0 reached: the cards' rims and the info line are up
  const rimNode = (gold: boolean): TrimNode | null =>
    REDUCED_MOTION ? null : gold ? { head: PAL.white, tail: [PAL.gold4, PAL.gold3], lapMs: 900, restMs: 300 } : { head: PAL.white, tail: [PAL.mag4, PAL.mag3], lapMs: 1100, restMs: 500 };
  const paintRims = () => {
    cards.forEach((c, i) => {
      c.rim.setVisible(shown);
      // (the trap cards wear a magenta frame of their own: an unpicked card's rim is the neutral
      // steel / mist trim, the hovered one magenta, the picked one gold)
      if (i === selected) c.rim.set(styleTrim('gold', 1));
      else c.rim.set(i === hovered ? styleTrim('trap', 2) : styleTrim('neutral', 0));
    });
  };
  const setInfo = (i: number) => {
    const id = i >= 0 ? cards[i].opt.cardId : null;
    const text = id ? cardDef(id).name : 'Bir kart seç';
    info.setText(text);
    info.setColor(id ? PAL.mag4 : PAL.mist);
    info.setPosition(Math.round(w / 2 - info.width / 2), capYV3('sm', TRAP_Q.infoCap));
    info.setVisible(shown);
  };
  const showFocus = (i: number) => {
    setInfo(i);
    opts.onFocus?.(i >= 0 ? cards[i].opt.cardId : null);
  };
  const select = (i: number) => {
    if (i < 0 || i >= n || done) return;
    const was = selected;
    selected = i;
    cards.forEach((c, k) => c.rim.setNode(rimNode(k === i)));
    paintRims();
    showFocus(i);
    openBtn.setEnabled(true);
    openBtn.setAttention(true);
    if (was !== i) ui3CardSfx('ui3Select', { volume: 0.6 }, 'uiClick', { volume: 0.6 });
  };
  cards.forEach((c, i) => {
    c.card.on('pointerover', () => {
      if (done) return;
      hovered = i;
      paintRims();
      showFocus(i);
      ui3CardSfx('ui3Hover', { volume: 0.4 }, 'uiHover', { volume: 0.4 });
    });
    c.card.on('pointerout', () => {
      if (done) return;
      if (hovered === i) hovered = -1;
      paintRims();
      showFocus(selected);
    });
    c.card.on('pointerdown', () => select(i));
  });
  openBtn.setEnabled(selected >= 0);

  // ---- the timeline (scene clock: speed / hit-stop aware)
  let el = 0;
  let done = false;
  let out: { at: number; resolve: () => void } | null = null;
  let finish: (v: Uid | null) => void = () => undefined;
  const result = new Promise<Uid | null>((resolve) => {
    let settled = false;
    finish = (v) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
  });
  const applyStep = (step: number) => {
    plate.setStep(step);
    const b: 0 | 1 | 2 = step <= -2 ? 0 : step === -1 ? 1 : 2;
    openBtn.appearStep(b);
    passBtn.appearStep(b);
    const on = step >= 0;
    icon?.setVisible(on);
    owner.setVisible(on);
    if (on !== shown) {
      shown = on;
      paintRims();
      info.setVisible(on);
    }
  };
  const stampTotal = question.glyphCount;
  const tick = (_t: number, dt: number) => {
    const d = dt * scene.tweens.timeScale;
    el += d;
    plate.tick(d);
    for (const c of cards) c.rim.tick(d);
    if (out) {
      // leaving: −1 for two frames, −2 for two, gone (sliding back toward the edge)
      const k = el - out.at;
      if (k >= TRAP_Q.outMs) {
        out.resolve();
        return;
      }
      applyStep(k < 2 * FRAME ? -1 : -2);
      if (!REDUCED_MOTION) root.x = settle(R.x, R.x + TRAP_Q.slide, k / TRAP_Q.outMs);
      return;
    }
    applyStep(REDUCED_MOTION ? 0 : el < 2 * FRAME - 0.5 ? -2 : el < 4 * FRAME - 0.5 ? -1 : 0);
    root.x = trapPromptX(R.x, el);
    // the question: two letters a frame from 67 ms
    const k = REDUCED_MOTION ? stampTotal : Math.max(0, Math.floor((el - TRAP_Q.stampFrom) / FRAME + 1e-6) + 1) * TRAP_Q.lettersPerFrame;
    question.reveal(el >= TRAP_Q.stampFrom || REDUCED_MOTION ? Math.min(stampTotal, k) : 0);
    // the cards turn face up in their sharp frames, one after another
    cards.forEach((c, i) => {
      const at = TRAP_Q.flipFrom + i * TRAP_Q.flipStagger;
      if (c.turned || el < at) return;
      c.turned = true;
      ui3CardSfx('ui3Flip', { volume: 0.5 }, 'cardFlip', { volume: 0.5 });
      if (c.card.flipFrames().length) void c.card.flip(true, REDUCED_MOTION ? 60 : TRAP_Q.flipMs);
      else scene.time.delayedCall(REDUCED_MOTION ? 0 : TRAP_Q.flipMs / 2, () => c.card.active && c.card.setFaceUp(true));
    });
  };
  scene.events.on('update', tick);
  // the first frame is drawn as it opens (step −2, 12 px out)
  applyStep(REDUCED_MOTION ? 0 : -2);
  if (selected >= 0) select(selected);
  else showFocus(-1);

  // ---- the answer
  const keyFn = (e: KeyboardEvent): boolean => {
    if (done) return false;
    if (e.key === 'Escape') {
      passBtn.click();
      return true;
    }
    if (e.key === 'Enter') {
      openBtn.click();
      return true;
    }
    const k = Number(e.key);
    if (Number.isInteger(k) && k >= 1 && k <= n) {
      select(k - 1);
      return true;
    }
    return false;
  };
  const releaseKeys = pushUiKeys(keyFn);
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (openPrompt === qa) openPrompt = null;
    releaseKeys();
    scene.events.off('update', tick);
    scene.events.off('shutdown', onShutdown);
    for (const c of cards) c.rim.destroy();
    plate.destroy();
  };
  const onShutdown = () => {
    done = true;
    cleanup();
    finish(null);
  };
  scene.events.once('shutdown', onShutdown);
  const answer = (v: Uid | null) => {
    if (done) return;
    done = true;
    releaseKeys();
    opts.onFocus?.(null);
    for (const c of cards) c.card.disableInteractive();
    const leave = () =>
      new Promise<void>((resolve) => {
        plate.setNode(false);
        out = { at: el, resolve };
      });
    void (async () => {
      if (v !== null) {
        ui3Sfx('ui3Confirm', { volume: 0.7 }, 'uiConfirm', { volume: 0.6 });
        const c = cards[selected];
        c.rim.setNode(null);
        c.rim.set(flatTrim(PAL.white));
        plate.flash(PAL.white);
        c.card.y = c.cy - 2;
        await waitScaled(scene, TRAP_Q.ackMs);
        if (!cleaned) {
          c.rim.set(styleTrim('gold', 1));
          plate.flash(null);
        }
      } else ui3Sfx('ui3Back', { volume: 0.6 }, 'uiBack');
      if (!cleaned) await leave();
      cleanup();
      finish(v);
    })();
  };
  openBtn.onClick = () => {
    if (selected >= 0) answer(cards[selected].opt.uid);
  };
  passBtn.onClick = () => answer(null);
  return result;
}

/** Resolve after `ms` of scene (tween-scaled) time (shared with CurtainV3). */
export function waitScaled(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => {
    let el = 0;
    const stop = () => {
      scene.events.off('update', tick);
      scene.events.off('shutdown', stop);
      resolve();
    };
    const tick = (_t: number, dt: number) => {
      el += dt * scene.tweens.timeScale;
      if (el >= ms - 1e-6) stop();
    };
    scene.events.on('update', tick);
    scene.events.once('shutdown', stop);
  });
}
