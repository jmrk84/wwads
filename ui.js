// WMO weather code interpretation
// https://open-meteo.com/en/docs#weathervariables
const WMO = {
  0:  { day: ['☀️', 'Clear'],            night: ['🌙', 'Clear'] },
  1:  { day: ['🌤', 'Mainly clear'],      night: ['🌙', 'Mainly clear'] },
  2:  { day: ['⛅', 'Partly cloudy'],      night: ['☁️', 'Partly cloudy'] },
  3:  { day: ['☁️', 'Overcast'],          night: ['☁️', 'Overcast'] },
  45: { day: ['🌫', 'Fog'],               night: ['🌫', 'Fog'] },
  48: { day: ['🌫', 'Rime fog'],          night: ['🌫', 'Rime fog'] },
  51: { day: ['🌦', 'Light drizzle'],     night: ['🌧', 'Light drizzle'] },
  53: { day: ['🌦', 'Drizzle'],           night: ['🌧', 'Drizzle'] },
  55: { day: ['🌧', 'Heavy drizzle'],     night: ['🌧', 'Heavy drizzle'] },
  56: { day: ['🌧', 'Freezing drizzle'],  night: ['🌧', 'Freezing drizzle'] },
  57: { day: ['🌧', 'Freezing drizzle'],  night: ['🌧', 'Freezing drizzle'] },
  61: { day: ['🌦', 'Light rain'],        night: ['🌧', 'Light rain'] },
  63: { day: ['🌧', 'Rain'],              night: ['🌧', 'Rain'] },
  65: { day: ['🌧', 'Heavy rain'],        night: ['🌧', 'Heavy rain'] },
  66: { day: ['🌧', 'Freezing rain'],     night: ['🌧', 'Freezing rain'] },
  67: { day: ['🌧', 'Freezing rain'],     night: ['🌧', 'Freezing rain'] },
  71: { day: ['🌨', 'Light snow'],        night: ['🌨', 'Light snow'] },
  73: { day: ['🌨', 'Snow'],              night: ['🌨', 'Snow'] },
  75: { day: ['❄️', 'Heavy snow'],        night: ['❄️', 'Heavy snow'] },
  77: { day: ['🌨', 'Snow grains'],       night: ['🌨', 'Snow grains'] },
  80: { day: ['🌦', 'Light showers'],     night: ['🌧', 'Light showers'] },
  81: { day: ['🌧', 'Showers'],           night: ['🌧', 'Showers'] },
  82: { day: ['⛈', 'Heavy showers'],      night: ['⛈', 'Heavy showers'] },
  85: { day: ['🌨', 'Snow showers'],      night: ['🌨', 'Snow showers'] },
  86: { day: ['🌨', 'Heavy snow showers'],night: ['🌨', 'Heavy snow showers'] },
  95: { day: ['⛈', 'Thunderstorm'],       night: ['⛈', 'Thunderstorm'] },
  96: { day: ['⛈', 'Thunderstorm + hail'],night: ['⛈', 'Thunderstorm + hail'] },
  99: { day: ['⛈', 'Severe thunderstorm'],night: ['⛈', 'Severe thunderstorm'] }
};

export function weatherInfo(code, isDay = true) {
  const entry = WMO[code];
  if (!entry) return { icon: '❓', label: 'Unknown' };
  const [icon, label] = isDay ? entry.day : entry.night;
  return { icon, label };
}

// Convert an emoji string to its Twemoji filename
// (lowercase hex codepoints joined by '-', U+FE0F variation selector stripped).
function emojiCodepoint(emoji) {
  const cps = [];
  for (const ch of emoji) {
    const cp = ch.codePointAt(0);
    if (cp === 0xFE0F) continue;
    cps.push(cp.toString(16));
  }
  return cps.join('-');
}

// Render a single emoji as a vendored Twemoji <img>. Decorative by default
// (alt="" + aria-hidden) — surrounding text labels provide the semantics.
export function emojiImg(char) {
  return `<img class="emoji" src="vendor/twemoji/${emojiCodepoint(char)}.svg" alt="" aria-hidden="true" draggable="false">`;
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Display unit ('c' or 'f'). Module-level so all formatters share it without
// every render function needing to thread it through.
let _unit = 'c';
export function setUnit(u) { _unit = (u === 'f' ? 'f' : 'c'); }
export function getUnit() { return _unit; }
export function toDisplay(c) { return _unit === 'f' ? c * 9 / 5 + 32 : c; }
export function unitSuffix() { return _unit === 'f' ? '°F' : '°C'; }

// Map a temperature (always °C, so colors stay physically meaningful regardless
// of the display unit) onto a cold-blue → hot-red hue ramp for the range bars.
function tempColor(c) {
  const t = Math.max(-10, Math.min(38, c));
  const hue = 220 - ((t + 10) / 48) * 220; // -10°C → 220 (blue), 38°C → 0 (red)
  return `hsl(${hue.toFixed(0)}, 72%, 52%)`;
}

export function fmtTemp(t) { return t == null ? '—' : `${Math.round(toDisplay(t))}°`; }
export function fmtTempFull(t) { return t == null ? '—' : `${Math.round(toDisplay(t))}${unitSuffix()}`; }

// Dew-point comfort scale (°C). Brackets match the standard meteorological
// summary used by NWS / Wikipedia: humidity perception correlates more with
// dew point than relative humidity.
export function dewComfort(t) {
  if (t == null || Number.isNaN(t)) return null;
  if (t < 10) return 'Dry';
  if (t < 13) return 'Comfortable';
  if (t < 16) return 'Pleasant';
  if (t < 20) return 'Humid';
  if (t < 24) return 'Muggy';
  return 'Oppressive';
}

// Open-Meteo with timezone=auto returns wall-clock local time strings (no TZ suffix).
// We must format them as strings, not Date objects, to avoid timezone skew when viewing other cities.
export function fmtHour(iso) {
  return iso.slice(11, 16);
}

export function fmtDay(iso, idx) {
  if (idx === 0) return 'Today';
  if (idx === 1) return 'Tomorrow';
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC'
  });
}

