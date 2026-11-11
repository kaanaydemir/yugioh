// HumanInput — turns clicks and keys into engine Actions for the acting human player.
//
//   const action = await input.waitAction(state, player);   // null when cancelled (QA / restart)
//   input.cancel();
//   input.mode                                              // what the player is being asked for (QA)
//
// Idle (main / battle phase): playable hand cards glow, actionable own monsters / set spells are
// outlined, SAVAŞ / TURU BİTİR are enabled as legal, and a guidance line above the hand says what
// to do ("Bir kart seç...", "Saldıracak canavarını seç..."). Then:
//   hand card    → ActionMenu (Çağır / Kurbanla Çağır / Kapalı Koy / Aktive Et) → tributes → zone / target
//   own monster  → main: Çevir / Pozisyon Değiştir · battle: click it, then click the target
//                  (a menu only when a direct attack is possible: Saldır / Doğrudan Saldır)
//   own set spell→ Aktive Et → target
// Something that cannot be done never opens an empty menu: the hint line says why instead, and
// disabled menu rows explain themselves in a bubble. Valid zones glow and light up under the
// pointer; Esc / right click / İPTAL go back one step.
// Decisions: trapResponse → Prompt.trapResponse; chooseTarget → zone pick on the board (no
// cancel); discard → toggle hand cards, confirm. Hover anything → InspectPanel with current stats
// (the card whose menu is open stays pinned there).
// Keys (idle): B = SAVAŞ, E = TURU BİTİR, 1–9 = hand card, Esc / ≡ = düello menüsü
// (Devam Et / Teslim Ol / Ana Menüye Dön; outside the player's own input only Devam / Ana Menü).
//
// v3, lane A6-B (V3_A6_B; docs/v3/A6_PLAN.md F4 / F5 / K11 / K12, step B3) — v1 keeps all of the above
// exactly: board picks carry target corners on the candidate monsters (src/view/v3/TargetMarks.ts:
// arrive, breathe, settle under the pointer, close on the click), the selected attacker white
// corners; an invalid board click is answered where it lands (the reject stamp, the tile's outline,
// the unit's contour; the reason stays in the hint line, which no longer repeats the instruction bar);
// an unplayable hand card picked by key is refused in the hand too (hand.reject); a click on any
// graveyard (or M / Shift+M: the viewer's / the other one) opens A6-A's graveyard panel while no
// cinematic plays; hovering a deck, an empty graveyard or the other player's mini-hand shows the pile
// in the inspect panel (inspect.showPile: counts only, nothing hidden).

import Phaser from 'phaser';
import { CARDS, cardDef, isMonster, isSpell, isTrap, tributesFor, type CardId } from '../data/cards';
import { currentAtk, currentDef, describePending, isMainPhase, legalActions } from '../engine';
import { freeMonsterZones, freeSpellTrapZones } from '../engine/query';
import type { Action, GameState, PlayerId, Uid, ZoneKind, ZoneRef } from '../engine/types';
import type { MonsterUnit } from './MonsterUnit';
import { PAL, PLAYER_COLOR } from '../art/palette';
import { sfx } from '../audio/sfx';
import { GAME_W, LOOK_V3, panelRect, type BoardSpot, type XY } from '../view/layout';
import { V3_A6_B } from '../view/v3flags';
import { AimMarks, SelectMark, ackClick, rejectClick } from '../view/v3/TargetMarks';
import { gravePanelOpen, openGravePanel } from '../view/v3/GravePanel';
import { showPile } from '../view/v3/inspectV3';
import type { InspectStats } from '../view/InspectPanel';
import type { MenuOption } from '../view/ActionMenu';
import { playerStyle, uiKeysActive } from '../view/ui-textures';
import type { InstructionHandle } from '../view/Prompt';
import type { DuelViews } from './types';
import { pickCard } from './CardPicker';
import { showClock } from './showclock';
import { shroudReject } from '../cinematics/kartc/tide_harpooner-shroud';

type Choice =
  | { kind: 'battle' }
  | { kind: 'endTurn' }
  | { kind: 'hand'; uid: Uid }
  | { kind: 'zone'; ref: ZoneRef }
  | { kind: 'menu' }
  | { kind: 'cancel' };

interface Pick {
  player: PlayerId;
  spot: BoardSpot;
  index: number;
}

export type InputMode = 'off' | 'curtain' | 'idle' | 'menu' | 'zone' | 'tribute' | 'discard' | 'trap' | 'cards' | 'pause';

class Cancelled extends Error {}

