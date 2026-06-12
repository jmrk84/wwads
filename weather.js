const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

// Open-Meteo hourly times are local wall-clock with no offset ("YYYY-MM-DDTHH:mm").
// Parse as UTC so the trend charts' midnight gridlines land on round boundaries
// and day labels are formatted consistently regardless of the viewer's timezone.
function toUtcSec(iso) {
  const norm = (iso.length === 16 ? iso + ':00' : iso) + 'Z';
  return Math.floor(Date.parse(norm) / 1000);
}

export async function fetchForecast({ lat, lon }) {
  const url = new URL(FORECAST_URL);
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('current', [
    'temperature_2m',
    'relative_humidity_2m',
    'apparent_temperature',
    'is_day',
    'precipitation',
    'weather_code',
    'wind_speed_10m',
    'wind_direction_10m',
    'pressure_msl',
    'dew_point_2m'
  ].join(','));
  url.searchParams.set('hourly', [
    'temperature_2m',
    'precipitation_probability',
    'precipitation',
    'weather_code',
    'is_day',
    'dew_point_2m'
  ].join(','));
  url.searchParams.set('daily', [
    'weather_code',
    'temperature_2m_max',
    'temperature_2m_min',
    'precipitation_sum',
    'precipitation_probability_max',
    'sunrise',
    'sunset'
  ].join(','));
  url.searchParams.set('forecast_days', '6');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('wind_speed_unit', 'kmh');
  url.searchParams.set('temperature_unit', 'celsius');
  url.searchParams.set('precipitation_unit', 'mm');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Forecast request failed: ${res.status}`);
  const stale = res.headers.get('X-From-Cache') === '1';
  const data = await res.json();

  // Hourly: find current hour (matching data.current.time which is also wall-clock local) and take 24 hours.
  // Open-Meteo hourly times are hour-aligned ("YYYY-MM-DDTHH:00"); current.time may include minutes.
  // Match on the hour prefix, falling back to first time >= now.
  const allHours = data.hourly?.time || [];
  const nowIso = data.current?.time || '';
  const nowHourPrefix = nowIso.slice(0, 13); // "YYYY-MM-DDTHH"
  let startIdx = nowHourPrefix ? allHours.findIndex(t => t.startsWith(nowHourPrefix)) : -1;
  if (startIdx < 0 && nowIso) startIdx = allHours.findIndex(t => t >= nowIso);
  if (startIdx < 0) startIdx = 0;

  const hourly = [];
  for (let i = 0; i < 24; i++) {
    const idx = startIdx + i;
    if (idx >= allHours.length) break;
    hourly.push({
      time: allHours[idx],
      temp: data.hourly.temperature_2m?.[idx],
      precipProb: data.hourly.precipitation_probability?.[idx],
      precipMm: data.hourly.precipitation?.[idx],
      code: data.hourly.weather_code?.[idx],
      isDay: data.hourly.is_day?.[idx] === 1,
      dewPoint: data.hourly.dew_point_2m?.[idx]
    });
  }

  // Daily dew point: Open-Meteo doesn't aggregate it daily, so compute day-mean
  // and night-mean from the full hourly array using the is_day flag.
  const dewByDate = {};
  const dewArr = data.hourly?.dew_point_2m || [];
  const isDayArr = data.hourly?.is_day || [];
  for (let i = 0; i < allHours.length; i++) {
    const date = allHours[i].slice(0, 10);
    const v = dewArr[i];
    if (v == null) continue;
    if (!dewByDate[date]) {
      dewByDate[date] = { day: { sum: 0, count: 0 }, night: { sum: 0, count: 0 } };
    }
    const bucket = isDayArr[i] === 1 ? dewByDate[date].day : dewByDate[date].night;
    bucket.sum += v;
    bucket.count++;
  }
  const meanOf = b => (b && b.count > 0 ? b.sum / b.count : null);

  const dailyTimes = data.daily?.time || [];
  const daily = dailyTimes.slice(0, 6).map((date, i) => ({
    date,
    code: data.daily.weather_code?.[i],
    tmin: data.daily.temperature_2m_min?.[i],
    tmax: data.daily.temperature_2m_max?.[i],
    precipMm: data.daily.precipitation_sum?.[i],
    precipProb: data.daily.precipitation_probability_max?.[i],
    dewDayMean: meanOf(dewByDate[date]?.day),
    dewNightMean: meanOf(dewByDate[date]?.night)
  }));

  // 5-day hourly series for the trend charts (temperature °C, precip
  // probability %, precip amount mm). x is UTC-parsed seconds.
  const chartN = Math.min(allHours.length, 120);
  const chart = { t: [], temp: [], pop: [], mm: [] };
  for (let i = 0; i < chartN; i++) {
    chart.t.push(toUtcSec(allHours[i]));
    chart.temp.push(data.hourly.temperature_2m?.[i] ?? null);
    chart.pop.push(data.hourly.precipitation_probability?.[i] ?? 0);
    chart.mm.push(data.hourly.precipitation?.[i] ?? 0);
  }

  return {
    fetchedAt: Date.now(),
    timezone: data.timezone,
    stale,
    current: data.current,
    hourly,
    daily,
    chart
  };
}