export function placeLine(city) {
  const parts = [city.name];
  if (city.admin1 && city.admin1 !== city.name) parts.push(city.admin1);
  if (city.country) parts.push(city.country);
  return parts.join(' · ');
}

export function renderCurrent(container, data, city) {
  const c = data.current;
  if (!c) {
    container.innerHTML = `<div class="error-card">No data available.</div>`;
    return;
  }
  const info = weatherInfo(c.weather_code, c.is_day === 1);
  const staleBadge = data.stale
    ? `<span class="stale-badge" title="Showing last-fetched data (offline)">cached</span>`
    : '';
  const dewVal = c.dew_point_2m;
  const comfort = dewComfort(dewVal);
  const u = getUnit();
  const dewDisplay = dewVal != null ? `${Math.round(toDisplay(dewVal))}${unitSuffix()}` : '—';
  const toggleHtml = `
    <div class="unit-toggle current-unit-toggle" role="group" aria-label="Temperature unit">
      <button type="button" class="unit-opt ${u === 'c' ? 'active' : ''}" data-unit="c" aria-pressed="${u === 'c'}" title="Celsius">°C</button>
      <button type="button" class="unit-opt ${u === 'f' ? 'active' : ''}" data-unit="f" aria-pressed="${u === 'f'}" title="Fahrenheit">°F</button>
    </div>`;
  container.innerHTML = `
    <div class="current-top">
      <div class="current-icon">${emojiImg(info.icon)}</div>
      <div class="current-text">
        <div class="current-header-row">
          <div class="current-temp">${fmtTempFull(c.temperature_2m)} ${staleBadge}</div>
          ${toggleHtml}
        </div>
        <div class="current-label">${escapeHtml(info.label)} · feels ${fmtTempFull(c.apparent_temperature)}${comfort ? ` · ${escapeHtml(comfort)}` : ''}</div>
        <div class="current-label current-place">${escapeHtml(placeLine(city))}</div>
      </div>
    </div>
    <div class="current-meta">
      <div>Humidity<strong>${c.relative_humidity_2m ?? '—'}%</strong></div>
      <div>Dew point<strong>${dewDisplay}</strong></div>
      <div>Precip<strong>${(c.precipitation ?? 0).toFixed(1)} mm</strong></div>
      <div>Wind<strong>${Math.round(c.wind_speed_10m ?? 0)} km/h</strong></div>
      <div>Pressure<strong>${Math.round(c.pressure_msl ?? 0)} hPa</strong></div>
    </div>
  `;
}

function dayShort(dateIso) {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', timeZone: 'UTC'
  });
}

export function renderNextHourRain(container, data) {
  const next = data.hourly?.[0];
  if (!next || next.precipProb == null) {
    container.innerHTML = '';
    return;
  }
  const prob = Math.max(0, Math.min(100, Math.round(next.precipProb)));
  // 5-step gradient: suns at left replaced by drops as probability rises.
  const drops = Math.round(prob / 20);
  const suns = 5 - drops;
  const sunImg = emojiImg(next.isDay ? '☀️' : '🌙');
  const dropImg = emojiImg('💧');
  const icons = sunImg.repeat(suns) + dropImg.repeat(drops);
  container.innerHTML = `
    <div class="next-hour-icons">${icons}</div>
    <div class="next-hour-meta">
      <span class="next-hour-title">Next hour</span>
      <strong>${prob}% rain</strong>
    </div>
  `;
}

