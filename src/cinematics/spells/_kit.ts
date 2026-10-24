// Shared choreography for the five spell cinematics (judgment_bolt, healing_spring, soul_recall,
// dragon_blade, volcano_arena). No registrations here — only building blocks:
//
//   const op = await spellOpening(ctx, { uid, cardId, player, from: 'hand' | 'set', zone });
//   await op.release(target, { path: 'up' | 'arc' | 'dive' });   // the card turns into energy and flies
//   const tile = await op.land({ spot: 'spellTrap', index });    // equip / field: it settles on its zone
//   await op.close();                                            // nothing to do (fizzle)
//
// The common opening (GAME_DESIGN §7 "Ortak açılış"):
//   hand: the card dips (anticipation), launches out of the hand with a teal trail, spins up to
//         the middle of the field at 2× and lands there with a squash — while a rune seal inks
//         itself in behind it and a teal aura blooms;
//   set:  the face-down tile flashes, a thin teal column bursts out of it, the card springs
//         upright on its tile and turns face-up (revealed on the board first), then lifts off to
//         the middle at 2× — a visibly different "trap-like" opening.
//   Both: the caster's duelist commands, the name plate wipes in under the card as it arrives
//   ("YILDIRIM HÜKMÜ"), motes converge into the card, it hovers ~0.3 s; the camera pushes in a
//   touch. The plate stays up a little into the release so it is readable for ~0.5 s in all.
//
// Timing (speed 1): hand ≈ 50 dip + 230 flight + hold (default 300); set ≈ 180 stand-up + 230
// flight + hold − 110. The release inhale takes ~160 ms before the energy orb launches. Spells
// pick their hold so the whole activation fits the 2.5 s budget (§5).
//
// Everything runs on scene time (speed / hit-stop aware) and cleans itself up.

import Phaser from 'phaser';
import { CARDS, type CardId } from '../../data/cards';
import type { GameEvent, PlayerId, Uid } from '../../engine/types';
import { PAL, RAMPS, type Ramp } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { AK } from '../../art/arena';
import { CARD_SIL, STAND_H, isoProject } from '../../art/cards';
import { CardSprite } from '../../view/CardSprite';
import type { TileCard } from '../../view/TileCard';
import { BOARD_CENTER, DEPTH, LOOK_V3, TILE_H, TILE_W, type XY, duelistXY, zoneXY } from '../../view/layout';
import { lightBeam, lightDim, lightFlash, lightPool, type BeamHandle, type LightHandle } from '../../view/light';
import { measureText, pixelText, revealText, upper } from '../../ui/text';
import { TEX, shake, tween, wait } from '../../vfx/core';
import { E, Raster, Sparks, clamp01, floorRing, lerp, onFrame, qbez, rnd, rr, run, seg, tileFlash } from '../../vfx/setpieces';
import { sparkleBurst } from '../../vfx/summon';
import { Sparks as PxSparks } from '../../vfx/combat';
import { cardLeaves } from '../_v3/card';
import { play as playV3 } from '../_v3/sound';
import { fx, type CinematicContext } from '../api';

export type AnyCtx = CinematicContext<GameEvent>;
export type ActCtx = CinematicContext<Extract<GameEvent, { type: 'activate' }>>;

const TAU = Math.PI * 2;
const ADD = Phaser.BlendModes.ADD;

/** Spell colour language: teal (dark → light) and a birth → death particle ramp. */
export const TEAL: Ramp = RAMPS.teal;
export const TEAL_FX = [PAL.white, PAL.teal4, PAL.teal3, PAL.teal2, PAL.teal1] as const;
export const GOLD_FX = [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2, PAL.gold1] as const;
export const CYAN_FX = [PAL.white, PAL.cyan4, PAL.cyan3, PAL.cyan2, PAL.cyan1] as const;

// the subtle light layer (arena v2; every call is a no-op in v1)
export { lightBeam, lightDim, lightFlash, lightPool, type BeamHandle, type LightHandle };

/**
 * Floor scale of the arena: 1 on the v1 64×32 tiles, 1.25 on the v2 80×40 tiles (floor rings,
 * pools and seals around a tile are sized with it).
 */
export const TS = TILE_W / 64;
/** A floor size in the current arena (whole pixels; v1 values pass through untouched). */
export const fs = (v: number): number => (TS === 1 ? v : Math.round(v * TS));

/**
 * Where the showcase card hangs: over the middle of the field, a tile's height above the
 * board centre (the no-man's land / energy bridge). v1 (320, 128), v2 (320, 136).
 */
export const SHOW_AT: XY = { x: BOARD_CENTER.x, y: BOARD_CENTER.y - TILE_H };
/** The floor under the showcase card (where its light lands). */
export const SHOW_FLOOR = BOARD_CENTER.y + Math.round(TILE_H / 2);
const SHOW_SCALE = 2;

// ================================================================ small utils

export function idxOf(ctx: AnyCtx, run: readonly number[], pred: (e: GameEvent) => boolean): number {
  return run.find((i) => pred(ctx.events[i])) ?? -1;
}

export function evAt<T extends GameEvent['type']>(ctx: AnyCtx, i: number, type: T): Extract<GameEvent, { type: T }> | null {
  if (i < 0) return null;
  const e = ctx.events[i];
  return e && e.type === type ? (e as Extract<GameEvent, { type: T }>) : null;
}

/** Fire-and-forget that never lets a decorative effect reject. */
export function bg(p: Promise<unknown>): void {
  void p.catch((e) => console.error('[spells]', e));
}

/** Integer point. */
export function ip(p: XY): XY {
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

/** Where the card of an activation sits right now (its set tile), or null. */
export function setTileOf(ctx: ActCtx): TileCard | null {
  const ev = ctx.ev;
  if (ev.from !== 'spellTrap' || ev.zone === null) return null;
  const t = ctx.views.field.tileAt(ev.player, 'spellTrap', ev.zone);
  return t && t.active ? t : null;
}

// ================================================================ rune glyphs (teal)

const RUNE_KEY = 'spells:rune';
const RUNES: readonly string[][] = [
  ['..#..', '.###.', '#.#.#', '..#..', '..#..'],
  ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  ['###..', '#..#.', '###..', '#..#.', '#...#'],
  ['..#..', '.#.#.', '#...#', '.#.#.', '..#..'],
  ['#.#.#', '#.#.#', '#####', '..#..', '..#..'],
  ['.###.', '#...#', '..##.', '.#...', '#####'],
  ['#....', '###..', '#.#..', '#.###', '....#'],
  ['.#.#.', '#####', '.#.#.', '#####', '.#.#.'],
];

function runeTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(RUNE_KEY)) return RUNE_KEY;
  const sheet = new PixelCanvas(7 * RUNES.length, 7);
  RUNES.forEach((rows, i) => {
    const g = new PixelCanvas(7, 7);
    rows.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && g.set(x + 1, y + 1, PAL.teal4)));
    g.outline(PAL.teal1, { corners: false });
    sheet.blit(g, i * 7, 0);
  });
  const tex = scene.textures.addCanvas(RUNE_KEY, sheet.toCanvas())!;
  RUNES.forEach((_, i) => tex.add(`r${i}`, 0, i * 7, 0, 7, 7));
  return RUNE_KEY;
}

// ================================================================ the rune seal behind the card

interface Seal {
  /** Draw-on progress reached 1. */
  ready: Promise<void>;
  /** Spin multiplier. */
  spin(k: number): void;
  /** Collapse into its centre with a white flash (release). Resolves when gone. */
  implode(ms?: number): Promise<void>;
  /** Dither away. */
  dismiss(ms?: number): Promise<void>;
}

