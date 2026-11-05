/* Memory Palace: the Central Hall, inside the keep's gate. Its middle is the zen garden (garden.js); here are the
   rest of its furnishings:
   - the cascade at the exact centre of the garden: stacked stones with water running down from one to the next into a
     round stone basin (its sound is in sound.js);
   - the zigzag stair on the back (north) wall, facing you as you come in: a flight up along the wall, a landing,
     a flight back the other way to the stairwell and a closed sliding door at the Review Hall's floor level;
     straight flights and flat landings, easy on the stomach and good teleport spots;
   - a wooden bench by the garden: point at it and pull the trigger to sit, facing the garden or away from it (you
     face the side you were standing on); move the stick to stand;
   - paper floor lanterns at the garden's corners. */
(function () {
  'use strict';
  var MP = window.MP, R = MP.R, G = MP.Geo, W = MP.World;
  var H = MP.Hall = {};
  // the cascade's basin, which the garden keeps its sand out of
  H.BASIN = { x: 0, z: 0, r: 1.18 };
  H.BENCH = { x: 6.4, z0: -2.2, z1: -0.2, seat: 0.46 };

  // ---------- The zigzag stair ----------
  var ST = H.STAIR = { laneA: [8.6, 10.57], laneB: [7.4, 8.6], x0: -3.3, x1: 1.8, run: 0.3, n: 18, mid: 3.6 };
  function stair(b) {
    var M = MP.M, K = MP.KEEP, F = K.FLOOR, U = K.UPPER, A = ST.laneA, B = ST.laneB, run = ST.run, n = ST.n, r1 = (ST.mid - F) / n, r2 = (U - ST.mid) / n;
    // flight 1: solid steps up along the back wall, rising east
    for (var k = 1; k < n; k++) G.box(b, M.inTimber, ST.x0 + (k - 1) * run, 0, A[0], ST.x0 + k * run, F + k * r1, A[1]);
    W.surface(ST.x0, A[0], ST.x1, A[1], function (x) { return F + Math.min(n - 1, Math.floor((x - ST.x0) / run) + 1) * r1; }, 'hall', true);
    // the east landing: a deck on posts across both lanes
    var LX = [ST.x1, ST.x1 + 2.4];
    G.box(b, M.inTimber, LX[0], ST.mid - 0.16, B[0], LX[1], ST.mid, A[1]);
    [[LX[0] + 0.1, B[0] + 0.1], [LX[1] - 0.1, B[0] + 0.1], [LX[1] - 0.1, A[1] - 0.1]].forEach(function (p) { G.box(b, M.inTimber, p[0] - 0.1, F, p[1] - 0.1, p[0] + 0.1, ST.mid - 0.16, p[1] + 0.1); W.solid(p[0] - 0.14, p[1] - 0.14, p[0] + 0.14, p[1] + 0.14, ST.mid, 'hall'); });
    W.surface(LX[0], B[0], LX[1], A[1], ST.mid, 'hall', true);
    // flight 2: open treads on two stringers, rising west, back over the first flight's lane
    for (k = 1; k < n; k++) {
      var xa = ST.x1 - k * run, xb = ST.x1 - (k - 1) * run, y = ST.mid + k * r2;
      G.box(b, M.inTimber, xa - 0.02, y - 0.06, B[0], xb, y, B[1]);            // tread
      G.box(b, M.inTimber, xb - 0.03, y - r2, B[0] + 0.05, xb, y - 0.06, B[1] - 0.05); // riser
    }
    [B[0], B[1] - 0.08].forEach(function (z) { G.limb(b, M.inTimber, [ST.x1, ST.mid - 0.25, z + 0.04], [ST.x0, U - 0.25, z + 0.04], 0.06, 0.06, 6); });
    W.surface(ST.x0, B[0], ST.x1, B[1], function (x) { return ST.mid + Math.min(n - 1, Math.floor((ST.x1 - x) / run) + 1) * r2; }, 'hall', true);
    // the top landing, in the stairwell, in front of the sliding door
    var Hh = K.HOLE; G.box(b, M.inTimber, Hh[0], U - 0.16, B[0], ST.x0, U, B[1]);
    W.surface(Hh[0], B[0], ST.x0, B[1], U, 'hall', true);
    // between the lanes, a panelled partition; along the open side, a handrail on posts
    G.box(b, M.inTimber, ST.x0, F, A[0] - 0.04, ST.x1, F + 1.0, A[0]);
    [[A[0] - 0.035, -1], [A[0] - 0.005, 1]].forEach(function (f) { // plaster above the panelling, up to the second flight, seen from either lane
      var z = f[0]; G.tris(b, M.inWall, [ST.x0, F + 1.0, z, ST.x1, F + 1.0, z, ST.x1, ST.mid - 0.25, z, ST.x0, F + 1.0, z, ST.x1, ST.mid - 0.25, z, ST.x0, U - 0.25, z], [0, 0, f[1]]);
    });
    W.solid(ST.x0, A[0] - 0.05, ST.x1, A[0] + 0.03, 30, 'hall');
    function rail(a, c, ya, yc) { // posts and a rail from a to c ([x, z]), the treads rising from ya to yc
      var len = Math.hypot(c[0] - a[0], c[1] - a[1]), m = Math.max(1, Math.round(len / 1.2));
      for (var i = 0; i <= m; i++) { var t = i / m, x = MP.lerp(a[0], c[0], t), z = MP.lerp(a[1], c[1], t), yy = MP.lerp(ya, yc, t); G.box(b, M.inTimber, x - 0.04, yy, z - 0.04, x + 0.04, yy + 0.92, z + 0.04); }
      G.limb(b, M.inTimber, [a[0], ya + 0.95, a[1]], [c[0], yc + 0.95, c[1]], 0.035, 0.035, 8);
      W.solid(Math.min(a[0], c[0]) - 0.05, Math.min(a[1], c[1]) - 0.05, Math.max(a[0], c[0]) + 0.05, Math.max(a[1], c[1]) + 0.05, Math.max(ya, yc) + 1.0, 'hall', Math.min(ya, yc) - 0.6); // up to the rail: arcs can pass over
    }
    rail([ST.x1, B[0] + 0.04], [ST.x0, B[0] + 0.04], ST.mid + r2, U);
    rail([LX[0], B[0] + 0.04], [LX[1] - 0.04, B[0] + 0.04], ST.mid, ST.mid);
    rail([LX[1] - 0.04, B[0] + 0.04], [LX[1] - 0.04, A[1]], ST.mid, ST.mid);
  }

  // ---------- The cascade ----------
  // A flat river stone: a squashed, roughened ball, its top a little domed and tipped.
  function stone(b, mat, cx, y0, cz, r, h, seed) {
    var g = new THREE.IcosahedronGeometry(1, 3), p = g.attributes.position;
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
      var k = 1 + 0.08 * Math.sin(a * 3 + seed) + 0.05 * Math.sin(a * 5 + seed * 1.7) + 0.04 * Math.sin(y * 5 + seed);
      var yy = y < 0 ? y * 0.75 : y; // flatter underneath, where it rests on the stone below
      p.setXYZ(i, cx + x * r * k, y0 + h * 0.5 + yy * h * 0.5 + x * 0.03 * Math.sin(seed), cz + z * r * k * 0.9);
    }
    g.computeVertexNormals(); b.add(mat, g, true);
  }
  var falls = [], pool = null, fallMat = null;
  H.TIERS = [ // [x, z, radius, top] of each stone, the bottom one first; water spills off each toward the next
    [0.06, 0.02, 0.74, 0.62], [-0.1, 0.07, 0.56, 0.9], [0.05, -0.04, 0.42, 1.14], [-0.06, 0.03, 0.3, 1.34], [0.02, 0.0, 0.17, 1.46]];
  function cascade(b, group) {
    var M = MP.M, F = MP.KEEP.FLOOR, BS = H.BASIN, WATER = 0.34;
    // the basin: a ring of stone round a pool
    var ring = new THREE.CylinderGeometry(BS.r, BS.r + 0.06, 0.42, 40, 1, true); ring.translate(0, F + 0.21, 0); b.add(M.stone, ring, true);
    var inner = new THREE.CylinderGeometry(BS.r - 0.16, BS.r - 0.16, 0.42, 40, 1, true); inner.scale(-1, 1, 1); inner.translate(0, F + 0.21, 0); b.add(M.stone, inner, true);
    var lip = new THREE.RingGeometry(BS.r - 0.16, BS.r, 40, 1); lip.rotateX(-Math.PI / 2); lip.translate(0, F + 0.42, 0); b.add(M.stone, lip, true);
    W.solid(-BS.r, -BS.r, BS.r, BS.r, 2, 'hall');
    // the pool: dark clear water whose surface drifts
    var nm = M.water.normalMap.clone(); nm.wrapS = nm.wrapT = THREE.RepeatWrapping; nm.repeat.set(3, 3); nm.needsUpdate = true;
    var pm = new THREE.MeshStandardMaterial({ color: new THREE.Color('#1d3e46'), roughness: 0.04, metalness: 0.1, normalMap: nm, normalScale: new THREE.Vector2(0.45, 0.45), envMapIntensity: 1.1, emissive: new THREE.Color('#0c2328') });
    pool = new THREE.Mesh(new THREE.CircleGeometry(BS.r - 0.15, 40), pm); pool.rotation.x = -Math.PI / 2; pool.position.y = F + WATER; group.add(pool);
    // the stack, each stone darkened where it's wet
    var wet = M.stone.clone(); wet.userData = {}; MP.Detail.material(wet, M.stone.userData.set); // (a copy needs signing up for full resolution itself)
     wet.color = new THREE.Color('#8a8a84'); wet.roughness = 0.78; wet.envMapIntensity = 0.45; wet.emissive = new THREE.Color('#2c2b28'); wet.emissiveMap = M.stone.map; wet.emissiveIntensity = 0.6;
    var prevTop = F + WATER - 0.1;
    H.TIERS.forEach(function (t, i) { stone(b, wet, t[0], prevTop - 0.04, t[1], t[2], t[3] - prevTop + 0.04, i * 1.7 + 0.4); prevTop = t[3]; });
    // falling water: ribbons from each stone's lip to the stone (or pool) below, round the stack in turn
    fallMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'uniform float uTime; varying vec2 vUv;',
        'float h(float n) { return fract(sin(n) * 43758.5453); }',
        'void main() {',
        '  float x = vUv.x, y = vUv.y + uTime * 1.6;',
        '  float streak = 0.0; for (int i = 0; i < 4; i++) { float fi = float(i); float c = h(fi * 7.1 + floor(y * 3.0)); streak += smoothstep(0.08, 0.0, abs(x - (0.15 + 0.7 * h(fi * 3.3)) + 0.04 * sin(y * 9.0 + fi))) * (0.5 + 0.5 * c); }',
        '  float edge = smoothstep(0.0, 0.18, x) * smoothstep(1.0, 0.82, x) * smoothstep(0.0, 0.08, vUv.y);',
        '  vec3 col = mix(vec3(0.55, 0.72, 0.76), vec3(0.95, 0.98, 1.0), clamp(streak, 0.0, 1.0));',
        '  gl_FragColor = vec4(col, edge * (0.5 + 0.45 * clamp(streak, 0.0, 1.0)));',
        '}'].join('\n')
    });
    for (var i = H.TIERS.length - 1; i >= 0; i--) {
      var t = H.TIERS[i], below = i > 0 ? H.TIERS[i - 1] : null, a = i * 2.2 + 0.6, dx = Math.cos(a), dz = Math.sin(a);
      var x0 = t[0] + dx * t[2] * 0.92, z0 = t[1] + dz * t[2] * 0.92, y0 = t[3] + 0.005, y1 = below ? below[3] + 0.01 : F + WATER;
      var reach = below ? Math.min(below[2] * 0.8, t[2] * 0.92 + 0.1) : t[2] * 0.92 + 0.14;
      var x1 = t[0] + dx * reach, z1 = t[1] + dz * reach, w = 0.2 + t[2] * 0.2;
      // a curved ribbon: out over the lip, then down
      var g = G.sheet(function (u, v) { var px = -dz * (u - 0.5) * w, pz = dx * (u - 0.5) * w, k = Math.sin(v * Math.PI / 2); return [MP.lerp(x0, x1, k) + px, MP.lerp(y0, y1, v * v), MP.lerp(z0, z1, k) + pz]; }, 4, 8, [1, 1]);
      var m = new THREE.Mesh(g, fallMat); m.renderOrder = 3; group.add(m); falls.push(m);
      // a thin sheen of water over each stone's top
      var sheen = new THREE.Mesh(new THREE.CircleGeometry(t[2] * 0.5, 24), pm); sheen.rotation.x = -Math.PI / 2; sheen.position.set(t[0], t[3] - 0.012, t[1]); group.add(sheen); // just the wet middle of its domed top
    }
    R.onFrame(function (dt, now) { fallMat.uniforms.uTime.value = now / 1000; nm.offset.set(Math.sin(now / 4100) * 0.2, now / 9000); });
  }

  // ---------- The bench ----------
  function bench(b, group) {
    var M = MP.M, F = MP.KEEP.FLOOR, B = H.BENCH, x = B.x, seat = B.seat;
    G.box(b, M.inTimber, x - 0.24, seat - 0.07, B.z0, x + 0.24, seat, B.z1);
    [B.z0 + 0.15, B.z1 - 0.15].forEach(function (z) { G.box(b, M.inTimber, x - 0.2, F, z - 0.06, x + 0.2, seat - 0.07, z + 0.06); });
    W.solid(x - 0.26, B.z0, x + 0.26, B.z1, 1.0, 'hall');
    // the seat is something you can point at
    var pick = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, B.z1 - B.z0), new THREE.MeshBasicMaterial({ visible: false }));
    pick.position.set(x, seat - 0.04, (B.z0 + B.z1) / 2); group.add(pick);
    MP.Interact.add(pick, { label: 'Sit on the bench', use: function (hit) { H.sit(hit && hit.point ? hit.point.z : null); } });
  }
  // Sit facing the side you're standing on: the garden's (west) side faces the garden, the other side faces away.
  H.sit = function (atZ) {
    var B = H.BENCH, h = MP.Player.head(new THREE.Vector3()), garden = h.x < B.x;
    var z = MP.clamp(atZ == null ? h.z : atZ, B.z0 + 0.3, B.z1 - 0.3);
    MP.Player.sit(B.x + (garden ? -0.12 : 0.12), z, garden ? Math.PI / 2 : -Math.PI / 2, MP.KEEP.FLOOR + B.seat + 0.74);
    return garden ? 'garden' : 'away';
  };

  // ---------- Floor lanterns ----------
  function lanterns(b) {
    var M = MP.M, F = MP.KEEP.FLOOR;
    [[-5.6, -5.0], [5.6, -5.0], [-5.6, 5.0], [5.6, 5.0]].forEach(function (p) {
      G.box(b, M.inTimber, p[0] - 0.2, F, p[1] - 0.2, p[0] + 0.2, F + 0.12, p[1] + 0.2);
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) { G.box(b, M.inTimber, p[0] + c[0] * 0.17 - 0.025, F + 0.12, p[1] + c[1] * 0.17 - 0.025, p[0] + c[0] * 0.17 + 0.025, F + 0.92, p[1] + c[1] * 0.17 + 0.025); });
      G.box(b, M.shoji, p[0] - 0.16, F + 0.2, p[1] - 0.16, p[0] + 0.16, F + 0.86, p[1] + 0.16);
      G.box(b, M.inTimber, p[0] - 0.22, F + 0.92, p[1] - 0.22, p[0] + 0.22, F + 0.97, p[1] + 0.22);
      W.solid(p[0] - 0.25, p[1] - 0.25, p[0] + 0.25, p[1] + 0.25, 1.0, 'hall');
    });
  }

  H.build = function (group) {
    var b = new MP.R.Batch(group);
    stair(b); cascade(b, group); bench(b, group); lanterns(b);
    b.flush();
  };
})();
