// ===== CONFIGURATION =====
const COMPANIES = {
  EHS: {
    name: 'EHS INTEGRAL',
    logoUrl: 'https://ui-avatars.com/api/?name=EHS&background=fff&color=1A73E8&size=48&bold=true',
    thumbUrl: 'https://ui-avatars.com/api/?name=EHS&background=1A73E8&color=fff&size=24&rounded=true&bold=true',
    color: '#1A73E8'
  },
  GESTIONRH: {
    name: 'GESTIONRH',
    logoUrl: 'https://ui-avatars.com/api/?name=GRH&background=fff&color=E8430A&size=48&bold=true',
    thumbUrl: 'https://ui-avatars.com/api/?name=GRH&background=E8430A&color=fff&size=24&rounded=true&bold=true',
    color: '#E8430A'
  },
  ACADEMYGRH: {
    name: 'ACADEMYGRH',
    logoUrl: 'https://ui-avatars.com/api/?name=AG&background=fff&color=0DA855&size=48&bold=true',
    thumbUrl: 'https://ui-avatars.com/api/?name=AG&background=0DA855&color=fff&size=24&rounded=true&bold=true',
    color: '#0DA855'
  }
};


const SOCIAL_NETS = {
  ig: { name: 'Instagram', fields: ['likes','comentarios','compartidos','guardados','seguidores','clics'] },
  fb: { name: 'Facebook', fields: ['likes','comentarios','compartidos','guardados','seguidores','clics'] },
  tt: { name: 'TikTok', fields: ['likes','comentarios','compartidos','guardados','seguidores','clics'] },
  yt: { name: 'YouTube', fields: ['likes','comentarios','compartidos','guardados','seguidores','clics'] },
  li: { name: 'LinkedIn', fields: ['likes','comentarios','compartidos','guardados','seguidores','clics'] }
};

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ===== STATE =====
let allData = [];
let activeCompany = 'EHS';
let activePeriod = { month: new Date().getMonth(), year: new Date().getFullYear() };
let activeSocialNet = 'ig';
let activeSocialFormNet = 'ig';
let charts = {};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  initPeriod();
  await loadData();
  renderDashboard();
  bindEvents();
});

// ===== PERIOD =====
function initPeriod() {
  const now = new Date();
  activePeriod = { month: now.getMonth(), year: now.getFullYear() };
  updatePeriodLabel();
}

function updatePeriodLabel() {
  document.getElementById('periodLabel').textContent = `${MONTHS_ES[activePeriod.month]} ${activePeriod.year}`;
}

function getPeriodKey() {
  return `${String(activePeriod.month + 1).padStart(2,'0')}-${activePeriod.year}`;
}

function getPeriodLabel(key) {
  if (!key) return '';
  const [m, y] = key.split('-');
  return `${MONTHS_ES[parseInt(m)-1]} ${y}`;
}

// ===== DATA LOADING =====
async function loadData() {
  try {
    const res = await fetch('/api/data');
    allData = await res.json();
  } catch (e) {
    console.warn('No se pudo cargar datos del servidor. Usando localStorage.');
    const local = localStorage.getItem('di_data');
    allData = local ? JSON.parse(local) : [];
  }
}

function getCurrentRecord() {
  return allData.find(r => r.empresa === activeCompany && r.periodo === getPeriodKey()) || {};
}

function getRecordsForCompany() {
  return allData.filter(r => r.empresa === activeCompany).sort((a, b) => {
    const [am, ay] = a.periodo.split('-').map(Number);
    const [bm, by] = b.periodo.split('-').map(Number);
    return (ay * 12 + am) - (by * 12 + bm);
  });
}

// ===== SAVE DATA =====
async function saveRecord(data) {
  const record = { empresa: activeCompany, periodo: getPeriodKey(), ...data };
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    const json = await res.json();
    if (json.success) {
      // Update local state
      const idx = allData.findIndex(r => r.empresa === activeCompany && r.periodo === getPeriodKey());
      if (idx >= 0) allData[idx] = { ...allData[idx], ...record };
      else allData.push(record);
      // Backup to localStorage
      localStorage.setItem('di_data', JSON.stringify(allData));
      setStatusSaved();
      showToast('✅ Datos guardados correctamente', 'success');
      renderDashboard();
    }
  } catch (e) {
    // Fallback: save to localStorage only
    const idx = allData.findIndex(r => r.empresa === activeCompany && r.periodo === getPeriodKey());
    if (idx >= 0) allData[idx] = { ...allData[idx], ...record };
    else allData.push(record);
    localStorage.setItem('di_data', JSON.stringify(allData));
    setStatusSaved();
    showToast('⚠️ Guardado localmente (sin conexión al servidor)', 'success');
    renderDashboard();
  }
}