function makeSeal(scene: Phaser.Scene, c: XY, o: { drawMs?: number; r?: number } = {}): Seal {
  const R = o.r ?? 84;
  const drawMs = o.drawMs ?? 300;
  const ras = Raster.around(scene, c.x, c.y, R * 2 + 24, R * 2 + 24, DEPTH.FX_TOP + 8, ADD);
  const key = runeTexture(scene);
  const runes = RUNES.map((_, i) => scene.add.image(c.x, c.y, key, `r${i}`).setDepth(DEPTH.FX_TOP + 9).setBlendMode(ADD).setVisible(false));
  let p = 0;
  let level = 1;
  let radiusK = 1;
  let white = 0;
  let spinK = 1;
  let a = 0;
  let b = 0;
  let dead = false;
  let resolveReady: () => void = () => undefined;
  const ready = new Promise<void>((r) => (resolveReady = r));
  const flashed = new Set<number>();
  const stop = onFrame(scene, (dt) => {
    if (dead) return false;
    p = Math.min(1, p + dt / drawMs);
    if (p >= 1) resolveReady();
    a += dt * 0.0011 * spinK;
    b -= dt * 0.0007 * spinK;
    const r = R * radiusK;
    ras.draw((g) => {
      if (level <= 0.01 || r < 1) return;
      const col = (base: number) => (white > 0.5 ? PAL.white : base);
      const a0 = -Math.PI / 2;
      // outer double ring inks itself in clockwise, the inner one counter-clockwise
      g.ring(c.x, c.y, r, r, col(PAL.teal3), level, a0, a0 + TAU * p);
      g.ring(c.x, c.y, r - 3, r - 3, col(PAL.teal1), level * 0.8, a0, a0 + TAU * p);
      g.ring(c.x, c.y, r * 0.74, r * 0.74, col(PAL.teal2), level * 0.9, a0 - TAU * p, a0);
      // ticks on the outer band
      const ticks = 24;
      for (let i = 0; i < ticks; i++) {
        const t = a + (i / ticks) * TAU;
        if ((i / ticks) > p) continue;
        const ca = Math.cos(t);
        const sa = Math.sin(t);
        const long = i % 3 === 0;
        g.line(c.x + ca * (r + 2), c.y + sa * (r + 2), c.x + ca * (r + (long ? 6 : 4)), c.y + sa * (r + (long ? 6 : 4)), col(long ? PAL.teal4 : PAL.teal2), level);
      }
      // hexagram (two triangles), counter-rotating, fades in on the second half of the draw
      const hk = seg(p, 0.45, 1);
      if (hk > 0) {
        const pts: XY[] = [];
        for (let i = 0; i < 6; i++) pts.push({ x: c.x + Math.cos(b + (i * TAU) / 6) * r * 0.72, y: c.y + Math.sin(b + (i * TAU) / 6) * r * 0.72 });
        for (const tri of [
          [0, 2, 4],
          [1, 3, 5],
        ]) {
          for (let k = 0; k < 3; k++) {
            const q0 = pts[tri[k]];
            const q1 = pts[tri[(k + 1) % 3]];
            g.line(q0.x, q0.y, lerp(q0.x, q1.x, hk), lerp(q0.y, q1.y, hk), col(PAL.teal2), level * 0.75);
          }
        }
      }
      // bright nodes travelling around the outer ring
      for (let i = 0; i < 4; i++) {
        const t = a * 2.2 + (i * TAU) / 4;
        g.disc(c.x + Math.cos(t) * r, c.y + Math.sin(t) * r, 1.2, PAL.white, level * Math.min(1, p * 2));
      }
    });
    // runes orbit between the rings and pop in one by one (white first frame)
    const rr0 = r * 0.87;
    runes.forEach((img, i) => {
      const t = -a * 0.8 + (i * TAU) / runes.length;
      const on = p >= i / runes.length && level > 0.05 && r > 4;
      img.setVisible(on);
      if (!on) return;
      img.setPosition(Math.round(c.x + Math.cos(t) * rr0), Math.round(c.y + Math.sin(t) * rr0));
      if (!flashed.has(i)) {
        flashed.add(i);
        img.setTintFill(PAL.white);
      } else if (white > 0.5) img.setTintFill(PAL.white);
      else img.clearTint();
      img.setAlpha(level > 0.66 ? 1 : level > 0.33 ? 0.6 : 0.3);
    });
    return true;
  });
  const kill = () => {
    if (dead) return;
    dead = true;
    stop();
    ras.destroy();
    runes.forEach((r) => r.destroy());
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, kill);
  return {
    ready,
    spin(k) {
      spinK = k;
    },
    async implode(ms = 150) {
      white = 1;
      spinK = 4;
      await run(scene, ms, (t) => {
        radiusK = 1 - E.inQuad(t);
        white = t < 0.5 ? 1 : 0;
      });
      kill();
    },
    async dismiss(ms = 220) {
      await run(scene, ms, (t) => {
        level = 1 - t;
        radiusK = 1 + t * 0.12;
      });
      kill();
    },
  };
}

// ================================================================ name plate

/** A spell's name plate (S-11: exported for lane A5-B's entry stamp, A5 §3.8 B-8). */
export interface Plate {
  hide(ms?: number): Promise<void>;
}

/**
 * Options of namePlate (A5 §4.3 / S-11). Every field defaults to the spell plate as it has always
 * been (teal, 7 ms per letter, FX_TOP + 12): calls without options behave exactly as before.
 */
export interface NamePlateOpts {
  /** The plate's top / bottom line and the end caps' outer pixels (default teal3). */
  line?: number;
  /** The inner hairline under the top line (default teal1). */
  inner?: number;
  /** The letters and the end caps' centre pixel (default teal4; the newest letters flash white). */
  text?: number;
  /** Reveal pace: ms per letter (default 7). */
  msPerLetter?: number;
  /** Reveal one letter per rendered frame instead (an entry stamp: "harfler kare başına bir gelir"). */
  perFrame?: boolean;
  /** Depth of the plate (the letters go 1 above; default DEPTH.FX_TOP + 12). */
  depth?: number;
}

/**
 * The name plate stamped under a card (A2 spell opening): an ink band wipes open, the name types in
 * letter by letter, the newest letters white. hide() steps it out.
 */
export function namePlate(scene: Phaser.Scene, cardId: CardId, at: XY, po: NamePlateOpts = {}): Plate {
  const cLine = po.line ?? PAL.teal3;
  const cInner = po.inner ?? PAL.teal1;
  const cText = po.text ?? PAL.teal4;
  const msPerLetter = po.msPerLetter ?? 7;
  const depth = po.depth ?? DEPTH.FX_TOP + 12;
  const name = upper(CARDS[cardId].name);
  const tm = measureText(name, 'md');
  const W = tm.w + 22;
  const H = 15;
  const x0 = Math.round(at.x - W / 2);
  const y0 = Math.round(at.y - H / 2);
  const ras = new Raster(scene, x0 - 6, y0 - 2, W + 12, H + 4, depth);
  const txt = pixelText(scene, Math.round(at.x), Math.round(at.y), name, { size: 'md', color: cText, originX: 0.5, originY: 0.5 }).setDepth(depth + 1);
  const total = revealText(txt, 0);
  let open = 0;
  let level = 1;
  let shown = 0;
  let dead = false;
  const draw = () =>
    ras.draw((g) => {
      if (open <= 0.01 || level <= 0.01) return;
      const w = Math.max(2, Math.round(W * open));
      const l = Math.round(at.x - w / 2);
      g.rect(l, y0 + 1, w, H - 2, PAL.ink, level >= 1 ? 0.88 : level * 0.8);
      g.rect(l, y0, w, 1, cLine, level);
      g.rect(l, y0 + H - 1, w, 1, cLine, level);
      g.rect(l + 2, y0 + 2, w - 4, 1, cInner, level * 0.6);
      // end caps: little diamonds
      for (const ex of [l - 3, l + w + 2]) {
        g.px(ex, y0 + 7, cText, level);
        g.px(ex - 1, y0 + 7, cLine, level);
        g.px(ex + 1, y0 + 7, cLine, level);
        g.px(ex, y0 + 6, cLine, level);
        g.px(ex, y0 + 8, cLine, level);
      }
    });
  const stop = onFrame(scene, (dt) => {
    if (dead) return false;
    open = Math.min(1, open + dt / 80);
    if (open >= 1 && shown < total) {
      shown = Math.min(total, shown + (po.perFrame ? (dt > 0 ? 1 : 0) : dt / msPerLetter));
      revealText(txt, Math.floor(shown));
      // the newest letters flash white
      txt.setTint(shown < total ? PAL.white : cText);
    }
    draw();
    return true;
  });
  const kill = () => {
    if (dead) return;
    dead = true;
    stop();
    ras.destroy();
    txt.destroy();
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, kill);
  return {
    async hide(ms = 160) {
      if (dead) return;
      await run(scene, ms, (t) => {
        level = 1 - t;
        open = 1 - E.inQuad(t) * 0.6;
        txt.setAlpha(t < 0.4 ? 1 : t < 0.7 ? 0.6 : 0.25);
      });
      kill();
    },
  };
}

