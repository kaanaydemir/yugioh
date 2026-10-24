// v3 lane A6-B (B1) — turn start (F1) and phase change / battle start (F2) behind V3_A6_B
// (docs/v3/A6_PLAN.md §3 F1–F2, §1.3 budgets, KO-1…KO-12). Fills V3HOOKS.turnStart / phaseChange
// (contract S-8); with the flag off nothing here runs and today's flow/turn.ts plays.
//
// turnStart (handler 450 ms — today 1166; A6_MS.turnStart lock ≤ 450)
//   (curtain)  hot-seat with the curtain: the pass-device curtain first, as today
//   0          today's unfocus safety; the side's trim runner + the active panel; music as today
//   0–120      the turn plate ("OYUNCU 2 · TUR 4" / vsBot "SIRA SENDE" · "BİLGİSAYAR") slides 12 px in
//              beside the active panel, appears in two palette steps, letters stamp one per frame
//   0–360      the calm arena's side wave (pulseSide: trim fronts + pads one tone up, stepped) from
//              the podium; as it passes each of the side's monsters: a 2-frame contour in the owner's
//              tone + a small pool of the owner's light under it (no whole-sprite glow)
//   60         the duelist commands
//   360–450    the plate settles its 1 px back; the handler ends. Without a curtain the hand swap
//              runs on behind (it ends long before the draw lands; the main phase waits for it)
//   tail       the plate stays through the draw phase; at the main phase it hops into the turn badge
//              in three steps (120 ms) and the badge's digit rolls (held until then: HudV3.holdTurn);
//              when the duel ends before the main phase (deck-out) it lands at the draw phase instead
// phaseChange draw / main / end (handler 100 / 117 / 117 ms — A6_MS.phaseChange lock ≤ 120)
//   the phase pill: 1-px pull-back, whole-pixel slide with a 1-px overshoot, settle by 150 ms; the
//   new cell's label one white frame; ui3Phase at 30 ms (HudV3.setPhase). Leaving battle, the SAVAŞ
//   cell fades back in two steps. Music as today.
// battle (handler 300 ms — today 1216; A6_MS.phaseBattle lock ≤ 300, tail ≤ 250)
//   0–120      the pill slides into SAVAŞ with a 2-px overshoot, the cell fills crimson in two steps;
//              the crimson "SAVAŞ AŞAMASI" plate on the active side (two letters per frame); ui3Battle
//   60         the duelist commands
//   60–300     under each attack-position monster, left to right 60 ms apart: a crimson stepped floor
//              ring (r 12 → 20 → 28, 3 steps; front half before the feet) + a 2-frame crimson contour +
//              a small crimson light pool
//   300        input returns; the plate holds, then hops into the SAVAŞ cell (done by 550 ms)
// No band, no vignette, no arena dimming, no silhouette flare, no new camera call (KO-4, KO-10).

import type Phaser from 'phaser';
import { PAL, PLAYER_RAMP, type Ramp } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import type { PlayerId } from '../../engine/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, duelistXY, screenToIso, type XY } from '../../view/layout';
import { V3_A6_B } from '../../view/v3flags';
import { REDUCED_MOTION } from '../../view/v3/motion';
import { showContour } from '../../view/v3/ui-kit';
import { HudV3, ui3Ready, ui3Sfx } from '../../view/v3/hudV3';
import { canvasTexture, hex } from '../../view/v3/hudSkin';
import { PLATE, TurnPlate, battlePlateText, turnPlateText } from '../../view/v3/TurnPlate';
import { bg, cameraAtRest, fs, intensityFor, lightFlash, type AnyCtx, type Ctx } from '../flow/_kit';
import { V3HOOKS } from './_hooks';

/** The B1 timings (ms at 1×; A6_MS rows turnStart / phaseChange / phaseBattle). */
export const TURN_V3_MS = Object.freeze({
  turnStart: PLATE.settledMs, // 450
  commandAt: 60,
  /** (whole frames: a wait resolves on the first frame at or past it — 110 → 117 ms, 290 → 300 ms) */
  phaseDraw: 100,
  phaseOther: 110,
  battle: 290,
  /** The battle plate holds this long after the input returns, then hops (3 × 40 ms): ≤ 250 tail. */
  battleHold: 110,
  ringFrom: 60,
  ringStagger: 60,
  ringStepMs: 50,
});

const FRAME = 1000 / 60;

