// ?view=monster&id=<id> — inspect an HD monster (the art agents' main feedback loop).
//
//   live (default)  four panes at 1:1 playing one animation in sync: COLOUR | NORMAL MAP | LIT (a light orbits it,
//                   plus the owner's cyan rim) | LIT P2 (flipX, crimson rim — checks the mirrored normals);
//                   below: every frame of the animation as a thumbnail strip (current one boxed)
//   sheet           &mode=sheet&kind=color|normal|lit&anim=<anim>&page=<n>: a contact sheet of the animation's frames
//                   at 1:1 (lit = one fixed key light from the upper-left so frames compare)
//
//   &anim=idle|roar|attack|hit|guard   &frame=<n>&pause=1 (hold one frame)   &zoom=2 (integer, live mode)
//   keys: [ ] previous/next animation   , . step a frame (pauses)   P pause   G guides (anchor / muzzle / core)
//         K cycle sheet kind   PgUp/PgDn sheet page

import Phaser from 'phaser';
import type { MonsterId } from '../../../data/cards';
import { PAL } from '../../../art/palette';
import { MONSTER_ANIMS, type MonsterAnim } from '../../../art/types';
import { pixelText } from '../../../ui/text';
import { DEPTH } from '../../../view/layout';
import { HD_H, HD_W } from '../../contracts';
import { ensureMonsterTextures, listMonsterIds, type MonsterTextures } from '../assets';
import { useLighting } from '../lighting';
import type { ViewCtx } from '../TrialScene';

type Kind = 'color' | 'normal' | 'lit';
const KINDS: Kind[] = ['color', 'normal', 'lit'];

export async function monsterView(ctx: ViewCtx): Promise<void> {
  const { scene, kit, params, signal } = ctx;
  const id = (params.get('id') ?? listMonsterIds()[0] ?? 'crystal_wyrm') as MonsterId;
  const loading = pixelText(scene, HD_W / 2, HD_H / 2, 'YÜKLENİYOR', { size: 'lg', color: PAL.cyan3, originX: 0.5, originY: 0.5 }).setDepth(DEPTH.DEBUG);
  const tex = await ensureMonsterTextures(scene, id, (d, t) => loading.setText(`YÜKLENİYOR ${id} ${d}/${t}`));
  loading.destroy();
  if (signal.aborted) return;

  // backdrop
  const bg = scene.add.graphics().setDepth(DEPTH.SKY);
  bg.fillGradientStyle(0x0b0d1f, 0x0b0d1f, 0x12163a, 0x12163a, 1);
  bg.fillRect(0, 0, HD_W, HD_H);

  const mode = params.get('mode') === 'sheet' ? 'sheet' : 'live';
  if (mode === 'sheet') sheet(ctx, tex);
  else live(ctx, tex);
  void kit;
}

function animOf(params: URLSearchParams): MonsterAnim {
  const a = params.get('anim') as MonsterAnim | null;
  return a && MONSTER_ANIMS.includes(a) ? a : 'idle';
}

function header(scene: Phaser.Scene, tex: MonsterTextures, anim: MonsterAnim): Phaser.GameObjects.BitmapText {
  const t = pixelText(scene, 8, 6, '', { size: 'md', color: PAL.gold3 }).setDepth(DEPTH.DEBUG);
  const a = tex.art;
  const s = a.anims[anim];
  t.setText(`${a.id.toUpperCase()}${tex.placeholder ? ' (GEÇİCİ SANAT)' : ''}  ${a.w}×${a.h}  ÇAPA ${a.anchorX},${a.anchorY}  HOVER ${a.hover}   ${anim.toUpperCase()} ${s.frames} KARE @${s.fps} ${s.loop ? 'DÖNGÜ' : 'TEK'}`);
  return t;
}

// ================================================================ live

