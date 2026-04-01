const express = require('express');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');

const app = express();
const PORT = process.env.PORT || 3000;
const CSV_PATH = path.join(__dirname, 'digital-insights-data.csv');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CSV columns definition
const CSV_HEADERS = [
  { id: 'empresa', title: 'empresa' },
  { id: 'periodo', title: 'periodo' },
  // Web SEO
  { id: 'web_impresiones_organicas', title: 'web_impresiones_organicas' },
  { id: 'web_impresiones_ads', title: 'web_impresiones_ads' },
  { id: 'web_visitas_organicas', title: 'web_visitas_organicas' },
  { id: 'web_visitas_ads', title: 'web_visitas_ads' },
  { id: 'web_visitas', title: 'web_visitas' },
  { id: 'web_formularios', title: 'web_formularios' },
  { id: 'web_posicion_google', title: 'web_posicion_google' },
  { id: 'web_paginas_top', title: 'web_paginas_top' },
  { id: 'web_utm_ig', title: 'web_utm_ig' },
  { id: 'web_utm_fb', title: 'web_utm_fb' },
  { id: 'web_utm_tt', title: 'web_utm_tt' },
  { id: 'web_utm_yt', title: 'web_utm_yt' },
  { id: 'web_utm_li', title: 'web_utm_li' },
  // Social Impresiones
  { id: 'ig_impresiones_organicas', title: 'ig_impresiones_organicas' },
  { id: 'ig_impresiones_ads', title: 'ig_impresiones_ads' },
  { id: 'fb_impresiones_organicas', title: 'fb_impresiones_organicas' },
  { id: 'fb_impresiones_ads', title: 'fb_impresiones_ads' },
  { id: 'tt_impresiones_organicas', title: 'tt_impresiones_organicas' },
  { id: 'tt_impresiones_ads', title: 'tt_impresiones_ads' },
  { id: 'yt_impresiones_organicas', title: 'yt_impresiones_organicas' },
  { id: 'yt_impresiones_ads', title: 'yt_impresiones_ads' },
  { id: 'li_impresiones_organicas', title: 'li_impresiones_organicas' },
  { id: 'li_impresiones_ads', title: 'li_impresiones_ads' },
  // Instagram
  { id: 'ig_likes', title: 'ig_likes' },
  { id: 'ig_comentarios', title: 'ig_comentarios' },
  { id: 'ig_compartidos', title: 'ig_compartidos' },
  { id: 'ig_guardados', title: 'ig_guardados' },
  { id: 'ig_seguidores', title: 'ig_seguidores' },
  // Facebook
  { id: 'fb_likes', title: 'fb_likes' },
  { id: 'fb_comentarios', title: 'fb_comentarios' },
  { id: 'fb_compartidos', title: 'fb_compartidos' },
  { id: 'fb_guardados', title: 'fb_guardados' },
  { id: 'fb_seguidores', title: 'fb_seguidores' },
  // TikTok
  { id: 'tt_likes', title: 'tt_likes' },
  { id: 'tt_comentarios', title: 'tt_comentarios' },
  { id: 'tt_compartidos', title: 'tt_compartidos' },
  { id: 'tt_guardados', title: 'tt_guardados' },
  { id: 'tt_seguidores', title: 'tt_seguidores' },
  // YouTube
  { id: 'yt_likes', title: 'yt_likes' },
  { id: 'yt_comentarios', title: 'yt_comentarios' },
  { id: 'yt_compartidos', title: 'yt_compartidos' },
  { id: 'yt_vistas_video', title: 'yt_vistas_video' },
  { id: 'yt_seguidores', title: 'yt_seguidores' },
  // LinkedIn
  { id: 'li_likes', title: 'li_likes' },
  { id: 'li_comentarios', title: 'li_comentarios' },
  { id: 'li_compartidos', title: 'li_compartidos' },
  { id: 'li_seguidores', title: 'li_seguidores' },
  // Conversiones
  { id: 'conversiones_totales', title: 'conversiones_totales' },
  { id: 'ventas_totales', title: 'ventas_totales' },
  { id: 'ticket_promedio', title: 'ticket_promedio' },
  { id: 'cotizaciones', title: 'cotizaciones' },
  { id: 'conv_whatsapp', title: 'conv_whatsapp' },
  { id: 'conv_llamadas', title: 'conv_llamadas' },
  { id: 'conv_correos', title: 'conv_correos' },
  { id: 'conv_cotizaciones', title: 'conv_cotizaciones' },
  { id: 'conv_suma_contactos', title: 'conv_suma_contactos' },
  // Campañas / Gastos
  { id: 'gasto_tiktok_ads', title: 'gasto_tiktok_ads' },
  { id: 'gasto_google_ads', title: 'gasto_google_ads' },
  { id: 'gasto_meta_ads', title: 'gasto_meta_ads' },
  { id: 'gasto_mailchimp', title: 'gasto_mailchimp' },
  // Retargeting
  { id: 'retargeting_correos', title: 'retargeting_correos' },
  { id: 'retargeting_apertura', title: 'retargeting_apertura' },
];

// Initialize CSV if it doesn't exist
if (!fs.existsSync(CSV_PATH)) {
  const writer = createObjectCsvWriter({ path: CSV_PATH, header: CSV_HEADERS });
  writer.writeRecords([]).then(() => console.log('✅ CSV initialized'));
}

// GET all data
app.get('/api/data', (req, res) => {
  const results = [];
  if (!fs.existsSync(CSV_PATH)) return res.json([]);
  fs.createReadStream(CSV_PATH)
    .pipe(csv())
    .on('data', (row) => { if (row.empresa) results.push(row); })
    .on('end', () => res.json(results))
    .on('error', () => res.json([]));
});

// POST save/update a record
app.post('/api/data', async (req, res) => {
  try {
    const newRecord = req.body;
    const key = `${newRecord.empresa}_${newRecord.periodo}`;
    let records = [];

    if (fs.existsSync(CSV_PATH)) {
      await new Promise((resolve) => {
        fs.createReadStream(CSV_PATH)
          .pipe(csv())
          .on('data', (row) => records.push(row))
          .on('end', resolve)
          .on('error', resolve);
      });
    }

    const idx = records.findIndex(r => `${r.empresa}_${r.periodo}` === key);
    if (idx >= 0) {
      records[idx] = { ...records[idx], ...newRecord };
    } else {
      records.push(newRecord);
    }

    const writer = createObjectCsvWriter({ path: CSV_PATH, header: CSV_HEADERS });
    await writer.writeRecords(records);
    res.json({ success: true, message: 'Datos guardados correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error al guardar datos' });
  }
});

// Serve app for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Digital Insights corriendo en http://localhost:${PORT}\n`);
});
