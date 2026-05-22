import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthProvider } from '../auth/AuthProvider';
import { DebugWidget } from './DebugWidget';
import {
  installDebugTelemetryCapture,
  readDebugTelemetryState,
  subscribeDebugTelemetry,
} from '../debug/debugTelemetry';
import { useGmGames } from '../hooks/useGmGames';
import { useMyProfile } from '../hooks/useMyProfile';
import styles from './AppShell.module.css';

export function AppShell({ children }: PropsWithChildren) {
  const auth = useAuthProvider();
  const { profile, loading: profileLoading } = useMyProfile();
  const { games: gmGames, loading: gmGamesLoading } = useGmGames();
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugButtonBottom, setDebugButtonBottom] = useState(0);
  const [debugHasErrors, setDebugHasErrors] = useState(false);
  const debugButtonRef = useRef<HTMLButtonElement | null>(null);
  const roles = new Set(profile?.roles ?? []);
  const canOpenGmGames = auth.isAuthenticated;
  const canOpenAdmin =
    auth.isAuthenticated && !profileLoading && roles.has('ADMIN');
  const firstGmGameId = gmGames[0]?.gameId ?? null;
  const gmInboxDisabled =
    !auth.isAuthenticated || gmGamesLoading || !firstGmGameId;
  const debugButtonState = useMemo(() => {
    if (debugOpen) {
      return 'active';
    }
    if (debugHasErrors) {
      return 'error';
    }
    return 'default';
  }, [debugHasErrors, debugOpen]);

  useEffect(() => installDebugTelemetryCapture(), []);

  useEffect(() => {
    const initialState = readDebugTelemetryState();
    setDebugHasErrors(initialState.logs.some((entry) => entry.level === 'error'));
    return subscribeDebugTelemetry(() => {
      const nextState = readDebugTelemetryState();
      setDebugHasErrors(nextState.logs.some((entry) => entry.level === 'error'));
    });
  }, []);

  useEffect(() => {
    if (!debugOpen) {
      return;
    }
    const updateDebugButtonBottom = () => {
      const node = debugButtonRef.current;
      if (!node) {
        return;
      }
      const rect = node.getBoundingClientRect();
      setDebugButtonBottom(Math.ceil(rect.bottom));
    };

    updateDebugButtonBottom();
    window.addEventListener('resize', updateDebugButtonBottom);
    window.addEventListener('scroll', updateDebugButtonBottom, true);
    return () => {
      window.removeEventListener('resize', updateDebugButtonBottom);
      window.removeEventListener('scroll', updateDebugButtonBottom, true);
    };
  }, [debugOpen]);

  return (
    <div className="c-shell l-shell">
      <header className="c-shell__header l-header">
        <div className={`${styles.headerBrand} l-tight`}>
          <div className={styles.headerTitleColumn}>
            <h1 className="t-h2">Sword Room Online</h1>
            <p className="t-small">The Pregame Release</p>
          </div>
          <div className={styles.headerDebugColumn}>
            <DebugToggleButton
              ref={debugButtonRef}
              state={debugButtonState}
              onClick={() => setDebugOpen((current) => !current)}
            />
          </div>
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
          <AppShellNavButton label="Account" to="/account" />
        </nav>
      </header>
      {debugOpen ? (
        <DebugWidget
          panelTopPx={debugButtonBottom}
          onClose={() => setDebugOpen(false)}
        />
      ) : null}
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

interface DebugToggleButtonProps {
  state: 'default' | 'active' | 'disabled' | 'error';
  onClick: () => void;
}

const DebugToggleButton = forwardRef<HTMLButtonElement, DebugToggleButtonProps>(
  function DebugToggleButton({ state, onClick }, ref) {
    const className = [
      'c-btn',
      styles.debugButton,
      state === 'active' ? 'is-active' : '',
      state === 'disabled' ? 'is-disabled' : '',
      state === 'error' ? 'is-error' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        type="button"
        className={className}
        aria-label="Toggle debug widget"
        aria-pressed={state === 'active'}
        disabled={state === 'disabled'}
        onClick={onClick}
      >
        <svg
          className={styles.debugButtonIcon}
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M9 7L4 12L9 17" />
          <path d="M15 7L20 12L15 17" />
        </svg>
      </button>
    );
  },
);
