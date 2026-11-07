#!/usr/bin/env bash
# Master the soundtrack: two-pass EBU R128 loudnorm (linear) to -16 LUFS, true peak <= -2.2 dBTP
# (headroom for the AAC encode), 48 kHz stereo 24-bit. cache/soundtrack_raw.wav -> cache/soundtrack.wav
set -e
cd "$(dirname "$0")/cache"
J=$(ffmpeg -hide_banner -i soundtrack_raw.wav -af loudnorm=I=-16:TP=-2.2:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g(){ echo "$J" | python3 -c "import json,sys; print(json.load(sys.stdin)['$1'])"; }
ffmpeg -v error -y -i soundtrack_raw.wav -af "loudnorm=I=-16:TP=-2.2:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=48000" -c:a pcm_s24le soundtrack.wav
echo "mastered: input I=$(g input_i) TP=$(g input_tp)"
