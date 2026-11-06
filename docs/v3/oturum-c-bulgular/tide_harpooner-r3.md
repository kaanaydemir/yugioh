# tide_harpooner — eleştiri r3: bulguları (verdict: fail)

Critic round 3 for tide_harpooner: fail, with 0 blockers, 3 majors and 13 minors. I filmed everything myself in /home/user/wt/tide_harpooner, and the evidence is in shots/kartc/tide_harpooner/critic3/. That covers:
- P1 and P2 sheets (sheet/);
- attack at 66 ms, plus the contact at 33 ms ×3 and ×5 (attack-contact.png, attack-contact5.png);
- P2 attack and its contact zoom, plus a volt_lizard contact;
- blocked, direct and the LP-panel zoom;
- summon: wide, tide zoom, cut-in and roar zoom;
- kill, the kill zoom and the splinter;
- hit and guard;
- the Bay raise (wide and ×3 zoom) and the shroud deflect at 33 ms ×3;
- for reference, crystal_wyrm's attack and cut-in and coral_serpent's attack and summon.

Other checks I ran:
- 6 clip.mjs sets (MP4/WAV/JSON) in critic3/clip;
- a 23-sound sfx-probe with an LSD matrix (critic3/sfx), plus a struck-material probe (sfx-mat);
- sameness --against all;
- monster-gates (ace, --ref none): 21 ok / 0 FAIL.

What holds:
- No KALIR against any real v3 art.
- The struck shell keeps ≥ 14 dB LSD (SE-5) from stone and cloth.
- Peaks are −1.9 to −2.3 dBFS, with no clipping.
- The round-2 puncture redesign really landed when there is distance. On P2 the head lobs into the helmet and the jet exits low-left. On volt_lizard the grey tip clearly shows past the gold back, with the exit spray up-right.
- The twirl, the tail-first reel, the claw-door guard, the sand-burial death and the splinter all read well.
- The wave wall, the curl/skid and the KORUNUYOR plate are all present.
- whoosh and impactHeavy are swapped out of the cut-in. The remaining cutIn, cardSlam and summonBurst are the same shared stingers crystal_wyrm uses.

