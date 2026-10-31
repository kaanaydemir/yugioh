// Kadran Soytarısı (dial_jester) — the card's own effect pieces (?look=v3 only; registers nothing: the `_` file is
// loaded by the cinematics glob but has no side effects). Used by ./dial_jester.ts and ./dial_jester-coin.ts.
//
//   jesterPoint(u, which)            the coin / key / head / hand of the frame on screen (world px)
//   jesterOffset(u, which, anim, f)  the same point of a given frame, relative to the feet (for travel aiming)
//   coinCanvas(w, r)                 one pixel frame of the spinning gold coin (the rig's own coin drawing + ink outline)
//   tileDial(sc, home, depth)        the giant dial reflected on a tile (the rig's floorDial, larger): set({k,hour,min,hot})
//   arenaDial(sc, opp, depth)        the faint dial ring over the whole arena: its "12" points at the opponent's side
//   clockStamp(sc, at, o)            the contact mark: a little clock face, both hands frozen at 12, then it ticks apart
//   crankSparks(sc, at, back, depth) one turn of the wind-up key: a ratchet spit of brass ticks
//   flipTrail(sc, get, ms, depth)    the somersault's dotted gold arc
//   popBurst(sc, at, floorY, depth)  the cuckoo pop: gold / white ticks fountain off the spring
//   bounceDust(sc, at, k, depth)     one damped bounce: two tiny floor puffs and a floor-light blink
//   gearsAndSprings(sc, home, dir, d) the death's final material: cogs roll away and fall flat, springs bounce, glass glints
//   flatCoin(r, cx, cy, wob, hot)    the coin lying on the marble (iso), wobbling on its rim
//   foldRect(sc, box, home, ms, d)   the rewind's card rectangle: closes round the body, lies down on the tile
//   spinCard(ctx, o)                 a card flying with a pixel-frame spin (face / edge / back / edge) along a path
//
// Pixel language (REHBER EF-6 / EF-7): 1-px lines, palette steps instead of alpha, whole-pixel positions, no
// scaled or rotated sprites (the coin's spin and the card's spin are pixel frames / texture swaps).

import Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import type { GameEvent, PlayerId } from '../../engine/types';
import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { ISO_CX, ISO_CY, ISO_TEX_H, ISO_TEX_W, cardIsoKey } from '../../art/cards';
import type { AnyMonsterAnim } from '../../art/types';
import { lightOf } from '../../art/rigkit';
import { framePose } from '../../art/monsters-v3/dial_jester-anims';
import { skeleton } from '../../art/monsters-v3/dial_jester-rig';
import { coin as drawCoin, cog, floorDial } from '../../art/monsters-v3/dial_jester-kit';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { sfx } from '../../audio/sfx';
import { BOARD_CENTER, DEPTH, zoneXY, LANE_MID, type XY } from '../../view/layout';
import { lightFlash } from '../../view/light';
import type { TileCard } from '../../view/TileCard';
import { Raster } from '../../vfx/setpieces';
import { Sparks, animate, onFrame } from '../../vfx/combat';
import type { CinematicContext } from '../_core/types';
import { landingCount } from '../_v3/card';
import { V3HOOKS } from '../v3small/_hooks';

type AnyCtx = CinematicContext<GameEvent>;

export const TAU = Math.PI * 2;
/** Floor marks just above the cards on the tiles. */
export const FLOOR_DEPTH = DEPTH.CARD_ON_TILE + 2;
const GOLDS = [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2] as const;

let seedV = 1;
/** Deterministic random (films repeat). */
export function seedFx(n: number): void {
  seedV = (Math.abs(Math.floor(n)) % 2147483646) + 1;
}
function rnd(): number {
  seedV = (seedV * 16807) % 2147483647;
  return (seedV - 1) / 2147483646;
}
export const RR = (a: number, b: number): number => a + (b - a) * rnd();
const rx = (p: XY): XY => ({ x: Math.round(p.x), y: Math.round(p.y) });
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// ================================================================ the jester's points

