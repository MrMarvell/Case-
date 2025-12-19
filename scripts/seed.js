/*
  Seed database with REAL CS2 cases + items (images + rarities)

  Data source:
  - ByMykel CSGO-API (crates.json + skins.json)
    https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/crates.json

  Notes:
  - We do NOT bake prices into the seed. Prices are pulled from Steam Community Market on demand
    and cached in the market_cache table (see lib/market.js).
  - This keeps prices always current and avoids shipping huge static price tables.
*/

const { db } = require('../lib/db');
const { getCrates, getSkins } = require('../lib/csgoApi');

const KEY_PRICE_CENTS = 249; // Steam key is $2.49 USD (before tax). Simulation uses cents.

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeRarity(rarity) {
  const n = String(rarity?.name || '').toLowerCase();
  if (n.includes('mil-spec')) return 'Mil-Spec';
  if (n.includes('restricted')) return 'Restricted';
  if (n.includes('classified')) return 'Classified';
  if (n.includes('covert')) return 'Covert';
  if (n.includes('extraordinary') || n.includes('rare special')) return 'Extraordinary';
  if (n.includes('industrial')) return 'Industrial';
  if (n.includes('consumer')) return 'Consumer';
  return rarity?.name || 'Unknown';
}

// Standard CS case odds (approx, but widely used)
// Mil-Spec 79.92%, Restricted 15.98%, Classified 3.2%, Covert 0.64%, Rare Special 0.26%
const ODDS = {
  'Mil-Spec': 0.7992,
  'Restricted': 0.1598,
  'Classified': 0.032,
  'Covert': 0.0064,
  'Extraordinary': 0.0026
};

function buildWeightsByRarity(items) {
  const byRarity = new Map();
  for (const it of items) {
    const r = it._rarity;
    if (!byRarity.has(r)) byRarity.set(r, []);
    byRarity.get(r).push(it);
  }

  const SCALE = 1_000_000; // integer weights
  const weights = new Map();

  // Determine which odds to apply for this crate
  const raritiesPresent = [...byRarity.keys()];
  const oddsPresent = raritiesPresent
    .map((r) => ({ r, p: ODDS[r] }))
    .filter((x) => Number.isFinite(x.p) && x.p > 0);

  const totalOdds = oddsPresent.reduce((s, x) => s + x.p, 0);

  for (const { r, p } of oddsPresent) {
    const list = byRarity.get(r) || [];
    if (!list.length) continue;
    const tierP = p / totalOdds;
    const perItem = Math.max(1, Math.floor((tierP / list.length) * SCALE));
    for (const it of list) weights.set(it.id, perItem);
  }

  // Any unknown rarity gets a tiny weight so it can still drop (rare)
  for (const r of raritiesPresent) {
    if (ODDS[r]) continue;
    const list = byRarity.get(r) || [];
    for (const it of list) weights.set(it.id, 1);
  }

  return weights;
}