// ===== RENDER DASHBOARD =====
function renderDashboard() {
  const rec = getCurrentRecord();
  updateBanner();
  renderWebSEO(rec);
  renderSocialImpresiones(rec);
  renderWebInteraccion(rec);
  renderSocialInteracciones(rec);
  renderGlobalInteraccionesTotal(rec);
  renderConversiones(rec);
  renderCampanas(rec);
  renderRetargeting(rec);
  renderChartTendencia();
  renderChartWebImpresiones(rec);
  renderChartWebUTM(rec);
  renderChartSocialImpresiones(rec);
  renderChartWebVisitas(rec);
  renderChartSocialInteracciones(rec);
  renderChartGastos(rec);
}

function updateBanner() {
  const c = COMPANIES[activeCompany];
  document.getElementById('bannerName').textContent = c.name;
  document.getElementById('bannerLogo').src = c.logoUrl;
  document.querySelectorAll('.company-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.company === activeCompany);
  });
}

function fmt(val, prefix='') {
  if (val === undefined || val === null || val === '') return '—';
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  if (prefix === '$') return '$' + n.toLocaleString('es-MX');
  return n.toLocaleString('es-MX');
}

function renderWebSEO(rec) {
  const webOrg = parseFloat(rec.web_impresiones_organicas) || 0;
  const webAds = parseFloat(rec.web_impresiones_ads) || 0;
  setVal('web_impresiones_totales', fmt(webOrg + webAds));
  setVal('web_impresiones_organicas', fmt(webOrg));
  setVal('web_impresiones_ads', fmt(webAds));
  setVal('web_formularios', fmt(rec.web_formularios));
  setVal('web_posicion_google', rec.web_posicion_google ? `#${rec.web_posicion_google}` : '—');

  const pagesEl = document.getElementById('web_paginas_top');
  if (pagesEl) {
    if (rec.web_paginas_top && rec.web_paginas_top.trim()) {
      const pages = rec.web_paginas_top.split(',').map(p => p.trim()).filter(Boolean);
      pagesEl.innerHTML = pages.map(p => `<span class="page-chip" style="background: #e8f0fe; color: #1a73e8; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">${p}</span>`).join('');
    } else {
      pagesEl.textContent = '—';
    }
  }

  setVal('web_utm_ig', fmt(rec.web_utm_ig));
  setVal('web_utm_fb', fmt(rec.web_utm_fb));
  setVal('web_utm_tt', fmt(rec.web_utm_tt));
  setVal('web_utm_yt', fmt(rec.web_utm_yt));
  setVal('web_utm_li', fmt(rec.web_utm_li));
}

function renderGlobalResumen(rec) {
  const impWebO = parseFloat(rec.web_impresiones_organicas) || 0;
  const impWebA = parseFloat(rec.web_impresiones_ads) || 0;
  const impRedO = ['ig','fb','tt','yt','li'].reduce((sum, net) => sum + (parseFloat(rec[`${net}_impresiones_organicas`]) || 0), 0);
  const impRedA = ['ig','fb','tt','yt','li'].reduce((sum, net) => sum + (parseFloat(rec[`${net}_impresiones_ads`]) || 0), 0);
  
  const total = impWebO + impWebA + impRedO + impRedA;
  document.getElementById('global_impresiones_totales').textContent = total.toLocaleString();
}

function renderGlobalInteraccionesTotal(rec) {
  // Web Visits
  const visWebO = parseFloat(rec.web_visitas_organicas) || 0;
  const visWebA = parseFloat(rec.web_visitas_ads) || 0;
  // Fallback for legacy data
  const legacyVisWeb = parseFloat(rec.web_visitas) || 0;
  const totalWeb = (visWebO + visWebA) > 0 ? (visWebO + visWebA) : legacyVisWeb;

  // Social interactions & Followers
  let totalSocialInter = 0;
  let totalSocialFollowers = 0;

  ['ig','fb','tt','yt','li'].forEach(net => {
    // Interacciones
    const org = parseFloat(rec[`${net}_interacciones_organicas`]) || 0;
    const ads = parseFloat(rec[`${net}_interacciones_ads`]) || 0;
    const oldLikes = parseFloat(rec[`${net}_likes`]) || 0;
    const oldComms = parseFloat(rec[`${net}_comentarios`]) || 0;
    const oldShares = parseFloat(rec[`${net}_compartidos`]) || 0;
    const oldSaves = parseFloat(rec[`${net}_guardados`]) || 0;

    const currentTotal = org + ads;
    const oldTotal = oldLikes + oldComms + oldShares + oldSaves;
    totalSocialInter += (currentTotal > 0 ? currentTotal : oldTotal);

    // Seguidores
    totalSocialFollowers += (parseFloat(rec[`${net}_seguidores`]) || 0);
  });

  const finalInterTotal = totalWeb + totalSocialInter;
  
  if (document.getElementById('global_interacciones_totales')) {
    document.getElementById('global_interacciones_totales').textContent = finalInterTotal.toLocaleString();
  }
  if (document.getElementById('global_seguidores_totales')) {
    document.getElementById('global_seguidores_totales').textContent = totalSocialFollowers.toLocaleString();
  }
}