export type JesterPt = 'coin' | 'key' | 'head' | 'hand';

function skPt(anim: AnyMonsterAnim, f: number, which: JesterPt): readonly [number, number] {
  const sk = skeleton(framePose(anim, f));
  return which === 'coin' ? sk.coinC : which === 'key' ? sk.kc : which === 'head' ? sk.hc : sk.w1;
}

/** A point of the jester's skeleton on the frame on screen, in world px (null: gone / another art). */
export function jesterPoint(u: MonsterUnit, which: JesterPt): XY | null {
  if (!u.sprite.active || u.cardId !== 'dial_jester') return null;
  const fi = u.frameInfo();
  const p = skPt(fi.anim ?? 'idle', fi.frame, which);
  return rx(u.framePoint(Math.floor(p[0]) + 0.5, Math.floor(p[1]) + 0.5));
}

/** The point of frame `f` relative to the feet (P2 mirrored). */
export function jesterOffset(u: MonsterUnit, which: JesterPt, anim: AnyMonsterAnim, f: number): XY {
  const p = skPt(anim, f, which);
  const sgn = u.flipX ? -1 : 1;
  return { x: Math.round(sgn * (p[0] - u.art.anchorX)), y: Math.round(p[1] - u.art.anchorY) };
}

// ================================================================ the coin

const COIN_CACHE = new Map<string, PixelCanvas>();
/** The coin's pixel frame: `w` = cos of the flip (1 heads / 0 edge / −1 tails), radius r; ink-outlined, 1 px margin. */
export function coinCanvas(w: number, r: number, far = false): PixelCanvas {
  const key = `${Math.round(w * 20)}:${r}:${far ? 1 : 0}`;
  let q = COIN_CACHE.get(key);
  if (!q) {
    const S = r * 2 + 6;
    q = new PixelCanvas(S, S);
    drawCoin(q, { cx: S / 2, cy: S / 2, r, w: Math.round(w * 20) / 20, far }, lightOf('left'));
    q.outline(PAL.ink);
    COIN_CACHE.set(key, q);
  }
  return q;
}

/** The 8 spin phases of a turning coin (heads → edge → tails → edge). */
export const SPIN_W = [1, 0.7, 0.05, -0.7, -1, -0.7, -0.05, 0.7] as const;

/** Blit a coin frame centred on world (x, y) into a raster. */
export function blitCoin(r: Raster, x: number, y: number, w: number, rad: number): void {
  const q = coinCanvas(w, rad);
  r.pc.blit(q, Math.round(x) - r.x - (q.w >> 1), Math.round(y) - r.y - (q.h >> 1));
}

/**
 * The coin lying on the marble (iso: an ellipse 2:1) wobbling on its rim: `wob` 0..1 how far it rocks (0 = flat
 * and still), `ph` the phase of the rock (rad), `hot` a white glint on the rim.
 */
export function flatCoin(r: Raster, cx: number, cy: number, rad: number, wob: number, ph: number, hot = 0): void {
  // the rocking lifts one side of the rim: the ellipse's ry swells and its centre shifts up a pixel
  const tilt = wob * Math.sin(ph);
  const ry = Math.max(2, Math.round(rad * 0.5 + Math.abs(tilt) * 2));
  const ox = Math.round(Math.cos(ph) * wob * 1.4);
  const x = Math.round(cx) + ox;
  const y = Math.round(cy - Math.abs(tilt) * 1.5);
  // the shadow first (lies still)
  for (let dx = -rad; dx <= rad; dx++) if ((dx & 1) === 0) r.px(Math.round(cx) + dx, Math.round(cy) + ry - 1, PAL.ink);
  r.ell(x, y + 1, rad, ry, PAL.gold1);
  r.ell(x, y, rad, ry, PAL.gold2);
  r.ell(x - 1, y - 1, rad - 2, Math.max(1, ry - 1), PAL.gold3);
  r.ring(x, y, rad, ry, PAL.ink);
  // the glint walks round the rim with the rock
  const ga = ph + Math.PI;
  r.px(Math.round(x + Math.cos(ga) * (rad - 1)), Math.round(y + Math.sin(ga) * (ry - 1)), hot > 0.5 ? PAL.white : PAL.gold4);
  r.px(Math.round(x - 2), Math.round(y - 1), PAL.gold4);
}

