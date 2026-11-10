let salesActivityCompany = null;
let salesActivityEventsBound = false;

function salesActivityPeriodKey() {
  const [year, month] = document.getElementById('salesActivityPeriod').value.split('-');
  return year && month ? `${month}-${year}` : '';
}

function renderSalesActivityDashboard() {
  if (!canAccess('ventas')) return;
  const month = document.getElementById('salesActivityMonth').value;
  const records = allData.filter(r => r.empresa === ventasActiveCompany &&
    r.periodo.endsWith(`-${ventasActiveYear}`) && (!month || r.periodo.startsWith(`${month}-`)));
  const summary = SalesActivity.summarize(records);
  const scope = `${COMPANIES[ventasActiveCompany].name} · ${month ? MONTHS_ES[Number(month) - 1] : 'Todo el año'} ${ventasActiveYear}`;
  document.getElementById('salesActivityScope').textContent = scope;
  const metrics = document.getElementById('salesActivityMetrics');
  metrics.replaceChildren();
  for (const key of Object.keys(SalesActivity.COUNTERS).slice(0, 5)) {
    const card = document.createElement('div');
    card.className = 'sales-activity-metric';
    card.dataset.metric = key;
    const label = document.createElement('span');
    label.textContent = SalesActivity.COUNTERS[key];
    const value = document.createElement('strong');
    value.textContent = summary.totals[key].toLocaleString('es-MX');
    card.append(label, value);
    metrics.append(card);
  }
  const origins = document.getElementById('salesActivityOrigins');
  origins.replaceChildren();
  for (const [name, key, percentage] of [
    ['Marketing', 'comercial_cotizaciones_mkt', summary.marketingPercent],
    ['Directas', 'comercial_cotizaciones_directas', summary.directPercent]
  ]) {
    const row = document.createElement('div');
    row.className = 'sales-origin-row';
    const label = document.createElement('span');
    label.textContent = `${name} (${summary.totals[key].toLocaleString('es-MX')})`;
    const value = document.createElement('strong');
    value.textContent = `${percentage.toFixed(1)}%`;
    row.append(label, value);
    const track = document.createElement('div');
    track.className = 'sales-origin-track';
    const bar = document.createElement('span');
    bar.style.width = `${percentage}%`;
    track.append(bar);
    origins.append(row, track);
  }
  if (!summary.totals.comercial_cotizaciones_mkt && !summary.totals.comercial_cotizaciones_directas) {
    const empty = document.createElement('p');
    empty.className = 'sales-help';
    empty.textContent = 'Sin cotizaciones por origen registradas en este periodo.';
    origins.append(empty);
  }
  function ranking(id, entries, format) {
    const list = document.getElementById(id);
    list.replaceChildren();
    for (const entry of entries) {
      const li = document.createElement('li');
      li.textContent = format(entry);
      list.append(li);
    }
    if (!entries.length) {
      const li = document.createElement('li');
      li.textContent = 'Sin registros en este periodo';
      list.append(li);
    }
  }
  ranking('salesActivityProducts', summary.topProducts, p => `${p.nombre} · ${p.cantidad.toLocaleString('es-MX')} cotizaciones`);
  ranking('salesActivityQuotes', summary.topQuotes, q => `${q.referencia} · ${q.monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} MXN · ${getPeriodLabel(q.periodo)}`);
}

function addSalesActivityRow(kind, data = {}) {
  const product = kind === 'product';
  const container = document.getElementById(product ? 'salesActivityProductRows' : 'salesActivityQuoteRows');
  if (container.children.length >= 200) return;
  const row = document.createElement('div');
  row.className = 'sales-detail-row';
  const textLabel = document.createElement('label');
  textLabel.textContent = product ? 'Producto' : 'Folio o cliente';
  const text = document.createElement('input');
  text.type = 'text'; text.className = 'form-input sales-detail-name'; text.maxLength = 200;
  text.value = data[product ? 'nombre' : 'referencia'] || '';
  textLabel.append(text);
  const numberLabel = document.createElement('label');
  numberLabel.textContent = product ? 'Veces cotizado' : 'Monto (MXN)';
  const amount = document.createElement('input');
  amount.type = 'number'; amount.className = 'form-input sales-detail-amount';
  amount.min = product ? '1' : '0.01'; amount.step = product ? '1' : '0.01';
  amount.value = data[product ? 'cantidad' : 'monto'] ?? '';
  numberLabel.append(amount);
  const remove = document.createElement('button');
  remove.type = 'button'; remove.className = 'btn btn-secondary'; remove.textContent = 'Quitar';
  remove.setAttribute('aria-label', product ? 'Quitar producto' : 'Quitar cotización');
  remove.addEventListener('click', () => row.remove());
  row.append(textLabel, numberLabel, remove);
  container.append(row);
}

function updateSalesActivityPercentages() {
  const mkt = Number(document.getElementById('activity_comercial_cotizaciones_mkt').value) || 0;
  const direct = Number(document.getElementById('activity_comercial_cotizaciones_directas').value) || 0;
  const total = mkt + direct;
  document.getElementById('salesActivityPercentages').textContent =
    `Origen: Marketing ${total ? (mkt / total * 100).toFixed(1) : '0.0'}% · Directas ${total ? (direct / total * 100).toFixed(1) : '0.0'}%. Ambas cantidades deben sumar el total de cotizaciones hechas.`;
}

