const config = require('./config');
const { db, nowIso } = require('./db');
const { parseGemsToCents, formatGems } = require('./economy');

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function getBonusStateForUser(userId, now = new Date()) {
  const u = db.prepare('SELECT id, last_bonus_claim_at FROM users WHERE id=?').get(userId);
  if (!u) return null;

  const last = u.last_bonus_claim_at ? Date.parse(u.last_bonus_claim_at) : null;
  const cooldownMs = config.BONUS_COOLDOWN_SECONDS * 1000;
  const nextAtMs = (last == null || !Number.isFinite(last)) ? 0 : (last + cooldownMs);
  const canClaim = now.getTime() >= nextAtMs;
  return {
    can_claim: canClaim,
    next_claim_at: canClaim ? null : new Date(nextAtMs).toISOString(),
    cooldown_seconds: config.BONUS_COOLDOWN_SECONDS,
  };
}

function drawBonusAmountCents() {
  const min = parseGemsToCents(config.BONUS_MIN_GEMS);
  const max = parseGemsToCents(config.BONUS_MAX_GEMS);
  const a = Math.min(min, max);
  const b = Math.max(min, max);
  const span = Math.max(0, b - a);
  const r = Math.floor(Math.random() * (span + 1));
  return a + r;
}

function claimBonus(userId, now = new Date()) {
  const state = getBonusStateForUser(userId, now);
  if (!state) throw new Error('not_logged_in');
  if (!state.can_claim) throw new Error('cooldown');

  const amount = drawBonusAmountCents();
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(userId);

  const newBalance = (u.gems_cents || 0) + amount;
  db.prepare('UPDATE users SET gems_cents=?, last_bonus_claim_at=? WHERE id=?')
    .run(newBalance, nowIso(), userId);

  db.prepare('INSERT INTO ledger(user_id,type,amount_cents,meta_json,created_at) VALUES(?,?,?,?,?)')
    .run(userId, 'bonus_claim', amount, JSON.stringify({ type: 'bro_bonus' }), nowIso());

  return {
    earned_gems: formatGems(amount),
    balance_gems: formatGems(newBalance),
  };
}

module.exports = {
  getBonusStateForUser,
  claimBonus,
};
