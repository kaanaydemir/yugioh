// Textures of the deck builder (layout v2, docs/DESTE_KURMA.md): the portrait collection card built from the
// game's real 44×34 card art, the deck-list thumbnails, the selection ring, the "at max" dither veil and the
// small icons of the bars. Palette colours only, 1-px ink outlines, every texture cached by key.

import Phaser from 'phaser';
import { CARDS, isMonster, type CardId } from '../../data/cards';
import { cardArtCanvas, drawAttributeOrb, drawDigits, digitsWidth } from '../../art/cards';
import { KIND_RAMP, PAL, RAMPS, type Ramp } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { canvasTexture, paintText } from '../../view/v3/hudSkin';
import { orbOf } from './ui';

/** Collection card (portrait): 44×34 art window + a band with element, level stars and ATK / DEF. */
export const MINI_W = 48;
export const MINI_H = 60;
/** Deck-list thumbnail (grid view): a 26×32 crop of the art in a kind frame. */
export const THUMB_W = 30;
export const THUMB_H = 36;
/** Deck-list strip (strip view mock): a 40×12 band of the art in a kind frame. */
export const STRIP_ART_W = 44;
export const STRIP_ART_H = 16;

export const SPELL_WORD: Record<string, string> = { normal: 'Normal', equip: 'Equip', field: 'Field', continuous: 'Cont.', quick: 'Quick' };

function kindRampOf(id: CardId): Ramp {
  return KIND_RAMP[CARDS[id].kind];
}

/** Ink outline + one kind trim ring (light top-left, dark bottom-right), chamfered corners. */
function framed(w: number, h: number, R: Ramp): PixelCanvas {
  const p = new PixelCanvas(w, h);
  p.rect(0, 0, w, h, PAL.ink);
  p.rect(1, 1, w - 2, h - 2, R[2]);
  p.hline(1, w - 2, 1, R[3]);
  p.vline(1, 1, h - 2, R[3]);
  p.hline(1, w - 2, h - 2, R[1]);
  p.vline(w - 2, 1, h - 2, R[1]);
  p.set(1, 1, R[4]);
  for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]] as const) p.erase(x, y);
  return p;
}

const STAR3 = ['.#.', '###', '.#.'];

/** The portrait collection card of `id` (48×60). */
export function miniCardTex(scene: Phaser.Scene, id: CardId): string {
  return canvasTexture(scene, `deck2:mini:${id}`, () => {
    const d = CARDS[id];
    const R = kindRampOf(id);
    const p = framed(MINI_W, MINI_H, R);
    p.blit(cardArtCanvas(id), 2, 2);
    p.hline(2, MINI_W - 3, 36, PAL.ink);
    // band
    p.rect(2, 37, MINI_W - 4, MINI_H - 39, PAL.night1);
    p.hline(2, MINI_W - 3, 37, PAL.night2);
    drawAttributeOrb(p, 3, 39, orbOf(id));
    if (isMonster(d)) {
      for (let i = 0; i < Math.min(8, d.level); i++) {
        p.stamp(STAR3, { '#': d.level >= 7 ? PAL.fire3 : PAL.gold3 }, 14 + i * 4, 42);
        p.set(15 + i * 4, 43, PAL.gold4);
      }
      drawDigits(p, 4, 51, String(d.atk), PAL.crim3, PAL.ink);
      const ds = String(d.def);
      drawDigits(p, MINI_W - 5 - digitsWidth(ds), 51, ds, PAL.cyan3, PAL.ink);
    } else {
      const word = d.kind === 'spell' ? 'SPELL' : 'TRAP';
      paintText(p, 13, 38, word, 'sm', R[3]);
      const sub = d.kind === 'spell' ? (SPELL_WORD[d.spellType] ?? 'Normal') : 'Normal';
      paintText(p, 4, 47, sub, 'sm', PAL.steel);
    }
    return p;
  });
}

