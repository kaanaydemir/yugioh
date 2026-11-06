// Kum Saati Cücesi (hourglass_imp) — the SAND SEAL: painters (cage, time line, emblem, floor hairline) and the
// persistent seal manager (docs/v3/oturum-f/hourglass_imp.md §5.6, §0.9 rev. 1 #1 #2 #4 #5 #8 #12).
// Exports only: every registration lives in ./hourglass_imp.ts behind LOOK_V3 (this file registers nothing).
//
// The seal is kept per TARGET uid (not as a unit aura: a face-down card has no unit, and a unit rebuilt by
// FieldView.sync loses its custom auras). Each frame it follows the face-up unit (its head) or the face-down tile.
//   emblem    a 7 × 11 hourglass floating over the head: brass caps, a mist glass edge on the lit side, a dark
//             interior, the top bulb full of sand and a gold3 dash FROZEN mid-neck — "time stopped here". It bobs
//             1 px every 640 ms; every 2.4 s one grain tries to fall (1 px) and is refused.
//   floor     the cage's bottom cap left behind: a thin gold1 / gold2 2:1 hairline ellipse with two brass studs
//             (no sand collar: rev. 1 #2) and one gold glint walking round it, plus the emblem's small light pool
// Beats (no engine events of their own; started in the background by the turnStart / phaseChange handlers):
//   bite      turn T+1 starts: the emblem flashes gold4, the grain twitches and is refused, the hairline tightens
//   strain    that player enters the battle phase: the hairline clamps (gold flash), the grain strains twice,
//             the sealed body is nudged 1 px forward and sinks back (we never drive its frames: rev. 1 #8)
//   thaw      the end phase of T+1 ("the stolen turn is spent"): the dash drops, the stream runs, the top bulb
//             empties in 4 steps, the emblem pops into 6 grains that fall, the hairline fades in palette steps
//   drop      the sealed monster leaves the field early: the emblem falls 8 px and its grains scatter

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { monsterFrame } from '../../art/textures';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { TileCard } from '../../view/TileCard';
import type { GameState, PlayerId, Uid } from '../../engine/types';
import { DEPTH, type XY, unitDepth } from '../../view/layout';
import { lightPool, type LightHandle } from '../../view/light';
import { Raster } from '../../vfx/setpieces';
import { Sparks, animate, onFrame } from '../../vfx/combat';
import type { DuelViews } from '../../duel/types';
import { onDuelStart } from '../../duel/seeds';
import { panAt, play } from '../_v3/sound';

// ================================================================ small helpers

export const rint = (p: XY): XY => ({ x: Math.round(p.x), y: Math.round(p.y) });
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const live = (u: MonsterUnit | null | undefined): MonsterUnit | null => (u && !u.retired && u.sprite.active ? u : null);

