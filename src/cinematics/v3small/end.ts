// v3 lane A6-B (B5) — deck-out (F8) and victory / defeat (F9) behind V3_A6_B (docs/v3/A6_PLAN.md §3
// F8 / F9, §1.3 budgets, KO-1 … KO-12). Fills V3HOOKS.deckOut / gameOver (contract S-8); with the flag off
// nothing here runs and today's flow/end.ts plays.
//
// The camera (the user's decision, the orchestrator's note above both plans): no new camera move and none
// removed — today's two leans stay at their beats: the deck-out lean toward the empty deck at its start
// (flow/end.ts:41) and the game-over lean toward the winner's chest on the winner's beat (flow/end.ts:143);
// today's unfocus safeties too (end.ts:86 / :119 / :173). The two leans are the lines marked `keep-lean`.
//
// deckOut (handler 1340 ms of scene time — today 2650; A6_MS.deckOut ≤ 1400)
//   0        today's lean (pan 0.45, 320 ms); the duelist reaches (command); ui3DeckOut
//   0–200    the empty deck pad's count tag reads "0" in crimson and blinks 3 × (2 frames on, 2 dim); the pad
//            flashes crimson in steps (calm board) and a small crimson pool lights it
//   200–700  8 px over the pad the dashed 1-px outline of the card that is not there rises in (2 px a frame,
//            stepping up the crimson ramp), its dashes march; at 520 it breaks into 6 pieces that fall onto
//            the pad stepping down to nothing; the duelist recoils (hurt)
//   700–1340 the crimson "DESTE BİTTİ" plate on the player's side (TurnPlate: 12-px slide, letters stamp);
//            900 today's unfocus(500) safety. The plate stays: at the game over it hops into the result plate.
// gameOver (handler 3100 ms of scene time = 3250 ms of game time with today's 0.7 slow motion — today 3450;
//           A6_MS.gameOver 3000–3500)
//   0        the music stops; today's unfocus(260) safety; today's slow motion (0.7 for 500 ms); the trim
//            runner moves to the winner's side (as today)
//   0–400    the loser: its side's pads, zone lines and neon trim go dark in two palette steps, front row
//            first (a stepped shade on that side only: no full-screen dim); each of its monsters plays its own
//            death 120 ms apart (a v3 body: its death pose, then it breaks as its material; an old one: its
//            recoil a beat, then the material break — no hologram glitch); its duelist kneels (defeat)
//   300–1000 the winner: today's lean; a narrow stepped gold beam drops onto the podium in three frames (7 px:
//            white core, gold sides) and holds through the plate's stamps (A6B-3), a stepped gold ring runs
//            out on the floor, a stepped gold pool lights the podium's own floor (gold2 / gold1 / gold0 bands,
//            the core pulsing a tone while the beam holds; ≈ 400 ms after the beam, then two steps out); the
//            duelist raises a fist (victory); the side's wave (calm board); the winner's monsters play
//            `victory` (held on its last frame) or roar, 100 ms apart, each with a 2-frame gold contour
//   740 (scene; ≈ 900 ms of game time after the gameOver event) the result plate (ResultPlate) opens over
//            the top centre: line 1 ("KAZANAN: OYUNCU 1") stamps two letters a frame from the opening's last
//            step and reads by ≈ 1.1 s, line 2 three a frame; three crisp pixel fireworks (2 × 2 cores, rays
//            to 7 px) 150 ms apart in the winner's half; ui3Victory (a person beaten by the computer:
//            ui3Defeat) and the fanfare as today
//   …3100    hold: tiny gold motes rise off the winner's podium; the loser's dead neon trim sputters one
//            step up for two frames now and then (a dying tube); the handler ends; Prompt.gameOver v3 adds
//            the button row under the plate; today's unfocus(700) eases the lean back
// Reduced motion (KO-9): no wave, stagger, beam drop, fireworks, motes or sputter; the plates are there at once.

import type Phaser from 'phaser';
import { PAL, RAMPS } from '../../art/palette';
import { PixelCanvas, type Pt } from '../../art/pixel';
import { isoCanvas, ISO_CX, ISO_CY } from '../../art/cards';
import type { PlayerId } from '../../engine/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { topAt } from '../../still/arena';
import { DEPTH, duelistXY, screenToIso, zoneXY, type XY } from '../../view/layout';
import { STEP_DEPTH } from '../../view/light';
import { V3_A6_B } from '../../view/v3flags';
import { REDUCED_MOTION } from '../../view/v3/motion';
import { showContour } from '../../view/v3/ui-kit';
import { canvasTexture, glyphCanvas, hex, ui3Ready, ui3Sfx } from '../../view/v3/hudSkin';
import { TurnPlate, deckOutPlateText } from '../../view/v3/TurnPlate';
import { ResultPlate, resultPlateRect } from '../../view/v3/ResultPlate';
import { shatter } from '../../vfx/shatter';
import { deathMaterial } from '../_v3/presets';
import { bg, fs, lightFlash, lightPool, other, type AnyCtx, type Ctx } from '../flow/_kit';
import { isoRingCanvas } from './turn';
import { V3HOOKS } from './_hooks';

const FRAME = 1000 / 60;

