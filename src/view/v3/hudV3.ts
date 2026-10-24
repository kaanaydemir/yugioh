// HudV3 — the v3 HUD (docs/v3/A6_PLAN.md F10, lane A6-B step B0; V3_A6_B only). Same public API,
// layout, sizes and hit areas as HudView (layout.ts UI, v1 geometry) — `new HudView(…)` hands this
// class out under V3_A6_B — but every part speaks the card / plate frame language of contract S-1
// (src/art/frame-v3.ts, painters in ./hudSkin.ts): dark two-band bodies, a 1-px ink outline, one 1-px
// trim; text and icons in exact palette tones; no bevel, gradient, dither, alpha fade or ADD glow.
//
//   LP panels      the owner's trim (P1 cyan, P2 crimson), one tone up on the active panel, where a
//                  light node runs the trim (2.4 s lap); "OYUNCU n" in the owner's tone; white LP
//                  digits; a flat LP bar in an ink frame; today's count glyphs re-toned
//   LP number      a mechanical counter (./odometer.ts LpCounter, F3 / B2): every digit on its own
//                  wheel behind its own window (1-px frame, cut corners, ink inside; four windows at
//                  least, a leading zero dim)
//   LP change      (F3) only the trim lights (2 frames white, then crimson / leaf 120 ms) — no panel
//                  fill, no chip; a loss shakes the panel 1–2 px (3 px from 1500) for 120 ms; the
//                  counter COUNTS (≤ 360 ms: the finest wheel clicks digit by digit, the upper ones
//                  turn on the carry; a tick per click, ≥ 34 ms apart) in the change's tone, its last
//                  wheel lands white for a frame; the bar: a loss leaves the lost slice white for 2
//                  frames, then crimson, eroding in 4-px steps (140–340 ms); a gain fills the new
//                  slice in 4-px steps in leaf with a 1-px white lead and 3 pixels rising off it.
//                  setLp still resolves when today's would (callers' timings stay identical)
//   low LP         (< 1000, F3) the digits rest crimson and pulse one tone up every 1200 ms; the bar's
//                  remaining slice blinks slowly (600 ms); with reduced motion both hold still
//   phase bar      neutral trim; mist cells, the active cell a pill framed in the turn player's tone;
//                  the pill moves on whole pixels (1-px pull-back, slide, 1-px overshoot — 2 px into
//                  SAVAŞ —, settle; F2, B1); the SAVAŞ cell fills crimson in two steps while the
//                  battle lasts and fades back in two steps; a soft tick (ui3Phase) at 30 ms
//   turn badge     "TUR n": the number is an odometer (./odometer.ts); during a turn start it is HELD
//                  (holdTurn) until the turn plate lands in the badge (landTurn: one digit rolls, B1)
//   buttons        Button's v3 skin (SAVAŞ crim, TURU BİTİR teal, toolbar neutral)
//   hint line      a dark plate with a neutral trim, appearing in two palette steps
// Every motion is on whole pixels, on the scene clock (speed / hit-stop); REDUCED_MOTION stops the
// light node and drops the shakes (KO-9). Sounds: the ui3 family where B1 placed it (ui3Sfx: today's
// sound stands in while A6-A's recipe is still A56.0's silent skeleton), else today's.

import Phaser from 'phaser';
import { PAL, RAMPS, type Ramp } from '../../art/palette';
import type { Trim } from '../../art/frame-v3';
import { sfx } from '../../audio/sfx';
import type { Phase, PlayerId } from '../../engine/types';
import { START_LP } from '../../engine/types';
import { Button } from '../Button';
import { UI_FLOW_RECIPES, type UiFlowSfxName } from '../../audio/v3/ui-flow';
import type { SfxName, SfxOpts } from '../../audio/sfx';
import { LP_WHEELS, LpCounter, Odometer } from './odometer';
import type { HudCountKind, HudCounts, HudOpts, HudView, SpeedLevel } from '../HudView';
import { DEPTH, UI, panelRect, type Rect, type XY } from '../layout';
import { ICON, type UiStyle } from '../ui-textures';
import { REDUCED_MOTION, overshootCurve, settle } from './motion';
import {
  HUD3,
  PalText,
  TrimGfx,
  canvasTexture,
  capYV3,
  chipV3,
  flatTrim,
  iconTexture,
  iconTones,
  menuIconV3,
  panelBodyV3,
  playerStyleV3,
  plateBodyV3,
  styleTone,
  styleTrim,
  textWidthV3,
  type TrimNode,
} from './hudSkin';

/** HudView's public surface (fields, methods, getters): HudV3 must offer all of it. */
export type HudApi = { [K in keyof HudView]: HudView[K] };

/**
 * Play a ui3 flow sound (KO-7, placed by lane A6-B). While its recipe is still the A56.0 skeleton
 * (silent `play() {}` — lane A6-A writes the family in A7), today's `fallback` plays instead, so no
 * beat goes silent in between. A recipe that makes sound takes the voice: play.length ≥ 1.
 */
export function ui3Sfx(name: UiFlowSfxName, opts: SfxOpts = {}, fallback: SfxName | null = null, fallbackOpts: SfxOpts = opts): void {
  if (ui3Ready(name)) sfx.play(name, opts);
  else if (fallback) sfx.play(fallback, fallbackOpts);
}

/** The ui3 flow recipe `name` has been written (it takes the voice), i.e. it is no longer A56.0's silent skeleton. */
export function ui3Ready(name: UiFlowSfxName): boolean {
  const r = UI_FLOW_RECIPES[name] as { play: (...a: unknown[]) => void } | undefined;
  return !!r && r.play.length >= 1;
}

/** The SAVAŞ cell's fill steps (F2: two steps in, two steps out). */
const BATTLE_FILL = [PAL.crim0, PAL.crim1] as const;

/**
 * F0 (hudIn, lane A6-B step B-open): how the HUD arrives instead of appearing in one frame. Each piece
 * comes from its own screen edge — `dx` / `dy` is where it starts, toward that edge — `stagger` ms after
 * the one before, sliding `slideMs` on whole pixels with a 1-px overshoot. Total 3 × 40 + 120 = 240 ms
 * (A6_MS.hudIn: 160–240, never locks the input).
 */
export const HUD_ARRIVAL = Object.freeze({
  stagger: 40,
  slideMs: 120,
  overshoot: 1,
  /** P1's panel from the bottom left, P2's from the top right, the bar from the top, the buttons from the right. */
  p1: Object.freeze({ dx: -12, dy: 12 }),
  p2: Object.freeze({ dx: 12, dy: -12 }),
  top: Object.freeze({ dx: 0, dy: -12 }),
  buttons: Object.freeze({ dx: 16, dy: 0 }),
  /** 'wake' (skipIntro, the HUD already on screen): one white trim frame, then one tone up until this ms. */
  wakeUpMs: 50,
});

/** 'slide': the opening's HUD arrival (hidden before); 'wake': the HUD is already up (skipIntro). */
export type ArrivalMode = 'slide' | 'wake';

interface ArrivalPiece {
  /** What moves together, and where it rests. */
  objs: { o: { x: number; y: number; setVisible(b: boolean): unknown }; x: number; y: number }[];
  dx: number;
  dy: number;
  delay: number;
  /** 0 = the trim alone (the frame lights first), 1 = the body with the trim one tone up, 2 = all, at rest. */
  stage(s: 0 | 1 | 2): void;
  /** 'wake': one white trim frame, then one tone up; null = back to rest. */
  wake(w: 'white' | 'up' | null): void;
  /** The stage / wake step shown (−1 = not started). */
  shown: number;
}

const PHASES: Phase[] = ['draw', 'main', 'battle', 'end'];
const PHASE_LABEL_V3: Record<Phase, string> = { draw: 'ÇEKME', main: 'ANA', battle: 'SAVAŞ', end: 'BİTİŞ' };
const PLAYER_NAME: Record<PlayerId, string> = { 0: 'OYUNCU 1', 1: 'OYUNCU 2' };
const FRAME_MS = 1000 / 60;

type Kind = HudCountKind;

interface CountV3 {
  icon: Phaser.GameObjects.Image;
  text: PalText;
  value: number;
  baseY: number;
  at: XY;
  tone: number;
}

