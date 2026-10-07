// Shared choreography building blocks for cinematics (defaults and signature handlers).
// Import as `fx` from '../api' (or './api' from a top-level cinematics file).
//
// Card movement
//   takeHandCard(ctx, player, uid, cardId)      → CardSprite at the hand / mini-hand (owned by you)
//   slamToZone(ctx, sprite, …)                  → TileCard slammed onto a zone (field-registered)
//   cardToGraveyard(ctx, …)                     → small card arcs into the graveyard pile
//   tileToGraveyard(ctx, uid, …)                → the zone's TileCard (released) flies to the pile
// Monsters
//   summonEntrance(ctx, unit, { big })          → attribute summon set piece + roar + badge pop
//   shatterUnit(ctx, unit, { push })            → hit flash + shatter into its pixels (retires the unit)
//   hitReact(ctx, unit, power, ramp?)           → impact sparks + white silhouette + 'hit'
//   hexShield(scene, x, y, color?)              → hexagonal guard flash (defense position)
// Spells / traps
//   spellShowcase(ctx, …) → Showcase            → card rises to the centre at 2× with an aura
//   energyBolt(scene, from, to, ramp)           → glowing orb arcs to a point (spell delivery)
//   trapReveal(ctx, tile)                       → trap stands up + magenta burst + "TUZAK!"
// LP
//   presentDamage(ctx, ev, { at })             → damage number + LP roll + duelist hurt
//   presentHeal(ctx, ev, { at })
// Misc: unitPoint, zoneCenter, attrRamp, dim(ctx, alpha, ms), ace(cardId), sleepAll.

import Phaser from 'phaser';
import { CARDS, isMonster, type Attribute, type CardId, type MonsterId } from '../../data/cards';
import type { GameEvent, PlayerId, Uid } from '../../engine/types';
import { ATTRIBUTE_RAMP, PAL, PLAYER_COLOR, PLAYER_RAMP, RAMPS, type Ramp } from '../../art/palette';
import { mix } from '../../art/pixel';
import { AK } from '../../art/arena';
import type { CardOrientation } from '../../art/cards';
import { sfx } from '../../audio/sfx';
import { CardSprite } from '../../view/CardSprite';
import type { TileCard } from '../../view/TileCard';
import { DEPTH, GAME_H, GAME_W, type BoardSpot, type XY, panelRect, zoneXY } from '../../view/layout';
import { MINI_CARD_W } from '../../view/ui-textures';
import { TEX, flash, safe, shake, tween, wait } from '../../vfx/core';
import { impact as combatImpact, whiteFlash } from '../../vfx/combat';
import { shatter } from '../../vfx/shatter';
import { attributeSummon, sparkleBurst } from '../../vfx/summon';
import { damageNumber } from '../../vfx/numbers';
import { Raster, Sparks, onFrame, rnd, trapSpring } from '../../vfx/setpieces';
import { trapBanner } from '../../vfx/banners';
import { cutIn } from '../../vfx/cutin';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { CinematicContext } from './types';

type AnyCtx = CinematicContext<GameEvent>;

const TAU = Math.PI * 2;
const ADD = Phaser.BlendModes.ADD;

// ================================================================ small utils

export function attrOf(cardId: CardId): Attribute {
  const d = CARDS[cardId];
  return isMonster(d) ? d.attribute : 'LIGHT';
}

export function attrRamp(cardId: CardId): Ramp {
  const d = CARDS[cardId];
  if (isMonster(d)) return ATTRIBUTE_RAMP[d.attribute];
  return d.kind === 'spell' ? RAMPS.teal : RAMPS.mag;
}

export function isAce(cardId: CardId): boolean {
  const d = CARDS[cardId];
  return isMonster(d) && d.ace;
}

export function zoneCenter(player: PlayerId, spot: BoardSpot, index = 0): XY {
  return zoneXY(player, spot, index);
}

/** Centre of a player's LP number (falls back to the panel centre). */
export function lpPoint(ctx: AnyCtx, player: PlayerId): XY {
  try {
    return ctx.views.hud.lpXY(player);
  } catch {
    const r = panelRect(player);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }
}

