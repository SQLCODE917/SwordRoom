import { Panel } from '../components/Panel';

export function CharacterWizardPage() {
  return (
    <div className="l-page">
      <Panel
        title="Character Wizard"
        subtitle="Step-by-step character creation."
        footer={<span className="t-small">Stepper and command actions will be added in next ticket.</span>}
      >
        <div className="c-placeholder t-body">Wizard placeholder panel with reserved command status space.</div>
      </Panel>
    </div>
  );
}
