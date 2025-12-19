import Layout from '../components/Layout';
import { getMe } from '../lib/getMe';
import { useState } from 'react';

function Gem({ className = 'h-4 w-4' }) {
  return <img src="/icons/gem.svg" alt="gems" className={className} />;
}

function rarityColor(r) {
  const m = {
    'Mil-Spec': 'text-blue-300',
    'Restricted': 'text-purple-300',
    'Classified': 'text-pink-300',
    'Covert': 'text-red-300',
    'Extraordinary': 'text-yellow-300',
  };
  return m[r] || 'text-zinc-200';
}

export async function getServerSideProps(ctx) {
  const me = getMe(ctx);
  if (!me) return { redirect: { destination: '/', permanent: false } };

  const { listInventory } = require('../lib/inventory');
  const items = listInventory(me.id);

  return { props: { me, items } };
}

export default function Inventory({ me, items }) {
  const [busy, setBusy] = useState(null);

  return (
    <Layout me={me} title="Inventory">
      <div className="card mb-4">
        <div className="font-semibold">Your items (simulation)</div>
        <div className="small">Sell-back pays 60% of indexed item value.</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map(row => (
          <div key={row.inventory_id} className="card">
            <div className="flex items-center gap-3">
              {row.item.image_url ? <img alt={row.item.name} src={row.item.image_url} className="h-12 w-20 rounded border border-zinc-800 object-cover" /> : null}
              <div className="flex-1">
                <div className={`font-semibold ${rarityColor(row.item.rarity)}`}>{row.item.name}</div>
                <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1"><Gem /> {row.item.price_gems}</span>
                  <span className="text-zinc-600">•</span>
                  <span>{row.item.rarity}</span>
                  {row.item.wear_tier ? (
                    <>
                      <span className="text-zinc-600">•</span>
                      <span>{row.item.wear_tier}</span>
                      {row.item.wear_float ? <span className="text-zinc-500">(float {row.item.wear_float})</span> : null}
                    </>
                  ) : null}
                </div>
              </div>
              {row.is_sold ? <span className="badge">Sold</span> : <span className="badge">Owned</span>}
            </div>

            {!row.is_sold ? (
              <div className="mt-3">
                <button
                  className="btn"
                  disabled={busy === row.inventory_id}
                  onClick={async () => {
                    setBusy(row.inventory_id);
                    try {
                      const r = await fetch('/api/inventory/sell', {
                        method: 'POST',
                        headers: { 'content-type':'application/json' },
                        body: JSON.stringify({ inventoryId: row.inventory_id }),
                      });
                      const j = await r.json();
                      if (j.error) alert(j.error);
                      else window.location.reload();
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  {busy === row.inventory_id ? 'Selling...' : 'Sell'}
                </button>
              </div>
            ) : (
              <div className="mt-3 text-xs text-zinc-400 inline-flex items-center gap-1">
                Sold for <Gem /> {row.sold_for_gems}
              </div>
            )}
          </div>
        ))}
      </div>
    </Layout>
  );
}