/** Where a direct attack / burn on `player` lands in the world: their duelist (or podium). */
export function duelistPoint(ctx: AnyCtx, player: PlayerId): XY {
  const d = ctx.views.duelists?.get(player);
  if (d) return d.chest();
  const p = zoneXY(player, 'spellTrap', 1);
  return { x: p.x + (player === 0 ? -26 : 26), y: p.y + (player === 0 ? 14 : -14) - 18 };
}

/** Wait for all, never reject. */
export async function all(ps: Promise<unknown>[]): Promise<void> {
  await Promise.all(ps.map((p) => safe(p)));
}

/** Dark veil over the world (focus on the showcase); returns a remover. */
export function dim(ctx: AnyCtx, alpha = 0.35, ms = 180, depth: number = DEPTH.FX_TOP - 2): { remove(ms?: number): Promise<void> } {
  const r = ctx.scene.add.rectangle(-60, -60, GAME_W + 120, GAME_H + 120, PAL.ink, 1).setOrigin(0).setDepth(depth).setScrollFactor(0).setAlpha(0);
  void tween(ctx.scene, { targets: r, alpha, duration: ms });
  return {
    async remove(out = 220) {
      if (!r.active) return;
      await tween(ctx.scene, { targets: r, alpha: 0, duration: out });
      r.destroy();
    },
  };
}

// ================================================================ cards

/**
 * Take a card out of a hand for a cinematic. The viewer's hand gives its real CardSprite; the
 * other player's card is spawned face-down at their mini-hand (one mini card disappears).
 * The returned sprite is yours: destroy it when done.
 */
export function takeHandCard(ctx: AnyCtx, player: PlayerId, uid: Uid, cardId: CardId | null): CardSprite {
  const hand = ctx.views.hand;
  if (hand.owner === player) {
    const s = hand.takeCard(uid);
    if (s) {
      s.setDepth(DEPTH.HAND + 30);
      return s;
    }
  }
  const at = hand.miniXY(player, 0);
  const remaining = ctx.state.players[player].hand.filter((u) => u !== uid).map((u) => ({ uid: u, cardId: ctx.state.cards[u].cardId }));
  if (hand.owner !== player) hand.setCards(remaining, player);
  const s = new CardSprite(ctx.scene, at.x, at.y, cardId, { faceUp: false, player }).setDepth(DEPTH.HAND + 30).setScale(MINI_CARD_W / 48);
  return s;
}

/**
 * Turn a CardSprite into a TileCard on a zone with the slam-in (impact ≈ 74% of ms). The sprite
 * is destroyed; the TileCard is registered in the FieldView.
 */
export async function slamToZone(
  ctx: AnyCtx,
  sprite: CardSprite | null,
  o: { player: PlayerId; spot: 'monster' | 'spellTrap' | 'field'; index: number; uid: Uid; cardId: CardId; faceUp: boolean; orientation?: CardOrientation; ms?: number; shake?: number; impact?: boolean },
): Promise<TileCard> {
  const from = sprite ? { x: sprite.x, y: sprite.y } : { x: zoneXY(o.player, o.spot, o.index).x, y: zoneXY(o.player, o.spot, o.index).y - 40 };
  const scale = sprite ? sprite.scaleX : 0.4;
  sprite?.destroy();
  const tile = ctx.views.field.placeCard(o.player, o.spot, o.index, o.uid, o.cardId, o.faceUp, o.orientation ?? 'up');
  await tile.slamIn(from, o.ms ?? 340, { fromScale: scale, shake: o.shake ?? 0, impact: o.impact ?? true });
  return tile;
}

