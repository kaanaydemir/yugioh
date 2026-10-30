// Şafak Kılıçları (dawn_swords) — the fence of light, its counter badge and the v3 scene.
//
// The card is a CONTINUOUS spell: it lies face-up on its zone and, for three of the opponent's turns, the
// opponent's monsters cannot attack. The picture of that is a fence: six slender light blades planted along the
// front of the OPPONENT's half, and a small badge of three mini blades floating over the spell tile — the
// counter. Both stay on the board for as long as the card does (a persistent view, one DawnFence per spell uid;
// dawn_swords.ts registers the hooks, an observer rebuilds a fence for a staged / restored board).
//
//   activate  (v3)  the A2 opening (hold 100) → the card lies down on its zone (landV3) → mark `drop`:
//                   the six blades fall one after another (48 ms apart, 110 ms each) from above onto the
//                   front line, left → right; each plant bites the floor (1 px overshoot), a stepped floor ring
//                   runs out, dust motes spring up, a gold light flares — dawnPlant; → mark `sweep` (+130 ms):
//                   a curtain of dawn light sweeps over the opponent's field left → right (340 ms); every
//                   face-down monster flips face-up as it passes (the engine's own flip presentation, played
//                   by ctx.play: no flip effect fires — the engine says so, `cause: 'reveal'`) → the badge
//                   pops in over the tile with its three blades. ≈ 1.5 s in all (budget 2.2 s).
//   counter   (tick) the opponent's turn ended: the two outermost blades erode from the tip upward into rising
//                   light motes (8 steps × 34 ms), the badge's right-most pip flashes white and goes dark. ≤ 0.5 s.
//   counter 0       the last pair fades the same way, the badge goes; the card then leaves for the graveyard
//                   (the 'destroyed' hook, reason 'rule').
//   destroyed early (Arınma Dalgası …) every blade breaks at once into gold shards; the lock ends with it.
//
// The old look (?look=v1 / &a5=off) uses the same fence kit but plain: flat blades, no light, no idle motion, a
// straight drop and a fade — as simple as the other old spell handlers.
//
// Everything is on scene time (speed / hit-stop aware), whole pixels, palette tones, no camera move.

import Phaser from 'phaser';
import type { GameEvent, PlayerId, Uid } from '../../engine/types';
import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { BOARD_COLS, DEPTH, LANE_COLS, backRow, isoToScreen, monsterRow, unitDepth, zoneXY, type XY } from '../../view/layout';
import { REDUCED_MOTION } from '../../view/v3/motion';
import { TEX, wait } from '../../vfx/core';
import { E, Raster, Sparks, floorRing, lerp, onFrame, rnd, rr, run, snd } from '../../vfx/setpieces';
import type { Motif } from '../../art/spellmotifs-v3';
import type { CinematicContext } from '../api';
import { panAt, play as playV3 } from '../_v3/sound';
import { fxCount, motifTexture } from '../_v3/spellfx';
import { GOLD_FX, bg, fs, ip, lightFlash, lightPool, type LightHandle } from './_kit';
import type { TileCard } from '../../view/TileCard';
import { V3_A5_A } from '../../view/v3flags';

type AnyCtx = CinematicContext<GameEvent>;

const ADD = Phaser.BlendModes.ADD;
const TAU = Math.PI * 2;

// ================================================================ the plan (pure; the tests read it)

/** Scene timings (ms at 1×) and sizes of the dawn scene. */
export const DAWN = Object.freeze({
  /** Blades in the fence (3 pairs — one pair per counter step). */
  blades: 6,
  /** The A2 opening's hold. */
  openHold: 100,
  /** One blade's fall, the gap between two blades' starts, and how far above its tip it starts. */
  fall: 110,
  stagger: 48,
  fallHeight: 120,
  /** The reveal sweep starts this long after the first blade starts to fall, and takes this long. */
  sweepAt: 130,
  sweepMs: 340,
  /** The curtain's height. */
  curtain: 44,
  /** A blade's erosion: steps × ms (a tick's whole dissolve ≈ 0.4 s, budget 0.6 s). */
  erodeSteps: 8,
  erodeStep: 34,
  /** The badge's pop. */
  badgePop: 120,
  /** The budget the tests pin: activation, turn-end dissolve. */
  budgetActivate: 2200,
  budgetTick: 600,
});

