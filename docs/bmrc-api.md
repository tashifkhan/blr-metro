# BMRCL public API

Checked on 14 Nov 2026 against `https://english.bmrc.co.in`. The homepage fare calculator is not in the HTML. The Next.js bundle calls JSON on port 8282.

Base URL:

`https://english.bmrc.co.in:8282/api`

The bundle sends `Authorization: Bearer` plus `Accept` and `Content-Type: application/json`. The token is compiled into the public JavaScript. This repo stores it as `BMRC_API_KEY` and also sends `Origin` and `Referer` of `https://english.bmrc.co.in`.

## Calls the site makes

| Call | What came back |
| --- | --- |
| `GET /users/master/getStations` | 91 rows, 88 unique station codes. Purple 37, Green 32, Yellow 16, Pink 6. |
| `POST /users/fare/get-fare-details` | Fare zone and four prices, plus parking counts for the origin. |
| `GET /users/news/getNewDetails/latestnews` | News items with English and Kannada text and a PDF path. |
| `GET /users/news/getNewDetails/marquee` | Homepage ticker. Same row shape. |
| `GET /users/counts/metro-details` | Marketing counter. Still says 83 stations and 96 km. Not a timetable. |

The November fetch is larger than the one on 8 Nov 2026, which had 85 rows and no Pink line. Pink is a stub: six stations, sharing `JDHP` with Yellow at Jayadeva Hospital. The catalog follows whatever this list says. A new `LineID` becomes `L{id}` until it is named.

Fare body:

```json
{
  "from": { "value": "WHTM", "groupId": "1" },
  "to": { "value": "CBPK", "groupId": "1" }
}
```

`value` is `vStationCode`. `groupId` is `LineID` as a string. A body with bare codes returns "From Station and To station required" and no prices.

Whitefield (`WHTM`, line 1) to Cubbon Park (`CBPK`, line 1) on 14 Nov 2026: token 70, peak smart card 66.5, non-peak 63, group ticket 59.5, zone `F7`, 204 two-wheeler slots at Whitefield. Do not pin those rupee values in tests.

## Station rows

Fields we keep: `vSDOCID`, `vStationCode`, `vStationName`, `vStationNameK`, `LineID`, `stationOrder`, `latitude`, `longitude`, `eng_linename`, `kan_linename`, `color_code`. Kannada names include a trailing `\r\n`. Strip it.

Interchanges are the same code twice, not two stations:

- `KGWA` Majestic, line 1 order 123 and line 2 order 37
- `RVR` RV Road, line 2 order 44 and line 3 order 301
- `JDHP` Jayadeva Hospital, line 3 order 303 and line 4 order 318

Orders are contiguous inside a line. Purple 101 to 137, Green 21 to 52, Yellow 301 to 316, Pink 317 to 322. There is no route, time, or platform field. The only fare path in the bundle is `get-fare-details`.

News file paths beginning with `/fileuploads/` or `/FileUploads/` omit their upload directory. Resolve English PDFs under `https://english.bmrc.co.in:8282/English/uploads/news/english/` and Kannada PDFs under `https://english.bmrc.co.in:8282/Kannada/uploads/news/kannada/`. Preserve absolute URLs and URL-encode spaces in relative filenames.

## Maps

Static files, not hashed:

- Phase map: `https://english.bmrc.co.in/images/PHASE-1-2-2A-2B.jpg`
- Schematic linked from the English site: `https://english.bmrc.co.in/images/metro/travel-info/sitemapimgkan.jpg`

That second file is the Kannada schematic even on the English page.
