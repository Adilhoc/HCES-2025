let HOUSEHOLDS = [];
let ITEM_CUBE = [];
let META = null;
let SUMMARY = null;

const fmtNum = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const fmtPct = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
const fmtCompact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
const fmtINR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const fmtINRCompact = new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
  style: 'currency',
  currency: 'INR'
});

const palette = ['#2563eb', '#16a34a', '#f97316', '#9333ea', '#dc2626', '#0f766e', '#ca8a04', '#64748b', '#be123c', '#0891b2', '#7c3aed', '#4d7c0f', '#c2410c', '#334155'];

const metricDefs = {
  avg_household: { label: 'Average household value', suffix: 'rs' },
  per_capita: { label: 'Average per-capita value', suffix: 'rs' },
  total_value: { label: 'Total weighted value', suffix: 'rs_compact' },
  out_home_share: { label: 'Out-of-home share', suffix: '%' },
  weighted_households: { label: 'Weighted households', suffix: 'n' }
};

const plotConfig = {
  displaylogo: false,
  responsive: true,
  modeBarButtonsToRemove: ['lasso2d', 'select2d']
};

const plotLayoutBase = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  margin: { l: 56, r: 18, t: 14, b: 54 },
  font: { family: 'Inter, system-ui, sans-serif', color: '#334155' },
  colorway: palette,
  hoverlabel: { bgcolor: '#102033', bordercolor: '#102033', font: { color: '#fff' } },
  xaxis: { gridcolor: '#e6edf5', zerolinecolor: '#d7e0ea' },
  yaxis: { gridcolor: '#e6edf5', zerolinecolor: '#d7e0ea' }
};

function num(value) {
  const x = Number(value);
  return Number.isFinite(x) ? x : 0;
}

function inr(value) {
  return `Rs.${fmtINR.format(value || 0)}`;
}

function inrCompact(value) {
  return fmtINRCompact.format(value || 0).replace('₹', 'Rs.');
}

function formatMetric(value, metric) {
  const def = metricDefs[metric];
  if (def.suffix === 'rs') return inr(value);
  if (def.suffix === 'rs_compact') return inrCompact(value);
  if (def.suffix === '%') return `${fmtPct.format(value || 0)}%`;
  return fmtCompact.format(value || 0);
}

function selectedValue(id) {
  return document.getElementById(id).value;
}

function selectedMulti(id) {
  return Array.from(document.getElementById(id).selectedOptions).map(option => option.value);
}

function categoryMeta() {
  const value = selectedValue('categorySelect');
  if (value === 'All') return null;
  return META.categories.find(category => category.slug === value) || null;
}

function categoryValue(row, category) {
  if (!category) return num(row.food_total_value);
  return num(row[category.column]);
}

function householdMatches(row) {
  const states = selectedMulti('stateSelect');
  const sector = selectedValue('sectorSelect');
  const ration = selectedValue('rationSelect');
  const pds = selectedValue('pdsSelect');
  const online = selectedValue('onlineSelect');
  const ceremony = selectedValue('ceremonySelect');
  const sizeBand = selectedValue('sizeBandSelect');
  const expBand = selectedValue('expBandSelect');

  return (!states.length || states.includes(row.state)) &&
    (sector === 'All' || row.sector === sector) &&
    (ration === 'All' || row.ration_any === ration) &&
    (pds === 'All' || hasPdsFood(row) === pds) &&
    (online === 'All' || row.online_food === online) &&
    (ceremony === 'All' || row.ceremony === ceremony) &&
    (sizeBand === 'All' || row.household_size_band === sizeBand) &&
    (expBand === 'All' || row.monthly_exp_band === expBand);
}

