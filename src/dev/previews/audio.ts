// ?dev=audio — every synthesized sound rendered offline (OfflineAudioContext, through the real
// master chain) and drawn as a thumbnail. This is how sounds are verified headless.
//   &page=grid   (default) 8×8 tiles: waveform (teal), RMS envelope (gold), raw-voice peak line;
//                stats: length · post-chain peak · loudest-50ms dB. Red frame = clipping risk,
//                red name = silent. Click a tile to play it live.
//   &page=spec&p=0..3  4×4 tiles with log-frequency spectrograms (40 Hz – 16 kHz).
//   &page=one&name=<sfx>  one sound, big: raw vs chain waveform, RMS, spectrogram, stats.
//   &page=music  title / duel (intensity 0 and 1) / duel loop seam / victory, rendered offline;
//                top buttons play live (title · duel · victory · stop · intensity 0 / ½ / 1).
//   &page=score  piano roll of the composed melodies (duel lead, title bells, victory) over chord roots.
//   &log=1       print a stats table to the console (shows in tools/shot.mjs output).
import type Phaser from 'phaser';
import { PAL, css } from '../../art/palette';
import { pixelText } from '../../ui/text';
import { music, renderSfx, sfx, SFX_NAMES, type MusicTrack, type SfxName } from '../../audio/sfx';
import { renderMusic, SCORE, trackInfo } from '../../audio/music';
import { columns, spectrogram, stats, type Stats } from '../../audio/analyze';
import type { DevPreview } from '../types';

const W = 640;
const H = 360;

/** Spectrogram colour steps (quiet → loud), palette only. */
const SPEC_RAMP = [PAL.night0, PAL.night1, PAL.night2, PAL.void1, PAL.void2, PAL.mag1, PAL.mag2, PAL.crim3, PAL.fire3, PAL.gold3, PAL.gold4, PAL.white].map(css);

function canvas(): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = css(PAL.night0);
  g.fillRect(0, 0, W, H);
  return { c, g };
}

function show(scene: Phaser.Scene, c: HTMLCanvasElement, key: string): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, c);
  scene.add.image(0, 0, key).setOrigin(0, 0);
}

function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: number): void {
  g.fillStyle = css(color);
  g.fillRect(x, y, w, h);
}

function frame(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: number): void {
  rect(g, x, y, w, 1, color);
  rect(g, x, y + h - 1, w, 1, color);
  rect(g, x, y, 1, h, color);
  rect(g, x + w - 1, y, 1, h, color);
}

/** Waveform (min/max columns, teal), RMS envelope (gold) and an optional raw-peak marker. */
function drawWave(g: CanvasRenderingContext2D, b: AudioBuffer, x: number, y: number, w: number, h: number, len: number, o: { color?: number; rms?: boolean; rawPeak?: number } = {}): void {
  rect(g, x, y, w, h, PAL.ink);
  const mid = y + Math.floor(h / 2);
  rect(g, x, mid, w, 1, PAL.night2);
  const half = (h - 2) / 2;
  const { min, max, rms } = columns(b, w, len);
  g.fillStyle = css(o.color ?? PAL.teal3);
  for (let i = 0; i < w; i++) {
    const top = Math.round(mid - Math.min(1, max[i]) * half);
    const bot = Math.round(mid - Math.max(-1, min[i]) * half);
    g.fillRect(x + i, top, 1, Math.max(1, bot - top + 1));
  }
  if (o.rms !== false) {
    g.fillStyle = css(PAL.gold3);
    for (let i = 0; i < w; i++) {
      const r = Math.min(1, rms[i] * 1.4142);
      if (r * half < 1) continue;
      g.fillRect(x + i, Math.round(mid - r * half), 1, 1);
      g.fillRect(x + i, Math.round(mid + r * half), 1, 1);
    }
  }
  if (o.rawPeak !== undefined) {
    // dashed line at the raw (pre-chain) peak level
    const py = Math.round(mid - Math.min(1, o.rawPeak) * half);
    g.fillStyle = css(o.rawPeak > 1 ? PAL.crim3 : PAL.cyan1);
    for (let i = 0; i < w; i += 3) g.fillRect(x + i, py, 1, 1);
  }
}

