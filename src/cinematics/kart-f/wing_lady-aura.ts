// Kanat Hanımı (wing_lady) — the aura's pieces (lane F). EXPORTS ONLY: this file is imported by the cinematics glob
// (src/cinematics/index.ts), so it must have no side effects. Design: docs/v3/oturum-f/wing_lady.md §4.3–§4.6 + §11.
//
//   the aura word   GOLD = lift. Every WIND ally she lifts wears two things while the +300 holds:
//     the floor light   a soaring-bird shape of light on its tile (36×9: two swept wings, a head notch, a tail),
//                       gold1/gold2 body, a gold3 core band, a gold4 leading edge on the lit (left) side — whole
//                       pixels on the floor above the card, under the body; a faint gold pool in the light layer.
//                       It BEATS (spreads 1 px each side) on the frame her idle reaches its wing breath (f7), so
//                       every buffed ally on her side breathes with her.
//     the crest         two tiny gold wings (9×5 + ink outline) over the ATK digits of its plate — one pair per lady
//                       (two ladies: +600, two pairs stacked).
//   bloom / fold     both open in 3 frames (dot → half → full) and fold the same way back; the fold drifts the floor
//                    light toward her (its origin) and steps it down gold3 → gold1 → gone.
// Palette tones only, whole pixels, no alpha ramps; the ally's sprite is never touched here.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { digitsWidth } from '../../art/cards';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { BADGE_DEPTH } from '../../duel/StatBadge';
import { DEPTH, type XY } from '../../view/layout';
import { lightPool, type LightHandle } from '../../view/light';
import { onFrame, type Px } from '../../vfx/combat';
import { layer } from '../strikes-a/_kit';

export const LADY = 'wing_lady';
export const AURA_KEY = 'khWing';
/** One aura step (bloom / fold frame). */
export const STEP_MS = 50;
/** The floor light's depth: above the card lying on the tile, under the drop shadow and the bodies. */
export const FLOOR_DEPTH = DEPTH.CARD_ON_TILE + 4;

export { slotOf, bonusIn, ladiesIn, allLadies, auraDelta, blockStart } from './wing_lady-rules';

// ================================================================ the floor light painter

/** Paint a pixel set with an ink outline (4-neighbours); `col(x, y)` gives each pixel's tone. */
function outlined(px: Px, pts: Map<string, number>, ink: number | null): void {
  if (ink !== null)
    for (const k of pts.keys()) {
      const [x, y] = k.split(',').map(Number);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        if (!pts.has(`${x + dx},${y + dy}`)) px.dot(x + dx, y + dy, ink);
    }
  for (const [k, c] of pts) {
    const [x, y] = k.split(',').map(Number);
    px.dot(x, y, c);
  }
}

/**
 * The soaring-bird floor light centred at (cx, cy): `span` the half wingspan (px, ≤ 18 full; 0 nothing), `tone`
 * 3 full brightness … 1 the last fade step. Two wings swept back (toward +y = the near side), the outer third
 * split into three feather fingers, a head notch forward, a short fanned tail; gold2 body, a gold3 core band, a
 * gold4 leading edge on the lit (left) side, an ink outline so it reads crisply over any card face.
 */
export function paintFloorLight(px: Px, cx: number, cy: number, span: number, tone: 1 | 2 | 3 = 3): void {
  const S = Math.max(0, Math.round(span));
  if (S <= 0) return;
  const body = tone >= 3 ? PAL.gold2 : PAL.gold1;
  const core = tone >= 3 ? PAL.gold3 : tone === 2 ? PAL.gold2 : PAL.gold1;
  const edge = tone >= 3 ? PAL.gold4 : tone === 2 ? PAL.gold3 : PAL.gold2;
  const pts = new Map<string, number>();
  const put = (x: number, y: number, c: number) => pts.set(`${x},${y}`, c);
  for (let x = -S; x <= S; x++) {
    const a = Math.abs(x) / Math.max(1, S);
    const lead = Math.round(-1 + a * a * 3);
    let thick = Math.max(1, Math.round(4 - a * 2.4));
    // feather fingers on the outer third: every third column trails one pixel further
    if (a > 0.6 && S >= 8 && (Math.abs(x) % 3) === 0) thick += 1;
    if (a > 0.6 && S >= 8 && (Math.abs(x) % 3) === 2) thick = Math.max(1, thick - 1);
    for (let r = 0; r < thick; r++) put(cx + x, cy + lead + r, r === 0 ? (x <= 0 || Math.abs(x) > S - 3 ? edge : core) : r < thick - 1 ? core : body);
  }
  if (S >= 4) {
    put(cx, cy - 2, edge);
    put(cx, cy - 3, edge);
    for (const dx of [-1, 0, 1]) put(cx + dx, cy + 3, body);
    put(cx - 2, cy + 4, body);
    put(cx, cy + 4, body);
    put(cx + 2, cy + 4, body);
  }
  outlined(px, pts, tone >= 2 ? PAL.ink : null);
}

