// HumanInput — turns clicks into engine Actions for the acting human player.
//
//   const action = await input.waitAction(state, player);   // null when cancelled (QA / restart)
//   input.cancel();
//
// Idle (main / battle phase): playable hand cards glow, actionable own monsters / set spells
// are outlined, SAVAŞ / TURU BİTİR are enabled as legal. Then:
//   hand card    → ActionMenu (Çağır / Kapalı Koy / Aktive Et / Koy) → tributes → zone / target
//   own monster  → Saldır / Doğrudan Saldır (battle) · Pozisyon Değiştir / Çevir (main) → target
//   own set spell→ Aktive Et → target
// Decisions: trapResponse → Prompt.trapResponse; chooseTarget → zone pick on the board (no
// cancel); discard → pick hand cards. Hover anything → InspectPanel with current stats.
// Keys: B = SAVAŞ, E = TURU BİTİR, Esc = back.

import Phaser from 'phaser';
import { CARDS, isMonster, isSpell, type CardId } from '../data/cards';
import { currentAtk, currentDef, describePending, legalActions } from '../engine';
import type { Action, GameState, PlayerId, Uid, ZoneKind, ZoneRef } from '../engine/types';
import { PAL, PLAYER_COLOR } from '../art/palette';
import { sfx } from '../audio/sfx';
import type { BoardSpot } from '../view/layout';
import { playerStyle } from '../view/ui-textures';
import type { InstructionHandle } from '../view/Prompt';
import type { DuelViews } from './types';
import { pickCard } from './CardPicker';

type Choice =
  | { kind: 'battle' }
  | { kind: 'endTurn' }
  | { kind: 'hand'; uid: Uid }
  | { kind: 'zone'; ref: ZoneRef }
  | { kind: 'cancel' };

interface Pick {
  player: PlayerId;
  spot: BoardSpot;
  index: number;
}

class Cancelled extends Error {}

export class HumanInput {
  readonly scene: Phaser.Scene;
  readonly views: DuelViews;
  private state: GameState | null = null;
  private player: PlayerId = 0;
  private token = 0;
  /** Current waiter for an idle choice / zone click. */
  private onChoice: ((c: Choice) => void) | null = null;
  private onZone: ((p: Pick) => void) | null = null;
  private onHandPick: ((uid: Uid) => void) | null = null;
  private instruction: InstructionHandle | null = null;
  private trapOpen = false;
  private hoverKey = '';
  private highlighted: { tile: { setHighlight(c: number | null): unknown } }[] = [];
  enabled = false;

