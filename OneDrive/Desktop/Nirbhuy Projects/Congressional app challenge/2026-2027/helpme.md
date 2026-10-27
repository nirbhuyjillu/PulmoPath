# Help Me — Particulate-matter Landscape Understanding and Measurement Route-identification app (PLUMEr)

> A Congressional App Challenge entry: a 4-screen air-quality assistant for the
> Tri-Cities, WA 60-mile region. Open `index.html` in any browser to run it.

## 1. What this app does (screen by screen)

| Screen | File(s) | Purpose |
|---|---|---|
| 1 — Live forecast | `app2.jsx` | Real-time US AQI cards for every town in a 60-mi radius + a house-address box with personal AQI card + map pin. Auto-refreshes every 10 min. |
| 2 — Topo AQI map | `app1.jsx`, `app4.jsx` | Full-region map on OpenTopoMap terrain tiles with AQI-sized/colored town markers and a legend. |
| 3 — Health advisor | `app2.jsx`, `advisory.jsx` | Exact decision tree from `prompt.md`: 80–101 worsening → library/recirculation; 101–150 → lung/heart question → sealed recirculation or community center/library (→ Screen 4); 150–170 + condition → library now / nearest clean town; >170 → everyone moves. Never sends users outside during a dust storm or when AQI > 125. |
| 4 — Evacuation | `app3.jsx` | Nearest town with AQI < 101, fastest-route line + ETA (OSRM), Google Maps deep link, arrival-time AQI re-check with auto-reroute, shelter-in-place fallback. |

A risk disclaimer ("follow app recommendations at your own risk") appears on every
view and in the footer.

## 2. Tech stack — how it was built

**Architecture: no-build React PWA (static files, zero install).**
There is no `package.json`, no bundler, no backend. Everything runs in the browser.

| Layer | Choice | Why |
|---|---|---|
| UI framework | React 18 (UMD via CDN) + Babel Standalone (in-browser JSX) | The user chose "React PWA". A Vite scaffold was impossible (see 3.1), so React loads from unpkg and each `.jsx` file is transpiled in the browser. Files share code through `window` globals (`window.Towns`, `window.AqiApi`, `window.Advisory`) instead of ES imports, because `file://` pages cannot use module imports. |
| PWA shell | `manifest.webmanifest` + `sw.js` + `icon.svg` | Installable ("Add to Home Screen"), standalone display, offline app-shell cache. Serve over `http(s)` for the service worker to activate. |
| Styling | Hand-written `styles.css`, mobile-first, no framework | Dependency-free and responsive (375 px phones → desktop) via fluid grid + bottom tab nav. |
| Maps | Leaflet 1.9.4 (CDN) + OpenStreetMap tiles; OpenTopoMap on Screen 2 | Free, keyless, satisfies "topographical map" literally. 60-mi radius drawn as a Leaflet circle; severity shown by marker size/color. |
| Live AQI + forecast | Open-Meteo Air Quality API (`us_aqi`, `pm2_5`, `pm10`, `dust`, 48-h hourly) | Free, no API key (critical for a judging demo), CORS-open. Powers current readings, the "will worsen >101 shortly" logic, and dust-storm detection. |
| Address search | Nominatim (OpenStreetMap) primary + Open-Meteo geocoding fallback | Nominatim resolves full street addresses; Open-Meteo covers bare place names (see 3.4). |
| Location fallbacks | `navigator.geolocation` GPS button + tap-to-drop-pin on the map | A house location always works, even for addresses too new for any geocoder. |
| Routing | OSRM public router (in-app route + ETA) + Google Maps deep link | OSRM gives distance/time for the arrival-AQI prediction; the Google Maps link satisfies the spec's "redirect to Google Maps". |
| Town dataset | Hardcoded lat/lon in `towns.jsx`, Haversine-filtered to ≤ 60 mi from (46.28, −119.28) | 26 towns (Yakima dropped at ~62 mi). No runtime geocoding needed. |