function drawSpec(g: CanvasRenderingContext2D, b: AudioBuffer, x: number, y: number, w: number, h: number, len: number): void {
  const sp = spectrogram(b, w, h, len);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const v = sp[r * w + c]; // dB
      const k = Math.max(0, Math.min(SPEC_RAMP.length - 1, Math.floor(((v + 96) / 96) * SPEC_RAMP.length)));
      g.fillStyle = SPEC_RAMP[k];
      g.fillRect(x + c, y + r, 1, 1);
    }
  }
  // octave guides at 100 Hz, 1 kHz, 10 kHz
  for (const f of [100, 1000, 10000]) {
    const ry = Math.round(h - (Math.log(f / 40) / Math.log(16000 / 40)) * h);
    g.fillStyle = css(PAL.night3);
    for (let c = 0; c < w; c += 4) g.fillRect(x + c, y + ry, 1, 1);
  }
}

interface Analysed {
  name: SfxName;
  s: Stats;
  raw: Stats;
  buf: AudioBuffer;
}

async function analyse(name: SfxName, keepRaw = false): Promise<(Analysed & { rawBuf?: AudioBuffer }) | null> {
  const [buf, rawBuf] = await Promise.all([renderSfx(name, { seconds: 3.6 }), renderSfx(name, { seconds: 3.2, chain: false })]);
  if (!buf || !rawBuf) return null;
  return { name, s: stats(buf), raw: stats(rawBuf), buf, rawBuf: keepRaw ? rawBuf : undefined };
}

/** Thumbnail time axis: the dry sound plus a bit of its reverb tail. */
function axis(a: Analysed): number {
  return Math.max(0.2, Math.min(a.s.len, a.raw.len + 0.45) + 0.03);
}

function fmtLen(s: number): string {
  return s >= 1 ? `${s.toFixed(2)}s` : `${Math.round(s * 1000)}ms`;
}

function report(list: Analysed[], log: boolean): void {
  for (const a of list) {
    if (a.s.peak < 0.005) window.__neon.errors.push(`audio: ${a.name} is silent`);
    if (a.s.peak >= 0.99) window.__neon.errors.push(`audio: ${a.name} clips after the chain (peak ${a.s.peak.toFixed(3)})`);
  }
  if (!log) return;
  const rows = list.map(
    (a) =>
      `${a.name.padEnd(14)} len ${a.raw.len.toFixed(2).padStart(5)}s  raw pk ${a.raw.peak.toFixed(2)}  chain pk ${a.s.peak.toFixed(2)}  loud ${a.s.maxWinDb.toFixed(1).padStart(6)} dB  rms ${a.s.rmsDb.toFixed(1).padStart(6)} dB`,
  );
  console.warn('[audio stats]\n' + rows.join('\n'));
}

async function inBatches<T, R>(items: readonly T[], n: number, f: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += n) {
    out.push(...(await Promise.all(items.slice(i, i + n).map(f))));
    await new Promise((r) => setTimeout(r, 0)); // keep the page responsive
  }
  return out;
}

/** Heavy offline rendering must not start before window 'load' (it can starve the page load). */
function afterLoad(): Promise<void> {
  if (document.readyState === 'complete') return Promise.resolve();
  return new Promise((r) => window.addEventListener('load', () => r(), { once: true }));
}

function tileClicks(scene: Phaser.Scene, hit: (x: number, y: number) => SfxName | null, flash: (n: SfxName) => void): void {
  scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
    sfx.unlock();
    const n = hit(p.x, p.y);
    if (n) {
      sfx.play(n);
      flash(n);
    }
  });
}

function flashRect(scene: Phaser.Scene, x: number, y: number, w: number, h: number): void {
  const r = scene.add.rectangle(x, y, w, h, PAL.white, 0.35).setOrigin(0, 0);
  scene.tweens.add({ targets: r, alpha: 0, duration: 400, onComplete: () => r.destroy() });
}

// ------------------------------------------------------------------ pages

