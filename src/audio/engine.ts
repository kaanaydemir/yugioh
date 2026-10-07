// Low-level WebAudio plumbing shared by the sfx player, the music sequencer and the offline
// renderer used by ?dev=audio: the master chain (glue compressor → limiter → soft clipper),
// a synthetic stadium reverb, cached noise buffers, pulse PeriodicWaves and shaper curves.
//
// Everything here works on any BaseAudioContext, so the exact same graph renders live
// (AudioContext) and offline (OfflineAudioContext) — that is how sounds are verified headless.

export type NoiseKind = 'white' | 'pink' | 'brown';

/** The mixing graph every voice and music part plugs into. */
export interface Chain {
  ctx: BaseAudioContext;
  /** Dry sfx input. */
  sfx: GainNode;
  /** Reverb send input (shared by sfx and music). */
  send: GainNode;
  /** Music input (goes through `duck`). */
  music: GainNode;
  /** Music ducking gain (sfx with `duck` pull it down for a moment). */
  duck: GainNode;
  /** Master volume / mute (before the limiter). */
  master: GainNode;
}

export const MASTER_LEVEL = 0.9;

// ------------------------------------------------------------------ rng

/** Small seeded PRNG (mulberry32) — audio keeps its own so it has no art dependency. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ buffers (cached per sample rate)

function makeBuffer(ctx: BaseAudioContext, channels: number, length: number): AudioBuffer {
  try {
    return new AudioBuffer({ numberOfChannels: channels, length, sampleRate: ctx.sampleRate });
  } catch {
    return ctx.createBuffer(channels, length, ctx.sampleRate);
  }
}

const noiseCache = new Map<string, AudioBuffer>();

/** 2.5 s mono looping noise. White, pink (Paul Kellet) or brown (integrated, leaky). */
export function noiseBuffer(ctx: BaseAudioContext, kind: NoiseKind): AudioBuffer {
  const key = `${kind}@${ctx.sampleRate}`;
  const hit = noiseCache.get(key);
  if (hit) return hit;
  const len = Math.floor(ctx.sampleRate * 2.5);
  const buf = makeBuffer(ctx, 1, len);
  const d = buf.getChannelData(0);
  const r = rng(kind === 'white' ? 11 : kind === 'pink' ? 23 : 37);
  if (kind === 'white') {
    for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
  } else if (kind === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = r() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else {
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = r() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  // normalise to peak 1 and remove DC so loops do not click
  let mean = 0;
  for (let i = 0; i < len; i++) mean += d[i];
  mean /= len;
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i] - mean));
  for (let i = 0; i < len; i++) d[i] = (d[i] - mean) / peak;
  // crossfade the loop seam (50 ms)
  const xf = Math.floor(ctx.sampleRate * 0.05);
  for (let i = 0; i < xf; i++) {
    const k = i / xf;
    d[i] = d[i] * k + d[len - xf + i] * (1 - k);
  }
  noiseCache.set(key, buf);
  return buf;
}

const irCache = new Map<number, AudioBuffer>();

/**
 * Synthetic "night stadium" impulse: 12 ms pre-delay, a cluster of early reflections, then a
 * dense stereo tail that gets darker as it decays (one-pole lowpass whose cutoff falls).
 */
export function impulse(ctx: BaseAudioContext): AudioBuffer {
  const hit = irCache.get(ctx.sampleRate);
  if (hit) return hit;
  const sr = ctx.sampleRate;
  const secs = 2.6;
  const len = Math.floor(sr * secs);
  const buf = makeBuffer(ctx, 2, len);
  const pre = Math.floor(sr * 0.012);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    const r = rng(101 + ch * 977);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr;
      const env = Math.exp(-t * 2.6) * Math.min(1, t / 0.02 + 0.3);
      const a = 0.08 + 0.82 * Math.exp(-t * 1.7); // brightness falls over time
      lp += a * (r() * 2 - 1 - lp);
      d[i] = lp * env;
    }
    // early reflections (different per side → width)
    for (let k = 0; k < 9; k++) {
      const at = pre + Math.floor(sr * (0.006 + r() * 0.07));
      const amp = (0.5 + r() * 0.5) * (1 - k / 12) * (r() < 0.5 ? -1 : 1);
      if (at < len) d[at] += amp;
    }
  }
  irCache.set(sr, buf);
  return buf;
}

