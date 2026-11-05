// Neon Tower layer: PLATFORM — owner A1 (docs/v3/ARENA_NEON_TOWER.md §2, §5, §8).
// Readability pass: side armour strips, rim light sweeps, and corner glints stay calm and quiet so the
// platform reads as a solid dark slate slab under the units.

import type Phaser from 'phaser';
import { type PlatformArt, NT_PLATFORM_FX_KEY, NT_PLATFORM_KEY, PLATFORM_BOX, STRIP_TONES, buildPlatformArt } from '../../art/arena-nt/platform';
import { mulberry32 } from '../../art/pixel';
import { PAL } from '../../art/palette';
import type { GameEvent, PlayerId } from '../../engine/types';
import { TEX } from '../../vfx/core';
import { NT_DEPTH } from './layout-nt';
import { type NtCtx, type NtLayer } from './layer';
import { ensureNtTexture } from './textures';

type Img = Phaser.GameObjects.Image;

export function registerPlatformTextures(scene: Phaser.Scene): PlatformArt {
  const art = buildPlatformArt();
  ensureNtTexture(scene, 'platform', NT_PLATFORM_KEY, () => art.canvas);
  ensureNtTexture(scene, 'platform-fx', NT_PLATFORM_FX_KEY, () => art.fx.canvas);
  const tex = scene.textures.get(NT_PLATFORM_FX_KEY);
  for (const [name, r] of art.fx.frames) if (!tex.has(name)) tex.add(name, 0, r.x, r.y, r.w, r.h);
  return art;
}

interface Strip {
  img: Img;
  side: 0 | 1 | 2;
  face: number;
  n: number;
  phase: number;
  period: number;
  litAt: number;
  liftUntil: number;
  lift: number;
}

interface Puff {
  img: Img;
  t0: number;
  x: number;
  y: number;
  dir: -1 | 1;
  alive: boolean;
}

export function createPlatformLayer(ctx: NtCtx): NtLayer {
  const scene = ctx.scene;
  const art = registerPlatformTextures(scene);
  const rnd = mulberry32(4107);
  const body = ctx.add(scene.add.image(PLATFORM_BOX.x, PLATFORM_BOX.y, NT_PLATFORM_KEY).setOrigin(0).setDepth(NT_DEPTH.platform));
  void body;
  void STRIP_TONES;

  const facePeriod = [5400, 6100, 4800, 5600, 6400, 5000, 5900];
  const strips: Strip[] = art.strips.map((s) => {
    const img = ctx.add(scene.add.image(s.x, s.y, NT_PLATFORM_FX_KEY, s.frame).setOrigin(0).setDepth(NT_DEPTH.platformFx).setVisible(false));
    return { img, side: s.side, face: s.face, n: s.n, phase: s.n * 0.13 + rnd() * 0.06 + s.face * 0.31, period: facePeriod[s.face % facePeriod.length], litAt: 0, liftUntil: 0, lift: 0 };
  });

  const puffs: Puff[] = [0, 1].map(() => ({ img: ctx.add(scene.add.image(0, 0, NT_PLATFORM_FX_KEY, 'puff:0').setOrigin(0).setDepth(NT_DEPTH.platformFx + 0.1).setVisible(false)), t0: 0, x: 0, y: 0, dir: 1, alive: false }));
  const sweepTones = [PAL.night2, PAL.night1, PAL.night1, PAL.night0];
  const sweepPx = sweepTones.map((c) => ctx.add(scene.add.image(0, 0, TEX.px1).setOrigin(0).setTint(c).setDepth(NT_DEPTH.platformFx + 0.2).setVisible(false)));
  const glints = art.corners.map((c, i) => ({
    img: ctx.add(scene.add.image(c.x - 3, c.y - 3, NT_PLATFORM_FX_KEY, 'glint:0').setOrigin(0).setDepth(NT_DEPTH.platformFx + 0.3).setVisible(false)),
    at: -1,
    next: 3000 + i * 1700 + rnd() * 2500,
  }));

  let lights = true;
  let active: PlayerId | null = null;
  let pending: { until: number; done: () => void } | null = null;
  let now = 0;
  let destroyed = false;
  void lights;
  void active;

  function ignite(animate: boolean): number {
    let last = 0;
    const byFace = new Map<number, Strip[]>();
    for (const s of strips) byFace.set(s.face, [...(byFace.get(s.face) ?? []), s]);
    for (const list of byFace.values()) {
      const mid = (list.length - 1) / 2;
      for (const s of list) {
        const d = animate ? 260 + Math.abs(s.n - mid) * 150 + (s.side === 1 ? 120 : 0) : 0;
        s.litAt = now + d;
        last = Math.max(last, d);
      }
    }
    return last;
  }

  const layer: NtLayer = {
    name: 'platform',
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
      if (!on) {
        for (const s of strips) s.litAt = Infinity;
        return Promise.resolve();
      }
      const ms = ignite(animate);
      if (!animate || ms <= 0) return Promise.resolve();
      return new Promise<void>((done) => {
        pending = { until: now + ms + 120, done };
      });
    },
    onGameEvent(ev: GameEvent) {
      if (ev.type !== 'summon' && ev.type !== 'attackDeclare') return;
      const p = (ev as { player?: PlayerId }).player;
      if (p === undefined) return;
      for (const s of strips) {
        if (s.side !== p) continue;
        s.lift = ev.type === 'summon' ? 2 : 1;
        s.liftUntil = now + 420 + s.n * 45;
      }
    },
    tick(_dt, t) {
      if (destroyed) return;
      now = t;
      if (pending && t >= pending.until) {
        pending.done();
        pending = null;
      }
      for (const s of strips) s.img.setVisible(false);
      for (const p of puffs) p.img.setVisible(false);
      for (const g of glints) g.img.setVisible(false);
      for (const q of sweepPx) q.setVisible(false);
    },
    destroy() {
      destroyed = true;
      if (pending) pending.done();
      pending = null;
    },
  };
  return layer;
}
