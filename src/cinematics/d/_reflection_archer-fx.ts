// Yansıyan Okçu (reflection_archer) — the card's own effect pieces (?look=v3 only; registers nothing: the `_` file
// is loaded by the cinematics glob but has no side effects). Used by ./reflection_archer.ts.
//
// The language of the card is the MIRROR: the floor is a mirror (the art's reflection is the figure mirrored at
// the ground line and foreshortened by KR), so every piece here has a twin under the floor line:
//
//   archerPoint(u, which, anim?, f?)      the arrow's tip / the puddle's front edge on a frame, in world px
//   lightDrop(sc, home, ms, depth)        summon: one drop of light falls out of the dark (its dark twin rises
//                                         under the floor line to meet it)
//   echoRings(sc, at, o)                  a gold ring on the floor and, 80 ms later, its dark-blue echo ring
//   mirrorPlane(sc, home)                 summon: the horizontal mirror line the archer unfolds over; collapse()
//   drawMotes(sc, u, ms)                  attack charge: light motes gather on the arrow, dark ones on its mirror
//   twinArrows(sc, o)                     "Ayna Atışı": the arrow of light flies straight; the reflection's arrow
//                                         runs UNDER the floor (its mirror image), the floor surface rippling over it
//   mirrorMeet(sc, o)                     contact: the vertical light line (top and bottom meet) + the horizontal
//                                         mirror flash, glass glints along the mirror plane
//   puddleCracks(sc, ground, dir)         death f1: cracks of light run out of the puddle over the marble
//   reflectionShards(sc, ground, dir, d)  death f2: the reflection breaks: dark-blue shards slide over the floor
//   glassFall(sc, u, ground)              death burst: glass shards fall and their dark reflections rise to meet
//                                         them at the floor line; the puddle drains to nothing
//
// Pixel language (REHBER EF-6 / EF-7): 1-px lines, palette steps instead of alpha (Bayer dither), whole-pixel
// positions, no sprite rotation or scale, stepped floor light. The camera never moves (EF-8).

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { AnyMonsterAnim } from '../../art/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, type XY } from '../../view/layout';
import { lightPool } from '../../view/light';
import { Raster } from '../../vfx/setpieces';
import { Sparks, animate, onFrame } from '../../vfx/combat';
import { GY, KR, PCX, PCY, PRX, W as ART_W, skeleton } from '../../art/monsters-v3/reflection_archer-rig';
import { framePose } from '../../art/monsters-v3/reflection_archer-anims';

export const TAU = Math.PI * 2;
/** Floor marks just above the cards on the tiles (under every body). */
export const FLOOR_DEPTH = DEPTH.CARD_ON_TILE + 2;
const GOLD = [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2, PAL.gold1] as const;
const DEEP = [PAL.water4, PAL.water3, PAL.water2, PAL.night3, PAL.night2] as const;
const GLASS = [PAL.white, PAL.mist, PAL.water4] as const;

let seedV = 1;
/** Deterministic random (films repeat). */
export function seedFx(n: number): void {
  seedV = (Math.abs(Math.floor(n)) % 2147483646) + 1;
}
function rnd(): number {
  seedV = (seedV * 16807) % 2147483647;
  return (seedV - 1) / 2147483646;
}
const RR = (a: number, b: number): number => a + (b - a) * rnd();
const rx = (p: XY): XY => ({ x: Math.round(p.x), y: Math.round(p.y) });
const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
/** The mirror of a point at the floor line `gy` (the art's foreshortening). */
export const mirrorY = (y: number, gy: number): number => Math.round(gy + (gy - y) * KR);

/** An iso ellipse outline (1 px), dithered at `level`. */
function ring(g: Raster, cx: number, cy: number, rx0: number, ry0: number, c: number, level = 1, gap = 0): void {
  if (rx0 < 1) return;
  const n = Math.max(12, Math.round(rx0 * 4));
  for (let i = 0; i < n; i++) {
    if (gap > 0 && i % gap === 0) continue;
    const a = (i / n) * TAU;
    g.dpx(Math.round(cx + Math.cos(a) * rx0), Math.round(cy + Math.sin(a) * ry0), c, level);
  }
}

// ================================================================ the archer's points

/**
 * A point of the archer on a frame (default: the frame on screen), in world px: 'tip' the arrow's point (the
 * art's muzzle), 'puddle' the puddle's front edge (where the reflection's arrow leaves it), 'gem' the chest gem.
 */
