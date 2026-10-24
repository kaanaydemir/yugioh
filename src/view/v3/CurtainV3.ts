// CurtainV3 — the v3 hot-seat curtain of lane A6-B (docs/v3/A6_PLAN.md §3 F7 "Sıcak koltuk perdesi",
// open question S1 → default: the board stays visible, only the hand is covered; step B4; built and
// called only under V3_A6_B through Prompt.passDevice). Palette pixels on whole pixels: no full-screen
// wipe, no dimming, no alpha, no ADD (KO-1 … KO-4).
//
//   0         a screen-wide blocker takes the clicks (nothing reaches the board); ui3PassDevice
//   0 …       the hand turns face down in a left-to-right wave, 30 ms a card, in its sharp turn frames
//             (hand.waveFaceDown(true, 30), S-9): the previous player's cards are never seen face up again
//   wave end  the hand is handed over face down (onCovered: hand.setOwner(next, true)); meanwhile a small
//             plate rises 6 px over the hand band in two palette steps: "SIRA: OYUNCU 2" (in a trap
//             window "TUZAK SORUSU: OYUNCU 2"), stamped two letters a frame, and under it the tap icon
//             with "Hazır olunca dokun" (its tone steps mist ↔ white every 620 ms, the icon taps 1 px);
//             a light node runs the plate's trim
//   answer    a click / tap anywhere, Enter or Space — taken from the plate's FIRST frame (A0: a click
//             while the curtain came in was swallowed); a click during the wave down is eaten, not taken
//             (a stray double click of the previous player never skips it). Once the hand-over is done:
//             ui3Confirm; the plate folds in 90 ms (34 → 20 → 8 → 2 px round its middle line, the trim
//             stepping down), then the new hand turns face up in a 30-ms wave
// Privacy (KO-11, §6.3): the hand is face down before the hand-over and until the answer; set cards on
// the field are face down for both players anyway; nothing else hidden is on screen.
// Reduced motion (KO-9): no waves (the whole hand at once), the plate appears / goes at once.
//
//   await curtainV3(scene, 1, { kind: 'turn', hand, onCovered: () => hand.setOwner(1, true) });

import type Phaser from 'phaser';
import { PAL, PLAYER_RAMP } from '../../art/palette';
import type { PlayerId } from '../../engine/types';
import { DEPTH, GAME_H, GAME_W, UI, type Rect } from '../layout';
import { ICON, type UiStyle, pushUiKeys } from '../ui-textures';
import { PalText, canvasTexture, capYV3, iconTexture, iconTones, textWidthV3, ui3Sfx } from './hudSkin';
import { REDUCED_MOTION, settle } from './motion';
import { PlateBox, foldedPlate } from './TrapPromptV3';

const FRAME = 1000 / 60;

/** The hand as the curtain needs it (HandView; S-9's waveFaceDown). */
export interface CurtainHand {
  readonly isFaceDown: boolean;
  waveFaceDown(down: boolean, msPerCard?: number): Promise<void>;
}

export type CurtainKind = 'turn' | 'trap';

export interface CurtainOpts {
  /** 'turn' (default): "SIRA: OYUNCU n"; 'trap': the trap question goes to the other player. */
  kind?: CurtainKind;
  /** The hand to cover (null: only the plate, e.g. a preview). */
  hand?: CurtainHand | null;
  /** Runs once the hand is face down (the hand-over); awaited before the hand turns up again. */
  onCovered?: () => void | Promise<void>;
}

/** The curtain's geometry and timeline (game px; ms at 1×). */
export const CURTAIN = Object.freeze({
  h: 34,
  minW: 140,
  padX: 10,
  line1Cap: 7,
  line2Cap: 21,
  /** The plate sits this far over the resting hand cards' top edge. */
  gapHand: 8,
  rise: 6,
  riseMs: 120,
  stampFrom: 67,
  lettersPerFrame: 2,
  /** The hand's wave: ms between two cards (F7: 30). */
  waveMs: 30,
  blinkMs: 620,
  tapMs: 260,
  /** The fold: three heights, two frames each (≈ 90–100 ms). */
  fold: Object.freeze([20, 8, 2]),
  foldStepMs: 2 * FRAME,
  depth: DEPTH.TRANSITION,
});

/** The plate's first line: who is asked (in their tone). */
export function curtainLine1(kind: CurtainKind, player: PlayerId): { text: string; color: number }[] {
  const who = { text: `OYUNCU ${player + 1}`, color: PLAYER_RAMP[player][4] };
  return kind === 'trap' ? [{ text: 'TUZAK SORUSU: ', color: PAL.mag4 }, who] : [{ text: 'SIRA: ', color: PAL.mist }, who];
}

