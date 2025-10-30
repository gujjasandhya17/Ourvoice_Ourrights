const axios = require('axios');
const db = require('./db');
const cron = require('node-cron');

// NOTE: The actual data.gov.in API endpoints and fields may differ. This module implements a
// conservative fetch + transform flow and stores simplified metrics in sqlite.

const DATA_GOV_BASE = 'https://api.data.gov.in/resource';
// Example resource id for MGNREGA (update if you have a specific resource id). For the assignment
// we will let the environment provide the exact resource id or API key if needed.
const RESOURCE_ID = process.env.MGNREGA_RESOURCE_ID || '';
const API_KEY = process.env.MGNREGA_API_KEY || ''; // optional

async function fetchAndStore(state) {
  console.log('fetchAndStore for state=', state);
  // Example: We'll attempt to call the data.gov.in API for the resource. If no resource id is provided,
  // we simulate a fetch using sample data (so the project is runnable offline).
  if (!RESOURCE_ID) {
    console.log('No RESOURCE_ID configured; seeding demo rows');
    // create some demo rows for a few months and districts
    const demoDistricts = ['Lucknow', 'Varanasi', 'Kanpur Nagar', 'Prayagraj', 'Gorakhpur'];
    const months = ['2024-01','2024-02','2024-03','2024-04','2024-05','2024-06','2024-07','2024-08','2024-09','2024-10'];
    for (const d of demoDistricts) {
      await db.insertDistrict(state, d);
      for (let i=0;i<months.length;i++){
        const base = 1000 + i*100 + Math.floor(Math.random()*200);
        await db.insertMeasurement(state, d, months[i], base, base*10, base*1200);
      }
    }
    return;
  }

  // If RESOURCE_ID is set, try to fetch from data.gov.in
  try {
    // Example API call: GET https://api.data.gov.in/resource/{resource_id}?filters[state]=Uttar%20Pradesh&apikey=xxx&limit=5000
    const url = `${DATA_GOV_BASE}/${RESOURCE_ID}`;
    const params = {
      apikey: API_KEY,
      limit: 5000,
      filters: JSON.stringify({ state: state })
    };
    const resp = await axios.get(url, { params, timeout: 20000 });
    if (!resp.data || !resp.data.records) throw new Error('unexpected response');
    const records = resp.data.records;
    for (const r of records) {
      // Map fields conservatively; the real dataset likely contains month and district
      const district = r.district || r.district_name || r.District || 'Unknown';
      const month = r.month || r.period || r.Month || '2024-01';
      const jobs_generated = parseInt(r.jobs_generated || r.jobs || r.Quantity || 0);
      const person_days = parseInt(r.person_days || r.persondays || 0);
      const wages_paid = parseFloat(r.wages_paid || r.wages || 0);
      await db.insertDistrict(state, district);
      await db.insertMeasurement(state, district, month, jobs_generated, person_days, wages_paid);
    }
  } catch (err) {
    console.error('fetchAndStore error', err.message || err);
    throw err;
  }
}

async function reverseGeocodeToDistrict(lat, lon) {
  // Use Nominatim reverse geocoding (OpenStreetMap) — free, rate-limited. For production use a paid geo service.
  try {
    const url = 'https://nominatim.openstreetmap.org/reverse';
    const resp = await axios.get(url, { params: { lat, lon, format: 'json', addressdetails: 1 } , headers: { 'User-Agent': 'OurVoiceOurRights/1.0 (your-email@example.com)'}});
    const addr = resp.data.address || {};
    // Nominatim often provides "county" or "state_district" fields; district-like information often in county or city.
    let candidate = addr.county || addr.town || addr.city || addr.state_district || addr.village || addr.hamlet || null;
    if (!candidate) return null;
    // Normalize string helper
    const normalize = s => (s || '').toString().toLowerCase().replace(/[^a-z0-9\u0900-\u097F ]+/g, '').replace(/\b(district|zila|jila)\b/g, '').trim();
    const candNorm = normalize(candidate);
    // Try to match against our seeded district names for the state
    const names = await db.listDistrictNames('Uttar Pradesh');
    // first try exact contains or contained
    for (const n of names) {
      const nNorm = normalize(n);
      if (nNorm && (nNorm === candNorm || nNorm.includes(candNorm) || candNorm.includes(nNorm))) {
        return n; // return canonical district name from DB
      }
    }
    // fallback: return the raw candidate (capitalized)
    return candidate;
  } catch (err) {
    console.error('reverseGeocodeToDistrict error', err.message || err);
    throw err;
  }
}

function startScheduledFetch(state) {
  // Run once at startup and then schedule: run daily at 3:30 AM server time
  fetchAndStore(state).catch(e=>console.error('initial fetch failed', e.message || e));
  cron.schedule('30 3 * * *', () => {
    console.log('Scheduled fetch triggered');
    fetchAndStore(state).catch(e=>console.error('scheduled fetch failed', e.message || e));
  });
}

module.exports = { fetchAndStore, startScheduledFetch, reverseGeocodeToDistrict };
