"""Graba cada lámina del deck como MP4 1080p30 con reloj virtual (cuadros exactos aunque el equipo sea lento).

Cada clip arranca en el estado final de la lámina anterior y llama go(i): la transición queda dentro del video,
así el último cuadro del clip N coincide con el primero del clip N+1.

Uso (desde la raíz del repo, con dist/ construido):
  PYTHONPATH=<carpeta con imageio_ffmpeg> backend/.venv/bin/python presentacion/tools/grabar_video.py salida/ [laminas]
Reanudable: salta las láminas cuyo MP4 ya existe.
"""
import asyncio, base64, json, os, random, shutil, signal, subprocess, sys, tempfile, urllib.request
import websockets, imageio_ffmpeg

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
ONLY = [int(x) for x in sys.argv[2].split(",")] if len(sys.argv) > 2 else [1, 2, 3, 4, 5, 6, 7]
FPS, DT = 30, 1000 / 30
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe(); B = shutil.which("brave-browser") or "chromium"

# Por lámina (1-based): cómo dejar lista la anterior y cuánto dura el clip. "next" = clic dentro de la lámina.
PLAN = {
    1: dict(prev=None, dur=8.0),
    2: dict(prev=[("show", 0), ("ff", 6)], dur=7.0),
    3: dict(prev=[("show", 1), ("ff", 6)], dur=13.5),
    4: dict(prev=[("show", 2), ("ff", 16)], dur=11.0, clicks=[6.6]),
    5: dict(prev=[("show", 3), ("ff", 5)], dur=18.0),   # show(.., true) ya aplica el segundo tiempo de la 4
    6: dict(prev=[("show", 4), ("ff", 20)], dur=17.0),
    7: dict(prev=[("show", 5), ("ff", 19)], dur=8.0),
}

# Reloj virtual: se inyecta antes de cualquier script de la página.
CLOCK = r"""
(() => {
  let now = 0; const t0 = Date.now(); const rafs = new Map(); let rid = 0; const tms = new Map(); let tid = 0;
  performance.now = () => now; Date.now = () => t0 + now;
  window.requestAnimationFrame = cb => { rafs.set(++rid, cb); return rid; };
  window.cancelAnimationFrame = id => { rafs.delete(id); };
  window.setTimeout = (cb, ms = 0, ...a) => { tms.set(++tid, {t: now + Math.max(0, +ms || 0), cb, a}); return tid; };
  window.clearTimeout = id => { tms.delete(id); };
  window.setInterval = (cb, ms = 0, ...a) => { const id = ++tid; tms.set(id, {t: now + Math.max(1, +ms || 1), cb, a, every: Math.max(1, +ms || 1)}); return id; };
  window.clearInterval = window.clearTimeout;
  window.__advance = (ms) => {
    const end = now + ms;
    for (let guard = 0; guard < 10000; guard++) {
      let nx = null; for (const [id, t] of tms) if (t.t <= end && (!nx || t.t < nx[1].t)) nx = [id, t];
      if (!nx) break; const [id, t] = nx; now = Math.max(now, t.t);
      if (t.every) t.t += t.every; else tms.delete(id);
      try { typeof t.cb === 'function' && t.cb(...t.a); } catch (e) { console.error(e); }
    }
    now = end; const cbs = [...rafs.values()]; rafs.clear();
    for (const cb of cbs) { try { cb(now); } catch (e) { console.error(e); } }
  };
})();
"""

PROCS = []; UDD = tempfile.mkdtemp(prefix="zenit-video-")
def matar():
    for q in PROCS:
        try: os.killpg(q.pid, signal.SIGKILL)
        except Exception: pass
    subprocess.run(["pkill", "-9", "-f", UDD])

