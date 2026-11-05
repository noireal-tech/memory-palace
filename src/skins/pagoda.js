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
    opts = opts || {}; var M = MP.M, th = opts.th || 0.28;
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
      b.add(M.roof, G.orient(G.sheet(function (a, t) { return pt(a, t); }, 14, 8, [eaveLen / 2.2, slope / 2.2]), [out[0], 1, out[2]]), true);
      b.add(M.eave, G.orient(G.sheet(function (a, t) { return pt(a, t * 0.92, -th); }, 14, 4, [eaveLen / 1.2, run / 1.2]), [0, -1, 0]), true);
      // the eave edge: a white plastered board from the tiles down to the rafters
      b.add(M.trim, G.orient(G.sheet(function (a, k) { var p = pt(a, 0); return [p[0] + out[0] * 0.02, p[1] - th * k - 0.02, p[2] + out[2] * 0.02]; }, 14, 1, [eaveLen / 3, 0.1]), out), true);
      // hip ridge: a rounded cap up each corner line
      var prev = pt(0, 0, 0.08);
      for (var k = 1; k <= 4; k++) { var nxt = pt(0, k / 4, 0.08); G.limb(b, M.ridge, prev, nxt, 0.17, 0.17, 8); prev = nxt; }
    }
    if (opts.capTop) G.floor(b, M.roof, i[0], i[1], i[2], i[3], yT + 0.01);
  }

  // A gable roof over rectangle r at height yB, ridge at yR, running along `axis` ('x' or 'z'), overhanging by ov.
  // The gable ends are white plastered triangles with a dark timber border and a gold ornament.
  function gableRoof(b, r, yB, yR, axis, ov, opts) {
    opts = opts || {}; var M = MP.M, cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2, th = 0.25;
    var along = axis === 'z', L0 = along ? r[1] - ov : r[0] - ov, L1 = along ? r[3] + ov : r[2] + ov, half = (along ? r[2] - r[0] : r[3] - r[1]) / 2 + ov;
    function P(l, w, y) { return along ? [cx + w, y, l] : [l, y, cz + w]; }
    [-1, 1].forEach(function (sd) {
      var span = Math.hypot(half, yR - yB), len = L1 - L0;
      var f = function (a, t, dy) { var w = sd * half * (1 - t), y = yB - 0.15 + (yR - yB + 0.15) * Math.pow(t, 1.25) + (dy || 0); return P(MP.lerp(L0, L1, a), w, y); };
      var out = along ? [sd, 1, 0] : [0, 1, sd];
      b.add(M.roof, G.orient(G.sheet(function (a, t) { return f(a, t); }, 10, 6, [len / 2.2, span / 2.2]), out), true);
      b.add(M.eave, G.orient(G.sheet(function (a, t) { return f(a, t, -th); }, 10, 3, [len / 1.2, span / 1.2]), [0, -1, 0]), true);
      b.add(M.trim, G.orient(G.sheet(function (a, k) { var p = f(a, 0); p[1] -= th * k; return p; }, 10, 1, [len / 3, 0.1]), along ? [sd, 0, 0] : [0, 0, sd]), true);
    });
    // gable ends: plaster triangle, timber border, gold ornament at the apex
    [[along ? r[1] + 0.3 : r[0] + 0.3, -1], [along ? r[3] - 0.3 : r[2] - 0.3, 1]].forEach(function (e) {
      var l = e[0], hw = half - ov, a = P(l, -hw, yB), c = P(l, hw, yB), t = P(l, 0, yR - 0.25), out = along ? [0, 0, e[1]] : [e[1], 0, 0];
      G.tris(b, M.trim, a.concat(c, t), out);
      G.limb(b, M.timber, a, t, 0.12, 0.12, 6); G.limb(b, M.timber, c, t, 0.12, 0.12, 6);
      var orn = new THREE.CylinderGeometry(0.42, 0.42, 0.12, 16); orn.rotateX(Math.PI / 2); if (!along) orn.rotateY(Math.PI / 2);
      var op = P(l + e[1] * 0.08, 0, yR - 0.95); orn.translate(op[0], op[1], op[2]); b.add(M.gold, orn);
    });
    // ridge cap and golden roof fish at each end
    var ra = P(L0 + 0.2, 0, yR + 0.12), rb = P(L1 - 0.2, 0, yR + 0.12);
    G.limb(b, M.ridge, ra, rb, 0.28, 0.28, 10);
    if (opts.fish !== false) { shachi(b, P(L0 + 0.5, 0, yR + 0.2), along ? 'z' : 'x', 1, opts.fishSize || 1); shachi(b, P(L1 - 0.5, 0, yR + 0.2), along ? 'z' : 'x', -1, opts.fishSize || 1); }
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
    opts = opts || {}; var M = MP.M, h = y1 - y0, boards = opts.boards === undefined ? 0.32 : opts.boards, pl = opts.plaster || M.plaster;
    // opts.hollow (a wall thickness): four walls round an empty middle instead of one solid block, so it can have an
    // inside; opts.gap { x0, x1, y1 }: an opening in the south (z-) wall from the floor up to y1, such as a gate
    var gap = opts.gap, sol = opts.solid !== false;
    function southBox(mat, za, zb, ya, yb, solid) { // a box across the south side, split round the gap
      if (!gap || gap.y1 <= ya) { G.box(b, mat, r[0] - (mat === pl ? 0 : e), ya, za, r[2] + (mat === pl ? 0 : e), yb, zb, solid); return; }
      G.box(b, mat, r[0] - (mat === pl ? 0 : e), ya, za, gap.x0, yb, zb, solid); G.box(b, mat, gap.x1, ya, za, r[2] + (mat === pl ? 0 : e), yb, zb, solid);
      if (yb > gap.y1) G.box(b, mat, gap.x0, gap.y1, za, gap.x1, yb, zb, false);
    }
    var e = 0.05, bt = y0 + h * boards;
    if (opts.hollow) {
      var t = opts.hollow;
      southBox(pl, r[1], r[1] + t, y0, y1, sol); G.box(b, pl, r[0], y0, r[3] - t, r[2], y1, r[3], sol);
      G.box(b, pl, r[0], y0, r[1] + t, r[0] + t, y1, r[3] - t, sol); G.box(b, pl, r[2] - t, y0, r[1] + t, r[2], y1, r[3] - t, sol);
    } else G.box(b, pl, r[0], y0, r[1], r[2], y1, r[3], sol);
    if (boards > 0) { // the boarding stands slightly proud of the plaster
      southBox(M.timber, r[1] - e, r[1], y0, bt, false); G.box(b, M.timber, r[0] - e, y0, r[3], r[2] + e, bt, r[3] + e);
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
        if (opts.hollow && opts.inside) { // the same window seen from inside: paper glowing with daylight
          var ia = at - out * (opts.hollow + 0.03), idir = (dir[0]) + (out > 0 ? '-' : '+'), ih = opts.inside.y !== undefined ? opts.inside.y : wy;
          if (dir[0] === 'z') G.panel(b, opts.inside.mat, cc, ih, ia, ww, wh, idir); else G.panel(b, opts.inside.mat, ia, ih, cc, ww, wh, idir);
        }
      }
    });
  }
  // A battered stone base for a building: leaning faces from the ground up to `top`, footprint r at the top.
  // opts.inner: a rectangle left open in the middle (the foot is a ring round a hall); opts.gap [x0, x1]: a passage
  // through the south face (the gate). Without opts.inner the foot is solid and blocks walking.
  function stoneFoot(b, r, top, bottom, opts) {
    opts = opts || {};
    var d = top - bottom, M = MP.M, sides = [[r[0], r[1], r[2], r[1], [0, 0, -1]], [r[2], r[1], r[2], r[3], [1, 0, 0]], [r[2], r[3], r[0], r[3], [0, 0, 1]], [r[0], r[3], r[0], r[1], [-1, 0, 0]]];
    if (opts.gap) { var s0 = sides.shift(); sides.unshift([s0[0], s0[1], opts.gap[0], s0[3], s0[4]], [opts.gap[1], s0[1], s0[2], s0[3], s0[4]]); }
    sides.forEach(function (s) {
      var g = G.sheet(function (a, t) {
        var o = (0.16 * t + 0.06 * t * t) * d, x = MP.lerp(s[0], s[2], a), z = MP.lerp(s[1], s[3], a);
        x += x <= r[0] + 1e-6 ? -o : x >= r[2] - 1e-6 ? o : 0; z += z <= r[1] + 1e-6 ? -o : z >= r[3] - 1e-6 ? o : 0;
        return [x, top - t * d, z];
      }, 10, 4, [Math.hypot(s[2] - s[0], s[3] - s[1]) / 3.4, d / 3.4]);
      b.add(M.stone, G.orient(g, s[4]), true);
    });
    var o = (0.16 + 0.06) * d, n = opts.inner;
    if (!n) { G.floor(b, M.stone, r[0], r[1], r[2], r[3], top); MP.World.solid(r[0] - o, r[1] - o, r[2] + o, r[3] + o, top + 30, 'keep'); return; }
    // the top of the ring: four strips round the open middle (the gate passage cuts the south one)
    if (opts.gap) { G.floor(b, M.stone, r[0], r[1], opts.gap[0], n[1], top); G.floor(b, M.stone, opts.gap[1], r[1], r[2], n[1], top); }
    else G.floor(b, M.stone, r[0], r[1], r[2], n[1], top);
    G.floor(b, M.stone, r[0], n[3], r[2], r[3], top); G.floor(b, M.stone, r[0], n[1], n[0], n[3], top); G.floor(b, M.stone, n[2], n[1], r[2], n[3], top);
  }

  // ---------- The keep ----------
  // The hall's inside: polished boards, plaster lit from within over a dark timber wainscot, posts along the walls and
  // four round pillars, a coffered ceiling, and the stairwell: an opening at the back rising to a closed sliding door
  // at the Review Hall's floor level (the floors above come later).
  function hallInside(b) {
    var M = MP.M, IN = K.IN, F = K.FLOOR, C = K.CEIL, H = K.HOLE, W = MP.World, sk = 0.03, gx = 2.1, gt = K.GATE.h + 0.45;
    var x0 = IN[0], z0 = IN[1], x1 = IN[2], z1 = IN[3];
    G.box(b, M.inTimber, x0, 0, z0, x1, F, z1);
    W.surface(x0, z0, x1, z1, F, 'keep', true);
    // walls, and the wainscot (to 1 m) just proud of them
    [[M.inWall, 0, C], [M.inTimber, sk, 1.0]].forEach(function (L) {
      var mat = L[0], i = L[1], top = L[2];
      G.box(b, mat, x0, F, z1 - sk - i, x1, top, z1 - i); G.box(b, mat, x0 + i, F, z0, x0 + sk + i, top, z1); G.box(b, mat, x1 - sk - i, F, z0, x1 - i, top, z1);
      G.box(b, mat, x0, F, z0 + i, -gx, top, z0 + sk + i); G.box(b, mat, gx, F, z0 + i, x1, top, z0 + sk + i);
      if (top > gt) G.box(b, mat, -gx, gt, z0 + i, gx, top, z0 + sk + i);
    });
    // a beam round the top of the walls, and posts at every bay
    G.box(b, M.inTimber, x0, C - 0.36, z1 - 0.12, x1, C, z1); G.box(b, M.inTimber, x0, C - 0.36, z0, x1, C, z0 + 0.12);
    G.box(b, M.inTimber, x0, C - 0.36, z0, x0 + 0.12, C, z1); G.box(b, M.inTimber, x1 - 0.12, C - 0.36, z0, x1, C, z1);
    for (var p = -7.5; p <= 7.6; p += 2.5) {
      G.box(b, M.inTimber, p - 0.13, F, z1 - 0.2, p + 0.13, C, z1);
      if (Math.abs(p) > 2.7) G.box(b, M.inTimber, p - 0.13, F, z0, p + 0.13, C, z0 + 0.2);
    }
    for (var q = -8.75; q <= 8.8; q += 2.5) { G.box(b, M.inTimber, x0, F, q - 0.13, x0 + 0.2, C, q + 0.13); G.box(b, M.inTimber, x1 - 0.2, F, q - 0.13, x1, C, q + 0.13); }
    // four round pillars holding up the middle of the span
    [[-7.2, -6.2], [7.2, -6.2], [-7.2, 5.0], [7.2, 5.0]].forEach(function (c) {
      G.limb(b, M.inTimber, [c[0], F, c[1]], [c[0], C, c[1]], 0.25, 0.23, 14);
      G.box(b, M.stone, c[0] - 0.36, 0, c[1] - 0.36, c[0] + 0.36, 0.14, c[1] + 0.36);
      W.solid(c[0] - 0.3, c[1] - 0.3, c[0] + 0.3, c[1] + 0.3, C, 'keep');
    });
    // the ceiling, round the stairwell opening; it stops teleport arcs
    [[x0, z0, x1, H[1]], [x0, H[3], x1, z1], [x0, H[1], H[0], H[3]], [H[2], H[1], x1, H[3]]].forEach(function (c) {
      G.box(b, M.inCeil, c[0], C, c[1], c[2], C + 0.12, c[3]); W.solid(c[0], c[1], c[2], c[3], 30, 'keep', C);
    });
    // coffers: a grid of beams under the ceiling (none across the opening)
    for (var bz = -7.95; bz < 7; bz += 2.65) G.box(b, M.inTimber, x0, C - 0.22, bz - 0.09, x1, C, bz + 0.09);
    for (var bx = -7.2; bx <= 7.3; bx += 2.4) G.box(b, M.inTimber, bx - 0.09, C - 0.22, z0, bx + 0.09, C, bx > H[0] - 0.2 && bx < H[2] + 0.2 ? H[1] : z1);
    // the stairwell: a shaft up from the opening, lined, lidded, with a beam round its rim
    var S = K.SHAFT, U = K.UPPER;
    G.box(b, M.inWall, H[0], C, H[3], H[2], S, H[3] + 0.1); G.box(b, M.inWall, H[0], C, H[1] - 0.1, H[2], S, H[1]);
    G.box(b, M.inWall, H[0] - 0.1, C, H[1], H[0], S, H[3]); G.box(b, M.inWall, H[2], C, H[1], H[2] + 0.1, S, H[3]);
    G.box(b, M.inCeil, H[0], S, H[1], H[2], S + 0.1, H[3]);
    W.solid(H[0] - 0.1, H[3], H[2] + 0.1, H[3] + 0.1, S, 'keep', C); W.solid(H[0] - 0.1, H[1] - 0.1, H[2] + 0.1, H[1], S, 'keep', C);
    W.solid(H[0] - 0.1, H[1], H[0], H[3], S, 'keep', C); W.solid(H[2], H[1], H[2] + 0.1, H[3], S, 'keep', C); W.solid(H[0], H[1], H[2], H[3], 30, 'keep', S);
    G.box(b, M.inTimber, H[0] - 0.14, C - 0.2, H[1] - 0.14, H[2] + 0.14, C, H[1]); G.box(b, M.inTimber, H[0] - 0.14, C - 0.2, H[3], H[2] + 0.14, C, H[3] + 0.14);
    G.box(b, M.inTimber, H[2], C - 0.2, H[1], H[2] + 0.14, C, H[3]);
    // at the top landing, a closed sliding door into the Review Hall: paper lit from the far side, in a timber frame
    var dz = (H[1] + H[3]) / 2;
    G.panel(b, M.shoji, H[0] + 0.02, U + 1.0, dz, 1.0, 1.96, 'x+');
    G.box(b, M.inTimber, H[0], U, dz - 0.56, H[0] + 0.08, U + 2.1, dz - 0.5); G.box(b, M.inTimber, H[0], U, dz + 0.5, H[0] + 0.08, U + 2.1, dz + 0.56);
    G.box(b, M.inTimber, H[0], U + 1.98, dz - 0.56, H[0] + 0.08, U + 2.1, dz + 0.56);
    G.box(b, M.inTimber, H[0], U + 0.94, dz - 0.5, H[0] + 0.06, U + 0.98, dz + 0.5);
  }

  // The keep's ground floor is the Central Hall: a timber-floored hall inside the stone base and the first tier, entered
  // through the gate passage. MP.KEEP records its layout for what goes inside it (hall.js, garden.js).
  var K = MP.KEEP = {
    IN: [-9.6, -10.6, 9.6, 10.6],    // the hall's inside walls
    FLOOR: 0.04, CEIL: 6.2,           // floor top and ceiling underside
    GATE: { x: 2.08, w: 2.06, h: 3.0, z: -11.95 - 0.25, sill: 0.18 }, // hinges at x = ±x, the leaves' outer face at z
    HOLE: [-5.6, 7.4, 1.2, 8.6], SHAFT: 9.6, UPPER: 7.2 // the stairwell up to the Review Hall's floor level
  };
  SK.keep = function (group) {
    var M = MP.M, b = new MP.R.Batch(group), FOOT = 2.2, W = MP.World, IN = K.IN, r = [-10.4, -11.4, 10.4, 11.4], o = 0.22 * (FOOT + 0.3);
    var t1 = [-10, -11, 10, 11], gz = -11.4 - 0.55, PX = 2.1;
    stoneFoot(b, r, FOOT, -0.3, { inner: IN, gap: [-2.35, 2.35] });
    // the stone and walls round the hall block walking; the gate passage is the way in
    W.solid(r[0] - o, r[1] - o, -PX, IN[1], 30, 'keep'); W.solid(PX, r[1] - o, r[2] + o, IN[1], 30, 'keep');
    W.solid(r[0] - o, IN[3], r[2] + o, r[3] + o, 30, 'keep'); W.solid(r[0] - o, IN[1], IN[0], IN[3], 30, 'keep'); W.solid(IN[2], IN[1], r[2] + o, IN[3], 30, 'keep');
    // gate: a timber frame whose posts and lintel line the passage through to the hall; the leaves are in hall.js
    G.box(b, M.timber, -2.6, 0, gz - 0.5, -PX, 3.3, IN[1] + 0.03, true, 'keep'); G.box(b, M.timber, PX, 0, gz - 0.5, 2.6, 3.3, IN[1] + 0.03, true, 'keep');
    G.box(b, M.timber, -2.8, K.GATE.h, gz - 0.55, 2.8, 3.45, IN[1] + 0.03);
    W.solid(-PX, gz - 0.55, PX, IN[1], 30, 'keep', K.GATE.h); // the lintel: a teleport arc stops on it
    G.box(b, M.timber, -PX, 0, gz - 0.19, PX, K.GATE.sill, gz + 0.4);                 // the sill
    G.box(b, M.paving, -PX, 0, gz + 0.4, PX, K.FLOOR, IN[1] + 0.03);                     // the passage floor
    W.surface(-PX, gz - 0.19, PX, gz + 0.4, K.GATE.sill, 'keep', true); W.surface(-PX, gz + 0.4, PX, IN[1] + 0.03, K.FLOOR, 'keep', true);
    // (the cusped gable that stood over the gate now crowns the foyer's porch: SK.foyer)
    // first tier: hollow walls over the hall, with paper windows glowing on the inside too
    walls(b, t1, FOOT, 6.4, { bay: 2.5, hollow: 0.4, solid: false, gap: { x0: -PX, x1: PX, y1: K.GATE.h + 0.45 }, inside: { mat: M.shoji, y: 4.85 } });
    hallInside(b);
    skirt(b, [-11.9, -12.9, 11.9, 12.9], [-7.6, -8.6, 7.6, 8.6], 6.2, 7.5, 0.6);
    dormer(b, 'z-', -11.3, 0, 7.2, 6.75, 2.6, 3.2); dormer(b, 'z+', 11.3, 0, 7.2, 6.75, 2.6, 3.2);
    dormer(b, 'x-', -10.3, -4.5, 4.4, 6.7, 1.7, 2.4); dormer(b, 'x-', -10.3, 4.5, 4.4, 6.7, 1.7, 2.4);
    dormer(b, 'x+', 10.3, -4.5, 4.4, 6.7, 1.7, 2.4); dormer(b, 'x+', 10.3, 4.5, 4.4, 6.7, 1.7, 2.4);
    // second tier
    walls(b, [-7.6, -8.6, 7.6, 8.6], 7.2, 10.8, { bay: 2.2, odd: true, boards: 0.26, hollow: 0.4, solid: false }); // hollow: the Review Hall's floor, later
    skirt(b, [-9.4, -10.4, 9.4, 10.4], [-5.6, -6.6, 5.6, 6.6], 10.6, 11.8, 0.55);
    dormer(b, 'x-', -8.4, 0, 6.2, 11.0, 2.2, 2.8); dormer(b, 'x+', 8.4, 0, 6.2, 11.0, 2.2, 2.8);
    karahafu(b, 0, -9.8, 5.2, 11.05, 1.15, 2.6, -1);
    // third tier: gold leaf on the beams and boarding
    walls(b, [-5.6, -6.6, 5.6, 6.6], 11.5, 14.6, { bay: 2.2, every: 1, boards: 0.22, beam: M.goldLeaf, winW: 0.9, solid: false });
    skirt(b, [-7.2, -8.2, 7.2, 8.2], [-4.2, -5.0, 4.2, 5.0], 14.4, 15.4, 0.5);
    // crown: a lookout tier with a balcony rail, under a hip-and-gable roof with its gable facing the gate
    var t4 = [-4.2, -5.0, 4.2, 5.0];
    walls(b, t4, 15.2, 18.0, { bay: 2.1, every: 1, boards: 0, winY: 1.45, winH: 1.5, winW: 1.2, solid: false });
    G.box(b, M.timber, t4[0] - 0.9, 15.15, t4[1] - 0.9, t4[2] + 0.9, 15.35, t4[3] + 0.9);
    [[t4[0] - 0.85, t4[1] - 0.85, t4[2] + 0.85, t4[1] - 0.75], [t4[0] - 0.85, t4[3] + 0.75, t4[2] + 0.85, t4[3] + 0.85], [t4[0] - 0.85, t4[1] - 0.85, t4[0] - 0.75, t4[3] + 0.85], [t4[2] + 0.75, t4[1] - 0.85, t4[2] + 0.85, t4[3] + 0.85]]
      .forEach(function (r) { G.box(b, M.timber, r[0], 16.15, r[1], r[2], 16.3, r[3]); });
    for (var k = 0; k <= 8; k++) { var px = MP.lerp(t4[0] - 0.8, t4[2] + 0.8, k / 8); G.box(b, M.timber, px - 0.06, 15.35, t4[1] - 0.86, px + 0.06, 16.15, t4[1] - 0.74); G.box(b, M.timber, px - 0.06, 15.35, t4[3] + 0.74, px + 0.06, 16.15, t4[3] + 0.86); }
    skirt(b, [-6.0, -6.8, 6.0, 6.8], [-3.6, -4.2, 3.6, 4.2], 17.8, 18.6, 0.55);
    gableRoof(b, [-3.6, -4.2, 3.6, 4.2], 18.6, 21.4, 'z', 0.7, { fishSize: 1.1 });
    b.flush();
    return b;
  };

  // ---------- The foyer ----------
  // A genkan built onto the front of the keep: you come in from the forecourt under a carriage porch with the cusped
  // gable, through sliding lattice doors (foyer.js), onto a sunken stone floor (the doma); one step up is the timber
  // floor, and at the back, set in the keep's stone, the ring gate through to the Central Hall. Training is run from
  // here (foyer.js puts up its boards). Its floor sits at the hall's level so the gate's leaves swing clear.
  var F = MP.FOYER = {
    R: [-5.0, -19.0, 5.0, -11.95],     // outside of its walls (the back is the keep's stone)
    IN: [-4.75, -18.75, 4.75, -11.95], // inside
    STEP: -17.0, DOMA: -0.1, FLOOR: 0.04, CEIL: 3.6, TOP: 3.9, RIDGE: 5.45,
    DOOR: { x: 1.2, h: 2.6, z: -18.6 }, // the entrance: an opening x ±1.2, the sliding doors just inside the south wall
    PORCH: { z: -20.5, post: 1.85 }
  };
  SK.foyer = function (group) {
    var M = MP.M, b = new MP.R.Batch(group), W = MP.World, R0 = F.R, I = F.IN, D = F.DOOR, T = F.TOP, C = F.CEIL, P = F.PORCH, t = 0.25;
    // a low stone plinth under the walls
    G.box(b, M.stone, R0[0] - 0.1, -0.3, R0[1] - 0.1, -D.x, 0.3, R0[1] + t); G.box(b, M.stone, D.x, -0.3, R0[1] - 0.1, R0[2] + 0.1, 0.3, R0[1] + t);
    G.box(b, M.stone, R0[0] - 0.1, -0.3, R0[1] + t, R0[0] + t + 0.02, 0.3, R0[3]); G.box(b, M.stone, R0[2] - t - 0.02, -0.3, R0[1] + t, R0[2] + 0.1, 0.3, R0[3]);
    // walls: white plaster over dark boarding outside, lamp-lit plaster over a wainscot inside; the entrance in the south wall
    function wall(x0, z0, x1, z1, y0, y1, solid) { G.box(b, M.plaster, x0, y0, z0, x1, y1, z1, solid, 'foyer'); }
    wall(R0[0], R0[1], R0[0] + t, R0[3], 0.3, T, true); wall(R0[2] - t, R0[1], R0[2], R0[3], 0.3, T, true);
    wall(R0[0] + t, R0[1], -D.x, R0[1] + t, 0.3, T, true); wall(D.x, R0[1], R0[2] - t, R0[1] + t, 0.3, T, true);
    wall(-D.x, R0[1], D.x, R0[1] + t, D.h, T, false); W.solid(-D.x, R0[1], D.x, R0[1] + t, T, 'foyer', D.h);
    var e = 0.04, bt = 1.25;
    G.box(b, M.timber, R0[0] - e, 0.3, R0[1] - e, -D.x, bt, R0[1]); G.box(b, M.timber, D.x, 0.3, R0[1] - e, R0[2] + e, bt, R0[1]);
    G.box(b, M.timber, R0[0] - e, 0.3, R0[1], R0[0], bt, R0[3]); G.box(b, M.timber, R0[2], 0.3, R0[1], R0[2] + e, bt, R0[3]);
    G.box(b, M.timber, R0[0] - 0.07, T - 0.3, R0[1] - 0.07, R0[2] + 0.07, T, R0[1]); // the beam round the top
    G.box(b, M.timber, R0[0] - 0.07, T - 0.3, R0[1], R0[0], T, R0[3]); G.box(b, M.timber, R0[2], T - 0.3, R0[1], R0[2] + 0.07, T, R0[3]);
    // the entrance's frame: posts and a lintel, outside and in
    G.box(b, M.timber, -D.x - 0.16, 0, R0[1] - 0.06, -D.x, D.h + 0.18, R0[1] + t + 0.06); G.box(b, M.timber, D.x, 0, R0[1] - 0.06, D.x + 0.16, D.h + 0.18, R0[1] + t + 0.06);
    G.box(b, M.timber, -D.x - 0.16, D.h, R0[1] - 0.08, D.x + 0.16, D.h + 0.22, R0[1] + t + 0.06);
    // windows high in the side walls: lattice outside, paper lit by day inside
    [-15.6, -13.4].forEach(function (z) {
      G.panel(b, M.window, R0[0] - 0.035, 2.75, z, 1.0, 0.62, 'x-'); G.panel(b, M.window, R0[2] + 0.035, 2.75, z, 1.0, 0.62, 'x+');
      G.panel(b, M.shoji, I[0] + 0.035, 2.75, z, 1.0, 0.62, 'x+'); G.panel(b, M.shoji, I[2] - 0.035, 2.75, z, 1.0, 0.62, 'x-');
    });
    // inside: plaster and wainscot; the floors; the step up; the ceiling with its coffers
    var sk = 0.03, wy = 0.95;
    [[M.inWall, 0, C], [M.inTimber, sk, wy]].forEach(function (L) {
      var m = L[0], i = L[1], y1 = L[2];
      G.box(b, m, I[0] + i, F.DOMA, I[1], I[0] + i + sk, y1, I[3]); G.box(b, m, I[2] - i - sk, F.DOMA, I[1], I[2] - i, y1, I[3]);
      G.box(b, m, I[0], F.DOMA, I[1] + i, -D.x, y1, I[1] + i + sk); G.box(b, m, D.x, F.DOMA, I[1] + i, I[2], y1, I[1] + i + sk);
      if (y1 > D.h + 0.22) G.box(b, m, -D.x, D.h + 0.22, I[1] + i, D.x, y1, I[1] + i + sk);
    });
    G.box(b, M.stone, I[0], F.DOMA - 0.3, I[1], I[2], F.DOMA, F.STEP);                       // the doma: stone, a step down
    G.box(b, M.stone, -D.x, -0.3, R0[1] - 0.02, D.x, 0.03, I[1]);                              // the threshold
    G.box(b, M.inTimber, I[0], F.DOMA, F.STEP, I[2], F.FLOOR, I[3]);                          // the timber floor
    G.box(b, M.inTimber, I[0], F.DOMA, F.STEP - 0.12, I[2], F.FLOOR + 0.02, F.STEP + 0.06);     // the step's edge beam
    G.box(b, M.inCeil, I[0], C, I[1], I[2], C + 0.1, -11.0);
    for (var cz = -17.6; cz < -12.4; cz += 1.6) G.box(b, M.inTimber, I[0], C - 0.18, cz - 0.07, I[2], C, cz + 0.07);
    for (var cx = -3.2; cx <= 3.3; cx += 1.6) G.box(b, M.inTimber, cx - 0.07, C - 0.18, I[1], cx + 0.07, C, -12.0);
    G.box(b, M.inTimber, I[0], C - 0.3, I[1], I[2], C, I[1] + 0.12); // the beam round the top, inside
    G.box(b, M.inTimber, I[0], C - 0.3, I[1], I[0] + 0.12, C, I[3]); G.box(b, M.inTimber, I[2] - 0.12, C - 0.3, I[1], I[2], C, I[3]);
    // a shoe cupboard on the doma, as every genkan has
    G.box(b, M.inTimber, I[0] + 0.05, F.DOMA, -18.5, I[0] + 0.5, 0.95, -17.25, true, 'foyer');
    G.box(b, M.inCeil, I[0] + 0.5, F.DOMA + 0.12, -18.42, I[0] + 0.52, 0.85, -17.33);
    // where you can stand: the porch, the threshold, the doma, the timber floor (up to the gate's sill); the ceiling stops arcs
    W.surface(-D.x, R0[1] - 0.02, D.x, I[1], 0.03, 'foyer', true);
    W.surface(I[0], I[1], I[2], F.STEP, F.DOMA, 'foyer', true);
    W.surface(I[0], F.STEP, I[2], -12.16, F.FLOOR, 'foyer', true);
    W.solid(I[0], I[1], I[2], -11.0, 30, 'foyer', C);
    // the carriage porch: a stone apron, two posts, and the cusped gable that used to stand over the gate
    G.box(b, M.stone, -2.4, -0.3, P.z - 0.35, 2.4, 0.06, R0[1]);
    W.surface(-2.4, P.z - 0.35, 2.4, R0[1] - 0.02, 0.06, 'foyer', true);
    [-1, 1].forEach(function (s) {
      G.box(b, M.timber, s * P.post - 0.12, 0.06, P.z - 0.12, s * P.post + 0.12, 3.05, P.z + 0.12, true, 'foyer');
      G.box(b, M.stone, s * P.post - 0.2, 0, P.z - 0.2, s * P.post + 0.2, 0.12, P.z + 0.2);
    });
    G.box(b, M.timber, -P.post - 0.2, 2.86, P.z - 0.16, P.post + 0.2, 3.1, P.z + 0.16);           // the beam across the posts
    G.box(b, M.timber, -P.post - 0.08, 2.9, P.z, -P.post + 0.08, 3.06, R0[1]); G.box(b, M.timber, P.post - 0.08, 2.9, P.z, P.post + 0.08, 3.06, R0[1]);
    karahafu(b, 0, P.z + 0.55, 4.6, 3.06, 1.05, 1.5, -1, 2.95);
    // the main roof: a gable along the foyer's length, its front gable over the porch, its back tucked under the keep's eaves
    gableRoof(b, [R0[0], R0[1], R0[2], R0[3] - 0.3], T, F.RIDGE, 'z', 0.55, { fish: false });
    W.solid(R0[0] - 0.6, R0[1] - 0.6, R0[2] + 0.6, R0[3], 30, 'foyer', T); // nothing lands on the roof
    b.flush();
    return b;
  };

  // A room's facade module (step 2 builds these; the shape is defined here so every skin supplies its own).
  // A room's facade module, from outside. s = {
  //   r: [x0, z0, x1, z1] ground-floor footprint (8 x 8 m), street: 'x-' | 'x+' (the side its door faces), zc: door centre,
  //   wall: plaster material in the band's colour, win: the band's window material,
  //   tier: 'none' | 'active' | 'shuttered' (a third tier for an active subject; shuttered once it goes dormant),
  //   group: where the door leaves and plaque go (they move or change, so they aren't merged) }
  // The ground floor is hollow: walls round a floor, a ceiling, and a door opening on the street side.
  // Returns { leaves: [left pivot, right pivot], plaque: mesh, inner: [x0, z0, x1, z1] (the room inside) }.
  var DOOR_W = 2.2, DOOR_H = 2.9, WALL_T = 0.3, F1_H = 4.4;
  SK.module = function (b, s) {
    var M = MP.M, r = s.r, out = s.street === 'x+' ? 1 : -1, xs = out > 0 ? r[2] : r[0], zc = s.zc, tag = 'room:' + s.addr;
    var inner = [r[0] + WALL_T, r[1] + WALL_T, r[2] - WALL_T, r[3] - WALL_T];
    // low stone plinth round the outside, and the walls: boarding below, plaster above; the street wall has the door gap
    [[r[0] - 0.15, r[1] - 0.15, r[2] + 0.15, r[1] + 0.05], [r[0] - 0.15, r[3] - 0.05, r[2] + 0.15, r[3] + 0.15]].forEach(function (q) { G.box(b, M.stone, q[0], 0, q[1], q[2], 0.3, q[3]); });
    var back = out > 0 ? [r[0] - 0.15, r[1], r[0] + 0.05, r[3]] : [r[2] - 0.05, r[1], r[2] + 0.15, r[3]];
    G.box(b, M.stone, back[0], 0, back[1], back[2], 0.3, back[3]);
    function wallBox(x0, z0, x1, z1, y0, y1) {
      G.box(b, s.wall, x0, Math.max(y0, 1.0), z0, x1, y1, z1, false);
      if (y0 < 1.0) G.box(b, M.timber, x0 - 0.02, y0, z0 - 0.02, x1 + 0.02, Math.min(1.0, y1), z1 + 0.02, false);
      MP.World.solid(x0, z0, x1, z1, 30, tag);
    }
    var sx0 = out > 0 ? r[2] - WALL_T : r[0], sx1 = sx0 + WALL_T, bx0 = out > 0 ? r[0] : r[2] - WALL_T, bx1 = bx0 + WALL_T;
    wallBox(bx0, r[1], bx1, r[3], 0, F1_H);                                // back wall
    wallBox(r[0], r[1], r[2], r[1] + WALL_T, 0, F1_H); wallBox(r[0], r[3] - WALL_T, r[2], r[3], 0, F1_H); // side walls
    wallBox(sx0, r[1] + WALL_T, sx1, zc - DOOR_W / 2, 0, F1_H); wallBox(sx0, zc + DOOR_W / 2, sx1, r[3] - WALL_T, 0, F1_H); // street wall either side of the door
    G.box(b, s.wall, sx0, DOOR_H, zc - DOOR_W / 2, sx1, F1_H, zc + DOOR_W / 2);  // over the door
    G.box(b, M.timber, inner[0], 0.02, inner[1], inner[2], 0.07, inner[3]);   // floor
    G.box(b, M.eave, inner[0], F1_H - 0.12, inner[1], inner[2], F1_H, inner[3]); // ceiling
    MP.World.surface(inner[0], inner[1], inner[2], inner[3], 0.07, tag);
    // the ceiling and the wall over the door stop a teleport arc (you can't land in a room through its roof)
    MP.World.solid(inner[0], inner[1], inner[2], inner[3], 30, tag, F1_H - 0.12);
    MP.World.solid(Math.min(sx0, sx1), zc - DOOR_W / 2, Math.max(sx0, sx1), zc + DOOR_W / 2, 30, tag, DOOR_H);
    MP.World.surface(Math.min(sx0, sx1) - 0.01, zc - DOOR_W / 2, Math.max(sx0, sx1) + 0.01, zc + DOOR_W / 2, 0.05, tag);
    // the door's timber frame, a beam over it, and the brass plaque above
    var fx0 = Math.min(xs, xs + out * 0.18), fx1 = Math.max(xs, xs + out * 0.18);
    G.box(b, M.timber, fx0, 0, zc - DOOR_W / 2 - 0.22, fx1, DOOR_H + 0.2, zc - DOOR_W / 2);
    G.box(b, M.timber, fx0, 0, zc + DOOR_W / 2, fx1, DOOR_H + 0.2, zc + DOOR_W / 2 + 0.22);
    G.box(b, M.timber, fx0, DOOR_H, zc - DOOR_W / 2 - 0.3, fx1, DOOR_H + 0.28, zc + DOOR_W / 2 + 0.3);
    // timber beam round the top of the ground floor
    G.box(b, M.timber, r[0] - 0.07, F1_H - 0.3, r[1] - 0.07, r[2] + 0.07, F1_H, r[1]); G.box(b, M.timber, r[0] - 0.07, F1_H - 0.3, r[3], r[2] + 0.07, F1_H, r[3] + 0.07);
    G.box(b, M.timber, r[0] - 0.07, F1_H - 0.3, r[1], r[0], F1_H, r[3]); G.box(b, M.timber, r[2], F1_H - 0.3, r[1], r[2] + 0.07, F1_H, r[3]);
    // windows in the band's shape: two on each side, two flanking the door
    var wy = 2.35, ws = 1.15;
    function win(dir, at, c) { var o = dir[1] === '+' ? 1 : -1; if (dir[0] === 'z') G.panel(b, s.win, c, wy, at + o * 0.02, ws, ws * s.winAspect, dir); else G.panel(b, s.win, at + o * 0.02, wy, c, ws, ws * s.winAspect, dir); }
    var cx = (r[0] + r[2]) / 2;
    [-1.9, 1.9].forEach(function (d) { win('z-', r[1], cx + d); win('z+', r[3], cx + d); win(out > 0 ? 'x-' : 'x+', out > 0 ? r[0] : r[2], zc + d); });
    win(s.street, xs, zc - 2.75); win(s.street, xs, zc + 2.75);
    // first roof, then the upper floor
    var c2 = [cx - 3, zc - 3, cx + 3, zc + 3];
    skirt(b, [r[0] - 0.9, r[1] - 0.9, r[2] + 0.9, r[3] + 0.9], c2, F1_H - 0.05, 5.15, 0.4, { th: 0.22 });
    walls(b, c2, 4.95, 8.0, { solid: false, bay: 2, every: 1, boards: 0, window: s.win, winW: 0.9, winH: 0.9 * s.winAspect, plaster: s.wall });
    if (s.tier === 'none') {
      skirt(b, [c2[0] - 0.8, c2[1] - 0.8, c2[2] + 0.8, c2[3] + 0.8], [cx, zc - 0.7, cx, zc + 0.7], 7.95, 10.2, 0.45, { th: 0.2 });
      G.limb(b, M.ridge, [cx, 10.3, zc - 0.9], [cx, 10.3, zc + 0.9], 0.14, 0.14, 8);
    } else { // a third tier: gold on the beams while the subject is active, shuttered once it goes dormant
      var c3 = [cx - 2.1, zc - 2.1, cx + 2.1, zc + 2.1];
      skirt(b, [c2[0] - 0.8, c2[1] - 0.8, c2[2] + 0.8, c2[3] + 0.8], c3, 7.95, 8.75, 0.4, { th: 0.2 });
      walls(b, c3, 8.55, 11.0, { solid: false, bay: 2.1, every: 1, boards: 0, window: s.tier === 'active' ? s.win : M.shutter, winW: 1.0, winH: s.tier === 'active' ? s.winAspect : 1.05, plaster: s.wall, beam: s.tier === 'active' ? M.goldLeaf : M.timber });
      gableRoof(b, [c3[0] - 0.2, c3[1] - 0.2, c3[2] + 0.2, c3[3] + 0.2], 11.0, 12.7, 'z', 0.6, { fishSize: 0.55, fish: s.tier === 'active' });
    }
    // the door leaves: hinged at the frame, closed across the opening; each a timber slab with the gate's studs
    var leaves = [-1, 1].map(function (sd) {
      var pivot = new THREE.Group(); pivot.position.set(xs - out * 0.02, 0, zc + sd * DOOR_W / 2);
      var g = new THREE.BoxGeometry(0.08, DOOR_H - 0.02, DOOR_W / 2 - 0.02);
      var leaf = new THREE.Mesh(g, M.doorLeaf); // one material, so each leaf is a single draw
      leaf.position.set(-out * 0.04, DOOR_H / 2, -sd * (DOOR_W / 4)); leaf.castShadow = false; leaf.receiveShadow = true;
      pivot.add(leaf); s.group.add(pivot); pivot.userData = { side: sd, out: out, leaf: leaf };
      return pivot;
    });
    MP.World.solid(Math.min(sx0, sx1), zc - DOOR_W / 2, Math.max(sx0, sx1), zc + DOOR_W / 2, 30, tag + ':door');
    var plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.4), s.plaqueMat);
    plaque.position.set(xs + out * 0.225, DOOR_H + 0.55, zc); /* just proud of its backing plate */ plaque.rotation.y = out > 0 ? Math.PI / 2 : -Math.PI / 2; s.group.add(plaque);
    var plate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.46, 1.58), M.timber); plate.position.set(xs + out * 0.18, DOOR_H + 0.55, zc); s.group.add(plate);
    return { leaves: leaves, plaque: plaque, inner: inner, door: { x: xs, z: zc, out: out, w: DOOR_W, h: DOOR_H } };
  };

  MP.Skins = MP.Skins || {};
  MP.Skins.pagoda = { name: 'Japanese pagoda', keep: SK.keep, foyer: SK.foyer, module: SK.module, parts: { skirt: skirt, gableRoof: gableRoof, dormer: dormer, karahafu: karahafu, walls: walls, stoneFoot: stoneFoot } };
})();
