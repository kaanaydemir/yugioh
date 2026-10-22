#!/usr/bin/env node
// On-screen contact-frame probe (v3 A3 Y1, docs/v3/A3_MIMARI.md §10; REHBER HA-11, HA-21, KK-4).
// The repo version of A2's scratch measure (shots/v3/a2f/verify/ingame-contact-change.txt): plays
// duel scenarios on the frozen, stepped clock (the shot.mjs --fresh restart: a function of the code
// alone) and, for every struck unit, compares the frame its sprite shows ON THE CONTACT FRAME with
// the frame it showed one rendered frame before.
//
//   node tools/contact-probe.mjs                                   # the §10 acceptance set + kit sides
//   node tools/contact-probe.mjs --scenarios spBoltAce,sbShadeAtk --png shots/v3/a3/Y1/probe
//   node tools/contact-probe.mjs --out probe.json --txt probe.txt --jobs 2
//
//   --scenarios a,b   scenario keys, or the presets 'accept' (the A2 slice scenarios of §10's
//                     acceptance) and 'kit' (one per kit path the acceptance set lacks: a blow from
//                     behind P1 / P2, a guard that holds, a guard that breaks in battle and under
//                     a spell); default accept,kit
//   --look v3|v1      default v3 (&look=v3)
//   --cap MS          game time filmed per scenario (default 3200)
//   --out FILE        JSON (default shots/contact-probe.json); --txt FILE the table (default: next to it)
//   --png DIR         per contact a ×3 strip (see below) as DIR/<scenario>-<card>-<uid>.png
//   --scale N         strip zoom (default 3)
//   --jobs N          scenarios in parallel, one browser context each (default 2)
//   --hist MS         how far back the rest loop before a contact is read (default 1500)
//
// What is measured (sprite only: the frame the sprite shows, its flip and its whole-pixel position
// in WORLD space, drawn from its own texture — camera shake, the contact flash overlay, sparks and
// light are effects on top of the body and are left out, as in A2's measure):
//   contact     a unit's first rendered frame of a reaction — its sprite goes from a resting anim
//               (idle / guard) to hit / hitHeavy / hitMagic / death, or from guard to a toGuard
//               frame (the guard brace) — or, for a blow that plays no reaction pose (from behind),
//               the first frame rendered after the battle's 'v3:contact' mark, on its target; or
//               the first frame rendered after MonsterUnit.guardHit ran on a unit (every guard
//               reaction: one that holds, one broken open by a battle or by a spell)
//   resting     the frame before contact showed idle / guard AT the unit's rest position (rest0);
//               a body struck in the middle of its own pose (a blocked attacker) is reported but
//               excluded from the verdict (§10: "posematch giriş maliyetiyle denetlenir")
//   screen %    pixels that differ between the previous rendered frame and the contact frame, as
//               drawn on screen (frame + position) ÷ the opaque pixels of idle f0
//   frames %    the same two frames compared in place (no position change): the sheet value of
//               this transition — screen − frames is what the sprite's MOVE added
//   page %      HA-21's sheet value: contact frame vs idle f0 in place ÷ idle f0 opaque
//   phase       frames − page: what the idle phase the blow landed on adds (reported, §10)
//   bob         how much of that phase is a whole-pixel bob: the vertical shift dy (−3…3) of the
//               previous frame that lines it up best with the contact frame, and frames % with the
//               previous frame drawn dy px lower ('-' when no shift helps by ≥ 20 %)
//   at contact  sprite offset from the previous frame and from rest0 on the contact frame
//   1st change  the first later frame on which the sprite shows another frame than the contact
//               frame: ms after contact, that frame
//   knock       the first later frame whose sprite position differs from the contact frame's:
//               ms after contact, whether that is the first change ('=1st'), another frame change
//               ('chg') or a frame that changed nothing else ('held': the kit's deadline / a guard's
//               push), its offset; then the largest offset reached
//   verdict     resting units: PASS when the sprite is at rest on the contact frame, screen < 50 %
//               and screen ≤ page + 5 points (§10 acceptance, KK-4); FAIL otherwise, with the
//               idle phase noted when the frames alone (no move) exceed the limits
// The strip (--png): prev | CONTACT | the following frames up to 2 past the knock onset (≤ 13
// cells), the sprite drawn alone on a dark ground, a dim cross on its rest anchor, changed pixels
// of each cell vs the cell before tinted red in a second row.
//
// Y1b, the pre-contact idle settle (src/cinematics/_v3/posematch.ts settleBefore, which emits
// 'v3:settle' with its plan): a second table, one block per resting contact —
//   settle      the blow's plans (ms before contact, the loop frame aimed at, * = a frame within KK-4,
//               the hold multiplier); none: the blow had no known contact time / nothing to steer
//   reach       from the first event of the blow's chain (or the loop's start, if later): the idle
//               frames within KK-4 of THIS contact frame (< 50 % and ≤ page + 5) and the even loop
//               speed that would put one on screen just before contact — within ±35 % or not
//   frames      every rest frame on screen before contact, frame:ms/nominal hold ("|": the first one
//               on screen after the settle started)
//   checks      from the settle's start: each frame's time on screen within its hold × 0.65 … × 1.35
//               (± one rendered frame: frames change on the frame grid; the last one, cut by the
//               contact, and one already on at the scenario's first render are bounded above only),
//               and no frame stepped over unless its own change and the merged step are ≤ idleΔ;
//               a failed check fails the contact. The worst ratios are summed up at the end.
//
// Exit code: 0 when every resting contact passes, 2 when one fails, 1 on errors.

