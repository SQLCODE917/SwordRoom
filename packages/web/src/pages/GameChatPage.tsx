import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { createApiClient, type CommandEnvelopeInput, type GameChatMessage, type GameChatParticipant } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { CommandStatusPanel } from '../components/CommandStatusPanel';
import { Panel } from '../components/Panel';
import { createCommandId, useCommandWorkflow } from '../hooks/useCommandStatus';
import { logWebFlow, summarizeError } from '../logging/flowLog';

interface ChatState {
  gameName: string;
  participants: GameChatParticipant[];
  messages: GameChatMessage[];
}

const emptyChatState: ChatState = {
  gameName: '',
  participants: [],
  messages: [],
};

export function GameChatPage() {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId ?? 'game-1';
  const [chat, setChat] = useState<ChatState>(emptyChatState);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [membersOpen, setMembersOpen] = useState(false);
  const hasLoadedRef = useRef(false);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const { status: commandStatus, isRunning: isSending, submitEnvelopeAndAwait } = useCommandWorkflow();

  useEffect(() => {
    let cancelled = false;

    const load = async (options?: { background?: boolean }) => {
      const background = options?.background ?? false;
      const shouldShowInitialLoading = !background && !hasLoadedRef.current;
      if (shouldShowInitialLoading) {
        setInitialLoading(true);
      }
      logWebFlow('WEB_GAME_CHAT_LOAD_START', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
        background,
      });
      try {
        const next = await api.getGameChat(gameId);
        if (cancelled) {
          return;
        }
        setChat({
          gameName: next.gameName,
          participants: next.participants,
          messages: next.messages,
        });
        hasLoadedRef.current = true;
        setError(null);
        logWebFlow('WEB_GAME_CHAT_LOAD_OK', {
          actorId: auth.actorId,
          authMode: auth.mode,
          gameId,
          background,
          participantCount: next.participants.length,
          messageCount: next.messages.length,
        });
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        if (!hasLoadedRef.current) {
          setChat(emptyChatState);
        }
        setError(loadError instanceof Error ? loadError.message : String(loadError));
        logWebFlow('WEB_GAME_CHAT_LOAD_FAILED', {
          actorId: auth.actorId,
          authMode: auth.mode,
          gameId,
          background,
          ...summarizeError(loadError),
        });
      } finally {
        if (!cancelled && shouldShowInitialLoading) {
          setInitialLoading(false);
        }
      }
    };

    void load();
    const intervalId = window.setInterval(() => {
      void load({ background: true });
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [api, auth.actorId, auth.mode, gameId]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) {
      transcript.scrollTop = transcript.scrollHeight;
    }
  }, [chat.messages.length]);

  return (
    <div className="l-page">
      <Panel
        title="Game Chat"
        subtitle={chat.gameName || 'Current game chat.'}
      >
        <CommandStatusPanel status={commandStatus} />
        <div className={`c-note ${error ? 'c-note--error' : 'c-note--info'}`}>
          <span className="t-small">
            {error ?? (initialLoading ? 'Loading chat...' : 'IRC-style table chat for current game members.')}
          </span>
        </div>

        <div className="l-row c-chat__mobile-controls">
          <button className="c-btn" type="button" onClick={() => setMembersOpen(true)}>
            Members ({chat.participants.length})
          </button>
        </div>

        <div className="c-chat__layout">
          <section className="c-chat__panel" aria-label="Game chat transcript">
            <div className="c-chat__transcript" role="log" aria-live="polite" ref={transcriptRef}>
              {chat.messages.length === 0 ? (
                <div className="c-chat__empty t-small">{initialLoading ? 'Loading messages...' : 'No chat messages yet.'}</div>
              ) : (
                chat.messages.map((message) => (
                  <div className="c-chat__line" key={message.messageId}>
                    <span className="c-chat__time">[{formatChatTimestamp(message.createdAt)}]</span>{' '}
                    <span className="c-chat__speaker">{`<${message.senderDisplayName}>`}</span>{' '}
                    <span className="c-chat__body">{message.body}</span>
                  </div>
                ))
              )}
            </div>

            <form
              className="c-chat__composer"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage();
              }}
            >
              <label className="c-field l-grow">
                <span className="c-field__label">Message</span>
                <input
                  className="c-field__control"
                  value={draftBody}
                  onChange={(event) => setDraftBody(event.target.value)}
                  disabled={isSending || Boolean(error)}
                  placeholder="Type a message"
                />
              </label>
              <button
                className={`c-btn ${isSending || draftBody.trim() === '' || Boolean(error) ? 'is-disabled' : ''}`.trim()}
                type="submit"
                disabled={isSending || draftBody.trim() === '' || Boolean(error)}
              >
                Send
              </button>
            </form>
          </section>

          <aside className="c-chat__members-panel" aria-label="Game chat members">
            <ChatMemberList participants={chat.participants} />
          </aside>
        </div>
      </Panel>

      {membersOpen ? (
        <>
          <button
            className="c-chat__mobile-backdrop"
            type="button"
            aria-label="Close members list"
            onClick={() => setMembersOpen(false)}
          />
          <div className="c-chat__mobile-sheet" role="dialog" aria-modal="true" aria-label="Game chat members">
            <div className="l-row">
              <h3 className="t-h4">Members</h3>
              <button className="c-btn" type="button" onClick={() => setMembersOpen(false)}>
                Close
              </button>
            </div>
            <ChatMemberList participants={chat.participants} />
          </div>
        </>
      ) : null}
    </div>
  );

  async function sendMessage() {
    const body = draftBody.trim();
    if (!body) {
      return;
    }

    const commandId = createCommandId();
    const createdAt = new Date().toISOString();
    setError(null);
    try {
      await submitEnvelopeAndAwait('Send chat message', {
        commandId,
        gameId,
        type: 'SendGameChatMessage',
        schemaVersion: 1,
        createdAt,
        payload: {
          body,
        },
      } satisfies CommandEnvelopeInput<'SendGameChatMessage'>);
      setDraftBody('');
      setChat((current) => ({
        ...current,
        messages: [
          ...current.messages,
          {
            messageId: commandId,
            senderPlayerId: auth.actorId,
            senderDisplayName: readSenderDisplayName(current.participants, auth.actorId),
            senderRole: readSenderRole(current.participants, auth.actorId),
            senderCharacterId: readSenderCharacterId(current.participants, auth.actorId),
            body,
            createdAt,
          },
        ],
      }));
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : String(sendError));
    }
  }
}

