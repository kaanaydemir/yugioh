// DEV / TEST ONLY — `?look=v3&poseshim=1` (or `poseshim=crystal_wyrm,abyss_magus`, `poseshim=all`).
// v3 A2 kits part 2: lets the shared kits' POSE paths (death / summon / revive / toGuard /
// fromGuard) be filmed and measured before the slice monsters' Part 2 art exists. Without the URL
// flag nothing here runs.
//
// For each chosen monster it adds the extra anims the art does NOT already draw, built from its
// own base frames (frame translations and a deterministic pixel erosion — crude placeholders, never
// shipped art): every anim the real art defines is left untouched, so once the art agents add a
// pose the shim steps aside for it. The base anims and sheets of every monster stay as they were
// (the art object only gains optional fields before the boot step builds the sheets).
//
//   death     hit 1 → hit 2 → guard 0 sinking 1–2 px → eroding 20 / 40 / 55 %  marks: dissolve 4
//   summon    guard 0 dropping in (−8 / −3 px) → land → roar 1 → roar 3 → idle 0  marks: land 2
//   revive    guard 0 eroded 85 / 60 / 30 % → guard 0 → roar 1 → idle 0         marks: land 3
//   toGuard   roar 1 (the crouch) → guard 0                                     (ends on guard 0)
//   fromGuard guard 0 → roar 1 → idle 0                                         (ends on idle 0)

import { MONSTER_IDS, type MonsterId } from '../data/cards';
import { monsterArt } from '../art/monsters';
import { PixelCanvas } from '../art/pixel';
import type { AnimSpec, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt } from '../art/types';
import { LOOK_V3 } from '../view/layout';

interface ShimFrame {
  anim: MonsterAnim;
  frame: number;
  dy?: number;
  /** Share of the opaque pixels removed (0…1, deterministic). */
  erode?: number;
}

const SHIM: Partial<Record<MonsterAnimExtra, { frames: ShimFrame[]; holds: number[]; marks?: AnimSpec['marks'] }>> = {
  death: {
    frames: [
      { anim: 'hit', frame: 1 },
      { anim: 'hit', frame: 2 },
      { anim: 'guard', frame: 0, dy: 1 },
      { anim: 'guard', frame: 0, dy: 2 },
      { anim: 'guard', frame: 0, dy: 2, erode: 0.2 },
      { anim: 'guard', frame: 0, dy: 2, erode: 0.4 },
      { anim: 'guard', frame: 0, dy: 2, erode: 0.55 },
    ],
    holds: [90, 110, 120, 100, 100, 100, 110],
    marks: { dissolve: 4 },
  },
  summon: {
    frames: [
      { anim: 'guard', frame: 0, dy: -8 },
      { anim: 'guard', frame: 0, dy: -3 },
      { anim: 'guard', frame: 0 },
      { anim: 'roar', frame: 1 },
      { anim: 'roar', frame: 3 },
      { anim: 'idle', frame: 0 },
    ],
    holds: [70, 60, 140, 110, 220, 120],
    marks: { land: 2 },
  },
  revive: {
    frames: [
      { anim: 'guard', frame: 0, erode: 0.85 },
      { anim: 'guard', frame: 0, erode: 0.6 },
      { anim: 'guard', frame: 0, erode: 0.3 },
      { anim: 'guard', frame: 0 },
      { anim: 'roar', frame: 1 },
      { anim: 'idle', frame: 0 },
    ],
    holds: [90, 90, 90, 160, 140, 120],
    marks: { land: 3 },
  },
  toGuard: {
    frames: [
      { anim: 'roar', frame: 1 },
      { anim: 'guard', frame: 0 },
    ],
    holds: [110, 110],
  },
  fromGuard: {
    frames: [
      { anim: 'guard', frame: 0 },
      { anim: 'roar', frame: 1 },
      { anim: 'idle', frame: 0 },
    ],
    holds: [80, 110, 90],
  },
};

/** Deterministic per-pixel threshold in [0, 1). */
function noise(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function shimFrame(base: MonsterArt, f: ShimFrame, o?: DrawOpts): PixelCanvas {
  const src = new PixelCanvas(base.w, base.h);
  const n = base.anims[f.anim].frames;
  if (o) base.draw(src, f.anim, Math.min(f.frame, n - 1), o);
  else base.draw(src, f.anim, Math.min(f.frame, n - 1));
  const out = new PixelCanvas(base.w, base.h);
  out.blit(src, 0, f.dy ?? 0);
  const k = f.erode ?? 0;
  if (k > 0) {
    // erosion eats the body from the top down (the noise is biased by the row)
    const b = out.bounds();
    const top = b ? b.y : 0;
    const h = b ? Math.max(1, b.h) : base.h;
    out.map((c, x, y) => (noise(x, y) * 0.7 + (1 - (y - top) / h) * 0.3 < k ? null : c));
  }
  return out;
}

/** Add the shim's missing extra anims to `base` (in place; the art object keeps its identity). */
export function applyPoseShim(base: MonsterArt): void {
  const own = base.extraAnims ?? {};
  const ownDraw = base.drawExtra?.bind(base);
  const added: Partial<Record<MonsterAnimExtra, AnimSpec>> = {};
  for (const [name, s] of Object.entries(SHIM) as [MonsterAnimExtra, NonNullable<(typeof SHIM)[MonsterAnimExtra]>][]) {
    if (own[name] && ownDraw) continue;
    added[name] = { frames: s.frames.length, fps: 10, loop: false, holds: s.holds.slice(), marks: s.marks ? { ...s.marks } : undefined };
  }
  if (!Object.keys(added).length) return;
  base.extraAnims = { ...own, ...added };
  base.drawExtra = (p, anim, frame, o) => {
    if (!added[anim] && ownDraw) return ownDraw(p, anim, frame, o);
    const s = SHIM[anim];
    if (!s) return;
    p.blit(shimFrame(base, s.frames[Math.max(0, Math.min(frame, s.frames.length - 1))], o), 0, 0);
  };
}

/** The monsters named by `?poseshim=` (empty without the flag or outside the v3 look). */
export function poseShimTargets(search: string): MonsterId[] {
  if (!LOOK_V3) return [];
  let v: string | null = null;
  try {
    v = new URLSearchParams(search).get('poseshim');
  } catch {
    v = null;
  }
  if (!v || v === '0') return [];
  if (v === '1') return ['crystal_wyrm', 'abyss_magus'];
  if (v === 'all') return [...MONSTER_IDS];
  return v.split(',').filter((id): id is MonsterId => (MONSTER_IDS as readonly string[]).includes(id));
}

/** Boot hook: apply the shim to the monsters named in the URL (before the sheets are built). */
export function installPoseShim(search: string): MonsterId[] {
  const ids = poseShimTargets(search);
  for (const id of ids) applyPoseShim(monsterArt(id));
  if (ids.length) console.warn(`[pose-shim] test poses on ${ids.join(', ')}`);
  return ids;
}
