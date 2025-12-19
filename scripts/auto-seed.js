// scripts/auto-seed.js
const { db } = require('../lib/db');

function tableExists(name) {
  try {
    db.prepare(`SELECT 1 FROM ${name} LIMIT 1`).get();
    return true;
  } catch {
    return false;
  }
}

function countRows(name) {
  try {
    return db.prepare(`SELECT COUNT(*) as c FROM ${name}`).get().c;
  } catch {
    return 0;
  }
}

module.exports = function autoSeedIfEmpty() {
  // init-db already runs schema, so we can just check if cases are empty.
  if (!tableExists('cases')) return;

  const casesCount = countRows('cases');
  if (casesCount > 0) return;

  console.log('🌱 DB is empty. Seeding now...');
  require('./seed'); // this runs your existing scripts/seed.js
  console.log('✅ Seed complete.');
};
