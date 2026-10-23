// v3 ACE CUT-IN (docs/v3/A0_ENVANTER.md §6.2 item 4: "Cut-in ≤ 1,0 sn"; G14: four aces shared one
// 1.55 s sequence with a full-screen dim and a full-screen white flash-out). Used under ?look=v3 by
// the summon base (summon-a Stage.climax, fx.summonEntrance keeps the old one for the old look).
//
//   const c = cutInV3(scene, { monsterId, name, attribute, player });
//   await c.exit;     // the band starts to leave (≈ 0.7 s): the summon's climax goes on under it
//   await c.done;     // everything is gone (≤ 0.9 s)
//
// The band only — no full-screen dim, no full-screen flash (plan §3: never the whole screen):
//   0       the slanted band wipes in from the owner's side (stepped, white leading edge)
//   ~60     the portrait slides in (whole pixels, integer scale), speed lines stream past it
//   flare   the eyes flare (glint + streak), the roar
//   slam    the name plate slams in (one white frame, the name drops 2 px into place, 2 px shake)
//   exit    the band closes onto its centre line in 4 steps with a white seam, then is gone
// Portrait: `cutin:<id>` (the cut-in art; the v3 registry src/art/cutins-v3 replaces it under the
// v3 look) played at its own frame rhythm; otherwise the monster's idle at ×3 framed on its head.
// Card-specific rhythm: RHYTHM (flare / slam / exit beats per ace), clamped to the 1.0 s budget.
// Player 2 mirrors the band slant, the entry side, the facing and the plate side; a portrait with
// relit P2 frames (CutinArt.p2 'relight') shows those, so its light stays on the screen's top-left.
// Placement (A2 fix: the band sat across the summoned monster's tile and hid half of its summon
// pose): with `clear` (the summoned monster's feet + badge, SCREEN space) the band is lowered until
// its top edge passes under that point — the pose's land, spread and settle play on in full view
// above it. Without `clear` it crosses the screen's middle as before.

import Phaser from 'phaser';
import type { Attribute, MonsterId } from '../../data/cards';
import { ATTRIBUTE_NAMES, cardDef, isMonster } from '../../data/cards';
import type { PlayerId } from '../../engine/types';
import { ATTRIBUTE_RAMP, PAL } from '../../art/palette';
import { frameRGBA } from '../../art/atlas';
import { monsterArt } from '../../art/monsters';
import { monsterAnimKey, monsterFrameName, monsterTextureKey, sheetTexture } from '../../art/textures';
import { cutinArt, cutinFrame, cutinFrameName, cutinP2Key, cutinRelit, cutinSequence } from '../../art/cutins';
import type { PixelCanvas } from '../../art/pixel';
import { DEPTH, GAME_W } from '../../view/layout';
import { TEX, shake } from '../../vfx/core';
import { pixelText, upper } from '../../ui/text';
import { Sparks, onFrame, sleep } from '../../vfx/combat';
import { Raster } from '../../vfx/setpieces';
import { sfx, type SfxName } from '../../audio/sfx';
import { cutInRhythm } from './presets';
import { soundsOf, start as startSnd } from './sound';

export interface CutInV3Opts {
  monsterId: MonsterId;
  /** Display name (Turkish); upper-cased with Turkish rules + "!". */
  name: string;
  attribute: Attribute;
  player: PlayerId;
  /** Screen point (the summoned monster's feet / badge) the band's top edge must stay below. */
  clear?: { x: number; y: number };
}

export interface CutInV3 {
  /** The band starts to leave: hand the climax back to the field. */
  exit: Promise<void>;
  /** Everything is gone. */
  done: Promise<void>;
}

export { CUTIN_V3_MAX_MS } from './presets';

/** Deep band tones per attribute: [deep, wedge, glow]. */
const BAND_TONES: Record<Attribute, [number, number, number]> = {
  LIGHT: [PAL.gold0, PAL.gold1, PAL.gold2],
  DARK: [PAL.void0, PAL.void1, PAL.void2],
  FIRE: [PAL.fire0, PAL.fire1, PAL.fire2],
  WATER: [PAL.water0, PAL.water1, PAL.water2],
  EARTH: [PAL.earth0, PAL.earth1, PAL.earth2],
  WIND: [PAL.leaf0, PAL.leaf1, PAL.leaf2],
};

