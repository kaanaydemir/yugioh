// A faster cut of the library's healingFountain (src/vfx/setpieces.ts) for Şifa Pınarı: same
// look (ripples → teal geyser → droplets arcing into the LP panel), tighter beats so the whole
// spell fits its time budget: eruption at +150 ms (onErupt), droplets launch at +340 ms and
// reach the panel ~0.37–0.44 s later (onArrive on the first one).

import type Phaser from 'phaser';
import type { PlayerId } from '../../engine/types';
import { PAL } from '../../art/palette';
import { sfx, type SfxName } from '../../audio/sfx';
import { DEPTH, type XY, unitDepth } from '../../view/layout';
import { TEX, shake } from '../../vfx/core';
import { E, Raster, Sparks, floorRing, lerp, onFrame, panelGlow, qbez, rnd, rr, run, sleep } from '../../vfx/setpieces';

const TAU = Math.PI * 2;
const WATER_RAMP = [PAL.white, PAL.teal4, PAL.teal3, PAL.teal2, PAL.teal1];

function snd(name: SfxName, volume = 1, pitch = 1): void {
  try {
    sfx.play(name, { volume, pitch });
  } catch {
    /* audio never breaks a cinematic */
  }
}

/** Ripples, eruption, droplets into the panel. Resolves when the last droplet has landed. */
export async function quickFountain(scene: Phaser.Scene, player: PlayerId, toXY: XY, opts: { at: XY; onArrive?: () => void; onErupt?: () => void }): Promise<void> {
  const base = opts.at;
  const x = Math.round(base.x);
  const y = Math.round(base.y);
  const H = 82;
  const geyser = new Raster(scene, x - 40, y - H - 20, 80, H + 40, unitDepth(y) + 2);
  const floor = Raster.around(scene, x, y, 120, 60, DEPTH.SHADOW - 1);
  const spray = new Sparks(scene, unitDepth(y) + 3);
  const trail = new Sparks(scene, DEPTH.HUD + 6);
  const orbs = new Sparks(scene, DEPTH.HUD + 7);
  let height = 0;
  let width = 0;
  let collapse = 0;
  let ripple = 0;
  const rings: number[] = [];

  const stopDraw = onFrame(scene, (_dt, el) => {
    floor.draw((g) => {
      // pool + concentric ripples
      if (ripple > 0) {
        g.ell(x, y, 30 * ripple, 15 * ripple, PAL.teal1, 0.45 * ripple);
        g.ell(x, y, 24 * ripple, 12 * ripple, PAL.teal2, 0.35 * ripple);
        g.ring(x, y, 30 * ripple, 15 * ripple, PAL.teal3, ripple);
      }
      for (const born of rings) {
        const t = (el - born) / 700;
        if (t < 0 || t > 1) continue;
        const r = 6 + E.outCubic(t) * 46;
        g.ring(x, y, r, r / 2, t < 0.3 ? PAL.teal4 : t < 0.6 ? PAL.teal3 : PAL.teal2, 1 - t * t);
      }
    });
    geyser.draw((g) => {
      if (height < 1) return;
      const top = y - height * (1 - collapse);
      const reach = 26 * Math.min(1, height / H) * (1 - collapse * 0.5);
      // water curtains: parabolic sheets falling from the crown to a ring on the floor
      const curtain = (ang: number) => {
        const ex = x + Math.cos(ang) * reach;
        const ey = y + Math.sin(ang) * reach * 0.5;
        const n = 26;
        let px0 = NaN;
        let py0 = NaN;
        for (let i = 0; i <= n; i++) {
          const u = i / n;
          const px = lerp(x, ex, Math.sqrt(u));
          const py = lerp(top + 2, ey, u * u) - Math.sin(Math.PI * u) * 6;
          const flow = (u * 6 - el * 0.004 + ang) % 1;
          const c = flow < 0.18 ? PAL.white : flow < 0.6 ? PAL.teal4 : PAL.teal3;
          if (!isNaN(px0)) g.line(px0, py0, px, py, c, u > 0.85 ? 0.6 : 1);
          px0 = px;
          py0 = py;
        }
      };
      const ANG = 9;
      for (let i = 0; i < ANG; i++) {
        const ang = (i / ANG) * TAU + 0.2;
        if (Math.sin(ang) < 0) curtain(ang);
      }
      // the jet: narrow bright core, rushing streaks scroll upward
      for (let yy = Math.floor(top); yy <= y; yy++) {
        const v = (yy - top) / Math.max(1, y - top); // 0 crown → 1 base
        const hw = width * (0.45 + v * 0.35);
        const wob = Math.sin(yy * 0.35 + el * 0.03) * 0.9;
        const l = Math.round(x + wob - hw);
        const r = Math.round(x + wob + hw);
        for (let xx = l; xx <= r; xx++) {
          const u = (xx - l) / Math.max(1, r - l);
          let c: number;
          if (xx === l || xx === r) c = PAL.teal2;
          else if (u < 0.4) c = PAL.white;
          else c = PAL.teal4;
          const streak = (yy + el * 0.26 + Math.floor(u * 4) * 7) % 9;
          if (streak < 2 && xx !== l && xx !== r) c = u < 0.5 ? PAL.teal4 : PAL.teal3;
          g.px(xx, yy, c);
        }
      }
      for (let i = 0; i < ANG; i++) {
        const ang = (i / ANG) * TAU + 0.2;
        if (Math.sin(ang) >= 0) curtain(ang);
      }
      // crown of foam: churning blobs
      if (collapse < 0.7) {
        const k = 1 - collapse / 0.7;
        for (let i = 0; i < 5; i++) {
          const a = el * 0.013 + i * 1.26;
          const rr0 = (2.5 + (i % 2)) * k;
          g.disc(x + Math.cos(a) * 4 * k, top + Math.sin(a) * 1.8 * k, rr0 + 1, PAL.teal3);
        }
        for (let i = 0; i < 5; i++) {
          const a = el * 0.013 + i * 1.26;
          g.disc(x + Math.cos(a) * 4 * k - 0.5, top - 0.5 + Math.sin(a) * 1.8 * k, (2 + (i % 2)) * k, i % 2 ? PAL.white : PAL.teal4);
        }
      }
      // churning foam where the curtains land + at the base
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + el * 0.002;
        const rr0 = reach * (0.9 + 0.15 * Math.sin(el * 0.02 + i * 2.1));
        const fx = x + Math.cos(a) * rr0;
        const fy = y + Math.sin(a) * rr0 * 0.5;
        g.disc(fx, fy - 1, 1.6, Math.sin(el * 0.03 + i) > 0 ? PAL.white : PAL.teal4, Math.sin(a) >= 0 ? 1 : 0.7);
      }
      g.ell(x, y - 1, width * 1.6, width * 0.7, PAL.teal4, 1);
      g.ell(x - 1, y - 2, width * 0.9, width * 0.4, PAL.white, 1);
    });
  });

  // ---- 0–220: the ground trembles, ripples open
  rings.push(0, 120, 240);
  void run(scene, 150, (t) => (ripple = E.outQuad(t)));
  spray.burst(10, (i) => ({ x: x + rr(-8, 8), y: y - 1, vx: rr(-20, 20), vy: rr(-90, -40), ay: 360, life: rr(300, 450), ramp: WATER_RAMP, delay: i * 18 }));
  await sleep(scene, 150);
  opts.onErupt?.();

  // ---- 220: eruption
  snd('waterSplash', 0.9, 1.1);
  void shake(scene, 160, 1);
  rings.push(260, 420);
  void floorRing(scene, x, y, { r0: 6, r1: 56, ms: 420, ramp: [PAL.white, PAL.teal4, PAL.teal3, PAL.teal2], depth: DEPTH.SHADOW - 1 });
  void run(scene, 300, (t) => {
    height = H * E.outBack(t);
    width = 4 + 2 * E.outCubic(t);
  });
  // spray off the crown for the whole column life
  const sprayStop = onFrame(scene, (dt, el) => {
    if (collapse > 0.5) return false;
    const n = dt > 0 ? 3 : 0;
    for (let i = 0; i < n; i++) {
      const top = y - height * (1 - collapse);
      const a = rr(0, TAU);
      const sp = rr(30, 80);
      spray.add({ x: x + rr(-3, 3), y: top + rr(-2, 3), vx: Math.cos(a) * sp, vy: rr(-80, -25) + Math.sin(a) * 10, ay: 380, life: rr(420, 700), ramp: WATER_RAMP, tex: rnd() < 0.35 ? TEX.px2 : TEX.px1, trail: rnd() < 0.4 });
    }
    if (dt > 0 && rnd() < 0.5) {
      const a = rr(0, TAU);
      spray.add({ x: x + Math.cos(a) * 26, y: y + Math.sin(a) * 13, vx: Math.cos(a) * 20, vy: rr(-50, -20), ay: 300, life: rr(200, 360), ramp: WATER_RAMP });
    }
    return el < 2000;
  });
  await sleep(scene, 190);

  // ---- 500: droplets launch toward the LP panel
  const N = 14;
  let landed = 0;
  let first = true;
  const done = new Promise<void>((resolve) => {
    for (let i = 0; i < N; i++) {
      void (async () => {
        await sleep(scene, i * 22);
        const from = { x: x + rr(-5, 5), y: y - height + rr(0, 8) };
        const side = toXY.x < from.x ? -1 : 1;
        const ctrl = { x: lerp(from.x, toXY.x, 0.35) + rr(-30, 30) * side, y: Math.min(from.y, toXY.y) - rr(50, 90) };
        const dest = { x: toXY.x + rr(-14, 14), y: toXY.y + rr(-6, 6) };
        const head = scene.add.image(from.x, from.y, TEX.dot5).setTint(PAL.teal2).setDepth(DEPTH.HUD + 8);
        const core = scene.add.image(from.x, from.y, TEX.px3).setTint(PAL.teal4).setDepth(DEPTH.HUD + 9);
        const spec = scene.add.image(from.x, from.y, TEX.px1).setTint(PAL.white).setDepth(DEPTH.HUD + 9.5);
        const dur = rr(360, 440);
        await run(scene, dur, (t) => {
          const k = E.inOutSine(t);
          const p = qbez(from, ctrl, dest, k);
          head.setPosition(Math.round(p.x), Math.round(p.y));
          core.setPosition(Math.round(p.x), Math.round(p.y));
          spec.setPosition(Math.round(p.x) - 1, Math.round(p.y) - 1);
          if (rnd() < 0.7) trail.add({ x: p.x + rr(-2, 2), y: p.y + rr(-2, 2), vy: rr(-12, 4), life: rr(200, 360), ramp: [PAL.white, PAL.gold4, PAL.leaf3, PAL.leaf2], flicker: true });
        });
        head.destroy();
        core.destroy();
        spec.destroy();
        orbs.burst(7, (k) => {
          const a = (k / 7) * TAU;
          return { x: dest.x, y: dest.y, vx: Math.cos(a) * 55, vy: Math.sin(a) * 55, drag: 5, life: 280, ramp: [PAL.white, PAL.leaf4, PAL.leaf3, PAL.gold3], tex: k % 2 ? TEX.plus : TEX.px1 };
        });
        snd('heal', 0.35, 1 + i * 0.05);
        if (first) {
          first = false;
          opts.onArrive?.();
          void panelGlow(scene, player, [PAL.white, PAL.teal4, PAL.leaf3, PAL.teal2]);
        }
        if (++landed === N) resolve();
      })();
    }
  });

  // ---- 700–1150: the column collapses back into the pool
  await sleep(scene, 300);
  await run(scene, 360, (t) => (collapse = E.inQuad(t)));
  height = 0;
  sprayStop();
  void run(scene, 500, (t) => (ripple = 1 - t));
  await done;
  void sleep(scene, 600).then(() => {
    stopDraw();
    geyser.destroy();
    floor.destroy();
    spray.close();
    trail.close();
    orbs.close();
  });
}
