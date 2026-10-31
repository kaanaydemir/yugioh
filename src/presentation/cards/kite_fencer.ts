// Uçurtma Eskrimci (kite_fencer, C9) — the presentation recipe (docs/v3/oturum-c-mimari.md §3.4). The strike
// (both attacks: the "Pike" fleche and the "Uçurtma Süzülüşü" pendulum cut) and the entrance (the falling-leaf
// kite) are the card's own (`custom`, src/cinematics/kartc/kite_fencer.ts); the death and the flip stay on the
// recipe layer (deathV3 on the art's death pose with this material / accent) and are decorated at priority 20 by
// the card's own destroy hook (the string snap, the cloak flying off screen).
//
// body: the kite cloth is not in the material library and the generated struck-body sounds are pinned to stone
// (tests/art/materials.test.ts), so the body names a library material WITHOUT a struck-sound recipe ('scale': the
// nearest in kind — a thin stretched membrane): hitSoundFor() gives null and the card's own defend hook scores the
// struck kite cloth (kfnStruck / kfnGuardWrap) on the contact frame instead of the generic body blow. The magus'
// 'cloth' would play its robe-and-shadow exhale, which §2.4 forbids for this card.
// death: §5.2 — not a material finale of its own (the string snap and the flight are the cinematic's): the linen
// scrap lets go as light motes in the kite's gold, with the gold accent (light) — no leaves (C11), no rubble.
// light: §2.4 "Light" — gold4 (the indicator panel) and the rapier's white tip; no leaf tones (those are C11's).

import { PAL } from '../../art/palette';
import type { PresentationRecipe } from '../types';

export default {
  id: 'kite_fencer',
  tier: 'normal',
  body: { physical: 'scale' },
  attack: { type: 'lunge', blow: 'physical', from: 'muzzle', vfx: 'needle', tone: PAL.gold4 },
  summon: { style: 'swoop', matter: 'light' },
  death: { material: 'light', accent: 'light' },
  flip: { accent: 'dust' },
  voice: { custom: 'kite_fencer' },
  light: { glow: { emissive: [[PAL.gold4, 1], [PAL.white, 0.6]], halo: 0.5, pool: 0.6 }, strike: PAL.gold4 },
  custom: { strike: true, summon: true },
} satisfies PresentationRecipe;
