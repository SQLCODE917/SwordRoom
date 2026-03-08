import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthProvider } from '../auth/AuthProvider';
import { completeOidcLoginFromCallback } from '../auth/OidcAuthProvider';
import { Panel } from '../components/Panel';
import { logWebFlow, summarizeError } from '../logging/flowLog';

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

      logWebFlow('WEB_AUTH_CALLBACK_START', {
        authMode: auth.mode,
      });
      try {
        const returnToPath = await completeOidcLoginFromCallback(window.location.href);
        if (cancelled) {
          return;
        }
        logWebFlow('WEB_AUTH_CALLBACK_OK', {
          authMode: auth.mode,
          returnToPath,
        });
        navigate(returnToPath, { replace: true });
      } catch (callbackError) {
        if (cancelled) {
          return;
        }
        setError(callbackError instanceof Error ? callbackError.message : String(callbackError));
        setIsCompleting(false);
        logWebFlow('WEB_AUTH_CALLBACK_FAILED', {
          authMode: auth.mode,
          ...summarizeError(callbackError),
        });
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
