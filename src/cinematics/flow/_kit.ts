// Shared helpers of the DUEL FLOW cinematics (src/cinematics/flow). No registrations here.
//
//   music intensity     intensityFor(state, phase) — calm / tense (LP < 1000) / battle levels
//   coinTexture         the pixel coin of the opening flip (N rotation frames, both faces)
//   chevronTexture      ▲/▼ stat arrows (statChange)
//   beamDrop            a light beam that strikes a podium from the sky (duelist entrance)
//   isoGhost            a floating iso card (deck lift, deck-out static)
//   emberStream         card pixels that burn off and stream into a pile (discard)

import Phaser from 'phaser';
import type { GameEvent, GameEventType, GameState, Phase, PlayerId } from '../../engine/types';
import { PAL, PLAYER_RAMP, type Ramp } from '../../art/palette';
import { PixelCanvas, shade } from '../../art/pixel';
import { ISO_CX, ISO_CY, ISO_TEX_H, ISO_TEX_W, cardIsoKey } from '../../art/cards';
import { DEPTH, type XY } from '../../view/layout';
import { TEX } from '../../vfx/core';
import { Raster, Sparks, onFrame, run } from '../../vfx/setpieces';
import type { CinematicContext } from '../api';

export type EvOf<T extends GameEventType> = Extract<GameEvent, { type: T }>;
export type Ctx<T extends GameEventType> = CinematicContext<EvOf<T>>;
export type AnyCtx = CinematicContext<GameEvent>;

export const TAU = Math.PI * 2;
export const ADD = Phaser.BlendModes.ADD;

export const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);
export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Fire-and-forget: never rejects, logs errors. */
export function bg(p: Promise<unknown> | void | undefined): void {
  if (p) p.catch((e) => console.error('[flow]', e));
}

/** Wait for all, never reject. */
export async function all(ps: Promise<unknown>[]): Promise<void> {
  await Promise.all(ps.map((p) => p.catch((e) => console.error('[flow]', e))));
}

let seedState = 0x51f0a3c7;
export function seed(n: number): void {
  seedState = (n * 2654435761) >>> 0 || 1;
}
export function rnd(): number {
  seedState = (seedState * 1664525 + 1013904223) >>> 0;
  return seedState / 4294967296;
}
export const rr = (a: number, b: number): number => a + (b - a) * rnd();

/** The world camera is at zoom 1 with no pan. */
export function cameraAtRest(ctx: AnyCtx): boolean {
  const m = ctx.views.camera.main;
  return Math.abs(m.zoom - 1) < 0.001 && Math.abs(m.scrollX) < 0.5 && Math.abs(m.scrollY) < 0.5;
}

// ================================================================ music

/** Music intensity levels (0..1) of the duel track. */
export const INTENSITY = {
  opening: 0.2,
  calm: 0.35,
  /** Somebody is under 1000 LP: the hot layer stays in. */
  tense: 0.7,
  battle: 0.85,
  battleTense: 1,
} as const;

/** Low LP: either player under 1000. */
export function lowLp(s: GameState): boolean {
  return s.players.some((p) => p.lp > 0 && p.lp < 1000);
}

/** Intensity for a moment of the duel: battle phase up, low LP up, everything else calm. */
export function intensityFor(s: GameState, phase: Phase = s.phase): number {
  const tense = lowLp(s);
  if (phase === 'battle') return tense ? INTENSITY.battleTense : INTENSITY.battle;
  return tense ? INTENSITY.tense : INTENSITY.calm;
}

// ================================================================ the coin

/** Rotation frames of the coin (end over end). Frame 0 shows player 1's face, N/2 player 2's. */
export const COIN_N = 20;
export const COIN_D = 33;
const COIN_FRAME = 37;
export const COIN_KEY = 'flow:coin';