interface PanelV3 {
  player: PlayerId;
  rect: Rect;
  root: Phaser.GameObjects.Container;
  /** The panel body (outline + bands): the arrival's second frame (F0 hudIn). */
  body: Phaser.GameObjects.Image;
  trim: TrimGfx;
  name: PalText;
  /** The LP number: a mechanical counter (F3). */
  counter: LpCounter;
  bar: Phaser.GameObjects.Graphics;
  chip: Phaser.GameObjects.Image;
  chipX: number;
  counts: Record<Kind, CountV3>;
  active: boolean;
  /** The LP (the last setLp's value). */
  lp: number;
  /** The bar's fill (LP; during a gain it follows the count), the lost slice's end and its start (LP). */
  barLp: number;
  ghostLp: number;
  ghostTop: number;
  ghostColor: number;
  /** A gain in progress: the LP its leaf slice starts at (null = none); its lead pixel white. */
  gainFrom: number | null;
  leadWhite: boolean;
  /** The pixels rising off a gaining bar (panel coordinates, tone). */
  sparks: { x: number; y: number; c: number }[];
  /** The digits' tone while an LP change plays (null = the resting tone). */
  rollTone: number | null;
  /** The newest setLp (an older one's landing steps aside). */
  lpSeq: number;
  /** The bar's running jobs (erosion, gain fill). */
  barTweens: Phaser.Tweens.Tween[];
  shakeTween: Phaser.Tweens.Tween | null;
  /** A trim override (LP flash, flashPanel) and its sequence number (a newer one cancels it). */
  trimOverride: Trim | null;
  trimSeq: number;
  /** Low LP (< 1000, F3): a 600-ms beat — the digits pulse one tone up on every other beat, the bar blinks. */
  low: Phaser.Time.TimerEvent | null;
  lowPulse: boolean;
  lowDim: boolean;
}

/**
 * The LP panels' depth: above today's panelGlow setpiece (vfx/setpieces.ts — the lumen_sprite gain
 * delivery, the volt_lizard burn, burnFly; files outside lane B), which paints an ADD fill over the
 * panel rect at DEPTH.HUD + 4.5 and its outline raster at + 5: the opaque v3 panel hides the fill
 * (F3: no panel fill; only the trim lights), while the effects that fly INTO the panel (+ 6 and up)
 * and the numbers (+ 20) stay above it.
 */
export const PANEL_DEPTH = DEPTH.HUD + 5.5;

/** Low LP (F3): above 0 and under 1000. */
export function isLowLp(lp: number): boolean {
  return lp > 0 && lp < 1000;
}

/** The LP change timings (F3, ms at 1×; LpCounter rolls ≤ 360). */
export const LP_V3 = Object.freeze({
  /** The trim: 2 white frames, then the change's tone this long. */
  trimMs: 120,
  /** A loss shakes the panel this long: 1 px, 2 px from 500, 3 px from 1500. */
  shakeMs: 120,
  /** The digits stay white for two frames before they take the change's tone. */
  whiteMs: 34,
  /** The lost slice erodes in 4-px steps from erodeAt for erodeMs. */
  erodeAt: 140,
  erodeMs: 200,
  barStep: 4,
  /** After the landing the digits hold one tone up this long, then rest. */
  landMs: 60,
  /** Ticks at least this far apart (real ms: at 2× / 3× the tick stream thins). */
  tickGapMs: 34,
  /** Low LP: the beat (the digits pulse on every other beat for pulseMs; the bar blinks every beat). */
  lowBeatMs: 600,
  lowPulseMs: 150,
  /** The 3 pixels rising off a gaining bar: where on the new slice (0–1), how far, how fast. */
  sparkAt: Object.freeze([0.2, 0.5, 0.8]),
  sparkRise: 4,
  sparkStepMs: 34,
});

/** A counter tween on the scene clock (speed / hit-stop): fn(k) for k 0 → 1 over ms; resolves at the end. */
function run(scene: Phaser.Scene, ms: number, fn: (k: number) => void, track?: (t: Phaser.Tweens.Tween) => void): Promise<void> {
  return new Promise((resolve) => {
    fn(0);
    if (ms <= 0) {
      fn(1);
      resolve();
      return;
    }
    const t = scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: ms,
      onUpdate: (tw) => fn(tw.getValue() ?? 0),
      onComplete: () => {
        fn(1);
        resolve();
      },
      onStop: () => resolve(),
    });
    track?.(t);
  });
}

export class HudV3 implements HudApi {
  onBattle: (() => void) | null = null;
  onEndTurn: (() => void) | null = null;
  onSpeed: ((k: SpeedLevel) => void) | null = null;
  onSound: ((muted: boolean) => void) | null = null;
  onLog: (() => void) | null = null;
  onMenu: (() => void) | null = null;
  onBattleBlocked: (() => void) | null = null;
  onEndTurnBlocked: (() => void) | null = null;

  readonly battleButton: Button;
  readonly endTurnButton: Button;
  readonly menuButton: Button;
  private readonly scene: Phaser.Scene;
  private readonly panels: [PanelV3, PanelV3];
  private readonly objects: { setVisible(b: boolean): unknown; destroy(): void }[] = [];
  private activePlayer: PlayerId;
  private phase: Phase;
  private phasePlayer: PlayerId;
  private turn: number;
  private speed: SpeedLevel;
  // phase bar
  private readonly phaseRoot: Phaser.GameObjects.Container;
  private readonly phaseBody: Phaser.GameObjects.Image;
  private readonly phaseTrim: TrimGfx;
  private readonly pill: Phaser.GameObjects.Graphics;
  private readonly phaseLabels: PalText[] = [];
  private pillX = 0;
  private pillRamp: Ramp = RAMPS.cyan;
  private pillFlash = false;
  private pillTween: Phaser.Tweens.Tween | null = null;
  private labelFlash = -1;
  /** The SAVAŞ cell's fill tone (null = not filled) and the job stepping it. */
  private battleTone: number | null = null;
  private battleFillSeq = 0;
  // turn badge
  private readonly turnRoot: Phaser.GameObjects.Container;
  private readonly turnBody: Phaser.GameObjects.Image;
  private readonly turnTrim: TrimGfx;
  private readonly turnOdo: Odometer;
  /** While a turn plate carries the new number, setTurn only records it (landTurn shows it). */
  private turnHeld = false;
  private turnPending: number | null = null;
  // toolbar
  private readonly speedButton: Button;
  private readonly soundButton: Button;
  private readonly logButton: Button;
  // hint line
  private readonly hintRoot: Phaser.GameObjects.Container;
  private hintBase: { text: string; style: UiStyle } | null = null;
  private hintKey = '';
  private hintSeq = 0;
  private hintTrim: TrimGfx | null = null;
  private hintText_: PalText | null = null;
  private hintCaret: Phaser.GameObjects.Image | null = null;
  private hintBody: Phaser.GameObjects.Image | null = null;
  private hintWiggle: Phaser.Tweens.Tween | null = null;
  /** Real milliseconds left on a flashed hint (not scaled by the animation speed, as v1). */
  private hintFlashLeft = 0;
  private tip: { owner: Button; root: Phaser.GameObjects.Container; trim: TrimGfx; text: PalText; timer: Phaser.Time.TimerEvent } | null = null;
  private soundOn = !sfx.isMuted();
  private readonly updateFn: (t: number, dt: number) => void;
  private readonly timers: Phaser.Time.TimerEvent[] = [];
  private caretPhase = 0;
  /** Scene-clock ms for the hint caret's one-pixel step. */
  private caretT = 0;
  private visible = true;
  private destroyed = false;
  /** F0 (hudIn): the running arrival and the child visibility it borrowed (restored at its end). */
  private arrival: { tween: Phaser.Tweens.Tween | null; pieces: ArrivalPiece[]; mode: ArrivalMode } | null = null;
  private arrived = false;
  private readonly borrowed = new Map<Phaser.GameObjects.Container, Map<Phaser.GameObjects.GameObject & { visible: boolean; setVisible(b: boolean): unknown }, boolean>>();

