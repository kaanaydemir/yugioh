// Title screen: animated NEON DÜELLO logotype over the arena, a monster showcase, the main
// menu and its sub-screens (how to play, card gallery, settings), and the wipe into the duel.
//
// Layers: the arena (BoardView) and the showcase live in world space and drift with the title
// camera; logo, prompt, menu and overlays are screen-space (scrollFactor 0). Camera shakes from
// the VFX only rattle the world (see title/camera.ts).
import Phaser from 'phaser';
import { PAL } from '../art/palette';
import { music, sfx } from '../audio/sfx';
import { BoardView } from '../view/BoardView';
import { DEPTH } from '../view/layout';
import { tween, wait } from '../vfx/core';
import { pixelText } from '../ui/text';
import { loadSettings, type DuelLaunch, type DuelMode, type Settings } from './launch';
import { Motes, Tagline } from './title/ambient';
import { TitleCamera } from './title/camera';
import { TICON, buildTitleIcons } from './title/icons';
import { TitleLogo, buildLogo } from './title/logo';
import { MainMenu, type MenuEntry } from './title/menu';
import type { Overlay } from './title/overlay';
import { StartPrompt } from './title/prompt';
import { GalleryOverlay } from './title/gallery';
import { HowToOverlay } from './title/howto';
import { SettingsOverlay, applyAudioSettings } from './title/settings';
import { Showcase } from './title/showcase';
import { wipeIn, wipeOut } from './title/transition';

export type TitleScreen = 'attract' | 'menu' | 'howto' | 'gallery' | 'settings';

export interface TitleData {
  /** Jump straight to a screen (dev / QA). */
  at?: TitleScreen;
  page?: number;
  card?: string;
  /** Wait for the shot tool's freeze before starting the intro (deterministic films). */
  sync?: boolean;
  logoOnly?: boolean;
  dev?: boolean;
  /** Coming back from a duel: skip the click-to-start gate. */
  from?: 'duel';
}

/** Camera resting points (scroll) per screen. */
const CAM = {
  sky: { x: 0, y: -150 },
  attract: { x: 0, y: -34 },
  menu: { x: -84, y: -26 },
  overlay: { x: 0, y: 0 },
};

const LOGO_Y = 22;

const ENTRIES: MenuEntry[] = [
  { id: 'hotseat', label: '2 Oyuncu (Aynı Ekran)', desc: 'İki oyuncu aynı ekranda sırayla oynar.', icon: TICON.duo, style: 'p1' },
  { id: 'vsBot', label: 'Bilgisayara Karşı', desc: 'Yapay zekâya karşı düello. Sen Oyuncu 1 olursun.', icon: TICON.bot, style: 'p2' },
  { id: 'demo', label: 'İzle (Demo)', desc: 'İki bilgisayar oyuncusu düello eder. Arkana yaslan!', icon: TICON.eye, style: 'gold' },
  { id: 'howto', label: 'Nasıl Oynanır', desc: 'Aşamalar, çağırma, savaş hesabı ve tuzaklar.', icon: TICON.book, style: 'spell' },
  { id: 'gallery', label: 'Kart Galerisi', desc: '20 kartın tamamı. Canavarları canlı izle.', icon: TICON.cards, style: 'trap' },
  { id: 'settings', label: 'Ayarlar', desc: 'Animasyon hızı, ses, müzik ve sıra perdesi.', icon: TICON.gear, style: 'neutral' },
];

