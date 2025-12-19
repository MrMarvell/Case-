import Layout from '../components/Layout';
import { getMe } from '../lib/getMe';

export async function getServerSideProps(ctx) {
  const me = getMe(ctx);
  return { props: { me } };
}

export default function Rules({ me }) {
  return (
    <Layout me={me} title="Rules & Safety">
      <div className="card space-y-3">
        <div className="font-semibold">Simulation only</div>
        <p className="small">
          case-bros is a case-opening <span className="text-zinc-100 font-semibold">simulation</span>.
          Gems have <span className="text-zinc-100 font-semibold">no cash value</span>, are not purchasable,
          and are not transferable.
        </p>

        <div className="font-semibold">Giveaways</div>
        <p className="small">
          If you run real giveaways, publish official rules (eligibility, age, region restrictions, start/end times,
          selection method, and prize delivery). Do not tie ads or donations to better odds or extra entries.
        </p>

        <div className="font-semibold">Steam</div>
        <p className="small">
          Steam login is used only for account identity. This template does <span className="text-zinc-100 font-semibold">not</span>
          automate Steam item trading or skin payouts.
        </p>

        <div className="font-semibold">Anti-bot</div>
        <p className="small">
          Production sites should add: rate limits, CAPTCHA, device fingerprinting (optional), and moderation tools.
        </p>
      </div>
    </Layout>
  );
}
