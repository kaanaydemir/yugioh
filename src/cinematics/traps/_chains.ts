// Light chains for Işık Zincirleri: slim golden chains of light (small 1-px links, magenta halo)
// that shoot from the trap card, coil around a monster in depth (back half behind the sprite,
// front half in front), lock with a padlock clank and haul it home. Adapted from the idea of
// setpieces.chainsBind, redrawn at a finer scale so the monster stays readable inside its chains.
// No registrations here.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { monsterFrame } from '../../art/textures';
import { DEPTH, GAME_H, GAME_W, type XY, unitDepth } from '../../view/layout';
import { shake } from '../../vfx/core';
import { Sparks as PxSparks, stopTime, whiteFlash } from '../../vfx/combat';
import { E, Raster, Sparks, floorRing, onFrame, qbez, run, sleep, spriteBox, type WorldBox } from '../../vfx/setpieces';
import { lightBeam, lightFlash, lightPool } from '../../view/light';
import { ADD, TAU, TK, clamp01, lerp, rnd, rr } from '../battle/_kit';

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
  // arena v2: the chains are light — a gold glow runs along them to the bound monster and a
  // gold pool lights the floor under it (they follow it while it is hauled home)
  const dxC = box0.cx - s.x;
  const floorOff = unit.home.y - unit.rest0.y;
  const bodyAt = (): XY => ({ x: s.x + dxC, y: s.y + fy(0.5) });
  const floorFrom = { x: from.x, y: from.y + 36 };
  const b0 = bodyAt();
  const chainGlow = lightBeam(scene, from, b0, PAL.gold3, 0, { width: 9, intensity: 0.15, floor: { from: floorFrom, to: { x: b0.x, y: s.y + floorOff } }, floorWidth: 8, shimmer: 0.5 });
  chainGlow.setIntensity(1.05, 230);
  const bindGlow = lightPool(scene, b0.x, b0.y, { color: PAL.gold4, spill: PAL.mag3, radius: 30 * TK, floorY: s.y + floorOff, air: 0.5, intensity: 0, anim: 'shimmer', fadeIn: 0 });
  const stopDraw = onFrame(scene, (_dt, el) => {
    phase = Math.floor(el / 55);
    if (s.active) {
      const c = bodyAt();
      chainGlow.setEnds(from, c, { from: floorFrom, to: { x: c.x, y: s.y + floorOff } });
      bindGlow.setPosition(c.x, c.y, s.y + floorOff);
    }
    draw();
  });

  // ---- 0–230 shoot (tracking the moving target)
  await run(scene, 230, (_t, el) => {
    shoot = rel.map((_, i) => E.outCubic(clamp01((el - i * 35) / 170)));
    if (rnd() < 0.7) sparks.add({ x: from.x + rr(-4, 4), y: from.y + rr(-4, 4), vx: rr(-30, 30), vy: rr(-50, -10), life: 240, ramp: [PAL.white, PAL.mag4, PAL.mag3, PAL.mag2], tex: 'fx:px1' });
  });
  shoot = rel.map(() => 1);
  // ---- 260–440 coil around it
  bindGlow.setIntensity(0.8, 160);
  await run(scene, 160, (t, el) => {
    wrap = rel.map((_, i) => E.outCubic(clamp01((el - i * 22) / 120)));
    straight = E.outQuad(t) * 0.5;
  });
  wrap = rel.map(() => 1);
  // ---- lock: clank
  locked = 1;
  o.onLock?.();
  void whiteFlash(scene, s, 2);
  { const c = bodyAt(); void lightFlash(scene, c.x, c.y, PAL.gold4, 40, 380, { floorY: s.y + floorOff, ring: true, intensity: 1.1 }); }
  bindGlow.setIntensity(1.2, 60);
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
  void floorRing(scene, unit.home.x, unit.home.y, { r0: 8, r1: 40 * TK, ms: 360, ramp: [PAL.gold4, PAL.mag4, PAL.mag3, PAL.mag2], depth: DEPTH.SHADOW - 1 });
  // ---- the chains stay taut a moment, then burst into light (background)
  void (async () => {
    await run(scene, 260, () => undefined);
    void chainGlow.fadeOut(380);
    void bindGlow.fadeOut(380);
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
    chainGlow.destroy();
    bindGlow.destroy();
    stopDraw();
    fly.destroy();
    backR.destroy();
    frontR.destroy();
    sparks.close();
    motes.close();
  })();
}

