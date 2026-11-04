/* Memory Palace: the ring portal in the forecourt, the way back to Endless Clay. A bronze ring on a stone plinth,
   its surface rippling like water; walk through it to travel. */
(function () {
  'use strict';
  var MP = window.MP, G = MP.Geo;
  var RING = MP.RING = { x: 0, y: 1.95, z: -29.6, r: 1.42 };
  var surf, prevSide = null, travelling = false, waitingSince = 0;

  MP.Portal = {
    build: function (group) {
      var M = MP.M, b = new MP.R.Batch(group);
      var g = new THREE.TorusGeometry(RING.r + 0.1, 0.15, 18, 80); g.translate(RING.x, RING.y, RING.z); b.add(M.bronze, g, true);
      var g2 = new THREE.TorusGeometry(RING.r + 0.27, 0.035, 8, 80); g2.translate(RING.x, RING.y, RING.z); b.add(M.gold, g2, true);
      G.box(b, M.stone, -2.2, 0, RING.z - 0.9, 2.2, 0.3, RING.z + 0.9); G.box(b, M.stone, -1.7, 0.3, RING.z - 0.45, 1.7, 0.5, RING.z + 0.45);
      [-1, 1].forEach(function (s) { G.box(b, M.bronze, s * (RING.r + 0.08) - 0.12, 0.5, RING.z - 0.12, s * (RING.r + 0.08) + 0.12, RING.y - 0.6, RING.z + 0.12); });
      MP.World.solid(-2.2, RING.z - 0.9, -RING.r + 0.1, RING.z + 0.9, 0.3); MP.World.solid(RING.r - 0.1, RING.z - 0.9, 2.2, RING.z + 0.9, 0.3);
      b.flush();
      surf = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } }, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false,
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: [
          'uniform float uTime; varying vec2 vUv;',
          'void main() {',
          '  vec2 p = vUv * 2.0 - 1.0; float r = length(p);',
          '  float w = sin(r * 24.0 - uTime * 2.6) * 0.5 + sin(r * 10.0 + uTime * 1.5 + p.x * 3.0) * 0.3 + sin((p.x - p.y) * 7.0 - uTime * 2.0) * 0.2;',
          '  vec3 c = mix(vec3(0.03, 0.17, 0.22), vec3(0.42, 0.80, 0.86), 0.5 + 0.5 * w) + smoothstep(0.72, 1.0, r) * vec3(0.5, 0.82, 0.92) + pow(max(w, 0.0), 6.0) * 0.55;',
          '  gl_FragColor = vec4(c, (1.0 - smoothstep(0.96, 1.0, r)) * 0.94);',
          '}'].join('\n')
      });
      var disc = new THREE.Mesh(new THREE.CircleGeometry(RING.r, 64), surf); disc.position.set(RING.x, RING.y, RING.z); disc.renderOrder = 2; group.add(disc);
      // a bronze plate on the plinth: where this ring leads
      var c = document.createElement('canvas'); c.width = 512; c.height = 128; var x = c.getContext('2d');
      x.fillStyle = '#6a4f2e'; x.fillRect(0, 0, 512, 128); x.strokeStyle = '#b08d53'; x.lineWidth = 8; x.strokeRect(6, 6, 500, 116);
      x.fillStyle = '#f2dfb6'; x.font = '600 56px "Bricolage Grotesque", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('Endless Clay', 256, 66);
      var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      var plate = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshStandardMaterial({ map: t, metalness: 0.6, roughness: 0.4 }));
      plate.position.set(0, 0.4, RING.z - 0.46); plate.rotation.y = Math.PI; group.add(plate);
      var plate2 = plate.clone(); plate2.position.z = RING.z + 0.46; plate2.rotation.y = 0; group.add(plate2);
      MP.R.onFrame(tick);
    },
    travel: travel, check: function () { check(performance.now()); },
    reset: function () { travelling = false; prevSide = null; }
  };

  function travel() {
    if (travelling) return; travelling = true; waitingSince = performance.now();
    MP.R.status('Opening Endless Clay…', true);
    MP.saveState && MP.saveState();
    MP.Links.go('clay', 'via=palace');
  }
  function tick(dt, now) {
    if (surf) surf.uniforms.uTime.value = now / 1000;
    if (!MP.Player.enabled) return;
    check(now);
  }
  function check(now) {
    var h = MP.Player.head(new THREE.Vector3()), side = h.z > RING.z ? 1 : -1;
    var inside = Math.hypot(h.x - RING.x, (h.y - RING.y) * 0.8) < RING.r && Math.abs(h.z - RING.z) < 1.2;
    if (prevSide !== null && side !== prevSide && inside) travel();
    prevSide = Math.abs(h.z - RING.z) < 1.2 ? side : null;
    // Still here a few seconds after setting off (the headset may want a press to switch apps): ask for one.
    if (travelling && now - waitingSince > 3500) { MP.R.status('Pull the trigger to go to Endless Clay', true); MP.awaitTrigger = true; travelling = false; }
  }
})();
