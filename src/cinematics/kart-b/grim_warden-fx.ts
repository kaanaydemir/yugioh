// Hortlak Muhafız (grim_warden) — pixel helpers of its v3 cinematics (./grim_warden.ts). No side effects:
// this module only exports painters and small effect objects (the cinematics glob imports it, KK-9).
//
// Every effect here draws whole pixels in palette tones into a Raster (1-px lines, hard edges, stepped
// dissolves — never alpha fades, never fractional scale / rotation; REHBER EF-7):
//   graveMound     the summon's grave mound on the tile: it swells, cracks, the soul light seeps through
//                  the cracks, then it breaks apart under the rising warden
//   gravestone     the headstone: rises out of the mound, is shoved over and falls flat (3 drawn poses)
//   soulFade       a target's soul drained: a bayer share of its own pixels drops one tone step (≈30 %)
//   lanternTint    the warden's lantern glass and flame recoloured in a stolen soul's ramp (bayer-stepped)
//   soulThread     the drain's thread of soul light: from the target's core to the lantern, beads flowing in
//   skullMist      the death's skull-shaped mist of soul fire, rising and coming apart
//   knockOut       the empty shroud's last 150 ms: its pixels go out in four bayer steps, a few turn to ash

import type Phaser from 'phaser';
import { PAL, RAMPS, type Ramp } from '../../art/palette';
import { shade } from '../../art/pixel';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { XY } from '../../view/layout';
import { framePixels } from '../../vfx/hologram';
import { Raster, bayer } from '../../vfx/setpieces';
import { onFrame } from '../../vfx/combat';

export const TAU = Math.PI * 2;
const PALSET = new Set<number>(Object.values(PAL) as number[]);
const rgb = (d: Uint8ClampedArray, i: number): number => (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];

// ================================================================ sprite pixel access

/** World x of the left edge and y of the top edge of a unit's sprite frame (scale 1, whole pixels). */
function frameOrigin(u: MonsterUnit): { x: number; y: number; w: number; h: number; flip: boolean } {
  const s = u.sprite;
  const w = s.frame.realWidth;
  const h = s.frame.realHeight;
  const flip = s.flipX;
  const p = u.framePoint(flip ? w : 0, 0);
  return { x: Math.round(p.x), y: Math.round(p.y), w, h, flip };
}

/** A palette tone one step darker (null when the colour has no darker palette neighbour). */
function darker(c: number): number | null {
  const d = shade(c, -1);
  return d !== c && PALSET.has(d) ? d : null;
}

// ================================================================ soul fade (the drained target)

export interface SoulFade {
  /** 0..1 share of the body's pixels that step one tone darker (0.3 = the spec's "fades 30 %"). */
  set(level: number): void;
  destroy(): void;
}

/** A target's soul drained: a bayer share of its own pixels (live frame) drop one palette tone step. */
export function soulFade(scene: Phaser.Scene, u: MonsterUnit): SoulFade {
  const r = new Raster(scene, 0, 0, u.art.w + 2, u.art.h + 2, u.sprite.depth + 0.05);
  let level = 0;
  let key = '';
  let alive = true;
  const stop = onFrame(scene, () => {
    if (!alive) return false;
    const s = u.sprite;
    if (u.retired || !s.active) {
      destroy();
      return false;
    }
    r.img.setDepth(s.depth + 0.05);
    r.img.setVisible(s.visible && level > 0);
    if (!s.visible || level <= 0) return true;
    const o = frameOrigin(u);
    r.moveTo(o.x, o.y);
    const k = `${String(s.frame.name)}|${s.texture.key}|${level}`;
    if (k === key) return true;
    key = k;
    const fp = framePixels(s);
    if (!fp) return true;
    r.draw((g) => {
      for (let y = 0; y < fp.h; y++)
        for (let x = 0; x < fp.w; x++) {
          const i = (y * fp.w + x) * 4;
          if (fp.data[i + 3] === 0) continue;
          const lx = o.flip ? fp.w - 1 - x : x;
          if (bayer(lx + 1, y + 2) >= level) continue;
          const c = darker(rgb(fp.data, i));
          if (c !== null) g.pc.set(lx, y, c);
        }
    });
    return true;
  });
  const destroy = () => {
    if (!alive) return;
    alive = false;
    stop();
    r.destroy();
  };
  return {
    set(l) {
      level = Math.max(0, Math.min(1, l));
    },
    destroy,
  };
}

