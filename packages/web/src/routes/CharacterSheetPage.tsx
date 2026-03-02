import { Panel } from '../components/Panel';

export function CharacterSheetPage() {
  return (
    <div className="l-page">
      <Panel
        title="Character Sheet"
        subtitle="Read-only view modeled after the sheet layout contract."
        footer={<span className="t-small">Page tabs and blocks will be implemented in a later ticket.</span>}
      >
        <div className="c-placeholder t-body">Character sheet placeholder panel.</div>
      </Panel>
    </div>
  );
}
