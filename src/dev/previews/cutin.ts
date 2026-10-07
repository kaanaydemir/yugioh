// ?dev=cutin — ace cut-in portraits (src/art/cutins).
//   (no id)            all portraits in a 2×2 grid, animating (anim `cutin:<id>`, restarted every 2.2 s)
//   &id=<monster_id>   one portrait at real cut-in size over a mock diagonal speed-line band in its
//                      accent colours, placed exactly like src/vfx/cutin.ts places it
//   &player=2          mirrored (player 2: band slant, side and facing flip)
//   &frame=N           freeze on frame N instead of playing the timeline
//   &sheet=1           every frame of &id side by side (3 per row)
//   &eyes=1            mark where cutin.ts will put the lens glint (brightest isolated pixel of the
//                      last frame's head region — the same search as cutin.ts findEyes)
import Phaser from 'phaser';
import type { MonsterId } from '../../data/cards';
import { MONSTER_IDS, cardDef } from '../../data/cards';
import { cutinAnimKey, cutinArt, cutinFrame, cutinFrameName, cutinIds, cutinTextureKey, hasCutin, whenCutinsBuilt } from '../../art/cutins';
import { PAL } from '../../art/palette';
import { shade, type PixelCanvas } from '../../art/pixel';
import { GAME_W } from '../../view/layout';
import type { DevPreview } from '../types';

function label(scene: Phaser.Scene, x: number, y: number, s: string, color = '#b6fbff') {
  return scene.add.text(x, y, s, { fontFamily: 'monospace', fontSize: '8px', color }).setResolution(4).setDepth(1000);
}

/** Same search as src/vfx/cutin.ts findEyes (frame px), on a PixelCanvas. */
export function findGlint(pc: PixelCanvas): { x: number; y: number } | null {
  const lum = (x: number, y: number) => {
    const c = pc.get(x, y);
    if (c === null) return 0;
    return (((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.55 + (c & 255) * 0.15) / 255;
  };
  const b = pc.bounds();
  if (!b) return null;
  const x0 = b.x;
  const x1 = b.x + b.w - 1;
  const y0 = b.y;
  const y1 = b.y + b.h - 1;
  const yLim = y0 + (y1 - y0) * 0.45;
  const xMin = x0 + (x1 - x0) * 0.4;
  let best: { x: number; y: number } | null = null;
  let bestS = 0;
  for (let y = y0; y <= yLim; y++)
    for (let x = Math.floor(xMin); x <= x1; x++) {
      const l = lum(x, y);
      if (l < 0.6) continue;
      const nb = Math.min(lum(x - 1, y), lum(x + 1, y), lum(x, y - 1), lum(x, y + 1));
      const sc = l - nb * 0.8 + ((x - xMin) / (x1 - xMin)) * 0.15;
      if (sc > bestS) {
        bestS = sc;
        best = { x, y };
      }
    }
  return best;
}

/** Mock band: the slanted strip of src/vfx/cutin.ts filled with accentDark, accent speed lines. */
function mockBand(scene: Phaser.Scene, id: MonsterId, p1: boolean) {
  const art = cutinArt(id);
  const slope = p1 ? -0.13 : 0.13;
  const BH = 138;
  const mid = 178;
  const top = (x: number) => mid - BH / 2 + (x - GAME_W / 2) * slope;
  const key = `dev-cutin-band-${p1 ? 1 : 2}`;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, GAME_W, 360)!;
  const ctx = tex.getContext();
  const img = ctx.createImageData(GAME_W, 360);
  const lines = Array.from({ length: 40 }, (_, i) => ({ v: ((i * 37) % 97) / 97, x: (i * 131) % GAME_W, len: 30 + ((i * 53) % 110), sp: 600 + ((i * 71) % 700), c: i % 4 === 0 ? PAL.white : art.accent }));
  const put = (x: number, y: number, c: number) => {
    if (x < 0 || y < 0 || x >= GAME_W || y >= 360) return;
    const i = (y * GAME_W + x) * 4;
    img.data[i] = (c >> 16) & 255;
    img.data[i + 1] = (c >> 8) & 255;
    img.data[i + 2] = c & 255;
    img.data[i + 3] = 255;
  };
  const dir = p1 ? 1 : -1;
  const draw = (dt: number) => {
    img.data.fill(0);
    for (let x = 0; x < GAME_W; x++) {
      const y0 = Math.ceil(top(x));
      for (let y = y0; y < top(x) + BH; y++) put(x, y, art.accentDark);
      put(x, y0 - 1, PAL.white);
      put(x, y0 - 2, art.accent);
      put(x, Math.ceil(top(x) + BH), PAL.white);
      put(x, Math.ceil(top(x) + BH) + 1, art.accent);
    }
    for (const l of lines) {
      l.x -= dir * l.sp * (dt / 1000);
      if (dir > 0 && l.x + l.len < 0) l.x += GAME_W + l.len;
      if (dir < 0 && l.x > GAME_W) l.x -= GAME_W + l.len;
      for (let k = 0; k < l.len; k++) {
        const x = Math.round(l.x) + k;
        if (x < 0 || x >= GAME_W) continue;
        const y = Math.round(top(x) + 3 + l.v * (BH - 6));
        const tail = dir > 0 ? k / l.len : 1 - k / l.len;
        put(x, y, tail > 0.7 ? l.c : tail > 0.35 ? art.accent : shade(art.accentDark, 1));
      }
    }
    ctx.putImageData(img, 0, 0);
    tex.refresh();
  };
  draw(0);
  scene.add.image(0, 0, key).setOrigin(0).setDepth(1);
  scene.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dt: number) => draw(dt));
  return { top, BH, slope };
}

