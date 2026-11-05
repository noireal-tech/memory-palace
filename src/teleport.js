/* Memory Palace: teleport. Push the right stick forward and a dotted arc falls from the controller to a ring on the
   ground; let the stick go and you blink there (a quick fade, so you never see yourself slide). The arc is a thrown
   path, so aiming higher reaches farther. It only lands where you could stand: never on water, on a roof, inside a
   wall, or tight against one. Pull the stick back to call it off. On a flat screen, hold Space to aim where you
   look and let go to land. Turned off on the Settings face, the stick goes back to turning only. */
(function () {
  'use strict';
  var MP = window.MP, R = MP.R, P = MP.Player, W = MP.World, rig = R.rig;
  var SPEED = 9, GRAVITY = 9.8, DT = 0.02, STEPS = 160, REACH = 14, NDOTS = 28, CLEAR = 0.3;
  var OK = new THREE.Color('#f4ead4'), BAD = new THREE.Color('#b8402f');

  // ---------- What you see: a dotted arc, a ring where you'll stand, and the blink ----------
  var dotMat = new THREE.MeshBasicMaterial({ color: OK.clone(), transparent: true, opacity: 0.85, fog: false, depthWrite: false, toneMapped: false });
  var dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.016, 8, 6), dotMat, NDOTS);
  dots.frustumCulled = false; dots.renderOrder = 5; dots.visible = false; dots.count = 0;
  var ringMat = new THREE.MeshBasicMaterial({ color: OK.clone(), transparent: true, opacity: 0.9, fog: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  var padMat = new THREE.MeshBasicMaterial({ color: OK.clone(), transparent: true, opacity: 0.16, fog: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  var mark = new THREE.Group(); mark.visible = false; mark.renderOrder = 5;
  var ring = new THREE.Mesh(new THREE.RingGeometry(0.27, 0.33, 48), ringMat); ring.rotation.x = -Math.PI / 2; mark.add(ring);
  var pad = new THREE.Mesh(new THREE.CircleGeometry(0.27, 48), padMat); pad.rotation.x = -Math.PI / 2; mark.add(pad);
  dots.userData.ui = mark.userData.ui = true; // always drawn, whichever space you're in (closets.js)
  R.scene.add(dots, mark);
  var veil = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 10), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));
  veil.renderOrder = 999; veil.visible = false; R.camera.add(veil);

  // ---------- The arc ----------
  // Throw a point from `o` along `d`; follow it until it lands, hits something, or goes out of reach.
  // Returns { ok, why, point (where it stopped), pts (the path) }.
  function trace(o, d) {
    var p = o.clone(), v = d.clone().normalize().multiplyScalar(SPEED), prev = new THREE.Vector3(), pts = [p.clone()];
    for (var i = 0; i < STEPS; i++) {
      prev.copy(p); p.addScaledVector(v, DT); v.y -= GRAVITY * DT; pts.push(p.clone());
      if (Math.hypot(p.x - o.x, p.z - o.z) > REACH) return { ok: false, why: 'far', point: p.clone(), pts: pts };
      if (W.inside(p.x, p.y, p.z)) return { ok: false, why: 'wall', point: p.clone(), pts: pts };
      var g = W.groundAt(p.x, p.z), water = g !== g, gy = water ? MP.SITE.WATER : g;
      if (p.y <= gy) {
        var a = prev.y > p.y ? MP.clamp((prev.y - gy) / (prev.y - p.y), 0, 1) : 0, hit = prev.clone().lerp(p, a); hit.y = gy; pts[pts.length - 1] = hit.clone();
        if (water) return { ok: false, why: 'water', point: hit, pts: pts };
        if (prev.y < gy - 0.35) return { ok: false, why: 'edge', point: hit, pts: pts };    // it ran into the side of a step or a ledge
        if (W.blocked(hit.x, hit.z, gy, CLEAR)) return { ok: false, why: 'tight', point: hit, pts: pts }; // too close to a wall or a trunk
        return { ok: true, why: '', point: hit, pts: pts };
      }
      if (p.y < MP.SITE.WATER - 20) break;
    }
    return { ok: false, why: 'none', point: p.clone(), pts: pts };
  }

  var m4 = new THREE.Matrix4(), tmp = new THREE.Vector3();
  function show(res) {
    var col = res.ok ? OK : BAD, n = Math.min(NDOTS, res.pts.length), last = res.pts.length - 1;
    dotMat.color.copy(col); ringMat.color.copy(col); padMat.color.copy(col);
    for (var i = 0; i < n; i++) { var q = res.pts[Math.round(i / Math.max(1, n - 1) * last)]; m4.makeTranslation(q.x, q.y, q.z); dots.setMatrixAt(i, m4); }
    dots.count = n; dots.instanceMatrix.needsUpdate = true; dots.visible = true;
    var landed = res.ok || res.why === 'water' || res.why === 'tight';
    mark.visible = landed; if (landed) mark.position.set(res.point.x, res.point.y + 0.03, res.point.z);
  }
  function hide() { dots.visible = false; mark.visible = false; }

  // ---------- Aiming and landing ----------
  var aim = null, last = null, blink = null;
  function aimFrom(o, d) { last = trace(o, d); show(last); if (aim) aim.seen = performance.now(); return last; }
  var lastSeen = null;
  function release() { var r = last; lastSeen = r ? { ok: r.ok, why: r.why, point: r.point.toArray() } : null; aim = null; last = null; hide(); if (r && r.ok) go(r.point); }
  function cancel() { aim = null; last = null; hide(); }
  // the blink: fade out, move, fade back in
  function go(at) { if (!blink) blink = { t: 0, to: at.clone(), moved: false }; }
  function land(at) {
    var h = P.head(tmp); rig.position.x += at.x - h.x; rig.position.z += at.z - h.z; rig.position.y = at.y;
    if (MP.Portal) MP.Portal.reset(); // a blink near the ring isn't walking through it
    T.count++;
  }
  var OUT = 0.08, IN = 0.16;
  R.onFrame(function (dt, now) {
    if (aim && aim.pad && performance.now() - aim.seen > 250) cancel(); // the controller went away mid-aim
    if (flatAim && !R.presenting()) aimFrom(new THREE.Vector3().setFromMatrixPosition(R.camera.matrixWorld), R.camera.getWorldDirection(new THREE.Vector3()));
    if (!blink) return;
    if (blink.start == null) blink.start = now;
    blink.t = (now - blink.start) / 1000; // by the clock, so a slow frame never stretches the dark
    if (!blink.moved && blink.t >= OUT) { land(blink.to); blink.moved = true; }
    var o = blink.t < OUT ? blink.t / OUT : Math.max(0, 1 - (blink.t - OUT) / IN);
    veil.visible = o > 0.001; veil.material.opacity = o;
    if (blink.t >= OUT + IN) { blink = null; veil.visible = false; veil.material.opacity = 0; }
  });

  // the right stick, from the player's controller loop: true while teleport has the stick
  function stick(p, sx, sy) {
    if (!P.settings.teleport) return false;
    if (blink) return true;
    if (!aim) { if (sy < -0.65 && Math.abs(sx) < 0.7) aim = { pad: p, seen: performance.now() }; else return false; }
    if (sy > 0.5) { cancel(); aim = { pad: null, done: true }; return true; } // pulled back: called off
    if (aim.done) { if (Math.hypot(sx, sy) < 0.3) aim = null; return true; } // wait for the stick to settle before anything else
    if (Math.hypot(sx, sy) < 0.3) { release(); return true; }
    m4.identity().extractRotation(p.ray.matrixWorld);
    aimFrom(new THREE.Vector3().setFromMatrixPosition(p.ray.matrixWorld), new THREE.Vector3(0, 0, -1).applyMatrix4(m4));
    return true;
  }

  // flat screen: hold Space to aim where you look
  var flatAim = false;
  addEventListener('keydown', function (e) {
    if (e.code !== 'Space' || e.repeat || (e.target && /input|textarea|button/i.test(e.target.tagName))) return;
    if (!P.enabled || !P.settings.teleport || R.presenting()) return; e.preventDefault(); flatAim = true;
  });
  addEventListener('keyup', function (e) { if (e.code !== 'Space' || !flatAim) return; flatAim = false; release(); });
  addEventListener('blur', function () { if (flatAim) { flatAim = false; cancel(); } });

  var T = MP.Teleport = {
    count: 0, trace: trace, stick: stick, cancel: cancel,
    aiming: function () { return !!(aim && !aim.done) || flatAim; },
    blinking: function () { return !!blink; },
    // for tests: aim from a point along a direction (arrays), then let go
    aimAt: function (o, d) { var r = aimFrom(new THREE.Vector3().fromArray(o), new THREE.Vector3().fromArray(d)); return { ok: r.ok, why: r.why, point: r.point.toArray() }; },
    release: release,
    lastAim: function () { return last ? { ok: last.ok, why: last.why, point: last.point.toArray() } : lastSeen; }
  };
})();
