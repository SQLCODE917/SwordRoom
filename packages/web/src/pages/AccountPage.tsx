import { useAuthProvider } from '../auth/AuthProvider';
import { Panel } from '../components/Panel';
import { useMyProfile } from '../hooks/useMyProfile';

export function AccountPage() {
  const auth = useAuthProvider();
  const { profile, loading, error } = useMyProfile();

  const profileName = profile?.displayName ?? profile?.playerId ?? auth.actorId;

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
      </Panel>
    </div>
  );
}

