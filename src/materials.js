/* Memory Palace: the material library, made once the painted textures are ready. `tile` is the size in metres one
   copy of a texture covers when its UVs are worked out from world position. */
(function () {
  'use strict';
  var MP = window.MP, M = MP.M = {};
  function std(o) { return new THREE.MeshStandardMaterial(o); }
  function tex(t, tile, o) {
    var m = std(Object.assign({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, envMapIntensity: 0.65 }, o || {}));
    m.userData.tile = tile; if (MP.Detail) MP.Detail.material(m, t); return m;
  }
  // A photographic set says how many metres one copy covers; use that for world-mapped surfaces.
  function tileOf(t, fallback) { return t && t.tile ? [t.tile, t.tile] : fallback; }
  function repeat(t, r) { ['map', 'normalMap', 'roughnessMap'].forEach(function (k) { if (t[k]) t[k].repeat.set(r, r); }); }
  MP.makeMaterials = function (T) {
    M.stone = tex(T.stone, tileOf(T.stone, [3.4, 3.4]));
    M.paving = tex(T.paving, tileOf(T.paving, [6, 6]), T.paving.photo ? { color: new THREE.Color('#d6d2cb') } : {});
    M.plaster = tex(T.plaster, tileOf(T.plaster, [3, 3]));
    M.trim = tex(T.plaster, tileOf(T.plaster, [3, 3]), { color: new THREE.Color('#fbf8f1') });           // white plastered eave edges
    M.timber = tex(T.timber, tileOf(T.timber, [1.6, 1.6]));
    M.eave = tex(T.timber, [1.2, 1.2], { color: new THREE.Color(T.timber.photo ? '#c79a78' : '#9a6a48') }); // rafters under the eaves
    if (T.roof.tile) repeat(T.roof, 2.2 / T.roof.tile);   // roof sheets are laid out at one copy per 2.2 m
    // a photographed glazed roof already carries its sheen; keep the sky's reflection modest so it reads dark grey, not blue
    M.roof = tex(T.roof, null, T.roof.photo ? { color: new THREE.Color('#b4b6ba'), envMapIntensity: 0.7 } : { envMapIntensity: 1.1 });
    M.ridge = tex(T.roof, [1.4, 1.4], { envMapIntensity: 1.1 });
    M.gravel = tex(T.gravel, tileOf(T.gravel, [3, 3]), T.gravel.photo ? { color: new THREE.Color('#cbc6bc') } : {});
    M.grass = tex(T.grass, tileOf(T.grass, [8, 8])); M.grass.userData.castShadow = false;
    if (T.bark.photo) repeat(T.bark, 2);
    M.bark = tex(T.bark, null); M.bark.userData.tile = null;
    M.window = tex(T.window, null); M.window.userData.castShadow = false;
    M.gate = tex(T.gate, null); M.gate.userData.castShadow = false;
    M.shoji = tex(T.shoji, null, { emissive: new THREE.Color(1, 0.8, 0.52), emissiveMap: T.shoji.map, emissiveIntensity: 0.22 }); M.shoji.userData.castShadow = false;
    M.doorLeaf = tex(T.gate, null); M.doorLeaf.userData.castShadow = false;
    M.shutter = tex(T.timber, [1.2, 1.2], { color: new THREE.Color('#8a7a6c') }); M.shutter.userData.tile = null;
    M.doorway = std({ color: new THREE.Color('#1c1611'), roughness: 0.95, envMapIntensity: 0.2 }); M.doorway.userData.castShadow = false; // an open door seen from afar
    M.brass = std({ color: new THREE.Color('#c79a4b'), metalness: 0.9, roughness: 0.35 });
    // lit from within: the placeholder rooms' surfaces glow softly so they read as lamp-lit, without real lights
    M.inWall = tex(T.plaster, tileOf(T.plaster, [3, 3]), { color: new THREE.Color('#e9e1d2'), emissive: new THREE.Color('#5a4a38'), emissiveMap: T.plaster.map, emissiveIntensity: 0.55 });
    M.inFloor = tex(T.paving, tileOf(T.paving, [6, 6]), { color: new THREE.Color('#e6d6bc'), emissive: new THREE.Color('#6e5a42'), emissiveMap: T.paving.map, emissiveIntensity: 0.6, envMapIntensity: 0.3 }); // a pale stone floor
    M.gold = std({ color: new THREE.Color('#d8b25a'), metalness: 1, roughness: 0.3 });
    M.goldLeaf = std({ color: new THREE.Color('#c9a24a'), metalness: 0.85, roughness: 0.42, envMapIntensity: 1.2 });
    M.bronze = std({ color: new THREE.Color('#6f5233'), metalness: 1, roughness: 0.38 });
    M.verdigris = std({ color: new THREE.Color('#5a9a86'), metalness: 0.35, roughness: 0.55 });
    M.leaf = std({ vertexColors: true, roughness: 0.82, envMapIntensity: 0.5 });
    // tree crowns wear a foliage photo when there is one; the per-vertex colour then only shades it (darker beneath)
    function foliage(t) { if (!t) return M.leaf; var m = std({ map: t.map, normalMap: t.normalMap, roughness: 0.85, vertexColors: true, envMapIntensity: 0.5 }); m.userData.photo = true; MP.Detail.material(m, t); return m; }
    M.blossom = foliage(T.blossom); M.needles = foliage(T.pine);
    M.hills = std({ vertexColors: true, roughness: 1, envMapIntensity: 0.4, side: THREE.DoubleSide }); M.hills.userData.castShadow = false; M.hills.userData.receiveShadow = false;
    T.water.normalMap.repeat.set(1, 1);
    M.water = std({ color: new THREE.Color('#14303a'), roughness: 0.04, metalness: 0.15, normalMap: T.water.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 1.3 });
    M.water.userData.tile = [12, 12]; M.water.userData.castShadow = false;
    return M;
  };
})();
