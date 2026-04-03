import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthProvider } from '../auth/AuthProvider';
import { loginOrRegisterDevAccount, logoutDevSession, registerDevAccount } from '../auth/DevAuthProvider';
import {
  beginOidcLogin,
  beginOidcLogout,
  beginOidcRegistration,
} from '../auth/OidcAuthProvider';
import { ButtonLink } from '../components/ButtonLink';
import { Panel } from '../components/Panel';
import { logWebFlow, summarizeError } from '../logging/flowLog';

export function LoginPage() {
  const auth = useAuthProvider();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busyAction, setBusyAction] = useState<'login' | 'register' | 'logout' | null>(null);
  const isOidcAuthenticated = auth.mode === 'oidc' && auth.isAuthenticated;
  const noticeClassName = useMemo(() => `c-note ${error ? 'c-note--error' : 'c-note--info'}`, [error]);

  return (
    <div className="l-page">
      <Panel title="Account" subtitle="OIDC login, registration, and logout entry points.">
        <div className={noticeClassName} role="note" aria-live="polite">
          <span className="t-small">
            {error ??
              (auth.mode === 'oidc'
                ? isOidcAuthenticated
                  ? 'Authenticated with OIDC.'
                  : 'Sign in or create an account with the configured OIDC provider.'
                : `Dev auth enabled as ${auth.actorId}. Restart dev with RUN_DEV_ACTOR_ID to switch actors.`)}
          </span>
        </div>

        {auth.mode === 'oidc' ? (
          <div className="l-col">
            <div className="l-row">
              <button className="c-btn" type="button" disabled={busyAction !== null} onClick={() => void handleLogin()}>
                {busyAction === 'login' ? 'Redirecting...' : 'Sign In'}
              </button>
              <button className="c-btn" type="button" disabled={busyAction !== null} onClick={() => void handleRegister()}>
                {busyAction === 'register' ? 'Redirecting...' : 'Create Account'}
              </button>
              <button className="c-btn" type="button" disabled={busyAction !== null || !isOidcAuthenticated} onClick={() => void handleLogout()}>
                {busyAction === 'logout' ? 'Signing Out...' : 'Sign Out'}
              </button>
            </div>
            <div className="l-row">
              <ButtonLink to="/">Home</ButtonLink>
            </div>
          </div>
        ) : (
          <div className="l-col">
            <div className="c-note c-note--info">
              <span className="t-small">Built-in test accounts: `player-aaa` / `player1234`, `gm-zzz` / `gm1234`.</span>
            </div>
            <label className="c-field l-col">
              <span className="c-field__label">Username</span>
              <input className="c-field__control" value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <label className="c-field l-col">
              <span className="c-field__label">Password</span>
              <input
                className="c-field__control"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <div className="l-row">
              <button className="c-btn" type="button" disabled={busyAction !== null} onClick={() => void handleDevRegister()}>
                {busyAction === 'register' ? 'Registering...' : 'Register'}
              </button>
              <button className="c-btn" type="button" disabled={busyAction !== null} onClick={() => void handleDevLogin()}>
                {busyAction === 'login' ? 'Signing In...' : 'Login'}
              </button>
              <button
                className="c-btn"
                type="button"
                disabled={busyAction !== null || !auth.isAuthenticated}
                onClick={() => void handleDevLogout()}
              >
                {busyAction === 'logout' ? 'Signing Out...' : 'Logout'}
              </button>
            </div>
            {auth.isAuthenticated ? (
              <div className="l-row">
                <ButtonLink to="/">Home</ButtonLink>
              </div>
            ) : null}
          </div>
        )}
      </Panel>
    </div>
  );

  async function handleLogin() {
    await perform('login', async () => {
      await beginOidcLogin('/');
    });
  }

  async function handleRegister() {
    await perform('register', async () => {
      beginOidcRegistration('/');
    });
  }

  async function handleLogout() {
    await perform('logout', async () => {
      beginOidcLogout('/');
    });
  }

  async function handleDevRegister() {
    await perform('register', async () => {
      await registerDevAccount(username, password);
      navigate('/', { replace: true });
    });
  }

  async function handleDevLogin() {
    await perform('login', async () => {
      await loginOrRegisterDevAccount(username, password);
      navigate('/', { replace: true });
    });
  }

  async function handleDevLogout() {
    await perform('logout', async () => {
      logoutDevSession();
      navigate('/login', { replace: true });
    });
  }

  async function perform(action: 'login' | 'register' | 'logout', work: () => Promise<void> | void) {
    setError(null);
    setBusyAction(action);
    logWebFlow(`WEB_ACCOUNT_${action.toUpperCase()}_START`, {
      authMode: auth.mode,
      actorId: auth.actorId,
    });
    try {
      await work();
    } catch (actionError) {
      setBusyAction(null);
      setError(actionError instanceof Error ? actionError.message : String(actionError));
      logWebFlow(`WEB_ACCOUNT_${action.toUpperCase()}_FAILED`, {
        authMode: auth.mode,
        actorId: auth.actorId,
        ...summarizeError(actionError),
      });
    }
  }
}