/** A small card arcs from `from` into `owner`'s graveyard pile (count + top card update on landing). */
export async function cardToGraveyard(ctx: AnyCtx, o: { owner: PlayerId; cardId: CardId; from: XY; delay?: number; scale?: number; ms?: number }): Promise<void> {
  const sc = ctx.scene;
  if (o.delay) await wait(sc, o.delay);
  const pile = ctx.views.field.pile(o.owner, 'graveyard');
  const c = new CardSprite(sc, o.from.x, o.from.y, o.cardId, { faceUp: true, player: o.owner }).setDepth(DEPTH.FX + 5).setScale(o.scale ?? 0.42);
  c.setTrail(true);
  const to = pile.topXY();
  await c.flyTo(to.x, to.y - 6, { ms: o.ms ?? 380, arc: 34, scale: 0.26, land: false, anticipate: false, rotation: o.owner === 0 ? 0.2 : -0.2 });
  c.setTrail(false);
  sfx.play('cardPlace', { volume: 0.4, pitch: 0.9 });
  pile.set(pile.count + 1, o.cardId);
  pile.bump();
  c.burst(PLAYER_COLOR[o.owner], 8);
  await tween(sc, { targets: c, alpha: 0, scale: 0.18, duration: 120 });
  c.destroy();
}

/** The TileCard of `uid` (released from the field) lifts, shrinks and flies to the graveyard. */
export async function tileToGraveyard(ctx: AnyCtx, uid: Uid, owner: PlayerId, cardId: CardId): Promise<void> {
  const field = ctx.views.field;
  const { tile } = field.release(uid);
  const from = tile ? { x: tile.home.x, y: tile.home.y - 4 } : zoneXY(owner, 'graveyard');
  if (tile && tile.active) {
    void tile.fadeOut(160).then(() => tile.destroy());
  }
  await cardToGraveyard(ctx, { owner, cardId, from });
}

// ================================================================ monsters

/** Impact on a unit: sparks, hit-stop, shake (by power), white silhouette, 'hit' recoil. */
export function hitReact(ctx: AnyCtx, unit: MonsterUnit | null, power: 1 | 2 | 3, ramp?: Ramp, at?: XY, dir?: XY): Promise<void> {
  const p = at ?? (unit ? unit.core() : { x: GAME_W / 2, y: GAME_H / 2 });
  if (unit && unit.sprite.active && unit.sprite.visible) void unit.play('hit');
  return combatImpact(ctx.scene, p.x, p.y, { power, ramp, sprite: unit?.sprite.visible ? unit.sprite : undefined, dir });
}

/**
 * Destroy a monster on screen: white flash, 'hit', then the sprite shatters into its own
 * pixels. The unit is retired at the end (call field.release first if you also own the tile).
 */
export async function shatterUnit(ctx: AnyCtx, unit: MonsterUnit, o: { push?: XY; hit?: boolean; glitchMs?: number } = {}): Promise<void> {
  if (!unit.sprite.active) return;
  unit.badge.setVisible(false);
  if (o.hit !== false) {
    void unit.play('hit', { hold: true });
    await whiteFlash(ctx.scene, unit.sprite, 2);
    await wait(ctx.scene, 70);
  }
  if (!unit.sprite.visible) {
    unit.retire();
    return;
  }
  await shatter(ctx.scene, unit.sprite, { monsterId: unit.cardId, attribute: unit.attribute, push: o.push, glitchMs: o.glitchMs });
  unit.retire();
}

/** Hexagonal guard flash in front of a unit (attack → defense, blocked hits). */
export function hexShield(scene: Phaser.Scene, x: number, y: number, color: number = PAL.water3, ms = 420): Promise<void> {
  const r = Raster.around(scene, x, y, 64, 72, DEPTH.FX + 2, ADD);
  const R = 18;
  return new Promise<void>((resolve) => {
    onFrame(scene, (_dt, el) => {
      const t = Math.min(1, el / ms);
      r.draw((g) => {
        const grow = t < 0.25 ? 0.6 + (t / 0.25) * 0.5 : 1.1 - (t - 0.25) * 0.13;
        const lv = t < 0.2 ? 1 : 1 - (t - 0.2) / 0.8;
        const pts: XY[] = [];
        for (let i = 0; i <= 6; i++) {
          const a = (i / 6) * TAU + Math.PI / 6;
          pts.push({ x: x + Math.cos(a) * R * grow * 0.8, y: y + Math.sin(a) * R * grow });
        }
        g.path(pts, t < 0.12 ? PAL.white : color, lv);
        const inner = pts.map((p) => ({ x: x + (p.x - x) * 0.6, y: y + (p.y - y) * 0.6 }));
        g.path(inner, mix(color, PAL.white, 0.3), lv * 0.6);
        if (t < 0.3) for (let i = 0; i < 6; i++) g.line(inner[i].x, inner[i].y, pts[i].x, pts[i].y, color, lv * 0.5);
      });
      if (t >= 1) {
        r.destroy();
        resolve();
        return false;
      }
      return true;
    });
  });
}

