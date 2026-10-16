// Art Lab world: everything one art variant puts on screen (arena, two actors, effect textures,
// battle script, effect windows). Rebuilt from scratch on a variant switch; render(t) is a pure
// function of lab time.

import type Phaser from 'phaser';
import type { ArtVariant, LabArena, XY } from '../types';
import { LabActor, type Pose } from './actors';
import { buildBattle, shakeAt, type ActorId, type BattleScript } from './battle';
import { buildEffectSpecs } from './fx-effects';
import { EffectManager } from './fx-manager';
import { FxTextures } from './fx-textures';
import { frameAt } from './anim';

export type Stage = 'battle' | 'static' | 'idle';

export interface WorldOptions {
  stage: Stage;
  /** Frozen poses (stage 'static'); missing actors stand in idle frame 0. */
  poses: Partial<Record<ActorId, Pose>>;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export class LabWorld {
  readonly arena: LabArena;
  readonly actors: Record<ActorId, LabActor>;
  readonly script: BattleScript;
  readonly fx: EffectManager;
  readonly tex: FxTextures;
  readonly focus: Record<ActorId, XY>;
  private fxOn = true;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly variant: ArtVariant,
    readonly opts: WorldOptions,
  ) {
    const prefix = `artlab:${variant.id}:`;
    this.arena = variant.buildArena(scene);
    const slots = this.arena.slots;
    const dragon = new LabActor(scene, prefix, 'dragon', variant.dragon, { x: Math.round(slots.dragon.x), y: Math.round(slots.dragon.y) }, false, variant.fx);
    const wizard = new LabActor(scene, prefix, 'wizard', variant.wizard, { x: Math.round(slots.wizard.x), y: Math.round(slots.wizard.y) }, true, variant.fx);
    this.actors = { dragon, wizard };
    this.focus = { dragon: dragon.focus(), wizard: wizard.focus() };

    this.script = buildBattle(variant, this.actors, { hop: dragon.hopLanding('victory') });
    dragon.track = this.script.tracks.dragon;
    wizard.track = this.script.tracks.wizard;
    if (opts.stage === 'static') {
      const valid = (a: LabActor, p: Pose | undefined): Pose => {
        const spec = p ? a.spec(p.anim) : undefined;
        if (!p || !spec) return { anim: 'idle', frame: 0 };
        return { anim: p.anim, frame: Math.max(0, Math.min(spec.durations.length - 1, p.frame)) };
      };
      dragon.fixed = valid(dragon, opts.poses.dragon);
      wizard.fixed = valid(wizard, opts.poses.wizard);
    } else if (opts.stage === 'idle') {
      dragon.idleOnly = true;
      wizard.idleOnly = true;
    }

    // effect textures: shards are baked along the breath line (mouth → first contact), circles
    // sized to each body
    const fireFrame = frameAt(variant.dragon.anims.attack, this.script.beats.fire - this.script.beats.dAttack);
    const mouth = dragon.point('attack', fireFrame, 'muzzle');
    const breathCue = this.script.cues.find((c) => c.kind === 'breath');
    const target = breathCue && breathCue.kind === 'breath' ? breathCue.point : wizard.point('idle', 0, 'core');
    const L = Math.hypot(target.x - mouth.x, target.y - mouth.y) || 1;
    const circleRx = (a: LabActor) => {
      const b = a.canvas('idle', 0)?.bounds();
      return clamp(2 * Math.round(((b?.w ?? 48) * 0.4) / 2), 18, 34);
    };
    this.tex = new FxTextures(scene, `${prefix}fx:`, variant.fx, {
      breathDir: { x: (target.x - mouth.x) / L, y: (target.y - mouth.y) / L },
      circleRx: { dragon: circleRx(dragon), wizard: circleRx(wizard) },
    });
    dragon.attachHalos(this.tex, variant.fx);
    wizard.attachHalos(this.tex, variant.fx);
    this.fx = new EffectManager(scene);
    if (opts.stage === 'battle') this.fx.setSpecs(buildEffectSpecs({ scene, tex: this.tex, fx: variant.fx, time: this.script.time, actors: this.actors }, this.script));
  }

  get battle(): boolean {
    return this.opts.stage === 'battle';
  }

  setFx(on: boolean): void {
    this.fxOn = on;
    this.fx.enabled = on;
    this.arena.setFx(on);
    this.actors.dragon.setFx(on);
    this.actors.wizard.setFx(on);
    if (!on) this.fx.clear();
  }

  /** Draw the whole world at lab time t. Returns the camera shake offset (integer px). */
  render(t: number): XY {
    const a = this.battle ? this.script.time.toAction(t) : t;
    this.actors.dragon.render(a);
    this.actors.wizard.render(a);
    this.arena.update(t);
    this.fx.update(t, a);
    if (!this.battle || !this.fxOn) return { x: 0, y: 0 };
    return shakeAt(this.script.shakes, t, this.variant.fx.maxShake);
  }

  destroy(): void {
    this.fx.destroy();
    this.actors.dragon.destroy();
    this.actors.wizard.destroy();
    this.arena.destroy();
    this.tex.destroy();
  }
}
