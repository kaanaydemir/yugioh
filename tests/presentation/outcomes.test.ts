// A3 Y5 — presentation never changes outcomes (docs/v3/A3_MIMARI.md §6.1, AGENT rule "rules stay in the
// engine"). Seeded bot-vs-bot games are played before and after the whole presentation layer is loaded
// and exercised in the v3 look — every recipe read, a plan-monster stand-in registered (v3 art + recipe),
// every bridged accessor called for every monster — and the games are identical, action for action
// and event for event. (The engine does not import presentation at all: engine-boundary.test.ts.)

import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  (globalThis as { __NEON_LOOK?: string }).__NEON_LOOK = 'v3';
});
vi.mock('phaser', async () => (await import('./_phaser-stub')).phaserStub());

import { actingPlayer, apply, chooseAction, legalActions, newGame, type GameState } from '../../src/engine';

/** A seeded bot-vs-bot game, serialised (actions + events). */
function game(seed: number): string {
  let { state, events } = newGame({ seed });
  const log: unknown[] = [...events];
  for (let n = 0; (state as GameState).winner === null && n < 3000; n++) {
    expect(legalActions(state).length).toBeGreaterThan(0);
    expect(actingPlayer(state)).toBeDefined();
    const a = chooseAction(state, seed);
    const r = apply(state, a);
    log.push(a, ...r.events);
    state = r.state;
  }
  return JSON.stringify(log);
}

const SEEDS = [3, 11, 42, 97, 2026];

describe('presentation never changes the engine’s outcomes (A3 §6.1)', () => {
  it('seeded games are identical before and after the presentation layer is loaded and exercised', async () => {
    const before = SEEDS.map(game);
    // load and exercise everything the presentation layer touches, in the v3 look
    const reg = await import('../../src/presentation/registry');
    const { MONSTER_IDS } = await import('../../src/data/cards');
    const { monsterArt, registerFixtureArtV3 } = await import('../../src/art/monsters');
    registerFixtureArtV3({ ...monsterArt('stone_sentinel'), id: 'stone_sentinel' });
    reg.registerFixtureRecipe({
      id: 'stone_sentinel',
      tier: 'normal',
      body: { physical: 'stone' },
      attack: { type: 'throw', blow: 'physical', from: 'hand', vfx: 'boulder', ranged: true },
      summon: { style: 'assemble', matter: 'stone' },
      death: { material: 'stone', accent: 'stone' },
      voice: { palette: 'rumble', key: 31, register: 'low', brightness: 0.15, tail: 'dust' },
    });
    const { strikeLight } = await import('../../src/cinematics/battle/_kit');
    const { monsterGlow } = await import('../../src/view/light/profiles');
    const { roarPeakOf } = await import('../../src/cinematics/summon-b/_kit');
    const { flipRamp } = await import('../../src/cinematics/summon-b/flip');
    const { isRanged } = await import('../../src/cinematics/traps/chains_of_light');
    const { cutInRhythm, deathPreset, matterRamp } = await import('../../src/cinematics/_v3/presets');
    const { blowKindOf } = await import('../../src/cinematics/_v3/blow');
    const { materialOf, soundsOf } = await import('../../src/cinematics/_v3/sound');
    let read = 0;
    for (const id of MONSTER_IDS) {
      const r = reg.v3Recipe(id);
      if (r) read++;
      void [strikeLight(id), monsterGlow(id), roarPeakOf(id), flipRamp(id), isRanged(id), cutInRhythm(id), deathPreset(id), matterRamp(id)];
      void [blowKindOf({ art: { id, weight: 'medium' } }), materialOf(id, 'physical'), materialOf(id, 'magic'), soundsOf(id)];
    }
    expect(read).toBe(3); // the two aces + the stand-in: the bridge really read recipes
    const after = SEEDS.map(game);
    for (let i = 0; i < SEEDS.length; i++) expect(after[i] === before[i], `seed ${SEEDS[i]}`).toBe(true);
  }, 30000); // ten full games: ~3 s alone, more under the whole suite's load
});
