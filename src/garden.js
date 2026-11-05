/* Memory Palace: the zen garden in the middle of the Central Hall, round the cascade.
   - The sand keeps every groove. It's a height map (1 cm a pixel) turned into a normal map, so grooves catch the light.
   - The rake hangs on a rack at the garden's west edge. Take hold of its handle (grip, or trigger with your hand on
     it) and drag its tines through the sand: the grooves follow your stroke, flow round the rocks and the basin, and
     stay. Let go and it goes back on its rack. On a flat screen, hold R and move the mouse over the sand.
   - Rocks can be picked up and set down anywhere; set one in the sand and rings form round it.
   - A small wooden stand by the rake holds the garden's settings: how many rocks, the sand's colour, how many tines
     the rake has, and smoothing the sand back to its plain raked pattern. Point and pull the trigger (or click).
   The sand, the rocks and the settings are kept on this headset. */
(function () {
  'use strict';
  var MP = window.MP, R = MP.R, W = MP.World;
  var Gd = MP.Garden = {};
  var BED = Gd.BED = [-5, -4.5, 5, 4.5], GW = 1024, GH = 922, PX = (BED[2] - BED[0]) / GW;
  var SPACING = 0.12, HEAD = 0.6;
  var SANDS = { White: '#ece6d8', Grey: '#bdb8ae', Warm: '#dcc6a0', Charcoal: '#5c5954' }, SAND_NAMES = Object.keys(SANDS);
  var COUNTS = [3, 5, 7], TINES = [3, 5, 7];
  var ROCKS = [[-3.0, -2.2, 0.42], [3.1, 2.4, 0.5], [-3.4, 2.6, 0.34], [-1.8, -2.95, 0.24], [2.2, 3.25, 0.28], [3.4, -2.6, 0.32], [-2.4, 0.9, 0.2]];
  var S = Gd.settings = { rocks: 5, sand: 'White', tines: 5 };
  var heights = new Float32Array(GW * GH), data = new Uint8Array(GW * GH * 4), tex, sandMat, sandY, rocks = [], rake, dirty = null;

  // ---------- The sand: heights → normals ----------
  function ix(x) { return (x - BED[0]) / PX; } function jz(z) { return (BED[3] - z) / PX; }
  function wx(i) { return BED[0] + (i + 0.5) * PX; } function wz(j) { return BED[3] - (j + 0.5) * PX; }
  function blockedAt(x, z, pad) { // inside the basin or a rock: the sand there isn't raked
    var B = MP.Hall.BASIN; if (Math.hypot(x - B.x, z - B.z) < B.r + pad) return true;
    for (var k = 0; k < rocks.length; k++) { var r = rocks[k]; if (r.mesh.visible && !r.holder && Math.hypot(x - r.mesh.position.x, z - r.mesh.position.z) < r.r + pad) return true; }
    return false;
  }
  function mark(i0, j0, i1, j1) { // grow the region whose normals need working out again
    i0 = Math.max(1, Math.floor(i0) - 1); j0 = Math.max(1, Math.floor(j0) - 1); i1 = Math.min(GW - 2, Math.ceil(i1) + 1); j1 = Math.min(GH - 2, Math.ceil(j1) + 1);
    if (!dirty) dirty = [i0, j0, i1, j1]; else { dirty[0] = Math.min(dirty[0], i0); dirty[1] = Math.min(dirty[1], j0); dirty[2] = Math.max(dirty[2], i1); dirty[3] = Math.max(dirty[3], j1); }
  }
  var DEPTH = 1.7; // how steep a groove's walls look
  function normals(i0, j0, i1, j1) {
    for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) {
      var p = j * GW + i, dx = (heights[p + 1] - heights[p - 1]) * DEPTH, dy = (heights[p - GW] - heights[p + GW]) * DEPTH, l = Math.sqrt(dx * dx + dy * dy + 1), q = p * 4;
      data[q] = (-dx / l * 0.5 + 0.5) * 255; data[q + 1] = (dy / l * 0.5 + 0.5) * 255; data[q + 2] = (1 / l * 0.5 + 0.5) * 255; data[q + 3] = 255;
    }
  }
  var lastUpload = 0;
  R.onFrame(function (dt, now) {
    if (!dirty || now - lastUpload < 50) return; // at most 20 uploads a second while raking
    normals(dirty[0], dirty[1], dirty[2], dirty[3]); dirty = null; tex.needsUpdate = true; lastUpload = now;
  });
  function wave(u) { return 0.5 + 0.5 * Math.cos(2 * Math.PI * u); }
  function ringsAround(cx, cz, r0, band, all) { // concentric grooves round a rock or the basin
    var i0 = Math.max(0, ix(cx - r0 - band)), i1 = Math.min(GW - 1, ix(cx + r0 + band)), j0 = Math.max(0, jz(cz + r0 + band)), j1 = Math.min(GH - 1, jz(cz - r0 - band));
    for (var j = Math.floor(j0); j <= j1; j++) for (var i = Math.floor(i0); i <= i1; i++) {
      var d = Math.hypot(wx(i) - cx, wz(j) - cz) - r0; if (d < 0 || d > band) continue;
      var w = MP.clamp((band - d) / 0.1, 0, 1), p = j * GW + i; heights[p] = MP.lerp(heights[p], wave(d / SPACING), w);
    }
    mark(i0, j0, i1, j1);
  }
  // the plain pattern: straight grooves east to west, rings round the basin and each rock
  function plain() {
    for (var j = 0; j < GH; j++) { var h = wave(wz(j) / SPACING); for (var i = 0; i < GW; i++) heights[j * GW + i] = h; }
    var B = MP.Hall.BASIN; ringsAround(B.x, B.z, B.r, 0.5);
    rocks.forEach(function (r) { if (r.mesh.visible) ringsAround(r.mesh.position.x, r.mesh.position.z, r.r, 0.42); });
    dirty = [1, 1, GW - 2, GH - 2];
  }
  // Drag the rake's tines from a to b (world x, z): grooves follow the stroke, one per tine, flowing round the rocks.
  var lastSide = null;
  function rakeSeg(ax, az, bx, bz, tines) {
    var mx = bx - ax, mz = bz - az, len = Math.hypot(mx, mz); if (len < 0.002) return false;
    var nx = -mz / len, nz = mx / len, half = HEAD / 2, sp = HEAD / tines;
    var i0 = Math.max(1, ix(Math.min(ax, bx) - half)), i1 = Math.min(GW - 2, ix(Math.max(ax, bx) + half)), j0 = Math.max(1, jz(Math.max(az, bz) + half)), j1 = Math.min(GH - 2, jz(Math.min(az, bz) - half));
    for (var j = Math.floor(j0); j <= j1; j++) for (var i = Math.floor(i0); i <= i1; i++) {
      var x = wx(i), z = wz(j), t = ((x - ax) * mx + (z - az) * mz) / (len * len); if (t < 0 || t > 1) continue;
      var u = (x - ax - t * mx) * nx + (z - az - t * mz) * nz; if (Math.abs(u) > half) continue;
      if (blockedAt(x, z, 0.03)) continue;
      heights[j * GW + i] = wave((u + half) / sp - 0.5) * (0.85 + 0.15 * Math.min(1, (half - Math.abs(u)) / 0.02));
    }
    mark(i0, j0, i1, j1); return true;
  }

  // ---------- Saving ----------
  var saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      var h8 = new Uint8Array(GW * GH); for (var p = 0; p < h8.length; p++) h8[p] = heights[p] * 255;
      MP.store.set('garden', { v: 1, settings: Object.assign({}, S), rocks: rocks.map(function (r) { return [r.mesh.position.x, r.mesh.position.z, r.mesh.rotation.y]; }), h: h8 });
    }, 1200);
  }

  // ---------- Rocks ----------
  function rockMesh(r, seed, mat) {
    var g = new THREE.IcosahedronGeometry(1, 3), p = g.attributes.position, rnd = MP.rng(seed), ph = [rnd() * 6, rnd() * 6, rnd() * 6];
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.16 * Math.sin(x * 2.3 + ph[0]) * Math.sin(z * 2.1 + ph[1]) + 0.08 * Math.sin(y * 4 + ph[2]) + 0.05 * Math.sin((x + z) * 7 + ph[0]);
      if (y < -0.35) y = -0.35 - (y + 0.35) * 0.3; // a flatter base to sit on
      p.setXYZ(i, x * k * r, y * k * r * 0.72, z * k * r * (0.85 + rnd() * 0.0));
    }
    g.computeVertexNormals();
    var m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
  }
  function restY(r, x, z) { var inBed = x > BED[0] && x < BED[2] && z > BED[1] && z < BED[3]; return (inBed ? sandY : MP.KEEP.FLOOR) + r.r * 0.72 * 0.3; }
  function inBed(x, z) { return x > BED[0] + 0.05 && x < BED[2] - 0.05 && z > BED[1] + 0.05 && z < BED[3] - 0.05; }
  function settle(r) { // after being set down: rest on what's below, rings in the sand
    r.mesh.rotation.x = 0; r.mesh.rotation.z = 0;
    var B = MP.Hall.BASIN, x = r.mesh.position.x, z = r.mesh.position.z, d = Math.hypot(x - B.x, z - B.z);
    if (d < B.r + r.r) { var k = (B.r + r.r + 0.02) / Math.max(d, 0.01); x = B.x + (x - B.x) * k; z = B.z + (z - B.z) * k; } // not in the pool
    x = MP.clamp(x, MP.KEEP.IN[0] + r.r, MP.KEEP.IN[2] - r.r); z = MP.clamp(z, MP.KEEP.IN[1] + r.r, MP.KEEP.IN[3] - r.r);
    r.fall = { x: x, z: z, y0: r.mesh.position.y, y1: restY(r, x, z), t: 0 };
  }
  function showRocks() { rocks.forEach(function (r, i) { r.mesh.visible = i < S.rocks; }); }

  // ---------- The rake ----------
  var REST = { p: new THREE.Vector3(-5.85, 1.12, -0.5), q: new THREE.Quaternion() };
  var TIP = new THREE.Vector3(0, -0.12, -1.9), AX = new THREE.Vector3(1, 0, 0);
  var rakeMat = null;
  function buildRake(group) {
    var g = new THREE.Group(), body = new THREE.Group(); g.add(body); g.userData.body = body;
    rakeMat = MP.M.inTimber.clone(); rakeMat.userData = {}; // its own: the rake moves, so it isn't part of the hall's detail bubble
    g.position.copy(REST.p); g.quaternion.copy(REST.q); group.add(g);
    return g;
  }
  // the rake's handle, crossbar and tines, merged into one mesh (rebuilt when the number of tines changes)
  function setTines(n) {
    var body = rake.userData.body; while (body.children.length) { var c = body.children[0]; c.geometry.dispose(); body.remove(c); }
    var b = new MP.R.Batch(body), h = new THREE.CylinderGeometry(0.017, 0.019, 1.92, 10); h.rotateX(Math.PI / 2); h.translate(0, 0, -0.95); b.add(rakeMat, h, true);
    var bar = new THREE.BoxGeometry(HEAD + 0.04, 0.05, 0.05); bar.translate(0, -0.02, -1.9); b.add(rakeMat, bar, true);
    for (var k = 0; k < n; k++) { var t = new THREE.BoxGeometry(0.016, 0.09, 0.016); t.translate((k + 0.5) * HEAD / n - HEAD / 2, -0.075, -1.9); b.add(rakeMat, t, true); }
    b.flush(); b.meshes.forEach(function (m) { m.castShadow = false; });
    rake.userData.tineCount = n;
  }
  var rk = { prev: null, home: null, held: false }, tip = new THREE.Vector3(), seg = new THREE.Vector3();
  function rakeTouch() { // where the tines are now, if they're in the sand
    rake.localToWorld(tip.copy(TIP));
    return tip.y < sandY + 0.05 && inBed(tip.x, tip.z) ? { x: tip.x, z: tip.z } : null;
  }
  function rakeTick(rec) {
    var t = rakeTouch();
    if (t && rk.prev) { if (rakeSeg(rk.prev.x, rk.prev.z, t.x, t.z, S.tines)) { rk.raked = true; if (rec) MP.Grab.buzz(rec, 0.06, 12); if (MP.Sound && MP.Sound.scrape) MP.Sound.scrape(Math.min(1, Math.hypot(t.x - rk.prev.x, t.z - rk.prev.z) * 30)); } }
    if (!t && MP.Sound && MP.Sound.scrape) MP.Sound.scrape(0);
    rk.prev = t;
  }

  // ---------- The settings stand ----------
  var board, bctx, BW = 512, BH = 400, ROWS;
  function drawBoard() {
    var g = bctx; g.fillStyle = '#f2e8d2'; g.fillRect(0, 0, BW, BH);
    g.strokeStyle = '#8a7a3c'; g.lineWidth = 14; g.strokeRect(7, 7, BW - 14, BH - 14);
    g.fillStyle = '#1f1a14'; g.textBaseline = 'middle'; g.font = '40px "Kaushan Script", cursive'; g.textAlign = 'center'; g.fillText('The garden', BW / 2, 50);
    ROWS = [
      { label: 'Rocks', opts: COUNTS.map(String), cur: String(S.rocks), set: function (v) { setSetting('rocks', +v); } },
      { label: 'Sand', opts: SAND_NAMES, cur: S.sand, set: function (v) { setSetting('sand', v); } },
      { label: 'Tines', opts: TINES.map(String), cur: String(S.tines), set: function (v) { setSetting('tines', +v); } },
      { label: 'Smooth the sand', opts: [], set: function () { plain(); save(); } }
    ];
    ROWS.forEach(function (row, k) {
      var y = 118 + k * 74; row.y0 = y - 34; row.y1 = y + 34;
      if (!row.opts.length) { g.font = '34px "Kaushan Script", cursive'; g.textAlign = 'center'; g.globalAlpha = 0.85; g.fillText(row.label, BW / 2, y); g.globalAlpha = 1; g.strokeStyle = 'rgba(31,26,20,0.45)'; g.lineWidth = 2.5; g.strokeRect(120, y - 28, BW - 240, 56); return; }
      g.font = '32px "Kaushan Script", cursive'; g.textAlign = 'left'; g.fillText(row.label, 30, y);
      var x0 = 140, w = (BW - 30 - x0) / row.opts.length; row.x0 = x0; row.w = w;
      row.opts.forEach(function (o, n) {
        var cx = x0 + (n + 0.5) * w, on = o === row.cur;
        g.font = (o.length > 2 ? 22 : 32) + 'px "Kaushan Script", cursive'; g.textAlign = 'center'; g.globalAlpha = on ? 1 : 0.55; g.fillText(o, cx, y); g.globalAlpha = 1;
        if (on) { g.strokeStyle = '#a8342a'; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, y, w / 2 - 4, 24, 0, 0, Math.PI * 2); g.stroke(); }
      });
    });
    board.material.map.needsUpdate = true;
  }
  function pressBoard(u, v) { // where on the board (0..1 across, 0..1 up)
    var px = u * BW, py = (1 - v) * BH;
    for (var k = 0; k < ROWS.length; k++) {
      var row = ROWS[k]; if (py < row.y0 || py > row.y1) continue;
      if (!row.opts.length) { row.set(); return row.label; }
      if (px < row.x0) { var i = (row.opts.indexOf(row.cur) + 1) % row.opts.length; row.set(row.opts[i]); return row.label + ' ' + row.opts[i]; } // the row's name: the next choice
      var n = MP.clamp(Math.floor((px - row.x0) / row.w), 0, row.opts.length - 1); row.set(row.opts[n]); return row.label + ' ' + row.opts[n];
    }
    return null;
  }
  function setSetting(k, v) {
    S[k] = v;
    if (k === 'rocks') { showRocks(); }
    if (k === 'sand') { var c = new THREE.Color(SANDS[v] || SANDS.White); sandMat.color.copy(c); sandMat.emissive.copy(c).multiplyScalar(0.28); }
    if (k === 'tines') setTines(v);
    drawBoard(); save();
  }
  function stand(b, group) {
    var M = MP.M, G = MP.Geo, F = MP.KEEP.FLOOR, x = -5.75, z = -3.3;
    G.box(b, M.inTimber, x - 0.2, F, z - 0.2, x + 0.2, F + 0.06, z + 0.2);
    G.box(b, M.inTimber, x - 0.05, F + 0.06, z - 0.05, x + 0.05, F + 0.98, z + 0.05);
    W.solid(x - 0.22, z - 0.3, x + 0.22, z + 0.3, 1.3, 'garden');
    var c = document.createElement('canvas'); c.width = BW; c.height = BH; bctx = c.getContext('2d');
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    var holder = new THREE.Group(); holder.position.set(x, F + 1.04, z); holder.rotation.y = -Math.PI / 2; group.add(holder);
    var back = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.03), M.inTimber); back.rotation.x = -0.62; holder.add(back);
    board = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.4375), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, emissive: new THREE.Color('#ffffff'), emissiveMap: t, emissiveIntensity: 0.35 }));
    board.rotation.x = -0.62; board.position.set(0, 0.009, 0.018); holder.add(board);
    MP.Interact.add(board, { label: 'Garden settings', use: function (hit) { return hit && hit.uv ? pressBoard(hit.uv.x, hit.uv.y) : null; } });
    // the rack the rake hangs on
    [-0.12, -2.0].forEach(function (dz) { G.box(b, M.inTimber, x - 0.15, F, z + 2.75 + dz - 0.04, x - 0.07, F + 1.06, z + 2.75 + dz + 0.04); G.box(b, M.inTimber, x - 0.2, F + 1.0, z + 2.75 + dz - 0.04, x + 0.0, F + 1.06, z + 2.75 + dz + 0.04); });
  }

  // ---------- Building ----------
  Gd.build = function (group) {
    var M = MP.M, G = MP.Geo, F = MP.KEEP.FLOOR, b = new MP.R.Batch(group);
    sandY = Gd.SAND = F + 0.13;
    // a stone curb round the bed
    var c = 0.22;
    G.box(b, M.stone, BED[0] - c, 0, BED[1] - c, BED[2] + c, F + 0.2, BED[1]); G.box(b, M.stone, BED[0] - c, 0, BED[3], BED[2] + c, F + 0.2, BED[3] + c);
    G.box(b, M.stone, BED[0] - c, 0, BED[1], BED[0], F + 0.2, BED[3]); G.box(b, M.stone, BED[2], 0, BED[1], BED[2] + c, F + 0.2, BED[3]);
    G.box(b, M.inTimber, BED[0], 0, BED[1], BED[2], sandY - 0.02, BED[3]);
    W.surface(BED[0] - c, BED[1] - c, BED[2] + c, BED[3] + c, F + 0.2, 'garden', true);
    W.surface(BED[0], BED[1], BED[2], BED[3], sandY, 'garden', true);
    stand(b, group);
    b.flush();
    // the sand
    tex = new THREE.DataTexture(data, GW, GH, THREE.RGBAFormat); tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.anisotropy = 4;
    var grain = M.gravel.map ? M.gravel.map.clone() : null; if (grain) { grain.wrapS = grain.wrapT = THREE.RepeatWrapping; grain.repeat.set(9, 8); grain.needsUpdate = true; }
    var col = new THREE.Color(SANDS.White);
    sandMat = new THREE.MeshStandardMaterial({ color: col, map: grain, normalMap: tex, normalScale: new THREE.Vector2(1, 1), roughness: 0.96, envMapIntensity: 0.35, emissive: col.clone().multiplyScalar(0.28) });
    var sand = new THREE.Mesh(new THREE.PlaneGeometry(BED[2] - BED[0], BED[3] - BED[1]), sandMat); sand.rotation.x = -Math.PI / 2; sand.position.set((BED[0] + BED[2]) / 2, sandY, (BED[1] + BED[3]) / 2);
    sand.receiveShadow = true; group.add(sand); Gd.sand = sand;
    // rocks
    var rockMat = M.stone.clone(); rockMat.userData = {}; MP.Detail.material(rockMat, M.stone.userData.set); rockMat.color = new THREE.Color('#9a958c'); rockMat.roughness = 0.88; rockMat.envMapIntensity = 0.5;
    rockMat.emissive = new THREE.Color('#3a3631'); rockMat.emissiveMap = M.stone.map; rockMat.emissiveIntensity = 0.5;
    ROCKS.forEach(function (d, i) {
      var r = { r: d[2], mesh: rockMesh(d[2], 31 + i * 7, rockMat) };
      r.mesh.position.set(d[0], 0, d[1]); r.mesh.rotation.y = i * 1.3; group.add(r.mesh); rocks.push(r);
      r.mesh.position.y = restY(r, d[0], d[1]);
      MP.Grab.add({
        label: 'Rock', reach: 0.16, enabled: function () { return r.mesh.visible; },
        at: function (out) { return out.copy(r.mesh.position); },
        near: function (p) { return p.distanceTo(r.mesh.position) - r.r * 0.75; },
        grab: function (rec) { r.fall = null; r.holder = rec; rec.grip.attach(r.mesh); },
        move: function () { },
        drop: function (rec) { r.holder = null; group.attach(r.mesh); settle(r); }
      });
    });
    // the rake on its rack
    rake = buildRake(group);
    MP.Grab.add({
      label: 'Rake', reach: 0.13,
      at: function (out) { return rake.localToWorld(out.set(0, 0, -0.5)); },
      near: function (p) { // distance from the handle
        var a = rake.localToWorld(new THREE.Vector3(0, 0, 0)), c = rake.localToWorld(new THREE.Vector3(0, 0, -1.7)), ab = c.clone().sub(a), t = MP.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
        return p.distanceTo(a.add(ab.multiplyScalar(t)));
      },
      grab: function (rec) { rk.home = null; rk.prev = null; rk.held = true; rec.grip.attach(rake); },
      move: function (rec) { rakeTick(rec); },
      drop: function () { rk.held = false; rk.prev = null; if (MP.Sound && MP.Sound.scrape) MP.Sound.scrape(0); group.attach(rake); rk.home = { p: rake.position.clone(), q: rake.quaternion.clone(), t: 0 }; if (rk.raked) { rk.raked = false; save(); } }
    });
    // rocks falling into place, and the rake going home to its rack
    R.onFrame(function (dt) {
      rocks.forEach(function (r) {
        if (!r.fall) return; var f = r.fall; f.t = Math.min(1, f.t + dt / 0.25);
        r.mesh.position.set(f.x, MP.lerp(f.y0, f.y1, f.t * f.t), f.z);
        if (f.t >= 1) { r.fall = null; if (inBed(f.x, f.z)) ringsAround(f.x, f.z, r.r, 0.4); save(); }
      });
      if (rk.home) {
        var h = rk.home; h.t = Math.min(1, h.t + dt / 0.6); var e = 1 - Math.pow(1 - h.t, 3);
        rake.position.lerpVectors(h.p, REST.p, e); rake.quaternion.slerpQuaternions(h.q, REST.q, e); if (h.t >= 1) rk.home = null;
      }
    });
    // flat screen: hold R and move the mouse over the sand
    var flatR = false, rc = new THREE.Raycaster(), prevHit = null, canvas = MP.$('#scene');
    addEventListener('keydown', function (e) { if (e.key && e.key.toLowerCase() === 'r' && !(e.target && /input|textarea/i.test(e.target.tagName))) flatR = true; });
    addEventListener('keyup', function (e) { if (e.key && e.key.toLowerCase() === 'r') { flatR = false; prevHit = null; if (rk.raked) { rk.raked = false; save(); } } });
    canvas.addEventListener('pointermove', function (e) {
      if (!flatR || R.presenting()) return;
      rc.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), R.camera);
      var hit = rc.intersectObject(sand)[0]; if (!hit) { prevHit = null; return; }
      if (prevHit && rakeSeg(prevHit.x, prevHit.z, hit.point.x, hit.point.z, S.tines)) rk.raked = true;
      prevHit = { x: hit.point.x, z: hit.point.z };
    });
    // what was kept: the settings, where the rocks are, the sand
    return MP.store.get('garden').then(function (g) {
      if (g && g.settings) { S.rocks = COUNTS.indexOf(g.settings.rocks) >= 0 ? g.settings.rocks : 5; S.sand = SANDS[g.settings.sand] ? g.settings.sand : 'White'; S.tines = TINES.indexOf(g.settings.tines) >= 0 ? g.settings.tines : 5; }
      if (g && Array.isArray(g.rocks)) g.rocks.forEach(function (p, i) { var r = rocks[i]; if (r && p) { r.mesh.position.set(p[0], restY(r, p[0], p[1]), p[1]); r.mesh.rotation.y = p[2] || 0; } });
      showRocks(); setTines(S.tines);
      var c2 = new THREE.Color(SANDS[S.sand]); sandMat.color.copy(c2); sandMat.emissive.copy(c2).multiplyScalar(0.28);
      if (g && g.h && g.h.length === GW * GH) { for (var p = 0; p < g.h.length; p++) heights[p] = g.h[p] / 255; dirty = [1, 1, GW - 2, GH - 2]; }
      else plain();
      normals(1, 1, GW - 2, GH - 2); dirty = null; tex.needsUpdate = true;
      if (document.fonts && document.fonts.load) document.fonts.load('32px "Kaushan Script"').then(drawBoard, drawBoard); else drawBoard();
      drawBoard();
    });
  };

  // ---------- For tests ----------
  Gd.rakeStroke = function (pts, tines) { var any = false; for (var k = 1; k < pts.length; k++) any = rakeSeg(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], tines || S.tines) || any; normals(1, 1, GW - 2, GH - 2); dirty = null; tex.needsUpdate = true; save(); return any; };
  // the sand's height along a line across (x, z) → (x2, z2), n samples
  Gd.profile = function (x, z, x2, z2, n) { var out = []; for (var k = 0; k < n; k++) { var t = k / (n - 1), i = Math.round(ix(MP.lerp(x, x2, t))), j = Math.round(jz(MP.lerp(z, z2, t))); out.push(Math.round(heights[j * GW + i] * 100) / 100); } return out; };
  Gd.press = function (label, option) { for (var k = 0; k < ROWS.length; k++) if (ROWS[k].label === label) { ROWS[k].set(option); return true; } return false; };
  Gd.report = function () { return { settings: Object.assign({}, S), rocks: rocks.filter(function (r) { return r.mesh.visible; }).map(function (r) { return [+r.mesh.position.x.toFixed(2), +r.mesh.position.y.toFixed(3), +r.mesh.position.z.toFixed(2)]; }), rake: rake.position.toArray().map(function (v) { return +v.toFixed(2); }), tines: rake.userData.tineCount, sand: '#' + sandMat.color.getHexString() }; };
  Gd.rakeTip = function () { rake.localToWorld(tip.copy(TIP)); return tip.toArray(); };
  Gd.boardPoint = function (u, v) { board.updateMatrixWorld(true); return board.localToWorld(new THREE.Vector3((u - 0.5) * 0.56, (v - 0.5) * 0.4375, 0)).toArray(); };
  Gd.boardNormal = function () { var n = new THREE.Vector3(0, 0, 1).transformDirection(board.matrixWorld); return n.toArray(); };
})();
