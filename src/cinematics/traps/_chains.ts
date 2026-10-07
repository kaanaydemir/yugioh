// Light chains for Işık Zincirleri: slim golden chains of light (small 1-px links, magenta halo)
// that shoot from the trap card, coil around a monster in depth (back half behind the sprite,
// front half in front), lock with a padlock clank and haul it home. Adapted from the idea of
// setpieces.chainsBind, redrawn at a finer scale so the monster stays readable inside its chains.
// No registrations here.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, GAME_H, GAME_W, type XY, unitDepth } from '../../view/layout';
import { shake } from '../../vfx/core';
import { stopTime, whiteFlash } from '../../vfx/combat';
import { E, Raster, Sparks, floorRing, onFrame, qbez, run, spriteBox } from '../../vfx/setpieces';
import { ADD, TAU, clamp01, lerp, rnd, rr } from '../battle/_kit';

const GOLD = [PAL.gold2, PAL.gold3, PAL.gold4, PAL.white] as const;

/** Links along a polyline (spacing 3 px), up to `len` px; returns the last link point. */
function drawLinks(g: Raster, pts: readonly XY[], len: number, glow: number, phase: number, hot = 0): XY {
  let acc = 0;
  let next = 0;
  let idx = 0;
  let end = pts[0];
  const links: { x: number; y: number; ux: number; uy: number; face: boolean; lit: boolean }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const sl = Math.hypot(b.x - a.x, b.y - a.y);
    if (sl < 0.01) continue;
    const ux = (b.x - a.x) / sl;
    const uy = (b.y - a.y) / sl;
    while (next <= acc + sl && next <= len) {
      const t = (next - acc) / sl;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      links.push({ x, y, ux, uy, face: idx % 2 === 0, lit: (idx + phase) % 6 === 0 });
      end = { x, y };
      idx++;
      next += 3;
    }
    acc += sl;
    if (next > len) break;
  }
  // magenta halo (dithered) under the links
  if (glow > 0.05) for (const l of links) if (l.face) g.disc(l.x, l.y, 2.4, PAL.mag2, 0.3 * glow);
  for (const l of links) {
    const nx = -l.uy;
    const ny = l.ux;
    const bright = l.lit || hot > 0.5;
    if (l.face) {
      // an oval link seen face-on: 4 px ring around the centre
      g.px(l.x + l.ux * 1.4, l.y + l.uy * 1.4, bright ? PAL.white : GOLD[2]);
      g.px(l.x - l.ux * 1.4, l.y - l.uy * 1.4, bright ? PAL.gold4 : GOLD[1]);
      g.px(l.x + nx * 0.9, l.y + ny * 0.9, GOLD[1]);
      g.px(l.x - nx * 0.9, l.y - ny * 0.9, bright ? PAL.gold4 : GOLD[2]);
    } else {
      // edge-on link: a short bar
      g.px(l.x, l.y, bright ? PAL.white : GOLD[1]);
      g.px(l.x + l.ux * 0.7, l.y + l.uy * 0.7, GOLD[0]);
    }
  }
  return end;
}

export interface LightChainOpts {
  /** The monster's resting sprite position; the chains haul it back there. */
  home: XY;
  /** Called on the lock clank (padlock, hit-stop). */
  onLock?: () => void;
  /** Number of strands (default 3). */
  strands?: number;
}

/**
 * ~0.95 s main beat: 0–260 the strands shoot (the target keeps moving — they track it), 260–440
 * they coil around it, 440 lock (white flash, padlock, 60 ms hit-stop, sparks), 500–860 haul home
 * (overshoot), then the taut chains glow and dissolve into light on their own.
 */
