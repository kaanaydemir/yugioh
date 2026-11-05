// Bozkır Boynuzlusu — the card's own world-space effects (v3 look only; docs/v3/oturum-c-tasarim.md §2.5). Every piece
// is drawn in whole pixels with palette steps (no alpha, no ADD, no tint): it pops in and steps out.
//
//   GrassPatch   the summon's tile grass: ~40 blades rooted in the tile, rising behind a travelling wave front in three
//                heights (white seedheads on some), bent by the gust, flattened outward in a crescent by the landing and
//                springing back, then receding in three steps. No floor tint (EF-6: leaf light on the night floor turns
//                to mud) — only the blades.
//   wakeFan      a take-off: 4–6 blades spring out of the floor behind the hooves, bend away, spring back, shrink (3 steps)
//   dustTick     a 2-px earth tick where the hoof tips land
//   hornCurl     a two-turn 1-px spiral curl that peels off a horn tip and trails back (leaf4 → leaf3 → leaf2 → gone)
//   SeedCloud    the feather-grass seed burst (an earth3 shaft + a white / mist plume in two spin states): up and out,
//                then a slow glide drifting away from the attacker (≥ 900 ms), landing, blinking out in steps; a few
//                catch a 1-px gold4 glint that steps out
//   seedStream   the death: seeds and 2-px blades carried on leeward from the wind-blown mound, climbing on a curve
//   plumes       the death: the horns, last, as two long seed plumes lifting and drifting away
// Never rings (§0.4.1), never leaves, feathers, ash or pollen.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { TILE_H, TILE_W, unitDepth, type XY } from '../../view/layout';
import { Px, onFrame } from '../../vfx/combat';

