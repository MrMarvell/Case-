const https = require('https');

const DEFAULT_BASE = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en';

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'case-bros (cs2-sim)'
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(30_000, () => {
      req.destroy(new Error(`Timeout fetching ${url}`));
    });
  });
}

function apiBase() {
  const b = process.env.CSGO_API_BASE?.trim();
  return b || DEFAULT_BASE;
}

function urlFor(path) {
  const base = apiBase().replace(/\/+$/, '');
  const p = String(path || '').replace(/^\/+/, '');
  return `${base}/${p}`;
}

async function getCrates() {
  return getJson(urlFor('crates.json'));
}

async function getSkins() {
  return getJson(urlFor('skins.json'));
}

module.exports = {
  apiBase,
  urlFor,
  getJson,
  getCrates,
  getSkins,
};