/** Deterministic grain noise (per uid; no module stream to reset). */
export function hash(a: number, b = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The silhouette box of a unit's idle f0 in world space (head top, half width), whole pixels. */
export function bodyOf(u: MonsterUnit): { cx: number; top: number; floor: number; hw: number } {
  const b = monsterFrame(u.cardId, 'idle', 0).bounds();
  const a = u.art;
  const box = b ?? { x: 0, y: 0, w: a.w, h: a.h };
  const t = u.framePoint(box.x + box.w / 2, box.y);
  return { cx: Math.round(t.x), top: Math.round(t.y), floor: Math.round(u.home.y), hw: Math.round(box.w / 2) };
}

/**
 * Round 2 #3: the emblem's anchor — the unit's HEAD (its `head` point on idle f0, else the front of a long body or the
 * centre of a tall one), and the top
 * of its silhouette in that head's column (±2 px), in world space. Never the cage's bbox: a long body (a wolf with
 * back flames) would put the emblem over its back, under the arena's wall props.
 */
export function headOf(u: MonsterUnit): { x: number; top: number } {
  const pc = monsterFrame(u.cardId, 'idle', 0);
  const b = pc.bounds() ?? { x: 0, y: 0, w: u.art.w, h: u.art.h };
  const hp = u.art.points ? u.art.points('idle', 0).head : undefined;
  // without a head point (a v1 art): monsters face RIGHT in their frame — on a long body (a wolf, a drake) the head
  // sits just behind its muzzle (never the back flames in the middle); on a tall one, the bbox centre
  let hx = Math.round(b.x + b.w / 2);
  if (hp) hx = Math.round(hp.x);
  else if (b.w >= b.h) hx = Math.round(Math.max(b.x + b.w * 0.6, Math.min(b.x + b.w - 3, u.art.muzzle.x - 4)));
  // the top of the silhouette in the head's own column (±2 px); a head point lower than that is kept as the floor
  let top = hp ? Math.round(hp.y) : Infinity;
  for (let y = 0; y < pc.h; y++) {
    let hit = false;
    for (let x = hx - 2; x <= hx + 2; x++) if (pc.isOpaque(x, y)) hit = true;
    if (hit) {
      top = Math.min(top, y);
      break;
    }
  }
  if (!Number.isFinite(top)) top = b.y;
  const w = u.framePoint(hx + 0.5, top);
  return { x: Math.round(w.x), top: Math.round(w.y) };
}

/** The 1-px rim of light just outside the unit's CURRENT frame silhouette (world px). */
export function rimOf(u: MonsterUnit): XY[] {
  const fi = u.frameInfo();
  if (!fi.anim) return [];
  const pc = monsterFrame(u.cardId, fi.anim, fi.frame);
  const out: XY[] = [];
  for (let y = 0; y < pc.h; y++)
    for (let x = 0; x < pc.w; x++) {
      if (pc.isOpaque(x, y)) continue;
      if (pc.isOpaque(x - 1, y) || pc.isOpaque(x + 1, y) || pc.isOpaque(x, y - 1) || pc.isOpaque(x, y + 1)) {
        const p = u.framePoint(x + 0.5, y + 0.5);
        out.push({ x: Math.floor(p.x), y: Math.floor(p.y) });
      }
    }
  return out;
}

// ================================================================ the cage (the giant hourglass round the target)

export interface CageGeo {
  cx: number;
  /** under the top cap */
  top: number;
  /** the floor (bottom cap) */
  bot: number;
  /** bulb half width */
  R: number;
}

export interface CageLook {
  /** wall growth 0…1 (the outlines stepping out from the stream) */
  grow: number;
  /** sand in the lower bulb, px */
  fill: number;
  /** stream phase (frames); frozen = the dash stands */
  ph: number;
  stream: boolean;
  /** 1: the white flash frame of THE STOP */
  white?: boolean;
  /** draw the caps (0 none, 1 top only, 2 both) */
  caps: number;
  /** the walls' tone (mist; gold4 on the bite flash) */
  wall?: number;
  /** sand shown up to this row only (condense: the sand rises into the top) */
  topSand?: number;
}

/** Half width of the cage at screen row y. */
function cageR(g: CageGeo, y: number, grow: number): number {
  const H = g.bot - g.top;
  const ym = g.top + H / 2;
  const t = Math.min(1, Math.abs(y - ym) / (H / 2));
  return 1 + (g.R - 1) * Math.sin((Math.min(1, t / 0.82) * Math.PI) / 2) * grow;
}

/** Paint the cage on a world raster: walls, caps, the stream, the lower bulb's sand. Never fills over the body (EF-2). */
export function paintCage(r: Raster, g: CageGeo, o: CageLook): void {
  const wall = o.white ? PAL.white : (o.wall ?? PAL.mist);
  const H = g.bot - g.top;
  const ym = Math.round(g.top + H / 2);
  // the sand in the lower bulb (front of the feet): earth3 body, earth4 top band, a gold3 crest line
  // Round 1 #10: clipped to the bulb's curve, a mounded surface (the crest is highest under the stream and slopes 2 px
  // down to the glass), a gold3 crest pixel per column over an earth4 band — sand in a bulb, not a slab
  if (o.fill > 0) {
    const sTop = g.bot - Math.round(o.fill);
    const rMax = Math.max(1, Math.floor(cageR(g, sTop, o.grow)) - 1);
    for (let y = sTop; y <= g.bot; y++) {
      const rr = Math.floor(cageR(g, y, o.grow)) - 1;
      for (let x = -rr; x <= rr; x++) {
        const top = sTop + Math.round((Math.abs(x) / rMax) * Math.min(3, o.fill * 0.4) + (Math.abs(x) > 1 && (x & 3) === 1 ? 0.6 : 0));
        if (y < top) continue;
        const c = y === top ? (Math.abs(x) <= 1 ? PAL.gold4 : PAL.gold3) : y <= top + 1 ? PAL.earth4 : (x * 7 + y * 13) % 11 === 0 ? PAL.earth4 : PAL.earth3;
        r.px(g.cx + x, y, c);
      }
    }
  }
  if (o.grow > 0) {
    for (let y = g.top; y <= g.bot; y++) {
      const rr = Math.round(cageR(g, y, o.grow));
      r.px(g.cx - rr, y, wall);
      r.px(g.cx + rr, y, o.white ? PAL.white : y < ym ? PAL.stone3 : wall);
      // the bulbs' widest rows: the lit (left) wall is 2 px thick, so the glass reads as a solid curve
      if (rr >= g.R - 2 && rr > 3) r.px(g.cx - rr + 1, y, o.white ? PAL.white : PAL.steel);
    }
  }
  // the stream: a gold3 dash with gold4 heads marching down the neck to the sand (frozen: it stands)
  if (o.stream) {
    const end = o.fill > 0 ? g.bot - Math.round(o.fill) - 1 : g.bot - 1;
    for (let y = g.top + 1; y <= end; y++) {
      const k = (((y - Math.round(o.ph)) % 7) + 7) % 7;
      if (k === 6) continue;
      r.px(g.cx, y, k === 5 ? PAL.gold4 : PAL.gold3);
    }
  }
  if (o.caps > 0) capBar(r, g.cx, g.top - 1, g.R);
  if (o.caps > 1) floorRing(r, g.cx, g.bot, g.R + 2, PAL.gold2, PAL.gold1, -1);
}

/** The brass top cap: a 2-row bar (gold2 over gold1) with a 1-px ink outline and an earth (wood) knob. */
export function capBar(r: Raster, cx: number, y: number, hw: number): void {
  for (let x = -hw - 1; x <= hw + 1; x++) {
    r.px(cx + x, y - 2, PAL.ink);
    r.px(cx + x, y + 1, PAL.ink);
  }
  r.px(cx - hw - 1, y - 1, PAL.ink);
  r.px(cx - hw - 1, y, PAL.ink);
  r.px(cx + hw + 1, y - 1, PAL.ink);
  r.px(cx + hw + 1, y, PAL.ink);
  for (let x = -hw; x <= hw; x++) {
    r.px(cx + x, y - 1, PAL.gold2);
    r.px(cx + x, y, x < -hw + 2 ? PAL.gold2 : PAL.gold1);
  }
  // wooden end blocks (Round 1 #10): 2 px of dark wood at each end, one row taller than the bar
  if (hw >= 4)
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const x = cx + sx * (hw - k);
        r.px(x, y - 2, k === 0 ? PAL.ink : PAL.earth2);
        r.px(x, y - 1, PAL.earth1);
        r.px(x, y, PAL.earth0);
      }
    }
  r.px(cx, y - 3, PAL.ink);
  r.px(cx - 1, y - 3, PAL.ink);
  r.px(cx + 1, y - 3, PAL.ink);
}

