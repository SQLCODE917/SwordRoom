import { useEffect, useMemo, useState } from 'react';
import { createApiClient, type CommandEnvelopeInput, type GMInboxItem } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { ButtonLink } from '../components/ButtonLink';
import { InboxModeTabs } from '../components/InboxModeTabs';
import { logWebFlow, summarizeError } from '../logging/flowLog';
import { Panel } from '../components/Panel';
import { createCommandId, useCommandWorkflow } from '../hooks/useCommandStatus';
import { createGMInboxViewModel, type PendingCharacterReviewViewModel } from '../features/gm-inbox';
import styles from './GMInboxPage.module.css';

export function GMInboxPage({ gameId = 'game-1' }: { gameId?: string }) {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const resolvedGameId = gameId;
  const playerInboxTo = '/inbox?mode=player';
  const gmInboxTo = `/inbox?mode=gm&gameId=${encodeURIComponent(resolvedGameId)}`;

  const [items, setItems] = useState<GMInboxItem[]>([]);
  const [notesByCharacterId, setNotesByCharacterId] = useState<Record<string, string>>({});
  const [errorsByCharacterId, setErrorsByCharacterId] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);
  const { submitEnvelopeAndAwait } = useCommandWorkflow();

  useEffect(() => {
    void refreshInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedGameId]);

  const view = useMemo(
    () => createGMInboxViewModel({ gameId: resolvedGameId, items, loading, error }),
    [error, items, loading, resolvedGameId],
  );

  return (
    <div className="l-page">
      <InboxModeTabs playerInboxTo={playerInboxTo} gmInboxTo={gmInboxTo} />
      <Panel title="Inbox" subtitle={`Pending characters and invite responses for game ${resolvedGameId}.`}>
        <ol className={styles.reviewList} aria-label="GM Pending Characters">
          {view.pendingReviews.length === 0 ? (
            <li className={styles.emptyItem}>
              <span className={`${styles.emptyText} t-small`}>{view.pendingEmptyText}</span>
            </li>
          ) : (
            view.pendingReviews.map((row) => {
              const note = notesByCharacterId[row.characterId] ?? '';
              const rowError = errorsByCharacterId[row.characterId] ?? ' ';
              const rowBusy = activeCharacterId === row.characterId;

              return (
                <li className={styles.reviewCard} key={row.key}>
                  <div className={styles.reviewHeader}>
                    <span className={`${styles.reviewTitle} t-small`}>{row.characterId}</span>
                    <span className={`${styles.reviewMeta} t-small`}>
                      {row.ownerPlayerId} - {row.submittedAt}
                    </span>
                  </div>

                  <div className={styles.reviewActions}>
                    <ButtonLink to={row.sheetHref}>Sheet</ButtonLink>
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
                </li>
              );
            })
          )}
        </ol>

        <Panel title="Invite Activity" subtitle="Player invite responses sent back to the GM inbox.">
          <ol className={styles.activityList} aria-label="GM invite activity">
            {view.inviteActivity.length === 0 ? (
              <li className={styles.emptyItem}>
                <span className={`${styles.emptyText} t-small`}>{view.activityEmptyText}</span>
              </li>
            ) : (
              view.inviteActivity.map((row) => (
                <li className={styles.activityItem} key={row.key}>
                  <div className={styles.activityHeader}>
                    <span className={`${styles.activityKind} t-small`}>{row.kind}</span>
                    <span className={`${styles.activityTime} t-small`}>{row.createdAt}</span>
                  </div>
                  <span className={`${styles.activityMessage} t-small`}>{row.message}</span>
                </li>
              ))
            )}
          </ol>
        </Panel>
      </Panel>
    </div>
  );

  async function refreshInbox() {
    setLoading(true);
    logWebFlow('WEB_GM_INBOX_REFRESH_START', {
      actorId: auth.actorId,
      authMode: auth.mode,
      gameId: resolvedGameId,
    });
    try {
      const inbox = await api.getGmInbox(resolvedGameId);
      setItems(inbox);
      setError(null);
      logWebFlow('WEB_GM_INBOX_REFRESH_OK', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId: resolvedGameId,
        count: inbox.length,
      });
    } catch (error) {
      setItems([]);
      setError(error instanceof Error ? error.message : String(error));
      logWebFlow('WEB_GM_INBOX_REFRESH_FAILED', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId: resolvedGameId,
        ...summarizeError(error),
      });
    } finally {
      setLoading(false);
    }
  }

  async function reviewRow(row: PendingCharacterReviewViewModel, decision: 'APPROVE' | 'REJECT') {
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
      gameId: resolvedGameId,
      characterId: row.characterId,
      decision,
      gmNotePresent: note.length > 0,
    });

    try {
      await submitEnvelopeAndAwait(`GM ${decision.toLowerCase()}`, {
        commandId: createCommandId(),
        gameId: resolvedGameId,
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
