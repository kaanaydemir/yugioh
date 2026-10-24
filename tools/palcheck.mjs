#!/usr/bin/env node
// Palette / white / band check of film frames (A56.0; docs/v3/A5_PLAN.md §1.1 G4–G5 and §6.4,
// docs/v3/A6_PLAN.md §6.3; REHBER EF-4, EF-14). Pure Node: reads the PNG frames that
// tools/shot.mjs --frames / tools/filmdiff.mjs write and measures, frame by frame, how much of the
// picture leaves the palette, how much is white, and whether a full-width band appears.
//
//   node tools/palcheck.mjs <frames dir | films dir | frame.png …> [options]
//
//   e.g. node tools/palcheck.mjs shots/v3/a56/baseline/a5films-0/spVolcano --clip 120,40,400,230
//        node tools/palcheck.mjs <run>/spVolcano --vs shots/v3/a56/baseline/a5films-0 --clip 120,40,400,230
//        node tools/palcheck.mjs <a6v3 run dir> --rules a6 --vs shots/v3/a56/baseline/a6v3films-0
//
// Inputs (several may be given):
//   - a directory of film frames fNNNN.png (shot.mjs --frames DIR, one film of a filmdiff base / run)
//   - a directory of such directories (a filmdiff base / run: <film>/fNNNN.png): one report per film
//   - PNG files (one "film" of those frames, in the order given)
//   The game time of a frame is index × every: every comes from the filmdiff.json manifest next to
//   the film when there is one, else from --every (else only the index is printed).
//
// Per frame (the reference frame is frame 0 of the film unless --ref says otherwise):
//   off       % of the pixels of the effect region (--clip; default the whole frame) whose RGB is not
//             exactly a PAL colour (src/art/palette.ts) — the measure of docs/v3/A5_PLAN.md §2.4
//   Δoff      off − off of the reference frame, in points (A5 §6.4: "≤ kare 0 + 1 puan")
//   white     % of the WHOLE frame's pixels that are white: every channel > 235 (EF-4: ≤ 1.5 %)
//   rowWhite  the whitest row of the whole frame: % of its pixels white (EF-4: no row > 60 %)
//   bands     rows of the whole frame whose most frequent single colour covers > 60 % (--solid) of
//             the row while that row's most frequent colour in the reference frame was another one:
//             a new full-width band or wash (EF-14, A6 §6.3 "hiçbir satırın %60'ından fazlası tek
//             renk değil"). Relative to the reference because the v3 arena itself has ~170 rows that
//             are > 60 % ink / night0 (the plain backdrop) in every frame. A row whose new colour is
//             darker than its reference colour (the backdrop under a lightDim going to ink / void0)
//             is counted as a darkRow instead (reported, never gated) unless --band-dark
//
// Gates (a film FAILS when a gated value is over its limit in any frame; exit code 2 if any film
// fails, 0 if all pass, 1 on bad arguments / unreadable PNGs). Which gates are on:
//   --rules a5   (default) A5 §6.4: Δoff ≤ 1 pt, off ≤ 50 %, white ≤ 1.5 %, rowWhite ≤ 60 %
//                (bands are reported, not gated)
//   --rules a6   A6 §6.3 (a6v3 films, the opening included): white ≤ 1.5 %, rowWhite ≤ 60 %,
//                bands = 0 (Δoff / off are reported, not gated)
//   --rules all  all five
//   Each limit can be set (which also turns that gate on) or turned off ("off"):
//   --max-delta N | --max-off N | --max-white N | --max-row-white N | --max-bands N
//   --vs DIR     regression mode: the same films (by name) of a base directory (a filmdiff base) are
//                measured the same way, and every gate becomes "≤ max(limit, the base film's value)":
//                no worse than the base, so what the base already does (an A2 dim, a cut-in band)
//                does not fail a lane. A film missing from DIR is gated on the plain limits.
//
// Options:
//   --clip x,y,w,h       the effect region (game pixels) for off / Δoff; white, rowWhite and bands
//                        always use the whole frame (EF-4 is about the whole screen)
//   --range a:b[:s]      only frames a … b−1 (step s) of every film (the reference stays frame 0
//                        unless --ref)
//   --ref N|FILE.png     the reference frame: an index into the film (default 0) or a PNG, e.g. the
//                        base's frame 0 (shots/v3/a56/baseline/a5films-0/<film>/f0000.png)
//   --solid 60           the share (%) that makes a row "one colour" for bands / darkRows
//   --band-dark          count rows that turn darker as bands too
//   --every MS           game ms between frames when there is no filmdiff.json manifest
//   --palette FILE       palette source (default src/art/palette.ts: every `name: 0xRRGGBB` of PAL)
//   --top N              list the N most frequent off-palette colours of each film's worst frame
//                        (default 5; 0 = none)
//   --json FILE          write every number (per film, per frame) as JSON
//   --quiet              per-film summary lines only (no per-frame table)
//   --help               this text
//
// The PNG decoder is filmdiff.mjs's (8-bit grey / grey+alpha / RGB / RGBA / palette, not interlaced).

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => (p.startsWith(ROOT + path.sep) ? path.relative(ROOT, p) : p);

