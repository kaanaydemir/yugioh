// SFX render CLI (lane E tooling): renders named sound recipes (src/audio/sounds.ts RECIPES, i.e. any
// SfxName) OFFLINE through the game's own path (src/audio/sfx.ts renderSfx: OfflineAudioContext, the real
// master chain, seeded noise) in headless Chromium, then measures them in Node so sounds you cannot hear
// can be judged by eye and by number.
//
//   npx vite-node tools/sfx-render.ts -- <name> [<name> …] [options]
//   npx vite-node tools/sfx-render.ts -- --match '^e_well' [options]
//   npx vite-node tools/sfx-render.ts -- --compare springRise,dawnDrop [--compare a,c …]
//
//   <name>…          SfxName recipes (exact names; see --list)
//   --match RE       every recipe whose name matches the regular expression
//   --list [RE]      print the recipe names (optionally filtered) and exit
//   --compare a,b    print the log-spectral distance of two recipes (repeatable; also "a,b,c" = all pairs).
//                    Both are rendered; their PNGs / WAVs are written as usual
//   --look v3|v1     which output chain (default v3: the v3 ceiling of src/audio/v3/output.ts, as the game
//                    with ?look=v3); v1 = the old chain
//   --raw            render without the master chain (no compressor / limiter / reverb): the recipe's own peak
//   --seconds S      render length (default 3.5 s; the tail is trimmed for the pictures by the −50 dB rule)
//   --view S         time span of the pictures (default: the longest sound's length + 0.15 s, ≥ 0.5 s;
//                    the same scale for every sound of a run, so they compare at a glance)
//   --seed N         rng seed of the voice (default 1234, like the game's renderSfx)
//   --sr HZ          sample rate (default 44100)
//   --out DIR        output directory (default shots/e/sfx/)
//   --no-png / --no-wav   skip those files
//   --help           this text
//
// Files (in DIR; <tag> = <name>[-raw][-v1]):
//   <tag>.wav        16-bit stereo PCM
//   <tag>.png        header (name + numbers) | waveform (min/max + RMS band, ±1 = full scale, −6 dBFS lines) |
//                    log-frequency spectrogram 40 Hz–16 kHz (grid 100 Hz / 1 kHz / 10 kHz, ticks every
//                    0.1 s, labels every 0.5 s; colour from −90 dB (black) to 0 dB (white); the spectral
//                    centroid is the dotted cyan line)
//   sheet.png        every sound of the run stacked on one time scale (look at this first)
//   report.json      the numbers below per sound (+ the centroid series every 25 ms) and the comparisons
//
// Numbers: len (s, until the signal stays below −50 dB of its peak), peak dBFS (sample peak, both channels),
// rms dBFS (over len), punch (loudest 50 ms window, dBFS), loudness: K-weighted (ITU BS.1770) momentary
// max (400 ms) and short-term max (3 s) in LUFS, plus the ungated integrated value over len; centroid
// (spectral centroid, Hz): at the attack (first 100 ms), at the punch window, energy-weighted mean, and
// the series; low / mid / high energy split (< 250 Hz, 250 Hz–4 kHz, > 4 kHz, %).
//
// --compare prints two distances in dB (bigger = more different):
//   lsd      SE-4 (docs/v3/REHBER.md): 1/3-octave, A-weighted long-term spectral PROFILE of each sound
//            (power-averaged over its audible length, normalised to 0 dB total), RMS of the per-band dB
//            difference over 50 Hz–16 kHz, each band floored at −60 dB under the profile's loudest band.
//            Gates in the docs: a role / material pair ≥ 9–10 dB, character median ≥ 15 dB.
//   lsdTime  the same bands frame by frame (2048-pt FFT, 512 hop), aligned at each sound's onset (−30 dB
//            of its peak), over the frames where either sound is audible, joint floor −70 dB: also catches
//            two sounds with the same average colour but a different motion.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { drawGlyph, getFont, hasGlyph } from '../src/art/font';
import { PixelCanvas } from '../src/art/pixel';
// @ts-expect-error — plain JS module of the tools (no types)
import { launchBrowser, startServer } from './lib/pagekit.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// ---------------------------------------------------------------- args