const DIGITS: Record<PlayerId, string[]> = {
  0: ['...##..', '..###..', '.####..', '...##..', '...##..', '...##..', '...##..', '...##..', '...##..', '.######', '.######'],
  1: ['.#####.', '##...##', '.....##', '.....##', '....##.', '...##..', '..##...', '.##....', '##.....', '#######', '#######'],
};

function coinFace(p: PlayerId): PixelCanvas {
  const D = COIN_D;
  const c = new PixelCanvas(D, D);
  const m = (D - 1) / 2;
  const R = PLAYER_RAMP[p];
  c.disc(m, m, m + 0.5, PAL.gold1);
  c.disc(m, m, m - 0.5, PAL.gold3);
  // rim lighting: top-left bright, bottom-right dark (light from the upper left)
  for (let y = 0; y < D; y++)
    for (let x = 0; x < D; x++) {
      const dx = x - m;
      const dy = y - m;
      const r = Math.hypot(dx, dy);
      if (r > m - 0.5 || r < m - 3.5) continue;
      const l = (-dx - dy) / (r || 1);
      if (l > 0.55) c.set(x, y, PAL.gold4);
      else if (l < -0.55) c.set(x, y, PAL.gold2);
    }
  // reeded dots on the rim
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    c.set(Math.round(m + Math.cos(a) * (m - 2)), Math.round(m + Math.sin(a) * (m - 2)), i % 2 ? PAL.gold2 : PAL.gold4);
  }
  // inner field in the player's colour
  c.disc(m, m, m - 4, PAL.gold1);
  c.disc(m, m, m - 5, R[1]);
  c.disc(m - 1, m - 1, m - 7, R[2]);
  // a soft shine across the field
  for (let k = -2; k <= 2; k++) c.set(Math.round(m - 6 + k), Math.round(m - 8 - k), R[3]);
  c.set(Math.round(m - 8), Math.round(m - 5), R[3]).set(Math.round(m - 9), Math.round(m - 4), R[3]);
  // the player number (embossed)
  const g = DIGITS[p];
  const gx = Math.round(m - 3);
  const gy = Math.round(m - 5);
  c.stamp(g, { '#': PAL.ink }, gx + 1, gy + 1);
  c.stamp(g, { '#': R[4] }, gx, gy);
  // highlight on the digit's top-left pixels
  g.forEach((row, y) => {
    const x = row.indexOf('#');
    if (x >= 0) c.set(gx + x, gy + y, PAL.white);
  });
  return c;
}

/**
 * Coin spritesheet: frame k is the coin rotated k·TAU/N around the horizontal axis (it flips
 * end over end). The face squashes vertically; the reeded edge shows below / above it.
 */
export function coinTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(COIN_KEY)) return COIN_KEY;
  const faces = [coinFace(0), coinFace(1)];
  const D = COIN_D;
  const W = COIN_FRAME;
  const sheet = new PixelCanvas(W * COIN_N, W);
  const T = 4; // coin thickness (px at full side view)
  for (let k = 0; k < COIN_N; k++) {
    const a = (k / COIN_N) * TAU;
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    const face = faces[cs >= 0 ? 0 : 1];
    const h = Math.round(D * Math.abs(cs));
    const e = Math.max(Math.abs(cs) < 0.35 ? 2 : 0, Math.round(T * Math.abs(sn)));
    const rimBelow = sn * (cs >= 0 ? 1 : -1) > 0;
    const f = new PixelCanvas(W, W);
    const cx = (W - D) / 2;
    const top = Math.round((W - h - e) / 2) + (rimBelow ? 0 : e);
    const dim = Math.abs(cs) < 0.5;
    const m = (D - 1) / 2;
    for (let x = 0; x < D; x++) {
      const dx = (x - m) / (m + 0.5);
      if (Math.abs(dx) > 1) continue;
      const half = Math.sqrt(Math.max(0, 1 - dx * dx));
      // column extent of the squashed face
      const y0 = Math.round(top + (h / 2) * (1 - half));
      const y1 = Math.round(top + (h / 2) * (1 + half)) - 1;
      if (h >= 2) {
        for (let y = y0; y <= y1; y++) {
          const sy = Math.min(D - 1, Math.max(0, Math.floor(((y - top + 0.5) * D) / Math.max(1, h))));
          const col = face.get(x, sy);
          if (col === null) continue;
          f.set(cx + x, y, dim ? shade(col, -1) : col);
        }
      }
      // the reeded edge band
      if (e > 0 && half > 0.08) {
        for (let k2 = 1; k2 <= e; k2++) {
          const y = rimBelow ? Math.max(y1, Math.round(top + h / 2)) + k2 : Math.min(y0, Math.round(top + h / 2)) - k2;
          const lit = rimBelow ? k2 === 1 : k2 === e;
          f.set(cx + x, y, lit ? PAL.gold3 : x % 2 ? PAL.gold2 : PAL.gold1);
        }
      }
    }
    f.outline(PAL.ink);
    sheet.blit(f, k * W, 0);
  }
  const tex = scene.textures.addCanvas(COIN_KEY, sheet.toCanvas());
  if (tex) for (let k = 0; k < COIN_N; k++) tex.add(k, 0, k * W, 0, W, W);
  return COIN_KEY;
}

