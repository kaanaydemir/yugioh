// v3 POSE MATCH (docs/v3/A0_ENVANTER.md §6.2 items 1–2; plan §4 "Bekleme ↔ saldırı ↔ darbe ↔
// bekleme geçişlerinde poz sıçraması olmaz"): where a death pose may start from the recoil pose a
// blow left the body in, without a one-frame jump.
//
//   const plan = planDeathEntry(u, ['hitMagic', 'hit'], 120);   // react.ts, a lethal blow
//   // → the recoil plays to plan.hold and holds there; the death starts on plan.start
//   const j = deathStartFrom(u);                                 // death.ts, no plan: from the frame shown
//
// The pixel delta of two frames (the colour or opacity of a pixel differs) is read from the unit's
// own sheet (P1 or P2 relight) and normalised by the monster's mean idle delta (idleΔ), the same
// measure as tools/monster-sheet.ts. Starting the death later than its frame 0 skips drawn
// frames, so it costs SKIP_COST × idleΔ per frame. Lazily painted sheet frames that are still
// blank give no answer (the caller keeps its default: hold the reaction's frame 0, start the
// death on 0). The pure chooser (chooseEntry) is unit-tested.

import type Phaser from 'phaser';
import { frameRGBA } from '../../art/atlas';
import type { AnyMonsterAnim } from '../../art/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';

/** Cost of each skipped death frame, in idleΔ. */
export const SKIP_COST = 0.6;
/** Death frames the start may skip at most. */
export const MAX_SKIP = 3;
/** A reaction whose best entry costs more than this looks for a better recoil (another hit anim). */
export const GOOD_ENTRY = 1.5;

export interface DeathEntry {
  /** The recoil anim that plays (the blow's own, or a better-matching one). */
  anim: AnyMonsterAnim;
  /** Its frame the recoil stops on and holds until the death starts. */
  hold: number;
  /** The death frame the death pose starts on. */
  start: number;
  /** Δ(hold, start) / idleΔ + SKIP_COST × start. */
  cost: number;
  /**
   * ms from the plan's start to the death's first frame when more than the recoil plays first (a
   * guard break, ./guardbreak.ts: the bridge + the recoil; an in-between before the struck frame,
   * react.ts); default: the recoil up to `hold`.
   */
  leadMs?: number;
  /** Δ(the frame shown when the blow landed, the recoil's f0) / idleΔ, when it was measured. */
  into?: number;
}

/**
 * The best (hold, start) pair of one recoil: `delta(r, j)` = Δ(recoil frame r, death frame j) /
 * idleΔ (null: unknown), over the reachable recoil frames r < reach and death starts
 * j ≤ min(MAX_SKIP, deathFrames - 2). Ties keep the later recoil frame (more of the recoil shows).
 */
export function chooseEntry(anim: AnyMonsterAnim, reach: number, deathFrames: number, delta: (r: number, j: number) => number | null): DeathEntry | null {
  let best: DeathEntry | null = null;
  const jMax = Math.max(0, Math.min(MAX_SKIP, deathFrames - 2));
  for (let r = 0; r < Math.max(1, reach); r++)
    for (let j = 0; j <= jMax; j++) {
      const d = delta(r, j);
      if (d === null) continue;
      const cost = d + SKIP_COST * j;
      if (!best || cost < best.cost - 1e-9 || (Math.abs(cost - best.cost) <= 1e-9 && r > best.hold)) best = { anim, hold: r, start: j, cost };
    }
  return best;
}

// ================================================================ frame pixels (the unit's sheet)

const pixels = new WeakMap<object, Map<string, Uint8ClampedArray>>();

/**
 * The sheet frame WITHOUT the lazy-paint hooks of src/art/textures.ts (textures.get(key) finishes a
 * deferred sheet's base anims, texture.get(name) paints that extra anim — synchronously, A2 tech
 * review r2 #12: a 424 ms task on the impact frame). A frame the background painter has not
 * reached yet reads blank, and a blank frame gives no answer (the caller keeps its default).
 */
function rawFrame(scene: Phaser.Scene, key: string, name: string): Phaser.Textures.Frame | null {
  const tex = (scene.textures as unknown as { list: Record<string, Phaser.Textures.Texture | undefined> }).list[key];
  if (!tex || !tex.has(name)) return null;
  const get = (Object.getPrototypeOf(tex) as { get: (this: Phaser.Textures.Texture, n: string) => Phaser.Textures.Frame }).get;
  return get.call(tex, name) ?? null;
}

