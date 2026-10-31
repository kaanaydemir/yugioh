// Neon Tower layer: HOLOGRAMS — owner B2 (docs/v3/ARENA_NEON_TOWER.md §2, §7, §9; J3: big, blue-white and violet, a real flare).
// Two hologram creatures on round pedestals (layout-nt.ts HOLOS), ALWAYS the same two (user decision): left = Kristal Ejder
// (crystal_wyrm, blue-white), right = Uçurum Büyücüsü (abyss_magus, violet/magenta), our own designs. Built from the monsters'
// own v3 idle frames (monsterFrame), enlarged 4/3 and 3/2 with a nearest pass, tone-mapped into six hard bands, scan lines and
// facet glow (no alpha: src/art/arena-nt/holo-bake.ts). The frames are baked AFTER the monster sheets are painted, one small
// job per tick (≤ ~3 ms), and the hologram materialises (drawn in from the head down) when ready.
//
// Idle (calm, but visibly alive at 1×): a slow frame loop (≈ 2.8 s, the two creatures never in step) carrying a lit scan band
// that sweeps head → feet each loop; a flicker every 1.7–3 s (three pre-baked opacity steps: 100 % → 75 % → 50 % → 75 %, 40 ms
// each; sometimes a one-frame drop-out), a tear (a 6-row slice slips 3 px for 70 ms) every ≈ 5 s, a ring of light chasing round
// the pedestal, a dither light cone, twelve digital motes drifting up (three kinds). Reaction: a summon on that side
// (onGameEvent 'summon', the owner's side) = a strong flare in ≤ 420 ms — the whole creature goes white, a light beam shoots up
// through it, three rings expand across the pedestal, two rings climb the creature, a burst of motes — then back to the slow idle.
// Depth: NT_DEPTH.holoPed / holo / holoFx. Everything runs on tick() (no tweens, no timers).

import type Phaser from 'phaser';
import { type Box, HOLO_LOOKS, bakeHoloFlash, bakeHoloFrame, dimFrame, holoAnchor, holoSize, unionBounds } from '../../art/arena-nt/holo-bake';
import {
  BEAM_H,
  BEAM_W,
  CONE_FRAMES,
  CONE_H,
  CONE_W,
  FLARE_FRAMES,
  FLARE_H,
  FLARE_W,
  MOTE_FRAMES,
  NT_HOLO_KEY,
  PED,
  PED_AT,
  RING_FRAMES,
  RING_H,
  RING_W,
  beamName,
  coneName,
  flareName,
  holoStaticBake,
  hotName,
  moteName,
  ntHoloCreatureKey,
  paintHolo,
  pedName,
  ringName,
} from '../../art/arena-nt/holo';
import { MAGUS_ANCHOR, MAGUS_FRAMES, MAGUS_H, MAGUS_W, paintMagusFlash, paintMagusFrame } from '../../art/arena-nt/holo-magus';
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
  ped: NT_DEPTH.holoPed,
  cone: NT_DEPTH.holoPed + 0.3,
  ring: NT_DEPTH.holoPed + 0.6,
  creature: NT_DEPTH.holo,
  tear: NT_DEPTH.holo + 0.1,
  beam: NT_DEPTH.holo + 0.5,
  motes: NT_DEPTH.holoFx,
  floor: NT_DEPTH.holoFx + 0.2,
  hot: NT_DEPTH.holoFx + 0.3,
} as const;

/** Per-side timing: dwell of one idle frame, flicker / tear periods, phase (never in step). */
const TIMING = [
  { dwell: 340, flickP: 1900, flickOff: 400, tearP: 5100, tearOff: 1300, phase: 0 },
  { dwell: 410, flickP: 2300, flickOff: 1500, tearP: 6300, tearOff: 3900, phase: 1300 },
] as const;
const FLARE_MS = 420;
const MOTES = 12;
/** Whole-pixel slice cost budget per tick (ms). */
const SLICE_MS = 3;
/** Frames of the idle loop per creature (memory: each baked frame of the Ejder is ≈ 72 KB, the Büyücü ≈ 36 KB). */
const IDLE_FRAMES = [8, 6] as const;

