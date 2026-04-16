import { CommandStatusPanel } from './CommandStatusPanel';
import type { RecentCommandStatusEntry } from '../data/gmControlModel';
import type { CommandStatusViewModel } from '../hooks/useCommandStatus';

interface GameplayCommandStatusPanelProps {
  status: CommandStatusViewModel;
  history: RecentCommandStatusEntry[];
}

export function GameplayCommandStatusPanel({ status, history }: GameplayCommandStatusPanelProps) {
  return (
    <section className="c-gm-utility c-gm-command-status" aria-label="Command status panel">
      <div className="l-row">
        <h3 className="t-h4">Command Status</h3>
      </div>
      <CommandStatusPanel status={status} />
      <div className="l-col l-tight">
        <h4 className="t-h4">Recent Commands</h4>
        <ol className="c-gm-command-status__history">
          {history.length === 0 ? (
            <li className="c-gameplay-feed__empty t-small">No recent terminal commands in this page session.</li>
          ) : (
            history.map((entry) => (
              <li key={`${entry.commandId}:${entry.capturedAt}`} className="c-gameplay-feed__item">
                <div className="c-gameplay-feed__meta t-small">
                  <span>{formatTimestamp(entry.capturedAt)}</span>
                  <span>{entry.state}</span>
                </div>
                <div className="t-small">{entry.message}</div>
                {entry.errorCode ? <div className="t-small">errorCode: {entry.errorCode}</div> : null}
              </li>
            ))
          )}
        </ol>
      </div>
    </section>
  );
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}
