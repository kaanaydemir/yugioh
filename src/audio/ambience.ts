// Arena v4 step 4 — the hall's AMBIENCE: a quiet, endless room tone under the music (synthesized, no files).
//
//   hum       the hall's electrics: 55 Hz + a 110.4 Hz partner (a slow 0.4 Hz beat between them) and a whisper of 165 Hz,
//             through a lowpass, breathing on a 12 s LFO
//   room      the air of a big stone room: brown noise under 240 Hz + a band of pink noise round 900 Hz drifting on a 20 s LFO
//   torches   the wall torches crackling far off: a baked 7.3 s buffer of sparse crackles (soft pops and grit clusters),
//             looped twice at two rates, one per side of the stereo field (the pattern never lines up)
//   themes    a Field Spell retunes the room a little: Volcano — a deep rumble bed; Tidal Bay — slow waves of filtered noise;
//             Shadow Cavern — the room darker and lower (the hum's partials drop, the air closes); Festival — nothing (the
//             hall stays as it is)
//
// The bus: its own gain → the music DUCK node (big hits pull it down with the music; the music's own volume does not touch
// it), a little into the reverb send. The level follows the sfx volume (sound setting) and the master mute (sfx.setMuted).
// Nothing is created before the live AudioContext runs; every call is a silent no-op without audio.

import { noiseBuffer, peekLive, safe } from './engine';
import { sfx } from './sfx';

export type AmbienceTheme = 'none' | 'fire' | 'water' | 'void' | 'gold';

/** The ambience's overall level (pre-chain linear). Quiet: the room is felt, not heard. */
const LEVEL = 0.55;

interface Graph {
  ctx: AudioContext;
  out: GainNode;
  humLp: BiquadFilterNode;
  hum: OscillatorNode[];
  roomLp: BiquadFilterNode;
  roomBand: GainNode;
  rumble: GainNode;
  waves: GainNode;
  sources: AudioScheduledSourceNode[];
}

let g: Graph | null = null;
let wanted = false;
let theme: AmbienceTheme = 'none';
let shownLevel = -1;

/** 7.3 s of sparse torch crackle (seeded: the same every run). */
function crackleBuffer(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 7.3);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  let s = 0x51f3a9;
  const r = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let at = 0.05;
  while (at < 7.2) {
    // a pop, sometimes a little cluster of grit after it
    const amp = 0.25 + r() * 0.75;
    const n = r() < 0.3 ? 2 + Math.floor(r() * 4) : 1;
    let t = at;
    for (let k = 0; k < n && t < 7.25; k++) {
      const i0 = Math.floor(t * sr);
      const dec = sr * (0.002 + r() * 0.006);
      const a = amp * (k === 0 ? 1 : 0.35 + r() * 0.3);
      for (let i = 0; i < dec * 5 && i0 + i < len; i++) d[i0 + i] += (r() * 2 - 1) * a * Math.exp(-i / dec);
      t += 0.008 + r() * 0.03;
    }
    at += 0.09 + Math.pow(r(), 1.6) * 0.75;
  }
  return buf;
}

