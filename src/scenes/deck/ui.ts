// Textures and small shared pieces of the deck screens (builder + deck picker): the dim lattice
// backdrop, the card-cell frames, element orbs, the seal chain icon, the ink fade-in.
// Colours come from the palette only; every texture is cached by key.

import Phaser from 'phaser';
import { ATTRIBUTE_NAMES, CARDS, isMonster, type Attribute, type CardId } from '../../data/cards';
import { drawAttributeOrb } from '../../art/cards';
import { frameRectV3, trimV3, type TrimName } from '../../art/frame-v3';
import { KIND_RAMP, PAL, RAMPS, type Ramp } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { GAME_H, GAME_W } from '../../view/layout';
import { canvasTexture } from '../../view/v3/hudSkin';
import { REDUCED_MOTION as V3_REDUCED } from '../../view/v3/motion';
import { tween } from '../../vfx/core';

/**
 * Reduced motion for the deck screens: the v3 flag, OR the OS preference / ?motion=reduced in any look
 * (the v3 flag alone is always false in the v1 look). &motion=full wins.
 */
function detectReduced(): boolean {
  try {
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('motion') : null;
    if (q === 'full') return false;
    if (q === 'reduced' || V3_REDUCED) return true;
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return V3_REDUCED;
  }
}
export const REDUCED_MOTION: boolean = detectReduced();

/**
 * A panel in the v3 frame language (palette only: ink outline, one 1-px trim, two flat bands),
 * optionally with a header band. Used for every panel of the deck screens in both looks, so no
 * alpha-blended off-palette colour ever reaches the screen.
 */
export function panelV3(scene: Phaser.Scene, trim: TrimName, w: number, h: number, header = 0, lift = 0): string {
  return canvasTexture(scene, `deck:panel:${trim}:${lift}:${w}x${h}:${header}`, () => {
    const p = new PixelCanvas(w, h);
    const t = trimV3(trim, lift);
    frameRectV3(p, 0, 0, w, h, t, { split: header ? header + 10 : 0.55 });
    if (header) {
      p.rect(2, 2, w - 4, header - 2, PAL.night2);
      p.hline(2, w - 3, header, t.dark);
    }
    return p;
  });
}

export const CELL_W = 108;
export const CELL_H = 40;

export type CellKind = 'monster' | 'spell' | 'trap';

/** Frame of one pool cell: kind trim, two tone bands, a 46x36 art window; focus = bright trim + corner ticks. */
export function cellTex(scene: Phaser.Scene, kind: CellKind, focus: boolean, inDeck: boolean, w = CELL_W, h = CELL_H): string {
  const key = `deck:cell:${kind}:${focus ? 1 : 0}${inDeck ? 1 : 0}:${w}x${h}`;
  return canvasTexture(scene, key, () => {
    const R: Ramp = KIND_RAMP[kind];
    const p = new PixelCanvas(w, h);
    const trim = focus ? PAL.white : inDeck ? PAL.gold3 : R[1];
    const light = focus ? R[4] : inDeck ? PAL.gold2 : R[2];
    p.rect(0, 0, w, h, PAL.ink);
    // chamfered body
    p.rect(1, 1, w - 2, h - 2, trim);
    p.rect(2, 2, w - 4, h - 4, inDeck ? RAMPS.gold[0] : focus ? PAL.night3 : PAL.night2);
    p.rect(2, 24, w - 4, h - 26, inDeck ? PAL.night1 : focus ? PAL.night2 : PAL.night1);
    p.hline(2, w - 3, 24, focus ? R[2] : PAL.night0);
    p.hline(2, w - 3, 2, light);
    p.vline(2, 3, h - 3, light);
    for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]] as const) p.erase(x, y);
    // art window (46x36 at 2,2): ink + kind tone
    p.rect(2, 2, 46, 36, PAL.ink);
    p.frame(2, 2, 46, 36, focus ? R[3] : R[1]);
    if (focus) {
      // corner ticks, the "this one" cue that does not rely on colour alone
      for (const [x, y, dx, dy] of [[w - 3, 3, -1, 1], [w - 3, h - 4, -1, -1]] as const) {
        p.set(x, y, PAL.white).set(x + dx, y, PAL.white).set(x, y + dy, PAL.white);
      }
    }
    return p;
  });
}

/** 9x9 element orb (or spell / trap rune) texture. */
export function orbTex(scene: Phaser.Scene, what: Attribute | 'SPELL' | 'TRAP'): string {
  return canvasTexture(scene, `deck:orb:${what}`, () => {
    const p = new PixelCanvas(9, 9);
    drawAttributeOrb(p, 0, 0, what);
    return p;
  });
}

export function orbOf(id: CardId): Attribute | 'SPELL' | 'TRAP' {
  const d = CARDS[id];
  return isMonster(d) ? d.attribute : d.kind === 'spell' ? 'SPELL' : 'TRAP';
}

/** Two chain links, 9x5: the mark of the five seal pieces. */
export function chainTex(scene: Phaser.Scene): string {
  return canvasTexture(scene, 'deck:chain', () => {
    const p = new PixelCanvas(9, 5);
    p.stamp(['.###.###.', '#...#...#', '#.#####.#', '#...#...#', '.###.###.'], { '#': PAL.mist }, 0, 0);
    p.set(2, 1, PAL.white).set(6, 1, PAL.white);
    p.outline(PAL.ink);
    return p;
  });
}

