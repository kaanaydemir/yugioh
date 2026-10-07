// FieldView — every card on the board: TileCards on the monster / spell-trap / field zones,
// MonsterUnits standing on face-up monster tiles, and the deck / graveyard piles.
//
//   field.sync(state)                 // instant reconcile with an engine state (create / destroy /
//                                     // move / flip / rotate / stats / equip + volcano auras)
//   field.unit(uid) / field.unitAt(p, zone)        // MonsterUnit lookups
//   field.tileOf(uid) / field.tileAt(p, spot, i)   // TileCard lookups
//   field.pile(p, 'deck' | 'graveyard')            // PileView
//
// Cinematics build visuals ahead of the state with the helpers below (placeCard, placeMonster,
// addUnit, release, remove); the next sync only fixes what is still wrong, so a cinematic that
// already put the right card in the right zone keeps its objects.

import Phaser from 'phaser';
import { CARDS, isMonster, type CardId, type MonsterId } from '../data/cards';
import { currentAtk, currentDef } from '../engine';
import type { GameState, PlayerId, Position, Uid } from '../engine/types';
import { volcanoActive } from '../engine/query';
import type { CardOrientation } from '../art/cards';
import { TileCard } from '../view/TileCard';
import type { XY } from '../view/layout';
import { MonsterUnit } from './MonsterUnit';
import { PileView, type PileKind } from './PileView';
import { equipAura, flameAura, steamAura } from './auras';

export type FieldSpot = 'monster' | 'spellTrap' | 'field';

export interface ZoneEntry {
  player: PlayerId;
  spot: FieldSpot;
  index: number;
  uid: Uid;
  cardId: CardId;
  tile: TileCard;
  unit: MonsterUnit | null;
}

const key = (p: PlayerId, spot: FieldSpot, i: number) => `${p}:${spot}:${i}`;

