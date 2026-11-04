# Turns a generated material image into the app's texture set:
#   1. flatten the lighting (divide out large, soft brightness changes) so the game's own sun and sky do the lighting
#   2. make it tile seamlessly: shift it by half, then patch the old border back along the cut where the two copies
#      agree best (a minimum-error cut, as in image quilting), so there's no visible seam and no ghosting
#   3. derive relief (a normal map) and roughness from the picture's detail
#   4. write the full-resolution set (<name>.jpg, <name>-n.jpg: loaded only near you) and a standard 1K set
#      (<name>-1k.jpg, <name>-n-1k.jpg: always), plus roughness (<name>-r.jpg)
# Usage: python3 tools/materials.py <source image> <name> <size> <normal strength> <rough lo> <rough hi> [invert-rough]
import sys, os
import numpy as np
from PIL import Image, ImageFilter

def load(p, square=True):
    im = Image.open(p).convert('RGB')
    if square:
        s = min(im.size); l = (im.width - s) // 2; t = (im.height - s) // 2; im = im.crop((l, t, l + s, t + s))
    return np.asarray(im, dtype=np.float32) / 255.0

def seam_score(a):
    # how much worse the wrap-around joins are than an ordinary pair of neighbouring columns/rows (1 = seamless)
    inner = (np.abs(np.diff(a, axis=1)).mean() + np.abs(np.diff(a, axis=0)).mean()) / 2
    wrap = (np.abs(a[:, 0] - a[:, -1]).mean() + np.abs(a[0] - a[-1]).mean()) / 2
    return wrap / max(inner, 1e-6)

def blur(a, r):
    im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r)), dtype=np.float32) / 255.0

def flatten(a):
    # big soft light falloff and shading gradients removed; local detail kept
    lum = a.mean(axis=2, keepdims=True)
    low = blur(np.repeat(lum, 3, axis=2), a.shape[0] / 10)[:, :, :1]
    return np.clip(a * (lum.mean() / np.maximum(low, 0.02)), 0, 1)

def min_cut_cols(err):
    # err: H x B costs; a top-to-bottom path, one column per row, moving at most one column per row
    H, B = err.shape; acc = err.copy(); back = np.zeros((H, B), dtype=np.int32)
    for y in range(1, H):
        left = np.r_[np.inf, acc[y - 1, :-1]]; mid = acc[y - 1]; right = np.r_[acc[y - 1, 1:], np.inf]
        choice = np.stack([left, mid, right]); k = choice.argmin(axis=0)
        acc[y] += choice[k, np.arange(B)]; back[y] = np.arange(B) + k - 1
    path = np.zeros(H, dtype=np.int32); path[-1] = int(acc[-1].argmin())
    for y in range(H - 1, 0, -1): path[y - 1] = back[y, path[y]]
    return path

