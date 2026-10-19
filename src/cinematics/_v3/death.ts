// v3 DEATH KIT (docs/v3/A0_ENVANTER.md §6.2 item 2; plan §4 "Ölüm karaktere özgüdür ... ve kartın
// doğru bölgeye gidişiyle süreklidir"). ONE monster death for both strikes kits and the default
// destroy handler under ?look=v3:
//
//   strikes-a/_kit flavoredDeath, strikes-b/_kit flavoredDeath  → deathV3(ctx, { legacy, fallback })
//   _defaults/battle 'destroy' (a visible monster)               → deathV3(ctx, { fallback })
//
// Bookkeeping (as the old kits): the following toGraveyard of the card is claimed, the unit and its
// tile are released from the field (no ghost card: views.sync never sees them again), the badge
// hides, the unit is retired and forgotten at the end.
//
// The body
//   - with a `death` pose (v3 art): the pose plays from wherever the blow left the body (its
//     reaction pose; frame 0 continues from hit), holding its last frame; at its `dissolve` mark the
//     monster's ACCENT starts (its old death flavour as a preset: crystal light leaking out, the
//     void pool opening, embers dying, drips, motes, leaves, dust), and from the LAST frame the body
//     breaks as its MATERIAL (vfx/shatter material presets: crisp, no hologram glitch);
//   - without one (the 10 old monsters, until A4 draws their poses): its reaction pose holds a
//     beat while its flavour's ACCENT (the preset above: embers, drips, dust, motes...) plays, then
//     it breaks as its material. The old full-length flavours (1.4–1.7 s, fractional squash /
//     rotation) are not run in the v3 look: every monster keeps the ≤ 1.4 s destroy rule.
// The start (posematch.ts): the death pose starts on the frame that continues the recoil on screen
// without a jump — the lethal recoil stopped on its planned frame (react.ts), or the death frame
// (≤ 3 skipped) closest to whatever the body shows when the death begins.
// A claimed unit (MonsterUnit.claim: a losing attacker whose legacy strike still runs) is driven
// through asClaimant only.
// The card (card continuity, ./card.ts): the tile card stays under the body for the whole death
// and is born as the flying card ON the burst frame — the moment the body breaks, so there is no
// empty frame between them — then arcs onto the owner's graveyard pile at scale 1.
// Timing: the handler resolves when the card has landed; the debris finish on their own. A slice
// monster with its death pose stays within the plan's ≤ 1.4 s (pose ≤ ~0.9 s + 2 burst frames +
// the flight ≈ 0.3 s).

import type Phaser from 'phaser';
import type { GameEvent } from '../../engine/types';
import { PAL } from '../../art/palette';
import type { PixelCanvas } from '../../art/pixel';
import { monsterFrame } from '../../art/textures';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, type XY, zoneXY } from '../../view/layout';
import { lightFlash, lightPool, type LightHandle } from '../../view/light';
import { Px, Sparks, onFrame, sleep } from '../../vfx/combat';
import { shatter, type ShatterMaterial } from '../../vfx/shatter';
import type { CinematicContext } from '../_core/types';
import { behindBodies, cardLeaves } from './card';
import { contactFlash } from './flash';
import { deathStartFrom, takePlannedEntry } from './posematch';
import { planGuardBreak, runGuardBreak, showsGuard } from './guardbreak';
import { atFrame, hush, panAt, play, soundsOf } from './sound';

type DestroyCtx = CinematicContext<Extract<GameEvent, { type: 'destroy' }>>;
type ToGraveyardEv = Extract<GameEvent, { type: 'toGraveyard' }>;

// ================================================================ presets (pure: ./presets.ts)

export { DEATH_PRESETS, deathMaterial, deathPreset, matterRamp, type DeathPreset } from './presets';
import { deathPreset } from './presets';

// ================================================================ accents

interface AccentSpec {
  /** Pixel motes emitted while the body dies: from the body or the feet; vy range, gravity, sway. */
  emit: { from: 'body' | 'feet'; rate: number; colors: readonly number[]; vy: readonly [number, number]; ay: number; sway: number; shape: 'px' | 'plus' | 'puff'; life: readonly [number, number]; floor?: boolean } | null;
  /** A dithered pool opening on the floor (outer, inner, core, rim). */
  pool: readonly [number, number, number, number] | null;
  /** Sparkle glints popping on the body (crystal light leaking out). */
  glints: readonly number[] | null;
  /** Floor light under the body (stepped light layer; v3 only) — dims as the body dies. */
  light: number | null;
}