/** Summon set piece for a placed (hidden) unit: circle → pillar → hologram → roar → impact (badge pops). */
export async function summonEntrance(ctx: AnyCtx, unit: MonsterUnit, o: { big?: boolean; cutIn?: boolean; onBeat?: (b: string) => void } = {}): Promise<void> {
  const sc = ctx.scene;
  const home = unit.home;
  unit.badge.setVisible(false);
  unit.sprite.setPosition(home.x, home.y - unit.hover);
  let cut: Promise<void> = Promise.resolve();
  if (o.cutIn) {
    unit.hide();
    // the set piece starts under the cut-in's white flash-out (≈1.2 s in), keeping ace summons ≲ 4 s
    cut = cutIn(sc, { monsterId: unit.cardId, name: unit.card.name, attribute: unit.attribute, player: unit.player }).catch((e) => {
      console.warn('[cinematics] cut-in failed', e);
    });
    await Promise.race([cut, wait(sc, 1150)]);
  }
  const duelist = ctx.views.duelists?.get(unit.player);
  void duelist?.play('command');
  const big = !!o.big;
  await attributeSummon(sc, {
    x: home.x,
    y: home.y,
    attribute: unit.attribute,
    player: unit.player,
    sprite: unit.sprite,
    monsterId: unit.cardId,
    big,
    onBeat: (b) => {
      o.onBeat?.(b);
      if (b === 'circle' && big) void ctx.focus({ x: home.x, y: home.y - 30 }, { zoom: 1.05, ms: 420, pan: 0.3 });
      if (b === 'end' && big) void ctx.unfocus(360);
      if (b === 'pillar') sfx.play('summonBurst', { volume: big ? 1 : 0.8 });
      else if (b === 'reveal') sfx.play('materialize', { volume: 0.8 });
      else if (b === 'roar') sfx.play(big ? 'roarBig' : 'roarSmall', { volume: big ? 1 : 0.8 });
      else if (b === 'impact') {
        void unit.badge.pop();
        sfx.play('impactHeavy', { volume: big ? 0.7 : 0.35 });
      }
    },
  });
  await cut;
  unit.show();
  unit.rest();
}

// ================================================================ spells / traps

export interface Showcase {
  card: CardSprite;
  center: XY;
  /** Collapse the card into an energy orb that flies to `to` (resolves on arrival). */
  release(to: XY, o?: { ms?: number }): Promise<void>;
  /** Fly the card down onto a zone and lay it there as a TileCard (equip / field spells). */
  land(o: { player: PlayerId; spot: 'spellTrap' | 'field'; index: number; uid: Uid; cardId: CardId }): Promise<TileCard>;
  /** Just remove everything (fade). */
  close(): Promise<void>;
}

/**
 * Common spell / trap opening (GAME_DESIGN §7): the card rises to the middle of the field, grows
 * to 2× and shows its art; a teal (spell) or magenta (trap) aura and a turning rune ring burn
 * behind it; it hangs for `hold` ms. Source: a hand card (taken), a CardSprite you pass, or a
 * TileCard (it is released from the field and replaced by a flying card).
 */
