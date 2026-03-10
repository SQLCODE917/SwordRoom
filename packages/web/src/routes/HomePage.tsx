import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createApiClient, type CharacterItem, type GameItem, type PlayerProfile } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { Panel } from '../components/Panel';
import { logWebFlow, summarizeError } from '../logging/flowLog';

interface DashboardState {
  profile: PlayerProfile | null;
  characters: CharacterItem[];
  myGames: GameItem[];
  publicGames: GameItem[];
}

const emptyState: DashboardState = {
  profile: null,
  characters: [],
  myGames: [],
  publicGames: [],
};

export function HomePage() {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const [dashboard, setDashboard] = useState<DashboardState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      logWebFlow('WEB_HOME_LOAD_START', {
        actorId: auth.actorId,
        authMode: auth.mode,
      });
      try {
        if (auth.mode === 'oidc') {
          await api.syncMyProfile();
        }
        const [profile, characters, myGames, publicGames] = await Promise.all([
          api.getMyProfile(),
          api.getMyCharacters(),
          api.getMyGames(),
          api.getPublicGames(),
        ]);
        if (cancelled) {
          return;
        }
        setDashboard({ profile, characters, myGames, publicGames });
        setError(null);
        logWebFlow('WEB_HOME_LOAD_OK', {
          actorId: auth.actorId,
          authMode: auth.mode,
          characterCount: characters.length,
          myGameCount: myGames.length,
          publicGameCount: publicGames.length,
        });
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : String(loadError));
        logWebFlow('WEB_HOME_LOAD_FAILED', {
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

  const profileName = dashboard.profile?.displayName ?? dashboard.profile?.playerId ?? auth.actorId;

  return (
    <div className="l-page">
      <Panel title="Home" subtitle="Your account, characters, and visible games.">
        <div className={`c-note ${error ? 'c-note--error' : 'c-note--info'}`}>
          <span className="t-small">{error ?? (loading ? 'Loading dashboard...' : `Signed in as ${profileName}.`)}</span>
        </div>

        <div className="l-split">
          <div className="l-col l-grow">
            <SectionTitle title="Profile" />
            <div className="c-note c-note--info">
              <span className="t-small">
                {profileName} | {(dashboard.profile?.roles ?? []).join(', ') || 'PLAYER'} | {dashboard.profile?.email ?? ' '}
              </span>
            </div>

            <SectionTitle title="My Characters" />
            <div className="c-table" role="table" aria-label="My characters">
              <div className="c-table__head c-table__row" role="row">
                <div className="c-table__cell t-small">Character</div>
                <div className="c-table__cell t-small">Status</div>
                <div className="c-table__cell t-small">Actions</div>
              </div>
              {dashboard.characters.length === 0 ? (
                <div className="c-table__row" role="row">
                  <div className="c-table__cell t-small">{loading ? 'Loading characters...' : 'No characters yet.'}</div>
                </div>
              ) : (
                dashboard.characters.map((character) => (
                  <div className="c-table__row" role="row" key={`${character.gameId}:${character.characterId}`}>
                    <div className="c-table__cell t-small">{readCharacterName(character)}</div>
                    <div className="c-table__cell t-small">{character.status}</div>
                    <div className="c-table__cell t-small">
                      <div className="l-row">
                        <Link to={`/games/${encodeURIComponent(character.gameId)}/characters/${encodeURIComponent(character.characterId)}`}>
                          Sheet
                        </Link>
                        <Link
                          to={`/games/${encodeURIComponent(character.gameId)}/characters/${encodeURIComponent(character.characterId)}/edit`}
                        >
                          Edit
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="l-col l-grow">
            <SectionTitle title="My Games" />
            <GameTable games={dashboard.myGames} loading={loading} emptyText="You are not in any games yet." />

            <SectionTitle title="Public Games" />
            <GameTable games={dashboard.publicGames} loading={loading} emptyText="No public games found." />
          </div>
        </div>
      </Panel>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h3 className="t-h4">{title}</h3>;
}

function GameTable(input: { games: GameItem[]; loading: boolean; emptyText: string }) {
  return (
    <div className="c-table" role="table" aria-label={input.emptyText}>
      <div className="c-table__head c-table__row" role="row">
        <div className="c-table__cell t-small">Game</div>
        <div className="c-table__cell t-small">Visibility</div>
        <div className="c-table__cell t-small">Actions</div>
      </div>
      {input.games.length === 0 ? (
        <div className="c-table__row" role="row">
          <div className="c-table__cell t-small">{input.loading ? 'Loading games...' : input.emptyText}</div>
        </div>
      ) : (
        input.games.map((game) => (
          <div className="c-table__row" role="row" key={game.gameId}>
            <div className="c-table__cell t-small">
              <div>{game.name}</div>
              <div>{game.gameId}</div>
            </div>
            <div className="c-table__cell t-small">{game.visibility}</div>
            <div className="c-table__cell t-small">
              <div className="l-row">
                <Link to={`/games/${encodeURIComponent(game.gameId)}/character/new`}>New Character</Link>
                <Link to={`/gm/${encodeURIComponent(game.gameId)}/inbox`}>GM Inbox</Link>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function readCharacterName(character: CharacterItem): string {
  const draft = typeof character.draft === 'object' && character.draft !== null ? (character.draft as Record<string, unknown>) : null;
  const identity = draft && typeof draft.identity === 'object' && draft.identity !== null ? (draft.identity as Record<string, unknown>) : null;
  const name = typeof identity?.name === 'string' ? identity.name.trim() : '';
  return name || character.characterId;
}
