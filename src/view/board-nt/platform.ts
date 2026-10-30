// Neon Tower layer: PLATFORM — owner A1 (docs/v3/ARENA_NEON_TOWER.md §2, §5, §8).
// The ONE raised isometric metal battle platform around the existing tiles: layered armour side panels,
// corner pillars + blocks, embedded energy strips (blue near / red far, a neutral middle panel), a few
// vents, the dithered contact shadow under it and a plain graphite top with the neutral centre strip.
// The whole static body is ONE texture (src/art/arena-nt/platform.ts); this file adds its slow ambient
// life, all on scene time × timeScale (tick), a handful of pooled images, no tweens:
//   - the energy strips of the side armour: one white mask per panel, tinted one or two tones up in a
//     slow wave (each panel on its own phase, each face on its own period) — the active side's strips
//     rest one tone higher; a summon / attack declaration lifts that side's strips for a moment;
//   - a rare vent puff (4-frame steam wisp), a small light sweep along a rim lip, a corner glint
//     (3 frames, each corner on its own clock);
//   - the ignition (setLights): the strips come on panel by panel from the middle of each face.
// BoardViewCalm keeps the neon TRIM along the plate top (lit / dead / runner / ignition / volcano heat):
// the plate leaves those pixels free (NT_SKIP.slabImage). Depth: NT_DEPTH.platform (body, shadow in it) and
// NT_DEPTH.platformFx (strips, puffs, sweep, glints).

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

/** Register the platform textures (idempotent): the body and the fx atlas with its frames. Used by boot step 21 and the layer. */
export function registerPlatformTextures(scene: Phaser.Scene): PlatformArt {
  const art = buildPlatformArt();
  ensureNtTexture(scene, 'platform', NT_PLATFORM_KEY, () => art.canvas);
  ensureNtTexture(scene, 'platform-fx', NT_PLATFORM_FX_KEY, () => art.fx.canvas);
  const tex = scene.textures.get(NT_PLATFORM_FX_KEY);
  for (const [name, r] of art.fx.frames) if (!tex.has(name)) tex.add(name, 0, r.x, r.y, r.w, r.h);
  return art;
}

/** Level (0 baked / 1 one tone up / 2 two up) of a strip at wave position u ∈ [0, 1). */
function waveLevel(u: number): number {
  return u < 0.5 ? 0 : u < 0.62 ? 1 : u < 0.8 ? 2 : u < 0.92 ? 1 : 0;
}

interface Strip {
  img: Img;
  side: 0 | 1 | 2;
  face: number;
  n: number;
  /** wave phase offset and the face's period, ms */
  phase: number;
  period: number;
  /** when the ignition reaches this panel (layer time; Infinity = off) */
  litAt: number;
  /** a lift from an event: until this time the strip shows at least `lift` levels */
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

  // ---- the energy strips
  const facePeriod = [5400, 6100, 4800, 5600, 6400, 5000, 5900];
  const strips: Strip[] = art.strips.map((s) => {
    const img = ctx.add(scene.add.image(s.x, s.y, NT_PLATFORM_FX_KEY, s.frame).setOrigin(0).setDepth(NT_DEPTH.platformFx).setVisible(false));
    return { img, side: s.side, face: s.face, n: s.n, phase: s.n * 0.13 + rnd() * 0.06 + s.face * 0.31, period: facePeriod[s.face % facePeriod.length], litAt: 0, liftUntil: 0, lift: 0 };
  });

  // ---- vent puffs (two pooled images), light sweep (four pooled pixels), corner glints (one image each)
  const puffs: Puff[] = [0, 1].map(() => ({ img: ctx.add(scene.add.image(0, 0, NT_PLATFORM_FX_KEY, 'puff:0').setOrigin(0).setDepth(NT_DEPTH.platformFx + 0.1).setVisible(false)), t0: 0, x: 0, y: 0, dir: 1, alive: false }));
  let nextPuff = 2600 + rnd() * 3000;
  const sweepTones = [PAL.mist, PAL.steel, PAL.night4, PAL.night3];
  const sweepPx = sweepTones.map((c) => ctx.add(scene.add.image(0, 0, TEX.px1).setOrigin(0).setTint(c).setDepth(NT_DEPTH.platformFx + 0.2).setVisible(false)));
  const sweep = { face: -1, s: 0, speed: 0.13, next: 6500 + rnd() * 3000 };
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

