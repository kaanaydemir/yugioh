// The recipe layer — summons (docs/v3/A3_MIMARI.md §6.2) and the named set-piece library. A monster that
// does not draw its own entrance (`custom.summon`) enters through summon-b's entrance() (the card slam /
// tile flash, the hidden unit, the clean settle) on ITS OWN summon pose (_v3/summon summonPose: the body
// formed in ≤ 300 ms of hologram while the pose already moves) in the recipe's style. install.ts
// registers it (registerCardHook 'summon', priority 10) only in the v3 look and only for a monster with
// v3 art. A3 builds ONE style, the pilot's 'assemble'; the others arrive with their first user.
//
// 'assemble' (A0 §1.3 "karakterli girişler": the body put together from its matter)
//   0      the voice's 'arrive' (else summonCharge); the matter gathers — pieces of the recipe's
//          `summon.matter` rise off a ring on the floor around the tile and circle the empty tile
//          (behind the body on the far half of their orbit, in front on the near half) for
//          `summon.leadMs` (default ASSEMBLE_LEAD_MS; a set piece named by `summon.setPiece` replaces
//          this gathering)
//   lead   the summon pose starts (the body forms in ≤ 300 ms of hologram) while the pieces spiral in
//          and close on it by the pose's 'land'
//   land   the voice's 'land' (else impactLight): the last pieces lock in, floor dust
//   peak   the pose's big beat (the pilot's shield slam is its summon pose's peak): the voice's
//          'roar' (else roarSmall), recipe.hooks.onSummonPeak, the kit's finale (shock ring, light,
//          `summon.shake` px of shake — default ASSEMBLE_SHAKE_PX —, the ATK / DEF badge)
//   end    the pose ends on idle 0; the entrance settles the unit.
// An ace (CardDef.ace) with a recipe summon gets its cut-in in A4.1 (Magma Titanı is the first): A3's
// pilot is a normal-tier card without one.
//
// Set pieces (`setpieces/<name>.ts` → registerSetPiece(name, fn) at module load; the cinematics loader
// loads them with every other cinematics file): a library shared by name (lava rift, vortex, rock
// assembly, bud cage, shadow pool). A set piece runs beside the pose and gets its beats as promises.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { mulberry32 } from '../../art/pixel';
import type { Ramp } from '../../art/palette';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { PresentationRecipe, RecipeHooks } from '../../presentation/types';
import { DEPTH, type XY } from '../../view/layout';
import { lightPool } from '../../view/light';
import { Sparks, onFrame, sleep } from '../../vfx/combat';
import { Raster } from '../../vfx/setpieces';
import type { CinematicContext } from '../_core/types';
import { matterRamp, rampOfMatter } from '../_v3/presets';
import { summonPose } from '../_v3/summon';
import { panAt, play, soundsOf } from '../_v3/sound';
import { entrance, type Entrance, type SummonCtx } from '../summon-b/_kit';
import { hooksOf } from './strike';

// ================================================================ set pieces

/** What a set piece gets: the unit, its tile, the matter tones and the pose's beats. */
export interface SetPieceArgs {
  ctx: CinematicContext;
  scene: Phaser.Scene;
  unit: MonsterUnit;
  recipe: PresentationRecipe;
  /** The tile's floor point. */
  home: XY;
  /** The matter's tones (dark → light). */
  ramp: Ramp;
  /** The pose's beats (summonPose): feet on the floor, the big beat, the end. */
  land: Promise<void>;
  peak: Promise<void>;
  done: Promise<void>;
  /** ms from the set piece's start to the start of the pose (the matter's lead; 0 when none). */
  lead: number;
}
export type SetPiece = (a: SetPieceArgs) => void | Promise<void>;

const SET_PIECES = new Map<string, SetPiece>();

/** Register a named set piece (setpieces/<name>.ts at module load). Returns its unregister. */
export function registerSetPiece(name: string, fn: SetPiece): () => void {
  SET_PIECES.set(name, fn);
  return () => {
    if (SET_PIECES.get(name) === fn) SET_PIECES.delete(name);
  };
}

/** A registered set piece, or null. */
export function setPieceOf(name: string | null | undefined): SetPiece | null {
  return (name && SET_PIECES.get(name)) || null;
}

