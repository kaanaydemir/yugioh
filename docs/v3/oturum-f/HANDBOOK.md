# Lane F builder handbook (addendum)

The generic v3 pipeline (file layout, registration points, v1 safety, rig contract, card art, cut-in,
cinematics API, sound wiring, scenarios, filming, gates, pitfalls, reference implementations) is
documented in **`HANDBOOK-lane-B-copy.md`** (a verbatim copy of lane B's handbook from
`origin/claude/kart-b`, written at base 684e290; this tree is at 0c2ceba, a few commits newer). Read §0–§11
there; replace "lane B / kart-b / KART_B" with "lane F / kart-f / KART_F". Its §12 is lane B's own status
and does not apply. Re-verify any line number before relying on it.

## Lane F cards

| id | name | attr / race | Lv | ATK/DEF | effect (engine) | ace | v1 art | v3 state at lane start | scenario prefix |
|---|---|---|---|---|---|---|---|---|---|
| shield_titan | Kalkan Devi | EARTH / Savaşçı | 4 | 100/2600 | `defenseAtkDebuff500` — face-up DEF and attacked: attacker −500 ATK that battle (`engine/query.ts:276`, announced `rules.ts:1804`) | no | none (crystal totem) | draft in monsters-v3 (excluded); cardart-v3 + cutins-v3 exist; tests/art/shield_titan.test.ts fails (death heap) | `kd*` |
| hourglass_imp | Kum Saati Cücesi | LIGHT / Büyücü | 2 | 500/400 | `summonFreezeAttack` — on summon, one chosen opposing monster cannot attack on the opponent's next turn (`rules.ts:1196`, `:1703`) | no | none | draft in monsters-v3 (excluded); cardart-v3 exists; tests/art/hourglass_imp.test.ts fails (not registered) | `ks*` |
| windmane_knight | Fırtına Şövalyesi | EARTH / Savaşçı | 7 | 2300/2100 | `summonTurnAtk500` — +500 while attacking on the turn it was Normal/Tribute Summoned (`query.ts:228`) | **yes → cut-in** | none | nothing | `fs*` |
| wing_lady | Kanat Hanımı | WIND / Kanatlı | 4 | 1300/1400 | `windAura300` — other face-up WIND monsters on its side +300 ATK (`query.ts:218`; aura view: `src/duel/auras-v3.ts`) | no | none | nothing | `kh*` |

Design one-liners (docs/KART_TASLAGI_CANAVAR.md): hourglass_imp "big hourglass, pointed hat dwarf";
windmane_knight "not mounted — heavy knight with a maned helm"; shield_titan "tower shield taller than
himself"; wing_lady "bird-winged woman with a short sword". Existing placeholder scenarios:
`m1Shield, m1Freeze, m1Knight, m1Imp, m1Aura, m1AuraAttack, m1Board5` (src/duel/scenarios/monsters1.ts).

## Lane F specifics
- Cinematics go in `src/cinematics/kart-f/<id>.ts` (+ `kart-f/_kit.ts` exports only). Names `kart-f:<id>:<part>`,
  priority 20, every registration gated on `LOOK_V3`.
- Sound: files already scaffolded — `src/audio/v3/<id>.ts` (`<ID>_RECIPES`, `<ID>_VOICE = null`) and the lane
  index `src/audio/v3/kart-f.ts`, already spread into sfx.ts / sounds.ts / _v3/sound.ts. Set the VOICE only in
  the same change that ships the card's strike + death cinematics (it disables the generic impact and enables
  the declaration charge).
- Shared one-liners each card owns: its own exclusion entry in `src/art/monsters/index.ts` (shield_titan,
  hourglass_imp: delete only your entry when the card passes the gates), its own line in
  `src/cinematics/_v3/presets.ts` `DEATH_PRESETS` (shield_titan and windmane_knight are `'stone'` today — stone/ash
  endings are RESERVED for R1 and stone_sentinel, YENI_KARTLAR §5.2: change them), its own line in
  `src/view/light/profiles.ts` `MONSTER_GLOW` (emissive tones must not be body tones).
- New rigs are drafted as `src/art/monsters-v3/_<id>.ts` and renamed to `<id>.ts` once they pass the sprite gates.
- Do not touch venom_drake (lane A) or wisp_imp (lane B), or any other lane's card.
- Baselines (made at lane start, uncommitted, in `shots/`): `shots/v3/a3/baseline/v1films`,
  `shots/v3/a56/baseline/a6v1films`, camera base `shots/v3/kart-f/camera-base.json`.
- Evidence goes to `shots/v3/kart-f/<id>/...` (gitignored; cite paths in `docs/v3/oturum-f/<id>.md`).
- Container only: `/opt/pw-browsers/chromium-1243/chrome-linux -> chrome-linux64` symlink.