function framePixels(scene: Phaser.Scene, key: string, name: string): Uint8ClampedArray | null {
  const fr = rawFrame(scene, key, name);
  if (!fr) return null;
  const src = fr.source;
  let byName = pixels.get(src);
  if (!byName) pixels.set(src, (byName = new Map()));
  const hit = byName.get(name);
  if (hit) return hit;
  // the frame's full pixels (A4.1: a cropped v3 sheet stores it trimmed; frameRGBA rebuilds it)
  const data = frameRGBA(fr);
  if (!data) return null;
  // a lazily painted sheet frame may still be blank: never cache that
  let any = false;
  for (let i = 3; i < data.length; i += 4)
    if (data[i]) {
      any = true;
      break;
    }
  if (!any) return null;
  byName.set(name, data);
  return data;
}

function diff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  if (a.length !== b.length) return Infinity;
  let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] === 0 && b[i + 3] === 0) continue;
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) n++;
  }
  return n;
}

const deltas = new Map<string, number | null>();
const idles = new Map<string, number>();

/** Δ between two frames of the unit's sheet (pixels), cached; null when a frame is not painted yet. */
export function frameDelta(u: MonsterUnit, a: string, b: string): number | null {
  const k = `${u.sheetKey}|${a}|${b}`;
  if (deltas.has(k)) return deltas.get(k)!;
  const pa = framePixels(u.scene, u.sheetKey, a);
  const pb = framePixels(u.scene, u.sheetKey, b);
  if (!pa || !pb) return null;
  const d = diff(pa, pb);
  deltas.set(k, d);
  return d;
}

/** The monster's mean idle Δ (consecutive idle frames, loop seam included); null when unknown. */
export function idleDelta(u: MonsterUnit): number | null {
  const hit = idles.get(u.sheetKey);
  if (hit !== undefined) return hit;
  const n = u.frameCount('idle');
  if (n < 2) return null;
  let sum = 0;
  for (let f = 0; f < n; f++) {
    const d = frameDelta(u, `idle:${f}`, `idle:${(f + 1) % n}`);
    if (d === null) return null;
    sum += d;
  }
  const mean = Math.max(1, sum / n);
  idles.set(u.sheetKey, mean);
  return mean;
}

/**
 * The lethal recoil's plan (react.ts): among `anims` (the blow's own recoil first), the recoil
 * frame reachable within `windowMs` of scene time and the death frame that continue each other
 * best. The blow's own recoil wins while its entry is GOOD_ENTRY or better; another recoil is
 * used only when it is clearly better (by ≥ 1 idleΔ). `from` (A2 motion review r3 #4): the frame
 * the body shows now (e.g. 'attack:6', a thrust) — the jump INTO each recoil's first frame is
 * part of its cost (the worst step on the way: max(into, entry)), and the plan reports it as
 * `into`. null: no death pose, or nothing measurable.
 */
export function planDeathEntry(u: MonsterUnit, anims: readonly AnyMonsterAnim[], windowMs: number, from?: string): DeathEntry | null {
  if (!u.has('death') || !u.sprite.active) return null;
  const idle = idleDelta(u);
  if (idle === null) return null;
  const nD = u.frameCount('death');
  let own: DeathEntry | null = null;
  let best: DeathEntry | null = null;
  const worst = (e: DeathEntry) => Math.max(e.cost, e.into ?? 0);
  for (const anim of anims) {
    const n = u.frameCount(anim);
    if (!n) continue;
    let reach = 0;
    while (reach < n && u.rangeMs(anim, 0, reach) <= windowMs) reach++;
    const e = chooseEntry(anim, reach, nD, (r, j) => {
      const d = frameDelta(u, `${anim}:${r}`, `death:${j}`);
      return d === null ? null : d / idle;
    });
    if (!e) continue;
    if (from && from !== `${anim}:0`) {
      const d = frameDelta(u, from, `${anim}:0`);
      if (d !== null) e.into = d / idle;
    }
    if (!own) {
      own = e;
      if (worst(e) <= GOOD_ENTRY) return e;
    }
    if (!best || worst(e) < worst(best)) best = e;
  }
  if (own && best && best !== own && worst(best) > worst(own) - 1) return own;
  return best ?? own;
}

