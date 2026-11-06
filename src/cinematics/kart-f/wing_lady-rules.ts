// Kanat Hanımı (wing_lady) — the aura's engine reading (lane F). Pure (no Phaser): unit-tested in
// tests/cinematics/wing_lady-aura.test.ts. Exports only (the cinematics glob imports this file).

import { CARDS, isMonster, type MonsterCardDef } from '../../data/cards';
import { auraBonus } from '../../engine/query';
import type { GameEvent, GameState, PlayerId, Uid } from '../../engine/types';

// ================================================================ engine reading (never the ATK number)

/** The slot of `uid` and its controller in `s` (null: not on the field). */
export function slotOf(s: GameState, uid: Uid): { p: PlayerId; i: number; faceUp: boolean } | null {
  for (const p of [0, 1] as PlayerId[]) {
    const ms = s.players[p].monsters;
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i];
      if (m && m.uid === uid) return { p, i, faceUp: m.faceUp };
    }
  }
  return null;
}

function monDef(s: GameState, uid: Uid): MonsterCardDef | null {
  const c = s.cards[uid];
  const d = c ? CARDS[c.cardId] : null;
  return d && isMonster(d) ? d : null;
}

/** The +ATK the wind aura gives `uid` in `s` (0 when it is not a face-up monster on the field). */
export function bonusIn(s: GameState, uid: Uid): number {
  const at = slotOf(s, uid);
  const d = monDef(s, uid);
  if (!at || !at.faceUp || !d) return 0;
  return auraBonus(s, uid, d, at.p);
}

/** Face-up ladies (windAura300) on `p`'s field in `s`. */
export function ladiesIn(s: GameState, p: PlayerId): Uid[] {
  const out: Uid[] = [];
  for (const m of s.players[p].monsters) if (m && m.faceUp && monDef(s, m.uid)?.effect === 'windAura300') out.push(m.uid);
  return out;
}

/** Every face-up lady on the field in `s`. */
export function allLadies(s: GameState): Uid[] {
  return [...ladiesIn(s, 0), ...ladiesIn(s, 1)];
}

/**
 * Is `events[i]` (a statChange) caused by the wind aura? The engine emits statChanges as one `withStats` diff
 * after the events that caused them, and the projector treats statChange as a no-op, so the aura's Δ is read over
 * that block: from the first event after the previous statChange run (or the batch start) to the run itself.
 * Returns the signed Δ (±300·k) or 0.
 */
export function auraDelta(events: readonly GameEvent[], stateAt: (i: number) => GameState, i: number): number {
  const e = events[i];
  if (!e || e.type !== 'statChange') return 0;
  let k = i;
  while (k - 1 >= 0 && events[k - 1].type === 'statChange') k--;
  let j = k - 1;
  while (j >= 0 && events[j].type !== 'statChange') j--;
  const jStart = j + 1;
  const d = bonusIn(stateAt(k), e.uid) - bonusIn(stateAt(jStart), e.uid);
  if (d === 0 || e.atk - e.prevAtk !== d || e.def !== e.prevDef) return 0;
  return d;
}

/** The first event index of the block that holds statChange `i` (see auraDelta). */
export function blockStart(events: readonly GameEvent[], i: number): number {
  let k = i;
  while (k - 1 >= 0 && events[k - 1].type === 'statChange') k--;
  let j = k - 1;
  while (j >= 0 && events[j].type !== 'statChange') j--;
  return j + 1;
}


/**
 * Round 3 #1: a tribute group that takes a face-up lady away. `i` is a `tribute` event; the group is every tribute
 * for the same `forUid` that follows it (with their toGraveyard / destroy moves), then the summon / set of `forUid`.
 * Returns the ladies in the group and the indices of the aura-LOSS statChanges the engine emits after that summon
 * (empty when no lady is tributed or nothing is lost), so the cinematic can play the loss as her card leaves instead
 * of after the new monster's whole entrance.
 */
export function tributeAuraLoss(events: readonly GameEvent[], stateAt: (i: number) => GameState, i: number): { ladies: Uid[]; losses: number[] } {
  const e = events[i];
  if (!e || e.type !== 'tribute') return { ladies: [], losses: [] };
  const s0 = stateAt(i);
  const group: Uid[] = [];
  let k = i;
  for (; k < events.length; k++) {
    const x = events[k];
    if (x.type === 'tribute' && x.forUid === e.forUid) group.push(x.uid);
    else if (x.type === 'toGraveyard' || x.type === 'destroy') continue;
    else break;
  }
  const ladies = group.filter((u) => {
    const at = slotOf(s0, u);
    return !!at && at.faceUp && monDef(s0, u)?.effect === 'windAura300';
  });
  if (!ladies.length) return { ladies, losses: [] };
  // the destination (summon / set of forUid), then the statChange run right after it
  for (; k < events.length; k++) {
    const x = events[k];
    if ((x.type === 'summon' || x.type === 'setMonster') && x.uid === e.forUid) {
      k++;
      break;
    }
    if (x.type !== 'toGraveyard' && x.type !== 'destroy') return { ladies, losses: [] };
  }
  const losses: number[] = [];
  for (; k < events.length && events[k].type === 'statChange'; k++) if (auraDelta(events, stateAt, k) < 0) losses.push(k);
  return { ladies, losses };
}
