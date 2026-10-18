#!/usr/bin/env node
// Sound preview tool: records a scenario as an MP4 WITH SOUND, deterministically (headless
// Chromium + Vite dev server + ffmpeg). Agents cannot hear; this is how the user does.
//
//   node tools/clip.mjs "<query>" [options]
//
//   e.g.  node tools/clip.mjs "?dev=duel&s=saWyrmAtk&look=v3" --out shots/v3/clips/saWyrmAtk.mp4
//         node tools/clip.mjs "?dev=duel&s=suWyrm&look=v3" --seconds 3.5 --music off --marker impactHeavy
//
//   <query>            URL query, e.g. "?dev=duel&s=saWyrmAtk&look=v3"; may start with a page
//                      ("demo.html?..."; default index.html). "?dev=duel&s=<key>" pages are restarted
//                      deterministically (below); any other page is frozen and stepped as it is.
//   --seconds S|auto   clip length in seconds (default auto: duel scenarios run until the duel is idle
//                      again — every scenario action resolved, nothing busy, no cinematic event
//                      running — plus --tail; other pages default to 5 s)
//   --fps N            video frame rate, 1..60 (default 30). The game always runs in 1/60 s steps;
//                      video frame i shows game frame round(i·60/N) (exact when N divides 60)
//   --scale N          integer nearest-neighbour upscale of the 640×360 frames (default 2)
//   --music on|off     on (default): the game's own music, exactly as it plays it (track, intensity,
//                      ducking, fades, the victory sting/fanfare hand-off). off: sound effects only
//   --music-pre S      on: seconds the music has already been playing at the clip's first frame
//                      (default 2; the track's fade-in is over and its song position is fixed)
//   --out FILE         output MP4 (default shots/clip.mp4); FILE.wav (the rendered sound, 44.1 kHz
//                      16-bit stereo) and FILE.json (timeline + levels) are written next to it
//   --pre MS           duel scenarios: the clip starts MS of game time before the scenario's first
//                      action (default 0; at most --warm)
//   --warm MS          duel scenarios: game time the restarted duel settles before the action
//                      (default 1000, as tools/measure.mjs)
//   --tail MS          --seconds auto: game time kept after the duel went idle (default 1000)
//   --cap MS           --seconds auto: maximum clip length (default 20000)
//   --solo a,b         only these sfx sound (every other sfx.play is skipped; music per --music):
//                      hear one sound in context, or measure its onset without masking
//   --marker a,b       draw a white box (8×8 game px, top-left, ~100 ms) from the video frame in which
//                      these sfx become audible (the A/V sync check: box frame vs. sound onset)
//   --seed N           the audio's own random stream (pitch / noise variance; default 1)
//   --settings JSON    merged into the game's saved settings before load, e.g. '{"music":false}'
//   --muted            start with the game's mute switch on (neon.muted = 1)
//   --frames DIR       also keep every video frame as DIR/fNNNNN.png (native 640×360)
//   --crf N            x264 quality (default 16; lower = better)
//   --delta MS|exact   per-frame delta of every clock (default 16.666666666666664, as measure.mjs)
//   --timeout MS       page ready timeout (default 120000)
//
// Method
//  Frames: the measure.mjs clock. The duel that ran in real time before the freeze is restarted
//  under the tool's own stepped clock (same stage, same scenario), module-level random streams are
//  re-seeded, the scene settles --warm ms and the scenario's actions start: clip t = 0 (minus --pre).
//  Every game frame advances the loop, every TweenManager and Date.now by one constant delta, with a
//  macrotask between frames (promise-chained cinematics continue as in a browser). The canvas is
//  captured every 60/fps game frames. So the timeline equals tools/measure.mjs's (its sfx[] times =
//  the sound times here) and a re-run gives the same frames, pixel for pixel, and the same WAV up to
//  float noise (≤ 1 LSB of 16-bit; Chrome's offline renderer is not bit-exact between renders: the
//  game's own renderScene differs by ~1e-5 between two renders in one page).
//  Sound: the game's real audio code runs (src/audio/sfx.ts playLive, music.ts scheduler, engine.ts
//  master chain: gap / voice caps / voice stealing, pitch variance, mute, sfx and music volume,
//  ducking, track fades, the victory sting hand-off) — nothing is re-implemented. Its "live"
//  AudioContext (engine.ts liveAudio, made at boot) is an OfflineAudioContext subclass that is never
//  started while the game plays: its currentTime is the stepped game clock (clip frame k →
//  k·delta + lead), so every voice and automation the game schedules lands at its exact game time;
//  after the last frame the whole timeline is rendered in one go (startRendering) and trimmed to the
//  clip. Page-side shims, installed before any page script (init script):
//   - AudioContext → that subclass, for src/audio/* only (Phaser's own unused sound manager keeps a
//     real one). It reads state 'suspended' until the clip starts — playLive drops every sound and
//     the music only notes its wanted track, as on a page that has not been unlocked — then
//     'running' (a 'statechange' fires: the music the duel asked for starts, as after sfx.unlock);
//   - timers set from src/audio/* during the clip (the music's 25 ms lookahead pump, voice clean-up)
//     run on the game clock instead of the wall clock (which runs at another speed while stepping);
//   - AudioNode.disconnect on the capture context is a no-op (offline, a disconnect would remove the
//     node for the whole render; voices end by their own scheduled stops, as in renderScene);
//   - AudioParam.value written during the clip on a param that already has automation becomes
//     setValueAtTime(v, now) — the live semantics (offline, it would apply from t = 0);
//   - Math.random captured by sfx.ts at load (audioRandom) is a seeded stream (--seed), re-seeded at
//     the clip's start. The visual random stream (main.ts while frozen) is untouched, so the frames
//     are the same as without sound.
//  The music starts --music-pre seconds before the clip's first frame, on the audio clock alone
//  (the game is not stepped meanwhile); the master chain's compressors get 0.8 s of silent pre-roll
//  before that (as renderSfx / renderScene).
//  Mux: ffmpeg, H.264 yuv420p (BT.709 tv range, nearest-neighbour ×scale: each game pixel is a
//  scale×scale block, so 4:2:0 chroma stays per game pixel), AAC 192 kb/s 44.1 kHz stereo,
//  +faststart. The audio and video are the same length (frames / fps).
//
//  Timing: clip game frame k (1/60 s) is at k·delta ms in the WAV and the MP4; video frame i shows
//  game frame round(i·60/fps). A sound played in frame k starts at k·delta + 4 ms (playLive) and is
//  audible ~15 ms later (the master chain's latency, live too). Visuals made in a promise
//  continuation of frame k (most cinematic beats: the damage number) are on screen from frame k+1,
//  as in a browser. So a sound and its visual normally land in the same video frame or the next.
//
// FILE.json: options, git, frames, the sound log (every sfx.play: clip frame, ms, name, opts, played
// or dropped by the game's own rules; every music call), damage numbers (first frame they are on
// screen), v3 contact marks, and levels (peak / RMS dBFS per channel, loudest 400 ms RMS, clipped
// samples). Prints a summary. Exit code 1 on page errors or a failed render / mux.

