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
import { lightLayer } from '../../view/light';

const R = Math.round;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Where the strike's third bound lands (the feet): beside the target on its own floor row (3 px behind it in depth), the
 * levelled horn tip of the scoop frame (`tipX`: its x offset from the feet, world orientation) `gap` px short of the
 * target's facing side `front` — never past a body length from the target's feet. `sgn` = the attacker's facing.
 */
export function strikeStop(aim: XY, front: number, tipX: number, sgn: 1 | -1, o: { blocked?: boolean; direct?: boolean } = {}): XY {
  const gap = o.blocked ? -1 : 3;
  let fx = front - sgn * gap - tipX;
  if (!o.direct) fx = sgn > 0 ? Math.min(fx, aim.x - 22) : Math.max(fx, aim.x + 22);
  return { x: Math.round(fx), y: Math.round(o.direct ? aim.y : aim.y - 3) };
}

/**
 * Where the strike's third bound lands against a monster (the feet), r3: he travels INTO the target's lane. The levelled
 * horn tips of the scoop (`tip`: their offset from the feet, world orientation) come to rest over the near half of the
 * target's body (4 px short of its core; a guard: 12 px short, the horns meet the pike / shield face), at the height of
 * its core, so the toss rips them UP through it. The feet stay on a row in front of the target (≥ 4 px nearer the camera,
 * never more than 22 px), so he is drawn over it and the depth never flickers.
 */
export function strikeStopInto(aim: XY, core: XY, tip: XY, sgn: 1 | -1, o: { blocked?: boolean } = {}): XY {
  const x = core.x - sgn * (o.blocked ? 12 : 4) - tip.x;
  const y = Math.min(aim.y + 22, Math.max(aim.y + 4, core.y + 2 - tip.y));
  return { x: Math.round(x), y: Math.round(y) };
}