async function pageGrid(scene: Phaser.Scene, log: boolean): Promise<void> {
  const { c, g } = canvas();
  const list = (await inBatches(SFX_NAMES, 8, (n) => analyse(n))).filter((a): a is NonNullable<typeof a> => !!a);
  const TW = 80;
  const TH = 45;
  const pos = (i: number) => ({ x: (i % 8) * TW, y: Math.floor(i / 8) * TH });
  list.forEach((a, i) => {
    const { x, y } = pos(i);
    rect(g, x + 1, y + 1, TW - 2, TH - 2, PAL.night1);
    drawWave(g, a.buf, x + 2, y + 10, TW - 4, 24, axis(a), { rawPeak: a.raw.peak });
    const bad = a.s.peak >= 0.98 || a.raw.peak > 1;
    if (bad) frame(g, x, y, TW, TH, PAL.crim3);
  });
  show(scene, c, 'dev-audio-grid');
  list.forEach((a, i) => {
    const { x, y } = pos(i);
    pixelText(scene, x + 2, y + 1, a.name, { size: 'sm', color: a.s.peak < 0.005 ? PAL.crim3 : PAL.gold3 });
    pixelText(scene, x + 2, y + 35, `${fmtLen(a.raw.len)} ${a.s.peak.toFixed(2).replace(/^0/, '')} ${Math.round(a.s.maxWinDb)}`, { size: 'sm', color: PAL.mist });
  });
  const lx = pos(list.length).x + 2;
  const ly = pos(list.length).y + 2;
  pixelText(scene, lx, ly, 'süre · tepe · dB', { size: 'sm', color: PAL.mist });
  pixelText(scene, lx, ly + 10, 'tıkla: çal', { size: 'sm', color: PAL.teal3 });
  pixelText(scene, lx, ly + 20, `${list.length} ses`, { size: 'sm', color: PAL.gold3 });
  report(list, log);
  tileClicks(
    scene,
    (px, py) => {
      const i = Math.floor(py / TH) * 8 + Math.floor(px / TW);
      return list[i]?.name ?? null;
    },
    (n) => {
      const p = pos(list.findIndex((a) => a.name === n));
      flashRect(scene, p.x, p.y, TW, TH);
    },
  );
}

async function pageSpec(scene: Phaser.Scene, page: number, log: boolean): Promise<void> {
  const { c, g } = canvas();
  const names = SFX_NAMES.slice(page * 16, page * 16 + 16);
  const list = (await inBatches(names, 8, (n) => analyse(n))).filter((a): a is NonNullable<typeof a> => !!a);
  const TW = 160;
  const TH = 90;
  const pos = (i: number) => ({ x: (i % 4) * TW, y: Math.floor(i / 4) * TH });
  list.forEach((a, i) => {
    const { x, y } = pos(i);
    rect(g, x + 1, y + 1, TW - 2, TH - 2, PAL.night1);
    const len = axis(a);
    drawSpec(g, a.buf, x + 2, y + 10, TW - 4, 60, len);
    drawWave(g, a.buf, x + 2, y + 71, TW - 4, 17, len, { rawPeak: a.raw.peak });
  });
  show(scene, c, `dev-audio-spec-${page}`);
  list.forEach((a, i) => {
    const { x, y } = pos(i);
    pixelText(scene, x + 2, y + 1, a.name, { size: 'sm', color: PAL.gold3 });
    pixelText(scene, x + TW - 2, y + 1, `${fmtLen(a.raw.len)} ${a.s.peak.toFixed(2)} ${Math.round(a.s.maxWinDb)}dB`, { size: 'sm', color: PAL.mist, originX: 1 });
  });
  report(list, log);
  tileClicks(
    scene,
    (px, py) => list[Math.floor(py / TH) * 4 + Math.floor(px / TW)]?.name ?? null,
    (n) => {
      const p = pos(list.findIndex((a) => a.name === n));
      flashRect(scene, p.x, p.y, TW, TH);
    },
  );
}

async function pageOne(scene: Phaser.Scene, name: SfxName, log: boolean): Promise<void> {
  const { c, g } = canvas();
  const a = await analyse(name, true);
  if (!a) {
    pixelText(scene, 8, 8, `render failed: ${name}`, { size: 'md', color: PAL.crim3 });
    return;
  }
  const len = Math.max(0.3, axis(a) + 0.1);
  drawWave(g, a.rawBuf!, 8, 20, 624, 70, len, { color: PAL.cyan1, rms: false });
  drawWave(g, a.buf, 8, 96, 624, 70, len, { rawPeak: a.raw.peak });
  drawSpec(g, a.buf, 8, 176, 624, 170, len);
  // time ticks every 100 ms
  for (let t = 0; t <= len; t += 0.1) {
    const x = 8 + Math.round((t / len) * 623);
    rect(g, x, 347, 1, Math.round(t * 10) % 5 === 0 ? 4 : 2, PAL.steel);
  }
  show(scene, c, 'dev-audio-one');
  pixelText(scene, 8, 4, name, { size: 'md', color: PAL.gold3 });
  pixelText(
    scene,
    632,
    5,
    `süre ${fmtLen(a.raw.len)} (+yankı ${fmtLen(a.s.len)}) · ham tepe ${a.raw.peak.toFixed(2)} · zincir tepe ${a.s.peak.toFixed(2)} · en yüksek ${a.s.maxWinDb.toFixed(1)} dB @${Math.round(a.s.peakAt * 1000)}ms`,
    { size: 'sm', color: PAL.mist, originX: 1 },
  );
  pixelText(scene, 12, 22, 'ham ses', { size: 'sm', color: PAL.cyan3 });
  pixelText(scene, 12, 98, 'master zinciri + yankı', { size: 'sm', color: PAL.teal3 });
  pixelText(scene, 12, 178, '16 kHz', { size: 'sm', color: PAL.mist });
  pixelText(scene, 12, 336, '40 Hz', { size: 'sm', color: PAL.mist });
  pixelText(scene, 632, 350, `${Math.round(len * 1000)} ms`, { size: 'sm', color: PAL.steel, originX: 1 });
  report([a], log);
  tileClicks(scene, () => name, () => flashRect(scene, 0, 0, W, H));
}

