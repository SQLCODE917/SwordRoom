import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createApiClient, type PlayerInboxItem } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { Panel } from '../components/Panel';
import { logWebFlow, summarizeError } from '../logging/flowLog';

const refreshIntervalMs = 3000;

interface InboxRow {
  key: string;
  kind: string;
  message: string;
  createdAt: string;
  gameId: string;
  characterId: string | null;
}

interface InboxRef {
  characterId?: unknown;
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
  }, [api]);

  const noticeClassName = useMemo(() => `c-note ${error ? 'c-note--error' : 'c-note--info'}`, [error]);
  const placeholderText = loading ? 'Loading inbox...' : 'No inbox items yet.';

  return (
    <div className="l-page">
      <Panel title="Player Inbox" subtitle="Prompt updates from submission and GM review status.">
        <div className={noticeClassName} role="note" aria-live="polite">
          <span className="t-small">{error ?? 'Inbox refreshes automatically.'}</span>
        </div>

        <div className="c-table" role="table" aria-label="Player Inbox Items">
          <div className="c-table__head c-table__row" role="row">
            <div className="c-table__cell t-small">Kind</div>
            <div className="c-table__cell t-small">Message</div>
            <div className="c-table__cell t-small">Created</div>
            <div className="c-table__cell t-small">Character Sheet</div>
          </div>

          {rows.length === 0 ? (
            <div className="c-table__row" role="row">
              <div className="c-table__cell t-small">{placeholderText}</div>
              <div className="c-table__cell t-small"> </div>
              <div className="c-table__cell t-small"> </div>
              <div className="c-table__cell t-small"> </div>
            </div>
          ) : (
            rows.map((row) => (
              <div className="c-table__row" role="row" key={row.key}>
                <div className="c-table__cell t-small">{row.kind}</div>
                <div className="c-table__cell t-small">{row.message}</div>
                <div className="c-table__cell t-small">{row.createdAt}</div>
                <div className="c-table__cell t-small">
                  {row.characterId ? (
                    <Link to={`/games/${encodeURIComponent(row.gameId)}/characters/${encodeURIComponent(row.characterId)}`}>
                      Open
                    </Link>
                  ) : (
                    ' '
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
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
    });
  }

  return rows;
}
