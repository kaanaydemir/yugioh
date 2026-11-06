// Çamur Pençe Ruhu (mudgrasp_spirit) — pixel helpers of its v3 cinematics (./mudgrasp_spirit.ts). No side
// effects: this module only exports painters and small effect objects (the cinematics glob imports it, KK-9).
//
// MATERIAL (critic round 1: "every FX element read as DRY brown sticks / rubble"): everything here is painted as
// WET, GLOSSY, VIOLET-LIT MUD — dark bodies (earth1 / earth0), a lit top lip (earth2), an INSET gloss streak one
// pixel under the lip (earth3 dashes, one earth4 hot catch at the lead), a dark wet underside (earth0) and, where
// mud meets the floor, a violet seep (void2) from the spirit's light under the ground. Fat, short, rounded shapes;
// never thin forked lines. Whole pixels, flat tone bands, 1-px ink outline, stepped growth (REHBER EF-7).
//   MudMask        silhouette buffer → paint() (legacy bands) / wet() (the wet-mud painter above)
//   wetHand        a fat glossy mud forearm with a cupped 3-finger palm + thumb (open → clutching/wrapping)
//   mudVortex      the summon's whirlpool: four glossy spiral arms turning round a violet pit (+ its light)
//   gripMarks      the summon's grip on the TILE EDGES: fingers curled over the tile's lip, smears that stay
//   cracks         the death: violet-lit seams in the tile, glossy tongues of mud running out along them and
//                  sucked back in, a counter-turning spiral in the shrinking puddle
//   drawBall       the "Çamur Atışı" lump (8–9 px, glossy, violet ember, squash & stretch, a dripping tail)
//   mudSplat       the contact "şlap": violet pop, fat radial splash, droplets; gooDecal: the glob that slides
//   pinGrab        the pin: the floor darkens / bulges / leaks violet, wet hands burst, wrap the real feet
//                  (scanned from the attacker's frame), the feet sink into a glossy ring with a violet pit
//   mudPinAura     the persistent status: that ring + a violet pit light, small hands pawing the feet on the
//                  visible front arc, mud collars on the ankles; it drains on the padlock's own tick
//   mudCrawl       the dead spirit's mud reaching the attacker: a wide glossy stream with a pulling head
//   violetSeams    a violet burst out of a tile's cracks (the dead spirit's old tile)

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { XY } from '../../view/layout';
import { Raster } from '../../vfx/setpieces';
import { Sparks, onFrame } from '../../vfx/combat';
import { lightPool, type LightHandle } from '../../view/light';

export const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const rint = (p: XY): XY => ({ x: Math.round(p.x), y: Math.round(p.y) });

/** Mud tones, dark → wet highlight. */
export const MUD = [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3] as const;
/** Wet mud: [underside, body, lit lip, gloss, hot catch]. */
export const WET = [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4] as const;
/** The pin's hands: a value lighter body so they read on the dark ring and floor (still a dark underside). */
export const WET_HAND = [PAL.earth0, PAL.earth2, PAL.earth3, PAL.earth3, PAL.earth4] as const;
/** The spirit's violet (eyes, pit, ember). */
export const VIOLET = [PAL.void1, PAL.void2, PAL.void3, PAL.void4] as const;
/** Wet droplets (sparks): a glossy catch first, then body tones. */
export const WET_DROPS = [PAL.earth3, PAL.earth2, PAL.earth1, PAL.earth1, PAL.earth0] as const;

// ================================================================ random (deterministic per effect)

export function rng(seed: number): () => number {
  let s = (Math.imul(seed | 0, 2654435761) ^ 0x3c6d) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ================================================================ the mud painter

/** Tone set used by MudMask.paint: [shadow, body, lit, highlight]. */
export type MudTones = readonly [number, number, number, number];
export type WetTones = readonly [number, number, number, number, number];

export interface WetOpts {
  tones?: WetTones;
  outline?: number | null;
  /** Rows at / below this y on the underside take the violet seep (void2): mud meeting the lit ground. */
  seepY?: number;
  /** false: no gloss streak (tiny drops). */
  gloss?: boolean;
  /** Only rows ≥ clipY are painted (outline included): the part of a pool that lies in front of a body. */
  clipY?: number;
  /** Shifts the gloss dash pattern (a slow shimmer when animated). */
  phase?: number;
}

/**
 * A silhouette buffer in world space (x0, y0, w, h). Fill shapes, then wet(): every filled pixel gets a wet-mud
 * tone from its neighbourhood (see the header), and every empty pixel touching it the ink outline.
 */
export class MudMask {
  readonly m: Uint8Array;
  constructor(
    public x0: number,
    public y0: number,
    readonly w: number,
    readonly h: number,
  ) {
    this.m = new Uint8Array(w * h);
  }
  clear(): void {
    this.m.fill(0);
  }
  f(x: number, y: number): boolean {
    const lx = x - this.x0;
    const ly = y - this.y0;
    return lx >= 0 && ly >= 0 && lx < this.w && ly < this.h && this.m[ly * this.w + lx] !== 0;
  }
  set(x: number, y: number, v = 1): void {
    const lx = Math.round(x) - this.x0;
    const ly = Math.round(y) - this.y0;
    if (lx >= 0 && ly >= 0 && lx < this.w && ly < this.h) this.m[ly * this.w + lx] = v;
  }
  ell(cx: number, cy: number, rx: number, ry: number, v = 1): void {
    if (rx <= 0 || ry <= 0) return;
    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, v);
      }
  }
  disc(cx: number, cy: number, r: number, v = 1): void {
    this.ell(cx, cy, r, r, v);
  }
  /** Erase an ellipse (a hole). */
  hole(cx: number, cy: number, rx: number, ry: number): void {
    this.ell(cx, cy, rx, ry, 0);
  }
  /** A round-capped stroke of radius r (r < 0.75 → a 1-px line). */
  capsule(ax: number, ay: number, bx: number, by: number, r: number, v = 1): void {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      if (r < 0.75) this.set(x, y, v);
      else this.disc(x, y, r, v);
    }
  }
  /** Legacy flat bands (kept for tiny matter: drops). */
  paint(g: Raster, o: { tones?: MudTones; outline?: number | null; hi?: boolean } = {}): void {
    const [d, b, l, h] = o.tones ?? MUD;
    const ink = o.outline === undefined ? PAL.ink : o.outline;
    for (let ly = 0; ly < this.h; ly++)
      for (let lx = 0; lx < this.w; lx++) {
        const x = lx + this.x0;
        const y = ly + this.y0;
        if (this.m[ly * this.w + lx] === 0) {
          if (ink !== null && (this.f(x - 1, y) || this.f(x + 1, y) || this.f(x, y - 1) || this.f(x, y + 1))) g.px(x, y, ink);
          continue;
        }
        const ul = !this.f(x - 1, y) || !this.f(x, y - 1);
        const dr = !this.f(x + 1, y) || !this.f(x, y + 1);
        let c = b;
        if (ul && !dr) c = l;
        else if (dr && !ul) c = d;
        if (o.hi !== false && ul && !dr && !this.f(x - 1, y) && !this.f(x, y - 1) && this.f(x + 1, y + 1) && this.f(x + 2, y + 1)) c = h;
        g.px(x, y, c);
      }
  }
  /** The wet-mud painter (see the file header). */
  wet(g: Raster, o: WetOpts = {}): void {
    const T = o.tones ?? WET;
    const ink = o.outline === undefined ? PAL.ink : o.outline;
    const clipY = o.clipY ?? -1e9;
    const ph = Math.round(o.phase ?? 0);
    for (let ly = 0; ly < this.h; ly++) {
      const y = ly + this.y0;
      if (y < clipY) continue;
      for (let lx = 0; lx < this.w; lx++) {
        const x = lx + this.x0;
        if (this.m[ly * this.w + lx] === 0) {
          if (ink !== null && (this.f(x - 1, y) || this.f(x + 1, y) || (y > clipY && this.f(x, y - 1)) || this.f(x, y + 1))) g.px(x, y, ink);
          continue;
        }
        const up = this.f(x, y - 1);
        const dn = this.f(x, y + 1);
        const lf = this.f(x - 1, y);
        const rt = this.f(x + 1, y);
        let c = T[1];
        if (!dn || (!this.f(x, y + 2) && !rt)) c = T[0];
        else if (!rt && up && !this.f(x + 1, y + 1)) c = T[0];
        if (!up) c = !rt && lf ? T[1] : T[2];
        // the gloss: an inset streak one pixel under the lit lip, on lumps at least four pixels deep
        if (o.gloss !== false && up && !this.f(x, y - 2) && dn && this.f(x, y + 2) && lf) {
          const lead = !this.f(x - 2, y) || !this.f(x - 1, y - 1);
          if (lead && rt) c = T[4];
          else if (rt && ((x * 5 + y * 3 + ph) & 3) < 2) c = T[3];
        }
        if (o.seepY !== undefined && !dn && y >= o.seepY - 1) c = PAL.void2;
        g.px(x, y, c);
      }
    }
  }
}