// ================================================================ the lantern in a stolen soul's colour

/** The lantern's light tones (glass, flame, white heart): leaf1 … leaf4, white. */
const LIGHT_TONES = [PAL.leaf1, PAL.leaf2, PAL.leaf3, PAL.leaf4] as const;

export interface LanternTint {
  /** 0..1 share of the lantern's light pixels shown in the stolen ramp (bayer steps). */
  set(k: number): void;
  readonly ramp: Ramp;
  destroy(): void;
}

/**
 * The warden's lantern glass and flame recoloured in `ramp` (the drained target's attribute ramp):
 * every light-tone pixel within the lantern box around points().muzzle of the frame shown is repainted
 * leaf1..leaf4 → ramp[1..4]. A bayer share `k` of them: the colour pours in stepwise.
 */
export function lanternTint(scene: Phaser.Scene, u: MonsterUnit, ramp: Ramp): LanternTint {
  const r = new Raster(scene, 0, 0, u.art.w + 2, u.art.h + 2, u.sprite.depth + 0.06);
  let k = 0;
  let key = '';
  let alive = true;
  const stop = onFrame(scene, () => {
    if (!alive) return false;
    const s = u.sprite;
    if (u.retired || !s.active) {
      destroy();
      return false;
    }
    r.img.setDepth(s.depth + 0.06);
    r.img.setVisible(s.visible && k > 0);
    if (!s.visible || k <= 0) return true;
    const o = frameOrigin(u);
    r.moveTo(o.x, o.y);
    const fi = u.frameInfo();
    const k2 = `${String(s.frame.name)}|${s.texture.key}|${k}`;
    if (k2 === key) return true;
    key = k2;
    const fp = framePixels(s);
    const m = fi.anim && u.art.points ? u.art.points(fi.anim, fi.frame).muzzle : undefined;
    if (!fp || !m) {
      r.draw(() => undefined);
      return true;
    }
    r.draw((g) => {
      const x0 = Math.max(0, m.x - 7);
      const x1 = Math.min(fp.w - 1, m.x + 7);
      const y0 = Math.max(0, m.y - 10);
      const y1 = Math.min(fp.h - 1, m.y + 8);
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const i = (y * fp.w + x) * 4;
          if (fp.data[i + 3] === 0) continue;
          const c = rgb(fp.data, i);
          const t = (LIGHT_TONES as readonly number[]).indexOf(c);
          if (t < 0) continue;
          const lx = o.flip ? fp.w - 1 - x : x;
          if (bayer(lx, y) >= k) continue;
          g.pc.set(lx, y, ramp[t + 1] ?? ramp[4]);
        }
    });
    return true;
  });
  const destroy = () => {
    if (!alive) return;
    alive = false;
    stop();
    r.destroy();
  };
  return {
    ramp,
    set(v) {
      k = Math.max(0, Math.min(1, v));
    },
    destroy,
  };
}

// ================================================================ the soul thread (the drain)

export interface SoulThread {
  /** 0..1: how far the thread has been drawn out of the target toward the lantern. */
  reach: number;
  /** 0..1: the thread's strength (1 full; it thins out in steps to 0). */
  width: number;
  /** Flow direction of the beads: 1 into the lantern (the drain), −1 back into the target (give back). */
  flow: 1 | -1;
  destroy(): void;
}

