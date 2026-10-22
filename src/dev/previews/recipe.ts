// ?dev=recipe&id=<monster>&look=v3[&fixture=1][&s=<scenario>] — the recipe layer's default cinematic
// (docs/v3/A3_MIMARI.md §2, §6.2) on the real DuelScene: the events src/cinematics/recipe/install.ts
// builds from a monster's presentation recipe — the 'throw' strike, the 'assemble' summon, the death,
// the flip — and the struck-surface particles of a plan-built body (_v3/react.ts).
//
//   &fixture=1   a fixture stands in for <monster> (default stone_sentinel) for this page: the rigkit
//                fixture creature (tests/art/fixtures/rigkit-creature-art.ts, a full compiled MonsterArt,
//                with a `bodyPlan` tag) as its v3 art, and FIXTURE_RECIPE (stone body, 'throw' from its
//                jaws — the fixture has no hand — 'assemble' in stone, stone death, dust flip, the rumble
//                reference voice) as its recipe. Registered when this module loads (before the boot step
//                builds the sheets, so the fixture's P1 / P2 sheets are built like any v3 art's).
//                Without it the monster's own v3 art and recipe file are used (the pilot, from Y8 on).
//   &striker=<monster>  a second fixture stand-in (default none) whose recipe throws a CRYSTAL rock: on
//                its hit on the stone fixture (recipeStoneHitThrow) the cyan burst is the projectile's and
//                the grey chips + the stone-toned contact flash are the struck stone body's (_v3/react.ts).
//   &plain=1     the fixture WITHOUT its `bodyPlan` tag: the struck-surface particles stay off (today's
//                call) — the A/B of the stone-hit films.
//   &s=<name>    stage that scenario (src/duel/scenarios.ts, or one of PREVIEW_SCENARIOS below, added to
//                the table only while this preview runs) — without it: the list.
//   Films:  node tools/shot.mjs "?dev=recipe&id=stone_sentinel&fixture=1&look=v3&s=sbSentinelAtk" --fresh --film 48 --every 33
// The look switch is decided at module init: the URL needs &look=v3.

import type { DevPreview } from '../types';
import { MONSTER_IDS, type MonsterId } from '../../data/cards';
import { PAL } from '../../art/palette';
import { registerFixtureArtV3 } from '../../art/monsters';
import { RUMBLE_REFERENCE } from '../../audio/v3/voices';
import { presentationOf, registerFixtureRecipe, v3Recipe } from '../../presentation/registry';
import type { PresentationRecipe } from '../../presentation/types';
import { measureText, pixelText } from '../../ui/text';
import { DEPTH, LOOK_V3 } from '../../view/layout';
import { SCENARIOS, type Scenario } from '../../duel/scenarios';
import { duelReady } from '../../scenes/DuelScene';
import { fixtureArt } from '../../../tests/art/fixtures/rigkit-creature-art';

/** The fixture's recipe: the pilot's draft (A3_MIMARI §6.1) on the fixture creature. */
export function fixtureRecipe(id: string): PresentationRecipe {
  return {
    id,
    tier: 'normal',
    body: { physical: 'stone' },
    attack: { type: 'throw', blow: 'physical', from: 'muzzle', vfx: 'boulder', blocked: 'shatter', ranged: true },
    summon: { style: 'assemble', matter: 'stone' },
    death: { material: 'stone', accent: 'stone' },
    flip: { accent: 'dust' },
    voice: RUMBLE_REFERENCE,
  };
}

const PARAMS = typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined' ? new URLSearchParams(location.search) : null;
const FIXTURE_ID: MonsterId | null = (() => {
  if (!PARAMS || PARAMS.get('dev') !== 'recipe' || !PARAMS.has('fixture')) return null;
  const id = (PARAMS.get('id') ?? 'stone_sentinel') as MonsterId;
  return MONSTER_IDS.includes(id) ? id : null;
})();
const STRIKER_ID: MonsterId | null = (() => {
  const id = FIXTURE_ID ? (PARAMS?.get('striker') as MonsterId | null) : null;
  return id && id !== FIXTURE_ID && MONSTER_IDS.includes(id) ? id : null;
})();
if (FIXTURE_ID) {
  const plain = PARAMS?.has('plain');
  registerFixtureArtV3({ ...fixtureArt(), id: FIXTURE_ID, ...(plain ? {} : { bodyPlan: { id: 'fixture', version: 1 } }) });
  registerFixtureRecipe(fixtureRecipe(FIXTURE_ID));
}
if (STRIKER_ID) {
  registerFixtureArtV3({ ...fixtureArt(), id: STRIKER_ID, bodyPlan: { id: 'fixture', version: 1 } });
  registerFixtureRecipe({ ...fixtureRecipe(STRIKER_ID), body: { physical: 'crystal' } });
}

const down = (id: MonsterId) => ({ id, faceUp: false });

