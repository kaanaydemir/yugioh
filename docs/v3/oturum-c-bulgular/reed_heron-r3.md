# reed_heron — eleştiri r3: bulguları (verdict: fail)

Round-3 critique of reed_heron: verdict fail, with 3 majors and 7 minors. I filmed everything myself in /home/user/wt/reed_heron. Evidence is in shots/kartc/reed_heron/critic3/:
- sheets: sheet/ (P1 and P2, all anims) and big/ (×4)
- 33 ms frame dumps: fr-atk, fr-atk0, fr-sum, fr-kill
- 50 ms dumps: fr-rhrAttackP2, fr-rhrBlocked, fr-rhrDirect, fr-rhrGuard, fr-rhrHit, fr-rhrSummonP2
- zoomed grids: early-33, charge-33, triple-33, contact-z5, contact-1x, sum-z, sum-zz, sum-reveal17 (17 ms), sumP2-z, kill-z, atkP2-z, blk-z, dir-z, hit-z, grd-z, board-idle-z
- reference: ref-suWyrm
- clips with sound: clip/ (rhrAttack, rhrSummon, rhrKill, rhrBlocked, rhrGuard, plus solo-coil and solo-lock)
- the rest: sfx/probe.txt, same/sameness.txt, probe.txt plus probe-png/, cardart/

**Round-2 fixes I confirmed:**
- **No alpha in the summon:** the sprite is either fully absent or fully present.
- **Glide:** about 430 ms of game time for P1.
- **Piston triple:** three distinct points; the number lands on the third (tak3 at 1416 ms, the −900 at 1433 ms).
- **Silence is now audible:**
  - summon: −45 to −52 dB RMS from 1050 to 1400 ms, around the eye glint;
  - charge freeze: −45 dB from 462 to 627 ms.
- **The TAK has body:** tak3's loudest 50 ms is −10.9 dB (it was −16.4). Peaks are −2.0 dBFS with 0 clipped samples.
- **Sound pairs pulled apart:** slip vs back slip LSD 13.1 dB, guard vs wing fuff 11.7 dB.
- **Blocked:** "tak-tak-TING" with the beak deflecting up and the hop back reads well.
- **Death:**
  - the back-step is in the art (feet 38 → 32 px);
  - the mist covers him from the bottom up with tone steps;
  - only the reeds and one ripple ring remain (no cyan; the ring is water/night tones);
  - the frogs return at 3383 ms.
- **Sameness:** no U! against any real v3 art. The UYARIs are abyss_magus roar MOT 0.718 and stone_sentinel MOTloop 0.744. Every U! is against a placeholder (proxy) totem.
- **Banned SFX:** none audible.

**Still below the bar (the 3 majors):**
1. **Summon reveal:** the heron pops onto an almost empty tile. The fog never hides him, so "the mist parts and he is already there" does not read.
2. **Third TAK:** the owned contact mark cannot be seen at 1×, so the signature impact has less visual punch than before.
3. **On-screen contact gate fails:** rhrHit P2 is 118.9 %. The cause: the pond and reeds slide 4–5 px together with the knockback on every hit.

The minors are about timing, sound overlap and the card portrait; they are listed in the findings.

- **[major] Summon: mist-born reveal (golden rule + C8 checklist 'mist in … mist parts, already there')** — The alpha fade is gone, but the reveal is now a hard pop with no occluder.
- The 'fog' is 3–4 flat 2–3 px lenses (mist/steel) floating at feet, mid and eye height. Together they cover about 15 % of where the bird will stand.
- From 1309 to 1326 ms (17 ms film, sum-reveal17.png) the full white heron appears in one frame on a nearly empty tile.
- The low lenses then slide apart around his legs (1360–1518 ms), after he is already fully visible.
- At 1× the lenses read as floating pills or planks, not as a bank of marsh mist.
- P2 shows the same pop (sumP2-z.png, 1300 → 1350 ms).
- This is the card's entrance identity: 'the mist parts and he is simply there' only works if the mist was hiding him. As it stands it reads as a sprite pop, well below every best entrance (magus rift, wyrm prism shaft).
  - Düzeltme: Make the fog a real bank that occludes him, and reveal by occlusion, not by a pop. Edit summonFog() in src/cinematics/kartc/reed_heron.ts and paintWisp in reed_heron-mist.ts.
