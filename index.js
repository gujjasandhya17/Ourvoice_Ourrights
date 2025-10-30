const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');
const fetcher = require('./fetcher');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple API: list districts for chosen state (we use Uttar Pradesh for the demo)
app.get('/api/districts', async (req, res) => {
  try {
    const state = req.query.state || 'Uttar Pradesh';
    const districts = await db.listDistricts(state);
    // If DB empty, return a compact sample list so UI is usable immediately
    if (!districts || districts.length === 0) {
      // return objects with id (0) so frontend can still function
      return res.json([
        { id: 0, district: "Lucknow" },
        { id: 1, district: "Varanasi" },
        { id: 2, district: "Kanpur Nagar" },
        { id: 3, district: "Prayagraj" },
        { id: 4, district: "Gorakhpur" }
      ]);
    }
    res.json(districts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to load districts' });
  }
});

// Get performance by district id
app.get('/api/performance/:districtId', async (req, res) => {
  const id = req.params.districtId;
  if (!id) return res.status(400).json({ error: 'districtId required' });
  try {
    const rows = await db.getDataForDistrictId(id);
    let summary = null;
    if (rows && rows.length > 0) {
      const last = rows[rows.length - 1];
      const prev = rows.length > 1 ? rows[rows.length - 2] : null;
      const lastJobs = parseInt(last.jobs_generated || 0);
      const prevJobs = prev ? parseInt(prev.jobs_generated || 0) : 0;
      let changePercent = null;
      let trend = 'same';
      if (prev) {
        changePercent = Math.round(((lastJobs - prevJobs) / (prevJobs || 1)) * 100);
        if (changePercent > 0) trend = 'up';
        else if (changePercent < 0) trend = 'down';
      }
      summary = { lastMonth: last.month, lastJobs, prevJobs, changePercent, trend };
    }
    res.json({ rows, summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to get performance' });
  }
});

// GET timeseries data for district
app.get('/api/data', async (req, res) => {
  const state = req.query.state || 'Uttar Pradesh';
  const district = req.query.district;
  if (!district) return res.status(400).json({ error: 'district required' });
  try {
    const rows = await db.getDataForDistrict(state, district);
    // compute a small summary: last month, previous, percent change
    let summary = null;
    if (rows && rows.length > 0) {
      const last = rows[rows.length - 1];
      const prev = rows.length > 1 ? rows[rows.length - 2] : null;
      const lastJobs = parseInt(last.jobs_generated || 0);
      const prevJobs = prev ? parseInt(prev.jobs_generated || 0) : 0;
      let changePercent = null;
      let trend = 'same';
      if (prev) {
        changePercent = Math.round(((lastJobs - prevJobs) / (prevJobs || 1)) * 100);
        if (changePercent > 0) trend = 'up';
        else if (changePercent < 0) trend = 'down';
      }
      summary = { lastMonth: last.month, lastJobs, prevJobs, changePercent, trend };
    }
    res.json({ rows, summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to get data' });
  }
});

// Trigger immediate fetch (dev endpoint)
app.post('/api/fetch-now', async (req, res) => {
  const state = req.body.state || 'Uttar Pradesh';
  try {
    await fetcher.fetchAndStore(state);
    res.json({ status: 'ok' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'fetch failed' });
  }
});

// Dev endpoint: seed districts from CSV on demand (useful without restarting server)
app.post('/api/seed-districts', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const csv = fs.readFileSync(path.join(__dirname, 'data', 'up_districts.csv'), 'utf8');
    const lines = csv.trim().split(/\r?\n/).slice(1);
    for (const line of lines) {
      const district = line.trim();
      if (district) await db.insertDistrict('Uttar Pradesh', district);
    }
    res.json({ status: 'seeded' });
  } catch (err) {
    console.error('seed failed', err);
    res.status(500).json({ error: 'seed failed' });
  }
});

// Reverse geocode lat/lon to district using Nominatim
app.get('/api/detect', async (req, res) => {
  const lat = req.query.lat;
  const lon = req.query.lon;
  if (!lat || !lon) return res.status(400).json({ error: 'lat & lon required' });
  try {
    const district = await fetcher.reverseGeocodeToDistrict(lat, lon);
    res.json({ district });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'reverse geocode failed' });
  }
});

// Serve frontend index.html by default
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  try {
    await db.init();
    console.log('DB initialized');
    // Auto-seed district list from data CSV if table looks empty
    try {
      const names = await db.listDistrictNames('Uttar Pradesh');
      if (!names || names.length < 10) {
        console.log('Seeding districts from data/up_districts.csv');
        const fs = require('fs');
        const path = require('path');
        const csv = fs.readFileSync(path.join(__dirname, 'data', 'up_districts.csv'), 'utf8');
        const lines = csv.trim().split(/\r?\n/).slice(1);
        for (const line of lines) {
          const district = line.trim();
          if (district) await db.insertDistrict('Uttar Pradesh', district);
        }
        console.log('District seeding complete');
      }
    } catch (e) { console.error('Auto-seed failed', e); }
  } catch (err) {
    console.error('DB init failed', err);
  }
  // Start scheduled fetcher inside server process
  fetcher.startScheduledFetch('Uttar Pradesh');
});
