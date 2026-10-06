// Pixel text API (contract). The font agent implements the bitmap fonts behind it.
// STUB until then — throws so missing fonts are noticed.
import type Phaser from 'phaser';

/**
 * sm — small body font (card text, labels). md — bold UI font (buttons, names).
 * lg — md at 2× (banners, LP numbers). xl — md at 3× (DÜELLO!, KAZANDIN).
 */
export type TextSize = 'sm' | 'md' | 'lg' | 'xl';

export interface TextOpts {
  size?: TextSize;
  /** Fill color 0xRRGGBB (default PAL.white). */
  color?: number;
  /** 1px dark outline around glyphs (default true) — keeps text readable over busy art. */
  outline?: boolean;
  align?: 'left' | 'center' | 'right';
  /** Word-wrap width in pixels (unscaled game pixels). */
  maxWidth?: number;
  /** Phaser origin; default (0, 0). */
  originX?: number;
  originY?: number;
}

/** Called once from BootScene (src/boot/10-fonts.ts). */
export function registerFonts(_scene: Phaser.Scene): void {
  throw new Error('fonts not implemented');
}

/** Create crisp pixel text. Supports Turkish letters (ç ğ ı İ ö ş ü Ç Ğ Ö Ş Ü). */
export function pixelText(_scene: Phaser.Scene, _x: number, _y: number, _text: string, _opts: TextOpts = {}): Phaser.GameObjects.BitmapText {
  throw new Error('fonts not implemented');
}

/** Size in game pixels of `text` rendered at `size` (after wrapping to maxWidth if given). */
export function measureText(_text: string, _size: TextSize = 'sm', _maxWidth?: number): { w: number; h: number } {
  throw new Error('fonts not implemented');
}
