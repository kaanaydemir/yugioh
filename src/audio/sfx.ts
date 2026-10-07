// Sound contract. Everything is synthesized with WebAudio (no audio files).
//
//   sfx.unlock()                       — call from the first user gesture (pointerdown/keydown)
//   sfx.play('impactHeavy', { volume: 0.8, pitch: 1.1, pan: -0.3 })
//   music.play('duel'); music.setIntensity(1); music.stop(800)
//
// Implementation: src/audio/engine.ts (context + master chain + reverb), synth.ts (voice DSL),
// sounds.ts (one recipe per SfxName), music.ts (lookahead chiptune sequencer).
// Every call is a silent no-op when audio is unavailable (headless, autoplay blocked, no
// WebAudio) — nothing here ever throws. Preview: ?dev=audio.
//
// Extras (additive): sfx.setVolume / isRunning, music.setVolume / current, SFX_NAMES, and the
// offline renderers renderSfx / renderScene. The victory sting (sfx 'victory') and the victory
// track coordinate in either order: started after the sting, the track waits for it and skips
// its own fanfare; while the track's fanfare plays, the sting is skipped.

import { applyDuck, audio, audioRunning, buildChain, liveAudio, MASTER_LEVEL, peekLive, rng, safe, setMasterLevel, trim, type Chain } from './engine';
import { musicEngine, musicVolume, scheduleMusic, startPlan, VICTORY_STING_SEC, type MusicRenderOpts } from './music';
import { RECIPES } from './sounds';
import { Voice } from './synth';

export type SfxName =
  // UI
  | 'uiHover' | 'uiClick' | 'uiBack' | 'uiError' | 'uiConfirm'
  // cards
  | 'cardDraw' | 'cardSlide' | 'cardPlace' | 'cardSlam' | 'cardFlip' | 'cardSet' | 'shuffle'
  // flow
  | 'turnStart' | 'phaseChange' | 'yourMove' | 'passDevice'
  // summoning
  | 'summonCharge' | 'summonBurst' | 'materialize' | 'tribute' | 'cutIn' | 'roarBig' | 'roarSmall' | 'flipReveal'
  // combat
  | 'attackDeclare' | 'whoosh' | 'beamCharge' | 'beamFire' | 'slash' | 'bite' | 'impactLight' | 'impactHeavy'
  | 'shatter' | 'shieldBlock' | 'directHit'
  // LP
  | 'lpDown' | 'lpUp' | 'lpTick' | 'burn' | 'heal'
  // spells & traps
  | 'spellActivate' | 'trapActivate' | 'lightning' | 'chains' | 'mirror' | 'groundCrack' | 'fieldChange' | 'equip'
  | 'revive' | 'lockOn'
  // elements
  | 'fireBurst' | 'waterSplash' | 'windGust' | 'earthQuake' | 'darkPulse' | 'holyChime' | 'thunder'
  // results
  | 'victory' | 'defeat';

export interface SfxOpts {
  /** 0..1, default 1. */
  volume?: number;
  /** Playback-rate style pitch multiplier, default 1. */
  pitch?: number;
  /** -1 (left) .. 1 (right). */
  pan?: number;
}

export type MusicTrack = 'title' | 'duel' | 'victory';

/** Every SfxName, in contract order (handy for previews and tests). */
export const SFX_NAMES = Object.keys(RECIPES) as SfxName[];

// ------------------------------------------------------------------ voice building (live + offline)

const clamp = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo);

interface Built {
  voice: Voice;
  out: GainNode;
  nodes: AudioNode[];
}

/** Build one sfx voice into `chain` starting at context time t0. Shared by the live player and renderSfx(). */
function build(chain: Chain, name: SfxName, t0: number, opts: SfxOpts, rnd: () => number): Built | null {
  const r = RECIPES[name];
  if (!r) return null;
  const ctx = chain.ctx;
  const out = ctx.createGain();
  out.gain.value = clamp(opts.volume ?? 1, 0, 1.5);
  const nodes: AudioNode[] = [out];
  const voice = new Voice(ctx, out, t0, clamp(opts.pitch ?? 1, 0.25, 4), rnd);
  r.play(voice);
  // route after the recipe is built (it tells us whether it is already stereo)
  let tail: AudioNode = out;
  const pan = clamp(opts.pan ?? 0, -1, 1);
  const c = ctx as BaseAudioContext & { createStereoPanner?: () => StereoPannerNode };
  if (pan !== 0 && c.createStereoPanner) {
    const p = c.createStereoPanner();
    p.pan.value = pan;
    out.connect(p);
    tail = p;
    nodes.push(p);
    // The equal-power law puts a MONO source at −3 dB per side at centre: make up for it so
    // pan 0.01 is exactly as loud as no pan. (A stereo source passes a centred panner unchanged.)
    if (!voice.stereo) out.gain.value *= Math.SQRT2;
  }
  tail.connect(chain.sfx);
  if (r.verb) {
    const s = ctx.createGain();
    s.gain.value = r.verb;
    tail.connect(s).connect(chain.send);
    nodes.push(s);
  }
  return { voice, out, nodes };
}

