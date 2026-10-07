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
//   Both: the caster's duelist commands, the name plate wipes in under the card ("YILDIRIM
//   HÜKMÜ"), motes converge into the card, it hovers ~0.5 s; the camera pushes in a touch.
//
// Everything runs on scene time (speed / hit-stop aware) and cleans itself up.

import Phaser from 'phaser';
import { CARDS, type CardId } from '../../data/cards';
import type { GameEvent, PlayerId, Uid } from '../../engine/types';
import { PAL, RAMPS, type Ramp } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { AK } from '../../art/arena';
import { STAND_H, isoProject } from '../../art/cards';
import { CardSprite } from '../../view/CardSprite';
import type { TileCard } from '../../view/TileCard';
import { DEPTH, GAME_W, type XY, zoneXY } from '../../view/layout';
import { measureText, pixelText, revealText, upper } from '../../ui/text';
import { TEX, shake, tween, wait } from '../../vfx/core';
import { E, Raster, Sparks, clamp01, floorRing, lerp, onFrame, qbez, rnd, rr, run, seg, tileFlash } from '../../vfx/setpieces';
import { sparkleBurst } from '../../vfx/summon';
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

/** Where the showcase card hangs (middle of the field, above the no-man's-land row). */
export const SHOW_AT: XY = { x: GAME_W / 2, y: 128 };
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

interface Plate {
  hide(ms?: number): Promise<void>;
}

