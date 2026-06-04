let DATA = [];
const fmtINR = new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 });
const fmtNum = new Intl.NumberFormat('en-IN', { maximumFractionDigits:0 });
const fmtPct = new Intl.NumberFormat('en-IN', { maximumFractionDigits:1 });

const metricDefs = {
  avg_oop: {label:'Avg OOP episode expenditure', suffix:'₹', fn: rows => weightedMean(rows,'oop_episode_rs')},
  avg_total: {label:'Avg total episode expenditure', suffix:'₹', fn: rows => weightedMean(rows,'total_episode_expenditure_rs')},
  avg_medical: {label:'Avg medical expenditure', suffix:'₹', fn: rows => weightedMean(rows,'medical_expenditure_rs')},
  reimb_share: {label:'Reimbursement share', suffix:'%', fn: rows => ratio(rows,'reimbursed_rs','total_episode_expenditure_rs')*100},
  hosp_share: {label:'Hospitalisation share', suffix:'%', fn: rows => weightedShare(rows,r => r.hospitalised === 'Yes')*100},
  chronic_share: {label:'Chronic ailment share', suffix:'%', fn: rows => weightedShare(rows,r => r.chronic === 'Chronic')*100},
  weighted_count: {label:'Weighted record count', suffix:'n', fn: rows => sum(rows,'weight')}
};

const plotConfig = {displaylogo:false, responsive:true, modeBarButtonsToRemove:['lasso2d','select2d']};
const plotLayoutBase = {paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)', margin:{l:50,r:20,t:20,b:55}, font:{family:'Inter, system-ui, sans-serif', color:'#17201f'}};

function num(v){ const x = Number(v); return isFinite(x) ? x : 0; }
function sum(rows, col){ return rows.reduce((a,r)=>a+num(r[col]),0); }
function weightedMean(rows, col){ const den=sum(rows,'weight'); if(!den) return 0; return rows.reduce((a,r)=>a+num(r[col])*num(r.weight),0)/den; }
function weightedShare(rows, pred){ const den=sum(rows,'weight'); if(!den) return 0; return rows.reduce((a,r)=>a+(pred(r)?num(r.weight):0),0)/den; }
function ratio(rows, ncol, dcol){ const den = rows.reduce((a,r)=>a+num(r[dcol])*num(r.weight),0); if(!den) return 0; return rows.reduce((a,r)=>a+num(r[ncol])*num(r.weight),0)/den; }
function groupBy(rows, key){ const m = new Map(); rows.forEach(r=>{const k=r[key]||'Unknown'; if(!m.has(k)) m.set(k, []); m.get(k).push(r);}); return m; }
function uniqueSorted(col){ return Array.from(new Set(DATA.map(r=>r[col]).filter(Boolean))).sort((a,b)=>a.localeCompare(b)); }
function formatMetric(v, metric){ if(metricDefs[metric].suffix==='₹') return fmtINR.format(v||0); if(metricDefs[metric].suffix==='%') return fmtPct.format(v||0)+'%'; return fmtNum.format(v||0); }

function populateControls(){
  fillMulti('stateSelect', uniqueSorted('state'));
  fillSelect('sectorSelect', uniqueSorted('sector'));
  fillSelect('subroundSelect', uniqueSorted('subround'));
  fillSelect('ailmentSelect', uniqueSorted('ailment_group'));
  fillSelect('chronicSelect', uniqueSorted('chronic'));
  fillSelect('hospSelect', uniqueSorted('hospitalised'));
}
function fillSelect(id, values){ const el=document.getElementById(id); values.forEach(v=>{const o=document.createElement('option'); o.value=v; o.textContent=v; el.appendChild(o);}); }
function fillMulti(id, values){ const el=document.getElementById(id); values.forEach(v=>{const o=document.createElement('option'); o.value=v; o.textContent=v; el.appendChild(o);}); }
function selectedMulti(id){ return Array.from(document.getElementById(id).selectedOptions).map(o=>o.value); }
function selectedValue(id){ return document.getElementById(id).value; }
function getFiltered(){
  const states = selectedMulti('stateSelect');
  const sector = selectedValue('sectorSelect');
  const subround = selectedValue('subroundSelect');
  const ailment = selectedValue('ailmentSelect');
  const chronic = selectedValue('chronicSelect');
  const hosp = selectedValue('hospSelect');
  return DATA.filter(r =>
    (!states.length || states.includes(r.state)) &&
    (sector==='All' || r.sector===sector) &&
    (subround==='All' || r.subround===subround) &&
    (ailment==='All' || r.ailment_group===ailment) &&
    (chronic==='All' || r.chronic===chronic) &&
    (hosp==='All' || r.hospitalised===hosp)
  );
}