// ---------------------------------------------------------------- args

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      o[k] = v;
    } else o._.push(a);
  }
  return o;
}

function printHelp() {
  const src = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n');
  const out = [];
  for (const l of src.slice(1)) {
    if (!l.startsWith('//')) break;
    out.push(l.replace(/^\/\/ ?/, ''));
  }
  console.log(out.join('\n'));
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

function usage(msg) {
  if (msg) console.error(`[palcheck] ${msg}`);
  console.error('usage: node tools/palcheck.mjs <frames dir | films dir | png …> [--rules a5|a6|all] [--vs BASEDIR] [--clip x,y,w,h] [--range a:b[:s]] [--ref N|png] [--max-delta N] [--max-off N] [--max-white N] [--max-row-white N] [--max-bands N] [--json FILE] [--quiet] | --help');
  process.exit(1);
}

/** Gate limits per rule set (null = reported, not gated). */
const RULES = {
  a5: { delta: 1, off: 50, white: 1.5, rowWhite: 60, bands: null },
  a6: { delta: null, off: null, white: 1.5, rowWhite: 60, bands: 0 },
  all: { delta: 1, off: 50, white: 1.5, rowWhite: 60, bands: 0 },
};
const RULESET = args.rules && args.rules !== 'true' ? args.rules : 'a5';
if (!RULES[RULESET]) usage(`--rules must be one of ${Object.keys(RULES).join(', ')}`);

/** A gate limit: the rule set's, or --max-<name> (a number turns the gate on, "off" turns it off). */
function limit(flag, def) {
  const v = args[flag];
  if (v === undefined) return def;
  if (v === 'off' || v === 'none' || v === 'false') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) usage(`--${flag} must be a number ≥ 0 or "off"`);
  return n;
}

const R = RULES[RULESET];
const LIM = {
  delta: limit('max-delta', R.delta),
  off: limit('max-off', R.off),
  white: limit('max-white', R.white),
  rowWhite: limit('max-row-white', R.rowWhite),
  bands: limit('max-bands', R.bands),
};
const SOLID = args.solid && args.solid !== 'true' ? Number(args.solid) : 60;
if (!Number.isFinite(SOLID) || SOLID <= 0 || SOLID > 100) usage('--solid must be a share in (0, 100]');
const CLIP = args.clip && args.clip !== 'true' ? args.clip.split(',').map((s) => Math.round(Number(s))) : null;
if (CLIP && (CLIP.length !== 4 || CLIP.some((v) => !Number.isFinite(v)) || CLIP[2] <= 0 || CLIP[3] <= 0)) usage('--clip must be x,y,w,h');
const RANGE = args.range && args.range !== 'true' ? args.range.split(':').map(Number) : null;
if (RANGE && (RANGE.length < 2 || RANGE.some((v) => !Number.isFinite(v)))) usage('--range must be a:b or a:b:s');
const TOP = args.top !== undefined ? Math.max(0, Math.floor(Number(args.top)) || 0) : 5;
const QUIET = args.quiet === 'true';
const BAND_DARK = args['band-dark'] === 'true';
const EVERY_ARG = args.every && args.every !== 'true' ? Number(args.every) : null;
const VS = args.vs && args.vs !== 'true' ? path.resolve(process.cwd(), args.vs) : null;
if (VS && !fs.existsSync(VS)) usage(`--vs: no such directory ${args.vs}`);
if (!args._.length) usage('give a frames directory, a films directory or PNG files');

