// ?dev=duel&s=<scenario> — open the real DuelScene on a staged scenario (src/duel/scenarios.ts).
//   In test mode (tools/shot.mjs) the scenario's steps start on the first freeze(), so
//     node tools/shot.mjs "?dev=duel&s=trapMirror" --film 24 --every 120
//   films that action from t = 0. Without &s a clickable list of every scenario is shown.
//   &mode=vsBot|demo &speed=N &first=0|1 also accepted (default hot-seat, no curtain).
import type { DevPreview } from '../types';
import { PAL } from '../../art/palette';
import { measureText, pixelText } from '../../ui/text';
import { DEPTH } from '../../view/layout';
import { SCENARIOS } from '../../duel/scenarios';
import { duelReady } from '../../scenes/DuelScene';
import type { DuelMode } from '../../scenes/launch';

const preview: DevPreview = {
  name: 'duel',
  description: 'the duel scene on a staged scenario: &s=<name> (list without)',
  async create(scene, params) {
    const name = params.get('s') ?? '';
    const sc = SCENARIOS[name];
    if (!sc) {
      pixelText(scene, 8, 6, 'DUEL SCENARIOS — ?dev=duel&s=<name>   (click one)', { size: 'sm', color: PAL.gold4 }).setDepth(DEPTH.DEBUG);
      Object.entries(SCENARIOS).forEach(([k, v], i) => {
        let line = `${k} — ${v.desc}`;
        while (line.length > 8 && measureText(line, 'sm').w > 312) line = line.slice(0, -2) + '…';
        const t = pixelText(scene, 8 + Math.floor(i / 30) * 320, 20 + (i % 30) * 11, line, { size: 'sm', color: PAL.mist })
          .setDepth(DEPTH.DEBUG)
          .setInteractive({ useHandCursor: true });
        t.on('pointerdown', () => (location.search = `?dev=duel&s=${k}`));
      });
      return;
    }
    const ready = duelReady();
    scene.scene.start('Duel', {
      mode: (params.get('mode') as DuelMode | null) ?? 'hotseat',
      curtain: false,
      skipIntro: true,
      stage: sc.stage,
      speed: params.get('speed') ? Number(params.get('speed')) : undefined,
      scenario: name,
      filmScenario: params.has('test'),
    });
    await ready;
  },
};

export default preview;
