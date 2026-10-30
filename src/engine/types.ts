// Rules engine contract. The engine is pure TypeScript (no Phaser), deterministic
// given a seed, and never mutates its input state.
//
// Flow: the UI asks `legalActions(state)` for the acting player, sends one Action to
// `apply(state, action)`, receives `{ state, events }`, hands `events` to the
// presentation Director (which animates them in order), then re-syncs views to `state`.
//
// Additive changes to these types are allowed (new optional fields, new internal
// fields on GameState). Do not rename or remove anything: views, cinematics and
// tests are written against these names.

import type { CardId } from '../data/cards';

export type PlayerId = 0 | 1;
export type Uid = number;
export type Phase = 'draw' | 'main' | 'battle' | 'end';
export type Position = 'attack' | 'defense';

export const START_LP = 4000;
export const START_HAND = 4;
export const MONSTER_ZONES = 3;
export const SPELL_TRAP_ZONES = 3;
export const HAND_LIMIT = 6;

/** Per-game zone counts. A state without `zones` is the classic 3+3 board. */
export interface ZoneCounts {
  monsters: number;
  spellTraps: number;
}
export const DEFAULT_ZONES: ZoneCounts = { monsters: MONSTER_ZONES, spellTraps: SPELL_TRAP_ZONES };
export const ZONES_5: ZoneCounts = { monsters: 5, spellTraps: 5 };
/** Zone counts of a game (3+3 unless the game was created with `zones`). */
export function zoneCounts(s: { zones?: ZoneCounts }): ZoneCounts {
  return s.zones ?? DEFAULT_ZONES;
}

export function other(p: PlayerId): PlayerId {
  return (p === 0 ? 1 : 0) as PlayerId;
}

/** A physical card. `owner` never changes (a revived enemy monster still belongs to its owner's graveyard). */
export interface CardInstance {
  uid: Uid;
  cardId: CardId;
  owner: PlayerId;
}

export interface MonsterSlot {
  uid: Uid;
  position: Position;
  faceUp: boolean;
  /** Turn number on which this monster arrived in this zone. */
  enteredTurn: number;
  /** Attacks declared this turn. */
  attacksThisTurn: number;
  /** Turn number of the last manual position change / flip summon (-1 if never). */
  positionChangedTurn: number;
  /** summonFreezeAttack: this monster cannot attack while `state.turn` equals this value. Absent = never frozen. */
  noAttackTurn?: number;
  /** summonTurnAtk500: set when the monster arrived by Normal / Tribute Summon (absent otherwise). */
  normalSummoned?: boolean;
  /** Spell/trap batch 1: one-turn ATK / DEF bonus (battle_cry, hidden_reinforcement); active while `state.turn === boostTurn` and before the End Phase. */
  boostAtk?: number;
  boostDef?: number;
  boostTurn?: number;
  /** kneel_down: this monster cannot change position while `state.turn` equals this value. */
  lockPositionTurn?: number;
  /**
   * magic_hat: this slot is a hat for the rest of the turn. 'decoy' = a "Şapka Tuzağı" token (its uid has a
   * CardInstance with cardId 'magic_hat' and owner = the hat's controller; it never reaches a graveyard);
   * 'real' = the hidden attacked monster (face-down defense while hatted). Absent = a normal monster.
   */
  hat?: 'decoy' | 'real';
  /** magic_hat (hat === 'real'): face / position the monster had before it was hidden; restored when the hats end. */
  hatOrigin?: { faceUp: boolean; position: Position };
}

export interface SpellTrapSlot {
  uid: Uid;
  faceUp: boolean;
  /** Turn number on which the card was Set (traps cannot activate on that turn). -1 if activated from hand. */
  setTurn: number;
  /** For equip spells: the uid of the equipped monster. */
  equippedTo: Uid | null;
  /** Continuous spells (dawn_swords): turns left; absent for every other card. Decremented at the end of each opponent turn. */
  counter?: number;
}

export interface PlayerState {
  id: PlayerId;
  lp: number;
  /** deck[0] is the top card. */
  deck: Uid[];
  hand: Uid[];
  /** Last element is the most recent card. */
  graveyard: Uid[];
  monsters: (MonsterSlot | null)[]; // length MONSTER_ZONES
  spellTraps: (SpellTrapSlot | null)[]; // length SPELL_TRAP_ZONES
  fieldSpell: SpellTrapSlot | null;
  normalSummonUsed: boolean;
  /** double_offering: on this turn number a Level 7+ monster needs one tribute fewer. Absent = never. */
  tributeHelperTurn?: number;
  /** festival_square: the turn number on which the extra Normal Summon / Set was used. Absent = never. */
  extraSummonTurn?: number;
}