// ---------------------------------------------------------------- palette

const PALETTE_FILE = path.resolve(ROOT, args.palette && args.palette !== 'true' ? args.palette : 'src/art/palette.ts');

/** rgb (0xRRGGBB) → PAL name, from the PAL block of palette.ts (every 0xRRGGBB of the file as a fallback). */
function loadPalette(file) {
  const src = fs.readFileSync(file, 'utf8');
  const map = new Map();
  const block = /export const PAL\s*=\s*\{([\s\S]*?)\}\s*as const/.exec(src);
  if (block) for (const m of block[1].matchAll(/(\w+)\s*:\s*0x([0-9a-fA-F]{6})/g)) map.set(parseInt(m[2], 16), m[1]);
  if (!map.size) for (const m of src.matchAll(/0x([0-9a-fA-F]{6})/g)) map.set(parseInt(m[1], 16), `#${m[1].toLowerCase()}`);
  if (!map.size) throw new Error(`no colours found in ${file}`);
  return map;
}

const PALETTE = loadPalette(PALETTE_FILE);
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
/** Rec. 601 luma of 0xRRGGBB (a row that turns darker is a darkRow, not a band). */
const lum = (c) => 0.299 * (c >> 16) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255);

/** The nearest PAL colour (for naming an off-palette colour in the report). */
function nearestPal(c) {
  const r = c >> 16, g = (c >> 8) & 255, b = c & 255;
  let best = null;
  let bd = Infinity;
  for (const [p, name] of PALETTE) {
    const d = (r - (p >> 16)) ** 2 + (g - ((p >> 8) & 255)) ** 2 + (b - (p & 255)) ** 2;
    if (d < bd) {
      bd = d;
      best = name;
    }
  }
  return `${best}${bd ? ` (Δ${Math.round(Math.sqrt(bd))})` : ''}`;
}