const H_BAND = 120;
const MID_Y = 172;
/** Gap (px) between the band's top edge and the point it keeps clear of. */
const CLEAR_GAP = 8;
/** The lowest the band's centre goes (its bottom part may run off the screen's lower edge). */
const MID_Y_MAX = 300;

/** The band's centre line for these options (see `clear`). */
export function bandMidY(player: PlayerId, clear?: { x: number; y: number }): number {
  if (!clear) return MID_Y;
  const slope = player === 0 ? -0.13 : 0.13;
  const need = Math.ceil(clear.y + CLEAR_GAP + H_BAND / 2 - (clear.x - GAME_W / 2) * slope);
  return Math.max(MID_Y, Math.min(MID_Y_MAX, need));
}

function snd(name: SfxName, volume = 1, pitch = 1): void {
  try {
    sfx.play(name, { volume, pitch });
  } catch {
    /* audio is optional */
  }
}

/** Brightest high-contrast pixel in the head region of a texture frame (frame px, facing right). */
function findEye(scene: Phaser.Scene, key: string, frameName: string | number): { x: number; y: number } | null {
  try {
    const fr = scene.textures.getFrame(key, frameName);
    if (!fr) return null;
    // the frame's full pixels (A4.1: a cropped v3 monster sheet stores it trimmed; frameRGBA rebuilds it)
    const d = frameRGBA(fr);
    if (!d) return null;
    const W = fr.realWidth;
    const H = fr.realHeight;
    const lum = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return 0;
      const i = (y * W + x) * 4;
      return d[i + 3] === 0 ? 0 : (d[i] * 0.3 + d[i + 1] * 0.55 + d[i + 2] * 0.15) / 255;
    };
    let x0 = W;
    let y0 = H;
    let x1 = 0;
    let y1 = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (d[(y * W + x) * 4 + 3] > 0) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
    if (x1 <= x0) return null;
    let best: { x: number; y: number } | null = null;
    let bestS = 0;
    for (let y = y0; y <= y0 + (y1 - y0) * 0.45; y++)
      for (let x = Math.floor(x0 + (x1 - x0) * 0.4); x <= x1; x++) {
        const l = lum(x, y);
        if (l < 0.6) continue;
        const nb = Math.min(lum(x - 1, y), lum(x + 1, y), lum(x, y - 1), lum(x, y + 1));
        const s = l - nb * 0.8 + ((x - x0) / Math.max(1, x1 - x0)) * 0.15;
        if (s > bestS) {
          bestS = s;
          best = { x, y };
        }
      }
    return best;
  } catch {
    return null;
  }
}

/** The v3 ace cut-in (see the header). */
export function cutInV3(scene: Phaser.Scene, o: CutInV3Opts): CutInV3 {
  let exitNow!: () => void;
  const exit = new Promise<void>((r) => (exitNow = r));
  const done = run(scene, o, () => exitNow()).catch((e) => {
    console.warn('[cutin-v3] failed', e);
  });
  return { exit: Promise.race([exit, done.then(() => undefined)]), done: done.then(() => undefined) };
}