export async function spellShowcase(
  ctx: AnyCtx,
  o: { uid: Uid; cardId: CardId; player: PlayerId; from: 'hand' | TileCard | CardSprite; hold?: number; kind?: 'spell' | 'trap'; at?: XY },
): Promise<Showcase> {
  const sc = ctx.scene;
  const kind = o.kind ?? 'spell';
  const R = kind === 'spell' ? RAMPS.teal : RAMPS.mag;
  const center = o.at ?? { x: GAME_W / 2, y: 132 };
  let card: CardSprite;
  if (o.from === 'hand') card = takeHandCard(ctx, o.player, o.uid, o.cardId);
  else if (o.from instanceof CardSprite) card = o.from;
  else {
    const t = o.from;
    card = new CardSprite(sc, t.home.x, t.home.y - 6, o.cardId, { faceUp: t.faceUp, player: o.player }).setScale(0.45);
    ctx.views.field.release(o.uid);
    t.destroy();
  }
  card.setCard(o.cardId);
  card.setDepth(DEPTH.FX_TOP + 10);
  const veil = dim(ctx, 0.3, 220);
  sfx.play('spellActivate', { volume: kind === 'spell' ? 0.9 : 0.6 });
  // aura + rune ring behind the card
  const glow = sc.add.image(center.x, center.y, AK.glow).setBlendMode(ADD).setTint(R[3]).setDepth(DEPTH.FX_TOP + 8).setScale(0.2).setAlpha(0);
  const ring = Raster.around(sc, center.x, center.y, 180, 180, DEPTH.FX_TOP + 9, ADD);
  const sparks = new Sparks(sc, DEPTH.FX_TOP + 11, ADD);
  let ringLv = 0;
  let closing = false;
  let spin = 0;
  const stopRing = onFrame(sc, (dt, el) => {
    spin += dt * 0.0018;
    ringLv = closing ? Math.max(0, ringLv - dt / 200) : Math.min(1, ringLv + dt / 260);
    ring.draw((g) => {
      if (ringLv <= 0.01) return;
      const rr = 70 + Math.sin(el * 0.004) * 1.5;
      g.ring(center.x, center.y, rr, rr, R[3], ringLv * 0.9);
      g.ring(center.x, center.y, rr - 6, rr - 6, R[2], ringLv * 0.55);
      for (let i = 0; i < 12; i++) {
        const a = spin + (i / 12) * TAU;
        const x0 = center.x + Math.cos(a) * (rr - 3);
        const y0 = center.y + Math.sin(a) * (rr - 3);
        g.rect(Math.round(x0) - 1, Math.round(y0) - 1, 2, 2, i % 3 === 0 ? R[4] : R[3], ringLv);
      }
      for (let i = 0; i < 6; i++) {
        const a = -spin * 1.6 + (i / 6) * TAU;
        g.px(center.x + Math.cos(a) * (rr + 6), center.y + Math.sin(a) * (rr + 6), R[4], ringLv * 0.8);
      }
    });
    if (!closing && rnd() < dt / 40) {
      const a = rnd() * TAU;
      const d = 40 + rnd() * 40;
      sparks.add({ x: center.x + Math.cos(a) * d, y: center.y + Math.sin(a) * d, vx: -Math.cos(a) * 18, vy: -Math.sin(a) * 18 - 10, life: 500, ramp: [R[4], R[3], R[2]], tex: rnd() < 0.3 ? TEX.plus : TEX.px1 });
    }
    return !(closing && ringLv <= 0);
  });
  void tween(sc, { targets: glow, alpha: 0.8, scale: 3.2, duration: 320, ease: 'Quad.Out' });
  await card.flyTo(center.x, center.y, { ms: 340, arc: 30, scale: 2, reveal: !card.faceUp, anticipate: false });
  card.setFaceUp(true);
  card.playSweep(true);
  sparkleBurst(sc, center.x, center.y, { ramp: R, count: 12 });
  // bob while holding
  const bob = sc.tweens.add({ targets: card, y: center.y - 2, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  await wait(sc, o.hold ?? 450);
  bob.stop();
  const cleanupAura = async () => {
    closing = true;
    sparks.close();
    void veil.remove(240);
    await tween(sc, { targets: glow, alpha: 0, scale: 4, duration: 240 });
    glow.destroy();
    stopRing();
    ring.destroy();
  };
  return {
    card,
    center,
    async release(to: XY, ro = {}) {
      sfx.play('whoosh', { volume: 0.6 });
      void card.pulse(R[4], 160);
      await tween(sc, { targets: card, scaleX: 0.3, scaleY: 0.3, alpha: 0.6, duration: 160, ease: 'Back.In' });
      card.destroy();
      void cleanupAura();
      await energyBolt(sc, center, to, R, ro.ms);
    },
    async land(l) {
      void cleanupAura();
      const at = zoneXY(l.player, l.spot, l.index);
      await card.flyTo(at.x, at.y - 30, { ms: 280, arc: 16, scale: 1, anticipate: false, land: false });
      const tile = await slamToZone(ctx, card, { player: l.player, spot: l.spot, index: l.index, uid: l.uid, cardId: l.cardId, faceUp: true, ms: 300, shake: 1 });
      void tile.pulse(R[3], 360);
      return tile;
    },
    async close() {
      void cleanupAura();
      await tween(sc, { targets: card, alpha: 0, scale: 2.4, duration: 220 });
      card.destroy();
    },
  };
}

/** A glowing orb with a sparkling trail arcs from `from` to `to`; small burst on arrival. */
export async function energyBolt(scene: Phaser.Scene, from: XY, to: XY, ramp: Ramp = RAMPS.teal, ms?: number): Promise<void> {
  const d = Math.hypot(to.x - from.x, to.y - from.y);
  const dur = ms ?? Math.max(240, Math.min(520, d * 1.6));
  const orb = scene.add.image(from.x, from.y, TEX.dot5).setBlendMode(ADD).setTint(ramp[4]).setDepth(DEPTH.FX_TOP + 12).setScale(2);
  const halo = scene.add.image(from.x, from.y, AK.glow).setBlendMode(ADD).setTint(ramp[3]).setDepth(DEPTH.FX_TOP + 11).setScale(0.5).setAlpha(0.8);
  const trail = new Sparks(scene, DEPTH.FX_TOP + 10, ADD);
  const cx = (from.x + to.x) / 2;
  const cy = Math.min(from.y, to.y) - Math.min(70, d * 0.35);
  await new Promise<void>((resolve) => {
    onFrame(scene, (_dt, el) => {
      const t = Math.min(1, el / dur);
      const e = t * t * (3 - 2 * t);
      const u = 1 - e;
      const x = u * u * from.x + 2 * u * e * cx + e * e * to.x;
      const y = u * u * from.y + 2 * u * e * cy + e * e * to.y;
      orb.setPosition(Math.round(x), Math.round(y));
      halo.setPosition(Math.round(x), Math.round(y));
      trail.add({ x, y, vx: (rnd() - 0.5) * 20, vy: (rnd() - 0.5) * 20, life: 260, ramp: [ramp[4], ramp[3], ramp[2], ramp[1]] });
      if (t >= 1) {
        resolve();
        return false;
      }
      return true;
    });
  });
  orb.destroy();
  halo.destroy();
  trail.close();
  void sparkleBurst(scene, to.x, to.y, { ramp, count: 14 });
}

/** Trap opening: the set card stands up revealed, magenta burst at the tile, "TUZAK!" banner. */
export async function trapReveal(ctx: AnyCtx, tile: TileCard | null, at?: XY): Promise<void> {
  const sc = ctx.scene;
  const p = tile ? tile.home : (at ?? { x: GAME_W / 2, y: GAME_H / 2 });
  const jobs: Promise<unknown>[] = [];
  if (tile && tile.active) jobs.push(tile.standUp(420, { reveal: true }));
  jobs.push(trapSpring(sc, p.x, p.y));
  void flash(sc, 90, PAL.mag4, 0.25);
  void shake(sc, 160, 2);
  // the banner slams at ~0.2 s and keeps its exit going while the trap's effect starts
  const ban = wait(sc, 160).then(() => trapBanner(sc));
  await all([...jobs, Promise.race([ban, wait(sc, 1050)])]);
}

// ================================================================ LP

/** Damage presentation: number (at a hit point or over the panel), LP roll, panel shake, duelist hurt. */
export async function presentDamage(ctx: AnyCtx, ev: Extract<GameEvent, { type: 'damage' }>, o: { at?: XY; size?: 1 | 2 } = {}): Promise<void> {
  const sc = ctx.scene;
  const lp = lpPoint(ctx, ev.player);
  const at = o.at ?? { x: lp.x, y: lp.y + (ev.player === 0 ? -30 : 26) };
  const size = o.size ?? (ev.amount >= 1000 ? 2 : 1);
  const jobs: Promise<unknown>[] = [damageNumber(sc, at.x, at.y, ev.amount, 'damage', { size, depth: o.at ? DEPTH.FX_TOP + 50 : DEPTH.HUD + 20 })];
  const d = ctx.views.duelists?.get(ev.player);
  if (d) jobs.push(d.play('hurt'), d.jolt());
  jobs.push(ctx.views.hud.setLp(ev.player, ev.lpAfter, true));
  if (ev.lpAfter <= 1000) ctx.music.setIntensity(1);
  await all(jobs);
}

export async function presentHeal(ctx: AnyCtx, ev: Extract<GameEvent, { type: 'lpGain' }>, o: { at?: XY } = {}): Promise<void> {
  const sc = ctx.scene;
  const lp = lpPoint(ctx, ev.player);
  const at = o.at ?? { x: lp.x, y: lp.y + (ev.player === 0 ? -30 : 26) };
  sfx.play('heal', { volume: 0.7 });
  await all([damageNumber(sc, at.x, at.y, ev.amount, 'heal', { depth: o.at ? DEPTH.FX_TOP + 50 : DEPTH.HUD + 20 }), ctx.views.hud.setLp(ev.player, ev.lpAfter, true)]);
}

// ================================================================ resolution runs

const RUN_TYPES = new Set<GameEvent['type']>(['target', 'destroy', 'toGraveyard', 'damage', 'lpGain', 'summon', 'equip', 'fieldSpell', 'statChange', 'attackNegated']);

/**
 * Indices of the events that make up the resolution of the current activation: the run of
 * target / destroy / toGraveyard / damage / lpGain / special summon / equip / fieldSpell /
 * statChange / attackNegated events right after it (stops at anything else, e.g. the next
 * activate, a decision, a phase change). Already consumed events are skipped.
 */
export function resolutionRun(ctx: AnyCtx, from = ctx.index + 1): number[] {
  const out: number[] = [];
  for (let i = from; i < ctx.events.length; i++) {
    const e = ctx.events[i];
    if (!RUN_TYPES.has(e.type)) break;
    if (e.type === 'summon' && e.from !== 'graveyard') break;
    if (!ctx.isConsumed(i)) out.push(i);
  }
  return out;
}

/**
 * Play events in order (each through its full handler chain, awaited). Use it so an activation
 * owns its whole resolution — then the board is never re-synced half-way through it.
 * `hints(i)` may return per-event hints.
 */
export async function playRun(ctx: AnyCtx, indices: readonly number[], hints?: (i: number) => Record<string, unknown> | undefined): Promise<void> {
  for (const i of indices) {
    if (ctx.isConsumed(i)) continue;
    await ctx.play(i, hints?.(i) ?? {});
  }
}

// ================================================================ lookups

/** Monster unit, or null — a tiny convenience with a null-safe core point. */
export function unitPoint(ctx: AnyCtx, uid: Uid | null, kind: 'core' | 'muzzle' | 'feet' = 'core'): XY | null {
  if (uid === null) return null;
  const u = ctx.unit(uid);
  if (!u) return null;
  return u.worldPoint(kind);
}

/** Player colour helpers. */
export function playerRamp(p: PlayerId): Ramp {
  return PLAYER_RAMP[p];
}

export function monsterIdOf(cardId: CardId): MonsterId | null {
  return isMonster(CARDS[cardId]) ? (cardId as MonsterId) : null;
}
