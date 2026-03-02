import { Panel } from '../components/Panel';

export function HomePage() {
  return (
    <div className="l-page">
      <Panel
        title="Home"
        subtitle="Choose game and role entry points."
        footer={<span className="t-small">Navigation stays visible at all times.</span>}
      >
        <div className="c-placeholder t-body">Home page placeholder panel.</div>
      </Panel>
    </div>
  );
}
