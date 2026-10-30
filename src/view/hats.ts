// Sihirli Şapka (magic_hat) — the hat sprites and the decoy token's look.
//
// A hat is a dusk-violet round-topped top hat with a gold band, drawn in code (PixelCanvas) and kept as an
// Image over its zone's tile. The engine's hatted slots are: the real monster (slot.hat === 'real', face-down
// defense) and "Şapka Tuzağı" decoys (slot.hat === 'decoy', cardId 'magic_hat', face-down defense). FieldView
// shows both as plain face-down cards; the hat covers them. This module owns the hats' bookkeeping:
//
//   hatsSync(scene, state)     // FieldView.sync calls it: a hat over every hatted slot, none elsewhere
//   spawnHat(scene, uid, p, z) // the cinematic builds hats ahead of the state (it owns them while `busy`)
//   getHat(scene, uid)         // lookup by the slot's uid (decoy uid or the real monster's uid)
//   hatPopped / hatDissolve    // vanishing flourishes live in the cinematic (src/cinematics/traps/_hat_v3.ts)
//
// A waiting hat bobs one pixel and hops two when the pointer is over it (the attacker is aiming). Positions
// are whole pixels; no scaling, no rotation (tilts are pre-drawn frames).

import Phaser from 'phaser';
import { PAL } from '../art/palette';
import { PixelCanvas } from '../art/pixel';
import type { GameState, PlayerId, Uid } from '../engine/types';
import { DEPTH, unitDepth, zoneXY } from './layout';

export const HAT_W = 28;
export const HAT_H = 26;
/** Brim centre inside the texture (the hat stands on this point). */
export const HAT_FOOT = 21;

export type HatFrame = 'hat:0' | 'hat:L' | 'hat:R';

function paintHat(): PixelCanvas {
  const p = new PixelCanvas(HAT_W, HAT_H);
  const V = [PAL.void0, PAL.void1, PAL.void2, PAL.void3, PAL.void4];
  const G = [PAL.gold0, PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4];
  // brim (back half, then crown, then the front lip)
  p.ellipse(14, 21, 13, 4, V[1]);
  p.ellipse(14, 20, 12, 3, V[2]);
  // crown: straight sides, round top
  p.rect(6, 9, 16, 12, V[2]);
  p.ellipse(14, 9, 8, 7, V[2]);
  // shading: lit left, shaded right, a dither seam between
  p.rect(16, 5, 6, 16, V[1]);
  p.ellipse(18, 9, 4, 6, V[1]);
  p.rect(6, 8, 2, 12, V[3]);
  p.hline(8, 9, 3, V[4]);
  p.hline(7, 9, 4, V[3]);
  p.set(10, 6, V[4]);
  p.set(9, 7, V[3]);
  for (let y = 6; y < 20; y += 2) p.set(14 + (y % 4 === 0 ? 0 : 1), y, V[1]);
  // gold band with a small buckle
  p.rect(6, 15, 16, 3, G[2]);
  p.hline(6, 15, 15, G[3]);
  p.hline(6, 21, 17, G[1]);
  p.rect(13, 14, 4, 5, G[3]);
  p.rect(14, 15, 2, 3, G[1]);
  p.set(13, 14, G[4]);
  // front lip of the brim (lit)
  p.ellipse(14, 22, 12, 3, V[1]);
  p.hline(4, 24, 20, V[3]);
  p.hline(2, 10, 21, V[3]);
  p.hline(18, 26, 21, V[2]);
  p.outline(PAL.ink);
  return p;
}

/** The hat leaning to one side: the crown rows above the brim shear by up to 4 px (-1 left, +1 right). */
function tilted(src: PixelCanvas, dir: -1 | 1): PixelCanvas {
  const pad = 5;
  const p = new PixelCanvas(HAT_W + pad * 2, HAT_H);
  for (let y = 0; y < HAT_H; y++) {
    const sh = y < HAT_FOOT - 2 ? Math.round(((HAT_FOOT - 2 - y) / (HAT_FOOT - 2)) * 4 * dir) : 0;
    for (let x = 0; x < HAT_W; x++) {
      const c = src.get(x, y);
      if (c !== null) p.set(x + pad + sh, y, c);
    }
  }
  return p;
}

function shadowPx(): PixelCanvas {
  const p = new PixelCanvas(26, 9);
  p.ellipse(13, 4, 12, 4, PAL.ink, 150);
  p.ellipse(13, 4, 8, 3, PAL.ink, 90);
  return p;
}

/** Texture keys; made once per game on first use. */
export function ensureHatTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('hat:0')) return;
  const base = paintHat();
  scene.textures.addCanvas('hat:0', base.toCanvas());
  scene.textures.addCanvas('hat:L', tilted(base, -1).toCanvas());
  scene.textures.addCanvas('hat:R', tilted(base, 1).toCanvas());
  scene.textures.addCanvas('hat:sh', shadowPx().toCanvas());
}

