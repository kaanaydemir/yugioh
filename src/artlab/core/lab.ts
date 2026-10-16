// Art Lab app: the ONE lab clock, settings (speed / zoom / effects / UI), keyboard + mouse
// controls, the window.__artlab test API, and the current LabWorld (rebuilt on variant switch).
//
// Clock: t (ms) advances in the scene update by min(delta, 50) × speed while playing. Nothing
// that moves uses Phaser tweens, scene timers, setTimeout or promises: every frame renders the
// world as a pure function of t, so pause = stop advancing, speed = scale dt, restart = seek(0),
// and seek(ms) works anywhere.
//
// Under the screenshot tools (?test) the clock only advances inside window.__neon.step(), so
// --step / --film captures are exactly reproducible (add &live=1 to run in real time instead).
// __neon.step(ms) runs whole 1/60 s frames; the lab tops each step up (or trims it) so the lab
// clock advances by EXACTLY ms × speed — film labels (start + i·every) then match lab time for any
// --every. t is kept quantized to 1e-6 ms, so stepping N ms and seek(N) land on the same frame.

import type Phaser from 'phaser';
import type { ArtVariant } from '../types';
import { findVariant, readyVariants, VARIANTS } from '../variants';
import type { Pose } from './actors';
import type { ActorId } from './battle';
import { LabCameras, ZOOMS, type ZoomTarget } from './camera';
import { LabControls, type ButtonId, type ControlsHost } from './controls';
import { LabWorld, type Stage } from './world';

export interface LabOptions {
  variant: string;
  t: number;
  paused: boolean;
  speed: number;
  zoom: ZoomTarget;
  fx: boolean;
  ui: boolean;
  loop: boolean;
  stage: Stage;
  poses: Partial<Record<ActorId, Pose>>;
  /** Advance only inside window.__neon.step() (deterministic screenshots). */
  externalClock: boolean;
}

export interface LabStats {
  t: number;
  displayObjects: number;
  fxObjects: number;
  activeEffects: number;
  lights: number;
  particles: number;
  /** Emissive halos currently shown on the actors (idle light layer). */
  halos: number;
  tweens: number;
  timers: number;
  effects: string[];
}

export interface ArtLabApi {
  readonly t: number;
  readonly duration: number;
  readonly playing: boolean;
  readonly speed: number;
  readonly zoom: ZoomTarget;
  readonly fx: boolean;
  readonly variant: string;
  readonly beats: Record<string, number>;
  /** Start-up note shown at the top (e.g. "Varyant B henüz hazır değil — A gösteriliyor"), or null. */
  readonly notice: string | null;
  seek(ms: number): void;
  play(): void;
  pause(): void;
  restart(): void;
  setSpeed(k: number): void;
  setZoom(z: ZoomTarget): void;
  setFx(on: boolean): void;
  setVariant(id: string): boolean;
  /** Advance (or rewind with n < 0) by n 1/60 s frames while paused. */
  stepFrames(n: number): void;
  /** Show / hide the control bar. */
  setUi(on: boolean): void;
  /** Run a control-bar button's action as if clicked. */
  press(id: ButtonId): void;
  /** Button rectangles in game pixels (for synthetic click tests). */
  buttons(): Record<string, { x: number; y: number; w: number; h: number }>;
  stats(): LabStats;
}

const FRAME = 1000 / 60;
/** How long (lab ms) a start-up notice stays. */
const NOTICE_MS = 4000;

let stepDepth = 0;

/** Lab time quantum: removes float drift of the running sum (restart + step N ≡ seek N). */
const quantize = (t: number) => Math.round(t * 1e6) / 1e6;

