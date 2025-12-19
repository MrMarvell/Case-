const crypto = require('crypto');
const { db, nowIso } = require('./db');
const config = require('./config');
const { ensureUserSeeds, rotateUserSeed } = require('./store');
const { parseGemsToCents, formatGems, masteryLevelFromXp, masteryGemBonusMult, clamp } = require('./economy');
const { getMarketInfo } = require('./market');
const { randomWear, marketHashWithWear } = require('./wear');
const { addPoolProgress } = require('./pool');

const RARE_RARITIES = new Set(['Classified', 'Covert', 'Extraordinary']);

function hmacInt(serverSeed, message) {
  const h = crypto.createHmac('sha256', serverSeed).update(message).digest('hex');
  // Take first 12 hex bytes (~48 bits)
  return parseInt(h.slice(0, 12), 16);
}

function normalizeWeights(rows, brokenRareMult = 1.0) {
  return rows.map(r => {
    const base = Number(r.weight || 1);
    const w = RARE_RARITIES.has(r.rarity) ? base * brokenRareMult : base;
    return { ...r, effWeight: Math.max(1, Math.floor(w)) };
  });
}

function pickByWeight(rows, roll) {
  const total = rows.reduce((a, r) => a + r.effWeight, 0);
  const target = roll % total;
  let acc = 0;
  for (const r of rows) {
    acc += r.effWeight;
    if (target < acc) return r;
  }
  return rows[rows.length - 1];
}

function getActiveCaseBySlug(slug) {
  return db.prepare('SELECT * FROM cases WHERE slug=? AND active=1').get(slug);
}

function getCaseItems(caseId) {
  return db.prepare(`
    SELECT ci.weight, i.id, i.name, i.rarity, i.image_url, i.price_cents, i.market_hash_name_base
    FROM case_items ci JOIN items i ON i.id = ci.item_id
    WHERE ci.case_id=?
  `).all(caseId);
}

function ensureDailyCap(userId, nowIsoStr, earnedCents) {
  const u = db.prepare('SELECT daily_open_earned_cents, daily_open_earned_date FROM users WHERE id=?').get(userId);
  const today = nowIsoStr.slice(0, 10);
  let dayEarned = u.daily_open_earned_date === today ? (u.daily_open_earned_cents || 0) : 0;
  const cap = parseGemsToCents(config.DAILY_OPEN_GEM_CAP);
  const room = Math.max(0, cap - dayEarned);
  const allowed = Math.min(room, earnedCents);
  dayEarned += allowed;
  db.prepare('UPDATE users SET daily_open_earned_cents=?, daily_open_earned_date=? WHERE id=?')
    .run(dayEarned, today, userId);
  return allowed;
}

async function resolveCasePriceCents(caseRow) {
  const hash = caseRow.market_hash_name || caseRow.name;
  const info = await getMarketInfo(hash);
  return info?.price_cents ?? caseRow.case_price_cents;
}

async function resolveItemMarketSnapshot(baseItemRow, wearName, isStatTrak = false) {
  const base = baseItemRow.market_hash_name_base || baseItemRow.name;
  const marketHash = marketHashWithWear(base, wearName, isStatTrak);
  const info = await getMarketInfo(marketHash);
  return {
    market_hash_name: marketHash,
    price_cents: info?.price_cents ?? null,
    image_url: info?.icon_url ?? null,
    lowest_price: info?.lowest_price ?? null,
  };
}

