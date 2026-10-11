import { MONSTER_IDS } from '../data/cards';
import { whenMonstersBuilt } from '../art/textures';
import { ARENA_V2 } from '../view/layout';
import { glowSheet } from '../view/light/glow';
import { ensureLightTextures } from '../view/light/textures';
import type { BootStep } from './types';

/**
 * Light layer textures (arena v2 only): soft radial / ring / line falloffs and the water
 * caustic frames. The monster glow sheets (halos) are prewarmed in the background once every
 * monster sheet is painted, one monster per slice (~10 ms each); a monster that appears before
 * its slice simply builds its sheet on the spot.
 */
const step: BootStep = {
  name: 'light',
  order: 16,
  build: (scene) => {
    if (!ARENA_V2) return;
    ensureLightTextures(scene);
    const textures = scene.textures;
    void whenMonstersBuilt().then(() => {
      let i = 0;
      const next = () => {
        if (i >= MONSTER_IDS.length) return;
        try {
          glowSheet({ textures }, MONSTER_IDS[i++]);
        } catch (e) {
          console.error('[light] glow prewarm failed', e);
          return;
        }
        setTimeout(next, 16);
      };
      setTimeout(next, 16);
    });
  },
};
export default step;
