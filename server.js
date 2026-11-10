const express = require('express');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const crypto = require('crypto');
const salesActivity = require('./public/sales-activity-model');

// Initialize Firebase Admin (Safe for deployment)
let serviceAccount;

if (process.env.FIREBASE_CONFIG) {
  // If we are on a server (Heroku, Render, etc.) we use the environment variable
  serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
} else if (fs.existsSync(path.join(__dirname, 'firebase-key.json'))) {
  // Local development
  serviceAccount = require('./firebase-key.json');
}

let db = null;
let reportsRef = null;
let redesRef = null;
const localDataPath = path.join(__dirname, 'data-local.json');
const localRedesPath = path.join(__dirname, 'data-redes.json');

function getLocalData() {
  if (fs.existsSync(localDataPath)) {
    try {
      return JSON.parse(fs.readFileSync(localDataPath, 'utf8'));
    } catch (e) {
      return [];
    }
  }
  return [];
}

function saveLocalData(data) {
  try {
    fs.writeFileSync(localDataPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    // En Vercel / serverless el sistema de archivos es read-only (EROFS)
  }
}

function getLocalRedesData() {
  if (fs.existsSync(localRedesPath)) {
    try {
      return JSON.parse(fs.readFileSync(localRedesPath, 'utf8'));
    } catch (e) {
      return [];
    }
  }
  return [];
}

function saveLocalRedesData(data) {
  try {
    fs.writeFileSync(localRedesPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    // En Vercel / serverless el sistema de archivos es read-only (EROFS)
  }
}

if (serviceAccount) {
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
    db = admin.firestore();
    reportsRef = db.collection('reports');
    redesRef = db.collection('redes_sociales');
    console.log('✅ Firebase Admin Initialized (Colecciones independientes: reports, redes_sociales)');
  } catch (err) {
    console.error('❌ Error initializing Firebase Admin:', err.message);
  }
} else {
  console.warn('⚠️ AVISO: No se encontró configuración de Firebase. Se usará almacenamiento local (data-local.json y data-redes.json).');
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory cache & Firestore quota protection
let memoryCache = null;
let lastCacheTime = 0;
let redesMemoryCache = null;
let lastRedesCacheTime = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos de caché (reduce lecturas de Firestore en un 99%)

// ===== AUTENTICACIÓN Y USUARIOS =====
const AUTH_USERS = [
  {
    username: 'Admin',
    aliases: ['admin'],
    password: '4dm1n2026$',
    name: 'Administrador',
    role: 'admin',
    allowedModules: ['marketing', 'ventas', 'redes']
  },
  {
    username: 'Saul Peña',
    aliases: ['saul peña', 'saul pena', 'saul', 'saulpena'],
    password: 'DASaulS-2026$',
    name: 'Saul Peña',
    role: 'redes_only',
    allowedModules: ['redes']
  },
  {
    username: 'Gerente EHS',
    password: 'EHS2027%',
    name: 'Gerente EHS',
    role: 'ventas_ehs',
    allowedModules: ['ventas'],
    company: 'EHS'
  },
  {
    username: 'Gerente Grh',
    password: 'GRH2027$',
    name: 'Gerente Grh',
    role: 'ventas_grh',
    allowedModules: ['ventas'],
    company: 'GESTIONRH'
  }
];

// Every serverless instance must derive the same signing key. Prefer a dedicated
// secret; when Firebase is configured, derive a separate key from its existing
// server-only credential instead of generating a different key per cold start.
const firebaseSessionKey = typeof serviceAccount?.private_key === 'string' && serviceAccount.private_key
  ? crypto.createHmac('sha256', serviceAccount.private_key).update('digital-insights/session/v1').digest()
  : null;
const SESSION_KEY = process.env.SESSION_SECRET || firebaseSessionKey || crypto.randomBytes(32);
const SESSION_MAX_AGE = 12 * 60 * 60 * 1000;
const SALES_FIELDS = ['empresa', 'periodo', 'comercial_facturacion', 'comercial_cierres', 'comercial_ticket', ...salesActivity.FIELDS];

function publicUser(user) {
  const { username, name, role, allowedModules, company } = user;
  return { username, name, role, allowedModules, company };
}

function signSession(payload) {
  return crypto.createHmac('sha256', SESSION_KEY).update(payload).digest('base64url');
}

function sessionUser(req) {
  const token = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith('di_session='));
  if (!token) return null;
  const [payload, signature] = token.slice('di_session='.length).split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(signSession(payload));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!Number.isFinite(session.expires) || session.expires <= Date.now()) return null;
    return AUTH_USERS.find(u => u.username === session.username) || null;
  } catch {
    return null;
  }
}

