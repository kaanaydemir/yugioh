#!/usr/bin/env node
// Film pixel gate (v3 A3 Y0, docs/v3/A3_MIMARI.md §13): films a named SET of duel scenarios with
// tools/shot.mjs --fresh --film (frozen, stepped clock: a function of the code alone) and compares
// every film frame, pixel by pixel, with a baseline directory. The repo version of the A2
// acceptance's hand-made v1 film check (shots/v3/a2/acceptance/v1films/diff.txt).
//
//   node tools/filmdiff.mjs --set v1    --base shots/v3/a3/baseline/v1films            # gate (exit 0 = all IDENTICAL)
//   node tools/filmdiff.mjs --set slice --base shots/v3/a3/baseline/slicefilms-y1      # gate (after Y1)
//   node tools/filmdiff.mjs --set v1    --base shots/v3/a3/baseline/v1films --write    # create a baseline
//   node tools/filmdiff.mjs --list                                                    # print the sets
//
//   --set v1|slice   which films (below). The slice set runs with &look=v3.
//   --base DIR       baseline directory: <film>/fNNNN.png (every frame), <film>.png (the contact
//                    sheet, for eyes), <film>.log (shot.mjs output) and filmdiff.json (the manifest:
//                    set, per-film query / length / step, frame count, shot exit code, git HEAD)
//   --write          film into --base instead of comparing (refuses to overwrite a base that
//                    already has a manifest unless --force; --only rewrites just those films)
//   --out DIR        where a compare run films (default shots/filmdiff/<set>-<time>-<pid>, unique per
//                    run, so agents running the gate at the same time never share a directory). The
//                    report (diff.txt, filmdiff.json, logs) stays; the frame PNGs are deleted when
//                    every film is IDENTICAL, unless --keep
//   --keep           keep the compare run's frames even when identical
//   --jobs N         films captured in parallel, one shot.mjs (Vite + Chromium) each (default 2)
//   --only a,b       only these films of the set (by film name, see --list); the verdict covers
//                    only them and says so
//
// Per film: node tools/shot.mjs "<query>" --fresh --film <N> --every 33 --cols 12 --frames <dir>
// with N = floor(ms / 33) + 1: t = 0 … ms in steps of 2 game frames (every step is its own page
// evaluate, so promise-chained cinematics advance between steps as in play). `ms` covers the
// scenario until the game waits for input again (tools/measure.mjs inputReadyMs at Y0) + ≥ 300 ms.
//
// Verdict per film (printed as a table, written to <out>/diff.txt):
//   IDENTICAL   same frame count, every frame pixel-identical (the PNG bytes are compared first; if
//               they differ the pixels are decoded and compared)
//   DIFFERS     frames whose pixels differ: count, first frames with their game time, changed pixel
//               count and bounding box; the first 4 differing frames are written as
//               <out>/<film>.diff/fNNNN.png (base | now | changed pixels in red over the dimmed base)
//   FRAMES      the frame counts differ (a capture broke off)
//   ERROR       shot.mjs failed (page error, __neon.errors, timeout) where the base did not
//   PARAMS      the base was filmed with another query / length / step (rewrite the base)
//   MISSING     the film is not in the base
// Exit code: 0 only when every film is IDENTICAL (compare) / every capture succeeded (--write);
// 2 otherwise; 1 on bad arguments.
//
// shot.mjs is retried once when a capture fails for a reason outside the game (ready / page-load
// timeout, browser crash); the retry is reported. Baselines live under shots/ (git-ignored).