/** The thread of soul light from `from()` (the target's core) to `to()` (the lantern), in `ramp`. */
export function soulThread(scene: Phaser.Scene, from: () => XY, to: () => XY, ramp: Ramp, depth: number): SoulThread {
  const r = new Raster(scene, 0, 0, 640, 360, depth);
  const st: SoulThread = { reach: 0, width: 1, flow: 1, destroy };
  let alive = true;
  let el = 0;
  const stop = onFrame(scene, (dt) => {
    if (!alive) return false;
    el += dt;
    const a = from();
    const b = to();
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(2, Math.ceil(L));
    // the thread sags up into an arc (the soul is drawn up out of the body and down into the glass)
    const lift = Math.max(12, Math.min(22, L * 0.3));
    const nx = -(b.y - a.y) / Math.max(1, L);
    const ny = (b.x - a.x) / Math.max(1, L);
    const pt = (t: number): XY => {
      const arc = Math.sin(Math.PI * t) * lift;
      // a travelling wiggle along the thread (2 px), damped at both ends
      const wig = Math.sin(t * 9 - el * 0.018) * 1.6 * Math.sin(Math.PI * t);
      return { x: Math.round(a.x + (b.x - a.x) * t + nx * wig), y: Math.round(a.y + (b.y - a.y) * t - arc + ny * wig) };
    };
    r.draw((g) => {
      if (st.reach <= 0 || st.width <= 0) return;
      const m = Math.max(1, Math.round(n * st.reach));
      let prev = pt(0);
      for (let i = 1; i <= m; i++) {
        const p = pt(i / n);
        // the thread: a 1-px body in ramp[3], a shadow line under it, a bright core while strong
        if (st.width > 0.34) g.line(prev.x, prev.y + 1, p.x, p.y + 1, ramp[1]);
        g.line(prev.x, prev.y, p.x, p.y, st.width > 0.67 ? ramp[3] : ramp[2]);
        if (st.width > 0.67) g.line(prev.x, prev.y - 1, p.x, p.y - 1, ramp[4]);
        prev = p;
      }
      // the beads of soul flowing along it (toward the lantern, or back on the give-back)
      if (st.width > 0.34) {
        const sp = 0.0009 * st.flow;
        for (let k = 0; k < 6; k++) {
          let t = (((k / 6 + el * sp) % 1) + 1) % 1;
          if (t > st.reach) continue;
          const p = pt(t);
          const big = k % 2 === 0;
          g.px(p.x, p.y, PAL.white);
          g.px(p.x - 1, p.y, ramp[4]);
          g.px(p.x + 1, p.y, ramp[4]);
          if (big) {
            g.px(p.x, p.y - 1, ramp[4]);
            g.px(p.x, p.y + 1, ramp[3]);
          }
          t += 0;
        }
      }
      // the head: where the thread is drawn out to, a small hot point
      const h = pt(Math.min(1, st.reach));
      if (st.reach < 1) {
        g.px(h.x, h.y, PAL.white);
        g.px(h.x + 1, h.y, ramp[4]);
        g.px(h.x, h.y - 1, ramp[4]);
      }
      // the soul being pulled out of the target: three dots turning round its core (iso)
      if (st.width > 0.34) {
        for (let i = 0; i < 3; i++) {
          const an = el * 0.012 * st.flow + (i * TAU) / 3;
          g.px(Math.round(a.x + Math.cos(an) * 6), Math.round(a.y + Math.sin(an) * 3), i === 0 ? ramp[4] : ramp[3]);
        }
      }
    });
    return true;
  });
  function destroy(): void {
    if (!alive) return;
    alive = false;
    stop();
    r.destroy();
  }
  return st;
}

// ================================================================ the grave mound (summon)

export interface GraveMound {
  /** Mound height 0..1 (it swells). */
  swell: number;
  /** Crack length 0..1. */
  crack: number;
  /** Soul light through the cracks 0..1. */
  seep: number;
  /** 0..1: the mound breaks apart (it flattens into a scatter of soil). */
  burst: number;
  destroy(): void;
}

