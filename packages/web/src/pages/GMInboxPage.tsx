import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { createApiClient, type CommandEnvelopeInput, type GMInboxItem } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { CommandStatusPanel } from '../components/CommandStatusPanel';
import { logWebFlow, summarizeError } from '../logging/flowLog';
import { Panel } from '../components/Panel';
import { createCommandId, useCommandWorkflow } from '../hooks/useCommandStatus';

interface PendingCharacterRow {
  key: string;
  characterId: string;
  ownerPlayerId: string;
  submittedAt: string;
}

interface ActivityRow {
  key: string;
  kind: string;
  message: string;
  createdAt: string;
}

export function GMInboxPage() {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId ?? 'game-1';

  const [pendingRows, setPendingRows] = useState<PendingCharacterRow[]>([]);
  const [activityRows, setActivityRows] = useState<ActivityRow[]>([]);
  const [notesByCharacterId, setNotesByCharacterId] = useState<Record<string, string>>({});
  const [errorsByCharacterId, setErrorsByCharacterId] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);
  const { status: commandStatus, submitEnvelopeAndAwait } = useCommandWorkflow();

  useEffect(() => {
    void refreshInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  return (
    <div className="l-page">
      <Panel title="GM Inbox" subtitle={`Pending characters and invite responses for game ${gameId}.`}>
        <CommandStatusPanel status={commandStatus} />
        <div className={`c-note ${error ? 'c-note--error' : 'c-note--info'}`}>
          <span className="t-small">{error ?? 'GM inbox refreshes after each successful review.'}</span>
        </div>

        <div className="c-table" role="table" aria-label="GM Pending Characters">
          <div className="c-table__head c-table__row" role="row">
            <div className="c-table__cell t-small">Character</div>
            <div className="c-table__cell t-small">Owner</div>
            <div className="c-table__cell t-small">Submitted</div>
            <div className="c-table__cell t-small">Review</div>
          </div>

          {pendingRows.length === 0 ? (
            <div className="c-table__row" role="row">
              <div className="c-table__cell t-small">No pending characters.</div>
            </div>
          ) : (
            pendingRows.map((row) => {
              const note = notesByCharacterId[row.characterId] ?? '';
              const rowError = errorsByCharacterId[row.characterId] ?? ' ';
              const rowBusy = activeCharacterId === row.characterId;

              return (
                <div className="c-table__row" role="row" key={row.key}>
                  <div className="c-table__cell t-small">{row.characterId}</div>
                  <div className="c-table__cell t-small">{row.ownerPlayerId}</div>
                  <div className="c-table__cell t-small">{row.submittedAt}</div>
                  <div className="c-table__cell">
                    <div className="l-col">
                      <div className={`c-field ${rowBusy ? 'is-disabled' : ''}`.trim()}>
                        <label className="c-field__label">GM note</label>
                        <input
                          className="c-field__control"
                          value={note}
                          disabled={rowBusy}
                          onChange={(event) => {
                            const next = event.target.value;
                            setNotesByCharacterId((prev) => ({ ...prev, [row.characterId]: next }));
                            setErrorsByCharacterId((prev) => ({ ...prev, [row.characterId]: ' ' }));
                          }}
                        />
                        <div className="c-field__hint">Required for reject; optional for approve.</div>
                        <div className="c-field__err">{rowError}</div>
                      </div>

                      <div className="l-row">
                        <button
                          className={`c-btn ${rowBusy ? 'is-disabled' : ''}`.trim()}
                          type="button"
                          disabled={rowBusy || loading}
                          onClick={() => void reviewRow(row, 'APPROVE')}
                        >
                          Approve
                        </button>
                        <button
                          className={`c-btn ${rowBusy ? 'is-disabled' : ''}`.trim()}
                          type="button"
                          disabled={rowBusy || loading || note.trim() === ''}
                          onClick={() => void reviewRow(row, 'REJECT')}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <Panel title="Invite Activity" subtitle="Player invite responses sent back to the GM inbox.">
          <div className="c-table" role="table" aria-label="GM invite activity">
            <div className="c-table__head c-table__row" role="row">
              <div className="c-table__cell t-small">Kind</div>
              <div className="c-table__cell t-small">Message</div>
              <div className="c-table__cell t-small">Created</div>
            </div>
            {activityRows.length === 0 ? (
              <div className="c-table__row" role="row">
                <div className="c-table__cell t-small">No invite activity yet.</div>
              </div>
            ) : (
              activityRows.map((row) => (
                <div className="c-table__row" role="row" key={row.key}>
                  <div className="c-table__cell t-small">{row.kind}</div>
                  <div className="c-table__cell t-small">{row.message}</div>
                  <div className="c-table__cell t-small">{row.createdAt}</div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </Panel>
    </div>
  );

  async function refreshInbox() {
    setLoading(true);
    logWebFlow('WEB_GM_INBOX_REFRESH_START', {
      actorId: auth.actorId,
      authMode: auth.mode,
      gameId,
    });
    try {
      const inbox = await api.getGmInbox(gameId);
      const normalized = normalizeInbox(inbox);
      setPendingRows(normalized.pendingRows);
      setActivityRows(normalized.activityRows);
      setError(null);
      logWebFlow('WEB_GM_INBOX_REFRESH_OK', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
        count: inbox.length,
      });
    } catch (error) {
      setPendingRows([]);
      setActivityRows([]);
      setError(error instanceof Error ? error.message : String(error));
      logWebFlow('WEB_GM_INBOX_REFRESH_FAILED', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
        ...summarizeError(error),
      });
    } finally {
      setLoading(false);
    }
  }

  async function reviewRow(row: PendingCharacterRow, decision: 'APPROVE' | 'REJECT') {
    const note = (notesByCharacterId[row.characterId] ?? '').trim();
    if (decision === 'REJECT' && note === '') {
      setErrorsByCharacterId((prev) => ({ ...prev, [row.characterId]: 'Rejection note is required.' }));
      return;
    }

    setErrorsByCharacterId((prev) => ({ ...prev, [row.characterId]: ' ' }));
    setError(null);
    setActiveCharacterId(row.characterId);
    logWebFlow('WEB_GM_REVIEW_START', {
      actorId: auth.actorId,
      authMode: auth.mode,
      gameId,
      characterId: row.characterId,
      decision,
      gmNotePresent: note.length > 0,
    });

    try {
      await submitEnvelopeAndAwait(`GM ${decision.toLowerCase()}`, {
        commandId: createCommandId(),
        gameId,
        type: 'GMReviewCharacter',
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        payload: {
          characterId: row.characterId,
          decision,
          gmNote: note || undefined,
        },
      } satisfies CommandEnvelopeInput<'GMReviewCharacter'>);

      await refreshInbox();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorsByCharacterId((prev) => ({ ...prev, [row.characterId]: message }));
      setError(message);
    } finally {
      setActiveCharacterId(null);
    }
  }
}

function normalizeInbox(items: GMInboxItem[]): {
  pendingRows: PendingCharacterRow[];
  activityRows: ActivityRow[];
} {
  const pendingRows: PendingCharacterRow[] = [];
  const activityRows: ActivityRow[] = [];

  for (const item of items) {
    const ref = typeof item.ref === 'object' && item.ref !== null ? (item.ref as Record<string, unknown>) : null;
    const key = item.promptId || `${item.kind}:${item.createdAt}`;
    if (item.kind === 'PENDING_CHARACTER' && typeof ref?.characterId === 'string') {
      pendingRows.push({
        key,
        characterId: ref.characterId,
        ownerPlayerId: item.ownerPlayerId ?? (typeof ref.playerId === 'string' ? ref.playerId : 'unknown'),
        submittedAt: item.submittedAt ?? item.createdAt ?? '',
      });
      continue;
    }

    activityRows.push({
      key,
      kind: item.kind,
      message: typeof item.message === 'string' ? item.message : '',
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
    });
  }

  return { pendingRows, activityRows };
}