import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(REPO, 'package.json'));

const PRESETS = {
  // §10 acceptance: the A2 slice scenarios
  accept: ['saWyrmAtk', 'saWyrmDef', 'saWyrmBlocked', 'sliceMagusHitWolf', 'sliceMagusHitTitan', 'sliceMagusHitTitanP2', 'spBoltAce', 'sliceBoltMagus', 'sliceBoltWyrmP2', 'saMagusBlocked'],
  // kit paths the acceptance set lacks: a blow from behind (P2 / P1 target), a guard that holds, a guard that breaks
  kit: ['sbShadeAtk', 'sbShadeP2', 'sliceMagusGuardWolf', 'sliceMagusGuardTitan', 'sliceBoltMagusDef'],
};

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
const LOOK = args.look ?? 'v3';
const CAP = Number(args.cap ?? 3200);
const OUT = path.resolve(REPO, args.out ?? 'shots/contact-probe.json');
const TXT = path.resolve(REPO, args.txt ?? OUT.replace(/\.json$/, '') + '.txt');
const PNG = args.png ? path.resolve(REPO, args.png) : null;
const SCALE = Math.max(1, Number(args.scale ?? 3));
const JOBS = Math.max(1, Number(args.jobs ?? 2));
const HIST = Math.max(100, Number(args.hist ?? 1500));
const keys = [];
for (const w of String(args.scenarios ?? 'accept,kit').split(',').map((s) => s.trim()).filter(Boolean)) keys.push(...(PRESETS[w] ?? [w]));
const KEYS = [...new Set(keys)];

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

// ---------------------------------------------------------------- in-page probe