export function archerPoint(u: MonsterUnit, which: 'tip' | 'puddle' | 'gem' | 'streak', anim?: AnyMonsterAnim, frame?: number): XY | null {
  if (!u.sprite.active || u.cardId !== 'reflection_archer') return null;
  if (which === 'streak') {
    // the head of the release streak the art draws on the attack's release frame (shot × the run to the frame edge)
    const P = framePose('attack', frame ?? 6);
    const g = skeleton(P).grip;
    const x0 = Math.round(g[0]) + 2;
    const len = Math.round((ART_W - 3 - x0) * Math.max(0, Math.min(1, P.shot)));
    const y = Math.round(GY - (GY - (g[1] - 0.5)) * Math.max(0.05, P.k));
    return rx(u.framePoint(x0 + len + 0.5, y + 0.5));
  }
  if (which === 'puddle') return rx(u.framePoint(PCX + PRX - 3 + 0.5, PCY + 0.5));
  const fi = u.frameInfo();
  const pts = u.art.points?.(anim ?? fi.anim ?? 'idle', frame ?? fi.frame);
  const p = which === 'tip' ? pts?.muzzle : pts?.core;
  if (!p) return null;
  return rx(u.framePoint(p.x + 0.5, p.y + 0.5));
}

// ================================================================ summon

/** One drop of light falls out of the dark (its dark twin rises under the floor line toward it). */
export function lightDrop(sc: Phaser.Scene, home: XY, ms: number, depth: number): Promise<void> {
  const top = Math.max(-6, home.y - 170);
  const bot = home.y - 44;
  const r = new Raster(sc, home.x - 4, top - 24, 9, home.y - top + 80, depth);
  const fl = lightPool(sc, home.x, top, { color: PAL.gold4, radius: 10, floorY: home.y, air: 0.9, intensity: 0.5, fadeIn: 0 });
  return animate(sc, ms, (t) => {
    const e = t * t;
    const y = Math.round(top + (bot - top) * e);
    fl.setPosition(home.x, y, home.y);
    r.draw((g) => {
      const len = Math.round(6 + 20 * e);
      for (let i = len; i >= 1; i--) {
        const k = i / len;
        g.dpx(home.x, y - i - 1, k < 0.3 ? PAL.gold4 : k < 0.65 ? PAL.gold3 : PAL.gold2, 1.15 - k);
      }
      // the drop: a white core, gold rim
      g.px(home.x, y, PAL.white);
      g.px(home.x, y + 1, PAL.white);
      g.px(home.x - 1, y + 1, PAL.gold4);
      g.px(home.x + 1, y + 1, PAL.gold4);
      g.px(home.x, y + 2, PAL.gold3);
      // its twin under the floor line, a dark-blue glint coming up to meet it
      const my = mirrorY(y, home.y);
      if (my - home.y < 60) {
        g.px(home.x, my, PAL.water3);
        g.px(home.x, my - 1, PAL.water2);
        g.dpx(home.x, my + 1, PAL.night3, 0.6);
      }
    });
  }).then(() => {
    r.destroy();
    fl.destroy();
  });
}

/**
 * A ring of light runs out over the floor (gold / mist) and, `lag` ms later, its echo — the reflection's dark-blue
 * ring, a step behind (the sound's 80 ms answer, seen). Stepped fade, whole px.
 */
export function echoRings(sc: Phaser.Scene, at: XY, o: { r?: number; ms?: number; lag?: number; depth?: number; bright?: boolean } = {}): Promise<void> {
  const R = o.r ?? 34;
  const ms = o.ms ?? 380;
  const lag = o.lag ?? 80;
  const ras = Raster.around(sc, at.x, at.y, 2 * R + 8, R + 8, o.depth ?? FLOOR_DEPTH);
  return animate(sc, ms + lag, (_t, el) => {
    ras.draw((g) => {
      for (const [k0, tones] of [[0, GOLD], [lag, DEEP]] as const) {
        const t = clamp((el - k0) / ms, 0, 1);
        if (t <= 0 || t >= 1) continue;
        const e = 1 - (1 - t) * (1 - t);
        const rr = 6 + (R - 6) * e;
        const step = Math.min(3, Math.floor(t * 4));
        const c = tones === GOLD ? (o.bright && step === 0 ? PAL.white : GOLD[1 + step]) : DEEP[Math.min(4, step + 1)];
        ring(g, at.x, at.y, rr, rr * 0.5, c, step < 2 ? 1 : 0.5);
      }
    });
  }).then(() => ras.destroy());
}

export interface MirrorPlane {
  /** The archer stands: the line flares once and collapses into its feet. */
  collapse(ms?: number): Promise<void>;
  destroy(): void;
}

