import { useState, type RefObject } from 'react';
import type { SharedCharacterDraftArtifact, SharedGamePromptArtifact, SharedPartyRoleClaimArtifact } from '@starter/shared';
import type { GameChatState } from '../hooks/useGameChat';
import { CommandStatusPanel } from './CommandStatusPanel';
import type { CommandStatusViewModel } from '../hooks/useCommandStatus';
import { ButtonLink } from './ButtonLink';
import { formatPregameRoleList } from '../features/pregame-planning/labels';

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
  const [previewArtifact, setPreviewArtifact] = useState<PreviewArtifactState | null>(null);

  const closePreview = () => setPreviewArtifact(null);
  const replyToArtifact = (artifact: SharedCharacterDraftArtifact) => {
    setDraftBody(buildArtifactReplyDraft(artifact, draftBody));
    setPreviewArtifact(null);
  };

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
              chat.messages.map((message) => {
                const characterArtifact = message.artifact?.kind === 'CHARACTER_DRAFT' ? message.artifact : null;
                const promptArtifact = message.artifact?.kind === 'GAME_PROMPT' ? message.artifact : null;
                const roleClaimArtifact = message.artifact?.kind === 'PARTY_ROLE_CLAIM' ? message.artifact : null;

                return (
                  <div className="c-chat__line" key={message.messageId}>
                    <span className="c-chat__time">[{formatChatTimestamp(message.createdAt)}]</span>{' '}
                    <span className="c-chat__speaker">{`<${message.senderDisplayName}>`}</span>{' '}
                    <span className="c-chat__body">{message.body}</span>
                    {characterArtifact ? (
                      <div className="c-note c-note--info c-chat__artifact-card">
                        <div className="t-small">{`${characterArtifact.characterName} (${characterArtifact.race}) v${characterArtifact.snapshotVersion}`}</div>
                        <div className="t-small">{`Status: ${characterArtifact.status}`}</div>
                        <div className="t-small">{`Share: ${formatCharacterDraftIntent(characterArtifact)}`}</div>
                        {characterArtifact.contextNote ? <div className="t-small">{characterArtifact.contextNote}</div> : null}
                        <div className="t-small">{characterArtifact.abilitySummary.join(' | ') || 'No ability summary.'}</div>
                        <div className="t-small">
                          {characterArtifact.skillSummary.length > 0 ? `Skills: ${characterArtifact.skillSummary.join(', ')}` : 'Skills: none yet'}
                        </div>
                        <div className="l-row c-chat__artifact-actions">
                          <button
                            className="c-btn"
                            type="button"
                            onClick={() =>
                              setPreviewArtifact({
                                senderDisplayName: message.senderDisplayName,
                                artifact: characterArtifact,
                              })
                            }
                          >
                            Preview
                          </button>
                          <button className="c-btn" type="button" onClick={() => replyToArtifact(characterArtifact)}>
                            Reply
                          </button>
                          <ButtonLink to={`/games/${encodeURIComponent(chat.gameId)}/characters/${encodeURIComponent(characterArtifact.characterId)}`}>
                            Open Sheet
                          </ButtonLink>
                        </div>
                      </div>
                    ) : null}
                    {promptArtifact ? <PromptArtifactCard artifact={promptArtifact} /> : null}
                    {roleClaimArtifact ? <RoleClaimArtifactCard artifact={roleClaimArtifact} /> : null}
                  </div>
                );
              })
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

      {previewArtifact ? (
        <>
          <button
            className="c-chat__mobile-backdrop"
            type="button"
            aria-label="Close character preview"
            onClick={closePreview}
          />
          <section className="c-chat__mobile-sheet c-chat__preview-sheet" role="dialog" aria-modal="true" aria-label="Character draft preview">
            <div className="l-row">
              <h3 className="t-h4">{`${previewArtifact.artifact.characterName} v${previewArtifact.artifact.snapshotVersion}`}</h3>
              <button className="c-btn" type="button" onClick={closePreview}>
                Close
              </button>
            </div>

            <div className="c-note c-note--info">
              <div className="t-small">{`Shared by ${previewArtifact.senderDisplayName}`}</div>
              <div className="t-small">{`${previewArtifact.artifact.race} • ${previewArtifact.artifact.status}`}</div>
              <div className="t-small">{`Share: ${formatCharacterDraftIntent(previewArtifact.artifact)}`}</div>
              {previewArtifact.artifact.contextNote ? <div className="t-small">{previewArtifact.artifact.contextNote}</div> : null}
            </div>

            <div className="c-note c-note--info">
              <div className="t-small">Snapshot</div>
              <div className="t-small">
                {previewArtifact.artifact.abilitySummary.join(' | ') || 'No ability summary.'}
              </div>
              <div className="t-small">
                {previewArtifact.artifact.skillSummary.length > 0
                  ? `Skills: ${previewArtifact.artifact.skillSummary.join(', ')}`
                  : 'Skills: none yet'}
              </div>
            </div>

            <div className="l-row c-chat__artifact-actions">
              <button className="c-btn" type="button" onClick={() => replyToArtifact(previewArtifact.artifact)}>
                Reply
              </button>
              <ButtonLink
                to={`/games/${encodeURIComponent(chat.gameId)}/characters/${encodeURIComponent(previewArtifact.artifact.characterId)}`}
              >
                Open Full Sheet
              </ButtonLink>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}

function PromptArtifactCard({ artifact }: { artifact: SharedGamePromptArtifact }) {
  return (
    <div className="c-note c-note--info c-chat__artifact-card">
      <div className="t-small">{artifact.title}</div>
      <div className="t-small">{artifact.prompt}</div>
      {artifact.suggestedRoles.length > 0 ? (
        <div className="t-small">{`Suggested roles: ${formatPregameRoleList(artifact.suggestedRoles)}`}</div>
      ) : null}
    </div>
  );
}

function RoleClaimArtifactCard({ artifact }: { artifact: SharedPartyRoleClaimArtifact }) {
  return (
    <div className="c-note c-note--info c-chat__artifact-card">
      <div className="t-small">{`${artifact.characterName} claims ${formatPregameRoleList(artifact.roles)}`}</div>
      <div className="t-small">{`Snapshot v${artifact.snapshotVersion}`}</div>
      {artifact.note ? <div className="t-small">{artifact.note}</div> : null}
    </div>
  );
}

interface PreviewArtifactState {
  senderDisplayName: string;
  artifact: SharedCharacterDraftArtifact;
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

function buildArtifactReplyDraft(artifact: SharedCharacterDraftArtifact, currentDraftBody: string): string {
  const prefix = `About ${artifact.characterName} v${artifact.snapshotVersion}: `;
  const trimmedDraft = currentDraftBody.trim();
  if (!trimmedDraft) {
    return prefix;
  }
  if (trimmedDraft.includes(prefix)) {
    return currentDraftBody;
  }
  return `${currentDraftBody.trimEnd()}\n${prefix}`;
}

function formatCharacterDraftIntent(artifact: SharedCharacterDraftArtifact): string {
  if (artifact.shareIntent === 'ASK_QUESTION') {
    return 'Ask a question';
  }
  if (artifact.shareIntent === 'ANSWER_GM_PROMPT') {
    return 'Answer GM prompt';
  }
  return 'Draft snapshot';
}
