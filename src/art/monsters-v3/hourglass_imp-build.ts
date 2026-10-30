// Kum Saati Cücesi v3 — the BUILD on biped v1 (lithe preset): frame, proportions, materials, channels.
//
// A small pointy-hatted gnome-wizard carrying an oversized hourglass staff. Frame 68×64, anchor (26, 58):
// 1 art px = 1 game px; the figure is ~27 px tall without its hat (hat tip ~38), the staff 46 px.
// The staff is a PROP of the near hand (BipedPose.props.staff), the far hand is free (expressive hands).

import { restOf, type BipedBuild } from '../bodyplans/biped/v1';
import type { MaterialId } from '../materials';

export const FRAME = Object.freeze({ w: 68, h: 64, anchor: [26, 58] as const });

export const BUILD: BipedBuild = Object.freeze({
  root: [26, 58] as const,
  preset: 'lithe' as const,
  height: 27,
  shoulder: 7,
  hip: 5,
  arm: [5.2, 5.4] as const,
  leg: [4.5, 4.5] as const,
  stance: 9,
  hunch: 0.06,
  headSink: 3,
  lower: 'skirt' as const,
  farArm: 'free' as const,
  lead: 'near' as const,
  pelvis: 9,
  head: 12,
  spine: 0.05,
  stanceAt: 0,
  hipAt: 0,
  ankle: 2,
  farRise: 0.5,
  hands: { N: [8, -3] as const, F: [0, 0] as const },
});

export const REST = restOf(BUILD);

/** Roles → materials (A3_MIMARI §5). The painters tone their own planes; the roles only name the families. */
export const MATERIALS: Readonly<Record<string, MaterialId>> = Object.freeze({ sky: 'water', gold: 'runeGold' });

/**
 * The member's own channels (neutral values), all px / 0…1 numbers keyed by hand:
 *   sand     the phase (0…1) of the falling grains in the lower bulb and the stream (a loop of 1)
 *   level    how full the upper bulb is (0…1) — the glass is never empty: a magic glass refills as it falls
 *   freeze   0 flowing … 1 frozen mid-fall: the stream and grains hold still, white-sparkled (the cast)
 *   glow     the hourglass's light: 0 dull … 1 lit … 2 blazing (halo ring of the frame, sand brightness)
 *   eye      the eye's light 0 shut … 1 open … 2 wide glowing
 *   mouth    0 closed … 1 open … 2 shouting
 *   brow     −1 furrowed … 0 neutral … +1 raised
 *   hatX hatY   px the hat's bent tip sits off its rest place (the tip lags the head)
 *   beardX beardY px the beard's tip sits off its rest place
 *   hemX     px the robe's hem teeth sway (x)
 *   staffX staffY px the staff's head sits off the staff line (the glass lags the shaft)
 *   shine    the single glint of an anim 0…1 (IŞ-8)
 *   dust     a small puff of dust at the heels: 0 none, else its phase
 *   spark    gold sparks around the glass (cast / roar): 0 none, else phase
 *   diss     the sand dissolve of death: 0 whole … 1 gone (post pass)
 *   build    the summon / revive gather: 0 none … 1 whole (grains fly in)
 *   ring     a gold ring of grains around the staff head (cast): 0 none, else its radius phase
 *   flipA    the glass's own turn (0 upright · 0.25 on its side · 0.5 upside down · 0.75 the other side · 1 upright)
 *   plant    1 the staff's foot stands on the floor (its length follows the hand) · 0 it is carried (a fixed 12 px under the hand)
 *   spray    the grains thrown from the far hand / the glass (attack, special): 0 none … 1 spent (their flight phase)
 *   sprayAt  where they leave: 0 the far hand · 1 the glass
 *   muz      where points().muzzle sits: 0 the glass · 1 the far hand
 *   fingN fingF  the hands' finger word: 0 relaxed (per grip) · 1 point · 2 spread · 3 pinch
 */
export interface ImpFx extends Record<string, number> {
  sand: number;
  level: number;
  freeze: number;
  glow: number;
  eye: number;
  mouth: number;
  brow: number;
  hatX: number;
  hatY: number;
  beardX: number;
  beardY: number;
  hemX: number;
  staffX: number;
  staffY: number;
  shine: number;
  dust: number;
  spark: number;
  diss: number;
  build: number;
  ring: number;
  flipA: number;
  fingN: number;
  fingF: number;
  plant: number;
  spray: number;
  sprayAt: number;
  muz: number;
}

export const FX: ImpFx = Object.freeze({ sand: 0, level: 0.62, freeze: 0, glow: 1, eye: 1, mouth: 0, brow: 0, hatX: 0, hatY: 0, beardX: 0, beardY: 0, hemX: 0, staffX: 0, staffY: 0, shine: 0, dust: 0, spark: 0, diss: 0, build: 1, ring: 0, flipA: 0, fingN: 0, fingF: 0, plant: 1, spray: 0, sprayAt: 0, muz: 0 }) as ImpFx;