// ================================================================ the v3 look (?look=v3)
//
// A0 §6.2 item 10. The chains leave the standing card and WIND ROUND THE DEFENDER on their way —
// behind its body (those links are drawn just under the defender's sprite, so its body hides them)
// and out past its flanks — then shoot at the attacker, coil round it, lock (padlock clank, hit-stop),
// tighten coil by coil (the attacker resists part by part: the caller's onCoil changes its pose) and
// haul it home in three jerks along the floor (onStep: dust at its feet each time). A strand pixel
// is never drawn over the defender: every link inside the defender's silhouette goes to the layer
// behind it. Whole pixels, palette colours, no glow textures; the stepped light lights the pads.

interface Link {
  x: number;
  y: number;
  ux: number;
  uy: number;
  face: boolean;
  lit: boolean;
}

/** Links along a polyline (spacing 3 px) up to `len` px (+ the last link point). */
function linksAlong(pts: readonly XY[], len: number, phase: number): { links: Link[]; end: XY } {
  const links: Link[] = [];
  let acc = 0;
  let next = 0;
  let idx = 0;
  let end = pts[0];
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
  return { links, end };
}

type Put = (x: number, y: number, c: number) => void;

/** One link (as drawLinks draws them; `hot` lights it white, `dim` = behind a body / fading). */
function drawLink(g: Raster | Put, l: Link, hot: number, dim: boolean): void {
  const put: Put = typeof g === 'function' ? g : (x, y, c) => g.px(x, y, c);
  const nx = -l.uy;
  const ny = l.ux;
  const bright = l.lit || hot > 0.5;
  if (l.face) {
    put(l.x + l.ux * 1.4, l.y + l.uy * 1.4, bright ? PAL.white : dim ? GOLD[1] : GOLD[2]);
    put(l.x - l.ux * 1.4, l.y - l.uy * 1.4, bright ? PAL.gold4 : GOLD[1]);
    put(l.x + nx * 0.9, l.y + ny * 0.9, dim ? GOLD[0] : GOLD[1]);
    put(l.x - nx * 0.9, l.y - ny * 0.9, bright ? PAL.gold4 : dim ? GOLD[1] : GOLD[2]);
  } else {
    put(l.x, l.y, bright ? PAL.white : GOLD[1]);
    put(l.x + l.ux * 0.7, l.y + l.uy * 0.7, GOLD[0]);
  }
}

/** Is world pixel (x, y) one of `u`'s opaque pixels on the frame it shows now? */
function opaqueOn(u: MonsterUnit, x: number, y: number): boolean {
  const s = u.sprite;
  const fr = s.frame;
  if (!fr || !s.visible) return false;
  const W = fr.realWidth;
  const H = fr.realHeight;
  let fx = (Math.floor(x) + 0.5 - s.x) / s.scaleX + s.originX * W;
  if (s.flipX) fx = W - fx;
  const fy = (Math.floor(y) + 0.5 - s.y) / s.scaleY + s.originY * H;
  if (fx < 0 || fy < 0 || fx >= W || fy >= H) return false;
  const fi = u.frameInfo();
  try {
    return monsterFrame(u.cardId, fi.anim ?? 'idle', fi.frame).isOpaque(Math.floor(fx), Math.floor(fy));
  } catch {
    return false;
  }
}

/**
 * The defender's silhouette on the frame it shows now as a world-space mask (A2 tech review r2 #4:
 * one frame lookup per mask instead of one per chain pixel). Rebuilt only when its frame, position
 * or facing changes; null while it is hidden.
 */
interface SilMask {
  key: string;
  x0: number;
  y0: number;
  w: number;
  h: number;
  m: Uint8Array;
}

