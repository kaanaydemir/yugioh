// ?dev=art-lab — Art Lab: an isolated sandbox for choosing the monsters' drawing and animation
// quality (see src/artlab/README.md). Nothing here touches the game.
//
//   ?dev=art-lab [&variant=A] [&t=MS] [&paused=1] [&speed=0.5|1] [&zoom=dragon|wizard] [&fx=0]
//                [&ui=0] [&stage=static|idle] [&pose=dragon:attack:6,wizard:idle:0] [&loop=1] [&live=1]
//
// The lab itself is imported lazily (DevScene awaits create()), so Vite keeps src/artlab out of the
// game's main chunk: only this small descriptor is bundled with the other previews.

import type { ArtLabApi } from '../../artlab/core/lab';
import type { DevPreview } from '../types';

declare global {
  interface Window {
    __artlab?: ArtLabApi;
  }
}

const preview: DevPreview = {
  name: 'art-lab',
  description: 'Art Lab: dragon vs wizard battle sandbox (&variant=A &t= &paused=1 &speed=0.5 &zoom=dragon|wizard &fx=0 &ui=0 &stage=static &pose= &loop=1)',
  async create(scene, params) {
    const [{ ArtLab, labOptions }, { findVariant, readyVariants, VARIANTS }] = await Promise.all([
      import('../../artlab/core/lab'),
      import('../../artlab/variants'),
    ]);
    const opts = labOptions(params);
    // a requested variant that is not ready (or does not exist) falls back to the first ready one,
    // and says so on screen instead of silently showing another variant
    let notice: string | null = null;
    if (!findVariant(opts.variant)) {
      const asked = opts.variant;
      const fallback = readyVariants()[0]?.id ?? 'A';
      const listed = VARIANTS.some((v) => v.id === asked);
      notice = listed ? `Varyant ${asked} henüz hazır değil — ${fallback} gösteriliyor` : `Varyant ${asked} yok — ${fallback} gösteriliyor`;
      console.warn(`[art-lab] variant ${asked} is ${listed ? 'not ready yet' : 'unknown'}; showing ${fallback}`);
      opts.variant = fallback;
    }
    const lab = new ArtLab(scene, opts);
    lab.build(opts.variant);
    if (notice) lab.notice(notice);
    const onUpdate = () => lab.update();
    scene.events.on('update', onUpdate);
    window.__artlab = lab.api();
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      scene.events.off('update', onUpdate);
      lab.destroy();
      if (window.__artlab) delete window.__artlab;
    };
    scene.events.once('shutdown', cleanup);
    scene.events.once('destroy', cleanup);
  },
};

export default preview;