/** The face-up monsters of `p` on screen (as flow/turn.ts). */
function unitsOf(ctx: AnyCtx, p: PlayerId): MonsterUnit[] {
  return ctx.views.field.units().filter((u) => u.player === p && !u.retired && u.sprite.active && u.sprite.visible);
}

/** The v3 HUD (lane B's HudView), or null. */
function hud3(ctx: AnyCtx): HudV3 | null {
  const h = ctx.views.hud as unknown;
  return h instanceof HudV3 ? h : null;
}

/**
 * When the calm arena's turn-start wave (BoardViewCalm.pulseSide: each pad's swell starts 40 +
 * (podium distance − 1) × 130 ms after the call and is brightest 70–220 ms into it) is brightest under
 * the floor point `at` of `player`'s side. The podium is where the duelist stands (duelistXY).
 */
export function calmWaveMs(player: PlayerId, at: XY): number {
  const pod = screenToIso(duelistXY(player).x, duelistXY(player).y);
  const c = screenToIso(at.x, at.y);
  const d = Math.hypot(c.col - pod.col, c.row - pod.row);
  return Math.round(40 + Math.max(0, d - 1) * 130 + 70);
}

/** A sprite's current-frame contour for a few frames, one palette tone per frame (KO-3: 1-px contour). */
async function contourBlink(ctx: AnyCtx, u: MonsterUnit, tones: readonly number[]): Promise<void> {
  if (REDUCED_MOTION) return;
  for (const tone of tones) {
    if (u.retired || !u.sprite.active) return;
    const c = showContour(ctx.scene, u.sprite, tone);
    await ctx.wait(FRAME - 1);
    c?.destroy();
  }
}

// ---------------------------------------------------------------- floor ring (battle readiness)

/**
 * A 1-px iso (2:1) ellipse ring of radius r (x), round(r / 2) (y): canvas (2r + 1) × (2·ry + 1), centre
 * (r, ry). `half` keeps only the back (rows above the centre) or the front (the centre row and below).
 */
export function isoRingCanvas(r: number, color: number, half: 'all' | 'back' | 'front' = 'all'): PixelCanvas {
  const rx = Math.max(1, Math.round(r));
  const ry = Math.max(1, Math.round(rx / 2));
  const p = new PixelCanvas(2 * rx + 1, 2 * ry + 1);
  for (let x = -rx; x <= rx; x++) {
    const y = Math.round(ry * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)));
    p.set(rx + x, ry + y, color).set(rx + x, ry - y, color);
  }
  for (let y = -ry; y <= ry; y++) {
    const x = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2)));
    p.set(rx + x, ry + y, color).set(rx - x, ry + y, color);
  }
  if (half !== 'all') for (let y = 0; y < p.h; y++) if (half === 'back' ? y >= ry : y < ry) for (let x = 0; x < p.w; x++) p.erase(x, y);
  return p;
}

/**
 * The crimson readiness ring on the floor around a monster: r 12 → 20 → 28 in three steps, each a tone
 * down, with the previous ring as a dim echo inside. Its back half lies behind the monster, its front
 * half in front of the monster's feet. (F2 says r 6 → 18: at that size the ring hides entirely under
 * the body and the stat badge, so it grows to the pad's edge instead — reported as a deviation.)
 */
async function readyRing(ctx: AnyCtx, u: MonsterUnit): Promise<void> {
  const at = u.home;
  const sc = ctx.scene;
  const steps: { r: number; tone: number }[][] = REDUCED_MOTION
    ? [[{ r: 20, tone: PAL.crim3 }]]
    : [
        [{ r: 12, tone: PAL.crim4 }],
        [
          { r: 20, tone: PAL.crim3 },
          { r: 12, tone: PAL.crim1 },
        ],
        [
          { r: 28, tone: PAL.crim2 },
          { r: 20, tone: PAL.crim1 },
        ],
      ];
  const imgs: Phaser.GameObjects.Image[] = [];
  const x = Math.round(at.x);
  const y = Math.round(at.y);
  try {
    for (const step of steps) {
      for (const im of imgs.splice(0)) im.destroy();
      for (const { r, tone } of step) {
        const ry = Math.round(r / 2);
        for (const half of ['back', 'front'] as const) {
          const key = canvasTexture(sc, `ui3:ring:${r}:${hex(tone)}:${half}`, () => isoRingCanvas(r, tone, half));
          const depth = half === 'back' ? DEPTH.SHADOW + 1 : u.sprite.depth + 0.02;
          imgs.push(sc.add.image(x - r, y - ry, key).setOrigin(0, 0).setDepth(depth));
        }
      }
      await ctx.wait(TURN_V3_MS.ringStepMs);
    }
  } finally {
    for (const im of imgs) im.destroy();
  }
}

