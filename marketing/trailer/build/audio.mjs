#!/usr/bin/env node
// Renders the trailer soundtrack offline: the sfx each captured shot logged (cache/<shot>/sfx.json) laid on the
// edit timeline (shots.mjs) + the duel music, through the game's master chain in headless Chromium
// (src/dev/trailer-audio.ts). Output: marketing/trailer/build/cache/soundtrack_raw.wav (48 kHz, stereo, float32)
// and cache/cues.json (every cue with its timeline time — the sync check).
//
//   node marketing/trailer/build/audio.mjs
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { chromePath, startServer, ROOT } from '../../../tools/lib/pagekit.mjs';
import { timeline, BAR_SEC, FPS, BPM } from './shots.mjs';

const CACHE = path.join(ROOT, 'marketing/trailer/build/cache');
const SR = 48000;
const tl = timeline();
const total = Math.max(...tl.map((s) => s.start + s.len)) / FPS;
const sd = 60 / BPM / 4;
const SYNC_FRAMES = 1;

/** Music: the duel track from its top. The intensity plan builds the arrangement (cool groove → hot layer). */
const MUSIC = {
  at: 0,
  // to the downbeat of bar 32 (+ half a sixteenth): the loop's first step is the final hit (kick, crash, Em pad)
  seconds: 32 * BAR_SEC + sd * 0.5,
  volume: 0.36,
  // the music bus level along the edit: the cold open leaves room for the summon, the montage sits under the
  // card sounds, the board turn breathes, the climax and the end card open up
  volumeAt: [
    [1.9 * BAR_SEC, 0.36],
    [2 * BAR_SEC, 0.5],
    [3.9 * BAR_SEC, 0.5],
    [4 * BAR_SEC, 0.56],
    [19.9 * BAR_SEC, 0.56],
    [20.2 * BAR_SEC, 0.46],
    [22.8 * BAR_SEC, 0.46],
    [23 * BAR_SEC, 0.62],
    [32 * BAR_SEC, 0.66],
  ],
  intensity: 0,
  intensityAt: [
    [3.75 * BAR_SEC, 1], // drum fill into bar 4: the montage starts on the hot layer
    [20 * BAR_SEC, 0.35], // the board turn breathes
    [22.75 * BAR_SEC, 1], // fill into the climax
  ],
};

/** Per-shot sfx level (text cards are a touch quieter than the game moments). */
const GAIN = { card0: 0.85, card1: 0.85, card2: 0.85, card3: 0.85 };

const shots = [];
const allCues = [];
for (const s of tl) {
  const f = path.join(CACHE, s.name, 'sfx.json');
  if (!fs.existsSync(f)) {
    console.log(`[audio] ${s.name}: no capture`);
    continue;
  }
  const log = JSON.parse(fs.readFileSync(f, 'utf8'));
  const a = s.start / FPS;
  const b = (s.start + s.len) / FPS;
  const cues = [];
  const fades = [];
  for (const c of log.cues) {
    if (c.f < -90 || c.f > s.len) continue; // started > 1.5 s before the cut-in, or after the cut
    // + 1 frame: a sound triggered in the update of frame f shows its picture on frame f + 1 (measured: the
    // Ashen Drake ignition cue logs on f 60, its burst is first drawn on f 61)
    const t = a + (c.f + SYNC_FRAMES) / FPS;
    if (c.fade) fades.push({ t, names: c.fade, ms: c.ms });
    else {
      cues.push({ t, name: c.name, opts: c.opts, stopT: c.stopF !== undefined ? a + c.stopF / FPS : undefined, stopMs: c.stopMs });
      allCues.push({ shot: s.name, frame: c.f, t: +t.toFixed(3), name: c.name, vol: c.opts?.volume ?? 1 });
    }
  }
  shots.push({ name: s.name, a, b, cues, fades, gain: GAIN[s.name] ?? 1 });
}
fs.writeFileSync(path.join(CACHE, 'cues.json'), JSON.stringify(allCues, null, 1));
console.log(`[audio] ${shots.length} shots, ${allCues.length} cues, ${total.toFixed(2)} s`);

// STEM=music | sfx renders one side alone (for the level check); the default is the full mix
const STEM = process.env.STEM ?? '';
const plan = { seconds: total + 0.05, sampleRate: SR, shots: STEM === 'music' ? [] : shots, music: STEM === 'sfx' ? null : MUSIC, release: 0.06, seed: 4242 };
const OUTWAV = STEM ? `stem_${STEM}.wav` : 'soundtrack_raw.wav';

const { server, base } = await startServer();
const browser = await chromium.launch({ executablePath: chromePath(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.setDefaultTimeout(600000);
  page.on('console', (m) => m.type() === 'error' && console.log('[page]', m.text()));
  await page.goto(base + '?dev=trailer&card=0&test=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__neon && window.__neon.ready === true, null, { timeout: 120000 });
  const res = await page.evaluate(async (plan) => {
    const m = await import('/src/dev/trailer-audio.ts');
    const r = await m.renderTrailerAudio(plan);
    const enc = (f) => {
      const u8 = new Uint8Array(f.buffer, f.byteOffset, f.byteLength);
      let s = '';
      for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return btoa(s);
    };
    return { L: enc(r.L), R: enc(r.R), built: r.built, skipped: r.skipped };
  }, plan);
  const L = new Float32Array(new Uint8Array(Buffer.from(res.L, 'base64')).buffer);
  const R = new Float32Array(new Uint8Array(Buffer.from(res.R, 'base64')).buffer);
  console.log(`[audio] built ${res.built} voices (skipped ${res.skipped}), ${L.length} samples`);
  // 32-bit float WAV
  const n = L.length;
  const data = Buffer.alloc(n * 8);
  for (let i = 0; i < n; i++) {
    data.writeFloatLE(L[i], i * 8);
    data.writeFloatLE(R[i], i * 8 + 4);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(3, 20); // IEEE float
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 8, 28);
  h.writeUInt16LE(8, 32);
  h.writeUInt16LE(32, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(CACHE, OUTWAV), Buffer.concat([h, data]));
  console.log(`[audio] wrote cache/${OUTWAV}`);
} finally {
  await browser.close();
  await server.close();
}