What still fails:
- **Shared impact visuals own the follow-through.** At the signature contact the most visible thing is still the shared kit: the white egg-shaped flash, then a 25–45 px ring with a dither fill that lasts through the haul. It is the same ring crystal_wyrm's contact shows. The card's own entry and exit marks are 3–6 px.
- **The main case reads as a poke.** In the default same-column P1 case (thpAttack against stone_sentinel) the throw is a ~12 px stab, and the grey head over grey stone barely reads at 1×.
- **The attack mix has no build or peak.** The twirl (the card's rhythm word) is nearly silent and fades from −19 to −27 dB. The contact is only ~2 dB above the release, the haul and the target's death sounds. By comparison the wyrm's impact sits at −7.6 and the magus's at −6.8.

The minors cover:
- the death hidden under the shared damage number;
- the flat tide sheet in the summon;
- a subtle Bay raise and deflect;
- the corner stake on the LP panel;
- cut-in art details (no spiral, a grid of squares on the carapace);
- a small card art that drops the conch;
- several same-card LSD collisions under 5.5 dB;
- splinter close to impactHeavy (6.5 dB);
- quiet deflect and splinter sounds;
- the fragile global sfx.play monkeypatching.

I could not film the other lane-C cards, because only their placeholders exist in this tree. A cross-lane sameness run is still needed after the merge.

- **[major] VFX / distinctness: the puncture contact (thpAttack, thpAttackP2, thpAttackVolt)** — Shared kit visuals own the signature contact and the pull. On the contact frame (thpAttack 1253 ms) the shared EF-3 flash paints a large pale egg (~16×28 px, light dither edge) over the shield, exactly where the head goes in. From +160 ms to ~+500 ms (1418–1750 ms) the shared react-kit impact burst then draws a 25–45 px thin ring with a dark Bayer-dither fill around the entry. It lasts through haul 1 and is the biggest element on screen while the rope pulls. It is the same ring crystal_wyrm's contact shows (tinted orange there, blue here from the preset accent 'water'), and the same happens on P2 and on volt_lizard. The card's own marks are tiny by comparison: entryMark is 3 px of ink plus 3 water4 px for 2 frames, and exitBurst is 2–8 px for 4 frames. The golden rule ('no generic or reused presentation for a signature moment') fails at the card's most important beat.
  - Düzeltme: In ownContact (tide_harpooner-fx.ts ~l.352), also sweep the react-kit impact-burst objects created on the contact frame, identified by depth/type the same way bolt and clang already are. If the material spark must stay (YENI_KARTLAR §5), cap it at 1–2 frames and ≤ 8 px. Replace the ring with card-owned art:
- Entry: a 5–7 px wet rosette at the entry point (an ink notch + 4 water4/white flecks pulled back ALONG the rope toward the crab for 3 frames).
- Exit: lengthen to 8–12 px streaks over 6 frames, with 2 droplets that land as wet dots on the floor.
- Pull: on haul 1, add a 1-frame 'water wring' along the taut rope (2–3 white beads squeezed off the line).
The readable story is then 'in – through – out – pulled', all in the card's own pixels.
  - Kanıt: critic3/attack-contact5.png f1 (1253 ms egg flash), f6–f9 (ring + dither); critic3/attack-contact.png #9–#18; critic3/attackVolt-contact.png #8–#17 (blue ring ~40 px); critic3/attackP2-contact.png #8–#13; reference critic3/wyrm-atk.png #18–#20 (same ring on the wyrm's contact).
- **[major] VFX: the throw in the main same-column case (thpAttack, P1 vs stone_sentinel)** — On the 5-zone board the P1 harpoon already rests against the target's shield (claw-to-shield gap ≈ 0). The 'only monster that throws across the lane' therefore reads as a ~12 px poke out of the socket: 1153–1219 ms in attack-contact.png, where the head moves only a few px. The contact frame is then covered by the shared flash. Past the far side, the stone head (stone2–4) shows only as a few grey px on a grey stone helmet (attack-contact.png #5–#8), so the 'through' part does not read at 1× in this case. The puncture does read on P2 and on volt_lizard, so this is specific to the default P1 board case, which is the scenario the owner will see most.
  - Düzeltme: When point-blank (run − DART_LEN < 24 px), do not throw along the flat line. Release from the twirl's overhead 'top' pose (f9 muzzle, ~35–40 px above the claw) on a short steep lob that comes DOWN into the target's top/near edge, as the P2 throw already does into the helmet. That gives ≥ 30 px of visible flight and a clear arc. Two more fixes:
- Readability on stone targets: give the stone head a 1-px ink outline plus the white glint on the frames where it pokes out past a silhouette, and hold the protruding tip ≥ 3 rendered frames before the haul.
- Keep the 9 px past the far edge, but make sure at least 4 px of it clears the silhouette's opaque mask (the current far-edge trace ends inside the sentinel's raised shoulder).
  - Kanıt: critic3/attack.png #17–#19 (1122–1254 ms, no visible flight); critic3/attack-contact.png #0–#8; critic3/attack-contact5.png f0 (head already touching the shield); compare critic3/attackP2-contact.png and attackVolt-contact.png, where the flight and the exit read.
- **[major] SFX: attack dynamics (thpAttack clip, in context)** — Measured in critic3/clip/thpAttack.wav (50 ms RMS windows):
- The twirl, the card's rhythm word, is close to silent. harpSwish passes at 416/550/683/816 ms reach −18.6 / −25.5 / −27.5 / −27.2 dB, so they FADE instead of building toward the release, and the bed between them sits at −25 dB.
- The contact (−10.2 dB, the overall loudest window at −9.9) is barely above the release (−12.4), haul 1 (−12.0) and the target's own dissolve/burst (−11.2). For comparison, the crystal_wyrm impact is −7.6 and the abyss_magus −6.8.
- Raw probe: harpTwirl loudest50ms is −23.7 dB, against the sheet's sweeps at −16 dB.
Result: no crescendo and no punch, and the rhythm 'twirl – throw – haul' is not audible.
  - Düzeltme: Twirl: raise harpSwish by ~6 dB and make each pass climb (+1.5 dB and +8 % pitch per pass, the last pass the loudest), keeping the pan swing L↔R. Bring the rope-tension triangle (196→233 Hz with flutter) up to about −24 dB in context so it is heard under the passes. Contact: give harpWetTok a stronger low transient (thump 180→90 Hz, drive 1.6, +3 dB) so it lands 3–4 dB above everything else, and duck the release tail and the lpTick run under it. Haul 1 then stays ~3 dB under the contact. Target in context: twirl passes −16 → −13 dB, release −12, contact −7 to −8, haul −11.
  - Kanıt: critic3/clip/thpAttack.{wav,json,mp4}; window table in this review: 400–1050 ms between −18.6 and −27.5 dB, contact 1250 ms −10.2 dB; critic2/clip/ref-saWyrmAtk.wav impact −7.6 dB; critic3/sfx.log harpTwirl loudest50ms −23.7 dB.