function itemMatches(row) {
  const states = selectedMulti('stateSelect');
  const sector = selectedValue('sectorSelect');
  const source = selectedValue('sourceSelect');
  const ration = selectedValue('rationSelect');
  const online = selectedValue('onlineSelect');
  const ceremony = selectedValue('ceremonySelect');
  const sizeBand = selectedValue('sizeBandSelect');
  const expBand = selectedValue('expBandSelect');
  const category = selectedValue('categorySelect');

  return (!states.length || states.includes(row.state)) &&
    (sector === 'All' || row.sector === sector) &&
    (source === 'All' || row.source_group === source) &&
    (ration === 'All' || row.ration_any === ration) &&
    (online === 'All' || row.online_food === online) &&
    (ceremony === 'All' || row.ceremony === ceremony) &&
    (sizeBand === 'All' || row.household_size_band === sizeBand) &&
    (expBand === 'All' || row.monthly_exp_band === expBand) &&
    (category === 'All' || row.category_slug === category);
}

function hasPdsFood(row) {
  return row.pds_rice === 'Yes' || row.pds_wheat === 'Yes' || row.pds_pulses === 'Yes' || row.pds_oil === 'Yes' ? 'Yes' : 'No';
}

function getFilteredHouseholds() {
  return HOUSEHOLDS.filter(householdMatches);
}

function getFilteredItems() {
  return ITEM_CUBE.filter(itemMatches);
}

function weightedStats(rows, category) {
  let weight = 0;
  let persons = 0;
  let value = 0;
  let outHome = 0;
  rows.forEach(row => {
    const w = num(row.weight);
    const hhSize = num(row.household_size);
    weight += w;
    persons += hhSize > 0 ? hhSize * w : 0;
    value += categoryValue(row, category) * w;
    outHome += num(row.out_home_total_value) * w;
  });
  return { weight, persons, value, outHome };
}

function weightedValueFromItems(rows) {
  return rows.reduce((total, row) => total + num(row.weighted_value), 0);
}

function currentWeightedValue(households, items, category) {
  if (selectedValue('sourceSelect') !== 'All') {
    return weightedValueFromItems(items);
  }
  return weightedStats(households, category).value;
}

function metricFromTotals(metric, totalValue, weight, persons, outHome) {
  if (metric === 'avg_household') return weight ? totalValue / weight : 0;
  if (metric === 'per_capita') return persons ? totalValue / persons : 0;
  if (metric === 'total_value') return totalValue;
  if (metric === 'out_home_share') return totalValue ? (outHome / totalValue) * 100 : 0;
  if (metric === 'weighted_households') return weight;
  return 0;
}

function weightedShare(rows, predicate) {
  let den = 0;
  let numValue = 0;
  rows.forEach(row => {
    const w = num(row.weight);
    den += w;
    if (predicate(row)) numValue += w;
  });
  return den ? numValue / den : 0;
}

function groupRows(rows, keyFn, initFn, addFn) {
  const map = new Map();
  rows.forEach(row => {
    const key = keyFn(row);
    if (!map.has(key)) map.set(key, initFn(row));
    addFn(map.get(key), row);
  });
  return Array.from(map.values());
}

function updateDashboard() {
  if (!HOUSEHOLDS.length || !META) return;

  const households = getFilteredHouseholds();
  const items = getFilteredItems();
  const category = categoryMeta();
  const metric = selectedValue('metricSelect');
  const stats = weightedStats(households, category);
  const totalValue = currentWeightedValue(households, items, category);
  const currentMetric = metricFromTotals(metric, totalValue, stats.weight, stats.persons, stats.outHome);

  updateKPIs(households, stats, totalValue, category);
  updateInsights(households, items, stats, totalValue, currentMetric, metric, category);
  renderCategoryChart(households);
  renderStateChart(households, items, metric, category);
  renderSourceChart(items);
  renderItemChart(items);
  renderSectorChart(households, items, metric, category);
  renderExpChart(households, category);
  renderTable(households, category);
}

