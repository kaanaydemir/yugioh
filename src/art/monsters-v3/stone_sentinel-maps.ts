// Taş Muhafız v3 (A3 pilot, Y8) — hand-placed pixel maps of the RIGID parts (helm, pauldrons, the
// torso's masonry slabs, sabatons, tower shield, fist). Stone never bends: a map places its pixels
// better than any shading code, and the rig only moves it by whole pixels (REHBER IŞ-12).
//
// The *_P1 maps are cut 1:1 out of the approved still (src/still/sentinel-map.ts, lit from the frame's
// top-left = player 1): composed at rest they ARE the still. Each map also carries
//   - EXTENSIONS: pixels hidden at rest under a part in front (the chest under the helm and the near
//     pauldron, the courses under the chest plate's overhang, the far side under the shield, the shins
//     under the tassets) so that a part moving by a pixel never opens a hole;
//   - FRINGES ('x' 'y' 'w' 'v'): the contact crease a part lays on whatever is behind it (IŞ-5), with
//     the still's tone: drawn only over pixels already there, never past the silhouette, and at least
//     one ramp step darker than the surface it falls on (see parts: fringe()).
// The *_P2 maps are the same parts repainted for player 2's relit sheet (key light at the frame's
// top-RIGHT, shown flipped): the same plates, carvings, cuts and creases, with the lit and the shaded
// planes swapped plate by plate (IŞ-2). Light (eye slit, chest ᛉ, shield Ψ) is not in the maps: the
// glow painters draw it after the outline, the same for both lights.
//
// Coordinates: v1 frame px (the still's). x / y = the map's top-left at rest; parts add OX / OY.
// Key: . empty | k ink | 0-4 stone0-4 | e f g h leaf0-3 | x y w v fringe (stone1 / stone0 / stone2 /
// stone3, "at least one step darker").

import { PAL } from '../palette';

export interface PartMap {
  readonly x: number;
  readonly y: number;
  readonly rows: readonly string[];
}
export interface MapPair {
  readonly left: PartMap;
  readonly right: PartMap;
}

export const KEY: Readonly<Record<string, number>> = Object.freeze({
  k: PAL.ink,
  '0': PAL.stone0,
  '1': PAL.stone1,
  '2': PAL.stone2,
  '3': PAL.stone3,
  '4': PAL.stone4,
  e: PAL.leaf0,
  f: PAL.leaf1,
  g: PAL.leaf2,
  h: PAL.leaf3,
});
/** Fringe letters → their explicit tone. */
export const FRINGE: Readonly<Record<string, number>> = Object.freeze({ x: PAL.stone1, y: PAL.stone0, w: PAL.stone2, v: PAL.stone3 });

// ------------------------------------------------------------------ P1 (cut from the still; key light at the frame's top-left)

// ------------------------------------------------------------------ P1 (cut from the still; key light at the frame's top-left)

// prettier-ignore
const HELM_P1: PartMap = { x: 25, y: 14, rows: [
  '..hhg.......', // 14
  '.hgggf443...', // 15
  '.ggff333221.', // 16
  '.ff22333221.', // 17
  '422333332211', // 18
  '433333332211', // 19
  '400000000000', // 20
  '433333331111', // 21
  '433333332211', // 22
  '433333332211', // 23
  '433333332211', // 24
  '222222221111', // 25
] };

// prettier-ignore
const PAULDRON_N_P1: PartMap = { x: 9, y: 20, rows: [
  '....hhg.......', // 20
  '...hggghhg....', // 21
  '..hgggggggf...', // 22
  '..ggffggff33..', // 23
  '..ff33ff33322.', // 24
  '..333333222111', // 25
  '.4333333222111', // 26
  '.4333333222111', // 27
  '43333332222111', // 28
  '43333322222111', // 29
  '.3332222222111', // 30
  '..111111111111', // 31
  'xxxxxxxxxxxxxx', // 32
  '.wwxxxxxxxxxxx', // 33
] };

// prettier-ignore
const PAULDRON_F_P1: PartMap = { x: 36, y: 21, rows: [
  '.....hhg.....', // 21
  '....hgggf....', // 22
  '....gff333...', // 23
  '....f333222..', // 24
  '222222221111.', // 25
  '222122221111.', // 26
  '222122221111.', // 27
  '2221222211111', // 28
  '2221222211111', // 29
  '2221222211111', // 30
  '0000000000...', // 31
] };

