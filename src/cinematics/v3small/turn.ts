// v3 lane A6-B (B1) — turn start (F1) and phase change / battle start (F2) behind V3_A6_B
// (docs/v3/A6_PLAN.md §3 F1–F2, §1.3 budgets, KO-1…KO-12). Fills V3HOOKS.turnStart / phaseChange
// (contract S-8); with the flag off nothing here runs and today's flow/turn.ts plays.
//
// turnStart (handler 450 ms — today 1166; A6_MS.turnStart lock ≤ 450)
//   (curtain)  hot-seat with the curtain: the pass-device curtain first, as today
//   0          today's unfocus safety; the side's trim runner + the active panel; music as today
//   0–120      the turn plate ("OYUNCU 2 · TUR 4" / vsBot "SIRA SENDE" · "BİLGİSAYAR") slides 12 px in
//              beside the active panel, appears in two palette steps, letters stamp one per frame from
//              its first frame (A6B-8: never a plate without its words); the motif at 67 ms (its rest)
//   0–360      the calm arena's side wave (pulseSide: trim fronts + pads one tone up, stepped) from
//              the podium; as it passes each of the side's monsters: a 2-frame contour in the owner's
//              tone + a small pool of the owner's light under it (no whole-sprite glow)
//   60         the duelist commands
//   360–450    the plate settles its 1 px back; the handler ends. Without a curtain the hand swap
//              runs on behind (it ends long before the draw lands; the main phase waits for it)
//   number     (A6B-5) the frame after the plate stamps its turn number, a spark in the player's tone
//              flies a whole-pixel arc from the number to the TUR badge's digit (≤ 12 frames); on landing
//              the badge's frame shows white and its digit rolls (held until then: HudV3.holdTurn) — the
//              plate and the badge never show two numbers
//   tail       the plate stays through the draw phase; at the main phase it folds out in place (20 → 12
//              → 6 → 2 px, 100 ms); when the duel ends before the main phase (deck-out) at the draw phase
// phaseChange draw / main / end (handler 100 / 117 / 117 ms — A6_MS.phaseChange lock ≤ 120)
//   the phase pill: 1-px pull-back, whole-pixel slide with a 1-px overshoot, settle by 150 ms; the
//   new cell's label one white frame; ui3Phase at 30 ms (HudV3.setPhase). Leaving battle, the SAVAŞ
//   cell fades back in two steps. Music as today.
// battle (handler 300 ms — today 1216; A6_MS.phaseBattle lock ≤ 300, tail ≤ 250)
//   0–120      the pill slides into SAVAŞ with a 2-px overshoot, the cell fills crimson in two steps;
//              the crimson "SAVAŞ AŞAMASI" plate on the active side (two letters per frame); ui3Battle
//   60         the duelist commands
//   60–380     under each attack-position monster, left to right 60 ms apart (A6B-4, round 2): a round
//              iso ring on the floor — 2 px of crimson with a 1-px ink line outside — grows out of the
//              foot point r 10 → 22 → 34 in three whole-pixel steps (two frames each; r 18, the plan's
//              size, hid under the stat badge and the body), holds two frames and steps down twice; its
//              back half lies behind the unit, its front half over the feet and under the badge. P2's
//              ring is pale (crim4, a white leading edge on its first step) so it parts from P2's
//              crimson grid. Under the attacker a held stepped crimson pool lifts the pads round it
//              (two steps in its core, one at its rim) for 170 ms, then dithers out; a 2-frame crimson
//              contour (crim3, crim2) on the body. No tile-diamond flash (it read as one more grid line).
//   300        input returns; the plate holds 110 ms, then folds out in place (100 ms; A6B-5: no hops —
//              the SAVAŞ cell has worn crimson since 0–120)
// No band, no vignette, no arena dimming, no silhouette flare, no new camera call (KO-4, KO-10).