function ChatMemberList({ participants }: { participants: GameChatParticipant[] }) {
  return (
    <div className="c-chat__members">
      <h3 className="t-h4">Members</h3>
      <ul className="c-chat__member-list" role="list">
        {participants.length === 0 ? (
          <li className="c-chat__member t-small">No members found.</li>
        ) : (
          participants.map((participant) => (
            <li className="c-chat__member" key={participant.playerId} role="listitem">
              <span className="c-chat__member-name">{participant.displayName}</span>
              <span className="c-chat__member-role t-small">{participant.role}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function formatChatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '??:??';
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function readSenderParticipant(participants: GameChatParticipant[], actorId: string): GameChatParticipant | null {
  return participants.find((participant) => participant.playerId === actorId) ?? null;
}

function readSenderDisplayName(participants: GameChatParticipant[], actorId: string): string {
  return readSenderParticipant(participants, actorId)?.displayName ?? actorId;
}

function readSenderRole(participants: GameChatParticipant[], actorId: string): GameChatMessage['senderRole'] {
  return readSenderParticipant(participants, actorId)?.role ?? 'PLAYER';
}

function readSenderCharacterId(participants: GameChatParticipant[], actorId: string): string | null {
  return readSenderParticipant(participants, actorId)?.characterId ?? null;
}
