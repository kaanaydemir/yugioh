// Projected state: replays engine events onto a cloned GameState so a cinematic can ask
// "what does the board look like right before / after THIS event?" (current ATK/DEF with
// equips and field spells, who is in which zone, LP at this beat...).
//
// The engine does not expose its intermediate states, so this reducer mirrors rules.ts at the
// level the presentation needs. At the end of every batch the Director compares the projection
// with the engine's real `after` state (debug warning on mismatch) and continues from the
// engine's state, so small drifts can never accumulate.

import { CARDS, isSpell } from '../../data/cards';
import type { GameEvent, GameState, MonsterSlot, PlayerId, Uid } from '../../engine/types';

/** Remove `uid` from every hand, deck, graveyard and field zone of `s`. */
function detach(s: GameState, uid: Uid): void {
  for (const ps of s.players) {
    let i = ps.hand.indexOf(uid);
    if (i >= 0) ps.hand.splice(i, 1);
    i = ps.deck.indexOf(uid);
    if (i >= 0) ps.deck.splice(i, 1);
    i = ps.graveyard.indexOf(uid);
    if (i >= 0) ps.graveyard.splice(i, 1);
    for (let z = 0; z < ps.monsters.length; z++) if (ps.monsters[z]?.uid === uid) ps.monsters[z] = null;
    for (let z = 0; z < ps.spellTraps.length; z++) if (ps.spellTraps[z]?.uid === uid) ps.spellTraps[z] = null;
    if (ps.fieldSpell?.uid === uid) ps.fieldSpell = null;
  }
}

function freshMonster(uid: Uid, turn: number, faceUp: boolean, position: 'attack' | 'defense'): MonsterSlot {
  return { uid, position, faceUp, enteredTurn: turn, attacksThisTurn: 0, positionChangedTurn: -1 };
}

/** Apply one event to `s` in place (s must be a private clone). */
export function applyEvent(s: GameState, ev: GameEvent): void {
  switch (ev.type) {
    case 'gameStart':
      s.firstPlayer = ev.firstPlayer;
      s.activePlayer = ev.firstPlayer;
      return;
    case 'shuffle':
      return;
    case 'draw': {
      const ps = s.players[ev.player];
      const i = ps.deck.indexOf(ev.uid);
      if (i >= 0) ps.deck.splice(i, 1);
      if (!ps.hand.includes(ev.uid)) ps.hand.push(ev.uid);
      return;
    }
    case 'turnStart':
      s.activePlayer = ev.player;
      s.turn = ev.turn;
      for (const ps of s.players) {
        ps.normalSummonUsed = false;
        for (const m of ps.monsters) if (m) m.attacksThisTurn = 0;
      }
      return;
    case 'phaseChange':
      s.phase = ev.phase;
      return;
    case 'tribute': {
      const ps = s.players[ev.player];
      if (ps.monsters[ev.zone]?.uid === ev.uid) ps.monsters[ev.zone] = null;
      return;
    }
    case 'summon': {
      const ps = s.players[ev.player];
      if (ev.from === 'field') {
        const slot = ps.monsters[ev.zone];
        if (slot && slot.uid === ev.uid) {
          slot.faceUp = true;
          slot.position = ev.position;
          slot.positionChangedTurn = s.turn;
          return;
        }
      }
      detach(s, ev.uid);
      if (ev.from === 'hand') ps.normalSummonUsed = true;
      ps.monsters[ev.zone] = freshMonster(ev.uid, s.turn, true, ev.position);
      return;
    }
    case 'setMonster': {
      const ps = s.players[ev.player];
      detach(s, ev.uid);
      ps.normalSummonUsed = true;
      ps.monsters[ev.zone] = freshMonster(ev.uid, s.turn, false, 'defense');
      return;
    }
    case 'setSpellTrap': {
      const ps = s.players[ev.player];
      detach(s, ev.uid);
      ps.spellTraps[ev.zone] = { uid: ev.uid, faceUp: false, setTurn: s.turn, equippedTo: null };
      return;
    }
    case 'positionChange': {
      const slot = s.players[ev.player].monsters[ev.zone];
      if (slot && slot.uid === ev.uid) {
        slot.position = ev.position;
        slot.positionChangedTurn = s.turn;
      }
      return;
    }
    case 'flip': {
      const slot = s.players[ev.player].monsters[ev.zone];
      if (slot && slot.uid === ev.uid) slot.faceUp = true;
      return;
    }
    case 'activate': {
      const ps = s.players[ev.player];
      if (ev.kind === 'monsterEffect') return;
      if (ev.from === 'hand') {
        const i = ps.hand.indexOf(ev.uid);
        if (i >= 0) ps.hand.splice(i, 1);
        const d = CARDS[ev.cardId];
        // equip spells from hand land in their spell/trap zone at activation
        if (isSpell(d) && d.spellType === 'equip' && ev.zone !== null)
          ps.spellTraps[ev.zone] = { uid: ev.uid, faceUp: true, setTurn: -1, equippedTo: null };
      } else if (ev.from === 'spellTrap' && ev.zone !== null) {
        const st = ps.spellTraps[ev.zone];
        if (st && st.uid === ev.uid) st.faceUp = true;
      }
      return;
    }
    case 'target':
    case 'attackNegated':
    case 'battle':
    case 'statChange':
    case 'deckOut':
      return;
    case 'attackDeclare': {
      const slot = s.players[ev.player].monsters[ev.attackerZone];
      if (slot && slot.uid === ev.attackerUid) slot.attacksThisTurn++;
      return;
    }
    case 'damage':
    case 'lpGain':
      s.players[ev.player].lp = ev.lpAfter;
      return;
    case 'destroy': {
      const ps = s.players[ev.player];
      if (ev.location === 'monster') {
        if (ps.monsters[ev.zone]?.uid === ev.uid) ps.monsters[ev.zone] = null;
      } else if (ev.location === 'spellTrap') {
        if (ps.spellTraps[ev.zone]?.uid === ev.uid) ps.spellTraps[ev.zone] = null;
      } else if (ps.fieldSpell?.uid === ev.uid) ps.fieldSpell = null;
      return;
    }
    case 'toGraveyard':
      detach(s, ev.uid);
      s.players[ev.owner].graveyard.push(ev.uid);
      return;
    case 'equip': {
      const st = s.players[ev.player].spellTraps[ev.spellZone];
      if (st && st.uid === ev.spellUid) st.equippedTo = ev.targetUid;
      return;
    }
    case 'fieldSpell': {
      const ps = s.players[ev.player];
      if (ev.active) {
        detach(s, ev.uid);
        ps.fieldSpell = { uid: ev.uid, faceUp: true, setTurn: -1, equippedTo: null };
      } else if (ps.fieldSpell?.uid === ev.uid) ps.fieldSpell = null;
      return;
    }
    case 'discard': {
      const ps = s.players[ev.player];
      const i = ps.hand.indexOf(ev.uid);
      if (i >= 0) ps.hand.splice(i, 1);
      return;
    }
    case 'decision':
      s.pending = structuredClone(ev.pending);
      return;
    case 'responseDeclined':
      s.pending = null;
      return;
    case 'gameOver':
      s.winner = ev.winner;
      s.winReason = ev.reason;
      s.pending = null;
      return;
  }
}

