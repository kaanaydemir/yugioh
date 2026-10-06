// Fallback art so the game runs before a monster's real sprite exists.
import type { MonsterId } from '../../data/cards';
import { cardDef } from '../../data/cards';
import { ATTRIBUTE_RAMP, PAL } from '../palette';
import type { MonsterArt, MonsterAnim } from '../types';
import type { PixelCanvas } from '../pixel';

export function placeholderMonster(id: MonsterId): MonsterArt {
  const def = cardDef(id);
  const ramp = def.kind === 'monster' ? ATTRIBUTE_RAMP[def.attribute] : ATTRIBUTE_RAMP.LIGHT;
  const w = 48;
  const h = 48;
  return {
    id,
    w,
    h,
    anchorX: 24,
    anchorY: 44,
    hover: 0,
    muzzle: { x: 36, y: 20 },
    core: { x: 24, y: 28 },
    anims: {
      idle: { frames: 4, fps: 6, loop: true },
      roar: { frames: 4, fps: 8, loop: false },
      attack: { frames: 4, fps: 10, loop: false },
      hit: { frames: 2, fps: 8, loop: false },
      guard: { frames: 2, fps: 3, loop: true },
    },
    attackImpactFrame: 2,
    draw(p: PixelCanvas, anim: MonsterAnim, frame: number) {
      const bob = anim === 'idle' ? (frame % 2) : 0;
      const lean = anim === 'attack' ? [0, -3, 5, 2][frame] ?? 0 : anim === 'hit' ? -3 : 0;
      const squash = anim === 'guard' ? 4 : 0;
      p.ellipse(24 + lean, 30 + bob + squash / 2, 14, 14 - squash / 2, ramp[2]);
      p.ellipse(22 + lean, 26 + bob, 8, 7, ramp[3]);
      p.rect(28 + lean, 24 + bob, 3, 3, PAL.white);
      p.outline(PAL.ink);
    },
  };
}