/** The grave mound on the tile at `at` (floor point). Drawn in front of the rising body's lowest rows. */
export function graveMound(scene: Phaser.Scene, at: XY, rx: number, depth: number, seed: number, floorDepth = depth): GraveMound {
  const W = rx * 2 + 16;
  const r = Raster.around(scene, at.x, at.y - 4, W, 30, depth);
  const E = RAMPS.earth;
  const st: GraveMound = { swell: 0, crack: 0, seep: 0, burst: 0, destroy };
  // five cracks from the crown outward (fixed per mound)
  let s = seed >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const cracks: XY[][] = [];
  for (let i = 0; i < 5; i++) {
    let a = (i / 5) * TAU + rnd() * 0.6;
    let x = 0;
    let y = 0;
    const pts: XY[] = [{ x, y }];
    for (let k = 0; k < 5; k++) {
      a += (rnd() - 0.5) * 0.9;
      x += Math.cos(a) * rx * 0.2;
      y += Math.sin(a) * rx * 0.09;
      pts.push({ x, y });
    }
    cracks.push(pts);
  }
  // soil scatter of the burst (fixed clods)
  const clods = Array.from({ length: 14 }, () => ({ a: rnd() * TAU, d: 0.55 + rnd() * 0.6, c: rnd() < 0.5 ? E[1] : E[2] }));
  let alive = true;
  let el = 0;
  const stop = onFrame(scene, (dt) => {
    if (!alive) return false;
    el += dt;
    // once it bursts the soil lies flat on the floor, under the warden's boots
    if (st.burst > 0) r.img.setDepth(floorDepth);
    r.draw((g) => {
      const cx = at.x;
      const cy = at.y;
      const bk = st.burst;
      const h = Math.round(6 * st.swell * (1 - bk));
      const ry = Math.max(2, Math.round(rx * 0.45));
      // the disturbed soil patch on the floor (stays through the burst)
      g.ell(cx, cy, rx + 2, ry + 1, E[1], 1);
      g.ring(cx, cy, rx + 2, ry + 1, E[0], 1);
      if (bk > 0) {
        // the burst: a scatter of clods round the patch (whole pixels, dark → lit)
        for (const c of clods) {
          const d = rx * c.d * (0.6 + 0.6 * bk);
          const x = Math.round(cx + Math.cos(c.a) * d);
          const y = Math.round(cy + Math.sin(c.a) * d * 0.45);
          g.px(x, y, c.c);
          g.px(x + 1, y, E[0]);
        }
      }
      if (h > 0) {
        // the mound: stacked bands, lit from the top-left (earth3 crown, earth2 body, earth1 lower right)
        for (let k = 0; k <= h; k++) {
          const yy = cy - k;
          const kr = rx * (1 - (k / (h + 2)) * 0.55);
          const kry = Math.max(1, ry * (1 - (k / (h + 2)) * 0.55));
          g.ell(cx, yy, kr, kry, k === h ? E[3] : k > h * 0.5 ? E[2] : E[1], 1);
        }
        // the crown's highlight (top-left) and the outline
        g.ell(cx - Math.round(rx * 0.25), cy - h - 1, Math.max(2, rx * 0.3), Math.max(1, ry * 0.3), E[4], 1);
        g.ring(cx, cy, rx, ry, PAL.ink, 1, 0, Math.PI);
      }
      // the cracks: ink lines over the crown; the soul light seeps through them (leaf3 → leaf4 core)
      if (st.crack > 0 && bk < 0.3) {
        const n = Math.max(1, Math.round(5 * st.crack));
        for (const pts of cracks) {
          for (let k = 1; k <= Math.min(n, pts.length - 1); k++) {
            const a0 = pts[k - 1];
            const a1 = pts[k];
            const x0 = cx + a0.x;
            const y0 = cy - h + a0.y * (1 + bk);
            const x1 = cx + a1.x;
            const y1 = cy - h + a1.y * (1 + bk);
            g.line(x0, y0, x1, y1, st.seep > 0 ? (st.seep > 0.5 && k <= 2 ? PAL.leaf4 : PAL.leaf3) : PAL.void0);
            if (st.seep > 0.3) g.line(x0, y0 - 1, x1, y1 - 1, PAL.leaf2, st.seep);
          }
        }
        // the crown splits: a hot point where the light breaks out
        if (st.seep > 0.6) {
          const flick = Math.floor(el / 70) % 2;
          g.px(cx, cy - h, flick ? PAL.white : PAL.leaf4);
          g.px(cx - 1, cy - h, PAL.leaf4);
          g.px(cx + 1, cy - h, PAL.leaf3);
        }
      }
    });
    return true;
  });
  function destroy(): void {
    if (!alive) return;
    alive = false;
    stop();
    r.destroy();
  }
  return st;
}

