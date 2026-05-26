const RAINVIEWER_INDEX = 'https://api.rainviewer.com/public/weather-maps.json';

let leafletLoading = null;
function ensureLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletLoading) return leafletLoading;
  leafletLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/leaflet/leaflet.js';
    s.onload = () => resolve(window.L);
    s.onerror = () => reject(new Error('Failed to load Leaflet'));
    document.head.appendChild(s);
  });
  return leafletLoading;
}

let map = null;
let rainLayers = [];
let frames = [];
let host = '';
let currentIdx = 0;
let playing = true;
let playTimer = null;
let lastLoadedAt = 0;

export async function mountRadar(container, city) {
  const L = await ensureLeaflet();

  if (!map) {
    map = L.map(container, {
      zoomControl: true,
      attributionControl: true
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
  }
  map.setView([city.lat, city.lon], 7);

  // Reload frames if older than 5 minutes
  if (!frames.length || Date.now() - lastLoadedAt > 5 * 60 * 1000) {
    await loadRainViewerFrames(L);
  } else {
    showFrame(currentIdx);
  }

  bindControls();
  if (!playing) startAnimation();
}

export function recenterRadar(city) {
  if (map) map.setView([city.lat, city.lon], map.getZoom() || 7);
}

async function loadRainViewerFrames(L) {
  rainLayers.forEach(l => map.removeLayer(l));
  rainLayers = [];

  const res = await fetch(RAINVIEWER_INDEX);
  if (!res.ok) throw new Error('RainViewer index failed: ' + res.status);
  const data = await res.json();
  host = data.host;
  const past = (data.radar && data.radar.past) || [];
  const nowcast = (data.radar && data.radar.nowcast) || [];
  frames = [...past, ...nowcast].map(f => ({ ...f, isNowcast: nowcast.includes(f) }));
  lastLoadedAt = Date.now();

  for (const f of frames) {
    const layer = L.tileLayer(
      `${host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`,
      { opacity: 0, tileSize: 256, zIndex: 10, attribution: '© RainViewer' }
    );
    layer.addTo(map);
    rainLayers.push(layer);
  }
  currentIdx = Math.max(0, past.length - 1);
  showFrame(currentIdx);
  updateSliderRange();
}

function showFrame(idx) {
  if (!rainLayers.length) return;
  rainLayers.forEach((l, i) => l.setOpacity(i === idx ? 0.7 : 0));
  currentIdx = idx;
  const slider = document.getElementById('radar-slider');
  if (slider) slider.value = String(idx);
  const label = document.getElementById('radar-time');
  if (label && frames[idx]) {
    const d = new Date(frames[idx].time * 1000);
    const tStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    label.textContent = frames[idx].isNowcast ? `${tStr} +` : tStr;
  }
}

function updateSliderRange() {
  const slider = document.getElementById('radar-slider');
  if (!slider) return;
  slider.min = '0';
  slider.max = String(Math.max(0, frames.length - 1));
  slider.value = String(currentIdx);
}

function startAnimation() {
  stopAnimation();
  playing = true;
  updatePlayButton();
  playTimer = setInterval(() => {
    let next = currentIdx + 1;
    if (next >= frames.length) next = 0;
    showFrame(next);
  }, 600);
}

function stopAnimation() {
  playing = false;
  if (playTimer) { clearInterval(playTimer); playTimer = null; }
  updatePlayButton();
}

function updatePlayButton() {
  const btn = document.getElementById('radar-play');
  if (btn) btn.textContent = playing ? '⏸' : '▶';
}

let controlsBound = false;
function bindControls() {
  if (controlsBound) return;
  const playBtn = document.getElementById('radar-play');
  const slider = document.getElementById('radar-slider');
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (playing) stopAnimation();
      else startAnimation();
    });
  }
  if (slider) {
    slider.addEventListener('input', () => {
      stopAnimation();
      showFrame(parseInt(slider.value, 10) || 0);
    });
  }
  controlsBound = true;
  // Auto-play on first mount
  startAnimation();
}