// ---------------------------------------------------------------- the turn plate's journey

/** The plate of the turn that has started (it lands in the badge at the main phase), per scene. */
let turnPlate: { plate: TurnPlate; turn: number; scene: Phaser.Scene } | null = null;
/** The hand swap of the turn start when no curtain hides it (it runs on behind the handler), per scene. */
let pendingHandover: { p: Promise<void>; scene: Phaser.Scene } | null = null;

/**
 * True when the duel ends before this turn's main phase: a deckOut / gameOver comes in this batch
 * before the next phase change or turn start (the engine's beginTurn: turnStart, phaseChange draw,
 * then the draw — or deckOut + gameOver — then phaseChange main). The turn plate then lands at the
 * draw phase instead of hanging on through the deck-out and the game over.
 */
export function endsBeforeMain(events: readonly { type: string }[], index: number): boolean {
  for (let i = index + 1; i < events.length; i++) {
    const t = events[i].type;
    if (t === 'phaseChange' || t === 'turnStart') return false;
    if (t === 'deckOut' || t === 'gameOver') return true;
  }
  return false;
}

/** The turn plate hops into the badge and the badge's digit rolls (the tail of F1). */
function landTurnPlate(ctx: AnyCtx): void {
  const h = hud3(ctx);
  const tp = turnPlate && turnPlate.scene === ctx.scene ? turnPlate : null;
  turnPlate = null;
  if (!tp || !tp.plate.active) {
    void h?.landTurn(true);
    return;
  }
  const target = h ? h.turnBadgeRect() : null;
  if (!target) {
    tp.plate.destroy();
    return;
  }
  // the badge's digit rolls as the last hop (the badge's own frame in white) arrives
  bg(tp.plate.shrinkTo(target, [`TUR ${tp.turn}`, String(tp.turn)], () => void h?.landTurn(true)));
}

// ---------------------------------------------------------------- hooks

async function turnStartV3(ctx: Ctx<'turnStart'>): Promise<void> {
  const { player, turn } = ctx.ev;
  const v = ctx.views;
  const sc = ctx.scene;
  if (!cameraAtRest(ctx)) await v.camera.unfocus(120); // today's safety (flow/turn.ts:38)
  // a plate of the turn before that never landed (e.g. no main phase) lands now, at once
  if (turnPlate) {
    turnPlate.plate.destroy();
    turnPlate = null;
    void hud3(ctx)?.landTurn(false);
  }
  TurnPlate.dismissAll();
  // hot-seat: the curtain (pass the device) before anything of the new turn shows — as today
  const target = v.info.viewerFor(player);
  const curtain = v.info.mode === 'hotseat' && v.info.curtain && !v.info.auto && v.info.isHuman(target) && (target !== v.hand.owner || v.hand.isFaceDown);
  const handover = v.info.ensureViewer(player);
  if (curtain) await handover;
  else {
    pendingHandover = { p: handover, scene: sc };
    bg(handover);
  }
  v.board.setActivePlayer(player, true);
  v.hud.setActive(player, true);
  const h = hud3(ctx);
  h?.holdTurn(); // the plate carries the number; the badge rolls when it lands
  v.hud.setTurn(turn, true);
  ctx.music.setIntensity(intensityFor(ctx.stateNext, 'main'));
  // the plate + its motif (two registers: P2 an octave under P1)
  const plate = TurnPlate.show(sc, {
    player,
    kind: 'turn',
    segments: turnPlateText({ mode: v.info.mode, human: v.info.isHuman(player), player, turn }),
  });
  turnPlate = { plate, turn, scene: sc };
  // ui3TurnStart in two registers: P2 an octave under P1 (pitch 0.5)
  ui3Sfx('ui3TurnStart', { pitch: player === 1 ? 0.5 : 1 }, 'turnStart', { pitch: player === 1 ? 0.9 : 1 });
  // the side wakes up: the calm arena's wave from the podium (stepped pads + trim fronts), the podium's light
  bg(v.board.pulseSide(player));
  const R: Ramp = PLAYER_RAMP[player];
  const pod = duelistXY(player);
  void lightFlash(sc, pod.x, pod.y - 16, R[3], fs(40), 460, { floorY: pod.y, ring: true, intensity: 0.8 });
  // as the wave passes each monster of the side: a 2-frame contour in the owner's tone + its light
  for (const u of unitsOf(ctx, player)) {
    const at = calmWaveMs(player, u.home);
    bg(
      ctx.wait(at).then(() => {
        if (u.retired) return undefined;
        void lightFlash(sc, u.home.x, u.home.y, R[3], fs(26), 300, { intensity: 0.55 });
        return contourBlink(ctx, u, [R[4], R[3]]);
      }),
    );
  }
  const duelist = v.duelists?.get(player);
  if (duelist) bg(ctx.wait(TURN_V3_MS.commandAt).then(() => duelist.play('command')));
  await ctx.wait(TURN_V3_MS.turnStart);
}

