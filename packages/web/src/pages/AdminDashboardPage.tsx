import { useEffect, useMemo, useState } from 'react';
import { createApiClient, type GameItem, type PlayerProfile } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { Panel } from '../components/Panel';
import { logWebFlow, summarizeError } from '../logging/flowLog';

export function AdminDashboardPage() {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const [users, setUsers] = useState<PlayerProfile[]>([]);
  const [games, setGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [nextUsers, nextGames] = await Promise.all([api.getAdminUsers(), api.getAdminGames()]);
        if (cancelled) {
          return;
        }
        setUsers(nextUsers);
        setGames(nextGames);
        setError(null);
        logWebFlow('WEB_ADMIN_DASHBOARD_LOAD_OK', {
          actorId: auth.actorId,
          authMode: auth.mode,
          userCount: nextUsers.length,
          gameCount: nextGames.length,
        });
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : String(loadError));
        logWebFlow('WEB_ADMIN_DASHBOARD_LOAD_FAILED', {
          actorId: auth.actorId,
          authMode: auth.mode,
          ...summarizeError(loadError),
        });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [api, auth.actorId, auth.mode]);

  return (
    <div className="l-page">
      <Panel title="Admin" subtitle="User and game directory.">
        <div className={`c-note ${error ? 'c-note--error' : 'c-note--info'}`}>
          <span className="t-small">{error ?? (loading ? 'Loading admin data...' : 'Admin data loaded.')}</span>
        </div>

        <div className="l-split">
          <div className="l-col l-grow">
            <h3 className="t-h4">Users</h3>
            <div className="c-table" role="table" aria-label="Admin users">
              <div className="c-table__head c-table__row" role="row">
                <div className="c-table__cell t-small">Player</div>
                <div className="c-table__cell t-small">Email</div>
                <div className="c-table__cell t-small">Roles</div>
              </div>
              {users.length === 0 ? (
                <div className="c-table__row" role="row">
                  <div className="c-table__cell t-small">{loading ? 'Loading users...' : 'No users found.'}</div>
                </div>
              ) : (
                users.map((user) => (
                  <div className="c-table__row" role="row" key={user.playerId}>
                    <div className="c-table__cell t-small">{user.displayName ?? user.playerId}</div>
                    <div className="c-table__cell t-small">{user.email ?? ' '}</div>
                    <div className="c-table__cell t-small">{(user.roles ?? []).join(', ')}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="l-col l-grow">
            <h3 className="t-h4">Games</h3>
            <div className="c-table" role="table" aria-label="Admin games">
              <div className="c-table__head c-table__row" role="row">
                <div className="c-table__cell t-small">Game</div>
                <div className="c-table__cell t-small">Status</div>
                <div className="c-table__cell t-small">Visibility</div>
                <div className="c-table__cell t-small">GM</div>
              </div>
              {games.length === 0 ? (
                <div className="c-table__row" role="row">
                  <div className="c-table__cell t-small">{loading ? 'Loading games...' : 'No games found.'}</div>
                </div>
              ) : (
                games.map((game) => (
                  <div className="c-table__row" role="row" key={game.gameId}>
                    <div className="c-table__cell t-small">
                      <div>{game.name}</div>
                    </div>
                    <div className="c-table__cell t-small">{game.lifecycleStatus ?? 'ACTIVE'}</div>
                    <div className="c-table__cell t-small">{game.visibility}</div>
                    <div className="c-table__cell t-small">{game.gmPlayerId}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
