# Oturum E (lane E, `claude/kart-e`) — durum

Kapsam: 11 yeni büyü (S1–S5, S7–S12), Şafak Kılıçları yeni imza (Kafes storyboard uyarlaması), Kristal Ejder ve
Uçurum Büyücüsü için yalnız KART resmi. Brif: `docs/v3/PARALEL_OTURUMLAR.md`.

## Altyapı (lane E'nin kendi dosyaları)
- Ses: `src/audio/v3/e/<id>.ts` (kart başına), `src/audio/v3/lane-e.ts` (toplayıcı). `sounds.ts` / `sfx.ts`'e
  birer eklemeli satır (`LANE_E_RECIPES`, `LaneESfxName`). Ses adları `e_` önekli.
- Kart resmi: `src/art/cardart-v3/<id>.ts`, `src/art/cardart-v3/lane-e.ts` (glob kayıt);
  `src/art/cardface-v3/index.ts`'e tek eklemeli satır (`...LANE_E_ART`).
- Mekanik olaylar: `src/cinematics/b2e/dispatch.ts` — controlChange / massDestroy / diceRoll / toDeck için
  öncelik 1 işleyici; kart modülleri `registerLaneE(tür, sahiplenir, oynat)` ile kendi olaylarını alır,
  sahiplenilmeyen olay zincirde aşağı (placeholder ya da başka lane) düşer. `b2/placeholders.ts`'e dokunulmadı
  (coinToss / banish / tokenVanish ve Kadran'ın massDestroy'u başka lane'lerin).

## Taban (değişiklikten önce, 2026-10-31)
- `npm test`: 8 başarısız (ashen_drake, cardface-v3 G1, dusk_ashen, grim_warden, hourglass_imp, seal_arm_r,
  seal_leg_r, shield_titan) — hiçbiri lane E'nin değil.
- v1 / a6v1 film tabanları bu dalın başında (6178b55 + belgeler) yazıldı.
- Ortam notu: Playwright 1243 tarayıcısı `chrome-linux64` altında; `tools/shot.mjs` `chrome-linux` arar →
  `/opt/pw-browsers/chromium-1243/chrome-linux` sembolik bağı (yalnız konteyner, repoda değişiklik yok).

## Kart durumu
| Kart | Resim | Sinematik | SFX | Eleştiri turları | Kanıt |
|---|---|---|---|---|---|
| (doldurulacak) | | | | | |