async function phaseChangeV3(ctx: Ctx<'phaseChange'>): Promise<void> {
  const { phase, player } = ctx.ev;
  const v = ctx.views;
  if (phase === 'battle') return battleStartV3(ctx);
  bg(v.hud.setPhase(phase, player, true));
  if (phase === 'end' || phase === 'main') ctx.music.setIntensity(intensityFor(ctx.stateNext, phase));
  // the turn plate lands at the main phase — or at the draw phase when no main phase will come (deck-out)
  if (phase === 'main' || (phase === 'draw' && endsBeforeMain(ctx.events, ctx.index))) landTurnPlate(ctx);
  await ctx.wait(phase === 'draw' ? TURN_V3_MS.phaseDraw : TURN_V3_MS.phaseOther);
  if (phase === 'main' && pendingHandover) {
    // the hand swap that ran on behind the turn start (normally long finished; never waited for
    // past 800 ms, and never across a restart)
    const h = pendingHandover;
    pendingHandover = null;
    if (h.scene === ctx.scene) await Promise.race([h.p, ctx.wait(800)]);
  }
}

async function battleStartV3(ctx: Ctx<'phaseChange'>): Promise<void> {
  const { player } = ctx.ev;
  const v = ctx.views;
  const sc = ctx.scene;
  ctx.music.setIntensity(intensityFor(ctx.stateNext, 'battle'));
  if (turnPlate) landTurnPlate(ctx); // (never: the main phase comes first)
  bg(v.hud.setPhase('battle', player, true));
  ui3Sfx('ui3Battle', {}, 'phaseChange', { volume: 0.9, pitch: 0.8 });
  const ringSound = !ui3Ready('ui3Battle'); // today's metal ring on the first ring, until ui3Battle (drum + ring) exists
  const plate = TurnPlate.show(sc, { player, kind: 'battle', segments: battlePlateText(), lettersPerFrame: 2 });
  const duelist = v.duelists?.get(player);
  if (duelist) bg(ctx.wait(TURN_V3_MS.commandAt).then(() => duelist.play('command')));
  // the attackers-to-be, left to right: a crimson floor ring, a 2-frame contour, a small crimson pool
  const ready = unitsOf(ctx, player)
    .filter((u) => u.position === 'attack')
    .sort((a, b) => a.home.x - b.home.x);
  ready.forEach((u, i) =>
    bg(
      ctx.wait(TURN_V3_MS.ringFrom + (REDUCED_MOTION ? 0 : i * TURN_V3_MS.ringStagger)).then(() => {
        if (u.retired) return undefined;
        if (i === 0 && ringSound) ctx.sfx('lockOn', { volume: 0.3, pitch: 0.8 });
        void lightFlash(sc, u.home.x, u.home.y, PAL.crim3, fs(24), 260, { intensity: 0.6 });
        return Promise.all([readyRing(ctx, u), contourBlink(ctx, u, [PAL.crim4, PAL.crim3])]);
      }),
    ),
  );
  await ctx.wait(TURN_V3_MS.battle);
  // the tail (≤ 250 ms after the input returns): the plate holds, then hops into the SAVAŞ cell
  const h = hud3(ctx);
  bg(
    ctx.wait(TURN_V3_MS.battleHold).then(() => {
      if (!plate.active) return undefined;
      if (!h) {
        plate.destroy();
        return undefined;
      }
      return plate.shrinkTo(h.phasePillRect('battle'), ['SAVAŞ']);
    }),
  );
}

if (V3_A6_B) {
  V3HOOKS.turnStart = turnStartV3;
  V3HOOKS.phaseChange = phaseChangeV3;
}