/** Deck-list thumbnail (grid view): the art's centre 26×32 in the kind frame (30×36). */
export function deckThumbTex(scene: Phaser.Scene, id: CardId): string {
  return canvasTexture(scene, `deck2:thumb:${id}`, () => {
    const p = framed(THUMB_W, THUMB_H, kindRampOf(id));
    p.blit(cardArtCanvas(id).crop(9, 1, THUMB_W - 4, THUMB_H - 4), 2, 2);
    return p;
  });
}

/** Deck-list strip art (strip view): a 40×12 band through the art's middle in the kind frame (44×16). */
export function stripArtTex(scene: Phaser.Scene, id: CardId): string {
  return canvasTexture(scene, `deck2:strip:${id}`, () => {
    const p = framed(STRIP_ART_W, STRIP_ART_H, kindRampOf(id));
    p.blit(cardArtCanvas(id).crop(2, 9, STRIP_ART_W - 4, STRIP_ART_H - 4), 2, 2);
    return p;
  });
}

/** A 50 % ink checker (the "at its copy limit" veil over a collection card). */
export function veilTex(scene: Phaser.Scene, w: number, h: number): string {
  return canvasTexture(scene, `deck2:veil:${w}x${h}`, () => {
    const p = new PixelCanvas(w, h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if ((x + y) % 2 === 0) p.set(x, y, PAL.ink);
    return p;
  });
}

/** Selection ring around a w×h card: 2 px outside it (gold, bright corners), texture (w+4)×(h+4). */
export function ringTex(scene: Phaser.Scene, w: number, h: number, tone: 'gold' | 'cyan' = 'gold'): string {
  return canvasTexture(scene, `deck2:ring:${tone}:${w}x${h}`, () => {
    const R = tone === 'gold' ? RAMPS.gold : RAMPS.cyan;
    const W = w + 4;
    const H = h + 4;
    const p = new PixelCanvas(W, H);
    p.frame(0, 0, W, H, R[2]);
    p.frame(1, 1, W - 2, H - 2, R[3]);
    for (const [x, y, dx, dy] of [[1, 1, 1, 1], [W - 2, 1, -1, 1], [1, H - 2, 1, -1], [W - 2, H - 2, -1, -1]] as const) {
      p.set(x, y, R[4]).set(x + dx, y, R[4]).set(x, y + dy, R[4]);
      p.set(x + dx * 2, y, R[4]).set(x, y + dy * 2, R[4]);
    }
    for (const [x, y] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]] as const) p.erase(x, y);
    return p;
  });
}

// ---------------------------------------------------------------- icons

function icon(scene: Phaser.Scene, key: string, rows: readonly string[], map: Record<string, number>, outline = true): string {
  return canvasTexture(scene, `deck2:icon:${key}`, () => {
    const w = rows[0].length + (outline ? 2 : 0);
    const h = rows.length + (outline ? 2 : 0);
    const p = new PixelCanvas(w, h);
    p.stamp(rows, map, outline ? 1 : 0, outline ? 1 : 0);
    if (outline) p.outline(PAL.ink);
    return p;
  });
}

