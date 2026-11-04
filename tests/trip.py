# The portal round trip between the two apps, served together the way the site serves them (Endless Clay at the root,
# the palace at /memory-palace/): place a portal in Endless Clay, walk through it, arrive in the palace forecourt,
# check walking (moat, stair), open a plan, walk back through the ring and arrive in front of the portal again.
# Usage: python3 tests/trip.py [path to the built Endless Clay app]
import asyncio, subprocess, os, sys, math, json, tempfile
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); PALACE = os.path.abspath(os.path.join(HERE, '..'))
CLAY = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(PALACE, '..', 'endless-clay-app'))
async def wait(pg, cond, secs=60):
    for _ in range(int(secs * 4)):
        try:
            if await pg.evaluate(cond): return True
        except Exception: pass
        await pg.wait_for_timeout(250)
    return False
async def main():
    root = tempfile.mkdtemp(prefix='site-')
    for f in os.listdir(CLAY): os.symlink(os.path.join(CLAY, f), os.path.join(root, f))
    os.symlink(PALACE, os.path.join(root, 'memory-palace'))
    srv = subprocess.Popen(['python3', '-m', 'http.server', '8832'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1); r = {}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            pg = await (await b.new_context(viewport={'width': 1280, 'height': 760})).new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            E = pg.evaluate
            await pg.goto('http://localhost:8832/index.html?debug'); await wait(pg, 'window.kilnworksDebug && kilnworksDebug.portal'); await pg.wait_for_timeout(2500)
            if await pg.is_visible('#helpClose'): await pg.click('#helpClose')
            await E('kilnworksDebug.portal.place()'); await pg.wait_for_timeout(400)
            rec = await E('kilnworksDebug.portal.rec()'); r['portal placed'] = bool(rec)
            h = await E('kilnworksDebug.portal.where()'); fx, fz = -math.sin(h[3]), -math.cos(h[3])
            async with pg.expect_navigation(url='**/memory-palace/**', timeout=30000):
                for k in range(1, 30):
                    if '/memory-palace/' in pg.url: break
                    try: await E(f'kilnworksDebug.tp({h[0] + fx * k * 0.25}, {h[2] + fz * k * 0.25}, {h[3]})')
                    except Exception: break
                    await pg.wait_for_timeout(120)
            r['in palace'] = pg.url
            r['palace ready'] = await wait(pg, 'window.palaceDebug && palaceDebug.ready()', 150)
            await pg.wait_for_timeout(800)
            r['arrived at'] = [round(v, 2) for v in await E('palaceDebug.MP.R.rig.position.toArray()')]
            r['arriving card'] = await E("document.getElementById('card').classList.contains('arriving')")
            r['draw cost'] = await E('palaceDebug.stats()')
            r['intent link'] = await E("palaceDebug.MP.Links.intentUrl('clay', 'via=palace')")
            r['moat blocks'] = await E('palaceDebug.place(12, -3.2, -47, false), palaceDebug.look(Math.PI, 0), palaceDebug.walk(150, 1, 0), palaceDebug.MP.R.rig.position.z < -43.7')
            r['stair climbs'] = await E('palaceDebug.place(0, -3.2, -47, false), palaceDebug.look(Math.PI, 0), palaceDebug.walk(380, 1, 0)[1] > -0.05')
            r['keep blocks'] = await E('palaceDebug.place(-6, 0, -18, false), palaceDebug.look(Math.PI, 0), palaceDebug.walk(240, 1, 0)[2] < -12')
            plan = json.dumps({'rooms': [{'address': a} for a in ['C.W.N1', 'E1.W.N2', 'W2.E.N3', 'nonsense']]}).encode()
            await pg.set_input_files('#planFile', files=[{'name': 'plan.json', 'mimeType': 'application/json', 'buffer': plan}]); await pg.wait_for_timeout(800)
            r['plan'] = await pg.text_content('#status')
            # out through the ring, walking backwards from the arrival spot
            await E('palaceDebug.MP.arrive()')
            async with pg.expect_navigation(url='**/index.html?**', timeout=30000):
                await E('palaceDebug.walk(120, -1, 0)')
            r['home again'] = pg.url
            await wait(pg, 'window.kilnworksDebug && kilnworksDebug.portal'); await pg.wait_for_timeout(3000)
            back = await E('kilnworksDebug.portal.rec()'); r['portal kept'] = bool(back) and rec is not None and back['id'] == rec['id']
            w = await E('kilnworksDebug.portal.where()')
            if back:
                ex, ez = back['p'][0] + math.sin(back['yaw']) * 2.2, back['p'][2] + math.cos(back['yaw']) * 2.2
                r['stands at portal'] = round(math.hypot(w[0] - ex, w[2] - ez), 2)
            # the plan is still there next time the palace opens (kept on the device)
            await pg.goto('http://localhost:8832/memory-palace/index.html?debug&nosw'); await wait(pg, 'window.palaceDebug && palaceDebug.ready()', 150)
            r['plan kept'] = await pg.text_content('#status')
            r['errors'] = errs
            await b.close()
    finally: srv.terminate()
    for k, v in r.items(): print(k, v)
    a = r.get('arrived at') or [9, 9, 9]
    ok = (r['portal placed'] and '/memory-palace/index.html?debug&via=clay' in r['in palace'] and r['palace ready'] and abs(a[0]) < 0.2 and abs(a[2] + 27.4) < 0.3 and r['arriving card']
          and r['intent link'].startswith('intent://noireal-tech.github.io/index.html?via=palace#Intent;scheme=https;package=com.noirealtech.endlessclay;S.browser_fallback_url=')
          and r['moat blocks'] and r['stair climbs'] and r['keep blocks'] and '3 rooms' in r['plan'] and 'via=palace' in r['home again'] and r['portal kept']
          and r.get('stands at portal', 9) < 0.6 and '3 rooms' in (r['plan kept'] or '') and not r['errors'])
    print('TRIP TESTS', 'PASSED' if ok else 'FAILED')
asyncio.run(main())
