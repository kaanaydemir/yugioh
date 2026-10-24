// v3 lane kill-switches — docs/v3/A5_PLAN.md and docs/v3/A6_PLAN.md §5.0.3 (contracts S-5, S-7).
// Written in A56.0 and FROZEN: changes only through the orchestrator.
//
// The A5 / A6 work runs in four parallel lanes. Each lane's new behaviour hangs on its OWN flag;
// LOOK_V3 alone turns nothing of A5 / A6 on, and in v1 every flag is false:
//   V3_A5_A  lane A5-A — spell / trap scenes + their sounds
//   V3_A5_B  lane A5-B — card faces + entrances (its card textures: V3_CARDS)
//   V3_A6_A  lane A6-A — card object, hand, piles, graveyard panel, UI sounds
//   V3_A6_B  lane A6-B — HUD, flow, plates, targeting, feedback, opening
//
// QA switches (URL only, never in a menu; read once at module init, like the look):
//   &a5=off|a|b   A5 lanes: none / only A5-A / only A5-B      (absent = both on)
//   &a6=off|a|b   A6 lanes: none / only A6-A / only A6-B      (absent = both on)
//   &cards=v1     V3_A5_B stays on but its card textures are the old ones (V3_CARDS false)
// Tests: globalThis.__NEON_V3FLAGS = { a5, a6, cards } (same values) before this module loads; it
// wins over the URL. The look itself comes from layout.ts (globalThis.__NEON_LOOK / ?look=v3).
//
//   import { V3_A6_A } from '../view/v3flags';
//   if (V3_A6_A) V3HOOKS.draw = drawV3;            // a lane registers its v3 body (v1: never)

import { LOOK_V3 } from './layout';

/** One lane pair's URL switch, as given ('' / null = absent). */
export type LaneSwitch = string | null | undefined;

export interface V3FlagInput {
  /** The v3 look is on (layout.ts LOOK_V3). */
  look: boolean;
  /** &a5= */
  a5?: LaneSwitch;
  /** &a6= */
  a6?: LaneSwitch;
  /** &cards= */
  cards?: LaneSwitch;
}

export interface V3Flags {
  a5a: boolean;
  a5b: boolean;
  a6a: boolean;
  a6b: boolean;
  /** A5-B's card textures are in use (a5b and not &cards=v1). */
  cards: boolean;
}

/**
 * Which lanes of one plan a switch value turns on: absent / 'on' / 'all' / 'ab' → both, 'off' /
 * 'none' → neither, 'a' → only lane A, 'b' → only lane B. Any other value counts as absent (both).
 */
export function laneSwitch(v: LaneSwitch): { a: boolean; b: boolean } {
  const s = (v ?? '').trim().toLowerCase();
  if (s === 'off' || s === 'none' || s === '0') return { a: false, b: false };
  if (s === 'a') return { a: true, b: false };
  if (s === 'b') return { a: false, b: true };
  return { a: true, b: true };
}

/** The four lane flags + V3_CARDS for a look and its QA switches (pure; the constants below use it). */
export function resolveV3Flags(i: V3FlagInput): V3Flags {
  if (!i.look) return { a5a: false, a5b: false, a6a: false, a6b: false, cards: false };
  const a5 = laneSwitch(i.a5);
  const a6 = laneSwitch(i.a6);
  const cardsV1 = (i.cards ?? '').trim().toLowerCase() === 'v1';
  return { a5a: a5.a, a5b: a5.b, a6a: a6.a, a6b: a6.b, cards: a5.b && !cardsV1 };
}

function detect(): V3FlagInput {
  const input: V3FlagInput = { look: LOOK_V3, a5: null, a6: null, cards: null };
  try {
    if (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined') {
      const p = new URLSearchParams(location.search);
      input.a5 = p.get('a5');
      input.a6 = p.get('a6');
      input.cards = p.get('cards');
    }
  } catch {
    /* no location (tests, workers) */
  }
  try {
    const g = (globalThis as { __NEON_V3FLAGS?: { a5?: LaneSwitch; a6?: LaneSwitch; cards?: LaneSwitch } }).__NEON_V3FLAGS;
    if (g && typeof g === 'object') {
      if (g.a5 !== undefined) input.a5 = g.a5;
      if (g.a6 !== undefined) input.a6 = g.a6;
      if (g.cards !== undefined) input.cards = g.cards;
    }
  } catch {
    /* ignore */
  }
  return input;
}

/** The lane flags of this page (decided once at module init). */
export const V3_FLAGS: Readonly<V3Flags> = Object.freeze(resolveV3Flags(detect()));

/** Lane A5-A (spell / trap scenes + sounds) is on. */
export const V3_A5_A: boolean = V3_FLAGS.a5a;
/** Lane A5-B (card faces + entrances) is on. */
export const V3_A5_B: boolean = V3_FLAGS.a5b;
/** Lane A6-A (card object, hand, piles, graveyard panel, UI sounds) is on. */
export const V3_A6_A: boolean = V3_FLAGS.a6a;
/** Lane A6-B (HUD, flow, plates, targeting, feedback, opening) is on. */
export const V3_A6_B: boolean = V3_FLAGS.a6b;
/** A5-B's card textures are in use (V3_A5_B and no &cards=v1). */
export const V3_CARDS: boolean = V3_FLAGS.cards;

// ---------------------------------------------------------------- S-5: card overlay blend

/** Phaser.BlendModes.NORMAL / ADD (plain numbers: this module stays free of the Phaser runtime). */
export const BLEND_NORMAL = 0;
export const BLEND_ADD = 1;

/**
 * S-5 — the blend the card overlays (CardSprite's `card:sheen` / `card:foil` image) need: NORMAL
 * for A5-B's opaque palette-pixel overlays (V3_CARDS), else ADD (today's white / rainbow sweeps).
 */
export const CARD_OVERLAY_BLEND: number = V3_CARDS ? BLEND_NORMAL : BLEND_ADD;

let overlaysOpaque = false;

/**
 * S-5 — A5-B's texture builder calls this (under V3_CARDS) once it has built `card:sheen` /
 * `card:foil` as opaque palette pixels. Until then the overlays are today's ADD sweeps and must
 * keep blending ADD, so the look stays identical while the lane is still empty.
 */
export function setCardOverlaysOpaque(on: boolean): void {
  overlaysOpaque = on;
}

/**
 * S-5 — the blend mode CardSprite gives its sheen / foil image (read when the card is built):
 * CARD_OVERLAY_BLEND once A5-B's opaque overlays exist (setCardOverlaysOpaque), else ADD (v1 always).
 */
export function cardOverlayBlend(): number {
  return V3_CARDS && overlaysOpaque ? CARD_OVERLAY_BLEND : BLEND_ADD;
}
