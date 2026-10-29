#!/usr/bin/env node
// Cinematic timing / camera measurement of staged duel scenarios (headless Chromium + Vite dev
// server). The regression gate of the v3 plan (docs/v3/A0_ENVANTER.md §6.1 item 1).
//
//   node tools/measure.mjs --scenarios saWyrmAtk,spBolt [options]
//   node tools/measure.mjs --diff old.json new.json [--tol 17]     (compare two runs, no browser)
//
//   e.g. the A1+ regression gate (on unchanged timings it prints "same" for every scenario):
//   node tools/measure.mjs --scenarios baseline --jobs 2 --out shots/v3/now.json \
//     --compare shots/v3/a1/baseline/measure-baseline.json
//
//   --scenarios a,b,c  scenario keys (src/duel/scenarios.ts + src/duel/scenarios/*.ts), or a preset:
//                      ref (the 10 reference scenarios of A0 §6.1 item 1), baseline (ref + 5 more),
//                      all (every scenario; slow). Presets and keys can be mixed: ref,tbMirror
//                      A trailing * selects every key with that prefix: 'slice*' (the A2 slice pack)
//   --look v3          adds &look=v3 (the v3 look switch)
//   --zones 5          adds &zones=5 (the 5+5 board; honoured only with --look v3)
//   --arena v2         adds &arena=v2
//   --speed N          adds &speed=N (default: the game default, 1×)
//   --query "&k=v"     any extra URL query
//   --out FILE         JSON output (default shots/measure.json)
//   --root DIR         serve another checkout (e.g. a snapshot of an older commit) instead of this one
//   --cap MS           max game time per scenario (default 20000)
//   --settle MS        game time kept running after input-ready / the game-over prompt (default 300)
//   --jobs N           scenarios measured in parallel, one browser context each (default 1)
//   --norender         skip Phaser rendering (faster; game time does not depend on it)
//   --anims all        also log every frame of looping unit anims (idle / guard); default: only
//                      anim switches and the frames of one-shot anims
//   --compare FILE     after the run, diff against an earlier JSON (exit code 2 when a metric moved
//                      by more than --tol ms; default 17 = 1 frame)
//   --warm MS          stepped game time the staged duel settles before the action starts (default
//                      1000; see Method)
//   --debug            also store per-frame clock / object-count traces (big JSON)
//   --note "text"      free-form note stored in the JSON (e.g. which commit a --root snapshot is)
//   --delta MS|exact   per-frame delta of every clock (default 16.666666666666664 = one float step
//                      below 1000/60, see Method; "exact" = 16.666666666666668 = 1000/60)
//   --launch a,b       also measure duel LAUNCHES (no scenario: a URL that starts a duel with its
//                      opening, held for the tool's clock with &holdIntro=1): the presets opening
//                      (?mode=hotseat&seed=1&holdIntro=1&curtain=0, gameStart …) and openingSkip (the
//                      same + &skipIntro=1), or name=?query pairs. Stored under scenarios[name] with
//                      launch = the query. The duel is restarted from the launch data under the
//                      tool's clock and t = 0 is the start of its held opening (no --warm); input
//                      ready = the first wait for the player. Only --launch (no --scenarios) skips
//                      the scenario list
//   --camera-trace     also store camera.trace: [t, scrollX, scrollY, zoom] of every frame (the
//                      opening camera trace of docs/v3/A6_PLAN.md §6.3); --diff compares traces
//   --camera-gate BASE.json   the fixed-camera gate (docs/v3/A5_PLAN.md §0 K1 / §6.4, A6_PLAN.md
//                      §6.3; the user's decision: the camera does not change — no new move, no
//                      removed move). Per measured scenario: zoom.max = 1, camera.closeUpCalls = 0,
//                      and against BASE.json (the same key): camera.focusCalls EQUAL, and
//                      camera.maxScrollPx equal within one frame of camera motion (± the larger
//                      maxScrollStepPx of the two). A key the base does not have is checked on the
//                      first two only (NOBASE); a base without camera fields is refused (exit 1).
//                      Exit code 3 when any scenario fails (it wins over --compare's 2). Offline:
//                      node tools/measure.mjs --camera-gate BASE.json NOW.json (no browser)
//   --help             this text
//
// Method (deterministic: the same code gives the same numbers, whatever the CPU load):
// each scenario loads ?dev=duel&s=<key>&test=1 in a fresh browser context. Once the duel is ready
// the tool freezes the game loop and drives it with its OWN clock: every frame advances the loop,
// every TweenManager and Date.now by the same constant delta, with a macrotask between frames
// (promise-chained cinematics advance as in a real browser). main.ts's stepped clock is based on
// the wall clock instead, so the float rounding of its deltas changed from run to run. The duel
// that ran in real time before the freeze is then RESTARTED under the tool's clock (same stage,
// same scenario) with the module-level random streams re-seeded, so idle phases, ambient
// particles and random draws at t = 0 are a function of the code alone. The scene settles for
// --warm ms, the streams are re-seeded again and the scenario's actions start: t = 0. All times
// are GAME ms from t = 0; the first event starts at ~17 ms (after the first frame).
//
// The delta: Phaser fires a timer / tween / anim frame when its accumulated delta reaches the
// duration, so a duration of exactly N frames (50, 100, 300, 550 ms …) lands on frame N or N+1
// depending on the last bit of the delta. The default delta, one float step below 1000/60, makes
// such links land on frame N+1 every time: what main.ts's stepped clock mostly did, so the numbers
// match tools/shot.mjs films and the A0 tables (A1 baseline: 43 of 49 A0 values within ±1 frame,
// 35 exact). --delta exact (1000/60 rounded up) lands them on frame N: 0–6 frames earlier overall.
//
// Determinism check (A1 baseline): --jobs 1 and --jobs 2 runs give identical timelines (±0 ms,
// every event, sound, number and unit anim frame). A0's scratch hooks moved by 1–6 frames between
// runs of the same code (suWyrm 3733–3817 ms).
//
// Baselines: shots/v3/a1/baseline/measure-baseline.json was measured BEFORE A1. Two A1 items move v1
// numbers on purpose, so a --compare against it still flags them (A1 fix round 1 traced every one):
//   - integer camera (A1.2): zoom.max is 1 (2 in a close-up) instead of 1.06–1.08, and an effect
//     that starts from a world point's SCREEN position starts elsewhere (the ember wolf's howl-burn
//     wisp: saWolfP2 / saGolemBlocked / sbThornDies end one frame earlier);
//   - duel-start seed reset (A1.12): the restarted duel this tool measures now starts from a fresh
//     page's random streams instead of continuing the first duel's, so each unit's random idle start
//     frame differs, and tributeStream (which streams the sacrificed unit's current frame) moves
//     12 tribute scenarios (suMagus, suCoral, spBladeBreak, saMagusEffect …) by ±1 frame.
// The other 262 scenarios match the pre-A1 code (events, sounds, numbers, one-shot anim frames),
// and with both causes neutralised (old camera zoom + the carried unit seed) those 15 matched it
// frame for frame too. Late 'fireBurst' sounds (victory fireworks) drew from Math.random before
// A1, so they are not comparable with pre-A1 runs. The same presets re-measured after A1:
// shots/v3/a1/fix1/measure-baseline-refreshed.json (v1), measure-baseline-v2.json (?arena=v2).
//
// Per scenario the JSON holds:
//   events[]        every cinematic event the Director runs: {batch, i, type, start, end, dur, ...
//                   primitive event fields} (start/end in game ms; end = its handler resolved)
//   sfx[]           [t, name] of every sfx.play
//   contactMs       first impact sound (impactHeavy / impactLight / shieldBlock / directHit) = the
//                   contact frame (A0 convention); contactSfx = its name; impacts[] = all of them.
//                   ?look=v3: the battle's own contact mark wins when there is one (contactSfx
//                   'mark'; contactMarks[] = all of them) — a legacy strike may sound earlier
//   anims[]         (v3) also the frames of units dying off the field (the death kit releases them)
//   numbers[]       every damage / heal / stat number popped: {t, text, kind, x, y, depth}
//   firstNumberMs   first damage number (kind flash/damage); numberAfterContactMs = it − contactMs
//   lp[]            [t, player, value, animate] of HudView.setLp calls (animated = the LP roll)
//   zoom            {max, min, maxAt, hist: {zoom: frames}, fracScrollFrames, maxScrollFrac} of
//                   the world camera (cameras.main); otherCamsMaxZoom = max zoom of the others
//   camera          (A56.0) the world camera's moves, t ≥ 0:
//                     maxScrollPx      largest |scrollX| or |scrollY| of any frame (whole px);
//                                      maxScrollX / maxScrollY per axis; maxScrollAt its first t
//                     maxScrollStepPx  how far that measure moved in the frame that first reached
//                                      the maximum (one frame of camera motion: the gate's tolerance)
//                     scrolledFrames   frames with a scroll ≠ 0
//                     focusCalls       CameraRig.focus calls (leans and close-ups; counted by
//                                      wrapping CameraRig.prototype in the page, no game code
//                                      change); closeUpCalls those with { closeUp: true }
//                     unfocusCalls / descendCalls / resetCalls   the other CameraRig moves
//                     focus[]          [t, x, y, pan, ms, closeUp 0|1, dx, dy] per focus call: the
//                                      target, the options and the lean's whole-px destination
//                     trace[]          with --camera-trace: [t, scrollX, scrollY, zoom] per frame
//   lights          (A56.0, A6_PLAN.md §6.3) calls of the light layer, t ≥ 0: lightCalls
//                   {flash, pool, beam, dim} and lights[] [t, kind, x, y] (dim: [t, 'dim', level])
//                   (LightLayer.prototype wrapped in the page; absent when the layer is off)
//   busy            {first, last}: first / last frame the controller was busy (input locked);
//                   busyMs = last − first
//   inputReadyMs    when the game waits for the player again (HumanInput.waitAction called after
//                   the last scenario action finished) or the game-over prompt opened
//                   (inputReadyKind: action | gameOver); busyToInputMs = inputReadyMs − busy.first.
//                   A scenario of UI steps (A56.0: uiSteps[] = {ui, target, start, end}) that never
//                   asks for a new action (a hover, an open menu) is ready when its last step ended
//                   and nothing ran for 3 frames after it (inputReadyKind: uiSteps)
//   endMs           when the last cinematic event finished; totalMs = endMs − first event start
//   anims[]         [t, unitUid, cardId, animKey, frameName, visible] unit sprite changes
//   errors          page errors, console errors / warnings, cinematic handler errors, watchdog
//   realMsPerFrame  {p50, p95, max} wall time per stepped frame (render cost proxy; NOT
//                   deterministic, ignored by --compare / --diff)