  constructor(scene: Phaser.Scene, views: DuelViews) {
    this.scene = scene;
    this.views = views;
    const v = views;
    v.hud.onBattle = () => this.onChoice?.({ kind: 'battle' });
    v.hud.onEndTurn = () => this.onChoice?.({ kind: 'endTurn' });
    v.hand.onSelect = (uid) => {
      if (this.onHandPick) return this.onHandPick(uid);
      this.onChoice?.({ kind: 'hand', uid });
    };
    v.hand.onHover = (uid) => {
      if (uid === null) {
        this.hoverKey = '';
        v.inspect.hide();
        return;
      }
      const id = this.cardOfHand(uid);
      if (id) v.inspect.show(id);
    };
    scene.input.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length || p.rightButtonReleased()) return;
      const hit = this.pick(p.x, p.y);
      if (!hit) return;
      if (this.onZone) return this.onZone(hit);
      if (hit.spot === 'monster' || hit.spot === 'spellTrap' || hit.spot === 'field') this.onChoice?.({ kind: 'zone', ref: { player: hit.player, zone: hit.spot as ZoneKind, index: hit.index } });
    });
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => this.hover(p.x, p.y));
    const onKey = (e: KeyboardEvent) => {
      if (!this.enabled || !this.onChoice) return;
      if (e.key === 'b' || e.key === 'B') this.onChoice({ kind: 'battle' });
      else if (e.key === 'e' || e.key === 'E') this.onChoice({ kind: 'endTurn' });
    };
    window.addEventListener('keydown', onKey);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', onKey));
  }

  /** Abort whatever the player was doing (QA dispatch / restart / game over). */
  cancel(): void {
    this.token++;
    this.onChoice?.({ kind: 'cancel' });
    this.onChoice = null;
    this.onZone = null;
    this.onHandPick = null;
    this.instruction?.close();
    this.instruction = null;
    this.views.menu.close();
    if (this.trapOpen) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    this.clearIdle();
  }

  /** Wait for the human `player` to complete one action in `state`. */
  async waitAction(state: GameState, player: PlayerId): Promise<Action | null> {
    const token = ++this.token;
    this.state = state;
    this.player = player;
    this.enabled = true;
    try {
      const pd = state.pending;
      if (pd && pd.kind === 'trapResponse') {
        this.trapOpen = true;
        const uid = await this.views.prompt.trapResponse(
          player,
          pd.options.map((u) => ({ uid: u, cardId: state.cards[u].cardId })),
        );
        this.trapOpen = false;
        if (token !== this.token) return null;
        return { type: 'respond', player, uid };
      }
      if (pd && pd.kind === 'chooseTarget') {
        const ref = await this.pickZone(pd.candidates, describePending(state, pd), { cancel: false, color: PLAYER_COLOR[player] });
        if (!ref || token !== this.token) return null;
        return { type: 'chooseTarget', player, target: ref };
      }
      if (pd && pd.kind === 'discard') {
        const uids = await this.pickHand(pd.count, describePending(state, pd));
        if (!uids || token !== this.token) return null;
        return { type: 'discard', player, uids };
      }
      for (;;) {
        if (token !== this.token) return null;
        const legal = legalActions(state).filter((a) => a.player === player);
        this.showIdle(legal);
        const c = await new Promise<Choice>((r) => (this.onChoice = r));
        this.onChoice = null;
        this.clearIdle();
        if (token !== this.token || c.kind === 'cancel') return null;
        let a: Action | null = null;
        try {
          if (c.kind === 'battle') a = legal.find((x) => x.type === 'enterBattle') ?? null;
          else if (c.kind === 'endTurn') a = legal.find((x) => x.type === 'endTurn') ?? null;
          else if (c.kind === 'hand') a = await this.handFlow(c.uid, legal);
          else if (c.kind === 'zone') a = await this.zoneFlow(c.ref, legal);
        } catch (e) {
          if (!(e instanceof Cancelled)) throw e;
          a = null;
        }
        if (token !== this.token) return null;
        if (a) {
          sfx.play('uiConfirm', { volume: 0.6 });
          return a;
        }
        if (c.kind === 'battle' || c.kind === 'endTurn') sfx.play('uiError', { volume: 0.5 });
      }
    } finally {
      if (token === this.token) {
        this.enabled = false;
        this.clearIdle();
      }
    }
  }

  // ================================================================ flows

  private async handFlow(uid: Uid, legal: Action[]): Promise<Action | null> {
    const s = this.state!;
    const p = this.player;
    const cardId = s.cards[uid].cardId;
    const d = CARDS[cardId];
    const acts = legal.filter((a) => 'uid' in a && a.uid === uid);
    const has = (t: Action['type']) => acts.some((a) => a.type === t);
    const opts =
      d.kind === 'monster'
        ? [
            { id: 'normalSummon', label: 'Çağır', enabled: has('normalSummon') },
            { id: 'setMonster', label: 'Kapalı Koy', enabled: has('setMonster') },
          ]
        : d.kind === 'spell'
          ? [
              { id: 'activateSpell', label: 'Aktive Et', enabled: has('activateSpell') },
              { id: 'setSpellTrap', label: 'Koy', enabled: has('setSpellTrap') },
            ]
          : [{ id: 'setSpellTrap', label: 'Koy', enabled: has('setSpellTrap') }];
    const hand = this.views.hand;
    hand.setSelected(uid);
    const at = hand.cardXY(uid) ?? { x: 320, y: 300 };
    const verb = await this.views.menu.open(at.x, at.y - 40, opts, { style: playerStyle(p), title: d.name });
    hand.setSelected(null);
    if (!verb || verb === 'cancel') return null;
    const cands = acts.filter((a) => a.type === verb);
    if (!cands.length) return null;
    switch (verb) {
      case 'normalSummon':
      case 'setMonster':
        return this.summonParams(cands as Extract<Action, { type: 'normalSummon' | 'setMonster' }>[], verb === 'setMonster');
      case 'setSpellTrap': {
        const zones = [...new Set((cands as Extract<Action, { type: 'setSpellTrap' }>[]).map((a) => a.zone))];
        const z = await this.pickOne(zones.map((i) => ({ player: p, zone: 'spellTrap' as ZoneKind, index: i })), 'Kartı koymak için bir büyü/tuzak alanı seç');
        return cands.find((a) => (a as { zone: number }).zone === z?.index) ?? null;
      }
      case 'activateSpell':
        return this.spellParams(cands as Extract<Action, { type: 'activateSpell' }>[], cardId);
    }
    return null;
  }

  private async zoneFlow(ref: ZoneRef, legal: Action[]): Promise<Action | null> {
    const s = this.state!;
    const p = this.player;
    if (ref.player !== p) return null;
    if (ref.zone === 'spellTrap') {
      const st = s.players[p].spellTraps[ref.index];
      if (!st) return null;
      const acts = legal.filter((a) => a.type === 'activateSpell' && a.uid === st.uid) as Extract<Action, { type: 'activateSpell' }>[];
      const id = s.cards[st.uid].cardId;
      const t = this.views.field.tileAt(p, 'spellTrap', ref.index);
      const verb = await this.views.menu.open(t?.home.x ?? 320, (t?.home.y ?? 200) - 14, [{ id: 'activateSpell', label: 'Aktive Et', enabled: acts.length > 0 }], {
        style: playerStyle(p),
        title: CARDS[id].name,
      });
      if (verb !== 'activateSpell' || !acts.length) return null;
      return this.spellParams(acts, id);
    }
    if (ref.zone !== 'monster') return null;
    const slot = s.players[p].monsters[ref.index];
    if (!slot) return null;
    const attacks = legal.filter((a) => a.type === 'attack' && a.attackerZone === ref.index) as Extract<Action, { type: 'attack' }>[];
    const change = legal.find((a) => a.type === 'changePosition' && a.zone === ref.index) ?? null;
    const flip = legal.find((a) => a.type === 'flipSummon' && a.zone === ref.index) ?? null;
    const opts: { id: string; label: string; enabled?: boolean }[] = [];
    if (s.phase === 'battle') {
      const targeted = attacks.filter((a) => a.targetZone !== null);
      const direct = attacks.find((a) => a.targetZone === null);
      if (targeted.length || !direct) opts.push({ id: 'attack', label: 'Saldır', enabled: targeted.length > 0 });
      if (direct) opts.push({ id: 'direct', label: 'Doğrudan Saldır' });
    } else {
      if (!slot.faceUp) opts.push({ id: 'flip', label: 'Çevir', enabled: !!flip });
      opts.push({ id: 'change', label: 'Pozisyon Değiştir', enabled: !!change });
    }
    const u = this.views.field.unitAt(p, ref.index);
    const at = u ? u.worldPoint('top') : (this.views.field.tileAt(p, 'monster', ref.index)?.home ?? { x: 320, y: 180 });
    const id = s.cards[slot.uid].cardId;
    const verb = await this.views.menu.open(at.x, at.y - 2, opts, { style: playerStyle(p), title: slot.faceUp ? CARDS[id].name : 'Kapalı Kart' });
    if (!verb || verb === 'cancel') return null;
    if (verb === 'flip') return flip;
    if (verb === 'change') return change;
    if (verb === 'direct') return attacks.find((a) => a.targetZone === null) ?? null;
    if (verb === 'attack') {
      const targets = attacks.filter((a) => a.targetZone !== null);
      const opp: PlayerId = p === 0 ? 1 : 0;
      const r = await this.pickOne(
        targets.map((a) => ({ player: opp, zone: 'monster' as ZoneKind, index: a.targetZone! })),
        'Saldırılacak canavarı seç',
        PAL.crim3,
      );
      return r ? (targets.find((a) => a.targetZone === r.index) ?? null) : null;
    }
    return null;
  }

  private async summonParams(cands: Extract<Action, { type: 'normalSummon' | 'setMonster' }>[], set: boolean): Promise<Action | null> {
    const p = this.player;
    let list = cands;
    const need = list[0].tributes.length;
    if (need > 0) {
      const pool = [...new Set(list.flatMap((a) => a.tributes))];
      const chosen = await this.pickTributes(pool, need);
      if (!chosen) return null;
      const key = [...chosen].sort((a, b) => a - b).join(',');
      list = list.filter((a) => [...a.tributes].sort((x, y) => x - y).join(',') === key);
      if (!list.length) return null;
    }
    const zones = [...new Set(list.map((a) => a.zone))];
    const z = await this.pickOne(
      zones.map((i) => ({ player: p, zone: 'monster' as ZoneKind, index: i })),
      set ? 'Kapalı koymak için bir canavar alanı seç' : 'Çağırmak için bir canavar alanı seç',
    );
    if (!z) return null;
    return list.find((a) => a.zone === z.index) ?? null;
  }

  private async spellParams(cands: Extract<Action, { type: 'activateSpell' }>[], cardId: CardId): Promise<Action | null> {
    const p = this.player;
    const s = this.state!;
    const withTarget = cands.filter((a) => a.target);
    if (!withTarget.length) return cands[0];
    const first = withTarget[0].target!;
    if (first.kind === 'graveyard') {
      const uids = [...new Set(withTarget.map((a) => (a.target as { uid: Uid }).uid))];
      const uid = await this.pickCardFlow(
        uids.map((u) => ({ uid: u, cardId: s.cards[u].cardId, owner: s.cards[u].owner })),
        'Mezarlıktan çağırılacak canavarı seç',
      );
      if (uid === null) return null;
      const forUid = withTarget.filter((a) => (a.target as { uid: Uid }).uid === uid);
      const zones = [...new Set(forUid.map((a) => (a.target as { toZone: number }).toZone))];
      const z = await this.pickOne(zones.map((i) => ({ player: p, zone: 'monster' as ZoneKind, index: i })), 'Canavarın geleceği alanı seç');
      if (!z) return null;
      return forUid.find((a) => (a.target as { toZone: number }).toZone === z.index) ?? null;
    }
    // monster targets (judgment_bolt: opponent, dragon_blade: own face-up)
    const refs = new Map<string, ZoneRef>();
    for (const a of withTarget) {
      const r = (a.target as { ref: ZoneRef }).ref;
      refs.set(`${r.player}:${r.zone}:${r.index}`, r);
    }
    const hostile = [...refs.values()].some((r) => r.player !== p);
    const r = await this.pickOne([...refs.values()], hostile ? 'Hedef seç: rakibin bir canavarı' : 'Kuşanacak canavarı seç', hostile ? PAL.crim3 : PAL.gold3);
    if (!r) return null;
    const forRef = withTarget.filter((a) => {
      const t = (a.target as { ref: ZoneRef }).ref;
      return t.player === r.player && t.index === r.index && t.zone === r.zone;
    });
    if (forRef.length <= 1) return forRef[0] ?? null;
    // equip from hand: any free spell/trap zone — prefer the one in the same column
    const best = forRef.find((a) => a.zone === r.index) ?? forRef[0];
    void cardId;
    return best;
  }

  // ================================================================ pickers

  private async pickCardFlow(cards: { uid: Uid; cardId: CardId; owner: PlayerId }[], title: string): Promise<Uid | null> {
    return pickCard(this.scene, title, cards);
  }

  /** One zone among `refs` (auto when there is exactly one). null = cancelled. */
  private async pickOne(refs: ZoneRef[], text: string, color: number = PLAYER_COLOR[this.player]): Promise<ZoneRef | null> {
    if (refs.length === 1) return refs[0];
    if (!refs.length) return null;
    return this.pickZone(refs, text, { cancel: true, color });
  }

  /** Highlight `refs` on the board and wait for a click on one of them (or İPTAL). */
  private pickZone(refs: ZoneRef[], text: string, o: { cancel: boolean; color: number }): Promise<ZoneRef | null> {
    const board = this.views.board;
    const token = this.token;
    for (const r of refs) board.highlightZone(r.player, r.zone, r.index, o.color);
    const ins = this.views.prompt.instruction(text, { cancel: o.cancel, style: this.player === 0 ? 'p1' : 'p2' });
    this.instruction = ins;
    return new Promise<ZoneRef | null>((resolve) => {
      let done = false;
      const finish = (v: ZoneRef | null) => {
        if (done) return;
        done = true;
        this.onZone = null;
        board.clearHighlights();
        ins.close();
        if (this.instruction === ins) this.instruction = null;
        resolve(token === this.token ? v : null);
      };
      void ins.cancelled.then(() => finish(null));
      this.onZone = (h) => {
        const r = refs.find((x) => x.player === h.player && x.zone === h.spot && x.index === h.index);
        if (r) {
          sfx.play('uiClick', { volume: 0.7 });
          finish(r);
        } else sfx.play('uiError', { volume: 0.4 });
      };
      // keep a cancel path for programmatic aborts
      const prev = this.onChoice;
      this.onChoice = (c) => {
        if (c.kind === 'cancel') finish(null);
        else prev?.(c);
      };
    });
  }

  /** Toggle `need` of the player's monsters as tributes. */
  private pickTributes(pool: Uid[], need: number): Promise<Uid[] | null> {
    const s = this.state!;
    const p = this.player;
    const board = this.views.board;
    const field = this.views.field;
    const token = this.token;
    const zoneOf = (uid: Uid) => s.players[p].monsters.findIndex((m) => m?.uid === uid);
    const chosen = new Set<Uid>();
    const paint = () => {
      for (const uid of pool) {
        const i = zoneOf(uid);
        if (i < 0) continue;
        board.highlightZone(p, 'monster', i, chosen.has(uid) ? PAL.white : PAL.gold3);
        field.tileAt(p, 'monster', i)?.setHighlight(chosen.has(uid) ? PAL.white : null);
      }
    };
    const label = () => `Kurban seç: ${chosen.size}/${need}`;
    const ins = this.views.prompt.instruction(label(), { cancel: true, style: 'gold' });
    this.instruction = ins;
    paint();
    return new Promise<Uid[] | null>((resolve) => {
      let done = false;
      const finish = (v: Uid[] | null) => {
        if (done) return;
        done = true;
        this.onZone = null;
        board.clearHighlights();
        for (const uid of pool) {
          const i = zoneOf(uid);
          if (i >= 0) field.tileAt(p, 'monster', i)?.setHighlight(null);
        }
        ins.close();
        if (this.instruction === ins) this.instruction = null;
        resolve(token === this.token ? v : null);
      };
      void ins.cancelled.then(() => finish(null));
      this.onZone = (h) => {
        if (h.player !== p || h.spot !== 'monster') return;
        const uid = s.players[p].monsters[h.index]?.uid;
        if (uid === undefined || !pool.includes(uid)) return void sfx.play('uiError', { volume: 0.4 });
        if (chosen.has(uid)) chosen.delete(uid);
        else chosen.add(uid);
        sfx.play('uiClick', { volume: 0.7 });
        if (chosen.size >= need) return finish([...chosen]);
        ins.setText(label());
        paint();
      };
      const prev = this.onChoice;
      this.onChoice = (c) => {
        if (c.kind === 'cancel') finish(null);
        else prev?.(c);
      };
    });
  }

  /** Pick `count` hand cards (end-phase discard). */
  private pickHand(count: number, text: string): Promise<Uid[] | null> {
    const hand = this.views.hand;
    const token = this.token;
    const chosen: Uid[] = [];
    const ins = this.views.prompt.instruction(text, { cancel: false, style: 'trap' });
    this.instruction = ins;
    hand.setPlayable(hand.uids);
    hand.setEnabled(true);
    return new Promise<Uid[] | null>((resolve) => {
      const finish = (v: Uid[] | null) => {
        this.onHandPick = null;
        hand.setPlayable([]);
        hand.setSelected(null);
        ins.close();
        if (this.instruction === ins) this.instruction = null;
        resolve(token === this.token ? v : null);
      };
      this.onHandPick = (uid) => {
        if (!chosen.includes(uid)) chosen.push(uid);
        hand.setSelected(uid);
        if (chosen.length >= count) finish(chosen.slice(0, count));
      };
      this.onChoice = (c) => {
        if (c.kind === 'cancel') finish(null);
      };
    });
  }

  // ================================================================ idle state

  private showIdle(legal: Action[]): void {
    const s = this.state!;
    const p = this.player;
    const v = this.views;
    const handUids = new Set<Uid>();
    const zones = new Set<number>();
    const stZones = new Set<number>();
    for (const a of legal) {
      if ((a.type === 'normalSummon' || a.type === 'setMonster' || a.type === 'setSpellTrap') && s.players[p].hand.includes(a.uid)) handUids.add(a.uid);
      else if (a.type === 'activateSpell') {
        if (s.players[p].hand.includes(a.uid)) handUids.add(a.uid);
        else {
          const i = s.players[p].spellTraps.findIndex((st) => st?.uid === a.uid);
          if (i >= 0) stZones.add(i);
        }
      } else if (a.type === 'attack') zones.add(a.attackerZone);
      else if (a.type === 'changePosition' || a.type === 'flipSummon') zones.add(a.zone);
    }
    v.hand.setEnabled(true);
    v.hand.setPlayable(v.hand.owner === p ? handUids : []);
    const col = PLAYER_COLOR[p];
    this.highlighted = [];
    for (const i of zones) {
      const t = v.field.tileAt(p, 'monster', i);
      if (t) {
        t.setHighlight(col);
        this.highlighted.push({ tile: t });
      }
    }
    for (const i of stZones) {
      const t = v.field.tileAt(p, 'spellTrap', i);
      if (t) {
        t.setHighlight(PAL.teal3);
        this.highlighted.push({ tile: t });
      }
    }
    const canBattle = legal.some((a) => a.type === 'enterBattle');
    const canEnd = legal.some((a) => a.type === 'endTurn');
    const canAttack = legal.some((a) => a.type === 'attack');
    const other = handUids.size + zones.size + stZones.size > 0;
    v.hud.setLocked(false);
    v.hud.setButtons({
      battle: canBattle,
      endTurn: canEnd,
      attention: s.phase === 'battle' && !canAttack ? 'endTurn' : !other && canBattle ? 'battle' : !other && canEnd ? 'endTurn' : null,
    });
  }

  private clearIdle(): void {
    const v = this.views;
    for (const h of this.highlighted) {
      try {
        h.tile.setHighlight(null);
      } catch {
        /* tile gone */
      }
    }
    this.highlighted = [];
    v.hand.setPlayable([]);
    v.hud.setButtons({ battle: false, endTurn: false, attention: null });
  }

  // ================================================================ board picking / hover

  /** What is under a screen point: a unit body first (front-most), else the tile. */
  pick(sx: number, sy: number): Pick | null {
    const w = this.views.camera.worldPoint(sx, sy);
    const units = this.views.field.units().filter((u) => u.sprite.visible && !u.retired);
    units.sort((a, b) => b.sprite.depth - a.sprite.depth);
    for (const u of units) {
      const s = u.sprite;
      const b = s.getBounds();
      if (!b.contains(w.x, w.y)) continue;
      const fx = Math.floor((s.flipX ? b.right - w.x : w.x - b.left) / Math.abs(s.scaleX));
      const fy = Math.floor((w.y - b.top) / Math.abs(s.scaleY));
      const a = this.scene.textures.getPixelAlpha(fx, fy, s.texture.key, s.frame.name);
      if (a && a > 0) return { player: u.player, spot: 'monster', index: u.zone };
    }
    const z = this.views.board.zoneAt(w.x, w.y);
    return z ? { player: z.player, spot: z.spot, index: z.index } : null;
  }

  private hover(sx: number, sy: number): void {
    if (sy >= 284 && sx >= 160 && sx <= 480) return; // the hand band handles its own hover
    const h = this.pick(sx, sy);
    const key = h ? `${h.player}:${h.spot}:${h.index}` : '';
    if (key === this.hoverKey) return;
    this.hoverKey = key;
    const v = this.views;
    const s = this.state ?? null;
    if (!h || !s) {
      if (!h) v.inspect.hide();
      return;
    }
    const ps = s.players[h.player];
    if (h.spot === 'monster') {
      const slot = ps.monsters[h.index];
      if (!slot) return v.inspect.hide();
      const id = s.cards[slot.uid].cardId;
      if (!slot.faceUp) return v.inspect.show(h.player === v.hand.owner ? id : null);
      return v.inspect.show(id, { atk: currentAtk(s, slot.uid), def: currentDef(s, slot.uid) });
    }
    if (h.spot === 'spellTrap') {
      const st = ps.spellTraps[h.index];
      if (!st) return v.inspect.hide();
      const id = s.cards[st.uid].cardId;
      return v.inspect.show(st.faceUp || h.player === v.hand.owner ? id : null);
    }
    if (h.spot === 'field') {
      const fs = ps.fieldSpell;
      return fs ? v.inspect.show(s.cards[fs.uid].cardId) : v.inspect.hide();
    }
    if (h.spot === 'graveyard') {
      const g = ps.graveyard;
      return g.length ? v.inspect.show(s.cards[g[g.length - 1]].cardId) : v.inspect.hide();
    }
    v.inspect.hide();
  }

  /** Keep hover lookups on the latest state even while not waiting for input. */
  setState(s: GameState): void {
    this.state = s;
  }

  private cardOfHand(uid: Uid): CardId | null {
    const s = this.state;
    if (!s) return null;
    return s.cards[uid]?.cardId ?? null;
  }
}

// keep the type-only helpers referenced
export type _HI = typeof isMonster | typeof isSpell;
