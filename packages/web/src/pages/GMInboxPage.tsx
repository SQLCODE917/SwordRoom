import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { createApiClient, type CommandStatusResponse, type GMInboxItem } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { CommandStatusPanel } from '../components/CommandStatusPanel';
import { Panel } from '../components/Panel';
import type { CommandStatusViewModel } from '../hooks/useCommandStatus';

const pollIntervalsMs = [400, 800, 1200, 1800, 2600];

export function GMInboxPage() {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId ?? 'game-1';

  const [rows, setRows] = useState<GMInboxItem[]>([]);
  const [notesByCharacterId, setNotesByCharacterId] = useState<Record<string, string>>({});
  const [errorsByCharacterId, setErrorsByCharacterId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);
  const [commandStatus, setCommandStatus] = useState<CommandStatusViewModel>({
    state: 'Idle',
    commandId: null,
    message: 'No command submitted yet.',
    errorCode: null,
    errorMessage: null,
  });

  useEffect(() => {
    void refreshInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  return (
    <div className="l-page">
      <Panel title="GM Inbox" subtitle={`Pending characters for game ${gameId}.`}>
        <CommandStatusPanel status={commandStatus} />

        <div className="c-table" role="table" aria-label="GM Pending Characters">
          <div className="c-table__head c-table__row" role="row">
            <div className="c-table__cell t-small">Character</div>
            <div className="c-table__cell t-small">Owner</div>
            <div className="c-table__cell t-small">Submitted</div>
            <div className="c-table__cell t-small">Review</div>
          </div>

          {rows.length === 0 ? (
            <div className="c-table__row" role="row">
              <div className="c-table__cell t-small">No pending characters.</div>
            </div>
          ) : (
            rows.map((row) => {
              const note = notesByCharacterId[row.characterId] ?? '';
              const rowError = errorsByCharacterId[row.characterId] ?? ' ';
              const rowBusy = activeCharacterId === row.characterId;

              return (
                <div className="c-table__row" role="row" key={`${row.characterId}-${row.submittedAt}`}>
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
      </Panel>
    </div>
  );

  async function refreshInbox() {
    setLoading(true);
    try {
      const inbox = await api.getGmInbox(gameId);
      const normalized = inbox.filter((item): item is GMInboxItem => Boolean(item?.characterId && item?.submittedAt));
      setRows(normalized);
    } finally {
      setLoading(false);
    }
  }

  async function reviewRow(row: GMInboxItem, decision: 'APPROVE' | 'REJECT') {
    const note = (notesByCharacterId[row.characterId] ?? '').trim();
    if (decision === 'REJECT' && note === '') {
      setErrorsByCharacterId((prev) => ({ ...prev, [row.characterId]: 'Rejection note is required.' }));
      return;
    }

    setErrorsByCharacterId((prev) => ({ ...prev, [row.characterId]: ' ' }));
    setActiveCharacterId(row.characterId);

    try {
      const commandId = createCommandId();
      await api.postCommand({
        envelope: {
          commandId,
          gameId,
          type: 'GMReviewCharacter',
          schemaVersion: 1,
          createdAt: new Date().toISOString(),
          payload: {
            characterId: row.characterId,
            decision,
            gmNote: note || undefined,
          },
        },
      });

      setCommandStatus({
        state: 'Queued',
        commandId,
        message: `GM ${decision.toLowerCase()} command queued.`,
        errorCode: null,
        errorMessage: null,
      });

      const terminal = await pollUntilTerminal(commandId);
      if (terminal.status === 'PROCESSED') {
        await refreshInbox();
        return;
      }

      setErrorsByCharacterId((prev) => ({
        ...prev,
        [row.characterId]: terminal.errorMessage ?? terminal.errorCode ?? 'Review command failed.',
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorsByCharacterId((prev) => ({ ...prev, [row.characterId]: message }));
      setCommandStatus((prev) => ({
        ...prev,
        state: 'Failed',
        message: 'GM review command failed.',
        errorCode: prev.errorCode,
        errorMessage: message,
      }));
    } finally {
      setActiveCharacterId(null);
    }
  }

  async function pollUntilTerminal(commandId: string): Promise<CommandStatusResponse> {
    let attempt = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const response = await api.getCommandStatus(commandId);
      if (!response) {
        await sleep(pollIntervalsMs[Math.min(attempt, pollIntervalsMs.length - 1)] ?? 2600);
        attempt += 1;
        continue;
      }

      setCommandStatus(mapStatus(response));

      if (response.status === 'PROCESSED' || response.status === 'FAILED') {
        return response;
      }

      await sleep(pollIntervalsMs[Math.min(attempt, pollIntervalsMs.length - 1)] ?? 2600);
      attempt += 1;
    }
  }
}

function mapStatus(response: CommandStatusResponse): CommandStatusViewModel {
  if (response.status === 'FAILED') {
    return {
      state: 'Failed',
      commandId: response.commandId,
      message: 'GM review command failed.',
      errorCode: response.errorCode,
      errorMessage: response.errorMessage,
    };
  }

  if (response.status === 'PROCESSED') {
    return {
      state: 'Processed',
      commandId: response.commandId,
      message: 'GM review command processed.',
      errorCode: null,
      errorMessage: null,
    };
  }

  if (response.status === 'PROCESSING') {
    return {
      state: 'Processing',
      commandId: response.commandId,
      message: 'GM review command processing.',
      errorCode: null,
      errorMessage: null,
    };
  }

  return {
    state: 'Queued',
    commandId: response.commandId,
    message: 'GM review command queued.',
    errorCode: null,
    errorMessage: null,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createCommandId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const nowHex = Date.now().toString(16).padStart(12, '0').slice(-12);
  return `00000000-0000-4000-8000-${nowHex}`;
}