function sendReports(req, res, records) {
  if (!req.user.company) return res.json(records);
  return res.json(records.filter(r => r.empresa === req.user.company).map(r =>
    Object.fromEntries(SALES_FIELDS.filter(key => Object.hasOwn(r, key)).map(key => [key, r[key]]))
  ));
}

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const cleanUser = typeof username === 'string' ? username.trim().toLowerCase() : '';
  const found = AUTH_USERS.find(u => 
    (u.username.toLowerCase() === cleanUser || (u.aliases && u.aliases.includes(cleanUser))) &&
    u.password === password
  );

  if (!found) {
    return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
  }

  const payload = Buffer.from(JSON.stringify({ username: found.username, expires: Date.now() + SESSION_MAX_AGE })).toString('base64url');
  res.cookie('di_session', `${payload}.${signSession(payload)}`, {
    httpOnly: true, sameSite: 'lax', secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    maxAge: SESSION_MAX_AGE, path: '/'
  });
  return res.json({ success: true, user: publicUser(found) });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('di_session', { path: '/' });
  res.json({ success: true });
});

app.use('/api', (req, res, next) => {
  req.user = sessionUser(req);
  if (!req.user) return res.status(401).json({ success: false, message: 'Inicia sesión para continuar' });
  const route = req.path.replace(/\/+$/, '').toLowerCase();
  const module = route === '/data' ? (req.user.company ? 'ventas' : 'marketing') : route === '/redes' ? 'redes' : null;
  if (module && !req.user.allowedModules.includes(module)) {
    return res.status(403).json({ success: false, message: 'No tienes acceso a este módulo' });
  }
  next();
});

app.get('/api/session', (req, res) => res.json({ success: true, user: publicUser(req.user) }));

// GET all data
app.get('/api/data', async (req, res) => {
  const now = Date.now();

  // 1. Servir desde memoria si el caché está fresco (0 lecturas a Firestore)
  if (memoryCache && (now - lastCacheTime < CACHE_TTL_MS) && !req.query.force) {
    return sendReports(req, res, memoryCache);
  }

  try {
    if (reportsRef) {
      console.log('📡 Consultando Firestore (Caché expirada o inicializando)...');
      const snapshot = await reportsRef.get();
      const results = [];
      snapshot.forEach(doc => {
        results.push(doc.data());
      });

      if (results.length > 0) {
        memoryCache = results;
        lastCacheTime = now;
        // Respaldo en disco por si Firebase agota su cuota en el futuro
        saveLocalData(results);
        return sendReports(req, res, results);
      }
    }

    const localData = getLocalData();
    memoryCache = localData;
    lastCacheTime = now;
    return sendReports(req, res, localData);

  } catch (err) {
    console.error('⚠️ Error al consultar Firestore (posible cuota diaria agotada):', err.message);

    // Fallback de alta disponibilidad: Si Firebase agota su cuota, usamos la memoria o data-local.json
    if (memoryCache && memoryCache.length > 0) {
      console.log('🛡️ Servido desde caché en memoria para proteger la experiencia del usuario.');
      return sendReports(req, res, memoryCache);
    }

    const fallbackLocal = getLocalData();
    console.log(`🛡️ Servido desde respaldo local data-local.json (${fallbackLocal.length} registros).`);
    return sendReports(req, res, fallbackLocal);
  }
});

// POST save/update a record (supports single record or array of records)
app.post('/api/data', async (req, res) => {
  try {
    const records = Array.isArray(req.body) ? req.body : [req.body];
    if (records.length === 0) {
      return res.status(400).json({ success: false, message: 'No se enviaron datos' });
    }

    if (req.user.company && records.some(record =>
      !record || record.empresa !== req.user.company || typeof record.periodo !== 'string' ||
      Object.keys(record).some(key => !SALES_FIELDS.includes(key))
    )) {
      return res.status(403).json({ success: false, message: 'Solo puedes modificar Ventas de tu empresa' });
    }

    for (const record of records) {
      const error = salesActivity.validate(record);
      if (error) return res.status(400).json({ success: false, message: error });
    }

    // 1. Guardar en Firebase Firestore con merge: true (preserva todos los demás campos)
    if (reportsRef) {
      for (const newRecord of records) {
        if (!newRecord.empresa || !newRecord.periodo) continue;
        const docId = `${newRecord.empresa}_${newRecord.periodo}`.replace(/\s+/g, '_');
        await reportsRef.doc(docId).set(newRecord, { merge: true });
      }
    }

    // 2. Actualizar caché en memoria para respuesta instantánea
    if (memoryCache && Array.isArray(memoryCache)) {
      for (const newRecord of records) {
        if (!newRecord.empresa || !newRecord.periodo) continue;
        const idx = memoryCache.findIndex(r => r.empresa === newRecord.empresa && r.periodo === newRecord.periodo);
        if (idx >= 0) {
          memoryCache[idx] = { ...memoryCache[idx], ...newRecord };
        } else {
          memoryCache.push(newRecord);
        }
      }
      lastCacheTime = Date.now();
    }

    // 3. Respaldo local en data-local.json (si el entorno lo permite)
    const localData = getLocalData();
    for (const newRecord of records) {
      if (!newRecord.empresa || !newRecord.periodo) continue;
      const idx = localData.findIndex(r => r.empresa === newRecord.empresa && r.periodo === newRecord.periodo);
      if (idx >= 0) {
        localData[idx] = { ...localData[idx], ...newRecord };
      } else {
        localData.push(newRecord);
      }
    }
    saveLocalData(localData);

    return res.json({ success: true, message: 'Datos guardados correctamente' });
  } catch (err) {
    console.error('Error saving data:', err);
    res.status(500).json({ success: false, message: 'Error al guardar datos: ' + err.message });
  }
});