/**
 * Summon: the mirror line — a horizontal 1-px line of light at the floor line, opening out of the puddle to both
 * sides while the reflection waits and the archer unfolds over it; glints run along it.
 */
export function mirrorPlane(sc: Phaser.Scene, home: XY, depth: number): MirrorPlane {
  const W = 46;
  const ras = Raster.around(sc, home.x, home.y, 2 * W + 6, 6, depth);
  let open = 0;
  let closing = -1;
  let closeMs = 160;
  let dead = false;
  let elNow = 0;
  const stop = onFrame(sc, (_dt, el) => {
    if (dead) return false;
    elNow = el;
    if (closing < 0) open = Math.min(1, el / 220);
    const cT = closing < 0 ? 0 : clamp((el - closing) / closeMs, 0, 1);
    const half = Math.round(W * (closing < 0 ? 1 - (1 - open) * (1 - open) : 1 - cT));
    ras.draw((g) => {
      if (half < 1) return;
      for (let x = -half; x <= half; x++) {
        const k = Math.abs(x) / W;
        const c = closing >= 0 && cT < 0.25 ? PAL.white : k < 0.3 ? PAL.white : k < 0.6 ? PAL.gold4 : PAL.gold3;
        g.dpx(home.x + x, home.y, c, 1.2 - k * 0.9);
        if (k < 0.25) g.dpx(home.x + x, home.y + 1, PAL.water3, 0.5);
      }
      // two glints running outward along the line
      const run = ((el / 520) % 1) * half;
      for (const s of [-1, 1]) {
        const gx = home.x + s * Math.round(run);
        g.px(gx, home.y, PAL.white);
        g.px(gx, home.y - 1, PAL.gold4);
        g.px(gx, home.y + 1, PAL.water4);
      }
    });
    return !(closing >= 0 && cT >= 1);
  }, () => {
    dead = true;
    ras.destroy();
  });
  return {
    collapse(ms = 160) {
      if (dead || closing >= 0) return Promise.resolve();
      closeMs = ms;
      closing = elNow;
      return new Promise<void>((res) => sc.time.delayedCall(ms + 20, res));
    },
    destroy() {
      dead = true;
      stop();
      ras.destroy();
    },
  };
}

// ================================================================ attack

/** Attack charge: motes of light gather on the arrow's point; dark-blue ones gather on its mirror under the floor. */
export function drawMotes(sc: Phaser.Scene, u: MonsterUnit, ms: number, tip: XY, ground: number): void {
  const up = new Sparks(sc, DEPTH.FX - 1);
  const dn = new Sparks(sc, FLOOR_DEPTH + 1);
  const mt = { x: tip.x, y: mirrorY(tip.y, ground) };
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = RR(0, TAU);
    const d = RR(10, 20);
    const delay = (i / n) * Math.max(0, ms - 200);
    const life = RR(160, 240);
    up.add({ x: tip.x + Math.cos(a) * d, y: tip.y + Math.sin(a) * d * 0.7, tx: tip.x, ty: tip.y, life, delay, colors: [PAL.white, PAL.gold4, PAL.gold3], shape: 'px', fadeAt: 1 });
    // the reflection's motes: the same, mirrored and squashed, a step behind
    dn.add({ x: mt.x + Math.cos(a) * d, y: mt.y - Math.sin(a) * d * 0.7 * KR, tx: mt.x, ty: mt.y, life, delay: delay + 80, colors: [PAL.water4, PAL.water3, PAL.water2], shape: 'px', fadeAt: 1 });
  }
  up.release();
  dn.release();
  void u;
}

export interface TwinArrowOpts {
  /** The arrow of light leaves here (the nocked point) … */
  from: XY;
  /** … and the reflection's arrow here (the puddle's front edge, under the floor line). */
  fromUnder: XY;
  /** The attacker's floor line (y) and the floor point under the meeting point. */
  ground: number;
  to: XY;
  toGround: XY;
  ms: number;
  /** +1 the shot goes right. */
  dir: 1 | -1;
}

/**
 * "Ayna Atışı" — the arrow of light flies straight to the meeting point; the reflection's arrow runs UNDER the
 * floor as its mirror image (below the floor line by the arrow's height × KR), a hair ahead, the floor surface
 * rippling over it. Resolves when both reach the target (top and bottom).
 */