/** The title's crystal (11×15). */
export function crystalIcon(scene: Phaser.Scene): string {
  return icon(scene, 'crystal', [
    '....#....',
    '...#W#...',
    '..#Wc##..',
    '.#Wcc#b#.',
    '#Wccc#bb#',
    '#cccc#bbb',
    '#ccc#bbbb',
    '.#cc#bbb.',
    '..#c#bb..',
    '...##b...',
    '....#....',
    '.........',
    '..s.s.s..',
  ].map((r) => r.replace(/#/g, 'L')), { L: PAL.cyan4, W: PAL.white, c: PAL.cyan2, b: PAL.cyan1, s: PAL.cyan1 });
}

/** Pencil (rename), 9×9 in button tones (white / mist / steel). */
export function pencilIcon(scene: Phaser.Scene): string {
  return icon(scene, 'pencil', ['.....mW', '....mWm', '...mWm.', '..mWm..', '.mWm...', 'sss....', 's......'], { W: PAL.white, m: PAL.mist, s: PAL.steel });
}

/** Magnifier (search field), 9×9. */
export function searchIcon(scene: Phaser.Scene): string {
  return icon(scene, 'search', ['.mmm...', 'm...m..', 'm...m..', 'm...m..', '.mmmW..', '....WW.', '.....WW'], { W: PAL.white, m: PAL.mist });
}

/** Padlock (copy limit reached), 9×10. */
export function lockIcon(scene: Phaser.Scene): string {
  return icon(scene, 'lock', ['.mmm.', 'm...m', 'm...m', 'WWWWW', 'Wgkgg', 'ggkgg', 'ggggg'], { m: PAL.mist, W: PAL.gold4, g: PAL.gold3, k: PAL.ink });
}

/** Small caret pointing down (dropdown), 7×5. */
export function caretDownIcon(scene: Phaser.Scene): string {
  return icon(scene, 'caretdn', ['WWWWW', '.WWW.', '..W..'], { W: PAL.white });
}

/** Gold check (meter met), 10×8. */
export function checkIcon(scene: Phaser.Scene, on = true): string {
  return icon(scene, on ? 'check' : 'checkoff', ['.......W', '......WW', 'W....WW.', 'WW..WW..', '.WWWW...', '..WW....'], { W: on ? PAL.gold3 : PAL.night4 });
}

/** Meter icons, 13×13: card fan, monster head, Lv7+ star, copy stack. */
export function meterIcon(scene: Phaser.Scene, key: 'cards' | 'monsters' | 'high' | 'copies'): string {
  const C = { a: PAL.cyan4, b: PAL.cyan3, c: PAL.cyan2, d: PAL.cyan1, k: PAL.ink, W: PAL.white };
  const art: Record<typeof key, string[]> = {
    cards: ['...aaaaaa..', '..abbbbbba.', '.cabccccba.', '.cabcWWcba.', '.cabcWWcba.', '.cabccccba.', '.cabccccba.', '.cabbbbbba.', '.cdaaaaaa..', '.cccccccd..', '..dddddd...'],
    monsters: ['a.......a..', 'ab.....ba..', 'abbbbbbba..', 'bbbbbbbbb..', 'bkWbbbWkb..', 'bbkbbbkbb..', '.bbbbbbb...', '.bckckcb...', '..bbbbb....', '...ccc.....', '...........'],
    high: ['....a......', '....a......', '...aba.....', 'aaabWbaaa..', '.abbbbba...', '..abbba....', '..abcba....', '.abc.cba...', '.ac...ca...', '...........', '...........'],
    copies: ['..aaaaaa...', '..abbbba...', 'aaaaaaba...', 'abbbbaba...', 'abccbaba...', 'abcWbaba...', 'abccbaaa...', 'abccba.....', 'abbbba.....', 'aaaaaa.....', '...........'],
  };
  return icon(scene, `m:${key}`, art[key], C);
}

/** Button icons (9×9, white / mist / steel so the v3 button skin re-tones them). */
export function buttonIcon(scene: Phaser.Scene, key: 'auto' | 'preset' | 'classic' | 'clear' | 'save' | 'back'): string {
  const C = { W: PAL.white, m: PAL.mist, s: PAL.steel };
  const art: Record<typeof key, string[]> = {
    auto: ['...W...', '...W...', '.mWWWm.', 'WWWWWWW', '.mWWWm.', '...W.m.', '...W.mm'],
    preset: ['WWW....', 'WmmWWWW', 'WmmmmmW', 'WmmmmmW', 'WmmmmmW', 'WmmmmmW', 'WWWWWWW'],
    classic: ['.WWWWW.', 'WmmmmmW', 'WmWWWmW', 'WmmmmmW', 'WmWWmmW', 'WmmmmmW', '.WWWWW.'],
    clear: ['..WWW..', 'WWWWWWW', '.m.m.m.', '.m.m.m.', '.m.m.m.', '.m.m.m.', '.mmmmm.'],
    save: ['WWWWWW.', 'WmmmmWW', 'WmmmmmW', 'WWWWWWW', 'WsssssW', 'WsWWWsW', 'WWWWWWW'],
    back: ['...W...', '..WW...', '.WWWWWW', 'WWWWWWW', '.WWWWWW', '..WW...', '...W...'],
  };
  return icon(scene, `b:${key}`, art[key], C);
}
