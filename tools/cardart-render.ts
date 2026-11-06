// Card-art v3 render CLI (lane E tooling): paints a CardArtV3 picture (src/art/cardart-v3/_types.ts) in
// Node exactly like the game does (src/art/cardart-v3/_kit.ts renderArt: three layers, flattened) and
// writes review PNGs + the style-sheet numbers (docs/v3/KART_RESIMLERI.md §9–10).
//
//   npx vite-node tools/cardart-render.ts -- --id <cardId> [options]
//   npx vite-node tools/cardart-render.ts -- --painter <file.ts> [options]
//
//   --id ID          card id: renders src/art/cardart-v3/<ID>.ts (its default export)
//   --painter FILE   any module whose default export is a CardArtV3 (a draft, a variant); id = art.id
//   --out DIR        output directory (default shots/e/cardart/<id>/)
//   --frames N       living-art strips with N frames (default: the art's own `frames`; strips are always
//                    written when the art has > 1 frame; --frames 1 turns them off)
//   --frame F        which frame the stills / mocks / stats use (default 0)
//   --json-only      only print / write the numbers (no PNGs)
//   --quiet          no table on stdout (the JSON is still written)
//   --help           this text
//
// Files (in DIR):
//   overview.png       ONE sheet to look at first: big ×3 | small ×6 | inspect mock ×2 | hand mock ×4,
//                      each labelled, on PAL.night0
//   big-x1/x2/x3.png   the 88×68 picture (1:1 is how the 2× card shows it)
//   small-x1/x2/x3/x6.png   the 44×34 hand picture (judge it at x1!)
//   layers-big.png / layers-small.png   backdrop | subject | light | composite (×3 / ×6), transparent
//                      pixels on a 2-tone grey check so the layer holes are visible
//   inspect.png        the inspect-panel mock at 1:1 game pixels: the 2× v3 face (paintFaceV3 ×2) with the
//                      BIG art 1:1 in its window, beside the name in the game font, on a v3-like panel;
//                      inspect-x2.png the same ×2
//   hand.png           the 1× v3 face (paintFaceV3 with the small art) in a row of three on the night
//                      floor, 1:1; hand-x4.png ×4
//   frames-big.png / frames-small.png   (living art) every frame ×3 / ×6 with its index + Δpx header
//   stats.json         numbers below for big and small (+ per frame), the thresholds and the flags
//
// Numbers (artStats of the kit, per size): colors / backdropColors / subjectColors (IŞ-11: ≤ 20 / ≤ 6),
// offPalette (not a PAL tone or not opaque — must be 0), isolated / subjectIsolated (IŞ-10: ≤ 0.10),
// checker (2×2 checkerboards, a dither detector: ≤ 0.5 % of the visible window), subjectFill (bbox /
// visible window: 0.60–0.75, big) and subjectCover, outlineInk (silhouette pixels that are PAL.ink: ≥ 0.9), focusOk (focus inside the
// focus box), lead (air in front of the head), brightOff (bright centroid → focus distance), plus
// smallAuto (the painter has no hand-made small(): a DRAFT), smallVsBig (value-layout correlation of
// the small vs. the big's 2:1 reduction: ≳ 0.75 = same composition; not flagged with focusSmall = a crop) and per-frame Δ pixels.
// A line starting "FLAG" is printed for every number outside its budget.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { PixelCanvas } from '../src/art/pixel';
import { PAL } from '../src/art/palette';
import { drawGlyph, getFont, hasGlyph } from '../src/art/font';
import type { CardArtV3, ArtLayers } from '../src/art/cardart-v3/_types';
import { ART_BIG, ART_SMALL, BACKDROP_COLORS_MAX, COLORS_MAX, ISOLATED_MAX, SUBJECT_FILL } from '../src/art/cardart-v3/_types';
import { artStats, diffRatio, reduce2x, renderArt, valueLayoutMatch, type ArtStats } from '../src/art/cardart-v3/_kit';
import { ART_X, ART_Y, paintFaceV3 } from '../src/art/cardface-v3/frame';
import { cardDef, type CardId } from '../src/data/cards';

/** §10: 2×2 checkerboards ≤ 0.5 % of the visible window (still frames sit at 0.2–0.3 %). */
const CHECKER_MAX = 0.005;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// ---------------------------------------------------------------- args

