import Layout from '../components/Layout';
import { getMe } from '../lib/getMe';

export async function getServerSideProps(ctx) {
  const me = getMe(ctx);
  const { getLeaderboard } = require('../lib/leaderboard');
  const rows = getLeaderboard(50);
  return { props: { me, rows } };
}

export default function Leaderboard({ me, rows }) {
  return (
    <Layout me={me} title="Leaderboard">
      <div className="card mb-4">
        <div className="font-semibold">💎 Highest Gems</div>
        <div className="small">Top accounts by current gem balance.</div>
      </div>

      <div className="card">
        <div className="grid grid-cols-12 gap-2 text-xs text-zinc-400 border-b border-zinc-800 pb-2">
          <div className="col-span-1">#</div>
          <div className="col-span-7">User</div>
          <div className="col-span-2 text-right">Gems</div>
          <div className="col-span-2 text-right">Opens</div>
        </div>

        <div className="divide-y divide-zinc-800">
          {rows.map(r => (
            <div key={r.steam_id} className="grid grid-cols-12 gap-2 py-3 items-center">
              <div className="col-span-1 text-zinc-400">{r.rank}</div>
              <div className="col-span-7 flex items-center gap-3">
                {r.avatar ? <img alt="avatar" src={r.avatar} className="h-8 w-8 rounded" /> : null}
                <div className="font-medium">{r.display_name}</div>
              </div>
              <div className="col-span-2 text-right font-mono text-zinc-200">{r.gems}</div>
              <div className="col-span-2 text-right text-zinc-300">{r.total_opens}</div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
