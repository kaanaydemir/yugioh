# Victim "park" before a blow — prototype (NOT applied; needs an owner decision)

Task (orchestrator, owner plan "(b)"): kit-level victim settle at contact, so kill contacts stop landing mid-idle when
the attacker has no 'contact' mark. Prototype in `park.patch` (src/cinematics/_v3/posematch.ts, battle/battle.ts,
battle/declare.ts). It is kept out of the source tree because it trades one rule for another (below).

## What it does
- The settle goal is narrowed to the struck pose that will actually play (read ahead in the batch: death for a kill,
  else the recoils). Before, a frame had to suit hit, hitHeavy, hitMagic AND death, which often left only idle f0.
- When the gentle settle (±35 % of the loop's pace) cannot reach a target frame, or the attacker has no 'contact'
  mark (only an estimate of when the blow leaves), the victim's idle loop hurries onto the nearest target frame
  (holds ≥ ×0.4, every frame still shown in order) and PARKS there until the struck pose starts (≤ 1.0 s past the
  estimate). Estimates out of reach are retried ×1.5 and ×2 later, because the park waits for the real blow anyway.

## Result (contact-probe, 14 kill scenarios + 3 controls; `probe-before.txt` vs `probe-after.txt`)
- Contacts PASS: pnKill, pnKillP2, djKill, djKillP2, raKill, raKillP2, srKill, srKillP2, caxKill, kfnKill (10/13;
  before: 0/13). Improved but still failing: pcKill / pcKillP2 (+16 / +24 → +11 / +11). Unchanged: psKill, adKill
  (ashen_drake), saWyrmAtk. Old-art controls (lumen_sprite, ember_wolf) unchanged (their struck poses are not drawn
  from idle f0, so no goal exists).
- BUT every parked contact now FAILS the probe's settle rule (A3 Y1b): idle holds must stay within ±35 % of nominal.
  Measured: hurry down to ×0.45 and holds up to ×6 (≈ 0.6 s on one idle frame).
- Film (`raKill`): the archer reaches idle f0 ≈ 550 ms into the scene and stands perfectly still for ≈ 650 ms while
  the attacker winds up and dashes in; the contact then lands cleanly. Reads as a braced, held breath — but it is a
  visibly frozen body, against the golden rule "nothing is ever static".

## Options for the owner
1. Apply as is, and change the probe's settle rule to allow parks (deliberate hold ≤ 1 s, hurry ≥ ×0.4).
2. Apply with a shorter park cap (e.g. ≤ 300 ms hold): fewer contacts pass, little visible freeze.
3. Keep only the narrowed goal (no park): within the ±35 % rule; passes the cases the gentle settle can reach
   (here: dj ×2, sr ×2, pnKillP2); the rest need per-card art (extra idle frames near the struck pose) or 'contact'
   marks on the attackers (the strike knows when its blow lands).
4. Per attacker: give mark-less strikes a real 'contact' time (e.g. the strike reports its flight time when it fires),
   so the existing gentle settle can aim exactly — the most natural result, more work in the strike kits.
