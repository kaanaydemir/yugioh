# Lane F final gate verification (independent)

Tree: `/home/user/yugioh`, branch `claude/kart-f`, HEAD `1aabdef` (main merged in at `389feef`), worktree clean (`git status` empty).
Run 2026-11-06, everything fresh on this exact tree. No source or test file edited. The only files written outside
`shots/v3/kart-f/final/` are `shots/v3/kart-f/camera-base.pre-final.json` (backup) and `shots/v3/kart-f/camera-base.json` (new base).

## Verdict: all 7 gates green. Nothing blocks the merge.

Open points are listed at the end. None of them is a gate failure.

| # | Gate | Result | Raw numbers | Evidence |
|---|---|---|---|---|
| 1 | `npm run typecheck` | **PASS** | exit 0, no output | `typecheck.log` |
| 2 | `npx vitest run` (full) | **PASS** (rerun) | Rerun on an idle machine: 117 files, **2 failed / 1489 passed / 1491**. The only failures are the allowed `cardface-v3.test.ts` G1 and `dusk_ashen.test.ts` (validateArt `§4.9 revive`). The first run happened while the sheet renders ran in parallel. It had **3 failed**: the two allowed ones plus `cloud_hatchling.test.ts` "no cyan / crim / teal / mag in the body; muzzle on every frame", which hit the 5000 ms timeout. That test passes alone in 4576 ms and in the idle rerun in 4973 ms. It is a timing flake, not lane F's file, and lane F does not touch it (`git diff 9eaae1f HEAD` empty). | `vitest.log`, `vitest-rerun.log` |
| 3a | filmdiff `--set v1` vs `shots/v3/a3/baseline/v1films` (base 9eaae1f) | **PASS** | **17/17 IDENTICAL**, exit 0, 388 s, `--jobs 2` | `filmdiff-v1.log` |
| 3b | filmdiff `--set a6v1` vs `shots/v3/a56/baseline/a6v1films` | **PASS** | **26/26 IDENTICAL**, exit 0, 533 s, `--jobs 2` | `filmdiff-a6v1.log` |
| 4 | monster-gates, fresh sheets (P1 + P2) | **PASS** | shield_titan `--class medium`: 21 ok / **0 FAIL** / 2 n/a / 1 info (84×82×4×129). hourglass_imp `--class small`: 21 ok / **0 FAIL** (60×64×4×140). wing_lady `--class medium`: 21 ok / **0 FAIL** (84×72×4×126). windmane_knight `--class ace`: 21 ok / **0 FAIL** (104×96×4×137). | `sheets/gates-*.txt`, `sheets/<id>{,-p2}/` |
| 5 | Camera gate, rebased | **PASS** | 132 scenarios (`m1*,kd*,ks*,fs*,kh*`). zoom min = max = 1 everywhere, closeUpCalls 0 everywhere, otherCamsMaxZoom 1, no page or console errors. The fresh gate run against the new base: **132 ok, 0 NOBASE, 0 FAIL**, exit 0. Determinism: every scenario's `camera` and `zoom` objects and its `events` list are byte-identical between the two runs. | `measure.json`, `measure-gate.json`, `measure-gate.log`, `camdiff.txt` |
| 6 | palcheck `--ref 4` (a5 rules, clip 120,40,400,230, 34 ms frames) | **PASS on attribution** | Raw: 2 of 7 pass. Every failure reproduces on an approved film under the same check: the shared P2 cut-in title, the shared summon card flight and cut-in flash, ember_wolf's victory glow, and the shared damage number. None of it is this lane's card pixels. Table below. | `pal/` |
| 7 | sameness `--ids shield_titan,hourglass_imp,windmane_knight,wing_lady --against all` | **PASS** | 43 profiles, 162 pairs: **0 KALIR**, 31 UYARI. Exit 1 means the worst verdict is UYARI. In-lane pairs: 5 GEÇER, 1 UYARI (shield_titan × windmane_knight, MOTsig 0.595). | `sameness/sameness.txt` |

### Gate 4 detail
- Sheets are rendered from the registered rigs: `npx vite-node tools/monster-sheet.ts --id <id> --look v3 --anims all --scale 3 --points [--p2] --out shots/v3/kart-f/final/sheets/<id>[-p2]`. All four ids are registered (`src/art/monsters-v3/<id>.ts`), so no `--art` draft path is needed.
- windmane_knight `--class large` gives 20 ok / **1 FAIL**: KK-13 bytes 104×96×4×137 = 5,470,464 B against the 5 MB large budget. It passes as `ace` (≤ 7 MB, ≤ 140 frames). windmane_knight is the lane's ace, and its doc (`docs/v3/oturum-f/windmane_knight.md`, rounds 1–2) moved it to `--class ace`. Its card test caps the bytes at 7 MB. I count `ace` as the right class. If the orchestrator wants `large`, the knight is 0.47 MB over.

### Gate 5 detail: changed camera keys and why
Absolute rules on all 132 scenarios: zoom 1 and no close-ups. No violation.

Gated keys (`focusCalls`, `closeUpCalls`, `maxScrollPx` ±1 frame) against the **old lane base** (`camera-base.pre-final.json`, 7 m1 keys, measured at 3eb974a). The offline `--camera-gate` gives 2 FAIL, both expected:
| key | change | cause |
|---|---|---|
| m1Shield | maxScrollPx 13 → 16 (lean destination (1,−12) → (−1,−14)) | expected: the placeholder rig was replaced by the real shield_titan rig |
| m1Imp | maxScrollPx 15 → 18 (lean (0,−13) → (0,−16)) | expected: the wisp_imp rig from main. **main 9eaae1f measures 18 too** (I measured it in a scratch worktree) |
| m1Knight | maxScrollPx 20 → 21 (within ±1, gate ok); unfocusCalls 3 → 2 | expected: the taller knight rig |

