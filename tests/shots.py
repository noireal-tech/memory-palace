# Opens the app in a headless browser, waits for the palace to be raised, reports errors and draw cost, and takes views.
import asyncio, subprocess, sys, os, math
from playwright.async_api import async_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'tests', 'shots')
async def main():
    os.makedirs(OUT, exist_ok=True)
    srv = subprocess.Popen(['python3', '-m', 'http.server', '8831'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            pg = await (await b.new_context(viewport={'width': 1280, 'height': 760})).new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text[:300]) if m.type == 'error' else None)
            t0 = asyncio.get_event_loop().time()
            await pg.goto('http://localhost:8831/index.html?debug&nosw')
            for _ in range(400):
                await pg.wait_for_timeout(250)
                if await pg.evaluate('window.palaceDebug && palaceDebug.ready()'): break
            print('ready in s', round(asyncio.get_event_loop().time() - t0, 1), '|', await pg.text_content('#status'))
            await pg.wait_for_timeout(1500)
            await pg.evaluate("document.getElementById('card').hidden = true")
            views = [('forecourt', None), ('approach', [0, -3.2, -72, math.pi, 0.04, 1]), ('aerial', [-64, 28, -80, 3.75, -0.3, 1]), ('gate', [0, 0, -21, math.pi, 0.28, 1]), ('side', [-40, 0, -24, 2.3, 0.12, 1]), ('crown', [9, 15.2, -10, 2.6, 0.25, 1])]
            for name, v in views:
                if v: await pg.evaluate(f'palaceDebug.place({v[0]},{v[1]},{v[2]},{str(bool(v[5])).lower()}); palaceDebug.look({v[3]},{v[4]})')
                await pg.wait_for_timeout(1200); await pg.screenshot(path=os.path.join(OUT, name + '.png'))
                if name == 'forecourt': print('draw cost', await pg.evaluate('palaceDebug.stats()'))
            print('errors', errs)
            await b.close()
    finally: srv.terminate()
asyncio.run(main())
