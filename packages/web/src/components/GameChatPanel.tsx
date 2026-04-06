import type { RefObject } from 'react';
import type { GameChatState } from '../hooks/useGameChat';
import { CommandStatusPanel } from './CommandStatusPanel';
import type { CommandStatusViewModel } from '../hooks/useCommandStatus';

interface GameChatPanelProps {
  chat: GameChatState;
  initialLoading: boolean;
  error: string | null;
  draftBody: string;
  setDraftBody: (value: string) => void;
  membersOpen: boolean;
  setMembersOpen: (value: boolean) => void;
  transcriptRef: RefObject<HTMLDivElement>;
  isSending: boolean;
  commandStatus: CommandStatusViewModel;
  onSendMessage: () => Promise<void>;
}

export function GameChatPanel({
  chat,
  initialLoading,
  error,
  draftBody,
  setDraftBody,
  membersOpen,
  setMembersOpen,
  transcriptRef,
  isSending,
  commandStatus,
  onSendMessage,
}: GameChatPanelProps) {
  return (
    <>
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
              void onSendMessage();
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
    </>
  );
}

function ChatMemberList({ participants }: { participants: GameChatState['participants'] }) {
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
  if (!value) {
    return '--:--';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