const argv = process.argv.slice(2).filter((a) => a !== '--');
const opts: Record<string, string> = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) continue;
  const k = a.slice(2);
  opts[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
}
if (opts.help || (!opts.id && !opts.painter)) {
  const out: string[] = [];
  for (const l of fs.readFileSync(new URL(import.meta.url).pathname, 'utf8').split('\n')) {
    if (!l.startsWith('//')) break;
    out.push(l.replace(/^\/\/ ?/, ''));
  }
  console.log(out.join('\n'));
  process.exit(opts.help ? 0 : 2);
}

const file = opts.painter ? path.resolve(process.cwd(), opts.painter) : path.join(ROOT, 'src/art/cardart-v3', `${opts.id}.ts`);
if (!fs.existsSync(file)) {
  console.error(`no painter file: ${file}`);
  process.exit(2);
}
const artMod = ((await import(pathToFileURL(file).href)) as { default?: CardArtV3 }).default;
if (!artMod || typeof artMod.big !== 'function') {
  console.error(`${file}: the default export is not a CardArtV3`);
  process.exit(2);
}
const art: CardArtV3 = artMod;
const id = art.id as CardId;
if (opts.id && opts.id !== id) console.warn(`warning: --id ${opts.id} but the painter's id is ${id}`);
const OUT = path.resolve(ROOT, opts.out ?? `shots/e/cardart/${id}`);
const FRAME = Number(opts.frame ?? 0);
const NFRAMES = Math.max(1, Number(opts.frames ?? art.frames ?? 1));
const PNG = opts['json-only'] !== 'true';
const QUIET = opts.quiet === 'true';
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- PNG (tiny encoder, node zlib)

const CRC_T = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc(b: Buffer): number {
  let c = 0xffffffff;
  for (const v of b) c = CRC_T[(c ^ v) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(t: string, d: Buffer): Buffer {
  const l = Buffer.alloc(4);
  l.writeUInt32BE(d.length);
  const td = Buffer.concat([Buffer.from(t, 'ascii'), d]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([l, td, c]);
}
/** `p` ×k (nearest) as an RGBA PNG; transparent pixels get `bg` (null: stay transparent; 'check': grey check). */
function writePng(name: string, p: PixelCanvas, k = 1, bg: number | null | 'check' = null): void {
  if (!PNG) return;
  const W = p.w * k;
  const H = p.h * k;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const sx = Math.floor(x / k);
      const sy = Math.floor(y / k);
      let c = p.get(sx, sy);
      let alpha = 255;
      if (c === null || p.alpha(sx, sy) === 0) {
        if (bg === 'check') c = ((sx >> 1) + (sy >> 1)) & 1 ? 0x5a5a62 : 0x6e6e78;
        else if (bg === null) {
          alpha = 0;
          c = 0;
        } else c = bg;
      }
      const i = y * (W * 4 + 1) + 1 + x * 4;
      raw[i] = (c >> 16) & 255;
      raw[i + 1] = (c >> 8) & 255;
      raw[i + 2] = c & 255;
      raw[i + 3] = alpha;
    }
  }
  const ih = Buffer.alloc(13);
  ih.writeUInt32BE(W, 0);
  ih.writeUInt32BE(H, 4);
  ih[8] = 8;
  ih[9] = 6;
  fs.writeFileSync(
    path.join(OUT, name),
    Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]),
  );
}

// ---------------------------------------------------------------- canvas helpers (game font)

const FONT = getFont('sm');
const TEXT_H = FONT.def.cellH;
function text(p: PixelCanvas, x: number, y: number, s: string, c: number): number {
  let pen = x;
  for (const raw of s) {
    const ch = hasGlyph(raw) ? raw : '?';
    const g = FONT.glyphs.get(ch.charCodeAt(0));
    if (!g) continue;
    drawGlyph(p, g, TEXT_H, pen, y, c);
    pen += g.w + 1;
  }
  return pen - x;
}
function scaled(p: PixelCanvas, k: number): PixelCanvas {
  return k === 1 ? p.clone() : p.scaled(k);
}
/** Transparent pixels of `p` replaced by the grey check (for layer views). */
function checked(p: PixelCanvas): PixelCanvas {
  const o = new PixelCanvas(p.w, p.h);
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const c = p.get(x, y);
      o.set(x, y, c !== null && p.alpha(x, y) > 0 ? c : ((x >> 1) + (y >> 1)) & 1 ? 0x5a5a62 : 0x6e6e78);
    }
  return o;
}
function delta(a: PixelCanvas, b: PixelCanvas): number {
  return Math.round(diffRatio(a, b) * a.w * a.h);
}

