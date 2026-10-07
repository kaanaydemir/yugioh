// DuelScene (key 'Duel') — the duel screen. Builds every view, starts a game (newGame, a fixed
// deck order, or a staged board), plays the opening through the Director and runs the
// DuelController (hot-seat / vs CPU / CPU-vs-CPU demo).
//
//   scene.start('Duel', { mode: 'vsBot', seed: 7 } as DuelLaunch)
//   ?mode=demo&seed=1&skipIntro=1[&speed=3][&curtain=0][&loop=1]   (BootScene → launchFromUrl)
//
// QA hooks: window.__neon.duel (see installQa below and docs in the report).

import Phaser from 'phaser';
import type { CardId } from '../data/cards';
import { legalActions, newGame } from '../engine';
import { actingPlayer } from '../engine';
import type { Action, GameEvent, GameState, NewGameOptions, PlayerId } from '../engine/types';
import { volcanoActive } from '../engine/query';
import { PAL } from '../art/palette';
import { music, sfx } from '../audio/sfx';
import { ActionMenu } from '../view/ActionMenu';
import { BoardView } from '../view/BoardView';
import { Button } from '../view/Button';
import { HandView } from '../view/HandView';
import { HudView } from '../view/HudView';
import { InspectPanel } from '../view/InspectPanel';
import { LogView } from '../view/LogView';
import { Prompt } from '../view/Prompt';
import { DEPTH, GAME_W } from '../view/layout';
import { ICON } from '../view/ui-textures';
import { setVolcanoAmbience, volcanoAmbienceOn } from '../vfx/setpieces';
import { Director, loadCinematics } from '../cinematics';
import { listHandlers } from '../cinematics/_core/registry';
import { rewindNewGame } from '../cinematics/_core/project';
import { CameraRig } from '../duel/CameraRig';
import { DuelController } from '../duel/DuelController';
import { createDuelists } from '../duel/DuelistView';
import { FieldView } from '../duel/FieldView';
import { SpeedControl } from '../duel/speed';
import { ViewerPolicy } from '../duel/viewer';
import { buildStage, uidOf, type StageSpec } from '../duel/scenario';
import { SCENARIOS } from '../duel/scenarios';
import { armOnFreeze, installTestClock } from '../duel/testClock';
import type { DuelViews } from '../duel/types';
import { loadSettings, saveSettings, type DuelLaunch, type DuelMode, type Settings } from './launch';

/** Everything DuelScene accepts (DuelLaunch + QA extras). */
export interface DuelStart extends DuelLaunch {
  /** Fixed decks (decks[i][0] drawn first with noShuffle). */
  decks?: [CardId[], CardId[]];
  noShuffle?: boolean;
  /** Start from a staged board instead of a new game (no opening). */
  stage?: StageSpec;
  /** Start from an explicit engine state (no opening). */
  state?: GameState;
  /** Override the hot-seat curtain setting (QA: false). */
  curtain?: boolean;
  /** Override the animation speed (1, 2, 3...). */
  speed?: number;
  /** The CPU plays every player (QA). */
  auto?: boolean;
  /** Demo: start a new game automatically after game over. */
  loop?: boolean;
  /** QA films: report ready at once and start the opening on the next freeze() (?holdIntro=1). */
  holdOpening?: boolean;
  /** Run a named scenario's steps (src/duel/scenarios.ts) once the duel is interactive. */
  scenario?: string;
  /** With `scenario`: start the steps on the next freeze() (deterministic films). */
  filmScenario?: boolean;
}

export interface DuelQa {
  state(): GameState;
  legal(): Action[];
  /** Apply an action for the acting player (player may be omitted), play its cinematics, sync. */
  dispatch(action: Action | (Omit<Action, 'player'> & { player?: PlayerId })): Promise<void>;
  /** Like dispatch, but starts on the next freeze() (deterministic --film of that action). */
  dispatchOnFreeze(action: Action | (Omit<Action, 'player'> & { player?: PlayerId })): void;
  /** The CPU plays whoever acts (true) / humans play again (false). */
  auto(on?: boolean): void;
  /** Restart the duel; resolves when the new duel waits for its first action. */
  restart(opts?: Partial<DuelStart> & Partial<NewGameOptions>): Promise<void>;
  busy(): boolean;
  lastEvents(): GameEvent[];
  /** Resolves when the controller waits for the next action. */
  idle(): Promise<void>;
  /** uid of a card in the current state (not in a deck). */
  uid(cardId: CardId, owner?: PlayerId): number;
  /** Stage a named scenario (src/duel/scenarios.ts) and play its steps (film: on the next freeze). */
  scenario(name: string, opts?: { film?: boolean; speed?: number }): Promise<void>;
  /** Names + descriptions of the scenarios. */
  scenarios(): Record<string, string>;
  /** Cinematic handler errors / watchdog timeouts so far. */
  errors(): { handlers: unknown[]; timeouts: string[] };
  handlers(): ReturnType<typeof listHandlers>;
  views: DuelViews;
  launch: DuelStart;
}

