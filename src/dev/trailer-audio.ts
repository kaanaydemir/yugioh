// Offline renderer of the Steam trailer's soundtrack (dev only; driven by marketing/trailer/build/audio.mjs
// through ?dev=trailer&card=audio). The game's own sounds, through the game's own master chain:
//
//   - every sfx the captured shots asked for (sfx.play / sfx.start + its stop / sfx.fade, logged by
//     marketing/trailer/build/capture.mjs with their game frame) is rebuilt from its recipe (src/audio/sounds.ts)
//     with the same voice code as src/audio/sfx.ts build(), at its frame's time on the edit timeline;
//   - each shot's sounds go through a gate that opens on the shot's first frame and closes (short fade) on its
//     cut, so the soundtrack cuts with the picture; the reverb tail rings on through the shared send;
//   - the music is the duel track (src/audio/music.ts scheduleMusic) on the same chain, with the live
//     ducking (applyDuck) of the big sounds and an intensity plan (the hot layer + drum fills).
//
// Nothing here is used by the game: it only reads the shipping audio modules.
import { applyDuck, buildChain, rng, type Chain } from '../audio/engine';
import { scheduleMusic } from '../audio/music';
import { RECIPES } from '../audio/sounds';
import { Voice } from '../audio/synth';
import type { SfxName, SfxOpts } from '../audio/sfx';

export interface TrailerCue {
  /** Seconds on the edit timeline. */
  t: number;
  name: SfxName;
  opts?: SfxOpts;
  /** sfx.start handle stopped at this time (s) over stopMs. */
  stopT?: number;
  stopMs?: number;
}
export interface TrailerFade {
  t: number;
  names: SfxName[];
  ms: number;
}
export interface TrailerShotAudio {
  name: string;
  /** Shot window on the timeline (s). */
  a: number;
  b: number;
  cues: TrailerCue[];
  fades: TrailerFade[];
  /** Gain for this shot's sounds (default 1). */
  gain?: number;
}
export interface TrailerAudioPlan {
  seconds: number;
  sampleRate: number;
  shots: TrailerShotAudio[];
  music: {
    at: number;
    seconds: number;
    volume: number;
    /** Music bus automation: [seconds, gain] points, linear ramps between them (the arrangement's levels). */
    volumeAt?: [number, number][];
    intensity: number;
    intensityAt: [number, number][];
  } | null;
  /** Gate fade after a cut (s). */
  release: number;
  seed: number;
}

const clamp = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo);

interface Live {
  name: SfxName;
  out: GainNode;
  voice: Voice;
  end: number;
}

/** sfx.ts build(), into a shot bus (dry + reverb send). */
function buildVoice(ctx: BaseAudioContext, dry: AudioNode, send: AudioNode, name: SfxName, t0: number, opts: SfxOpts, rnd: () => number): Live | null {
  const r = RECIPES[name];
  if (!r) return null;
  const out = ctx.createGain();
  out.gain.value = clamp(opts.volume ?? 1, 0, 1.5);
  const vary = r.vary ?? 0;
  const pitch = clamp((opts.pitch ?? 1) * (1 + (rnd() * 2 - 1) * vary), 0.25, 4);
  const voice = new Voice(ctx, out, t0, pitch, rnd);
  r.play(voice);
  let tail: AudioNode = out;
  const pan = clamp(opts.pan ?? 0, -1, 1);
  if (pan !== 0) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    out.connect(p);
    tail = p;
    if (!voice.stereo) out.gain.value *= Math.SQRT2;
  }
  tail.connect(dry);
  if (r.verb) {
    const s = ctx.createGain();
    s.gain.value = r.verb;
    tail.connect(s).connect(send);
  }
  return { name, out, voice, end: t0 + voice.end / voice.pm + 0.1 };
}