function updateKPIs(rows, stats, totalValue, category) {
  document.getElementById('rowCountLabel').textContent = fmtNum.format(HOUSEHOLDS.length);
  document.getElementById('kpiRows').textContent = fmtNum.format(rows.length);
  document.getElementById('kpiWeighted').textContent = fmtCompact.format(stats.weight);
  document.getElementById('kpiAvg').textContent = inr(stats.weight ? totalValue / stats.weight : 0);
  document.getElementById('kpiPerCapita').textContent = inr(stats.persons ? totalValue / stats.persons : 0);
  document.getElementById('kpiPds').textContent = `${fmtPct.format(weightedShare(rows, row => hasPdsFood(row) === 'Yes') * 100)}%`;
  document.getElementById('kpiOnline').textContent = `${fmtPct.format(weightedShare(rows, row => row.online_food === 'Yes') * 100)}%`;
  document.getElementById('kpiAvgLabel').textContent = category ? category.label : 'all food categories';
}

function updateInsights(households, items, stats, totalValue, currentMetric, metric, category) {
  const rankedStates = stateSummary(households, items, metric, category);
  const topState = rankedStates[0];
  const categoryLabel = category ? category.label.toLowerCase() : 'all food categories';
  const source = selectedValue('sourceSelect');
  const sourceText = source === 'All' ? '' : ` from ${source.toLowerCase()}`;

  const headline = topState
    ? `${topState.name} leads for ${categoryLabel}${sourceText}`
    : 'No matching households';
  const text = topState
    ? `${formatMetric(topState.value, metric)} is the highest state value for the selected metric. The current filtered value is ${formatMetric(currentMetric, metric)}.`
    : 'Adjust filters or reset the dashboard to bring rows back into view.';

  document.getElementById('insightHeadline').textContent = headline;
  document.getElementById('insightText').textContent = text;
  document.getElementById('filterSummary').innerHTML = filterChips().map(chip => `<span class="filter-chip">${escapeHtml(chip)}</span>`).join('');
}

function filterChips() {
  const chips = [`Metric: ${metricDefs[selectedValue('metricSelect')].label}`];
  const category = categoryMeta();
  const states = selectedMulti('stateSelect');
  if (category) chips.push(category.label);
  if (states.length) chips.push(states.length === 1 ? states[0] : `${states.length} states selected`);
  ['sectorSelect', 'sourceSelect', 'rationSelect', 'pdsSelect', 'onlineSelect', 'ceremonySelect', 'sizeBandSelect', 'expBandSelect'].forEach(id => {
    const value = selectedValue(id);
    if (value !== 'All') chips.push(value);
  });
  return chips;
}

function renderCategoryChart(rows) {
  const values = META.categories.map(category => {
    let total = 0;
    rows.forEach(row => {
      total += num(row[category.column]) * num(row.weight);
    });
    return { name: category.label, value: total };
  }).filter(row => row.value > 0).sort((a, b) => b.value - a.value);

  if (!values.length) return emptyPlot('categoryChart', 'No matching category values');

  Plotly.react('categoryChart', [{
    type: 'bar',
    x: values.map(row => row.value),
    y: values.map(row => row.name),
    orientation: 'h',
    marker: { color: values.map((_, index) => palette[index % palette.length]) },
    text: values.map(row => inrCompact(row.value)),
    textposition: 'auto',
    hovertemplate: '%{y}<br>%{text}<extra></extra>'
  }], {
    ...plotLayoutBase,
    margin: { l: 160, r: 18, t: 12, b: 42 },
    xaxis: { title: 'Weighted value', gridcolor: '#e6edf5' },
    yaxis: { autorange: 'reversed', automargin: true }
  }, plotConfig);
}

function stateSummary(households, items, metric, category) {
  const sourceFiltered = selectedValue('sourceSelect') !== 'All';
  const denominators = groupRows(
    households,
    row => row.state,
    row => ({ name: row.state, weight: 0, persons: 0, value: 0, outHome: 0 }),
    (group, row) => {
      const w = num(row.weight);
      group.weight += w;
      group.persons += num(row.household_size) * w;
      group.value += categoryValue(row, category) * w;
      group.outHome += num(row.out_home_total_value) * w;
    }
  );
  const denByState = new Map(denominators.map(group => [group.name, group]));

  if (sourceFiltered) {
    denByState.forEach(group => { group.value = 0; });
    items.forEach(row => {
      const den = denByState.get(row.state);
      if (den) den.value += num(row.weighted_value);
    });
  }

  return Array.from(denByState.values())
    .map(group => ({
      name: group.name,
      value: metricFromTotals(metric, group.value, group.weight, group.persons, group.outHome),
      totalValue: group.value,
      weight: group.weight
    }))
    .filter(group => group.weight > 0)
    .sort((a, b) => b.value - a.value);
}

