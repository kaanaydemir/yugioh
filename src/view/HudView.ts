// HudView — player panels (name, rolling LP + LP bar, deck/hand/graveyard counts, active
// glow), the phase bar with its sliding marker, the turn badge, the main buttons (SAVAŞ /
// TURU BİTİR) and the toolbar (speed 1×/2×/3×, sound, log).
//
//   const hud = new HudView(scene, { active: 0 });
//   hud.onBattle = () => ...; hud.onEndTurn = () => ...;
//   hud.onSpeed = (k) => setSpeed(scene, k);
//   await hud.setLp(1, 2800);                 // rolls 4000 → 2800: red flash, shake, ticks, bar ghost
//   hud.setCounts(0, { deck: 15, hand: 5, grave: 2 });
//   hud.setActive(1);                         // P2 panel lights up (glow, running light, SIRA chip)
//   await hud.setPhase('battle', 1);          // marker inch-worms to SAVAŞ, battle pulse
//   hud.setButtons({ battle: true, endTurn: true });
//   hud.lpXY(1)                               // where damage fireballs / heal sparkles should fly
//   hud.setTurn(4); hud.setLocked(true); hud.flashPanel(1, PAL.fire3); hud.countXY(0, 'grave');
//
// Everything sits at DEPTH.HUD with scrollFactor 0 and follows scene time (speed / hit-stop).

import Phaser from 'phaser';
import { PAL, PLAYER_COLOR, RAMPS, type Ramp } from '../art/palette';
import { mix } from '../art/pixel';
import { sfx } from '../audio/sfx';
import type { Phase, PlayerId } from '../engine/types';
import { START_LP } from '../engine/types';
import { measureText, pixelText, textMetrics, type TextSize } from '../ui/text';
import { TEX, tween, tweenValue } from '../vfx/core';
import { Button } from './Button';
import { DEPTH, UI, type Rect, type XY, panelRect } from './layout';
import {
  GLOW_PAD,
  ICON,
  SHEEN_FRAMES,
  UI_RAMP,
  edgePath,
  emblemTex,
  glowTex,
  haloTex,
  panelSheenTex,
  panelTex,
  playerStyle,
  silTex,
} from './ui-textures';

export type SpeedLevel = 1 | 2 | 3;

export interface HudCounts {
  deck?: number;
  hand?: number;
  grave?: number;
}

export interface HudOpts {
  lp?: [number, number];
  active?: PlayerId;
  phase?: Phase;
  turn?: number;
  speed?: SpeedLevel;
}

const ADD = Phaser.BlendModes.ADD;
const PHASES: Phase[] = ['draw', 'main', 'battle', 'end'];
export const PHASE_LABEL: Record<Phase, string> = { draw: 'ÇEKME', main: 'ANA', battle: 'SAVAŞ', end: 'BİTİŞ' };
const PLAYER_NAME: Record<PlayerId, string> = { 0: 'OYUNCU 1', 1: 'OYUNCU 2' };

/** Text y so that the caps of `size` start at `capTop`. */
function capY(size: TextSize, capTop: number): number {
  return capTop - textMetrics(size).capTop;
}

// panel layout (relative to the panel's top-left)
const PW = 148;
const PH = 64;
const HEADER = 15;
const LP_X = 22;
const LP_CAP = 19;
const BAR = { x: 8, y: 37, w: 132, h: 4 };
const ICON_CY = 50;
/** Images per running light: halo + head + tail. */
const COMET = 14;

type Kind = 'deck' | 'hand' | 'grave';

interface CountUi {
  icon: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.BitmapText;
  value: number;
  baseY: number;
}

interface Panel {
  player: PlayerId;
  rect: Rect;
  root: Phaser.GameObjects.Container;
  lit: Phaser.GameObjects.Image;
  dim: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  flash: Phaser.GameObjects.Image;
  sheen: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.BitmapText;
  lpLabel: Phaser.GameObjects.BitmapText;
  lpText: Phaser.GameObjects.BitmapText;
  bar: Phaser.GameObjects.Graphics;
  chip: Phaser.GameObjects.Container;
  chipCaret: Phaser.GameObjects.Image;
  counts: Record<Kind, CountUi>;
  comets: Phaser.GameObjects.Image[];
  path: XY[];
  cometT: number;
  active: boolean;
  lp: number;
  shownLp: number;
  /** Bar: displayed fill value and ghost value (damage/heal trail). */
  barLp: number;
  ghostLp: number;
  ghostColor: number;
  rollTween: Phaser.Tweens.Tween | null;
  shakeTween: Phaser.Tweens.Tween | null;
  ghostTween: Phaser.Tweens.Tween | null;
  glowTween: Phaser.Tweens.Tween | null;
  dangerTween: Phaser.Tweens.Tween | null;
  lpTint: number;
}

export class HudView {
  onBattle: (() => void) | null = null;
  onEndTurn: (() => void) | null = null;
  onSpeed: ((k: SpeedLevel) => void) | null = null;
  onSound: ((muted: boolean) => void) | null = null;
  onLog: (() => void) | null = null;