export class ArtLab implements ControlsHost {
  private world: LabWorld | null = null;
  private controls: LabControls | null = null;
  private readonly cams: LabCameras;
  private t = 0;
  private playing = true;
  private speed = 1;
  private zoom: ZoomTarget = 'off';
  private fxOn = true;
  private uiOn = true;
  private variant: ArtVariant | null = null;
  private readonly onKey: (ev: KeyboardEvent) => void;
  /** Keydown events already handled (see key()). */
  private readonly seenKeys = new WeakSet<KeyboardEvent>();
  private readonly restoreStep: (() => void) | null = null;
  /** The __neon.step() call in progress (outermost): origin, length, frame count / counter. */
  private stepRun: { t0: number; ms: number; n: number; k: number; world: LabWorld | null; playing: boolean } | null = null;
  /** Lab time shown by the last frame the game drew. */
  private drawnT = Number.NaN;
  /** Start-up note (e.g. a requested variant that is not ready) and the lab time it appeared. */
  private noticeMsg: string | null = null;
  private noticeT0 = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly opts: LabOptions,
  ) {
    this.cams = new LabCameras(scene);
    this.speed = opts.speed === 0.5 ? 0.5 : 1;
    this.zoom = opts.zoom;
    this.fxOn = opts.fx;
    this.uiOn = opts.ui;
    this.playing = !opts.paused;
    this.onKey = (ev) => this.key(ev);
    scene.input.keyboard?.on('keydown', this.onKey);
    // deterministic clock under the screenshot tools: count the frames driven by __neon.step()
    const neon = window.__neon;
    if (opts.externalClock && neon && typeof neon.step === 'function') {
      const orig = neon.step;
      neon.step = (ms: number) => {
        const outer = stepDepth === 0;
        const t0 = this.t;
        const wasPlaying = this.playing;
        const world = this.world;
        const span = Math.max(0, Number(ms) || 0);
        // frame k of this step shows t0 + speed·min(ms, k·FRAME) (no running sum), and the frame
        // main.ts runs last (n = round(ms / FRAME), at least 1) shows exactly t0 + speed·ms — so
        // the canvas drawn by the last real frame IS the settled time (a stale 0.5× capture
        // used to show the frame just before it)
        if (outer) this.stepRun = { t0, ms: span, n: Math.max(1, Math.round(span / FRAME)), k: 0, world, playing: wasPlaying };
        stepDepth++;
        try {
          orig.call(neon, ms);
        } finally {
          stepDepth--;
          if (outer) this.stepRun = null;
        }
        // settle the step exactly as ONE advance of ms from where it started (normally the last
        // frame already landed there); if it did not (the step ran a different number of frames),
        // draw the settled state now so the canvas is never stale
        if (outer && wasPlaying && world === this.world && (this.playing || this.ended())) {
          this.t = t0;
          this.playing = true;
          this.advance(span);
          this.render();
          if (this.t !== this.drawnT) this.redraw();
        }
      };
      this.restoreStep = () => {
        neon.step = orig;
      };
    }
  }

  // ---------------------------------------------------------------- build / rebuild

  build(id: string): boolean {
    const entry = findVariant(id);
    if (!entry?.load) return false;
    this.teardown();
    this.noticeMsg = null;
    this.variant = entry.load();
    this.cams.setBackground(this.variant.background);
    this.world = new LabWorld(this.scene, this.variant, { stage: this.opts.stage, poses: this.opts.poses });
    this.world.setFx(this.fxOn);
    this.controls = this.cams.uiBuild(() => new LabControls(this.scene, this, (fn) => this.cams.uiBuild(fn)));
    this.controls.setVisible(this.uiOn);
    this.t = quantize(Math.max(0, Math.min(this.duration, this.opts.t)));
    this.opts.t = 0; // only the first build seeks to &t=
    this.render();
    return true;
  }

  private teardown(): void {
    this.controls?.destroy();
    this.controls = null;
    this.world?.destroy();
    this.world = null;
  }

  destroy(): void {
    this.teardown();
    this.scene.input.keyboard?.off('keydown', this.onKey);
    this.restoreStep?.();
    this.cams.destroy();
  }

  // ---------------------------------------------------------------- clock

  get duration(): number {
    return this.world?.battle ? this.world.script.duration : Number.POSITIVE_INFINITY;
  }

  /** Scene update: advance the clock and render. */
  update(): void {
    const loop = this.scene.game.loop;
    const dt = Math.min(50, Math.max(0, loop.rawDelta));
    const run = this.stepRun;
    if (run && run.playing && run.world === this.world && stepDepth > 0) {
      // stepped frame: an absolute time from the step's origin (see the __neon.step wrapper)
      run.k++;
      if (this.playing) {
        const done = run.k >= run.n || run.k * FRAME >= run.ms - 1e-6;
        this.t = run.t0;
        this.advance(done ? run.ms : Math.min(run.ms, run.k * FRAME));
      }
    } else if (!this.opts.externalClock || stepDepth > 0) this.advance(dt);
    this.render();
    // the scene draws right after this update: remember what the canvas shows
    this.drawnT = this.t;
  }

  /** Draw the game once now (stepped captures only: the canvas must show the settled time). */
  private redraw(): void {
    const g = this.scene.game;
    const r = g.renderer;
    if (!r) return;
    r.preRender();
    g.scene.render(r);
    r.postRender();
    this.drawnT = this.t;
  }

  /** Advance the lab clock by `dt` real ms, honouring play / loop / end. */
  private advance(dt: number): void {
    if (!this.playing || dt <= 0) return;
    this.t = quantize(this.t + dt * this.speed);
    if (this.world?.battle && this.t >= this.duration) {
      if (this.opts.loop) this.t = quantize(this.t % this.duration);
      else {
        this.t = this.duration;
        this.playing = false;
      }
    }
  }

  private render(): void {
    if (!this.world) return;
    // the start-up notice goes after NOTICE_MS of lab time (either way) or once the menu opens
    if (this.noticeMsg && (Math.abs(this.t - this.noticeT0) >= NOTICE_MS || this.controls?.menuIsOpen)) this.noticeMsg = null;
    const shake = this.world.render(this.t);
    this.cams.apply(this.zoom, this.world.focus, shake);
    this.controls?.refresh();
  }

  seek(ms: number): void {
    const d = this.duration;
    this.t = quantize(Math.max(0, Math.min(Number.isFinite(d) ? d : Number.MAX_SAFE_INTEGER, Number(ms) || 0)));
    this.render();
  }

  // ---------------------------------------------------------------- ControlsHost

  isPlaying(): boolean {
    return this.playing;
  }
  getSpeed(): number {
    return this.speed;
  }
  getZoom(): ZoomTarget {
    return this.zoom;
  }
  getFx(): boolean {
    return this.fxOn;
  }
  variantId(): string {
    return this.variant?.id ?? '?';
  }
  noticeText(): string | null {
    return this.noticeMsg;
  }
  /** Show a short note at the top of the screen (UI shown only) for NOTICE_MS of lab time. */
  notice(text: string): void {
    this.noticeMsg = text;
    this.noticeT0 = this.t;
    this.render();
  }
  ended(): boolean {
    return !!this.world?.battle && this.t >= this.duration && !this.playing;
  }
  timeText(): string {
    const s = (ms: number) => (ms / 1000).toFixed(1).replace('.', ',');
    if (!this.world?.battle) return `${s(this.t)} sn — ${this.opts.stage === 'idle' ? 'bekleme' : 'sabit poz'}`;
    return `${s(this.t)} / ${s(this.duration)} sn`;
  }
  togglePlay(): void {
    if (this.playing) this.playing = false;
    else if (this.ended()) this.restart();
    else this.playing = true;
    this.render();
  }
  restart(): void {
    this.seek(0);
    this.playing = true;
    this.render();
  }
  setSpeed(k: number): void {
    this.speed = k === 0.5 ? 0.5 : 1;
    this.render();
  }
  cycleZoom(): void {
    this.zoom = ZOOMS[(ZOOMS.indexOf(this.zoom) + 1) % ZOOMS.length];
    this.render();
  }
  setZoom(z: ZoomTarget): void {
    this.zoom = ZOOMS.includes(z) ? z : 'off';
    this.render();
  }
  toggleFx(): void {
    this.setFx(!this.fxOn);
  }
  setFx(on: boolean): void {
    this.fxOn = on;
    this.world?.setFx(on);
    this.render();
  }
  /**
   * Switch to another ready variant (rebuilds the world and starts its battle from 0). Picking the
   * variant already shown does nothing (it used to rebuild and silently restart the battle).
   */
  setVariant(id: string): void {
    if (findVariant(id)?.id === this.variant?.id) {
      this.controls?.refresh(true);
      return;
    }
    // read BEFORE build(): build() resets t, after which ended() is always false
    const wasEnded = this.ended();
    const playing = this.playing;
    if (this.build(id)) {
      this.t = 0;
      this.playing = playing || wasEnded;
      this.render();
    }
  }
  nextVariant(): void {
    const ready = readyVariants();
    if (ready.length < 2) {
      // nothing to switch to: show the switcher (B/C/D "yakında") instead of rebuilding A
      if (this.controls?.visible) {
        this.controls.toggleMenu();
        this.controls.refresh(true);
      }
      return;
    }
    const i = ready.findIndex((v) => v.id === this.variantId());
    this.setVariant(ready[(i + 1) % ready.length].id);
  }
  setUi(on: boolean): void {
    this.uiOn = on;
    this.controls?.setVisible(on);
    this.render();
  }

  stepFrames(n: number): void {
    this.playing = false;
    this.seek(this.t + n * FRAME);
  }

  // ---------------------------------------------------------------- keyboard

  private key(ev: KeyboardEvent): void {
    // Phaser re-runs its whole pending key queue on every DOM key event until the next game step
    // clears it, so with the frozen test clock (or two presses inside one frame) the SAME event
    // object arrives again: act on each DOM event once
    if (this.seenKeys.has(ev)) return;
    this.seenKeys.add(ev);
    switch (ev.code) {
      case 'Space':
        this.togglePlay();
        break;
      case 'KeyR':
        this.restart();
        break;
      case 'Digit1':
      case 'Numpad1':
        this.setSpeed(0.5);
        break;
      case 'Digit2':
      case 'Numpad2':
        this.setSpeed(1);
        break;
      case 'KeyZ':
        this.cycleZoom();
        break;
      case 'KeyF':
        this.toggleFx();
        break;
      case 'KeyV':
        this.nextVariant();
        break;
      case 'KeyH':
        this.setUi(!this.uiOn);
        break;
      case 'Comma':
        if (!this.playing) this.stepFrames(-1);
        break;
      case 'Period':
        if (!this.playing) this.stepFrames(1);
        break;
      case 'Escape':
        this.controls?.closeMenu();
        this.controls?.refresh(true);
        break;
      default:
        return;
    }
    ev.preventDefault?.();
  }

  // ---------------------------------------------------------------- API

  stats(): LabStats {
    const fx = this.world?.fx.stats() ?? { activeEffects: 0, fxObjects: 0, lights: 0, particles: 0, names: [] };
    const clock = this.scene.time as unknown as { _active?: unknown[]; _pendingInsertion?: unknown[] };
    return {
      t: Math.round(this.t * 100) / 100,
      displayObjects: this.scene.children.length,
      fxObjects: fx.fxObjects,
      activeEffects: fx.activeEffects,
      lights: fx.lights,
      particles: fx.particles,
      halos: (this.world?.actors.dragon.visibleHalos ?? 0) + (this.world?.actors.wizard.visibleHalos ?? 0),
      tweens: this.scene.tweens.getTweens().length,
      timers: (clock._active?.length ?? 0) + (clock._pendingInsertion?.length ?? 0),
      effects: fx.names,
    };
  }

  api(): ArtLabApi {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const lab = this;
    return {
      get t() {
        return lab.t;
      },
      get duration() {
        return lab.duration;
      },
      get playing() {
        return lab.playing;
      },
      get speed() {
        return lab.speed;
      },
      get zoom() {
        return lab.zoom;
      },
      get fx() {
        return lab.fxOn;
      },
      get variant() {
        return lab.variantId();
      },
      get beats() {
        return { ...(lab.world?.script.beats ?? {}) };
      },
      get notice() {
        return lab.noticeText();
      },
      seek: (ms) => lab.seek(ms),
      play: () => {
        if (lab.ended()) lab.seek(0);
        lab.playing = true;
        lab.render();
      },
      pause: () => {
        lab.playing = false;
        lab.render();
      },
      restart: () => lab.restart(),
      setSpeed: (k) => lab.setSpeed(k),
      setZoom: (z) => lab.setZoom(z),
      setFx: (on) => lab.setFx(on),
      setVariant: (id) => {
        if (!findVariant(id)) return false;
        lab.setVariant(id);
        return true;
      },
      stepFrames: (n) => lab.stepFrames(n),
      setUi: (on) => lab.setUi(on),
      press: (id) => lab.controls?.press(id),
      buttons: () => lab.controls?.rects() ?? {},
      stats: () => lab.stats(),
    };
  }
}

/** Parse the lab's query parameters (see src/artlab/README.md). */
export function labOptions(params: URLSearchParams): LabOptions {
  const poses: Partial<Record<ActorId, Pose>> = {};
  const pose = params.get('pose');
  if (pose) {
    for (const part of pose.split(',')) {
      const [who, anim, frame] = part.split(':');
      if ((who === 'dragon' || who === 'wizard') && anim) poses[who] = { anim, frame: Math.max(0, Math.floor(Number(frame) || 0)) };
    }
  }
  const st = params.get('stage');
  const stage: Stage = pose || st === 'static' ? 'static' : st === 'idle' ? 'idle' : 'battle';
  const z = params.get('zoom');
  return {
    variant: (params.get('variant') ?? VARIANTS[0].id).toUpperCase(),
    t: Math.max(0, Number(params.get('t') ?? 0) || 0),
    paused: params.get('paused') === '1',
    speed: params.get('speed') === '0.5' ? 0.5 : 1,
    zoom: z === 'dragon' || z === 'wizard' ? z : 'off',
    fx: params.get('fx') !== '0',
    ui: params.get('ui') !== '0',
    loop: params.get('loop') === '1',
    stage,
    poses,
    externalClock: params.has('test') && params.get('live') !== '1',
  };
}
