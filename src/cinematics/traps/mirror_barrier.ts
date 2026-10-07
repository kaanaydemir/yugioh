// Ayna Kalkanı (mirror_barrier) — GAME_DESIGN §7: a huge magenta-white hexagonal mirror dome
// rises in front of the defender, the attack slams into it and reflects as many beams into EVERY
// attack-position monster of the attacker; each one shatters.
//
// activate: the common trap opening, then (owning the whole resolution run)
//   · the dome materializes cell by cell over the defender's row (setpieces.mirrorDome)
//   · the declared attacker uncoils and unleashes its attack on its own attack frame — the streak
//     leaves its muzzle in its attribute colour and strikes the shell (hit-stop, hex ripple)
//   · the dome charges and fires one reflected beam per attack-position monster of the attacker:
//     each beam hit is an impact frame (sparks, flash) and plays that monster's destroy (its own
//     flavoured death); defense-position monsters are spared
//   · the dome breaks into hex shards, the spent trap card burns out and goes to the graveyard.

import { ATTRIBUTE_RAMP, PLAYER_COLOR, RAMPS } from '../../art/palette';
import { type XY, isoToScreen, zoneXY } from '../../view/layout';
import { tween, wait } from '../../vfx/core';
import { afterimages, impact as combatImpact } from '../../vfx/combat';
import { sparkleBurst } from '../../vfx/summon';
import { mirrorDomeTB } from './_mirror';
import { fx, registerCardHook } from '../api';
import { type EvOf, all, lerpXY, live, norm, other, seed, sub, takeAttack } from '../battle/_kit';
import { trapExit, trapOpening } from './_opening';

registerCardHook(
  'mirror_barrier',
  'activate',
  async (ctx) => {
    const ev = ctx.ev;
    const sc = ctx.scene;
    seed(ev.uid * 17 + 3);
    const runIdx = fx.resolutionRun(ctx);
    const kills = runIdx.filter((i) => {
      const e = ctx.events[i];
      return e.type === 'destroy' && e.location === 'monster' && e.sourceUid === ev.uid;
    });
    const killEvs = kills.map((i) => ctx.events[i] as EvOf<'destroy'>);
    const attackerSide = killEvs[0]?.player ?? other(ev.player);
    // the declared attack this trap answers
    const pend = ctx.before.pending;
    const trig = pend && pend.kind === 'trapResponse' ? pend.trigger : null;
    const attackerUid = trig && trig.kind === 'attackDeclared' ? trig.attackerUid : (killEvs[0]?.uid ?? null);
    const attacker = attackerUid !== null ? live(ctx.unit(attackerUid)) : null;
    const pts: XY[] = killEvs.map((e) => {
      const u = live(ctx.unit(e.uid));
      if (u) return u.core();
      const z = zoneXY(e.player, 'monster', e.zone);
      return { x: z.x, y: z.y - 14 };
    });
    // dome centre (setpieces.mirrorDome: grid (2, 3) for player 1, (2, 1) for player 2)
    const dome = isoToScreen(2, ev.player === 0 ? 3 : 1);
    const domeTop = { x: dome.x, y: dome.y - 40 };

    const trapPt = ev.zone !== null ? zoneXY(ev.player, 'spellTrap', ev.zone) : zoneXY(ev.player, 'spellTrap', 1);
    const op = await trapOpening(ctx, { focus: lerpXY({ x: trapPt.x, y: trapPt.y - 30 }, domeTop, 0.5) });
    const { hold, other: kept } = takeAttack(ctx);
    kept?.destroy();
    void ctx.focus({ x: (domeTop.x * 2 + (attacker?.core().x ?? domeTop.x)) / 3, y: (domeTop.y * 2 + (attacker?.core().y ?? domeTop.y)) / 3 }, { zoom: 1.04, ms: 420, pan: 0.3 });

    // ---- the attacker unleashes its attack into the dome (its impact frame = the streak's start)
    const BUILD = 380;
    const fire = (async () => {
      if (!attacker) {
        hold?.destroy();
        return;
      }
      const lead = Math.min(BUILD, attacker.impactMs);
      await wait(sc, BUILD - lead);
      hold?.dropMarks();
      await hold?.release(60);
      if (!attacker.sprite.active) return;
      void attacker.play('attack');
      const s = attacker.sprite;
      const r = attacker.rest0;
      const fwd = norm(sub(domeTop, r));
      attacker.posed = true;
      await wait(sc, Math.max(0, lead - 120));
      void afterimages(sc, s, 160, ATTRIBUTE_RAMP[attacker.attribute][4], { every: 40, alpha: 0.5 });
      await tween(sc, { targets: s, x: Math.round(r.x + fwd.x * 8), y: Math.round(r.y + fwd.y * 4), duration: 110, ease: 'Quad.Out' });
      // the attack leaves it: a muzzle flare in its element colour
      const m = attacker.worldPoint('muzzle');
      void sparkleBurst(sc, m.x, m.y, { ramp: ATTRIBUTE_RAMP[attacker.attribute], count: 16 });
    })();
    const source = attacker ? attacker.worldPoint('muzzle') : (hold?.from ?? pts[0]);
    const plays: Promise<unknown>[] = [];
    let first = true;
    await mirrorDomeTB(sc, ev.player, pts, {
      source,
      attackColor: attacker ? ATTRIBUTE_RAMP[attacker.attribute][3] : PLAYER_COLOR[attackerSide],
      onBlock: () => {
        // the attack rebounds off the shell: the attacker is jolted back
        if (attacker && attacker.sprite.active) {
          const s = attacker.sprite;
          const r = attacker.rest0;
          void tween(sc, { targets: s, x: r.x, y: r.y, duration: 220, ease: 'Back.Out' }).then(() => {
            attacker.posed = false;
          });
        }
      },
      onHit: (k) => {
        const i = kills[k];
        const p = pts[k];
        if (i === undefined || !p) return;
        const dir = norm(sub(p, domeTop));
        void combatImpact(sc, p.x, p.y, { power: 2, ramp: RAMPS.mag, dir, noStop: !first });
        first = false;
        plays.push(wait(sc, 40).then(() => ctx.play(i, { hit: true, push: dir })));
      },
    });
    await fire;
    if (attacker) attacker.posed = false;
    // every kill that the dome did not reach (should not happen) still plays
    for (const i of kills) if (!ctx.isConsumed(i)) plays.push(ctx.play(i, { hit: true }));
    await all([...plays, wait(sc, 120).then(() => trapExit(ctx, op)), op.banner]);
    await fx.playRun(ctx, fx.resolutionRun(ctx));
    await ctx.unfocus(320);
  },
  { name: 'tb:mirror_barrier:activate' },
);