  constructor(scene: Phaser.Scene, opts: HudOpts = {}) {
    this.scene = scene;
    this.activePlayer = opts.active ?? 0;
    this.phase = opts.phase ?? 'main';
    this.phasePlayer = this.activePlayer;
    this.turn = opts.turn ?? 1;
    this.speed = opts.speed ?? 1;
    const lp = opts.lp ?? [START_LP, START_LP];

    this.panels = [this.buildPanel(0, lp[0]), this.buildPanel(1, lp[1])];

    // ---- phase bar (neutral plate, separators, the pill under the labels)
    const pb = UI.phaseBar;
    const P = HUD3.phase;
    this.phaseRoot = this.track(scene.add.container(pb.x, pb.y).setDepth(DEPTH.HUD).setScrollFactor(0));
    const barKey = canvasTexture(scene, `ui3:hud:phasebar:${pb.w}x${pb.h}`, () => {
      const p = plateBodyV3(pb.w, pb.h);
      for (let i = 1; i < 4; i++) {
        const x = this.segX(i) - 1;
        p.set(x, P.sepY, PAL.night4).hline(x - 1, x + 1, P.sepY + 1, PAL.night4).set(x, P.sepY + 2, PAL.night4);
        p.set(x, P.sepY + 1, PAL.steel);
      }
      return p;
    });
    this.phaseBody = scene.add.image(0, 0, barKey).setOrigin(0);
    this.phaseRoot.add(this.phaseBody);
    this.phaseTrim = new TrimGfx(scene, this.phaseRoot, 0, 0, pb.w, pb.h).set(styleTrim('neutral'));
    this.pill = scene.add.graphics();
    this.phaseRoot.add(this.pill);
    PHASES.forEach((ph, i) => {
      const w = textWidthV3(PHASE_LABEL_V3[ph], 'md');
      const cx = this.segX(i) + P.segW / 2;
      const t = new PalText(scene, Math.round(cx - w / 2), capYV3('md', P.cap), PHASE_LABEL_V3[ph], { size: 'md', color: PAL.mist });
      this.phaseLabels.push(t);
      this.phaseRoot.add(t.root);
    });
    this.pillRamp = this.phase === 'battle' ? RAMPS.crim : this.rampOf(this.phasePlayer);
    this.pillX = this.pillHome(PHASES.indexOf(this.phase));
    this.battleTone = this.phase === 'battle' ? BATTLE_FILL[1] : null; // a duel staged in its battle phase
    this.drawPill();
    this.refreshPhaseLabels();

    // ---- turn badge (left of the phase bar)
    const T = HUD3.turn;
    this.turnRoot = this.track(scene.add.container(pb.x + T.dx, pb.y).setDepth(DEPTH.HUD).setScrollFactor(0));
    const badgeKey = canvasTexture(scene, `ui3:hud:turnbadge:${T.w}x${T.h}`, () => plateBodyV3(T.w, T.h));
    this.turnBody = scene.add.image(0, 0, badgeKey).setOrigin(0);
    this.turnRoot.add(this.turnBody);
    this.turnTrim = new TrimGfx(scene, this.turnRoot, 0, 0, T.w, T.h).set(styleTrim('neutral'));
    const tur = new PalText(scene, T.labelX, capYV3('sm', T.labelCap), 'TUR', { size: 'sm', color: PAL.mist });
    this.turnRoot.add(tur.root);
    // the number: an odometer whose window is the badge's inside (the rows between the trims)
    const numY = capYV3('md', T.numCap);
    this.turnOdo = new Odometer(scene, this.turnRoot, T.numCx, numY, this.turn, { size: 'md', color: PAL.white, align: 'center', clip: [2 - numY, T.h - 2 - numY] });

    // ---- main buttons (Button's v3 skin: SAVAŞ crim, TURU BİTİR teal — F10)
    const b = UI.buttons;
    const M = HUD3.mainBtn;
    this.battleButton = this.track(
      new Button(scene, b.x, b.y + M.y1, { w: b.w, h: M.h, label: 'SAVAŞ', icon: ICON.swords, style: 'fire', depth: DEPTH.HUD, onClick: () => this.onBattle?.() }),
    );
    this.endTurnButton = this.track(
      new Button(scene, b.x, b.y + M.y2, { w: b.w, h: M.h, label: 'TURU BİTİR', icon: ICON.endTurn, style: 'spell', depth: DEPTH.HUD, onClick: () => this.onEndTurn?.() }),
    );
    this.battleButton.setScrollFactor(0);
    this.endTurnButton.setScrollFactor(0);
    this.battleButton.onBlocked = () => this.onBattleBlocked?.();
    this.endTurnButton.onBlocked = () => this.onEndTurnBlocked?.();

    // ---- toolbar (top-left; neutral trim)
    const TB = HUD3.toolbar;
    this.speedButton = this.track(
      new Button(scene, 4, TB.y, { w: 32, h: TB.h, label: `${this.speed}×`, icon: ICON.speed, size: 'sm', depth: DEPTH.HUD, onClick: () => this.cycleSpeed() }),
    );
    this.soundButton = this.track(
      new Button(scene, 38, TB.y, { w: 19, h: TB.h, icon: sfx.isMuted() ? ICON.soundOff : ICON.soundOn, depth: DEPTH.HUD, onClick: () => this.toggleSound() }),
    );
    this.logButton = this.track(new Button(scene, 59, TB.y, { w: 17, h: TB.h, icon: ICON.log, depth: DEPTH.HUD, onClick: () => this.onLog?.() }));
    const menuSrc = canvasTexture(scene, 'ui3:icon:menu:src', () => menuIconV3({ w: PAL.white, m: PAL.mist, s: PAL.steel, n: PAL.night3 }));
    this.menuButton = this.track(new Button(scene, 78, TB.y, { w: 17, h: TB.h, icon: menuSrc, depth: DEPTH.HUD, onClick: () => this.onMenu?.() }));
    for (const btn of [this.speedButton, this.soundButton, this.logButton, this.menuButton]) btn.setScrollFactor(0);
    const tips: [Button, () => string][] = [
      [this.speedButton, () => `Animasyon hızı: ${this.speed}× (tıkla: değiştir)`],
      [this.soundButton, () => (this.soundOn ? 'Sesi kapat' : 'Sesi aç')],
      [this.logButton, () => 'Savaş günlüğü'],
      [this.menuButton, () => 'Düello menüsü (Esc)'],
    ];
    for (const [btn, text] of tips) btn.onHover = (on) => (on ? this.showTip(btn, text()) : this.hideTip(btn));

    // ---- guidance line (above the hand)
    this.hintRoot = this.track(scene.add.container(HUD3.hint.cx, HUD3.hint.y).setDepth(DEPTH.HUD + 4).setScrollFactor(0).setVisible(false));

    this.setActive(this.activePlayer, false);
    // the SIRA chip's caret steps one pixel every 380 ms (v1: a sine tween)
    this.timers.push(
      scene.time.addEvent({
        delay: 380,
        loop: true,
        callback: () => {
          this.caretPhase ^= 1;
          for (const Pn of this.panels) Pn.chip.setTexture(this.chipKey(Pn.player));
        },
      }),
    );
    this.updateFn = (_t, dt) => this.tick(dt);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.updateFn);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  // ================================================================ public API (HudView's)

  getLp(player: PlayerId): number {
    return this.panels[player].lp;
  }

  /**
   * Set a player's LP (F3). Animated: the panel's trim lights (2 frames white, then crimson / leaf for
   * 120 ms; no fill), a loss shakes the panel 1–3 whole pixels for 120 ms, the counter COUNTS
   * (LpCounter.count, ≤ 360 ms, in the change's tone after two white frames; a tick per click, ≥ 34 ms
   * apart; its last wheel lands white for one frame, then the digits hold one tone up for 60 ms), the
   * bar takes the change in 4-px steps (a loss: the lost slice white for 2 frames, then crimson, eroding
   * 140–340 ms; a gain: the new slice fills with the count in leaf behind a 1-px white lead, 3 pixels
   * rising off it). All on the scene clock (speed / hit-stop). The promise still resolves when v1's
   * setLp would (roll + 140 ms; maxMs 400 → 540 ms), so no caller's timing moves; a newer call counts
   * on from the number shown.
   */
  async setLp(player: PlayerId, value: number, animate = true, o: { maxMs?: number } = {}): Promise<void> {
    const P = this.panels[player];
    value = Math.max(0, Math.round(value));
    const from = P.counter.halt();
    const delta = value - P.lp;
    P.lp = value;
    const seq = ++P.lpSeq;
    this.stopBar(P);
    if (!animate || value === from || this.destroyed) {
      P.counter.set(value);
      P.barLp = value;
      P.ghostLp = value;
      P.ghostTop = value;
      P.gainFrom = null;
      P.leadWhite = false;
      P.rollTone = null;
      P.counter.setUnitTone(null);
      this.renderLp(P);
      this.drawBar(P);
      return;
    }
    const loss = value < from;
    const amount = Math.abs(delta || value - from);
    // v1's resolve time (o.maxMs: the v3 LP roll cap, 400 ms): every caller keeps its timing
    const cap = o.maxMs;
    const base = Math.min(1100, Math.max(420, 320 + amount * 0.32));
    const resolveMs = (cap !== undefined ? Math.min(cap, base) : base) + 140;
    // the edge (0–34 ms): only the trim — 2 white frames, then the change's tone; a loss shakes
    ui3Sfx(loss ? 'ui3LpLoss' : 'ui3LpGain', {}, loss ? 'lpDown' : 'lpUp');
    this.trimFlash(P, loss ? { light: PAL.crim4, dark: PAL.crim3 } : { light: PAL.leaf4, dark: PAL.leaf3 }, LP_V3.trimMs);
    if (loss) this.shakePanel(P, amount >= 1500 ? 3 : amount >= 500 ? 2 : 1, LP_V3.shakeMs);
    // the digits: white for two frames, then the change's tone while the counter counts
    P.rollTone = PAL.white;
    P.counter.setUnitTone(null);
    this.renderLp(P);
    this.scene.time.delayedCall(LP_V3.whiteMs, () => {
      if (P.lpSeq !== seq || P.rollTone === null) return;
      P.rollTone = loss ? PAL.crim3 : PAL.leaf3;
      this.renderLp(P);
    });
    let lastTick = -1e9;
    void P.counter.count(value, {
      maxMs: cap,
      onLand: () => this.landLp(P, seq, loss),
      onClick: (i, n) => {
        if (P.lpSeq !== seq || this.destroyed) return;
        // one tick per click, at least 34 ms apart in real time (at 2× / 3× the stream thins)
        const now = this.scene.game.loop.time;
        if (now - lastTick < LP_V3.tickGapMs) return;
        lastTick = now;
        const k = n > 1 ? i / n : 1;
        const pitch = loss ? 0.9 + 0.2 * (1 - k) : 1 + 0.3 * k;
        ui3Sfx('ui3LpTick', { pitch }, 'lpTick', { volume: 0.35, pitch });
      },
    });
    // the bar
    if (loss) this.barLoss(P, from, value, seq);
    else this.barGain(P, from, value, seq);
    await run(this.scene, resolveMs, () => undefined);
  }

