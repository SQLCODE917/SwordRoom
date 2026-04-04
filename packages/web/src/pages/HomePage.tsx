import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { isPlayerCharacterLibraryGameId } from '@starter/shared/contracts/db';
import { createApiClient, type CharacterItem, type GameItem } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { ButtonLink } from '../components/ButtonLink';
import { Panel } from '../components/Panel';
import { useMyProfile } from '../hooks/useMyProfile';
import { logWebFlow, summarizeError } from '../logging/flowLog';

interface DashboardState {
  characters: CharacterItem[];
  myGames: GameItem[];
  gmGames: GameItem[];
  publicGames: GameItem[];
}

const emptyState: DashboardState = {
  characters: [],
  myGames: [],
  gmGames: [],
  publicGames: [],
};

export function HomePage() {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const { profile, loading: profileLoading, error: profileError } = useMyProfile();
  const [dashboard, setDashboard] = useState<DashboardState>(emptyState);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setDataLoading(true);
      logWebFlow('WEB_HOME_LOAD_START', {
        actorId: auth.actorId,
        authMode: auth.mode,
      });
      try {
        const [characters, myGames, gmGames, publicGames] = await Promise.all([
          api.getMyCharacters(),
          api.getMyGames(),
          api.getGmGames(),
          api.getPublicGames(),
        ]);
        if (cancelled) {
          return;
        }
        setDashboard({ characters, myGames, gmGames, publicGames });
        setDataError(null);
        logWebFlow('WEB_HOME_LOAD_OK', {
          actorId: auth.actorId,
          authMode: auth.mode,
          characterCount: characters.length,
          myGameCount: myGames.length,
          gmGameCount: gmGames.length,
          publicGameCount: publicGames.length,
        });
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setDataError(loadError instanceof Error ? loadError.message : String(loadError));
        logWebFlow('WEB_HOME_LOAD_FAILED', {
          actorId: auth.actorId,
          authMode: auth.mode,
          ...summarizeError(loadError),
        });
      } finally {
        if (!cancelled) {
          setDataLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [api, auth.actorId, auth.mode]);

  const loading = profileLoading || dataLoading;
  const error = profileError ?? dataError;
  const profileName = profile?.displayName ?? profile?.playerId ?? auth.actorId;
  const joinedGameIds = useMemo(() => new Set(dashboard.myGames.map((game) => game.gameId)), [dashboard.myGames]);
  const gmGameIds = useMemo(() => new Set(dashboard.gmGames.map((game) => game.gameId)), [dashboard.gmGames]);

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
                {profileName} | {(profile?.roles ?? []).join(', ') || 'PLAYER'} | {profile?.email ?? ' '}
              </span>
            </div>

            <SectionTitle title="My Characters" />
            <div className="l-row">
              <ButtonLink to={`/player/${encodeURIComponent(auth.actorId)}/character/new`}>New Character</ButtonLink>
            </div>
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
                        <Link to={getCharacterSheetPath(character)}>
                          Sheet
                        </Link>
                        <ButtonLink to={getCharacterEditPath(character)}>Edit</ButtonLink>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="l-col l-grow">
            <SectionTitle title="My Games" />
            <div className="l-row">
              <ButtonLink to="/gm/games">Create Game</ButtonLink>
            </div>
            <MyGamesTable games={dashboard.myGames} loading={loading} emptyText="You are not in any games yet." gmGameIds={gmGameIds} />

            <SectionTitle title="Public Games" />
            <PublicGamesTable
              games={dashboard.publicGames}
              loading={loading}
              emptyText="No public games found."
              joinedGameIds={joinedGameIds}
              gmGameIds={gmGameIds}
            />
          </div>
        </div>
      </Panel>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h3 className="t-h4">{title}</h3>;
}

function MyGamesTable(input: { games: GameItem[]; loading: boolean; emptyText: string; gmGameIds: ReadonlySet<string> }) {
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
                <ButtonLink to={`/games/${encodeURIComponent(game.gameId)}/character/new`}>New Character</ButtonLink>
                <Link to="/me/inbox">Player Inbox</Link>
                {input.gmGameIds.has(game.gameId) ? (
                  <Link to={`/gm/${encodeURIComponent(game.gameId)}/inbox`}>GM Inbox</Link>
                ) : null}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export function PublicGamesTable(input: {
  games: GameItem[];
  loading: boolean;
  emptyText: string;
  joinedGameIds: ReadonlySet<string>;
  gmGameIds: ReadonlySet<string>;
}) {
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
                {input.joinedGameIds.has(game.gameId) ? <Link to="/me/inbox">Player Inbox</Link> : null}
                {input.gmGameIds.has(game.gameId) ? (
                  <Link to={`/gm/${encodeURIComponent(game.gameId)}/inbox`}>GM Inbox</Link>
                ) : null}
                {!input.joinedGameIds.has(game.gameId) ? (
                  <ButtonLink to={`/games/${encodeURIComponent(game.gameId)}/character/new`}>Apply to Join</ButtonLink>
                ) : null}
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

function getCharacterSheetPath(character: CharacterItem): string {
  if (isPlayerCharacterLibraryGameId(character.gameId)) {
    const ownerPlayerId = typeof character.ownerPlayerId === 'string' ? character.ownerPlayerId : '';
    return `/player/${encodeURIComponent(ownerPlayerId)}/characters/${encodeURIComponent(character.characterId)}`;
  }
  return `/games/${encodeURIComponent(character.gameId)}/characters/${encodeURIComponent(character.characterId)}`;
}

function getCharacterEditPath(character: CharacterItem): string {
  if (isPlayerCharacterLibraryGameId(character.gameId)) {
    const ownerPlayerId = typeof character.ownerPlayerId === 'string' ? character.ownerPlayerId : '';
    return `/player/${encodeURIComponent(ownerPlayerId)}/characters/${encodeURIComponent(character.characterId)}/edit`;
  }
  return `/games/${encodeURIComponent(character.gameId)}/characters/${encodeURIComponent(character.characterId)}/edit`;
}
