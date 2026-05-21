import { useEffect, useMemo, useState } from 'react';
import { createApiClient, type CommandEnvelopeInput, type PlayerInboxItem, type PregameDigestEntry } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { ButtonLink } from '../components/ButtonLink';
import { CommandStatusPanel } from '../components/CommandStatusPanel';
import { Panel } from '../components/Panel';
import { appendCharacterWizardEntryContext } from '../features/character-wizard';
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
  const [pregameDigest, setPregameDigest] = useState<PregameDigestEntry[]>([]);
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

  const noticeClassName = useMemo(() => `c-note ${error ? 'c-note--error' : 'c-note--info'}`, [error]);
  const placeholderText = loading ? 'Loading inbox...' : 'No inbox items yet.';
  const quickResume = useMemo(() => createPregameResumeViewModel(pregameDigest), [pregameDigest]);

  return (
    <div className="l-page">
      <Panel title="Player Inbox" subtitle="Character updates and game invitations.">
        <CommandStatusPanel status={commandStatus} />
        <div className={noticeClassName} role="note" aria-live="polite">
          <span className="t-small">{error ?? 'Inbox refreshes automatically.'}</span>
        </div>

        <Panel title="Resume Planning" subtitle="Fastest path back into active pregame work.">
          <div className="c-note c-note--info">
            <div className="t-small">{quickResume.headline}</div>
            <div className="t-small">{quickResume.detail}</div>
          </div>
          <div className="l-row">
            <ButtonLink to={quickResume.primaryAction.to}>{quickResume.primaryAction.label}</ButtonLink>
            {quickResume.secondaryActions.map((action) => (
              <ButtonLink key={`${action.label}:${action.to}`} to={action.to}>
                {action.label}
              </ButtonLink>
            ))}
          </div>
        </Panel>

        <Panel title="Pregame Digest" subtitle="Re-entry back into active planning loops.">
          <div className="c-table" role="table" aria-label="Pregame Digest Items">
            <div className="c-table__head c-table__row" role="row">
              <div className="c-table__cell t-small">Game</div>
              <div className="c-table__cell t-small">What Changed</div>
              <div className="c-table__cell t-small">When</div>
              <div className="c-table__cell t-small">Action</div>
            </div>
            {pregameDigest.length === 0 ? (
              <div className="c-table__row" role="row">
                <div className="c-table__cell t-small">{loading ? 'Loading pregame digest...' : 'No active pregame re-entry items.'}</div>
              </div>
            ) : (
              pregameDigest.map((entry) => (
                <div className="c-table__row" role="row" key={entry.digestId}>
                  <div className="c-table__cell t-small">{entry.gameName}</div>
                  <div className="c-table__cell t-small">
                    <div>{entry.headline}</div>
                    <div>{entry.detail}</div>
                  </div>
                  <div className="c-table__cell t-small">{entry.createdAt}</div>
                  <div className="c-table__cell t-small">
                    <ButtonLink to={toPregameDigestPath(entry)}>{readPregameDigestActionLabel(entry)}</ButtonLink>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

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
                        <ButtonLink to={`/games/${encodeURIComponent(row.gameId)}/characters/${encodeURIComponent(row.characterId)}`}>
                          Open
                        </ButtonLink>
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
      const [inbox, digest] = await Promise.all([api.getMyInbox(), api.getMyPregameDigest()]);
      setRows(normalizeRows(inbox));
      setPregameDigest(digest);
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

function toPregameDigestPath(entry: PregameDigestEntry): string {
  if (entry.destination === 'CHAT') {
    return `/games/${encodeURIComponent(entry.gameId)}/chat`;
  }
  if (entry.destination === 'CREATE_CHARACTER') {
    return appendCharacterWizardEntryContext(`/games/${encodeURIComponent(entry.gameId)}/character/new`, {
      entrySource: 'digest',
      focus: 'resume',
    });
  }
  if (entry.destination === 'EDIT_CHARACTER' && entry.characterId) {
    return appendCharacterWizardEntryContext(
      `/games/${encodeURIComponent(entry.gameId)}/characters/${encodeURIComponent(entry.characterId)}/edit`,
      { entrySource: 'digest', focus: 'resume' }
    );
  }
  return `/games/${encodeURIComponent(entry.gameId)}`;
}

function readPregameDigestActionLabel(entry: PregameDigestEntry): string {
  if (entry.destination === 'CHAT') {
    return 'Open Chat';
  }
  if (entry.destination === 'CREATE_CHARACTER') {
    return 'Create Character';
  }
  if (entry.destination === 'EDIT_CHARACTER') {
    return 'Edit Draft';
  }
  return 'Open Lobby';
}

interface ResumeAction {
  label: string;
  to: string;
}

interface PregameResumeViewModel {
  headline: string;
  detail: string;
  primaryAction: ResumeAction;
  secondaryActions: ResumeAction[];
}

function createPregameResumeViewModel(entries: readonly PregameDigestEntry[]): PregameResumeViewModel {
  const primary = entries[0] ?? null;
  if (!primary) {
    return {
      headline: 'No active pregame re-entry items',
      detail: 'When a game needs your attention, the next planning move will appear here.',
      primaryAction: {
        label: 'Open Home',
        to: '/',
      },
      secondaryActions: [],
    };
  }

  return {
    headline: `Resume planning in ${primary.gameName}`,
    detail: primary.headline,
    primaryAction: {
      label: readPregameDigestActionLabel(primary),
      to: toPregameDigestPath(primary),
    },
    secondaryActions: entries.slice(1, 3).map((entry) => ({
      label: `${readPregameDigestActionLabel(entry)}: ${entry.gameName}`,
      to: toPregameDigestPath(entry),
    })),
  };
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