// ================================================================ the crest painter

/** Crest rows (2 gold4, 3 gold3, 1 gold2). 13×5: a spread pair of wings. */
const CREST: readonly string[] = ['22.........22', '3322.....2233', '.33322.22333.', '..3311.1133..', '....11.11....'];
/** The bloom frames: 0 dot, 1 half, 2 full. */
function crestRows(step: number): string[] {
  if (step >= 2) return [...CREST];
  if (step === 1) return ['.............', '.............', '...322.223...', '....31.13....', '.....1.1.....'];
  return ['.............', '.............', '.............', '.....2.2.....', '.....1.1.....'];
}

/** Paint one crest with its ink outline, its bottom-centre at (cx, by). `flare`: every gold pixel gold4. */
export function paintCrest(px: Px, cx: number, by: number, step: number, flare = false): void {
  const rows = crestRows(step);
  const pts = new Map<string, number>();
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 13; x++) {
      const c = rows[y][x];
      if (c === '.') continue;
      pts.set(`${cx - 6 + x},${by - 4 + y}`, flare ? PAL.gold4 : c === '2' ? PAL.gold4 : c === '3' ? PAL.gold3 : PAL.gold2);
    }
  outlined(px, pts, PAL.ink);
}

/** Where the crest sits: over the ATK digits of the unit's plate (bottom-centre point), or null when hidden. */
export function crestAnchor(u: MonsterUnit): XY | null {
  const img = u.badge.image;
  if (!img || !img.active || !img.visible || !u.badge.visible) return null;
  const a = String(Math.max(0, u.shownStats.atk));
  const d = String(Math.max(0, u.shownStats.def));
  const aw = digitsWidth(a);
  const dw = digitsWidth(d);
  const W = 3 + aw + 5 + dw + 3;
  const left = Math.round(img.x - W / 2);
  const top = Math.round(img.y - 4.5);
  return { x: left + 3 + Math.floor(aw / 2), y: top + 1 };
}

// ================================================================ the aura

export interface WingAura {
  readonly count: number;
  readonly folding: boolean;
  /** The +300 count (one crest pair per lady). */
  setCount(n: number): void;
  /** Open (3 frames). */
  bloom(): void;
  /** A flare: the crest flashes gold4 for two frames and the floor light beats once. */
  flare(): void;
  /** One beat of the floor light (all of a side's allies together). */
  beat(): void;
  /** Fold toward `origin` (her tile / her graveyard): crest folds, the floor light drifts and steps down; then gone. */
  fold(origin?: XY | null): void;
  destroy(): void;
}

/**
 * The persistent aura on a buffed ally. `ladies()` gives the lady units of its side whose idle breath it copies.
 * `bloom`: start closed and open (false: appear open, e.g. a steady state after a rebuild).
 */
