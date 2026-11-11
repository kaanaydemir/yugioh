// The graveyard inspect panel (K11) — lane interface S-9 (docs/v3/A6_PLAN.md §3 K11, §4.1, §5.0.4).
// Lane A6-A (step A6) fills it under V3_A6_A; lane A6-B wires the click (HumanInput.openGrave: a click on
// any graveyard pile, M = the viewer's, Shift+M = the other one's) and the bot's wait while it is open
// (DuelController) against the frozen signatures below. With lane A6-A off (v1, &a6=off|b) it is the
// A56.0 stub: nothing opens.
//
//   await openGravePanel(scene, views, player, { cards: state.players[player].graveyard.map(...) });
//   if (gravePanelOpen(scene)) await whenGravePanelClosed(scene);
//
// The panel: a dark v3 plate (400 × 150, PlateBox, the owner's trim with a running node) over the hand
// band; the title "GRAVEYARD · PLAYER 1 · 5 cards" (vsBot: "YOUR GRAVEYARD" / "OPPONENT'S GRAVEYARD");
// the cards full size (createCardV3, crisp), newest first (the pile's top on the left), an index number
// under each; more than 7 scroll (◀ ▶, the wheel, a horizontal drag; whole cards, whole pixels). Pointing
// at a card (or ← → with the keyboard) lifts it in the owner's rim and shows it in the InspectPanel;
// a click / Enter pins it there (gold rim). An empty graveyard says so. Closing: Esc, M, a right click,
// a click outside the plate (the same pile included), CLOSE. While it is open the panel holds the duel's
// input: a screen-wide blocker under it takes the pointer, the UI key stack (pushUiKeys) the keys.
// Beats (./gravePanelModel.ts, A6_MS.gravePanelOpen 220 / gravePanelClose 140): the plate opens from a
// 4-px line in three steps (0–90 ms), the cards are born lying on the pile, stand up in two LOD frames
// and arc into their slots (30–220 ms, staggered), each with a soft ui3Card tick; the pile's pad light
// is up +1 while open. Closing: the cards gather into one deck that falls onto the pile, the plate folds
// back in three steps (0–140 ms, ui3PanelClose). Reduced motion (AH): no flight, the cards appear in two
// palette steps, no opening steps. Palette pixels on whole pixels: no alpha, no ADD (KO-1 … KO-4).

import Phaser from 'phaser';
import { cardDef, isMonster, type CardId } from '../../data/cards';
import { PAL, PLAYER_RAMP } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import type { PlayerId } from '../../engine/types';
import type { DuelViews } from '../../duel/types';
import { registerUiTarget } from '../../duel/qaInput';
import { Button } from '../Button';
import { DEPTH, GAME_H, GAME_W, type XY } from '../layout';
import { lightPool, type LightHandle } from '../light';
import { ICON, type UiStyle, pushUiKeys } from '../ui-textures';
import { V3_A6_A } from '../v3flags';
import { createCardV3, type CardV3 } from './CardV3';
import { PalText, canvasTexture, capYV3, iconTexture, iconTones, textWidthV3 } from './hudSkin';
import { REDUCED_MOTION } from './motion';
import { ui3CardSfx } from './TargetMarks';
import { PlateBox, foldedPlate } from './TrapPromptV3';
import {
  GRAVE,
  GRAVE_TEXT,
  PITCH,
  WIN_W,
  arcPoint,
  clampScroll,
  closeDeck,
  closeFrame,
  flightAt,
  flightPlan,
  graveRect,
  graveTitle,
  inWindow,
  maxScroll,
  moveFocus,
  openFrame,
  scrollToShow,
  shelfOrder,
  slotAt,
  slotXY,
  snapScroll,
  stepScroll,
} from './gravePanelModel';

export interface GravePanelOpts {
  /** The graveyard's cards as in the engine state (bottom → top). The panel shows the newest first. */
  cards?: readonly CardId[];
  /** How it was opened (focus / keyboard hints). */
  via?: 'mouse' | 'key' | 'touch';
  /** Called once when the panel has closed. */
  onClose?: () => void;
}

const FRAME = 1000 / 60;
/** Over the hand (2100), the inspect panel (2200) and the action menu (2300); under banners / cut-ins. */
const DEPTH_PLATE = DEPTH.MENU + 40;
/** A pointer that moved this far since the press is a drag (not a tap). */
const DRAG_PX = 4;
/** The 4 pentatonic steps the per-card ticks climb (A minor pentatonic, semitones). */
const LADDER = [0, 3, 5, 7, 10, 12, 15];

interface ShelfCard {
  id: CardId;
  card: CardV3;
  index: PalText;
  ghost: Phaser.GameObjects.Image | null;
  /** Flight (null: in place from the start, or reduced motion). */
  fly: { start: number; dur: number; from: XY; to: XY; ticked: boolean } | null;
  landed: boolean;
  lifted: boolean;
  rim: string;
}

const panels = new WeakMap<Phaser.Scene, GravePanelView>();