/** Runs inside the page (serialized by Playwright). */
async function probeInPage(o) {
  const N = window.__neon;
  const FRAME = 1000 / 60;
  // ---- the shot.mjs --fresh restart: freeze, restart the scenario under the frozen clock
  if (Array.isArray(N.__duelArmed)) N.__duelArmed.splice(0);
  N.freeze();
  let ready = false;
  N.duel.scenario(o.key, { film: true }).then(() => (ready = true));
  for (let k = 0; !ready && k < 3000; k++) await N.step(FRAME);
  if (!ready) throw new Error('the restarted duel never became ready');
  const D = N.duel;
  const sc = N.game.scene.getScene('Duel');
  // ---- the battle being presented (the target of a 'v3:contact' mark) and units dying off the field
  let battle = null;
  /** Every event the director presents: its type and the rendered frame it started on. */
  const evlog = [];
  const dir = sc.director;
  if (dir && typeof dir.runEvent === 'function') {
    const orig = dir.runEvent.bind(dir);
    dir.runEvent = (b, i, h) => {
      const ev = b.events[i];
      if (ev && ev.type === 'battle') battle = { attackerUid: ev.attackerUid, targetUid: ev.targetUid };
      if (ev) evlog.push({ type: ev.type, at: snaps.length });
      return orig(b, i, h);
    };
  }
  const snaps = [];
  const marks = [];
  const dying = new Set();
  /** The pre-contact idle settles (_v3/posematch.ts settleBefore emits 'v3:settle' with its plan). */
  const settles = [];
  sc.events.on('v3:contact', (attackerUid) => marks.push({ at: snaps.length, attackerUid, targetUid: battle ? battle.targetUid : null }));
  sc.events.on('v3:dying', (u) => u && dying.add(u));
  sc.events.on('v3:settle', (uid, plan) => settles.push({ at: snaps.length, uid: String(uid), plan: plan ? JSON.parse(JSON.stringify(plan)) : null }));
  /** Nominal holds (ms) of each unit's rest loops (MonsterUnit.frameMs). */
  const holdsOf = {};
  const unitsNow = () => {
    let us = [];
    try {
      us = D.views.field.units();
    } catch {
      us = [];
    }
    return [...us, ...[...dying].filter((u) => !us.includes(u))];
  };
  // every guard reaction (MonsterUnit.guardHit: a guard that holds, one broken open by a battle or a
  // spell): the first frame rendered after it ran is a contact of that unit
  const unit0 = unitsNow()[0];
  const proto = unit0 ? Object.getPrototypeOf(unit0) : null;
  const guardHit0 = proto && typeof proto.guardHit === 'function' ? proto.guardHit : null;
  if (guardHit0) {
    proto.guardHit = function (...a) {
      marks.push({ at: snaps.length, targetUid: this.uid, how: 'guard' });
      return guardHit0.apply(this, a);
    };
  }
  let frameNo = 0;
  const onRender = () => {
    const row = { frame: frameNo, t: Math.round(frameNo * FRAME), units: {} };
    for (const u of unitsNow()) {
      const s = u.sprite;
      if (!s || !s.active || !s.frame) continue;
      if (!holdsOf[u.uid] && typeof u.frameMs === 'function' && typeof u.frameCount === 'function') {
        const h = {};
        for (const a of ['idle', 'guard']) h[a] = Array.from({ length: u.frameCount(a) }, (_, f) => u.frameMs(a, f));
        holdsOf[u.uid] = h;
      }
      const r = u.rest0;
      row.units[u.uid] = {
        cardId: u.cardId,
        player: u.player,
        zone: u.zone,
        frame: String(s.frame.name),
        tex: s.texture.key,
        x: s.x,
        y: s.y,
        left: s.x - s.displayOriginX,
        top: s.y - s.displayOriginY,
        flipX: !!s.flipX,
        vis: !!s.visible,
        alpha: s.alpha,
        scale: [s.scaleX, s.scaleY],
        rest: { x: r.x, y: r.y },
        guarding: !!u.guarding,
      };
    }
    snaps.push(row);
  };
  sc.events.on('render', onRender);
  // ---- t = 0: the armed scenario start runs on this freeze; then one game frame per step, each
  // followed by a task boundary (as tools/measure.mjs): every promise-chained continuation runs
  // between two frames, as between real frames and between shot.mjs film frames (one evaluate
  // per frame) — an `await` alone advances a chain by one link per frame and lags the cinematics
  const capFrames = Math.ceil(o.cap / FRAME);
  const tick = () => new Promise((r) => setTimeout(r, 0));
  N.freeze();
  await tick();
  for (frameNo = 1; frameNo <= capFrames; frameNo++) {
    N.step(FRAME);
    await tick();
  }
  sc.events.off('render', onRender);
  if (guardHit0) proto.guardHit = guardHit0;

  // ---- contacts
  const anim = (f) => (f && f.includes(':') ? f.slice(0, f.indexOf(':')) : f);
  const REST = new Set(['idle', 'guard']);
  const REACT = new Set(['hit', 'hitHeavy', 'hitMagic', 'death']);
  const contacts = [];
  const seenAt = new Set();
  const uids = new Set(snaps.flatMap((r) => Object.keys(r.units)));
  for (const uid of uids) {
    for (let i = 1; i < snaps.length; i++) {
      const a = snaps[i - 1].units[uid];
      const b = snaps[i].units[uid];
      if (!a || !b || a.frame === b.frame) continue;
      const pa = anim(a.frame);
      const pb = anim(b.frame);
      const reacts = REACT.has(pb) || (pa === 'guard' && pb === 'toGuard');
      const fromReaction = REACT.has(pa) || pa === 'toGuard';
      if (!reacts || fromReaction) continue;
      contacts.push({ uid, i, how: 'pose' });
      seenAt.add(`${uid}@${i}`);
    }
  }
  for (const m of marks) {
    const uid = m.targetUid != null ? String(m.targetUid) : null;
    if (!uid || m.at >= snaps.length || !snaps[m.at].units[uid]) continue;
    // a reaction pose (or another mark) found within a frame of the mark is the same contact
    if ([m.at - 1, m.at, m.at + 1].some((i) => seenAt.has(`${uid}@${i}`))) continue;
    contacts.push({ uid, i: m.at, how: m.how ?? 'mark' });
    seenAt.add(`${uid}@${m.at}`);
  }
  contacts.sort((x, y) => x.i - y.i);

  // ---- pixels: the sprite as drawn, from its texture
  const frameCache = new Map();
  const frameImg = (tex, name) => {
    const k = `${tex}|${name}`;
    if (frameCache.has(k)) return frameCache.get(k);
    const f = sc.textures.getFrame(tex, name);
    let v = null;
    if (f && f.source && f.source.image) {
      const c = document.createElement('canvas');
      c.width = f.cutWidth;
      c.height = f.cutHeight;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(f.source.image, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, f.cutWidth, f.cutHeight);
      v = { c, w: f.cutWidth, h: f.cutHeight, data: g.getImageData(0, 0, f.cutWidth, f.cutHeight).data };
    }
    frameCache.set(k, v);
    return v;
  };
  /** RGBA of state `st` (frame + flip at whole-pixel `left/top`) inside the world box `box`. */
  const drawState = (st, box, frameName, at) => {
    const img = frameImg(st.tex, frameName ?? st.frame);
    const out = new Uint8ClampedArray(box.w * box.h * 4);
    if (!img || !st.vis) return out;
    const L = Math.round(at ? at.left : st.left);
    const T = Math.round(at ? at.top : st.top);
    for (let y = 0; y < img.h; y++)
      for (let x = 0; x < img.w; x++) {
        const sx = st.flipX ? img.w - 1 - x : x;
        const si = (y * img.w + sx) * 4;
        if (img.data[si + 3] === 0) continue;
        const wx = L + x - box.x;
        const wy = T + y - box.y;
        if (wx < 0 || wy < 0 || wx >= box.w || wy >= box.h) continue;
        const di = (wy * box.w + wx) * 4;
        out[di] = img.data[si];
        out[di + 1] = img.data[si + 1];
        out[di + 2] = img.data[si + 2];
        out[di + 3] = img.data[si + 3];
      }
    return out;
  };
  const changed = (A, B) => {
    let n = 0;
    for (let i = 0; i < A.length; i += 4) {
      const oa = A[i + 3] > 0;
      const ob = B[i + 3] > 0;
      if (oa !== ob || (oa && (A[i] !== B[i] || A[i + 1] !== B[i + 1] || A[i + 2] !== B[i + 2]))) n++;
    }
    return n;
  };
  const opaqueOf = (tex, name) => {
    const img = frameImg(tex, name);
    if (!img) return 0;
    let n = 0;
    for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > 0) n++;
    return n;
  };
  const boxOf = (sts, m = 2) => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const st of sts) {
      const img = frameImg(st.tex, st.frame);
      if (!img) continue;
      x0 = Math.min(x0, Math.round(st.left));
      y0 = Math.min(y0, Math.round(st.top));
      x1 = Math.max(x1, Math.round(st.left) + img.w);
      y1 = Math.max(y1, Math.round(st.top) + img.h);
    }
    return { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m };
  };
  const pct = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : null);

  const results = [];
  for (const c of contacts) {
    const prev = snaps[c.i - 1]?.units[c.uid];
    const cur = snaps[c.i].units[c.uid];
    if (!prev || !cur) continue;
    const opaque = opaqueOf(cur.tex, 'idle:0');
    const box = boxOf([prev, cur], 5);
    const A = drawState(prev, box);
    const B = drawState(cur, box);
    const inPlacePrev = drawState(prev, box, prev.frame, { left: cur.left, top: cur.top });
    const idle0 = drawState(cur, box, 'idle:0');
    const screen = changed(A, B);
    const frames = changed(inPlacePrev, B);
    const page = changed(idle0, B);
    // the share of the frames' change that is a whole-pixel bob (the previous frame dy px lower)
    let bob = null;
    {
      let best = frames;
      let bestDy = 0;
      for (let dy = -3; dy <= 3; dy++) {
        if (!dy) continue;
        const n = changed(drawState(prev, box, prev.frame, { left: cur.left, top: cur.top + dy }), B);
        if (n < best) {
          best = n;
          bestDy = dy;
        }
      }
      if (bestDy && best < frames * 0.8) bob = { dy: bestDy, pct: pct(best, opaque) };
    }
    const resting = REST.has(anim(prev.frame)) && Math.round(prev.x) === Math.round(prev.rest.x) && Math.round(prev.y) === Math.round(prev.rest.y);
    // ---- the rest loop before contact (Y1b, the pre-contact idle settle): every rest frame shown
    // since the settle started (else over the last o.hist ms), how long it stayed on screen against
    // its nominal hold, and the frames the loop stepped over
    const restAnim = anim(prev.frame);
    // the settle chain of this blow (the declaration's estimate, the battle's re-plan): its window
    // starts with the first plan, the last one is the plan the contact was aimed by
    const chain = settles.filter((q) => q.uid === String(c.uid) && q.at <= c.i && c.i - q.at <= Math.ceil(o.hist / FRAME));
    const settle = chain.length ? chain[0] : null;
    const lo = Math.max(1, c.i - Math.ceil(o.hist / FRAME));
    /** ms before contact the settle started (its checks cover the frames on screen from then on). */
    const settleFrom = settle ? Math.round((c.i - settle.at) * FRAME) : null;
    const hist = [];
    if (REST.has(restAnim)) {
      let j = c.i - 1;
      while (j >= lo && snaps[j].units[c.uid] && anim(snaps[j].units[c.uid].frame) === restAnim) {
        const name = snaps[j].units[c.uid].frame;
        let k = j;
        while (k - 1 >= 0 && snaps[k - 1].units[c.uid] && snaps[k - 1].units[c.uid].frame === name) k--;
        hist.unshift({ frame: name, from: k, n: j - k + 1, before: Math.round((c.i - k) * FRAME) });
        j = k - 1;
      }
    }
    const nominal = holdsOf[c.uid]?.[restAnim] ?? [];
    const N = nominal.length;
    const fIdx = (name) => Number(name.slice(name.indexOf(':') + 1));
    // in place Δ of two rest frames of this sheet, and the loop's mean step (idleΔ)
    const dIn = (a, b) => {
      const A = frameImg(cur.tex, a);
      const B = frameImg(cur.tex, b);
      if (!A || !B || A.data.length !== B.data.length) return null;
      let n = 0;
      for (let i = 0; i < A.data.length; i += 4) {
        if (A.data[i + 3] === 0 && B.data[i + 3] === 0) continue;
        if (A.data[i] !== B.data[i] || A.data[i + 1] !== B.data[i + 1] || A.data[i + 2] !== B.data[i + 2] || A.data[i + 3] !== B.data[i + 3]) n++;
      }
      return n;
    };
    let loopD = null;
    if (N > 1) {
      let sum = 0;
      for (let f = 0; f < N; f++) sum += dIn(`${restAnim}:${f}`, `${restAnim}:${(f + 1) % N}`) ?? 0;
      loopD = sum / N;
    }
    // each segment's time on screen ÷ its nominal hold; the first (it may have started before the
    // window) and the last (cut by the contact) only count where they are bounded: the last one
    // may not exceed its stretched hold, the first is left out
    const segs = hist.map((h, k) => {
      const f = fIdx(h.frame);
      const ms = Math.round(h.n * FRAME);
      const nom = nominal[f] ?? null;
      // the first frame may have started before the recording did (the scenario's first render): only its upper bound counts
      return { frame: h.frame, ms, nominal: nom, ratio: nom ? Math.round((ms / nom) * 100) / 100 : null, first: k === 0, cut: k === 0 && h.from === 0, last: k === hist.length - 1, before: h.before, inSettle: settleFrom === null || h.before - ms < settleFrom };
    });
    // ---- reach (Y1b): the idle frames this contact frame may follow (KK-4 against THIS contact
    // frame: < 50 % and ≤ page + 5), and the even loop speed that would have put one of them on screen
    // just before contact from the first event of the blow's chain (or the loop's start, if later)
    let reach = null;
    if (REST.has(restAnim) && N > 1 && hist.length) {
      const targets = [];
      for (let f = 0; f < N; f++) {
        const d = dIn(`${restAnim}:${f}`, cur.frame);
        const p = d === null ? null : pct(d, opaque);
        if (p !== null && p < 50 && p <= pct(page, opaque) + 5) targets.push(f);
      }
      const ev0 = evlog.find((e) => e.at <= c.i && c.i - e.at <= Math.ceil(o.hist / FRAME));
      const loopFrom = hist[0].before;
      const tA = Math.min(ev0 ? Math.round((c.i - ev0.at) * FRAME) : loopFrom, loopFrom);
      const seg = hist.find((h) => h.before >= tA && h.before - Math.round(h.n * FRAME) < tA) ?? hist[0];
      const F = fIdx(seg.frame);
      const into = Math.max(0, seg.before - tA);
      const starts = [];
      let L = 0;
      for (const h of nominal) {
        starts.push(L);
        L += h;
      }
      let best = null;
      const T = tA - FRAME / 2;
      if (T > 0 && L > 0)
        for (const f of targets)
          for (let m = 0; m <= 3; m++) {
            const D = starts[f] + nominal[f] / 2 + m * L - (starts[F] + into);
            if (D <= 0) continue;
            const sp = D / T;
            if (!best || Math.abs(Math.log(sp)) < Math.abs(Math.log(best.s))) best = { f, s: Math.round(sp * 100) / 100 };
          }
      reach = { from: ev0 && Math.round((c.i - ev0.at) * FRAME) <= loopFrom ? ev0.type : 'loop start', before: tA, frame: F, into, targets, best, feasible: !!best && best.s >= 1 / 1.35 - 1e-6 && best.s <= 1 / 0.65 + 1e-6 };
    }
    const skips = [];
    for (let k = 1; k < hist.length; k++) {
      const a = fIdx(hist[k - 1].frame);
      const b = fIdx(hist[k].frame);
      if (!N || b === (a + 1) % N) continue;
      const skipped = [];
      for (let f = (a + 1) % N; f !== b && skipped.length < N; f = (f + 1) % N) skipped.push(f);
      const merged = dIn(hist[k - 1].frame, hist[k].frame);
      const own = skipped.map((f) => dIn(`${restAnim}:${(f + N - 1) % N}`, `${restAnim}:${f}`) ?? 0);
      skips.push({ from: hist[k - 1].frame, to: hist[k].frame, before: hist[k].before, inSettle: settleFrom === null || hist[k].before <= settleFrom, skipped, merged: loopD && merged !== null ? Math.round((merged / loopD) * 100) / 100 : null, own: own.map((d) => (loopD ? Math.round((d / loopD) * 100) / 100 : null)) });
    }
    // the first change: the first later frame showing another frame than the contact frame
    // the knock: the first later frame whose position differs from the contact frame's
    let firstChange = null;
    let knock = null;
    let maxOff = { dx: 0, dy: 0, d: 0 };
    let last = c.i;
    for (let j = c.i + 1; j < Math.min(snaps.length, c.i + 60); j++) {
      const s = snaps[j].units[c.uid];
      const p = snaps[j - 1].units[c.uid];
      if (!s || !p) break;
      last = j;
      if (!firstChange && s.frame !== cur.frame) firstChange = { ms: Math.round((j - c.i) * FRAME), frames: j - c.i, frame: s.frame };
      const dx = Math.round(s.x - cur.x);
      const dy = Math.round(s.y - cur.y);
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      if (d > maxOff.d) maxOff = { dx, dy, d };
      if (!knock && d > 0) {
        knock = { ms: Math.round((j - c.i) * FRAME), frames: j - c.i, dx, dy, frameChanged: s.frame !== p.frame, frame: s.frame, at: snaps[j].t };
        knock.onFirstChange = !!firstChange && firstChange.frames === knock.frames;
      }
    }
    const r = {
      uid: c.uid,
      cardId: cur.cardId,
      player: cur.player,
      zone: cur.zone,
      how: c.how,
      t: snaps[c.i].t,
      prevFrame: prev.frame,
      contactFrame: cur.frame,
      tex: cur.tex,
      flipX: cur.flipX,
      resting,
      opaque,
      screenPct: pct(screen, opaque),
      framesPct: pct(frames, opaque),
      pagePct: pct(page, opaque),
      phasePct: pct(frames - page, opaque),
      bob,
      shiftFromPrev: { dx: Math.round(cur.x - prev.x), dy: Math.round(cur.y - prev.y) },
      shiftFromRest: { dx: Math.round(cur.x - cur.rest.x), dy: Math.round(cur.y - cur.rest.y) },
      firstChange,
      knock,
      knockMax: maxOff,
      settle: settle ? { before: Math.round((c.i - settle.at) * FRAME), plan: chain[chain.length - 1].plan, plans: chain.map((q) => ({ before: Math.round((c.i - q.at) * FRAME), plan: q.plan })) } : null,
      reach,
      restLoop: segs,
      restSkips: skips,
      events: evlog.filter((e) => e.at <= c.i && c.i - e.at <= Math.ceil(o.hist / FRAME)).map((e) => ({ type: e.type, before: Math.round((c.i - e.at) * FRAME) })),
    };
    // ---- the strip (sprite alone): prev, contact, then up to 2 frames past the knock onset
    if (o.png) {
      const endJ = Math.min(last, c.i + (knock ? knock.frames + 2 : 4), c.i + 11);
      const seq = [];
      for (let j = c.i - 1; j <= endJ; j++) if (snaps[j]?.units[c.uid]) seq.push({ j, st: snaps[j].units[c.uid] });
      const sb = boxOf(seq.map((q) => q.st), 4);
      const S = o.scale;
      const cw = sb.w * S;
      const ch = sb.h * S;
      const LBL = 14;
      const cv = document.createElement('canvas');
      cv.width = seq.length * (cw + 4) + 4;
      cv.height = 2 * (ch + LBL) + 12;
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.fillStyle = '#05060a';
      g.fillRect(0, 0, cv.width, cv.height);
      const tmp = document.createElement('canvas');
      tmp.width = sb.w;
      tmp.height = sb.h;
      const tg = tmp.getContext('2d');
      let before = null;
      seq.forEach((q, k) => {
        const px = drawState(q.st, sb);
        const x = 4 + k * (cw + 4);
        for (let row = 0; row < 2; row++) {
          const id = tg.createImageData(sb.w, sb.h);
          for (let i = 0; i < px.length; i += 4) {
            let r0 = 14;
            let g0 = 16;
            let b0 = 26;
            if (px[i + 3] > 0) {
              r0 = px[i];
              g0 = px[i + 1];
              b0 = px[i + 2];
            }
            if (row === 1) {
              // changed pixels vs the cell before in red, the rest dimmed
              const o2 = before;
              const diff = o2 && ((o2[i + 3] > 0) !== (px[i + 3] > 0) || (px[i + 3] > 0 && (o2[i] !== px[i] || o2[i + 1] !== px[i + 1] || o2[i + 2] !== px[i + 2])));
              if (diff) {
                r0 = 255;
                g0 = 40;
                b0 = 40;
              } else {
                r0 = Math.round(r0 * 0.35);
                g0 = Math.round(g0 * 0.35);
                b0 = Math.round(b0 * 0.35);
              }
            }
            id.data[i] = r0;
            id.data[i + 1] = g0;
            id.data[i + 2] = b0;
            id.data[i + 3] = 255;
          }
          tg.putImageData(id, 0, 0);
          const y = LBL + row * (ch + LBL + 6);
          g.drawImage(tmp, 0, 0, sb.w, sb.h, x, y, cw, ch);
          // rest anchor cross (dim)
          const ax = (Math.round(q.st.rest.x) - sb.x) * S + x;
          const ay = (Math.round(q.st.rest.y) - sb.y) * S + y;
          g.fillStyle = 'rgba(120,200,255,0.55)';
          g.fillRect(ax - 3 * S, ay, 7 * S, 1);
          g.fillRect(ax, ay - 3 * S, 1, 7 * S);
          if (q.j === c.i) {
            g.strokeStyle = '#ffd447';
            g.strokeRect(x - 1.5, y - 1.5, cw + 3, ch + 3);
          }
        }
        g.fillStyle = q.j === c.i ? '#ffd447' : '#9ef';
        g.font = '11px monospace';
        const off = `${Math.round(q.st.x - q.st.rest.x)},${Math.round(q.st.y - q.st.rest.y)}`;
        g.fillText(`${q.j === c.i ? 'CONTACT ' : ''}${q.st.frame} ${snaps[q.j].t}ms d${off}`, x, 11);
        before = px;
      });
      r.png = cv.toDataURL('image/png');
    }
    results.push(r);
  }
  return { contacts: results, frames: snaps.length, marks: marks.length, errors: [...(N.errors ?? [])] };
}

