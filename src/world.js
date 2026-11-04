/* Memory Palace: where you can stand and what blocks the way, plus small geometry helpers every builder uses.
   Spec coordinates throughout: metres, x east, y up from the platform top, z north, the keep's centre at the origin. */
(function () {
  'use strict';
  var MP = window.MP;

  // ---------- Ground: surfaces checked in order; the first one that contains the point gives its height ----------
  // A surface's height can be a number or a function of (x, z). NaN means you can't stand there (water).
  var surfaces = [], solids = [];
  var W = MP.World = {
    surface: function (x0, z0, x1, z1, h, tag) { surfaces.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), h: h, tag: tag || '' }); },
    // A solid box blocks walking for anyone whose feet are below its top (minus a step).
    solid: function (x0, z0, x1, z1, top, tag) { solids.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), top: top, tag: tag || '' }); },
    drop: function (tag) { surfaces = surfaces.filter(function (s) { return s.tag !== tag; }); solids = solids.filter(function (s) { return s.tag !== tag; }); },
    fallback: 0,
    groundAt: function (x, z) {
      for (var i = 0; i < surfaces.length; i++) {
        var s = surfaces[i];
        if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) return typeof s.h === 'function' ? s.h(x, z) : s.h;
      }
      return W.fallback;
    },
    blocked: function (x, z, feet, r) {
      r = r || 0.25;
      for (var i = 0; i < solids.length; i++) { var s = solids[i]; if (x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r && feet < s.top - 0.45) return true; }
      return false;
    },
    counts: function () { return { surfaces: surfaces.length, solids: solids.length }; }
  };

  // ---------- Geometry helpers (all add world-space pieces to a batch) ----------
  var G = MP.Geo = {};
  // An axis-aligned box from corner to corner; solid: also blocks walking.
  G.box = function (b, mat, x0, y0, z0, x1, y1, z1, solid, tag) {
    var g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); b.add(mat, g);
    if (solid) W.solid(x0, z0, x1, z1, Math.max(y0, y1), tag);
  };
  // A flat panel facing outward along an axis ('x+', 'x-', 'z+', 'z-'), its texture fitted once across it.
  G.panel = function (b, mat, cx, cy, cz, w, h, dir) {
    var g = new THREE.PlaneGeometry(w, h);
    if (dir === 'x+') g.rotateY(Math.PI / 2); else if (dir === 'x-') g.rotateY(-Math.PI / 2); else if (dir === 'z-') g.rotateY(Math.PI);
    g.translate(cx, cy, cz); b.add(mat, g, true);
  };
  // A level rectangle facing up.
  G.floor = function (b, mat, x0, z0, x1, z1, y) { var g = new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0)); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2); b.add(mat, g); };
  // A cylinder from point a to point b (radii at each end).
  G.limb = function (bt, mat, a, b, r0, r1, seg) {
    var A = new THREE.Vector3().fromArray(a), B = new THREE.Vector3().fromArray(b), len = A.distanceTo(B);
    var g = new THREE.CylinderGeometry(r1, r0, len, seg || 8, 1, true); g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize())); g.translate(A.x, A.y, A.z); bt.add(mat, g, true);
  };
  // Triangles from a flat list of points [x,y,z, ...]; faces turned to point along `out` (a direction) if given.
  G.tris = function (b, mat, pts, out, uv) {
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    if (out) {
      var n = g.attributes.normal, dot = n.getX(0) * out[0] + n.getY(0) * out[1] + n.getZ(0) * out[2];
      if (dot < 0) { G.flip(g); }
    }
    b.add(mat, g, !!uv);
    return g;
  };
  // Reverse every triangle's winding (and recompute normals).
  G.flip = function (g) {
    var p = g.attributes.position.array, uv = g.attributes.uv && g.attributes.uv.array;
    for (var i = 0; i < p.length; i += 9) for (var c = 0; c < 3; c++) { var t = p[i + 3 + c]; p[i + 3 + c] = p[i + 6 + c]; p[i + 6 + c] = t; }
    if (uv) for (i = 0; i < uv.length; i += 6) for (c = 0; c < 2; c++) { t = uv[i + 2 + c]; uv[i + 2 + c] = uv[i + 4 + c]; uv[i + 4 + c] = t; }
    g.attributes.position.needsUpdate = true; g.computeVertexNormals();
  };
  // A grid surface from a function f(a, b) → [x, y, z] over a in 0..1 (na steps), b in 0..1 (nb steps).
  // uvScale: [u per a, v per b] in texture repeats. Returns the geometry (indexed, normals computed).
  G.sheet = function (f, na, nb, uvScale) {
    var pos = [], uv = [], idx = [];
    for (var j = 0; j <= nb; j++) for (var i = 0; i <= na; i++) { var p = f(i / na, j / nb); pos.push(p[0], p[1], p[2]); uv.push(i / na * uvScale[0], j / nb * uvScale[1]); }
    for (j = 0; j < nb; j++) for (i = 0; i < na; i++) { var a = j * (na + 1) + i, c = a + na + 1; idx.push(a, c, a + 1, a + 1, c, c + 1); }
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  };
  // Make an indexed sheet face toward `out` (checks its middle normal).
  G.orient = function (g, out) {
    var n = g.attributes.normal, k = Math.floor(n.count / 2);
    if (n.getX(k) * out[0] + n.getY(k) * out[1] + n.getZ(k) * out[2] < 0) { var ix = g.index.array; for (var i = 0; i < ix.length; i += 3) { var t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.index.needsUpdate = true; g.computeVertexNormals(); }
    return g;
  };
})();