// ================================================================ the dial on a tile

export interface DialState {
  /** presence 0..1 */
  k: number;
  hour: number;
  min: number;
  hot?: number;
}

/** The giant dial reflected on a tile (pure light pixels; the rig's floorDial at tile size). */
export function tileDial(sc: Phaser.Scene, home: XY, depth: number = FLOOR_DEPTH, size = 1): { set(s: DialState): void; destroy(): void } {
  const RXD = Math.round(30 * size);
  const RYD = Math.round(15 * size);
  const r = Raster.around(sc, home.x, home.y, RXD * 2 + 12, RYD * 2 + 10, depth, Phaser.BlendModes.NORMAL);
  return {
    set(s) {
      r.draw((g) => floorDial(g.pc, { cx: home.x - g.x, cy: home.y - g.y, rx: RXD, ry: RYD, hour: s.hour, min: s.min, k: s.k, hot: s.hot ?? 0 }));
    },
    destroy() {
      r.destroy();
    },
  };
}

// ================================================================ the arena dial

export interface ArenaDial {
  /** presence 0..1 (dither density + tone step) */
  k: number;
  /** hand angles in DIAL degrees (0 = the "12" = toward the opponent) */
  hour: number;
  min: number;
  /** result flash 0..1 */
  hot: number;
  /** extra glow on the side of the dial at this dial angle (deg; null = none) */
  glowAt: number | null;
  /** The world point at a dial angle and radius fraction. */
  at(deg: number, k: number): XY;
  readonly center: XY;
  destroy(): void;
}

/**
 * The faint dial ring over the whole arena (YENI_KARTLAR §C2 step 2), lying on the floor over the tile cards: a
 * dithered bezel, 12 tick marks, two long hands from the board centre. Its 12 points at `opp`'s monster row.
 */
