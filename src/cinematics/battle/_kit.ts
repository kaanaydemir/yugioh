// Shared helpers of the traps + battle cinematics (src/cinematics/battle, src/cinematics/traps).
// No registrations here — this module is only imported by the handler files.
//
//   AttackHold         the attack declaration kept across events / a trap decision ('attack')
//   guardReact(...)    the guard-pose hit: sparks + hit-stop + MonsterUnit.guardHit (white flash,
//                      2–3 px knock-back, hex-shield glint). The guard-pose rule itself (never the
//                      upright 'hit' frames in defense) lives in MonsterUnit.
//   setCardPulse(...)  the defender's set cards breathing magenta while a trap window is open

import Phaser from 'phaser';
import type { MonsterId } from '../../data/cards';
import type { GameEvent, GameEventType, PlayerId } from '../../engine/types';
import { PAL, RAMPS, type Ramp } from '../../art/palette';
import { monsterFrameName } from '../../art/textures';
import type { AnyMonsterAnim } from '../../art/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { WEIGHT_MOTION, reactShakePx, reactStopMs, type WeightSource } from '../../duel/motion';
import { blowSource } from '../_core/helpers';
import type { Disposable, DuelViews } from '../../duel/types';
import type { TileCard } from '../../view/TileCard';
import { ARENA_V2, DEPTH, TILE_W, type XY, unitDepth } from '../../view/layout';
import { lightDim, lightFlash, lightLayer } from '../../view/light';
import { wait } from '../../vfx/core';
import { impact as combatImpact, stopTime } from '../../vfx/combat';
import { Raster, Sparks, onFrame, run } from '../../vfx/setpieces';
import type { CinematicContext } from '../api';
import { onDuelStart } from '../../duel/seeds';

export type EvOf<T extends GameEventType> = Extract<GameEvent, { type: T }>;
export type Ctx<T extends GameEventType> = CinematicContext<EvOf<T>>;
export type AnyCtx = CinematicContext<GameEvent>;

export const TAU = Math.PI * 2;
export const ADD = Phaser.BlendModes.ADD;

// ================================================================ tiny math

export const sub = (a: XY, b: XY): XY => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: XY, b: XY): XY => ({ x: a.x + b.x, y: a.y + b.y });
export const mul = (a: XY, k: number): XY => ({ x: a.x * k, y: a.y * k });
export const len = (a: XY): number => Math.hypot(a.x, a.y);
export const norm = (a: XY): XY => {
  const l = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / l, y: a.y / l };
};
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const lerpXY = (a: XY, b: XY, t: number): XY => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
export const rint = (p: XY): XY => ({ x: Math.round(p.x), y: Math.round(p.y) });

const SEED0 = 0x2545f491;
let seedState = SEED0;
onDuelStart(() => (seedState = SEED0));
export function seed(n: number): void {
  seedState = (n * 2654435761) >>> 0 || 1;
}
export function rnd(): number {
  seedState = (seedState * 1664525 + 1013904223) >>> 0;
  return seedState / 4294967296;
}
export const rr = (a: number, b: number): number => a + (b - a) * rnd();

export const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);

// ================================================================ arena geometry (v1 / v2)

export { ARENA_V2 };
/**
 * Floor scale of the arena: 1 on v1's 64×32 tiles, 1.25 on v2's 80×40 tiles. Floor rings and
 * magic circles that cover a tile are multiplied by it (v1 sizes stay exactly as tuned).
 */
export const TK = TILE_W / 64;

// ================================================================ light layer (arena v2; no-ops in v1)
//
// The dim level is shared by every cinematic of a battle: the battle / trap handler sets a BASE
// (arenaDim) and quick pulses (a beam's glare, an implosion's dark) return to whatever the base
// is when they end — so a pulse never leaves the arena dimmed after the handler restored it.

const dimBase = new WeakMap<object, number>();
const pulseRest = new WeakMap<object, number>();
const pulseN = new WeakMap<object, number>();

/** Where the layer's dim is heading (its ramp target), else its current level. */
function dimTarget(L: NonNullable<ReturnType<typeof lightLayer>>): number {
  const ramp = (L as unknown as { dim?: { target?: unknown } }).dim;
  return typeof ramp?.target === 'number' ? ramp.target : L.dimLevel;
}