// ================================================================ the wet hand

export interface HandOpts {
  /** Sideways bow of the forearm at its middle (px, + = to the left of base→tip). */
  bend?: number;
  /** 1 = fingers splayed, 0 = curled (clutching / wrapping). */
  open?: number;
  /** Forearm radius (2.2 → a 5-px forearm). */
  w?: number;
  /** Which way the fingers curl when closing: +1 / −1 (screen side of base→tip). */
  cup?: number;
  /** Draw the fingers into this mask instead (they wrap IN FRONT of a foot while the palm stays behind). */
  fingers?: MudMask;
  /** 0..1 a drip forming under the palm and falling. */
  drip?: number;
  /** Collar of mud where the arm leaves the ground (scale, 0 = none). */
  collar?: number;
}

/** A fat glossy mud arm from `base` (where it leaves the mud) to the wrist at `tip`; returns the palm centre. */
export function wetHand(mk: MudMask, base: XY, tip: XY, o: HandOpts = {}): XY {
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const nx = -uy;
  const ny = ux;
  const w = o.w ?? 2.2;
  const bend = o.bend ?? 0;
  const mid = { x: base.x + dx * 0.5 + nx * bend, y: base.y + dy * 0.5 + ny * bend };
  const col = o.collar ?? 1;
  if (col > 0) mk.ell(base.x, base.y, (w + 3) * col, (w * 0.6 + 0.8) * col);
  // a slumping forearm: thick at the ground, an elbow lump, thinning a little to the wrist
  mk.capsule(base.x, base.y, mid.x, mid.y, w + 0.6);
  mk.disc(mid.x + nx * 0.5, mid.y + ny * 0.5, w + 1);
  mk.capsule(mid.x, mid.y, tip.x, tip.y, w);
  // the palm: a round wet pad a little wider than the wrist
  const pr = w + 0.8;
  const palm = { x: tip.x + ux * (pr - 0.5), y: tip.y + uy * (pr - 0.5) };
  mk.disc(palm.x, palm.y, pr);
  // three fat fingers + a thumb (3 px wide, rounded tips); closing curls them toward the cup side
  const open = clamp01(o.open ?? 1);
  const cup = o.cup ?? 1;
  const fm = o.fingers ?? mk;
  const a0 = Math.atan2(uy, ux);
  const fr = w >= 1.8 ? 1 : 0.8;
  for (let i = -1; i <= 1; i++) {
    const a = a0 + i * (0.25 + 0.4 * open) - cup * (1 - open) * 0.25;
    const l1 = pr + 1.5 + 1.5 * open;
    const k1 = { x: palm.x + Math.cos(a) * l1, y: palm.y + Math.sin(a) * l1 };
    fm.capsule(palm.x + Math.cos(a) * (pr - 1), palm.y + Math.sin(a) * (pr - 1), k1.x, k1.y, fr);
    const a2 = a + cup * (1 - open) * (1.5 + 0.2 * i);
    const l2 = 2 + 0.5 * open - (i === 0 ? 0 : 0.5);
    const k2 = { x: k1.x + Math.cos(a2) * l2, y: k1.y + Math.sin(a2) * l2 };
    fm.capsule(k1.x, k1.y, k2.x, k2.y, fr);
    fm.disc(k2.x, k2.y, fr + 0.15);
  }
  const at = a0 - cup * (1.25 + 0.3 * open);
  fm.capsule(palm.x, palm.y, palm.x + Math.cos(at) * (pr + 1.5), palm.y + Math.sin(at) * (pr + 1.5), fr * 0.9);
  // a drip forming under the palm, then a falling drop
  if (o.drip !== undefined && o.drip >= 0) {
    const d = o.drip % 1;
    const px = Math.round(palm.x);
    const py = Math.round(palm.y + pr);
    if (d < 0.6) mk.capsule(px, py, px, py + 1 + Math.floor(d * 5), 0.5);
    else mk.disc(px, py + 4 + Math.floor((d - 0.6) * 18), 0.8);
  }
  return palm;
}

/** The violet seep at a hand's base (light pixels after the paint: never outlined). */
export function seepAt(g: Raster, base: XY, w: number, t: number): void {
  const x = Math.round(base.x);
  const y = Math.round(base.y);
  const r = Math.round(w + 2);
  g.px(x - r, y, PAL.void2);
  g.px(x + r, y, PAL.void2);
  g.px(x, y + 1, (Math.floor(t * 6) & 1) === 0 ? PAL.void3 : PAL.void2);
}

// ================================================================ the vortex (summon)

export interface MudVortex {
  /** Radius 0..1 of full (stepped to whole px). */
  open: number;
  /** Spin speed (rad / s; sign = direction). */
  speed: number;
  /** The violet pit's glow 0..1. */
  pit: number;
  ripple(): void;
  destroy(): void;
}

