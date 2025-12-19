import Layout from '../components/Layout';

export default function NotFound() {
  return (
    <Layout title="Not found">
      <div className="card">
        <div className="font-semibold">404</div>
        <div className="small mt-1">That page doesn't exist.</div>
      </div>
    </Layout>
  );
}