/**
 * Set the arena's base dim level for the running battle / trap handler (0 normal, 1 dramatic
 * dark, < 0 brighter), eased over ms. 0 hands the dim back (no base any more).
 */
export function arenaDim(scene: Phaser.Scene, level: number, ms = 350): Promise<void> {
  const L = lightLayer(scene);
  if (!L) return Promise.resolve();
  if (level === 0) dimBase.delete(L);
  else dimBase.set(L, level);
  return lightDim(scene, level, ms);
}

/** The base dim level set by the running handler (0 when none). */
export function arenaDimBase(scene: Phaser.Scene): number {
  const L = lightLayer(scene);
  return L ? (dimBase.get(L) ?? 0) : 0;
}

/**
 * A dim (level > 0) or glare (level < 0) pulse: ease to `level`, hold, then back to where the
 * arena was — the handler's base (arenaDim), else the level before the first of overlapping
 * pulses (so a pulse inside another cinematic's dim gives it back). Fire-and-forget safe; a
 * no-op in arena v1.
 */
export async function dimPulse(scene: Phaser.Scene, level: number, o: { in?: number; hold?: number; out?: number } = {}): Promise<void> {
  const L = lightLayer(scene);
  if (!L) return;
  const n = pulseN.get(L) ?? 0;
  if (n === 0) pulseRest.set(L, dimBase.has(L) ? dimBase.get(L)! : dimTarget(L));
  pulseN.set(L, n + 1);
  await lightDim(scene, level, o.in ?? 60);
  if (o.hold) await wait(scene, o.hold);
  const left = Math.max(0, (pulseN.get(L) ?? 1) - 1);
  pulseN.set(L, left);
  if (left > 0 || lightLayer(scene) !== L) return;
  await lightDim(scene, dimBase.has(L) ? dimBase.get(L)! : (pulseRest.get(L) ?? 0), o.out ?? 420);
}

/** The colour each monster's strike lights the floor with at the impact (its VFX colour). */
export const STRIKE_LIGHT: Record<MonsterId, number> = {
  crystal_wyrm: PAL.cyan4,
  abyss_magus: PAL.void3,
  magma_titan: PAL.fire3,
  coral_serpent: PAL.water3,
  ember_wolf: PAL.fire3,
  tide_golem: PAL.water3,
  storm_hawk: PAL.teal3,
  stone_sentinel: PAL.earth3,
  lumen_sprite: PAL.gold4,
  shade_assassin: PAL.void3,
  volt_lizard: PAL.cyan3,
  thorn_lurker: PAL.leaf3,
};

/**
 * The impact light (§5 "darbe anı"): a flash pool + shock ring on the floor under the struck
 * point and a bloom around it, scaled by the blow's power. A no-op in arena v1.
 */
export function impactLight(scene: Phaser.Scene, at: XY, floorY: number, color: number, power: 1 | 2 | 3 = 2, o: { ring?: boolean; k?: number } = {}): void {
  if (!ARENA_V2) return;
  const k = o.k ?? 1;
  void lightFlash(scene, at.x, at.y, color, (34 + power * 8) * k, 260 + power * 70, { floorY, ring: o.ring ?? true, intensity: (0.75 + power * 0.18) * k });
}

/** Wait for every promise, never reject (errors are logged). */
export async function all(ps: Promise<unknown>[]): Promise<void> {
  await Promise.all(ps.map((p) => p.catch((e) => console.error('[traps-battle]', e))));
}

/** A visible, live unit or null. */
export function live(u: MonsterUnit | null | undefined): MonsterUnit | null {
  return u && !u.retired && u.sprite.active && u.sprite.visible ? u : null;
}

/** Stop the sprite's animation and show one frame of an anim (rounded, clamped). MonsterUnit.pose. */
export function holdFrame(u: MonsterUnit, anim: AnyMonsterAnim, frame: number): void {
  u.pose(anim, frame);
}

// ================================================================ the attack declaration hold

/**
 * What attackDeclare keeps under ctx.keep('attack'): the arrow + lock-on + the attacker's coiled
 * wind-up pose. Other handlers (battle, the traps, attackNegated) take it back with
 * ctx.take('attack'); `release(ms)` eases the attacker out of the coil, `shatter()` breaks the
 * arrow and reticle apart (a negated attack), `destroy()` removes everything at once.
 */
