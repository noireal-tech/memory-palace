# Builds textures/ from the generated source images in tools/src-images/ (stone.png, plaster.png, ...):
# runs tools/materials.py on each with the settings below and writes textures/index.json for the app.
# Usage: python3 tools/build-textures.py [names...]   (no names: all that have a source image)
import json, os, subprocess, sys, glob
HERE = os.path.dirname(os.path.abspath(__file__)); SRC = os.path.join(HERE, 'src-images'); OUT = os.path.join(HERE, '..', 'textures')
# name: (size, normal strength, roughness low, high, invert roughness, seamless, metres one copy covers)
SETS = {
    'stone':   (4096, 7.0, 0.70, 0.95, False, True, 4.0),
    'plaster': (4096, 2.0, 0.80, 0.95, False, True, 3.0),
    'timber':  (4096, 4.0, 0.55, 0.85, False, True, 2.0),
    'roof':    (4096, 6.0, 0.30, 0.70, True,  True, 2.4),
    'gate':    (4096, 4.0, 0.40, 0.80, False, False, None),
    'paving':  (4096, 4.0, 0.60, 0.90, False, True, 4.0),
    'gravel':  (2048, 5.0, 0.85, 0.98, False, True, 2.5),
    'grass':   (2048, 3.0, 0.90, 1.00, False, True, 3.0),
    'bark':    (2048, 6.0, 0.80, 0.98, False, True, None),
    'blossom': (2048, 3.0, 0.70, 0.90, False, True, None),
    'pine':    (2048, 4.0, 0.75, 0.95, False, True, None),
    'window':  (2048, 3.0, 0.60, 0.90, False, False, None),
    'shoji':   (2048, 1.5, 0.80, 0.95, False, False, None),
}
def find(name):
    for ext in ('png', 'jpg', 'jpeg', 'webp'):
        p = os.path.join(SRC, name + '.' + ext)
        if os.path.exists(p): return p
    return None
names = sys.argv[1:] or [n for n in SETS if find(n)]
ix_path = os.path.join(OUT, 'index.json'); os.makedirs(OUT, exist_ok=True)
index = json.load(open(ix_path)) if os.path.exists(ix_path) else {}
for n in names:
    src = find(n)
    if not src: print('no source image for', n); continue
    size, strength, lo, hi, inv, seam, tile = SETS[n]
    args = ['python3', os.path.join(HERE, 'materials.py'), src, n, str(size), str(strength), str(lo), str(hi), 'invert' if inv else 'keep', 'seam' if seam else 'noseam']
    subprocess.run(args, check=True)
    # lo: the standard set, always loaded; hi: full resolution, loaded only inside the detail bubble
    e = {'files': [n + '-1k.jpg', n + '-n-1k.jpg', n + '-r.jpg'], 'hi': [n + '.jpg', n + '-n.jpg'], 'hiSize': size}
    if tile: e['tile'] = tile
    index[n] = e
json.dump(index, open(ix_path, 'w'), indent=2, sort_keys=True); open(ix_path, 'a').write('\n')
print('index:', ', '.join(sorted(index)))
