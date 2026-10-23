# A3 — Kabul özeti

A3 (`docs/ANIMASYON_PLANI.md` §6): stil ve hareket rehberi + ölçeklenebilirlik katmanı + pilot Taş Muhafız.
Mimari `docs/v3/A3_MIMARI.md`, kurallar `docs/v3/REHBER.md`. Kanıtlar `shots/v3/a3/` altında (git dışı).
Kabul edilen sürüm: `f5297ed` (+ `bac1e77` araç eki), 23 Ekim 2026.

## Ne yapıldı

| Parça | Yer | Not |
|---|---|---|
| Rehber | `docs/v3/REHBER.md` | ışık, malzeme, silüet, hareket, süre, ses kuralları; 15 kalite kapısı |
| Çizim çekirdeği | `src/art/rigkit/**` (3.188 satır) | dilimin zanaatı kopyalandı; 532 dilim karesi bayt bayt aynı; poz cebiri, animasyon derleyicisi, `validateArt` |
| Malzeme kütüphanesi | `src/art/materials/**` (618) | çizim + darbe + ölüm + ses tek tanımdan; taş / yosun / rün altını pilotla, bazalt / lav taslakla |
| Gövde tipi `biped/v1` | `src/art/bodyplans/**` (1.492) | iskelet, yuvalar, yere basan ayaklar, eklem izleri; koreografi yok |
| Sunum tarifleri + varsayılan sinematik | `src/presentation/**` (316), `src/cinematics/recipe/**` (1.547) | `throw`, `assemble`, ölüm, çevirme; köprü kuralı: yalnız `?look=v3` ve yalnız v3 çizimi olan canavar |
| Darbe kiti | `src/cinematics/_v3/{react,blow,posematch}.ts` | temas karesinde sprite yerinde; itme sonraki karede; ölçülen poz yolu; temastan önce bekleme ayarı |
| Araçlar | `tools/{filmdiff,sameness,monster-gates,contact-probe}.mjs/ts`, `sheet-hash --look v3`, `demo-qa` `v3` girişi | |
| Pilot Taş Muhafız | `src/art/monsters-v3/stone_sentinel*.ts` (2.685) + süs 249 satır | 13 anim, bekleme karesi onaylanan sabit kare (%99,7), varsayılan tarif yolunda oyunda |
| Taslak Magma Titanı | `src/art/drafts/magma_titan*.ts` (1.602) | A4.1'in başlangıcı; Muhafız'dan ayrışma ölçüldü |

## Kapılar (hepsi geçti)

| Kapı | Sonuç |
|---|---|
| `npm run typecheck`, `npm test` | 0 / 436 test |
| v1 sanat parmak izi | 436 kare aynı |
| v3 dilim sanatı parmak izi | Ejder + Büyücü aynı; Muhafız yeni kayıt |
| v1 tam zaman ölçümü (temiz kopya, 308 senaryo) | 308/308 aynı (±17 ms), hata 0; yeni 11 senaryo v1'de de hatasız |
| v3 tam zaman ölçümü (319 senaryo) | hata 0; 319/319 `measure-v3-pilot` ile aynı |
| v1 film kümesi | 17/17 piksel aynı |
| Dilim film kümesi | `slicefilms-pilot` ile aynı (yalnız Muhafız'ın göründüğü iki film bilinçli değişti) |
| Muhafız kalite kapıları (`monster-gates`, P1 + P2) | hepsi geçti; darbe karesi her bekleme fazında < %50 (en kötü %46,8) |
| Kaya fırlatma denetim listesi | 8/8 |
| Benzerlik Muhafız × taslak Titan | UYARI (KEY 0,661; hareket ölçütlerinin hepsi geçiyor); kör göz testi geçti (8/8 silüet, hareket farklı) |
| Demo oyunlar (`?look=v3`, tohum 9 ve 2) | sonuna kadar oynandı, hata 0, Muhafız sahada |
| Kullanıcı | sessiz animasyon videosu onaylandı; sesli videolar gönderildi (`shots/v3/a3/user/`) |

## Bilinen açıklar (dürüst liste)

1. **Doğrudan saldırı 2,1 sn** (bütçe ~1,6 sn). Kayayı sökme + kaldırma imza hazırlığı; çizimi kısaltmadan düşmüyor.
   A7'deki genel süre ayarında doğrudan saldırı için kısa giriş değerlendirilecek.
2. **Benzerlik KEY tabanda.** Bekleme silüetleri eski çizimden (Sİ-5) ve darbe karesi yerel (HA-21) olduğu için
   Muhafız × Titan KEY 0,661'in altına zor iner; A4.1'de Titan tam çizilirken silüet farkı büyütülmeli.
3. **Benzerlik aracının kalibrasyonunda tek sapma:** ±60 ms kontrolü Muhafız'ın çok kısa karelerinde 0,987 veriyor
   (beklenen 1,00). A4.1'de eşikler v3 çiftleriyle yeniden kalibre edilirken tolerans güncellenecek.
4. **Dilim (Ejder / Büyücü) temas istisnası:** 10 temasın 7'sinde hazırlık süresi bekleme ayarına yetmiyor; çizim
   donuk olduğu için A3_MIMARI §10'da istisna olarak yazıldı. Yeni canavarlar `HA-21 phase` kapısıyla korunuyor.
5. **Satır kazancı beklenenden az:** pilotun kendi dosyaları 2.685 satır (dilim canavarları 2.690–3.086). Kazanç
   çekirdekte, sinematikte ve seste: Muhafız'ın oyuna bağlanması 249 satırlık süsle oldu (dilimde canavar başına
   elle yazılmış sinematik + ses). Normal canavarlar için 1.200–1.400 satır hedefi A4'te izlenecek.
6. **Bellek:** Muhafız 2,90 MB / taraf kırpılmamış (orta sınıf sınırı 3,6 MB). Toplam bellek kapısı A4.1'in ön
   adımında (kırpılmış atlas, `texmem`) ölçülecek; geçilmeden A4.2 başlamaz.
