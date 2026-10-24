// v3 field auras — lane A5-A step A-3 (docs/v3/A5_PLAN.md §3.2 "Kalıcı alan durumu", §4.4).
// src/duel/auras.ts hands flameAura / steamAura over to these under V3_A5_A, so FieldView.sync,
// flow/stats.ts and _defaults/battle.ts build them without a change of their own (and a scene rebuilt
// by FieldView.sync looks the same as one that lived through the eruption).
//
//   flameAuraV3(scene, unit)   FIRE on Volkan Arenası: three flame tongues stand on the top edge of the
//                              silhouette (a 3-frame loop each, out of phase; the middle one behind the
//                              body), now and then an ember leaves a tongue tip and cools as it rises,
//                              and a faint firelight lies on the monster's pad (stepped light layer)
//   steamAuraV3(scene, unit)   WATER on Volkan Arenası: one 1-px steam thread every ~600 ms off the top
//                              edge (spellfx.steamEmitter: white → mist → steel, whole-pixel steps)
//
// Both read the sprite's CURRENT frame (spellfx.silhouetteOf: the v3 art, the old art and the relit
// P2 sheets alike), so they ride the idle bob, the lunge of an attack and the guard pose, and they hide
// with the sprite. destroy() plays their end: the tongues ignite in reverse (3 steps down to two smoke
// pixels, A5 §3.2 "Serinleme"), the steam stops (the threads in the air finish) — then every object is
// gone. Palette tones, whole pixels, no alpha; nothing touches the sprite itself (A5 §3.0, risk 6).

import type Phaser from 'phaser';
import { PAL } from '../art/palette';
import { paintFlameTongue } from '../art/spellmotifs-v3';
import { fxRng, silhouetteOf, steamEmitter } from '../cinematics/_v3/spellfx';
import { lightPool, type LightHandle } from '../view/light';
import { REDUCED_MOTION } from '../view/v3/motion';
import { Raster, onFrame } from '../vfx/setpieces';
import type { Disposable } from './types';
import type { MonsterUnit } from './MonsterUnit';

/** Where the three tongues stand along the silhouette's width, and which one burns behind the body. */
const TONGUES: readonly { at: number; behind: boolean; lift: number }[] = [
  { at: 0.26, behind: false, lift: 0 },
  { at: 0.52, behind: true, lift: -2 },
  { at: 0.77, behind: false, lift: 0 },
];
/** One tongue frame (the loop is 3 frames). */
const FRAME_MS = 100;
/** One ignite / cooling step. */
const STEP_MS = 90;
const EMBER = [PAL.fire4, PAL.fire3, PAL.fire2, PAL.stone1] as const;

type Unit = Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;

/** A unit's sprite is shown (an aura draws nothing while it is hidden / faded out). */
function shown(s: Unit): boolean {
  return s.active && s.visible && s.alpha > 0.3;
}

