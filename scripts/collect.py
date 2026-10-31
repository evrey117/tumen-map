"""Refresh raw OSM sources. Review responses before updating curated homes.json.
Run from repository root: python scripts/collect.py
Uses the inherited HTTPS proxy and TLS trust; never disables verification.
"""
import json
import pathlib
import subprocess
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEST = ROOT / 'public' / 'data'
USER_AGENT = 'TumenMap/1.0 (single-user address verification)'


def request(url, data=None):
    req = urllib.request.Request(url, data=data, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.load(response)


if __name__ == '__main__':
    homes = json.loads(subprocess.check_output(
        ['node', '--input-type=module', '-e',
         "import {homes} from './src/data.js'; console.log(JSON.stringify(homes))"], cwd=ROOT))
    responses = {}
    for home in homes:
        query = 'Закалужская улица, Тюмень' if home['id'] == 13 else home['address'] + ', Тюмень'
        params = dict(q=query, format='jsonv2', addressdetails=1, limit=10,
                      countrycodes='ru', viewbox='65.05,57.4,66,56.9', bounded=1)
        responses[str(home['id'])] = request(
            'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(params))
        print(home['name'], len(responses[str(home['id'])]), flush=True)
        time.sleep(1.2)
    DEST.mkdir(exist_ok=True, parents=True)
    (DEST / 'geocoder-responses.json').write_text(json.dumps(responses, ensure_ascii=False, indent=2))
    query = ('[out:json][timeout:30];(nwr[amenity=school](56.95,65.15,57.3,65.85);'
             'nwr[amenity=kindergarten](56.95,65.15,57.3,65.85);'
             'nwr[amenity=clinic](56.95,65.15,57.3,65.85););out center tags;')
    data = request('https://overpass-api.de/api/interpreter',
                   urllib.parse.urlencode({'data': query}).encode())
    if 'remark' in data:
        raise RuntimeError('Overpass returned an incomplete/error result: ' + data['remark'])
    (DEST / 'infrastructure.json').write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print('Infrastructure records:', len(data['elements']))
