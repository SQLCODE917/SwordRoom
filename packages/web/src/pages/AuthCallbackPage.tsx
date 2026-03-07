import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthProvider } from '../auth/AuthProvider';
import { completeOidcLoginFromCallback } from '../auth/OidcAuthProvider';
import { Panel } from '../components/Panel';

export function AuthCallbackPage() {
  const auth = useAuthProvider();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(true);
  const noticeClassName = useMemo(() => `c-note ${error ? 'c-note--error' : 'c-note--info'}`, [error]);

  useEffect(() => {
    let cancelled = false;

    const complete = async () => {
      if (auth.mode !== 'oidc') {
        setIsCompleting(false);
        navigate('/', { replace: true });
        return;
      }

      try {
        const returnToPath = await completeOidcLoginFromCallback(window.location.href);
        if (cancelled) {
          return;
        }
        navigate(returnToPath, { replace: true });
      } catch (callbackError) {
        if (cancelled) {
          return;
        }
        setError(callbackError instanceof Error ? callbackError.message : String(callbackError));
        setIsCompleting(false);
      }
    };

    void complete();

    return () => {
      cancelled = true;
    };
  }, [auth.mode, navigate]);

  return (
    <div className="l-page">
      <Panel title="Auth Callback" subtitle="Completing OIDC sign-in.">
        <div className={noticeClassName} role="note" aria-live="polite">
          <span className="t-small">{error ?? (isCompleting ? 'Finalizing login...' : 'Login complete.')}</span>
        </div>

        <div className="l-row">
          <Link className="c-btn" to="/login">
            Back to Login
          </Link>
          <Link className="c-btn" to="/">
            Home
          </Link>
        </div>
      </Panel>
    </div>
  );
}