const ACCENTS: Record<ShatterMaterial, AccentSpec> = {
  crystal: { emit: null, pool: null, glints: [PAL.white, PAL.cyan4, PAL.cyan3], light: PAL.cyan4 },
  shadow: {
    emit: { from: 'feet', rate: 40, colors: [PAL.void4, PAL.void3, PAL.void2], vy: [-60, -28], ay: 0, sway: 6, shape: 'px', life: [300, 520] },
    pool: [PAL.void2, PAL.void0, PAL.ink, PAL.void3],
    glints: null,
    light: PAL.void3,
  },
  stone: { emit: { from: 'feet', rate: 26, colors: [PAL.stone3, PAL.stone2, PAL.stone1], vy: [-22, -6], ay: 0, sway: 10, shape: 'puff', life: [380, 620] }, pool: null, glints: null, light: null },
  fire: { emit: { from: 'body', rate: 46, colors: [PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1], vy: [-70, -30], ay: 0, sway: 8, shape: 'px', life: [260, 480] }, pool: null, glints: null, light: PAL.fire3 },
  water: {
    emit: { from: 'body', rate: 34, colors: [PAL.water4, PAL.water3, PAL.water2], vy: [10, 40], ay: 520, sway: 0, shape: 'px', life: [260, 460], floor: true },
    pool: [PAL.water1, PAL.water2, PAL.water1, PAL.water3],
    glints: null,
    light: PAL.water3,
  },
  light: { emit: { from: 'body', rate: 40, colors: [PAL.white, PAL.gold4, PAL.gold3], vy: [-50, -18], ay: 0, sway: 10, shape: 'plus', life: [320, 560] }, pool: null, glints: [PAL.white, PAL.gold4], light: PAL.gold4 },
  plant: { emit: { from: 'body', rate: 24, colors: [PAL.leaf3, PAL.leaf2, PAL.earth2], vy: [8, 30], ay: 60, sway: 26, shape: 'px', life: [420, 700], floor: true }, pool: null, glints: null, light: null },
};

interface Accent {
  /** The body broke: emission stops, the pool / light close after a beat. */
  burst(): void;
  /** Stop everything now. */
  end(): void;
}

const opaqueCache = new Map<string, { x: number; y: number }[]>();

/** Opaque pixels of the frame the unit shows (frame px; sampled every 2 px). */
function bodyPixels(u: MonsterUnit): { x: number; y: number }[] {
  const fi = u.frameInfo();
  const anim = fi.anim ?? 'idle';
  const key = `${u.cardId}|${anim}|${fi.frame}`;
  let pts = opaqueCache.get(key);
  if (!pts) {
    let pc: PixelCanvas | null = null;
    try {
      pc = monsterFrame(u.cardId, anim, fi.frame);
    } catch {
      pc = null;
    }
    pts = [];
    if (pc) for (let y = 0; y < pc.h; y += 2) for (let x = 0; x < pc.w; x += 2) if (pc.isOpaque(x, y)) pts.push({ x, y });
    opaqueCache.set(key, pts);
  }
  return pts;
}

