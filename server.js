const express = require('express');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

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
    aliases: ['saul peña', 'saul pena', 'saul'],
    password: 'DASaulS-2026$',
    name: 'Saul Peña',
    role: 'redes_only',
    allowedModules: ['redes']
  }
];

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const cleanUser = (username || '').trim().toLowerCase();
  const found = AUTH_USERS.find(u => 
    (u.username.toLowerCase() === cleanUser || (u.aliases && u.aliases.includes(cleanUser))) &&
    u.password === password
  );

  if (!found) {
    return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
  }

  return res.json({
    success: true,
    user: {
      username: found.username,
      name: found.name,
      role: found.role,
      allowedModules: found.allowedModules
    }
  });
});

// GET all data
app.get('/api/data', async (req, res) => {
  const now = Date.now();

  // 1. Servir desde memoria si el caché está fresco (0 lecturas a Firestore)
  if (memoryCache && (now - lastCacheTime < CACHE_TTL_MS) && !req.query.force) {
    return res.json(memoryCache);
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
        return res.json(results);
      }
    }

    const localData = getLocalData();
    memoryCache = localData;
    lastCacheTime = now;
    return res.json(localData);

  } catch (err) {
    console.error('⚠️ Error al consultar Firestore (posible cuota diaria agotada):', err.message);

    // Fallback de alta disponibilidad: Si Firebase agota su cuota, usamos la memoria o data-local.json
    if (memoryCache && memoryCache.length > 0) {
      console.log('🛡️ Servido desde caché en memoria para proteger la experiencia del usuario.');
      return res.json(memoryCache);
    }

    const fallbackLocal = getLocalData();
    console.log(`🛡️ Servido desde respaldo local data-local.json (${fallbackLocal.length} registros).`);
    return res.json(fallbackLocal);
  }
});

// POST save/update a record (supports single record or array of records)
app.post('/api/data', async (req, res) => {
  try {
    // Control de permisos a nivel servidor
    const userRole = req.headers['x-user-role'];
    if (userRole === 'redes_only') {
      return res.status(403).json({ success: false, message: 'Acceso denegado: Usuario sin permisos para modificar Marketing o Ventas' });
    }

    const records = Array.isArray(req.body) ? req.body : [req.body];
    if (records.length === 0) {
      return res.status(400).json({ success: false, message: 'No se enviaron datos' });
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

