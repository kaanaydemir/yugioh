// Neon Tower layer: HOLOGRAMS — owner B2 (docs/v3/ARENA_NEON_TOWER.md §2, §7, §9).
// Two translucent creature holograms on round plinths (layout-nt.ts HOLOS), ALWAYS the same two (user decision):
// left = Kristal Ejder (crystal_wyrm, blue-white), right = Uçurum Büyücüsü (abyss_magus, violet), our own designs.
// Built from the monsters' own v3 idle frames (monsterFrame): recoloured to one ramp, thinned by scan rows and a
// checker (no alpha: see src/art/arena-nt/holo-bake.ts), a bright rim and a lit scan band, 1× integer scale (the
// honest size: the creature is as big as it is on the board). The frames are baked AFTER the monster sheets are
// painted, one small job per tick (≤ ~3 ms), and the hologram materialises (drawn in from the head down) when ready.
//
// Idle (low intensity, calm): a slow frame loop (≈ 3 s, the two creatures never in step), the scan band sweeping
// once per loop, a ring of light chasing round the plinth, a dither light cone with a slow shimmer, six tiny motes
// drifting up, a rare one-frame glitch (hidden / slipped 1 px). Reaction: a summon on that side (onGameEvent
// 'summon', the owner's side) = a short strong flare — one white flash frame, three bright rings climbing the
// creature, the ring spinning fast, a burst of motes (≤ 420 ms), then back to the slow idle.
// Depth: NT_DEPTH.holoPed / holo / holoFx. Everything runs on tick() (no tweens, no timers).

import type Phaser from 'phaser';
import { type Box, HOLO_LOOKS, bakeHoloFlash, bakeHoloFrame, unionBounds } from '../../art/arena-nt/holo-bake';
import {
  CONE_FRAMES,
  CONE_H,
  CONE_W,
  MOTE_FRAMES,
  NT_HOLO_KEY,
  RING_FRAMES,
  RING_H,
  RING_W,
  coneName,
  holoStaticBake,
  hotName,
  moteName,
  ntHoloCreatureKey,
  paintHolo,
  poolName,
  ringName,
} from '../../art/arena-nt/holo';
import { monsterArt } from '../../art/monsters';
import { type PixelCanvas } from '../../art/pixel';
import { monsterFrame, whenMonstersBuilt } from '../../art/textures';
import { packAtlas, hash01, type NtAtlas } from '../../art/arena-nt/wall-kit';
import type { GameEvent, PlayerId } from '../../engine/types';
import { HOLOS, NT_DEPTH } from './layout-nt';
import type { NtCtx, NtLayer } from './layer';
import { ensureNtTexture } from './textures';

/** Register the static hologram atlas once (boot step 28 and, as a fallback, the layer). */
export function ensureHoloTextures(scene: Phaser.Scene): void {
  const bake = holoStaticBake();
  ensureNtTexture(scene, 'holograms', NT_HOLO_KEY, paintHolo);
  const tex = scene.textures.get(NT_HOLO_KEY);
  for (const [name, r] of Object.entries(bake.frames)) if (!tex.has(name)) tex.add(name, 0, r.x, r.y, r.w, r.h);
}

const Z = {
  pool: NT_DEPTH.holoPed,
  cone: NT_DEPTH.holoPed + 0.3,
  ring: NT_DEPTH.holoPed + 0.6,
  creature: NT_DEPTH.holo,
  motes: NT_DEPTH.holoFx,
  hot: NT_DEPTH.holoFx + 0.3,
} as const;

/** Per-side timing: dwell of one idle frame, glitch period, phase (never in step). */
const TIMING = [
  { dwell: 360, glitchP: 5300, glitchOff: 1400, phase: 0 },
  { dwell: 420, glitchP: 6100, glitchOff: 3900, phase: 1300 },
] as const;
const FLARE_MS = 420;
const MOTES = 6;
/** Whole-pixel slice cost budget per tick (ms). */
const SLICE_MS = 3;

interface Station {
  side: 0 | 1;
  /** baked creature */
  frames: string[];
  box: Box | null;
  /** feet anchor inside the baked frame */
  anchor: { x: number; y: number };
  creature: Phaser.GameObjects.Image | null;
  ring: Phaser.GameObjects.Image;
  cone: Phaser.GameObjects.Image;
  hot: Phaser.GameObjects.Image[];
  motes: Phaser.GameObjects.Blitter;
  moteBobs: Phaser.GameObjects.Bob[];
  moteKey: number[];
  /** materialise progress (rows drawn); the creature is hidden until `ready` */
  rows: number;
  ready: boolean;
  flareAt: number;
  last: { fname: string; mat: boolean; ring: number; cone: number; hide: number; dx: number };
}

