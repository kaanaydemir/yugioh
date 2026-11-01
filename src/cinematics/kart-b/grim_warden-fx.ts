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
import { stepsAt } from '../../view/light/stepped';
import { topAt } from '../../still/arena';

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
  /** The target is dying: when its body is handed to the shared break, the fade lingers and knocks out (no re-light). */
  dying(): void;
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
  let dying = false;
  let shown = false;
  let lingerAt = -1;
  let lingerStep = -1;
  let lastPx: [number, number, number][] = [];
  const stop = onFrame(scene, (dt) => {
    if (!alive) return false;
    el += dt;
    const s = u.sprite;
    // critic pass-3 r2: a DYING target's body is handed to the shared break (a facet copy of its plain frame) — the
    // fade lingers on the last frame it darkened and knocks out in bayer steps over ≈ 200 ms as the pieces fly, so
    // the drained body never flashes back to full brightness
    if (lingerAt >= 0 || (dying && shown && (u.retired || !s.active || !s.visible))) {
      if (lingerAt < 0) {
        lingerAt = el;
        // above the break's facet copy (vfx/shatter draws it at the sprite's depth + 0.5)
        r.img.setDepth(r.img.depth + 0.6);
      }
      const k = (el - lingerAt) / 200;
      if (k >= 1) {
        destroy();
        return false;
      }
      const step = Math.floor(k * 4) / 4;
      if (step !== lingerStep) {
        lingerStep = step;
        r.img.setVisible(true).setAlpha(1);
        r.draw((g) => {
          for (const [x, y, c] of lastPx) if (bayer(x, y) >= step) g.pc.set(x, y, c);
        });
      }
      return true;
    }
    if (u.retired || !s.active) {
      destroy();
      return false;
    }
    r.img.setDepth(s.depth + 0.05);
    // critic pass-3 r2: the fade now rides into the target's DEATH (it is no longer dropped on v3:dying) — it follows
    // the death pose frame by frame, steps out with the sprite's own alpha and hides under a white contact flash
    r.img.setAlpha(s.alpha);
    r.img.setVisible(s.visible && s.alpha > 0 && !s.tintFill && (level > 0 || rimK > 0));
    shown = s.visible && level > 0;
    if (s.tintFill) return true;
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
    // critic r2: the drain darkens from the OUTLINE inward (the soul is pulled out through the skin), never as a
    // uniform checker: distance (px, 4-neighbour) of every body pixel to the silhouette's edge
    const dist = new Uint8Array(fp.w * fp.h).fill(255);
    const q: number[] = [];
    for (let y = 0; y < fp.h; y++)
      for (let x = 0; x < fp.w; x++) {
        if (!op(x, y)) continue;
        if (!op(x - 1, y) || !op(x + 1, y) || !op(x, y - 1) || !op(x, y + 1)) {
          dist[y * fp.w + x] = 0;
          q.push(y * fp.w + x);
        }
      }
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi];
      const d = dist[i];
      if (d >= 12) continue;
      const x = i % fp.w;
      const y = (i / fp.w) | 0;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) {
        if (!op(nx, ny)) continue;
        const j = ny * fp.w + nx;
        if (dist[j] > d + 1) {
          dist[j] = d + 1;
          q.push(j);
        }
      }
    }
    // level 0.3 (the spec's 30 %) = a 7-px band one tone darker, its outer 3 px two tones; the inner edge dithers
    const deep = level * 24;
    const px: [number, number, number][] = [];
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
          if (deep <= 0) continue;
          const d = dist[y * fp.w + x];
          if (d > deep + 1) continue;
          if (d > deep && bayer(lx, y) >= 0.5) continue;
          const d1 = darker(c0);
          if (d1 === null) continue;
          const c = d <= deep * 0.4 ? (darker(d1) ?? d1) : d1;
          g.pc.set(lx, y, c);
          px.push([lx, y, c]);
        }
    });
    lastPx = px;
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
    dying() {
      dying = true;
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
    const span = Math.max(14, Math.abs(A.x - B.x));
    // critic pass-3 r2: an ADJACENT target (most battles) made a small constant hoop — a minimum arc height (the
    // closer the pair, the higher the arc climbs) and a side bulge out past the target keep it a long drawn soul
    const top = Math.min(A.y, B.y) - lift - Math.max(0, 70 - span) * 0.3;
    // critic r2: the arc rises straight up out of the target, crosses ABOVE the warden's raised lantern and dives into
    // it from behind / above (the light is visibly pulled across, away from the target, into the warden's hand)
    // critic pass-3 r1: the foot leaves the target body steeply (clear of a same-hued body sooner)
    const p1 = { x: A.x + away * Math.max(6, Math.min(14, (80 - span) * 0.2)), y: top - 14 };
    const p2 = { x: B.x - away * Math.max(16, span * 0.35), y: top - 2 };
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
      // critic pass-3 r1: a fatter ink sheath (2 px each side) so a FIRE arc over the wolf's flames / a LIGHT arc over
      // the white wyrm still reads as a separate band
      // critic pass-3 r2: the band TAPERS from the target (fat: the soul torn out) to the lantern (thin: drawn in)
      const taper = (i: number) => 1 - i / n;
      if (mid) for (let i = 0; i <= m; i++) g.disc(pts[i].x, pts[i].y, (strong ? 2.2 : 1.6) + taper(i) * 1.2, PAL.ink);
      for (let i = 0; i <= m; i++) {
        if (mid) g.disc(pts[i].x, pts[i].y, (strong ? 0.7 : 0.5) + taper(i) * (strong ? 1 : 0.5), strong ? ramp[3] : ramp[2]);
        else g.px(pts[i].x, pts[i].y, ramp[2]);
      }
      if (strong)
        for (let i = 0; i < m; i++) {
          // the hot core: ramp[4], with white dashes running toward the lantern (separates it from a same-hued body)
          const hot = ((i - Math.floor(el / 28) * st.flow) & 7) < 3;
          g.line(pts[i].x, pts[i].y - 1, pts[i + 1].x, pts[i + 1].y - 1, hot ? PAL.white : ramp[4]);
          if (hot) g.px(pts[i].x, pts[i].y, ramp[4]);
        }
      // ---- the head: where the thread is drawn out to, a hot spark
      if (st.reach < 1) {
        const h = pts[m];
        g.disc(h.x, h.y, 2, ramp[4]);
        g.px(h.x, h.y, PAL.white);
      }
      // ---- the soul beads: fat 3×3 souls flowing along it (into the lantern, or back on the give-back)
      if (mid) {
        // critic pass-3 r2: the beads ACCELERATE toward the lantern (they dawdle out of the body, then are sucked in)
        // and shrink as they go — the direction of the flow reads even on a short arc
        const sp = 0.0011 * st.flow;
        for (let k = 0; k < 6; k++) {
          const ph = (((k / 6 + el * sp) % 1) + 1) % 1;
          const t = ph * ph;
          if (t > st.reach) continue;
          const p = bez(t);
          if (t < 0.55) {
            g.rect(p.x - 1, p.y - 1, 3, 3, ramp[3]);
            g.px(p.x, p.y - 1, ramp[4]);
            g.px(p.x - 1, p.y, ramp[4]);
            g.px(p.x + 1, p.y, ramp[4]);
            g.px(p.x, p.y + 1, ramp[4]);
            g.px(p.x, p.y, PAL.white);
          } else {
            // a streak: the bead stretched along the arc as it is pulled in
            const q = bez(Math.max(0, t - 0.06 * st.flow));
            g.line(q.x, q.y, p.x, p.y, ramp[4]);
            g.px(p.x, p.y, PAL.white);
          }
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
    let x = Math.round(Math.cos(a) * 1.5);
    let y = 1;
    const pts: XY[] = [{ x, y }];
    const forkAt = 2 + Math.floor(rnd() * 2);
    for (let k = 0; k < 5; k++) {
      // critic pass-3 r2: jagged, irregular cracks (they read as a turtle shell's even seams) — a sharp zigzag
      a += (rnd() - 0.5) * 1.4 + (k % 2 ? 0.45 : -0.45);
      x += Math.cos(a) * rx * (0.12 + rnd() * 0.14);
      // critic r2: the cracks run DOWN the dome's slopes (never along the crown, where they read as a green lid)
      y += Math.abs(Math.sin(a)) * rx * 0.1 + 0.9;
      pts.push({ x, y });
      if (k === forkAt) {
        let fa = a + (rnd() < 0.5 ? 0.9 : -0.9);
        let fx = x;
        let fy = y;
        const fp: XY[] = [{ x: fx, y: fy }];
        for (let j = 0; j < 3; j++) {
          fa += (rnd() - 0.5) * 0.6;
          fx += Math.cos(fa) * rx * 0.14;
          fy += Math.abs(Math.sin(fa)) * rx * 0.08 + 0.8;
          fp.push({ x: fx, y: fy });
        }
        cracks.push({ pts: fp, trunk: false });
      }
    }
    cracks.push({ pts, trunk: true });
  }
  const clods = Array.from({ length: 16 }, () => ({ a: rnd() * TAU, d: 0.55 + rnd() * 0.6, c: rnd() < 0.5 ? E[1] : E[2], big: rnd() < 0.35 }));
  const pebbles = Array.from({ length: 7 }, () => ({ u: rnd() * 1.4 - 0.7, v: rnd() * 0.8 - 0.3 }));
  /** Clods popping off the heaving skin (offsets from the crown, whole-pixel ballistic hops). */
  const hops: { x: number; y: number; vx: number; vy: number; t: number; c: number }[] = [];
  let spit = 0;
  let alive = true;
  let el = 0;
  const stop = onFrame(scene, (dt) => {
    if (!alive) return false;
    el += dt;
    if (st.burst > 0) r.img.setDepth(floorDepth);
    // critic pass-3 r2: the mound never holds still once the light seeps — the soil HEAVES on uneven beats (the dome
    // jolts up a pixel and shivers sideways), clods pop off its skin, and the cracks' light pulses outward in waves
    const seeping = st.seep > 0 && st.burst <= 0;
    const beat = Math.floor(el / 75);
    const heave = seeping ? [0, 1, 0, 0, 1, 2, 0, 1][beat % 8] : 0;
    const jit = seeping ? [0, 1, 0, -1, 0, 0, 1, -1][(beat * 5) % 8] : 0;
    if (seeping) {
      spit += dt;
      while (spit > 95) {
        spit -= 95;
        const a = rnd() * TAU;
        hops.push({ x: Math.cos(a) * rx * 0.6, y: Math.sin(a) * rx * 0.2, vx: Math.cos(a) * (8 + rnd() * 14), vy: -(28 + rnd() * 26), t: 0, c: rnd() < 0.5 ? E[2] : E[1] });
      }
    }
    for (const h of hops) {
      h.t += dt / 1000;
    }
    while (hops.length && hops[0].t > 0.42) hops.shift();
    r.draw((g) => {
      const cx = at.x + jit;
      const cy = at.y;
      const bk = st.burst;
      const H = Math.round(9 * st.swell * (1 - bk)) + heave;
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
              // critic r2: only the crack lines glow (1 px; no second band under them — that read as a green lid):
              // void0 where the light has not reached yet, leaf3 where it has, leaf4 pulses running out of the crown
              const lit = k <= Math.ceil(cr.pts.length * Math.min(1, st.seep * 1.4));
              // the light pulses OUT along the cracks in waves (from the crown down the branches), on whole beats
              const hot = lit && ((k - Math.floor(el / 90)) % 4 === 0 || (cr.trunk && heave === 2)) && st.seep > 0.3;
              g.line(x0, y0, x1, y1, !lit ? PAL.void0 : hot ? (pulse > 0.5 ? PAL.leaf4 : PAL.leaf3) : PAL.leaf3);
              // the light spills from the crack's mouth: a mote or two hovering just above its open end
              if (lit && k === cr.pts.length - 1 && st.seep > 0.5 && ((Math.floor(el / 90) + k) & 1)) g.px(x1, y1 - 1 - (Math.floor(el / 140) % 2), PAL.leaf2);
            }
          }
        }
        for (const h of hops) {
          const x = Math.round(cx + h.x + h.vx * h.t);
          const y = Math.round(crownY + 2 + h.y + h.vy * h.t + 160 * h.t * h.t);
          g.px(x, y, h.c);
          g.px(x + 1, y, E[0]);
          if (h.t < 0.12) g.px(x, y - 1, E[3]);
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

/** The headstone (10×16, critic r2: taller and lighter so it reads at 1×): a rounded slab, carved cross, stone4 lit left edge, stone3 face, stone2 / stone1 shade, ink. */
const STONE_UP = [
  // critic pass-3 r1: ≥ 12×18 with a CARVED top — a round arch with a shoulder step, a sunk cross, a crack line
  '....#####....',
  '..##44443##..',
  '.#444444333#.',
  '#44444c43332#',
  '#4444ccc3332#',
  '#44444c43332#',
  '#44444c43322#',
  '#44444c43322#',
  '##4444443322#',
  '#c###444333##',
  '#44444#43322#',
  '#444443#3322#',
  '#44443333#22#',
  '#44433333#22#',
  '#43333332#21#',
  '#4333322#221#',
  '#33332222#11#',
  '#33322222111#',
  '#32222211111#',
  '#############',
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
const STONE_ROT = [rotMap(STONE_UP, 18), rotMap(STONE_UP, 42), rotMap(STONE_UP, 66), rotMap(STONE_UP, 90, 0.6)];
const STONE_FLAT = STONE_ROT[3];
/** The fallen stone CRACKED in two: the flat map split at its middle column (the two halves drawn apart). */
const SPLIT = Math.floor(STONE_FLAT[0].length * 0.55);
const recut = (rows: string[]): string[] =>
  rows.map((r, y) => r.split('').map((ch, x) => (ch !== '.' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (rows[y + dy]?.[x + dx] ?? '.') === '.') ? '#' : ch)).join(''));
const HALF_A = recut(STONE_FLAT.map((r) => r.slice(0, SPLIT)));
const HALF_B = recut(STONE_FLAT.map((r) => r.slice(SPLIT)));

/** Ms of the headstone's flight (shoved off the mound → lands beyond the rim). */
export const STONE_FLIGHT_MS = 230;

/**
 * The headstone at floor point `at` (`dir` = the side it falls toward). Rises out of the mound (rise 0…1), can be
 * flung up out of it (rise > 1), is shoved over (pose 1: it FLIES — a ≥ 12-px arc while it tips through 18° / 42° /
 * 66° — critic pass-3 r1: it used to jump to a tipped pose and lie as a grey bar) and lands (pose 2): it CRACKS in two,
 * the halves knock apart and sink into the soil.
 */
export function gravestone(scene: Phaser.Scene, at: XY, dir: 1 | -1, depth: number): Gravestone {
  const r = Raster.around(scene, at.x + dir * 14, at.y - 18, 110, 60, depth);
  const S = RAMPS.stone;
  const st: Gravestone = { rise: 0, pose: 0, front: () => r.img.setDepth(depth + 1.2), destroy };
  let alive = true;
  let lastPose = 0;
  let el = 0;
  const col = (ch: string): number | null =>
    ch === '#' ? PAL.ink : ch === '4' ? S[4] : ch === '3' ? S[3] : ch === '2' ? S[2] : ch === '1' ? S[1] : ch === 'c' ? S[1] : null;
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
  const W0 = STONE_UP[0].length;
  const stop = onFrame(scene, (dt) => {
    if (!alive) return false;
    if (st.pose !== lastPose) {
      lastPose = st.pose;
      el = 0;
    }
    el += dt;
    r.draw((g) => {
      if (st.pose === 0) {
        const up = Math.max(0, st.rise - 1) * 16;
        const hgt = Math.round(STONE_UP.length * Math.min(1, st.rise));
        if (hgt <= 0) return;
        stamp(g, STONE_UP, at.x - (W0 >> 1), Math.round(at.y - hgt - up), at.y - 1);
      } else if (st.pose === 1) {
        // the flight: an arc 14 px high, tipping as it goes (the map's bottom-centre rides the arc)
        const k = Math.min(1, el / STONE_FLIGHT_MS);
        const m = STONE_ROT[Math.min(2, Math.floor(k * 3))];
        const bx = at.x + dir * Math.round(4 + 20 * k);
        const by = Math.round(at.y - 2 - 14 * Math.sin(Math.PI * Math.min(1, k * 1.1)) + 6 * k);
        const mw = m[0].length;
        stamp(g, m, bx - (mw >> 1), by - m.length, at.y + 10);
      } else {
        // landed: cracked in two, the halves knocked 2 px apart (the outer one bounces once), then sinking into the soil
        const sink = Math.max(0, Math.floor((el - 260) / 70));
        const bounce = el < 70 ? 2 : el < 130 ? 1 : 0;
        const fw = STONE_FLAT[0].length;
        const x0 = at.x + dir * 24 - (fw >> 1);
        const y0 = at.y + 6 - STONE_FLAT.length + sink;
        const clip = at.y + 6;
        const ax = dir === 1 ? x0 : x0 + fw - HALF_A[0].length;
        const bxx = dir === 1 ? x0 + SPLIT + 2 : x0 - 2;
        stamp(g, HALF_A, ax - dir, y0, clip);
        stamp(g, HALF_B, bxx + dir, y0 - bounce, clip);
        if (sink > STONE_FLAT.length) destroy();
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

// ================================================================ the skull mist (death)

/** 15×16 skull of soul vapour (critic r2: the 11×11 one read as a lollipop / smiley at 1×): a domed cranium lit top-left,
 *  two LARGE dark sockets, a nose notch, an upper tooth row, and a separate jaw (rows ≥ JAW) that drops on the wail. */
const SKULL = [
  '....#######....',
  '..##4443333##..',
  '.#44333333332#.',
  '#4433333333322#',
  '#43333333333322',
  '#33ooo333ooo32#',
  '#3ooooo3ooooo2#',
  '#3ooooo3ooooo2#',
  '#33ooo323ooo22#',
  '.#33333n33332#.',
  '..#333nnn332#..',
  '...#3333332#...',
  '...#t3t3t3t#...',
  '....#3t3t3#....',
  '....#33332#....',
  '.....#####.....',
];
const JAW = 13;
/** Skull cells touching a socket / the nose (lit ramp[3]: the fire in the sockets catches their rims). */
const SOCKET_RIM: boolean[][] = SKULL.map((row, y) =>
  row.split('').map((ch, x) => ch !== 'o' && ch !== 'n' && ch !== '#' && ch !== '.' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => 'on'.includes(SKULL[y + dy]?.[x + dx] ?? '.'))),
);

export interface SkullMist {
  /** 0..1: the skull comes apart (bayer knock-out of its pixels, the fringe first). */
  gone: number;
  /** ≥ 1: vertical stretch as it is torn upward (rows repeat on whole pixels). */
  stretch: number;
  /** 0..1: the jaw drops open (the wail's peak). */
  open: number;
  pos: XY;
  /** Kept for the caller (the tail no longer reaches the floor). */
  root: XY;
  destroy(): void;
}

/**
 * The soul fire leaving as a skull-shaped MIST: a solid two-band cranium of light (ramp[4] brow while young, ramp[3] body,
 * ramp[2] shade, ramp[1] fringe) with DARK sockets / nose / tooth gaps (ink, hot ramp[4] points deep in the sockets), a
 * jaw that hangs, wobbles and drops wide on the wail (`open`), and a short curling ghost tail of vapour under the jaw
 * (critic r2: no straight stem down to the floor). It stretches upward and comes apart in bayer steps as `gone` rises.
 */
export function skullMist(scene: Phaser.Scene, at: XY, ramp: Ramp, depth: number): SkullMist {
  const r = Raster.around(scene, at.x, at.y - 24, 90, 120, depth);
  const st: SkullMist = { gone: 0, stretch: 1, open: 0, pos: { ...at }, root: { ...at }, destroy };
  let alive = true;
  let el = 0;
  const stop = onFrame(scene, (dt) => {
    if (!alive) return false;
    el += dt;
    r.draw((g) => {
      const cx = Math.round(st.pos.x);
      const y0 = Math.round(st.pos.y) - 8;
      const sh = st.stretch;
      const jaw = Math.round(1 + Math.sin(el * 0.03) * 0.8 + st.open * 3);
      const W = SKULL[0].length;
      // ---- the ghost tail: a short tapering wisp under the jaw that curls side to side
      const ty0 = y0 + Math.round(SKULL.length * sh) + jaw - 1;
      const TL = 8;
      for (let k = 0; k < TL; k++) {
        const u = k / TL;
        const yy = ty0 + k;
        const x = cx + Math.round(Math.sin(el * 0.016 - k * 0.45) * (0.5 + u * 3.5));
        const w = u < 0.25 ? 2 : u < 0.6 ? 1 : 0;
        const lvl = (1 - u) * (0.9 - st.gone);
        for (let xx = -w; xx <= w; xx++) {
          if (bayer(x + xx, yy) >= lvl) continue;
          g.px(x + xx, yy, xx === 0 && u < 0.4 ? PAL.stone1 : PAL.stone0);
        }
      }
      // ---- the skull (rows stretched on whole pixels; the jaw rows dropped by `jaw`)
      for (let y = 0; y < SKULL.length; y++) {
        const row = SKULL[y];
        const dy = y >= JAW ? jaw : 0;
        const ya = y0 + Math.round(y * sh) + dy;
        const yb = y0 + Math.round((y + 1) * sh) + dy;
        for (let yy = ya; yy < Math.max(ya + 1, yb); yy++)
          for (let x = 0; x < W; x++) {
            const ch = row[x];
            if (ch === '.') continue;
            const X = cx - (W >> 1) + x + Math.round(Math.sin(el * 0.02 + y * 0.6) * st.gone * 2.5);
            const b = bayer(X, yy);
            const edge = ch === '#';
            // critic pass-3 r2: the vapour comes apart FROM THE BOTTOM UP as it rises (the jaw thins first, a standing
            // dither under it even before the tear), then the whole body tears in bayer steps
            const rowK = (y + 1) / SKULL.length;
            const lowTear = Math.max(0, rowK - 0.55) * 0.9;
            if (b < st.gone * (edge ? 1.6 : 1.1) * (0.45 + rowK) + lowTear) continue;
            if (edge && b < 0.25) continue; // a soft vapour fringe, never a hard rim
            let c: number;
            // critic pass-3 r2: VOID / STONE vapour (the leaf-green body still read as an emoji at 1×): the body is cold
            // grave-mist stone, the soul's colour only on the socket rims, the brow flash and the top fringe; no ink
            // under the jaw (the teeth are gaps of dark stone, not outlined)
            if (ch === 'o' || ch === 'n') c = PAL.ink;
            else if (ch === 't') c = PAL.void0;
            else if (edge) c = y < 4 ? ramp[2] : y < JAW ? PAL.stone1 : PAL.stone0;
            else if (ch === '4') c = el < 120 ? ramp[4] : ramp[3];
            else if (ch === '2') c = PAL.stone0;
            else if (SOCKET_RIM[y]?.[x]) {
              // the fire catches only the socket's UPPER rim (a brow glint); the sides glow faintly, the lower rim is
              // stone (a full green ring read as goggles)
              const below = SKULL[y + 1]?.[x];
              const side = row[x - 1] === 'o' || row[x + 1] === 'o';
              c = below === 'o' || below === 'n' ? ramp[3] : side ? ramp[1] : PAL.stone1;
            } else c = y < 3 ? (x < W / 2 ? PAL.stone3 : PAL.stone2) : b < 0.25 ? PAL.stone1 : y < JAW ? PAL.stone2 : PAL.stone1;
            g.px(X, yy, c);
          }
      }
      // the sockets' fire: a hot 2-px point deep in each, flaring with the wail
      if (st.gone < 0.6) {
        const sy = y0 + Math.round(6 * sh);
        const hot = st.open > 0.4 ? PAL.white : ramp[4];
        for (const sx of [cx - 4, cx + 2]) {
          g.px(sx, sy, hot);
          g.px(sx + 1, sy, ramp[4]);
          g.px(sx, sy + 1, ramp[3]);
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
                // critic pass-3 r1: ONE ash family (cold stone, a rare soul ember) — never multicoloured confetti
                if (b >= prev && (lx + y) % 5 === 0) g.pc.set(lx, y, (lx * 3 + y) % 17 === 0 ? ramp[3] : (lx + y) % 2 ? PAL.stone2 : PAL.stone1);
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

// ================================================================ the lantern's floor light (lighten-only)

export interface FloorGlow {
  /** Retint (the stolen colour). */
  setRamp(r: Ramp): FloorGlow;
  /** 0..1.5, eased over `ms` (scene). */
  setIntensity(k: number, ms?: number): FloorGlow;
  /** Glue it under a moving source (null = hide); `floorY` = the floor line under it. */
  follow(src: () => XY | null, floorY: () => number): FloorGlow;
  fadeOut(ms?: number): Promise<void>;
  destroy(): void;
}

/** The calm floor's colour at a screen pixel for the pool (every matte surface: pads, joins, gaps, bridges — never the
 *  neon zone lines, which stay crisp through the light), memoised. */
const FLOOR = new Map<number, number | null>();
function floorAt(x: number, y: number): number | null {
  const k = y * 4096 + x;
  let v = FLOOR.get(k);
  if (v === undefined) {
    const t = topAt(x, y);
    v = t && t.kind !== 'line' && t.kind !== 'trim' && t.kind !== 'rim' ? t.color : null;
    FLOOR.set(k, v);
  }
  return v;
}
const lumOf = (c: number): number => 0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255);
/** A pad tone lifted `n` steps into the soul's ramp: step 1 is the first ramp tone clearly brighter than the pad. */
function liftTone(base: number, ramp: Ramp, n: number): number {
  const lb = lumOf(base) * 1.4 + 8;
  let i = 0;
  while (i < 4 && lumOf(ramp[i]) < lb) i++;
  return ramp[Math.min(4, i + n - 1)];
}


/**
 * The soul lantern's light on the floor (critic r2 blocker: the shared stepped light maps leaf light on the Neon Tower's
 * graphite slots to leaf0 — an opaque dark-green stain over the grid lines). This light ONLY ADDS bright pixels: a sparse,
 * world-aligned ordered dither of the ramp's light tones (ramp[2] rim, ramp[3] mid, a few ramp[4] in the core), so the slot
 * plate and its neon lines stay visible through it and it reads as light dappling the floor, never as a patch. Flat
 * stamps on whole pixels, the level quantised to eighths (a flicker steps the density, never the shape).
 */
export function floorGlow(scene: Phaser.Scene, o: { x: number; floorY: number; ramp: Ramp; radius: number; intensity?: number; flicker?: boolean; depth?: number }): FloorGlow {
  const rx = Math.max(4, Math.round(o.radius));
  const ry = Math.max(2, Math.round(rx * 0.45));
  const r = Raster.around(scene, o.x, o.floorY, rx * 2 + 4, ry * 2 + 4, o.depth ?? 30.6);
  let ramp = o.ramp;
  let k = o.intensity ?? 1;
  let from = k;
  let to = k;
  let tMs = 0;
  let tEl = 0;
  let src: (() => XY | null) | null = null;
  let fy: () => number = () => o.floorY;
  let pos: XY | null = { x: o.x, y: o.floorY };
  let key = '';
  let el = 0;
  let alive = true;
  let done: (() => void) | null = null;
  const stop = onFrame(scene, (dt) => {
    if (!alive) return false;
    el += dt;
    if (tMs > 0) {
      tEl += dt;
      const t = Math.min(1, tEl / tMs);
      k = from + (to - from) * t;
      if (t >= 1) {
        tMs = 0;
        if (done) {
          const d = done;
          done = null;
          d();
          return false;
        }
      }
    }
    if (src) {
      const p = src();
      pos = p ? { x: Math.round(p.x), y: Math.round(fy()) } : null;
    }
    const fl = o.flicker === false ? 1 : [1, 0.86, 1.08, 0.93, 1.14][Math.floor(el / 90) % 5];
    const lvl = Math.round(Math.max(0, k * fl) * 8) / 8;
    const kk = pos && lvl > 0 ? `${pos.x},${pos.y},${lvl},${ramp[3]}` : 'off';
    if (kk === key) return true;
    key = kk;
    if (!pos || lvl <= 0) {
      r.img.setVisible(false);
      return true;
    }
    r.img.setVisible(true);
    r.moveTo(pos.x - rx - 2, pos.y - ry - 2);
    const cx = pos.x;
    const cy = pos.y;
    r.draw((g) => {
      // critic pass-3 r1: the sparse bright dither read as dot noise / grass. Now a STEPPED POOL in the v3 light
      // language: only the matte pad pixels (padColorAt — never the neon zone lines, which stay crisp through it) move
      // one tone toward the soul's ramp on the rim, two in the core (inner 50 %); a level under a whole step is a 2×2
      // world-aligned Bayer, so a dim pool or a fade is a flat checker of ONE lifted tone, never scattered dots.
      // levels stay low (a full 1-step lift over the whole ellipse read as a stain): the core reaches one solid step only
      // at full strength (two in a flash), the rim is a ≤ 75 % checker, the fringe ≤ 37 %
      const lv = Math.min(2, lvl * 0.8);
      const rim = Math.min(0.75, lv * 0.6);
      for (let y = cy - ry; y <= cy + ry; y++)
        for (let x = cx - rx; x <= cx + rx; x++) {
          const ux = (x + 0.5 - cx) / rx;
          const uy = (y + 0.5 - cy) / ry;
          const d = ux * ux + uy * uy;
          if (d > 1) continue;
          const base = floorAt(x, y);
          if (base === null) continue;
          const level = d < 0.22 ? lv : d < 0.6 ? rim : rim * 0.5;
          const n = stepsAt(Math.round(level * 4) / 4, x, y);
          if (n <= 0) continue;
          g.px(x, y, liftTone(base, ramp, n));
        }
    });
    return true;
  }, () => r.destroy());
  const h: FloorGlow = {
    setRamp(nr) {
      ramp = nr;
      return h;
    },
    setIntensity(v, ms = 0) {
      if (ms <= 0) {
        k = v;
        tMs = 0;
      } else {
        from = k;
        to = v;
        tMs = ms;
        tEl = 0;
      }
      return h;
    },
    follow(s, f) {
      src = s;
      fy = f;
      return h;
    },
    fadeOut(ms = 200) {
      if (!alive) return Promise.resolve();
      return new Promise<void>((res) => {
        from = k;
        to = 0;
        tMs = Math.max(1, ms);
        tEl = 0;
        done = () => {
          h.destroy();
          res();
        };
      });
    },
    destroy() {
      if (!alive) return;
      alive = false;
      stop();
      r.destroy();
    },
  };
  return h;
}

/** A one-shot floor flash in the lighten-only dither: rises in 1 frame, decays over `ms`, an optional ring steps out. */
export function floorFlash(scene: Phaser.Scene, x: number, floorY: number, ramp: Ramp, radius: number, ms: number, k = 1.2): void {
  const g = floorGlow(scene, { x, floorY, ramp, radius, intensity: k, flicker: false });
  void g.fadeOut(ms);
}

// ================================================================ the −400 stat drain mark (not a damage number)

/** 3×5 digits + minus (a tiny local stat mark, never the battle's damage number). */
const DIG: Record<string, string[]> = {
  '-': ['...', '...', '###', '...', '...'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
};

/**
 * "−400" as a STAT mark (critic r2 blocker: the size-2 damage number read as LP damage, hung through the whirl and
 * collided with the real damage number): 3×5 digits in the stolen soul's ramp with an ink case, popping 3 px up off the
 * target's ATK plate, held briefly, then knocked out in two bayer steps — gone in ≈`ms`. A Raster, not a number object.
 */
export function statDrop(scene: Phaser.Scene, at: XY, ramp: Ramp, ms = 460, depth = 1100): Promise<void> {
  const text = '-400';
  const w = text.length * 4 + 1;
  const r = Raster.around(scene, at.x, at.y - 4, w + 4, 16, depth);
  return new Promise<void>((res) => {
    onFrame(scene, (_dt, el) => {
      const t = el / ms;
      const up = el < 50 ? 1 : el < 100 ? 3 : el < 150 ? 4 : 3;
      const gone = t < 0.62 ? 0 : t < 0.8 ? 0.4 : t < 0.95 ? 0.75 : 1;
      const x0 = Math.round(at.x - w / 2);
      const y0 = Math.round(at.y - 3 - up);
      r.draw((g) => {
        if (gone >= 1) return;
        const on = (x: number, y: number) => {
          const ch = text[Math.floor(x / 4)];
          const col = x % 4;
          if (!ch || col > 2 || y < 0 || y > 4) return false;
          return DIG[ch][y][col] === '#';
        };
        for (let y = -1; y <= 5; y++)
          for (let x = -1; x <= w; x++) {
            const X = x0 + x;
            const Y = y0 + y;
            if (gone > 0 && bayer(X, Y) < gone) continue;
            if (on(x, y)) g.px(X, Y, el < 70 ? PAL.white : y <= 1 ? ramp[4] : ramp[3]);
            else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) g.px(X, Y, PAL.ink);
          }
      });
      if (t >= 1) {
        r.destroy();
        res();
        return false;
      }
      return true;
    });
  });
}
