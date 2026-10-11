// ?view=scene (default) — the real composition: arena theme, side lights, both monsters on their tiles with owner rim
// lights, then the looping cinematic sequence from src/hd/cine/ (see src/hd/app/api.ts). Without a sequence module
// the monsters simply idle under the lights.

import Phaser from 'phaser';
import type { MonsterId } from '../../../data/cards';
import { PAL } from '../../../art/palette';
import { pixelText } from '../../../ui/text';
import { DEPTH } from '../../../view/layout';
import { wait } from '../../../vfx/core';
import { HD_H, HD_W, hdZoneXY } from '../../contracts';
import type { HDSceneContext, HDSequence } from '../api';
import { ensureMonsterTextures, loadArenaTheme } from '../assets';
import type { ViewCtx } from '../TrialScene';
import { HDMonsterSprite } from '../units';

type SeqModule = { default?: HDSequence };
const cineLoaders = import.meta.glob<SeqModule>(['../../cine/*.ts', '!../../cine/_*.ts']);

const baseName = (p: string) => p.replace(/^.*\//, '').replace(/\.ts$/, '');

/** The sequence module: ?seq=<file>, else 'sequence' / 'index', else the first module that exports one. */
async function loadSequence(name: string | null): Promise<HDSequence | null> {
  if (name === 'demo') return (await import('../demo-sequence')).default;
  const entries = Object.entries(cineLoaders);
  const rank = (p: string) => (name && baseName(p) === name ? 0 : baseName(p) === 'sequence' ? 1 : baseName(p) === 'index' ? 2 : 3);
  const ordered = [...entries].sort((a, b) => rank(a[0]) - rank(b[0]));
  for (const [path, load] of ordered) {
    try {
      const mod = await load();
      const seq = mod.default;
      if (seq && typeof seq.run === 'function') return seq;
    } catch (err) {
      console.error(`[hd] cine module ${path} failed to load`, err);
      window.__neon.errors.push(`cine ${path}: ${String(err)}`);
    }
  }
  return null;
}

export async function sceneView(ctx: ViewCtx): Promise<void> {
  const { scene, kit, params, envPixel, signal } = ctx;
  const ids: [MonsterId, MonsterId] = [(params.get('p1') ?? 'crystal_wyrm') as MonsterId, (params.get('p2') ?? 'ember_wolf') as MonsterId];

  const { theme, placeholder: arenaPH } = await loadArenaTheme(params.get('theme') ?? 'neon');
  if (signal.aborted) return;
  kit.lighting.applyTheme(theme);
  const arena = theme.build(scene, { envPixel, activePlayer: null });
  kit.lighting.sideLights();
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => arena.destroy());

  // monsters (frames are rendered once, time-sliced; show progress meanwhile)
  const loading = pixelText(scene, HD_W / 2, HD_H / 2, 'YÜKLENİYOR', { size: 'lg', color: PAL.cyan3, originX: 0.5, originY: 0.5 }).setDepth(DEPTH.DEBUG);
  const texs = [];
  for (let i = 0; i < 2; i++) {
    texs.push(await ensureMonsterTextures(scene, ids[i], (d, t) => loading.setText(`YÜKLENİYOR ${ids[i]} ${d}/${t}`)));
    if (signal.aborted) return;
  }
  loading.destroy();

  const p1 = new HDMonsterSprite(scene, texs[0], 0, hdZoneXY(0, 'monster', 1)).idle();
  const p2 = new HDMonsterSprite(scene, texs[1], 1, hdZoneXY(1, 'monster', 1)).idle();
  p1.rim = kit.lighting.ownerRimLight(0, p1);
  p2.rim = kit.lighting.ownerRimLight(1, p2);

  const ph = [arenaPH ? 'ARENA' : '', texs[0].placeholder ? ids[0] : '', texs[1].placeholder ? ids[1] : ''].filter(Boolean);
  const seq = await loadSequence(params.get('seq'));
  if (signal.aborted) return;
  ctx.status(`${seq ? seq.name.toUpperCase() : 'SEKANS YOK'}${ph.length ? '   GEÇİCİ: ' + ph.join(' ') : ''}`);

  if (seq) {
    const sctx: HDSceneContext = { scene, kit, theme, arena, p1, p2, ids, envPixel, signal };
    void (async () => {
      await ctx.startGate();
      if (signal.aborted) return;
      try {
        await seq.run(sctx);
      } catch (err) {
        if (signal.aborted) return;
        console.error('[hd] sequence failed', err);
        window.__neon.errors.push(`sequence: ${String(err)}`);
        return;
      }
      if (signal.aborted) return;
      await wait(scene, seq.loopGapMs ?? 1500);
      if (!signal.aborted) ctx.restart();
    })();
  }
}
