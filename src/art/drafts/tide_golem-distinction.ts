// Gelgit Golemi (tide_golem) — its distinction card and key-pose list, written in A3 (Y9, A3_MIMARI
// §4.2) BEFORE the golem is built (A4.3), so the third heavy biped is not squeezed into whatever space
// Magma Titanı and Taş Muhafız leave. TEXT ONLY: no art, no anims, nothing imports it yet. A4.3 builds
// the golem against it (`distinction: GOLEM_DISTINCTION`) and the sameness gate (§9.3: titan × golem
// KEY < 0.615, golem × sentinel KEY < 0.658, MOTsig / MOTloop / MOTavg / SI, RHYTHM different in
// attack and idle) measures the result.
//
// The three signatures, side by side (the v1 problem: all three rigs raised an arm above the head at
// f2–f4 and struck at the same 833 ms — the golem's v1 attack is that overhead double-fist slam):
//   Magma Titanı  ONE arm. Gathers SMALL and LOW: crouched, the near fist chambered at the hip, the
//                 far forearm forward; release = the front foot stomps a step forward and the whole
//                 mass DROPS into it (hips 3 px down, chest held back, boulders slammed down, the fist
//                 driving out of the turn at belly height, the far arm torn back behind the body), then
//                 the fist drives out LEVEL at chest height on contact (the A3 draft, attack f3 → f5 /
//                 f6; the draft is gone — A4.1 built the titan in monsters-v3/_magma_titan.ts, whose
//                 `distinction` card is the one to measure against: there the FAR lava fist punches
//                 after a stomp and a held drive, and the effect is a fireball from the parted chest).
//   Taş Muhafız   ONE arm + the shield. Reaches DOWN to its near foot and digs, tears a boulder from
//                 the floor and heaves it OVERHEAD (the tall vertical silhouette), then throws it on an
//                 arc (`throw`; monsters-v3/_stone_sentinel.ts, release f12).
//   Gelgit Golemi BOTH arms, together, WIDE then DOWN: the arms open sideways at shoulder height while
//                 the body rises on its spout (the widest, flattest silhouette of the three — never
//                 above the head), then both palms crash onto the floor in front of the foam ring and
//                 a wave rolls along the ground to the target (`slam`). No step: it has no legs; the
//                 spout column bends instead.
// Release poses (the frame KEY compares, A3 Y9 measured): titan = the lowest, most compact mass, one
// fist driving at belly height in front (joints: attack f5 handN 42.6,46.1, hip 39,61 → contact f6
// handN 60,42), the far hand torn back behind the torso (handF 41.3,44.2), the front foot planted a
// step ahead; sentinel = tall: near hand and rock overhead behind the helm (f12 handN 33,27.5, the
// rock 43,21.5), the shield planted; golem = both hands low and forward at floor level side by side,
// the barrel pitched over a bent spout, nothing behind, nothing overhead.
// Y9 comparison against the FINISHED sentinel and the titan draft (A3 Y9 part 2) changed four planned
// key poses that shared a beat with them: the idle (a sideways ±1 px body sway once a loop with a
// lagging mask = the sentinel's weight shift, which moves its hips ±1 px in x once a loop with the
// upper body a frame behind → now a vertical spout bob TWICE a loop), the attack charge (both fists
// down to the floor = the sentinel's dig, its hand at the floor by the near foot → now the palms
// gather on the water's surface at waist height), the roar peak (both arms UP in a V = the sentinel's
// fist to the sky → now both arms thrust FORWARD at chest height) and the guard (sinking 3 px into the
// ring = both other guards sink 2–3 px → now the spout swells and the barrel RISES behind the forearms).

import type { DistinctionCard } from '../bodyplans/types';

