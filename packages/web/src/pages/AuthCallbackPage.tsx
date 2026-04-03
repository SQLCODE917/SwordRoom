import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createApiClient } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { completeOidcLoginFromCallback } from '../auth/OidcAuthProvider';
import { ButtonLink } from '../components/ButtonLink';
import { Panel } from '../components/Panel';
import { logWebFlow, summarizeError } from '../logging/flowLog';

export function AuthCallbackPage() {
  const auth = useAuthProvider();
  const authMode = auth.mode;
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(true);
  const noticeClassName = useMemo(() => `c-note ${error ? 'c-note--error' : 'c-note--info'}`, [error]);

  useEffect(() => {
    let cancelled = false;
    const api = createApiClient({ auth });

    const complete = async () => {
      if (authMode !== 'oidc') {
        setIsCompleting(false);
        navigate('/', { replace: true });
        return;
      }

      logWebFlow('WEB_AUTH_CALLBACK_START', {
        authMode,
      });
      try {
        const returnToPath = await completeOidcLoginFromCallback(window.location.href);
        await api.syncMyProfile();
        if (cancelled) {
          return;
        }
        logWebFlow('WEB_AUTH_CALLBACK_OK', {
          authMode,
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
          authMode,
          ...summarizeError(callbackError),
        });
      }
    };

    void complete();

    return () => {
      cancelled = true;
    };
  }, [authMode, navigate]);

  return (
    <div className="l-page">
      <Panel title="Auth Callback" subtitle="Completing OIDC sign-in.">
        <div className={noticeClassName} role="note" aria-live="polite">
          <span className="t-small">{error ?? (isCompleting ? 'Finalizing login...' : 'Login complete.')}</span>
        </div>

        <div className="l-row">
          <ButtonLink to="/login">Back to Login</ButtonLink>
          <ButtonLink to="/">Home</ButtonLink>
        </div>
      </Panel>
    </div>
  );
}
