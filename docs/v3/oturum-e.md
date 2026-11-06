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
  Koruyucu Tılsım olayları tek kolektif yükselişte). SFX: `src/audio/v3/e/void_eye.ts` (15 tarif, `e_void*`).
- Senaryolar: `src/duel/scenarios/e_void_eye.ts` (eVoid, eVoidP2, eVoidQuick, eVoidSet, eVoidSetP2, eVoidOne,
  eVoidCharm, eVoidSovereign, eVoidEquip); test `tests/e/void_eye.test.ts`.
- Kanıt: `shots/e/void_eye/r2/` (quick.png, quick_zoom.png, quick_pull.png, quick_tear.png, quick_land.png, p2_full.png,
  p2_rise.png, token.png, art/, sfx/, measure.json, measure-quick.json).
- Eleştiri turu 1 düzeltmeleri: renk çarpımı (setTint) yok — kasılmada 1 beyaz kare, sonra void3/void2 dolgu + void4
  kenar; gece örtüsü (mürekkep, 4 adım, TILE_FX altı) sahayı ~%30 karartır; göz katmanı birimlerin ARKASINDA
  (arka sıra önünde durur); yutuş = 4 adımlı çekiş + gözbebeğine yakınsayan çizgiler + kenarda zerre patlaması;
  kapanış + iki ayrı kırpma (100 ms kapalı bekleme); büyük damla (7×10), asılma, lekeli iki halkalı sıçrama;
  e_voidSwell yalnız 28 Hz katları (tremolo yok), e_voidGulp cam emiş → cam çimdik (chasmShut LSD 17,4 dB);
  kartlar göz kırparken mezarlığa (kendi e_voidCard sesi, cardPlace yok); magic_hat sahte şapkası da yükselir.
- Eleştiri turu 2 düzeltmeleri: göz katmanı artık birimlerin ve destelerin ÖNÜNDE (DEPTH.FX+1; yükselen gövdeler
  altında, çekişteki silüetler önünde) — kalabalık sahada arka sıra gözü kapatmaz; göz büyüdü (EW 30, EH 46: 71×93 px);
  oturma yerleri HUD bandının altında (kutu üstü ≥ y 40, kalabalık kol yana sıkışır); dönüş = 2 adet 4 karelik
  sıkışma-dönüş + 1 px void4 dış hat (dolgu yok); kasılma = beyaz 1 px dış hat + void3 gövde (beyaz ≤ %1,33);
  çekiş kasılmadan 1 kare sonra hepsi birlikte başlar, gövdeler 0,8 → 0,55 → 0,3 küçülür; kartlar çekişte (≤ 240 ms)
  eve gider, kırpmalar durgun sahada; kapalı göz = kirpikli kapak dikişi, ikinci kırpmadan sonra 120 ms'de yarığa
  kapanır; damla 9×13 + 1 karelik beyaz parıltı, kurtarılan canavarın altına düşmez. SFX: tik +6,5 dB ve önünde 30 ms
  sessizlik; swell 1,6 sn, tepesi kasılmada, gövdesi 112–336 Hz; e_voidGulp aşağı/içe emiş (Lid ile LSD 12,1 dB);
  yeni e_voidTwitch (iris bakınması) ve e_voidTink (damla şişmesi). Resim: iris aşağı bakar, bulut lopları kapakların
  üstünde ve yanlarında, iki yanda 5 okunur silüet (kurt, yarasa-kanat ejder, boynuzlu iblis, kuşlar).
- Kanıt (tur 2): `shots/e/void_eye/r3/` (quick.png, eye_open.png, contract.png, pull40.png, tear.png, seam.png,
  set.png, p2.png, one.png, art/, sfx/, measure.json).
- Ölçüm (oyun ms): eVoidQuick/One/Charm 5,53 sn, eVoidSet 5,52 sn (pay 5,57 sn); kamera 0.
  Sahibin kararı: sabit süre sınırı yok.

