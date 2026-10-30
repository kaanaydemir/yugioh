// Read-only queries over a GameState. Pure functions, never mutate.

import {
  CARDS,
  SEAL_IDS,
  isMonster,
  isSpell,
  isTrap,
  tributesFor,
  type CardDef,
  type MonsterCardDef,
  type SpellCardDef,
  type TrapCardDef,
} from '../data/cards';
import type { Action, GameState, MonsterSlot, PlayerId, Position, SpellTrapSlot, Uid, ZoneRef } from './types';

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
        else if (isSpell(d) && d.effect === 'equipPiercing') bonus += 300;
      }
    }
  }
  return bonus;
}

/** The face-up equip spell of `effect` attached to monster `uid` (first by player / zone order), or null. */
export function equipOfEffect(s: GameState, uid: Uid, effect: string): SpellTrapLoc | null {
  for (const p of PLAYERS) {
    const sts = s.players[p].spellTraps;
    for (let i = 0; i < sts.length; i++) {
      const st = sts[i];
      if (st && st.faceUp && st.equippedTo === uid) {
        const d = defOf(s, st.uid);
        if (isSpell(d) && d.effect === effect) return { player: p, index: i, slot: st };
      }
    }
  }
  return null;
}

/** Does this monster deal piercing damage (the coral_serpent effect, or a piercing_lance equip)? */
export function hasPiercing(s: GameState, uid: Uid): boolean {
  return monsterDefOf(s, uid)?.effect === 'piercing' || equipOfEffect(s, uid, 'equipPiercing') !== null;
}

/** A one-turn boost (battle_cry / hidden_reinforcement) is live on its turn until the End Phase. */
function boostLive(s: GameState, slot: MonsterSlot): boolean {
  return slot.boostTurn === s.turn && s.phase !== 'end';
}

/** Tributes needed to Normal Summon / Set a monster of `level` for player `p` right now (double_offering aware). */
export function tributeNeed(s: GameState, p: PlayerId, level: number): number {
  const n = tributesFor(level);
  return level >= 7 && s.players[p].tributeHelperTurn === s.turn ? n - 1 : n;
}

/** festival_square: `p` may make one more Normal Summon / Set of a Level <= 4 monster this turn. */
export function extraSummonAvailable(s: GameState, p: PlayerId): boolean {
  const ps = s.players[p];
  if (!ps.normalSummonUsed || ps.extraSummonTurn === s.turn) return false;
  const fs = ps.fieldSpell;
  if (!fs || !fs.faceUp) return false;
  const d = defOf(s, fs.uid);
  return isSpell(d) && d.effect === 'fieldExtraSummon';
}

/** ATK modifier of the active field spell(s) for a monster of the given attribute. */
export function fieldAtkModifier(s: GameState, d: MonsterCardDef): number {
  let mod = 0;
  for (const p of PLAYERS) {
    const fs = s.players[p].fieldSpell;
    if (!fs || !fs.faceUp) continue;
    const fd = defOf(s, fs.uid);
    if (!isSpell(fd)) continue;
    if (fd.effect === 'fieldVolcano') {
      if (d.attribute === 'FIRE') mod += 500;
      else if (d.attribute === 'WATER') mod -= 300;
    } else if (fd.effect === 'fieldTidalBay') {
      if (d.attribute === 'WATER' || d.attribute === 'WIND') mod += 400;
      else if (d.attribute === 'FIRE') mod -= 400;
    } else if (fd.effect === 'fieldShadowCavern') {
      if (d.attribute === 'DARK' || d.attribute === 'EARTH') mod += 300;
      else if (d.attribute === 'LIGHT') mod -= 300;
    }
  }
  return mod;
}

/** True when `p`'s opponent controls a face-up trapLock monster (Çelik Susturucu): `p` cannot activate traps. */
export function trapLocked(s: GameState, p: PlayerId): boolean {
  for (const m of s.players[p === 0 ? 1 : 0].monsters) {
    if (m && m.faceUp && monsterDefOf(s, m.uid)?.effect === 'trapLock') return true;
  }
  return false;
}

/** True when every one of the five seal cards is in `hand`. */
export function hasAllSeals(s: GameState, hand: readonly Uid[]): boolean {
  const have = new Set(hand.map((u) => s.cards[u]?.cardId));
  return SEAL_IDS.every((id) => have.has(id));
}

/** windAura300: +300 per OTHER face-up windAura monster on the same field when `d` is a WIND monster. */
export function auraBonus(s: GameState, uid: Uid, d: MonsterCardDef, controller: PlayerId): number {
  if (d.attribute !== 'WIND') return 0;
  let bonus = 0;
  for (const m of s.players[controller].monsters) {
    if (m && m.faceUp && m.uid !== uid && monsterDefOf(s, m.uid)?.effect === 'windAura300') bonus += 300;
  }
  return bonus;
}

