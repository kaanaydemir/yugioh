// The one scene of the HD trial page. ?view= picks what it shows (src/hd/app/views/*):
//   scene (default)   arena + both monsters + the looping cine sequence (src/hd/cine/)
//   monster&id=<id>   every frame of an HD monster: colour | normal map | lit under a moving light
//   arena             the arena theme alone, lit
//   lighttest         a normal-mapped test sphere under moving lights (lighting + flipX check)
//
// Keys: D environment pixel density (1 ↔ 2)   L dynamic lighting on/off   B bloom on/off
//       Space 3× speed (toggle)   R restart   H hide/show the overlay
// URL:  &env=2  &speed=3  &light=0  &bloom=0  &theme=<id>  &p1=<monsterId> &p2=<monsterId>  &seq=<cine file>
//       &hud=1 (overlay in ?test runs)  &autoplay=1 (start the sequence at once in ?test runs; otherwise it starts
//       at the first freeze() so films begin at t = 0)

import Phaser from 'phaser';
import { setSpeed } from '../../vfx/core';
import { bloom } from './fx';
import { makeHud, type Hud } from './hud';
import { getKit, type HDKit } from './kit';
import { addLitSprite, getLighting, isLightingEnabled, makeLitSheet, makeLitTexture, setLightingEnabled, useLighting } from './lighting';
import { arenaView } from './views/arena';
import { lighttestView } from './views/lighttest';
import { monsterView } from './views/monster';
import { sceneView } from './views/scene';

export interface ViewCtx {
  scene: TrialScene;
  kit: HDKit;
  params: URLSearchParams;
  envPixel: 1 | 2;
  signal: AbortSignal;
  /** Extra text for the overlay. */
  status(text: string): void;
  /** Resolves when the sequence may start (immediately, or at the first freeze() in ?test runs). */
  startGate(): Promise<void>;
  /** Restart this view from scratch (what the R key does). */
  restart(): void;
}

type ViewFn = (ctx: ViewCtx) => Promise<void> | void;

const VIEWS: Record<string, ViewFn> = {
  scene: sceneView,
  monster: monsterView,
  arena: arenaView,
  lighttest: lighttestView,
};

export class TrialScene extends Phaser.Scene {
  private abort = new AbortController();
  private hud: Hud | null = null;
  private extra = '';
  private viewName = 'scene';
  private envPixel: 1 | 2 = 1;

  constructor() {
    super('Trial');
  }

  async create(): Promise<void> {
    this.abort = new AbortController();
    const params = (this.registry.get('params') as URLSearchParams | undefined) ?? new URLSearchParams(location.search);
    this.viewName = VIEWS[params.get('view') ?? 'scene'] ? (params.get('view') ?? 'scene') : 'scene';

    // global toggles survive restarts (they live in the game registry)
    const reg = this.registry;
    if (reg.get('hd:env') === undefined) reg.set('hd:env', params.get('env') === '2' ? 2 : 1);
    if (reg.get('hd:speed') === undefined) reg.set('hd:speed', Number(params.get('speed') ?? 1) || 1);
    if (reg.get('hd:init') === undefined) {
      reg.set('hd:init', true);
      if (params.get('light') === '0') setLightingEnabled(false);
      if (params.get('bloom') === '0') bloom.enabled = false;
    }
    this.envPixel = reg.get('hd:env') === 2 ? 2 : 1;
    setSpeed(this, reg.get('hd:speed') as number);

    this.cameras.main.setBackgroundColor('#05060f');
    const kit = getKit(this);
    this.hud = makeHud(this, params);
    this.installKeys();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.abort.abort();
      this.hud?.destroy();
    });

    const ctx: ViewCtx = {
      scene: this,
      kit,
      params,
      envPixel: this.envPixel,
      signal: this.abort.signal,
      status: (t) => {
        this.extra = t;
        this.refreshHud();
      },
      startGate: () => this.gate(params),
      restart: () => this.restartView(),
    };

    try {
      await VIEWS[this.viewName](ctx);
    } catch (err) {
      if (!this.abort.signal.aborted) {
        console.error('[hd] view failed', err);
        window.__neon.errors.push(`view ${this.viewName}: ${String(err)}`);
      }
    }
    if (this.abort.signal.aborted) return;
    this.refreshHud();
    window.__neon.hd = {
      scene: this,
      kit,
      view: this.viewName,
      setLighting: (on: boolean) => {
        setLightingEnabled(on);
        this.refreshHud();
      },
      bloom,
      /** Handy for --eval debugging and for tests. */
      api: { makeLitTexture, makeLitSheet, addLitSprite, useLighting, getLighting },
    };
    window.__neon.ready = true;
  }

  private gate(params: URLSearchParams): Promise<void> {
    const film = params.has('test') && params.get('autoplay') !== '1';
    if (!film) return Promise.resolve();
    return new Promise((resolve) => {
      const check = () => {
        if (this.abort.signal.aborted || window.__neon.hdFrozen) {
          this.events.off(Phaser.Scenes.Events.UPDATE, check);
          resolve();
        }
      };
      this.events.on(Phaser.Scenes.Events.UPDATE, check);
    });
  }

  restartView(): void {
    this.scene.restart();
  }

  private refreshHud(): void {
    this.hud?.update({
      view: this.viewName,
      lighting: isLightingEnabled(),
      env: this.envPixel,
      speed: (this.registry.get('hd:speed') as number) ?? 1,
      bloom: bloom.enabled,
      extra: this.extra,
    });
  }

  private installKeys(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    kb.addCapture('SPACE');
    kb.on('keydown-D', () => {
      this.registry.set('hd:env', this.envPixel === 1 ? 2 : 1);
      this.restartView();
    });
    kb.on('keydown-L', () => {
      setLightingEnabled(!isLightingEnabled());
      this.refreshHud();
    });
    kb.on('keydown-B', () => {
      bloom.enabled = !bloom.enabled;
      this.refreshHud();
    });
    kb.on('keydown-SPACE', () => {
      const next = (this.registry.get('hd:speed') as number) === 3 ? 1 : 3;
      this.registry.set('hd:speed', next);
      setSpeed(this, next);
      this.refreshHud();
    });
    kb.on('keydown-R', () => this.restartView());
  }
}
