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