/** The scene time (ms) of blade `i`'s plant frame, counted from the first blade's start. */
export function plantAt(i: number): number {
  return i * DAWN.stagger + DAWN.fall;
}

/** The scene time (ms) from the first blade's start until the last blade has planted. */
export function plantedBy(): number {
  return plantAt(DAWN.blades - 1) + 40;
}

/** A tick's dissolve duration (ms). */
export function dissolveMs(): number {
  return 2 * 17 + DAWN.erodeSteps * DAWN.erodeStep + 40;
}

/**
 * The planted blade `i` (0 … 5) belongs to pair `3 - pairOf(i)`'s counter step: the outermost pair (0, 5) goes with
 * the first tick (counter 3 → 2), then (1, 4), then (2, 3).
 */
export function pairOf(i: number): number {
  return Math.min(i, DAWN.blades - 1 - i);
}

/** The blades shown while the counter reads `n` (0 … 3): the inner `2n`. */
export function bladesShown(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < DAWN.blades; i++) if (pairOf(i) >= 3 - Math.max(0, Math.min(3, n))) out.push(i);
  return out;
}

/** The two blades that dissolve when the counter goes from `from` to `from - 1`. */
export function bladesLost(from: number): number[] {
  const p = 3 - Math.max(1, Math.min(3, from));
  return [p, DAWN.blades - 1 - p];
}

/**
 * Where the fence's six blades stand (their TIPS, whole pixels, left → right): along the front of `target`'s
 * half — the line between the monster row and the bridge — from the left edge of the first lane to the right
 * edge of the last one, the ends bowed back toward the target so the line reads as an enclosure.
 */
export function fenceSpots(target: PlayerId): XY[] {
  const lanes = LANE_COLS;
  const c0 = lanes[0] - 0.5;
  const c1 = lanes[lanes.length - 1] + 0.5;
  const mr = monsterRow(target);
  const toward = target === 0 ? -1 : 1; // grid-row direction from the target's row to the bridge
  const rowF = mr + toward * 0.5;
  const out: XY[] = [];
  for (let i = 0; i < DAWN.blades; i++) {
    const u = i / (DAWN.blades - 1);
    const bow = (2 * u - 1) * (2 * u - 1);
    const p = isoToScreen(c0 + (c1 - c0) * u, rowF - toward * 0.32 * bow);
    out.push({ x: Math.round(p.x), y: Math.round(p.y) });
  }
  return out.sort((a, b) => a.x - b.x);
}

/** The grid-column of a monster zone (the reveal sweep reaches it when the curtain's column passes it). */
export function laneCol(zone: number): number {
  return LANE_COLS[Math.max(0, Math.min(LANE_COLS.length - 1, zone))];
}

/** The sweep's column at progress `t` (0 … 1): from the board's left edge to its right edge. */
export function sweepCol(t: number): number {
  return lerp(-0.6, BOARD_COLS - 0.4, Math.max(0, Math.min(1, t)));
}

/** The progress (0 … 1) at which the sweep reaches monster zone `zone`. */
export function sweepReaches(zone: number): number {
  return (laneCol(zone) - 0.2 - -0.6) / (BOARD_COLS - 0.4 - -0.6);
}

// ================================================================ the drawings (pure PixelCanvas)

const BLADE_ROWS: readonly string[] = [
  '...obo...',
  '...obo...',
  '....d....',
  '....o....',
  '....d....',
  '....o....',
  '.o.....o.',
  '.obbwbbo.',
  '..obbbo..',
  '...wab...',
  '...wab...',
  '...wab...',
  '...wab...',
  '...wab...',
  '...wab...',
  '...wab...',
  '...wab...',
  '...wab...',
  '...wab...',
  '...wab...',
  '...wab...',
  '...wab...',
  '...wab...',
  '...wab...',
  '...wab...',
  '...wab...',
  '...wab...',
  '...wab...',
  '...wab...',
  '...wab...',
  '...wab...',
  '....ab...',
  '....a....',
  '....w....',
];