export function wingAura(scene: Phaser.Scene, u: MonsterUnit, o: { count: number; bloom: boolean; ladies: () => MonsterUnit[] }): WingAura {
  // over the 50 % drop shadow (it dimmed the gold to a murk at 1×), still under every body
  const floor = layer(scene, DEPTH.SHADOW + 1);
  const crest = layer(scene, BADGE_DEPTH + 1);
  let count = Math.max(1, o.count);
  let openAt = o.bloom ? -1 : -1e9; // el when the bloom started (−1: start on the first frame)
  let foldAt = -1;
  let foldTo: XY | null = null;
  let flareUntil = -1;
  let beatUntil = -1;
  let el = 0;
  let alive = true;
  let pool: LightHandle | null = null;
  let lastBeatFrame = -1;
  const kill = () => {
    if (!alive) return;
    alive = false;
    stop();
    floor.g.destroy();
    crest.g.destroy();
    const p = pool;
    pool = null;
    if (p && p.alive) void p.fadeOut(160);
  };
  const stop = onFrame(scene, (_dt, e) => {
    el = e;
    if (!alive) return false;
    if (!scene.sys.isActive() || !u.sprite.active || (u.retired && foldAt < 0)) {
      kill();
      return false;
    }
    if (openAt === -1) openAt = el;
    floor.clear();
    crest.clear();
    const home = u.home;
    const cx = Math.round(home.x);
    const cy = Math.round(home.y) - 3;
    // the breath: a lady of its side shows her idle wing breath (f7)
    for (const l of o.ladies()) {
      const fi = l.frameInfo();
      if (fi.anim === 'idle' && fi.frame === 7 && lastBeatFrame !== 7) {
        beatUntil = el + 2 * STEP_MS + 20;
      }
      lastBeatFrame = fi.anim === 'idle' ? fi.frame : -1;
      break;
    }
    const opening = Math.min(3, Math.floor((el - openAt) / STEP_MS) + 1); // 1..3
    let step = opening; // 1 dot · 2 half · 3 full
    let tone: 1 | 2 | 3 = 3;
    let off = { x: 0, y: 0 };
    if (foldAt >= 0) {
      const k = Math.floor((el - foldAt) / (STEP_MS + 20));
      if (k >= 4) {
        kill();
        return false;
      }
      step = Math.max(0, 3 - k);
      tone = (k <= 1 ? 3 : k === 2 ? 2 : 1) as 1 | 2 | 3;
      if (foldTo) {
        const dx = foldTo.x - cx;
        const dy = foldTo.y - cy;
        const L = Math.hypot(dx, dy) || 1;
        const s = Math.min(L, k * 3);
        off = { x: Math.round((dx / L) * s), y: Math.round((dy / L) * s * 0.5) };
      }
    }
    const shown = u.sprite.visible && !u.retired;
    if (shown || foldAt >= 0) {
      const span = step >= 3 ? 18 : step === 2 ? 11 : step === 1 ? 4 : 0;
      const beat = el < beatUntil && foldAt < 0 && step >= 3 ? 1 : 0;
      paintFloorLight(floor, cx + off.x, cy + off.y, span + beat, tone);
      if (!pool && foldAt < 0 && step >= 3) pool = lightPool(scene, cx, cy, { color: PAL.gold3, spill: PAL.gold1, radius: 14, floorY: cy, intensity: 0.32, fadeIn: 160 });
    }
    if (pool && (foldAt >= 0 || !shown)) {
      const p = pool;
      pool = null;
      if (p.alive) void p.fadeOut(180);
    }
    // the crest(s)
    const at = crestAnchor(u);
    if (at && (shown || foldAt >= 0)) {
      const cs = step >= 3 ? 2 : step === 2 ? 1 : step === 1 ? 0 : -1;
      if (cs >= 0) for (let n = 0; n < count; n++) paintCrest(crest, at.x, at.y - n * 3, cs, el < flareUntil);
    }
    return true;
  });
  return {
    get count() {
      return count;
    },
    get folding() {
      return foldAt >= 0;
    },
    setCount(n) {
      count = Math.max(1, n);
    },
    bloom() {
      openAt = el;
    },
    flare() {
      flareUntil = el + 2 * STEP_MS + 10;
      beatUntil = el + 2 * STEP_MS + 20;
    },
    beat() {
      beatUntil = el + 2 * STEP_MS + 20;
    },
    fold(origin) {
      if (foldAt >= 0 || !alive) return;
      foldTo = origin ?? null;
      foldAt = el;
    },
    destroy() {
      // a retire / a setAura(null) folds it in place (already folding: let it finish)
      if (!alive) return;
      if (foldAt < 0) foldAt = el;
    },
  };
}

/** The aura on a unit (null: none). */
export function auraOf(u: MonsterUnit | null | undefined): WingAura | null {
  if (!u) return null;
  return (u.aura(AURA_KEY) as unknown as WingAura | null) ?? null;
}