export class TitleScene extends Phaser.Scene {
  private opts: TitleData = {};
  private settings!: Settings;
  private cam!: TitleCamera;
  private board!: BoardView;
  private logo!: TitleLogo;
  private tagline!: Tagline;
  private prompt!: StartPrompt;
  private showcase!: Showcase;
  private motes!: Motes;
  private screen: TitleScreen | 'intro' | 'launch' | 'busy' = 'intro';
  private audioOn = false;
  private menu!: MainMenu;
  private overlay: Overlay | null = null;
  private hints!: Phaser.GameObjects.Container;
  /** Arena floor-FX objects hidden while an overlay is open (they would draw over the panel). */
  private hiddenFloor: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Title');
  }

  init(data: TitleData | undefined): void {
    this.opts = { ...(data ?? {}) };
    // Booted straight into the title (no ?dev): QA options can come from the URL —
    // ?holdIntro=1 (start on the shot tool's freeze), ?title=menu|howto|gallery|settings, &page=, &card=
    if (!this.opts.dev) {
      const params = (this.registry.get('params') as URLSearchParams | undefined) ?? new URLSearchParams(location.search);
      if (params.get('holdIntro') === '1') this.opts.sync = true;
      const at = params.get('title');
      if (!this.opts.at && at && ['attract', 'menu', 'howto', 'gallery', 'settings'].includes(at) && this.opts.from !== 'duel') {
        this.opts.at = at as TitleScreen;
        if (params.has('page')) this.opts.page = Number(params.get('page'));
        if (params.has('card')) this.opts.card = params.get('card') ?? undefined;
      }
    }
    this.screen = 'intro';
    this.audioOn = false;
  }

  /** In sync mode (dev films) resolve once the shot tool has frozen the loop. */
  private whenFrozen(): Promise<void> {
    if (!this.opts.sync) return Promise.resolve();
    return new Promise((resolve) => {
      const t0 = performance.now();
      const h = () => {
        if (!this.game.loop.running || performance.now() - t0 > 30000) {
          this.events.off(Phaser.Scenes.Events.UPDATE, h);
          resolve();
        }
      };
      this.events.on(Phaser.Scenes.Events.UPDATE, h);
    });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PAL.night0);
    this.settings = loadSettings();
    if (this.opts.dev) (window.__neon as Record<string, unknown>).title = this;
    const layout = buildLogo(this);
    const logoX = Math.round((640 - layout.w) / 2);

    if (this.opts.logoOnly) {
      this.logo = new TitleLogo(this, logoX, 60);
      this.game.events.emit('title:ready');
      void this.whenFrozen().then(() => this.logo.reveal()).then(() => this.logo.startIdle());
      return;
    }

    const quick = !!this.opts.at || this.opts.from === 'duel';
    this.board = new BoardView(this, { active: null, lights: quick });
    this.cam = new TitleCamera(this);
    this.cam.snapTo(quick ? CAM.attract.x : CAM.sky.x, quick ? CAM.attract.y : CAM.sky.y);
    this.motes = new Motes(this);
    this.logo = new TitleLogo(this, logoX, LOGO_Y);
    this.tagline = new Tagline(this, 320, LOGO_Y + layout.h + 9);
    this.prompt = new StartPrompt(this, 320, 330);
    this.showcase = new Showcase(this, {
      volume: () => (this.audioOn ? (this.screen === 'attract' ? 1 : 0.6) : 0),
      cutins: () => this.screen === 'attract',
    });
    buildTitleIcons(this);
    this.menu = new MainMenu(this, 14, 108, ENTRIES);
    this.menu.onSelect = (id) => void this.choose(id);
    this.hints = this.buildHints();

    const onDown = () => this.onAnyPress();
    const onKey = (e: KeyboardEvent) => this.onKey(e);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, onDown);
    this.input.keyboard?.on('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off(Phaser.Input.Events.POINTER_DOWN, onDown);
      this.input.keyboard?.off('keydown', onKey);
      this.overlay = null;
      this.hiddenFloor = [];
    });

    this.game.events.emit('title:ready');
    if (!this.opts.dev && window.__neon) window.__neon.ready = true;
    void this.whenFrozen().then(() => (quick ? this.quickStart() : this.intro()));
  }

  // ------------------------------------------------------------ intro / attract

  private async intro(): Promise<void> {
    // the camera tilts down from the night sky while the sign powers up and the floodlights strike
    void this.cam.moveTo(CAM.attract.x, CAM.attract.y, 2600, 'Sine.InOut');
    void wait(this, 380).then(() => this.board.setLights(true, true));
    await this.logo.reveal();
    this.logo.startIdle();
    void this.tagline.show();
    this.showcase.start(150);
    await wait(this, 700);
    this.screen = 'attract';
    await this.prompt.show();
  }

  private async quickStart(): Promise<void> {
    this.logo.showLit();
    this.logo.startIdle();
    void this.tagline.show();
    const at = this.opts.at ?? 'menu';
    if (at === 'attract' && this.opts.from !== 'duel') {
      this.showcase.start(200);
      this.screen = 'attract';
      void this.prompt.show();
      return;
    }
    this.prompt.hide();
    this.audioOn = this.opts.from === 'duel';
    if (this.audioOn) this.unlockAudio();
    if (at === 'menu' || at === 'attract') {
      this.cam.snapTo(CAM.menu.x, CAM.menu.y);
      this.showcase.start(200);
      await this.enterMenu();
      return;
    }
    this.cam.snapTo(CAM.overlay.x, CAM.overlay.y);
    this.screen = 'busy';
    await this.openOverlay(at);
  }

  private unlockAudio(): void {
    sfx.unlock();
    this.audioOn = true;
    applyAudioSettings(this.settings);
  }

  private buildHints(): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(2000).setVisible(false);
    const t = pixelText(this, 320, 348, '↑↓ SEÇ   ·   ENTER ONAYLA   ·   1–6 KISAYOL', { size: 'sm', align: 'center', originX: 0.5, originY: 0.5, color: PAL.steel });
    c.add(t);
    return c;
  }

  // ------------------------------------------------------------ input

  /** QA: feed a key (KeyboardEvent.code) as if pressed. */
  qaKey(code: string): void {
    this.onKey({ code, key: code, repeat: false, preventDefault() {} } as unknown as KeyboardEvent);
  }

  /** QA: schedule key presses on game time, e.g. qaKeys([[2500, 'ArrowDown'], [3000, 'Enter']]). */
  qaKeys(list: [number, string][]): void {
    for (const [t, code] of list) this.time.delayedCall(t, () => this.qaKey(code));
  }

  /** QA: the screen currently shown. */
  get qaScreen(): string {
    return this.screen;
  }

  private onAnyPress(): void {
    if (this.screen === 'attract') void this.leaveAttract();
  }

  private onKey(e: KeyboardEvent): void {
    if (this.screen === 'attract') {
      if (!e.repeat) void this.leaveAttract();
      return;
    }
    if (this.screen === 'menu') {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          this.menu.move(-1);
          return;
        case 'ArrowDown':
        case 'KeyS':
          this.menu.move(1);
          return;
        case 'Enter':
        case 'NumpadEnter':
        case 'Space':
          if (!e.repeat) void this.menu.activate();
          return;
        case 'Escape':
          void this.backToAttract();
          return;
      }
      const d = /^(Digit|Numpad)([1-6])$/.exec(e.code);
      if (d && !e.repeat) {
        this.menu.select(Number(d[2]) - 1, true);
        void this.menu.activate();
      }
      return;
    }
    if (this.overlay && (this.screen === 'howto' || this.screen === 'gallery' || this.screen === 'settings')) {
      if (this.overlay.onKey(e)) e.preventDefault();
    }
  }

  // ------------------------------------------------------------ attract ⇄ menu

  private async leaveAttract(): Promise<void> {
    if (this.screen !== 'attract') return;
    this.screen = 'busy';
    this.unlockAudio();
    sfx.play('uiConfirm', { volume: 0.8 });
    void this.logo.flashAll(220, 0.9);
    await this.prompt.confirm();
    void this.cam.moveTo(CAM.menu.x, CAM.menu.y, 900, 'Cubic.InOut');
    await wait(this, 120);
    await this.enterMenu();
  }

  private async enterMenu(): Promise<void> {
    this.screen = 'busy';
    this.hints.setVisible(true).setAlpha(0);
    void tween(this, { targets: this.hints, alpha: 1, duration: 300 });
    await this.menu.show();
    this.screen = 'menu';
  }

  private async backToAttract(): Promise<void> {
    this.screen = 'busy';
    sfx.play('uiBack', { volume: 0.6 });
    void tween(this, { targets: this.hints, alpha: 0, duration: 200 });
    await this.menu.hide();
    void this.cam.moveTo(CAM.attract.x, CAM.attract.y, 800, 'Cubic.InOut');
    this.prompt.root.setVisible(true);
    await this.prompt.show();
    this.screen = 'attract';
  }

  // ------------------------------------------------------------ menu actions

  private async choose(id: string): Promise<void> {
    if (this.screen !== 'menu') return;
    if (id === 'hotseat' || id === 'vsBot' || id === 'demo') {
      await this.launch(id);
      return;
    }
    if (id === 'howto' || id === 'gallery' || id === 'settings') {
      this.screen = 'busy';
      void tween(this, { targets: this.hints, alpha: 0, duration: 160 });
      const menuOut = this.menu.hide();
      const logoOut = tween(this, { targets: [this.logo.root, this.tagline.root], alpha: 0, duration: 220 });
      const clear = this.showcase.clear(200);
      void this.cam.moveTo(CAM.overlay.x, CAM.overlay.y, 320, 'Cubic.Out');
      this.cam.drift = 0;
      await Promise.all([menuOut, logoOut, clear]);
      await this.openOverlay(id);
    }
  }

  private hideArenaFloorFx(): void {
    for (const o of this.children.list) {
      const g = o as Phaser.GameObjects.GameObject & { depth: number; visible: boolean; setVisible?(b: boolean): unknown };
      if (g.depth >= DEPTH.TILE_FX && g.depth < DEPTH.CARD_ON_TILE && g.visible && g.setVisible) {
        g.setVisible(false);
        this.hiddenFloor.push(o);
      }
    }
  }

  private restoreArenaFloorFx(): void {
    for (const o of this.hiddenFloor) if (o.active) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(true);
    this.hiddenFloor = [];
  }

  private async openOverlay(id: 'howto' | 'gallery' | 'settings'): Promise<void> {
    this.cam.drift = 0;
    this.hideArenaFloorFx();
    this.motes.setLevel(0);
    this.logo.root.setAlpha(0);
    this.tagline.root.setAlpha(0);
    let ov: Overlay;
    if (id === 'settings') ov = new SettingsOverlay(this, this.settings);
    else if (id === 'gallery') ov = new GalleryOverlay(this, this.opts.card);
    else ov = new HowToOverlay(this, this.opts.page ?? 0);
    this.opts.card = undefined;
    this.opts.page = undefined;
    this.overlay = ov;
    ov.onClose = () => void this.overlayClosed();
    // keys stay gated ('busy') until the panel has unfolded and built its content
    this.screen = 'busy';
    await ov.open();
    if (this.overlay === ov) this.screen = id;
  }

  private async overlayClosed(): Promise<void> {
    this.overlay = null;
    this.screen = 'busy';
    this.restoreArenaFloorFx();
    this.motes.setLevel(1);
    this.cam.drift = 1;
    void this.cam.moveTo(CAM.menu.x, CAM.menu.y, 700, 'Cubic.InOut');
    void tween(this, { targets: [this.logo.root, this.tagline.root], alpha: 1, duration: 260 });
    this.showcase.start(500);
    await this.enterMenu();
  }

  // ------------------------------------------------------------ into the duel

  private async launch(mode: DuelMode): Promise<void> {
    this.screen = 'launch';
    this.menu.setEnabled(false);
    const launch: DuelLaunch = { mode };
    (window.__neon as Record<string, unknown>).titleLaunch = launch;
    void this.logo.glitch(2);
    await wait(this, 160);
    void this.logo.powerDown(300);
    void tween(this, { targets: this.hints, alpha: 0, duration: 160 });
    void this.menu.hide();
    music.stop(500);
    const cover = await wipeOut(this);
    const hasDuel = !!this.game.scene.keys['Duel'];
    if (hasDuel) {
      this.scene.start('Duel', launch);
      return;
    }
    // the duel scene is not registered yet (dev): say so and come back
    const msg = pixelText(this, 320, 180, 'DÜELLO SAHNESİ HENÜZ YOK', { size: 'lg', align: 'center', originX: 0.5, originY: 0.5, color: PAL.crim3 })
      .setScrollFactor(0)
      .setDepth(5100);
    const sub = pixelText(this, 320, 206, `scene.start('Duel', { mode: '${mode}' })`, { size: 'sm', align: 'center', originX: 0.5, originY: 0.5, color: PAL.steel })
      .setScrollFactor(0)
      .setDepth(5100);
    await wait(this, 1400);
    msg.destroy();
    sub.destroy();
    this.logo.showLit();
    this.logo.startIdle();
    if (this.settings.music && this.audioOn) music.play('title');
    await wipeIn(this, cover);
    await this.enterMenu();
  }
}
