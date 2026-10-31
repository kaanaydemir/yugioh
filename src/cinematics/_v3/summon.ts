// v3 SUMMON BASE (docs/v3/A0_ENVANTER.md §6.2 item 4; A0 G8 "the body is readable only in the last
// 20–30 % of a summon"). The shared part of every entrance under ?look=v3 — summon-a's runSummon /
// Stage and summon-b's entrance() both use it:
//
//   const p = summonPose(scene, unit, { ramp, onLand });   // null: the art has no summon pose
//   await p.land; await p.done;
//   await poseEntrance(stage);                              // the generic v3 entrance on that pose
//
// Rules (measured by tools/measure.mjs + films):
//   - with a `summon` pose the hologram phase is ≤ HOLO_MAX_MS: the body is built bottom → top as
//     a hologram over the pose's first frames (it already moves: the drop / the curl), then it
//     settles to its true colours — the rest of the pose (land, unfurl, shake out) is the body
//     itself, so the body is visible for the whole summon (≥ 50 %);
//   - an ace's cut-in (./cutin.ts, ≤ 1.0 s, band only) comes AFTER the body has formed — on the
//     pose's big beat (the spread after the landing) — below the monster's tile, never across it
//     (the pose's settle stays in view), and the finale (ring, light, badge) lands as the band
//     leaves;
//   - the card part (hand slam / tribute slam / tile flash) stays the kits' own.
// The old monsters (no summon pose) keep their signature entrances; only the cut-in and the
// hologram settle are shortened for them in the v3 look.

import type Phaser from 'phaser';
import type { PlayerId } from '../../engine/types';
import { PAL, PLAYER_RAMP, type Ramp } from '../../art/palette';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, type XY } from '../../view/layout';
import { lightBeam, lightFlash, lightPool, type LightHandle } from '../../view/light';
import { clearHologram, holoRamp, setHologram } from '../../vfx/hologram';
import { Px, Sparks, onFrame, sleep } from '../../vfx/combat';
import { sfx, type SfxName } from '../../audio/sfx';
import type { ShatterMaterial } from '../../vfx/shatter';
import { deathPreset } from './presets';
import { unitFrame } from '../../duel/unit-variant';

/** Hologram phase of a summon with a summon pose (ms; A0 §6.2 item 4). */
export const HOLO_MAX_MS = 300;
/** Share of the summon the body must be visible (A0 §6.2 item 4). */
export const BODY_MIN_SHARE = 0.5;
/** The hologram settle of the OLD entrances in the v3 look (ms; their reveal stays their own). */
export const HOLO_SETTLE_V3_MS = 160;

function snd(name: SfxName, volume = 1, pitch = 1): void {
  try {
    sfx.play(name, { volume, pitch });
  } catch {
    /* audio is optional */
  }
}

export interface SummonPose {
  /** The `land` mark (feet on the floor; default: the frame after the drop, ≈ 30 % in). */
  land: Promise<void>;
  /** The hologram is gone: true colours from here on. */
  solid: Promise<void>;
  /** The pose's big beat after the landing (≈ 35 % of what follows the land: the unfurl / spread). */
  peak: Promise<void>;
  /** The pose ended (the unit rests in its idle loop). */
  done: Promise<void>;
  /** ms from the start to each beat (for timing tables). */
  ms: { land: number; peak: number; total: number; holo: number };
}

/** Vertical span (relative to sprite.y) covering every frame of an anim (the reveal edge stays put). */
function poseSpan(u: MonsterUnit, anim: 'summon' | 'revive'): { top: number; bottom: number } {
  let top = Infinity;
  let bottom = -Infinity;
  const n = u.frameCount(anim);
  for (let f = 0; f < n; f++) {
    const b = unitFrame(u, anim, f).bounds();
    if (!b) continue;
    top = Math.min(top, b.y);
    bottom = Math.max(bottom, b.y + b.h);
  }
  if (!Number.isFinite(top)) return { top: -u.art.anchorY, bottom: u.art.h - u.art.anchorY };
  return { top: top - u.art.anchorY, bottom: bottom - u.art.anchorY };
}

/**
 * Play an entrance pose (`summon`, or `revive`) with a short hologram onset: the body is built
 * bottom → top in `ramp` over the first part of the pose (≤ HOLO_MAX_MS together with the settle)
 * while the pose already plays. null when the art lacks the pose (the caller keeps its old reveal).
 */