/** FIRE on the volcano field (see the header). */
export function flameAuraV3(scene: Phaser.Scene, unit: MonsterUnit): Disposable {
  const s = unit.sprite;
  const rnd = fxRng(unit.uid * 131 + 17);
  // two rasters around the top edge (moved every frame): in front of the body and behind it
  const W = Math.max(24, Math.round(s.width) + 16);
  const H = 30;
  const front = new Raster(scene, 0, 0, W, H, s.depth + 0.5);
  const back = new Raster(scene, 0, 0, W, H, s.depth - 0.5);
  let light: LightHandle | null = null;
  const embers: { x: number; y: number; born: number; life: number; drift: number }[] = [];
  let nextEmber = 260;
  // ignite: cooling steps 3 → 1 then the loop; dying (from destroy()): steps 1 → 3, then gone
  let coolAsked = false;
  let dying = -1;
  let killed = false;
  let stop: () => void = () => undefined;
  const kill = () => {
    if (killed) return;
    killed = true;
    stop();
    front.destroy();
    back.destroy();
    const l = light;
    light = null;
    if (l && l.alive) void l.fadeOut(220);
  };
  stop = onFrame(scene, (_dt, el) => {
    if (!s.active || unit.retired) {
      kill();
      return false;
    }
    if (coolAsked && dying < 0) dying = el;
    const sil = shown(s) ? silhouetteOf(s) : null;
    const step = dying >= 0 ? 1 + Math.floor((el - dying) / STEP_MS) : el < 3 * STEP_MS ? 3 - Math.floor(el / STEP_MS) : 0;
    if (dying >= 0 && step > 3) {
      kill();
      return false;
    }
    front.img.setDepth(s.depth + 0.5);
    back.img.setDepth(s.depth - 0.5);
    // the pad's firelight (faint; breathes) once the body is shown
    if (!light && sil && dying < 0) {
      const h = unit.home;
      light = lightPool(scene, h.x, h.y, { color: PAL.fire3, spill: PAL.fire1, radius: 15, floorY: h.y, intensity: 0.45, anim: 'breathe', fadeIn: 240 });
    }
    if (light && dying >= 0) {
      const l = light;
      light = null;
      if (l.alive) void l.fadeOut(240);
    }
    front.begin();
    back.begin();
    if (sil) {
      const top = sil.top;
      const ox = sil.left - 8;
      const oy = top - (H - 8);
      front.moveTo(ox, oy);
      back.moveTo(ox, oy);
      const tips: { x: number; y: number }[] = [];
      TONGUES.forEach((t, i) => {
        const x = Math.round(sil.left + t.at * (sil.right - sil.left - 1));
        const yTop = sil.topAt(x);
        if (yTop === null) return;
        // the tongue's bottom row overlaps the outline by one pixel: it burns ON the body
        const base = yTop + 1 - t.lift;
        const ras = t.behind ? back : front;
        const frame = Math.floor((el + i * 37) / FRAME_MS) + i;
        if (step > 0) paintFlameTongue(ras.pc, x - ras.x, base - ras.y, 0, { cool: step as 1 | 2 | 3 });
        else paintFlameTongue(ras.pc, x - ras.x, base - ras.y, frame);
        tips.push({ x, y: base - 7 });
      });
      // now and then an ember leaves a tongue tip and cools as it rises (6–12 px)
      if (step === 0 && el >= nextEmber && tips.length && !REDUCED_MOTION) {
        nextEmber = el + 260 + rnd() * 260;
        const tip = tips[Math.floor(rnd() * tips.length)];
        embers.push({ x: tip.x, y: tip.y, born: el, life: 360 + rnd() * 200, drift: rnd() < 0.5 ? -1 : 1 });
      }
      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i];
        const k = (el - e.born) / e.life;
        if (k >= 1) {
          embers.splice(i, 1);
          continue;
        }
        const y = Math.round(e.y - k * 12);
        const x = e.x + (k > 0.5 ? e.drift : 0);
        front.px(x, y, EMBER[Math.min(EMBER.length - 1, Math.floor(k * EMBER.length))]);
      }
    }
    front.end();
    back.end();
    return true;
  });
  return {
    destroy() {
      coolAsked = true;
    },
  };
}

/** WATER on the volcano field (see the header). */
export function steamAuraV3(scene: Phaser.Scene, unit: MonsterUnit): Disposable {
  const em = steamEmitter(scene, unit.sprite, { everyMs: 600, life: 560, seed: unit.uid * 97 + 5 });
  return {
    destroy() {
      em.stop(true);
    },
  };
}

