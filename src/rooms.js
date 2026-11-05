/* Memory Palace: your rooms, from outside. Each room in your plan stands on the band and row grid as a facade module
   in the skin's style: walls in its band's colour, windows whose shape shifts across the palace (round on the feeling
   side in the west, through arched, the castle's barred windows in the middle and softened squares, to sharp squares
   on the logic side in the east), a brass plaque over its street door with the name you give it, and a third tier
   while its subject is active (shuttered once it goes dormant; rooms never disappear). With no plan yet, sixteen
   unnamed rooms stand in the five bands (STARTER), ready to be named.
   Levels of detail: only the room you're at (the one you're in, else the nearest within FOCUS_R) and its neighbours
   on the grid (across the street, the next row, across the garden) wear the full facade: framed door that swings,
   brass plaque, finely curved roofs. Every other room is a lightweight placeholder with the same pagoda outline,
   band colour and windows, all of them merged into a few draws. As you walk, the new full facades are built a few
   at a time out of sight and swapped in together. Where you can walk never changes with the detail.
   Street doors open and close when you point and pull the trigger (or click) and stay as you leave them. Until a
   room's interior is built (a later step), its door opens onto a simple placeholder room, furnished as you approach
   the room (the same bubble idea as the textures) and cleared once you've left. */
(function () {
  'use strict';
  var MP = window.MP, R = MP.R, G = MP.Geo, W = MP.World;
  var BANDS = { W2: -48, W1: -24, C: 0, E1: 24, E2: 48 };
  var WALL = { W2: '#b0603a', W1: '#d9b8a2', C: '#ede8dd', E1: '#a9b6c4', E2: '#2f4a6b' }; // fired clay, pale clay, lime plaster, pale slate, indigo slate
  var SHAPE = { W2: 'round', W1: 'arched', C: 'bars', E1: 'soft', E2: 'square' };
  var NEAR = 15, FAR = 32, FOCUS_R = 16, NEIGHBOUR_R = 14.5;
  var Rm = MP.Rooms = { list: [], group: new THREE.Group(), liteBatch: null };
  // sixteen rooms, mirrored across the palace's north-south axis: three in each outer band, four in the centre
  Rm.STARTER = ['W2.W.N1', 'W2.E.N1', 'W2.W.S1', 'W1.W.N1', 'W1.E.N1', 'W1.W.S1', 'C.W.N2', 'C.E.N2', 'C.W.N3', 'C.E.N3',
    'E1.W.N1', 'E1.E.N1', 'E1.E.S1', 'E2.W.N1', 'E2.E.N1', 'E2.E.S1'];
  var BRUSH = '"Kaushan Script", "Bricolage Grotesque", cursive', SANS = '"Bricolage Grotesque", system-ui, sans-serif';

  // ---------- Where a room stands ----------
  var ADDR = /^(W2|W1|C|E1|E2)\.(W|E)\.(N|S)(\d+)$/;
  function layout(addr) {
    var m = ADDR.exec(addr); if (!m) return null;
    var band = m[1], d = m[2] === 'E' ? 1 : -1, k = +m[4], zc = (m[3] === 'N' ? 1 : -1) * (7 + 10 * (k - 1));
    if (k < 1 || Math.abs(zc) + 4 > MP.SITE.PLAT[3] - 1.3) return null;            // off the platform
    var xs = BANDS[band] + 2 * d, x0 = Math.min(xs, xs + 8 * d), x1 = Math.max(xs, xs + 8 * d), r = [x0, zc - 4, x1, zc + 4];
    // not on the keep, its forecourt or the gardens
    if (r[0] < 11 && r[2] > -11 && r[1] < 12 && r[3] > -33) return null;
    return { band: band, side: m[2], d: d, zc: zc, r: r, street: d > 0 ? 'x-' : 'x+' };
  }
  Rm.layout = layout;

  // ---------- Window shapes and plaques, drawn here ----------
  var winMats = {};
  function windowMat(shape) {
    if (shape === 'bars') return MP.M.window;
    if (winMats[shape]) return winMats[shape];
    var S = 256, c = document.createElement('canvas'); c.width = c.height = S; var g = c.getContext('2d');
    function path(inset) {
      var a = inset, b = S - inset; g.beginPath();
      if (shape === 'round') g.arc(S / 2, S / 2, S / 2 - inset, 0, Math.PI * 2);
      else if (shape === 'arched') { var rr = (b - a) / 2; g.moveTo(a, b); g.lineTo(a, a + rr); g.arc(S / 2, a + rr, rr, Math.PI, 0); g.lineTo(b, b); g.closePath(); }
      else if (shape === 'soft') { if (g.roundRect) g.roundRect(a, a, b - a, b - a, (b - a) * 0.2); else g.rect(a, a, b - a, b - a); }
      else g.rect(a, a, b - a, b - a);
    }
    // dark timber frame, then paper in a lattice that glows a little
    path(4); g.fillStyle = '#3a2c22'; g.fill();
    path(20); g.fillStyle = '#efe2c2'; g.fill();
    g.save(); path(20); g.clip(); g.strokeStyle = '#4a382a'; g.lineWidth = 6;
    for (var i = 1; i < 4; i++) { g.beginPath(); g.moveTo(S * i / 4, 0); g.lineTo(S * i / 4, S); g.stroke(); g.beginPath(); g.moveTo(0, S * i / 4); g.lineTo(S, S * i / 4); g.stroke(); }
    g.restore();
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    var m = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, roughness: 0.85, emissive: new THREE.Color(1, 0.82, 0.55), emissiveMap: t, emissiveIntensity: 0.12 });
    m.userData.castShadow = false;
    return (winMats[shape] = m);
  }
  function plaqueTexture(room) {
    var c = room.plaqueCanvas || (room.plaqueCanvas = document.createElement('canvas')); c.width = 768; c.height = 205; var g = c.getContext('2d');
    var grd = g.createLinearGradient(0, 0, 0, 205); grd.addColorStop(0, '#e2bf74'); grd.addColorStop(0.5, '#b88a3e'); grd.addColorStop(1, '#8e6528');
    g.fillStyle = grd; g.fillRect(0, 0, 768, 205);
    g.strokeStyle = '#6b4a1c'; g.lineWidth = 10; g.strokeRect(10, 10, 748, 185); g.strokeStyle = 'rgba(255, 236, 190, 0.6)'; g.lineWidth = 3; g.strokeRect(20, 20, 728, 165);
    var name = room.name || room.address, big = room.name ? BRUSH : SANS;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    // engraved: a light edge below, the dark cut above it
    var size = 86; g.font = size + 'px ' + big; while (g.measureText(name).width > 690 && size > 30) { size -= 4; g.font = size + 'px ' + big; }
    g.fillStyle = 'rgba(255, 236, 190, 0.55)'; g.fillText(name, 386, room.name ? 100 : 104);
    g.fillStyle = '#3d2a10'; g.fillText(name, 384, room.name ? 97 : 101);
    if (room.name) { g.font = '600 26px ' + SANS; g.fillStyle = '#4a3214'; g.fillText(room.address, 384, 172); }
    if (!room.tex) { room.tex = new THREE.CanvasTexture(c); room.tex.colorSpace = THREE.SRGBColorSpace; room.tex.anisotropy = 4; }
    room.tex.needsUpdate = true;
    return room.tex;
  }

  // ---------- Building the facades ----------
  var doorState = {}, skin = null, focus = null;
  function spec(rm, group) {
    var L = rm.L;
    return { r: L.r, street: L.street, zc: L.zc, wall: rm.wall, win: windowMat(rm.shape), winAspect: rm.shape === 'arched' ? 1.25 : 1, addr: rm.address,
      tier: rm.active ? 'active' : rm.wasActive ? 'shuttered' : 'none', group: group || null, plaqueMat: rm.plaqueMat, open: rm.open };
  }
  Rm.build = function () {
    // clear what was there
    Rm.list.forEach(function (rm) { dropFull(rm); dropInterior(rm); forgetLite(rm); Rm.group.remove(rm.dyn); W.drop('room:' + rm.address); W.drop('room:' + rm.address + ':door'); });
    if (Rm.liteBatch) { Rm.liteBatch.clear(); Rm.liteBatch = null; }
    Rm.list = []; focus = null;
    var plan = MP.Plan.data; if (!plan) return;
    skin = MP.Skins[MP.params.get('skin') || 'pagoda'] || MP.Skins.pagoda;
    var seen = {};
    plan.rooms.forEach(function (rec) {
      var L = layout(rec.address); if (!L || seen[rec.address]) return; seen[rec.address] = true;
      var rm = { address: rec.address, rec: rec, name: rec.name || '', active: !!rec.active, wasActive: !!rec.wasActive, L: L, dyn: new THREE.Group(), full: null, targets: [],
        wall: wallMat(rec.wall || WALL[L.band]), shape: SHAPE[L.band], centre: [(L.r[0] + L.r[2]) / 2, L.zc] };
      Rm.group.add(rm.dyn);
      rm.plaqueMat = new THREE.MeshStandardMaterial({ map: plaqueTexture(rm), metalness: 0.75, roughness: 0.38 });
      rm.open = !!doorState[rec.address]; rm.angle = rm.open ? 1 : 0;
      var c = skin.collide(spec(rm), 'room:' + rec.address); rm.inner = c.inner; rm.door = c.door;
      Rm.list.push(rm);
    });
    // neighbours on the grid: across the street (12 m), the next row (10 m), across the garden (12 m), across the spine (14 m)
    Rm.list.forEach(function (rm) { rm.near = Rm.list.filter(function (o) { return o !== rm && Math.hypot(o.centre[0] - rm.centre[0], o.centre[1] - rm.centre[1]) <= NEIGHBOUR_R; }); });
    Rm.settle();
  };

  // ---------- Levels of detail ----------
  function rectDist(r, p) { var dx = Math.max(r[0] - p.x, 0, p.x - r[2]), dz = Math.max(r[1] - p.z, 0, p.z - r[3]); return Math.hypot(dx, dz); }
  // the room you're at: the one you're in, else the nearest within FOCUS_R (kept unless another is clearly nearer)
  function pickFocus() {
    MP.Player.head(head); var best = null, bd = Infinity;
    for (var i = 0; i < Rm.list.length; i++) { var d = rectDist(Rm.list[i].L.r, head); if (d < bd) { bd = d; best = Rm.list[i]; } }
    if (focus && Rm.list.indexOf(focus) >= 0) {
      var fd = rectDist(focus.L.r, head);
      if (fd <= FOCUS_R + 2 && fd <= bd + 2 && !(bd === 0 && fd > 0)) return focus; // stepping into another room always moves it
    }
    focus = bd <= FOCUS_R ? best : null; return focus;
  }
  function wanted() { var f = pickFocus(), set = new Set(); if (f) { set.add(f); f.near.forEach(function (n) { set.add(n); }); } return set; }
  // build a room's full facade, hidden until it's swapped in
  Rm.stats = { builds: 0, maxBuildMs: 0, swaps: 0 };
  function makeFull(rm) {
    var t0 = performance.now(), g = new THREE.Group(), b = new R.Batch(g), built = skin.module(b, spec(rm, g)); b.flush();
    Rm.stats.builds++; Rm.stats.maxBuildMs = Math.max(Rm.stats.maxBuildMs, Math.round((performance.now() - t0) * 10) / 10);
    g.visible = false; rm.dyn.add(g);
    rm.full = { group: g, batch: b, leaves: built.leaves, plaque: built.plaque, shown: false };
    setLeaves(rm);
  }
  function showFull(rm) {
    rm.full.group.visible = true; rm.full.shown = true;
    rm.targets = rm.full.leaves.map(function (pv) { return MP.Interact.add(pv, { use: function () { Rm.toggleDoor(rm.address); }, label: 'door ' + rm.address }); });
    rm.targets.push(MP.Interact.add(rm.full.plaque, { use: function () { if (MP.Naming) MP.Naming.start(rm); }, label: 'plaque ' + rm.address }));
  }
  function dropFull(rm) {
    if (!rm.full) return;
    rm.targets.forEach(MP.Interact.remove); rm.targets = [];
    rm.full.batch.clear(); rm.dyn.remove(rm.full.group);
    rm.full.group.traverse(function (o) { if (o.isMesh) o.geometry.dispose(); }); // the leaves, plaque and its plate (materials are shared)
    rm.full = null;
  }
  // every room not in full detail, as placeholders merged into one batch. Each room's pieces are made once (again
  // only if its door changes) and kept, so a swap only stitches arrays together.
  function liteParts(rm) {
    if (rm.lite && rm.lite.open === rm.open) return rm.lite;
    forgetLite(rm);
    var c = new R.Batch(null); skin.lite(c, spec(rm));
    return (rm.lite = { open: rm.open, lists: c.lists, notes: c.notes });
  }
  function forgetLite(rm) { if (rm.lite) { if (MP.Detail && MP.Detail.forget) MP.Detail.forget(rm.lite.notes); rm.lite = null; } }
  function rebuildLite() {
    if (Rm.liteBatch) Rm.liteBatch.clear();
    var b = new R.Batch(Rm.group); b.keep = true;
    Rm.list.forEach(function (rm) {
      if (rm.full && rm.full.shown) return;
      liteParts(rm).lists.forEach(function (list, mat) { if (!b.lists.has(mat)) b.lists.set(mat, []); Array.prototype.push.apply(b.lists.get(mat), list); });
    });
    b.flush(); Rm.liteBatch = b;
  }
  // One step toward the detail you should see: drop staged facades no longer wanted, build missing ones (nearest
  // first, within a few milliseconds), and once all are ready swap them in together with the placeholders rebuilt.
  // sync: do it all now. Returns true when settled.
  function lod(sync) {
    if (!skin) return true;
    var want = wanted(), t0 = performance.now();
    Rm.list.forEach(function (rm) { if (rm.full && !rm.full.shown && !want.has(rm)) dropFull(rm); });
    var missing = Rm.list.filter(function (rm) { return want.has(rm) && !rm.full; });
    missing.sort(function (a, b) { return rectDist(a.L.r, head) - rectDist(b.L.r, head); });
    for (var i = 0; i < missing.length; i++) { if (!sync && i > 0 && performance.now() - t0 > 6) return false; makeFull(missing[i]); }
    var swap = Rm.list.some(function (rm) { return (rm.full && !rm.full.shown) || (rm.full && !want.has(rm)); });
    if (!swap && Rm.liteBatch) return true;
    Rm.list.forEach(function (rm) { if (rm.full && !want.has(rm)) { dropFull(rm); dropInterior(rm); } else if (rm.full && !rm.full.shown) showFull(rm); });
    var t1 = performance.now(); rebuildLite(); R.refreshShadows(); Rm.stats.swaps++; Rm.stats.liteMs = Math.round((performance.now() - t1) * 10) / 10;
    return true;
  }
  Rm.settle = function () { return lod(true); };

  var wallMats = {};
  function wallMat(hex) {
    if (wallMats[hex]) return wallMats[hex];
    var src = MP.M.plaster, m = new THREE.MeshStandardMaterial({ map: src.map, normalMap: src.normalMap, roughnessMap: src.roughnessMap, roughness: src.roughness, envMapIntensity: src.envMapIntensity, color: new THREE.Color(hex) });
    m.userData.tile = src.userData.tile;
    if (MP.Detail && src.userData.set) MP.Detail.material(m, src.userData.set); // full-resolution plaster near you, like the keep's
    return (wallMats[hex] = m);
  }

  // ---------- Doors ----------
  function setLeaves(rm) {
    if (!rm.full) return;
    var e = rm.angle < 0.5 ? 2 * rm.angle * rm.angle : 1 - Math.pow(-2 * rm.angle + 2, 2) / 2; // ease in and out
    rm.full.leaves.forEach(function (pv) { pv.rotation.y = pv.userData.out * pv.userData.side * e * THREE.MathUtils.degToRad(100); });
  }
  Rm.toggleDoor = function (addr) {
    var rm = Rm.find(addr); if (!rm) return;
    rm.open = !rm.open; doorState[addr] = rm.open; MP.store.set('doors', doorState);
    if (rm.open) W.drop('room:' + addr + ':door');
    else skin.doorSolid(spec(rm), 'room:' + addr + ':door');
    if (MP.Sound && MP.Sound.door) MP.Sound.door(rm.door, rm.open);
    if (!rm.full || !rm.full.shown) { rm.angle = rm.open ? 1 : 0; rebuildLite(); } // a far door: the placeholder shows it open or shut
    else if (rm.open) ensureInterior(rm);
    return rm.open;
  };
  Rm.find = function (addr) { for (var i = 0; i < Rm.list.length; i++) if (Rm.list[i].address === addr) return Rm.list[i]; return null; };

  // ---------- Placeholder rooms (furnished only while you're near) ----------
  function scrollTexture(rm) {
    var c = document.createElement('canvas'); c.width = 384; c.height = 1024; var g = c.getContext('2d');
    g.fillStyle = '#5b3f22'; g.fillRect(0, 0, 384, 1024);                                  // mounting
    g.fillStyle = '#f1e6cc'; g.fillRect(28, 60, 328, 880);                                 // paper
    for (var i = 0; i < 2600; i++) { g.fillStyle = 'rgba(120, 95, 60, ' + (Math.random() * 0.06) + ')'; g.fillRect(28 + Math.random() * 328, 60 + Math.random() * 880, 2, 2); }
    g.fillStyle = '#1e1a16'; g.textAlign = 'center'; g.textBaseline = 'middle';
    var name = rm.name || rm.address, size = 64; g.font = size + 'px ' + BRUSH; while (g.measureText(name).width > 290 && size > 26) { size -= 3; g.font = size + 'px ' + BRUSH; }
    g.fillText(name, 192, 250);
    g.font = '30px ' + BRUSH; ['This room is', 'waiting for', 'its contents'].forEach(function (l, i) { g.fillText(l, 192, 520 + i * 54); });
    g.fillStyle = '#9b2a1f'; g.fillRect(232, 820, 64, 64); g.fillStyle = '#f1e6cc'; g.font = '34px ' + BRUSH; g.fillText('記', 264, 853); // a red seal
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function ensureInterior(rm) {
    if (rm.interior) return;
    var M = MP.M, g = new THREE.Group(), b = new R.Batch(g), I = rm.inner, d = rm.door, out = d.out, e = 0.035, h = 4.28; // linings sit just inside the wall boarding
    // lamp-lit linings just inside the walls (the street wall keeps its doorway)
    G.panel(b, M.inWall, (I[0] + I[2]) / 2, h / 2, I[1] + e, I[2] - I[0], h, 'z+'); G.panel(b, M.inWall, (I[0] + I[2]) / 2, h / 2, I[3] - e, I[2] - I[0], h, 'z-');
    var bx = out > 0 ? I[0] + e : I[2] - e; G.panel(b, M.inWall, bx, h / 2, (I[1] + I[3]) / 2, I[3] - I[1], h, out > 0 ? 'x+' : 'x-');
    var sx = out > 0 ? I[2] - e : I[0] + e, sd = out > 0 ? 'x-' : 'x+', dl = d.z - d.w / 2, dr = d.z + d.w / 2;
    G.panel(b, M.inWall, sx, h / 2, (I[1] + dl) / 2, dl - I[1], h, sd); G.panel(b, M.inWall, sx, h / 2, (dr + I[3]) / 2, I[3] - dr, h, sd);
    G.panel(b, M.inWall, sx, (d.h + h) / 2, d.z, d.w, h - d.h, sd);
    G.floor(b, M.inFloor, I[0], I[1], I[2], I[3], 0.075);
    // a low table, a floor lantern glowing in the corner, and a hanging scroll on the far wall
    var cx = (I[0] + I[2]) / 2 - out * 0.4, cz = d.z;
    G.box(b, M.timber, cx - 0.6, 0.075, cz - 0.9, cx + 0.6, 0.4, cz + 0.9);
    var lx = out > 0 ? I[0] + 0.6 : I[2] - 0.6, lz = I[1] + 0.6;
    G.box(b, M.timber, lx - 0.25, 0.075, lz - 0.25, lx + 0.25, 0.15, lz + 0.25);
    ['x+', 'x-', 'z+', 'z-'].forEach(function (dd) { var o = dd[1] === '+' ? 0.2 : -0.2; if (dd[0] === 'x') G.panel(b, M.shoji, lx + o, 0.55, lz, 0.4, 0.75, dd); else G.panel(b, M.shoji, lx, 0.55, lz + o, 0.4, 0.75, dd); });
    b.flush();
    var scroll = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 2.0), new THREE.MeshStandardMaterial({ map: scrollTexture(rm), roughness: 0.9, emissive: new THREE.Color(0.35, 0.3, 0.24), emissiveMap: null }));
    scroll.position.set(bx + out * 0.03, 2.1, cz); scroll.rotation.y = out > 0 ? Math.PI / 2 : -Math.PI / 2; g.add(scroll);
    rm.interior = { group: g, batch: b, scroll: scroll };
    rm.dyn.add(g);
  }
  function dropInterior(rm) {
    if (!rm.interior) return;
    rm.dyn.remove(rm.interior.group); rm.interior.batch.clear(); rm.interior.scroll.geometry.dispose(); rm.interior.scroll.material.map.dispose(); rm.interior.scroll.material.dispose();
    rm.interior = null;
  }
  var acc = 0, busy = false, head = new THREE.Vector3();
  R.onFrame(function (dt) {
    // doors swing
    Rm.list.forEach(function (rm) {
      var target = rm.open ? 1 : 0; if (rm.angle === target) return;
      rm.angle = target > rm.angle ? Math.min(1, rm.angle + dt / 0.9) : Math.max(0, rm.angle - dt / 0.9); setLeaves(rm);
    });
    // detail follows you (every frame while there's building to do, else twice a second)
    acc += dt; if ((!busy && acc < 0.5) || !MP.ready) return; acc = 0;
    busy = !lod(false); MP.Player.head(head);
    // furnish the room you're at as you approach it (and any open door you're near); clear the ones you've left behind
    Rm.list.forEach(function (rm) {
      var dist = Math.hypot(head.x - rm.door.x, head.z - rm.door.z), shown = rm.full && rm.full.shown;
      if (shown && dist < NEAR && (rm === focus || rm.open || inside(rm, head))) ensureInterior(rm);
      else if (!shown || dist > FAR) dropInterior(rm);
    });
  });
  function inside(rm, p) { var I = rm.inner; return p.x > I[0] && p.x < I[2] && p.z > I[1] && p.z < I[3]; }
  // the room you're in, else the nearest door within 12 m
  Rm.current = function () {
    MP.Player.head(head); var best = null, bd = 12;
    for (var i = 0; i < Rm.list.length; i++) { var rm = Rm.list[i]; if (inside(rm, head)) return rm; var d = Math.hypot(head.x - rm.door.x, head.z - rm.door.z); if (d < bd) { bd = d; best = rm; } }
    return best;
  };

  // ---------- Naming and the active tier (saved to your plan, on this headset) ----------
  Rm.setName = function (addr, name) {
    var rm = Rm.find(addr); if (!rm) return false;
    name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 48);
    rm.name = name; rm.rec.name = name; plaqueTexture(rm);
    if (rm.interior) { var sc = rm.interior.scroll; sc.material.map.dispose(); sc.material.map = scrollTexture(rm); sc.material.needsUpdate = true; }
    MP.Plan.save(); return true;
  };
  Rm.setActive = function (addr, on) {
    var rm = Rm.find(addr); if (!rm) return false;
    rm.rec.active = !!on; if (on) rm.rec.wasActive = true;
    MP.Plan.save(); Rm.build(); return true;
  };
  Rm.label = function (rm) { return rm ? (rm.name || rm.address) : ''; };
  Rm.focus = function () { return focus; };
  Rm.load = function () { return MP.store.get('doors').then(function (d) { doorState = d || {}; }); };
  Rm.report = function () {
    return Rm.list.map(function (rm) { return { address: rm.address, name: rm.name, band: rm.L.band, wall: '#' + rm.wall.color.getHexString(), windows: rm.shape, open: rm.open, angle: Math.round(rm.angle * 100) / 100, tier: rm.active ? 'active' : rm.wasActive ? 'shuttered' : 'none', furnished: !!rm.interior, detail: rm.full ? (rm.full.shown ? 'full' : 'staged') : 'lite', door: [rm.door.x, rm.door.z], out: rm.door.out, inner: rm.inner }; });
  };
})();