/** The B5 timings (scene ms at 1×; A6_MS.deckOut / gameOver). */
export const END_V3_MS = Object.freeze({
  // deck-out
  blinkFrames: 2,
  blinks: 3,
  cardFrom: 200,
  cardRiseFrames: 4,
  breakAt: 520,
  breakFrames: 11,
  deckPlateAt: 700,
  unfocusAt: 900,
  deckOut: 1340,
  // game over (scene ms; today's slow motion stretches the first 500 game ms)
  slowMo: 0.7,
  slowMoMs: 500,
  shadeSteps: Object.freeze([0, 100, 200]),
  loserStagger: 120,
  defeatAt: 120,
  winnerAt: 300,
  winnerStagger: 100,
  /** Gold contour frames on a winner's monster as it starts its pose. */
  contourFrames: 2,
  /** The deck-out plate starts its hop into the result plate this long before the plate opens. */
  hopLead: 120,
  /**
   * The result plate opens (A6B-3): scene 740 ms ≈ 900 ms of game time after the gameOver handler starts
   * (today's slow motion stretches its first beats; measured on flowLethal) — F9: 900–1500.
   */
  plateAt: 740,
  /** Victory poses hold their last frame until then (then the calm idle breathes again). */
  releaseAt: 1700,
  gameOver: 3100,
});

/** The beam's frames (60 fps): drop, hold (through the plate's stamps, A6B-3), out. */
export const BEAM = Object.freeze({ dropFrames: 3, holdFrames: 38, outFrames: 4, width: 7 });

/**
 * The winner's stepped gold pool on the podium floor (A6B-3, F9 "kürsüde basamaklı altın ışık havuzu"):
 * the iso ellipse round the duelist's foot (rx × ry), stepping in over `inFrames`, holding while the beam
 * holds and `holdAfterBeam` frames (≈ 400 ms) after it, then stepping out `outFrames` a level.
 */
export const POOL = Object.freeze({ rx: 21, ry: 10, inFrames: 2, holdAfterBeam: 24, outFrames: 3, flickFrames: 6 });

/**
 * The podium pool at `level` 0–3 (pure): every podium-floor pixel (the podium pads are the platform's
 * 'border' top — never its neon trim, rim or edge) inside the ellipse takes its band's gold — core
 * (inner 40 %), middle (to 70 %), rim — `level` steps up from nothing: 3 = gold2 / gold1 / gold0,
 * 2 = gold1 / gold0, 1 = gold0 at the core; `flick` lifts the core one more tone (the beam's pulse).
 * Opaque palette pixels on the floor (the stepped light language, no alpha): { x, y } is the patch's
 * top-left on screen.
 */
export function podiumPoolCanvas(player: PlayerId, level: number, flick = false): { x: number; y: number; p: PixelCanvas } {
  const pod = duelistXY(player);
  const cx = Math.round(pod.x);
  const cy = Math.round(pod.y);
  const { rx, ry } = POOL;
  const p = new PixelCanvas(2 * rx + 1, 2 * ry + 1);
  const G = [PAL.gold0, PAL.gold1, PAL.gold2, PAL.gold3];
  for (let y = -ry; y <= ry; y++)
    for (let x = -rx; x <= rx; x++) {
      const d = Math.hypot(x / rx, y / ry);
      if (d > 1) continue;
      const t = topAt(cx + x, cy + y);
      if (!t || t.kind !== 'border') continue;
      const band = d < 0.4 ? 0 : d < 0.7 ? 1 : 2;
      let n = Math.round(level) - band;
      if (n <= 0) continue;
      if (band === 0 && flick) n++;
      p.set(x + rx, y + ry, G[Math.min(G.length - 1, n - 1)]);
    }
  return { x: cx - rx, y: cy - ry, p };
}

/** The pool's level and flick `f` frames after the beam lands (null: gone). Pure. */
export function podiumPoolAt(f: number, reduced: boolean = REDUCED_MOTION): { level: number; flick: boolean } | null {
  const hold = BEAM.holdFrames + POOL.holdAfterBeam;
  if (f < 0) return null;
  if (f >= hold + 2 * POOL.outFrames) return null;
  if (f >= hold) return { level: f < hold + POOL.outFrames ? 2 : 1, flick: false };
  if (!reduced && f < POOL.inFrames) return { level: 1 + f, flick: false };
  const flick = !reduced && f < BEAM.holdFrames && Math.floor(f / POOL.flickFrames) % 2 === 0;
  return { level: 3, flick };
}

/** The stepped gold pool on the winner's podium, from the beam's landing (scene clock), until it is out. */
function podiumPool(sc: Phaser.Scene, player: PlayerId): { destroy(): void } {
  const o = podiumPoolCanvas(player, 3);
  const key = (lv: number, fl: boolean) => canvasTexture(sc, `ui3:podpool:${player}:${lv}:${fl ? 1 : 0}`, () => podiumPoolCanvas(player, lv, fl).p);
  const img = sc.add.image(o.x, o.y, key(REDUCED_MOTION ? 3 : 1, false)).setOrigin(0, 0).setDepth(STEP_DEPTH + 0.03);
  const total = (BEAM.holdFrames + POOL.holdAfterBeam + 2 * POOL.outFrames) * FRAME;
  let shown = '';
  void timeline(sc, total, (ms) => {
    if (!img.active) return;
    const a = podiumPoolAt(Math.floor((ms + 0.5) / FRAME));
    const k = a ? `${a.level}:${a.flick}` : '';
    if (k === shown) return;
    shown = k;
    if (a) img.setTexture(key(a.level, a.flick));
    img.setVisible(!!a);
  }).then(() => img.active && img.destroy());
  return { destroy: () => img.active && img.destroy() };
}

// ================================================================ deck-out pieces

/** The empty deck pad's count tag (PileView's tag: an ink plate 9 × 9, two trim rows, the count), in crimson. */
export function emptyTagCanvas(state: 'on' | 'dim' | 'rest'): PixelCanvas {
  const p = new PixelCanvas(9, 9);
  p.rect(0, 0, 9, 9, PAL.ink);
  p.hline(1, 7, 0, state === 'dim' ? PAL.crim1 : PAL.crim2);
  p.hline(1, 7, 8, state === 'dim' ? PAL.crim0 : PAL.crim1);
  const g = glyphCanvas('0'.charCodeAt(0), 'sm', state === 'on' ? PAL.crim4 : state === 'dim' ? PAL.crim1 : PAL.crim3);
  // the glyph box (w 6, h 12: caps at rows 4..8 with the outline round them): its caps on rows 2..6
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) {
      const c = g.get(x, y);
      if (c === null || c === PAL.ink) continue;
      p.set(x + 2, y - 2, c);
    }
  return p;
}