1. Stack 6–8 overlapping lenses, each 4–7 px tall, from the water line up to the crown (about 60 px). Stepped tones night4 → steel → mist, with 2×2 Bayer hems (no alpha), and a little wider than the bird's 38 px.
2. Draw the bank at a depth above the body.
3. Make the sprite visible behind the bank on the frame the glint goes out. On that frame at least 70 % of his opaque pixels must be under mist.
4. Part the bank down his centre line in 3 stepped moves over about 250 ms (3, 3 and 4 px, each half drifting outward), so the white plumage is uncovered band by band from the head down.
5. Let the roar downdraft blow the remaining halves out.
6. Verify with a 17 ms film: no frame may change more than about 40 % of the bird's pixels from fully hidden to visible.
- **[major] Attack: third-stab contact (the signature TAK)** — The shared EF-3 flash and burst are now hidden. The replacement 'Pinpoint' does not read at 1×.
- At tak3 (1416–1457 ms, contact-z5.png, contact-1x.png) all you see is a roughly 3-px white cross at the beak tip and 2–3 white nick pixels.
- The filled 6-px triangle lasts only 2 frames.
- The 'floor pool' lands at the target tile's front edge, about 35 px below the contact. It reads as a stray white/mist checker stripe (1424–1589 ms).
- A dark night-tone Bayer smudge also grows on the floor left of the target (1490–1721 ms) and reads as dirt.
- The target shows no visible 1-px give.
- Net result: the −900 number carries the impact on its own. The signature 'TAK' has less picture than the generic strikes, and is clearly below the aces' owned impacts.
  - Düzeltme: Keep it heron-owned and pinpoint, but make it readable at 1×. In Pinpoint.land() / tick() (reed_heron-fx.ts):
- Draw the three nicks as the triangle outline plus four 1-px white rays, 3–4 px long, from the third point.
- Hold that for 3 frames, then step the tones mist → steel → gone over about 200 ms.
- Add lightFlash/lightPool on the target core: radius about 10 px, white, about 120 ms. (The spec's 'small stepped white pool on the target' belongs on the target, not at the tile's front edge.)
- Give the target a drawn 1-px give on each thrust and 2 px on the third.
- Move the floor pool to directly under the contact point, projected onto the target's own floor y, or drop it.
- Remove or brighten the dark Bayer floor smudge.
- Check at 1× with contact-1x: the third stab must be visible without the number.
- **[major] Hit: on-screen contact gate (KK-4 / HA-21, Definition of Done: 'contact-probe 0 failing')** — contact-probe still fails: rhrHit, reed_heron P2, screen 118.9 % and page 117.1 % ('resting contacts failing: 1', critic3/probe.txt). The rhrKill death:0 is 117.5 % (excluded there).

I found the cause in the hit film (fr-rhrHit, colour tracking):
- On the contact frame the whole unit shifts.
- The pond's water1 pixels move from x 325–361 to 330–365 (+5 px) at 1650 ms, and only come back at 1900–1950 ms. The gold beak base moves the same way.
- The pond and reeds are part of the sprite frame, so the knockback drags the floor under him: every pixel changes and the pond visibly slides 5 px on each hit.
- KK-4 also requires the sprite to be at its rest position on the contact frame, with the knock starting on the next frame change.

The builder called this pre-existing. It is this card's own gate and has failed since round 1.
  - Düzeltme: Split the ground layer (pond, reeds, moon streak) from the body for reactions, the same way the strike already keeps 'the pond and reeds home':
- either draw the ground through the marsh aura / Ground object at the home tile and leave it out of the hit/hitHeavy/hitMagic/death textures;
- or set the unit's knockPx to 0 for this card and draw the 2–3 px give into the body pose (feet planted, body and neck only).

Also keep hit f0 local: head and neck react first, the body stays on its idle f0 pixels. Re-run `node tools/contact-probe.mjs --scenarios rhrHit,rhrKill --jobs 1` until it reports 'resting contacts failing: 0' with screen < 50 %.
- **[minor] Attack: charge freeze length and the declare overlap** — The dead freeze runs from about 462 to 660 ms of game time, roughly 200 ms (early-33.png, frame diffs). The spec's 200 scene ms is about 270 game ms.

The coil (297–429 ms) also plays under the shared cyan declare arc, and that arc is drawn straight across the heron's neck. On the sound side, the shared lockOn (pitch 1.3, peak −2.6 dBFS) is the loudest sound of the build-up (−9.7 dB RMS from 231 to 400 ms). The heron's own heronCoil is about −28.5 dB (solo-coil vs solo-lock clips), so the tension is not heard; you only hear the silence after the UI sound.
  - Düzeltme: Extend the f4 freeze so it lasts at least 270 ms of game time after the declare arc has fully faded (about 495 ms). Start the audible part of the coil swell after lockOn decays (≥ 430 ms) so the stop(20) cut into silence comes from the heron's own sound. Alternatively, start the visible coil after the arc clears.
