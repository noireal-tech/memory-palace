# A portal's offer of a VR session, emulated with IWER (a Quest 3 in software): the headset grants a session while
# the palace loads, before its scripts or after them. Either way the palace should end up in VR with no tap, and keep
# drawing frames while it builds.
import asyncio, subprocess, os
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..')
IW = open(os.path.join(HERE, 'vendor', 'iwer.min.js')).read()
EARLY = """new MutationObserver(function (m, obs) { if (document.querySelector('script[src*="three.min.js"]')) { obs.disconnect(); navigator.xr.dispatchEvent(new Event('sessiongranted')); } }).observe(document, { childList: true, subtree: true });"""
LATE = "addEventListener('load', function () { setTimeout(function () { navigator.xr.dispatchEvent(new Event('sessiongranted')); }, 300); });"
async def run(b, when):
    pg = await (await b.new_context(viewport={'width': 800, 'height': 500})).new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script(IW + "\n;(function(){ new IWER.XRDevice(IWER.metaQuest3).installRuntime({ forceInstall: true }); })();\n" + (EARLY if when == 'early' else LATE))
    await pg.goto('http://localhost:8833/index.html?debug&nosw&via=clay')
    ok = False
    for _ in range(300):
        await pg.wait_for_timeout(300)
        try:
            if await pg.evaluate('window.palaceDebug && palaceDebug.presenting() && palaceDebug.ready()'): ok = True; break
        except Exception: pass
    xr = await pg.evaluate('palaceDebug.frames().filter(function (f) { return f[1]; }).length') if ok else 0
    print(when, 'in VR without a tap:', ok, '| frames drawn in VR while it built:', xr, '| errors:', errs[:3])
    await pg.context.close(); return ok and xr > 3 and not errs
async def main():
    srv = subprocess.Popen(['python3', '-m', 'http.server', '8833'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            res = [await run(b, 'early'), await run(b, 'late')]
            await b.close()
    finally: srv.terminate()
    print('GRANT TESTS', 'PASSED' if all(res) else 'FAILED')
asyncio.run(main())