export async function lightChains(scene: Phaser.Scene, from: XY, unit: MonsterUnit, o: LightChainOpts): Promise<void> {
  const s = unit.sprite;
  const n = o.strands ?? 3;
  const flip = s.flipX ? -1 : 1;
  // the side of the body that faces the card: the strands meet their coils there
  const side = Math.sign(from.x - s.x) || flip;
  const box0 = spriteBox(scene, s);
  const fy = (f: number) => box0.bottom - s.y - box0.h * f; // offset from the sprite origin
  const rel = [0.28, 0.52, 0.76].slice(0, n).map((f) => {
    const wy = box0.bottom - box0.h * f;
    return { dy: fy(f), hw: Math.max(7, Math.round(box0.halfAt(wy) + 2)), dx: (box0.cx - s.x) * 1 };
  });
  const origins = rel.map((_, i) => ({ x: Math.round(from.x + (i - (n - 1) / 2) * 5), y: Math.round(from.y + (i - (n - 1) / 2) * 4) }));
  const bend = [-0.7, 0.2, 0.75];
  const fly = new Raster(scene, 0, 0, GAME_W, GAME_H, DEPTH.FX + 3);
  const backR = Raster.around(scene, s.x, s.y, 120, 140, unitDepth(unit.home.y) - 1);
  const frontR = Raster.around(scene, s.x, s.y, 120, 140, unitDepth(unit.home.y) + 1);
  const sparks = new Sparks(scene, DEPTH.FX + 5);
  const motes = new Sparks(scene, DEPTH.FX + 4, ADD);
  let shoot = rel.map(() => 0);
  let wrap = rel.map(() => 0);
  let straight = 0;
  let locked = 0;
  let dissolve = 0;
  let glow = 1;
  let phase = 0;

  const ringCenter = (i: number): XY => ({ x: s.x + rel[i].dx, y: s.y + rel[i].dy });
  /** Where strand i meets its coil: the side of the body that faces the card. */
  const anchor = (i: number): XY => {
    const c = ringCenter(i);
    return { x: c.x + side * rel[i].hw, y: c.y };
  };
  const strandPts = (i: number): XY[] => {
    const a = origins[i];
    const b = anchor(i);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const off = (1 - straight) * 30 * bend[i % 3];
    const ctrl = { x: (a.x + b.x) / 2 - (dy / l) * off, y: (a.y + b.y) / 2 + (dx / l) * off - (1 - straight) * 22 };
    const pts: XY[] = [];
    for (let k = 0; k <= 28; k++) pts.push(qbez(a, ctrl, b, k / 28));
    return pts;
  };
  const pathLen = (pts: XY[]) => {
    let L = 0;
    for (let k = 1; k < pts.length; k++) L += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
    return L;
  };
  const draw = () => {
    fly.draw((g) => {
      for (let i = 0; i < rel.length; i++) {
        if (shoot[i] <= 0) continue;
        const pts = strandPts(i);
        const L = pathLen(pts);
        const startL = L * dissolve;
        const shown = L * shoot[i];
        if (startL >= shown) continue;
        let acc = 0;
        const tail: XY[] = [];
        for (let k = 0; k < pts.length; k++) {
          if (k > 0) acc += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
          if (acc >= startL) tail.push(pts[k]);
        }
        const head = drawLinks(g, tail, shown - startL, glow, phase + i * 2, locked);
        if (shoot[i] < 1) {
          g.disc(head.x, head.y, 2.2, PAL.mag4);
          g.px(head.x, head.y, PAL.white);
        }
      }
    });
    for (const [r, front] of [
      [backR, false],
      [frontR, true],
    ] as const) {
      r.moveTo(Math.round(s.x - 60), Math.round(s.y - 100));
      r.draw((g) => {
        if (dissolve >= 1) return;
        for (let i = 0; i < rel.length; i++) {
          if (wrap[i] <= 0) continue;
          const c = ringCenter(i);
          const rx = rel[i].hw;
          const ry = 3;
          const a0 = side > 0 ? 0 : Math.PI; // start at the anchor
          const N = 36;
          const seg: XY[] = [];
          const flush = () => {
            if (seg.length > 1) drawLinks(g, seg, 999, glow * (front ? 1 : 0.6), phase + i, locked);
            seg.length = 0;
          };
          for (let k = 0; k <= N * wrap[i]; k++) {
            const an = a0 + side * (k / N) * TAU * 1.15;
            const p = { x: c.x + Math.cos(an) * rx, y: c.y + Math.sin(an) * ry };
            if (Math.sin(an) >= 0 === front) seg.push(p);
            else flush();
          }
          flush();
          // padlock on the front of the middle coil
          if (front && locked > 0 && i === Math.floor(rel.length / 2)) {
            const lx = Math.round(c.x);
            const ly = Math.round(c.y + ry + 1);
            const pop = locked > 0.7;
            g.rect(lx - 3, ly - 1, 7, 6, PAL.ink);
            g.ring(lx + 0.5, ly - 1.5, 2.6, 2.8, PAL.ink, 1, Math.PI, TAU);
            g.ring(lx + 0.5, ly - 1.5, 1.8, 2, pop ? PAL.white : PAL.mag4, 1, Math.PI, TAU);
            g.rect(lx - 2, ly, 5, 4, pop ? PAL.white : PAL.mag3);
            g.rect(lx - 2, ly + 3, 5, 1, pop ? PAL.mag4 : PAL.mag2);
            g.px(lx, ly + 1, PAL.mag1);
          }
        }
      });
    }
  };
  const stopDraw = onFrame(scene, (_dt, el) => {
    phase = Math.floor(el / 55);
    draw();
  });

  // ---- 0–230 shoot (tracking the moving target)
  await run(scene, 230, (_t, el) => {
    shoot = rel.map((_, i) => E.outCubic(clamp01((el - i * 35) / 170)));
    if (rnd() < 0.7) sparks.add({ x: from.x + rr(-4, 4), y: from.y + rr(-4, 4), vx: rr(-30, 30), vy: rr(-50, -10), life: 240, ramp: [PAL.white, PAL.mag4, PAL.mag3, PAL.mag2], tex: 'fx:px1' });
  });
  shoot = rel.map(() => 1);
  // ---- 260–440 coil around it
  await run(scene, 160, (t, el) => {
    wrap = rel.map((_, i) => E.outCubic(clamp01((el - i * 22) / 120)));
    straight = E.outQuad(t) * 0.5;
  });
  wrap = rel.map(() => 1);
  // ---- lock: clank
  locked = 1;
  o.onLock?.();
  void whiteFlash(scene, s, 2);
  for (let i = 0; i < rel.length; i++) {
    const c = ringCenter(i);
    sparks.burst(7, () => ({ x: c.x + rr(-rel[i].hw, rel[i].hw), y: c.y + 3, vx: rr(-80, 80), vy: rr(-70, 0), ay: 300, drag: 2, life: rr(200, 360), ramp: [PAL.white, PAL.gold4, PAL.gold3, PAL.mag3], trail: true, tex: 'fx:px1' }));
  }
  void shake(scene, 150, 2);
  await stopTime(scene, 60);
  // ---- haul home (overshoot)
  const p0 = { x: s.x, y: s.y };
  await run(scene, 360, (t) => {
    locked = t < 0.4 ? 1 : 0.6;
    straight = 0.5 + 0.5 * E.outQuad(t);
    if (!s.active) return;
    const k = E.outBack(t);
    s.setPosition(Math.round(lerp(p0.x, o.home.x, k)), Math.round(lerp(p0.y, o.home.y, k)));
    if (rnd() < 0.5) {
      const i = Math.floor(rnd() * rel.length);
      const pts = strandPts(i);
      const p = pts[Math.floor(rnd() * pts.length)];
      motes.add({ x: p.x, y: p.y, vy: rr(-30, -10), life: rr(200, 340), ramp: [PAL.gold4, PAL.mag3, PAL.mag2], tex: 'fx:px1' });
    }
  });
  if (s.active) s.setPosition(o.home.x, o.home.y);
  void floorRing(scene, unit.home.x, unit.home.y, { r0: 8, r1: 40, ms: 360, ramp: [PAL.gold4, PAL.mag4, PAL.mag3, PAL.mag2], depth: DEPTH.SHADOW - 1 });
  // ---- the chains stay taut a moment, then burst into light (background)
  void (async () => {
    await run(scene, 260, () => undefined);
    await run(scene, 380, (t) => {
      dissolve = E.inQuad(t);
      glow = 1 - t;
      if (rnd() < 0.9) {
        const i = Math.floor(rnd() * rel.length);
        const pts = strandPts(i);
        const p = pts[Math.min(pts.length - 1, Math.floor(dissolve * (pts.length - 1)))];
        motes.add({ x: p.x + rr(-2, 2), y: p.y + rr(-2, 2), vy: rr(-40, -15), life: rr(240, 420), ramp: [PAL.white, PAL.gold4, PAL.mag3], tex: 'fx:px1' });
      }
    });
    wrap = rel.map(() => 0);
    stopDraw();
    fly.destroy();
    backR.destroy();
    frontR.destroy();
    sparks.close();
    motes.close();
  })();
}