export function arenaDial(sc: Phaser.Scene, opp: PlayerId, depth: number = FLOOR_DEPTH + 1): ArenaDial {
  const c = rx(BOARD_CENTER);
  const RXA = 214;
  const RYA = 107;
  const r = Raster.around(sc, c.x, c.y, RXA * 2 + 16, RYA * 2 + 14, depth);
  // the screen direction of the opponent's row, in dial space (the iso ellipse unsquashed)
  const t = zoneXY(opp, 'monster', LANE_MID);
  const base = Math.atan2((t.x - c.x) / RXA, -(t.y - c.y) / RYA);
  const ptAt = (deg: number, k: number): XY => {
    const a = base + (deg * Math.PI) / 180;
    return { x: Math.round(c.x + Math.sin(a) * RXA * k), y: Math.round(c.y - Math.cos(a) * RYA * k) };
  };
  const d: ArenaDial = {
    k: 0,
    hour: 0,
    min: 0,
    hot: 0,
    glowAt: null,
    at: ptAt,
    center: c,
    destroy() {
      stop();
      r.destroy();
    },
  };
  const stop = onFrame(sc, (_dt, el) => {
    if (!r.alive) return false;
    r.draw((g) => {
      const k = d.k;
      if (k <= 0.01) return;
      const lvl = Math.min(1, k);
      const hot = d.hot > 0.5;
      // the bezel: a 1-px ring (every pixel while k is high, every other one while it fades in) and a dithered
      // inner ring, brighter near the glow side
      const n = 900;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const x = Math.floor(c.x + Math.cos(a) * RXA);
        const y = Math.floor(c.y + Math.sin(a) * RYA);
        if (k < 0.6 && (x + y) % 2) continue;
        g.px(x, y, hot ? PAL.gold4 : k > 0.66 ? PAL.gold3 : PAL.gold2);
        if (k > 0.4) g.dpx(c.x + Math.cos(a) * (RXA - 5), c.y + Math.sin(a) * (RYA - 2.5), PAL.gold1, (lvl - 0.4) * 1.2);
      }
      if (d.glowAt !== null) {
        for (let s = -16; s <= 16; s++) {
          const p = ptAt(d.glowAt + s, 1);
          g.px(p.x, p.y, Math.abs(s) < 6 ? PAL.white : PAL.gold4);
          const q = ptAt(d.glowAt + s, 0.97);
          g.px(q.x, q.y, PAL.gold3);
        }
      }
      // 12 ticks pointing in (the "12" a double bright bar); a sparkle runs round the ticks
      for (let i = 0; i < 12; i++) {
        const deg = i * 30;
        const a = ptAt(deg, 0.98);
        const b = ptAt(deg, i % 3 === 0 ? 0.86 : 0.92);
        const col = i === 0 ? (hot ? PAL.white : PAL.gold4) : i % 3 === 0 ? PAL.gold3 : PAL.gold2;
        g.line(a.x, a.y, b.x, b.y, col);
        if (i === 0) {
          for (const off of [-3, 3]) {
            const a2 = ptAt(off, 0.98);
            const b2 = ptAt(off, 0.84);
            g.line(a2.x, a2.y, b2.x, b2.y, col);
          }
        }
      }
      const sparkle = Math.floor(el / 45) % 12;
      const sp = ptAt(sparkle * 30, 0.95);
      g.px(sp.x, sp.y, PAL.white);
      // the hands: short, from the hub, tapering to a bright tip with an arrow head (they read as clock hands,
      // not as beams); they pass under the bodies (floor depth)
      const hand = (deg: number, k2: number, body: number, tip: number, w: number) => {
        const e = ptAt(deg, k2);
        const m = ptAt(deg, k2 * 0.75);
        g.line(c.x, c.y, m.x, m.y, body, 1, w);
        g.line(m.x, m.y, e.x, e.y, tip);
        const l1 = ptAt(deg - 7, k2 * 0.88);
        const l2 = ptAt(deg + 7, k2 * 0.88);
        g.line(l1.x, l1.y, e.x, e.y, tip);
        g.line(l2.x, l2.y, e.x, e.y, tip);
        g.px(e.x, e.y, PAL.white);
      };
      hand(d.hour, 0.3, hot ? PAL.gold3 : PAL.gold2, PAL.gold4, 2);
      hand(d.min, 0.5, hot ? PAL.gold4 : PAL.gold3, hot ? PAL.white : PAL.gold4, 1);
      g.disc(c.x, c.y, 3, PAL.gold3);
      g.ring(c.x, c.y, 3, 3, PAL.ink);
      g.px(c.x, c.y, PAL.white);
    });
    return true;
  });
  return d;
}

// ================================================================ contact: the frozen clock

/**
 * The contact mark: a little clock face (1-px ring, 12 ticks, both hands straight up at 12) pops on the struck
 * point and holds through the hit-stop — then it ticks apart: the ring breaks into its 12 tick pixels flying out.
 */
