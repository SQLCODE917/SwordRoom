import type { GmTimeseriesEntry } from '../data/gmControlModel';
import styles from './GameplayTimeseriesPanel.module.css';

interface GameplayTimeseriesPanelProps {
  events: GmTimeseriesEntry[];
}

export function GameplayTimeseriesPanel({ events }: GameplayTimeseriesPanelProps) {
  return (
    <section className={`c-gameplay-feed ${styles.utility}`} aria-label="Timeseries view">
      <div className="l-row">
        <h3 className="t-h4">Timeseries</h3>
      </div>
      <ol className="c-gameplay-feed__list">
        {events.length === 0 ? (
          <li className="c-gameplay-feed__empty t-small">No gameplay events yet.</li>
        ) : (
          events.map((event) => (
            <li key={`${event.audience}:${event.eventId}`} className="c-gameplay-feed__item">
              <div className="c-gameplay-feed__meta t-small">
                <span>{formatTimestamp(event.createdAt)}</span>
                <span>{event.eventKind}</span>
              </div>
              <div className={styles.badges}>
                <span className={`${styles.badge} ${event.audience === 'PUBLIC' ? styles.badgePublic : styles.badgeGmOnly}`}>
                  {event.audience}
                </span>
                <span className={`${styles.badge} ${styles.badgeNeutral}`}>{event.nodeId}</span>
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
    second: '2-digit',
    hour12: false,
  }).format(date);
}
