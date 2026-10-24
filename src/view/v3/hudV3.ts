// HudV3 — the v3 HUD (docs/v3/A6_PLAN.md F10, lane A6-B step B0; V3_A6_B only). Same public API,
// layout, sizes and hit areas as HudView (layout.ts UI, v1 geometry) — `new HudView(…)` hands this
// class out under V3_A6_B — but every part speaks the card / plate frame language of contract S-1
// (src/art/frame-v3.ts, painters in ./hudSkin.ts): dark two-band bodies, a 1-px ink outline, one 1-px
// trim; text and icons in exact palette tones; no bevel, gradient, dither, alpha fade or ADD glow.
//
//   LP panels      the owner's trim (P1 cyan, P2 crimson), one tone up on the active panel, where a
//                  light node runs the trim (2.4 s lap); "OYUNCU n" in the owner's tone; white LP
//                  digits; a flat LP bar in an ink frame; today's count glyphs re-toned
//   LP change      only the trim lights (2 frames white, then crimson / leaf 120 ms); no panel fill,
//                  no chip; the digits roll exactly as long as v1's (same resolve time: callers'
//                  timings stay identical); the odometer comes with B2 (F3)
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
import { Odometer } from './odometer';
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
  trim: TrimGfx;
  name: PalText;
  lpText: PalText;
  lpY: number;
  bar: Phaser.GameObjects.Graphics;
  chip: Phaser.GameObjects.Image;
  chipX: number;
  counts: Record<Kind, CountV3>;
  active: boolean;
  lp: number;
  shownLp: number;
  barLp: number;
  ghostLp: number;
  ghostColor: number;
  /** The digits' tone while an LP change plays (null = the resting tone). */
  rollTone: number | null;
  rollTween: Phaser.Tweens.Tween | null;
  ghostTween: Phaser.Tweens.Tween | null;
  shakeTween: Phaser.Tweens.Tween | null;
  /** A trim override (LP flash, flashPanel) and its sequence number (a newer one cancels it). */
  trimOverride: Trim | null;
  trimSeq: number;
  /** Danger pulse (LP ≤ 1000): one palette step every 600 ms. */
  danger: Phaser.Time.TimerEvent | null;
  dangerHi: boolean;
}

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
    this.phaseRoot.add(scene.add.image(0, 0, barKey).setOrigin(0));
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
    this.turnRoot.add(scene.add.image(0, 0, badgeKey).setOrigin(0));
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
   * Set a player's LP. Animated: only the panel's trim lights (2 frames white, then crimson / leaf
   * for 120 ms), the digits roll (crimson / leaf while rolling), the bar's lost slice shows white
   * then crimson and drains; a loss shakes the panel 1–3 whole pixels. Resolves exactly when v1's
   * setLp would (roll + 140 ms), so every caller's timing is unchanged.
   */
  async setLp(player: PlayerId, value: number, animate = true, o: { maxMs?: number } = {}): Promise<void> {
    const P = this.panels[player];
    value = Math.max(0, Math.round(value));
    const from = P.shownLp;
    const delta = value - P.lp;
    P.lp = value;
    P.rollTween?.stop();
    P.rollTween = null;
    if (!animate || value === from) {
      P.shownLp = value;
      P.barLp = value;
      P.ghostLp = value;
      P.rollTone = null;
      P.ghostTween?.stop();
      this.renderLp(P);
      this.drawBar(P);
      return;
    }
    const loss = value < from;
    const amount = Math.abs(delta || value - from);
    // the same durations as v1 (o.maxMs: the v3 LP roll cap, ≤ 400 ms)
    const cap = o.maxMs;
    const base = Math.min(1100, Math.max(420, 320 + amount * 0.32));
    const ms = cap !== undefined ? Math.min(cap, base) : base;
    const ghostDelay = cap !== undefined ? Math.min(320, Math.round(cap * 0.3)) : 320;
    const ghostMs = cap !== undefined ? Math.max(60, Math.min(420, cap - ghostDelay)) : 420;
    sfx.play(loss ? 'lpDown' : 'lpUp');
    // F10 / F3: only the trim lights — 2 frames white, then the change's tone for 120 ms
    this.trimFlash(P, loss ? { light: PAL.crim4, dark: PAL.crim3 } : { light: PAL.leaf4, dark: PAL.leaf3 }, 120);
    if (loss) this.shakePanel(P, amount >= 1500 ? 3 : amount >= 500 ? 2 : 1, 120);

    // LP bar: loss → fill drops now, the lost slice white for 2 frames then crimson, drains after a
    // beat; gain → the new slice leads in leaf, the fill grows with the digits
    P.ghostTween?.stop();
    if (loss) {
      P.ghostLp = Math.max(P.ghostLp, from);
      P.barLp = value;
      P.ghostColor = PAL.white;
      this.drawBar(P);
      this.scene.time.delayedCall(2 * FRAME_MS, () => {
        // crimson; on P2's crimson bar one tone lighter, so the lost slice still reads
        P.ghostColor = P.player === 0 ? PAL.crim3 : PAL.crim4;
        this.drawBar(P);
      });
      const g = { v: P.ghostLp };
      P.ghostTween = this.scene.tweens.add({
        targets: g,
        v: value,
        delay: ghostDelay,
        duration: ghostMs,
        ease: 'Quad.In',
        onUpdate: () => {
          P.ghostLp = g.v;
          this.drawBar(P);
        },
      });
    } else {
      P.ghostLp = value;
      P.ghostColor = PAL.leaf3;
      this.drawBar(P);
    }

    // digits: a white frame, then the change's tone while rolling
    P.rollTone = PAL.white;
    this.renderLp(P);
    this.scene.time.delayedCall(50, () => {
      if (P.rollTween) {
        P.rollTone = loss ? PAL.crim3 : PAL.leaf3;
        this.renderLp(P);
      }
    });
    let lastTick = -1e9;
    let lastShown = from;
    const roll = { v: from };
    await new Promise<void>((resolve) => {
      P.rollTween = this.scene.tweens.add({
        targets: roll,
        v: value,
        duration: ms,
        ease: 'Cubic.Out',
        onUpdate: (tw) => {
          const v = Math.round(roll.v);
          P.shownLp = v;
          if (!loss) P.barLp = Math.min(value, v);
          if (v !== lastShown) {
            lastShown = v;
            this.renderLp(P);
            if (!loss) this.drawBar(P);
            const now = tw.elapsed;
            if (now - lastTick > 48) {
              lastTick = now;
              sfx.play('lpTick', { volume: 0.35, pitch: loss ? 0.9 + 0.2 * (1 - tw.progress) : 1 + 0.3 * tw.progress });
            }
          }
        },
        onComplete: () => resolve(),
        onStop: () => resolve(),
      });
    });
    if (P.lp !== value) return; // superseded by a newer call
    P.rollTween = null;
    P.shownLp = value;
    P.barLp = value;
    if (!loss) P.ghostLp = value;
    // landing: one tone up for 60 ms, the digits 1 px up and back (whole pixels; v1's 140 ms punch)
    P.rollTone = loss ? PAL.crim4 : PAL.leaf4;
    this.renderLp(P);
    this.drawBar(P);
    this.scene.time.delayedCall(60, () => {
      if (P.rollTween) return;
      P.rollTone = null;
      this.renderLp(P);
    });
    const y0 = P.lpY;
    await run(this.scene, 140, (k) => {
      if (!P.lpText.root.active) return;
      P.lpText.setPosition(P.lpText.x, REDUCED_MOTION || k >= 0.5 ? y0 : y0 - 1);
    });
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
    return { x: P.rect.x + HUD3.lp.x + Math.round(P.lpText.width / 2), y: P.rect.y + HUD3.lp.cap + 7 };
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

  setVisible(b: boolean): void {
    this.visible = b;
    for (const o of this.objects) o.setVisible(b);
    this.hintRoot.setVisible(b && this.hintKey !== '');
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.updateFn);
    for (const t of this.timers) t.remove();
    this.pillTween?.stop();
    this.turnOdo.destroy();
    this.hintWiggle?.stop();
    for (const P of this.panels) {
      P.rollTween?.stop();
      P.ghostTween?.stop();
      P.shakeTween?.stop();
      P.danger?.remove();
      P.trim.destroy();
    }
    this.hideTip();
    for (const o of this.objects) o.destroy();
    this.objects.length = 0;
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
    const root = this.track(sc.add.container(rect.x, rect.y).setDepth(DEPTH.HUD).setScrollFactor(0));
    root.add(sc.add.image(0, 0, canvasTexture(sc, `ui3:hud:panel:${player}`, () => panelBodyV3(player))).setOrigin(0));
    const trim = new TrimGfx(sc, root, 0, 0, w, h);
    const name = new PalText(sc, HUD3.name.x, capYV3('md', HUD3.name.cap), PLAYER_NAME[player], { size: 'md', color: styleTone(st, 0) });
    const lpY = capYV3('lg', HUD3.lp.cap);
    const lpText = new PalText(sc, HUD3.lp.x, lpY, String(lp), { size: 'lg', color: PAL.white });
    const bar = sc.add.graphics();
    root.add([name.root, lpText.root, bar]);
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
      trim,
      name,
      lpText,
      lpY,
      bar,
      chip,
      chipX,
      counts,
      active: false,
      lp,
      shownLp: lp,
      barLp: lp,
      ghostLp: lp,
      ghostColor: PAL.crim3,
      rollTone: null,
      rollTween: null,
      ghostTween: null,
      shakeTween: null,
      trimOverride: null,
      trimSeq: 0,
      danger: null,
      dangerHi: false,
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

  /** The LP digits: the change's tone while rolling, else white / a crimson pulse at ≤ 1000 / crim2 at 0. */
  private renderLp(P: PanelV3): void {
    P.lpText.setText(String(P.shownLp));
    const danger = P.lp > 0 && P.lp <= 1000;
    if (danger && !P.danger) {
      P.danger = this.scene.time.addEvent({
        delay: 600,
        loop: true,
        callback: () => {
          P.dangerHi = !P.dangerHi;
          if (P.rollTone === null) P.lpText.setColor(P.dangerHi ? PAL.crim4 : PAL.crim3);
        },
      });
    } else if (!danger && P.danger) {
      P.danger.remove();
      P.danger = null;
      P.dangerHi = false;
    }
    if (P.rollTone !== null) P.lpText.setColor(P.rollTone);
    else if (P.lp === 0) P.lpText.setColor(PAL.crim2);
    else if (danger) P.lpText.setColor(P.dangerHi ? PAL.crim4 : PAL.crim3);
    else P.lpText.setColor(PAL.white);
  }

  /** LP bar: 1-px ink frame, night1 track with quarter ticks, flat owner-tone fill, its lead pixel one tone up. */
  private drawBar(P: PanelV3): void {
    const g = P.bar;
    const R = this.rampOf(P.player);
    const { x, y, w, h } = HUD3.bar;
    const k = (v: number) => Math.max(0, Math.min(w, Math.round((Math.min(v, START_LP) / START_LP) * w)));
    const fill = k(P.barLp);
    const ghost = k(P.ghostLp);
    g.clear();
    g.fillStyle(PAL.ink, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(PAL.night1, 1).fillRect(x, y, w, h);
    g.fillStyle(PAL.night3, 1);
    for (let i = 1; i < 4; i++) g.fillRect(x + Math.round((w * i) / 4), y, 1, h);
    if (ghost > fill) g.fillStyle(P.ghostColor, 1).fillRect(x + fill, y, ghost - fill, h);
    if (fill > 0) {
      const danger = P.lp <= 1000;
      g.fillStyle(danger ? PAL.crim3 : R[3], 1).fillRect(x, y, fill, h);
      g.fillStyle(danger ? PAL.crim4 : R[4], 1).fillRect(x + fill - 1, y, 1, h);
    }
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