// prettier-ignore
const CHEST_P1: PartMap = { x: 16, y: 23, rows: [
  '..........2222222211.......', // 23 (under the helm at rest: the front face, shown when the helm rears back)
  '..........2222222211.......', // 24
  '33333331111111222221100....', // 25
  '33333331111111000000000....', // 26
  '33333332222222000000011....', // 27
  '33333333333333001010311....', // 28
  '33333333333333001010311....', // 29
  '33333333333333010001311....', // 30
  '33333333333333011011311....', // 31
  '3333333333333301101131100..', // 32
  '333333333333330333333110000', // 33
  '.33333333333332222222110000', // 34
  '.33333333333332222222110.00', // 35
] };

// prettier-ignore
const ABDOMEN_P1: PartMap = { x: 16, y: 34, rows: [
  '..111111111111000000000....', // 34
  '..111111111111000000000....', // 35
  '111111111111110000000001000', // 36
  '..1222222222221111100001000', // 37
  '..1333333333332212211111000', // 38
  '...133333333332212211111000', // 39
  '...133333333332212211111000', // 40
  '....12222222221111100001000', // 41
  '....13333333332222210111000', // 42
  '.....1333333332222210111000', // 43
  '.....1333333332222210111000', // 44
  '.....1333333332222210111000', // 45
  '.....1333333332222210111000', // 46
] };

// prettier-ignore
const BELT_P1: PartMap = { x: 20, y: 44, rows: [
  '...........3333........', // 44
  '11111111110322100001000', // 45
  '11111111110322100001000', // 46
  '00000000000111100000000', // 47
] };

// prettier-ignore
const TASSETS_P1: PartMap = { x: 18, y: 46, rows: [
  '..1111111111111111111....', // 46
  '..1111111111111111111....', // 47
  '.222222111111000000001000', // 48
  '.333333122222222011111111', // 49
  '3333333122222222011111111', // 50
  '3333333122222222011111111', // 51
  '3333333122222222011111111', // 52
  '.333333122222222011111111', // 53
  '.222222111111111000000000', // 54
] };

// prettier-ignore
const LEG_N_P1: PartMap = { x: 17, y: 51, rows: [
  '...1111111...', // 51
  '...1111111...', // 52
  '...1111111...', // 53
  '...1111111...', // 54
  '...1111111...', // 55
  '4444444332...', // 56
  '33333333322..', // 57
  '222222222221.', // 58
  '222222222221.', // 59
  '1111111111111', // 60
] };

// prettier-ignore
const LEG_F_P1: PartMap = { x: 32, y: 51, rows: [
  '.000000....', // 51
  '.000000....', // 52
  '.000000....', // 53
  '.000000....', // 54
  '..111111111', // 55
  '22222222222', // 56
  '22222222222', // 57
  '11111111111', // 58
  '11111111111', // 59
  '00000000000', // 60
] };

// prettier-ignore
const SHIELD_P1: PartMap = { x: 39, y: 33, rows: [
  '.yhhhhgg444444.', // 33
  '.ygggff44444444', // 34
  '.gff33333333311', // 35
  'yff333333333311', // 36
  'y43311111113311', // 37
  'y43312222223311', // 38
  'y43312222223311', // 39
  'y43312222223311', // 40
  'y43310202023311', // 41
  'y43310202023311', // 42
  'y43312000223311', // 43
  'y43312202223311', // 44
  'y43312202223311', // 45
  'y43312202223311', // 46
  'y43312202223311', // 47
  'y43312202223311', // 48
  'y43312222223311', // 49
  'y43012222223311', // 50
  'y43012222223311', // 51
  'y43303222223311', // 52
  'y43303222223311', // 53
  'y43310322223311', // 54
  'y43310322223311', // 55
  'y43312032223311', // 56
  'y43312032223311', // 57
  'yh3h33333333311', // 58
  'yhggg333333331.', // 59
  'ygfff22222222..', // 60
] };