/**
 * The outline of the card that is not there: the edge pixels of the deck's top card (the iso back on the
 * pad), ordered clockwise round its centre; points relative to the tile centre. Pure (tests).
 */
export function missingCardPath(player: PlayerId): Pt[] {
  const src = isoCanvas('back', 'up', player);
  const edge: Pt[] = [];
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      if (!src.isOpaque(x, y)) continue;
      if (src.isOpaque(x - 1, y) && src.isOpaque(x + 1, y) && src.isOpaque(x, y - 1) && src.isOpaque(x, y + 1)) continue;
      edge.push([x - ISO_CX, y - ISO_CY]);
    }
  let cx = 0;
  let cy = 0;
  for (const [x, y] of edge) {
    cx += x;
    cy += y;
  }
  cx /= Math.max(1, edge.length);
  cy /= Math.max(1, edge.length);
  return edge
    .map((q) => ({ q, a: Math.atan2(q[1] - cy, q[0] - cx), d: (q[0] - cx) ** 2 + (q[1] - cy) ** 2 }))
    .sort((u, v) => u.a - v.a || u.d - v.d)
    .map((k) => k.q);
}

/** A dash pattern on the path: 2 on, 2 off, marching one pixel every two frames. */
export function dashOn(i: number, frame: number): boolean {
  return ((i + Math.floor(frame / 2)) & 3) < 2;
}

/** Where piece k of the broken outline is `b` frames after the break (whole px) and its tone (null: gone). */
export function pieceFrame(dir: XY, b: number): { dx: number; dy: number; tone: number | null } {
  const tones = [PAL.crim4, PAL.crim3, PAL.crim3, PAL.crim3, PAL.crim2, PAL.crim2, PAL.crim1, PAL.crim1, PAL.crim0, PAL.crim0, PAL.crim0];
  if (b >= tones.length) return { dx: 0, dy: 0, tone: null };
  return { dx: Math.round(dir.x * b * 0.9), dy: Math.round(dir.y * b * 0.5 + 0.22 * b * b), tone: tones[b] };
}

/** The missing card above the empty deck pad: rises in, marches, breaks into 6 falling pieces. */
async function missingCard(ctx: AnyCtx, p: PlayerId, at: XY): Promise<void> {
  const sc = ctx.scene;
  const path = missingCardPath(p);
  const n = path.length;
  if (!n) return;
  // over the bodies (as today's "0"): a monster standing in front of the deck must not hide it
  const g = sc.add.graphics().setDepth(DEPTH.FX + 10);
  const x0 = Math.round(at.x);
  const y0 = Math.round(at.y);
  const k6 = (i: number) => Math.min(5, Math.floor((i * 6) / n));
  // the card's four corners stay lit through the dashes (the shape reads at 1×)
  const corner = new Set<number>();
  for (const pick of [(q: Pt) => q[0], (q: Pt) => -q[0], (q: Pt) => q[1], (q: Pt) => -q[1]]) {
    let best = 0;
    path.forEach((q, i) => {
      if (pick(q) < pick(path[best])) best = i;
    });
    for (const d of [-1, 0, 1]) corner.add((best + d + n) % n);
  }
  // each piece's direction: from the card's middle out through its own middle
  const dirs: XY[] = [];
  for (let k = 0; k < 6; k++) {
    let sx = 0;
    let sy = 0;
    let m = 0;
    path.forEach((q, i) => {
      if (k6(i) !== k) return;
      sx += q[0];
      sy += q[1];
      m++;
    });
    const l = Math.hypot(sx, sy) || 1;
    dirs.push({ x: m ? sx / l : 0, y: m ? sy / l : 0 });
  }
  const breakF = Math.round((END_V3_MS.breakAt - END_V3_MS.cardFrom) / FRAME);
  const total = breakF + END_V3_MS.breakFrames;
  const rise = [PAL.crim1, PAL.crim2, PAL.crim3, PAL.crim4];
  let broke = false;
  await timeline(sc, total * FRAME, (ms) => {
    if (!g.active) return;
    const f = Math.floor((ms + 0.5) / FRAME);
    g.clear();
    if (f < breakF) {
      // rising in (2 px a frame to 8 px over the pad, a tone up each frame), then hovering with marching dashes;
      // every sixth frame it falters one tone down (the card cannot form)
      const r = Math.min(END_V3_MS.cardRiseFrames - 1, f);
      const lift = REDUCED_MOTION ? 8 : 2 * (r + 1);
      const rising = f < END_V3_MS.cardRiseFrames && !REDUCED_MOTION;
      const falter = !rising && f % 6 === 5;
      const tone = rising ? rise[r] : falter ? PAL.crim2 : PAL.crim3;
      path.forEach((q, i) => {
        const c = corner.has(i);
        if (!c && !dashOn(i, REDUCED_MOTION ? 0 : f)) return;
        // corners one tone brighter than the dashes (never brighter than crim4)
        g.fillStyle(c && !falter ? (rising ? rise[Math.min(3, r + 1)] : PAL.crim4) : tone, 1);
        g.fillRect(x0 + q[0], y0 + q[1] - lift, 1, 1);
      });
      return;
    }
    if (!broke) {
      broke = true;
      ctx.sfx('shatter', { volume: 0.35, pitch: 1.5 });
      void lightFlash(sc, at.x, at.y - 4, PAL.crim3, fs(22), 220, { intensity: 0.6 });
      const d = ctx.views.duelists?.get(p);
      if (d) bg(d.play('hurt'));
    }
    // broken: six pieces fall, stepping down the ramp
    const b = f - breakF;
    path.forEach((q, i) => {
      if (!dashOn(i, breakF)) return;
      const pf = pieceFrame(dirs[k6(i)], REDUCED_MOTION ? Math.min(b * 3, 10) : b);
      if (pf.tone === null) return;
      g.fillStyle(pf.tone, 1);
      g.fillRect(x0 + q[0] + pf.dx, y0 + q[1] - 8 + pf.dy, 1, 1);
    });
  });
  g.destroy();
}