function live(ctx: ViewCtx, tex: MonsterTextures): void {
  const { scene, kit, params } = ctx;
  const art = tex.art;
  const L = kit.lighting;
  let anim = animOf(params);
  let t = 0;
  let paused = params.get('pause') === '1';
  let frame = Number(params.get('frame') ?? 0) || 0;
  let guides = params.get('guides') !== '0';
  const zoom = Math.max(1, Math.min(4, Math.floor(Number(params.get('zoom') ?? 1)) || 1));
  const fw = art.w * zoom;
  const fh = art.h * zoom;
  const panes = fw * 4 + 5 * 12 <= HD_W ? 4 : 3;
  const gap = Math.floor((HD_W - panes * fw) / (panes + 1));
  const top = 44;

  const head = header(scene, tex, anim);
  L.ambient(0xb4bff0, 0.9);

  const labels = ['RENK', 'NORMAL HARİTASI', 'IŞIK · P1', 'IŞIK · P2 (FLIPX)'];
  const sprites: Phaser.GameObjects.Image[] = [];
  const centers: { x: number; y: number }[] = [];
  const frameName = (a: MonsterAnim, f: number) => tex.frameName(a, f);

  for (let i = 0; i < panes; i++) {
    const x0 = gap + i * (fw + gap);
    const g = scene.add.graphics().setDepth(DEPTH.TILE);
    g.fillStyle(0x07070f, 0.55).fillRect(x0 - 4, top - 4, fw + 8, fh + 8);
    g.lineStyle(1, 0x28356f, 1).strokeRect(x0 - 4.5, top - 4.5, fw + 9, fh + 9);
    pixelText(scene, x0, top + fh + 8, labels[i], { size: 'md', color: PAL.mist }).setDepth(DEPTH.DEBUG);
    const flip = i === 3;
    const key = i === 1 ? tex.normalKey : tex.key;
    const im = scene.add.image(x0 + fw / 2, top + fh / 2, key, frameName(anim, 0)).setScale(zoom).setDepth(DEPTH.UNIT);
    if (i >= 2) useLighting(im, { emissive: 0.45 });
    if (flip) im.setFlipX(true);
    sprites.push(im);
    centers.push({ x: x0 + fw / 2, y: top + fh / 2 });
  }

  // lights: pane 3 gets an orbiting white key + cyan rim, pane 4 an orbiting key + crimson rim
  const key1 = L.addPointLight(0, 0, 0xfff2d0, 150 * zoom, 1.25, 55 * zoom);
  const rim1 = L.addPointLight(centers[2].x - 70 * zoom, centers[2].y + 50 * zoom, 0x3fe0ea, 130 * zoom, 0.95, 24 * zoom);
  void rim1;
  let key2: ReturnType<typeof L.addPointLight> | null = null;
  if (panes === 4) {
    key2 = L.addPointLight(0, 0, 0xfff2d0, 150 * zoom, 1.25, 55 * zoom);
    L.addPointLight(centers[3].x + 70 * zoom, centers[3].y - 50 * zoom, 0xff4d5e, 130 * zoom, 0.95, 24 * zoom);
  }
  const dots = [kit.fx.glowSprite(0, 0, 0xfff2d0, 22, 0.9, 'front'), kit.fx.glowSprite(0, 0, 0xfff2d0, 22, 0.9, 'front')];

  // guides: anchor / muzzle / core marks on the colour pane
  const guide = scene.add.graphics().setDepth(DEPTH.FX_TOP);
  const drawGuides = (f: number) => {
    guide.clear();
    if (!guides) return;
    const ox = centers[0].x - fw / 2;
    const oy = centers[0].y - fh / 2;
    const cross = (px: number, py: number, color: number) => {
      guide.lineStyle(1, color, 1);
      guide.strokeRect(ox + px * zoom - 3, oy + py * zoom - 3, 7, 7);
    };
    cross(art.anchorX, art.anchorY, 0x4fe2af);
    cross(art.muzzle.x, art.muzzle.y, 0xff69ef);
    cross(art.core.x, art.core.y, 0xffd447);
    guide.lineStyle(1, 0x4fe2af, 0.35);
    guide.lineBetween(ox, oy + art.anchorY * zoom, ox + fw, oy + art.anchorY * zoom);
    const pts = art.points?.(anim, f);
    if (pts) for (const p of Object.values(pts)) cross(p.x, p.y, 0xffffff);
  };

  // thumbnail strip of the whole animation
  const strip = scene.add.container(0, 0).setDepth(DEPTH.UNIT);
  const sel = scene.add.graphics().setDepth(DEPTH.FX_TOP);
  const stripTop = top + fh + 34;
  const buildStrip = () => {
    strip.removeAll(true);
    const n = art.anims[anim].frames;
    const avail = HD_H - 20 - stripTop;
    const th = Math.min(96, Math.max(48, Math.floor(avail / Math.ceil(n / Math.floor(HD_W / 100)) - 4)));
    const k = th / art.h;
    const tw = art.w * k;
    const cols = Math.max(1, Math.floor((HD_W - 16) / (tw + 4)));
    for (let f = 0; f < n; f++) {
      const x = 8 + (f % cols) * (tw + 4);
      const y = stripTop + Math.floor(f / cols) * (th + 4);
      strip.add(scene.add.image(x, y, tex.key, frameName(anim, f)).setOrigin(0).setScale(k));
      strip.add(pixelText(scene, x + 1, y + 1, String(f), { size: 'sm', color: PAL.mist }));
    }
    (strip as unknown as { geo: unknown }).geo = { cols, tw, th };
  };
  const drawSel = (f: number) => {
    sel.clear();
    const geo = (strip as unknown as { geo: { cols: number; tw: number; th: number } }).geo;
    const x = 8 + (f % geo.cols) * (geo.tw + 4);
    const y = stripTop + Math.floor(f / geo.cols) * (geo.th + 4);
    sel.lineStyle(2, 0xffd447, 1).strokeRect(x - 1, y - 1, geo.tw + 2, geo.th + 2);
  };
  buildStrip();

  const apply = (f: number) => {
    const name = frameName(anim, f);
    sprites.forEach((s) => s.setFrame(name));
    drawGuides(f);
    drawSel(f);
    const spec = art.anims[anim];
    head.setText(
      `${art.id.toUpperCase()}${tex.placeholder ? ' (GEÇİCİ SANAT)' : ''}  ${art.w}×${art.h}  ÇAPA ${art.anchorX},${art.anchorY}  HOVER ${art.hover}   ${anim.toUpperCase()} ${spec.frames} KARE @${spec.fps} ${spec.loop ? 'DÖNGÜ' : 'TEK'}   KARE ${f}${paused ? ' (DURDU)' : ''}`,
    );
  };
  apply(frame);

  scene.events.on(Phaser.Scenes.Events.UPDATE, (time: number, delta: number) => {
    const spec = art.anims[anim];
    if (!paused) {
      t += delta / 1000;
      frame = Math.floor(t * spec.fps) % spec.frames;
    }
    frame = ((frame % spec.frames) + spec.frames) % spec.frames;
    apply(frame);
    const s = time / 1000;
    const orbit = (c: { x: number; y: number }, phase: number) => ({
      x: c.x + Math.cos(s * 1.9 + phase) * 105 * zoom,
      y: c.y - 8 * zoom + Math.sin(s * 1.9 + phase) * 80 * zoom,
    });
    const p1 = orbit(centers[2], 0);
    key1.setPosition(p1.x, p1.y);
    dots[0].setPosition(p1.x, p1.y);
    if (key2) {
      const p2 = orbit(centers[3], Math.PI);
      key2.setPosition(p2.x, p2.y);
      dots[1].setPosition(p2.x, p2.y);
    } else dots[1].setVisible(false);
  });

  const kb = scene.input.keyboard;
  const switchAnim = (d: number) => {
    anim = MONSTER_ANIMS[(MONSTER_ANIMS.indexOf(anim) + d + MONSTER_ANIMS.length) % MONSTER_ANIMS.length];
    t = 0;
    frame = 0;
    buildStrip();
  };
  kb?.on('keydown-OPEN_BRACKET', () => switchAnim(-1));
  kb?.on('keydown-CLOSED_BRACKET', () => switchAnim(1));
  kb?.on('keydown-COMMA', () => {
    paused = true;
    frame--;
  });
  kb?.on('keydown-PERIOD', () => {
    paused = true;
    frame++;
  });
  kb?.on('keydown-P', () => {
    paused = !paused;
    t = frame / art.anims[anim].fps;
  });
  kb?.on('keydown-G', () => (guides = !guides));
  ctx.status(`${id2(tex)}`);
}