const restartWaiters: (() => void)[] = [];

/** Resolves when the next DuelScene becomes interactive (waits for its first action). */
export function duelReady(): Promise<void> {
  return new Promise((r) => restartWaiters.push(r));
}

async function runSteps(name: string): Promise<void> {
  const sc = SCENARIOS[name];
  if (!sc) throw new Error(`unknown scenario ${name}`);
  for (const st of sc.steps) {
    const D = (window.__neon as unknown as { duel: DuelQa }).duel;
    const a = typeof st === 'function' ? st(D) : st;
    if (a) await D.dispatch(a);
  }
}

export class DuelScene extends Phaser.Scene {
  private launchData!: DuelStart;
  views!: DuelViews;
  director!: Director;
  controller!: DuelController;
  private settings!: Settings;
  private last = { turn: -1, active: -1 as number, phase: '' as string, counts: ['', ''] as string[] };

  constructor() {
    super('Duel');
  }

  init(data: Partial<DuelStart>): void {
    this.launchData = { mode: 'hotseat', ...(data ?? {}) } as DuelStart;
  }

  async create(): Promise<void> {
    const params = (this.registry.get('params') as URLSearchParams | undefined) ?? new URLSearchParams(location.search);
    if (params.has('test')) installTestClock();
    const L = this.launchData;
    // URL extras (QA)
    if (L.speed === undefined && params.get('speed')) L.speed = Number(params.get('speed')) || undefined;
    if (L.curtain === undefined && params.get('curtain') !== null) L.curtain = params.get('curtain') !== '0';
    if (L.loop === undefined && params.get('loop') === '1') L.loop = true;
    if (L.holdOpening === undefined && params.get('holdIntro') === '1') L.holdOpening = true;
    this.settings = loadSettings();
    const mode: DuelMode = L.mode ?? 'hotseat';
    const cpu: PlayerId[] = mode === 'demo' ? [0, 1] : mode === 'vsBot' ? [L.botPlayer ?? 1] : [];
    const seed = L.seed ?? (Date.now() & 0x7fffffff);
    L.seed = seed;

    // ---- the game
    let state: GameState;
    let events: GameEvent[] = [];
    let before: GameState;
    const staged = !!(L.state || L.stage);
    if (L.state) {
      state = structuredClone(L.state);
      before = state;
    } else if (L.stage) {
      state = buildStage(L.stage);
      before = state;
    } else {
      const r = newGame({ seed, firstPlayer: L.firstPlayer, decks: L.decks, noShuffle: L.noShuffle });
      state = r.state;
      events = r.events;
      before = rewindNewGame(state, events);
    }
    const skipIntro = !!L.skipIntro || staged;
    const first = state.activePlayer;

    // ---- views
    this.cameras.main.setBackgroundColor(PAL.night0);
    const camera = new CameraRig(this);
    const board = new BoardView(this, { active: staged ? state.activePlayer : null, lights: skipIntro });
    const field = new FieldView(this);
    const speedBase = L.speed ?? this.settings.speed;
    const hud = new HudView(this, { active: first, turn: state.turn, phase: staged ? state.phase : 'draw', speed: (Math.min(3, Math.max(1, Math.round(speedBase))) as 1 | 2 | 3), lp: [before.players[0].lp, before.players[1].lp] });
    const curtain = L.curtain ?? this.settings.curtain;
    const humanFirst = mode === 'vsBot' ? (([0, 1] as PlayerId[]).find((p) => !cpu.includes(p)) ?? 0) : first;
    const hand = new HandView(this, { owner: humanFirst, faceDown: mode === 'hotseat' && curtain && !staged });
    const inspect = new InspectPanel(this);
    const menu = new ActionMenu(this);
    const prompt = new Prompt(this);
    const log = new LogView(this);
    const duelists = createDuelists(this);
    const speed = new SpeedControl(this, speedBase);
    const info = new ViewerPolicy({ mode, cpu, curtain, hand, hud, prompt });
    if (L.auto) info.auto = true;
    this.views = { board, field, hud, hand, inspect, prompt, menu, log, camera, duelists, info, speed };
    hud.onSpeed = (k) => {
      this.settings.speed = k;
      saveSettings(this.settings);
      speed.setBase(k);
    };
    hud.onSound = (muted) => {
      this.settings.sound = !muted;
      saveSettings(this.settings);
    };
    hud.onLog = () => log.toggle();
    this.director = new Director({ scene: this, views: this.views, mode, skipIntro, settings: this.settings, sync: (s, final) => this.syncAll(s, final) });
    info.userWait = (p) => {
      // waiting for a person (pass-device curtain) counts as interactive for QA tools
      window.__neon.ready = true;
      return this.director.userWait(p);
    };
    this.controller = new DuelController(this, this.views, this.director, state, {
      cpu,
      seed: seed ^ 0x5bd1e995,
      onGameOver: (w) => this.gameOver(w),
    });
    if (L.auto) this.controller.auto = true;
    this.last = { turn: -1, active: -1, phase: '', counts: ['', ''] };
    this.syncAll(before, true);
    if (staged) {
      board.setActivePlayer(state.activePlayer, false);
      hud.setActive(state.activePlayer, false);
      hud.setTurn(state.turn, false);
    }
    if (!skipIntro && events.length) {
      // the opening starts high above the arena with the HUD hidden (gameStart descends)
      camera.main.setScroll(0, -300);
      hud.setVisible(false);
      duelists?.setVisible(false);
    }
    this.installQa();

    try {
      await loadCinematics();
    } catch (e) {
      console.error('[duel] cinematics failed to load', e);
    }
    if (!this.sys.isActive()) return;
    if (L.holdOpening) {
      window.__neon.ready = true;
      await new Promise<void>((r) => armOnFreeze(r));
    }
    if (events.length) await this.director.play(events, before, state);
    else {
      if (this.settings.music) music.play('duel');
      if (staged) await info.ensureViewer(actingPlayer(state));
    }
    if (!this.sys.isActive()) return;
    void this.controller.run();
    void this.controller.whenIdle().then(() => {
      if (L.scenario) {
        const name = L.scenario;
        if (L.filmScenario) armOnFreeze(() => void runSteps(name).catch((e) => console.error('[duel] scenario failed', e)));
        else void runSteps(name).catch((e) => console.error('[duel] scenario failed', e));
      }
      window.__neon.ready = true;
      for (const r of restartWaiters.splice(0)) r();
    });
  }

