# wwads — weather without ads

Open-source weather PWA. No accounts, no ads, no tracking.

- **Forecast**: current conditions + next 24 hours + 5-day forecast, from [Open-Meteo](https://open-meteo.com/) (free, no API key).
- **Rain radar**: animated past ~2 hours + ~30 min nowcast, from [RainViewer](https://www.rainviewer.com/) (free, no API key).
- **Multi-city**: pin cities to the top strip and switch with one tap. Add your current location with one button.
- **Installable PWA**: works offline (shows last-fetched data with a "cached" badge), installs to the home screen on Android and iOS.

## Install

### Android (Chrome)

1. Open <https://jmrk84.github.io/wwads/> in Chrome.
2. Three-dot menu → **Install app** (or tap the install banner if it appears).

### iOS (Safari)

1. Open <https://jmrk84.github.io/wwads/> in **Safari** — Chrome and Firefox on iOS can't install PWAs.
2. Tap the **Share** button (square with arrow up).
3. Scroll down and tap **Add to Home Screen** → **Add**.

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

- Weather data by [Open-Meteo](https://open-meteo.com/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Radar © [RainViewer](https://www.rainviewer.com/)
- Map © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
- Reverse geocoding by [BigDataCloud](https://www.bigdatacloud.com/)
- Map library: [Leaflet](https://leafletjs.com/) (BSD-2-Clause, see `vendor/leaflet/LICENSE`)

## License

MIT — see [LICENSE](LICENSE). Vendored Leaflet under `vendor/leaflet/` retains its own BSD-2-Clause license.