export const BLADE_W = 11;
export const BLADE_H = BLADE_ROWS.length + 2;
/** The anchor of the blade drawing: its tip pixel (the floor point). */
export const BLADE_AX = 5;
export const BLADE_AY = BLADE_ROWS.length;

/** A planted light blade, hilt up, tip down: gold planes, a white edge on the light side, a 1-px ink outline. */
export function paintBlade(): PixelCanvas {
  const p = new PixelCanvas(BLADE_W, BLADE_H);
  p.stamp(BLADE_ROWS, { o: PAL.gold2, a: PAL.gold4, b: PAL.gold3, d: PAL.gold1, w: PAL.white }, 1, 1);
  p.outline(PAL.ink, { corners: false });
  return p;
}

const PIP_LIT: readonly string[] = ['.w.', '.a.', '.a.', '.a.', '.a.', 'cbc', '.d.'];

export const BADGE_W = 21;
export const BADGE_H = 13;

/** The counter badge: a dark plate with three mini blades, the first `n` lit gold, the rest dark. */
export function paintBadge(n: number): PixelCanvas {
  const p = new PixelCanvas(BADGE_W, BADGE_H);
  p.rect(1, 1, 19, 11, PAL.night1);
  p.frame(1, 1, 19, 11, PAL.gold1);
  for (let i = 0; i < 3; i++) {
    const lit = i < n;
    const key = lit ? { w: PAL.white, a: PAL.gold4, b: PAL.gold3, c: PAL.gold2, d: PAL.gold1 } : { w: PAL.gold1, a: PAL.gold0, b: PAL.gold1, c: PAL.gold0, d: PAL.gold0 };
    p.stamp(PIP_LIT, key, 3 + i * 6, 3);
  }
  p.outline(PAL.ink, { corners: false });
  return p;
}

const bladeMotif = (): Motif => ({ px: paintBlade(), ax: BLADE_AX, ay: BLADE_AY });
const badgeMotif = (n: number) => (): Motif => ({ px: paintBadge(n), ax: 10, ay: 6 });

// ================================================================ the fence (a persistent view)

interface Blade {
  i: number;
  /** The tip (floor point). */
  x: number;
  y: number;
  img: Phaser.GameObjects.Image;
  glint: Phaser.GameObjects.Image | null;
  tipGlow: Phaser.GameObjects.Image | null;
  pool: LightHandle | null;
  planted: boolean;
  gone: boolean;
}

const fences = new WeakMap<Phaser.Scene, Map<Uid, DawnFence>>();

/** Uids whose activation is playing now (the observer must not build a second fence for them). */
const casting = new Set<Uid>();
export const dawnCasting = casting;

/** The live fence of a spell uid, or null. */
export function fenceOf(scene: Phaser.Scene, uid: Uid): DawnFence | null {
  const f = fences.get(scene)?.get(uid) ?? null;
  if (f && !f.alive) {
    fences.get(scene)?.delete(uid);
    return null;
  }
  return f;
}

/** Every live fence of the scene. */
export function allFences(scene: Phaser.Scene): DawnFence[] {
  const m = fences.get(scene);
  if (!m) return [];
  for (const [u, f] of [...m]) if (!f.alive) m.delete(u);
  return [...m.values()];
}

export class DawnFence {
  readonly blades: Blade[] = [];
  /** The counter badge (an Image over the spell tile), or null. */
  private badge: Phaser.GameObjects.Image | null = null;
  private badgeN = 0;
  private badgeY = 0;
  private stopIdle: (() => void) | null = null;
  private motes: Sparks | null = null;
  private dead = false;
  /** An animation of this fence is running (the observer leaves it alone). */
  busy = 0;
  readonly rich: boolean;

