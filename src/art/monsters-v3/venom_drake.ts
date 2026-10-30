// Zehir Ejderi (venom_drake) — v3 art: a cursed, long-necked land dragon-serpent on the 'serpent' type
// (./coral_serpent-plan.ts, imported as the plan only). See ./venom_drake-build.ts for the skeleton and
// the channels, ./venom_drake-anims.ts for the motion. Registered through the v3 registry by its name.

import { planArt } from '../bodyplans/types';
import { serpent, type SerpentMember } from './coral_serpent-plan';
import { BUILD, FRAME, FX, MATERIALS, type VenomFx } from './venom_drake-build';
import { MARKS, venomAnims } from './venom_drake-anims';
import { PARTS } from './venom_drake-fx';

export const VENOM_DRAKE: SerpentMember<VenomFx> = {
  id: 'venom_drake',
  tier: 'normal',
  frame: FRAME,
  build: BUILD,
  materials: MATERIALS,
  fx: FX,
  parts: PARTS,
  anims: venomAnims(),
  marks: MARKS,
  weight: 'medium',
  knock: 'pose',
  p2: 'relight',
  points: { muzzle: 'mouth' },
  distinction: {
    silhouette: 'a small planted ring of coil, a LONG neck that leans back off it and swings forward at the top into a head hanging level-down (snout toward the floor), swept horns, a saw of dorsal spikes, small wing-fins at the shoulder and a barbed tail blade: a land dragon-serpent, not a winged dragon and not the sea serpent\'s upright swan neck',
    rhythm: 'sway and snap: the head drifts fore and aft with uneven pauses and a jaw flick, then a long still loading and a 50 ms lunge with the spit; the roar is a hood-flare, not a rear',
    idle: 'the hypnotic sway: the head drifts forward three frames, holds, flicks its jaw twice, dips (a sniff) and drifts home; the blade twitches, a wing-fin flicks, the spikes ripple, a venom drop swells and falls',
    guard: 'hooded: the head tucked down and back over the risen coil, the wing-fins opened into a hood, the spikes bristling, the eye narrowed',
    signaturePart: 'the venom: a green vein snaking through the black-green scales, a glow at every spike base and in the open maw, a drop on the fang',
    material: 'green-black scales on the leaf ramp (night0 underside, leaf0 shadow, leaf1 mid, leaf2 lit, leaf3 edge), bone-yellow ventral plates, ivory horns / fangs / blade; the death melts the hide into toxic sludge under a froth crest and leaves the bone',
    signatureMove: 'the venom spit: the neck winds back into a tight S with the maw glowing, then a 50 ms lunge that levels the head on the target as the jet leaves the muzzle',
  },
};

export default planArt(serpent, VENOM_DRAKE);
