// Frame timing helpers for LabAnim (per-frame hold times). Pure functions.

import type { LabAnim, LabMonsterArt } from '../types';

/** Total length of an animation in ms. */
export function animLength(spec: LabAnim): number {
  let s = 0;
  for (const d of spec.durations) s += Math.max(1, d);
  return s;
}

/** Start time (ms, relative to the anim start) of frame `frame`. */
export function frameStart(spec: LabAnim, frame: number): number {
  let s = 0;
  const n = Math.max(0, Math.min(frame, spec.durations.length));
  for (let i = 0; i < n; i++) s += Math.max(1, spec.durations[i]);
  return s;
}

/** Frame index of a named mark, or `fallback` (clamped) when the art does not define it. */
export function markFrame(spec: LabAnim, mark: string, fallback: number): number {
  const f = spec.marks?.[mark];
  const n = spec.durations.length;
  return Math.max(0, Math.min(n - 1, f ?? fallback));
}

/** Start time (ms) of a named mark (see markFrame). */
export function markTime(spec: LabAnim, mark: string, fallback: number): number {
  return frameStart(spec, markFrame(spec, mark, fallback));
}

/**
 * Frame shown `local` ms after the animation started. Looping anims wrap; one-shot anims hold
 * their last frame; negative times show frame 0.
 */
export function frameAt(spec: LabAnim, local: number): number {
  const n = spec.durations.length;
  if (n <= 1 || local <= 0) return 0;
  const total = animLength(spec);
  if (spec.loop) local = local % total;
  else if (local >= total) return n - 1;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += Math.max(1, spec.durations[i]);
    if (local < acc) return i;
  }
  return n - 1;
}

export function animOf<A extends string>(art: LabMonsterArt<A>, anim: A): LabAnim {
  return art.anims[anim];
}
