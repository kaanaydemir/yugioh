# kite_fencer — eleştiri r3: bulguları (verdict: fail)

Critic round 3 for kite_fencer (commit 84f14b9): fail, with 0 blockers and 4 majors. All evidence was filmed and listened to in /home/user/wt/kite_fencer/shots/kartc/kite_fencer/critic3/.

**What I ran (and looked at every PNG):**
- P1 and P2 sheets for all 13 anims.
- monster-gates `--class small`: 24 rows, 21 ok, 0 FAIL.
- kfnSecond and kfnSecondP2, coarse (120 ms) and fine (33 ms then 17 ms, scale 3–5, clipped on the cut and the exit).
- kfnDouble, kfnAttack fine (40 ms), a 5× zoom on the indicator panel, kfnSummon (66 ms), kfnKill, kfnKillP2, kfnGuardDies, kfnGuard and kfnHit.
- sameness `--against all`: no KALIR. The UYARIs are all MOT-only and none are against storm_hawk or wisp_imp.
- sfx-probe on 15 card sounds against magusCall, wyrmRoar, slash, whoosh, hitCloth*, hitStoneHeavy.
- clip.mjs of kfnSecond: peak −1.6 dBFS, no clipping.
- A fresh cardart-probe render.
- measure on 15 kfn* scenarios: camera gate 0 FAIL, every damage number lands on its contact frame, kfnSecond ready 3017 and kfnSecondLoser 3100 (limit 3190).
- tests/art/kite_fencer and outcomes: pass.

**Round-2 fixes I could confirm:**
- The target's hit sound really is turned down at the cut: hitStoneHeavy plays at volume 0.2375 in the clip JSON.
- The swing no longer stops dead and yanks upward.
- The cut mark is now a level crescent.
- The summon's falling-kite sound is audible (loudest 50 ms −16.7 dB).
- P2 no longer ends standing inside the target.

**The 4 majors, in short:**
- **2nd-attack exit:** the fencer, with his cloak collapsed, still perches on top of the target's head for about 200 ms (P1 and P2). The return glide then crosses the target again with the rapier lying across it.
- **2nd-attack contact:** it is a tip-first diagonal poke down into the target's head. The spec asks for a low, horizontal sideways cut at body height, so it does not read as a cut, not a stab.
- **2nd-attack sound:** kfnCut is only 6.5 dB LSD from the generic `slash`, which storm_hawk (the nearest-kin card) and shade_assassin also use. The summon's falling-kite sound is a near copy of the kite's own hit sound.
- **Main death case:** the taut string and the snap are hidden under the attacker's effects. In P1 the cloak flies sideways behind the attacker's head before it rises.

**Still good:** the 1st attack (straight fleche, needle line, back-hops), the indicator panel, the summon's leaf-like fall, the blocked and guard reactions, the P2 relight, and the pixel discipline. Card art is passable but not the best. Distinctness from the other lane-C cards and from the existing monsters is OK on the numbers.