// ---------------------------------------------------------------- PNG (decoder copied from tools/filmdiff.mjs)

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Decode a PNG to { w, h, rgba } (8-bit grey / grey+alpha / RGB / RGBA / palette, not interlaced). */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let i = 8;
  let w = 0, h = 0, depth = 0, ctype = 0, interlace = 0;
  let plte = null;
  let trns = null;
  const idat = [];
  while (i < buf.length) {
    const n = buf.readUInt32BE(i);
    const t = buf.toString('latin1', i + 4, i + 8);
    const d = buf.subarray(i + 8, i + 8 + n);
    if (t === 'IHDR') {
      w = d.readUInt32BE(0);
      h = d.readUInt32BE(4);
      depth = d[8];
      ctype = d[9];
      interlace = d[12];
    } else if (t === 'PLTE') plte = d;
    else if (t === 'tRNS') trns = d;
    else if (t === 'IDAT') idat.push(d);
    else if (t === 'IEND') break;
    i += 12 + n;
  }
  if (depth !== 8 || interlace !== 0) throw new Error(`unsupported PNG (bit depth ${depth}, interlace ${interlace})`);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  if (!ch) throw new Error(`unsupported PNG colour type ${ctype}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[src + x];
      const a = x >= ch ? px[dst + x - ch] : 0;
      const b = y > 0 ? px[dst - stride + x] : 0;
      const c = x >= ch && y > 0 ? px[dst - stride + x - ch] : 0;
      px[dst + x] = (f === 0 ? v : f === 1 ? v + a : f === 2 ? v + b : f === 3 ? v + ((a + b) >> 1) : paeth(a, b, c) + v) & 255;
    }
  }
  const rgba = Buffer.alloc(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const s = p * ch;
    const o = p * 4;
    if (ctype === 6) px.copy(rgba, o, s, s + 4);
    else if (ctype === 2) {
      rgba[o] = px[s];
      rgba[o + 1] = px[s + 1];
      rgba[o + 2] = px[s + 2];
      rgba[o + 3] = 255;
    } else if (ctype === 0 || ctype === 4) {
      rgba[o] = rgba[o + 1] = rgba[o + 2] = px[s];
      rgba[o + 3] = ctype === 4 ? px[s + 1] : 255;
    } else {
      const k = px[s];
      rgba[o] = plte[k * 3];
      rgba[o + 1] = plte[k * 3 + 1];
      rgba[o + 2] = plte[k * 3 + 2];
      rgba[o + 3] = trns && k < trns.length ? trns[k] : 255;
    }
  }
  return { w, h, rgba };
}

// ---------------------------------------------------------------- inputs

const FRAME_RE = /^f\d{4,}\.png$/;
const framesIn = (dir) => fs.readdirSync(dir).filter((f) => FRAME_RE.test(f)).sort();

/** The film's `every` from a filmdiff base manifest next to it, else --every. */
function everyFor(filmDir) {
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(path.dirname(filmDir), 'filmdiff.json'), 'utf8'));
    const f = Array.isArray(doc.films) ? null : doc.films?.[path.basename(filmDir)];
    if (f && Number.isFinite(f.every)) return f.every;
    // a compare run's report: the set's films are filmed with one step (filmdiff EVERY)
    if (Array.isArray(doc.films) && Number.isFinite(doc.every)) return doc.every;
  } catch {
    /* no manifest */
  }
  return EVERY_ARG;
}

/** [{ name, dir, files[], every }] from the positional arguments. */
function collectFilms(inputs) {
  const films = [];
  const loose = [];
  for (const a of inputs) {
    const p = path.resolve(process.cwd(), a);
    if (!fs.existsSync(p)) usage(`no such file or directory: ${a}`);
    if (fs.statSync(p).isDirectory()) {
      const own = framesIn(p);
      if (own.length) films.push({ name: path.basename(p), dir: p, files: own.map((f) => path.join(p, f)), every: everyFor(p) });
      else {
        const subs = fs
          .readdirSync(p)
          .filter((d) => fs.statSync(path.join(p, d)).isDirectory())
          .sort()
          .filter((d) => framesIn(path.join(p, d)).length);
        if (!subs.length) usage(`${a}: no fNNNN.png frames in it or in its sub-directories`);
        for (const d of subs) {
          const dir = path.join(p, d);
          films.push({ name: d, dir, files: framesIn(dir).map((f) => path.join(dir, f)), every: everyFor(dir) });
        }
      }
    } else if (/\.png$/i.test(p)) loose.push(p);
    else usage(`not a PNG or directory: ${a}`);
  }
  if (loose.length) films.push({ name: loose.length === 1 ? path.basename(loose[0]) : 'files', dir: null, files: loose, every: EVERY_ARG });
  return films;
}

/** The base film of the same name under --vs (DIR/<name>/ or DIR itself when it is that film). */
function baseFilmFor(name) {
  if (!VS) return null;
  for (const dir of [path.join(VS, name), VS]) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory() && (dir !== VS || path.basename(VS) === name)) {
      const own = framesIn(dir);
      if (own.length) return { name, dir, files: own.map((f) => path.join(dir, f)), every: everyFor(dir) };
    }
  }
  return null;
}

// ---------------------------------------------------------------- measurement

const isWhite = (r, g, b) => r > 235 && g > 235 && b > 235;
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/** Per-row most frequent colour: { color, share } for every row of the whole frame. */
function rowDominants(img) {
  const { w, h, rgba } = img;
  const out = new Array(h);
  const counts = new Map();
  for (let y = 0; y < h; y++) {
    counts.clear();
    let best = -1;
    let bestN = 0;
    for (let x = 0, o = y * w * 4; x < w; x++, o += 4) {
      const c = (rgba[o] << 16) | (rgba[o + 1] << 8) | rgba[o + 2];
      const n = (counts.get(c) ?? 0) + 1;
      counts.set(c, n);
      if (n > bestN) {
        bestN = n;
        best = c;
      }
    }
    out[y] = { color: best, share: (bestN / w) * 100 };
  }
  return out;
}

/** Every number of one frame (ref = the reference frame's measurement, or null for the reference itself). */
function measureFrame(img, ref) {
  const { w, h, rgba } = img;
  const [cx, cy, cw, ch] = CLIP ?? [0, 0, w, h];
  const x0 = Math.max(0, cx), y0 = Math.max(0, cy), x1 = Math.min(w, cx + cw), y1 = Math.min(h, cy + ch);
  let off = 0;
  let region = 0;
  const offColors = TOP ? new Map() : null;
  for (let y = y0; y < y1; y++) {
    for (let x = x0, o = (y * w + x0) * 4; x < x1; x++, o += 4) {
      region++;
      const c = (rgba[o] << 16) | (rgba[o + 1] << 8) | rgba[o + 2];
      if (!PALETTE.has(c)) {
        off++;
        if (offColors) offColors.set(c, (offColors.get(c) ?? 0) + 1);
      }
    }
  }
  let white = 0;
  let rowWhite = 0;
  let rowWhiteAt = -1;
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = 0, o = y * w * 4; x < w; x++, o += 4) if (isWhite(rgba[o], rgba[o + 1], rgba[o + 2])) n++;
    white += n;
    const s = (n / w) * 100;
    if (s > rowWhite) {
      rowWhite = s;
      rowWhiteAt = y;
    }
  }
  const rows = rowDominants(img);
  let bands = 0;
  let bandWorst = null;
  let darkRows = 0;
  if (ref) {
    for (let y = 0; y < h; y++) {
      const r = rows[y];
      if (r.share <= SOLID) continue;
      // the row's most frequent colour in the reference frame (whatever its share): more of the
      // same colour (an object moving off a plain backdrop, a darker backdrop) is not a new band
      const was = ref.rows[y];
      if (was && was.color === r.color) continue;
      // a row whose new colour is darker than its reference colour (the v3 backdrop under a
      // lightDim going to ink / void0) is a darker backdrop, not a band or wash
      if (was && lum(r.color) < lum(was.color) && !BAND_DARK) {
        darkRows++;
        continue;
      }
      bands++;
      if (!bandWorst || r.share > bandWorst.share) bandWorst = { row: y, color: hex(r.color), share: round(r.share, 1) };
    }
  }
  return {
    off: region ? (off / region) * 100 : 0,
    white: (white / (w * h)) * 100,
    rowWhite,
    rowWhiteAt,
    bands,
    bandWorst,
    darkRows,
    rows,
    offColors,
  };
}

function topColors(map, n) {
  if (!map || !n) return [];
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([c, k]) => ({ color: hex(c), px: k, nearest: nearestPal(c) }));
}

function loadImg(file) {
  try {
    return decodePng(fs.readFileSync(file));
  } catch (e) {
    console.error(`[palcheck] cannot read ${rel(file)}: ${e.message}`);
    process.exit(1);
  }
}

function selectIndices(n) {
  if (!RANGE) return [...Array(n).keys()];
  const [a, b, s = 1] = RANGE;
  const out = [];
  for (let i = Math.max(0, a); i < Math.min(n, b); i += Math.max(1, s)) out.push(i);
  return out;
}

const REF_ARG = args.ref && args.ref !== 'true' ? args.ref : null;
const refFile = REF_ARG && /\.png$/i.test(REF_ARG) ? path.resolve(process.cwd(), REF_ARG) : null;
const refIndex = REF_ARG && !refFile ? Math.max(0, Math.floor(Number(REF_ARG)) || 0) : 0;
if (refFile && !fs.existsSync(refFile)) usage(`--ref: no such PNG ${REF_ARG}`);

/** Measure every selected frame of a film: { rows[], summary, worstOffColors }. */
function analyzeFilm(film, printRows) {
  const ref = measureFrame(loadImg(refFile ?? film.files[Math.min(refIndex, film.files.length - 1)]), null);
  const rows = [];
  let worst = null;
  for (const i of selectIndices(film.files.length)) {
    const m = measureFrame(loadImg(film.files[i]), ref);
    const r = {
      i,
      t: film.every ? i * film.every : null,
      off: round(m.off),
      dOff: round(m.off - ref.off),
      white: round(m.white),
      rowWhite: round(m.rowWhite, 1),
      rowWhiteAt: m.rowWhite > 0 ? m.rowWhiteAt : null,
      bands: m.bands,
      band: m.bandWorst,
      darkRows: m.darkRows,
    };
    rows.push(r);
    if (!worst || m.off > worst.off) worst = { off: m.off, colors: m.offColors };
    if (printRows) {
      console.log(
        `  ${film.name} #${String(i).padStart(3)}${r.t !== null ? ` t=${String(r.t).padStart(5)}` : ''}  off ${r.off.toFixed(2).padStart(6)} %  Δ ${(r.dOff >= 0 ? '+' : '') + r.dOff.toFixed(2)}  white ${r.white.toFixed(2).padStart(5)} %  rowWhite ${r.rowWhite.toFixed(1).padStart(5)} %${r.bands ? `  bands ${r.bands} (row ${r.band.row} ${r.band.color} ${r.band.share} %)` : ''}${r.darkRows ? `  darkRows ${r.darkRows}` : ''}`,
      );
    }
  }
  const maxBy = (k) => rows.reduce((b, r) => (b === null || r[k] > b[k] ? r : b), null);
  const pick = (k) => {
    const r = maxBy(k);
    return r ? { value: r[k], i: r.i, t: r.t, row: k === 'rowWhite' ? r.rowWhiteAt : undefined, band: k === 'bands' ? r.band : undefined } : null;
  };
  const summary = {
    frames: rows.length,
    refOff: round(ref.off),
    off: pick('off'),
    delta: pick('dOff'),
    white: pick('white'),
    rowWhite: pick('rowWhite'),
    bands: pick('bands'),
    darkRows: rows.reduce((n, r) => Math.max(n, r.darkRows), 0),
    framesOver50: rows.filter((r) => r.off > 50).length,
  };
  return { rows, summary, worstOffColors: worst ? topColors(worst.colors, TOP) : [] };
}

