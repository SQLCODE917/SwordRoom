import type { PropsWithChildren } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthProvider } from '../auth/AuthProvider';
import { useGmGames } from '../hooks/useGmGames';
import { useMyProfile } from '../hooks/useMyProfile';

export function AppShell({ children }: PropsWithChildren) {
  const auth = useAuthProvider();
  const { profile, loading: profileLoading } = useMyProfile();
  const { games: gmGames, loading: gmGamesLoading } = useGmGames();
  const roles = new Set(profile?.roles ?? []);
  const canOpenGmPages = auth.isAuthenticated && !profileLoading && (roles.has('GM') || roles.has('ADMIN'));
  const canOpenAdmin = auth.isAuthenticated && !profileLoading && roles.has('ADMIN');
  const firstGmGameId = gmGames[0]?.gameId ?? null;
  const gmInboxDisabled = !canOpenGmPages || gmGamesLoading || !firstGmGameId;

  return (
    <div className="c-shell l-shell">
      <header className="c-shell__header l-header">
        <div className="l-col l-tight">
          <h1 className="t-h2">Character Creation Vertical Slice</h1>
          <p className="t-small">Local frontend scaffold</p>
        </div>
        <nav className="l-row" aria-label="Primary">
          <NavLink className="c-navlink t-small" to="/">
            Home
          </NavLink>
          <NavLink className="c-navlink t-small" to="/games/game-1/character/new">
            Wizard
          </NavLink>
          <NavLink className="c-navlink t-small" to="/me/inbox">
            Player Inbox
          </NavLink>
          {!canOpenGmPages ? (
            <span className="c-navlink t-small is-disabled" aria-disabled="true">
              GM Games
            </span>
          ) : (
            <NavLink className="c-navlink t-small" to="/gm/games">
              GM Games
            </NavLink>
          )}
          {gmInboxDisabled ? (
            <span className="c-navlink t-small is-disabled" aria-disabled="true">
              GM Inbox
            </span>
          ) : (
            <NavLink className="c-navlink t-small" to={`/gm/${encodeURIComponent(firstGmGameId)}/inbox`}>
              GM Inbox
            </NavLink>
          )}
          {canOpenAdmin ? (
            <NavLink className="c-navlink t-small" to="/admin">
              Admin
            </NavLink>
          ) : (
            <span className="c-navlink t-small is-disabled" aria-disabled="true">
              Admin
            </span>
          )}
          <NavLink className="c-navlink t-small" to="/games/game-1/characters/char-human-1">
            Character Sheet
          </NavLink>
          <NavLink className="c-navlink t-small" to="/login">
            Account
          </NavLink>
        </nav>
      </header>
      <main className="c-shell__main l-main">{children}</main>
    </div>
  );
}
