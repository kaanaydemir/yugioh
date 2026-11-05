// Sazlık Balıkçılı presentation (lane C, C8): the recipe keeps death and flip on the recipe layer (custom strike +
// summon only), its voice names only the heron's own recipes, the role set has no deathStart (the card's death
// watcher scores the wing close), the light profile is the dim one (no player colour), and the QA scenarios are
// all 'rhr'-prefixed 5-zone stages.

import { describe, expect, it } from 'vitest';
import recipe from '../../src/presentation/cards/reed_heron';
import { HERON_VOICE, V3_HERON_RECIPES } from '../../src/audio/v3/reed_heron';
import { PAL } from '../../src/art/palette';
import scenarios from '../../src/duel/scenarios/reed_heron';

describe('reed_heron presentation', () => {
  it('draws only its strike and summon itself', () => {
    expect(recipe.id).toBe('reed_heron');
    expect(recipe.tier).toBe('normal');
    expect(recipe.custom).toEqual({ strike: true, summon: true });
    expect(recipe.voice).toEqual({ custom: 'reed_heron' });
    expect(recipe.attack.from).toBe('muzzle');
  });

  it('speaks with its own sounds only', () => {
    const names = Object.keys(V3_HERON_RECIPES);
    for (const n of names) expect(n.startsWith('heron'), n).toBe(true);
    for (const v of Object.values(HERON_VOICE)) expect(names, String(v)).toContain(v);
    expect('deathStart' in HERON_VOICE).toBe(false);
  });

  it('glows dim: the gold eye and the beak glint, never a player colour', () => {
    const em = recipe.light!.glow!.emissive!.map(([c]) => c);
    for (const c of [PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.crim3, PAL.crim4]) expect(em).not.toContain(c);
    expect(em).toContain(PAL.gold4);
    expect(recipe.light!.glow!.halo!).toBeLessThanOrEqual(0.3);
  });

  it('has the rhr QA scenarios on 5 zones', () => {
    const keys = Object.keys(scenarios);
    for (const k of ['rhrSummon', 'rhrSummonP2', 'rhrAttack', 'rhrAttackP2', 'rhrDirect', 'rhrHit', 'rhrKill', 'rhrKillP2', 'rhrGuard']) expect(keys).toContain(k);
    for (const k of keys) {
      expect(k.startsWith('rhr'), k).toBe(true);
      expect(scenarios[k].stage?.zones, k).toBe(5);
    }
  });
});