export function twinArrows(sc: Phaser.Scene, o: TwinArrowOpts): Promise<void> {
  const pad = 40;
  const minX = Math.min(o.from.x, o.fromUnder.x, o.to.x) - pad;
  const maxX = Math.max(o.from.x, o.fromUnder.x, o.to.x) + pad;
  const minY = Math.min(o.from.y, o.to.y) - 12;
  const maxY = Math.max(mirrorY(o.to.y, o.toGround.y), o.fromUnder.y, o.ground) + 14;
  const top = new Raster(sc, minX, minY, maxX - minX, maxY - minY, DEPTH.FX);
  const under = new Raster(sc, minX, minY, maxX - minX, maxY - minY, FLOOR_DEPTH + 1);
  const trailU: XY[] = [];
  const trailD: XY[] = [];
  const ripples: { x: number; y: number; at: number }[] = [];
  const g0: XY = { x: o.fromUnder.x, y: o.ground };
  // no floor pools under the arrows: on the dark marble a moving stepped pool reads as a dark blob, not light
  let lastRip = -99;
  const dx = o.to.x - o.from.x;
  const dy = o.to.y - o.from.y;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const mEnd: XY = { x: o.toGround.x, y: mirrorY(o.to.y, o.toGround.y) };
  const mdx = mEnd.x - o.fromUnder.x;
  const mdy = mEnd.y - o.fromUnder.y;
  const mL = Math.hypot(mdx, mdy) || 1;
  const vx = mdx / mL;
  const vy = mdy / mL;
  return animate(sc, o.ms, (t, el) => {
    // a loosed arrow: fast from the first frame, a touch faster at the end (no slow start: EF readability)
    const e = 0.65 * t + 0.35 * t * t;
    // the reflection is a step ahead (it "shoots first"), and they still meet together
    const eu = Math.min(1, e + 0.07 * Math.sin(Math.PI * e));
    const p = rx({ x: o.from.x + dx * e, y: o.from.y + dy * e });
    const gx = g0.x + (o.toGround.x - g0.x) * eu;
    const gy = o.ground + (o.toGround.y - o.ground) * eu;
    // its mirror under the floor: from the puddle's edge to the mirror of the meeting point
    const q = rx({ x: o.fromUnder.x + (mEnd.x - o.fromUnder.x) * eu, y: o.fromUnder.y + (mEnd.y - o.fromUnder.y) * eu });
    if (!trailU.length || trailU[0].x !== p.x || trailU[0].y !== p.y) {
      trailU.unshift(p);
      if (trailU.length > 6) trailU.pop();
    }
    if (!trailD.length || trailD[0].x !== q.x || trailD[0].y !== q.y) {
      trailD.unshift(q);
      if (trailD.length > 12) trailD.pop();
    }
    if (el - lastRip > 34) {
      lastRip = el;
      ripples.push({ x: Math.round(gx), y: Math.round(gy), at: el });
    }
    top.draw((g) => {
      // the streak: a stepped wake behind the point (gold → dark gold, thinning)
      for (let i = trailU.length - 1; i >= 1; i--) {
        const a = trailU[i];
        const b = trailU[i - 1];
        g.line(a.x, a.y, b.x, b.y, i < 2 ? PAL.gold4 : i < 4 ? PAL.gold3 : PAL.gold2, i < 4 ? 1 : 0.5);
      }
      // the arrow: 2-px white point, a gold shaft of 7 px, two fletching px
      for (let k = 0; k <= 8; k++) {
        const x = Math.round(p.x - ux * k);
        const y = Math.round(p.y - uy * k);
        g.px(x, y, k < 2 ? PAL.white : k < 7 ? PAL.gold4 : PAL.gold3);
      }
      const fx = Math.round(p.x - ux * 8);
      const fy = Math.round(p.y - uy * 8);
      g.px(fx, fy - 1, PAL.gold3);
      g.px(fx, fy + 1, PAL.gold3);
      g.px(Math.round(p.x + ux), Math.round(p.y + uy), PAL.gold4);
    });
    under.draw((g) => {
      // the floor surface ripples where the arrow passes beneath (small iso rings, stepped out)
      for (const r of ripples) {
        const k = (el - r.at) / 220;
        if (k < 0 || k >= 1) continue;
        const rr = 2 + 7 * k;
        ring(g, r.x, r.y, rr, rr * 0.5, k < 0.3 ? PAL.mist : k < 0.6 ? PAL.water4 : PAL.water3, k < 0.6 ? 1 : 0.5, 3);
      }
      // the light of the reflection's arrow seen THROUGH the glass floor: a bright slit on the surface right
      // above it, with a short glowing wake (the surface is the mirror; the arrow runs just beneath it)
      const sx = Math.round(gx);
      const sy = Math.round(gy);
      for (let k = 0; k <= 12; k++) {
        const x = Math.round(sx - vx * k);
        const y = Math.round(sy - vy * k);
        g.dpx(x, y, k < 2 ? PAL.white : k < 6 ? PAL.mist : PAL.water4, k < 8 ? 1 : 0.5);
      }
      // the dark wake under the glass (a cut through the floor, closing behind it)
      for (let i = trailD.length - 1; i >= 1; i--) {
        const a = trailD[i];
        const b = trailD[i - 1];
        g.line(a.x, a.y, b.x, b.y, i < 4 ? PAL.water3 : i < 7 ? PAL.water2 : PAL.night3, i < 5 ? 1 : 0.5);
        g.line(a.x, a.y - 1, b.x, b.y - 1, PAL.night2, i < 5 ? 1 : 0.5);
      }
      // the reflected arrow: the same shape in the reflection's tones (a 2-row shaft), its point a cold glint
      for (let k = 0; k <= 12; k++) {
        const x = Math.round(q.x - vx * k);
        const y = Math.round(q.y - vy * k);
        g.px(x, y, k < 2 ? PAL.white : k < 4 ? PAL.mist : k < 9 ? PAL.water4 : PAL.water3);
        if (k >= 1 && k < 10) g.px(x, y + 1, k < 5 ? PAL.water4 : PAL.water3);
      }
      g.px(Math.round(q.x + vx), Math.round(q.y + vy), PAL.water4);
      const bx = Math.round(q.x - vx * 12);
      const by = Math.round(q.y - vy * 12);
      g.px(bx, by - 1, PAL.water3);
      g.px(bx, by + 2, PAL.water3);
      g.px(bx - Math.round(vx), by - 2, PAL.water2);
      g.px(bx - Math.round(vx), by + 3, PAL.water2);
    });
  }).then(() => {
    top.destroy();
    under.destroy();
  });
}

