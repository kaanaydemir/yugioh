// Persistent per-monster auras (MonsterUnit aura slots):
//   'equip'   — Ejder Kılıcı gold aura (setpieces.goldAura; swordForge returns the same kind)
//   'volcano' — Volkan Arenası: FIRE monsters burn (+500), WATER monsters steam (−300)
// Every aura follows its sprite, hides with it, fades in/out and self-destructs on destroy().

import type Phaser from 'phaser';
import { PAL } from '../art/palette';
import { DEPTH, unitDepth } from '../view/layout';
import { TEX } from '../vfx/core';
import { Raster, Sparks, goldAura, onFrame, rnd, rr, spriteBox } from '../vfx/setpieces';
import type { Disposable } from './types';
import type { MonsterUnit } from './MonsterUnit';

export function equipAura(scene: Phaser.Scene, unit: MonsterUnit): Disposable {
  return goldAura(scene, unit.sprite);
}

/** Flames licking up the silhouette + hot floor glow (FIRE on the volcano field). */
export function flameAura(scene: Phaser.Scene, unit: MonsterUnit): Disposable {
  return silhouetteAura(scene, unit, {
    every: 70,
    make: (x, y, right) => ({
      x,
      y,
      vx: (right ? 1 : -1) * rr(2, 9),
      vy: rr(-48, -26),
      wobble: 10,
      life: rr(360, 620),
      ramp: [PAL.gold4, PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1],
      tex: rnd() < 0.2 ? TEX.px2 : TEX.px1,
      flicker: rnd() < 0.3,
    }),
    ring: [PAL.fire3, PAL.fire1],
  });
}

/** Steam wisps rising off the body (WATER on the volcano field). */
export function steamAura(scene: Phaser.Scene, unit: MonsterUnit): Disposable {
  return silhouetteAura(scene, unit, {
    every: 120,
    make: (x, y, right) => ({
      x,
      y,
      vx: (right ? 1 : -1) * rr(1, 5),
      vy: rr(-22, -12),
      wobble: 7,
      life: rr(600, 1000),
      ramp: [PAL.white, PAL.mist, PAL.steel, PAL.night4],
      tex: rnd() < 0.4 ? TEX.px2 : TEX.px1,
    }),
    ring: null,
  });
}

interface AuraSpec {
  every: number;
  make: (x: number, y: number, right: boolean) => Parameters<Sparks['add']>[0];
  ring: [number, number] | null;
}

function silhouetteAura(scene: Phaser.Scene, unit: MonsterUnit, spec: AuraSpec): Disposable {
  const s = unit.sprite;
  const front = new Sparks(scene, unitDepth(s.y) + 1);
  const behind = new Sparks(scene, unitDepth(s.y) - 1);
  const h0 = unit.home;
  const ring = spec.ring ? Raster.around(scene, h0.x, h0.y, 60, 32, DEPTH.SHADOW - 1) : null;
  let level = 0;
  let dying = false;
  let acc = 0;
  let killed = false;
  let stop: () => void = () => undefined;
  const kill = () => {
    if (killed) return;
    killed = true;
    stop();
    ring?.destroy();
    front.close();
    behind.close();
  };
  stop = onFrame(scene, (dt, el) => {
    if (!s.active || unit.retired) {
      kill();
      return false;
    }
    level = dying ? Math.max(0, level - dt / 300) : Math.min(1, level + dt / 500);
    const vis = s.visible && s.alpha > 0.3;
    front.depth = unitDepth(unit.home.y) + 1;
    behind.depth = unitDepth(unit.home.y) - 1;
    if (ring && spec.ring) {
      const R = spec.ring;
      const h = unit.home;
      ring.moveTo(Math.round(h.x - 30), Math.round(h.y - 16));
      ring.draw((g) => {
        if (!vis || level <= 0.02) return;
        const pulse = 0.5 + 0.5 * Math.sin(el * 0.008);
        const rx = 15 + pulse * 2;
        g.ring(h.x, h.y, rx, rx / 2, R[0], level * (0.45 + 0.4 * pulse));
        g.ring(h.x, h.y, rx + 3, rx / 2 + 1.5, R[1], level * 0.4);
      });
    }
    acc += dt;
    if (vis && !dying) {
      const b = spriteBox(scene, s);
      while (acc > spec.every) {
        acc -= spec.every;
        const yy = b.bottom - 2 - rnd() * b.h * 0.75;
        const sp = b.spanAt(yy);
        if (!sp) continue;
        const right = rnd() < 0.5;
        const xx = right ? sp[1] + rr(-2, 1) : sp[0] + rr(-1, 2);
        (rnd() < 0.6 ? front : behind).add(spec.make(xx, yy, right));
      }
    } else acc = 0;
    if (dying && level <= 0) {
      kill();
      return false;
    }
    return true;
  });
  return {
    destroy() {
      dying = true;
    },
  };
}