/** Plate-local → screen of the open panel (QA target). */
let qaPanel: GravePanelView | null = null;

if (V3_A6_A)
  registerUiTarget('panel', (scene, _views, arg) => {
    const p = qaPanel;
    if (!p || p.scene !== scene || typeof arg !== 'number') return null;
    return p.cardScreenXY(arg);
  });

/** The 48 × 68 ghost of a card (reduced motion: a card appears / goes in two palette steps). */
function ghostCanvas(tone: number): PixelCanvas {
  const p = new PixelCanvas(GRAVE.cardW, GRAVE.cardH);
  p.rect(1, 1, GRAVE.cardW - 2, GRAVE.cardH - 2, tone);
  p.hline(1, GRAVE.cardW - 2, 0, PAL.ink).hline(1, GRAVE.cardW - 2, GRAVE.cardH - 1, PAL.ink);
  p.vline(0, 1, GRAVE.cardH - 2, PAL.ink).vline(GRAVE.cardW - 1, 1, GRAVE.cardH - 2, PAL.ink);
  return p;
}

/** The empty graveyard's slot: a dashed card outline (2 on, 2 off) with corner ticks. */
function emptySlotCanvas(tone: number, corner: number): PixelCanvas {
  const w = GRAVE.cardW;
  const h = GRAVE.cardH;
  const p = new PixelCanvas(w, h);
  for (let x = 2; x < w - 2; x++) if (x % 4 < 2) p.set(x, 0, tone).set(x, h - 1, tone);
  for (let y = 2; y < h - 2; y++) if (y % 4 < 2) p.set(0, y, tone).set(w - 1, y, tone);
  for (const [x, y, dx, dy] of [
    [0, 0, 1, 1],
    [w - 1, 0, -1, 1],
    [0, h - 1, 1, -1],
    [w - 1, h - 1, -1, -1],
  ])
    p.set(x + dx, y, corner).set(x, y + dy, corner).set(x + dx, y + dy, corner);
  return p;
}

class GravePanelView {
  readonly scene: Phaser.Scene;
  private readonly views: DuelViews;
  private readonly player: PlayerId;
  private readonly style: UiStyle;
  private readonly R: { x: number; y: number; w: number; h: number };
  private readonly ids: CardId[];
  private readonly n: number;
  private readonly reduced = REDUCED_MOTION;

  private readonly blocker: Phaser.GameObjects.Zone;
  private readonly plate: PlateBox;
  private readonly content: Phaser.GameObjects.Container;
  private readonly cardsRoot: Phaser.GameObjects.Container;
  private readonly strip: Phaser.GameObjects.Container;
  private readonly fold: Phaser.GameObjects.Image;
  private readonly chrome: Phaser.GameObjects.Graphics;
  private readonly maskG: Phaser.GameObjects.Graphics | null;
  private readonly title: PalText[] = [];
  private readonly info: PalText;
  private readonly info2: PalText;
  private readonly hint: PalText;
  private readonly closeBtn: Button;
  private readonly cards: ShelfCard[] = [];
  private readonly pileLocal: XY;
  private light: LightHandle | null = null;
  private releaseKeys: (() => void) | null = null;

  private el = 0;
  private closingAt: number | null = null;
  private dead = false;
  private resolveDone: () => void = () => undefined;
  readonly done: Promise<void>;

  private scroll = 0;
  private target = 0;
  private hover = -1;
  private kbFocus = -1;
  private pinned = -1;
  private arrowHot: -1 | 0 | 1 = -1;
  private press: { x: number; y: number; scroll: number; drag: boolean; inWin: boolean } | null = null;
  private armed = false;
  private wheelAcc = 0;
  private chromeKey = '';
  private stamped = 0;
  private titleGlyphs = 0;
  private plateShown = false;
  private masked = false;
  private onClose: (() => void) | undefined;

  constructor(scene: Phaser.Scene, views: DuelViews, player: PlayerId, opts: GravePanelOpts) {
    this.scene = scene;
    this.views = views;
    this.player = player;
    this.style = player === 0 ? 'p1' : 'p2';
    this.onClose = opts.onClose;
    this.R = graveRect(GAME_W, GAME_H);
    this.ids = shelfOrder(opts.cards ?? []);
    this.n = this.ids.length;
    this.done = new Promise<void>((r) => (this.resolveDone = r));
    const R = this.R;

    // ---- the blocker: the duel under the panel gets no pointer while it is open
    this.blocker = scene.add.zone(0, 0, GAME_W, GAME_H).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH_PLATE - 1).setInteractive();

    // ---- the plate (body + owner trim + node) and its fold image (the opening / closing steps)
    this.plate = new PlateBox(scene, R.x, R.y, R.w, R.h, this.style, DEPTH_PLATE);
    this.plate.takeInput();
    this.plate.setStep(0);
    this.plate.setVisible(false);
    this.fold = scene.add.image(R.x, R.y + R.h, this.foldKey(GRAVE.openSteps[0], -2)).setOrigin(0, 1).setDepth(DEPTH_PLATE).setScrollFactor(0).setVisible(false);
    this.content = scene.add.container(0, 0);
    this.plate.root.add(this.content);
    this.chrome = scene.add.graphics();
    this.content.add(this.chrome);

