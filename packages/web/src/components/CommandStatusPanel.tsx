import type { CommandStatusViewModel } from '../hooks/useCommandStatus';

interface CommandStatusPanelProps {
  status: CommandStatusViewModel;
}

export function CommandStatusPanel({ status }: CommandStatusPanelProps) {
  const stateClass = status.state === 'Failed' ? 'is-error' : status.state === 'Processed' ? 'is-ok' : '';
  const loadingClass = status.state === 'Queued' || status.state === 'Processing' ? 'is-loading' : '';
  const className = ['c-cmd', stateClass, loadingClass].filter(Boolean).join(' ');

  const message = status.errorMessage
    ? `${status.message} ${status.errorMessage}`
    : status.errorCode
      ? `${status.message} ${status.errorCode}`
      : status.message;

  return (
    <div className={className} role="status" aria-live="polite">
      <div className="c-cmd__state t-small">State: {status.state}</div>
      <div className="c-cmd__msg t-small">{message}</div>
      <div className="c-cmd__spinner t-small">{status.commandId ? `Command: ${status.commandId}` : ' '}</div>
    </div>
  );
}