const argv = process.argv.slice(2).filter((a) => a !== '--');
const opts: Record<string, string[]> = {};
const names: string[] = [];
const FLAGS = new Set(['raw', 'help', 'no-png', 'no-wav']);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2);
    const v = !FLAGS.has(k) && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    (opts[k] ??= []).push(v);
  } else names.push(a);
}
const opt = (k: string) => opts[k]?.[opts[k].length - 1];
function help(code: number): never {
  const out: string[] = [];
  for (const l of fs.readFileSync(new URL(import.meta.url).pathname, 'utf8').split('\n')) {
    if (!l.startsWith('//')) break;
    out.push(l.replace(/^\/\/ ?/, ''));
  }
  console.log(out.join('\n'));
  process.exit(code);
}
if (opt('help')) help(0);
const LIST = opt('list');
const MATCH = opt('match');
const COMPARE = (opts.compare ?? []).map((s) => s.split(',').map((x) => x.trim()).filter(Boolean));
if (!LIST && !MATCH && !names.length && !COMPARE.length) help(2);
const LOOK = opt('look') === 'v1' ? 'v1' : 'v3';
const RAW = opt('raw') === 'true';
const SECONDS = Number(opt('seconds') ?? 3.5);
const SEED = Number(opt('seed') ?? 1234);
const SR = Number(opt('sr') ?? 44100);
const OUT = path.resolve(ROOT, opt('out') ?? 'shots/e/sfx');
const DO_PNG = opt('no-png') !== 'true';
const DO_WAV = opt('no-wav') !== 'true';

// ---------------------------------------------------------------- render in Chromium

interface Rendered {
  name: string;
  sr: number;
  ch: Float32Array[];
}

/** In the page: import the game's audio module and render the recipes; returns base64 Float32 channels. */
const PAGE_FN = async (a: { look: string; names: string[] | null; match: string | null; list: boolean; raw: boolean; seconds: number; seed: number; sr: number }) => {
  (globalThis as unknown as { __NEON_LOOK: string }).__NEON_LOOK = a.look;
  const load = new Function('u', 'return import(u)') as (u: string) => Promise<Record<string, unknown>>;
  const m = (await load('/src/audio/sfx.ts')) as {
    SFX_NAMES: string[];
    renderSfx: (n: string, o: object) => Promise<AudioBuffer | null>;
  };
  const lay = (await load('/src/view/layout.ts')) as { LOOK: string };
  if (lay.LOOK !== a.look) throw new Error(`layout LOOK is ${lay.LOOK}, wanted ${a.look}`);
  const all = m.SFX_NAMES;
  if (a.list) return { all, out: [] as { name: string; sr: number; ch: string[] }[], missing: [] as string[] };
  const want = new Set<string>(a.names ?? []);
  if (a.match) {
    const re = new RegExp(a.match);
    for (const n of all) if (re.test(n)) want.add(n);
  }
  const missing = [...want].filter((n) => !all.includes(n));
  const out: { name: string; sr: number; ch: string[] }[] = [];
  const b64 = (f: Float32Array) => {
    const u8 = new Uint8Array(f.buffer, f.byteOffset, f.byteLength);
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return btoa(s);
  };
  for (const name of want) {
    if (!all.includes(name)) continue;
    const b = await m.renderSfx(name, { seconds: a.seconds, chain: !a.raw, seed: a.seed, sampleRate: a.sr });
    if (!b) throw new Error(`renderSfx(${name}) failed (see the console)`);
    const ch: string[] = [];
    for (let c = 0; c < b.numberOfChannels; c++) ch.push(b64(b.getChannelData(c).slice()));
    out.push({ name, sr: b.sampleRate, ch });
  }
  return { all, out, missing };
};

