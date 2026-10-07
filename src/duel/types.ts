// Shared types of the duel screen (views bundle handed to cinematics and the controller).
import type { BoardView } from '../view/BoardView';
import type { HudView } from '../view/HudView';
import type { HandView } from '../view/HandView';
import type { InspectPanel } from '../view/InspectPanel';
import type { Prompt } from '../view/Prompt';
import type { ActionMenu } from '../view/ActionMenu';
import type { LogView } from '../view/LogView';
import type { FieldView } from './FieldView';
import type { CameraRig } from './CameraRig';
import type { DuelistViews } from './DuelistView';
import type { ViewerPolicy } from './viewer';
import type { SpeedControl } from './speed';

/** Every view of the duel screen. Cinematics reach them through `ctx.views`. */
export interface DuelViews {
  /** The arena: tiles, highlights, theme (volcano), lights, side pulses. */
  board: BoardView;
  /** Cards on tiles, monster units, deck / graveyard piles (reconciled with the engine state). */
  field: FieldView;
  /** LP panels, phase bar, turn badge, SAVAŞ / TURU BİTİR buttons, toolbar. */
  hud: HudView;
  /** The viewer's hand (big cards) + the other player's mini-hand. */
  hand: HandView;
  inspect: InspectPanel;
  prompt: Prompt;
  menu: ActionMenu;
  log: LogView;
  /** Main (world) camera zoom / pan / descent; HUD lives on a separate un-zoomed camera. */
  camera: CameraRig;
  /** Duelist avatars behind each back row (null when the duelist art module is missing). */
  duelists: DuelistViews | null;
  /** Hidden-information policy: whose hand is on screen, who is human, pass-device curtain. */
  info: ViewerPolicy;
  /** Global speed (settings × fast-forward); slowMo(k, ms) for dramatic slow motion. */
  speed: SpeedControl;
}

/** Something a cinematic leaves on screen across events (attack arrow, lock-on, aura...). */
export interface Disposable {
  destroy(): void;
}