export function clockStamp(sc: Phaser.Scene, at: XY, o: { depth?: number; big?: boolean; cracked?: boolean } = {}): void {
  const R = o.big ? 11 : 8;
  const p = rx(at);
  const r = Raster.around(sc, p.x, p.y, R * 2 + 8, R * 2 + 8, o.depth ?? DEPTH.FX + 2);
  const draw = (k: number) =>
    r.draw((g) => {
      g.ring(p.x, p.y, R, R, k < 0.5 ? PAL.white : PAL.gold4);
      g.ring(p.x, p.y, R + 1, R + 1, PAL.gold2, 0.5);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        g.px(Math.round(p.x + Math.sin(a) * (R - 2)), Math.round(p.y - Math.cos(a) * (R - 2)), i % 3 === 0 ? PAL.white : PAL.gold3);
      }
      // both hands at 12 (the minute one longer), the hub
      g.line(p.x, p.y, p.x, p.y - (R - 3), PAL.white);
      g.line(p.x + 1, p.y, p.x + 1, p.y - Math.round(R * 0.5), PAL.gold4);
      g.px(p.x, p.y, PAL.gold4);
      if (o.cracked) g.line(p.x - R + 2, p.y + 2, p.x + 2, p.y - 3, PAL.ink);
    });
  draw(0);
  // the stamp lives on scene time (it freezes with the hit-stop), then breaks into ticks
  void animate(sc, 90, (t) => draw(t)).then(() => {
    r.destroy();
    const sp = new Sparks(sc, (o.depth ?? DEPTH.FX + 2) + 0.1);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const v = RR(60, 110) * (o.big ? 1.3 : 1);
      sp.add({ x: p.x + Math.sin(a) * R, y: p.y - Math.cos(a) * R, vx: Math.sin(a) * v, vy: -Math.cos(a) * v * 0.8 - 10, ay: 160, drag: 2.5, life: RR(220, 340), colors: i % 3 === 0 ? [PAL.white, PAL.gold4, PAL.gold3] : [PAL.gold4, PAL.gold3, PAL.gold2], shape: 'px', fadeAt: 1, flicker: i % 2 === 0 });
    }
    sp.release();
  });
}

// ================================================================ strike pieces

/** One turn of the key: a ratchet spit of brass ticks flying back off the key. */
export function crankSparks(sc: Phaser.Scene, at: XY, back: number, depth: number): void {
  const sp = new Sparks(sc, depth);
  for (let i = 0; i < 5; i++) {
    sp.add({ x: at.x, y: at.y, vx: back * RR(40, 90), vy: RR(-70, -20), ay: 260, drag: 1.5, life: RR(180, 260), colors: i === 0 ? [PAL.white, PAL.gold4] : [PAL.gold4, PAL.gold3, PAL.gold2], shape: 'px', fadeAt: 1, delay: i * 18 });
  }
  sp.release();
}

/** The somersault's trail: a dotted gold arc behind the moving coin (every other point white). */
export function flipTrail(sc: Phaser.Scene, get: () => XY | null, ms: number, depth: number): void {
  const pts: XY[] = [];
  const r = new Raster(sc, 0, 0, 640, 360, depth);
  onFrame(
    sc,
    (_dt, el) => {
      if (!r.alive) return false;
      const p = el < ms ? get() : null;
      if (p && (!pts.length || Math.hypot(p.x - pts[pts.length - 1].x, p.y - pts[pts.length - 1].y) >= 3)) pts.push(p);
      const fade = el < ms ? 0 : (el - ms) / 160;
      if (fade >= 1) return false;
      r.draw((g) => {
        const n = pts.length;
        for (let i = 0; i < n; i++) {
          const age = (n - 1 - i) / Math.max(1, n);
          if (age > 0.85 - fade * 0.85) continue;
          if (i % 2 === 1 && age > 0.3) continue;
          g.px(pts[i].x, pts[i].y, age < 0.15 ? PAL.white : age < 0.45 ? PAL.gold4 : PAL.gold2);
        }
      });
      return true;
    },
    () => r.destroy(),
  );
}

// ================================================================ summon pieces

/** The cuckoo pop: gold / white ticks fountain off the spring and bounce on the floor. */
export function popBurst(sc: Phaser.Scene, at: XY, floorY: number, depth: number): void {
  const sp = new Sparks(sc, depth);
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI / 2 + RR(-0.9, 0.9);
    const v = RR(70, 130);
    sp.add({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 300, life: RR(420, 620), floor: floorY + RR(-3, 3), bounce: 0.4, colors: i % 4 === 0 ? [PAL.white, PAL.gold4] : [PAL.gold4, PAL.gold3, PAL.gold2], shape: i % 5 === 0 ? 'plus' : 'px', fadeAt: 0.85 });
  }
  sp.release();
}

