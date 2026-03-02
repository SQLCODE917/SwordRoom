import { Panel } from '../components/Panel';

export function LoginPage() {
  return (
    <div className="l-page">
      <Panel
        title="Login"
        subtitle="OIDC login entry page."
        footer={<span className="t-small">Visible in all modes; active flow added in OIDC ticket.</span>}
      >
        <div className="c-placeholder t-body">Login placeholder panel.</div>
      </Panel>
    </div>
  );
}