function silhouette(u: MonsterUnit, prev: SilMask | null): SilMask | null {
  const s = u.sprite;
  const fr = s.frame;
  if (!fr || !s.visible || !s.active) return null;
  const fi = u.frameInfo();
  const key = `${fi.anim}:${fi.frame}|${s.x},${s.y}|${s.flipX ? 1 : 0}|${s.scaleX},${s.scaleY}`;
  if (prev && prev.key === key) return prev;
  const W = fr.realWidth;
  const H = fr.realHeight;
  const x0 = Math.floor(s.x - s.originX * W * Math.abs(s.scaleX)) - 1;
  const y0 = Math.floor(s.y - s.originY * H * Math.abs(s.scaleY)) - 1;
  const w = Math.ceil(W * Math.abs(s.scaleX)) + 2;
  const h = Math.ceil(H * Math.abs(s.scaleY)) + 2;
  const m = new Uint8Array(w * h);
  let pc: { isOpaque(x: number, y: number): boolean } | null = null;
  try {
    pc = monsterFrame(u.cardId, fi.anim ?? 'idle', fi.frame);
  } catch {
    pc = null;
  }
  if (pc)
    for (let ly = 0; ly < h; ly++) {
      const fy = Math.floor((y0 + ly + 0.5 - s.y) / s.scaleY + s.originY * H);
      if (fy < 0 || fy >= H) continue;
      for (let lx = 0; lx < w; lx++) {
        let fx = (x0 + lx + 0.5 - s.x) / s.scaleX + s.originX * W;
        if (s.flipX) fx = W - fx;
        const ix = Math.floor(fx);
        if (ix >= 0 && ix < W && pc.isOpaque(ix, fy)) m[ly * w + lx] = 1;
      }
    }
  return { key, x0, y0, w, h, m };
}

function onMask(k: SilMask | null, x: number, y: number): boolean {
  if (!k) return false;
  const lx = Math.floor(x) - k.x0;
  const ly = Math.floor(y) - k.y0;
  return lx >= 0 && ly >= 0 && lx < k.w && ly < k.h && k.m[ly * k.w + lx] === 1;
}

/**
 * QA (dev / films): with `globalThis.__chainsQA = {}` set, every drawn frame counts the front-layer
 * chain pixels that land on the defender's opaque pixels (must stay 0) and logs the totals at the end.
 */
interface ChainsQA {
  frames?: number;
  frontPx?: number;
  overDefender?: number;
  /** Chain pixels that fell outside the (bounding-box sized) rasters: must stay 0. */
  clipped?: number;
  /** The rasters' sizes (w×h). */
  rasters?: string;
}
function chainsQA(): ChainsQA | null {
  const q = (globalThis as { __chainsQA?: ChainsQA }).__chainsQA;
  return q && typeof q === 'object' ? q : null;
}

/**
 * Işık Zincirleri's opening accent (v3, ≈ 240 ms): two short gold chains whip out of the standing
 * card's edges, curl and snap back in — the rattle of the chains inside the card.
 */
export function chainRattle(scene: Phaser.Scene, face: XY, ms = 240): Promise<void> {
  const ras = Raster.around(scene, face.x, face.y, 110, 90, DEPTH.FX + 5);
  return run(scene, ms, (t, el) => {
    const out = t < 0.5 ? E.outCubic(t / 0.5) : 1 - E.inQuad((t - 0.5) / 0.5);
    ras.draw((g) => {
      for (const side of [-1, 1]) {
        const a = { x: face.x + side * 13, y: face.y - 10 };
        const pts: XY[] = [];
        const L = 30 * out;
        for (let k = 0; k <= 12; k++) {
          const s = (k / 12) * L;
          const curl = (s / 30) * Math.PI * 1.1;
          pts.push({ x: a.x + side * Math.sin(curl) * 12, y: a.y - 6 + Math.cos(curl) * 9 + s * 0.15 });
        }
        if (L < 2) continue;
        const { links } = linksAlong(pts, 999, Math.floor(el / 40));
        for (const l of links) drawLink(g, l, 0, false);
      }
    });
  }).then(() => ras.destroy());
}

export interface LightChainsV3Opts {
  /** The attacker's resting sprite position: the chains haul it back there. */
  home: XY;
  /** The monster the attack was aimed at: the chains wind round it (never through it). */
  defender?: MonsterUnit | null;
  /** The clank: the attacker is caught (the caller freezes its pose there). */
  onLock?: () => void;
  /** Coil i (0 = top) tightens: the attacker resists — the caller steps its pose. */
  onCoil?: (i: number) => void;
  /** Haul step i: one jerk of the chains; the attacker's feet scrape the floor. */
  onStep?: (i: number, feet: XY) => void;
  /**
   * The farthest sprite position the attacker's lunge reaches (the chains' rasters are sized to
   * card → defender → attacker's path; without it they allow 60 px of travel round its start).
   */
  reach?: XY;
}