function namePlate(scene: Phaser.Scene, cardId: CardId, at: XY): Plate {
  const name = upper(CARDS[cardId].name);
  const tm = measureText(name, 'md');
  const W = tm.w + 22;
  const H = 15;
  const x0 = Math.round(at.x - W / 2);
  const y0 = Math.round(at.y - H / 2);
  const ras = new Raster(scene, x0 - 6, y0 - 2, W + 12, H + 4, DEPTH.FX_TOP + 12);
  const txt = pixelText(scene, Math.round(at.x), Math.round(at.y), name, { size: 'md', color: PAL.teal4, originX: 0.5, originY: 0.5 }).setDepth(DEPTH.FX_TOP + 13);
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
      g.rect(l, y0, w, 1, PAL.teal3, level);
      g.rect(l, y0 + H - 1, w, 1, PAL.teal3, level);
      g.rect(l + 2, y0 + 2, w - 4, 1, PAL.teal1, level * 0.6);
      // end caps: little diamonds
      for (const ex of [l - 3, l + w + 2]) {
        g.px(ex, y0 + 7, PAL.teal4, level);
        g.px(ex - 1, y0 + 7, PAL.teal3, level);
        g.px(ex + 1, y0 + 7, PAL.teal3, level);
        g.px(ex, y0 + 6, PAL.teal3, level);
        g.px(ex, y0 + 8, PAL.teal3, level);
      }
    });
  const stop = onFrame(scene, (dt) => {
    if (dead) return false;
    open = Math.min(1, open + dt / 90);
    if (open >= 1 && shown < total) {
      shown = Math.min(total, shown + dt / 10);
      revealText(txt, Math.floor(shown));
      // the newest letters flash white
      txt.setTint(shown < total ? PAL.white : PAL.teal4);
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
}

/**
 * The spell's energy: a bright orb with a halo and a sparkling comet tail flies from `from` to
 * `to` (accelerating). Resolves on arrival (the caller plays the arrival burst / effect).
 */
export async function energyStreak(scene: Phaser.Scene, from: XY, to: XY, o: StreakOpts = {}): Promise<void> {
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
  await run(scene, ms, (t) => {
    const k = path === 'line' ? E.inQuad(t) * 0.65 + t * 0.35 : E.inOutSine(t);
    const p = qbez(from, ctrl, to, k);
    const x = Math.round(p.x);
    const y = Math.round(p.y);
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
}

// ================================================================ card → graveyard

/**
 * The resolved spell card re-forms (teal flash) at `from` and arcs into its owner's graveyard.
 * Use it for `toGraveyard{from:'resolved'}` (consume the event first).
 */
export async function resolvedToGraveyard(ctx: AnyCtx, o: { owner: PlayerId; cardId: CardId; from: XY; delay?: number; scale?: number }): Promise<void> {
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
  card: CardSprite;
  center: XY;
  /** The card turns into energy and flies to `to` (resolves on arrival). */
  release(to: XY, o?: StreakOpts): Promise<void>;
  /** Equip / field spells: the card flies down onto its zone and lies there (TileCard). */
  land(o: { spot: 'spellTrap' | 'field'; index: number }): Promise<TileCard>;
  /** Nothing to resolve: fade everything. */
  close(): Promise<void>;
}

export interface OpeningOpts {
  /** Hover time at full size (default 480 ms). */
  hold?: number;
  /** Camera push-in during the hold (default true). */
  push?: boolean;
  /** Called when the hover starts with the hold length (start an effect's anticipation early). */
  onHold?: (holdMs: number) => void;
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
  const sc = ctx.scene;
  const field = ctx.views.field;
  const center = SHOW_AT;
  // a set card was already revealed on its tile: it hovers a little less
  const hold = (o.hold ?? 420) - (o.from === 'set' ? 60 : 0);
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
    bg(floorRing(sc, home.x, home.y, { r0: 6, r1: 40, ms: 380, ramp: TEAL_FX, depth: DEPTH.TILE_FX + 2 }));
    bg(tileColumn(sc, home));
    void shake(sc, 120, 1);
    await tile.standUp(340, { reveal: true });
    ctx.sfx('spellActivate', { volume: 0.55, pitch: 1.2 });
    const p = standCenter(tile);
    card = new CardSprite(sc, p.x, p.y, o.cardId, { faceUp: true, player: o.player }).setDepth(DEPTH.FX_TOP + 10);
    field.release(o.uid);
    tile.destroy();
    void card.pulse(PAL.teal4, 200);
    await wait(sc, 70);
  } else {
    card = fx.takeHandCard(ctx, o.player, o.uid, o.cardId);
    card.setDepth(DEPTH.FX_TOP + 10);
    // anticipation: a little dip with a teal glint before the launch
    void card.pulse(PAL.teal3, 220);
    await tween(sc, { targets: card, y: card.y + 4, scaleX: card.scaleX * 1.04, scaleY: card.scaleY * 0.96, duration: 70, ease: 'Quad.Out' });
  }
  card.setCard(o.cardId);
  card.setHighlight(PAL.teal3);

  // ---- 2. launch to the centre while the stage dims and the seal inks itself in
  const veil = fx.dim(ctx, 0.34, 260);
  const glow = sc.add.image(center.x, center.y, AK.glow).setBlendMode(ADD).setTint(PAL.teal2).setDepth(DEPTH.FX_TOP + 7).setScale(0.3).setAlpha(0);
  void tween(sc, { targets: glow, alpha: 0.75, scale: 3.6, duration: 360, ease: 'Quad.Out' });
  const seal = makeSeal(sc, center, { drawMs: 320 });
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
  await card.flyTo(center.x, center.y, { ms: 300, arc: 34, scale: SHOW_SCALE, anticipate: false, land: false, reveal: !fromCard, ease: 'Cubic.Out' });
  card.setFaceUp(true);
  // arrival: squash, sparkle ring, the activation chord, the name plate
  ctx.sfx('spellActivate', { volume: 0.9 });
  bg(card.punch(0.1, 200));
  card.playSweep(true);
  bg(sparkleBurst(sc, center.x, center.y, { ramp: TEAL, count: 16, depth: DEPTH.FX_TOP + 11 }));
  const plate = namePlate(sc, o.cardId, { x: center.x, y: center.y + 82 });
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
    bg(plate.hide());
    bg(veil.remove(220));
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
      await tween(sc, { targets: card, scaleX: SHOW_SCALE * 1.08, scaleY: SHOW_SCALE * 1.08, duration: 80, ease: 'Quad.Out' });
      ctx.sfx('whoosh', { volume: 0.6, pitch: 1.5 });
      bg(cleanup('implode'));
      // a sliver of light, then a point
      void card.pulse(PAL.white, 240);
      await tween(sc, { targets: card, scaleX: 0.1, scaleY: SHOW_SCALE * 1.04, duration: 60, ease: 'Quad.In' });
      await tween(sc, { targets: card, scaleY: 0.12, duration: 50, ease: 'Quad.In' });
      card.destroy();
      bg(starFlare(sc, center, 220));
      bg(sparkleBurst(sc, center.x, center.y, { ramp: TEAL, count: 10, depth: DEPTH.FX_TOP + 11, speed: 1.4 }));
      so.onLaunch?.();
      await energyStreak(sc, center, to, so);
    },
    async land(l) {
      bg(cleanup('dismiss'));
      const at = zoneXY(o.player, l.spot, l.index);
      void card.pulse(PAL.teal4, 200);
      await card.flyTo(at.x, at.y - 30, { ms: 200, arc: 14, scale: 1, anticipate: false, land: false, ease: 'Quad.In' });
      ctx.sfx('cardSlam', { volume: 0.75 });
      const t = await fx.slamToZone(ctx, card, { player: o.player, spot: l.spot, index: l.index, uid: o.uid, cardId: o.cardId, faceUp: true, ms: 220, shake: 1 });
      bg(t.pulse(PAL.teal3, 360));
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
