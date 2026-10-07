// Small pixel icons for the title menus (white/mist/steel — tint at runtime), 1px ink outline.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';

export const TICON = {
  duo: 'title:icon:duo',
  bot: 'title:icon:bot',
  eye: 'title:icon:eye',
  book: 'title:icon:book',
  cards: 'title:icon:cards',
  gear: 'title:icon:gear',
  left: 'title:icon:left',
  right: 'title:icon:right',
  key: 'title:icon:key',
  mouse: 'title:icon:mouse',
} as const;

const K: Record<string, number> = { W: PAL.white, m: PAL.mist, s: PAL.steel, n: PAL.night3 };

const ART: Record<keyof typeof TICON, readonly string[]> = {
  duo: [
    '..mm.....WW..',
    '.mmmm...WWWW.',
    '.mmmm...WWWW.',
    '..mm.....WW..',
    '.............',
    'mmmmmm.WWWWWW',
    'mmmmmm.WWWWWW',
    'mmmmmm.WWWWWW',
    'ssssss.mmmmmm',
  ],
  bot: [
    '.....W.....',
    '.....W.....',
    '..WWWWWWW..',
    '.WmmmmmmmW.',
    'sWmWWmWWmWs',
    'sWmWWmWWmWs',
    '.WmmmmmmmW.',
    '.WmsssssmW.',
    '..WWWWWWW..',
  ],
  eye: [
    '...WWWWW...',
    '.WWmmmmmWW.',
    'WmmmsssmmmW',
    'WmmsWWnsmmW',
    'WmmsWnnsmmW',
    'WmmmsssmmmW',
    '.WWmmmmmWW.',
    '...WWWWW...',
  ],
  book: [
    'WWWW...WWWW',
    'WmmmW.WmmmW',
    'WmssW.WssmW',
    'WmmmW.WmmmW',
    'WmssW.WssmW',
    'WmmmW.WmmmW',
    'WWWWWWWWWWW',
    '.sssss.sss.',
  ],
  cards: [
    '....WWWWW..',
    '..mmWmmmW..',
    'ssmmWmWmWW.',
    'smmmWmmmWmW',
    'smmmWmWmWmW',
    'smmmWmmmWmW',
    'smmmWWWWWmW',
    'smmmmmmmmmW',
    'sssssssssss',
  ],
  gear: [
    '....WW....',
    '.W.WWWW.W.',
    '..WWmmWW..',
    '.WWm..mWW.',
    'WWm....mWW',
    'WWm....mWW',
    '.WWm..mWW.',
    '..WWmmWW..',
    '.W.WWWW.W.',
    '....WW....',
  ],
  left: ['...W', '..WW', '.WWW', 'WWWW', '.WWW', '..WW', '...W'],
  right: ['W...', 'WW..', 'WWW.', 'WWWW', 'WWW.', 'WW..', 'W...'],
  key: ['WWWWWWW', 'WmmmmmW', 'WmmmmmW', 'WmmmmmW', 'WmmmmmW', 'WsssssW', 'WWWWWWW'],
  mouse: ['.WWWWW.', 'WmmWmmW', 'WmmWmmW', 'WWWWWWW', 'WmmmmmW', 'WmmmmmW', 'WmmmmmW', '.WWWWW.'],
};

/** Build all title icons (idempotent). */
export function buildTitleIcons(scene: Phaser.Scene): void {
  for (const name of Object.keys(TICON) as (keyof typeof TICON)[]) {
    const key = TICON[name];
    if (scene.textures.exists(key)) continue;
    const rows = ART[name];
    const w = Math.max(...rows.map((r) => r.length));
    const p = new PixelCanvas(w + 2, rows.length + 2);
    p.stamp(rows, K, 1, 1);
    p.outline(PAL.ink);
    scene.textures.addCanvas(key, p.toCanvas());
  }
}