// ------------------------------------------------------------------ periodic waves / curves

export type CustomWave = 'p12' | 'p25' | 'p33' | 'organ' | 'reed';

const waveCache = new WeakMap<BaseAudioContext, Map<CustomWave, PeriodicWave>>();

/** Band-limited pulse waves (12.5/25/33 % duty) and two harmonic stacks, cached per context. */
export function periodicWave(ctx: BaseAudioContext, w: CustomWave): PeriodicWave {
  let m = waveCache.get(ctx);
  if (!m) waveCache.set(ctx, (m = new Map()));
  const hit = m.get(w);
  if (hit) return hit;
  const n = 64;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  if (w === 'p12' || w === 'p25' || w === 'p33') {
    const duty = w === 'p12' ? 0.125 : w === 'p25' ? 0.25 : 1 / 3;
    for (let k = 1; k < n; k++) {
      re[k] = Math.sin(2 * Math.PI * k * duty) / (Math.PI * k);
      im[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (Math.PI * k);
    }
  } else if (w === 'organ') {
    const h = [0, 1, 0.55, 0.3, 0.22, 0.08, 0.12, 0.03, 0.06];
    for (let k = 1; k < h.length; k++) im[k] = h[k];
  } else {
    // reed: odd-heavy, bright, a little nasal
    for (let k = 1; k < 24; k++) im[k] = (k % 2 ? 1 : 0.35) / Math.pow(k, 0.9);
  }
  const pw = ctx.createPeriodicWave(re, im, { disableNormalization: false });
  m.set(w, pw);
  return pw;
}

const curveCache = new Map<number, Float32Array<ArrayBuffer>>();

/** tanh drive curve; `drive` ≈ 1 (warm) … 20 (fuzz). Output normalised to ±1. */
export function driveCurve(drive: number): Float32Array<ArrayBuffer> {
  const key = Math.round(drive * 10) / 10;
  const hit = curveCache.get(key);
  if (hit) return hit;
  const n = 2048;
  const c = new Float32Array(n);
  const norm = Math.tanh(key);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * key) / norm;
  }
  curveCache.set(key, c);
  return c;
}

/** Last-stage safety clipper: transparent below 0.7, then a tanh knee that never reaches 1. */
function safetyCurve(): Float32Array<ArrayBuffer> {
  const n = 4096;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 4 - 2; // input range ±2
    const a = Math.abs(x);
    const y = a <= 0.7 ? a : 0.7 + 0.28 * Math.tanh((a - 0.7) / 0.28);
    c[i] = Math.sign(x) * y;
  }
  return c;
}

// ------------------------------------------------------------------ master chain

/**
 * sfx ─┬───────────────────────────────┐
 *      └ send → hp → convolver → lp ─┐ ├→ glue comp → master → limiter → safety clip → out
 * music → duck ───────────────────────┘ ┘
 */
export function buildChain(ctx: BaseAudioContext, dest: AudioNode = ctx.destination): Chain {
  const sfx = ctx.createGain();
  const send = ctx.createGain();
  const music = ctx.createGain();
  const duck = ctx.createGain();
  const master = ctx.createGain();
  master.gain.value = MASTER_LEVEL;

  // Chrome's compressor adds automatic make-up gain, so these are tuned by measurement
  // (see ?dev=audio: post-chain peaks stay < 1 and quiet UI sounds are not pumped up much).
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -14;
  glue.knee.value = 12;
  glue.ratio.value = 3;
  glue.attack.value = 0.004;
  glue.release.value = 0.2;

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -4;
  limiter.knee.value = 2;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.0015;
  limiter.release.value = 0.09;

  const clip = ctx.createWaveShaper();
  clip.curve = safetyCurve();
  clip.oversample = '2x';
  // input range of the curve is ±2: scale in by 0.5 so 1.0 maps onto the curve's x = 1.0
  const pre = ctx.createGain();
  pre.gain.value = 0.5;

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 220;
  const conv = ctx.createConvolver();
  conv.normalize = true;
  conv.buffer = impulse(ctx);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 6500;
  const ret = ctx.createGain();
  ret.gain.value = 0.55;

  sfx.connect(glue);
  send.connect(hp).connect(conv).connect(lp).connect(ret).connect(glue);
  music.connect(duck).connect(glue);
  glue.connect(master).connect(limiter).connect(pre).connect(clip).connect(dest);
  return { ctx, sfx, send, music, duck, master };
}