import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
const query = args._[0] ?? '';
const fail = (msg) => {
  console.error(`[clip] ${msg}`);
  process.exit(1);
};
const FPS = Number(args.fps ?? 30);
if (!(Number.isInteger(FPS) && FPS >= 1 && FPS <= 60)) fail('--fps must be an integer 1..60');
const SCALE = Number(args.scale ?? 2);
if (!(Number.isInteger(SCALE) && SCALE >= 1 && SCALE <= 8)) fail('--scale must be an integer 1..8');
const MUSIC = (args.music ?? 'on') !== 'off';
const MUSIC_PRE = MUSIC ? Math.max(0, Number(args['music-pre'] ?? 2)) : 0;
const OUT = path.resolve(root, args.out ?? 'shots/clip.mp4');
const BASE = OUT.replace(/\.mp4$/i, '');
const WARM = Number(args.warm ?? 1000);
const PRE = Number(args.pre ?? 0);
if (!(PRE >= 0 && PRE <= WARM)) fail('--pre must be within 0..--warm');
const TAIL = Number(args.tail ?? 1000);
const CAP = Number(args.cap ?? 20000);
const SEED = Number(args.seed ?? 1) >>> 0;
const CRF = Number(args.crf ?? 16);
const DELTA = args.delta === 'exact' ? 1000 / 60 : args.delta ? Number(args.delta) : 16.666666666666664;
const SOLO = args.solo ? String(args.solo).split(',').map((x) => x.trim()).filter(Boolean) : [];
const MARKERS = args.marker ? String(args.marker).split(',').map((s) => s.trim()).filter(Boolean) : [];
let SETTINGS = null;
if (args.settings) {
  try {
    SETTINGS = JSON.parse(args.settings);
  } catch {
    fail('--settings must be JSON');
  }
}
const SR = 44100;
/**
 * A sound played at game time t is audible in the WAV at t + 4 ms (playLive starts a voice 4 ms
 * after "now") + ~15 ms: the master chain's own latency (two DynamicsCompressor lookaheads + the 2×
 * oversampled safety clipper; measured with the game's renderSfx: 14.1–15.2 ms). Live play has the
 * same delay (plus the device's output latency). Used for --marker only; the WAV is not shifted.
 */
const AUDIBLE_MS = 4 + 15;
/** Compressor warm-up before anything sounds (renderSfx / renderScene use the same). */
const PREROLL = 0.8;
const LEAD = PREROLL + MUSIC_PRE;

const m = /^([\w./-]+\.html)(.*)$/.exec(query);
const pagePath = m ? m[1].replace(/^\//, '') : '';
const rest = m ? m[2] : query;
let q = rest.startsWith('?') ? rest : '?' + rest;
q += (q.length > 1 ? '&' : '') + 'test=1';
const qp = new URLSearchParams(q);
const DUEL_KEY = qp.get('dev') === 'duel' && qp.get('s') ? qp.get('s') : null;
const AUTO = (args.seconds ?? 'auto') === 'auto';
const SECONDS = AUTO ? (DUEL_KEY ? null : 5) : Number(args.seconds);
if (SECONDS !== null && !(SECONDS > 0 && SECONDS <= 120)) fail('--seconds must be > 0 (≤ 120) or auto');
/** Seconds of audio the capture context can hold after the clip's start. */
const MAX_SECONDS = SECONDS ?? CAP / 1000;

/** Random streams re-seeded before the restart and at t = 0 (the same list as tools/measure.mjs). */
const SEEDERS = [
  ['/src/vfx/setpieces.ts', 'seedSetFx', 0x5e7f1],
  ['/src/vfx/combat.ts', 'seedCombatFx', 0xc0ffee],
  ['/src/vfx/particles.ts', 'seedFx', 0x5eed],
  ['/src/cinematics/flow/_kit.ts', 'seed', 1],
  ['/src/cinematics/battle/_kit.ts', 'seed', 1],
  ['/src/cinematics/strikes-a/_kit.ts', 'seed', 1],
  ['/src/cinematics/strikes-b/_kit.ts', 'reseed', 1],
  ['/src/cinematics/summon-a/_kit.ts', 'seed', 1],
  ['/src/cinematics/summon-b/_kit.ts', 'reseed', 1],
];

function chromePath() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    for (const d of fs.readdirSync(base).sort().reverse()) {
      if (/^chromium-\d+$/.test(d)) {
        const p = path.join(base, d, 'chrome-linux', 'chrome');
        if (fs.existsSync(p)) return p;
      }
    }
  } catch {}
  return undefined;
}