  readonly battleButton: Button;
  readonly endTurnButton: Button;
  private readonly scene: Phaser.Scene;
  private readonly panels: [Panel, Panel];
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private activePlayer: PlayerId;
  private phase: Phase;
  private phasePlayer: PlayerId;
  private turn: number;
  private speed: SpeedLevel;
  // phase bar
  private readonly phaseRoot: Phaser.GameObjects.Container;
  private readonly marker: Phaser.GameObjects.Graphics;
  private readonly markerGlow: Phaser.GameObjects.Image;
  private readonly phaseLabels: Phaser.GameObjects.BitmapText[] = [];
  private readonly battlePulse: Phaser.GameObjects.Image;
  private markerL = 0;
  private markerR = 0;
  private markerRamp: Ramp = RAMPS.cyan;
  private markerFlash = 0;
  /** 0..1 position of the idle glint running across the marker (−1 = none). */
  private markerGlint = -1;
  private markerTweens: Phaser.Tweens.Tween[] = [];
  private battleTween: Phaser.Tweens.Tween | null = null;
  // turn badge
  private readonly turnText: Phaser.GameObjects.BitmapText;
  // toolbar
  private readonly speedButton: Button;
  private readonly soundButton: Button;
  private readonly logButton: Button;
  private readonly updateFn: (t: number, dt: number) => void;
  private sheenEvent: Phaser.Time.TimerEvent | null = null;
  private glintEvent: Phaser.Time.TimerEvent | null = null;
  private seed = 0x2545f491;

  constructor(scene: Phaser.Scene, opts: HudOpts = {}) {
    this.scene = scene;
    this.activePlayer = opts.active ?? 0;
    this.phase = opts.phase ?? 'main';
    this.phasePlayer = this.activePlayer;
    this.turn = opts.turn ?? 1;
    this.speed = opts.speed ?? 1;
    const lp = opts.lp ?? [START_LP, START_LP];

    this.panels = [this.buildPanel(0, lp[0]), this.buildPanel(1, lp[1])];

    // ---- phase bar
    const pb = UI.phaseBar;
    this.phaseRoot = this.track(scene.add.container(pb.x, pb.y).setDepth(DEPTH.HUD).setScrollFactor(0));
    this.battlePulse = scene.add
      .image(-GLOW_PAD, -GLOW_PAD, glowTex(scene, pb.w, pb.h))
      .setOrigin(0)
      .setBlendMode(ADD)
      .setTint(PAL.crim3)
      .setAlpha(0);
    const bg = scene.add.image(0, 0, panelTex(scene, 'neutral', pb.w, pb.h, { scan: false })).setOrigin(0);
    this.markerGlow = scene.add.image(0, 0, glowTex(scene, 52, 10, 3, 2)).setOrigin(0).setBlendMode(ADD).setAlpha(0.55);
    this.marker = scene.add.graphics();
    this.phaseRoot.add([this.battlePulse, bg, this.markerGlow, this.marker]);
    const seps = scene.add.graphics();
    for (let i = 1; i < 4; i++) {
      const x = this.segX(i) - 1;
      seps.fillStyle(PAL.night4).fillRect(x, 7, 1, 1).fillRect(x - 1, 8, 3, 1).fillRect(x, 9, 1, 1);
      seps.fillStyle(PAL.steel).fillRect(x, 8, 1, 1);
    }
    this.phaseRoot.add(seps);
    PHASES.forEach((ph, i) => {
      const cx = this.segX(i) + 27;
      const t = pixelText(scene, cx, capY('md', 5), PHASE_LABEL[ph], { size: 'md', color: PAL.steel, originX: 0.5 });
      t.x = Math.round(cx - t.width / 2);
      t.setOrigin(0, 0);
      this.phaseLabels.push(t);
      this.phaseRoot.add(t);
    });
    const i0 = PHASES.indexOf(this.phase);
    this.markerL = this.segX(i0) + 1;
    this.markerR = this.segX(i0) + 53;
    this.markerRamp = this.phase === 'battle' ? RAMPS.fire : UI_RAMP[playerStyle(this.phasePlayer)];
    this.drawMarker();
    this.refreshPhaseLabels();

    // ---- turn badge (left of the phase bar)
    const tb = { x: pb.x - 46, y: pb.y, w: 42, h: 16 };
    const turnRoot = this.track(scene.add.container(tb.x, tb.y).setDepth(DEPTH.HUD).setScrollFactor(0));
    turnRoot.add(scene.add.image(0, 0, panelTex(scene, 'neutral', tb.w, tb.h, { scan: false })).setOrigin(0));
    turnRoot.add(pixelText(scene, 6, capY('sm', 6), 'TUR', { size: 'sm', color: PAL.mist }));
    this.turnText = pixelText(scene, 25, capY('md', 5) + 3, String(this.turn), { size: 'md', color: PAL.white });
    this.turnText.setOrigin(0, 0);
    turnRoot.add(this.turnText);
    this.layoutTurnText();

    // ---- main buttons
    const b = UI.buttons;
    this.battleButton = this.track(
      new Button(scene, b.x, b.y + 1, { w: b.w, h: 25, label: 'SAVAŞ', icon: ICON.swords, style: 'fire', depth: DEPTH.HUD, onClick: () => this.onBattle?.() }),
    );
    this.endTurnButton = this.track(
      new Button(scene, b.x, b.y + 30, {
        w: b.w,
        h: 25,
        label: 'TURU BİTİR',
        icon: ICON.endTurn,
        style: playerStyle(this.activePlayer),
        depth: DEPTH.HUD,
        onClick: () => this.onEndTurn?.(),
      }),
    );
    this.battleButton.setScrollFactor(0);
    this.endTurnButton.setScrollFactor(0);

    // ---- toolbar (top-left)
    this.speedButton = this.track(
      new Button(scene, 4, 4, { w: 32, h: 16, label: `${this.speed}×`, icon: ICON.speed, size: 'sm', depth: DEPTH.HUD, onClick: () => this.cycleSpeed() }),
    );
    this.soundButton = this.track(
      new Button(scene, 38, 4, {
        w: 19,
        h: 16,
        icon: sfx.isMuted() ? ICON.soundOff : ICON.soundOn,
        depth: DEPTH.HUD,
        onClick: () => this.toggleSound(),
      }),
    );
    this.logButton = this.track(new Button(scene, 59, 4, { w: 17, h: 16, icon: ICON.log, depth: DEPTH.HUD, onClick: () => this.onLog?.() }));
    for (const btn of [this.speedButton, this.soundButton, this.logButton]) btn.setScrollFactor(0);

    this.setActive(this.activePlayer, false);
    // idle: a glint runs across the phase marker every few seconds
    this.glintEvent = scene.time.addEvent({
      delay: 3000,
      startAt: 1800,
      loop: true,
      callback: () => {
        const o = { t: 0 };
        scene.tweens.add({
          targets: o,
          t: 1,
          duration: 420,
          ease: 'Sine.InOut',
          onUpdate: () => {
            this.markerGlint = o.t;
            this.drawMarker();
          },
          onComplete: () => {
            this.markerGlint = -1;
            this.drawMarker();
          },
        });
      },
    });


    this.updateFn = (_t, dt) => this.tick(dt);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.updateFn);
    // an occasional light sweep across the active panel keeps the HUD alive
    this.sheenEvent = scene.time.addEvent({ delay: 4600, startAt: 2600, loop: true, callback: () => this.playPanelSheen(this.activePlayer) });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  // ================================================================ public API

