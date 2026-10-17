// Animation timing and lookup helpers for the MonsterArt contract (v3, A1). Pure functions, no
// Phaser: safe in vitest and in node tools.
//
// Timing model (matches Phaser 3.90 playback, Animation.js getFirstTick / getNextTick:
// `nextTick = currentFrame.duration || msPerFrame`): frame f of an AnimSpec is shown for
// `holds[f]` ms when that entry is a positive number, otherwise for 1000/fps ms. Frame f is on
// screen for local times in [frameStartMs(f), frameStartMs(f + 1)). Ported from
// src/artlab/core/anim.ts (LabAnim.durations → AnimSpec.holds with the fps fallback).
//
// For a spec WITHOUT holds every result is computed exactly like the code it replaces
// (`(frames / fps) * 1000`), so the old monsters' timings stay bit-identical.
//
// Never use Phaser's Animation.duration / msPerFrame for these: they ignore per-frame holds.

import type { AnimMark, AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPointName } from './types';
import { MONSTER_ANIMS, MONSTER_ANIMS_EXTRA } from './types';

// ---------------------------------------------------------------- spec timing

/** fps used for frames without a hold (guards against 0 / bad values). */
function fpsOf(spec: AnimSpec): number {
  return spec.fps > 0 && Number.isFinite(spec.fps) ? spec.fps : 1;
}

/** The explicit hold of frame `f` in ms, or 0 when the frame uses the 1000/fps default. */
export function holdOf(spec: AnimSpec, frame: number): number {
  const d = spec.holds?.[frame];
  return typeof d === 'number' && d > 0 && Number.isFinite(d) ? d : 0;
}

/** True when at least one frame of the spec has its own hold time. */
export function hasHolds(spec: AnimSpec): boolean {
  if (!spec.holds) return false;
  for (let f = 0; f < spec.frames; f++) if (holdOf(spec, f)) return true;
  return false;
}

/** How long frame `frame` stays on screen (ms). */
export function frameMs(spec: AnimSpec, frame: number): number {
  return holdOf(spec, frame) || 1000 / fpsOf(spec);
}

/**
 * ms from the start of frame `from` to the start of frame `to` (clamped to 0…frames; `to` =
 * frames means the end of the animation; fractional frames count that fraction of the frame).
 * Negative when to < from. Without holds this is exactly the old `((to - from) / fps) * 1000`.
 */
export function rangeMs(spec: AnimSpec, from: number, to: number): number {
  const a = clamp(from, 0, spec.frames);
  const b = clamp(to, 0, spec.frames);
  if (b < a) return -rangeMs(spec, b, a);
  if (!hasHolds(spec)) return ((b - a) / fpsOf(spec)) * 1000;
  let ms = 0;
  for (let f = Math.floor(a); f < Math.ceil(b); f++) {
    const lo = Math.max(a, f);
    const hi = Math.min(b, f + 1);
    if (hi > lo) ms += hi - lo === 1 ? frameMs(spec, f) : (hi - lo) * frameMs(spec, f);
  }
  return ms;
}

/** Start time (ms, relative to the animation start) of frame `frame` (clamped to 0…frames). */
export function frameStartMs(spec: AnimSpec, frame: number): number {
  return rangeMs(spec, 0, frame);
}

/** End time (ms) of frame `frame` = start of the next one. */
export function frameEndMs(spec: AnimSpec, frame: number): number {
  return rangeMs(spec, 0, clampInt(frame, 0, spec.frames - 1) + 1);
}

/** Total length (ms) of one pass of the animation. */
export function animLengthMs(spec: AnimSpec): number {
  return rangeMs(spec, 0, spec.frames);
}

/**
 * Frame shown `local` ms after the animation started (from frame 0, timeScale 1). Looping
 * animations wrap; one-shots hold their last frame; negative times show frame 0.
 */
export function frameAtMs(spec: AnimSpec, local: number): number {
  const n = spec.frames;
  if (n <= 1 || !(local > 0)) return 0;
  const total = animLengthMs(spec);
  if (spec.loop) local %= total;
  else if (local >= total) return n - 1;
  // cumulative boundaries, computed the same way as frameStartMs (no drift from summing floats)
  for (let f = 1; f < n; f++) if (local < frameStartMs(spec, f)) return f - 1;
  return n - 1;
}

/** Progress 0…1 of a time through one pass (clamped; loops wrap). */
export function progressAtMs(spec: AnimSpec, local: number): number {
  const total = animLengthMs(spec);
  if (!(total > 0) || !(local > 0)) return 0;
  if (spec.loop) return (local % total) / total;
  return Math.min(1, local / total);
}

