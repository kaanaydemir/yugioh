// Neon Tower layer: FLOOR (slots / grid) — owner A1 (docs/v3/ARENA_NEON_TOWER.md §2, §7, §12).
// The slot art on the top plate: for every zone BoardViewCalm builds (LANES-aware, so 5+5 and 3+3 both get
// exactly the zones layout.ts says) one slot image — calm's 64×32 tile geometry in the owner's tones: a dim
// thin border (cyan1 / crimson1: BoardViewCalm's `base` line, which it steps up on hover / selection / flash),
// a faint glow ring outside it, the calm pad interior (kept, the stepped floor light reads it). The slot
// sits just above calm's own pad image (which stays underneath: zoneAt / tileImage / TargetMarks keep
// working on it) and under the stepped light (TILE + 0.5), the lit line masks and every highlight.
// The neutral centre strip is part of the platform body; this layer animates it: the emblem's two ring
// halves breathe on opposite phases, the dashes of the centre line carry a slow light run, all of it
// dark until the floodlights are on. In 3+3 the outer lane cells (grid cols 0 and 6) have no zone: they
// stay empty graphite, painted into the platform body.

import type Phaser from 'phaser';
import { FLOOR_FRAMES, NT_FLOOR_KEY, buildFloorArt } from '../../art/arena-nt/floor';
import { NT_PAL } from '../../art/arena-nt/palette';
import type { FloorArt } from '../../art/arena-nt/floor';
import { calmZones } from '../board-calm/art';
import type { PlayerId } from '../../engine/types';
import { zoneXY } from '../layout';
import { CENTER_EMBLEM, NT_DEPTH } from './layout-nt';
import { type NtCtx, type NtLayer } from './layer';
import { ensureNtTexture } from './textures';

type Img = Phaser.GameObjects.Image;

/** Register the floor atlas (idempotent): slot frames, emblem levels, dash masks. Used by boot step 22 and the layer. */
export function registerFloorTextures(scene: Phaser.Scene): FloorArt {
  const art = buildFloorArt();
  ensureNtTexture(scene, 'floor', NT_FLOOR_KEY, () => art.atlas.canvas);
  const tex = scene.textures.get(NT_FLOOR_KEY);
  for (const [name, r] of art.atlas.frames) if (!tex.has(name)) tex.add(name, 0, r.x, r.y, r.w, r.h);
  return art;
}

/** Ring level (0..2) of a half-emblem at phase u: dim, a rise, a held peak, a fall. */
function breath(u: number): number {
  const f = ((u % 1) + 1) % 1;
  return f < 0.3 ? 0 : f < 0.45 ? 1 : f < 0.75 ? 2 : f < 0.9 ? 1 : 0;
}

export function createFloorLayer(ctx: NtCtx): NtLayer {
  const scene = ctx.scene;
  const art = registerFloorTextures(scene);

  // ---- the slots
  for (const z of calmZones()) {
    const c = zoneXY(z.player, z.spot, z.index);
    const pile = z.spot !== 'monster' && z.spot !== 'spellTrap';
    ctx.add(scene.add.image(c.x - 32, c.y - 16, NT_FLOOR_KEY, FLOOR_FRAMES.slot(z.player, pile)).setOrigin(0).setDepth(NT_DEPTH.floor + 0.25));
  }

  // ---- the centre strip's life
  const emblem = ctx.add(scene.add.image(CENTER_EMBLEM.x, CENTER_EMBLEM.y, NT_FLOOR_KEY, FLOOR_FRAMES.emblem(0, 0)).setOrigin(0).setDepth(NT_DEPTH.floor + 0.1));
  const dashTones = [NT_PAL.metal[2], NT_PAL.metal[3], NT_PAL.metal[4]];
  const dashes: Img[] = art.dashes.map((d, k) =>
    ctx.add(scene.add.image(d.x, d.y, NT_FLOOR_KEY, FLOOR_FRAMES.dash(k)).setOrigin(0).setDepth(NT_DEPTH.floor + 0.1).setVisible(false)),
  );
  let lights = true;
  let onAt = 0;
  let active: PlayerId | null = null;
  let now = 0;
  let lastB = -1;
  let lastR = -1;
  let pending: { until: number; done: () => void } | null = null;

  return {
    name: 'floor',
    owner: 'A1',
    setActivePlayer(p) {
      active = p;
    },
    setLights(on, animate) {
      lights = on;
      if (pending) {
        pending.done();
        pending = null;
      }
      if (!on) return Promise.resolve();
      onAt = now + (animate ? 900 : 0);
      if (!animate) return Promise.resolve();
      return new Promise<void>((done) => {
        pending = { until: onAt + 100, done };
      });
    },
    tick(_dt, t) {
      now = t;
      if (pending && t >= pending.until) {
        pending.done();
        pending = null;
      }
      const on = lights && t >= onAt;
      // emblem: the two halves breathe on opposite phases (a 4.8 s cycle); the active side's half rests one level up
      let b = on ? Math.max(breath(t / 4800), active === 0 ? 1 : 0) : 0;
      let r = on ? Math.max(breath(t / 4800 + 0.5), active === 1 ? 1 : 0) : 0;
      if (on && b === 0 && r === 0) b = 1;
      if (b !== lastB || r !== lastR) {
        emblem.setFrame(FLOOR_FRAMES.emblem(b, r));
        lastB = b;
        lastR = r;
      }
      // dashes: a light run along the centre line (7.2 s lap, 2-tone head)
      const n = dashes.length;
      dashes.forEach((d, k) => {
        if (!on) {
          d.setVisible(false);
          return;
        }
        const u = (t / 7200) * (n + 4) - k;
        const lv = ((u % (n + 4)) + (n + 4)) % (n + 4);
        const level = lv < 0.8 ? 3 : lv < 1.8 ? 2 : lv < 2.6 ? 1 : 0;
        d.setVisible(level > 0).setTint(dashTones[level - 1]);
      });
    },
    destroy() {
      if (pending) pending.done();
      pending = null;
    },
  };
}