export const CURTAIN_LINE2 = 'Hazır olunca dokun';
/** The tap icon's drawn width (ICON.pointer, 11 × 12) and its gap to the text. */
const TAP_W = 11;
const TAP_GAP = 4;

/** The plate's rest rect (centred over the hand band). */
export function curtainRect(kind: CurtainKind, player: PlayerId): Rect {
  const l1 = curtainLine1(kind, player).reduce((w, s) => w + textWidthV3(s.text, 'md'), 0);
  const l2 = TAP_W + TAP_GAP + textWidthV3(CURTAIN_LINE2, 'sm');
  const w = Math.max(CURTAIN.minW, l1 + 2 * CURTAIN.padX, l2 + 2 * CURTAIN.padX);
  const x = Math.round(GAME_W / 2 - w / 2);
  const y = UI.handRestTop - CURTAIN.gapHand - CURTAIN.h;
  return { x, y, w, h: CURTAIN.h };
}

/** The plate's y `ms` after it began rising (6 px, whole pixels). */
export function curtainY(rest: number, ms: number, reduced = REDUCED_MOTION): number {
  if (reduced || ms >= CURTAIN.riseMs) return rest;
  return settle(rest + CURTAIN.rise, rest, ms / CURTAIN.riseMs);
}

/** The plate's appear step at `ms`: −2 (two frames), −1 (two frames), 0. */
function appearStep(ms: number, reduced = REDUCED_MOTION): number {
  if (reduced) return 0;
  return ms < 2 * FRAME - 0.5 ? -2 : ms < 4 * FRAME - 0.5 ? -1 : 0;
}

/**
 * The v3 curtain (Prompt.passDevice in v3). Resolves when the next player has tapped and their hand
 * has turned face up. Never throws (an error in onCovered is logged; the curtain still ends).
 */
