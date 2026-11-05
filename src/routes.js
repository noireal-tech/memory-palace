/* Memory Palace: routes. A route is a fixed walk through one space (the hall, the garden, a room, a closet) with ten
   numbered stations along it. You choose the stations: point at a spot on the floor by something you'll remember (a
   lantern, the bench, a pillar) and pull the trigger, ten times, in the order you'll walk them. A small wooden plaque
   with the station's number hangs at head height over each one.
   During a session the current station's plaque glows, and the item to remember floats on a paper card above it.
   In Working mode, or with the plaques tag turned off in the foyer, plaques show only while a session needs them. */
(function () {
  'use strict';
  var MP = window.MP, R = MP.R, W = MP.World, T = MP.Train;
  var Rt = MP.Routes = {}, HEAD = 1.55, STOPS = 10;
  var world = new THREE.Group(); world.name = 'stations'; R.scene.add(world); // a palace root: hidden while you're in a closet (closets.js)
  var built = {}; // route id → { group, plaques: [sprite] }
  var BRUSH = '"Kaushan Script", cursive';

  // ---------- Plaques and cards (sprites: they always face you) ----------
  var plaqueTex = {};
  function plaqueTexture(n, lit, blank) {
    var key = n + (lit ? 'L' : '') + (blank ? 'B' : ''); if (plaqueTex[key]) return plaqueTex[key];
    var c = document.createElement('canvas'); c.width = 128; c.height = 160; var g = c.getContext('2d');
    g.fillStyle = lit ? '#e8c46a' : '#6b4a2e'; g.beginPath(); if (g.roundRect) g.roundRect(8, 16, 112, 136, 14); else g.rect(8, 16, 112, 136); g.fill();
    g.strokeStyle = lit ? '#fff3c8' : '#3a2616'; g.lineWidth = 6; g.stroke();
    g.fillStyle = '#2a1c10'; g.fillRect(58, 0, 12, 18); // the cord it hangs from
    if (!blank) { g.fillStyle = lit ? '#2a1c10' : '#f2e2bd'; g.font = 'bold 76px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 90); }
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; plaqueTex[key] = t; return t;
  }
  function plaque(n) {
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: plaqueTexture(n), toneMapped: false, depthWrite: false })); s.scale.set(0.26, 0.32, 1); s.renderOrder = 4; return s;
  }
  function cardTexture(text, tone) {
    var c = document.createElement('canvas'); c.width = 512; c.height = 160; var g = c.getContext('2d');
    g.fillStyle = tone === 'good' ? '#dff0d4' : tone === 'bad' ? '#f3d6cf' : '#f6eedb'; g.fillRect(0, 0, 512, 160);
    g.strokeStyle = tone === 'good' ? '#4c7a3a' : tone === 'bad' ? '#a8342a' : '#6b4a2e'; g.lineWidth = 8; g.strokeRect(4, 4, 504, 152);
    g.fillStyle = '#1f1a14'; g.textAlign = 'center'; g.textBaseline = 'middle';
    var size = 76; g.font = size + 'px ' + BRUSH; while (g.measureText(text).width > 470 && size > 30) { size -= 4; g.font = size + 'px ' + BRUSH; }
    g.fillText(text, 256, 84);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  var card = new THREE.Sprite(new THREE.SpriteMaterial({ map: cardTexture(''), toneMapped: false, depthWrite: false, depthTest: false })); card.scale.set(0.72, 0.225, 1); card.visible = false; card.renderOrder = 6;
  card.userData.ui = true; R.scene.add(card); // drawn in whichever space you're in
  var cardText = null;
  // show a word on the card over a station (tone: '' | 'good' | 'bad'); null hides it
  Rt.card = function (routeId, i, text, tone) {
    if (text == null) { card.visible = false; cardText = null; return; }
    var p = Rt.stationPos(routeId, i); if (!p) return;
    if (cardText !== text + tone) { card.material.map.dispose(); card.material.map = cardTexture(text, tone || ''); cardText = text + tone; }
    card.position.set(p[0], p[1] + HEAD + 0.36, p[2]); card.visible = true;
  };
  Rt.cardShown = function () { return card.visible ? cardText : null; };

  // ---------- Building the plaques for each route ----------
  function rootOf(space) { return space === 'world' ? world : (MP.Closets.root(space) || null); }
  function make(r) {
    var root = rootOf(r.space); if (!root) return null;
    var b = built[r.id]; if (b) { b.group.parent && b.group.parent.remove(b.group); }
    var group = new THREE.Group(); group.name = 'route ' + r.id; root.add(group);
    var plaques = r.stations.map(function (s, i) { var p = plaque(i + 1); p.position.set(s[0], s[1] + HEAD, s[2]); group.add(p); return p; });
    built[r.id] = { group: group, plaques: plaques }; return built[r.id];
  }
  Rt.build = function () { T.state.routes.forEach(make); Rt.refresh(); };
  Rt.stationPos = function (routeId, i) { var r = T.route(routeId); return r && r.stations[i] ? r.stations[i] : null; };

  // which plaques show, and how: lit = the station a session is on; blank = numbers hidden (the find-the-station test)
  var focus = { route: null, i: -1, blank: false, show: null };
  Rt.focus = function (routeId, i, opts) { focus.route = routeId; focus.i = i == null ? -1 : i; focus.blank = !!(opts && opts.blank); focus.show = opts && opts.show || null; Rt.refresh(); };
  Rt.unfocus = function () { focus.route = null; focus.i = -1; focus.blank = false; focus.show = null; Rt.card(null); Rt.refresh(); };
  Rt.refresh = function () {
    var always = T.training() && T.opt('plaques');
    Object.keys(built).forEach(function (id) {
      var b = built[id], rid = +id, mine = focus.route === rid || (focus.show && focus.show.indexOf(rid) >= 0) || (tool.active && tool.route && tool.route.id === rid);
      b.group.visible = always || mine;
      b.plaques.forEach(function (p, i) { p.material.map = plaqueTexture(i + 1, mine && focus.i === i, mine && focus.blank); });
    });
  };
  T.on(function () { Rt.refresh(); });

  // ---------- The route builder ----------
  // Aim: a ray from your right hand (or your eyes, on a flat screen) walks forward until it meets the floor of the space
  // you're in. A ghost plaque shows where the station goes.
  var ghost = plaque('+'); ghost.material.opacity = 0.55; ghost.material.transparent = true; ghost.visible = false; ghost.userData.ui = true; R.scene.add(ghost);
  var tool = Rt.tool = { active: false, route: null };
  function aimRay() {
    var o = new THREE.Vector3(), d = new THREE.Vector3(), right = R.presenting() && MP.Player.hand('right');
    if (right) { o.setFromMatrixPosition(right.ray.matrixWorld); d.set(0, 0, -1).applyMatrix4(new THREE.Matrix4().extractRotation(right.ray.matrixWorld)); }
    else { o.setFromMatrixPosition(R.camera.matrixWorld); R.camera.getWorldDirection(d); }
    return { o: o, d: d };
  }
  Rt.floorHit = function (o, d) {
    var p = o.clone(), step = d.clone().normalize().multiplyScalar(0.04);
    for (var i = 0; i < 300; i++) {
      p.add(step); var g = W.groundAt(p.x, p.z);
      if (g !== g) return null;
      if (W.inside(p.x, p.y, p.z) && p.y > g + 0.2) return null; // a wall first
      if (p.y <= g) { if (W.blocked(p.x, p.z, g, 0.15)) return null; return [Math.round(p.x * 100) / 100, g, Math.round(p.z * 100) / 100]; }
    }
    return null;
  };
  tool.start = function (name) {
    var r = { id: T.id(), name: name || ('Route ' + (T.state.routes.length + 1)), space: W.space, stations: [], made: T.today(), lastUsed: null, holds: null };
    tool.route = r; tool.active = true; tool.done = null; T.state.routes.push(r); make(r); Rt.refresh(); T.save(); return r;
  };
  tool.aim = function () {
    if (!tool.active) return null; var a = aimRay(), h = Rt.floorHit(a.o, a.d);
    ghost.visible = !!h; if (h) ghost.position.set(h[0], h[1] + HEAD, h[2]); return h;
  };
  // place the next station where you aim (or at a given point, for tests); the tenth finishes the route
  tool.place = function (at) {
    if (!tool.active) return false; var h = at || tool.aim(); if (!h) return false;
    var r = tool.route; if (W.space !== r.space) return false; // a route stays in one space
    if (r.stations.some(function (s) { return Math.hypot(s[0] - h[0], s[2] - h[2]) < 0.8; })) return false; // too close to another station
    r.stations.push(h); make(r); Rt.refresh(); T.save();
    if (r.stations.length >= STOPS) tool.finish();
    return true;
  };
  tool.undo = function () { var r = tool.route; if (r && r.stations.length) { r.stations.pop(); make(r); Rt.refresh(); T.save(); } };
  tool.finish = function () { tool.active = false; ghost.visible = false; tool.done = tool.route; T.save(true); T.changed(); if (tool.onDone) tool.onDone(tool.route); };
  tool.cancel = function () { if (tool.route && tool.route.stations.length < STOPS) { T.state.routes = T.state.routes.filter(function (x) { return x !== tool.route; }); var b = built[tool.route.id]; if (b) b.group.parent && b.group.parent.remove(b.group); delete built[tool.route.id]; } tool.active = false; tool.route = null; ghost.visible = false; T.save(); };
  R.onFrame(function () { if (tool.active) tool.aim(); else ghost.visible = false; });
  // flat screen: a click places (the click that isn't a drag)
  var down = null, canvas = MP.$('#scene');
  canvas.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', function (e) {
    if (!tool.active || R.presenting() || !down) return; var moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null; if (moved > 6) return;
    var v = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), rc = new THREE.Raycaster(); rc.setFromCamera(v, R.camera);
    var h = Rt.floorHit(rc.ray.origin, rc.ray.direction); if (h) tool.place(h);
    e.stopImmediatePropagation();
  }, true);

  // ---------- Which station you're pointing at or standing by ----------
  // pointing: the station whose plaque is nearest the ray (within 35 cm of it); standing: within 1 m on the floor
  Rt.pointedAt = function (routeId, o, d) {
    var r = T.route(routeId); if (!r || r.space !== W.space) return -1; var best = -1, bd = 0.35, p = new THREE.Vector3(), ray = new THREE.Ray(o, d.clone().normalize());
    r.stations.forEach(function (s, i) { p.set(s[0], s[1] + HEAD, s[2]); var dist = ray.distanceToPoint(p); if (dist < bd) { bd = dist; best = i; } });
    return best;
  };
  Rt.pointed = function (routeId) { var a = aimRay(); return Rt.pointedAt(routeId, a.o, a.d); };
  Rt.standingAt = function (routeId) {
    var r = T.route(routeId); if (!r || r.space !== W.space) return -1; var h = MP.Player.head(new THREE.Vector3()), best = -1, bd = 1.0;
    r.stations.forEach(function (s, i) { var dist = Math.hypot(s[0] - h.x, s[2] - h.z); if (dist < bd) { bd = dist; best = i; } }); return best;
  };
  Rt.report = function () { return T.state.routes.map(function (r) { return { id: r.id, name: r.name, space: r.space, n: r.stations.length, holds: r.holds, lastUsed: r.lastUsed, shown: !!(built[r.id] && built[r.id].group.visible) }; }); };
  Rt.HEAD = HEAD; Rt.STOPS = STOPS;
})();
