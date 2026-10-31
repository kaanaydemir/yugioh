# v3 tempo (sunum hızı)

Sahibin geri bildirimi: "animasyonlar 1× hızda bile çok hızlı". Yalnız `?look=v3` için geçerlidir;
v1 / v2 bayt ve zaman olarak aynı kalır (tempo hep 1).

## Nasıl çalışır

- **Genel tempo `V3_TEMPO` = 1,35** (`src/duel/speed.ts`). Bir sinematik oynarken
  (`DuelController.busy`) gösteri saati (`src/duel/showclock.ts`) 1,35 kat yavaş akar:
  `ölçek = hız / tempo`. Tween'ler, zamanlayıcılar, sprite animleri, ambiyans, sarsıntı, hologram
  hepsi buna uyar.
- **Hız ayarı üstte çarpar:** 1× / 2× / 3×, Boşluk ile ileri sarma ve ağır çekim aynen çalışır
  (2× = tempo'lu sürenin yarısı).
- **Oyuncunun kendi girdisi** (el üstünde gezinme, menüler, hedef seçme) sinematik dışında olduğu
  için tempo almaz, eskisi gibi çabuk tepki verir.
- **Hit-stop:** donma süresi `ms × tempo × V3_HIT_HOLD` (1,35 × 1,15 ≈ 1,55) gerçek zaman. Darbe
  karesi geri kalandan biraz daha uzun durur.
- **Ağır çekim** (`slowMo`) sayacı da tempo ile uzar.
- **Ses eşzamanı:** sesler animasyon işaretlerinden (`atFrame` / `atMark`) ve sahne saatinden
  çalınır. Görüntü yavaşlayınca sesler de aynı karede gelir; uzun sesler bitiş işaretinde susar.
- URL ile deneme: `&tempo=1` (kapalı), `&tempo=1.5` (0,5–3 arası).

## Önemli anlara ek nefes (sahne ms, tempo'dan önce)

| An | Önce | Şimdi | Dosya |
|---|---|---|---|
| Temastan ölüme geçiş | 110 | 150 | `_v3/budget.ts` `DEATH_AFTER_CONTACT_MS` |
| Eski girişlerin hologram oturması | ≤ 120 | ≤ 160 | `_v3/summon.ts` `HOLO_SETTLE_V3_MS` |
| Büyü kartının imza bekleyişi | 0,5× (70–180) | 0,65× (100–240) | `spells/_kit.ts` `spellOpeningV3` |
| Tuzak açılış bekleyişi ("TUZAK!") | 100 | 150 | `traps/_opening.ts` `trapOpeningV3` |
| Hasar sayısı ömrü | 1250 | 1500 | `_v3/number.ts` `LIFE` |

## Bütçeler

REHBER §5 tablosundaki sınırlar **sahne saati** bütçesidir (kodun içindeki süreler). `measure.mjs`
oyun saatiyle ölçtüğü için yeni değerler kabaca **bütçe × 1,35** (+ ek nefes) çıkar. Yeni sınır:
oyun saatiyle ölçülen süre ≤ REHBER §5 sınırı × 1,45. `&tempo=1` ile ölçülen değerler eski
tabloyla karşılaştırılabilir.

Ölçüm (1×, `--look v3`, oyun ms, eylem başından girdi dönüşüne):

| Senaryo | Önce | Sonra | Oran |
|---|---|---|---|
| `saWyrmAtk` (saldırı + ölüm) | 2,00 sn | 2,68 sn | ×1,34 |
| `saMagusAtk` (saldırı + ölüm) | 1,55 sn | 2,17 sn | ×1,40 |
| `suWyrm` (kurbanlı çağırma + cut-in) | 2,80 sn | 3,53 sn | ×1,26 |
| `spBolt` (büyü) | 1,32 sn | 1,83 sn | ×1,39 |
| `tbChains` (tuzak) | 3,67 sn | 4,90 sn | ×1,34 |
| `tbMirror` (tuzak, Ayna) | 2,58 sn | 3,37 sn | ×1,30 |
| `flowLethal` (son vuruş + oyun sonu) | 5,97 sn | 7,98 sn | ×1,34 |
