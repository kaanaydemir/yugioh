// Mercan Yılanı (coral_serpent) — v3 art (A4.1 step 2), the first member of the 'serpent' type
// (./coral_serpent-plan.ts, a single-file type in plan form). NOT registered yet: the v3 registry ignores
// files whose name starts with '_' (src/art/monsters/index.ts); the next step registers it together with
// its presentation recipe ('beam' strike from points().muzzle, the pierce effect, the v3 cut-in).

import { planArt } from '../bodyplans/types';
import { serpent, type SerpentMember } from './coral_serpent-plan';
import { BUILD, FRAME, FX, MATERIALS, type SerpentFx } from './coral_serpent-build';
import { coralAnims, MARKS } from './coral_serpent-anims';
import { PARTS } from './coral_serpent-fx';

export const CORAL: SerpentMember<SerpentFx> = {
  id: 'coral_serpent',
  tier: 'normal',
  frame: FRAME,
  build: BUILD,
  materials: MATERIALS,
  fx: FX,
  parts: PARTS,
  anims: coralAnims(),
  marks: MARKS,
  weight: 'medium',
  knock: 'pose',
  p2: 'relight',
  points: { muzzle: 'mouth' },
  distinction: {
    silhouette:
      'a planted ring of coil with a long S of neck rising off its far arc, a long wedge head under a coral crown and a dorsal fin down the neck: the only legless, coiled silhouette on the board',
    rhythm:
      'wave-driven: every move rolls up the spine with a lag (coil, then the S, then the head) while the fin ripples on its own period; a strike is a long coil-back, a 60 ms snap and a held, recoiling jet',
    idle: 'the S-breath: the far arc lifts a pixel at a time and the neck takes each lift, the head held steady like a hunting snake and swaying back a pixel only as the breath ends; the tail sways, the fin ripples, a drop falls off the fin',
    guard: 'drawn in: the coil rises and tips back, the neck folds the head down and back behind it, the fin lies flat and the eye narrows; it breathes slowly, held tight',
    signaturePart: 'the coral crown, stone that never bends (it rides the skull and flares a pixel in the roar), and the dorsal fin carried in its own space along the neck',
    material: 'scaled hide on the water ramp (2-px scale-row teeth only on the mid / shadow boundary, calm lit planes, steel and mist ventral plates), coral and fin membrane on the magenta ramp, water light in the mouth',
    signatureMove: 'the water jet: the neck coils back into a tight S, the throat swells and water gathers into an orb in the open jaws, then a 60 ms snap into the firing pose and a held jet that drives the body back along the coil',
  },
};

export default planArt(serpent, CORAL);
