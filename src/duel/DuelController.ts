// DuelController — the turn loop: asks the acting player (human UI or CPU) for an Action, applies
// it to the engine, plays the resulting events through the Director, repeats until game over.
//
//   const c = new DuelController(scene, views, director, state, { cpu: [1] });
//   void c.run();
//   await c.dispatch(action);   // QA: inject an action for whoever acts (validated)
//   c.auto = true;              // QA: the CPU plays every player
//
// Input is locked while cinematics play. Hot-seat privacy is handled by views.info (curtain
// before a different human sees their hand).
// v3, lane A6-B (V3_A6_B; docs/v3/A6_PLAN.md K11, open question S3): while a graveyard panel is open the
// computer still thinks, then holds its move until the panel closes; HumanInput learns when a cinematic
// plays (input.busy) so the panel only opens between them.

import Phaser from 'phaser';
import { actingPlayer, apply, chooseAction, isLegal } from '../engine';
import type { Action, GameEvent, GameState, PlayerId } from '../engine/types';
import { sfx } from '../audio/sfx';
import { loadSettings } from '../scenes/launch';
import { wait } from '../vfx/core';
import type { Director } from '../cinematics/_core/Director';
import type { DuelViews } from './types';
import { HumanInput } from './HumanInput';
import { V3_A6_B } from '../view/v3flags';
import { gravePanelOpen, whenGravePanelClosed } from '../view/v3/GravePanel';

interface Mail {
  action: Action;
  resolve: () => void;
  reject: (e: unknown) => void;
}

export interface ControllerOpts {
  /** Players the CPU controls. */
  cpu: PlayerId[];
  /** Seed for the CPU's tie-breaking. */
  seed: number;
  /** Called when the game is over and the result screen was dismissed. */
  onGameOver?: (winner: PlayerId) => void | Promise<void>;
}

export class DuelController {
  readonly scene: Phaser.Scene;
  readonly views: DuelViews;
  readonly director: Director;
  readonly input: HumanInput;
  state: GameState;
  /** QA: the CPU plays for everyone. */
  auto = false;
  private readonly cpu: Set<PlayerId>;
  private seed: number;
  private mail: Mail[] = [];
  private wakeMail: (() => void) | null = null;
  private running = false;
  private playing = false;
  private stopped = false;
  private readonly opts: ControllerOpts;
  /** Resolves every time the controller starts waiting for an action (interactive). */
  private idleWaiters: (() => void)[] = [];
  lastEvents: GameEvent[] = [];

