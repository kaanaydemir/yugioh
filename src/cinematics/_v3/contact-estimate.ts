// v3: when will a strike's blow land? — an estimate readable at the attack DECLARATION.
//
// A strike without a 'contact' mark (thrown / fired / dashing: its flight is its own) reports its exact contact time
// only once it runs (StrikeArgs.contactIn). The declaration comes ~0.3–0.5 s earlier, and the target's idle settle
// (posematch.ts, ±35 % of the loop's pace) reaches much further with that extra lead. So each such strike also
// registers an ESTIMATOR here: ms from the strike's start to its contact, from the attacker / target geometry, the
// same timeline the strike plays. The declaration settles with it; the strike's own report re-plans on its first
// frame (a new settle re-plans from where the loop is), so an estimate only needs to be close.

import type { MonsterUnit } from '../../duel/MonsterUnit';

/** ms from the strike's start to its blow landing on `target` (null: no estimate for this pairing). */
export type ContactEstimator = (attacker: MonsterUnit, target: MonsterUnit) => number | null;

const estimators = new Map<string, ContactEstimator>();

/** Register `id`'s estimate (one per card id; a later call replaces it). Returns an unregister function. */
export function registerContactEstimate(id: string, fn: ContactEstimator): () => void {
  estimators.set(id, fn);
  return () => {
    if (estimators.get(id) === fn) estimators.delete(id);
  };
}

/** The estimate for this attacker's strike on `target` (ms from the strike's start), or null. */
export function contactEstimate(attacker: MonsterUnit | null, target: MonsterUnit | null): number | null {
  if (!attacker || !target) return null;
  const fn = estimators.get(attacker.cardId);
  if (!fn) return null;
  const ms = fn(attacker, target);
  return ms !== null && Number.isFinite(ms) && ms > 0 ? ms : null;
}

/** Floor distance (px) between two units' homes — the dash / flight length the strikes scale their timing by. */
export function homeDistance(a: MonsterUnit, b: MonsterUnit): number {
  return Math.hypot(b.home.x - a.home.x, b.home.y - a.home.y);
}