function renderStateChart(households, items, metric, category) {
  const topN = Math.max(5, Math.min(30, Number(selectedValue('topN') || 12)));
  const values = stateSummary(households, items, metric, category).slice(0, topN).reverse();
  document.getElementById('stateMetricLabel').textContent = metricDefs[metric].label;

  if (!values.length) return emptyPlot('stateChart', 'No matching states');

  Plotly.react('stateChart', [{
    type: 'bar',
    orientation: 'h',
    x: values.map(row => row.value),
    y: values.map(row => row.name),
    text: values.map(row => formatMetric(row.value, metric)),
    textposition: 'auto',
    marker: { color: '#2563eb' },
    hovertemplate: '%{y}<br>%{text}<extra></extra>'
  }], {
    ...plotLayoutBase,
    xaxis: { title: metricDefs[metric].label, gridcolor: '#e6edf5' },
    yaxis: { automargin: true }
  }, plotConfig);
}

function renderSourceChart(items) {
  const grouped = groupRows(
    items,
    row => row.source_group,
    row => ({ name: row.source_group, value: 0 }),
    (group, row) => { group.value += num(row.weighted_value); }
  ).filter(row => row.value > 0).sort((a, b) => b.value - a.value);

  if (!grouped.length) return emptyPlot('sourceChart', 'No matching source rows');

  Plotly.react('sourceChart', [{
    type: 'pie',
    labels: grouped.map(row => row.name),
    values: grouped.map(row => row.value),
    hole: 0.56,
    marker: { colors: palette },
    textinfo: 'percent',
    hovertemplate: '%{label}<br>%{percent}<br>%{value:,.0f}<extra></extra>'
  }], {
    ...plotLayoutBase,
    margin: { l: 8, r: 8, t: 8, b: 8 },
    showlegend: true,
    legend: { orientation: 'h', y: -0.16, font: { size: 11 } }
  }, plotConfig);
}

function renderItemChart(items) {
  const topN = Math.max(5, Math.min(30, Number(selectedValue('topN') || 12)));
  const grouped = groupRows(
    items,
    row => `${row.item_code}|${row.item_name}`,
    row => ({ code: row.item_code, name: row.item_name, value: 0 }),
    (group, row) => { group.value += num(row.weighted_value); }
  ).filter(row => row.value > 0).sort((a, b) => b.value - a.value).slice(0, topN).reverse();

  if (!grouped.length) return emptyPlot('itemChart', 'No matching item rows');

  Plotly.react('itemChart', [{
    type: 'bar',
    orientation: 'h',
    x: grouped.map(row => row.value),
    y: grouped.map(row => `${row.code} - ${row.name}`),
    text: grouped.map(row => inrCompact(row.value)),
    textposition: 'auto',
    marker: { color: '#16a34a' },
    hovertemplate: '%{y}<br>%{text}<extra></extra>'
  }], {
    ...plotLayoutBase,
    margin: { l: 190, r: 18, t: 12, b: 42 },
    xaxis: { title: 'Weighted value', gridcolor: '#e6edf5' },
    yaxis: { automargin: true }
  }, plotConfig);
}