export interface MeetOpts {
  /** Where the arrow of light lands (the top). */
  at: XY;
  /** The floor point under it (the reflection's arrow surfaces from below here). */
  ground: XY;
  /** +1 the shot came from the left. */
  dir: 1 | -1;
  /** Blocked: a smaller, colder meeting (the arrows glance off the guard). */
  blocked?: boolean;
  /** Direct attack: the widest flash. */
  direct?: boolean;
}

/**
 * Contact: the two arrows meet top and bottom — a VERTICAL line of light from below the floor line up through the
 * meeting point (3 px → 1 px → dithered, thinning after the contact, EF-13) and the HORIZONTAL mirror flash
 * across it (a lens of white / gold / water bands that shrinks to a line), glass glints sliding out along the
 * mirror plane. Whole px; covers ≤ a third of a body for ≤ 2 frames (EF-2 / EF-3).
 */
export function mirrorMeet(sc: Phaser.Scene, o: MeetOpts): Promise<void> {
  const at = rx(o.at);
  const gy = Math.round(o.ground.y);
  const bot = Math.max(gy + 4, mirrorY(at.y, gy));
  const W = o.blocked ? 16 : o.direct ? 30 : 24;
  const ms = o.blocked ? 220 : 300;
  const ras = new Raster(sc, at.x - W - 4, at.y - 20, 2 * W + 8, bot - at.y + 28, DEPTH.FX + 1);
  const glints = new Sparks(sc, DEPTH.FX + 1);
  const n = o.blocked ? 4 : 8;
  for (let i = 0; i < n; i++) {
    const s = i % 2 ? 1 : -1;
    glints.add({ x: at.x + s * 2, y: at.y + (i % 3) - 1, vx: s * RR(70, 150), vy: RR(-8, 8), drag: 5, life: RR(180, 300), colors: o.blocked ? [PAL.water4, PAL.water3, PAL.water2] : [PAL.white, PAL.gold4, PAL.water4], shape: 'px', fadeAt: 1 });
  }
  glints.release();
  const coreC = o.blocked ? PAL.water4 : PAL.white;
  const bandC = o.blocked ? PAL.water3 : PAL.gold4;
  return animate(sc, ms, (t) => {
    ras.draw((g) => {
      // ---- the vertical line: below the floor (the reflection's arrow) up through the meeting point
      const vTop = at.y - (o.blocked ? 6 : 12);
      const vw = t < 0.12 ? 3 : t < 0.3 ? 1 : 1;
      const vl = t < 0.3 ? 1 : 1 - (t - 0.3) / 0.7;
      for (let y = vTop; y <= bot; y++) {
        const under = y > gy;
        const c = under ? (t < 0.12 ? PAL.water4 : PAL.water3) : t < 0.2 ? coreC : bandC;
        g.dpx(at.x, y, c, vl * (under ? 0.9 : 1.1));
        if (vw === 3 && Math.abs(y - at.y) < 10) {
          g.px(at.x - 1, y, under ? PAL.water3 : bandC);
          g.px(at.x + 1, y, under ? PAL.water3 : bandC);
        }
      }
      // ---- the horizontal mirror flash: a lens that shrinks to a line
      const len = Math.round(W * (t < 0.15 ? 1 : 1 - 0.55 * ((t - 0.15) / 0.85)));
      const lv = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
      for (let x = -len; x <= len; x++) {
        const k = Math.abs(x) / Math.max(1, len);
        g.dpx(at.x + x, at.y, t < 0.15 ? coreC : k < 0.4 ? coreC : bandC, (1.25 - k) * lv);
        if (t < 0.3 && k < 0.6) {
          g.dpx(at.x + x, at.y - 1, bandC, (1 - k) * 1.2);
          g.dpx(at.x + x, at.y + 1, o.blocked ? PAL.water2 : PAL.water4, (1 - k) * 1.2);
        }
        if (t < 0.12 && k < 0.25) {
          g.px(at.x + x, at.y - 2, o.blocked ? PAL.water3 : PAL.gold3);
          g.px(at.x + x, at.y + 2, PAL.water3);
        }
      }
      // the meeting point itself: a 1-px star on the first frames
      if (t < 0.2) {
        g.px(at.x, at.y, PAL.white);
        g.px(at.x - 1, at.y - 1, coreC);
        g.px(at.x + 1, at.y + 1, coreC);
        g.px(at.x + 1, at.y - 1, coreC);
        g.px(at.x - 1, at.y + 1, coreC);
      }
    });
  }).then(() => ras.destroy());
}

