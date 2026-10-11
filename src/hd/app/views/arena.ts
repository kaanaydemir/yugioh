// ?view=arena — the arena theme alone, lit by ambient + the two side lights, with a slow probe light sweeping the
// board so the floor's response to dynamic light is visible (&probe=0 to hide it). ?theme=<id> picks a theme.

import Phaser from 'phaser';
import { HD_BOARD_OX, HD_BOARD_OY } from '../../contracts';
import { loadArenaTheme } from '../assets';
import type { ViewCtx } from '../TrialScene';

export async function arenaView(ctx: ViewCtx): Promise<void> {
  const { scene, kit, params, envPixel, signal } = ctx;
  const { theme, placeholder } = await loadArenaTheme(params.get('theme') ?? 'neon');
  if (signal.aborted) return;
  kit.lighting.applyTheme(theme);
  const arena = theme.build(scene, { envPixel, activePlayer: null });
  kit.lighting.sideLights();
  if (params.get('probe') !== '0') {
    const probe = kit.lighting.addPointLight(HD_BOARD_OX, HD_BOARD_OY + 100, 0xfff2d0, 230, 1.1, 60);
    const dot = kit.fx.glowSprite(0, 0, 0xfff2d0, 40, 0.8, 'front');
    scene.events.on(Phaser.Scenes.Events.UPDATE, (time: number) => {
      const t = time / 1000;
      const x = HD_BOARD_OX + Math.cos(t * 0.7) * 250;
      const y = HD_BOARD_OY + 110 + Math.sin(t * 1.4) * 70;
      probe.setPosition(x, y);
      dot.setPosition(x, y);
    });
  }
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => arena.destroy());
  ctx.status(`TEMA ${theme.name}${placeholder ? ' (GEÇİCİ)' : ''}`);
}