/** Deterministic per-moment random (films and measures stay repeatable). */
export function rng(seed: number): () => number {
  let s = (Math.imul(seed | 0, 2654435761) ^ 0x5a1ca) >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Every graphics object this card draws carries this name (ownImpact never hides its own). */
export const OWN = 'ssh:own';

function layer(sc: Phaser.Scene, depth: number): Px {
  return new Px(sc.add.graphics().setDepth(depth).setName(OWN));
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
  private el = 0;
  /** 0..1: the wave front's travel across the patch (from the entry side). */
  grow = 0;
  /** The landing press: 0 none, 1 flattened outward (from `pressAt`), 2 springing back past upright. */
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
    // the patch spills 8 px past the tile's iso diamond (a meadow, not a decal)
    this.rx = Math.round(TILE_W / 2 + 8);
    const ry = Math.round(TILE_H / 2 + 4);
    this.pressAt = { ...home };
    // tufts on a jittered grid: each tuft is a tall centre blade (many with a white seedhead) and two shorter side
    // blades fanning out — clumps with floor between them, never a hatch
    for (let gy = -ry + 1; gy <= ry - 1; gy += 4)
      for (let gx = -this.rx + 2; gx <= this.rx - 2; gx += 6) {
        const jx = gx + (rnd() - 0.5) * 4 + (((gy / 4) & 1) ? 3 : 0);
        const jy = gy + (rnd() - 0.5) * 2;
        const d = Math.abs(jx) / this.rx + Math.abs(jy) / ry;
        if (d > 0.96 || rnd() < 0.1) continue;
        const cx = R(home.x + jx);
        const cy = R(home.y + jy);
        const hc = 4 + Math.round((1 - d) * 4 + rnd() * 1.5);
        this.blades.push({ x: cx, y: cy, h: hc, head: rnd() < 0.55, lean: (rnd() - 0.5) * 0.8 });
        this.blades.push({ x: cx - 1, y: cy, h: Math.max(2, hc - 2), head: false, lean: -1.6 - rnd() });
        if (rnd() < 0.8) this.blades.push({ x: cx + 1, y: cy, h: Math.max(2, hc - 1 - Math.round(rnd())), head: false, lean: 1.4 + rnd() });
      }
    this.blades.sort((a, b) => a.y - b.y);
    // behind the unit for the blades behind its feet, in front of it for the blades in front
    this.back = layer(scene, unitDepth(home.y) - 0.5);
    this.front = layer(scene, unitDepth(home.y) + 0.5);
    this.stop = onFrame(scene, (dt) => {
      if (this.dead) return false;
      this.el += dt;
      this.draw();
      return true;
    });
  }

  private draw(): void {
    this.back.clear();
    this.front.clear();
    const span = this.rx * 2 + 20;
    // the gust's wave front crosses the patch from the entry side
    const fx = this.home.x - this.dir * (this.rx + 10) + this.dir * span * this.grow;
    const rk = [1, 2 / 3, 1 / 3, 0][Math.min(3, this.recede)];
    if (rk <= 0) return;
    for (const b of this.blades) {
      // d: how far the front has passed this blade
      const d = (fx - b.x) * this.dir;
      if (d < -1) continue;
      let h: number;
      let bend: number;
      if (d < 5 && this.grow < 1) {
        // the gust band: blades just reached by the front lie flat along the wind (two rows deep)
        h = Math.max(2, b.h * 0.4);
        bend = this.dir * (3 + b.h * 0.5);
      } else {
        // behind it the grass rises in three heights, still leaning with the wind, then sways on its own: a 2-state
        // bend every ~140 ms, the phase travelling across the patch with the breeze
        const lvl = this.grow >= 1 ? 1 : d < 9 ? 1 / 3 : d < 14 ? 2 / 3 : 1;
        h = b.h * lvl;
        const ph = Math.floor((this.el - (b.x - this.home.x) * this.dir * 6) / 140) & 1;
        bend = b.lean + (this.grow < 1 && d < 18 ? this.dir * 1.5 : 0) + this.dir * (ph ? 1 : -0.3);
      }
      h *= rk;
      // the landing: blades near the hooves flatten outward (state 1), then spring back past upright (state 2)
      if (this.press > 0) {
        const dx = b.x - this.pressAt.x;
        const dy = (b.y - this.pressAt.y) * 2;
        const near = clamp01(1 - Math.hypot(dx, dy) / (this.rx * 1.1));
        if (near > 0) {
          const side = dx === 0 ? (b.y >= this.pressAt.y ? 1 : -1) : Math.sign(dx);
          if (this.press === 1) {
            bend = side * (2 + 5 * near);
            h *= 1 - 0.6 * near;
          } else bend = -side * 1.5 * near + b.lean * 0.5;
        }
      }
      drawBlade(b.y >= this.home.y ? this.front : this.back, b.x, b.y, h, bend, b.head && h >= 4 && rk >= 1);
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
export function wakeFan(sc: Phaser.Scene, at: XY, dir: 1 | -1, k: number, seed: number, count?: number): void {
  const rnd = rng(seed);
  const n = count ?? 4 + Math.min(2, Math.round(k * 2));
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

/** The whistle curl in three drawn steps (x = trailing back from the tip, y down): a tight hook, the open 5×4
 *  spiral, the unwinding arc. Each point: [x, y, head] — the leading pixels are leaf4, the tail leaf3. */
export const CURL_STEPS: readonly (readonly (readonly [number, number, boolean])[])[] = [
  [[0, 1, true], [1, 0, true], [2, 0, false], [2, 1, false], [1, 2, false]],
  [[0, 2, true], [0, 1, true], [1, 0, true], [2, 0, false], [3, 0, false], [4, 1, false], [4, 2, false], [3, 3, false], [2, 3, false], [2, 2, false]],
  [[0, 1, false], [1, 0, false], [2, 0, false], [3, 0, false], [4, 1, false]],
];

/**
 * The whistle curl peeling off a horn tip: it rides with the tip (`tip()` = the tip's world point now), trailing back
 * (−dir) and a little up but never more than ~10 px from it, in three drawn steps (hook → open spiral → unwinding arc),
 * gone in ~250 ms.
 */
export function hornCurl(sc: Phaser.Scene, tip: () => XY | null, dir: 1 | -1, depth: number): void {
  const px = layer(sc, depth);
  const ms = 250;
  let el = 0;
  onFrame(
    sc,
    (dt) => {
      el += dt;
      px.clear();
      const at = tip();
      if (el >= ms || !at) return false;
      const k = el / ms;
      const step = k < 0.3 ? 0 : k < 0.72 ? 1 : 2;
      const ox = R(at.x - dir * (2 + k * 6));
      const oy = R(at.y - 2 - k * 2);
      for (const [x, y, head] of CURL_STEPS[step]) px.dot(ox - dir * x, oy + y, head && step < 2 ? PAL.leaf4 : PAL.leaf3);
      return true;
    },
    () => px.g.destroy(),
  );
}

// ================================================================ the toss: the horn-sweep smear and the tip glints

/**
 * The card's own contact mark (r4): a FILLED, tapering crescent smear — the path the horn tips cut as they rip up through
 * the target, from the levelled tip (`from`) to past the raised tip (`to`), bulging forward (`sgn`) like the tip's real
 * swing. Stepped palette bands: a gold3 outer edge, an earth4 body, an earth3 inner band; 1 px at the scoop end widening
 * to 5 px near the tip, the leading end gold4 (a 2-px gold4 tip trail along the outer edge of the top third). Three drawn
 * steps over ~115 ms of scene time (the hit-stop holds the first): full → the upper half thinned → the tip only.
 * `far`: the far horn's own, narrower crescent (3 px, earth3 / gold3) behind it. Filled arcs only: never a ring.
 */
export function hornSweep(sc: Phaser.Scene, near: { from: XY; via?: XY; to: XY }, far: { from: XY; via?: XY; to: XY } | null, sgn: 1 | -1, depth: number): void {
  const px = layer(sc, depth);
  type Cell = { x: number; y: number; c: number; t: number; d: number; w: number };
  const RANK: Record<number, number> = { [PAL.earth3]: 1, [PAL.earth4]: 2, [PAL.gold3]: 3, [PAL.gold4]: 4 };
  /** the crescent's cells (t: 0 scoop → 1 tip, d: 0 outer edge → w−1 inner) */
  const crescent = (a: XY, via: XY | undefined, b: XY, wMax: number, main: boolean): Cell[] => {
    // the arc the tips really swing: through the levelled scoop tip, the contact tip and on to the follow-through tip
    // (a quadratic through all three); without `via`, an arc through both ends bulging FORWARD by a third of its chord
    let c: XY;
    if (via) c = { x: 2 * via.x - (a.x + b.x) / 2, y: 2 * via.y - (a.y + b.y) / 2 };
    else {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const L = Math.hypot(dx, dy) || 1;
      let fx = -dy / L;
      let fy = dx / L;
      if (fx * sgn < 0) {
        fx = -fx;
        fy = -fy;
      }
      const sag = L * (main ? 0.4 : 0.34);
      c = { x: (a.x + b.x) / 2 + fx * 2 * sag, y: (a.y + b.y) / 2 + fy * 2 * sag };
    }
    const mid: XY = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const cells = new Map<string, Cell>();
    const N = 64;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x;
      const y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y;
      const tx = 2 * (1 - t) * (c.x - a.x) + 2 * t * (b.x - c.x);
      const ty = 2 * (1 - t) * (c.y - a.y) + 2 * t * (b.y - c.y);
      const tl = Math.hypot(tx, ty) || 1;
      let nx = -ty / tl;
      let ny = tx / tl;
      // the inner side of the swing faces the chord (the head)
      if (nx * (mid.x - x) + ny * (mid.y - y) < 0) {
        nx = -nx;
        ny = -ny;
      }
      // 1 px at the scoop end, swelling to wMax by ~80 %, a short rounded taper at the very tip
      const sw = t < 0.7 ? t / 0.7 : 1;
      let w = 1 + (wMax - 1) * sw * sw * (3 - 2 * sw);
      if (t > 0.94) w = Math.max(2, w - (t - 0.94) * 40);
      const W = Math.max(1, Math.round(w));
      for (let d = 0; d < W; d++)
        for (const h of [0, 0.5]) {
          const xx = R(x + nx * (d + h));
          const yy = R(y + ny * (d + h));
          let col: number;
          // bands: the outer (leading) edge gold, the body earth4, the inner rim earth3; the top third carries a 2-px
          // gold4 tip trail on its edge, the last tenth is all gold (the tip)
          if (t > 0.9) col = d < 2 ? PAL.gold4 : PAL.gold3;
          else if (t > 0.6 && main) col = d < 2 ? PAL.gold4 : d === 2 ? PAL.gold3 : d === W - 1 && W >= 4 ? PAL.earth3 : PAL.earth4;
          else if (t > 0.6) col = d === 0 ? PAL.gold4 : d === W - 1 && W >= 3 ? PAL.earth3 : PAL.earth4;
          else col = d === 0 ? PAL.gold3 : d === W - 1 && W >= 3 ? PAL.earth3 : PAL.earth4;
          const k = `${xx},${yy}`;
          const had = cells.get(k);
          if (!had || (d < had.d) || (d === had.d && (RANK[col] ?? 0) > (RANK[had.c] ?? 0))) cells.set(k, { x: xx, y: yy, c: col, t, d, w: W });
        }
    }
    return [...cells.values()];
  };
  const NC = crescent(near.from, near.via, near.to, 6, true);
  const FC = far ? crescent(far.from, far.via, far.to, 4, false) : [];
  let el = 0;
  onFrame(
    sc,
    (dt) => {
      el += dt;
      px.clear();
      if (el >= 115) return false;
      const step = el < 45 ? 0 : el < 85 ? 1 : 2;
      const draw = (cs: Cell[]) => {
        for (const p of cs) {
          if (step === 0) px.dot(p.x, p.y, p.c);
          else if (step === 1) {
            // the upper half, one band thinner (the inner band peels away first)
            if (p.t < 0.45 || (p.d >= p.w - 1 && p.w >= 2)) continue;
            px.dot(p.x, p.y, p.c);
          } else {
            // the tip only: its gold edge
            if (p.t < 0.78 || p.d > 1) continue;
            px.dot(p.x, p.y, p.t > 0.88 ? PAL.gold4 : PAL.gold3);
          }
        }
      };
      draw(FC);
      draw(NC);
      return true;
    },
    () => px.g.destroy(),
  );
}

/**
 * The toss lifts the steppe: on the contact frame `n` short 2-px grass blades spray UP out of the target's footing
 * (`at` = its feet), tumbling through two drawn states (upright / slanted, leaf3 with a leaf4 tip) under gravity, fall
 * back, rest a beat and blink out. Around them two rooted fans spring up and bend away on both sides.
 */
export function grassSpray(sc: Phaser.Scene, at: XY, dir: 1 | -1, seed: number, depth: number, n = 7): void {
  const rnd = rng(seed);
  wakeFan(sc, { x: at.x - 6, y: at.y + 1 }, -1, 1, seed + 1, 4);
  wakeFan(sc, { x: at.x + 6, y: at.y + 1 }, 1, 1, seed + 2, 4);
  const list = Array.from({ length: n }, (_, i) => {
    const slot = n > 1 ? i / (n - 1) - 0.5 : 0;
    return {
      x: at.x + slot * 22 + (rnd() - 0.5) * 3,
      y: at.y - (rnd() * 2),
      vx: slot * 70 + dir * 18 + (rnd() - 0.5) * 20,
      vy: -(120 + rnd() * 70 - Math.abs(slot) * 40),
      floor: at.y + R((rnd() - 0.5) * 6),
      land: -1,
      ph: i,
    };
  });
  const px = layer(sc, depth);
  let el = 0;
  onFrame(
    sc,
    (dt) => {
      el += dt;
      const s = dt / 1000;
      px.clear();
      let alive = 0;
      for (const b of list) {
        if (b.land < 0) {
          b.vy += 430 * s;
          b.x += b.vx * s;
          b.y += b.vy * s;
          if (b.vy > 0 && b.y >= b.floor) {
            b.y = b.floor;
            b.land = el;
          }
        }
        const rest = b.land >= 0 ? el - b.land : -1;
        if (rest > 260) continue;
        alive++;
        if (rest > 120 && Math.floor((rest - 120) / 50) % 2 === 0) continue;
        const x = R(b.x);
        const y = R(b.y);
        const st = rest >= 0 ? 1 : (Math.floor(el / 70) + b.ph) & 1;
        if (st === 0) {
          // upright: a 2-px stem and its lit tip
          px.dot(x, y, PAL.leaf3);
          px.dot(x, y - 1, PAL.leaf3);
          px.dot(x, y - 2, PAL.leaf4);
        } else {
          // slanted / lying
          px.dot(x, y, PAL.leaf2);
          px.dot(x + dir, y, PAL.leaf3);
          px.dot(x + dir * 2, y - 1, PAL.leaf4);
        }
      }
      return alive > 0 && el < 1400;
    },
    () => px.g.destroy(),
  );
}

/**
 * The impact he deals is the card's own: wrapped round the strike's s.impact call, the shared combat burst it stages
 * (vfx/combat impact: the star / shock-ring layer at band + 0.1, the sparks at + 0.2, the additive motes at + 0.3, where
 * band = the struck body's depth − 0.4, or DEPTH.FX for a direct hit) is hidden on its first frame, and the battle's
 * contact light is a small ring-less pool in the card's own tone. The crescent, the seeds, the blades and the glints are
 * the only contact mark (oturum-c-tasarim §2.5 / §3.2: no rings).
 */
export function ownImpact(sc: Phaser.Scene, bands: number[], stage: () => void, light: number = PAL.gold3): void {
  const before = new Set(sc.children.list);
  const near = (a: number, b: number) => Math.abs(a - b) < 0.02;
  const sweep = () => {
    for (const c of sc.children.list) {
      if (before.has(c) || c.name === OWN || c.type !== 'Graphics') continue;
      const d = (c as Phaser.GameObjects.Graphics).depth;
      if (bands.some((b) => near(d - b, 0.1) || near(d - b, 0.2) || near(d - b, 0.3))) (c as Phaser.GameObjects.Graphics).setAlpha(0);
    }
  };
  const L = lightLayer(sc);
  const lflash = L?.flash;
  if (L && lflash) {
    L.flash = (x, y, _c, radius, ms, fo = {}) => lflash.call(L, x, y, light, Math.min(radius, 16), Math.min(ms, 160), { ...fo, ring: false, air: 0.2, intensity: Math.min(fo.intensity ?? 0.6, 0.45) });
  }
  try {
    stage();
  } finally {
    if (L && lflash) delete (L as { flash?: unknown }).flash;
    sweep();
  }
  queueMicrotask(sweep);
  let k = 0;
  onFrame(sc, () => {
    sweep();
    return ++k < 3;
  });
}

/** Two or three gold4 glints at the burst origin: a 3×3 star (white core) → a single gold4 pixel → gone (~130 ms). */
export function tipGlints(sc: Phaser.Scene, at: XY[], depth: number): void {
  const px = layer(sc, depth);
  let el = 0;
  onFrame(
    sc,
    (dt) => {
      el += dt;
      px.clear();
      if (el >= 140) return false;
      at.forEach((p, i) => {
        const age = el - i * 20;
        if (age < 0) return;
        if (age < 70) {
          px.dot(p.x, p.y, PAL.white);
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) px.dot(p.x + dx, p.y + dy, PAL.gold4);
        } else if (age < 120) px.dot(p.x, p.y, PAL.gold4);
      });
      return true;
    },
    () => px.g.destroy(),
  );
}

// ================================================================ the seed burst

/** A feather-grass seed: a 2-px earth3 shaft and a plume in one of two drawn spin states, leaning away from `dir`.
 *  `big`: a crown seed that reads at 1× — a 2-px wide shaft and a 3-px deep plume (two rows of white, a mist fringe). */
export function drawSeed(px: Px, x: number, y: number, spin: number, dir: number, plume: number = PAL.white, big = false): void {
  // the awn: a 1-px earth3 shaft, 2 px long
  px.rect(x, y, 1, 2, PAL.earth3);
  if (big) {
    px.dot(x + dir, y + 1, PAL.earth3);
    if (spin & 1) {
      // lying: a broad feather streaming back along the wind (3 rows deep at its root)
      for (const [dx, dy] of [[1, -1], [2, -1], [3, -1], [2, -2], [3, -2], [4, -2], [5, -2], [3, -3], [4, -3]] as const) px.dot(x - dir * dx, y + dy, plume);
      px.dot(x - dir * 6, y - 2, PAL.mist);
      px.dot(x - dir * 5, y - 3, PAL.mist);
      px.dot(x - dir, y - 2, PAL.mist);
    } else {
      // standing: the feather curls up over the shaft, 3 px wide
      for (const [dx, dy] of [[0, -1], [1, -1], [0, -2], [1, -2], [-1, -2], [1, -3], [0, -3], [2, -4], [1, -4], [2, -5]] as const) px.dot(x - dir * dx, y + dy, plume);
      px.dot(x - dir * 3, y - 5, PAL.mist);
      px.dot(x + dir, y - 3, PAL.mist);
    }
    return;
  }
  if (spin & 1) {
    // lying: the feather streams back along the wind (5 px)
    px.dot(x - dir, y - 1, plume);
    px.dot(x - dir * 2, y - 1, plume);
    px.dot(x - dir * 3, y - 2, plume);
    px.dot(x - dir * 4, y - 2, plume);
    px.dot(x - dir * 5, y - 2, PAL.mist);
  } else {
    // standing: the feather curls up over the shaft (5 px)
    px.dot(x, y - 1, plume);
    px.dot(x, y - 2, plume);
    px.dot(x - dir, y - 3, plume);
    px.dot(x - dir * 2, y - 4, plume);
    px.dot(x - dir * 3, y - 4, PAL.mist);
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
  big: boolean;
}

/**
 * The seed burst at the contact point: `n` seeds spray UP and out into a crown (30–40 px over the contact within
 * ~150 ms: a hard launch under a strong drag), then glide down slowly (terminal fall ≈ 14 px/s) on a leeward wind
 * drift toward `dir` (≈ 25 px/s, away from the attacker) with a sway; they land on the floor around `floorY`, rest a
 * beat and blink out in steps. Their plumes spin (2 drawn states, both a full 4–5 px plume); a few catch a gold4 glint.
 * `power` scales the launch (1 = the strike's burst; the summon's single seeds lift off softly).
 */
export function seedBurst(sc: Phaser.Scene, at: XY, floorY: number, dir: 1 | -1, o: { n?: number; depth: number; seed: number; glideMs?: number; spread?: number; power?: number; tilt?: number; big?: number }): void {
  const rnd = rng(o.seed);
  const n = o.n ?? 14;
  const spread = o.spread ?? 1.4;
  const pw = o.power ?? 1;
  // the fan's lean leeward (rad): the strike's crown opens beside the damage number, not under it
  const tilt = o.tilt ?? 0.12;
  const bigN = o.big ?? 0;
  const list: Seed[] = Array.from({ length: n }, (_, i) => {
    // a crown: an even fan around straight up (leaning a little with the wind), each seed its own slot
    const slot = n > 1 ? i / (n - 1) - 0.5 : 0;
    const a = -Math.PI / 2 + slot * spread + dir * tilt + (rnd() - 0.5) * 0.18;
    const v = (230 + rnd() * 100) * pw;
    return {
      x: at.x + (rnd() - 0.5) * 4,
      y: at.y + (rnd() - 0.5) * 4,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      floor: floorY + R((rnd() - 0.3) * 10),
      spinOff: Math.floor(rnd() * 4),
      sway: rnd() * Math.PI * 2,
      landed: -1,
      glint: i % 4 === 1,
      delay: n > 3 ? R(rnd() * 80) : 0,
      // the big seeds: spread evenly through the crown
      big: bigN > 0 && i % Math.max(1, Math.floor(n / bigN)) === 2 && Math.floor(i / Math.max(1, Math.floor(n / bigN))) < bigN,
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
        const age = el - p.delay;
        if (age < 0) {
          alive++;
          continue;
        }
        if (p.landed < 0) {
          // the launch dies in the drag (the crown opens), then the glide takes over: the plumes hang in the air,
          // falling slowly and riding the wind away from the attacker
          const drag = Math.exp(-6.5 * s);
          const k = Math.min(1, age / 260);
          const tx = dir * 25 * k;
          const ty = 14 * k;
          p.vx = tx + (p.vx - tx) * drag;
          p.vy = ty + (p.vy - ty) * drag;
          const sw = age > 260 ? Math.sin(age / 170 + p.sway) * 8 : 0;
          p.x += (p.vx + sw) * s;
          p.y += p.vy * s;
          if (p.y >= p.floor && age > 300) {
            p.y = p.floor;
            p.landed = el;
          }
          // a seed still airborne at the end of the glide is let down where it is
          if (age > glide + 300 && p.landed < 0) p.landed = el;
        }
        const rest = p.landed >= 0 ? el - p.landed : -1;
        // landed: rest a beat, then blink out in steps (on / off / on / gone)
        if (rest > 380) continue;
        alive++;
        if (rest > 160 && Math.floor((rest - 160) / 60) % 2 === 0) continue;
        const spin = rest >= 0 ? 0 : Math.floor(age / 110) + p.spinOff;
        // the first frames leave the contact's white flash in mist (they never add white on top of it)
        const plume = age < 70 || rest > 160 ? PAL.mist : PAL.white;
        drawSeed(px, R(p.x), R(p.y), spin, dir, plume, p.big);
        // a few catch the light: a 1-px gold4 glint stepping out (gold4 → white → gone)
        if (p.glint && age > 90 && age < 460) px.dot(R(p.x) - dir * 2, R(p.y) - 4, age < 300 ? PAL.gold4 : PAL.white);
      }
      return alive > 0 && el < glide + 1400;
    },
    () => px.g.destroy(),
  );
}

// ================================================================ the death's stream and plumes

interface Mote {
  x: number;
  y: number;
  x0: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  i: number;
}

/** How far the stream may carry a mote leeward (px): it never reaches the duelist's pedestal behind him. */
const STREAM_REACH = 40;

/**
 * The wind carries the mound off leeward (`dir`) as a curving, climbing stream of seeds and 2-px blades. `emit` is
 * called by the caller with the world points the stream leaves from; the layer lives until the last mote is gone.
 * r4: the ribbon bends UP early and climbs out of the picture above the floor — no mote travels more than ~40 px
 * leeward (it would land on the duelist and his pedestal); the members thin out (blink) and step to mist as they go.
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
          const reach = Math.abs(m.x - m.x0);
          if (m.age >= m.life || reach > STREAM_REACH) {
            this.list.splice(i, 1);
            continue;
          }
          // the ribbon: every member rides the same curve (leeward, then bending up and climbing), with a small sway;
          // the wind loses its push as the mote nears its reach, the climb takes over
          m.vx *= Math.exp(-1.6 * s);
          m.vy -= 70 * s;
          m.x += m.vx * s;
          m.y += (m.vy + Math.sin(m.age / 110 + m.i * 0.7) * 4) * s;
          const k = Math.max(m.age / m.life, reach / STREAM_REACH);
          // thinning out: the last third blinks (every other member every other 60 ms)
          if (k > 0.66 && (Math.floor(m.age / 60) + m.i) % 2 === 0) continue;
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
          } else drawSeed(this.px, x, y, Math.floor(m.age / 110) + m.i, -this.dir, k < 0.55 ? PAL.white : PAL.mist);
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
      const x = at.x + (this.rnd() - 0.5) * w;
      this.list.push({
        x,
        y: at.y + (this.rnd() - 0.5) * h,
        x0: x,
        vx: this.dir * (52 + this.rnd() * 16),
        vy: -8 - this.rnd() * 8,
        life: 760 + this.rnd() * 220,
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
 * The horns go last: each lying horn (base, angle, length in world px) lifts off as its own long seed plume — an
 * earth3 base, a white shaft with mist barbs — rising and turning up into the wind leeward (`dir`), the second one
 * 70 ms later on a steeper, longer path (they never merge), then stepping out (white → mist → gone).
 */
export function plumes(sc: Phaser.Scene, horns: { base: XY; ang: number }[], dir: 1 | -1, depth: number, len: number): void {
  const px = layer(sc, depth);
  const ms = 1100;
  const lag = 80;
  let el = 0;
  onFrame(
    sc,
    (dt) => {
      el += dt;
      px.clear();
      if (el >= ms + lag) return false;
      horns.forEach((h, j) => {
        const k = clamp01((el - j * lag) / ms);
        const e = 1 - Math.pow(1 - k, 1.7);
        // rise and drift: the far plume climbs steeper and travels further
        const bx = h.base.x + dir * e * (30 + j * 18);
        const by = h.base.y - e * (22 + j * 16) + Math.sin(k * 7 + j * 2) * 1.2;
        // from lying along the floor up into the wind: the shaft turns to lean leeward-up (j: a different angle)
        const target = -Math.PI / 2 + dir * (0.55 + j * 0.45);
        let da = target - h.ang;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        const a = h.ang + da * Math.min(1, e * 1.4);
        // the shaft (the horn's keratin, 2 px) goes FIRST: it shortens and steps earth3 → earth2 → gone by 45 %, the
        // feather head stays and carries on alone (a plume, never a flying stick)
        const L0 = R(len * 0.85);
        const L = Math.max(2, R(L0 * (1 - Math.min(1, k * 2.2))));
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const nx = R(-sa) || 0;
        const ny = R(ca) || 1;
        const shaft = k < 0.22 ? PAL.earth3 : k < 0.45 ? PAL.earth2 : -1;
        // the head stays where the horn's tip end was; the shaft shortens from its base end
        const tx = R(bx + ca * L0);
        const ty = R(by + sa * L0);
        if (shaft >= 0)
          for (let s = L0 - L; s < L0; s++) {
            const sx = R(bx + ca * s);
            const sy = R(by + sa * s);
            px.dot(sx, sy, shaft);
            if (s < L0 - 1 && k < 0.3) px.dot(sx + nx, sy + ny, shaft);
          }
        // the feather head at the top end: a full 4-px deep plume, spinning through two drawn states
        const spin = (Math.floor(el / 120) + j) & 1;
        const plume = k < 0.8 ? PAL.white : PAL.mist;
        if (k > 0.9 && (Math.floor(el / 50) & 1)) return;
        if (spin) {
          // lying: the feather streams back along the wind (7 px long, 4 rows deep)
          for (const [dx, dy] of [[1, -1], [2, -1], [3, -1], [1, -2], [2, -2], [3, -2], [4, -2], [5, -2], [2, -3], [3, -3], [4, -3], [5, -3], [6, -3], [4, -4], [5, -4]] as const) px.dot(tx - dir * dx, ty + dy, plume);
          for (const [dx, dy] of [[7, -3], [6, -4], [6, -2], [3, -4]] as const) px.dot(tx - dir * dx, ty + dy, PAL.mist);
        } else {
          // standing: the feather curls up over the shaft, 3–4 px wide
          for (const [dx, dy] of [[0, -1], [1, -1], [0, -2], [1, -2], [-1, -2], [-1, -3], [0, -3], [1, -3], [2, -3], [0, -4], [1, -4], [2, -4], [1, -5], [2, -5], [3, -5]] as const) px.dot(tx - dir * dx, ty + dy, plume);
          for (const [dx, dy] of [[3, -6], [4, -5], [-1, -4], [2, -6]] as const) px.dot(tx - dir * dx, ty + dy, PAL.mist);
        }
      });
      return true;
    },
    () => px.g.destroy(),
  );
}