// ================================================================ star flare

/** Four-point white/teal star that pops and shrinks (the instant the card becomes light). */
export function starFlare(scene: Phaser.Scene, at: XY, ms = 220, ramp: readonly number[] = TEAL_FX, size = 26): Promise<void> {
  const ras = Raster.around(scene, at.x, at.y, size * 2 + 6, size * 2 + 6, DEPTH.FX_TOP + 13, ADD);
  return run(scene, ms, (t) => {
    const k = t < 0.25 ? E.outCubic(t / 0.25) : 1 - E.inQuad((t - 0.25) / 0.75);
    ras.draw((g) => {
      const L = size * k;
      const l2 = L * 0.45;
      g.line(at.x - L, at.y, at.x + L, at.y, ramp[1], 1);
      g.line(at.x, at.y - L, at.x, at.y + L, ramp[1], 1);
      g.line(at.x - l2, at.y - l2 * 0.7, at.x + l2, at.y + l2 * 0.7, ramp[2], 0.7);
      g.line(at.x - l2, at.y + l2 * 0.7, at.x + l2, at.y - l2 * 0.7, ramp[2], 0.7);
      g.line(at.x - L * 0.6, at.y, at.x + L * 0.6, at.y, PAL.white, 1);
      g.line(at.x, at.y - L * 0.6, at.x, at.y + L * 0.6, PAL.white, 1);
      g.disc(at.x, at.y, 1 + 3 * k, PAL.white, 1);
      g.disc(at.x, at.y, 3 + 6 * k, ramp[2], 0.4 * k);
    });
  }).then(() => ras.destroy());
}

// ================================================================ energy streak (release delivery)

export interface StreakOpts {
  ms?: number;
  /** 'arc' (default): curved lob; 'line': straight zip; 'dive': up first, then down onto the point. */
  path?: 'arc' | 'line' | 'dive';
  /** Arc height (px) for 'arc' / 'dive'. */
  lift?: number;
  ramp?: readonly number[];
  /** Called when the orb launches (after the card's collapse) — schedule arrival effects. */
  onLaunch?: () => void;
  /** Orb size: 1 small, 2 big. */
  size?: 1 | 2;
  depth?: number;
  /**
   * (v2) the floor under the start / end points for the orb's travelling light (default: the
   * start hangs a tile above its floor, the end lies on the floor). light: false = no light.
   */
  floorFrom?: number;
  floorTo?: number;
  light?: boolean;
}

/**
 * The spell's energy: a bright orb with a halo and a sparkling comet tail flies from `from` to
 * `to` (accelerating). Resolves on arrival (the caller plays the arrival burst / effect).
 */
