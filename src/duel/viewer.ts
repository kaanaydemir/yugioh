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
import { V3_A6_B } from '../view/v3flags';

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
  /** The pass-device curtain went up (true) / came down (false) — whoever asked for it. */
  onCurtain: ((on: boolean) => void) | null = null;

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

  /**
   * Hand the screen to the right viewer for `p`. Curtain in hot-seat (if enabled). v3 (lane A6-B, F7):
   * the curtain covers only the hand (src/view/v3/CurtainV3.ts); `trap` = the hand-over is for a trap
   * question ("TUZAK SORUSU: OYUNCU n").
   */
  async ensureViewer(p: PlayerId, opts: { trap?: boolean } = {}): Promise<void> {
    // v3 (A6B-2): a cover wave after a trap answer finishes before the next hand-over looks at the hand
    if (this.covering) await this.covering;
    const target = this.viewerFor(p);
    if (target === this.hand.owner && !this.hand.isFaceDown) return;
    const useCurtain = this.mode === 'hotseat' && this.curtain && !this.auto && this.isHuman(target);
    if (useCurtain) {
      this.onCurtain?.(true);
      try {
        await this.userWait(
          this.prompt.passDevice(
            target,
            async () => {
              await this.hand.setOwner(target, true);
            },
            V3_A6_B ? { hand: this.hand, kind: opts.trap ? 'trap' : 'turn' } : undefined,
          ),
        );
      } finally {
        this.onCurtain?.(false);
      }
      await this.hand.setFaceDown(false);
    } else {
      await this.hand.setOwner(target, false);
    }
    this.onChange?.(target);
  }

  /** The defender's hand turning face down after a trap answer (v3, lane A6-B), until it is down. */
  private covering: Promise<void> | null = null;

  /**
   * v3 (lane A6-B, F7 / KO-11; critic A6B-2): `p` has answered a trap question in hot-seat with the
   * curtain on. The question was the defender's; the battle goes on as the turn player's — so the
   * defender's hand turns face down now, in the curtain's wave (S-9, 30 ms a card), and stays down
   * through the attacker's battle; the next hand-over (ensureViewer) then runs the curtain from that
   * covered hand. Resolves when the hand is down (at once when there is nothing to cover). Lane B off,
   * v1, vsBot, the demo and a hot-seat without the curtain: nothing (the hand is not private there).
   */
  coverAfterAnswer(p: PlayerId): Promise<void> {
    if (!V3_A6_B) return Promise.resolve();
    const useCurtain = this.mode === 'hotseat' && this.curtain && !this.auto && this.isHuman(p);
    if (!useCurtain || this.hand.owner !== p || this.hand.isFaceDown) return Promise.resolve();
    const wave = this.hand.waveFaceDown(true, 30).catch((e) => console.error('[viewer] cover', e));
    this.covering = wave;
    void wave.then(() => {
      if (this.covering === wave) this.covering = null;
    });
    return wave;
  }
}