Against the **per-card bases** (`shots/v3/kart-f/<id>/camera-base*.json`):
- shield_titan (`camera-base-v2.json`, 23 keys): 0 FAIL. kdWallWeak has no gated change against v2. Its expected change (the wisp_imp rig) already happened before v2 was taken.
- windmane_knight, wing_lady: 0 FAIL.
- hourglass_imp (`camera-base.json`, a3092ae, the placeholder base from before the cinematics): **1 FAIL, ksGuard maxScrollPx 11 → 14** (lean destination (0,−10) → (0,−13), target y 150 → 138). **This change is not on the orchestrator's list, so I report it.** Cause: the attacker in ksGuard is `wisp_imp`. Every hourglass_imp measurement on a commit without the main merge `f4dad2c` (which brought the lane-B wisp_imp rig) reads 11: `measure-r2` at a3092ae and `measure-r4` at dcb8a96. Every measurement on a commit with it reads 14: `fix3` at 925a7de, `r3-integration` at 6b67968, `verify1` at 40aa1a3. It is the same mechanism as the expected m1Imp change, not lane F work. ksGuard was never in the lane base, so this rebase hides nothing there. It now enters the new base at 14.

Ungated keys that changed (report only):
- `unfocusCalls` dropped by 1 in many summon/effect scenarios (m1Aura, m1Freeze, kdSummon*, ksSummon*, ksFreeze*, ksNoTarget, fsCalm/Charge/Effect/Summon/Storm*, khSummon*, khEffect*). These are safety `unfocus()` calls guarded by `cameraAtRest()` (`src/cinematics/flow/_kit.ts:62`). On main, m1Aura/m1Freeze read unfocus 1. On HEAD they read 0, because the lane F cinematics consume the generic follow-up. m1Aura on main has events `[summon 2316, statChange 534]`; on HEAD it is `[summon 2933]`, with the aura statChange folded into wing_lady's summon. The camera is already at rest, so the safety unfocus does not fire. This is fewer camera moves, never more.
- `scrolledFrames` changes everywhere: these follow the new cinematic lengths. Not gated.
- focusCalls: unchanged against every base.

### Gate 6 detail (palcheck `--ref 4`, plus approved reference films under the identical check)
| film | result | worst | attribution |
|---|---|---|---|
| ksSummon | PASS | Δ +0.40, white 1.06 % | — |
| khAttack | PASS | Δ +0.83 | — |
| fsSummon | FAIL | Δ +2.04 at #39 (3 f); white 3.14 % / rowWhite 54.5 % at #101–103 | #39: the played card in flight plus the grave card (offdiff mask `pal/offdiff-4.png`). #101: the cut-in flash. Approved **gwSummon**: Δ +1.67 at #35 (card flight), white 2.97 % / rowWhite 53.3 % at #105 (cut-in). Same mechanism. |
| fsStormAtkP2 | FAIL | Δ +2.41 at #104–115 (12 f, off 4.2 %); white 3.35 % | The P2 cut-in title band (colour #070604 ×3024). Approved **gwSummonP2**: Δ **+2.70**, off 4.13 %, the same #070604 ×3069, white 3.17 %. fsSummonP2 is identical to fsStormAtkP2. The P1 knight cut-in stays at 0.8–0.9 %. Shared P2 cut-in path. |
| fsStormDies | FAIL | as fsSummon (+2.04, white 3.32 %) | same as fsSummon |
| khKill | FAIL | Δ +3.21 at #115 (26 f) | ember_wolf's own victory flare and glow at t 3.6–4.0 s. wing_lady has already left (`pal/khKill-zoom-3400.png`). Approved **hoKill** (ember_wolf kills hollow_ogre): Δ **+3.19 at #114, 26 f**. Same frames, same cause. |
| kdAttack | FAIL | Δ +1.80 at #74 (9 f) | the shared "−2000" damage number (crim2/crim3 tints) plus the battle log. Approved blocked attacks score worse: **tbBlocked** Δ +3.09 (16 f), **saTitanP2Blocked** Δ +3.29 (8 f). |
| sbSentinelDies (ref) | PASS | Δ +0.73 | — |
| gwAttack (ref) | PASS | Δ +0.72 | — |

`--ref 4` (t = 136) is not a settled pre-action frame in every film. In fsSummon and kdAttack the action has already started by frame 4. A frame-0 or later reference changes the Δ values but not the attributions above.

## Open points (not blocking)
1. ksGuard maxScrollPx 11 → 14 against the old hourglass per-card base. Explained above (wisp_imp rig from main). It is in the new lane base.
2. windmane_knight passes only as `--class ace` (5.47 MB > 5 MB large).
3. `tests/art/cloud_hatchling.test.ts` (not lane F) runs at 4.6–5.0 s against the 5 s vitest timeout and failed once under load. This flake will also hit main.
4. Palette Δoff, white and rowWhite failures come from shared systems: the P2 cut-in title, the card flight, the cut-in flash, the damage number and ember_wolf. The orchestrator owns these, if anyone does.
5. The pre-existing extra worktree `…/scratchpad/mainwt` (9eaae1f) was left untouched. My own temporary worktree was removed.
