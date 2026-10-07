// Ace cut-in (GAME_DESIGN §6 "As cut-in", ~1.6 s):
//
//   await cutIn(scene, { monsterId: 'crystal_wyrm', name: 'Kristal Ejder', attribute: 'LIGHT', player: 0 });
//
//   0      the field dims to 60 %, a diagonal band wipes in from the owner's side
//   100    focus-line burst + speed lines in the attribute colors stream across the band
//   180    the portrait slides in fast (parallax: lines drift the other way), keeps drifting
//   620    eyes flare (lens glint) + roar
//   720    the name plate slams in: "KRİSTAL EJDER!" (xl, gold) + level stars, 2 px shake
//   1380   white flash out — everything is gone at the flash peak; resolves as the flash fades
//
// Portrait: texture `cutin:<id>` (frames f0.., anim `cutin:<id>`) when the cut-in art exists,
// otherwise the monster's idle animation at ×3, cropped to its head/upper body by the band.
// Player 2 mirrors everything (band slant, entry side, facing, plate side).

import Phaser from 'phaser';
import type { Attribute, MonsterId } from '../data/cards';
import { ATTRIBUTE_NAMES, cardDef, isMonster } from '../data/cards';
import type { PlayerId } from '../engine/types';
import { ATTRIBUTE_RAMP, PAL } from '../art/palette';
import { monsterArt } from '../art/monsters';
import { monsterAnimKey, monsterFrameName, monsterTextureKey } from '../art/textures';
import { DEPTH, GAME_H, GAME_W } from '../view/layout';
import { TEX, shake } from './core';
import { pixelText, upper } from '../ui/text';
import { E, Raster, Sparks, bayer, clamp01, lerp, onFrame, rnd, rr, run, seg, sleep, snd } from './setpieces';

export interface CutInOpts {
  monsterId: MonsterId;
  /** Display name (Turkish); it is upper-cased with Turkish rules and gets a "!". */
  name: string;
  attribute: Attribute;
  player: PlayerId;
}

const TAU = Math.PI * 2;

/** Deep background tones of the band per attribute: [deep, wedge, glow]. */
const BAND_TONES: Record<Attribute, [number, number, number]> = {
  LIGHT: [PAL.gold0, PAL.gold1, PAL.gold2],
  DARK: [PAL.void0, PAL.void1, PAL.void2],
  FIRE: [PAL.fire0, PAL.fire1, PAL.fire2],
  WATER: [PAL.water0, PAL.water1, PAL.water2],
  EARTH: [PAL.earth0, PAL.earth1, PAL.earth2],
  WIND: [PAL.leaf0, PAL.leaf1, PAL.leaf2],
};

/** Band geometry: a slanted strip across the screen. */
function bandEdges(player: PlayerId) {
  const slope = player === 0 ? -0.13 : 0.13;
  const H = 138;
  const mid = 178;
  const top = (x: number) => mid - H / 2 + (x - GAME_W / 2) * slope;
  return { top, bottom: (x: number) => top(x) + H, H, slope };
}

interface Eye {
  x: number;
  y: number;
}