// ---------------------------------------------------------------- marks

/** Frame index of a named mark, or `fallback` when the spec does not define it (clamped). */
export function markFrame(spec: AnimSpec, mark: AnimMark, fallback: number): number {
  const f = spec.marks?.[mark];
  return clampInt(typeof f === 'number' && Number.isFinite(f) ? f : fallback, 0, Math.max(0, spec.frames - 1));
}

/** Start time (ms) of a named mark (see markFrame). */
export function markMs(spec: AnimSpec, mark: AnimMark, fallback: number): number {
  return frameStartMs(spec, markFrame(spec, mark, fallback));
}

// ---------------------------------------------------------------- art lookups

export function isExtraAnim(anim: string): anim is MonsterAnimExtra {
  return (MONSTER_ANIMS_EXTRA as string[]).includes(anim);
}

export function isBaseAnim(anim: string): anim is MonsterAnim {
  return (MONSTER_ANIMS as string[]).includes(anim);
}

/** The spec of any animation of a monster, or undefined when the art does not have it. */
export function animSpec(art: MonsterArt, anim: AnyMonsterAnim): AnimSpec | undefined {
  if (isBaseAnim(anim)) return art.anims[anim];
  if (!art.drawExtra) return undefined;
  const s = art.extraAnims?.[anim];
  return s && s.frames > 0 ? s : undefined;
}

/** True when the monster draws this animation (the five base anims always; extras when defined). */
export function hasAnim(art: MonsterArt, anim: AnyMonsterAnim): boolean {
  return !!animSpec(art, anim);
}

/**
 * Every animation of a monster in sheet order: MONSTER_ANIMS, then its extras in
 * MONSTER_ANIMS_EXTRA order (independent of object key order). Old monsters → MONSTER_ANIMS.
 */
export function animList(art: MonsterArt): AnyMonsterAnim[] {
  const out: AnyMonsterAnim[] = [...MONSTER_ANIMS];
  if (art.extraAnims && art.drawExtra) for (const a of MONSTER_ANIMS_EXTRA) if (animSpec(art, a)) out.push(a);
  return out;
}

/** Frame of a named mark of one of the monster's animations. `attack`'s 'impact' defaults to attackImpactFrame. */
export function artMarkFrame(art: MonsterArt, anim: AnyMonsterAnim, mark: AnimMark, fallback?: number): number {
  const spec = animSpec(art, anim);
  if (!spec) return 0;
  const fb = fallback ?? (anim === 'attack' && mark === 'impact' ? art.attackImpactFrame : 0);
  return markFrame(spec, mark, fb);
}

/** ms from the start of `anim` to its mark (see artMarkFrame); 0 when the anim is missing. */
export function artMarkMs(art: MonsterArt, anim: AnyMonsterAnim, mark: AnimMark, fallback?: number): number {
  const spec = animSpec(art, anim);
  return spec ? frameStartMs(spec, artMarkFrame(art, anim, mark, fallback)) : 0;
}

/** Attack impact frame: marks.impact of `attack`, else attackImpactFrame. */
export function impactFrame(art: MonsterArt): number {
  return artMarkFrame(art, 'attack', 'impact');
}

/**
 * ms from the attack start to its impact frame. Without holds / marks this is exactly the old
 * `(attackImpactFrame / anims.attack.fps) * 1000`.
 */
export function impactMs(art: MonsterArt): number {
  return frameStartMs(art.anims.attack, impactFrame(art));
}

/** Total length of one of the monster's animations (0 when missing). */
export function artAnimMs(art: MonsterArt, anim: AnyMonsterAnim): number {
  const spec = animSpec(art, anim);
  return spec ? animLengthMs(spec) : 0;
}

/**
 * A point of interest of one frame (frame pixels, facing right): `points()` when the art has it
 * and names the point, else the fixed fallback — muzzle → art.muzzle, feet → the anchor, every
 * other name → art.core.
 */
export function framePoint(art: MonsterArt, anim: AnyMonsterAnim, frame: number, name: MonsterPointName): { x: number; y: number } {
  const p = art.points?.(anim, frame)?.[name];
  if (p) return { x: p.x, y: p.y };
  if (name === 'muzzle') return { x: art.muzzle.x, y: art.muzzle.y };
  if (name === 'feet') return { x: art.anchorX, y: art.anchorY };
  return { x: art.core.x, y: art.core.y };
}

// ---------------------------------------------------------------- util

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function clampInt(v: number, lo: number, hi: number): number {
  return clamp(Math.round(v), lo, hi);
}