function gitInfo() {
  try {
    const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const dirty = execFileSync('git', ['-C', root, 'status', '--porcelain', '--', 'src'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return { head, srcDirty: dirty.length > 0 };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- init script (before any page script)

/**
 * Runs before the game's modules: the seeded random stream sfx.ts captures at load, the timer
 * shims (inactive until the clip starts) and the saved settings / mute switch.
 */
function initScript(cfg) {
  try {
    if (cfg.settings) {
      const k = 'neon-duello:settings';
      let cur = {};
      try {
        cur = JSON.parse(localStorage.getItem(k) || '{}') || {};
      } catch {}
      localStorage.setItem(k, JSON.stringify({ ...cur, ...cfg.settings }));
    }
    if (cfg.muted) localStorage.setItem('neon.muted', '1');
  } catch {}
  const mulberry = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  let stream = mulberry(cfg.seed);
  // sfx.ts binds Math.random at load (its own audio stream): make that one seeded and re-seedable.
  // (While frozen, main.ts swaps Math.random for the visual stream; the bound copy keeps this one.)
  Math.random = function clipRandom() {
    return stream();
  };
  const I = {
    reseed(seed) {
      stream = mulberry(seed);
    },
    /** Timers from src/audio/* run on the clip's audio clock once this is on. */
    virtual: false,
    now: 0,
    timers: new Map(),
    seq: 0,
    fired: 0,
    add(fn, ms, a, repeat) {
      const id = 0x40000000 + ++I.seq;
      const d = Math.max(0, Number(ms) || 0) / 1000;
      I.timers.set(id, { id, fn, a, repeat, period: Math.max(0.001, d), due: I.now + d });
      return id;
    },
    /** Fire every virtual timer due by audio time `now` (in due order). */
    run(now) {
      I.now = now;
      for (let guard = 0; guard < 10000; guard++) {
        let next = null;
        for (const t of I.timers.values()) if (t.due <= now + 1e-9 && (!next || t.due < next.due || (t.due === next.due && t.id < next.id))) next = t;
        if (!next) return;
        if (next.repeat) next.due += next.period;
        else I.timers.delete(next.id);
        I.fired++;
        try {
          next.fn(...next.a);
        } catch (e) {
          console.error('[clip] audio timer threw', e);
        }
      }
    },
  };
  window.__clipInit = I;
  const st = window.setTimeout;
  const si = window.setInterval;
  const ct = window.clearTimeout;
  const ci = window.clearInterval;
  const fromAudio = () => /\/src\/audio\//.test(new Error().stack || '');
  window.setTimeout = function (fn, ms, ...a) {
    if (I.virtual && typeof fn === 'function' && fromAudio()) return I.add(fn, ms, a, false);
    return st.call(window, fn, ms, ...a);
  };
  window.setInterval = function (fn, ms, ...a) {
    if (I.virtual && typeof fn === 'function' && fromAudio()) return I.add(fn, ms, a, true);
    return si.call(window, fn, ms, ...a);
  };
  window.clearTimeout = function (id) {
    if (I.timers.has(id)) return void I.timers.delete(id);
    return ct.call(window, id);
  };
  window.clearInterval = function (id) {
    if (I.timers.has(id)) return void I.timers.delete(id);
    return ci.call(window, id);
  };

  // The game's "live" AudioContext (engine.ts liveAudio creates it at boot or on the first gesture):
  // an OfflineAudioContext that is never started while the game plays. currentTime is the clip's
  // audio clock; state reads 'suspended' until the clip starts (so playLive drops every sound and the
  // music only notes its wanted track), then 'running'.
  if (typeof OfflineAudioContext !== 'function') return;
  I.active = false;
  I.ctx = null;
  I.nodes = 0;
  I.created = 0;
  const len = Math.ceil(cfg.sampleRate * (cfg.lead + cfg.maxSeconds + 0.5));
  const RealAudioContext = window.AudioContext;
  class ClipAudioContext extends OfflineAudioContext {
    constructor(opts) {
      // only the game's sound layer gets the capture context (Phaser's own sound manager, unused
      // by the game, keeps a real one)
      if (I.ctx || !fromAudio()) {
        if (!RealAudioContext) throw new Error('no AudioContext');
        return new RealAudioContext(opts);
      }
      super(2, len, cfg.sampleRate);
      I.created++;
      I.ctx = this;
    }
    get currentTime() {
      return this === I.ctx ? I.now : 0;
    }
    get state() {
      return this === I.ctx && I.active ? 'running' : 'suspended';
    }
    resume() {
      return Promise.resolve();
    }
    suspend() {
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
    createGain() {
      if (this === I.ctx) I.nodes++;
      return super.createGain();
    }
  }
  I.ClipAudioContext = ClipAudioContext;
  window.AudioContext = ClipAudioContext;
  window.webkitAudioContext = ClipAudioContext;
  // Offline, a disconnect removes the node for the WHOLE render: on the capture context it is a
  // no-op (every voice ends by its own scheduled stop; the offline renderers never disconnect either).
  const disc = AudioNode.prototype.disconnect;
  AudioNode.prototype.disconnect = function (...a) {
    if (I.ctx && this.context === I.ctx) return undefined;
    return disc.apply(this, a);
  };
  // AudioParam.value written on a param that already has automation: live, that is
  // setValueAtTime(v, currentTime); offline (before rendering) it would apply from t = 0.
  const P = AudioParam.prototype;
  const automated = new WeakSet();
  for (const k of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'setValueCurveAtTime', 'cancelScheduledValues', 'cancelAndHoldAtTime']) {
    const f = P[k];
    if (typeof f !== 'function') continue;
    P[k] = function (...a) {
      automated.add(this);
      return f.apply(this, a);
    };
  }
  const vd = Object.getOwnPropertyDescriptor(P, 'value');
  if (vd && vd.set) {
    Object.defineProperty(P, 'value', {
      configurable: true,
      enumerable: vd.enumerable,
      get: vd.get,
      set(v) {
        if (I.active && automated.has(this)) {
          I.valueWrites = (I.valueWrites ?? 0) + 1;
          this.setValueAtTime(v, I.now);
        } else vd.set.call(this, v);
      },
    });
  }
}

// ---------------------------------------------------------------- in-page capture

/** Installs window.__clip (serialized by Playwright; everything it needs comes in `o`). */
async function installInPage(o) {
  const N = window.__neon;
  const I = window.__clipInit;
  if (!I) throw new Error('the init script did not run');
  const FRAME = 1000 / 60;
  const DT = o.delta;
  const sfxMod = await import('/src/audio/sfx.ts');
  const musMod = await import('/src/audio/music.ts');
  const eng = await import('/src/audio/engine.ts');
  const { sfx, music } = sfxMod;
  const musicEngine = musMod.musicEngine;

  const log = { sfx: [], music: [], numbers: [], marks: [], hooks: [] };
  const S = {
    /** Clip game frame (0 = the clip's first video frame); null before the clip starts. */
    frame: null,
    /** Clip frame of the scenario's start (t = 0 of measure.mjs); null on other pages. */
    actionFrame: null,
    started: false,
    dispatches: [],
    running: 0,
    idleSince: null,
    musicAtStart: null,
    mutedAtStart: null,
    musicVolume: null,
  };
  const ms = (f) => Math.round(f * DT * 1000) / 1000;
  const audioNow = (f) => o.lead + (f * DT) / 1000;

  // ---------------------------------------------------------------- the clock (tools/measure.mjs)
  const loop = N.game.loop;
  const CLOCK0 = 65536;
  const NOW0 = 2 ** 30;
  let clock = CLOCK0;
  let vnow = NOW0;
  let frameNo = 0;
  const armed = N.__duelArmed;
  if (Array.isArray(armed)) armed.splice(0); // the real-time duel's armed scenario start: dropped
  N.freeze(); // sleeps the RAF loop
  Date.now = () => vnow;
  loop.lastTime = CLOCK0;
  loop.time = CLOCK0;
  loop.frame = 0;
  const exactLoop = typeof loop.callback === 'function';
  const patched = new WeakSet();
  const patchTweens = () => {
    for (const s of N.game.scene.scenes) {
      const tm = s.sys && s.sys.tweens;
      if (!tm || patched.has(tm)) continue;
      patched.add(tm);
      tm.getDelta = () => DT;
      tm.startTime = vnow;
      tm.prevTime = vnow;
    }
  };
  patchTweens();
  const tick = () => new Promise((r) => setTimeout(r, 0));
  let probe = null; // per-frame probe (numbers), set once the scene is known
  const step = async () => {
    const prev = clock;
    frameNo++;
    clock = CLOCK0 + frameNo * DT;
    vnow = NOW0 + frameNo * DT;
    if (S.frame !== null) {
      S.frame++;
      I.now = audioNow(S.frame);
    }
    patchTweens();
    if (exactLoop) {
      loop.now = clock;
      loop.rawDelta = DT;
      loop.time += DT;
      loop.delta = DT;
      loop.framesThisSecond++;
      loop.callback(clock, DT);
      loop.lastTime = clock;
      loop.frame++;
    } else {
      loop.smoothStep = false;
      loop.lastTime = prev;
      loop.step(clock);
    }
    if (probe) probe(0); // made during this frame's update: on screen this frame
    await tick(); // promise-chained cinematics continue, as between real frames
    if (probe) probe(1); // made in a continuation: on screen from the next frame
    if (S.frame !== null) I.run(I.now); // the music's lookahead pump, voice clean-up
  };
  const reseed = async () => {
    for (const [mod, fn, seed] of o.seeders) {
      try {
        const md = await import(mod);
        if (typeof md[fn] === 'function') md[fn](seed);
      } catch {
        /* module gone / renamed */
      }
    }
  };

  // ---------------------------------------------------------------- sound log hooks
  const opt = (x) => {
    if (!x || typeof x !== 'object') return undefined;
    const r = {};
    for (const [k, v] of Object.entries(x)) if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') r[k] = v;
    return r;
  };
  const play = sfx.play;
  const solo = o.solo && o.solo.length ? new Set(o.solo) : null;
  sfx.play = function (name, opts, ...more) {
    const before = I.nodes;
    const r = solo && !solo.has(name) ? undefined : play.call(this, name, opts, ...more);
    if (S.frame !== null) {
      const rec = { frame: S.frame, ms: ms(S.frame), name, played: I.nodes > before };
      if (solo && !solo.has(name)) rec.soloedOut = true;
      const oo = opt(opts);
      if (oo && Object.keys(oo).length) rec.opts = oo;
      log.sfx.push(rec);
    } else log.sfx.push({ frame: null, beforeClip: true, name, played: false });
    return r;
  };
  for (const k of ['play', 'stop', 'setIntensity', 'setVolume']) {
    const f = music[k];
    if (typeof f !== 'function') continue;
    music[k] = function (...a) {
      log.music.push({ frame: S.frame, ms: S.frame === null ? null : ms(S.frame), call: k, arg: a[0] ?? null });
      return f.apply(this, a);
    };
  }
  for (const k of ['setMuted', 'setVolume']) {
    const f = sfx[k];
    if (typeof f !== 'function') continue;
    sfx[k] = function (...a) {
      log.music.push({ frame: S.frame, ms: S.frame === null ? null : ms(S.frame), call: `sfx.${k}`, arg: a[0] ?? null });
      return f.apply(this, a);
    };
  }
  if (!o.music) {
    // sound effects only: the music never starts (and so never ducks)
    musicEngine.play = () => undefined;
    musicEngine.kick = () => undefined;
    log.hooks.push('music off');
  }

  // ---------------------------------------------------------------- deterministic restart (duel scenarios)
  await reseed();
  let held = null;
  let D = null;
  let sc = null;
  if (o.duelKey) {
    const scs = await import('/src/duel/scenarios.ts');
    const scenario = scs.SCENARIOS[o.duelKey];
    if (!scenario) throw new Error(`unknown scenario ${o.duelKey}`);
    log.desc = scenario.desc ?? null;
    if (!N.duel || typeof N.duel.restart !== 'function') throw new Error('no __neon.duel.restart');
    let ready = false;
    N.duel.restart({ stage: scenario.stage, scenario: o.duelKey, filmScenario: true }).then(() => (ready = true));
    let k = 0;
    while (!ready && k++ < 1800) await step();
    log.restartFrames = k;
    if (!ready) throw new Error('the restarted duel never became ready');
    held = Array.isArray(N.__duelArmed) ? N.__duelArmed.splice(0) : [];
    if (!held.length) throw new Error('the restarted duel armed no scenario start');
    D = N.duel;
    sc = N.game.scene.getScene('Duel');
    // scenario actions (runSteps looks D.dispatch up on every step)
    const dispatch = D.dispatch;
    D.dispatch = (a) => {
      const rec = { type: a.type, frame: S.frame, end: null };
      S.dispatches.push(rec);
      const p = dispatch(a);
      Promise.resolve(p).then(
        () => (rec.end = S.frame),
        () => (rec.end = S.frame),
      );
      return p;
    };
    const dir = sc.director;
    if (dir && typeof dir.runEvent === 'function') {
      const orig = dir.runEvent.bind(dir);
      dir.runEvent = (b, i, h) => {
        S.running++;
        const p = orig(b, i, h);
        Promise.resolve(p).then(
          () => S.running--,
          () => S.running--,
        );
        return p;
      };
    }
    if (sc.events) sc.events.on('v3:contact', () => S.frame !== null && log.marks.push({ frame: S.frame, ms: ms(S.frame), what: 'v3:contact' }));
    // damage / heal / stat numbers (fx:num:* containers), at the first frame they are on screen
    const seen = new WeakSet();
    for (const c of sc.children.list) seen.add(c);
    probe = (phase) => {
      for (const c of sc.children.list) {
        if (c.type !== 'Container' || seen.has(c)) continue;
        seen.add(c);
        const g = c.list && c.list[0];
        const key = g && g.texture && g.texture.key;
        if (typeof key !== 'string' || !key.startsWith('fx:num:') || S.frame === null) continue;
        const text = c.list.map((x) => (x.frame ? x.frame.name : '')).join('');
        const f = S.frame + phase;
        let w = 0;
        let h = 0;
        try {
          const b = c.getBounds();
          w = Math.round(b.width);
          h = Math.round(b.height);
        } catch {}
        log.numbers.push({ frame: f, ms: ms(f), text, kind: key.slice(7), x: Math.round(c.x), y: Math.round(c.y), w, h });
      }
    };
    const warmFrames = Math.round((o.warm - o.pre) / FRAME);
    for (let k2 = 0; k2 < warmFrames; k2++) await step();
    for (const c of sc.children.list) seen.add(c);
  }
  log.hooks.push(exactLoop ? 'clock: exact loop delta' : 'clock: TimeStep.step');

  // ---------------------------------------------------------------- the capture context
  const startClip = () => {
    // the game's live context is the init script's ClipAudioContext (made at boot, or now)
    const live = eng.liveAudio();
    if (!live || live.ctx !== I.ctx || !(live.ctx instanceof I.ClipAudioContext)) {
      throw new Error(`the game's AudioContext is not the capture context (live: ${live ? live.ctx.constructor.name : 'none'}, shim: ${typeof I.ClipAudioContext}, created: ${I.created}, AudioContext: ${window.AudioContext && window.AudioContext.name})`);
    }
    I.reseed(o.seed);
    I.now = o.preroll;
    I.virtual = true;
    S.mutedAtStart = sfx.isMuted();
    S.musicVolume = typeof musMod.musicVolume === 'function' ? musMod.musicVolume() : null;
    if (!o.music) musicEngine.stop(0); // forget the wanted track (play / kick are no-ops now)
    // "running" from now on: the music the duel asked for while suspended starts (engine.ts
    // whenRunning listeners), --music-pre seconds before the clip's first frame, on the audio clock
    I.active = true;
    live.ctx.dispatchEvent(new Event('statechange'));
    if (o.music) musicEngine.kick();
    for (let t = o.preroll; t < o.lead - 1e-9; t = Math.min(o.lead, t + 0.025)) I.run(t);
    I.run(o.lead);
    S.musicAtStart = musicEngine.current();
    S.frame = 0;
    I.now = audioNow(0);
  };

  /**
   * Start the scenario's actions (t = 0 of measure.mjs) at the current clip frame. As in
   * measure.mjs the held start runs right before a step, with no yield in between: its promise
   * chain continues inside that frame (after its update), so the timelines match frame for frame.
   */
  const startAction = () => {
    S.started = true;
    S.actionFrame = S.frame;
    if (held) for (const f of held) f();
  };

  window.__clip = {
    async begin() {
      startClip();
      if (!o.duelKey) S.started = true;
      return { musicAtStart: S.musicAtStart, mutedAtStart: S.mutedAtStart, musicVolume: S.musicVolume, restartFrames: log.restartFrames ?? null };
    },
    /** Step `n` game frames; returns whether a --seconds auto clip is done. */
    async advance(n) {
      for (let k = 0; k < n; k++) {
        if (o.duelKey && !S.started && S.frame >= o.preFrames) {
          await reseed(); // (measure.mjs re-seeds right before t = 0 too)
          startAction();
        }
        await step();
      }
      let done = false;
      if (o.duelKey && S.started) {
        const open = S.dispatches.some((d) => d.end === null);
        const idle = S.dispatches.length > 0 && !open && !D.busy() && S.running === 0;
        if (!idle) S.idleSince = null;
        else if (S.idleSince === null) S.idleSince = S.frame;
        done = S.idleSince !== null && (S.frame - S.idleSince) * DT >= o.tail;
      }
      return { frame: S.frame, done, errors: (N.errors ?? []).length };
    },
    /** Render the whole timeline offline; returns the clip's samples (base64 float32 per channel). */
    async finish(frames, fps) {
      const seconds = frames / fps;
      I.virtual = false;
      const buf = await I.ctx.startRendering();
      const off = Math.round(o.lead * o.sampleRate);
      const len = Math.round(seconds * o.sampleRate);
      const chans = [];
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1));
        const part = new Float32Array(len);
        part.set(d.subarray(off, Math.min(d.length, off + len)));
        const bytes = new Uint8Array(part.buffer);
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        chans.push(btoa(s));
      }
      let derr = { handlers: [], timeouts: [] };
      try {
        derr = D ? D.errors() : derr;
      } catch {}
      return {
        chans,
        log,
        actionFrame: S.actionFrame,
        dispatches: S.dispatches,
        virtualTimersFired: I.fired,
        valueWrites: I.valueWrites ?? 0,
        contexts: I.created,
        errors: { neon: [...(N.errors ?? [])], handlers: (derr.handlers ?? []).map(String), timeouts: [...(derr.timeouts ?? [])] },
      };
    },
  };
  return { desc: log.desc ?? null, restartFrames: log.restartFrames ?? null };
}

// ---------------------------------------------------------------- levels

const db = (v) => (v > 0 ? Math.round(2000 * Math.log10(v)) / 100 : -Infinity);

function levels(chans) {
  const out = { channels: [], clippedSamples: 0, int16Saturated: 0 };
  const n = chans[0].length;
  const win = Math.round(SR * 0.4);
  let loudest = 0;
  let loudestAt = 0;
  for (let i = 0; i + win <= n || i === 0; i += Math.round(SR * 0.1)) {
    let e = 0;
    let cnt = 0;
    for (const d of chans) for (let j = i; j < Math.min(n, i + win); j++, cnt++) e += d[j] * d[j];
    const r = Math.sqrt(e / Math.max(1, cnt));
    if (r > loudest) {
      loudest = r;
      loudestAt = i / SR;
    }
    if (i + win > n) break;
  }
  for (const d of chans) {
    let peak = 0;
    let peakAt = 0;
    let e = 0;
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i]);
      if (a > peak) {
        peak = a;
        peakAt = i;
      }
      e += d[i] * d[i];
      if (a >= 1) out.clippedSamples++;
      if (Math.round(d[i] * 32767) > 32767 || Math.round(d[i] * 32767) < -32768) out.int16Saturated++;
    }
    out.channels.push({ peak: Math.round(peak * 1e5) / 1e5, peakDb: db(peak), peakAtS: Math.round((peakAt / SR) * 1000) / 1000, rmsDb: db(Math.sqrt(e / Math.max(1, d.length))) });
  }
  out.peakDb = Math.max(...out.channels.map((c) => c.peakDb));
  out.loudest400msRmsDb = db(loudest);
  out.loudest400msAtS = Math.round(loudestAt * 1000) / 1000;
  return out;
}

