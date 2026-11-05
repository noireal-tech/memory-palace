/* Memory Palace: the renderer, the sky and its light, the frame loop and the headset session. */
(function () {
  'use strict';
  var MP = window.MP;

  var canvas = MP.$('#scene');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, stencil: true, powerPreference: 'high-performance' }); // stencil: closet doorways (closets.js)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.7;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor'); renderer.xr.setFoveation(0.5);
  MP.Tex.setRenderer(renderer);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(70, 1, 0.05, 8000);
  var rig = new THREE.Group(); rig.name = 'rig'; rig.add(camera); scene.add(rig);
  MP.EYE = 1.6; camera.position.set(0, MP.EYE, 0);

  // ---------- Sky: late afternoon, sun low in the west-southwest ----------
  var SUN = { elev: 22, az: 242 };
  var sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - SUN.elev), THREE.MathUtils.degToRad(SUN.az));
  function skyMesh(scale) {
    var s = new PreethamSky(); s.scale.setScalar(scale);
    var u = s.material.uniforms; u.turbidity.value = 4.2; u.rayleigh.value = 2.1; u.mieCoefficient.value = 0.0045; u.mieDirectionalG.value = 0.88; u.sunPosition.value.copy(sunDir);
    return s;
  }
  scene.add(skyMesh(6000));
  // Clouds: a painted layer on a high dome, drifting slowly, lit warm on the sun's side.
  var cloudTex = (function () {
    var W = 1024, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var u = x / W, v = y / H, n = MP.fbm(u, v * 0.25, 6, 6, 201), streak = MP.fbm(u, v * 0.25, 3, 3, 203);
      var a = MP.smooth(0.5, 0.78, n * 0.75 + streak * 0.35) * MP.smooth(0.0, 0.35, v) * (1 - MP.smooth(0.85, 1, v));
      var i = (y * W + x) * 4, shade = 225 + 30 * MP.fbm(u, v, 24, 2, 205);
      d[i] = shade; d[i + 1] = shade; d[i + 2] = shade + 6; d[i + 3] = a * 235;
    }
    g.putImageData(img, 0, 0);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
  })();
  var cloudMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: cloudTex }, uShift: { value: 0 }, uSun: { value: sunDir.clone() } }, transparent: true, depthWrite: false, side: THREE.BackSide, fog: false,
    vertexShader: 'varying vec3 vDir; varying vec2 vUv; void main() { vDir = normalize(position); vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform sampler2D map; uniform float uShift; uniform vec3 uSun; varying vec3 vDir; varying vec2 vUv;',
      'void main() {',
      '  float el = vDir.y; if (el < 0.0) discard;',
      '  vec2 uv = vec2(vUv.x * 2.0 + uShift, clamp(el * 1.6, 0.0, 1.0));',
      '  vec4 c = texture2D(map, uv);',
      '  float toward = max(dot(normalize(vec3(vDir.x, 0.0, vDir.z)), normalize(vec3(uSun.x, 0.0, uSun.z))), 0.0);',
      '  vec3 lit = mix(vec3(0.82, 0.84, 0.9), vec3(1.25, 1.02, 0.78), pow(toward, 3.0));',
      '  float a = c.a * smoothstep(0.02, 0.14, el);',
      '  gl_FragColor = vec4(c.rgb * lit, a);',
      '  #include <colorspace_fragment>',
      '}'].join('\n')
  });
  var clouds = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), cloudMat); clouds.renderOrder = -1; scene.add(clouds);

  var sun = new THREE.DirectionalLight(0xffd6a6, 3.3);
  sun.position.copy(sunDir).multiplyScalar(160); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); // drawn once (the sun never moves), so a sharp map costs nothing per frame
  var sc = sun.shadow.camera; sc.left = -82; sc.right = 82; sc.top = 82; sc.bottom = -82; sc.near = 30; sc.far = 360;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
  scene.add(sun, sun.target, new THREE.HemisphereLight(0xb8cbef, 0x4b3d2d, 0.14));
  // The sky, filtered, lights everything from all directions (image-based light).
  (function () { var pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene(); es.add(skyMesh(900)); scene.environment = pm.fromScene(es, 0.02).texture; pm.dispose(); })();
  scene.fog = new THREE.FogExp2(0xc4cdd3, 0.0007);

  // ---------- Batches: geometry with the same material is merged into one mesh ----------
  function worldUV(g, tile) {
    var p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
    for (var i = 0; i < p.count; i++) {
      var ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)), x = p.getX(i), y = p.getY(i), z = p.getZ(i), a, b;
      if (ay >= ax && ay >= az) { a = x; b = z; } else if (ax >= az) { a = z; b = y; } else { a = x; b = y; }
      uv[i * 2] = a / tile[0]; uv[i * 2 + 1] = b / tile[1];
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  function Batch(group) { this.group = group; this.lists = new Map(); this.meshes = []; }
  // add(material, geometry, keepUV): world-space geometry; its UVs are worked out from position unless kept.
  Batch.prototype.add = function (mat, g, keepUV) {
    if (g.index) g = g.toNonIndexed();
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!keepUV && mat.userData.tile) worldUV(g, mat.userData.tile);
    if (mat.userData.set && MP.Detail) MP.Detail.note(mat, g); // where this material is, for the detail bubble
    if (!this.lists.has(mat)) this.lists.set(mat, []);
    this.lists.get(mat).push(g);
  };
  Batch.prototype.flush = function () {
    var self = this;
    this.lists.forEach(function (list, mat) {
      var count = 0, hasCol = !!list[0].attributes.color;
      list.forEach(function (g) { count += g.attributes.position.count; });
      var pos = new Float32Array(count * 3), nrm = new Float32Array(count * 3), uv = new Float32Array(count * 2), col = hasCol ? new Float32Array(count * 3) : null, o = 0;
      list.forEach(function (g) {
        pos.set(g.attributes.position.array, o * 3); nrm.set(g.attributes.normal.array, o * 3);
        if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
        if (col && g.attributes.color) col.set(g.attributes.color.array, o * 3);
        o += g.attributes.position.count; g.dispose();
      });
      var m = new THREE.BufferGeometry();
      m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      if (col) m.setAttribute('color', new THREE.BufferAttribute(col, 3));
      m.computeBoundingSphere();
      var mesh = new THREE.Mesh(m, mat); mesh.castShadow = mat.userData.castShadow !== false; mesh.receiveShadow = mat.userData.receiveShadow !== false;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix(); self.group.add(mesh); self.meshes.push(mesh);
    });
    this.lists.clear();
  };
  Batch.prototype.clear = function () {
    this.meshes.forEach(function (m) { m.parent && m.parent.remove(m); m.geometry.dispose(); });
    this.meshes = [];
  };

  // ---------- Status label in the headset (the page's card can't be seen there) ----------
  var labelCanvas = document.createElement('canvas'); labelCanvas.width = 1024; labelCanvas.height = 200;
  var labelTex = new THREE.CanvasTexture(labelCanvas); labelTex.colorSpace = THREE.SRGBColorSpace;
  var label = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.225), new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, depthTest: false, fog: false, toneMapped: false }));
  label.position.set(0, -0.12, -1.5); label.renderOrder = 20; label.visible = false; camera.add(label);
  var labelOn = false;
  function status(text, inHeadset) {
    var el = MP.$('#status'); if (el) el.textContent = text;
    labelOn = !!inHeadset;
    var g = labelCanvas.getContext('2d'); g.clearRect(0, 0, 1024, 200);
    g.fillStyle = 'rgba(24, 20, 16, 0.8)'; g.beginPath(); if (g.roundRect) g.roundRect(6, 6, 1012, 188, 44); else g.rect(6, 6, 1012, 188); g.fill();
    g.textAlign = 'center'; g.fillStyle = '#d4ad55'; g.font = '600 34px "Bricolage Grotesque", system-ui, sans-serif'; g.fillText('MEMORY PALACE', 512, 74);
    g.fillStyle = '#f4ead8'; g.font = '500 46px "Bricolage Grotesque", system-ui, sans-serif'; g.fillText(text, 512, 142, 960);
    labelTex.needsUpdate = true;
  }

  // ---------- Frame loop ----------
  var hooks = [], before = [], after = [], last = performance.now(), t0 = last, frameLog = [], errors = 0;
  function onFrame(fn) { hooks.push(fn); }
  function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();
  renderer.setAnimationLoop(function (time, xrFrame) {
    var now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (MP.DEBUG) { frameLog.push([now, renderer.xr.isPresenting ? 1 : 0]); if (frameLog.length > 3000) frameLog.shift(); }
    cloudMat.uniforms.uShift.value = (now - t0) * 0.0000012;
    label.visible = labelOn && renderer.xr.isPresenting;
    for (var i = 0; i < hooks.length; i++) {
      try { hooks[i](dt, now, xrFrame); }
      catch (e) { if (errors++ < 5) console.error(e); } // one bad step never stops the headset drawing
    }
    for (var b = 0; b < before.length; b++) { try { before[b](); } catch (e) { if (errors++ < 5) console.error(e); } }
    renderer.render(scene, camera);
    for (var j = 0; j < after.length; j++) { try { after[j](); } catch (e) { if (errors++ < 5) console.error(e); } } // more passes into the same frame: what's seen through doorways
  });

  // ---------- The headset session ----------
  // A portal's offer of a session is caught by the page's first script (window.__xrSession); otherwise ask on a tap.
  var asking = false, sessionHandlers = { start: [], end: [] };
  function enterVR() {
    if (!navigator.xr || renderer.xr.isPresenting || asking) return Promise.resolve(false);
    asking = true;
    var early = window.__xrSession; window.__xrSession = null;
    return (early || navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] })).then(function (s) {
      s.addEventListener('end', function () { camera.position.set(0, MP.EYE, 0); sessionHandlers.end.forEach(function (f) { f(); }); });
      return renderer.xr.setSession(s).then(function () { camera.position.set(0, 0, 0); sessionHandlers.start.forEach(function (f) { f(); }); return true; });
    }).catch(function (e) { MP.log('no VR session', e); return false; }).finally(function () { asking = false; });
  }
  function onSession(kind, fn) { sessionHandlers[kind].push(fn); }

  MP.R = {
    renderer: renderer, scene: scene, camera: camera, rig: rig, sun: sun, sunDir: sunDir, Batch: Batch,
    onFrame: onFrame, beforeRender: function (fn) { before.push(fn); }, afterRender: function (fn) { after.push(fn); }, status: status, enterVR: enterVR, onSession: onSession, frames: function () { return frameLog; },
    presenting: function () { return renderer.xr.isPresenting; },
    // Drawn once: the sun never moves, so shadows are worked out after a build and then left alone.
    refreshShadows: function () { renderer.shadowMap.needsUpdate = true; }
  };
})();
