import type { PropsWithChildren } from "react";
import { NavLink } from "react-router-dom";
import { useAuthProvider } from "../auth/AuthProvider";
import { useGmGames } from "../hooks/useGmGames";
import { useMyProfile } from "../hooks/useMyProfile";

export function AppShell({ children }: PropsWithChildren) {
  const auth = useAuthProvider();
  const { profile, loading: profileLoading } = useMyProfile();
  const { games: gmGames, loading: gmGamesLoading } = useGmGames();
  const roles = new Set(profile?.roles ?? []);
  const canOpenGmGames = auth.isAuthenticated;
  const canOpenAdmin =
    auth.isAuthenticated && !profileLoading && roles.has("ADMIN");
  const firstGmGameId = gmGames[0]?.gameId ?? null;
  const gmInboxDisabled =
    !auth.isAuthenticated || gmGamesLoading || !firstGmGameId;

  return (
    <div className="c-shell l-shell">
      <header className="c-shell__header l-header">
        <div className="l-col l-tight">
          <h1 className="t-h2">Sword Room Online</h1>
          <p className="t-small">Gameplay Loop vertical slice</p>
        </div>
        <nav className="l-row" aria-label="Primary">
          <AppShellNavButton label="Home" to="/" end />
          <AppShellNavButton label="Player Inbox" to="/me/inbox" />
          <AppShellNavButton
            label="GM Games"
            to="/gm/games"
            disabled={!canOpenGmGames}
          />
          <AppShellNavButton
            label="GM Inbox"
            to={
              firstGmGameId
                ? `/gm/${encodeURIComponent(firstGmGameId)}/inbox`
                : undefined
            }
            disabled={gmInboxDisabled}
          />
          <AppShellNavButton
            label="Admin"
            to="/admin"
            disabled={!canOpenAdmin}
          />
          <AppShellNavButton label="Account" to="/login" />
        </nav>
      </header>
      <main className="c-shell__main l-main">{children}</main>
    </div>
  );
}

interface AppShellNavButtonProps {
  label: string;
  to?: string;
  disabled?: boolean;
  end?: boolean;
}

function AppShellNavButton({
  label,
  to,
  disabled = false,
  end = false,
}: AppShellNavButtonProps) {
  if (disabled || !to) {
    return (
      <span
        className="c-btn c-btn--nav t-small is-disabled"
        aria-disabled="true"
      >
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
