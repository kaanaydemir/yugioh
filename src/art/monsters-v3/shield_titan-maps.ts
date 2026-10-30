// Kalkan Devi v3 — the hand-placed pixel maps of the giant's RIGID parts that show past the shield: the near
// pauldron (a dome of three lames), the gauntlet wrapped round the rim, the breastplate / belt / tasset
// slice at the shield's left edge, the near sabaton and the helm's face behind the sight slot. Plate never
// bends: a map places its pixels better than any shading code, and the rig only moves it by WHOLE pixels
// (REHBER IŞ-12). Authored for the P1 light (top-left); a P2 sheet exchanges the lit and the shaded tones
// plate by plate (shield_titan-kit.ts relitChar), the geometry is the same.
//
// Key: see shield_titan-kit.ts. Coordinates: frame px (x, y = the map's top-left at rest).

export interface PartMap {
  readonly x: number;
  readonly y: number;
  readonly rows: readonly string[];
}

// prettier-ignore
export const PAULDRON: PartMap = { x: 12, y: 24, rows: [
  '....T...........',
  '....H...........',
  '...HLM..........',
  '....TTTT........',
  '..TTHHHHLLMM....',
  '.THHHHLLLLLMMS..',
  'THHHL3LLLLLMMMSS',
  'HHLLLLLLLLLMM3SD',
  'HLLLLLLLLLMMMMSD',
  'LLLLLLLLLMMMMSSD',
  'lllllllllllllllm',
  'lmmmmmmmmmmsssss',
  'DDDDDDDDDDDDDDDD',
  'HLLLLLLLLLMMMMSS',
  'HLL3LLLLLLMMM3SD',
  'LLLLLLLLLMMMMSSD',
  'lllllllllllllllm',
  'DSSSSSSSSSSSSSSD',
  '.DDDDDDDDDDDDDD.',
] };

// prettier-ignore
export const GAUNTLET: PartMap = { x: 21, y: 46, rows: [
  '..THHHHHT...',
  '.HLLLLLLMS..',
  'HLL4LLL4MSS.',
  'DDDDDDDDDDD.',
  'HLLLLLLLMSS.',
  'DDDDDDDDDDD.',
  'HLLLLLLLMSS.',
  'DDDDDDDDDDD.',
  '.LLLLLLLMS..',
  '..SSSSSSS...',
] };
/** The gauntlet's centre in its map (the hand point). */
export const GAUNTLET_C: readonly [number, number] = [5, 5];

/** The closed fist (hanging / raised): no rim to wrap, knuckles forward. */
// prettier-ignore
export const FIST: PartMap = { x: 0, y: 0, rows: [
  '.THHHHHT.',
  'HLLLLLLMS',
  'HL4LLL4MS',
  'DDDDDDDDD',
  'HLLLLLLMS',
  'DDDDDDDDD',
  'HLLLLLLMS',
  '.SSSSSSD.',
] };

// prettier-ignore
export const CHEST: PartMap = { x: 16, y: 38, rows: [
  'LLLLLMMMMMMSS',
  'LLLLLMMMMMMSS',
  'LLLLLMMMMMMSS',
  'HLLLLMMMMMMSD',
  'HLLL4LLMMM4SD',
  'HLLLLLLMMMMSD',
  'DDDDDDDDDDDDD',
  'HLLLLLMMMMMSD',
  'HLLLLLMMMMMSD',
  'HLLLLLMMMMMSD',
  'HLLLLLMMMMMSD',
  'SSSSSSSSSSSSS',
  'DDDDDDDDDDDDD',
  'lllllllmmmmss',
  'lllllllmmmmss',
] };

// prettier-ignore
export const BELT: PartMap = { x: 16, y: 53, rows: [
  'lllllllmmmmss',
  'lllll44mmmmss',
  'llll4334mmmss',
  'lllll44mmmmss',
  'smmmmmmmsssss',
  'DDDDDDDDDDDDD',
] };

// prettier-ignore
export const TASSETS: PartMap = { x: 16, y: 59, rows: [
  'HLLLLMMMMMMSD',
  'HLLLLMMMMMMSD',
  'HLLLLMMMMMMSD',
  'lllllllmmmmss',
  'DSSSSSSSSSSSD',
  '.HLLLLMMMMSD.',
  '.HLLLLMMMMSD.',
  '.hhhhhhhhhhs.',
  '..DDDDDDDDD..',
] };

// prettier-ignore
export const SABATON: PartMap = { x: 13, y: 65, rows: [
  '.....DDDDDD....',
  '....HLLLLMMS...',
  '....HLLLLMMS...',
  '...HLLLLLLMMS..',
  '..HLLLLLLLLMMSD',
  '.HLLLLLLLLLLMMS',
  'HLLLLLLLLLLLMMS',
  'DDDDDDDDDDDDDDD',
] };

/** The visor behind the sight slot (11 × 5), authored for the P1 light; the eyes are light, drawn after the outline. */
// prettier-ignore
export const VISOR: PartMap = { x: 4 + 27, y: 10 + 19, rows: [
  'HMMMMMMMMMS',
  'Mvvvvvvvvvv',
  'Mvvvvvvvvvv',
  'Mvvvvvvvvvv',
  'DSSSSSSSSSD',
] };