// ---------------------------------------------------------------- main

const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
const { chromium } = require('playwright-core');
const server = await createServer({
  root: REPO,
  logLevel: 'error',
  server: { port: 6900 + Math.floor(Math.random() * 600), host: '127.0.0.1', strictPort: false, hmr: false },
  clearScreen: false,
});
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: chromePath(),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});

async function probeOne(key) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(600000);
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 300)));
  const wall0 = Date.now();
  let res;
  try {
    const q = `?dev=duel&s=${encodeURIComponent(key)}${LOOK === 'v3' ? '&look=v3' : ''}&test=1`;
    try {
      await page.goto(base + q, { waitUntil: 'load', timeout: 240000 });
    } catch {
      await page.goto(base + q, { waitUntil: 'load', timeout: 240000 });
    }
    await page.waitForFunction(() => window.__neon && window.__neon.ready === true && !!window.__neon.duel, null, { timeout: 300000 });
    res = await page.evaluate(probeInPage, { key, cap: CAP, png: !!PNG, scale: SCALE, hist: HIST });
  } catch (e) {
    res = { failed: String(e && e.message ? e.message : e).slice(0, 500), contacts: [] };
  }
  res.pageErrors = pageErrors;
  res.wallMs = Date.now() - wall0;
  await ctx.close();
  return res;
}

