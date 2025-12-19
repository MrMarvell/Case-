// Steam Community Market helpers (best-effort; subject to Steam rate limits)
//
// We use two endpoints:
// 1) priceoverview (lightweight JSON) for prices
// 2) listings page (HTML) for an image URL
//
// Notes:
// - Steam can throttle requests. Always cache.
// - This is simulation-only. Do not use for trading/gambling.

const PRICEOVERVIEW_URL = 'https://steamcommunity.com/market/priceoverview/';

function parseUsdToCents(priceStr) {
  if (!priceStr) return null;
  // Examples: "$1.23", "US$ 1.23", "1.23 USD"
  const s = String(priceStr)
    .replace(/\u00a0/g, ' ')
    .trim();
  // Keep digits, comma, dot
  const m = s.match(/([0-9]+([\.,][0-9]{1,2})?)/);
  if (!m) return null;
  const num = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.round(num * 100));
}

function normalizeVolume(v) {
  if (v == null) return null;
  const s = String(v).replace(/,/g, '').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function uaHeaders() {
  return {
    'user-agent': 'case-bros-sim/1.0 (+https://example.invalid)',
    'accept': 'text/html,application/json;q=0.9,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
  };
}

async function fetchPriceOverview({ marketHashName, currencyId = 1, appid = 730 }) {
  const url = new URL(PRICEOVERVIEW_URL);
  url.searchParams.set('currency', String(currencyId));
  url.searchParams.set('appid', String(appid));
  url.searchParams.set('market_hash_name', marketHashName);

  const res = await fetch(url.toString(), { headers: uaHeaders() });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`priceoverview_http_${res.status}:${txt.slice(0, 120)}`);
  }
  const json = await res.json();
  if (!json || json.success !== true) {
    throw new Error('priceoverview_failed');
  }
  return {
    lowest_price_cents: parseUsdToCents(json.lowest_price),
    median_price_cents: parseUsdToCents(json.median_price),
    volume: normalizeVolume(json.volume),
  };
}

function extractListingImageUrl(html) {
  if (!html) return null;
  // Primary: <img id="largeitemimg" src="...">
  let m = html.match(/id="largeitemimg"[^>]*src="([^"]+)"/i);
  if (m && m[1]) return m[1];

  // Fallback: first economy image
  m = html.match(/https:\/\/community\.cloudflare\.steamstatic\.com\/economy\/image\/[^"'\s>]+/i);
  if (m && m[0]) return m[0];
  return null;
}

async function fetchListingImage({ marketHashName, appid = 730 }) {
  const url = `https://steamcommunity.com/market/listings/${appid}/${encodeURIComponent(marketHashName)}`;
  const res = await fetch(url, { headers: uaHeaders() });
  if (!res.ok) return null;
  const html = await res.text();
  return extractListingImageUrl(html);
}

module.exports = {
  parseUsdToCents,
  fetchPriceOverview,
  fetchListingImage,
};