// ================================================================ the loser's side goes dark

/** One palette step down `n` times along the colour's ramp (a dead neon tube ends on night1). */
export function shadeTone(c: number, n: number): number {
  if (n <= 0) return c;
  const neutral: readonly number[] = [PAL.ink, PAL.night0, PAL.night1, PAL.night2, PAL.night3, PAL.night4, PAL.steel, PAL.mist, PAL.white];
  const ni = neutral.indexOf(c);
  if (ni >= 0) return neutral[Math.max(0, ni - n)];
  for (const r of [RAMPS.cyan, RAMPS.crim]) {
    const i = (r as readonly number[]).indexOf(c);
    if (i >= 0) return i - n >= 0 ? r[i - n] : PAL.night1;
  }
  return c;
}

/** Which side a platform-top pixel belongs to (by its tile row, or by its neon trim's colour), or null. */
function sideOf(x: number, y: number, kind: string, color: number): PlayerId | null {
  if (kind === 'trim') {
    if ((RAMPS.cyan as readonly number[]).includes(color)) return 0;
    if ((RAMPS.crim as readonly number[]).includes(color)) return 1;
    return null;
  }
  const row = screenToIso(x + 0.5, y + 0.5).row;
  if (row > 2.5) return 0;
  if (row < 1.5) return 1;
  return null;
}

/** The region the shade covers (screen px): the platform top with its trim. */
export const SHADE_BOX = Object.freeze({ x: 136, y: 60, w: 368, h: 204 });

/** One side's shade map: per SHADE_BOX pixel its colour (−1: not that side's pad / line / trim) and front flag. */
interface ShadeMap {
  color: Int32Array;
  front: Uint8Array;
  /** The neon trim's pixels (the dying tube's sputter). */
  trim: Uint8Array;
  /** Rows done (the map is built a few rows a frame: topAt costs ~2.5 µs a pixel). */
  rows: number;
}

const shadeMaps: Partial<Record<PlayerId, ShadeMap>> = {};

/** Build `maxRows` more rows of `player`'s map (all of them by default); true when complete. */
export function buildShadeMap(player: PlayerId, maxRows: number = SHADE_BOX.h): boolean {
  const { x: bx, y: by, w, h } = SHADE_BOX;
  let m = shadeMaps[player];
  if (!m) m = shadeMaps[player] = { color: new Int32Array(w * h).fill(-1), front: new Uint8Array(w * h), trim: new Uint8Array(w * h), rows: 0 };
  const stop = Math.min(h, m.rows + Math.max(1, maxRows));
  for (let y = m.rows; y < stop; y++)
    for (let x = 0; x < w; x++) {
      // the other side and the bridge row are skipped before the (costly) floor lookup
      const row = screenToIso(bx + x + 0.5, by + y + 0.5).row;
      if (player === 0 ? row <= 2.5 : row >= 1.5) continue;
      const t = topAt(bx + x, by + y);
      if (!t || (t.kind !== 'pad' && t.kind !== 'pile' && t.kind !== 'gap' && t.kind !== 'line' && t.kind !== 'trim')) continue;
      if (sideOf(bx + x, by + y, t.kind, t.color) !== player) continue;
      const i = y * w + x;
      m.color[i] = t.color;
      // the front row (the one facing the bridge) goes first: P1 row 3, P2 row 1
      m.front[i] = t.kind !== 'trim' && (player === 0 ? row < 3.5 : row > 0.5) ? 1 : 0;
      m.trim[i] = t.kind === 'trim' ? 1 : 0;
    }
  m.rows = stop;
  return m.rows >= h;
}

/**
 * The loser's side `steps` (front row, the rest) palette steps darker: an opaque patch of exactly that
 * side's pad, pile, zone-line and neon-trim pixels (SHADE_BOX coordinates). Pure (tests).
 */
export function sideShadeCanvas(player: PlayerId, frontSteps: number, backSteps: number): PixelCanvas {
  const { w, h } = SHADE_BOX;
  buildShadeMap(player);
  const m = shadeMaps[player]!;
  const p = new PixelCanvas(w, h);
  for (let i = 0; i < w * h; i++) {
    const c0 = m.color[i];
    if (c0 < 0) continue;
    const n = m.front[i] ? frontSteps : backSteps;
    if (n <= 0) continue;
    const c = shadeTone(c0, n);
    if (c !== c0) p.set(i % w, Math.floor(i / w), c);
  }
  return p;
}