- **[minor] VFX: death readability (thpKill, P2 harpooner killed by crystal_wyrm)** — The shared −1100 damage number sits right on top of the dying harpooner from 950 to ~2700 ms. It covers 60–80 % of the retract, roll and sink beats (1150–1950 ms), so in the main kill case the card's unique sand burial is mostly hidden. This is a shared-kit placement problem, but the result is that this card's death is not seen.
  - Düzeltme: Flag to the orchestrator: number placement for kills should offset above or aside the dying unit. On the card side, start the visible roll/sink 150–250 ms later, or play the wet-sand sheet wider than the tile so the burial reads around the number.
  - Kanıt: critic3/kill-zoom.png #0–#22; critic3/kill.png #14–#35.
- **[minor] VFX: summon tide sheet** — The tide is a hard-edged blue diamond with exactly the tile's outline, plus a dithered halo (1480–1830 ms). It reads as a highlighted tile rather than a thin sheet of water sliding in from the back-left with a white leading edge. The recession is a straight edge. Next to coral_serpent's whirlpool and geyser entrance this beat is flat.
  - Düzeltme: Paint the sheet as an irregular, scalloped front: a 1–2 px white/water4 foam lace that advances in steps from the back-left corner, with uneven tongues and the tile still visible through a water2/water3 band pattern. Recede with a wet earth sheen line and 2–3 foam beads left stranded on the edge. Keep it inside the tile, never spiralling.
  - Kanıt: critic3/summon-tide.png #2–#11; critic3/summon.png #12–#16; compare critic3/coral-su.png.
- **[minor] VFX: Bay raise and aura (thpBayOn)** — The special anim (2380–2780 ms) barely moves: the re-plant and the claw raise are hard to see. The wall then rises as a 2–4 px blue ellipse that reads at 1× as a thin ring around the tile, and the shared green +400 outline that follows at 3580 ms dominates the moment. It meets the spec numerically, but this is the card's signature effect and it does not stun.
  - Düzeltme: Make the special anim's plant land with a sand spray and a 1-frame nacre brightening (white band on the lip). At the wall's 4 px peak, throw 3–4 foam spray flecks off the crest. Let the crest's first lap leave a trailing white 3 px wake. Finish the raise before the +400 outline starts, or delay the outline by ~200 ms.
  - Kanıt: critic3/bayon-zoom.png #6–#23.
- **[minor] VFX: shroud deflect (thpShroud)** — The curl and skid happen in a ~10×8 px area at the ellipse's lower-right corner (1124–1223 ms). At 1× the KORUNUYOR plate carries the whole moment. The crab does not react at all: no eye-stalk swivel or claw.
  - Düzeltme: Have the eye stalks snap toward the reticle for 2 frames and the rope claw lift 1 px when the wall curls. Push the curl's full 10 px height for ≥ 2 frames with a white crest, and add 2 foam drops thrown along the skid direction.
  - Kanıt: critic3/shroud-zoom.png #4–#12.
- **[minor] VFX: direct stake (thpDirect)** — The harpoon sticks into the LOWER-LEFT CORNER of the LP panel's frame (1540 ms), mostly over the portrait. It is not 'in the LP panel', and the chips are 1-px specks. It reads as 'reached the panel' rather than 'staked into it'.
  - Düzeltme: Aim the tip 3–4 px inside the panel border, next to the LP digits. Draw a 1-px ink dent/crack in the border at the entry (HUD palette) that stays until the reel. Make 3–4 trim chips 2 px each.
  - Kanıt: critic3/direct-zoom.png #3–#13.
- **[minor] Art: cut-in** — The cut-in is improved, but two identity points are still weak:
- The conch is a stack of horizontal discs (beehive or turban) with no spiral suture, so the 'spiral house' does not read.
- The carapace face is a flat tan oval with two columns of tiny squares that read as buttons or a robot vest.
The motion is mostly the harpoon rising, and the face is static apart from the eye glow.
  - Düzeltme: Repaint the whorls as a stepped diagonal spiral: the suture seam runs down-right on each whorl in earth1, with flat bands. Replace the square grid with 2–3 carapace plates and the mouthparts. Add one 2-frame action: eye stalks bob forward on the slam, and the claw grip tightens with a 1-px squash as the tip crosses the band.
  - Kanıt: critic3/cutin-sheet.png, critic3/cutin-last.png; compare critic3/wyrm-cutin.png.
- **[minor] Art: small card art 44×34** — The hand-size crop shows only the eye stalks, a sliver of the lip and the harpoon head, with no conch at all. 'Spiral shell + mast' is lost, and cardart-probe reports focusOk=false. On the big art the harpoon stays inside the frame (spec: 'kareden taşar'), and brightOff is 38.5.
  - Düzeltme: Re-crop the small art to include the shell's top whorls plus the harpoon tip. Make the harpoon tip clearly the brightest point: the white glint at 1 px, with the nacre one step darker. On the big art, let the harpoon run off the top-right edge.
  - Kanıt: critic3/card/tide_harpooner-small-x6.png, tide_harpooner-big-x3.png; cardart-probe output.
