// V3HOOKS — the one-line hooks through which the A6 lanes replace today's small-event presentation
// in the v3 look (contract S-8; docs/v3/A6_PLAN.md §4.1 and the hook table of §5.1). Written in
// A56.0 and FROZEN (changes only through the orchestrator).
//
// Each hook site in today's code is ONE line, e.g. in flow/draw.ts:
//   const h = V3HOOKS.draw; if (h) return h(ctx);
// An empty hook runs today's code, so with every hook empty (v1 always, and v3 until a lane fills
// one) the game is pixel- and timing-identical to before. A lane assigns its own hooks, behind its
// own flag, at the top level of its src/cinematics/v3small/<file>.ts (the cinematics loader imports
// every file under src/cinematics/):
//   if (V3_A6_A) V3HOOKS.draw = drawV3;
// v1 never assigns anything and registers no handler.
//
// Rules for every v3 body (A6 §0, §4.4): no new camera call (no focus / closeUp / zoom / pan /
// follow / letterbox); where today's code calls the `unfocus` safety (draw :23, turn :38,
// discard :114, set :35, end :84 / :116 / :170) the v3 body calls the same thing at the same
// moment; the orchestrator's camera note keeps today's deckOut (end.ts:39) and gameOver
// (end.ts:140) leans too: a rewritten body calls today's lean at the matching beat. KO-1 … KO-12.
//
// Hook table (owner lane in brackets):
//   draw         flow/draw.ts          the whole flow:draw handler                        [A6-A]
//   discard      flow/discard.ts       after the grouping: the group's presentation       [A6-A]
//   riffle       flow/opening.ts       first line of riffle() (opening, skipIntro, flow:shuffle) [A6-A]
//   deal         flow/opening.ts       first line of deal() (the opening hands)            [A6-A]
//   duelPlate    flow/opening.ts       instead of duelStart(sc) ("DÜELLO!")                [A6-B]
//   hudIn        flow/opening.ts       instead of v.hud.setVisible(true) (3 sites)         [A6-B]
//   set          summon-b/set.ts       first line of setCard (setMonster / setSpellTrap)   [A6-A]
//   tributeBody  summon-a/tribute.ts   one tributed monster: body + tile + its card        [A6-A]
//   pileAccept   _v3/card.ts           the card landing on the graveyard pile (K9)         [A6-A]
//   turnStart    flow/turn.ts          the whole flow:turnStart handler                    [A6-B]
//   phaseChange  flow/turn.ts          the whole flow:phaseChange handler                  [A6-B]
//   deckOut      flow/end.ts           the whole flow:deckOut handler                      [A6-B]
//   gameOver     flow/end.ts           the whole flow:gameOver handler                     [A6-B]
//   decision     battle/declare.ts     tb:decision, the trapResponse branch only (S-4)     [A6-B]
//   target       _defaults/battle.ts   the default `target` handler                        [A6-B]
//   presentHeal  _core/helpers.ts      presentHeal (lpGain; Şifa Pınarı's delivery, S-14)  [A6-B]
//
// S-4 (trapPulse): every trap window keeps a handle under 'trapPulse' — ctx.keep('trapPulse',
// { destroy() {} }) even when nothing is marked (the CPU / scenario summon-window fast path, S-15)
// — because trapOpeningV3 (traps/_opening.ts) and tb:responseDeclined take it and destroy (or
// settle) it. A `decision` hook must keep one before it resolves.
// S-14: Şifa Pınarı delivers its lpGain with ctx.play(li, { delivered: true }); the default lpGain
// handler then calls presentHeal, i.e. this `presentHeal` hook in v3.

import type Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import type { GameEvent, GameEventType, PlayerId, Uid } from '../../engine/types';
import type { Ramp } from '../../art/palette';
import type { XY } from '../../view/layout';
import type { TileCard } from '../../view/TileCard';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { PileView } from '../../duel/PileView';
import type { CinematicContext } from '../_core/types';

type EvOf<T extends GameEventType> = Extract<GameEvent, { type: T }>;
type Ctx<T extends GameEventType> = CinematicContext<EvOf<T>>;
type AnyCtx = CinematicContext<GameEvent>;

/** What a `tributeBody` hook gets for ONE tributed monster (summon-a/tribute.ts). */
export interface TributeBodyArgs {
  /** This tribute's index in its group (the stagger: today 80 + i × 90 ms) and the group's size. */
  index: number;
  count: number;
  uid: Uid;
  cardId: CardId;
  owner: PlayerId;
  /** The tributed monster on screen (null: no body shown, e.g. a face-down tribute). */
  unit: MonsterUnit | null;
  /** Its card lying on the tile, released from the field (the hook disposes of it), or null. */
  tile: TileCard | null;
  /** The tile's floor point. */
  from: XY;
  /** Tones of the stream: the summoned monster's attribute ramp (face-up) or the owner's (set). */
  ramp: Ramp;
  /** Where the stream goes right now (the hovering card, or the destination tile). */
  target: () => XY;
  /** Report the stream's progress k (0..1) as its pixels arrive: grows the hovering card's glow. */
  onArrive: (k: number) => void;
}