// ------------------------------------------------------------------ live player

interface LiveVoice extends Built {
  name: SfxName;
  start: number;
  end: number;
}

const MAX_VOICES = 40;
const active: LiveVoice[] = [];
const lastPlay = new Map<SfxName, number>();
const MUTE_KEY = 'neon.muted';
let muted = loadMuted();
let sfxVolume = 1;
/** performance.now() of the last unlock(): sounds triggered by that same gesture still play. */
let resumeAsked = -1e9;
if (muted) setMasterLevel(0);

function loadMuted(): boolean {
  try {
    return globalThis.localStorage?.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function release(v: LiveVoice): void {
  for (const n of v.nodes) safe(() => n.disconnect());
}

function kill(v: LiveVoice, now: number): void {
  const i = active.indexOf(v);
  if (i >= 0) active.splice(i, 1);
  safe(() => {
    const g = v.out.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + 0.04);
  });
  for (const s of v.voice.sources) safe(() => s.stop(now + 0.06));
  setTimeout(() => release(v), 200);
}

function reap(now: number): void {
  for (let i = active.length - 1; i >= 0; i--) if (active[i].end < now) active.splice(i, 1);
}

function playLive(name: SfxName, opts: SfxOpts): void {
  if (muted) return;
  const r = RECIPES[name];
  if (!r) return;
  if (!((opts.volume ?? 1) * sfxVolume > 0.001)) return; // sound off (also rejects NaN)
  const a = audio();
  if (!a) return;
  // Never queue sounds while suspended (they would all burst out on resume) — except right
  // after unlock(): the click that unlocks audio should still make its own sound.
  if (a.ctx.state !== 'running' && performance.now() - resumeAsked > 300) return;
  const now = a.ctx.currentTime;
  // the victory track opens with its own (longer) fanfare: the sting would clash with it
  if (name === 'victory' && musicEngine.fanfarePlaying()) return;
  const last = lastPlay.get(name);
  if (last !== undefined && now - last < (r.gap ?? 0.02)) return;
  reap(now);
  const same = active.filter((v) => v.name === name);
  if (same.length >= (r.cap ?? 4)) kill(same[0], now);
  if (active.length >= MAX_VOICES) kill(active[0], now);
  const vary = r.vary ?? 0;
  const pitch = (opts.pitch ?? 1) * (1 + (Math.random() * 2 - 1) * vary);
  const volume = (opts.volume ?? 1) * sfxVolume;
  const t0 = now + 0.004;
  const b = build(a.chain, name, t0, { volume, pitch, pan: opts.pan }, Math.random);
  if (!b) return;
  lastPlay.set(name, now);
  const end = t0 + b.voice.end / b.voice.pm + 0.1;
  const lv: LiveVoice = { ...b, name, start: now, end };
  active.push(lv);
  if (r.duck) musicEngine.duck(r.duck * Math.min(1, volume), t0);
  if (name === 'victory') musicEngine.sting(t0, pitch);
  setTimeout(() => {
    const i = active.indexOf(lv);
    if (i >= 0) active.splice(i, 1);
    release(lv);
  }, (end - now) * 1000 + 3000); // + reverb tail
}

export const sfx = {
  play(name: SfxName, opts?: SfxOpts): void {
    safe(() => playLive(name, opts ?? {}));
  },
  /** Resume the AudioContext after a user gesture (browsers block autoplay). */
  unlock(): void {
    safe(() => {
      const a = liveAudio(); // inside a gesture: always allowed to create
      musicEngine.kick();
      if (!a || a.ctx.state === 'running') return;
      resumeAsked = performance.now();
      void a.ctx.resume().catch(() => {});
      // iOS: a silent buffer started inside the gesture fully unlocks output
      const src = a.ctx.createBufferSource();
      src.buffer = a.ctx.createBuffer(1, 1, a.ctx.sampleRate);
      src.connect(a.ctx.destination);
      src.start();
    });
  },
  setMuted(m: boolean): void {
    muted = !!m;
    try {
      globalThis.localStorage?.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      /* private mode */
    }
    safe(() => {
      setMasterLevel(muted ? 0 : MASTER_LEVEL);
      const a = peekLive();
      if (a && muted) for (const v of [...active]) kill(v, a.ctx.currentTime);
    });
  },
  isMuted(): boolean {
    return muted;
  },
  /** Extra: sfx volume 0..1 (music has its own, music.setVolume). */
  setVolume(v: number): void {
    sfxVolume = clamp(v, 0, 1);
  },
  /** Extra: true once the AudioContext is running (after unlock). */
  isRunning(): boolean {
    return audioRunning();
  },
};

export const music = {
  play(track: MusicTrack): void {
    safe(() => musicEngine.play(track));
  },
  stop(fadeMs = 600): void {
    safe(() => musicEngine.stop(fadeMs));
  },
  /** 0..1 — raise during battles / low LP for a tenser mix. */
  setIntensity(v: number): void {
    safe(() => musicEngine.setIntensity(v));
  },
  /** Extra: music volume 0..1 (default 0.45). */
  setVolume(v: number): void {
    safe(() => musicEngine.setVolume(v));
  },
  /** Extra: the track currently playing, or null. */
  current(): MusicTrack | null {
    try {
      return musicEngine.current();
    } catch {
      return null;
    }
  },
};

// Belt and braces: unlock on the first gesture even if the game forgets to call sfx.unlock().
// The listeners stay (they cost one state check): if the browser suspends the context later
// (iOS interruption, audio device change), the next gesture resumes it. Returning to the tab
// also tries to resume (allowed once the page has had a gesture).
safe(() => {
  if (typeof window === 'undefined') return;
  const onGesture = () => {
    if (!audioRunning()) sfx.unlock();
  };
  for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, onGesture, { capture: true, passive: true });
  document.addEventListener?.('visibilitychange', () =>
    safe(() => {
      const a = peekLive();
      if (a && !document.hidden && a.ctx.state !== 'running' && a.ctx.state !== 'closed') void a.ctx.resume().catch(() => {});
    }),
  );
});