import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { UNSAFE_PORTS } from './lib/pagekit.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(REPO, 'package.json'));

// ---------------------------------------------------------------- presets

const PRESETS = {
  // A0 §6.1 item 1: the 10 reference scenarios of the regression gate
  ref: ['saWyrmAtk', 'saWyrmBlocked', 'saMagusAtk', 'saMagusEffect', 'suWyrm', 'suRevive', 'spBolt', 'tbChains', 'smbPos', 'flowTurnP1'],
  // the A1 baseline: ref + the A2 slice's other paths + both game-over paths (there is no
  // "flowGameOver" key: flowLethal = lethal attack → gameOver, flowSurrender = surrender → gameOver)
  baseline: [
    'saWyrmAtk', 'saWyrmBlocked', 'saMagusAtk', 'saMagusEffect', 'suWyrm', 'suRevive', 'spBolt', 'tbChains', 'smbPos', 'flowTurnP1',
    'suMagus', 'spRecallSet', 'tbMirror', 'flowLethal', 'flowSurrender',
  ],
};

const IMPACT_SFX = ['impactHeavy', 'impactLight', 'shieldBlock', 'directHit'];

/** Random streams re-seeded at t = 0: [module, seeder export, seed]. */
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
const TOL = Number(args.tol ?? 17);

if (args.help || args.h) {
  const src = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n');
  const out = [];
  for (const l of src.slice(1)) {
    if (!l.startsWith('//')) break;
    out.push(l.replace(/^\/\/ ?/, ''));
  }
  console.log(out.join('\n'));
  process.exit(0);
}

/** --launch presets (docs/v3/A6_PLAN.md §5.1: the two opening films of the a6v1 / a6v3 sets). */
const LAUNCHES = {
  opening: '?mode=hotseat&seed=1&holdIntro=1&curtain=0',
  openingSkip: '?mode=hotseat&seed=1&holdIntro=1&curtain=0&skipIntro=1',
};

// ---------------------------------------------------------------- compare

/** Scalar metrics compared by --compare / --diff (ms unless noted). */
const METRICS = ['contactMs', 'firstNumberMs', 'numberAfterContactMs', 'inputReadyMs', 'endMs', 'totalMs', 'busyMs', 'zoom.max'];

function pick(o, dotted) {
  return dotted.split('.').reduce((v, k) => (v == null ? v : v[k]), o);
}

/** Lines describing how `b` differs from `a` (one scenario). */
function diffScenario(a, b, tol) {
  const lines = [];
  for (const m of METRICS) {
    const va = pick(a, m);
    const vb = pick(b, m);
    if (va == null && vb == null) continue;
    const isZoom = m.startsWith('zoom');
    const moved = va == null || vb == null ? true : isZoom ? Math.abs(va - vb) > 0.0005 : Math.abs(va - vb) > tol;
    if (moved) lines.push(`${m}: ${va} → ${vb}${va != null && vb != null && !isZoom ? ` (${vb - va > 0 ? '+' : ''}${vb - va})` : ''}`);
  }
  const ea = a.events ?? [];
  const eb = b.events ?? [];
  if (ea.length !== eb.length) lines.push(`events: ${ea.length} → ${eb.length}`);
  const n = Math.min(ea.length, eb.length);
  for (let i = 0; i < n; i++) {
    const x = ea[i];
    const y = eb[i];
    if (x.type !== y.type) {
      lines.push(`event #${i}: ${x.type} → ${y.type}`);
      break;
    }
    for (const k of ['start', 'end']) {
      if (x[k] == null && y[k] == null) continue;
      if (x[k] == null || y[k] == null || Math.abs(x[k] - y[k]) > tol) lines.push(`event #${i} ${x.type}.${k}: ${x[k]} → ${y[k]}`);
    }
  }
  // sfx order and timing
  const sa = a.sfx ?? [];
  const sb = b.sfx ?? [];
  const firstSfx = sa.findIndex((s, i) => !sb[i] || sb[i][1] !== s[1] || Math.abs(sb[i][0] - s[0]) > tol);
  if (firstSfx >= 0 || sa.length !== sb.length) {
    const i = firstSfx >= 0 ? firstSfx : Math.min(sa.length, sb.length);
    lines.push(`sfx: ${sa.length} → ${sb.length} sounds; first difference #${i}: ${JSON.stringify(sa[i] ?? null)} → ${JSON.stringify(sb[i] ?? null)}`);
  }
  // unit anim/frame sequence (impact frames, pose holds)
  // (the t = 0 rows are the idle phase the action happened to start in: not a timing)
  // (looping idle / guard rows keep their phase from before t = 0: compare anim + visibility only)
  const key = (r) => (/:(idle|guard)$/.test(r[3]) ? `${r[2]}|${r[3]}|${r[5]}` : `${r[2]}|${r[3]}|${r[4]}|${r[5]}`);
  const aa = (a.anims ?? []).filter((r) => r[0] > 0);
  const ab = (b.anims ?? []).filter((r) => r[0] > 0);
  const firstAnim = aa.findIndex((r, i) => !ab[i] || key(ab[i]) !== key(r) || Math.abs(ab[i][0] - r[0]) > tol);
  if (firstAnim >= 0 || aa.length !== ab.length) {
    const i = firstAnim >= 0 ? firstAnim : Math.min(aa.length, ab.length);
    lines.push(`anims: ${aa.length} → ${ab.length} changes; first difference #${i}: ${JSON.stringify(aa[i] ?? null)} → ${JSON.stringify(ab[i] ?? null)}`);
  }
  const errA = countErrors(a);
  const errB = countErrors(b);
  if (errB > errA) lines.push(`errors: ${errA} → ${errB}`);
  // camera fields (A56.0): compared when both runs have them (older files do not)
  if (a.camera && b.camera) lines.push(...cameraDiff(a.camera, b.camera));
  return lines;
}

