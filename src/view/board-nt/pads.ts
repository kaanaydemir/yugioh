// Neon Tower layer: PADS (duelist corner pads) — owner A1 (docs/v3/ARENA_NEON_TOWER.md §2, §3).
// The two small raised pads the duelists stand on (layout.duelistXY: P1 (213, 214) with a cyan border, P2
// (427, 106) with a crimson one) on the plate's two bumps. The duelist sprites themselves (src/duel/
// DuelistView.ts) stay as they are. Ambient life: the border breathes between three levels, each pad on its
// own period (nothing is ever static), the pad of the side to move rests one level up and gives a quick
// double pulse when its turn begins; dark until the floodlights are on. Depth: NT_DEPTH.pads.

import type Phaser from 'phaser';
import { NT_PADS_KEY, PAD_CANVAS, buildPadsArt, padFrame } from '../../art/arena-nt/pads';
import type { PadsArt } from '../../art/arena-nt/pads';
import type { PlayerId } from '../../engine/types';
import { DUELIST_PADS, NT_DEPTH } from './layout-nt';
import { type NtCtx, type NtLayer } from './layer';
import { ensureNtTexture } from './textures';

type Img = Phaser.GameObjects.Image;

/** Register the pads atlas (idempotent). Used by boot step 29 and the layer. */
export function registerPadsTextures(scene: Phaser.Scene): PadsArt {
  const art = buildPadsArt();
  ensureNtTexture(scene, 'pads', NT_PADS_KEY, () => art.atlas.canvas);
  const tex = scene.textures.get(NT_PADS_KEY);
  for (const [name, r] of art.atlas.frames) if (!tex.has(name)) tex.add(name, 0, r.x, r.y, r.w, r.h);
  return art;
}

export function createPadsLayer(ctx: NtCtx): NtLayer {
  const scene = ctx.scene;
  registerPadsTextures(scene);
  const period = [5600, 6700];
  const phase = [0.15, 0.6];
  const imgs: Img[] = DUELIST_PADS.map((r, i) =>
    ctx.add(scene.add.image(r.x + 28 - PAD_CANVAS.cx, r.y + 14 - PAD_CANVAS.cy, NT_PADS_KEY, padFrame(i as 0 | 1, 1)).setOrigin(0).setDepth(NT_DEPTH.pads)),
  );
  const shown = [-1, -1];
  let lights = true;
  let onAt = 0;
  let active: PlayerId | null = null;
  let pulseAt = [-9999, -9999];
  let now = 0;

  const level = (i: number, t: number): number => {
    if (!lights || t < onAt) return 0;
    const u = (((t / period[i] + phase[i]) % 1) + 1) % 1;
    let lv = u < 0.55 ? 1 : u < 0.7 ? 2 : u < 0.85 ? 1 : 0;
    if (active === i) lv = Math.max(lv, 2);
    // a quick double pulse as the turn begins
    const k = t - pulseAt[i];
    if (k >= 0 && k < 520) lv = Math.max(lv, Math.floor(k / 130) % 2 === 0 ? 3 : 1);
    return lv;
  };

  return {
    name: 'pads',
    owner: 'A1',
    setActivePlayer(p) {
      if (p !== null && p !== active) pulseAt[p] = now;
      active = p;
    },
    setLights(on, animate) {
      lights = on;
      if (on) onAt = now + (animate ? 1300 : 0);
      return Promise.resolve();
    },
    tick(_dt, t) {
      now = t;
      imgs.forEach((img, i) => {
        const lv = level(i, t);
        if (lv !== shown[i]) {
          img.setFrame(padFrame(i as 0 | 1, lv));
          shown[i] = lv;
        }
      });
    },
    destroy() {
      pulseAt = [-9999, -9999];
    },
  };
}