function writeWav(file, chans) {
  const n = chans[0].length;
  const ch = chans.length;
  const data = Buffer.alloc(n * ch * 2);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-32768, Math.min(32767, Math.round(chans[c][i] * 32767)));
      data.writeInt16LE(v, (i * ch + c) * 2);
    }
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(ch, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * ch * 2, 28);
  h.writeUInt16LE(ch * 2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
}

// ---------------------------------------------------------------- main

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const frameDir = args.frames ? path.resolve(root, args.frames) : fs.mkdtempSync(path.join(os.tmpdir(), 'neon-clip-'));
fs.mkdirSync(frameDir, { recursive: true });
for (const f of fs.readdirSync(frameDir)) if (/^f\d{5}\.png$/.test(f)) fs.unlinkSync(path.join(frameDir, f));

const server = await createServer({
  root,
  logLevel: 'error',
  server: { port: 5900 + Math.floor(Math.random() * 600), host: '127.0.0.1', strictPort: false, hmr: false },
  clearScreen: false,
});
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: chromePath(),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});

let failed = false;
const logs = [];
const wall0 = Date.now();
let result = null;
let frames = 0;
let info = null;
let begin = null;
try {
  const context = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  await context.addInitScript(initScript, { seed: SEED, settings: SETTINGS, muted: args.muted === 'true', sampleRate: SR, lead: LEAD, maxSeconds: MAX_SECONDS });
  const page = await context.newPage();
  const timeout = Number(args.timeout ?? 120000);
  page.setDefaultTimeout(Math.max(timeout, 600000));
  page.setDefaultNavigationTimeout(Math.max(timeout, 240000));
  page.on('console', (msg) => {
    const t = msg.text();
    if (msg.type() === 'error' || msg.type() === 'warning') logs.push(`[console.${msg.type()}] ${t}`);
  });
  page.on('pageerror', (e) => {
    failed = true;
    logs.push(`[pageerror] ${e.message}`);
  });
  const url = base + pagePath + q;
  try {
    await page.goto(url, { waitUntil: 'load' });
  } catch (e) {
    console.log(`[clip] retrying ${url}: ${String(e.message).split('\n')[0]}`);
    await page.goto(url, { waitUntil: 'load' });
  }
  await page.waitForFunction((duel) => window.__neon && window.__neon.ready === true && (!duel || !!window.__neon.duel), !!DUEL_KEY, { timeout });

  info = await page.evaluate(installInPage, {
    delta: DELTA,
    seeders: SEEDERS,
    duelKey: DUEL_KEY,
    warm: WARM,
    pre: PRE,
    preFrames: Math.round(PRE / (1000 / 60)),
    tail: TAIL,
    music: MUSIC,
    lead: LEAD,
    preroll: PREROLL,
    maxSeconds: MAX_SECONDS,
    sampleRate: SR,
    seed: SEED,
    solo: SOLO,
  });
  begin = await page.evaluate(() => window.__clip.begin());

  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  const clip = { x: box.x, y: box.y, width: 640, height: 360 };
  const maxFrames = SECONDS !== null ? Math.round(SECONDS * FPS) : Math.floor((CAP / 1000) * FPS);
  const gameFrameOf = (i) => Math.round((i * 60) / FPS);
  let done = false;
  for (let i = 0; i < maxFrames; i++) {
    if (i > 0) {
      const st = await page.evaluate((n) => window.__clip.advance(n), gameFrameOf(i) - gameFrameOf(i - 1));
      if (AUTO && DUEL_KEY && st.done) done = true;
    }
    await page.screenshot({ clip, path: path.join(frameDir, `f${String(i).padStart(5, '0')}.png`) });
    frames = i + 1;
    if (frames % (FPS * 2) === 0) process.stdout.write(`[clip] ${frames} frames (${(frames / FPS).toFixed(1)} s)\r`);
    if (done) break;
  }
  if (AUTO && DUEL_KEY && !done) logs.push(`[clip] --seconds auto: the duel was not idle after the --cap (${CAP} ms); clip cut there`);
  process.stdout.write('\n');
  result = await page.evaluate(({ frames, fps }) => window.__clip.finish(frames, fps), { frames, fps: FPS });
  for (const e of result.errors.neon) logs.push(`[neon.errors] ${e}`);
  for (const e of result.errors.handlers) logs.push(`[handler error] ${e}`);
  if (result.errors.neon.length || result.errors.handlers.length) failed = true;
} catch (e) {
  failed = true;
  logs.push(`[clip] ${e && e.stack ? e.stack : e}`);
} finally {
  await browser.close();
  await server.close();
}
for (const l of logs) console.log(l);
if (!result) {
  console.error('[clip] capture failed');
  process.exit(1);
}

