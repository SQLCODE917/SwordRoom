import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthProvider } from '../auth/AuthProvider';
import { beginOidcLogin, hasOidcSession } from '../auth/OidcAuthProvider';
import { Panel } from '../components/Panel';

export function LoginPage() {
  const auth = useAuthProvider();
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const isOidcAuthenticated = useMemo(() => (auth.mode === 'oidc' ? hasOidcSession() : false), [auth.mode]);
  const noticeClassName = useMemo(() => `c-note ${error ? 'c-note--error' : 'c-note--info'}`, [error]);

  const handleLogin = async () => {
    setError(null);
    setIsRedirecting(true);
    try {
      await beginOidcLogin('/');
    } catch (loginError) {
      setIsRedirecting(false);
      setError(loginError instanceof Error ? loginError.message : String(loginError));
    }
  };

  return (
    <div className="l-page">
      <Panel title="Login" subtitle="OIDC login entry.">
        <div className={noticeClassName} role="note" aria-live="polite">
          <span className="t-small">
            {error ??
              (auth.mode === 'oidc'
                ? isOidcAuthenticated
                  ? 'Already authenticated. Continue to the app.'
                  : 'Sign in with Keycloak to call the API.'
                : 'Dev mode enabled. Login is not required.')}
          </span>
        </div>

        {auth.mode === 'oidc' ? (
          <div className="l-row">
            <button
              className={`c-btn ${isRedirecting ? 'is-disabled' : ''}`.trim()}
              type="button"
              onClick={() => void handleLogin()}
              disabled={isRedirecting}
            >
              {isRedirecting ? 'Redirecting...' : 'Sign In'}
            </button>
            <Link className="c-btn" to="/">
              Continue
            </Link>
          </div>
        ) : (
          <div className="l-row">
            <Link className="c-btn" to="/games/game-1/character/new">
              Go to Wizard
            </Link>
          </div>
        )}
      </Panel>
    </div>
  );
}