import { spawn, execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** A path for messages: relative inside the repo, absolute outside it. */
const rel = (p) => (p.startsWith(ROOT + path.sep) ? path.relative(ROOT, p) : p);

// ---------------------------------------------------------------- the sets (A3_MIMARI §13)

const EVERY = 33;
const COLS = 12;

/**
 * Film sets. name: file / table name; s: scenario key (src/duel/scenarios*.ts); q: extra query;
 * ms: film length in game ms (measure inputReadyMs at Y0 + ≥ 300 ms, rounded up to 50).
 */
const SETS = {
  // A2's 8 films + hits on defence + one film per bridge site (§13)
  v1: {
    look: 'v1',
    films: [
      { name: 'saWyrmAtk', s: 'saWyrmAtk', ms: 4200 },
      { name: 'saMagusEffect', s: 'saMagusEffect', ms: 7150 },
      { name: 'saTitanP2Blocked', s: 'saTitanP2Blocked', ms: 2950 },
      { name: 'smbPosAce', s: 'smbPosAce', ms: 1900 },
      { name: 'spBoltAce', s: 'spBoltAce', ms: 3650 },
      { name: 'suRevive', s: 'suRevive', ms: 3450 },
      { name: 'suWyrm', s: 'suWyrm', ms: 4100 },
      { name: 'tbChains', s: 'tbChains', ms: 6150 },
      { name: 'tbBlocked', s: 'tbBlocked', ms: 2800 },
      { name: 'tbFaceDown', s: 'tbFaceDown', ms: 3350 },
      { name: 'tbDefHold', s: 'tbDefHold', ms: 2300 },
      { name: 'sbSentinelAtk', s: 'sbSentinelAtk', ms: 4100 }, // STRIKE_LIGHT, declare
      { name: 'sbSentinelAtk-arena-v2', s: 'sbSentinelAtk', q: '&arena=v2', ms: 4100 }, // MONSTER_GLOW (the light layer is on only in the v2 arena under v1)
      { name: 'smbSentinel', s: 'smbSentinel', ms: 1850 }, // ROAR_PEAK
      { name: 'smbFlipThorn', s: 'smbFlipThorn', ms: 5650 }, // FLIP_RAMP + flip branches
      { name: 'smbFlipHawk', s: 'smbFlipHawk', ms: 1300 }, // FLIP_RAMP + flip branches
      { name: 'sbSentinelDies', s: 'sbSentinelDies', ms: 4500 }, // death flavours, deathMaterial
    ],
  },
  // the A2 slice under ?look=v3 (§13)
  slice: {
    look: 'v3',
    films: [
      { name: 'saWyrmAtk', s: 'saWyrmAtk', ms: 2300 },
      { name: 'saMagusAtk', s: 'saMagusAtk', ms: 1850 },
      { name: 'saWyrmBlocked', s: 'saWyrmBlocked', ms: 2300 },
      { name: 'suWyrm', s: 'suWyrm', ms: 3100 },
      { name: 'suMagus', s: 'suMagus', ms: 3600 },
      { name: 'sliceMagusHitTitan', s: 'sliceMagusHitTitan', ms: 2550 },
      { name: 'spBoltAce', s: 'spBoltAce', ms: 2150 },
      { name: 'sliceChainsWyrm', s: 'sliceChainsWyrm', ms: 4850 },
      { name: 'sliceMagusRevive', s: 'sliceMagusRevive', ms: 1900 },
      { name: 'sliceWyrmPos', s: 'sliceWyrmPos', ms: 1150 },
      { name: 'sliceMagusFlip', s: 'sliceMagusFlip', ms: 900 },
    ],
  },
};

function filmSpec(set, f) {
  const query = `?dev=duel&s=${f.s}${f.q ?? ''}${SETS[set].look === 'v3' ? '&look=v3' : ''}`;
  return { name: f.name, query, ms: f.ms, every: EVERY, frames: Math.floor(f.ms / EVERY) + 1, cols: COLS };
}

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

const args = parseArgs(process.argv.slice(2));

if (args.list) {
  for (const set of Object.keys(SETS)) {
    console.log(`set ${set} (${SETS[set].films.length} films, look ${SETS[set].look}):`);
    for (const f of SETS[set].films) {
      const s = filmSpec(set, f);
      console.log(`  ${s.name.padEnd(24)} ${s.query.padEnd(44)} ${String(s.frames).padStart(4)} frames, t = 0…${s.ms} ms every ${s.every}`);
    }
  }
  process.exit(0);
}

function usage(msg) {
  if (msg) console.error(`[filmdiff] ${msg}`);
  console.error('usage: node tools/filmdiff.mjs --set v1|slice --base DIR [--write [--force]] [--out DIR] [--keep] [--jobs N] [--only a,b] | --list');
  process.exit(1);
}

const SET = args.set;
if (!SET || !SETS[SET]) usage(`--set must be one of ${Object.keys(SETS).join(', ')}`);
if (!args.base || args.base === 'true') usage('--base DIR is required');
const BASE = path.resolve(ROOT, args.base);
const WRITE = args.write === 'true';
const FORCE = args.force === 'true';
const KEEP = args.keep === 'true';
const JOBS = Math.max(1, Math.floor(Number(args.jobs ?? 2)) || 1);
const ONLY = args.only && args.only !== 'true' ? args.only.split(',').map((s) => s.trim()).filter(Boolean) : null;

let films = SETS[SET].films.map((f) => filmSpec(SET, f));
if (ONLY) {
  const unknown = ONLY.filter((n) => !films.some((f) => f.name === n));
  if (unknown.length) usage(`--only: unknown film(s) ${unknown.join(', ')} in set ${SET} (see --list)`);
  films = films.filter((f) => ONLY.includes(f.name));
}

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-');
const OUT = WRITE ? BASE : path.resolve(ROOT, args.out && args.out !== 'true' ? args.out : `shots/filmdiff/${SET}-${stamp}-${process.pid}`);
const MANIFEST = 'filmdiff.json';

function gitInfo() {
  try {
    const head = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const dirty = execFileSync('git', ['-C', ROOT, 'status', '--porcelain', '--', 'src', 'index.html'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return { head, srcDirty: dirty.length > 0 };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- PNG (decode 8-bit, non-interlaced; encode RGB)

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

const CRC_T = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** Encode an RGB buffer (w*h*3) as a PNG. */
function encodePng(w, h, rgb) {
  const raw = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------- capture

const frameFile = (i) => `f${String(i).padStart(4, '0')}.png`;

function runShot(spec, dir) {
  const png = path.join(dir, `${spec.name}.png`);
  const framesDir = path.join(dir, spec.name);
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.rmSync(png, { force: true });
  const argv = [
    path.join(ROOT, 'tools/shot.mjs'), spec.query, '--fresh',
    '--film', String(spec.frames), '--every', String(spec.every), '--cols', String(spec.cols),
    '--out', png, '--frames', framesDir, '--timeout', '120000',
  ];
  const t0 = Date.now();
  return new Promise((resolve) => {
    const child = spawn(process.execPath, argv, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    child.stdout.on('data', (d) => (log += d));
    child.stderr.on('data', (d) => (log += d));
    child.on('close', (code) => {
      const got = fs.existsSync(framesDir) ? fs.readdirSync(framesDir).filter((f) => /^f\d{4}\.png$/.test(f)).length : 0;
      resolve({ code: code ?? 1, log, got, sec: Math.round((Date.now() - t0) / 1000) });
    });
  });
}

/** A failure outside the game (worth one retry): ready / navigation timeout, browser or server crash. */
const transient = (r) =>
  r.code !== 0 && /timed out waiting for window\.__neon\.ready|Timeout \d+ms exceeded|Target (page, context or browser )?(has been )?closed|browserType\.launch|ECONNREFUSED|net::ERR_/i.test(r.log);

async function capture(spec, dir) {
  let r = await runShot(spec, dir);
  let retried = false;
  if (transient(r) || (r.code !== 0 && r.got === 0)) {
    retried = true;
    r = await runShot(spec, dir);
  }
  fs.writeFileSync(path.join(dir, `${spec.name}.log`), `${spec.query}\n${r.log}${retried ? '[filmdiff] retried once (first capture failed outside the game)\n' : ''}[filmdiff] exit ${r.code}, ${r.got}/${spec.frames} frames, ${r.sec} s\n`);
  return { ...r, retried };
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

// ---------------------------------------------------------------- compare

/** Pixel comparison of one frame; null = identical. */
function compareFrame(aFile, bFile) {
  const a = fs.readFileSync(aFile);
  const b = fs.readFileSync(bFile);
  if (a.equals(b)) return null;
  const A = decodePng(a);
  const B = decodePng(b);
  if (A.w !== B.w || A.h !== B.h) return { px: -1, size: `${A.w}×${A.h} → ${B.w}×${B.h}`, A, B };
  let px = 0;
  let x0 = A.w, y0 = A.h, x1 = -1, y1 = -1;
  for (let p = 0, o = 0; p < A.w * A.h; p++, o += 4) {
    if (A.rgba[o] !== B.rgba[o] || A.rgba[o + 1] !== B.rgba[o + 1] || A.rgba[o + 2] !== B.rgba[o + 2] || A.rgba[o + 3] !== B.rgba[o + 3]) {
      px++;
      const x = p % A.w;
      const y = (p / A.w) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (px === 0) return null; // same pixels, other encoding
  return { px, bbox: [x0, y0, x1 - x0 + 1, y1 - y0 + 1], A, B };
}

/** base | now | changed pixels (red) over the dimmed base. */
function writeDiffImage(file, d) {
  const { A, B } = d;
  const w = A.w;
  const h = A.h;
  const W = w * 3 + 8;
  const rgb = Buffer.alloc(W * h * 3, 0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      const put = (ox, r, g, b) => {
        const o = (y * W + ox + x) * 3;
        rgb[o] = r;
        rgb[o + 1] = g;
        rgb[o + 2] = b;
      };
      put(0, A.rgba[s], A.rgba[s + 1], A.rgba[s + 2]);
      put(w + 4, B.rgba[s], B.rgba[s + 1], B.rgba[s + 2]);
      const same = A.rgba[s] === B.rgba[s] && A.rgba[s + 1] === B.rgba[s + 1] && A.rgba[s + 2] === B.rgba[s + 2] && A.rgba[s + 3] === B.rgba[s + 3];
      if (same) put(2 * w + 8, A.rgba[s] >> 2, A.rgba[s + 1] >> 2, A.rgba[s + 2] >> 2);
      else put(2 * w + 8, 255, 32, 32);
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encodePng(W, h, rgb));
}

function compareFilm(spec, baseEntry, now) {
  const r = { name: spec.name, frames: spec.frames, status: 'IDENTICAL', detail: '', diffFrames: [] };
  if (!baseEntry) return { ...r, status: 'MISSING', detail: `not in the base (${rel(BASE)})` };
  const same = ['query', 'ms', 'every', 'frames'].every((k) => baseEntry[k] === spec[k]);
  if (!same) return { ...r, status: 'PARAMS', detail: `base filmed ${baseEntry.query} ${baseEntry.frames}×${baseEntry.every} ms, the set now says ${spec.query} ${spec.frames}×${spec.every} ms` };
  if (now.code !== 0 && baseEntry.exit === 0) {
    const why = (now.log.match(/^\[(pageerror|neon\.errors|fresh error|eval error|shot\] timed out)[^\n]*/m) ?? [`exit ${now.code}`])[0];
    return { ...r, status: 'ERROR', detail: `shot.mjs failed: ${why.slice(0, 160)}` };
  }
  const baseDir = path.join(BASE, spec.name);
  const nowDir = path.join(OUT, spec.name);
  const nBase = fs.existsSync(baseDir) ? fs.readdirSync(baseDir).filter((f) => /^f\d{4}\.png$/.test(f)).length : 0;
  if (nBase !== now.got || now.got !== spec.frames) return { ...r, status: 'FRAMES', detail: `base ${nBase} frames, now ${now.got} (wanted ${spec.frames})` };
  let shown = 0;
  for (let i = 0; i < spec.frames; i++) {
    const d = compareFrame(path.join(baseDir, frameFile(i)), path.join(nowDir, frameFile(i)));
    if (!d) continue;
    r.diffFrames.push({ i, t: i * spec.every, px: d.px, bbox: d.bbox ?? null, size: d.size ?? null });
    if (shown < 4) {
      writeDiffImage(path.join(OUT, `${spec.name}.diff`, frameFile(i)), d);
      shown++;
    }
  }
  if (r.diffFrames.length) {
    r.status = 'DIFFERS';
    const first = r.diffFrames.slice(0, 3).map((f) => `#${f.i} t=${f.t} ${f.px < 0 ? f.size : `${f.px} px @${f.bbox.join(',')}`}`);
    const maxPx = Math.max(...r.diffFrames.map((f) => f.px));
    r.detail = `${r.diffFrames.length}/${spec.frames} frames (max ${maxPx} px): ${first.join('; ')}${r.diffFrames.length > 3 ? ' …' : ''} → ${rel(path.join(OUT, `${spec.name}.diff`))}/`;
  }
  return r;
}

// ---------------------------------------------------------------- run

const git = gitInfo();
const t0 = Date.now();
let manifest = null;
const manifestPath = path.join(BASE, MANIFEST);
if (fs.existsSync(manifestPath)) manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

if (WRITE) {
  if (manifest && !FORCE && !ONLY) usage(`${rel(BASE)} already holds a base (${MANIFEST}); pass --force to overwrite it, or another --base`);
  if (manifest && manifest.set !== SET) usage(`${rel(BASE)} holds set ${manifest.set}, not ${SET}`);
  if (manifest && ONLY && !FORCE) usage(`rewriting films of an existing base needs --force`);
} else {
  if (!manifest) usage(`no base at ${rel(BASE)} (${MANIFEST} missing); create one with --write`);
  if (manifest.set !== SET) usage(`${rel(BASE)} is a base of set ${manifest.set}, not ${SET}`);
}
fs.mkdirSync(OUT, { recursive: true });

console.log(
  `[filmdiff] set ${SET} (${films.length}${ONLY ? ` of ${SETS[SET].films.length}` : ''} films, look ${SETS[SET].look}), ${WRITE ? 'writing the base' : 'comparing with'} ${rel(BASE)}${WRITE ? '' : `, filming into ${rel(OUT)}`}, jobs ${JOBS}, HEAD ${git ? git.head.slice(0, 7) + (git.srcDirty ? ' + uncommitted src changes' : '') : '?'}`,
);

const results = await pool(films, JOBS, async (spec) => {
  const now = await capture(spec, OUT);
  const res = WRITE
    ? {
        name: spec.name,
        frames: spec.frames,
        status: now.code === 0 && now.got === spec.frames ? 'WRITTEN' : now.got !== spec.frames ? 'FRAMES' : 'ERROR',
        detail: now.code === 0 && now.got === spec.frames ? '' : `exit ${now.code}, ${now.got}/${spec.frames} frames (see ${rel(path.join(OUT, spec.name + '.log'))})`,
        diffFrames: [],
      }
    : compareFilm(spec, manifest.films?.[spec.name], now);
  res.sec = now.sec;
  res.retried = now.retried;
  res.exit = now.code;
  console.log(`  ${res.name.padEnd(24)} ${res.status.padEnd(9)} ${String(spec.frames).padStart(4)} frames  ${String(now.sec).padStart(4)} s${now.retried ? '  (retried)' : ''}${res.detail ? `  ${res.detail}` : ''}`);
  return res;
});

// table in set order
const okStatus = WRITE ? 'WRITTEN' : 'IDENTICAL';
const lines = [];
lines.push(`filmdiff set ${SET} (look ${SETS[SET].look}) ${WRITE ? 'write' : 'compare'} ${new Date().toISOString()}`);
lines.push(`base ${rel(BASE)}${WRITE ? '' : `  now ${rel(OUT)}`}  HEAD ${git ? git.head + (git.srcDirty ? ' (+ uncommitted src changes)' : '') : '?'}`);
if (!WRITE && manifest?.git) lines.push(`base filmed at HEAD ${manifest.git.head}${manifest.git.srcDirty ? ' (+ uncommitted src changes)' : ''} on ${manifest.date}`);
lines.push('');
lines.push(`${'film'.padEnd(24)} ${'query'.padEnd(44)} frames  every  ${'status'.padEnd(9)}  detail`);
for (let k = 0; k < films.length; k++) {
  const s = films[k];
  const r = results[k];
  lines.push(`${s.name.padEnd(24)} ${s.query.padEnd(44)} ${String(s.frames).padStart(6)}  ${String(s.every).padStart(5)}  ${r.status.padEnd(9)}  ${r.detail}${r.retried ? ' (capture retried once)' : ''}`);
}
const bad = results.filter((r) => r.status !== okStatus);
const verdict = WRITE
  ? bad.length
    ? `${bad.length} of ${films.length} capture(s) FAILED`
    : `${films.length} film(s) written`
  : bad.length
    ? `${bad.length} of ${films.length} film(s) NOT identical: ${bad.map((r) => `${r.name} ${r.status}`).join(', ')}`
    : `all ${films.length} film(s) IDENTICAL${ONLY ? ` (subset --only ${ONLY.join(',')})` : ''}`;
lines.push('');
lines.push(`${verdict}  [${Math.round((Date.now() - t0) / 1000)} s]`);
fs.writeFileSync(path.join(OUT, 'diff.txt'), lines.join('\n') + '\n');

if (WRITE) {
  const prev = manifest && ONLY ? manifest.films : {};
  const doc = {
    tool: 'tools/filmdiff.mjs',
    version: 1,
    set: SET,
    look: SETS[SET].look,
    date: new Date().toISOString(),
    git,
    films: { ...prev },
  };
  for (let k = 0; k < films.length; k++) {
    const s = films[k];
    const r = results[k];
    const dir = path.join(OUT, s.name);
    const sha = crypto.createHash('sha256');
    for (let i = 0; i < r.frames && fs.existsSync(path.join(dir, frameFile(i))); i++) sha.update(fs.readFileSync(path.join(dir, frameFile(i))));
    doc.films[s.name] = { query: s.query, ms: s.ms, every: s.every, frames: s.frames, cols: s.cols, exit: r.exit, filesSha256: sha.digest('hex') };
  }
  fs.writeFileSync(path.join(OUT, MANIFEST), JSON.stringify(doc, null, 1));
} else {
  fs.writeFileSync(path.join(OUT, 'filmdiff.json'), JSON.stringify({ tool: 'tools/filmdiff.mjs', set: SET, base: rel(BASE), date: new Date().toISOString(), git, verdict, films: results }, null, 1));
  if (!bad.length && !KEEP) {
    // identical: keep the report (diff.txt, filmdiff.json, logs), drop the frames
    for (const s of films) {
      fs.rmSync(path.join(OUT, s.name), { recursive: true, force: true });
      fs.rmSync(path.join(OUT, `${s.name}.png`), { force: true });
    }
  }
}

console.log('');
for (const l of lines) console.log(l);
process.exit(bad.length ? 2 : 0);
