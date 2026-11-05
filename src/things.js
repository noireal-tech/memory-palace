/* Memory Palace: things you set out in the Central Hall. Every one can be picked up (grip, or trigger with your hand on
   it), carried, and set down on whatever is under it (the floor, the sand, a stair tread, a landing). Point at one and
   pull the trigger (or click it) to use it: switch it on or off, strike it, turn it. Add more from the hand panel's
   Make face ("Add to the hall"); hold one and the same face offers to put it away. Where they stand and whether
   they're on is kept on this headset.
     Light and motion:  paper lantern · candle · incense · fireflies · bonsai
     Sound:             singing bowl · wind bell · bamboo fountain · koto box
   The four paper lanterns at the garden's corners are the first things in the hall. */
(function () {
  'use strict';
  var MP = window.MP, R = MP.R, W = MP.World, G = MP.Geo;
  var T = MP.Things = {}, list = [], group = null, nextId = 1, mats = null, templates = {};
  T.CATALOG = [
    { kind: 'andon', label: 'Paper lantern' }, { kind: 'candle', label: 'Candle' }, { kind: 'incense', label: 'Incense' },
    { kind: 'fireflies', label: 'Fireflies' }, { kind: 'bonsai', label: 'Bonsai' }, { kind: 'bowl', label: 'Singing bowl' },
    { kind: 'furin', label: 'Wind bell' }, { kind: 'shishi', label: 'Bamboo fountain' }, { kind: 'koto', label: 'Koto box' }];
  var NAME = {}; T.CATALOG.forEach(function (c) { NAME[c.kind] = c.label.toLowerCase(); });

  // ---------- Materials ----------
  function std(o) { return new THREE.MeshStandardMaterial(o); }
  function pool(color, opacity) { // a soft pool of light on whatever it stands on (no real light: cheap on the headset)
    var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), color: new THREE.Color(color), transparent: true, opacity: opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -4 });
  }
  // a copy of a photo material that still gets full resolution nearby, without claiming places in the detail bubble
  var owned = [];
  function own(m) { var c = m.clone(); c.userData = { tile: m.userData.tile }; owned.push([c, m.userData.set]); return c; }
  function makeMats() {
    var M = MP.M, wood = own(M.inTimber);
    var m = {
      wood: wood, brass: M.brass, bronze: M.bronze, gold: M.goldLeaf, stone: own(M.stone), bark: own(M.bark), needles: own(M.needles),
      paperOn: std({ map: M.shoji.map, color: new THREE.Color('#fff6e8'), emissive: new THREE.Color('#ffc983'), emissiveMap: M.shoji.map, emissiveIntensity: 1.7, roughness: 0.9 }),
      paperOff: std({ map: M.shoji.map, color: new THREE.Color('#857b6e'), roughness: 0.95, envMapIntensity: 0.3 }), // unlit paper: dull, in shadow
      warm: pool('#ffb35c', 0.32), small: pool('#ffb35c', 0.24),
      wax: std({ color: new THREE.Color('#f3ead8'), emissive: new THREE.Color('#4a3418'), emissiveIntensity: 0.5, roughness: 0.6 }),
      glaze: std({ color: new THREE.Color('#2a3434'), roughness: 0.45, metalness: 0.05, envMapIntensity: 0.25, emissive: new THREE.Color('#10181a') }),
      ash: std({ color: new THREE.Color('#cfc6b8'), roughness: 1, emissive: new THREE.Color('#2a2622') }),
      stick: std({ color: new THREE.Color('#6b2a1e'), roughness: 0.9, emissive: new THREE.Color('#1c0a06') }),
      ember: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a2a'), toneMapped: false, fog: false }),
      glass: std({ color: new THREE.Color('#d4ece6'), transparent: true, opacity: 0.25, roughness: 0.05, envMapIntensity: 1.3, depthWrite: false }),
      pot: std({ color: new THREE.Color('#6a3626'), roughness: 0.35, envMapIntensity: 0.7, emissive: new THREE.Color('#1e0e08') }),
      soil: std({ color: new THREE.Color('#3a2e22'), roughness: 1, emissive: new THREE.Color('#120e0a') }),
      cloth: std({ color: new THREE.Color('#7d2f24'), roughness: 1, emissive: new THREE.Color('#2a0e0a') }),
      bell: std({ color: new THREE.Color('#a9d8ee'), transparent: true, opacity: 0.6, roughness: 0.08, envMapIntensity: 1.2, depthWrite: false }),
      tanzaku: std({ color: new THREE.Color('#e9d9b8'), roughness: 0.95, side: THREE.DoubleSide, emissive: new THREE.Color('#3a3020') }),
      bamboo: std({ color: new THREE.Color('#7b8440'), roughness: 0.55, envMapIntensity: 0.6, emissive: new THREE.Color('#1e220c') }),
      water: std({ color: new THREE.Color('#203f46'), roughness: 0.05, metalness: 0.1, envMapIntensity: 1.1, emissive: new THREE.Color('#0a1a1e') }),
      lacquer: std({ color: new THREE.Color('#1b120f'), roughness: 0.28, metalness: 0.2, envMapIntensity: 0.9, emissive: new THREE.Color('#0a0605') }),
      koto: std({ color: new THREE.Color('#b98a52'), roughness: 0.6, emissive: new THREE.Color('#3a2612') }),
      string: new THREE.MeshBasicMaterial({ color: new THREE.Color('#f2ead8') })
    };
    var fireMat = function () { // a candle flame: a soft teardrop that flickers
      return new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uSeed: { value: Math.random() * 10 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
        vertexShader: 'varying vec2 vUv; uniform float uTime, uSeed; void main() { vUv = uv; vec3 p = position; float f = sin(uTime * 13.0 + uSeed) * 0.5 + sin(uTime * 7.3 + uSeed * 2.0) * 0.5; p.x += f * 0.004 * uv.y; p.y *= 1.0 + 0.08 * f; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
        fragmentShader: 'varying vec2 vUv; void main() { vec2 q = vUv - vec2(0.5, 0.3); q.x *= 2.2; q.y *= q.y > 0.0 ? 0.9 : 2.0; float d = length(q); float a = smoothstep(0.5, 0.0, d); vec3 c = mix(vec3(1.0, 0.45, 0.1), vec3(1.0, 0.95, 0.75), smoothstep(0.35, 0.0, d)); c = mix(c, vec3(0.3, 0.45, 1.0), smoothstep(0.12, 0.0, vUv.y) * 0.6); gl_FragColor = vec4(c * a, a); }'
      });
    };
    var smokeMat = function () { // incense smoke: thin wisps curling upward
      return new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uSeed: { value: Math.random() * 10 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: [
          'varying vec2 vUv; uniform float uTime, uSeed;',
          'void main() {',
          '  float y = vUv.y, t = uTime * 0.25 + uSeed;',
          '  float x = vUv.x - 0.5 - 0.18 * y * sin(y * 7.0 - t * 3.0) - 0.08 * y * sin(y * 15.0 - t * 5.0 + 1.3);',
          '  float w = 0.012 + 0.09 * y * y;',
          '  float a = smoothstep(w, 0.0, abs(x)) * smoothstep(0.0, 0.06, y) * smoothstep(1.0, 0.45, y);',
          '  a *= 0.55 + 0.45 * sin(y * 23.0 - t * 9.0);',
          '  gl_FragColor = vec4(vec3(0.86, 0.85, 0.83), a * 0.4);',
          '}'].join('\n')
      });
    };
    m.fire = fireMat; m.smoke = smokeMat;
    return m;
  }

  // ---------- Shapes: each kind's fixed parts, merged once and shared by every copy ----------
  function template(kind, fn) {
    if (templates[kind]) return templates[kind];
    var g = new THREE.Group(), b = new MP.R.Batch(g); fn(b); b.flush();
    return (templates[kind] = b.meshes.map(function (m) { return { geo: m.geometry, mat: m.material }; }));
  }
  function cyl(b, mat, x, y0, z, r0, r1, h, seg) { var g = new THREE.CylinderGeometry(r1, r0, h, seg || 20); g.translate(x, y0 + h / 2, z); b.add(mat, g, true); }
  function lathe(b, mat, pts, y, seg) { var g = new THREE.LatheGeometry(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), seg || 32); g.translate(0, y, 0); b.add(mat, g, true); }
  function blobGeo(r, sq, seed, col) { // a flattened foliage pad, coloured for the needles material
    var g = new THREE.IcosahedronGeometry(r, 2), p = g.attributes.position, c = new Float32Array(p.count * 3), rnd = MP.rng(seed);
    for (var i = 0; i < p.count; i++) { var k = 1 + 0.18 * (rnd() - 0.5); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * sq, p.getZ(i) * k); var sh = p.getY(i) > 0 ? 1 : 0.6; c[i * 3] = col[0] * sh; c[i * 3 + 1] = col[1] * sh; c[i * 3 + 2] = col[2] * sh; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals(); return g;
  }
  function limb(b, mat, a, c, r) { G.limb(b, mat, a, c, r, r, 8); }

  // ---------- The kinds ----------
  // shape(b): fixed parts · parts(inst): moving or switching parts · on(inst): show on/off · tick(inst, dt, now)
  // grab: [from, to, radius] the reachable part, as a segment · pick: [w, h, d] the box you point at · use: 'toggle' | 'strike' | 'turn'
  var K = {
    andon: {
      use: 'toggle', grab: [[0, 0.15, 0], [0, 0.9, 0], 0.22], pick: [0.46, 1.0, 0.46],
      shape: function (b) {
        var w = mats.wood; G.box(b, w, -0.2, 0, -0.2, 0.2, 0.12, 0.2);
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) { G.box(b, w, c[0] * 0.17 - 0.025, 0.12, c[1] * 0.17 - 0.025, c[0] * 0.17 + 0.025, 0.92, c[1] * 0.17 + 0.025); });
        G.box(b, w, -0.22, 0.92, -0.22, 0.22, 0.97, 0.22);
      },
      parts: function (t) { t.paper = new THREE.Mesh(geo('paper', function () { return new THREE.BoxGeometry(0.32, 0.66, 0.32); }), mats.paperOn); t.paper.position.y = 0.53; t.group.add(t.paper); addPool(t, mats.warm, 1.7); },
      on: function (t) { t.paper.material = t.on ? mats.paperOn : mats.paperOff; t.pool.visible = t.on; }
    },
    candle: {
      use: 'toggle', grab: [[0, 0.04, 0], [0, 0.9, 0], 0.06], pick: [0.26, 1.0, 0.26],
      shape: function (b) {
        cyl(b, mats.wood, 0, 0, 0, 0.13, 0.12, 0.03); limb(b, mats.brass, [0, 0.03, 0], [0, 0.75, 0], 0.013);
        cyl(b, mats.brass, 0, 0.74, 0, 0.07, 0.075, 0.012); cyl(b, mats.wax, 0, 0.752, 0, 0.024, 0.023, 0.14, 14);
      },
      parts: function (t) {
        t.flameMat = mats.fire(); t.flame = new THREE.Group(); t.flame.position.y = 0.892; t.group.add(t.flame);
        [0, Math.PI / 2].forEach(function (a) { var q = new THREE.Mesh(geo('flame', function () { var g = new THREE.PlaneGeometry(0.05, 0.11); g.translate(0, 0.045, 0); return g; }), t.flameMat); q.rotation.y = a; q.renderOrder = 6; t.flame.add(q); });
        addPool(t, mats.small, 1.0);
      },
      on: function (t) { t.flame.visible = t.on; t.pool.visible = t.on; },
      tick: function (t, dt, now) { t.flameMat.uniforms.uTime.value = now / 1000; if (t.on) t.pool.material.opacity = 0.24; }
    },
    incense: {
      use: 'toggle', grab: [[0, 0.02, 0], [0, 0.1, 0], 0.15], pick: [0.3, 0.42, 0.3],
      shape: function (b) {
        cyl(b, mats.glaze, 0, 0, 0, 0.09, 0.13, 0.09, 24); cyl(b, mats.ash, 0, 0.085, 0, 0.118, 0.118, 0.004, 24);
        limb(b, mats.stick, [0, 0.088, 0], [0.025, 0.36, 0.012], 0.0035);
      },
      parts: function (t) {
        t.ember = new THREE.Mesh(geo('ember', function () { return new THREE.SphereGeometry(0.006, 8, 6); }), mats.ember); t.ember.position.set(0.025, 0.36, 0.012); t.group.add(t.ember);
        t.smokeMat = mats.smoke(); t.smoke = new THREE.Group(); t.smoke.position.copy(t.ember.position); t.group.add(t.smoke);
        [0, Math.PI / 2].forEach(function (a) { var q = new THREE.Mesh(geo('smoke', function () { var g = new THREE.PlaneGeometry(0.26, 0.9); g.translate(0, 0.45, 0); return g; }), t.smokeMat); q.rotation.y = a; q.renderOrder = 7; t.smoke.add(q); });
      },
      on: function (t) { t.ember.visible = t.on; t.smoke.visible = t.on; },
      tick: function (t, dt, now) { if (t.on) t.smokeMat.uniforms.uTime.value = now / 1000; }
    },
    fireflies: {
      use: 'toggle', grab: [[0, 0.04, 0], [0, 0.3, 0], 0.12], pick: [0.28, 0.34, 0.28],
      shape: function (b) { cyl(b, mats.wood, 0, 0, 0, 0.13, 0.13, 0.05); cyl(b, mats.glass, 0, 0.05, 0, 0.1, 0.095, 0.24, 20); cyl(b, mats.wood, 0, 0.29, 0, 0.1, 0.105, 0.02); },
      parts: function (t) {
        var n = 42, pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
        for (var i = 0; i < n; i++) { seed[i * 4] = Math.random(); seed[i * 4 + 1] = Math.random(); seed[i * 4 + 2] = Math.random(); seed[i * 4 + 3] = Math.random(); }
        var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
        t.flyMat = new THREE.ShaderMaterial({
          uniforms: { uTime: { value: 0 }, uScale: { value: 900 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
          vertexShader: [
            'attribute vec4 seed; uniform float uTime, uScale; varying float vA;',
            'void main() {',
            '  float t = uTime * (0.05 + 0.06 * seed.z) + seed.x * 6.283;',
            '  float r = 0.25 + 1.5 * sqrt(seed.y), a = t + sin(t * 2.3 + seed.w * 6.0) * 0.6;',
            '  vec3 p = vec3(cos(a) * r, 0.35 + 1.7 * seed.w + 0.25 * sin(t * 3.1 + seed.x * 9.0), sin(a) * r * 0.85);',
            '  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;',
            '  vA = pow(max(0.0, sin(uTime * (0.8 + seed.z) + seed.y * 20.0)), 3.0);',
            '  gl_PointSize = uScale * 0.04 / -mv.z;',
            '}'].join('\n'),
          fragmentShader: 'varying float vA; void main() { float d = length(gl_PointCoord - 0.5); float a = (smoothstep(0.5, 0.0, d) * 0.6 + smoothstep(0.12, 0.0, d)) * vA; gl_FragColor = vec4(vec3(0.85, 1.0, 0.35) * a * 1.6, a); }'
        });
        t.flies = new THREE.Points(g, t.flyMat); t.flies.frustumCulled = false; t.flies.renderOrder = 6; t.group.add(t.flies);
      },
      on: function (t) { t.flies.visible = t.on; },
      tick: function (t, dt, now) { if (t.on) { t.flyMat.uniforms.uTime.value = now / 1000; t.flyMat.uniforms.uScale.value = R.presenting() ? 1700 : R.renderer.getSize(sz).y * 1.2; } }
    },
    bonsai: {
      use: 'turn', grab: [[0, 0.03, 0], [0, 0.2, 0], 0.3], pick: [0.58, 0.8, 0.44],
      shape: function (b) {
        G.box(b, mats.wood, -0.28, 0.0, -0.2, 0.28, 0.06, 0.2); G.box(b, mats.pot, -0.23, 0.06, -0.15, 0.23, 0.15, 0.15); G.box(b, mats.soil, -0.21, 0.15, -0.13, 0.21, 0.155, 0.13);
        var br = mats.bark; limb(b, br, [0, 0.15, 0], [0.07, 0.33, 0.02], 0.03); limb(b, br, [0.07, 0.33, 0.02], [-0.05, 0.49, 0], 0.024); limb(b, br, [-0.05, 0.49, 0], [0.04, 0.62, -0.02], 0.016);
        limb(b, br, [0.07, 0.33, 0.02], [0.22, 0.38, 0.04], 0.012); limb(b, br, [-0.05, 0.49, 0], [-0.2, 0.52, 0.03], 0.011);
        [[0.22, 0.4, 0.04, 0.11], [-0.2, 0.54, 0.03, 0.1], [0.04, 0.66, -0.02, 0.12], [-0.03, 0.47, -0.08, 0.08]].forEach(function (p, i) {
          var g = blobGeo(p[3], 0.42, 11 + i, [0.25, 0.42, 0.18]); g.translate(p[0], p[1], p[2]); b.add(mats.needles, g, true);
        });
      },
      parts: function (t) { }, on: function () { },
      tick: function (t, dt) { if (t.turn) { t.turn.t = Math.min(1, t.turn.t + dt / 0.5); var e = 1 - Math.pow(1 - t.turn.t, 3); t.group.rotation.y = MP.lerp(t.turn.from, t.turn.to, e); if (t.turn.t >= 1) { t.turn = null; save(); } } }
    },
    bowl: {
      use: 'strike', grab: [[0, 0.03, 0], [0, 0.15, 0], 0.17], pick: [0.4, 0.2, 0.4],
      shape: function (b) {
        cyl(b, mats.cloth, 0, 0, 0, 0.17, 0.15, 0.07, 24);
        lathe(b, mats.bronze, [[0.0, 0.014], [0.1, 0.02], [0.14, 0.055], [0.15, 0.095], [0.16, 0.1], [0.165, 0.095], [0.155, 0.05], [0.12, 0.01], [0.05, 0], [0.0, 0]], 0.07, 36);
        limb(b, mats.wood, [0.22, 0.08, -0.08], [0.22, 0.08, 0.15], 0.011); cyl(b, mats.cloth, 0.22, 0.065, 0.15, 0.022, 0.022, 0.03, 12);
      },
      parts: function () { }, on: function () { }
    },
    furin: {
      use: 'toggle', grab: [[0, 0.05, -0.1], [0, 1.3, -0.1], 0.06], pick: [0.34, 1.4, 0.5],
      shape: function (b) { G.box(b, mats.wood, -0.15, 0, -0.25, 0.15, 0.04, 0.05); limb(b, mats.wood, [0, 0.04, -0.1], [0, 1.36, -0.1], 0.018); limb(b, mats.wood, [0, 1.34, -0.1], [0, 1.34, 0.22], 0.014); },
      parts: function (t) {
        t.swing = new THREE.Group(); t.swing.position.set(0, 1.33, 0.2); t.group.add(t.swing);
        var str = geo('str', function () { return new THREE.BoxGeometry(0.003, 0.08, 0.003); }), s1 = new THREE.Mesh(str, mats.string); s1.position.y = -0.04; t.swing.add(s1);
        var bell = new THREE.Mesh(geo('bell', function () { var g = new THREE.SphereGeometry(0.045, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); g.translate(0, -0.045, 0); return g; }), mats.bell); bell.position.y = -0.08; t.swing.add(bell);
        var s2 = new THREE.Mesh(geo('str2', function () { return new THREE.BoxGeometry(0.002, 0.16, 0.002); }), mats.string); s2.position.y = -0.2; t.swing.add(s2);
        var tz = new THREE.Mesh(geo('tanzaku', function () { return new THREE.PlaneGeometry(0.05, 0.17); }), mats.tanzaku); tz.position.y = -0.36; t.swing.add(tz); t.strip = tz;
        t.next = 0; t.sway = 0;
      },
      on: function (t) { },
      tick: function (t, dt, now) {
        var target = t.on ? 0.25 + 0.75 * MP.Wind.gust : 0; t.sway += (target - t.sway) * Math.min(1, dt * 1.5);
        var s = now / 1000; t.swing.rotation.x = t.sway * 0.12 * Math.sin(s * 2.2 + t.id) ; t.swing.rotation.z = t.sway * 0.08 * Math.sin(s * 1.7 + t.id * 2); t.strip.rotation.y = t.sway * 0.6 * Math.sin(s * 1.3);
        if (t.on && s >= t.next) { if (t.next) MP.Sound.play(t, 'ting', { f: 2500 + (t.id % 4) * 140 + Math.random() * 60, gain: 0.5 + t.sway * 0.7 }); t.next = s + 1.2 + Math.random() * (7 - 5 * t.sway); }
      }
    },
    shishi: {
      use: 'toggle', grab: [[0, 0.05, 0], [0, 0.3, 0], 0.32], pick: [0.9, 0.7, 0.66],
      shape: function (b) {
        cyl(b, mats.stone, 0, 0, 0, 0.3, 0.28, 0.22, 24); cyl(b, mats.water, 0, 0.221, 0, 0.25, 0.25, 0.004, 24);
        limb(b, mats.bamboo, [-0.32, 0, -0.05], [-0.32, 0.64, -0.05], 0.034); limb(b, mats.bamboo, [-0.32, 0.6, -0.05], [-0.08, 0.57, -0.05], 0.019);
        [-0.07, 0.07].forEach(function (z) { limb(b, mats.bamboo, [0.14, 0, z], [0.14, 0.4, z], 0.016); });
        var r = new THREE.IcosahedronGeometry(0.06, 1); r.scale(1, 0.6, 1); r.translate(0.46, 0.03, 0); b.add(mats.stone, r, true);
      },
      parts: function (t) {
        t.rock = new THREE.Group(); t.rock.position.set(0.14, 0.38, 0); t.group.add(t.rock);
        var tube = new THREE.Mesh(geo('tube', function () { var g = new THREE.CylinderGeometry(0.03, 0.03, 0.62, 12); g.rotateZ(Math.PI / 2); g.translate(-0.02, 0, 0); return g; }), mats.bamboo); t.rock.add(tube);
        t.cycle = Math.random() * 4; t.clacked = false;
      },
      on: function (t) { MP.Sound.thingState(t); },
      tick: function (t, dt) { // fills under the spout, tips, empties, swings back and knocks on its stone
        var a = 0.25;
        if (t.on) {
          t.cycle += dt; var c = t.cycle % 8;
          if (c < 6.4) a = MP.lerp(0.25, 0.02, c / 6.4); else if (c < 6.75) a = MP.lerp(0.02, -0.5, (c - 6.4) / 0.35); else if (c < 7.05) a = MP.lerp(-0.5, 0.28, (c - 6.75) / 0.3); else a = MP.lerp(0.28, 0.25, Math.min(1, (c - 7.05) / 0.3));
          if (c >= 7.05 && !t.clacked) { t.clacked = true; MP.Sound.play(t, 'clack'); } if (c < 7) t.clacked = false;
        }
        t.rock.rotation.z = -a;
      }
    },
    koto: {
      use: 'toggle', grab: [[0, 0.02, 0], [0, 0.12, 0], 0.2], pick: [0.4, 0.2, 0.3],
      shape: function (b) {
        G.box(b, mats.lacquer, -0.18, 0.015, -0.12, 0.18, 0.12, 0.12); [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) { G.box(b, mats.lacquer, c[0] * 0.16 - 0.015, 0, c[1] * 0.1 - 0.015, c[0] * 0.16 + 0.015, 0.015, c[1] * 0.1 + 0.015); });
        G.box(b, mats.gold, -0.182, 0.112, -0.122, 0.182, 0.12, -0.112); G.box(b, mats.gold, -0.182, 0.112, 0.112, 0.182, 0.12, 0.122);
        G.box(b, mats.koto, -0.165, 0.118, -0.105, 0.165, 0.121, 0.105);
        for (var k = 0; k < 7; k++) { var z = -0.075 + k * 0.025; G.box(b, mats.string, -0.15, 0.123, z - 0.0012, 0.15, 0.125, z + 0.0012); G.box(b, mats.gold, -0.05 + (k % 3) * 0.04, 0.121, z - 0.006, -0.04 + (k % 3) * 0.04, 0.134, z + 0.006); }
      },
      parts: function (t) {
        t.lid = new THREE.Group(); t.lid.position.set(0, 0.12, -0.12); t.group.add(t.lid);
        var l = new THREE.Mesh(geo('lid', function () { var g = new THREE.BoxGeometry(0.37, 0.025, 0.245); g.translate(0, 0.0125, 0.1225); return g; }), mats.lacquer); t.lid.add(l);
        t.open = 0; t.next = 0; t.step = 4;
      },
      on: function (t) { },
      tick: function (t, dt, now) { // a slow, wandering melody in the hirajoshi scale while the lid is open
        t.open += ((t.on ? 1 : 0) - t.open) * Math.min(1, dt * 4); t.lid.rotation.x = -1.25 * t.open;
        var s = now / 1000, SC = [220, 293.7, 329.6, 349.2, 440, 466.2, 587.3, 659.3, 698.5, 880];
        if (t.on && t.open > 0.9 && s >= t.next) {
          t.step = MP.clamp(t.step + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)], 0, SC.length - 1);
          if (t.next) MP.Sound.play(t, 'pluck', { f: SC[t.step], gain: 0.6 + Math.random() * 0.4 });
          if (Math.random() < 0.2) MP.Sound.play(t, 'pluck', { f: SC[Math.max(0, t.step - 4)], gain: 0.4 });
          t.next = s + [0.45, 0.6, 0.9, 1.2, 1.8, 2.6][Math.floor(Math.random() * 6)];
        }
      }
    }
  };
  var sz = new THREE.Vector2(), geos = {}; function geo(name, make) { return geos[name] || (geos[name] = make()); }
  function addPool(t, mat, r) { t.pool = new THREE.Mesh(geo('pool', function () { var g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g; }), mat); t.pool.scale.set(r * 2, 1, r * 2); t.pool.position.y = 0.012; t.pool.renderOrder = 2; t.group.add(t.pool); }

  // ---------- Placing ----------
  var IN_PAD = 0.35;
  function inside(x, z) { var I = MP.KEEP.IN; return x > I[0] + IN_PAD && x < I[2] - IN_PAD && z > I[1] + IN_PAD && z < I[3] - IN_PAD; }
  function free(x, z, r) { if (!inside(x, z)) return false; var g = W.groundAt(x, z); return g === g && !W.blocked(x, z, g, r); }
  // the nearest spot (from x, z) where something of radius r can stand
  function spot(x, z, r) {
    var I = MP.KEEP.IN; x = MP.clamp(x, I[0] + IN_PAD + 0.01, I[2] - IN_PAD - 0.01); z = MP.clamp(z, I[1] + IN_PAD + 0.01, I[3] - IN_PAD - 0.01);
    if (free(x, z, r)) return [x, z];
    for (var d = 0.1; d < 3; d += 0.1) for (var k = 0; k < 16; k++) { var a = k / 16 * Math.PI * 2, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (free(px, pz, r)) return [px, pz]; }
    return [x, z];
  }
  function settle(t) {
    var e = new THREE.Euler().setFromQuaternion(t.group.quaternion, 'YXZ'), p = spot(t.group.position.x, t.group.position.z, Math.min(0.3, K[t.kind].grab[2] * 0.6));
    t.group.rotation.set(0, e.y, 0);
    t.fall = { x: p[0], z: p[1], y0: t.group.position.y, y1: W.groundAt(p[0], p[1]), t: 0 };
  }

  // ---------- Saving ----------
  var saveTimer = 0;
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(function () { MP.store.set('things', { v: 1, next: nextId, list: list.map(function (t) { var p = t.fall ? [t.fall.x, t.fall.y1, t.fall.z] : t.group.position.toArray(); return { id: t.id, kind: t.kind, at: p.map(function (v) { return Math.round(v * 1000) / 1000; }), ry: Math.round(t.group.rotation.y * 1000) / 1000, on: t.on }; }) }); }, 500); }

  // ---------- One thing ----------
  function make(o) {
    var def = K[o.kind]; if (!def) return null;
    var t = { id: o.id || nextId++, kind: o.kind, on: o.on !== false, group: new THREE.Group() };
    template(o.kind, def.shape).forEach(function (p) { var m = new THREE.Mesh(p.geo, p.mat); m.castShadow = false; m.receiveShadow = true; t.group.add(m); });
    def.parts(t);
    t.anchor = new THREE.Object3D(); t.anchor.position.copy(new THREE.Vector3().fromArray(def.grab[1]).add(new THREE.Vector3().fromArray(def.grab[0])).multiplyScalar(0.5)); t.group.add(t.anchor);
    t.group.position.fromArray(o.at); t.group.rotation.y = o.ry || 0; group.add(t.group);
    // what you point at
    var pk = def.pick, pickBox = new THREE.Mesh(geo('pick' + o.kind, function () { var g = new THREE.BoxGeometry(pk[0], pk[1], pk[2]); g.translate(0, pk[1] / 2, 0); return g; }), hidden);
    t.group.add(pickBox);
    t.target = MP.Interact.add(pickBox, { label: NAME[o.kind], use: function () { T.use(t); } });
    // what you take hold of
    var a = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3(), q = new THREE.Vector3();
    t.item = MP.Grab.add({
      label: NAME[o.kind], reach: 0.15, thing: t,
      at: function (out) { return t.anchor.getWorldPosition(out); },
      near: function (p) {
        t.group.localToWorld(a.fromArray(def.grab[0])); t.group.localToWorld(c.fromArray(def.grab[1])); ab.subVectors(c, a);
        var k = MP.clamp(q.subVectors(p, a).dot(ab) / Math.max(1e-6, ab.lengthSq()), 0, 1); return p.distanceTo(a.addScaledVector(ab, k)) - def.grab[2];
      },
      grab: function (rec) { t.fall = null; t.turn = null; rec.grip.attach(t.group); },
      move: function () { },
      drop: function () { group.attach(t.group); settle(t); }
    });
    def.on(t); list.push(t); MP.Sound.addThing(t);
    return t;
  }
  var hidden = new THREE.MeshBasicMaterial({ visible: false });

  T.use = function (t) {
    var def = K[t.kind];
    if (def.use === 'toggle') { t.on = !t.on; def.on(t); MP.Sound.thingState(t); save(); return t.on ? 'on' : 'off'; }
    if (def.use === 'strike') { MP.Sound.wake(); MP.Sound.play(t, 'strike', { f: 196 + (t.id % 5) * 22 }); return 'struck'; }
    if (def.use === 'turn') { var from = t.group.rotation.y; t.turn = { from: from, to: from + Math.PI / 4, t: 0 }; return 'turned'; }
  };
  // Add a new thing a little in front of you, facing you.
  T.spawn = function (kind) {
    var P = MP.Player, h = P.head(new THREE.Vector3()), d = new THREE.Vector3(); R.camera.getWorldDirection(d); d.y = 0; if (d.lengthSq() < 1e-4) d.set(0, 0, 1); d.normalize();
    var p = spot(h.x + d.x * 1.2, h.z + d.z * 1.2, Math.min(0.3, K[kind].grab[2] * 0.6));
    var t = make({ kind: kind, at: [p[0], W.groundAt(p[0], p[1]), p[1]], ry: Math.atan2(-d.x, -d.z), on: true }); // its front toward you
    save(); return t && t.id;
  };
  T.remove = function (t) {
    MP.Grab.forget(t.item); MP.Grab.remove(t.item); MP.Interact.remove(t.target); MP.Sound.removeThing(t);
    if (t.group.parent) t.group.parent.remove(t.group);
    var i = list.indexOf(t); if (i >= 0) list.splice(i, 1); save();
  };
  // what's in your hand right now, if it's a thing
  T.held = function () { for (var i = 0; i < list.length; i++) if (list[i].item.holder) return list[i]; return null; };
  T.name = function (t) { return NAME[t.kind]; };
  T.inHall = function () { if (!MP.KEEP) return false; var h = MP.Player.head(new THREE.Vector3()), I = MP.KEEP.IN; return h.x > I[0] && h.x < I[2] && h.z > I[1] && h.z < I[3]; };

  T.build = function (g) {
    group = g; mats = makeMats();
    owned.forEach(function (o) { if (o[1]) { MP.Detail.material(o[0], o[1]); delete o[0].userData.set; } }); // swapped with the rest, never noted
    R.onFrame(function (dt, now) {
      if (!group.visible) return; // nothing moves while the hall isn't drawn
      list.forEach(function (t) {
        if (t.fall) { var f = t.fall; f.t = Math.min(1, f.t + dt / 0.22); t.group.position.set(f.x, MP.lerp(f.y0, f.y1, f.t * f.t), f.z); if (f.t >= 1) { t.fall = null; save(); } }
        var def = K[t.kind]; if (def.tick) def.tick(t, dt, now);
      });
    });
    return MP.store.get('things').then(function (s) {
      if (s && Array.isArray(s.list)) { nextId = s.next || 1; s.list.forEach(function (o) { make(o); }); nextId = Math.max(nextId, list.reduce(function (m, t) { return Math.max(m, t.id + 1); }, 1)); }
      else [[-5.6, -5.0], [5.6, -5.0], [-5.6, 5.0], [5.6, 5.0]].forEach(function (p) { make({ kind: 'andon', at: [p[0], MP.KEEP.FLOOR, p[1]], ry: 0, on: true }); }); // the garden's four lanterns
    });
  };
  T.report = function () { return list.map(function (t) { var p = t.group.getWorldPosition(new THREE.Vector3()); return { id: t.id, kind: t.kind, on: t.on, at: [+p.x.toFixed(2), +p.y.toFixed(3), +p.z.toFixed(2)], held: !!t.item.holder }; }); };
  T.find = function (id) { return list.filter(function (t) { return t.id === id; })[0] || null; };
})();
