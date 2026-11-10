(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.SalesActivity = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const COUNTERS = {
    comercial_leads: 'Leads (oportunidades) creados',
    comercial_cotizaciones: 'Cotizaciones hechas',
    comercial_seguimientos: 'Seguimientos hechos',
    comercial_cierres: 'Cierres hechos',
    comercial_oportunidades_campanas: 'Oportunidades por campañas publicitarias',
    comercial_cotizaciones_mkt: 'Cotizaciones de marketing',
    comercial_cotizaciones_directas: 'Cotizaciones directas'
  };
  const FIELDS = [...Object.keys(COUNTERS), 'comercial_productos_cotizados', 'comercial_cotizaciones_detalle'];
  const number = value => Number(value) || 0;
  function validNumber(value, integer = true) {
    if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return false;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 && (integer ? Number.isSafeInteger(n) : n <= Number.MAX_SAFE_INTEGER);
  }
  function validate(record) {
    if (!record || typeof record !== 'object') return 'Registro inválido';
    for (const [key, label] of Object.entries(COUNTERS)) {
      if (Object.hasOwn(record, key) && !validNumber(record[key])) return `${label}: ingresa un número entero mayor o igual a cero`;
    }
    const quoteKeys = ['comercial_cotizaciones', 'comercial_cotizaciones_mkt', 'comercial_cotizaciones_directas'];
    if (quoteKeys.some(key => Object.hasOwn(record, key))) {
      if (!quoteKeys.every(key => validNumber(record[key])) || number(record.comercial_cotizaciones) !== number(record.comercial_cotizaciones_mkt) + number(record.comercial_cotizaciones_directas)) {
        return 'Las cotizaciones de marketing y directas deben sumar el total de cotizaciones';
      }
    }
    for (const [key, text, amount, integer] of [
      ['comercial_productos_cotizados', 'nombre', 'cantidad', true],
      ['comercial_cotizaciones_detalle', 'referencia', 'monto', false]
    ]) {
      if (!Object.hasOwn(record, key)) continue;
      const rows = record[key];
      if (!Array.isArray(rows) || rows.length > 200 || rows.some(row => !row ||
        Object.keys(row).some(field => ![text, amount].includes(field)) ||
        typeof row[text] !== 'string' || !row[text].trim() || row[text].length > 200 ||
        !validNumber(row[amount], integer) || Number(row[amount]) <= 0)) {
        return key === 'comercial_productos_cotizados'
          ? 'Cada producto necesita nombre y cantidad entera mayor a cero (máximo 200 productos)'
          : 'Cada cotización necesita referencia y monto mayor a cero (máximo 200 cotizaciones)';
      }
    }
    if (FIELDS.some(key => Object.hasOwn(record, key)) && !/^(0[1-9]|1[0-2])-\d{4}$/.test(record.periodo)) return 'Selecciona un mes válido';
    return null;
  }
  function summarize(records) {
    const totals = Object.fromEntries(Object.keys(COUNTERS).map(key => [key, records.reduce((sum, r) => sum + number(r[key]), 0)]));
    const totalQuotes = totals.comercial_cotizaciones_mkt + totals.comercial_cotizaciones_directas;
    const products = new Map();
    const quotes = [];
    for (const record of records) {
      for (const product of Array.isArray(record.comercial_productos_cotizados) ? record.comercial_productos_cotizados : []) {
        if (!product || typeof product.nombre !== 'string' || !validNumber(product.cantidad) || Number(product.cantidad) <= 0) continue;
        const key = product.nombre.trim().toLocaleLowerCase('es-MX');
        const entry = products.get(key) || { nombre: product.nombre.trim(), cantidad: 0 };
        entry.cantidad += number(product.cantidad);
        products.set(key, entry);
      }
      for (const quote of Array.isArray(record.comercial_cotizaciones_detalle) ? record.comercial_cotizaciones_detalle : []) {
        if (quote && typeof quote.referencia === 'string' && validNumber(quote.monto, false) && Number(quote.monto) > 0) quotes.push({ ...quote, monto: number(quote.monto), periodo: record.periodo });
      }
    }
    return {
      totals, marketingPercent: totalQuotes ? totals.comercial_cotizaciones_mkt / totalQuotes * 100 : 0,
      directPercent: totalQuotes ? totals.comercial_cotizaciones_directas / totalQuotes * 100 : 0,
      topProducts: [...products.values()].sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre)).slice(0, 5),
      topQuotes: quotes.sort((a, b) => b.monto - a.monto || a.referencia.localeCompare(b.referencia)).slice(0, 3)
    };
  }
  return { COUNTERS, FIELDS, validate, summarize };
});