/** The death frame (≤ MAX_SKIP) that continues best from the frame the unit shows now (0 when unknown). */
export function deathStartFrom(u: MonsterUnit): number {
  const name = String(u.sprite.frame?.name ?? '');
  if (!name || name.startsWith('death:')) return 0;
  const idle = idleDelta(u);
  if (idle === null) return 0;
  const e = chooseEntry('death', 1, u.frameCount('death'), (_r, j) => {
    const d = frameDelta(u, name, `death:${j}`);
    return d === null ? null : d / idle;
  });
  return e ? e.start : 0;
}

// ================================================================ the planned entry (react → death)

const planned = new WeakMap<MonsterUnit, DeathEntry>();

/** react.ts: the lethal recoil holds `e.hold`; the death that follows starts on `e.start`. */
export function setPlannedEntry(u: MonsterUnit, e: DeathEntry): void {
  planned.set(u, e);
}

/** death.ts: the planned entry (if any), consumed. */
export function takePlannedEntry(u: MonsterUnit): DeathEntry | null {
  const e = planned.get(u) ?? null;
  planned.delete(u);
  return e;
}

/** The planned entry without consuming it. */
export function plannedEntry(u: MonsterUnit): DeathEntry | null {
  return planned.get(u) ?? null;
}

// ================================================================ start alignment (idle bob → a pose's first frame)

/** Whole-pixel vertical shift (−MAX_BOB…MAX_BOB) tried by bobShift. */
const MAX_BOB = 3;

/**
 * A2 motion review r2 #3: a pose started from an arbitrary idle frame jumps by the idle's bob (the
 * magus hovers 1 px, its orb 3 px: up to 4.1 × idleΔ on the first frame). The vertical whole-pixel
 * shift that lines `anim` f0 up best with the frame the unit shows now (pixel Δ of the unit's own
 * sheet, f0 drawn `dy` px lower); 0 when unknown, or when shifting does not clearly help (< 20 %).
 */
export function bobShift(u: MonsterUnit, anim: AnyMonsterAnim, frame = 0): number {
  const cur = String(u.sprite.frame?.name ?? '');
  const to = `${anim}:${frame}`;
  if (!cur || cur === to) return 0;
  const a = framePixels(u.scene, u.sheetKey, cur);
  const b = framePixels(u.scene, u.sheetKey, to);
  const fr = rawFrame(u.scene, u.sheetKey, to);
  if (!a || !b || !fr || a.length !== b.length) return 0;
  const w = fr.realWidth;
  const h = fr.realHeight;
  const at = (d: Uint8ClampedArray, x: number, y: number) => (y < 0 || y >= h ? -1 : y * w + x);
  const cost = (dy: number): number => {
    let n = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const j = at(b, x, y - dy);
        const aa = a[i * 4 + 3];
        const ba = j < 0 ? 0 : b[j * 4 + 3];
        if (aa === 0 && ba === 0) continue;
        if (aa !== ba || a[i * 4] !== b[j * 4] || a[i * 4 + 1] !== b[j * 4 + 1] || a[i * 4 + 2] !== b[j * 4 + 2]) n++;
      }
    return n;
  };
  const c0 = cost(0);
  let best = 0;
  let bestC = c0;
  for (let dy = -MAX_BOB; dy <= MAX_BOB; dy++) {
    if (!dy) continue;
    const c = cost(dy);
    if (c < bestC) {
      bestC = c;
      best = dy;
    }
  }
  return bestC < c0 * 0.8 ? best : 0;
}

/**
 * Start `anim` (frame `frame`) where the hovering body is now: the sprite is shifted by the bob
 * (bobShift) on the first frame and steps back one whole pixel per game frame. Only for a body
 * that floats (art.hover > 0) — a grounded one keeps its feet planted. Call right BEFORE the
 * pose / play that shows the frame. No-op when nothing is to gain.
 */
export function alignStart(u: MonsterUnit, anim: AnyMonsterAnim, frame = 0): void {
  if (u.art.hover <= 0 || !u.sprite.active) return;
  const dy = bobShift(u, anim, frame);
  if (!dy) return;
  const s = u.sprite;
  const base = s.y;
  let off = dy;
  s.setY(base + off);
  const sc = s.scene;
  let seen = 0;
  const step = () => {
    // the first update after the shift renders it as it is (the shifted first frame)
    if (seen++ === 0) return;
    // gone, or something else moved it: leave it alone
    if (!s.active || u.retired || s.y !== base + off) return sc.events.off('postupdate', step);
    off -= Math.sign(off);
    s.setY(base + off);
    if (off === 0) sc.events.off('postupdate', step);
  };
  sc.events.on('postupdate', step);
}