async function pageMusic(scene: Phaser.Scene, log: boolean): Promise<void> {
  const { c, g } = canvas();
  const duelLoop = trackInfo('duel');
  const rows: Array<{ label: string; track: MusicTrack; secs: number; intensity?: number; startStep?: number; seam?: number }> = [
    { label: 'title · 84 bpm · Re minör', track: 'title', secs: 16 },
    { label: 'duel · yoğunluk 0', track: 'duel', secs: 14 },
    { label: 'duel · yoğunluk 1', track: 'duel', secs: 14, intensity: 1 },
    { label: 'duel · döngü dikişi (yoğunluk 1)', track: 'duel', secs: 7, intensity: 1, startStep: duelLoop.loopSteps - 32, seam: 32 * (duelLoop.loopSec / duelLoop.loopSteps) },
    { label: 'victory · fanfar → sakin döngü', track: 'victory', secs: 16 },
  ];
  const bufs: Array<AudioBuffer | null> = [];
  for (const r of rows) bufs.push(await renderMusic(r.track, r.secs, { intensity: r.intensity, startStep: r.startStep }));
  const top = 16;
  const RH = 68;
  rows.forEach((r, i) => {
    const b = bufs[i];
    const y = top + i * RH;
    rect(g, 1, y + 1, W - 2, RH - 2, PAL.night1);
    if (!b) return;
    drawWave(g, b, 4, y + 10, W - 8, 18, r.secs, {});
    drawSpec(g, b, 4, y + 29, W - 8, 37, r.secs);
    if (r.seam !== undefined) {
      const sx = 4 + Math.round((r.seam / r.secs) * (W - 8));
      rect(g, sx, y + 10, 1, 56, PAL.crim3);
    }
    // bar ticks
    const info = trackInfo(r.track);
    const barSec = (info.loopSec / info.loopSteps) * 16;
    for (let t = 0; t < r.secs; t += barSec) rect(g, 4 + Math.round((t / r.secs) * (W - 8)), y + 9, 1, 1, PAL.steel);
  });
  // control bar
  const buttons: Array<{ label: string; run: () => void }> = [
    { label: 'title', run: () => music.play('title') },
    { label: 'duel', run: () => music.play('duel') },
    { label: 'victory', run: () => music.play('victory') },
    { label: 'stop', run: () => music.stop(800) },
    { label: 'yoğunluk 0', run: () => music.setIntensity(0) },
    { label: '.5', run: () => music.setIntensity(0.5) },
    { label: '1', run: () => music.setIntensity(1) },
    { label: 'ROAR', run: () => sfx.play('roarBig') },
  ];
  let bx = 4;
  const hits: Array<{ x: number; w: number; run: () => void }> = [];
  for (const btn of buttons) {
    const w = btn.label.length * 5 + 10;
    rect(g, bx, 2, w, 12, PAL.night2);
    frame(g, bx, 2, w, 12, PAL.teal2);
    hits.push({ x: bx, w, run: btn.run });
    bx += w + 4;
  }
  show(scene, c, 'dev-audio-music');
  for (const h of hits) pixelText(scene, h.x + 5, 4, buttons[hits.indexOf(h)].label, { size: 'sm', color: PAL.teal4 });
  rows.forEach((r, i) => {
    const b = bufs[i];
    const y = top + i * RH;
    const st = b ? stats(b) : null;
    pixelText(scene, 4, y + 1, r.label, { size: 'sm', color: PAL.gold3 });
    if (st) pixelText(scene, W - 4, y + 1, `${r.secs}s · tepe ${st.peak.toFixed(2)} · rms ${st.rmsDb.toFixed(1)} dB`, { size: 'sm', color: PAL.mist, originX: 1 });
    if (st && st.peak >= 0.99) window.__neon.errors.push(`audio: music ${r.label} clips (${st.peak.toFixed(3)})`);
    if (st && st.peak < 0.01) window.__neon.errors.push(`audio: music ${r.label} is silent`);
    if (log && st) console.warn(`[music] ${r.label}: peak ${st.peak.toFixed(3)} rms ${st.rmsDb.toFixed(1)} loud ${st.maxWinDb.toFixed(1)}`);
  });
  const status = pixelText(scene, bx + 4, 4, '', { size: 'sm', color: PAL.mist });
  scene.time.addEvent({ delay: 250, loop: true, callback: () => status.setText(`çalan: ${music.current() ?? '-'}`) });
  scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
    sfx.unlock();
    if (p.y > 16) return;
    const h = hits.find((q) => p.x >= q.x && p.x < q.x + q.w);
    if (h) {
      h.run();
      flashRect(scene, h.x, 2, h.w, 12);
    }
  });
}

