const config = require('./config');

function parseGemsToCents(gems) {
  // Accepts number or string like "15.00"
  const n = typeof gems === 'number' ? gems : Number(String(gems).replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100));
}

function centsToGems(cents) {
  return (Number(cents || 0) / 100);
}

function formatGems(cents) {
  return centsToGems(cents).toFixed(2);
}

const STREAK_SCHEDULE = [
  10, 12, 14, 17, 20,
  24, 29, 35, 42, 50,
  60, 70, 80, 90, 100
];

function streakRewardForDay(day) {
  const idx = Math.max(1, Math.min(config.STREAK_MAX_DAY, day)) - 1;
  return parseGemsToCents(STREAK_SCHEDULE[idx] ?? config.STREAK_BASE);
}

const MASTERY_THRESHOLDS = [0, 5, 15, 30, 50, 80, 120, 170, 230, 300];
function masteryLevelFromXp(xp) {
  let lvl = 0;
  for (let i = 0; i < MASTERY_THRESHOLDS.length; i++) {
    if (xp >= MASTERY_THRESHOLDS[i]) lvl = i;
  }
  return lvl; // 0..9
}

function masteryGemBonusMult(level) {
  // +0% at level 0, up to +10% at level 9
  const bonus = Math.min(0.10, level * 0.012);
  return 1 + bonus;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

module.exports = {
  parseGemsToCents,
  centsToGems,
  formatGems,
  streakRewardForDay,
  masteryLevelFromXp,
  masteryGemBonusMult,
  clamp,
};
