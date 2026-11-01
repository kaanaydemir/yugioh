export const meta = {
  name: 'lane-f-cards',
  description: 'Lane F: design, build, 3 film-look-critique-fix rounds, gate-verify, commit+push for 4 monsters',
  phases: [
    { title: 'Design', detail: 'per-card storyboard + identity, independent design critique' },
    { title: 'Build art', detail: 'v3 rig P1/P2, card art, cut-in, tests' },
    { title: 'Build cinematics', detail: 'summon/attack/death/effect cinematics, SFX, scenarios' },
    { title: 'Critique', detail: '3 rounds: independent critic films+looks, fixer fixes' },
    { title: 'Verify', detail: 'adversarial gate verification, fix loop' },
    { title: 'Ship', detail: 'commit + push per card' },
  ],
}

const A = typeof args === 'string' ? JSON.parse(args) : args
const CARDS = Array.isArray(A) ? A : (A && Array.isArray(A.cards) ? A.cards : [])
if (!CARDS.length) throw new Error('no cards in args: ' + typeof args)

const COMMON = `
You are part of lane F of the Neon Düello per-card presentation work, repo /home/user/yugioh, branch claude/kart-f.
READ FIRST (do not skip): docs/v3/oturum-f/HANDBOOK.md (lane F addendum) and docs/v3/oturum-f/HANDBOOK-lane-B-copy.md §0–§11
(the full v3 pipeline map: files, registration points, v1 safety, rig contract, card art, cut-in, cinematics API, sound
wiring, scenarios, filming, gates, pitfalls, reference implementations), docs/v3/PARALEL_OTURUMLAR.md, docs/v3/REHBER.md,
docs/v3/TEMPO.md, docs/GAME_DESIGN.md, docs/v3/YENI_KARTLAR.md §5 / §5.1 (sound identity table) / §5.2 (death endings table),
docs/v3/KART_RESIMLERI.md (card art), and the card's own design doc docs/v3/oturum-f/<id>.md once it exists.
BRAND GOLDEN RULE: every summon, attack, death and effect is UNIQUE to the card, stunning, fluid, readable; SFX equal to VFX.
Match or exceed the best v3 monsters: crystal_wyrm, abyss_magus, stone_sentinel (rigs in src/art/monsters-v3, cinematics in
src/cinematics/summon-a, strikes-a, strikes-b, _v3, sounds in src/audio/v3 and src/cinematics/_v3/sound.ts, cut-ins in src/art/cutins-v3).
Keep the house pixel language: 640×360, 1-px outlines, clean tone bands, palette only from src/art/palette.ts, monsters face RIGHT, P2 = flipX + relight.
CONCURRENCY: another agent works on a different lane-F card in this same tree at the same time. Only edit files of YOUR card plus your
own one-line entries in shared registries (re-read a shared file right before editing it; make small additive Edit calls, never rewrite
shared files). tsc errors in files you do not own are someone else's WIP: ignore them. Do not touch venom_drake, wisp_imp or other lanes' cards.
Do NOT git commit / push / stash / checkout / reset (only the Ship stage commits). Never run destructive git commands.
Tools: headless screenshots with node tools/shot.mjs (always --fresh and &look=v3 for v3; films with --film N --every MS --cols C; --clip; --scale),
sheets with npx vite-node tools/monster-sheet.ts, sprite gates npx vite-node tools/monster-gates.ts, sameness npx vite-node tools/sameness.ts,
audio pages ?dev=audio&page=one&name=<sfx>&log=1, clips node tools/clip.mjs (wav+json stats), measure node tools/measure.mjs.
ALWAYS LOOK at every PNG you produce with the Read tool — that is the only way to verify art and animation. Put evidence under
shots/v3/kart-f/<id>/ (gitignored). The machine has only 4 CPUs: run at most one browser tool at a time, prefer --jobs 1.
`

const FINDINGS = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['ship', 'needs-work', 'broken'] },
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['blocker', 'high', 'medium', 'low'] },
          moment: { type: 'string', description: 'idle|summon|attack|direct|blocked|hit|guard|death|revive|effect|cardart|cutin|sfx|integration|gates|other' },
          issue: { type: 'string' },
          evidence: { type: 'string', description: 'PNG/JSON paths and frame numbers you looked at' },
          fix: { type: 'string', description: 'concrete, actionable fix' },
        },
        required: ['severity', 'moment', 'issue', 'evidence', 'fix'],
      },
    },
  },
  required: ['verdict', 'summary', 'findings'],
}

