// ViewerPolicy — the hidden-information rules of the shared screen.
//
// The "viewer" is the player whose hand is face-up at the bottom of the screen (HandView owner):
//   hotseat  the human holding the device (turn player, or the defender answering a trap)
//   vsBot    always the human
//   demo     the active player (spectator mode follows the turn)
// canSee(p) — may p's private cards (hand, draws) be shown? Only the viewer's.
// Set cards on the field stay face-down for everyone (both players watch the same screen).
//
// ensureViewer(p) hands the screen to p: hot-seat with the curtain setting shows the
// pass-device curtain (and waits for the click) before p's hand is revealed.

import type { PlayerId } from '../engine/types';
import type { DuelMode } from '../scenes/launch';
import type { HandView } from '../view/HandView';
import type { HudView } from '../view/HudView';
import type { Prompt } from '../view/Prompt';

export class ViewerPolicy {
  readonly mode: DuelMode;
  /** Players controlled by the CPU. */
  readonly cpu: Set<PlayerId>;
  curtain: boolean;
  /** QA: the CPU plays for every player (auto mode); no curtains. */
  auto = false;
  private readonly hand: HandView;
  private readonly hud: HudView;
  private readonly prompt: Prompt;
  /** Wraps user waits so the cinematic watchdog pauses (set by DuelScene). */
  userWait: <T>(p: Promise<T>) => Promise<T> = (p) => p;
  /** Called when the viewer changed (controller refreshes highlights). */
  onChange: ((p: PlayerId) => void) | null = null;

  constructor(o: { mode: DuelMode; cpu: PlayerId[]; curtain: boolean; hand: HandView; hud: HudView; prompt: Prompt }) {
    this.mode = o.mode;
    this.cpu = new Set(o.cpu);
    this.curtain = o.curtain;
    this.hand = o.hand;
    this.hud = o.hud;
    this.prompt = o.prompt;
  }

  get viewer(): PlayerId {
    return this.hand.owner;
  }

  canSee(p: PlayerId): boolean {
    return p === this.hand.owner;
  }

  isHuman(p: PlayerId): boolean {
    return !this.auto && !this.cpu.has(p);
  }

  /** Who should hold the screen when `p` acts (vsBot: the human stays). */
  viewerFor(p: PlayerId): PlayerId {
    if (this.mode === 'vsBot') {
      const human = ([0, 1] as PlayerId[]).find((x) => !this.cpu.has(x));
      return human ?? p;
    }
    return p;
  }

  /** Hand the screen to the right viewer for `p`. Curtain in hot-seat (if enabled). */
  async ensureViewer(p: PlayerId): Promise<void> {
    const target = this.viewerFor(p);
    if (target === this.hand.owner && !this.hand.isFaceDown) return;
    const useCurtain = this.mode === 'hotseat' && this.curtain && !this.auto && this.isHuman(target);
    if (useCurtain) {
      await this.userWait(
        this.prompt.passDevice(target, async () => {
          await this.hand.setOwner(target, true);
        }),
      );
      await this.hand.setFaceDown(false);
    } else {
      await this.hand.setOwner(target, false);
    }
    this.onChange?.(target);
  }
}