function updateDashboard(){
  const rows = getFiltered();
  const metric = selectedValue('metricSelect');
  const topN = Number(document.getElementById('topN').value || 15);
  const cap = Number(document.getElementById('capSlider').value || 50000);
  document.getElementById('capValue').textContent = fmtINR.format(cap);
  document.getElementById('capLabel').textContent = `Capped at ${fmtINR.format(cap)}`;
  document.getElementById('metricLabelA').textContent = metricDefs[metric].label;
  updateKPIs(rows);
  renderMap(rows, metric);
  renderStateRank(rows, metric, topN);
  renderAilments(rows, topN);
  renderTreatment(rows);
  renderHistogram(rows, cap);
  renderFinance(rows);
  renderPlace(rows);
  renderTable(rows);
}

function updateKPIs(rows){
  document.getElementById('rowCountLabel').textContent = fmtNum.format(DATA.length);
  document.getElementById('kpiRows').textContent = fmtNum.format(rows.length);
  document.getElementById('kpiWeighted').textContent = fmtNum.format(sum(rows,'weight'));
  document.getElementById('kpiOOP').textContent = fmtINR.format(weightedMean(rows,'oop_episode_rs'));
  document.getElementById('kpiHosp').textContent = fmtPct.format(weightedShare(rows,r=>r.hospitalised==='Yes')*100)+'%';
  document.getElementById('kpiChronic').textContent = fmtPct.format(weightedShare(rows,r=>r.chronic==='Chronic')*100)+'%';
}

function summariseBy(rows, key, metric){
  const grouped = groupBy(rows,key);
  return Array.from(grouped, ([name, group]) => ({ name, value: metricDefs[metric].fn(group), weight: sum(group,'weight'), rows: group.length, lat: num(group[0].lat), lon: num(group[0].lon) }))
    .filter(d => d.rows > 0).sort((a,b)=>b.value-a.value);
}
function renderMap(rows, metric){
  const s = summariseBy(rows,'state',metric).filter(d=>d.lat && d.lon);
  const values = s.map(d=>d.value);
  const sizes = s.map(d=> Math.max(8, Math.sqrt(d.weight/Math.max(1, Math.max(...s.map(x=>x.weight))))*42));
  Plotly.react('mapChart', [{
    type:'scattergeo', mode:'markers', lat:s.map(d=>d.lat), lon:s.map(d=>d.lon), text:s.map(d=>`${d.name}<br>${metricDefs[metric].label}: ${formatMetric(d.value,metric)}<br>Rows: ${fmtNum.format(d.rows)}`),
    marker:{size:sizes, color:values, colorscale:'Viridis', colorbar:{title:metricDefs[metric].label}, line:{width:1,color:'#fff'}, opacity:.86}, hoverinfo:'text'
  }], {...plotLayoutBase, geo:{scope:'asia', projection:{type:'mercator'}, center:{lat:22.5, lon:79}, lonaxis:{range:[67,98]}, lataxis:{range:[5,37]}, showland:true, landcolor:'#f1f4ef', showcountries:true, countrycolor:'#cad5cf', showsubunits:false}, margin:{l:0,r:0,t:0,b:0}}, plotConfig);
}
function renderStateRank(rows, metric, topN){
  const s = summariseBy(rows,'state',metric).slice(0,topN).reverse();
  Plotly.react('stateRankChart', [{type:'bar', orientation:'h', x:s.map(d=>d.value), y:s.map(d=>d.name), text:s.map(d=>formatMetric(d.value,metric)), textposition:'auto', hovertemplate:'%{y}<br>%{text}<extra></extra>'}], {...plotLayoutBase, xaxis:{title:metricDefs[metric].label, zeroline:false}, yaxis:{automargin:true}}, plotConfig);
}
function weightedGroup(rows, key){
  return Array.from(groupBy(rows,key), ([name, group]) => ({name, value:sum(group,'weight'), rows:group.length})).sort((a,b)=>b.value-a.value);
}
function renderAilments(rows, topN){
  const s = weightedGroup(rows,'ailment_group').slice(0,topN);
  Plotly.react('ailmentChart', [{type:'treemap', labels:s.map(d=>d.name), parents:s.map(_=>''), values:s.map(d=>d.value), textinfo:'label+percent root', hovertemplate:'%{label}<br>Weighted records: %{value:,.0f}<extra></extra>'}], {...plotLayoutBase, margin:{l:0,r:0,t:5,b:5}}, plotConfig);
}
function renderTreatment(rows){
  const s = weightedGroup(rows,'level_care').slice(0,10);
  Plotly.react('treatmentChart', [{type:'bar', x:s.map(d=>d.value), y:s.map(d=>d.name), orientation:'h', hovertemplate:'%{y}<br>Weighted records: %{x:,.0f}<extra></extra>'}], {...plotLayoutBase, xaxis:{title:'Weighted records'}, yaxis:{automargin:true}, margin:{l:150,r:20,t:10,b:45}}, plotConfig);
}
function renderHistogram(rows, cap){
  const vals = rows.map(r=>num(r.oop_episode_rs)).filter(v=>v>=0 && v<=cap);
  Plotly.react('histChart', [{type:'histogram', x:vals, nbinsx:35, hovertemplate:'OOP expenditure: ₹%{x:,.0f}<br>Rows: %{y}<extra></extra>'}], {...plotLayoutBase, xaxis:{title:'OOP episode expenditure (Rs.)'}, yaxis:{title:'Rows'}, bargap:.03}, plotConfig);
}
function renderFinance(rows){
  const s = weightedGroup(rows,'finance_source').slice(0,8);
  Plotly.react('financeChart', [{type:'pie', labels:s.map(d=>d.name), values:s.map(d=>d.value), hole:.48, hovertemplate:'%{label}<br>%{percent}<extra></extra>'}], {...plotLayoutBase, margin:{l:0,r:0,t:5,b:5}, showlegend:true, legend:{orientation:'h', y:-.15}}, plotConfig);
}
function renderPlace(rows){
  const s = weightedGroup(rows,'place_treatment');
  Plotly.react('placeChart', [{type:'bar', x:s.map(d=>d.name), y:s.map(d=>d.value), hovertemplate:'%{x}<br>Weighted records: %{y:,.0f}<extra></extra>'}], {...plotLayoutBase, xaxis:{automargin:true, tickangle:-25}, yaxis:{title:'Weighted records'}}, plotConfig);
}
function renderTable(rows){
  const cols = ['state','sector','age_group','ailment_group','chronic','hospitalised','treatment','level_care','oop_episode_rs','total_episode_expenditure_rs','finance_source'];
  const sample = rows.slice(0,100);
  let html = '<table class="data-table"><thead><tr>' + cols.map(c=>`<th>${c.replaceAll('_',' ')}</th>`).join('') + '</tr></thead><tbody>';
  sample.forEach(r=>{ html += '<tr>' + cols.map(c=>`<td>${c.endsWith('_rs') ? fmtINR.format(num(r[c])) : (r[c]||'')}</td>`).join('') + '</tr>'; });
  html += '</tbody></table>';
  document.getElementById('dataTableWrap').innerHTML = html;
}