const VERIFY = {
  type: 'object',
  properties: {
    pass: { type: 'boolean' },
    failures: { type: 'array', items: { type: 'string' } },
    gateResults: { type: 'string', description: 'each gate, command, and its result' },
  },
  required: ['pass', 'failures', 'gateResults'],
}

// An agent that died (usage limit, API error) stops this card's chain instead of cascading empty rounds.
async function must(prompt, opts) {
  const r = await agent(prompt, opts)
  if (r === null || r === undefined) throw new Error('agent ' + opts.label + ' returned nothing (limit/API error) - stopping this card')
  return r
}

const fmt = (r) => !r ? '(critic returned nothing)' : `verdict=${r.verdict}\n${r.summary}\n` +
  r.findings.map((f, i) => `${i + 1}. [${f.severity}] (${f.moment}) ${f.issue}\n   evidence: ${f.evidence}\n   fix: ${f.fix}`).join('\n')

const LENSES = [
  {
    key: 'craft',
    text: `LENS: ANIMATION AND ART CRAFT. Film every sprite anim P1 and P2 (monster-sheet sheets + in-game films of summon,
attack on a monster, direct attack, blocked attack on a guard, being hit, death, the effect, idle on the board next to other monsters).
Judge frame count and fluidity (anticipation / follow-through / overlap / squash, no pops, no static frames), silhouette readability at 1×,
pixel language (1-px outline, tone bands, no noise/pillow shading, no 3D-render look), anatomy and volume consistency across frames,
P2 relight correctness, card art big+small quality and readability, cut-in (if any). Compare side by side with crystal_wyrm,
abyss_magus and stone_sentinel at the same scale: anything visibly below them is at least high.`,
  },
  {
    key: 'unique',
    text: `LENS: UNIQUENESS AND SOUND. Is every moment (summon, attack, death ending, effect, idle) unique to this card and memorable,
or does it look/sound shared with any existing monster or the generic defaults? Run tools/sameness.ts for the card against all.
Check YENI_KARTLAR §5.1 / §5.2 collisions. For SOUND: render every recipe of the card on ?dev=audio&page=one&name=<sfx>&log=1
(look at waveform + spectrogram PNGs), make clips with tools/clip.mjs of the key scenarios (look at the .json stats: peak ≤ −1 dBFS,
0 clipped), verify each sound fires on its frame (atFrame/atMark), is layered and rich (not a single beep), has a clear identity,
does not reuse another card's signature layer, and that no moment is silent or falls back to generic sounds.`,
  },
  {
    key: 'integration',
    text: `LENS: IN-GAME INTEGRATION, TEMPO AND GATES. Play the card's scenarios (P1 and P2, attack and defense position, as attacker and
as target, effect paths, revive via soul_recall if possible, the 5+5 board &zones=5) in the real duel (?dev=duel&s=<key>&look=v3) and film
them. Check readability of the effect's game meaning (does the player understand what happened and to whom?), timing budgets (REHBER §5 ×1.45,
measure.mjs), contact frame vs damage number, no hanging sounds, no leftover sprites/particles, depth ordering, nothing off-screen, camera
gate unchanged (no focus/zoom), the v1 look unchanged, tests and typecheck for this card's files. Any functional bug is a blocker.`,
  },
]

