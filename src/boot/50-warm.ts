// First-use texture warming (v3 A1 item 11): after boot, once the deferred monster sheets are
// painted, make the textures the first summon / death / battle phase / Soul Recall would
// otherwise generate on the spot, for the monsters in the decks — in short idle slices (see
// src/duel/warm.ts). The module is imported lazily so this boot step adds nothing to the boot
// block and pulls in no cinematic module at boot. ?test (screenshot tooling) warms at once after
// the sheets, like everything else there; the textures are the same either way.
import type { BootStep } from './types';

const step: BootStep = {
  name: 'warm',
  order: 50,
  build(scene) {
    const sync = typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');
    void import('../duel/warm')
      .then((m) => m.warmFirstUse(scene, { sync }))
      .catch((e) => console.error('[boot] warm failed', e));
  },
};
export default step;
