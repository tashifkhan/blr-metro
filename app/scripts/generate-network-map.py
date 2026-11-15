#!/usr/bin/env python3
"""Build app/src/data/networkMap.json from the project's BMRC API.

Lines keep the order the API returns stations in. BMRC's own feed has a
number of typo'd coordinates (Chickpete listed 52 km west of the city, half
the Yellow Line listed at 12.09 N); stations outside a loose Bengaluru box are
placed by interpolating between their neighbours along the line, and marked
`approx` so the map can say so.

Usage: python3 scripts/generate-network-map.py [api-base]
"""

import json
import sys
import urllib.request
from pathlib import Path

API = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8091').rstrip('/')
OUT = Path(__file__).resolve().parent.parent / 'src' / 'data' / 'networkMap.json'

# Loose bounding box around Bengaluru. Anything outside it is a typo.
LAT = (12.75, 13.15)
LNG = (77.35, 77.85)
# Fallback step when a line has no trusted pair to extrapolate from (metres,
# x east, y south).
DEFAULT_STEP = (350.0, 1150.0)
METRES_PER_DEGREE = 111_320
ORIGIN = (12.975692, 77.572836)


def get(path):
    with urllib.request.urlopen(API + '/api/v1' + path, timeout=20) as res:
        return json.load(res)


def trusted(station):
    lat, lng = station.get('latitude'), station.get('longitude')
    return lat is not None and lng is not None and LAT[0] < lat < LAT[1] and LNG[0] < lng < LNG[1]


def metres_step(a, b, span):
    return (
        (b[1] - a[1]) * METRES_PER_DEGREE * 0.9715 / span,
        -(b[0] - a[0]) * METRES_PER_DEGREE / span,
    )


def step_for(points, anchor):
    """Per-station step through the nearest trusted pair around `anchor`."""
    left = anchor
    while left > 0 and not points[left - 1][2]:
        left -= 1
    right = anchor
    while right < len(points) - 1 and not points[right + 1][2]:
        right += 1
    if left > 0 and points[left - 1][2] and points[anchor][2]:
        return metres_step(points[left - 1][:2], points[anchor][:2], 1)
    if right < len(points) - 1 and points[right + 1][2] and points[anchor][2]:
        return metres_step(points[anchor][:2], points[right + 1][:2], 1)
    return DEFAULT_STEP


def repair(points):
    """Fill untrusted coordinates in place, in metres from the origin."""
    out = []
    for i, (lat, lng, ok) in enumerate(points):
        out.append(None if not ok else (
            (lng - ORIGIN[1]) * METRES_PER_DEGREE * 0.9715,
            -(lat - ORIGIN[0]) * METRES_PER_DEGREE,
        ))
    i = 0
    while i < len(points):
        if out[i] is not None:
            i += 1
            continue
        start = i
        while i < len(points) and out[i] is None:
            i += 1
        end = i  # first trusted after the run, or len
        before = start - 1
        after = end if end < len(points) else None
        if before >= 0 and after is not None:
            span = after - before
            for j in range(start, end):
                t = (j - before) / span
                out[j] = (
                    out[before][0] + (out[after][0] - out[before][0]) * t,
                    out[before][1] + (out[after][1] - out[before][1]) * t,
                )
        elif before >= 0:
            step = step_for(points, before)
            for j in range(start, end):
                out[j] = (out[before][0] + step[0] * (j - before), out[before][1] + step[1] * (j - before))
        elif after is not None:
            step = step_for(points, after)
            for j in range(start, end):
                out[j] = (out[after][0] + step[0] * (j - after), out[after][1] + step[1] * (j - after))
        else:
            raise SystemExit('no coordinates to anchor this line')
    for j, point in enumerate(out):
        out[j] = (point[0], point[1], points[j][2])
    return out


def main():
    lines = []
    stations = {}
    for meta in get('/lines'):
        code = meta['code']
        detail = get(f'/lines/{code}/stations')
        ordered = detail['stations']
        points = [(s.get('latitude'), s.get('longitude'), trusted(s)) for s in ordered]
        fixed = repair(points)
        for s, (x, y, ok) in zip(ordered, fixed):
            lat = s['latitude'] if ok else ORIGIN[0] - y / METRES_PER_DEGREE
            lng = s['longitude'] if ok else ORIGIN[1] + x / (METRES_PER_DEGREE * 0.9715)
            entry = stations.setdefault(s['code'], {
                'code': s['code'],
                'name': s['name'].strip(),
                'lat': round(lat, 6),
                'lng': round(lng, 6),
                'lines': [],
            })
            if not ok:
                entry['approx'] = True
            if code not in entry['lines']:
                entry['lines'].append(code)
        lines.append({
            'code': code,
            'name': detail['name'],
            'color': detail['color_hex'],
            'network': 'dmrc',
            'stations': [s['code'] for s in ordered],
        })
    OUT.write_text(json.dumps({'lines': lines, 'stations': list(stations.values())},
                              ensure_ascii=False, indent=1) + '\n')
    print(f'wrote {OUT} ({len(lines)} lines, {len(stations)} stations, '
          f'{sum(1 for s in stations.values() if s.get("approx"))} approximated)')


if __name__ == '__main__':
    main()
