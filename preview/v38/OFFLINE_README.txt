FIELDNOTES V3.8 — OFFLINE-FIRST EXPERIMENTAL BUILD
The basic map index includes 34 provincial, 342 municipal and 3057 district/county names. Existing original administrative boundaries are bundled.
Bundled street tile demos are the nine tiles near each of: Lingshui county center (Hainan), Huangpu district center (Shanghai), Yanta district center (Xi-an). DO NOT claim nation-wide street map offline coverage.
No external map services are contacted by default. Missing local fine-grained map tiles fall back to existing genuine administrative outline; the app should not invent streets.
The same tools/build_offline_tiles.cjs script can be run on QLS and RTX3070 with Node 24; it respects OpenFreeMap download policy (<=3000 tiles or 50 MB, maximum 3 concurrent requests).
For Windows: keep the whole folder, open index.html directly. For iOS/Android PWA: install once over HTTPS while connected and verify Service Worker cache, then reopen in flight mode.
For China main networks: GitHub Pages accessibility has NOT been verified; domestic static delivery or native mobile package is the next distribution milestone.
OSM attribution is required and already included in composite: OpenFreeMap © OpenMapTiles Data from OpenStreetMap.
All photos are rendered locally; build script never reads or uploads private photos.
