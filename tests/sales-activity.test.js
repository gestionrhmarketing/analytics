const test = require('node:test');
const assert = require('node:assert/strict');
const { summarize, validate } = require('../public/sales-activity-model');

function record(overrides = {}) {
  return { empresa: 'EHS', periodo: '01-2027', comercial_leads: 20, comercial_cotizaciones: 10,
    comercial_seguimientos: 12, comercial_cierres: 3, comercial_oportunidades_campanas: 8,
    comercial_cotizaciones_mkt: 6, comercial_cotizaciones_directas: 4, ...overrides };
}

test('percentages use total quote counts instead of averaging monthly percentages', () => {
  const summary = summarize([record(), record({ periodo: '02-2027', comercial_cotizaciones: 90, comercial_cotizaciones_mkt: 9, comercial_cotizaciones_directas: 81 })]);
  assert.equal(summary.totals.comercial_leads, 40);
  assert.equal(summary.totals.comercial_cotizaciones, 100);
  assert.equal(summary.totals.comercial_seguimientos, 24);
  assert.equal(summary.marketingPercent, 15);
  assert.equal(summary.directPercent, 85);
});

test('ranks products by combined count and quotes by individual amount', () => {
  const summary = summarize([
    record({ comercial_productos_cotizados: [{ nombre: 'Curso', cantidad: 4 }, { nombre: '<img onerror=alert(1)>', cantidad: 1 }], comercial_cotizaciones_detalle: [{ referencia: 'Q1', monto: 1000 }, { referencia: 'Q2', monto: 5000 }] }),
    record({ periodo: '02-2027', comercial_productos_cotizados: [{ nombre: ' curso ', cantidad: 5 }, ...['A', 'B', 'C', 'D', 'E'].map((nombre, i) => ({ nombre, cantidad: i + 1 }))], comercial_cotizaciones_detalle: [{ referencia: 'Q3', monto: 4000 }, { referencia: 'Q4', monto: 2000 }] })
  ]);
  assert.deepEqual(summary.topProducts[0], { nombre: 'Curso', cantidad: 9 });
  assert.equal(summary.topProducts.length, 5);
  assert.deepEqual(summary.topQuotes.map(q => q.referencia), ['Q2', 'Q3', 'Q4']);
});

test('empty and legacy sales records remain usable', () => {
  assert.equal(validate({ empresa: 'EHS', periodo: '01-2027', comercial_facturacion: '100', comercial_cierres: '0', comercial_leads: '2' }), null);
  assert.equal(summarize([]).marketingPercent, 0);
  assert.equal(summarize([{}]).directPercent, 0);
  assert.deepEqual(summarize([]).topProducts, []);
});

test('validates counts, quote origins, period and ranking row shape', () => {
  assert.equal(validate(record()), null);
  for (const invalid of [
    record({ comercial_leads: -1 }), record({ comercial_seguimientos: 1.5 }),
    record({ comercial_cotizaciones_mkt: 3 }), record({ comercial_cotizaciones_directas: undefined }),
    record({ periodo: '13-2027' }), record({ comercial_productos_cotizados: [{ nombre: '', cantidad: 1 }] }),
    record({ comercial_productos_cotizados: [{ nombre: 'A', cantidad: 1.5 }] }),
    record({ comercial_cotizaciones_detalle: [{ referencia: 'Q1', monto: -5 }] }),
    record({ comercial_cotizaciones_detalle: [{ referencia: 'Q1', monto: 5, extra: 'untrusted' }] })
  ]) assert.equal(typeof validate(invalid), 'string');
  assert.equal(validate(record({ comercial_productos_cotizados: [], comercial_cotizaciones_detalle: [] })), null);
});
