import { useNavigate } from 'react-router-dom';
import { useAuthProvider } from '../auth/AuthProvider';
import { Panel } from '../components/Panel';
import { useMyProfile } from '../hooks/useMyProfile';

export function AccountPage() {
  const auth = useAuthProvider();
  const navigate = useNavigate();
  const { profile, loading, error } = useMyProfile();

  const profileName = profile?.displayName ?? profile?.playerId ?? auth.actorId;
  const logoutLabel =
    auth.pendingAction === 'logout' ? 'Signing Out...' : 'Log out';

  return (
    <div className="l-page">
      <Panel title="Account" subtitle="Your identity and account details.">
        <div className={`c-note ${error ? 'c-note--error' : 'c-note--info'}`}>
          <span className="t-small">{error ?? (loading ? 'Loading account profile...' : `Signed in as ${profileName}.`)}</span>
        </div>

        <h3 className="t-h4">Profile</h3>
        <div className="c-note c-note--info">
          <span className="t-small">
            {loading ? 'Loading profile...' : `${profileName} | ${(profile?.roles ?? []).join(', ') || 'PLAYER'} | ${profile?.email ?? ' '}`}
          </span>
        </div>

        <h3 className="t-h4">Session</h3>
        <div className="l-row">
          <button
            className="c-btn"
            type="button"
            disabled={auth.pendingAction !== null}
            onClick={() => void handleLogout()}
          >
            {logoutLabel}
          </button>
        </div>
      </Panel>
    </div>
  );

  async function handleLogout() {
    const result = await auth.logout({ returnToPath: '/login' });
    if (result.ok && result.redirectTo) {
      navigate(result.redirectTo, { replace: true });
    }
  }
}
