import Layout from '../components/Layout';
import Link from 'next/link';
import { getMe } from '../lib/getMe';
import { useState } from 'react';
import dayjs from 'dayjs';

export async function getServerSideProps(ctx) {
  const me = getMe(ctx);

  const { getPool } = require('../lib/pool');
  const { listGiveaways } = require('../lib/giveaways');

  const pool = getPool();
  const giveaways = listGiveaways(me?.id, pool.tier);

  return { props: { me, pool, giveaways } };
}

export default function Giveaways({ me, pool, giveaways }) {
  const [entries, setEntries] = useState(10);

  return (
    <Layout me={me} title="Giveaways">
      <div className="card mb-4">
        <div className="font-semibold">🏦 Progressive Giveaway Pool</div>
        <div className="small">
          Current tier: <span className="text-zinc-100 font-semibold">{pool?.tier_name || '—'}</span> •
          Progress: {(pool?.progress_cents / 100).toFixed(2)} gems spent
        </div>
        <div className="text-xs text-zinc-500 mt-1">
          Before going live with real prizes, publish official giveaway rules and eligibility restrictions.
        </div>
      </div>

      <div className="grid gap-3">
        {giveaways.map(g => (
          <div key={g.id} className="card">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/giveaways/${g.id}`} className="font-semibold hover:underline">{g.title}</Link>
                  {g.locked ? <span className="badge">Locked (Tier {g.tier_required}+)</span> : <span className="badge border-emerald-700 text-emerald-200">Open</span>}
                </div>
                <div className="small mt-1">{g.prize_text}</div>
                <div className="text-xs text-zinc-400 mt-1">
                  Ends {dayjs(g.ends_at).format('YYYY-MM-DD HH:mm')} UTC • Total entries: {g.total_entries} • Your entries: {g.my_entries}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {me ? (
                  <>
                    <input
                      className="input w-24"
                      type="number"
                      min={1}
                      value={entries}
                      onChange={e => setEntries(e.target.value)}
                    />
                    <button
                      className="btn btn-primary"
                      disabled={g.locked}
                      onClick={async () => {
                        const r = await fetch(`/api/giveaways/${g.id}/enter`, {
                          method: 'POST',
                          headers: { 'content-type':'application/json' },
                          body: JSON.stringify({ entries }),
                        });
                        const j = await r.json();
                        if (j.error) alert(j.error);
                        else window.location.reload();
                      }}
                    >
                      Enter ({g.entry_cost_gems}/entry)
                    </button>
                  </>
                ) : (
                  <a href="/auth/steam" className="btn btn-primary">Sign in to enter</a>
                )}
              </div>
            </div>

            {g.description ? <div className="text-sm text-zinc-300 mt-3">{g.description}</div> : null}
          </div>
        ))}
      </div>
    </Layout>
  );
}