async def grabar(i):
    destino = os.path.join(OUT, f"lamina-{i}.mp4")
    if os.path.exists(destino): print(f"lámina {i}: ya existe, se salta"); return
    port, dbg = random.randint(20000, 29999), random.randint(30000, 39999)
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--directory", os.path.join(R, "dist")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    br = subprocess.Popen([B, "--headless=new", f"--remote-debugging-port={dbg}", f"--user-data-dir={UDD}", "--remote-allow-origins=*",
                           "--window-size=1920,1080", "--hide-scrollbars", "--disk-cache-size=1", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    PROCS.extend([srv, br])
    for _ in range(80):
        try: t = json.load(urllib.request.urlopen(f"http://127.0.0.1:{dbg}/json")); break
        except Exception: await asyncio.sleep(.25)
    ws = await websockets.connect([x for x in t if x["type"] == "page"][0]["webSocketDebuggerUrl"], max_size=None)
    n = 0; errs = []
    async def send(m, **pr):
        nonlocal n; n += 1; my = n
        await ws.send(json.dumps({"id": my, "method": m, "params": pr}))
        while True:
            d = json.loads(await ws.recv())
            if d.get("method") == "Runtime.exceptionThrown": errs.append(str(d["params"]["exceptionDetails"].get("exception", {}).get("description", ""))[:200])
            if d.get("id") == my: return d.get("result", {})
    js = lambda e: send("Runtime.evaluate", expression=e, awaitPromise=True, returnByValue=True)
    await send("Page.enable"); await send("Runtime.enable")
    await send("Page.addScriptToEvaluateOnNewDocument", source=CLOCK)
    await send("Emulation.setDeviceMetricsOverride", width=1920, height=1080, deviceScaleFactor=1, mobile=False)
    start = PLAN[i]["prev"][0][1] if PLAN[i]["prev"] else 0
    await send("Page.navigate", url=f"http://localhost:{port}/index.html?captura=1#lamina-{start + 1}")
    # espera real a que carguen fuentes, deck y textura (con el reloj detenido)
    for _ in range(100):
        await asyncio.sleep(.2)
        r = await js("!!(window.__deck && window.Globo && document.fonts.status === 'loaded')")
        if r.get("result", {}).get("value"): break
    await js("new Globo(document.createElement('canvas')).ready.then(() => true)")
    await js("gsap.ticker.lagSmoothing(0); true")
    adv = lambda ms: js(f"window.__advance({ms}); true")
    async def ff(sec):  # avanza sin capturar
        for _ in range(int(sec * 1000 / DT)): await adv(DT)
    for paso in PLAN[i]["prev"] or [("show", 0)]:
        if paso[0] == "show": await js(f"window.__deck.show({paso[1]}, true); true"); await adv(DT)
        elif paso[0] == "ff": await ff(paso[1])
        elif paso[0] == "next": await js("window.__deck.next(); true"); await adv(DT)
    if PLAN[i]["prev"]: await js(f"window.__deck.go({i - 1}); true")
    else: await js("window.__deck.show(0); true")
    enc = subprocess.Popen([FFMPEG, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-",
                            "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart", destino + ".tmp.mp4"],
                           stdin=subprocess.PIPE, start_new_session=True)
    PROCS.append(enc)
    clicks = list(PLAN[i].get("clicks", [])); total = int(PLAN[i]["dur"] * FPS)
    for f in range(total):
        tsec = f / FPS
        while clicks and clicks[0] <= tsec: clicks.pop(0); await js("window.__deck.next(); true")
        shot = await send("Page.captureScreenshot", format="jpeg", quality=92)
        enc.stdin.write(base64.b64decode(shot["data"]))
        if f == 0: open(os.path.join(OUT, f"lamina-{i}-primero.jpg"), "wb").write(base64.b64decode(shot["data"]))
        if f == total - 1: open(os.path.join(OUT, f"lamina-{i}-final.jpg"), "wb").write(base64.b64decode(shot["data"]))
        await adv(DT)
    enc.stdin.close(); enc.wait()
    os.replace(destino + ".tmp.mp4", destino)
    print(f"lámina {i}: {total} cuadros · {os.path.getsize(destino) // 1024} KB · errores: {errs or 'ninguno'}", flush=True)
    await ws.close(); matar(); PROCS.clear()

async def main():
    for i in ONLY: await grabar(i)
try: asyncio.run(main())
finally: matar()