function designPrompt(c) {
  return `${COMMON}
TASK (Design) for card ${c.id} (${c.name}). ${c.brief}

Write docs/v3/oturum-f/${c.id}.md (Turkish or English is fine; keep it concrete). Before writing:
- Study the card data (src/data/cards.ts), its engine effect and the EXACT event flow the cinematics will receive (engine/rules.ts, query.ts,
  and how today's placeholder presents it), the existing v1/v3 roster so you know what is already taken (look at sheets of crystal_wyrm,
  abyss_magus, stone_sentinel and the bipeds; read §5.1/§5.2), and the reference implementations.
${c.draft ? `- This card has an EARLIER v3 DRAFT that failed review and is excluded (${c.draft}). Render it (tools/monster-sheet.ts --look v3 works on
  excluded files? if not, render via a temporary local test script in the scratchpad, never by editing the registry) and LOOK at it; run its
  test file; diagnose concretely why it failed (art quality, distinctness, gates, tests). Decide: refine the draft or rebuild from scratch.
  Record the diagnosis and decision in the doc.` : ''}
The doc must contain: concept + silhouette (with a size/frame box and why it reads at 1×), palette ramps used, the idle (living details),
and frame-by-frame storyboards with timings (scene ms, within REHBER §5 budgets) for: summon, attack (+ direct + blocked variant),
hit / heavy / magic hit, guard, death (a unique final material not in §5.2), revive, and the signature EFFECT presentation (how the
game meaning is made readable: who is affected and how), the ${c.ace ? 'cut-in (this is an ACE) and ' : ''}card art composition,
the SOUND identity (pitch, material, distinctive layer — checked against §5.1) and a per-beat sound list with recipe names,
which files you will create and which shared one-liners you will edit, the scenario keys (prefix ${c.prefix}) you will add, and the gates.
Aim for moments that are stunning and memorable and unlike any other card. Return a short summary of the design.`
}

function designCritiquePrompt(c) {
  return `${COMMON}
TASK (Design critique), independent reviewer for card ${c.id} (${c.name}). Read docs/v3/oturum-f/${c.id}.md critically. Do not edit it.
Check: is every moment truly unique against the whole roster (open sheets / films of existing monsters to compare), is it stunning enough
for the brand golden rule (or merely adequate?), does the effect presentation make the game meaning readable, are the storyboards
feasible in the rig contract and inside the time budgets, does the sound identity collide with §5.1 / the death with §5.2, is the event
flow understanding correct (verify in engine code), is anything missing (P2, revive, blocked, direct, 5+5 board, aura persistence, etc.).
Return findings with concrete fixes.`
}

function buildArtPrompt(c, crit) {
  return `${COMMON}
TASK (Build art) for card ${c.id} (${c.name}). Implement the design in docs/v3/oturum-f/${c.id}.md. First fold in the design critique below
(update the doc's design where you accept a finding; note rejected ones with a reason).

Build: the v3 sprite rig (src/art/monsters-v3/${c.id}*.ts) with idle, roar, attack (marks), hit, hitHeavy, hitMagic, guard, toGuard/fromGuard
if needed, summon, death (unique ending), revive, special (signature effect) — P1 and P2 (p2: 'relight'); light-layer glow entry; card art
src/art/cardart-v3/${c.id}.ts (big 88×68 + hand-tuned small 44×34, portrait() wired)${c.ace ? '; the cut-in src/art/cutins-v3/' + c.id + '.ts' : ''}.
${c.draft ? 'There is an earlier failing draft; follow your diagnosis/decision in the doc. Keep it excluded until the gates pass, then remove ONLY your exclusion entry in src/art/monsters/index.ts.' : 'Draft as src/art/monsters-v3/_' + c.id + '.ts; rename to ' + c.id + '.ts when the sprite gates pass.'}
Tests: tests/art/${c.id}.test.ts (validateArt normal tier no errors, registration, marks, death ending, P2, card art) must pass.
Iterate yourself at least twice: render sheets (P1 + P2) and board-scale shots, LOOK, fix. Run monster-gates (pass --class) and sameness.
Log what you built and evidence paths in docs/v3/oturum-f/${c.id}.md. Return a summary with evidence paths and known weaknesses.

DESIGN CRITIQUE:
${fmt(crit)}`
}

function buildCinePrompt(c) {
  return `${COMMON}
TASK (Build cinematics + sound) for card ${c.id} (${c.name}). The rig and card art exist (see docs/v3/oturum-f/${c.id}.md).
Build, per the design doc: unique v3 summon (incl. tribute path if Lv≥5${c.ace ? ' and the cut-in rhythm' : ''}), strike (attack on monster, direct,
blocked), death (unique ending, bookkeeping exactly as the handbook §6.3), the signature effect presentation for its engine event flow
(${c.effectNote}), in src/cinematics/kart-f/${c.id}.ts, gated on LOOK_V3, priority 20, names kart-f:${c.id}:<part>.
Sound: all recipes in src/audio/v3/${c.id}.ts from ./kit.ts blocks + Voice primitives (no new DSP files), every beat fired on its frame,
set ${c.id.toUpperCase()}_VOICE (all required roles incl. revive pair) in the same change. Fix DEATH_PRESETS / MONSTER_GLOW one-liners per the handbook.
Scenarios src/duel/scenarios/${c.id}.ts with prefix ${c.prefix}: summon, attack, direct, blocked (guard), death, effect, P2 versions, revive if feasible.
Before writing cinematics, measure the new scenarios on today's placeholder presentation into shots/v3/kart-f/${c.id}/camera-base.json so the camera gate has a base.
Film every scenario (P1+P2), LOOK, fix — iterate at least twice. Check sounds on the audio page and with clip.mjs. Keep the v1 look unchanged.
Log in docs/v3/oturum-f/${c.id}.md. Return a summary with evidence paths and known weaknesses.`
}