  /** Current displayed LP target. */
  getLp(player: PlayerId): number {
    return this.panels[player].lp;
  }

  /**
   * Set a player's LP. Animated: the number rolls with ticks; loss = red flash, shake and a
   * draining ghost on the LP bar plus a floating "-N" chip; gain = green glow, rising
   * sparkles and a "+N" chip. Resolves when the counter lands.
   */
  async setLp(player: PlayerId, value: number, animate = true): Promise<void> {
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
      P.ghostTween?.stop();
      this.renderLp(P);
      this.drawBar(P);
      return;
    }
    const loss = value < from;
    const amount = Math.abs(delta || value - from);
    const ms = Math.min(1100, Math.max(420, 320 + amount * 0.32));
    sfx.play(loss ? 'lpDown' : 'lpUp');
    this.flashPanel(player, loss ? PAL.crim3 : PAL.leaf3, loss ? 0.85 : 0.6, loss ? 340 : 520);
    if (loss) this.shakePanel(P, Math.min(5, 2 + amount / 600), 360);
    this.chip(P, (loss ? '-' : '+') + amount, loss ? PAL.crim3 : PAL.leaf3);
    if (!loss) this.healSparkles(P);

    // LP bar: loss → fill drops now, ghost drains after a beat; gain → ghost leads, fill grows
    P.ghostTween?.stop();
    if (loss) {
      P.ghostLp = Math.max(P.ghostLp, from);
      P.barLp = value;
      P.ghostColor = PAL.white;
      this.drawBar(P);
      this.scene.time.delayedCall(70, () => {
        P.ghostColor = PAL.crim3;
        this.drawBar(P);
      });
      const g = { v: P.ghostLp };
      P.ghostTween = this.scene.tweens.add({
        targets: g,
        v: value,
        delay: 320,
        duration: 420,
        ease: 'Quad.In',
        onUpdate: () => {
          P.ghostLp = g.v;
          this.drawBar(P);
        },
      });
    } else {
      P.ghostLp = value;
      P.ghostColor = PAL.leaf4;
      this.drawBar(P);
    }