/** A 2:1 hairline ellipse on the floor (stepped, whole px): back half `back`, front half `front`, two brass studs. */
export function floorRing(r: Raster, cx: number, cy: number, rx: number, front: number, back: number, glint: number): void {
  const ry = Math.max(1, rx / 2);
  const n = Math.max(24, Math.round(rx * 5));
  let lx = NaN;
  let ly = NaN;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * rx);
    const y = Math.round(cy + Math.sin(a) * ry);
    if (x === lx && y === ly) continue;
    lx = x;
    ly = y;
    r.px(x, y, Math.sin(a) > 0 ? front : back);
  }
  r.px(Math.round(cx - rx), Math.round(cy), PAL.gold2);
  r.px(Math.round(cx + rx), Math.round(cy), PAL.gold2);
  if (glint >= 0) {
    const a = glint * Math.PI * 2;
    r.px(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), PAL.gold3);
  }
}

// ================================================================ the time line (the only link: still grains)

/** The stepped parabola from the imp's glass to the target's cap: one grain every 4 px (whole pixels). */
export function timeLine(a: XY, b: XY, apex: number): XY[] {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(4, Math.round(d / 4));
  const out: XY[] = [];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    out.push({ x: Math.round(lerp(a.x, b.x, t)), y: Math.round(lerp(a.y, b.y, t) - 4 * apex * t * (1 - t)) });
  }
  return out;
}

