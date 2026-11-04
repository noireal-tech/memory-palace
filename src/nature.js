/* Memory Palace: trees, shrubs and stone lanterns. Crowns are lumpy blobs coloured per vertex, merged into batches. */
(function () {
  'use strict';
  var MP = window.MP, G = MP.Geo, N = MP.Nature = { trees: [] }; // trees: where each one stands (for their sounds)

  // A crown cluster: a sphere pushed in and out by noise, darker underneath and inside, lighter on top.
  function blob(b, c, r, dark, light, seed, mat) {
    var g = new THREE.SphereGeometry(1, 12, 8), p = g.attributes.position, col = new Float32Array(p.count * 3), v = new THREE.Vector3();
    for (var i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      var n = 0.78 + 0.44 * MP.noise(v.x * 2.4 + v.z * 0.8 + 7, v.y * 2.4 + v.z * 1.7 + 7, 64, seed);
      p.setXYZ(i, c[0] + v.x * r[0] * n, c[1] + v.y * r[1] * n, c[2] + v.z * r[2] * n);
      var t = MP.clamp(0.45 + v.y * 0.45 + (n - 1) * 0.9, 0, 1), speck = MP.hash(i, seed, 5) * 0.12;
      if (mat && mat.userData.photo) { var k = 0.42 + 0.58 * t; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k; continue; } // the photo carries the colour
      col[i * 3] = MP.lerp(dark[0], light[0], t) + speck * light[0]; col[i * 3 + 1] = MP.lerp(dark[1], light[1], t) + speck * light[1]; col[i * 3 + 2] = MP.lerp(dark[2], light[2], t) + speck * light[2];
    }
    g.computeVertexNormals(); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var uv = g.attributes.uv; for (i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4 * Math.max(r[0], r[2]), uv.getY(i) * 2 * r[1]); // ~1 copy of a foliage photo per metre
    b.add(mat || MP.M.leaf, g, true);
  }
  N.blob = blob;

  // Cherry in blossom: a short trunk forking into spreading limbs, each ending in clouds of pink.
  N.cherry = function (b, x, y, z, s, rnd) {
    N.trees.push({ kind: 'cherry', x: x, y: y + 4 * s, z: z });
    var dark = [0.5, 0.22, 0.3], light = [1.0, 0.8, 0.86], top = [x + 0.2 * s, y + 2.0 * s, z];
    G.limb(b, MP.M.bark, [x, y - 0.3, z], top, 0.3 * s, 0.2 * s, 9);
    for (var k = 0; k < 5; k++) {
      var a = k / 5 * Math.PI * 2 + rnd() * 0.8, reach = (2.0 + rnd()) * s, end = [top[0] + Math.cos(a) * reach, y + (3.0 + rnd() * 1.2) * s, top[2] + Math.sin(a) * reach];
      G.limb(b, MP.M.bark, top, end, 0.17 * s, 0.07 * s, 7);
      for (var j = 0; j < 3; j++) blob(b, [end[0] + (rnd() - 0.5) * 1.8 * s, end[1] + (0.1 + rnd() * 0.7) * s, end[2] + (rnd() - 0.5) * 1.8 * s], [(1 + rnd() * 0.5) * s, (0.72 + rnd() * 0.3) * s, (1 + rnd() * 0.5) * s], dark, light, 300 + k * 7 + j, MP.M.blossom);
    }
    blob(b, [top[0], y + 4.3 * s, top[2]], [2.2 * s, 1.3 * s, 2.2 * s], dark, light, 340, MP.M.blossom);
    MP.World.solid(x - 0.45, z - 0.45, x + 0.45, z + 0.45, y + 3);
  };
  // Japanese black pine, cloud-pruned: a leaning trunk with flat pads of needles.
  N.pine = function (b, x, y, z, s, rnd) {
    N.trees.push({ kind: 'pine', x: x, y: y + 6 * s, z: z });
    var dark = [0.025, 0.06, 0.035], light = [0.13, 0.24, 0.11], lean = (rnd() - 0.5) * 1.8 * s, h = 7.5 * s;
    G.limb(b, MP.M.bark, [x, y - 0.3, z], [x + lean, y + h, z], 0.42 * s, 0.15 * s, 9);
    for (var k = 0; k < 5; k++) {
      var hy = y + (2.6 + k * 1.25) * s, a = rnd() * Math.PI * 2, d = (2.6 - k * 0.42) * s, px = x + lean * (hy - y) / h, end = [px + Math.cos(a) * d, hy + 0.2 * s, z + Math.sin(a) * d];
      G.limb(b, MP.M.bark, [px, hy - 0.4 * s, z], end, 0.13 * s, 0.06 * s, 6);
      blob(b, [end[0], end[1] + 0.2 * s, end[2]], [(2.0 - k * 0.26) * s, 0.6 * s, (1.7 - k * 0.2) * s], dark, light, 360 + k, MP.M.needles);
    }
    blob(b, [x + lean, y + h + 0.3 * s, z], [1.5 * s, 0.75 * s, 1.35 * s], dark, light, 380, MP.M.needles);
  };
  // Clipped azalea mound with a scatter of flowers.
  N.shrub = function (b, x, y, z, s, flowers, rnd) {
    var dark = [0.04, 0.09, 0.04], light = flowers ? [0.85, 0.32, 0.42] : [0.18, 0.32, 0.14];
    blob(b, [x, y + 0.45 * s, z], [1.1 * s, 0.6 * s, 1.0 * s], dark, light, 400 + Math.floor(rnd() * 50), flowers ? MP.M.blossom : MP.M.needles);
  };
  // Stone lantern (toro): base, shaft, a glowing fire box, a broad cap and a finial.
  N.lantern = function (b, x, y, z) {
    var M = MP.M;
    [[0.62, 0.66, 0.24, 0.12], [0.24, 0.28, 1.1, 0.8], [0.52, 0.52, 0.18, 1.44]].forEach(function (p) { var g = new THREE.CylinderGeometry(p[0], p[1], p[2], 8); g.translate(x, y + p[3], z); b.add(M.stone, g); });
    G.box(b, M.stone, x - 0.36, y + 1.53, z - 0.36, x + 0.36, y + 2.05, z + 0.36);
    G.panel(b, M.shoji, x, y + 1.79, z + 0.37, 0.38, 0.34, 'z+'); G.panel(b, M.shoji, x, y + 1.79, z - 0.37, 0.38, 0.34, 'z-');
    G.panel(b, M.shoji, x + 0.37, y + 1.79, z, 0.38, 0.34, 'x+'); G.panel(b, M.shoji, x - 0.37, y + 1.79, z, 0.38, 0.34, 'x-');
    var cap = new THREE.ConeGeometry(0.78, 0.44, 4); cap.rotateY(Math.PI / 4); cap.translate(x, y + 2.27, z); b.add(M.stone, cap);
    var fin = new THREE.SphereGeometry(0.13, 10, 8); fin.translate(x, y + 2.56, z); b.add(M.stone, fin);
    MP.World.solid(x - 0.62, z - 0.62, x + 0.62, z + 0.62, y + 2.6);
  };
})();
