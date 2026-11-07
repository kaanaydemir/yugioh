#!/usr/bin/env bash
# Rebuild the Prism Duel Steam trailer from the code (≈ 15–20 min on 4 cores).
#   bash marketing/trailer/build/build.sh            # everything
#   bash marketing/trailer/build/build.sh --only a,b # recapture some shots, then audio + master + encode
set -e
cd "$(dirname "$0")/../../.."
node marketing/trailer/build/capture.mjs --jobs 3 "$@"   # frames (1x) + sfx logs -> build/cache/<shot>/
node marketing/trailer/build/audio.mjs                   # offline render -> build/cache/soundtrack_raw.wav
bash marketing/trailer/build/master.sh                   # loudnorm -> build/cache/soundtrack.wav
python3 marketing/trailer/build/assemble.py              # cut + 3x neighbour + encode -> ../prism_duel_trailer_1080p.mp4