function renderSocialImpresiones(rec) {
  let socialTotal = 0;
  ['ig','fb','tt','yt','li'].forEach(net => {
    const org = parseFloat(rec[`${net}_impresiones_organicas`]) || 0;
    const ads = parseFloat(rec[`${net}_impresiones_ads`]) || 0;
    const total = org + ads;
    socialTotal += total;
    setVal(`${net}_impresiones_totales`, fmt(total));
    setVal(`${net}_impresiones_organicas`, fmt(org));
    setVal(`${net}_impresiones_ads`, fmt(ads));
  });
  setVal('social_impresiones_totales', fmt(socialTotal));
  
  const webOrg = parseFloat(rec.web_impresiones_organicas) || 0;
  const webAds = parseFloat(rec.web_impresiones_ads) || 0;
  setVal('global_impresiones_totales', fmt(webOrg + webAds + socialTotal));
}

function renderWebInteraccion(rec) {
  const org = parseFloat(rec.web_visitas_organicas) || 0;
  const ads = parseFloat(rec.web_visitas_ads) || 0;
  // Fallback to legacy field if organic and ads are both 0 and legacy has data
  const legacy = parseFloat(rec.web_visitas) || 0;
  const total = (org === 0 && ads === 0 && legacy > 0) ? legacy : (org + ads);
  
  setVal('web_visitas_totales', fmt(total));
  setVal('web_visitas_organicas', fmt(org));
  setVal('web_visitas_ads', fmt(ads));
}

function renderSocialInteracciones(rec) {
  let socialTotal = 0;
  ['ig','fb','tt','yt','li'].forEach(net => {
    const org = parseFloat(rec[`${net}_interacciones_organicas`]) || 0;
    const ads = parseFloat(rec[`${net}_interacciones_ads`]) || 0;
    const legacyLikes = parseFloat(rec[`${net}_likes`]) || 0;
    const legacyComms = parseFloat(rec[`${net}_comentarios`]) || 0;
    const legacyShares = parseFloat(rec[`${net}_compartidos`]) || 0;
    const legacySaves = parseFloat(rec[`${net}_guardados`]) || 0;
    const legacyClics = parseFloat(rec[`${net}_clics`]) || 0;
    
    // Total is either explicit org+ads or legacy sum if no explicit
    const explicitTotal = org + ads;
    const legacyTotal = legacyLikes + legacyComms + legacyShares + legacySaves + legacyClics;
    const total = (explicitTotal === 0 && legacyTotal > 0) ? legacyTotal : explicitTotal;
    
    socialTotal += total;
    setVal(`${net}_interacciones_totales`, fmt(total));
    setVal(`${net}_interacciones_organicas`, fmt(org));
    setVal(`${net}_interacciones_ads`, fmt(ads));
    
    setVal(`${net}_likes`, fmt(legacyLikes));
    setVal(`${net}_comentarios`, fmt(legacyComms));
    setVal(`${net}_compartidos`, fmt(legacyShares));
    setVal(`${net}_guardados`, fmt(legacySaves));
    setVal(`${net}_clics`, fmt(legacyClics));
    setVal(`${net}_seguidores`, fmt(rec[`${net}_seguidores`]));
  });
  setVal('social_interacciones_totales', fmt(socialTotal));
}

function renderConversiones(rec) {
  const w = parseFloat(rec.conv_whatsapp) || 0;
  const l = parseFloat(rec.conv_llamadas) || 0;
  const c = parseFloat(rec.conv_correos) || 0;
  const totalContactos = w + l + c;
  
  setVal('conv_suma_contactos', fmt(totalContactos));
  setVal('conversiones_totales', rec.conversiones_totales ? Number(rec.conversiones_totales).toLocaleString('es-MX') : '0');
  setVal('ventas_totales', rec.ventas_totales ? '$' + Number(rec.ventas_totales).toLocaleString('es-MX') : '$—');
  setVal('ticket_promedio', rec.ticket_promedio ? '$' + Number(rec.ticket_promedio).toLocaleString('es-MX') : '$—');
  setVal('conv_whatsapp', fmt(rec.conv_whatsapp));
  setVal('conv_llamadas', fmt(rec.conv_llamadas));
  setVal('conv_correos', fmt(rec.conv_correos));
  setVal('conv_cotizaciones', fmt(rec.conv_cotizaciones));
}

function renderCampanas(rec) {
  ['tiktok_ads','google_ads','meta_ads','mailchimp'].forEach(k => {
    const el = document.getElementById(`gasto_${k}`);
    if (!el) return;
    const v = rec[`gasto_${k}`];
    el.textContent = v ? '$' + Number(v).toLocaleString('es-MX') : '$—';
  });
  
  const subtotalAds = ['tiktok_ads', 'google_ads', 'meta_ads'].reduce((s, k) => s + (parseFloat(rec[`gasto_${k}`]) || 0), 0);
  const herramientas = parseFloat(rec.gasto_mailchimp) || 0;
  const totalInversion = subtotalAds + herramientas;

  const elSub = document.getElementById('gasto_subtotal_ads');
  if (elSub) elSub.textContent = '$' + subtotalAds.toLocaleString('es-MX');

  const elTotal = document.getElementById('gasto_inversion_total');
  if (elTotal) elTotal.textContent = '$' + totalInversion.toLocaleString('es-MX');
}