/** A glossy mud whirlpool lying on the tile at `at` (floor depth), full radius rx (ry = rx / 2), with its light. */
export function mudVortex(sc: Phaser.Scene, at: XY, rx: number, depth: number, seed: number): MudVortex {
  const W = rx * 2 + 28;
  const H = rx + 22;
  const r = Raster.around(sc, at.x, at.y, W, H, depth);
  const mk = new MudMask(r.x, r.y, r.w, r.h);
  const R = rng(seed);
  let ang = R() * TAU;
  const rings: number[] = [];
  const bubbles: { a: number; d: number; age: number; life: number }[] = [];
  let alive = true;
  const light: LightHandle = lightPool(sc, at.x, at.y, { color: PAL.void3, spill: PAL.void2, radius: 8, floorY: at.y, intensity: 0, anim: 'breathe', fadeIn: 0 });
  const V: MudVortex = {
    open: 0,
    speed: 4,
    pit: 0,
    ripple() {
      rings.push(0);
    },
    destroy() {
      if (!alive) return;
      alive = false;
      stop();
      r.destroy();
      if (light.alive) void light.fadeOut(160);
    },
  };
  let lastPit = -1;
  const stop = onFrame(sc, (dt) => {
    if (!alive) return false;
    ang += (V.speed * dt) / 1000;
    const rr = Math.round(rx * clamp01(V.open));
    for (let i = rings.length - 1; i >= 0; i--) {
      rings[i] += dt / 420;
      if (rings[i] >= 1) rings.splice(i, 1);
    }
    if (rr >= 6 && dt > 0 && R() < dt / 70) bubbles.push({ a: R() * TAU, d: 0.35 + R() * 0.5, age: 0, life: 220 + R() * 200 });
    for (let i = bubbles.length - 1; i >= 0; i--) {
      bubbles[i].age += dt;
      if (bubbles[i].age >= bubbles[i].life + 80) bubbles.splice(i, 1);
    }
    const pitK = Math.round(clamp01(V.pit) * 4) / 4;
    if (pitK !== lastPit) {
      lastPit = pitK;
      light.setIntensity(pitK * 1.1, 80);
      light.setRadius(Math.max(6, rr * 0.9), undefined, 120);
    }
    r.draw((g) => {
      // wet ripple rings on the floor beyond the rim: a dark wet band with a lit lip and a violet glint
      for (const k of rings) {
        const q = Math.round(rx * 0.8 + rx * 0.55 * k);
        const qy = Math.max(1, Math.round(q / 2));
        g.ring(at.x, at.y, q, qy, k < 0.55 ? PAL.earth1 : PAL.earth0);
        if (k < 0.7) g.ring(at.x, at.y, q, qy - 1, PAL.earth2, 1, Math.PI * 1.1, Math.PI * 1.6);
        if (k < 0.4) g.px(Math.round(at.x + Math.cos(ang) * q), Math.round(at.y + Math.sin(ang) * qy), PAL.void3);
      }
      if (rr < 3) return;
      const ry = Math.max(2, Math.round(rr / 2));
      // the slurry: a dark glossy dish (ink rim, an earth0 body; the far inner wall lit, the near lip wet)
      mk.clear();
      mk.ell(at.x, at.y, rr, ry);
      mk.wet(g, { tones: [PAL.earth0, PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3], gloss: false });
      if (rr > 5) {
        g.ring(at.x, at.y, rr - 1, ry - 1, PAL.earth2, 1, Math.PI * 0.12, Math.PI * 0.88);
        g.ring(at.x, at.y, rr - 2, Math.max(1, ry - 2), PAL.earth1, 1, Math.PI * 0.2, Math.PI * 0.8);
      }
      // four glossy spiral arms turning inward: 2 px thick, a lit crest, a hot head, violet where they near the pit
      const dir = Math.sign(V.speed || 1);
      for (let arm = 0; arm < 4; arm++) {
        const a0 = ang + (arm * TAU) / 4;
        const N = 16;
        for (let s = 0; s <= N; s++) {
          const k = s / N;
          const rad = rr * (0.95 - 0.78 * k);
          const a = a0 + dir * k * 3.4;
          const x = Math.round(at.x + Math.cos(a) * rad);
          const y = Math.round(at.y + Math.sin(a) * rad * 0.5);
          if (!mk.f(x, y)) continue;
          const nearPit = k > 0.72;
          const body = nearPit ? PAL.void2 : k < 0.15 ? PAL.earth3 : PAL.earth2;
          g.px(x, y, body);
          if (mk.f(x, y + 1)) g.px(x, y + 1, nearPit ? PAL.void1 : PAL.earth1);
          if (s === 1 && rr > 9) g.px(x, y - 1, PAL.earth4);
        }
      }
      // bubbles: a glossy dome that swells and pops (a violet ring for a frame, two droplets)
      for (const bb of bubbles) {
        const x = Math.round(at.x + Math.cos(bb.a) * rr * bb.d);
        const y = Math.round(at.y + Math.sin(bb.a) * ry * bb.d);
        if (bb.age < bb.life) {
          const big = bb.age > bb.life * 0.45;
          g.px(x, y - 1, PAL.earth3);
          g.px(x, y, PAL.earth1);
          if (big) {
            g.px(x - 1, y - 1, PAL.earth2);
            g.px(x + 1, y, PAL.earth0);
            g.px(x, y - 2, PAL.ink);
          }
        } else {
          g.px(x - 1, y, PAL.void3);
          g.px(x + 1, y, PAL.void3);
          g.px(x, y - 1, PAL.void2);
          g.px(x - 2, y - 2, PAL.earth3);
          g.px(x + 2, y - 2, PAL.earth3);
        }
      }
      // the pit: an ink eye, a violet ring, a hot core that grows with `pit`
      if (rr >= 6) {
        const pr = Math.max(3, Math.round(3 + 4 * clamp01(V.pit) * (rr / rx)));
        const py = Math.max(1, Math.round(pr / 2));
        g.ell(at.x, at.y, pr + 1, py + 1, PAL.ink);
        if (V.pit > 0.05) {
          g.ell(at.x, at.y, pr, py, PAL.void1);
          g.ell(at.x, at.y, Math.max(1, pr - 1), Math.max(1, py - 1), PAL.void2);
          if (V.pit > 0.35) g.ell(at.x, at.y, Math.max(1, pr - 2), Math.max(0.6, py - 1), PAL.void3);
          if (V.pit > 0.6) {
            g.px(at.x, at.y, PAL.void4);
            g.px(at.x - 1, at.y, PAL.void4);
            if (V.pit > 0.9 && (Math.floor(ang * 3) & 1) === 0) g.px(at.x, at.y - 1, PAL.white);
          }
        }
      }
    });
    return true;
  });
  return V;
}

// ================================================================ the summon's grip on the tile edges

export interface GripMarks {
  /** 0..1 the fingers curl over the lip (0 = gone). */
  grip: number;
  destroy(): void;
}

/**
 * Fingers of mud curled over the tile's edge at `p` (side = which way the edge faces, −1 left / +1 right) and a
 * wet smear on the edge that stays after the hand lets go (it dries back to the floor in steps on destroy()).
 */
export function gripMarks(sc: Phaser.Scene, pts: readonly { at: XY; side: number }[], depth: number): GripMarks {
  const minX = Math.min(...pts.map((p) => p.at.x)) - 14;
  const maxX = Math.max(...pts.map((p) => p.at.x)) + 14;
  const minY = Math.min(...pts.map((p) => p.at.y)) - 10;
  const maxY = Math.max(...pts.map((p) => p.at.y)) + 10;
  const r = new Raster(sc, minX, minY, maxX - minX, maxY - minY, depth);
  const mk = new MudMask(r.x, r.y, r.w, r.h);
  const sm = new MudMask(r.x, r.y, r.w, r.h);
  let alive = true;
  let dying = -1;
  let el = 0;
  const G: GripMarks = {
    grip: 0,
    destroy() {
      if (dying < 0) dying = el;
    },
  };
  onFrame(sc, (dt) => {
    if (!alive) return false;
    el += dt;
    let smear = 1;
    if (dying >= 0) {
      const d = el - dying;
      if (d > 600) {
        alive = false;
        r.destroy();
        return false;
      }
      smear = d < 200 ? 1 : d < 400 ? 0.6 : 0.3;
    }
    const k = clamp01(G.grip);
    r.draw((g) => {
      // the smear on the edge: a wet dark streak along the lip (stays a beat after the hand goes)
      sm.clear();
      for (const p of pts) {
        const L = Math.round(8 * smear);
        if (L < 2) continue;
        sm.capsule(p.at.x - p.side * 2, p.at.y - 1, p.at.x - p.side * (2 + L), p.at.y - 1 - Math.round(L / 2), smear > 0.5 ? 1.2 : 0.6);
        sm.disc(p.at.x - p.side * 3, p.at.y, smear > 0.5 ? 2 : 1);
      }
      sm.wet(g, { tones: [PAL.earth0, PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3], outline: null, gloss: smear > 0.5 });
      if (k <= 0.05) return;
      // three fat fingers hooked OVER the lip (their tips hang down the tile's side face)
      mk.clear();
      for (const p of pts) {
        for (let i = 0; i < 3; i++) {
          const fx = p.at.x - p.side * (i * 3 - 1);
          const fy = p.at.y - 1 + Math.abs(i - 1);
          const hang = Math.round(1 + 3 * k) + (i === 1 ? 1 : 0);
          mk.capsule(fx - p.side * 2, fy - 2, fx, fy, 1);
          mk.capsule(fx, fy, fx + p.side * 1, fy + hang, 1);
          mk.disc(fx + p.side, fy + hang, 1.1);
        }
      }
      mk.wet(g, { tones: WET_HAND });
    });
    return true;
  });
  return G;
}

// ================================================================ the death's cracks

export interface Cracks {
  /** 0..1: the seams run out from the centre (violet light in them). */
  grow: number;
  /** 0..1: glossy tongues of mud run out along them. */
  flow: number;
  /** 0..1: the tongues are sucked back in (the heads retreat to the centre, the bodies thin). */
  drain: number;
  /** 0..3: the seams close in steps (3 = gone). */
  close: number;
  /** Puddle radius left on the tile (px, 0 = none): a glossy pool with a counter-turning spiral. */
  puddle: number;
  /** Spin of the puddle's spiral (rad / s, negative = the summon's vortex reversed). */
  spin: number;
  destroy(): void;
}