const refKey = (r: { player: PlayerId; zone?: string; spot?: string; index: number }) => `${r.player}:${r.zone ?? r.spot}:${r.index}`;

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
  /** Right click / Esc during a cancellable board pick. */
  private zoneCancel: (() => void) | null = null;
  private instruction: InstructionHandle | null = null;
  private trapOpen = false;
  /** Inspect numbers: the plate's own while it shows battle-only values (v3), else the current stats. */
  private plateStats(s: GameState, uid: Uid, u: MonsterUnit | null): InspectStats {
    if (u && u.battleTint) return u.shownStats;
    return { atk: currentAtk(s, uid), def: currentDef(s, uid) };
  }

  private hoverKey = '';
  /** v3: the board pick the hover last showed (a click at that same point selects it, even if an idle bob moved the body's edge since). */
  private hoverPick: { x: number; y: number; ctx: unknown; st: unknown; mode: InputMode; hit: Pick | null } | null = null;
  private highlighted: { setHighlight(c: number | null): unknown }[] = [];
  /** Zones that react to a click in idle (pointer cursor). */
  private idleZones = new Set<string>();
  /** Board pick in progress: candidates, their base color and the one under the pointer. */
  private zoneHover: { refs: ZoneRef[]; color: number; hot: string } | null = null;
  /** The card whose menu / target pick is open: the inspect panel keeps showing it. */
  private pinned: { id: CardId | null; stats: InspectStats } | null = null;
  private pauseOpen = false;
  /** v3 (A6-B, F4): the open board pick's target corners, the selected attacker's corners. */
  private aim: AimMarks | null = null;
  private sel: SelectMark | null = null;
  /** v3 (A6B-7): the frame the target corners last locked (their ui3Lock is that frame's sound). */
  private aimLockFrame = -1;
  /** v3 (F5): the screen point of the last board click (the reject stamp lands there). */
  private lastClick: XY | null = null;
  /** A cinematic is playing (set by the controller): the graveyard panel opens only when not. */
  busy: () => boolean = () => false;
  /** QA (v3, B3): how many times a graveyard panel was asked for (the S-9 stub opens nothing yet). */
  graveOpens = 0;
  enabled = false;
  /** What the human is being asked for right now (QA / playtest tools read this). */
  mode: InputMode = 'off';
  /** "Ana Menüye Dön" was confirmed in the düello menüsü (the controller leaves the duel). */
  onQuit: (() => void) | null = null;

  constructor(scene: Phaser.Scene, views: DuelViews) {
    this.scene = scene;
    this.views = views;
    const v = views;
    v.hud.onBattle = () => this.onChoice?.({ kind: 'battle' });
    v.hud.onEndTurn = () => this.onChoice?.({ kind: 'endTurn' });
    v.hud.onMenu = () => this.requestMenu();
    v.hud.onBattleBlocked = () => {
      const s = this.state;
      if (!s || this.mode !== 'idle') return;
      if (s.phase === 'battle') v.hud.flashHint('Already in the Battle Phase');
      else if (s.phase === 'main2') v.hud.flashHint('The Battle Phase is over for this turn');
      else if (s.turn <= 1) v.hud.flashHint('No Battle Phase on the first turn of the duel');
    };
    v.hand.onSelect = (uid) => {
      if (this.onHandPick) return this.onHandPick(uid);
      if (this.onChoice && this.mode === 'idle') return this.onChoice({ kind: 'hand', uid });
      if (this.mode === 'off' && this.state && this.state.winner === null) v.hud.flashHint('It is not your turn', { style: 'neutral', ms: 1400 });
    };
    v.hand.onHover = (uid) => {
      if (uid === null) {
        this.hoverKey = '';
        if (this.pinned) v.inspect.show(this.pinned.id, this.pinned.stats);
        else v.inspect.hide();
        return;
      }
      const id = this.cardOfHand(uid);
      if (id) v.inspect.show(v.hand.isFaceDown ? null : id);
    };
    scene.input.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (p.rightButtonReleased()) {
        // right click = back, wherever it lands (menus handle their own right clicks)
        if (this.zoneCancel && !over.length) this.zoneCancel();
        return;
      }
      if (over.length) return;
      if (V3_A6_B && gravePanelOpen(scene)) return; // the panel holds the input
      const hp = this.hoverPick;
      const hit = LOOK_V3 && hp && hp.x === p.x && hp.y === p.y && hp.ctx === this.zoneHover && hp.st === this.state && hp.mode === this.mode ? hp.hit : this.pick(p.x, p.y);
      if (!hit) return;
      if (V3_A6_B) {
        this.lastClick = { x: p.x, y: p.y };
        // K11: any graveyard opens its panel (idle, a pick, the computer's turn — not a cinematic)
        if (hit.spot === 'graveyard' && this.openGrave(hit.player, 'mouse')) return;
      }
      if (this.onZone) return this.onZone(hit);
      if (!this.onChoice || this.mode !== 'idle') return;
      if (hit.spot === 'monster' || hit.spot === 'spellTrap' || hit.spot === 'field') this.onChoice({ kind: 'zone', ref: { player: hit.player, zone: hit.spot as ZoneKind, index: hit.index } });
      else if (V3_A6_B) this.rejectHit(hit); // F5: a deck / an empty pile has nothing to do
    });
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      // v3 (F7): over the trap prompt's plate the board under it is not hovered (its cards show in the inspect panel)
      if (V3_A6_B && this.mode === 'trap' && over && over.length) return;
      // v3 K11: the graveyard panel holds the pointer (its own hover drives the inspect panel)
      if (V3_A6_B && gravePanelOpen(scene)) return;
      this.hover(p.x, p.y);
    });
    const onKey = (e: KeyboardEvent) => {
      if (!scene.sys.isActive()) return;
      // modal UI (menus, prompts, pickers) holds the keys through pushUiKeys and swallows them
      if (uiKeysActive()) return;
      if (e.key === 'Escape') {
        if (!e.repeat) this.requestMenu();
        return;
      }
      // v3 K11: M = the viewer's graveyard panel, Shift+M = the other player's
      if (V3_A6_B && (e.key === 'm' || e.key === 'M') && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const own = this.views.hand.owner;
        this.openGrave(e.shiftKey ? (own === 0 ? 1 : 0) : own, 'key');
        return;
      }
      if (!this.enabled || !this.onChoice || this.mode !== 'idle' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'b') {
        if (this.views.hud.battleButton.enabled) this.views.hud.battleButton.click();
        else this.views.hud.onBattleBlocked?.();
      } else if (k === 'e') {
        if (this.views.hud.endTurnButton.enabled) this.views.hud.endTurnButton.click();
      } else if (/^[1-9]$/.test(e.key) && this.views.hand.owner === this.player) {
        const uid = this.views.hand.uids[Number(e.key) - 1];
        if (uid !== undefined) {
          this.views.hand.setHover(uid);
          this.onChoice({ kind: 'hand', uid });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', onKey);
      this.token++;
    });
  }

  /** Abort whatever the player was doing (QA dispatch / restart / game over). */
  cancel(): void {
    this.token++;
    this.onChoice?.({ kind: 'cancel' });
    this.onChoice = null;
    this.onZone = null;
    this.onHandPick = null;
    this.zoneCancel = null;
    this.instruction?.close();
    this.instruction = null;
    this.views.menu.close();
    if (this.trapOpen) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    this.endZoneHover();
    this.views.hand.setMarked([]);
    this.unpin();
    this.clearIdle();
    this.aim?.cancel();
    this.aim = null;
    this.sel?.release();
    this.sel = null;
    this.setMode('off');
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
        this.setMode('trap');
        const uid = await this.views.prompt.trapResponse(
          player,
          pd.options.map((u) => ({ uid: u, cardId: state.cards[u].cardId })),
          // v3 (F7): a card hovered / picked on the prompt plate is read in the inspect panel
          // (batch 2: a set quick spell may answer too — the question says "Kart", not "Tuzak")
          V3_A6_B
            ? {
                onFocus: (id) => (id ? this.views.inspect.show(id) : this.views.inspect.hide()),
                ...(pd.options.some((u) => isSpell(cardDef(state.cards[u].cardId))) ? { question: 'Activate a card?' } : {}),
              }
            : undefined,
        );
        this.trapOpen = false;
        if (token !== this.token) return null;
        return { type: 'respond', player, uid };
      }
      if (pd && pd.kind === 'chooseTarget') {
        const ref = await this.pickZone(pd.candidates, describePending(state, pd), { cancel: false, color: PAL.gold3 });
        if (!ref || token !== this.token) return null;
        return { type: 'chooseTarget', player, target: ref };
      }
      if (pd && pd.kind === 'discard') {
        const uids = await this.pickDiscard(pd.count, describePending(state, pd));
        if (!uids || token !== this.token) return null;
        return { type: 'discard', player, uids };
      }
      // batch 2 (docs/v3/YENI_KARTLAR.md): the coin call and Kovuk Devi's count
      if (pd && pd.kind === 'coinCall') {
        this.setMode('cards');
        const src = state.cards[pd.sourceUid];
        const call = await this.views.prompt.choose(describePending(state, pd), [
          { id: 'tails', label: 'TAILS' },
          { id: 'heads', label: 'HEADS' },
        ], { title: src ? CARDS[src.cardId].name : 'Coin Toss', style: player === 0 ? 'p1' : 'p2' });
        if (token !== this.token) return null;
        return { type: 'callCoin', player, call: call === 'heads' ? 'heads' : 'tails' };
      }
      if (pd && pd.kind === 'chooseCount') {
        this.setMode('cards');
        const src = state.cards[pd.sourceUid];
        const opts: { id: string; label: string }[] = [];
        for (let n = pd.min; n <= pd.max; n++) opts.push({ id: String(n), label: String(n) });
        const n = await this.views.prompt.choose(describePending(state, pd), opts, { title: src ? CARDS[src.cardId].name : undefined, style: player === 0 ? 'p1' : 'p2' });
        if (token !== this.token) return null;
        return { type: 'chooseCount', player, n: Number(n) };
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
          // Main Phase 2: in the Battle Phase the BATTLE button (v3: relabelled MAIN 2) ends the battle
          if (c.kind === 'battle') a = legal.find((x) => x.type === (state.phase === 'battle' ? 'endBattle' : 'enterBattle')) ?? null;
          else if (c.kind === 'endTurn') a = (await this.confirmSkipBattle()) ? await this.endTurnOrMain2(legal) : null;
          else if (c.kind === 'hand') a = await this.handFlow(c.uid, legal);
          else if (c.kind === 'zone') a = await this.zoneFlow(c.ref, legal);
          else if (c.kind === 'menu') {
            const r = await this.pauseMenu(true);
            if (r === 'quit') return null;
            if (r === 'surrender') a = legal.find((x) => x.type === 'surrender') ?? null;
          }
        } catch (e) {
          if (!(e instanceof Cancelled)) throw e;
          a = null;
        } finally {
          this.unpin();
        }
        if (token !== this.token) return null;
        if (a) {
          // v3 (A6B-7): the target corners' lock (ui3Lock) already sounded on this frame — one sound a frame
          if (!V3_A6_B || this.aimLockFrame !== (this.scene.game?.getFrame?.() ?? -2)) sfx.play('uiConfirm', { volume: 0.6 });
          return a;
        }
        if (c.kind === 'battle' || c.kind === 'endTurn') sfx.play('uiError', { volume: 0.5 });
      }
    } finally {
      if (token === this.token) {
        this.enabled = false;
        this.trapOpen = false;
        this.clearIdle();
        this.setMode('off');
      }
    }
  }

  /** The player is behind the pass-device curtain (set by the controller). */
  setCurtain(on: boolean): void {
    if (on) this.setMode('curtain');
    else if (this.mode === 'curtain') this.setMode('off');
  }

  // ================================================================ mode + hint line

  private setMode(m: InputMode): void {
    // v3 (A6B-11): a new instruction ends a refused click's reason (v1 lets it run its course)
    if (V3_A6_B && m !== this.mode) this.views.hud.endHintFlash();
    this.hoverPick = null;
    this.mode = m;
    const hud = this.views.hud;
    const p = this.player;
    switch (m) {
      case 'menu':
        hud.setHint('Choose an action · Esc: cancel', { player: p });
        break;
      case 'zone':
        // v3 (F4): the instruction bar says it; the hint line does not repeat it (it keeps the reasons)
        if (V3_A6_B) hud.setHint(null);
        else hud.setHint(this.zoneCancel ? 'Click a glowing zone · Esc: back' : 'Click a glowing target', { player: p });
        break;
      case 'tribute':
        if (V3_A6_B) hud.setHint(null);
        else hud.setHint('Click the monsters to Tribute · Esc: back', { style: 'gold' });
        break;
      case 'idle':
      case 'discard':
        break; // set by showIdle / pickDiscard with the details
      default:
        hud.setHint(null);
    }
  }

  /** Düello menüsü: Esc / ≡. In the player's own idle input it can surrender. */
  requestMenu(): void {
    if (this.pauseOpen || this.views.menu.isOpen) return;
    if (this.mode === 'curtain' || this.mode === 'trap' || this.mode === 'cards') return;
    const s = this.state;
    if (s && s.winner !== null) return;
    if (this.mode === 'idle' && this.onChoice) {
      this.onChoice({ kind: 'menu' });
      return;
    }
    if (this.mode === 'off') void this.pauseMenu(false);
    else if (this.mode === 'zone' || this.mode === 'tribute' || this.mode === 'discard')
      this.views.hud.flashHint(this.zoneCancel ? 'Finish your choice first, or press Esc to go back' : 'Finish your choice first', { style: 'neutral', ms: 1600 });
  }

  /**
   * The v3 look: the duel menu pauses the show (src/duel/showclock.ts): the cinematic, idle life,
   * timers, hit-stops and slow motion stop while it is open; the menu and its confirm prompt (made
   * after the pause starts) keep animating. The Director's watchdog waits too (userWait).
   * Without the look switch (v1 / v2) the menu is exactly as before: the show runs on behind it.
   */
  private pauseMenu(canSurrender: boolean): Promise<'resume' | 'surrender' | 'quit'> {
    if (!LOOK_V3) return this.pauseMenuBody(canSurrender);
    const resume = showClock(this.scene).pause();
    const p = this.pauseMenuBody(canSurrender);
    void p.then(resume, resume);
    return this.views.info.userWait(p);
  }

  private async pauseMenuBody(canSurrender: boolean): Promise<'resume' | 'surrender' | 'quit'> {
    this.pauseOpen = true;
    const prev = this.mode;
    if (canSurrender) this.setMode('pause');
    try {
      const opts: MenuOption[] = [{ id: 'resume', label: 'Resume' }];
      if (canSurrender) opts.push({ id: 'surrender', label: 'Surrender' });
      opts.push({ id: 'quit', label: 'Main Menu' });
      const id = await this.views.menu.open(GAME_W / 2, 60, opts, {
        style: canSurrender ? playerStyle(this.player) : 'neutral',
        title: 'Duel Menu',
        cancelRow: false,
      });
      if (id === 'surrender') {
        const ok = await this.views.prompt.confirm('If you surrender, you lose the duel. Are you sure?', {
          yes: 'SURRENDER',
          no: 'CANCEL',
          style: this.player === 0 ? 'p1' : 'p2',
        });
        return ok ? 'surrender' : 'resume';
      }
      if (id === 'quit') {
        const ok = await this.views.prompt.confirm('The duel will be abandoned. Return to the main menu?', { yes: 'MAIN MENU', no: 'CANCEL' });
        if (ok) {
          this.onQuit?.();
          return 'quit';
        }
      }
      return 'resume';
    } finally {
      this.pauseOpen = false;
      if (canSurrender && this.mode === 'pause') this.setMode(prev);
    }
  }

  // ================================================================ flows

  private async handFlow(uid: Uid, legal: Action[]): Promise<Action | null> {
    const s = this.state!;
    const p = this.player;
    const hud = this.views.hud;
    const cardId = s.cards[uid].cardId;
    const d = CARDS[cardId];
    if (!isMainPhase(s.phase)) {
      hud.flashHint('Cards cannot be played from the hand in the Battle Phase');
      if (V3_A6_B) void this.views.hand.reject(uid); // F5 (a key pick; a click is refused by the hand itself)
      return null;
    }
    const acts = legal.filter((a) => 'uid' in a && a.uid === uid);
    const has = (t: Action['type']) => acts.some((a) => a.type === t);
    let opts: MenuOption[];
    if (isMonster(d) && d.effect === 'magnetFusion') {
      // batch 2: Kutup Hükümdarı comes only by tributing the three Kutup pieces (no Normal Summon)
      opts = [
        {
          id: 'specialSummon',
          label: 'Fusion Summon (3 pieces)',
          enabled: has('specialSummon'),
          reason: !isMainPhase(s.phase) ? 'Monsters can only be Summoned in the Main Phase' : 'You need Polar Needle, Polar Anvil and Polar Coil on your field',
        },
      ];
    } else if (isMonster(d)) {
      const need = tributesFor(d.level);
      const why = this.summonReason(cardId);
      opts = [
        { id: 'normalSummon', label: need ? `Tribute Summon (${need})` : 'Summon', enabled: has('normalSummon'), reason: why ?? undefined },
        { id: 'setMonster', label: need ? `Set (${need} Tribute)` : 'Set', enabled: has('setMonster'), reason: why ?? undefined },
      ];
    } else if (isSpell(d)) {
      opts = [{ id: 'activateSpell', label: 'Activate', enabled: has('activateSpell'), reason: this.spellReason(cardId, true) ?? undefined }];
      if (d.spellType !== 'field') opts.push({ id: 'setSpellTrap', label: 'Set', enabled: has('setSpellTrap'), reason: 'Your Spell/Trap Zones are full' });
    } else {
      opts = [{ id: 'setSpellTrap', label: 'Set', enabled: has('setSpellTrap'), reason: 'Your Spell/Trap Zones are full' }];
    }
    if (!opts.some((o) => o.enabled)) {
      hud.flashHint(opts[0].reason ?? 'This card cannot be played right now');
      if (V3_A6_B) void this.views.hand.reject(uid);
      return null;
    }
    const hand = this.views.hand;
    hand.setSelected(uid);
    this.pin(cardId);
    const at = hand.cardXY(uid) ?? { x: 320, y: 300 };
    this.setMode('menu');
    const verb = await this.views.menu.open(at.x, at.y - 40, opts, { style: playerStyle(p), title: d.name });
    hand.setSelected(null);
    if (!verb || verb === 'cancel') return null;
    const cands = acts.filter((a) => a.type === verb);
    if (!cands.length) return null;
    switch (verb) {
      case 'normalSummon':
      case 'setMonster':
        return this.summonParams(cands as Extract<Action, { type: 'normalSummon' | 'setMonster' }>[], verb === 'setMonster', cardId);
      case 'setSpellTrap': {
        const zones = [...new Set((cands as Extract<Action, { type: 'setSpellTrap' }>[]).map((a) => a.zone))];
        const z = await this.pickOne(
          zones.map((i) => ({ player: p, zone: 'spellTrap' as ZoneKind, index: i })),
          `${d.name}: choose a Spell/Trap Zone to Set it in`,
        );
        return cands.find((a) => (a as { zone: number }).zone === z?.index) ?? null;
      }
      case 'activateSpell':
        return this.spellParams(cands as Extract<Action, { type: 'activateSpell' }>[], cardId);
      case 'specialSummon':
        return this.fusionParams(cands as Extract<Action, { type: 'specialSummon' }>[], cardId);
    }
    return null;
  }

  /** batch 2: Kutup Hükümdarı — the three pieces to tribute (asked only when there is a choice). */
  private async fusionParams(cands: Extract<Action, { type: 'specialSummon' }>[], cardId: CardId): Promise<Action | null> {
    if (cands.length === 1) return cands[0];
    const pool = [...new Set(cands.flatMap((a) => a.tributes))];
    const chosen = await this.pickTributes(pool, 3, CARDS[cardId].name);
    if (!chosen) return null;
    const key = [...chosen].sort((a, b) => a - b).join(',');
    const hit = cands.find((a) => [...a.tributes].sort((x, y) => x - y).join(',') === key) ?? null;
    if (!hit) this.views.hud.flashHint('Pick one of each piece: Needle, Anvil and Coil', { style: 'neutral', ms: 2200 });
    return hit;
  }

  private async zoneFlow(ref: ZoneRef, legal: Action[]): Promise<Action | null> {
    const s = this.state!;
    const p = this.player;
    const hud = this.views.hud;
    if (ref.player !== p) {
      if (s.phase === 'battle' && ref.zone === 'monster' && s.players[ref.player].monsters[ref.index])
        hud.flashHint(legal.some((a) => a.type === 'attack') ? 'First click your monster that will attack' : 'You have no monster that can attack', { style: 'neutral' });
      return this.refuse(ref);
    }
    if (ref.zone === 'spellTrap') {
      const st = s.players[p].spellTraps[ref.index];
      if (!st || st.faceUp) return this.refuse(ref);
      const id = s.cards[st.uid].cardId;
      const acts = legal.filter((a) => a.type === 'activateSpell' && a.uid === st.uid) as Extract<Action, { type: 'activateSpell' }>[];
      if (!acts.length) {
        hud.flashHint(
          isTrap(cardDef(id)) ? 'Traps activate when your opponent attacks or summons: you will be asked then' : (this.spellReason(id, false) ?? 'This card cannot be activated right now'),
          { style: isTrap(cardDef(id)) ? 'trap' : 'fire', ms: 2600 },
        );
        return this.refuse(ref);
      }
      const t = this.views.field.tileAt(p, 'spellTrap', ref.index);
      this.pin(id);
      this.setMode('menu');
      const verb = await this.views.menu.open(t?.home.x ?? 320, (t?.home.y ?? 200) - 14, [{ id: 'activateSpell', label: 'Activate' }], {
        style: playerStyle(p),
        title: CARDS[id].name,
      });
      if (verb !== 'activateSpell') return null;
      return this.spellParams(acts, id);
    }
    if (ref.zone !== 'monster') return this.refuse(ref);
    const slot = s.players[p].monsters[ref.index];
    if (!slot) return this.refuse(ref);
    const id = s.cards[slot.uid].cardId;
    const u = this.views.field.unitAt(p, ref.index);
    const at = u ? u.worldPoint('top') : (this.views.field.tileAt(p, 'monster', ref.index)?.home ?? { x: 320, y: 180 });
    const anchor = this.screenPoint(at);
    const stats: InspectStats = this.plateStats(s, slot.uid, u);

    if (s.phase === 'battle') {
      const attacks = legal.filter((a) => a.type === 'attack' && a.attackerZone === ref.index) as Extract<Action, { type: 'attack' }>[];
      if (!attacks.length) {
        hud.flashHint(this.attackReason(ref.index));
        return this.refuse(ref);
      }
      const targets = attacks.filter((a) => a.targetZone !== null);
      const direct = attacks.find((a) => a.targetZone === null) ?? null;
      this.pin(id, stats);
      let verb: string | null = 'attack';
      if (direct) {
        const opts: MenuOption[] = [];
        if (targets.length) opts.push({ id: 'attack', label: 'Attack Monster' });
        opts.push({ id: 'direct', label: 'Direct Attack' });
        this.setMode('menu');
        verb = await this.views.menu.open(anchor.x, anchor.y - 2, opts, { style: playerStyle(p), title: CARDS[id].name });
      }
      if (!verb || verb === 'cancel') return null;
      if (verb === 'direct') return direct;
      const opp: PlayerId = p === 0 ? 1 : 0;
      const tile = this.views.field.tileAt(p, 'monster', ref.index);
      tile?.setHighlight(PAL.gold3);
      // v3 (F4 / F5): the selected attacker wears white corners while its target is picked
      const atk = V3_A6_B ? this.views.field.unitAt(p, ref.index) : null;
      this.sel?.release();
      this.sel = atk ? new SelectMark(this.scene, atk) : null;
      try {
        const r = await this.pickZone(
          targets.map((a) => ({ player: opp, zone: 'monster' as ZoneKind, index: a.targetZone! })),
          `${CARDS[id].name}: choose the monster to attack`,
          // v3 (A6B-7): the attack's declare sounds its own lock-on on the click's frame — no second lock sound
          { cancel: true, color: PAL.gold3, lockSound: false },
        );
        return r ? (targets.find((a) => a.targetZone === r.index) ?? null) : null;
      } finally {
        try {
          tile?.setHighlight(null);
        } catch {
          /* tile gone */
        }
        this.sel?.release();
        this.sel = null;
      }
    }

    // main phase
    const change = legal.find((a) => a.type === 'changePosition' && a.zone === ref.index) ?? null;
    const flip = legal.find((a) => a.type === 'flipSummon' && a.zone === ref.index) ?? null;
    const effect = legal.find((a) => a.type === 'activateMonster' && a.zone === ref.index) ?? null;
    const opts: MenuOption[] = [];
    if (!slot.faceUp) opts.push({ id: 'flip', label: 'Flip Summon', enabled: !!flip, reason: this.flipReason(ref.index) ?? undefined });
    else
      opts.push({
        id: 'change',
        label: slot.position === 'attack' ? 'To Defense' : 'To Attack',
        enabled: !!change,
        reason: this.positionReason(ref.index) ?? undefined,
      });
    // batch 2: an ignition effect (Kadran Soytarısı, Kovuk Devi) — offered only on the cards that have one
    const fx = slot.faceUp ? cardDef(id) : null;
    if (fx && isMonster(fx) && (fx.effect === 'coinWipe' || fx.effect === 'banishGraveBoost400'))
      opts.unshift({ id: 'effect', label: 'Use Effect', enabled: !!effect, reason: this.effectReason(ref.index) ?? undefined });
    if (!opts.some((o) => o.enabled)) {
      hud.flashHint(opts[0].reason ?? 'Nothing can be done with this monster right now', { style: 'neutral' });
      return this.refuse(ref);
    }
    this.pin(slot.faceUp ? id : id, slot.faceUp ? stats : {});
    this.setMode('menu');
    const verb = await this.views.menu.open(anchor.x, anchor.y - 2, opts, { style: playerStyle(p), title: slot.faceUp ? CARDS[id].name : `${CARDS[id].name} (face-down)` });
    if (verb === 'flip') return flip;
    if (verb === 'change') return change;
    if (verb === 'effect') return effect;
    return null;
  }

  private async summonParams(cands: Extract<Action, { type: 'normalSummon' | 'setMonster' }>[], set: boolean, cardId: CardId): Promise<Action | null> {
    const p = this.player;
    const name = CARDS[cardId].name;
    let list = cands;
    const need = list[0].tributes.length;
    if (need > 0) {
      const pool = [...new Set(list.flatMap((a) => a.tributes))];
      const chosen = await this.pickTributes(pool, need, name);
      if (!chosen) return null;
      const key = [...chosen].sort((a, b) => a - b).join(',');
      list = list.filter((a) => [...a.tributes].sort((x, y) => x - y).join(',') === key);
      if (!list.length) return null;
    }
    const zones = [...new Set(list.map((a) => a.zone))];
    const z = await this.pickOne(
      zones.map((i) => ({ player: p, zone: 'monster' as ZoneKind, index: i })),
      set ? `${name}: choose a Monster Zone to Set it in` : `${name}: choose a Monster Zone to Summon to`,
    );
    if (!z) return null;
    return list.find((a) => a.zone === z.index) ?? null;
  }

  private async spellParams(cands: Extract<Action, { type: 'activateSpell' }>[], cardId: CardId): Promise<Action | null> {
    const p = this.player;
    const s = this.state!;
    const name = CARDS[cardId].name;
    const withTarget = cands.filter((a) => a.target);
    if (!withTarget.length) return cands[0];
    const first = withTarget[0].target!;
    if (first.kind === 'graveyard') {
      const uids = [...new Set(withTarget.map((a) => (a.target as { uid: Uid }).uid))];
      this.setMode('cards');
      const uid = await pickCard(
        this.scene,
        `${name}: which monster comes back?`,
        uids.map((u) => {
          const owner = s.cards[u].owner;
          return { uid: u, cardId: s.cards[u].cardId, owner, label: owner === p ? 'YOURS' : 'OPPONENT' };
        }),
        { subtitle: 'The monster you choose comes to your field in Attack Position' },
      );
      if (uid === null) return null;
      const forUid = withTarget.filter((a) => (a.target as { uid: Uid }).uid === uid);
      const zones = [...new Set(forUid.map((a) => (a.target as { toZone: number }).toZone))];
      const z = await this.pickOne(
        zones.map((i) => ({ player: p, zone: 'monster' as ZoneKind, index: i })),
        `${CARDS[s.cards[uid].cardId].name}: choose the Monster Zone it comes to`,
      );
      if (!z) return null;
      return forUid.find((a) => (a.target as { toZone: number }).toZone === z.index) ?? null;
    }
    // monster targets (judgment_bolt: opponent, dragon_blade: own face-up) — always an explicit click
    const refs = new Map<string, ZoneRef>();
    for (const a of withTarget) {
      const r = (a.target as { ref: ZoneRef }).ref;
      refs.set(refKey(r), r);
    }
    const hostile = [...refs.values()].some((r) => r.player !== p);
    const b2Text: Partial<Record<CardId, string>> = {
      puppet_string: `${name}: choose an opponent's monster to control until the End Phase`,
      soul_leash: `${name}: choose an opponent's monster to equip and take control of`,
      auger_lance: `${name}: choose the Spell/Trap to destroy`,
      spite_axe: `${name}: choose your monster to equip`,
    };
    const r = await this.pickZone(
      [...refs.values()],
      b2Text[cardId] ?? (hostile ? `${name}: choose the opponent's monster to destroy` : `${name}: choose your monster to equip`),
      { cancel: true, color: PAL.gold3 },
    );
    if (!r) return null;
    const forRef = withTarget.filter((a) => {
      const t = (a.target as { ref: ZoneRef }).ref;
      return t.player === r.player && t.index === r.index && t.zone === r.zone;
    });
    if (forRef.length <= 1) return forRef[0] ?? null;
    // equip from hand: any free spell/trap zone — prefer the one in the same column
    return forRef.find((a) => a.zone === r.index) ?? forRef[0];
  }

  /**
   * TURU BİTİR straight from the main phase skips the battle. When a monster could still attack,
   * ask first — the classic first-game slip (SAVAŞ is the button above).
   */
  /**
   * END TURN. v1 look, in the Battle Phase (its HUD keeps the battle's buttons and hint as they were): when
   * Main Phase 2 has something to offer, ask first whether to go there; otherwise (and in v3, which has its
   * own MAIN 2 button) the turn ends.
   */
  private async endTurnOrMain2(legal: Action[]): Promise<Action | null> {
    const s = this.state!;
    const end = legal.find((x) => x.type === 'endTurn') ?? null;
    const toMain2 = legal.find((x) => x.type === 'endBattle') ?? null;
    if (V3_A6_B || s.phase !== 'battle' || !toMain2 || !main2Offers(s, this.player)) return end;
    this.setMode('pause');
    const main2 = await this.views.prompt.confirm('Go to Main Phase 2 first? You can still Summon, Set cards and activate Spells there.', {
      yes: 'MAIN 2',
      no: 'END TURN',
      style: this.player === 0 ? 'p1' : 'p2',
    });
    return main2 ? toMain2 : end;
  }

  private async confirmSkipBattle(): Promise<boolean> {
    const s = this.state!;
    if (s.phase !== 'main' || s.turn <= 1) return true;
    const ready = s.players[this.player].monsters.some((m) => m && m.faceUp && m.position === 'attack' && m.attacksThisTurn === 0);
    if (!ready) return true;
    this.setMode('pause');
    return this.views.prompt.confirm('You have monsters that can attack. End your turn without entering the Battle Phase?', {
      yes: 'END TURN',
      no: 'CANCEL',
      style: this.player === 0 ? 'p1' : 'p2',
    });
  }

  // ================================================================ reasons (why not?)

  private summonReason(cardId: CardId): string | null {
    const s = this.state!;
    const me = s.players[this.player];
    const d = cardDef(cardId);
    if (!isMonster(d)) return null;
    if (!isMainPhase(s.phase)) return 'Monsters can only be Summoned in the Main Phase';
    if (me.noSummonTurn === s.turn) return 'Straw Decoys: you cannot Summon other monsters this turn';
    if (me.normalSummonUsed) return 'You already Summoned or Set a monster this turn (1 per turn)';
    const need = tributesFor(d.level);
    const onField = me.monsters.filter(Boolean).length;
    if (need > onField) return `A Level ${d.level} monster needs ${need} Tribute (you have ${onField} on the field)`;
    if (need === 0 && freeMonsterZones(s, this.player).length === 0) return 'Your Monster Zones are full';
    return null;
  }

  private spellReason(cardId: CardId, fromHand: boolean): string | null {
    const s = this.state!;
    const p = this.player;
    const opp: PlayerId = p === 0 ? 1 : 0;
    if (!isMainPhase(s.phase)) return 'Spells can only be activated in the Main Phase';
    switch (cardId) {
      case 'judgment_bolt':
        return s.players[opp].monsters.some(Boolean) ? null : 'Your opponent has no monster to destroy';
      case 'soul_recall': {
        const any = ([0, 1] as PlayerId[]).some((g) => s.players[g].graveyard.some((u) => isMonster(cardDef(s.cards[u].cardId))));
        if (!any) return 'No monster in the Graveyards to bring back';
        return freeMonsterZones(s, p).length ? null : 'Your Monster Zones are full';
      }
      case 'dragon_blade':
        if (!s.players[p].monsters.some((m) => m && m.faceUp)) return 'You have no face-up monster to equip';
        return fromHand && !freeSpellTrapZones(s, p).length ? 'Your Spell/Trap Zones are full' : null;
      case 'volcano_arena':
        return fromHand ? null : 'A Field Spell can only be activated from the hand';
      // ---- batch 2
      case 'well_pail':
        return s.players[p].deck.length >= 2 ? null : 'Your Deck needs at least 2 cards';
      case 'winnow_sieve':
        return s.players[p].deck.length >= 3 ? null : 'Your Deck needs at least 3 cards';
      case 'puppet_string':
      case 'soul_leash':
        if (!freeMonsterZones(s, p).length) return 'Your Monster Zones are full';
        return s.players[opp].monsters.some(Boolean) ? 'No opponent monster you can take control of' : 'Your opponent has no monsters';
      case 'void_eye':
        return 'No monster on the field to destroy';
      case 'sweeping_gale':
        return 'Your opponent has no Spell/Trap cards';
      case 'auger_lance':
        if (!fromHand) {
          const st = s.players[p].spellTraps.find((x) => x && s.cards[x.uid].cardId === 'auger_lance' && !x.faceUp);
          if (st && st.setTurn >= s.turn) return 'A Set Quick-Play Spell can be activated from your next turn';
        }
        return 'No Spell/Trap on the field to destroy';
      case 'straw_decoys':
        if (!fromHand) {
          const st = s.players[p].spellTraps.find((x) => x && s.cards[x.uid].cardId === 'straw_decoys' && !x.faceUp);
          if (st && st.setTurn >= s.turn) return 'A Set Quick-Play Spell can be activated from your next turn';
        }
        return 'Your Monster Zones are full';
      case 'lucky_die':
        return 'You have no face-up monster';
      case 'spite_axe':
        if (!s.players[p].monsters.some((m) => m && m.faceUp)) return 'You have no face-up monster to equip';
        return fromHand && !freeSpellTrapZones(s, p).length ? 'Your Spell/Trap Zones are full' : null;
    }
    return null;
  }

  /** batch 2: why a monster's ignition effect cannot be used now. */
  private effectReason(zone: number): string | null {
    const s = this.state!;
    const p = this.player;
    const m = s.players[p].monsters[zone];
    if (!m) return null;
    const d = cardDef(s.cards[m.uid].cardId);
    if (!isMainPhase(s.phase)) return 'Effects can only be used in the Main Phase';
    if (isMonster(d) && d.effect === 'coinWipe') {
      if (!s.players[p === 0 ? 1 : 0].monsters.some(Boolean)) return 'Your opponent has no monsters';
      return 'This effect was already used this turn (once per turn)';
    }
    if (isMonster(d) && d.effect === 'banishGraveBoost400') {
      if (!s.players[p].graveyard.some((u) => isMonster(cardDef(s.cards[u].cardId)))) return 'No monster in your Graveyard to banish';
      return 'This effect was already used this turn (once per turn)';
    }
    return null;
  }

  private positionReason(zone: number): string | null {
    const s = this.state!;
    const m = s.players[this.player].monsters[zone];
    if (!m) return null;
    if (m.enteredTurn === s.turn) return 'It arrived this turn: it can change position on your next turn';
    if (m.attacksThisTurn > 0) return 'It attacked this turn';
    if (m.positionChangedTurn === s.turn) return 'Its position already changed this turn (once per turn)';
    return null;
  }

  private flipReason(zone: number): string | null {
    const s = this.state!;
    const m = s.players[this.player].monsters[zone];
    if (!m) return null;
    if (m.enteredTurn === s.turn) return 'It cannot be flipped the turn it was Set: wait for your next turn';
    if (m.positionChangedTurn === s.turn) return 'It was already flipped this turn';
    return null;
  }

  private attackReason(zone: number): string {
    const s = this.state!;
    const m = s.players[this.player].monsters[zone];
    if (s.turn <= 1) return 'No attacks on the first turn of the duel';
    if (!m) return 'No monster here';
    if (!m.faceUp) return 'A face-down monster cannot attack (you can flip it in the Main Phase)';
    if (m.position !== 'attack') return 'A monster in Defense Position cannot attack';
    if (m.attacksThisTurn > 0) return 'This monster already attacked this turn';
    if (m.noAttackTurn === s.turn) return 'Hourglass Imp stopped its time: it cannot attack this turn';
    return 'This monster cannot attack right now';
  }

  // ================================================================ pickers

  /** One zone among `refs` (auto when there is exactly one — placement zones). null = cancelled. */
  // (gold, not the player's color: a cyan outline vanishes on P1's cyan tiles, crimson on P2's)
  private async pickOne(refs: ZoneRef[], text: string, color: number = PAL.gold3): Promise<ZoneRef | null> {
    if (refs.length === 1) return refs[0];
    if (!refs.length) return null;
    return this.pickZone(refs, text, { cancel: true, color });
  }

  /**
   * Highlight `refs` on the board and wait for a click on one of them (or İPTAL / Esc / right
   * click). Candidates glow gold and the one under the pointer white: gold reads on cyan, crimson
   * and volcano tiles alike (a player-colored outline vanished on that player's own tiles).
   */
  private pickZone(refs: ZoneRef[], text: string, o: { cancel: boolean; color: number; lockSound?: boolean }): Promise<ZoneRef | null> {
    const board = this.views.board;
    const token = this.token;
    // v3 (F4): target corners on the candidates that are monsters on screen; the floor highlight
    // stays for the candidates without one (it would only blur the corners' bottom legs)
    const aim = V3_A6_B ? new AimMarks(this.scene, this.views, refs) : null;
    this.aim?.cancel();
    this.aim = aim;
    for (const r of refs) if (!aim?.has(r)) board.highlightZone(r.player, r.zone, r.index, o.color);
    const ins = this.views.prompt.instruction(text, { cancel: o.cancel, style: this.player === 0 ? 'p1' : 'p2' });
    this.instruction = ins;
    this.zoneHover = { refs, color: o.color, hot: '' };
    const prevMode = this.mode;
    return new Promise<ZoneRef | null>((resolve) => {
      let done = false;
      const finish = (v: ZoneRef | null) => {
        if (done) return;
        done = true;
        if (aim) {
          if (v && token === this.token) {
            aim.confirm(v, o.lockSound !== false);
            this.aimLockFrame = this.scene.game?.getFrame?.() ?? -1;
          } else aim.cancel();
          if (this.aim === aim) this.aim = null;
        }
        this.onZone = null;
        this.zoneCancel = null;
        this.endZoneHover();
        board.clearHighlights();
        ins.close();
        if (this.instruction === ins) this.instruction = null;
        if (this.mode === 'zone') this.mode = prevMode;
        resolve(token === this.token ? v : null);
      };
      void ins.cancelled.then(() => finish(null));
      if (o.cancel)
        this.zoneCancel = () => {
          sfx.play('uiBack', { volume: 0.6 });
          finish(null);
        };
      this.setMode('zone');
      this.onZone = (h) => {
        const r = refs.find((x) => x.player === h.player && x.zone === h.spot && x.index === h.index);
        if (r) {
          if (!aim) sfx.play('uiClick', { volume: 0.7 }); // v3: the corners' lock (ui3Lock) says it
          if (V3_A6_B) this.views.hud.endHintFlash(); // A6B-11: a valid pick ends the reason
          finish(r);
        } else {
          if (LOOK_V3 && shroudReject(this.scene, this.views, this.state, h, this.player)) return; // tide_harpooner: Körfez kalkanı
          if (aim) this.rejectHit(h);
          else sfx.play('uiError', { volume: 0.4 });
          // v3: candidates with corners are "marked", not lit (the floor highlight is theirs only without a monster)
          const why = !aim || !aim.size ? 'Click a glowing zone' : aim.size === refs.length ? 'Click a marked target' : 'Click a marked target or a glowing zone';
          this.views.hud.flashHint(why, { style: 'neutral', ms: 1200 });
        }
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
  private pickTributes(pool: Uid[], need: number, forName: string): Promise<Uid[] | null> {
    const s = this.state!;
    const p = this.player;
    const board = this.views.board;
    const field = this.views.field;
    const token = this.token;
    const zoneOf = (uid: Uid) => s.players[p].monsters.findIndex((m) => m?.uid === uid);
    const chosen = new Set<Uid>();
    const refs = pool.map((uid) => ({ player: p, zone: 'monster' as ZoneKind, index: zoneOf(uid) })).filter((r) => r.index >= 0);
    // v3: candidates with corners skip the floor / tile highlight (the corners and their tag say it)
    let cornered: (i: number) => boolean = () => false;
    const paint = () => {
      for (const uid of pool) {
        const i = zoneOf(uid);
        if (i < 0 || cornered(i)) continue;
        board.highlightZone(p, 'monster', i, chosen.has(uid) ? PAL.white : PAL.gold3);
        field.tileAt(p, 'monster', i)?.setHighlight(chosen.has(uid) ? PAL.white : null);
      }
    };
    const label = () => `${forName}: choose ${need} monster${need === 1 ? '' : 's'} to Tribute (${chosen.size}/${need})`;
    const ins = this.views.prompt.instruction(label(), { cancel: true, style: 'gold' });
    this.instruction = ins;
    this.zoneHover = { refs, color: PAL.gold3, hot: '' };
    // v3 (F4 "Kurban seçimi"): corners on the pool; a chosen tribute's turn white beside a "1/2" counter
    const aim = V3_A6_B ? new AimMarks(this.scene, this.views, refs) : null;
    this.aim?.cancel();
    this.aim = aim;
    if (aim) cornered = (i) => aim.has({ player: p, zone: 'monster', index: i });
    paint();
    const refOf = (uid: Uid) => ({ player: p, zone: 'monster' as ZoneKind, index: zoneOf(uid) });
    return new Promise<Uid[] | null>((resolve) => {
      let done = false;
      const finish = (v: Uid[] | null) => {
        if (done) return;
        done = true;
        if (aim) {
          if (v && token === this.token) {
            aim.confirm(v.map(refOf));
            this.aimLockFrame = this.scene.game?.getFrame?.() ?? -1;
          } else aim.cancel();
          if (this.aim === aim) this.aim = null;
        }
        this.onZone = null;
        this.zoneCancel = null;
        this.endZoneHover();
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
      this.zoneCancel = () => {
        sfx.play('uiBack', { volume: 0.6 });
        finish(null);
      };
      this.setMode('tribute');
      this.onZone = (h) => {
        const uid = h.player === p && h.spot === 'monster' ? s.players[p].monsters[h.index]?.uid : undefined;
        if (uid === undefined || !pool.includes(uid)) {
          if (aim) this.rejectHit(h);
          else sfx.play('uiError', { volume: 0.4 });
          this.views.hud.flashHint('Click one of your own monsters to Tribute', { style: 'neutral', ms: 1400 });
          return;
        }
        if (chosen.has(uid)) chosen.delete(uid);
        else chosen.add(uid);
        if (V3_A6_B) this.views.hud.endHintFlash(); // A6B-11: a tribute picked ends the reason
        if (!aim) sfx.play('uiClick', { volume: 0.7 });
        if (chosen.size >= need) return finish([...chosen]);
        ins.setText(label());
        paint();
        if (aim) {
          // the counters follow the order of choice; ui3Mark / ui3Unmark for the one clicked
          const order = [...chosen];
          for (const u of pool) {
            const i = order.indexOf(u);
            aim.mark(refOf(u), i >= 0 ? `${i + 1}/${need}` : null, u === uid);
          }
        }
        if (this.zoneHover) this.zoneHover.hot = '';
      };
      const prev = this.onChoice;
      this.onChoice = (c) => {
        if (c.kind === 'cancel') finish(null);
        else prev?.(c);
      };
    });
  }

  /** End-phase hand limit: toggle `count` hand cards, then confirm. */
  private pickDiscard(count: number, text: string): Promise<Uid[] | null> {
    const hand = this.views.hand;
    const hud = this.views.hud;
    const token = this.token;
    const chosen: Uid[] = [];
    const ins = this.views.prompt.instruction(text, { cancel: false, style: 'trap' });
    this.instruction = ins;
    this.setMode('discard');
    const hint = () => hud.setHint(`Click the cards to discard (${chosen.length}/${count}) · click again: undo`, { style: 'trap' });
    hint();
    hand.setPlayable(hand.uids);
    hand.setEnabled(true);
    return new Promise<Uid[] | null>((resolve) => {
      let done = false;
      let asking = false;
      const finish = (v: Uid[] | null) => {
        if (done) return;
        done = true;
        this.onHandPick = null;
        hand.setPlayable([]);
        hand.setMarked([]);
        hand.setSelected(null);
        ins.close();
        if (this.instruction === ins) this.instruction = null;
        resolve(token === this.token ? v : null);
      };
      this.onHandPick = (uid) => {
        if (asking) return;
        const i = chosen.indexOf(uid);
        if (i >= 0) chosen.splice(i, 1);
        else if (chosen.length < count) chosen.push(uid);
        else {
          chosen.shift();
          chosen.push(uid);
        }
        hand.setMarked(chosen);
        if (V3_A6_B) hud.endHintFlash(); // A6B-11: a card picked ends the reason; the count line shows
        hint();
        if (chosen.length < count) return;
        asking = true;
        const names = chosen.map((u) => CARDS[this.state!.cards[u].cardId].name).join(', ');
        void this.views.prompt
          .confirm(`Send ${names} to the Graveyard?`, { yes: 'DISCARD', no: 'CHANGE', style: 'trap' })
          .then((ok) => {
            asking = false;
            if (done) return;
            if (ok && token === this.token) finish(chosen.slice(0, count));
            else hint();
          });
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
      } else if (a.type === 'specialSummon') handUids.add(a.uid);
      else if (a.type === 'activateMonster') zones.add(a.zone);
      else if (a.type === 'attack') zones.add(a.attackerZone);
      else if (a.type === 'changePosition' || a.type === 'flipSummon') zones.add(a.zone);
    }
    v.hand.setEnabled(true);
    v.hand.setPlayable(v.hand.owner === p ? handUids : []);
    const col = PLAYER_COLOR[p];
    this.highlighted = [];
    this.idleZones.clear();
    for (const i of zones) {
      const t = v.field.tileAt(p, 'monster', i);
      this.idleZones.add(refKey({ player: p, spot: 'monster', index: i }));
      if (t) {
        t.setHighlight(s.phase === 'battle' ? PAL.fire3 : col);
        this.highlighted.push(t);
      }
    }
    for (const i of stZones) {
      const t = v.field.tileAt(p, 'spellTrap', i);
      this.idleZones.add(refKey({ player: p, spot: 'spellTrap', index: i }));
      if (t) {
        t.setHighlight(PAL.teal3);
        this.highlighted.push(t);
      }
    }
    const canBattle = legal.some((a) => a.type === 'enterBattle');
    const canEnd = legal.some((a) => a.type === 'endTurn');
    const canAttack = legal.some((a) => a.type === 'attack');
    const other = handUids.size + zones.size + stZones.size > 0;
    // Main Phase 2 (v3): in the Battle Phase the BATTLE button is the MAIN 2 button (endBattle). The v1 look
    // keeps its battle buttons and hint exactly as they were (END TURN asks about Main Phase 2 instead).
    const toMain2 = V3_A6_B && s.phase === 'battle' && legal.some((a) => a.type === 'endBattle');
    const main2Worth = toMain2 && main2Offers(s, p);
    v.hud.setLocked(false);
    v.hud.setButtons({
      battle: canBattle || toMain2,
      endTurn: canEnd,
      attention: s.phase === 'battle' && !canAttack ? (main2Worth ? 'battle' : 'endTurn') : !other && canBattle ? 'battle' : !other && canEnd ? 'endTurn' : null,
      ...(V3_A6_B ? { battleAs: toMain2 ? ('main2' as const) : ('battle' as const) } : {}),
    });
    // guidance line
    let hint: string;
    if (s.phase === 'battle' && toMain2)
      hint = canAttack ? 'Click a monster to attack with, or go to MAIN 2' : main2Worth ? 'No monster can attack: go to MAIN 2, or END TURN' : 'No monster can attack: END TURN';
    else if (s.phase === 'battle') hint = canAttack ? 'Click a monster to attack with, or END TURN' : 'No monster can attack: END TURN';
    else if (s.phase === 'main2') hint = other ? 'Main Phase 2: choose a card, or END TURN' : 'Main Phase 2: no cards to play, END TURN';
    else if (other) hint = canBattle ? 'Choose a card, or go to BATTLE' : 'Choose a card, or END TURN (no attacks on the first turn)';
    else hint = canBattle ? 'No cards to play: go to BATTLE, or END TURN' : 'No cards to play: END TURN';
    this.setMode('idle');
    v.hud.setHint(hint, { player: p });
  }

  private clearIdle(): void {
    const v = this.views;
    for (const t of this.highlighted) {
      try {
        t.setHighlight(null);
      } catch {
        /* tile gone */
      }
    }
    this.highlighted = [];
    this.idleZones.clear();
    v.hand.setPlayable([]);
    v.hud.setButtons({ battle: false, endTurn: false, attention: null });
    this.scene.input.setDefaultCursor('default');
  }

  // ================================================================ inspect pin

  private pin(id: CardId | null, stats: InspectStats = {}): void {
    this.pinned = { id, stats };
    this.views.inspect.show(id, stats);
  }

  private unpin(): void {
    if (!this.pinned) return;
    this.pinned = null;
    if (!this.hoverKey) this.views.inspect.hide();
  }

  // ================================================================ board picking / hover

  /**
   * What is under a screen point: a unit body first (front-most), else the tile. While the
   * player is choosing among highlighted zones (or idle with actionable zones), a hit that is a
   * valid choice wins over one that is not — a big monster (Kristal Ejder's wings) covering the
   * tile behind it must not make that tile unclickable.
   * v3: the body of a candidate (front-most) wins over a candidate tile, so a red monster standing
   * behind a blue one is picked by its own visible pixels, not by the tile under them; when idle, a
   * body in front also wins over an actionable tile it covers (hover inspects what is seen).
   */
  pick(sx: number, sy: number): Pick | null {
    const w = this.views.camera.worldPoint(sx, sy);
    const units = this.views.field.units().filter((u) => u.sprite.visible && !u.retired);
    units.sort((a, b) => b.sprite.depth - a.sprite.depth);
    const hits: Pick[] = [];
    for (const u of units) {
      const s = u.sprite;
      const b = s.getBounds();
      if (!b.contains(w.x, w.y)) continue;
      const fx = Math.floor((s.flipX ? b.right - w.x : w.x - b.left) / Math.abs(s.scaleX));
      const fy = Math.floor((w.y - b.top) / Math.abs(s.scaleY));
      if (this.framePixelAlpha(s, fx, fy) > 0) hits.push({ player: u.player, spot: 'monster', index: u.zone });
    }
    const z = this.views.board.zoneAt(w.x, w.y);
    const tile: Pick | null = z ? { player: z.player, spot: z.spot, index: z.index } : null;
    const valid = this.validPick();
    if (valid) {
      if (LOOK_V3) {
        // v3: a valid body (front-most, even one partly covered by a non-valid body) first; then
        // in a board pick the valid tile, in idle whatever body is in front (what the player sees)
        const v = hits.find(valid);
        if (v) return v;
        if (tile && valid(tile) && (this.zoneHover || !hits.length)) return tile;
      } else {
        // the tile itself first (it is what the player aims at), then any unit body
        if (tile && valid(tile)) return tile;
        const v = hits.find(valid);
        if (v) return v;
      }
    }
    return hits[0] ?? tile;
  }

  /**
   * Alpha of the pixel (fx, fy) of a sprite's FULL frame (realWidth × realHeight). Phaser's
   * getPixelAlpha takes full-frame coordinates and removes a trimmed frame's offset (frame.x/y,
   * v3 cropped atlas) itself, so the coordinates go in as they are (do not subtract it twice).
   */
  private framePixelAlpha(s: Phaser.GameObjects.Sprite, fx: number, fy: number): number {
    return this.scene.textures.getPixelAlpha(fx, fy, s.texture.key, s.frame.name) ?? 0;
  }

  /** The "is this a meaningful click right now" test used by pick(), or null. */
  private validPick(): ((h: Pick) => boolean) | null {
    const zh = this.zoneHover;
    if (zh) return (h) => zh.refs.some((r) => r.player === h.player && r.zone === h.spot && r.index === h.index);
    if (this.mode === 'idle' && this.idleZones.size) return (h) => this.idleZones.has(refKey(h));
    return null;
  }

  /** World point → screen point (menus are screen-space; the world camera may be zoomed). */
  private screenPoint(p: { x: number; y: number }): { x: number; y: number } {
    const cam = this.views.camera.main;
    return { x: Math.round((p.x - cam.worldView.x) * cam.zoom), y: Math.round((p.y - cam.worldView.y) * cam.zoom) };
  }

  private endZoneHover(): void {
    this.zoneHover = null;
    this.scene.input.setDefaultCursor('default');
  }

  private hover(sx: number, sy: number): void {
    const inHand = sy >= 284 && sx >= 160 && sx <= 480;
    // v3 (K12): the other player's mini-hand by its panel
    const mini = V3_A6_B && !inHand ? this.miniAt(sx, sy) : null;
    const h = inHand || mini !== null ? null : this.pick(sx, sy);
    this.hoverPick = LOOK_V3 && !inHand && mini === null ? { x: sx, y: sy, ctx: this.zoneHover, st: this.state, mode: this.mode, hit: h } : null;
    // board pick feedback: the candidate under the pointer lights up white
    const zh = this.zoneHover;
    if (inHand) {
      // the hand band drives its own cursor / hover
    } else if (zh) {
      const hot = h ? (zh.refs.find((r) => r.player === h.player && r.zone === h.spot && r.index === h.index) ?? null) : null;
      const k = hot ? refKey(hot) : '';
      if (k !== zh.hot) {
        const prev = zh.refs.find((r) => refKey(r) === zh.hot);
        const board = this.views.board;
        // v3 (F4): a candidate with corners has no floor highlight to light; its corners settle in
        // under the pointer instead (and say ui3Aim themselves)
        const aim = this.aim;
        if (prev && this.mode !== 'tribute' && !aim?.has(prev)) board.highlightZone(prev.player, prev.zone, prev.index, zh.color);
        if (hot && this.mode !== 'tribute' && !aim?.has(hot)) board.highlightZone(hot.player, hot.zone, hot.index, PAL.white);
        zh.hot = k;
        if (aim) aim.setHot(hot && aim.has(hot) ? hot : null);
        if (hot && !(aim && aim.has(hot))) sfx.play('uiHover', { volume: 0.3, pitch: 1.3 });
      }
      this.scene.input.setDefaultCursor(hot ? 'pointer' : 'default');
    } else if (this.mode === 'idle') {
      this.scene.input.setDefaultCursor(h && this.idleZones.has(refKey(h)) ? 'pointer' : 'default');
    }
    if (inHand) return; // the hand band handles its own hover
    const key = mini !== null ? `mini:${mini}` : h ? refKey(h) : '';
    if (key === this.hoverKey) return;
    this.hoverKey = key;
    const v = this.views;
    const s = this.state ?? null;
    const back = () => (this.pinned ? v.inspect.show(this.pinned.id, this.pinned.stats) : v.inspect.hide());
    if (mini !== null && s) return void (showPile(v.inspect, 'hand', mini, s.players[mini].hand.length) || back());
    if (!h || !s) return back();
    const ps = s.players[h.player];
    if (h.spot === 'monster') {
      const slot = ps.monsters[h.index];
      if (!slot) return back();
      const id = s.cards[slot.uid].cardId;
      if (!slot.faceUp) return v.inspect.show(h.player === v.hand.owner ? id : null);
      return v.inspect.show(id, this.plateStats(s, slot.uid, v.field.unit(slot.uid)));
    }
    if (h.spot === 'spellTrap') {
      const st = ps.spellTraps[h.index];
      if (!st) return back();
      const id = s.cards[st.uid].cardId;
      return v.inspect.show(st.faceUp || h.player === v.hand.owner ? id : null);
    }
    if (h.spot === 'field') {
      const fs = ps.fieldSpell;
      return fs ? v.inspect.show(s.cards[fs.uid].cardId) : back();
    }
    if (h.spot === 'graveyard') {
      const g = ps.graveyard;
      if (g.length) return v.inspect.show(s.cards[g[g.length - 1]].cardId);
      // v3 (K12): an empty graveyard says so ("Mezarlık · 0 kart")
      if (V3_A6_B && showPile(v.inspect, 'graveyard', h.player, 0)) return;
      return back();
    }
    // v3 (K12 / S-9): a deck shows its count, never its cards
    if (V3_A6_B && h.spot === 'deck' && showPile(v.inspect, 'deck', h.player, ps.deck.length)) return;
    back();
  }

  // ================================================================ v3 (lane A6-B): reject, graveyard, mini-hand

  /** F5: answer an invalid click on the board spot `h` where the click landed (v3 only). */
  private rejectHit(h: { player: PlayerId; spot: BoardSpot; index: number } | null): void {
    if (!V3_A6_B) return;
    const at = this.lastClick;
    if (!at) return;
    const w = this.views.camera.worldPoint(at.x, at.y);
    const unit = h && h.spot === 'monster' ? this.views.field.unitAt(h.player, h.index) : null;
    rejectClick(this.scene, this.views, w, { tile: h, unit, selected: this.sel });
  }

  /** zoneFlow's "nothing to do there": the F5 answer in v3; null either way. */
  private refuse(ref: ZoneRef): null {
    if (V3_A6_B) this.rejectHit({ player: ref.player, spot: ref.zone, index: ref.index });
    return null;
  }

  /**
   * K11 (v3): open `player`'s graveyard panel (lane A6-A's, S-9) when no cinematic plays (or the duel
   * is over) and no menu / prompt / picker holds the screen. True when the click was taken.
   */
  private openGrave(player: PlayerId, via: 'mouse' | 'key'): boolean {
    if (!V3_A6_B) return false;
    const s = this.state;
    if (!s) return false;
    if (gravePanelOpen(this.scene)) return true;
    if (s.winner === null && this.busy()) return false;
    if (this.pauseOpen || this.views.menu.isOpen) return false;
    if (this.mode === 'menu' || this.mode === 'pause' || this.mode === 'trap' || this.mode === 'cards' || this.mode === 'curtain') return false;
    this.graveOpens++;
    if (via === 'mouse') ackClick(this.scene, this.views, { player, spot: 'graveyard', index: 0 });
    const cards = s.players[player].graveyard.map((u) => s.cards[u].cardId);
    void openGravePanel(this.scene, this.views, player, { cards, via }).catch((e) => console.error('[input] graveyard panel', e));
    return true;
  }

  /** K12 (v3): the other player's mini-hand under a screen point (by its panel; 9×13 backs, 7 px apart). */
  private miniAt(sx: number, sy: number): PlayerId | null {
    const s = this.state;
    if (!s) return null;
    const q: PlayerId = this.views.hand.owner === 0 ? 1 : 0;
    const n = Math.min(10, s.players[q].hand.length);
    if (!n) return null;
    const r = panelRect(q);
    const cx = r.x + r.w / 2;
    const half = Math.ceil(((n - 1) * 7) / 2) + 5;
    const y0 = q === 0 ? r.y - 12 : r.y + r.h - 2;
    const y1 = q === 0 ? r.y + 2 : r.y + r.h + 12;
    return sx >= cx - half && sx <= cx + half && sy >= y0 && sy <= y1 ? q : null;
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

/** Main Phase 2 would offer `p` something to do (a summon, a set, a spell, a position change, an effect). */
function main2Offers(s: GameState, p: PlayerId): boolean {
  if (s.phase !== 'battle') return false;
  return legalActions({ ...s, phase: 'main2' }).some((a) => a.player === p && a.type !== 'endTurn' && a.type !== 'surrender');
}
