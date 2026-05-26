# wwads — weather without ads

Open-source weather PWA. No accounts, no ads, no tracking.

- **Forecast**: current conditions + next 24 hours + 5-day forecast, from [Open-Meteo](https://open-meteo.com/) (free, no API key).
- **Rain radar**: animated past ~2 hours + ~30 min nowcast, from [RainViewer](https://www.rainviewer.com/) (free, no API key). Covers UK and Germany via DWD and Met Office data.
- **Multi-city**: pin cities to the top strip and switch with one tap. Add your current location with one button.
- **Installable PWA**: works offline (shows last-fetched data with a "cached" badge), installs to your Android home screen.

## Stack

Vanilla HTML/CSS/JS, ES modules, no build step. [Leaflet](https://leafletjs.com/) is vendored under `vendor/leaflet/` (BSD-2-Clause). Service worker caches the app shell and last API responses.

## Local dev

Any static HTTP server works (PWA features need HTTP, not `file://`). For example:

```
python -m http.server 8000
```

Then open <http://localhost:8000/>.

## Deploy

GitHub Pages, served from the `main` branch root at `https://jmrk84.github.io/wwads/`.

## Attribution

- Weather data © [Open-Meteo](https://open-meteo.com/)
- Radar © [RainViewer](https://www.rainviewer.com/) (DWD, Met Office, and others)
- Map © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
- Reverse geocoding © [BigDataCloud](https://www.bigdatacloud.com/)
- Map library: [Leaflet](https://leafletjs.com/) (BSD-2-Clause, see `vendor/leaflet/LICENSE`)