const R = Math.round;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Deterministic per-moment random (films and measures stay repeatable). */
export function rng(seed: number): () => number {
  let s = (Math.imul(seed | 0, 2654435761) ^ 0x5a1ca) >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function layer(sc: Phaser.Scene, depth: number): Px {
  return new Px(sc.add.graphics().setDepth(depth));
}

/** One rooted blade: base leaf2, body leaf3, lit tip leaf4, an optional white seedhead; bend = tip x offset (px). */
export function drawBlade(px: Px, x: number, y: number, h: number, bend: number, head: boolean): void {
  const n = R(h);
  if (n <= 0) return;
  for (let i = 0; i < n; i++) {
    const k = n > 1 ? (i + 1) / n : 1;
    const xx = R(x + bend * k * k);
    const c = i === 0 && n > 2 ? PAL.leaf2 : i === n - 1 ? PAL.leaf4 : PAL.leaf3;
    px.dot(xx, y - i, c);
  }
  if (head && n >= 3) px.dot(R(x + bend) + (bend > 0.5 ? 1 : bend < -0.5 ? -1 : 0), y - n, PAL.white);
}

// ================================================================ the summon's tile grass

interface Blade {
  x: number;
  y: number;
  h: number;
  head: boolean;
  lean: number;
}

export class GrassPatch {
  private readonly back: Px;
  private readonly front: Px;
  private readonly blades: Blade[] = [];
  private readonly stop: () => void;
  private readonly rx: number;
  /** 0..1: the wave front's travel across the tile (from the entry side). */
  grow = 0;
  /** −1..1: the gust's bend (toward `dir`). */
  gust = 0;
  /** The landing press: 0 none, 1 flattened outward (from `pressAt`), negative = springing back past upright. */
  press = 0;
  pressAt: XY;
  /** 0, 1, 2, 3: receding steps (3 = gone). */
  recede = 0;
  private dead = false;

  constructor(
    readonly scene: Phaser.Scene,
    readonly home: XY,
    /** +1: the gust / wave comes from the left (player 1's entry side), −1 from the right. */
    readonly dir: 1 | -1,
    seed: number,
  ) {
    const rnd = rng(seed);
    this.rx = Math.round(TILE_W * 0.4);
    const ry = Math.round(TILE_H * 0.38);
    this.pressAt = { ...home };
    // tufts on a jittered grid inside the tile's iso diamond: each tuft is a tall centre blade (some with a white
    // seedhead) and two shorter side blades fanning out — clumps with floor between them, never a hatch
    for (let gy = -ry + 2; gy <= ry - 1; gy += 5)
      for (let gx = -this.rx + 3; gx <= this.rx - 2; gx += 8) {
        const jx = gx + (rnd() - 0.5) * 5 + (((gy / 5) & 1) ? 4 : 0);
        const jy = gy + (rnd() - 0.5) * 2;
        const d = Math.abs(jx) / this.rx + Math.abs(jy) / ry;
        if (d > 0.92 || rnd() < 0.12) continue;
        const cx = R(home.x + jx);
        const cy = R(home.y + jy);
        const hc = 3 + Math.round((1 - d) * 3 + rnd() * 1.5);
        this.blades.push({ x: cx, y: cy, h: hc, head: rnd() < 0.45, lean: (rnd() - 0.5) * 0.8 });
        this.blades.push({ x: cx - 1, y: cy, h: Math.max(2, hc - 2), head: false, lean: -1.6 - rnd() });
        if (rnd() < 0.8) this.blades.push({ x: cx + 1, y: cy, h: Math.max(2, hc - 1 - Math.round(rnd())), head: false, lean: 1.4 + rnd() });
      }
    this.blades.sort((a, b) => a.y - b.y);
    // behind the unit for the blades behind its feet, in front of it for the blades in front
    this.back = layer(scene, unitDepth(home.y) - 0.5);
    this.front = layer(scene, unitDepth(home.y) + 0.5);
    this.stop = onFrame(scene, () => {
      if (this.dead) return false;
      this.draw();
      return true;
    });
  }

  private draw(): void {
    this.back.clear();
    this.front.clear();
    const span = this.rx * 2 + 16;
    const fx = this.home.x - this.dir * (this.rx + 8) + this.dir * span * this.grow;
    const rk = [1, 2 / 3, 1 / 3, 0][Math.min(3, this.recede)];
    if (rk <= 0) return;
    for (const b of this.blades) {
      // three heights rise behind the wave front
      const d = (fx - b.x) * this.dir;
      const lvl = d < 0 ? 0 : d < 4 ? 1 / 3 : d < 9 ? 2 / 3 : 1;
      if (lvl <= 0) continue;
      let h = b.h * lvl * rk;
      // the gust bends the blades near the wave front hardest
      let bend = b.lean + this.gust * this.dir * (d < 12 ? 2 : 1);
      // the landing: blades near the hooves flatten outward (a crescent), then spring back past upright
      if (this.press !== 0) {
        const dx = b.x - this.pressAt.x;
        const dy = (b.y - this.pressAt.y) * 2;
        const dist = Math.hypot(dx, dy);
        const near = clamp01(1 - dist / (this.rx * 1.2));
        if (near > 0) {
          const side = dx === 0 ? (b.y >= this.pressAt.y ? 1 : -1) : Math.sign(dx);
          bend += side * this.press * 4 * near;
          if (this.press > 0) h *= 1 - 0.55 * this.press * near;
        }
      }
      drawBlade(b.y >= this.home.y ? this.front : this.back, b.x, b.y, h, bend, b.head && lvl >= 1 && rk >= 1);
    }
  }

  /** Recede in three steps over `ms`, then remove itself. */
  fadeOut(ms: number): void {
    const t0 = { el: 0 };
    onFrame(this.scene, (dt) => {
      if (this.dead) return false;
      t0.el += dt;
      this.recede = Math.min(3, Math.floor((t0.el / ms) * 3) + 1);
      if (this.recede >= 3) {
        this.destroy();
        return false;
      }
      return true;
    });
  }

  /** Seedhead tops of the grown blades (world px), for the seeds that lift off. */
  seedheads(): XY[] {
    return this.blades.filter((b) => b.head).map((b) => ({ x: b.x, y: b.y - Math.round(b.h) - 1 }));
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.stop();
    this.back.g.destroy();
    this.front.g.destroy();
  }
}

// ================================================================ small motifs

/** A take-off grass fan: blades spring out of the floor behind the hooves, bend away (−dir), spring back, shrink. */
export function wakeFan(sc: Phaser.Scene, at: XY, dir: 1 | -1, k: number, seed: number): void {
  const rnd = rng(seed);
  const n = 4 + Math.min(2, Math.round(k * 2));
  const bl = Array.from({ length: n }, (_, i) => ({
    x: R(at.x - dir * (i * 2 - 1) + (rnd() - 0.5) * 2),
    y: R(at.y + (i % 2 ? 1 : 0) - (i === n - 1 ? 1 : 0)),
    h: 4 + Math.round(rnd() * 2 + k * 2),
    head: i === 1 || i === n - 2,
  }));
  const px = layer(sc, unitDepth(at.y) - 0.4);
  // steps (ms, height factor, bend): sprout bent away, bend more, spring back past upright, shrink, gone
  const steps: [number, number, number][] = [
    [60, 0.7, -2.5],
    [70, 1, -3.5],
    [70, 0.85, 1],
    [70, 0.55, 0.3],
    [60, 0.3, 0],
  ];
  let el = 0;
  onFrame(
    sc,
    (dt) => {
      el += dt;
      let acc = 0;
      let s = -1;
      for (let i = 0; i < steps.length; i++) {
        acc += steps[i][0];
        if (el < acc) {
          s = i;
          break;
        }
      }
      px.clear();
      if (s < 0) return false;
      const [, hk, bend] = steps[s];
      for (const b of bl) drawBlade(px, b.x, b.y, b.h * hk, dir * bend * (0.7 + 0.1 * b.h), b.head && s < 3);
      return true;
    },
    () => px.g.destroy(),
  );
}

/** A 2-px earth tick at a hoof-tip landing (two specks hopping apart, popping out). */
export function dustTick(sc: Phaser.Scene, at: XY, dir: 1 | -1): void {
  const px = layer(sc, unitDepth(at.y) + 0.3);
  let el = 0;
  onFrame(
    sc,
    (dt) => {
      el += dt;
      px.clear();
      if (el > 170) return false;
      const k = el / 170;
      const c = k < 0.5 ? PAL.earth3 : PAL.earth2;
      const o = R(2 + k * 5);
      const y = R(at.y - 1 - Math.sin(k * Math.PI) * 2);
      px.rect(at.x - o - 1 - dir, y, 2, 1, c);
      px.rect(at.x + o - dir, y, 2, 1, c);
      return true;
    },
    () => px.g.destroy(),
  );
}

/** Points of a two-turn spiral (radius up to ~3 px), deduplicated whole pixels, from the centre out. */
const SPIRAL: readonly (readonly [number, number])[] = (() => {
  const out: [number, number][] = [];
  const seen = new Set<string>();
  for (let a = 0; a <= Math.PI * 3.2; a += 0.1) {
    const r = 0.3 + (a / (Math.PI * 3.2)) * 2.1;
    const p: [number, number] = [R(Math.cos(a) * r), R(Math.sin(a) * r * 0.85)];
    const k = p.join(',');
    if (!seen.has(k)) {
      seen.add(k);
      out.push(p);
    }
  }
  return out;
})();

/** A two-turn spiral curl peeling off a horn tip, trailing back (−dir) and up; leaf4 → leaf3 → leaf2 → gone. */
export function hornCurl(sc: Phaser.Scene, at: XY, dir: 1 | -1, depth: number): void {
  const px = layer(sc, depth);
  const ms = 330;
  let el = 0;
  onFrame(
    sc,
    (dt) => {
      el += dt;
      px.clear();
      if (el >= ms) return false;
      const k = el / ms;
      const shown = Math.max(2, Math.round(SPIRAL.length * clamp01(k / 0.3)));
      // it peels off the tip, rides off backward and climbs a little; the inner turns go first as it unwinds
      const cx = R(at.x - dir * (2 + k * 9));
      const cy = R(at.y - 2 - k * 3);
      const c = k < 0.4 ? PAL.leaf4 : k < 0.75 ? PAL.leaf3 : PAL.leaf2;
      const from = k > 0.6 ? Math.round(SPIRAL.length * ((k - 0.6) / 0.4)) : 0;
      for (let i = from; i < shown; i++) {
        const [x, y] = SPIRAL[i];
        px.dot(cx - dir * x, cy + y, c);
      }
      return true;
    },
    () => px.g.destroy(),
  );
}

// ================================================================ the seed burst

/** A feather-grass seed: a 2-px earth3 shaft and a plume in one of two drawn spin states, leaning away from `dir`. */
export function drawSeed(px: Px, x: number, y: number, spin: number, dir: number, plume: number = PAL.white): void {
  px.rect(x, y, 1, 2, PAL.earth3);
  if (spin & 1) {
    // lying: the plume streams back along the wind
    px.dot(x - dir, y - 1, plume);
    px.dot(x - dir * 2, y - 1, plume);
    px.dot(x - dir * 2, y - 2, plume);
    px.dot(x - dir * 3, y - 2, plume);
    px.dot(x - dir * 4, y - 2, PAL.mist);
    px.dot(x - dir * 3, y - 1, PAL.mist);
  } else {
    // standing: the plume opens upward like a small brush
    px.dot(x, y - 1, plume);
    px.dot(x - dir, y - 2, plume);
    px.dot(x, y - 2, plume);
    px.dot(x - dir, y - 3, plume);
    px.dot(x - dir * 2, y - 3, PAL.mist);
    px.dot(x + dir, y - 3, PAL.mist);
  }
}

interface Seed {
  x: number;
  y: number;
  vx: number;
  vy: number;
  floor: number;
  spinOff: number;
  sway: number;
  landed: number;
  glint: boolean;
  delay: number;
}

/**
 * The seed burst at the contact point: `n` seeds spray up and out, then glide down slowly (terminal fall ≈ 14 px/s) with
 * a wind drift toward `dir` (away from the attacker) and a sway; they land on the floor around `floorY`, rest a beat
 * and blink out in steps. Their plumes spin (2 drawn states). Lives ≥ `glideMs` after the burst.
 */
export function seedBurst(sc: Phaser.Scene, at: XY, floorY: number, dir: 1 | -1, o: { n?: number; depth: number; seed: number; glideMs?: number; spread?: number }): void {
  const rnd = rng(o.seed);
  const n = o.n ?? 14;
  const spread = o.spread ?? 1;
  const list: Seed[] = Array.from({ length: n }, (_, i) => {
    // up and out: a fan from straight up, leaning with the wind
    const a = -Math.PI / 2 + dir * (rnd() - 0.25) * 1.5 * spread;
    const v = 40 + rnd() * 42;
    return {
      x: at.x + (rnd() - 0.5) * 6,
      y: at.y + (rnd() - 0.5) * 6,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 20,
      floor: floorY + R((rnd() - 0.3) * 10),
      spinOff: Math.floor(rnd() * 4),
      sway: rnd() * Math.PI * 2,
      landed: -1,
      glint: i % 4 === 1,
      delay: i < 4 ? 0 : rnd() * 40,
    };
  });
  const px = layer(sc, o.depth);
  const glide = o.glideMs ?? 900;
  let el = 0;
  onFrame(
    sc,
    (dt) => {
      el += dt;
      const s = dt / 1000;
      px.clear();
      let alive = 0;
      for (const p of list) {
        if (el < p.delay) {
          alive++;
          continue;
        }
        if (p.landed < 0) {
          // the burst's drag, then the glide: a slow fall, a wind drift away from the attacker, a sway
          const drag = Math.exp(-4.2 * s);
          p.vx = p.vx * drag + dir * 20 * (1 - drag);
          p.vy = p.vy * drag + 34 * (1 - drag);
          const sw = Math.sin(el / 180 + p.sway) * 7;
          p.x += (p.vx + (el > 220 ? sw : 0)) * s;
          p.y += p.vy * s;
          if (p.y >= p.floor && el > 300) {
            p.y = p.floor;
            p.landed = el;
          }
          // a seed still airborne at the end of the glide is let down where it is
          if (el > glide + 250 && p.landed < 0) p.landed = el;
        }
        const rest = p.landed >= 0 ? el - p.landed : -1;
        // landed: rest a beat, then blink out in steps (on / off / on / gone)
        if (rest > 380) continue;
        alive++;
        if (rest > 160 && Math.floor((rest - 160) / 60) % 2 === 0) continue;
        const spin = rest >= 0 ? 0 : Math.floor(el / 110) + p.spinOff;
        const plume = rest > 160 ? PAL.mist : PAL.white;
        drawSeed(px, R(p.x), R(p.y), spin, dir, plume);
        // a few catch the light: a 1-px gold4 glint stepping out (gold4 → white → gone)
        if (p.glint && el > 60 && el < 420) px.dot(R(p.x) - dir * 2, R(p.y) - 3, el < 260 ? PAL.gold4 : PAL.white);
      }
      return alive > 0 && el < glide + 1200;
    },
    () => px.g.destroy(),
  );
}

// ================================================================ the death's stream and plumes

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  i: number;
}

