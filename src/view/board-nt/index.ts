// BoardViewNt — the "Neon Tower" arena of the v3 look (docs/v3/ARENA_NEON_TOWER.md). Opt-in during
// development: ?look=v3&arena=nt (flag.ts). Same public surface as BoardViewCalm (api.ts), so
// src/view/BoardView.ts holds either behind ArenaViewApi.
//
// SKELETON (this commit): the floor ENGINE is BoardViewCalm — it still draws everything it drew
// before (so the game plays and looks exactly like the current v3 arena) and answers every call; the
// nine layers (platform, floor, pads, wall, stands, crowd, screens, holograms, lights) exist as files
// with owner headers and placeholders. As each layer becomes real its owner flips the matching
// `skip` flag in NT_SKIP below (docs §8) and the calm part it replaces disappears:
//   wall + stands  → skip.background   (ink base, four bg masks, stars)
//   platform       → skip.slab         (slab image + neon trim pieces)
// Slots / highlights / flashes / pulses / the volcano theme stay in BoardViewCalm (zoneAt and
// tileImage stay aligned by construction) until the floor layer re-skins its pad frames (§7).

import Phaser from 'phaser';
import type { ArenaTheme, ZoneHit } from '../../art/arena';
import type { GameEvent, PlayerId } from '../../engine/types';
import type { BoardSpot } from '../layout';
import { BoardViewCalm, type BoardViewCalmOptions } from '../board-calm/BoardViewCalm';
import type { ArenaViewApi, CrowdReaction } from './api';
import { drawNtDebug } from './debug';
import { NT_DEBUG } from './flag';
import type { CinematicContext } from '../../cinematics/_core/types';
import { type NtEventInfo, type NtLayer, makeCtx } from './layer';
import { createCrowdLayer } from './crowd';
import { createFloorLayer } from './floor';
import { createHologramsLayer } from './holograms';
import { createLightsLayer } from './lights';
import { createPadsLayer } from './pads';
import { createPlatformLayer } from './platform';
import { createScreensLayer } from './screens';
import { createStandsLayer } from './stands';
import { createWallLayer } from './wall';

type Img = Phaser.GameObjects.Image;

/** Which parts of the calm arena the Neon Tower layers have replaced so far (skeleton: none). */
export const NT_SKIP: NonNullable<BoardViewCalmOptions['skip']> = { background: true, slabImage: true };

export class BoardViewNt implements ArenaViewApi {
  readonly scene: Phaser.Scene;
  private readonly calm: BoardViewCalm;
  private readonly objs: Phaser.GameObjects.GameObject[] = [];
  private readonly layers: NtLayer[];
  private t = 0;
  private destroyed = false;
  private unobserve: (() => void) | null = null;

  constructor(scene: Phaser.Scene, opts: BoardViewCalmOptions = {}) {
    this.scene = scene;
    this.calm = new BoardViewCalm(scene, { ...opts, skip: { ...NT_SKIP, ...opts.skip } });
    const ctx = makeCtx(scene, this.objs);
    // far → near (the order is only bookkeeping: depth comes from NT_DEPTH)
    this.layers = [
      createWallLayer(ctx),
      createStandsLayer(ctx),
      createCrowdLayer(ctx),
      createScreensLayer(ctx),
      createHologramsLayer(ctx),
      createPlatformLayer(ctx),
      createFloorLayer(ctx),
      createPadsLayer(ctx),
      createLightsLayer(ctx),
    ];
    // the board is built dark for the intro (BoardView lights:false): the layers start dark too
    if (opts.lights === false) for (const l of this.layers) void l.setLights?.(false, false);
    if (NT_DEBUG > 0) drawNtDebug(scene, ctx.add);
    // game events for the reaction layers (crowd, holograms, screens): the cinematic observers see every event
    void import('../../cinematics/_core/registry')
      .then((r) => {
        if (this.destroyed) return;
        this.unobserve = r.registerObserver((ev, cctx) => this.onGameEvent(ev, cctx));
      })
      .catch((e) => console.error('[arena-nt] observer failed', e));
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  // ================================================================ ArenaViewApi (delegated to the floor engine)

  get theme(): ArenaTheme {
    return this.calm.theme;
  }

  get activePlayer(): PlayerId | null {
    return this.calm.activePlayer;
  }

  zoneAt(x: number, y: number): ZoneHit | null {
    return this.calm.zoneAt(x, y);
  }

  tileImage(player: PlayerId, spot: BoardSpot, index = 0): Img | null {
    return this.calm.tileImage(player, spot, index);
  }

  highlightZone(player: PlayerId, spot: BoardSpot, index: number, color: number | null): void {
    this.calm.highlightZone(player, spot, index, color);
  }

  clearHighlights(): void {
    this.calm.clearHighlights();
  }

  flashTile(player: PlayerId, spot: BoardSpot, index: number, color: number, ms?: number): Promise<void> {
    return this.calm.flashTile(player, spot, index, color, ms);
  }

  pulseSide(player: PlayerId): Promise<void> {
    return this.calm.pulseSide(player);
  }

  setActivePlayer(player: PlayerId | null, animate = true): void {
    this.calm.setActivePlayer(player, animate);
    for (const l of this.layers) l.setActivePlayer?.(player);
  }

  setTheme(theme: ArenaTheme, animate = true, from: PlayerId | null = null): Promise<void> {
    return this.calm.setTheme(theme, animate, from);
  }

  async setLights(on: boolean, animate = true): Promise<void> {
    await Promise.all([this.calm.setLights(on, animate), ...this.layers.map((l) => l.setLights?.(on, animate))]);
  }

  setTurn(turn: number | null): void {
    this.calm.setTurn(turn);
  }

  /** The crowd reacts (Neon Tower; BoardView.crowd forwards here). `power` 0.5 … 2. */
  crowd(kind: CrowdReaction, side: PlayerId | null = null, power = 1): void {
    for (const l of this.layers) l.crowd?.(kind, side, power);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unobserve?.();
    this.unobserve = null;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    for (const l of this.layers) l.destroy();
    for (const o of this.objs) o.destroy();
    this.objs.length = 0;
    this.calm.destroy();
  }

  // ================================================================ internals

  private onGameEvent(ev: GameEvent, cctx?: CinematicContext): void {
    if (this.destroyed) return;
    const info: NtEventInfo = {};
    if (ev.type === 'attackDeclare') {
      try {
        info.attackerAttribute = cctx?.monster(ev.attackerUid)?.attribute ?? null;
      } catch {
        info.attackerAttribute = null;
      }
    }
    for (const l of this.layers) l.onGameEvent?.(ev, info);
  }

  private tick(_time: number, delta: number): void {
    if (this.destroyed) return;
    const dt = Math.min(50, delta) * this.scene.time.timeScale;
    this.t += dt;
    for (const l of this.layers) l.tick?.(dt, this.t);
  }
}