/** Build every cache up front (noise, waves, curves) so no sound pays for it mid-game. */
export function warmup(ctx: BaseAudioContext): void {
  for (const k of ['white', 'pink', 'brown'] as const) noiseBuffer(ctx, k);
  for (const w of ['p12', 'p25', 'p33', 'organ', 'reed'] as const) periodicWave(ctx, w);
  for (const d of [1.5, 1.8, 2, 2.5, 3, 4, 5, 6, 8]) driveCurve(d);
}

// ------------------------------------------------------------------ live context

type ACtor = typeof AudioContext;

let live: { ctx: AudioContext; chain: Chain } | null = null;
let failed = false;
let masterTarget = MASTER_LEVEL;

/** Master level (0 = muted). Remembered and applied when the context is created later. */
export function setMasterLevel(level: number): void {
  masterTarget = level;
  if (!live) return;
  const g = live.chain.master.gain;
  const now = live.ctx.currentTime;
  g.cancelScheduledValues(now);
  g.setTargetAtTime(level, now, 0.03);
}
const readyListeners: Array<() => void> = [];

/** The shared live context + chain, created lazily. Null when WebAudio is unavailable. */
export function liveAudio(): { ctx: AudioContext; chain: Chain } | null {
  if (live) return live;
  if (failed) return null;
  try {
    const w = globalThis as unknown as { AudioContext?: ACtor; webkitAudioContext?: ACtor };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) {
      failed = true;
      return null;
    }
    const ctx = new Ctor({ latencyHint: 'interactive' });
    const chain = buildChain(ctx);
    chain.master.gain.value = masterTarget;
    live = { ctx, chain };
    warmup(ctx);
    ctx.addEventListener?.('statechange', () => {
      if (ctx.state === 'running') for (const f of readyListeners.splice(0)) safe(f);
    });
    return live;
  } catch {
    failed = true;
    return null;
  }
}

/** The live context if it already exists (never creates one). */
export function peekLive(): { ctx: AudioContext; chain: Chain } | null {
  return live;
}

/**
 * May we create the context now? Only after the page has had a user gesture (where the browser
 * tells us), so nothing spins up an AudioContext — or logs autoplay warnings — before that.
 */
export function canStart(): boolean {
  try {
    const ua = (globalThis.navigator as Navigator & { userActivation?: { hasBeenActive: boolean } } | undefined)?.userActivation;
    return ua ? ua.hasBeenActive : true;
  } catch {
    return true;
  }
}

/** The live context: created on demand when allowed (see canStart), else only if it exists. */
export function audio(): { ctx: AudioContext; chain: Chain } | null {
  return live ?? (canStart() ? liveAudio() : null);
}

/** True when the live context exists and is actually producing sound. */
export function audioRunning(): boolean {
  return !!live && live.ctx.state === 'running';
}

/** Run `f` once the live context is running (immediately if it already is). */
export function whenRunning(f: () => void): void {
  if (audioRunning()) safe(f);
  else readyListeners.push(f);
}

export function safe(f: () => void): void {
  try {
    f();
  } catch {
    /* audio must never break the game */
  }
}

/** Drop the first `secs` of a buffer. */
export function trim(b: AudioBuffer, secs: number): AudioBuffer {
  const off = Math.floor(secs * b.sampleRate);
  if (off <= 0) return b;
  const len = Math.max(1, b.length - off);
  let out: AudioBuffer;
  try {
    out = new AudioBuffer({ numberOfChannels: b.numberOfChannels, length: len, sampleRate: b.sampleRate });
  } catch {
    return b;
  }
  for (let c = 0; c < b.numberOfChannels; c++) out.copyToChannel(b.getChannelData(c).subarray(off, off + len), c);
  return out;
}