export function createHologramsLayer(ctx: NtCtx): NtLayer {
  const scene = ctx.scene;
  ensureHoloTextures(scene);
  let now = 0;
  let lit = true;
  let destroyed = false;

  const stations: Station[] = HOLOS.map((h) => {
    const side = h.side;
    const { cx, cy } = h.pedestal;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => ctx.add(o);
    // the plinth's lit top face, the light ring and the cone (cone above the pool, below the creature)
    add(scene.add.image(cx, cy, NT_HOLO_KEY, poolName(side)).setDepth(Z.pool));
    const ring = add(scene.add.image(cx, cy, NT_HOLO_KEY, ringName(side, 0)).setDepth(Z.ring));
    const cone = add(scene.add.image(cx, cy - 2, NT_HOLO_KEY, coneName(side, 0)).setOrigin(0.5, 1).setDepth(Z.cone));
    const hot = [0, 1, 2].map(() => add(scene.add.image(cx, cy, NT_HOLO_KEY, hotName(side)).setDepth(Z.hot).setVisible(false)));
    const motes = add(scene.add.blitter(0, 0, NT_HOLO_KEY).setDepth(Z.motes));
    const moteBobs = Array.from({ length: MOTES }, (_, i) => motes.create(cx, cy, moteName(side, i % MOTE_FRAMES)));
    return { side, frames: [], box: null, anchor: { x: 0, y: 0 }, creature: null, ring, cone, hot, motes, moteBobs, moteKey: Array(MOTES).fill(-1), rows: 0, ready: false, flareAt: -9999, last: { fname: '', mat: false, ring: -1, cone: -1, hide: -1, dx: 0 } };
  });

  // ---------------------------------------------------------------- baking, one small job per tick
  const jobs: (() => void)[] = [];
  let started = false;
  function planBake(): void {
    for (const st of stations) {
      const spec = HOLOS[st.side];
      const art = monsterArt(spec.monster);
      const look = HOLO_LOOKS[st.side];
      const n = art.anims.idle.frames;
      // 8 / 6 frames of the idle loop (slow and calm: ≈ 2.9 / 2.5 s): memory stays small
      const count = st.side === 0 ? 8 : 6;
      const idx: number[] = [];
      for (let i = 0; i < count; i++) idx.push(Math.round((i * n) / count) % n);
      const src: PixelCanvas[] = [];
      for (const i of idx) jobs.push(() => void src.push(monsterFrame(spec.monster, 'idle', i)));
      const baked: [string, PixelCanvas][] = [];
      let box: Box | null = null;
      jobs.push(() => (box = unionBounds(src)));
      idx.forEach((_, j) => jobs.push(() => box && baked.push([`f${j}`, bakeHoloFrame(src[j], box, look, j, idx.length)])));
      jobs.push(() => box && baked.push(['flash', bakeHoloFlash(src[0], box, look)]));
      jobs.push(() => {
        if (!box || destroyed) return;
        let atlas: NtAtlas = packAtlas(baked, box.w + 1);
        for (let k = 2; k <= baked.length; k++) {
          const a = packAtlas(baked, (box.w + 1) * k);
          if (a.canvas.w * a.canvas.h < atlas.canvas.w * atlas.canvas.h) atlas = a;
        }
        const key = ntHoloCreatureKey(st.side);
        ensureNtTexture(scene, 'holograms', key, () => atlas.canvas);
        const tex = scene.textures.get(key);
        for (const [name, r] of Object.entries(atlas.frames)) if (!tex.has(name)) tex.add(name, 0, r.x, r.y, r.w, r.h);
        st.frames = idx.map((_, j) => `f${j}`);
        st.box = box;
        // the feet (anchor) inside the baked frame; the right creature is mirrored
        const ax = art.anchorX - box.x;
        st.anchor = { x: look.flip ? box.w - 1 - ax : ax, y: art.anchorY - box.y };
        const p = spec.pedestal;
        st.creature = ctx.add(scene.add.image(p.cx - st.anchor.x, p.cy - 3 - st.anchor.y, key, 'f0').setOrigin(0).setDepth(Z.creature).setVisible(false));
        st.ready = true;
        st.rows = lit ? 0 : -1;
      });
    }
  }
  void whenMonstersBuilt()
    .then(() => {
      if (!destroyed) {
        planBake();
        started = true;
      }
    })
    .catch((e) => console.error('[arena-nt] hologram bake failed', e));

  const hashPos = (side: 0 | 1, i: number, lap: number): { x: number; w: number } => ({ x: Math.round((hash01(side * 31 + i, lap, 7) - 0.5) * 56), w: 1 });

  function update(st: Station, t: number): void {
    const h = HOLOS[st.side];
    const { cx, cy } = h.pedestal;
    const tm = TIMING[st.side];
    const L = st.last;
    const flareAgo = t - st.flareAt;
    const flaring = flareAgo >= 0 && flareAgo < FLARE_MS;

    // ---- ring chase (fast during the flare), cone shimmer
    const rk = Math.floor(t / (flaring ? 70 : 200) + st.side * 2) % RING_FRAMES;
    if (rk !== L.ring) {
      L.ring = rk;
      st.ring.setFrame(ringName(st.side, rk));
    }
    const ck = Math.floor(t / 700 + st.side) % CONE_FRAMES;
    if (ck !== L.cone) {
      L.cone = ck;
      st.cone.setFrame(coneName(st.side, ck));
    }
    st.cone.setVisible(lit);

    // ---- motes: climb, restart at a new place each lap (4× faster burst while flaring)
    const speed = flaring ? 3.5 : 1;
    for (let i = 0; i < MOTES; i++) {
      const period = 2600 + i * 410;
      const u = (t * speed + i * 977 + tm.phase) / period;
      const lap = Math.floor(u);
      const f = u - lap;
      const p = hashPos(st.side, i, lap);
      const x = cx + p.x;
      const y = cy - 6 - Math.floor(f * 78);
      const key = y * 1000 + x;
      const bob = st.moteBobs[i];
      if (!lit || !st.ready) bob.visible = false;
      else {
        bob.visible = true;
        if (key !== st.moteKey[i]) {
          st.moteKey[i] = key;
          bob.x = x;
          bob.y = y;
        }
      }
    }

    // ---- the flare's rising rings
    for (let j = 0; j < 3; j++) {
      const im = st.hot[j];
      const a = flareAgo - j * 55;
      if (!flaring || a < 0 || a > 260) im.setVisible(false);
      else im.setVisible(true).setY(cy - Math.floor((a / 260) * 62));
    }

    // ---- the creature
    const c = st.creature;
    if (!c) return;
    if (!lit || st.rows < 0) {
      c.setVisible(false);
      return;
    }
    const box = st.box!;
    const rows = Math.min(box.h, Math.floor(st.rows));
    if (rows < box.h) {
      // materialising: drawn in from the head down
      c.setVisible(rows > 0);
      if (rows > 0) c.setCrop(0, 0, box.w, rows);
      L.mat = true;
      return;
    }
    if (L.mat) {
      L.mat = false;
      c.setCrop();
      L.hide = -1;
    }
    const idx = Math.floor((t + tm.phase) / tm.dwell) % st.frames.length;
    const frame = flaring && flareAgo < 90 ? 'flash' : st.frames[idx];
    if (frame !== L.fname) {
      L.fname = frame;
      c.setFrame(frame);
    }
    // a rare glitch: hidden for one frame, then slipped 1 px for another
    const g = (t + tm.glitchOff) % tm.glitchP;
    const hide = g < 40 ? 1 : 0;
    const dx = g >= 40 && g < 90 ? 1 : 0;
    // the flare blinks the creature once between the flash and the settle
    const blink = flaring && flareAgo >= 90 && flareAgo < 150 ? 1 : 0;
    if (hide + blink !== L.hide) {
      L.hide = hide + blink;
      c.setVisible(hide + blink === 0);
    }
    if (dx !== L.dx) {
      L.dx = dx;
      c.setX(h.pedestal.cx - st.anchor.x + dx);
    }
  }

  return {
    name: 'holograms',
    owner: 'B2',
    tick(dt: number, t: number): void {
      now = t;
      // slice the baking: jobs until the per-tick budget is spent
      if (started && jobs.length) {
        const t0 = performance.now();
        do jobs.shift()!();
        while (jobs.length && performance.now() - t0 < SLICE_MS);
      }
      for (const st of stations) {
        if (st.ready && lit && st.box && st.rows >= 0 && st.rows < st.box.h) st.rows += (dt * st.box.h) / 520;
        update(st, t);
      }
    },
    setLights(on: boolean, animate: boolean): Promise<void> {
      lit = on;
      for (const st of stations) st.rows = !on ? -1 : animate ? 0 : st.box ? st.box.h : 0;
      return Promise.resolve();
    },
    onGameEvent(ev: GameEvent): void {
      if (ev.type === 'summon') stations[ev.player as PlayerId].flareAt = now;
    },
    destroy(): void {
      destroyed = true;
    },
  };
}

export { CONE_H, CONE_W, RING_H, RING_W };
