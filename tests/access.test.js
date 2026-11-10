const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const net = require('node:net');

// Run an isolated server so access tests never alter application data.
test('account and company permissions', async t => {
  const root = path.resolve(__dirname, '..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'analytics-access-'));
  fs.copyFileSync(path.join(root, 'server.js'), path.join(dir, 'server.js'));
  fs.mkdirSync(path.join(dir, 'public'));
  fs.copyFileSync(path.join(root, 'public/sales-activity-model.js'), path.join(dir, 'public/sales-activity-model.js'));
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  const seed = [
    { empresa: 'EHS', periodo: '01-2027', comercial_facturacion: '100', web_visitas: 999 },
    { empresa: 'GESTIONRH', periodo: '01-2027', comercial_facturacion: '200', web_visitas: 888 }
  ];
  fs.writeFileSync(path.join(dir, 'data-local.json'), JSON.stringify(seed));
  const listener = net.createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const env = { ...process.env, PORT: String(port) };
  delete env.FIREBASE_CONFIG;
  const child = spawn(process.execPath, [path.join(dir, 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = once(child, 'exit');
  t.after(async () => { child.kill(); await exited; fs.rmSync(dir, { recursive: true, force: true }); });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const base = `http://127.0.0.1:${port}`;
  async function request(route, cookie, method = 'GET', body, extraHeaders = {}) {
    return fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...extraHeaders }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  for (let attempt = 0; ; attempt++) {
    try { await request('/api/session'); break; } catch (error) {
      if (attempt === 99 || child.exitCode !== null) throw new Error(`Server failed to start: ${output}`);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  const credentials = [
    ['gErEnTe EhS', 'EHS2027%', 'EHS'],
    ['GERENTE grh', 'GRH2027$', 'GESTIONRH']
  ];
  await t.test('anonymous requests and spoofed roles cannot read data', async () => {
    assert.equal((await request('/api/data', null, 'GET', undefined, { 'X-User-Role': 'admin' })).status, 401);
    assert.equal((await request('/api/redes')).status, 401);
  });
  for (const [username, password, company] of credentials) {
    await t.test(`${company}: case-insensitive login, session, isolated read/write`, async () => {
      const login = await request('/api/login', null, 'POST', { username: ` ${username} `, password });
      assert.equal(login.status, 200);
      const cookie = login.headers.get('set-cookie').split(';')[0];
      assert.match(login.headers.get('set-cookie'), /HttpOnly/i);
      assert.equal((await login.json()).user.company, company);
      assert.equal((await (await request('/api/session', cookie)).json()).user.company, company);
      const records = await (await request('/api/data', cookie)).json();
      assert.deepEqual(records, [{ empresa: company, periodo: '01-2027', comercial_facturacion: company === 'EHS' ? '100' : '200' }]);
      const updated = { empresa: company, periodo: '01-2027', comercial_facturacion: '300', comercial_cierres: '2', comercial_leads: '3', comercial_ticket: '150' };
      assert.equal((await request('/api/data', cookie, 'POST', [updated])).status, 200);
      assert.deepEqual(await (await request('/api/data', cookie)).json(), [updated]);
      const other = company === 'EHS' ? 'GESTIONRH' : 'EHS';
      assert.equal((await request('/api/data', cookie, 'POST', { ...updated, empresa: other }, { 'X-User-Role': 'admin' })).status, 403);
      assert.equal((await request('/api/data', cookie, 'POST', { ...updated, web_visitas: 0 })).status, 403);
      assert.equal((await request('/api/data', cookie, 'POST', [updated, { ...updated, empresa: other }])).status, 403);
      assert.equal((await request('/api/redes', cookie)).status, 403);
      assert.equal((await request('/api/REDES/', cookie)).status, 403);
      assert.equal((await request('/api/redes', cookie, 'POST', updated)).status, 403);
      const persisted = JSON.parse(fs.readFileSync(path.join(dir, 'data-local.json')));
      assert.equal(persisted.find(r => r.empresa === company).web_visitas, company === 'EHS' ? 999 : 888);
      const logout = await request('/api/logout', cookie, 'POST');
      assert.equal(logout.status, 200);
      assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/i);
    });
  }
  await t.test('passwords remain case-sensitive and malformed login is rejected', async () => {
    assert.equal((await request('/api/login', null, 'POST', { username: 'Gerente EHS', password: 'ehs2027%' })).status, 401);
    assert.equal((await request('/api/login', null, 'POST', { username: {}, password: 'EHS2027%' })).status, 401);
    assert.equal((await request('/api/session', 'di_session=forged.signature')).status, 401);
  });
  await t.test('existing administrator retains all modules and companies', async () => {
    const login = await request('/api/login', null, 'POST', { username: 'ADMIN', password: '4dm1n2026$' });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.deepEqual((await login.json()).user.allowedModules, ['marketing', 'ventas', 'redes']);
    const records = await (await request('/api/data', cookie)).json();
    assert.equal(records.length, 2);
    assert.equal(records[0].web_visitas, 999);
    assert.equal((await request('/api/redes', cookie)).status, 200);
  });
  await t.test('existing social account remains limited to social data', async () => {
    const login = await request('/api/login', null, 'POST', { username: 'SAULPENA', password: 'DASaulS-2026$' });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await request('/api/data', cookie)).status, 403);
    assert.equal((await request('/api/DATA/', cookie)).status, 403);
    assert.equal((await request('/api/redes', cookie)).status, 200);
  });
  await t.test('new activity fields persist for each company and reject invalid or cross-company batches atomically', async () => {
    for (const [username, password, company] of credentials) {
      const login = await request('/api/login', null, 'POST', { username, password });
      const cookie = login.headers.get('set-cookie').split(';')[0];
      const record = { empresa: company, periodo: '02-2027', comercial_leads: 20, comercial_cotizaciones: 10,
        comercial_seguimientos: 12, comercial_cierres: 3, comercial_oportunidades_campanas: 8,
        comercial_cotizaciones_mkt: 6, comercial_cotizaciones_directas: 4,
        comercial_productos_cotizados: [{ nombre: `${company} Producto`, cantidad: 5 }],
        comercial_cotizaciones_detalle: [{ referencia: `${company} Cotización`, monto: 45000.50 }] };
      assert.equal((await request('/api/data', cookie, 'POST', record)).status, 200);
      const rows = await (await request('/api/data', cookie)).json();
      assert.deepEqual(rows.find(r => r.periodo === record.periodo), record);
      assert.ok(rows.every(r => r.empresa === company));
      assert.equal((await request('/api/data', cookie, 'POST', { ...record, comercial_cotizaciones: 99 })).status, 400);
      assert.equal((await request('/api/data', cookie, 'POST', { ...record, comercial_seguimientos: -1 })).status, 400);
      assert.equal((await request('/api/data', cookie, 'POST', [{ ...record, comercial_leads: 50 }, { ...record, empresa: company === 'EHS' ? 'GESTIONRH' : 'EHS' }])).status, 403);
      assert.deepEqual((await (await request('/api/data', cookie)).json()).find(r => r.periodo === record.periodo), record);
      assert.equal((await request('/api/data', cookie, 'POST', { ...record, comercial_productos_cotizados: [], comercial_cotizaciones_detalle: [] })).status, 200);
      assert.deepEqual((await (await request('/api/data', cookie)).json()).find(r => r.periodo === record.periodo).comercial_productos_cotizados, []);
    }
  });

});
