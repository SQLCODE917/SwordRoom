import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthProvider } from '../auth/AuthProvider';
import { ButtonLink } from '../components/ButtonLink';
import { Panel } from '../components/Panel';

export function LoginPage() {
  const auth = useAuthProvider();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const isOidcAuthenticated = auth.mode === 'oidc' && auth.isAuthenticated;
  const noticeClassName = useMemo(
    () => `c-note ${auth.errorMessage ? 'c-note--error' : 'c-note--info'}`,
    [auth.errorMessage]
  );
  const busyAction = auth.pendingAction;

  return (
    <div className="l-page">
      <Panel title="Account" subtitle="OIDC login, registration, and logout entry points.">
        <div className={noticeClassName} role="note" aria-live="polite">
          <span className="t-small">
            {auth.errorMessage ??
              (auth.mode === 'oidc'
                ? isOidcAuthenticated
                  ? 'Authenticated with OIDC.'
                  : 'Sign in or create an account with the configured OIDC provider.'
                : auth.isAuthenticated
                  ? `Dev auth enabled as ${auth.actorId}. Restart dev with RUN_DEV_ACTOR_ID to switch actors.`
                  : 'Sign in with a local dev account or register a new one.')}
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
              <input
                className="c-field__control"
                value={username}
                onChange={(event) => {
                  if (auth.errorMessage) {
                    auth.clearError();
                  }
                  setUsername(event.target.value);
                }}
              />
            </label>
            <label className="c-field l-col">
              <span className="c-field__label">Password</span>
              <input
                className="c-field__control"
                type="password"
                value={password}
                onChange={(event) => {
                  if (auth.errorMessage) {
                    auth.clearError();
                  }
                  setPassword(event.target.value);
                }}
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
    await followAuthAction(() => auth.login({ returnToPath: '/' }));
  }

  async function handleRegister() {
    await followAuthAction(() => auth.register({ returnToPath: '/' }));
  }

  async function handleLogout() {
    await followAuthAction(() => auth.logout({ returnToPath: '/login' }));
  }

  async function handleDevRegister() {
    await followAuthAction(() => auth.register({ username, password, returnToPath: '/' }));
  }

  async function handleDevLogin() {
    await followAuthAction(() => auth.login({ username, password, returnToPath: '/' }));
  }

  async function handleDevLogout() {
    await followAuthAction(() => auth.logout({ returnToPath: '/login' }));
  }

  async function followAuthAction(work: () => ReturnType<typeof auth.login>) {
    const result = await work();
    if (result.ok && result.redirectTo) {
      navigate(result.redirectTo, { replace: true });
    }
  }
}