function criticPrompt(c, lens, round) {
  return `${COMMON}
TASK (Critique round ${round}/3), INDEPENDENT CRITIC for card ${c.id} (${c.name}). You did not build this; be demanding — the owner's bar is
"every animation must be perfect". Do NOT edit source files (you may write evidence files under shots/v3/kart-f/${c.id}/r${round}-${lens.key}/).
${lens.text}
Film it yourself (fresh shots; do not trust the builder's evidence), LOOK at every PNG. Read the design doc docs/v3/oturum-f/${c.id}.md for intent
and previous rounds' notes. Return verdict + findings (each with evidence and a concrete fix). Prioritise what most improves the card.`
}

function fixPrompt(c, crit, round, lens) {
  return `${COMMON}
TASK (Fix round ${round}/3, lens ${lens}) for card ${c.id} (${c.name}). An independent critic reviewed the card. Fix every blocker and high finding
and as many medium/low as is sensible; if you reject a finding, write why. Then re-film the affected moments, LOOK, and confirm each fix.
Re-run the card's tests, typecheck (your files), monster-gates and sameness if the art changed. Append a "Round ${round}" section to
docs/v3/oturum-f/${c.id}.md: each finding → what you did, evidence paths. Return a summary.

CRITIC REPORT:
${fmt(crit)}`
}

function verifyPrompt(c, attempt) {
  return `${COMMON}
TASK (Adversarial verification, attempt ${attempt}) for card ${c.id} (${c.name}). Try to REFUTE the claim "this card is done and ships".
Run every gate yourself and report exact results:
- npm run typecheck (errors in files of this card or lane-F shared lines = fail; other files: note only)
- npm test (no new failures vs the known dusk_ashen / cardface G1; ${c.id} tests must pass${c.draft ? '; the card must be REMOVED from the exclusion list and registered' : '; the rig must be registered as src/art/monsters-v3/' + c.id + '.ts'})
- node tools/filmdiff.mjs --set v1 --base shots/v3/a3/baseline/v1films (17/17 IDENTICAL) and --set a6v1 --base shots/v3/a56/baseline/a6v1films (26/26 IDENTICAL)
  (if a diff appears, check whether it is caused by THIS card's change or by the other lane-F card's WIP; only this card's cause fails it)
- camera gate: node tools/measure.mjs --look v3 --scenarios '<this card's scenarios + m1 placeholders it appears in>' --out <scratch>.json --camera-gate <base>
  (bases: shots/v3/kart-f/camera-base.json and shots/v3/kart-f/${c.id}/camera-base.json)
- node tools/palcheck.mjs on frames of the card's films; monster-gates P1+P2 with --class; sameness thresholds; cardface-v3 test; budgets from measure.
- Definition of done: rig with all anims P1+P2, card art big+small, ${c.ace ? 'cut-in, ' : ''}unique summon/attack/death/effect cinematics, unique SFX for each, VOICE set,
  scenarios, docs/v3/oturum-f/${c.id}.md has ≥3 critique rounds recorded.
Also film the card once more and LOOK for any visible defect. Default to pass=false if anything is uncertain. Do not edit source files.`
}

function verifyFixPrompt(c, v) {
  return `${COMMON}
TASK (Gate fix) for card ${c.id} (${c.name}). The adversarial verifier says the card does not ship yet. Fix every failure below (root cause, not
by weakening gates/tests or skipping), re-run the failing gates and confirm. Record in docs/v3/oturum-f/${c.id}.md. Return a summary.
FAILURES:
${v ? v.failures.join('\n') : '(verifier returned nothing — run all gates yourself and fix whatever fails)'}
GATE RESULTS:
${v ? v.gateResults : ''}`
}