// ================================================================ the pre-contact idle settle (A3 Y1b)
//
// A blow on a RESTING body lands on whatever idle frame the loop shows, while the struck pose's f0
// was drawn from idle f0 (REHBER HA-21): the whole body snaps from its idle phase into the struck
// pose on the contact frame (A3_MIMARI §10, contact-probe: 56–74 % on screen against a sheet value
// of 39–44 %). When the blow's contact time is known ahead — a battle strike whose attack marks its
// 'contact' frame (strikeContactIn), a spell's own strike time — the target's idle loop is steered
// so that the frame on screen just before contact is one the struck poses continue:
//   - targets: idle f0 and every idle frame within KK-4 of each LOCALISED struck f0 (hit, hitHeavy,
//     hitMagic, death f0 under LOCAL_MAX % of idle f0), read off the unit's own sheet (settleGoal);
//   - one even time scale over the wind-up: every hold × 0.65 … × 1.35 (SETTLE_STRETCH), the
//     smallest change that puts the middle of a target frame on the frame before contact. No frame
//     is skipped, repeated or held beyond that, nothing plays backward;
//   - nothing changes when the loop lands on a target anyway, when no struck f0 is localised (the
//     old art) or measurable yet (a sheet frame not painted), or when no target is in reach — then a
//     frame that makes the contact local (< LOCAL_MAX) and BEST_EFFORT_GAIN points closer, if any;
//   - the steering ends with the contact (the struck pose starts: 'animationstart'; react.ts also
//     ends it), when anything else takes the sprite (another anim starts or stops, a re-plan), when
//     the unit leaves, or one tick after the planned contact.
// planSettle is pure (unit-tested); settleBefore applies a plan through sprite.anims.timeScale and
// emits 'v3:settle' (uid, plan) for tools/contact-probe.mjs.

/** Holds may stretch or shrink this much while the idle is steered toward a contact (×0.65 … ×1.35). */
export const SETTLE_STRETCH = 0.35;
/** KK-4: a contact frame may change this many points (% of idle f0's opaque pixels) more than its sheet value. */
export const KK4_SLACK = 5;
/** HA-21: a struck f0 is localised when it changes less than this share (%) of idle f0. */
export const LOCAL_MAX = 50;
/** No target in reach: a frame that makes the contact local and this many points closer is still worth steering to. */
export const BEST_EFFORT_GAIN = 5;
/** One game frame (ms). */
const SETTLE_TICK = 1000 / 60;
/** Whole loops a plan may pass on its way to the target. */
const SETTLE_LOOPS = 3;
/** The struck poses whose f0 the settle measures (their f0 is drawn from idle f0, HA-21). */
const STRUCK: readonly AnyMonsterAnim[] = ['hit', 'hitHeavy', 'hitMagic', 'death'];

/** A rest loop as it plays now: its frames' nominal holds (ms), the frame shown, ms already spent on it. */
export interface SettleLoop {
  holds: readonly number[];
  frame: number;
  into: number;
}

/** Which loop frames a blow may land on, and (optionally) what landing on each costs. */
export interface SettleGoal {
  isTarget(f: number): boolean;
  /** Points (% of idle f0) the contact frame changes when the loop shows `f` before it. */
  cost?(f: number): number;
}

export interface SettlePlan {
  /** The loop frame on screen just before contact. */
  frame: number;
  /** Whole loops passed on the way (0: still this one). */
  loops: number;
  /** sprite.anims.timeScale over the wind-up (1: untouched). */
  speed: number;
  /** Every hold's multiplier: 1 / speed (SETTLE_STRETCH bounds it). */
  hold: number;
  /** `frame` is a target (a blow landing on it passes KK-4). */
  target: boolean;
  /** Cost of `frame` (null: unknown). */
  cost: number | null;
  /** The frame the untouched loop would show before contact, and its cost. */
  base: number;
  baseCost: number | null;
  /** ms from the plan to the contact it aims at. */
  contactIn: number;
}

