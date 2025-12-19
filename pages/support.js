import Layout from '../components/Layout';
import { getMe } from '../lib/getMe';

export async function getServerSideProps(ctx) {
  const me = getMe(ctx);
  return { props: { me } };
}

export default function Support({ me }) {
  return (
    <Layout me={me} title="Support case-bros">
      <div className="card">
        <div className="font-semibold">Donations</div>
        <div className="small mt-2 space-y-2">
          <div>
            Donations help pay for hosting and prize budgets.
            <span className="text-zinc-200 font-semibold"> Donations never affect odds, gems, or giveaway chances.</span>
          </div>
          <div className="text-zinc-400 text-sm">
            Add your donation links here (PayPal, Ko-fi, Patreon, etc.). Example:
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>PayPal: YOUR_LINK</li>
              <li>Ko-fi: YOUR_LINK</li>
              <li>Patreon: YOUR_LINK</li>
            </ul>
          </div>

          <div className="mt-4 text-xs text-zinc-500">
            If you run real giveaways, publish official rules and eligibility restrictions for your region(s).
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <div className="font-semibold">Ads</div>
        <div className="small mt-2">
          Replace the “Ad slot” component(s) on the site with your ad network code. If you use ad-reward systems, do not tie ads to increased giveaway odds.
        </div>
      </div>
    </Layout>
  );
}