/** Deterministic per-death random (films stay repeatable). */
function rng(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function runAccent(sc: Phaser.Scene, u: MonsterUnit, kind: ShatterMaterial, home: XY): Accent {
  const A = ACCENTS[kind];
  const rnd = rng(u.uid * 97 + 13);
  const RR = (a: number, b: number) => a + (b - a) * rnd();
  const sp = new Sparks(sc, u.sprite.depth + 0.6);
  // under the tile card (the card stays readable on its tile until it is born into the flight)
  const poolG = A.pool ? new Px(sc.add.graphics().setDepth(DEPTH.TILE_FX + 6)) : null;
  let light: LightHandle | null = null;
  if (A.light !== null) {
    light = lightPool(sc, home.x, home.y, { color: A.light, radius: 26, floorY: home.y, air: 0.5, intensity: 0, anim: 'flicker', fadeIn: 0 });
    light.setIntensity(0.9, 120);
  }
  let emitting = true;
  let poolK = 0;
  let closing = -1;
  let acc = 0;
  let glintAcc = 0;
  let stopped = false;
  const stop = onFrame(sc, (dt, el) => {
    if (stopped) return false;
    // ---- motes from the body / the feet
    if (A.emit && emitting && dt > 0) {
      acc += (dt / 1000) * A.emit.rate;
      while (acc >= 1) {
        acc -= 1;
        let p: XY;
        if (A.emit.from === 'feet' || !u.sprite.visible) p = { x: home.x + RR(-12, 12), y: home.y + RR(-2, 2) };
        else {
          const pts = bodyPixels(u);
          const q = pts.length ? pts[Math.floor(rnd() * pts.length)] : u.art.core;
          p = u.framePoint(q.x, q.y);
        }
        sp.add({
          x: Math.round(p.x),
          y: Math.round(p.y),
          vx: RR(-A.emit.sway, A.emit.sway),
          vy: RR(A.emit.vy[0], A.emit.vy[1]),
          ay: A.emit.ay,
          drag: 0.6,
          life: RR(A.emit.life[0], A.emit.life[1]),
          colors: A.emit.colors,
          shape: A.emit.shape,
          size: A.emit.shape === 'puff' ? RR(1.5, 3) : 1,
          flicker: A.emit.shape === 'px' && kind !== 'water',
          floor: A.emit.floor ? home.y + Math.round(RR(-2, 2)) : undefined,
          bounce: 0,
          fadeAt: 1,
        });
      }
    }
    // ---- glints: light leaking out of the body (crystal) / sparkles (light)
    if (A.glints && emitting && u.sprite.visible && dt > 0) {
      glintAcc += dt;
      if (glintAcc >= 55) {
        glintAcc = 0;
        const pts = bodyPixels(u);
        if (pts.length) {
          const q = pts[Math.floor(rnd() * pts.length)];
          const p = u.framePoint(q.x, q.y);
          sp.add({ x: Math.round(p.x), y: Math.round(p.y), life: 160, size: RR(2.6, 3.6), shape: 'star', colors: A.glints, fadeAt: 1, rot: 0 });
        }
      }
    }
    // ---- the pool on the floor (opens, then closes after the burst)
    if (poolG && A.pool) {
      poolG.clear();
      if (closing < 0) poolK = Math.min(1, poolK + dt / 240);
      else {
        closing += dt;
        poolK = Math.max(0, 1 - closing / 260);
      }
      const rx = Math.round(20 * poolK);
      if (rx >= 2) {
        const ry = Math.max(1, Math.round(rx * 0.45));
        const [outer, inner, core, rim] = A.pool;
        for (let y = -ry - 1; y <= ry + 1; y++)
          for (let x = -rx - 2; x <= rx + 2; x++) {
            const d = (x * x) / ((rx + 2) * (rx + 2)) + (y * y) / ((ry + 1) * (ry + 1));
            if (d > 1) continue;
            const di = (x * x) / (rx * rx) + (y * y) / (ry * ry);
            const c = di > 1 ? ((x + y) % 2 === 0 ? outer : -1) : di > 0.8 ? rim : di > 0.35 ? inner : core;
            if (c >= 0) poolG.dot(home.x + x, home.y + y, c, 1);
          }
        // the rim turns (a few bright pixels orbiting)
        for (let i = 0; i < 3; i++) {
          const a = el * 0.008 + (i / 3) * Math.PI * 2;
          poolG.dot(Math.round(home.x + Math.cos(a) * rx), Math.round(home.y + Math.sin(a) * ry), PAL.white, 1);
        }
      } else if (closing >= 0) return false;
    }
    return true;
  });
  const end = () => {
    if (stopped) return;
    stopped = true;
    stop();
    poolG?.g.destroy();
    sp.release();
    if (light) void light.fadeOut(160);
  };
  return {
    burst() {
      emitting = false;
      if (light) {
        // the light inside goes out with a last pulse on the floor
        void lightFlash(sc, home.x, home.y - 10, A.light ?? PAL.white, 34, 260, { floorY: home.y, ring: true, intensity: 0.8 });
        void light.fadeOut(220);
        light = null;
      }
      if (poolG) void sleep(sc, 420).then(() => (closing = closing < 0 ? 0 : closing));
      else void sleep(sc, 300).then(end);
      void sleep(sc, 1200).then(end);
    },
    end,
  };
}

// ================================================================ the death

export interface V3DeathArgs {
  ctx: DestroyCtx;
  unit: MonsterUnit;
  /** Burst direction hint (the blow's direction), if any. */
  push: XY | undefined;
  /** Play the recoil flash first (false when the impact already flashed it). */
  hit: boolean;
  home: XY;
  /** The body breaks NOW: the card under it is born and leaves for the graveyard. */
  burst(): void;
}

export interface DeathV3Opts {
  /**
   * The monster's old flavour. Kept for the kits' API; the v3 look no longer runs it (its accent
   * preset plays instead, see the header) — A4 replaces it with the monster's death pose.
   */
  legacy?: (d: V3DeathArgs) => Promise<void>;
  /** Extra debris / remains of the monster's flavour on the burst frame (e.g. the volt lizard's static ball). */
  onBurst?: (u: MonsterUnit, at: XY) => void;
  /** Cases the kit does not animate (not a visible monster): the chain's next handler. */
  fallback: () => Promise<void>;
}

/** A unit that can die on screen. */
function liveUnit(u: MonsterUnit | null): u is MonsterUnit {
  return !!u && !u.retired && u.sprite.active && u.sprite.visible;
}

/**
 * The v3 monster death (see the header). Falls back (o.fallback) for spell / trap destroys and
 * monsters that are not on screen.
 */
export async function deathV3(ctx: DestroyCtx, o: DeathV3Opts): Promise<void> {
  const ev = ctx.ev;
  if (ev.location !== 'monster') return o.fallback();
  const field = ctx.views.field;
  const unit = field.unit(ev.uid);
  if (!liveUnit(unit)) return o.fallback();
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid, {
    until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' && e.type !== 'fieldSpell' && e.type !== 'statChange',
  });
  const gEv = gi >= 0 ? (ctx.events[gi] as ToGraveyardEv) : null;
  if (gi >= 0) ctx.consumeAt(gi);
  const owner = gEv ? gEv.owner : ctx.owner(ev.uid);
  const { tile } = field.release(ev.uid);
  const home = tile ? { x: tile.home.x, y: tile.home.y } : zoneXY(ev.player, 'monster', ev.zone);
  unit.badge.setVisible(false);
  unit.posed = true;
  // ---- the card: born on the tile on the burst frame, then off to the graveyard
  let leave: Promise<void> | null = null;
  // hints.onBorn: the caller (the battle) eases its camera out from the card's birth on
  const onBorn = typeof ctx.hints.onBorn === 'function' ? (ctx.hints.onBorn as () => void) : null;
  const burst = () => {
    if (leave) return;
    try {
      onBorn?.();
      if (o.onBurst && unit.sprite.active) o.onBurst(unit, unit.core());
    } catch (e) {
      console.error('[death] onBorn', e);
    }
    // the card flies over the board but never in front of a body standing nearer the camera
    if (gEv) leave = cardLeaves(ctx, { owner, cardId: ev.cardId, from: home, tile, depthAt: behindBodies(ctx, unit) }).catch((e) => console.error('[death] card', e));
    else if (tile && tile.active)
      leave = tile
        .dissolve(420)
        .then(() => {
          if (tile.active) tile.destroy();
        })
        .catch(() => undefined);
    else leave = Promise.resolve();
  };
  const d: V3DeathArgs = { ctx, unit, push: ctx.hints.push as XY | undefined, hit: ctx.hints.hit !== false, home, burst };
  // released from the field: the timing tools follow its death frames through these
  ctx.scene.events.emit('v3:dying', unit);
  try {
    if (unit.has('death')) await posedDeath(d);
    else await reactionDeath(d, LEGACY_BEAT_MS);
  } catch (e) {
    console.error('[death] v3 death failed', e);
  } finally {
    burst();
    unit.posed = false;
    if (!unit.retired) unit.retire();
    field.forget(ev.uid);
    ctx.scene.events.emit('v3:dead', unit);
  }
  await leave;
}

