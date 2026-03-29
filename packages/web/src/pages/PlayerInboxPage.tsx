import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createApiClient, type CommandEnvelopeInput, type PlayerInboxItem } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { CommandStatusPanel } from '../components/CommandStatusPanel';
import { Panel } from '../components/Panel';
import { createCommandId, useCommandWorkflow } from '../hooks/useCommandStatus';
import { logWebFlow, summarizeError } from '../logging/flowLog';

const refreshIntervalMs = 3000;

interface InboxRow {
  key: string;
  kind: string;
  message: string;
  createdAt: string;
  gameId: string;
  characterId: string | null;
  inviteId: string | null;
}

interface InboxRef {
  characterId?: unknown;
  inviteId?: unknown;
}

interface InboxItemLike extends Record<string, unknown> {
  kind?: unknown;
  message?: unknown;
  createdAt?: unknown;
  gameId?: unknown;
  promptId?: unknown;
  ref?: InboxRef;
}

export function PlayerInboxPage() {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);

  const [rows, setRows] = useState<InboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeInviteId, setActiveInviteId] = useState<string | null>(null);
  const { status: commandStatus, submitEnvelopeAndAwait } = useCommandWorkflow();

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const refresh = async () => {
      logWebFlow('WEB_PLAYER_INBOX_REFRESH_START', {
        actorId: auth.actorId,
        authMode: auth.mode,
      });
      try {
        const inbox = await api.getMyInbox();
        if (cancelled) {
          return;
        }
        setRows(normalizeRows(inbox));
        setError(null);
        logWebFlow('WEB_PLAYER_INBOX_REFRESH_OK', {
          actorId: auth.actorId,
          authMode: auth.mode,
          count: inbox.length,
        });
      } catch (refreshError) {
        if (cancelled) {
          return;
        }
        const message = refreshError instanceof Error ? refreshError.message : String(refreshError);
        setError(message);
        logWebFlow('WEB_PLAYER_INBOX_REFRESH_FAILED', {
          actorId: auth.actorId,
          authMode: auth.mode,
          ...summarizeError(refreshError),
        });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void refresh();
    intervalId = setInterval(() => {
      void refresh();
    }, refreshIntervalMs);

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [api, auth.actorId, auth.mode]);

  const noticeClassName = useMemo(() => `c-note ${error ? 'c-note--error' : 'c-note--info'}`, [error]);
  const placeholderText = loading ? 'Loading inbox...' : 'No inbox items yet.';

  return (
    <div className="l-page">
      <Panel title="Player Inbox" subtitle="Character updates and game invitations.">
        <CommandStatusPanel status={commandStatus} />
        <div className={noticeClassName} role="note" aria-live="polite">
          <span className="t-small">{error ?? 'Inbox refreshes automatically.'}</span>
        </div>

        <div className="c-table" role="table" aria-label="Player Inbox Items">
          <div className="c-table__head c-table__row" role="row">
            <div className="c-table__cell t-small">Kind</div>
            <div className="c-table__cell t-small">Message</div>
            <div className="c-table__cell t-small">Created</div>
            <div className="c-table__cell t-small">Actions</div>
          </div>

          {rows.length === 0 ? (
            <div className="c-table__row" role="row">
              <div className="c-table__cell t-small">{placeholderText}</div>
            </div>
          ) : (
            rows.map((row) => {
              const rowBusy = activeInviteId === row.inviteId;
              return (
                <div className="c-table__row" role="row" key={row.key}>
                  <div className="c-table__cell t-small">{row.kind}</div>
                  <div className="c-table__cell t-small">{row.message}</div>
                  <div className="c-table__cell t-small">{row.createdAt}</div>
                  <div className="c-table__cell t-small">
                    <div className="l-row">
                      {row.characterId ? (
                        <Link to={`/games/${encodeURIComponent(row.gameId)}/characters/${encodeURIComponent(row.characterId)}`}>
                          Open
                        </Link>
                      ) : null}
                      {row.kind === 'GAME_INVITE' && row.inviteId ? (
                        <>
                          <button
                            className={`c-btn ${rowBusy ? 'is-disabled' : ''}`.trim()}
                            type="button"
                            disabled={rowBusy}
                            onClick={() => void respondToInvite(row, 'AcceptGameInvite')}
                          >
                            Accept
                          </button>
                          <button
                            className={`c-btn ${rowBusy ? 'is-disabled' : ''}`.trim()}
                            type="button"
                            disabled={rowBusy}
                            onClick={() => void respondToInvite(row, 'RejectGameInvite')}
                          >
                            Reject
                          </button>
                        </>
                      ) : null}
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

  async function respondToInvite(row: InboxRow, type: 'AcceptGameInvite' | 'RejectGameInvite') {
    if (!row.inviteId) {
      return;
    }
    setActiveInviteId(row.inviteId);
    setError(null);
    try {
      await submitEnvelopeAndAwait(type === 'AcceptGameInvite' ? 'Accept invite' : 'Reject invite', {
        commandId: createCommandId(),
        gameId: row.gameId,
        type,
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        payload: {
          gameId: row.gameId,
          inviteId: row.inviteId,
        },
      } satisfies CommandEnvelopeInput<typeof type>);
      const inbox = await api.getMyInbox();
      setRows(normalizeRows(inbox));
    } catch (inviteError) {
      const message = inviteError instanceof Error ? inviteError.message : String(inviteError);
      setError(message);
      logWebFlow('WEB_PLAYER_INBOX_INVITE_ACTION_FAILED', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId: row.gameId,
        inviteId: row.inviteId,
        type,
        ...summarizeError(inviteError),
      });
    } finally {
      setActiveInviteId(null);
    }
  }
}

function normalizeRows(items: PlayerInboxItem[]): InboxRow[] {
  const rows: InboxRow[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const candidate = item as InboxItemLike;
    const kind = typeof candidate.kind === 'string' ? candidate.kind : '';
    const message = typeof candidate.message === 'string' ? candidate.message : '';
    const createdAt = typeof candidate.createdAt === 'string' ? candidate.createdAt : '';
    const gameId = typeof candidate.gameId === 'string' ? candidate.gameId : '';
    const ref = typeof candidate.ref === 'object' && candidate.ref !== null ? candidate.ref : null;
    const characterId = ref && typeof ref.characterId === 'string' ? ref.characterId : null;
    const inviteId = ref && typeof ref.inviteId === 'string' ? ref.inviteId : null;
    const promptId = typeof candidate.promptId === 'string' ? candidate.promptId : `${kind}:${createdAt}:${message}`;

    if (!kind || !message || !createdAt || !gameId) {
      continue;
    }

    rows.push({
      key: promptId,
      kind,
      message,
      createdAt,
      gameId,
      characterId,
      inviteId,
    });
  }

  return rows;
}
