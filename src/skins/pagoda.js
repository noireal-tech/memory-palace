/* Memory Palace skin: Japanese pagoda (the default). A castle keep in the spirit of Himeji: a battered stone base,
   white plastered tiers over dark timber boarding, curved tile roofs whose corners sweep up, triangular dormer
   gables, a cusped gable over the gate, a hip-and-gable crown with golden roof fish, and gold leaf on the third tier. */
(function () {
  'use strict';
  var MP = window.MP, G = MP.Geo;
  var SK = {};

  // ---------- Roofs ----------
  // A curved skirt roof between an eave rectangle o (low, outside) and an inner rectangle i (high), four sides.
  // The slope is concave (steeper near the top) and the corners sweep up. Tiles above, rafters below, a white edge.
  function skirt(b, o, i, yE, yT, lift, opts) {
    opts = opts || {}; var M = MP.M, th = opts.th || 0.28, lite = !!opts.lite, na = lite ? 6 : 14, nb = lite ? 3 : 8;
    var oc = [[o[0], o[1]], [o[2], o[1]], [o[2], o[3]], [o[0], o[3]]], ic = [[i[0], i[1]], [i[2], i[1]], [i[2], i[3]], [i[0], i[3]]];
    var outs = [[0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0]];
    for (var s = 0; s < 4; s++) {
      var a0 = oc[s], a1 = oc[(s + 1) % 4], b0 = ic[s], b1 = ic[(s + 1) % 4], out = outs[s];
      var eaveLen = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]), run = Math.hypot((a0[0] + a1[0] - b0[0] - b1[0]) / 2, (a0[1] + a1[1] - b0[1] - b1[1]) / 2), slope = Math.hypot(run, yT - yE);
      var pt = function (a, t, dy) {
        var ex = MP.lerp(a0[0], a1[0], a), ez = MP.lerp(a0[1], a1[1], a), nx = MP.lerp(b0[0], b1[0], a), nz = MP.lerp(b0[1], b1[1], a);
        var y = yE + (yT - yE) * Math.pow(t, 1.5) + lift * Math.pow(1 - t, 2) * Math.pow(Math.abs(2 * a - 1), 6);
        return [MP.lerp(ex, nx, t), y + (dy || 0), MP.lerp(ez, nz, t)];
      };
      b.add(M.roof, G.orient(G.sheet(function (a, t) { return pt(a, t); }, na, nb, [eaveLen / 2.2, slope / 2.2]), [out[0], 1, out[2]]), true);
      b.add(M.eave, G.orient(G.sheet(function (a, t) { return pt(a, t * 0.92, -th); }, na, lite ? 1 : 4, [eaveLen / 1.2, run / 1.2]), [0, -1, 0]), true);
      // the eave edge: a white plastered board from the tiles down to the rafters
      b.add(M.trim, G.orient(G.sheet(function (a, k) { var p = pt(a, 0); return [p[0] + out[0] * 0.02, p[1] - th * k - 0.02, p[2] + out[2] * 0.02]; }, na, 1, [eaveLen / 3, 0.1]), out), true);
      // hip ridge: a rounded cap up each corner line
      var prev = pt(0, 0, 0.08), steps = lite ? 2 : 4;
      for (var k = 1; k <= steps; k++) { var nxt = pt(0, k / steps, 0.08); G.limb(b, M.ridge, prev, nxt, 0.17, 0.17, lite ? 4 : 8); prev = nxt; }
    }
    if (opts.capTop) G.floor(b, M.roof, i[0], i[1], i[2], i[3], yT + 0.01);
  }

  // A gable roof over rectangle r at height yB, ridge at yR, running along `axis` ('x' or 'z'), overhanging by ov.
  // The gable ends are white plastered triangles with a dark timber border and a gold ornament.
  function gableRoof(b, r, yB, yR, axis, ov, opts) {
    opts = opts || {}; var M = MP.M, cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2, th = 0.25, lite = !!opts.lite, na = lite ? 4 : 10;
    var along = axis === 'z', L0 = along ? r[1] - ov : r[0] - ov, L1 = along ? r[3] + ov : r[2] + ov, half = (along ? r[2] - r[0] : r[3] - r[1]) / 2 + ov;
    function P(l, w, y) { return along ? [cx + w, y, l] : [l, y, cz + w]; }
    [-1, 1].forEach(function (sd) {
      var span = Math.hypot(half, yR - yB), len = L1 - L0;
      var f = function (a, t, dy) { var w = sd * half * (1 - t), y = yB - 0.15 + (yR - yB + 0.15) * Math.pow(t, 1.25) + (dy || 0); return P(MP.lerp(L0, L1, a), w, y); };
      var out = along ? [sd, 1, 0] : [0, 1, sd];
      b.add(M.roof, G.orient(G.sheet(function (a, t) { return f(a, t); }, na, lite ? 3 : 6, [len / 2.2, span / 2.2]), out), true);
      b.add(M.eave, G.orient(G.sheet(function (a, t) { return f(a, t, -th); }, na, lite ? 1 : 3, [len / 1.2, span / 1.2]), [0, -1, 0]), true);
      b.add(M.trim, G.orient(G.sheet(function (a, k) { var p = f(a, 0); p[1] -= th * k; return p; }, na, 1, [len / 3, 0.1]), along ? [sd, 0, 0] : [0, 0, sd]), true);
    });
    // gable ends: plaster triangle, timber border, gold ornament at the apex
    [[along ? r[1] + 0.3 : r[0] + 0.3, -1], [along ? r[3] - 0.3 : r[2] - 0.3, 1]].forEach(function (e) {
      var l = e[0], hw = half - ov, a = P(l, -hw, yB), c = P(l, hw, yB), t = P(l, 0, yR - 0.25), out = along ? [0, 0, e[1]] : [e[1], 0, 0];
      G.tris(b, M.trim, a.concat(c, t), out);
      if (lite) return;
      G.limb(b, M.timber, a, t, 0.12, 0.12, 6); G.limb(b, M.timber, c, t, 0.12, 0.12, 6);
      var orn = new THREE.CylinderGeometry(0.42, 0.42, 0.12, 16); orn.rotateX(Math.PI / 2); if (!along) orn.rotateY(Math.PI / 2);
      var op = P(l + e[1] * 0.08, 0, yR - 0.95); orn.translate(op[0], op[1], op[2]); b.add(M.gold, orn);
    });
    // ridge cap and golden roof fish at each end
    var ra = P(L0 + 0.2, 0, yR + 0.12), rb = P(L1 - 0.2, 0, yR + 0.12);
    G.limb(b, M.ridge, ra, rb, 0.28, 0.28, lite ? 5 : 10);
    if (opts.fish !== false && !lite) { shachi(b, P(L0 + 0.5, 0, yR + 0.2), along ? 'z' : 'x', 1, opts.fishSize || 1); shachi(b, P(L1 - 0.5, 0, yR + 0.2), along ? 'z' : 'x', -1, opts.fishSize || 1); }
  }

  // Shachihoko: a golden carp with its tail in the air, guarding the ridge. Facing along `axis`, toward the middle (dir).
  var fishGeo = null;
  function shachi(b, p, axis, dir, size) {
    if (!fishGeo) {
      var s = new THREE.Shape();
      s.moveTo(0, 0); s.bezierCurveTo(0.55, -0.05, 0.75, 0.35, 0.55, 0.7); s.bezierCurveTo(0.42, 0.95, 0.2, 1.1, 0.32, 1.45);
      s.lineTo(0.62, 1.7); s.lineTo(0.18, 1.62); s.lineTo(0.02, 1.85); s.bezierCurveTo(-0.08, 1.4, 0.05, 1.0, -0.1, 0.7);
      s.bezierCurveTo(-0.3, 0.45, -0.25, 0.1, 0, 0);
      fishGeo = new THREE.ExtrudeGeometry(s, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2, curveSegments: 10 });
      fishGeo.translate(0, 0, -0.14);
    }
    var g = fishGeo.clone(); g.scale(size * dir, size, size);
    if (axis === 'x') g.rotateY(0); else g.rotateY(-Math.PI / 2);
    g.translate(p[0], p[1], p[2]); b.add(MP.M.gold, g, true);
  }

  // A triangular dormer gable (chidori-hafu) standing out of a skirt roof on one face.
  // face: 'z-', 'z+', 'x-', 'x+'; at: the face line (z or x); c: centre along the face; w: width; yb: base; h: height; depth: how far back it runs.
  function dormer(b, face, at, c, w, yb, h, depth) {
    var M = MP.M, sgn = face[1] === '+' ? 1 : -1, onZ = face[0] === 'z', ov = 0.5, th = 0.22;
    function P(along, back, y) { return onZ ? [c + along, y, at - sgn * back] : [at - sgn * back, y, c + along]; } // back: into the building
    var hw = w / 2;
    // the plaster triangle and its timber border
    G.tris(b, M.trim, P(-hw, 0, yb).concat(P(hw, 0, yb), P(0, 0, yb + h)), onZ ? [0, 0, sgn] : [sgn, 0, 0]);
    G.limb(b, M.timber, P(-hw, -0.05, yb), P(0, -0.05, yb + h - 0.1), 0.1, 0.1, 6); G.limb(b, M.timber, P(hw, -0.05, yb), P(0, -0.05, yb + h - 0.1), 0.1, 0.1, 6);
    G.box(b, M.timber, Math.min(P(-hw, -0.1, 0)[0], P(hw, 0.05, 0)[0]), yb - 0.18, Math.min(P(-hw, -0.1, 0)[2], P(hw, 0.05, 0)[2]), Math.max(P(-hw, -0.1, 0)[0], P(hw, 0.05, 0)[0]), yb, Math.max(P(-hw, -0.1, 0)[2], P(hw, 0.05, 0)[2]));
    var orn = new THREE.CylinderGeometry(0.26, 0.26, 0.1, 14); orn.rotateX(Math.PI / 2); if (!onZ) orn.rotateY(Math.PI / 2);
    var op = P(0, -0.06, yb + h * 0.62); orn.translate(op[0], op[1], op[2]); b.add(M.gold, orn);
    // its two roof slopes, running back into the main roof
    [-1, 1].forEach(function (sd) {
      var f = function (k, t, dy) { var al = sd * (hw + ov) * (1 - t), y = yb - 0.3 + (h + 0.42) * Math.pow(t, 1.2) + (dy || 0); return P(al, MP.lerp(-ov, depth, k), y); };
      var slope = Math.hypot(hw + ov, h + 0.4);
      b.add(M.roof, G.orient(G.sheet(function (k, t) { return f(k, t); }, 4, 5, [(depth + ov) / 2.2, slope / 2.2]), onZ ? [sd, 1, 0] : [0, 1, sd]), true);
      b.add(M.eave, G.orient(G.sheet(function (k, t) { return f(k, t, -th); }, 2, 3, [1, 1]), [0, -1, 0]), true);
      b.add(M.trim, G.orient(G.sheet(function (k, j) { var p = f(k, 0); p[1] -= th * j; return p; }, 4, 1, [1, 0.1]), onZ ? [sd, 0, 0] : [0, 0, sd]), true);
    });
    G.limb(b, M.ridge, P(0, -ov, yb + h + 0.14), P(0, depth, yb + h + 0.14), 0.15, 0.15, 8);
  }

  // A cusped gable (kara-hafu): a roof whose front edge rises in a bow in the middle and flicks up at the ends.
  function karahafu(b, cx, at, w, yb, h, depth, sgn, fillFrom) {
    var M = MP.M, hw = w / 2, th = 0.26;
    function prof(t) { var bow = Math.pow(0.5 + 0.5 * Math.cos(Math.PI * t), 0.85), flick = Math.pow(Math.max(0, Math.abs(t) - 0.78) / 0.22, 2) * 0.3; return yb + h * bow + h * flick; }
    var top = G.sheet(function (a, k) { var t = a * 2 - 1; return [cx + t * hw, prof(t) + k * 0.25, at - sgn * MP.lerp(-0.6, depth, k)]; }, 24, 3, [w / 2.2, (depth + 0.6) / 2.2]);
    b.add(M.roof, G.orient(top, [0, 1, sgn]), true);
    b.add(M.eave, G.orient(G.sheet(function (a, k) { var t = a * 2 - 1; return [cx + t * hw, prof(t) - th + k * 0.25, at - sgn * MP.lerp(-0.6, depth, k)]; }, 24, 2, [w / 1.2, 1]), [0, -1, 0]), true);
    // the bowed front board: white with a gold edge
    b.add(M.trim, G.orient(G.sheet(function (a, k) { var t = a * 2 - 1; return [cx + t * hw, prof(t) - th * k, at + sgn * 0.62]; }, 24, 1, [w / 3, 0.1]), [0, 0, sgn]), true);
    b.add(M.gold, G.orient(G.sheet(function (a, k) { var t = a * 2 - 1; return [cx + t * hw, prof(t) - th - 0.06 * k, at + sgn * 0.63]; }, 24, 1, [1, 1]), [0, 0, sgn]), true);
    G.limb(b, M.ridge, [cx, yb + h + 0.3, at + sgn * 0.5], [cx, yb + h + 0.3, at - sgn * depth], 0.16, 0.16, 8);
    // the space under the bow is closed by a timber gable panel with a gold boss
    var y0 = fillFrom === undefined ? yb - 0.3 : fillFrom;
    b.add(M.eave, G.orient(G.sheet(function (a, k) { var t = a * 2 - 1; return [cx + t * hw * 0.92, MP.lerp(y0, Math.max(y0, prof(t * 0.92) - th), k), at + sgn * 0.3]; }, 20, 1, [w / 1.2, 1]), [0, 0, sgn]), true);
    var boss = new THREE.CylinderGeometry(0.22, 0.22, 0.1, 14); boss.rotateX(Math.PI / 2); boss.translate(cx, MP.lerp(y0, yb + h - th, 0.55), at + sgn * 0.36); b.add(M.gold, boss);
  }

  // ---------- Walls ----------
  // Plastered walls round a rectangle, dark timber boarding round the bottom, a beam at the top, windows in bays.
  function walls(b, r, y0, y1, opts) {
    opts = opts || {}; var M = MP.M, h = y1 - y0, boards = opts.boards === undefined ? 0.32 : opts.boards;
    G.box(b, opts.plaster || M.plaster, r[0], y0, r[1], r[2], y1, r[3], opts.solid !== false);
    var e = 0.05, bt = y0 + h * boards;
    if (boards > 0) { // the boarding stands slightly proud of the plaster
      G.box(b, M.timber, r[0] - e, y0, r[1] - e, r[2] + e, bt, r[1]); G.box(b, M.timber, r[0] - e, y0, r[3], r[2] + e, bt, r[3] + e);
      G.box(b, M.timber, r[0] - e, y0, r[1], r[0], bt, r[3]); G.box(b, M.timber, r[2], y0, r[1], r[2] + e, bt, r[3]);
    }
    var beam = opts.beam || M.timber;
    G.box(b, beam, r[0] - 0.07, y1 - 0.32, r[1] - 0.07, r[2] + 0.07, y1, r[1]); G.box(b, beam, r[0] - 0.07, y1 - 0.32, r[3], r[2] + 0.07, y1, r[3] + 0.07);
    G.box(b, beam, r[0] - 0.07, y1 - 0.32, r[1], r[0], y1, r[3]); G.box(b, beam, r[2], y1 - 0.32, r[1], r[2] + 0.07, y1, r[3]);
    var wy = opts.winY !== undefined ? y0 + opts.winY : bt + (y1 - 0.32 - bt) * 0.52, wh = opts.winH || Math.min(1.1, (y1 - bt) * 0.42), bay = opts.bay || 2.4;
    [['z-', r[1], r[0], r[2]], ['z+', r[3], r[0], r[2]], ['x-', r[0], r[1], r[3]], ['x+', r[2], r[1], r[3]]].forEach(function (sd) {
      var dir = sd[0], at = sd[1], a0 = sd[2], a1 = sd[3], n = Math.max(1, Math.round((a1 - a0) / bay)), step = (a1 - a0) / n, out = dir[1] === '+' ? 1 : -1;
      for (var k = 0; k < n; k++) {
        if (opts.every !== 1 && (k % 2) !== (opts.odd ? 1 : 0)) continue;
        var cc = a0 + (k + 0.5) * step, ww = Math.min(opts.winW || 1.15, step * 0.62);
        if (opts.skip && opts.skip(dir, cc, ww)) continue;
        var wm = opts.window || M.window;
        if (dir[0] === 'z') G.panel(b, wm, cc, wy, at + out * 0.035, ww, wh, dir); else G.panel(b, wm, at + out * 0.035, wy, cc, ww, wh, dir);
      }
    });
  }
  // A battered stone base for a building: leaning faces from the ground up to `top`, footprint r at the top.
  function stoneFoot(b, r, top, bottom) {
    var d = top - bottom, M = MP.M;
    [[r[0], r[1], r[2], r[1], [0, 0, -1]], [r[2], r[1], r[2], r[3], [1, 0, 0]], [r[2], r[3], r[0], r[3], [0, 0, 1]], [r[0], r[3], r[0], r[1], [-1, 0, 0]]].forEach(function (s) {
      var g = G.sheet(function (a, t) {
        var o = (0.16 * t + 0.06 * t * t) * d, x = MP.lerp(s[0], s[2], a), z = MP.lerp(s[1], s[3], a);
        x += x <= r[0] + 1e-6 ? -o : x >= r[2] - 1e-6 ? o : 0; z += z <= r[1] + 1e-6 ? -o : z >= r[3] - 1e-6 ? o : 0;
        return [x, top - t * d, z];
      }, 10, 4, [Math.hypot(s[2] - s[0], s[3] - s[1]) / 3.4, d / 3.4]);
      b.add(M.stone, G.orient(g, s[4]), true);
    });
    G.floor(b, M.stone, r[0], r[1], r[2], r[3], top);
    var o = (0.16 + 0.06) * d; MP.World.solid(r[0] - o, r[1] - o, r[2] + o, r[3] + o, top + 30, 'keep');
  }

  // ---------- The keep ----------
  SK.keep = function (group) {
    var M = MP.M, b = new MP.R.Batch(group), FOOT = 2.2;
    stoneFoot(b, [-10.4, -11.4, 10.4, 11.4], FOOT, -0.3);
    // gate: a timber frame set into the stone base's south face, studded doors, a cusped gable roof above
    var gz = -11.4 - 0.55;
    G.box(b, M.timber, -2.6, 0, gz - 0.5, -2.1, 3.3, gz + 1.2, true); G.box(b, M.timber, 2.1, 0, gz - 0.5, 2.6, 3.3, gz + 1.2, true);
    G.box(b, M.timber, -2.8, 3.0, gz - 0.55, 2.8, 3.45, gz + 1.2);
    G.panel(b, M.gate, -1.03, 1.5, gz - 0.2, 2.06, 3.0, 'z-'); G.panel(b, M.gate, 1.03, 1.5, gz - 0.2, 2.06, 3.0, 'z-');
    G.box(b, M.timber, -2.1, 0, gz - 0.19, 2.1, 0.18, gz + 0.4);
    karahafu(b, 0, gz, 6.6, 3.55, 1.25, 2.4, -1, 3.45);
    // first tier
    var t1 = [-10, -11, 10, 11];
    walls(b, t1, FOOT, 6.4, { bay: 2.5 });
    skirt(b, [-11.9, -12.9, 11.9, 12.9], [-7.6, -8.6, 7.6, 8.6], 6.2, 7.5, 0.6);
    dormer(b, 'z-', -11.3, 0, 7.2, 6.75, 2.6, 3.2); dormer(b, 'z+', 11.3, 0, 7.2, 6.75, 2.6, 3.2);
    dormer(b, 'x-', -10.3, -4.5, 4.4, 6.7, 1.7, 2.4); dormer(b, 'x-', -10.3, 4.5, 4.4, 6.7, 1.7, 2.4);
    dormer(b, 'x+', 10.3, -4.5, 4.4, 6.7, 1.7, 2.4); dormer(b, 'x+', 10.3, 4.5, 4.4, 6.7, 1.7, 2.4);
    // second tier
    walls(b, [-7.6, -8.6, 7.6, 8.6], 7.2, 10.8, { bay: 2.2, odd: true, boards: 0.26 });
    skirt(b, [-9.4, -10.4, 9.4, 10.4], [-5.6, -6.6, 5.6, 6.6], 10.6, 11.8, 0.55);
    dormer(b, 'x-', -8.4, 0, 6.2, 11.0, 2.2, 2.8); dormer(b, 'x+', 8.4, 0, 6.2, 11.0, 2.2, 2.8);
    karahafu(b, 0, -9.8, 5.2, 11.05, 1.15, 2.6, -1);
    // third tier: gold leaf on the beams and boarding
    walls(b, [-5.6, -6.6, 5.6, 6.6], 11.5, 14.6, { bay: 2.2, every: 1, boards: 0.22, beam: M.goldLeaf, winW: 0.9 });
    skirt(b, [-7.2, -8.2, 7.2, 8.2], [-4.2, -5.0, 4.2, 5.0], 14.4, 15.4, 0.5);
    // crown: a lookout tier with a balcony rail, under a hip-and-gable roof with its gable facing the gate
    var t4 = [-4.2, -5.0, 4.2, 5.0];
    walls(b, t4, 15.2, 18.0, { bay: 2.1, every: 1, boards: 0, winY: 1.45, winH: 1.5, winW: 1.2 });
    G.box(b, M.timber, t4[0] - 0.9, 15.15, t4[1] - 0.9, t4[2] + 0.9, 15.35, t4[3] + 0.9);
    [[t4[0] - 0.85, t4[1] - 0.85, t4[2] + 0.85, t4[1] - 0.75], [t4[0] - 0.85, t4[3] + 0.75, t4[2] + 0.85, t4[3] + 0.85], [t4[0] - 0.85, t4[1] - 0.85, t4[0] - 0.75, t4[3] + 0.85], [t4[2] + 0.75, t4[1] - 0.85, t4[2] + 0.85, t4[3] + 0.85]]
      .forEach(function (r) { G.box(b, M.timber, r[0], 16.15, r[1], r[2], 16.3, r[3]); });
    for (var k = 0; k <= 8; k++) { var px = MP.lerp(t4[0] - 0.8, t4[2] + 0.8, k / 8); G.box(b, M.timber, px - 0.06, 15.35, t4[1] - 0.86, px + 0.06, 16.15, t4[1] - 0.74); G.box(b, M.timber, px - 0.06, 15.35, t4[3] + 0.74, px + 0.06, 16.15, t4[3] + 0.86); }
    skirt(b, [-6.0, -6.8, 6.0, 6.8], [-3.6, -4.2, 3.6, 4.2], 17.8, 18.6, 0.55);
    gableRoof(b, [-3.6, -4.2, 3.6, 4.2], 18.6, 21.4, 'z', 0.7, { fishSize: 1.1 });
    b.flush();
    return b;
  };

  // ---------- A room's facade module, from outside ----------
  // s = {
  //   r: [x0, z0, x1, z1] ground-floor footprint (8 x 8 m), street: 'x-' | 'x+' (the side its door faces), zc: door centre,
  //   wall: plaster material in the band's colour, win: the band's window material, winAspect: its height / width,
  //   tier: 'none' | 'active' | 'shuttered' (a third tier for an active subject; shuttered once it goes dormant),
  //   group: where the door leaves and plaque go (they move or change, so they aren't merged), open: door left open }
  // Two levels of detail with the same pagoda outline, band colour and windows: SK.module (the full facade: framed
  // door that swings, brass plaque, finely curved roofs, rafters, ridge caps, roof fish) for the room you're at and
  // its neighbours, and SK.lite (a few hundred triangles, merged with every other far room) for the rest.
  // Where you can walk doesn't depend on either: SK.collide sets it once per room.
  var DOOR_W = 2.2, DOOR_H = 2.9, WALL_T = 0.3, F1_H = 4.4;
  function frame(s) {
    var r = s.r, out = s.street === 'x+' ? 1 : -1, xs = out > 0 ? r[2] : r[0], sx0 = out > 0 ? r[2] - WALL_T : r[0], bx0 = out > 0 ? r[0] : r[2] - WALL_T;
    return { r: r, out: out, xs: xs, zc: s.zc, cx: (r[0] + r[2]) / 2, sx0: sx0, sx1: sx0 + WALL_T, bx0: bx0, bx1: bx0 + WALL_T,
      inner: [r[0] + WALL_T, r[1] + WALL_T, r[2] - WALL_T, r[3] - WALL_T], door: { x: xs, z: s.zc, out: out, w: DOOR_W, h: DOOR_H } };
  }
  // The ground floor's walls as boxes [x0, z0, x1, z1]: back, two sides, the street wall either side of the door
  function wallRects(f) {
    var r = f.r, zc = f.zc;
    return [[f.bx0, r[1], f.bx1, r[3]], [r[0], r[1], r[2], r[1] + WALL_T], [r[0], r[3] - WALL_T, r[2], r[3]],
      [f.sx0, r[1] + WALL_T, f.sx1, zc - DOOR_W / 2], [f.sx0, zc + DOOR_W / 2, f.sx1, r[3] - WALL_T]];
  }
  // Returns { inner: [x0, z0, x1, z1] (the room inside), door: { x, z, out, w, h } }; the door blocks the way while shut.
  SK.collide = function (s, tag) {
    var f = frame(s), W = MP.World, I = f.inner;
    wallRects(f).forEach(function (q) { W.solid(q[0], q[1], q[2], q[3], 30, tag); });
    W.surface(I[0], I[1], I[2], I[3], 0.07, tag);
    W.surface(f.sx0 - 0.01, f.zc - DOOR_W / 2, f.sx1 + 0.01, f.zc + DOOR_W / 2, 0.05, tag);
    if (!s.open) SK.doorSolid(s, tag + ':door');
    return { inner: I, door: f.door };
  };
  SK.doorSolid = function (s, tag) { var f = frame(s); MP.World.solid(f.sx0, f.zc - DOOR_W / 2, f.sx1, f.zc + DOOR_W / 2, 30, tag); };

  // The upper storeys, shared by both levels of detail
  function upper(b, s, f, lite) {
    var M = MP.M, r = f.r, cx = f.cx, zc = f.zc, c2 = [cx - 3, zc - 3, cx + 3, zc + 3];
    skirt(b, [r[0] - 0.9, r[1] - 0.9, r[2] + 0.9, r[3] + 0.9], c2, F1_H - 0.05, 5.15, 0.4, { th: 0.22, lite: lite });
    walls(b, c2, 4.95, 8.0, { solid: false, bay: 2, every: 1, boards: 0, window: s.win, winW: 0.9, winH: 0.9 * s.winAspect, plaster: s.wall });
    if (s.tier === 'none') {
      skirt(b, [c2[0] - 0.8, c2[1] - 0.8, c2[2] + 0.8, c2[3] + 0.8], [cx, zc - 0.7, cx, zc + 0.7], 7.95, 10.2, 0.45, { th: 0.2, lite: lite });
      G.limb(b, M.ridge, [cx, 10.3, zc - 0.9], [cx, 10.3, zc + 0.9], 0.14, 0.14, lite ? 4 : 8);
    } else { // a third tier: gold on the beams while the subject is active, shuttered once it goes dormant
      var c3 = [cx - 2.1, zc - 2.1, cx + 2.1, zc + 2.1];
      skirt(b, [c2[0] - 0.8, c2[1] - 0.8, c2[2] + 0.8, c2[3] + 0.8], c3, 7.95, 8.75, 0.4, { th: 0.2, lite: lite });
      walls(b, c3, 8.55, 11.0, { solid: false, bay: 2.1, every: 1, boards: 0, window: s.tier === 'active' ? s.win : M.shutter, winW: 1.0, winH: s.tier === 'active' ? s.winAspect : 1.05, plaster: s.wall, beam: s.tier === 'active' ? M.goldLeaf : M.timber });
      gableRoof(b, [c3[0] - 0.2, c3[1] - 0.2, c3[2] + 0.2, c3[3] + 0.2], 11.0, 12.7, 'z', 0.6, { fishSize: 0.55, fish: s.tier === 'active', lite: lite });
    }
  }
  // Windows in the band's shape: two on each side, two flanking the door
  function groundWindows(b, s, f, ws) {
    var r = f.r, wy = 2.35, out = f.out;
    function win(dir, at, c) { var o = dir[1] === '+' ? 1 : -1; if (dir[0] === 'z') G.panel(b, s.win, c, wy, at + o * 0.02, ws, ws * s.winAspect, dir); else G.panel(b, s.win, at + o * 0.02, wy, c, ws, ws * s.winAspect, dir); }
    [-1.9, 1.9].forEach(function (d) { win('z-', r[1], f.cx + d); win('z+', r[3], f.cx + d); win(out > 0 ? 'x-' : 'x+', out > 0 ? r[0] : r[2], f.zc + d); });
    win(s.street, f.xs, f.zc - 2.75); win(s.street, f.xs, f.zc + 2.75);
  }

  // Full detail. Returns { leaves: [left pivot, right pivot], plaque: mesh }.
  SK.module = function (b, s) {
    var M = MP.M, f = frame(s), r = f.r, out = f.out, xs = f.xs, zc = f.zc, inner = f.inner;
    // low stone plinth round the outside, and the walls: boarding below, plaster above; the street wall has the door gap
    [[r[0] - 0.15, r[1] - 0.15, r[2] + 0.15, r[1] + 0.05], [r[0] - 0.15, r[3] - 0.05, r[2] + 0.15, r[3] + 0.15]].forEach(function (q) { G.box(b, M.stone, q[0], 0, q[1], q[2], 0.3, q[3]); });
    var back = out > 0 ? [r[0] - 0.15, r[1], r[0] + 0.05, r[3]] : [r[2] - 0.05, r[1], r[2] + 0.15, r[3]];
    G.box(b, M.stone, back[0], 0, back[1], back[2], 0.3, back[3]);
    wallRects(f).forEach(function (q) {
      G.box(b, s.wall, q[0], 1.0, q[1], q[2], F1_H, q[3]);
      G.box(b, M.timber, q[0] - 0.02, 0, q[1] - 0.02, q[2] + 0.02, 1.0, q[3] + 0.02);
    });
    G.box(b, s.wall, f.sx0, DOOR_H, zc - DOOR_W / 2, f.sx1, F1_H, zc + DOOR_W / 2);  // over the door
    G.box(b, M.timber, inner[0], 0.02, inner[1], inner[2], 0.07, inner[3]);   // floor
    G.box(b, M.eave, inner[0], F1_H - 0.12, inner[1], inner[2], F1_H, inner[3]); // ceiling
    // the door's timber frame, a beam over it, and the brass plaque above
    var fx0 = Math.min(xs, xs + out * 0.18), fx1 = Math.max(xs, xs + out * 0.18);
    G.box(b, M.timber, fx0, 0, zc - DOOR_W / 2 - 0.22, fx1, DOOR_H + 0.2, zc - DOOR_W / 2);
    G.box(b, M.timber, fx0, 0, zc + DOOR_W / 2, fx1, DOOR_H + 0.2, zc + DOOR_W / 2 + 0.22);
    G.box(b, M.timber, fx0, DOOR_H, zc - DOOR_W / 2 - 0.3, fx1, DOOR_H + 0.28, zc + DOOR_W / 2 + 0.3);
    // timber beam round the top of the ground floor
    G.box(b, M.timber, r[0] - 0.07, F1_H - 0.3, r[1] - 0.07, r[2] + 0.07, F1_H, r[1]); G.box(b, M.timber, r[0] - 0.07, F1_H - 0.3, r[3], r[2] + 0.07, F1_H, r[3] + 0.07);
    G.box(b, M.timber, r[0] - 0.07, F1_H - 0.3, r[1], r[0], F1_H, r[3]); G.box(b, M.timber, r[2], F1_H - 0.3, r[1], r[2] + 0.07, F1_H, r[3]);
    groundWindows(b, s, f, 1.15);
    upper(b, s, f, false);
    // the door leaves: hinged at the frame, closed across the opening; each a timber slab with the gate's studs
    var leaves = [-1, 1].map(function (sd) {
      var pivot = new THREE.Group(); pivot.position.set(xs - out * 0.02, 0, zc + sd * DOOR_W / 2);
      var g = new THREE.BoxGeometry(0.08, DOOR_H - 0.02, DOOR_W / 2 - 0.02);
      var leaf = new THREE.Mesh(g, M.doorLeaf); // one material, so each leaf is a single draw
      leaf.position.set(-out * 0.04, DOOR_H / 2, -sd * (DOOR_W / 4)); leaf.castShadow = false; leaf.receiveShadow = true;
      pivot.add(leaf); s.group.add(pivot); pivot.userData = { side: sd, out: out, leaf: leaf };
      return pivot;
    });
    var plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.4), s.plaqueMat);
    plaque.position.set(xs + out * 0.225, DOOR_H + 0.55, zc); /* just proud of its backing plate */ plaque.rotation.y = out > 0 ? Math.PI / 2 : -Math.PI / 2; s.group.add(plaque);
    var plate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.46, 1.58), M.timber); plate.position.set(xs + out * 0.18, DOOR_H + 0.55, zc); s.group.add(plate);
    return { leaves: leaves, plaque: plaque };
  };

  // Placeholder detail for far rooms: one plinth, a solid ground floor (timber below, band plaster above), the door
  // shut (or a dark doorway if you left it open), the band's windows, a beam, and the same storeys and roofs with
  // coarser curves. Hollow inside isn't needed: you can't see in from this far.
  SK.lite = function (b, s) {
    var M = MP.M, f = frame(s), r = f.r, out = f.out, xs = f.xs, zc = f.zc;
    G.box(b, M.stone, r[0] - 0.15, 0, r[1] - 0.15, r[2] + 0.15, 0.3, r[3] + 0.15);
    G.box(b, M.timber, r[0], 0.3, r[1], r[2], 1.0, r[3]);
    G.box(b, s.wall, r[0], 1.0, r[1], r[2], F1_H - 0.3, r[3]);
    G.box(b, M.timber, r[0] - 0.07, F1_H - 0.3, r[1] - 0.07, r[2] + 0.07, F1_H, r[3] + 0.07);
    G.panel(b, s.open ? M.doorway : M.doorLeaf, xs + out * 0.02, DOOR_H / 2, zc, DOOR_W, DOOR_H, s.street);
    var fx0 = Math.min(xs, xs + out * 0.18), fx1 = Math.max(xs, xs + out * 0.18);
    G.box(b, M.timber, fx0, DOOR_H, zc - DOOR_W / 2 - 0.3, fx1, DOOR_H + 0.28, zc + DOOR_W / 2 + 0.3);
    groundWindows(b, s, f, 1.15);
    upper(b, s, f, true);
  };

  MP.Skins = MP.Skins || {};
  MP.Skins.pagoda = { name: 'Japanese pagoda', keep: SK.keep, module: SK.module, lite: SK.lite, collide: SK.collide, doorSolid: SK.doorSolid, parts: { skirt: skirt, gableRoof: gableRoof, dormer: dormer, karahafu: karahafu, walls: walls, stoneFoot: stoneFoot } };
})();