function build(): Graph | null {
  const a = peekLive();
  if (!a || a.ctx.state !== 'running') return null;
  const ctx = a.ctx;
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(a.chain.duck);
  const send = ctx.createGain();
  send.gain.value = 0.18;
  out.connect(send).connect(a.chain.send);
  const sources: AudioScheduledSourceNode[] = [];
  const lfo = (rate: number, depth: number, param: AudioParam, phase = 0): void => {
    const o = ctx.createOscillator();
    o.frequency.value = rate;
    const k = ctx.createGain();
    k.gain.value = depth;
    o.connect(k).connect(param);
    o.start(now + phase);
    sources.push(o);
  };
  const loop = (kind: 'white' | 'pink' | 'brown', to: AudioNode, offset: number, rate = 1): AudioBufferSourceNode => {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuffer(ctx, kind);
    s.loop = true;
    s.playbackRate.value = rate;
    s.connect(to);
    s.start(now, offset);
    sources.push(s);
    return s;
  };

  // ---- hum
  const humLp = ctx.createBiquadFilter();
  humLp.type = 'lowpass';
  humLp.frequency.value = 320;
  humLp.Q.value = 0.5;
  const humG = ctx.createGain();
  humG.gain.value = 0.032;
  humLp.connect(humG).connect(out);
  lfo(1 / 12, 0.008, humG.gain);
  const hum = ([
    [55, 'sine', 1],
    [110.4, 'sine', 0.55],
    [165.2, 'triangle', 0.12],
  ] as const).map(([f, w, k]) => {
    const o = ctx.createOscillator();
    o.type = w;
    o.frequency.value = f;
    const kg = ctx.createGain();
    kg.gain.value = k;
    o.connect(kg).connect(humLp);
    o.start(now);
    sources.push(o);
    return o;
  });

  // ---- room tone
  const roomLp = ctx.createBiquadFilter();
  roomLp.type = 'lowpass';
  roomLp.frequency.value = 240;
  const roomG = ctx.createGain();
  roomG.gain.value = 0.11;
  roomLp.connect(roomG).connect(out);
  loop('brown', roomLp, 0.3);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 900;
  band.Q.value = 0.6;
  const roomBand = ctx.createGain();
  roomBand.gain.value = 0.006;
  band.connect(roomBand).connect(out);
  lfo(1 / 20, 0.003, roomBand.gain, 0.5);
  lfo(1 / 27, 260, band.frequency, 1.1);
  loop('pink', band, 1.2);

  // ---- torches: the same crackle at two rates, one each side
  const cb = crackleBuffer(ctx);
  const cf = ctx.createBiquadFilter();
  cf.type = 'bandpass';
  cf.frequency.value = 2400;
  cf.Q.value = 0.9;
  const cg = ctx.createGain();
  cg.gain.value = 0.026;
  cf.connect(cg);
  for (const [pan, rate, off] of [
    [-0.6, 1, 0],
    [0.6, 0.91, 3.1],
  ] as const) {
    const s = ctx.createBufferSource();
    s.buffer = cb;
    s.loop = true;
    s.playbackRate.value = rate;
    const c = ctx as AudioContext & { createStereoPanner?: () => StereoPannerNode };
    if (c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = pan;
      s.connect(p).connect(cf);
    } else s.connect(cf);
    s.start(now, off);
    sources.push(s);
  }
  cg.connect(out);

  // ---- theme beds (silent until a Field Spell asks for them)
  const rlp = ctx.createBiquadFilter();
  rlp.type = 'lowpass';
  rlp.frequency.value = 90;
  rlp.Q.value = 0.9;
  const rumble = ctx.createGain();
  rumble.gain.value = 0;
  rlp.connect(rumble).connect(out);
  loop('brown', rlp, 0.9, 0.7);
  const wbp = ctx.createBiquadFilter();
  wbp.type = 'lowpass';
  wbp.frequency.value = 700;
  const wAmp = ctx.createGain();
  wAmp.gain.value = 0.5;
  lfo(0.11, 0.5, wAmp.gain, 0.2); // swells 0 … 1 every ~9 s
  lfo(0.07, 300, wbp.frequency, 0.4);
  const waves = ctx.createGain();
  waves.gain.value = 0;
  wbp.connect(wAmp).connect(waves).connect(out);
  loop('pink', wbp, 2.0);

  return { ctx, out, humLp, hum, roomLp, roomBand, rumble, waves, sources };
}

function applyTheme(gr: Graph, ramp: number): void {
  const t = gr.ctx.currentTime;
  const set = (p: AudioParam, v: number): void => {
    p.cancelScheduledValues(t);
    p.setTargetAtTime(v, t, ramp);
  };
  set(gr.rumble.gain, theme === 'fire' ? 0.16 : 0);
  set(gr.waves.gain, theme === 'water' ? 0.022 : 0);
  set(gr.roomLp.frequency, theme === 'void' ? 150 : 240);
  set(gr.humLp.frequency, theme === 'void' ? 210 : 320);
  gr.hum.forEach((o, i) => set(o.frequency, (theme === 'void' ? [49, 98.3, 147.1] : [55, 110.4, 165.2])[i]));
}

export const ambience = {
  /** Keep the ambience running (it starts as soon as the live audio runs; call update() regularly). */
  start(): void {
    wanted = true;
    ambience.update();
  },
  /** Fade the ambience out and release it. */
  stop(fadeMs = 600): void {
    wanted = false;
    safe(() => {
      const gr = g;
      if (!gr) return;
      g = null;
      shownLevel = -1;
      const t = gr.ctx.currentTime;
      const k = Math.max(0.02, fadeMs / 1000);
      gr.out.gain.cancelScheduledValues(t);
      gr.out.gain.setValueAtTime(gr.out.gain.value, t);
      gr.out.gain.linearRampToValueAtTime(0, t + k);
      for (const s of gr.sources) safe(() => s.stop(t + k + 0.05));
      setTimeout(() => safe(() => gr.out.disconnect()), fadeMs + 400);
    });
  },
  /** The active Field Spell's theme (the room retunes over ~2 s). */
  setTheme(th: AmbienceTheme): void {
    if (th === theme) return;
    theme = th;
    safe(() => g && applyTheme(g, 0.7));
  },
  /** Poll: build the graph once audio runs, follow the sfx volume. Cheap (a few comparisons). */
  update(): void {
    if (!wanted) return;
    safe(() => {
      if (!g) {
        g = build();
        if (!g) return;
        applyTheme(g, 0.01);
      }
      const lv = LEVEL * sfx.volume() * (sfx.isMuted() ? 0 : 1);
      if (lv !== shownLevel) {
        const t = g.ctx.currentTime;
        g.out.gain.cancelScheduledValues(t);
        // the first time: a slow 3 s fade in
        g.out.gain.setTargetAtTime(lv, t, shownLevel < 0 ? 1 : 0.2);
        shownLevel = lv;
      }
    });
  },
};
