# The detail bubble: with stand-in photographic textures (made up here), full resolution loads only for materials
# with a surface within 25 m of you, and is released when you walk away.
import asyncio, subprocess, os, io, json
from PIL import Image
import numpy as np
from playwright.async_api import async_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
def png(size, seed):
    r = np.random.default_rng(seed); a = (r.random((size, size, 3)) * 90 + 90).astype('uint8'); b = io.BytesIO(); Image.fromarray(a).save(b, 'JPEG'); return b.getvalue()
NAMES = ['stone', 'paving', 'roof']
INDEX = {n: {'files': [n + '-1k.jpg', n + '-n-1k.jpg', n + '-r.jpg'], 'hi': [n + '.jpg', n + '-n.jpg'], 'hiSize': 2048, 'tile': 3} for n in NAMES}
async def main():
    srv = subprocess.Popen(['python3', '-m', 'http.server', '8834'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1); r = {}; hits = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            pg = await (await b.new_context(viewport={'width': 900, 'height': 600})).new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            small, big = png(256, 1), png(1024, 2)
            async def route(rt):
                f = rt.request.url.split('/textures/')[1].split('?')[0]
                if f == 'index.json': return await rt.fulfill(body=json.dumps(INDEX), content_type='application/json')
                hi = not ('-1k' in f or '-r.' in f); hits.append(f)
                await rt.fulfill(body=big if hi else small, content_type='image/jpeg')
            await pg.route('**/textures/**', route)
            await pg.goto('http://localhost:8834/index.html?debug&nosw')
            for _ in range(400):
                await pg.wait_for_timeout(250)
                if await pg.evaluate('window.palaceDebug && palaceDebug.ready()'): break
            for _ in range(20):  # nearest first, one at a time
                await pg.wait_for_timeout(500); d = await pg.evaluate('palaceDebug.detail()')
                if all(d[n]['state'] != 'loading' for n in d) and [n for n in d if d[n]['state'] == 'hi'] == [n for n in d if d[n]['dist'] <= 25]: break
            r['at the forecourt'] = d
            r['full res fetched'] = sorted(set(h for h in hits if '-1k' not in h and '-r.' not in h))
            await pg.evaluate('palaceDebug.place(0, -3.2, -150, true)'); await pg.wait_for_timeout(300)
            r['far away'] = await pg.evaluate('palaceDebug.detail()')
            r['errors'] = errs
            await b.close()
    finally: srv.terminate()
    for k, v in r.items(): print(k, v)
    near = r['at the forecourt']; far = r['far away']
    ok = (near['stone']['state'] == 'hi' and near['paving']['state'] == 'hi' and near['roof']['state'] == ('hi' if near['roof']['dist'] <= 25 else 'lo')
          and all(far[n]['state'] == 'lo' for n in far) and not r['errors'])
    print('DETAIL TESTS', 'PASSED' if ok else 'FAILED')
asyncio.run(main())