/** Lay out labelled cells in a row on PAL.night0. */
function sheet(cells: { label: string; img: PixelCanvas }[], gap = 6): PixelCanvas {
  const head = TEXT_H + 2;
  const W = cells.reduce((s, c) => s + c.img.w + gap, gap);
  const H = Math.max(...cells.map((c) => c.img.h)) + head + gap * 2;
  const p = new PixelCanvas(W, H);
  p.rect(0, 0, W, H, PAL.night0);
  let x = gap;
  for (const c of cells) {
    text(p, x, gap - 2, c.label, PAL.mist);
    p.blit(c.img, x, gap + head - 2);
    x += c.img.w + gap;
  }
  return p;
}
function stack(rows: PixelCanvas[]): PixelCanvas {
  const W = Math.max(...rows.map((r) => r.w));
  const H = rows.reduce((s, r) => s + r.h, 0);
  const p = new PixelCanvas(W, H);
  p.rect(0, 0, W, H, PAL.night0);
  let y = 0;
  for (const r of rows) {
    p.blit(r, 0, y);
    y += r.h;
  }
  return p;
}

// ---------------------------------------------------------------- mocks

/** The 1× v3 face with the small art (what the hand / picker / flying card shows). */
function face1(small: PixelCanvas): PixelCanvas {
  return paintFaceV3(id, small);
}

/**
 * The 2× card of the inspect panel: the face ×2 with the BIG art 1:1 inside the window's visible area (the
 * 2-px bezel ring stays the frame's, as at 1×).
 */
function face2(small: PixelCanvas, big: PixelCanvas): PixelCanvas {
  const f = face1(small).scaled(2);
  const v = ART_BIG.visible;
  for (let y = v.y0; y <= v.y1; y++)
    for (let x = v.x0; x <= v.x1; x++) {
      const c = big.get(x, y);
      if (c !== null) f.set(ART_X * 2 + x, ART_Y * 2 + y, c);
    }
  return f;
}

function inspectMock(small: PixelCanvas, big: PixelCanvas): PixelCanvas {
  const card = face2(small, big);
  const W = 232;
  const H = card.h + 16;
  const p = new PixelCanvas(W, H);
  // panel: ink outline, night1 body, night3 lit top/left, night0 inner well
  p.rect(0, 0, W, H, PAL.night1);
  p.frame(0, 0, W, H, PAL.ink);
  p.hline(1, W - 2, 1, PAL.night3);
  p.vline(1, 1, H - 2, PAL.night3);
  p.hline(1, W - 2, H - 2, PAL.night0);
  p.vline(W - 2, 1, H - 2, PAL.night0);
  // card shadow + card
  p.rect(10, 10, card.w, card.h, PAL.ink);
  p.blit(card, 8, 8);
  // name + kind + greeked rule text
  const def = cardDef(id);
  const tx = card.w + 18;
  text(p, tx, 10, def.name, PAL.white);
  text(p, tx, 10 + TEXT_H + 2, def.kind === 'spell' ? 'BÜYÜ' : def.kind === 'trap' ? 'TUZAK' : 'CANAVAR', PAL.mist);
  p.hline(tx, W - 10, 10 + TEXT_H * 2 + 6, PAL.night3);
  for (let i = 0; i < 6; i++) {
    const y = 10 + TEXT_H * 2 + 12 + i * 6;
    const w = 90 - ((i * 37 + id.length * 11) % 34);
    p.rect(tx, y, w, 2, PAL.night3);
  }
  return p;
}

function handMock(small: PixelCanvas): PixelCanvas {
  const f = face1(small);
  const W = f.w * 3 + 4 * 6;
  const H = f.h + 16;
  const p = new PixelCanvas(W, H);
  p.rect(0, 0, W, H, PAL.night1);
  p.rect(0, H - 6, W, 6, PAL.night0);
  // the middle card lifted (hovered), its neighbours at rest
  for (let i = 0; i < 3; i++) {
    const x = 6 + i * (f.w + 6);
    const y = i === 1 ? 4 : 10;
    p.blit(f, x, y);
  }
  return p;
}

// ---------------------------------------------------------------- render + numbers

type Row = ArtStats & { auto?: boolean };
const r0 = renderArt(art, FRAME);
const statsBig: Row = artStats(r0.big, r0.bigPx, art.focus);
const smallFocus = art.focusSmall;
const statsSmall: Row = artStats(r0.small, r0.smallPx, smallFocus ?? art.focus, !!smallFocus);
const smallVsBig = valueLayoutMatch(r0.smallPx, reduce2x(r0.bigPx));

