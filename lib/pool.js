const { db } = require('./db');
const config = require('./config');
const { parseGemsToCents } = require('./economy');

const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Mythic'];

function getGlobal(key, fallback = null) {
  const row = db.prepare('SELECT value FROM global_state WHERE key=?').get(key);
  return row ? row.value : fallback;
}

function setGlobal(key, value) {
  db.prepare('INSERT INTO global_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(key, String(value));
}

function getPool() {
  const progress = Number(getGlobal('pool_progress_cents', '0')) || 0;
  const tier = Number(getGlobal('pool_tier', '0')) || 0;
  const thresholdsCents = config.POOL_THRESHOLDS.map(g => parseGemsToCents(g));
  const nextThreshold = thresholdsCents[Math.min(tier + 1, thresholdsCents.length - 1)] ?? thresholdsCents[thresholdsCents.length - 1] ?? 0;
  const currentThreshold = thresholdsCents[Math.min(tier, thresholdsCents.length - 1)] ?? 0;
  return {
    progress_cents: progress,
    tier,
    tier_name: TIER_NAMES[tier] ?? `Tier ${tier}`,
    thresholds_cents: thresholdsCents,
    currentThreshold_cents: currentThreshold,
    nextThreshold_cents: nextThreshold,
  };
}

function recomputeTier(progressCents) {
  const thresholdsCents = config.POOL_THRESHOLDS.map(g => parseGemsToCents(g));
  let tier = 0;
  for (let i = 0; i < thresholdsCents.length; i++) {
    if (progressCents >= thresholdsCents[i]) tier = i;
  }
  return tier;
}

function addPoolProgress(spentCents) {
  const pool = getPool();
  const newProgress = pool.progress_cents + spentCents;
  const newTier = recomputeTier(newProgress);
  setGlobal('pool_progress_cents', newProgress);
  setGlobal('pool_tier', newTier);
  return getPool();
}

module.exports = {
  TIER_NAMES,
  getPool,
  addPoolProgress,
  getGlobal,
  setGlobal,
};