  const sideLevel = (side: 0 | 1 | 2): number => (active !== null && side === active ? 1 : 0);

  function ignite(animate: boolean): number {
    // from the middle of each face outward: panels come on 130 ms apart (a stepped run), neutral panel first
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
    tick(dt, t) {
      if (destroyed) return;
      now = t;
      if (pending && t >= pending.until) {
        pending.done();
        pending = null;
      }
      // ---- strips
      for (const s of strips) {
        const on = lights && t >= s.litAt;
        if (!on) {
          s.img.setVisible(false);
          continue;
        }
        const u = (t / s.period + s.phase) % 1;
        let level = Math.max(waveLevel(u), sideLevel(s.side));
        if (t < s.liftUntil) level = Math.max(level, s.lift);
        const tone = STRIP_TONES[s.side][1 + Math.min(2, level)];
        // level 0 is the baked dim strip: show the mask only when it is lifted
        s.img.setVisible(level > 0).setTint(tone);
      }
      if (!lights) {
        for (const g of glints) g.img.setVisible(false);
        for (const q of sweepPx) q.setVisible(false);
      }
      // ---- vent puffs
      if (t >= nextPuff && art.vents.length) {
        nextPuff = t + 7000 + rnd() * 7000;
        const p = puffs.find((q) => !q.alive);
        if (p) {
          const v = art.vents[Math.floor(rnd() * art.vents.length)];
          p.alive = true;
          p.t0 = t;
          p.x = v.x;
          p.y = v.y;
          p.dir = v.dir;
        }
      }
      for (const p of puffs) {
        if (!p.alive) continue;
        const f = Math.floor((t - p.t0) / 120);
        if (f > 3) {
          p.alive = false;
          p.img.setVisible(false);
          continue;
        }
        p.img.setFrame(`puff:${f}`).setPosition(Math.round(p.x - 4 + p.dir * f), Math.round(p.y - 4 + f)).setVisible(true);
      }
      if (!lights) return;
      // ---- the light sweep along a rim lip
      if (sweep.face < 0 && t >= sweep.next && art.rim.length) {
        sweep.face = Math.floor(rnd() * art.rim.length);
        sweep.s = 0;
        sweep.speed = 0.11 + rnd() * 0.05;
      }
      if (sweep.face >= 0) {
        const path = art.rim[sweep.face];
        sweep.s += sweep.speed * dt;
        const head = Math.floor(sweep.s);
        sweepPx.forEach((q, i) => {
          const k = head - i;
          const at = k >= 0 && k < path.length ? path[k] : null;
          if (at) q.setPosition(at.x, at.y).setVisible(true);
          else q.setVisible(false);
        });
        if (head - sweepPx.length > path.length) {
          sweep.face = -1;
          sweep.next = t + 9000 + rnd() * 6000;
          for (const q of sweepPx) q.setVisible(false);
        }
      }
      // ---- corner glints: 0,1,2,1,0 at 90 ms, each corner on its own clock
      for (const g of glints) {
        if (g.at < 0 && t >= g.next) g.at = t;
        if (g.at >= 0) {
          const f = Math.floor((t - g.at) / 90);
          if (f > 4) {
            g.at = -1;
            g.next = t + 6500 + rnd() * 4000;
            g.img.setVisible(false);
          } else g.img.setFrame(`glint:${f <= 2 ? f : 4 - f}`).setVisible(true);
        }
      }
    },
    destroy() {
      destroyed = true;
      if (pending) pending.done();
      pending = null;
    },
  };
  return layer;
}