/** Six seams across the tile around `at` (reach rx; iso). */
export function cracks(sc: Phaser.Scene, at: XY, rx: number, depth: number, seed: number): Cracks {
  const R = rng(seed);
  const lines: XY[][] = [];
  const n = 6;
  for (let i = 0; i < n; i++) {
    let a = (i / n) * TAU + (R() - 0.5) * 0.6;
    let p = { x: at.x, y: at.y };
    const pts: XY[] = [{ x: Math.round(p.x), y: Math.round(p.y) }];
    const seg = 6;
    const reach = rx * (0.75 + R() * 0.25);
    for (let k = 0; k < seg; k++) {
      a += (R() - 0.5) * 0.7;
      const step = reach / seg;
      p = { x: p.x + Math.cos(a) * step, y: p.y + Math.sin(a) * step * 0.5 };
      pts.push({ x: Math.round(p.x), y: Math.round(p.y) });
    }
    lines.push(pts);
  }
  const r = Raster.around(sc, at.x, at.y, rx * 2 + 16, rx + 16, depth);
  const mk = new MudMask(r.x, r.y, r.w, r.h);
  let alive = true;
  let ang = R() * TAU;
  const C: Cracks = {
    grow: 0,
    flow: 0,
    drain: 0,
    close: 0,
    puddle: 0,
    spin: -6,
    destroy() {
      if (!alive) return;
      alive = false;
      stop();
      r.destroy();
    },
  };
  /** Points along a polyline from t0 to t1 (whole px). */
  const along = (pts: XY[], t0: number, t1: number, fn: (p: XY, k: number) => void) => {
    const total = pts.length - 1;
    for (let s = 0; s < total; s++) {
      const a = pts[s];
      const b = pts[s + 1];
      const L = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
      for (let j = 0; j < L; j++) {
        const k = (s + j / L) / total;
        if (k < t0 || k > t1) continue;
        fn({ x: Math.round(a.x + ((b.x - a.x) * j) / L), y: Math.round(a.y + ((b.y - a.y) * j) / L) }, k);
      }
    }
  };
  let el = 0;
  const stop = onFrame(sc, (dt) => {
    if (!alive) return false;
    el += dt;
    ang += (C.spin * dt) / 1000;
    r.draw((g) => {
      // 1. the seams: an ink cut with the spirit's violet light in it (hot points pulse along it)
      if (C.close < 3) {
        for (const pts of lines)
          along(pts, 0, C.grow, (p, k) => {
            if (C.close >= 2) {
              if (k < 0.6) g.px(p.x, p.y, PAL.earth0);
              return;
            }
            g.px(p.x, p.y, PAL.ink);
            const hot = C.close < 1 && ((Math.round(k * 40) + Math.floor(el / 70)) % 5 === 0);
            g.px(p.x, p.y + 1, C.close < 1 ? (hot ? PAL.void3 : PAL.void2) : PAL.void1);
            if (hot && k > 0.1) g.px(p.x, p.y, PAL.void4);
          });
      }
      // 2. the tongues + the puddle: one glossy mud mask
      mk.clear();
      if (C.puddle >= 1) mk.ell(at.x, at.y, Math.round(C.puddle), Math.max(1, Math.round(C.puddle / 3)));
      if (C.flow > 0 && C.close < 1) {
        const head = Math.min(C.grow, C.flow) * (1 - C.drain);
        const thick = C.drain < 0.5 ? 1.3 : C.drain < 0.85 ? 0.9 : 0.5;
        for (const pts of lines) {
          along(pts, 0, head, (p, k) => {
            const near = head - k < 0.1;
            mk.disc(p.x, p.y, near ? thick + 0.7 : thick * (1 - k * 0.3));
          });
        }
      }
      mk.wet(g, { tones: [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4], phase: Math.floor(el / 90) });
      // 3. the counter-turning spiral in the puddle (the summon's vortex reversed) + its violet eye
      if (C.puddle >= 6) {
        const pr = Math.round(C.puddle);
        for (let arm = 0; arm < 3; arm++) {
          const a0 = ang + (arm * TAU) / 3;
          for (let s = 0; s <= 10; s++) {
            const k = s / 10;
            const rad = pr * (0.85 - 0.7 * k);
            const a = a0 - k * 3;
            const x = Math.round(at.x + Math.cos(a) * rad);
            const y = Math.round(at.y + Math.sin(a) * rad / 3);
            if (mk.f(x, y) && mk.f(x, y - 1)) g.px(x, y, k > 0.6 ? PAL.void2 : s < 2 ? PAL.earth3 : PAL.earth2);
          }
        }
        g.px(at.x, at.y, PAL.void3);
        g.px(at.x + 1, at.y, PAL.void2);
        g.px(at.x - 1, at.y, PAL.void2);
      }
    });
    return true;
  });
  return C;
}

// ================================================================ the mud lump (strike)

/**
 * The thrown lump at p: ~9 px glossy mud, a violet ember core, squash & stretch along its motion (`vx`, `vy`
 * px / s; `sq` 0..3 the wobble phase), a short tail of dripping mud lagging behind.
 */
export function drawBall(g: Raster, mk: MudMask, p: XY, sq: number, vx: number, vy: number): void {
  mk.clear();
  const sp = Math.hypot(vx, vy);
  const st = sp > 150 ? 1 : sp > 60 ? 0.5 : 0;
  const wob = sq % 4;
  const horiz = Math.abs(vx) >= Math.abs(vy);
  let rx = 4 + (horiz ? st : -st * 0.5);
  let ry = 4 + (horiz ? -st * 0.5 : st);
  if (wob === 1) rx += 0.6;
  else if (wob === 3) ry += 0.6;
  rx = Math.max(3, rx);
  ry = Math.max(3, ry);
  mk.ell(p.x, p.y, rx, ry);
  // the tail: two lumps behind, against the motion, sagging under gravity
  const L = sp || 1;
  const bx = -vx / L;
  const by = -vy / L;
  mk.disc(p.x + bx * (rx + 1), p.y + by * (ry + 1) + 1, 2.2);
  mk.disc(p.x + bx * (rx + 4), p.y + by * (ry + 4) + 2, 1.3);
  // a drip hanging under the belly
  mk.capsule(p.x - 1, p.y + ry, p.x - 1, p.y + ry + 1 + (wob & 1), 0.5);
  mk.wet(g, { phase: wob });
  // the ember (the spirit's violet, never outlined)
  g.px(p.x, p.y, PAL.void3);
  g.px(p.x + 1, p.y, wob & 1 ? PAL.void4 : PAL.void3);
  g.px(p.x, p.y + 1, PAL.void2);
  g.px(p.x + 1, p.y + 1, PAL.void2);
}

// ================================================================ the splat (strike contact)

/** The contact "şlap" at `at`: a violet pop, then a fat radial splash of glossy mud (≈280 ms), fat droplets. */
export function mudSplat(sc: Phaser.Scene, at: XY, floorY: number, depth: number, small: boolean, seed: number): Promise<void> {
  const R = rng(seed);
  const n = small ? 6 : 8;
  const lobes = Array.from({ length: n }, (_, i) => ({ a: (i / n) * TAU + (R() - 0.5) * 0.6, len: (small ? 6 : 9) + R() * (small ? 4 : 6), fat: 1.6 + R() * 0.9 }));
  const r = Raster.around(sc, at.x, at.y, 64, 48, depth);
  const mk = new MudMask(r.x, r.y, r.w, r.h);
  // fat droplets: glossy 2–3 px clods arcing out, landing on the floor and lying there a beat
  const sp = new Sparks(sc, depth - 0.1);
  for (let i = 0; i < (small ? 10 : 16); i++) {
    const a = -Math.PI * (0.05 + 0.9 * R());
    const v = 50 + R() * 100;
    sp.add({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.8 - 20, ay: 420, floor: floorY + Math.round((R() - 0.3) * 8), bounce: 0.05, life: 520 + R() * 300, colors: WET_DROPS, shape: 'sq', size: R() < 0.4 ? 3 : 2, fadeAt: 1 });
  }
  sp.release();
  return new Promise((res) => {
    let el = 0;
    onFrame(sc, (dt) => {
      el += dt;
      const step = Math.min(5, Math.floor(el / 48));
      r.draw((g) => {
        if (step === 0) {
          // the contact frame: the ember bursts — a violet pop, no white star
          g.disc(at.x, at.y, small ? 4 : 5, PAL.void2);
          g.disc(at.x, at.y, small ? 3 : 4, PAL.void3);
          g.disc(at.x, at.y, small ? 1 : 2, PAL.void4);
          return;
        }
        mk.clear();
        const k = [0, 0.6, 0.9, 1, 1, 1][step];
        const shrink = step >= 4 ? 0.6 : 1;
        mk.ell(at.x, at.y, small ? 4 : 5, small ? 3 : 4);
        for (const lb of lobes) {
          const L = lb.len * k;
          const ex = at.x + Math.cos(lb.a) * L;
          const ey = at.y + Math.sin(lb.a) * L * 0.7;
          mk.capsule(at.x, at.y, ex, ey, lb.fat * 0.6 * shrink);
          mk.disc(ex, ey, lb.fat * shrink);
        }
        mk.wet(g, { phase: step });
        if (step <= 2) {
          g.px(at.x, at.y, PAL.void3);
          g.px(at.x + 1, at.y, PAL.void2);
        }
      });
      if (el >= 290) {
        r.destroy();
        res();
        return false;
      }
      return true;
    });
  });
}