// ================================================================ 'assemble'

/** How long the matter circles the empty tile before the summon pose starts (ms; recipe `summon.leadMs`). */
export const ASSEMBLE_LEAD_MS = 220;
/** The finale's camera shake (px; recipe `summon.shake`). */
export const ASSEMBLE_SHAKE_PX = 2;

interface Piece {
  /** orbit angle at t = 0 (rad), turn speed (rad/s) */
  a0: number;
  w: number;
  /** floor-ring radius (px), size (1: a 2×2 chip, 2: a 3×2 stone) */
  r0: number;
  big: boolean;
  /** start delay (ms) */
  delay: number;
}

/**
 * The default gathering of 'assemble': pieces of the matter rise off a ring on the floor around the tile,
 * circle it (iso ellipse; behind the body on the far half of the orbit, in front on the near half) and
 * spiral in onto the body's core, arriving at `lead + land` ms. Whole pixels, three tones per stone (lit
 * top, mid, dark underside), an ink edge below. Returns a stopper (also stops by itself on arrival).
 */
function gatherMatter(scene: Phaser.Scene, u: MonsterUnit, home: XY, ramp: Ramp, lead: number, land: number, seed: number): () => void {
  const rnd = mulberry32(seed);
  const total = Math.max(200, lead + land);
  const n = 12;
  const pieces: Piece[] = Array.from({ length: n }, (_, i) => ({
    a0: (i / n) * Math.PI * 2 + rnd() * 0.35,
    w: 4.2 + rnd() * 1.6,
    r0: 22 + rnd() * 9,
    big: i % 3 === 0,
    delay: Math.round(rnd() * 70),
  }));
  const coreH = Math.max(6, home.y - u.core().y);
  const W = 96;
  const H = 72;
  const back = Raster.around(scene, home.x, home.y - 22, W, H, u.sprite.depth - 0.3);
  const front = Raster.around(scene, home.x, home.y - 22, W, H, u.sprite.depth + 0.3);
  const lit = ramp[4];
  const mid = ramp[3];
  const dark = ramp[2];
  const stone = (g: Raster, x: number, y: number, big: boolean) => {
    const w = big ? 3 : 2;
    g.rect(x, y, w, 1, lit);
    g.rect(x, y + 1, w, 1, mid);
    g.px(x + w - 1, y + 1, dark);
    g.rect(x, y + 2, w, 1, PAL.ink);
  };
  let alive = true;
  const stop = () => {
    if (!alive) return;
    alive = false;
    back.destroy();
    front.destroy();
  };
  onFrame(scene, (_dt, el) => {
    if (!alive || !u.sprite.active) {
      stop();
      return false;
    }
    back.begin();
    front.begin();
    for (const p of pieces) {
      const t = Math.max(0, el - p.delay) / (total - p.delay);
      if (t >= 1) continue;
      // rise off the floor over the first third, then close in: the radius shrinks, the height climbs to the core
      const k = t * t * (3 - 2 * t);
      const a = p.a0 + p.w * (el / 1000);
      const r = p.r0 * (1 - k);
      const h = coreH * Math.min(1, t * 1.6) * (0.55 + 0.45 * k);
      const x = Math.round(home.x + Math.cos(a) * r) - 1;
      const y = Math.round(home.y + Math.sin(a) * r * 0.5 - h) - 1;
      stone(Math.sin(a) < 0 ? back : front, x, y, p.big && t < 0.85);
    }
    back.end();
    front.end();
    if (el >= total) {
      stop();
      return false;
    }
    return true;
  });
  return stop;
}

/** A small ring of floor dust in the matter's tones (the last pieces lock in). */
function lockDust(scene: Phaser.Scene, at: XY, ramp: Ramp): void {
  const sp = new Sparks(scene, DEPTH.FX);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    sp.add({ x: Math.round(at.x + Math.cos(a) * 6), y: Math.round(at.y + Math.sin(a) * 3), vx: Math.cos(a) * 55, vy: Math.sin(a) * 24 - 8, drag: 5, life: 300, colors: [ramp[4], ramp[3], ramp[2]], shape: 'puff', size: 1.5, fadeAt: 1 });
  }
  sp.release();
}

