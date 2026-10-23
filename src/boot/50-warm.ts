// First-use texture warming (v3 A1 item 11): after boot, once the deferred monster sheets are
// painted, make the textures the first summon / death / battle phase / Soul Recall would
// otherwise generate on the spot, for the monsters in the decks — in short idle slices (see
// src/duel/warm.ts). The module is imported lazily so this boot step adds nothing to the boot
// block and pulls in no cinematic module at boot. ?test (screenshot tooling) warms at once after
// the sheets, like everything else there; the textures are the same either way.
// A4.1 staged painting: a dev page warms the monsters its SheetPlan paints (a staged scenario's
// monsters; nothing else on other dev pages) instead of every deck monster — the others make their
// textures on first use, from the same generators (same pixels); a real game warms the decks' monsters.
// A4.1 review: a P2 'relight' sheet is painted ahead only up to a player-2 unit's entrance poses
// (src/art/textures.ts); the rest is queued when the first player-2 unit appears. A monster player 2
// sets face-down appears later by a flip, with no lead time (the flip summon's rise, the blow of an
// attack on it), so its sheet's rest is queued at the set instead, a turn ahead (v3, outside ?test:
// an event observer, imported lazily like the warming).
import { CARDS, isMonster, type MonsterId } from '../data/cards';
import { warmP2Sheet } from '../art/textures';
import { LOOK_V3 } from '../view/layout';
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
    if (LOOK_V3 && !sync)
      void import('../cinematics/_core/registry')
        .then((r) =>
          r.registerObserver((ev, ctx) => {
            if (ev.type !== 'setMonster' || ev.player !== 1) return;
            const id = ctx.state.cards[ev.uid]?.cardId;
            if (id && isMonster(CARDS[id])) warmP2Sheet(id as MonsterId);
          }),
        )
        .catch((e) => console.error('[boot] set observer failed', e));
  },
};
export default step;
