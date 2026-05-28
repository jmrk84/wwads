const KEY = 'wwads:v1';
const OM_GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search';
const BIGDATA_REV = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { cities: [], selectedId: null, unit: 'c' };
    const data = JSON.parse(raw);
    return {
      cities: Array.isArray(data.cities) ? data.cities : [],
      selectedId: data.selectedId || null,
      unit: data.unit === 'f' ? 'f' : 'c'
    };
  } catch {
    return { cities: [], selectedId: null, unit: 'c' };
  }
}

function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export const store = {
  state: load(),
  listeners: new Set(),

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit() { for (const fn of this.listeners) fn(this.state); },

  add(city) {
    const entry = { id: uid(), ...city };
    this.state.cities.push(entry);
    if (!this.state.selectedId) this.state.selectedId = entry.id;
    save(this.state);
    this.emit();
    return entry;
  },

  remove(id) {
    const idx = this.state.cities.findIndex(c => c.id === id);
    if (idx < 0) return null;
    const [removed] = this.state.cities.splice(idx, 1);
    if (this.state.selectedId === id) {
      this.state.selectedId = this.state.cities[0]?.id ?? null;
    }
    save(this.state);
    this.emit();
    return { removed, index: idx };
  },

  restore(city, index) {
    this.state.cities.splice(index, 0, city);
    if (!this.state.selectedId) this.state.selectedId = city.id;
    save(this.state);
    this.emit();
  },

  select(id) {
    if (this.state.selectedId === id) return;
    if (!this.state.cities.some(c => c.id === id)) return;
    this.state.selectedId = id;
    save(this.state);
    this.emit();
  },

  setUnit(u) {
    const next = u === 'f' ? 'f' : 'c';
    if (this.state.unit === next) return;
    this.state.unit = next;
    save(this.state);
    this.emit();
  },

  getSelected() {
    return this.state.cities.find(c => c.id === this.state.selectedId) ?? null;
  }
};

export async function searchCities(query) {
  const url = new URL(OM_GEOCODE);
  url.searchParams.set('name', query);
  url.searchParams.set('count', '8');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');
  const res = await fetch(url);
  if (!res.ok) throw new Error('Geocoding failed');
  const data = await res.json();
  return (data.results || []).map(r => ({
    name: r.name,
    country: r.country_code || r.country || '',
    admin1: r.admin1 || '',
    lat: r.latitude,
    lon: r.longitude
  }));
}

export async function reverseGeocode(lat, lon) {
  try {
    const url = new URL(BIGDATA_REV);
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('localityLanguage', 'en');
    const res = await fetch(url);
    if (!res.ok) throw new Error('reverse geocode http ' + res.status);
    const data = await res.json();
    const name = data.city || data.locality || data.principalSubdivision || `Location`;
    return {
      name,
      country: data.countryCode || '',
      admin1: data.principalSubdivision || '',
      lat,
      lon
    };
  } catch {
    return {
      name: `Location (${lat.toFixed(2)}, ${lon.toFixed(2)})`,
      country: '',
      admin1: '',
      lat,
      lon
    };
  }
}

export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error('Geolocation not available'));
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}
