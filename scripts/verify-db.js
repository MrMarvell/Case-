const { db } = require('../lib/db');

const allowedRarities = new Set([
  'Consumer',
  'Industrial',
  'Mil-Spec',
  'Restricted',
  'Classified',
  'Covert',
  'Extraordinary',
]);

function warn(msg) {
  console.warn(`⚠️  ${msg}`);
}

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exitCode = 1;
}

function main() {
  const cases = db.prepare('SELECT id, slug, name, image_url, market_hash_name, active FROM cases').all();
  const items = db.prepare('SELECT id, name, rarity, image_url, market_hash_name_base FROM items').all();

  console.log(`Cases: ${cases.length}`);
  console.log(`Items: ${items.length}`);

  // Basic item checks
  for (const it of items) {
    if (!it.name) fail(`Item missing name (id ${it.id})`);
    if (!it.rarity) fail(`Item missing rarity: ${it.name}`);
    if (!allowedRarities.has(it.rarity)) warn(`Unknown rarity "${it.rarity}" for item: ${it.name}`);
    if (!it.market_hash_name_base) warn(`Missing market_hash_name_base for item: ${it.name}`);
    if (!it.image_url) warn(`Missing image_url for item: ${it.name}`);
  }

  // Case + weights checks
  const getCaseItems = db.prepare(
    `SELECT ci.weight, i.rarity
     FROM case_items ci
     JOIN items i ON i.id = ci.item_id
     WHERE ci.case_id = ?`
  );

  for (const c of cases) {
    if (!c.slug) fail(`Case missing slug (id ${c.id})`);
    if (!c.name) fail(`Case missing name (slug ${c.slug})`);
    if (!c.image_url) warn(`Missing image_url for case: ${c.name}`);
    if (!c.market_hash_name) warn(`Missing market_hash_name for case: ${c.name}`);

    const cis = getCaseItems.all(c.id);
    if (!cis.length) {
      warn(`Case has no items: ${c.name}`);
      continue;
    }

    for (const ci of cis) {
      if (!Number.isFinite(ci.weight) || ci.weight <= 0) {
        warn(`Non-positive weight in case ${c.name} (rarity ${ci.rarity}): ${ci.weight}`);
      }
    }
  }

  console.log('✅ verify-db complete');
  if (process.exitCode === 1) {
    console.log('Some checks failed. Fix the warnings above.');
  }
}

main();