/** The tolerance of maxScrollPx: one frame of camera motion (the larger step into either maximum). */
function scrollTol(ca, cb) {
  return Math.max(ca?.maxScrollStepPx ?? 0, cb?.maxScrollStepPx ?? 0);
}

/** Lines describing how camera fields `b` differ from `a` (counts exact, maxScrollPx within one frame). */
function cameraDiff(a, b) {
  const lines = [];
  for (const k of ['focusCalls', 'closeUpCalls', 'unfocusCalls', 'descendCalls']) {
    if ((a[k] ?? null) !== (b[k] ?? null)) lines.push(`camera.${k}: ${a[k] ?? '-'} → ${b[k] ?? '-'}`);
  }
  const tol = scrollTol(a, b);
  if (Math.abs((a.maxScrollPx ?? 0) - (b.maxScrollPx ?? 0)) > tol) lines.push(`camera.maxScrollPx: ${a.maxScrollPx} → ${b.maxScrollPx} (±${tol} px = one frame of motion)`);
  // the leans one by one: destination (dx, dy) and close-up flag (times move with retimed scenes)
  const fa = a.focus ?? [];
  const fb = b.focus ?? [];
  const n = Math.min(fa.length, fb.length);
  for (let i = 0; i < n; i++) {
    const x = fa[i];
    const y = fb[i];
    if (x[5] !== y[5] || x[6] !== y[6] || x[7] !== y[7]) {
      lines.push(`camera.focus #${i}: t ${x[0]} → ${y[0]}, lean (${x[6]},${x[7]})${x[5] ? ' close-up' : ''} → (${y[6]},${y[7]})${y[5] ? ' close-up' : ''}`);
      break;
    }
  }
  if (a.trace && b.trace) {
    const m = Math.min(a.trace.length, b.trace.length);
    let first = -1;
    let count = Math.abs(a.trace.length - b.trace.length);
    for (let i = 0; i < m; i++) {
      const p = a.trace[i];
      const q = b.trace[i];
      if (p[1] !== q[1] || p[2] !== q[2] || p[3] !== q[3]) {
        count++;
        if (first < 0) first = i;
      }
    }
    if (count) lines.push(`camera.trace: ${count} of ${Math.max(a.trace.length, b.trace.length)} frames differ${first >= 0 ? `; first at t=${a.trace[first][0]}: ${JSON.stringify(a.trace[first].slice(1))} → ${JSON.stringify(b.trace[first].slice(1))}` : ' (lengths differ)'}`);
  }
  return lines;
}

function countErrors(s) {
  const e = s.errors ?? {};
  return (e.page?.length ?? 0) + (e.neon?.length ?? 0) + (e.handlers?.length ?? 0) + (e.timeouts?.length ?? 0) + (e.console ?? []).filter((c) => c.type === 'error').length;
}

/** Print the differences of two measure JSON files; returns the number of differing scenarios. */
function diffFiles(a, b, tol) {
  let bad = 0;
  const keys = [...new Set([...Object.keys(a.scenarios ?? {}), ...Object.keys(b.scenarios ?? {})])];
  const hasCam = (d) => Object.values(d.scenarios ?? {}).some((s) => s && s.camera);
  if (hasCam(a) !== hasCam(b)) console.log(`[measure] note: camera fields only in the ${hasCam(a) ? 'first' : 'second'} file (measured before tools/measure.mjs had them) — not compared`);
  for (const k of keys) {
    const x = a.scenarios?.[k];
    const y = b.scenarios?.[k];
    if (!x || !y) {
      console.log(`${k}: only in ${x ? 'the first' : 'the second'} file`);
      continue;
    }
    const lines = diffScenario(x, y, tol);
    if (lines.length) {
      bad++;
      console.log(`${k}: DIFFERS`);
      for (const l of lines) console.log(`  ${l}`);
    } else console.log(`${k}: same (±${tol} ms)`);
  }
  return bad;
}

if (args.diff) {
  const a = JSON.parse(fs.readFileSync(path.resolve(args.diff), 'utf8'));
  const b = JSON.parse(fs.readFileSync(path.resolve(args._[0] ?? ''), 'utf8'));
  const bad = diffFiles(a, b, TOL);
  process.exit(bad ? 2 : 0);
}

/**
 * The fixed-camera gate (--camera-gate): every scenario of `now` against the same key of `base`.
 * Returns the number of failing scenarios, or −1 when the base has no camera fields at all.
 */
function cameraGate(base, now, baseName) {
  const baseHasCam = Object.values(base.scenarios ?? {}).some((s) => s && s.camera);
  if (!baseHasCam) {
    console.log(`[measure] camera gate: ${baseName} has no camera fields (measured before tools/measure.mjs recorded them) — re-measure the base with this version`);
    return -1;
  }
  console.log(`[measure] camera gate against ${baseName}: zoom.max = 1, closeUpCalls = 0, focusCalls = base, maxScrollPx = base ± one frame of motion`);
  if ((base.query ?? '') !== (now.query ?? '')) console.log(`[measure] camera gate: note: base query "${base.query ?? ''}", now "${now.query ?? ''}"`);
  let bad = 0;
  let nobase = 0;
  let pass = 0;
  for (const [k, s] of Object.entries(now.scenarios ?? {})) {
    const fails = [];
    const notes = [];
    if (s.failed) fails.push(`the run failed: ${s.failed}`);
    const z = s.zoom?.max;
    if (z == null || Math.abs(z - 1) > 0.0005) fails.push(`zoom.max ${z ?? '-'} ≠ 1`);
    const c = s.camera;
    const b = base.scenarios?.[k]?.camera ?? null;
    if (!c) fails.push('no camera fields in this run');
    else {
      if (c.closeUpCalls !== 0) fails.push(`closeUpCalls ${c.closeUpCalls} ≠ 0`);
      if (b) {
        if (c.focusCalls !== b.focusCalls) fails.push(`focusCalls ${b.focusCalls} → ${c.focusCalls} (must equal the base: no camera move added or removed)`);
        const tol = scrollTol(b, c);
        if (Math.abs(c.maxScrollPx - b.maxScrollPx) > tol) fails.push(`maxScrollPx ${b.maxScrollPx} → ${c.maxScrollPx} (±${tol} px allowed)`);
        else notes.push(`focus ${c.focusCalls}, maxScroll ${c.maxScrollPx}${c.maxScrollPx !== b.maxScrollPx ? ` (base ${b.maxScrollPx}, ±${tol})` : ''}`);
        // informational: a lean that now goes elsewhere
        const fa = b.focus ?? [];
        const fb = c.focus ?? [];
        for (let i = 0; i < Math.min(fa.length, fb.length); i++) {
          if (fa[i][6] !== fb[i][6] || fa[i][7] !== fb[i][7]) {
            notes.push(`note: lean #${i} destination (${fa[i][6]},${fa[i][7]}) → (${fb[i][6]},${fb[i][7]})`);
            break;
          }
        }
      } else notes.push(`NOBASE (${k} is not in the base: only zoom and close-ups checked); focus ${c.focusCalls}, maxScroll ${c.maxScrollPx}`);
    }
    if (fails.length) {
      bad++;
      console.log(`${k}: CAMERA FAIL — ${fails.join('; ')}${notes.length ? `  [${notes.join('; ')}]` : ''}`);
    } else {
      if (!b) nobase++;
      else pass++;
      console.log(`${k}: camera ok — ${notes.join('; ')}`);
    }
  }
  console.log(`[measure] camera gate: ${pass} ok, ${nobase} ok without a base (NOBASE), ${bad} FAIL`);
  return bad;
}

