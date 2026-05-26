import { store, searchCities, reverseGeocode, getCurrentLocation } from './cities.js';
import { fetchForecast } from './weather.js';
import {
  renderCurrent, renderNextHourRain, renderHourly, renderDaily,
  showForecastSkeleton, showToast, escapeHtml
} from './ui.js';

// Bump on each user-visible release. Also bump APP_VERSION in sw.js so caches invalidate.
const WWADS_VERSION = 'v0.7';
const versionTextEl = document.getElementById('version-text');
if (versionTextEl) versionTextEl.textContent = `wwads ${WWADS_VERSION}`;

// ===== Service worker =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('SW register failed:', err);
    });
  });
}

// ===== DOM refs =====
const $ = sel => document.querySelector(sel);
const chipsEl     = $('#chips');
const emptyEl     = $('#empty-state');
const tabsEl      = document.querySelector('.tabs');
const forecastEl  = $('#forecast-view');
const radarEl     = $('#radar-view');
const currentEl   = $('#current');
const nextHourEl  = $('#next-hour');
const hourlyEl    = $('#hourly');
const dailyEl     = $('#daily');

let currentTab = 'forecast';
let lastFetchedCityId = null;
let lastForecast = null;
let radarMounted = false;

// ===== Chip strip =====
function renderChips(state) {
  const { cities, selectedId } = state;
  chipsEl.innerHTML = cities.map(c => {
    const active = c.id === selectedId;
    return `
      <div class="chip ${active ? 'active' : ''}" role="tab" data-id="${escapeHtml(c.id)}" aria-selected="${active}" tabindex="0">
        <span>${escapeHtml(c.name)}</span>
        <button type="button" class="chip-remove" data-remove="${escapeHtml(c.id)}" aria-label="Remove ${escapeHtml(c.name)}">×</button>
      </div>
    `;
  }).join('');
}

chipsEl.addEventListener('click', (e) => {
  const removeBtn = e.target.closest('[data-remove]');
  if (removeBtn) {
    e.stopPropagation();
    const id = removeBtn.dataset.remove;
    const result = store.remove(id);
    if (result) {
      showToast({
        message: `Removed ${result.removed.name}`,
        actionLabel: 'Undo',
        onAction: () => store.restore(result.removed, result.index)
      });
    }
    return;
  }
  const chip = e.target.closest('.chip');
  if (chip) store.select(chip.dataset.id);
});

// ===== View / tabs =====
function updateView() {
  const hasCities = store.state.cities.length > 0;
  emptyEl.hidden = hasCities;
  tabsEl.hidden = !hasCities;

  if (!hasCities) {
    forecastEl.hidden = true;
    radarEl.hidden = true;
    lastFetchedCityId = null;
    return;
  }

  forecastEl.hidden = currentTab !== 'forecast';
  radarEl.hidden = currentTab !== 'radar';

  const selected = store.getSelected();
  if (!selected) return;

  if (currentTab === 'forecast') {
    if (selected.id !== lastFetchedCityId) {
      loadForecast(selected);
    }
  } else if (currentTab === 'radar') {
    mountOrUpdateRadar(selected);
  }
}

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => {
      const isActive = b === btn;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    currentTab = btn.dataset.tab;
    updateView();
  });
});

// ===== Forecast =====
async function loadForecast(city) {
  lastFetchedCityId = city.id;
  showForecastSkeleton(currentEl, nextHourEl, hourlyEl, dailyEl);
  try {
    const data = await fetchForecast({ lat: city.lat, lon: city.lon });
    // If the user has switched away while we fetched, ignore.
    if (store.state.selectedId !== city.id) return;
    lastForecast = data;
    renderCurrent(currentEl, data, city);
    renderNextHourRain(nextHourEl, data);
    renderHourly(hourlyEl, data);
    renderDaily(dailyEl, data);
  } catch (err) {
    console.error('Forecast failed:', err);
    currentEl.innerHTML = `<div class="error-card">Failed to load forecast: ${escapeHtml(err.message || 'unknown error')}</div>`;
    nextHourEl.innerHTML = '';
    hourlyEl.innerHTML = '';
    dailyEl.innerHTML = '';
  }
}