/** Blocked: the arrow of light breaks on the guard — three gold splinters spring back toward the archer. */
export function splinters(sc: Phaser.Scene, at: XY, dir: 1 | -1): void {
  const sp = new Sparks(sc, DEPTH.FX + 2);
  for (let i = 0; i < 4; i++) {
    sp.add({ x: at.x - dir * 2, y: at.y + i - 2, vx: -dir * RR(60, 120), vy: RR(-70, -20), ay: 320, drag: 1, life: RR(260, 380), colors: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2], shape: 'streak', len: 0.03, fadeAt: 1 });
  }
  sp.release();
}

// ================================================================ death

export interface Cracks {
  /** The cracks drain (stepped) and are gone. */
  fade(ms?: number): Promise<void>;
  destroy(): void;
}

/**
 * Death f1: cracks of light run out of the puddle over the marble — jagged iso lines from its centre (white
 * heads, water bodies), held until the burst.
 */
export function puddleCracks(sc: Phaser.Scene, ground: XY, dir: 1 | -1): Cracks {
  const c: XY = { x: ground.x + dir, y: ground.y + 5 };
  const ras = Raster.around(sc, c.x, c.y, 96, 52, FLOOR_DEPTH + 0.5);
  const arms: XY[][] = [];
  const N = 7;
  for (let i = 0; i < N; i++) {
    let a = (i / N) * TAU + RR(-0.25, 0.25);
    let p: XY = { x: c.x + Math.cos(a) * 16, y: c.y + Math.sin(a) * 8 };
    const pts: XY[] = [rx(p)];
    const steps = Math.round(RR(4, 7));
    for (let k = 0; k < steps; k++) {
      a += RR(-0.5, 0.5);
      p = { x: p.x + Math.cos(a) * RR(3, 6), y: p.y + Math.sin(a) * RR(1.5, 3) };
      pts.push(rx(p));
    }
    arms.push(pts);
  }
  let fadeAt = -1;
  let fadeMs = 300;
  let el0 = 0;
  const stop = onFrame(sc, (_dt, el) => {
    el0 = el;
    const grow = clamp(el / 140, 0, 1);
    const f = fadeAt < 0 ? 0 : clamp((el - fadeAt) / fadeMs, 0, 1);
    if (f >= 1) return false;
    ras.draw((g) => {
      for (const pts of arms) {
        const n = Math.max(2, Math.round(pts.length * grow));
        for (let k = 1; k < n; k++) {
          const a = pts[k - 1];
          const b = pts[k];
          const lvl = f < 0.34 ? 1 : f < 0.67 ? 0.6 : 0.3;
          g.line(a.x, a.y, b.x, b.y, f > 0.5 ? PAL.water2 : PAL.water3, lvl);
          if (k === n - 1 && grow < 1) g.px(b.x, b.y, PAL.white);
          else if (k % 2 === 0 && f < 0.5) g.dpx(b.x, b.y, PAL.water4, lvl);
        }
      }
    });
    return true;
  }, () => ras.destroy());
  return {
    fade(ms = 300) {
      fadeMs = ms;
      fadeAt = el0;
      return new Promise<void>((res) => sc.time.delayedCall(ms + 40, res));
    },
    destroy() {
      stop();
      ras.destroy();
    },
  };
}