  /** The counter landed (F3): its last wheel white for one frame, the digits one tone up for 60 ms, then rest. */
  private landLp(P: PanelV3, seq: number, loss: boolean): void {
    if (P.lpSeq !== seq || this.destroyed) return;
    P.rollTone = loss ? PAL.crim4 : PAL.leaf4;
    P.counter.setUnitTone(PAL.white);
    P.leadWhite = false;
    this.renderLp(P);
    this.drawBar(P);
    // (half a frame: the white shows on exactly one rendered frame)
    this.scene.time.delayedCall(FRAME_MS / 2, () => {
      if (P.lpSeq === seq && !this.destroyed) P.counter.setUnitTone(null);
    });
    this.scene.time.delayedCall(LP_V3.landMs, () => {
      if (P.lpSeq !== seq || this.destroyed) return;
      P.rollTone = null;
      P.gainFrom = null;
      this.renderLp(P);
      this.drawBar(P);
    });
  }

  /** The bar on a loss (F3): the fill drops at once; the lost slice white for 2 frames, then crimson; it erodes in 4-px steps. */
  private barLoss(P: PanelV3, from: number, to: number, seq: number): void {
    P.gainFrom = null;
    P.leadWhite = false;
    P.ghostLp = Math.max(P.ghostLp, from);
    P.ghostTop = P.ghostLp;
    P.barLp = to;
    P.ghostColor = PAL.white;
    this.drawBar(P);
    this.scene.time.delayedCall(2 * FRAME_MS, () => {
      if (P.lpSeq !== seq || this.destroyed) return;
      // crimson; on P2's crimson bar one tone lighter, so the lost slice still reads
      P.ghostColor = P.player === 0 ? PAL.crim3 : PAL.crim4;
      this.drawBar(P);
    });
    const g0 = P.ghostLp;
    this.barJob(P, LP_V3.erodeAt, LP_V3.erodeMs, (k) => {
      P.ghostLp = g0 + (to - g0) * k;
      this.drawBar(P);
    });
  }

  /**
   * The bar on a gain (F3): the new slice fills with the count in 4-px steps, leaf behind a 1-px white
   * lead; as the lead passes 20 / 50 / 80 % of the slice a pixel rises off it (4 px in 34-ms steps,
   * leaf4 → leaf3 → leaf2). At the landing the lead goes, 60 ms later the slice takes the owner's tone.
   */
  private barGain(P: PanelV3, from: number, to: number, seq: number): void {
    P.ghostLp = 0;
    P.ghostTop = 0;
    P.gainFrom = from;
    P.barLp = from;
    P.leadWhite = true;
    P.sparks = [];
    const { x, y, w } = HUD3.bar;
    const px = (v: number) => Math.max(0, Math.min(w, Math.round((Math.min(v, START_LP) / START_LP) * w)));
    const p0 = px(from);
    const p1 = px(to);
    const born: number[] = [];
    const S = LP_V3;
    const life = (S.sparkRise + 1) * S.sparkStepMs;
    const dur = LP_WHEELS.rollMs + life;
    this.drawBar(P);
    this.barJob(P, 0, dur, (k) => {
      if (P.lpSeq !== seq) return;
      const t = k * dur;
      P.barLp = P.counter.counting ? P.counter.shown : to;
      const fill = px(P.barLp);
      S.sparkAt.forEach((at, i) => {
        if (born[i] === undefined && p1 > p0 && fill >= p0 + Math.round((p1 - p0) * at)) born[i] = t;
      });
      P.sparks = [];
      born.forEach((b, i) => {
        if (b === undefined) return;
        const age = t - b;
        if (age >= life || REDUCED_MOTION) return;
        const step = Math.floor(age / S.sparkStepMs);
        const sx = x + p0 + Math.round((p1 - p0) * S.sparkAt[i]) - 1;
        const c = step < 2 ? PAL.leaf4 : step < 4 ? PAL.leaf3 : PAL.leaf2;
        P.sparks.push({ x: sx, y: y - 2 - Math.min(S.sparkRise, step), c });
      });
      this.drawBar(P);
    });
  }