/** summonTurnAtk500: +500 while attacking (own battle phase) on the turn it was Normal / Tribute Summoned. */
export function summonTurnBonus(s: GameState, d: MonsterCardDef, controller: PlayerId, slot: MonsterSlot): number {
  if (d.effect !== 'summonTurnAtk500') return 0;
  return slot.normalSummoned && slot.position === 'attack' && slot.enteredTurn === s.turn && s.activePlayer === controller && s.phase === 'battle' ? 500 : 0;
}

/**
 * Current ATK: base + equips + field spell + auras (+ the knight's attack bonus) for face-up field
 * monsters (floor 0); base otherwise. Battle-only debuffs live in `battleNumbers`.
 */
export function currentAtk(s: GameState, uid: Uid): number {
  const card = s.cards[uid];
  if (!card) return 0;
  const d = CARDS[card.cardId];
  if (!isMonster(d)) return 0;
  const loc = findMonster(s, uid);
  if (!loc || !loc.slot.faceUp) return d.atk;
  const boost = boostLive(s, loc.slot) ? (loc.slot.boostAtk ?? 0) : 0;
  return Math.max(0, d.atk + equipBonus(s, uid) + fieldAtkModifier(s, d) + auraBonus(s, uid, d, loc.player) + summonTurnBonus(s, d, loc.player, loc.slot) + boost);
}

export interface BattleNumbers {
  /** The attacker's ATK in this battle (current ATK minus a defender's debuff). */
  atk: number;
  /** The target's ATK (attack position) or DEF (defense position); null for a direct attack. */
  targetValue: number | null;
  targetPosition: Position | null;
  /** Monster effects that changed a number (for the log / cinematics), as uids of the source monsters. */
  attackerDebuffBy: Uid | null;
  targetDebuffBy: Uid | null;
}

/**
 * The numbers a battle is fought with. A face-down target counts as a defense-position monster (it is
 * flipped before the damage step). Shared by the battle code (rules.ts) and the bot, so every
 * contextual modifier (grim_warden -400 on the target's ATK, shield_titan -500 on the attacker's ATK)
 * has one definition; persistent modifiers come from `currentAtk`.
 */
export function battleNumbers(s: GameState, attackerUid: Uid, targetUid: Uid | null): BattleNumbers {
  let atk = currentAtk(s, attackerUid);
  if (targetUid === null) return { atk, targetValue: null, targetPosition: null, attackerDebuffBy: null, targetDebuffBy: null };
  const aDef = monsterDefOf(s, attackerUid);
  const tLoc = findMonster(s, targetUid);
  const tDef = monsterDefOf(s, targetUid);
  if (!tLoc || !tDef) return { atk, targetValue: null, targetPosition: null, attackerDebuffBy: null, targetDebuffBy: null };
  const position: Position = tLoc.slot.faceUp ? tLoc.slot.position : 'defense';
  let attackerDebuffBy: Uid | null = null;
  let targetDebuffBy: Uid | null = null;
  if (position === 'defense' && tDef.effect === 'defenseAtkDebuff500' && atk > 0) {
    atk = Math.max(0, atk - 500);
    attackerDebuffBy = targetUid;
  }
  let targetValue: number;
  if (position === 'attack') {
    targetValue = currentAtk(s, targetUid);
    if (aDef?.effect === 'declareAtkDebuff400' && targetValue > 0) {
      targetValue = Math.max(0, targetValue - 400);
      targetDebuffBy = attackerUid;
    }
  } else targetValue = currentDef(s, targetUid);
  return { atk, targetValue, targetPosition: position, attackerDebuffBy, targetDebuffBy };
}

/** Current DEF: base plus a live one-turn boost (hidden_reinforcement); face-down monsters included. */
export function currentDef(s: GameState, uid: Uid): number {
  const card = s.cards[uid];
  if (!card) return 0;
  const d = CARDS[card.cardId];
  if (!isMonster(d)) return 0;
  const loc = findMonster(s, uid);
  const boost = loc && boostLive(s, loc.slot) ? (loc.slot.boostDef ?? 0) : 0;
  return Math.max(0, d.def + boost);
}

/** Face-down traps of `p` with one of `effects`, set on an earlier turn (eligible to respond now). */
export function respondableTraps(s: GameState, p: PlayerId, effects: readonly string[]): Uid[] {
  const out: Uid[] = [];
  if (trapLocked(s, p)) return out; // Çelik Susturucu: the face-down traps stay set
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
            : a.target.kind === 'card'
              ? { kind: 'card', ref: { player: a.target.ref.player, zone: a.target.ref.zone, index: a.target.ref.index } }
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