/**
 * The gentlest even time scale (speed) that puts the middle of a target frame of `loop` on screen
 * just before a contact `contactIn` ms away: the contact frame is drawn within a tick of
 * contactIn, so the frame before it is aimed at contactIn − tick / 2. Speeds are bounded by
 * SETTLE_STRETCH (holds × (1 − s) … × (1 + s)). No target in reach: the frame in reach with the
 * smallest cost, when it is under LOCAL_MAX and `gain` points better than the untouched one (best
 * effort, plan.target false). Returns the untouched plan (speed 1) when the loop lands on a target
 * anyway with a tick to spare on both sides, or when nothing in reach is better;
 * null when the wind-up is too short to plan (< 3 ticks) or the loop has one frame.
 */
export function planSettle(loop: SettleLoop, contactIn: number, goal: SettleGoal, o: { tick?: number; stretch?: number; gain?: number } = {}): SettlePlan | null {
  const n = loop.holds.length;
  const tick = o.tick ?? SETTLE_TICK;
  const stretch = o.stretch ?? SETTLE_STRETCH;
  const gain = o.gain ?? BEST_EFFORT_GAIN;
  const T = contactIn - tick / 2;
  if (n < 2 || !(T >= 3 * tick) || loop.frame < 0 || loop.frame >= n) return null;
  const holds = loop.holds.map((h) => Math.max(1, h));
  const starts: number[] = [];
  let L = 0;
  for (const h of holds) {
    starts.push(L);
    L += h;
  }
  const p0 = starts[loop.frame] + Math.max(0, Math.min(holds[loop.frame], loop.into));
  const frameAt = (p: number): { f: number; lo: number; hi: number } => {
    const q = ((p % L) + L) % L;
    let f = 0;
    while (f < n - 1 && starts[f + 1] <= q) f++;
    return { f, lo: q - starts[f], hi: starts[f] + holds[f] - q };
  };
  const cost = (f: number): number | null => (goal.cost ? goal.cost(f) : null);
  const at = frameAt(p0 + T);
  const base = at.f;
  const baseCost = cost(base);
  const untouched = (): SettlePlan => ({ frame: base, loops: Math.floor((p0 + T) / L), speed: 1, hold: 1, target: goal.isTarget(base), cost: baseCost, base, baseCost, contactIn });
  // landing on a target anyway, a tick or more inside it: leave the loop alone
  if (goal.isTarget(base) && Math.min(at.lo, at.hi) >= tick) return untouched();
  const sMin = 1 / (1 + stretch);
  const sMax = 1 / (1 - stretch);
  interface Cand {
    f: number;
    m: number;
    s: number;
  }
  const cands: Cand[] = [];
  for (let m = 0; m <= SETTLE_LOOPS; m++)
    for (let f = 0; f < n; f++) {
      const D = starts[f] + holds[f] / 2 + m * L - p0;
      if (D <= 0) continue;
      const s = D / T;
      if (s >= sMin - 1e-9 && s <= sMax + 1e-9) cands.push({ f, m, s });
    }
  const gentler = (a: Cand, b: Cand) => Math.abs(Math.log(a.s)) < Math.abs(Math.log(b.s)) - 1e-9;
  let best: Cand | null = null;
  for (const c of cands) if (goal.isTarget(c.f) && (!best || gentler(c, best))) best = c;
  let target = !!best;
  if (!best && goal.cost && baseCost !== null) {
    // no target in reach: the frame closest to the struck poses, when that makes the contact local
    // (under LOCAL_MAX) and is clearly closer than the untouched frame
    for (const c of cands) {
      const k = goal.cost(c.f);
      if (k >= LOCAL_MAX || k > baseCost - gain) continue;
      if (!best || k < goal.cost(best.f) - 1e-9 || (Math.abs(k - goal.cost(best.f)) <= 1e-9 && gentler(c, best))) best = c;
    }
    target = false;
  }
  if (!best) return untouched();
  return { frame: best.f, loops: best.m, speed: best.s, hold: 1 / best.s, target, cost: cost(best.f), base, baseCost, contactIn };
}

// ---------------------------------------------------------------- the goal, read off the sheet

interface StruckGoal extends SettleGoal {
  /** Every struck f0 the art has was painted when this was measured (cacheable). */
  complete: boolean;
}

const goals = new Map<string, StruckGoal>();

