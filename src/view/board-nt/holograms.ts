// Neon Tower layer: HOLOGRAMS — owner B2.
// Readability pass: hologram statues are kept, much dimmer and more transparent, sitting calmly inside the fog.

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
import { monsterArt } from '../../art/monsters';
import { type PixelCanvas } from '../../art/pixel';
import { monsterFrame, whenMonstersBuilt } from '../../art/textures';
import { packAtlas, hash01, type NtAtlas } from '../../art/arena-nt/wall-kit';
import type { GameEvent, PlayerId } from '../../engine/types';
import { HOLOS, NT_DEPTH } from './layout-nt';
import type { NtCtx, NtLayer } from './layer';
import { ensureNtTexture } from './textures';

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

const TIMING = [
  { dwell: 340, flickP: 1900, flickOff: 400, tearP: 5100, tearOff: 1300, phase: 0 },
  { dwell: 410, flickP: 2300, flickOff: 1500, tearP: 6300, tearOff: 3900, phase: 1300 },
] as const;
const FLARE_MS = 420;
const MOTES = 4;
const SLICE_MS = 3;
const IDLE_FRAMES = [8, 6] as const;

interface Station {
  side: 0 | 1;
  frames: string[];
  box: Box | null;
  anchor: { x: number; y: number };
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
  rows: number;
  ready: boolean;
  flareAt: number;
  last: { fname: string; mat: boolean; ring: number; hide: number; dx: number; tear: string; floor: number; beam: string };
}

export function flickerStep(side: 0 | 1, t: number): 0 | 1 | 2 | 3 {
  const tm = TIMING[side];
  const u = t + tm.flickOff;
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
    add(scene.add.image(cx - PED_AT.x, cy - PED_AT.y, NT_HOLO_KEY, pedName(side)).setOrigin(0).setDepth(Z.ped));
    const ring = add(scene.add.image(cx, cy, NT_HOLO_KEY, ringName(side, 0)).setDepth(Z.ring));
    const cone = add(scene.add.image(cx, cy - 2, NT_HOLO_KEY, coneName(side)).setOrigin(0.5, 1).setDepth(Z.cone));
    const hot = [0, 1].map(() => add(scene.add.image(cx, cy, NT_HOLO_KEY, hotName(side)).setDepth(Z.hot).setVisible(false)));
    const floor = add(scene.add.image(cx, cy, NT_HOLO_KEY, flareName(side, 0)).setDepth(Z.floor).setVisible(false));
    const beam = add(scene.add.image(cx, cy - 2, NT_HOLO_KEY, beamName(side)).setOrigin(0.5, 1).setDepth(Z.beam).setVisible(false));
    const motes = add(scene.add.blitter(0, 0, NT_HOLO_KEY).setDepth(Z.motes));
    const moteBobs = Array.from({ length: MOTES }, (_, i) => {
      const b = motes.create(cx, cy, moteName(side, i % MOTE_FRAMES));
      b.visible = false;
      return b;
    });
    return {
      side,
      frames: [],
      box: null,
      anchor: { x: 0, y: 0 },
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

  const jobs: (() => void)[] = [];
  let started = false;
  function planBake(): void {
    for (const st of stations) {
      const spec = HOLOS[st.side];
      const art = monsterArt(spec.monster);
      const look = HOLO_LOOKS[st.side];
      const n = art.anims.idle.frames;
      const count = IDLE_FRAMES[st.side];
      const idx: number[] = [];
      for (let i = 0; i < count; i++) idx.push(Math.round((i * n) / count) % n);
      const src: PixelCanvas[] = [];
      for (const i of idx) jobs.push(() => void src.push(monsterFrame(spec.monster, 'idle', i)));
      const baked: [string, PixelCanvas][] = [];
      let box: Box | null = null;
      jobs.push(() => (box = unionBounds(src)));
      idx.forEach((_, j) => jobs.push(() => box && baked.push([`f${j}`, bakeHoloFrame(src[j], box, look, j, idx.length, src[0])])));
      jobs.push(() => {
        if (!box) return;
        const f0 = baked.find((b) => b[0] === 'f0')![1];
        baked.push(['d1', dimFrame(f0, 1)], ['d2', dimFrame(f0, 2)]);
      });
      jobs.push(() => box && baked.push(['flash', bakeHoloFlash(src[0], box, look)]));
      jobs.push(() => {
        if (!box || destroyed) return;
        const sz = holoSize(box, look);
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
        st.anchor = holoAnchor({ x: art.anchorX, y: art.anchorY }, box, look);
        const p = spec.pedestal;
        const ox = p.cx - st.anchor.x;
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

  function update(st: Station, t: number): void {
    const h = HOLOS[st.side];
    const { cy } = h.pedestal;
    const tm = TIMING[st.side];
    const L = st.last;
    const flareAgo = t - st.flareAt;
    const flaring = flareAgo >= 0 && flareAgo < FLARE_MS;

    const rk = Math.floor(t / (flaring ? 60 : 220) + st.side * 2) % RING_FRAMES;
    if (rk !== L.ring) {
      L.ring = rk;
      st.ring.setFrame(ringName(st.side, rk));
    }
    st.cone.setVisible(lit);
    st.cone.setY(cy - 2 - (Math.floor(t / 520 + st.side) % 2));

    for (let i = 0; i < MOTES; i++) {
      st.moteBobs[i].visible = false;
    }

    const fk = flaring ? Math.min(FLARE_FRAMES - 1, Math.floor(flareAgo / 62)) : -1;
    if (fk !== L.floor) {
      L.floor = fk;
      if (fk < 0) st.floor.setVisible(false);
      else st.floor.setFrame(flareName(st.side, fk)).setVisible(true);
    }
    for (let j = 0; j < 2; j++) {
      st.hot[j].setVisible(false);
    }
    if (L.beam !== '') {
      st.beam.setVisible(false);
      L.beam = '';
    }

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
    const fl = flickerStep(st.side, t);
    let frame = st.frames[idx];
    let hide = 0;
    if (flaring && flareAgo < 110) frame = 'flash';
    else if (!flaring) {
      if (fl === 1) frame = 'd1';
      else if (fl === 2) frame = 'd2';
      else if (fl === 3) hide = 1;
    }
    if (frame !== L.fname) {
      L.fname = frame;
      c.setFrame(frame);
    }
    if (hide !== L.hide) {
      L.hide = hide;
      c.setVisible(hide === 0);
    }
    tr.setVisible(false);
  }

  return {
    name: 'holograms',
    owner: 'B2',
    tick(dt: number, t: number): void {
      now = t;
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