### S5 Harman Eleği (`winnow_sieve`)
- Resim: `src/art/cardart-v3/winnow_sieve.ts` (88×68 + elle 44×34, 4 kare yaşayan resim: gün ışığında — sıcak gök
  bandı + kademeli güneş parıltısı — sallanan elek, iki yanında sallama çizgileri, havada 2×1 taneler, üç kart,
  sağa savrulan 2 px'lik saman şeridi; yığın tonlu, kaydırmalı 2×1 tane çizgileri). Sinematik:
  `src/cinematics/spells/winnow_sieve.ts` (activate kancası: ~100 px'lik DEV hasır elek oyuncunun tarafının ortasında
  örülür, buğday dökülür, 4 devir 6 Hz ±6 px sallama + her vuruşta 1 karelik basılma, yığın kenara yığılır ve taneler
  kenardan uçar; üç kart altın patlamasıyla takla atarak ~26 px zıplar ve tek bir parabolde ele iner, el kartı ancak
  yuvasının ~40 px üstünde devralır; üçüncü atış doruk: derin çöküş, hit-stop, beyaz kenar parlaması, 70 tane.
  Elek seçim boyunca alçakta bekler — `registerEvent('discard', öncelik 2)`: kartlar eleğe düşer, tanelere yarı
  gömülür (ön çemberin arkasında), samana döner, elle çizilmiş 2 px'lik başaklı saplara ayrılır; üç düz kurdele
  rüzgar ve incelen saman bulutu onları mezarlığa savurur; elek çözülür). Elek, birimlerin ATK/DEF plakalarının
  üstünde çizilir (FX_TOP). SFX: `src/audio/v3/e/winnow_sieve.ts` (15 tarif, `e_sieve*`; savurma artık dar, yüksek,
  ≤0,35 sn'lik bir harman yelpazesi nefesi + saman tıkırtıları, mezarlığa doğru panlanır: `e_sieveGustR/L`).
- Senaryolar: `src/duel/scenarios/e_winnow_sieve.ts` (eSieve, eSieveP2, eSieveSet, eSieveSetP2, eSieveBare,
  eSieveSeal, eSieveSealP2, eSieveUi, eSievePlay); test `tests/e/winnow_sieve.test.ts`.
- Kanıt: `shots/e/winnow_sieve/r2/` (shake.png, toss3.png, toss3b.png, disc.png, straw.png, gust.png, p2.png,
  p2disc.png, set.png, art/, measure.json), ses: `shots/e/winnow_sieve/r2sfx/`.
- Ölçüm (oyun ms): eSieve etkinleştirme 3,92 sn + atma 1,77 sn; kamera 0. eSieveSeal'in 1f/38px kamerası ortak
  kazanma sahnesidir (eWellPailSeal de aynı: 1f/38px). Ses ayrımı (LSD): savurma ↔ e_strawGust 15,6 dB, ↔ e_galeSweep
  25,8, ↔ e_galeStir 18,0; sallama ↔ e_wellShake 11,1; atış ↔ e_wellLeap 10,6, büyük atış ↔ e_wellLeap 10,3.
- Düzeltme turu 3 (eleştirmen 6/10): elek artık birimlerle zemin y'sine göre sıralanır (UNIT + y; önündeki birim
  onu örter, ATK/DEF plakaları hep üstte), iki oyuncuda da arka sıranın orta büyü/tuzak karosunda durur; ışık havuzu
  tek tam basamak (yoğunluk 1, 'steady': dama deseni yok); yığın 3 ton bandı + sallanmayı izleyen parıltı, tanedeki
  kart sırtları açık kenar + oyuncu amblemi; atış kartı önce ~30-40 px DİKEY zıplar, sonra ele kıvrılır, boyutlar
  uçuşun beşte birinde bir adım (pop yok), %62'de yüzü düz; 1. atış 4. sallama devrinin altında; 3. atış: tüm kenar
  BEYAZ, kenardan dışa kırılan beyaz→altın halka + zemin halkası, 2× yüksek 96 taneli fıskiye, 3 px geri tepme, altın
  izli kart; sesi 0,92 perdede, 70 Hz alt vuruş, uzun tane yağmuru (atıştan ~4,5 LU yüksek). Çözülme: tane süzülür,
  çember arkadan 6 yay hâlinde 1 px'lik eğik şeritler olarak soyulup rüzgarla uçar, ızgara sıraları zemine düşen
  liflere dönüşür. Yeni ses `e_sieveCatch` (kart ele oturunca kâğıt tıkı); `e_sieveStraw` 0,20 sn; `e_sieveShake`
  −5,7 dBFS tepe, ağırlık merkezi ~2,4 kHz. Resim: güneş net disk + halka, gök gece tonlarında, saman ayrı ayrı
  başaklı saplar (şimşek okuması yok), küçük resimde tane tepesi + gölge sırası.
  Ölçüm: eSieve bitiş 6050 ms (900 ms senaryo beklemesi dahil; önce 6600), seçim istemi ~3,2 sn'de (önce 3,96).
  Kanıt: `shots/e/winnow_sieve/r3/` (p1.png, p1toss.png, toss1c.png, p2.png, p2z.png, p2disc.png, pool.png,
  disc.png, unravel2.png, set.png, sealp2.png, art/, measure.json), ses `shots/e/winnow_sieve/r3sfx/`.

### S9 Saman Korkuluklar (`straw_decoys`)
- Resim: `src/art/cardart-v3/straw_decoys.ts` (88×68 + elle çizilmiş 44×34, 4 kare yaşayan resim: alacakaranlık
  bandı (void1) + sürülmüş tarla sıraları, kolları açık üç korkuluk, turkuaz büyü güneşinin önünden geçen karga
  (yalnız büyük resimde), ellerden rüzgarla akan saman; küçük resimde yan korkuluklar ayrı damga: koyu şapka /
  açık çuval yüz).
- Sinematik: `src/cinematics/spells/straw_decoys.ts`. Kritik turu 1 düzeltmeleri: tüm işaretler TEK saatten
  (W0 = son saplanma; sahnenin ölçekli saati `SceneClock` — `scene.time.now` ölçeksizdir, eski ×1,35 kaymanın
  ve göz/karga çakışmasının sebebi buydu); patlama HUD bandının altında (y ≥ 40), kazık düşüş yüksekliği sıraya
  göre; saplanmada 2 karelik ezilme + toprak halkası + son kazıkta 2 px sarsıntı; rüzgar son kazığın titremesiyle
  örtüşür (ölü boşluk yok), P1 sol→sağ / P2 sağ→sol; kahraman vuruşu: ışık kenarlı 30×18 karga sıranın üstünden
  süzülür, geçtiği her korkuluğun 2×2 düğme gözleri yanar, son korkuluğun dış koluna konar (kol eğilir), gagası
  açık iki kez gaklar; el değiştirme: karga ürküp kalkar, saman tabandan yukarı tırmanan pürüzlü bir altın
  kenarla korkuluğu jetonun kendi piksellerine yeniden sarar (jeton sanatından okunur; jetonda olmayan ceket/şapka
  rüzgarda kırıntı olarak dökülür). `target` kancası: 2 px altın saman çizgisi saldıranı "kancalar", saldıranın
  başı döner, eski ok kaybolur, korkuluğa yeni ok + altın kilit (AttackHold yeni işaretlerle yeniden saklanır).
- SFX: `src/audio/v3/e/straw_decoys.ts` (`e_straw*`): yeni alçak/geniş tarla rüzgarı (e_strawGust, LSD
  e_sieveGust'a 33,5 dB), toprağa giren kazık "tok" (e_dieTak'a 14–16 dB), e_strawWrap/WrapR (yönlü),
  e_strawHand, e_strawPerch, e_strawWake, e_strawHook.
- Senaryolar: `src/duel/scenarios/e_straw_decoys.ts` (eStrawAttack, eStrawAttackP2, eStrawAttackWait, eStrawAttack3,
  eStrawOwn, eStrawOwnP2, eStrawSet, eStrawSetP2, eStrawOne, eStrawSummon); test `tests/e/straw_decoys.test.ts`.
- Kanıt: `shots/e/straw_decoys/r4/` (own_hero2.png, crow_perch3.png, ownP2_morph2.png, attack.png, lure.png,
  measure.json), `art4/`, `sfx3/`.
- Açık: jeton sprite'ı D lane'inin; şimdiki yer tutucuda ceket/şapka yok, dönüşüm bunu kırıntıyla dürüstçe
  gösterir; D'nin §7 jetonu şapkalı olacak.

## Kontrol noktası (WIP, 2026-10-31 ~20:00 UTC)
Orkestratörün isteğiyle ara kayıt (kullanım sınırı yaklaşıyor). İş akışı (`lane-e-cards`, kart başına
kurucu → 3 bağımsız eleştiri+düzeltme turu → çekişmeli doğrulama → commit) sürüyor; bu commit o anki ağacı
olduğu gibi (yarım kartlar dahil) kaydeder. Sıradaki: kalan kartların turları, sonra v1 / a6v1 film kapıları,
kamera kapısı, palcheck ve son özet. Kart başına bitmiş commit'ler "Lane E: <id>" başlığıyla gelecek.

## DURAKLATILDI (2026-11-01, sahip kararı: haftalık kullanım sınırı) — devam talimatı
Durum: 14 öğenin hepsinin ilk yapımı (kurucu) ve 1. bağımsız eleştirisi bitti (iş akışı önbelleğinde).
1. tur düzeltmeleri (fix1) çalışırken durduruldu: yarım düzeltmeler ağaçta ve bu commit'te (WIP). Hiçbir kart
henüz 3 turu, doğrulamayı ve kendi "Lane E: <id>" commit'ini tamamlamadı.

**Devam (aynı oturumda, önbellekten):**
`Workflow({ scriptPath: "/root/.claude/projects/-home-user-yugioh/5469a051-b52a-5876-bb1d-752cb3b1b10f/workflows/scripts/lane-e-cards-wf_1a820ab7-95d.js", resumeFromRunId: "wf_1a820ab7-95d" })`
— tools + 14 build + 14 crit1 sonucu önbellekten döner; fix1'den itibaren canlı çalışır (fix1 ajanları ağaçtaki
yarım düzenlemeleri görüp sürdürür). 30 dakikalık WIP commit döngüsü:
`/tmp/claude-0/-home-user-yugioh/5469a051-b52a-5876-bb1d-752cb3b1b10f/scratchpad/autockpt.sh` (arka planda başlat).