// ---------------------------------------------------------------- run

const films = collectFilms(args._);
const lim = (v) => (v === null ? '-' : String(v));
console.log(
  `[palcheck] ${films.length} film(s), rules ${RULESET} (gated: ${Object.entries(LIM).filter(([, v]) => v !== null).map(([k, v]) => `${k} ≤ ${v}`).join(', ') || 'nothing'})${VS ? `, no worse than ${rel(VS)}` : ''}; palette ${PALETTE.size} PAL colours (${rel(PALETTE_FILE)}); off-palette region ${CLIP ? `clip ${CLIP.join(',')}` : 'whole frame'}; reference ${refFile ? rel(refFile) : `frame ${refIndex}`}`,
);

const GATES = [
  // [key, summary field, label, unit]
  ['delta', 'delta', 'Δoff', ' pt'],
  ['off', 'off', 'off', ' %'],
  ['white', 'white', 'white', ' %'],
  ['rowWhite', 'rowWhite', 'row white', ' %'],
  ['bands', 'bands', 'new band rows', ''],
];

const report = {
  tool: 'tools/palcheck.mjs',
  version: 1,
  date: new Date().toISOString(),
  rules: RULESET,
  limits: LIM,
  vs: VS ? rel(VS) : null,
  palette: { file: rel(PALETTE_FILE), colors: PALETTE.size },
  clip: CLIP,
  solid: SOLID,
  ref: refFile ? rel(refFile) : refIndex,
  films: {},
};
let failedFilms = 0;
const summaries = [];