const id2 = (tex: MonsterTextures) => (tex.placeholder ? 'GEÇİCİ SANAT' : 'HD SANAT');

// ================================================================ sheet

function sheet(ctx: ViewCtx, tex: MonsterTextures): void {
  const { scene, kit, params } = ctx;
  const art = tex.art;
  let anim = animOf(params);
  let kind: Kind = (KINDS as string[]).includes(params.get('kind') ?? '') ? (params.get('kind') as Kind) : 'color';
  let page = Number(params.get('page') ?? 0) || 0;
  const L = kit.lighting;
  L.ambient(0xb4bff0, 0.9);
  const key = L.addPointLight(60, 20, 0xfff2d0, 1400, 1.2, 420);
  void key;
  const cols = Math.max(1, Math.floor(HD_W / art.w));
  const rows = Math.max(1, Math.floor((HD_H - 28) / art.h));
  const per = cols * rows;
  const head = header(scene, tex, anim);
  const cells = scene.add.container(0, 0).setDepth(DEPTH.UNIT);

  const build = () => {
    cells.removeAll(true);
    const n = art.anims[anim].frames;
    const pages = Math.ceil(n / per);
    page = ((page % pages) + pages) % pages;
    const x0 = Math.floor((HD_W - cols * art.w) / 2);
    for (let i = 0; i < per; i++) {
      const f = page * per + i;
      if (f >= n) break;
      const x = x0 + (i % cols) * art.w;
      const y = 28 + Math.floor(i / cols) * art.h;
      const cell = scene.add.rectangle(x, y, art.w - 1, art.h - 1, 0x07070f, 0.5).setOrigin(0);
      const im = scene.add.image(x, y, kind === 'normal' ? tex.normalKey : tex.key, tex.frameName(anim, f)).setOrigin(0);
      if (kind === 'lit') useLighting(im, { emissive: 0.45 });
      cells.add([cell, im, pixelText(scene, x + 2, y + 2, String(f), { size: 'sm', color: PAL.mist })]);
    }
    head.setText(
      `${art.id.toUpperCase()}${tex.placeholder ? ' (GEÇİCİ SANAT)' : ''}  ${anim.toUpperCase()}  ${kind === 'color' ? 'RENK' : kind === 'normal' ? 'NORMAL' : 'IŞIKLI'}  SAYFA ${page + 1}/${pages}  (${n} KARE)`,
    );
  };
  build();
  const kb = scene.input.keyboard;
  kb?.on('keydown-OPEN_BRACKET', () => {
    anim = MONSTER_ANIMS[(MONSTER_ANIMS.indexOf(anim) + MONSTER_ANIMS.length - 1) % MONSTER_ANIMS.length];
    page = 0;
    build();
  });
  kb?.on('keydown-CLOSED_BRACKET', () => {
    anim = MONSTER_ANIMS[(MONSTER_ANIMS.indexOf(anim) + 1) % MONSTER_ANIMS.length];
    page = 0;
    build();
  });
  kb?.on('keydown-K', () => {
    kind = KINDS[(KINDS.indexOf(kind) + 1) % KINDS.length];
    build();
  });
  kb?.on('keydown-PAGE_DOWN', () => {
    page++;
    build();
  });
  kb?.on('keydown-PAGE_UP', () => {
    page--;
    build();
  });
  ctx.status(id2(tex));
}