const CAMERA_GATE = args['camera-gate'] && args['camera-gate'] !== 'true' ? args['camera-gate'] : null;
if (CAMERA_GATE && !args.scenarios && !args.launch) {
  // offline: --camera-gate BASE.json NOW.json
  if (!args._[0]) {
    console.error('usage: node tools/measure.mjs --camera-gate BASE.json NOW.json   (or with --scenarios / --launch to measure first)');
    process.exit(1);
  }
  const base = JSON.parse(fs.readFileSync(path.resolve(CAMERA_GATE), 'utf8'));
  const now = JSON.parse(fs.readFileSync(path.resolve(args._[0]), 'utf8'));
  const bad = cameraGate(base, now, CAMERA_GATE);
  process.exit(bad < 0 ? 1 : bad ? 3 : 0);
}

// ---------------------------------------------------------------- run setup

const ROOT = path.resolve(args.root ?? REPO);
const OUT = path.resolve(REPO, args.out ?? 'shots/measure.json');
const CAP = Number(args.cap ?? 20000);
const SETTLE = Number(args.settle ?? 300);
const WARM = Number(args.warm ?? 1000);
/** Per-frame delta of the tool's clock: one float step below 1000/60 (default) or 1000/60. */
const DELTA = args.delta === 'exact' ? 1000 / 60 : args.delta ? Number(args.delta) : 16.666666666666664;
const JOBS = Math.max(1, Number(args.jobs ?? 1));
const NORENDER = args.norender === 'true';
const ALL_ANIMS = args.anims === 'all';
const CAMERA_TRACE = args['camera-trace'] === 'true';
/** --launch: [{ name, query }] (presets or name=?query; holdIntro=1 is added when missing). */
const LAUNCH_LIST = (args.launch && args.launch !== 'true' ? args.launch.split(',') : [])
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const eq = s.indexOf('=');
    const isPair = eq > 0 && !s.startsWith('?') && s.slice(eq + 1).startsWith('?');
    const name = isPair ? s.slice(0, eq) : s;
    let query = isPair ? s.slice(eq + 1) : LAUNCHES[s];
    if (!query) {
      console.error(`[measure] unknown --launch ${s} (presets: ${Object.keys(LAUNCHES).join(', ')}, or name=?query)`);
      process.exit(1);
    }
    if (!/[?&]holdIntro=1(&|$)/.test(query)) query += '&holdIntro=1';
    return { name, query };
  });
let extraQuery = '';
if (args.look) extraQuery += `&look=${encodeURIComponent(args.look)}`;
if (args.zones) extraQuery += `&zones=${encodeURIComponent(args.zones)}`; // 5 = the 5+5 board (needs --look v3)
if (args.arena) extraQuery += `&arena=${encodeURIComponent(args.arena)}`;
if (args.speed) extraQuery += `&speed=${encodeURIComponent(args.speed)}`;
if (args.query) extraQuery += args.query.startsWith('&') ? args.query : `&${args.query}`;

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