export async function energyStreak(scene: Phaser.Scene, from: XY, to: XY, o: StreakOpts = {}): Promise<void> {
  if (LOOK_V3) return energyStreakV3(scene, from, to, o);
  const ramp = o.ramp ?? TEAL_FX;
  const d = Math.hypot(to.x - from.x, to.y - from.y);
  const ms = o.ms ?? Math.max(200, Math.min(420, d * 1.3));
  const depth = o.depth ?? DEPTH.FX_TOP + 12;
  const big = (o.size ?? 2) === 2;
  const halo = scene.add.image(from.x, from.y, AK.glow).setBlendMode(ADD).setTint(ramp[2]).setDepth(depth - 1).setScale(big ? 0.55 : 0.35).setAlpha(0.85);
  const orb = scene.add.image(from.x, from.y, TEX.dot5).setBlendMode(ADD).setTint(ramp[1]).setDepth(depth).setScale(big ? 1.6 : 1);
  const core = scene.add.image(from.x, from.y, TEX.px3).setTint(PAL.white).setDepth(depth + 0.5);
  const trail = new Sparks(scene, depth - 0.5, ADD);
  const path = o.path ?? 'arc';
  const lift = o.lift ?? Math.min(70, d * 0.35);
  const ctrl: XY =
    path === 'line'
      ? { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
      : path === 'dive'
        ? { x: lerp(from.x, to.x, 0.35), y: Math.min(from.y, to.y) - lift * 1.4 }
        : { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift };
  let prev = from;
  // (v2) the orb carries its light: an air glow on it and a pool sliding along the floor below
  const f0 = o.floorFrom ?? from.y + TILE_H;
  const f1 = o.floorTo ?? to.y + 2;
  const light = o.light === false ? null : lightPool(scene, from.x, from.y, { color: ramp[2], radius: fs(big ? 22 : 16), floorY: f0, air: 0.6, airRadius: big ? 16 : 11, intensity: big ? 0.8 : 0.6, fadeIn: 60 });
  await run(scene, ms, (t) => {
    const k = path === 'line' ? E.inQuad(t) * 0.65 + t * 0.35 : E.inOutSine(t);
    const p = qbez(from, ctrl, to, k);
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    if (light && light.alive) light.setPosition(x, y, Math.max(y, lerp(f0, f1, k)));
    orb.setPosition(x, y);
    core.setPosition(x - 1, y - 1);
    halo.setPosition(x, y);
    // comet tail: fill the gap since the last frame so fast streaks stay continuous
    const steps = Math.max(1, Math.ceil(Math.hypot(p.x - prev.x, p.y - prev.y) / 3));
    for (let i = 0; i < steps; i++) {
      const q = { x: lerp(prev.x, p.x, i / steps), y: lerp(prev.y, p.y, i / steps) };
      trail.add({ x: q.x + rr(-1, 1), y: q.y + rr(-1, 1), life: rr(140, 240), ramp: ramp.slice(1), fade: 0.5 });
      if (rnd() < 0.25) trail.add({ x: q.x, y: q.y, vx: rr(-25, 25), vy: rr(-25, 25), drag: 3, life: rr(200, 340), ramp, tex: rnd() < 0.3 ? TEX.plus : TEX.px1, flicker: true });
    }
    prev = p;
  });
  orb.destroy();
  core.destroy();
  halo.destroy();
  trail.close();
  void light?.fadeOut(140);
  if (o.light !== false) void lightFlash(scene, to.x, to.y, ramp[2], fs(big ? 30 : 22), 320, { floorY: Math.max(to.y, f1), intensity: big ? 0.9 : 0.7 });
}

// ================================================================ card → graveyard

/**
 * The resolved spell card re-forms (teal flash) at `from` and arcs into its owner's graveyard.
 * Use it for `toGraveyard{from:'resolved'}` (consume the event first).
 */
export async function resolvedToGraveyard(ctx: AnyCtx, o: { owner: PlayerId; cardId: CardId; from: XY; delay?: number; scale?: number }): Promise<void> {
  // v3: card continuity (_v3/card.ts): the pile's own iso card is born at `from`, whole pixels
  if (LOOK_V3) return fx.cardToGraveyard(ctx, { owner: o.owner, cardId: o.cardId, from: ip(o.from), delay: o.delay });
  const sc = ctx.scene;
  if (o.delay) await wait(sc, o.delay);
  const pile = ctx.views.field.pile(o.owner, 'graveyard');
  const c = new CardSprite(sc, o.from.x, o.from.y, o.cardId, { faceUp: true, player: o.owner }).setDepth(DEPTH.FX + 6).setScale(o.scale ?? 0.5).setAlpha(0);
  void c.pulse(PAL.teal4, 220);
  await tween(sc, { targets: c, alpha: 1, duration: 90 });
  c.setTrail(true);
  const to = pile.topXY();
  await c.flyTo(to.x, to.y - 6, { ms: 360, arc: 30, scale: 0.26, land: false, anticipate: false, rotation: o.owner === 0 ? 0.2 : -0.2 });
  c.setTrail(false);
  ctx.sfx('cardPlace', { volume: 0.4, pitch: 0.9 });
  pile.set(pile.count + 1, o.cardId);
  pile.bump();
  c.burst(PAL.teal3, 8);
  void lightFlash(sc, to.x, to.y, PAL.teal3, fs(20), 260, { intensity: 0.55 });
  await tween(sc, { targets: c, alpha: 0, scale: 0.18, duration: 110 });
  c.destroy();
}

/** Handle a `toGraveyard` of the resolved spell itself (consumes it). */
export function sendResolved(ctx: AnyCtx, gi: number, from: XY, delay = 0): Promise<void> {
  const g = evAt(ctx, gi, 'toGraveyard');
  if (!g || ctx.isConsumed(gi)) return Promise.resolve();
  ctx.consumeAt(gi);
  return resolvedToGraveyard(ctx, { owner: g.owner, cardId: g.cardId, from, delay });
}

// ================================================================ the opening

export interface Opening {
  /** The showcase card (v3 look, a set card: its TileCard standing on its own zone). */
  card: CardSprite | TileCard;
  /** Where the card hovers (v1: the middle of the field; v3: beside its owner / on its own tile). */
  center: XY;
  /** The card turns into energy and flies to `to` (resolves on arrival). */
  release(to: XY, o?: StreakOpts): Promise<void>;
  /** Equip / field spells: the card flies down onto its zone and lies there (TileCard). */
  land(o: { spot: 'spellTrap' | 'field'; index: number }): Promise<TileCard>;
  /**
   * v3 look only (A5 §4.3 landV3): equip / field spells land WITHOUT rotation — the card flies on
   * whole pixels at scale 1 to its own zone, appears standing on its tile (TileCard) and lies down
   * (A5 §3.1 İNİŞ, §3.2). A set card already standing on that tile just lies down. No sound and no
   * light of its own: `onLand` fires on the frame the card lies flat (the scene's 'land' mark).
   * Resolves with the TileCard lying on the zone. Absent in the old look (use land()).
   */
  landV3?(o: LandV3Opts): Promise<TileCard>;
  /** Nothing to resolve: fade everything. */
  close(): Promise<void>;
  /**
   * v3 look with `keepCard`: the spent card (it stayed where it hovered after release()) goes to
   * its owner's graveyard — consumes the activation's own toGraveyard event `gi` (−1: none, the
   * card just fades). Without a kept card it re-forms at `from` (v1: sendResolved).
   */
  leave?(gi: number, from?: XY): Promise<void>;
}

/** landV3 options (A5 §4.3). */
export interface LandV3Opts {
  spot: 'spellTrap' | 'field';
  index: number;
  /** Flight to the zone (default 110 ms). */
  ms?: number;
  /** The lie-down on the tile (default 120 ms; a set card: 160 ms). */
  lieMs?: number;
  /** The frame the card lies flat (the 'land' mark: the scene's sound and light). */
  onLand?: () => void;
}

export interface OpeningOpts {
  /** Hover time at full size (default 300 ms; a set card that was already revealed hovers 110 ms less). */
  hold?: number;
  /** Camera push-in during the hold (default true). */
  push?: boolean;
  /** Called when the hover starts with the hold length (start an effect's anticipation early). */
  onHold?: (holdMs: number) => void;
  /**
   * v3 look only: release() leaves the spent card where it hovered (no collapse into the orb); the
   * spell sends it to the graveyard later with op.leave() — card continuity.
   */
  keepCard?: boolean;
  /**
   * v3 look only: where the orb leaves the card — its centre (default), its top edge (a bolt to the
   * sky) or its bottom edge (A5 §3.5: the spring's orb drops to the rune ring under the card).
   */
  releaseFrom?: 'center' | 'top' | 'bottom';
  /**
   * v3 look only, a set card's release(): 'dissolve' (default, as before: the 260 ms noise block) or
   * 'flow' (A5 §3.6 / §4.3: the card's own pixels, TileCard.currentPixels(), pour into the orb like a
   * hand card's do — collapseTileInto). Nothing passes 'flow' yet (lane A5-A step A-7 does).
   */
  setRelease?: 'dissolve' | 'flow';
}

/** Standing card centre above a tile (TileCard.standUp pose at scale 1). */
function standCenter(t: TileCard): XY {
  const [, py] = isoProject([0, 0, STAND_H / 2 + 2]);
  return { x: t.home.x, y: Math.round(t.home.y + py) };
}

/** Thin teal column bursting out of a tile (set-card activation). */
function tileColumn(scene: Phaser.Scene, at: XY, ms = 360): Promise<void> {
  const H = 96;
  const ras = new Raster(scene, at.x - 12, at.y - H, 24, H + 4, DEPTH.FX + 3, ADD);
  return run(scene, ms, (t) => {
    const rise = E.outCubic(seg(t, 0, 0.35));
    const fade = 1 - seg(t, 0.35, 1);
    ras.draw((g) => {
      const top = at.y - H * rise;
      const hw = 5 * (1 - seg(t, 0.2, 1) * 0.7);
      for (let y = Math.floor(top); y <= at.y; y++) {
        const v = (at.y - y) / H;
        const lv = fade * (1 - v * 0.6);
        g.rect(at.x - hw, y, hw * 2, 1, PAL.teal2, lv * 0.6);
        g.rect(at.x - hw * 0.45, y, Math.max(1, hw * 0.9), 1, v < 0.1 || t < 0.3 ? PAL.white : PAL.teal4, lv);
      }
    });
  }).then(() => ras.destroy());
}

/**
 * The common spell opening (see the file header). Resolves while the card hovers at the
 * centre, fully lit, after the hold.
 */
export async function spellOpening(
  ctx: AnyCtx,
  o: { uid: Uid; cardId: CardId; player: PlayerId; from: 'hand' | 'set'; zone: number | null } & OpeningOpts,
): Promise<Opening> {
  if (LOOK_V3) return spellOpeningV3(ctx, o);
  const sc = ctx.scene;
  const field = ctx.views.field;
  const center = SHOW_AT;
  // a set card was already revealed on its tile: it hovers a little less
  const hold = Math.max(120, (o.hold ?? 300) - (o.from === 'set' ? 110 : 0));
  const duelist = ctx.views.duelists?.get(o.player);
  bg(Promise.resolve(duelist?.play('command')));

  // ---- 1. get the card moving
  let card: CardSprite;
  const tile = o.from === 'set' && o.zone !== null ? field.tileAt(o.player, 'spellTrap', o.zone) : null;
  if (tile && tile.active) {
    // set: the tile flashes, a column bursts out, the card springs upright and turns face-up
    tile.setCard(o.cardId);
    const home = ip(tile.home);
    ctx.sfx('flipReveal', { volume: 0.8, pitch: 1.1 });
    bg(tile.pulse(PAL.teal4, 340));
    bg(tileFlash(sc, home.x, home.y, TEAL_FX, 380));
    bg(floorRing(sc, home.x, home.y, { r0: 6, r1: fs(40), ms: 380, ramp: TEAL_FX, depth: DEPTH.TILE_FX + 2 }));
    bg(tileColumn(sc, home));
    // (v2) the column's teal light bursts over the tile
    void lightFlash(sc, home.x, home.y - 30, PAL.teal4, fs(34), 420, { floorY: home.y, intensity: 1, air: 0.5, ring: true });
    void shake(sc, 120, 1);
    await tile.standUp(180, { reveal: true });
    ctx.sfx('spellActivate', { volume: 0.55, pitch: 1.2 });
    const p = standCenter(tile);
    card = new CardSprite(sc, p.x, p.y, o.cardId, { faceUp: true, player: o.player }).setDepth(DEPTH.FX_TOP + 10);
    field.release(o.uid);
    tile.destroy();
    void card.pulse(PAL.teal4, 200);
  } else {
    card = fx.takeHandCard(ctx, o.player, o.uid, o.cardId);
    card.setDepth(DEPTH.FX_TOP + 10);
    // anticipation: a little dip with a teal glint before the launch
    void card.pulse(PAL.teal3, 220);
    await tween(sc, { targets: card, y: card.y + 4, scaleX: card.scaleX * 1.04, scaleY: card.scaleY * 0.96, duration: 50, ease: 'Quad.Out' });
  }
  card.setCard(o.cardId);
  card.setHighlight(PAL.teal3);

  // ---- 2. launch to the centre while the stage dims and the seal inks itself in
  const veil = fx.dim(ctx, 0.34, 260);
  const glow = sc.add.image(center.x, center.y, AK.glow).setBlendMode(ADD).setTint(PAL.teal2).setDepth(DEPTH.FX_TOP + 7).setScale(0.3).setAlpha(0);
  void tween(sc, { targets: glow, alpha: 0.75, scale: 3.6, duration: 360, ease: 'Quad.Out' });
  const seal = makeSeal(sc, center, { drawMs: 320 });
  // (v2) the showcase card's teal light: a soft glow round it, a pool on the marble below
  const cardLight = lightPool(sc, center.x, center.y, { color: PAL.teal3, radius: fs(40), floorY: SHOW_FLOOR, air: 0.45, airRadius: 34, intensity: 0, anim: 'breathe', fadeIn: 0 });
  cardLight.setIntensity(0.75, 260);
  const motes = new Sparks(sc, DEPTH.FX_TOP + 11, ADD);
  let gathering = true;
  const stopMotes = onFrame(sc, (dt) => {
    if (!gathering) return false;
    if (dt > 0 && rnd() < dt / 28) {
      const a = rr(0, TAU);
      const d = rr(62, 96);
      motes.add({
        x: center.x + Math.cos(a) * d,
        y: center.y + Math.sin(a) * d,
        life: rr(320, 460),
        ramp: [PAL.teal2, PAL.teal3, PAL.teal4, PAL.white],
        home: { x: center.x, y: center.y, k: 0.22 },
        tex: rnd() < 0.25 ? TEX.plus : TEX.px1,
        fade: 0.2,
      });
    }
    return true;
  });
  ctx.sfx('whoosh', { volume: 0.45, pitch: 1.2 });
  const fromCard = card.faceUp;
  // the name plate wipes in under the arriving card (~90 ms before it lands), so the name is
  // fully spelled out a beat after the arrival
  const FLY = 230;
  let plate: Plate | null = null;
  const plateP = wait(sc, FLY - 90).then(() => (plate = namePlate(sc, o.cardId, { x: center.x, y: center.y + 82 })));
  await card.flyTo(center.x, center.y, { ms: FLY, arc: 34, scale: SHOW_SCALE, anticipate: false, land: false, reveal: !fromCard, ease: 'Cubic.Out' });
  card.setFaceUp(true);
  // arrival: squash, sparkle ring, the activation chord
  ctx.sfx('spellActivate', { volume: 0.9 });
  bg(card.punch(0.1, 200));
  card.playSweep(true);
  bg(sparkleBurst(sc, center.x, center.y, { ramp: TEAL, count: 16, depth: DEPTH.FX_TOP + 11 }));
  if (o.push !== false) bg(ctx.focus(center, { zoom: 1.03, ms: hold + 200, pan: 0 }));

  // ---- 3. hover (bob) while the motes pour in
  const bob = sc.tweens.add({ targets: card, y: center.y - 2, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  try {
    o.onHold?.(hold);
  } catch (e) {
    console.error('[spells] onHold', e);
  }
  await wait(sc, hold);
  bob.stop();
  card.setY(center.y);

  let cleaned = false;
  const cleanup = async (mode: 'implode' | 'dismiss') => {
    if (cleaned) return;
    cleaned = true;
    gathering = false;
    stopMotes();
    motes.close();
    // (CardSprite.setHighlight(null) fades over 120 ms and then touches its children: only
    // safe when the card outlives it — release() destroys the card sooner)
    if (mode === 'dismiss') card.setHighlight(null);
    // the plate lingers a beat into the release (the orb flies away from it): more reading time
    // at no cost to the timeline
    bg(plateP.then(() => wait(sc, mode === 'implode' ? 170 : 0)).then(() => (plate as Plate | null)?.hide()));
    bg(veil.remove(220));
    void cardLight.fadeOut(mode === 'implode' ? 150 : 240);
    bg(tween(sc, { targets: glow, alpha: 0, scale: mode === 'implode' ? 0.4 : 4.4, duration: mode === 'implode' ? 150 : 240 }).then(() => glow.destroy()));
    await (mode === 'implode' ? seal.implode(150) : seal.dismiss(220));
  };

  return {
    card,
    center,
    async release(to, so = {}) {
      // inhale: the card swells and whitens, then collapses into a sliver of light → an orb
      seal.spin(3);
      void card.pulse(PAL.white, 200);
      await tween(sc, { targets: card, scaleX: SHOW_SCALE * 1.08, scaleY: SHOW_SCALE * 1.08, duration: 70, ease: 'Quad.Out' });
      ctx.sfx('whoosh', { volume: 0.6, pitch: 1.5 });
      bg(cleanup('implode'));
      // a sliver of light, then a point
      void card.pulse(PAL.white, 240);
      await tween(sc, { targets: card, scaleX: 0.1, scaleY: SHOW_SCALE * 1.04, duration: 50, ease: 'Quad.In' });
      await tween(sc, { targets: card, scaleY: 0.12, duration: 40, ease: 'Quad.In' });
      card.destroy();
      bg(starFlare(sc, center, 220));
      void lightFlash(sc, center.x, center.y, PAL.white, fs(40), 300, { floorY: SHOW_FLOOR, intensity: 0.9, air: 0.6 });
      bg(sparkleBurst(sc, center.x, center.y, { ramp: TEAL, count: 10, depth: DEPTH.FX_TOP + 11, speed: 1.4 }));
      so.onLaunch?.();
      await energyStreak(sc, center, to, so);
    },
    async land(l) {
      bg(cleanup('dismiss'));
      const at = zoneXY(o.player, l.spot, l.index);
      void card.pulse(PAL.teal4, 200);
      await card.flyTo(at.x, at.y - 30, { ms: 170, arc: 14, scale: 1, anticipate: false, land: false, ease: 'Quad.In' });
      ctx.sfx('cardSlam', { volume: 0.75 });
      const t = await fx.slamToZone(ctx, card, { player: o.player, spot: l.spot, index: l.index, uid: o.uid, cardId: o.cardId, faceUp: true, ms: 220, shake: 1 });
      bg(t.pulse(PAL.teal3, 360));
      void lightFlash(sc, at.x, at.y, PAL.teal3, fs(32), 420, { intensity: 0.85, ring: true });
      t.tileFlash(PAL.teal3, 320);
      return t;
    },
    async close() {
      await cleanup('dismiss');
      await tween(sc, { targets: card, alpha: 0, scale: SHOW_SCALE * 1.2, duration: 200 });
      card.destroy();
    },
  };
}

/** Camera back to rest (fire-and-forget safe). */
export function relax(ctx: AnyCtx, ms = 320): void {
  bg(ctx.unfocus(ms));
}

/** Keep a value in 0..1. */
export const c01 = clamp01;

// ================================================================ the v3 look (?look=v3)
//
// A0 §6.2 item 9 / §4.1 "Büyü açılışı" (plan §4–§5): the opening reaches its release in ≤ 0.45 s and
// stays on its OWNER's side — never in the middle of the board, never scaled:
//   hand  the card leaves the hand on whole pixels (no rotation, scale 1) and hovers beside its
//         owner's duelist (castSpot) while the duelist commands; a hidden hand's card is born
//         there (an activation is public) out of a streak from the mini-hand;
//   set   the card springs upright on its own tile (TileCard 3D raster: crisp) and stays there.
// Arrival: a two-frame teal silhouette, a 1-px settle, a rune ring inking itself in on the floor,
// motes pouring in, a 1-px rim with a node running round it, the name plate stamped under it.
// release(): a two-frame white silhouette and a pixel orb leaves the card (its centre, or its top
// edge with releaseFrom 'top'); the card collapses into the orb as pixels — or, with keepCard,
// stays where it hovered, spent, and op.leave() sends it to the graveyard later (card continuity).
// No veil, no camera push, no soft glow textures: the stepped light layer lights the card's tile.

/** Half sizes of a CardSprite at scale 1. */
const CARD_HW = 24;
const CARD_HH = 34;

/**
 * Where a spell cast from the hand hovers (card centre): beside its owner's duelist, on the outer
 * side of the board — P1 (173, 206) lower left, P2 (467, 114) upper right (mirrored).
 */
export function castSpot(player: PlayerId): XY {
  const d = duelistXY(player);
  return player === 0 ? { x: Math.round(d.x) - 40, y: Math.round(d.y) - 8 } : { x: Math.round(d.x) + 40, y: Math.round(d.y) + 8 };
}

/** The floor under a card hovering at `at` (its rune ring and its shadow). */
function castFloor(at: XY): number {
  return at.y + CARD_HH + 6;
}

/** A flat one-colour silhouette of a scale-1 card centred on `at`, for `frames` rendered frames. */
function cardSil(scene: Phaser.Scene, at: XY, color: number, frames = 2, depth: number = DEPTH.FX_TOP + 10.5): void {
  const img = scene.add.image(Math.round(at.x), Math.round(at.y), CARD_SIL).setTintFill(color).setDepth(depth);
  let n = 0;
  onFrame(scene, () => {
    if (++n > frames || !img.active) {
      if (img.active) img.destroy();
      return false;
    }
    return true;
  });
}

interface Rim {
  stop(): void;
}

/** A 1-px rim round a hovering card with a bright node running round it (follows the card). */
function cardRim(scene: Phaser.Scene, card: CardSprite, ramp: readonly number[]): Rim {
  const W = CARD_HW * 2 + 4;
  const H = CARD_HH * 2 + 4;
  const ras = new Raster(scene, card.x - W / 2, card.y - H / 2, W, H, card.depth - 0.1);
  const per = 2 * (W - 1) + 2 * (H - 1);
  const at = (d: number): XY => {
    d = ((d % per) + per) % per;
    if (d < W - 1) return { x: d, y: 0 };
    d -= W - 1;
    if (d < H - 1) return { x: W - 1, y: d };
    d -= H - 1;
    if (d < W - 1) return { x: W - 1 - d, y: H - 1 };
    d -= W - 1;
    return { x: 0, y: H - 1 - d };
  };
  let dead = false;
  const stop = onFrame(scene, (_dt, el) => {
    if (dead || !card.active) {
      ras.destroy();
      return false;
    }
    ras.moveTo(Math.round(card.x) - W / 2, Math.round(card.y) - H / 2);
    ras.draw((g) => {
      const x0 = ras.x;
      const y0 = ras.y;
      g.rect(x0 + 1, y0, W - 2, 1, ramp[2]);
      g.rect(x0 + 1, y0 + H - 1, W - 2, 1, ramp[2]);
      g.rect(x0, y0 + 1, 1, H - 2, ramp[2]);
      g.rect(x0 + W - 1, y0 + 1, 1, H - 2, ramp[2]);
      // two nodes chase each other round the rim, a 3-px bright tail behind each
      const head = Math.floor(el * 0.16);
      for (const off of [0, per / 2]) {
        for (let k = 0; k < 4; k++) {
          const p = at(head + off - k);
          g.px(x0 + p.x, y0 + p.y, k === 0 ? PAL.white : k === 1 ? ramp[1] : ramp[2]);
        }
      }
    });
    return true;
  });
  return {
    stop() {
      dead = true;
      stop();
      ras.destroy();
    },
  };
}

/** A small rune ring inking itself in on the floor at (x, y) (clockwise), ticks orbiting; dismiss() dithers it out. */
function floorRune(scene: Phaser.Scene, at: XY, ramp: readonly number[], r = 22): { dismiss(ms?: number): Promise<void> } {
  const ras = Raster.around(scene, at.x, at.y, r * 2 + 12, r + 12, DEPTH.SHADOW - 1);
  let p = 0;
  let level = 1;
  let dead = false;
  const stop = onFrame(scene, (dt, el) => {
    if (dead) return false;
    p = Math.min(1, p + dt / 160);
    ras.draw((g) => {
      if (level <= 0.02) return;
      const a0 = -Math.PI / 2;
      g.ring(at.x, at.y, r, r / 2, ramp[2], level, a0, a0 + TAU * p);
      g.ring(at.x, at.y, r - 4, r / 2 - 2, ramp[3], level * 0.75, a0 - TAU * p, a0);
      for (let i = 0; i < 6; i++) {
        const t = el * 0.002 + (i / 6) * TAU;
        if (i / 6 > p) continue;
        g.dpx(at.x + Math.cos(t) * (r + 2), at.y + Math.sin(t) * (r / 2 + 1), i % 2 ? ramp[1] : PAL.white, level);
      }
    });
    return true;
  });
  const kill = () => {
    if (dead) return;
    dead = true;
    stop();
    ras.destroy();
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, kill);
  return {
    async dismiss(ms = 200) {
      if (dead) return;
      await run(scene, ms, (t) => (level = 1 - t));
      kill();
    },
  };
}

/** The pixels of a card collapse into `to` (the card is gone; the caller destroys the sprite). */
function collapseInto(scene: Phaser.Scene, card: CardSprite, to: XY, ms = 110): void {
  const pc = card.pixels;
  const sp = new PxSparks(scene, DEPTH.FX_TOP + 11);
  const x0 = Math.round(card.x) - pc.w / 2;
  const y0 = Math.round(card.y) - pc.h / 2;
  for (let y = 1; y < pc.h; y += 4)
    for (let x = (y >> 2) % 2 ? 1 : 3; x < pc.w; x += 4) {
      const c = pc.get(x, y);
      if (c === null) continue;
      sp.add({ x: x0 + x, y: y0 + y, tx: to.x, ty: to.y, curl: rr(-6, 6), life: rr(ms * 0.7, ms), colors: [c, PAL.teal4, PAL.white], shape: 'px', fadeAt: 1 });
    }
  sp.release();
}

/**
 * A set card's pixels pour into `to` (A5 §3.6: collapseInto's TileCard version). The pixels are the
 * card's pose on screen right now (TileCard.currentPixels(), contract S-3); the caller removes the
 * tile on the same frame.
 */
export function collapseTileInto(scene: Phaser.Scene, tile: TileCard, to: XY, ms = 110): void {
  const { px: pc, x: x0, y: y0 } = tile.currentPixels();
  const sp = new PxSparks(scene, DEPTH.FX_TOP + 11);
  for (let y = 1; y < pc.h; y += 4)
    for (let x = (y >> 2) % 2 ? 1 : 3; x < pc.w; x += 4) {
      const c = pc.get(x, y);
      if (c === null) continue;
      sp.add({ x: x0 + x, y: y0 + y, tx: to.x, ty: to.y, curl: rr(-6, 6), life: rr(ms * 0.7, ms), colors: [c, PAL.teal4, PAL.white], shape: 'px', fadeAt: 1 });
    }
  sp.release();
}

/** The v3 energy orb: a whole-pixel orb (no glow textures) with a pixel comet tail; resolves on arrival. */
async function energyStreakV3(scene: Phaser.Scene, from: XY, to: XY, o: StreakOpts): Promise<void> {
  const ramp = o.ramp ?? TEAL_FX;
  const d = Math.hypot(to.x - from.x, to.y - from.y);
  const ms = o.ms ?? Math.max(160, Math.min(360, d * 1.1));
  const depth = o.depth ?? DEPTH.FX_TOP + 12;
  const big = (o.size ?? 2) === 2;
  const R = big ? 3 : 2;
  const orb = new Raster(scene, from.x - R - 1, from.y - R - 1, R * 2 + 3, R * 2 + 3, depth);
  const trail = new PxSparks(scene, depth - 0.5);
  const path = o.path ?? 'arc';
  const lift = o.lift ?? Math.min(70, d * 0.35);
  const ctrl: XY =
    path === 'line'
      ? { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
      : path === 'dive'
        ? { x: lerp(from.x, to.x, 0.35), y: Math.min(from.y, to.y) - lift * 1.4 }
        : { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift };
  const f0 = o.floorFrom ?? from.y + TILE_H;
  const f1 = o.floorTo ?? to.y + 2;
  const light = o.light === false ? null : lightPool(scene, from.x, from.y, { color: ramp[2], radius: big ? 20 : 14, floorY: f0, intensity: big ? 0.8 : 0.6, fadeIn: 0 });
  let prev = { x: Math.round(from.x), y: Math.round(from.y) };
  await run(scene, ms, (t, el) => {
    const k = path === 'line' ? E.inQuad(t) * 0.65 + t * 0.35 : E.inOutSine(t);
    const q = qbez(from, ctrl, to, k);
    const x = Math.round(q.x);
    const y = Math.round(q.y);
    light?.setPosition(x, y, Math.max(y, Math.round(lerp(f0, f1, k))));
    orb.moveTo(x - R - 1, y - R - 1);
    orb.draw((g) => {
      const pulse = Math.floor(el / 50) % 2 === 0;
      g.disc(x, y, R + (pulse ? 0.5 : 0), ramp[2]);
      g.disc(x, y, R - 1, ramp[1]);
      g.rect(x - 1, y - 1, 2, 2, PAL.white);
    });
    // the tail: one pixel every 2 px of travel, stepping down the ramp, no fading alpha
    const steps = Math.max(1, Math.ceil(Math.hypot(x - prev.x, y - prev.y) / 2));
    for (let i = 0; i < steps; i++) {
      const px = Math.round(lerp(prev.x, x, i / steps));
      const py = Math.round(lerp(prev.y, y, i / steps));
      trail.add({ x: px + Math.round(rr(-1, 1)), y: py + Math.round(rr(-1, 1)), life: rr(110, 200), colors: [ramp[1], ramp[2], ramp[3]], shape: 'px', fadeAt: 1 });
      if (rnd() < 0.2) trail.add({ x: px, y: py, vx: rr(-24, 24), vy: rr(-24, 24), drag: 3, life: rr(160, 280), colors: [PAL.white, ramp[1], ramp[2]], shape: rnd() < 0.3 ? 'plus' : 'px', flicker: true, fadeAt: 1 });
    }
    prev = { x, y };
  });
  orb.destroy();
  trail.release();
  void light?.fadeOut(120);
  if (o.light !== false) void lightFlash(scene, to.x, to.y, ramp[2], big ? 28 : 20, 300, { floorY: Math.max(to.y, f1), intensity: big ? 0.9 : 0.7 });
}

/**
 * TileCard.layDown without its blank last frame (landV3 only). layDown's final tween step computes
 * k = (1 - 0.7) / 0.3 = 1.0000000000000002, and spring(k) = cos(..) * Math.pow(1 - k, 2.2) is NaN, so the
 * card draws an empty pose for one rendered frame before its settle() (TileCard.ts is lane A6-A's:
 * reported, not edited here). A counter of the same duration, added right after it to the same tween
 * manager, ends on that same step — after the NaN draw, before the render — and settles the card flat
 * with sync(); layDown then skips its own settle (its epoch moved on). The look is layDown's own end
 * state, one frame earlier than the blank would have cleared.
 */
function layDownCrisp(sc: Phaser.Scene, tile: TileCard, ms: number): Promise<void> {
  if (!tile.active || !tile.standing) return tile.layDown(ms);
  const cardId = tile.cardId;
  const done = tile.layDown(ms);
  sc.tweens.addCounter({
    from: 0,
    to: 1,
    duration: ms,
    onComplete: () => {
      if (tile.active && !tile.standing && tile.cardId === cardId) tile.sync(cardId, tile.faceUp, tile.orientation);
    },
  });
  return done;
}

/** The v3 spell opening (see the section header). */
async function spellOpeningV3(
  ctx: AnyCtx,
  o: { uid: Uid; cardId: CardId; player: PlayerId; from: 'hand' | 'set'; zone: number | null } & OpeningOpts,
): Promise<Opening> {
  const sc = ctx.scene;
  const field = ctx.views.field;
  const hold = Math.min(180, Math.max(70, Math.round((o.hold ?? 300) * 0.5)));
  const keep = !!o.keepCard;
  bg(Promise.resolve(ctx.views.duelists?.get(o.player)?.play('command')));
  const motes = new PxSparks(sc, DEPTH.FX_TOP + 11);
  let gathering = false;
  let center: XY;
  let floorY: number;
  let card: CardSprite | null = null;
  const tile = o.from === 'set' && o.zone !== null ? field.tileAt(o.player, 'spellTrap', o.zone) : null;
  let standing: TileCard | null = null;
  let rim: Rim | null = null;
  let cardLight: LightHandle | null = null;

  if (tile && tile.active) {
    // ---- set: the tile flashes, a thin column bursts out, the card springs upright and turns face-up
    standing = tile;
    tile.setCard(o.cardId);
    const home = ip(tile.home);
    ctx.sfx('flipReveal', { volume: 0.8, pitch: 1.1 });
    bg(tileFlash(sc, home.x, home.y, TEAL_FX, 300));
    bg(floorRing(sc, home.x, home.y, { r0: 6, r1: 34, ms: 320, ramp: TEAL_FX, depth: DEPTH.TILE_FX + 2 }));
    bg(tileColumn(sc, home, 300));
    void lightFlash(sc, home.x, home.y, PAL.teal4, 34, 380, { floorY: home.y, ring: true, intensity: 1 });
    await tile.standUp(180, { reveal: true });
    // the v3 spell accent (src/audio/v3/slice.ts spellOpen) as the card stands
    playV3('spellOpen', { volume: 0.9 });
    center = standCenter(tile);
    floorY = home.y;
    cardLight = lightPool(sc, home.x, home.y, { color: PAL.teal3, radius: 26, floorY: home.y, intensity: 0.8, anim: 'breathe', fadeIn: 0 });
  } else {
    center = castSpot(o.player);
    floorY = castFloor(center);
    const hand = ctx.views.hand;
    const own = hand.owner === o.player ? hand.takeCard(o.uid) : null;
    const cam = sc.cameras.main;
    if (own) {
      // ---- the viewer's own hand: the card leaves it on whole pixels and flies to its owner's side
      card = own;
      card.setRotation(0).setScale(1).setDepth(DEPTH.FX_TOP + 10);
      card.setCard(o.cardId);
      card.setFaceUp(true);
      const p0 = { x: Math.round(card.x + (cam.zoom === 1 ? cam.scrollX : 0)), y: Math.round(card.y + (cam.zoom === 1 ? cam.scrollY : 0)) };
      card.setPosition(p0.x, p0.y + 2); // anticipation: it dips
      await wait(sc, 30);
      ctx.sfx('whoosh', { volume: 0.45, pitch: 1.2 });
      const trail = new PxSparks(sc, DEPTH.FX_TOP + 9);
      // it swings out round the board's outer edge (P1: low, under the front corner; P2: up the
      // right side), never over the middle of the board
      const ctrl = o.player === 0 ? { x: Math.round((p0.x + center.x) / 2) - 50, y: p0.y + 4 } : { x: center.x + 130, y: p0.y - 10 };
      const c = card;
      await run(sc, 170, (t) => {
        if (!c.active) return;
        const p = qbez(p0, ctrl, center, E.outCubic(t));
        const x = Math.round(p.x);
        const y = Math.round(p.y);
        c.setPosition(x, y);
        if (t < 0.9) trail.add({ x: x + Math.round(rr(-CARD_HW, CARD_HW)), y: y + CARD_HH - Math.round(rr(0, 8)), vy: rr(10, 30), life: rr(120, 220), colors: [PAL.teal4, PAL.teal3, PAL.teal2], shape: 'px', fadeAt: 1 });
      });
      trail.release();
    } else {
      // ---- a hidden hand: a streak leaves the mini-hand and the card is born beside its duelist
      const remaining = ctx.state.players[o.player].hand.filter((u) => u !== o.uid).map((u) => ({ uid: u, cardId: ctx.state.cards[u].cardId }));
      if (hand.owner !== o.player) hand.setCards(remaining, o.player);
      const m = hand.miniXY(o.player, 0);
      const from = { x: Math.round(m.x + (cam.zoom === 1 ? cam.scrollX : 0)), y: Math.round(m.y + (cam.zoom === 1 ? cam.scrollY : 0)) };
      ctx.sfx('whoosh', { volume: 0.45, pitch: 1.2 });
      await energyStreakV3(sc, from, center, { ms: 170, path: 'line', size: 1, light: false });
      card = new CardSprite(sc, center.x, center.y, o.cardId, { faceUp: true, player: o.player }).setDepth(DEPTH.FX_TOP + 10);
      cardSil(sc, center, PAL.white, 2);
    }
    // ---- arrival: teal silhouette, a 1-px settle, the rune ring on the floor
    cardSil(sc, center, PAL.teal4, 2);
    const c = card;
    void run(sc, 60, (t) => c.active && c.setY(center.y + Math.round(2 * (1 - t))));
    // the v3 spell accent (src/audio/v3/slice.ts spellOpen) on the arrival frame
    playV3('spellOpen', { volume: 0.95 });
    rim = cardRim(sc, card, TEAL_FX);
  }
  const rune = floorRune(sc, { x: center.x, y: floorY }, TEAL_FX, standing ? 24 : 20);
  const plate = namePlate(sc, o.cardId, { x: center.x, y: standing ? floorY + 16 : center.y + CARD_HH + 14 });
  bg(sparkleBurst(sc, center.x, center.y, { ramp: TEAL, count: 10, depth: DEPTH.FX_TOP + 11 }));

  // ---- hover: motes pour in, the card breathes by one pixel
  gathering = true;
  const hoverY = card ? center.y : 0;
  const stopHover = onFrame(sc, (dt, el) => {
    if (!gathering) return false;
    if (card && card.active) card.setY(hoverY - (Math.floor(el / 140) % 2));
    if (dt > 0 && rnd() < dt / 30) {
      const a = rr(0, TAU);
      const dd = rr(30, 52);
      motes.add({ x: Math.round(center.x + Math.cos(a) * dd), y: Math.round(center.y + Math.sin(a) * dd * 0.7), tx: center.x, ty: center.y, curl: rr(-10, 10), life: rr(200, 300), colors: [PAL.teal2, PAL.teal3, PAL.teal4, PAL.white], shape: rnd() < 0.25 ? 'plus' : 'px', fadeAt: 1 });
    }
    return true;
  });
  try {
    o.onHold?.(hold);
  } catch (e) {
    console.error('[spells] onHold', e);
  }
  await wait(sc, hold);

  let cleaned = false;
  const cleanup = (mode: 'release' | 'dismiss') => {
    if (cleaned) return;
    cleaned = true;
    gathering = false;
    stopHover();
    motes.release();
    rim?.stop();
    if (card && card.active) card.setY(hoverY);
    bg(wait(sc, mode === 'release' ? 170 : 0).then(() => plate.hide()));
    bg(rune.dismiss(mode === 'release' ? 160 : 220));
    void cardLight?.fadeOut(200);
  };
  /** The standing set card leaves the field bookkeeping (the spell owns it from now on). */
  const own = () => {
    if (standing) field.release(o.uid);
  };
  let spentCard: CardSprite | null = null;
  let spentTile: TileCard | null = null;

  return {
    card: card ?? (standing as TileCard),
    center,
    async release(to, so = {}) {
      const from =
        o.releaseFrom === 'top'
          ? { x: center.x, y: Math.round(center.y - (standing ? 22 : CARD_HH) - 2) }
          : o.releaseFrom === 'bottom'
            ? { x: center.x, y: Math.round(center.y + CARD_HH - 1) }
            : center;
      if (card) cardSil(sc, center, PAL.white, 2);
      ctx.sfx('whoosh', { volume: 0.6, pitch: 1.5 });
      cleanup('release');
      own();
      if (keep) {
        spentCard = card;
        spentTile = standing;
      } else if (card) {
        collapseInto(sc, card, from);
        card.destroy();
      } else if (standing && o.setRelease === 'flow') {
        // A5 §3.6: the set card's own pixels pour into the orb (no noise block)
        collapseTileInto(sc, standing, from);
        standing.destroy();
      } else if (standing) {
        const t = standing;
        bg(t.dissolve(260).then(() => t.active && t.destroy()));
      }
      bg(starFlare(sc, from, 180, TEAL_FX, 18));
      void lightFlash(sc, center.x, center.y, PAL.teal4, 30, 260, { floorY, intensity: 0.9 });
      so.onLaunch?.();
      await energyStreakV3(sc, from, to, so);
    },
    async land(l) {
      cleanup('dismiss');
      const at = zoneXY(o.player, l.spot, l.index);
      if (standing && l.spot === 'spellTrap' && l.index === o.zone && standing.active) {
        // a set equip lies back down on its own tile (it stays on the field)
        await standing.layDown(220);
        void lightFlash(sc, at.x, at.y, PAL.teal3, 30, 380, { intensity: 0.85, ring: true });
        standing.tileFlash(PAL.teal3, 300);
        return standing;
      }
      own();
      if (standing && standing.active) standing.destroy();
      const t = await fx.slamToZone(ctx, card, { player: o.player, spot: l.spot, index: l.index, uid: o.uid, cardId: o.cardId, faceUp: true, ms: 300, shake: 1 });
      ctx.sfx('cardSlam', { volume: 0.75 });
      void lightFlash(sc, at.x, at.y, PAL.teal3, 30, 380, { intensity: 0.85, ring: true });
      t.tileFlash(PAL.teal3, 300);
      return t;
    },
    async landV3(l) {
      cleanup('dismiss');
      if (standing && l.spot === 'spellTrap' && l.index === o.zone && standing.active) {
        // a set equip is already standing on its own tile: it lies back down (it stays on the field)
        await layDownCrisp(sc, standing, l.lieMs ?? 160);
        l.onLand?.();
        return standing;
      }
      own();
      if (standing && standing.active) standing.destroy();
      const at = zoneXY(o.player, l.spot, l.index);
      // where the card stands on its zone (TileCard's standing pose at scale 1: the same 48×68 face)
      const [, py] = isoProject([0, 0, STAND_H / 2 + 2]);
      const dest = { x: Math.round(at.x), y: Math.round(at.y + py) };
      const c = card;
      if (c && c.active) {
        // the flight: whole pixels, no rotation, scale 1, a 6-px arc, a 1-px teal trail under it
        const p0 = { x: Math.round(c.x), y: Math.round(c.y) };
        c.setRotation(0).setScale(1);
        const trail = new PxSparks(sc, DEPTH.FX_TOP + 9);
        let last = p0;
        await run(sc, l.ms ?? 110, (t) => {
          if (!c.active) return;
          const k = E.inOutSine(t);
          const x = Math.round(p0.x + (dest.x - p0.x) * k);
          const y = Math.round(p0.y + (dest.y - p0.y) * k - Math.sin(Math.PI * t) * 6);
          c.setPosition(x, y);
          if (x !== last.x || y !== last.y) trail.add({ x, y: y + CARD_HH, life: 120, colors: [PAL.teal3, PAL.teal2, PAL.teal1], shape: 'px', fadeAt: 1 });
          last = { x, y };
        });
        trail.release();
        c.destroy();
      }
      // it appears standing on its tile (drawn in that pose at once: no flat frame first) and lies down
      const tile = field.placeCard(o.player, l.spot, l.index, o.uid, o.cardId, true, 'up');
      tile.standing = true;
      tile.setCard(o.cardId);
      await layDownCrisp(sc, tile, l.lieMs ?? 120);
      l.onLand?.();
      return tile;
    },
    async close() {
      cleanup('dismiss');
      own();
      if (card && card.active) {
        await card.dissolve(320);
        card.destroy();
      } else if (standing && standing.active) {
        await standing.dissolve(320);
        standing.destroy();
      }
    },
    async leave(gi, from) {
      const g = evAt(ctx, gi, 'toGraveyard');
      const sc2 = ctx.scene;
      if (!g || ctx.isConsumed(gi)) {
        const c = spentCard as CardSprite | null;
        const t = spentTile as TileCard | null;
        if (c && c.active) c.destroy();
        if (t && t.active) t.destroy();
        return;
      }
      ctx.consumeAt(gi);
      const c = spentCard as CardSprite | null;
      const t = spentTile as TileCard | null;
      spentCard = null;
      spentTile = null;
      if (t && t.active) {
        // the spent set card lies back down on its tile and leaves from there
        await t.layDown(200);
        return cardLeaves(ctx, { owner: g.owner, cardId: g.cardId, from: ip(t.home), tile: t });
      }
      if (c && c.active) {
        // the spent card drops to the floor beside its owner; the pile's card is born there
        const y0 = Math.round(c.y);
        await run(sc2, 70, (k) => c.active && c.setY(y0 + Math.round(6 * k * k)));
        const at = { x: Math.round(c.x), y: castFloor(center) - 2 };
        c.destroy();
        return cardLeaves(ctx, { owner: g.owner, cardId: g.cardId, from: at });
      }
      return fx.cardToGraveyard(ctx, { owner: g.owner, cardId: g.cardId, from: ip(from ?? center) });
    },
  };
}
