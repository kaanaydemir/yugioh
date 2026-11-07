cd "$(dirname "$0")/../../.."; O=marketing/steam
s(){ out=$1; shift; node tools/shot.mjs "$@" --scale 3 --out $O/$out 2>&1 | grep -iE "error|exception" ; echo "done $out"; }
s screenshot_01_title.png "?dev=title&at=attract&look=v3" --eval "const N=window.__neon; N.freeze(); await N.step(2500); N.title.logo.prismSweep(900,0); await N.step(420);" &
s screenshot_02_board.png "?dev=steam&s=stBoard&look=v3" --fresh --step 1500 &
s screenshot_03_crystal_wyrm_summon.png "?dev=duel&s=suWyrm&look=v3" --fresh --step 3080 &
wait
s screenshot_04_ashen_drake_attack.png "?dev=duel&s=kaAdAtk&look=v3" --fresh --step 1590 &
s screenshot_05_mirror_barrier.png "?dev=duel&s=tbMirror&look=v3" --fresh --step 1660 &
s screenshot_06_void_eye.png "?dev=duel&s=b2WipeAuto&look=v3" --fresh --step 1800 &
wait
s screenshot_07_judgment_bolt.png "?dev=duel&s=spBoltAce&look=v3" --fresh --step 780 &
s screenshot_08_crystal_shatter.png "?dev=duel&s=psTrade&look=v3" --fresh --step 2890 &
s screenshot_09_deck_builder.png "?dev=deck&fill=legal&sort=level&cursor=1&look=v3" --wait 2500 &
wait
( D=$(mktemp -d); node tools/shot.mjs "?dev=title&at=gallery&card=polar_sovereign&look=v3" --film 8 --every 400 --scale 3 --frames $D --out $D/sheet.png >/dev/null 2>&1; cp $D/f0007.png $O/screenshot_10_card_gallery.png; echo "done gallery (film frame 7, t=2800)" ) &
s screenshot_11_ashen_drake_cutin.png "?dev=duel&s=kaAdSummon&look=v3" --fresh --step 3300 &
wait