/**
 * The glob stuck on a struck body at `at` (kept relative to the body): an irregular wet blob with drips that
 * lengthen and slide ~8 px down, then shrinks off in steps (≈720 ms). Removed at once if the body goes.
 */
export function gooDecal(sc: Phaser.Scene, body: MonsterUnit | null, at: XY, depth: number, seed: number): void {
  const R = rng(seed);
  const s = body?.sprite ?? null;
  const ox = s ? at.x - s.x : 0;
  const oy = s ? at.y - s.y : 0;
  const r = new Raster(sc, 0, 0, 32, 38, depth);
  const mk = new MudMask(0, 0, 32, 38);
  const lumps = Array.from({ length: 3 }, () => ({ dx: Math.round((R() - 0.5) * 6), dy: Math.round((R() - 0.5) * 3), r: 1.6 + R() * 1.2 }));
  const drips = Array.from({ length: 3 }, (_, i) => ({ dx: i * 3 - 3 + Math.round((R() - 0.5) * 2), len: 2 + Math.round(R() * 3), sp: 70 + R() * 50 }));
  let el = 0;
  onFrame(sc, (dt) => {
    el += dt;
    const gone = (s && (!s.active || !s.visible)) || el >= 720;
    if (gone) {
      r.destroy();
      return false;
    }
    const bx = Math.round((s ? s.x : 0) + ox);
    const by = Math.round((s ? s.y : 0) + oy + Math.min(8, Math.floor(el / 80)));
    r.moveTo(bx - 16, by - 10);
    mk.x0 = bx - 16;
    mk.y0 = by - 10;
    if (s) r.img.setDepth(s.depth + 0.3);
    const fade = el < 480 ? 0 : el < 600 ? 1 : 2;
    r.draw((g) => {
      mk.clear();
      mk.ell(bx, by, fade === 2 ? 2.5 : 4, fade === 2 ? 1.5 : 2.5);
      if (fade < 2) for (const l of lumps) mk.disc(bx + l.dx, by + l.dy, l.r);
      for (const d of drips) {
        const L = Math.min(d.len + Math.floor(el / d.sp), d.len + 6) - fade * 3;
        if (L <= 0) continue;
        mk.capsule(bx + d.dx, by + 1, bx + d.dx, by + 1 + L, 0.6);
        mk.disc(bx + d.dx, by + 1 + L, 0.9);
      }
      mk.wet(g, { tones: fade === 0 ? WET : [PAL.earth0, PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth2] });
    });
    return true;
  });
}

/** A wet mud stain on the floor (glossy dark, a lit gloss dash; shrinks in steps over `ms`). */
export function floorStain(sc: Phaser.Scene, at: XY, rx: number, depth: number, ms = 700): void {
  const r = Raster.around(sc, at.x, at.y, rx * 2 + 8, rx + 8, depth);
  const mk = new MudMask(r.x, r.y, r.w, r.h);
  let el = 0;
  onFrame(sc, (dt) => {
    el += dt;
    if (el >= ms) {
      r.destroy();
      return false;
    }
    const k = el / ms;
    const q = k < 0.6 ? rx : k < 0.8 ? Math.round(rx * 0.6) : Math.round(rx * 0.3);
    r.draw((g) => {
      mk.clear();
      mk.ell(at.x, at.y, q, Math.max(1, Math.round(q / 3)));
      if (q > 4) mk.ell(at.x + Math.round(q * 0.6), at.y + 1, Math.round(q / 3), 1);
      mk.wet(g, { tones: [PAL.earth0, PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3], outline: null, gloss: q > 3 });
    });
    return true;
  });
}

// ================================================================ the pin: feet, the pool / ring, the hands

/** A foot of a unit (world x centre, half width) — scanned from its current frame's lowest rows. */
export interface Foot {
  x: number;
  hw: number;
}

/**
 * Find the attacker's real feet: opaque columns in the bottom 3 rows above its anchor, grouped into runs. The
 * hands grab THESE columns (any body plan); a floater / blob without separate feet gets two spots ± a third.
 */
export function scanFeet(u: MonsterUnit): Foot[] {
  const s = u.sprite;
  const a = u.art;
  const out: Foot[] = [];
  try {
    const tm = s.scene.textures;
    const key = s.texture.key;
    const fr = s.frame.name;
    const cols: number[] = [];
    for (let tx = 0; tx < a.w; tx++) {
      let hit = false;
      for (let ty = a.anchorY - 3; ty <= a.anchorY; ty++) if (ty >= 0 && ty < a.h && tm.getPixelAlpha(tx, ty, key, fr) > 0) hit = true;
      if (hit) cols.push(Math.round(u.framePoint(tx, a.anchorY).x));
    }
    cols.sort((p, q) => p - q);
    let run: number[] = [];
    const flush = () => {
      if (run.length >= 2) out.push({ x: Math.round((run[0] + run[run.length - 1]) / 2), hw: Math.max(1, Math.round((run[run.length - 1] - run[0]) / 2)) });
      run = [];
    };
    for (const x of cols) {
      if (run.length && x - run[run.length - 1] > 1) flush();
      run.push(x);
    }
    flush();
  } catch {
    /* no texture data: fall back */
  }
  // a single wide foot (a blob / a base) is split; nothing found → two spots under the core
  if (out.length === 1 && out[0].hw > 8) {
    const f = out[0];
    return [{ x: f.x - Math.round(f.hw / 2), hw: 3 }, { x: f.x + Math.round(f.hw / 2), hw: 3 }];
  }
  if (!out.length) {
    const x = Math.round(u.home.x);
    const d = Math.max(5, Math.round(a.w * 0.15));
    return [{ x: x - d, hw: 3 }, { x: x + d, hw: 3 }];
  }
  // the four outermost / most separate (a quadruped's legs)
  if (out.length > 4) {
    const keep = [out[0], out[out.length - 1]];
    const mid = out.slice(1, -1).sort((p, q) => q.hw - p.hw).slice(0, 2);
    return [...keep, ...mid].sort((p, q) => p.x - q.x);
  }
  return out;
}

const feetCache = new WeakMap<MonsterUnit, Foot[]>();
/** The unit's feet (scanned once per unit; walkers' feet never move in idle / guard, HA-9). */
export function feetOf(u: MonsterUnit, rescan = false): Foot[] {
  let f = feetCache.get(u);
  if (!f || rescan) {
    f = scanFeet(u);
    feetCache.set(u, f);
  }
  return f;
}

/** Ring geometry of a unit's tile: it reaches 4 px past its outermost feet (min 18, max 30). */
export function ringOf(u: MonsterUnit): { rx: number; ry: number } {
  const feet = feetOf(u);
  const cx = Math.round(u.home.x);
  let span = 0;
  for (const f of feet) span = Math.max(span, Math.abs(f.x - cx) + f.hw);
  const rx = Math.max(18, Math.min(30, span + 6));
  return { rx, ry: Math.max(8, Math.round(rx / 2)) };
}