/**
 * The wind carries the mound off leeward (`dir`) as a curving, climbing stream of seeds and 2-px blades. `emit` is
 * called by the caller with the world points the stream leaves from; the layer lives until the last mote is gone.
 */
export class SeedStream {
  private readonly px: Px;
  private readonly list: Mote[] = [];
  private readonly rnd: () => number;
  private released = false;
  private count = 0;

  constructor(
    readonly scene: Phaser.Scene,
    readonly dir: 1 | -1,
    depth: number,
    seed: number,
  ) {
    this.rnd = rng(seed);
    this.px = layer(scene, depth);
    onFrame(
      scene,
      (dt) => {
        const s = dt / 1000;
        this.px.clear();
        for (let i = this.list.length - 1; i >= 0; i--) {
          const m = this.list[i];
          m.age += dt;
          if (m.age >= m.life) {
            this.list.splice(i, 1);
            continue;
          }
          // the stream climbs on a curve and slows a little as it leaves; a sway along it
          m.vx *= Math.exp(-0.9 * s);
          m.vy -= 26 * s;
          m.x += m.vx * s;
          m.y += (m.vy + Math.sin(m.age / 90 + m.i) * 9) * s;
          const k = m.age / m.life;
          const x = R(m.x);
          const y = R(m.y);
          if (m.i % 3 === 0) {
            // a 2-px blade bit, tumbling between flat and slanted
            const c = k < 0.6 ? PAL.leaf3 : PAL.leaf2;
            if (Math.floor(m.age / 100 + m.i) % 2) this.px.rect(x, y, 2, 1, c);
            else {
              this.px.dot(x, y, c);
              this.px.dot(x + this.dir, y - 1, c);
            }
          } else drawSeed(this.px, x, y, Math.floor(m.age / 110) + m.i, -this.dir, k < 0.7 ? PAL.white : PAL.mist);
        }
        return !this.released || this.list.length > 0;
      },
      () => this.px.g.destroy(),
    );
  }