export type ZoneKind = 'monster' | 'spellTrap' | 'field';

export interface ZoneRef {
  player: PlayerId;
  zone: ZoneKind;
  index: number; // 0 for 'field'
}

export type TrapTrigger =
  | { kind: 'attackDeclared'; attackerUid: Uid; targetUid: Uid | null }
  /** `method` is set only for Special Summons ('special'); absent = Normal / Tribute Summon (kept byte-identical for old states). */
  | { kind: 'summoned'; monsterUid: Uid; method?: 'special' }
  /** spell_seal window: `spellUid` was just activated by `player` (the turn player) and has not resolved yet. */
  | { kind: 'spellActivated'; spellUid: Uid; player: PlayerId }
  /** last_breath window: `player` (not the turn player) dropped below 1500 LP from damage. */
  | { kind: 'lpLow'; player: PlayerId };

export type PendingDecision =
  /** `player` may activate one of `options` (set trap uids) or decline with respond(null). */
  | { kind: 'trapResponse'; player: PlayerId; trigger: TrapTrigger; options: Uid[] }
  /** A triggered effect needs a target (abyss_magus, thorn_lurker). */
  | { kind: 'chooseTarget'; player: PlayerId; sourceUid: Uid; candidates: ZoneRef[] }
  /** End-phase hand limit. */
  /** `cost`: a Main Phase discard paid for a card effect (fate_trade) instead of the End Phase hand limit. */
  | { kind: 'discard'; player: PlayerId; count: number; cost?: boolean };

export type WinReason = 'lp' | 'deckout' | 'surrender' | 'seals';

