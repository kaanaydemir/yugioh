// ?dev=title — starts the real TitleScene (registering it if the integration step has not yet).
//   &at=attract|menu|howto|gallery|settings   jump straight to a screen (skips the intro)
//   &page=N        how-to page (0-based)        &card=<id>   gallery selection
//   &sync=1        wait for the shot tool's freeze before the intro starts (deterministic films)
//   &logo=1        logo only on a plain backdrop (art check)
//   &from=duel     the path a finished duel takes back (no click gate, straight to the menu)
import { TitleScene, type TitleData } from '../../scenes/TitleScene';
import type { DevPreview } from '../types';

const preview: DevPreview = {
  name: 'title',
  description: 'title screen & menus: &at=attract|menu|howto|gallery|settings &page=N &card=<id> &sync=1 &logo=1 &from=duel',
  async create(scene, params) {
    const mgr = scene.game.scene;
    if (!mgr.keys['Title']) mgr.add('Title', TitleScene, false);
    const data: TitleData = {
      at: (params.get('at') as TitleData['at']) ?? undefined,
      page: params.has('page') ? Number(params.get('page')) : undefined,
      card: params.get('card') ?? undefined,
      sync: params.get('sync') === '1',
      logoOnly: params.get('logo') === '1',
      from: params.get('from') === 'duel' ? 'duel' : undefined,
      dev: true,
    };
    const ready = new Promise<void>((resolve) => scene.game.events.once('title:ready', () => resolve()));
    scene.scene.start('Title', data);
    await ready;
  },
};

export default preview;