/** What a `pileAccept` hook gets when a card lands on a graveyard pile (_v3/card.ts cardLeaves). */
export interface PileAcceptArgs {
  owner: PlayerId;
  cardId: CardId;
  pile: PileView;
  /** The pile's top point (whole pixels): where the card landed. */
  at: XY;
  /** The count the pile now shows (derived from the engine state, A6 §2.3; already set on the pile). */
  count: number;
  /** The flying card image (the pile's top iso texture), still on screen: the hook destroys it. */
  card: Phaser.GameObjects.Image;
}

/** The opening's HUD sites: the skipIntro branch, the "DÜELLO!" beat, the final safety (finally). */
export type HudInAt = 'skip' | 'duel' | 'finally';

export interface V3Hooks {
  /** flow:draw (deck → hand, K2). The body calls today's unfocus safety first (draw.ts:23). */
  draw?: (ctx: Ctx<'draw'>) => Promise<void>;
  /**
   * flow:discard after the grouping (K8): `group` is this discard and the same player's following
   * discards (their toGraveyard events already consumed). Calls the unfocus safety (discard.ts:114).
   */
  discard?: (ctx: Ctx<'discard'>, group: readonly EvOf<'discard'>[]) => Promise<void>;
  /** riffle() — the deck shuffle on `players`' piles (K10): opening, skipIntro and flow:shuffle. */
  riffle?: (ctx: AnyCtx, players: PlayerId[], rounds: number) => Promise<void>;
  /** deal() — the opening hands: the initial draws, `step` ms apart today (K2). */
  deal?: (ctx: AnyCtx, draws: EvOf<'draw'>[], step: number) => Promise<void>;
  /** The "DÜELLO!" moment of the opening (F0) instead of the full-width band; resolves when it is over. */
  duelPlate?: (ctx: Ctx<'gameStart'>) => Promise<void>;
  /**
   * The HUD comes on (F0, hudIn) instead of v.hud.setVisible(true), at the three sites of the opening.
   * Never locks the input; must be idempotent ('finally' runs after the others, and after a skip).
   */
  hudIn?: (ctx: Ctx<'gameStart'>, at: HudInAt) => void;
  /** setMonster / setSpellTrap (K4); the body calls today's `void views.camera.unfocus(120)` (set.ts:35). */
  set?: (ctx: CinematicContext<EvOf<'setMonster'> | EvOf<'setSpellTrap'>>, spot: 'monster' | 'spellTrap') => Promise<void>;
  /**
   * One tributed monster (K7): its body, its tile card and its card's flight to the graveyard (K9:
   * fx.cardToGraveyard / cardLeaves — start it in the background). Resolve when the body has
   * finished streaming; the caller then retires the unit and forgets the uid.
   */
  tributeBody?: (ctx: Ctx<'tribute'>, o: TributeBodyArgs) => Promise<void>;
  /** The landing on the graveyard pile (K9): sound, top-card swap, count roll, pad light, sparks. */
  pileAccept?: (ctx: AnyCtx, o: PileAcceptArgs) => void;
  /** flow:turnStart (F1); the body calls today's unfocus safety first (turn.ts:38). */
  turnStart?: (ctx: Ctx<'turnStart'>) => Promise<void>;
  /** flow:phaseChange (F2). */
  phaseChange?: (ctx: Ctx<'phaseChange'>) => Promise<void>;
  /** flow:deckOut (F8); keeps today's lean (end.ts:39) at the matching beat (orchestrator note). */
  deckOut?: (ctx: Ctx<'deckOut'>) => Promise<void>;
  /** flow:gameOver (F9); keeps today's lean (end.ts:140) and unfocus safeties at the matching beats. */
  gameOver?: (ctx: Ctx<'gameOver'>) => Promise<void>;
  /** tb:decision, trapResponse windows only (F7; S-4: keep a 'trapPulse' handle; S-15: fast path). */
  decision?: (ctx: Ctx<'decision'>) => Promise<void>;
  /** The default `target` handler (cards without their own hook; F4). */
  target?: (ctx: Ctx<'target'>) => Promise<void>;
  /** presentHeal (F3): the LP gain number + roll, ≤ 400 ms. Same arguments as presentHeal. */
  presentHeal?: (ctx: AnyCtx, ev: EvOf<'lpGain'>, o: { at?: XY }) => Promise<void>;
}

/** The hooks (S-8). Empty in A56.0; the lanes fill their own, behind their own flags. */
export const V3HOOKS: V3Hooks = {};

/** Names of the filled hooks (QA / tests: v1 must report none). */
export function filledV3Hooks(): (keyof V3Hooks)[] {
  return (Object.keys(V3HOOKS) as (keyof V3Hooks)[]).filter((k) => typeof V3HOOKS[k] === 'function');
}
