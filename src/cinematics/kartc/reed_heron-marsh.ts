// Sazlık Balıkçılı (reed_heron) — the marsh that stays on its tile while it is on the board (the unit's
// 'heronMarsh' aura; attached by ./reed_heron.ts when the summon ends and whenever a face-up heron is seen without
// one). Registers nothing. ?look=v3 only (the caller gates it). Flat palette pixels, the scene clock, no alpha.
//
//   - the negative pool: a night2 multiply pool on the tile — the still water is the darkest floor patch in the
//     game, and it stays that way in play (oturum-c-tasarim §2.2 Light, §0.4.3);
//   - the ambient mist: three low stepped bands (2 rows, steel over night4) framing the pond on both sides, drifting
//     1 px every 400 ms (a bounded ±2 px sway, never more than 4 px past the tile); frozen by the strike's freeze;
//   - the idle soundscape (§2.2 idle bed, §0.5): ambient ticks only while he idles — the drop "plip" on idle f13,
//     a distant frog croak, a reed swell — at most one per 4 s, never within 1.5 s of any contact on the board.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { Disposable } from '../../duel/types';
import { lightPool, type LightHandle } from '../../view/light';
import { TILE_H, TILE_W, unitDepth } from '../../view/layout';
import { Px, onFrame } from '../../vfx/combat';
import { panAt, play } from '../_v3/sound';
import { hash, paintFog } from './reed_heron-fx';

const rnd = Math.round;
const DBG = typeof location !== 'undefined' && location.search.includes('rhrdbg');
export const MARSH = 'heronMarsh';
/** The idle frame whose drop falls from the beak (reed_heron-anims DROP: f13 falls). */
const DROP_F = 13;
const TICK_GAP_MS = 4000;
const CONTACT_QUIET_MS = 1500;

export class MarshAura implements Disposable {
  private readonly pool: LightHandle;
  private readonly back: Px;
  private readonly front: Px;
  private readonly stop: () => void;
  private dead = false;
  private frozenUntil = -1;
  private frozenOff = 0;
  private el = 0;
  private quietUntil = 0;
  private nextTick: number;
  private kind = 0;
  private lastIdleF = -1;
  private readonly onContact = () => {
    this.quietUntil = this.el + CONTACT_QUIET_MS;
  };

  constructor(
    readonly scene: Phaser.Scene,
    readonly u: MonsterUnit,
    o: { instant?: boolean } = {},
  ) {
    const h = u.home;
    this.pool = lightPool(scene, h.x, h.y, { color: PAL.night2, radius: 30, intensity: o.instant ? 1 : 0, blend: 'multiply', fadeIn: 0, spill: null });
    if (!o.instant) this.pool.setIntensity(1, 360);
    this.back = new Px(scene.add.graphics().setDepth(unitDepth(h.y) - 0.3));
    this.front = new Px(scene.add.graphics().setDepth(unitDepth(h.y) + 0.3));
    this.nextTick = 1800 + hash(u.uid, 3) * 1600;
    scene.events.on('v3:contact', this.onContact);
    this.stop = onFrame(scene, (dt) => this.tick(dt), () => this.kill());
  }

  /** The strike's dead freeze: the bands hold still for `ms` of scene time. */
  freeze(ms: number): void {
    this.frozenOff = this.drift(this.el);
    this.frozenUntil = this.el + ms;
  }

  private drift(el: number): number {
    if (el < this.frozenUntil) return this.frozenOff;
    // 1 px every 400 ms, a triangle 0 … 4 … 0 (bounded: the bank never leaves the tile)
    const k = Math.floor(el / 400) % 8;
    return (k < 4 ? k : 8 - k) - 2;
  }

  private tick(dt: number): boolean {
    if (this.dead) return false;
    this.el += dt;
    const u = this.u;
    const s = u.sprite;
    this.back.clear();
    this.front.clear();
    if (u.retired || !s.active) return false;
    if (!u.visible) return true;
    const h = u.home;
    const d = this.drift(this.el);

    // three low bands on the tile, where the sprite's own pond does not hide them: one behind him just past the
    // pond's far rim, two side wisps flanking the pond at the waterline, one in front between the near rim and the
    // badge; each ends ≤ 4 px past the tile's diamond at its height
    const half = TILE_W / 2;
    const rows: [number, 0 | 1, number, number][] = [
      [-9, 0, 61, 0],
      [-1, 1, 63, 26],
      [8, 1, 67, 0],
    ];
    rows.forEach(([dy, layer, seed, hole], i) => {
      const hw = rnd(half * (1 - Math.abs(dy) / (TILE_H / 2))) + 4;
      const off = d * (i % 2 ? -1 : 1);
      const L = layer ? this.front : this.back;
      // (2 solid steel rows, Bayer-frayed ends, broken in 4-px cells: legible over the dark floor)
      const holes = hole ? [[h.x - hole + off, h.x + hole + off] as const] : undefined;
      paintFog(L, { x0: h.x - hw + off, x1: h.x + hw + off, y: h.y + dy - 1, h: 2, off: off * 3 + i * 7, seed, holes });
    });
    this.idleSound();
    return true;
  }

  /** One ambient tick at a time (≥ 4 s apart), only while he idles and the board is quiet. */
  private idleSound(): void {
    const u = this.u;
    const fi = u.frameInfo();
    const idle = fi.anim === 'idle' && u.sprite.visible;
    const f = idle ? fi.frame : -1;
    const changed = f !== this.lastIdleF;
    this.lastIdleF = f;
    if (!idle || this.el < this.nextTick || this.el < this.quietUntil) return;
    const pan = panAt(u.home.x);
    const k = this.kind % 3;
    if (k === 0) {
      // the drop: waits for the frame that draws it
      if (!changed || f !== DROP_F) return;
      play('heronDrop', { volume: 0.8, pan });
    } else if (k === 1) play('heronIdleFrog', { volume: 0.8, pan: Math.max(-1, Math.min(1, pan + (hash(u.uid, this.kind) - 0.5))) });
    else play('heronIdleReed', { volume: 0.8, pan });
    this.kind++;
    this.nextTick = this.el + TICK_GAP_MS + hash(u.uid, this.kind, 5) * 2500;
  }

  private kill(): void {
    if (DBG) console.warn(`[rhr] marsh killed el ${Math.round(this.el)}`);
    this.dead = true;
    this.scene.events.off('v3:contact', this.onContact);
    this.back.g.destroy();
    this.front.g.destroy();
    void this.pool.fadeOut(220);
  }

  destroy(): void {
    if (this.dead) return;
    this.stop();
    this.kill();
  }
}

/** The heron's marsh aura, if it has one. */
export function marshOf(u: MonsterUnit): MarshAura | null {
  const a = u.aura(MARSH);
  return a instanceof MarshAura ? a : null;
}

/** Give a heron its marsh (no-op when it already has one, is retired or hidden). */
export function ensureMarsh(sc: Phaser.Scene, u: MonsterUnit, o: { instant?: boolean } = {}): void {
  if (DBG) console.warn(`[rhr] ensureMarsh retired ${u.retired} active ${u.sprite.active} has ${!!marshOf(u)}`);
  if (u.retired || !u.sprite.active || marshOf(u)) return;
  u.setAura(MARSH, new MarshAura(sc, u, o));
}
