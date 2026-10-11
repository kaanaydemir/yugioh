// compare.html — the current game and the HD trial, side by side (or either one full-size).
//
//   LEFT  "ŞU ANKİ"  the shipped game (index.html), duel scene, staged through the existing QA hooks
//                    (window.__neon.duel.restart({stage}) + dispatch, called from here: nothing is added to the game):
//                    Kristal Ejder (P1, zone 1) attacks and destroys Kor Kurdu (P2, zone 1), looping. If the QA hooks
//                    are unavailable it falls back to the closest stock scenario `atkTargetDestroyed`
//                    (?dev=duel&s=atkTargetDestroyed: Kristal Ejder destroys Uçurum Büyücüsü).
//   RIGHT "HD NEON"  trial.html?view=scene (its own looping sequence, src/hd/cine/).
//
//   Keys: 1 left only · 2 right only · 0 side by side · R restart both
//
// Sizing: both iframes are rendered at a "virtual" size of 1920k × 1080k px — where the current game runs at an
// exact 3k× zoom and the HD game at an exact 2k× zoom, so each is pixel-perfect at its own scale and they cover the
// same screen area — and the iframe is then scaled by CSS to fit its panel.

// a stock staged scenario (Kor Kurdu normal summon) as the launch pad: it boots straight into a staged board, then QA restart takes over
const LEFT_URL = 'index.html?dev=duel&s=normalSummon&speed=3';
const LEFT_FALLBACK_URL = 'index.html?dev=duel&s=atkTargetDestroyed';
const RIGHT_URL = 'trial.html?view=scene';

type Mode = '0' | '1' | '2';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fl = $<HTMLIFrameElement>('fl');
const fr = $<HTMLIFrameElement>('fr');
const pl = $('pl');
const pr = $('pr');
const capL = $('capL');
const capR = $('capR');
const note = $('note');

let mode: Mode = '0';
try {
  const m = new URLSearchParams(location.search).get('mode');
  if (m === '1' || m === '2' || m === '0') mode = m;
} catch {
  /* ignore */
}

// ---------------------------------------------------------------- layout

function place(panel: HTMLElement, frame: HTMLIFrameElement, x: number, y: number, maxW: number, maxH: number): void {
  const w = Math.max(160, Math.min(maxW, (maxH * 16) / 9));
  const h = (w * 9) / 16;
  const k = Math.max(1, Math.ceil(w / 1920 - 1e-6));
  const vw = 1920 * k;
  const vh = 1080 * k;
  panel.style.left = `${Math.round(x + (maxW - w) / 2)}px`;
  panel.style.top = `${Math.round(y + (maxH - h) / 2)}px`;
  panel.style.width = `${Math.round(w)}px`;
  panel.style.height = `${Math.round(h)}px`;
  frame.style.width = `${vw}px`;
  frame.style.height = `${vh}px`;
  frame.style.transform = `scale(${w / vw})`;
}

function layout(): void {
  const W = window.innerWidth;
  const H = window.innerHeight - 30; // bottom bar
  const top = 34; // label row above a panel
  const gap = 18;
  const both = mode === '0';
  pl.hidden = false;
  pr.hidden = false;
  // a hidden panel keeps playing (so the two stay in step) but is parked out of sight
  const park = (p: HTMLElement) => {
    p.style.left = '-99999px';
  };
  if (both) {
    const pw = Math.floor((W - gap * 3) / 2);
    place(pl, fl, gap, top, pw, H - top - 8);
    place(pr, fr, gap * 2 + pw, top, pw, H - top - 8);
  } else if (mode === '1') {
    place(pl, fl, gap, top, W - gap * 2, H - top - 8);
    park(pr);
  } else {
    place(pr, fr, gap, top, W - gap * 2, H - top - 8);
    park(pl);
  }
}
window.addEventListener('resize', layout);

// ---------------------------------------------------------------- keys

function onKey(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (e.key === '0' || e.key === '1' || e.key === '2') {
    mode = e.key as Mode;
    layout();
    return true;
  }
  if (e.key === 'r' || e.key === 'R') {
    restartBoth();
    return true;
  }
  return false;
}
document.addEventListener('keydown', (e) => {
  if (onKey(e)) e.preventDefault();
});
/** Keys pressed while an iframe has focus are handled here and never reach the game inside it. */
function forwardKeys(frame: HTMLIFrameElement): void {
  try {
    frame.contentWindow?.addEventListener(
      'keydown',
      (e) => {
        if (onKey(e)) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true,
    );
  } catch {
    /* cross-origin: nothing to do */
  }
}

// ---------------------------------------------------------------- left: the current game, staged through the QA hooks

interface DuelQaLike {
  restart(opts?: Record<string, unknown>): Promise<void>;
  dispatch(a: Record<string, unknown>): Promise<void>;
}
type NeonWin = Window & { __neon?: { ready?: boolean; duel?: DuelQaLike; errors?: string[] } };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
let leftGen = 0;
let leftStaged = false;

async function waitFor(cond: () => boolean, ms: number): Promise<boolean> {
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    if (cond()) return true;
    await sleep(100);
  }
  return false;
}

