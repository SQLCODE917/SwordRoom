import { useCallback, useEffect, useMemo, useState } from 'react';
import { isPlayerCharacterLibraryGameId } from '@starter/shared/contracts/db';
import { createApiClient, type CharacterItem, type GameItem } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { ButtonLink } from '../components/ButtonLink';
import { CommandStatusPanel } from '../components/CommandStatusPanel';
import { Panel } from '../components/Panel';
import { useMyProfile } from '../hooks/useMyProfile';
import { createCommandId, useCommandWorkflow } from '../hooks/useCommandStatus';
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

const existingCharacterDisabledReason = 'You already have a character in this game.';

export function HomePage() {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const { profile, loading: profileLoading, error: profileError } = useMyProfile();
  const [dashboard, setDashboard] = useState<DashboardState>(emptyState);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [removingCharacterId, setRemovingCharacterId] = useState<string | null>(null);
  const { status: commandStatus, isRunning: isRunningCommand, submitEnvelopeAndAwait } = useCommandWorkflow();

  const refreshDashboard = useCallback(async () => {
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
      setDataError(loadError instanceof Error ? loadError.message : String(loadError));
      logWebFlow('WEB_HOME_LOAD_FAILED', {
        actorId: auth.actorId,
        authMode: auth.mode,
        ...summarizeError(loadError),
      });
    } finally {
      setDataLoading(false);
    }
  }, [api, auth.actorId, auth.mode]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (cancelled) {
        return;
      }
      await refreshDashboard();
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshDashboard]);

  const loading = profileLoading || dataLoading;
  const error = profileError ?? dataError;
  const profileName = profile?.displayName ?? profile?.playerId ?? auth.actorId;
  const joinedGameIds = useMemo(() => new Set(dashboard.myGames.map((game) => game.gameId)), [dashboard.myGames]);
  const gmGameIds = useMemo(() => new Set(dashboard.gmGames.map((game) => game.gameId)), [dashboard.gmGames]);
  const gameCharacterByGameId = useMemo(() => {
    const next = new Map<string, CharacterItem>();
    for (const character of dashboard.characters) {
      if (isPlayerCharacterLibraryGameId(character.gameId) || next.has(character.gameId)) {
        continue;
      }
      next.set(character.gameId, character);
    }
    return next;
  }, [dashboard.characters]);

  return (
    <div className="l-page">
      <Panel title="Home" subtitle="Your account, characters, and visible games.">
        <CommandStatusPanel status={commandStatus} />
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
                        <ButtonLink to={getCharacterSheetPath(character)}>Sheet</ButtonLink>
                        <ButtonLink to={getCharacterEditPath(character)}>Edit</ButtonLink>
                        {isRemovableGameCharacter(character) ? (
                          <button
                            className={`c-btn ${removingCharacterId === character.characterId || isRunningCommand ? 'is-disabled' : ''}`.trim()}
                            type="button"
                            disabled={removingCharacterId === character.characterId || isRunningCommand}
                            onClick={() => void removeCharacter(character)}
                          >
                            Leave Game
                          </button>
                        ) : null}
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
            <MyGamesTable
              games={dashboard.myGames}
              loading={loading}
              emptyText="You are not in any games yet."
              gmGameIds={gmGameIds}
              characterByGameId={gameCharacterByGameId}
            />

            <SectionTitle title="Public Games" />
            <PublicGamesTable
              games={dashboard.publicGames}
              loading={loading}
              emptyText="No public games found."
              joinedGameIds={joinedGameIds}
              gmGameIds={gmGameIds}
              characterByGameId={gameCharacterByGameId}
            />
          </div>
        </div>
      </Panel>
    </div>
  );

  async function removeCharacter(character: CharacterItem) {
    setRemovingCharacterId(character.characterId);
    setDataError(null);
    try {
      await submitEnvelopeAndAwait('Delete character', {
        commandId: createCommandId(),
        gameId: character.gameId,
        type: 'DeleteCharacter',
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        payload: {
          characterId: character.characterId,
        },
      });
      await refreshDashboard();
    } catch (error) {
      setDataError(error instanceof Error ? error.message : String(error));
    } finally {
      setRemovingCharacterId(null);
    }
  }
}