// ================================================================ the gravestone (summon)

export interface Gravestone {
  /** Rise out of the mound: 0 (buried) … 1 (standing, 10 px tall). */
  rise: number;
  /** 0 upright, 1 tipping (45°), 2 fallen flat. */
  pose: 0 | 1 | 2;
  destroy(): void;
}

/**
 * The headstone at floor point `at` (`dir` = the side it falls toward: −1 left / +1 right). A small
 * rounded tablet with a carved cross: stone3 lit left edge, stone2 face, stone1 shade, ink outline.
 */
export function gravestone(scene: Phaser.Scene, at: XY, dir: 1 | -1, depth: number): Gravestone {
  const r = Raster.around(scene, at.x, at.y - 8, 40, 30, depth);
  const S = RAMPS.stone;
  const st: Gravestone = { rise: 0, pose: 0, destroy };
  let alive = true;
  const UP = [
    '..####..',
    '.#3222#.',
    '#332221#',
    '#32c221#',
    '#3ccc21#',
    '#32c221#',
    '#32c221#',
    '#322221#',
    '#322211#',
    '#322211#',
    '########',
  ];
  const TILT = [
    '....###...',
    '...#322#..',
    '..#3c221#.',
    '.#3ccc21#.',
    '#332c21#..',
    '#32c221#..',
    '#322211#..',
    '.#22211#..',
    '..####....',
  ];
  const FLAT = [
    '..#########.',
    '.#33322c221#',
    '#3322cccc21#',
    '.#222222c11#',
    '..#########.',
  ];
  const col = (ch: string): number | null =>
    ch === '#' ? PAL.ink : ch === '3' ? S[3] : ch === '2' ? S[2] : ch === '1' ? S[1] : ch === 'c' ? S[1] : null;
  const stamp = (g: Raster, rows: readonly string[], x0: number, y0: number, clipY: number) => {
    for (let y = 0; y < rows.length; y++) {
      if (y0 + y > clipY) continue;
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = dir === 1 ? row[x] : row[row.length - 1 - x];
        const c = col(ch);
        if (c !== null) g.px(x0 + x, y0 + y, c);
      }
    }
  };
  const stop = onFrame(scene, () => {
    if (!alive) return false;
    r.draw((g) => {
      if (st.pose === 0) {
        const hgt = Math.round(UP.length * st.rise);
        if (hgt <= 0) return;
        stamp(g, UP, at.x - 4, at.y - hgt, at.y - 1);
      } else if (st.pose === 1) stamp(g, TILT, at.x - (dir === 1 ? 2 : 7), at.y - TILT.length + 1, at.y);
      else stamp(g, FLAT, at.x - (dir === 1 ? 1 : 10), at.y - 3, at.y + 2);
    });
    return true;
  });
  function destroy(): void {
    if (!alive) return;
    alive = false;
    stop();
    r.destroy();
  }
  return st;
}

// ================================================================ the skull mist (death)

const SKULL = [
  '...#####...',
  '..#44333#..',
  '.#4333322#.',
  '#433333322#',
  '#3oo333oo2#',
  '#3oo323oo2#',
  '#333323332#',
  '.#3332322#.',
  '..#32222#..',
  '..#t2t2t#..',
  '...#####...',
];

export interface SkullMist {
  /** 0..1: the skull comes apart (bayer knock-out of its pixels, the tail first). */
  gone: number;
  pos: XY;
  destroy(): void;
}

/**
 * The soul fire leaving as a skull-shaped mist: an 11×11 skull in `ramp` tones (ramp[4] lit top-left,
 * ramp[3] face, ramp[2] shade, ink sockets and outline), a wisp tail under it swaying.
 */
