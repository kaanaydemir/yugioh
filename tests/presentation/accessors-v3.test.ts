// A3 Y5 — the table accessors in the v3 look (docs/v3/A3_MIMARI.md §6.3, §6.4, §12). The bridge rule:
// a recipe is read only in the v3 look AND only for a monster with v3 art.
//   1. The two aces (v3 art, all-`custom` recipes that document today's tables): every accessor reads
//      the recipe and returns exactly today's table value — the slice cannot change.
//   2. Every other monster without a live recipe (no v3 art, or no recipe file yet): today's tables. A
//      monster whose live recipe draws parts on the default path (the pilot, from Y8 on) is expected to
//      differ — that path is covered by 3.
//   3. A plan monster stand-in (a fixture art registered as stone_sentinel's v3 art + a recipe): every
//      accessor answers from the recipe; a recipe for a monster WITHOUT v3 art is ignored.

import { afterAll, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // the v3 look (decided once at module init by src/view/layout.ts): set before any import runs
  (globalThis as { __NEON_LOOK?: string }).__NEON_LOOK = 'v3';
});
vi.mock('phaser', async () => (await import('./_phaser-stub')).phaserStub());

import { MONSTER_IDS, type MonsterId } from '../../src/data/cards';
import { PAL, RAMPS } from '../../src/art/palette';
import { hasMonsterArtV3, monsterArt, registerFixtureArtV3 } from '../../src/art/monsters';
import { LOOK_V3 } from '../../src/view/layout';
import { MONSTER_GLOW, monsterGlow } from '../../src/view/light/profiles';
import { STRIKE_LIGHT, strikeLight } from '../../src/cinematics/battle/_kit';
import { ROAR_PEAK, roarPeakOf } from '../../src/cinematics/summon-b/_kit';
import { flipRamp } from '../../src/cinematics/summon-b/flip';
import { isRanged } from '../../src/cinematics/traps/chains_of_light';
import { DEATH_PRESETS, MATTER_RAMP, cutInRhythm, deathPreset, matterRamp } from '../../src/cinematics/_v3/presets';
import { STRIKE_KIND, blowKindOf } from '../../src/cinematics/_v3/blow';
import { CHARACTER_SOUNDS, hitSoundFor, materialOf, soundsOf } from '../../src/cinematics/_v3/sound';
import { registerFixtureRecipe, v3Recipe } from '../../src/presentation/registry';
import { voiceSounds } from '../../src/audio/v3/voices';
import type { PresentationRecipe } from '../../src/presentation/types';
import type { MonsterUnit } from '../../src/duel/MonsterUnit';

const FLIP_RAMP_TODAY: Record<string, readonly number[]> = { volt_lizard: RAMPS.cyan };
const RANGED_TODAY = new Set(['crystal_wyrm', 'abyss_magus', 'stone_sentinel', 'tide_golem', 'volt_lizard', 'lumen_sprite', 'coral_serpent']);
const RHYTHM_TODAY: Record<string, { flare: number; slam: number; exit: number; close: number }> = {
  crystal_wyrm: { flare: 320, slam: 410, exit: 740, close: 120 },
  abyss_magus: { flare: 250, slam: 320, exit: 660, close: 120 },
  magma_titan: { flare: 300, slam: 430, exit: 740, close: 120 },
  tide_golem: { flare: 290, slam: 410, exit: 720, close: 120 },
};
const RHYTHM_DEFAULT = { flare: 290, slam: 370, exit: 700, close: 120 };
/** _v3/sound.ts materialOf before A3 (the slice's answer). */
const MATERIAL_TODAY = (id: string, kind: 'physical' | 'magic') => (id === 'crystal_wyrm' ? 'crystal' : id === 'abyss_magus' ? (kind === 'magic' ? 'cloth' : 'metal') : null);
/** _v3/sound.ts hitSoundFor before A3. */
function hitSoundToday(id: string, kind: 'physical' | 'magic', heavy: boolean): string | null {
  const m = MATERIAL_TODAY(id, kind);
  if (!m) return null;
  const w = kind === 'magic' ? 'Magic' : heavy ? 'Heavy' : 'Light';
  return `${m === 'crystal' ? 'hitCrystal' : m === 'metal' ? 'hitMetal' : 'hitCloth'}${w}`;
}

/** Every accessor value of a monster, as the game reads it. */
function snapshot(id: MonsterId) {
  const unit = { cardId: id } as MonsterUnit;
  return {
    strikeLight: strikeLight(id),
    glow: monsterGlow(id),
    roarPeak: roarPeakOf(id),
    flipRamp: flipRamp(id),
    ranged: isRanged(id),
    death: deathPreset(id),
    matter: matterRamp(id),
    rhythm: cutInRhythm(id),
    blow: blowKindOf({ art: { id, weight: 'medium' } }),
    sounds: soundsOf(id),
    material: [materialOf(id, 'physical'), materialOf(id, 'magic')],
    hits: (['physical', 'magic'] as const).flatMap((kind) => [false, true].map((heavy) => hitSoundFor(unit, { kind, heavy }))),
  };
}