  constructor(
    readonly scene: Phaser.Scene,
    readonly uid: Uid,
    /** The caster. */
    readonly owner: PlayerId,
    readonly zone: number,
    rich: boolean = V3_A5_A,
  ) {
    this.rich = rich;
    let m = fences.get(scene);
    if (!m) {
      m = new Map();
      fences.set(scene, m);
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => fences.delete(scene));
    }
    m.get(uid)?.destroy();
    m.set(uid, this);
    const target: PlayerId = owner === 0 ? 1 : 0;
    const tex = motifTexture(scene, 'dawn:blade', bladeMotif);
    fenceSpots(target).forEach((s, i) => {
      const img = scene.add
        .image(s.x, s.y, tex.key)
        .setOrigin(tex.ax / tex.w, tex.ay / tex.h)
        .setDepth(unitDepth(s.y) + 0.5)
        .setVisible(false);
      this.blades.push({ i, x: s.x, y: s.y, img, glint: null, tipGlow: null, pool: null, planted: false, gone: false });
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  get alive(): boolean {
    return !this.dead && this.blades.length > 0 && this.blades[0].img.scene !== undefined && this.blades.some((b) => b.img.active);
  }

  /** Blades still standing. */
  get standing(): Blade[] {
    return this.blades.filter((b) => b.planted && !b.gone);
  }

  // ---------------------------------------------------------------- the badge

  /** Where the badge floats: above the spell tile. */
  private badgeSpot(): XY {
    const t = this.tile();
    const h = t ? ip(t.home) : zoneXY(this.owner, 'spellTrap', this.zone);
    return { x: h.x, y: h.y - 22 };
  }

  private tile(): TileCard | null {
    return this.tileRef && this.tileRef.active ? this.tileRef : null;
  }

  /** The spell tile (the scene sets it when it has it; the badge falls back to the zone's floor point). */
  tileRef: TileCard | null = null;

  /** Show the badge with `n` lit pips (0 hides it). `pop`: it hops in. */
  setBadge(n: number, pop = false): void {
    if (this.dead) return;
    if (n <= 0) {
      this.badge?.destroy();
      this.badge = null;
      this.badgeN = 0;
      return;
    }
    const tex = motifTexture(this.scene, `dawn:badge:${n}`, badgeMotif(n));
    const at = this.badgeSpot();
    this.badgeY = at.y;
    if (!this.badge || !this.badge.active) {
      this.badge = this.scene.add.image(at.x, at.y, tex.key).setOrigin(tex.ax / tex.w, tex.ay / tex.h).setDepth(DEPTH.FX - 1);
      if (pop) this.popBadge();
    } else {
      this.badge.setTexture(tex.key).setPosition(at.x, this.badge.y);
    }
    this.badgeN = n;
  }

  get badgeCount(): number {
    return this.badgeN;
  }

  /** The badge hops 3 px up and settles (whole pixels, three steps). */
  private popBadge(): void {
    const b = this.badge;
    if (!b) return;
    const y0 = this.badgeY;
    b.setY(y0 + 4).setAlpha(0.5);
    void run(this.scene, DAWN.badgePop, (t) => {
      if (!b.active) return;
      b.setY(Math.round(lerp(y0 + 4, y0, E.outBack(t)) - Math.sin(t * Math.PI) * 3));
      b.setAlpha(t < 0.25 ? 0.6 : 1);
    });
  }

  // ---------------------------------------------------------------- planting

  /** One blade falls and plants (resolves on its plant frame). `mute`: no sounds (the caller scores it). */
  private async fall(b: Blade, o: { rng?: () => number } = {}): Promise<void> {
    const sc = this.scene;
    const rich = this.rich;
    b.img.setVisible(true).setDepth(DEPTH.FX + 1);
    if (rich) playV3('dawnDrop', { volume: 0.5, pitch: Math.pow(2, [0, 2, 4, 7, 9, 12][b.i % 6] / 12), pan: panAt(b.x) });
    else snd('whoosh', 0.35, 1.5 + b.i * 0.06);
    const sparks = new Sparks(sc, DEPTH.FX + 2, ADD);
    const H = DAWN.fallHeight;
    await run(sc, DAWN.fall, (t) => {
      const k = E.inQuad(t);
      const y = Math.round(b.y - H * (1 - k));
      b.img.setY(y);
      if (rich && t < 1) {
        // the falling light: a thin trail of gold behind the hilt
        sparks.add({ x: b.x, y: y - 30 - rr(0, 6), life: 110, ramp: [PAL.white, PAL.gold4, PAL.gold3], vy: -20, fade: 0.6 });
        if (rnd() < 0.6) sparks.add({ x: b.x + (rnd() < 0.5 ? -1 : 1), y: y - 18, life: 90, ramp: [PAL.gold4, PAL.gold2], fade: 0.6 });
      }
    });
    // the bite: 1 px into the floor, then settled
    b.img.setY(b.y + 1);
    b.planted = true;
    b.img.setDepth(unitDepth(b.y) + 0.5);
    if (rich) {
      playV3('dawnPlant', { volume: 0.55, pitch: 1 + (b.i % 3) * 0.06, pan: panAt(b.x) });
      bg(floorRing(sc, b.x, b.y, { r0: 2, r1: fs(15), ms: 220, ramp: GOLD_FX, depth: DEPTH.TILE_FX + 2 }));
      void lightFlash(sc, b.x, b.y - 8, PAL.gold4, fs(15), 240, { floorY: b.y, intensity: 0.55 });
      const n = fxCount(5);
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        sparks.add({ x: b.x + side * rr(1, 3), y: b.y - 1, vx: side * rr(14, 44), vy: -rr(18, 46), ay: 150, drag: 1.2, life: rr(240, 380), ramp: [PAL.gold4, PAL.gold3, PAL.gold2, PAL.gold1], tex: i === 0 ? TEX.plus : TEX.px1, fade: 0.5 });
      }
    } else {
      bg(floorRing(sc, b.x, b.y, { r0: 2, r1: 11, ms: 200, ramp: GOLD_FX, depth: DEPTH.TILE_FX + 2 }));
    }
    sparks.close();
    await wait(sc, 17);
    if (b.img.active) b.img.setY(b.y);
    if (rich) this.armBlade(b);
    void o;
  }

  /** The idle life of a planted blade (v3): a tip twinkle, a light pool, a glint that runs down now and then. */
  private armBlade(b: Blade): void {
    const sc = this.scene;
    if (!b.glint) b.glint = sc.add.image(b.x, b.y, TEX.px1).setDepth(DEPTH.FX).setVisible(false).setTintFill(PAL.white);
    if (!b.tipGlow) b.tipGlow = sc.add.image(b.x, b.y - 1, TEX.plus).setBlendMode(ADD).setTint(PAL.gold4).setDepth(DEPTH.FX);
    if (!b.pool) {
      b.pool = lightPool(sc, b.x, b.y - 14, { color: PAL.gold3, radius: fs(15), floorY: b.y, air: 0.3, airRadius: 9, intensity: 0, anim: 'breathe', fadeIn: 0 });
      b.pool.setIntensity(0.5, 260);
    }
    if (!this.stopIdle) this.startIdle();
  }

  private startIdle(): void {
    const sc = this.scene;
    this.motes = new Sparks(sc, DEPTH.FX + 2, ADD);
    let nextMote = 0;
    this.stopIdle = onFrame(sc, (_dt, el) => {
      if (this.dead) return false;
      for (const b of this.blades) {
        if (!b.planted || b.gone) continue;
        // tip twinkle: bright, dim, bright … every 5 frames
        b.tipGlow?.setAlpha(Math.floor(el / 90 + b.i) % 3 === 0 ? 0.45 : 0.95);
        // a glint runs down the white edge once every 1.7 s (240 ms, 7 steps), the blades out of step
        const ph = (el + b.i * 290) % 1700;
        if (b.glint) {
          if (ph < 238) {
            const row = Math.floor((ph / 238) * 24);
            b.glint.setVisible(true).setPosition(b.x - 2, b.y - 25 + row);
          } else b.glint.setVisible(false);
        }
      }
      if (el >= nextMote) {
        nextMote = el + 150 + rnd() * 120;
        const live = this.standing;
        if (live.length) {
          const b = live[Math.floor(rnd() * live.length) % live.length];
          this.motes?.add({ x: b.x + rr(-2, 2), y: b.y - rr(8, 28), vy: -rr(10, 20), life: rr(520, 820), ramp: [PAL.gold4, PAL.gold3, PAL.gold2, PAL.gold1], wobble: 6, wobbleHz: 1.2, fade: 0.4 });
        }
      }
      return true;
    });
  }

  /**
   * The six blades fall left → right and plant. Resolves when the last has planted. `onPlant(i)` fires on blade
   * i's plant frame.
   */
  async plant(o: { onPlant?: (i: number) => void } = {}): Promise<void> {
    this.busy++;
    try {
      const jobs = this.blades.map(async (b) => {
        await wait(this.scene, b.i * DAWN.stagger);
        if (this.dead) return;
        await this.fall(b);
        o.onPlant?.(b.i);
      });
      await Promise.all(jobs);
    } finally {
      this.busy--;
    }
  }

  /** Show the fence at once (a staged / restored board): the blades for counter `n` stand, the badge reads `n`. */
  restore(n: number): void {
    const keep = new Set(bladesShown(n));
    for (const b of this.blades) {
      if (!keep.has(b.i)) {
        b.gone = true;
        b.img.setVisible(false);
        continue;
      }
      b.img.setVisible(true).setY(b.y).setDepth(unitDepth(b.y) + 0.5).setAlpha(0);
      b.planted = true;
      if (this.rich) this.armBlade(b);
      void run(this.scene, 240, (t) => b.img.active && b.img.setAlpha(t < 0.4 ? 0.5 : 1));
    }
    this.setBadge(n);
  }

  // ---------------------------------------------------------------- leaving

  /** One blade erodes from its tip upward into rising light motes (v3), or fades (v1). */
  private async erode(b: Blade): Promise<void> {
    if (b.gone) return;
    b.gone = true;
    const sc = this.scene;
    b.tipGlow?.destroy();
    b.glint?.destroy();
    b.tipGlow = null;
    b.glint = null;
    if (b.pool) void b.pool.fadeOut(260);
    if (!this.rich) {
      await run(sc, 200, (t) => b.img.active && b.img.setAlpha(1 - t));
      b.img.destroy();
      return;
    }
    const img = b.img;
    const sparks = new Sparks(sc, DEPTH.FX + 2, ADD);
    // two white frames, then the erosion: the crop edge climbs from the tip, motes leave from the edge
    img.setTintFill(PAL.white);
    await wait(sc, 34);
    if (!img.active) return;
    img.clearTint();
    bg(floorRing(sc, b.x, b.y, { r0: 3, r1: fs(11), ms: 260, ramp: [PAL.gold4, PAL.gold3, PAL.gold2, PAL.gold1], depth: DEPTH.TILE_FX + 2 }));
    const H = BLADE_H;
    for (let s = 1; s <= DAWN.erodeSteps; s++) {
      if (!img.active) break;
      const keep = Math.max(0, Math.round(H * (1 - s / DAWN.erodeSteps)));
      img.setCrop(0, 0, BLADE_W, keep);
      const edgeY = b.y - (BLADE_AY - keep);
      const n = fxCount(3);
      for (let k = 0; k < n; k++) {
        sparks.add({ x: b.x + rr(-2, 2), y: edgeY + rr(-1, 1), vx: rr(-8, 8), vy: -rr(16, 40), life: rr(260, 420), ramp: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2], tex: k === 0 && s % 2 === 0 ? TEX.plus : TEX.px1, fade: 0.5, wobble: 5 });
      }
      await wait(sc, DAWN.erodeStep);
    }
    sparks.close();
    img.destroy();
  }