export class FieldView {
  readonly scene: Phaser.Scene;
  private readonly entries = new Map<string, ZoneEntry>();
  private readonly piles: Record<PlayerId, Record<PileKind, PileView>>;
  private pendingSync = false;
  private lastState: GameState | null = null;
  /** Units that left the field but are still fading (lookups by uid still find them). */
  private readonly ghosts = new Map<Uid, MonsterUnit>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.piles = {
      0: { deck: new PileView(scene, 0, 'deck'), graveyard: new PileView(scene, 0, 'graveyard') },
      1: { deck: new PileView(scene, 1, 'deck'), graveyard: new PileView(scene, 1, 'graveyard') },
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  // ================================================================ lookups

  entry(player: PlayerId, spot: FieldSpot, index: number): ZoneEntry | null {
    return this.entries.get(key(player, spot, index)) ?? null;
  }

  entryOf(uid: Uid): ZoneEntry | null {
    for (const e of this.entries.values()) if (e.uid === uid) return e;
    return null;
  }

  unit(uid: Uid): MonsterUnit | null {
    return this.entryOf(uid)?.unit ?? this.ghosts.get(uid) ?? null;
  }

  unitAt(player: PlayerId, zone: number): MonsterUnit | null {
    return this.entry(player, 'monster', zone)?.unit ?? null;
  }

  units(): MonsterUnit[] {
    const out: MonsterUnit[] = [];
    for (const e of this.entries.values()) if (e.unit) out.push(e.unit);
    return out;
  }

  tileOf(uid: Uid): TileCard | null {
    return this.entryOf(uid)?.tile ?? null;
  }

  tileAt(player: PlayerId, spot: FieldSpot, index: number): TileCard | null {
    return this.entry(player, spot, index)?.tile ?? null;
  }

  pile(player: PlayerId, kind: PileKind): PileView {
    return this.piles[player][kind];
  }

  // ================================================================ cinematic helpers

  /**
   * Put a TileCard on a zone now (replacing whatever was there). For monsters this does NOT
   * create the unit — use placeMonster / addUnit.
   */
  placeCard(player: PlayerId, spot: FieldSpot, index: number, uid: Uid, cardId: CardId, faceUp: boolean, orientation: CardOrientation = 'up'): TileCard {
    const k = key(player, spot, index);
    const old = this.entries.get(k);
    if (old && old.uid !== uid) this.dispose(old, false);
    if (old && old.uid === uid) {
      old.tile.sync(cardId, faceUp, orientation);
      return old.tile;
    }
    // the same card may still sit elsewhere (moved): drop that entry
    const prev = this.entryOf(uid);
    if (prev) this.dispose(prev, false);
    const tile = new TileCard(this.scene, player, spot, index, cardId, faceUp, orientation);
    this.entries.set(k, { player, spot, index, uid, cardId, tile, unit: null });
    return tile;
  }

  /**
   * Put a monster card (and, if face-up, its unit) on a zone. `hidden` creates the unit
   * invisible (summon cinematics reveal it). Returns the new objects.
   */
  placeMonster(
    player: PlayerId,
    zone: number,
    uid: Uid,
    cardId: CardId,
    o: { position: Position; faceUp: boolean; hidden?: boolean; atk?: number; def?: number; tileFaceUp?: boolean },
  ): { tile: TileCard; unit: MonsterUnit | null } {
    const tile = this.placeCard(player, 'monster', zone, uid, cardId, o.tileFaceUp ?? o.faceUp, o.position === 'defense' ? 'side' : 'up');
    const e = this.entries.get(key(player, 'monster', zone))!;
    let unit: MonsterUnit | null = null;
    if (o.faceUp) unit = this.addUnit(uid, { hidden: o.hidden, atk: o.atk, def: o.def });
    return { tile: e.tile ?? tile, unit };
  }

  /** Create (or return) the unit for a monster card already on a tile. */
  addUnit(uid: Uid, o: { hidden?: boolean; atk?: number; def?: number; position?: Position } = {}): MonsterUnit | null {
    const e = this.entryOf(uid);
    if (!e || e.spot !== 'monster') return null;
    const d = CARDS[e.cardId];
    if (!isMonster(d)) return null;
    if (e.unit && !e.unit.retired) {
      if (o.hidden) e.unit.hide();
      return e.unit;
    }
    const position: Position = o.position ?? (e.tile.orientation === 'side' ? 'defense' : 'attack');
    const unit = new MonsterUnit(this.scene, {
      uid,
      cardId: e.cardId as MonsterId,
      player: e.player,
      zone: e.index,
      position,
      atk: o.atk ?? d.atk,
      def: o.def ?? d.def,
      hidden: o.hidden,
    });
    unit.tile = e.tile;
    e.unit = unit;
    this.ghosts.delete(uid);
    return unit;
  }

  /**
   * Detach a card's objects from the bookkeeping WITHOUT destroying them: the caller owns them
   * (e.g. a TileCard that flies to the graveyard). The unit, if any, stays findable by uid
   * until retired.
   */
  release(uid: Uid): { tile: TileCard | null; unit: MonsterUnit | null } {
    const e = this.entryOf(uid);
    if (!e) return { tile: null, unit: null };
    this.entries.delete(key(e.player, e.spot, e.index));
    if (e.unit) this.ghosts.set(uid, e.unit);
    return { tile: e.tile, unit: e.unit };
  }

  /** Remove a card's visuals (unit retired; tile faded or destroyed at once). */
  remove(uid: Uid, o: { fade?: boolean } = {}): void {
    const e = this.entryOf(uid);
    if (e) this.dispose(e, !!o.fade);
  }

  /** Forget a released unit (call after you destroyed / retired it yourself). */
  forget(uid: Uid): void {
    const u = this.ghosts.get(uid);
    if (u && !u.retired) u.retire();
    this.ghosts.delete(uid);
  }

  /** Every TileCard currently on the board (for highlights). */
  tiles(): ZoneEntry[] {
    return [...this.entries.values()];
  }

  // ================================================================ sync

  /** Instantly reconcile every zone, unit, aura and pile with `state`. */
  sync(state: GameState): void {
    const volcano = volcanoActive(state);
    const running = this.scene.sys.isActive();
    if (!running && !this.pendingSync) {
      // created before the scene runs (DuelScene.create): finish auras on the first frame
      this.pendingSync = true;
      this.scene.events.once(Phaser.Scenes.Events.UPDATE, () => {
        this.pendingSync = false;
        if (this.lastState) this.sync(this.lastState);
      });
    }
    this.lastState = state;
    const seen = new Set<string>();
    for (const p of [0, 1] as PlayerId[]) {
      const ps = state.players[p];
      // ---- monsters
      ps.monsters.forEach((slot, i) => {
        const k = key(p, 'monster', i);
        if (!slot) return;
        seen.add(k);
        const cardId = state.cards[slot.uid].cardId;
        const orient: CardOrientation = slot.position === 'defense' ? 'side' : 'up';
        let e = this.entries.get(k) ?? null;
        if (e && (e.uid !== slot.uid || e.cardId !== cardId)) {
          this.dispose(e, false);
          e = null;
        }
        if (!e) {
          // the card may be on another zone (moved) — drop it there
          const prev = this.entryOf(slot.uid);
          if (prev) this.dispose(prev, false);
          const tile = new TileCard(this.scene, p, 'monster', i, cardId, slot.faceUp, orient);
          e = { player: p, spot: 'monster', index: i, uid: slot.uid, cardId, tile, unit: null };
          this.entries.set(k, e);
        } else this.fixTile(e.tile, cardId, slot.faceUp, orient);
        // unit
        if (slot.faceUp) {
          const atk = currentAtk(state, slot.uid);
          const def = currentDef(state, slot.uid);
          if (!e.unit || e.unit.retired) {
            e.unit = null;
            this.addUnit(slot.uid, { atk, def, position: slot.position });
          }
          const u = e.unit!;
          if (u.player !== p || u.zone !== i) u.setController(p, i);
          if (u.position !== slot.position) void u.setPosition(slot.position, false);
          if (u.displaced) u.settle();
          const shown = u.shownStats;
          if (shown.atk !== atk || shown.def !== def) void u.setStats(atk, def, false);
          // auras (only on a running scene: aura helpers tick from their first frame)
          if (running) {
            try {
              const equipped = state.players.some((pl) => pl.spellTraps.some((st) => st && st.equippedTo === slot.uid));
              if (equipped && !u.hasAura('equip')) u.setAura('equip', equipAura(this.scene, u));
              if (!equipped && u.hasAura('equip')) u.setAura('equip', null);
              const attr = u.attribute;
              const wantVolcano = volcano && (attr === 'FIRE' || attr === 'WATER');
              if (wantVolcano && !u.hasAura('volcano')) u.setAura('volcano', attr === 'FIRE' ? flameAura(this.scene, u) : steamAura(this.scene, u));
              if (!wantVolcano && u.hasAura('volcano')) u.setAura('volcano', null);
            } catch (e) {
              console.error('[field] aura failed', e);
            }
          }
        } else if (e.unit) {
          e.unit.retire(0);
          e.unit = null;
        }
      });
      // ---- spells / traps
      ps.spellTraps.forEach((slot, i) => {
        const k = key(p, 'spellTrap', i);
        if (!slot) return;
        seen.add(k);
        const cardId = state.cards[slot.uid].cardId;
        this.syncCard(k, p, 'spellTrap', i, slot.uid, cardId, slot.faceUp);
      });
      // ---- field spell
      if (ps.fieldSpell) {
        const k = key(p, 'field', 0);
        seen.add(k);
        this.syncCard(k, p, 'field', 0, ps.fieldSpell.uid, state.cards[ps.fieldSpell.uid].cardId, ps.fieldSpell.faceUp);
      }
      // ---- piles
      this.piles[p].deck.set(ps.deck.length, null);
      const g = ps.graveyard;
      this.piles[p].graveyard.set(g.length, g.length ? state.cards[g[g.length - 1]].cardId : null);
    }
    for (const [k, e] of [...this.entries]) if (!seen.has(k)) this.dispose(e, false);
  }

  destroy(): void {
    for (const e of this.entries.values()) this.dispose(e, false);
    this.entries.clear();
    for (const u of this.ghosts.values()) u.destroy();
    this.ghosts.clear();
    for (const p of [0, 1] as PlayerId[]) {
      this.piles[p].deck.destroy();
      this.piles[p].graveyard.destroy();
    }
  }

  // ================================================================ internals

  private syncCard(k: string, p: PlayerId, spot: FieldSpot, i: number, uid: Uid, cardId: CardId, faceUp: boolean): void {
    let e = this.entries.get(k) ?? null;
    if (e && (e.uid !== uid || e.cardId !== cardId)) {
      this.dispose(e, false);
      e = null;
    }
    if (!e) {
      const prev = this.entryOf(uid);
      if (prev) this.dispose(prev, false);
      const tile = new TileCard(this.scene, p, spot, i, cardId, faceUp, 'up');
      this.entries.set(k, { player: p, spot, index: i, uid, cardId, tile, unit: null });
      return;
    }
    this.fixTile(e.tile, cardId, faceUp, 'up');
  }

  private fixTile(t: TileCard, cardId: CardId, faceUp: boolean, o: CardOrientation): void {
    const ok =
      t.active &&
      t.visible &&
      t.alpha >= 0.99 &&
      !t.standing &&
      t.cardId === cardId &&
      t.faceUp === faceUp &&
      t.orientation === o &&
      Math.abs(t.x - t.home.x) < 0.5 &&
      Math.abs(t.y - t.home.y) < 0.5 &&
      t.scaleX === 1 &&
      t.scaleY === 1;
    if (ok) return;
    this.scene.tweens.killTweensOf(t);
    t.setPosition(t.home.x, t.home.y).setScale(1);
    t.sync(cardId, faceUp, o);
  }

  private dispose(e: ZoneEntry, fade: boolean): void {
    this.entries.delete(key(e.player, e.spot, e.index));
    if (e.unit) {
      e.unit.retire();
      this.ghosts.set(e.uid, e.unit);
      const uid = e.uid;
      const u = e.unit;
      this.scene.time.delayedCall(1700, () => {
        if (this.ghosts.get(uid) === u) this.ghosts.delete(uid);
      });
    }
    const t = e.tile;
    if (!t.active) return;
    if (fade) void t.fadeOut(260).then(() => t.destroy());
    else t.destroy();
  }

  /** Screen point of a zone's tile centre (convenience). */
  static homeOf(t: TileCard): XY {
    return t.home;
  }
}