const verdictOf = (c) => {
  if (!c.resting) return 'excluded';
  const why = [];
  const moved = !!(c.shiftFromRest.dx || c.shiftFromRest.dy || c.shiftFromPrev.dx || c.shiftFromPrev.dy);
  if (moved) why.push('moved on contact');
  if (c.screenPct >= 50) why.push('screen ≥ 50');
  if (c.screenPct > c.pagePct + 5) why.push('screen > page + 5');
  if (!why.length) return 'PASS';
  // the sprite did not move: the excess is the idle phase the blow landed on (§10: reported apart)
  return `FAIL (${why.join(', ')})${moved ? '' : ` — idle phase +${c.phasePct}`}`;
};

const results = {};
let failed = 0;
let bad = 0;
try {
  console.log(`[contact-probe] ${KEYS.length} scenario(s), look ${LOOK}, cap ${CAP} ms, jobs ${JOBS}`);
  const queue = [...KEYS];
  const worker = async () => {
    for (;;) {
      const key = queue.shift();
      if (!key) return;
      const r = await probeOne(key);
      results[key] = r;
      if (r.failed || r.pageErrors.length || (r.errors ?? []).length) failed++;
      console.log(`${key.padEnd(22)} ${r.failed ? `FAILED ${r.failed}` : `${r.contacts.length} contact(s)`}  [${Math.round(r.wallMs / 1000)} s]`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(JOBS, KEYS.length) }, worker));
} finally {
  await browser.close();
  await server.close();
}

