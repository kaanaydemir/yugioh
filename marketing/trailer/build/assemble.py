#!/usr/bin/env python3
"""Cut the captured 1x frames into the edit (shots.mjs timeline), add the few pixel flash transitions, then
encode the 1920x1080 / 60 fps master with the mastered soundtrack.

  python3 marketing/trailer/build/assemble.py            # frames + encode (needs cache/soundtrack.wav)
  python3 marketing/trailer/build/assemble.py --frames   # only the timeline frames (cache/timeline/)

Upscale: ffmpeg scale=1920:1080:flags=neighbor -- an exact 3x nearest-neighbour blow-up of 640x360 (every art
pixel a crisp 3x3 block). Transitions are hard cuts; FLASH lists the cuts that get a short white flash
(a stepped fade over 3 frames, computed on the 1x frame, so it stays flat and crisp).
"""
import json, os, shutil, subprocess, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
CACHE = os.path.join(HERE, 'cache')
OUT = os.path.join(ROOT, 'marketing/trailer/prism_duel_trailer_1080p.mp4')

tl = json.loads(subprocess.check_output(['node', '-e', "import('./shots.mjs').then(m=>console.log(JSON.stringify(m.timeline())))"], cwd=HERE))
# shot name -> white-flash strength of its first frames (the cut INTO that shot)
FLASH = {'logo': [0.85, 0.5, 0.2], 'voidEye': [0.7, 0.35, 0.12], 'end': [0.85, 0.5, 0.2], 'board': [0.5, 0.2]}

dst = os.path.join(CACHE, 'timeline')
shutil.rmtree(dst, ignore_errors=True)
os.makedirs(dst)
n = 0
edl = []
for s in tl:
    src = os.path.join(CACHE, s['name'])
    edl.append((s['name'], s['start'], s['len']))
    for i in range(s['len']):
        p = os.path.join(src, 'f%05d.png' % i)
        if not os.path.exists(p):
            sys.exit('missing frame %s' % p)
        out = os.path.join(dst, 'f%05d.png' % n)
        fl = FLASH.get(s['name'], [])
        if i < len(fl):
            im = Image.open(p).convert('RGB')
            Image.blend(im, Image.new('RGB', im.size, (255, 255, 255)), fl[i]).save(out)
        else:
            os.symlink(p, out)
        n += 1
print('timeline frames:', n, '(%.2f s)' % (n / 60))
for e in edl:
    print('  %-12s %6.2f s  %4d frames' % (e[0], e[1] / 60, e[2]))
if '--frames' in sys.argv:
    sys.exit(0)

wav = os.path.join(CACHE, 'soundtrack.wav')
cmd = ['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', os.path.join(dst, 'f%05d.png'), '-i', wav,
       '-vf', 'scale=1920:1080:flags=neighbor,format=yuv420p',
       '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-tune', 'animation', '-profile:v', 'high', '-r', '60',
       '-x264-params', 'keyint=60:min-keyint=60',
       '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-ac', '2',
       '-shortest', '-movflags', '+faststart', OUT]
subprocess.check_call(cmd)
print('wrote', OUT)
