// DEV / TEST ONLY: `?look=v3&poseshim=1` adds placeholder v3 extra poses (death / summon / revive /
// toGuard / fromGuard) to the slice monsters that do not draw them yet, before their sheets are
// built (src/dev/pose-shim.ts). Without the flag this step does nothing.
import { installPoseShim } from '../dev/pose-shim';
import type { BootStep } from './types';

const step: BootStep = {
  name: 'pose-shim',
  order: 19,
  build: () => {
    if (typeof location !== 'undefined') installPoseShim(location.search);
  },
};
export default step;
