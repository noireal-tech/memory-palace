/* Memory Palace: the site, the same under every skin. A stone platform in a moat, reached by a causeway and a stair;
   paved forecourt, spine and band streets on top, gardens between; land and layered hills beyond. */
(function () {
  'use strict';
  var MP = window.MP, G = MP.Geo, W = MP.World;
  var S = MP.SITE = {
    PLAT: [-60, -33, 60, 33],                 // platform top, y = 0
    BASE: 3.2,                                // platform top above the land
    MOAT: 11,                                 // moat width
    BANDS: { W2: -48, W1: -24, C: 0, E1: 24, E2: 48 },
    GARDENS: [[-38, -34], [-14, -10], [10, 14], [34, 38]],
    STEPS: 16, RUN: 0.4
  };
  S.WATER = -S.BASE - 0.55; S.RISE = S.BASE / S.STEPS; S.STAIR0 = S.PLAT[1] - S.STEPS * S.RUN;
  S.MO = [S.PLAT[0] - S.MOAT, S.PLAT[1] - S.MOAT, S.PLAT[2] + S.MOAT, S.PLAT[3] + S.MOAT];
  S.ARRIVE = { x: 0, z: -27.4, yaw: Math.PI };  // in the forecourt, facing the keep (north)

  function batter(d) { return 0.13 * d + 0.03 * d * d; } // the stone face leans back, steeper near the top

  // The stone base round the platform: battered and gently curved, from below the waterline to the platform's edge.
  function stoneBase(b) {
    var P = S.PLAT, depth = S.BASE + 1.4, x0 = P[0], z0 = P[1], x1 = P[2], z1 = P[3];
    [[x0, z0, x1, z0, [0, 0, -1]], [x1, z0, x1, z1, [1, 0, 0]], [x1, z1, x0, z1, [0, 0, 1]], [x0, z1, x0, z0, [-1, 0, 0]]].forEach(function (s) {
      var g = G.sheet(function (a, t) {
        var d = t * depth, o = batter(d), x = MP.lerp(s[0], s[2], a), z = MP.lerp(s[1], s[3], a);
        // corners spread with depth along both axes, so the four faces meet in sharp, leaning corner lines
        x += (x <= x0 + 1e-6 ? -o : x >= x1 - 1e-6 ? o : 0); z += (z <= z0 + 1e-6 ? -o : z >= z1 - 1e-6 ? o : 0);
        return [x, -d, z];
      }, 24, 8, [1, 1]);
      // texture runs along the face in metres
      var len = Math.hypot(s[2] - s[0], s[3] - s[1]), uv = g.attributes.uv;
      for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 3.4, uv.getY(i) * depth / 3.4);
      b.add(MP.M.stone, G.orient(g, s[4]), true);
    });
  }

  S.build = function (group, rnd) {
    var M = MP.M, b = new MP.R.Batch(group), P = S.PLAT, MO = S.MO, y = -S.BASE, F = 2200;
    // land, left open where the moat is, and the water inside it
    G.floor(b, M.grass, -F, MO[3] + 0.8, F, F, y); G.floor(b, M.grass, -F, -F, F, MO[1] - 0.8, y);
    G.floor(b, M.grass, -F, MO[1] - 0.8, MO[0] - 0.8, MO[3] + 0.8, y); G.floor(b, M.grass, MO[2] + 0.8, MO[1] - 0.8, F, MO[3] + 0.8, y);
    G.floor(b, M.water, MO[0], MO[1], MO[2], MO[3], S.WATER);
    // the moat's outer bank, faced in stone
    G.box(b, M.stone, MO[0] - 0.8, S.WATER - 0.8, MO[1] - 0.8, MO[2] + 0.8, y + 0.2, MO[1]); G.box(b, M.stone, MO[0] - 0.8, S.WATER - 0.8, MO[3], MO[2] + 0.8, y + 0.2, MO[3] + 0.8);
    G.box(b, M.stone, MO[0] - 0.8, S.WATER - 0.8, MO[1], MO[0], y + 0.2, MO[3]); G.box(b, M.stone, MO[2], S.WATER - 0.8, MO[1], MO[2] + 0.8, y + 0.2, MO[3]);
    stoneBase(b);
    // platform top: gravel where rooms will stand, granite coping, a low parapet broken by the stair
    G.floor(b, M.gravel, P[0], P[1], P[2], P[3], 0);
    G.box(b, M.stone, P[0] - 0.05, -0.3, P[1] - 0.05, P[2] + 0.05, 0.14, P[1] + 1.2); G.box(b, M.stone, P[0] - 0.05, -0.3, P[3] - 1.2, P[2] + 0.05, 0.14, P[3] + 0.05);
    G.box(b, M.stone, P[0] - 0.05, -0.3, P[1] + 1.2, P[0] + 1.2, 0.14, P[3] - 1.2); G.box(b, M.stone, P[2] - 1.2, -0.3, P[1] + 1.2, P[2] + 0.05, 0.14, P[3] - 1.2);
    [[P[0], P[1], -3.9, P[1] + 0.5], [3.9, P[1], P[2], P[1] + 0.5], [P[0], P[3] - 0.5, P[2], P[3]], [P[0], P[1] + 0.5, P[0] + 0.5, P[3] - 0.5], [P[2] - 0.5, P[1] + 0.5, P[2], P[3] - 0.5]]
      .forEach(function (r) { G.box(b, M.stone, r[0], 0.14, r[1], r[2], 0.78, r[3], true); });
    // paving: the forecourt, the east-west spine, a street down each band; gardens between the bands
    G.floor(b, M.paving, -11, P[1] + 1.2, 11, -11, 0.02); G.floor(b, M.paving, P[0] + 1.2, -2, P[2] - 1.2, 2, 0.025);
    Object.keys(S.BANDS).forEach(function (k) { var x = S.BANDS[k]; G.floor(b, M.paving, x - 2, 2, x + 2, P[3] - 1.2, 0.02); });
    S.GARDENS.forEach(function (gd) { G.floor(b, M.grass, gd[0], P[1] + 1.2, gd[1], -2, 0.015); G.floor(b, M.grass, gd[0], 2, gd[1], P[3] - 1.2, 0.015); });
    // the stair, built out over the moat, with cheek walls; the causeway to the far bank, with low parapets
    for (var k = 0; k < S.STEPS; k++) G.box(b, M.stone, -3, S.WATER - 0.5, S.STAIR0 + k * S.RUN, 3, y + (k + 1) * S.RISE, P[1]);
    G.box(b, M.stone, -3.9, S.WATER - 0.5, S.STAIR0 - 0.4, -3, 0.95, P[1] + 0.2, true); G.box(b, M.stone, 3, S.WATER - 0.5, S.STAIR0 - 0.4, 3.9, 0.95, P[1] + 0.2, true);
    G.box(b, M.paving, -3.9, S.WATER - 0.5, MO[1] - 0.8, 3.9, y + 0.03, S.STAIR0);
    G.box(b, M.stone, -4.4, y, MO[1] - 0.8, -3.9, y + 0.8, S.STAIR0, true); G.box(b, M.stone, 3.9, y, MO[1] - 0.8, 4.4, y + 0.8, S.STAIR0, true);
    // lanterns and trees
    MP.Nature.lantern(b, -5.6, MO[1] - 2.4, y); MP.Nature.lantern(b, 5.6, MO[1] - 2.4, y);
    MP.Nature.lantern(b, -5.2, -15.5, 0); MP.Nature.lantern(b, 5.2, -15.5, 0);
    [[-10, -50], [10, -51.5], [-18, -48], [18, -49], [-27, -50.5], [28, -50]].forEach(function (t) { MP.Nature.cherry(b, t[0], y, t[1], 1 + rnd() * 0.25, rnd); });
    [[-12, -27], [12, -27], [-12, -17], [12, -17]].forEach(function (t) { MP.Nature.cherry(b, t[0], 0, t[1], 0.7 + rnd() * 0.15, rnd); });
    [[-12, -31], [12, -31], [-12, -22], [12, -22], [-12, -12.5], [12, -12.5]].forEach(function (t, i) { MP.Nature.shrub(b, t[0], 0, t[1], 0.9, i % 2 === 0, rnd); });
    for (var i = 0; i < 30; i++) {
      var a = rnd() * Math.PI * 2, r = 88 + rnd() * 80, tx = Math.cos(a) * r, tz = Math.sin(a) * r;
      if (tz < -40 && Math.abs(tx) < 44) continue; // keep the view along the approach open
      MP.Nature.pine(b, tx, y, tz, 1.1 + rnd() * 0.8, rnd);
    }
    b.flush();
    hills(group, rnd);
    // where you can stand: the stair, the platform, the causeway, the land; never the water
    W.surface(-3, S.STAIR0, 3, P[1] - 1e-6, function (x, z) { return y + Math.min(S.STEPS, Math.floor((z - S.STAIR0) / S.RUN) + 1) * S.RISE; });
    W.surface(P[0], P[1], P[2], P[3], 0);
    W.surface(-3.9, MO[1] - 0.8, 3.9, S.STAIR0, y);
    W.surface(MO[0] + 0.01, MO[1] + 0.01, MO[2] - 0.01, MO[3] - 0.01, NaN);
    W.fallback = y;
    return b;
  };

  // Hills in layers, nearer ones green with forest, farther ones paler and bluer in the haze.
  function hills(group, rnd) {
    var layers = [[340, 34, [0.07, 0.13, 0.07]], [620, 70, [0.13, 0.19, 0.16]], [1150, 150, [0.28, 0.33, 0.38]], [1900, 260, [0.45, 0.5, 0.58]]];
    var pos = [], col = [], seg = 220, y = -S.BASE;
    layers.forEach(function (L, li) {
      for (var a = 0; a < seg; a++) {
        var t0 = a / seg, t1 = (a + 1) / seg;
        var h0 = y + L[1] * Math.pow(MP.fbm(t0, li * 0.37, 7, 5, 500 + li), 1.6) * 2.1, h1 = y + L[1] * Math.pow(MP.fbm(t1, li * 0.37, 7, 5, 500 + li), 1.6) * 2.1;
        var a0 = t0 * Math.PI * 2, a1 = t1 * Math.PI * 2, R = L[0];
        var r0 = R + (h0 - y) * 1.8, r1 = R + (h1 - y) * 1.8; // slopes, set back toward the top
        var p00 = [Math.cos(a0) * R, y - 2, Math.sin(a0) * R], p01 = [Math.cos(a0) * r0, h0, Math.sin(a0) * r0], p10 = [Math.cos(a1) * R, y - 2, Math.sin(a1) * R], p11 = [Math.cos(a1) * r1, h1, Math.sin(a1) * r1];
        pos.push.apply(pos, p00.concat(p11, p01, p00, p10, p11));
        var c = L[2], top = 1.25, f0 = 0.85 + 0.3 * MP.fbm(t0, li, 40, 2, 520), f1 = 0.85 + 0.3 * MP.fbm(t1, li, 40, 2, 520);
        [[1, f0], [top, f1], [top, f0], [1, f0], [1, f1], [top, f1]].forEach(function (k) { col.push(c[0] * k[0] * k[1], c[1] * k[0] * k[1], c[2] * k[0] * k[1]); });
      }
    });
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    var m = new THREE.Mesh(g, MP.M.hills); m.matrixAutoUpdate = false; group.add(m);
  }
})();