  /** The counter went from `from` to `from - 1` (or to 0): the outer pair dissolves, the badge loses a pip. */
  async tick(from: number): Promise<void> {
    this.busy++;
    try {
      const lost = bladesLost(from).map((i) => this.blades[i]);
      if (this.rich) {
        playV3(from <= 1 ? 'dawnFade' : 'dawnDissolve', { volume: 0.6, pan: panAt(lost[0].x) });
        if (from > 1) bg(wait(this.scene, 50).then(() => playV3('dawnDissolve', { volume: 0.45, pitch: 1.12, pan: panAt(lost[1].x) })));
      } else snd('holyChime', 0.4, 1.2);
      // the badge: the last lit pip flashes white for two frames, then goes dark (or the badge goes with the card)
      if (from > 1) {
        const b = this.badge;
        if (b && b.active) {
          const tex = motifTexture(this.scene, `dawn:badge:${from}`, badgeMotif(from));
          b.setTexture(tex.key);
          bg(wait(this.scene, 34).then(() => {
            if (!b.active) return;
            this.setBadge(from - 1);
            this.badgeBump();
          }));
        }
      } else {
        const b = this.badge;
        if (b && b.active) {
          bg(wait(this.scene, 34).then(() => this.setBadge(0)));
        }
      }
      await Promise.all(lost.map((b, k) => wait(this.scene, k * 20).then(() => this.erode(b))));
    } finally {
      this.busy--;
    }
  }