export function summonPose(scene: Phaser.Scene, u: MonsterUnit, o: { ramp: Ramp; anim?: 'summon' | 'revive'; holoMs?: number; onLand?: () => void; onPeak?: () => void; hologram?: boolean }): SummonPose | null {
  const anim = o.anim ?? 'summon';
  if (!u.has(anim) || !u.sprite.active) return null;
  const s = u.sprite;
  const n = u.frameCount(anim);
  const landF = u.markFrame(anim, 'land', Math.max(1, Math.round(n * 0.3)));
  const landMs = u.markMs(anim, 'land', landF);
  const total = u.animMs(anim);
  const peakMs = Math.round(landMs + (total - landMs) * 0.35);
  const holo = Math.min(HOLO_MAX_MS, o.holoMs ?? HOLO_MAX_MS);
  // ---- the pose (it ends on idle 0; the unit rests in its loop after)
  u.pose(anim, 0);
  u.showSprite();
  const done = u.playRange(anim, 0, undefined, { hold: false });
  // ---- hologram onset over the first frames: reveal (≈ 60 %), one bright frame, settle
  let solidNow!: () => void;
  const solid = new Promise<void>((r) => (solidNow = r));
  if (o.hologram !== false) {
    // one clock for the whole onset (frame-quantised sleeps would add up past the budget)
    const P = setHologram(s, { reveal: 0, scan: 1, glitch: 0.1, tint: o.ramp[4], ramp: holoRamp(o.ramp), tintMix: 0.8, gain: 0.7, flicker: 0.08, alpha: 1, white: 0, clipY: null, span: poseSpan(u, anim) });
    const end = holo - 20; // the last frame lands inside the budget
    const rev = Math.round(end * 0.55);
    onFrame(
      scene,
      (_dt, el) => {
        if (!s.active) return false;
        if (el < rev) P.reveal = el / rev;
        else if (el < rev + 34) {
          P.reveal = 1;
          P.white = 0.4;
        } else {
          P.white = 0;
          const k = Math.min(1, (el - rev - 34) / Math.max(1, end - rev - 34));
          const step = Math.min(3, Math.floor(k * 3) + 1) / 3; // 3 palette steps back to true colours
          P.tintMix = 0.8 * (1 - step);
          P.scan = 1 - step;
          P.glitch = 0.1 * (1 - step);
          P.flicker = 0;
        }
        return el < end;
      },
      () => {
        if (s.active) clearHologram(s);
        solidNow();
      },
    );
  } else solidNow();
  const land = sleep(scene, landMs).then(() => {
    try {
      o.onLand?.();
    } catch (e) {
      console.error('[summon-v3] onLand', e);
    }
  });
  const peak = sleep(scene, peakMs).then(() => {
    try {
      o.onPeak?.();
    } catch (e) {
      console.error('[summon-v3] onPeak', e);
    }
  });
  return { land, solid, peak, done, ms: { land: landMs, peak: peakMs, total, holo } };
}

/**
 * A short hologram onset on whatever pose the unit shows (a flip, a quick entry): the body is
 * built bottom → top in `ramp` over ~55 % of `ms`, then steps back to its true colours in three
 * palette steps — no bright full-silhouette frame, no flat fill. Resolves when the body is solid.
 */
export function holoOnset(scene: Phaser.Scene, u: MonsterUnit, ramp: Ramp, ms = 160): Promise<void> {
  const s = u.sprite;
  if (!s.active) return Promise.resolve();
  const P = setHologram(s, { reveal: 0, scan: 1, glitch: 0.06, tint: ramp[4], ramp: holoRamp(ramp), tintMix: 0.8, gain: 0.7, flicker: 0, alpha: 1, white: 0, clipY: null });
  const rev = Math.round(ms * 0.55);
  return new Promise<void>((resolve) => {
    onFrame(
      scene,
      (_dt, el) => {
        if (!s.active) return false;
        if (el < rev) P.reveal = el / rev;
        else {
          P.reveal = 1;
          const step = Math.min(3, Math.floor(((el - rev) / Math.max(1, ms - rev)) * 3) + 1) / 3;
          P.tintMix = 0.8 * (1 - step);
          P.scan = 1 - step;
          P.glitch = 0.06 * (1 - step);
        }
        return el < ms;
      },
      () => {
        if (s.active) clearHologram(s);
        resolve();
      },
    );
  });
}

// ================================================================ the generic v3 entrance

