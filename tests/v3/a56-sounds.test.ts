// A56.0 sound skeletons (A5 §4.6, A6 §4.3, contract S-10): every planned name exists, each module's
// recipes are registered in the game's table (the same objects), nothing collides with an existing
// name, and the sustained list of A5-A is right.

import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('../presentation/_phaser-stub')).phaserStub());

import { RECIPES, type Recipe } from '../../src/audio/sounds';
import { V3_SPELL_RECIPES, V3_SPELL_SUSTAINED } from '../../src/audio/v3/spells';
import { UI_CARD_RECIPES } from '../../src/audio/v3/ui-cards';
import { UI_FLOW_RECIPES } from '../../src/audio/v3/ui-flow';

const A5_NAMES = 'springRise springDrop springSettle recallOpen recallGlide bladeForge bladeFly bladeBond bladeBreak volcanoSlam volcanoErupt lavaCreep heatFlare steamHiss volcanoCool mirrorRaise mirrorCatch mirrorBeam mirrorBreak chasmCrack chasmOpen chasmFall chasmShut hatRise hatThump hatSwish hatPop hatReveal'.split(' ');
const UI_CARDS = 'ui3Hover ui3Select ui3Draw ui3Flip ui3Land ui3Play ui3Place ui3Set ui3Latch ui3Turn ui3Tribute ui3Slide ui3Burn ui3PileAccept ui3Riffle ui3Shuffle ui3Mark ui3Unmark ui3PanelOpen ui3PanelClose ui3Card'.split(' ');
const UI_FLOW = 'ui3DuelStart ui3PanelIn ui3TurnStart ui3Phase ui3Battle ui3LpLoss ui3LpGain ui3LpTick ui3AimOpen ui3Aim ui3Lock ui3Error ui3Block ui3Decision ui3Confirm ui3Back ui3PassDevice ui3DeckOut ui3Victory ui3Defeat'.split(' ');

describe('A5 / A6 sound skeletons (S-10)', () => {
  it('the planned names, exactly', () => {
    expect(Object.keys(V3_SPELL_RECIPES).sort()).toEqual([...A5_NAMES].sort());
    expect(Object.keys(UI_CARD_RECIPES).sort()).toEqual([...UI_CARDS].sort());
    expect(Object.keys(UI_FLOW_RECIPES).sort()).toEqual([...UI_FLOW].sort());
    expect(A5_NAMES.length + UI_CARDS.length + UI_FLOW.length).toBe(69);
    expect([...V3_SPELL_SUSTAINED]).toEqual(['lavaCreep']);
  });

  it('registered once in the game table (same recipe objects), no collisions', () => {
    const table = RECIPES as Record<string, Recipe>;
    for (const mod of [V3_SPELL_RECIPES, UI_CARD_RECIPES, UI_FLOW_RECIPES] as Record<string, Recipe>[])
      for (const [k, r] of Object.entries(mod)) expect(table[k], k).toBe(r);
    const all = [...A5_NAMES, ...UI_CARDS, ...UI_FLOW];
    expect(new Set(all).size).toBe(all.length);
  });
});