// ---------------------------------------------------------------- audio → WAV, levels

const chans = result.chans.map((b) => {
  const buf = Buffer.from(b, 'base64');
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
});
const wavFile = `${BASE}.wav`;
writeWav(wavFile, chans);
const lv = levels(chans);

// ---------------------------------------------------------------- mux

const gameFrameMs = (f) => f * DELTA;
const markerFrames = [];
for (const s of result.log.sfx) {
  if (s.frame === null || !MARKERS.includes(s.name) || !s.played) continue;
  // the video frame on screen when the sound becomes audible (see AUDIBLE_MS)
  const at = (gameFrameMs(s.frame) + AUDIBLE_MS) / 1000;
  const vf = Math.floor(at * FPS + 1e-9);
  if (vf < frames) markerFrames.push({ name: s.name, ms: s.ms, audibleMs: Math.round((gameFrameMs(s.frame) + AUDIBLE_MS) * 10) / 10, videoFrame: vf });
}
const hold = Math.max(1, Math.round(FPS / 10));
const filters = [`scale=iw*${SCALE}:ih*${SCALE}:flags=neighbor:out_color_matrix=bt709:out_range=tv`, 'format=yuv420p'];
if (markerFrames.length) {
  const en = [...new Set(markerFrames.map((mf) => mf.videoFrame))].map((f) => `between(n,${f},${f + hold - 1})`).join('+');
  const b = 4 * SCALE;
  filters.push(`drawbox=x=${b}:y=${b}:w=${8 * SCALE}:h=${8 * SCALE}:color=white:t=fill:enable='${en}'`);
}
const ff = [
  '-y', '-hide_banner', '-loglevel', 'error',
  '-framerate', String(FPS), '-i', path.join(frameDir, 'f%05d.png'),
  '-i', wavFile,
  '-map', '0:v:0', '-map', '1:a:0',
  '-vf', filters.join(','),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', String(CRF), '-tune', 'animation', '-profile:v', 'high',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '192k', '-ar', String(SR), '-ac', '2',
  '-movflags', '+faststart',
  OUT,
];
try {
  execFileSync('/usr/bin/ffmpeg', ff, { stdio: ['ignore', 'inherit', 'inherit'] });
} catch (e) {
  console.error(`[clip] ffmpeg failed: ${e.message}`);
  failed = true;
}
if (!args.frames) fs.rmSync(frameDir, { recursive: true, force: true });

