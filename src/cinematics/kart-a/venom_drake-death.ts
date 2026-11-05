// Zehir Ejderi (venom_drake) — the death "Kendi Zehri" (its own venom), docs/v3/kart-a/venom_drake.md §5.4.
// v3 look only. The pose is the art's (13 frames: the reel, the arch locks, the seam web, the holes in three
// steps — the same web it ate its victims with — the lace held, the slump into the pool, the chitin stinger
// standing like a grave marker, the bead falling); the shared death kit (_v3/death.ts) plays it, scores it with
// CHARACTER_SOUNDS.venom_drake and breaks the last frame as shadow with the lane-A 'acid' accent. This file is the
// card's watcher on top:
//   dissolve (f3)   an acid light rises under the body (leaf3), it widens with the holes, then shrinks onto the
//                   stinger at the marker and dims as it sinks
//   f4–f6           one steam thread per hole step rises from the newest holes (sampled from the shown frame)
//   burst           the PUDDLE (an iso ellipse on the front half of the slot: leaf2 surface, void0 depth, a leaf1
//                   rim, bubbles, the hook tip standing in it) boils for 240 ms, then EATS INTO THE TILE in three
//                   steps of 70 ms and stays as the death scar (level 3, 'duel': "nothing grows there again")
// Whole pixels, palette tones only, stepped light, no camera.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, LOOK_V3, TILE_H, TILE_W, type XY } from '../../view/layout';
import { registerCardHook } from '../api';
import { deathV3 } from '../_v3/death';
import { atFrame } from '../_v3/sound';
import { currentPixels, followLight, layer, onFrame, sourceOwnsDestroy, type Ctx } from '../strikes-a/_kit';
import { scarTile, steamThreads, zoneKey } from './venom_drake-acid';

const r = Math.round;
const SX = (v: number) => Math.round((v * TILE_W) / 64);
const SY = (v: number) => Math.round((v * TILE_H) / 32);

/** A few points on the shown frame's body edge that face up (steam leaves the body there), world px. */
function bodyVents(u: MonsterUnit, n: number, salt: number): XY[] {
  if (!u.sprite.active) return [];
  const pc = currentPixels(u).pc;
  const b = pc.bounds();
  if (!b) return [];
  const out: XY[] = [];
  for (let k = 0; k < 60 && out.length < n; k++) {
    const x = b.x + ((k * 37 + salt * 11) % Math.max(1, b.w));
    for (let y = b.y; y < b.y + b.h; y++) {
      if (!pc.isOpaque(x, y)) continue;
      if (!pc.isOpaque(x, y - 1)) {
        const w = u.framePoint(x, y);
        out.push({ x: r(w.x), y: r(w.y) });
      }
      break;
    }
  }
  return out;
}

/** The watcher: the acid light under the dying body and the steam of each hole step. */
function corrodeWatch(u: MonsterUnit, home: XY): void {
  const sc = u.scene;
  let L: ReturnType<typeof followLight> | null = null;
  const at = () => (u.sprite.active && u.sprite.visible ? u.core() : null);
  atFrame(u, 'death', 3, () => {
    L = followLight(sc, at, { color: PAL.leaf3, radius: 18, floorY: home.y, intensity: 0.2, anim: 'flicker', fadeIn: 0 });
    L.setIntensity(1, 300);
  }, { maxMs: 3000 });
  for (const f of [4, 5, 6]) atFrame(u, 'death', f, () => {
    L?.setRadius(22, 11, 200);
    steamThreads(sc, bodyVents(u, f === 6 ? 3 : 2, f), u.sprite.depth + 0.3);
  }, { maxMs: 3000 });
  atFrame(u, 'death', 10, () => L?.setRadius(12, 6, 140), { maxMs: 3000 });
  atFrame(u, 'death', 11, () => L?.setIntensity(0.3, 100), { maxMs: 3000 });
  // the light goes with the body (the puddle carries its own)
  onFrame(sc, (_dt, el) => {
    if (el > 4000 || !u.sprite.active || !u.sprite.visible) {
      if (L) void L.fadeOut(240);
      return false;
    }
    return true;
  });
}

