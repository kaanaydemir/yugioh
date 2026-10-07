// Read-only queries over a GameState. Pure functions, never mutate.

import {
  CARDS,
  isMonster,
  isSpell,
  isTrap,
  type CardDef,
  type MonsterCardDef,
  type SpellCardDef,
  type TrapCardDef,
} from '../data/cards';
import type { Action, GameState, MonsterSlot, PlayerId, SpellTrapSlot, Uid, ZoneRef } from './types';

export const PLAYERS: readonly PlayerId[] = [0, 1];

/** Minimum current ATK of a Normal/Tribute Summoned monster that opens the chasm_trap window. */
export const CHASM_MIN_ATK = 1000;

export function defOf(s: GameState, uid: Uid): CardDef {
  const card = s.cards[uid];
  if (!card) throw new Error(`unknown uid ${uid}`);
  return CARDS[card.cardId];
}

export function monsterDefOf(s: GameState, uid: Uid): MonsterCardDef | null {
  const d = defOf(s, uid);
  return isMonster(d) ? d : null;
}

export function spellDefOf(s: GameState, uid: Uid): SpellCardDef | null {
  const d = defOf(s, uid);
  return isSpell(d) ? d : null;
}

export function trapDefOf(s: GameState, uid: Uid): TrapCardDef | null {
  const d = defOf(s, uid);
  return isTrap(d) ? d : null;
}

/** Where a card currently is on the field, or null. */
export function locate(s: GameState, uid: Uid): ZoneRef | null {
  for (const p of PLAYERS) {
    const ps = s.players[p];
    for (let i = 0; i < ps.monsters.length; i++) if (ps.monsters[i]?.uid === uid) return { player: p, zone: 'monster', index: i };
    for (let i = 0; i < ps.spellTraps.length; i++) if (ps.spellTraps[i]?.uid === uid) return { player: p, zone: 'spellTrap', index: i };
    if (ps.fieldSpell?.uid === uid) return { player: p, zone: 'field', index: 0 };
  }
  return null;
}

export interface MonsterLoc {
  player: PlayerId;
  index: number;
  slot: MonsterSlot;
}

/** The monster zone holding `uid`, or null. */
export function findMonster(s: GameState, uid: Uid): MonsterLoc | null {
  for (const p of PLAYERS) {
    const ms = s.players[p].monsters;
    for (let i = 0; i < ms.length; i++) {
      const slot = ms[i];
      if (slot && slot.uid === uid) return { player: p, index: i, slot };
    }
  }
  return null;
}

export interface SpellTrapLoc {
  player: PlayerId;
  index: number;
  slot: SpellTrapSlot;
}

export function findSpellTrap(s: GameState, uid: Uid): SpellTrapLoc | null {
  for (const p of PLAYERS) {
    const sts = s.players[p].spellTraps;
    for (let i = 0; i < sts.length; i++) {
      const slot = sts[i];
      if (slot && slot.uid === uid) return { player: p, index: i, slot };
    }
  }
  return null;
}

export function freeMonsterZones(s: GameState, p: PlayerId): number[] {
  const out: number[] = [];
  s.players[p].monsters.forEach((m, i) => {
    if (!m) out.push(i);
  });
  return out;
}

export function freeSpellTrapZones(s: GameState, p: PlayerId): number[] {
  const out: number[] = [];
  s.players[p].spellTraps.forEach((st, i) => {
    if (!st) out.push(i);
  });
  return out;
}

/** True when a face-up field spell with the volcano effect is active (anyone's). */
export function volcanoActive(s: GameState): boolean {
  for (const p of PLAYERS) {
    const fs = s.players[p].fieldSpell;
    if (fs && fs.faceUp) {
      const d = defOf(s, fs.uid);
      if (isSpell(d) && d.effect === 'fieldVolcano') return true;
    }
  }
  return false;
}

/** ATK bonus from face-up equip spells attached to `uid`. */
export function equipBonus(s: GameState, uid: Uid): number {
  let bonus = 0;
  for (const p of PLAYERS) {
    for (const st of s.players[p].spellTraps) {
      if (st && st.faceUp && st.equippedTo === uid) {
        const d = defOf(s, st.uid);
        if (isSpell(d) && d.effect === 'equipAtk700') bonus += 700;
      }
    }
  }
  return bonus;
}

/** ATK modifier of the active field spell(s) for a monster of the given attribute. */
export function fieldAtkModifier(s: GameState, d: MonsterCardDef): number {
  let mod = 0;
  for (const p of PLAYERS) {
    const fs = s.players[p].fieldSpell;
    if (!fs || !fs.faceUp) continue;
    const fd = defOf(s, fs.uid);
    if (isSpell(fd) && fd.effect === 'fieldVolcano') {
      if (d.attribute === 'FIRE') mod += 500;
      else if (d.attribute === 'WATER') mod -= 300;
    }
  }
  return mod;
}

/** Current ATK: base + equips + field spell for face-up field monsters (floor 0); base otherwise. */
export function currentAtk(s: GameState, uid: Uid): number {
  const card = s.cards[uid];
  if (!card) return 0;
  const d = CARDS[card.cardId];
  if (!isMonster(d)) return 0;
  const loc = findMonster(s, uid);
  if (!loc || !loc.slot.faceUp) return d.atk;
  return Math.max(0, d.atk + equipBonus(s, uid) + fieldAtkModifier(s, d));
}