/** Brightest high-contrast pixels in the head region of a frame (frame px), facing right. */
function findEyes(scene: Phaser.Scene, key: string, frameName: string | number): Eye[] {
  try {
    const fr = scene.textures.getFrame(key, frameName);
    if (!fr) return [];
    const src = fr.source.image as HTMLCanvasElement | HTMLImageElement;
    const c = document.createElement('canvas');
    c.width = fr.cutWidth;
    c.height = fr.cutHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(src, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, fr.cutWidth, fr.cutHeight);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const W = c.width;
    const Hh = c.height;
    const lum = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= W || y >= Hh) return 0;
      const i = (y * W + x) * 4;
      if (d[i + 3] === 0) return 0;
      return (d[i] * 0.3 + d[i + 1] * 0.55 + d[i + 2] * 0.15) / 255;
    };
    let x0 = W;
    let y0 = Hh;
    let x1 = 0;
    let y1 = 0;
    for (let y = 0; y < Hh; y++)
      for (let x = 0; x < W; x++)
        if (d[(y * W + x) * 4 + 3] > 0) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
    if (x1 <= x0) return [];
    const yLim = y0 + (y1 - y0) * 0.45;
    const xMin = x0 + (x1 - x0) * 0.4;
    let best: Eye | null = null;
    let bestS = 0;
    for (let y = y0; y <= yLim; y++)
      for (let x = Math.floor(xMin); x <= x1; x++) {
        const l = lum(x, y);
        if (l < 0.6) continue;
        const nb = Math.min(lum(x - 1, y), lum(x + 1, y), lum(x, y - 1), lum(x, y + 1));
        const sc = l - nb * 0.8 + (x - xMin) / (x1 - xMin) * 0.15;
        if (sc > bestS) {
          bestS = sc;
          best = { x, y };
        }
      }
    return best ? [best] : [];
  } catch {
    return [];
  }
}

/**
 * Full-screen ace cut-in. Resolves as the closing white flash starts fading (~1.55 s) — play the
 * giant shock ring / 4 px shake of the summon right after.
 */