/** What lightChainsV3 hands back once the attacker is home and the chains are taut. */
export interface LightChainsV3Handle {
  /**
   * Let go, on THIS frame: the coils spring open off the body (their links fly off as sparks, the
   * padlock bursts) and the strands whip back into the card. Call it in the same synchronous
   * block as the attacker's first pose change, so chains and body change on one frame. Without a
   * call the chains let go on their own after CHAINS_V3.autoRelease ms.
   */
  release(): void;
}

/** Timings of lightChainsV3 (ms; scene time, the 60 ms lock hit-stop not included). */
export const CHAINS_V3 = { shoot: 220, coil: 100, coilGap: 60, steps: 3, step: 90, retract: 200, autoRelease: 600 } as const;

/** Is (x, y) inside the defender's silhouette (its row span on the current frame)? */
function insideBox(box: WorldBox | null, x: number, y: number): boolean {
  if (!box || y < box.top || y >= box.bottom) return false;
  const sp = box.spanAt(y);
  return !!sp && x >= sp[0] - 1 && x <= sp[1] + 1;
}

/**
 * The v3 chains (see the section header). Resolves when the attacker is home and the chains are
 * taut (~0.9 s + the hit-stop) with the handle that lets them go (release()).
 */
export async function lightChainsV3(scene: Phaser.Scene, from: XY, unit: MonsterUnit, o: LightChainsV3Opts): Promise<LightChainsV3Handle> {
  const s = unit.sprite;
  const n = 3;
  const def = o.defender && !o.defender.retired && o.defender.sprite.active && o.defender.sprite.visible ? o.defender : null;
  // the attacker's coils: three heights of its body (offsets from the sprite origin)
  const box0 = spriteBox(scene, s);
  const fy = (f: number) => box0.bottom - s.y - box0.h * f;
  const rel = [0.76, 0.52, 0.28].map((f) => {
    const wy = box0.bottom - box0.h * f;
    return { dy: fy(f), hw: Math.max(7, Math.round(box0.halfAt(wy) + 2)), dx: box0.cx - s.x };
  });
  const origins = rel.map((_, i) => ({ x: Math.round(from.x + (i - 1) * 4), y: Math.round(from.y + (i - 1) * 5) }));
  const ringCenter = (i: number): XY => ({ x: s.x + rel[i].dx, y: s.y + rel[i].dy });
  // strands meet their coils on the side of the attacker that faces where they come from
  const comeFrom = def ? def.sprite.x : from.x;
  const side = Math.sign(comeFrom - s.x) || (s.flipX ? -1 : 1);
  const anchor = (i: number): XY => {
    const c = ringCenter(i);
    return { x: c.x + side * rel[i].hw, y: c.y };
  };

  // ---- the route round the defender (fixed at the start: it does not move)
  const dBox = def ? spriteBox(scene, def.sprite) : null;
  const wrapPts: XY[][] = rel.map((_, i) => {
    if (!dBox) return [];
    const fyD = [0.78, 0.55, 0.32][i];
    const yi = Math.round(dBox.bottom - dBox.h * fyD);
    const sp = dBox.spanAt(yi) ?? [dBox.cx - 8, dBox.cx + 8];
    const cx = (sp[0] + sp[1]) / 2;
    const rx = (sp[1] - sp[0]) / 2 + 5 + i;
    const ry = 4;
    const eSide = Math.sign(origins[i].x - cx) || 1;
    // from the entry flank round the BACK of the body (sin < 0: the far side) to the exit flank:
    // right → left sweeps 0 → −π, left → right sweeps π → 2π
    const pts: XY[] = [];
    const N = 18;
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const a = eSide > 0 ? -Math.PI * t : Math.PI + Math.PI * t;
      pts.push({ x: cx + Math.cos(a) * rx, y: yi + Math.sin(a) * ry });
    }
    return pts;
  });
  const bend = [-0.6, 0.15, 0.7];
  let straight = 0;
  const strandPts = (i: number): XY[] => {
    const a = origins[i];
    const b = anchor(i);
    const pts: XY[] = [];
    const w = wrapPts[i];
    if (w.length) {
      // card → entry flank (an arc over the defender's shoulder), round its back, exit flank → attacker
      const e = w[0];
      const c1 = { x: (a.x + e.x) / 2, y: Math.min(a.y, e.y) - 10 * (1 - straight) };
      for (let k = 0; k <= 10; k++) pts.push(qbez(a, c1, e, k / 10));
      pts.push(...w.slice(1));
      const xpt = w[w.length - 1];
      const dx = b.x - xpt.x;
      const dy = b.y - xpt.y;
      const l = Math.hypot(dx, dy) || 1;
      const off = (1 - straight) * 16 * bend[i];
      const c2 = { x: (xpt.x + b.x) / 2 - (dy / l) * off, y: (xpt.y + b.y) / 2 + (dx / l) * off - (1 - straight) * 8 };
      for (let k = 1; k <= 16; k++) pts.push(qbez(xpt, c2, b, k / 16));
      return pts;
    }
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const off = (1 - straight) * 26 * bend[i];
    const ctrl = { x: (a.x + b.x) / 2 - (dy / l) * off, y: (a.y + b.y) / 2 + (dx / l) * off - (1 - straight) * 18 };
    for (let k = 0; k <= 28; k++) pts.push(qbez(a, ctrl, b, k / 28));
    return pts;
  };
  const pathLen = (pts: XY[]) => {
    let L = 0;
    for (let k = 1; k < pts.length; k++) L += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
    return L;
  };

  // the strands' rasters cover only what they can reach (A2 tech review r2 #4: two full-screen
  // rasters cleared and uploaded every frame): the card, round the defender, the attacker's path
  // from where it is through its lunge's reach to home, + the curves' bulge
  const span = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const add = (x: number, y: number) => {
    span.x0 = Math.min(span.x0, x);
    span.y0 = Math.min(span.y0, y);
    span.x1 = Math.max(span.x1, x);
    span.y1 = Math.max(span.y1, y);
  };
  const addBox = (b: { left: number; top: number; right: number; bottom: number }, dx = 0, dy = 0) => {
    add(b.left + dx, b.top + dy);
    add(b.right + dx, b.bottom + dy);
  };
  add(from.x, from.y);
  for (const p of origins) add(p.x, p.y);
  addBox(box0);
  addBox(box0, o.home.x - s.x, o.home.y - s.y);
  if (o.reach) addBox(box0, o.reach.x - s.x, o.reach.y - s.y);
  if (dBox) addBox(dBox);
  for (const w of wrapPts) for (const p of w) add(p.x, p.y);
  const M = 34 + (o.reach ? 0 : 60);
  const rx0 = Math.max(0, Math.floor(span.x0) - M);
  const ry0 = Math.max(0, Math.floor(span.y0) - M);
  const rx1 = Math.min(GAME_W, Math.ceil(span.x1) + M);
  const ry1 = Math.min(GAME_H, Math.ceil(span.y1) + M);
  const front = new Raster(scene, rx0, ry0, Math.max(1, rx1 - rx0), Math.max(1, ry1 - ry0), DEPTH.FX + 3);
  // only pixels ON the defender's body go behind it: its box (+ a margin for its idle) is enough
  const behindDef = def && dBox ? new Raster(scene, Math.floor(dBox.left) - 12, Math.floor(dBox.top) - 12, Math.ceil(dBox.w) + 24, Math.ceil(dBox.h) + 24, def.sprite.depth - 0.4) : null;
  let sil: SilMask | null = null;
  {
    const qa = chainsQA();
    if (qa) qa.rasters = `front ${front.w}×${front.h}${behindDef ? `, behind ${behindDef.w}×${behindDef.h}` : ''}`;
  }
  const backR = Raster.around(scene, s.x, s.y, 120, 140, unitDepth(unit.home.y) - 1);
  const frontR = Raster.around(scene, s.x, s.y, 120, 140, unitDepth(unit.home.y) + 1);
  const sparks = new PxSparks(scene, DEPTH.FX + 5);
  let shoot = rel.map(() => 0);
  let wrap = rel.map(() => 0);
  const hot = rel.map(() => 0);
  const tight = rel.map(() => 0);
  let locked = 0;
  /** 0 → 1 while the released strands whip back into the card. */
  let retract = 0;
  /** The coils have sprung open (release()). */
  let opened = false;
  let phase = 0;

  const draw = () => {
    const dLive = def && def.sprite.active && def.sprite.visible ? def : null;
    const box = dLive ? spriteBox(scene, dLive.sprite) : null;
    sil = dLive ? silhouette(dLive, sil) : null;
    const qa = chainsQA();
    front.draw((gf) => {
      const drawStrands = (gb: Raster | null) => {
        // every pixel on the defender's body goes to the layer behind it (its body hides it)
        const put: Put = (x, y, c) => {
          const px = Math.floor(x);
          const py = Math.floor(y);
          const g = dLive && insideBox(box, px, py) && onMask(sil, px, py) ? gb : gf;
          if (!g) return;
          if (qa && (px < g.x || py < g.y || px >= g.x + g.w || py >= g.y + g.h)) {
            qa.clipped = (qa.clipped ?? 0) + 1;
            (qa as { dbg?: string }).dbg = `${g === gf ? 'front' : 'behind'} ${px},${py} r ${g.x},${g.y} ${g.w}x${g.h}`;
          }
          g.px(px, py, c);
        };
        for (let i = 0; i < rel.length; i++) {
          if (shoot[i] <= 0) continue;
          const pts = strandPts(i);
          const L = pathLen(pts);
          // let go: the strand whips back into the card from the attacker's end
          const shown = L * shoot[i] * (1 - retract);
          if (shown < 2) continue;
          const { links, end } = linksAlong(pts, shown, phase + i * 2);
          for (const l of links) drawLink(put, l, hot[i], insideBox(box, l.x, l.y));
          if (shoot[i] < 1 || retract > 0) {
            for (const [dx, dy] of [
              [0, 0],
              [-1, 0],
              [1, 0],
              [0, -1],
              [0, 1],
            ])
              put(end.x + dx, end.y + dy, dx || dy ? PAL.gold4 : PAL.white);
          }
        }
      };
      if (behindDef) behindDef.draw((gb) => drawStrands(gb));
      else drawStrands(null);
      // QA: front chain pixels on the defender's body (must stay 0)
      if (qa) {
        qa.frames = (qa.frames ?? 0) + 1;
        if (dLive && box) {
          for (let y = Math.floor(box.top); y < box.bottom; y++)
            for (let x = Math.floor(box.left); x < box.right; x++) {
              if (x < gf.x || y < gf.y || x >= gf.x + gf.w || y >= gf.y + gf.h) continue;
              if (gf.pc.get(x - gf.x, y - gf.y) === null) continue;
              qa.frontPx = (qa.frontPx ?? 0) + 1;
              if (opaqueOn(dLive, x, y)) qa.overDefender = (qa.overDefender ?? 0) + 1;
            }
        }
      }
    });
    for (const [r, isFront] of [
      [backR, false],
      [frontR, true],
    ] as const) {
      r.moveTo(Math.round(s.x - 60), Math.round(s.y - 100));
      r.draw((g) => {
        if (opened) return; // sprung open on release: no coil pixel outlives the bound pose
        for (let i = 0; i < rel.length; i++) {
          if (wrap[i] <= 0) continue;
          const c = ringCenter(i);
          const rx = rel[i].hw - tight[i];
          const ry = 3;
          const a0 = side > 0 ? 0 : Math.PI;
          const N = 36;
          const seg: XY[] = [];
          const flush = () => {
            if (seg.length > 1) {
              const { links } = linksAlong(seg, 999, phase + i);
              for (const l of links) drawLink(g, l, hot[i], !isFront);
            }
            seg.length = 0;
          };
          for (let k = 0; k <= N * wrap[i]; k++) {
            const an = a0 + side * (k / N) * TAU * 1.15;
            const p = { x: c.x + Math.cos(an) * rx, y: c.y + Math.sin(an) * ry };
            if (Math.sin(an) >= 0 === isFront) seg.push(p);
            else flush();
          }
          flush();
          // the padlock on the front of the middle coil
          if (isFront && locked > 0 && i === 1) {
            const lx = Math.round(c.x);
            const ly = Math.round(c.y + ry + 1);
            const pop = hot[1] > 0.5;
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
  // the chains are light: their glow runs along the floor under them (stepped strip) and pools under the bound body
  const floorOff = unit.home.y - unit.rest0.y;
  const bindGlow = lightPool(scene, s.x, s.y + floorOff, { color: PAL.gold4, radius: 24, floorY: s.y + floorOff, intensity: 0, anim: 'shimmer', fadeIn: 0 });
  const stopDraw = onFrame(scene, (_dt, el) => {
    phase = Math.floor(el / 55);
    for (let i = 0; i < hot.length; i++) hot[i] = Math.max(0, hot[i] - _dt / 90);
    if (s.active) bindGlow.setPosition(Math.round(s.x), Math.round(s.y + floorOff), Math.round(s.y + floorOff));
    draw();
  });

  // ---- shoot (tracking the moving attacker), round the defender
  await run(scene, CHAINS_V3.shoot, (_t, el) => {
    shoot = rel.map((_, i) => E.outCubic(clamp01((el - i * 25) / (CHAINS_V3.shoot - 50))));
    if (rnd() < 0.6) sparks.add({ x: Math.round(from.x + rr(-4, 4)), y: Math.round(from.y + rr(-4, 4)), vx: rr(-30, 30), vy: rr(-50, -10), life: 200, colors: [PAL.white, PAL.gold4, PAL.mag4, PAL.mag3], shape: 'px', fadeAt: 1 });
  });
  shoot = rel.map(() => 1);
  // ---- they coil round it
  bindGlow.setIntensity(0.8, 100);
  await run(scene, CHAINS_V3.coil, (t, el) => {
    wrap = rel.map((_, i) => E.outCubic(clamp01((el - i * 18) / (CHAINS_V3.coil - 36))));
    straight = E.outQuad(t) * 0.4;
  });
  wrap = rel.map(() => 1);
  // ---- the lock: clank, white coils, hit-stop
  locked = 1;
  for (let i = 0; i < n; i++) hot[i] = 1;
  try {
    o.onLock?.();
  } catch (e) {
    console.error('[chains] onLock', e);
  }
  {
    const c = ringCenter(1);
    void lightFlash(scene, Math.round(c.x), Math.round(s.y + floorOff), PAL.gold4, 34, 360, { floorY: Math.round(s.y + floorOff), ring: true, intensity: 1.1 });
  }
  for (let i = 0; i < rel.length; i++) {
    const c = ringCenter(i);
    for (let k = 0; k < 6; k++) sparks.add({ x: Math.round(c.x + rr(-rel[i].hw, rel[i].hw)), y: Math.round(c.y + 3), vx: rr(-70, 70), vy: rr(-60, 0), ay: 300, drag: 2, life: rr(180, 320), colors: [PAL.white, PAL.gold4, PAL.gold3, PAL.mag3], shape: 'px', fadeAt: 1 });
  }
  void shake(scene, 140, 2);
  await stopTime(scene, 60);
  // ---- it resists: the coils bite one after another (top → bottom)
  for (let i = 0; i < n; i++) {
    tight[i] = 1;
    hot[i] = 1;
    try {
      o.onCoil?.(i);
    } catch (e) {
      console.error('[chains] onCoil', e);
    }
    const c = ringCenter(i);
    for (let k = 0; k < 4; k++) sparks.add({ x: Math.round(c.x + side * rel[i].hw), y: Math.round(c.y), vx: side * rr(20, 60), vy: rr(-50, -10), ay: 260, life: rr(140, 240), colors: [PAL.white, PAL.gold4, PAL.gold3], shape: 'px', fadeAt: 1 });
    await sleep(scene, CHAINS_V3.coilGap);
  }
  // ---- hauled home in jerks along the floor
  const start = { x: s.x, y: s.y };
  for (let k = 0; k < CHAINS_V3.steps; k++) {
    const p0 = { x: s.x, y: s.y };
    const f = (k + 1) / CHAINS_V3.steps;
    const p1 = { x: Math.round(lerp(start.x, o.home.x, f)), y: Math.round(lerp(start.y, o.home.y, f)) };
    for (let i = 0; i < n; i++) hot[i] = Math.max(hot[i], 0.6);
    try {
      o.onStep?.(k, unit.worldPoint('feet'));
    } catch (e) {
      console.error('[chains] onStep', e);
    }
    await run(scene, CHAINS_V3.step, (t) => {
      straight = Math.min(1, 0.4 + 0.6 * ((k + Math.min(1, t * 2.5)) / CHAINS_V3.steps));
      if (!s.active) return;
      // a fast pull (the first ~40 %), then the feet dig in
      const e = E.outCubic(Math.min(1, t / 0.4));
      s.setPosition(Math.round(lerp(p0.x, p1.x, e)), Math.round(lerp(p0.y, p1.y, e)));
    });
  }
  if (s.active) s.setPosition(o.home.x, o.home.y);
  straight = 1;
  for (let i = 0; i < n; i++) hot[i] = 1;
  // ---- taut until the caller lets go (release(), on the frame its pose changes): the coils spring
  // open off the body — every coil and the padlock gone on that very frame, their links flying off
  // as sparks — and the strands whip back into the card, curling as they go slack
  let freed = false;
  const free = () => {
    if (freed) return;
    freed = true;
    opened = true;
    const dLive = () => (def && def.sprite.active && def.sprite.visible ? spriteBox(scene, def.sprite) : null);
    if (s.active) {
      for (let i = 0; i < rel.length; i++) {
        const c = ringCenter(i);
        const rx = rel[i].hw - tight[i];
        for (let k = 0; k < 10; k++) {
          const an = (k / 10) * TAU + i * 0.4;
          const v = rr(40, 90);
          sparks.add({ x: Math.round(c.x + Math.cos(an) * rx), y: Math.round(c.y + Math.sin(an) * 3), vx: Math.cos(an) * v, vy: Math.sin(an) * v * 0.4 - rr(20, 50), ay: 300, drag: 2, life: rr(160, 300), colors: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2], shape: 'px', fadeAt: 1 });
        }
      }
      // the padlock bursts
      const c = ringCenter(1);
      for (let k = 0; k < 8; k++) sparks.add({ x: Math.round(c.x + rr(-2, 2)), y: Math.round(c.y + 5 + rr(-2, 2)), vx: rr(-60, 60), vy: rr(-70, -20), ay: 320, drag: 2, life: rr(180, 320), colors: [PAL.white, PAL.mag4, PAL.mag3, PAL.mag2], shape: 'px', fadeAt: 1 });
    }
    void bindGlow.fadeOut(220);
    // this frame already: no coil, no padlock
    draw();
    const motes = new PxSparks(scene, DEPTH.FX + 4);
    void run(scene, CHAINS_V3.retract, (t) => {
      retract = E.outCubic(t);
      straight = 1 - 0.6 * retract;
      for (let i = 0; i < rel.length; i++) hot[i] = Math.max(hot[i], 0.6 * (1 - t));
      if (rnd() < 0.8) {
        const i = Math.floor(rnd() * rel.length);
        const pts = strandPts(i);
        const p = linksAlong(pts, pathLen(pts) * (1 - retract), 0).end;
        if (!insideBox(dLive(), p.x, p.y)) motes.add({ x: Math.round(p.x + rr(-2, 2)), y: Math.round(p.y + rr(-2, 2)), vy: rr(-40, -15), life: rr(200, 320), colors: [PAL.white, PAL.gold4, PAL.mag3], shape: 'px', fadeAt: 1 });
      }
    }).then(() => {
      wrap = rel.map(() => 0);
      stopDraw();
      const qa = chainsQA();
      if (qa) console.log(`[chainsQA] ${def ? def.cardId : 'no defender'}: frames ${qa.frames ?? 0}, front chain px in the defender's box ${qa.frontPx ?? 0}, on its body ${qa.overDefender ?? 0}, clipped ${qa.clipped ?? 0}, rasters ${qa.rasters ?? '-'} ${(qa as { dbg?: string }).dbg ?? ''}`);
      front.destroy();
      behindDef?.destroy();
      backR.destroy();
      frontR.destroy();
      sparks.release();
      motes.release();
      bindGlow.destroy();
    });
  };
  // nobody let go (the attacker left the field...): the chains let go on their own
  void sleep(scene, CHAINS_V3.autoRelease).then(free);
  return { release: free };
}