    // ---- the title (stamped once the plate is full): grave rune + segments
    const tones = { head: PAL.white, owner: PLAYER_RAMP[player][4], count: PAL.mist } as const;
    const vsBot = views.info.mode === 'vsBot' ? { viewer: views.info.viewer } : null;
    let tx = GRAVE.padX;
    const rune = iconTexture(scene, ICON.grave, iconTones(this.style, 1));
    if (rune) {
      const img = scene.add.image(tx, GRAVE.titleCap - 2, rune).setOrigin(0, 0);
      this.content.add(img);
      tx += img.width + 4;
    }
    for (const seg of graveTitle(player, this.n, vsBot)) {
      const t = new PalText(scene, tx, capYV3('md', GRAVE.titleCap), seg.text, { size: 'md', color: tones[seg.role] });
      this.content.add(t.root);
      this.title.push(t);
      tx += textWidthV3(seg.text, 'md');
    }
    this.titleGlyphs = this.title.reduce((k, t) => k + t.glyphCount, 0);
    for (const t of this.title) t.reveal(0);

    // ---- CLOSE (top right)
    this.closeBtn = new Button(scene, R.w - GRAVE.padX + 2 - GRAVE.closeW, GRAVE.closeY, { w: GRAVE.closeW, h: GRAVE.closeH, label: GRAVE_TEXT.close, size: 'sm', icon: ICON.close, style: 'neutral', sound: false });
    this.closeBtn.onClick = () => this.close();
    this.content.add(this.closeBtn);

    // ---- the info line (the pointed / pinned card) and the key hint
    this.info = new PalText(scene, 0, capYV3('sm', GRAVE.infoCap), '', { size: 'sm', color: PAL.white });
    this.info2 = new PalText(scene, 0, capYV3('sm', GRAVE.infoCap), '', { size: 'sm', color: PAL.mist });
    const hintText = this.n ? GRAVE_TEXT.hint : GRAVE_TEXT.hintEmpty;
    this.hint = new PalText(scene, Math.round(R.w / 2 - textWidthV3(hintText, 'sm') / 2), capYV3('sm', GRAVE.hintCap), hintText, { size: 'sm', color: PAL.steel });
    this.content.add([this.info.root, this.info2.root, this.hint.root]);

    // ---- the empty graveyard
    if (!this.n) {
      const s = slotXY(0, 1);
      const slot = scene.add.image(s.x, s.y, canvasTexture(scene, 'ui3:grave:empty', () => emptySlotCanvas(PAL.night4, PLAYER_RAMP[player][2]))).setOrigin(0.5);
      this.content.add(slot);
      const icon = iconTexture(scene, ICON.grave, iconTones('neutral', -1));
      if (icon) this.content.add(scene.add.image(s.x, s.y, icon).setOrigin(0.5));
      const e = new PalText(scene, Math.round(R.w / 2 - textWidthV3(GRAVE_TEXT.empty, 'sm') / 2), capYV3('sm', GRAVE.indexCap + 2), GRAVE_TEXT.empty, { size: 'sm', color: PAL.mist });
      this.content.add(e.root);
    }
    this.content.setVisible(false);

    // ---- the cards: their own layer over the plate (they fly in from the pile, outside the plate)
    this.cardsRoot = scene.add.container(R.x, R.y).setDepth(DEPTH_PLATE + 1).setScrollFactor(0);
    this.strip = scene.add.container(0, 0);
    this.cardsRoot.add(this.strip);
    const pile = views.field.pile(player, 'graveyard');
    const ps = this.worldToScreen(pile.topXY());
    this.pileLocal = { x: ps.x - R.x, y: ps.y - R.y };
    const plan = flightPlan(this.n);
    // the newest card (the pile's top) lies on top of the others while they fly: added last
    const order = this.ids.map((_, i) => i).reverse();
    const made: ShelfCard[] = new Array(this.n);
    for (const i of order) {
      const id = this.ids[i];
      const at = slotXY(i, this.n);
      const card = createCardV3(scene, id, { x: at.x, y: at.y, faceUp: true, player });
      const index = new PalText(scene, 0, capYV3('sm', GRAVE.indexCap), String(i + 1), { size: 'sm', color: PAL.steel });
      index.setPosition(Math.round(at.x - index.width / 2), capYV3('sm', GRAVE.indexCap));
      index.setVisible(false);
      let ghost: Phaser.GameObjects.Image | null = null;
      if (this.reduced) {
        ghost = scene.add.image(at.x, at.y, canvasTexture(scene, 'ui3:grave:ghost:2', () => ghostCanvas(PAL.night2))).setOrigin(0.5);
        card.setVisible(false);
      }
      const p = !this.reduced ? plan[i] : undefined;
      const fly = p ? { start: p.start, dur: p.dur, from: { ...this.pileLocal }, to: at, ticked: false } : null;
      if (fly) {
        card.setVisible(false);
        card.setPosition(fly.from.x, fly.from.y);
      } else if (!this.reduced && i >= GRAVE.visible) card.setVisible(false); // shown once the window's mask is on
      this.strip.add(card);
      if (ghost) this.strip.add(ghost);
      this.strip.add(index.root);
      made[i] = { id, card, index, ghost, fly, landed: !fly, lifted: false, rim: '' };
    }
    this.cards.push(...made);