function SectionTitle({ title }: { title: string }) {
  return <h3 className="t-h4">{title}</h3>;
}

function MyGamesTable(input: {
  games: GameItem[];
  loading: boolean;
  emptyText: string;
  gmGameIds: ReadonlySet<string>;
  characterByGameId: ReadonlyMap<string, CharacterItem>;
}) {
  return (
    <div className="c-table" role="table" aria-label="My Games">
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
        input.games.map((game) => {
          const character = input.characterByGameId.get(game.gameId) ?? null;
          return (
            <div className="c-table__row" role="row" key={game.gameId}>
              <div className="c-table__cell t-small">
                <div>{game.name}</div>
              </div>
              <div className="c-table__cell t-small">{game.visibility}</div>
              <div className="c-table__cell t-small">
                <div className="l-row">
                  {character ? (
                    <>
                      <ButtonLink to={getCharacterSheetPath(character)}>Sheet</ButtonLink>
                      {canEditCharacter(character) ? <ButtonLink to={getCharacterEditPath(character)}>Edit</ButtonLink> : null}
                    </>
                  ) : null}
                  <ButtonLink
                    to={`/games/${encodeURIComponent(game.gameId)}/character/new`}
                    disabled={Boolean(character)}
                    disabledReason={character ? existingCharacterDisabledReason : null}
                  >
                    New Character
                  </ButtonLink>
                  <ButtonLink to={`/games/${encodeURIComponent(game.gameId)}/chat`}>Chat</ButtonLink>
                  <ButtonLink to="/me/inbox">Player Inbox</ButtonLink>
                  {input.gmGameIds.has(game.gameId) ? (
                    <ButtonLink to={`/gm/${encodeURIComponent(game.gameId)}/inbox`}>GM Inbox</ButtonLink>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })
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
  characterByGameId: ReadonlyMap<string, CharacterItem>;
}) {
  return (
    <div className="c-table" role="table" aria-label="Public Games">
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
        input.games.map((game) => {
          const character = input.characterByGameId.get(game.gameId) ?? null;
          return (
            <div className="c-table__row" role="row" key={game.gameId}>
              <div className="c-table__cell t-small">
                <div>{game.name}</div>
              </div>
              <div className="c-table__cell t-small">{game.visibility}</div>
              <div className="c-table__cell t-small">
                <div className="l-row">
                  {character ? (
                    <>
                      <ButtonLink to={getCharacterSheetPath(character)}>Sheet</ButtonLink>
                      {canEditCharacter(character) ? <ButtonLink to={getCharacterEditPath(character)}>Edit</ButtonLink> : null}
                    </>
                  ) : null}
                  {input.joinedGameIds.has(game.gameId) ? <ButtonLink to="/me/inbox">Player Inbox</ButtonLink> : null}
                  {input.joinedGameIds.has(game.gameId) || input.gmGameIds.has(game.gameId) ? (
                    <ButtonLink to={`/games/${encodeURIComponent(game.gameId)}/chat`}>Chat</ButtonLink>
                  ) : null}
                  {input.gmGameIds.has(game.gameId) ? (
                    <ButtonLink to={`/gm/${encodeURIComponent(game.gameId)}/inbox`}>GM Inbox</ButtonLink>
                  ) : null}
                  {!input.joinedGameIds.has(game.gameId) || character ? (
                    <ButtonLink
                      to={`/games/${encodeURIComponent(game.gameId)}/character/new`}
                      disabled={Boolean(character)}
                      disabledReason={character ? existingCharacterDisabledReason : null}
                    >
                      Apply to Join
                    </ButtonLink>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })
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

function canEditCharacter(character: CharacterItem): boolean {
  return character.status !== 'PENDING' && character.status !== 'APPROVED';
}

function isRemovableGameCharacter(character: CharacterItem): boolean {
  return !isPlayerCharacterLibraryGameId(character.gameId);
}
