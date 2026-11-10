const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

// Separate processes reproduce Vercel serving login and data on different instances.
async function instance(t, configuration) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'analytics-session-'));
  const root = path.resolve(__dirname, '..');
  fs.copyFileSync(path.join(root, 'server.js'), path.join(dir, 'server.js'));
  fs.mkdirSync(path.join(dir, 'public'));
  fs.copyFileSync(path.join(root, 'public/sales-activity-model.js'), path.join(dir, 'public/sales-activity-model.js'));
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  fs.writeFileSync(path.join(dir, 'data-local.json'), JSON.stringify([
    { empresa: 'EHS', periodo: '01-2026', comercial_facturacion: 12345, web_visitas: 456 },
    { empresa: 'GESTIONRH', periodo: '01-2026', comercial_facturacion: 7890, web_visitas: 123 }
  ]));
  fs.writeFileSync(path.join(dir, 'data-redes.json'), JSON.stringify([{ empresa: 'EHS', periodo: '2026-11-09', alcance: 321 }]));
  const listener = net.createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
  const port = listener.address().port; await new Promise(resolve => listener.close(resolve));
  const env = { ...process.env, PORT: String(port) };
  delete env.SESSION_SECRET; delete env.FIREBASE_CONFIG;
  Object.assign(env, configuration);
  const child = spawn(process.execPath, [path.join(dir, 'server.js')], { env, stdio: 'ignore' });
  const exited = once(child, 'exit');
  t.after(async () => { child.kill(); await exited; fs.rmSync(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    try { await fetch(`${base}/api/session`); break; }
    catch (error) { if (i > 99 || child.exitCode !== null) throw error; await new Promise(resolve => setTimeout(resolve, 50)); }
  }
  return base;
}

for (const [name, config] of [
  ['configured session secret', { SESSION_SECRET: 'test-only-shared-session-secret' }],
  // This incomplete Firebase fixture deliberately keeps the server in local-data mode.
  ['existing Firebase private key', { FIREBASE_CONFIG: JSON.stringify({ private_key: 'test-only-private-key-material' }) }]
]) {
  test(`login survives another instance and a cold start using ${name}`, async t => {
    const first = await instance(t, config);
    const second = await instance(t, config);
    for (const [username, password, company] of [
      ['Admin', '4dm1n2026$', null], ['Saul Peña', 'DASaulS-2026$', null],
      ['Gerente EHS', 'EHS2027%', 'EHS'], ['Gerente Grh', 'GRH2027$', 'GESTIONRH']
    ]) {
      const login = await fetch(`${first}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      assert.equal(login.status, 200);
      const cookie = login.headers.get('set-cookie').split(';')[0];
      const response = await fetch(`${second}/api/session`, { headers: { Cookie: cookie } });
      assert.equal(response.status, 200, `${username}: session must be valid on the second process`);
      assert.equal((await response.json()).user.username, username);
      const endpoint = username === 'Saul Peña' ? 'redes' : 'data';
      const data = await fetch(`${second}/api/${endpoint}`, { headers: { Cookie: cookie } });
      assert.equal(data.status, 200);
      const records = await data.json();
      assert.ok(records.length > 0, `${username}: data must not be empty after login on another instance`);
      if (company) assert.ok(records.every(record => record.empresa === company));
      const cold = await instance(t, config);
      assert.equal((await fetch(`${cold}/api/session`, { headers: { Cookie: cookie } })).status, 200);
    }
  });
}

test('a session signed with a different server secret is rejected', async t => {
  const first = await instance(t, { SESSION_SECRET: 'test-only-server-one' });
  const second = await instance(t, { SESSION_SECRET: 'test-only-server-two' });
  const login = await fetch(`${first}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Gerente EHS', password: 'EHS2027%' }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(`${second}/api/session`, { headers: { Cookie: cookie } })).status, 401);
});