// ================================================================ the emblem (7 × 11 + outline)

export interface EmblemLook {
  /** top bulb sand rows (0…3) */
  top: number;
  /** the dash: frozen at its rest (0), twitch (+1), or running (phase ≥ 10: marching) */
  dash: number;
  run?: number;
  /** flash: the glass edge gold4 (the bite) */
  flash?: boolean;
  /** the lower bulb's heap (rows 0…2) */
  heap: number;
  /** Round 2 #3: the outer gold halo (default on) */
  halo?: boolean;
}

/** Paint the emblem with its bottom-centre at (cx, by) on a raster (world px). Lit side `side` (−1 left). */
export function paintEmblem(r: Raster, cx: number, by: number, side: -1 | 1, o: EmblemLook): void {
  const x0 = cx - 4;
  const y0 = by - 12;
  const W: { y: number; a: number; b: number }[] = [
    { y: 2, a: 2, b: 6 },
    { y: 3, a: 2, b: 6 },
    { y: 4, a: 3, b: 5 },
    { y: 5, a: 4, b: 4 },
    { y: 6, a: 4, b: 4 },
    { y: 7, a: 3, b: 5 },
    { y: 8, a: 2, b: 6 },
    { y: 9, a: 2, b: 6 },
  ];
  const P = (x: number, y: number, c: number) => r.px(x0 + x, y0 + y, c);
  // outline (ink) round caps + bulbs
  const solid = new Set<string>();
  for (let x = 1; x <= 7; x++) {
    solid.add(`${x},1`);
    solid.add(`${x},10`);
  }
  for (const w of W) for (let x = w.a; x <= w.b; x++) solid.add(`${x},${w.y}`);
  // Round 2 #3: a 1-px gold halo outside the ink (gold3 on the lit side, gold2 on the other) so the emblem is the
  // brightest point over the monster and separates from any wall prop behind it; then the ink backing
  const ink = new Set<string>();
  for (const k of solid) {
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!solid.has(`${x + dx},${y + dy}`)) ink.add(`${x + dx},${y + dy}`);
  }
  if (o.halo !== false)
    for (const k of ink) {
      const [x, y] = k.split(',').map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const q = `${x + dx},${y + dy}`;
        if (solid.has(q) || ink.has(q)) continue;
        const litSide = side < 0 ? x + dx <= 4 : x + dx >= 4;
        P(x + dx, y + dy, o.flash ? PAL.gold4 : litSide ? PAL.gold3 : PAL.gold2);
      }
    }
  for (const k of ink) {
    const [x, y] = k.split(',').map(Number);
    P(x, y, PAL.ink);
  }
  // caps: brass
  for (let x = 1; x <= 7; x++) {
    const lit = side < 0 ? x <= 4 : x >= 4;
    P(x, 1, lit ? PAL.gold2 : PAL.gold1);
    P(x, 10, lit ? PAL.gold2 : PAL.gold1);
  }
  // glass: dark interior, a lit edge (mist) on the lit side, night2 on the other
  for (const w of W) {
    for (let x = w.a; x <= w.b; x++) P(x, w.y, PAL.night1);
    const litX = side < 0 ? w.a : w.b;
    const shX = side < 0 ? w.b : w.a;
    if (w.b > w.a) {
      P(litX, w.y, o.flash ? PAL.gold4 : PAL.mist);
      P(shX, w.y, o.flash ? PAL.gold3 : PAL.night2);
    }
  }
  // the top bulb's sand (rows 2…4 from the neck up): earth4
  const rows = [4, 3, 2];
  for (let i = 0; i < Math.min(3, o.top); i++) {
    const w = W.find((q) => q.y === rows[i])!;
    for (let x = w.a + (w.b > w.a ? 1 : 0); x <= w.b - (w.b > w.a ? 1 : 0); x++) P(x, w.y, i === Math.min(3, o.top) - 1 ? PAL.earth4 : PAL.earth3);
  }
  // the heap in the lower bulb
  if (o.heap >= 1) for (let x = 3; x <= 5; x++) P(x, 9, PAL.earth3);
  if (o.heap >= 2) P(4, 8, PAL.earth4);
  // the dash: frozen mid-neck (rows 5–7), or running
  if (o.run !== undefined) {
    for (let y = 5; y <= 8; y++) if ((y + o.run) % 3 !== 0) P(4, y, (y + o.run) % 3 === 2 ? PAL.gold4 : PAL.gold3);
  } else if (o.top > 0) {
    const d = o.dash;
    P(4, 5 + d, PAL.gold4);
    P(4, 6 + d, PAL.gold4);
    P(4, 7 + d, PAL.gold3);
  }
}