function renderSectorChart(households, items, metric, category) {
  const sourceFiltered = selectedValue('sourceSelect') !== 'All';
  const grouped = groupRows(
    households,
    row => row.sector,
    row => ({ name: row.sector, weight: 0, persons: 0, value: 0, outHome: 0 }),
    (group, row) => {
      const w = num(row.weight);
      group.weight += w;
      group.persons += num(row.household_size) * w;
      group.value += categoryValue(row, category) * w;
      group.outHome += num(row.out_home_total_value) * w;
    }
  );

  if (sourceFiltered) {
    grouped.forEach(group => { group.value = 0; });
    const groupByName = new Map(grouped.map(group => [group.name, group]));
    items.forEach(row => {
      const group = groupByName.get(row.sector);
      if (group) group.value += num(row.weighted_value);
    });
  }

  const values = grouped.map(group => ({
    name: group.name,
    value: metricFromTotals(metric, group.value, group.weight, group.persons, group.outHome)
  })).filter(group => group.name && group.value >= 0);

  if (!values.length) return emptyPlot('sectorChart', 'No matching sector rows');

  Plotly.react('sectorChart', [{
    type: 'bar',
    x: values.map(row => row.name),
    y: values.map(row => row.value),
    text: values.map(row => formatMetric(row.value, metric)),
    textposition: 'auto',
    marker: { color: ['#2563eb', '#f97316'] },
    hovertemplate: '%{x}<br>%{text}<extra></extra>'
  }], {
    ...plotLayoutBase,
    xaxis: { title: '' },
    yaxis: { title: metricDefs[metric].label, gridcolor: '#e6edf5' }
  }, plotConfig);
}

function renderExpChart(households, category) {
  const order = ['< Rs.5k', 'Rs.5k-10k', 'Rs.10k-20k', 'Rs.20k-40k', 'Rs.40k+', 'Unknown'];
  const grouped = groupRows(
    households,
    row => row.monthly_exp_band,
    row => ({ name: row.monthly_exp_band, weight: 0, value: 0 }),
    (group, row) => {
      const w = num(row.weight);
      group.weight += w;
      group.value += categoryValue(row, category) * w;
    }
  ).map(group => ({
    name: group.name,
    value: group.weight ? group.value / group.weight : 0
  })).sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));

  if (!grouped.length) return emptyPlot('expChart', 'No matching expenditure bands');

  Plotly.react('expChart', [{
    type: 'scatter',
    mode: 'lines+markers',
    x: grouped.map(row => row.name),
    y: grouped.map(row => row.value),
    marker: { size: 9, color: '#9333ea' },
    line: { width: 3, color: '#9333ea' },
    hovertemplate: '%{x}<br>Avg household value: Rs.%{y:,.0f}<extra></extra>'
  }], {
    ...plotLayoutBase,
    xaxis: { title: '', tickangle: -20 },
    yaxis: { title: 'Avg household value', gridcolor: '#e6edf5' }
  }, plotConfig);
}

function renderTable(rows, category) {
  const sample = rows.slice(0, 100);
  const categoryLabel = category ? category.label : 'All food';
  const cols = [
    ['state', 'State'],
    ['sector', 'Sector'],
    ['household_size', 'HH size'],
    ['ration_any', 'Ration'],
    ['online_food', 'Online food'],
    ['ceremony', 'Ceremony'],
    ['monthly_exp_band', 'Monthly exp.'],
  ];

  let html = '<table class="data-table"><thead><tr>';
  cols.forEach(([, label]) => { html += `<th>${escapeHtml(label)}</th>`; });
  html += `<th>${escapeHtml(categoryLabel)} value</th><th>Total food value</th></tr></thead><tbody>`;
  sample.forEach(row => {
    html += '<tr>';
    cols.forEach(([key]) => { html += `<td>${escapeHtml(row[key] || '')}</td>`; });
    html += `<td>${inr(categoryValue(row, category))}</td>`;
    html += `<td>${inr(num(row.food_total_value))}</td>`;
    html += '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('dataTableWrap').innerHTML = html;
}

function emptyPlot(id, message) {
  Plotly.react(id, [], {
    ...plotLayoutBase,
    annotations: [{
      text: message,
      showarrow: false,
      x: 0.5,
      y: 0.5,
      xref: 'paper',
      yref: 'paper',
      font: { color: '#64748b', size: 13 }
    }],
    xaxis: { visible: false },
    yaxis: { visible: false }
  }, plotConfig);
}

function populateControls() {
  const states = Array.from(new Set(HOUSEHOLDS.map(row => row.state).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  fillMulti('stateSelect', states);
  fillSelect('sectorSelect', Array.from(new Set(HOUSEHOLDS.map(row => row.sector))).sort());
  fillSelect('sourceSelect', Array.from(new Set(ITEM_CUBE.map(row => row.source_group))).filter(Boolean).sort());
  fillSelect('sizeBandSelect', ['1', '2', '3-4', '5-6', '7+', 'Unknown']);
  fillSelect('expBandSelect', ['< Rs.5k', 'Rs.5k-10k', 'Rs.10k-20k', 'Rs.20k-40k', 'Rs.40k+', 'Unknown']);

  const categorySelect = document.getElementById('categorySelect');
  META.categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category.slug;
    option.textContent = category.label;
    categorySelect.appendChild(option);
  });
}

function fillSelect(id, values) {
  const el = document.getElementById(id);
  values.forEach(value => {
    if (!value || Array.from(el.options).some(option => option.value === value)) return;
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    el.appendChild(option);
  });
}

function fillMulti(id, values) {
  const el = document.getElementById(id);
  values.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    el.appendChild(option);
  });
}

