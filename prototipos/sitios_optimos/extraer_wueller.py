import zipfile, io, struct, json, collections, sys

src = sys.argv[1] if len(sys.argv) > 1 else 'datos/Landing_Sites.zip'
salida = sys.argv[2] if len(sys.argv) > 2 else 'datos/wueller_sitios.json'
z = zipfile.ZipFile(src)
inner = zipfile.ZipFile(io.BytesIO(z.read('Landing_Sites.zip')))
data = inner.read('LandingSites.dbf')
n, hl, rl = struct.unpack('<IHH', data[4:12])
fields, o = [], 32
while data[o] != 0x0D:
    fd = data[o:o + 32]
    fields.append((fd[:11].split(b'\0')[0].decode(), chr(fd[11]), fd[16]))
    o += 32
sites = []
for i in range(n):
    r = data[hl + i * rl: hl + (i + 1) * rl]
    p, rec = 1, {}
    for nm, t, l in fields:
        v = r[p:p + l].replace(b'\0', b'').decode('utf-8', 'ignore').strip()
        p += l
        if t in 'NF':
            try:
                v = float(v)
            except ValueError:
                v = None
        rec[nm] = v
    sites.append(rec)
json.dump(sites, open(salida, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(sites), 'sitios')
print(collections.Counter(s['Landing_Re'] for s in sites))
lat = [s['Latitude'] for s in sites]
print('lat min/max', min(lat), max(lat))
