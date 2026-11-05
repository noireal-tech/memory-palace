/* Memory Palace: closets. A closet door is a small, plain household door with a knob and a black nameplate, set into
   any wall of a room, of the Central Hall, or of another closet. It opens onto a closet room for an idea next to the
   room's own: bigger on the inside than the wall it's in, because it isn't really behind the wall at all.
   How: every closet is built away from the palace (the "pocket", x ≈ 3000 m). Its doorway is drawn as a stencil: the
   door's opening is masked, and the closet is drawn into that shape from where your eyes would be if the closet really
   were behind the wall. Step through and you are moved to the closet, exactly where the view said you'd be, so there's
   no jump and no fade. From inside, the same trick shows the room you came from through the doorway.
   - The Door tool (hand panel ▸ Make) places a closet door: point at a wall, see a ghost of the door and what's
     behind the wall, pull the trigger. In the hall, doors sit between the timber posts, clear of the gate and the stair.
   - Point at a door and pull the trigger to open or close it. Point at its black nameplate to name the closet.
   - A guide line on the floor runs from each doorway into its closet and on to the closet's own doors; inside, a
     paper bulb shows how many doors you are from the main room.
   - Closets are kept on this headset, with their names and whether their doors are open. Nesting has no limit. */
(function () {
  'use strict';
  var MP = window.MP, R = MP.R, W = MP.World, G = MP.Geo;
  var C = MP.Closets = { list: [] }, list = C.list, byId = {}, nextId = 1, nextRef = 1, waiting = []; // waiting: closets whose wall isn't there yet (a room not in the plan)
  var DOOR = { w: 0.9, h: 2.05 }, ROOM = { hw: 2, d: 4, h: 2.8, slab: 0.3 }, POCKET = { x: 3000, z: 0, gap: 22 };
  var CROSS_IN = 0.08, CROSS_OUT = -0.1; // hysteresis: through a door at 8 cm in front of its wall; back out at 10 cm past the closet's face
  var pocket = new THREE.Group(); pocket.name = 'closets'; pocket.visible = false; R.scene.add(pocket);
  var worldDoors = new THREE.Group(); worldDoors.name = 'closet doors'; R.scene.add(worldDoors);
  var m4 = new THREE.Matrix4(), v3 = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();

  // ---------- Materials ----------
  // Closets are lit like the hall's inside (lamp-lit, never by the sun): their materials drop direct light, since the
  // pocket lies outside the sun's shadow map.
  function noSun(m) {
    m.onBeforeCompile = function (s) { s.fragmentShader = s.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n  reflectedLight.directDiffuse = vec3(0.0); reflectedLight.directSpecular = vec3(0.0);'); };
    m.customProgramCacheKey = function () { return 'noSun'; }; return m;
  }
  var mats = null;
  function own(m, sun) { var c = m.clone(); c.userData = { tile: m.userData.tile }; if (m.userData.set) { MP.Detail.material(c, m.userData.set); delete c.userData.set; } return sun ? c : noSun(c); }
  function makeMats() {
    var M = MP.M; mats = {};
    [true, false].forEach(function (sun) { // sun: in the palace (the hall, a room); no sun: in a closet
      var k = sun ? 'w' : 'c';
      mats[k] = {
        wood: own(M.inTimber, sun), wall: own(M.inWall, sun), ceil: own(M.inCeil, sun),
        leaf: (sun ? function (m) { return m; } : noSun)(new THREE.MeshStandardMaterial({ color: new THREE.Color('#e7dcc6'), roughness: 0.6, emissive: new THREE.Color('#3a3226'), envMapIntensity: 0.4 })),
        panel: (sun ? function (m) { return m; } : noSun)(new THREE.MeshStandardMaterial({ color: new THREE.Color('#d6c9b0'), roughness: 0.65, emissive: new THREE.Color('#2e281e'), envMapIntensity: 0.4 })),
        knob: (sun ? function (m) { return m; } : noSun)(new THREE.MeshStandardMaterial({ color: new THREE.Color('#c79a4b'), metalness: 0.9, roughness: 0.3 })),
        line: new THREE.MeshBasicMaterial({ color: new THREE.Color('#c9a24a'), transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })
      };
    });
  }
  // the doorway's stencil: a mask that marks the opening, then a pass that clears depth there so the far side draws
  function maskMats(ref) {
    var mark = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide, stencilWrite: true, stencilRef: ref, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp });
    var clear = new THREE.ShaderMaterial({ vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: 'void main() { gl_FragDepth = 1.0; gl_FragColor = vec4(0.0); }',
      colorWrite: false, depthWrite: true, depthFunc: THREE.AlwaysDepth, side: THREE.DoubleSide, stencilWrite: true, stencilRef: ref, stencilFunc: THREE.EqualStencilFunc, stencilZPass: THREE.KeepStencilOp, stencilWriteMask: 0 });
    return [mark, clear];
  }
  function masks(group, geo, ref) {
    var mm = maskMats(ref), a = new THREE.Mesh(geo, mm[0]), b = new THREE.Mesh(geo, mm[1]);
    a.renderOrder = 990; b.renderOrder = 991; a.frustumCulled = b.frustumCulled = false; group.add(a, b); return [a, b];
  }

  // ---------- Spaces ----------
  function isCloset(space) { return space && space !== 'world'; }
  function closetOf(space) { return isCloset(space) ? byId[+space.slice(1)] : null; }
  C.closetOf = closetOf;
  function origin(id) { return new THREE.Vector3(POCKET.x + POCKET.gap * (id % 40), 0, POCKET.z + POCKET.gap * Math.floor(id / 40)); }
  // the space a point is in: the palace, or the closet whose room (or doorway) holds it
  function spaceAt(p) {
    if (p.x < POCKET.x - 50) return 'world';
    for (var i = 0; i < list.length; i++) { var o = list[i].o; if (p.x > o.x - ROOM.hw - 0.4 && p.x < o.x + ROOM.hw + 0.4 && p.z > o.z - 1.2 && p.z < o.z + ROOM.d + ROOM.slab + 0.4) return list[i].space; }
    return W.space;
  }
  C.space = function () { return W.space; };
  C.root = function (space) { var c = closetOf(space); return c ? c.root : null; };
  // the floor area of a space, for setting things down: the hall's, or a closet's room
  C.bounds = function (space) {
    var c = closetOf(space || W.space); if (!c) return MP.KEEP ? MP.KEEP.IN : null;
    return [c.o.x - ROOM.hw, c.o.z + ROOM.slab, c.o.x + ROOM.hw, c.o.z + ROOM.slab + ROOM.d];
  };
  // where in the palace you "are", for streaming: your head, or the door in the palace your closets branch from
  C.anchor = function (out) {
    var c = closetOf(W.space); if (!c) return MP.Player.head(out);
    while (isCloset(c.parent)) c = closetOf(c.parent);
    return out.setFromMatrixPosition(c.P);
  };

  // ---------- Walls a closet door can go in ----------
  // { id, space, a: [x, z], b: [x, z], n: [x, z] (into the room), y (floor), slots (offsets along a→b) or null, avoid: [[t0, t1]], behind }
  function hallWalls() {
    var K = MP.KEEP; if (!K) return [];
    var I = K.IN, e = 0.065, F = K.FLOOR, ns = function (xs) { return xs.map(function (x) { return x - I[0]; }); }, ew = function (zs) { return zs.map(function (z) { return z - I[1]; }); };
    var zb = [-9.67, -7.5, -5, -2.5, 0, 2.5, 5, 7.5, 9.67];
    return [
      { id: 'hall:S', space: 'world', a: [I[0], I[1] + e], b: [I[2], I[1] + e], n: [0, 1], y: F, slots: ns([-8.55, -6.25, -3.75, 3.75, 6.25, 8.55]), behind: 'the forecourt, outside the keep' },
      { id: 'hall:N', space: 'world', a: [I[0], I[3] - e], b: [I[2], I[3] - e], n: [0, -1], y: F, slots: ns([-8.55, -6.25, 6.25, 8.55]), behind: 'the back of the keep' },
      { id: 'hall:W', space: 'world', a: [I[0] + e, I[1]], b: [I[0] + e, I[3]], n: [1, 0], y: F, slots: ew(zb), behind: 'the west side of the keep' },
      { id: 'hall:E', space: 'world', a: [I[2] - e, I[1]], b: [I[2] - e, I[3]], n: [-1, 0], y: F, slots: ew(zb), behind: 'the east side of the keep' }];
  }
  function roomWalls() {
    if (!MP.Rooms) return [];
    var out = [];
    MP.Rooms.list.forEach(function (rm) {
      var I = rm.inner, o = rm.door.out, e = 0.06, y = 0.075, bx = o > 0 ? I[0] + e : I[2] - e, cz = rm.door.z, lx = o > 0 ? I[0] + 0.6 : I[2] - 0.6;
      out.push({ id: 'r:' + rm.address + ':back', space: 'world', a: [bx, I[1]], b: [bx, I[3]], n: [o, 0], y: y, avoid: [[cz - I[1] - 0.55, cz - I[1] + 0.55]], behind: 'open ground behind ' + MP.Rooms.label(rm) });
      out.push({ id: 'r:' + rm.address + ':z0', space: 'world', a: [I[0], I[1] + e], b: [I[2], I[1] + e], n: [0, 1], y: y, avoid: [[lx - I[0] - 0.6, lx - I[0] + 0.6]], behind: 'the gap beside ' + MP.Rooms.label(rm) });
      out.push({ id: 'r:' + rm.address + ':z1', space: 'world', a: [I[0], I[3] - e], b: [I[2], I[3] - e], n: [0, -1], y: y, behind: 'the gap beside ' + MP.Rooms.label(rm) });
    });
    return out;
  }
  function closetWalls(c) {
    var o = c.o, x0 = o.x - ROOM.hw, x1 = o.x + ROOM.hw, z0 = o.z + ROOM.slab, z1 = z0 + ROOM.d, e = 0.03, mid = ROOM.hw;
    return [
      { id: c.space + ':L', space: c.space, a: [x0 + e, z0], b: [x0 + e, z1], n: [1, 0], y: 0, behind: 'nothing yet' },
      { id: c.space + ':R', space: c.space, a: [x1 - e, z0], b: [x1 - e, z1], n: [-1, 0], y: 0, behind: 'nothing yet' },
      { id: c.space + ':B', space: c.space, a: [x0, z1 - e], b: [x1, z1 - e], n: [0, -1], y: 0, behind: 'nothing yet' },
      { id: c.space + ':F', space: c.space, a: [x0, z0 + e], b: [x1, z0 + e], n: [0, 1], y: 0, avoid: [[mid - 0.7, mid + 0.7]], behind: 'nothing yet' }];
  }
  function wallsIn(space) { if (space === 'world') return hallWalls().concat(roomWalls()); var c = closetOf(space); return c ? closetWalls(c) : []; }
  function findWall(id) { var sp = id.indexOf('c') === 0 ? id.split(':')[0] : 'world'; return wallsIn(sp).filter(function (w) { return w.id === id; })[0] || null; }
  function wallLen(w) { return Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]); }
  // a door frame on a wall at offset t: x along the wall, y up, z out into the room
  function frameAt(w, t, out) {
    var L = wallLen(w), ux = (w.b[0] - w.a[0]) / L, uz = (w.b[1] - w.a[1]) / L, nx = w.n[0], nz = w.n[1];
    out = out || new THREE.Matrix4();
    return out.set(nz, 0, nx, w.a[0] + ux * t, 0, 1, 0, w.y, -nx, 0, nz, w.a[1] + uz * t, 0, 0, 0, 1);
  }
  // can a door go at offset t on this wall? → null if so, else why not
  function blockedAt(w, t, ignore) {
    var half = DOOR.w / 2 + 0.12, L = wallLen(w);
    if (t < half + 0.3 || t > L - half - 0.3) return 'too close to the corner';
    if ((w.avoid || []).some(function (r) { return t + half > r[0] && t - half < r[1]; })) return w.id.indexOf('hall') === 0 ? 'the gate or the stair is here' : 'something is in the way';
    if (list.some(function (c) { return c !== ignore && c.wall === w.id && Math.abs(c.t - t) < DOOR.w + 0.3; })) return 'another door is here';
    return null;
  }
  // where a ray meets a wall of the space you're in → { w, t (snapped), ok, why, point }
  function aimAt(ray) {
    var best = null;
    wallsIn(W.space).forEach(function (w) {
      var nx = w.n[0], nz = w.n[1], denom = ray.direction.x * nx + ray.direction.z * nz; if (denom >= -1e-4) return; // must face the wall
      var d = ((ray.origin.x - w.a[0]) * nx + (ray.origin.z - w.a[1]) * nz) / -denom; if (d < 0 || d > 9) return;
      var px = ray.origin.x + ray.direction.x * d, py = ray.origin.y + ray.direction.y * d, pz = ray.origin.z + ray.direction.z * d;
      if (py < w.y || py > w.y + 3.2) return;
      var L = wallLen(w), t = ((px - w.a[0]) * (w.b[0] - w.a[0]) + (pz - w.a[1]) * (w.b[1] - w.a[1])) / L; if (t < 0 || t > L) return;
      if (best && best.d < d) return;
      if (w.slots) { var s = w.slots.reduce(function (m, x) { return Math.abs(x - t) < Math.abs(m - t) ? x : m; }, w.slots[0]); t = s; }
      best = { w: w, t: t, d: d, point: [px, py, pz] };
    });
    if (best) { best.why = blockedAt(best.w, best.t); best.ok = !best.why; }
    return best;
  }

  // ---------- Text plates ----------
  var BRUSH = '"Kaushan Script", cursive';
  function plateTex(c) { // a black nameplate, lettered in gold
    var cv = document.createElement('canvas'); cv.width = 512; cv.height = 136; var g = cv.getContext('2d');
    g.fillStyle = '#14110e'; g.fillRect(0, 0, 512, 136); g.strokeStyle = '#8c6d2c'; g.lineWidth = 6; g.strokeRect(5, 5, 502, 126);
    var name = c.name || 'Closet', size = 64; g.font = size + 'px ' + BRUSH; while (g.measureText(name).width > 460 && size > 24) { size -= 3; g.font = size + 'px ' + BRUSH; }
    g.fillStyle = '#d9b45a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, 256, 70);
    var t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  function bulbTex(n) { // a paper globe, glowing, with the closet's depth on it
    var cv = document.createElement('canvas'); cv.width = cv.height = 256; var g = cv.getContext('2d'), grd = g.createRadialGradient(128, 128, 10, 128, 128, 126);
    grd.addColorStop(0, 'rgba(255,244,214,1)'); grd.addColorStop(0.62, 'rgba(255,214,150,0.95)'); grd.addColorStop(0.75, 'rgba(255,190,110,0.35)'); grd.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a2412'; g.font = '110px ' + BRUSH; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 128, 136);
    var t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function plate(group, mat) { var m = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.106), mat); group.add(m); return m; }

  // ---------- Building a door (in the room it opens from) ----------
  function inParent(c, fn) { return W.within(c.parent, fn); }
  function parentRoot(c) { return isCloset(c.parent) ? closetOf(c.parent).root : worldDoors; }
  function buildDoor(c) {
    var M = mats[isCloset(c.parent) ? 'c' : 'w'], g = new THREE.Group(), b = new MP.R.Batch(g), w = DOOR.w, h = DOOR.h;
    g.matrixAutoUpdate = false; g.matrix.copy(c.P); parentRoot(c).add(g); c.doorGroup = g;
    // casing round the opening, standing just proud of the wall
    G.box(b, M.wood, -w / 2 - 0.09, 0, 0, -w / 2, h + 0.04, 0.06); G.box(b, M.wood, w / 2, 0, 0, w / 2 + 0.09, h + 0.04, 0.06);
    G.box(b, M.wood, -w / 2 - 0.12, h, 0, w / 2 + 0.12, h + 0.11, 0.07);
    b.flush(); b.meshes.forEach(function (m) { m.castShadow = false; });
    // the leaf: hinged at its left, swinging out into the room
    c.pivot = new THREE.Group(); c.pivot.position.set(-w / 2 + 0.01, 0.005, 0.03); g.add(c.pivot);
    var leaf = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, h - 0.01, 0.035), M.leaf); leaf.position.set((w - 0.02) / 2, (h - 0.01) / 2, 0); c.pivot.add(leaf);
    [0.55, 1.45].forEach(function (y) { [-1, 1].forEach(function (f) { var p = new THREE.Mesh(new THREE.BoxGeometry(w - 0.24, 0.62, 0.01), M.panel); p.position.set((w - 0.02) / 2, y, f * 0.022); c.pivot.add(p); }); });
    [-1, 1].forEach(function (f) { var k = new THREE.Mesh(new THREE.SphereGeometry(0.028, 14, 10), M.knob); k.position.set(w - 0.1, 1.0, f * 0.05); c.pivot.add(k); });
    c.leaf = leaf; setLeaf(c);
    // the nameplate above
    c.plateMat = new THREE.MeshBasicMaterial({ map: plateTex(c) }); c.plate = plate(g, c.plateMat); c.plate.position.set(0, h + 0.2, 0.073);
    // the stencil for the opening, a hair in front of the wall
    var ap = new THREE.PlaneGeometry(w, h); ap.translate(0, h / 2, 0.004); c.outMask = masks(g, ap, c.ref);
    // a short guide line out into the room
    var line = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 1.4), M.line); line.rotation.x = -Math.PI / 2; line.position.set(0, 0.006, 0.8); g.add(line);
    g.updateMatrixWorld(true);
    c.targets = [MP.Interact.add(leaf, { label: 'closet door', use: function () { C.toggle(c.id); } }), MP.Interact.add(c.plate, { label: 'closet nameplate', use: function () { MP.Naming.start(nameable(c)); } })];
    // blocking while shut; a way through while open
    doorSolids(c);
  }
  function aabb(P, x0, z0, x1, z1) { // a rectangle in a door's frame, as a box in the world (frames turn by quarter turns)
    var a = new THREE.Vector3(x0, 0, z0).applyMatrix4(P), b = new THREE.Vector3(x1, 0, z1).applyMatrix4(P);
    return [Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)];
  }
  function doorSolids(c) {
    var tag = 'closet:' + c.id + ':door'; W.drop(tag);
    inParent(c, function () {
      if (c.open) { var r = aabb(c.P, -DOOR.w / 2 + 0.05, -0.6, DOOR.w / 2 - 0.05, 0.7); W.passage(r[0], r[1], r[2], r[3], tag); }
      else { var s = aabb(c.P, -DOOR.w / 2, 0, DOOR.w / 2, 0.08); W.solid(s[0], s[1], s[2], s[3], 30, tag); }
    });
    // from the closet's side too: a shut door is a wall
    if (!c.open && c.o) W.within(c.space, function () { W.solid(c.o.x - DOOR.w / 2, c.o.z - 0.1, c.o.x + DOOR.w / 2, c.o.z + 0.05, 30, tag); });
  }
  function setLeaf(c) { var e = c.angle < 0.5 ? 2 * c.angle * c.angle : 1 - Math.pow(-2 * c.angle + 2, 2) / 2; c.pivot.rotation.y = -e * THREE.MathUtils.degToRad(100); }

  // ---------- Building a closet room (in the pocket) ----------
  function buildRoom(c) {
    var M = mats.c, o = c.o, root = new THREE.Group(); root.name = c.space; root.visible = false; pocket.add(root); c.root = root;
    var b = new MP.R.Batch(root), hw = ROOM.hw, d = ROOM.d, s = ROOM.slab, H = ROOM.h, w = DOOR.w, h = DOOR.h, X = o.x, Z = o.z;
    W.within(c.space, function () {
      // floor, walls (the front one, with the doorway through it), ceiling, wainscot
      G.box(b, M.wood, X - hw - 0.2, -0.1, Z, X + hw + 0.2, 0, Z + s + d + 0.2);
      G.box(b, M.wall, X - hw, 0, Z, X - w / 2, H, Z + s, true, c.space); G.box(b, M.wall, X + w / 2, 0, Z, X + hw, H, Z + s, true, c.space); G.box(b, M.wall, X - w / 2, h, Z, X + w / 2, H, Z + s);
      G.box(b, M.wall, X - hw - 0.2, 0, Z, X - hw, H, Z + s + d + 0.2, true, c.space); G.box(b, M.wall, X + hw, 0, Z, X + hw + 0.2, H, Z + s + d + 0.2, true, c.space);
      G.box(b, M.wall, X - hw, 0, Z + s + d, X + hw, H, Z + s + d + 0.2, true, c.space);
      G.box(b, M.ceil, X - hw - 0.2, H, Z, X + hw + 0.2, H + 0.1, Z + s + d + 0.2);
      W.solid(X - hw - 0.2, Z, X + hw + 0.2, Z + s + d + 0.2, 30, c.space, H);
      [[X - hw, Z + s, X - hw + 0.02, Z + s + d], [X + hw - 0.02, Z + s, X + hw, Z + s + d], [X - hw, Z + s + d - 0.02, X + hw, Z + s + d], [X - hw, Z + s, X - w / 2 - 0.1, Z + s + 0.02], [X + w / 2 + 0.1, Z + s, X + hw, Z + s + 0.02]].forEach(function (r) { G.box(b, M.ceil, r[0], 0, r[1], r[2], 0.9, r[3]); G.box(b, M.wood, r[0] - (r[2] - r[0] < 0.1 ? 0 : 0), 0.88, r[1], r[2], 0.92, r[3]); }); // lighter boards, a dark rail
      // the doorway's reveal and casing on this side
      G.box(b, M.wood, X - w / 2 - 0.09, 0, Z + s, X - w / 2, h + 0.04, Z + s + 0.06); G.box(b, M.wood, X + w / 2, 0, Z + s, X + w / 2 + 0.09, h + 0.04, Z + s + 0.06);
      G.box(b, M.wood, X - w / 2 - 0.12, h, Z + s, X + w / 2 + 0.12, h + 0.11, Z + s + 0.07);
      G.box(b, M.wood, X - w / 2, 0, Z, X - w / 2 + 0.02, h, Z + s); G.box(b, M.wood, X + w / 2 - 0.02, 0, Z, X + w / 2, h, Z + s); G.box(b, M.wood, X - w / 2, h - 0.02, Z, X + w / 2, h, Z + s);
      // where you can stand: the room, and the doorway out to its far side
      W.surface(X - hw, Z + s, X + hw, Z + s + d, 0, c.space); W.surface(X - w / 2, Z - 0.8, X + w / 2, Z + s, 0, c.space);
      W.solid(X - w / 2 - 0.25, Z - 0.8, X - w / 2, Z, 30, c.space); W.solid(X + w / 2, Z - 0.8, X + w / 2 + 0.25, Z, 30, c.space); W.solid(X - w / 2 - 0.25, Z - 1.0, X + w / 2 + 0.25, Z - 0.8, 30, c.space);
    });
    b.flush(); b.meshes.forEach(function (m) { m.castShadow = false; m.receiveShadow = false; });
    // looking back out: the stencil is a box beyond the doorway's outer face
    var box = new THREE.BoxGeometry(w, h, 0.6); box.translate(X, h / 2, Z - 0.3); c.inMask = masks(root, box, c.backRef);
    // pointing at the doorway from inside opens or closes the door
    var pick = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ visible: false })); pick.position.set(X, h / 2, Z + 0.02); root.add(pick);
    c.targets.push(MP.Interact.add(pick, { label: 'closet door', use: function () { C.toggle(c.id); } }));
    // the nameplate over the doorway inside, and the bulb with the number of doors back to the main room
    c.plate2 = plate(root, c.plateMat); c.plate2.position.set(X, h + 0.2, Z + s + 0.073);
    c.targets.push(MP.Interact.add(c.plate2, { label: 'closet nameplate', use: function () { MP.Naming.start(nameable(c)); } }));
    var cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.35, 6), M.wood); cord.position.set(X, H - 0.175, Z + s + d / 2); root.add(cord);
    c.bulb = new THREE.Sprite(noSunSprite(new THREE.SpriteMaterial({ map: bulbTex(c.depth), transparent: true, depthWrite: false }))); c.bulb.scale.setScalar(0.42); c.bulb.position.set(X, H - 0.55, Z + s + d / 2); root.add(c.bulb);
    c.lines = new THREE.Group(); root.add(c.lines); guideLines(c);
    root.updateMatrixWorld(true);
  }
  function noSunSprite(m) { return m; } // sprites aren't lit anyway
  // the guide line in a closet: from its doorway into the middle, then on to each of its own doors
  function guideLines(c) {
    while (c.lines.children.length) c.lines.remove(c.lines.children[0]);
    var M = mats.c, o = c.o, y = 0.006, mid = new THREE.Vector3(o.x, y, o.z + ROOM.slab + ROOM.d / 2);
    function seg(a, b2) {
      var L = Math.hypot(b2.x - a.x, b2.z - a.z); if (L < 0.01) return;
      var m = new THREE.Mesh(new THREE.PlaneGeometry(0.05, L), M.line); m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(b2.x - a.x, b2.z - a.z);
      m.position.set((a.x + b2.x) / 2, y, (a.z + b2.z) / 2); c.lines.add(m);
    }
    seg(new THREE.Vector3(o.x, y, o.z + ROOM.slab + 0.1), mid);
    list.forEach(function (k) {
      if (k.parent !== c.space) return;
      var at = new THREE.Vector3(0, 0, 0.7).applyMatrix4(k.P); at.y = y;
      var corner = new THREE.Vector3(at.x, y, mid.z); if (Math.abs(at.z - mid.z) < 0.05 || Math.abs(at.x - mid.x) < 0.05) seg(mid, at); else { seg(mid, corner); seg(corner, at); }
    });
  }

  // ---------- A closet ----------
  function nameable(c) {
    return { address: 'closet:' + c.id, name: c.name, where: 'Closet ' + c.depth + ' door' + (c.depth > 1 ? 's' : '') + ' from the main room',
      label: function () { return c.name || 'Closet'; }, setName: function (n) { C.setName(c.id, n); } };
  }
  function make(rec) {
    var w = findWall(rec.wall); if (!w) return null;
    var c = { id: rec.id, parent: w.space, wall: w.id, t: rec.t, name: rec.name || '', open: !!rec.open, angle: rec.open ? 1 : 0, space: 'c' + rec.id, o: origin(rec.id), targets: [] };
    var pc = closetOf(c.parent); c.depth = pc ? pc.depth + 1 : 1;
    c.ref = nextRef++; c.backRef = nextRef++; if (nextRef > 250) nextRef = 1;
    c.P = frameAt(w, c.t); c.Pinv = c.P.clone().invert();
    c.C = new THREE.Matrix4().makeTranslation(c.o.x, 0, c.o.z); c.Cinv = c.C.clone().invert();
    // T takes a point in front of the door, in the room, to the matching point in the closet: through the doorway
    c.T = new THREE.Matrix4().multiplyMatrices(c.C, new THREE.Matrix4().makeRotationY(Math.PI)).multiply(c.Pinv); c.Tinv = c.T.clone().invert();
    byId[c.id] = c; list.push(c); nextId = Math.max(nextId, c.id + 1);
    buildDoor(c); buildRoom(c);
    var p = closetOf(c.parent); if (p) guideLines(p);
    return c;
  }
  var saveTimer = 0;
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(function () { MP.store.set('closets', { v: 1, list: list.map(function (c) { return { id: c.id, wall: c.wall, t: Math.round(c.t * 1000) / 1000, name: c.name, open: c.open }; }).concat(waiting) }); }, 300); }

  C.add = function (wallId, t) { var w = findWall(wallId); if (!w) return null; if (w.slots) t = w.slots.reduce(function (m, x) { return Math.abs(x - t) < Math.abs(m - t) ? x : m; }, w.slots[0]); if (blockedAt(w, t)) return null; var c = make({ id: nextId, wall: wallId, t: t, open: false }); save(); return c && c.id; };
  C.toggle = function (id) { var c = byId[id]; if (!c) return null; c.open = !c.open; doorSolids(c); save(); if (MP.Sound && MP.Sound.door) MP.Sound.door({ x: c.P.elements[12], z: c.P.elements[14] }, c.open); return c.open; };
  C.setName = function (id, name) { var c = byId[id]; if (!c) return false; c.name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 48); var old = c.plateMat.map; c.plateMat.map = plateTex(c); c.plateMat.needsUpdate = true; old.dispose(); save(); return true; };
  C.current = function () { return closetOf(W.space); };
  C.nameable = function (c) { return nameable(c || closetOf(W.space)); };
  C.walls = function (space) { return wallsIn(space || W.space).map(function (w) { return { id: w.id, slots: w.slots, len: +wallLen(w).toFixed(2), behind: w.behind }; }); };

  // ---------- Walking through ----------
  var head = new THREE.Vector3(), prev = {}, rigM = new THREE.Matrix4();
  function local(M, p) { return v3.copy(p).applyMatrix4(M); }
  function pass(T) { // move you through a doorway: everything about where you stand and face, carried by T
    var rig = R.rig; rig.updateMatrix(); rigM.multiplyMatrices(T, rig.matrix); rigM.decompose(rig.position, rig.quaternion, sc); rig.scale.set(1, 1, 1);
    var e = new THREE.Euler().setFromQuaternion(rig.quaternion, 'YXZ'); rig.rotation.set(0, e.y, 0); MP.Player.flatYaw = e.y;
    rig.updateMatrixWorld(true); prev = {};
    W.space = spaceAt(MP.Player.head(head));
    if (MP.Portal) MP.Portal.reset(); if (MP.Teleport) MP.Teleport.cancel();
  }
  R.onFrame(function (dt) {
    if (!MP.ready || !mats) return;
    list.forEach(function (c) { var t = c.open ? 1 : 0; if (c.angle !== t) { c.angle = t > c.angle ? Math.min(1, c.angle + dt / 0.6) : Math.max(0, c.angle - dt / 0.6); setLeaf(c); } });
    C.check();
  });
  // have you just stepped through a doorway? (every frame; tests call it after each step)
  C.check = function () {
    if (!mats) return null;
    MP.Player.head(head);
    var sp = spaceAt(head); if (sp !== W.space) { W.space = sp; prev = {}; }
    // through a door from its room into the closet
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.parent === W.space && c.open) {
        var lp = local(c.Pinv, head), was = prev['o' + c.id]; prev['o' + c.id] = lp.z;
        if (was !== undefined && was >= CROSS_IN && lp.z < CROSS_IN && Math.abs(lp.x) < DOOR.w / 2 - 0.04 && lp.y > 0 && lp.y < DOOR.h + 0.3) { pass(c.T); return 'in'; }
      }
      if (c.space === W.space && c.open) {
        var lc = local(c.Cinv, head), was2 = prev['i' + c.id]; prev['i' + c.id] = lc.z;
        if (was2 !== undefined && was2 >= CROSS_OUT && lc.z < CROSS_OUT && Math.abs(lc.x) < DOOR.w / 2) { pass(c.Tinv); return 'out'; }
      }
    }
    return null;
  };

  // ---------- Drawing: this space, then what's seen through its doorways ----------
  var saved = [], frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), box3 = new THREE.Box3();
  function isWorldRoot(o) { return o !== R.rig && o !== pocket && !o.isLight && !(o.userData && o.userData.ui) && o !== R.sun.target; }
  function show(space) { // make only `space` drawable (the rig and lights stay as they are)
    R.scene.children.forEach(function (o) { if (isWorldRoot(o)) { saved.push([o, o.visible]); if (space !== 'world') o.visible = false; else if (o === worldDoors || o.userData.alwaysWorld) o.visible = true; } });
    saved.push([pocket, pocket.visible]); pocket.visible = space !== 'world';
    list.forEach(function (c) { saved.push([c.root, c.root.visible]); c.root.visible = c.space === space; });
  }
  function restore() { for (var i = saved.length - 1; i >= 0; i--) saved[i][0].visible = saved[i][1]; saved = []; }
  // the doorways to draw through from where you are: open doors here, and (inside a closet) the way back
  function portals() {
    var out = [], sp = W.space, cur = closetOf(sp);
    list.forEach(function (c) {
      var vis = c.parent === sp && c.angle > 0;
      c.outMask[0].visible = c.outMask[1].visible = vis;
      if (vis) out.push({ c: c, T: c.T, dest: c.space, ref: c.ref, center: new THREE.Vector3(0, DOOR.h / 2, 0).applyMatrix4(c.P), plane: new THREE.Plane().setFromNormalAndCoplanarPoint(v3.set(0, 0, 1), c.o) });
      var back = c === cur; c.inMask[0].visible = c.inMask[1].visible = back;
      if (back) out.push({ c: c, T: c.Tinv, dest: c.parent, ref: c.backRef, center: new THREE.Vector3(c.o.x, DOOR.h / 2, c.o.z), plane: new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(c.P.elements[8], c.P.elements[9], c.P.elements[10]), new THREE.Vector3().setFromMatrixPosition(c.P)) });
    });
    R.camera.updateMatrixWorld(); pv.multiplyMatrices(R.camera.projectionMatrix, R.camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pv);
    var cam = new THREE.Vector3().setFromMatrixPosition(R.camera.matrixWorld);
    return out.filter(function (p) { box3.setFromCenterAndSize(p.center, v3.set(1.6, 2.6, 1.6)); return p.center.distanceTo(cam) < 24 && frustum.intersectsBox(box3); })
      .sort(function (a, b) { return a.center.distanceTo(cam) - b.center.distanceTo(cam); }).slice(0, 3);
  }
  var mainHidden = [];
  R.beforeRender(function () {
    if (!mats) return;
    // draw only the space you're in (the doors' own masks mark where the others show through)
    var sp = W.space; mainHidden = [];
    R.scene.children.forEach(function (o) { if (isWorldRoot(o) && sp !== 'world' && o.visible) { mainHidden.push(o); o.visible = false; } });
    pocket.visible = sp !== 'world'; list.forEach(function (c) { c.root.visible = c.space === sp; });
    C.active = portals();
  });
  // A projection whose near plane is `plane` (world), so the far side's own walls behind its doorway are cut away
  // (the oblique near plane, as three.js's Reflector does it: no extra shaders).
  var cp = new THREE.Plane(), c4 = new THREE.Vector4(), q4 = new THREE.Vector4();
  function oblique(cam, plane) {
    cp.copy(plane).applyMatrix4(cam.matrixWorldInverse); c4.set(cp.normal.x, cp.normal.y, cp.normal.z, cp.constant);
    var e = cam.projectionMatrix.elements;
    q4.set((Math.sign(c4.x) + e[8]) / e[0], (Math.sign(c4.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
    c4.multiplyScalar(2 / c4.dot(q4)); e[2] = c4.x; e[6] = c4.y; e[10] = c4.z + 1; e[14] = c4.w;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }
  // draw a space only inside the doorway's mark: each material once (one shared by many meshes must be put back once)
  function stencilOn(root, ref, seen, ms) {
    root.traverseVisible(function (o) { var m = o.material; if (!m) return; (Array.isArray(m) ? m : [m]).forEach(function (x) { if (x.colorWrite === false || seen.has(x)) return; seen.add(x); ms.push([x, x.stencilWrite, x.stencilFunc, x.stencilRef, x.stencilWriteMask]); x.stencilWrite = true; x.stencilFunc = THREE.EqualStencilFunc; x.stencilRef = ref; x.stencilWriteMask = 0; }); });
    return ms;
  }
  R.afterRender(function () {
    var active = C.active || []; C.active = null;
    mainHidden.forEach(function (o) { o.visible = true; }); mainHidden = [];
    if (!active.length || C.noPortals) return;
    var rd = R.renderer, auto = rd.autoClear, rig = R.rig; rd.autoClear = false;
    active.forEach(function (p) {
      show(p.dest);
      var ms = [], dests = p.dest === 'world' ? R.scene.children.filter(function (o) { return isWorldRoot(o) && o.visible; }) : [closetOf(p.dest).root];
      var seen = new Set(); dests.forEach(function (d) { stencilOn(d, p.ref, seen, ms); });
      rig.updateMatrix(); var keep = rig.matrix.clone(); rig.matrixAutoUpdate = false; rig.matrix.multiplyMatrices(p.T, keep); rig.updateMatrixWorld(true);
      var rv = rig.visible; rig.visible = false;
      // the eyes for this pass, with their near plane laid on the far side's doorway: nothing between you and it is drawn
      var xr = rd.xr, cams;
      if (xr.isPresenting) { xr.cameraAutoUpdate = false; xr.updateCamera(R.camera); cams = xr.getCamera().cameras; } else { R.camera.updateMatrixWorld(true); cams = [R.camera]; }
      var proj = cams.map(function (k) { return [k.projectionMatrix.clone(), k.projectionMatrixInverse.clone()]; });
      cams.forEach(function (k) { oblique(k, p.plane); });
      try { rd.render(R.scene, R.camera); }
      finally {
        cams.forEach(function (k, i) { k.projectionMatrix.copy(proj[i][0]); k.projectionMatrixInverse.copy(proj[i][1]); }); xr.cameraAutoUpdate = true;
        rig.visible = rv; rig.matrix.copy(keep); rig.matrixAutoUpdate = true; rig.updateMatrixWorld(true);
        ms.forEach(function (s) { s[0].stencilWrite = s[1]; s[0].stencilFunc = s[2]; s[0].stencilRef = s[3]; s[0].stencilWriteMask = s[4]; });
        restore();
      }
    });
    rd.autoClear = auto;
  });

  // ---------- The Door tool ----------
  var ghost = null, ghostLabel = null, tool = C.tool = { active: false, hover: null };
  function makeGhost() {
    ghost = new THREE.Group(); ghost.userData.ui = true; ghost.visible = false; R.scene.add(ghost);
    var gm = new THREE.MeshBasicMaterial({ color: 0xf4ead4, transparent: true, opacity: 0.55, depthWrite: false, fog: false, toneMapped: false });
    [[-DOOR.w / 2 - 0.05, DOOR.h / 2, 0.06, DOOR.h + 0.1], [DOOR.w / 2 + 0.05, DOOR.h / 2, 0.06, DOOR.h + 0.1], [0, DOOR.h + 0.05, DOOR.w + 0.16, 0.06]].forEach(function (r) { var m = new THREE.Mesh(new THREE.PlaneGeometry(r[2], r[3]), gm); m.position.set(r[0], r[1], 0.08); ghost.add(m); });
    var fill = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.w, DOOR.h), new THREE.MeshBasicMaterial({ color: 0xf4ead4, transparent: true, opacity: 0.12, depthWrite: false, fog: false, toneMapped: false })); fill.position.set(0, DOOR.h / 2, 0.07); ghost.add(fill);
    ghost.userData.mats = [gm, fill.material];
    var cv = document.createElement('canvas'); cv.width = 768; cv.height = 160; ghostLabel = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.31), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, fog: false, toneMapped: false }));
    ghostLabel.position.set(0, DOOR.h + 0.42, 0.09); ghostLabel.userData.canvas = cv; ghost.add(ghostLabel);
  }
  function label(lines, ok) {
    var cv = ghostLabel.userData.canvas, g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
    g.fillStyle = 'rgba(31, 26, 20, 0.78)'; g.fillRect(0, 0, cv.width, cv.height); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = ok ? '#f4ead4' : '#ffb3a6'; g.font = '50px ' + BRUSH; g.fillText(lines[0], 384, 52, 740);
    g.font = '32px ' + BRUSH; g.globalAlpha = 0.85; g.fillText(lines[1], 384, 116, 740); g.globalAlpha = 1;
    ghostLabel.material.map.needsUpdate = true;
  }
  var lastKey = '';
  tool.start = function () { tool.active = true; if (!ghost) makeGhost(); };
  tool.stop = function () { tool.active = false; tool.hover = null; if (ghost) ghost.visible = false; };
  tool.ray = function () { // where you're aiming: the right controller in the headset, the middle of the screen otherwise
    var r = new THREE.Ray();
    if (R.presenting()) { var h = MP.Player.hand('right'); if (!h) return null; m4.identity().extractRotation(h.ray.matrixWorld); r.origin.setFromMatrixPosition(h.ray.matrixWorld); r.direction.set(0, 0, -1).applyMatrix4(m4); }
    else { r.origin.setFromMatrixPosition(R.camera.matrixWorld); R.camera.getWorldDirection(r.direction); }
    return r;
  };
  tool.aim = function (ray) {
    var a = ray ? aimAt(ray) : null; tool.hover = a;
    if (!a) { ghost.visible = false; return null; }
    frameAt(a.w, a.t, ghost.matrix); ghost.matrixAutoUpdate = false; ghost.matrixWorldNeedsUpdate = true; ghost.visible = true;
    ghost.userData.mats[0].color.set(a.ok ? 0xf4ead4 : 0xd06a5a); ghost.userData.mats[1].color.set(a.ok ? 0xf4ead4 : 0xd06a5a);
    var key = a.w.id + a.t.toFixed(2) + a.ok; if (key !== lastKey) { lastKey = key; label(a.ok ? ['A closet door', 'Behind this wall: ' + a.w.behind] : ['Not here', a.why], a.ok); }
    return { wall: a.w.id, t: a.t, ok: a.ok, why: a.why };
  };
  tool.place = function () { var a = tool.hover; if (!a || !a.ok) return null; var id = C.add(a.w.id, a.t); tool.stop(); if (MP.Panel) MP.Panel.say(id ? 'A closet door. Point at it to open it' : 'Couldn’t place it there'); return id; };
  R.onFrame(function () { if (tool.active && ghost) tool.aim(tool.ray()); });
  // flat screen: a click places the door (and nothing else gets the click)
  MP.$('#scene').addEventListener('pointerup', function (e) {
    if (!tool.active || R.presenting()) return;
    var rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), R.camera);
    tool.aim(rc.ray); if (tool.place()) e.stopImmediatePropagation();
  }, true);

  // ---------- Starting ----------
  C.build = function () {
    makeMats();
    return MP.store.get('closets').then(function (s) {
      var recs = s && Array.isArray(s.list) ? s.list.slice().sort(function (a, b) { return a.id - b.id; }) : [];
      // parents first: a closet's door is in a wall of its parent, which must exist before it
      recs.forEach(function (r) { nextId = Math.max(nextId, r.id + 1); });
      settle(recs);
    });
  };
  // make what can be made, parents first; keep the rest waiting (and saved) until their walls exist
  function settle(recs) {
    var left = recs, guard = 0, made = true;
    while (left.length && made && guard++ < 60) {
      made = false;
      left = left.filter(function (r) { if (byId[r.id]) return false; if (!findWall(r.wall)) return true; made = !!make(r) || made; return !byId[r.id]; });
    }
    waiting = left;
  };
  // rooms rebuild when the plan changes: doors in their walls are rebuilt with them
  C.rebuildRoomDoors = function () {
    if (!mats) return;
    if (waiting.length) settle(waiting.slice()); // a room that has come back brings its closets back
    list.forEach(function (c) {
      if (c.wall.indexOf('r:') !== 0) return;
      var w = findWall(c.wall); if (!w) return;
      if (c.doorGroup && c.doorGroup.parent) c.doorGroup.parent.remove(c.doorGroup);
      c.targets.slice(0, 2).forEach(MP.Interact.remove); c.targets = c.targets.slice(2);
      c.P = frameAt(w, c.t); c.Pinv = c.P.clone().invert();
      c.T = new THREE.Matrix4().multiplyMatrices(c.C, new THREE.Matrix4().makeRotationY(Math.PI)).multiply(c.Pinv); c.Tinv = c.T.clone().invert();
      buildDoor(c); c.targets = c.targets.slice(-2).concat(c.targets.slice(0, -2));
    });
  };
  C.report = function () { return list.map(function (c) { return { id: c.id, parent: c.parent, wall: c.wall, t: +c.t.toFixed(2), depth: c.depth, name: c.name, open: c.open, door: [+c.P.elements[12].toFixed(2), +c.P.elements[14].toFixed(2)] }; }); };
  C.find = function (id) { return byId[id] || null; };
})();
