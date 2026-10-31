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

/**
 * Keep an overlay raster glued to its unit (position + depth) on POST_UPDATE — after every update of the tick, before
 * the render's depth sort:
 * an overlay synced in an update callback lags a frame behind a sprite that moves / re-sorts later in the same
 * tick (the warden gliding home went under its own lantern tint: critic r1 "green gap"). Returns the unhook.
 */
function glue(scene: Phaser.Scene, u: MonsterUnit, r: Raster, dz: number): () => void {
  const sync = () => {
    const s = u.sprite;
    if (u.retired || !s.active) return;
    r.img.setDepth(s.depth + dz);
    const o = frameOrigin(u);
    r.moveTo(o.x, o.y);
  };
  scene.events.on('postupdate', sync);
  return () => scene.events.off('postupdate', sync);
}

/** A palette tone one step darker (null when the colour has no darker palette neighbour). */
function darker(c: number): number | null {
  const d = shade(c, -1);
  return d !== c && PALSET.has(d) ? d : null;
}

// ================================================================ soul fade (the drained target)

export interface SoulFade {
  /** 0..1: the drain's depth (0.3 = the spec's "fades 30 %"): that share of the body's pixels drops TWO tone steps,
   *  the next equal share one step — unmistakable on a light body too (critic r1). */
  set(level: number): void;
  /** 0..1: a share of the silhouette's top / side edge pixels shows the stolen colour (the soul peeling off). */
  rim(level: number): void;
  destroy(): void;
}

