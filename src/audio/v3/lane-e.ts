// Lane E (claude/kart-e) sound registry: the 11 new spells, Şafak Kılıçları's new signature and the
// mechanic events (control switch, mass destroy, dice, spell→deck). One module per card in ./e/;
// src/audio/sounds.ts spreads LANE_E_RECIPES and SfxName gains LaneESfxName (one additive line each).

import type { Recipe } from '../sounds';
import { RECIPES as wellPail, type Sfx as WellPailSfx } from './e/well_pail';
import { RECIPES as puppetString, type Sfx as PuppetStringSfx } from './e/puppet_string';
import { RECIPES as voidEye, type Sfx as VoidEyeSfx } from './e/void_eye';
import { RECIPES as sweepingGale, type Sfx as SweepingGaleSfx } from './e/sweeping_gale';
import { RECIPES as winnowSieve, type Sfx as WinnowSieveSfx } from './e/winnow_sieve';
import { RECIPES as augerLance, type Sfx as AugerLanceSfx } from './e/auger_lance';
import { RECIPES as soulLeash, type Sfx as SoulLeashSfx } from './e/soul_leash';
import { RECIPES as strawDecoys, type Sfx as StrawDecoysSfx } from './e/straw_decoys';
import { RECIPES as spiteAxe, type Sfx as SpiteAxeSfx } from './e/spite_axe';
import { RECIPES as pageTurner, type Sfx as PageTurnerSfx } from './e/page_turner';
import { RECIPES as luckyDie, type Sfx as LuckyDieSfx } from './e/lucky_die';
import { RECIPES as dawnSwords, type Sfx as DawnSwordsSfx } from './e/dawn_swords';
import { RECIPES as mechanics, type Sfx as MechanicsSfx } from './e/mechanics';

export const LANE_E_RECIPES = {
  ...wellPail,
  ...puppetString,
  ...voidEye,
  ...sweepingGale,
  ...winnowSieve,
  ...augerLance,
  ...soulLeash,
  ...strawDecoys,
  ...spiteAxe,
  ...pageTurner,
  ...luckyDie,
  ...dawnSwords,
  ...mechanics,
} satisfies Record<string, Recipe>;

export type LaneESfxName =
  | WellPailSfx
  | PuppetStringSfx
  | VoidEyeSfx
  | SweepingGaleSfx
  | WinnowSieveSfx
  | AugerLanceSfx
  | SoulLeashSfx
  | StrawDecoysSfx
  | SpiteAxeSfx
  | PageTurnerSfx
  | LuckyDieSfx
  | DawnSwordsSfx
  | MechanicsSfx;