// ---------------------------------------------------------------- report
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
const off = (o) => `${o.dx},${o.dy}`;
const lines = [];
lines.push(`contact-probe (tools/contact-probe.mjs) — look ${LOOK}, ${new Date().toISOString()}`);
lines.push('screen = prev → contact as drawn (frame + position); frames = the same two frames in place; page = HA-21 (contact vs idle f0); phase = frames − page; % of idle f0 opaque');
lines.push('bob = dy:frames % with the previous frame dy px lower (the best whole-pixel line-up); 1st = first frame change after contact; knock onset: =1st on that frame, chg another change, held no change');
lines.push('');
lines.push(
  `${pad('scenario', 22)}${pad('unit', 24)}${pad('how', 6)}${lpad('t', 6)}  ${pad('prev → contact', 30)}${pad('rest', 5)}${lpad('screen', 7)}${lpad('frames', 7)}${lpad('page', 7)}${lpad('phase', 7)}  ${pad('bob', 9)}${pad('@contact', 9)}${pad('1st change', 22)}${pad('knock onset', 20)}${pad('max', 7)}verdict`,
);
if (PNG) fs.mkdirSync(PNG, { recursive: true });
for (const key of KEYS) {
  const r = results[key];
  if (!r) continue;
  if (r.failed) {
    lines.push(`${pad(key, 22)}FAILED ${r.failed}`);
    continue;
  }
  if (!r.contacts.length) lines.push(`${pad(key, 22)}(no contact found)`);
  for (const c of r.contacts) {
    const v = verdictOf(c);
    c.verdict = v;
    if (v.startsWith('FAIL')) bad++;
    const k = c.knock ? `+${c.knock.ms}ms ${c.knock.onFirstChange ? '=1st' : c.knock.frameChanged ? 'chg' : 'held'} ${off(c.knock)}` : '-';
    const fc = c.firstChange ? `+${c.firstChange.ms}ms ${c.firstChange.frame}` : '-';
    const bb = c.bob ? `${c.bob.dy}:${c.bob.pct}` : '-';
    lines.push(
      `${pad(key, 22)}${pad(`${c.cardId} P${c.player + 1} z${c.zone}`, 24)}${pad(c.how, 6)}${lpad(c.t, 6)}  ${pad(`${c.prevFrame} → ${c.contactFrame}`, 30)}${pad(c.resting ? 'yes' : 'no', 5)}${lpad(c.screenPct, 7)}${lpad(c.framesPct, 7)}${lpad(c.pagePct, 7)}${lpad(c.phasePct, 7)}  ${pad(bb, 9)}${pad(off(c.shiftFromPrev), 9)}${pad(fc, 22)}${pad(k, 20)}${pad(off(c.knockMax), 7)}${v}`,
    );
    if (PNG && c.png) {
      const f = path.join(PNG, `${key}-${c.cardId}-${c.uid}.png`);
      fs.writeFileSync(f, Buffer.from(c.png.split(',')[1], 'base64'));
      c.png = path.relative(REPO, f);
    }
  }
  for (const e of [...(r.pageErrors ?? []), ...(r.errors ?? [])]) lines.push(`${pad('', 22)}error: ${e}`);
}
// ---- the rest loop before each resting contact (Y1b, the pre-contact idle settle)
const STRETCH = 0.35;
const restAnimOf = (c) => (c.prevFrame.includes(':') ? c.prevFrame.slice(0, c.prevFrame.indexOf(':')) : c.prevFrame);
const FRAME_MS = 1000 / 60;
let worstLo = Infinity;
let worstHi = -Infinity;
let worstAt = '';
let badSkips = 0;
let badHolds = 0;
lines.push('');
lines.push('rest loop before each resting contact (Y1b): frames shown since the settle started (else the last --hist ms) as frame:ms/nominal; ratio = time on screen ÷ nominal hold');
lines.push(`(each frame bounded on both sides except the last, cut by the contact, and a first one already on at the scenario's first render: ≤ only; a frame may differ by one rendered frame, ${FRAME_MS.toFixed(1)} ms, from its scaled hold);`);
lines.push('settle = the plans of the blow (ms before contact, the loop frame aimed at, * = a target, the hold multiplier); "|" marks the first frame on screen in the settle window (ratios / skips are checked from there);');
lines.push('reach = the even loop speed that would put a frame within KK-4 of THIS contact frame on screen before contact, from the first event of the chain');
lines.push('skip = frames the loop stepped over: the merged step and each skipped frame\'s own change ÷ idleΔ (a skip is allowed only when both are ≤ 1)');
for (const key of KEYS) {
  const r = results[key];
  if (!r || r.failed) continue;
  for (const c of r.contacts) {
    if (!c.resting || !c.restLoop) continue;
    const segs = c.restLoop;
    let lo = Infinity;
    let hi = -Infinity;
    let out = 0;
    for (const s of segs) {
      if (!s.nominal || !s.inSettle) continue;
      const scaledLo = (1 - STRETCH) * s.nominal - FRAME_MS - 0.5;
      const scaledHi = (1 + STRETCH) * s.nominal + FRAME_MS + 0.5;
      if (s.ms > scaledHi || (!s.last && !s.cut && s.ms < scaledLo)) out++;
      if (!s.last && !s.cut) lo = Math.min(lo, s.ratio);
      hi = Math.max(hi, s.ratio);
    }
    const skips = c.restSkips ?? [];
    const sb = skips.filter((k) => k.inSettle && ((k.merged ?? 9) > 1 || k.own.some((d) => (d ?? 9) > 1))).length;
    let sv = '';
    if (c.settle) {
      if (lo < worstLo) worstLo = lo;
      if (hi > worstHi) {
        worstHi = hi;
        worstAt = `${key} ${c.cardId} P${c.player + 1}`;
      }
      badSkips += sb;
      badHolds += out;
      if (sb || out) {
        sv = `  FAIL (${[sb ? `${sb} skip(s) over a change > idleΔ` : '', out ? `${out} hold(s) outside ±35 %` : ''].filter(Boolean).join(', ')})`;
        bad++;
      }
    }
    const plans = c.settle?.plans ?? [];
    const pl = plans.map((q) => `−${q.before} f${q.plan?.frame}${q.plan?.target ? '*' : ''} hold×${q.plan ? Math.round(q.plan.hold * 100) / 100 : '?'}`).join(', ');
    const head = `${pad(key, 22)}${pad(`${c.cardId} P${c.player + 1} z${c.zone}`, 24)}${c.settle ? `settle ${pl}` : 'no settle'}  ratio ${Number.isFinite(lo) ? lo : '-'}…${Number.isFinite(hi) ? hi : '-'}${skips.length ? `  skip ${skips.map((k) => `${k.from}→${k.to} (${k.merged}/${k.own.join(',')})`).join(' ')}` : ''}${sv}`;
    lines.push(head);
    const rc = c.reach;
    if (rc)
      lines.push(
        `${pad('', 24)}reach: from ${rc.from} −${rc.before} ms at ${restAnimOf(c)}:${rc.frame}+${rc.into} ms; frames within KK-4 of ${c.contactFrame}: [${rc.targets.join(',')}]; best even speed ${rc.best ? `f${rc.best.f} ×${rc.best.s} (holds ×${Math.round(100 / rc.best.s) / 100})` : '-'} → ${rc.feasible ? 'within ±35 %' : 'OUT of ±35 %'}`,
      );
    lines.push(`${pad('', 24)}${segs.map((s, k) => `${c.settle && s.inSettle && (k === 0 || !segs[k - 1].inSettle) ? '| ' : ''}${s.frame.slice(s.frame.indexOf(':') + 1)}:${s.ms}/${s.nominal ?? '?'}`).join(' ')}   events ${c.events.map((e) => `${e.type} −${e.before}`).join(', ')}`);
  }
}
lines.push(`settled contacts: worst hold ratio ${Number.isFinite(worstLo) ? worstLo : '-'}…${Number.isFinite(worstHi) ? worstHi : '-'}${worstAt ? ` (max at ${worstAt})` : ''}; holds outside ±35 %: ${badHolds}; skips over a change > idleΔ: ${badSkips}`);
lines.push('');
lines.push(`resting contacts failing: ${bad}`);
const txt = lines.join('\n');
console.log(txt);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ tool: 'tools/contact-probe.mjs', version: 1, date: new Date().toISOString(), look: LOOK, cap: CAP, scenarios: results }, null, 1));
fs.writeFileSync(TXT, txt + '\n');
console.log(`[contact-probe] wrote ${path.relative(REPO, OUT)}, ${path.relative(REPO, TXT)}`);
process.exit(failed ? 1 : bad ? 2 : 0);