function gitInfo(dir) {
  try {
    const sha = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const dirty = execFileSync('git', ['-C', dir, 'status', '--porcelain', '--', 'src'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return { head: sha, srcDirty: dirty.length > 0 };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- in-page measurement

/** Runs inside the page (serialized by Playwright): own clock, deterministic restart, hooks, steps. */
async function measureInPage(o) {
  const N = window.__neon;
  const FRAME = 1000 / 60;
  // the per-frame delta every clock advances by (see the header: default one float step below
  // 1000/60, so exact N-frame durations land on frame N+1 like the A0 / film clock)
  const DT = o.delta > 0 ? o.delta : FRAME;
  let T0 = null;
  const now = () => (T0 === null ? 0 : Math.round(Date.now() - T0));
  const out = { events: [], sfx: [], numbers: [], lp: [], anims: [], inputWaits: [], dispatches: [], hooks: [] };
  if (o.norender) N.game.scene.render = () => undefined;

  let scenario = null;
  if (!o.launch) {
    try {
      const scs = await import('/src/duel/scenarios.ts');
      scenario = scs.SCENARIOS[o.key] ?? null;
    } catch {
      /* listed below as a hook failure */
    }
  }
  out.desc = o.launch ? `launch ${o.launch}` : scenario?.desc ?? null;
  out.steps = scenario?.steps?.length ?? null;
  if (o.launch) out.launch = o.launch;

  // ---------------------------------------------------------------- the clock
  //
  // A clock of our own instead of __neon.step:
  //  - main.ts's freeze() bases its loop clock on performance.now() and Date.now on the wall
  //    clock, and Phaser derives every delta from those absolute values (loop: time − lastTime,
  //    TweenManager: Date.now differences). The float rounding of each delta then changes from
  //    run to run, and a timer / anim frame / tween of exactly N frames (83.3 ms = 5 frames) lands
  //    on frame N or N+1 by chance. Here every clock advances by the same DT per frame: the loop
  //    frame runs with delta = DT (TimeStep.step replicated, without its 10-frame delta smoothing,
  //    which at freeze still holds load-dependent real deltas and clamps while the page is not
  //    focused), every TweenManager's delta is DT (Tween.update still applies the speed /
  //    hit-stop time scales) and Date.now advances DT per frame from NOW0.
  //  - Before the freeze the duel ran in real time (3–12 frames under load), so idle-anim phases,
  //    ambient timers and the random draws of ambient effects differ per run, and they leak into
  //    cinematics (pixelStream takes the current frame's pixels, banners draw from shared random
  //    streams). So the duel is RESTARTED under the frozen clock (same stage, same scenario): its
  //    whole state at t = 0 is then a function of the code alone. It settles `warm` ms, the
  //    module-level random streams are re-seeded, and the scenario's actions start: t = 0.
  const loop = N.game.loop;
  const CLOCK0 = 65536;
  const NOW0 = 2 ** 30;
  let clock = CLOCK0;
  let vnow = NOW0;
  let frameNo = 0;
  const first = N.__duelArmed;
  if (Array.isArray(first)) first.splice(0); // the first (real-time) duel's scenario start: dropped
  N.freeze(); // sleeps the RAF loop
  Date.now = () => vnow;
  loop.lastTime = CLOCK0;
  loop.time = CLOCK0;
  loop.frame = 0;
  const exactLoop = typeof loop.callback === 'function';
  out.hooks.push(exactLoop ? 'clock: exact loop delta' : 'clock: TimeStep.step (no smoothing)');
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
  const step = async () => {
    const prev = clock;
    frameNo++;
    clock = CLOCK0 + frameNo * DT;
    vnow = NOW0 + frameNo * DT;
    patchTweens();
    if (exactLoop) {
      // TimeStep.step(time) with delta := DT
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
    await tick(); // let promise-chained cinematics continue, as between real frames
  };

  // module-level random streams (vfx libraries to their initial seeds, cinematic kits to 1):
  // before the restart (ambient effects draw from them every frame) and again at t = 0
  const reseed = async () => {
    out.reseeded = [];
    for (const [mod, fn, seed] of o.seeders) {
      try {
        const m = await import(mod);
        if (typeof m[fn] === 'function') {
          m[fn](seed);
          out.reseeded.push(`${mod.replace('/src/', '')}:${fn}`);
        }
      } catch {
        /* module gone / renamed: skip */
      }
    }
  };
  await reseed();

  // ---------------------------------------------------------------- deterministic restart
  let held = null;
  if (o.launch && N.duel && typeof N.duel.restart === 'function') {
    // --launch: restart the same duel launch (seed, first player; the URL's holdIntro=1 holds the
    // opening again) under the tool's clock; t = 0 is the held opening's start. The restart
    // promise resolves only after the opening, so wait for the opening to be armed instead.
    const L = N.duel.launch ?? {};
    N.duel.restart({ seed: L.seed, firstPlayer: L.firstPlayer });
    let k = 0;
    while (!(Array.isArray(N.__duelArmed) && N.__duelArmed.length) && k++ < 1800) await step();
    out.restartFrames = k;
    if (!(Array.isArray(N.__duelArmed) && N.__duelArmed.length)) throw new Error('the restarted launch never armed its opening (is holdIntro=1 in the query?)');
    held = N.__duelArmed.splice(0);
  } else if (scenario && N.duel && typeof N.duel.restart === 'function') {
    let ready = false;
    N.duel.restart({ stage: scenario.stage, scenario: o.key, filmScenario: true }).then(() => (ready = true));
    let k = 0;
    while (!ready && k++ < 1800) await step();
    out.restartFrames = k;
    if (!ready) throw new Error('the restarted duel never became ready');
    held = Array.isArray(N.__duelArmed) ? N.__duelArmed.splice(0) : null;
  }
  if (!held || !held.length) {
    out.hooks.push('no deterministic restart / armed scenario start: measuring the real-time duel');
    held = null;
  }
  const D = N.duel;
  const sc = N.game.scene.getScene('Duel');
  const dir = sc.director;
  const ctl = sc.controller;

  // ---------------------------------------------------------------- hooks
  const prim = (ev) => {
    const r = {};
    for (const [k, v] of Object.entries(ev)) {
      if (k === 'type') continue;
      if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') r[k] = v;
    }
    if (ev.pending && typeof ev.pending === 'object') r.pending = ev.pending.kind;
    return r;
  };
  // 1. cinematic events (Director.runEvent: start / end of each event, nested plays included)
  const batches = new WeakMap();
  let batchSeq = 0;
  if (dir && typeof dir.runEvent === 'function') {
    const orig = dir.runEvent.bind(dir);
    dir.runEvent = (b, i, h) => {
      if (T0 === null) return orig(b, i, h);
      if (!batches.has(b)) batches.set(b, batchSeq++);
      const ev = b.events[i];
      const rec = { batch: batches.get(b), i, type: ev.type, start: now(), end: null, dur: null, ...prim(ev) };
      out.events.push(rec);
      const p = orig(b, i, h);
      Promise.resolve(p).then(() => {
        rec.end = now();
        rec.dur = rec.end - rec.start;
      });
      return p;
    };
    out.hooks.push('director.runEvent');
  } else {
    // fallback: start times only, from the cinematics observer
    const reg = await import('/src/cinematics/_core/registry.ts');
    reg.registerObserver((ev) => {
      if (T0 !== null) out.events.push({ batch: null, i: null, type: ev.type, start: now(), end: null, dur: null, ...prim(ev) });
    });
    out.hooks.push('registry.observer');
  }
  // 2. sounds (impact sounds = contact)
  try {
    const sfxMod = await import('/src/audio/sfx.ts');
    const s = sfxMod.sfx;
    const play = s.play;
    s.play = function (name, ...rest) {
      if (T0 !== null) out.sfx.push([now(), name]);
      return play.call(this, name, ...rest);
    };
    out.hooks.push('sfx.play');
  } catch (e) {
    out.hooks.push(`sfx.play FAILED ${e}`);
  }
  // 2b. v3 markers (scene events emitted only under ?look=v3): the battle's contact frame
  //     (battle.ts onImpact: 'v3:contact') — the contact even when a legacy strike plays an impact
  //     sound earlier (a stomp) — and the units dying off the field (_v3/death.ts 'v3:dying' /
  //     'v3:dead': released from the field, so the anim log keeps following their death frames)
  out.contactMarks = [];
  const dying = new Set();
  if (sc && sc.events) {
    sc.events.on('v3:contact', () => {
      if (T0 !== null) out.contactMarks.push(now());
    });
    sc.events.on('v3:dying', (u) => u && dying.add(u));
    sc.events.on('v3:dead', (u) => dying.delete(u));
    out.hooks.push('scene v3:contact / v3:dying');
  }
  // 3. LP panel
  const hud = D.views?.hud;
  if (hud && typeof hud.setLp === 'function') {
    const setLp = hud.setLp.bind(hud);
    hud.setLp = (p, v, animate, ...rest) => {
      if (T0 !== null) out.lp.push([now(), p, v, animate !== false]);
      return setLp(p, v, animate, ...rest);
    };
    out.hooks.push('hud.setLp');
  }
  // 4. input ready: the controller asks the human for an action / the game-over prompt opens
  const input = ctl?.input;
  if (input && typeof input.waitAction === 'function') {
    const wa = input.waitAction.bind(input);
    input.waitAction = (...a) => {
      if (T0 !== null) out.inputWaits.push([now(), 'action']);
      return wa(...a);
    };
    out.hooks.push('input.waitAction');
  }
  const prompt = D.views?.prompt;
  if (prompt && typeof prompt.gameOver === 'function') {
    const go = prompt.gameOver.bind(prompt);
    prompt.gameOver = (...a) => {
      if (T0 !== null) out.inputWaits.push([now(), 'gameOver']);
      return go(...a);
    };
    out.hooks.push('prompt.gameOver');
  }
  // scenario actions (runSteps looks D.dispatch up on every step)
  const dispatch = D.dispatch;
  D.dispatch = (a) => {
    const rec = { type: a.type, start: now(), end: null };
    out.dispatches.push(rec);
    const p = dispatch(a);
    Promise.resolve(p).then(
      () => (rec.end = now()),
      () => (rec.end = now()),
    );
    return p;
  };
  // UI steps (A56.0: runSteps looks D.ui up on every step, like D.dispatch): a scenario of UI
  // steps (src/duel/scenarios/a6-base.ts …) is done when its last step is
  out.uiSteps = [];
  if (typeof D.ui === 'function') {
    const ui = D.ui;
    D.ui = (st) => {
      const rec = { ui: st?.ui ?? null, target: st?.at ? JSON.stringify(st.at) : st?.key ?? null, start: now(), end: null };
      out.uiSteps.push(rec);
      const p = ui(st);
      Promise.resolve(p).then(
        () => (rec.end = now()),
        () => (rec.end = now()),
      );
      return p;
    };
    out.hooks.push('duel.ui');
  }
  // 5. camera moves (A56.0, the fixed-camera gate): CameraRig is the only camera API the
  //    cinematics use (ctx.focus / unfocus → views.camera). Its prototype is wrapped in the page
  //    (the game's own module instance), so every rig — the restarted duel's too — is counted.
  const camCalls = { focus: [], unfocus: 0, descend: 0, reset: 0 };
  try {
    const cr = await import('/src/duel/CameraRig.ts');
    const P = cr.CameraRig && cr.CameraRig.prototype;
    if (!P || typeof P.focus !== 'function') throw new Error('no CameraRig.prototype.focus');
    if (!P.__measureCam) {
      const orig = { focus: P.focus, unfocus: P.unfocus, descend: P.descend, reset: P.reset };
      P.__measureCam = { orig, sink: null };
      P.focus = function (xy, opts) {
        const s = P.__measureCam.sink;
        if (s) s.focus(this, xy, opts ?? {});
        return orig.focus.call(this, xy, opts);
      };
      for (const k of ['unfocus', 'descend', 'reset']) {
        if (typeof orig[k] !== 'function') continue;
        P[k] = function (...a) {
          const s = P.__measureCam.sink;
          if (s) s.other(k);
          return orig[k].apply(this, a);
        };
      }
    }
    // whole-px lean destination exactly as CameraRig.focus computes it (GAME_W × GAME_H = 640 × 360)
    const clampInt = (v, lim) => {
      const r = Math.round(v);
      return r > lim ? lim : r < -lim ? -lim : r === 0 ? 0 : r;
    };
    P.__measureCam.sink = {
      focus: (rig, xy, opts) => {
        if (T0 === null) return;
        const pan = opts.pan ?? 0.35;
        const lim = rig.panLimit ?? { x: 48, y: 32 };
        const dx = opts.closeUp ? null : clampInt((xy.x - 320) * pan, lim.x);
        const dy = opts.closeUp ? null : clampInt((xy.y - 180) * pan, lim.y);
        camCalls.focus.push([now(), Math.round(xy.x), Math.round(xy.y), pan, opts.ms ?? 260, opts.closeUp ? 1 : 0, dx, dy]);
      },
      other: (k) => {
        if (T0 !== null) camCalls[k]++;
      },
    };
    out.hooks.push('CameraRig.focus/unfocus/descend/reset');
  } catch (e) {
    out.hooks.push(`CameraRig FAILED ${String(e).slice(0, 120)}`);
    camCalls.failed = true;
  }
  // 6. light-layer calls (A6_PLAN.md §6.3: every small event lights the floor at least once)
  const lights = { calls: { flash: 0, pool: 0, beam: 0, dim: 0 }, list: [] };
  try {
    const lm = await import('/src/view/light/LightLayer.ts');
    const P = lm.LightLayer && lm.LightLayer.prototype;
    if (!P || typeof P.flash !== 'function') throw new Error('no LightLayer.prototype.flash');
    if (!P.__measureLight) {
      const orig = { flash: P.flash, pool: P.pool, beam: P.beam, setDim: P.setDim };
      P.__measureLight = { sink: null };
      for (const k of ['flash', 'pool', 'beam', 'setDim']) {
        if (typeof orig[k] !== 'function') continue;
        P[k] = function (...a) {
          const s = P.__measureLight.sink;
          if (s) s(k, a);
          return orig[k].apply(this, a);
        };
      }
    }
    P.__measureLight.sink = (k, a) => {
      if (T0 === null) return;
      if (k === 'setDim') {
        lights.calls.dim++;
        lights.list.push([now(), 'dim', a[0]]);
      } else {
        lights.calls[k]++;
        const at = k === 'beam' ? a[0] : { x: a[0], y: a[1] };
        lights.list.push([now(), k, Math.round(at?.x ?? 0), Math.round(at?.y ?? 0)]);
      }
    };
    out.hooks.push('LightLayer.flash/pool/beam/setDim');
  } catch (e) {
    out.hooks.push(`LightLayer FAILED ${String(e).slice(0, 120)}`);
    lights.failed = true;
  }

  // ---------------------------------------------------------------- per-frame probes
  const seen = new WeakSet();
  const scanNumbers = (record) => {
    for (const c of sc.children.list) {
      if (c.type !== 'Container' || seen.has(c)) continue;
      seen.add(c);
      if (!record) continue;
      const g = c.list && c.list[0];
      const key = g && g.texture && g.texture.key;
      if (typeof key !== 'string' || !key.startsWith('fx:num:')) continue;
      const text = c.list.map((x) => (x.frame ? x.frame.name : '')).join('');
      out.numbers.push({ t: now(), text, kind: key.slice(7), x: Math.round(c.x), y: Math.round(c.y), depth: c.depth });
    }
  };
  const animState = new Map();
  const scanUnits = () => {
    let units = [];
    try {
      units = D.views.field.units();
    } catch {
      return;
    }
    if (dying.size) units = [...units, ...[...dying].filter((u) => !units.includes(u))];
    for (const u of units) {
      const s = u.sprite;
      if (!s) continue;
      const cur = s.anims && s.anims.currentAnim;
      const animKey = cur ? cur.key : '-';
      const playing = !!(s.anims && s.anims.isPlaying);
      const looping = !!(cur && cur.repeat === -1);
      const frame = s.frame ? String(s.frame.name) : '-';
      const vis = !!s.visible;
      const prev = animState.get(u.uid);
      const sig = `${animKey}|${frame}|${vis}|${playing}`;
      if (prev === sig) continue;
      const prevAnim = prev ? prev.split('|')[0] : null;
      const prevVis = prev ? prev.split('|')[2] : null;
      animState.set(u.uid, sig);
      // looping idle / guard frames are noise unless asked for; anim switches always count
      if (!o.allAnims && prev && looping && playing && prevAnim === animKey && prevVis === String(vis)) continue;
      out.anims.push([now(), u.uid, u.cardId, animKey, frame, vis]);
    }
  };
  const cam = sc.cameras.main;
  const zoom = { max: cam.zoom, min: cam.zoom, maxAt: 0, hist: {}, fracScrollFrames: 0, maxScrollFrac: 0 };
  let otherCamsMaxZoom = 1;
  const scanCamera = (t) => {
    const z = cam.zoom;
    if (z > zoom.max + 1e-9) {
      zoom.max = z;
      zoom.maxAt = t;
    }
    if (z < zoom.min) zoom.min = z;
    const k = String(Math.round(z * 1000) / 1000);
    zoom.hist[k] = (zoom.hist[k] ?? 0) + 1;
    const fx = Math.abs(cam.scrollX - Math.round(cam.scrollX));
    const fy = Math.abs(cam.scrollY - Math.round(cam.scrollY));
    if (fx > 1e-6 || fy > 1e-6) {
      zoom.fracScrollFrames++;
      zoom.maxScrollFrac = Math.max(zoom.maxScrollFrac, Math.round(Math.max(fx, fy) * 1000) / 1000);
    }
    for (const c of sc.cameras.cameras) if (c !== cam) otherCamsMaxZoom = Math.max(otherCamsMaxZoom, c.zoom);
    // whole-px scroll extent of the world camera (A56.0): the lean / descend reach, and the step
    // of the frame that first reached the maximum (one frame of motion: the gate's tolerance)
    const ax = Math.round(Math.abs(cam.scrollX));
    const ay = Math.round(Math.abs(cam.scrollY));
    const m = Math.max(ax, ay);
    if (ax > scroll.maxScrollX) scroll.maxScrollX = ax;
    if (ay > scroll.maxScrollY) scroll.maxScrollY = ay;
    if (m > scroll.maxScrollPx) {
      scroll.maxScrollPx = m;
      scroll.maxScrollAt = t;
      scroll.maxScrollStepPx = m - scroll.prev;
    }
    if (m > 0) scroll.scrolledFrames++;
    scroll.prev = m;
    if (scroll.trace) scroll.trace.push([t, Math.round(cam.scrollX), Math.round(cam.scrollY), Math.round(z * 10000) / 10000]);
  };
  const scroll = { maxScrollPx: 0, maxScrollX: 0, maxScrollY: 0, maxScrollAt: null, maxScrollStepPx: 0, scrolledFrames: 0, prev: 0, trace: o.cameraTrace ? [] : null };

  // ---------------------------------------------------------------- settle, then t = 0
  // (a --launch opening starts as soon as it is armed, like tools/shot.mjs --fresh films it)
  const warmFrames = held && !o.launch ? Math.round(o.warm / FRAME) : 0;
  for (let k = 0; k < warmFrames; k++) await step();
  out.warmMs = Math.round(warmFrames * FRAME);
  scanNumbers(false); // whatever exists before t = 0 is not part of the action
  scanUnits();
  out.anims.length = 0;
  animState.clear();
  await reseed();
  if (o.debug) out.listAtT0 = sc.children.list.map((x) => `${x.type}:${x.texture ? x.texture.key : ''}:${x.depth}`);
  T0 = Date.now();
  if (held) for (const f of held) f();
  else N.freeze(); // fallback: the armed start (if any) runs on this freeze
  scanUnits();
  // the scroll extent the camera already has at t = 0 (the opening starts 300 px up): the first
  // frame's step is measured from it
  scroll.prev = Math.max(Math.round(Math.abs(cam.scrollX)), Math.round(Math.abs(cam.scrollY)));

  // ---------------------------------------------------------------- run
  const busy = { first: null, last: null };
  const real = [];
  const capFrames = Math.ceil(o.cap / FRAME);
  let readyAt = null;
  let readyKind = null;
  let uiIdleSince = null;
  let quietSince = null;
  let stopReason = 'cap';
  for (let k = 0; k < capFrames; k++) {
    const a = performance.now();
    await step();
    real.push(performance.now() - a);
    const t = now();
    const b = !!D.busy();
    if (b) {
      if (busy.first === null) busy.first = t;
      busy.last = t;
    }
    scanNumbers(true);
    scanUnits();
    scanCamera(t);
    if (o.debug) {
      (out.trace ??= []).push([t, sc.children.list.length, (sc.tweens.getTweens?.() ?? []).length, (sc.time._active ?? []).length, sc.events.listenerCount('update'), Math.round(sc.time.now * 1000) / 1000, loop.delta]);
    }
    // input-ready: the first wait for the human after the last scenario action finished
    if (readyAt === null && (out.dispatches.length || out.uiSteps.length || o.launch)) {
      // (a --launch has no scenario actions: the first wait for the player after t = 0)
      const acts = out.uiSteps.length ? [...out.dispatches, ...out.uiSteps] : out.dispatches;
      const open = acts.some((d) => d.end === null);
      const lastEnd = acts.length ? Math.max(...acts.map((d) => d.end ?? -1)) : 0;
      if (!open) {
        const w = out.inputWaits.find(([tw]) => tw >= lastEnd);
        if (w) {
          readyAt = w[0];
          readyKind = w[1];
        } else if (out.uiSteps.length) {
          // UI steps (A56.0): the person's pointer may never ask for a new action (a hover, an
          // open menu) — the scenario is done when nothing ran for 3 frames after its last step
          if (!b && !out.events.some((e) => e.end === null)) {
            if (uiIdleSince === null) uiIdleSince = t;
            if (t - uiIdleSince >= 50) {
              readyAt = lastEnd;
              readyKind = 'uiSteps';
            }
          } else uiIdleSince = null;
        }
      }
    }
    if (readyAt !== null && !b && t - readyAt >= o.settle) {
      stopReason = 'inputReady';
      break;
    }
    // safety net: nothing busy and no event running for 3 s after something happened
    const running = out.events.some((e) => e.end === null);
    if (!b && !running && out.events.length) {
      if (quietSince === null) quietSince = t;
      if (t - quietSince > 3000) {
        stopReason = 'quiet';
        break;
      }
    } else quietSince = null;
  }

  // ---------------------------------------------------------------- derive
  out.t0 = 'scenario actions dispatched (after the restart + warm-up)';
  out.frameMs = DT;
  out.stopReason = stopReason;
  out.measuredMs = now();
  const impacts = out.sfx.filter(([, n]) => o.impactSfx.includes(n)).map(([t, name]) => ({ t, name }));
  out.impacts = impacts;
  // a v3 contact mark wins over the first impact sound (see 2b)
  out.contactMs = out.contactMarks.length ? out.contactMarks[0] : impacts.length ? impacts[0].t : null;
  out.contactSfx = out.contactMarks.length ? 'mark' : impacts.length ? impacts[0].name : null;
  const dmg = out.numbers.filter((n) => n.kind === 'flash' || n.kind === 'damage');
  out.firstNumberMs = dmg.length ? dmg[0].t : null;
  out.numberAfterContactMs = out.firstNumberMs !== null && out.contactMs !== null ? out.firstNumberMs - out.contactMs : null;
  zoom.max = Math.round(zoom.max * 10000) / 10000;
  zoom.min = Math.round(zoom.min * 10000) / 10000;
  out.zoom = zoom;
  out.otherCamsMaxZoom = Math.round(otherCamsMaxZoom * 10000) / 10000;
  out.camera = {
    maxScrollPx: scroll.maxScrollPx,
    maxScrollX: scroll.maxScrollX,
    maxScrollY: scroll.maxScrollY,
    maxScrollAt: scroll.maxScrollAt,
    maxScrollStepPx: scroll.maxScrollStepPx,
    scrolledFrames: scroll.scrolledFrames,
    focusCalls: camCalls.failed ? null : camCalls.focus.length,
    closeUpCalls: camCalls.failed ? null : camCalls.focus.filter((f) => f[5]).length,
    unfocusCalls: camCalls.failed ? null : camCalls.unfocus,
    descendCalls: camCalls.failed ? null : camCalls.descend,
    resetCalls: camCalls.failed ? null : camCalls.reset,
    focus: camCalls.focus,
  };
  if (scroll.trace) out.camera.trace = scroll.trace;
  if (!lights.failed) {
    out.lightCalls = lights.calls;
    out.lights = lights.list;
  }
  out.busy = busy;
  out.busyMs = busy.first !== null ? busy.last - busy.first : null;
  out.inputReadyMs = readyAt;
  out.inputReadyKind = readyKind;
  out.busyToInputMs = readyAt !== null && busy.first !== null ? readyAt - busy.first : null;
  const starts = out.events.map((e) => e.start);
  const ends = out.events.map((e) => e.end).filter((e) => e !== null);
  out.endMs = ends.length ? Math.max(...ends) : null;
  out.totalMs = ends.length && starts.length ? Math.max(...ends) - Math.min(...starts) : null;
  out.openEvents = out.events.filter((e) => e.end === null).map((e) => e.type);
  const sorted = [...real].sort((x, y) => x - y);
  const pct = (p) => (sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] * 10) / 10 : null);
  out.realMsPerFrame = { p50: pct(0.5), p95: pct(0.95), max: pct(1), frames: real.length };
  let derr = { handlers: [], timeouts: [] };
  try {
    derr = D.errors();
  } catch {}
  out.errors = { neon: [...(N.errors ?? [])], handlers: (derr.handlers ?? []).map(String), timeouts: [...(derr.timeouts ?? [])] };
  return out;
}

// ---------------------------------------------------------------- main

const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
const { chromium } = require('playwright-core');

// (a port Chromium refuses — 6566, 6665–6669, 6679, 6697 lie in this range — made a run fail
// with net::ERR_UNSAFE_PORT about once in a hundred: pick again, also when Vite moved the port)
let server = null;
for (let attempt = 0; attempt < 6 && !server; attempt++) {
  let port;
  do port = 6200 + Math.floor(Math.random() * 700);
  while (UNSAFE_PORTS.has(port));
  const s = await createServer({
    root: ROOT,
    configFile: fs.existsSync(path.join(ROOT, 'vite.config.ts')) ? path.join(ROOT, 'vite.config.ts') : false,
    logLevel: 'error',
    // a separate dep-optimizer cache for another checkout (a snapshot shares node_modules)
    cacheDir: ROOT === REPO ? undefined : path.join(ROOT, '.vite-cache'),
    server: { port, host: '127.0.0.1', strictPort: false, hmr: false },
    clearScreen: false,
  });
  await s.listen();
  if (UNSAFE_PORTS.has(Number(new URL(s.resolvedUrls.local[0]).port))) await s.close();
  else server = s;
}
if (!server) throw new Error('no port Chromium accepts');
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: chromePath(),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});

/** page.goto with one retry (a busy machine sometimes drops the first dev-server load). */
async function gotoRetry(page, url, waitUntil = 'load') {
  try {
    await page.goto(url, { waitUntil, timeout: 240000 });
  } catch (e) {
    console.log(`[measure] retrying ${url}: ${String(e.message).split('\n')[0]}`);
    await page.goto(url, { waitUntil, timeout: 240000 });
  }
}

async function scenarioKeys() {
  // only --launch (no --scenarios): no scenario list
  if (LAUNCH_LIST.length && !args.scenarios) return [];
  const want = String(args.scenarios ?? 'ref').split(',').map((s) => s.trim()).filter(Boolean);
  // the scenario list of the served checkout (also catches typos before minutes of measuring)
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
  const page = await ctx.newPage();
  await gotoRetry(page, `${base}?dev=duel&test=1`, 'domcontentloaded');
  const all = await page.evaluate(async () => Object.keys((await import('/src/duel/scenarios.ts')).SCENARIOS));
  await ctx.close();
  const keys = [];
  for (const w of want) {
    if (PRESETS[w]) keys.push(...PRESETS[w]);
    else if (w === 'all') keys.push(...all);
    else if (w.endsWith('*')) keys.push(...all.filter((k) => k.startsWith(w.slice(0, -1))));
    else keys.push(w);
  }
  const unknown = keys.filter((k) => !all.includes(k));
  if (unknown.length) throw new Error(`unknown scenario(s): ${unknown.join(', ')}`);
  return [...new Set(keys)];
}

async function measureOne(key, launch = null) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(600000);
  const pageErrors = [];
  const consoleMsgs = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 400)));
  page.on('console', (m) => {
    const t = m.type();
    if ((t === 'error' || t === 'warning') && consoleMsgs.length < 60) consoleMsgs.push({ type: t, text: m.text().slice(0, 400) });
  });
  const wall0 = Date.now();
  let res;
  try {
    await gotoRetry(page, launch ? `${base}${launch}${extraQuery}&test=1` : `${base}?dev=duel&s=${encodeURIComponent(key)}${extraQuery}&test=1`);
    await page.waitForFunction(() => window.__neon && window.__neon.ready === true && !!window.__neon.duel, null, { timeout: 300000 });
    res = await page.evaluate(measureInPage, { key, launch, cap: CAP, settle: SETTLE, norender: NORENDER, allAnims: ALL_ANIMS, impactSfx: IMPACT_SFX, debug: args.debug === 'true', warm: WARM, seeders: SEEDERS, delta: DELTA, cameraTrace: CAMERA_TRACE });
  } catch (e) {
    res = { failed: String(e && e.message ? e.message : e).slice(0, 600) };
  }
  res.errors = { ...(res.errors ?? {}), page: pageErrors, console: consoleMsgs };
  res.wallMs = Date.now() - wall0;
  await ctx.close();
  return res;
}