async function renderAll(list: boolean, want: string[]): Promise<{ all: string[]; rendered: Rendered[]; missing: string[] }> {
  const { server, base } = await startServer();
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    page.on('console', (msg: { type(): string; text(): string }) => {
      if (/Failed to load resource.*404/.test(msg.text())) return; // the page's favicon
      if (msg.type() === 'error' || msg.type() === 'warning') console.error(`[page ${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', (e: Error) => console.error(`[page error] ${e.message}`));
    await page.goto(`${base}tools/lib/e-sfx.html`, { waitUntil: 'load', timeout: 240000 });
    const r = (await page.evaluate(PAGE_FN, {
      look: LOOK,
      names: want,
      match: MATCH ?? null,
      list,
      raw: RAW,
      seconds: SECONDS,
      seed: SEED,
      sr: SR,
    })) as { all: string[]; out: { name: string; sr: number; ch: string[] }[]; missing: string[] };
    const rendered = r.out.map((o) => ({
      name: o.name,
      sr: o.sr,
      ch: o.ch.map((s) => {
        const buf = Buffer.from(s, 'base64');
        return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
      }),
    }));
    return { all: r.all, rendered, missing: r.missing };
  } finally {
    await browser.close();
    await server.close();
  }
}

// ---------------------------------------------------------------- DSP

const dB = (x: number) => (x > 1e-12 ? 20 * Math.log10(x) : -240);
const pdB = (p: number) => (p > 1e-24 ? 10 * Math.log10(p) : -240);

function mono(r: Rendered): Float32Array {
  const n = r.ch[0].length;
  const o = new Float32Array(n);
  for (const c of r.ch) for (let i = 0; i < n; i++) o[i] += c[i] / r.ch.length;
  return o;
}

function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

const N_FFT = 2048;
const HANN = (() => {
  const w = new Float64Array(N_FFT);
  for (let i = 0; i < N_FFT; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N_FFT - 1));
  return w;
})();
const NORM = 4 / N_FFT; // hann + one-sided: a full-scale sine ≈ 1 (0 dB)

/** Magnitude spectrum (N_FFT/2 bins, sine-amplitude scaled) of the frame centred at sample `c`. */
function frameSpectrum(m: Float32Array, c: number): Float64Array {
  const re = new Float64Array(N_FFT);
  const im = new Float64Array(N_FFT);
  const s = c - N_FFT / 2;
  for (let i = 0; i < N_FFT; i++) {
    const k = s + i;
    re[i] = k >= 0 && k < m.length ? m[k] * HANN[i] : 0;
  }
  fftInPlace(re, im);
  const mag = new Float64Array(N_FFT / 2);
  for (let i = 0; i < N_FFT / 2; i++) mag[i] = Math.hypot(re[i], im[i]) * NORM;
  return mag;
}

/** RBJ biquad, direct form I, in place over a copy. */
function biquad(x: Float32Array, b: number[], a: number[]): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = (b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2) / a[0];
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

/** ITU BS.1770 K-weighting (stage 1 high shelf + stage 2 high pass), coefficients for any sample rate. */
function kWeight(x: Float32Array, sr: number): Float32Array {
  // stage 1: high shelf (+4 dB above ~1.5 kHz)
  let f0 = 1681.974450955533;
  const G = 3.999843853973347;
  let Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * f0) / sr);
  const Vh = Math.pow(10, G / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const s1b = [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0];
  const s1a = [1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0];
  // stage 2: high pass ~38 Hz
  f0 = 38.13547087602444;
  Q = 0.5003270373238773;
  K = Math.tan((Math.PI * f0) / sr);
  a0 = 1 + K / Q + K * K;
  const s2b = [1, -2, 1];
  const s2a = [1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0];
  return biquad(biquad(x, s1b, s1a), s2b, s2a);
}

/** A-weighting gain (linear power) at f. */
function aWeightPow(f: number): number {
  const f2 = f * f;
  const ra = (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
  const g = ra * Math.pow(10, 2.0 / 20);
  return g * g;
}

/** 1/3-octave band edges, 50 Hz – 16 kHz (centres 50 … 16000). */
const THIRDS = (() => {
  const out: { lo: number; hi: number; fc: number }[] = [];
  for (let k = -13; k <= 12; k++) {
    const fc = 1000 * Math.pow(2, k / 3);
    out.push({ fc, lo: fc / Math.pow(2, 1 / 6), hi: fc * Math.pow(2, 1 / 6) });
  }
  return out;
})();

/** Band powers (1/3 octave) of a magnitude spectrum; `aw` = A-weighted. */
function bandPowers(mag: Float64Array, sr: number, aw: boolean): Float64Array {
  const out = new Float64Array(THIRDS.length);
  const hz = sr / N_FFT;
  for (let i = 1; i < mag.length; i++) {
    const f = i * hz;
    for (let b = 0; b < THIRDS.length; b++) {
      if (f >= THIRDS[b].lo && f < THIRDS[b].hi) {
        out[b] += mag[i] * mag[i] * (aw ? aWeightPow(f) : 1);
        break;
      }
    }
  }
  return out;
}

interface Analysis {
  name: string;
  sr: number;
  len: number;
  peakDb: number;
  rmsDb: number;
  punchDb: number;
  punchAt: number;
  onset: number;
  lufsMomentaryMax: number;
  lufsShortMax: number;
  lufsIntegrated: number;
  centroidAttack: number;
  centroidPunch: number;
  centroidMean: number;
  energySplit: { low: number; mid: number; high: number };
  centroidSeries: { t: number; hz: number; db: number }[];
  /** frame spectra (hop HOP) for the LSD, and the long-term A-weighted 1/3-octave profile (dB, 0 = total) */
  frames: Float64Array[];
  frameDb: number[];
  profile: number[];
}

const HOP = 512;

function analyze(r: Rendered): Analysis {
  const sr = r.sr;
  const m = mono(r);
  let peak = 0;
  for (const c of r.ch) for (let i = 0; i < c.length; i++) peak = Math.max(peak, Math.abs(c[i]));
  // len (analyze.ts rule: last 10 ms window above peak −50 dB)
  const w10 = Math.floor(sr * 0.01);
  const thr = peak * Math.pow(10, -50 / 20);
  const thrOn = peak * Math.pow(10, -30 / 20);
  let last = 0;
  let onset = -1;
  for (let i = 0; i + w10 <= m.length; i += w10) {
    let s = 0;
    for (let j = 0; j < w10; j++) s += m[i + j] * m[i + j];
    const rms = Math.sqrt(s / w10);
    if (rms > thr) last = i + w10;
    if (onset < 0 && rms > thrOn) onset = i;
  }
  if (onset < 0) onset = 0;
  let sum = 0;
  for (let i = 0; i < last; i++) sum += m[i] * m[i];
  const rmsDb = dB(last ? Math.sqrt(sum / last) : 0);
  const w50 = Math.floor(sr * 0.05);
  let best = 0;
  let bestAt = 0;
  for (let i = 0; i + w50 <= m.length; i += Math.floor(w50 / 2)) {
    let s = 0;
    for (let j = 0; j < w50; j++) s += m[i + j] * m[i + j];
    const v = Math.sqrt(s / w50);
    if (v > best) {
      best = v;
      bestAt = i;
    }
  }
  // loudness (BS.1770, channel sum of K-weighted mean squares)
  const kw = r.ch.map((c) => kWeight(c, sr));
  const msWin = (a: number, n: number) => {
    let s = 0;
    for (const k of kw) {
      let t = 0;
      for (let i = a; i < a + n && i < k.length; i++) t += k[i] * k[i];
      s += t / n;
    }
    return s;
  };
  const lufs = (ms: number) => (ms > 0 ? -0.691 + 10 * Math.log10(ms) : -120);
  const mWin = Math.floor(sr * 0.4);
  const sWin = Math.floor(sr * 3);
  const step = Math.floor(sr * 0.1);
  let mMax = -120;
  let sMax = -120;
  for (let a = 0; a < m.length; a += step) {
    mMax = Math.max(mMax, lufs(msWin(a, mWin)));
    if (a + sWin <= m.length || a === 0) sMax = Math.max(sMax, lufs(msWin(a, sWin)));
  }
  const integ = last ? lufs(msWin(0, last)) : -120;
  // spectra every HOP (for the LSD) + centroid every 25 ms
  const frames: Float64Array[] = [];
  const frameDb: number[] = [];
  const prof = new Float64Array(THIRDS.length);
  const end = Math.max(last, N_FFT);
  let eLow = 0;
  let eMid = 0;
  let eHigh = 0;
  for (let c = 0; c < end; c += HOP) {
    const mag = frameSpectrum(m, c);
    const bp = bandPowers(mag, sr, true);
    frames.push(bp);
    let tot = 0;
    for (let b = 0; b < bp.length; b++) tot += bp[b];
    frameDb.push(pdB(tot));
    for (let b = 0; b < bp.length; b++) prof[b] += bp[b];
    for (let i = 1; i < mag.length; i++) {
      const f = (i * sr) / N_FFT;
      const p = mag[i] * mag[i];
      if (f < 250) eLow += p;
      else if (f < 4000) eMid += p;
      else eHigh += p;
    }
  }
  let ptot = 0;
  for (const p of prof) ptot += p;
  let pmax = -240;
  const profile = [...prof].map((p) => {
    const v = pdB(p / (ptot || 1));
    pmax = Math.max(pmax, v);
    return v;
  });
  const profFloored = profile.map((v) => Math.max(v, pmax - 60));
  const centroidSeries: { t: number; hz: number; db: number }[] = [];
  const cstep = Math.floor(sr * 0.025);
  let wSum = 0;
  let cwSum = 0;
  for (let c = cstep / 2; c < end; c += cstep) {
    const mag = frameSpectrum(m, Math.floor(c));
    let s = 0;
    let sw = 0;
    for (let i = 1; i < mag.length; i++) {
      const p = mag[i] * mag[i];
      s += p;
      sw += p * ((i * sr) / N_FFT);
    }
    const hz = s > 0 ? sw / s : 0;
    centroidSeries.push({ t: +(c / sr).toFixed(3), hz: Math.round(hz), db: +pdB(s).toFixed(1) });
    wSum += s;
    cwSum += s * hz;
  }
  const centroidAt = (t0: number, t1: number) => {
    let s = 0;
    let w = 0;
    for (const p of centroidSeries)
      if (p.t >= t0 && p.t < t1) {
        const e = Math.pow(10, p.db / 10);
        s += e * p.hz;
        w += e;
      }
    return w ? Math.round(s / w) : 0;
  };
  const eTot = eLow + eMid + eHigh || 1;
  return {
    name: r.name,
    sr,
    len: last / sr,
    peakDb: dB(peak),
    rmsDb,
    punchDb: dB(best),
    punchAt: bestAt / sr,
    onset: onset / sr,
    lufsMomentaryMax: mMax,
    lufsShortMax: sMax,
    lufsIntegrated: integ,
    centroidAttack: centroidAt(onset / sr, onset / sr + 0.1),
    centroidPunch: centroidAt(bestAt / sr, (bestAt + w50) / sr),
    centroidMean: wSum ? Math.round(cwSum / wSum) : 0,
    energySplit: { low: Math.round((100 * eLow) / eTot), mid: Math.round((100 * eMid) / eTot), high: Math.round((100 * eHigh) / eTot) },
    centroidSeries,
    frames,
    frameDb,
    profile: profFloored,
  };
}

function lsd(a: Analysis, b: Analysis): { lsd: number; lsdTime: number } {
  let s = 0;
  for (let i = 0; i < a.profile.length; i++) s += (a.profile[i] - b.profile[i]) ** 2;
  const prof = Math.sqrt(s / a.profile.length);
  // time-aligned at the onsets
  const oa = Math.floor((a.onset * a.sr) / HOP);
  const ob = Math.floor((b.onset * b.sr) / HOP);
  const n = Math.max(a.frames.length - oa, b.frames.length - ob);
  let joint = -240;
  for (const v of [...a.frames, ...b.frames]) for (const p of v) joint = Math.max(joint, pdB(p));
  const floor = joint - 70;
  const audible = Math.max(...a.frameDb, ...b.frameDb) - 50;
  let acc = 0;
  let cnt = 0;
  const zero = new Float64Array(THIRDS.length);
  for (let k = 0; k < n; k++) {
    const fa = a.frames[oa + k] ?? zero;
    const fb = b.frames[ob + k] ?? zero;
    const da = a.frameDb[oa + k] ?? -240;
    const db2 = b.frameDb[ob + k] ?? -240;
    if (da < audible && db2 < audible) continue;
    for (let i = 0; i < THIRDS.length; i++) {
      acc += (Math.max(pdB(fa[i]), floor) - Math.max(pdB(fb[i]), floor)) ** 2;
      cnt++;
    }
  }
  return { lsd: prof, lsdTime: cnt ? Math.sqrt(acc / cnt) : 0 };
}

// ---------------------------------------------------------------- files

function writeWav(file: string, r: Rendered): void {
  const n = r.ch[0].length;
  const chs = r.ch.length;
  const buf = Buffer.alloc(44 + n * chs * 2);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + n * chs * 2, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(chs, 22);
  buf.writeUInt32LE(r.sr, 24);
  buf.writeUInt32LE(r.sr * chs * 2, 28);
  buf.writeUInt16LE(chs * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(n * chs * 2, 40);
  let o = 44;
  for (let i = 0; i < n; i++)
    for (let c = 0; c < chs; c++) {
      buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(r.ch[c][i] * 32767))), o);
      o += 2;
    }
  fs.writeFileSync(file, buf);
}

const CRC_T = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function pngFile(file: string, p: PixelCanvas): void {
  const W = p.w;
  const H = p.h;
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = p.get(x, y) ?? 0;
      const i = y * (W * 3 + 1) + 1 + x * 3;
      raw[i] = (c >> 16) & 255;
      raw[i + 1] = (c >> 8) & 255;
      raw[i + 2] = c & 255;
    }
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const v of b) c = CRC_T[(c ^ v) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (t: string, d: Buffer) => {
    const l = Buffer.alloc(4);
    l.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t, 'ascii'), d]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([l, td, c]);
  };
  const ih = Buffer.alloc(13);
  ih.writeUInt32BE(W, 0);
  ih.writeUInt32BE(H, 4);
  ih[8] = 8;
  ih[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

// a tool picture (not game art): free colours
const FONT = getFont('sm');
function text(p: PixelCanvas, x: number, y: number, s: string, c: number): number {
  let pen = x;
  for (const raw of s) {
    const ch = hasGlyph(raw) ? raw : '?';
    const g = FONT.glyphs.get(ch.charCodeAt(0));
    if (!g) continue;
    drawGlyph(p, g, FONT.def.cellH, pen, y, c);
    pen += g.w + 1;
  }
  return pen - x;
}
/** black → violet → red → orange → yellow → white over t ∈ [0, 1] */
const HEAT: [number, number, number][] = [
  [0, 0, 0],
  [40, 10, 90],
  [140, 20, 120],
  [220, 60, 50],
  [250, 160, 30],
  [255, 240, 140],
  [255, 255, 255],
];
function heat(t: number): number {
  t = Math.max(0, Math.min(1, t)) * (HEAT.length - 1);
  const i = Math.min(HEAT.length - 2, Math.floor(t));
  const f = t - i;
  const c = HEAT[i].map((v, k) => Math.round(v + (HEAT[i + 1][k] - v) * f));
  return (c[0] << 16) | (c[1] << 8) | c[2];
}

const PW = 800; // plot width
const WAVE_H = 70;
const SPEC_H = 200;
const HEAD = 24;
const AX = 34; // left axis gutter
const F_LO = 40;
const F_HI = 16000;

function picture(r: Rendered, a: Analysis, view: number): PixelCanvas {
  const W = AX + PW + 8;
  const H = HEAD + WAVE_H + 6 + SPEC_H + 14;
  const p = new PixelCanvas(W, H);
  p.rect(0, 0, W, H, 0x101018);
  const f1 = (v: number) => v.toFixed(1);
  text(p, 4, 2, `${a.name}${RAW ? '  (raw)' : ''}  look ${LOOK}`, 0xffffff);
  text(
    p,
    4,
    12,
    `len ${a.len.toFixed(2)}s  peak ${f1(a.peakDb)} dBFS  rms ${f1(a.rmsDb)}  punch ${f1(a.punchDb)} @${a.punchAt.toFixed(2)}s  LUFS M ${f1(a.lufsMomentaryMax)} S ${f1(a.lufsShortMax)} I ${f1(a.lufsIntegrated)}  centroid atk ${a.centroidAttack} / punch ${a.centroidPunch} / mean ${a.centroidMean} Hz  L/M/H ${a.energySplit.low}/${a.energySplit.mid}/${a.energySplit.high}%`,
    0xb8c0d8,
  );
  const m = mono(r);
  const total = Math.min(m.length, Math.floor(view * r.sr));
  // waveform
  const wy = HEAD;
  p.rect(AX, wy, PW, WAVE_H, 0x181828);
  const mid = wy + WAVE_H / 2;
  const half = WAVE_H / 2 - 1;
  const six = Math.pow(10, -6 / 20);
  p.hline(AX, AX + PW - 1, Math.round(mid - six * half), 0x303048);
  p.hline(AX, AX + PW - 1, Math.round(mid + six * half), 0x303048);
  p.hline(AX, AX + PW - 1, Math.round(mid), 0x383850);
  for (let x = 0; x < PW; x++) {
    const i0 = Math.floor((x / PW) * view * r.sr);
    const i1 = Math.max(i0 + 1, Math.floor(((x + 1) / PW) * view * r.sr));
    let lo = 0;
    let hi = 0;
    let s = 0;
    let n = 0;
    for (const c of r.ch)
      for (let i = i0; i < i1 && i < c.length; i++) {
        lo = Math.min(lo, c[i]);
        hi = Math.max(hi, c[i]);
      }
    for (let i = i0; i < i1 && i < m.length; i++) {
      s += m[i] * m[i];
      n++;
    }
    const rms = n ? Math.sqrt(s / n) : 0;
    const clip = hi >= 0.99 || lo <= -0.99;
    p.vline(AX + x, Math.round(mid - hi * half), Math.round(mid - lo * half), clip ? 0xff4040 : 0x4a78c8);
    if (rms > 0) p.vline(AX + x, Math.round(mid - rms * half), Math.round(mid + rms * half), 0x9cc8ff);
  }
  text(p, 2, wy, '+1', 0x8088a0);
  text(p, 2, wy + WAVE_H - 9, '-1', 0x8088a0);
  // spectrogram
  const sy = HEAD + WAVE_H + 6;
  const cols = PW;
  const rows = SPEC_H;
  for (let x = 0; x < cols; x++) {
    const c = Math.floor(((x + 0.5) / cols) * total);
    const mag = frameSpectrum(m, c);
    for (let y = 0; y < rows; y++) {
      const fa = F_LO * Math.pow(F_HI / F_LO, (rows - 1 - y) / rows);
      const fb = F_LO * Math.pow(F_HI / F_LO, (rows - y) / rows);
      const b0 = Math.max(1, Math.floor((fa / r.sr) * N_FFT));
      const b1 = Math.max(b0 + 1, Math.ceil((fb / r.sr) * N_FFT));
      let best = 0;
      for (let i = b0; i < b1 && i < mag.length; i++) best = Math.max(best, mag[i]);
      p.set(AX + x, sy + y, heat((dB(best) + 90) / 90));
    }
  }
  const fy = (f: number) => sy + Math.round((rows - 1) * (1 - Math.log(f / F_LO) / Math.log(F_HI / F_LO)));
  for (const f of [100, 1000, 10000]) {
    const y = fy(f);
    for (let x = 0; x < PW; x += 4) p.set(AX + x, y, 0x60a0a0);
    text(p, 2, y - 4, f >= 1000 ? `${f / 1000}k` : String(f), 0x90c0c0);
  }
  for (const f of [200, 500, 2000, 5000]) {
    const y = fy(f);
    for (let x = 0; x < PW; x += 12) p.set(AX + x, y, 0x406868);
  }
  // centroid
  for (const c of a.centroidSeries) {
    if (c.t > view || c.hz < F_LO || c.db < Math.max(...a.frameDb) - 45) continue;
    const x = AX + Math.round((c.t / view) * PW);
    const y = fy(Math.min(F_HI, c.hz));
    p.rect(x - 1, y - 1, 2, 2, 0x40ffff);
  }
  // time axis
  const ty = sy + rows + 1;
  for (let t = 0; t <= view + 1e-6; t += 0.1) {
    const x = AX + Math.min(PW - 1, Math.round((t / view) * PW));
    const major = Math.abs(t / 0.5 - Math.round(t / 0.5)) < 1e-6;
    p.vline(x, ty, ty + (major ? 3 : 1), 0x8088a0);
    if (major) text(p, x + 2, ty + 2, `${t.toFixed(1)}s`, 0x8088a0);
  }
  return p;
}

// ---------------------------------------------------------------- main

const want = [...new Set([...names, ...COMPARE.flat()])];
const { all, rendered, missing } = await renderAll(!!LIST, want);
if (LIST) {
  const re = LIST === 'true' ? null : new RegExp(LIST);
  const l = all.filter((n) => !re || re.test(n));
  console.log(l.join('\n'));
  console.error(`${l.length} / ${all.length} recipes`);
  process.exit(0);
}
if (missing.length) {
  console.error(`unknown recipe name(s): ${missing.join(', ')}  (see --list)`);
  if (!rendered.length) process.exit(2);
}
if (!rendered.length) {
  console.error('nothing matched');
  process.exit(2);
}
fs.mkdirSync(OUT, { recursive: true });
const tagOf = (n: string) => `${n.replace(/[^A-Za-z0-9_.-]/g, '_')}${RAW ? '-raw' : ''}${LOOK === 'v1' ? '-v1' : ''}`;
const analyses = new Map<string, Analysis>();
for (const r of rendered) analyses.set(r.name, analyze(r));
const view = Number(opt('view') ?? Math.max(0.5, Math.max(...[...analyses.values()].map((a) => a.len)) + 0.15));
const pics: PixelCanvas[] = [];
for (const r of rendered) {
  const a = analyses.get(r.name)!;
  if (DO_WAV) writeWav(path.join(OUT, `${tagOf(r.name)}.wav`), r);
  if (DO_PNG) {
    const pic = picture(r, a, view);
    pngFile(path.join(OUT, `${tagOf(r.name)}.png`), pic);
    pics.push(pic);
  }
}
if (DO_PNG && pics.length > 1) {
  const W = Math.max(...pics.map((p) => p.w));
  const H = pics.reduce((s, p) => s + p.h + 2, 0);
  const sh = new PixelCanvas(W, H);
  sh.rect(0, 0, W, H, 0x000000);
  let y = 0;
  for (const p of pics) {
    sh.blit(p, 0, y);
    y += p.h + 2;
  }
  pngFile(path.join(OUT, 'sheet.png'), sh);
}

// table
const f1 = (v: number) => v.toFixed(1);
const hdr = ['name'.padEnd(26), 'len s', 'peak', 'rms', 'punch', 'LUFS-M', 'LUFS-S', 'LUFS-I', 'cAtk Hz', 'cPunch', 'cMean', 'L/M/H %'];
console.log(hdr.map((h, i) => (i ? h.padStart(8) : h)).join(''));
for (const a of analyses.values()) {
  const row = [a.len.toFixed(2), f1(a.peakDb), f1(a.rmsDb), f1(a.punchDb), f1(a.lufsMomentaryMax), f1(a.lufsShortMax), f1(a.lufsIntegrated), String(a.centroidAttack), String(a.centroidPunch), String(a.centroidMean), `${a.energySplit.low}/${a.energySplit.mid}/${a.energySplit.high}`];
  console.log(a.name.padEnd(26).slice(0, 26) + row.map((v) => v.padStart(8)).join(''));
  const warn: string[] = [];
  if (a.peakDb > -1) warn.push(`peak ${f1(a.peakDb)} dBFS > −1 dBFS`);
  if (a.peakDb < -40) warn.push('nearly silent');
  if (warn.length) console.log(`  WARN ${a.name}: ${warn.join('; ')}`);
}
// comparisons
const comparisons: { a: string; b: string; lsd: number; lsdTime: number }[] = [];
for (const group of COMPARE) {
  for (let i = 0; i < group.length; i++)
    for (let j = i + 1; j < group.length; j++) {
      const A = analyses.get(group[i]);
      const B = analyses.get(group[j]);
      if (!A || !B) {
        console.log(`compare ${group[i]} vs ${group[j]}: missing render`);
        continue;
      }
      const d = lsd(A, B);
      comparisons.push({ a: A.name, b: B.name, lsd: +d.lsd.toFixed(2), lsdTime: +d.lsdTime.toFixed(2) });
      console.log(`compare ${A.name} vs ${B.name}: LSD ${d.lsd.toFixed(1)} dB (SE-4 profile, 1/3 oct A-wtd)  LSDtime ${d.lsdTime.toFixed(1)} dB${d.lsd < 10 ? '   ← < 10 dB: close identities' : ''}`);
    }
}
const report = {
  look: LOOK,
  raw: RAW,
  seed: SEED,
  sampleRate: SR,
  view,
  sounds: [...analyses.values()].map(({ frames: _f, frameDb: _d, profile, centroidSeries, ...rest }) => ({
    ...Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(3) : v])),
    profileDb: profile.map((v, i) => ({ fc: Math.round(THIRDS[i].fc), db: +v.toFixed(1) })),
    centroidSeries,
  })),
  comparisons,
};
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
console.log(`→ ${path.relative(ROOT, OUT)}/ (${DO_PNG && pics.length > 1 ? 'sheet.png first' : rendered.map((r) => tagOf(r.name) + '.png').join(', ')}; report.json)`);
