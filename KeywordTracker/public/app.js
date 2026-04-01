// ===== CONFIGURATION =====
const COMPANIES = {
  EHS: {
    name: 'EHS INTEGRAL',
    logoUrl: 'https://ui-avatars.com/api/?name=EHS&background=fff&color=1A73E8&size=48&bold=true',
    color: '#1A73E8'
  },
  GESTIONRH: {
    name: 'GESTIONRH',
    logoUrl: 'https://ui-avatars.com/api/?name=GRH&background=fff&color=E8430A&size=48&bold=true',
    color: '#E8430A'
  },
  ACADEMYGRH: {
    name: 'ACADEMYGRH',
    logoUrl: 'https://ui-avatars.com/api/?name=AG&background=fff&color=0DA855&size=48&bold=true',
    color: '#0DA855'
  }
};

// ===== STATE =====
let allKeywords = [];
let activeCompany = 'EHS';
let activeKeyword = null;
let chartInstance = null;
let editingOriginal = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderDashboard();
  bindEvents();
});

// ===== DATA LOADING =====
async function loadData() {
  try {
    const res = await fetch('/api/keywords');
    allKeywords = await res.json();
  } catch (e) {
    console.warn('Error fetching keywords', e);
  }
}

function getCompanyData() {
  return allKeywords.filter(k => k.empresa === activeCompany);
}

function getUniqueKeywords() {
  const data = getCompanyData();
  const keys = new Set(data.map(d => d.keyword.trim().toLowerCase()));
  return Array.from(keys);
}

// ===== RENDER =====
function renderDashboard() {
  updateBanner();
  
  const keywords = getUniqueKeywords();
  if (keywords.length === 0) {
    document.getElementById('keywordTabs').innerHTML = ''; // Limpiar tabs
    document.getElementById('chartSection').style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('currentKeywordLabel').textContent = 'Aún no hay palabras clave';
    return;
  }

  document.getElementById('emptyState').style.display = 'none';
  
  if (!activeKeyword || !keywords.includes(activeKeyword.toLowerCase())) {
    activeKeyword = keywords[0]; // first keyword
  }

  renderKeywordTabs(keywords);
  renderKeywordData();
}

function updateBanner() {
  const c = COMPANIES[activeCompany];
  document.getElementById('bannerName').textContent = c.name;
  document.getElementById('bannerLogo').src = c.logoUrl;
  document.querySelectorAll('.company-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.company === activeCompany);
  });
}

function renderKeywordTabs(keywords) {
  const container = document.getElementById('keywordTabs');
  
  const displayKeywords = [];
  const data = getCompanyData();
  keywords.forEach(kwLower => {
     const match = data.find(d => d.keyword.toLowerCase() === kwLower);
     if (match) displayKeywords.push(match.keyword.trim());
  });

  container.innerHTML = displayKeywords.map(kw => `
    <button class="keyword-pill ${activeKeyword && kw.toLowerCase() === activeKeyword.toLowerCase() ? 'active' : ''}" 
            data-kw="${kw}">
      ${kw}
    </button>
  `).join('');

  container.querySelectorAll('.keyword-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      activeKeyword = e.target.dataset.kw.toLowerCase();
      renderDashboard();
    });
  });
}

function parseDate(dateStr) {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 2 && parts[2].length === 4) {
      return new Date(parts[2], parseInt(parts[1]) - 1, parts[0]);
    }
  }
  const d = new Date(dateStr);
  return isNaN(d) ? new Date(0) : d;
}

function renderKeywordData() {
  const data = getCompanyData().filter(d => d.keyword.trim().toLowerCase() === activeKeyword.toLowerCase());
  const originalCasedKwd = data.length > 0 ? data[data.length - 1].keyword : activeKeyword;

  document.getElementById('chartSection').style.display = 'block';
  document.getElementById('currentKeywordLabel').textContent = `Resultados para: "${originalCasedKwd}"`;
  document.getElementById('subtitleKeyword').textContent = originalCasedKwd;

  data.sort((a, b) => parseDate(a.fecha) - parseDate(b.fecha));

  const labels = data.map(d => d.fecha);
  const positions = data.map(d => parseFloat(d.posicion) || 0);

  const tbody = document.getElementById('historyTableBody');
  const tableData = [...data].reverse();
  tbody.innerHTML = tableData.map(d => `
    <tr style="border-bottom: 1px solid #f0f2f5;">
      <td style="padding: 12px 16px;">${d.fecha}</td>
      <td style="padding: 12px 16px; font-weight: 600; color: #1a73e8; font-size: 1.05rem;">
        #${d.posicion}
      </td>
      <td style="padding: 12px 16px; text-align: right;">
        <button class="btn-action edit-btn" style="background: transparent; border: none; cursor: pointer; color: #5f6368; margin-right: 8px;" data-kw="${d.keyword.replace(/"/g, '&quot;')}" data-dt="${d.fecha}" data-pos="${d.posicion}" title="Editar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
        </button>
        <button class="btn-action delete-btn" style="background: transparent; border: none; cursor: pointer; color: #ea4335;" data-kw="${d.keyword.replace(/"/g, '&quot;')}" data-dt="${d.fecha}" title="Eliminar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </td>
    </tr>
  `).join('');

  // Vincular eventos de los botones recién renderizados
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const kw = e.currentTarget.dataset.kw;
      const dt = e.currentTarget.dataset.dt;
      const pos = e.currentTarget.dataset.pos;
      editingOriginal = { empresa: activeCompany, keyword: kw, fecha: dt };

      document.getElementById('modalSubtitle').textContent = COMPANIES[activeCompany].name + " (Editando)";
      document.getElementById('f_keyword').value = kw;
      document.getElementById('f_fecha').value = dt;
      document.getElementById('f_posicion').value = pos;
      openModal('keywordModal');
    });
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const kw = e.currentTarget.dataset.kw;
      const dt = e.currentTarget.dataset.dt;
      if (confirm(`¿Estás seguro de eliminar el registro de '${kw}' en la fecha ${dt}?`)) {
        deleteRecord(activeCompany, kw, dt);
      }
    });
  });

  renderChart(labels, positions);
}