/** A horseshoe magnet, 9x5: the mark of the three Kutup pieces and Kutup Hükümdarı (the fusion). */
export function magnetTex(scene: Phaser.Scene): string {
  return canvasTexture(scene, 'deck:magnet', () => {
    const p = new PixelCanvas(9, 5);
    p.stamp(['.hhhhhhh.', '##+++++##', '##.....##', 'WW.....WW', 'WW.....WW'], { h: PAL.fire3, '#': PAL.fire2, '+': PAL.fire1, W: PAL.stone4 }, 0, 0);
    p.set(0, 3, PAL.white).set(7, 3, PAL.white);
    p.outline(PAL.ink);
    return p;
  });
}

/** A gold "1" tag, 9x5: a card a deck may hold only once (SINGLE_COPY_IDS). */
export function singleTex(scene: Phaser.Scene): string {
  return canvasTexture(scene, 'deck:single', () => {
    const p = new PixelCanvas(9, 5);
    p.stamp(['.hhhhhhh.', '###WW####', '####W####', '####W####', '.##WWW##.'], { h: PAL.gold3, '#': PAL.gold2, W: PAL.white }, 0, 0);
    p.outline(PAL.ink);
    return p;
  });
}

/** 7x7 gold tick for "already in the deck". */
export function tickTex(scene: Phaser.Scene): string {
  return canvasTexture(scene, 'deck:tick', () => {
    const p = new PixelCanvas(9, 9);
    p.disc(4, 4, 4, PAL.ink);
    p.disc(4, 4, 3, PAL.gold2);
    p.stamp(['......#', '.....##', '#...##.', '##.##..', '.###...', '..#....'], { '#': PAL.white }, 1, 2);
    return p;
  });
}

/** A 640x360 backdrop: night bands with a faint isometric lattice. Static; the scene scrolls a separate lattice tile. */
export function backdropTex(scene: Phaser.Scene): string {
  return canvasTexture(scene, 'deck:bg', () => {
    const p = new PixelCanvas(GAME_W, GAME_H);
    for (let y = 0; y < GAME_H; y++) {
      const t = y / GAME_H;
      const base = t < 0.5 ? PAL.night0 : PAL.night1;
      const next = t < 0.5 ? PAL.night1 : PAL.night0;
      for (let x = 0; x < GAME_W; x++) {
        const lvl = Math.round(Math.abs(t - 0.5) * 2 * 16);
        p.set(x, y, PixelCanvas.ditherAt(x, y, lvl) ? next : base);
      }
    }
    // vignette: ink corners
    for (let y = 0; y < GAME_H; y++)
      for (let x = 0; x < GAME_W; x++) {
        const dx = Math.abs(x - GAME_W / 2) / (GAME_W / 2);
        const dy = Math.abs(y - GAME_H / 2) / (GAME_H / 2);
        const d = dx * dx + dy * dy;
        if (d > 1.1 && PixelCanvas.ditherAt(x, y, Math.min(16, Math.round((d - 1.1) * 16)))) p.set(x, y, PAL.ink);
      }
    return p;
  });
}

/** 64x32 lattice tile (2:1 diamonds, 1-px lines) for the slowly drifting backdrop layer. */
export function latticeTex(scene: Phaser.Scene): string {
  return canvasTexture(scene, 'deck:lattice', () => {
    const p = new PixelCanvas(64, 32);
    for (let x = 0; x < 64; x++) {
      const y = Math.floor(x / 2);
      p.set(x, y % 32, PAL.night2).set(x, (32 - 1 - y + 32) % 32, PAL.night2);
      p.set((x + 32) % 64, y % 32, PAL.night2);
    }
    return p;
  });
}

/** Scene opens from ink: a full-screen rectangle that fades out (instant with reduced motion). */
export function fadeFromInk(scene: Phaser.Scene, ms = 220): Promise<void> {
  const r = scene.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink, 1).setOrigin(0).setDepth(5000).setScrollFactor(0);
  if (REDUCED_MOTION) {
    r.destroy();
    return Promise.resolve();
  }
  return tween(scene, { targets: r, alpha: 0, duration: ms, ease: 'Quad.Out' }).then(() => r.destroy());
}

/** Fades to ink (resolves when covered). */
export function fadeToInk(scene: Phaser.Scene, ms = 180): Promise<void> {
  const r = scene.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink, 0).setOrigin(0).setDepth(5000).setScrollFactor(0);
  if (REDUCED_MOTION) {
    r.setAlpha(1);
    return Promise.resolve();
  }
  return tween(scene, { targets: r, alpha: 1, duration: ms, ease: 'Quad.In' }).then(() => undefined);
}

/** Cuts text to `maxW` pixels with an ellipsis. `measure` returns the pixel width of a string. */
export function fitText(text: string, maxW: number, measure: (s: string) => number): string {
  if (measure(text) <= maxW) return text;
  let s = text;
  while (s.length > 1 && measure(`${s}…`) > maxW) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

export const ELEMENT_NAME = ATTRIBUTE_NAMES;

/** 46x36 picture frame for the deck preview thumbnails. */
export function thumbTex(scene: Phaser.Scene, kind: CellKind, lit: boolean): string {
  return canvasTexture(scene, `deck:thumb:${kind}:${lit ? 1 : 0}`, () => {
    const R: Ramp = KIND_RAMP[kind];
    const p = new PixelCanvas(46, 36);
    p.rect(0, 0, 46, 36, PAL.ink);
    p.frame(0, 0, 46, 36, lit ? PAL.white : R[1]);
    p.frame(1, 1, 44, 34, lit ? R[3] : PAL.ink);
    return p;
  });
}
