// v3 shared kits, part 2 (docs/v3/A0_ENVANTER.md §6.2 items 2, 4, 5): the pure tables of the death
// kit, the summon base's cut-in and the card's flight — every monster has a death preset, every
// tone is a palette tone, the cut-in never exceeds its budget, a card flight is never a teleport.

import { describe, expect, it } from 'vitest';
import { MONSTER_IDS } from '../../src/data/cards';
import { PAL } from '../../src/art/palette';
import { CUTIN_V3_MAX_MS, DEATH_PRESETS, MATTER_RAMP, cutInRhythm, deathPreset, flightMs, matterRamp } from '../../src/cinematics/_v3/presets';

const PALETTE = new Set<number>(Object.values(PAL));
const MATERIALS = ['crystal', 'stone', 'light', 'shadow', 'plant', 'fire', 'water'];

describe('v3 death presets', () => {
  it('cover every monster with a known material and accent', () => {
    for (const id of MONSTER_IDS) {
      const p = DEATH_PRESETS[id];
      expect(p, id).toBeTruthy();
      expect(MATERIALS).toContain(p.material);
      expect(MATERIALS).toContain(p.accent);
      expect(deathPreset(id)).toEqual(p);
    }
  });
  it('keep the slice monsters in character (crystal wyrm, shadow magus)', () => {
    expect(deathPreset('crystal_wyrm').material).toBe('crystal');
    expect(deathPreset('abyss_magus').material).toBe('shadow');
    expect(matterRamp('crystal_wyrm')[4]).toBe(PAL.cyan4);
  });
  it('use palette tones only', () => {
    for (const [m, ramp] of Object.entries(MATTER_RAMP)) for (const c of ramp) expect(PALETTE.has(c), `${m} ${c.toString(16)}`).toBe(true);
  });
});

describe('v3 ace cut-in rhythm', () => {
  it('fits the 1.0 s budget in order (flare < slam < exit, exit + close ≤ max)', () => {
    for (const id of MONSTER_IDS) {
      const r = cutInRhythm(id);
      expect(r.flare).toBeLessThan(r.slam);
      expect(r.slam).toBeLessThan(r.exit);
      expect(r.exit + r.close).toBeLessThanOrEqual(CUTIN_V3_MAX_MS);
      expect(CUTIN_V3_MAX_MS).toBeLessThanOrEqual(1000);
    }
  });
});

describe('v3 card flight', () => {
  it('is a short hop for near piles and never a teleport or a crawl', () => {
    expect(flightMs(0)).toBeGreaterThanOrEqual(200);
    expect(flightMs(1000)).toBeLessThanOrEqual(360);
    expect(flightMs(120)).toBeGreaterThanOrEqual(flightMs(40));
  });
});
