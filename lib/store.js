const crypto = require('crypto');
const { db, nowIso } = require('./db');
const config = require('./config');
const { parseGemsToCents } = require('./economy');

function sha256hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function randomSeed() {
  return crypto.randomBytes(32).toString('hex');
}

function ensureUserSeeds(userId) {
  const u = db.prepare('SELECT id, server_seed, server_seed_hash FROM users WHERE id=?').get(userId);
  if (!u) throw new Error('user not found');
  if (u.server_seed && u.server_seed_hash) return u;
  const seed = randomSeed();
  const hash = sha256hex(seed);
  db.prepare('UPDATE users SET server_seed=?, server_seed_hash=?, nonce=0 WHERE id=?').run(seed, hash, userId);
  return db.prepare('SELECT id, server_seed, server_seed_hash FROM users WHERE id=?').get(userId);
}

function rotateUserSeed(userId) {
  const seed = randomSeed();
  const hash = sha256hex(seed);
  db.prepare('UPDATE users SET server_seed=?, server_seed_hash=?, nonce=0 WHERE id=?').run(seed, hash, userId);
  return { seed, hash };
}

function getUserBySteamId(steamId) {
  return db.prepare('SELECT * FROM users WHERE steam_id=?').get(steamId);
}

function upsertUserFromSteamProfile(profile) {
  const steamId = profile.id;
  const displayName = profile.displayName || 'Steam User';
  const avatar = (profile.photos && profile.photos[2] && profile.photos[2].value) || (profile.photos && profile.photos[0] && profile.photos[0].value) || null;

  const isAdmin = config.ADMIN_STEAM_IDS.includes(steamId) ? 1 : 0;

  let u = getUserBySteamId(steamId);
  const now = nowIso();
  if (!u) {
    const starting = parseGemsToCents(config.STARTING_GEMS);
    const seed = randomSeed();
    const hash = sha256hex(seed);
    const info = db.prepare(`
      INSERT INTO users(steam_id,display_name,avatar,created_at,last_login_at,gems_cents,is_admin,server_seed,server_seed_hash,nonce)
      VALUES(?,?,?,?,?,?,?,?,?,?)
    `).run(steamId, displayName, avatar, now, now, starting, isAdmin, seed, hash, 0);
    u = db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
  } else {
    db.prepare('UPDATE users SET display_name=?, avatar=?, last_login_at=?, is_admin=? WHERE id=?')
      .run(displayName, avatar, now, isAdmin, u.id);
    ensureUserSeeds(u.id);
    u = db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
  }

  return u;
}

function publicUserView(u) {
  if (!u) return null;
  return {
    id: u.id,
    steam_id: u.steam_id,
    display_name: u.display_name,
    avatar: u.avatar,
    gems: (u.gems_cents / 100).toFixed(2),
    streak_day: u.streak_day,
    is_admin: !!u.is_admin,
  };
}

module.exports = {
  sha256hex,
  randomSeed,
  ensureUserSeeds,
  rotateUserSeed,
  getUserBySteamId,
  upsertUserFromSteamProfile,
  publicUserView,
};