  private badgeBump(): void {
    const b = this.badge;
    if (!b || !b.active) return;
    const y0 = this.badgeY;
    void run(this.scene, 90, (t) => b.active && b.setY(y0 - Math.round(Math.sin(t * Math.PI) * 2)));
  }

  /** Destroyed early: every blade breaks at once into gold shards; the badge goes with them. */
  async shatter(): Promise<void> {
    this.busy++;
    try {
      const sc = this.scene;
      const live = this.standing;
      if (this.rich) playV3('dawnShatter', { volume: 0.7, pan: 0 });
      else snd('shatter', 0.5, 1.5);
      this.stopIdle?.();
      this.stopIdle = null;
      this.motes?.close();
      this.motes = null;
      const sparks = new Sparks(sc, DEPTH.FX + 2, ADD);
      for (const b of live) {
        b.gone = true;
        b.tipGlow?.destroy();
        b.glint?.destroy();
        b.tipGlow = null;
        b.glint = null;
        if (b.pool) void b.pool.fadeOut(200);
        b.img.setTintFill(PAL.white);
      }
      if (this.badge?.active) this.badge.setTintFill(PAL.white);
      await wait(sc, 34);
      for (const b of live) {
        const n = fxCount(this.rich ? 12 : 6);
        for (let k = 0; k < n; k++) {
          const a = rr(0, TAU);
          const sp = rr(40, 120);
          sparks.add({ x: b.x + rr(-2, 2), y: b.y - rr(2, 30), vx: Math.cos(a) * sp * 0.8, vy: Math.sin(a) * sp * 0.6 - 40, ay: 260, drag: 1.2, life: rr(300, 520), ramp: GOLD_FX, tex: k % 4 === 0 ? TEX.px2 : TEX.px1, trail: this.rich && k % 3 === 0 });
        }
        if (this.rich) bg(floorRing(sc, b.x, b.y, { r0: 3, r1: fs(13), ms: 240, ramp: GOLD_FX, depth: DEPTH.TILE_FX + 2 }));
        b.img.destroy();
      }
      if (this.badge?.active) {
        const bp = this.badge;
        for (let k = 0; k < fxCount(8); k++) sparks.add({ x: bp.x + rr(-8, 8), y: bp.y + rr(-4, 4), vx: rr(-40, 40), vy: -rr(10, 60), ay: 220, life: rr(260, 440), ramp: GOLD_FX });
        this.setBadge(0);
      }
      sparks.close();
      await wait(sc, 120);
    } finally {
      this.busy--;
    }
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.stopIdle?.();
    this.stopIdle = null;
    this.motes?.close();
    this.motes = null;
    for (const b of this.blades) {
      b.img.destroy();
      b.glint?.destroy();
      b.tipGlow?.destroy();
      b.pool?.destroy();
    }
    this.badge?.destroy();
    this.badge = null;
    const m = fences.get(this.scene);
    if (m?.get(this.uid) === this) m.delete(this.uid);
  }
}