// =================================================================================== Ejder Kılıcı
//
// Lane A5-A step A-2 (docs/v3/A5_PLAN.md §3.1 "Kalıcı durum" / "Kırılma"). src/duel/auras.ts hands
// equipAura over to equipAuraV3 under V3_A5_A, so FieldView.sync (a rebuilt scene) builds the same
// state the forge leaves behind; the forge itself (src/cinematics/spells/_blade_v3.ts) starts it on
// its bond frame with { bond: true }.
//
//   the sword   the A5-A motif (spellmotifs-v3 swordMotif, 'up', len 11: ≈ 9×21 px with its ink
//               outline, gold planes, the white edge on the screen's lit side) floats at the
//               monster's equip anchor (equipAnchor: the rest frame's back edge — the body box's top
//               left for P1, its mirror for P2 — just outside the body, behind it). It bobs 1 px
//               (400 ms period) and every ≈ 2 s a glint runs down its lit edge (IŞ-8: 1 px → cross →
//               1 px, three steps). The drawing is never mirrored (A5 §3.0 P2): the light stays top left.
//   the ring    a 1-px gold rune ring at the waist (the core's height, 2:1 like the floor): its back
//               arc behind the body, its front arc in front; dashes that creep round slowly. On the bond
//               frame it closes clockwise in three steps from the sword's side, bright, then settles
//               into the dashes (A5 §3.1 BAĞ).
//   the light   one faint gold tone at the monster's feet (the light layer: a stepped floor pool).
// destroy() is the break (A5 §3.1 "Kırılma"; also a bolt burning the aura off, a death, a sync that
// finds the blade gone): two frames of a white crack across the blade, then 6–8 whole-pixel gold
// shards fall to the floor and fade by palette steps (EF-7), the ring snaps open at the front and its
// halves drop away stepping down the ramp, the light goes out. Silent: the scene that breaks it scores
// the beat. Nothing here tints, scales or moves the sprite; palette tones, whole pixels, no alpha.

const GOLD_RAMP = [PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4] as const;
/** The aura sword's blade length (spellmotifs-v3 default: the ≈ 7×20 aura sword). */
export const AURA_SWORD_LEN = 11;
/** The sword's bob: one pixel up for half of this period. */
const BOB_MS = 400;
/** A glint every this many ms (± a per-unit phase), three steps of GLINT_STEP. */
const GLINT_EVERY = 2000;
const GLINT_STEP = 70;
/** The ring's bond: three closing steps (one rendered frame each at least), the bright hold, the settle steps. */
export const RING_CLOSE_STEP = 20;
const RING_HOLD = 60;
const RING_SETTLE_STEP = 60;
/** The break: frames of the white crack before the blade shatters; the ring's snap steps. */
export const BREAK_CRACK_FRAMES = 2;
const RING_SNAP_STEP = 60;

/** Where the equip sword floats, relative to the sprite's position (rest pose; whole pixels). */
export interface EquipAnchor {
  /** The sword's guard (the motif anchor) relative to sprite.x / sprite.y. */
  dx: number;
  dy: number;
  /** The waist ring's centre and radii, relative to sprite.x / sprite.y. */
  ringDx: number;
  ringDy: number;
  rx: number;
  ry: number;
  /** −1: the sword is on the screen's left of the body (P1), 1: on its right (P2). */
  side: -1 | 1;
}

const anchorCache = new Map<string, EquipAnchor>();

/**
 * The equip anchor (A5 §3.1 "kuşanma çapası") of a frame, in frame coordinates mapped to the sprite:
 * in the rest frame the sword's guard sits at 42 % of the body's height, its centre four pixels behind
 * the back edge of the rows it covers (frames face right: the back is the frame's left side; P2's
 * flipped sprite puts it on the screen's right). The waist ring is centred on the art's core.
 * Pure (exported for the tests).
 */
