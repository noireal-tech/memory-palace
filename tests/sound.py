# Spatial sound: after a click the sound starts; the wind is heard; striking the chimes at the front door rings
# around their notes; cicadas call in the chirp band; footsteps know the ground; the chimes are placed at the door and the listener follows your head. Takes a close-up of the chimes.
import asyncio, subprocess, os
from playwright.async_api import async_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
async def main():
    srv = subprocess.Popen(['python3', '-m', 'http.server', '8835'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1); r = {}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=user-gesture-required'])
            pg = await (await b.new_context(viewport={'width': 1000, 'height': 640})).new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and '404' not in m.text else None)
            await pg.goto('http://localhost:8835/index.html?debug&nosw')
            for _ in range(400):
                await pg.wait_for_timeout(250)
                if await pg.evaluate('window.palaceDebug && palaceDebug.ready()'): break
            r['before a click'] = await pg.evaluate('palaceDebug.sound()')
            await pg.mouse.click(500, 200); await pg.wait_for_timeout(1500)
            r['after a click'] = await pg.evaluate('palaceDebug.sound()')
            await pg.evaluate('palaceDebug.MP.Sound.hushCicadas(60)')  # the cicadas call at random: keep them back until the test calls them
            r['wind level'] = await pg.evaluate('palaceDebug.MP.Sound.level()')
            await pg.evaluate('palaceDebug.place(2.95, 1.4, -14.5, true); palaceDebug.look(Math.PI, 0.35)')  # stand at the door, look up at the chimes
            await pg.evaluate('palaceDebug.MP.Sound.strikeAll()'); await pg.wait_for_timeout(300)
            rings = []  # the tubes are struck one after another: keep the loudest moment
            for _ in range(6): rings.append(await pg.evaluate('palaceDebug.MP.Sound.level()')); await pg.wait_for_timeout(150)
            r['chimes ringing'] = max(rings, key=lambda x: x['chimeBandDb'])
            await pg.evaluate("document.getElementById('card').hidden = true"); await pg.wait_for_timeout(400)
            os.makedirs(os.path.join(ROOT, 'tests', 'shots'), exist_ok=True)
            await pg.screenshot(path=os.path.join(ROOT, 'tests', 'shots', 'chimes.png'))
            r['chime and ear'] = await pg.evaluate("""(() => { const MP = palaceDebug.MP, v = new THREE.Vector3(); let pan = null;
              MP.R.scene.traverse(o => { if (o.panner && o.parent && o.parent.children.some(c => c.isGroup)) pan = o; });
              const l = MP.R.camera.children.find(c => c.type === 'AudioListener'); l.getWorldPosition(v);
              return { ear: v.toArray().map(x => +x.toFixed(2)), model: pan && pan.panner.panningModel }; })()""")
            # chimes ring a long while and one overtone sits in the cicadas' range: rest the clapper and let them die away first
            await pg.evaluate('palaceDebug.MP.Sound.hushChimes(60)')
            # stand a few metres from the first cicada pine (the far ring of pines, well away from the moat's water)
            await pg.evaluate("(() => { const p = palaceDebug.MP.Nature.trees.filter(t => t.kind === 'pine')[0], d = Math.hypot(p.x, p.z), k = (d - 8) / d; palaceDebug.place(p.x * k, p.y, p.z * k, true); })()")
            for _ in range(3): await pg.screenshot(); await pg.wait_for_timeout(400)  # headless pages draw only when asked: a frame moves the ear
            r['cicadas quiet'] = await pg.evaluate('palaceDebug.MP.Sound.level()')
            await pg.evaluate('palaceDebug.MP.Sound.cicadaNow()'); await pg.wait_for_timeout(900)
            r['cicadas calling'] = await pg.evaluate('palaceDebug.MP.Sound.level()')
            r['surfaces'] = await pg.evaluate("[[0,-20],[0,-38],[30,10],[-12,-25],[0,-70]].map(p => palaceDebug.MP.Sound.surfaceAt(p[0], p[1]))")
            r['trees heard'] = await pg.evaluate('palaceDebug.MP.Nature.trees.length')
            r['toggle off'] = await pg.evaluate('palaceDebug.MP.Sound.toggle()'); await pg.wait_for_timeout(1200)
            r['level when off'] = await pg.evaluate('palaceDebug.MP.Sound.level()')
            await pg.evaluate('palaceDebug.MP.Sound.toggle()')
            r['errors'] = errs
            await b.close()
    finally: srv.terminate()
    for k, v in r.items(): print(k, v)
    ring = r['chimes ringing'] or {}
    ok = (not r['before a click']['ready'] and r['after a click']['ready'] and r['after a click']['state'] == 'running' and (r['wind level'] or {}).get('rms', 0) > 0.001
          and ring.get('chimeBandDb', -999) > (r['wind level'] or {}).get('chimeBandDb', 0) + 10 and r['chime and ear']['model'] == 'HRTF'
          and r['cicadas calling']['cicadaBandDb'] > r['cicadas quiet']['cicadaBandDb'] + 6 and r['surfaces'] == ['stone', 'stone', 'gravel', 'grass', 'grass'] and r['trees heard'] > 10
          and r['toggle off'] is False and (r['level when off'] or {}).get('rms', 1) < 0.0005 and not r['errors'])
    print('SOUND TESTS', 'PASSED' if ok else 'FAILED')
asyncio.run(main())
