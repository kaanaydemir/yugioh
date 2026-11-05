// Registers cloud_hatchling's permanent 'grown' variant (docs/v3/kart-a/cloud_hatchling.md §3.3) at
// game load, before any duel builds a unit: a staged / revealed grown slot is grown from its first frame.
// It lives here, not in the art module, because src/art/variants.ts pulls in the Phaser texture layer
// (the art registry is also loaded by Node tools and tests). Harmless in the v1 look: slotVariant()
// returns null there, so no unit ever shows a variant.
import { registerMonsterVariant } from '../art/variants';
import { HATCH_GROWN_VARIANT } from '../art/monsters-v3/cloud_hatchling-grown';
import type { BootStep } from './types';

registerMonsterVariant('cloud_hatchling', HATCH_GROWN_VARIANT);

const step: BootStep = {
  name: 'hatchling-variant',
  order: 18,
  build: () => {
    // registered at module load (above); re-registering is idempotent (a name replaces itself)
    registerMonsterVariant('cloud_hatchling', HATCH_GROWN_VARIANT);
  },
};
export default step;