function opaqueOf(px: Uint8ClampedArray): number {
  let k = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i]) k++;
  return k;
}

/**
 * The settle's goal from frame pixels (RGBA, all of one size): `idle` = the idle loop's frames, `struck`
 * = the struck f0s (hit, hitHeavy, hitMagic, death) known so far. Only the LOCALISED struck f0s count
 * (under LOCAL_MAX % of idle f0's opaque pixels changed: drawn from idle f0, HA-21; a struck pose that
 * changes half the body is not — the old art). Targets: idle f0 and every idle frame f with, for each
 * of them, Δ(f, struck) < LOCAL_MAX and ≤ Δ(f0, struck) + KK4_SLACK (KK-4); cost(f): the largest
 * Δ(f, struck) in points. null: no localised struck f0.
 */
export function struckGoal(idle: readonly Uint8ClampedArray[], struck: readonly Uint8ClampedArray[]): SettleGoal | null {
  const n = idle.length;
  if (n < 2) return null;
  const opaque = opaqueOf(idle[0]);
  if (!opaque) return null;
  const pct = (d: number) => (100 * d) / opaque;
  const local = struck.map((px) => ({ px, page: pct(diff(idle[0], px)) })).filter((x) => x.page < LOCAL_MAX);
  if (!local.length) return null;
  const costs: number[] = [];
  const ok: boolean[] = [];
  for (let f = 0; f < n; f++) {
    let worst = 0;
    let pass = true;
    for (const x of local) {
      const d = pct(diff(idle[f], x.px));
      worst = Math.max(worst, d);
      if (d >= LOCAL_MAX || d > x.page + KK4_SLACK) pass = false;
    }
    costs.push(worst);
    ok.push(f === 0 || pass);
  }
  return { isTarget: (f) => !!ok[f], cost: (f) => costs[f] ?? Infinity };
}

/** The settle's goal for `u`'s idle loop measured on sheet `key` (null: nothing localised / painted). */
function measureGoal(u: MonsterUnit, key: string): StruckGoal | null {
  const n = u.frameCount('idle');
  if (n < 2) return null;
  const idle: Uint8ClampedArray[] = [];
  for (let f = 0; f < n; f++) {
    const px = framePixels(u.scene, key, `idle:${f}`);
    if (!px) return null;
    idle.push(px);
  }
  const has = STRUCK.filter((a) => u.has(a));
  const painted: Uint8ClampedArray[] = [];
  for (const a of has) {
    const px = framePixels(u.scene, key, `${a}:0`);
    if (px) painted.push(px);
  }
  const g = struckGoal(idle, painted);
  return g ? { isTarget: g.isTarget, cost: g.cost, complete: painted.length === has.length } : null;
}

/**
 * Which idle frames a blow on `u` may land on and what each costs (see the section header), from
 * the unit's own sheet, else from its other light side's sheet (the P1 / P2 sheets differ only in
 * light: the same frames qualify); cached once every struck f0 was painted. null: the art's struck
 * poses are not drawn from idle f0, or not painted yet.
 */
export function settleGoal(u: MonsterUnit): SettleGoal | null {
  const keys = [u.sheetKey, u.sheetKey === u.p1Key ? u.p2Key : u.p1Key].filter((k, i, a) => !!k && a.indexOf(k) === i);
  for (const key of keys) {
    const hit = goals.get(key);
    if (hit) return hit;
    const g = measureGoal(u, key);
    if (!g) continue;
    if (g.complete) goals.set(key, g);
    return g;
  }
  return null;
}

// ---------------------------------------------------------------- applying a plan

/** Phaser.Animations.Events / Phaser.Scenes.Events names (no runtime Phaser import here). */
const ANIM_START = 'animationstart';
const ANIM_STOP = 'animationstop';
const SCENE_UPDATE = 'update';
const SCENE_SHUTDOWN = 'shutdown';

/** The part of Phaser's AnimationState the settle reads and steers. */
interface AnimState {
  isPlaying: boolean;
  forward: boolean;
  timeScale: number;
  accumulator: number;
  currentAnim: { key: string } | null;
}

const steering = new WeakMap<MonsterUnit, () => void>();

