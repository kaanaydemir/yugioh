# Parallel sessions — per-card golden-rule presentation (2026-10-31)

The orchestrator session splits the presentation work for the new and redesigned cards
across 5 cloud sessions. Each works on its own branch `claude/kart-<lane>`, which starts
from `claude/yugioh-card-game-tgi7td` at commit 6178b55. The engine rules for every card
are already done. The cards play today with placeholder art and placeholder cinematics:
`src/art/monsters/_placeholder-token.ts`, `src/art/cardart/_placeholder-b2.ts` and
`src/cinematics/b2/placeholders.ts`. The orchestrator merges the lanes back into the
main branch.

## Lanes
| Lane | Branch | Cards (ids) |
|------|--------|-------------|
| A | claude/kart-a | ashen_drake (R1 full redesign, NO rebirth rule), venom_drake (full redesign: owner said it looks bad), cloud_hatchling (C3) |
| B | claude/kart-b | grim_warden (R2), wisp_imp (R3), mudgrasp_spirit (C10), hollow_ogre (C6, includes the banish presentation) |
| C | claude/kart-c | tide_harpooner (C1), reed_heron (C8), crag_axeman (C7), kite_fencer (C9), steppe_spiralhorn (C11) |
| D | claude/kart-d | dial_jester (C2, includes the coin toss), reflection_archer (C4), scrap_raiders (C5), polar_needle / polar_anvil / polar_coil / polar_sovereign (C12–C15, includes the fusion and split sequence), straw_decoy_token |
| F | claude/kart-f | shield_titan (Kalkan Devi), hourglass_imp (Kum Saati Cücesi), windmane_knight (Fırtına Şövalyesi), wing_lady (Kanat Hanımı): existing cards with NO real art (crystal-totem placeholder in game); full golden-rule sprite + card art + cinematics + SFX. Earlier v3 drafts of shield_titan/hourglass_imp exist in src/art/monsters-v3 but were excluded in src/art/monsters/index.ts for failing review |
| E | claude/kart-e | the 11 spells S1–S5 and S7–S12 (no S6, gilded_cage was dropped), a new signature animation and sound for dawn_swords (Şafak Kılıçları; adapt the S6 Kafes storyboard), and the CARD art only for crystal_wyrm and abyss_magus |

## What "done" means for each card (BRAND GOLDEN RULE, CLAUDE.md)
- **Monsters:**
  - A v3 sprite rig in the house pixel language, with idle, summon, attack, hit, guard, death and its signature or effect animation, drawn for P1 and P2.
  - Card art (cardart-v3, big + small).
  - A cut-in when the card is a tribute/ace monster.
  - Unique v3 summon, attack, death and effect cinematics.
  - Unique synthesized SFX for each of those moments.
- **Spells:**
  - Card art.
  - A unique activation cinematic and SFX that follow the storyboard in docs/v3/YENI_KARTLAR.md §7.
  - For mechanic events (control switch, mass destroy, coin, dice, banish, token vanish, return to deck), replace the placeholder handlers in src/cinematics/b2/placeholders.ts with the lane's own versions.
- **Spec and guides:**
  - The per-card storyboards and sound identities are in docs/v3/YENI_KARTLAR.md §5–§8. Read §5.1 and §5.2 so your sounds and death materials do not collide with other cards.
  - The style and motion guide is docs/v3/REHBER.md. The time budgets are REHBER §5 × 1.45 (see docs/v3/TEMPO.md).
- **Critique rounds:** at least 3 rounds per card. Each round: film it (`node tools/shot.mjs ... --film`), LOOK at the PNGs, critique, fix. Use independent critic agents.

## Gates before every push
- `npm run typecheck` is clean.
- `npm test` has no new failures. The known failures are dusk_ashen, hourglass_imp and shield_titan. Lane D must also fix the scrap_raiders cardface G1 failure by giving the card its real art.
- v1 is unchanged:
  - `node tools/filmdiff.mjs --set v1 --base shots/v3/a3/baseline/v1films` gives 17/17 IDENTICAL.
  - `node tools/filmdiff.mjs --set a6v1 --base shots/v3/a56/baseline/a6v1films` gives 26/26 IDENTICAL.
- The camera never changes: `measure --camera-gate`.
- Colors come only from palette.ts (`node tools/palcheck.mjs`).

## Shared files (merge-friendly rules)
- Put new code in NEW per-card files wherever possible.
- In shared registries (src/data/cards.ts art lines, src/art/monsters/index.ts, src/audio/sfx.ts / sound registries, src/cinematics/_v3/presets.ts, src/view/light/profiles.ts, scenarios), make additive one-line edits only, kept next to your own card's entry. Do not reformat, reorder or refactor shared files.
- Do not touch cards outside your lane.

## Process
- Unlike the default CLAUDE.md rule, sessions in this plan DO commit. Commit and push to your own lane branch after each finished card (`git push -u origin claude/kart-<lane>`), so another AI can continue if the session ends.
- Commit trailer:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and
  `Claude-Session: <your session url>`.
  No model names anywhere else.
- Keep `docs/v3/oturum-<lane>.md` current: per-card status, evidence paths, open issues.
- Do not open pull requests. Do not push to any other branch.