async function openCase({ userId, slug, brokenEvent, boostEvent }) {
  if (!slug || typeof slug !== 'string') throw new Error('bad_slug');

  ensureUserSeeds(userId);

  const u = db.prepare('SELECT * FROM users WHERE id=?').get(userId);
  if (!u) throw new Error('user_not_found');

  const c = getActiveCaseBySlug(slug);
  if (!c) throw new Error('case_not_found');

  const now = nowIso();

  // Discounts
  const brokenPayload = brokenEvent ? JSON.parse(brokenEvent.payload_json) : null;
  const boostPayload = boostEvent ? JSON.parse(boostEvent.payload_json) : null;
  const isBroken = !!brokenPayload && brokenPayload.case_id === c.id;

  const discount = Math.max(
    0,
    Math.min(
      0.95,
      (isBroken ? Number(brokenPayload.discount || 0) : 0) + (boostPayload ? Number(boostPayload.discount || 0) : 0)
    )
  );

  const casePriceCents = await resolveCasePriceCents(c);
  const keyPriceCents = c.key_price_cents;
  const spentCents = Math.max(0, Math.floor((casePriceCents + keyPriceCents) * (1 - discount)));

  if (u.gems_cents < spentCents) throw new Error('insufficient_gems');

  // Load items
  const rows = getCaseItems(c.id);
  if (!rows.length) throw new Error('case_has_no_items');

  const rareMult = isBroken ? Number(brokenPayload.rare_weight_mult || config.BROKEN_CASE_RARE_WEIGHT_MULT) : 1.0;
  const weighted = normalizeWeights(rows, rareMult);

  // RNG roll (server-seed HMAC)
  const nonce = (u.nonce || 0) + 1;
  const message = `${nonce}:${c.id}:${Date.now()}`;
  const roll = hmacInt(u.server_seed || 'missing', message);
  const chosen = pickByWeight(weighted, roll);

  // Wear roll + market snapshot
  const wear = randomWear(chosen?.min_float, chosen?.max_float);

  // StatTrak
  // - Gloves are never StatTrak.
  // - Everything else (including knives) can be StatTrak.
  const isGloves = /\bgloves\b/i.test(chosen?.name || '');
  const isStatTrak = !isGloves && Math.random() < config.STATTRAK_CHANCE;

  const marketSnap = await resolveItemMarketSnapshot(chosen, wear.name, isStatTrak);

  // If market price isn't available, approximate with wear multipliers
  const fallbackValue = Math.round(Number(chosen.price_cents || 0) * (wear.fallbackMult || 1));
  const itemValueCents = marketSnap.price_cents ?? fallbackValue;
  const itemImageUrl = marketSnap.image_url || chosen.image_url || null;

  // Gem earnings from item value (keep small; still capped)
  const masteryRow = db.prepare('SELECT xp, level FROM mastery WHERE user_id=? AND case_id=?').get(userId, c.id) || { xp: 0, level: 0 };
  const newXp = masteryRow.xp + 1;
  const newLvl = masteryLevelFromXp(newXp);
  const masteryMult = masteryGemBonusMult(newLvl);
  const boostEarnMult = boostPayload ? Number(boostPayload.gem_earn_mult || 1) : 1.0;

  const baseEarn = Math.floor(itemValueCents * config.EARN_RATE);
  const boostedEarn = Math.floor(baseEarn * masteryMult * boostEarnMult);
  const capPerOpen = parseGemsToCents(config.OPEN_GEM_CAP_PER_OPEN);
  const earnedCapped = clamp(boostedEarn, 0, capPerOpen);
  const earnedCents = ensureDailyCap(userId, now, earnedCapped);

  const newBalance = u.gems_cents - spentCents + earnedCents;

  // Persist
  db.prepare('UPDATE users SET gems_cents=?, total_opens=total_opens+1 WHERE id=?')
    .run(newBalance, userId);

  db.prepare(`
    INSERT INTO mastery(user_id,case_id,xp,level,updated_at)
    VALUES(?,?,?,?,?)
    ON CONFLICT(user_id,case_id) DO UPDATE SET xp=excluded.xp, level=excluded.level, updated_at=excluded.updated_at
  `).run(userId, c.id, newXp, newLvl, now);

  // Pool spend (progressive giveaways)
  addPoolProgress(spentCents);

  // Record open
  const openInfo = db.prepare(`
    INSERT INTO opens(user_id,case_id,item_id,spent_cents,earned_cents,created_at,server_seed_hash,server_seed,client_seed,nonce,rng_roll,modifiers_json)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    userId,
    c.id,
    chosen.id,
    spentCents,
    earnedCents,
    now,
    u.server_seed_hash,
    u.server_seed,
    null,
    nonce,
    roll,
    JSON.stringify({
      stattrak: isStatTrak,
      wear: { tier: wear.name, short: wear.short, float: wear.float },
      market: { market_hash_name: marketSnap.market_hash_name, price_cents: marketSnap.price_cents, lowest_price: marketSnap.lowest_price },
      broken: isBroken ? { rare_mult: rareMult, discount } : null,
      boost: boostPayload ? { gem_earn_mult: boostEarnMult, discount } : null,
    })
  );
  const openId = openInfo.lastInsertRowid;

  // Snapshot into inventory (so later displays/sells keep the same wear + value)
  db.prepare(`
    INSERT INTO inventory(user_id,item_id,open_id,obtained_at,is_sold,sold_at,sold_for_cents,wear_tier,wear_float,market_hash_name,image_url,value_cents)
    VALUES(?,?,?,?,0,NULL,NULL,?,?,?,?,?)
  `).run(
    userId,
    chosen.id,
    openId,
    now,
    wear.name,
    wear.float,
    marketSnap.market_hash_name,
    itemImageUrl,
    itemValueCents
  );

  // Ledger
  db.prepare('INSERT INTO ledger(user_id,type,amount_cents,meta_json,created_at) VALUES(?,?,?,?,?)')
    .run(userId, 'case_open_spend', -spentCents, JSON.stringify({ case: c.slug }), now);
  db.prepare('INSERT INTO ledger(user_id,type,amount_cents,meta_json,created_at) VALUES(?,?,?,?,?)')
    .run(userId, 'case_open_earn', earnedCents, JSON.stringify({ item: chosen.name }), now);

  // Rotate server seed (keeps things unpredictable between opens)
  rotateUserSeed(userId);

  return {
    open_id: openId,
    case: {
      slug: c.slug,
      name: c.name,
      price_gems: formatGems(casePriceCents),
      key_price_gems: formatGems(keyPriceCents),
    },
    item: {
      id: chosen.id,
      name: chosen.name,
      rarity: chosen.rarity,
      image_url: itemImageUrl,
      wear_tier: wear.name,
      wear_short: wear.short,
      wear_float: wear.float.toFixed(4),
      market_hash_name: marketSnap.market_hash_name,
      price_gems: formatGems(itemValueCents),
    },
    spent_gems: formatGems(spentCents),
    earned_gems: formatGems(earnedCents),
    balance_gems: formatGems(newBalance),
    mastery: { xp: newXp, level: newLvl },
  };
}

module.exports = {
  openCase,
};
