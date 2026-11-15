"""Prueba la maqueta en Brave headless y guarda capturas. Requiere: python3 -m http.server 8766 --directory presentacion"""
import asyncio, base64, json, os, shutil, subprocess, sys, tempfile, urllib.request, time
import websockets
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
B = shutil.which("brave-browser") or "chromium"
STEPS = [
  ("a-resumen", "0"),
  ("b-polo", "m.southPole(0.01)"),
  ("c-ficha23", "m.setDate('2026-11-23'); m.select('mons-malapert')"),
  ("d-ficha24", "m.setDate('2026-11-24')"),
  ("e-select", "m.setDate('2026-11-18'); m.hideCard(); m.selected=[]; m.select('mons-mouton'); m.select('im-2'); m.select('mons-malapert')"),
  ("f-comparar", "m.showCompare(['im-2','mons-malapert','mons-mouton'])"),
]
async def main():
    p = subprocess.Popen([B, "--headless=new", "--remote-debugging-port=9342", f"--user-data-dir={tempfile.mkdtemp()}", "--remote-allow-origins=*", "--window-size=1600,900", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(60):
        try: t = json.load(urllib.request.urlopen("http://127.0.0.1:9342/json")); break
        except Exception: await asyncio.sleep(.2)
    ws = await websockets.connect([x for x in t if x["type"] == "page"][0]["webSocketDebuggerUrl"], max_size=None)
    n = 0; errs = []
    async def send(m, **pr):
        nonlocal n; n += 1; my = n
        await ws.send(json.dumps({"id": my, "method": m, "params": pr}))
        while True:
            d = json.loads(await ws.recv())
            if d.get("method") == "Runtime.exceptionThrown": errs.append(str(d["params"]["exceptionDetails"])[:300])
            if d.get("method") == "Runtime.consoleAPICalled" and d["params"]["type"] == "error": errs.append(str(d["params"]["args"])[:300])
            if d.get("id") == my: return d.get("result", {})
    await send("Runtime.enable"); await send("Page.enable")
    await send("Emulation.setDeviceMetricsOverride", width=1600, height=900, deviceScaleFactor=1, mobile=False)
    await send("Page.navigate", url="http://localhost:8766/maqueta-test.html"); await asyncio.sleep(2.5)
    for name, js in STEPS:
        t0 = time.time(); await send("Runtime.evaluate", expression=js)
        await asyncio.sleep(2.2)
        shot = await send("Page.captureScreenshot", format="jpeg", quality=82)
        open(f"{OUT}/{name}.jpg", "wb").write(base64.b64decode(shot["data"]))
    # medida de coste de un cuadro del globo
    r = await send("Runtime.evaluate", expression="(()=>{m.q=4;const t=performance.now();for(let i=0;i<10;i++)m.draw();const a=(performance.now()-t)/10;m.q=2;const t2=performance.now();m.draw();return [a,performance.now()-t2]})()", returnByValue=True)
    print("ms/cuadro (movimiento, reposo):", r["result"]["value"]); print("errores:", errs or "ninguno")
    p.terminate()
asyncio.run(main())