/** The body breaks as its material from the frame it shows (the card is born on the burst frame). */
function breakBody(d: V3DeathArgs, accent: Accent | null, pushK: number): Promise<void> {
  const u = d.unit;
  const sc = d.ctx.scene;
  const P = deathPreset(u.cardId);
  const push = d.push ? { x: d.push.x * pushK, y: d.push.y * pushK } : undefined;
  // a character with its own break sound (sound.ts) scores the burst frame itself: the shatter's
  // generic burst sound (played synchronously on that frame) is skipped
  const C = soundsOf(u.cardId);
  const brk = () =>
    shatter(sc, u.sprite, {
      monsterId: u.cardId,
      attribute: u.attribute,
      material: P.material,
      floorY: d.home.y,
      push,
      onBurst: () => {
        d.burst();
        accent?.burst();
        if (C) play(C.burst, { pan: panAt(d.home.x) });
      },
    });
  return (C ? hush(['shatter'], brk) : brk()).finally(() => accent?.end());
}

/** The accent beat of a monster without a death pose: its reaction holds while the accent plays. */
const LEGACY_BEAT_MS = 130;

/** Resolve once `cond` holds, or after `ms` of scene time. */
function until(sc: Phaser.Scene, cond: () => boolean, ms: number): Promise<void> {
  if (cond()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    onFrame(sc, (_dt, el) => {
      if (cond() || el >= ms) {
        resolve();
        return false;
      }
      return true;
    });
  });
}

