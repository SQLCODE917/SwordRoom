import { useMemo } from 'react';
import { CommandStatusPanel } from '../components/CommandStatusPanel';
import { Panel } from '../components/Panel';
import { useCommandStatus } from '../hooks/useCommandStatus';
import { useSubmitCommand } from '../hooks/useSubmitCommand';

export function HomePage() {
  const { submitCommand, lastCommandId, isSubmitting, submitError } = useSubmitCommand();
  const status = useCommandStatus(lastCommandId);
  const noticeClassName = useMemo(
    () => `c-note ${submitError ? 'c-note--error' : 'c-note--info'}`,
    [submitError]
  );

  const onDemoSubmit = async () => {
    try {
      await submitCommand({
        commandId: makeUuid(),
        gameId: 'game-1',
        type: 'CreateCharacterDraft',
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        payload: {
          characterId: 'char-human-1',
          race: 'HUMAN',
          raisedBy: null,
        },
      });
    } catch {
      // submitError state is already set by useSubmitCommand
    }
  };

  return (
    <div className="l-page">
      <Panel
        title="Home"
        subtitle="Choose game and role entry points."
        footer={<span className="t-small">Navigation stays visible at all times.</span>}
      >
        <div className="l-col">
          <div className={noticeClassName} role="note" aria-live="polite">
            <span className="t-small">{submitError ?? 'Submit the demo command to validate API wiring.'}</span>
          </div>
          <button className={`c-btn ${isSubmitting ? 'is-disabled' : ''}`} type="button" disabled={isSubmitting} onClick={onDemoSubmit}>
            {isSubmitting ? 'Submitting...' : 'Submit Demo Command'}
          </button>
          <CommandStatusPanel status={status} />
        </div>
      </Panel>
    </div>
  );
}

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const nowHex = Date.now().toString(16).padStart(12, '0').slice(-12);
  return `00000000-0000-4000-8000-${nowHex}`;
}
