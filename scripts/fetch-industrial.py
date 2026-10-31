"""Fetch real Overpass geometry in the OSM administrative area of Tyumen.
Run from repository root, then: node scripts/prepare-industrial.mjs data-sources/industrial-overpass.json
"""
import json
import pathlib
import urllib.request

query = '[out:json][timeout:60];rel(2049854);map_to_area->.city;(way[landuse=industrial](area.city);relation[landuse=industrial](area.city););out geom;'
request = urllib.request.Request('https://overpass-api.de/api/interpreter', data=query.encode(), headers={'User-Agent': 'TumenMap/1.0 (industrial polygons)', 'Content-Type': 'text/plain', 'Accept': 'application/json'})
with urllib.request.urlopen(request, timeout=90) as response:
    data = json.load(response)
if data.get('remark') or not data.get('elements'):
    raise RuntimeError('Incomplete or empty Overpass result; keeping existing data')
root = pathlib.Path(__file__).resolve().parents[1]
path = root / 'data-sources' / 'industrial-overpass.json'
path.parent.mkdir(exist_ok=True)
path.write_text(json.dumps(data, ensure_ascii=False))
print('Saved real OSM elements:', len(data['elements']))
