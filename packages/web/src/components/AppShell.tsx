import type { PropsWithChildren } from 'react';
import { NavLink } from 'react-router-dom';

export function AppShell({ children }: PropsWithChildren) {
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
          <NavLink className="c-navlink t-small" to="/gm/game-1/inbox">
            GM Inbox
          </NavLink>
          <NavLink className="c-navlink t-small" to="/games/game-1/characters/char-human-1">
            Character Sheet
          </NavLink>
          <NavLink className="c-navlink t-small" to="/login">
            Login
          </NavLink>
        </nav>
      </header>
      <main className="c-shell__main l-main">{children}</main>
    </div>
  );
}
