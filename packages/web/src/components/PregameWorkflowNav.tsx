import { NavLink } from 'react-router-dom';

interface PregameWorkflowNavProps {
  gameId: string;
  createTo: string;
  charactersTo?: string;
  includeInbox?: boolean;
}

export function PregameWorkflowNav({
  gameId,
  createTo,
  charactersTo = `/games/${encodeURIComponent(gameId)}/characters`,
  includeInbox = true,
}: PregameWorkflowNavProps) {
  return (
    <nav className="c-pregame-nav" aria-label="Pregame workflow">
      <NavButton label="Lobby" to={`/games/${encodeURIComponent(gameId)}`} end />
      <NavButton label="+ Create Character" to={createTo} />
      <NavButton label="Chat" to={`/games/${encodeURIComponent(gameId)}/chat`} />
      <NavButton label="Characters" to={charactersTo} />
      {includeInbox ? <NavButton label="Inbox" to="/inbox?mode=player" /> : null}
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
