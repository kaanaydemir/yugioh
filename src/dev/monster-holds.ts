// ?dev=monster&id=<id>&mode=holds[&lazy=1][&scale=N] — v3 contract test (A1 item 3).
//
// Builds a TEST-ONLY art = the monster + one extra anim `special` that re-uses its attack frames
// with per-frame holds (long anticipation, a held wind-up, a 50 ms strike, a held follow-through)
// and marks.impact. The test sheet lives under its own key (`test:holds:<id>`), so the real
// `mon:<id>` sheet and anims are untouched. Two sprites play side by side from t = 0:
//   left  — base `attack` (no holds: every frame 1000/fps ms, today's behaviour)
//   right — `special` (holds → Phaser frame durations)
// The panel prints, every frame, the game time since play, the frame Phaser shows and the frame
// src/art/animtime.ts frameAtMs() predicts; the table logs when each frame actually appeared vs
// frameStartMs(). Steps where the two disagree are counted (`miss`; a tie exactly on a frame
// boundary would show up as one). window.__holdsTest exposes the same numbers to tools.
// &lazy=1 registers the test sheet DEFERRED (prepareMonsterSheet, no background painting) and
// shows which anims are pending: all → after the sprites exist (base painted) → after play().
// &wait=1 holds playback until window.__holdsTest.start() (a tool can freeze the clock first).
import Phaser from 'phaser';
import type { MonsterId } from '../data/cards';
import { animLengthMs, frameAtMs, frameStartMs, markMs } from '../art/animtime';
import { monsterArt } from '../art/monsters';
import { PAL } from '../art/palette';
import { buildMonster, monsterFrameName, monsterSheetPending, prepareMonsterSheet, sheetAnimKey } from '../art/textures';
import type { AnimSpec, MonsterArt } from '../art/types';
import { TILE_H, TILE_W } from '../view/layout';

function label(scene: Phaser.Scene, x: number, y: number, s: string, color = '#b6fbff') {
  return scene.add.text(x, y, s, { fontFamily: 'monospace', fontSize: '8px', color }).setResolution(4);
}

/**
 * Test holds for an attack of `n` frames striking at `impact` (uneven). Every frame boundary is
 * ≡ 25 (mod 50) ms, so none falls exactly on a 1/60 s step: no float ties in the stepped films.
 */
export function testHolds(n: number, impact: number): number[] {
  return Array.from({ length: n }, (_, f) => {
    if (f === 0) return 425; // settle / read the pose (odd multiple of 25: no boundary falls on a 1/60 s step)
    if (f < impact - 1) return 50; // quick gather
    if (f === impact - 1) return 300; // held wind-up
    if (f === impact) return 50; // the strike: one short frame
    if (f === impact + 1) return 350; // held follow-through
    return 100; // recovery
  });
}

/** The test-only art: `base` + extraAnims.special (attack frames with holds). */
export function holdsTestArt(base: MonsterArt): MonsterArt {
  const atk = base.anims.attack;
  const special: AnimSpec = { frames: atk.frames, fps: atk.fps, loop: false, holds: testHolds(atk.frames, base.attackImpactFrame), marks: { impact: base.attackImpactFrame } };
  return {
    ...base,
    extraAnims: { special },
    drawExtra(p, _anim, frame, o) {
      if (o) base.draw(p, 'attack', frame, o);
      else base.draw(p, 'attack', frame);
    },
  };
}

interface Track {
  anim: 'attack' | 'special';
  spec: AnimSpec;
  spr: Phaser.GameObjects.Sprite;
  /** frame → game ms it first appeared */
  seen: Map<number, number>;
  last: number;
  /** steps where Phaser showed neither frameAtMs(t) nor frameAtMs(t - step) */
  miss: number;
  /** steps where Phaser was one step behind frameAtMs(t): a boundary exactly on a step (float tie) */
  late: number;
  now: number;
  expected: number;
}

function isoTile(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillStyle(PAL.night2, 1).lineStyle(1, PAL.cyan2, 1).beginPath();
  g.moveTo(x, y - TILE_H / 2).lineTo(x + TILE_W / 2, y).lineTo(x, y + TILE_H / 2).lineTo(x - TILE_W / 2, y).closePath();
  g.fillPath().strokePath();
}