const fmt = (v) => (v === null || v === undefined ? '-' : String(v));
const results = {};
let runKeys = [];
let failed = 0;
try {
  const keys = await scenarioKeys();
  for (const l of LAUNCH_LIST) if (keys.includes(l.name)) throw new Error(`--launch name ${l.name} is also a scenario key`);
  runKeys = [...keys, ...LAUNCH_LIST.map((l) => l.name)];
  console.log(`[measure] ${keys.length} scenario(s)${LAUNCH_LIST.length ? ` + ${LAUNCH_LIST.length} launch(es) (${LAUNCH_LIST.map((l) => l.name).join(', ')})` : ''}, root ${path.relative(REPO, ROOT) || '.'}${extraQuery ? `, query ${extraQuery}` : ''}${NORENDER ? ', no render' : ''}${CAMERA_TRACE ? ', camera trace' : ''}, jobs ${JOBS}`);
  const queue = [...keys.map((k) => ({ key: k, launch: null })), ...LAUNCH_LIST.map((l) => ({ key: l.name, launch: l.query }))];
  const worker = async () => {
    for (;;) {
      const job = queue.shift();
      if (!job) return;
      const { key } = job;
      const r = await measureOne(key, job.launch);
      results[key] = r;
      const nErr = countErrors(r);
      if (r.failed || nErr) failed++;
      const cam = r.camera ? `  cam ${fmt(r.camera.focusCalls)}f/${fmt(r.camera.maxScrollPx)}px` : '';
      console.log(
        `${key.padEnd(20)} ${r.failed ? `FAILED ${r.failed}` : `events ${fmt(r.events?.length).padStart(2)}  contact ${fmt(r.contactMs).padStart(5)}  number ${fmt(r.firstNumberMs).padStart(5)}  zoom ${fmt(r.zoom?.max).padStart(6)}${cam}  end ${fmt(r.endMs).padStart(5)}  total ${fmt(r.totalMs).padStart(5)}  ready ${fmt(r.inputReadyMs).padStart(5)}${r.inputReadyKind === 'gameOver' ? '(gameOver)' : ''}  errors ${nErr}`}  [${Math.round(r.wallMs / 1000)} s]`,
      );
    }
  };
  await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, worker));
} finally {
  await browser.close();
  await server.close();
}

