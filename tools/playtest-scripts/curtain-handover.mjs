// Regression playtest (real mouse): the hot-seat hand-over curtain must be passed exactly once.
//   node tools/playtest.mjs tools/playtest-scripts/curtain-handover.mjs --out shots/playtest/curtain
// Background (verifier "stall", shots/eng/pt/_failure.png): after the curtain's tap its blocker goes away,
// but the input stays in mode 'curtain' while the new hand turns face up. A driver that taps again whenever
// it sees 'curtain' clicked the board under the curtain (320, 180) — on a Saman Korkuluk token there — and
// opened its "Saldırıya Geç" menu, which its wait loop never expected. The game was right; the driver was not.
// This script reproduces the old double tap (expects that stray menu) and checks t.passCurtain() (no menu).
const SC = 'window.__neon.game.scene.keys.Duel';
const five = (...xs) => [...xs, ...Array(5 - xs.length).fill(null)];
const tok = { id: 'straw_decoy_token', position: 'defense', enteredTurn: 5 };
const deck = ['reed_heron', 'kite_fencer', 'crag_axeman'];
const idle = `(() => { const c = ${SC}.controller; return c.input.mode === 'idle' && !c.busy; })()`;
const snap = (t) => t.js(`(() => { const sc = ${SC}; const c = sc.controller; return { mode: c.input.mode, menu: sc.views.menu.isOpen ? sc.views.menu.labels : null, turn: c.state.turn, p: c.state.activePlayer }; })()`);

async function stageAndEnd(t) {
  await t.js(`window.__neon.duel.restart(${JSON.stringify({ mode: 'hotseat', curtain: true, speed: 3, stage: {
    zones: 5, turn: 8, active: 1, phase: 'main',
    p0: { hand: ['crag_axeman', 'well_pail'], monsters: five(tok, tok, null, tok), deck },
    p1: { hand: ['reed_heron'], monsters: five(null, null, { id: 'magma_titan', position: 'defense' }), deck },
  } })})`);
  await t.until(`(() => { const c = ${SC}.controller; return c.input.mode === 'curtain' || (c.input.mode === 'idle' && !c.busy); })()`, { timeout: 60000 });
  if ((await t.inputMode()) === 'curtain') await t.passCurtain();
  await t.until(idle, { timeout: 60000 });
  await t.click(568, 342); // TURU BİTİR (Oyuncu 2) → the curtain for Oyuncu 1
  await t.until(`${SC}.controller.input.mode === 'curtain'`, { timeout: 60000 });
}

export default async (t) => {
  await t.goto('?look=v3&mode=hotseat&seed=3&speed=3');
  await t.until(`${SC} && ${SC}.controller && window.__neon.ready`, { timeout: 120000 });

  // 1. the old driver: tap whenever the mode reads 'curtain' (1.6 s after seeing it)
  await stageAndEnd(t);
  let taps = 0;
  for (let i = 0; i < 4 && (await t.inputMode()) === 'curtain'; i++) {
    await t.wait(1600);
    await t.click(320, 180);
    taps++;
    await t.until(`!${SC}.children.list.some((o) => o.depth === 5000)`, { timeout: 30000 });
  }
  await t.wait(800);
  const old = await snap(t);
  t.note(`old double-tap driver: ${taps} taps → ${JSON.stringify(old)}`);
  await t.shot('old-driver');
  if (!(taps >= 2 && old.menu)) t.note('NOTE: the stray menu did not appear this time (timing)');

  // 2. t.passCurtain(): one tap, then the hand-over is waited out → idle, no menu
  await stageAndEnd(t);
  await t.passCurtain();
  await t.until(idle, { timeout: 60000 });
  await t.wait(800);
  const now = await snap(t);
  t.note(`t.passCurtain(): ${JSON.stringify(now)}`);
  await t.shot('pass-curtain');
  if (now.menu || now.mode !== 'idle' || now.p !== 0) throw new Error('curtain hand-over: expected Oyuncu 1 idle with no menu, got ' + JSON.stringify(now));
  t.note('PASS');
};