export function anchorFromFrame(
  f: { w: number; h: number; isOpaque(x: number, y: number): boolean; bounds(): { x: number; y: number; w: number; h: number } | null },
  art: { w: number; h: number; anchorX: number; anchorY: number; core: { x: number; y: number } },
  flip: boolean,
): EquipAnchor {
  const b = f.bounds() ?? { x: 0, y: 0, w: art.w, h: art.h };
  const guardFy = b.y + Math.round(b.h * 0.42);
  let backX = Infinity;
  for (let fy = guardFy - AURA_SWORD_LEN - 1; fy <= guardFy + 6; fy++) {
    if (fy < 0 || fy >= f.h) continue;
    for (let fx = 0; fx < f.w; fx++)
      if (f.isOpaque(fx, fy)) {
        backX = Math.min(backX, fx);
        break;
      }
  }
  if (!Number.isFinite(backX)) backX = b.x;
  const sx = flip ? -1 : 1;
  const rx = Math.max(10, Math.min(24, Math.round(b.w * 0.42) + 3));
  return {
    dx: sx * (backX - 4 - art.anchorX),
    dy: guardFy - art.anchorY,
    ringDx: sx * (Math.round(art.core.x) - art.anchorX),
    ringDy: Math.round(art.core.y) - art.anchorY,
    rx,
    ry: Math.max(4, Math.round(rx / 2)),
    side: flip ? 1 : -1,
  };
}

/** The equip anchor of a unit in its current rest pose (idle f0, or guard f0 in defense). */
export function equipAnchor(unit: MonsterUnit): EquipAnchor {
  const anim = unit.position === 'defense' ? 'guard' : 'idle';
  const flip = unit.player === 1;
  const key = `${unit.cardId}:${anim}:${flip ? 1 : 0}`;
  let r = anchorCache.get(key);
  if (!r) {
    r = anchorFromFrame(monsterFrame(unit.cardId, anim, 0), unit.art, flip);
    anchorCache.set(key, r);
  }
  return r;
}

/** The sword's guard in world space right now (sprite position + anchor; whole pixels). */
export function equipSwordAt(unit: MonsterUnit): XY {
  const an = equipAnchor(unit);
  return { x: Math.round(unit.sprite.x) + an.dx, y: Math.round(unit.sprite.y) + an.dy };
}