/** Death f2: the reflection breaks — dark-blue shards slide out over the floor from under the archer's feet. */
export function reflectionShards(sc: Phaser.Scene, ground: XY, dir: 1 | -1, depth: number): void {
  const sp = new Sparks(sc, depth);
  for (let i = 0; i < 14; i++) {
    const a = RR(0, TAU);
    const v = RR(30, 80);
    sp.add({
      x: ground.x + dir * Math.round(RR(-6, 8)),
      y: ground.y + Math.round(RR(3, 12)),
      vx: Math.cos(a) * v,
      vy: Math.abs(Math.sin(a)) * v * 0.45,
      drag: 4,
      life: RR(260, 420),
      size: i % 3 === 0 ? 2 : 1,
      colors: [PAL.water4, PAL.water3, PAL.water2, PAL.night3],
      shape: 'px',
      fadeAt: 0.75,
    });
  }
  sp.release();
}

/** Glass sliver masks (cells, top-left first): thin flat shards 2–4 px long, never single pixels. */
const SLIVERS: readonly (readonly [number, number][])[] = [
  [[0, 0], [0, 1], [1, 2]],
  [[0, 0], [1, 0], [1, 1], [2, 2]],
  [[1, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 1], [2, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 3]],
  [[1, 0], [1, 1], [0, 2]],
];

/** One sliver at (x, y): a 1-px outline, the first cell lit (a glint on its top edge), the body in `body`. Its
 *  mirrored twin (flip: cells upside down) uses the reflection's tones. */
function sliver(g: Raster, x: number, y: number, m: readonly [number, number][], flip: boolean, out: number, lit: number, body: number): void {
  const cells = flip ? m.map(([dx, dy]) => [dx, -dy] as const) : m;
  for (const [dx, dy] of cells) for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) g.px(x + dx + ox, y + dy + oy, out);
  cells.forEach(([dx, dy], k) => g.px(x + dx, y + dy, k === 0 ? lit : body));
}

/**
 * Death burst (§5.2 "yansıma kırılır, okçu cam kırıklarına"): the archer's glass falls as flat white / mist
 * slivers (1-px ink outline, whole-px steps); under the floor line each sliver's dark-blue mirrored twin rises to
 * meet it; where they meet on the floor line they vanish together in a short horizontal mirror glint. The puddle
 * (both lobes) drains to nothing. No crystal heap, no teal: this replaces the generic material break.
 */