function shipPrompt(c, v) {
  return `${COMMON}
TASK (Ship) for card ${c.id} (${c.name}). You ARE allowed to commit and push in this stage only.
1. Update docs/v3/oturum-f.md: this card's status row (design ✓, art ✓, cinematics+SFX ✓, critique rounds 3/3, gates ${v && v.pass ? '✓' : '✗ (list)'}, pushed ✓)
   and a log line with evidence paths; open issues if any. Re-read the file right before editing (another card may edit it too).
2. Run npm run typecheck. Stage ONLY this card's files (git add the explicit paths: src/art/monsters-v3/${c.id}*, src/art/cardart-v3/${c.id}.ts,
   ${c.ace ? 'src/art/cutins-v3/' + c.id + '.ts, ' : ''}src/cinematics/kart-f/${c.id}.ts, src/audio/v3/${c.id}.ts, src/duel/scenarios/${c.id}.ts, tests/art/${c.id}*.test.ts,
   docs/v3/oturum-f/${c.id}.md, docs/v3/oturum-f.md, any other new file whose name contains ${c.id}) plus the shared files this card edited
   (src/art/monsters/index.ts, src/cinematics/_v3/presets.ts, src/view/light/profiles.ts, src/audio/v3/kart-f.ts, src/cinematics/kart-f/_kit.ts …).
   If a shared file also contains another lane-F card's uncommitted WIP lines, check that committing them leaves the tree consistent
   (the referenced files exist and are committed or staged too, typecheck at that state passes); if not, include those referenced files only if
   they typecheck, otherwise use git apply --cached with a hand-made patch for just this card's hunks.
3. git commit -m "lane F: ${c.id} (${c.name}) v3 presentation — rig, card art, cinematics, SFX" with the trailer lines:
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
   Claude-Session: https://claude.ai/code/session_01Qe4uUEfXDGzxzyDTNDDYCa
   (if .git/index.lock exists because another agent is committing, wait and retry.)
4. git push -u origin claude/kart-f (retry on network errors with backoff 2,4,8,16 s; if rejected as non-fast-forward, git pull --rebase origin claude/kart-f then push).
Return the commit hash and what was included.`
}

const results = await pipeline(
  CARDS,
  async (c) => {
    await must(designPrompt(c), { label: `design:${c.id}`, phase: 'Design' })
    return await must(designCritiquePrompt(c), { label: `design-critic:${c.id}`, phase: 'Design', schema: FINDINGS })
  },
  async (crit, c) => {
    await must(buildArtPrompt(c, crit), { label: `art:${c.id}`, phase: 'Build art' })
    await must(buildCinePrompt(c), { label: `cine:${c.id}`, phase: 'Build cinematics' })
    return true
  },
  async (_, c) => {
    const reports = []
    for (let r = 1; r <= 3; r++) {
      const lens = LENSES[r - 1]
      const crit = await must(criticPrompt(c, lens, r), { label: `critic${r}-${lens.key}:${c.id}`, phase: 'Critique', schema: FINDINGS })
      reports.push(crit)
      log(`${c.id} round ${r} (${lens.key}): ${crit ? crit.verdict + ', ' + crit.findings.length + ' findings' : 'no report'}`)
      await must(fixPrompt(c, crit, r, lens.key), { label: `fix${r}:${c.id}`, phase: 'Critique' })
    }
    return reports
  },
  async (reports, c) => {
    let v = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      v = await must(verifyPrompt(c, attempt), { label: `verify${attempt}:${c.id}`, phase: 'Verify', schema: VERIFY })
      log(`${c.id} verify ${attempt}: ${v ? (v.pass ? 'PASS' : 'FAIL ' + v.failures.length) : 'no result'}`)
      if (v && v.pass) break
      if (attempt < 3) await must(verifyFixPrompt(c, v), { label: `gatefix${attempt}:${c.id}`, phase: 'Verify' })
    }
    const ship = await must(shipPrompt(c, v), { label: `ship:${c.id}`, phase: 'Ship' })
    return { id: c.id, pass: !!(v && v.pass), failures: v ? v.failures : ['no verify'], ship, rounds: reports.map((r) => r && { verdict: r.verdict, n: r.findings.length }) }
  },
)
return results
