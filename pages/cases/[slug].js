import { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '../../components/Layout';

function Gem({ className = "h-4 w-4" }) {
  return <img src="/icons/gem.svg" alt="gems" className={className} />;
}

function rarityBorder(rarity) {
  switch (rarity) {
    case 'Mil-Spec': return 'border-blue-500/40';
    case 'Restricted': return 'border-purple-500/40';
    case 'Classified': return 'border-pink-500/40';
    case 'Covert': return 'border-red-500/40';
    case 'Extraordinary': return 'border-amber-500/40';
    default: return 'border-zinc-700';
  }
}

export default function CasePage({ slug, me }) {
  const [meState, setMeState] = useState(me);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [caseData, setCaseData] = useState(null);
  const [state, setState] = useState(null);

  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState(null);

  // Rolling animation state
  const rollRef = useRef(null);
  const [rollItems, setRollItems] = useState([]);
  const [rollTransformPx, setRollTransformPx] = useState(0);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [cRes, sRes] = await Promise.all([
          fetch(`/api/cases/${encodeURIComponent(slug)}`),
          fetch(`/api/state`),
        ]);
        const cJson = await cRes.json();
        const sJson = await sRes.json();
        if (!cRes.ok) throw new Error(cJson?.error || 'failed_to_load_case');
        if (!cancelled) {
          setCaseData(cJson);
          setState(sJson);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(String(e.message || e));
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [slug]);

  // Keep nav gems in sync
  useEffect(() => {
    if (state?.me) setMeState(state.me);
  }, [state?.me]);

  const isBroken = useMemo(() => {
    if (!caseData || !state?.events?.broken_case) return false;
    return state.events.broken_case.case_id === caseData.id;
  }, [caseData, state]);

  const boostActive = !!state?.events?.bros_boost;

  function buildRollStrip(winItem) {
    const pool = (caseData?.items || []).length ? caseData.items : [];
    const fallback = {
      name: '???', rarity: 'Mil-Spec', image_url: null, price_gems: '0.00',
    };
    const pick = () => {
      if (!pool.length) return fallback;
      return pool[Math.floor(Math.random() * pool.length)];
    };

    const stripLen = 48;
    const stopIndex = 36;
    const strip = Array.from({ length: stripLen }, () => ({ ...pick() }));
    strip[stopIndex] = {
      id: winItem.id,
      name: winItem.name,
      rarity: winItem.rarity,
      image_url: winItem.image_url,
      price_gems: winItem.price_gems,
    };
    return { strip, stopIndex };
  }

  async function onOpen() {
    try {
      setOpening(true);
      setError(null);
      setResult(null);
      setRolling(false);
      setRollItems([]);
      setRollTransformPx(0);

      const r = await fetch('/api/open', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'open_failed');

      // Update header gems immediately
      if (meState) setMeState({ ...meState, gems: j.balance_gems });

      // Build and run rolling animation
      const { strip, stopIndex } = buildRollStrip(j.item);
      setRollItems(strip);
      setRolling(true);

      // Wait for DOM paint
      setTimeout(() => {
        const cardW = 152; // includes gap; keep in sync with CSS
        const containerW = rollRef.current?.clientWidth || 720;
        const centerOffset = (containerW / 2) - (cardW / 2);
        const endX = (stopIndex * cardW) - centerOffset;
        setRollTransformPx(endX);
      }, 60);

      setTimeout(() => {
        setRolling(false);
        setResult(j);
      }, 5200);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setOpening(false);
    }
  }

  return (
    <Layout title={caseData ? caseData.name : 'Case'} me={meState}>
      {loading ? (
        <div className="card">Loading case...</div>
      ) : error ? (
        <div className="card border border-red-900/40 bg-red-950/40">
          <div className="font-semibold">Error</div>
          <div className="small mt-1">{error}</div>
        </div>
      ) : (
        <div className="grid gap-6">
          <div className="card flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-4">
              {caseData?.image_url ? (
                <img alt={caseData.name} src={caseData.image_url} className="h-16 w-16 object-contain" />
              ) : (
                <div className="h-16 w-16 rounded-xl border border-zinc-800 bg-zinc-900" />
              )}
              <div>
                <div className="text-xl font-semibold">{caseData.name}</div>
                <div className="text-sm text-zinc-300 flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1">
                    <Gem /> {caseData.case_price_gems}
                  </span>
                  <span className="text-zinc-500">+</span>
                  <span className="inline-flex items-center gap-1">
                    <Gem /> {caseData.key_price_gems} <span className="text-zinc-500">(key)</span>
                  </span>
                </div>
                <div className="text-xs text-zinc-400 mt-2">
                  Prices/images are pulled from the Steam Community Market (USD) and cached every 3 hours.
                </div>
              </div>
            </div>

            <div className="sm:ml-auto flex flex-col gap-2">
              {isBroken ? (
                <div className="badge border-amber-500/40 bg-amber-950/30">Broken Case Hour active</div>
              ) : null}
              {boostActive ? (
                <div className="badge border-emerald-500/40 bg-emerald-950/30">Bro Boost active</div>
              ) : null}
              <button className="btn btn-primary" onClick={onOpen} disabled={!meState || opening || rolling}>
                {meState ? (opening ? 'Opening...' : (rolling ? 'Rolling...' : 'Open case')) : 'Sign in with Steam'}
              </button>
            </div>
          </div>

          {/* Rolling window */}
          <div className="card">
            <div className="text-sm text-zinc-300 mb-3">Roll</div>
            <div ref={rollRef} className="roll-window">
              <div className="roll-pointer" />
              <div
                className={`roll-strip ${rolling ? 'rolling' : ''}`}
                style={{ transform: `translate3d(-${rollTransformPx}px, 0, 0)` }}
              >
                {rollItems.length ? rollItems.map((it, idx) => (
                  <div key={idx} className={`roll-card ${rarityBorder(it.rarity)}`}>
                    <div className="roll-img">
                      {it.image_url ? <img alt={it.name} src={it.image_url} /> : null}
                    </div>
                    <div className="roll-name" title={it.name}>{it.name}</div>
                  </div>
                )) : (
                  <div className="text-zinc-400 text-sm">Click “Open case” to roll.</div>
                )}
              </div>
            </div>
            <div className="text-xs text-zinc-500 mt-3">
              Wear is rolled automatically (Factory New → Battle-Scarred). Final prices reflect the wear tier.
            </div>
          </div>

          {/* Result */}
          {result ? (
            <div className="card">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className={`w-full sm:w-56 rounded-xl border ${rarityBorder(result.item.rarity)} bg-zinc-900/40 p-3`}>
                  <div className="aspect-square rounded-lg bg-zinc-950/40 border border-zinc-800 flex items-center justify-center overflow-hidden">
                    {result.item.image_url ? (
                      <img alt={result.item.name} src={result.item.image_url} className="h-full w-full object-contain" />
                    ) : null}
                  </div>
                  <div className="mt-2 text-sm font-semibold">{result.item.name}</div>
                  <div className="text-xs text-zinc-400 mt-1">{result.item.wear_tier} • float {result.item.wear_float}</div>
                  <div className="text-sm text-zinc-200 mt-2 inline-flex items-center gap-1">
                    <Gem /> {result.item.price_gems}
                  </div>
                </div>

                <div className="flex-1">
                  <div className="h2">Summary</div>
                  <div className="small mt-2">
                    You spent <span className="text-zinc-100 inline-flex items-center gap-1"><Gem /> {result.spent_gems}</span> and earned
                    {' '}<span className="text-zinc-100 inline-flex items-center gap-1"><Gem /> {result.earned_gems}</span>.
                  </div>
                  <div className="small mt-2">
                    Balance: <span className="text-zinc-100 inline-flex items-center gap-1"><Gem /> {result.balance_gems}</span>
                  </div>
                  <div className="small mt-2">
                    Case mastery: level <span className="text-zinc-100">{result.mastery.level}</span> (XP {result.mastery.xp})
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Item list */}
          <div className="card">
            <div className="h2">Items</div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
              {caseData.items.map(it => (
                <div key={it.id} className={`rounded-xl border ${rarityBorder(it.rarity)} bg-zinc-900/40 p-3`}>
                  <div className="aspect-square rounded-lg bg-zinc-950/40 border border-zinc-800 flex items-center justify-center overflow-hidden">
                    {it.image_url ? <img alt={it.name} src={it.image_url} className="h-full w-full object-contain" /> : null}
                  </div>
                  <div className="mt-2 text-sm font-semibold truncate" title={it.name}>{it.name}</div>
                  <div className="text-xs text-zinc-400">{it.rarity}</div>
                  <div className="text-sm mt-1 inline-flex items-center gap-1"><Gem /> {it.price_gems}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export async function getServerSideProps(ctx) {
  // We only SSR the session user (so nav is correct). Case data is fetched from /api to allow live market enrichment.
  const me = ctx.req.user || null;
  return {
    props: {
      slug: ctx.params.slug,
      me,
    },
  };
}
