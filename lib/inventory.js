const { db, nowIso } = require('./db');
const { formatGems } = require('./economy');

const SELL_RATE = 0.60; // 60% of obtained value (simulation)

function listInventory(userId) {
  return db.prepare(`
    SELECT inv.id as inventory_id, inv.obtained_at, inv.is_sold, inv.sold_at, inv.sold_for_cents,
           inv.wear_tier, inv.wear_float, inv.market_hash_name, inv.image_url as inv_image_url, inv.value_cents as inv_value_cents,
           i.id as item_id, i.name, i.rarity, i.image_url as item_image_url, i.price_cents as item_price_cents
    FROM inventory inv
    JOIN items i ON i.id = inv.item_id
    WHERE inv.user_id=?
    ORDER BY inv.id DESC
  `).all(userId).map(r => {
    const valueCents = (r.inv_value_cents != null) ? r.inv_value_cents : r.item_price_cents;
    const imageUrl = r.inv_image_url || r.item_image_url || null;
    const displayName = r.market_hash_name || r.name;

    return {
      inventory_id: r.inventory_id,
      obtained_at: r.obtained_at,
      is_sold: !!r.is_sold,
      sold_at: r.sold_at,
      sold_for_gems: r.sold_for_cents != null ? formatGems(r.sold_for_cents) : null,
      item: {
        id: r.item_id,
        name: displayName,
        base_name: r.name,
        rarity: r.rarity,
        image_url: imageUrl,
        wear_tier: r.wear_tier || null,
        wear_float: (r.wear_float != null) ? Number(r.wear_float).toFixed(4) : null,
        market_hash_name: r.market_hash_name || null,
        price_gems: formatGems(valueCents),
      },
    };
  });
}

function sellItem(userId, inventoryId) {
  const inv = db.prepare(`
    SELECT inv.*, i.price_cents as fallback_price_cents, i.name as base_name
    FROM inventory inv
    JOIN items i ON i.id = inv.item_id
    WHERE inv.id=? AND inv.user_id=?
  `).get(inventoryId, userId);
  if (!inv) throw new Error('not_found');
  if (inv.is_sold) throw new Error('already_sold');

  const valueCents = (inv.value_cents != null) ? inv.value_cents : inv.fallback_price_cents;
  const sellFor = Math.floor(valueCents * SELL_RATE);

  const u = db.prepare('SELECT * FROM users WHERE id=?').get(userId);
  const newBalance = (u.gems_cents || 0) + sellFor;

  db.prepare('UPDATE users SET gems_cents=? WHERE id=?').run(newBalance, userId);
  db.prepare('UPDATE inventory SET is_sold=1, sold_at=?, sold_for_cents=? WHERE id=?').run(nowIso(), sellFor, inventoryId);

  db.prepare('INSERT INTO ledger(user_id,type,amount_cents,meta_json,created_at) VALUES(?,?,?,?,?)')
    .run(userId, 'inventory_sell', sellFor, JSON.stringify({ inventoryId, item: inv.market_hash_name || inv.base_name }), nowIso());

  return { sold_for_gems: formatGems(sellFor), balance_gems: formatGems(newBalance) };
}

module.exports = { listInventory, sellItem, SELL_RATE };
