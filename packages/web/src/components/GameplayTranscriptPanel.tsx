import type { GameplayEventView } from '../api/ApiClient';
import type { GmTranscriptMode } from '../data/gmControlModel';

interface GameplayTranscriptPanelProps {
  transcriptMode: GmTranscriptMode;
  onTranscriptModeChange: (mode: GmTranscriptMode) => void;
  publicEvents: GameplayEventView[];
  gmEvents: GameplayEventView[];
}

export function GameplayTranscriptPanel({
  transcriptMode,
  onTranscriptModeChange,
  publicEvents,
  gmEvents,
}: GameplayTranscriptPanelProps) {
  const events = transcriptMode === 'public' ? publicEvents : gmEvents;

  return (
    <section className="c-gameplay-feed c-gm-utility" aria-label="Transcript view">
      <div className="l-row">
        <h3 className="t-h4">Transcript</h3>
        <div className="c-gm-transcript__toggle" role="tablist" aria-label="Transcript audience">
          <button
            type="button"
            role="tab"
            aria-selected={transcriptMode === 'public'}
            className={`c-gm-transcript__button ${transcriptMode === 'public' ? 'is-active' : ''}`.trim()}
            onClick={() => onTranscriptModeChange('public')}
          >
            Public
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={transcriptMode === 'gm'}
            className={`c-gm-transcript__button ${transcriptMode === 'gm' ? 'is-active' : ''}`.trim()}
            onClick={() => onTranscriptModeChange('gm')}
          >
            GM
          </button>
        </div>
      </div>
      <ol className="c-gameplay-feed__list">
        {events.length === 0 ? (
          <li className="c-gameplay-feed__empty t-small">
            {transcriptMode === 'public' ? 'No public transcript yet.' : 'No GM-only transcript yet.'}
          </li>
        ) : (
          events.map((event) => (
            <li key={event.eventId} className={`c-gameplay-feed__item ${transcriptMode === 'gm' ? 'c-gameplay-feed__item--gm' : ''}`.trim()}>
              <div className="c-gameplay-feed__meta t-small">
                <span>{formatTimestamp(event.createdAt)}</span>
                <span>{event.nodeId}</span>
              </div>
              <div className="c-gameplay-feed__title">{event.title}</div>
              <div className="c-gameplay-feed__body t-small">{event.body}</div>
            </li>
          ))
        )}
      </ol>
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
    hour12: false,
  }).format(date);
}