interface Station {
  side: 0 | 1;
  /** baked creature */
  frames: string[];
  box: Box | null;
  /** feet anchor inside the baked frame */
  anchor: { x: number; y: number };
  /** how far the image was pushed sideways to stay on the screen (px) */
  dx: number;
  creature: Phaser.GameObjects.Image | null;
  tear: Phaser.GameObjects.Image | null;
  ring: Phaser.GameObjects.Image;
  cone: Phaser.GameObjects.Image;
  hot: Phaser.GameObjects.Image[];
  floor: Phaser.GameObjects.Image;
  beam: Phaser.GameObjects.Image;
  motes: Phaser.GameObjects.Blitter;
  moteBobs: Phaser.GameObjects.Bob[];
  moteKey: number[];
  /** materialise progress (rows drawn); the creature is hidden until `ready` */
  rows: number;
  ready: boolean;
  flareAt: number;
  last: { fname: string; mat: boolean; ring: number; hide: number; dx: number; tear: string; floor: number; beam: string };
}

/** Flicker step of the creature at time t: 0 = full, 1 = 75 %, 2 = 50 %, 3 = dropped out (one frame). */
export function flickerStep(side: 0 | 1, t: number): 0 | 1 | 2 | 3 {
  const tm = TIMING[side];
  const u = t + tm.flickOff;
  // a different period each time (1.7 … 3 s of its own), the pattern chosen by the lap number
  const base = tm.flickP;
  const lap = Math.floor(u / base);
  const k = u - lap * base;
  const start = Math.floor(hash01(side * 13 + 5, lap, 3) * (base - 700));
  const a = k - start;
  if (a < 0 || a >= 200) return 0;
  const variant = Math.floor(hash01(side * 7 + 1, lap, 9) * 3);
  const seq: readonly (0 | 1 | 2 | 3)[][] = [
    [1, 2, 1, 0, 2],
    [2, 3, 1, 1, 0],
    [1, 1, 2, 2, 1],
  ];
  return seq[variant][Math.min(4, Math.floor(a / 40))];
}