/** The death pose → accent from its dissolve mark → the material break from its last frame. */
async function posedDeath(d: V3DeathArgs): Promise<void> {
  const u = d.unit;
  const sc = d.ctx.scene;
  const n = u.frameCount('death');
  if (d.hit) contactFlash(sc, u.sprite, d.push ?? { x: u.player === 0 ? -1 : 1, y: 0 }, { frames: 2, coverage: 0.4 });
  const inDeath = () => u.frameInfo().anim === 'death';
  // a lethal recoil hands over to the pose by itself (react.ts): join it where it is; if the
  // recoil is still on its way to the matching frame, give it that long
  let planned = takePlannedEntry(u);
  // a guard that dies without a planned break (a destroy with no blow, a reaction that left it in
  // its guard): it breaks open into the death pose here (./guardbreak.ts), never pops out of it
  if (!planned && !inDeath() && u.sprite.active && showsGuard(u)) {
    const g = planGuardBreak(u);
    if (g) {
      runGuardBreak(u, g);
      planned = takePlannedEntry(u);
    }
  }
  if (planned && !inDeath()) await until(sc, inDeath, Math.min(700, (planned.leadMs ?? u.rangeMs(planned.anim, 0, planned.hold)) + 40));
  if (!inDeath() && u.sprite.active) {
    // no plan (a guard, a blow from behind...): the death frame that continues the shown frame best
    const start = Math.max(0, Math.min(n - 2, planned ? planned.start : deathStartFrom(u)));
    u.asClaimant(() => void u.playRange('death', start, undefined, { hold: true }));
  }
  /** Until the pose shows frame `f` (never restarts a pose that already passed it or ended). */
  const untilFrame = (f: number): Promise<void> => {
    const fi = u.frameInfo();
    if (!u.sprite.active || fi.anim !== 'death' || fi.frame >= f) return Promise.resolve();
    if (!u.sprite.anims.isPlaying) return Promise.resolve();
    return u.asClaimant(() => u.playToFrame('death', f));
  };
  const dissolveF = u.markFrame('death', 'dissolve', Math.max(0, n - 3));
  // the character's death beats on their frames (the blow's own sound is the contact's): the first
  // beat of the death itself, the dissolve, what follows it (the magus' staff hitting the floor)
  const C = soundsOf(u.cardId);
  if (C) {
    const pan = panAt(d.home.x);
    if (C.deathStart) atFrame(u, 'death', Math.min(1, n - 1), () => play(C.deathStart!, { pan }), { late: false });
    atFrame(u, 'death', dissolveF, () => play(C.dissolve, { pan }), { late: false });
    for (const [off, name, volume] of C.afterDissolve ?? []) atFrame(u, 'death', Math.min(n - 1, dissolveF + off), () => play(name, { volume, pan }), { late: false });
  }
  const box: { accent: Accent | null } = { accent: null };
  const startAccent = () => {
    if (!box.accent && u.sprite.active) box.accent = runAccent(sc, u, deathPreset(u.cardId).accent, d.home);
  };
  void untilFrame(dissolveF).then(startAccent);
  await untilFrame(n - 1);
  // the last frame stays its own hold before the body breaks
  if (u.sprite.active && u.frameInfo().anim === 'death') await sleep(sc, u.frameMs('death', n - 1));
  startAccent();
  if (!u.sprite.active || !u.sprite.visible) {
    box.accent?.burst();
    return;
  }
  // the debris finish on their own; the death is over once the card has landed
  void breakBody(d, box.accent, 0.4).then(() => !u.retired && u.retire(0));
  d.burst();
}

