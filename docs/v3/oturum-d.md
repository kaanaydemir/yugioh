# Oturum D (lane D) — durum

Dal: `claude/kart-d` (başlangıç 6178b55 + 684e290). Brif: `docs/v3/PARALEL_OTURUMLAR.md`.
Kartlar: `dial_jester` (C2 + yazı-tura + bildi/bilemedi silme), `reflection_archer` (C4), `scrap_raiders` (C5),
`polar_needle` / `polar_anvil` / `polar_coil` (C12–C14), `polar_sovereign` (C15 + birleşme + ayrılma),
`straw_decoy_token` (jeton sprite + yok oluş).

Yapım el kitabı (bu hattın ajanları için): `docs/v3/oturum-d-rehber.md`.
Kanıtlar: `shots/v3/d/<kart>/`.

## Ortam notu
- Bu konteynerde Playwright Chromium `chrome-linux64` altında; araçların `chromePath()` `chrome-linux` arıyor.
  Çözüm (repo dışı): `ln -s /opt/pw-browsers/chromium-1243/chrome-linux64 /opt/pw-browsers/chromium-1243/chrome-linux`.
- Başlangıç kapıları: `npm run typecheck` temiz; `npm test` 4 bilinen hata (dusk_ashen, hourglass_imp, shield_titan,
  cardface-v3 G1 = scrap_raiders).

## Kart durumu
| Kart | Durum | Kanıt | Açık konular |
|---|---|---|---|
| polar_needle | yapım + eleştiri turları sürüyor (WIP) | shots/v3/d/polar_needle/ (git dışı) | kapılar henüz koşmadı |
| polar_anvil | yapım + eleştiri turları sürüyor (WIP) | shots/v3/d/polar_anvil/ (git dışı) | kapılar henüz koşmadı |
| polar_coil | yapım + eleştiri turları sürüyor (WIP) | shots/v3/d/polar_coil/ (git dışı) | kapılar henüz koşmadı |
| polar_sovereign | bekliyor (üç parça bitince başlar) | | |
| dial_jester | yapım sürüyor (WIP: rig + kart görseli var) | shots/v3/d/dial_jester/ (git dışı) | sinematik/SFX tamamlanmadı |
| reflection_archer | yapım sürüyor (WIP: rig + kart görseli var) | shots/v3/d/reflection_archer/ (git dışı) | sinematik/SFX tamamlanmadı |
| scrap_raiders | yapım sürüyor (WIP: rig + kart görseli var) | shots/v3/d/scrap_raiders/ (git dışı) | sinematik/SFX tamamlanmadı |
| straw_decoy_token | yapım sürüyor (WIP: rig + kart görseli var) | shots/v3/d/straw_decoy_token/ (git dışı) | sinematik/SFX tamamlanmadı |

## Günlük

- 2026-11-05 polar_needle fix r1: çağırma artık KAPALI iğne (uzuvlar pastilde, mavi S ucu karo merkezinde, mızrak pivotta pusula kartı) ile iki tur + kilit + 4 karelik açılma; ölüm sonu kendi levhaları (miğfer, iki omuzluk, bacaklar tek tek düşer, polarNeedlePlate ×4, kalıntı son 150 ms'de söner, taş kırılması yok); saldırı-pozisyonundaki rakibe kaybedince 'itilme' varyantı (polarNeedleRepel, shieldBlock susturuldu — altıgen hâlâ ortak battle.ts blockClang'dan geliyor); savunmaya geçiş kendi kancası (polarNeedleGuard, genel altıgen yok). Hit-stop: ortak tablo (mediumHeavy contactStopMs 80/95/110, güç 1/2/3); İğne'nin tipik vuruşu (hasar ≥ 600 veya doğrudan 1500) güç 2 = 95 ms, blok (hasar 0) güç 1 = 80 ms — kart başına durdurma API'si yok, bilinçli olarak tablo değerinde bırakıldı. Kanıt: shots/v3/d/polar_needle/fix1b/.
- 2026-11-01 ikinci limit duraklaması: crit1 + fix1 turları polar parçaları, archer, jester için kısmen bitti; sovereign başlamadı. Workflow yeniden sürdürüldü.
- 2026-10-31 WIP kontrol noktası (orkestratör isteği: kullanım limiti yaklaşıyor). Workflow `wf_ec97f149-c20` sürüyor:
  el kitabı `docs/v3/oturum-d-rehber.md` yazıldı; yedi kartın rig + kart görseli + art testleri, polar parçalarının ve
  dial_jester'ın sinematik/SFX'i kısmen hazır. `npm run typecheck` temiz. Kapılar (filmdiff, camera-gate, palcheck) bu
  noktada koşulmadı — WIP.
  Sırada: kalan kartların sinematik + SFX yapımı, her kart için 3 eleştiri/düzeltme turu, adversarial kapı doğrulaması,
  kart başı commit; ardından polar_sovereign (birleşme + ayrılma). Duraklarsa: workflow aynı scriptPath ile
  `resumeFromRunId: wf_ec97f149-c20` ile sürdürülür.
  Bilinen konu (coil ajanı): kill senaryolarında ölüm kitinin ilk sesi atlanıyor (tepki ölüm animasyonunu önce başlatıyor);
  coil kendi ölüm kancasından çalarak aştı; anvil/needle için de bakılacak.

## DURAKLATILDI (2026-11-01 06:10 UTC — sahip kararı: haftalık kullanım limiti)
Workflow ve otomatik kontrol noktası döngüsü durduruldu. Son WIP commit bu dosyayı içerir; çalışma ağacı temiz.

### Nerede kaldık (workflow `wf_ec97f149-c20` journal'ına göre)
- Bitti: el kitabı; 7 kartın art'ı (dial_jester, reflection_archer, scrap_raiders, straw_decoy_token, polar_needle/anvil/coil);
  7 kartın sinematik + SFX yapımı; 7 kartın 1. eleştirisi (crit1); polar_needle/anvil/coil için 1. düzeltme (fix1).
- Yarıda/başlamadı: fix1 (dial_jester, reflection_archer, scrap_raiders, straw_decoy_token); crit2/fix2, crit3/fix3,
  verify ve kart başı commit (tüm kartlar); polar_sovereign'in tamamı (art, sinematik, birleşme + ayrılma).
- Kapılar (npm test, filmdiff v1/a6v1, camera-gate, palcheck) henüz hiçbir kart için koşulmadı. scrap_raiders cardface G1
  düzeltmesi doğrulanmadı.

### Sürdürme (haftalık sıfırlamadan sonra, orkestratör onayıyla)
1. Ortam: `npm ci` (node_modules yoksa) ve Chromium symlink (yukarıdaki Ortam notu).
2. Aynı oturumdaysa workflow'u önbellekten sürdür:
   `Workflow({scriptPath: "/root/.claude/projects/-home-user-yugioh/075f4e29-85e5-5b7b-8195-968ba2bdb54b/workflows/scripts/lane-d-cards-wf_ec97f149-c20.js", resumeFromRunId: "wf_ec97f149-c20"})`
   (bitmiş 30 ajan önbellekten döner; kalanlar canlı koşar.) Script ve journal konteynere özel: yeni konteynerde yoksa,
   bu bölümdeki "Yarıda/başlamadı" listesinden aynı akışla (fix1 → crit2/fix2 → crit3/fix3 → verify → commit; sonra
   sovereign) yeni bir workflow kur; el kitabı `docs/v3/oturum-d-rehber.md`.
3. Her ~30 dakikada WIP commit + push (typecheck temizse).
4. Tüm kartlar kapılardan geçince bu dosyaya son özeti yaz ve push et.