/** A target's soul drained: its own pixels (live frame) step darker in two bayer tiers; its rim peels in `ramp`. */
export function soulFade(scene: Phaser.Scene, u: MonsterUnit, ramp?: Ramp): SoulFade {
  const r = new Raster(scene, 0, 0, u.art.w + 2, u.art.h + 2, u.sprite.depth + 0.05);
  const unglue = glue(scene, u, r, 0.05);
  let level = 0;
  let rimK = 0;
  let key = '';
  let alive = true;
  let el = 0;
  const stop = onFrame(scene, (dt) => {
    if (!alive) return false;
    el += dt;
    const s = u.sprite;
    if (u.retired || !s.active) {
      destroy();
      return false;
    }
    r.img.setDepth(s.depth + 0.05);
    r.img.setVisible(s.visible && (level > 0 || rimK > 0));
    if (!s.visible || (level <= 0 && rimK <= 0)) return true;
    const o = frameOrigin(u);
    r.moveTo(o.x, o.y);
    // the rim crawls (its bayer phase steps every 80 ms: the soul light runs up the outline)
    const ph = Math.floor(el / 80) % 4;
    const k = `${String(s.frame.name)}|${s.texture.key}|${level}|${rimK}|${rimK > 0 ? ph : 0}`;
    if (k === key) return true;
    key = k;
    const fp = framePixels(s);
    if (!fp) return true;
    const op = (x: number, y: number) => x >= 0 && y >= 0 && x < fp.w && y < fp.h && fp.data[(y * fp.w + x) * 4 + 3] !== 0;
    r.draw((g) => {
      for (let y = 0; y < fp.h; y++)
        for (let x = 0; x < fp.w; x++) {
          const i = (y * fp.w + x) * 4;
          if (fp.data[i + 3] === 0) continue;
          const lx = o.flip ? fp.w - 1 - x : x;
          const c0 = rgb(fp.data, i);
          if (ramp && rimK > 0 && c0 !== PAL.ink) {
            const edge = !op(x, y - 1) || !op(x - 1, y) || !op(x + 1, y);
            if (edge && bayer(lx + ph, y + ph * 2) < rimK) {
              g.pc.set(lx, y, (lx + y + ph) % 3 === 0 ? ramp[4] : ramp[3]);
              continue;
            }
          }
          const b = bayer(lx + 1, y + 2);
          if (b >= level * 2) continue;
          const d1 = darker(c0);
          if (d1 === null) continue;
          const c = b < level ? (darker(d1) ?? d1) : d1;
          g.pc.set(lx, y, c);
        }
    });
    return true;
  });
  const destroy = () => {
    if (!alive) return;
    alive = false;
    stop();
    unglue();
    r.destroy();
  };
  return {
    set(l) {
      level = Math.max(0, Math.min(0.5, l));
    },
    rim(l) {
      rimK = Math.max(0, Math.min(1, l));
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
  const unglue = glue(scene, u, r, 0.06);
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
    const pts = fi.anim && u.art.points ? u.art.points(fi.anim, fi.frame) : undefined;
    const hd = pts?.head;
    if (!fp || !pts) {
      r.draw(() => undefined);
      return true;
    }
    // every soul-light pixel of the frame takes the stolen colour (the glass, the flame, the whirl smear, the
    // burst, the motes, the soul bounce on the cloth) — except the warden's own eye inside the cage
    r.draw((g) => {
      for (let y = 0; y < fp.h; y++)
        for (let x = 0; x < fp.w; x++) {
          const i = (y * fp.w + x) * 4;
          if (fp.data[i + 3] === 0) continue;
          const c = rgb(fp.data, i);
          const t = (LIGHT_TONES as readonly number[]).indexOf(c);
          if (t < 0) continue;
          if (hd && x >= hd.x - 5 && x <= hd.x + 5 && y >= hd.y - 4 && y <= hd.y + 4) continue;
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
    unglue();
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
  /** 0..1: how full the lantern is (its halo grows with it). */
  fill: number;
  /** A point of the thread's arc (0 = the target, 1 = the lantern), for lights that follow it. */
  at(t: number): XY;
  destroy(): void;
}

/**
 * The thread of soul light from `from()` (the target's core) to `to()` (the lantern), in `ramp`. The two
 * stand nearly side by side, so the thread is lifted into a TALL ARC over both sprites (apex ≥ `lift` px above
 * the higher end, bulging out past both ends): an ink-sheathed band 3 px wide (ramp[3] body, a ramp[4] core while
 * strong), fat 3×3 soul beads flowing along it, soul wisps torn out of the target's body rising into its foot, and
 * a stepped halo round the lantern that grows as it fills (critic r1: a 1-px thread in the target's own hue over
 * the target was invisible at 1×).
 */
export function soulThread(scene: Phaser.Scene, from: () => XY, to: () => XY, ramp: Ramp, depth: number, lift = 30): SoulThread {
  const r = new Raster(scene, 0, 0, 640, 360, depth);
  let el = 0;
  let A: XY = from();
  let B: XY = to();
  const bez = (t: number): XY => {
    const away = Math.sign(A.x - B.x) || 1;
    const top = Math.min(A.y, B.y) - lift;
    const span = Math.max(14, Math.abs(A.x - B.x));
    const p1 = { x: A.x + away * span * 0.45, y: top - 4 };
    const p2 = { x: B.x - away * span * 0.45, y: top - 4 };
    const u = 1 - t;
    const x = u * u * u * A.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * B.x;
    const y = u * u * u * A.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * B.y;
    // a travelling 1-px shimmer along the arc, damped at both ends
    const wig = Math.sin(t * 11 - el * 0.02) * 1.2 * Math.sin(Math.PI * t);
    return { x: Math.round(x + wig), y: Math.round(y) };
  };
  const st: SoulThread = { reach: 0, width: 1, flow: 1, fill: 0, at: (t) => bez(Math.max(0, Math.min(1, t))), destroy };
  const wisps: { x: number; y: number; t: number; life: number }[] = [];
  let spawn = 0;
  let alive = true;
  const stop = onFrame(scene, (dt) => {
    if (!alive) return false;
    el += dt;
    A = from();
    B = to();
    const n = 64;
    const pts: XY[] = [];
    for (let i = 0; i <= n; i++) pts.push(bez(i / n));
    // the soul wisps torn out of the target's body: they rise from round its core into the thread's foot
    if (st.flow === 1 && st.width > 0.34 && st.reach > 0) {
      spawn += dt;
      while (spawn > 55) {
        spawn -= 55;
        const k = (el * 7 + wisps.length * 13) % 20;
        wisps.push({ x: A.x + (k - 10) * 0.9, y: A.y + ((k * 7) % 11) - 3, t: 0, life: 320 });
      }
    }
    for (const w of wisps) w.t += dt;
    while (wisps.length && wisps[0].t > wisps[0].life) wisps.shift();
    r.draw((g) => {
      // ---- the lantern's halo (light: never outlined), growing with the fill and pulsing
      if (st.fill > 0) {
        const pulse = Math.floor(el / 90) % 2;
        const rad = Math.round(5 + 6 * st.fill) + pulse;
        for (let a = 0; a < 40; a++) {
          const an = (a / 40) * TAU;
          const x = Math.round(B.x + Math.cos(an) * rad);
          const y = Math.round(B.y + Math.sin(an) * rad * 0.85);
          if ((a + pulse) % 2 === 0) g.px(x, y, st.fill > 0.6 ? ramp[4] : ramp[3]);
          else if (st.fill > 0.35) g.px(Math.round(B.x + Math.cos(an) * (rad - 2)), Math.round(B.y + Math.sin(an) * (rad - 2) * 0.85), ramp[2]);
        }
      }
      if (st.reach <= 0 || st.width <= 0) return;
      const m = Math.max(1, Math.round(n * st.reach));
      const strong = st.width > 0.67;
      const mid = st.width > 0.34;
      // ---- the band: ink sheath (separates it from any body behind), ramp body, hot core
      if (mid) for (let i = 0; i <= m; i++) g.disc(pts[i].x, pts[i].y, strong ? 2 : 1.5, PAL.ink);
      for (let i = 0; i <= m; i++) {
        if (mid) g.disc(pts[i].x, pts[i].y, strong ? 1 : 0.6, strong ? ramp[3] : ramp[2]);
        else g.px(pts[i].x, pts[i].y, ramp[2]);
      }
      if (strong) for (let i = 0; i < m; i++) g.line(pts[i].x, pts[i].y - 1, pts[i + 1].x, pts[i + 1].y - 1, ramp[4]);
      // ---- the head: where the thread is drawn out to, a hot spark
      if (st.reach < 1) {
        const h = pts[m];
        g.disc(h.x, h.y, 2, ramp[4]);
        g.px(h.x, h.y, PAL.white);
      }
      // ---- the soul beads: fat 3×3 souls flowing along it (into the lantern, or back on the give-back)
      if (mid) {
        const sp = 0.0011 * st.flow;
        for (let k = 0; k < 5; k++) {
          const t = (((k / 5 + el * sp) % 1) + 1) % 1;
          if (t > st.reach) continue;
          const p = bez(t);
          g.rect(p.x - 1, p.y - 1, 3, 3, ramp[3]);
          g.px(p.x, p.y - 1, ramp[4]);
          g.px(p.x - 1, p.y, ramp[4]);
          g.px(p.x + 1, p.y, ramp[4]);
          g.px(p.x, p.y + 1, ramp[4]);
          g.px(p.x, p.y, PAL.white);
        }
      }
      // ---- the wisps rising out of the body into the foot of the arc
      const foot = bez(0.1);
      for (const w of wisps) {
        const k = w.t / w.life;
        const e = k * k;
        const x = Math.round(w.x + (foot.x - w.x) * e);
        const y = Math.round(w.y + (foot.y - w.y) * e - Math.sin(Math.PI * k) * 3);
        g.px(x, y, k < 0.5 ? ramp[4] : ramp[3]);
        g.px(x + 1, y, ramp[3]);
        g.px(x, y + 1, ramp[2]);
        if (k > 0.2) g.px(x, y + 2, ramp[1]);
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

/**
 * The grave mound on the tile at `at` (floor point; critic r1: the old stacked ellipses read as a brown pie): a
 * domed heap of soil up to 9 px high with a full ink outline, shaded in measured bands lit from the top-left
 * (earth4 crown glint, earth3 lit slope, earth2, earth1 shade, earth0 under the far rim), clods and pebbles on its
 * skin; BRANCHING cracks open from the crown (void0, then soul light: leaf3 with a leaf4 trunk and a white-hot
 * crown split), and it bursts flat into a scatter of clods under the boots.
 */
export function graveMound(scene: Phaser.Scene, at: XY, rx: number, depth: number, seed: number, floorDepth = depth): GraveMound {
  const W = rx * 2 + 20;
  const r = Raster.around(scene, at.x, at.y - 6, W, 36, depth);
  const E = RAMPS.earth;
  const st: GraveMound = { swell: 0, crack: 0, seep: 0, burst: 0, destroy };
  let s = seed >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  // branching cracks from the crown: 5 trunks, each forking once (fixed per mound)
  const cracks: { pts: XY[]; trunk: boolean }[] = [];
  for (let i = 0; i < 5; i++) {
    let a = (i / 5) * TAU + rnd() * 0.6;
    let x = 0;
    let y = 0;
    const pts: XY[] = [{ x, y }];
    const forkAt = 2 + Math.floor(rnd() * 2);
    for (let k = 0; k < 5; k++) {
      a += (rnd() - 0.5) * 0.8;
      x += Math.cos(a) * rx * 0.19;
      y += Math.sin(a) * rx * 0.1;
      pts.push({ x, y });
      if (k === forkAt) {
        let fa = a + (rnd() < 0.5 ? 0.9 : -0.9);
        let fx = x;
        let fy = y;
        const fp: XY[] = [{ x: fx, y: fy }];
        for (let j = 0; j < 3; j++) {
          fa += (rnd() - 0.5) * 0.6;
          fx += Math.cos(fa) * rx * 0.14;
          fy += Math.sin(fa) * rx * 0.08;
          fp.push({ x: fx, y: fy });
        }
        cracks.push({ pts: fp, trunk: false });
      }
    }
    cracks.push({ pts, trunk: true });
  }
  const clods = Array.from({ length: 16 }, () => ({ a: rnd() * TAU, d: 0.55 + rnd() * 0.6, c: rnd() < 0.5 ? E[1] : E[2], big: rnd() < 0.35 }));
  const pebbles = Array.from({ length: 7 }, () => ({ u: rnd() * 1.4 - 0.7, v: rnd() * 0.8 - 0.3 }));
  let alive = true;
  let el = 0;
  const stop = onFrame(scene, (dt) => {
    if (!alive) return false;
    el += dt;
    if (st.burst > 0) r.img.setDepth(floorDepth);
    r.draw((g) => {
      const cx = at.x;
      const cy = at.y;
      const bk = st.burst;
      const H = Math.round(9 * st.swell * (1 - bk));
      const ry = Math.max(2, Math.round(rx * 0.45));
      // the disturbed soil patch on the floor (stays through the burst): earth0 rim, earth1 fill
      g.ell(cx, cy + 1, rx + 3, ry + 2, E[0], 1);
      g.ell(cx, cy, rx + 1, ry + 1, E[1], 1);
      if (bk > 0) {
        for (const c of clods) {
          const d = rx * c.d * (0.6 + 0.7 * bk);
          const x = Math.round(cx + Math.cos(c.a) * d);
          const y = Math.round(cy + Math.sin(c.a) * d * 0.45);
          g.px(x, y, c.c);
          g.px(x + 1, y, E[0]);
          if (c.big) {
            g.px(x, y - 1, E[3]);
            g.px(x + 1, y - 1, c.c);
          }
        }
      }
      let crownY = cy;
      if (H > 0) {
        // the dome: a column profile (height ∝ the ellipse depth), shaded by its slope toward the top-left
        const top = (x: number, y: number): boolean => {
          const u = (x - cx) / rx;
          const v = (y - cy) / ry;
          for (let k = 0; k <= H; k++) {
            const sh = Math.sqrt(Math.max(0, 1 - k / (H + 0.01))) ; // radius shrinks with height
            const uu = u / Math.max(0.05, sh);
            const vv = (v + k / ry) / Math.max(0.05, sh);
            if (uu * uu + vv * vv <= 1) return true;
          }
          return false;
        };
        const x0 = cx - rx - 1;
        const x1 = cx + rx + 1;
        const y0 = cy - H - ry - 1;
        const y1 = cy + ry + 1;
        const inside = new Set<number>();
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (top(x, y)) inside.add(y * 1024 + x);
        crownY = cy - H;
        for (const key of inside) {
          const y = Math.floor(key / 1024);
          const x = key - y * 1024;
          const u = (x - cx) / rx;
          const v = (y - (cy - H * 0.55)) / (ry + H * 0.6);
          const d = -(u * 0.75 + v * 0.85);
          let c = d > 0.55 ? E[4] : d > 0.18 ? E[3] : d > -0.3 ? E[2] : d > -0.75 ? E[1] : E[0];
          if (c === E[4] && (x + y) % 3 !== 0 && d < 0.75) c = E[3];
          g.px(x, y, c);
        }
        // ink silhouette (lower rim sits on the floor patch)
        for (const key of inside) {
          const y = Math.floor(key / 1024);
          const x = key - y * 1024;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
            if (!inside.has((y + dy) * 1024 + x + dx)) g.px(x + dx, y + dy, PAL.ink);
        }
        // pebbles and clods on the skin (lit top-left pixel, dark underside)
        for (const pb of pebbles) {
          const x = Math.round(cx + pb.u * rx * 0.8);
          const y = Math.round(cy - H * (1 - Math.abs(pb.u)) * 0.8 + pb.v * ry);
          if (!inside.has(y * 1024 + x) || !inside.has((y + 1) * 1024 + x + 1)) continue;
          g.px(x, y, E[3]);
          g.px(x + 1, y, E[2]);
          g.px(x, y + 1, E[1]);
          g.px(x + 1, y + 1, E[0]);
        }
      }
      // the cracks: void0 lines over the dome; the soul light seeps through them (leaf3, a leaf4 trunk)
      if (st.crack > 0 && bk < 0.3) {
        const n = Math.max(1, Math.round(5 * st.crack));
        const pulse = 0.5 + 0.5 * Math.sin(el * 0.018);
        for (const cr of cracks) {
          const lim = cr.trunk ? n : Math.max(0, n - 2);
          for (let k = 1; k <= Math.min(lim, cr.pts.length - 1); k++) {
            const a0 = cr.pts[k - 1];
            const a1 = cr.pts[k];
            const x0 = cx + a0.x;
            const y0 = crownY + a0.y + Math.abs(a0.x) * 0.25;
            const x1 = cx + a1.x;
            const y1 = crownY + a1.y + Math.abs(a1.x) * 0.25;
            if (st.seep <= 0) g.line(x0, y0, x1, y1, PAL.void0);
            else {
              const hot = cr.trunk && k <= 2 && st.seep > 0.4;
              g.line(x0, y0, x1, y1, hot ? (pulse > 0.5 ? PAL.leaf4 : PAL.leaf3) : PAL.leaf3);
              if (cr.trunk && st.seep > 0.3) g.line(x0, y0 + 1, x1, y1 + 1, PAL.leaf2);
            }
          }
        }
        if (st.seep > 0.55) {
          const flick = Math.floor(el / 70) % 2;
          g.px(cx, crownY, flick ? PAL.white : PAL.leaf4);
          g.px(cx - 1, crownY, PAL.leaf4);
          g.px(cx + 1, crownY, PAL.leaf4);
          g.px(cx, crownY - 1, PAL.leaf3);
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
  /** Rise out of the mound: 0 (buried) … 1 (standing, 14 px tall); > 1 = flung up out of the soil (px above). */
  rise: number;
  /** 0 upright, 1 tipping (45°, flying), 2 fallen flat. */
  pose: 0 | 1 | 2;
  /** Raise it in front of the mound (once it has toppled off the heap onto the floor). */
  front(): void;
  destroy(): void;
}

/** The headstone (10×14): a rounded slab, carved cross, stone3 lit left edge, stone2 face, stone1 shade, ink. */
const STONE_UP = [
  '...####...',
  '..#3322#..',
  '.#332221#.',
  '#3332c221#',
  '#332cc221#',
  '#3ccccc21#',
  '#332cc221#',
  '#332cc211#',
  '#332cc211#',
  '#33222211#',
  '#33222211#',
  '#32222111#',
  '#22221111#',
  '##########',
];
/** Rotate a stone map (nearest pixel) by `deg` round its bottom-centre; the outline is re-cut afterwards. */
function rotMap(rows: readonly string[], deg: number, squashY = 1): string[] {
  const h = rows.length;
  const w = rows[0].length;
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const pts: { x: number; y: number; ch: string }[] = [];
  const ox = w / 2;
  const oy = h;
  for (let y = -h - 4; y <= h + 4; y++)
    for (let x = -h - 4; x <= h + 4; x++) {
      // inverse rotate the target pixel back into the map
      const ux = (x + 0.5) * c + ((y + 0.5) / squashY) * sn + ox;
      const uy = -(x + 0.5) * sn + ((y + 0.5) / squashY) * c + oy;
      const mx = Math.floor(ux);
      const my = Math.floor(uy);
      if (my < 0 || my >= h || mx < 0 || mx >= w) continue;
      const ch = rows[my][mx];
      if (ch === '.') continue;
      pts.push({ x, y, ch });
    }
  const minX = Math.min(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxX = Math.max(...pts.map((p) => p.x));
  const maxY = Math.max(...pts.map((p) => p.y));
  const grid: string[][] = Array.from({ length: maxY - minY + 1 }, () => Array(maxX - minX + 1).fill('.'));
  for (const p of pts) grid[p.y - minY][p.x - minX] = p.ch === '#' ? '2' : p.ch;
  // re-cut a clean 1-px ink outline round the rotated silhouette
  const out = grid.map((r) => r.slice());
  for (let y = 0; y < grid.length; y++)
    for (let x = 0; x < grid[0].length; x++) {
      if (grid[y][x] === '.') continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (grid[y + dy]?.[x + dx] ?? '.') === '.');
      if (edge) out[y][x] = '#';
    }
  return out.map((r) => r.join(''));
}
const STONE_TILT = rotMap(STONE_UP, 42);
const STONE_FLAT = rotMap(STONE_UP, 90, 0.5);

/**
 * The headstone at floor point `at` (`dir` = the side it falls toward). Rises out of the mound (rise 0…1), can be
 * flung up out of it (rise > 1), is shoved over (pose 1: tipped 42°, in the air) and lands flat (pose 2).
 */
export function gravestone(scene: Phaser.Scene, at: XY, dir: 1 | -1, depth: number): Gravestone {
  const r = Raster.around(scene, at.x, at.y - 12, 90, 44, depth);
  const S = RAMPS.stone;
  const st: Gravestone = { rise: 0, pose: 0, front: () => r.img.setDepth(depth + 1.2), destroy };
  let alive = true;
  const col = (ch: string): number | null =>
    ch === '#' ? PAL.ink : ch === '3' ? S[3] : ch === '2' ? S[2] : ch === '1' ? S[1] : ch === 'c' ? S[0] : null;
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
        const up = Math.max(0, st.rise - 1) * 6;
        const hgt = Math.round(STONE_UP.length * Math.min(1, st.rise));
        if (hgt <= 0) return;
        stamp(g, STONE_UP, at.x - 5, Math.round(at.y - hgt - up), at.y - 1);
      } else if (st.pose === 1) stamp(g, STONE_TILT, at.x + dir * 14 - (dir === 1 ? 3 : STONE_TILT[0].length - 3), at.y - STONE_TILT.length - 4, at.y + 4);
      else stamp(g, STONE_FLAT, at.x + dir * 24 - (dir === 1 ? 1 : STONE_FLAT[0].length - 1), at.y - STONE_FLAT.length + 7, at.y + 10);
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
  /** ≥ 1: vertical stretch as it is torn upward (rows repeat on whole pixels). */
  stretch: number;
  pos: XY;
  /** Where the tail streams from (the broken lantern on the floor). */
  root: XY;
  destroy(): void;
}

/**
 * The soul fire leaving as a skull-shaped MIST (critic r1: the solid 11×11 figure read as a little alien): the skull
 * is a bayer-stepped two-tone vapour (ramp[3] lit top-left, ramp[2] shade, ramp[1] fringe, white-hot brow while
 * young), its sockets and mouth are HOLES in the mist (no ink), the jaw hangs and wobbles (the wail), a streaming
 * tail of vapour runs down to the broken lantern and dissolves from the bottom, and the whole shape stretches upward
 * and breaks apart as `gone` rises. Never outlined; whole pixels; light only.
 */
export function skullMist(scene: Phaser.Scene, at: XY, ramp: Ramp, depth: number): SkullMist {
  const r = Raster.around(scene, at.x, at.y - 20, 80, 110, depth);
  const st: SkullMist = { gone: 0, stretch: 1, pos: { ...at }, root: { ...at }, destroy };
  let alive = true;
  let el = 0;
  const stop = onFrame(scene, (dt) => {
    if (!alive) return false;
    el += dt;
    r.draw((g) => {
      const cx = Math.round(st.pos.x);
      const y0 = Math.round(st.pos.y) - 5;
      const sh = st.stretch;
      const jaw = Math.round(1 + Math.sin(el * 0.03) * 1.2);
      const dens = 0.82 - st.gone * 0.9;
      // ---- the tail: a wavering ribbon of vapour from the jaw down to the root, dissolving from the bottom
      const ty0 = y0 + Math.round(11 * sh) + jaw;
      const ty1 = Math.round(st.root.y);
      const tl = Math.max(0, ty1 - ty0);
      for (let k = 0; k <= tl; k++) {
        const u = tl ? k / tl : 1;
        const yy = ty0 + k;
        const sway = Math.round(Math.sin(el * 0.014 - k * 0.35) * (1 + u * 2.5));
        const x = Math.round(cx + (st.root.x - cx) * u * u) + sway;
        const w = u < 0.3 ? 2 : u < 0.7 ? 1 : 0;
        const lvl = (1 - u * 0.9) * dens - st.gone * 0.4;
        for (let xx = -w; xx <= w; xx++) {
          if (bayer(x + xx, yy) >= lvl) continue;
          g.px(x + xx, yy, xx === 0 && u < 0.5 ? ramp[3] : ramp[2]);
        }
      }
      // ---- the skull of vapour (rows stretched on whole pixels)
      for (let y = 0; y < SKULL.length; y++) {
        const row = SKULL[y];
        const ya = y0 + Math.round(y * sh) + (y >= 9 ? jaw : 0);
        const yb = y0 + Math.round((y + 1) * sh) + (y >= 9 ? jaw : 0);
        for (let yy = ya; yy < Math.max(ya + 1, yb); yy++)
          for (let x = 0; x < row.length; x++) {
            const ch = row[x];
            if (ch === '.' || ch === 'o' || ch === 't') continue; // holes in the mist: sockets, mouth gaps
            const X = cx - 5 + x + Math.round(Math.sin(el * 0.02 + y * 0.6) * st.gone * 2);
            const edge = ch === '#';
            const b = bayer(X, yy);
            // the body holds whole until it tears (two bayer tones = vapour, not a solid figure); the fringe is thin
            const hold = 1 - st.gone * 1.15 - (y > 8 ? 0.15 : 0);
            if (b >= (edge ? hold * 0.6 : hold)) continue;
            const c = ch === '4' ? (el < 160 ? PAL.white : ramp[4]) : edge ? ramp[1] : b < 0.4 && ch === '3' ? ramp[3] : b < 0.2 ? ramp[3] : ramp[2];
            g.px(X, yy, c);
          }
      }
      // the sockets' glow: two hot points deep in the holes while it still holds together
      if (st.gone < 0.5) {
        g.px(cx - 3, y0 + Math.round(5 * sh), ramp[4]);
        g.px(cx + 3, y0 + Math.round(5 * sh), ramp[4]);
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
