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

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ Firebase Admin Initialized');
} else {
  console.error('❌ ERROR: No se encontró configuración de Firebase. Asegúrate de tener firebase-key.json o configurar FIREBASE_CONFIG.');
}

const db = admin.firestore();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Reference to Firestore collection
const reportsRef = db.collection('reports');

// GET all data from Firestore
app.get('/api/data', async (req, res) => {
  try {
    const snapshot = await reportsRef.get();
    const results = [];
    snapshot.forEach(doc => {
      results.push(doc.data());
    });
    res.json(results);
  } catch (err) {
    console.error('Error fetching from Firestore:', err);
    res.json([]);
  }
});

// POST save/update a record in Firestore
app.post('/api/data', async (req, res) => {
  try {
    const newRecord = req.body;
    
    if (!newRecord.empresa || !newRecord.periodo) {
      return res.status(400).json({ success: false, message: 'Faltan campos obligatorios (empresa o periodo)' });
    }

    // Unique ID for the document: Empresa + Period (e.g. "Google_2024-03")
    const docId = `${newRecord.empresa}_${newRecord.periodo}`.replace(/\s+/g, '_');
    
    // Set data (merge: true handles updates)
    await reportsRef.doc(docId).set(newRecord, { merge: true });
    
    res.json({ success: true, message: 'Datos guardados en la nube correctamente' });
  } catch (err) {
    console.error('Error saving to Firestore:', err);
    res.status(500).json({ success: false, message: 'Error al guardar datos en Firebase' });
  }
});

// Serve app for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Digital Insights corriendo en http://localhost:${PORT}`);
  console.log(`📡 Conectado a Firebase Firestore (Proyecto: ${serviceAccount.project_id})\n`);
});