async function seed() {
  // If DB already has cases, do nothing
  const existing = db.prepare('SELECT COUNT(1) AS n FROM cases').get();
  if (existing?.n > 0) {
    console.log('✅ Seed skipped (cases already exist).');
    return;
  }

  console.log('🌱 Seeding CS2 cases/items from ByMykel CSGO-API...');

  let crates = [];
  try {
    crates = await getCrates();
  } catch (e) {
    console.error('❌ Failed to fetch crates.json. Seed aborted.', e?.message || e);
    throw e;
  }

  // Optional wear metadata: map name -> {min_float,max_float}
  const wearMeta = new Map();
  try {
    const skins = await getSkins();
    for (const s of skins || []) {
      if (!s?.name) continue;
      if (Number.isFinite(s.min_float) && Number.isFinite(s.max_float)) {
        wearMeta.set(String(s.name).trim(), { min: s.min_float, max: s.max_float });
      }
    }
  } catch (e) {
    console.warn('⚠️  Could not fetch skins.json for float ranges. Continuing without wear ranges.');
  }

  // Keep only actual weapon cases
  const cases = (crates || []).filter((c) => {
    const type = String(c?.type || '').toLowerCase();
    return type === 'case' || type.includes('weapon case') || type.endsWith('case');
  });

  if (!cases.length) {
    throw new Error('No cases found in crates.json (filter too strict?)');
  }

  const insertCase = db.prepare(`
    INSERT INTO cases (slug, name, image_url, case_price_cents, key_price_cents, active, market_hash_name)
    VALUES (@slug, @name, @image_url, @case_price_cents, @key_price_cents, 1, @market_hash_name)
    ON CONFLICT(slug) DO UPDATE SET
      name=excluded.name,
      image_url=excluded.image_url,
      key_price_cents=excluded.key_price_cents,
      active=1,
      market_hash_name=COALESCE(excluded.market_hash_name, cases.market_hash_name)
  `);

  const insertItem = db.prepare(`
    INSERT INTO items (name, rarity, image_url, price_cents, market_hash_name_base, min_float, max_float)
    VALUES (@name, @rarity, @image_url, @price_cents, @market_hash_name_base, @min_float, @max_float)
    ON CONFLICT(name, rarity) DO UPDATE SET
      image_url=COALESCE(excluded.image_url, items.image_url),
      market_hash_name_base=COALESCE(excluded.market_hash_name_base, items.market_hash_name_base),
      min_float=COALESCE(excluded.min_float, items.min_float),
      max_float=COALESCE(excluded.max_float, items.max_float)
  `);

  const getCaseId = db.prepare('SELECT id FROM cases WHERE slug=?').get;
  const getItemId = db.prepare('SELECT id FROM items WHERE name=? AND rarity=?').get;

  const clearCaseItems = db.prepare('DELETE FROM case_items WHERE case_id=?');
  const insertCaseItem = db.prepare(`
    INSERT INTO case_items (case_id, item_id, weight)
    VALUES (?, ?, ?)
    ON CONFLICT(case_id, item_id) DO UPDATE SET weight=excluded.weight
  `);

  const tx = db.transaction((caseRows) => {
    for (const c of caseRows) {
      const slug = slugify(c.name) || slugify(c.id) || c.id;
      const marketHashName = c.market_hash_name || c.name;

      insertCase.run({
        slug,
        name: c.name,
        image_url: c.image,
        case_price_cents: 0,
        key_price_cents: KEY_PRICE_CENTS,
        market_hash_name: marketHashName
      });

      const caseId = getCaseId(slug).id;
      clearCaseItems.run(caseId);

      // Build unified item list (regular + rare)
      const allItems = [];
      for (const it of c.contains || []) allItems.push({ ...it, __pool: 'regular' });
      for (const it of c.contains_rare || []) allItems.push({ ...it, __pool: 'rare' });

      // Upsert items and collect IDs
      for (const it of allItems) {
        const rarity = normalizeRarity(it.rarity);
        const meta = wearMeta.get(String(it.name).trim());

        insertItem.run({
          name: it.name,
          rarity,
          image_url: it.image,
          price_cents: 0,
          market_hash_name_base: it.market_hash_name_base || it.name,
          min_float: meta?.min ?? null,
          max_float: meta?.max ?? null
        });
      }

      // Re-resolve item ids + compute weights per rarity for THIS case
      const resolved = [];
      for (const it of allItems) {
        const rarity = normalizeRarity(it.rarity);
        const row = getItemId(it.name, rarity);
        if (!row?.id) continue;
        resolved.push({ id: row.id, _rarity: rarity });
      }

      const weights = buildWeightsByRarity(resolved);
      for (const r of resolved) {
        insertCaseItem.run(caseId, r.id, weights.get(r.id) || 1);
      }
    }
  });

  tx(cases);

  console.log(`✅ Seed complete: ${cases.length} cases imported.`);
}

module.exports = seed;

// Allow running manually: node scripts/seed.js
if (require.main === module) {
  seed().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