  /** A bar job on the scene clock (stopped by the next LP change). */
  private barJob(P: PanelV3, delay: number, ms: number, fn: (k: number) => void): void {
    const t = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      delay,
      duration: Math.max(1, ms),
      onUpdate: (tw) => fn(tw.getValue() ?? 0),
      onComplete: () => fn(1),
    });
    P.barTweens.push(t);
  }

  private stopBar(P: PanelV3): void {
    for (const t of P.barTweens) t.stop();
    P.barTweens = [];
    if (P.sparks.length) P.sparks = [];
  }

  /** Deck / hand / graveyard counters: a changed number takes one tone (gold4 up) for 70 ms; the glyph hops 2 px. */
  setCounts(player: PlayerId, counts: HudCounts, animate = true): void {
    const P = this.panels[player];
    for (const k of ['deck', 'hand', 'grave'] as Kind[]) {
      const v = counts[k];
      if (v === undefined) continue;
      const c = P.counts[k];
      if (c.value === v) continue;
      const up = v > c.value;
      c.value = v;
      c.text.setText(String(v));
      const rest = k === 'deck' && v <= 3 ? PAL.crim3 : PAL.white;
      c.text.setColor(rest);
      if (!animate) continue;
      c.text.setColor(up ? PAL.gold4 : PAL.white);
      this.scene.time.delayedCall(70, () => c.text.root.active && c.text.setColor(k === 'deck' && c.value <= 3 ? PAL.crim3 : PAL.white));
      this.scene.tweens.killTweensOf(c.icon);
      if (REDUCED_MOTION) continue;
      void run(this.scene, 160, (q) => {
        if (c.icon.active) c.icon.y = settle(c.baseY - 2, c.baseY, q);
      });
    }
  }

  /** The active player's panel: trim one tone up, its light node runs, the SIRA chip; the other rests. */
  setActive(player: PlayerId, animate = true): void {
    this.activePlayer = player;
    for (const P of this.panels) {
      const on = P.player === player;
      const was = P.active;
      P.active = on;
      const st = playerStyleV3(P.player);
      P.name.setColor(on ? styleTone(st, 1) : styleTone(st, 0));
      // the light node starts its lap when the panel becomes active (a repeated call keeps it running)
      if (on !== was || on !== P.trim.running) P.trim.setNode(on ? this.panelNode(P.player) : null);
      if (on && animate && !was) this.trimFlash(P, null, 0);
      else this.applyTrim(P);
      if (on) {
        P.chip.setVisible(true);
        if (animate && !was && !REDUCED_MOTION) {
          void run(this.scene, 120, (k) => {
            if (P.chip.active) P.chip.x = settle(P.chipX + 4, P.chipX, k);
          });
        } else P.chip.x = P.chipX;
      } else P.chip.setVisible(false);
    }
    // the phase pill takes the turn player's tone (battle stays crimson)
    if (this.phase !== 'battle') {
      this.phasePlayer = player;
      this.pillRamp = this.rampOf(player);
      this.drawPill();
      this.refreshPhaseLabels();
    }
  }

  /**
   * Move the phase pill to `phase` on whole pixels (F2: 1-px pull-back 0–30 ms, slide with a 1-px
   * overshoot, settle by 150 ms); the new cell's label shows white for one frame, then its tone.
   */
  async setPhase(phase: Phase, player: PlayerId = this.activePlayer, animate = true): Promise<void> {
    const from = PHASES.indexOf(this.phase);
    const to = PHASES.indexOf(phase);
    const wasBattle = this.phase === 'battle';
    this.phase = phase;
    // the SAVAŞ cell: fills crimson in two steps as the battle starts, fades back in two as it ends
    if (phase === 'battle' && (!wasBattle || this.battleTone === null)) this.stepBattleFill(true, animate);
    else if (phase !== 'battle' && (wasBattle || this.battleTone !== null)) this.stepBattleFill(false, animate);
    this.phasePlayer = player;
    this.pillRamp = phase === 'battle' ? RAMPS.crim : this.rampOf(player);
    this.pillTween?.stop();
    this.pillTween = null;
    const x1 = this.pillHome(to);
    if (!animate) {
      this.pillX = x1;
      this.drawPill();
      this.refreshPhaseLabels();
      return;
    }
    // the soft tick at 30 ms (F2: ui3Phase) on the scene clock (speed / hit-stop aware); the battle
    // beat brings its own sound (ui3Battle)
    if (phase !== 'battle') this.scene.time.delayedCall(30, () => !this.destroyed && ui3Sfx('ui3Phase', {}, 'phaseChange', { volume: 0.6 }));
    const x0 = this.pillX;
    const dir = Math.sign(x1 - x0);
    this.labelFlash = -1;
    this.refreshPhaseLabels(true);
    if (x0 !== x1 && !REDUCED_MOTION) {
      // 1-px pull-back (0–30 ms), slide with a 1-px overshoot (2 px into SAVAŞ), settled by 150 ms
      const curve = overshootCurve(phase === 'battle' ? 2 : 1);
      await run(
        this.scene,
        150,
        (k) => {
          const ms = k * 150;
          this.pillX = ms < 30 ? x0 - dir : curve(x0 - dir, x1, (ms - 30) / 120);
          this.drawPill();
        },
        (t) => (this.pillTween = t),
      );
    }
    if (this.phase !== phase) return; // superseded
    this.pillTween = null;
    this.pillX = x1;
    this.pillFlash = true;
    this.labelFlash = to;
    this.drawPill();
    this.refreshPhaseLabels();
    await run(this.scene, FRAME_MS, () => undefined);
    if (this.phase !== phase) return;
    this.pillFlash = false;
    this.labelFlash = -1;
    this.drawPill();
    this.refreshPhaseLabels();
  }

  get currentPhase(): Phase {
    return this.phase;
  }

  /**
   * Turn counter. While held (a turn plate carries the number: holdTurn) the value is only recorded
   * and landTurn() shows it; otherwise the changed digit rolls (animate) or the number is set.
   */
  setTurn(turn: number, animate = true): void {
    if (this.destroyed) return;
    if (this.turnHeld) {
      this.turnPending = turn;
      return;
    }
    if (turn === this.turn) return;
    this.turn = turn;
    if (animate) void this.turnOdo.roll(turn, { ms: 140 });
    else this.turnOdo.set(turn);
  }

  /** A turn plate now carries the next number: setTurn() waits for landTurn() (F1, B1). */
  holdTurn(): void {
    this.turnHeld = true;
  }

  /** The turn plate landed in the badge: release the hold and roll the badge to its number. */
  landTurn(animate = true): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    const held = this.turnHeld;
    this.turnHeld = false;
    const t = this.turnPending;
    this.turnPending = null;
    if (!held || t === null || t === this.turn) return Promise.resolve();
    this.turn = t;
    if (!animate) {
      this.turnOdo.set(t);
      return Promise.resolve();
    }
    return this.turnOdo.roll(t, { ms: 140 });
  }

  /** The number the badge will show (the held one while a plate carries it). */
  get turnShown(): number {
    return this.turn;
  }

  /** The turn badge's rect (screen px): where the turn plate lands. */
  turnBadgeRect(): Rect {
    const pb = UI.phaseBar;
    return { x: pb.x + HUD3.turn.dx, y: pb.y, w: HUD3.turn.w, h: HUD3.turn.h };
  }

  /**
   * The rect whose trim row is the phase pill's frame over `phase`'s cell (screen px): the target of
   * the battle plate's last hop (its 1-px white trim lands exactly on the pill's frame).
   */
  phasePillRect(phase: Phase): Rect {
    const pb = UI.phaseBar;
    const i = PHASES.indexOf(phase);
    return { x: pb.x + this.pillHome(i) - 1, y: pb.y + HUD3.phase.pillY - 1, w: HUD3.phase.segW - 2 + 2, h: HUD3.phase.pillH + 2 };
  }

  setButtons(state: { battle?: boolean; endTurn?: boolean; attention?: 'battle' | 'endTurn' | null }): void {
    if (state.battle !== undefined) this.battleButton.setEnabled(state.battle);
    if (state.endTurn !== undefined) this.endTurnButton.setEnabled(state.endTurn);
    if (state.attention !== undefined) {
      this.battleButton.setAttention(state.attention === 'battle');
      this.endTurnButton.setAttention(state.attention === 'endTurn');
    }
  }

  setLocked(b: boolean): void {
    for (const btn of [this.battleButton, this.endTurnButton]) btn.setLocked(b);
  }

  setSpeed(k: SpeedLevel): void {
    this.speed = k;
    this.speedButton.setLabel(`${k}×`);
  }

  get speedLevel(): SpeedLevel {
    return this.speed;
  }

  setHint(text: string | null, o: { player?: PlayerId; style?: UiStyle } = {}): void {
    const style = o.style ?? (o.player !== undefined ? playerStyleV3(o.player) : 'neutral');
    this.hintBase = text ? { text, style } : null;
    if (this.hintFlashLeft > 0) return; // a flash is showing; it falls back to the new base line
    this.renderHint(this.hintBase, false);
  }

  flashHint(text: string, o: { style?: UiStyle; ms?: number } = {}): void {
    this.renderHint({ text, style: o.style ?? 'fire' }, true);
    this.hintFlashLeft = o.ms ?? 2400;
  }

  get hintText(): string {
    return this.hintKey.split('|').slice(1).join('|');
  }

  setSoundOn(on: boolean): void {
    this.soundOn = on;
    this.soundButton.setIcon(on ? ICON.soundOn : ICON.soundOff);
  }

  setPlayerName(player: PlayerId, name: string): void {
    this.panels[player].name.setText(name);
  }

  lpXY(player: PlayerId): XY {
    const P = this.panels[player];
    return { x: P.rect.x + HUD3.lpCounter.x + Math.round(P.counter.width / 2), y: P.rect.y + HUD3.lp.cap + 7 };
  }

  panelXY(player: PlayerId): XY {
    const r = panelRect(player);
    return { x: r.x + Math.round(r.w / 2), y: r.y + Math.round(r.h / 2) };
  }

  countXY(player: PlayerId, kind: Kind): XY {
    const P = this.panels[player];
    const c = P.counts[kind];
    return { x: P.rect.x + c.at.x, y: P.rect.y + c.at.y };
  }

  /** An effect landing on a panel: its trim takes `color` (2 frames white first), never a fill. */
  flashPanel(player: PlayerId, color: number, _alpha = 0.7, ms = 320): Promise<void> {
    const P = this.panels[player];
    this.trimFlash(P, flatTrim(color), Math.min(ms, 240));
    return run(this.scene, ms, () => undefined);
  }

  /** Shake a panel on whole pixels (at most 3 px, 160 ms; none with reduced motion). */
  shake(player: PlayerId, px = 3, ms = 320): void {
    this.shakePanel(this.panels[player], Math.min(3, px), Math.min(160, ms));
  }

  /** The HUD is shown (setVisible). */
  get isShown(): boolean {
    return this.visible;
  }

  /**
   * F0 (hudIn): the HUD arrives. 'slide' (the opening, the HUD hidden until now): each piece slides
   * in from its own screen edge on whole pixels (HUD_ARRIVAL), its first frame the trim alone, its
   * second the body with the trim one tone up, then everything at rest. 'wake' (skipIntro: the HUD is
   * already on screen, so nothing moves): each piece's trim flashes white for one frame, then one tone
   * up, in the same order. REDUCED_MOTION: no slide and no stagger, the same two palette steps. Never
   * locks the input. Idempotent: one arrival per HUD; settleArrival() ends it at once.
   */
  arrive(mode: ArrivalMode = 'slide'): void {
    if (this.destroyed || this.arrival || this.arrived) return;
    if (mode === 'slide') this.setVisible(true);
    const A = HUD_ARRIVAL;
    const reduced = REDUCED_MOTION;
    const pieces = this.arrivalPieces();
    // KO-9: no slide and no stagger with reduced motion (the palette steps stay)
    if (reduced) for (const pc of pieces) pc.delay = 0;
    const last = Math.max(...pieces.map((p) => p.delay));
    const total = mode === 'wake' ? last + A.wakeUpMs : reduced ? 2 * FRAME_MS : last + A.slideMs;
    const curve = overshootCurve(A.overshoot);
    const frame = (ms: number) => {
      for (const pc of pieces) {
        const local = ms - pc.delay;
        if (mode === 'wake') {
          const w = local < 0 ? -1 : local < FRAME_MS - 0.5 ? 0 : local < A.wakeUpMs - 0.5 ? 1 : 2;
          if (w !== pc.shown && w >= 0) pc.wake(w === 0 ? 'white' : w === 1 ? 'up' : null);
          pc.shown = w;
          continue;
        }
        if (local < 0) {
          for (const o of pc.objs) o.o.setVisible(false);
          continue;
        }
        const st = reduced ? (local < 2 * FRAME_MS - 0.5 ? 1 : 2) : local < FRAME_MS - 0.5 ? 0 : local < 2 * FRAME_MS - 0.5 ? 1 : 2;
        if (pc.shown < 0) for (const o of pc.objs) o.o.setVisible(this.visible);
        if (st !== pc.shown) pc.stage(st as 0 | 1 | 2);
        pc.shown = st;
        const k = reduced ? 1 : Math.min(1, local / A.slideMs);
        for (const o of pc.objs) {
          o.o.x = pc.dx ? curve(o.x + pc.dx, o.x, k) : o.x;
          o.o.y = pc.dy ? curve(o.y + pc.dy, o.y, k) : o.y;
        }
      }
    };
    const arrival: { tween: Phaser.Tweens.Tween | null; pieces: ArrivalPiece[]; mode: ArrivalMode } = { tween: null, pieces, mode };
    this.arrival = arrival;
    void run(this.scene, total, (k) => frame(k * total), (t) => (arrival.tween = t)).then(() => {
      if (this.arrival === arrival) this.settleArrival();
    });
  }

  /** End a running arrival at once: every piece home, at rest, shown as the HUD is (idempotent). */
  settleArrival(): void {
    const a = this.arrival;
    this.arrived = true;
    if (!a) return;
    this.arrival = null;
    a.tween?.stop();
    for (const pc of a.pieces) {
      for (const o of pc.objs) {
        o.o.x = o.x;
        o.o.y = o.y;
        o.o.setVisible(this.visible);
      }
      if (a.mode === 'wake') pc.wake(null);
      else pc.stage(2);
    }
  }

  setVisible(b: boolean): void {
    this.visible = b;
    for (const o of this.objects) o.setVisible(b);
    this.hintRoot.setVisible(b && this.hintKey !== '');
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.arrival?.tween?.stop();
    this.arrival = null;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.updateFn);
    for (const t of this.timers) t.remove();
    this.pillTween?.stop();
    this.turnOdo.destroy();
    this.hintWiggle?.stop();
    for (const P of this.panels) {
      this.stopBar(P);
      P.counter.destroy();
      P.shakeTween?.stop();
      P.low?.remove();
      P.low = null;
      P.trim.destroy();
    }
    this.hideTip();
    for (const o of this.objects) o.destroy();
    this.objects.length = 0;
  }

  // ================================================================ arrival (F0 hudIn)

  /** The pieces of the arrival in their order (HUD_ARRIVAL): P1 panel, P2 panel, the top bar, the buttons. */
  private arrivalPieces(): ArrivalPiece[] {
    const A = HUD_ARRIVAL;
    const panel = (P: PanelV3, off: { dx: number; dy: number }, delay: number): ArrivalPiece => {
      const st = playerStyleV3(P.player);
      return {
        objs: [{ o: P.root, x: P.rect.x, y: P.rect.y }],
        dx: off.dx,
        dy: off.dy,
        delay,
        shown: -1,
        stage: (s) => {
          this.borrowVisible(P.root, s === 2 ? null : s === 0 ? [P.trim.g] : [P.trim.g, P.body]);
          if (s === 0) P.trim.set(this.restTrim(P));
          else if (s === 1) P.trim.set(styleTrim(st, P.active ? 2 : 1));
          else this.applyTrim(P);
        },
        wake: (w) => P.trim.set(w === 'white' ? flatTrim(PAL.white) : w === 'up' ? styleTrim(st, P.active ? 2 : 1) : (P.trimOverride ?? this.restTrim(P))),
      };
    };
    const pb = UI.phaseBar;
    const T = HUD3.turn;
    const plates: [Phaser.GameObjects.Container, Phaser.GameObjects.Image, TrimGfx][] = [
      [this.phaseRoot, this.phaseBody, this.phaseTrim],
      [this.turnRoot, this.turnBody, this.turnTrim],
    ];
    const toolbar = [this.speedButton, this.soundButton, this.logButton, this.menuButton];
    const top: ArrivalPiece = {
      objs: [
        { o: this.phaseRoot, x: pb.x, y: pb.y },
        { o: this.turnRoot, x: pb.x + T.dx, y: pb.y },
        ...toolbar.map((b) => ({ o: b, x: b.x, y: b.y })),
      ],
      dx: A.top.dx,
      dy: A.top.dy,
      delay: 2 * A.stagger,
      shown: -1,
      stage: (s) => {
        for (const [root, body, trim] of plates) {
          this.borrowVisible(root, s === 2 ? null : s === 0 ? [trim.g] : [trim.g, body]);
          trim.set(styleTrim('neutral', s === 1 ? 1 : 0));
        }
        for (const b of toolbar) b.appearStep(s);
      },
      wake: (w) => {
        for (const [, , trim] of plates) trim.set(w === 'white' ? flatTrim(PAL.white) : styleTrim('neutral', w === 'up' ? 1 : 0));
        for (const b of toolbar) b.wakeStep(w);
      },
    };
    const mains = [this.battleButton, this.endTurnButton];
    const buttons: ArrivalPiece = {
      objs: mains.map((b) => ({ o: b, x: b.x, y: b.y })),
      dx: A.buttons.dx,
      dy: A.buttons.dy,
      delay: 3 * A.stagger,
      shown: -1,
      stage: (s) => {
        for (const b of mains) b.appearStep(s);
      },
      wake: (w) => {
        for (const b of mains) b.wakeStep(w);
      },
    };
    return [panel(this.panels[0], A.p1, 0), panel(this.panels[1], A.p2, A.stagger), top, buttons];
  }

  /**
   * Show only `keep` of a container's children (their own visibility kept), remembering what each
   * child was; null gives every child back its remembered visibility (the arrival's end).
   */
  private borrowVisible(root: Phaser.GameObjects.Container, keep: Phaser.GameObjects.GameObject[] | null): void {
    type Vis = Phaser.GameObjects.GameObject & { visible: boolean; setVisible(b: boolean): unknown };
    let rec = this.borrowed.get(root);
    if (keep === null) {
      if (!rec) return;
      for (const [c, v] of rec) if (c.active) c.setVisible(v);
      this.borrowed.delete(root);
      return;
    }
    if (!rec) {
      rec = new Map();
      for (const c of root.list as Vis[]) rec.set(c, c.visible);
      this.borrowed.set(root, rec);
    }
    for (const [c, v] of rec) if (c.active) c.setVisible(v && keep.includes(c));
  }

  // ================================================================ panels

  private track<T extends { setVisible(b: boolean): unknown; destroy(): void }>(o: T): T {
    this.objects.push(o);
    return o;
  }

  private rampOf(p: PlayerId): Ramp {
    return p === 0 ? RAMPS.cyan : RAMPS.crim;
  }

  private panelNode(p: PlayerId): TrimNode {
    const st = playerStyleV3(p);
    return { head: PAL.white, tail: [PAL.white, styleTone(st, 2)], lapMs: HUD3.nodeLapMs, restMs: HUD3.nodeRestMs };
  }

  private chipKey(p: PlayerId): string {
    const d = this.caretPhase;
    return canvasTexture(this.scene, `ui3:hud:chip:${p}:${d}`, () => chipV3(p, d));
  }

  private buildPanel(player: PlayerId, lp: number): PanelV3 {
    const sc = this.scene;
    const rect = panelRect(player);
    const st = playerStyleV3(player);
    const { w, h } = HUD3.panel;
    const root = this.track(sc.add.container(rect.x, rect.y).setDepth(PANEL_DEPTH).setScrollFactor(0));
    const body = sc.add.image(0, 0, canvasTexture(sc, `ui3:hud:panel:${player}`, () => panelBodyV3(player))).setOrigin(0);
    root.add(body);
    const trim = new TrimGfx(sc, root, 0, 0, w, h);
    const name = new PalText(sc, HUD3.name.x, capYV3('md', HUD3.name.cap), PLAYER_NAME[player], { size: 'md', color: styleTone(st, 0) });
    root.add(name.root);
    // the LP number: a mechanical counter, its glyph boxes where today's digits stood (F3)
    const counter = new LpCounter(sc, root, HUD3.lpCounter.x, capYV3(LP_WHEELS.size, HUD3.lp.cap), lp);
    const bar = sc.add.graphics();
    root.add(bar);
    // counts: today's glyphs re-toned to the owner's ramp, white numbers
    const counts = {} as Record<Kind, CountV3>;
    const groups: [Kind, string, number][] = [
      ['deck', ICON.deck, HUD3.counts.x[0]],
      ['hand', ICON.hand, HUD3.counts.x[1]],
      ['grave', ICON.grave, HUD3.counts.x[2]],
    ];
    const tones = iconTones(st, 0);
    for (const [k, src, x] of groups) {
      const key = iconTexture(sc, src, tones) ?? src;
      const f = sc.textures.getFrame(key);
      const iy = Math.round(HUD3.counts.cy - f.height / 2);
      const icon = sc.add.image(x, iy, key).setOrigin(0);
      const text = new PalText(sc, x + f.width + 3, capYV3('md', HUD3.counts.cy - 3), '0', { size: 'md', color: PAL.white });
      root.add([icon, text.root]);
      counts[k] = { icon, text, value: 0, baseY: iy, at: { x: x + Math.round(f.width / 2), y: iy + Math.round(f.height / 2) }, tone: PAL.white };
    }
    const chipX = w - HUD3.chip.w - HUD3.chip.right;
    const chip = sc.add.image(chipX, HUD3.chip.y, canvasTexture(sc, `ui3:hud:chip:${player}:0`, () => chipV3(player, 0))).setOrigin(0).setVisible(false);
    root.add(chip);
    const P: PanelV3 = {
      player,
      rect,
      root,
      body,
      trim,
      name,
      counter,
      bar,
      chip,
      chipX,
      counts,
      active: false,
      lp,
      barLp: lp,
      ghostLp: lp,
      ghostTop: lp,
      ghostColor: PAL.crim3,
      gainFrom: null,
      leadWhite: false,
      sparks: [],
      rollTone: null,
      lpSeq: 0,
      barTweens: [],
      shakeTween: null,
      trimOverride: null,
      trimSeq: 0,
      low: null,
      lowPulse: false,
      lowDim: false,
    };
    this.applyTrim(P);
    this.renderLp(P);
    this.drawBar(P);
    return P;
  }

  /** The panel's resting trim: the owner's, one tone up while active. */
  private restTrim(P: PanelV3): Trim {
    return styleTrim(playerStyleV3(P.player), P.active ? 1 : 0);
  }

  private applyTrim(P: PanelV3): void {
    P.trim.set(P.trimOverride ?? this.restTrim(P));
  }

  /** 2 frames of white trim, then `tone` for `ms` (null / 0: straight back to rest). */
  private trimFlash(P: PanelV3, tone: Trim | null, ms: number): void {
    const seq = ++P.trimSeq;
    P.trimOverride = flatTrim(PAL.white);
    this.applyTrim(P);
    this.scene.time.delayedCall(2 * FRAME_MS, () => {
      if (P.trimSeq !== seq) return;
      P.trimOverride = tone && ms > 0 ? tone : null;
      this.applyTrim(P);
      if (!P.trimOverride) return;
      this.scene.time.delayedCall(ms, () => {
        if (P.trimSeq !== seq) return;
        P.trimOverride = null;
        this.applyTrim(P);
      });
    });
  }

  /**
   * The counter's tone: the change's while it plays, else white / low LP (< 1000) crimson with a
   * one-tone pulse every other beat (F3) / crim2 at 0. Starts / stops the low-LP beat.
   */
  private renderLp(P: PanelV3): void {
    const low = isLowLp(P.lp);
    if (low && !P.low && !REDUCED_MOTION) {
      P.low = this.scene.time.addEvent({ delay: LP_V3.lowBeatMs, loop: true, callback: () => this.lowBeat(P) });
    } else if (!low && P.low) {
      P.low.remove();
      P.low = null;
      P.lowPulse = false;
      P.lowDim = false;
    }
    const tone = P.rollTone !== null ? P.rollTone : P.lp === 0 ? PAL.crim2 : low ? (P.lowPulse ? PAL.crim4 : PAL.crim3) : PAL.white;
    P.counter.setTone(tone);
  }

  /** Low LP's beat (F3): the bar's slice blinks every beat (600 ms); every other beat the digits pulse one tone up. */
  private lowBeat(P: PanelV3): void {
    if (this.destroyed || !P.low) return;
    P.lowDim = !P.lowDim;
    if (!P.lowDim) {
      P.lowPulse = true;
      this.scene.time.delayedCall(LP_V3.lowPulseMs, () => {
        if (this.destroyed) return;
        P.lowPulse = false;
        this.renderLp(P);
      });
    }
    this.renderLp(P);
    this.drawBar(P);
  }

  /**
   * LP bar: 1-px ink frame, night1 track with quarter ticks, flat owner-tone fill, its lead pixel one
   * tone up (low LP: crimson, blinking crim3 / crim2 on the beat). A lost slice erodes and a gained
   * one fills in 4-px steps (F3); a gain's slice is leaf behind a 1-px white lead; rising pixels.
   */
  private drawBar(P: PanelV3): void {
    const g = P.bar;
    const R = this.rampOf(P.player);
    const { x, y, w, h } = HUD3.bar;
    const S = LP_V3.barStep;
    const k = (v: number) => Math.max(0, Math.min(w, Math.round((Math.min(v, START_LP) / START_LP) * w)));
    let fill = k(P.barLp);
    const gain0 = P.gainFrom !== null ? Math.min(k(P.gainFrom), fill) : fill;
    // a gain fills in 4-px steps (exact once the count has landed)
    if (P.gainFrom !== null && P.barLp !== P.lp) fill = gain0 + S * Math.floor((fill - gain0) / S);
    // a lost slice erodes in 4-px steps, never past where it began
    const lost = k(P.ghostLp) - fill;
    const ghost = lost > 0 ? Math.min(Math.max(k(P.ghostTop), k(P.ghostLp)), fill + S * Math.ceil(lost / S)) : fill;
    g.clear();
    g.fillStyle(PAL.ink, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(PAL.night1, 1).fillRect(x, y, w, h);
    g.fillStyle(PAL.night3, 1);
    for (let i = 1; i < 4; i++) g.fillRect(x + Math.round((w * i) / 4), y, 1, h);
    if (ghost > fill) g.fillStyle(P.ghostColor, 1).fillRect(x + fill, y, ghost - fill, h);
    if (fill > 0) {
      const low = isLowLp(P.lp) || (P.lp === 0 && fill > 0);
      const dim = low && P.lowDim && P.rollTone === null;
      const body = low ? (dim ? PAL.crim2 : PAL.crim3) : R[3];
      const lead = low ? (dim ? PAL.crim3 : PAL.crim4) : R[4];
      if (gain0 > 0) g.fillStyle(body, 1).fillRect(x, y, gain0, h);
      if (fill > gain0) g.fillStyle(PAL.leaf3, 1).fillRect(x + gain0, y, fill - gain0, h);
      g.fillStyle(fill > gain0 ? (P.leadWhite ? PAL.white : PAL.leaf4) : lead, 1).fillRect(x + fill - 1, y, 1, h);
    }
    for (const s of P.sparks) g.fillStyle(s.c, 1).fillRect(s.x, s.y, 1, 1);
  }

  private shakePanel(P: PanelV3, px: number, ms: number): void {
    if (REDUCED_MOTION) return;
    P.shakeTween?.stop();
    const x0 = P.rect.x;
    const y0 = P.rect.y;
    void run(
      this.scene,
      ms,
      (k) => {
        if (!P.root.active) return;
        const a = Math.round(px * (1 - k));
        // whole pixels: right, left, right … shrinking to rest
        const step = Math.floor(k * 6);
        P.root.setPosition(x0 + (a === 0 ? 0 : step % 2 === 0 ? a : -a), y0);
      },
      (t) => (P.shakeTween = t),
    ).then(() => P.root.active && P.root.setPosition(x0, y0));
  }

  // ================================================================ phase bar

  private segX(i: number): number {
    return HUD3.phase.segX0 + i * HUD3.phase.segW;
  }

  /** The pill's left x for cell i (relative to the bar). */
  private pillHome(i: number): number {
    return this.segX(i) + 1;
  }

  /**
   * The active cell's pill: a tab over the bar's full height — its 1-px frame takes the bar's trim
   * rows over the cell (top / left the turn player's light tone, bottom / right one darker; corners
   * cut) — over a night2 inside, so a label's accents and outline never touch the frame.
   */
  private drawPill(): void {
    const g = this.pill;
    g.clear();
    const x = Math.round(this.pillX);
    const y = HUD3.phase.pillY;
    const w = HUD3.phase.segW - 2;
    const h = HUD3.phase.pillH;
    const light = this.pillFlash ? PAL.white : this.pillRamp[3];
    const dark = this.pillFlash ? PAL.white : this.pillRamp[2];
    // the SAVAŞ cell's crimson fill (F2) sits under the pill; in battle the pill's inside shows it
    const bt = this.battleTone;
    if (bt !== null) g.fillStyle(bt, 1).fillRect(this.pillHome(2) + 1, y + 1, w - 2, h - 2);
    g.fillStyle(this.phase === 'battle' && bt !== null ? bt : PAL.night2, 1).fillRect(x + 1, y + 1, w - 2, h - 2);
    g.fillStyle(light, 1);
    g.fillRect(x + 1, y, w - 2, 1);
    g.fillRect(x, y + 1, 1, h - 2);
    g.fillStyle(dark, 1);
    g.fillRect(x + 1, y + h - 1, w - 2, 1);
    g.fillRect(x + w - 1, y + 1, 1, h - 2);
  }

  /** Labels: past cells steel, coming cells mist, the active cell its ramp's light tone (white on its first frame). */
  private refreshPhaseLabels(moving = false): void {
    const idx = PHASES.indexOf(this.phase);
    this.phaseLabels.forEach((t, i) => {
      if (i === idx && !moving) t.setColor(this.labelFlash === i ? PAL.white : this.pillRamp[4]);
      else if (i < idx) t.setColor(PAL.steel);
      else t.setColor(PAL.mist);
    });
  }

  /** Step the SAVAŞ cell's fill in (crim0 → crim1) or out (crim0 → none), one step per 60 ms (F2). */
  private stepBattleFill(on: boolean, animate: boolean): void {
    const seq = ++this.battleFillSeq;
    const steps: (number | null)[] = on ? [BATTLE_FILL[0], BATTLE_FILL[1]] : this.battleTone === null ? [null] : [BATTLE_FILL[0], null];
    if (!animate) {
      this.battleTone = steps[steps.length - 1];
      this.drawPill();
      return;
    }
    this.battleTone = steps[0];
    this.drawPill();
    if (steps.length < 2) return;
    void run(this.scene, 60, () => undefined).then(() => {
      if (seq !== this.battleFillSeq || this.destroyed) return;
      this.battleTone = steps[1];
      this.drawPill();
      this.refreshPhaseLabels(this.pillTween !== null);
    });
  }

  // ================================================================ toolbar

  private cycleSpeed(): void {
    const k = (this.speed === 3 ? 1 : this.speed + 1) as SpeedLevel;
    this.setSpeed(k);
    this.onSpeed?.(k);
    if (this.tip?.owner === this.speedButton) this.showTip(this.speedButton, `Animasyon hızı: ${k}× (tıkla: değiştir)`);
  }

  private toggleSound(): void {
    const on = !this.soundOn;
    if (on) {
      sfx.setMuted(false);
      sfx.setVolume(1);
    } else sfx.setMuted(true);
    this.setSoundOn(on);
    this.onSound?.(!on);
    if (this.tip?.owner === this.soundButton) this.showTip(this.soundButton, on ? 'Sesi kapat' : 'Sesi aç');
  }

  /** Toolbar tooltip: a small neutral plate under the button, shown 150 ms after the hover. */
  private showTip(owner: Button, text: string): void {
    this.hideTip();
    const sc = this.scene;
    const tw = textWidthV3(text, 'sm');
    const w = tw + 10;
    const h = 11;
    const root = sc.add.container(owner.x, owner.y + owner.h + 3).setDepth(DEPTH.HUD + 8).setScrollFactor(0).setVisible(false);
    root.add(sc.add.image(0, 0, canvasTexture(sc, `ui3:hud:tip:${w}x${h}`, () => plateBodyV3(w, h))).setOrigin(0));
    const trim = new TrimGfx(sc, root, 0, 0, w, h).set(styleTrim('neutral'));
    const t = new PalText(sc, 5, capYV3('sm', 3), text, { size: 'sm', color: PAL.white });
    root.add(t.root);
    const timer = sc.time.delayedCall(150, () => root.active && root.setVisible(this.visible));
    this.tip = { owner, root, trim, text: t, timer };
  }

  private hideTip(owner?: Button): void {
    if (!this.tip || (owner && this.tip.owner !== owner)) return;
    const tip = this.tip;
    this.tip = null;
    tip.timer.remove();
    tip.trim.destroy();
    tip.root.destroy();
  }

  // ================================================================ hint line

  /**
   * The guidance plate: a dark plate with a neutral trim (a 'fire' flash: crimson), the caret in
   * the style's tone stepping one pixel, white text (a flash: crim4, a 2-px whole-pixel wiggle).
   * It appears in two palette steps rising 2 → 0 px, and leaves the same way.
   */
  private renderHint(h: { text: string; style: UiStyle } | null, flash: boolean): void {
    const sc = this.scene;
    const root = this.hintRoot;
    if (!root.active) return;
    const key = h ? `${h.style}|${h.text}` : '';
    if (key === this.hintKey && !flash) return;
    this.hintKey = key;
    const seq = ++this.hintSeq;
    this.hintWiggle?.stop();
    this.hintWiggle = null;
    if (!h) {
      // leave: two palette steps, then gone
      const body = this.hintBody;
      if (!body || !body.active) {
        this.clearHint();
        root.setVisible(false);
        return;
      }
      const w = body.width;
      const H = body.height;
      this.hintText_?.setVisible(false);
      this.hintCaret?.setVisible(false);
      body.setTexture(this.hintPlateKey(w, H, -1));
      this.hintTrim?.set(this.hintTrimFor('neutral', -1, false));
      sc.time.delayedCall(2 * FRAME_MS, () => {
        if (seq !== this.hintSeq) return;
        body.setTexture(this.hintPlateKey(w, H, -2));
        this.hintTrim?.set(this.hintTrimFor('neutral', -2, false));
        sc.time.delayedCall(2 * FRAME_MS, () => {
          if (seq !== this.hintSeq) return;
          this.clearHint();
          root.setVisible(false);
        });
      });
      return;
    }
    this.clearHint();
    const H = HUD3.hint.h;
    const tw = textWidthV3(h.text, 'md');
    const w = HUD3.hint.padL + tw + HUD3.hint.padR;
    const x = Math.round(HUD3.hint.cx - w / 2);
    const y = HUD3.hint.y;
    const body = sc.add.image(0, 0, this.hintPlateKey(w, H, -2)).setOrigin(0);
    root.add(body);
    this.hintBody = body;
    this.hintTrim = new TrimGfx(sc, root, 0, 0, w, H).set(this.hintTrimFor(h.style, -2, flash));
    const caretTone = flash ? PAL.crim3 : styleTone(h.style, 1);
    const caretKey = iconTexture(sc, ICON.caret, { w: caretTone, m: caretTone, s: caretTone, n: caretTone }) ?? ICON.caret;
    this.hintCaret = sc.add.image(6, 4, caretKey).setOrigin(0).setVisible(false);
    this.hintText_ = new PalText(sc, HUD3.hint.padL, capYV3('md', 5), h.text, { size: 'md', color: flash ? PAL.crim4 : PAL.white });
    this.hintText_.setVisible(false);
    root.add([this.hintCaret, this.hintText_.root]);
    root.setPosition(x, y + 2).setVisible(this.visible);
    sc.time.delayedCall(2 * FRAME_MS, () => {
      if (seq !== this.hintSeq) return;
      body.setTexture(this.hintPlateKey(w, H, -1));
      this.hintTrim?.set(this.hintTrimFor(h.style, -1, flash));
      root.y = y + 1;
      sc.time.delayedCall(2 * FRAME_MS, () => {
        if (seq !== this.hintSeq) return;
        body.setTexture(this.hintPlateKey(w, H, 0));
        this.hintTrim?.set(this.hintTrimFor(h.style, 0, flash));
        root.y = y;
        this.hintCaret?.setVisible(true);
        this.hintText_?.setVisible(true);
        if (flash && !REDUCED_MOTION) {
          void run(
            sc,
            260,
            (k) => root.active && root.setX(x + Math.round(Math.sin(k * Math.PI * 6) * 2 * (1 - k))),
            (t) => (this.hintWiggle = t),
          ).then(() => root.active && root.setX(x));
        }
      });
    });
  }

  private hintTrimFor(style: UiStyle, step: number, flash: boolean): Trim {
    void style;
    return styleTrim(flash ? 'fire' : 'neutral', step);
  }

  private hintPlateKey(w: number, h: number, step: number): string {
    return canvasTexture(this.scene, `ui3:hud:hint:${w}x${h}:${step}`, () => plateBodyV3(w, h, step));
  }

  private clearHint(): void {
    this.hintTrim?.destroy();
    this.hintTrim = null;
    this.hintText_?.destroy();
    this.hintText_ = null;
    this.hintCaret = null;
    this.hintBody = null;
    this.hintRoot.removeAll(true);
  }

  // ================================================================ per frame

  private tick(dt: number): void {
    if (this.destroyed) return; // destroyed by an earlier 'update' listener of this frame
    if (this.hintFlashLeft > 0) {
      this.hintFlashLeft -= dt; // raw loop time: readable at any animation speed (as v1)
      if (this.hintFlashLeft <= 0) {
        this.hintFlashLeft = 0;
        this.renderHint(this.hintBase, false);
      }
    }
    const k = this.scene.time.timeScale;
    for (const P of this.panels) P.trim.tick(dt * k);
    // the hint caret steps one pixel every 320 ms (scene clock)
    this.caretT += dt * k;
    if (this.hintCaret && this.hintCaret.active && this.hintCaret.visible) this.hintCaret.x = 6 + (REDUCED_MOTION ? 0 : Math.floor(this.caretT / 320) % 2);
  }
}
