import Link from 'next/link';

function fmtGems(gems) {
  if (gems == null) return '0.00';
  return Number(gems).toFixed(2);
}

export default function Nav({ me }) {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-semibold tracking-tight">case-bros</Link>
          <nav className="hidden md:flex items-center gap-3 text-sm text-zinc-300">
            <Link href="/" className="hover:text-white">Cases</Link>
            <Link href="/giveaways" className="hover:text-white">Giveaways</Link>
            <Link href="/leaderboard" className="hover:text-white">Leaderboard</Link>
            <Link href="/rules" className="hover:text-white">Rules</Link>
            {me?.is_admin ? <Link href="/admin" className="hover:text-white">Admin</Link> : null}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {me ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                {me.avatar ? <img alt="avatar" src={me.avatar} className="h-8 w-8 rounded" /> : null}
                <div className="leading-tight">
                  <div className="text-sm font-medium">{me.display_name}</div>
                  <div className="text-xs text-zinc-400">
                    <span className="inline-flex items-center gap-1">
                      <img src="/icons/gem.svg" alt="gems" className="h-4 w-4" />
                      <span className="font-semibold text-zinc-200">{fmtGems(me.gems)}</span>
                    </span>
                    <span className="mx-2">•</span>
                    Streak: {me.streak_day}d
                  </div>
                </div>
              </div>
              <Link href="/inventory" className="btn">Inventory</Link>
              <a href="/auth/logout" className="btn">Logout</a>
            </div>
          ) : (
            <a href="/auth/steam" className="btn btn-primary">Sign in with Steam</a>
          )}
        </div>
      </div>
    </header>
  );
}