**Yeni oturumdan devam (önbellek yoksa):** betik dosyası yukarıdaki yolda (yoksa bu belgenin altyapı bölümü +
`docs/v3/PARALEL_OTURUMLAR.md` ile yeniden yazılır). Her kart için sıradaki adımlar: 1. tur eleştirisini
yeniden üret (yeni bağımsız eleştirmen) → düzelt → 2. ve 3. eleştiri+düzeltme turları → çekişmeli doğrulama
(typecheck, ilgili vitest, palcheck, measure + kamera, P1/P2 senaryoları) → kart başına commit + push.
Sonda: `filmdiff --set v1` (17/17) ve `--set a6v1` (26/26) kapıları (tabanlar `shots/` altında, konteynere özel —
yeni konteynerde 684e290'dan yeniden yazılmalı), tam `npm test`, son özet.

**Ortam:** yeni konteynerde `npm ci` ve `ln -s /opt/pw-browsers/chromium-1243/chrome-linux64 /opt/pw-browsers/chromium-1243/chrome-linux`.

**Zamanlama kararı (orkestratör):** §7 storyboard süresi REHBER §5 2,9 sn sınırına üstün gelir:
kabul = (açılış ≤ 0,7 sn + §7 imza süresi) × 1,35 + 0,3 sn. Sahibe açık soru olarak kalır.