    // ---- the window's mask (more than 7 cards scroll inside it)
    if (this.n > GRAVE.visible) {
      this.maskG = scene.make.graphics({}, false);
      this.maskG.fillStyle(PAL.white, 1);
      this.maskG.fillRect(R.x + GRAVE.winX - 1, R.y + GRAVE.divider + 1, WIN_W + 2, GRAVE.infoCap - GRAVE.divider - 3);
    } else this.maskG = null;

    // ---- the pile's pad: a stepped flash and its light +1 while the panel is open
    void views.board.flashTile(player, 'graveyard', 0, PLAYER_RAMP[player][3], 200);
    this.light = lightPool(scene, pile.home.x, pile.home.y, { color: PLAYER_RAMP[player][2], radius: 22, intensity: 0.55, fadeIn: 90 });

    // ---- input
    this.releaseKeys = pushUiKeys((e) => this.onKey(e));
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp);
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.onWheel);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown);

    if (opts.via === 'key' && this.n) this.kbFocus = 0;
    ui3CardSfx('ui3PanelOpen', { volume: 0.7, pan: this.panOf(ps.x) }, 'cardSlide', { volume: 0.4 });
    this.tick(0);
  }

  get closing(): boolean {
    return this.closingAt !== null;
  }

  // ================================================================ the timeline

  private readonly onUpdate = (_t: number, dt: number): void => {
    this.tick(dt * this.scene.tweens.timeScale);
  };

  private tick(dt: number): void {
    if (this.dead) return;
    this.el += dt;
    this.plate.tick(dt);
    if (this.closingAt !== null) return this.tickClose(this.el - this.closingAt);
    const el = this.el;
    // ---- the plate: three steps from a 4-px line (bottom-anchored), then full
    const of = openFrame(el, this.reduced);
    if (of.full) {
      if (!this.plateShown) {
        this.plateShown = true;
        this.fold.setVisible(false);
        this.plate.setVisible(true);
        this.content.setVisible(true);
        this.plate.setNode(true);
        this.stampAt = el;
      }
    } else {
      this.fold.setTexture(this.foldKey(of.h, of.step)).setVisible(true);
    }
    // ---- the title stamps two letters a frame from the full plate
    if (this.plateShown && this.stamped < this.titleGlyphs) {
      const k = this.reduced ? this.titleGlyphs : (Math.floor((el - this.stampAt) / FRAME + 1e-6) + 1) * GRAVE.lettersPerFrame;
      this.stamped = Math.min(this.titleGlyphs, k);
      let left = this.stamped;
      for (const t of this.title) {
        t.reveal(Math.max(0, left));
        left -= t.glyphCount;
      }
    }
    // ---- the cards
    let allLanded = true;
    this.cards.forEach((c, i) => {
      if (this.reduced) {
        // two palette steps (night2, night4 ghosts — two frames each), then the card
        const k = Math.floor(el / GRAVE.reducedStepMs + 1e-6);
        if (c.ghost) {
          if (k === 1) c.ghost.setTexture(canvasTexture(this.scene, 'ui3:grave:ghost:4', () => ghostCanvas(PAL.night4)));
          if (k >= 2 && c.ghost.visible) {
            c.ghost.setVisible(false);
            if (i < GRAVE.visible || this.masked || !this.maskG) c.card.setVisible(true);
            c.index.setVisible(true);
          }
        }
        if (k < 2) allLanded = false;
        return;
      }
      const f = c.fly;
      if (!f || c.landed) return;
      allLanded = false;
      const t = (el - f.start) / f.dur;
      if (t < 0) return;
      if (!f.ticked) {
        f.ticked = true;
        c.card.setVisible(true);
        const semis = LADDER[Math.min(LADDER.length - 1, i)];
        ui3CardSfx('ui3Card', { volume: 0.32, pitch: Math.pow(2, semis / 12), pan: this.panOf(this.R.x + f.to.x) }, null);
      }
      const s = flightAt(t);
      const rise = 22 + Math.abs(f.to.x - f.from.x) * 0.08;
      const p = t >= 1 ? f.to : arcPoint(f.from, f.to, s.p, rise);
      c.card.setScale(s.sx, s.sy);
      // a lying card sits on the pile's top (its bottom edge on it), so it seems to rise out of the stack
      const lyingDy = s.stage === 0 ? -Math.round((GRAVE.cardH * s.sy) / 2) + 2 : 0;
      c.card.setPosition(p.x, p.y + lyingDy);
      if (t >= 1) {
        c.landed = true;
        c.card.setScale(1);
        c.card.setPosition(f.to.x, f.to.y);
        void c.card.punch(0.05, 100);
        c.index.setVisible(true);
      }
    });
    if (allLanded && this.maskG && !this.masked && this.plateShown) {
      this.masked = true;
      this.strip.setMask(this.maskG.createGeometryMask());
      this.cards.forEach((c) => {
        c.card.setVisible(true);
        c.index.setVisible(true);
      });
    }
    if (allLanded) this.cards.forEach((c) => c.landed || ((c.landed = true), c.index.setVisible(true)));
    // ---- the scroll (whole pixels, a quick settle toward the target)
    if (this.scroll !== this.target) {
      const d = this.target - this.scroll;
      const k = 1 - Math.pow(0.62, Math.max(0.25, dt / FRAME));
      const step = Math.sign(d) * Math.max(1, Math.round(Math.abs(d) * k));
      this.scroll = Math.abs(step) >= Math.abs(d) ? this.target : this.scroll + step;
    }
    this.strip.x = -this.scroll;
    this.paintCards();
    this.paintChrome();
  }

  private stampAt = 0;

  private tickClose(ms: number): void {
    const cf = closeFrame(ms, this.reduced);
    if (cf.gone) return this.finish();
    if (cf.full) {
      this.plate.setVisible(true);
      this.plate.setStep(cf.step);
      this.fold.setVisible(false);
    } else {
      this.plate.setVisible(false);
      this.fold.setTexture(this.foldKey(cf.h, cf.step)).setVisible(true);
    }
    if (ms >= GRAVE.foldFrom || this.reduced) this.content.setVisible(false);
    if (this.reduced) {
      const k = Math.floor(ms / GRAVE.reducedStepMs + 1e-6);
      for (const c of this.closingCards) {
        if (!c.ghost) continue;
        c.card.setVisible(false);
        c.index.setVisible(false);
        c.ghost.setTexture(canvasTexture(this.scene, `ui3:grave:ghost:${k === 0 ? 4 : 2}`, () => ghostCanvas(k === 0 ? PAL.night4 : PAL.night2))).setVisible(true);
      }
      return;
    }
    // the visible cards gather into one deck on the leftmost one, then the deck falls onto the pile
    const d = closeDeck(ms);
    const stackAt = this.stackPoint;
    this.closingCards.forEach((c, k) => {
      const from = this.closingFrom[k];
      // the deck: 1 px up-left per card beneath the top, at most 3
      const depth = Math.min(3, this.closingCards.length - 1 - k);
      const deckPt = { x: stackAt.x - depth, y: stackAt.y - depth };
      if (d.phase === 'gather') {
        const e = d.t * d.t;
        c.card.setPosition(Math.round(from.x + (deckPt.x - from.x) * e), Math.round(from.y + (deckPt.y - from.y) * e));
      } else if (d.phase === 'fall') {
        const e = d.t * d.t;
        const p = arcPoint(deckPt, this.pileStrip, e, 14);
        c.card.setScale(d.sx, d.sy);
        c.card.setPosition(p.x, p.y);
        if (d.t > 0.8 && !this.bumped) {
          this.bumped = true;
          this.views.field.pile(this.player, 'graveyard').bump();
        }
      } else c.card.setVisible(false);
    });
  }

  private closingCards: ShelfCard[] = [];
  private closingFrom: XY[] = [];
  private bumped = false;

  // ================================================================ the shelf

  /** The card the eye is on: the pointer's, else the keyboard's. */
  private get hot(): number {
    return this.hover >= 0 ? this.hover : this.kbFocus;
  }

  private paintCards(): void {
    const hot = this.hot;
    const ramp = PLAYER_RAMP[this.player];
    this.cards.forEach((c, i) => {
      if (!c.landed) return;
      const lift = i === hot;
      if (lift !== c.lifted) {
        c.lifted = lift;
        void c.card.hoverLift(lift);
      }
      const rim = i === this.pinned ? 'pin' : lift ? 'hot' : '';
      if (rim !== c.rim) {
        c.rim = rim;
        c.card.setRim(rim === 'pin' ? { tl: PAL.gold4, br: PAL.gold2, nodes: 2 } : rim === 'hot' ? { tl: ramp[4], br: ramp[2], nodes: 1 } : null);
        c.index.setColor(rim === 'pin' ? PAL.gold4 : rim === 'hot' ? PAL.white : PAL.steel);
      }
    });
  }

  /** Arrows, the divider and the scroll track (repainted only when they change). */
  private paintChrome(): void {
    const n = this.n;
    const max = maxScroll(n);
    const canL = this.target > 0;
    const canR = this.target < max;
    // the arrows nudge outward 1 px every 700 ms while there is more to see (a living hint)
    const nudge = !this.reduced && Math.floor(this.el / 700) % 2 === 1 ? 1 : 0;
    const key = `${this.scroll}|${canL}|${canR}|${this.arrowHot}|${nudge}`;
    if (key === this.chromeKey) return;
    this.chromeKey = key;
    const g = this.chrome;
    const ramp = PLAYER_RAMP[this.player];
    g.clear();
    // the divider under the header: owner tone with a 1-px ink line under it, faded ends (stepped)
    const W = this.R.w;
    g.fillStyle(PAL.ink, 1).fillRect(6, GRAVE.divider + 1, W - 12, 1);
    g.fillStyle(ramp[1], 1).fillRect(6, GRAVE.divider, W - 12, 1);
    g.fillStyle(ramp[2], 1).fillRect(24, GRAVE.divider, W - 48, 1);
    if (n <= GRAVE.visible) return;
    const cy = GRAVE.cardTop + GRAVE.cardH / 2;
    const tri = (x: number, dir: -1 | 1, tone: number) => {
      // a 5 × 9 triangle pointing `dir`, ink outline under it (1 px down)
      for (let k = 0; k < GRAVE.arrowW; k++) {
        const hh = GRAVE.arrowW - 1 - k;
        const xx = dir === 1 ? x + k : x + GRAVE.arrowW - 1 - k;
        g.fillStyle(PAL.ink, 1).fillRect(xx, cy - hh, 1, 2 * hh + 2);
        g.fillStyle(tone, 1).fillRect(xx, cy - hh, 1, 2 * hh + 1);
      }
    };
    const tone = (on: boolean, hot: boolean) => (!on ? PAL.night3 : hot ? PAL.white : ramp[3]);
    tri(GRAVE.winX - 6 - GRAVE.arrowW - (canL ? nudge : 0), -1, tone(canL, this.arrowHot === 0));
    tri(GRAVE.winX + WIN_W + 6 + (canR ? nudge : 0), 1, tone(canR, this.arrowHot === 1));
    // the scroll track: night3, the thumb (the window's share) in the owner's tone
    const tx = GRAVE.winX;
    g.fillStyle(PAL.night2, 1).fillRect(tx, GRAVE.trackY, WIN_W, 2);
    const tw = Math.max(12, Math.round((WIN_W * GRAVE.visible) / n));
    const thx = tx + Math.round(((WIN_W - tw) * this.scroll) / Math.max(1, max));
    g.fillStyle(ramp[2], 1).fillRect(thx, GRAVE.trackY, tw, 2);
    g.fillStyle(ramp[4], 1).fillRect(thx, GRAVE.trackY, tw, 1);
  }

  private setInfo(): void {
    const i = this.hot >= 0 ? this.hot : this.pinned;
    let a = '';
    let b = '';
    if (i >= 0) {
      const d = cardDef(this.ids[i]);
      a = d.name;
      b = isMonster(d) ? ` · ATK ${d.atk} / DEF ${d.def}` : d.kind === 'spell' ? ' · Spell' : ' · Trap';
      if (i === this.pinned) b += ` · ${GRAVE_TEXT.pinned}`;
    } else if (this.n) b = GRAVE_TEXT.idle;
    this.info.setText(a);
    this.info2.setText(b);
    this.info2.setColor(i >= 0 ? PAL.mist : PAL.steel);
    const w = this.info.width + this.info2.width;
    const x = Math.round(this.R.w / 2 - w / 2);
    this.info.setPosition(x, capYV3('sm', GRAVE.infoCap));
    this.info2.setPosition(x + this.info.width, capYV3('sm', GRAVE.infoCap));
  }

  /** Show the eye's card (or the pinned one) in the inspect panel. */
  private inspect(): void {
    const i = this.hot >= 0 ? this.hot : this.pinned;
    if (i >= 0) this.views.inspect.show(this.ids[i]);
    else this.views.inspect.hide();
    this.setInfo();
  }

  private setHover(i: number): void {
    if (i === this.hover) return;
    this.hover = i;
    if (i >= 0) {
      this.kbFocus = i;
      ui3CardSfx('ui3Hover', { volume: 0.4, pitch: Math.pow(2, LADDER[i % LADDER.length] / 12) }, 'uiHover', { volume: 0.35 });
    }
    this.inspect();
  }

  private togglePin(i: number): void {
    if (i < 0 || i >= this.n) return;
    this.pinned = this.pinned === i ? -1 : i;
    ui3CardSfx('ui3Select', { volume: 0.6 }, 'uiClick', { volume: 0.55 });
    this.inspect();
  }

  private scrollBy(cards: number): void {
    const t = stepScroll(this.target, cards, this.n);
    if (t === this.target) return;
    this.target = t;
    ui3CardSfx('ui3Slide', { volume: 0.4 }, 'cardSlide', { volume: 0.22 });
  }

  // ================================================================ input

  private local(p: Phaser.Input.Pointer): XY {
    return { x: Math.floor(p.x) - this.R.x, y: Math.floor(p.y) - this.R.y };
  }

  private inPlate(l: XY): boolean {
    return l.x >= 0 && l.y >= 0 && l.x < this.R.w && l.y < this.R.h;
  }

  private arrowAt(l: XY): -1 | 0 | 1 {
    if (this.n <= GRAVE.visible) return -1;
    const cy = GRAVE.cardTop + GRAVE.cardH / 2;
    if (Math.abs(l.y - cy) > 20) return -1;
    if (l.x >= GRAVE.winX - GRAVE.arrowHit && l.x < GRAVE.winX) return 0;
    if (l.x >= GRAVE.winX + WIN_W && l.x < GRAVE.winX + WIN_W + GRAVE.arrowHit) return 1;
    return -1;
  }

  private overClose(p: Phaser.Input.Pointer): boolean {
    const l = this.local(p);
    const b = this.closeBtn;
    return l.x >= b.x && l.x < b.x + GRAVE.closeW && l.y >= b.y && l.y < b.y + GRAVE.closeH;
  }

  private readonly onDown = (p: Phaser.Input.Pointer): void => {
    if (this.closing || this.dead) return;
    this.armed = true;
    const l = this.local(p);
    const inWin = this.inPlate(l) && l.x >= GRAVE.winX && l.x < GRAVE.winX + WIN_W && l.y >= GRAVE.cardTop - 6 && l.y < GRAVE.cardTop + GRAVE.cardH;
    this.press = { x: p.x, y: p.y, scroll: this.target, drag: false, inWin };
  };

  private readonly onMove = (p: Phaser.Input.Pointer): void => {
    if (this.closing || this.dead) return;
    const l = this.local(p);
    const pr = this.press;
    if (pr && p.isDown && pr.inWin && this.n > GRAVE.visible) {
      if (!pr.drag && Math.abs(p.x - pr.x) >= DRAG_PX) pr.drag = true;
      if (pr.drag) {
        this.target = clampScroll(pr.scroll - Math.round(p.x - pr.x), this.n);
        this.scroll = this.target;
        this.setHover(-1);
        return;
      }
    }
    const a = this.arrowAt(l);
    if (a !== this.arrowHot) this.arrowHot = a;
    const i = this.inPlate(l) && this.allLanded() ? slotAt(l.x, l.y, this.scroll, this.n) : -1;
    this.setHover(i);
  };

  private readonly onUp = (p: Phaser.Input.Pointer): void => {
    if (this.closing || this.dead) return;
    const pr = this.press;
    this.press = null;
    // a release without a press since the panel opened (the click that opened it) is not an answer
    if (!this.armed) return;
    if (p.rightButtonReleased()) {
      this.close();
      return;
    }
    if (pr?.drag) {
      this.target = snapScroll(this.scroll, this.n);
      return;
    }
    const l = this.local(p);
    if (!this.inPlate(l)) {
      this.close();
      return;
    }
    if (this.overClose(p)) return; // the button answers itself
    const a = this.arrowAt(l);
    if (a >= 0) return this.scrollBy(a === 0 ? -1 : 1);
    const i = slotAt(l.x, l.y, this.scroll, this.n);
    if (i >= 0) {
      this.kbFocus = i;
      this.togglePin(i);
    }
  };

  private readonly onWheel = (_p: Phaser.Input.Pointer, _over: unknown, dx: number, dy: number): void => {
    if (this.closing || this.dead || this.n <= GRAVE.visible) return;
    this.wheelAcc += Math.abs(dy) >= Math.abs(dx) ? dy : dx;
    // one card per notch (a mouse wheel's 100; a trackpad's small deltas add up)
    if (Math.abs(this.wheelAcc) < 40) return;
    const s = Math.sign(this.wheelAcc);
    const k = Math.max(1, Math.min(3, Math.round(Math.abs(this.wheelAcc) / 100)));
    this.wheelAcc = 0;
    this.scrollBy(s * k);
  };

  private onKey(e: KeyboardEvent): boolean {
    if (this.dead) return false;
    if (this.closing) return e.key === 'Escape' || e.key === 'Enter' || e.key.toLowerCase() === 'm';
    if (e.key === 'Escape' || e.key === 'm' || e.key === 'M') {
      if (!e.repeat) this.close();
      return true;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (!this.n) return true;
      const f = moveFocus(this.hot, e.key === 'ArrowLeft' ? -1 : 1, this.n);
      this.hover = -1;
      if (f !== this.kbFocus) ui3CardSfx('ui3Hover', { volume: 0.4, pitch: Math.pow(2, LADDER[f % LADDER.length] / 12) }, 'uiHover', { volume: 0.35 });
      this.kbFocus = f;
      const t = scrollToShow(f, this.target, this.n);
      if (t !== this.target) this.target = t;
      this.inspect();
      return true;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      if (!e.repeat && this.hot >= 0) this.togglePin(this.hot);
      return true;
    }
    return false;
  }

  private allLanded(): boolean {
    return this.cards.every((c) => c.landed);
  }

  // ================================================================ open / close

  /** Start the close (idempotent). */
  close(): void {
    if (this.closing || this.dead) return;
    this.closingAt = this.el;
    ui3CardSfx('ui3PanelClose', { volume: 0.7, pan: this.panOf(this.R.x + this.pileLocal.x) }, 'uiBack', { volume: 0.5 });
    this.plate.setNode(false);
    if (this.pinned < 0) this.views.inspect.hide();
    void this.light?.fadeOut(GRAVE.closeMs);
    this.light = null;
    if (this.strip.mask) this.strip.clearMask(false);
    // the cards in the window (and any still in flight) go down as one deck; the rest go at once
    const vis: ShelfCard[] = [];
    this.cards.forEach((c, i) => {
      c.index.setVisible(false);
      const shown = c.landed ? inWindow(i, this.scroll, this.n) && (c.card.visible || !!c.ghost?.visible) : c.card.visible;
      if (!shown) {
        c.card.setVisible(false);
        c.ghost?.setVisible(false);
        return;
      }
      c.card.setRim(null);
      vis.push(c);
    });
    // the leftmost (newest) card is the deck's top: drawn last
    const ordered = [...vis].reverse();
    for (const c of ordered) this.strip.bringToTop(c.card);
    this.closingCards = ordered;
    this.closingFrom = ordered.map((c) => ({ x: c.card.x, y: c.card.y }));
    this.stackPoint = this.closingFrom[this.closingFrom.length - 1] ?? { x: 0, y: 0 };
    // the pile in the strip's space (the strip keeps its scroll offset)
    this.pileStrip = { x: this.pileLocal.x + this.scroll, y: this.pileLocal.y };
    this.tickClose(0);
  }

  private pileStrip: XY = { x: 0, y: 0 };
  private stackPoint: XY = { x: 0, y: 0 };

  /** Gone: every object destroyed, the waiters resolved. */
  private finish(): void {
    if (this.dead) return;
    this.dead = true;
    this.releaseKeys?.();
    this.releaseKeys = null;
    const s = this.scene;
    s.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown);
    s.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove);
    s.input.off(Phaser.Input.Events.POINTER_UP, this.onUp);
    s.input.off(Phaser.Input.Events.POINTER_WHEEL, this.onWheel);
    s.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    s.events.off(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown);
    this.light?.destroy();
    this.light = null;
    for (const c of this.cards) c.index.destroy();
    if (this.cardsRoot.active) this.cardsRoot.destroy();
    this.maskG?.destroy();
    this.plate.destroy();
    if (this.fold.active) this.fold.destroy();
    if (this.blocker.active) this.blocker.destroy();
    if (panels.get(s) === this) panels.delete(s);
    if (qaPanel === this) qaPanel = null;
    try {
      this.onClose?.();
    } catch (e) {
      console.error('[grave panel] onClose', e);
    }
    this.onClose = undefined;
    this.resolveDone();
  }

  private readonly onShutdown = (): void => this.finish();

  // ================================================================ helpers

  /** Card i's centre on screen (QA), or null when it is not wholly in the window. */
  cardScreenXY(i: number): XY | null {
    if (this.dead || this.closing || i < 0 || i >= this.n || !inWindow(i, this.target, this.n)) return null;
    const s = slotXY(i, this.n);
    return { x: this.R.x + s.x - this.target, y: this.R.y + s.y };
  }

  private worldToScreen(p: XY): XY {
    const cam = this.views.camera.main;
    return { x: Math.round((p.x - cam.worldView.x) * cam.zoom), y: Math.round((p.y - cam.worldView.y) * cam.zoom) };
  }

  private panOf(x: number): number {
    return Math.max(-0.6, Math.min(0.6, ((x - GAME_W / 2) / (GAME_W / 2)) * 0.6));
  }

  private foldKey(h: number, step: number): string {
    return canvasTexture(this.scene, `ui3:grave:fold:${this.style}:${GRAVE.w}x${h}:${step}`, () => foldedPlate(GRAVE.w, h, this.style, step));
  }
}

