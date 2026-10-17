// ?dev=relight — A1 item 10: the P2 'relight' pipe, proven with a TEST-ONLY shim
// (src/dev/relight-shim.ts: the abyss magus whose P2 idle is the hand-painted still frame, lit
// from the frame's top-right). The shim's sheet is registered as `mon:abyss_magus:p2` for this
// page only (the shipped magus stays 'mirror'), so every MonsterUnit of the magus that player 2
// controls shows it — through the real applyFacing / setController / UnitSprite.syncSheet code.
//
//   ?dev=relight                 side by side ×2: P1 (original) | P2 mirror (today: flipX of the P1
//                                sheet) | P2 relight (shim). At 2.0 s the outer two units swap
//                                controllers (setController) and the sheets follow; at 4.0 s back.
//   ?dev=relight&s=<scenario>    the same shim, then the real duel scenario (as ?dev=duel&s=...):
//                                e.g. saMagusP2, suMagusP2, saMagusEffectP2.
//   &lazy=1                      register the shim sheet DEFERRED (prepareMonsterSheet + background
//                                painting) instead of building it at once.
//
// window.__relight: memory / timing of the extra sheet and the light-side metric (litBias) of
// what is on screen: { sheets: {p1, p2}, bytes, heapMB, buildMs, bias: {p1, mirror, relit},
// keys(): current texture key of every unit }.

import Phaser from 'phaser';
import type { DevPreview } from '../types';
import { MONSTER_IDS } from '../../data/cards';
import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { monsterArt } from '../../art/monsters';
import {
  buildMonster,
  monsterAnimKey,
  monsterFrameName,
  monsterP2TextureKey,
  monsterSheetPending,
  monsterTextureKey,
  paintMonsterSheets,
  prepareMonsterSheet,
  whenMonstersBuilt,
} from '../../art/textures';
import { pixelText } from '../../ui/text';
import { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH } from '../../view/layout';
import { litBias, relightShimArt } from '../relight-shim';
import duelPreview from './duel';

const ID = 'abyss_magus';

function texBytes(scene: Phaser.Scene, key: string): number {
  if (!scene.textures.exists(key)) return 0;
  let b = 0;
  for (const s of scene.textures.get(key).source) b += s.width * s.height * 4;
  return b;
}

function heapMB(): number | null {
  const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  return m ? +(m.usedJSHeapSize / 1048576).toFixed(2) : null;
}

const MB = (b: number) => +(b / 1048576).toFixed(3);

interface RelightInfo {
  lazy: boolean;
  sheets: { p1: { key: string; w: number; h: number }; p2: { key: string; w: number; h: number } };
  bytes: { p1: number; p2: number; allMonstersP1: number; textureMB: { before: number; after: number } };
  heapMB: { before: number | null; after: number | null };
  buildMs: number;
  bias: { p1: ReturnType<typeof litBias>; mirror: ReturnType<typeof litBias>; relit: ReturnType<typeof litBias> };
  keys?: () => Record<string, string>;
  pending?: () => string[] | null;
}

function totalTextureBytes(scene: Phaser.Scene): number {
  let b = 0;
  for (const k of Object.keys(scene.textures.list)) if (!k.startsWith('__')) b += texBytes(scene, k);
  return b;
}

/** Register the shim's P2 sheet (sync or deferred) and measure what it costs. */
async function registerShim(scene: Phaser.Scene, lazy: boolean): Promise<RelightInfo> {
  await whenMonstersBuilt();
  const art = relightShimArt();
  const key = monsterP2TextureKey(ID);
  const texBefore = totalTextureBytes(scene);
  const h0 = heapMB();
  const t0 = performance.now();
  if (lazy) {
    prepareMonsterSheet(scene, art, { key, draw: { lightFrom: 'right' } });
    paintMonsterSheets([key]);
  } else buildMonster(scene, art, { key, draw: { lightFrom: 'right' } });
  const buildMs = +(performance.now() - t0).toFixed(1);
  const src = (k: string) => scene.textures.get(k).source[0];
  const p1 = monsterTextureKey(ID);
  const frame = (o?: { lightFrom: 'right' }) => {
    const p = new PixelCanvas(art.w, art.h);
    art.draw(p, 'idle', 0, o);
    return p;
  };
  const info: RelightInfo = {
    lazy,
    sheets: { p1: { key: p1, w: src(p1).width, h: src(p1).height }, p2: { key, w: src(key).width, h: src(key).height } },
    bytes: {
      p1: texBytes(scene, p1),
      p2: texBytes(scene, key),
      allMonstersP1: MONSTER_IDS.reduce((s, id) => s + texBytes(scene, monsterTextureKey(id)), 0),
      textureMB: { before: MB(texBefore), after: MB(totalTextureBytes(scene)) },
    },
    heapMB: { before: h0, after: heapMB() },
    buildMs,
    bias: { p1: litBias(frame()), mirror: litBias(frame(), true), relit: litBias(frame({ lightFrom: 'right' }), true) },
    pending: () => monsterSheetPending(key),
  };
  (window as unknown as { __relight: RelightInfo }).__relight = info;
  return info;
}

