const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'data.db');
let db;

function run(dbInstance, sql, params=[]) {
  return new Promise((resolve, reject) => {
    dbInstance.run(sql, params, function(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function all(dbInstance, sql, params=[]) {
  return new Promise((resolve, reject) => {
    dbInstance.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

module.exports = {
  init: async () => {
    db = new sqlite3.Database(dbPath);
    await run(db, `CREATE TABLE IF NOT EXISTS districts (id INTEGER PRIMARY KEY AUTOINCREMENT, state TEXT, district TEXT UNIQUE)`);
    await run(db, `CREATE TABLE IF NOT EXISTS measurements (id INTEGER PRIMARY KEY AUTOINCREMENT, state TEXT, district TEXT, month TEXT, jobs_generated INTEGER, person_days INTEGER, wages_paid REAL, UNIQUE(state,district,month))`);
  },
  insertDistrict: async (state, district) => {
    return run(db, `INSERT OR IGNORE INTO districts(state,district) VALUES(?,?)`, [state, district]);
  },
  // Return an array of { id, district } for the given state (defaults to 'Uttar Pradesh')
  listDistricts: async (state = 'Uttar Pradesh') => {
    const rows = await all(db, `SELECT id, district FROM districts WHERE state=? ORDER BY district`, [state]);
    return rows.map(r => ({ id: r.id, district: r.district }));
  },
  // Return an array of district names (strings) for matching/mapping
  listDistrictNames: async (state = 'Uttar Pradesh') => {
    const rows = await all(db, `SELECT district FROM districts WHERE state=? ORDER BY district`, [state]);
    return rows.map(r => r.district);
  },
  getDistrictById: async (id) => {
    const rows = await all(db, `SELECT id, state, district FROM districts WHERE id=?`, [id]);
    return rows && rows.length ? rows[0] : null;
  },
  insertMeasurement: async (state, district, month, jobs_generated, person_days, wages_paid) => {
    return run(db, `INSERT OR REPLACE INTO measurements(state,district,month,jobs_generated,person_days,wages_paid) VALUES(?,?,?,?,?,?)`, [state, district, month, jobs_generated, person_days, wages_paid]);
  },
  getDataForDistrict: async (state, district) => {
    // Return ordered by month (assuming YYYY-MM format)
    return all(db, `SELECT month, jobs_generated, person_days, wages_paid FROM measurements WHERE state=? AND district=? ORDER BY month`, [state, district]);
  },
  // Get data by district id (joins to find district name)
  getDataForDistrictId: async (districtId) => {
    const d = await all(db, `SELECT district, state FROM districts WHERE id=?`, [districtId]);
    if (!d || d.length === 0) return [];
    const state = d[0].state; const district = d[0].district;
    return all(db, `SELECT month, jobs_generated, person_days, wages_paid FROM measurements WHERE state=? AND district=? ORDER BY month`, [state, district]);
  }
};
