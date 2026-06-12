// Lazy-loaded uPlot trend panels:
//   - 5-day temperature: filled area, colored by temperature value
//   - 5-day rain: height = precip probability, color = precip intensity (mm)
// uPlot is vendored under vendor/uplot/ and loaded on first render.

const TSTOPS = [[-10,'#2b59c3'],[0,'#2aa9c2'],[8,'#3fb56b'],[16,'#e6c235'],[24,'#ef8a3c'],[32,'#e0483c']];
const TFILL  = [[-10,'rgba(43,89,195,0.45)'],[0,'rgba(42,169,194,0.45)'],[8,'rgba(63,181,107,0.45)'],[16,'rgba(230,194,53,0.5)'],[24,'rgba(239,138,60,0.55)'],[32,'rgba(224,72,60,0.6)']];
const TEXT_COL = '#5b6b85';
const GRID_COL = 'rgba(20,40,80,0.08)';
const AXIS_FONT = '11px -apple-system, system-ui, sans-serif';
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const CHART_H = 96;

let uplotLoading = null;
function ensureUplot() {
  if (window.uPlot) return Promise.resolve(window.uPlot);
  if (uplotLoading) return uplotLoading;
  uplotLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/uplot/uPlot.iife.min.js';
    s.onload = () => resolve(window.uPlot);
    s.onerror = () => reject(new Error('uPlot load failed'));
    document.head.appendChild(s);
  });
  return uplotLoading;
}

let uTemp = null, uRain = null, ro = null, renderSeq = 0;

function fmtDay(t) { const d = new Date(t * 1000); return DOW[d.getUTCDay()] + ' ' + d.getUTCDate(); }

function dayAxis(midnights) {
  return { scale: 'x', stroke: TEXT_COL, font: AXIS_FONT, size: 26,
    grid: { stroke: GRID_COL, width: 1 }, ticks: { stroke: GRID_COL, width: 1, size: 3 },
    splits: (u, ai, min, max) => midnights.filter(t => t >= min && t <= max),
    values: (u, sp) => sp.map(fmtDay) };
}
function tempYAxis(unit) {
  return { scale: 'y', stroke: TEXT_COL, font: AXIS_FONT, size: 34,
    grid: { stroke: GRID_COL, width: 1 }, ticks: { stroke: GRID_COL, width: 1, size: 3 },
    values: (u, sp) => sp.map(v => Math.round(unit === 'f' ? v * 9 / 5 + 32 : v) + '°') };
}
function rainYAxis() {
  return { scale: 'y', stroke: TEXT_COL, font: AXIS_FONT, size: 34,
    grid: { stroke: GRID_COL, width: 1 }, ticks: { stroke: GRID_COL, width: 1, size: 3 },
    splits: [0, 50, 100],
    values: (u, sp) => sp.map(v => Math.round(v) + '%') };
}

// Vertical gradient keyed to the y-scale (used for the temperature color/fill).
function gradV(u, stops) {
  const min = u.scales.y.min, max = u.scales.y.max, range = (max - min) || 1;
  const y0 = u.valToPos(min, 'y', true), y1 = u.valToPos(max, 'y', true);
  const g = u.ctx.createLinearGradient(0, y0, 0, y1);
  let last = -1;
  for (const s of stops) {
    let p = (s[0] - min) / range;
    p = Math.max(0, Math.min(1, p));
    if (p <= last) p = last + 0.0001;
    if (p > 1) continue;
    g.addColorStop(p, s[1]); last = p;
  }
  return g;
}

function mmColor(v) {
  if (v <= 0)  return '#dce8f5';
  if (v < 0.2) return '#bcd6f0';
  if (v < 0.5) return '#86bdeb';
  if (v < 1.0) return '#4f93da';
  if (v < 2.0) return '#2f5fc0';
  if (v < 4.0) return '#333aa6';
  return '#6a2fae';
}

// Horizontal gradient across time, colored by hourly precip intensity (mm).
function precipFill(chart) {
  return (u) => {
    const min = u.scales.x.min, max = u.scales.x.max, range = (max - min) || 1;
    const x0 = u.valToPos(min, 'x', true), x1 = u.valToPos(max, 'x', true);
    const g = u.ctx.createLinearGradient(x0, 0, x1, 0);
    let last = -1;
    for (let i = 0; i < chart.t.length; i++) {
      let p = (chart.t[i] - min) / range;
      if (p < 0 || p > 1) continue;
      p = Math.max(0, Math.min(1, p));
      if (p <= last) p = last + 0.00001;
      last = p;
      g.addColorStop(p, mmColor(chart.mm[i]));
    }
    return g;
  };
}

function destroyCharts() {
  if (uTemp) { try { uTemp.destroy(); } catch (e) {} uTemp = null; }
  if (uRain) { try { uRain.destroy(); } catch (e) {} uRain = null; }
}

export async function renderTrendCharts(tempEl, rainEl, chart, unit) {
  const seq = ++renderSeq;
  if (!chart || !chart.t || chart.t.length < 2) {
    destroyCharts(); tempEl.innerHTML = ''; rainEl.innerHTML = '';
    return;
  }
  let uPlot;
  try {
    uPlot = await ensureUplot();
  } catch {
    destroyCharts();
    tempEl.innerHTML = '<div class="chart-fallback">Charts unavailable</div>';
    rainEl.innerHTML = '';
    return;
  }
  if (seq !== renderSeq) return; // a newer render superseded this one

  destroyCharts();
  tempEl.innerHTML = '';
  rainEl.innerHTML = '';
  const spline = uPlot.paths.spline();
  const midnights = chart.t.filter(t => t % 86400 === 0);
  const wT = tempEl.clientWidth || 320;
  const wR = rainEl.clientWidth || 320;

  uTemp = new uPlot({
    width: wT, height: CHART_H, cursor: { points: { size: 5 } }, legend: { show: false },
    scales: { x: { time: true }, y: {} }, axes: [dayAxis(midnights), tempYAxis(unit)],
    series: [{}, {
      stroke: u => gradV(u, TSTOPS),
      fill: u => gradV(u, TFILL),
      fillTo: u => (u.scales.y.min != null ? u.scales.y.min : 0),
      width: 2, paths: spline, points: { show: false }
    }]
  }, [chart.t, chart.temp], tempEl);

  uRain = new uPlot({
    width: wR, height: CHART_H, cursor: { points: { size: 5 } }, legend: { show: false },
    scales: { x: { time: true }, y: { range: [0, 100] } }, axes: [dayAxis(midnights), rainYAxis()],
    series: [{}, {
      stroke: 'rgba(38,49,143,0.55)',
      fill: precipFill(chart),
      width: 1, paths: spline, points: { show: false }
    }]
  }, [chart.t, chart.pop], rainEl);

  if (!ro) {
    ro = new ResizeObserver(() => {
      if (uTemp && tempEl.clientWidth) uTemp.setSize({ width: tempEl.clientWidth, height: CHART_H });
      if (uRain && rainEl.clientWidth) uRain.setSize({ width: rainEl.clientWidth, height: CHART_H });
    });
    ro.observe(tempEl);
    ro.observe(rainEl);
  }
}