interface PoolLook {
  /** 0 = a full pool, 1 = contracted into the 6-px band around a dark pit. */
  ring: number;
  /** 0..1 the surface bulges up (a dome under the feet). */
  bulge: number;
  t: number;
  /** Only rows ≥ clipY (the part in front of the body). */
  clipY?: number;
  /** Stepped 0..1 shrink of the band (an aura draining). */
  fade?: number;
}

/**
 * The pool / ring on a tile: a dark glossy band (ink outer edge, an earth0 body, its lit inner lip, two gloss
 * dashes that drift round it) around a violet-black pit with slow ripples sucking inward and a violet eye.
 */
function paintPool(g: Raster, mk: MudMask, at: XY, rx: number, ry: number, o: PoolLook): void {
  const clipY = o.clipY ?? -1e9;
  const k = clamp01(o.ring);
  const ix = Math.round((rx - 6) * k);
  const iy = Math.round((ry - 3) * k);
  const hasHole = ix >= 2 && iy >= 1;
  mk.clear();
  mk.ell(at.x, at.y, rx, ry);
  if (o.bulge > 0 && !hasHole) mk.ell(at.x, at.y - Math.round(o.bulge * 2), Math.round(rx * 0.5), Math.round(ry * 0.6));
  const inHole = (x: number, y: number) => {
    if (!hasHole) return false;
    const dx = (x - at.x) / ix;
    const dy = (y - at.y) / iy;
    return dx * dx + dy * dy <= 1;
  };
  // the band (or the full pool's surface)
  for (let y = mk.y0; y < mk.y0 + mk.h; y++) {
    if (y < clipY) continue;
    for (let x = mk.x0; x < mk.x0 + mk.w; x++) {
      const inside = mk.f(x, y);
      if (!inside) {
        if (mk.f(x - 1, y) || mk.f(x + 1, y) || (y > clipY && mk.f(x, y - 1)) || mk.f(x, y + 1)) g.px(x, y, PAL.ink);
        continue;
      }
      if (inHole(x, y)) continue;
      let c: number = PAL.earth0;
      if (!mk.f(x, y - 1)) c = PAL.earth1;
      if (hasHole && inHole(x, y + 1)) c = PAL.earth2; // the far inner wall catches the light
      else if (hasHole && inHole(x, y - 1)) c = PAL.earth1; // the near inner lip
      if (o.bulge > 0 && !hasHole) {
        // the dome: a lit crown, a wet body
        const dx = (x - at.x) / (rx * 0.5);
        const dy = (y - (at.y - Math.round(o.bulge * 2))) / (ry * 0.6);
        const d = dx * dx + dy * dy;
        if (d <= 1) c = d < 0.25 && y < at.y - 1 ? PAL.earth2 : PAL.earth1;
      }
      g.px(x, y, c);
    }
  }
  // gloss dashes drifting slowly round the band's far half (a wet surface, not clods)
  for (let i = 0; i < 2; i++) {
    const a = Math.PI * (1.15 + 0.35 * i) + Math.sin(o.t * 0.7 + i * 2) * 0.25;
    const q = { x: Math.round(at.x + Math.cos(a) * (rx - 2)), y: Math.round(at.y + Math.sin(a) * (ry - 1)) };
    for (let j = 0; j < 3; j++) if (q.y >= clipY && mk.f(q.x + j, q.y) && !inHole(q.x + j, q.y)) g.px(q.x + j, q.y, j === 0 ? PAL.earth4 : PAL.earth3);
  }
  // the near rim's wet catch
  const nq = { x: Math.round(at.x + Math.cos(Math.PI * 0.3) * (rx - 2)), y: Math.round(at.y + Math.sin(Math.PI * 0.3) * (ry - 1)) };
  if (nq.y >= clipY) {
    g.px(nq.x, nq.y, PAL.earth2);
    g.px(nq.x + 1, nq.y, PAL.earth3);
  }
  if (!hasHole) return;
  // the pit: violet-black, ripples sucked inward, the violet eye
  for (let y = at.y - iy; y <= at.y + iy; y++) {
    if (y < clipY) continue;
    for (let x = at.x - ix; x <= at.x + ix; x++) if (inHole(x, y)) g.px(x, y, PAL.void0);
  }
  for (let j = 0; j < 2; j++) {
    const ph = (o.t * 0.55 + j * 0.5) % 1;
    const qx = Math.round(ix * (1 - ph));
    const qy = Math.round(iy * (1 - ph));
    if (qx >= 2 && qy >= 1) {
      for (let s = 0; s < 40; s++) {
        const a = (s / 40) * TAU;
        const x = Math.round(at.x + Math.cos(a) * qx);
        const y = Math.round(at.y + Math.sin(a) * qy);
        if (y >= clipY && inHole(x, y)) g.px(x, y, s % 9 === 0 ? PAL.void2 : PAL.earth0);
      }
    }
  }
  const pulse = Math.floor(o.t * 3) % 3;
  const ey = { x: at.x, y: at.y };
  if (ey.y >= clipY) {
    g.px(ey.x - 1, ey.y, PAL.void2);
    g.px(ey.x + 1, ey.y, PAL.void2);
    g.px(ey.x, ey.y, pulse === 0 ? PAL.void4 : PAL.void3);
    if (pulse !== 2) {
      g.px(ey.x - 2, ey.y, PAL.void1);
      g.px(ey.x + 2, ey.y, PAL.void1);
    }
  }
}

/** Mud collars climbing the ankles (front part, over the body): a lit lip and a gloss dot each. */
function collars(mk: MudMask, at: XY, feet: readonly Foot[], h: number, t: number): void {
  if (h <= 0) return;
  feet.forEach((f, i) => {
    const wob = Math.round(Math.sin(t * 2.2 + i * 1.9) * 0.6);
    mk.ell(f.x, at.y - 1, f.hw + 2, Math.max(1, h + wob));
  });
}

/** Three violet seams out of the pool's rim across the floor (the spirit's light leaking up). */
function seepCracks(g: Raster, lines: XY[][], k: number, t: number): void {
  if (k <= 0) return;
  for (const pts of lines) {
    const n = Math.max(1, Math.round((pts.length - 1) * k));
    for (let i = 0; i <= n; i++) {
      const p = pts[i];
      g.px(p.x, p.y, PAL.ink);
      g.px(p.x, p.y + 1, (i + Math.floor(t * 10)) % 4 === 0 ? PAL.void3 : PAL.void2);
    }
  }
}

export interface PinGrab {
  /** 0..1 the mud seeps up under the feet (the pool grows). */
  seep: number;
  /** 0..1 the surface bulges, violet seams run out of the rim, bubbles boil. */
  stir: number;
  /** 0..1 the hands burst up (extension). */
  burst: number;
  /** 0..1 the hands wrap the feet (arch over, fingers close round the ankles). */
  grab: number;
  /** 0..1 the pool contracts to the 6-px ring around the pit. */
  ring: number;
  /** 0..1 the hands sink back into the ring. */
  sink: number;
  /** Mud collars on the ankles (px, 0 = none). */
  collar: number;
  destroy(): void;
}

interface GrabHand {
  foot: Foot;
  side: number;
  front: boolean;
  ph: number;
}

/**
 * The pin's grab on the attacker's tile. Two rasters: behind the body (the pool, back hands) and in front (the
 * pool's front half over the sunk feet, the ankle collars, front hands and every finger that wraps a foot).
 */
