// A3 Y5a / Y5 — the per-card table accessors in the v1 look (docs/v3/A3_MIMARI.md §6.4, §12): for all
// 12 monsters every accessor returns exactly today's table value — the bridge never reads a recipe in
// the v1 look (no LOOK_V3), so the old game is untouched. (The v3 look: accessors-v3.test.ts.)

import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('./_phaser-stub')).phaserStub());

import { MONSTER_IDS } from '../../src/data/cards';
import { PAL, RAMPS } from '../../src/art/palette';
import { LOOK_V3 } from '../../src/view/layout';
import { MONSTER_GLOW, monsterGlow } from '../../src/view/light/profiles';
import { STRIKE_LIGHT, strikeLight } from '../../src/cinematics/battle/_kit';
import { ROAR_PEAK, roarPeakOf } from '../../src/cinematics/summon-b/_kit';
import { flipRamp } from '../../src/cinematics/summon-b/flip';
import { isRanged } from '../../src/cinematics/traps/chains_of_light';
import { DEATH_PRESETS, MATTER_RAMP, cutInRhythm, deathMaterial, deathPreset, matterRamp } from '../../src/cinematics/_v3/presets';
import { STRIKE_KIND, blowKindOf } from '../../src/cinematics/_v3/blow';
import { hitSoundFor, materialOf, soundsOf } from '../../src/cinematics/_v3/sound';
import { presentationOf, v3Recipe } from '../../src/presentation/registry';
import type { MonsterUnit } from '../../src/duel/MonsterUnit';

/** Today's module-private tables, copied (FLIP_RAMP, RANGED, the cut-in RHYTHM with its defaults and budget). */
const FLIP_RAMP_TODAY: Record<string, readonly number[]> = { volt_lizard: RAMPS.cyan };
const RANGED_TODAY = new Set(['crystal_wyrm', 'abyss_magus', 'stone_sentinel', 'tide_golem', 'volt_lizard', 'lumen_sprite', 'coral_serpent']);
const RHYTHM_TODAY: Record<string, { flare: number; slam: number; exit: number; close: number }> = {
  crystal_wyrm: { flare: 320, slam: 410, exit: 740, close: 120 },
  abyss_magus: { flare: 250, slam: 320, exit: 660, close: 120 },
  magma_titan: { flare: 300, slam: 430, exit: 740, close: 120 },
  tide_golem: { flare: 290, slam: 410, exit: 720, close: 120 },
};
const RHYTHM_DEFAULT = { flare: 290, slam: 370, exit: 700, close: 120 };

describe('table accessors in the v1 look (A3 §6.4): exactly today’s values for all 12 monsters', () => {
  it('runs in the v1 look and no recipe is bridged', () => {
    expect(LOOK_V3).toBe(false);
    expect(MONSTER_IDS).toHaveLength(12);
    for (const id of MONSTER_IDS) expect(v3Recipe(id)).toBeUndefined();
    // the aces' recipes exist (the bridge simply never reads them here)
    expect(presentationOf('crystal_wyrm')).toBeDefined();
    expect(presentationOf('abyss_magus')).toBeDefined();
  });

  for (const id of MONSTER_IDS) {
    it(`${id}`, () => {
      expect(strikeLight(id)).toBe(STRIKE_LIGHT[id]);
      expect(monsterGlow(id)).toBe(MONSTER_GLOW[id]);
      expect(roarPeakOf(id)).toBe(ROAR_PEAK[id]);
      expect(flipRamp(id)).toBe(FLIP_RAMP_TODAY[id]);
      expect(isRanged(id)).toBe(RANGED_TODAY.has(id));
      expect(deathPreset(id)).toEqual(DEATH_PRESETS[id]);
      expect(deathMaterial(id)).toBe(DEATH_PRESETS[id].material);
      expect(matterRamp(id)).toBe(MATTER_RAMP[DEATH_PRESETS[id].material]);
      expect(cutInRhythm(id)).toEqual(RHYTHM_TODAY[id] ?? RHYTHM_DEFAULT);
      expect(blowKindOf({ art: { id, weight: 'medium' } })).toBe(STRIKE_KIND[id]);
      // the v3 sound kit is silent in the old look; the struck-body material keeps its slice answer
      expect(soundsOf(id)).toBeNull();
      expect(hitSoundFor({ cardId: id } as MonsterUnit, { kind: 'physical', heavy: true })).toBeNull();
      const phys = id === 'crystal_wyrm' ? 'crystal' : id === 'abyss_magus' ? 'metal' : null;
      const magic = id === 'crystal_wyrm' ? 'crystal' : id === 'abyss_magus' ? 'cloth' : null;
      expect(materialOf(id, 'physical')).toBe(phys);
      expect(materialOf(id, 'magic')).toBe(magic);
    });
  }

  it('the strike light of every monster is a palette colour', () => {
    const pal = new Set<number>(Object.values(PAL));
    for (const id of MONSTER_IDS) expect(pal.has(strikeLight(id)!)).toBe(true);
  });
});
