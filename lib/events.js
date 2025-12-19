const crypto = require('crypto');
const { db, nowIso } = require('./db');
const config = require('./config');
const { getGlobal, setGlobal } = require('./pool');

function utcDateKey(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function floorToHour(d = new Date()) {
  const x = new Date(d.getTime());
  x.setUTCMinutes(0, 0, 0);
  return x;
}

function startOfUtcDay(d = new Date()) {
  const x = new Date(d.getTime());
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function endOfUtcDay(d = new Date()) {
  const x = startOfUtcDay(d);
  x.setUTCDate(x.getUTCDate() + 1);
  return x;
}

function getActiveEvent(type, now = new Date()) {
  const iso = now.toISOString();
  return db.prepare(
    `SELECT * FROM events WHERE type=? AND start_at<=? AND end_at>? ORDER BY id DESC LIMIT 1`
  ).get(type, iso, iso);
}

function getBrokenCaseEvent(now = new Date()) {
  return getActiveEvent('broken_case', now);
}

function getBrosBoostEvent(now = new Date()) {
  return getActiveEvent('bros_boost', now);
}

function pickRandomCase() {
  const cases = db.prepare('SELECT id, slug, name FROM cases WHERE active=1').all();
  if (!cases.length) return null;
  const idx = Math.floor(Math.random() * cases.length);
  return cases[idx];
}

function ensureBrokenCaseHour(now = new Date()) {
  const active = getBrokenCaseEvent(now);
  if (active) return active;

  const hourStart = floorToHour(now);
  const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

  // Only create if we're inside this hour window
  if (now < hourStart || now >= hourEnd) return null;

  const picked = pickRandomCase();
  if (!picked) return null;

  const payload = {
    case_id: picked.id,
    case_slug: picked.slug,
    case_name: picked.name,
    rare_weight_mult: config.BROKEN_CASE_RARE_WEIGHT_MULT,
    discount: config.BROKEN_CASE_DISCOUNT,
  };

  db.prepare(
    `INSERT INTO events(type,start_at,end_at,payload_json) VALUES(?,?,?,?)`
  ).run('broken_case', hourStart.toISOString(), hourEnd.toISOString(), JSON.stringify(payload));

  setGlobal('last_broken_hour', hourStart.toISOString());
  return getBrokenCaseEvent(now);
}

function seededChanceForDate(dateKey, secret, prob) {
  // Deterministic daily randomness so restarts don't change the outcome
  const h = crypto.createHash('sha256').update(dateKey + '|' + secret).digest('hex');
  const n = parseInt(h.slice(0, 12), 16); // 48 bits
  const r = n / 0xFFFFFFFFFFFF; // ~[0,1]
  return r < prob;
}

function ensureBrosBoostDay(now = new Date()) {
  const dateKey = utcDateKey(now);
  const last = getGlobal('last_boost_date', '');
  const active = getBrosBoostEvent(now);
  if (active) return active;

  if (last === dateKey) return null; // already decided today

  const should = seededChanceForDate(dateKey, config.SESSION_SECRET, config.BROS_BOOST_PROB);
  setGlobal('last_boost_date', dateKey);

  if (!should) return null;

  const start = startOfUtcDay(now);
  const end = endOfUtcDay(now);

  const payload = {
    gem_earn_mult: config.BROS_BOOST_GEM_EARN_MULT,
    streak_mult: config.BROS_BOOST_STREAK_MULT,
    discount: config.BROS_BOOST_DISCOUNT,
  };

  db.prepare(
    `INSERT INTO events(type,start_at,end_at,payload_json) VALUES(?,?,?,?)`
  ).run('bros_boost', start.toISOString(), end.toISOString(), JSON.stringify(payload));

  return getBrosBoostEvent(now);
}

function tick(now = new Date()) {
  try {
    ensureBrokenCaseHour(now);
    ensureBrosBoostDay(now);
  } catch (e) {
    console.error('scheduler tick error', e);
  }
}

function startSchedulers() {
  // Run immediately then every minute
  tick(new Date());
  setInterval(() => tick(new Date()), 60 * 1000);
}

module.exports = {
  getBrokenCaseEvent,
  getBrosBoostEvent,
  ensureBrokenCaseHour,
  ensureBrosBoostDay,
  startSchedulers,
};
