const { db } = require('../lib/db');

function columnExists(table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some(c => c.name === column);
}

function addColumnIfMissing(table, column, typeSql) {
  if (columnExists(table, column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeSql}`);
}

function run() {
  // Base schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      steam_id TEXT UNIQUE NOT NULL,
      display_name TEXT,
      avatar TEXT,
      created_at TEXT NOT NULL,
      last_login_at TEXT,
      gems_cents INTEGER NOT NULL DEFAULT 0,
      streak_day INTEGER NOT NULL DEFAULT 0,
      last_streak_claim TEXT,
      total_opens INTEGER NOT NULL DEFAULT 0,
      is_admin INTEGER NOT NULL DEFAULT 0,
      server_seed TEXT,
      server_seed_hash TEXT,
      nonce INTEGER NOT NULL DEFAULT 0,
      daily_open_earned_cents INTEGER NOT NULL DEFAULT 0,
      daily_open_earned_date TEXT
    );

    CREATE TABLE IF NOT EXISTS cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      image_url TEXT,
      case_price_cents INTEGER NOT NULL,
      key_price_cents INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      rarity TEXT NOT NULL,
      image_url TEXT,
      price_cents INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS case_items (
      case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      weight INTEGER NOT NULL,
      PRIMARY KEY (case_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS opens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      spent_cents INTEGER NOT NULL,
      earned_cents INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      server_seed_hash TEXT,
      server_seed TEXT,
      client_seed TEXT,
      nonce INTEGER,
      rng_roll INTEGER,
      modifiers_json TEXT
    );

    CREATE TABLE IF NOT EXISTS mastery (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      xp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, case_id)
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      open_id INTEGER REFERENCES opens(id) ON DELETE SET NULL,
      obtained_at TEXT NOT NULL,
      is_sold INTEGER NOT NULL DEFAULT 0,
      sold_at TEXT,
      sold_for_cents INTEGER
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS giveaways (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      tier_required INTEGER NOT NULL DEFAULT 0,
      prize_text TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS giveaway_entries (
      giveaway_id INTEGER NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entries INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      PRIMARY KEY (giveaway_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS global_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      meta_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_opens_user ON opens(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory(user_id, obtained_at);
  `);

  // ---- Migrations / extensions (safe to run on every boot)
  // Live Steam market integration
  addColumnIfMissing('cases', 'market_hash_name', 'TEXT');
  addColumnIfMissing('items', 'market_hash_name_base', 'TEXT');

  // Optional wear metadata (helps pick valid Factory New / Minimal Wear / etc.)
  addColumnIfMissing('items', 'min_float', 'REAL');
  addColumnIfMissing('items', 'max_float', 'REAL');

  // Inventory snapshots (wear + value + image)
  addColumnIfMissing('inventory', 'wear_tier', 'TEXT');
  addColumnIfMissing('inventory', 'wear_float', 'REAL');
  addColumnIfMissing('inventory', 'market_hash_name', 'TEXT');
  addColumnIfMissing('inventory', 'image_url', 'TEXT');
  addColumnIfMissing('inventory', 'value_cents', 'INTEGER');

  // Bonus faucet
  addColumnIfMissing('users', 'last_bonus_claim_at', 'TEXT');

  // Market cache
  db.exec(`
    CREATE TABLE IF NOT EXISTS market_cache (
      market_hash_name TEXT NOT NULL,
      currency INTEGER NOT NULL,
      price_cents INTEGER,
      lowest_price TEXT,
      median_price TEXT,
      volume INTEGER,
      icon_url TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (market_hash_name, currency)
    );
    CREATE INDEX IF NOT EXISTS idx_market_cache_updated ON market_cache(updated_at);
  `);

  // Default global state
  const upsert = db.prepare(
    `INSERT INTO global_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`
  );
  const get = db.prepare(`SELECT value FROM global_state WHERE key=?`);
  if (!get.get('pool_progress_cents')) upsert.run('pool_progress_cents', '0');
  if (!get.get('pool_tier')) upsert.run('pool_tier', '0');
  if (!get.get('last_broken_hour')) upsert.run('last_broken_hour', '');
  if (!get.get('last_boost_date')) upsert.run('last_boost_date', '');

  console.log('DB initialized.');

  // One-click setup: if there are no cases yet, seed a catalog.
  const n = db.prepare('SELECT COUNT(*) as n FROM cases').get().n;
  if (n === 0) {
    console.log('No cases found — running seed...');
    require('./seed');
  }
}

run();
