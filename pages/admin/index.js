import Layout from '../../components/Layout';
import { getMe } from '../../lib/getMe';
import { useState } from 'react';

export async function getServerSideProps(ctx) {
  const me = getMe(ctx);
  if (!me || !me.is_admin) return { redirect: { destination: '/', permanent: false } };

  const { db } = require('../../lib/db');
  const caseCount = db.prepare('SELECT COUNT(*) as n FROM cases').get().n;
  const itemCount = db.prepare('SELECT COUNT(*) as n FROM items').get().n;
  const giveawayCount = db.prepare('SELECT COUNT(*) as n FROM giveaways').get().n;

  return { props: { me, stats: { caseCount, itemCount, giveawayCount } } };
}

function isoInFuture(days) {
  const d = new Date(Date.now() + days * 24 * 3600 * 1000);
  return d.toISOString().slice(0,16); // for datetime-local
}

export default function Admin({ me, stats }) {
  const [importJson, setImportJson] = useState(JSON.stringify({
    cases: [
      {
        slug: "example-case",
        name: "Example Case",
        casePrice: "0.85",
        keyPrice: "2.50",
        imageUrl: "https://placehold.co/600x400?text=Example+Case",
        items: [
          { name: "Example Skin", rarity: "Mil-Spec", price: "0.20", weight: 5000, imageUrl: "https://placehold.co/300x200?text=Skin" }
        ]
      }
    ]
  }, null, 2));

  const [gTitle, setGTitle] = useState('Weekly Giveaway');
  const [gPrize, setGPrize] = useState('Example prize: $25 Steam Gift Card');
  const [gTier, setGTier] = useState(0);
  const [gStarts, setGStarts] = useState(new Date().toISOString().slice(0,16));
  const [gEnds, setGEnds] = useState(isoInFuture(7));
  const [gDesc, setGDesc] = useState('Write eligibility + rules in your official giveaway rules page.');

  return (
    <Layout me={me} title="Admin">
      <div className="card mb-4">
        <div className="font-semibold">Site stats</div>
        <div className="small mt-2">Cases: {stats.caseCount} • Items: {stats.itemCount} • Giveaways: {stats.giveawayCount}</div>
        <div className="text-xs text-zinc-500 mt-1">Tip: add your full CS2 case catalog via Import below.</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="font-semibold">Import cases (JSON)</div>
          <div className="small mt-2">Paste a JSON payload with cases and items. This upserts cases/items and weights.</div>

          <textarea
            className="input mt-3 font-mono text-xs h-64"
            value={importJson}
            onChange={e => setImportJson(e.target.value)}
          />

          <div className="mt-3 flex gap-2">
            <button
              className="btn btn-primary"
              onClick={async () => {
                let payload;
                try { payload = JSON.parse(importJson); } catch (e) { alert('Invalid JSON'); return; }

                const r = await fetch('/api/admin/import', {
                  method: 'POST',
                  headers: { 'content-type':'application/json' },
                  body: JSON.stringify(payload),
                });
                const j = await r.json();
                if (j.error) alert(j.error);
                else {
                  alert(`Imported: ${j.inserted}. Errors: ${j.errors?.length || 0}`);
                  window.location.reload();
                }
              }}
            >
              Import
            </button>
            <button className="btn" onClick={() => setImportJson('')}>Clear</button>
          </div>

          <div className="mt-3 text-xs text-zinc-500">
            You can generate this JSON from any data source you trust. For real prices, consider manual updates (prices move).
          </div>
        </div>

        <div className="card">
          <div className="font-semibold">Create giveaway</div>
          <div className="small mt-2">This creates a giveaway record. You still need to run the actual prize fulfillment yourself.</div>

          <div className="grid gap-2 mt-3">
            <label className="text-sm">Title</label>
            <input className="input" value={gTitle} onChange={e => setGTitle(e.target.value)} />

            <label className="text-sm mt-2">Prize text</label>
            <input className="input" value={gPrize} onChange={e => setGPrize(e.target.value)} />

            <label className="text-sm mt-2">Tier required (0=Bronze...)</label>
            <input className="input" type="number" min={0} value={gTier} onChange={e => setGTier(e.target.value)} />

            <label className="text-sm mt-2">Starts (UTC)</label>
            <input className="input" type="datetime-local" value={gStarts} onChange={e => setGStarts(e.target.value)} />

            <label className="text-sm mt-2">Ends (UTC)</label>
            <input className="input" type="datetime-local" value={gEnds} onChange={e => setGEnds(e.target.value)} />

            <label className="text-sm mt-2">Description</label>
            <textarea className="input h-24" value={gDesc} onChange={e => setGDesc(e.target.value)} />

            <button
              className="btn btn-primary mt-2"
              onClick={async () => {
                const starts = new Date(gStarts).toISOString();
                const ends = new Date(gEnds).toISOString();

                const r = await fetch('/api/admin/giveaways', {
                  method: 'POST',
                  headers: { 'content-type':'application/json' },
                  body: JSON.stringify({
                    title: gTitle,
                    description: gDesc,
                    tier_required: gTier,
                    prize_text: gPrize,
                    starts_at: starts,
                    ends_at: ends,
                  }),
                });
                const j = await r.json();
                if (j.error) alert(j.error);
                else {
                  alert('Giveaway created');
                  window.location.reload();
                }
              }}
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