const STAGE = {
  phase: 'battle',
  p0: { monsters: [null, 'crystal_wyrm'] },
  p1: { monsters: [null, 'ember_wolf'] },
};

async function driveLeft(gen: number): Promise<void> {
  const win = fl.contentWindow as NeonWin | null;
  const ok = await waitFor(() => !!win?.__neon?.duel && win.__neon.ready === true, 60000);
  if (gen !== leftGen) return;
  const D = win?.__neon?.duel;
  if (!ok || !D) return fallbackLeft('QA kancaları bulunamadı');
  try {
    while (gen === leftGen) {
      await D.restart({ mode: 'hotseat', curtain: false, skipIntro: true, speed: 1, stage: STAGE });
      if (gen !== leftGen) return;
      leftStaged = true;
      fl.style.visibility = 'visible';
      await sleep(1100);
      if (gen !== leftGen) return;
      await D.dispatch({ type: 'attack', player: 0, attackerZone: 1, targetZone: 1 });
      await sleep(1800);
    }
  } catch (err) {
    console.error('[compare] driving the current game failed', err);
    if (gen === leftGen) fallbackLeft('sahne kurulamadı');
  }
}

function fallbackLeft(why: string): void {
  leftGen++;
  note.textContent = `ŞU ANKİ: yakın sahne kullanılıyor (Kristal Ejder – Uçurum Büyücüsü) — ${why}`;
  capL.textContent = 'atkTargetDestroyed · Kristal Ejder – Uçurum Büyücüsü';
  leftStaged = true;
  fl.style.visibility = 'visible';
  fl.src = LEFT_FALLBACK_URL;
}

function startLeft(): void {
  const gen = ++leftGen;
  leftStaged = false;
  fl.style.visibility = 'hidden'; // shown once the staged board is up (no flash of the launch-pad scenario)
  note.textContent = '';
  capL.textContent = 'Kristal Ejder → Kor Kurdu · mevcut oyun · 640×360';
  fl.onload = () => {
    forwardKeys(fl);
    void driveLeft(gen);
  };
  fl.src = LEFT_URL;
}

// ---------------------------------------------------------------- right: the HD trial

function startRight(): void {
  fr.onload = () => forwardKeys(fr);
  fr.src = RIGHT_URL;
}

function restartBoth(): void {
  startLeft();
  const w = fr.contentWindow as (Window & { __neon?: { hd?: { scene?: { restartView(): void } } } }) | null;
  try {
    w?.__neon?.hd?.scene?.restartView();
  } catch {
    startRight();
  }
}

// ---------------------------------------------------------------- test hooks (tools/shot.mjs: ready / errors / freeze / step)

type FrameNeon = { ready?: boolean; errors?: string[]; freeze?(): void; step?(ms: number): void | Promise<void>; unfreeze?(): void };
const neonOf = (f: HTMLIFrameElement): FrameNeon | undefined => (f.contentWindow as { __neon?: FrameNeon } | null)?.__neon;
const hooks = {
  ready: false,
  errors: [] as string[],
  freeze: () => [fl, fr].forEach((f) => neonOf(f)?.freeze?.()),
  step: async (ms: number) => {
    await Promise.all([fl, fr].map((f) => neonOf(f)?.step?.(ms)));
  },
  unfreeze: () => [fl, fr].forEach((f) => neonOf(f)?.unfreeze?.()),
};
(window as unknown as { __neon: typeof hooks }).__neon = hooks;
void (async () => {
  await waitFor(() => leftStaged && !!neonOf(fl)?.ready && !!neonOf(fr)?.ready, 90000);
  hooks.ready = true;
  setInterval(() => {
    for (const f of [fl, fr]) for (const e of neonOf(f)?.errors ?? []) if (!hooks.errors.includes(e)) hooks.errors.push(e);
  }, 500);
})();

layout();
startLeft();
startRight();
document.body.focus();
