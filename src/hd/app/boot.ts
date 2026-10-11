// HD boot: register the two HD pipelines, reuse the existing boot steps that the trial needs (fonts, core fx
// textures, particle / summon / combat / set-piece textures and the hologram PostFX), build the soft light
// textures, then hand over to the trial scene.

import Phaser from 'phaser';
import type { BootStep } from '../../boot/types';
import core from '../../boot/05-core';
import fonts from '../../boot/10-fonts';
import vfxSummon from '../../boot/12-vfx-summon';
import vfxCombat from '../../boot/13-vfx-combat';
import vfxSet from '../../boot/14-vfx-set';
import { buildSoftTextures, installBloom } from './fx';
import { installLighting } from './lighting';

const REUSED: BootStep[] = [core, fonts, vfxSummon, vfxCombat, vfxSet];

export class HDBootScene extends Phaser.Scene {
  constructor() {
    super('HDBoot');
  }

  create(): void {
    if (!installLighting(this.game)) {
      window.__neon.errors.push('HD trial needs WebGL (Light2D pipeline could not be installed)');
    }
    installBloom(this.game);
    for (const step of REUSED) {
      try {
        step.build(this);
      } catch (err) {
        console.error(`[hd boot] step "${step.name}" failed`, err);
        window.__neon.errors.push(`boot ${step.name}: ${String(err)}`);
      }
    }
    buildSoftTextures(this);
    this.scene.start('Trial');
  }
}