// ================================================================ the seal manager

interface Seal {
  uid: Uid;
  scene: Phaser.Scene;
  views: DuelViews;
  /** emblem raster (small) and the floor hairline raster (world) */
  em: Raster;
  fl: Raster;
  pool: LightHandle | null;
  stop: () => void;
  born: number;
  /** extra look: tightened px, flash until (ms), strain until, gone */
  tight: number;
  flashUntil: number;
  twitchUntil: number;
  /** Round 2 #3: the strain's grains climbing its legs (px, 0 none) */
  climb: number;
  /** a beat drives the emblem itself (thaw / drop) */
  busy: boolean;
  dead: boolean;
  last: { cx: number; by: number; fx: number; fy: number; rx: number } | null;
  side: -1 | 1;
}

const seals = new Map<Uid, Seal>();
/** Targets whose seal is being animated by the effect right now (the reconcile must not pop one in). */
export const animating = new Set<Uid>();

onDuelStart(() => {
  for (const s of [...seals.values()]) disposeSeal(s);
  seals.clear();
  animating.clear();
});

export function hasSeal(uid: Uid): boolean {
  return seals.has(uid);
}

/** Where a sealed uid stands now: its unit (face-up) or its tile (face-down). */
function anchorOf(views: DuelViews, uid: Uid): { unit: MonsterUnit | null; tile: TileCard | null } {
  const u = live(views.field.unit(uid));
  if (u) return { unit: u, tile: null };
  const t = views.field.tileOf(uid);
  return { unit: null, tile: t && t.active ? t : null };
}

/** The emblem's bottom-centre and the floor ring for the current anchor. */
export function sealSpot(views: DuelViews, uid: Uid): { cx: number; by: number; fx: number; fy: number; rx: number; side: -1 | 1; unit: MonsterUnit | null } | null {
  const a = anchorOf(views, uid);
  if (a.unit) {
    const b = bodyOf(a.unit);
    const u = a.unit;
    const hd = headOf(u);
    return { cx: Math.round(u.sprite.x - u.rest0.x + hd.x), by: Math.max(22, hd.top - 3), fx: Math.round(u.home.x), fy: Math.round(u.home.y + 1), rx: Math.max(9, Math.min(18, b.hw + 3)), side: u.player === 1 ? 1 : -1, unit: u };
  }
  if (a.tile) {
    const h = a.tile.home;
    return { cx: Math.round(h.x), by: Math.round(h.y - 10), fx: Math.round(h.x), fy: Math.round(h.y), rx: 15, side: a.tile.player === 1 ? 1 : -1, unit: null };
  }
  return null;
}

