# Settle backlog — kill contacts the kit cannot fix (per-victim art)

Status 2026-11-06, after the lane-A kit work on `claude/kart-a`:
- `3269ea9`: the settle goal is narrowed to the struck pose that will actually play.
- `13ab3e2`: mark-less strikes report their contact time (`StrikeArgs.contactIn`), and contact-probe compares
  rest-loop holds against the tempo.
- `872c971`: contact estimates are readable at the declaration (`_v3/contact-estimate.ts`).

The settle stays gentle (±35 % of the idle pace, no parks / freezes).
Kill scenarios that now pass: pnKillP2, djKillP2, srKill, srKillP2, kfnKill. Probe: `node tools/contact-probe.mjs
--scenarios <keys>` (look v3, tempo 1.35). A contact passes when screen < 50 and screen ≤ page + 5, where:
- screen = the change on the contact frame (%);
- page = the struck f0 against idle f0 on the sheet (%);
- phase = screen − page (the excess).

## Still failing

| Scenario | Victim (side) | Lands on → struck | screen | page | phase | Frames that work (KK-4) | Best gentle reach | Fix |
|---|---|---|---|---|---|---|---|---|
| pnKill | polar_needle (P2) | idle:7 → death:0 | 43.4 | 34.0 | +9.4 | 0, 1, 11–14 | f11 ×1.23, in reach | kit follow-up (A) |
| pcKill | polar_coil (P2) | idle:8 → death:0 | 29.7 | 13.7 | +16.0 | 0 | f0 ×1.76, OUT | art (B) |
| pcKillP2 | polar_coil (P1) | idle:10 → death:0 | 37.8 | 13.8 | +24.0 | 0 | f0 ×1.48, in reach | kit follow-up (A) + art (B) |
| psKill | polar_sovereign (P2), struck by judgment_bolt | idle:10 → death:0 | 38.0 | 27.8 | +10.2 | 0, 17, 19 | f17 ×1.77, OUT | art (B), or a longer spell lead |
| djKill | dial_jester (P2) | idle:15 → death:0 | 14.8 | 4.3 | +10.6 | 0, 8 | f0 ×1.21, in reach | kit follow-up (A) |
| raKill | reflection_archer (P2) | idle:11 → death:0 | 24.9 | 0.2 | +24.8 | 0 | f0 ×1.52, edge | art (B) |
| raKillP2 | reflection_archer (P1) | idle:13 → death:0 | 22.0 | 0.1 | +21.8 | 0 | f0 ×1.36, edge | art (B) |
| caxKill | crag_axeman (P2), attacker crystal_wyrm (has a contact mark) | idle:7 → death:0 | 34.9 | 12.9 | +22.0 | 0 | f0 ×1.89, OUT | art (B) |
| adKill | ashen_drake (P2) | idle:9 → hit:0 | 31.7 | 18.6 | +13.2 | 0 | f0 ×2.37, OUT | art (B) |
| saWyrmAtk | abyss_magus (P2) | idle:7 → death:0 | 68.0 | 42.6 | +25.4 | 0 | f0 ×1.95, OUT | art (B); slice art, exempt (A3_MIMARI §10) |
| sbSentinelAtk | lumen_sprite (P2) | idle:5 → hit:0 | 140.2 | 128.1 | +12.0 | (none) | — | old art: struck poses not drawn from idle f0 (redraw) |
| kaVenomAtk | ember_wolf (P2) | idle:7 → hit:0 | 90.8 | 90.6 | +0.2 | (none) | — | old art (redraw) |

"Best gentle reach" is the probe's even loop speed from the declaration that puts a working frame on screen before
contact (×1.35 or less = within ±35 %).

## (A) Kit follow-up: the settle misses a target the probe says is reachable
pnKill, pcKillP2, djKill (and raKill / raKillP2 at the edge): the probe reports a working frame within ±35 %, but the
settle keeps the loop untouched (plan hold ×1, not a target). Likely causes, to check first:
- The settle's goal is measured on the sheet (`settleGoal`, every frame Δ against the struck f0, KK-4), while the probe
  measures on screen. They can disagree by a few points near the +5 line.
- The declaration's lead (233 ms + the estimate) may be shorter than the real contact time, so the plan aims early and
  the battle's exact re-plan has too little reach left.

A tighter estimate or a goal with a 1–2 point margin may tip these over without art changes.

## (B) Per-victim art: a working frame the loop can actually reach
Only idle f0 (and, for polar_needle / polar_sovereign / dial_jester, one or two more frames) continues into the
death / hit pose without a jump. With idle loops of 1.6–2.4 s, f0 comes round too rarely for a ±35 % steer within
the ~1.2–1.4 s from declaration to contact. Either fix works per card:
1. Draw 2–4 more idle frames near the struck pose's start (the breath plateau around f0, as crystal_wyrm's f10 does),
   so a working frame is never more than ~0.6 s away. Or redraw death f0 / hit f0 closer to the idle average, so more
   idle frames pass KK-4.
2. Shorten the idle loop (fewer / shorter holds) so f0 comes round more often. This weakens idle liveliness (HA-18),
   so prefer 1.

Priority (seen most in play): reflection_archer, polar_coil, crag_axeman, ashen_drake, then polar_needle (A first),
dial_jester (A first), polar_sovereign.
