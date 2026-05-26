import { Link, useLocation } from 'react-router-dom';
import styles from './InboxModeTabs.module.css';

interface InboxModeTabsProps {
  playerInboxTo?: string;
  gmInboxTo?: string;
}

export function InboxModeTabs({ playerInboxTo = '/inbox?mode=player', gmInboxTo }: InboxModeTabsProps) {
  const location = useLocation();
  const mode = new URLSearchParams(location.search).get('mode');
  const isPlayerTabActive = location.pathname === '/inbox' && mode !== 'gm';
  const isGmTabActive = location.pathname === '/inbox' && mode === 'gm';

  const playerClassName = ['c-btn', 'c-btn--nav', 't-small', isPlayerTabActive ? 'is-active' : '']
    .filter(Boolean)
    .join(' ');
  const gmClassName = ['c-btn', 'c-btn--nav', 't-small', isGmTabActive ? 'is-active' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`l-row ${styles.container}`} role="tablist" aria-label="Inbox tabs">
      <span className={`t-small ${styles.label}`}>Inbox</span>
      <Link className={playerClassName} to={playerInboxTo} role="tab" aria-selected={isPlayerTabActive}>
        Player
      </Link>
      {gmInboxTo ? (
        <Link className={gmClassName} to={gmInboxTo} role="tab" aria-selected={isGmTabActive}>
          GM
        </Link>
      ) : (
        <span className="c-btn c-btn--nav t-small is-disabled" aria-disabled="true">
          GM
        </span>
      )}
    </div>
  );
}
