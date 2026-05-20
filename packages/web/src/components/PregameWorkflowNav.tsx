import { NavLink } from 'react-router-dom';

interface PregameWorkflowNavProps {
  gameId: string;
  createTo: string;
  sheetTo?: string | null;
  includeInbox?: boolean;
}

export function PregameWorkflowNav({ gameId, createTo, sheetTo = null, includeInbox = true }: PregameWorkflowNavProps) {
  return (
    <nav className="c-pregame-nav" aria-label="Pregame workflow">
      <NavButton label="Lobby" to={`/games/${encodeURIComponent(gameId)}`} end />
      <NavButton label="Create" to={createTo} />
      <NavButton label="Chat" to={`/games/${encodeURIComponent(gameId)}/chat`} />
      <NavButton label="Sheet" to={sheetTo ?? undefined} disabled={sheetTo === null} />
      {includeInbox ? <NavButton label="Inbox" to="/me/inbox" /> : null}
    </nav>
  );
}

interface NavButtonProps {
  label: string;
  to?: string;
  disabled?: boolean;
  end?: boolean;
}

function NavButton({ label, to, disabled = false, end = false }: NavButtonProps) {
  if (disabled || !to) {
    return (
      <span className="c-btn c-btn--nav t-small is-disabled" role="link" aria-disabled="true" tabIndex={-1}>
        {label}
      </span>
    );
  }

  return (
    <NavLink className="c-btn c-btn--nav t-small" to={to} end={end}>
      {label}
    </NavLink>
  );
}