// ================================================================ the frozen entry points (S-9)

/** Open `player`'s graveyard panel; resolves when it has closed again. Lane A6-A off: nothing opens. */
export async function openGravePanel(scene: Phaser.Scene, views: DuelViews, player: PlayerId, opts: GravePanelOpts = {}): Promise<void> {
  if (!V3_A6_A) {
    opts.onClose?.();
    return;
  }
  const open = panels.get(scene);
  if (open) {
    // one panel at a time: a second open waits for the first to close
    await open.done;
    opts.onClose?.();
    return;
  }
  const p = new GravePanelView(scene, views, player, opts);
  panels.set(scene, p);
  qaPanel = p;
  await p.done;
}

/** Is a graveyard panel open (or still closing) in `scene`? */
export function gravePanelOpen(scene: Phaser.Scene): boolean {
  return panels.has(scene);
}

/** Resolves when the open panel (if any) has closed. */
export function whenGravePanelClosed(scene: Phaser.Scene): Promise<void> {
  const p = panels.get(scene);
  return p ? p.done : Promise.resolve();
}

/** Close the open panel (if any) with its closing beat; resolves when it is gone. */
export function closeGravePanel(scene: Phaser.Scene): Promise<void> {
  const p = panels.get(scene);
  if (!p) return Promise.resolve();
  p.close();
  return p.done;
}

export { PITCH as GRAVE_PITCH };
