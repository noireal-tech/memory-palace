# Closets: the Door tool on the hand panel puts a closet door in the hall's wall (between its posts); the door is shut
# and stops you until you open it; through the open doorway you see the closet (bigger inside than the wall), you walk
# in, name it, and its bulb says 1; inside, a closet door in its back wall leads to a closet whose bulb says 2, with
# the way back drawn through each doorway; a lantern set down in a closet stays there; a room's wall takes a closet
# too; everything is kept after a reload. Then in an emulated Quest 3: walk through, both ways, with both eyes drawn.
import asyncio, subprocess, os, math, json
from playwright.async_api import async_playwright
from PIL import Image, ImageChops
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..'); SHOTS = os.path.join(HERE, 'shots')
IW = open(os.path.join(HERE, 'vendor', 'iwer.min.js')).read()
GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
URL = 'http://localhost:8844/index.html?debug&nosw'
PLAN = {'rooms': [{'address': 'E1.W.N2'}]}
async def ready(pg):
    for _ in range(400):
        await pg.wait_for_timeout(250)
        if await pg.evaluate('window.palaceDebug && palaceDebug.ready()'): return True
    return False
async def pump(pg, n=3):
    for _ in range(n): await pg.screenshot(); await pg.wait_for_timeout(120)
async def snap(pg, name):
    await pump(pg, 3); p = os.path.join(SHOTS, name + '.png'); await pg.screenshot(path=p); return p
def differs(a, b):  # how much two views differ (mean, 0..255)
    d = ImageChops.difference(Image.open(a).convert('L'), Image.open(b).convert('L')); h = d.histogram(); return sum(i * n for i, n in enumerate(h)) / sum(h)
def face(n):  # the yaw that looks against a wall normal n = [x, z]
    return math.atan2(n[0], n[1])