/** The shade on the board (just over the calm pads: the stepped light's depth), in its steps. */
async function shadeSide(ctx: AnyCtx, player: PlayerId): Promise<Phaser.GameObjects.Image> {
  const sc = ctx.scene;
  const frames: [number, number][] = REDUCED_MOTION
    ? [
        [1, 1],
        [2, 2],
      ]
    : [
        [1, 0],
        [2, 1],
        [2, 2],
      ];
  // the map is built 24 rows a frame (≈ 8 ms of floor lookups) — once per side and session, cached
  while (!buildShadeMap(player, 24)) await ctx.wait(1);
  const key = (f: [number, number]) => canvasTexture(sc, `ui3:shade:${player}:${f[0]}${f[1]}`, () => sideShadeCanvas(player, f[0], f[1]));
  const img = sc.add.image(SHADE_BOX.x, SHADE_BOX.y, key(frames[0])).setOrigin(0, 0).setDepth(STEP_DEPTH + 0.01);
  for (let i = 1; i < frames.length; i++) {
    await ctx.wait(END_V3_MS.shadeSteps[i] - END_V3_MS.shadeSteps[i - 1]);
    if (img.active) img.setTexture(key(frames[i]));
  }
  if (img.active) sputter(sc, player, img);
  return img;
}

/** The dying tube's schedule: frames (a loop of `loop`) the dead trim sputters on, and which part of it. */
export const SPUTTER = Object.freeze({
  loop: 240,
  frames: 2,
  at: Object.freeze([
    { f: 22, part: 'all' },
    { f: 26, part: 'all' },
    { f: 98, part: 'l' },
    { f: 152, part: 'all' },
    { f: 157, part: 'r' },
    { f: 206, part: 'r' },
  ] as const),
});

/** The loser's dead trim one step up (instead of two) — `part` of it: all, left or right of the screen's middle. Pure. */
export function sputterCanvas(player: PlayerId, part: 'all' | 'l' | 'r'): PixelCanvas {
  const { x: bx, w, h } = SHADE_BOX;
  buildShadeMap(player);
  const m = shadeMaps[player]!;
  const p = new PixelCanvas(w, h);
  const mid = 320 - bx;
  for (let i = 0; i < w * h; i++) {
    if (!m.trim[i] || m.color[i] < 0) continue;
    const x = i % w;
    if ((part === 'l' && x >= mid) || (part === 'r' && x < mid)) continue;
    const c = shadeTone(m.color[i], 1);
    if (c !== m.color[i]) p.set(x, Math.floor(i / w), c);
  }
  return p;
}

/** Which sputter shows at frame f of the loop (null: none). Pure. */
export function sputterAt(f: number): 'all' | 'l' | 'r' | null {
  const k = ((f % SPUTTER.loop) + SPUTTER.loop) % SPUTTER.loop;
  for (const s of SPUTTER.at) if (k >= s.f && k < s.f + SPUTTER.frames) return s.part;
  return null;
}

/** Runs the dead tube's sputter over the shade (on the scene's clock) for as long as the shade is there. */
function sputter(sc: Phaser.Scene, player: PlayerId, shade: Phaser.GameObjects.Image): void {
  if (REDUCED_MOTION) return;
  const img = sc.add.image(SHADE_BOX.x, SHADE_BOX.y, '__DEFAULT').setOrigin(0, 0).setDepth(shade.depth + 0.01).setVisible(false);
  let ms = 0;
  let shown: string | null = null;
  const onUpdate = (_t: number, dt: number) => {
    if (!shade.active || !img.active) return off();
    ms += dt * sc.tweens.timeScale;
    const part = sputterAt(Math.floor(ms / FRAME));
    if (part === shown) return;
    shown = part;
    if (part) img.setTexture(canvasTexture(sc, `ui3:sputter:${player}:${part}`, () => sputterCanvas(player, part)));
    img.setVisible(!!part);
  };
  const off = () => {
    sc.events.off('update', onUpdate);
    if (img.active) img.destroy();
  };
  sc.events.on('update', onUpdate);
  sc.events.once('shutdown', off);
}

// ================================================================ the loser's monsters fall

/** One losing monster dies its own death (no hologram glitch) and stays down through the syncs. */
async function fall(ctx: AnyCtx, u: MonsterUnit): Promise<void> {
  const sc = ctx.scene;
  if (!u.sprite.active || !u.sprite.visible || u.retired) return;
  u.posed = true;
  u.badge.setVisible(false);
  for (const k of ['equip', 'volcano']) if (u.hasAura(k)) u.setAura(k, null);
  const home = { x: u.home.x, y: u.home.y };
  if (u.has('death')) await u.play('death', { hold: true });
  else {
    void u.play(u.has('hitHeavy') ? 'hitHeavy' : 'hit', { hold: true });
    await ctx.wait(140);
  }
  if (!u.sprite.active || !u.sprite.visible) return;
  // no hit-stop (A6B-10): a loser's death at the game over is no blow, and its material's 30–50 ms stop
  // froze the whole show — the result plate's letters stalled inside the winner's name ("KAZANAN: OY")
  await shatter(sc, u.sprite, { monsterId: u.cardId, attribute: u.attribute, material: deathMaterial(u.cardId), floorY: home.y, stopMs: 0 });
  u.sprite.setVisible(false);
  u.shadow.setVisible(false);
}

// ================================================================ the winner

