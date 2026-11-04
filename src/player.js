/* Memory Palace: getting around. Left stick walks where you look, right stick snap-turns; on a flat screen, drag to
   look and use WASD or the arrow keys. Feet follow the ground; buildings, trees and water stop you. */
(function () {
  'use strict';
  var MP = window.MP, R = MP.R, W = MP.World, rig = R.rig, camera = R.camera, renderer = R.renderer;
  var tmp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  var P = MP.Player = { speed: 2.3, hold: false, flatYaw: Math.PI, flatPitch: 0.03 };

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

  function settle() {
    if (P.hold) return;
    var h = head(tmp), g = W.groundAt(h.x, h.z); if (g !== g) return;
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
      if (p.hand === 'left') { if (Math.hypot(sx, sy) > 0.15) { f = -sy; s = sx; } }
      else if (p.hand === 'right') { if (Math.abs(sx) > 0.7 && p.snapReady) { P.turn(sx > 0 ? -Math.PI / 6 : Math.PI / 6); p.snapReady = false; } if (Math.abs(sx) < 0.3) p.snapReady = true; }
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
    P.move(dt, f, s);
  }
  P.enabled = false;
  R.onFrame(function (dt) { if (!P.enabled) return; if (renderer.xr.isPresenting) vrInput(dt); else flatInput(dt); });
  R.onSession('start', function () { rig.rotation.y = P.flatYaw; });
  R.onSession('end', function () { P.flatYaw = rig.rotation.y; });
})();
