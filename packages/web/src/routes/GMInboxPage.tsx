import { Panel } from '../components/Panel';

export function GMInboxPage() {
  return (
    <div className="l-page">
      <Panel
        title="GM Inbox"
        subtitle="Pending characters and GM decisions."
        footer={<span className="t-small">Approve/reject actions will be added in a later ticket.</span>}
      >
        <div className="c-placeholder t-body">GM inbox placeholder panel.</div>
      </Panel>
    </div>
  );
}