/** What the generic entrance needs from a kit's stage (summon-a Stage / summon-b Entrance). */
export interface PoseStage {
  scene: Phaser.Scene;
  unit: MonsterUnit;
  /** Floor point (tile centre). */
  home: XY;
  player: PlayerId;
  ramp: Ramp;
  /** Tribute / ace: a bigger finale. */
  big: boolean;
  /** An ace's cut-in plays on the pose's peak (summon-a climax). */
  cutIn: boolean;
  /** The kit's finale: floor shock ring, light, shake, the ATK/DEF badge pop. */
  finale(big: boolean): void;
  /** The kit's cut-in beat (resolves as the band leaves); absent: none. */
  climax?(): Promise<void>;
  /** The kit's magic circle under the tile (dismissed at the end); absent: none. */
  openCircle?(): { pulse(ms?: number): void; dismiss(ms?: number): Promise<void> } | null;
  /** Light colour of the monster's attribute on the floor. */
  lightColor: number;
}

/** The prism's spectral fringe tones (red side → violet side), palette only. */
const PRISM_L = [PAL.gold4, PAL.fire3, PAL.crim3] as const;
const PRISM_R = [PAL.leaf3, PAL.cyan3, PAL.void3] as const;

/**
 * The entry light on the tile while the body forms, in the monster's matter (pinched out at the
 * landing):
 *   crystal  a prism shaft from above — white core, cyan body, red → violet spectral fringes;
 *   shadow   a rift opening in the floor — a dithered void mouth with a turning rim, wisps rising
 *            (the body climbs out of it; no light from the sky);
 *   others   a narrow light column in the matter's tones.
 */
function column(S: PoseStage, matter: ShatterMaterial): { pinch(ms: number): Promise<void>; destroy(): void } {
  const sc = S.scene;
  const { x, y } = S.home;
  const rift = matter === 'shadow';
  const prism = matter === 'crystal';
  const g = new Px(sc.add.graphics().setDepth(rift ? DEPTH.TILE_FX + 6 : S.unit.sprite.depth - 1));
  const wisps = rift ? new Sparks(sc, S.unit.sprite.depth + 0.4) : null;
  const r = S.ramp;
  let w = 0;
  let alive = true;
  let grow = true;
  let t = 0;
  const top = Math.max(-10, y - 190);
  const beam = rift ? null : lightBeam(sc, { x, y: top }, { x, y }, S.lightColor, 0, { width: 14, depth: S.unit.sprite.depth - 1.5, intensity: 0.7, shimmer: 0.3 });
  const pool: LightHandle = lightPool(sc, x, y, { color: S.lightColor, radius: 30, floorY: y, intensity: rift ? 0.6 : 0.8, anim: rift ? 'breathe' : 'shimmer', fadeIn: 80 });
  let acc = 0;
  const stop = onFrame(sc, (dt, el) => {
    if (!alive) return false;
    t += dt;
    if (grow) w = Math.min(1, w + dt / (rift ? 140 : 90));
    g.clear();
    if (rift) {
      // the rift: a void mouth on the floor, its rim turning, wisps climbing out
      const rx = Math.round(18 * w);
      if (rx < 2) return true;
      const ry = Math.max(1, Math.round(rx * 0.45));
      for (let yy = -ry - 1; yy <= ry + 1; yy++)
        for (let xx = -rx - 2; xx <= rx + 2; xx++) {
          const d = (xx * xx) / ((rx + 2) * (rx + 2)) + (yy * yy) / ((ry + 1) * (ry + 1));
          if (d > 1) continue;
          const di = (xx * xx) / (rx * rx) + (yy * yy) / (ry * ry);
          const c = di > 1 ? ((xx + yy) % 2 === 0 ? r[1] : -1) : di > 0.78 ? r[3] : di > 0.35 ? r[0] : PAL.ink;
          if (c >= 0) g.dot(x + xx, y + yy, c, 1);
        }
      for (let i = 0; i < 4; i++) {
        const a = el * 0.01 + (i / 4) * Math.PI * 2;
        g.dot(Math.round(x + Math.cos(a) * rx), Math.round(y + Math.sin(a) * ry), r[4], 1);
      }
      acc += dt;
      if (wisps && acc > 30 && grow) {
        acc = 0;
        wisps.add({ x: x + Math.round((Math.sin(el * 0.37) * 0.8) * rx), y: y - 1, vx: 0, vy: -40 - (el % 20), drag: 0.5, life: 360, colors: [r[4], r[3], r[2]], shape: 'px', flicker: true, fadeAt: 1 });
      }
      return true;
    }
    const hw = Math.round(5 * w);
    if (hw <= 0) return true;
    for (let yy = top; yy <= y; yy += 1) {
      const flow = ((yy - t * 0.25) % 14 + 14) % 14 < 1.5;
      g.rect(x - hw, yy, hw * 2 + 1, 1, flow ? r[4] : r[2], 0.55);
      g.rect(x, yy, 1, 1, PAL.white, 1);
      if (hw >= 3) g.rect(x - 1, yy, 3, 1, flow ? PAL.white : r[4], 0.9);
      if (prism) {
        // the spectral fringes, one pixel each, dimmer outward
        for (let k = 0; k < 3; k++) {
          g.dot(x - hw - 1 - k, yy, PRISM_L[k], 0.85 - k * 0.2);
          g.dot(x + hw + 1 + k, yy, PRISM_R[k], 0.85 - k * 0.2);
        }
      }
    }
    return true;
  });
  const destroy = () => {
    if (!alive) return;
    alive = false;
    stop();
    g.g.destroy();
    wisps?.release();
    if (beam) void beam.fadeOut(120);
    void pool.fadeOut(200);
  };
  return {
    async pinch(ms) {
      grow = false;
      const w0 = w;
      const steps = 4;
      for (let i = 1; i <= steps; i++) {
        await sleep(sc, ms / steps);
        w = w0 * (1 - i / steps);
      }
      destroy();
    },
    destroy,
  };
}