export class Hat {
  readonly img: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Image;
  /** Floor point the hat stands on (its brim centre). */
  x = 0;
  y = 0;
  /** Height above the floor point, whole pixels. */
  lift = 0;
  /** A cinematic is moving it: hatsSync and the idle bob leave it alone. */
  busy = false;
  frame: HatFrame = 'hat:0';
  zone: number;
  hop = 0;
  readonly phase: number;
  constructor(
    readonly scene: Phaser.Scene,
    readonly uid: Uid,
    readonly player: PlayerId,
    zone: number,
  ) {
    ensureHatTextures(scene);
    this.zone = zone;
    this.phase = (uid * 137) % 400;
    this.shadow = scene.add.image(0, 0, 'hat:sh').setOrigin(0.5, 0.5).setDepth(DEPTH.SHADOW + 1);
    this.img = scene.add.image(0, 0, 'hat:0').setOrigin(0.5, HAT_FOOT / HAT_H);
    const z = zoneXY(player, 'monster', zone);
    this.place(z.x, z.y);
  }
  get alive(): boolean {
    return this.img.active;
  }
  /** Put the hat's foot at a floor point (whole pixels), `lift` px up. */
  place(x: number, y: number, lift = 0): void {
    this.x = Math.round(x);
    this.y = Math.round(y);
    this.lift = Math.round(lift);
    this.render();
  }
  setFrame(f: HatFrame): void {
    this.frame = f;
    this.render();
  }
  /** Redraw at the current state (idle bob / hop included). */
  render(bob = 0): void {
    if (!this.img.active) return;
    this.img.setTexture(this.frame);
    this.img.setPosition(this.x, this.y - this.lift - this.hop - bob);
    this.img.setDepth(unitDepth(this.y) + 12);
    const h = this.lift + this.hop + bob;
    this.shadow.setPosition(this.x, this.y + 1);
    this.shadow.setAlpha(h > 14 ? 0.5 : h > 6 ? 0.75 : 1);
    this.shadow.setVisible(this.img.visible);
  }
  setVisible(v: boolean): void {
    this.img.setVisible(v);
    this.shadow.setVisible(v);
  }
  destroy(): void {
    this.img.destroy();
    this.shadow.destroy();
  }
}

class HatSet {
  readonly hats = new Map<Uid, Hat>();
  private off: (() => void) | null = null;
  constructor(readonly scene: Phaser.Scene) {
    const onUpdate = () => this.tick();
    scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
    const kill = () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
      for (const h of this.hats.values()) h.destroy();
      this.hats.clear();
      sets.delete(scene);
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, kill);
    this.off = kill;
  }
  private tick(): void {
    const sc = this.scene;
    let px = -999;
    let py = -999;
    try {
      const p = sc.input.activePointer.positionToCamera(sc.cameras.main) as Phaser.Math.Vector2;
      px = p.x;
      py = p.y;
    } catch {
      /* no pointer */
    }
    const t = sc.time.now;
    for (const h of this.hats.values()) {
      if (h.busy || !h.alive) continue;
      const hover = Math.abs(px - h.x) < 14 && py > h.y - 26 && py < h.y + 5;
      h.hop = hover ? 2 : 0;
      h.render(Math.floor((t + h.phase) / 380) % 2);
    }
  }
  destroy(): void {
    this.off?.();
  }
}

const sets = new WeakMap<Phaser.Scene, HatSet>();

function setOf(scene: Phaser.Scene): HatSet {
  let s = sets.get(scene);
  if (!s) {
    s = new HatSet(scene);
    sets.set(scene, s);
  }
  return s;
}

export function getHat(scene: Phaser.Scene, uid: Uid): Hat | null {
  return sets.get(scene)?.hats.get(uid) ?? null;
}

export function allHats(scene: Phaser.Scene): Hat[] {
  return [...(sets.get(scene)?.hats.values() ?? [])];
}

/** A new hat standing on a zone's tile (replaces a hat of the same uid). */
export function spawnHat(scene: Phaser.Scene, uid: Uid, player: PlayerId, zone: number): Hat {
  const s = setOf(scene);
  s.hats.get(uid)?.destroy();
  const h = new Hat(scene, uid, player, zone);
  s.hats.set(uid, h);
  return h;
}

export function dropHat(scene: Phaser.Scene, uid: Uid): void {
  const s = sets.get(scene);
  const h = s?.hats.get(uid);
  if (!s || !h) return;
  h.destroy();
  s.hats.delete(uid);
}

/** Reconcile with an engine state: every hatted slot has a resting hat, no other hat survives (busy ones stay). */
export function hatsSync(scene: Phaser.Scene, state: GameState): void {
  const want = new Map<Uid, { p: PlayerId; z: number }>();
  for (const p of [0, 1] as PlayerId[])
    state.players[p].monsters.forEach((m, z) => {
      if (m && m.hat) want.set(m.uid, { p, z });
    });
  if (!want.size && !sets.has(scene)) return;
  const s = setOf(scene);
  for (const [uid, h] of [...s.hats]) {
    if (h.busy) continue;
    if (!want.has(uid)) dropHat(scene, uid);
  }
  for (const [uid, w] of want) {
    const h = s.hats.get(uid);
    if (!h || !h.alive) spawnHat(scene, uid, w.p, w.z);
    else if (!h.busy && h.zone !== w.z) {
      h.zone = w.z;
      const z = zoneXY(w.p, 'monster', w.z);
      h.place(z.x, z.y);
    }
  }
}
