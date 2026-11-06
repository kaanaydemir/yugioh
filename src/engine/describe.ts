// Short English battle-log lines for engine events ("Ember Wolf attacks Stone Sentinel!").
// Hidden information (drawn cards, set cards) is never revealed. Returns null for events that
// should not appear in the log.
//
// `state` is used only to resolve card names (state.cards never changes during a game), so
// either the state before or after the action works.

import { CARDS, type CardId } from '../data/cards';
import type { GameEvent, GameState, PendingDecision, PlayerId, Uid, ZoneRef } from './types';
import { uidAt } from './query';

/**
 * Kept for API compatibility: the log used to be Turkish and inflected names with case suffixes.
 * English needs no inflection, so every case renders as the bare name, except the genitive, which
 * takes the English possessive ("Ember Wolf's").
 */
export type GrammaticalCase = 'nom' | 'acc' | 'dat' | 'gen' | 'loc' | 'abl';

/** A name in a grammatical case: unchanged, except 'gen' → possessive ("Ember Wolf's", "Wings'"). */
export function inflect(name: string, kase: GrammaticalCase, _possessive = false): string {
  if (kase !== 'gen') return name;
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

/** Card name in a grammatical case. */
export function cardName(id: CardId, kase: GrammaticalCase = 'nom'): string {
  return inflect(CARDS[id].name, kase);
}

/** "Player 1" / "Player 2" in a grammatical case. */
export function playerName(p: PlayerId, kase: GrammaticalCase = 'nom'): string {
  return inflect(`Player ${p + 1}`, kase);
}


function nameOf(state: GameState, uid: Uid, kase: GrammaticalCase = 'nom'): string {
  const card = state.cards[uid];
  return card ? cardName(card.cardId, kase) : '?';
}

function refName(state: GameState, ref: ZoneRef): string | null {
  const uid = uidAt(state, ref);
  if (uid === null) return null;
  const ps = state.players[ref.player];
  const slot = ref.zone === 'monster' ? ps.monsters[ref.index] : ref.zone === 'spellTrap' ? ps.spellTraps[ref.index] : ps.fieldSpell;
  if (!slot || !slot.faceUp) return ref.zone === 'monster' ? 'a face-down monster' : 'a face-down card';
  return nameOf(state, uid);
}

function isFaceDownMonster(state: GameState, uid: Uid): boolean {
  for (const ps of state.players) for (const m of ps.monsters) if (m && m.uid === uid) return !m.faceUp;
  return false;
}

/** Short outcome note appended to the log line of the spell/trap batch 1 traps. */
const TRAP_NOTE: Partial<Record<CardId, string>> = {
  spell_seal: 'The Spell is negated.',
  homecoming: 'The attacker returns to the hand.',
  sandstorm: 'The attack stops; the opposing monsters switch to Defense.',
  hidden_reinforcement: 'The target grows stronger.',
};

const WIN_REASON: Record<string, string> = {
  lp: 'LP reached 0',
  deckout: 'deck ran out',
  surrender: 'opponent surrendered',
  seals: 'Five Seals complete',
};

/**
 * One short English log line for `ev`, or null if the event should not be logged.
 * `batch` (optional): the event list `ev` belongs to (e.g. the events of one apply). With it the
 * describer can look ahead — an attacked face-down target is not named before its flip, and a
 * target that the same batch destroys is still named.
 */
export function describeEvent(state: GameState, ev: GameEvent, batch?: readonly GameEvent[]): string | null {
  const later = batch ? batch.slice(batch.indexOf(ev) + 1) : [];
  switch (ev.type) {
    case 'gameStart':
      return `The duel begins! ${playerName(ev.firstPlayer)} goes first.`;
    case 'shuffle':
      return `${playerName(ev.player)} shuffles their Deck.`;
    case 'draw':
      return ev.initial ? null : `${playerName(ev.player)} draws a card.`;
    case 'turnStart':
      return `Turn ${ev.turn} - ${playerName(ev.player)}`;
    case 'phaseChange':
      if (ev.phase === 'battle') return `${playerName(ev.player)} enters the Battle Phase!`;
      if (ev.phase === 'end') return `${playerName(ev.player)}: End Phase.`;
      return null;
    case 'tribute':
      return `${playerName(ev.player)} Tributes ${cardName(ev.cardId)}.`;
    case 'summon':
      switch (ev.method) {
        case 'normal':
          return `${playerName(ev.player)} Normal Summons ${cardName(ev.cardId)}.`;
        case 'tribute':
          return `${playerName(ev.player)} Tribute Summons ${cardName(ev.cardId)}!`;
        case 'special':
          if (ev.from === 'token') return `${playerName(ev.player)} Summons a ${cardName(ev.cardId)} Token.`;
          if (ev.from === 'hand') return `${playerName(ev.player)} Special Summons ${cardName(ev.cardId)} from the hand!`;
          return `${playerName(ev.player)} Special Summons ${cardName(ev.cardId)} from the Graveyard!`;
        case 'flip':
          return `${playerName(ev.player)} Flip Summons ${cardName(ev.cardId)}!`;
      }
      return null;
    case 'setMonster':
      return `${playerName(ev.player)} Sets a monster.`;
    case 'setSpellTrap':
      return `${playerName(ev.player)} Sets a card.`;
    case 'positionChange':
      return `${nameOf(state, ev.uid)} switches to ${ev.position === 'defense' ? 'Defense' : 'Attack'} Position.`;
    case 'flip':
      return ev.cause === 'attacked' || ev.cause === 'reveal' ? `Face-down card flipped: ${cardName(ev.cardId)}!` : null;
    case 'counter':
      return ev.value === 0
        ? `${cardName(ev.cardId)} has ended.`
        : ev.prev === 0
          ? null
          : `${cardName(ev.cardId)}: ${ev.value} turn${ev.value === 1 ? '' : 's'} left.`;
    case 'activate':
      if (ev.kind === 'spell' && ev.cardId === 'guardian_charm' && ev.from === 'spellTrap')
        return `${cardName(ev.cardId)} protects the monster!`;
      if (ev.kind === 'spell') return `${playerName(ev.player)} activates a Spell: ${cardName(ev.cardId)}!`;
      if (ev.kind === 'trap') return `${playerName(ev.player)} activates a Trap: ${cardName(ev.cardId)}!${TRAP_NOTE[ev.cardId] ? ' ' + TRAP_NOTE[ev.cardId] : ''}`;
      return `${cardName(ev.cardId, 'gen')} effect!`;
    case 'target': {
      if (ev.graveyardUid !== undefined) return `Target in the Graveyard: ${nameOf(state, ev.graveyardUid)}.`;
      const names = ev.targets
        .map((t) => {
          const gone = later.find(
            (e) => e.type === 'destroy' && e.player === t.player && e.location === t.zone && e.zone === t.index,
          );
          return gone && gone.type === 'destroy' ? cardName(gone.cardId) : refName(state, t);
        })
        .filter((n): n is string => n !== null);
      return names.length ? `Target: ${names.join(', ')}.` : null;
    }
    case 'attackDeclare': {
      const a = nameOf(state, ev.attackerUid);
      if (ev.targetUid === null) return `${a} attacks directly!`;
      const flipsLater = later.some((e) => e.type === 'flip' && e.cause === 'attacked' && e.uid === ev.targetUid);
      if (flipsLater || isFaceDownMonster(state, ev.targetUid)) return `${a} attacks a face-down monster!`;
      return `${a} attacks ${nameOf(state, ev.targetUid)}!`;
    }
    case 'attackNegated':
      return `${nameOf(state, ev.attackerUid, 'gen')} attack is negated!`;
    case 'battle': {
      if (ev.targetUid === null) return null;
      const pos = ev.targetPosition === 'defense' ? 'DEF' : 'ATK';
      return `${nameOf(state, ev.attackerUid)} (ATK ${ev.attackerAtk}) clashes with ${nameOf(state, ev.targetUid)} (${pos} ${ev.targetValue})!`;
    }
    case 'damage':
      return `${playerName(ev.player)} takes ${ev.amount} damage! (LP ${ev.lpAfter})`;
    case 'lpGain':
      return `${playerName(ev.player)} gains ${ev.amount} LP. (LP ${ev.lpAfter})`;
    case 'destroy':
      return ev.reason === 'rule' ? `${cardName(ev.cardId)} is gone.` : `${cardName(ev.cardId)} is destroyed!`;
    case 'toGraveyard':
      return null;
    case 'equip':
      return `${nameOf(state, ev.targetUid)} is equipped with ${nameOf(state, ev.spellUid)}!`;
    case 'fieldSpell':
      return ev.active ? `The field transforms: ${cardName(ev.cardId)}!` : `${cardName(ev.cardId)} has ended.`;
    case 'statChange': {
      const n = nameOf(state, ev.uid);
      const parts: string[] = [];
      if (ev.atk !== ev.prevAtk) parts.push(`ATK ${ev.atk} (${signed(ev.atk - ev.prevAtk)})`);
      if (ev.def !== ev.prevDef) parts.push(`DEF ${ev.def} (${signed(ev.def - ev.prevDef)})`);
      return parts.length ? `${n}: ${parts.join(', ')}.` : null;
    }
    case 'discard':
      return `${playerName(ev.player)} discards ${cardName(ev.cardId)}.`;
    case 'toHand':
      return `${cardName(ev.cardId)} returns to its owner's hand.`;
    case 'toDeck':
      if (ev.from === 'spellTrap') return `${cardName(ev.cardId)} returns to the top of its owner's Deck.`;
      return `${cardName(ev.cardId)} is shuffled from ${playerName(ev.owner, 'gen')} Graveyard into the Deck.`;
    case 'controlChange': {
      const n = ev.cardId ? cardName(ev.cardId) : 'a face-down monster';
      return ev.reason === 'take'
        ? `${playerName(ev.to)} takes control of ${n}!`
        : `${ev.cardId ? cardName(ev.cardId) : 'The face-down monster'} returns to its owner.`;
    }
    case 'massDestroy': {
      const src = ev.sourceUid !== null ? state.cards[ev.sourceUid] : undefined;
      return src ? `${cardName(src.cardId)}: ${ev.refs.length} card${ev.refs.length === 1 ? '' : 's'} destroyed!` : null;
    }
    case 'coinToss':
      return `Coin toss: ${ev.result === 'heads' ? 'HEADS' : 'TAILS'}! ${playerName(ev.player)} called it ${ev.win ? 'right' : 'wrong'}.`;
    case 'diceRoll':
      return `Die roll: ${ev.value}!`;
    case 'banish':
      return `${cardName(ev.cardId)} is banished.`;
    case 'tokenVanish':
      return `${cardName(ev.cardId)} fades away.`;
    case 'decision':
      return null;
    case 'hatsShuffled':
      return `${playerName(ev.player)} hides their monster under the hats and shuffles!`;
    case 'hatChosen':
      return `${playerName(ev.player)} picks the hat in zone ${ev.zone + 1}.`;
    case 'decoyPopped':
      return 'A decoy hat pops: it was empty.';
    case 'hatRevealed':
      return null; // the following flip event names the card
    case 'hatRestore':
      return ev.restored ? 'The hats lift; the monster is back in place.' : null;
    case 'responseDeclined':
      return `${playerName(ev.player)} does not respond.`;
    case 'deckOut':
      return `${playerName(ev.player, 'gen')} Deck has run out!`;
    case 'gameOver':
      return `${playerName(ev.winner)} wins! (${WIN_REASON[ev.reason] ?? ev.reason})`;
  }
  return null;
}

/** English prompt for a pending decision (shown to `pending.player`). */
export function describePending(state: GameState, pd: PendingDecision): string {
  switch (pd.kind) {
    case 'trapResponse':
      if (pd.options.some((u) => state.cards[u] && CARDS[state.cards[u].cardId].kind === 'spell'))
        return `${playerName(pd.player)}: Activate a Trap or Quick-Play Spell?`;
      return `${playerName(pd.player)}: Activate a Trap card?`;
    case 'chooseTarget': {
      const card = state.cards[pd.sourceUid];
      const what = pd.candidates.every((c) => c.zone === 'monster') ? 'monster' : 'card';
      if (card && CARDS[card.cardId].kind === 'monster' && (CARDS[card.cardId] as { effect: string }).effect === 'summonFreezeAttack')
        return `${cardName(card.cardId, 'gen')} effect: choose a monster that cannot attack next turn.`;
      if (card && card.cardId === 'magic_hat') return `${cardName(card.cardId)}: choose the hat to attack.`;
      if (card && card.cardId === 'decoy_target') return `${cardName(card.cardId)}: choose your monster to take the attack.`;
      if (card && card.cardId === 'straw_decoys') return `${cardName(card.cardId)}: choose the decoy to take the attack.`;
      return card ? `${cardName(card.cardId, 'gen')} effect: choose a ${what} to destroy.` : `Choose a ${what} to destroy.`;
    }
    case 'discard':
      // fate_trade asks for its cost in the Main Phase; the hand limit asks in the End Phase
      if (pd.cost) return `${playerName(pd.player)}: Discard ${pd.count} card${pd.count === 1 ? '' : 's'} as the cost.`;
      return `${playerName(pd.player)}: Hand limit is 6. Discard ${pd.count} card${pd.count === 1 ? '' : 's'}.`;
    case 'coinCall':
      return `${playerName(pd.player)}: Heads or Tails?`;
    case 'chooseCount': {
      const card = state.cards[pd.sourceUid];
      const who = card ? `${cardName(card.cardId, 'gen')} effect: ` : '';
      return `${who}${who ? 'choose' : 'Choose'} how many monsters to banish (${pd.min}–${pd.max}).`;
    }
  }
}

/** Log lines for a batch of events (nulls dropped), with look-ahead context. */
export function describeEvents(state: GameState, events: readonly GameEvent[]): string[] {
  const out: string[] = [];
  for (const ev of events) {
    const line = describeEvent(state, ev, events);
    if (line) out.push(line);
  }
  return out;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