function loadSalesActivityForm() {
  const record = allData.find(r => r.empresa === salesActivityCompany && r.periodo === salesActivityPeriodKey()) || {};
  const fields = document.getElementById('salesActivityFields');
  fields.replaceChildren();
  for (const [key, label] of Object.entries(SalesActivity.COUNTERS)) {
    const group = document.createElement('div'); group.className = 'form-group';
    const title = document.createElement('label'); title.htmlFor = `activity_${key}`; title.textContent = label;
    const input = document.createElement('input');
    input.id = `activity_${key}`; input.type = 'number'; input.min = '0'; input.step = '1';
    input.required = true; input.className = 'form-input'; input.value = record[key] ?? 0;
    input.addEventListener('input', updateSalesActivityPercentages);
    group.append(title, input); fields.append(group);
  }
  for (const [kind, key, id, initial] of [
    ['product', 'comercial_productos_cotizados', 'salesActivityProductRows', 5],
    ['quote', 'comercial_cotizaciones_detalle', 'salesActivityQuoteRows', 3]
  ]) {
    document.getElementById(id).replaceChildren();
    const entries = Array.isArray(record[key]) ? record[key] : [];
    if (entries.length) entries.forEach(entry => addSalesActivityRow(kind, entry));
    else for (let i = 0; i < initial; i++) addSalesActivityRow(kind);
  }
  document.getElementById('salesActivityFormError').textContent = '';
  updateSalesActivityPercentages();
}

function openSalesActivityForm() {
  if (!canAccess('ventas')) return;
  salesActivityCompany = salesCompany() || ventasActiveCompany;
  const month = document.getElementById('salesActivityMonth').value || String(new Date().getMonth() + 1).padStart(2, '0');
  document.getElementById('salesActivityPeriod').value = `${ventasActiveYear}-${month}`;
  document.getElementById('salesActivityFormCompany').textContent = COMPANIES[salesActivityCompany].name;
  loadSalesActivityForm();
  openModal('modalSalesActivity');
}

async function saveSalesActivity(event) {
  event.preventDefault();
  if (!canAccess('ventas') || (salesCompany() && salesActivityCompany !== salesCompany())) return;
  const error = document.getElementById('salesActivityFormError');
  error.textContent = '';
  const record = { empresa: salesActivityCompany, periodo: salesActivityPeriodKey() };
  for (const key of Object.keys(SalesActivity.COUNTERS)) record[key] = Number(document.getElementById(`activity_${key}`).value);
  for (const [key, id, textKey, numberKey] of [
    ['comercial_productos_cotizados', 'salesActivityProductRows', 'nombre', 'cantidad'],
    ['comercial_cotizaciones_detalle', 'salesActivityQuoteRows', 'referencia', 'monto']
  ]) {
    record[key] = Array.from(document.getElementById(id).children).map(row => ({
      text: row.querySelector('.sales-detail-name').value.trim(), amount: row.querySelector('.sales-detail-amount').value
    })).filter(row => row.text || row.amount !== '').map(row => ({ [textKey]: row.text, [numberKey]: row.amount === '' ? null : Number(row.amount) }));
  }
  const invalid = SalesActivity.validate(record);
  if (invalid) { error.textContent = invalid; return; }
  const button = document.getElementById('saveSalesActivity');
  button.disabled = true;
  try {
    const response = await fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || 'No se pudo guardar la actividad comercial');
    const index = allData.findIndex(r => r.empresa === record.empresa && r.periodo === record.periodo);
    if (index >= 0) allData[index] = { ...allData[index], ...record };
    else allData.push(record);
    localStorage.setItem('di_data', JSON.stringify(allData));
    ventasActiveYear = Number(record.periodo.split('-')[1]);
    closeModal('modalSalesActivity');
    renderVentasDashboard(ventasActiveCompany);
    showToast('Actividad comercial guardada correctamente', 'success');
  } catch (err) {
    error.textContent = err.message;
  } finally {
    button.disabled = false;
  }
}

function bindSalesActivityEvents() {
  if (salesActivityEventsBound) return;
  salesActivityEventsBound = true;
  document.getElementById('btnOpenSalesActivity').addEventListener('click', openSalesActivityForm);
  document.getElementById('salesActivityForm').addEventListener('submit', saveSalesActivity);
  document.getElementById('salesActivityPeriod').addEventListener('change', loadSalesActivityForm);
  document.getElementById('salesActivityMonth').addEventListener('change', renderSalesActivityDashboard);
  document.getElementById('addSalesProduct').addEventListener('click', () => addSalesActivityRow('product'));
  document.getElementById('addSalesQuote').addEventListener('click', () => addSalesActivityRow('quote'));
  for (const id of ['closeSalesActivity', 'cancelSalesActivity']) document.getElementById(id).addEventListener('click', () => closeModal('modalSalesActivity'));
}