/** One damped bounce: two tiny floor puffs either side of the feet and a floor-light blink. */
export function bounceDust(sc: Phaser.Scene, at: XY, k: number, depth: number): void {
  const sp = new Sparks(sc, depth);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 2; i++) sp.add({ x: at.x + s * 4, y: at.y, vx: s * RR(20, 40) * k, vy: RR(-12, -4), drag: 4, life: RR(160, 240), colors: [PAL.mist, PAL.steel, PAL.night4], shape: 'px', fadeAt: 0.6 });
  }
  sp.release();
  void lightFlash(sc, at.x, at.y - 2, PAL.gold3, Math.round(12 + 8 * k), 160, { floorY: at.y, intensity: 0.35 + 0.35 * k });
}

// ================================================================ death: springs fly, cogs roll

/**
 * The death's final material (YENI_KARTLAR §5.2 C2): three cogs roll off over the marble, slow down, wobble and
 * fall flat; two coil springs bounce away; a few glints of the dial glass. Own pixel frames (no sprite turns).
 */
export function gearsAndSprings(sc: Phaser.Scene, home: XY, dir: 1 | -1, depth: number): void {
  const r = Raster.around(sc, home.x, home.y - 16, 150, 80, depth);
  const gears = [
    { x: home.x + dir * 2, v: dir * RR(55, 70), r: 3, n: 8, turn: 0, y: home.y + 1, fall: 0 },
    { x: home.x - dir * 3, v: -dir * RR(40, 55), r: 2, n: 6, turn: 0.3, y: home.y - 1, fall: 0 },
    { x: home.x + dir * 6, v: dir * RR(25, 35), r: 2, n: 6, turn: 0.6, y: home.y + 3, fall: 0 },
  ];
  const springs = [
    { x: home.x, y: home.y - 18, vx: -dir * 55, vy: -90 },
    { x: home.x + dir * 2, y: home.y - 20, vx: dir * 70, vy: -110 },
  ];
  const glints = Array.from({ length: 5 }, () => ({ x: home.x + RR(-10, 10), y: home.y + RR(-3, 4), t: RR(0, 500) }));
  const brass = { H: PAL.gold4, L: PAL.gold3, M: PAL.gold2, S: PAL.gold1 };
  const MS = 1100;
  void animate(sc, MS, (t, el, dt) => {
    const s = dt / 1000;
    r.draw((g) => {
      for (const gr of gears) {
        // rolling friction: the cog slows, then wobbles and falls flat (an iso ellipse)
        gr.v *= Math.exp(-2.2 * s);
        gr.x += gr.v * s;
        gr.turn += (gr.v * s) / (TAU * gr.r);
        if (Math.abs(gr.v) < 9) gr.fall = Math.min(1, gr.fall + s * 4);
        const fade = t > 0.85 ? (t - 0.85) / 0.15 : 0;
        if (fade > 0.66) continue;
        const cx = Math.round(gr.x);
        if (gr.fall < 1) cog(g.pc, cx - g.x + 0.5, gr.y - gr.r - g.y + 0.5 + gr.fall * gr.r, gr.r, gr.n, gr.turn, brass);
        else {
          g.ell(cx, gr.y, gr.r + 1, 1, fade > 0.33 ? PAL.gold1 : PAL.gold2);
          g.px(cx - 1, gr.y - 1, PAL.gold3);
        }
      }
      for (const sp of springs) {
        sp.vy += 340 * s;
        sp.x += sp.vx * s;
        sp.y += sp.vy * s;
        if (sp.y > home.y + 2 && sp.vy > 0) {
          sp.y = home.y + 2;
          sp.vy *= -0.45;
          sp.vx *= 0.6;
        }
        if (t > 0.8) continue;
        // a coil spring: a zig-zag 2 px wide, its length breathing with the bounce
        const len = 5 + Math.round(Math.abs(sp.vy) / 60);
        const x = Math.round(sp.x);
        const y = Math.round(sp.y);
        for (let i = 0; i <= len; i++) g.px(x + (i % 2 ? 1 : -1), y - i, i % 2 ? PAL.stone4 : PAL.mist);
        g.px(x, y - len - 1, PAL.white);
      }
      for (const gl of glints) {
        const ph = el - gl.t;
        if (ph > 0 && ph < 90) g.px(Math.round(gl.x), Math.round(gl.y), ph < 45 ? PAL.white : PAL.mist);
      }
    });
  }).then(() => r.destroy());
}

