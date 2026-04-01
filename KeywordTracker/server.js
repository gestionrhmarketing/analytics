const express = require('express');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');

const app = express();
// Using port 3001 so it can run independently alongside Digital Insights (which uses 3000 by default)
const PORT = process.env.PORT || 3001; 
const KEYWORDS_CSV_PATH = path.join(__dirname, 'keywords-data.csv');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const KEYWORDS_HEADERS = [
  { id: 'empresa', title: 'empresa' },
  { id: 'keyword', title: 'keyword' },
  { id: 'fecha', title: 'fecha' },
  { id: 'posicion', title: 'posicion' }
];

if (!fs.existsSync(KEYWORDS_CSV_PATH)) {
  const writer = createObjectCsvWriter({ path: KEYWORDS_CSV_PATH, header: KEYWORDS_HEADERS });
  writer.writeRecords([]).then(() => console.log('✅ Keywords CSV initialized'));
}

// GET all keywords
app.get('/api/keywords', (req, res) => {
  const results = [];
  if (!fs.existsSync(KEYWORDS_CSV_PATH)) return res.json([]);
  fs.createReadStream(KEYWORDS_CSV_PATH)
    .pipe(csv())
    .on('data', (row) => { if (row.empresa) results.push(row); })
    .on('end', () => res.json(results))
    .on('error', () => res.json([]));
});

// POST save/update a keyword record
app.post('/api/keywords', async (req, res) => {
  try {
    const newRecord = req.body;
    const key = `${newRecord.empresa}_${newRecord.keyword}_${newRecord.fecha}`;
    let records = [];

    if (fs.existsSync(KEYWORDS_CSV_PATH)) {
      await new Promise((resolve) => {
        fs.createReadStream(KEYWORDS_CSV_PATH)
          .pipe(csv())
          .on('data', (row) => records.push(row))
          .on('end', resolve)
          .on('error', resolve);
      });
    }

    const idx = records.findIndex(r => `${r.empresa}_${r.keyword}_${r.fecha}` === key);
    if (idx >= 0) {
      records[idx] = { ...records[idx], ...newRecord };
    } else {
      records.push(newRecord);
    }

    const writer = createObjectCsvWriter({ path: KEYWORDS_CSV_PATH, header: KEYWORDS_HEADERS });
    await writer.writeRecords(records);
    res.json({ success: true, message: 'Keyword guardada correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error al guardar keyword' });
  }
});

// PUT update an existing keyword record
app.put('/api/keywords', async (req, res) => {
  try {
    const { original, updated } = req.body;
    const origKey = `${original.empresa}_${original.keyword}_${original.fecha}`;
    let records = [];

    if (fs.existsSync(KEYWORDS_CSV_PATH)) {
      await new Promise((resolve) => {
        fs.createReadStream(KEYWORDS_CSV_PATH)
          .pipe(csv())
          .on('data', (row) => records.push(row))
          .on('end', resolve)
          .on('error', resolve);
      });
    }

    const idx = records.findIndex(r => `${r.empresa}_${r.keyword}_${r.fecha}` === origKey);
    if (idx >= 0) {
      records[idx] = { ...records[idx], ...updated };
      const writer = createObjectCsvWriter({ path: KEYWORDS_CSV_PATH, header: KEYWORDS_HEADERS });
      await writer.writeRecords(records);
      res.json({ success: true, message: 'Registro actualizado correctamente' });
    } else {
      res.status(404).json({ success: false, message: 'Registro no encontrado' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error al actualizar' });
  }
});

// DELETE a keyword record
app.delete('/api/keywords', async (req, res) => {
  try {
    const { empresa, keyword, fecha } = req.body;
    const key = `${empresa}_${keyword}_${fecha}`;
    let records = [];

    if (fs.existsSync(KEYWORDS_CSV_PATH)) {
      await new Promise((resolve) => {
        fs.createReadStream(KEYWORDS_CSV_PATH)
          .pipe(csv())
          .on('data', (row) => records.push(row))
          .on('end', resolve)
          .on('error', resolve);
      });
    }

    const newRecords = records.filter(r => `${r.empresa}_${r.keyword}_${r.fecha}` !== key);
    
    const writer = createObjectCsvWriter({ path: KEYWORDS_CSV_PATH, header: KEYWORDS_HEADERS });
    await writer.writeRecords(newRecords);
    res.json({ success: true, message: 'Registro eliminado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error al eliminar' });
  }
});



app.listen(PORT, () => {
  console.log(`🚀 Keyword Tracker Server is running on http://localhost:${PORT}`);
});
