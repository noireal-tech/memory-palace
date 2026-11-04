/* Memory Palace: materials painted in code. Each texture is worked out pixel by pixel from noise (colour, surface
   relief turned into a normal map, and roughness), in short slices so the headset keeps drawing. The result is kept on
   this device (IndexedDB) so later visits load it instead of painting it again. */
(function () {
  'use strict';
  var MP = window.MP, fbm = MP.fbm, hash = MP.hash, noise = MP.noise;
  var TEX_VERSION = 4; // bump when any recipe changes, so stored copies are replaced
  var maxAniso = 4;
  function setRenderer(r) { maxAniso = Math.min(8, r.capabilities.getMaxAnisotropy()); }

  function c255(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }
  function makeTex(src, srgb, w, h) {
    var t = src instanceof Uint8Array ? new THREE.DataTexture(src, w, h, THREE.RGBAFormat) : new THREE.Texture(src);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.flipY = false;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true; return t;
  }
  // Pixels to a PNG blob and back, for the stored copy.
  function toBlob(data, w, h) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d'), img = g.createImageData(w, h); img.data.set(data); g.putImageData(img, 0, 0);
    return new Promise(function (res) { c.toBlob(res, 'image/png'); });
  }
  async function fromBlob(b) {
    if (window.createImageBitmap) return createImageBitmap(b, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    var url = URL.createObjectURL(b), im = new Image(); im.src = url; await im.decode(); URL.revokeObjectURL(url); return im;
  }

  // paint(name, size, strength, fn): fn(u, v) returns [height 0..1, r, g, b (0..255), roughness 0..1].
  // Returns { map, normalMap, roughnessMap }.
  async function paint(name, size, strength, fn) {
    var key = 'tex:' + name + ':' + size + ':' + TEX_VERSION;
    try {
      var hit = await MP.store.get(key);
      if (hit && hit.map && hit.normal && hit.rough) {
        var imgs = await Promise.all([fromBlob(hit.map), fromBlob(hit.normal), fromBlob(hit.rough)]);
        return { map: makeTex(imgs[0], true), normalMap: makeTex(imgs[1], false), roughnessMap: makeTex(imgs[2], false), cached: true };
      }
    } catch (e) { MP.log('texture cache miss', name, e); }
    var n = size * size, H = new Float32Array(n), C = new Uint8Array(n * 4), R = new Uint8Array(n * 4), N = new Uint8Array(n * 4), y = 0;
    await MP.sliced(6, function () {
      for (var x = 0; x < size; x++) {
        var o = fn(x / size, y / size), i = y * size + x;
        H[i] = o[0]; C[i * 4] = c255(o[1]); C[i * 4 + 1] = c255(o[2]); C[i * 4 + 2] = c255(o[3]); C[i * 4 + 3] = 255;
        R[i * 4] = R[i * 4 + 1] = R[i * 4 + 2] = Math.round(MP.clamp(o[4], 0.02, 1) * 255); R[i * 4 + 3] = 255;
      }
      return ++y >= size;
    });
    y = 0;
    await MP.sliced(6, function () {
      for (var x = 0; x < size; x++) {
        var l = H[y * size + (x + size - 1) % size], r = H[y * size + (x + 1) % size], d = H[((y + size - 1) % size) * size + x], u = H[((y + 1) % size) * size + x];
        var nx = (l - r) * strength, ny = (d - u) * strength, len = Math.sqrt(nx * nx + ny * ny + 1), i = y * size + x;
        N[i * 4] = Math.round((nx / len * 0.5 + 0.5) * 255); N[i * 4 + 1] = Math.round((ny / len * 0.5 + 0.5) * 255); N[i * 4 + 2] = Math.round((1 / len * 0.5 + 0.5) * 255); N[i * 4 + 3] = 255;
      }
      return ++y >= size;
    });
    // keep a copy for next time (in the background; failure just means painting again next visit)
    Promise.all([toBlob(C, size, size), toBlob(N, size, size), toBlob(R, size, size)]).then(function (b) {
      if (b[0] && b[1] && b[2]) MP.store.set(key, { map: b[0], normal: b[1], rough: b[2] });
    }).catch(function () { });
    return { map: makeTex(C, true, size, size), normalMap: makeTex(N, false, size, size), roughnessMap: makeTex(R, false, size, size), cached: false };
  }

  // ---------- Recipes ----------
  // Irregular castle stonework (ishigaki): stones of varied size and shape packed in rough courses, deep dark joints.
  // Cells come from jittered points on a stretched grid; each pixel belongs to its nearest point.
  function stonework(seed, cols, rows, base, vary) {
    var P = [];
    for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++) P.push([(i + 0.15 + 0.7 * hash(i, j, seed)) / cols, (j + 0.2 + 0.6 * hash(i, j, seed + 1)) / rows, hash(i, j, seed + 2)]);
    return function (u, v) {
      var ci = Math.floor(u * cols), cj = Math.floor(v * rows), d1 = 9, d2 = 9, id = 0;
      for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) {
        var ii = (ci + di + cols) % cols, jj = (cj + dj + rows) % rows, p = P[jj * cols + ii];
        // a neighbour across the texture's edge sits one tile over, so the pattern tiles seamlessly
        var px = p[0] + (ci + di < 0 ? -1 : ci + di >= cols ? 1 : 0), py = p[1] + (cj + dj < 0 ? -1 : cj + dj >= rows ? 1 : 0);
        var dx = (u - px) * cols * 0.8, dy = (v - py) * rows, d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; id = p[2]; } else if (d < d2) d2 = d;
      }
      var edge = Math.sqrt(d2) - Math.sqrt(d1), g = fbm(u, v, 6, 4, seed + 5), f = fbm(u, v, 48, 2, seed + 7), sp = hash(Math.floor(u * 512), Math.floor(v * 512), seed + 9);
      var face = MP.smooth(0.025, 0.12, edge), dome = Math.min(1, edge * 1.8);
      var h = face * (0.55 + 0.35 * dome + 0.1 * g) + 0.06 * f;
      var t = (1 - vary + 2 * vary * id) * (0.86 + 0.28 * g) * (0.92 + 0.14 * f) * (sp > 0.992 ? 0.7 : sp < 0.006 ? 1.2 : 1);
      var lichen = MP.smooth(0.62, 0.8, fbm(u, v, 5, 3, seed + 11)) * 0.35;
      var r = base[0] * t, gg = base[1] * t, b = base[2] * t;
      r = MP.lerp(r, 92, lichen); gg = MP.lerp(gg, 104, lichen); b = MP.lerp(b, 70, lichen);
      if (face < 1) { var k = 0.4 + 0.6 * face; r *= k; gg *= k; b *= k; }
      return [h, r, gg, b, face < 0.5 ? 0.98 : 0.74 + 0.16 * g];
    };
  }
  // Cut granite paving: slabs in staggered courses.
  function paving(seed, rows, base) {
    var off = []; for (var r = 0; r < rows; r++) off.push(hash(r, 1, seed));
    return function (u, v) {
      var r = Math.floor(v * rows), fv = v * rows - r, cols = 2 + (r % 2), fu = (u * cols + off[r]) % 1, k = Math.floor(u * cols + off[r]) % cols;
      var dj = Math.min(fu, 1 - fu, fv * cols / rows * 1.6, (1 - fv) * cols / rows * 1.6), face = MP.smooth(0.008, 0.03, dj);
      var id = hash(r, k, seed + 3), g = fbm(u, v, 8, 4, seed + 4), f = fbm(u, v, 96, 2, seed + 6), sp = hash(Math.floor(u * 512), Math.floor(v * 512), seed + 8);
      var t = (0.9 + 0.18 * id) * (0.9 + 0.2 * g) * (0.94 + 0.1 * f) * (sp > 0.99 ? 0.78 : 1) * (0.55 + 0.45 * face);
      return [face * (0.8 + 0.1 * g) + 0.04 * f, base[0] * t, base[1] * t, base[2] * t, 0.72 + 0.2 * (1 - face) + 0.06 * g];
    };
  }
  var RECIPES = {
    stone: [512, 6, stonework(11, 5, 7, [132, 125, 112], 0.26)],
    paving: [512, 2.4, paving(23, 6, [170, 160, 142])],
    plaster: [512, 1.2, function (u, v) {
      var g = fbm(u, v, 4, 5, 31), f = fbm(u, v, 64, 2, 33), streak = fbm(u * 0.5, v * 4, 8, 3, 35);
      var t = 0.93 + 0.05 * g - 0.03 * f - 0.03 * MP.smooth(0.55, 0.8, streak);
      return [0.3 * g + 0.25 * f, 244 * t, 240 * t, 231 * t, 0.86 + 0.08 * f];
    }],
    timber: [512, 2.6, function (u, v) {
      var warp = fbm(u, v, 3, 3, 41), grain = 0.5 + 0.5 * Math.sin((u * 22 + warp * 3) * Math.PI * 2), fine = fbm(u * 6, v * 0.5, 32, 3, 45), plank = hash(Math.floor(u * 4), 7, 43);
      var t = (0.8 + 0.2 * grain) * (0.86 + 0.28 * plank) * (0.9 + 0.2 * fine);
      return [0.35 * grain + 0.4 * fine, 70 * t, 52 * t, 42 * t, 0.58 + 0.18 * grain];
    }],
    roof: [512, 6, function (u, v) {
      // round cover tiles running down the slope over concave pan tiles, courses overlapping
      var p = (u * 6) % 1, q = (v * 6) % 1, col = Math.floor(u * 6), row = Math.floor(v * 6), h;
      if (p < 0.3) { var a = (p - 0.15) / 0.15; h = 0.6 + 0.4 * Math.sqrt(Math.max(0, 1 - a * a)); } else { var b = (p - 0.65) / 0.35; h = 0.18 + 0.2 * b * b; }
      h += 0.18 * (1 - q); var id = hash(col, row, 51), g = fbm(u, v, 12, 3, 53), moss = MP.smooth(0.66, 0.85, fbm(u, v, 4, 3, 55)) * 0.3;
      var t = (0.88 + 0.22 * id) * (0.88 + 0.18 * g) * (q < 0.05 ? 0.62 : 1) * (p < 0.3 ? 1.06 : 0.92);
      return [h, MP.lerp(60 * t, 70, moss), MP.lerp(66 * t, 80, moss), MP.lerp(74 * t, 58, moss), 0.38 + 0.22 * g + moss];
    }],
    gravel: [512, 3.5, function (u, v) {
      var s = hash(Math.floor(u * 320), Math.floor(v * 320), 61), g = fbm(u, v, 160, 2, 63), rake = 0.5 + 0.5 * Math.sin(v * Math.PI * 2 * 12), big = fbm(u, v, 4, 3, 65);
      var t = (0.82 + 0.22 * s) * (0.96 + 0.04 * rake) * (0.9 + 0.18 * big);
      return [0.3 * rake + 0.45 * g + 0.25 * s, 186 * t, 178 * t, 160 * t, 0.94];
    }],
    grass: [512, 2.2, function (u, v) {
      var g = fbm(u, v, 4, 4, 71), b = fbm(u, v, 128, 2, 73), dry = 0.5 * MP.smooth(0.5, 0.8, fbm(u, v, 6, 3, 75)), clover = fbm(u, v, 24, 2, 77);
      var t = (0.72 + 0.46 * g) * (0.8 + 0.4 * b);
      return [0.55 * b + 0.25 * g + 0.2 * clover, (58 + 52 * dry) * t, (92 + 18 * dry - 10 * clover) * t, (34 + 18 * dry) * t, 0.95];
    }],
    shoji: [256, 2, function (u, v) {
      var lu = Math.abs(((u * 3) % 1) - 0.5), lv = Math.abs(((v * 4) % 1) - 0.5), edge = Math.min(u, v, 1 - u, 1 - v), g = fbm(u, v, 16, 3, 81);
      var frame = lu > 0.46 || lv > 0.46 || edge < 0.035;
      return frame ? [1, 54, 41, 33, 0.6] : [0.2 + 0.1 * g, 240, 230 - 6 * g, 204 - 10 * g, 0.9];
    }],
    gate: [256, 3.5, function (u, v) {
      var warp = fbm(u, v, 3, 3, 91), grain = 0.5 + 0.5 * Math.sin((u * 10 + warp * 1.4) * Math.PI * 2), su = (u * 5) % 1 - 0.5, sv = (v * 7) % 1 - 0.5;
      var band = Math.abs(((v * 3.5) % 1) - 0.5) > 0.45, stud = Math.hypot(su, sv) < 0.11;
      if (stud) return [1, 176, 140, 76, 0.28];
      if (band) return [0.8, 42, 40, 40, 0.42];
      return [0.35 * grain, 48 * (0.8 + 0.3 * grain), 34 * (0.8 + 0.3 * grain), 28, 0.6];
    }],
    // castle window: dark timber frame, upright bars, shadowed interior behind
    window: [256, 4, function (u, v) {
      var frame = Math.min(u, v, 1 - u, 1 - v) < 0.07, bar = Math.abs(((u - 0.07) / 0.86 * 6) % 1 - 0.5) > 0.36 && u > 0.07 && u < 0.93, g = fbm(u, v, 8, 3, 97);
      if (frame) return [1, 52, 40, 33, 0.62];
      if (bar) return [0.85, 222 * (0.94 + 0.06 * g), 218 * (0.94 + 0.06 * g), 208, 0.85];
      var dark = 0.5 + 0.5 * v; return [0.05, 26 * dark, 21 * dark, 18 * dark, 0.95];
    }],
    bark: [256, 4, function (u, v) {
      var furrow = Math.abs(Math.sin((u * 9 + fbm(u, v, 4, 3, 101) * 2) * Math.PI)), g = fbm(u, v, 16, 3, 103);
      var t = 0.55 + 0.45 * furrow * (0.8 + 0.3 * g);
      return [furrow * 0.8 + 0.2 * g, 86 * t, 72 * t, 62 * t, 0.9];
    }],
    water: [256, 5, function (u, v) {
      return [fbm(u, v, 6, 4, 111) * 0.65 + fbm(u, v, 24, 3, 113) * 0.35, 24, 46, 52, 0.05];
    }]
  };
  async function make(name) { var r = RECIPES[name]; return paint(name, r[0], r[1], r[2]); }

  // ---------- Generated photographic materials (textures/, made from Runway images by tools/materials.py) ----------
  // textures/index.json lists each set: { name: { tile: metres one copy covers, files: [colour, normal, roughness] } }.
  // A set that's listed is loaded instead of painting the recipe of the same name.
  var loader = new THREE.TextureLoader();
  function loadTex(url, srgb) {
    return new Promise(function (res, rej) {
      loader.load(url, function (t) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso; t.generateMipmaps = true;
        t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        res(t);
      }, undefined, rej);
    });
  }
  var index = null;
  async function photoIndex() {
    if (index) return index;
    try { var r = await fetch('textures/index.json', { cache: 'no-cache' }); index = r.ok ? await r.json() : {}; } catch (e) { index = {}; }
    if (MP.params.has('painted')) index = {}; // ?painted shows the code-painted look, for comparison
    return index;
  }
  async function loadSet(name) {
    var ix = await photoIndex(), e = ix[name]; if (!e) return null;
    var f = e.files, out = await Promise.all([loadTex('textures/' + f[0], true), f[1] ? loadTex('textures/' + f[1], false) : null, f[2] ? loadTex('textures/' + f[2], false) : null]);
    return { map: out[0], normalMap: out[1], roughnessMap: out[2], tile: e.tile || null, photo: true, roughLo: e.roughLo, roughHi: e.roughHi };
  }
  // A material set by name: the photographic one if present, otherwise painted here.
  async function get(name) { var s = await loadSet(name); return s || (RECIPES[name] ? make(name) : null); }
  MP.Tex = { setRenderer: setRenderer, paint: paint, make: make, get: get, photoIndex: photoIndex, names: Object.keys(RECIPES), version: TEX_VERSION };
})();