/** The narrow stepped gold beam onto the podium (no alpha, no ADD); `onLand` on its landing frame. */
async function goldBeam(ctx: AnyCtx, x: number, footY: number, depth: number, onLand: () => void): Promise<void> {
  const sc = ctx.scene;
  const g = sc.add.graphics().setDepth(depth);
  const top = -48; // over the world's top edge: a lean shows at most 32 px past it
  const X = Math.round(x);
  const foot = Math.round(footY);
  const total = BEAM.dropFrames + BEAM.holdFrames + BEAM.outFrames;
  let landed = false;
  const col = (dx: number, y0: number, y1: number, c: number) => {
    g.fillStyle(c, 1);
    g.fillRect(X + dx, y0, 1, Math.max(0, y1 - y0));
  };
  await timeline(sc, (REDUCED_MOTION ? BEAM.holdFrames : total) * FRAME, (ms) => {
    if (!g.active) return;
    const f = (REDUCED_MOTION ? BEAM.dropFrames - 1 : 0) + Math.floor((ms + 0.5) / FRAME);
    g.clear();
    if (f >= total) return;
    if (f < BEAM.dropFrames - 1) {
      // dropping: a 3-px core from the sky, a third / two thirds of the way down
      const y1 = Math.round(top + ((foot - top) * (f + 1)) / BEAM.dropFrames);
      col(-1, top, y1, PAL.gold3);
      col(0, top, y1, PAL.gold4);
      col(1, top, y1, PAL.gold3);
      return;
    }
    if (!landed) {
      landed = true;
      onLand();
    }
    const h = f - (BEAM.dropFrames - 1);
    if (h <= BEAM.holdFrames) {
      // landed: 7 px (A6B-3: the 5-px column read as a thread at 1×) — a white core, gold4, gold3, the
      // outer edges flicker gold2 / gold1 every two frames
      const edge = Math.floor(h / 2) % 2 === 0 ? PAL.gold2 : PAL.gold1;
      col(-3, top, foot, edge);
      col(3, top, foot, edge);
      col(-2, top, foot, PAL.gold3);
      col(2, top, foot, PAL.gold3);
      col(-1, top, foot, PAL.gold4);
      col(1, top, foot, PAL.gold4);
      col(0, top, foot, PAL.white);
      // the splash at the feet on the landing frames
      if (h < 3) {
        g.fillStyle(h === 0 ? PAL.white : PAL.gold4, 1);
        g.fillRect(X - 4 - h, foot - 1, 9 + 2 * h, 1);
      }
      return;
    }
    // out: 5 px, 3 px, then 1 px, then gone
    const o = h - BEAM.holdFrames;
    if (o <= 1) {
      col(-2, top, foot, PAL.gold2);
      col(2, top, foot, PAL.gold2);
    }
    if (o <= 2) {
      col(-1, top, foot, PAL.gold3);
      col(0, top, foot, PAL.gold4);
      col(1, top, foot, PAL.gold3);
    } else col(0, top, foot, PAL.gold2);
  });
  g.destroy();
}

/** A stepped gold ring out on the floor round the podium (back half behind, front half before the feet). */
async function goldRing(ctx: AnyCtx, at: XY, frontDepth: number): Promise<void> {
  const sc = ctx.scene;
  const steps: { r: number; tone: number }[] = REDUCED_MOTION
    ? [{ r: 16, tone: PAL.gold3 }]
    : [
        { r: 10, tone: PAL.gold4 },
        { r: 18, tone: PAL.gold3 },
        { r: 26, tone: PAL.gold2 },
        { r: 30, tone: PAL.gold1 },
      ];
  const x = Math.round(at.x);
  const y = Math.round(at.y);
  const imgs: Phaser.GameObjects.Image[] = [];
  try {
    for (const { r, tone } of steps) {
      for (const im of imgs.splice(0)) im.destroy();
      const ry = Math.round(r / 2);
      for (const half of ['back', 'front'] as const) {
        const key = canvasTexture(sc, `ui3:ring:${r}:${hex(tone)}:${half}`, () => isoRingCanvas(r, tone, half));
        imgs.push(sc.add.image(x - r, y - ry, key).setOrigin(0, 0).setDepth(half === 'back' ? DEPTH.SHADOW + 1 : frontDepth));
      }
      await ctx.wait(50);
    }
  } finally {
    for (const im of imgs) im.destroy();
  }
}

/** The podium's motes: one every `every` frames, each living `life` frames (a 1-px tail while young). */
export const MOTE = Object.freeze({ every: 7, life: 42, tailFrames: 16 });

/**
 * Mote n at `age` frames (pure): its offset from the podium's foot point, its tone and its tail's tone
 * (the pixel under it; null: none), or null. They rise 1 px every two frames from a spread of ±11 px,
 * sway a pixel now and then, and step down the gold ramp.
 */
export function moteAt(n: number, age: number): { dx: number; dy: number; tone: number; tail: number | null } | null {
  if (age < 0 || age >= MOTE.life) return null;
  const sway = Math.floor(age / 12 + (n % 2)) % 2 === 0 ? 0 : n % 3 === 0 ? -1 : 1;
  const dx = ((n * 7) % 23) - 11 + sway;
  const dy = -(n % 3) - Math.floor(age / 2);
  const tone = age < 10 ? PAL.gold4 : age < 22 ? PAL.gold3 : age < 34 ? PAL.gold2 : PAL.gold1;
  const tail = age < MOTE.tailFrames ? (age < 10 ? PAL.gold2 : PAL.gold1) : null;
  return { dx, dy, tone, tail };
}

/** Tiny gold motes rising off the winner's podium (half behind the duelist, half before), until destroyed. */
function podiumMotes(sc: Phaser.Scene, at: XY, depth: number): { destroy(): void } {
  if (REDUCED_MOTION) return { destroy() {} };
  const back = sc.add.graphics().setDepth(depth - 1);
  const front = sc.add.graphics().setDepth(depth + 0.03);
  const x0 = Math.round(at.x);
  const y0 = Math.round(at.y) - 1;
  let ms = 0;
  let last = -1;
  const draw = () => {
    if (!back.active || !front.active) return;
    const f = Math.floor(ms / FRAME);
    if (f === last) return;
    last = f;
    back.clear();
    front.clear();
    const n1 = Math.floor(f / MOTE.every);
    for (let n = Math.max(0, n1 - Math.ceil(MOTE.life / MOTE.every)); n <= n1; n++) {
      const m = moteAt(n, f - n * MOTE.every);
      if (!m) continue;
      const g = n % 2 ? front : back;
      g.fillStyle(m.tone, 1);
      g.fillRect(x0 + m.dx, y0 + m.dy, 1, 1);
      if (m.tail !== null) {
        g.fillStyle(m.tail, 1);
        g.fillRect(x0 + m.dx, y0 + m.dy + 1, 1, 1);
      }
    }
  };
  const onUpdate = (_t: number, dt: number) => {
    ms += dt * sc.tweens.timeScale;
    draw();
  };
  let done = false;
  const destroy = () => {
    if (done) return;
    done = true;
    sc.events.off('update', onUpdate);
    sc.events.off('shutdown', destroy);
    if (back.active) back.destroy();
    if (front.active) front.destroy();
  };
  sc.events.on('update', onUpdate);
  sc.events.once('shutdown', destroy);
  draw();
  return { destroy };
}