async def flat(b, r):
    ctx = await b.new_context(viewport={'width': 900, 'height': 560}); pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and '404' not in m.text else None)
    await pg.goto(URL); await ready(pg); E = pg.evaluate; C = 'palaceDebug.MP.Closets'
    await pg.set_input_files('#planFile', files=[{'name': 'plan.json', 'mimeType': 'application/json', 'buffer': json.dumps(PLAN).encode()}]); await pg.wait_for_timeout(1200)
    await E("document.getElementById('card').hidden = true")
    # the Door tool from the hand panel: stand in the hall facing the west wall's fourth bay, click
    await E('palaceDebug.place(-6.4, 0, -2.5, false); palaceDebug.look(Math.PI / 2, 0)')
    await E("palaceDebug.MP.Panel.press('Make')"); await E('palaceDebug.MP.Panel.tick(0.4)')
    r['make face in the hall'] = await E('palaceDebug.MP.Panel.buttons()')
    await E("palaceDebug.MP.Panel.press('Door tool')"); await pump(pg, 2)
    r['ghost'] = await E(f'{C}.tool.aim({C}.tool.ray())')
    await pg.screenshot(path=os.path.join(SHOTS, 'closet-ghost.png'))
    await pg.mouse.click(450, 280); await pump(pg, 2)
    rep = await E(f'{C}.report()'); r['placed'] = [(c['wall'], c['t'], c['depth'], c['open']) for c in rep]
    d1 = rep[0]['door']
    # shut: it stops you
    pos = await E('palaceDebug.place(-7.6, 0, -2.5, false), palaceDebug.look(Math.PI / 2, 0), palaceDebug.walk(90, 1, 0)')
    r['shut door stops you'] = pos[0] > d1[0] + 0.15
    # open it by pointing; through the doorway, the closet
    r['opened'] = await E(f"palaceDebug.MP.Interact.useRay([-8.2, 1.2, {d1[1] + 0.25}], [-1, 0, 0])") and (await E(f'{C}.report()'))[0]['open']
    await E('palaceDebug.place(-7.6, 0, -2.5, false); palaceDebug.look(Math.PI / 2, -0.05)'); await pump(pg, 4)
    on = await snap(pg, 'closet-doorway'); await E(f'{C}.noPortals = true'); off = await snap(pg, 'closet-doorway-off'); await E(f'{C}.noPortals = false')
    r['see into the closet'] = round(differs(on, off), 1)
    # walk in
    await E('palaceDebug.look(Math.PI / 2, 0)'); await E('palaceDebug.walk(80, 1, 0)')
    r['inside'] = await E('palaceDebug.MP.World.space')
    await E("palaceDebug.look(palaceDebug.MP.Player.flatYaw, -0.15)"); await snap(pg, 'closet-inside')
    await E("palaceDebug.MP.Panel.press('Make')"); await E('palaceDebug.MP.Panel.tick(0.4)'); r['make face in a closet'] = await E('palaceDebug.MP.Panel.buttons()')
    await E(f"{C}.setName(1, 'Wind tunnels')"); r['named'] = (await E(f'{C}.report()'))[0]['name']
    # a lantern set down in here stays here
    await E("palaceDebug.MP.Things.spawn('andon')"); await pump(pg, 3)
    lant = [t for t in await E('palaceDebug.MP.Things.report()') if t['at'][0] > 2500]
    r['lantern in the closet'] = len(lant) == 1
    # a closet door in this closet's back wall: a closet in a closet
    walls = {w['id']: w for w in await E(f'{C}.walls()')}
    r['closet walls'] = sorted(walls)
    id2 = await E(f"{C}.add('c1:B', 1.3)"); await E(f'{C}.toggle({id2})')
    c2 = next(c for c in await E(f'{C}.report()') if c['id'] == id2); r['nested'] = [c2['parent'], c2['depth']]
    d2 = c2['door']; await E(f"palaceDebug.place({d2[0]}, 0, {d2[1] - 1.4}, false); palaceDebug.look(Math.PI, 0)"); await pump(pg, 3)
    await E('palaceDebug.walk(90, 1, 0)'); r['deeper'] = await E('palaceDebug.MP.World.space')
    await E('palaceDebug.look(0, 0)'); back = await snap(pg, 'closet-2-lookback'); await E(f'{C}.noPortals = true'); back0 = await snap(pg, 'closet-2-lookback-off'); await E(f'{C}.noPortals = false')
    r['see back into closet 1'] = round(differs(back, back0), 1)
    # back out: to closet 1, then to the hall
    await E('palaceDebug.look(0, 0)'); await E('palaceDebug.walk(70, 1, 0)'); r['back in closet 1'] = await E('palaceDebug.MP.World.space')
    d1c = await E('(() => { const c = palaceDebug.MP.Closets.find(1); return [c.o.x, c.o.z]; })()')
    await E(f'palaceDebug.place({d1c[0]}, 0, {d1c[1] + 1.4}, false); palaceDebug.look(0, 0)'); await pump(pg, 2)
    look_hall = await snap(pg, 'closet-1-lookback')
    out = await E('palaceDebug.walk(80, 1, 0)'); r['back in the hall'] = [await E('palaceDebug.MP.World.space'), round(out[0], 2), round(out[2], 2)]
    # a room's wall takes a closet too
    rm = (await E('palaceDebug.MP.Rooms.report()'))[0]
    await E(f"palaceDebug.MP.Rooms.toggleDoor('{rm['address']}')")
    rw = next(w for w in await E(f"{C}.walls('world')") if w['id'] == 'r:' + rm['address'] + ':back')
    id3 = await E(f"{C}.add('{rw['id']}', {rw['len'] / 2 + 1.6})"); await E(f'{C}.toggle({id3})')
    c3 = next(c for c in await E(f'{C}.report()') if c['id'] == id3); r['room closet'] = [c3['wall'], c3['depth']]
    n = [rm['out'], 0]; await E(f"palaceDebug.place({c3['door'][0] + n[0] * 1.5}, 0, {c3['door'][1]}, false); palaceDebug.look({face(n)}, 0)")
    await E('palaceDebug.walk(90, 1, 0)'); r['into the room closet'] = await E('palaceDebug.MP.World.space')
    # everything kept
    await E("palaceDebug.place(0, 0, -7, false)"); await pg.wait_for_timeout(1200)
    before = await E(f'{C}.report()')
    await pg.goto(URL); await ready(pg)
    after = await E(f'{C}.report()')
    kb = [(c['id'], c['wall'], c['name'], c['open'], c['depth']) for c in before]; ka = [(c['id'], c['wall'], c['name'], c['open'], c['depth']) for c in after]
    r['kept after reload'] = ka == kb
    if ka != kb: r['before / after'] = [kb, ka]
    r['lantern still in the closet'] = len([t for t in await E('palaceDebug.MP.Things.report()') if t['at'][0] > 2500]) == 1
    r['flat errors'] = errs[:4]
    await ctx.close()

