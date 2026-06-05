let DATA = [];

const fmtNum = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const fmtPct = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
const fmtINR = {
  format(value) {
    return `Rs.${fmtNum.format(value || 0)}`;
  }
};

const palette = ['#10b981', '#f97316', '#fbbf24', '#38bdf8', '#a78bfa', '#84cc16', '#fb923c'];

const metricDefs = {
  avg_oop: { label: 'Avg OOP episode expenditure', suffix: 'rs', fn: rows => weightedMean(rows, 'oop_episode_rs') },
  avg_total: { label: 'Avg total episode expenditure', suffix: 'rs', fn: rows => weightedMean(rows, 'total_episode_expenditure_rs') },
  avg_medical: { label: 'Avg medical expenditure', suffix: 'rs', fn: rows => weightedMean(rows, 'medical_expenditure_rs') },
  reimb_share: { label: 'Reimbursement share', suffix: '%', fn: rows => ratio(rows, 'reimbursed_rs', 'total_episode_expenditure_rs') * 100 },
  hosp_share: { label: 'Hospitalisation share', suffix: '%', fn: rows => weightedShare(rows, r => r.hospitalised === 'Yes') * 100 },
  chronic_share: { label: 'Chronic ailment share', suffix: '%', fn: rows => weightedShare(rows, r => r.chronic === 'Chronic') * 100 },
  weighted_count: { label: 'Weighted record count', suffix: 'n', fn: rows => sum(rows, 'weight') }
};

const plotConfig = {
  displaylogo: false,
  responsive: true,
  modeBarButtonsToRemove: ['lasso2d', 'select2d']
};

const plotLayoutBase = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  margin: { l: 50, r: 20, t: 20, b: 55 },
  font: { family: 'Inter, system-ui, sans-serif', color: '#c5d0dc' },
  colorway: palette,
  hoverlabel: { bgcolor: '#1a2736', bordercolor: 'rgba(16,185,129,0.3)', font: { color: '#e8edf2' } },
  xaxis: { gridcolor: 'rgba(255,255,255,0.05)', zerolinecolor: 'rgba(255,255,255,0.08)' },
  yaxis: { gridcolor: 'rgba(255,255,255,0.05)', zerolinecolor: 'rgba(255,255,255,0.08)' }
};

function num(v) {
  const x = Number(v);
  return isFinite(x) ? x : 0;
}

function sum(rows, col) {
  return rows.reduce((a, r) => a + num(r[col]), 0);
}

function weightedMean(rows, col) {
  const den = sum(rows, 'weight');
  if (!den) return 0;
  return rows.reduce((a, r) => a + num(r[col]) * num(r.weight), 0) / den;
}

function weightedShare(rows, pred) {
  const den = sum(rows, 'weight');
  if (!den) return 0;
  return rows.reduce((a, r) => a + (pred(r) ? num(r.weight) : 0), 0) / den;
}

function ratio(rows, ncol, dcol) {
  const den = rows.reduce((a, r) => a + num(r[dcol]) * num(r.weight), 0);
  if (!den) return 0;
  return rows.reduce((a, r) => a + num(r[ncol]) * num(r.weight), 0) / den;
}

function groupBy(rows, key) {
  const m = new Map();
  rows.forEach(r => {
    const k = r[key] || 'Unknown';
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  });
  return m;
}