export function renderHourly(container, data) {
  if (!data.hourly?.length) {
    container.innerHTML = `<div style="padding:8px;color:var(--text-muted)">No hourly data.</div>`;
    return;
  }
  let prevDate = null;
  container.innerHTML = data.hourly.map((h, i) => {
    const info = weatherInfo(h.code, h.isDay);
    const label = i === 0 ? 'Now' : escapeHtml(fmtHour(h.time));
    const showPrecip = (h.precipProb ?? 0) >= 10;
    const date = h.time.slice(0, 10);
    const dayBadge = (i > 0 && date !== prevDate) ? escapeHtml(dayShort(date)) : '';
    prevDate = date;
    const dewTxt = h.dewPoint != null ? `dew ${fmtTemp(h.dewPoint)}` : '';
    return `
      <div class="hour ${dayBadge ? 'hour-daybreak' : ''}" title="${escapeHtml(info.label)}">
        <div class="hour-day">${dayBadge}</div>
        <div class="hour-time">${label}</div>
        <div class="hour-icon">${emojiImg(info.icon)}</div>
        <div class="hour-temp">${fmtTemp(h.temp)}</div>
        <div class="hour-dew">${dewTxt}</div>
        <div class="hour-precip">${showPrecip ? `${emojiImg('💧')}${h.precipProb}%` : ''}</div>
      </div>
    `;
  }).join('');
}

export function renderDaily(container, data) {
  const days = (data.daily || []).slice(0, 5);
  if (!days.length) {
    container.innerHTML = `<div style="padding:12px;color:var(--text-muted)">No daily data.</div>`;
    return;
  }
  // Map each day's low→high onto the whole week's range so the bars are
  // comparable across rows (the Apple/Pixel "shape of the week" pattern).
  let weekMin = Infinity, weekMax = -Infinity;
  for (const d of days) {
    if (d.tmin != null) weekMin = Math.min(weekMin, d.tmin);
    if (d.tmax != null) weekMax = Math.max(weekMax, d.tmax);
  }
  if (!isFinite(weekMin) || !isFinite(weekMax)) { weekMin = 0; weekMax = 1; }
  const span = (weekMax - weekMin) || 1;
  const curTemp = data.current?.temperature_2m;

  container.innerHTML = days.map((d, i) => {
    const info = weatherInfo(d.code, true);

    let bar = '';
    if (d.tmin != null && d.tmax != null) {
      const leftPct = ((d.tmin - weekMin) / span) * 100;
      const rightPct = ((weekMax - d.tmax) / span) * 100;
      const grad = `linear-gradient(to right, ${tempColor(d.tmin)}, ${tempColor(d.tmax)})`;
      let dot = '';
      if (i === 0 && curTemp != null) {
        const dotPct = Math.max(0, Math.min(100, ((curTemp - weekMin) / span) * 100));
        dot = `<span class="day-bar-dot" style="left:${dotPct}%" title="Now ${fmtTemp(curTemp)}"></span>`;
      }
      bar = `<span class="day-bar-fill" style="left:${leftPct.toFixed(1)}%;right:${rightPct.toFixed(1)}%;background:${grad}"></span>${dot}`;
    }

    const probTxt = (d.precipProb ?? 0) >= 10 ? `<span class="s-precip">${emojiImg('💧')}${d.precipProb}%</span>` : '';
    const dewTxt = (d.dewDayMean != null || d.dewNightMean != null)
      ? `<span class="s-dew">dew <strong>${d.dewDayMean != null ? fmtTemp(d.dewDayMean) : '—'}</strong> / ${d.dewNightMean != null ? fmtTemp(d.dewNightMean) : '—'}</span>`
      : '';
    const sub = (probTxt || dewTxt) ? `<div class="day-sub">${probTxt}${dewTxt}</div>` : '';

    return `
      <div class="day">
        <span class="day-name">${escapeHtml(fmtDay(d.date, i))}</span>
        <span class="day-icon" title="${escapeHtml(info.label)}">${emojiImg(info.icon)}</span>
        <span class="day-lo">${fmtTemp(d.tmin)}</span>
        <div class="day-bar">${bar}</div>
        <span class="day-hi">${fmtTemp(d.tmax)}</span>
        ${sub}
      </div>
    `;
  }).join('');
}

export function showForecastSkeleton(currentEl, nextHourEl, hourlyEl, dailyEl) {
  currentEl.innerHTML = `<div class="skeleton" style="height:140px;"></div>`;
  if (nextHourEl) nextHourEl.innerHTML = `<div class="skeleton" style="height:42px;margin:8px 0 12px;"></div>`;
  hourlyEl.innerHTML = Array.from({ length: 8 })
    .map(() => `<div class="hour skeleton" style="height:112px;flex:0 0 64px;background-clip:padding-box;"></div>`)
    .join('');
  dailyEl.innerHTML = Array.from({ length: 5 })
    .map(() => `<div style="height:46px;border-bottom:1px solid var(--border)" class="skeleton"></div>`)
    .join('');
}

export function showToast({ message, actionLabel, onAction, durationMs = 4000 }) {
  const host = document.getElementById('toast-host');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast';
  const span = document.createElement('span');
  span.textContent = message;
  el.appendChild(span);
  let timer;
  const dismiss = () => {
    clearTimeout(timer);
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    el.style.transition = 'opacity 150ms, transform 150ms';
    setTimeout(() => el.remove(), 160);
  };
  if (actionLabel) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = actionLabel;
    btn.onclick = () => { onAction?.(); dismiss(); };
    el.appendChild(btn);
  }
  host.appendChild(el);
  timer = setTimeout(dismiss, durationMs);
}