/**
 * Snapshots for a batch: result[i] is the state right before events[i]; result[events.length]
 * is the projected end state. Each snapshot is an independent clone (handlers may read freely).
 */
export function projectBatch(before: GameState, events: readonly GameEvent[]): GameState[] {
  const out: GameState[] = [];
  const s = structuredClone(before);
  // the action that started this batch answered any pending decision (respond / chooseTarget /
  // discard clear it before their first event)
  s.pending = null;
  out.push(structuredClone(s));
  for (const ev of events) {
    try {
      applyEvent(s, ev);
    } catch (e) {
      console.warn('[cinematics] projection failed on', ev.type, e);
    }
    out.push(structuredClone(s));
  }
  return out;
}

/**
 * Reconstruct a plausible "before" state for the newGame batch (the engine only returns the
 * after state): the opening hands go back on top of the decks, turn 1 draw phase.
 */
export function rewindNewGame(after: GameState, events: readonly GameEvent[]): GameState {
  const s = structuredClone(after);
  s.phase = 'draw';
  s.turn = 1;
  s.pending = null;
  const drawn: Record<PlayerId, Uid[]> = { 0: [], 1: [] };
  for (const ev of events) if (ev.type === 'draw') drawn[ev.player].push(ev.uid);
  for (const p of [0, 1] as PlayerId[]) {
    const ps = s.players[p];
    ps.hand = ps.hand.filter((u) => !drawn[p].includes(u));
    ps.deck = [...drawn[p], ...ps.deck.filter((u) => !drawn[p].includes(u))];
  }
  return s;
}

/** Compact description of the differences between two states (debug: projection drift). */
export function stateDiff(a: GameState, b: GameState): string[] {
  const out: string[] = [];
  const ids = (xs: readonly ({ uid: Uid } | null)[]) => xs.map((x) => (x ? x.uid : '-')).join(',');
  for (const p of [0, 1] as PlayerId[]) {
    const pa = a.players[p];
    const pb = b.players[p];
    if (pa.lp !== pb.lp) out.push(`p${p}.lp ${pa.lp}≠${pb.lp}`);
    if (pa.hand.length !== pb.hand.length) out.push(`p${p}.hand ${pa.hand.length}≠${pb.hand.length}`);
    if (pa.deck.length !== pb.deck.length) out.push(`p${p}.deck ${pa.deck.length}≠${pb.deck.length}`);
    if (pa.graveyard.join() !== pb.graveyard.join()) out.push(`p${p}.grave [${pa.graveyard}]≠[${pb.graveyard}]`);
    if (ids(pa.monsters) !== ids(pb.monsters)) out.push(`p${p}.monsters [${ids(pa.monsters)}]≠[${ids(pb.monsters)}]`);
    pa.monsters.forEach((m, i) => {
      const n = pb.monsters[i];
      if (m && n && (m.faceUp !== n.faceUp || m.position !== n.position)) out.push(`p${p}.m${i} ${m.position}/${m.faceUp}≠${n.position}/${n.faceUp}`);
    });
    if (ids(pa.spellTraps) !== ids(pb.spellTraps)) out.push(`p${p}.st [${ids(pa.spellTraps)}]≠[${ids(pb.spellTraps)}]`);
    if ((pa.fieldSpell?.uid ?? -1) !== (pb.fieldSpell?.uid ?? -1)) out.push(`p${p}.field`);
  }
  if (a.phase !== b.phase) out.push(`phase ${a.phase}≠${b.phase}`);
  if (a.turn !== b.turn) out.push(`turn ${a.turn}≠${b.turn}`);
  if (a.activePlayer !== b.activePlayer) out.push(`active ${a.activePlayer}≠${b.activePlayer}`);
  if (a.winner !== b.winner) out.push(`winner ${a.winner}≠${b.winner}`);
  return out;
}