  constructor(scene: Phaser.Scene, views: DuelViews, director: Director, state: GameState, opts: ControllerOpts) {
    this.scene = scene;
    this.views = views;
    this.director = director;
    this.state = state;
    this.cpu = new Set(opts.cpu);
    this.seed = opts.seed >>> 0;
    this.opts = opts;
    this.input = new HumanInput(scene, views);
    this.input.setState(state);
    if (V3_A6_B) this.input.busy = () => this.busy;
    this.input.onQuit = () => this.quit();
    views.info.onCurtain = (on) => this.input.setCurtain(on);
    // the toolbar's sound switch starts from what is actually audible
    views.hud.setSoundOn(!sfx.isMuted() && loadSettings().sound);
    // vs CPU: say who the computer is
    if (views.info.mode === 'vsBot') for (const p of opts.cpu) views.hud.setPlayerName(p, 'BİLGİSAYAR');
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stop());
  }

  /** True while a cinematic plays (input locked). */
  get busy(): boolean {
    return this.playing || this.director.busy;
  }

  isCpu(p: PlayerId): boolean {
    return this.auto || this.cpu.has(p);
  }

  /** Leave the duel for the title menu (düello menüsü → Ana Menüye Dön). */
  quit(): void {
    if (this.stopped || !this.scene.sys.isActive()) return;
    sfx.play('uiBack');
    this.stop();
    this.director.dropKept();
    this.views.hud.setHint(null);
    this.scene.scene.start('Title', { from: 'duel' });
  }

  stop(): void {
    this.stopped = true;
    this.input.cancel();
    for (const m of this.mail.splice(0)) m.reject(new Error('duel stopped'));
    this.wakeMail?.();
  }

  /** Resolves when the controller next waits for an action (or immediately if it does). */
  whenIdle(): Promise<void> {
    if (this.running && !this.busy && this.waitingAction) return Promise.resolve();
    return new Promise((r) => this.idleWaiters.push(r));
  }

  private waitingAction = false;

  /** Queue an action for the acting player. Resolves after its cinematics played. */
  dispatch(action: Action): Promise<void> {
    if (this.state.winner !== null) return Promise.reject(new Error('the game is over'));
    return new Promise<void>((resolve, reject) => {
      this.mail.push({ action, resolve, reject });
      // interrupt a human / CPU wait
      this.input.cancel();
      this.wakeMail?.();
    });
  }

  /** The main loop. */
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    while (!this.stopped && this.scene.sys.isActive()) {
      if (this.state.winner !== null) {
        this.flushIdle();
        await this.finish();
        return;
      }
      const p = actingPlayer(this.state);
      const next = await this.nextAction(p);
      if (this.stopped) return;
      if (!next) continue;
      await this.execute(next.action, next.mail);
    }
  }

  private async nextAction(p: PlayerId): Promise<{ action: Action; mail: Mail | null } | null> {
    const m = this.mail.shift();
    if (m) return { action: m.action, mail: m };
    this.waitingAction = true;
    this.flushIdle();
    try {
      const mailArrived = new Promise<null>((r) => (this.wakeMail = () => r(null)));
      if (this.isCpu(p)) {
        this.views.hud.setButtons({ battle: false, endTurn: false, attention: null });
        this.cpuHint(p);
        const think = wait(this.scene, this.state.pending ? 380 : 520).then(() => 'go' as const);
        const r = await Promise.race([think, mailArrived]);
        if (r === null || this.stopped) return null;
        // v3 (K11 / S3): the graveyard panel is open — the computer has thought; it moves once it closes
        if (V3_A6_B && gravePanelOpen(this.scene)) {
          const g = await Promise.race([whenGravePanelClosed(this.scene).then(() => 'go' as const), mailArrived]);
          if (g === null || this.stopped) return null;
        }
        try {
          return { action: chooseAction(this.state, this.seed++), mail: null };
        } catch (e) {
          console.error('[duel] CPU failed to choose', e);
          return null;
        }
      }
      // a human acts: make sure their hand is the one on screen (hot-seat curtain)
      const pd = this.state.pending;
      // (v3 A6-B, F7: a trap question's curtain says so)
      if (!pd || pd.kind !== 'chooseTarget') await this.director.userWait(this.views.info.ensureViewer(p, { trap: pd?.kind === 'trapResponse' }));
      if (this.mail.length || this.stopped) return null;
      this.input.setState(this.state);
      const a = await Promise.race([this.director.userWait(this.input.waitAction(this.state, p)), mailArrived]);
      if (!a) return null;
      // v3 (A6-B, F7 / KO-11): a trap question answered in hot-seat — the defender's hand turns face down
      // before the attacker's battle goes on (nothing outside v3 lane B with the curtain)
      if (V3_A6_B && pd && pd.kind === 'trapResponse' && a.type === 'respond' && pd.player !== this.state.activePlayer) {
        await this.views.info.coverAfterAnswer(p);
        if (this.stopped) return null;
      }
      return { action: a, mail: null };
    } finally {
      this.waitingAction = false;
      this.wakeMail = null;
    }
  }

  private async execute(action: Action, mail: Mail | null): Promise<void> {
    const before = this.state;
    let res;
    try {
      if (!isLegal(before, action)) throw new Error(`illegal action ${JSON.stringify(action)}`);
      res = apply(before, action);
    } catch (e) {
      console.warn('[duel] rejected action', action, e);
      mail?.reject(e);
      return;
    }
    this.state = res.state;
    this.input.setState(res.state);
    this.lastEvents = res.events;
    this.playing = true;
    this.lock(true, action.player);
    try {
      await this.director.play(res.events, before, res.state);
    } finally {
      this.playing = false;
      this.lock(false);
    }
    mail?.resolve();
  }

  /** The guidance line while the CPU decides (vs CPU) or while the demo plays. */
  private cpuHint(p: PlayerId): void {
    const v = this.views;
    if (v.info.mode === 'demo' || this.auto) v.hud.setHint('İzleme modu · Esc: menü', { style: 'gold' });
    else v.hud.setHint(this.state.pending ? 'Bilgisayar düşünüyor…' : 'Sıra bilgisayarda…', { player: p });
  }

  private lock(b: boolean, actor?: PlayerId): void {
    const v = this.views;
    v.hand.setEnabled(!b);
    v.hud.setLocked(b);
    if (b) v.hud.setButtons({ battle: false, endTurn: false, attention: null });
    // cinematics speak for themselves; the demo keeps its "how to leave" line and the CPU's
    // turn keeps "Sıra bilgisayarda…" (no flicker between its moves)
    const cpuTurnGoesOn = actor !== undefined && this.isCpu(actor) && this.state.winner === null && this.isCpu(actingPlayer(this.state));
    if (b && (this.state.winner !== null || (v.info.mode !== 'demo' && !this.auto && !cpuTurnGoesOn))) v.hud.setHint(null);
    v.speed.canHold = () => this.busy;
  }

  private flushIdle(): void {
    for (const r of this.idleWaiters.splice(0)) r();
  }

  private async finish(): Promise<void> {
    const w = this.state.winner;
    if (w === null) return;
    this.views.hud.setButtons({ battle: false, endTurn: false, attention: null });
    this.views.hud.setHint(null);
    await this.opts.onGameOver?.(w);
  }
}
