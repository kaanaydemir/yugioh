// A3 Y5 — every presentation recipe is valid and buildable (docs/v3/A3_MIMARI.md §6.1, §6.2, §12): its id
// is a monster card; its materials, matters, ramp, voice, set pieces and hooks resolve; the origin point
// of its strike exists on the release frame of its v3 art; every part it does not draw itself has a
// kind / style in the recipe layer; its colours are palette colours; the aces draw every part
// themselves (the slice cannot change). Checked on the recipe files and on the pilot's draft (§6.1).

import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('./_phaser-stub')).phaserStub());

import { CARDS, isMonster, type MonsterId } from '../../src/data/cards';
import { PAL, RAMPS } from '../../src/art/palette';
import { hasMaterial } from '../../src/art/materials';
import { monsterArtV3 } from '../../src/art/monsters';
import { artMarkFrame, impactFrame } from '../../src/art/animtime';
import { MATTER_RAMP } from '../../src/cinematics/_v3/presets';
import { CHARACTER_SOUNDS } from '../../src/cinematics/_v3/sound';
import { STRIKE_KINDS } from '../../src/cinematics/recipe/strike';
import { SUMMON_STYLES } from '../../src/cinematics/recipe/summon';
import { voiceRecipes } from '../../src/audio/v3/voices';
import { RECIPE_IDS, isMonsterId, presentationOf } from '../../src/presentation/registry';
import type { PresentationRecipe, RecipeHooks } from '../../src/presentation/types';

