// Hurda Akıncıları — the TIRED sheet (attackThenDefense lock, YENI_KARTLAR C5 "imza an"). Not a registry art (the
// `_` prefix): a hidden variant of scrap_raiders whose frames carry the SAME names as the art's own sheet, drawn
// through the lock — guard = the wheel flat on the floor and the wrench goblin hammering the bare axle, toGuard =
// the End Phase wheel-off, fromGuard = the lock end (the wheel BANGs back on → the rested guard), the recoils and
// the first death frames with the wheel still on the floor. src/cinematics/d/_scrap_raiders-tired.ts shows it on a
// unit while its lock lasts (the unit's sheet is swapped, its anim keys stay the art's own). Its `when` is always
// false: the variant system never gives it to a unit (variants are upgrade-only; the lock ends).

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import { GY, H, RX, W, drawRaiders } from './scrap_raiders-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './scrap_raiders-anims';

export const TIRED = 'tired';

let art: MonsterArt | null = null;

/** The tired sheet's art (same id, size, anims and holds as the registry art; tired frames). */
export function tiredRaidersArt(base: MonsterArt): MonsterArt {
  art ??= {
    ...base,
    id: 'scrap_raiders',
    w: W,
    h: H,
    anchorX: RX,
    anchorY: GY,
    muzzle: MUZZLE,
    anims: ANIMS,
    attackImpactFrame: IMPACT,
    extraAnims: EXTRA_ANIMS,
    draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) {
      drawRaiders(p, framePose(anim, frame, 'tired'), o?.lightFrom ?? 'left');
    },
    drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) {
      drawRaiders(p, framePose(anim, frame, 'tired'), o?.lightFrom ?? 'left');
    },
    points(anim: AnyMonsterAnim, frame: number): MonsterPoints {
      return framePoints(anim, frame, 'tired');
    },
  };
  return art;
}

/** The variant record (src/boot/18-raiders-tired.ts registers it; its `when` is never true). */
export function tiredRaidersVariant(base: MonsterArt): { name: string; art: () => MonsterArt; when: () => boolean } {
  return { name: TIRED, art: () => tiredRaidersArt(base), when: () => false };
}
