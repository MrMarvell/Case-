import Nav from './Nav';

export default function Layout({ title, children, me }) {
  return (
    <div className="min-h-screen">
      <Nav me={me} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        {title ? <h1 className="h1 mb-4">{title}</h1> : null}
        {children}
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-10 text-xs text-zinc-400">
        <div className="border-t border-zinc-800 pt-6 flex flex-col gap-2">
          <div>
            <span className="font-semibold text-zinc-200">case-bros</span> is a free-to-play simulation.
            {' '}Gems have no cash value, are not purchasable, and are not transferable.
          </div>
          <div>Donations and ads do not affect odds, gems, or giveaway chances.</div>
          <div className="text-zinc-500">
            This repository is a starter template. If you run real giveaways, publish clear rules and check local laws.
          </div>
        </div>
      </footer>
    </div>
  );
}