/**
 * The generic v3 entrance on the summon pose (a kit uses it when the monster's art has the pose
 * and its signature file brings no v3 entrance of its own):
 *   0      the attribute circle opens, a light column stands on the tile
 *   0–300  the body forms in the column (hologram ≤ 300 ms) while the pose's drop / curl plays
 *   land   dust + a small ring, the column pinches out
 *   peak   ace: the cut-in (≤ 1.0 s, band only) — the band passes UNDER the monster's tile
 *          (summon-a climax: cutInV3 `clear`), so the pose plays on in full view above it
 *   end    the finale: ring, light, badge (an ace's as the band leaves)
 * Resolves when the pose has ended (and, for an ace, the band is leaving).
 */
export async function poseEntrance(S: PoseStage): Promise<boolean> {
  const sc = S.scene;
  const u = S.unit;
  if (!u.has('summon')) return false;
  const circle = S.openCircle?.() ?? null;
  const col = column(S, deathPreset(u.cardId).material);
  snd('summonCharge', 0.7);
  let finaled = false;
  const finale = () => {
    if (finaled) return;
    finaled = true;
    S.finale(S.big);
  };
  const p = summonPose(sc, u, {
    ramp: S.ramp,
    onLand: () => {
      snd('impactLight', 0.6);
      circle?.pulse(100);
      void col.pinch(100);
      landDust(sc, S.home, S.ramp, S.big);
      void lightFlash(sc, S.home.x, S.home.y - 6, S.lightColor, 30, 260, { floorY: S.home.y, ring: true, intensity: 0.7 });
      if (!S.cutIn) finale();
    },
  });
  if (!p) {
    col.destroy();
    return false;
  }
  void p.solid.then(() => snd('materialize', 0.6));
  if (S.cutIn && S.climax) {
    await p.peak;
    await S.climax();
    finale();
    await sleep(sc, 120);
  } else {
    await p.done;
  }
  finale();
  if (circle) void circle.dismiss(320);
  col.destroy();
  return true;
}

/** A crisp ring of floor dust at the landing (attribute tinted, stepped out). */
function landDust(sc: Phaser.Scene, at: XY, ramp: Ramp, big: boolean): void {
  const sp = new Sparks(sc, DEPTH.FX);
  const n = big ? 14 : 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    sp.add({ x: at.x + Math.cos(a) * 6, y: at.y + Math.sin(a) * 3, vx: Math.cos(a) * 60, vy: Math.sin(a) * 26 - 10, drag: 5, life: 300, colors: [PAL.mist, ramp[3], PAL.steel], shape: 'puff', size: 1.5, fadeAt: 1 });
  }
  sp.release();
}

/** The player's colour ramp (for kits that ring the owner's colour on a finale). */
export function ownerRamp(p: PlayerId): Ramp {
  return PLAYER_RAMP[p];
}
