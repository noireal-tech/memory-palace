# Levels of detail: with no plan, the sixteen starter rooms stand in the five bands with their band's wall colour and
# window shape; from the forecourt every room is a lightweight placeholder; at a room, it and its grid neighbours (and
# only they) switch to full facades, and walking across the palace swaps them back; the room's interior is furnished
# as you approach with its door still shut; where you can walk never changes; the detail bubble doesn't pile up
# stale geometry. Takes views into tests/shots/.
import asyncio, subprocess, os, math
from playwright.async_api import async_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); SHOTS = os.path.join(ROOT, 'tests', 'shots')
WALL = {'W2': 'b0603a', 'W1': 'd9b8a2', 'C': 'ede8dd', 'E1': 'a9b6c4', 'E2': '2f4a6b'}
SHAPE = {'W2': 'round', 'W1': 'arched', 'C': 'bars', 'E1': 'soft', 'E2': 'square'}
async def main():
    os.makedirs(SHOTS, exist_ok=True)
    srv = subprocess.Popen(['python3', '-m', 'http.server', '8837'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1); r = {}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            pg = await (await b.new_context(viewport={'width': 1280, 'height': 760})).new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and '404' not in m.text else None)
            await pg.goto('http://localhost:8837/index.html?debug&nosw')
            for _ in range(400):
                await pg.wait_for_timeout(250)
                if await pg.evaluate('window.palaceDebug && palaceDebug.ready()'): break
            E = pg.evaluate
            await E("document.getElementById('card').hidden = true")
            rep = lambda: E('palaceDebug.MP.Rooms.report()')
            async def settle(want):   # headless frames are slow: wait until the detail has caught up with where you stand
                for _ in range(60):
                    await pg.wait_for_timeout(400)
                    rs = await rep(); f = await E('palaceDebug.MP.Rooms.focus() && palaceDebug.MP.Rooms.focus().address')
                    if f == want and not any(x['detail'] == 'staged' for x in rs) and (want is None or len(full(rs)) > 0): return rs
                return await rep()
            def full(rs): return sorted(x['address'] for x in rs if x['detail'] == 'full')
            rs = await rep()
            r['starter rooms'] = len(rs)
            r['per band'] = {k: sum(1 for x in rs if x['band'] == k) for k in WALL}
            r['unnamed'] = all(x['name'] == '' for x in rs)
            r['colours and windows by band'] = all(x['wall'] == '#' + WALL[x['band']] and x['windows'] == SHAPE[x['band']] for x in rs)
            r['forecourt: full'] = full(rs)
            r['forecourt world'] = await E('palaceDebug.MP.World.counts()')
            pieces0 = await E("palaceDebug.MP.Detail.report().plaster.pieces")
            await pg.screenshot(path=os.path.join(SHOTS, 'lod-forecourt.png'))
            # stand in W2's street, in front of W2.W.N1's door: it and its neighbours go full
            w = next(x for x in rs if x['address'] == 'W2.W.N1'); dx, dz = w['door']; out = w['out']
            await E(f'palaceDebug.place({dx + out * 1.8}, 0, {dz}, false); palaceDebug.look({out * math.pi / 2}, 0.05)')
            rs = await settle('W2.W.N1'); await pg.wait_for_timeout(1200); rs = await rep()
            r['at W2.W.N1: focus'] = await E('palaceDebug.MP.Rooms.focus() && palaceDebug.MP.Rooms.focus().address')
            r['at W2.W.N1: full'] = full(rs)
            r['furnished on approach, door shut'] = next(x for x in rs if x['address'] == 'W2.W.N1')['furnished'] and not next(x for x in rs if x['address'] == 'W2.W.N1')['open']
            r['near world'] = await E('palaceDebug.MP.World.counts()')
            await pg.screenshot(path=os.path.join(SHOTS, 'lod-west-full.png'))
            # a placeholder seen from the same distance (E2.E.N1, before you go there)
            e2 = next(x for x in rs if x['address'] == 'E2.E.N1'); ex, ez = e2['door']; eo = e2['out']
            await E(f'palaceDebug.place({ex + eo * 1.8}, 0, {ez - 12}, true); palaceDebug.look({eo * math.pi / 2 - 2.3}, 0.12)'); await pg.wait_for_timeout(150)
            await pg.screenshot(path=os.path.join(SHOTS, 'lod-east-lite.png'))
            # walk over to E2's street: the west goes back to placeholders, the east comes up full
            await E(f'palaceDebug.place({ex + eo * 1.8}, 0, {ez}, false); palaceDebug.look({eo * math.pi / 2}, 0.05)')
            rs = await settle('E2.E.N1'); await pg.wait_for_timeout(1200); rs = await rep()
            r['at E2.E.N1: full'] = full(rs)
            r['west back to placeholders'] = all(x['detail'] == 'lite' for x in rs if x['band'] == 'W2')
            r['west interiors cleared'] = not any(x['furnished'] for x in rs if x['band'] == 'W2')
            await E(f'palaceDebug.place({ex + eo * 1.8}, 0, {ez - 12}, true); palaceDebug.look({eo * math.pi / 2 - 2.3}, 0.12)'); await pg.wait_for_timeout(150)
            await pg.screenshot(path=os.path.join(SHOTS, 'lod-east-full.png'))
            # back and forth a few times, then home: nothing left over
            for i in range(3):
                await E(f'palaceDebug.place({dx + out * 1.8}, 0, {dz}, false)'); await settle('W2.W.N1')
                await E(f'palaceDebug.place({ex + eo * 1.8}, 0, {ez}, false)'); await settle('E2.E.N1')
            await E('palaceDebug.MP.arrive()'); rs = await settle(None); await pg.wait_for_timeout(800); rs = await rep()
            r['home again: full'] = full(rs)
            r['home world'] = await E('palaceDebug.MP.World.counts()')
            r['plaster pieces (start, end)'] = [pieces0, await E("palaceDebug.MP.Detail.report().plaster.pieces")]
            await E('palaceDebug.place(-62, 30, -78, true); palaceDebug.look(3.75, -0.32)'); await pg.wait_for_timeout(1500)
            await pg.screenshot(path=os.path.join(SHOTS, 'lod-aerial.png'))
            r['draw cost (aerial)'] = await E('palaceDebug.stats()')
            r['build times'] = await E('palaceDebug.MP.Rooms.stats')
            r['errors'] = errs
            await b.close()
    finally: srv.terminate()
    for k, v in r.items(): print(k, v)
    ok = (r['starter rooms'] == 16 and r['per band'] == {'W2': 3, 'W1': 3, 'C': 4, 'E1': 3, 'E2': 3} and r['unnamed'] and r['colours and windows by band']
          and r['forecourt: full'] == [] and r['at W2.W.N1: focus'] == 'W2.W.N1' and r['at W2.W.N1: full'] == ['W2.E.N1', 'W2.W.N1', 'W2.W.S1']
          and r['furnished on approach, door shut'] and r['at E2.E.N1: full'] == ['E2.E.N1', 'E2.E.S1', 'E2.W.N1']
          and r['west back to placeholders'] and r['west interiors cleared'] and r['home again: full'] == []
          and r['forecourt world'] == r['near world'] == r['home world'] and r['plaster pieces (start, end)'][0] == r['plaster pieces (start, end)'][1]
          and not r['errors'])
    print('LOD TESTS', 'PASSED' if ok else 'FAILED')
asyncio.run(main())
