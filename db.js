const path = require('path');
const usePostgres = !!process.env.DATABASE_URL;

let sqlite3, db, dbPath;
let pgPool;

if (usePostgres) {
  const { Pool } = require('pg');
  pgPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false });
} else {
  sqlite3 = require('sqlite3').verbose();
  dbPath = path.join(__dirname, 'data.db');
}

function runSqlite(dbInstance, sql, params = []) {
  return new Promise((resolve, reject) => {
    dbInstance.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function allSqlite(dbInstance, sql, params = []) {
  return new Promise((resolve, reject) => {
    dbInstance.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

module.exports = {
  init: async () => {
    if (usePostgres) {
      // initialize tables in Postgres
      await pgPool.query(`CREATE TABLE IF NOT EXISTS districts (id SERIAL PRIMARY KEY, state TEXT, district TEXT, UNIQUE(state,district))`);
      await pgPool.query(`CREATE TABLE IF NOT EXISTS measurements (id SERIAL PRIMARY KEY, state TEXT, district TEXT, month TEXT, jobs_generated BIGINT, person_days BIGINT, wages_paid DOUBLE PRECISION, UNIQUE(state,district,month))`);
    } else {
      db = new sqlite3.Database(dbPath);
      await runSqlite(db, `CREATE TABLE IF NOT EXISTS districts (id INTEGER PRIMARY KEY AUTOINCREMENT, state TEXT, district TEXT UNIQUE)`);
      await runSqlite(db, `CREATE TABLE IF NOT EXISTS measurements (id INTEGER PRIMARY KEY AUTOINCREMENT, state TEXT, district TEXT, month TEXT, jobs_generated INTEGER, person_days INTEGER, wages_paid REAL, UNIQUE(state,district,month))`);
    }
  },
  insertDistrict: async (state, district) => {
    if (usePostgres) {
      return pgPool.query(`INSERT INTO districts(state,district) VALUES($1,$2) ON CONFLICT (state,district) DO NOTHING`, [state, district]);
    }
    return runSqlite(db, `INSERT OR IGNORE INTO districts(state,district) VALUES(?,?)`, [state, district]);
  },
  // Return an array of { id, district } for the given state (defaults to 'Uttar Pradesh')
  listDistricts: async (state = 'Uttar Pradesh') => {
    if (usePostgres) {
      const res = await pgPool.query(`SELECT id, district FROM districts WHERE state=$1 ORDER BY district`, [state]);
      return res.rows.map(r => ({ id: r.id, district: r.district }));
    }
    const rows = await allSqlite(db, `SELECT id, district FROM districts WHERE state=? ORDER BY district`, [state]);
    return rows.map(r => ({ id: r.id, district: r.district }));
  },
  // Return an array of district names (strings) for matching/mapping
  listDistrictNames: async (state = 'Uttar Pradesh') => {
    if (usePostgres) {
      const res = await pgPool.query(`SELECT district FROM districts WHERE state=$1 ORDER BY district`, [state]);
      return res.rows.map(r => r.district);
    }
    const rows = await allSqlite(db, `SELECT district FROM districts WHERE state=? ORDER BY district`, [state]);
    return rows.map(r => r.district);
  },
  getDistrictById: async (id) => {
    if (usePostgres) {
      const res = await pgPool.query(`SELECT id, state, district FROM districts WHERE id=$1`, [id]);
      return res.rows && res.rows.length ? res.rows[0] : null;
    }
    const rows = await allSqlite(db, `SELECT id, state, district FROM districts WHERE id=?`, [id]);
    return rows && rows.length ? rows[0] : null;
  },
  insertMeasurement: async (state, district, month, jobs_generated, person_days, wages_paid) => {
    if (usePostgres) {
      return pgPool.query(`INSERT INTO measurements(state,district,month,jobs_generated,person_days,wages_paid) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (state,district,month) DO UPDATE SET jobs_generated = EXCLUDED.jobs_generated, person_days = EXCLUDED.person_days, wages_paid = EXCLUDED.wages_paid`, [state, district, month, jobs_generated, person_days, wages_paid]);
    }
    return runSqlite(db, `INSERT OR REPLACE INTO measurements(state,district,month,jobs_generated,person_days,wages_paid) VALUES(?,?,?,?,?,?)`, [state, district, month, jobs_generated, person_days, wages_paid]);
  },
  getDataForDistrict: async (state, district) => {
    // Return ordered by month (assuming YYYY-MM format)
    if (usePostgres) {
      const res = await pgPool.query(`SELECT month, jobs_generated, person_days, wages_paid FROM measurements WHERE state=$1 AND district=$2 ORDER BY month`, [state, district]);
      return res.rows;
    }
    return allSqlite(db, `SELECT month, jobs_generated, person_days, wages_paid FROM measurements WHERE state=? AND district=? ORDER BY month`, [state, district]);
  },
  // Get data by district id (joins to find district name)
  getDataForDistrictId: async (districtId) => {
    if (usePostgres) {
      const d = await pgPool.query(`SELECT district, state FROM districts WHERE id=$1`, [districtId]);
      if (!d.rows || d.rows.length === 0) return [];
      const state = d.rows[0].state; const district = d.rows[0].district;
      const res = await pgPool.query(`SELECT month, jobs_generated, person_days, wages_paid FROM measurements WHERE state=$1 AND district=$2 ORDER BY month`, [state, district]);
      return res.rows;
    }
    const d = await allSqlite(db, `SELECT district, state FROM districts WHERE id=?`, [districtId]);
    if (!d || d.length === 0) return [];
    const state = d[0].state; const district = d[0].district;
    return allSqlite(db, `SELECT month, jobs_generated, person_days, wages_paid FROM measurements WHERE state=? AND district=? ORDER BY month`, [state, district]);
  }
};
