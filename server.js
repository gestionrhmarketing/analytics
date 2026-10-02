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
const localDataPath = path.join(__dirname, 'data-local.json');

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
  fs.writeFileSync(localDataPath, JSON.stringify(data, null, 2), 'utf8');
}

if (serviceAccount) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    reportsRef = db.collection('reports');
    console.log('✅ Firebase Admin Initialized');
  } catch (err) {
    console.error('❌ Error initializing Firebase Admin:', err.message);
  }
} else {
  console.warn('⚠️ AVISO: No se encontró configuración de Firebase. Se usará almacenamiento local (data-local.json).');
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// GET all data
app.get('/api/data', async (req, res) => {
  try {
    if (reportsRef) {
      const snapshot = await reportsRef.get();
      const results = [];
      snapshot.forEach(doc => {
        results.push(doc.data());
      });
      return res.json(results);
    } else {
      const localData = getLocalData();
      return res.json(localData);
    }
  } catch (err) {
    console.error('Error fetching data:', err);
    res.json(getLocalData());
  }
});

// POST save/update a record
app.post('/api/data', async (req, res) => {
  try {
    const newRecord = req.body;
    
    if (!newRecord.empresa || !newRecord.periodo) {
      return res.status(400).json({ success: false, message: 'Faltan campos obligatorios (empresa o periodo)' });
    }

    if (reportsRef) {
      // Unique ID for the document: Empresa + Period (e.g. "Google_2024-03")
      const docId = `${newRecord.empresa}_${newRecord.periodo}`.replace(/\s+/g, '_');
      await reportsRef.doc(docId).set(newRecord, { merge: true });
      return res.json({ success: true, message: 'Datos guardados en la nube correctamente' });
    } else {
      // Local fallback
      const localData = getLocalData();
      const idx = localData.findIndex(r => r.empresa === newRecord.empresa && r.periodo === newRecord.periodo);
      if (idx >= 0) {
        localData[idx] = { ...localData[idx], ...newRecord };
      } else {
        localData.push(newRecord);
      }
      saveLocalData(localData);
      return res.json({ success: true, message: 'Datos guardados localmente correctamente' });
    }
  } catch (err) {
    console.error('Error saving data:', err);
    res.status(500).json({ success: false, message: 'Error al guardar datos' });
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