for (const film of films) {
  const a = analyzeFilm(film, !QUIET);
  const base = baseFilmFor(film.name);
  const b = base ? analyzeFilm(base, false) : null;
  const S = a.summary;
  const at = (x) => (x ? `#${x.i}${x.t !== null ? ` t=${x.t}` : ''}` : '-');
  const fails = [];
  const effective = {};
  for (const [key, field, label, unit] of GATES) {
    const L = LIM[key];
    if (L === null || !S[field]) continue;
    const baseValue = b?.summary[field]?.value ?? null;
    const eff = baseValue !== null ? Math.max(L, baseValue) : L;
    effective[key] = { limit: L, base: baseValue, effective: eff };
    const v = S[field].value;
    if (v > eff) {
      const nFrames = a.rows.filter((r) => (key === 'delta' ? r.dOff : key === 'bands' ? r.bands : r[field]) > eff).length;
      const detail = key === 'rowWhite' ? ` (row ${S.rowWhite.row})` : key === 'bands' && S.bands.band ? ` (row ${S.bands.band.row} ${S.bands.band.color} ${S.bands.band.share} %)` : '';
      fails.push(`${label} ${v}${unit}${detail} > ${eff}${unit}${baseValue !== null && baseValue > L ? ` (= the base's)` : ''} at ${at(S[field])} (${nFrames} frame${nFrames === 1 ? '' : 's'})`);
    }
  }
  const pass = fails.length === 0;
  if (!pass) failedFilms++;
  report.films[film.name] = { dir: film.dir ? rel(film.dir) : null, every: film.every, pass, fails, effective, summary: S, base: b ? { dir: rel(base.dir), summary: b.summary } : null, worstOffColors: a.worstOffColors, frames: a.rows };
  const v = (x, d = 2) => (x ? x.value.toFixed(d) : '-');
  const bv = (k, d = 2) => (b && b.summary[k] ? ` [base ${b.summary[k].value.toFixed(d)}]` : '');
  summaries.push(
    `${film.name.padEnd(24)} ${String(S.frames).padStart(4)} frames  off f0 ${S.refOff.toFixed(2).padStart(6)} %  max ${v(S.off).padStart(6)} % (${at(S.off)})${bv('off')}  Δmax ${S.delta ? (S.delta.value >= 0 ? '+' : '') + S.delta.value.toFixed(2) : '-'}${bv('delta')}  white max ${v(S.white)} %${bv('white')}  row max ${v(S.rowWhite, 1)} %${bv('rowWhite', 1)}  bands ${S.bands ? S.bands.value : 0}${b?.summary.bands ? ` [base ${b.summary.bands.value}]` : ''}${S.darkRows ? ` (darkRows ${S.darkRows})` : ''}  ${pass ? 'PASS' : 'FAIL'}${fails.length ? `  — ${fails.join('; ')}` : ''}${VS && !b ? '  (no base film)' : ''}`,
  );
  if (a.worstOffColors.length && (!QUIET || !pass)) summaries.push(`${''.padEnd(24)} worst-frame off-palette colours: ${a.worstOffColors.map((c) => `${c.color}×${c.px} ≈ ${c.nearest}`).join(', ')}`);
}

console.log('');
for (const l of summaries) console.log(l);
console.log('');
console.log(`[palcheck] ${failedFilms ? `${failedFilms} of ${films.length} film(s) FAIL` : `all ${films.length} film(s) PASS`} (rules ${RULESET}${VS ? `, vs ${rel(VS)}` : ''})`);
if (args.json && args.json !== 'true') {
  const out = path.resolve(process.cwd(), args.json);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 1));
  console.log(`[palcheck] wrote ${rel(out)}`);
}
process.exit(failedFilms ? 2 : 0);