const frames: { f: number; bigDelta: number; smallDelta: number; bigIsolated: number; smallIsolated: number; bigColors: number; smallColors: number }[] = [];
const frameArts = [] as ReturnType<typeof renderArt>[];
for (let f = 0; f < NFRAMES; f++) {
  const r = f === FRAME ? r0 : renderArt(art, f);
  frameArts.push(r);
}
for (let f = 0; f < NFRAMES; f++) {
  const r = frameArts[f];
  const prev = frameArts[(f + NFRAMES - 1) % NFRAMES];
  const sb = artStats(r.big, r.bigPx, art.focus);
  const ss = artStats(r.small, r.smallPx, smallFocus ?? art.focus, !!smallFocus);
  frames.push({
    f,
    bigDelta: NFRAMES > 1 ? delta(r.bigPx, prev.bigPx) : 0,
    smallDelta: NFRAMES > 1 ? delta(r.smallPx, prev.smallPx) : 0,
    bigIsolated: +sb.isolated.toFixed(4),
    smallIsolated: +ss.isolated.toFixed(4),
    bigColors: sb.colors,
    smallColors: ss.colors,
  });
}

const flags: string[] = [];
function gate(size: string, s: ArtStats): void {
  if (s.offPalette > 0) flags.push(`${size}: ${s.offPalette} off-palette / non-opaque pixels (must be 0)`);
  if (s.colors > COLORS_MAX) flags.push(`${size}: ${s.colors} tones > ${COLORS_MAX} (IŞ-11)`);
  if (s.backdropColors > BACKDROP_COLORS_MAX) flags.push(`${size}: backdrop ${s.backdropColors} tones > ${BACKDROP_COLORS_MAX}`);
  if (s.isolated > ISOLATED_MAX) flags.push(`${size}: isolated ${s.isolated.toFixed(3)} > ${ISOLATED_MAX} (IŞ-10 noise)`);
  const g = size === 'big' ? ART_BIG : ART_SMALL;
  const vis = (g.visible.x1 - g.visible.x0 + 1) * (g.visible.y1 - g.visible.y0 + 1);
  if (s.checker / vis > CHECKER_MAX) flags.push(`${size}: ${s.checker} 2×2 checkerboards = ${((100 * s.checker) / vis).toFixed(2)} % of the window > ${CHECKER_MAX * 100} % (dither?)`);
  if (size === 'big' && (s.subjectFill < SUBJECT_FILL[0] || s.subjectFill > SUBJECT_FILL[1]))
    flags.push(`${size}: subject fill ${s.subjectFill.toFixed(2)} outside ${SUBJECT_FILL[0]}–${SUBJECT_FILL[1]} (fine if it bleeds off the bottom / back edge on purpose)`);
  if (s.outlineInk < 0.9) flags.push(`${size}: only ${(100 * s.outlineInk).toFixed(0)} % of the silhouette is ink (≥ 90 %)`);
  if (!s.focusOk) flags.push(`${size}: focus outside the focus box`);
  const far = size === 'big' ? 15 : 8;
  if (s.brightOff > far) flags.push(`${size}: bright centroid ${s.brightOff.toFixed(1)} px from the focus (look at it above ~${far})`);
}
gate('big', statsBig);
gate('small', statsSmall);
if (r0.auto) flags.push('small: AUTO (blind reduction, no hand-made small()) — a draft');
if (!smallFocus && smallVsBig < 0.75) flags.push(`small vs big value layout ${smallVsBig.toFixed(2)} < 0.75 (composition drifted)`);
for (const fr of frames) {
  if (fr.bigIsolated > ISOLATED_MAX) flags.push(`frame ${fr.f}: big isolated ${fr.bigIsolated}`);
  if (fr.smallIsolated > ISOLATED_MAX) flags.push(`frame ${fr.f}: small isolated ${fr.smallIsolated}`);
}

const round = (s: ArtStats) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === 'number' && !Number.isInteger(v) ? +v.toFixed(4) : v]));
const json = {
  id,
  file: path.relative(ROOT, file),
  frame: FRAME,
  frames: NFRAMES,
  holdMs: art.holdMs ?? 140,
  focus: art.focus,
  focusSmall: smallFocus ?? null,
  smallAuto: r0.auto,
  smallVsBig: +smallVsBig.toFixed(3),
  big: round(statsBig),
  small: round(statsSmall),
  perFrame: frames,
  budgets: { colorsMax: COLORS_MAX, backdropColorsMax: BACKDROP_COLORS_MAX, isolatedMax: ISOLATED_MAX, subjectFill: SUBJECT_FILL, checkerOfWindow: CHECKER_MAX, outlineInkMin: 0.9, smallVsBigMin: 0.75, offPalette: 0 },
  flags,
};
fs.writeFileSync(path.join(OUT, 'stats.json'), JSON.stringify(json, null, 2));