const SET_PIECES = Object.keys(import.meta.glob('/src/cinematics/recipe/setpieces/*.ts')).map((p) => p.replace(/^.*\//, '').replace(/\.ts$/, ''));
const PALETTE = new Set<number>(Object.values(PAL));
const HOOK_KEYS: readonly (keyof RecipeHooks)[] = ['onCharge', 'onRelease', 'onContact', 'onRecover', 'onSummonPeak', 'onDeath'];

/** The pilot's draft recipe (A3_MIMARI §6.1), as a buildable default-path recipe. */
const PILOT_DRAFT: PresentationRecipe = {
  id: 'stone_sentinel',
  tier: 'normal',
  body: { physical: 'stone' },
  attack: { type: 'throw', blow: 'physical', from: 'hand', vfx: 'boulder', travel: { arc: 18 }, blocked: 'shatter', ranged: true },
  summon: { style: 'assemble', matter: 'stone' },
  death: { material: 'stone', accent: 'stone' },
  flip: { accent: 'dust' },
  voice: { palette: 'rumble', key: 31, register: 'low', brightness: 0.15, tail: 'dust' },
};

/** Every problem of a recipe (empty: valid). */
async function problems(r: PresentationRecipe): Promise<string[]> {
  const out: string[] = [];
  const def = CARDS[r.id as MonsterId];
  if (!isMonsterId(r.id) || !def || !isMonster(def)) return [`${r.id}: not a monster card`];
  if (r.tier === 'ace' && !def.ace) out.push('tier ace on a card without CardDef.ace');
  if (r.cutIn && !def.ace) out.push('cutIn on a card without CardDef.ace (no cut-in portrait)');
  for (const m of [r.body.physical, r.body.magic]) if (m !== undefined && !hasMaterial(m)) out.push(`unknown material ${m}`);
  for (const m of [r.death.material, r.death.accent, r.summon.matter]) if (m !== undefined && !(m in MATTER_RAMP)) out.push(`unknown matter ${m}`);
  if (r.flip?.ramp && !(r.flip.ramp in RAMPS)) out.push(`unknown ramp ${r.flip.ramp}`);
  if ('custom' in r.voice) {
    if (!CHARACTER_SOUNDS[r.voice.custom as MonsterId]) out.push(`unknown hand-made voice ${r.voice.custom}`);
  } else if (!voiceRecipes(r.voice)) out.push(`voice palette ${r.voice.palette} has no interpreter yet`);
  for (const c of [r.attack.tone, r.light?.strike, ...(r.light?.glow?.emissive ?? []).map((e) => e[0]), ...(r.light?.glow?.near ?? []).map((e) => e[0]), r.light?.glow?.spill])
    if (c !== undefined && !PALETTE.has(c)) out.push(`colour ${c.toString(16)} is not a palette colour`);
  const c = r.custom ?? {};
  if (!c.strike && !STRIKE_KINDS.includes(r.attack.type)) out.push(`no '${r.attack.type}' strike kind (mark custom.strike or build the kind)`);
  if (!c.summon && !SUMMON_STYLES.includes(r.summon.style)) out.push(`no '${r.summon.style}' summon style (mark custom.summon or build the style)`);
  for (const name of [r.summon.setPiece, r.death.onBurst]) if (name && !SET_PIECES.includes(name)) out.push(`no set piece src/cinematics/recipe/setpieces/${name}.ts`);
  // the strike's origin point exists on the release frame of the v3 art (REHBER HA-25)
  const art = monsterArtV3(r.id);
  if (art?.points) {
    const rel = artMarkFrame(art, 'attack', 'release', impactFrame(art));
    if (!art.points('attack', rel)[r.attack.from]) out.push(`attack.from '${r.attack.from}' is not a point of attack frame ${rel}`);
  }
  if (r.hooks) {
    try {
      const h = (await r.hooks()).default as Record<string, unknown>;
      for (const [k, v] of Object.entries(h)) if (!HOOK_KEYS.includes(k as keyof RecipeHooks) || typeof v !== 'function') out.push(`hook ${k} is not a recipe hook`);
    } catch (e) {
      out.push(`hooks do not load: ${(e as Error).message}`);
    }
  }
  return out;
}

describe('presentation recipes are valid and buildable (A3 §6.1, §6.2)', () => {
  it('the recipe files: the two aces (the pilot brings its own in Y8)', () => {
    expect(RECIPE_IDS).toEqual(expect.arrayContaining(['abyss_magus', 'crystal_wyrm']));
  });

  for (const id of RECIPE_IDS) {
    it(`${id}`, async () => {
      expect(await problems(presentationOf(id)!)).toEqual([]);
    });
  }

  it("the aces draw every part themselves (the recipe layer registers nothing: the slice is the aces' own)", () => {
    for (const id of ['crystal_wyrm', 'abyss_magus']) {
      const r = presentationOf(id)!;
      expect(r.tier).toBe('ace');
      expect(r.custom).toEqual({ strike: true, summon: true, death: true, flip: true, effect: true, revive: true, position: true });
      expect('custom' in r.voice && r.voice.custom).toBe(id);
    }
  });

  it("the pilot's draft (A3_MIMARI §6.1) builds on the default path: throw, assemble, rumble voice", async () => {
    expect(await problems(PILOT_DRAFT)).toEqual([]);
    expect(PILOT_DRAFT.custom).toBeUndefined();
  });

  it('a broken recipe is caught (control)', async () => {
    const bad: PresentationRecipe = {
      ...PILOT_DRAFT,
      body: { physical: 'granite' },
      attack: { ...PILOT_DRAFT.attack, type: 'beam', tone: 0x123456 },
      summon: { style: 'vortex', setPiece: 'nope' },
      voice: { palette: 'chime', key: 80, register: 'high', brightness: 1 },
      cutIn: { rhythm: { flare: 200 } },
    };
    const p = await problems(bad);
    expect(p).toEqual(
      expect.arrayContaining([
        'cutIn on a card without CardDef.ace (no cut-in portrait)',
        'unknown material granite',
        'voice palette chime has no interpreter yet',
        'colour 123456 is not a palette colour',
        "no 'beam' strike kind (mark custom.strike or build the kind)",
        "no 'vortex' summon style (mark custom.summon or build the style)",
        'no set piece src/cinematics/recipe/setpieces/nope.ts',
      ]),
    );
  });
});