**Run it:** double-click `index.html`, or `python -m http.server` then open
`http://localhost:8000` (use the server form for service-worker/offline support).


## 3. Problems encountered and how they were fixed

### 3.1 npm registry blocked → Vite scaffold impossible
**Symptom:** `npm create vite@latest` failed; `npm ping` and
`fetch(registry.npmjs.org)` timed out, while open-meteo, jsdelivr and unpkg all
returned HTTP 200 — a registry block on the user network, not a total outage.
`npm.cmd` also had to replace `npm.ps1` (PowerShell script-execution policy).
**Fix:** abandoned the Vite/build-step plan and built a **no-build React app**:
React + ReactDOM + Babel Standalone from CDN, JSX in plain `.jsx` files, no
`node_modules`, no compile step. Trade-off: internet needed on first load.

### 3.2 `file://` pages cannot use ES modules
**Symptom:** double-clicking `index.html` would break `import`/`export` (CORS).
**Fix:** IIFE modules exposing `window.Towns` / `window.AqiApi` /
`window.Advisory`, loaded as classic `text/babel` scripts in dependency order.

### 3.3 Editor 6 000-char write limit → file split
**Symptom:** the single-file `app.jsx` (~16 k chars) was rejected by the editor.
**Fix:** split UI into `app1.jsx`–`app4.jsx` (helpers/map, screens 1+3, screen 4,
app shell) and updated the script tags in `index.html`.

### 3.4 House search failed on full street addresses (user-reported bug)
**Symptom:** typing a real house address returned zero matches.
**Root cause:** the first implementation used only the Open-Meteo geocoder, which
knows *place names* ("Richland") but cannot resolve street addresses at all.
**Fix (in `api.jsx` + `app2.jsx`):** (1) primary Nominatim
`search?q=…&countrycodes=us` — resolves any "street, city, state" format
(verified live: "713 George Washington Way, Richland, WA" → correct hit),
retrying once with `, USA` appended when no ZIP is given; (2) Open-Meteo fallback
on the city/state portion for bare place names; (3) inline "no match" guidance
instead of an alert popup; (4) tap-to-drop-pin + GPS button so a house location
works even for addresses too new for any geocoder.

### 3.5 Leaflet map inside tabbed views renders grey
**Fix:** `map.invalidateSize()` after each render pass (`app1.jsx`).

### 3.6 Advisory safety guard (design point)
Per the spec ("Do NOT instruct the user to go out if there is a dust storm or
AQI > 125"), the `goOutsideBlocked` guard in `advisory.jsx` overrides *every*
evacuation recommendation — `gotoScreen4` stays false and shelter-in-place
instructions are issued instead. All five AQI branches were executed in Node and
verified (90 / 120 / 120+condition / 160+condition / 180).

### 3.7 PowerShell quoting pitfalls
Inline `node -e` checks mixing PowerShell variables failed; re-ran with pure-JS
file reads. `node --check` rejects `.jsx` extensions, so files were copied to
`.js` for syntax validation.

## 4. Verification performed
- `node --check` on logic files: pass; JSX brace-balance: 0.
- Live Open-Meteo current-AQI fetch for Tri-Cities: HTTP 200 with data.
- Live Nominatim street-address lookup: 2 hits, correct address.
- Advisory tree executed in Node across 5 cases: all correct, including the
  dust-storm / AQI > 125 travel block.

## 5. Known limitations / next steps
- First load needs internet (CDNs + live APIs); only the app shell is cached
  offline afterward.
- Public OSRM/Nominatim demo servers are rate-limited — fine for judging, but a
  production build should add keys (Mapbox/Google) or self-host.
- AQI is model forecast data, not a medical device — hence the disclaimer.
- Suggested demo aids: a README with screenshots, and a "demo smoke mode" with
  simulated high AQI so judges can click every advisory branch without waiting
  for real wildfire smoke.