export interface GameState {
  cards: Record<Uid, CardInstance>;
  players: [PlayerState, PlayerState];
  /** Global turn counter, starts at 1. */
  turn: number;
  activePlayer: PlayerId;
  firstPlayer: PlayerId;
  phase: Phase;
  pending: PendingDecision | null;
  winner: PlayerId | null;
  winReason: WinReason | null;
  /** RNG state (mulberry32). */
  rng: number;
  /** Zone counts; absent = 3+3 (keeps classic states byte-identical). */
  zones?: ZoneCounts;
  /** Engine-private continuation data (e.g. an attack waiting on a trap response). */
  internal: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type SpellTarget =
  /** A monster on the field (judgment_bolt: opponent's; dragon_blade: own face-up). */
  | { kind: 'monster'; ref: ZoneRef }
  /** soul_recall: a monster card in either graveyard plus your empty monster zone to summon into. */
  | { kind: 'graveyard'; uid: Uid; toZone: number }
  /** purging_wave: a Spell/Trap (or field spell) of the opponent; `ref.zone` is 'spellTrap' or 'field'. */
  | { kind: 'card'; ref: ZoneRef };

export type Action =
  /** Normal or Tribute Summon from hand in face-up attack position. */
  | { type: 'normalSummon'; player: PlayerId; uid: Uid; zone: number; tributes: Uid[] }
  /** Set a monster face-down in defense position (counts as the normal summon for the turn). */
  | { type: 'setMonster'; player: PlayerId; uid: Uid; zone: number; tributes: Uid[] }
  | { type: 'flipSummon'; player: PlayerId; zone: number }
  | { type: 'changePosition'; player: PlayerId; zone: number }
  | { type: 'setSpellTrap'; player: PlayerId; uid: Uid; zone: number }
  /**
   * Activate a spell from hand (normal: resolves then goes to graveyard; equip: needs `zone`
   * = free spell/trap zone; field: goes to the field zone) or a set spell from the field.
   */
  | { type: 'activateSpell'; player: PlayerId; uid: Uid; zone?: number; target?: SpellTarget }
  | { type: 'enterBattle'; player: PlayerId }
  /** targetZone null = direct attack. */
  | { type: 'attack'; player: PlayerId; attackerZone: number; targetZone: number | null }
  /** Ends the turn from main or battle phase. */
  | { type: 'endTurn'; player: PlayerId }
  /** Answer to a trapResponse decision: a trap uid to activate, or null to decline. */
  | { type: 'respond'; player: PlayerId; uid: Uid | null }
  | { type: 'chooseTarget'; player: PlayerId; target: ZoneRef }
  | { type: 'discard'; player: PlayerId; uids: Uid[] }
  | { type: 'surrender'; player: PlayerId };

// ---------------------------------------------------------------------------
// Events — everything the presentation layer animates. Emitted in causal order.
// ---------------------------------------------------------------------------

export type DestroyReason = 'battle' | 'effect' | 'rule';
export type GraveyardFrom = 'monster' | 'spellTrap' | 'field' | 'hand' | 'resolved';
export type BattleResult = 'direct' | 'targetDestroyed' | 'attackerDestroyed' | 'bothDestroyed' | 'noDestroy';

export type GameEvent =
  | { type: 'gameStart'; firstPlayer: PlayerId; seed: number }
  | { type: 'shuffle'; player: PlayerId }
  /** `initial` is true for the opening hand. */
  | { type: 'draw'; player: PlayerId; uid: Uid; cardId: CardId; initial: boolean }
  | { type: 'turnStart'; player: PlayerId; turn: number }
  | { type: 'phaseChange'; player: PlayerId; phase: Phase }
  /** A monster is tributed for `forUid` (followed by toGraveyard). */
  | { type: 'tribute'; player: PlayerId; uid: Uid; cardId: CardId; zone: number; forUid: Uid }
  /** Face-up arrival of a monster on the field. */
  | {
      type: 'summon';
      player: PlayerId;
      uid: Uid;
      cardId: CardId;
      zone: number;
      method: 'normal' | 'tribute' | 'special' | 'flip';
      position: Position;
      from: 'hand' | 'graveyard' | 'field';
      /** For special summons: the card that caused it (soul_recall). */
      sourceUid: Uid | null;
    }
  /** Face-down monster placed (defense). cardId intentionally omitted (hidden). */
  | { type: 'setMonster'; player: PlayerId; uid: Uid; zone: number }
  | { type: 'setSpellTrap'; player: PlayerId; uid: Uid; zone: number }
  | { type: 'positionChange'; player: PlayerId; uid: Uid; zone: number; position: Position }
  /** A face-down monster is turned face-up (flip summon, or attacked while set). */
  | {
      type: 'flip';
      player: PlayerId;
      uid: Uid;
      cardId: CardId;
      zone: number;
      /** 'reveal' (dawn_swords): turned face-up by an effect, no flip effect triggers; `sourceUid` is the spell. */
      cause: 'flipSummon' | 'attacked' | 'reveal';
      sourceUid?: Uid;
    }
  /**
   * A card or effect activates. For spells/traps `from` says where the card is shown.
   * For monster effects (`kind: 'monsterEffect'`) `zone` is the monster zone (or null if it left the field).
   */
  | {
      type: 'activate';
      player: PlayerId;
      uid: Uid;
      cardId: CardId;
      kind: 'spell' | 'trap' | 'monsterEffect';
      from: 'hand' | 'spellTrap' | 'field' | 'monster' | 'graveyard';
      zone: number | null;
    }
  /** Targets locked by an activation (for lock-on animation). */
  | { type: 'target'; player: PlayerId; sourceUid: Uid; targets: ZoneRef[]; graveyardUid?: Uid }
  | {
      type: 'attackDeclare';
      player: PlayerId;
      attackerUid: Uid;
      attackerZone: number;
      targetUid: Uid | null;
      targetZone: number | null;
    }
  | { type: 'attackNegated'; player: PlayerId; attackerUid: Uid; byUid: Uid }
  /** Damage calculation. Followed by damage / destroy / toGraveyard events as needed. */
  | {
      type: 'battle';
      player: PlayerId;
      attackerUid: Uid;
      attackerZone: number;
      targetUid: Uid | null;
      targetZone: number | null;
      attackerAtk: number;
      targetPosition: Position | null;
      /** Target ATK (attack position) or DEF (defense position); null for direct attacks. */
      targetValue: number | null;
      result: BattleResult;
    }
  /** LP loss. `player` is the one losing LP. */
  | {
      type: 'damage';
      player: PlayerId;
      amount: number;
      source: 'battle' | 'effect';
      sourceUid: Uid | null;
      lpAfter: number;
    }
  | { type: 'lpGain'; player: PlayerId; amount: number; sourceUid: Uid | null; lpAfter: number }
  /** A card on the field is destroyed. `player` is its controller. Followed by toGraveyard. */
  | {
      type: 'destroy';
      player: PlayerId;
      uid: Uid;
      cardId: CardId;
      location: ZoneKind;
      zone: number;
      reason: DestroyReason;
      sourceUid: Uid | null;
    }
  /** Every arrival in a graveyard. `owner` is the graveyard's owner. */
  | { type: 'toGraveyard'; owner: PlayerId; uid: Uid; cardId: CardId; from: GraveyardFrom; zone: number | null }
  | { type: 'equip'; player: PlayerId; spellUid: Uid; spellZone: number; targetUid: Uid }
  /** Field spell placed (active) or removed (inactive). */
  | { type: 'fieldSpell'; player: PlayerId; uid: Uid; cardId: CardId; active: boolean }
  /** Current ATK/DEF of a face-up monster changed (equip, field spell). */
  | { type: 'statChange'; uid: Uid; atk: number; def: number; prevAtk: number; prevDef: number }
  | { type: 'discard'; player: PlayerId; uid: Uid; cardId: CardId }
  /** A card returns to its owner's hand from the field (homecoming) — `from` is where it was. */
  | { type: 'toHand'; player: PlayerId; uid: Uid; cardId: CardId; from: 'monster' | 'graveyard'; zone: number | null }
  /** A card returns to the deck from the graveyard (cycle_of_graves); a `shuffle` event follows the last one. */
  | { type: 'toDeck'; owner: PlayerId; uid: Uid; cardId: CardId; from: 'graveyard' }
  /** A continuous spell's counter changed (dawn_swords). `value` is the new count (0 = it is destroyed right after, reason 'rule'). */
  | { type: 'counter'; player: PlayerId; uid: Uid; cardId: CardId; zone: number; value: number; prev: number }
  /**
   * magic_hat: the attacked monster and its decoys were hidden under hats (follows `activate`).
   * `player` = hats' controller. `sourceZone` = zone the attacked monster stood in. `hats` lists EVERY hat
   * (decoys and the real one alike, sorted by `zone`; `uid` is the sprite key) with its destination zone; the
   * payload does not say which is real (the real one is the uid of the preceding `attackDeclare.targetUid`,
   * a presentation that must keep the secret should not use that).
   */
  | { type: 'hatsShuffled'; player: PlayerId; sourceUid: Uid; sourceZone: number; hats: { uid: Uid; zone: number }[] }
  /** magic_hat: the attacker's controller picked the hat in `zone` (the attack now aims at it). */
  | { type: 'hatChosen'; player: PlayerId; hatOwner: PlayerId; uid: Uid; zone: number }
  /** magic_hat: a decoy token vanished (attacked / destroyed by an effect). Not a graveyard arrival. */
  | { type: 'decoyPopped'; player: PlayerId; uid: Uid; zone: number; cause: 'attacked' | 'destroyed' }
  /** magic_hat: the attacked hat held the real monster; followed by the normal `flip` (cause 'attacked', no flip effect) and `battle`. */
  | { type: 'hatRevealed'; player: PlayerId; uid: Uid; cardId: CardId; zone: number }
  /**
   * magic_hat: remaining decoys were removed (`removed`) and, at the end of the turn, a still-hidden real
   * monster flips back face-up in its zone (`restored`, no flip effect). reason 'revealed': the real monster
   * was hit (`restored` null); 'turnEnd': End Phase cleanup (emitted only if something was left).
   */
  | {
      type: 'hatRestore';
      player: PlayerId;
      reason: 'revealed' | 'turnEnd';
      removed: { uid: Uid; zone: number }[];
      /** `cardId` is null (and `faceUp` false) when the monster was face-down before the hats: it stays hidden. */
      restored: { uid: Uid; cardId: CardId | null; zone: number; position: Position; faceUp: boolean } | null;
    }
  /** A pending decision opened (UI cue). */
  | { type: 'decision'; pending: PendingDecision }
  | { type: 'responseDeclined'; player: PlayerId }
  | { type: 'deckOut'; player: PlayerId }
  | { type: 'gameOver'; winner: PlayerId; reason: WinReason };

export type GameEventType = GameEvent['type'];

export interface ApplyResult {
  state: GameState;
  events: GameEvent[];
}

export class EngineError extends Error {}

export interface NewGameOptions {
  seed: number;
  /** Defaults to a seeded coin flip. */
  firstPlayer?: PlayerId;
  /** Defaults to DEFAULT_DECK for both players. Order is shuffled with the seed. */
  decks?: [CardId[], CardId[]];
  /** Testing: skip shuffling so deck order is exactly as given (decks[i][0] is drawn first). */
  noShuffle?: boolean;
  /** 3 (default) or 5 monster + spell/trap zones per player. */
  zones?: 3 | 5;
  /**
   * Deck pool used when `decks` is not given: 'default' = DEFAULT_DECK for both; 'expanded' = a seeded
   * 20-card deck per side from every card (src/data/decks.ts). Omitted: detected from ?deck= / __NEON_DECK.
   */
  pool?: 'default' | 'expanded';
}