/** Coin frame for a rotation angle (radians; 0 = player 1's face up). */
export function coinFrame(a: number): number {
  const k = Math.round((a / TAU) * COIN_N);
  return ((k % COIN_N) + COIN_N) % COIN_N;
}

// ================================================================ stat chevrons

/** 7×4 chevrons (white, tint them): 'flow:chev:up' ▲ and 'flow:chev:down' ▼. */
export function chevronTexture(scene: Phaser.Scene, up: boolean): string {
  const key = up ? 'flow:chev2:up' : 'flow:chev2:down';
  if (scene.textures.exists(key)) return key;
  const c = new PixelCanvas(7, 4);
  const rows = ['...#...', '..###..', '.##.##.', '##...##'];
  c.stamp(up ? rows : [...rows].reverse(), { '#': PAL.white }, 0, 0);
  scene.textures.addCanvas(key, c.toCanvas());
  return key;
}

// ================================================================ light beam from the sky

/**
 * A beam of light strikes down onto (x, groundY): it drops from above the screen in `dropMs`,
 * holds, then pinches to a thread and fades. Resolves when it is gone; `onHit` at touchdown.
 */
export async function beamDrop(
  scene: Phaser.Scene,
  x: number,
  groundY: number,
  ramp: Ramp,
  o: { dropMs?: number; holdMs?: number; outMs?: number; top?: number; width?: number; depth?: number; onHit?: () => void } = {},
): Promise<void> {
  const dropMs = o.dropMs ?? 110;
  const holdMs = o.holdMs ?? 220;
  const outMs = o.outMs ?? 200;
  const top = o.top ?? groundY - 260;
  const W = o.width ?? 11;
  const r = new Raster(scene, x - 16, top, 32, groundY - top + 6, o.depth ?? DEPTH.FX, ADD);
  let hit = false;
  await run(scene, dropMs + holdMs + outMs, (_t, el) => {
    const yHead = el < dropMs ? lerp(top, groundY, (el / dropMs) ** 2) : groundY;
    if (!hit && el >= dropMs) {
      hit = true;
      o.onHit?.();
    }
    const out = el > dropMs + holdMs ? clamp01((el - dropMs - holdMs) / outMs) : 0;
    const w = Math.max(1, W * (1 - out * 0.85) * (el < dropMs ? 0.6 : 1 + 0.25 * Math.sin(el * 0.05)));
    const lv = 1 - out * out;
    r.draw((g) => {
      const tailTop = el < dropMs ? Math.max(top, yHead - 120) : top;
      for (let y = Math.floor(tailTop); y <= yHead; y++) {
        const fadeTop = clamp01((y - top) / 40);
        const k = lv * fadeTop;
        if (k <= 0.02) continue;
        const hw = w / 2;
        for (let dx = -Math.ceil(hw + 2); dx <= Math.ceil(hw + 2); dx++) {
          const ad = Math.abs(dx);
          let c: number;
          let lvl: number;
          if (ad <= hw * 0.3) {
            c = PAL.white;
            lvl = k;
          } else if (ad <= hw * 0.65) {
            c = ramp[4];
            lvl = k;
          } else if (ad <= hw) {
            c = ramp[3];
            lvl = k * 0.85;
          } else {
            c = ramp[2];
            lvl = k * 0.35;
          }
          g.dpx(x + dx, y, c, lvl);
        }
      }
      // the bright head while falling, a floor splash after
      if (el < dropMs) g.disc(x, yHead, 2.5, PAL.white);
      else if (out < 1) {
        const s = clamp01((el - dropMs) / 160);
        g.ring(x, groundY, 4 + s * 12, 2 + s * 6, ramp[4], (1 - s) * lv);
      }
    });
  });
  r.destroy();
}

