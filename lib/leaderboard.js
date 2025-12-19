const { db } = require('./db');
const { formatGems } = require('./economy');

function getLeaderboard(limit = 50) {
  const rows = db.prepare(`
    SELECT steam_id, display_name, avatar, gems_cents, total_opens
    FROM users
    ORDER BY gems_cents DESC
    LIMIT ?
  `).all(limit);

  return rows.map((r, idx) => ({
    rank: idx + 1,
    steam_id: r.steam_id,
    display_name: r.display_name,
    avatar: r.avatar,
    gems: formatGems(r.gems_cents),
    total_opens: r.total_opens,
  }));
}

module.exports = { getLeaderboard };