function playLooping(scene: Phaser.Scene, spr: Phaser.GameObjects.Sprite, id: MonsterId, period: number) {
  const k = cutinAnimKey(id);
  if (!scene.anims.exists(k)) return;
  spr.play(k);
  scene.time.addEvent({ delay: period, loop: true, callback: () => spr.play(k) });
}

const preview: DevPreview = {
  name: 'cutin',
  description: 'ace cut-in portraits: &id=<id> (real size over a mock band) &player=2 &frame=N &sheet=1 &eyes=1',
  async create(scene, params) {
    scene.cameras.main.setBackgroundColor(PAL.night0);
    // portraits are painted time-sliced after boot (src/boot/25-cutins.ts)
    await Promise.race([whenCutinsBuilt(), new Promise((r) => setTimeout(r, 15000))]);
    const idParam = params.get('id') as MonsterId | null;
    const frameParam = params.get('frame');
    const showEyes = params.get('eyes') === '1';
    const ids = cutinIds();

    if (!idParam || !MONSTER_IDS.includes(idParam)) {
      label(scene, 4, 2, `cut-in portraits (${ids.length}): ${ids.join(', ')}   — &id=<id> for the real-size band`);
      ids.slice(0, 4).forEach((id, i) => {
        const art = cutinArt(id);
        const x = 16 + (i % 2) * 312;
        const y = 16 + Math.floor(i / 2) * 172;
        scene.add.rectangle(x, y, art.w, art.h, art.accentDark).setOrigin(0);
        const spr = scene.add.sprite(x, y, cutinTextureKey(id), cutinFrameName(0)).setOrigin(0).setDepth(2);
        if (frameParam !== null) spr.setFrame(cutinFrameName(Math.min(art.frames - 1, Number(frameParam))));
        else playLooping(scene, spr, id, 2200);
        label(scene, x, y + art.h + 2, `${id} — ${cardDef(id).name}  ${art.w}×${art.h} ${art.frames}f`);
        if (showEyes) {
          const g = findGlint(cutinFrame(id, art.frames - 1));
          if (g) scene.add.rectangle(x + g.x, y + g.y, 3, 3, 0xff0000).setDepth(5);
        }
      });
      return;
    }

    const id = idParam;
    const art = cutinArt(id);
    if (params.get('sheet') === '1') {
      label(scene, 4, 2, `${id}${hasCutin(id) ? '' : ' (placeholder)'} — all ${art.frames} frames`);
      for (let f = 0; f < art.frames; f++) {
        const x = 8 + (f % 3) * (art.w + 8);
        const y = 14 + Math.floor(f / 3) * (art.h + 14);
        scene.add.rectangle(x, y, art.w, art.h, art.accentDark).setOrigin(0);
        scene.add.image(x, y, cutinTextureKey(id), cutinFrameName(f)).setOrigin(0).setDepth(2);
        label(scene, x + 2, y + art.h + 1, `f${f}`);
      }
      return;
    }

    const p1 = params.get('player') !== '2';
    const band = mockBand(scene, id, p1);
    // like src/vfx/cutin.ts: scale = floor((band.H + 40) / h), rest x/y (+5 = halfway through its
    // 10 px drift), flipped for P2
    const scale = Math.max(1, Math.floor((band.BH + 40) / art.h));
    const restX = p1 ? 70 + (art.w * scale) / 2 + 5 : GAME_W - 70 - (art.w * scale) / 2 - 5;
    const restY = 180 + band.slope * (restX - GAME_W / 2);
    const spr = scene.add.sprite(Math.round(restX), Math.round(restY), cutinTextureKey(id), cutinFrameName(0)).setScale(scale).setFlipX(!p1).setDepth(2);
    // mask to the band like the real cut-in
    const mg = scene.make.graphics({ x: 0, y: 0 }, false);
    mg.fillStyle(0xffffff, 1);
    mg.fillPoints([new Phaser.Math.Vector2(0, band.top(0)), new Phaser.Math.Vector2(GAME_W, band.top(GAME_W)), new Phaser.Math.Vector2(GAME_W, band.top(GAME_W) + band.BH), new Phaser.Math.Vector2(0, band.top(0) + band.BH)], true);
    spr.setMask(mg.createGeometryMask());
    if (frameParam !== null) spr.setFrame(cutinFrameName(Math.min(art.frames - 1, Number(frameParam))));
    else playLooping(scene, spr, id, 2200);
    label(scene, 4, 2, `${id} — ${cardDef(id).name}${hasCutin(id) ? '' : ' (placeholder)'}  ${art.w}×${art.h} ×${scale}  ${art.frames}f  P${p1 ? 1 : 2}`);
    label(scene, 4, 12, 'timeline: f0 400ms · build · peak ~540ms (eye flare) · roar hold flicker → 2.1 s', '#a3b1da');
    if (showEyes) {
      const g = findGlint(cutinFrame(id, art.frames - 1));
      if (g) {
        // NOTE: cutin.ts does not mirror the glint offset for player 2 (its x is not flipped)
        const ex = spr.x + (p1 ? g.x - art.w / 2 : art.w / 2 - g.x) * scale;
        const ey = spr.y + (g.y - art.h / 2) * scale;
        scene.add.rectangle(ex, ey, 1, 9, 0xff0000).setDepth(5);
        scene.add.rectangle(ex, ey, 9, 1, 0xff0000).setDepth(5);
      }
    }
  },
};

export default preview;
