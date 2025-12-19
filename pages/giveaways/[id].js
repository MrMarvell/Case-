import Layout from '../../components/Layout';
import { getMe } from '../../lib/getMe';
import { useState } from 'react';
import dayjs from 'dayjs';

export async function getServerSideProps(ctx) {
  const me = getMe(ctx);
  const id = Number(ctx.params.id);

  const { getPool } = require('../../lib/pool');
  const { getGiveaway } = require('../../lib/giveaways');
  const { db } = require('../../lib/db');

  const pool = getPool();
  const g = getGiveaway(id);
  if (!g) return { notFound: true };

  const locked = pool.tier < g.tier_required;
  let myEntries = 0;
  if (me) {
    const row = db.prepare('SELECT entries FROM giveaway_entries WHERE giveaway_id=? AND user_id=?').get(id, me.id);
    myEntries = row ? row.entries : 0;
  }

  return { props: { me, giveaway: { ...g, locked }, pool, myEntries } };
}

export default function GiveawayDetail({ me, giveaway, pool, myEntries }) {
  const [entries, setEntries] = useState(10);
  const locked = giveaway.locked;

  return (
    <Layout me={me} title={giveaway.title}>
      <div className="card">
        <div className="small">
          Tier required: <span className="text-zinc-100 font-semibold">{giveaway.tier_required}</span> •
          Pool tier: <span className="text-zinc-100 font-semibold">{pool?.tier_name}</span>
        </div>
        <div className="mt-2 text-lg font-semibold">{giveaway.prize_text}</div>
        {giveaway.description ? <div className="mt-2 text-zinc-300">{giveaway.description}</div> : null}

        <div className="mt-3 text-sm text-zinc-400">
          Live window: {dayjs(giveaway.starts_at).format('YYYY-MM-DD HH:mm')} UTC → {dayjs(giveaway.ends_at).format('YYYY-MM-DD HH:mm')} UTC
        </div>
        <div className="mt-1 text-sm text-zinc-400">
          Total entries: <span className="text-zinc-100 font-semibold">{giveaway.total_entries}</span> • Your entries: <span className="text-zinc-100 font-semibold">{myEntries}</span>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {me ? (
            <>
              <input className="input w-28" type="number" min={1} value={entries} onChange={e => setEntries(e.target.value)} />
              <button
                className="btn btn-primary"
                disabled={locked}
                onClick={async () => {
                  const r = await fetch(`/api/giveaways/${giveaway.id}/enter`, {
                    method: 'POST',
                    headers: { 'content-type':'application/json' },
                    body: JSON.stringify({ entries }),
                  });
                  const j = await r.json();
                  if (j.error) alert(j.error);
                  else window.location.reload();
                }}
              >
                Enter
              </button>
              {locked ? <span className="badge">Locked</span> : <span className="badge border-emerald-700 text-emerald-200">Open</span>}
            </>
          ) : (
            <a href="/auth/steam" className="btn btn-primary">Sign in to enter</a>
          )}
        </div>

        <div className="mt-6 text-xs text-zinc-500">
          <div className="font-semibold text-zinc-300 mb-1">Rules template</div>
          <ul className="list-disc pl-5 space-y-1">
            <li>One or more winners selected after the end time.</li>
            <li>Eligibility, regions, and age requirements should be listed clearly.</li>
            <li>No purchase necessary. Donations and ads do not change odds.</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}