export interface AttackHold extends Disposable {
  readonly kind: 'attackHold';
  readonly attackerUid: number;
  readonly targetUid: number | null;
  readonly player: PlayerId;
  /** Arrow start (attacker core) and end (target core / duelist). */
  readonly from: XY;
  readonly to: XY;
  /** Fade the arrow + reticle out (keeps the attacker coiled). */
  dropMarks(): void;
  /** The arrow + reticle shatter into sparks (the attack is negated). */
  shatterMarks(): void;
  /** Ease the attacker back to rest over `ms` (then the hold is done). */
  release(ms?: number): Promise<void>;
}

export function isHold(h: Disposable | null): h is AttackHold {
  return !!h && (h as Partial<AttackHold>).kind === 'attackHold';
}

/** Take the kept attack declaration (an AttackHold from battle/declare.ts, or the default's handle). */
export function takeAttack(ctx: AnyCtx | CinematicContext<never>): { hold: AttackHold | null; other: Disposable | null } {
  const h = (ctx as AnyCtx).take('attack');
  if (!h) return { hold: null, other: null };
  return isHold(h) ? { hold: h, other: null } : { hold: null, other: h };
}

// ================================================================ guard pose: never snap into 'hit'

/**
 * Art-review rule: a DEFENSE-position monster that takes a hit never snaps from its guard pose
 * into the upright 'hit' recoil. This now lives in MonsterUnit itself (UnitSprite + guardHit):
 * unit.play('hit'), sprite.play(<hit anim>) and setFrame('hit:N') all answer from the guard pose
 * for every unit, in and out of battle. Kept as a no-op so older imports keep working.
 * @deprecated nothing to install any more
 */
export function guardRemap(_u: MonsterUnit): void {
  /* handled by MonsterUnit (guard-pose rule) */
}

/** @deprecated see guardRemap — a no-op. */
export function guardRemapAll(_views: DuelViews): void {
  /* handled by MonsterUnit (guard-pose rule) */
}

/**
 * A defense-position monster takes a blow WITHOUT leaving its guard pose: impact sparks + shake,
 * then MonsterUnit.guardHit — white silhouette frames, a hex-shield glint on the side the blow
 * came from and a 2–3 px knock-back along the blow — under a hit-stop. `survive` springs it back
 * home; otherwise it stays pushed (the shatter follows). Resolves after the knock-back beat
 * (~0.2–0.35 s).
 * Weight profiles (src/duel/motion.ts; on in the v3 look): the knock-back follows the guard's
 * weight class (MonsterUnit.guardHit), the hit-stop and shake those of the blow's source `by`
 * (default: the other monster of the battle). Off, or without a source: the old power tables.
 */
export async function guardReact(
  ctx: AnyCtx | CinematicContext<never>,
  u: MonsterUnit,
  o: { power: 1 | 2 | 3; dir?: XY; at?: XY; ramp?: Ramp; survive: boolean; noStop?: boolean; by?: WeightSource },
): Promise<void> {
  const sc = (ctx as AnyCtx).scene;
  if (!live(u)) return;
  const dir = norm(o.dir ?? { x: u.player === 0 ? -1 : 1, y: u.player === 0 ? 0.5 : -0.5 });
  const at = o.at ?? u.core();
  const by = o.by !== undefined ? o.by : WEIGHT_MOTION ? blowSource(ctx as AnyCtx, u) : null;
  // sparks / star / ring + camera shake (our own hit-stop below)
  void combatImpact(sc, at.x, at.y, { power: o.power, ramp: o.ramp, dir, noStop: true, shakePx: reactShakePx(o.power, by) });
  // flash + glint + knock-back from the guard pose (its tweens wait out the hit-stop)
  const react = u.guardHit({ dir, power: o.power, hold: !o.survive });
  if (!o.noStop) await stopTime(sc, reactStopMs(o.power, by)); // legacy: [0, 60, 80, 100][power]
  await react;
}

/**
 * Hexagonal shield glint (pixel raster, ~360 ms): a flattened hexagon facing `face` (−1 left /
 * +1 right) flashes white, its rim ripples blue, a light streak runs across it, then it breaks up.
 */