const ordered = {};
for (const k of runKeys) if (results[k]) ordered[k] = results[k];
const doc = {
  tool: 'tools/measure.mjs',
  version: 1,
  date: new Date().toISOString(),
  root: ROOT,
  git: gitInfo(ROOT),
  note: args.note ?? null,
  query: extraQuery,
  options: { cap: CAP, settle: SETTLE, warm: WARM, delta: DELTA, norender: NORENDER, anims: ALL_ANIMS ? 'all' : 'changes', cameraTrace: CAMERA_TRACE },
  scenarios: ordered,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(doc, null, 1));
console.log(`[measure] wrote ${path.relative(REPO, OUT)}`);

let code = failed ? 1 : 0;
if (args.compare) {
  const prev = JSON.parse(fs.readFileSync(path.resolve(args.compare), 'utf8'));
  console.log(`[measure] compare with ${args.compare} (±${TOL} ms)`);
  for (const k of ['delta', 'warm']) {
    const was = prev.options?.[k];
    if (was !== undefined && was !== doc.options[k]) console.log(`[measure] WARNING: ${k} was ${was}, now ${doc.options[k]} — the timelines are not comparable`);
  }
  if ((prev.query ?? '') !== doc.query) console.log(`[measure] note: query was "${prev.query ?? ''}", now "${doc.query}"`);
  const sub = { scenarios: Object.fromEntries(Object.keys(doc.scenarios).filter((k) => prev.scenarios?.[k]).map((k) => [k, prev.scenarios[k]])) };
  const bad = diffFiles(sub, doc, TOL);
  if (bad) code = 2;
}
if (CAMERA_GATE) {
  const base = JSON.parse(fs.readFileSync(path.resolve(CAMERA_GATE), 'utf8'));
  const bad = cameraGate(base, doc, CAMERA_GATE);
  if (bad < 0) code = Math.max(code, 1);
  else if (bad) code = 3;
}
process.exit(code);