import type Phaser from 'phaser';
import { PAL, PLAYER_RAMP, type Ramp } from '../../art/palette';
import { PixelCanvas, type Pt } from '../../art/pixel';
import type { PlayerId } from '../../engine/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, duelistXY, screenToIso, type XY } from '../../view/layout';
import { V3_A6_B } from '../../view/v3flags';
import { REDUCED_MOTION } from '../../view/v3/motion';
import { showContour } from '../../view/v3/ui-kit';
import { HudV3, ui3Ready, ui3Sfx } from '../../view/v3/hudV3';
import { HUD3, canvasTexture, hex } from '../../view/v3/hudSkin';
import { DuelPlate, PLATE, TurnPlate, battlePlateText, flySpark, turnPlateText } from '../../view/v3/TurnPlate';
import { bg, cameraAtRest, fs, intensityFor, lightFlash, lightPool, type AnyCtx, type Ctx } from '../flow/_kit';
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
  /** The attacker's stepped crimson pool (A6B-4): held, then dithered out. */
  poolHoldMs: 170,
  poolOutMs: 100,
  /** A6B-5: the turn number's flight to the badge (frames). */
  numberFlightFrames: 12,
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

/** The pixels of a 1-px iso ellipse (rx, ry) round (0, 0) — isoRingCanvas's two passes, as offsets. */
function isoEllipsePoints(rx: number, ry: number): Pt[] {
  const out: Pt[] = [];
  for (let x = -rx; x <= rx; x++) {
    const y = Math.round(ry * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)));
    out.push([x, y], [x, -y]);
  }
  for (let y = -ry; y <= ry; y++) {
    const x = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2)));
    out.push([x, y], [-x, y]);
  }
  return out;
}

/**
 * The readiness band (A6B-4, F2 "Hazır"): a round iso ring 2 px thick all round — its outer row `outer`
 * (the 1-px ellipse r, ry), its inner row `inner` (the ellipse r − 1, ry − 1, and any pixel left between
 * the two) — with a 1-px ink line hugging its outside so it reads on the navy pads and over the cyan /
 * crimson zone lines alike. Canvas (2r + 3) × (2·ry + 3), centre (r + 1, ry + 1), ry = round(r / 2);
 * `half` keeps the back (rows above the centre) or the front (the centre row and below). Opaque palette
 * pixels, clean 2:1 stair-steps.
 */
export function readyBandCanvas(r: number, outer: number, inner: number, half: 'all' | 'back' | 'front' = 'all'): PixelCanvas {
  const R = Math.max(3, Math.round(r));
  const ry = Math.max(2, Math.round(R / 2));
  const W = 2 * R + 3;
  const H = 2 * ry + 3;
  const cx = R + 1;
  const cy = ry + 1;
  const tone: (number | null)[] = new Array(W * H).fill(null);
  const at = (x: number, y: number) => (cy + y) * W + (cx + x);
  const within = (x: number, y: number, a: number, b: number) => (x / a) ** 2 + (y / b) ** 2 <= 1;
  for (const [x, y] of isoEllipsePoints(R, ry)) tone[at(x, y)] = outer;
  for (const [x, y] of isoEllipsePoints(R - 1, ry - 1)) if (tone[at(x, y)] === null) tone[at(x, y)] = inner;
  // the band never breaks: a pixel left between the two curves takes the inner tone
  for (let y = -ry; y <= ry; y++)
    for (let x = -R; x <= R; x++) if (tone[at(x, y)] === null && within(x, y, R, ry) && !within(x, y, R - 1.5, ry - 1.5)) tone[at(x, y)] = inner;
  const p = new PixelCanvas(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tone[y * W + x] !== null) p.set(x, y, tone[y * W + x]!);
  // the ink line: every empty pixel outside the outer curve with the band as a 4-neighbour
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (tone[y * W + x] !== null || within(x - cx, y - cy, R, ry)) continue;
      const n = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < W && yy < H && tone[yy * W + xx] !== null;
      if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) p.set(x, y, PAL.ink);
    }
  if (half !== 'all') for (let y = 0; y < p.h; y++) if (half === 'back' ? y >= cy : y < cy) for (let x = 0; x < p.w; x++) p.erase(x, y);
  return p;
}

/** One step of the readiness ring: its radius, its band's outer / inner rows and how many frames it shows. */
export interface ReadyStep {
  r: number;
  outer: number;
  inner: number;
  frames: number;
}

/**
 * The readiness ring's steps (A6B-4, round 2): r 10 → 22 → 34 in three whole-pixel steps of two frames,
 * the last held two frames more, then two palette steps down (12 frames, 200 ms). r 34 clears the stat
 * badge under the foot point (MonsterUnit BADGE_DY 11, 9 px tall: the band's bottom rows y + 16 / 17 and its
 * ink y + 18 run just under it) and the body's sides. P1's ring is crimson with a crim4 leading edge on the
 * cyan grid; P2's is pale — a white leading edge on its first step, then crim4 / crim3 — so it parts from
 * P2's own crimson grid lines.
 */