  // ================================================================ sync

  /** Reconcile every view with `state` instantly (Director: after each event and each batch). */
  syncAll(state: GameState, final: boolean): void {
    try {
      this.syncViews(state, final);
    } catch (e) {
      console.error('[duel] sync failed', e);
    }
  }

  private syncViews(state: GameState, final: boolean): void {
    const v = this.views;
    if (!v) return;
    v.field.sync(state);
    // HUD
    for (const p of [0, 1] as PlayerId[]) {
      const ps = state.players[p];
      if (v.hud.getLp(p) !== ps.lp) void v.hud.setLp(p, ps.lp, false);
      const counts = { deck: ps.deck.length, hand: ps.hand.length, grave: ps.graveyard.length };
      const key = `${counts.deck}/${counts.hand}/${counts.grave}`;
      if (this.last.counts[p] !== key) {
        v.hud.setCounts(p, counts, this.last.counts[p] !== '');
        this.last.counts[p] = key;
      }
    }
    if (this.last.active !== state.activePlayer) {
      if (this.last.active !== -1) v.hud.setActive(state.activePlayer, false);
      this.last.active = state.activePlayer;
    }
    if (this.last.turn !== state.turn) {
      if (this.last.turn !== -1) v.hud.setTurn(state.turn, false);
      this.last.turn = state.turn;
    }
    if (v.hud.currentPhase !== state.phase && final) void v.hud.setPhase(state.phase, state.activePlayer, false);
    // hands: the viewer's cards + the other player's mini-hand
    const owner = v.hand.owner;
    const mine = state.players[owner].hand;
    const shown = v.hand.uids;
    if (mine.length !== shown.length || mine.some((u, i) => shown[i] !== u)) {
      v.hand.setCards(mine.map((uid) => ({ uid, cardId: state.cards[uid].cardId })), owner);
    }
    const o: PlayerId = owner === 0 ? 1 : 0;
    v.hand.setCards(state.players[o].hand.map((uid) => ({ uid, cardId: state.cards[uid].cardId })), o);
    if (final) {
      if (v.board.activePlayer !== state.activePlayer && state.turn > 0 && this.last.turn !== -1) v.board.setActivePlayer(state.activePlayer, false);
      const hot = volcanoActive(state);
      if (hot !== (v.board.theme === 'volcano')) void v.board.setTheme(hot ? 'volcano' : 'normal', false);
      if (hot !== volcanoAmbienceOn(this)) void setVolcanoAmbience(this, hot);
    }
    this.controller?.input.setState(state);
  }