    // digits: white flash frame, then colored while rolling
    P.lpText.setTint(PAL.white);
    this.scene.time.delayedCall(50, () => P.lpText.setTint(loss ? PAL.crim3 : PAL.leaf3));
    P.lpText.setScale(1);
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
            P.lpText.setText(String(v));
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
    this.renderLp(P);
    this.drawBar(P);
    // landing punch on the number
    P.lpText.setTint(loss ? PAL.crim4 : PAL.leaf4);
    this.scene.time.delayedCall(60, () => this.renderLp(P));
    await this.punch(P.lpText, 0, -2, 140);
  }

  /** Deck / hand / graveyard counters. Changed numbers pop. */
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
      if (k === 'deck') c.text.setTint(v <= 3 ? PAL.crim3 : PAL.white);
      if (!animate) continue;
      c.text.setTint(up ? PAL.gold4 : PAL.white);
      this.scene.time.delayedCall(70, () => c.text.setTint(k === 'deck' && v <= 3 ? PAL.crim3 : PAL.white));
      this.scene.tweens.killTweensOf(c.icon);
      c.icon.y = c.baseY - 3;
      this.scene.tweens.add({ targets: c.icon, y: c.baseY, duration: 260, ease: 'Bounce.Out' });
    }
  }

  /** Light up the active player's panel (and dim the other). */
  setActive(player: PlayerId, animate = true): void {
    this.activePlayer = player;
    for (const P of this.panels) {
      const on = P.player === player;
      const was = P.active;
      P.active = on;
      const ms = animate ? 260 : 0;
      this.scene.tweens.killTweensOf([P.lit, P.chip]);
      if (ms) this.scene.tweens.add({ targets: P.lit, alpha: on ? 1 : 0, duration: ms });
      else P.lit.setAlpha(on ? 1 : 0);
      const R = UI_RAMP[playerStyle(P.player)];
      P.name.setTint(on ? R[3] : mix(R[2], PAL.steel, 0.4));
      P.glowTween?.stop();
      if (on) {
        P.glow.setAlpha(0.25);
        P.glowTween = this.scene.tweens.add({
          targets: P.glow,
          alpha: { from: 0.25, to: 0.65 },
          duration: 1100,
          ease: 'Sine.InOut',
          yoyo: true,
          repeat: -1,
        });
      } else {
        P.glowTween = this.scene.tweens.add({ targets: P.glow, alpha: 0, duration: ms || 1 });
      }
      for (const c of P.comets) c.setVisible(on);
      // SIRA chip slides in from the right
      if (on) {
        P.chip.setVisible(true);
        if (ms && !was) {
          P.chip.x = PW + 4;
          P.chip.setAlpha(0);
          this.scene.tweens.add({ targets: P.chip, x: P.chip.getData('x'), alpha: 1, duration: 320, ease: 'Back.Out', delay: 120 });
          this.flashPanel(P.player, R[3], 0.45, 380);
          this.playPanelSheen(P.player);
        } else {
          P.chip.x = P.chip.getData('x');
          P.chip.setAlpha(1);
        }
      } else if (ms && was) {
        this.scene.tweens.add({ targets: P.chip, x: PW + 4, alpha: 0, duration: 200, ease: 'Quad.In', onComplete: () => P.chip.setVisible(false) });
      } else P.chip.setVisible(false);
    }
    this.endTurnButton?.setStyle(playerStyle(player));
    // the phase marker takes the turn player's color (battle stays fire)
    if (this.phase !== 'battle' && this.marker) {
      this.phasePlayer = player;
      this.markerRamp = UI_RAMP[playerStyle(player)];
      this.markerFlash = animate ? 1 : 0;
      this.drawMarker();
      if (animate)
        this.scene.tweens.add({ targets: this, markerFlash: 0, duration: 300, ease: 'Quad.Out', onUpdate: () => this.drawMarker() });
    }
  }

  /** Slide the phase marker to `phase` (inch-worm stretch, arrival flash). */
  async setPhase(phase: Phase, player: PlayerId = this.activePlayer, animate = true): Promise<void> {
    const from = PHASES.indexOf(this.phase);
    const to = PHASES.indexOf(phase);
    const samePlayer = player === this.phasePlayer;
    this.phase = phase;
    this.phasePlayer = player;
    const ramp = phase === 'battle' ? RAMPS.fire : UI_RAMP[playerStyle(player)];
    for (const t of this.markerTweens) t.stop();
    this.markerTweens = [];
    const L1 = this.segX(to) + 1;
    const R1 = this.segX(to) + 53;
    this.setBattlePulse(phase === 'battle');
    if (!animate) {
      this.markerRamp = ramp;
      this.markerL = L1;
      this.markerR = R1;
      this.drawMarker();
      this.refreshPhaseLabels();
      return;
    }
    sfx.play('phaseChange', { volume: 0.6 });
    const right = to > from || (to === from && !samePlayer);
    const moving = to !== from;
    // a new turn wraps from BİTİŞ back to ÇEKME: dip out and come back in from the left
    if (to < from) {
      await this.anim([{ k: 'markerR', to: this.markerL + 4, ms: 110, ease: 'Quad.In' }]);
      this.markerL = -30;
      this.markerR = -4;
    }
    this.markerRamp = ramp;
    const lead = right ? 'markerR' : 'markerL';
    const trail = right ? 'markerL' : 'markerR';
    const leadTo = right ? R1 : L1;
    const trailTo = right ? L1 : R1;
    this.refreshPhaseLabels(true);
    if (moving || to < from) {
      this.streaks(right);
      await this.anim([
        { k: lead, to: leadTo, ms: 200, ease: 'Back.Out' },
        { k: trail, to: trailTo, ms: 240, ease: 'Cubic.InOut', delay: 70 },
      ]);
    } else {
      this.markerL = L1;
      this.markerR = R1;
    }
    this.drawMarker();
    // arrival: flash + label pop
    this.markerFlash = 1;
    this.markerTweens.push(
      this.scene.tweens.add({
        targets: this,
        markerFlash: 0,
        duration: 260,
        ease: 'Quad.Out',
        onUpdate: () => this.drawMarker(),
      }),
    );
    this.refreshPhaseLabels();
    const lbl = this.phaseLabels[to];
    const y0 = capY('md', 5);
    lbl.y = y0 - 2;
    lbl.setTint(PAL.white);
    this.scene.time.delayedCall(60, () => this.refreshPhaseLabels());
    this.arrivalSparks(to, ramp);
    await tween(this.scene, { targets: lbl, y: y0, duration: 180, ease: 'Bounce.Out' });
  }

  get currentPhase(): Phase {
    return this.phase;
  }

  /** Turn counter (number flips over). */
  setTurn(turn: number, animate = true): void {
    if (turn === this.turn) return;
    this.turn = turn;
    if (!animate) {
      this.turnText.setText(String(turn));
      this.layoutTurnText();
      return;
    }
    this.scene.tweens.killTweensOf(this.turnText);
    this.scene.tweens.add({
      targets: this.turnText,
      scaleY: 0,
      duration: 90,
      ease: 'Quad.In',
      onComplete: () => {
        this.turnText.setText(String(turn));
        this.layoutTurnText();
        this.turnText.setTint(PAL.gold4);
        this.scene.tweens.add({
          targets: this.turnText,
          scaleY: 1,
          duration: 200,
          ease: 'Back.Out',
          onComplete: () => this.turnText.setTint(PAL.white),
        });
      },
    });
  }

  /** Enable/disable the main buttons. `attention` makes one breathe (suggested action). */
  setButtons(state: { battle?: boolean; endTurn?: boolean; attention?: 'battle' | 'endTurn' | null }): void {
    if (state.battle !== undefined) this.battleButton.setEnabled(state.battle);
    if (state.endTurn !== undefined) this.endTurnButton.setEnabled(state.endTurn);
    if (state.attention !== undefined) {
      this.battleButton.setAttention(state.attention === 'battle');
      this.endTurnButton.setAttention(state.attention === 'endTurn');
    }
  }

  /** Lock all HUD buttons (cinematics) without changing their look. */
  setLocked(b: boolean): void {
    for (const btn of [this.battleButton, this.endTurnButton]) btn.setLocked(b);
  }

  /** Reflect an externally changed speed (e.g. hold-Space fast-forward). */
  setSpeed(k: SpeedLevel): void {
    this.speed = k;
    this.speedButton.setLabel(`${k}×`);
  }

  get speedLevel(): SpeedLevel {
    return this.speed;
  }

  /** Screen point at the center of a player's LP number (effects fly here). */
  lpXY(player: PlayerId): XY {
    const P = this.panels[player];
    return { x: P.rect.x + LP_X + Math.round(P.lpText.width / 2), y: P.rect.y + LP_CAP + 7 };
  }

  /** Center of a player's panel. */
  panelXY(player: PlayerId): XY {
    const r = panelRect(player);
    return { x: r.x + Math.round(r.w / 2), y: r.y + Math.round(r.h / 2) };
  }

  /** Center of a count icon (deck/hand/grave) in a player's panel. */
  countXY(player: PlayerId, kind: Kind): XY {
    const P = this.panels[player];
    const c = P.counts[kind];
    return { x: P.rect.x + c.icon.x + Math.round(c.icon.width / 2), y: P.rect.y + c.baseY + Math.round(c.icon.height / 2) };
  }

  /** Flash a panel with a color (ADD silhouette). For effect hits that land on the panel. */
  flashPanel(player: PlayerId, color: number, alpha = 0.7, ms = 320): Promise<void> {
    const P = this.panels[player];
    this.scene.tweens.killTweensOf(P.flash);
    P.flash.setTint(color).setAlpha(alpha);
    return tween(this.scene, { targets: P.flash, alpha: 0, duration: ms, ease: 'Quad.Out' });
  }

  /** Shake a panel (px amplitude). */
  shake(player: PlayerId, px = 3, ms = 320): void {
    this.shakePanel(this.panels[player], px, ms);
  }

  setVisible(b: boolean): void {
    for (const o of this.objects) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(b);
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.updateFn);
    this.sheenEvent?.remove();
    this.glintEvent?.remove();
    this.battleTween?.stop();
    for (const P of this.panels) {
      P.rollTween?.stop();
      P.glowTween?.stop();
      P.ghostTween?.stop();
      P.dangerTween?.stop();
      P.shakeTween?.stop();
    }
    for (const o of this.objects) o.destroy();
    this.objects.length = 0;
  }

  // ================================================================ panels

  private track<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objects.push(o);
    return o;
  }

  private buildPanel(player: PlayerId, lp: number): Panel {
    const sc = this.scene;
    const rect = panelRect(player);
    const style = playerStyle(player);
    const R = UI_RAMP[style];
    const root = this.track(sc.add.container(rect.x, rect.y).setDepth(DEPTH.HUD).setScrollFactor(0));
    const glow = sc.add
      .image(-GLOW_PAD, -GLOW_PAD, glowTex(sc, PW, PH))
      .setOrigin(0)
      .setBlendMode(ADD)
      .setTint(R[3])
      .setAlpha(0);
    const dim = sc.add.image(0, 0, panelTex(sc, style, PW, PH, { header: HEADER, dim: true })).setOrigin(0);
    const lit = sc.add.image(0, 0, panelTex(sc, style, PW, PH, { header: HEADER })).setOrigin(0).setAlpha(0);
    const sheen = sc.add.image(0, 0, panelSheenTex(sc, PW, PH), 's:0').setOrigin(0).setBlendMode(ADD).setVisible(false).setAlpha(0.55);
    root.add([glow, dim, lit, sheen]);

    const name = pixelText(sc, 8, capY('md', 5), PLAYER_NAME[player], { size: 'md', color: R[3] });
    const lpLabel = pixelText(sc, 8, capY('sm', LP_CAP + 9), 'LP', { size: 'sm', color: PAL.mist });
    const lpText = pixelText(sc, LP_X, capY('lg', LP_CAP), String(lp), { size: 'lg', color: PAL.white });
    const bar = sc.add.graphics();
    const emblem = sc.add.image(PW - 33, 13, emblemTex(sc, player)).setOrigin(0);
    const emblemNum = pixelText(sc, 0, capY('md', 13 + 8), String(player + 1), { size: 'md', color: R[4] });
    emblemNum.x = Math.round(PW - 33 + 12.5 - emblemNum.width / 2);
    root.add([name, lpLabel, lpText, bar, emblem, emblemNum]);

    // count groups
    const counts = {} as Record<Kind, CountUi>;
    const groups: [Kind, string, number][] = [
      ['deck', ICON.deck, 8],
      ['hand', ICON.hand, 54],
      ['grave', ICON.grave, 100],
    ];
    for (const [k, key, x] of groups) {
      const f = sc.textures.getFrame(key);
      const iy = Math.round(ICON_CY - f.height / 2);
      const icon = sc.add.image(x, iy, key).setOrigin(0).setTint(mix(R[4], PAL.white, 0.3));
      const text = pixelText(sc, x + f.width + 3, capY('md', ICON_CY - 3), '0', { size: 'md', color: PAL.white });
      root.add([icon, text]);
      counts[k] = { icon, text, value: 0, baseY: iy };
    }

    // SIRA chip (right end of the header)
    const chip = sc.add.container(0, 0);
    const chipW = 34;
    const chipBg = sc.add.graphics();
    chipBg.fillStyle(PAL.ink).fillRect(1, 0, chipW - 2, 11).fillRect(0, 1, chipW, 9);
    chipBg.fillStyle(R[2]).fillRect(1, 1, chipW - 2, 9);
    chipBg.fillStyle(R[3]).fillRect(1, 1, chipW - 2, 1);
    chipBg.fillStyle(R[1]).fillRect(1, 9, chipW - 2, 1);
    const caret = sc.add.image(4, 2, ICON.caret).setOrigin(0).setScale(1).setTint(PAL.white);
    const chipText = pixelText(sc, 12, capY('sm', 3), 'SIRA', { size: 'sm', color: PAL.white });
    chip.add([chipBg, caret, chipText]);
    const chipX = PW - chipW - 6;
    chip.setData('x', chipX).setPosition(chipX, 2).setVisible(false);
    root.add(chip);

    const flash = sc.add.image(0, 0, silTex(sc, PW, PH)).setOrigin(0).setBlendMode(ADD).setAlpha(0);
    root.add(flash);

    // running lights on the neon edge (active only)
    const path = edgePath(PW, PH);
    const comets: Phaser.GameObjects.Image[] = [];
    for (let c = 0; c < 2; c++)
      for (let i = 0; i < COMET; i++) {
        // [0] halo, [1] plus-shaped head, then a fading 1px tail
        const key = i === 0 ? haloTex(sc, 4) : i === 1 ? TEX.plus : TEX.px1;
        const img = sc.add
          .image(0, 0, key)
          .setOrigin(0.5)
          .setBlendMode(ADD)
          .setTint(i === 0 ? R[3] : i <= 2 ? PAL.white : R[4])
          .setAlpha(i === 0 ? 0.8 : i === 1 ? 1 : 0.95 * (1 - (i - 2) / (COMET - 2)))
          .setVisible(false);
        comets.push(img);
        root.add(img);
      }

    const P: Panel = {
      player,
      rect,
      root,
      lit,
      dim,
      glow,
      flash,
      sheen,
      name,
      lpLabel,
      lpText,
      bar,
      chip,
      chipCaret: caret,
      counts,
      comets,
      path,
      cometT: player === 0 ? 0 : 0.5,
      active: false,
      lp,
      shownLp: lp,
      barLp: lp,
      ghostLp: lp,
      ghostColor: PAL.crim3,
      rollTween: null,
      shakeTween: null,
      ghostTween: null,
      glowTween: null,
      dangerTween: null,
      lpTint: PAL.white,
    };
    this.renderLp(P);
    this.drawBar(P);
    // caret blink
    sc.tweens.add({ targets: caret, x: 5, duration: 380, ease: 'Sine.InOut', yoyo: true, repeat: -1 });
    return P;
  }

  /** Final (resting) look of the LP number: white, or a red danger pulse at ≤ 1000. */
  private renderLp(P: Panel): void {
    P.lpText.setText(String(P.shownLp));
    const danger = P.lp > 0 && P.lp <= 1000;
    if (P.lp === 0) {
      P.dangerTween?.stop();
      P.dangerTween = null;
      P.lpText.setTint(PAL.crim2);
      return;
    }
    if (danger) {
      if (!P.dangerTween) {
        const o = { k: 0 };
        P.dangerTween = this.scene.tweens.add({
          targets: o,
          k: 1,
          duration: 520,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
          onUpdate: () => {
            if (!P.rollTween) P.lpText.setTint(mix(PAL.crim3, PAL.crim4, o.k));
          },
        });
      }
      P.lpText.setTint(PAL.crim3);
    } else {
      P.dangerTween?.stop();
      P.dangerTween = null;
      P.lpText.setTint(PAL.white);
    }
  }

  private drawBar(P: Panel): void {
    const g = P.bar;
    const R = UI_RAMP[playerStyle(P.player)];
    const { x, y, w, h } = BAR;
    const k = (v: number) => Math.max(0, Math.min(w, Math.round((Math.min(v, START_LP) / START_LP) * w)));
    const fill = k(P.barLp);
    const ghost = k(P.ghostLp);
    g.clear();
    g.fillStyle(PAL.ink).fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(PAL.night0).fillRect(x, y, w, h);
    // tick marks every 1000 LP
    g.fillStyle(PAL.night2);
    for (let i = 1; i < 4; i++) g.fillRect(x + Math.round((w * i) / 4), y, 1, h);
    if (ghost > fill) {
      g.fillStyle(P.ghostColor).fillRect(x + fill, y, ghost - fill, h);
      g.fillStyle(mix(P.ghostColor, PAL.white, 0.4)).fillRect(x + fill, y, ghost - fill, 1);
    }
    if (fill > 0) {
      const danger = P.lp <= 1000;
      const a = danger ? PAL.crim2 : R[2];
      const b = danger ? PAL.crim3 : R[3];
      const c = danger ? PAL.crim4 : R[4];
      g.fillStyle(a).fillRect(x, y, fill, h);
      g.fillStyle(b).fillRect(x, y, fill, h - 2);
      g.fillStyle(c).fillRect(x, y, fill, 1);
      g.fillStyle(PAL.white).fillRect(x + fill - 1, y, 1, h - 1);
    }
  }

  private shakePanel(P: Panel, px: number, ms: number): void {
    P.shakeTween?.stop();
    const x0 = P.rect.x;
    const y0 = P.rect.y;
    const o = { t: 0 };
    P.shakeTween = this.scene.tweens.add({
      targets: o,
      t: 1,
      duration: ms,
      onUpdate: () => {
        const k = 1 - o.t;
        P.root.x = x0 + Math.round(Math.sin(o.t * Math.PI * 9) * px * k);
        P.root.y = y0 + Math.round(Math.cos(o.t * Math.PI * 7) * px * 0.4 * k);
      },
      onComplete: () => P.root.setPosition(x0, y0),
      onStop: () => P.root.setPosition(x0, y0),
    });
  }

  /** "-800" / "+500" chip popping out next to the LP number and floating away. */
  private chip(P: Panel, s: string, color: number): void {
    const sc = this.scene;
    const lpW = measureText(String(Math.max(P.shownLp, P.lp)), 'lg').w;
    const w = measureText(s, 'md').w;
    // centered in the gap between the LP number and the emblem
    const gapL = P.rect.x + LP_X + lpW + 3;
    const gapR = P.rect.x + PW - 35;
    const cx = Math.round(Math.max(gapL + w / 2, (gapL + gapR) / 2));
    const cy = P.rect.y + LP_CAP + 7;
    const t = pixelText(sc, cx, cy, s, { size: 'md', color }).setDepth(DEPTH.HUD + 1).setScrollFactor(0);
    t.setOrigin(0.5, 0.5).setTint(PAL.white).setScale(1.3);
    sc.time.delayedCall(70, () => t.active && t.setTint(color));
    sc.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.Out', easeParams: [2.5] });
    sc.tweens.add({ targets: t, y: cy - 10, alpha: 0, delay: 700, duration: 420, ease: 'Quad.In', onComplete: () => t.destroy() });
  }

  private healSparkles(P: Panel): void {
    const sc = this.scene;
    for (let i = 0; i < 22; i++) {
      const x = P.rect.x + 6 + this.rnd() * (PW - 12);
      const y = P.rect.y + PH - 6 - this.rnd() * 10;
      const big = i % 4 === 0;
      const sp = sc.add
        .image(Math.round(x), Math.round(y), big ? TEX.plus : TEX.px1)
        .setTint(i % 3 === 0 ? PAL.gold4 : i % 3 === 1 ? PAL.leaf3 : PAL.leaf4)
        .setBlendMode(ADD)
        .setScrollFactor(0)
        .setDepth(DEPTH.HUD + 1)
        .setAlpha(0);
      sc.tweens.add({
        targets: sp,
        alpha: { from: 1, to: 0 },
        y: y - 18 - this.rnd() * 26,
        x: x + (this.rnd() - 0.5) * 8,
        delay: this.rnd() * 260,
        duration: 520 + this.rnd() * 320,
        ease: 'Quad.Out',
        onComplete: () => sp.destroy(),
      });
    }
  }

  private playPanelSheen(player: PlayerId): void {
    const P = this.panels[player];
    if (!P.root.active) return;
    const o = { f: 0 };
    P.sheen.setVisible(true).setFrame('s:0');
    this.scene.tweens.add({
      targets: o,
      f: SHEEN_FRAMES - 1,
      duration: 620,
      ease: 'Sine.InOut',
      onUpdate: () => P.sheen.setFrame(`s:${Math.round(o.f)}`),
      onComplete: () => P.sheen.setVisible(false),
    });
  }

  private punch(t: Phaser.GameObjects.BitmapText, dx: number, dy: number, ms: number): Promise<void> {
    const x0 = t.x;
    const y0 = t.y;
    t.setPosition(x0 + dx, y0 + dy);
    return tween(this.scene, { targets: t, x: x0, y: y0, duration: ms, ease: 'Bounce.Out' });
  }

  // ================================================================ phase bar

  /** Left x of phase segment i (relative to the phase bar). */
  private segX(i: number): number {
    return 4 + i * 54;
  }

  private drawMarker(): void {
    const g = this.marker;
    const R = this.markerRamp;
    const L = Math.round(this.markerL);
    const Rx = Math.round(this.markerR);
    const w = Rx - L;
    g.clear();
    if (w < 4) return;
    const y = 3;
    const h = 10;
    const f = this.markerFlash;
    const fill = f > 0 ? mix(R[2], PAL.white, f * 0.7) : R[2];
    const top = f > 0 ? mix(R[3], PAL.white, f) : R[3];
    g.fillStyle(PAL.ink).fillRect(L + 1, y, w - 2, h).fillRect(L, y + 1, w, h - 2);
    g.fillStyle(fill).fillRect(L + 2, y + 1, w - 4, h - 2).fillRect(L + 1, y + 2, w - 2, h - 4);
    g.fillStyle(top).fillRect(L + 2, y + 1, w - 4, 1);
    g.fillStyle(R[4]).fillRect(L + 2, y + 1, 2, 1).fillRect(Rx - 4, y + 1, 2, 1);
    g.fillStyle(mix(R[1], PAL.ink, 0.2)).fillRect(L + 2, y + h - 2, w - 4, 1);
    // little pointer notch under the marker
    if (this.markerGlint >= 0) {
      const gx = Math.round(L + 2 + this.markerGlint * (w - 6));
      g.fillStyle(PAL.white, 0.85).fillRect(gx, y + 1, 2, 1);
      g.fillStyle(R[4], 0.7).fillRect(gx + 1, y + 2, 2, h - 4);
      g.fillStyle(R[4], 0.35).fillRect(gx + 3, y + 2, 1, h - 4);
    }
    const cx = Math.round((L + Rx) / 2);
    g.fillStyle(PAL.ink).fillRect(cx - 2, y + h, 5, 1);
    g.fillStyle(top).fillRect(cx - 1, y + h, 3, 1);
    this.markerGlow.setTint(R[3]).setPosition(L - 3, y - 3);
    this.markerGlow.setScale((w + 6) / this.markerGlow.width, 1);
  }

  private refreshPhaseLabels(moving = false): void {
    const idx = PHASES.indexOf(this.phase);
    this.phaseLabels.forEach((t, i) => {
      if (i === idx && !moving) t.setTint(PAL.white);
      else if (i < idx) t.setTint(PAL.night4);
      else t.setTint(PAL.steel);
    });
    if (!moving && this.phase === 'battle') this.phaseLabels[idx].setTint(PAL.fire4);
  }

  private setBattlePulse(on: boolean): void {
    this.battleTween?.stop();
    this.battleTween = null;
    if (on) {
      this.battlePulse.setAlpha(0.2);
      this.battleTween = this.scene.tweens.add({
        targets: this.battlePulse,
        alpha: { from: 0.15, to: 0.75 },
        duration: 520,
        ease: 'Sine.InOut',
        yoyo: true,
        repeat: -1,
      });
    } else this.scene.tweens.add({ targets: this.battlePulse, alpha: 0, duration: 200 });
  }

  private anim(list: { k: 'markerL' | 'markerR'; to: number; ms: number; ease: string; delay?: number }[]): Promise<void> {
    return Promise.all(
      list.map(
        (a) =>
          new Promise<void>((resolve) => {
            const t = this.scene.tweens.add({
              targets: this,
              [a.k]: a.to,
              duration: a.ms,
              delay: a.delay ?? 0,
              ease: a.ease,
              onUpdate: () => this.drawMarker(),
              onComplete: () => resolve(),
              onStop: () => resolve(),
            });
            this.markerTweens.push(t);
          }),
      ),
    ).then(() => undefined);
  }

  /** Speed streaks trailing the marker while it travels. */
  private streaks(right: boolean): void {
    const sc = this.scene;
    const pb = UI.phaseBar;
    for (let i = 0; i < 5; i++) {
      const y = pb.y + 5 + ((i * 3) % 7);
      const x0 = pb.x + (right ? this.markerR : this.markerL);
      const s = sc.add
        .image(x0, y, TEX.px1)
        .setOrigin(right ? 1 : 0, 0)
        .setScale(10 + i * 3, 1)
        .setTint(this.markerRamp[4])
        .setBlendMode(ADD)
        .setAlpha(0.8)
        .setDepth(DEPTH.HUD + 0.5)
        .setScrollFactor(0);
      sc.tweens.add({
        targets: s,
        x: x0 + (right ? 1 : -1) * (40 + i * 6),
        alpha: 0,
        scaleX: 2,
        delay: i * 22,
        duration: 260,
        ease: 'Cubic.Out',
        onComplete: () => s.destroy(),
      });
    }
  }

  private arrivalSparks(i: number, R: Ramp): void {
    const sc = this.scene;
    const pb = UI.phaseBar;
    const cx = pb.x + this.segX(i) + 27;
    const cy = pb.y + 8;
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const sp = sc.add
        .image(cx + Math.cos(a) * 26, cy + Math.sin(a) * 5, k % 3 === 0 ? TEX.plus : TEX.px1)
        .setTint(k % 2 ? R[4] : PAL.white)
        .setBlendMode(ADD)
        .setDepth(DEPTH.HUD + 0.5)
        .setScrollFactor(0);
      sc.tweens.add({
        targets: sp,
        x: cx + Math.cos(a) * 34,
        y: cy + Math.sin(a) * 11,
        alpha: 0,
        duration: 300,
        ease: 'Cubic.Out',
        onComplete: () => sp.destroy(),
      });
    }
  }

  private layoutTurnText(): void {
    const w = this.turnText.width;
    // right half of the badge, centered
    this.turnText.x = Math.round(27 - w / 2 + 6);
    this.turnText.y = capY('md', 5);
    this.turnText.setOrigin(0, 0);
  }

  // ================================================================ toolbar

  private cycleSpeed(): void {
    const k = (this.speed === 3 ? 1 : this.speed + 1) as SpeedLevel;
    this.setSpeed(k);
    this.onSpeed?.(k);
  }

  private toggleSound(): void {
    const muted = !sfx.isMuted();
    sfx.setMuted(muted);
    this.soundButton.setIcon(muted ? ICON.soundOff : ICON.soundOn);
    this.onSound?.(muted);
  }

  // ================================================================ per-frame

  private tick(dt: number): void {
    const k = this.scene.time.timeScale;
    for (const P of this.panels) {
      if (!P.active || P.path.length === 0) continue;
      P.cometT = (P.cometT + (dt * k) / 5200) % 1;
      const n = P.path.length;
      for (let c = 0; c < 2; c++) {
        const head = Math.floor(((P.cometT + c * 0.5) % 1) * n);
        for (let i = 0; i < COMET; i++) {
          const k = Math.max(0, i - 1);
          const pt = P.path[(head - k + n * 2) % n];
          P.comets[c * COMET + i].setPosition(pt.x + 0.5, pt.y + 0.5);
        }
      }
    }
  }

  private rnd(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}

/** Player color helper re-exported for convenience. */
export function playerColor(p: PlayerId): number {
  return PLAYER_COLOR[p];
}