function resetFilters() {
  ['metricSelect', 'categorySelect', 'sectorSelect', 'sourceSelect', 'rationSelect', 'pdsSelect', 'onlineSelect', 'ceremonySelect', 'sizeBandSelect', 'expBandSelect'].forEach(id => {
    document.getElementById(id).selectedIndex = 0;
  });
  Array.from(document.getElementById('stateSelect').options).forEach(option => { option.selected = false; });
  document.getElementById('topN').value = 12;
  updateDashboard();
}

function downloadFiltered() {
  const category = categoryMeta();
  const rows = getFilteredHouseholds().map(row => ({
    state: row.state,
    sector: row.sector,
    household_size: row.household_size,
    household_size_band: row.household_size_band,
    ration_any: row.ration_any,
    online_food: row.online_food,
    ceremony: row.ceremony,
    monthly_exp_band: row.monthly_exp_band,
    selected_category: category ? category.label : 'All food categories',
    selected_category_value: categoryValue(row, category),
    total_food_value: row.food_total_value,
    weight: row.weight
  }));
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'filtered_food_households.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function wireEvents() {
  ['metricSelect', 'categorySelect', 'sectorSelect', 'sourceSelect', 'rationSelect', 'pdsSelect', 'onlineSelect', 'ceremonySelect', 'sizeBandSelect', 'expBandSelect', 'topN'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateDashboard);
  });
  document.getElementById('stateSelect').addEventListener('change', updateDashboard);
  document.getElementById('clearStates').addEventListener('click', () => {
    Array.from(document.getElementById('stateSelect').options).forEach(option => { option.selected = false; });
    updateDashboard();
  });
  document.getElementById('resetBtn').addEventListener('click', resetFilters);
  document.getElementById('downloadBtn').addEventListener('click', downloadFiltered);
}

async function loadGzipCsv(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`);
  const compressed = new Uint8Array(await response.arrayBuffer());
  const csvText = pako.ungzip(compressed, { to: 'string' });
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      complete: results => resolve(results.data),
      error: reject
    });
  });
}

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`);
  return response.json();
}

async function loadData() {
  const status = document.getElementById('loadingStatus');
  try {
    status.textContent = 'Loading metadata...';
    [META, SUMMARY] = await Promise.all([
      loadJson('food_data/item_map.json'),
      loadJson('food_data/food_summary.json')
    ]);

    status.textContent = 'Loading household food values...';
    HOUSEHOLDS = await loadGzipCsv('food_data/food_households.csv.gz');

    status.textContent = 'Loading item/source cube...';
    ITEM_CUBE = await loadGzipCsv('food_data/food_item_cube.csv.gz');

    populateControls();
    wireEvents();
    status.textContent = `Loaded ${fmtNum.format(HOUSEHOLDS.length)} households and ${fmtNum.format(ITEM_CUBE.length)} item groups.`;
    updateDashboard();
  } catch (err) {
    status.innerHTML = `Could not load dashboard data. Preview through GitHub Pages or a local server and confirm <code>food_data</code> is uploaded. Error: ${escapeHtml(err.message)}`;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

loadData();
