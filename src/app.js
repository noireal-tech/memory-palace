/* Memory Palace: start-up. Paint the materials, raise the site and the keep in the chosen skin, put you in the
   forecourt, and go into the headset if a portal handed over a VR session. */
(function () {
  'use strict';
  var MP = window.MP, R = MP.R, P = MP.Player, $ = MP.$;
  var groups = { site: new THREE.Group(), keep: new THREE.Group(), hall: new THREE.Group() };
  R.scene.add(groups.site, groups.keep, groups.hall);
  // The hall's furnishings are drawn only when you could see them: inside the keep, or outside in front of an open gate.
  var hp = new THREE.Vector3();
  R.onFrame(function () {
    if (!MP.ready || !MP.KEEP) return;
    P.head(hp); var I = MP.KEEP.IN, inside = hp.x > I[0] - 0.5 && hp.x < I[2] + 0.5 && hp.z > I[1] - 2 && hp.z < I[3] + 0.5;
    var open = MP.Gate && MP.Gate.angles().some(function (a) { return a > 0.03; });
    groups.hall.visible = inside || (open && hp.z < I[1] && Math.hypot(hp.x, hp.z - I[1]) < 60);
  });

  MP.arrive = function () { var a = MP.SITE.ARRIVE; P.place(a.x, a.z, a.yaw); P.flatPitch = 0.03; MP.Portal && MP.Portal.reset(); };

  // ---------- Your plan: picked from a file you keep, stored only on this device ----------
  MP.Plan = {
    data: null,
    save: function () { return MP.Plan.data ? MP.store.set('plan', MP.Plan.data) : Promise.resolve(); },
    load: function () { return MP.store.get('plan').then(function (p) { MP.Plan.data = p || null; return MP.Plan.data; }); },
    importText: function (text) {
      var o = JSON.parse(text), rooms = o && o.rooms;
      if (!Array.isArray(rooms) || !rooms.length) throw new Error('no rooms');
      var clean = rooms.map(function (r) { return { address: String(r.address || ''), name: r.name ? String(r.name).slice(0, 48) : '', wall: r.wall || null, accent: r.accent || null, active: !!r.active, wasActive: !!(r.wasActive || r.active) }; })
        .filter(function (r) { return /^(W2|W1|C|E1|E2)\.(W|E)\.(N|S)\d+$/.test(r.address); });
      if (!clean.length) throw new Error('no valid addresses');
      var plan = { v: 1, rooms: clean, at: Date.now() };
      return MP.store.set('plan', plan).then(function () { MP.Plan.data = plan; return plan; });
    }
  };
  function roomsText() { var n = MP.Plan.data ? MP.Plan.data.rooms.length : 0; return n + (n === 1 ? ' room' : ' rooms') + ' in your plan'; }
  function planNote() { var p = MP.Plan.data; return p ? 'Your plan: ' + p.rooms.length + (p.rooms.length === 1 ? ' room' : ' rooms') + ', kept on this headset only.' : 'No plan yet. Open your palace plan to add your rooms.'; }

  // ---------- Building ----------
  async function build() {
    var T = {}, names = MP.Tex.names.concat(['blossom', 'pine']);
    for (var i = 0; i < names.length; i++) { R.status('Preparing materials… ' + Math.round(i / names.length * 100) + '%', true); T[names[i]] = await MP.Tex.get(names[i]); }
    MP.makeMaterials(T);
    R.status('Raising the palace…', true); await MP.yieldFrame();
    var rnd = MP.rng(7);
    MP.SITE.build(groups.site, rnd); await MP.yieldFrame();
    var skin = MP.Skins[MP.params.get('skin') || 'pagoda'] || MP.Skins.pagoda;
    skin.keep(groups.keep); await MP.yieldFrame();
    // the Central Hall inside the keep: the gate, the cascade, the stair, the bench, the garden
    R.status('Furnishing the hall…', true);
    await MP.Gate.build(groups.keep); MP.Hall.build(groups.hall); await MP.yieldFrame(); await MP.Garden.build(groups.hall); await MP.yieldFrame(); await MP.Things.build(groups.hall); await MP.yieldFrame();
    MP.Portal.build(groups.site); MP.Sound.build(groups.site); await MP.yieldFrame();
    R.scene.add(MP.Rooms.group); await MP.Plan.load(); await MP.Rooms.load(); R.status('Raising your rooms…', true); MP.Rooms.build(); await MP.yieldFrame();
    // prepare every material's shaders before the first full frame, in the background where the browser allows it
    R.status('Lighting the palace…', true);
    try { if (R.renderer.compileAsync) await R.renderer.compileAsync(R.scene, R.camera); else R.renderer.compile(R.scene, R.camera); } catch (e) { MP.log('compile', e); }
    R.refreshShadows();
    MP.ready = true; P.enabled = true;
    R.status(planNote(), false);
    MP.Panel.say(MP.Plan.data ? 'Forecourt · ' + roomsText() : 'Forecourt');
  }

  // ---------- The page's card ----------
  var via = MP.params.get('via');
  if (via === 'clay') $('#card').classList.add('arriving');
  $('#enter').addEventListener('click', function () { R.enterVR(); });
  $('#home').addEventListener('click', function () { MP.Links.go('clay', 'via=palace'); });
  if (!navigator.xr) { $('#enter').disabled = true; $('#enter').textContent = 'VR not available here'; }
  $('#planBtn').addEventListener('click', function () { $('#planFile').click(); });
  $('#planFile').addEventListener('change', async function (e) {
    var f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    try { await MP.Plan.importText(await f.text()); MP.Rooms.build(); R.status(planNote(), false); MP.Panel.say('Forecourt · ' + roomsText()); }
    catch (err) { R.status('That file isn’t a palace plan.', false); }
  });
  R.onSession('start', function () { $('#card').hidden = true; });
  R.onSession('end', function () { $('#card').hidden = false; });

  // ---------- Go ----------
  MP.arrive();
  // A VR session handed over by the portal: go straight in and let the palace finish building around you.
  if (window.__xrGranted) R.enterVR();
  addEventListener('xrgranted', function () { R.enterVR(); });
  build().catch(function (e) {
    console.error(e); MP.ready = true; P.enabled = true;
    R.status('Something went wrong raising the palace. Reload to try again.', true);
  });

  if (MP.DEBUG) window.palaceDebug = {
    MP: MP, ready: function () { return !!MP.ready; }, presenting: R.presenting, frames: R.frames,
    stats: function () { var i = R.renderer.info.render; return { tris: i.triangles, calls: i.calls, meshes: groups.site.children.length + groups.keep.children.length + groups.hall.children.length, world: MP.World.counts() }; },
    place: function (x, y, z, hold) { R.rig.position.set(x, y, z); P.hold = !!hold; MP.Portal.reset(); },
    look: function (yaw, pitch) { P.flatYaw = yaw; P.flatPitch = pitch; R.rig.rotation.y = yaw; R.camera.rotation.set(pitch, 0, 0); },
    walk: function (n, f, s) { for (var i = 0; i < n; i++) { P.move(1 / 60, f, s || 0); MP.Portal.check(); } return R.rig.position.toArray(); },
    lastLink: function () { return MP.lastLink || null; }, hall: function () { return { gate: MP.Gate.angles(), garden: MP.Garden.report(), seat: MP.Player.seat, things: MP.Things.report() }; }, detail: function () { MP.Detail.update(true); return MP.Detail.report(); }, sound: function () { return MP.Sound.debug(); }
  };
})();
