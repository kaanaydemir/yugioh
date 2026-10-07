// Public API for cinematic authors. Put a file anywhere under src/cinematics/ (not in _core/ or
// _defaults/) and register at module top level — it is loaded automatically after the defaults:
//
//   // src/cinematics/crystal_wyrm.ts
//   import { registerCardHook, registerStrike, fx } from './api';
//
//   // replace only the attack motion (the battle handler keeps doing outcome / damage / shatter)
//   registerStrike('crystal_wyrm', async (s) => {
//     void s.attacker.play('attack');
//     await s.ctx.wait(s.attacker.impactMs);
//     s.impact();                                   // hit-stop, sparks, damage number, shatter...
//   });
//
//   // or own the whole summon (the card flight + set piece)
//   registerCardHook('crystal_wyrm', 'summon', async (ctx) => {
//     if (ctx.ev.method !== 'tribute') return ctx.base();       // defaults for other methods
//     const card = fx.takeHandCard(ctx, ctx.ev.player, ctx.ev.uid, ctx.ev.cardId);
//     await fx.slamToZone(ctx, card, { player: ctx.ev.player, spot: 'monster', index: ctx.ev.zone,
//       uid: ctx.ev.uid, cardId: ctx.ev.cardId, faceUp: true });
//     const unit = ctx.views.field.addUnit(ctx.ev.uid, { hidden: true, atk: ctx.atk(ctx.ev.uid, 'next') })!;
//     await fx.summonEntrance(ctx, unit, { big: true, cutIn: true });
//   });
//
// See _core/registry.ts for the chain / priority rules and _core/types.ts for the context.

export {
  registerEvent,
  registerCardHook,
  registerStrike,
  registerObserver,
  strikeFor,
  listHandlers,
  DEFAULT_PRIORITY,
  HOOK_KEYS,
  type CardHookEvents,
  type CardHookKind,
  type CinematicHandler,
  type EventOf,
  type RegisterOpts,
  type StrikeFn,
  type EventObserver,
} from './_core/registry';
export type { CinematicContext, StrikeArgs, When, FindOpts, FocusOpts } from './_core/types';
export * as fx from './_core/helpers';