export const GOLEM_DISTINCTION: DistinctionCard = {
  silhouette:
    'no legs: the barrel body rises out of a water-spout column into a foam ring on the floor; the mask juts forward of the ' +
    'shoulders (headAt 6.5, hunch 0.1, headSink 1), short heavy arms (10 / 10) with big fists; 64×64 frame, the round mass ' +
    'sits HIGH over a narrow spout (titan: wide planted legs and a low mass; sentinel: an upright block on two feet)',
  rhythm:
    '"dalga" (wave): every move swings from the spout and ends in a decaying ripple — rise, hang at the crest, crash, wobble ' +
    '(overshoot ±2 → ±1 → 0 px over three beats); the gather is a quick rise and a LONG crest hold (holds ~100 / 100 / 200 ms ' +
    'and a 40 ms whip: charge → release ≈ 440 ms) where the titan escalates its holds (80 → 190, 570 ms) and the sentinel waits in long stills',
  idle:
    'the spout flows constantly on a SHORT period (a 4-frame texture cycle, ~360 ms, the foam ring turning 1 px a frame) and ' +
    'PUMPS: the barrel bobs up and down on it ±1 px TWICE a loop (one loop ≈ 2.2–2.4 s, quick up, slow settle — a buoy on a ' +
    'swell), the mask lags the body 2 frames, the short arms hang still and drops fall from the fists; no sideways sway. ' +
    'Leads from the BOTTOM up (spout → body → mask). Titan: one vertical chest heave a loop led by the core (hips still), ' +
    '1.97 s; sentinel: one sideways weight shift a loop (hips ±1 px x over planted feet), rune / eye-slit pulse, 1.68 s',
  guard:
    'a curved wall of water: both forearms raised side by side in front of the barrel (vertical, not crossed), the spout ' +
    'SWELLS so the barrel RISES 2 px behind them (the other two heavies sink 2–3 px into their guards), the mask peeking over ' +
    'the forearms; the water barrier spins round the body (v1 kept); the bob stops and the spout flow doubles its speed (the ' +
    'loop is the barrier and the water, the body nearly still). Titan: an X-block of crossed forearms at the chest with a ' +
    'crouch and one slow banked breath; sentinel: hunkered into the planted tower shield',
  signaturePart: 'the water-spout column and its foam ring (the "legs"), and the carved mask pushed forward of the barrel',
  material:
    'water (inner currents, flowing light bands) for the spout, the foam and the thrown water; carved stone rings banding ' +
    'the barrel; coral growth on the shoulders (A4.3 adds water / coral to the material library)',
  signatureMove:
    '"Dalga Darbesi": a TWO-arm wave crash (`slam`) — arms open WIDE sideways at shoulder height (never above the head) while ' +
    'the body rises on the spout, a crest hold, then both palms crash onto the floor in front together and a wave rolls along ' +
    'the ground to the target, breaking in foam; the golem does not travel. Counter-effect in defence: an arm-thrown water ' +
    'ball back at the attacker ("−300"). Never one-armed, never a step, never overhead, never reaching down before the ' +
    'rise (titan: one-arm lunge punch out of a low drop; sentinel: digs at its foot, heaves a boulder overhead and throws it)',
};

/** One key pose of the golem's A4.3 anims, as text: when (frame role), what the body does, and how it stays apart. */
export interface GolemKeyPose {
  readonly beat: string;
  readonly ms: number;
  readonly pose: string;
  readonly notLike?: string;
}