function disposeSeal(s: Seal): void {
  if (s.dead) return;
  s.dead = true;
  s.stop();
  s.em.destroy();
  s.fl.destroy();
  s.pool?.fadeOut(200);
  seals.delete(s.uid);
}

/** Pop a seal in (no cinematic: the effect's condense ends here, or a reconcile restores a staged one). */
export function addSeal(scene: Phaser.Scene, views: DuelViews, uid: Uid, o: { fresh?: boolean } = {}): void {
  if (seals.has(uid)) return;
  const sp = sealSpot(views, uid);
  if (!sp) return;
  const em = new Raster(scene, 0, 0, 640, 360, DEPTH.FX - 2);
  const fl = new Raster(scene, 0, 0, 640, 360, DEPTH.SHADOW + 1);
  const pool = lightPool(scene, sp.cx, sp.by - 6, { color: PAL.gold3, radius: 10, intensity: 0.7, air: 0.5, floorY: sp.fy, anim: 'breathe', fadeIn: o.fresh ? 60 : 200 });
  const s: Seal = { uid, scene, views, em, fl, pool, stop: () => undefined, born: scene.time.now, tight: 0, flashUntil: 0, twitchUntil: 0, climb: 0, busy: false, dead: false, last: null, side: sp.side };
  seals.set(uid, s);
  let el = 0;
  s.stop = onFrame(scene, (dt) => {
    if (s.dead) return false;
    el += dt;
    if (!s.busy) drawSeal(s, el);
    return true;
  });
}

/** One frame of the seal at rest: follow the anchor, bob, twitch, the walking glint. */
function drawSeal(s: Seal, el: number): void {
  const sp = sealSpot(s.views, s.uid);
  if (!sp) {
    // the anchor is gone (the monster left the field): the emblem falls with it
    dropSeal(s);
    return;
  }
  s.last = { cx: sp.cx, by: sp.by, fx: sp.fx, fy: sp.fy, rx: sp.rx };
  s.side = sp.side;
  const now = s.scene.time.now;
  const bob = Math.floor(el / 640) % 2 ? -1 : 0;
  const twitch = now < s.twitchUntil || el % 2400 > 2280 ? 1 : 0;
  const by = sp.by + bob;
  const flash = now < s.flashUntil;
  s.em.draw((r) => {
    paintEmblem(r, sp.cx, by, sp.side, { top: 3, dash: twitch, heap: 1, flash });
    // the strain: sand grains climb its legs (front of the body) in whole px, then hold
    if (s.climb > 0) {
      const n = 7;
      for (let i = 0; i < n; i++) {
        const x = sp.fx + Math.round(((i - (n - 1) / 2) * (sp.rx - 2)) / ((n - 1) / 2) * 0.55);
        const h = Math.max(1, s.climb - (i % 2));
        for (let k = 0; k < h; k++) r.px(x, sp.fy - k, k === h - 1 ? PAL.gold3 : k === 0 ? PAL.earth3 : PAL.earth4);
        r.px(x + 1, sp.fy, PAL.earth3);
      }
    }
  });
  s.em.img.setDepth(sp.unit ? unitDepth(sp.fy) + 0.6 : DEPTH.UNIT + sp.fy + 0.6);
  const glint = (el % 1200) / 1200;
  s.fl.draw((r) => floorRing(r, sp.fx, sp.fy, sp.rx - s.tight, flash ? PAL.gold4 : PAL.gold2, flash ? PAL.gold3 : PAL.gold1, glint));
  s.pool?.setPosition(sp.cx, by - 6, sp.fy);
}