export function holdsMode(scene: Phaser.Scene, params: URLSearchParams, id: MonsterId): void {
  const base = monsterArt(id);
  const art = holdsTestArt(base);
  const key = `test:holds:${id}`;
  const lazy = params.get('lazy') === '1';
  // both sprites side by side left of the panel (x < 412)
  const s = Number(params.get('scale') ?? Math.max(1, Math.min(4, Math.floor(404 / (2 * base.w + 8)))));
  scene.cameras.main.setBackgroundColor(PAL.night1);

  const lazyLog: string[] = [];
  if (lazy) {
    prepareMonsterSheet(scene, art, { key });
    lazyLog.push(`pending: registered ${fmtPending(monsterSheetPending(key))}`);
  } else buildMonster(scene, art, { key });

  const spec: Record<'attack' | 'special', AnimSpec> = { attack: art.anims.attack, special: art.extraAnims!.special! };
  label(scene, 4, 2, `${id} — v3 holds test (TEST-ONLY anim 'special' = attack frames + holds)  sheet ${key}${lazy ? '  [lazy]' : ''}`);

  // ---- sprites
  const g = scene.add.graphics();
  const groundY = Math.min(256, 40 + Math.round(base.anchorY * s));
  const xs = { attack: 4 + Math.round(base.anchorX * s), special: 4 + Math.round(base.anchorX * s) + base.w * s + 8 };
  const tracks: Track[] = [];
  for (const anim of ['attack', 'special'] as const) {
    isoTile(g, xs[anim], groundY);
    const spr = scene.add.sprite(xs[anim], groundY, key, monsterFrameName('idle', 0)).setScale(s);
    spr.setOrigin(base.anchorX / base.w, base.anchorY / base.h);
    label(scene, xs[anim] - Math.round(base.anchorX * s), 20, anim === 'attack' ? `attack: ${spec.attack.frames}f @${spec.attack.fps}fps, no holds` : `special: holds (ms)`, anim === 'attack' ? '#8b9bb4' : '#ffd166');
    tracks.push({ anim, spec: spec[anim], spr, seen: new Map(), last: -1, miss: 0, late: 0, now: 0, expected: 0 });
  }
  if (lazy) lazyLog.push(`sprites ${fmtPending(monsterSheetPending(key))}`);
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    for (const t of tracks) t.spr.play(sheetAnimKey(key, t.anim));
    if (lazy) {
      lazyLog.push(`play() ${fmtPending(monsterSheetPending(key))}`);
      lazyText?.setText(lazyLog.join(' → '));
    }
  };

  // ---- timeline bars (1 px = 4 ms)
  const PX_PER_MS = 0.25;
  const barX = 8;
  const bars = scene.add.graphics();
  const barY = { attack: 284, special: 304 };
  for (const t of tracks) {
    const y = barY[t.anim];
    label(scene, barX, y - 9, t.anim === 'attack' ? 'attack' : 'special', t.anim === 'attack' ? '#8b9bb4' : '#ffd166');
    for (let f = 0; f < t.spec.frames; f++) {
      const x0 = barX + Math.round(frameStartMs(t.spec, f) * PX_PER_MS);
      const x1 = barX + Math.round(frameStartMs(t.spec, f + 1) * PX_PER_MS);
      bars.fillStyle(f % 2 ? PAL.night3 : PAL.night2, 1).fillRect(x0, y, x1 - x0, 8);
      bars.fillStyle(PAL.cyan2, 1).fillRect(x0, y, 1, 8);
      if (x1 - x0 >= 9) label(scene, x0 + 2, y, String(f), '#e8f4ff');
    }
  }
  const impactAt = markMs(spec.special, 'impact', base.attackImpactFrame);
  bars.fillStyle(PAL.crim3, 1).fillRect(barX + Math.round(impactAt * PX_PER_MS), barY.special + 9, 1, 4);
  label(scene, barX + Math.round(impactAt * PX_PER_MS) + 2, barY.special + 9, `marks.impact @${impactAt} ms`, '#ff4d5e');
  const head = scene.add.graphics();
  // live line right above the test sprite (readable in a clipped film)
  const live = label(scene, xs.special - Math.round(base.anchorX * s), 31, '', '#ffd166');

  // ---- text panel
  const panelX = 416;
  const status = label(scene, panelX, 20, '', '#e8f4ff');
  const table = label(scene, panelX, 100, '', '#e8f4ff');
  label(scene, 8, 326, `holds = [${spec.special.holds!.join(', ')}]  animLengthMs = ${animLengthMs(spec.special)}  (Phaser anim.duration = ${Math.round(scene.anims.get(sheetAnimKey(key, 'special'))!.duration)}: ignores holds)`, '#8b9bb4');
  const lazyText = lazy ? label(scene, 8, 340, lazyLog.join(' → '), '#9ef0a0') : null;
  // &wait=1: play only when window.__holdsTest.start() is called (lets a tool freeze time first)
  if (params.get('wait') !== '1') start();

  let t = 0;
  const report = () => {
    const sp = tracks[1];
    const lines = [`t = ${t.toFixed(1)} ms since play()`];
    for (const tr of tracks) lines.push(`${tr.anim.padEnd(7)} f${tr.now} = frameAtMs f${tr.expected} ${tr.now === tr.expected ? 'OK  ' : 'LATE'} miss ${tr.miss} late ${tr.late}`);
    lines.push('', 'miss: f != frameAtMs(t), frameAtMs(t-dt)', 'late: boundary exactly on a step (float tie)');
    status.setText(lines.join('\n'));
    live.setText(`t ${t.toFixed(1)}  f${sp.now}  (frameAtMs f${sp.expected})`);
    const rows = ['special  hold  frameStartMs  seen at'];
    for (let f = 0; f < sp.spec.frames; f++) {
      const seen = sp.seen.get(f);
      const exp = frameStartMs(sp.spec, f);
      rows.push(` f${String(f).padEnd(2)}    ${String(sp.spec.holds![f]).padStart(4)}  ${exp.toFixed(1).padStart(8)}  ${seen === undefined ? '      -' : seen.toFixed(1).padStart(7)}${seen === undefined ? '' : ` +${(seen - exp).toFixed(1)}`}`);
    }
    table.setText(rows.join('\n'));
    head.clear();
    head.fillStyle(0xffffff, 1);
    const x = barX + Math.min(Math.round(t * PX_PER_MS), 630);
    head.fillRect(x, barY.attack - 2, 1, barY.special - barY.attack + 12);
  };
  const sample = (delta: number) => {
    if (!started) return;
    const prev = t;
    t += delta * scene.anims.globalTimeScale;
    for (const tr of tracks) {
      tr.now = Number(String(tr.spr.frame.name).split(':')[1]);
      tr.expected = frameAtMs(tr.spec, t);
      if (tr.now !== tr.expected) {
        if (tr.now === frameAtMs(tr.spec, prev)) tr.late++;
        else tr.miss++;
      }
      if (tr.now !== tr.last) {
        if (!tr.seen.has(tr.now)) tr.seen.set(tr.now, t);
        tr.last = tr.now;
      }
    }
    report();
  };
  // sprites update their anims in PRE_UPDATE, before this UPDATE of the same step
  scene.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) => sample(delta));
  for (const tr of tracks) {
    tr.now = 0;
    tr.seen.set(0, 0);
    tr.last = 0;
  }
  report();
  (window as unknown as { __holdsTest: unknown }).__holdsTest = {
    get t() {
      return t;
    },
    tracks: () =>
      tracks.map((tr) => ({
        anim: tr.anim,
        miss: tr.miss,
        late: tr.late,
        holds: tr.spec.holds ?? null,
        expected: Array.from({ length: tr.spec.frames }, (_, f) => frameStartMs(tr.spec, f)),
        seen: Array.from({ length: tr.spec.frames }, (_, f) => tr.seen.get(f) ?? null),
      })),
    lazy: lazyLog,
    start,
  };
}

function fmtPending(p: string[] | null): string {
  return p === null ? '(unknown sheet)' : p.length ? `[${p.join(',')}]` : '[] complete';
}
