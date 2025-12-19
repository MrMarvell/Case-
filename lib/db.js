const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Persist the SQLite DB in ./data by default.
// If your host provides a persistent disk, set DATA_DIR to that mounted path.
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const dbPath = path.join(DATA_DIR, 'casebros.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function nowIso() {
  return new Date().toISOString();
}

module.exports = { db, nowIso, dbPath };