export function readySteps(player: PlayerId): readonly ReadyStep[] {
  return player === 0 ? READY_P1 : READY_P2;
}

export const READY_RADII: readonly number[] = Object.freeze([10, 22, 34]);

const READY_P1: readonly ReadyStep[] = Object.freeze([
  { r: 10, outer: PAL.crim4, inner: PAL.crim3, frames: 2 },
  { r: 22, outer: PAL.crim4, inner: PAL.crim3, frames: 2 },
  { r: 34, outer: PAL.crim3, inner: PAL.crim2, frames: 4 },
  { r: 34, outer: PAL.crim2, inner: PAL.crim1, frames: 2 },
  { r: 34, outer: PAL.crim1, inner: PAL.crim0, frames: 2 },
]);

const READY_P2: readonly ReadyStep[] = Object.freeze([
  { r: 10, outer: PAL.white, inner: PAL.crim4, frames: 2 },
  { r: 22, outer: PAL.crim4, inner: PAL.crim3, frames: 2 },
  { r: 34, outer: PAL.crim4, inner: PAL.crim3, frames: 4 },
  { r: 34, outer: PAL.crim3, inner: PAL.crim2, frames: 2 },
  { r: 34, outer: PAL.crim2, inner: PAL.crim1, frames: 2 },
]);

/** The ring's steps with reduced motion (KO-9): no growth — the full ring, then its two steps down. */
export function readyStepsReduced(player: PlayerId): readonly ReadyStep[] {
  return readySteps(player).slice(2);
}

/**
 * The crimson readiness ring on the floor round a monster's foot point (A6B-4): readySteps(), one image
 * per half — the back half (rows above the centre) on the floor behind the unit, the front half (the
 * centre row and below) over its feet and under its stat badge (BADGE_DEPTH). Whole pixels, opaque
 * palette pixels, no alpha.
 */
async function readyRing(ctx: AnyCtx, u: MonsterUnit, player: PlayerId): Promise<void> {
  const at = u.home;
  const sc = ctx.scene;
  const steps = REDUCED_MOTION ? readyStepsReduced(player) : readySteps(player);
  const imgs: Phaser.GameObjects.Image[] = [];
  const x = Math.round(at.x);
  const y = Math.round(at.y);
  try {
    for (const st of steps) {
      for (const im of imgs.splice(0)) im.destroy();
      if (u.retired || !u.sprite.active) return;
      const ry = Math.round(st.r / 2);
      for (const half of ['back', 'front'] as const) {
        const key = canvasTexture(sc, `ui3:ready:${st.r}:${hex(st.outer)}:${hex(st.inner)}:${half}`, () => readyBandCanvas(st.r, st.outer, st.inner, half));
        const depth = half === 'back' ? DEPTH.SHADOW + 1 : u.sprite.depth + 0.02;
        imgs.push(sc.add.image(x - st.r - 1, y - ry - 1, key).setOrigin(0, 0).setDepth(depth));
      }
      await ctx.wait(st.frames * FRAME - 1);
    }
  } finally {
    for (const im of imgs) im.destroy();
  }
}

/**
 * The attacker's stepped crimson pool (A6B-4): the floor inside the ring's full size (r 34) lifted toward
 * crimson — two steps in its core, one at its rim (pad pixels only, never a wash) — held, then dithered out.
 */