// The hanging fist (from the still). Its top row is the wrist (hidden under the bracer at rest: it shows
// when the fist hangs a pixel lower), the next the bracer's crease: the map is used while the fist hangs under the bracer.
// prettier-ignore
const FIST_HANG_P1: PartMap = { x: 9, y: 44, rows: [
  '.1111111.', // 44
  '221111111', // 45
  '.33322211', // 46
  '..3322211', // 47
  '..3322211', // 48
  '..2221111', // 49
  '...11111.', // 50
] };

// ------------------------------------------------------------------ P2 (repainted; key light at the frame's top-right)

// prettier-ignore
const HELM_P2: PartMap = { x: 25, y: 14, rows: [
  '..ghh.......', // 14
  '.fgggh334...', // 15
  '.ggff222334.', // 16
  '.ff11222334.', // 17
  '111222223334', // 18
  '122222223334', // 19
  '100000000000', // 20
  '122222222222', // 21
  '122222223334', // 22
  '122222223334', // 23
  '122222223334', // 24
  '111111112222', // 25
] };

// prettier-ignore
const PAULDRON_N_P2: PartMap = { x: 9, y: 20, rows: [
  '....ghh.......', // 20
  '...ggghghh....', // 21
  '..fgggggggh...', // 22
  '..ggffggff34..', // 23
  '..ff33ff33334.', // 24
  '..111111222333', // 25
  '.1111111222334', // 26
  '.1111111222334', // 27
  '11111112222334', // 28
  '11111122222334', // 29
  '.1112222222333', // 30
  '..111111111111', // 31
  'xxxxxxxxxxxxxx', // 32
  '.wwxxxxxxxxxxx', // 33
] };

// prettier-ignore
const PAULDRON_F_P2: PartMap = { x: 36, y: 21, rows: [
  '.....ghh.....', // 21
  '....fgggh....', // 22
  '....gff333...', // 23
  '....f333334..', // 24
  '222222223333.', // 25
  '222122223333.', // 26
  '222122223333.', // 27
  '2221222233333', // 28
  '2221222233333', // 29
  '2221222233333', // 30
  '0000000000...', // 31
] };

// prettier-ignore
const CHEST_P2: PartMap = { x: 16, y: 23, rows: [
  '..........2222222233.......', // 23 (under the helm at rest: the front face, shown when the helm rears back)
  '..........2222222233.......', // 24
  '22222220000000222223311....', // 25
  '22222220000000111111111....', // 26
  '22222221111111000000033....', // 27
  '22222222222222301010133....', // 28
  '22222222222222301010133....', // 29
  '22222222222222310001133....', // 30
  '22222222222222311011133....', // 31
  '2222222222222231101113311..', // 32
  '222222222222223333333331111', // 33
  '.22222222222223333333331111', // 34
  '.22222222222223333333331.11', // 35
] };

// prettier-ignore
const ABDOMEN_P2: PartMap = { x: 16, y: 34, rows: [
  '..000000000000111111111....', // 34
  '..000000000000111111111....', // 35
  '000000000000001111100002111', // 36
  '..1111111111112222211112111', // 37
  '..1222222222223323322222111', // 38
  '...122222222223323322222111', // 39
  '...122222222223323322222111', // 40
  '....11111111112222211112111', // 41
  '....12222222223333321222111', // 42
  '.....1222222223333321222111', // 43
  '.....1222222223333321222111', // 44
  '.....1222222223333321222111', // 45
  '.....1222222223333321222111', // 46
] };

// prettier-ignore
const BELT_P2: PartMap = { x: 20, y: 44, rows: [
  '...........3333........', // 44
  '00000000001133200002111', // 45
  '00000000001133200002111', // 46
  '00000000000111100000000', // 47
] };

// prettier-ignore
const TASSETS_P2: PartMap = { x: 18, y: 46, rows: [
  '..0000000000000000000....', // 46
  '..0000000000000000000....', // 47
  '.111111222222111111112111', // 48
  '.222222133333333122222222', // 49
  '2222222133333333122222222', // 50
  '2222222133333333122222222', // 51
  '2222222133333333122222222', // 52
  '.222222133333333122222222', // 53
  '.111111222222222111111111', // 54
] };

// prettier-ignore
const LEG_N_P2: PartMap = { x: 17, y: 51, rows: [
  '...1111111...', // 51
  '...1111111...', // 52
  '...1111111...', // 53
  '...1111111...', // 54
  '...1111111...', // 55
  '2334444444...', // 56
  '22333333333..', // 57
  '122222222223.', // 58
  '122222222223.', // 59
  '1111111111111', // 60
] };

