// Sazlık Balıkçılı (reed_heron) — the marsh that stays on its tile while it is on the board (the unit's
// 'heronMarsh' aura; attached by ./reed_heron.ts when the summon ends and whenever a face-up heron is seen without
// one). Registers nothing. ?look=v3 only (the caller gates it). Flat palette pixels, the scene clock, no alpha.
//
//   - the negative pool: a night2 multiply pool on the tile — the still water is the darkest floor patch in the
//     game, and it stays that way in play (oturum-c-tasarim §2.2 Light, §0.4.3);
//   - the ambient mist: five low wisps (3–4-row stepped lenses with a lit mist crest, reed_heron-mist.ts) framing the pond and one across his ankles, drifting
//     1 px every 400 ms (a bounded ±2 px sway, never more than 4 px past the tile); frozen by the strike's freeze;
//   - the idle soundscape (§2.2 idle bed, §0.5): ambient ticks only while he idles — the drop "plip" on idle f13,
//     a distant frog croak, a reed swell — at most one per 4 s, never within 1.5 s of any contact on the board.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { Disposable } from '../../duel/types';
import { lightPool, type LightHandle } from '../../view/light';
import { TILE_W, unitDepth } from '../../view/layout';
import { Px, onFrame } from '../../vfx/combat';
import { panAt, play } from '../_v3/sound';
import { hash } from './reed_heron-fx';
import { paintWisp } from '../../art/monsters-v3/reed_heron-mist';

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

    // the ambient bank: five low wisps on the tile (one crossing his ankles over the pond) (reed_heron-mist.ts: 3-row stepped lenses — a crest, a body, an
    // underside — with Bayer ends, the summon's and the death's mist language), where the sprite's own pond does not
    // hide them: a far one behind him past the pond's far rim, two side wisps flanking the pond at the waterline,
    // a near one in front between the near rim and the badge; clipped ≤ 4 px past the tile's diamond
    const half = TILE_W / 2;
    const clip: [number, number] = [h.x - half - 4, h.x + half + 4];
    const run = (L: Px) => (y: number, x0: number, x1: number, c: number) => void L.run(y, x0, x1, c);
    // [dy, layer 0 back / 1 front, x offset, half width, tone, seed, rows] — every band carries the lit mist crest
    // (tone 0) so the vapour reads at 1× over the dark board; one band crosses his ankles over the pond itself
    const rows: [number, 0 | 1, number, number, 0 | 1, number, number][] = [
      [-12, 0, -2, 22, 0, 61, 4],
      [-2, 1, -26, 11, 0, 63, 3],
      [-2, 1, 28, 11, 0, 64, 3],
      [-7, 1, 1, 15, 0, 65, 3],
      [7, 1, 2, 20, 0, 67, 3],
    ];
    rows.forEach(([dy, layer, ox, hw, tone, seed, rh], i) => {
      const off = d * (i % 2 ? -1 : 1);
      paintWisp(run(layer ? this.front : this.back), { cx: h.x + ox + off, y: h.y + dy - 1, h: rh, hw, lean: 0, seed, tone, clip });
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
