// Steam Community Market helper (USD) with SQLite cache.
//
// Notes:
// - Steam does not provide an unlimited “official” JSON API for market data.
// - This module uses the public priceoverview + listings render endpoints.
// - We cache aggressively (default: 3 hours) to reduce rate limits.

const config = require('./config');
const { db, nowIso } = require('./db');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseUsdToCents(priceStr) {
  if (!priceStr || typeof priceStr !== 'string') return null;
  // Typical formats: "$1.23" or "USD 1.23". We keep digits + dot.
  const m = priceStr.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function economyImageUrl(iconUrl, size = 360) {
  if (!iconUrl) return null;
  if (iconUrl.startsWith('http://') || iconUrl.startsWith('https://')) return iconUrl;
  // Steam economy images accept size suffixes like /360fx360f
  return `https://community.akamai.steamstatic.com/economy/image/${iconUrl}/${size}fx${size}f`;
}

async function fetchJsonWithTimeout(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        // simple UA helps some infra
        'user-agent': 'case-bros/1.0 (+https://example.invalid)',
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchPriceOverview(marketHashName, currency = config.MARKET_CURRENCY) {
  const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=${encodeURIComponent(currency)}&market_hash_name=${encodeURIComponent(marketHashName)}`;
  const j = await fetchJsonWithTimeout(url);
  if (!j || !j.success) return null;
  return {
    lowest_price: j.lowest_price || null,
    median_price: j.median_price || null,
    volume: j.volume ? Number(String(j.volume).replace(/,/g, '')) : null,
    price_cents: parseUsdToCents(j.lowest_price) ?? parseUsdToCents(j.median_price),
  };
}

async function fetchListingIcon(marketHashName, currency = config.MARKET_CURRENCY, country = config.MARKET_COUNTRY) {
  // Render endpoint contains assets with icon_url.
  const url = `https://steamcommunity.com/market/listings/730/${encodeURIComponent(marketHashName)}/render/?query=&start=0&count=1&currency=${encodeURIComponent(currency)}&language=english&country=${encodeURIComponent(country)}`;
  const j = await fetchJsonWithTimeout(url);
  if (!j || j.success !== true) return null;
  const assets = j.assets?.['730']?.['2'];
  if (!assets) return null;
  const firstClassId = Object.keys(assets)[0];
  if (!firstClassId) return null;
  const asset = assets[firstClassId];
  const icon = asset?.icon_url || null;
  return {
    icon_url: economyImageUrl(icon),
  };
}

function getCacheRow(marketHashName, currency = config.MARKET_CURRENCY) {
  return db.prepare(
    'SELECT * FROM market_cache WHERE market_hash_name=? AND currency=?'
  ).get(marketHashName, currency);
}

function upsertCache(marketHashName, currency, info) {
  const row = {
    market_hash_name: marketHashName,
    currency,
    price_cents: info.price_cents ?? null,
    lowest_price: info.lowest_price ?? null,
    median_price: info.median_price ?? null,
    volume: info.volume ?? null,
    icon_url: info.icon_url ?? null,
    updated_at: nowIso(),
  };
  db.prepare(`
    INSERT INTO market_cache(market_hash_name,currency,price_cents,lowest_price,median_price,volume,icon_url,updated_at)
    VALUES(@market_hash_name,@currency,@price_cents,@lowest_price,@median_price,@volume,@icon_url,@updated_at)
    ON CONFLICT(market_hash_name,currency) DO UPDATE SET
      price_cents=excluded.price_cents,
      lowest_price=excluded.lowest_price,
      median_price=excluded.median_price,
      volume=excluded.volume,
      icon_url=COALESCE(excluded.icon_url, market_cache.icon_url),
      updated_at=excluded.updated_at
  `).run(row);
}

function isFresh(row, ttlSeconds = config.MARKET_CACHE_TTL_SECONDS) {
  if (!row?.updated_at) return false;
  const ageMs = Date.now() - Date.parse(row.updated_at);
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < ttlSeconds * 1000;
}

async function refreshMarketInfo(marketHashName, currency, country) {
  const [p, i] = await Promise.allSettled([
    fetchPriceOverview(marketHashName, currency),
    fetchListingIcon(marketHashName, currency, country),
  ]);
  const price = p.status === 'fulfilled' ? p.value : null;
  const icon = i.status === 'fulfilled' ? i.value : null;

  const merged = {
    price_cents: price?.price_cents ?? null,
    lowest_price: price?.lowest_price ?? null,
    median_price: price?.median_price ?? null,
    volume: price?.volume ?? null,
    icon_url: icon?.icon_url ?? null,
  };

  // Only upsert if we got something usable (avoid overwriting a good cache row with nulls).
  if (merged.price_cents != null || merged.icon_url != null) {
    upsertCache(marketHashName, currency, merged);
  }

  return getCacheRow(marketHashName, currency);
}

async function getMarketInfo(marketHashName, opts = {}) {
  const currency = opts.currency ?? config.MARKET_CURRENCY;
  const country = opts.country ?? config.MARKET_COUNTRY;
  const ttlSeconds = opts.ttlSeconds ?? config.MARKET_CACHE_TTL_SECONDS;
  const behavior = opts.behavior || 'await'; // 'await' | 'swr' (stale-while-revalidate)

  if (!marketHashName || typeof marketHashName !== 'string') return null;

  const cached = getCacheRow(marketHashName, currency);
  if (cached && isFresh(cached, ttlSeconds)) {
    return {
      market_hash_name: marketHashName,
      currency,
      price_cents: cached.price_cents,
      lowest_price: cached.lowest_price,
      median_price: cached.median_price,
      volume: cached.volume,
      icon_url: cached.icon_url,
      updated_at: cached.updated_at,
      source: 'cache',
    };
  }

  // If asked to be fast, return best cache we have and refresh in the background.
  if (behavior === 'swr') {
    // Kick off refresh, but don't block the response.
    refreshMarketInfo(marketHashName, currency, country).catch(() => {});
    if (cached) {
      return {
        market_hash_name: marketHashName,
        currency,
        price_cents: cached.price_cents,
        lowest_price: cached.lowest_price,
        median_price: cached.median_price,
        volume: cached.volume,
        icon_url: cached.icon_url,
        updated_at: cached.updated_at,
        source: 'stale_cache',
      };
    }
    return null;
  }

  // Fetch (with a couple of light retries)
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = await refreshMarketInfo(marketHashName, currency, country);
      if (!out) return null;

      return {
        market_hash_name: marketHashName,
        currency,
        price_cents: out.price_cents,
        lowest_price: out.lowest_price,
        median_price: out.median_price,
        volume: out.volume,
        icon_url: out.icon_url,
        updated_at: out.updated_at,
        source: 'steam',
      };
    } catch (e) {
      lastErr = e;
      // small backoff
      await sleep(250 + attempt * 400);
    }
  }

  // Fall back to stale cache if available.
  if (cached) {
    return {
      market_hash_name: marketHashName,
      currency,
      price_cents: cached.price_cents,
      lowest_price: cached.lowest_price,
      median_price: cached.median_price,
      volume: cached.volume,
      icon_url: cached.icon_url,
      updated_at: cached.updated_at,
      source: 'stale_cache',
      error: String(lastErr?.message || lastErr || 'unknown'),
    };
  }

  return null;
}

async function mapWithConcurrency(arr, limit, fn) {
  const out = new Array(arr.length);
  let idx = 0;

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= arr.length) return;
      out[i] = await fn(arr[i], i);
    }
  }

  const n = Math.max(1, Math.min(limit || 4, arr.length || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

module.exports = {
  parseUsdToCents,
  economyImageUrl,
  getMarketInfo,
  mapWithConcurrency,
};