  /** Emit `n` motes from around `at` (a box of ±w/2, ±h/2). */
  emit(at: XY, n: number, w = 8, h = 6): void {
    if (this.released) return;
    for (let k = 0; k < n; k++) {
      const i = this.count++;
      this.list.push({
        x: at.x + (this.rnd() - 0.5) * w,
        y: at.y + (this.rnd() - 0.5) * h,
        vx: this.dir * (55 + this.rnd() * 45),
        vy: -6 - this.rnd() * 18,
        life: 560 + this.rnd() * 420,
        age: 0,
        i,
      });
    }
  }

  release(): void {
    this.released = true;
  }
}

/**
 * The horns go last: two long seed plumes (an earth3 base, a white shaft with mist barbs) lift and drift leeward,
 * turning level as they go, then step out (white → mist → gone).
 */
export function plumes(sc: Phaser.Scene, bases: XY[], dir: 1 | -1, depth: number, len: number): void {
  const px = layer(sc, depth);
  const ms = 900;
  let el = 0;
  onFrame(
    sc,
    (dt) => {
      el += dt;
      px.clear();
      if (el >= ms) return false;
      const k = el / ms;
      const e = 1 - Math.pow(1 - k, 1.6);
      bases.forEach((b, j) => {
        const bx = b.x + dir * e * (34 + j * 14);
        const by = b.y - e * (26 + j * 8) + Math.sin(k * 7 + j) * 1.5;
        // from upright-leaning to nearly level along the wind
        const a = -Math.PI / 2 + dir * (0.5 + 0.7 * e + j * 0.15);
        const shaft = k < 0.72 ? PAL.white : PAL.mist;
        const L = Math.max(3, R(len * (k < 0.85 ? 1 : 1 - (k - 0.85) / 0.15)));
        for (let s = 0; s <= L; s++) {
          const x = R(bx + Math.cos(a) * s + Math.sin(s * 0.9 + k * 9) * 0.6);
          const y = R(by + Math.sin(a) * s);
          px.dot(x, y, s < 2 ? PAL.earth3 : shaft);
          if (s > 2 && s % 3 === 0 && s < L - 1 && k < 0.85) {
            px.dot(x - dir, y + 1, PAL.mist);
            px.dot(x - dir * 2, y + 1, PAL.mist);
          }
        }
      });
      return true;
    },
    () => px.g.destroy(),
  );
}