/** A 2-frame gold contour on a monster as it strikes its pose (KO-3: never a whole-sprite flare). */
async function goldContour(ctx: AnyCtx, u: MonsterUnit): Promise<void> {
  if (REDUCED_MOTION) return;
  for (const tone of [PAL.gold4, PAL.gold3].slice(0, END_V3_MS.contourFrames)) {
    if (u.retired || !u.sprite.active) return;
    const c = showContour(ctx.scene, u.sprite, tone);
    await ctx.wait(FRAME - 1);
    c?.destroy();
  }
}

// ================================================================ hooks

async function deckOutV3(ctx: Ctx<'deckOut'>): Promise<void> {
  const p = ctx.ev.player;
  const sc = ctx.scene;
  const v = ctx.views;
  const at = zoneXY(p, 'deck');
  bg(ctx.focus({ x: at.x, y: at.y - 10 }, { zoom: 1.07, ms: 320, pan: 0.45 })); // keep-lean (today's deck-out lean, flow/end.ts:41)
  const duelist = v.duelists?.get(p);
  if (duelist) bg(duelist.play('command'));
  ui3Sfx('ui3DeckOut', { volume: 0.7 }, 'uiError', { volume: 0.6 });
  // (the stand-in's low thud three frames after its click: one sound a frame, A6B-7)
  if (!ui3Ready('ui3DeckOut')) bg(ctx.wait(3 * FRAME).then(() => ctx.sfx('darkPulse', { volume: 0.3, pitch: 1.4 })));
  // the empty pad's "0": three crimson blinks, then it stays (the reason for the loss)
  const tagX = Math.round(at.x - 9 / 2);
  const tagY = Math.round(at.y + 8);
  const tagKey = (s: 'on' | 'dim' | 'rest') => canvasTexture(sc, `ui3:deckout:tag:${s}`, () => emptyTagCanvas(s));
  const tag = sc.add.image(tagX, tagY, tagKey('on')).setOrigin(0, 0).setDepth(DEPTH.FX + 10);
  bg(v.board.flashTile(p, 'deck', 0, PAL.crim3, 260));
  void lightFlash(sc, at.x, at.y, PAL.crim3, fs(28), 300, { intensity: 0.7 });
  bg(
    timeline(sc, END_V3_MS.blinks * 2 * END_V3_MS.blinkFrames * FRAME, (ms) => {
      if (!tag.active) return;
      const f = Math.floor((ms + 0.5) / FRAME);
      const on = REDUCED_MOTION || Math.floor(f / END_V3_MS.blinkFrames) % 2 === 0;
      tag.setTexture(tagKey(f >= END_V3_MS.blinks * 2 * END_V3_MS.blinkFrames ? 'rest' : on ? 'on' : 'dim'));
    }).then(() => tag.active && tag.setTexture(tagKey('rest'))),
  );
  await ctx.wait(END_V3_MS.cardFrom);
  bg(missingCard(ctx, p, at));
  await ctx.wait(END_V3_MS.deckPlateAt - END_V3_MS.cardFrom);
  // the crimson plate on the player's side (it stays; the result plate takes it over)
  TurnPlate.show(sc, { player: p, kind: 'deckOut', segments: deckOutPlateText() });
  ctx.sfx('defeat', { volume: 0.4 });
  await ctx.wait(END_V3_MS.unfocusAt - END_V3_MS.deckPlateAt);
  bg(ctx.unfocus(500)); // today's safety (flow/end.ts:86)
  await ctx.wait(END_V3_MS.deckOut - END_V3_MS.unfocusAt);
}

/** The gold pool and motes on the winner's podium (they leave with the result plate). */
let poolHandle: ReturnType<typeof lightPool> | null = null;
let motesHandle: { destroy(): void } | null = null;
/** The stepped gold pool on the podium floor (it runs its own ~1 s; it goes with the plate if that leaves first). */
let podPoolHandle: { destroy(): void } | null = null;