function fadeOut(v: Live, at: number, ms: number): void {
  const k = Math.max(0.005, ms / 1000);
  if (v.end < at) return;
  const g = v.out.gain;
  g.cancelScheduledValues(at);
  g.setValueAtTime(g.value, at);
  g.linearRampToValueAtTime(0, at + k);
  for (const s of v.voice.sources) {
    try {
      s.stop(at + k + 0.02);
    } catch {
      /* already stopped earlier */
    }
  }
  v.end = Math.min(v.end, at + k + 0.02);
}

/** Render the plan; returns the two channels and the cue count actually built. */
export async function renderTrailerAudio(plan: TrailerAudioPlan): Promise<{ L: Float32Array; R: Float32Array; built: number; skipped: number }> {
  const sr = plan.sampleRate;
  const pre = 0.8; // compressor warm-up (as renderSfx)
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * (plan.seconds + pre)), sr);
  const chain: Chain = buildChain(ctx);
  const rnd = rng(plan.seed);
  let built = 0;
  let skipped = 0;
  for (const shot of plan.shots) {
    const a = pre + shot.a;
    const b = pre + shot.b;
    const dry = ctx.createGain();
    const send = ctx.createGain();
    for (const g of [dry.gain, send.gain]) {
      g.setValueAtTime(0, 0);
      g.setValueAtTime(0, Math.max(0, a - 0.003));
      g.linearRampToValueAtTime(shot.gain ?? 1, a);
      g.setValueAtTime(shot.gain ?? 1, b);
      g.linearRampToValueAtTime(0, b + plan.release);
    }
    dry.connect(chain.sfx);
    send.connect(chain.send);
    const lastPlay = new Map<SfxName, number>();
    const live: Live[] = [];
    const events = [
      ...shot.cues.map((c) => ({ t: c.t, c, f: null as TrailerFade | null })),
      ...shot.fades.map((f) => ({ t: f.t, c: null as TrailerCue | null, f })),
    ].sort((x, y) => x.t - y.t);
    for (const e of events) {
      const t = pre + e.t;
      if (e.f) {
        const set = new Set(e.f.names);
        for (const v of live) if (set.has(v.name)) fadeOut(v, t, e.f.ms);
        continue;
      }
      const c = e.c!;
      const r = RECIPES[c.name];
      if (!r || !((c.opts?.volume ?? 1) > 0.001)) {
        skipped++;
        continue;
      }
      // the live player's rate limit and voice cap, on game time
      const last = lastPlay.get(c.name);
      if (last !== undefined && t - last < (r.gap ?? 0.02)) {
        skipped++;
        continue;
      }
      const same = live.filter((v) => v.name === c.name && v.end > t);
      if (same.length >= (r.cap ?? 4)) fadeOut(same[0], t, 40);
      const v = buildVoice(ctx, dry, send, c.name, Math.max(0.001, t + 0.004), c.opts ?? {}, rnd);
      if (!v) continue;
      built++;
      lastPlay.set(c.name, t);
      live.push(v);
      if (c.stopT !== undefined) fadeOut(v, pre + c.stopT, c.stopMs ?? 60);
      // music ducking (only for sounds heard inside the shot window)
      if (r.duck && plan.music && t >= a - 0.01 && t < b) applyDuck(chain, r.duck * Math.min(1, c.opts?.volume ?? 1), t);
    }
  }
  if (plan.music) {
    const g = chain.music.gain;
    g.setValueAtTime(plan.music.volume, 0);
    for (const [t, v] of plan.music.volumeAt ?? []) g.linearRampToValueAtTime(v, pre + t);
    scheduleMusic(chain, 'duel', pre + plan.music.at, plan.music.seconds, {
      intensity: plan.music.intensity,
      intensityAt: plan.music.intensityAt,
    });
  }
  const buf = await ctx.startRendering();
  const off = Math.floor(pre * sr);
  return { L: buf.getChannelData(0).slice(off), R: buf.getChannelData(1).slice(off), built, skipped };
}
