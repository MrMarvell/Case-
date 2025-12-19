const { db, nowIso } = require('./db');
const { streakRewardForDay, formatGems } = require('./economy');

function utcDateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function claimStreak(userId, boostEvent) {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(userId);
  if (!u) throw new Error('not_logged_in');

  const now = new Date();
  const today = utcDateKey(now);
  if (u.last_streak_claim === today) throw new Error('already_claimed');

  let nextDay = 1;
  if (u.last_streak_claim) {
    const last = new Date(u.last_streak_claim + 'T00:00:00Z');
    const diffDays = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate())) / (24*3600*1000));
    if (diffDays === 1) nextDay = (u.streak_day || 0) + 1;
    else nextDay = 1;
  }

  // cap at 15
  if (nextDay > 15) nextDay = 15;

  let reward = streakRewardForDay(nextDay);

  if (boostEvent) {
    try {
      const p = JSON.parse(boostEvent.payload_json);
      if (p?.streak_mult) reward = Math.floor(reward * Number(p.streak_mult));
    } catch {}
  }

  const newBalance = u.gems_cents + reward;
  db.prepare('UPDATE users SET gems_cents=?, streak_day=?, last_streak_claim=? WHERE id=?')
    .run(newBalance, nextDay, today, u.id);

  db.prepare('INSERT INTO ledger(user_id,type,amount_cents,meta_json,created_at) VALUES(?,?,?,?,?)')
    .run(u.id, 'streak_claim', reward, JSON.stringify({ day: nextDay }), nowIso());

  return { day: nextDay, reward_gems: formatGems(reward), balance_gems: formatGems(newBalance) };
}

module.exports = { claimStreak };
