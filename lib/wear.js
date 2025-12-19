const crypto = require('crypto');

// Wear bands (typical CS wear ranges).
// Many skins have narrower ranges, but this is a solid simulation default.
const WEAR_BANDS = [
  { name: 'Factory New', short: 'FN', max: 0.07, fallbackMult: 1.35 },
  { name: 'Minimal Wear', short: 'MW', max: 0.15, fallbackMult: 1.15 },
  { name: 'Field-Tested', short: 'FT', max: 0.38, fallbackMult: 1.00 },
  { name: 'Well-Worn', short: 'WW', max: 0.45, fallbackMult: 0.80 },
  { name: 'Battle-Scarred', short: 'BS', max: 1.00, fallbackMult: 0.65 },
];

function randomFloat01() {
  // 0.0000 .. 0.9999
  const n = crypto.randomInt(0, 10000);
  return n / 10000;
}

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n));
}

function wearFromFloat(f) {
  const x = Math.max(0, Math.min(0.9999, Number(f)));
  for (const b of WEAR_BANDS) {
    if (x <= b.max) {
      return { ...b, float: x };
    }
  }
  return { ...WEAR_BANDS[WEAR_BANDS.length - 1], float: x };
}

function randomWear(minFloat, maxFloat) {
  // If a skin has a known float range, roll inside it so the wear is valid for that skin.
  const min = clamp01(minFloat);
  const max = clamp01(maxFloat);
  if (min !== null || max !== null) {
    const lo = min !== null ? min : 0;
    const hi = max !== null ? max : 1;
    const a = Math.min(lo, hi);
    const b = Math.max(lo, hi);
    const f = a + (b - a) * randomFloat01();
    return wearFromFloat(f);
  }
  return wearFromFloat(randomFloat01());
}

function defaultWearName() {
  return 'Field-Tested';
}

function marketHashWithWear(baseName, wearName, isStatTrak = false) {
  const base = String(baseName || '').trim();
  if (!base) return null;

  // StatTrak prefix (Steam Community Market uses the trademark symbol)
  const prefix = isStatTrak ? 'StatTrak™ ' : '';

  // Items that do NOT have wear variants on the market
  // (stickers, capsules, keys, pins, etc.)
  const noWear = /^(Sticker|Patch|Music Kit|Sealed Graffiti|Collectible|Pin|Case Key|Operation|Souvenir|Storage|Viewer Pass)/i.test(base);

  // "Vanilla" knives (e.g., "★ Bayonet") do not have a wear suffix.
  const looksVanillaWeapon = base.startsWith('★') && !base.includes('|');

  if (noWear || looksVanillaWeapon) {
    return `${prefix}${base}`;
  }

  // Most CS2 skins are listed as "NAME (Field-Tested)" etc.
  const wear = wearName || defaultWearName();
  return `${prefix}${base} (${wear})`;
}

module.exports = {
  WEAR_BANDS,
  randomFloat01,
  clamp01,
  wearFromFloat,
  randomWear,
  defaultWearName,
  marketHashWithWear,
};
