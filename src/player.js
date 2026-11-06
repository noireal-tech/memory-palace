/* Memory Palace: getting around. Left stick walks where you look; right stick turns (snap or smooth, your choice on
   the panel's Settings face) and, pushed forward, aims a teleport (teleport.js). On a flat screen, drag to look, use
   WASD or the arrow keys, and hold Space to teleport. Feet follow the ground; buildings, trees and water stop you. */
(function () {
  'use strict';
  var MP = window.MP, R = MP.R, W = MP.World, rig = R.rig, camera = R.camera, renderer = R.renderer;
  var tmp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  var P = MP.Player = { speed: 2.3, hold: false, flatYaw: Math.PI, flatPitch: 0.03 };

  // ---------- Movement settings, chosen on the hand panel's Settings face and kept on this headset ----------
  P.TURNS = {
    snap30: { label: 'Snap, 30° steps', snap: Math.PI / 6 },
    snap45: { label: 'Snap, 45° steps', snap: Math.PI / 4 },
    smooth: { label: 'Smooth, gentle', rate: Math.PI / 3 },        // 60° a second at full stick
    smoothFast: { label: 'Smooth, quick', rate: Math.PI * 2 / 3 }  // 120° a second
  };
  var TURN_ORDER = ['snap30', 'snap45', 'smooth', 'smoothFast'];
  P.settings = { turn: 'snap30', teleport: true };
  try { var saved = JSON.parse(localStorage.getItem('mp.move') || 'null'); if (saved) { if (P.TURNS[saved.turn]) P.settings.turn = saved.turn; if (typeof saved.teleport === 'boolean') P.settings.teleport = saved.teleport; } } catch (e) { }
  function keep() { try { localStorage.setItem('mp.move', JSON.stringify(P.settings)); } catch (e) { } }
  P.setTurn = function (mode) { if (P.TURNS[mode]) { P.settings.turn = mode; keep(); } };
  P.cycleTurn = function () { P.setTurn(TURN_ORDER[(TURN_ORDER.indexOf(P.settings.turn) + 1) % TURN_ORDER.length]); };
  P.setTeleport = function (on) { P.settings.teleport = !!on; keep(); if (!on && MP.Teleport) MP.Teleport.cancel(); };
  P.turnLabel = function () { return P.TURNS[P.settings.turn].label; };

  function head(out) { rig.updateMatrixWorld(true); return out.setFromMatrixPosition(camera.matrixWorld); }
  function headYaw() { camera.getWorldDirection(tmp); return Math.atan2(-tmp.x, -tmp.z); }
  P.head = head; P.headYaw = headYaw;

  // Stand somewhere (spec coordinates), facing yaw (0 = north... here: 0 faces -z, PI faces +z).
  P.place = function (x, z, yaw) {
    if (renderer.xr.isPresenting) { P.turn(yaw - headYaw()); var h = head(tmp); rig.position.x += x - h.x; rig.position.z += z - h.z; }
    else { rig.position.set(x, 0, z); P.flatYaw = yaw; rig.rotation.y = yaw; }
    var g = W.groundAt(x, z); rig.position.y = g === g ? g : 0;
  };
  P.turn = function (a) { var h = head(new THREE.Vector3()); rig.position.sub(h); rig.position.applyAxisAngle(up, a); rig.position.add(h); rig.rotation.y += a; };

  // Feet follow the floor under your head. Stepping up is at once; stepping down waits until your head is a hand's width
  // past the edge. Without that wait, the few millimetres a head sways while you stand still on the edge of a step
  // flipped you between the two heights every frame: a 14 cm bob a headset makes very visible (Endless Clay had the
  // same kind of shake). STICK is how far the floor you're on still holds you; LEVEL is how close counts as that floor.
  var STICK = 0.15, LEVEL = 0.02, around = [];
  for (var a = 0; a < 8; a++) around.push([Math.cos(a * Math.PI / 4) * STICK, Math.sin(a * Math.PI / 4) * STICK]);
  function floorUnder(x, z, feet) {
    var g = W.groundAt(x, z); if (g !== g) return g;
    if (g < feet - LEVEL) for (var i = 0; i < around.length; i++) { var k = W.groundAt(x + around[i][0], z + around[i][1]); if (k === k && Math.abs(k - feet) <= LEVEL) return feet; }
    return g;
  }
  P.floorUnder = floorUnder;
  function settle() {
    if (P.hold || P.seat) return;
    var h = head(tmp), g = floorUnder(h.x, h.z, rig.position.y); if (g !== g) return;
    rig.position.y += (g - rig.position.y) * 0.35; if (Math.abs(g - rig.position.y) < 0.01) rig.position.y = g;
  }
  function canStand(x, z, feet) { var g = W.groundAt(x, z); return g === g && g - feet <= 0.5 && !W.blocked(x, z, feet); }
  // Move by forward/side amounts (-1..1) relative to where you look, sliding along walls.
  P.move = function (dt, fwd, side) {
    if (fwd || side) {
      var yaw = headYaw(), sp = P.speed * dt, dx = (-Math.sin(yaw) * fwd + Math.cos(yaw) * side) * sp, dz = (-Math.cos(yaw) * fwd - Math.sin(yaw) * side) * sp;
      var h = head(tmp), feet = rig.position.y;
      if (canStand(h.x + dx, h.z + dz, feet)) { rig.position.x += dx; rig.position.z += dz; }
      else if (canStand(h.x + dx, h.z, feet)) rig.position.x += dx;
      else if (canStand(h.x, h.z + dz, feet)) rig.position.z += dz;
    }
    settle();
  };

  // ---------- Controllers ----------
  var pads = [];
  P.pads = pads;
  for (var i = 0; i < 2; i++) (function (i) {
    var c = renderer.xr.getController(i), grip = renderer.xr.getControllerGrip(i), rec = { i: i, ray: c, grip: grip, src: null, hand: '', snapReady: true };
    c.addEventListener('connected', function (e) { rec.src = e.data; rec.hand = e.data.handedness; });
    c.addEventListener('disconnected', function () { rec.src = null; rec.hand = ''; });
    c.addEventListener('selectstart', function () { if (P.onSelect) P.onSelect(rec); });
    // grabbing (grab.js): the grip button, or the trigger when your hand is on something you can hold
    c.addEventListener('selectend', function () { if (MP.Grab) MP.Grab.release(rec, 'trigger'); });
    c.addEventListener('squeezestart', function () { if (MP.Grab) MP.Grab.press(rec, 'grip'); });
    c.addEventListener('squeezeend', function () { if (MP.Grab) MP.Grab.release(rec, 'grip'); });
    rig.add(c, grip);
    // a simple controller: a dark rounded handle
    var body = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.09, 4, 10), new THREE.MeshStandardMaterial({ color: 0x222428, roughness: 0.5 }));
    body.rotation.x = -Math.PI / 2.6; grip.add(body);
    pads.push(rec);
  })(i);
  P.hand = function (h) { for (var i = 0; i < pads.length; i++) if (pads[i].hand === h) return pads[i]; return null; };

  function vrInput(dt) {
    var f = 0, s = 0;
    pads.forEach(function (p) {
      var gp = p.src && p.src.gamepad; if (!gp) return; var ax = gp.axes, sx = ax[2] || 0, sy = ax[3] || 0;
      if (P.seat && (p.hand === 'left' ? Math.hypot(sx, sy) > 0.5 : Math.abs(sy) > 0.6)) P.stand(); // moving the stick stands you up
      if (p.hand === 'left') { if (Math.hypot(sx, sy) > 0.15 && !P.seat) { f = -sy; s = sx; } }
      else if (p.hand === 'right') {
        if (MP.Panel && MP.Panel.pointing()) { if (MP.Teleport) MP.Teleport.cancel(); return; } // pointing at the panel: the stick flips its faces
        // stick forward aims a teleport; let go to land there
        if (MP.Teleport && MP.Teleport.stick(p, sx, sy)) return;
        if (Math.abs(sy) > 0.6) return; // mostly forward or back: not a turn
        var t = P.TURNS[P.settings.turn];
        if (t.snap) { if (Math.abs(sx) > 0.7 && p.snapReady) { P.turn(sx > 0 ? -t.snap : t.snap); p.snapReady = false; } if (Math.abs(sx) < 0.3) p.snapReady = true; }
        else if (Math.abs(sx) > 0.18) { var k = (Math.abs(sx) - 0.18) / 0.82; P.turn(-Math.sign(sx) * k * k * t.rate * dt); } // eases in from the centre
      }
    });
    P.move(dt, f, s);
  }
  // ---------- Flat screen ----------
  var keys = new Set(), drag = null;
  addEventListener('keydown', function (e) { if (e.target && /input|textarea|button/i.test(e.target.tagName)) return; keys.add(e.key.toLowerCase()); });
  addEventListener('keyup', function (e) { keys.delete(e.key.toLowerCase()); });
  addEventListener('blur', function () { keys.clear(); });
  MP.$('#scene').addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY }; MP.$('#scene').setPointerCapture(e.pointerId); });
  MP.$('#scene').addEventListener('pointerup', function () { drag = null; });
  MP.$('#scene').addEventListener('pointermove', function (e) {
    if (!drag) return;
    P.flatYaw -= (e.clientX - drag.x) * 0.004; P.flatPitch = MP.clamp(P.flatPitch - (e.clientY - drag.y) * 0.004, -1.2, 1.2); drag = { x: e.clientX, y: e.clientY };
  });
  function flatInput(dt) {
    rig.rotation.y = P.flatYaw; camera.rotation.set(P.flatPitch, 0, 0);
    var f = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
    var s = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    if (P.seat && (f || s)) P.stand();
    P.move(dt, P.seat ? 0 : f, P.seat ? 0 : s);
  }
  // ---------- Sitting (the garden bench) ----------
  // Sit at (x, z) facing yaw with your eyes at eye metres: in the headset the view drops to that height whatever your
  // real height; moving the stick stands you up again.
  P.seat = null;
  P.sit = function (x, z, yaw, eye) {
    P.place(x, z, yaw); P.seat = { x: x, z: z, eye: eye };
    var local = renderer.xr.isPresenting ? camera.position.y : MP.EYE; rig.position.y = eye - local;
  };
  P.stand = function () { if (!P.seat) return; P.seat = null; var h = head(tmp), g = W.groundAt(h.x, h.z); rig.position.y = g === g ? g : 0; };
  R.onFrame(function () { if (P.seat && renderer.xr.isPresenting) rig.position.y = P.seat.eye - camera.position.y; }); // keep the seated eye height as you shift
  P.enabled = false;
  R.onFrame(function (dt) { if (!P.enabled) return; if (renderer.xr.isPresenting) vrInput(dt); else flatInput(dt); });
  R.onSession('start', function () { rig.rotation.y = P.flatYaw; });
  R.onSession('end', function () { P.flatYaw = rig.rotation.y; });
})();