// ===== Radar (lazy) =====
let radarApi = null;
async function mountOrUpdateRadar(city) {
  try {
    const mod = await import('./radar.js');
    if (!radarMounted) {
      await mod.mountRadar(document.getElementById('map'), city);
      radarMounted = true;
      radarApi = mod;
    } else {
      mod.recenterRadar(city);
    }
  } catch (err) {
    console.error('Radar failed:', err);
    showToast({ message: 'Radar failed to load' });
  }
}

// ===== Search dialog =====
const searchDialog  = $('#search-dialog');
const searchInput   = $('#search-input');
const searchResults = $('#search-results');
const searchClose   = $('#search-close');

let searchTimer = null;
let searchSeq = 0;

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = searchInput.value.trim();
  if (q.length < 2) {
    searchResults.innerHTML = '';
    return;
  }
  const mySeq = ++searchSeq;
  searchTimer = setTimeout(async () => {
    try {
      const results = await searchCities(q);
      if (mySeq !== searchSeq) return; // outdated
      renderSearchResults(results);
    } catch {
      if (mySeq !== searchSeq) return;
      searchResults.innerHTML = `<li class="empty">Search failed.</li>`;
    }
  }, 250);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const first = searchResults.querySelector('li[data-idx]');
    if (first) first.click();
  }
});

function renderSearchResults(results) {
  if (!results.length) {
    searchResults.innerHTML = `<li class="empty">No matches.</li>`;
    return;
  }
  searchResults.innerHTML = results.map((r, i) => `
    <li data-idx="${i}" role="option">
      <div>${escapeHtml(r.name)}${r.admin1 && r.admin1 !== r.name ? `, ${escapeHtml(r.admin1)}` : ''}</div>
      <div class="meta">${escapeHtml(r.country || '')}${r.country ? ' · ' : ''}${r.lat.toFixed(2)}, ${r.lon.toFixed(2)}</div>
    </li>
  `).join('');
  searchResults.querySelectorAll('li[data-idx]').forEach(li => {
    li.addEventListener('click', () => {
      const r = results[parseInt(li.dataset.idx, 10)];
      const entry = store.add(r);
      store.select(entry.id);
      closeSearch();
    });
  });
}

function openSearch() {
  searchInput.value = '';
  searchResults.innerHTML = '';
  if (typeof searchDialog.showModal === 'function') {
    searchDialog.showModal();
  } else {
    searchDialog.setAttribute('open', '');
  }
  setTimeout(() => searchInput.focus(), 60);
}

function closeSearch() {
  if (typeof searchDialog.close === 'function') searchDialog.close();
  else searchDialog.removeAttribute('open');
}

searchClose.addEventListener('click', closeSearch);
searchDialog.addEventListener('click', (e) => {
  // backdrop click (clicked the dialog element itself, not its children)
  if (e.target === searchDialog) closeSearch();
});

$('#btn-add-search').addEventListener('click', openSearch);
$('#empty-add-search').addEventListener('click', openSearch);

// ===== Add current location =====
async function addCurrentLocation() {
  try {
    const { lat, lon } = await getCurrentLocation();
    const city = await reverseGeocode(lat, lon);
    const entry = store.add(city);
    store.select(entry.id);
  } catch (err) {
    const msg = err && err.code === 1
      ? 'Location permission denied'
      : (err && err.code === 3 ? 'Location request timed out' : 'Could not get current location');
    showToast({ message: msg });
  }
}

$('#btn-add-current').addEventListener('click', addCurrentLocation);
$('#empty-add-current').addEventListener('click', addCurrentLocation);

// ===== Store subscription =====
store.subscribe((state) => {
  renderChips(state);
  updateView();
  // If selected city changed but tab is radar, recenter live.
  const sel = store.getSelected();
  if (sel && currentTab === 'radar' && radarMounted && radarApi) {
    radarApi.recenterRadar(sel);
  }
});

// ===== Initial render =====
renderChips(store.state);
updateView();