/** The 'assemble' entrance on the unit's summon pose (see the header). */
async function assemble(e: Entrance, r: PresentationRecipe, hooks: RecipeHooks | null): Promise<void> {
  const sc = e.scene;
  const u = e.unit;
  const voice = soundsOf(u.cardId);
  const pan = panAt(e.home.x);
  const ramp: Ramp = r.summon.matter ? rampOfMatter(r.summon.matter) : matterRamp(u.cardId);
  const lead = Math.max(0, Math.round(r.summon.leadMs ?? ASSEMBLE_LEAD_MS));
  const shake = Math.max(0, Math.round(r.summon.shake ?? ASSEMBLE_SHAKE_PX));
  if (voice) play(voice.arrive, { volume: 0.8, pan });
  else e.ctx.sfx('summonCharge', { volume: 0.6 });
  const pool = lightPool(sc, e.home.x, e.home.y, { color: ramp[3], radius: 26, floorY: e.home.y, intensity: 0.6, anim: 'steady', fadeIn: 120 });
  // the matter circles the empty tile first (the default gathering; a set piece brings its own and gets
  // the pose's beats as they come)
  const piece = setPieceOf(r.summon.setPiece);
  const landMs = u.has('summon') ? u.markMs('summon', 'land', Math.max(1, Math.round(u.frameCount('summon') * 0.3))) : 0;
  let beat!: { land(): void; peak(): void; done(): void };
  const beats = {
    land: new Promise<void>((ok) => (beat = { ...beat, land: ok })),
    peak: new Promise<void>((ok) => (beat = { ...beat, peak: ok })),
    done: new Promise<void>((ok) => (beat = { ...beat, done: ok })),
  };
  if (piece) {
    try {
      void Promise.resolve(piece({ ctx: e.ctx, scene: sc, unit: u, recipe: r, home: e.home, ramp, ...beats, lead })).catch((err) => console.error('[recipe] set piece', err));
    } catch (err) {
      console.error('[recipe] set piece', err);
    }
  } else gatherMatter(sc, u, e.home, ramp, lead, landMs, u.uid * 53 + 9);
  if (lead > 0) await sleep(sc, lead);
  let peaked = false;
  const p = summonPose(sc, u, {
    ramp,
    onLand: () => {
      lockDust(sc, e.home, ramp);
      if (voice) play(voice.land, { volume: 0.85, pan });
      else e.ctx.sfx('impactLight', { volume: 0.6 });
    },
    onPeak: () => {
      peaked = true;
      if (voice) play(voice.roar, { volume: 0.85, pan });
      else e.ctx.sfx('roarSmall', { volume: 0.5 });
      if (hooks?.onSummonPeak) {
        try {
          void Promise.resolve(hooks.onSummonPeak({ ctx: e.ctx, unit: u, recipe: r, home: e.home })).catch((err) => console.error('[recipe] summon hook', err));
        } catch (err) {
          console.error('[recipe] summon hook', err);
        }
      }
      e.finale({ shake, ramp, sfx: voice ? null : undefined });
    },
  });
  if (!p) {
    // no summon pose (cannot happen for v3 art with a recipe; kept safe): the plain finale
    beat.land();
    beat.peak();
    beat.done();
    void pool.fadeOut(200);
    e.finale({ ramp });
    return;
  }
  void p.land.then(beat.land);
  void p.peak.then(beat.peak);
  void p.done.then(beat.done);
  await p.done;
  if (!peaked) e.finale({ shake, ramp });
  void pool.fadeOut(260);
}

/** The recipe summon (registerCardHook 'summon'): summon-b's entrance on the unit's own pose. */
export function recipeSummon(r: PresentationRecipe): ((ctx: SummonCtx) => Promise<void>) | null {
  if (r.summon.style !== 'assemble') return null; // the other styles arrive with their first user
  return async (ctx) => {
    const hooks = await hooksOf(r);
    const piece = (e: Entrance) => assemble(e, r, hooks);
    return entrance(ctx, piece, { v3: piece });
  };
}

/** The summon styles the recipe layer builds (A3: the pilot's). */
export const SUMMON_STYLES: readonly PresentationRecipe['summon']['style'][] = Object.freeze(['assemble'] as const);