async def vr(b, r):
    ctx = await b.new_context(viewport={'width': 640, 'height': 400}); pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and '404' not in m.text else None)
    await pg.add_init_script(IW + "\n;(function(){ window.__iwer = new IWER.XRDevice(IWER.metaQuest3); window.__iwer.installRuntime({ forceInstall: true }); })();\n"
                             "addEventListener('load', function () { setTimeout(function () { navigator.xr.dispatchEvent(new Event('sessiongranted')); }, 300); });")
    await pg.goto(URL + '&via=clay')
    for _ in range(300):
        await pg.wait_for_timeout(300)
        if await pg.evaluate('window.palaceDebug && palaceDebug.presenting() && palaceDebug.ready()'): break
    E = pg.evaluate; C = 'palaceDebug.MP.Closets'
    r['in VR'] = await E('palaceDebug.presenting()')
    async def frames(n):
        f0 = await E('palaceDebug.frames().length')
        for _ in range(80):
            await pg.wait_for_timeout(150)
            if await E('palaceDebug.frames().length') >= f0 + n: return
    id1 = await E(f"{C}.add('hall:W', 8.1)"); await E(f'{C}.toggle({id1})')
    await E('palaceDebug.place(-7.6, 0, -2.5, true); palaceDebug.MP.R.rig.rotation.y = Math.PI / 2'); await frames(4)
    f0 = await E('palaceDebug.frames().length')
    await E('palaceDebug.walk(80, 1, 0)'); await frames(4)
    r['vr through the door'] = await E('palaceDebug.MP.World.space')
    await E('palaceDebug.MP.R.rig.rotation.y = 0'); await frames(4)
    await E('palaceDebug.walk(80, 1, 0)'); await frames(4)
    r['vr back out'] = await E('palaceDebug.MP.World.space')
    r['vr frames drawn'] = (await E('palaceDebug.frames().length')) - f0
    r['vr errors'] = errs[:3]
    await ctx.close()

async def main():
    os.makedirs(SHOTS, exist_ok=True)
    srv = subprocess.Popen(['python3', '-m', 'http.server', '8844'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1); r = {}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=GL)
            await flat(b, r); await vr(b, r); await b.close()
    finally: srv.terminate()
    for k, v in r.items(): print(k, v)
    ok = ('Door tool' in r['make face in the hall'] and r['ghost'] and r['ghost']['ok'] and r['placed'] == [('hall:W', 8.1, 1, False)]
          and r['shut door stops you'] and r['opened'] and r['see into the closet'] > 3 and r['inside'] == 'c1'
          and 'Name this closet' in r['make face in a closet'] and r['named'] == 'Wind tunnels' and r['lantern in the closet']
          and r['nested'] == ['c1', 2] and r['deeper'] == 'c2' and r['see back into closet 1'] > 3 and r['back in closet 1'] == 'c1'
          and r['back in the hall'][0] == 'world' and r['back in the hall'][1] > -9.6 and abs(r['back in the hall'][2] + 2.5) < 0.3
          and r['room closet'][1] == 1 and r['into the room closet'] == 'c3' and r['kept after reload'] and r['lantern still in the closet'] and not r['flat errors']
          and r['in VR'] and r['vr through the door'] == 'c1' and r['vr back out'] == 'world' and r['vr frames drawn'] > 8 and not r['vr errors'])
    print('CLOSET TESTS', 'PASSED' if ok else 'FAILED')
asyncio.run(main())