/** Current DEF (no card in the pool modifies DEF yet; kept symmetric with currentAtk). */
export function currentDef(s: GameState, uid: Uid): number {
  const card = s.cards[uid];
  if (!card) return 0;
  const d = CARDS[card.cardId];
  if (!isMonster(d)) return 0;
  return Math.max(0, d.def);
}

/** Face-down traps of `p` with one of `effects`, set on an earlier turn (eligible to respond now). */
export function respondableTraps(s: GameState, p: PlayerId, effects: readonly string[]): Uid[] {
  const out: Uid[] = [];
  for (const st of s.players[p].spellTraps) {
    if (!st || st.faceUp) continue;
    const d = defOf(s, st.uid);
    if (isTrap(d) && effects.includes(d.effect) && st.setTurn >= 0 && st.setTurn < s.turn) out.push(st.uid);
  }
  return out;
}

/** Monster zone refs of player `p` that hold a monster. */
export function monsterRefs(s: GameState, p: PlayerId): ZoneRef[] {
  const out: ZoneRef[] = [];
  s.players[p].monsters.forEach((m, i) => {
    if (m) out.push({ player: p, zone: 'monster', index: i });
  });
  return out;
}

/** Spell/trap zone refs (incl. the field zone) of player `p` that hold a card. */
export function spellTrapRefs(s: GameState, p: PlayerId): ZoneRef[] {
  const out: ZoneRef[] = [];
  s.players[p].spellTraps.forEach((st, i) => {
    if (st) out.push({ player: p, zone: 'spellTrap', index: i });
  });
  if (s.players[p].fieldSpell) out.push({ player: p, zone: 'field', index: 0 });
  return out;
}

/** Uid held at a field zone ref, or null. */
export function uidAt(s: GameState, ref: ZoneRef): Uid | null {
  const ps = s.players[ref.player];
  if (!ps) return null;
  if (ref.zone === 'monster') return ps.monsters[ref.index]?.uid ?? null;
  if (ref.zone === 'spellTrap') return ps.spellTraps[ref.index]?.uid ?? null;
  return ps.fieldSpell?.uid ?? null;
}

/** All k-combinations of `arr` (order preserved). */
export function combinations<T>(arr: readonly T[], k: number): T[][] {
  const out: T[][] = [];
  const pick: T[] = [];
  const rec = (start: number) => {
    if (pick.length === k) {
      out.push([...pick]);
      return;
    }
    for (let i = start; i <= arr.length - (k - pick.length); i++) {
      pick.push(arr[i]);
      rec(i + 1);
      pick.pop();
    }
  };
  if (k >= 0 && k <= arr.length) rec(0);
  return out;
}

// ---------------------------------------------------------------------------
// Action canonicalisation — used to compare an incoming action with legalActions().
// ---------------------------------------------------------------------------

const asc = (a: number, b: number) => a - b;

/**
 * Canonical copy of an action: unknown fields dropped, uid lists sorted, and the optional
 * `zone` of activateSpell kept only where it means something (equip spells from hand).
 */
export function normalizeAction(s: GameState, a: Action): Action {
  switch (a.type) {
    case 'normalSummon':
    case 'setMonster':
      return { type: a.type, player: a.player, uid: a.uid, zone: a.zone, tributes: [...(a.tributes ?? [])].sort(asc) };
    case 'flipSummon':
    case 'changePosition':
      return { type: a.type, player: a.player, zone: a.zone };
    case 'setSpellTrap':
      return { type: a.type, player: a.player, uid: a.uid, zone: a.zone };
    case 'activateSpell': {
      const out: Extract<Action, { type: 'activateSpell' }> = { type: 'activateSpell', player: a.player, uid: a.uid };
      const card = s.cards[a.uid];
      const d = card ? CARDS[card.cardId] : undefined;
      const inHand = s.players[a.player]?.hand.includes(a.uid) ?? false;
      if (inHand && d && isSpell(d) && d.spellType === 'equip') out.zone = a.zone;
      if (a.target) {
        out.target =
          a.target.kind === 'monster'
            ? { kind: 'monster', ref: { player: a.target.ref.player, zone: a.target.ref.zone, index: a.target.ref.index } }
            : { kind: 'graveyard', uid: a.target.uid, toZone: a.target.toZone };
      }
      return out;
    }
    case 'enterBattle':
    case 'endTurn':
    case 'surrender':
      return { type: a.type, player: a.player };
    case 'attack':
      return { type: 'attack', player: a.player, attackerZone: a.attackerZone, targetZone: a.targetZone ?? null };
    case 'respond':
      return { type: 'respond', player: a.player, uid: a.uid ?? null };
    case 'chooseTarget':
      return { type: 'chooseTarget', player: a.player, target: { player: a.target.player, zone: a.target.zone, index: a.target.index } };
    case 'discard':
      return { type: 'discard', player: a.player, uids: [...a.uids].sort(asc) };
  }
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'undefined';
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const o = v as Record<string, unknown>;
  return (
    '{' +
    Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + stableStringify(o[k]))
      .join(',') +
    '}'
  );
}

/** Stable string key of an action (normalize first for semantic comparison). */
export function actionKey(a: Action): string {
  return stableStringify(a);
}