- **[major] VFX / 2nd attack exit (carry-through + glide home)** — After the cut, the carry-through arc only reaches contact +12 px. The cloak is already collapsed to a sliver, so the fencer reads as a tiny man standing on top of the golem's head. The return glide then re-crosses the target's silhouette. Partway through, his draw order flips from behind the target to in front of it. The rapier then lies horizontally across the target's body for about 90 ms, which reads as a second stab or a clipping error. This is the same family as round 2's P2 'sinks through the target' blocker: it is better (drawn behind, still moving) but still clearly below crystal_wyrm and coral_serpent, whose attackers never overlap the target after contact.
  - Düzeltme: In src/cinematics/kartc/kite_fencer.ts, size the carry-through from the target's live silhouette, not from contact +12. Make the apex at least 4 px above the target's top row (s.target bbox) and, for P1, at least 6 px past its far edge. Keep the cloak at least half open until the apex: show special f10's collapse only after the fencer has cleared the bbox. Route the return glide over the target's top: a two-segment path (apex → a point above the target's near edge → home) or a higher Bezier, so the screen-space path never enters the target bbox. Draw him behind the target only while he overlaps it, and never swap draw order mid-glide. During the glide use a tucked blade pose (rapier pointing up and back, like roar f6) so the blade never crosses the target. Re-film kfnSecond and kfnSecondP2 at 17 ms.
  - Kanıt: critic3/sec-cut.png 1415–1613 ms (P1: legs hidden behind the stone's head, torso above it, cloak sliver). critic3/sec-exit.png 1614–1665 ms (behind the target), 1682 ms (beside it), 1716–1801 ms (blade drawn across the stone face). critic3/sec2-fine.png 1447–1645 ms (P2 perched on the head twice, at 1480 and 1645). critic3/dbl.png 3500 ms (the same perch in kfnDouble).
- **[major] VFX / 2nd attack contact pose (spec C9 'lateral cut')** — The cut does not land at body height and is not horizontal. The pendulum's lowest point is at the target's head. In special f9 the rapier points diagonally down at about 45°, tip first, into the head (from the upper left for P1, the upper right for P2). The 'curved slit' is a small 8 px smile on the chest, below and apart from the blade path. The design sheet asks for 'lowest point beside the target at body height, rapier held low and horizontal … a lateral cut across the target's body, perpendicular to attack 1's axis, so it reads as a cut, not a stab'. As it stands, the moment reads as an overhead poke, and it shares attack 1's 'tip into the target' language.
  - Düzeltme: Lower the pendulum's lowest point to the target's body centre: target bbox mid-height, at least 4 px outside its near edge. Redraw special f8–f9 in kite_fencer-anims.ts / -rig.ts: f8 has the blade drawn back level at hip height, edge leading; f9 has it level and swept across, with the tip trailing along the arc's tangent, not pointing into the target. Put the cutSlit (kite_fencer-fx.ts) along the blade's sweep line: a 14–16 px 1-px crescent across the torso, plus earth4 fibre threads where the blade exits. Check that at 1× the blade and slit read as one horizontal swipe, at right angles to attack 1's needle line.
  - Kanıt: critic3/sheet/kite_fencer-v3-special.png f8–f9 (blade diagonal down, tip at the contact mark). critic3/sec-cut.png 1250–1382 ms. critic3/sec2-cut.png 1250–1382 ms (P2: blade into the head from the upper right; the slit is a separate small smile on the chest).
- **[major] SFX / identity (SE-4) — 2nd-attack cut and summon kite drift** — (1) kfnCut, the 2nd attack's signature contact sound, measures only 6.5 dB LSD from the shared generic `slash`. SE-4 requires at least 10 dB. `slash` is played by storm_hawk (the kite's named nearest-kin card), shade_assassin, thorn_lurker and src/vfx/combat.ts, so the card's most important sound sits in a generic, reused band. Its centroid is 4268 Hz, close to slash's 1.5→8 kHz band-pass sweep with partials at 3150/4420/5870 Hz. (2) The summon's falling-kite sound, kfnKiteDrift, is 3.4 dB LSD from kfnStruckHeavy and 3.9 from kfnStruck: the leaf-like fall sounds like the card being hit. kfnSwing is also only 4.8 from KiteDrift and 5.1 from StruckHeavy. The cloth family has collapsed into one sound across summon, swing and hit.
  - Düzeltme: In src/audio/v3/kite_fencer.ts:
- Re-voice kfnCut toward the design sheet's 'sşhk': a white band-pass sweeping DOWN 3.2→1.8 kHz over 90 ms (Q around 4), one short 4 kHz sine, and one fibre tick.
- Remove the octave-up airy edge and every partial above 5 kHz; that is exactly where it overlaps slash.
- Optionally add a 1-px 'cloth drag' (pink lp 2 kHz, 60 ms) so it is not a steel whoosh.
- Target: LSD ≥ 10 dB against slash and against every storm_hawk and shade_assassin strike sound, while keeping ≥ 12 dB against kfnTsst.
- For kfnKiteDrift, use the sheet's 3 × pink sweep [1200, 2200, 1400] d 0.24 airy whoosh with no struck-cloth body or flap transient, and aim for ≥ 8 dB LSD against kfnStruck and kfnStruckHeavy.
- Give kfnSwing its own rising-falling sweep shape ([400, 1600, 500]) so it lands ≥ 8 dB from both.
- Re-run sfx-probe with --against slash,whoosh plus the storm_hawk and shade_assassin sound names.
  - Kanıt: critic3/sfx/probe.json and critic3/sfx2 LSD matrix: kfnCut×slash 6.5, kfnKiteDrift×kfnStruckHeavy 3.4, kfnKiteDrift×kfnStruck 3.9, kfnSwing×kfnKiteDrift 4.8, kfnStruck×slash 8.2, kfnKiteDrift×slash 7.0. Usage: grep "'slash'" src → strikes-b/storm_hawk.ts, shade_assassin.ts, thorn_lurker.ts, vfx/combat.ts.
- **[major] VFX / death (kfnKill P1, the most common death case)** — The death's signature beats get lost when the kite is killed by a monster attacking from the right:
- f1–f2 (taut string, then the snap at about 1100–1183 ms) are completely covered by ember_wolf's bite and fire overlay. No taut line is visible at any frame.
- The torn cloak then drifts almost horizontally right at body height. It passes behind the wolf's head from 1347 to 1611 ms before it rises, so 'catches the wind and flies up and off screen' reads as the cloak bumping into the attacker.
- In kfnGuardDies, volt_lizard's lightning hides the taut string the same way.
- For P2 the cloak rises more steeply and reads better (killp2.png, gdies.png). P1 is the weak side.
  - Düzeltme: In the death cinematic (src/cinematics/kartc/kite_fencer.ts):
- Hold the taut beat until the attacker's contact overlay has cleared: start f1 at least 150 ms after the contact flash, inside the destroy budget (death today uses 1400 of 2030 ms). Alternatively, draw the taut string as a VFX object on the top layer above the attacker's effects, as a 1-px gold4/white line with a 1-px vibration, held for at least 2 frames.
- Launch the cloak steeply first: the first 150–200 ms at 60° or more from horizontal (up and slightly away from the attacker), then drift toward the top-right. Its path must clear the attacker's bbox by at least 6 px.
- Re-film kfnKill, kfnKillP2 and kfnGuardDies at 33 ms.
  - Kanıt: critic3/kill.png and critic3/kill-z.png 1050–1215 ms (the kite's body is under a gold/white checker jaw blob, no string visible) and 1347–1611 ms (the cloak behind the wolf's head at body height). critic3/gdies.png 1000–1360 ms (taut string hidden under the lightning). critic3/sheet/kite_fencer-v3-death.png f1–f2 (the taut and snap exist on the sheet but never read in game).
- **[minor] SFX / mix implementation (impactUnder)** — impactUnder() temporarily replaces the global sfx.play to scale the target's material hit (/^hit[A-Z]/, impactHeavy and impactLight) to 0.5 for the first attack and 0.25 for the second. It works today (hitStoneHeavy is at 0.2375 in the clip), but there are two problems. (1) It is a global monkeypatch on a shared contract object: if s.impact ever schedules its sound with a delay, the duck silently stops working. (2) SE-5 says 'the struck body plays'. Cutting the stone's material by about 12 dB makes a 2100-DEF golem sound weightless. crystal_wyrm wins the same moment by being louder (+6.6 dB over the stone hit), not by muting the target.
  - Düzeltme: Prefer raising kfnCut's own level and transient once it is re-voiced, with a milder duck of 0.5–0.6 so the target's material stays audible. If ducking stays, ask the orchestrator for an additive option on the shared impact call (e.g. a material-volume argument) instead of patching sfx.play.
  - Kanıt: src/cinematics/kartc/kite_fencer.ts:140–150 (impactUnder) and :132 (contactBed). critic3/clip/kfnSecond.json (hitStoneHeavy volume 0.2375 at 1266.7 ms).
- **[minor] Tempo / summon budget** — kfnSummon and kfnSummonP2 reach ready at 2617 game-ms. The normal summon limit is ≤ 1.8 s scene × 1.45 = 2610 ms, so this is 7 ms over. There is also a mostly static stretch of about 260 ms (1206–1470 ms) where the flat kite lies on the tile before the bump rises.
  - Düzeltme: Trim about 60 ms from the flat-lying hold. Start the bump rising sooner after the flop, or give the flat cloth a 1-px settle ripple across those frames so it is never static.
  - Kanıt: critic3/measure.log (kfnSummon ready 2617). critic3/sum.png frames 16–19.
- **[minor] Card art** — The big picture's subject covers only 19.6% of the window (cardart-probe subjectCover 0.196), leaving a lot of dark empty space at the bottom right. The legs are drawn in a striding fencing stance, while the brief is 'lifted, hanging under the kite, legs dangling', so at 1× the card reads as 'walking with a kite' rather than 'rising from his string'.
  - Düzeltme: In src/art/cardart-v3/kite_fencer.ts cardPose, lift him 4–6 px more. Use dangling legs (feet pointed, knees slightly bent, both trailing back) like special f6. Move the figure down and right so the open kite and figure fill at least 30% of the window. Keep the lit panel as the focus.
  - Kanıt: critic3/card/kite_fencer-big-x3.png and kite_fencer-small-x6.png. cardart-probe big {subjectCover 0.196, focusOk true}.
- **[minor] Signature indicator readability** — The lit panel reads at 5× zoom, but at 1× it is a roughly 3 px gold4 dot right next to the mask. I could not see the specified small gold4 pool (0.3) under that side of the body in any frame, so 'one attack left' is easy to miss on the 640×360 board.
  - Düzeltme: Make the stepped gold4 floor pool visible (2–3 px of stepped band under the leading side). Consider letting the whole leading panel brighten one tone (fire3→gold3 band) while lit, not only the 3×3 core.
  - Kanıt: critic3/panel.png 1500–2500 ms (the pulse is visible; no floor pool is visible).
- **[minor] Shared-file hygiene** — tests/presentation/outcomes.test.ts was changed from expect(read).toBe(3) to toBeGreaterThanOrEqual(3). That weakens a shared assertion, and other lane-C branches will likely edit the same line, which risks a merge conflict.
  - Düzeltme: Leave it as is, but tell the orchestrator so that one merge-time edit settles the final count, rather than five lanes each rewriting the line.
  - Kanıt: git diff 92e3a55 HEAD -- tests/presentation/outcomes.test.ts