def seamless_x(a, band):
    # R = a shifted by half: its borders join seamlessly; its middle has the old seam. Cover that middle with the
    # original picture (whose middle has no seam), cut along the best path on each side of the old seam.
    H, W, _ = a.shape; R = np.roll(a, W // 2, axis=1); out = R.copy(); c = W // 2
    diff = ((R - a) ** 2).sum(axis=2)
    lo, hi = c - band, c + band
    # left cut in [lo-band, lo), right cut in (hi, hi+band]
    pl = min_cut_cols(diff[:, lo - band:lo]) + lo - band
    pr = min_cut_cols(diff[:, hi:hi + band]) + hi
    feather = 3
    for y in range(H):
        x0, x1 = pl[y], pr[y]
        out[y, x0:x1] = a[y, x0:x1]
        for f in range(1, feather + 1):  # soften each cut over a few pixels
            w = f / (feather + 1)
            if x0 - f >= 0: out[y, x0 - f] = a[y, x0 - f] * (1 - w) + R[y, x0 - f] * w
            if x1 + f - 1 < W: out[y, x1 + f - 1] = a[y, x1 + f - 1] * (1 - w) + R[y, x1 + f - 1] * w
    return out

def seamless(a):
    band = max(16, a.shape[0] // 10)
    a = seamless_x(a, band)
    return np.transpose(seamless_x(np.transpose(a, (1, 0, 2)), band), (1, 0, 2))

def period(profile, lo, hi):
    # the repeat length of a regular pattern (tile rows, courses): the strongest self-match between lo and hi pixels
    x = profile - profile.mean(); best, bp = -1, None
    for p in range(lo, hi):
        c = (x[:-p] * x[p:]).mean()
        if c > best: best, bp = c, p
    return bp

def periodic_crop(a):
    # crop a regular pattern to a whole number of repeats each way, so it tiles exactly
    g = a.mean(axis=2); H, W = g.shape
    px = period(np.abs(np.diff(g, axis=1)).mean(axis=0), W // 40, W // 4)
    py = period(np.abs(np.diff(g, axis=0)).mean(axis=1), H // 40, H // 4)
    # refine: the multiple of the period closest to the full width whose two ends match best
    def best_len(axis, p, n):
        cands = [k * p + d for k in range(n // p, max(1, n // p - 3), -1) for d in range(-3, 4) if 0 < k * p + d <= n]
        def err(L): return np.abs(a[:, 0] - a[:, L - 1 + 1 if L < n else L - 1]).mean() if axis == 1 else np.abs(a[0] - a[L - 1 + 1 if L < n else L - 1]).mean()
        def joint(L):
            if axis == 1: return np.abs(a[:, 0] - a[:, L % n]).mean() if L < n else 9
            return np.abs(a[0] - a[L % n]).mean() if L < n else 9
        return min(cands, key=joint)
    Lx, Ly = best_len(1, px, W), best_len(0, py, H)
    print('periods', px, py, '-> crop', Lx, Ly)
    return a[:Ly, :Lx]

def normal_map(a, strength):
    lum = a @ np.array([0.3, 0.59, 0.11], dtype=np.float32)
    h = lum - blur(np.repeat(lum[:, :, None], 3, axis=2), a.shape[0] / 64)[:, :, 0]  # detail only
    h = blur(np.repeat(h[:, :, None] * 0.5 + 0.5, 3, axis=2), 1.2)[:, :, 0]
    dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * strength
    dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * strength
    n = np.stack([-dx, dy, np.ones_like(dx)], axis=2)
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * 0.5 + 0.5

def roughness(a, lo, hi, invert):
    lum = a.mean(axis=2)
    d = lum - blur(np.repeat(lum[:, :, None], 3, axis=2), a.shape[0] / 48)[:, :, 0]
    t = np.clip(0.5 + d * 3, 0, 1)
    if invert: t = 1 - t
    return lo + (hi - lo) * t

def main():
    src, name, size, strength, rlo, rhi = sys.argv[1], sys.argv[2], int(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5]), float(sys.argv[6])
    invert = len(sys.argv) > 7 and sys.argv[7] == 'invert'
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'textures')
    os.makedirs(out, exist_ok=True)
    tiling = len(sys.argv) <= 8 or sys.argv[8] != 'noseam'
    crop = [float(v) for v in sys.argv[9].split(',')] if len(sys.argv) > 9 else None   # l,t,r,b fractions to trim (panels)
    a = load(src, square=tiling)
    if crop:
        H, W = a.shape[:2]; a = a[int(H * crop[1]):H - int(H * crop[3]), int(W * crop[0]):W - int(W * crop[2])]
    if tiling:
        a = flatten(a)
        if os.environ.get('PERIODIC'): a = periodic_crop(a); a = np.asarray(Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8)).resize((size, size), Image.LANCZOS), dtype=np.float32) / 255.0
        sc = seam_score(a)
        if sc > 1.6: a = seamless(a)   # images that already tile are left alone
        print(name, 'seam score', round(sc, 2), '-> made seamless' if sc > 1.6 else '-> already tiles')
    def save(arr, fn, sz, q):
        im = Image.fromarray(np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8))
        h = round(sz * im.size[1] / im.size[0])
        if im.size != (sz, h): im = im.resize((sz, h), Image.LANCZOS)
        im.save(os.path.join(out, fn), quality=q, optimize=True, progressive=False)
    save(a, name + '.jpg', size, 88)
    save(a, name + '-1k.jpg', 1024, 86)               # standard: everywhere, and always loaded
    sw = min(size, 2048); sh = round(sw * a.shape[0] / a.shape[1])
    small = np.asarray(Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8)).resize((sw, sh), Image.LANCZOS), dtype=np.float32) / 255.0
    nm = normal_map(small, strength)
    save(nm, name + '-n.jpg', min(size, 2048), 90)
    save(nm, name + '-n-1k.jpg', 1024, 88)
    r = roughness(small, rlo, rhi, invert)
    save(np.repeat(r[:, :, None], 3, axis=2), name + '-r.jpg', 1024, 85)
    print(name, 'done', size)

main()
