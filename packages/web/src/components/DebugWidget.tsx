import { useMemo, useState, type CSSProperties } from 'react';
import { useSyncExternalStore } from 'react';
import {
  readDebugTelemetryState,
  subscribeDebugTelemetry,
  type DebugLogEntry,
} from '../debug/debugTelemetry';
import styles from './DebugWidget.module.css';

interface DebugWidgetProps {
  panelTopPx: number;
  onClose: () => void;
}

type LogFilter = 'all' | 'errors';

export function DebugWidget({ panelTopPx, onClose }: DebugWidgetProps) {
  const telemetry = useSyncExternalStore(
    subscribeDebugTelemetry,
    readDebugTelemetryState,
    readDebugTelemetryState,
  );
  const [filter, setFilter] = useState<LogFilter>('all');
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'failed'>('idle');

  const traceId = useMemo(() => {
    const root = readXrayRoot(telemetry.trace.latestXrayTraceHeader);
    return [
      `clientSessionId=${telemetry.trace.clientSessionId ?? 'none'}`,
      `latestClientRequestId=${telemetry.trace.latestClientRequestId ?? 'none'}`,
      `xrayRoot=${root ?? 'none'}`,
    ].join(' | ');
  }, [telemetry.trace]);

  const filteredLogs = useMemo(
    () =>
      telemetry.logs.filter((entry) =>
        filter === 'all' ? true : entry.level === 'error',
      ),
    [filter, telemetry.logs],
  );

  const commandLogs = filteredLogs.filter(
    (entry) => entry.category === 'command-status',
  );
  const statusRegionLogs = filteredLogs.filter(
    (entry) => entry.category === 'status-region',
  );
  const networkLogs = filteredLogs.filter((entry) => entry.category === 'network');
  const consoleLogs = filteredLogs.filter(
    (entry) => entry.category === 'console-error',
  );

  const panelStyle: CSSProperties = {
    top: `${panelTopPx}px`,
  };
  const clickAwayStyle: CSSProperties = {
    height: `${Math.max(0, panelTopPx)}px`,
  };

  async function copyTraceId() {
    try {
      await navigator.clipboard.writeText(traceId);
      setCopyState('ok');
    } catch {
      setCopyState('failed');
    }
  }

  return (
    <div className={styles.overlay} aria-label="Debug widget overlay">
      <button
        type="button"
        aria-label="Close debug widget"
        className={styles.clickAway}
        style={clickAwayStyle}
        onClick={onClose}
      />
      <section
        className={styles.panel}
        style={panelStyle}
        aria-label="Debug widget"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.traceBlock}>
          <h3 className="t-h4">Distributed Trace</h3>
          <div className={styles.traceControls}>
            <input
              className={`c-field__control ${styles.traceInput}`}
              readOnly
              value={traceId}
              aria-label="Distributed trace identifier"
            />
            <button
              type="button"
              className={`c-btn ${copyState === 'failed' ? 'is-error' : ''}`.trim()}
              onClick={() => void copyTraceId()}
            >
              Copy
            </button>
          </div>
          <div className="t-small">
            {copyState === 'ok'
              ? 'Trace copied.'
              : copyState === 'failed'
                ? 'Copy failed. Select and copy manually.'
                : 'Use this ID in bug reports.'}
          </div>
        </div>

        <div className={styles.filterRow} role="group" aria-label="Debug log filter">
          <button
            type="button"
            className={`c-btn ${filter === 'all' ? 'is-active' : ''}`.trim()}
            aria-pressed={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            ALL
          </button>
          <button
            type="button"
            className={`c-btn ${filter === 'errors' ? 'is-active' : ''}`.trim()}
            aria-pressed={filter === 'errors'}
            onClick={() => setFilter('errors')}
          >
            ERRORS ONLY
          </button>
        </div>

        <div className={styles.logView}>
          <LogSection
            title="Command Status"
            entries={commandLogs}
            fallback={
              telemetry.commandStatus
                ? [
                    `state=${telemetry.commandStatus.state}`,
                    `message=${telemetry.commandStatus.message}`,
                    `commandId=${telemetry.commandStatus.commandId ?? 'none'}`,
                    `errorCode=${telemetry.commandStatus.errorCode ?? 'none'}`,
                    `errorMessage=${telemetry.commandStatus.errorMessage ?? 'none'}`,
                  ].join(' | ')
                : 'No command status yet.'
            }
          />
          <LogSection
            title="statusRegion"
            entries={statusRegionLogs}
            fallback={
              telemetry.statusRegion
                ? [
                    `pageStatus=${telemetry.statusRegion.pageStatusText}`,
                    `identity=${telemetry.statusRegion.identityStatusText}`,
                    `error=${telemetry.statusRegion.errorText ?? 'none'}`,
                  ].join(' | ')
                : 'No statusRegion snapshot yet.'
            }
          />
          <LogSection
            title="Network Traffic"
            entries={networkLogs}
            fallback="No network activity captured yet."
          />
          <LogSection
            title="JavaScript Console Errors"
            entries={consoleLogs}
            fallback="No console errors captured yet."
          />
        </div>
      </section>
    </div>
  );
}

function LogSection(input: {
  title: string;
  entries: DebugLogEntry[];
  fallback: string;
}) {
  return (
    <section className={styles.logSection} aria-label={input.title}>
      <h4 className="t-h4">{input.title}</h4>
      {input.entries.length === 0 ? (
        <div className={`c-note c-note--info ${styles.logFallback}`}>
          <span className="t-small">{input.fallback}</span>
        </div>
      ) : (
        <ul className={styles.logList}>
          {input.entries.map((entry) => (
            <li key={entry.id} className={styles.logItem}>
              <div className="t-small">
                [{entry.ts}] {entry.message}
              </div>
              <div className="t-small">{entry.details}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function readXrayRoot(traceHeader: string | null): string | null {
  if (!traceHeader) {
    return null;
  }
  const rootPart = traceHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('Root='));
  if (!rootPart) {
    return null;
  }
  return rootPart.slice('Root='.length) || null;
}