// ------------------------------------------------------------------ offline rendering (dev preview / tests)

/**
 * Render one sfx into an AudioBuffer offline. `chain: false` gives the raw voice (no compressor,
 * limiter or reverb) so the recipe's own peak can be checked. Deterministic (seeded).
 */
export async function renderSfx(
  name: SfxName,
  o: { seconds?: number; chain?: boolean; opts?: SfxOpts; sampleRate?: number; seed?: number } = {},
): Promise<AudioBuffer | null> {
  try {
    const sr = o.sampleRate ?? 44100;
    // Chrome's DynamicsCompressor starts fully attenuated and releases from there, so a fresh
    // chain needs a little silent pre-roll before it behaves like the long-lived live chain.
    const pre = o.chain === false ? 0 : 0.8;
    const ctx = new OfflineAudioContext(2, Math.ceil(sr * ((o.seconds ?? 3.5) + pre)), sr);
    let chain: Chain;
    if (o.chain === false) {
      const sink = ctx.createGain();
      sink.connect(ctx.destination);
      chain = { ctx, sfx: sink, send: ctx.createGain(), music: ctx.createGain(), duck: ctx.createGain(), master: sink };
    } else chain = buildChain(ctx);
    build(chain, name, pre + 0.01, o.opts ?? {}, rng(o.seed ?? 1234));
    return trim(await ctx.startRendering(), pre);
  } catch (err) {
    console.warn('[audio] renderSfx failed', name, err);
    return null;
  }
}

/** One sound in a renderScene() cue list. */
export interface SfxCue {
  /** Seconds from the start of the scene. */
  at: number;
  name: SfxName;
  opts?: SfxOpts;
}

/**
 * Render a little scene offline: sfx cues over an optional music track, with the same music
 * ducking and victory-sting coordination as live play — this is how overlap, ducking and the
 * limiter are checked headless (?dev=audio&page=mix). Deterministic (seeded).
 */
export async function renderScene(
  cues: readonly SfxCue[],
  o: MusicRenderOpts & { seconds: number; music?: MusicTrack; musicAt?: number; sampleRate?: number; seed?: number },
): Promise<AudioBuffer | null> {
  try {
    const sr = o.sampleRate ?? 44100;
    const pre = 0.8; // compressor warm-up (see renderSfx)
    const ctx = new OfflineAudioContext(2, Math.ceil(sr * (o.seconds + pre)), sr);
    const chain = buildChain(ctx);
    chain.music.gain.value = musicVolume();
    const rnd = rng(o.seed ?? 1234);
    let stingEnd = -1;
    for (const c of [...cues].sort((x, y) => x.at - y.at)) {
      const r = RECIPES[c.name];
      if (!r) continue;
      const t0 = pre + c.at;
      build(chain, c.name, t0, c.opts ?? {}, rnd);
      if (c.name === 'victory') stingEnd = t0 + VICTORY_STING_SEC / clamp(c.opts?.pitch ?? 1, 0.25, 4);
      if (r.duck && o.music) applyDuck(chain, r.duck * Math.min(1, c.opts?.volume ?? 1), t0);
    }
    if (o.music) {
      const plan = startPlan(o.music, pre + (o.musicAt ?? 0), stingEnd);
      const shift = plan.at - pre;
      scheduleMusic(chain, o.music, plan.at, o.seconds - shift, {
        intensity: o.intensity,
        startStep: o.startStep ?? plan.step,
        intensityAt: o.intensityAt?.map(([t, v]) => [t - shift, v] as const).filter(([t]) => t >= 0),
      });
    }
    return trim(await ctx.startRendering(), pre);
  } catch (err) {
    console.warn('[audio] renderScene failed', err);
    return null;
  }
}