/** The sealed monster left the field: the emblem falls 8 px (120 ms) and its grains scatter in 2 steps. */
function dropSeal(s: Seal): void {
  if (s.busy || s.dead) return;
  const at = s.last;
  if (!at) {
    disposeSeal(s);
    return;
  }
  s.busy = true;
  s.pool?.fadeOut(160);
  s.pool = null;
  play('hgiEmblemDrop', { volume: 0.7, pan: panAt(at.cx) });
  void animate(s.scene, 120, (k) => {
    const y = Math.round(at.by + 8 * k * k);
    s.em.draw((r) => paintEmblem(r, at.cx, y, s.side, { top: 3, dash: 1, heap: 1 }));
    s.fl.draw((r) => floorRing(r, at.fx, at.fy, at.rx, k < 0.5 ? PAL.gold1 : PAL.earth1, PAL.earth1, -1));
  }).then(() => {
    const sp = new Sparks(s.scene, DEPTH.FX - 2);
    for (let i = 0; i < 8; i++) sp.add({ x: at.cx + Math.round((hash(s.uid, i) - 0.5) * 8), y: at.by + 4, vx: (hash(s.uid, i + 9) - 0.5) * 60, vy: -20 - hash(s.uid, i + 3) * 30, ay: 260, floor: at.fy + 1, bounce: 0.1, life: 300, colors: [PAL.earth4, PAL.earth3, PAL.gold3], shape: 'px', fadeAt: 1 });
    sp.release();
    disposeSeal(s);
  });
}

/** Beat: turn T+1 starts — the emblem flashes gold4, the grain twitches and is refused, the hairline tightens. */
export function biteSeal(uid: Uid, delay = 0): void {
  const s = seals.get(uid);
  if (!s || s.busy) return;
  void animate(s.scene, delay + 420, (_k, el) => {
    if (el < delay) return;
    const t = el - delay;
    const now = s.scene.time.now;
    // Round 2 #3: a 2-beat gold4 flash (emblem + ring) and the ring stepping IN 2 px, readable at 1×
    if (t < 90 || (t > 150 && t < 230)) s.flashUntil = now + 20;
    if (t > 80 && t < 260) s.twitchUntil = now + 20;
    s.tight = t < 60 ? 0 : t < 120 ? 1 : 2;
  }).then(() => undefined);
  const at = s.last;
  void s.scene.time.delayedCall(delay, () => play('hgiBite', { volume: 0.8, pan: panAt(at?.cx ?? 320) }));
}

/** Beat: the sealed monster's battle phase — the hairline clamps, the grain strains twice, a 1-px nudge. */
export function strainSeal(uid: Uid, delay = 0): void {
  const s = seals.get(uid);
  if (!s || s.busy) return;
  const sc = s.scene;
  const u = live(s.views.field.unit(uid));
  const dir = u ? (u.flipX ? -1 : 1) : 0;
  let nudged = false;
  void animate(sc, delay + 480, (_k, el) => {
    if (el < delay) return;
    const t = el - delay;
    const now = sc.time.now;
    s.tight = t < 160 ? 2 : t < 320 ? 3 : 2;
    // Round 2 #3: grains climb 3 px up its legs (1 → 2 → 3), hold, then slide back
    s.climb = t < 60 ? 1 : t < 120 ? 2 : t < 380 ? 3 : t < 440 ? 2 : 0;
    if ((t > 40 && t < 140) || (t > 220 && t < 320)) s.twitchUntil = now + 20;
    if (t > 160 && t < 320) s.flashUntil = now + 20;
    // a whole-pixel 1-px nudge forward (it tries), then back (it cannot)
    if (u && !u.retired && u.sprite.active && !u.claimed) {
      const want = t > 60 && t < 300;
      if (want !== nudged) {
        nudged = want;
        u.sprite.x = Math.round(u.rest0.x + (want ? dir : 0));
      }
    }
  }).then(() => {
    s.climb = 0;
    if (u && nudged && u.sprite.active) u.sprite.x = u.rest0.x;
  });
  void sc.time.delayedCall(delay, () => play('hgiStrain', { volume: 0.85, pan: panAt(s.last?.cx ?? 320) }));
}