function renderRetargeting(rec) {
  setVal('retargeting_correos', rec.retargeting_correos ? Number(rec.retargeting_correos).toLocaleString('es-MX') : '0');
  setVal('retargeting_apertura', rec.retargeting_apertura ? Number(rec.retargeting_apertura).toLocaleString('es-MX', { minimumFractionDigits: 1 }) + '%' : '0.0%');
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ===== CHARTS =====
function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function renderChartWebImpresiones(rec) {
  destroyChart('chartWebImpresiones');
  const org = parseFloat(rec.web_impresiones_organicas) || 0;
  const ads = parseFloat(rec.web_impresiones_ads) || 0;
  
  const ctx = document.getElementById('chartWebImpresiones');
  if (!ctx) return;
  charts['chartWebImpresiones'] = new Chart(ctx, {
    type: 'doughnut',
    data: { 
      labels: ['Orgánicas', 'Google Ads'], 
      datasets: [{ data: [org, ads], backgroundColor: ['#1A73E8', '#FFB300'], borderWidth: 2, borderColor: '#fff' }] 
    },
    options: { 
      responsive: true, maintainAspectRatio: false, 
      plugins: { legend: { position: 'bottom', labels: { font: { size: 12, family: 'Inter' }, padding: 12 } } } 
    }
  });
}

function renderChartWebUTM(rec) {
  destroyChart('chartWebUTM');
  const ctx = document.getElementById('chartWebUTM');
  if (!ctx) return;
  
  const data = [
    parseFloat(rec.web_utm_ig) || 0,
    parseFloat(rec.web_utm_fb) || 0,
    parseFloat(rec.web_utm_tt) || 0,
    parseFloat(rec.web_utm_yt) || 0,
    parseFloat(rec.web_utm_li) || 0
  ];
  
  charts['chartWebUTM'] = new Chart(ctx, {
    type: 'bar',
    data: { 
      labels: ['IG', 'FB', 'TikTok', 'YouTube', 'LinkedIn'], 
      datasets: [{ 
        label: 'Clics',
        data, 
        backgroundColor: ['#E1306C', '#1877F2', '#000000', '#FF0000', '#0A66C2'], 
        borderRadius: 4 
      }] 
    },
    options: { 
      responsive: true, maintainAspectRatio: false, 
      plugins: { legend: { display: false } }, 
      scales: { y: { beginAtZero: true, grid: { color: '#F0F2F5' } }, x: { grid: { display: false } } } 
    }
  });
}

function renderChartSocialImpresiones(rec) {
  destroyChart('chartSocialImpresiones');
  const nets = ['ig','fb','tt','yt','li'];
  const labels = ['Instagram','Facebook','TikTok','YouTube','LinkedIn'];
  const dataOrg = nets.map(n => parseFloat(rec[`${n}_impresiones_organicas`]) || 0);
  const dataAds = nets.map(n => parseFloat(rec[`${n}_impresiones_ads`]) || 0);

  const ctx = document.getElementById('chartSocialImpresiones');
  if (!ctx) return;
  charts['chartSocialImpresiones'] = new Chart(ctx, {
    type: 'bar',
    data: { 
      labels, 
      datasets: [
        { label: 'Orgánicas', data: dataOrg, backgroundColor: '#7B1FA2', borderRadius: 4 },
        { label: 'Ads', data: dataAds, backgroundColor: '#E1BEE7', borderRadius: 4 }
      ] 
    },
    options: { 
      responsive: true, maintainAspectRatio: false, 
      scales: { x: { stacked: true }, y: { stacked: true } },
      plugins: { legend: { position: 'top', labels: { font: { size: 12, family: 'Inter' } } } } 
    }
  });
}

function renderChartWebVisitas(rec) {
  destroyChart('chartWebVisitas');
  const org = parseFloat(rec.web_visitas_organicas) || 0;
  const ads = parseFloat(rec.web_visitas_ads) || 0;
  
  const ctx = document.getElementById('chartWebVisitas');
  if (!ctx) return;
  charts['chartWebVisitas'] = new Chart(ctx, {
    type: 'doughnut',
    data: { 
      labels: ['Visitas Orgánicas', 'Visitas Ads'], 
      datasets: [{ data: [org, ads], backgroundColor: ['#1A73E8', '#FFB300'], borderWidth: 2, borderColor: '#fff' }] 
    },
    options: { 
      responsive: true, maintainAspectRatio: false, 
      plugins: { legend: { position: 'bottom', labels: { font: { size: 12, family: 'Inter' }, padding: 12 } } } 
    }
  });
}

function renderChartSocialInteracciones(rec) {
  destroyChart('chartSocialInteracciones');
  const nets = ['ig','fb','tt','yt','li'];
  const labels = ['Instagram','Facebook','TikTok','YouTube','LinkedIn'];
  const dataOrg = nets.map(n => parseFloat(rec[`${n}_interacciones_organicas`]) || 0);
  const dataAds = nets.map(n => parseFloat(rec[`${n}_interacciones_ads`]) || 0);

  const ctx = document.getElementById('chartSocialInteracciones');
  if (!ctx) return;
  charts['chartSocialInteracciones'] = new Chart(ctx, {
    type: 'bar',
    data: { 
      labels, 
      datasets: [
        { label: 'Orgánicas', data: dataOrg, backgroundColor: '#E65100', borderRadius: 4 },
        { label: 'Ads', data: dataAds, backgroundColor: '#FFCC80', borderRadius: 4 }
      ] 
    },
    options: { 
      responsive: true, maintainAspectRatio: false, 
      scales: { x: { stacked: true }, y: { stacked: true } },
      plugins: { legend: { position: 'top', labels: { font: { size: 12, family: 'Inter' } } } } 
    }
  });
}

function renderChartGastos(rec) {
  destroyChart('chartGastos');
  const ctx = document.getElementById('chartGastos');
  if (!ctx) return;
  const data = [
    parseFloat(rec.gasto_tiktok_ads) || 0,
    parseFloat(rec.gasto_google_ads) || 0,
    parseFloat(rec.gasto_meta_ads) || 0,
    parseFloat(rec.gasto_mailchimp) || 0
  ];
  charts['chartGastos'] = new Chart(ctx, {
    type: 'bar',
    data: { labels: ['TikTok', 'Google', 'Meta', 'Mailchimp'], datasets: [{ data, backgroundColor: ['#010101CC','#4285F4CC','#1877F2CC','#FFE01BCC'], borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#F0F2F5' }, ticks: { callback: v => '$' + v } }, x: { grid: { display: false } } } }
  });
}

function renderChartTendencia() {
  destroyChart('chartTendencia');
  const ctx = document.getElementById('chartTendencia');
  if (!ctx) return;
  const records = getRecordsForCompany();
  if (records.length === 0) return;

  const labels = records.map(r => getPeriodLabel(r.periodo));
  const visitas = records.map(r => (parseFloat(r.web_visitas_organicas) || 0) + (parseFloat(r.web_visitas_ads) || 0) || parseFloat(r.web_visitas) || 0);
  const impresionesWeb = records.map(r => (parseFloat(r.web_impresiones_organicas) || 0) + (parseFloat(r.web_impresiones_ads) || 0));
  const conversiones = records.map(r => parseFloat(r.conversiones_totales) || 0);

  charts['chartTendencia'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Visitas Web', data: visitas, borderColor: '#1A73E8', backgroundColor: 'rgba(26,115,232,.08)', borderWidth: 2.5, tension: .4, fill: true, pointRadius: 5, pointBackgroundColor: '#1A73E8' },
        { label: 'Impresiones Web', data: impresionesWeb, borderColor: '#7B1FA2', backgroundColor: 'rgba(123,31,162,.06)', borderWidth: 2, tension: .4, fill: true, pointRadius: 5, pointBackgroundColor: '#7B1FA2' },
        { label: 'Conversiones', data: conversiones, borderColor: '#0F9D58', backgroundColor: 'rgba(15,157,88,.06)', borderWidth: 2, tension: .4, fill: true, pointRadius: 5, pointBackgroundColor: '#0F9D58' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { font: { family: 'Inter', size: 12 }, padding: 16, boxWidth: 12 } } },
      scales: { y: { beginAtZero: true, grid: { color: '#F0F2F5' } }, x: { grid: { display: false } } }
    }
  });
}

// ===== COMPARE CHART =====
let compareState = { periodA: null, periodB: null, selectedIndex: null };

function toggleCompareMetric(idx) {
  if (compareState.selectedIndex === idx) {
    compareState.selectedIndex = null; // deselect, show all
  } else {
    compareState.selectedIndex = idx; // select single metric
  }
  renderCompareUI();
}

function renderCompare(periodA, periodB) {
  compareState.periodA = periodA;
  compareState.periodB = periodB;
  compareState.selectedIndex = null;
  renderCompareUI();
}

function renderCompareUI() {
  const { periodA, periodB, selectedIndex } = compareState;
  destroyChart('chartCompare');

  const recA = allData.find(r => r.empresa === activeCompany && r.periodo === periodA) || {};
  const recB = allData.find(r => r.empresa === activeCompany && r.periodo === periodB) || {};

  const getSocialImp = (r) => ['ig','fb','tt','yt','li'].reduce((sum, net) => sum + (parseFloat(r[`${net}_impresiones_organicas`]) || 0) + (parseFloat(r[`${net}_impresiones_ads`]) || 0), 0);
  const getWebVisits = (r) => (parseFloat(r.web_visitas_organicas) || 0) + (parseFloat(r.web_visitas_ads) || 0) || parseFloat(r.web_visitas) || 0;
  const getSocialInt = (r) => ['ig','fb','tt','yt','li'].reduce((sum, net) => {
    let orgAds = (parseFloat(r[`${net}_interacciones_organicas`]) || 0) + (parseFloat(r[`${net}_interacciones_ads`]) || 0);
    let legacy = (parseFloat(r[`${net}_likes`]) || 0) + (parseFloat(r[`${net}_comentarios`]) || 0) + (parseFloat(r[`${net}_compartidos`]) || 0) + (parseFloat(r[`${net}_guardados`]) || 0) + (parseFloat(r[`${net}_clics`]) || 0);
    return sum + (orgAds > 0 ? orgAds : legacy);
  }, 0);
  const getTotalInv = (r) => ['tiktok_ads', 'google_ads', 'meta_ads', 'mailchimp'].reduce((s, k) => s + (parseFloat(r[`gasto_${k}`]) || 0), 0);

  const metrics = [
    { label: 'Impresiones Web', val: r => (parseFloat(r.web_impresiones_organicas) || 0) + (parseFloat(r.web_impresiones_ads) || 0) },
    { label: 'Imp. Redes Sociales', val: r => getSocialImp(r) },
    { label: 'Visitas Web', val: r => getWebVisits(r) },
    { label: 'Interacción Total', val: r => getWebVisits(r) + getSocialInt(r) },
    { label: 'Conversiones Totales', val: r => parseFloat(r.conversiones_totales) || 0 },
    { label: 'Ingresos Totales', val: r => parseFloat(r.ventas_totales) || 0, isCurrency: true },
    { label: 'Gasto de Inversión', val: r => getTotalInv(r), isCurrency: true }
  ];

  let displayMetrics = selectedIndex !== null ? [metrics[selectedIndex]] : metrics;

  const labels = displayMetrics.map(m => m.label);
  const dataA = displayMetrics.map(m => m.val(recA));
  const dataB = displayMetrics.map(m => m.val(recB));

  const ctx = document.getElementById('chartCompare');
  if (ctx) {
    charts['chartCompare'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: getPeriodLabel(periodA), data: dataA, backgroundColor: '#1A73E8CC', borderRadius: 6 },
          { label: getPeriodLabel(periodB), data: dataB, backgroundColor: '#0F9D58CC', borderRadius: 6 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true, grid: { color: '#F0F2F5' } }, x: { grid: { display: false } } } }
    });
  }

  // Table
  const table = document.getElementById('compareTable');
  const rows = metrics.map((m, idx) => {
    const a = m.val(recA);
    const b = m.val(recB);
    const diff = b - a;
    const pct = a !== 0 ? ((diff / a) * 100).toFixed(1) : (b > 0 ? '∞' : '0');
    const colorCls = diff > 0 ? 'positive' : diff < 0 ? 'negative' : '';
    const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
    const fmt = (v) => m.isCurrency ? '$' + v.toLocaleString('es-MX') : v.toLocaleString('es-MX');
    const diffStr = m.isCurrency ? '$' + Math.abs(diff).toLocaleString('es-MX') : Math.abs(diff).toLocaleString('es-MX');
    
    const rowClass = selectedIndex === idx ? 'clickable-row selected-row' : 'clickable-row';
    return `<tr onclick="toggleCompareMetric(${idx})" class="${rowClass}"><td>${m.label}</td><td>${fmt(a)}</td><td>${fmt(b)}</td><td class="${colorCls}">${arrow} ${diffStr} (${pct}%)</td></tr>`;
  }).join('');
  
  table.innerHTML = `<table><thead><tr><th>Métrica</th><th>${getPeriodLabel(periodA)}</th><th>${getPeriodLabel(periodB)}</th><th>Cambio</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ===== BIND EVENTS =====
function bindEvents() {
  // Company tabs
  document.querySelectorAll('.company-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCompany = btn.dataset.company;
      renderDashboard();
    });
  });

  // Period navigation
  document.getElementById('prevPeriod').addEventListener('click', () => {
    activePeriod.month--;
    if (activePeriod.month < 0) { activePeriod.month = 11; activePeriod.year--; }
    updatePeriodLabel();
    renderDashboard();
  });
  document.getElementById('nextPeriod').addEventListener('click', () => {
    activePeriod.month++;
    if (activePeriod.month > 11) { activePeriod.month = 0; activePeriod.year++; }
    updatePeriodLabel();
    renderDashboard();
  });

  // Login → now opens data form directly
  document.getElementById('btnLogin').addEventListener('click', openRegisterModal);

  // Compare
  document.getElementById('btnCompare').addEventListener('click', openCompareModal);

  // Reporte button → scroll to top and refresh
  document.getElementById('btnReporte').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderDashboard();
    showToast('📊 Reporte actualizado', '');
  });
  // Register modal close
  document.getElementById('closeRegister').addEventListener('click', () => closeModal('registerModal'));
  document.getElementById('cancelRegister').addEventListener('click', () => closeModal('registerModal'));
  document.getElementById('submitRegister').addEventListener('click', handleSubmitRegister);

  // Form tabs
  document.querySelectorAll('.form-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.form-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      document.querySelectorAll('.form-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
    });
  });

  // Social form tabs
  document.querySelectorAll('.sf-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSocialFormNet = btn.dataset.snet;
      document.querySelectorAll('.sf-tab').forEach(t => t.classList.toggle('active', t.dataset.snet === activeSocialFormNet));
      renderSocialFormFields();
    });
  });

  // Compare
  document.getElementById('btnCompare').addEventListener('click', openCompareModal);
  document.getElementById('closeCompare').addEventListener('click', () => closeModal('compareModal'));
  document.getElementById('compareA').addEventListener('change', triggerCompare);
  document.getElementById('compareB').addEventListener('change', triggerCompare);

  // PDF
  document.getElementById('btnPdf').addEventListener('click', handlePDF);

  // Auto-calculate conversions
  document.querySelectorAll('.conv-input').forEach(input => {
    input.addEventListener('input', () => {
      const w = parseInt(document.getElementById('f_conv_whatsapp').value) || 0;
      const l = parseInt(document.getElementById('f_conv_llamadas').value) || 0;
      const c = parseInt(document.getElementById('f_conv_correos').value) || 0;
      const sum = w + l + c;
      document.getElementById('f_conversiones_totales').value = sum;
      document.getElementById('f_conv_suma_contactos').value = sum;
    });
  });

  // Overlay close
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); });
  });
}

// ===== REGISTER MODAL =====
function openRegisterModal() {
  document.getElementById('registerSubtitle').textContent = `${COMPANIES[activeCompany].name} — ${MONTHS_ES[activePeriod.month]} ${activePeriod.year}`;

  // Pre-fill with existing data
  const rec = getCurrentRecord();
  const webFields = ['web_impresiones_organicas','web_impresiones_ads','web_visitas','web_visitas_organicas','web_visitas_ads','web_formularios','web_posicion_google','web_paginas_top','web_utm_ig','web_utm_fb','web_utm_tt','web_utm_yt','web_utm_li'];
  webFields.forEach(f => { const el = document.getElementById(`f_${f}`); if (el && rec[f] !== undefined) el.value = rec[f]; });
  ['conversiones_totales','ventas_totales','ticket_promedio','conv_whatsapp','conv_llamadas','conv_correos','conv_cotizaciones','conv_suma_contactos'].forEach(f => {
    const el = document.getElementById(`f_${f}`); if (el && rec[f] !== undefined) el.value = rec[f];
  });
  ['gasto_tiktok_ads','gasto_google_ads','gasto_meta_ads','gasto_mailchimp'].forEach(f => {
    const el = document.getElementById(`f_${f}`); if (el && rec[f]) el.value = rec[f];
  });

  activeSocialFormNet = 'ig';
  document.querySelectorAll('.sf-tab').forEach(t => t.classList.toggle('active', t.dataset.snet === 'ig'));
  renderSocialFormFields(rec);
  openModal('registerModal');
}

function renderSocialFormFields(rec) {
  rec = rec || getCurrentRecord();
  const net = activeSocialFormNet;
  const config = SOCIAL_NETS[net];
  const grid = document.getElementById('socialFormGrid');
  grid.innerHTML = `
    <div class="form-group full-span" style="margin-top: 1rem; border-top: 1px solid #eee; padding-top: 0.5rem;">
      <h4 style="color: #666; font-size: 0.85rem; text-transform: uppercase;">Atracción (Impresiones)</h4>
    </div>
    <div class="form-group">
      <label>Impresiones Orgánicas</label>
      <input type="number" id="sf_${net}_impresiones_organicas" class="form-input" placeholder="0" value="${rec[`${net}_impresiones_organicas`] || ''}" />
    </div>
    <div class="form-group">
      <label>Impresiones Publicidad (Ads)</label>
      <input type="number" id="sf_${net}_impresiones_ads" class="form-input" placeholder="0" value="${rec[`${net}_impresiones_ads`] || ''}" />
    </div>
    <div class="form-group full-span" style="margin-top: 1rem; border-top: 1px solid #eee; padding-top: 0.5rem;">
      <h4 style="color: #666; font-size: 0.85rem; text-transform: uppercase;">Interacción (Orgánica vs Ads)</h4>
    </div>
    <div class="form-group">
      <label>Interacciones Orgánicas</label>
      <input type="number" id="sf_${net}_interacciones_organicas" class="form-input" placeholder="0" value="${rec[`${net}_interacciones_organicas`] || ''}" />
    </div>
    <div class="form-group">
      <label>Interacciones Publicidad (Ads)</label>
      <input type="number" id="sf_${net}_interacciones_ads" class="form-input" placeholder="0" value="${rec[`${net}_interacciones_ads`] || ''}" />
    </div>
    <div class="form-group full-span" style="margin-top: 1rem; border-top: 1px solid #eee; padding-top: 0.5rem;">
      <h4 style="color: #666; font-size: 0.85rem; text-transform: uppercase;">Detalle de Interacciones</h4>
    </div>
    ${config.fields.map(f => `
      <div class="form-group">
        <label>${f.replace('_',' ').replace(/\b\w/g, c => c.toUpperCase())}</label>
        <input type="number" id="sf_${net}_${f}" class="form-input" placeholder="0" value="${rec[`${net}_${f}`] || ''}" />
      </div>
    `).join('')}
  `;
}

function handleSubmitRegister() {
  const getNum = id => { const el = document.getElementById(id); return el ? (el.value || '') : ''; };
  const getStr = id => { const el = document.getElementById(id); return el ? el.value : ''; };

  // Collect all social data for current net
  const net = activeSocialFormNet;
  const config = SOCIAL_NETS[net];
  const socialData = {};
  socialData[`${net}_impresiones_organicas`] = getNum(`sf_${net}_impresiones_organicas`);
  socialData[`${net}_impresiones_ads`] = getNum(`sf_${net}_impresiones_ads`);
  socialData[`${net}_interacciones_organicas`] = getNum(`sf_${net}_interacciones_organicas`);
  socialData[`${net}_interacciones_ads`] = getNum(`sf_${net}_interacciones_ads`);
  config.fields.forEach(f => { socialData[`${net}_${f}`] = getNum(`sf_${net}_${f}`); });

  const data = {
    web_impresiones_organicas: getNum('f_web_impresiones_organicas'),
    web_impresiones_ads: getNum('f_web_impresiones_ads'),
    web_visitas_organicas: getNum('f_web_visitas_organicas'),
    web_visitas_ads: getNum('f_web_visitas_ads'),
    web_visitas: (parseFloat(getNum('f_web_visitas_organicas')) || 0) + (parseFloat(getNum('f_web_visitas_ads')) || 0),
    web_formularios: getNum('f_web_formularios'),
    web_posicion_google: getNum('f_web_posicion_google'),
    web_paginas_top: getStr('f_web_paginas_top'),
    web_utm_ig: getNum('f_web_utm_ig'),
    web_utm_fb: getNum('f_web_utm_fb'),
    web_utm_tt: getNum('f_web_utm_tt'),
    web_utm_yt: getNum('f_web_utm_yt'),
    web_utm_li: getNum('f_web_utm_li'),
    conversiones_totales: getNum('f_conversiones_totales'),
    ventas_totales: getNum('f_ventas_totales'),
    ticket_promedio: getNum('f_ticket_promedio'),
    conv_whatsapp: getNum('f_conv_whatsapp'),
    conv_llamadas: getNum('f_conv_llamadas'),
    conv_correos: getNum('f_conv_correos'),
    conv_cotizaciones: getNum('f_conv_cotizaciones'),
    conv_suma_contactos: getNum('f_conv_suma_contactos'),
    gasto_tiktok_ads: getNum('f_gasto_tiktok_ads'),
    gasto_google_ads: getNum('f_gasto_google_ads'),
    gasto_meta_ads: getNum('f_gasto_meta_ads'),
    gasto_mailchimp: getNum('f_gasto_mailchimp'),
    retargeting_correos: getNum('f_retargeting_correos'),
    retargeting_apertura: getNum('f_retargeting_apertura'),
    ...socialData
  };

  // Also preserve previously saved social data for other nets
  const existing = getCurrentRecord();
  const merged = { ...existing, ...data };

  closeModal('registerModal');
  setStatusUnsaved();
  saveRecord(merged);
}

// ===== COMPARE MODAL =====
function openCompareModal() {
  const records = getRecordsForCompany();
  if (records.length < 1) { showToast('No hay datos suficientes para comparar', 'error'); return; }

  const selA = document.getElementById('compareA');
  const selB = document.getElementById('compareB');
  const options = records.map(r => `<option value="${r.periodo}">${getPeriodLabel(r.periodo)}</option>`).join('');
  selA.innerHTML = options;
  selB.innerHTML = options;
  if (records.length > 1) selB.selectedIndex = 1;

  openModal('compareModal');
  triggerCompare();
}

function triggerCompare() {
  const a = document.getElementById('compareA').value;
  const b = document.getElementById('compareB').value;
  if (a && b) renderCompare(a, b);
}

// ===== PDF EXPORT =====
async function handlePDF() {
  showToast('⏳ Generando PDF...', '');
  const { jsPDF } = window.jspdf;
  const element = document.getElementById('reportContent');
  try {
    const canvas = await html2canvas(element, { scale: 1.5, useCORS: true, backgroundColor: '#F0F2F5' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = canvas.width;
    const imgH = canvas.height;
    const ratio = imgW / imgH;
    let w = pageW - 20, h = w / ratio;
    if (h > pageH - 20) { h = pageH - 20; w = h * ratio; }
    pdf.addImage(imgData, 'PNG', 10, 10, w, h);
    const fileName = `${COMPANIES[activeCompany].name.replace(/ /g,'_')}_${MONTHS_ES[activePeriod.month]}_${activePeriod.year}.pdf`;
    pdf.save(fileName);
    showToast('✅ PDF descargado', 'success');
  } catch (e) {
    showToast('Error al generar PDF', 'error');
  }
}

// ===== STATUS =====
function setStatusSaved() {
  const dot = document.getElementById('statusDot');
  dot.className = 'status-dot saved';
  dot.title = 'Datos guardados';
}
function setStatusUnsaved() {
  const dot = document.getElementById('statusDot');
  dot.className = 'status-dot unsaved';
  dot.title = 'Guardando...';
}

// ===== MODALS =====
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ===== TOAST =====
let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}