function downloadFiltered(){
  const rows = getFiltered();
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'filtered_health_dashboard_data.csv'; a.click(); URL.revokeObjectURL(url);
}
function resetFilters(){
  ['sectorSelect','subroundSelect','ailmentSelect','chronicSelect','hospSelect'].forEach(id=>document.getElementById(id).value='All');
  Array.from(document.getElementById('stateSelect').options).forEach(o=>o.selected=false);
  document.getElementById('metricSelect').value='avg_oop'; document.getElementById('topN').value=15; document.getElementById('capSlider').value=50000; updateDashboard();
}
function wireEvents(){
  ['metricSelect','layoutSelect','sectorSelect','subroundSelect','ailmentSelect','chronicSelect','hospSelect','topN','capSlider'].forEach(id=>document.getElementById(id).addEventListener('input', () => {
    if(id==='layoutSelect'){ document.getElementById('chartGrid').className = 'chart-grid ' + document.getElementById('layoutSelect').value; setTimeout(()=>window.dispatchEvent(new Event('resize')), 20); }
    else updateDashboard();
  }));
  document.getElementById('stateSelect').addEventListener('change', updateDashboard);
  document.getElementById('clearStates').addEventListener('click', () => { Array.from(document.getElementById('stateSelect').options).forEach(o=>o.selected=false); updateDashboard(); });
  document.getElementById('nutritionProxyBtn').addEventListener('click', () => { document.getElementById('ailmentSelect').value='Endocrine, metabolic & nutritional'; updateDashboard(); });
  document.getElementById('resetBtn').addEventListener('click', resetFilters);
  document.getElementById('downloadBtn').addEventListener('click', downloadFiltered);
}

Papa.parse('data/health_level5_slim.csv', {
  download:true, header:true, dynamicTyping:true, skipEmptyLines:true,
  complete: function(results){ DATA = results.data; populateControls(); wireEvents(); document.getElementById('loadingStatus').textContent='Data loaded. Use the filters above.'; updateDashboard(); },
  error: function(err){ document.getElementById('loadingStatus').textContent='Could not load data: '+err; }
});