// ---------------------------------------------------------------- PNGs

if (PNG) {
  const big = r0.bigPx;
  const small = r0.smallPx;
  for (const k of [1, 2, 3]) writePng(`big-x${k}.png`, big, k, PAL.night0);
  for (const k of [1, 2, 3, 6]) writePng(`small-x${k}.png`, small, k, PAL.night0);
  const layerRow = (l: ArtLayers, pic: PixelCanvas, k: number) =>
    sheet([
      { label: 'backdrop', img: scaled(checked(l.backdrop), k) },
      { label: 'subject', img: scaled(checked(l.subject), k) },
      { label: 'light', img: scaled(checked(l.light), k) },
      { label: 'composite', img: scaled(pic, k) },
    ]);
  writePng('layers-big.png', layerRow(r0.big, big, 3));
  writePng('layers-small.png', layerRow(r0.small, small, 6));
  const insp = inspectMock(small, big);
  writePng('inspect.png', insp);
  writePng('inspect-x2.png', insp, 2);
  const hand = handMock(small);
  writePng('hand.png', hand);
  writePng('hand-x4.png', hand, 4);
  const tag = `${id}  f${FRAME}${r0.auto ? '  SMALL=AUTO' : ''}`;
  const ov = stack([
    sheet([
      { label: `big x3  ${tag}`, img: scaled(big, 3) },
      { label: 'small x6', img: scaled(small, 6) },
    ]),
    sheet([
      { label: 'inspect mock x2', img: scaled(insp, 2) },
      { label: 'hand mock x4', img: scaled(hand, 4) },
      { label: 'x1', img: small.clone() },
    ]),
  ]);
  writePng('overview.png', ov);
  if (NFRAMES > 1) {
    writePng('frames-big.png', sheet(frameArts.map((r, f) => ({ label: `f${f} d${frames[f].bigDelta}`, img: scaled(r.bigPx, 3) }))));
    writePng('frames-small.png', sheet(frameArts.map((r, f) => ({ label: `f${f} d${frames[f].smallDelta}`, img: scaled(r.smallPx, 6) }))));
  }
}

// ---------------------------------------------------------------- table

if (!QUIET) {
  const cols: [string, (s: ArtStats) => string][] = [
    ['tones', (s) => `${s.colors}/${s.backdropColors}bd`],
    ['offPal', (s) => String(s.offPalette)],
    ['isol', (s) => s.isolated.toFixed(3)],
    ['subjIsol', (s) => s.subjectIsolated.toFixed(3)],
    ['checker', (s) => String(s.checker)],
    ['fill', (s) => s.subjectFill.toFixed(2)],
    ['cover', (s) => s.subjectCover.toFixed(2)],
    ['inkOutl', (s) => s.outlineInk.toFixed(2)],
    ['focus', (s) => (s.focusOk ? 'ok' : 'OUT')],
    ['lead', (s) => (Number.isNaN(s.lead) ? '-' : String(s.lead))],
    ['brightOff', (s) => (Number.isNaN(s.brightOff) ? '-' : s.brightOff.toFixed(1))],
  ];
  console.log(`${id}  (${path.relative(ROOT, file)})  frame ${FRAME}/${NFRAMES}  small ${r0.auto ? 'AUTO (draft)' : 'hand-made'}  smallVsBig ${smallVsBig.toFixed(2)}`);
  console.log(['size  ', ...cols.map(([h]) => h.padStart(10))].join(''));
  for (const [n, s] of [['big', statsBig], ['small', statsSmall]] as const) console.log([n.padEnd(6), ...cols.map(([, f]) => f(s).padStart(10))].join(''));
  if (NFRAMES > 1) console.log('frames Δpx big: ' + frames.map((f) => f.bigDelta).join(' ') + '   small: ' + frames.map((f) => f.smallDelta).join(' '));
  for (const f of flags) console.log('FLAG ' + f);
  if (!flags.length) console.log('no flags');
  console.log(`→ ${path.relative(ROOT, OUT)}/ (overview.png first)`);
}