export async function cutIn(scene: Phaser.Scene, o: CutInOpts): Promise<void> {
  const p1 = o.player === 0;
  const dir = p1 ? 1 : -1; // entry direction (+1: from the left)
  const ramp = ATTRIBUTE_RAMP[o.attribute];
  const [deep, wedgeC, glowC] = BAND_TONES[o.attribute];
  const band = bandEdges(o.player);
  const D = DEPTH.CUTIN;
  const objs: Array<{ destroy(): void }> = [];
  const cam = scene.cameras.main;

  // ---- dim
  const dim = scene.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink, 1).setOrigin(0).setScrollFactor(0).setDepth(D).setAlpha(0);
  objs.push(dim);

  // ---- band raster (focus burst + speed lines + borders)
  const yMin = Math.floor(Math.min(band.top(0), band.top(GAME_W))) - 6;
  const yMax = Math.ceil(Math.max(band.bottom(0), band.bottom(GAME_W))) + 6;
  const bandR = new Raster(scene, 0, yMin, GAME_W, yMax - yMin, D + 1);
  bandR.img.setScrollFactor(0);
  objs.push(bandR);
  const focus = { x: p1 ? 214 : GAME_W - 214, y: 170 };
  // precomputed polar map for the focus-line burst
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
  const lines = Array.from({ length: 46 }, () => ({
    v: rnd(),
    len: rr(24, 150),
    speed: rr(700, 1500),
    x: rr(0, GAME_W),
    c: rnd() < 0.25 ? PAL.white : rnd() < 0.6 ? ramp[3] : ramp[2],
    w: rnd() < 0.25 ? 2 : 1,
  }));
  let wipe = 0; // 0..1 band reveal
  let lineSpeedK = 1;
  let burstOn = 0;
  let bandFlash = 0;
  const drawBand = (el: number, dt: number) => {
    for (const l of lines) {
      l.x -= dir * l.speed * lineSpeedK * (dt / 1000);
      if (dir > 0 && l.x + l.len < 0) l.x += GAME_W + l.len + rr(0, 80);
      if (dir < 0 && l.x > GAME_W) l.x -= GAME_W + l.len + rr(0, 80);
    }
    bandR.draw((g) => {
      const edgeX = dir > 0 ? lerp(-60, GAME_W + 60, wipe) : lerp(GAME_W + 60, -60, wipe);
      const rot = el * 0.0004;
      for (let x = 0; x < GAME_W; x++) {
        // slanted wipe edge (leans with the band)
        const yy0 = band.top(x);
        const yy1 = band.bottom(x);
        for (let y = Math.ceil(yy0); y < yy1; y++) {
          const wx = x + (y - 180) * 0.35 * dir;
          if (dir > 0 ? wx > edgeX : wx < edgeX) continue;
          const i = (y - yMin) * BW + x;
          let c: number = deep;
          if (burstOn > 0) {
            const a = ang[i] + rot;
            const wedge = Math.floor(((a / TAU) * 36 + 36) % 36);
            const r = rad[i];
            if (wedge % 2 === 0) c = r < 70 * burstOn ? glowC : wedgeC;
            else if (r < 44 * burstOn) c = wedgeC;
            if (r < 34 * burstOn) c = bayer(x, y) < 0.5 ? ramp[1] : glowC;
          }
          // flash: every tone steps up the ramp (solid, no stipple)
          if (bandFlash > 0.12) c = bandFlash > 0.42 ? (c === deep ? glowC : ramp[4]) : c === deep ? wedgeC : c === wedgeC ? glowC : ramp[3];
          g.px(x, y, c);
        }
        // borders: white + attribute light, thin outer echo
        if (dir > 0 ? x + (yy0 - 180) * 0.35 <= edgeX : x - (yy0 - 180) * 0.35 >= edgeX) {
          g.px(x, Math.floor(yy0) - 1, PAL.white);
          g.px(x, Math.floor(yy0) - 2, ramp[3]);
          g.px(x, Math.floor(yy0) - 5, ramp[2]);
          g.px(x, Math.ceil(yy1), PAL.white);
          g.px(x, Math.ceil(yy1) + 1, ramp[3]);
          g.px(x, Math.ceil(yy1) + 4, ramp[2]);
        }
      }
      // accent strip: thin ribbon above the band with a scrolling ★ pattern (opposite drift)
      if (wipe > 0.3) {
        const off = Math.floor(el * 0.12) * -dir;
        for (let x = 0; x < GAME_W; x++) {
          const yb = Math.floor(band.top(x)) - 13;
          const ph = (((x + off) % 24) + 24) % 24;
          for (let yy = 0; yy < 6; yy++) {
            let c: number = yy === 0 || yy === 5 ? ramp[3] : deep;
            // tiny 5×4 star every 24 px
            const sx = ph - 9;
            if (yy >= 1 && yy <= 4 && sx >= 0 && sx < 5) {
              const star = ['..#..', '#####', '.###.', '.#.#.'][yy - 1];
              if (star[sx] === '#') c = ramp[4];
            }
            g.px(x, yb + yy, c);
          }
        }
      }
      // speed lines, parallel to the band
      for (const l of lines) {
        const x0 = Math.round(l.x);
        for (let k = 0; k < l.len; k++) {
          const x = x0 + k;
          if (x < 0 || x >= GAME_W) continue;
          const wx = x + (band.top(x) + l.v * band.H - 180) * 0.35 * dir;
          if (dir > 0 ? wx > edgeX : wx < edgeX) continue;
          const y = Math.round(band.top(x) + 3 + l.v * (band.H - 6));
          const tail = dir > 0 ? k / l.len : 1 - k / l.len; // bright head toward motion
          g.px(x, y, tail > 0.75 ? l.c : tail > 0.4 ? ramp[2] : ramp[1]);
          if (l.w === 2) g.px(x, y + 1, tail > 0.6 ? ramp[2] : ramp[1]);
        }
      }
    });
  };

  // ---- portrait
  const cutKey = `cutin:${o.monsterId}`;
  const hasCut = scene.textures.exists(cutKey);
  let portrait: Phaser.GameObjects.Sprite;
  let restX: number;
  let restY: number;
  let eyes: Eye[] = [];
  let scale: number;
  if (hasCut) {
    const fr = scene.textures.getFrame(cutKey, 'f0') ?? scene.textures.getFrame(cutKey);
    const h = fr?.cutHeight ?? 120;
    const w = fr?.cutWidth ?? 160;
    scale = Math.max(1, Math.floor((band.H + 40) / h));
    portrait = scene.add.sprite(0, 0, cutKey, fr?.name ?? 0).setOrigin(0.5, 0.5).setScale(scale).setFlipX(!p1);
    restX = p1 ? 70 + (w * scale) / 2 : GAME_W - 70 - (w * scale) / 2;
    restY = 180 + (band.slope * (restX - GAME_W / 2));
    if (scene.anims.exists(cutKey)) portrait.play(cutKey);
    const lastFrame = scene.textures.get(cutKey).getFrameNames().sort().pop() ?? 'f0';
    eyes = findEyes(scene, cutKey, lastFrame).map((e) => ({ x: (e.x - w / 2) * scale, y: (e.y - h / 2) * scale }));
  } else {
    const art = monsterArt(o.monsterId);
    scale = 3;
    portrait = scene.add.sprite(0, 0, monsterTextureKey(o.monsterId), monsterFrameName('idle', 0)).setScale(scale).setFlipX(!p1);
    if (scene.anims.exists(monsterAnimKey(o.monsterId, 'idle'))) portrait.play(monsterAnimKey(o.monsterId, 'idle'));
    // frame the head: put the top of the silhouette just inside the band, the core centered
    const found = findEyes(scene, monsterTextureKey(o.monsterId), monsterFrameName('idle', 0));
    const eye = found[0] ?? { x: art.core.x + art.w * 0.2, y: art.core.y - art.h * 0.2 };
    portrait.setOrigin(0.5, 0.5);
    // horizontally: head toward the band center; vertically: eyes ~40 % down the band
    const ex = (eye.x - art.w / 2) * scale * (p1 ? 1 : -1);
    const ey = (eye.y - art.h / 2) * scale;
    restX = (p1 ? 250 : GAME_W - 250) - ex;
    restY = 150 - ey;
    eyes = [{ x: ex, y: ey }];
  }
  portrait.setDepth(D + 2).setScrollFactor(0);
  objs.push(portrait);
  // portrait mask = band (updated during the wipe)
  const maskG = scene.make.graphics({ x: 0, y: 0 }, false);
  const drawMask = () => {
    maskG.clear();
    maskG.fillStyle(0xffffff, 1);
    const edgeX = dir > 0 ? lerp(-60, GAME_W + 60, wipe) : lerp(GAME_W + 60, -60, wipe);
    const xa = dir > 0 ? 0 : Math.max(0, edgeX - 60);
    const xb = dir > 0 ? Math.min(GAME_W, edgeX + 60) : GAME_W;
    maskG.fillPoints(
      [
        new Phaser.Math.Vector2(xa, band.top(xa)),
        new Phaser.Math.Vector2(xb, band.top(xb)),
        new Phaser.Math.Vector2(xb, band.bottom(xb)),
        new Phaser.Math.Vector2(xa, band.bottom(xa)),
      ],
      true,
    );
  };
  drawMask();
  const mask = maskG.createGeometryMask();
  portrait.setMask(mask);
  objs.push(mask, maskG);
  const startX = restX - dir * 360;
  portrait.setPosition(startX, restY).setVisible(false);
  // afterimage echo trailing the slide
  const echo = scene.add.sprite(startX, restY, portrait.texture.key, portrait.frame.name).setScale(scale).setFlipX(portrait.flipX).setDepth(D + 1.5).setScrollFactor(0).setTintFill(ramp[3]).setAlpha(0.5).setVisible(false);
  echo.setMask(mask);
  objs.push(echo);

  const sparks = new Sparks(scene, D + 4);
  objs.push(sparks);

  let slide = 0; // 0..1 fast entry
  let drift = 0;
  const stop = onFrame(scene, (dt, el) => {
    drawBand(el, dt);
    if (wipe < 1) drawMask();
    const k = E.outExpo(slide);
    const px = lerp(startX, restX, k) + dir * drift;
    portrait.setPosition(Math.round(px), Math.round(restY));
    if (slide > 0 && slide < 1) {
      echo.setVisible(true).setFrame(portrait.frame.name).setPosition(Math.round(lerp(startX, restX, E.outExpo(Math.max(0, slide - 0.12)))), Math.round(restY));
    } else echo.setVisible(false);
  });
  objs.push({ destroy: stop });

  // ================================================================ timeline
  snd('cutIn', 1);
  void run(scene, 150, (t) => dim.setAlpha(0.6 * t));
  await run(scene, 150, (t) => (wipe = E.outCubic(t)));
  wipe = 1;
  drawMask();
  void run(scene, 300, (t) => (burstOn = E.outCubic(t)));
  await sleep(scene, 30);
  // portrait slides in
  portrait.setVisible(true);
  snd('whoosh', 0.8, 0.8);
  await run(scene, 300, (t) => {
    slide = t;
    lineSpeedK = 1 + (1 - t) * 1.5;
  });
  slide = 1;
  void run(scene, 1000, (t) => (drift = t * 10));
  await sleep(scene, 110);
  // eyes flare
  snd('roarBig', 0.9);
  for (const e of eyes) {
    const ex = portrait.x + e.x;
    const ey = portrait.y + e.y;
    const star = scene.add.image(Math.round(ex), Math.round(ey), TEX.spark).setDepth(D + 5).setScrollFactor(0).setTint(PAL.white);
    const streak = scene.add.rectangle(Math.round(ex), Math.round(ey), 2, 1, PAL.white).setDepth(D + 5).setScrollFactor(0);
    const streak2 = scene.add.rectangle(Math.round(ex), Math.round(ey), 2, 1, ramp[3]).setDepth(D + 4.9).setScrollFactor(0);
    objs.push(star, streak, streak2);
    void run(scene, 420, (t) => {
      const k = t < 0.25 ? E.outBack(t / 0.25) : 1 - E.inQuad((t - 0.25) / 0.75);
      star.setScale(Math.max(0.01, Math.round(k * 4)));
      star.setTint(t < 0.4 ? PAL.white : ramp[4]);
      streak.setSize(Math.max(1, Math.round(k * 90)), 1).setPosition(Math.round(portrait.x + e.x), Math.round(portrait.y + e.y));
      streak2.setSize(Math.max(1, Math.round(k * 56)), 3).setPosition(Math.round(portrait.x + e.x), Math.round(portrait.y + e.y));
      star.setPosition(Math.round(portrait.x + e.x), Math.round(portrait.y + e.y));
      streak2.setAlpha(0.6);
    });
  }
  bandFlash = 0.3;
  void run(scene, 90, (t) => (bandFlash = 0.3 * (1 - t)));
  await sleep(scene, 100);

  // ---- name plate slam
  const def = cardDef(o.monsterId);
  const level = isMonster(def) ? def.level : 0;
  const nameText = upper(o.name) + '!';
  const plateX = p1 ? 448 : GAME_W - 448;
  const plateY = Math.round(band.bottom(plateX) - 46);
  let title: Phaser.GameObjects.BitmapText | null = null;
  let sub: Phaser.GameObjects.BitmapText | null = null;
  try {
    title = pixelText(scene, plateX, plateY, nameText, { size: 'xl', color: PAL.gold3, originX: 0.5, originY: 0.5, shadow: 1 })
      .setDepth(D + 6)
      .setScrollFactor(0);
    sub = pixelText(scene, plateX, plateY + 26, `${'★'.repeat(Math.max(0, Math.min(8, level)))}  ${ATTRIBUTE_NAMES[o.attribute]}`, { size: 'md', color: ramp[3], originX: 0.5, originY: 0.5 })
      .setDepth(D + 6)
      .setScrollFactor(0)
      .setVisible(false);
    objs.push(title, sub);
  } catch (e) {
    console.warn('[cutin] pixelText unavailable', e);
  }
  // plate: dark slab with attribute stripe behind the name
  const tw = title ? title.width : 200;
  const plate = new Raster(scene, plateX - tw / 2 - 30, plateY - 22, tw + 60, 60, D + 5.5);
  plate.img.setScrollFactor(0);
  objs.push(plate);
  let plateK = 0;
  const drawPlate = () =>
    plate.draw((g) => {
      if (plateK <= 0) return;
      const w = (tw + 36) * plateK;
      const x0 = plateX - w / 2;
      const y0 = plateY - 16;
      const h = 34;
      const sl = 8;
      const pts = [
        { x: x0 + sl, y: y0 },
        { x: x0 + w + sl, y: y0 },
        { x: x0 + w - sl, y: y0 + h },
        { x: x0 - sl, y: y0 + h },
      ];
      g.poly(pts, PAL.ink);
      g.poly(pts.map((p) => ({ x: p.x, y: p.y })), ramp[0], 0.6);
      g.path([...pts, pts[0]], ramp[3]);
      g.line(x0 + sl + 3, y0 + 2, x0 + w + sl - 3, y0 + 2, ramp[2]);
      g.line(x0 - sl + 3, y0 + h + 2, x0 + w - sl + 6, y0 + h + 2, PAL.gold3);
      g.line(x0 - sl + 10, y0 + h + 4, x0 + w - sl - 4, y0 + h + 4, PAL.gold1);
    });
  snd('cardSlam', 1);
  snd('impactHeavy', 0.8, 0.9);
  // never let the oversized slam frame leave the screen
  const maxK = Math.max(1, Math.min(1.75, (2 * Math.min(plateX, GAME_W - plateX) - 8) / Math.max(1, tw)));
  if (title) title.setScale(maxK).setTint(PAL.white).setAlpha(1);
  await run(scene, 90, (t) => {
    plateK = E.outBack(t);
    drawPlate();
    // stepped scale (big → 1) reads as a slam and keeps the glyphs blocky
    if (title) title.setScale(t < 0.4 ? maxK : t < 0.7 ? lerp(maxK, 1, 0.5) : t < 0.9 ? lerp(maxK, 1, 0.8) : 1);
  });
  plateK = 1;
  drawPlate();
  if (title) title.setScale(1.08, 0.9).setTint(PAL.white);
  bandFlash = 0.5;
  void run(scene, 140, (t) => (bandFlash = 0.5 * (1 - t)));
  void sleep(scene, 50).then(() => title?.active && title.setScale(1));
  void shake(scene, 220, 3);
  sparks.burst(26, () => {
    const a = rr(0, TAU);
    const v = rr(80, 240);
    return { x: plateX + rr(-tw / 2, tw / 2), y: plateY + rr(-8, 8), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, drag: 3, life: rr(240, 460), ramp: [PAL.white, PAL.gold4, PAL.gold3, ramp[3]], tex: rnd() < 0.3 ? TEX.plus : TEX.px1 };
  });
  await sleep(scene, 50);
  if (title) title.setTint(PAL.gold3);
  // shine sweep over the name
  const shine = new Raster(scene, plateX - tw / 2 - 10, plateY - 14, tw + 20, 30, D + 6.5, Phaser.BlendModes.ADD);
  shine.img.setScrollFactor(0);
  objs.push(shine);
  void run(scene, 260, (t) => {
    shine.draw((g) => {
      const sx = plateX - tw / 2 - 10 + t * (tw + 40);
      for (let y = plateY - 14; y < plateY + 16; y++) {
        const x = sx - (y - plateY) * 0.5;
        g.rect(x, y, 3, 1, PAL.gold4, 0.9);
        g.rect(x + 4, y, 1, 1, PAL.gold2, 0.6);
      }
    });
  });
  if (sub) {
    sub.setVisible(true).setAlpha(0);
    void run(scene, 160, (t) => sub!.setAlpha(t < 0.5 ? 0.5 : 1).setY(Math.round(plateY + 26 + (1 - t) * 6)));
  }
  await sleep(scene, 460);

  // ---- white flash out
  snd('summonBurst', 0.8, 1.2);
  const white = scene.add.rectangle(0, 0, GAME_W, GAME_H, PAL.white, 1).setOrigin(0).setScrollFactor(0).setDepth(D + 10).setAlpha(0);
  await run(scene, 70, (t) => white.setAlpha(t));
  for (const ob of objs) ob.destroy();
  void run(scene, 260, (t) => white.setAlpha(1 - E.outQuad(t))).then(() => white.destroy());
  void cam;
  void clamp01;
  void seg;
  await sleep(scene, 40);
}