// ================================================================ rewind: the card rectangle

/**
 * The rewind's fold (C2 step 4): a gold card rectangle closes round the body's box to an upright card, then lies
 * down on the tile in three steps (upright → tilted → flat iso diamond). Resolves when it lies flat.
 */
export function foldRect(sc: Phaser.Scene, box: { x: number; y: number; w: number; h: number }, home: XY, ms: number, depth: number): Promise<void> {
  const r = new Raster(sc, 0, 0, 640, 360, depth);
  const CW = 16;
  const CH = 22;
  const close = Math.round(ms * 0.6);
  return animate(sc, ms, (t, el) => {
    r.draw((g) => {
      if (el < close) {
        // closing: the rectangle shrinks from the body's box to the card (whole px, 4 steps)
        const k = Math.min(1, Math.floor((el / close) * 4) / 3);
        const w = Math.round(lerp(box.w + 4, CW, k));
        const h = Math.round(lerp(box.h + 4, CH, k));
        const cx = Math.round(lerp(box.x + box.w / 2, home.x, k));
        const by = Math.round(lerp(box.y + box.h + 2, home.y - 2, k));
        const x0 = cx - (w >> 1);
        const y0 = by - h;
        if (k >= 1) g.rect(x0 + 1, y0 + 1, w - 2, h - 2, PAL.night1);
        g.line(x0, y0, x0 + w - 1, y0, PAL.gold4);
        g.line(x0, y0 + h - 1, x0 + w - 1, y0 + h - 1, PAL.gold3);
        g.line(x0, y0, x0, y0 + h - 1, PAL.gold4);
        g.line(x0 + w - 1, y0, x0 + w - 1, y0 + h - 1, PAL.gold2);
        // the card's gold diamond appears in the last step
        if (k >= 1) {
          g.px(cx, y0 + (h >> 1) - 2, PAL.gold4);
          g.line(cx - 2, y0 + (h >> 1), cx + 2, y0 + (h >> 1), PAL.gold3);
          g.px(cx, y0 + (h >> 1) + 2, PAL.gold4);
        }
        return;
      }
      // lying down: upright → tilted (a parallelogram) → flat (the iso diamond on the tile)
      const step = Math.min(2, Math.floor(((el - close) / (ms - close)) * 3));
      const hx = CW / 2;
      if (step === 0) {
        g.poly([{ x: home.x - hx, y: home.y - 2 }, { x: home.x + hx, y: home.y - 2 }, { x: home.x + hx + 3, y: home.y - 14 }, { x: home.x - hx + 3, y: home.y - 14 }], PAL.night1);
        g.path([{ x: home.x - hx, y: home.y - 2 }, { x: home.x + hx, y: home.y - 2 }, { x: home.x + hx + 3, y: home.y - 14 }, { x: home.x - hx + 3, y: home.y - 14 }, { x: home.x - hx, y: home.y - 2 }], PAL.gold4);
      } else {
        const d = step === 1 ? 0.7 : 1;
        const pts = [
          { x: home.x - 14 * d, y: home.y },
          { x: home.x, y: home.y - 7 * d },
          { x: home.x + 14 * d, y: home.y },
          { x: home.x, y: home.y + 7 * d },
        ];
        g.poly(pts, step === 2 ? PAL.gold2 : PAL.night1, step === 2 ? 0.5 : 1);
        g.path([...pts, pts[0]], step === 2 ? PAL.white : PAL.gold4);
      }
    });
  }).then(() => r.destroy());
}

