// Lazy-loaded uPlot trend panels:
//   - 5-day temperature: filled area, colored by temperature value
//   - 5-day rain: height = precip probability, color = precip intensity (mm)
//
// Both use a split ("fisheye") x-axis: the next 24 hours fill the left half
// (with clock-time ticks) and the following 4 days fill the right half (day
// ticks), divided by a dashed line at the 24-hour mark.
//
// uPlot is vendored under vendor/uplot/ and loaded on first render.

const TSTOPS = [[-10,'#2b59c3'],[0,'#2aa9c2'],[8,'#3fb56b'],[16,'#e6c235'],[24,'#ef8a3c'],[32,'#e0483c']];
const TFILL  = [[-10,'rgba(43,89,195,0.45)'],[0,'rgba(42,169,194,0.45)'],[8,'rgba(63,181,107,0.45)'],[16,'rgba(230,194,53,0.5)'],[24,'rgba(239,138,60,0.55)'],[32,'rgba(224,72,60,0.6)']];
const TEXT_COL = '#5b6b85';
const GRID_COL = 'rgba(20,40,80,0.08)';
const AXIS_FONT = '11px -apple-system, system-ui, sans-serif';
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const CHART_H = 92;
const CHART_PAD = [4, 6, 0, 0]; // [top, right, bottom, left]
const SPLIT_HOURS = 24;         // next 24 h occupy the left half

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

// Times are UTC-parsed wall-clock, so getUTC* recovers the original local values.
function fmtDay(t) { const d = new Date(t * 1000); return DOW[d.getUTCDay()] + ' ' + d.getUTCDate(); }
function clock(t) { return String(new Date(t * 1000).getUTCHours()).padStart(2, '0') + ':00'; }

function xAxis(splits, labels) {
  return { scale: 'x', stroke: TEXT_COL, font: AXIS_FONT, size: 26,
    grid: { stroke: GRID_COL, width: 1 }, ticks: { stroke: GRID_COL, width: 1, size: 3 },
    splits: () => splits, values: (u, sp) => sp.map((v, i) => labels[i] ?? '') };
}
function tempYAxis(unit, tMin, tMax) {
  return { scale: 'y', stroke: TEXT_COL, font: AXIS_FONT, size: 34,
    grid: { stroke: GRID_COL, width: 1 }, ticks: { stroke: GRID_COL, width: 1, size: 3 },
    // Exactly two labels: the window's min and max temperature.
    splits: [tMin, tMax],
    values: (u, sp) => sp.map(v => Math.round(unit === 'f' ? v * 9 / 5 + 32 : v) + '°') };
}
function rainYAxis() {
  return { scale: 'y', stroke: TEXT_COL, font: AXIS_FONT, size: 34,
    grid: { stroke: GRID_COL, width: 1 }, ticks: { stroke: GRID_COL, width: 1, size: 3 },
    splits: [0, 50, 100],
    values: (u, sp) => sp.map(v => Math.round(v) + '%') };
}

// Dashed vertical divider at the 24-hour mark (x = 0.5 in warped coords).
const DIVIDER_HOOKS = { draw: [ (u) => {
  const x = u.valToPos(0.5, 'x', true);
  const ctx = u.ctx;
  ctx.save();
  ctx.strokeStyle = 'rgba(20,40,80,0.32)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(x, u.bbox.top);
  ctx.lineTo(x, u.bbox.top + u.bbox.height);
  ctx.stroke();
  ctx.restore();
} ] };

// Vertical gradient keyed to the y-scale (temperature color/fill).
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

// Horizontal gradient across the warped x-axis, colored by precip intensity (mm).
function precipFill(chart, xpos) {
  return (u) => {
    const x0 = u.valToPos(0, 'x', true), x1 = u.valToPos(1, 'x', true);
    const g = u.ctx.createLinearGradient(x0, 0, x1, 0);
    let last = -1;
    for (let i = 0; i < xpos.length; i++) {
      let p = xpos[i];
      if (p < 0 || p > 1) continue;
      if (p <= last) p = last + 0.00001;
      last = p;
      g.addColorStop(Math.max(0, Math.min(1, p)), mmColor(chart.mm[i]));
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

  // Warped x: indices [0..SPLIT_IDX] -> [0, 0.5], the rest -> [0.5, 1].
  const N = chart.t.length;
  const SPLIT_IDX = Math.min(SPLIT_HOURS, N - 1);
  const rightDenom = Math.max(1, (N - 1) - SPLIT_IDX);
  const xAt = i => i <= SPLIT_IDX ? (i / SPLIT_IDX) * 0.5 : 0.5 + ((i - SPLIT_IDX) / rightDenom) * 0.5;
  const xpos = chart.t.map((_, i) => xAt(i));

  // Ticks: a few clock times in the next 24 h, then a day label per local midnight.
  const splits = [], labels = [];
  for (const i of [0, 6, 12, 18]) {
    if (i <= SPLIT_IDX && i < N) {
      splits.push(xAt(i));
      labels.push(i === 0 ? 'Now' : clock(chart.t[i]));
    }
  }
  for (let i = SPLIT_IDX; i < N; i++) {
    if (chart.t[i] % 86400 === 0) {
      splits.push(xAt(i));
      labels.push(fmtDay(chart.t[i]));
    }
  }

  const temps = chart.temp.filter(v => v != null);
  const tMin = temps.length ? Math.min(...temps) : 0;
  const tMax = temps.length ? Math.max(...temps) : 1;
  const tPad = Math.max(0.5, (tMax - tMin) * 0.08);
  const wT = tempEl.clientWidth || 320;
  const wR = rainEl.clientWidth || 320;

  uTemp = new uPlot({
    width: wT, height: CHART_H, padding: CHART_PAD, cursor: { points: { size: 5 } },
    legend: { show: false }, hooks: DIVIDER_HOOKS,
    scales: { x: { time: false, range: [0, 1] }, y: { range: [tMin - tPad, tMax + tPad] } },
    axes: [xAxis(splits, labels), tempYAxis(unit, tMin, tMax)],
    series: [{}, {
      stroke: u => gradV(u, TSTOPS),
      fill: u => gradV(u, TFILL),
      fillTo: u => (u.scales.y.min != null ? u.scales.y.min : 0),
      width: 2, paths: spline, points: { show: false }
    }]
  }, [xpos, chart.temp], tempEl);

  uRain = new uPlot({
    width: wR, height: CHART_H, padding: CHART_PAD, cursor: { points: { size: 5 } },
    legend: { show: false }, hooks: DIVIDER_HOOKS,
    scales: { x: { time: false, range: [0, 1] }, y: { range: [0, 100] } },
    axes: [xAxis(splits, labels), rainYAxis()],
    series: [{}, {
      stroke: 'rgba(38,49,143,0.55)',
      fill: precipFill(chart, xpos),
      width: 1, paths: spline, points: { show: false }
    }]
  }, [xpos, chart.pop], rainEl);

  if (!ro) {
    ro = new ResizeObserver(() => {
      if (uTemp && tempEl.clientWidth) uTemp.setSize({ width: tempEl.clientWidth, height: CHART_H });
      if (uRain && rainEl.clientWidth) uRain.setSize({ width: rainEl.clientWidth, height: CHART_H });
    });
    ro.observe(tempEl);
    ro.observe(rainEl);
  }
}