// ================================================================ iso card ghost

/** A face-down iso card (deck back) as a loose image at a pile's top — lift / static effects. */
export function isoGhost(scene: Phaser.Scene, p: PlayerId, at: XY, depth: number): Phaser.GameObjects.Image {
  return scene.add
    .image(Math.round(at.x), Math.round(at.y), cardIsoKey('back', 'up', p))
    .setOrigin(ISO_CX / ISO_TEX_W, ISO_CY / ISO_TEX_H)
    .setDepth(depth);
}

// ================================================================ ember stream

/**
 * Pixels sampled from a card picture burn off along a front that climbs the card and stream
 * along arcs into `to` (a pile). `pc` = the card's pixels, `place(x, y)` maps a card pixel to
 * world space. Resolves when the first embers arrive (`onArrive`), the tail keeps flowing.
 */
export function emberStream(
  scene: Phaser.Scene,
  pc: PixelCanvas,
  place: (x: number, y: number) => XY,
  to: XY,
  o: { ramp: Ramp; burnMs?: number; flyMs?: number; depth?: number; every?: number; onArrive?: () => void; arc?: number },
): Promise<void> {
  const burnMs = o.burnMs ?? 520;
  const flyMs = o.flyMs ?? 520;
  const every = o.every ?? 3;
  const sp = new Sparks(scene, o.depth ?? DEPTH.FX_TOP + 20, ADD);
  let firstArrival = Infinity;
  for (let y = 0; y < pc.h; y += every)
    for (let x = (y / every) % 2 ? 1 : 0; x < pc.w; x += every) {
      const col = pc.get(x, y);
      if (col === null) continue;
      const w = place(x, y);
      // bottom rows burn first
      const tb = burnMs * (1 - y / pc.h) * 0.85 + rnd() * burnMs * 0.15;
      const life = flyMs * rr(0.85, 1.15);
      const arrive = tb + life;
      firstArrival = Math.min(firstArrival, arrive);
      sp.add({
        x: w.x,
        y: w.y,
        vx: rr(-30, 30),
        vy: rr(-90, -40),
        drag: 1.5,
        delay: tb,
        life,
        home: { x: to.x + rr(-3, 3), y: to.y + rr(-2, 2), k: rr(0.28, 0.4) },
        ramp: [PAL.white, o.ramp[4], col, o.ramp[3], o.ramp[2]],
        trail: rnd() < 0.35,
        tex: rnd() < 0.15 ? TEX.px2 : TEX.px1,
        fade: 0.15,
      });
    }
  sp.close();
  const firstAt = Number.isFinite(firstArrival) ? firstArrival * 0.82 : burnMs;
  return new Promise<void>((resolve) => {
    let done = false;
    onFrame(scene, (_dt, el) => {
      if (!done && el >= firstAt) {
        done = true;
        o.onArrive?.();
        resolve();
        return false;
      }
      return true;
    });
  });
}
