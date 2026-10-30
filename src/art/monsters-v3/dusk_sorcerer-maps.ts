// Akşam Büyücüsü v3 — hand-placed pixel maps of the small RIGID details (face, beard, gloves, boots). They
// move by whole pixels only (IŞ-12). Painted for the P1 light (top-left); under the P2 relight the rig's
// stampMap swaps the lit / shade letters (4↔2, m↔n, Q↔F, q↔f, d↔b, G↔h) plane by plane (IŞ-2).
//
// Key: . empty | k ink | 0-4 night0-4 | s steel | m mist | n night4 | w white | a-e void0-4 | g gold2 | G gold3
//      h gold1 | u gold4 | f-F-q-Q skin0-3 (x = nothing: the rig paints eyes as light, after the outline)

export interface PartMap {
  readonly rows: readonly string[];
  readonly ox: number;
  readonly oy: number;
}
export type HandKind = 'open' | 'fist' | 'claw' | 'slam' | 'loose' | 'point';

/** Face under the brim: anchor = the head point (hx, hy); eye row is y = hy − 2 (the rig paints the eyes as light). */
export const FACE: PartMap = {
  ox: -3,
  oy: -3,
  rows: [
    'aaaaaaaaaaa.',
    '0aaaaaaaaaa0',
    '.QQqqqFFFF..',
    '.QQqqqFFFFF.',
    '..QqqqFFFF..',
    '...QqqFFF...',
    '....qFF.....',
  ],
};

/** Silver beard: hangs from the chin, sways with pose.beard. */
export const BEARD: PartMap = {
  ox: -3,
  oy: 2,
  rows: [
    '..smmmmmsss.',
    '...mmmmmssn.',
    '...mmmmssnn.',
    '....mmmssn..',
    '....mmssnn..',
    '.....mssn...',
    '.....msnn...',
    '......sn....',
  ],
};

/** Gloves (moon-silver): anchor = the palm centre. */
export const HANDS: Record<HandKind, PartMap> = {
  open: {
    ox: -4,
    oy: -3,
    rows: ['.m..m.m..', '.mmmmmmss', 'msssssss3', '.3ssss33.', '..3333...'],
  },
  claw: {
    ox: -4,
    oy: -4,
    rows: ['m.m.m.m..', 'mmmmmmmss', '.mssssss3', '.3sssss3.', '..3333...'],
  },
  fist: {
    ox: -3,
    oy: -3,
    rows: ['.mmmms.', 'mmsssss', 'msssss3', '.3sss3.', '..333..'],
  },
  point: {
    ox: -3,
    oy: -3,
    rows: ['....mmm', '.mmmmss', 'msssss3', '.3sss3.', '..333..'],
  },
  slam: {
    ox: -5,
    oy: -2,
    rows: ['.mmmmmmmmm.', 'msssssssss3', '.3sssssss3.', '..3333333..'],
  },
  loose: {
    ox: -3,
    oy: -2,
    rows: ['.msss..', 'mssss3.', '.3sss3.', '..33...'],
  },
};

/** Near boot, pointed toe to the right: anchor = the toe tip's lowest point. */
export const BOOT_F: PartMap = {
  ox: -10,
  oy: -9,
  rows: [
    '..222333...',
    '..222333...',
    '..2433333..',
    '..2433333..',
    '..24333g...',
    '.243333mm..',
    '24333333mm.',
    '1222221111.',
  ],
};

/** Far boot (in shade): anchor = the toe tip. */
export const BOOT_B: PartMap = {
  ox: -9,
  oy: -7,
  rows: [
    '..11222...',
    '..11222...',
    '..11222...',
    '..122.....',
    '.1222222m.',
    '12222222mm',
    '1111111111',
  ],
};