/** Pixels of a 2:1 ring, clockwise on screen (y down) from angle `start`, each pixel once. */
export function ringPixels(cx: number, cy: number, rx: number, ry: number, start = 0): XY[] {
  const n = Math.max(24, Math.round(Math.PI * (rx + ry) * 2));
  const out: XY[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < n; i++) {
    const t = start + (i / n) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(t) * rx);
    const y = Math.round(cy + Math.sin(t) * ry);
    const k = `${x},${y}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ x, y });
  }
  return out;
}

/** 7 gold shard sources off the sword drawn with its guard at (gx, gy) (its own pixels; white → gold4). */
export function swordShardPoints(gx: number, gy: number, seed = 1): { x: number; y: number; c: number }[] {
  const m = swordMotif({ len: AURA_SWORD_LEN });
  const pts: { x: number; y: number; c: number }[] = [];
  for (let y = 0; y < m.px.h; y++)
    for (let x = 0; x < m.px.w; x++) {
      const c = m.px.get(x, y);
      if (c === null || c === PAL.ink) continue;
      pts.push({ x: gx + x - m.ax, y: gy + y - m.ay, c: c === PAL.white ? PAL.gold4 : c });
    }
  const n = 7;
  const out: { x: number; y: number; c: number }[] = [];
  const stride = pts.length / n;
  for (let i = 0; i < n && pts.length; i++) out.push(pts[Math.min(pts.length - 1, Math.floor((i + ((seed * 0.37) % 1)) * stride))]);
  return out;
}

export interface EquipAuraOpts {
  /** Start on the forge's bond frame: the white rim on the sword, the ring closing (A5 §3.1 BAĞ). */
  bond?: boolean;
}

/** Ejder Kılıcı's persistent state (see the section header). */
export function equipAuraV3(scene: Phaser.Scene, unit: MonsterUnit, o: EquipAuraOpts = {}): Disposable {
  const s = unit.sprite;
  const glintPhase = (unit.uid * 577) % GLINT_EVERY;
  const sword = motifImage(scene, ...swordKey({ len: AURA_SWORD_LEN, rim: o.bond ? 'white' : 'ink' }), -100, -100, s.depth - 0.4).setVisible(false);
  const RW = 64;
  const RH = 40;
  const back = new Raster(scene, 0, 0, RW, RH, s.depth - 0.5);
  const front = new Raster(scene, 0, 0, RW, RH, s.depth + 0.5);
  let light: LightHandle | null = null;
  let killed = false;
  let el = 0;
  let frame = 0;
  // the break (destroy): the time it was asked, the crack frames shown, the snapped ring
  let breakAt = -1;
  let crackFrames = 0;
  let snapped: { pts: XY[]; side: number[]; cx: number; cy: number } | null = null;
  let shattered = false;
  // stepped timelines: at most one new step per rendered frame (SÜ-3)
  let ringShown = 0;
  let glintCycle = -1;
  let glintShown = -1;
  let stop: () => void = () => undefined;

  const kill = () => {
    if (killed) return;
    killed = true;
    stop();
    if (sword.active) sword.destroy();
    back.destroy();
    front.destroy();
    const l = light;
    light = null;
    if (l && l.alive) void l.fadeOut(200);
  };

  /** The sword's drawing for this frame (cached textures: rim / glint / crack variants). */
  const drawing = (): SwordOpts => {
    if (breakAt >= 0) return { len: AURA_SWORD_LEN, crack: true };
    if (o.bond && frame <= 1) return { len: AURA_SWORD_LEN, rim: 'white' };
    const g = (el + glintPhase) % GLINT_EVERY;
    const cycle = Math.floor((el + glintPhase) / GLINT_EVERY);
    if (el > 500 && g < GLINT_STEP * 3) {
      if (cycle !== glintCycle) {
        glintCycle = cycle;
        glintShown = -1;
      }
      glintShown = Math.min(Math.floor(g / GLINT_STEP), glintShown + 1);
      return glintShown === 1 ? { len: AURA_SWORD_LEN, glint: 0.5, glintCross: true } : { len: AURA_SWORD_LEN, glint: glintShown <= 0 ? 0.15 : 0.85 };
    }
    return { len: AURA_SWORD_LEN };
  };

  const draw = (): boolean => {
    const alive = s.active && !unit.retired;
    if (!alive && breakAt < 0) {
      kill();
      return false;
    }
    const shown = alive && s.visible && s.alpha > 0.3;
    const an = equipAnchor(unit);
    const sx = Math.round(s.x);
    const sy = Math.round(s.y);
    const bob = breakAt < 0 && Math.floor(el / (BOB_MS / 2)) % 2 === 1 ? -1 : 0;
    const gx = sx + an.dx;
    const gy = sy + an.dy + bob;
    const rcx = snapped ? snapped.cx : sx + an.ringDx;
    const rcy = snapped ? snapped.cy : sy + an.ringDy;
    if (s.active) {
      sword.setDepth(s.depth - 0.4);
      back.img.setDepth(s.depth - 0.5);
      front.img.setDepth(s.depth + 0.5);
    }
    back.moveTo(rcx - RW / 2, rcy - RH / 2);
    front.moveTo(rcx - RW / 2, rcy - RH / 2);
    back.begin();
    front.begin();
    if (breakAt >= 0) {
      // ---- the break: two frames of the crack, then the shards; the ring snaps and drops away
      if (!shattered) {
        if (!shown) {
          back.end();
          front.end();
          kill();
          return false;
        }
        setMotif(sword, ...swordKey(drawing()));
        sword.setPosition(gx, gy).setVisible(true);
        if (++crackFrames > BREAK_CRACK_FRAMES) {
          shattered = true;
          sword.setVisible(false);
          void shards(scene, { from: swordShardPoints(gx, gy, unit.uid), ramp: GOLD_RAMP, mode: 'fall', floor: Math.round(unit.home.y) + 2, restMs: 90, depth: (s.active ? s.depth : DEPTH.FX) + 1, seed: unit.uid * 31 + 9 });
          const l = light;
          light = null;
          if (l && l.alive) void l.fadeOut(240);
        }
      }
      if (!snapped) {
        const pts = ringPixels(rcx, rcy, an.rx, an.ry, Math.PI / 2);
        snapped = { pts, side: pts.map((q) => (q.x < rcx ? -1 : 1)), cx: rcx, cy: rcy };
      }
      const k = Math.floor((el - breakAt) / RING_SNAP_STEP);
      const tone = [PAL.gold3, PAL.gold2, PAL.gold1][k];
      if (tone !== undefined) {
        const sn = snapped;
        sn.pts.forEach((q, i) => {
          // a 3-px gap at the front centre; the halves slide apart and sink a pixel per step
          if (Math.abs(q.x - sn.cx) <= 1 && q.y > sn.cy) return;
          (q.y < sn.cy ? back : front).px(q.x + sn.side[i] * k, q.y + k, tone);
        });
      }
      back.end();
      front.end();
      if (shattered && tone === undefined) {
        kill();
        return false;
      }
      return true;
    }
    // ---- the living state
    if (!shown) {
      sword.setVisible(false);
      back.end();
      front.end();
      return true;
    }
    if (!light) {
      const h = unit.home;
      light = lightPool(scene, h.x, h.y, { color: PAL.gold3, spill: PAL.gold1, radius: 15, floorY: h.y, intensity: o.bond ? 0.9 : 0.4, anim: 'breathe', fadeIn: o.bond ? 0 : 200 });
      if (o.bond) light.setIntensity(0.4, 260);
    }
    setMotif(sword, ...swordKey(drawing()));
    sword.setPosition(gx, gy).setVisible(true);
    // the ring: on the bond frame it closes clockwise from the sword's side in three steps (bright),
    // holds, then settles into the dashes that creep round (one pixel every 150 ms)
    const pts = ringPixels(rcx, rcy, an.rx, an.ry, an.side < 0 ? Math.PI : 0);
    const closeMs = RING_CLOSE_STEP * 3;
    let solid = 0;
    let tone: number = PAL.gold3;
    if (o.bond && el < closeMs + RING_HOLD + RING_SETTLE_STEP * 2) {
      ringShown = Math.min(3, Math.floor(el / RING_CLOSE_STEP) + 1, ringShown + 1);
      solid = ringShown;
      tone = el < closeMs + RING_HOLD ? PAL.gold4 : el < closeMs + RING_HOLD + RING_SETTLE_STEP ? PAL.gold3 : PAL.gold2;
    }
    if (solid > 0) {
      const n = Math.ceil((pts.length * solid) / 3);
      for (let i = 0; i < n; i++) {
        const q = pts[i];
        (q.y < rcy ? back : front).px(q.x, q.y, i === n - 1 && solid < 3 ? PAL.white : tone);
      }
    } else {
      const creep = Math.floor(el / 150);
      pts.forEach((q, i) => {
        const d = (i + creep) % 5;
        if (d >= 3) return;
        // rune dashes with a lit head; the back arc one tone darker than the front (it is in shadow)
        const c = d === 0 ? PAL.gold3 : q.y < rcy ? PAL.gold1 : PAL.gold2;
        (q.y < rcy ? back : front).px(q.x, q.y, c);
      });
    }
    back.end();
    front.end();
    return true;
  };

  // drawn on the frame it is made (the bond frame shows the sword already in place)
  draw();
  stop = onFrame(scene, (dt, e) => {
    if (killed) return false;
    el = e;
    if (dt > 0) frame++;
    return draw();
  });
  return {
    destroy() {
      if (breakAt >= 0 || killed) return;
      breakAt = el;
    },
  };
}