export function pinGrab(sc: Phaser.Scene, u: MonsterUnit, seed: number): PinGrab {
  const at = { x: Math.round(u.home.x), y: Math.round(u.home.y) };
  const feet = feetOf(u, true);
  const { rx, ry } = ringOf(u);
  const R = rng(seed);
  const s = u.sprite;
  const W = rx * 2 + 40;
  const H = 72;
  const X0 = at.x - Math.round(W / 2);
  const Y0 = at.y - 52;
  const back = new Raster(sc, X0, Y0, W, H, s.depth - 0.5);
  const front = new Raster(sc, X0, Y0, W, H, s.depth + 0.5);
  const mkP = new MudMask(X0, Y0, W, H);
  const mkB = new MudMask(X0, Y0, W, H);
  const mkF = new MudMask(X0, Y0, W, H);
  // one hand per foot (max 4), alternating behind / in front of the leg
  const hands: GrabHand[] = feet.slice(0, 4).map((f, i) => ({ foot: f, side: Math.sign(f.x - at.x) || (i % 2 ? 1 : -1), front: i % 2 === 0, ph: R() }));
  // violet seams out of the rim
  const seams: XY[][] = [0.35, 1.0, 1.6].map((a0) => {
    let a = a0 * Math.PI + (R() - 0.5) * 0.3;
    let p = { x: at.x + Math.cos(a) * (rx + 1), y: at.y + Math.sin(a) * (ry + 1) };
    const pts: XY[] = [rint(p)];
    for (let k = 0; k < 10; k++) {
      a += (R() - 0.5) * 0.6;
      p = { x: p.x + Math.cos(a) * 1.4, y: p.y + Math.sin(a) * 0.7 };
      pts.push(rint(p));
    }
    return pts;
  });
  const G: PinGrab = {
    seep: 0,
    stir: 0,
    burst: 0,
    grab: 0,
    ring: 0,
    sink: 0,
    collar: 0,
    destroy() {
      if (!alive) return;
      alive = false;
      stop();
      back.destroy();
      front.destroy();
    },
  };
  let alive = true;
  let el = 0;
  const stop = onFrame(sc, (dt) => {
    if (!alive) return false;
    el += dt;
    back.img.setDepth(s.depth - 0.5);
    front.img.setDepth(s.depth + 0.5);
    const t = el / 1000;
    const sk = clamp01(G.seep);
    const prx = Math.round(rx * sk);
    const pry = Math.max(1, Math.round(ry * sk));
    back.begin();
    front.begin();
    seepCracks(back, seams, Math.round(clamp01(G.stir) * 4) / 4, t);
    if (prx >= 3) {
      const look: PoolLook = { ring: G.ring, bulge: G.grab > 0 ? 0 : Math.round(clamp01(G.stir) * 3) / 3, t };
      paintPool(back, mkP, at, prx, pry, look);
      paintPool(front, mkP, at, prx, pry, { ...look, clipY: at.y - 1 });
      // bubbles boil while it seeps / stirs (glossy domes, violet pops)
      if (G.stir > 0.2 && G.ring < 0.5) {
        for (let i = 0; i < 4; i++) {
          const ph = (t * 2.8 + i * 0.29) % 1;
          const a = i * 1.9 + Math.floor(t * 2.8 + i * 0.29) * 2.3;
          const bx = Math.round(at.x + Math.cos(a) * prx * 0.6);
          const by = Math.round(at.y + Math.sin(a) * pry * 0.6);
          const g = by >= at.y - 1 ? front : back;
          if (ph < 0.7) {
            g.px(bx, by - 1, PAL.earth3);
            g.px(bx - 1, by, PAL.earth2);
            g.px(bx + 1, by, PAL.earth1);
            if (ph > 0.4) g.px(bx, by - 2, PAL.ink);
          } else {
            g.px(bx - 1, by, PAL.void3);
            g.px(bx + 1, by, PAL.void3);
            g.px(bx, by - 1, PAL.void4);
          }
        }
      }
    }
    // the hands: burst up beside each foot, arch over and wrap it, sink
    const up = clamp01(G.burst) * (1 - clamp01(G.sink));
    mkB.clear();
    mkF.clear();
    collars(mkF, at, feet, Math.round(G.collar), t);
    const bases: XY[] = [];
    if (up > 0.02) {
      for (const h of hands) {
        const by = at.y + (h.front ? 2 : -2);
        const base = { x: h.foot.x + h.side * (h.foot.hw + 5), y: by };
        bases.push(base);
        const wob = Math.sin(t * 11 + h.ph * TAU) * (G.grab > 0.5 ? 0.4 : 1);
        const g = clamp01(G.grab);
        // burst: straight up beside the leg, fingers splayed; grab: over onto the ankle, fingers hooked round it
        const hi = { x: base.x + h.side * 1 + wob, y: base.y - 15 * up };
        const ank = { x: h.foot.x + h.side * (h.foot.hw + 1), y: at.y - 6 };
        const tip = rint({ x: lerp(hi.x, ank.x, g), y: lerp(hi.y, ank.y, g) - Math.sin(Math.PI * g) * 3 * up });
        wetHand(h.front ? mkF : mkB, base, tip, {
          open: 1 - g,
          bend: h.side * (1 + 3 * g) * up,
          w: 2.1,
          cup: -h.side,
          fingers: g > 0.4 ? mkF : undefined,
          drip: g < 0.3 ? (t * 2 + h.ph) % 1 : -1,
          collar: up,
        });
      }
    }
    mkB.wet(back, { tones: WET_HAND, seepY: at.y + 3, phase: Math.floor(t * 8) });
    mkF.wet(front, { tones: WET_HAND, seepY: at.y + 3, phase: Math.floor(t * 8) });
    for (const b of bases) seepAt(b.y < at.y ? back : front, b, 2.1, t);
    back.end();
    front.end();
    return true;
  });
  return G;
}

/** The private padlock state of a unit's stat plate (StatBadge keeps it private; read-only peek). */
function plateLockOf(u: MonsterUnit): string | null {
  const b = u.badge as unknown as { lock?: string | null };
  return b && typeof b === 'object' && 'lock' in b ? (b.lock ?? null) : null;
}

/**
 * The persistent pin status on the attacker's tile (an aura; destroy() drains it in ≈260 ms): the glossy ring
 * with the violet pit and its breathing light, mud collars on the ankles, three small hands surfacing in turn
 * on the visible front arc and pawing at the feet. It drains itself on the very tick the plate's padlock goes.
 */
export function mudPinAura(sc: Phaser.Scene, u: MonsterUnit, seed: number): { destroy(): void } {
  const s = u.sprite;
  const R = rng(seed);
  const { rx, ry } = ringOf(u);
  const feet = feetOf(u);
  const W = rx * 2 + 34;
  const H = 56;
  const back = new Raster(sc, 0, 0, W, H, s.depth - 0.5);
  const front = new Raster(sc, 0, 0, W, H, s.depth + 0.5);
  const mkP = new MudMask(0, 0, W, H);
  const mkF = new MudMask(0, 0, W, H);
  const hands = [
    { a: Math.PI * 0.22, off: 0 },
    { a: Math.PI * 0.5, off: 0.36 },
    { a: Math.PI * 0.78, off: 0.68 },
  ].map((h) => ({ ...h, ph: R() }));
  const CYCLE = 2.6;
  let light: LightHandle | null = lightPool(sc, u.home.x, u.home.y, { color: PAL.void3, spill: PAL.void2, radius: rx + 6, floorY: u.home.y, intensity: 0, anim: 'breathe', fadeIn: 0 });
  light.setIntensity(0.8, 260);
  let dying = -1;
  let el = 0;
  let killed = false;
  let sawLock = false;
  const kill = () => {
    if (killed) return;
    killed = true;
    stop();
    back.destroy();
    front.destroy();
    const l = light;
    light = null;
    if (l && l.alive) void l.fadeOut(160);
  };
  const stop = onFrame(sc, (dt) => {
    if (!s.active || u.retired) {
      kill();
      return false;
    }
    el += dt;
    // the padlock is the truth: once it has shown and goes, the ring drains on the same tick
    const lock = plateLockOf(u);
    if (lock) sawLock = true;
    else if (sawLock && dying < 0) {
      dying = el;
      if (light) light.setIntensity(0, 200);
    }
    const t = el / 1000;
    const at = { x: Math.round(u.home.x), y: Math.round(u.home.y) };
    const x0 = at.x - Math.floor(W / 2);
    const y0 = at.y - 40;
    back.moveTo(x0, y0);
    front.moveTo(x0, y0);
    mkP.x0 = x0;
    mkP.y0 = y0;
    mkF.x0 = x0;
    mkF.y0 = y0;
    back.img.setDepth(s.depth - 0.5);
    front.img.setDepth(s.depth + 0.5);
    let k = 1;
    if (dying >= 0) {
      const d = el - dying;
      if (d > 260) {
        kill();
        return false;
      }
      k = d < 90 ? 1 : d < 180 ? 0.66 : 0.33;
    }
    back.begin();
    front.begin();
    if (s.visible) {
      const orx = Math.max(6, Math.round(rx * (k < 1 ? 0.55 + 0.45 * k : 1)));
      const ory = Math.max(3, Math.round(ry * (k < 1 ? 0.55 + 0.45 * k : 1)));
      const look: PoolLook = { ring: k < 0.5 ? 0.5 : 1, bulge: 0, t };
      paintPool(back, mkP, at, orx, ory, look);
      paintPool(front, mkP, at, orx, ory, { ...look, clipY: at.y - 1 });
      mkF.clear();
      if (k === 1) {
        collars(mkF, at, feet, 2, t);
        // the hands: surface (0–0.12), paw at the nearest foot (to 0.55), sink (to 0.68), gone
        for (const h of hands) {
          const ph = (t / CYCLE + h.off) % 1;
          if (ph > 0.68) continue;
          const up = ph < 0.12 ? ph / 0.12 : ph < 0.55 ? 1 : 1 - (ph - 0.55) / 0.13;
          const base = { x: Math.round(at.x + Math.cos(h.a) * (orx - 3)), y: Math.round(at.y + Math.sin(h.a) * (ory - 1)) };
          let nf = feet[0];
          for (const f of feet) if (Math.abs(f.x - base.x) < Math.abs(nf.x - base.x)) nf = f;
          const height = Math.round(9 * up);
          if (height < 3) continue;
          const paw = ph < 0.12 ? 0 : 0.35 + 0.35 * Math.sin((ph - 0.12) * 26 + h.ph * 3);
          const rest = { x: base.x + Math.round(Math.sin(t * 2 + h.ph * 5)), y: base.y - height };
          const ank = { x: nf.x + Math.sign(base.x - nf.x || 1) * (nf.hw + 1), y: at.y - 5 };
          const tip = rint({ x: lerp(rest.x, ank.x, paw), y: lerp(rest.y, ank.y, paw * 0.6) });
          wetHand(mkF, base, tip, { open: 1 - paw, w: 1.6, cup: Math.sign(base.x - nf.x || 1), collar: up, drip: (t * 1.5 + h.ph) % 1 });
        }
      }
      mkF.wet(front, { tones: WET_HAND, seepY: at.y + 3, phase: Math.floor(t * 6) });
    }
    back.end();
    front.end();
    return true;
  });
  return {
    destroy() {
      if (dying < 0 && !killed) dying = el;
    },
  };
}

