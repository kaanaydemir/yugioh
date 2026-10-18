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
let scratch: HTMLCanvasElement | null = null;

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
  const w = fr.cutWidth;
  const h = fr.cutHeight;
  if (w <= 0 || h <= 0) return null;
  let data: Uint8ClampedArray;
  try {
    const img = src.image as HTMLCanvasElement | HTMLImageElement;
    let c2: CanvasRenderingContext2D | null = null;
    if (typeof HTMLCanvasElement !== 'undefined' && img instanceof HTMLCanvasElement) c2 = img.getContext('2d', { willReadFrequently: true });
    if (c2) data = c2.getImageData(fr.cutX, fr.cutY, w, h).data;
    else {
      scratch ??= document.createElement('canvas');
      scratch.width = w;
      scratch.height = h;
      const c = scratch.getContext('2d', { willReadFrequently: true })!;
      c.clearRect(0, 0, w, h);
      c.drawImage(img as CanvasImageSource, fr.cutX, fr.cutY, w, h, 0, 0, w, h);
      data = c.getImageData(0, 0, w, h).data;
    }
  } catch {
    return null;
  }
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
  const w = fr.cutWidth;
  const h = fr.cutHeight;
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