export function glassFall(sc: Phaser.Scene, u: MonsterUnit, ground: XY, dir: 1 | -1): Promise<void> {
  const gy = Math.round(ground.y);
  const top = gy - 64;
  const ras = new Raster(sc, ground.x - 50, top - 10, 100, gy - top + 80, DEPTH.FX - 2);
  const floor = Raster.around(sc, ground.x + dir, gy + 18, 64, 56, FLOOR_DEPTH);
  interface Shard { x: number; y: number; vx: number; vy: number; m: number; lit: number; body: number; done: number; meet: number }
  const shards: Shard[] = [];
  for (let i = 0; i < 16; i++) {
    const hy = RR(8, 52);
    shards.push({
      x: ground.x + dir * RR(-9, 12),
      y: gy - hy,
      vx: dir * RR(-12, 34) + RR(-14, 14),
      vy: RR(-70, -10),
      m: i % SLIVERS.length,
      lit: i % 3 === 0 ? PAL.white : PAL.mist,
      body: i % 3 === 2 ? PAL.steel : PAL.mist,
      done: -1,
      // each lands on its own row of the floor (iso depth), so the meetings ripple across the puddle
      meet: gy + Math.round(RR(-2, 4)),
    });
  }
  const pud: XY = { x: ground.x + dir, y: gy + 5 };
  const MS = 640;
  void u;
  return animate(sc, MS, (t, el, dt) => {
    const s = dt / 1000;
    floor.draw((g) => {
      // the puddle drains (both lobes shrink toward the feet, stepped tones), under every body
      const pk = Math.round((1 - t) * 6) / 6;
      if (pk > 0.05) {
        const fill = pk > 0.6 ? PAL.night4 : PAL.night3;
        const rim = pk > 0.6 ? PAL.steel : PAL.night4;
        const by = pud.y + Math.round(21 * pk);
        g.ell(pud.x, pud.y, Math.round(25 * pk), Math.max(1, Math.round(12 * pk)), rim);
        g.ell(pud.x, by, Math.round(17 * pk), Math.max(1, Math.round(15 * pk)), rim);
        g.ell(pud.x, pud.y, Math.round(25 * pk) - 2, Math.max(1, Math.round(12 * pk) - 1), fill);
        g.ell(pud.x, by, Math.max(1, Math.round(17 * pk) - 2), Math.max(1, Math.round(15 * pk) - 1), fill);
      }
    });
    ras.draw((g) => {
      for (const sh of shards) {
        if (sh.done >= 0) {
          // the sliver and its twin met: a horizontal mirror glint on the floor line, two steps, then gone
          const k = el - sh.done;
          const x = Math.round(sh.x);
          if (k < 60) {
            g.px(x - 1, sh.meet, PAL.white);
            g.px(x, sh.meet, PAL.white);
            g.px(x + 1, sh.meet, PAL.white);
            g.px(x - 2, sh.meet, PAL.water4);
            g.px(x + 2, sh.meet, PAL.water4);
          } else if (k < 130) {
            g.px(x, sh.meet, PAL.water4);
            g.px(x - 1, sh.meet, PAL.water3);
            g.px(x + 1, sh.meet, PAL.water3);
          }
          continue;
        }
        if (el < 30) continue;
        sh.vy += 440 * s;
        sh.vx *= 1 - 1.4 * s;
        sh.x += sh.vx * s;
        sh.y += sh.vy * s;
        if (sh.y >= sh.meet - 1) {
          sh.y = sh.meet;
          sh.done = el;
          continue;
        }
        const x = Math.round(sh.x);
        const y = Math.round(sh.y);
        const m = SLIVERS[sh.m];
        sliver(g, x, y, m, false, PAL.ink, sh.lit, sh.body);
        // its twin under the floor line, rising as the sliver falls
        sliver(g, x, mirrorY(y, sh.meet), m, true, PAL.night0, PAL.water3, PAL.water2);
      }
    });
  }).then(() => {
    ras.destroy();
    floor.destroy();
  });
}

// ================================================================ position: the mirror pane

/**
 * The guard's mirror pane forms in front of the archer (position change to defense): a vertical pane of glass
 * light 3 px wide builds from its middle out (whole-px rows), a diagonal shimmer runs down it, and under the floor
 * line its dark-blue mirrored twin builds a step later; then both go out in two stepped tones.
 */
export function paneFlash(sc: Phaser.Scene, at: XY, ground: number, dir: 1 | -1, ms = 320): Promise<void> {
  const H2 = 11;
  const gy = Math.round(ground);
  const ras = new Raster(sc, at.x - 8, at.y - H2 - 4, 17, gy - at.y + H2 + 40, DEPTH.FX - 1);
  const x0 = Math.round(at.x);
  const cy = Math.round(at.y);
  return animate(sc, ms, (t) => {
    ras.draw((g) => {
      const grow = Math.min(1, t / 0.35);
      const out = t < 0.7 ? 0 : t < 0.85 ? 1 : 2;
      const h = Math.round(H2 * grow);
      const shim = Math.floor(t * 14);
      for (let dy = -h; dy <= h; dy++) {
        const y = cy + dy;
        for (let k = 0; k < 3; k++) {
          const x = x0 + dir * (k - 1);
          const band = (((k + dy + shim) % 5) + 5) % 5;
          let c: number = band === 0 ? PAL.white : band < 3 ? PAL.water4 : PAL.mist;
          if (out === 1) c = band === 0 ? PAL.water4 : PAL.steel;
          if (out === 2) { if ((dy + k) % 2) continue; c = PAL.steel; }
          g.px(x, y, c);
        }
        // the pane's lit edge toward the foe
        if (out < 2) g.px(x0 + dir * 2, y, PAL.white);
      }
      // the twin under the floor line, a step behind
      const tg = Math.max(0, Math.min(1, (t - 0.1) / 0.35));
      const hm = Math.round(H2 * tg * KR);
      const my = mirrorY(cy, gy);
      for (let dy = -hm; dy <= hm; dy++) {
        if (out === 2 && dy % 2) continue;
        for (let k = 0; k < 3; k++) g.px(x0 + dir * (k - 1), my + dy, k === 1 ? PAL.water3 : out ? PAL.water1 : PAL.water2);
      }
      // where pane and twin meet the floor: the horizontal mirror glint
      if (t > 0.3 && t < 0.75) for (let dx = -4; dx <= 4; dx++) g.px(x0 + dx, gy, Math.abs(dx) < 2 ? PAL.white : PAL.water4);
    });
  }).then(() => ras.destroy());
}
