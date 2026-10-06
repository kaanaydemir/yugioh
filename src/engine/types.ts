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
}

export interface SpellTrapSlot {
  uid: Uid;
  faceUp: boolean;
  /** Turn number on which the card was Set (traps cannot activate on that turn). -1 if activated from hand. */
  setTurn: number;
  /** For equip spells: the uid of the equipped monster. */
  equippedTo: Uid | null;
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
}

export type ZoneKind = 'monster' | 'spellTrap' | 'field';

export interface ZoneRef {
  player: PlayerId;
  zone: ZoneKind;
  index: number; // 0 for 'field'
}

export type TrapTrigger =
  | { kind: 'attackDeclared'; attackerUid: Uid; targetUid: Uid | null }
  | { kind: 'summoned'; monsterUid: Uid };

export type PendingDecision =
  /** `player` may activate one of `options` (set trap uids) or decline with respond(null). */
  | { kind: 'trapResponse'; player: PlayerId; trigger: TrapTrigger; options: Uid[] }
  /** A triggered effect needs a target (abyss_magus, thorn_lurker). */
  | { kind: 'chooseTarget'; player: PlayerId; sourceUid: Uid; candidates: ZoneRef[] }
  /** End-phase hand limit. */
  | { kind: 'discard'; player: PlayerId; count: number };

export type WinReason = 'lp' | 'deckout' | 'surrender';

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
  | { kind: 'graveyard'; uid: Uid; toZone: number };

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
  | { type: 'flip'; player: PlayerId; uid: Uid; cardId: CardId; zone: number; cause: 'flipSummon' | 'attacked' }
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
}