/** Piano roll of every composed line (from the score data): pitch rows, 16th columns, chord roots. */
function pageScore(scene: Phaser.Scene): void {
  const { c, g } = canvas();
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const entries = Object.entries(SCORE);
  const RH = 88;
  const labels: Array<[number, number, string, number]> = [];
  entries.forEach(([name, sc], i) => {
    const y0 = 2 + i * RH;
    const notes = [...sc.notes.entries()];
    const lo = Math.min(...notes.map(([, n]) => n.m)) - 1;
    const hi = Math.max(...notes.map(([, n]) => n.m)) + 1;
    const rows = hi - lo + 1;
    const ph = Math.max(2, Math.min(4, Math.floor((RH - 14) / rows)));
    const cw = Math.min(4, Math.floor(600 / sc.steps));
    const x0 = 36;
    const top = y0 + 10;
    rect(g, x0, top, sc.steps * cw, rows * ph, PAL.night1);
    for (let m = lo; m <= hi; m++) {
      const ry = top + (hi - m) * ph;
      if ([1, 3, 6, 8, 10].includes(m % 12)) rect(g, x0, ry, sc.steps * cw, ph, PAL.ink);
      if (m % 12 === 0) labels.push([4, ry - 2, `C${Math.floor(m / 12) - 1}`, PAL.steel]);
    }
    for (let st = 0; st <= sc.steps; st += 16) rect(g, x0 + st * cw, top, 1, rows * ph, st % sc.chordSteps === 0 ? PAL.steel : PAL.night3);
    sc.chords.forEach((root, k) => labels.push([x0 + k * sc.chordSteps * cw + 2, top + rows * ph + 1, NAMES[root % 12], PAL.teal3]));
    for (const [st, n] of notes) {
      const ry = top + (hi - n.m) * ph;
      rect(g, x0 + st * cw, ry, Math.max(1, n.len * cw - 1), ph, PAL.gold3);
      rect(g, x0 + st * cw, ry, 1, ph, PAL.white);
    }
    labels.push([x0, y0, `${name} · ${notes.length} nota · ${NAMES[lo % 12]}${Math.floor(lo / 12) - 1}–${NAMES[hi % 12]}${Math.floor(hi / 12) - 1}`, PAL.gold3]);
  });
  show(scene, c, 'dev-audio-score');
  for (const [x, y, t, col] of labels) pixelText(scene, x, y, t, { size: 'sm', color: col });
}

const preview: DevPreview = {
  name: 'audio',
  description: 'synth sfx + music rendered offline: &page=grid|spec&p=0..3|one&name=<sfx>|music, &log=1',
  async create(scene, params) {
    const page = params.get('page') ?? 'grid';
    const log = params.get('log') === '1';
    await afterLoad();
    if (typeof OfflineAudioContext === 'undefined') {
      pixelText(scene, 8, 8, 'OfflineAudioContext yok — ses önizlemesi çalışamaz', { size: 'md', color: PAL.crim3 });
      return;
    }
    if (page === 'spec') await pageSpec(scene, Number(params.get('p') ?? 0), log);
    else if (page === 'one') {
      const name = (params.get('name') ?? 'roarBig') as SfxName;
      await pageOne(scene, SFX_NAMES.includes(name) ? name : 'roarBig', log);
    } else if (page === 'music') await pageMusic(scene, log);
    else if (page === 'score') pageScore(scene);
    else await pageGrid(scene, log);
  },
};

export default preview;