/** Today's tables for a monster (what the snapshot must equal when no recipe applies, and for the aces). */
function today(id: MonsterId) {
  return {
    strikeLight: STRIKE_LIGHT[id],
    glow: MONSTER_GLOW[id],
    roarPeak: ROAR_PEAK[id],
    flipRamp: FLIP_RAMP_TODAY[id],
    ranged: RANGED_TODAY.has(id),
    death: DEATH_PRESETS[id],
    matter: MATTER_RAMP[DEATH_PRESETS[id].material],
    rhythm: RHYTHM_TODAY[id] ?? RHYTHM_DEFAULT,
    blow: STRIKE_KIND[id],
    sounds: CHARACTER_SOUNDS[id] ?? null,
    material: [MATERIAL_TODAY(id, 'physical'), MATERIAL_TODAY(id, 'magic')],
    hits: (['physical', 'magic'] as const).flatMap((kind) => [false, true].map((heavy) => hitSoundToday(id, kind, heavy))),
  };
}

const ACES: MonsterId[] = ['crystal_wyrm', 'abyss_magus'];

/** A live recipe (v3 look + v3 art) that draws a part on the default path (not all-custom). */
function defaultPath(id: MonsterId): boolean {
  const r = v3Recipe(id);
  return !!r && !(r.custom?.strike && r.custom.summon && r.custom.death && r.custom.flip);
}

describe('table accessors in the v3 look (A3 §6.4): the aces through the bridge = today', () => {
  it('runs in the v3 look; the aces have v3 art and a live, all-custom recipe', () => {
    expect(LOOK_V3).toBe(true);
    for (const id of ACES) {
      expect(hasMonsterArtV3(id), id).toBe(true);
      expect(!!v3Recipe(id), id).toBe(true);
      expect(defaultPath(id), id).toBe(false);
    }
  });

  for (const id of MONSTER_IDS) {
    it(`${id}: every accessor equals today's table${ACES.includes(id) ? ' (read from its recipe)' : ''}`, () => {
      if (defaultPath(id)) return; // a plan monster with its own recipe (Y8 on): see the stand-in below
      expect(snapshot(id)).toEqual(today(id));
    });
  }

  it("the aces' hand-made sound sets are today's very objects", () => {
    for (const id of ACES) expect(soundsOf(id)).toBe(CHARACTER_SOUNDS[id]);
  });
});

describe('the bridge on a plan monster stand-in (v3 art + recipe) and on a recipe without v3 art', () => {
  const PILOT: PresentationRecipe = {
    id: 'stone_sentinel',
    tier: 'normal',
    body: { physical: 'stone', magic: 'runeGold' },
    attack: { type: 'throw', blow: 'magic', from: 'hand', vfx: 'boulder', tone: PAL.gold3, ranged: false },
    summon: { style: 'assemble', matter: 'crystal', roarPeak: 5 },
    death: { material: 'light', accent: 'stone' },
    flip: { accent: 'dust', ramp: 'teal' },
    voice: { palette: 'rumble', key: 31, register: 'low', brightness: 0.15, tail: 'dust' },
    light: { glow: { halo: 0.33 }, strike: PAL.gold2 },
    cutIn: { rhythm: { flare: 280 } },
  };
  const undo: (() => void)[] = [];
  afterAll(() => undo.forEach((f) => f()));

  it('a recipe alone (no v3 art) is never read', () => {
    undo.push(registerFixtureRecipe({ ...PILOT, id: 'tide_golem' }));
    expect(hasMonsterArtV3('tide_golem')).toBe(false);
    expect(v3Recipe('tide_golem')).toBeUndefined();
    expect(snapshot('tide_golem')).toEqual(today('tide_golem'));
  });

  it('with v3 art, every accessor answers from the recipe', () => {
    registerFixtureArtV3({ ...monsterArt('stone_sentinel'), id: 'stone_sentinel' });
    undo.push(registerFixtureRecipe(PILOT));
    const s = snapshot('stone_sentinel');
    expect(s.strikeLight).toBe(PAL.gold2); // light.strike before attack.tone
    expect(s.glow).toEqual({ ...MONSTER_GLOW.stone_sentinel, halo: 0.33 });
    expect(s.roarPeak).toBe(5);
    expect(s.flipRamp).toBe(RAMPS.teal);
    expect(s.ranged).toBe(false);
    expect(s.death).toEqual({ material: 'light', accent: 'stone' });
    expect(s.matter).toBe(MATTER_RAMP.light);
    expect(s.rhythm).toEqual({ ...RHYTHM_DEFAULT, flare: 280 });
    expect(s.blow).toBe('magic');
    expect(s.material).toEqual(['stone', 'runeGold']);
    // the struck body plays its material's hit (runeGold sounds like the stone it is carved in)
    expect(s.hits).toEqual(['hitStoneLight', 'hitStoneHeavy', 'hitStoneMagic', 'hitStoneMagic']);
    // the voice sets are generated at load from the recipe FILES (src/audio/v3/voices.ts): the pilot's
    // file (Y8) has its rumble set, and a fixture registered at run time neither adds nor changes one
    expect(s.sounds).toEqual(voiceSounds('stone_sentinel'));
    expect(s.sounds?.charge).toBe('voice:stone_sentinel:charge');
  });

  it('a recipe registered at run time for a card without a recipe file has no generated voice set: the generic sounds', () => {
    registerFixtureArtV3({ ...monsterArt('storm_hawk'), id: 'storm_hawk' });
    undo.push(registerFixtureRecipe({ ...PILOT, id: 'storm_hawk' }));
    expect(v3Recipe('storm_hawk')?.id).toBe('storm_hawk');
    expect(soundsOf('storm_hawk')).toBeNull();
  });
});
