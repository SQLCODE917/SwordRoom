import { Panel } from '../components/Panel';

export function PlayerInboxPage() {
  return (
    <div className="l-page">
      <Panel
        title="Player Inbox"
        subtitle="Shows character submission and approval messages."
        footer={<span className="t-small">Table placeholder is always mounted.</span>}
      >
        <div className="c-placeholder t-body">Player inbox placeholder panel.</div>
      </Panel>
    </div>
  );
}
