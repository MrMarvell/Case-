const dotenv = require('dotenv');

dotenv.config();

function num(name, fallback) {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(name, fallback) {
  const v = process.env[name];
  return (v == null || v === '') ? fallback : v;
}

function csvNums(name, fallbackCsv) {
  const raw = str(name, fallbackCsv);
  return raw
    .split(',')
    .map(s => Number(s.trim()))
    .filter(n => Number.isFinite(n));
}

module.exports = {
  BASE_URL: str('BASE_URL', 'http://localhost:3000'),
  PORT: num('PORT', 3000),
  SESSION_SECRET: str('SESSION_SECRET', 'change-me'),
  STEAM_API_KEY: str('STEAM_API_KEY', ''),
  ADMIN_STEAM_IDS: str('ADMIN_STEAM_IDS', '').split(',').map(s => s.trim()).filter(Boolean),

  // Steam Community Market (live USD prices/images)
  // Steam "currency" parameter: 1 = USD
  MARKET_CURRENCY: num('MARKET_CURRENCY', 1),
  MARKET_COUNTRY: str('MARKET_COUNTRY', 'US'),
  // Default cache TTL: 3 hours
  MARKET_CACHE_TTL_SECONDS: num('MARKET_CACHE_TTL_SECONDS', 3 * 60 * 60),
  // Warm-up batch size (limits external requests at startup)
  MARKET_WARMUP_BATCH: num('MARKET_WARMUP_BATCH', 30),

  // Extra gem earning: a small timed claim
  BONUS_COOLDOWN_SECONDS: num('BONUS_COOLDOWN_SECONDS', 3 * 60 * 60),
  // User requested default: 3 gems every 3 hours
  BONUS_MIN_GEMS: str('BONUS_MIN_GEMS', '3.00'),
  BONUS_MAX_GEMS: str('BONUS_MAX_GEMS', '3.00'),

  STARTING_GEMS: str('STARTING_GEMS', '15.00'),
  EARN_RATE: num('EARN_RATE', 0.25),
  OPEN_GEM_CAP_PER_OPEN: str('OPEN_GEM_CAP_PER_OPEN', '50.00'),
  DAILY_OPEN_GEM_CAP: str('DAILY_OPEN_GEM_CAP', '250.00'),
  STREAK_BASE: num('STREAK_BASE', 10),
  STREAK_MAX_DAY: num('STREAK_MAX_DAY', 15),

  BROKEN_CASE_RARE_WEIGHT_MULT: num('BROKEN_CASE_RARE_WEIGHT_MULT', 2.0),
  BROKEN_CASE_DISCOUNT: num('BROKEN_CASE_DISCOUNT', 0.10),

  BROS_BOOST_PROB: num('BROS_BOOST_PROB', 0.15),
  BROS_BOOST_GEM_EARN_MULT: num('BROS_BOOST_GEM_EARN_MULT', 1.25),
  BROS_BOOST_STREAK_MULT: num('BROS_BOOST_STREAK_MULT', 1.50),
  BROS_BOOST_DISCOUNT: num('BROS_BOOST_DISCOUNT', 0.10),

  POOL_THRESHOLDS: csvNums('POOL_THRESHOLDS', '0,500,2000,7500,20000'),
};
