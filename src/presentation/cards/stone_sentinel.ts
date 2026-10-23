// Taş Muhafız — the A3 pilot (Y8), the first card on the DEFAULT recipe path (normal tier, no custom
// part): the recipe layer (src/cinematics/recipe/*) builds its whole life cycle in the v3 look from the
// data below, and its own flourishes stay inside the ornament budget (A3_MIMARI §6.2: hooks + set
// piece + projectile ≤ 250 lines, one set piece per event):
//   strike   'throw' — the boulder it tears out of the floor leaves the hand on the 'release' frame
//            from `points().muzzle` (the rock's centre while the hand carries it, so the flying rock
//            takes over the drawn one in place), its own drawing (recipe/projectiles/boulder.ts),
//            spinning on a parabola with its shadow sliding over the floor; blocked it shatters on
//            the guard; hooks: the dig (shake, clods past the frame), the crater decal that outlives
//            the art's crater, the hold's eye light, the floor cracking under the struck body
//   summon   'assemble' + the 'rockAssembly' set piece (floor rocks orbit the rising column and lock
//            into it; the shield slam is the summon pose's own peak beat, the kit's finale shakes on it)
//   death    the v3 death kit on the art's crumble pose, breaking as stone; hook: the floor cracks
//   flip     the v3 flip with the 'dust' accent; position and revive are generic (the art's own poses)
//   voice    the 'rumble' palette (src/audio/v3/voices.ts) on G1; a blow on it sounds as stone (its
//            runes are carved in the stone: runeGold's sound is the stone's)
// Today's tables (STRIKE_LIGHT, MONSTER_GLOW, ROAR_PEAK, RANGED, DEATH_PRESETS, STRIKE_KIND) keep the
// v1 sentinel exactly as it was; the bridge reads this recipe only in the v3 look (§6.4).

import { PAL } from '../../art/palette';
import type { PresentationRecipe } from '../types';

export default {
  id: 'stone_sentinel',
  tier: 'normal',
  body: { physical: 'stone' },
  attack: { type: 'throw', blow: 'physical', from: 'muzzle', vfx: 'boulder', tone: PAL.earth3, blocked: 'shatter', ranged: true },
  summon: { style: 'assemble', matter: 'stone', setPiece: 'rockAssembly', roarPeak: 2, leadMs: 150 },
  death: { material: 'stone', accent: 'stone' },
  // the flip: the v3 flip without the generic burst (recipe/flip.ts), its body forming in the stone's own greys
  flip: { accent: 'dust', ramp: 'stone' },
  // the helm hits the floor 3 frames after the crumble starts and bounces on the next (death f7 / f8)
  voice: { palette: 'rumble', key: 31, register: 'low', brightness: 0.15, tail: 'dust', drops: [[3, 0.5], [4, 0.2]] },
  // the v3 art's light is its gold only (the eye's gold4 core, the ᛉ / Ψ gold3 and gold2): the moss is not emissive.
  // The impact's floor light is a cool stone-white: any warm or earth light's first stepped tone on the night
  // floor is a mud tone (gold0, earth0 — REHBER EF-6; pilot critique), white steps night1 → night2 → night3
  light: { glow: { emissive: [[PAL.gold4, 1], [PAL.gold3, 0.7], [PAL.gold2, 0.3]], halo: 0.5, pool: 0.85 }, strike: PAL.white },
  hooks: () => import('../../cinematics/recipe/hooks/stone_sentinel'),
} satisfies PresentationRecipe;