/** Scenarios of this preview (a flip summon and attack-position physical hits on the monster). */
function previewScenarios(id: MonsterId): Record<string, Scenario> {
  return {
    recipeFlipSummon: {
      desc: `${id}: flip summon from a face-down card`,
      stage: { p0: { monsters: [null, down(id)] } },
      steps: [{ type: 'flipSummon', player: 0, zone: 1 }],
    },
    recipeStoneHit: {
      desc: `Kor Kurdu (physical) breaks ${id} in attack position: a lethal blow on its body`,
      stage: { phase: 'battle', p0: { monsters: [null, 'ember_wolf'] }, p1: { monsters: [null, id] } },
      steps: [{ type: 'attack', player: 0, attackerZone: 1, targetZone: 1 }],
    },
    recipeStoneHitHawk: {
      desc: `Fırtına Atmacası (physical dive) breaks ${id} in attack position`,
      stage: { phase: 'battle', p0: { monsters: [null, 'storm_hawk'] }, p1: { monsters: [null, id] } },
      steps: [{ type: 'attack', player: 0, attackerZone: 1, targetZone: 1 }],
    },
    recipeStoneHitShade: {
      desc: `Gölge Suikastçı (physical daggers) breaks ${id} in attack position`,
      stage: { phase: 'battle', p0: { monsters: [null, 'shade_assassin'] }, p1: { monsters: [null, id] } },
      steps: [{ type: 'attack', player: 0, attackerZone: 1, targetZone: 1 }],
    },
    recipeStoneHitThrow: {
      desc: `the striker fixture throws a crystal rock that breaks ${id} in attack position (&striker=<id>)`,
      stage: { phase: 'battle', p0: { monsters: [null, STRIKER_ID ?? 'ember_wolf'] }, p1: { monsters: [null, id] } },
      steps: [{ type: 'attack', player: 0, attackerZone: 1, targetZone: 1 }],
    },
    recipeStoneGuardThrow: {
      desc: `the striker fixture's crystal rock is blocked by ${id} in defense: a guard hit on the stone body (&striker=<id>)`,
      stage: { phase: 'battle', p0: { monsters: [null, STRIKER_ID ?? 'ember_wolf'] }, p1: { monsters: [null, { id, position: 'defense' }] } },
      steps: [{ type: 'attack', player: 0, attackerZone: 1, targetZone: 1 }],
    },
    recipeStoneGuard: {
      desc: `Kor Kurdu (physical) bounces off ${id} in defense: a guard hit on its body`,
      stage: { phase: 'battle', p0: { monsters: [null, 'ember_wolf'] }, p1: { monsters: [null, { id, position: 'defense' }] } },
      steps: [{ type: 'attack', player: 0, attackerZone: 1, targetZone: 1 }],
    },
  };
}

/** The existing scenarios that exercise each recipe part on the pilot (A3_MIMARI §6.2 checklist films). */
const SENTINEL_SET = ['sbSentinelAtk', 'sbSentinelBlocked', 'sbSentinelDirect', 'sbSentinelP2', 'sbSentinelDies', 'smbSentinel', 'smbSentinelP2', 'smbFlipAttacked', 'tbBlocked'];

const preview: DevPreview = {
  name: 'recipe',
  description: 'recipe default cinematic: &id=<monster>&look=v3[&fixture=1][&s=<scenario>]',
  async create(scene, params) {
    const id = (params.get('id') ?? 'stone_sentinel') as MonsterId;
    if (!MONSTER_IDS.includes(id)) throw new Error(`unknown monster ${id}`);
    for (const [k, v] of Object.entries(previewScenarios(id))) SCENARIOS[k] ??= v;
    const name = params.get('s') ?? '';
    const sc = SCENARIOS[name];
    if (!sc) {
      const r = v3Recipe(id) ?? presentationOf(id);
      const lines = [
        `RECIPE PREVIEW — ${id}${FIXTURE_ID ? ' (fixture)' : ''}   look ${LOOK_V3 ? 'v3' : 'v1 (add &look=v3)'}   recipe ${r ? `${r.attack.type} / ${r.summon.style} / ${r.death.material}` : 'none'}`,
        v3Recipe(id) ? 'the recipe is live (v3 look + v3 art): ?dev=recipe&…&s=<name>' : 'the recipe is NOT live here (it needs the v3 look and v3 art)',
      ];
      lines.forEach((l, i) => pixelText(scene, 8, 6 + i * 11, l, { size: 'sm', color: i ? PAL.mist : PAL.gold4 }).setDepth(DEPTH.DEBUG));
      const list = [...Object.keys(previewScenarios(id)), ...SENTINEL_SET.filter((k) => SCENARIOS[k])];
      list.forEach((k, i) => {
        let line = `${k} — ${SCENARIOS[k].desc}`;
        while (line.length > 8 && measureText(line, 'sm').w > 620) line = line.slice(0, -2) + '…';
        const t = pixelText(scene, 8, 34 + i * 11, line, { size: 'sm', color: PAL.mist }).setDepth(DEPTH.DEBUG).setInteractive({ useHandCursor: true });
        t.on('pointerdown', () => {
          const q = new URLSearchParams(location.search);
          q.set('s', k);
          location.search = `?${q.toString()}`;
        });
      });
      return;
    }
    const ready = duelReady();
    scene.scene.start('Duel', { mode: 'hotseat', curtain: false, skipIntro: true, stage: sc.stage, scenario: name, filmScenario: params.has('test') });
    await ready;
  },
};

export default preview;
