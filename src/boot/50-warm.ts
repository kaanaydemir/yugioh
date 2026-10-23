// First-use texture warming (v3 A1 item 11): after boot, once the deferred monster sheets are
// painted, make the textures the first summon / death / battle phase / Soul Recall would
// otherwise generate on the spot, for the monsters in the decks — in short idle slices (see
// src/duel/warm.ts). The module is imported lazily so this boot step adds nothing to the boot
// block and pulls in no cinematic module at boot. ?test (screenshot tooling) warms at once after
// the sheets, like everything else there; the textures are the same either way.
// A4.1 staged painting: a dev page warms the monsters its SheetPlan paints (a staged scenario's
// monsters; nothing else on other dev pages) instead of every deck monster — the others make their
// textures on first use, from the same generators (same pixels); a real game warms the decks' monsters.
import type { BootStep } from './types';
import { bootSheetPlan } from './20-monsters';

const step: BootStep = {
  name: 'warm',
  order: 50,
  build(scene) {
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
    const sync = !!q && q.has('test');
    const ids = q && q.get('dev') ? bootSheetPlan(location.search).p1 : undefined;
    void import('../duel/warm')
      .then((m) => m.warmFirstUse(scene, { sync, ids }))
      .catch((e) => console.error('[boot] warm failed', e));
  },
};
export default step;
