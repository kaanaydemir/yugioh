// v3 CARD CONTINUITY (docs/v3/A0_ENVANTER.md §6.2 item 2; plan §4 "Ölüm ... kartın doğru bölgeye
// gidişiyle süreklidir"): a card that goes to the graveyard is never a new sprite popping out of
// an empty tile, and never a rotated / fractionally scaled sprite. Used under ?look=v3 by
// fx.cardToGraveyard / fx.tileToGraveyard (_core/helpers.ts) and by the death kit (./death.ts).
//
//   const leave = cardLeaves(ctx, { owner, cardId, from: tile.home, tile });   // born + flight
//   await leave;                                                               // landed on the pile
//
// The flying card IS the graveyard's top card: the same iso texture the pile shows (cardIsoKey
// 'up' of the OWNER), at scale 1, on whole pixels. It is born on the spot the card lay — a tile
// card is swapped for it under a two-frame white silhouette (same shape, so a face-up
// 'up' card swaps seamlessly; a defense 'side' card or the opponent's orientation changes under the
// flash) — lifts off the tile with a dithered shadow left on the floor, arcs over the board with a
// short pixel trail in the owner's colour, and lands flat on the pile (count + top card update,
// bump, a few sparks). Pure presentation: the pile values are the ones the old flight set.

import type { CardId } from '../../data/cards';
import type { GameEvent, PlayerId } from '../../engine/types';
import { ISO_CX, ISO_CY, ISO_TEX_H, ISO_TEX_W, cardIsoKey } from '../../art/cards';
import { PAL, PLAYER_RAMP } from '../../art/palette';
import { sfx } from '../../audio/sfx';
import { DEPTH, type XY } from '../../view/layout';
import type { TileCard } from '../../view/TileCard';
import { Px, Sparks, animate, onFrame, sleep } from '../../vfx/combat';
import type { CinematicContext } from '../_core/types';

type AnyCtx = CinematicContext<GameEvent>;

export { flightMs } from './presets';
import { flightMs } from './presets';

export interface CardLeaveOpts {
  owner: PlayerId;
  cardId: CardId;
  /** Floor point the card lies on (a tile's home, or where it appears). */
  from: XY;
  /** The TileCard lying there (released from the field): swapped for the flying card at birth. */
  tile?: TileCard | null;
  /** Wait before the birth (scene ms). */
  delay?: number;
  /** Lift above the floor before the arc (px, default 6). */
  lift?: number;
  /** Flight time (default: by distance, flightMs). */
  ms?: number;
  /** The white birth flash (default true; false = it simply lifts off). */
  flash?: boolean;
}

/**
 * Card continuity (see the header). Resolves when the card has landed on the owner's graveyard
 * pile (the pile already shows it then).
 */
export async function cardLeaves(ctx: AnyCtx, o: CardLeaveOpts): Promise<void> {
  const sc = ctx.scene;
  if (o.delay) await sleep(sc, o.delay);
  if (!sc.sys.isActive()) {
    if (o.tile?.active) o.tile.destroy();
    return;
  }
  const pile = ctx.views.field.pile(o.owner, 'graveyard');
  const from = { x: Math.round(o.from.x), y: Math.round(o.from.y) };
  const key = cardIsoKey(o.cardId, 'up', o.owner);
  const img = sc.add.image(from.x, from.y, key).setOrigin(ISO_CX / ISO_TEX_W, ISO_CY / ISO_TEX_H).setDepth(DEPTH.CARD_ON_TILE + 8);
  // ---- birth: the tile card is replaced by the card that will travel
  if (o.tile && o.tile.active) o.tile.destroy();
  const ramp = PLAYER_RAMP[o.owner];
  if (o.flash !== false) {
    // two frames of white silhouette: the card's birth (and the swap from the tile card)
    img.setTintFill(PAL.white);
    await sleep(sc, 30);
    if (img.active) img.clearTint();
  }
  if (!img.active) return;
  // ---- the floor shadow it leaves behind, and the trail
  const shadow = sc.add.graphics().setDepth(DEPTH.CARD_ON_TILE + 7);
  const sh = new Px(shadow);
  const trail = new Sparks(sc, DEPTH.FX + 4);
  const to0 = pile.topXY();
  const to = { x: Math.round(to0.x), y: Math.round(to0.y) };
  const lift = o.lift ?? 6;
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const ms = o.ms ?? flightMs(dist);
  const arc = Math.round(Math.min(34, 14 + dist * 0.12));
  let floor = { ...from };
  let height = 0;
  const stopShadow = onFrame(sc, () => {
    sh.clear();
    if (!img.active) return false;
    // a dithered iso blot that shrinks with the height (never a soft alpha blob)
    const k = Math.max(0.35, 1 - height / 60);
    const rx = Math.round(14 * k);
    const ry = Math.max(2, Math.round(7 * k));
    for (let y = -ry; y <= ry; y++)
      for (let x = -rx; x <= rx; x++) {
        const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
        if (d > 1) continue;
        if (d > 0.45 && (x + y) % 2 !== 0) continue;
        sh.dot(Math.round(floor.x) + x, Math.round(floor.y) + y, PAL.ink, 0.55);
      }
    return true;
  });
  // ---- lift off the tile
  img.setDepth(DEPTH.FX + 5);
  await animate(sc, 50, (t) => {
    if (!img.active) return;
    height = Math.round(lift * (1 - (1 - t) * (1 - t)));
    img.setPosition(from.x, from.y - height);
  });
  // ---- arc to the pile
  let lastTrail = -99;
  await animate(sc, ms, (t, el) => {
    if (!img.active) return;
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    floor = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
    height = Math.round(lift * (1 - e) + arc * Math.sin(Math.PI * e));
    const x = Math.round(floor.x);
    const y = Math.round(floor.y - height);
    img.setPosition(x, y);
    if (el - lastTrail >= 30 && t < 0.9) {
      lastTrail = el;
      trail.add({ x: x + (from.x < to.x ? -8 : 8), y: y + 1, vy: 6, life: 180, colors: [ramp[4], ramp[3], ramp[2]], shape: 'px', fadeAt: 1 });
    }
  });
  stopShadow();
  shadow.destroy();
  trail.release();
  // ---- land on the pile
  try {
    sfx.play('cardPlace', { volume: 0.45, pitch: 0.9 });
  } catch {
    /* no audio */
  }
  pile.set(pile.count + 1, o.cardId);
  pile.bump();
  if (img.active) img.destroy();
  const sp = new Sparks(sc, DEPTH.FX + 4);
  for (let i = 0; i < 6; i++) {
    const a = Math.PI + (i / 5) * Math.PI;
    sp.add({ x: to.x, y: to.y, vx: Math.cos(a) * 46, vy: Math.sin(a) * 22, drag: 4, life: 200, colors: [PAL.white, ramp[4], ramp[3]], shape: 'px', fadeAt: 1 });
  }
  sp.release();
}

/** A released TileCard's own spot (its tile centre) — where its card is born. */
export function tileSpot(tile: TileCard | null | undefined, fallback: XY): XY {
  return tile && tile.active ? { x: tile.home.x, y: tile.home.y } : fallback;
}