/** The slipped slice (y of the first row in the baked frame, dx) at time t, or null. */
export function tearAt(side: 0 | 1, t: number, h: number): { y: number; dx: number } | null {
  const tm = TIMING[side];
  const u = t + tm.tearOff;
  const lap = Math.floor(u / tm.tearP);
  const k = u - lap * tm.tearP;
  if (k >= 70) return null;
  return { y: Math.floor(hash01(side * 3 + 2, lap, 5) * (h - 14)) + 4, dx: lap % 2 === 0 ? 3 : -3 };
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
    // the round pedestal, the light ring on its top, the cone (above the pedestal, below the creature)
    add(scene.add.image(cx - PED_AT.x, cy - PED_AT.y, NT_HOLO_KEY, pedName(side)).setOrigin(0).setDepth(Z.ped));
    const ring = add(scene.add.image(cx, cy, NT_HOLO_KEY, ringName(side, 0)).setDepth(Z.ring));
    const cone = add(scene.add.image(cx, cy - 2, NT_HOLO_KEY, coneName(side)).setOrigin(0.5, 1).setDepth(Z.cone));
    const hot = [0, 1].map(() => add(scene.add.image(cx, cy, NT_HOLO_KEY, hotName(side)).setDepth(Z.hot).setVisible(false)));
    const floor = add(scene.add.image(cx, cy, NT_HOLO_KEY, flareName(side, 0)).setDepth(Z.floor).setVisible(false));
    const beam = add(scene.add.image(cx, cy - 2, NT_HOLO_KEY, beamName(side)).setOrigin(0.5, 1).setDepth(Z.beam).setVisible(false));
    const motes = add(scene.add.blitter(0, 0, NT_HOLO_KEY).setDepth(Z.motes));
    const moteBobs = Array.from({ length: MOTES }, (_, i) => motes.create(cx, cy, moteName(side, i % MOTE_FRAMES)));
    return {
      side,
      frames: [],
      box: null,
      anchor: { x: 0, y: 0 },
      dx: 0,
      creature: null,
      tear: null,
      ring,
      cone,
      hot,
      floor,
      beam,
      motes,
      moteBobs,
      moteKey: Array(MOTES).fill(-1),
      rows: 0,
      ready: false,
      flareAt: -9999,
      last: { fname: '', mat: false, ring: -1, hide: -1, dx: 0, tear: '', floor: -1, beam: '' },
    };
  });

  // ---------------------------------------------------------------- baking, one small job per tick
  const jobs: (() => void)[] = [];
  let started = false;
  function planBake(): void {
    for (const st of stations) {
      const spec = HOLOS[st.side];
      const look = HOLO_LOOKS[st.side];
      // the right station paints its own hooded wizard (holo-magus.ts); the left one bakes the monster's own idle frames
      const own = spec.monster === 'abyss_magus';
      const art = monsterArt(spec.monster);
      const n = art.anims.idle.frames;
      const count = own ? MAGUS_FRAMES : IDLE_FRAMES[st.side];
      const idx: number[] = [];
      for (let i = 0; i < count; i++) idx.push(Math.round((i * n) / count) % n);
      const src: PixelCanvas[] = [];
      const baked: [string, PixelCanvas][] = [];
      let box: Box | null = null;
      if (own) {
        box = { x: 0, y: 0, w: MAGUS_W, h: MAGUS_H };
        idx.forEach((_, j) => jobs.push(() => baked.push([`f${j}`, paintMagusFrame(j, count)])));
        jobs.push(() => baked.push(['flash', paintMagusFlash()]));
      } else {
        for (const i of idx) jobs.push(() => void src.push(monsterFrame(spec.monster, 'idle', i)));
        jobs.push(() => (box = unionBounds(src)));
        idx.forEach((_, j) => jobs.push(() => box && baked.push([`f${j}`, bakeHoloFrame(src[j], box, look, j, idx.length, src[0])])));
        jobs.push(() => box && baked.push(['flash', bakeHoloFlash(src[0], box, look)]));
      }
      // the opacity steps of the flicker (from the first pose), the flash of a summon
      jobs.push(() => {
        if (!box) return;
        const f0 = baked.find((b) => b[0] === 'f0')![1];
        baked.push(['d1', dimFrame(f0, 1)], ['d2', dimFrame(f0, 2)]);
      });
      jobs.push(() => {
        if (!box || destroyed) return;
        const sz = own ? { w: MAGUS_W, h: MAGUS_H } : holoSize(box, look);
        let atlas: NtAtlas = packAtlas(baked, sz.w + 1);
        for (let k = 2; k <= 4; k++) {
          const a = packAtlas(baked, (sz.w + 1) * k);
          if (a.canvas.w * a.canvas.h < atlas.canvas.w * atlas.canvas.h) atlas = a;
        }
        const key = ntHoloCreatureKey(st.side);
        ensureNtTexture(scene, 'holograms', key, () => atlas.canvas);
        const tex = scene.textures.get(key);
        for (const [name, r] of Object.entries(atlas.frames)) if (!tex.has(name)) tex.add(name, 0, r.x, r.y, r.w, r.h);
        st.frames = idx.map((_, j) => `f${j}`);
        st.box = { x: 0, y: 0, w: sz.w, h: sz.h };
        // the feet (anchor) inside the baked frame
        st.anchor = own ? { x: MAGUS_ANCHOR.x, y: MAGUS_ANCHOR.y } : holoAnchor({ x: art.anchorX, y: art.anchorY }, box, look);
        // the creature stays whole on the screen: the dragon's tail reaches left of its feet, so its image is pushed in
        const p = spec.pedestal;
        const ox = Math.max(5, Math.min(635 - sz.w, p.cx - st.anchor.x));
        st.dx = ox - (p.cx - st.anchor.x);
        const oy = p.cy - 1 - st.anchor.y;
        st.creature = ctx.add(scene.add.image(ox, oy, key, 'f0').setOrigin(0).setDepth(Z.creature).setVisible(false));
        st.tear = ctx.add(scene.add.image(ox, oy, key, 'f0').setOrigin(0).setDepth(Z.tear).setVisible(false));
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

  const hashPos = (side: 0 | 1, i: number, lap: number): { x: number; w: number } => ({ x: Math.round((hash01(side * 31 + i, lap, 7) - 0.5) * 92), w: 1 });

  function update(st: Station, t: number): void {
    const h = HOLOS[st.side];
    const { cx, cy } = h.pedestal;
    const tm = TIMING[st.side];
    const L = st.last;
    const flareAgo = t - st.flareAt;
    const flaring = flareAgo >= 0 && flareAgo < FLARE_MS;

    // ---- ring chase (fast during the flare), cone
    const rk = Math.floor(t / (flaring ? 60 : 170) + st.side * 2) % RING_FRAMES;
    if (rk !== L.ring) {
      L.ring = rk;
      st.ring.setFrame(ringName(st.side, rk));
    }
    st.cone.setVisible(lit);
    // the cone's streaks drift up a pixel now and then (a shimmer without a second texture)
    st.cone.setY(cy - 2 - (Math.floor(t / 520 + st.side) % 2));

    // ---- motes: climb, restart at a new place each lap (3.5× faster burst while flaring)
    const speed = flaring ? 3.5 : 1;
    const top = h.pedestal.cy - h.box.y;
    for (let i = 0; i < MOTES; i++) {
      const period = 2400 + i * 330;
      const u = (t * speed + i * 977 + tm.phase) / period;
      const lap = Math.floor(u);
      const f = u - lap;
      const p = hashPos(st.side, i, lap);
      const x = cx + p.x;
      const y = cy - 6 - Math.floor(f * (top - 6));
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

    // ---- the flare: floor rings, the climbing rings, the beam
    const fk = flaring ? Math.min(FLARE_FRAMES - 1, Math.floor(flareAgo / 62)) : -1;
    if (fk !== L.floor) {
      L.floor = fk;
      if (fk < 0) st.floor.setVisible(false);
      else st.floor.setFrame(flareName(st.side, fk)).setVisible(true);
    }
    for (let j = 0; j < 2; j++) {
      const im = st.hot[j];
      const a = flareAgo - 40 - j * 80;
      if (!flaring || a < 0 || a > 240) im.setVisible(false);
      else im.setVisible(true).setY(cy - Math.floor((a / 240) * (top - 4)));
    }
    let bk = '';
    if (flaring && flareAgo < 360) {
      // the beam: shoots up in 70 ms, then pulses narrower (30 → 22 → 14 → 8 px) and thins out
      const w = flareAgo < 90 ? BEAM_W : flareAgo < 180 ? 22 : flareAgo < 270 ? 14 : 8;
      const rise = Math.min(BEAM_H, Math.floor((flareAgo / 70) * BEAM_H));
      bk = `${w}:${rise}`;
      if (bk !== L.beam) st.beam.setCrop((BEAM_W - w) / 2, BEAM_H - rise, w, rise).setVisible(true);
    } else if (L.beam !== '') st.beam.setVisible(false);
    L.beam = bk;

    // ---- the creature
    const c = st.creature;
    if (!c) return;
    const tr = st.tear!;
    if (!lit || st.rows < 0) {
      c.setVisible(false);
      tr.setVisible(false);
      return;
    }
    const box = st.box!;
    const rows = Math.min(box.h, Math.floor(st.rows));
    if (rows < box.h) {
      // materialising: drawn in from the head down
      c.setVisible(rows > 0);
      if (rows > 0) c.setCrop(0, 0, box.w, rows);
      L.mat = true;
      tr.setVisible(false);
      return;
    }
    if (L.mat) {
      L.mat = false;
      c.setCrop();
      L.hide = -1;
    }
    const idx = Math.floor((t + tm.phase) / tm.dwell) % st.frames.length;
    // the flash of a summon (white), else the flicker's opacity step, else the loop frame
    const fl = flickerStep(st.side, t);
    let frame = st.frames[idx];
    let hide = 0;
    if (flaring && flareAgo < 110) frame = 'flash';
    else if (!flaring) {
      if (fl === 1) frame = 'd1';
      else if (fl === 2) frame = 'd2';
      else if (fl === 3) hide = 1;
    }
    // the flare blinks the creature once between the flash and the settle
    if (flaring && flareAgo >= 110 && flareAgo < 150) hide = 1;
    if (frame !== L.fname) {
      L.fname = frame;
      c.setFrame(frame);
    }
    if (hide !== L.hide) {
      L.hide = hide;
      c.setVisible(hide === 0);
    }
    // a tear: a 6-row slice of the creature slips sideways for 70 ms (drawn over the creature)
    const ts = flaring ? null : tearAt(st.side, t, box.h);
    const tk = ts ? `${ts.y}:${ts.dx}:${frame}` : '';
    if (tk !== L.tear) {
      L.tear = tk;
      if (!ts) tr.setVisible(false);
      else {
        tr.setFrame(st.frames[idx]).setCrop(0, ts.y, box.w, 6).setVisible(true);
        tr.setPosition(h.pedestal.cx - st.anchor.x + st.dx + ts.dx, h.pedestal.cy - 1 - st.anchor.y);
      }
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

export { CONE_FRAMES, CONE_H, CONE_W, FLARE_H, FLARE_W, PED, RING_H, RING_W };