// ================================================================ the reveal sweep (v3)

/**
 * The curtain of dawn light that sweeps over `target`'s field left → right (DAWN.sweepMs). `onReach(t)` is
 * called every frame with the progress. Resolves when it has crossed the board.
 */
export function revealSweep(sc: Phaser.Scene, target: PlayerId, o: { onReach?: (t: number) => void } = {}): Promise<void> {
  const mr = monsterRow(target);
  const br = backRow(target);
  const rA = Math.min(mr, br) - 0.5;
  const rB = Math.max(mr, br) + 0.5;
  // the raster covers the target's two rows and the curtain above them
  const corners = [isoToScreen(-0.6, rA), isoToScreen(BOARD_COLS - 0.4, rA), isoToScreen(-0.6, rB), isoToScreen(BOARD_COLS - 0.4, rB)];
  const x0 = Math.floor(Math.min(...corners.map((c) => c.x))) - 4;
  const x1 = Math.ceil(Math.max(...corners.map((c) => c.x))) + 4;
  const y0 = Math.floor(Math.min(...corners.map((c) => c.y))) - DAWN.curtain - 4;
  const y1 = Math.ceil(Math.max(...corners.map((c) => c.y))) + 6;
  const ras = new Raster(sc, x0, y0, x1 - x0, y1 - y0, DEPTH.FX, ADD);
  playV3('dawnSweep', { volume: 0.6, pan: 0 });
  const step = 1 / 32;
  const H = DAWN.curtain;
  const drawBand = (cc: number, lvl: number, white: boolean): void => {
    for (let r = rA; r <= rB; r += step) {
      const p = isoToScreen(cc, r);
      const x = Math.round(p.x);
      const fy = Math.round(p.y);
      for (let h = 0; h < H; h++) {
        const v = 1 - h / H;
        const level = lvl * v * v;
        if (level <= 0.04) continue;
        const col = white && h < 3 ? PAL.white : h < H * 0.35 ? PAL.gold4 : h < H * 0.7 ? PAL.gold3 : PAL.gold2;
        ras.dpx(x, fy - h, col, level);
      }
      ras.dpx(x, fy, white ? PAL.white : PAL.gold4, lvl);
    }
  };
  return run(sc, DAWN.sweepMs, (t) => {
    ras.draw(() => {
      const cc = sweepCol(t);
      drawBand(cc, 0.95, true);
      drawBand(cc - 0.22, 0.5, false);
      drawBand(cc - 0.46, 0.22, false);
    });
    o.onReach?.(t);
  }).then(() => ras.destroy());
}

// ================================================================ the activation

type ActEv = Extract<GameEvent, { type: 'activate' }>;
export type DawnActCtx = CinematicContext<ActEv>;

/** The events of a resolution that belong to this spell: its counter and its reveal flips. */
export function resolutionParts(ctx: AnyCtx, uid: Uid, run0: readonly number[]): { counter: number; flips: { i: number; zone: number }[] } {
  let counter = -1;
  const flips: { i: number; zone: number }[] = [];
  for (const i of run0) {
    const e = ctx.events[i];
    if (e.type === 'counter' && e.uid === uid && counter < 0) counter = i;
    else if (e.type === 'flip' && e.cause === 'reveal' && e.sourceUid === uid) flips.push({ i, zone: e.zone });
  }
  return { counter, flips };
}