/** The idle loop of a resting attack-position unit as it plays now (null: not resting / not idling). */
function restLoop(u: MonsterUnit): SettleLoop | null {
  const s = u.sprite;
  if (!s.active || !s.visible || u.retired || u.position !== 'attack' || u.guarding) return null;
  const fi = u.frameInfo();
  const a = s.anims as unknown as AnimState;
  if (fi.anim !== 'idle' || !a.isPlaying || !a.forward || !a.currentAnim || a.timeScale !== 1) return null;
  const n = u.frameCount('idle');
  if (n < 2 || fi.frame >= n) return null;
  const holds = Array.from({ length: n }, (_, f) => u.frameMs('idle', f));
  return { holds, frame: fi.frame, into: Math.max(0, Math.min(holds[fi.frame], a.accumulator || 0)) };
}

/** Ends `u`'s settle (if one is steering): the loop plays at its own speed again. */
export function endSettle(u: MonsterUnit | null): void {
  if (u) steering.get(u)?.();
}

/**
 * A blow will land on `u` in `contactIn` ms (show time): if `u` rests in attack position on its
 * idle loop, plan the settle and steer the loop until then (a new call re-plans from where the
 * loop is: the battle's exact contact after the declaration's estimate). Returns the plan (speed 1:
 * nothing to change), or null when the unit does not rest, the wind-up is too short or the art's
 * struck poses are not drawn from idle f0. `goalOf` replaces the goal read off the sheet (tests).
 */
export function settleBefore(u: MonsterUnit | null, contactIn: number, goalOf: SettleGoal | null = null): SettlePlan | null {
  if (!u) return null;
  endSettle(u);
  const loop = restLoop(u);
  if (!loop) return null;
  const goal = goalOf ?? settleGoal(u);
  if (!goal) return null;
  const plan = planSettle(loop, contactIn, goal);
  if (!plan) return null;
  const sc = u.scene;
  sc.events.emit('v3:settle', u.uid, plan);
  if (plan.speed === 1) return plan;
  const s = u.sprite;
  const a = s.anims as unknown as AnimState;
  const key = a.currentAnim!.key;
  const speed = plan.speed;
  a.timeScale = speed;
  let el = 0;
  let done = false;
  const end = () => {
    if (done) return;
    done = true;
    s.off(ANIM_START, end);
    s.off(ANIM_STOP, end);
    sc.events.off(SCENE_UPDATE, tick);
    sc.events.off(SCENE_SHUTDOWN, end);
    if (steering.get(u) === end) steering.delete(u);
    // (a play that set its own time scale keeps it)
    if (s.active && a.timeScale === speed) a.timeScale = 1;
  };
  function tick(_t: number, delta: number): void {
    el += Math.min(50, delta) * ((sc as unknown as { tweens?: { timeScale?: number } }).tweens?.timeScale ?? 1);
    if (el >= contactIn + SETTLE_TICK || !s.active || u!.retired || a.currentAnim?.key !== key || !a.isPlaying) end();
  }
  // the struck pose (or anything else) starting / stopping an anim ends it before its first update
  s.on(ANIM_START, end);
  s.on(ANIM_STOP, end);
  sc.events.on(SCENE_UPDATE, tick);
  sc.events.once(SCENE_SHUTDOWN, end);
  steering.set(u, end);
  return plan;
}

/**
 * ms from now until a battle strike's blow lands, from its attacker's marks: the attack's
 * 'contact' frame (the body / beam touches the target, src/art/types.ts AnimMark) — counted from
 * the attack frame the attacker shows now, or from `from` (the frame the strike will start on,
 * e.g. the one after the declaration's charge pose). null when the attack has no 'contact' mark (a
 * thrown or fired strike: its flight is its own) or is already past it.
 */
export function strikeContactIn(attacker: MonsterUnit | null, from?: number): number | null {
  if (!attacker || !attacker.sprite.active) return null;
  const c = attacker.spec('attack')?.marks?.contact;
  if (typeof c !== 'number' || !Number.isFinite(c)) return null;
  let f: number;
  let into = 0;
  let speed = 1;
  if (from !== undefined) f = from;
  else {
    const fi = attacker.frameInfo();
    if (fi.anim !== 'attack') return null;
    f = fi.frame;
    const a = attacker.sprite.anims as unknown as AnimState;
    if (a.isPlaying) {
      into = Math.max(0, a.accumulator || 0);
      speed = a.timeScale > 0 ? a.timeScale : 1;
    }
  }
  if (c <= f) return null;
  return Math.max(0, attacker.rangeMs('attack', f, c) - into) / speed;
}