  // ================================================================ game over

  private async gameOver(winner: PlayerId): Promise<void> {
    const L = this.launchData;
    const v = this.views;
    const reason = this.controller.state.winReason ?? undefined;
    if (L.loop) {
      await this.director.userWait(new Promise<void>((r) => this.time.delayedCall(3500, r)));
      void this.restartDuel({ seed: (L.seed ?? 0) + 1 });
      return;
    }
    // "Ana Menü" next to the prompt's "Tekrar Oyna"
    const back = new Button(this, Math.round(GAME_W / 2 - 64), 254, { w: 128, h: 20, label: 'Ana Menü', size: 'sm', icon: ICON.close, style: 'neutral', depth: DEPTH.OVERLAY + 5 });
    back.setScrollFactor(0).setAlpha(0);
    this.time.delayedCall(1300, () => {
      if (back.active) this.tweens.add({ targets: back, alpha: 1, duration: 260 });
    });
    let toTitle = false;
    const goTitle = () => {
      toTitle = true;
      sfx.play('uiBack');
      this.scene.start('Title', { from: 'duel' });
    };
    back.onClick = goTitle;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') goTitle();
    };
    window.addEventListener('keydown', onKey);
    try {
      await this.director.userWait(v.prompt.gameOver(winner, reason));
    } finally {
      window.removeEventListener('keydown', onKey);
    }
    if (toTitle || !this.sys.isActive()) return;
    back.destroy();
    void this.restartDuel({ seed: (L.seed ?? 0) + 1 });
  }

  /** Restart with the same mode (and options), overriding some. */
  restartDuel(opts: Partial<DuelStart> & Partial<NewGameOptions> = {}): void {
    const L = this.launchData;
    const keep: Partial<DuelStart> = { mode: L.mode, botPlayer: L.botPlayer, skipIntro: L.skipIntro, speed: L.speed, curtain: L.curtain, auto: L.auto, loop: L.loop };
    const next: DuelStart = { ...keep, ...opts } as DuelStart;
    if (!opts.stage && !opts.state && !opts.decks && opts.seed === undefined) next.seed = (L.seed ?? 0) + 1;
    this.controller?.stop();
    this.director?.dropKept();
    this.scene.restart(next);
  }

  // ================================================================ QA

  private installQa(): void {
    const scene = this;
    const withPlayer = (a: Action | (Omit<Action, 'player'> & { player?: PlayerId })): Action => {
      const s = scene.controller.state;
      return ('player' in a && a.player !== undefined ? a : { ...a, player: actingPlayer(s) }) as Action;
    };
    const qa: DuelQa = {
      state: () => scene.controller.state,
      legal: () => legalActions(scene.controller.state),
      dispatch: (a) => scene.controller.dispatch(withPlayer(a)),
      dispatchOnFreeze: (a) => armOnFreeze(() => void scene.controller.dispatch(withPlayer(a)).catch((e) => console.error('[qa] dispatch failed', e))),
      auto: (on = true) => {
        scene.controller.auto = on;
        scene.views.info.auto = on;
        scene.controller.input.cancel();
      },
      restart: (opts = {}) =>
        new Promise<void>((resolve) => {
          restartWaiters.push(resolve);
          scene.restartDuel(opts);
        }),
      busy: () => scene.controller.busy,
      lastEvents: () => scene.controller.lastEvents,
      idle: () => scene.controller.whenIdle(),
      uid: (cardId, owner) => uidOf(scene.controller.state, cardId, owner),
      scenario: async (name, o = {}) => {
        const sc = SCENARIOS[name];
        if (!sc) throw new Error(`unknown scenario ${name}`);
        await qa.restart({ mode: 'hotseat', curtain: false, stage: sc.stage, speed: o.speed });
        if (o.film) armOnFreeze(() => void runSteps(name).catch((e) => console.error('[duel] scenario failed', e)));
        else await runSteps(name);
      },
      scenarios: () => Object.fromEntries(Object.entries(SCENARIOS).map(([k, v]) => [k, v.desc])),
      errors: () => ({ handlers: [...scene.director.errors], timeouts: [...scene.director.timeouts] }),
      handlers: () => listHandlers(),
      views: scene.views,
      launch: scene.launchData,
    };
    (window.__neon as Record<string, unknown>).duel = qa;
  }
}
