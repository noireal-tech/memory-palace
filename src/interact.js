/* Memory Palace: pointing at things in the world. In the headset, the right controller's ray picks out the nearest
   thing you can use (a door, a plaque) and the trigger uses it; on a flat screen, a click does (a click, not a drag).
   The hand panel gets first claim on the ray when you're pointing at it. */
(function () {
  'use strict';
  var MP = window.MP, R = MP.R, P = MP.Player;
  var targets = [], hover = null, hoverHit = null, rc = new THREE.Raycaster(), m4 = new THREE.Matrix4(), MAX = 7;
  var I = MP.Interact = {};
  // add(mesh, { use: fn, label: 'Open the door' }) → the target; remove(target)
  I.add = function (mesh, o) { var t = { mesh: mesh, use: o.use, label: o.label || '' }; mesh.userData.target = t; targets.push(t); return t; };
  I.remove = function (t) { var i = targets.indexOf(t); if (i >= 0) targets.splice(i, 1); if (hover === t) hover = null; };
  function pick(ray) {
    rc.ray.copy(ray); rc.far = MAX;
    var hits = rc.intersectObjects(targets.map(function (t) { return t.mesh; }), true);
    for (var i = 0; i < hits.length; i++) { var o = hits[i].object; while (o && !o.userData.target) o = o.parent; if (o) return { t: o.userData.target, hit: hits[i] }; }
    return null;
  }
  I.pick = pick;
  // the laser beam and its dot (only drawn while it's on something usable)
  var beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xd4ad55, transparent: true, opacity: 0.8 }));
  beam.visible = false;
  var dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshBasicMaterial({ color: 0xd4ad55 })); dot.visible = false; R.scene.add(dot);
  var ray = new THREE.Ray();
  R.onFrame(function () {
    hover = null; hoverHit = null; beam.visible = false; dot.visible = false;
    if (!R.presenting() || !targets.length) return;
    var right = P.hand('right'); if (!right) return;
    if (beam.parent !== right.ray) right.ray.add(beam);
    if (MP.Panel && MP.Panel.pointing()) return; // the panel has the ray
    if (MP.Teleport && MP.Teleport.aiming()) return; // so does a teleport arc
    m4.identity().extractRotation(right.ray.matrixWorld);
    ray.origin.setFromMatrixPosition(right.ray.matrixWorld); ray.direction.set(0, 0, -1).applyMatrix4(m4);
    var p = pick(ray);
    if (p) { hover = p.t; hoverHit = p.hit; beam.visible = true; beam.scale.z = p.hit.distance; dot.visible = true; dot.position.copy(p.hit.point); }
  });
  // trigger: the panel handles its own presses; otherwise use what the ray is on
  I.select = function (rec) { if (rec.hand === 'right' && hover) { hover.use(hoverHit); return true; } return false; }; // use(hit): where on it you pointed
  I.hovering = function () { return hover; };
  // flat screen: a click (pointer barely moved) uses what's under the cursor
  var down = null, canvas = MP.$('#scene');
  canvas.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', function (e) {
    if (!down || R.presenting()) return; var moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
    if (moved > 6) return;
    var v = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    rc.setFromCamera(v, R.camera); var p = pick(rc.ray.clone()); if (p) p.t.use(p.hit);
  });
  // for tests: use whatever a ray from `o` along `d` (arrays) meets first
  I.useRay = function (o, d) { var p = pick(new THREE.Ray(new THREE.Vector3().fromArray(o), new THREE.Vector3().fromArray(d).normalize())); if (p) { p.t.use(p.hit); return p.t.label; } return null; };
  // for tests: use whatever is straight ahead of your eyes (up to MAX metres)
  I.useAhead = function () {
    var dir = new THREE.Vector3(); R.camera.getWorldDirection(dir); var o = new THREE.Vector3().setFromMatrixPosition(R.camera.matrixWorld);
    var p = pick(new THREE.Ray(o, dir)); if (p) { p.t.use(p.hit); return p.t.label; } return null;
  };
})();
