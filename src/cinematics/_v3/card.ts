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
// The birth flash is a 1-px rim, never a filled slab: the card face stays readable on the frame
// it is born, ringed white for two frames, then in the owner's tone for one (a solid white card
// read as a hole in the board).

import type { CardId } from '../../data/cards';
import type { GameEvent, PlayerId } from '../../engine/types';
import { ISO_CX, ISO_CY, ISO_TEX_H, ISO_TEX_W, cardIsoKey } from '../../art/cards';
import { PAL, PLAYER_RAMP } from '../../art/palette';
import { sfx } from '../../audio/sfx';
import { DEPTH, type XY } from '../../view/layout';
import type { TileCard } from '../../view/TileCard';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { monsterFrame } from '../../art/textures';
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
  /**
   * The flying card's depth on each frame of its arc, from its floor point (default DEPTH.FX + 5,
   * over everything): e.g. behind a body standing in front of the pile it flies to (A2 fix r1).
   */
  depthAt?: (floor: XY, at: XY) => number;
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
    // the card's birth (and the swap from the tile card): its face inside a 1-px rim — four
    // silhouette copies one whole pixel out, under the card — white, then the owner's tone
    const rim = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ].map(([dx, dy]) => sc.add.image(from.x + dx, from.y + dy, key).setOrigin(img.originX, img.originY).setDepth(img.depth - 0.01).setTintFill(PAL.white));
    await sleep(sc, 30);
    for (const r of rim) if (r.active) r.setTintFill(ramp[4]);
    await sleep(sc, 17);
    for (const r of rim) if (r.active) r.destroy();
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
    if (o.depthAt) img.setDepth(o.depthAt(floor, { x, y }));
    if (el - lastTrail >= 30 && t < 0.9 && img.depth >= DEPTH.FX) {
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

/**
 * depthAt for a card flight that must not cross IN FRONT of a body standing nearer the camera
 * (A2 motion review r2 #10: the dead magus's card flew across the attacking wyrm's head): while
 * the card's screen spot overlaps the opaque idle box of a live unit whose ground is in front of
 * the card's floor point, the card passes behind that body; elsewhere it flies over everything.
 */
export function behindBodies(ctx: AnyCtx, skip?: MonsterUnit | null): (floor: XY, at: XY) => number {
  return (floor, at) => {
    let d = DEPTH.FX + 5;
    for (const u of ctx.views.field.units()) {
      const s = u.sprite;
      if (u === skip || u.retired || !s.active || !s.visible) continue;
      if (u.home.y <= floor.y) continue; // behind the card's floor point: the card is in front of it
      const b = monsterFrame(u.cardId, 'idle', 0).bounds();
      if (!b) continue;
      const fx = u.flipX ? u.art.w - b.x - b.w : b.x;
      const left = s.x - s.displayOriginX + fx;
      const top = s.y - s.displayOriginY + b.y;
      // the card is ~12 px half-wide, ~8 px half-tall around its spot
      if (at.x + 12 < left || at.x - 12 > left + b.w || at.y + 8 < top || at.y - 8 > top + b.h) continue;
      d = Math.min(d, s.depth - 0.2);
    }
    return d;
  };
}

/** A released TileCard's own spot (its tile centre) — where its card is born. */
export function tileSpot(tile: TileCard | null | undefined, fallback: XY): XY {
  return tile && tile.active ? { x: tile.home.x, y: tile.home.y } : fallback;
}