/** A small floor dial ring under a rewinding body: its hands race BACKWARDS for `ms`, then it shrinks away. */
export function rewindRing(sc: Phaser.Scene, home: XY, ms: number, depth: number = FLOOR_DEPTH): Promise<void> {
  const d = tileDial(sc, home, depth, 0.8);
  return animate(sc, ms, (t, el) => {
    const k = t < 0.15 ? t / 0.15 : t > 0.8 ? (1 - t) / 0.2 : 1;
    d.set({ k: Math.max(0.05, k), hour: (720 - el * 0.9) % 360, min: (720 - el * 3.6) % 360, hot: t > 0.4 && t < 0.5 ? 1 : 0 });
  }).then(() => d.destroy());
}

// ================================================================ a spinning card

export interface SpinCardOpts {
  owner: PlayerId;
  cardId: CardId;
  /** where it is born (the tile's home) */
  from: XY;
  tile?: TileCard | null;
  /** the path (t 0..1 → world point), ending on the pile / the panel */
  path: (t: number) => XY;
  ms: number;
  /** spin phases per second (4 phases = one turn) */
  rate?: number;
  depth?: number;
  /** land on the owner's graveyard pile at the end (count / top / bump) */
  land?: boolean;
  trail?: readonly number[];
}

/**
 * A card flying with a pixel-frame spin: face-up, edge (the 'side' texture), the back, edge — never a rotated or
 * scaled sprite. Born on the tile (the tile card is swapped for it), lands on the graveyard pile when `land`.
 */
export async function spinCard(ctx: AnyCtx, o: SpinCardOpts): Promise<void> {
  const sc = ctx.scene;
  const from = rx(o.from);
  const keys = [cardIsoKey(o.cardId, 'up', o.owner), cardIsoKey(o.cardId, 'side', o.owner), cardIsoKey('back', 'up', o.owner), cardIsoKey('back', 'side', o.owner)].map((k) => (sc.textures.exists(k) ? k : cardIsoKey(o.cardId, 'up', o.owner)));
  const img = sc.add.image(from.x, from.y, keys[0]).setOrigin(ISO_CX / ISO_TEX_W, ISO_CY / ISO_TEX_H).setDepth(o.depth ?? DEPTH.FX + 5);
  if (o.tile && o.tile.active) o.tile.destroy();
  const trail = new Sparks(sc, (o.depth ?? DEPTH.FX + 5) - 0.1);
  const cols = o.trail ?? [PAL.white, PAL.gold4, PAL.gold3];
  let lastT = -99;
  const rate = o.rate ?? 12;
  await animate(sc, o.ms, (t, el) => {
    if (!img.active) return;
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const p = rx(o.path(e));
    img.setPosition(p.x, p.y);
    const ph = Math.floor((el / 1000) * rate) % 4;
    // the edge frames ('side') read as the card turning through 90°
    img.setTexture(keys[ph]);
    if (el - lastT >= 28 && t < 0.92) {
      lastT = el;
      trail.add({ x: p.x, y: p.y + 1, vy: 4, life: 200, colors: cols, shape: 'px', fadeAt: 1 });
    }
  });
  trail.release();
  if (!o.land) {
    img.destroy();
    return;
  }
  const pile = ctx.views.field.pile(o.owner, 'graveyard');
  const count = landingCount(pile.count, ctx.after?.players?.[o.owner]?.graveyard?.length);
  const at = pile.topXY();
  const accept = V3HOOKS.pileAccept;
  img.setTexture(keys[0]);
  if (accept) {
    pile.set(count, o.cardId);
    accept(ctx, { owner: o.owner, cardId: o.cardId, pile, at, count, card: img });
    return;
  }
  try {
    sfx.play('cardPlace', { volume: 0.45, pitch: 0.9 });
  } catch {
    /* no audio */
  }
  pile.set(count, o.cardId);
  pile.bump();
  img.destroy();
}