async function run(scene: Phaser.Scene, o: CutInV3Opts, onExit: () => void): Promise<void> {
  const R = cutInRhythm(o.monsterId);
  const p1 = o.player === 0;
  const dir = p1 ? 1 : -1;
  const ramp = ATTRIBUTE_RAMP[o.attribute];
  const [deep, wedge, glow] = BAND_TONES[o.attribute];
  const D = DEPTH.CUTIN;
  const slope = p1 ? -0.13 : 0.13;
  const mid = bandMidY(o.player, o.clear);
  const top = (x: number) => Math.round(mid - H_BAND / 2 + (x - GAME_W / 2) * slope);
  const objs: { destroy(): void }[] = [];
  // the band is one pixel raster (crisp, palette tones only), redrawn every frame
  const yMin = Math.min(top(0), top(GAME_W)) - 8;
  const yMax = Math.max(top(0), top(GAME_W)) + H_BAND + 8;
  const bandR = new Raster(scene, 0, yMin, GAME_W, yMax - yMin, D + 1);
  bandR.img.setScrollFactor(0);
  objs.push(bandR);
  // ---- state
  let wipe = 0; // 0…1 band reveal along x (from the owner's side)
  let close = 0; // 0…1 the band closing onto its centre line
  let burst = 0; // 0…1 the focus-line burst behind the portrait
  let flashLv = 0; // the band's tones step up on the slam (band only, never the screen)
  const focus = { x: p1 ? 200 : GAME_W - 200, y: mid - 6 };
  // polar map of the band for the focus-line burst (computed once)
  const BW = bandR.w;
  const BH = bandR.h;
  const ang = new Float32Array(BW * BH);
  const rad = new Float32Array(BW * BH);
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++) {
      const dx = x - focus.x;
      const dy = y + yMin - focus.y;
      ang[y * BW + x] = Math.atan2(dy, dx);
      rad[y * BW + x] = Math.hypot(dx, dy);
    }
  const lines = Array.from({ length: 34 }, (_, i) => ({
    v: ((i * 37) % 97) / 97,
    len: 20 + ((i * 53) % 110),
    speed: 900 + ((i * 71) % 700),
    x: (i * 131) % GAME_W,
    c: i % 4 === 0 ? PAL.white : i % 3 === 0 ? ramp[3] : ramp[2],
  }));
  const edgeX = () => (dir > 0 ? Math.round(-20 + (GAME_W + 40) * wipe) : Math.round(GAME_W + 20 - (GAME_W + 40) * wipe));
  const inWipe = (x: number) => (dir > 0 ? x <= edgeX() : x >= edgeX());
  const drawBand = (el: number, dt: number) => {
    for (const l of lines) {
      l.x -= dir * l.speed * (dt / 1000);
      if (dir > 0 && l.x + l.len < 0) l.x += GAME_W + l.len;
      if (dir < 0 && l.x > GAME_W) l.x -= GAME_W + l.len;
    }
    bandR.draw((g) => {
      if (wipe <= 0) return;
      const shrink = Math.round((H_BAND / 2) * close);
      const rot = el * 0.0005 * dir;
      for (let x = 0; x < GAME_W; x++) {
        if (!inWipe(x)) continue;
        const t0 = top(x) + shrink;
        const h = H_BAND - shrink * 2;
        if (h <= 0) continue;
        for (let y = t0; y < t0 + h; y++) {
          const i = (y - yMin) * BW + x;
          let c: number = deep;
          if (burst > 0) {
            // 36 alternating wedges radiating from behind the portrait, a glowing core
            const wdg = Math.floor((((ang[i] + rot) / (Math.PI * 2)) * 36 + 36) % 36);
            const r = rad[i];
            if (wdg % 2 === 0) c = r < 90 * burst ? glow : wedge;
            else if (r < 50 * burst) c = wedge;
            // the core: one flat stepped disc (A2 fix r1: no 50 % checker behind the portrait)
            if (r < 30 * burst) c = glow;
          }
          if (flashLv > 0.4) c = c === deep ? glow : ramp[3];
          else if (flashLv > 0.1) c = c === deep ? wedge : c === wedge ? glow : ramp[3];
          g.px(x, y, c);
        }
        // borders: white + attribute light, thin outer echo
        g.px(x, t0 - 1, PAL.white);
        g.px(x, t0 + h, PAL.white);
        g.px(x, t0 - 2, ramp[3]);
        g.px(x, t0 + h + 1, ramp[3]);
        if (close <= 0) {
          g.px(x, t0 - 5, ramp[1]);
          g.px(x, t0 + h + 4, ramp[1]);
        }
      }
      // speed lines along the band
      for (const l of lines) {
        const x0 = Math.round(l.x);
        for (let k = 0; k < l.len; k += 1) {
          const x = x0 + k;
          if (x < 0 || x >= GAME_W || !inWipe(x)) continue;
          const t0 = top(x) + shrink;
          const h = H_BAND - shrink * 2;
          if (h < 8) continue;
          const y = t0 + 3 + Math.round(l.v * (h - 6));
          const head = dir > 0 ? k / l.len : 1 - k / l.len;
          g.px(x, y, head < 0.3 ? l.c : head < 0.65 ? ramp[2] : ramp[1]);
        }
      }
      // the leading edge of the wipe: a white slash
      if (wipe < 1) {
        const ex = edgeX();
        for (let y = top(ex); y < top(ex) + H_BAND; y++) {
          const xx = ex + Math.round((y - mid) * 0.3 * dir);
          g.px(xx, y, PAL.white);
          g.px(xx - dir, y, ramp[4]);
        }
      }
      // closing: the seam
      if (close > 0 && close < 1) for (let x = 0; x < GAME_W; x++) g.px(x, top(x) + H_BAND / 2, PAL.white);
    });
  };

  // ---- portrait (integer scale, masked by the band). Player 2: the relit frames when the portrait
  // has them (`cutin:<id>:p2`, drawn lit from the frame's top-right — flipped, lit from the screen's
  // top-left like P1), else the P1 frames mirrored.
  const p2Key = `cutin:${o.monsterId}:p2`;
  const cutKey = !p1 && scene.textures.exists(p2Key) ? p2Key : `cutin:${o.monsterId}`;
  const hasCut = scene.textures.exists(cutKey);
  let portrait: Phaser.GameObjects.Sprite;
  let restX: number;
  let restY: number;
  let eye: { x: number; y: number } | null;
  if (hasCut) {
    const fr = scene.textures.getFrame(cutKey, 'f0') ?? scene.textures.getFrame(cutKey);
    const h = fr?.cutHeight ?? 120;
    const w = fr?.cutWidth ?? 160;
    const k = Math.max(1, Math.floor((H_BAND + 30) / h));
    portrait = scene.add.sprite(0, 0, cutKey, fr?.name ?? 0).setOrigin(0.5).setScale(k).setFlipX(!p1);
    restX = Math.round(p1 ? 60 + (w * k) / 2 : GAME_W - 60 - (w * k) / 2);
    restY = Math.round(mid + slope * (restX - GAME_W / 2));
    if (scene.anims.exists(cutKey)) portrait.play(cutKey);
    const e = findEye(scene, cutKey, fr?.name ?? 'f0');
    eye = e ? { x: (e.x - w / 2) * k * (p1 ? 1 : -1), y: (e.y - h / 2) * k } : null;
  } else {
    const art = monsterArt(o.monsterId);
    const k = 3;
    portrait = scene.add.sprite(0, 0, monsterTextureKey(o.monsterId), monsterFrameName('idle', 0)).setOrigin(0.5).setScale(k).setFlipX(!p1);
    if (scene.anims.exists(monsterAnimKey(o.monsterId, 'idle'))) portrait.play(monsterAnimKey(o.monsterId, 'idle'));
    const e = findEye(scene, monsterTextureKey(o.monsterId), monsterFrameName('idle', 0)) ?? { x: art.core.x + art.w * 0.2, y: art.core.y - art.h * 0.2 };
    eye = { x: (e.x - art.w / 2) * k * (p1 ? 1 : -1), y: (e.y - art.h / 2) * k };
    restX = Math.round((p1 ? 230 : GAME_W - 230) - eye.x);
    restY = Math.round(mid - 22 - eye.y);
  }
  portrait.setDepth(D + 2).setScrollFactor(0).setVisible(false);
  objs.push(portrait);
  const maskG = scene.make.graphics({ x: 0, y: 0 }, false);
  const drawMask = () => {
    maskG.clear();
    maskG.fillStyle(0xffffff, 1);
    const shrink = Math.round((H_BAND / 2) * close);
    const xa = dir > 0 ? 0 : Math.max(0, edgeX());
    const xb = dir > 0 ? Math.min(GAME_W, edgeX()) : GAME_W;
    if (xb <= xa) return;
    maskG.fillPoints([new Phaser.Math.Vector2(xa, top(xa) + shrink), new Phaser.Math.Vector2(xb, top(xb) + shrink), new Phaser.Math.Vector2(xb, top(xb) + H_BAND - shrink), new Phaser.Math.Vector2(xa, top(xa) + H_BAND - shrink)], true);
  };
  const mask = maskG.createGeometryMask();
  portrait.setMask(mask);
  objs.push(mask, maskG);
  const startX = restX - dir * 300;
  let slide = 0;
  let drift = 0;
  const sparks = new Sparks(scene, D + 5);
  objs.push({ destroy: () => sparks.destroy() });
  const stop = onFrame(scene, (dt, el) => {
    drawBand(el, dt);
    drawMask();
    const e = 1 - Math.pow(1 - slide, 4);
    portrait.setPosition(Math.round(startX + (restX - startX) * e + dir * drift), restY);
    return true;
  });
  objs.push({ destroy: stop });
  const cleanup = () => {
    for (const x of objs) {
      try {
        x.destroy();
      } catch {
        /* gone */
      }
    }
  };
  // ================================================================ timeline
  // a monster with its own voice (sound.ts) carries the cut-in: the band's generic sting opens it
  // and hands the moment to the voice on the eye flare; the slam / exit accents stay under it
  // (sound QA #1 / #9: cutIn held 67 % of the window over the magus' call, cardSlam + impactHeavy
  // peaked over −1 dBFS on the wyrm's roar, the exit's summonBurst was the summon's loudest beat)
  const voice = soundsOf(o.monsterId);
  try {
    const sting = voice ? startSnd('cutIn', { volume: 0.8 }) : null;
    if (!voice) snd('cutIn', 1);
    const t0 = scene.time.now;
    const at = (ms: number) => sleep(scene, Math.max(0, ms - (scene.time.now - t0)));
    // band wipe (stepped: 6 steps)
    void (async () => {
      for (let i = 1; i <= 6; i++) {
        wipe = i / 6;
        await sleep(scene, 18);
      }
      wipe = 1;
    })();
    await at(60);
    // the burst opens behind the portrait in 3 steps
    void (async () => {
      for (let i = 1; i <= 3; i++) {
        burst = i / 3;
        await sleep(scene, 40);
      }
    })();
    portrait.setVisible(true);
    snd('whoosh', 0.8, 0.8);
    // slide (outQuart) then a slow whole-pixel drift
    void (async () => {
      const ms = 200;
      const s0 = scene.time.now;
      while (slide < 1) {
        await sleep(scene, 16);
        slide = Math.min(1, (scene.time.now - s0) / ms);
      }
      for (let i = 0; i < 6; i++) {
        await sleep(scene, 90);
        drift = i + 1;
      }
    })();
    // eyes flare
    await at(R.flare);
    // the monster's own voice on the eye flare (sound.ts: the wyrm's roar, the magus' dark call)
    sting?.stop(100);
    snd(voice?.roar ?? 'roarBig', 0.9);
    if (eye) {
      const ex = Math.round(portrait.x + eye.x);
      const ey = Math.round(portrait.y + eye.y);
      const star = scene.add.image(ex, ey, TEX.spark).setDepth(D + 6).setScrollFactor(0).setTint(PAL.white);
      objs.push(star);
      const streak = scene.add.rectangle(ex, ey, 2, 1, PAL.white).setDepth(D + 6).setScrollFactor(0);
      objs.push(streak);
      void (async () => {
        const steps = [1, 3, 4, 3, 2, 1];
        for (let i = 0; i < steps.length; i++) {
          if (!star.active) return;
          star.setScale(steps[i]).setTint(i < 3 ? PAL.white : ramp[4]).setPosition(Math.round(portrait.x + eye!.x), Math.round(portrait.y + eye!.y));
          streak.setSize(steps[i] * 22, 1).setPosition(star.x, star.y);
          await sleep(scene, 34);
        }
        star.setVisible(false);
        streak.setVisible(false);
      })();
    }
    // name plate slam
    await at(R.slam);
    const def = cardDef(o.monsterId);
    const level = isMonster(def) ? def.level : 0;
    const plateX = p1 ? 452 : GAME_W - 452;
    const plateY = Math.round(top(plateX) + H_BAND - 36);
    let title: Phaser.GameObjects.BitmapText | null = null;
    let sub: Phaser.GameObjects.BitmapText | null = null;
    try {
      title = pixelText(scene, plateX, plateY - 2, upper(o.name) + '!', { size: 'xl', color: PAL.white, originX: 0.5, originY: 0.5, shadow: 1 }).setDepth(D + 7).setScrollFactor(0);
      sub = pixelText(scene, plateX, plateY + 22, `${'★'.repeat(Math.max(0, Math.min(8, level)))}  ${ATTRIBUTE_NAMES[o.attribute]}`, { size: 'md', color: ramp[3], originX: 0.5, originY: 0.5 }).setDepth(D + 7).setScrollFactor(0).setVisible(false);
      objs.push(title, sub);
    } catch {
      title = null;
    }
    const tw = title ? Math.round(title.width) : 200;
    const plate = scene.add.graphics().setDepth(D + 6).setScrollFactor(0);
    objs.push(plate);
    const drawPlate = (fill: number) => {
      plate.clear();
      const x0 = plateX - tw / 2 - 16;
      const y0 = plateY - 14;
      const w = tw + 32;
      const h = 30;
      const pts = [
        new Phaser.Math.Vector2(Math.round(x0 + 8), y0),
        new Phaser.Math.Vector2(Math.round(x0 + w + 8), y0),
        new Phaser.Math.Vector2(Math.round(x0 + w - 8), y0 + h),
        new Phaser.Math.Vector2(Math.round(x0 - 8), y0 + h),
      ];
      plate.fillStyle(fill, 1).fillPoints(pts, true);
      plate.lineStyle(1, ramp[3], 1).strokePoints(pts, true, true);
      plate.fillStyle(PAL.gold3, 1).fillRect(Math.round(x0 - 4), y0 + h + 2, w, 1);
    };
    snd('cardSlam', voice ? 0.45 : 1);
    snd('impactHeavy', voice ? 0.2 : 0.7, 0.9);
    drawPlate(PAL.white);
    flashLv = 0.5;
    void sleep(scene, 50).then(() => (flashLv = 0.2)).then(() => sleep(scene, 50)).then(() => (flashLv = 0));
    void shake(scene, 160, 2);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      sparks.add({ x: plateX + Math.cos(a) * (tw / 2), y: plateY + Math.sin(a) * 6, vx: Math.cos(a) * 140, vy: Math.sin(a) * 60, drag: 4, life: 260, colors: [PAL.white, PAL.gold4, ramp[3]], shape: 'px', fadeAt: 1 });
    }
    await sleep(scene, 34);
    drawPlate(PAL.ink);
    if (title) title.setY(plateY);
    await sleep(scene, 34);
    if (title) title.setTint(PAL.gold3);
    sub?.setVisible(true);
    // hold, then close
    await at(R.exit);
    onExit();
    snd('summonBurst', voice ? 0.3 : 0.6, 1.25);
    title?.setVisible(false);
    sub?.setVisible(false);
    plate.clear();
    const steps = 4;
    for (let i = 1; i <= steps; i++) {
      close = i / steps;
      await sleep(scene, Math.round(R.close / steps));
    }
  } finally {
    cleanup();
  }
}