- **[minor] SFX: same-card collisions (LSD)** — Several different roles sound alike (critic3/sfx.log LSD matrix):
- harpTang (blocked) vs harpStake (direct): 5.1 dB;
- harpGuard vs harpPlant: 4.7 dB;
- harpHeave (summon) vs harpStruckLight: 4.8 dB, and vs harpStruckHeavy: 5.0 dB;
- harpHaul vs harpStake: 5.6 dB, and vs harpStruckLight: 5.6 dB.
  - Düzeltme: Tang: add a fibrous rope 'boing' (triangle 247→196 Hz with flutter) so it is springy. Stake: keep it a dry, short wooden thock (bp 900 Hz) with no tonal tail. Heave: lean on brown-noise sand (lp 500) and drop the shell ring. Guard: keep the 1.2 kHz→500 Hz shuck plus the double clack; plant: thump plus wet squelch. Re-probe until each of these pairs is ≥ 10 dB.
  - Kanıt: critic3/sfx.log (LSD matrix), critic3/sfx/*.wav.
- **[minor] SFX: splinter close to the banned shared recipe** — harpSplinter vs impactHeavy LSD is 6.5 dB, so the death's last beat is spectrally close to a banned v1 shared impact. In context it is also quiet: −19.3 dB at 2783 ms, ~12 dB under the death's start.
  - Düzeltme: Make the splinter woody and dry: crack hp 1.8 kHz n 3 gap 15 ms plus a small 300 Hz knock and 2 ticks as the bits land, with no low thump body. Raise it ~5 dB.
  - Kanıt: critic3/sfx.log harpSplinter row; critic3/clip/thpKill.wav window table (splinter −19.3 dB).
- **[minor] SFX: deflect level** — In context the signature 'şlup' plus stamp peaks at −8.6 dBFS, with the loudest 400 ms at −26.4 dBFS, about 16 dB under the attack's contact. The card's signature effect is close to inaudible under game ambience.
  - Düzeltme: Raise harpShlup and harpStamp by ~5 dB (still UI level, no duck), and lengthen the conch hint to 0.2 s.
  - Kanıt: critic3/clip/thpShroud.log (levels line), thpShroud.json.
- **[minor] VFX: summon roar** — The 'conch sounds' beat is small: a single white blob over the apex (3200–3350 ms) that splits into three dots, and the crab barely rears. On the spin, the shaft at 3600–3650 ms extends ~25 px past the claw as a long flat bar.
  - Düzeltme: Rear the body 2 px with the claws wide and the eye stalks fully up for 3 frames. Vent 2–3 staggered 2-px vapour puffs that rise and stretch. Shorten the extended shaft on the horizontal spin frame, or draw it with a 2-px smear.
  - Kanıt: critic3/summon-roar.png #0–#9.
- **[minor] Code robustness: own files** — ownContact and cutinVoice replace the global sfx.play while active. ownContact also hides shared objects by matching exact depths (DEPTH.FX+3 with ADD blend, FX+0.1/0.2/0.3). Any sound another system plays during that window is swallowed or remapped (for example volt_lizard's discharge trigger, or another unit's sounds during the cut-in's 1600 ms), and any depth tweak in the shared kits breaks the sweep silently.
  - Düzeltme: Keep the monkeypatch window synchronous-only in ownContact (it already restores after stage). In cutinVoice, filter by name only for the known cut-in kit calls and restore at the cut-in slam rather than after up to 1600 ms. Add a test that asserts the swept object depths still exist in the shared kits.
  - Kanıt: src/cinematics/kartc/tide_harpooner-fx.ts l.352–395, l.439–459.
- **[minor] Distinctness: motion sameness (info)** — sameness --against all gives no KALIR versus real arts, but death MOT is 0.917 versus crystal_wyrm and 0.864 versus abyss_magus, and idle rhythm matches abyss_magus (1920/1920/1920 vs 1940/1940/1940). Lane-C mates could not be compared because only placeholders exist in this tree.
  - Düzeltme: Shift idle beat holds (for example, an 18-hold accent on f6/f12 bubbles) so the idle rhythm differs. Run the cross-lane sameness (--ids tide_harpooner,reed_heron,crag_axeman,kite_fencer,steppe_spiralhorn) after the merge, with particular attention to the rope versus C9's string.
  - Kanıt: critic3/same/sameness.txt.