// ---------------------------------------------------------------- report

const inClip = result.log.sfx.filter((s) => s.frame !== null);
const dropped = inClip.filter((s) => !s.played && !s.soloedOut);
const doc = {
  tool: 'tools/clip.mjs',
  version: 1,
  date: new Date().toISOString(),
  git: gitInfo(),
  query,
  page: pagePath || 'index.html',
  scenario: DUEL_KEY,
  desc: info?.desc ?? null,
  options: { fps: FPS, scale: SCALE, music: MUSIC, musicPre: MUSIC_PRE, seconds: SECONDS ?? 'auto', pre: PRE, warm: WARM, tail: TAIL, cap: CAP, seed: SEED, delta: DELTA, crf: CRF, markers: MARKERS, solo: SOLO, settings: SETTINGS, muted: args.muted === 'true' },
  files: { mp4: path.relative(root, OUT), wav: path.relative(root, wavFile), frames: args.frames ? path.relative(root, frameDir) : null },
  frames,
  seconds: frames / FPS,
  sampleRate: SR,
  /** Clip frame k (1/60 s game frames) is at k·delta ms in the WAV / MP4. */
  gameFrameMs: DELTA,
  videoFrameOfGameFrame: `floor(k·delta·fps/1000) (video frame i shows game frame round(i·60/fps))`,
  actionFrame: result.actionFrame,
  actionMs: result.actionFrame === null ? null : gameFrameMs(result.actionFrame),
  audio: { lead: LEAD, preroll: PREROLL, musicAtStart: begin?.musicAtStart ?? null, mutedAtStart: begin?.mutedAtStart ?? null, musicVolume: begin?.musicVolume ?? null, virtualTimersFired: result.virtualTimersFired, automatedValueWrites: result.valueWrites, audioContexts: result.contexts },
  levels: lv,
  markers: markerFrames,
  sfx: result.log.sfx,
  music: result.log.music,
  numbers: result.log.numbers,
  marks: result.log.marks,
  dispatches: result.dispatches,
  restartFrames: info?.restartFrames ?? null,
  hooks: result.log.hooks,
  errors: result.errors,
  wallMs: Date.now() - wall0,
};
fs.writeFileSync(`${BASE}.json`, JSON.stringify(doc, null, 1));