// prettier-ignore
const LEG_F_P2: PartMap = { x: 32, y: 51, rows: [
  '.000000....', // 51
  '.000000....', // 52
  '.000000....', // 53
  '.000000....', // 54
  '..111111111', // 55
  '22222222222', // 56
  '22222222222', // 57
  '11111111111', // 58
  '11111111111', // 59
  '00000000000', // 60
] };

// prettier-ignore
const SHIELD_P2: PartMap = { x: 39, y: 33, rows: [
  '.ygghhhh444444.', // 33
  '.yffggg44444444', // 34
  '.ffg33333333334', // 35
  'yfg333333333334', // 36
  'y13311111113334', // 37
  'y13332222213334', // 38
  'y13332222213334', // 39
  'y13332222213334', // 40
  'y13330202013334', // 41
  'y13330202013334', // 42
  'y13332000213334', // 43
  'y13332202213334', // 44
  'y13332202213334', // 45
  'y13332202213334', // 46
  'y13332202213334', // 47
  'y13332202213334', // 48
  'y13332222213334', // 49
  'y13032222213334', // 50
  'y13032222213334', // 51
  'y13303222213334', // 52
  'y13303222213334', // 53
  'y13330222213334', // 54
  'y13330222213334', // 55
  'y13333022213334', // 56
  'y13333022213334', // 57
  'yg3h33333333334', // 58
  'ygggh333333333.', // 59
  'yfffg22222222..', // 60
] };

// prettier-ignore
const FIST_HANG_P2: PartMap = { x: 9, y: 44, rows: [
  '.1111111.', // 44
  '111111122', // 45
  '.11122233', // 46
  '..1122233', // 47
  '..1122233', // 48
  '..1111222', // 49
  '...11111.', // 50
] };

const pair = (left: PartMap, right: PartMap): MapPair => Object.freeze({ left, right });

export const HELM = pair(HELM_P1, HELM_P2);
export const PAULDRON_N = pair(PAULDRON_N_P1, PAULDRON_N_P2);
export const PAULDRON_F = pair(PAULDRON_F_P1, PAULDRON_F_P2);
export const CHEST = pair(CHEST_P1, CHEST_P2);
export const ABDOMEN = pair(ABDOMEN_P1, ABDOMEN_P2);
export const BELT = pair(BELT_P1, BELT_P2);
export const TASSETS = pair(TASSETS_P1, TASSETS_P2);
export const LEG_N = pair(LEG_N_P1, LEG_N_P2);
export const LEG_F = pair(LEG_F_P1, LEG_F_P2);
export const SHIELD = pair(SHIELD_P1, SHIELD_P2);
export const FIST_HANG = pair(FIST_HANG_P1, FIST_HANG_P2);

// ------------------------------------------------------------------ light cells (v1 px at rest)

/** The eye slit's burning cells (row 20, x 30-36) with their weight: the still's gold2 → gold3 → gold4 core → gold3. */
export const SLIT: readonly (readonly [x: number, y: number, w: number])[] = Object.freeze([
  [30, 20, 0.5], [31, 20, 0.5], [32, 20, 1], [33, 20, 1], [34, 20, 2], [35, 20, 2], [36, 20, 1],
] as const);
/** The chest ᛉ: [x, y, stem] — the stem burns one step hotter. */
export const RUNE: readonly (readonly [x: number, y: number, stem: 0 | 1])[] = Object.freeze([
  [31, 28, 0], [35, 28, 0], [31, 29, 0], [35, 29, 0], [32, 30, 0], [34, 30, 0],
  [33, 28, 1], [33, 29, 1], [33, 30, 1], [33, 31, 1], [33, 32, 1],
] as const);
/** The shield Ψ grooves: [x, y, stem]. */
export const SRUNE: readonly (readonly [x: number, y: number, stem: 0 | 1])[] = Object.freeze([
  [44, 41, 0], [48, 41, 0], [44, 42, 0], [48, 42, 0], [45, 43, 0], [47, 43, 0],
  [46, 41, 1], [46, 42, 1], [46, 43, 1], [46, 44, 1], [46, 45, 1], [46, 46, 1], [46, 47, 1], [46, 48, 1],
] as const);