export function skullMist(scene: Phaser.Scene, at: XY, ramp: Ramp, depth: number): SkullMist {
  const r = Raster.around(scene, at.x, at.y, 60, 90, depth);
  const st: SkullMist = { gone: 0, pos: { ...at }, destroy };
  let alive = true;
  let el = 0;
  const col = (ch: string): number | null =>
    ch === '#' ? ramp[1] : ch === '4' ? ramp[4] : ch === '3' ? ramp[3] : ch === '2' ? ramp[2] : ch === 'o' ? PAL.ink : ch === 't' ? ramp[1] : null;
  const stop = onFrame(scene, (dt) => {
    if (!alive) return false;
    el += dt;
    r.draw((g) => {
      const x0 = Math.round(st.pos.x) - 5;
      const y0 = Math.round(st.pos.y) - 5;
      // the wisp tail: a wavering column of soul fire under the jaw, thinning downward
      for (let k = 0; k < 14; k++) {
        const yy = y0 + 11 + k;
        const sway = Math.round(Math.sin(el * 0.012 + k * 0.5) * (1 + k * 0.15));
        const w = Math.max(0, 3 - Math.floor(k / 4));
        const lvl = 1 - k / 14 - st.gone * 1.6;
        for (let xx = -w; xx <= w; xx++) {
          if (bayer(x0 + 5 + xx + sway, yy) >= lvl) continue;
          g.px(x0 + 5 + xx + sway, yy, xx === -w || xx === w ? ramp[1] : k < 4 ? ramp[3] : ramp[2]);
        }
      }
      // the skull (the jaw drops a pixel every other beat: the wail)
      const jaw = Math.floor(el / 120) % 2;
      for (let y = 0; y < SKULL.length; y++) {
        const row = SKULL[y];
        for (let x = 0; x < row.length; x++) {
          const c = col(row[x]);
          if (c === null) continue;
          if (bayer(x0 + x, y0 + y) < st.gone * 1.15 - (y > 8 ? 0 : 0.15)) continue;
          g.px(x0 + x, y0 + y + (y >= 9 ? jaw : 0), c);
        }
      }
    });
    return true;
  });
  function destroy(): void {
    if (!alive) return;
    alive = false;
    stop();
    r.destroy();
  }
  return st;
}

// ================================================================ the last 150 ms (death)

/**
 * The shown frame of `u` knocked out in `steps` bayer steps over `ms` (top rows a step ahead); the
 * sprite is hidden under it. A few of the knocked-out pixels flare as soul ash (ramp[3]) for one step.
 * Resolves when nothing is left.
 */
export function knockOut(scene: Phaser.Scene, u: MonsterUnit, ramp: Ramp, ms = 150, steps = 4): Promise<void> {
  const s = u.sprite;
  const fp = s.active ? framePixels(s) : null;
  if (!fp) return Promise.resolve();
  const o = frameOrigin(u);
  const r = new Raster(scene, o.x, o.y, fp.w, fp.h, s.depth);
  s.setVisible(false);
  return new Promise<void>((resolve) => {
    let k = -1;
    onFrame(
      scene,
      (_dt, el) => {
        const step = Math.min(steps, Math.floor((el / ms) * steps));
        if (step === k) return el < ms;
        k = step;
        const lvl = step / steps;
        const prev = (step - 1) / steps;
        r.draw((g) => {
          for (let y = 0; y < fp.h; y++)
            for (let x = 0; x < fp.w; x++) {
              const i = (y * fp.w + x) * 4;
              if (fp.data[i + 3] === 0) continue;
              const lx = o.flip ? fp.w - 1 - x : x;
              const b = bayer(lx, y) * 0.85 + (1 - y / fp.h) * 0.15;
              if (b < lvl) {
                // just went out this step: a sparse flare of ash
                if (b >= prev && (lx + y) % 5 === 0) g.pc.set(lx, y, ramp[3]);
                continue;
              }
              g.pc.set(lx, y, rgb(fp.data, i));
            }
        });
        return el < ms;
      },
      () => {
        r.destroy();
        resolve();
      },
    );
  });
}