function label(scene: Phaser.Scene, x: number, y: number, s: string, color: number = PAL.mist) {
  return pixelText(scene, x, y, s, { size: 'sm', color }).setDepth(DEPTH.DEBUG);
}

const preview: DevPreview = {
  name: 'relight',
  description: 'P2 relight test (shim magus): side by side, or &s=<scenario> in the duel',
  async create(scene, params) {
    const info = await registerShim(scene, params.get('lazy') === '1');
    if (params.get('s')) return duelPreview.create(scene, params);

    // ---------------------------------------------------------------- side by side ×2
    scene.cameras.main.setBackgroundColor(PAL.night0);
    const S = 2;
    const art = monsterArt(ID);
    const groundY = 250;
    const xs = [112, 320, 528];
    // the units stand on their tiles' logic (controller, zone) but are shown here, ×2, without badges
    const place = (u: MonsterUnit, x: number) => {
      u.badge.setVisible(false);
      u.sprite.setScale(S).setPosition(x, groundY - art.hover * S);
    };
    const left = new MonsterUnit(scene, { uid: 9001 as never, cardId: ID, player: 0, zone: 0, position: 'attack', atk: 0, def: 0 });
    const right = new MonsterUnit(scene, { uid: 9002 as never, cardId: ID, player: 1, zone: 0, position: 'attack', atk: 0, def: 0 });
    place(left, xs[0]);
    place(right, xs[2]);
    // today's P2: a plain sprite of the P1 sheet, mirrored
    const mirror = scene.add
      .sprite(xs[1], groundY - art.hover * S, monsterTextureKey(ID), monsterFrameName('idle', 0))
      .setFlipX(true)
      .setOrigin((art.w - art.anchorX) / art.w, art.anchorY / art.h)
      .setScale(S)
      .setDepth(DEPTH.UNIT);
    mirror.play({ key: monsterAnimKey(ID, 'idle'), repeat: -1 });
    // same idle phase for all three (the units start at a random frame)
    for (const u of [left, right]) u.sprite.play({ key: monsterAnimKey(ID, 'idle'), repeat: -1 });

    label(scene, 8, 6, 'P2 RELIGHT — test shim: abyss_magus idle = still frame lit from the FRAME top-right (src/still/magus-map.ts)', PAL.gold4);
    label(scene, 8, 18, 'light from the SCREEN top-left wanted on both sides. litBias > 0 = lit from the screen left', PAL.steel);
    const heads = ['P1 (original sheet)', 'P2 mirror (today: flipX)', 'P2 relight (mon:...:p2)'];
    const tags = heads.map((h, i) => label(scene, xs[i] - 70, 44, h, i === 1 ? PAL.fire3 : PAL.cyan3));
    const keyTags = xs.map((x) => label(scene, x - 70, 56, '', PAL.mist));
    const b = info.bias;
    const bias = [b.p1, b.mirror, b.relit];
    xs.forEach((x, i) => label(scene, x - 70, 290, `litBias ${bias[i].bias > 0 ? '+' : ''}${bias[i].bias}  mass ${bias[i].mass > 0 ? '+' : ''}${bias[i].mass}`, bias[i].bias > 0 ? PAL.leaf3 : PAL.fire3));
    const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
    label(
      scene,
      8,
      318,
      `p2 sheet ${info.sheets.p2.w}x${info.sheets.p2.h} = ${kb(info.bytes.p2)} (p1 ${kb(info.bytes.p1)}); textures ${info.bytes.textureMB.before} -> ${info.bytes.textureMB.after} MB; all 12 p1 sheets ${MB(info.bytes.allMonstersP1)} MB; build ${info.buildMs} ms${info.lazy ? ' (deferred)' : ''}`,
      PAL.steel,
    );
    const phase = label(scene, 8, 334, '', PAL.mist);
    const units = { left, right };
    info.keys = () => ({ left: left.sprite.texture.key, mirror: mirror.texture.key, right: right.sprite.texture.key, leftPlayer: String(left.player), rightPlayer: String(right.player) });
    const refresh = () => {
      keyTags[0].setText(`${left.sprite.texture.key}  P${left.player + 1}`);
      keyTags[1].setText(`${mirror.texture.key}  flipX`);
      keyTags[2].setText(`${right.sprite.texture.key}  P${right.player + 1}`);
    };
    refresh();
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, refresh);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, refresh));
    // setController: the outer two swap sides (Soul Recall can move a monster mid-game)
    const swap = (to: 'swapped' | 'back') => {
      units.left.setController(to === 'swapped' ? 1 : 0, 0);
      units.right.setController(to === 'swapped' ? 0 : 1, 0);
      place(left, xs[0]);
      place(right, xs[2]);
      tags[0].setText(to === 'swapped' ? 'setController(P2): relit' : heads[0]);
      tags[2].setText(to === 'swapped' ? 'setController(P1): original' : heads[2]);
      phase.setText(to === 'swapped' ? 't >= 2.0 s: outer units swapped controllers' : 't >= 4.0 s: back');
    };
    phase.setText('t < 2.0 s: as dealt');
    scene.time.delayedCall(2000, () => swap('swapped'));
    scene.time.delayedCall(4000, () => swap('back'));
  },
};

export default preview;
