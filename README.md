# case-bros (simulation)
A **free-to-play** CS2 case-opening simulator with:
- Steam login (OpenID via `passport-steam`)
- Gems economy (no purchase / no trade)
- Case Mastery (XP + levels + small bonus)
- Broken Case Hour (hourly rotating event)
- Bros Boost Days (random daily event)
- Progressive Giveaway Pool (community gems-spent unlock tiers)
- Giveaways with gem entries
- Inventory + sell-back (60% of indexed value)
- Leaderboard (highest gems)
- Live Steam Community Market prices/images (USD, cached)
- Bro Bonus (small claim every 3 hours)

> Important: This is a starter template. If you run real giveaways, publish official rules, eligibility, age limits, and comply with local laws.

## Quick start (local)
1) Install Node.js 20+
2) Copy env:
   ```bash
   cp .env.example .env
   ```
3) Set:
   - `BASE_URL=http://localhost:3000`
   - `SESSION_SECRET=...`
   - `STEAM_API_KEY=...` (get it from https://steamcommunity.com/dev/apikey)
   - *(Optional)* Market/bonus settings in `.env.example`
4) Initialize + seed:
   ```bash
   npm install
   npm run db:init
   npm run db:seed
   npm run dev
   ```
5) Visit: http://localhost:3000

## Make yourself admin
Put your SteamID in `.env`:
```bash
ADMIN_STEAM_IDS=7656119xxxxxxxxxx
```
Then sign in again.

## Import your full case catalog
Go to `/admin` → **Import cases (JSON)**

JSON shape:
```json
{
  "cases": [
    {
      "slug": "kilowatt-case",
      "name": "Kilowatt Case",
      "casePrice": "1.00",
      "keyPrice": "2.50",
      "imageUrl": "...",
      "marketHashName": "Kilowatt Case",
      "items": [
        {
          "name": "AK-47 | Example",
          "rarity": "Restricted",
          "price": "2.10",
          "weight": 900,
          "imageUrl": "...",
          "marketHashNameBase": "AK-47 | Example"
        }
      ]
    }
  ]
}
```

## Deploy to a real domain (recommended)
**VPS + Docker Compose + Caddy (automatic HTTPS)**

1) On your VPS:
   ```bash
   git clone <your repo>
   cd case-bros
   cp .env.example .env
   # edit .env:
   # BASE_URL=https://YOURDOMAIN.COM
   # SESSION_SECRET=...
   # STEAM_API_KEY=...
   cp Caddyfile.example Caddyfile
   # edit Caddyfile and put YOURDOMAIN.COM
   docker compose up -d --build
   docker compose exec app npm run db:seed
   ```

2) Point your domain DNS A record to the VPS IP.
3) Open https://YOURDOMAIN.COM

## Notes on safety/compliance
- Gems are free-only and non-transferable by design.
- Donations and ads should not increase odds or entries.
- If you run prize giveaways publicly, add:
  - rules page
  - age gate
  - geo restrictions where required
  - moderation + anti-bot

## License
MIT (you can change this).
