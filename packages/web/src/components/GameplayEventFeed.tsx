import type { GameplayEventView } from '../api/ApiClient';

interface GameplayEventFeedProps {
  title: string;
  events: GameplayEventView[];
  emptyText: string;
  variant?: 'public' | 'gm';
}

export function GameplayEventFeed({
  title,
  events,
  emptyText,
  variant = 'public',
}: GameplayEventFeedProps) {
  return (
    <section className="c-gameplay-feed" aria-label={title}>
      <div className="l-row">
        <h3 className="t-h4">{title}</h3>
      </div>
      <ol className="c-gameplay-feed__list">
        {events.length === 0 ? (
          <li className="c-gameplay-feed__empty t-small">{emptyText}</li>
        ) : (
          events.map((event) => (
            <li key={event.eventId} className={`c-gameplay-feed__item c-gameplay-feed__item--${variant}`}>
              <div className="c-gameplay-feed__meta t-small">
                <span>{formatGameplayTimestamp(event.createdAt)}</span>
                <span>{event.nodeId}</span>
              </div>
              <div className="c-gameplay-feed__title">{event.title}</div>
              <div className="c-gameplay-feed__body t-small">{event.body}</div>
              {Object.keys(event.detail).length > 0 ? (
                <details className="c-gameplay-feed__detail">
                  <summary className="t-small">Details</summary>
                  <pre className="c-gameplay-feed__detail-pre">{JSON.stringify(event.detail, null, 2)}</pre>
                </details>
              ) : null}
            </li>
          ))
        )}
      </ol>
    </section>
  );
}

function formatGameplayTimestamp(value: string): string {
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