const fmtDb = (v) => (Number.isFinite(v) ? `${v.toFixed(1)} dBFS` : '-inf');
console.log(`[clip] ${DUEL_KEY ? `${DUEL_KEY}: ` : ''}${frames} frames @ ${FPS} fps = ${(frames / FPS).toFixed(3)} s; music ${MUSIC ? begin?.musicAtStart ?? 'none playing' : 'off'}${begin?.mutedAtStart ? ' (game muted)' : ''}`);
console.log(`[clip] sounds: ${inClip.length} sfx.play (${dropped.length} dropped by the game's own rules${dropped.length ? `: ${dropped.map((s) => `${s.name}@${Math.round(s.ms)}`).join(', ')}` : ''}), ${result.log.music.filter((x) => x.frame !== null).length} music calls in the clip`);
console.log(`[clip] levels: peak ${lv.channels.map((c) => fmtDb(c.peakDb)).join(' / ')} (L/R), RMS ${lv.channels.map((c) => fmtDb(c.rmsDb)).join(' / ')}, loudest 400 ms ${fmtDb(lv.loudest400msRmsDb)} at ${lv.loudest400msAtS} s, clipped samples ${lv.clippedSamples}`);
if (markerFrames.length) console.log(`[clip] markers: ${markerFrames.map((mf) => `${mf.name}@${Math.round(mf.ms)}ms→frame ${mf.videoFrame}`).join(', ')}`);
console.log(`[clip] wrote ${path.relative(root, OUT)}, ${path.relative(root, wavFile)}, ${path.relative(root, BASE)}.json  [${Math.round((Date.now() - wall0) / 1000)} s]`);
process.exit(failed ? 1 : 0);