/**
 * The dead spirit's mud reaching the attacker: a wide glossy stream with a lumpy head that two little hands
 * pull along, a violet glow on the head (light) and a dark wet trail that stays and dries back in steps.
 */
export function mudCrawl(sc: Phaser.Scene, from: XY, to: XY, ms: number, depth: number, seed: number): Promise<void> {
  const R = rng(seed);
  const minX = Math.min(from.x, to.x) - 14;
  const minY = Math.min(from.y, to.y) - 14;
  const r = new Raster(sc, minX, minY, Math.abs(to.x - from.x) + 28, Math.abs(to.y - from.y) + 28, depth);
  const mk = new MudMask(r.x, r.y, r.w, r.h);
  const tr = new MudMask(r.x, r.y, r.w, r.h);
  const wig = Array.from({ length: 9 }, () => (R() - 0.5) * 3);
  const at = (q: number): XY => ({ x: from.x + (to.x - from.x) * q, y: from.y + (to.y - from.y) * q + wig[Math.min(8, Math.floor(q * 8.99))] });
  const glow = lightPool(sc, from.x, from.y, { color: PAL.void3, spill: PAL.void2, radius: 12, floorY: from.y, intensity: 0.8, anim: 'flicker', fadeIn: 60 });
  const dir = Math.sign(to.x - from.x) || 1;
  const TOTAL = ms + 520;
  return new Promise((res) => {
    let el = 0;
    onFrame(sc, (dt) => {
      el += dt;
      const k = Math.min(1, el / ms);
      const tail = clamp01((el - ms * 0.45) / (ms * 0.7));
      const dry = clamp01((el - ms) / 520);
      const head = at(k);
      glow.setPosition(Math.round(head.x), Math.round(head.y), Math.round(head.y));
      r.draw((g) => {
        // the wet trail it leaves (dark, flat; dries back in three steps)
        tr.clear();
        const tw = dry < 0.34 ? 1.6 : dry < 0.67 ? 1 : 0.5;
        if (dry < 1)
          for (let i = 0; i <= 30; i++) {
            const q = i / 30;
            if (q > Math.min(k, tail + 0.02) || q > 1 - dry) continue;
            const p = at(q);
            tr.ell(p.x, p.y + 1, tw + 1, Math.max(0.6, tw * 0.6));
          }
        tr.wet(g, { tones: [PAL.earth0, PAL.earth0, PAL.earth1, PAL.earth1, PAL.earth2], outline: null, gloss: false });
        // the stream: 5 px wide, thickening into the head
        mk.clear();
        if (tail < 1) {
          for (let i = 0; i <= 30; i++) {
            const q = i / 30;
            if (q > k || q < tail) continue;
            const p = at(q);
            const nearHead = k - q < 0.12;
            mk.ell(p.x, p.y, nearHead ? 3.5 : 2.6, nearHead ? 2.6 : 1.8);
          }
          if (k > 0.05 && tail < 0.95) {
            // the head's two little hands, reaching forward and pulling (alternating)
            const pull = Math.floor(el / 90) & 1;
            for (const s of [-1, 1]) {
              const reach = (pull === (s > 0 ? 1 : 0) ? 6 : 3) as number;
              wetHand(mk, { x: head.x + dir * 2, y: head.y + s }, { x: head.x + dir * reach, y: head.y + s * 2 - 3 }, { w: 1.1, open: pull === (s > 0 ? 1 : 0) ? 1 : 0.3, cup: s, collar: 0 });
            }
          }
        }
        mk.wet(g, { seepY: 1e9, phase: Math.floor(el / 60) });
        if (tail < 0.95 && k > 0.05) {
          g.px(Math.round(head.x), Math.round(head.y), PAL.void3);
          g.px(Math.round(head.x) - dir, Math.round(head.y), PAL.void2);
        }
      });
      if (el >= TOTAL) {
        r.destroy();
        void glow.fadeOut(120);
        res();
        return false;
      }
      if (tail >= 1 && glow.alive) void glow.fadeOut(160);
      return true;
    });
  });
}

/** A violet burst out of a tile's cracks: seams flash out from the centre and fade in steps (`ms`). */
export function violetSeams(sc: Phaser.Scene, at: XY, reach: number, ms: number, depth: number, seed: number): Promise<void> {
  const R = rng(seed);
  const lines: XY[][] = Array.from({ length: 6 }, (_, i) => {
    let a = (i / 6) * TAU + (R() - 0.5) * 0.7;
    let p = { ...at };
    const pts: XY[] = [rint(p)];
    const L = reach * (0.6 + 0.4 * R());
    for (let k = 0; k < 8; k++) {
      a += (R() - 0.5) * 0.7;
      p = { x: p.x + (Math.cos(a) * L) / 8, y: p.y + (Math.sin(a) * L * 0.5) / 8 };
      pts.push(rint(p));
    }
    return pts;
  });
  const r = Raster.around(sc, at.x, at.y, reach * 2 + 10, reach + 10, depth);
  return new Promise((res) => {
    let el = 0;
    onFrame(sc, (dt) => {
      el += dt;
      const k = el / ms;
      const grow = Math.min(1, k * 3);
      const tone = k < 0.4 ? 0 : k < 0.7 ? 1 : 2;
      r.draw((g) => {
        for (const pts of lines) {
          const n = Math.round((pts.length - 1) * grow);
          for (let i = 0; i <= n; i++) {
            const p = pts[i];
            g.px(p.x, p.y, tone === 0 ? (i === n ? PAL.white : PAL.void4) : tone === 1 ? PAL.void3 : PAL.void1);
            if (tone < 2) g.px(p.x, p.y + 1, PAL.void2);
          }
        }
        if (tone === 0) g.ell(at.x, at.y, 3, 1.5, PAL.void3);
      });
      if (el >= ms) {
        r.destroy();
        res();
        return false;
      }
      return true;
    });
  });
}