export function hexGlint(scene: Phaser.Scene, x: number, y: number, face: number, color: number = PAL.water3, ms = 360): Promise<void> {
  x = Math.round(x);
  y = Math.round(y);
  const ras = Raster.around(scene, x, y, 56, 64, DEPTH.FX + 2, ADD);
  const R = 15;
  const sq = 0.55;
  const hexPts = (r: number): XY[] => {
    const pts: XY[] = [];
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6;
      pts.push({ x: x + Math.cos(a) * r * sq, y: y + Math.sin(a) * r });
    }
    return pts;
  };
  return run(scene, ms, (t) => {
    ras.draw((g) => {
      const grow = t < 0.2 ? 0.7 + (t / 0.2) * 0.35 : 1.05 - (t - 0.2) * 0.08;
      const lv = t < 0.15 ? 1 : 1 - (t - 0.15) / 0.85;
      const r = R * grow;
      const outer = hexPts(r);
      if (t < 0.1) g.poly(outer, PAL.white, 0.5);
      g.path(outer, t < 0.15 ? PAL.white : color, lv);
      g.path(hexPts(r - 3), t < 0.25 ? PAL.water4 : RAMPS.water[2], lv * 0.7);
      // inner honeycomb seams
      if (t < 0.5) {
        const inner = hexPts(r * 0.45);
        for (let i = 0; i < 6; i++) g.line(inner[i].x, inner[i].y, outer[i].x, outer[i].y, color, lv * 0.45);
      }
      // a light streak sweeping across the plate
      const sx = x + lerp(-r * sq, r * sq, clamp01(t * 2.2)) * (face >= 0 ? 1 : -1);
      if (t < 0.45) g.line(sx - 2, y - r * 0.7, sx + 2, y + r * 0.7, PAL.white, 1 - t * 2);
    });
  }).then(() => ras.destroy());
}

// ================================================================ trap window: set cards breathe

/**
 * While a trap response is pending: every face-down spell/trap card of `player` breathes magenta
 * (repeated pulses + rising motes). All set cards pulse, not only the eligible traps, so the
 * opponent learns nothing about which card is which. destroy() stops it (pulses end gracefully).
 */
export function setCardPulse(ctx: AnyCtx | CinematicContext<never>, player: PlayerId): Disposable & { tiles: TileCard[]; settle(color?: number): void } {
  const c = ctx as AnyCtx;
  const sc = c.scene;
  const tiles = c.views.field
    .tiles()
    .filter((e) => e.player === player && e.spot === 'spellTrap' && !e.tile.faceUp && e.tile.active)
    .map((e) => e.tile);
  let alive = true;
  const motes = new Sparks(sc, DEPTH.FX - 2, ADD);
  const stopMotes = onFrame(sc, (dt) => {
    if (!alive) return false;
    for (const t of tiles) {
      if (!t.active || t.standing) continue;
      if (rnd() < dt / 140) motes.add({ x: t.home.x + rr(-14, 14), y: t.home.y + rr(-4, 6), vy: rr(-26, -12), life: rr(380, 620), ramp: [PAL.mag4, PAL.mag3, PAL.mag2, PAL.mag1], tex: rnd() < 0.2 ? 'fx:plus' : 'fx:px1' });
    }
    return true;
  });
  void (async () => {
    let k = 0;
    while (alive && sc.sys.isActive()) {
      for (const t of tiles) if (t.active && !t.standing && t.visible) void t.pulse(k % 2 ? PAL.mag2 : PAL.mag3, 560);
      k++;
      await wait(sc, 700);
    }
  })();
  return {
    tiles,
    destroy() {
      if (!alive) return;
      alive = false;
      stopMotes();
      motes.close();
    },
    /** Stop and give every card one last cooling pulse (the window closed). */
    settle(color: number = PAL.night4) {
      this.destroy();
      for (const t of tiles) if (t.active && !t.standing && t.visible) void t.pulse(color, 300);
    },
  };
}

export type SetPulse = ReturnType<typeof setCardPulse>;

export function isSetPulse(h: Disposable | null): h is SetPulse {
  return !!h && Array.isArray((h as Partial<SetPulse>).tiles) && typeof (h as Partial<SetPulse>).settle === 'function';
}

// ================================================================ misc

/** The unit's depth band (for effects drawn behind / in front of a sprite). */
export function depthOf(u: MonsterUnit, d = 0): number {
  return unitDepth(u.home.y) + d;
}

/** Duelist avatar of a player (or null when the art is missing). */
export function duelist(ctx: AnyCtx | CinematicContext<never>, p: PlayerId) {
  try {
    return (ctx as AnyCtx).views.duelists?.get(p) ?? null;
  } catch {
    return null;
  }
}