function renderChart(labels, dataY) {
  if (chartInstance) {
    chartInstance.destroy();
  }

  const ctx = document.getElementById('chartKeyword');
  if (!ctx) return;

  const color = COMPANIES[activeCompany].color;

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Posición en Google',
        data: dataY,
        borderColor: color,
        backgroundColor: color + '20',
        borderWidth: 3,
        tension: 0.2,
        fill: true,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: color
      }]
    },
    options: {
      responsive: true, 
      maintainAspectRatio: false,
      plugins: { 
        legend: { display: false },
        tooltip: {
           callbacks: {
              label: function(context) { return 'Posición: #' + context.parsed.y; }
           }
        }
      },
      scales: { 
        y: { 
          reverse: true, // Google position 1 is highest
          beginAtZero: false,
          min: 1, 
          grid: { color: '#F0F2F5' },
          ticks: {
            stepSize: 1,
            callback: function(value) { return '#' + value; }
          }
        }, 
        x: { grid: { display: false } } 
      }
    }
  });
}

// ===== MODAL LOGIC =====
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('active');
    el.style.display = 'flex';
    el.style.visibility = 'visible';
    el.style.opacity = '1';
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('active');
    el.style.display = 'none';
    el.style.visibility = 'hidden';
    el.style.opacity = '0';
  }
}

// ===== EVENTS =====
function bindEvents() {
  document.querySelectorAll('.company-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCompany = btn.dataset.company;
      activeKeyword = null; // reset
      renderDashboard();
    });
  });

  document.getElementById('btnAddKeyword').addEventListener('click', () => {
    editingOriginal = null;
    document.getElementById('modalSubtitle').textContent = COMPANIES[activeCompany].name;
    document.getElementById('f_keyword').value = activeKeyword || '';
    
    const d = new Date();
    document.getElementById('f_fecha').value = `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
    document.getElementById('f_posicion').value = '';
    
    openModal('keywordModal');
  });

  document.getElementById('closeKeywordModal').addEventListener('click', () => closeModal('keywordModal'));
  document.getElementById('cancelKeywordModal').addEventListener('click', () => closeModal('keywordModal'));
  
  document.getElementById('saveKeywordRecord').addEventListener('click', saveRecord);

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); });
  });
}

// ===== SAVE API =====
async function saveRecord() {
  const keyword = document.getElementById('f_keyword').value.trim();
  const fecha = document.getElementById('f_fecha').value.trim();
  const posicion = document.getElementById('f_posicion').value.trim();

  if (!keyword || !fecha || !posicion) {
    showToast('❌ Completa todos los campos principales', 'error');
    return;
  }

  const record = {
    empresa: activeCompany,
    keyword: keyword,
    fecha: fecha,
    posicion: posicion
  };

  try {
    let url = '/api/keywords';
    let method = 'POST';
    let bodyData = record;

    if (editingOriginal) {
      method = 'PUT';
      bodyData = { original: editingOriginal, updated: record };
    }

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });
    
    const json = await res.json();
    if (json.success) {
      showToast('✅ Guardado correctamente', 'success');
      
      await loadData(); // Reload all to avoid state bugs matching old keys
      activeKeyword = keyword.toLowerCase(); // switch to newly added/updated word
      
      closeModal('keywordModal');
      renderDashboard();
    } else {
      showToast('❌ Error: ' + json.message, 'error');
    }
  } catch (e) {
    showToast('❌ Error de conexión al guardar', 'error');
  }
}

async function deleteRecord(emp, kw, dt) {
  try {
    const res = await fetch('/api/keywords', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresa: emp, keyword: kw, fecha: dt })
    });
    const json = await res.json();
    if (json.success) {
      showToast('✅ Registro eliminado', 'success');
      await loadData();
      renderDashboard();
    } else {
      showToast('❌ Error al eliminar', 'error');
    }
  } catch (e) {
    showToast('❌ Error de conexión', 'error');
  }
}

function showToast(msg, type='info') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show', type);
  setTimeout(() => {
    t.classList.remove('show', type);
  }, 3000);
}
