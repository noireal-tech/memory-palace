# Memory Palace

A memory palace you walk through in VR on Meta Quest: a castle of your own memories, with a room for every subject.
Its own app, reached from [Endless Clay](https://noireal-tech.github.io/) through a ring portal and back.

Live at **https://noireal-tech.github.io/memory-palace/** (installable; the Quest app is built from `android/`).

## Privacy

This code is public, generic and empty. Your palace plan and everything inside your palace stay on your headset
(IndexedDB). Nothing about your palace is ever written to this repository.

## How it's built

Plain JavaScript, [three.js](https://threejs.org) r158 and WebXR; no build step beyond `node build.js`, which writes the
offline cache list (`sw.js`).

| File | What it does |
| --- | --- |
| `index.html` | The page. Its first script catches a VR session handed over by the portal before anything else loads. |
| `src/util.js` | Noise, sliced work (so the headset keeps drawing), on-device storage. |
| `src/textures.js` | Loads the photographic materials in `textures/` (generated in Runway, then made seamless with relief and roughness maps by `tools/build-textures.py`); falls back to materials painted in code. |
| `src/materials.js` | The material library. |
| `src/render.js` | Renderer, sky, clouds, sunlight and sky light, batching, the frame loop, the VR session. |
| `src/detail.js` | The detail bubble: full-resolution materials only within 25 m of you, standard 1K beyond. |
| `src/world.js` | Where you can stand and what blocks the way; geometry helpers. |
| `src/site.js` | The platform, moat, causeway, stair, forecourt, streets, gardens and hills (the same under every skin). |
| `src/nature.js` | Cherry trees, pines, shrubs, stone lanterns. |
| `src/skins/pagoda.js` | The default exterior skin: a Japanese castle keep. Other skins plug in beside it. |
| `src/links.js` | Going between this app and Endless Clay (an Android app link when installed, a page change in a browser). |
| `src/player.js` | Walking, snap turning, the controllers, flat-screen controls. |
| `src/portal.js` | The ring portal in the forecourt. |
| `src/sound.js` | Spatial sound, all made live: wind, wind chimes at the front door, moat water, the portal's hum, rustling leaves in the nearest trees, evening cicadas, a bush warbler, footsteps that know the ground. |
| `src/interact.js` | Pointing at things in the world (doors, plaques): the right controller's ray and trigger, or a click. |
| `src/rooms.js` | Your rooms from outside: facade modules on the band and row grid, band colours and window shapes, brass plaques, the active tier, doors that stay as you leave them, placeholder rooms furnished only while you're near. |
| `src/naming.js` | Naming rooms: the panel keyboard, speech where the browser supports it, a text box on a flat screen. |
| `src/panel.js` | The hand panel above your left wrist: washi paper in a bamboo frame, brush lettering, Go / Make / Settings faces flipped by tab or by pointing and pushing the stick. |
| `src/app.js` | Start-up, the plan file, the page's card. |

## Tests

    python3 tests/shots.py      # loads it, reports draw cost, takes views into tests/shots/
    python3 tests/grant.py      # VR hand-off from the portal (emulated Quest 3 via IWER)
    python3 tests/trip.py ../endless-clay-app   # the portal round trip with Endless Clay
    python3 tests/detail.py     # the 25 m detail bubble (full resolution only near you)
    python3 tests/sound.py      # spatial sound: starts on a click, chimes, cicadas, footsteps, the Sound switch
    python3 tests/rooms.py      # room facades, doors, placeholder rooms, naming, the active tier, panel faces

## The Quest app

`android/` is a Trusted Web Activity project (package `com.noirealtech.memorypalace`). The **Build Memory Palace APK**
workflow builds and signs it; it needs the repository secrets `ANDROID_KEYSTORE_BASE64` and `ANDROID_KEYSTORE_PASSWORD`
(the same key as Endless Clay). The site lists this app in `/.well-known/assetlinks.json`.

## Licences

three.js (MIT), Bricolage Grotesque and Kaushan Script (OFL): see `licenses/`. IWER (MIT, tests only): `tests/vendor/`.
