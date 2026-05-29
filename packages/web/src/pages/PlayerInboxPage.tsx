import { useEffect, useMemo, useState } from 'react';
import { createApiClient, type CommandEnvelopeInput, type PregameDigestEntry } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { ButtonLink } from '../components/ButtonLink';
import { InboxModeTabs } from '../components/InboxModeTabs';
import { Panel } from '../components/Panel';
import {
  createPlayerInboxViewModel,
  normalizeRows,
  type InboxActionViewModel,
  type InboxRow,
} from '../features/player-inbox';
import { useGmGames } from '../hooks/useGmGames';
import { createCommandId, useCommandWorkflow } from '../hooks/useCommandStatus';
import { logWebFlow, summarizeError } from '../logging/flowLog';
import styles from './PlayerInboxPage.module.css';

const refreshIntervalMs = 3000;

export function PlayerInboxPage() {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const { games: gmGames, loading: gmGamesLoading } = useGmGames();
  const firstGmGameId = gmGames[0]?.gameId ?? null;
  const gmInboxTo = !gmGamesLoading && firstGmGameId
    ? `/inbox?mode=gm&gameId=${encodeURIComponent(firstGmGameId)}`
    : null;

  const [rows, setRows] = useState<InboxRow[]>([]);
  const [pregameDigest, setPregameDigest] = useState<PregameDigestEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeInviteId, setActiveInviteId] = useState<string | null>(null);
  const { submitEnvelopeAndAwait } = useCommandWorkflow();

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const refresh = async () => {
      logWebFlow('WEB_PLAYER_INBOX_REFRESH_START', {
        actorId: auth.actorId,
        authMode: auth.mode,
      });
      try {
        const [inbox, digest] = await Promise.all([api.getMyInbox(), api.getMyPregameDigest()]);
        if (cancelled) {
          return;
        }
        setRows(normalizeRows(inbox));
        setPregameDigest(digest);
        setError(null);
        logWebFlow('WEB_PLAYER_INBOX_REFRESH_OK', {
          actorId: auth.actorId,
          authMode: auth.mode,
          count: inbox.length,
          digestCount: digest.length,
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

  const view = useMemo(
    () =>
      createPlayerInboxViewModel({
        rows,
        pregameDigest,
        loading,
        error,
        activeInviteId,
      }),
    [activeInviteId, error, loading, pregameDigest, rows],
  );

  return (
    <div className="l-page">
      <InboxModeTabs playerInboxTo="/inbox?mode=player" gmInboxTo={gmInboxTo ?? undefined} />
      <Panel title="Inbox" subtitle="Character updates and game invitations.">
        <Panel title="Next Move" subtitle="Fastest path back into active pregame work.">
          <div className={`c-note c-note--info ${styles.nextMoveCard}`}>
            <div className={`t-small ${styles.nextMoveGame}`}>{view.resume.headline}</div>
            <div className="t-small">{view.resume.detail}</div>
            <ButtonLink to={view.resume.primaryAction.to}>
              {view.resume.primaryAction.label}
            </ButtonLink>
          </div>
          {view.resume.secondaryActions.length > 0 ? (
            <ol className={styles.secondaryResumeList} aria-label="Other active planning">
              {view.resume.secondaryActions.map((action) => (
                <li className={styles.secondaryResumeItem} key={action.key}>
                  <span className="t-small">{action.meta}</span>
                  <ButtonLink to={action.to}>{action.label}</ButtonLink>
                </li>
              ))}
            </ol>
          ) : null}
        </Panel>

        <Panel title="Pregame Digest" subtitle="Re-entry back into active planning loops.">
          {view.digestItems.length === 0 ? (
            <div className={`t-small ${styles.emptyText}`}>{view.digestEmptyText}</div>
          ) : (
            <ol className={styles.digestList} aria-label="Pregame Digest Items">
              {view.digestItems.map((item) => (
                <li className={styles.digestItem} key={item.key}>
                  <div className={styles.itemHeader}>
                    <span className={`t-small ${styles.itemTitle}`}>{item.gameName}</span>
                    <time className={`t-small ${styles.itemTime}`}>{item.timeLabel}</time>
                  </div>
                  <div className={styles.itemBody}>
                    <div className="t-small">{item.headline}</div>
                    <div className={`t-small ${styles.itemDetail}`}>{item.detail}</div>
                  </div>
                  <div className={styles.itemActions}>
                    <ButtonLink to={item.action.to}>{item.action.label}</ButtonLink>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        {view.inboxItems.length === 0 ? (
          <div className={`t-small ${styles.emptyText}`}>{view.inboxEmptyText}</div>
        ) : (
          <ol className={styles.inboxList} aria-label="Player Inbox Items">
            {view.inboxItems.map((item) => (
              <li className={styles.inboxItem} key={item.key}>
                <div className={styles.itemHeader}>
                  <span className={`t-small ${styles.itemTitle}`}>{item.kindLabel}</span>
                  <time className={`t-small ${styles.itemTime}`}>{item.timeLabel}</time>
                </div>
                <div className={styles.itemBody}>
                  <div className="t-small">{item.message}</div>
                </div>
                {item.actions.length > 0 ? (
                  <div className={styles.itemActions}>
                    {item.actions.map((action) => renderInboxAction(action))}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );

  function renderInboxAction(action: InboxActionViewModel) {
    if (action.kind === 'link') {
      return (
        <ButtonLink key={action.key} to={action.to}>
          {action.label}
        </ButtonLink>
      );
    }

    return (
      <button
        className={`c-btn ${action.disabled ? 'is-disabled' : ''}`.trim()}
        key={action.key}
        type="button"
        disabled={action.disabled}
        onClick={() => void respondToInvite(action)}
      >
        {action.label}
      </button>
    );
  }

  async function respondToInvite(
    action: Extract<InboxActionViewModel, { kind: 'invite-command' }>,
  ) {
    setActiveInviteId(action.inviteId);
    setError(null);
    try {
      await submitEnvelopeAndAwait(action.commandType === 'AcceptGameInvite' ? 'Accept invite' : 'Reject invite', {
        commandId: createCommandId(),
        gameId: action.gameId,
        type: action.commandType,
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        payload: {
          gameId: action.gameId,
          inviteId: action.inviteId,
        },
      } satisfies CommandEnvelopeInput<typeof action.commandType>);
      const [inbox, digest] = await Promise.all([api.getMyInbox(), api.getMyPregameDigest()]);
      setRows(normalizeRows(inbox));
      setPregameDigest(digest);
    } catch (inviteError) {
      const message = inviteError instanceof Error ? inviteError.message : String(inviteError);
      setError(message);
      logWebFlow('WEB_PLAYER_INBOX_INVITE_ACTION_FAILED', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId: action.gameId,
        inviteId: action.inviteId,
        type: action.commandType,
        ...summarizeError(inviteError),
      });
    } finally {
      setActiveInviteId(null);
    }
  }
}