/** Beat: the stolen turn is spent — the emblem runs out, pops into grains, the hairline fades. ≈ 560 ms. */
export function thawSeal(uid: Uid, delay = 0): void {
  const s = seals.get(uid);
  if (!s || s.busy) return;
  s.busy = true;
  const sc = s.scene;
  void sc.time.delayedCall(delay, () => play('hgiThaw', { volume: 0.85, pan: panAt(s.last?.cx ?? 320) }));
  let popped = false;
  void animate(sc, delay + 560, (_k, el) => {
    const sp = sealSpot(s.views, s.uid);
    if (sp) s.last = { cx: sp.cx, by: sp.by, fx: sp.fx, fy: sp.fy, rx: sp.rx };
    const at = s.last;
    if (!at) return;
    if (el < delay) {
      drawSeal(s, el);
      return;
    }
    const t = el - delay;
    // the sand runs: 4 steps of 60 ms empty the top bulb into the lower one
    if (t < 280) {
      const step = Math.min(3, Math.floor(t / 70));
      s.em.draw((r) => paintEmblem(r, at.cx, at.by, s.side, { top: 3 - step, dash: 0, run: Math.floor(t / 34), heap: 1 + (step >= 2 ? 1 : 0) }));
    } else if (!popped) {
      popped = true;
      s.em.draw(() => undefined);
      s.pool?.fadeOut(160);
      s.pool = null;
      const g = new Sparks(sc, DEPTH.FX - 2);
      for (let i = 0; i < 6; i++)
        g.add({ x: at.cx - 3 + i + (i > 2 ? 1 : 0), y: at.by - 5 + (i % 2), vx: (i - 2.5) * 10, vy: -26 + (i % 3) * 6, ay: 300, floor: at.fy, bounce: 0.1, life: 340, colors: i % 2 ? [PAL.gold3, PAL.earth4] : [PAL.earth4, PAL.earth3], shape: 'px', fadeAt: 1 });
      g.release();
    }
    // the hairline: gold2 → gold1 → earth1 → gone (palette steps)
    const fade = Math.floor(Math.max(0, t - 200) / 90);
    s.fl.draw((r) => {
      if (fade >= 3) return;
      const f = [PAL.gold2, PAL.gold1, PAL.earth1][fade];
      const b = [PAL.gold1, PAL.earth1, PAL.earth0][fade];
      floorRing(r, at.fx, at.fy, at.rx - s.tight + Math.min(2, fade), f, b, -1);
    });
  }).then(() => disposeSeal(s));
}

/** Every seal that stands on a slot frozen up to (and including) `turn`, by uid (engine truth). */
export function frozenUids(st: GameState): { uid: Uid; player: PlayerId; index: number; until: number }[] {
  const out: { uid: Uid; player: PlayerId; index: number; until: number }[] = [];
  for (const p of [0, 1] as PlayerId[])
    st.players[p].monsters.forEach((m, i) => {
      if (m && m.noAttackTurn !== undefined && st.turn <= m.noAttackTurn) out.push({ uid: m.uid, player: p, index: i, until: m.noAttackTurn });
    });
  return out;
}

/**
 * Reconcile the seals with an engine state (rev. 1 #5): a staged / restored board gets its emblems (popped in, no
 * cinematic); a seal whose slot is gone or whose turn is over goes (silently: the beats played their own ends).
 */
export function reconcileSeals(scene: Phaser.Scene, views: DuelViews, st: GameState): void {
  const want = new Set<Uid>();
  for (const f of frozenUids(st)) {
    want.add(f.uid);
    if (!seals.has(f.uid) && !animating.has(f.uid)) addSeal(scene, views, f.uid);
  }
  const onField = new Set<Uid>();
  for (const p of [0, 1] as PlayerId[]) for (const m of st.players[p].monsters) if (m) onField.add(m.uid);
  // expired on the field: gone silently; left the field: drawSeal() sees the anchor go and drops it
  for (const s of [...seals.values()]) if (!want.has(s.uid) && !s.busy && onField.has(s.uid)) disposeSeal(s);
}

export function sealUids(): Uid[] {
  return [...seals.keys()];
}
