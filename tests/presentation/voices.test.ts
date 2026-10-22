// A3 Y5 — character voices from presentation recipes (src/audio/v3/voices.ts; REHBER §7 SE-2, SE-3, SE-7).
// The role set is the one every character fills (it matches _v3/sound.ts CharacterSounds' required roles);
// the 'rumble' palette (the pilot's) fills every role; a palette without an interpreter yields nothing;
// names are generated only for recipe FILES with an interpreted preset. Timbre, levels and the SE-4
// separation from the slice palettes are measured offline (shots/v3/a3/Y5/sound-analysis.txt).

import { describe, expect, it } from 'vitest';
import { RECIPE_IDS, presentationOf } from '../../src/presentation/registry';
import { RUMBLE_REFERENCE, SUSTAINED_ROLES, V3_VOICE_RECIPES, VOICE_PALETTES, VOICE_ROLES, voiceRecipes, voiceSfxName, voiceSounds } from '../../src/audio/v3/voices';
import type { CharacterSounds } from '../../src/cinematics/_v3/sound';

/** CharacterSounds' required roles (swing, deathStart, afterDissolve are optional extras). */
const REQUIRED: readonly (keyof CharacterSounds)[] = ['roar', 'arrive', 'land', 'charge', 'release', 'impact', 'dissolve', 'burst', 'reviveGather', 'reviveLand'];

describe('character voices from recipes (SE-3)', () => {
  it('the role set is exactly the required roles of a character sound set', () => {
    expect([...VOICE_ROLES].sort()).toEqual([...REQUIRED].sort());
    expect(SUSTAINED_ROLES.every((r) => VOICE_ROLES.includes(r))).toBe(true);
  });

  it("A3 interprets the pilot's 'rumble' palette; the others arrive with their first user", () => {
    expect(VOICE_PALETTES).toEqual(['rumble']);
    expect(voiceRecipes({ palette: 'chime', key: 80, register: 'high', brightness: 1 })).toBeNull();
  });

  it('rumble fills every role with a playable recipe (SE-7 duck range, sane caps)', () => {
    const set = voiceRecipes(RUMBLE_REFERENCE)!;
    expect(set).not.toBeNull();
    for (const role of VOICE_ROLES) {
      const r = set[role];
      expect(typeof r.play, role).toBe('function');
      expect(r.duck ?? 0, role).toBeGreaterThanOrEqual(0.2);
      expect(r.duck ?? 0, role).toBeLessThanOrEqual(0.8);
      expect(r.cap ?? 4, role).toBeGreaterThanOrEqual(1);
    }
    // the big beats duck the music hard, the small ones lightly (SE-7)
    expect(set.roar.duck).toBeGreaterThanOrEqual(0.55);
    expect(set.burst.duck).toBeGreaterThanOrEqual(0.55);
    expect(set.charge.duck).toBeLessThanOrEqual(0.3);
  });

  it('names are generated for the recipe files with an interpreted preset, and only for them', () => {
    const want = RECIPE_IDS.filter((id) => {
      const v = presentationOf(id)!.voice;
      return !('custom' in v) && !!voiceRecipes(v);
    }).flatMap((id) => VOICE_ROLES.map((role) => voiceSfxName(id, role)));
    expect(Object.keys(V3_VOICE_RECIPES).sort()).toEqual([...want].sort());
    for (const id of RECIPE_IDS) {
      const s = voiceSounds(id);
      if (want.some((n) => n.startsWith(`voice:${id}:`))) expect(s && Object.keys(s).sort()).toEqual([...VOICE_ROLES].sort());
      else expect(s).toBeNull();
    }
    expect(voiceSfxName('stone_sentinel', 'roar')).toBe('voice:stone_sentinel:roar');
    expect(voiceSounds(null)).toBeNull();
  });
});