/**
 * No death pose (the old monsters): the reaction holds a beat while the flavour's accent plays
 * (embers, drips, dust...), then the body breaks as its material. `beat`: the accent's beat.
 */
async function reactionDeath(d: V3DeathArgs, beat = 90): Promise<void> {
  const u = d.unit;
  const sc = d.ctx.scene;
  if (d.hit) {
    const anim = u.has('hitHeavy') ? 'hitHeavy' : 'hit';
    u.asClaimant(() => void u.play(anim, { hold: true }));
    contactFlash(sc, u.sprite, d.push ?? { x: u.player === 0 ? -1 : 1, y: 0 }, { frames: 2, coverage: 0.45 });
    await sleep(sc, 120);
  }
  if (!u.sprite.active || !u.sprite.visible) return;
  const accent = runAccent(sc, u, deathPreset(u.cardId).accent, d.home);
  await sleep(sc, beat);
  void breakBody(d, accent, 1).then(() => !u.retired && u.retire(0));
  d.burst();
}

// ================================================================ the default destroy (v3)

/**
 * The default 'destroy' handler of the v3 look: a visible monster dies through deathV3 (its pose
 * or its reaction + material break); a card without a body on screen (a spell / trap, a face-down
 * monster) turns face-up on its tile if needed, cracks (white pulse, sparks, a 1 px jolt; a rule
 * destroy just lets go) and is born from its tile into the graveyard flight — never dissolved
 * first and re-spawned out of the empty tile.
 */
export async function destroyV3(ctx: DestroyCtx): Promise<void> {
  const ev = ctx.ev;
  const field = ctx.views.field;
  if (ev.location === 'monster' && liveUnit(field.unit(ev.uid))) return deathV3(ctx, { fallback: () => Promise.resolve() });
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid, {
    until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' && e.type !== 'fieldSpell' && e.type !== 'statChange',
  });
  const gEv = gi >= 0 ? (ctx.events[gi] as ToGraveyardEv) : null;
  if (gi >= 0) ctx.consumeAt(gi);
  const owner = gEv ? gEv.owner : ctx.owner(ev.uid);
  const { tile, unit } = field.release(ev.uid);
  unit?.retire();
  const home = tile ? { x: tile.home.x, y: tile.home.y } : zoneXY(ev.player, ev.location === 'field' ? 'field' : ev.location, ev.zone);
  const sc = ctx.scene;
  if (tile && tile.active) {
    if (!tile.faceUp) {
      tile.setCard(ev.cardId);
      await tile.flipUp(240);
    }
    if (ev.reason !== 'rule' && tile.active) {
      ctx.sfx('shatter', { volume: 0.55, pitch: 1.35 });
      void tile.pulse(PAL.white, 140);
      const sp = new Sparks(sc, DEPTH.FX + 2);
      const rnd = rng(ev.uid * 31 + 7);
      for (let i = 0; i < 8; i++) {
        const a = Math.PI + rnd() * Math.PI;
        const v = 30 + rnd() * 50;
        sp.add({ x: home.x + Math.round((rnd() - 0.5) * 16), y: home.y - 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, ay: 260, life: 220 + rnd() * 160, colors: [PAL.white, PAL.mist, PAL.steel], shape: 'px', fadeAt: 1 });
      }
      sp.release();
      if (tile.active) tile.x = home.x + 1;
      await sleep(sc, 50);
      if (tile.active) tile.x = home.x;
      await sleep(sc, 90);
    }
  }
  if (ev.location === 'monster') field.forget(ev.uid);
  if (gEv) await cardLeaves(ctx, { owner, cardId: ev.cardId, from: home, tile });
  else if (tile && tile.active) {
    await tile.dissolve(420);
    if (tile.active) tile.destroy();
  }
}