- **[minor] Attack travel: P1 glide covers almost no ground** — For P1 against an adjacent target the body moves only about 12 px in 430 ms (the tail moves from x 264 to 276; fr-atk measurements). The legs stride wider than that, so it reads as shuffling in place, a foot-slide, rather than 'two long gliding strides'.

For P2 the same attack travels about 35 px and reads well (atkP2-z.png). The P2 return home in the direct attack covers about 60 px in about 100–150 ms (dir-z, 1750 → 1850 ms) and reads as a snap.
  - Düzeltme: For short distances:
- either shorten the drawn stride spread so foot travel matches body travel (no ice-skating);
- or add a set-back half-step during the coil, so the glide covers at least 20 px. A heron settles back before it strikes.

For the direct attack, give the backward glide at least 250 ms of game time, with the same mist trail.
- **[minor] SFX: death sounds and loudness balance** — Several heron sounds still sit too close together (sfx/probe.txt):
- heronWingClose vs heronBackSlip: LSD 5.1 dB, and in rhrKill they play 67 ms apart (1883 / 1950 ms), so they merge into one smear.
- heronMistIn vs heronBackSlip: 4.2 dB. heronMistIn vs heronWingClose: 4.6 dB.
- heronWingFuff vs heronTrail: 6.8 dB.

In the attack clip the shared lpDown UI sound is still louder over a 33 ms window than the signature tak3 (−10.8 vs −12.1 dB RMS), although tak3's peak is higher.
  - Düzeltme: Separate the death steps:
- Make the slip wet and short: noise bp 1.1 kHz → 700, decay 0.12, as specced.
- Make the wing close the hp-250 'fuff' pair with flutter.
- Space them at least 120 ms apart.
- Push the LSD of these pairs to at least 10 dB.

Duck lpDown by about 3 dB under the heron's contact (or delay it until the blade ring has decayed) so the TAK is the loudest event of the strike.
- **[minor] Card art (small portrait shown in game)** — The cardart-probe (critic3/cardart) gives subjectFill 0.79 for the small art and 0.77 for the big. Both are outside the §10 range of 0.60–0.75.

The small 44×34 portrait (the only one shown in game) is a strong head-and-beak close-up in a moonbeam. But it has none of the storyboard's 'sisli sazlık': no mist band and no reeds.
  - Düzeltme: Pull the subject in slightly, or open up negative space, to bring fill to 0.70–0.74. Add one stepped low mist band (steel/mist, 2–3 px, no dither) across the neck base and 2 reed tips in the backdrop, so the portrait carries the card's motif.
- **[minor] Board idle: ambient mist visibility** — At 1× on the board the ambient mist bands and the ankle mist are barely visible (board-idle-z.png). Only faint dark dashes cross the neighbouring floor; none can be seen over the pond. Most of the HA-18 liveliness and the 'mist' identity at rest comes from the reeds and ripples.
  - Düzeltme: Give the 2–3 drifting low bands one lit tone (mist) on their top edge. Keep one band crossing the heron's ankles over the pond, so the mist reads at rest without any alpha.
- **[minor] Sameness vs real v3 arts** — I found no U! against real arts. Two UYARIs worth a glance:
- abyss_magus roar MOT 0.718: the summon wing fan's motion envelope resembles the magus roar.
- stone_sentinel MOTloop 0.744.

All the KALIR-line rows (crag_axeman 0.865, scrap_raiders, cloud_hatchling, etc.) are against placeholder (proxy) totems and can be ignored until the lane-C merge run.
  - Düzeltme: Optional: offset the roar's peak timing (hold the open wings 120 ms as specced, with the 3-frame up/down), which lowers the magus overlap. Re-run sameness with the real lane-C arts after the merge.
- **[minor] Hit: knock also moves the reeds and pond in death f0** — rhrKill death:0 also shows the whole frame shifting (117.5 % screen in probe.txt; excluded from the gate). The reeds and pond are dragged by the shared kit's knock at the killing blow. The finale is otherwise good, ending on the reeds and one ring.
  - Düzeltme: The fix is the same as the HA-21 major: keep the ground layer (pond, reeds) fixed at the home tile under every knock.
