const crypto = require('crypto');
const { db } = require('./db');
const { sha256hex } = require('./store');

const RARE_RARITIES = new Set(['Classified', 'Covert', 'Extraordinary']);

function hmacSha256Hex(key, message) {
  return crypto.createHmac('sha256', key).update(message).digest('hex');
}

function rollToInt(hex, maxExclusive) {
  if (maxExclusive <= 0) return 0;
  const bi = BigInt('0x' + hex);
  return Number(bi % BigInt(maxExclusive));
}

function selectWeighted(rows, roll) {
  let acc = 0;
  for (const r of rows) {
    acc += r.weight;
    if (roll < acc) return r;
  }
  return rows[rows.length - 1];
}

function applyBrokenCaseWeights(rows, payload) {
  const mult = Number(payload?.rare_weight_mult || 1);
  if (!Number.isFinite(mult) || mult <= 1) return rows;
  return rows.map(r => {
    const isRare = RARE_RARITIES.has(r.rarity);
    return { ...r, weight: isRare ? Math.max(1, Math.round(r.weight * mult)) : r.weight };
  });
}

function verifyOpen(openId) {
  const o = db.prepare(`
    SELECT o.*, c.slug as case_slug, c.name as case_name
    FROM opens o
    JOIN cases c ON c.id = o.case_id
    WHERE o.id=?
  `).get(openId);

  if (!o) return { ok: false, error: 'not_found' };

  let modifiers;
  try { modifiers = JSON.parse(o.modifiers_json || '{}'); } catch { modifiers = {}; }

  const rows0 = db.prepare(`
    SELECT ci.weight, i.id as item_id, i.name, i.rarity
    FROM case_items ci
    JOIN items i ON i.id = ci.item_id
    WHERE ci.case_id=?
  `).all(o.case_id).map(r => ({ weight: r.weight, item_id: r.item_id, name: r.name, rarity: r.rarity }));

  let rows = rows0;
  const broken = modifiers?.modifiers?.broken;
  if (broken) rows = applyBrokenCaseWeights(rows0, broken);

  const totalWeight = rows.reduce((a, r) => a + (r.weight || 0), 0);

  const modifiersHash = modifiers?.modifiersHash || sha256hex(JSON.stringify(modifiers));
  const msg = `${o.client_seed}:${o.nonce}:${o.case_id}:${modifiersHash}`;
  const randHex = hmacSha256Hex(o.server_seed, msg);
  const roll = rollToInt(randHex, totalWeight);
  const selected = selectWeighted(rows, roll);

  const matches = Number(selected.item_id) === Number(o.item_id) && Number(roll) === Number(o.rng_roll);

  return {
    ok: true,
    open_id: o.id,
    case: { slug: o.case_slug, name: o.case_name },
    expected_item: selected,
    stored_item_id: o.item_id,
    computed_roll: roll,
    stored_roll: o.rng_roll,
    computed_hmac: randHex,
    matches,
  };
}

module.exports = { verifyOpen };
