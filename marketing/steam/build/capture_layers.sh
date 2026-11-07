#!/bin/bash
# capture every capsule layer at 1x into $L
cd "$(dirname "$0")/../../.."
L=marketing/steam/build/layers; mkdir -p $L
sh(){ node tools/shot.mjs "?dev=steam&cap=$1&look=v3" --wait 2500 --scale 1 --clip 0,0,$2 --out $L/$1.png 2>&1 | grep -iE "error|fail"; }
sh header 460,215 & sh small 462,174 & sh main 616,353 & wait
sh hero 480,155 & sh vertical 187,224 & sh library 200,300 & wait
node tools/shot.mjs "?dev=steam&cap=icon" --scale 1 --clip 0,0,92,92 --out $L/icon.png >/dev/null 2>&1 &
for bg in 000000 ffffff; do
  node tools/shot.mjs "?dev=steam&cap=logo&prism=16&bg=$bg" --scale 1 --out $L/logo_$bg.png >/dev/null 2>&1 &
  node tools/shot.mjs "?dev=steam&cap=logo&stack=1&prism=16&bg=$bg" --scale 1 --out $L/logost_$bg.png >/dev/null 2>&1 &
done
wait
ls -la $L
