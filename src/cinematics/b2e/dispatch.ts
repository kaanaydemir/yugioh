// Lane E (claude/kart-e): the signature versions of the batch-2 mechanic events — controlChange (Kukla İpi,
// Ruh Tasması), massDestroy (Boşluk Gözü, Süpürge Rüzgarı), diceRoll (Talih Zarı) and toDeck from a spell /
// trap zone (Hınç Baltası). They replace the placeholders of ../b2/placeholders.ts for these cards only.
//
// One handler per event type is registered here (above the placeholders: priority 1). Each card's own module
// (src/cinematics/spells/<id>.ts) claims the events that are its own with registerLaneE(type, claims, play);
// an event no lane-E card claims falls through to the next handler in the chain (ctx.base(): the placeholder,
// or another lane's version — e.g. Kadran Soytarısı's massDestroy belongs to lane D).

import type { GameEvent } from '../../engine/types';
import { registerEvent, type CinematicContext } from '../api';

type LaneEType = 'controlChange' | 'massDestroy' | 'diceRoll' | 'toDeck';
export type LaneECtx<T extends LaneEType> = CinematicContext<Extract<GameEvent, { type: T }>>;

interface Entry<T extends LaneEType> {
  claims(ctx: LaneECtx<T>): boolean;
  play(ctx: LaneECtx<T>): Promise<void>;
}

const TABLE: { [T in LaneEType]: Entry<T>[] } = { controlChange: [], massDestroy: [], diceRoll: [], toDeck: [] };

/** A card module claims the `type` events that `claims` accepts and presents them with `play`. */
export function registerLaneE<T extends LaneEType>(type: T, claims: (ctx: LaneECtx<T>) => boolean, play: (ctx: LaneECtx<T>) => Promise<void>): void {
  (TABLE[type] as Entry<T>[]).push({ claims, play });
}

function install<T extends LaneEType>(type: T): void {
  registerEvent(
    type,
    async (ctx: LaneECtx<T>) => {
      for (const e of TABLE[type] as Entry<T>[]) {
        let mine = false;
        try {
          mine = e.claims(ctx);
        } catch {
          mine = false;
        }
        if (mine) return e.play(ctx);
      }
      return ctx.base();
    },
    { name: `e:${type}`, priority: 1 },
  );
}

install('controlChange');
install('massDestroy');
install('diceRoll');
install('toDeck');