async function readyPool(ctx: AnyCtx, u: MonsterUnit): Promise<void> {
  const r = READY_RADII[READY_RADII.length - 1];
  const pool = lightPool(ctx.scene, Math.round(u.home.x), Math.round(u.home.y), { color: PAL.crim3, radius: r, ry: Math.round(r / 2), intensity: 2, fadeIn: 0, group: 'fx' });
  await ctx.wait(TURN_V3_MS.poolHoldMs);
  await pool.fadeOut(TURN_V3_MS.poolOutMs);
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

/**
 * The tail of F1 (A6B-5): the turn number already flew to the badge as it was stamped (sendTurnNumber), so
 * the plate folds out in place; the badge's roll is made sure of (landTurn is idempotent).
 */
function landTurnPlate(ctx: AnyCtx): void {
  const h = hud3(ctx);
  const tp = turnPlate && turnPlate.scene === ctx.scene ? turnPlate : null;
  turnPlate = null;
  void h?.landTurn(true);
  if (!tp || !tp.plate.active) return;
  bg(tp.plate.leave());
}

/**
 * The turn number flies to the TUR badge the frame after the plate stamps it (A6B-5, F1 "rozet sayısı bir
 * hane döner"): a spark in the player's tone along a whole-pixel arc, landing on the badge's digit — the
 * badge's frame one white frame, its digit rolls (landTurn). The plate and the badge never show two
 * different numbers for longer than the flight. Reduced motion: the badge rolls at once.
 */
function sendTurnNumber(ctx: AnyCtx, plate: TurnPlate, ramp: Ramp): void {
  const h = hud3(ctx);
  if (!h) return;
  const num = plate.lastGlyph();
  if (REDUCED_MOTION || !num) {
    void h.landTurn(!REDUCED_MOTION);
    return;
  }
  const badge = h.turnBadgeRect();
  const aim = { x: badge.x + HUD3.turn.numCx, y: badge.y + HUD3.turn.numCap + 3 };
  bg(
    ctx.wait(num.at + FRAME).then(() =>
      // P1's number goes round the field's left (the arc bulges away from the board); P2's flies straight
      // along the top, under the phase bar, above the board's far corner
      flySpark(ctx.scene, num, badge, ramp, { frames: TURN_V3_MS.numberFlightFrames, aim, bulge: plate.spec.player === 0 ? undefined : 0, onLand: () => void h.landTurn(true) }),
    ),
  );
}

// ---------------------------------------------------------------- hooks

async function turnStartV3(ctx: Ctx<'turnStart'>): Promise<void> {
  const { player, turn } = ctx.ev;
  const v = ctx.views;
  const sc = ctx.scene;
  // the opening's "DÜELLO!" plate (F0) leaves in its two palette steps as the first turn starts
  DuelPlate.leaveAll();
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
  // the number flies on to the badge as soon as it is stamped (A6B-5)
  sendTurnNumber(ctx, plate, PLAYER_RAMP[player]);
  // ui3TurnStart in two registers: P2 an octave under P1 (pitch 0.5) — as the plate reaches its rest tones
  // (A6B-7: off the hand swap's own slide on the turn's first frame; one sound a frame)
  bg(ctx.wait(PLATE.restAt).then(() => ui3Sfx('ui3TurnStart', { pitch: player === 1 ? 0.5 : 1 }, 'turnStart', { pitch: player === 1 ? 0.9 : 1 })));
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
  // the attackers-to-be, left to right: a round crimson floor ring, a held crimson pool, a 2-frame contour
  const ready = unitsOf(ctx, player)
    .filter((u) => u.position === 'attack')
    .sort((a, b) => a.home.x - b.home.x);
  ready.forEach((u, i) =>
    bg(
      ctx.wait(TURN_V3_MS.ringFrom + (REDUCED_MOTION ? 0 : i * TURN_V3_MS.ringStagger)).then(() => {
        if (u.retired) return undefined;
        if (i === 0 && ringSound) ctx.sfx('lockOn', { volume: 0.3, pitch: 0.8 });
        // the floor answers round the attacker (A6B-4): a round ring grows out past its badge and a held
        // stepped crimson pool lifts the pads round it; the body's contour: crim3 then crim2 (crim4 is the
        // pale pink that read as white on a body)
        return Promise.all([readyRing(ctx, u, player), readyPool(ctx, u), contourBlink(ctx, u, [PAL.crim3, PAL.crim2])]);
      }),
    ),
  );
  await ctx.wait(TURN_V3_MS.battle);
  // the tail (≤ 250 ms after the input returns): the plate holds, then hops into the SAVAŞ cell
  // A6B-5: it folds out where it is (the SAVAŞ cell has worn crimson since the beat's first frame; a spark
  // to it would cut across the field and its units)
  bg(ctx.wait(TURN_V3_MS.battleHold).then(() => (plate.active ? plate.leave() : undefined)));
}

if (V3_A6_B) {
  V3HOOKS.turnStart = turnStartV3;
  V3HOOKS.phaseChange = phaseChangeV3;
}
