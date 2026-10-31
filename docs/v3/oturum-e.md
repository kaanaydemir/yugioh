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

### S3 Boşluk Gözü (`void_eye`)
- Resim: `src/art/cardart-v3/void_eye.ts` (88×68 + elle 44×34, 4 kare yaşayan resim). Sinematik + toplu yok etme:
  `src/cinematics/spells/void_eye.ts` (activate kancası + `registerLaneE('massDestroy')`; tüm destroy / tokenVanish /
  Koruyucu Tılsım olayları tek kolektif yükselişte). SFX: `src/audio/v3/e/void_eye.ts` (13 tarif, `e_void*`).
- Senaryolar: `src/duel/scenarios/e_void_eye.ts` (eVoid, eVoidP2, eVoidQuick, eVoidSet, eVoidSetP2, eVoidOne,
  eVoidCharm, eVoidSovereign, eVoidEquip); test `tests/e/void_eye.test.ts`.
- Kanıt: `shots/e/void_eye/` (r5-crowd.png, r3-p2.png, r4-eye.png, r4-set.png, r4-sovereign.png, art/, sfx/, measure.json).
- Ölçüm (oyun ms): eVoidQuick 5,50 sn, eVoidSet 5,37 sn, eVoidOne 5,17 sn; kamera 0. §7 imzası 3,2 sn olduğundan
  REHBER §5 büyü bütçesini (2,0 × 1,45) aşar — açık konu.

### S5 Harman Eleği (`winnow_sieve`)
- Resim: `src/art/cardart-v3/winnow_sieve.ts` (88×68 + elle 44×34, 4 kare yaşayan resim: elek sallanır, taneler
  havada, üç kart, savrulan saman). Sinematik: `src/cinematics/spells/winnow_sieve.ts` (activate kancası: hasır
  elek örülür, buğday dökülür, 6 Hz sallama, üç kart takla atarak ele; elek seçim boyunca alçakta bekler —
  `registerEvent('discard', öncelik 2)` yalnız bekleyen elek varken sahiplenir: kartlar eleğe düşer, samana döner,
  rüzgar sapları mezarlığa savurur, elek çözülür; başka bir olay gelirse elek söner). SFX:
  `src/audio/v3/e/winnow_sieve.ts` (12 tarif, `e_sieve*`).
- Senaryolar: `src/duel/scenarios/e_winnow_sieve.ts` (eSieve, eSieveP2, eSieveSet, eSieveSetP2, eSieveBare,
  eSieveSeal, eSieveSealP2, eSieveUi, eSievePlay); test `tests/e/winnow_sieve.test.ts`.
- Kanıt: `shots/e/winnow_sieve/` (r2z.png, r4toss.png, r4straw.png, r5p2disc.png, r5ui.png, r4set.png, r4seal.png,
  art/, sfx/, measure.json).
- Ölçüm (oyun ms): eSieve etkinleştirme 3,22 sn + atma 1,58 sn; kamera 0. REHBER §5 büyü sınırını (2,9 sn) etkinleştirmede
  ~0,3 sn aşar (§7: 3,0 sn + seçim) — açık konu.

## Kontrol noktası (WIP, 2026-10-31 ~20:00 UTC)
Orkestratörün isteğiyle ara kayıt (kullanım sınırı yaklaşıyor). İş akışı (`lane-e-cards`, kart başına
kurucu → 3 bağımsız eleştiri+düzeltme turu → çekişmeli doğrulama → commit) sürüyor; bu commit o anki ağacı
olduğu gibi (yarım kartlar dahil) kaydeder. Sıradaki: kalan kartların turları, sonra v1 / a6v1 film kapıları,
kamera kapısı, palcheck ve son özet. Kart başına bitmiş commit'ler "Lane E: <id>" başlığıyla gelecek.