function uniqueSorted(col) {
  return Array.from(new Set(DATA.map(r => r[col]).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function formatMetric(v, metric) {
  if (metricDefs[metric].suffix === 'rs') return fmtINR.format(v || 0);
  if (metricDefs[metric].suffix === '%') return `${fmtPct.format(v || 0)}%`;
  return fmtNum.format(v || 0);
}

function populateControls() {
  fillMulti('stateSelect', uniqueSorted('state'));
  fillSelect('sectorSelect', uniqueSorted('sector'));
  fillSelect('subroundSelect', uniqueSorted('subround'));
  fillSelect('ailmentSelect', uniqueSorted('ailment_group'));
  fillSelect('chronicSelect', uniqueSorted('chronic'));
  fillSelect('hospSelect', uniqueSorted('hospitalised'));
}

function fillSelect(id, values) {
  const el = document.getElementById(id);
  values.forEach(v => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    el.appendChild(o);
  });
}

function fillMulti(id, values) {
  const el = document.getElementById(id);
  values.forEach(v => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    el.appendChild(o);
  });
}

function selectedMulti(id) {
  return Array.from(document.getElementById(id).selectedOptions).map(o => o.value);
}

function selectedValue(id) {
  return document.getElementById(id).value;
}

function getFiltered() {
  const states = selectedMulti('stateSelect');
  const sector = selectedValue('sectorSelect');
  const subround = selectedValue('subroundSelect');
  const ailment = selectedValue('ailmentSelect');
  const chronic = selectedValue('chronicSelect');
  const hosp = selectedValue('hospSelect');

  return DATA.filter(r =>
    (!states.length || states.includes(r.state)) &&
    (sector === 'All' || r.sector === sector) &&
    (subround === 'All' || r.subround === subround) &&
    (ailment === 'All' || r.ailment_group === ailment) &&
    (chronic === 'All' || r.chronic === chronic) &&
    (hosp === 'All' || r.hospitalised === hosp)
  );
}

function updateDashboard() {
  const rows = getFiltered();
  const metric = selectedValue('metricSelect');
  const topN = Number(document.getElementById('topN').value || 15);
  const cap = Number(document.getElementById('capSlider').value || 50000);

  document.getElementById('capValue').textContent = fmtINR.format(cap);
  document.getElementById('capLabel').textContent = `Capped at ${fmtINR.format(cap)}`;
  document.getElementById('metricLabelA').textContent = metricDefs[metric].label;

  updateKPIs(rows);
  updateInsights(rows, metric);
  renderMap(rows, metric);
  renderStateRank(rows, metric, topN);
  renderAilments(rows, topN);
  renderTreatment(rows);
  renderHistogram(rows, cap);
  renderFinance(rows);
  renderPlace(rows);
  renderTable(rows);
}

function updateKPIs(rows) {
  document.getElementById('rowCountLabel').textContent = fmtNum.format(DATA.length);
  document.getElementById('kpiRows').textContent = fmtNum.format(rows.length);
  document.getElementById('kpiWeighted').textContent = fmtNum.format(sum(rows, 'weight'));
  document.getElementById('kpiOOP').textContent = fmtINR.format(weightedMean(rows, 'oop_episode_rs'));
  document.getElementById('kpiHosp').textContent = `${fmtPct.format(weightedShare(rows, r => r.hospitalised === 'Yes') * 100)}%`;
  document.getElementById('kpiChronic').textContent = `${fmtPct.format(weightedShare(rows, r => r.chronic === 'Chronic') * 100)}%`;
}

function updateInsights(rows, metric) {
  const rankedStates = summariseBy(rows, 'state', metric);
  const topState = rankedStates[0];
  const topAilment = weightedGroup(rows, 'ailment_group')[0];
  const metricName = metricDefs[metric].label.toLowerCase();
  const headline = topState
    ? `${topState.name} leads on ${metricName}`
    : 'No matching records';

  const text = topState
    ? `${formatMetric(topState.value, metric)} is the highest state value in the current selection. ${topAilment ? `${topAilment.name} is the largest ailment group by weighted records.` : ''}`
    : 'Adjust filters or reset the dashboard to bring rows back into view.';

  document.getElementById('insightHeadline').textContent = headline;
  document.getElementById('insightText').textContent = text;
  document.getElementById('filterSummary').innerHTML = getFilterChips().map(label => `<span class="filter-chip">${label}</span>`).join('');
}

function getFilterChips() {
  const states = selectedMulti('stateSelect');
  const chips = [`Metric: ${metricDefs[selectedValue('metricSelect')].label}`];
  if (states.length) chips.push(`States: ${states.length === 1 ? states[0] : `${states.length} selected`}`);
  ['sectorSelect', 'subroundSelect', 'ailmentSelect', 'chronicSelect', 'hospSelect'].forEach(id => {
    const value = selectedValue(id);
    if (value !== 'All') chips.push(value);
  });
  return chips;
}

function summariseBy(rows, key, metric) {
  const grouped = groupBy(rows, key);
  return Array.from(grouped, ([name, group]) => ({
    name,
    value: metricDefs[metric].fn(group),
    weight: sum(group, 'weight'),
    rows: group.length,
    lat: num(group[0].lat),
    lon: num(group[0].lon)
  })).filter(d => d.rows > 0).sort((a, b) => b.value - a.value);
}

function renderMap(rows, metric) {
  const s = summariseBy(rows, 'state', metric).filter(d => d.lat && d.lon);
  const maxWeight = Math.max(1, ...s.map(x => x.weight));
  const values = s.map(d => d.value);
  const sizes = s.map(d => Math.max(11, Math.sqrt(d.weight / maxWeight) * 48));

  Plotly.react('mapChart', [{
    type: 'scattergeo',
    mode: 'markers',
    lat: s.map(d => d.lat),
    lon: s.map(d => d.lon),
    text: s.map(d => `${d.name}<br>${metricDefs[metric].label}: ${formatMetric(d.value, metric)}<br>Rows: ${fmtNum.format(d.rows)}`),
    marker: {
      size: sizes,
      color: values,
      colorscale: [[0, '#064e3b'], [0.35, '#10b981'], [0.65, '#fbbf24'], [1, '#f97316']],
      colorbar: {
        title: { text: metricDefs[metric].label, font: { color: '#c5d0dc', size: 11 } },
        thickness: 12,
        len: 0.6,
        tickfont: { color: '#7a8a9e', size: 10 },
        outlinewidth: 0,
        bgcolor: 'rgba(0,0,0,0)'
      },
      line: { width: 1.5, color: 'rgba(16, 185, 129, 0.5)' },
      opacity: 0.92,
      sizemode: 'diameter'
    },
    hoverinfo: 'text'
  }], {
    ...plotLayoutBase,
    geo: {
      scope: 'asia',
      projection: { type: 'natural earth' },
      center: { lat: 22, lon: 82 },
      lonaxis: { range: [67, 98] },
      lataxis: { range: [6, 37] },
      showland: true,
      landcolor: '#1a2d42',
      showocean: true,
      oceancolor: '#0d1820',
      showcoastlines: true,
      coastlinecolor: 'rgba(16, 185, 129, 0.15)',
      coastlinewidth: 1,
      showcountries: true,
      countrycolor: 'rgba(255, 255, 255, 0.12)',
      countrywidth: 1,
      showsubunits: true,
      subunitcolor: 'rgba(255, 255, 255, 0.06)',
      showframe: false,
      showlakes: true,
      lakecolor: '#0d1820',
      bgcolor: 'rgba(0,0,0,0)',
      resolution: 50
    },
    margin: { l: 0, r: 0, t: 0, b: 0 }
  }, plotConfig);
}

function renderStateRank(rows, metric, topN) {
  const s = summariseBy(rows, 'state', metric).slice(0, topN).reverse();
  Plotly.react('stateRankChart', [{
    type: 'bar',
    orientation: 'h',
    x: s.map(d => d.value),
    y: s.map(d => d.name),
    text: s.map(d => formatMetric(d.value, metric)),
    textposition: 'auto',
    marker: { color: s.map((_, i) => palette[i % palette.length]) },
    hovertemplate: '%{y}<br>%{text}<extra></extra>'
  }], {
    ...plotLayoutBase,
    xaxis: { title: metricDefs[metric].label, zeroline: false, gridcolor: 'rgba(255,255,255,0.05)', color: '#c5d0dc' },
    yaxis: { automargin: true, color: '#c5d0dc' }
  }, plotConfig);
}

function weightedGroup(rows, key) {
  return Array.from(groupBy(rows, key), ([name, group]) => ({
    name,
    value: sum(group, 'weight'),
    rows: group.length
  })).sort((a, b) => b.value - a.value);
}

function renderAilments(rows, topN) {
  const s = weightedGroup(rows, 'ailment_group').slice(0, topN);
  Plotly.react('ailmentChart', [{
    type: 'treemap',
    labels: s.map(d => d.name),
    parents: s.map(() => ''),
    values: s.map(d => d.value),
    textinfo: 'label+percent root',
    marker: { colors: s.map((_, i) => palette[i % palette.length]) },
    hovertemplate: '%{label}<br>Weighted records: %{value:,.0f}<extra></extra>'
  }], { ...plotLayoutBase, margin: { l: 0, r: 0, t: 5, b: 5 } }, plotConfig);
}

function renderTreatment(rows) {
  const s = weightedGroup(rows, 'level_care').slice(0, 10);
  Plotly.react('treatmentChart', [{
    type: 'bar',
    x: s.map(d => d.value),
    y: s.map(d => d.name),
    orientation: 'h',
    marker: { color: '#38bdf8' },
    hovertemplate: '%{y}<br>Weighted records: %{x:,.0f}<extra></extra>'
  }], {
    ...plotLayoutBase,
    xaxis: { title: 'Weighted records', gridcolor: 'rgba(255,255,255,0.05)', color: '#c5d0dc' },
    yaxis: { automargin: true, color: '#c5d0dc' },
    margin: { l: 150, r: 20, t: 10, b: 45 }
  }, plotConfig);
}

function renderHistogram(rows, cap) {
  const vals = rows.map(r => num(r.oop_episode_rs)).filter(v => v >= 0 && v <= cap);
  Plotly.react('histChart', [{
    type: 'histogram',
    x: vals,
    nbinsx: 35,
    marker: { color: '#10b981', line: { color: 'rgba(255,255,255,0.1)', width: .5 } },
    hovertemplate: 'OOP expenditure: Rs.%{x:,.0f}<br>Rows: %{y}<extra></extra>'
  }], {
    ...plotLayoutBase,
    xaxis: { title: 'OOP episode expenditure (Rs.)', gridcolor: 'rgba(255,255,255,0.05)', color: '#c5d0dc' },
    yaxis: { title: 'Rows', gridcolor: 'rgba(255,255,255,0.05)', color: '#c5d0dc' },
    bargap: .03
  }, plotConfig);
}

function renderFinance(rows) {
  const s = weightedGroup(rows, 'finance_source').slice(0, 8);
  Plotly.react('financeChart', [{
    type: 'pie',
    labels: s.map(d => d.name),
    values: s.map(d => d.value),
    hole: .54,
    marker: { colors: palette },
    hovertemplate: '%{label}<br>%{percent}<extra></extra>'
  }], {
    ...plotLayoutBase,
    margin: { l: 0, r: 0, t: 5, b: 5 },
    showlegend: true,
    legend: { orientation: 'h', y: -.15, font: { color: '#c5d0dc' } }
  }, plotConfig);
}

function renderPlace(rows) {
  const s = weightedGroup(rows, 'place_treatment');
  Plotly.react('placeChart', [{
    type: 'bar',
    x: s.map(d => d.name),
    y: s.map(d => d.value),
    marker: { color: s.map((_, i) => palette[i % palette.length]) },
    hovertemplate: '%{x}<br>Weighted records: %{y:,.0f}<extra></extra>'
  }], {
    ...plotLayoutBase,
    xaxis: { automargin: true, tickangle: -25 },
    yaxis: { title: 'Weighted records', gridcolor: 'rgba(255,255,255,0.05)', color: '#c5d0dc' }
  }, plotConfig);
}

function renderTable(rows) {
  const cols = ['state', 'sector', 'age_group', 'ailment_group', 'chronic', 'hospitalised', 'treatment', 'level_care', 'oop_episode_rs', 'total_episode_expenditure_rs', 'finance_source'];
  const sample = rows.slice(0, 100);
  let html = '<table class="data-table"><thead><tr>' + cols.map(c => `<th>${c.replaceAll('_', ' ')}</th>`).join('') + '</tr></thead><tbody>';
  sample.forEach(r => {
    html += '<tr>' + cols.map(c => `<td>${c.endsWith('_rs') ? fmtINR.format(num(r[c])) : (r[c] || '')}</td>`).join('') + '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('dataTableWrap').innerHTML = html;
}

function downloadFiltered() {
  const rows = getFiltered();
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'filtered_health_dashboard_data.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function resetFilters() {
  ['sectorSelect', 'subroundSelect', 'ailmentSelect', 'chronicSelect', 'hospSelect'].forEach(id => {
    document.getElementById(id).value = 'All';
  });
  Array.from(document.getElementById('stateSelect').options).forEach(o => {
    o.selected = false;
  });
  document.getElementById('metricSelect').value = 'avg_oop';
  document.getElementById('topN').value = 15;
  document.getElementById('capSlider').value = 50000;
  updateDashboard();
}

function wireEvents() {
  ['metricSelect', 'layoutSelect', 'sectorSelect', 'subroundSelect', 'ailmentSelect', 'chronicSelect', 'hospSelect', 'topN', 'capSlider'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      if (id === 'layoutSelect') {
        document.getElementById('chartGrid').className = `chart-grid ${document.getElementById('layoutSelect').value}`;
        setTimeout(() => window.dispatchEvent(new Event('resize')), 20);
      } else {
        updateDashboard();
      }
    });
  });
  document.getElementById('stateSelect').addEventListener('change', updateDashboard);
  document.getElementById('clearStates').addEventListener('click', () => {
    Array.from(document.getElementById('stateSelect').options).forEach(o => {
      o.selected = false;
    });
    updateDashboard();
  });
  document.getElementById('nutritionProxyBtn').addEventListener('click', () => {
    document.getElementById('ailmentSelect').value = 'Endocrine, metabolic & nutritional';
    updateDashboard();
  });
  document.getElementById('resetBtn').addEventListener('click', resetFilters);
  document.getElementById('downloadBtn').addEventListener('click', downloadFiltered);
}

async function loadCompressedData() {
  const status = document.getElementById('loadingStatus');
  try {
    status.textContent = 'Loading compressed survey data...';
    const response = await fetch('data/health_level5_slim.csv.gz');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} while fetching data/health_level5_slim.csv.gz`);
    }
    const compressed = new Uint8Array(await response.arrayBuffer());
    status.textContent = 'Decompressing survey data...';
    const csvText = pako.ungzip(compressed, { to: 'string' });
    status.textContent = 'Parsing survey data...';
    Papa.parse(csvText, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete(results) {
        DATA = results.data;
        populateControls();
        wireEvents();
        status.textContent = 'Data loaded from compressed CSV. Use the filters above.';
        updateDashboard();
      },
      error(err) {
        status.textContent = `Could not parse data: ${err}`;
      }
    });
  } catch (err) {
    status.innerHTML = `Could not load data. Make sure the <code>data/health_level5_slim.csv.gz</code> file was uploaded and you are viewing through GitHub Pages or a local server. Error: ${err.message}`;
  }
}

loadCompressedData();
