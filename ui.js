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

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function fmtTemp(t) { return t == null ? '—' : `${Math.round(t)}°`; }
export function fmtTempFull(t) { return t == null ? '—' : `${Math.round(t)}°C`; }

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
  container.innerHTML = `
    <div class="current-top">
      <div class="current-icon" aria-hidden="true">${info.icon}</div>
      <div>
        <div class="current-temp">${fmtTempFull(c.temperature_2m)} ${staleBadge}</div>
        <div class="current-label">${escapeHtml(info.label)} · feels ${fmtTempFull(c.apparent_temperature)}</div>
        <div class="current-label current-place">${escapeHtml(placeLine(city))}</div>
      </div>
    </div>
    <div class="current-meta">
      <div>Humidity<strong>${c.relative_humidity_2m ?? '—'}%</strong></div>
      <div>Wind<strong>${Math.round(c.wind_speed_10m ?? 0)} km/h</strong></div>
      <div>Precip<strong>${(c.precipitation ?? 0).toFixed(1)} mm</strong></div>
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
  const sunIcon = next.isDay ? '☀️' : '🌙';
  const icons = sunIcon.repeat(suns) + '💧'.repeat(drops);
  container.innerHTML = `
    <div class="next-hour-icons" aria-hidden="true">${icons}</div>
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
    return `
      <div class="hour ${dayBadge ? 'hour-daybreak' : ''}" title="${escapeHtml(info.label)}">
        <div class="hour-day">${dayBadge}</div>
        <div class="hour-time">${label}</div>
        <div class="hour-icon" aria-hidden="true">${info.icon}</div>
        <div class="hour-temp">${fmtTemp(h.temp)}</div>
        <div class="hour-precip">${showPrecip ? `💧${h.precipProb}%` : ''}</div>
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
  container.innerHTML = days.map((d, i) => {
    const info = weatherInfo(d.code, true);
    const probTxt = (d.precipProb ?? 0) >= 10 ? `💧${d.precipProb}%` : '';
    const mmTxt = (d.precipMm ?? 0) > 0 ? `${d.precipMm.toFixed(1)} mm` : '';
    const precipLine = [probTxt, mmTxt].filter(Boolean).join(' · ');
    return `
      <div class="day">
        <div class="day-name">${escapeHtml(fmtDay(d.date, i))}</div>
        <div class="day-icon" title="${escapeHtml(info.label)}" aria-hidden="true">${info.icon}</div>
        <div class="day-precip">${precipLine}</div>
        <div class="day-temps">
          <span class="hi">${fmtTemp(d.tmax)}</span><span class="lo">${fmtTemp(d.tmin)}</span>
        </div>
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