async function gameOverV3(ctx: Ctx<'gameOver'>): Promise<void> {
  const sc = ctx.scene;
  const v = ctx.views;
  const winner: PlayerId = ctx.ev.winner;
  const loser = other(winner);
  ctx.music.stop(500);
  bg(v.camera.unfocus(260)); // today's safety (flow/end.ts:119)
  v.speed.slowMo(END_V3_MS.slowMo, END_V3_MS.slowMoMs);
  // any plate but the deck-out one goes now (the deck-out plate hops into the result plate)
  const deckPlate = TurnPlate.current();
  const keepDeck = deckPlate && deckPlate.spec.kind === 'deckOut' ? deckPlate : null;
  if (!keepDeck) TurnPlate.dismissAll();
  const vsBot = v.info.mode === 'vsBot';
  const viewerWon = vsBot && !v.info.auto ? v.info.isHuman(winner) : null; // auto mode (QA): nobody is "the viewer"
  try {
    v.board.setActivePlayer(winner, true);
    // ---- the loser: the side goes dark, the monsters fall one by one, the duelist kneels
    const shade = shadeSide(ctx, loser);
    // the side's dark pulse on the shade's second step (A6B-7: off the frame the last card lands on the pile)
    bg(ctx.wait(END_V3_MS.shadeSteps[1]).then(() => ctx.sfx('darkPulse', { volume: 0.35, pitch: 0.7 })));
    const losers = v.field
      .units()
      .filter((u) => u.player === loser && !u.retired && u.sprite.active && u.sprite.visible)
      .sort((a, b) => a.home.x - b.home.x);
    const falls = losers.map((u, i) => ctx.wait(REDUCED_MOTION ? 0 : i * END_V3_MS.loserStagger).then(() => fall(ctx, u)));
    const ld = v.duelists?.get(loser);
    if (ld) bg(ctx.wait(END_V3_MS.defeatAt).then(() => ld.play('defeat')));
    await ctx.wait(END_V3_MS.winnerAt);

    // ---- the winner: today's lean, the beam onto the podium, the fist, the side's wave, the poses
    const wd = v.duelists?.get(winner);
    const pod = duelistXY(winner);
    const chest = wd ? wd.chest() : { x: pod.x, y: pod.y - 22 };
    bg(ctx.focus({ x: chest.x, y: chest.y }, { zoom: 1.07, ms: 520, pan: 0.35 })); // keep-lean (today's game-over lean, flow/end.ts:143)
    const depth = wd ? wd.sprite.depth : DEPTH.UNIT + pod.y;
    bg(
      goldBeam(ctx, pod.x, pod.y, depth - 1, () => {
        ctx.sfx('holyChime', { volume: 0.6 });
        if (wd) bg(wd.play('victory'));
        void lightFlash(sc, pod.x, pod.y - 16, PAL.gold3, fs(44), 520, { floorY: pod.y, ring: true, intensity: 0.9 });
        const pool = lightPool(sc, pod.x, pod.y, { color: PAL.gold3, radius: fs(30), intensity: 0.75, anim: REDUCED_MOTION ? 'steady' : 'breathe' });
        poolHandle = pool;
        // the stepped gold pool on the podium's own floor (the light layer lights only the pads: A6B-3)
        podPoolHandle = podiumPool(sc, winner);
        motesHandle = podiumMotes(sc, pod, depth);
        bg(goldRing(ctx, pod, depth + 0.02));
        bg(v.board.pulseSide(winner));
      }),
    );
    const winners = v.field
      .units()
      .filter((u) => u.player === winner && !u.retired && u.sprite.active && u.sprite.visible && u.position === 'attack')
      .sort((a, b) => a.home.x - b.home.x);
    const held: MonsterUnit[] = [];
    winners.forEach((u, i) =>
      bg(
        ctx.wait(BEAM.dropFrames * FRAME + (REDUCED_MOTION ? 0 : i * END_V3_MS.winnerStagger)).then(() => {
          if (u.retired || !u.sprite.active) return undefined;
          bg(goldContour(ctx, u));
          if (u.has('victory')) {
            held.push(u);
            return u.play('victory', { hold: true });
          }
          return u.play('roar');
        }),
      ),
    );
    if (winners.length) bg(ctx.wait(BEAM.dropFrames * FRAME + 60).then(() => ctx.sfx('roarBig', { volume: 0.4 })));

    // ---- the result plate (the deck-out plate hops into it), the sting and the fanfare
    await ctx.wait(END_V3_MS.plateAt - END_V3_MS.winnerAt - (keepDeck ? END_V3_MS.hopLead : 0));
    if (keepDeck && keepDeck.active) bg(keepDeck.shrinkTo(resultPlateRect(), ['DESTE BİTTİ'], undefined, { frames: 7 }));
    if (keepDeck) await ctx.wait(END_V3_MS.hopLead);
    const plate = ResultPlate.show(sc, { winner, reason: ctx.ev.reason, viewerWon });
    const pool = poolHandle;
    if (pool) plate.attach({ destroy: () => void pool.fadeOut(300) });
    const motes = motesHandle;
    if (motes) plate.attach(motes);
    const podPool = podPoolHandle;
    if (podPool) plate.attach(podPool);
    if (viewerWon === false) ui3Sfx('ui3Defeat', {}, 'defeat', { volume: 0.6 });
    else ui3Sfx('ui3Victory', {}, 'victory', { volume: 0.8 });
    if (ctx.settings.music) ctx.music.play('victory');
    // the victory poses hold their last frame through the stamps, then the idle breathes again
    await ctx.wait(END_V3_MS.releaseAt - END_V3_MS.plateAt);
    for (const u of held) if (!u.retired && u.sprite.active && !u.posed) u.settle();
    // the hold (the falls and the shade are long over; never waited for past the handler's end)
    void Promise.all([shade, ...falls]).catch((e) => console.error('[end] game over', e));
    await ctx.wait(END_V3_MS.gameOver - END_V3_MS.releaseAt);
  } finally {
    poolHandle = null;
    motesHandle = null;
    podPoolHandle = null;
    bg(ctx.unfocus(700)); // today's safety (flow/end.ts:173)
  }
}

// ================================================================ helpers

/** fn(ms) on the scene's tween clock from 0 to `ms` (speed aware); resolves at the end. */
function timeline(sc: Phaser.Scene, ms: number, fn: (ms: number) => void): Promise<void> {
  return new Promise((resolve) => {
    fn(0);
    sc.tweens.addCounter({
      from: 0,
      to: ms,
      duration: Math.max(1, ms),
      onUpdate: (tw) => fn(tw.getValue() ?? 0),
      onComplete: () => {
        fn(ms);
        resolve();
      },
      onStop: () => resolve(),
    });
  });
}

if (V3_A6_B) {
  V3HOOKS.deckOut = deckOutV3;
  V3HOOKS.gameOver = gameOverV3;
}