export async function curtainV3(scene: Phaser.Scene, player: PlayerId, opts: CurtainOpts = {}): Promise<void> {
  const kind: CurtainKind = opts.kind ?? 'turn';
  const style: UiStyle = kind === 'trap' ? 'trap' : player === 0 ? 'p1' : 'p2';
  const hand = opts.hand ?? null;
  const wave = REDUCED_MOTION ? 0 : CURTAIN.waveMs;
  let alive = true;
  let accepting = false;
  let answered = false;
  let onAnswer: () => void = () => undefined;
  const answeredP = new Promise<void>((r) => (onAnswer = r));
  const take = () => {
    if (!accepting || answered || !alive) return;
    answered = true;
    onAnswer();
  };

  // ---- the blocker (eats every click while the curtain is up) and the keys
  const blocker = scene.add.zone(0, 0, GAME_W, GAME_H).setOrigin(0, 0).setScrollFactor(0).setDepth(CURTAIN.depth).setInteractive({ useHandCursor: true });
  blocker.on('pointerdown', take);
  const releaseKeys = pushUiKeys((e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return false;
    take();
    return true;
  });
  ui3Sfx('ui3PassDevice', { volume: 0.6 }, 'passDevice', { volume: 0.5 });

  let plate: PlateBox | null = null;
  let tick: ((t: number, dt: number) => void) | null = null;
  let foldImg: Phaser.GameObjects.Image | null = null;
  const cleanup = () => {
    if (!alive) return;
    alive = false;
    releaseKeys();
    if (tick) scene.events.off('update', tick);
    scene.events.off('shutdown', onShutdown);
    if (blocker.active) blocker.destroy();
    plate?.destroy();
    if (foldImg?.active) foldImg.destroy();
  };
  const onShutdown = () => {
    cleanup();
    onAnswer();
  };
  scene.events.once('shutdown', onShutdown);

  // ---- 1. the hand turns face down (the previous player's cards are never seen again)
  if (hand && !hand.isFaceDown) await hand.waveFaceDown(true, wave);
  if (!alive) return;

  // ---- 2. the hand-over runs behind the plate (the hand stays face down)
  const covered = Promise.resolve()
    .then(() => opts.onCovered?.())
    .catch((e) => console.error('[curtain] onCovered', e));

  // ---- 3. the plate rises; a tap is taken from its first frame
  const R = curtainRect(kind, player);
  const p = new PlateBox(scene, R.x, curtainY(R.y, 0), R.w, R.h, style, CURTAIN.depth + 1);
  plate = p;
  accepting = true;
  const segs = curtainLine1(kind, player);
  const line1: PalText[] = [];
  let lx = Math.round(R.w / 2 - segs.reduce((w, s) => w + textWidthV3(s.text, 'md'), 0) / 2);
  for (const s of segs) {
    const t = new PalText(scene, lx, capYV3('md', CURTAIN.line1Cap), s.text, { size: 'md', color: s.color });
    t.reveal(0);
    p.root.add(t.root);
    line1.push(t);
    lx += textWidthV3(s.text, 'md');
  }
  const l2w = TAP_W + TAP_GAP + textWidthV3(CURTAIN_LINE2, 'sm');
  const l2x = Math.round(R.w / 2 - l2w / 2);
  const line2 = new PalText(scene, l2x + TAP_W + TAP_GAP, capYV3('sm', CURTAIN.line2Cap), CURTAIN_LINE2, { size: 'sm', color: PAL.mist });
  p.root.add(line2.root);
  const tapKey = iconTexture(scene, ICON.pointer, iconTones(style, 1));
  const tap = tapKey ? scene.add.image(l2x, CURTAIN.line2Cap - 2, tapKey).setOrigin(0, 0) : null;
  if (tap) p.root.add(tap);
  const glyphs = line1.reduce((n, t) => n + t.glyphCount, 0);
  let el = 0;
  let shown = false;
  const showParts = (on: boolean) => {
    line2.setVisible(on);
    tap?.setVisible(on);
    for (const t of line1) t.setVisible(on);
  };
  showParts(false);
  tick = (_t: number, dt: number) => {
    const d = dt * scene.tweens.timeScale;
    el += d;
    p.tick(d);
    const step = appearStep(el);
    p.setStep(step);
    p.root.y = curtainY(R.y, el);
    if (step === 0 && !shown) {
      shown = true;
      showParts(true);
      p.setNode(true);
    }
    if (!shown) return;
    // line 1 stamps two letters a frame; line 2 breathes in palette steps, the icon taps
    let left = REDUCED_MOTION ? glyphs : Math.max(0, Math.floor((el - CURTAIN.stampFrom) / FRAME + 1e-6) + 1) * CURTAIN.lettersPerFrame;
    if (!REDUCED_MOTION && el < CURTAIN.stampFrom) left = 0;
    for (const t of line1) {
      t.reveal(Math.max(0, left));
      left -= t.glyphCount;
    }
    if (!REDUCED_MOTION) {
      line2.setColor(Math.floor(el / CURTAIN.blinkMs) % 2 === 0 ? PAL.mist : PAL.white);
      if (tap) tap.y = CURTAIN.line2Cap - 2 + (Math.floor(el / CURTAIN.tapMs) % 2);
    }
  };
  scene.events.on('update', tick);
  tick(0, 0);

  // ---- 4. the answer (and the hand-over done) → the fold → the new hand turns face up
  await answeredP;
  await covered;
  if (!alive) return;
  ui3Sfx('ui3Confirm', { volume: 0.6 }, 'uiConfirm', { volume: 0.6 });
  if (blocker.active) blocker.disableInteractive();
  scene.events.off('update', tick);
  tick = null;
  if (!REDUCED_MOTION) {
    // the fold: three ever thinner plates round the middle line, the trim stepping down
    const mid = Math.round(p.root.y + R.h / 2);
    p.setVisible(false);
    for (let i = 0; i < CURTAIN.fold.length && alive; i++) {
      const h = CURTAIN.fold[i];
      const key = canvasTexture(scene, `ui3:curtain:fold:${style}:${R.w}x${h}:${i}`, () => foldedPlate(R.w, h, style, -Math.min(2, i)));
      if (!foldImg) foldImg = scene.add.image(R.x, 0, key).setOrigin(0, 0).setDepth(CURTAIN.depth + 1).setScrollFactor(0);
      else foldImg.setTexture(key);
      foldImg.y = mid - Math.floor(h / 2);
      await waitScaled(scene, CURTAIN.foldStepMs);
    }
  }
  cleanup();
  if (hand) await hand.waveFaceDown(false, wave);
}

/** Resolve after `ms` of scene (tween-scaled) time. */
function waitScaled(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => {
    let el = 0;
    const tick = (_t: number, dt: number) => {
      el += dt * scene.tweens.timeScale;
      if (el >= ms - 1e-6) {
        scene.events.off('update', tick);
        resolve();
      }
    };
    scene.events.on('update', tick);
    scene.events.once('shutdown', () => {
      scene.events.off('update', tick);
      resolve();
    });
  });
}