// ===== REDES SOCIALES API (100% INDEPENDIENTE DE MARKETING Y VENTAS) =====
// GET all redes data
app.get('/api/redes', async (req, res) => {
  const now = Date.now();

  // 1. Servir desde caché en memoria si está fresca
  if (redesMemoryCache && (now - lastRedesCacheTime < CACHE_TTL_MS) && !req.query.force) {
    return res.json(redesMemoryCache);
  }

  try {
    if (redesRef) {
      console.log('📡 Consultando Firestore (Colección redes_sociales)...');
      const snapshot = await redesRef.get();
      const results = [];
      snapshot.forEach(doc => {
        results.push(doc.data());
      });

      if (results.length > 0) {
        redesMemoryCache = results;
        lastRedesCacheTime = now;
        saveLocalRedesData(results);
        return res.json(results);
      }
    }

    const localData = getLocalRedesData();
    redesMemoryCache = localData;
    lastRedesCacheTime = now;
    return res.json(localData);

  } catch (err) {
    console.error('⚠️ Error al consultar Firestore redes_sociales:', err.message);
    if (redesMemoryCache && redesMemoryCache.length > 0) {
      return res.json(redesMemoryCache);
    }
    const fallbackLocal = getLocalRedesData();
    return res.json(fallbackLocal);
  }
});

// POST save/update redes data (aislado en colección 'redes_sociales' y archivo 'data-redes.json')
app.post('/api/redes', async (req, res) => {
  try {
    const records = Array.isArray(req.body) ? req.body : [req.body];
    if (records.length === 0) {
      return res.status(400).json({ success: false, message: 'No se enviaron datos de redes' });
    }

    // 1. Guardar en Firestore en la colección exclusiva 'redes_sociales'
    if (redesRef) {
      for (const newRecord of records) {
        if (!newRecord.empresa || !newRecord.periodo) continue;
        const docId = `${newRecord.empresa}_${newRecord.periodo}`.replace(/\s+/g, '_');
        await redesRef.doc(docId).set(newRecord, { merge: true });
      }
    }

    // 2. Actualizar caché en memoria de redes
    if (!redesMemoryCache) redesMemoryCache = getLocalRedesData();
    for (const newRecord of records) {
      if (!newRecord.empresa || !newRecord.periodo) continue;
      const idx = redesMemoryCache.findIndex(r => r.empresa === newRecord.empresa && r.periodo === newRecord.periodo);
      if (idx >= 0) {
        redesMemoryCache[idx] = { ...redesMemoryCache[idx], ...newRecord };
      } else {
        redesMemoryCache.push(newRecord);
      }
    }
    lastRedesCacheTime = Date.now();

    // 3. Respaldo local en archivo exclusivo data-redes.json
    const localData = getLocalRedesData();
    for (const newRecord of records) {
      if (!newRecord.empresa || !newRecord.periodo) continue;
      const idx = localData.findIndex(r => r.empresa === newRecord.empresa && r.periodo === newRecord.periodo);
      if (idx >= 0) {
        localData[idx] = { ...localData[idx], ...newRecord };
      } else {
        localData.push(newRecord);
      }
    }
    saveLocalRedesData(localData);

    return res.json({ success: true, message: 'Estadísticas de redes guardadas en base de datos independiente' });
  } catch (err) {
    console.error('Error saving redes data:', err);
    res.status(500).json({ success: false, message: 'Error al guardar datos de redes: ' + err.message });
  }
});

// Serve app for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Digital Insights corriendo en http://localhost:${PORT}`);
  if (serviceAccount && serviceAccount.project_id) {
    console.log(`📡 Conectado a Firebase Firestore (Proyecto: ${serviceAccount.project_id})\n`);
  } else {
    console.log(`📁 Modo local activo: datos guardados en data-local.json\n`);
  }
});