/** The golem's attack / roar / idle key poses (A3_MIMARI §14 Y9: written now, built in A4.3). */
export const GOLEM_KEY_POSES: Readonly<Record<'attack' | 'roar' | 'idle', readonly GolemKeyPose[]>> = {
  attack: [
    { beat: 'charge', ms: 100, pose: 'the spout draws in (body −1 px), both forearms come together in front of the barrel, palms down ON the water\'s surface at waist height, gathering it (never down to the floor); mask down', notLike: 'titan charge: one fist pulled back to the hip, far arm forward; sentinel charge: one hand down to the floor by its near foot, digging' },
    { beat: 'coil', ms: 100, pose: 'the body rises on a lengthening spout (+2 px); both arms sweep OUT sideways at waist height, water lifting off the ring', notLike: 'sentinel: reaching down for a boulder with one hand' },
    { beat: 'coil (crest)', ms: 200, pose: 'the crest hold: arms wide open at SHOULDER height (the widest silhouette, fists level with the mask, never above it), body +3 px, chest open, mask tilted up 1 px, foam ring swollen', notLike: 'sentinel heave: both hands above the head; titan full wind: compact crouch, fist low' },
    { beat: 'swing', ms: 40, pose: 'both arms whip forward and DOWN together, the spout bending forward; smear on both forearms', notLike: 'titan swing: front foot in the air, one fist starting level' },
    { beat: 'release', ms: 60, pose: 'both palms crash onto the floor in front of the foam ring side by side; body pitched forward over a bent spout and squashed into the ring (−2 px); mask forward and low; the ground wave departs from between the palms', notLike: 'titan release: a compact drop on a stomp step, one fist at belly height, the other arm behind the body; sentinel release: tall, the rock leaving the hand overhead' },
    { beat: 'contact', ms: 80, pose: 'the wave reaches the target and breaks in foam (ranged); the golem holds the crash pose, the spout still bent', notLike: 'titan contact: full arm extension, burst at the knuckles' },
    { beat: 'recover', ms: 110, pose: 'the barrel rebounds up (+2 overshoot), arms rising off the floor, mask late' },
    { beat: 'settle ×3', ms: 360, pose: 'decaying ripple: body −1, +1, 0 over 100 / 120 / 140 ms; arms swing back to rest with the far fist last' },
  ],
  roar: [
    { beat: 'charge', ms: 120, pose: 'the spout sinks (body −2 px), arms curled in front of the barrel, mask down; the foam ring stills', notLike: 'titan roar coil: arms curled in, core dimming — the golem sinks INTO its ring instead of crouching on legs' },
    { beat: 'rise', ms: 140, pose: 'the body rises tall on the spout column (+4 px, the tallest frame of any anim), arms opening', notLike: 'sentinel roar: the shield driven into the ground, rock spikes' },
    { beat: 'release', ms: 110, pose: 'both arms thrust FORWARD together at chest height, palms open (pushing a surge), the barrel tall on the spout, a wall of spray bursts forward out of the foam ring, mask forward (never above the head)', notLike: 'titan roar: chest thrust out, arms flung DOWN and back, vents erupting; sentinel roar: shield wrenched up and slammed down, then one fist to the sky' },
    { beat: 'peak / follow', ms: 200, pose: 'held push, the surge falling back as spray; the barrel wobbles 1 px' },
    { beat: 'settle', ms: 240, pose: 'the spout shortens back to rest in two decaying ripples; arms fall to the sides last' },
  ],
  idle: [
    { beat: 'f0 (reference)', ms: 140, pose: 'v1 idle f0 pose (IoU gate ≥ 0.95): body centred on the spout, near fist low, far fist raised in the brawler guard' },
    { beat: 'surge 1', ms: 100, pose: 'the spout pumps: the barrel rises 1 px (quick), the spout column lengthening a frame EARLIER (it leads), the mask 2 frames late' },
    { beat: 'settle 1', ms: 160, pose: 'the barrel sinks back to rest and 1 px below it (slow, held longest at the bottom); drops fall from the fists; the foam ring keeps turning' },
    { beat: 'surge 2', ms: 100, pose: 'the second pump of the loop (two a loop): up 1 px again, the mask following 2 frames late' },
    { beat: 'settle 2', ms: 160, pose: 'down and held; the spout texture has cycled ~6 times over the loop (its own short period)', notLike: 'titan idle: ONE vertical chest heave a loop led by the core (hips still), 1.97 s; sentinel idle: ONE sideways weight shift a loop (hips ±1 px x, upper body a frame behind), 1.68 s' },
  ],
};