/** The puddle on the burst: it boils, then eats into the tile and becomes the death scar. */
function puddle(sc: Phaser.Scene, home: XY, key: string): void {
  // above the card born on the tile (CARD_ON_TILE), under the shadows and the bodies
  const px = layer(sc, DEPTH.SHADOW - 1);
  const cx = home.x;
  const cy = home.y + SY(3);
  const glow = followLight(sc, () => ({ x: cx, y: cy - 2 }), { color: PAL.leaf3, radius: 16, floorY: cy, intensity: 0.7, anim: 'flicker', fadeIn: 0 });
  let el = 0;
  let scarred = false;
  const BOIL = 240;
  onFrame(sc, (dt) => {
    el += dt;
    px.clear();
    const k = el < BOIL ? 0 : Math.floor((el - BOIL) / 70) + 1;
    if (k >= 4) {
      void glow.fadeOut(200);
      return false;
    }
    if (k >= 1 && !scarred) {
      scarred = true;
      // the scar under it from the first eaten step: the puddle shrinks onto it
      scarTile(sc, key, home, { level: 3, life: 'duel' });
      glow.setIntensity(0.3, 200);
    }
    // the ellipse shrinks onto the scar's rows in three steps
    const rx = [SX(14), SX(12), SX(10), SX(8)][k];
    const ry = [6, 5, 4, 3][k];
    const yy = k === 0 ? cy : r(cy + ((home.y + SY(6) - cy) * k) / 3);
    for (let y = -ry - 1; y <= ry + 1; y++) {
      const w = Math.floor((rx + 1) * Math.sqrt(Math.max(0, 1 - (y * y) / ((ry + 1.4) * (ry + 1.4)))));
      px.run(yy + y, cx - w, cx + w, PAL.leaf1);
    }
    for (let y = -ry; y <= ry; y++) {
      const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / ((ry + 0.4) * (ry + 0.4)))));
      // void0 depth with a leaf2 surface band on the far half (the lit skin of the acid)
      px.run(yy + y, cx - w, cx + w, y < -1 ? PAL.leaf2 : PAL.void0);
    }
    if (k === 0) {
      // the boil: three bubbles stepping 1 px → a plus → gone, each on its own phase
      for (let i = 0; i < 3; i++) {
        const ph = Math.floor((el + i * 80) / 60) % 4;
        const bx = cx - SX(7) + i * SX(7);
        const by = yy + (i === 1 ? 1 : -1);
        if (ph === 0) px.dot(bx, by, PAL.leaf2);
        else if (ph === 1) px.dot(bx, by, PAL.leaf3).dot(bx - 1, by, PAL.leaf2).dot(bx + 1, by, PAL.leaf2).dot(bx, by - 1, PAL.leaf2);
        else if (ph === 2) px.dot(bx - 1, by, PAL.leaf1).dot(bx + 1, by, PAL.leaf1);
      }
      // the hook tip standing in it
      const hx = cx + 2;
      px.dot(hx, yy, PAL.stone2).dot(hx, yy - 1, PAL.stone2).dot(hx, yy - 2, PAL.stone2).dot(hx + 1, yy - 3, PAL.stone3).dot(hx + 1, yy - 1, PAL.ink).dot(hx - 1, yy - 1, PAL.ink);
    } else {
      // the edge etches: night0 bites into the rim, the surface goes dull
      for (let i = 0; i < 4 + k * 2; i++) px.dot(cx - rx + ((i * 7) % (2 * rx + 1)), yy + ((i % 2) ? ry : -ry), PAL.night0);
    }
    return true;
  }, () => px.g.destroy());
}

async function venomDeathV3(ctx: Ctx<'destroy'>): Promise<void> {
  if (ctx.ev.location !== 'monster' || sourceOwnsDestroy(ctx)) return ctx.base();
  const u = ctx.views.field.unit(ctx.ev.uid);
  const key = zoneKey(ctx.ev.player, ctx.ev.zone);
  let home: XY | null = null;
  if (u && !u.retired && u.sprite.active && u.has('death')) {
    home = { ...u.home };
    corrodeWatch(u, home);
  }
  return deathV3(ctx, {
    fallback: () => ctx.base(),
    onBurst: (unit) => puddle(ctx.scene, home ?? { ...unit.home }, key),
  });
}

if (LOOK_V3) registerCardHook('venom_drake', 'destroyed', venomDeathV3, { name: 'kart-a:venom_drake:death' });
