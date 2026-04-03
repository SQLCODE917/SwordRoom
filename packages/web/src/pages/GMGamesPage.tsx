import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createApiClient, type CommandEnvelopeInput, type GameItem } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { ButtonLink } from '../components/ButtonLink';
import { CommandStatusPanel } from '../components/CommandStatusPanel';
import { Panel } from '../components/Panel';
import { createCommandId, useCommandWorkflow } from '../hooks/useCommandStatus';
import { logWebFlow, summarizeError } from '../logging/flowLog';

export function GMGamesPage() {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const [games, setGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createName, setCreateName] = useState('');
  const [inviteEmailByGameId, setInviteEmailByGameId] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const { status: commandStatus, submitEnvelopeAndAwait } = useCommandWorkflow();

  useEffect(() => {
    void refreshGames();
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="l-page">
      <Panel title="GM Games" subtitle="Create games, change visibility, and invite players by email.">
        <CommandStatusPanel status={commandStatus} />
        <div className={`c-note ${error ? 'c-note--error' : 'c-note--info'}`}>
          <span className="t-small">{error ?? 'GM games refresh after each successful command.'}</span>
        </div>

        <div className="l-col">
          <FieldText label="New game name" value={createName} onChange={setCreateName} hint="The backend assigns the game ID." />
          <button
            className={`c-btn ${busyKey ? 'is-disabled' : ''}`.trim()}
            type="button"
            disabled={busyKey !== null || createName.trim() === ''}
            onClick={() => void createGame()}
          >
            Create Game
          </button>
        </div>

        <div className="c-table" role="table" aria-label="GM games">
          <div className="c-table__head c-table__row" role="row">
            <div className="c-table__cell t-small">Game</div>
            <div className="c-table__cell t-small">Visibility</div>
            <div className="c-table__cell t-small">Routes</div>
            <div className="c-table__cell t-small">Invite</div>
          </div>
          {games.length === 0 ? (
            <div className="c-table__row" role="row">
              <div className="c-table__cell t-small">{loading ? 'Loading games...' : 'No GM games yet.'}</div>
            </div>
          ) : (
            games.map((game) => {
              const busy = busyKey === game.gameId;
              return (
                <div className="c-table__row" role="row" key={game.gameId}>
                  <div className="c-table__cell t-small">
                    <div>{game.name}</div>
                    <div>{game.gameId}</div>
                  </div>
                  <div className="c-table__cell t-small">
                    <div>{game.visibility}</div>
                    <button
                      className={`c-btn ${busy ? 'is-disabled' : ''}`.trim()}
                      type="button"
                      disabled={busy}
                      onClick={() => void setVisibility(game, game.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC')}
                    >
                      Make {game.visibility === 'PUBLIC' ? 'Private' : 'Public'}
                    </button>
                  </div>
                  <div className="c-table__cell t-small">
                    <div className="l-col">
                      <ButtonLink to={`/games/${encodeURIComponent(game.gameId)}/character/new`}>New Character</ButtonLink>
                      <Link to={`/gm/${encodeURIComponent(game.gameId)}/inbox`}>GM Inbox</Link>
                    </div>
                  </div>
                  <div className="c-table__cell">
                    <div className="l-col">
                      <input
                        className="c-field__control"
                        aria-label={`Invite email for ${game.gameId}`}
                        value={inviteEmailByGameId[game.gameId] ?? ''}
                        disabled={busy}
                        onChange={(event) =>
                          setInviteEmailByGameId((prev) => ({ ...prev, [game.gameId]: event.target.value }))
                        }
                      />
                      <button
                        className={`c-btn ${busy ? 'is-disabled' : ''}`.trim()}
                        type="button"
                        disabled={busy || (inviteEmailByGameId[game.gameId] ?? '').trim() === ''}
                        onClick={() => void invitePlayer(game)}
                      >
                        Invite Player
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Panel>
    </div>
  );

  async function refreshGames() {
    setLoading(true);
    try {
      const nextGames = await api.getGmGames();
      setGames(nextGames);
      setError(null);
      logWebFlow('WEB_GM_GAMES_REFRESH_OK', {
        actorId: auth.actorId,
        authMode: auth.mode,
        count: nextGames.length,
      });
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : String(refreshError);
      setError(message);
      logWebFlow('WEB_GM_GAMES_REFRESH_FAILED', {
        actorId: auth.actorId,
        authMode: auth.mode,
        ...summarizeError(refreshError),
      });
    } finally {
      setLoading(false);
    }
  }

  async function createGame() {
    const name = createName.trim();
    setBusyKey('create');
    try {
      await submitEnvelopeAndAwait('Create game', {
        commandId: createCommandId(),
        type: 'CreateGame',
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        payload: {
          name,
        },
      } satisfies CommandEnvelopeInput<'CreateGame'>);
      setCreateName('');
      await refreshGames();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyKey(null);
    }
  }

  async function setVisibility(game: GameItem, visibility: 'PUBLIC' | 'PRIVATE') {
    setBusyKey(game.gameId);
    try {
      await submitEnvelopeAndAwait('Set visibility', {
        commandId: createCommandId(),
        gameId: game.gameId,
        type: 'SetGameVisibility',
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        payload: {
          gameId: game.gameId,
          expectedVersion: game.version,
          visibility,
        },
      } satisfies CommandEnvelopeInput<'SetGameVisibility'>);
      await refreshGames();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyKey(null);
    }
  }

  async function invitePlayer(game: GameItem) {
    const email = (inviteEmailByGameId[game.gameId] ?? '').trim();
    setBusyKey(game.gameId);
    try {
      await submitEnvelopeAndAwait('Invite player', {
        commandId: createCommandId(),
        gameId: game.gameId,
        type: 'InvitePlayerToGameByEmail',
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        payload: {
          gameId: game.gameId,
          email,
        },
      } satisfies CommandEnvelopeInput<'InvitePlayerToGameByEmail'>);
      setInviteEmailByGameId((prev) => ({ ...prev, [game.gameId]: '' }));
      setError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      logWebFlow('WEB_GM_GAMES_COMMAND_FAILED', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId: game.gameId,
        email,
        ...summarizeError(error),
      });
    } finally {
      setBusyKey(null);
    }
  }
}

function FieldText(input: { label: string; value: string; onChange: (value: string) => void; hint?: string }) {
  return (
    <label className="c-field l-col l-grow">
      <span className="c-field__label">{input.label}</span>
      <input className="c-field__control" value={input.value} onChange={(event) => input.onChange(event.target.value)} />
      <span className="c-field__hint">{input.hint ?? ' '}</span>
    </label>
  );
}
