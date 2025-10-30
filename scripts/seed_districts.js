const fs = require('fs');
const path = require('path');
const db = require('../db');

async function seed() {
  try {
    await db.init();
    const csv = fs.readFileSync(path.join(__dirname, '..', 'data', 'up_districts.csv'), 'utf8');
    const lines = csv.trim().split(/\r?\n/).slice(1);
    for (const line of lines) {
      const district = line.trim();
      if (district) {
        await db.insertDistrict('Uttar Pradesh', district);
        console.log('Inserted', district);
      }
    }
    console.log('Seeding complete');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed', err);
    process.exit(1);
  }
}

seed();
