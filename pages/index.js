import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';

function Gem({ className = "h-4 w-4" }) {
  return <img src="/icons/gem.svg" alt="gems" className={className} />;
}

function badgeClass(isBroken, hasBoost) {
  if (isBroken && hasBoost) return 'badge border-emerald-500/40 bg-emerald-950/30';
  if (isBroken) return 'badge border-amber-500/40 bg-amber-950/30';
  if (hasBoost) return 'badge border-emerald-500/40 bg-emerald-950/30';
  return 'badge border-zinc-700 bg-zinc-900/30';
}

function msUntil(iso) {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, t - Date.now());
}

function fmtCountdown(ms) {
  const s = Math.ceil(ms / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (hh <= 0) return `${mm}m ${ss}s`;
  return `${hh}h ${mm}m`;
}

export default function Home({ me }) {
  const [meState, setMeState] = useState(me);
  const [state, setState] = useState(null);
  const [cases, setCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [caseError, setCaseError] = useState(null);

  // Bonus countdown ticker
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  async function refreshState() {
    const sRes = await fetch('/api/state');
    const sJson = await sRes.json();
    setState(sJson);
    if (sJson?.me) setMeState(sJson.me);
    return sJson;
  }

  async function refreshCases({ silent = false } = {}) {
    if (!silent) setLoadingCases(true);
    setCaseError(null);
    try {
      const cRes = await fetch('/api/cases');
      const cJson = await cRes.json();
      if (!cRes.ok) throw new Error(cJson?.error || 'failed_to_load_cases');
      setCases(cJson);
    } catch (e) {
      setCaseError(String(e.message || e));
    } finally {
      if (!silent) setLoadingCases(false);
    }
  }

  async function refresh() {
    await refreshState();
    await refreshCases();
  }

  useEffect(() => {
    let alive = true;
    refresh();

    // Steam market cache warms up in the background on a cold start.
    // Do a couple of silent re-fetches so prices/images “snap in” without the user needing to click refresh.
    const t1 = setTimeout(() => { if (alive) refreshCases({ silent: true }); }, 1500);
    const t2 = setTimeout(() => { if (alive) refreshCases({ silent: true }); }, 4500);
    const t3 = setTimeout(() => { if (alive) refreshCases({ silent: true }); }, 9000);

    return () => {
      alive = false;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const brokenCaseId = state?.events?.broken_case?.case_id;
  const boostActive = !!state?.events?.bros_boost;
  const bonus = state?.bonus;
  const bonusRemainingMs = useMemo(() => msUntil(bonus?.next_claim_at), [bonus?.next_claim_at, tick]);

  async function claimBonus() {
    try {
      const r = await fetch('/api/bonus/claim', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'bonus_failed');
      await refresh();
    } catch (e) {
      // show an inline error by reusing caseError
      setCaseError(String(e.message || e));
    }
  }

  return (
    <Layout title="case-bros" me={meState}>
      <div className="grid gap-6">
        <div className="card">
          <div className="text-2xl font-semibold">case-bros</div>
          <div className="text-zinc-300 mt-2">
            Free, simulation-only CS2-style case openings. Earn <span className="inline-flex items-center gap-1"><Gem /> gems</span> from luck,
            level up case mastery, and use gems as entries for giveaways.
          </div>
          <div className="grid md:grid-cols-3 gap-3 mt-5">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="font-semibold">Case Mastery</div>
              <div className="small mt-1">Open a case to gain XP and boost gem earnings slightly over time.</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="font-semibold">Broken Case Hour</div>
              <div className="small mt-1">Limited-time boosted rare odds + a small discount on one featured case.</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="font-semibold">Progressive Pools</div>
              <div className="small mt-1">Community spend grows the giveaway pool tier (better tiers unlock better giveaways).</div>
            </div>
          </div>
        </div>

        {/* Bonus faucet */}
        <div className="card flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <div className="font-semibold">Bro Bonus</div>
            <div className="small mt-1">Claim a small amount of gems every 3 hours. Not huge — just a steady drip.</div>
          </div>

          {meState ? (
            <div className="flex items-center gap-3">
              {bonus?.can_claim ? (
                <button className="btn btn-primary" onClick={claimBonus}>Claim</button>
              ) : (
                <div className="small text-zinc-300">
                  Next claim in <span className="text-zinc-100 font-semibold">{fmtCountdown(bonusRemainingMs)}</span>
                </div>
              )}
              <Link href="/giveaways" className="btn">Giveaways</Link>
            </div>
          ) : (
            <a href="/auth/steam" className="btn btn-primary">Sign in to claim</a>
          )}
        </div>

        {/* Pool summary */}
        {state?.pool ? (
          <div className="card">
            <div className="font-semibold">Giveaway Pool</div>
            <div className="small mt-1">Tier: <span className="text-zinc-100 font-semibold">{state.pool.tier_name}</span></div>
          </div>
        ) : null}

        {/* Cases */}
        <div className="card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="h2">Cases</div>
              <div className="small mt-1">Live USD prices + item icons are cached every 3 hours.</div>
            </div>
            <button className="btn" onClick={refresh} disabled={loadingCases}>Refresh</button>
          </div>

          {caseError ? (
            <div className="mt-4 rounded-xl border border-red-900/40 bg-red-950/40 p-3 small">{caseError}</div>
          ) : null}

          {loadingCases ? (
            <div className="mt-4 small text-zinc-400">Loading cases…</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
              {cases.map(c => {
                const isBroken = brokenCaseId === c.id;
                return (
                  <Link key={c.id} href={`/cases/${c.slug}`} className="case-card">
                    <div className="case-card__top">
                      {c.image_url ? (
                        <img alt={c.name} src={c.image_url} className="case-card__img" />
                      ) : (
                        <div className="case-card__img placeholder" />
                      )}
                    </div>
                    <div className="case-card__name">{c.name}</div>
                    <div className="case-card__meta">
                      <span className="inline-flex items-center gap-1"><Gem className="h-4 w-4" /> {c.case_price_gems}</span>
                      <span className="text-zinc-600">+</span>
                      <span className="inline-flex items-center gap-1"><Gem className="h-4 w-4" /> {c.key_price_gems}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={badgeClass(isBroken, boostActive)}>
                        {isBroken ? 'Broken' : (boostActive ? 'Boost' : 'Live')}
                      </span>
                      {c.mastery ? (
                        <span className="small text-zinc-400">Lv {c.mastery.level}</span>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps(ctx) {
  // SSR only the session user; all “live” data comes from /api for market enrichment.
  return { props: { me: ctx.req.user || null } };
}
