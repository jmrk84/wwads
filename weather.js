const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

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
    'pressure_msl'
  ].join(','));
  url.searchParams.set('hourly', [
    'temperature_2m',
    'precipitation_probability',
    'precipitation',
    'weather_code',
    'is_day'
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
  const allHours = data.hourly?.time || [];
  const nowIso = data.current?.time;
  let startIdx = allHours.indexOf(nowIso);
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
      isDay: data.hourly.is_day?.[idx] === 1
    });
  }

  const dailyTimes = data.daily?.time || [];
  const daily = dailyTimes.slice(0, 6).map((date, i) => ({
    date,
    code: data.daily.weather_code?.[i],
    tmin: data.daily.temperature_2m_min?.[i],
    tmax: data.daily.temperature_2m_max?.[i],
    precipMm: data.daily.precipitation_sum?.[i],
    precipProb: data.daily.precipitation_probability_max?.[i]
  }));

  return {
    fetchedAt: Date.now(),
    timezone: data.timezone,
    stale,
    current: data.current,
    hourly,
    daily
  };
}