// ================================================================ the relit P2 portrait (lazy)

const p2Warming = new Set<MonsterId>();

/**
 * A2 tech review r3 #8: a v3 portrait's relit player-2 frames (`cutin:<id>:p2`) are no longer
 * painted at boot (src/boot/25-cutins.ts, outside ?test). The summon kits call this as player 2's
 * ace summon starts (the card and the tributes come first): one frame per background tick, then
 * the texture + its one-shot animation are registered — same frame names and timeline as the P1
 * portrait. Until then (or if it is not ready in time) the cut-in shows the P1 frames mirrored.
 * A no-op for P1, for portraits without relit frames and once registered.
 */
export function warmCutinP2(scene: Phaser.Scene, id: MonsterId, player: PlayerId): void {
  if (player !== 1 || !cutinRelit(id)) return;
  const key = cutinP2Key(id);
  if (scene.textures.exists(key) || p2Warming.has(id)) return;
  p2Warming.add(id);
  const art = cutinArt(id);
  const frames: [string, PixelCanvas][] = [];
  let f = 0;
  const tick = () => {
    try {
      if (!scene.sys?.game || scene.textures.exists(key)) return void p2Warming.delete(id);
      frames.push([cutinFrameName(f), cutinFrame(id, f, { lightFrom: 'right' })]);
      if (++f < art.frames) return void setTimeout(tick, 0);
      sheetTexture(scene, key, art.w, art.h, frames);
      if (!scene.anims.exists(key))
        scene.anims.create({
          key,
          frames: cutinSequence(art).map((st) => ({ key, frame: cutinFrameName(st.frame), duration: st.ms })),
          frameRate: art.fps,
          repeat: 0,
        });
    } catch (e) {
      console.warn('[cutin] relit P2 portrait failed', e);
    }
    p2Warming.delete(id);
  };
  setTimeout(tick, 0);
}
