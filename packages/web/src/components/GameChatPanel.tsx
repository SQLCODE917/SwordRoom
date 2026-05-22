import { useState, type RefObject } from 'react';
import type {
  GameChatReplyTarget,
  SharedCharacterDraftArtifact,
  SharedCharacterDraftReaction,
  SharedGamePromptArtifact,
  SharedPartyRoleClaimArtifact,
} from '@starter/shared';
import type { GameChatState } from '../hooks/useGameChat';
import { ButtonLink } from './ButtonLink';
import styles from './GameChatPanel.module.css';
import { formatPregameRoleList } from '../features/pregame-planning/labels';
import {
  buildCharacterDraftReactionSummaryLabel,
  CHARACTER_DRAFT_REACTION_OPTIONS,
} from '../features/pregame-planning/reactions';

interface GameChatPanelProps {
  chat: GameChatState;
  initialLoading: boolean;
  draftBody: string;
  setDraftBody: (value: string) => void;
  activeReplyTarget: GameChatReplyTarget | null;
  onClearReplyTarget: () => void;
  membersOpen: boolean;
  setMembersOpen: (value: boolean) => void;
  transcriptRef: RefObject<HTMLDivElement>;
  isSending: boolean;
  onSendMessage: () => Promise<void>;
  onReactToArtifact: (input: {
    targetMessageId: string;
    artifact: SharedCharacterDraftArtifact;
    reaction: SharedCharacterDraftReaction;
  }) => Promise<void>;
  onReplyToArtifact: (input: {
    targetMessageId: string;
    artifact: SharedCharacterDraftArtifact;
  }) => void;
  onReplyToPrompt: (input: {
    targetMessageId: string;
    artifact: SharedGamePromptArtifact;
  }) => void;
  activeArtifactMessageId: string | null;
}

export function GameChatPanel({
  chat,
  initialLoading,
  draftBody,
  setDraftBody,
  activeReplyTarget,
  onClearReplyTarget,
  membersOpen,
  setMembersOpen,
  transcriptRef,
  isSending,
  onSendMessage,
  onReactToArtifact,
  onReplyToArtifact,
  onReplyToPrompt,
  activeArtifactMessageId,
}: GameChatPanelProps) {
  const [previewArtifact, setPreviewArtifact] = useState<PreviewArtifactState | null>(null);
  const visibleMessages = chat.messages.filter((message) => message.artifact?.kind !== 'CHARACTER_DRAFT_REACTION');
  const activeArtifactEntry = findActiveArtifactEntry(visibleMessages, activeArtifactMessageId);

  const closePreview = () => setPreviewArtifact(null);
  const replyTargetLabel = readReplyTargetLabel(chat.messages, activeReplyTarget);

  return (
    <>
      {activeArtifactEntry && activeArtifactEntry.artifact?.kind === 'CHARACTER_DRAFT' ? (
        <section className={`c-note c-note--info ${styles.focus}`} aria-label="Active draft discussion">
          <div className="l-col">
            <div className="t-small">Active discussion</div>
            <div className="t-small">{`${activeArtifactEntry.artifact.characterName} v${activeArtifactEntry.artifact.snapshotVersion} is the current draft under discussion.`}</div>
            <div className="t-small">{`Share: ${formatCharacterDraftIntent(activeArtifactEntry.artifact)}`}</div>
            {activeArtifactEntry.artifact.contextNote ? <div className="t-small">{activeArtifactEntry.artifact.contextNote}</div> : null}
            <div className="t-small">Reply here to discuss it, or open Characters to review it in the workbench.</div>
          </div>
          <div className={`l-row ${styles.artifactActions}`}>
            <button
              className="c-btn"
              type="button"
              onClick={() =>
                onReplyToArtifact({
                  targetMessageId: activeArtifactEntry.messageId,
                  artifact: activeArtifactEntry.artifact,
                })
              }
            >
              Reply To Active Draft
            </button>
            <ButtonLink to={buildCharacterReviewTo(chat.gameId, activeArtifactEntry.messageId)}>Open In Characters</ButtonLink>
            <ButtonLink to={`/games/${encodeURIComponent(chat.gameId)}/characters/${encodeURIComponent(activeArtifactEntry.artifact.characterId)}`}>
              Open Sheet
            </ButtonLink>
          </div>
        </section>
      ) : null}

      <div className={`l-row ${styles.mobileControls}`}>
        <button className="c-btn" type="button" onClick={() => setMembersOpen(true)}>
          Members ({chat.participants.length})
        </button>
      </div>

      <div className={styles.layout}>
        <section className={styles.panel} aria-label="Game chat transcript">
          <div className={styles.transcript} role="log" aria-live="polite" ref={transcriptRef}>
            {visibleMessages.length === 0 ? (
              <div className={`${styles.empty} t-small`}>{initialLoading ? 'Loading messages...' : 'No chat messages yet.'}</div>
            ) : (
              visibleMessages.map((message) => {
                const characterArtifact = message.artifact?.kind === 'CHARACTER_DRAFT' ? message.artifact : null;
                const promptArtifact = message.artifact?.kind === 'GAME_PROMPT' ? message.artifact : null;
                const roleClaimArtifact = message.artifact?.kind === 'PARTY_ROLE_CLAIM' ? message.artifact : null;
                const reactionSummaryLabel = characterArtifact
                  ? buildCharacterDraftReactionSummaryLabel(chat.messages, message.messageId)
                  : null;

                return (
                  <div
                    className={`${styles.line} ${message.messageId === activeArtifactMessageId ? styles.lineActive : ''}`.trim()}
                    key={message.messageId}
                  >
                    <span className={styles.time}>[{formatChatTimestamp(message.createdAt)}]</span>{' '}
                    <span className={styles.speaker}>{`<${message.senderDisplayName}>`}</span>{' '}
                    <span className={styles.body}>{message.body}</span>
                    {message.replyTarget ? (
                      <div className="t-small">{readReplyTargetLabel(chat.messages, message.replyTarget)}</div>
                    ) : null}
                    {characterArtifact ? (
                      <div className={`c-note c-note--info ${styles.artifactCard}`}>
                        <div className="t-small">{`${characterArtifact.characterName} (${characterArtifact.race}) v${characterArtifact.snapshotVersion}`}</div>
                        <div className="t-small">{`Status: ${characterArtifact.status}`}</div>
                        <div className="t-small">{`Share: ${formatCharacterDraftIntent(characterArtifact)}`}</div>
                        {characterArtifact.contextNote ? <div className="t-small">{characterArtifact.contextNote}</div> : null}
                        <div className="t-small">{characterArtifact.abilitySummary.join(' | ') || 'No ability summary.'}</div>
                        <div className="t-small">
                          {characterArtifact.skillSummary.length > 0 ? `Skills: ${characterArtifact.skillSummary.join(', ')}` : 'Skills: none yet'}
                        </div>
                        {reactionSummaryLabel ? <div className="t-small">{`Reactions: ${reactionSummaryLabel}`}</div> : null}
                        <div className={`l-row ${styles.artifactActions}`}>
                          <button
                            className="c-btn"
                            type="button"
                            onClick={() =>
                              setPreviewArtifact({
                                senderDisplayName: message.senderDisplayName,
                                messageId: message.messageId,
                                artifact: characterArtifact,
                              })
                            }
                          >
                            Preview
                          </button>
                          <button
                            className="c-btn"
                            type="button"
                            onClick={() =>
                              onReplyToArtifact({
                                targetMessageId: message.messageId,
                                artifact: characterArtifact,
                              })
                            }
                          >
                            Reply
                          </button>
                          <ButtonLink to={buildCharacterReviewTo(chat.gameId, message.messageId)}>Open In Characters</ButtonLink>
                          <ButtonLink to={`/games/${encodeURIComponent(chat.gameId)}/characters/${encodeURIComponent(characterArtifact.characterId)}`}>
                            Open Sheet
                          </ButtonLink>
                        </div>
                        <div className={`l-row ${styles.artifactActions}`}>
                          {CHARACTER_DRAFT_REACTION_OPTIONS.map((reactionOption) => (
                            <button
                              key={reactionOption.value}
                              className={`c-btn ${isSending ? 'is-disabled' : ''}`.trim()}
                              type="button"
                              disabled={isSending}
                              onClick={() =>
                                void onReactToArtifact({
                                  targetMessageId: message.messageId,
                                  artifact: characterArtifact,
                                  reaction: reactionOption.value,
                                })
                              }
                            >
                              {reactionOption.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {promptArtifact ? (
                      <PromptArtifactCard
                        artifact={promptArtifact}
                        onReply={() =>
                          onReplyToPrompt({
                            targetMessageId: message.messageId,
                            artifact: promptArtifact,
                          })
                        }
                      />
                    ) : null}
                    {roleClaimArtifact ? <RoleClaimArtifactCard artifact={roleClaimArtifact} /> : null}
                  </div>
                );
              })
            )}
          </div>

          <form
            className={styles.composer}
            onSubmit={(event) => {
              event.preventDefault();
              void onSendMessage();
            }}
          >
            {replyTargetLabel ? (
              <div className="c-note c-note--info">
                <div className="l-row">
                  <span className="t-small">{replyTargetLabel}</span>
                  <button className="c-btn" type="button" onClick={onClearReplyTarget}>
                    Clear Reply Target
                  </button>
                </div>
              </div>
            ) : null}
            <label className="c-field l-grow">
              <span className="c-field__label">Message</span>
              <input
                className="c-field__control"
                value={draftBody}
                onChange={(event) => setDraftBody(event.target.value)}
                disabled={isSending}
                placeholder="Type a message"
              />
            </label>
            <button
              className={`c-btn ${isSending || draftBody.trim() === '' ? 'is-disabled' : ''}`.trim()}
              type="submit"
              disabled={isSending || draftBody.trim() === ''}
            >
              Send
            </button>
          </form>
        </section>

        <aside className={styles.membersPanel} aria-label="Game chat members">
          <ChatMemberList participants={chat.participants} />
        </aside>
      </div>

      {membersOpen ? (
        <>
          <button
            className={styles.mobileBackdrop}
            type="button"
            aria-label="Close members list"
            onClick={() => setMembersOpen(false)}
          />
          <div className={styles.mobileSheet} role="dialog" aria-modal="true" aria-label="Game chat members">
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
            className={styles.mobileBackdrop}
            type="button"
            aria-label="Close character preview"
            onClick={closePreview}
          />
          <section className={`${styles.mobileSheet} ${styles.previewSheet}`} role="dialog" aria-modal="true" aria-label="Character draft preview">
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
              <div className="t-small">{`Reactions: ${buildCharacterDraftReactionSummaryLabel(chat.messages, previewArtifact.messageId)}`}</div>
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

            <div className={`l-row ${styles.artifactActions}`}>
              <button
                className="c-btn"
                type="button"
                onClick={() => {
                  onReplyToArtifact({
                    targetMessageId: previewArtifact.messageId,
                    artifact: previewArtifact.artifact,
                  });
                  closePreview();
                }}
              >
                Reply
              </button>
              {CHARACTER_DRAFT_REACTION_OPTIONS.map((reactionOption) => (
                <button
                  key={reactionOption.value}
                  className={`c-btn ${isSending ? 'is-disabled' : ''}`.trim()}
                  type="button"
                  disabled={isSending}
                  onClick={() =>
                    void onReactToArtifact({
                      targetMessageId: previewArtifact.messageId,
                      artifact: previewArtifact.artifact,
                      reaction: reactionOption.value,
                    })
                  }
                >
                  {reactionOption.label}
                </button>
              ))}
              <ButtonLink to={buildCharacterReviewTo(chat.gameId, previewArtifact.messageId)}>Open In Characters</ButtonLink>
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

function PromptArtifactCard({
  artifact,
  onReply,
}: {
  artifact: SharedGamePromptArtifact;
  onReply: () => void;
}) {
  return (
    <div className={`c-note c-note--info ${styles.artifactCard}`}>
      <div className="t-small">{artifact.title}</div>
      <div className="t-small">{artifact.prompt}</div>
      {artifact.suggestedRoles.length > 0 ? (
        <div className="t-small">{`Suggested roles: ${formatPregameRoleList(artifact.suggestedRoles)}`}</div>
      ) : null}
      <div className={`l-row ${styles.artifactActions}`}>
        <button className="c-btn" type="button" onClick={onReply}>
          Reply
        </button>
      </div>
    </div>
  );
}

function RoleClaimArtifactCard({ artifact }: { artifact: SharedPartyRoleClaimArtifact }) {
  return (
    <div className={`c-note c-note--info ${styles.artifactCard}`}>
      <div className="t-small">{`${artifact.characterName} claims ${formatPregameRoleList(artifact.roles)}`}</div>
      <div className="t-small">{`Snapshot v${artifact.snapshotVersion}`}</div>
      {artifact.note ? <div className="t-small">{artifact.note}</div> : null}
    </div>
  );
}

interface PreviewArtifactState {
  senderDisplayName: string;
  messageId: string;
  artifact: SharedCharacterDraftArtifact;
}

interface ActiveArtifactEntry {
  messageId: string;
  artifact: SharedCharacterDraftArtifact;
}

function ChatMemberList({ participants }: { participants: GameChatState['participants'] }) {
  return (
    <div className={styles.members}>
      <h3 className="t-h4">Members</h3>
      <ul className={styles.memberList} role="list">
        {participants.length === 0 ? (
          <li className={`${styles.member} t-small`}>No members found.</li>
        ) : (
          participants.map((participant) => (
            <li className={styles.member} key={participant.playerId} role="listitem">
              <span className={styles.memberName}>{participant.displayName}</span>
              <span className={`${styles.memberRole} t-small`}>{participant.role}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function findActiveArtifactEntry(messages: GameChatState['messages'], activeArtifactMessageId: string | null): ActiveArtifactEntry | null {
  if (activeArtifactMessageId === null) {
    return null;
  }

  for (const message of messages) {
    if (message.messageId !== activeArtifactMessageId) {
      continue;
    }
    if (message.artifact?.kind !== 'CHARACTER_DRAFT') {
      return null;
    }
    return {
      messageId: message.messageId,
      artifact: message.artifact,
    };
  }

  return null;
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

function buildCharacterReviewTo(gameId: string, sharedRowKey: string): string {
  const searchParams = new URLSearchParams();
  searchParams.set('shared', sharedRowKey);
  return `/games/${encodeURIComponent(gameId)}/characters?${searchParams.toString()}`;
}

function formatCharacterDraftIntent(artifact: SharedCharacterDraftArtifact): string {
  if (artifact.shareIntent === 'ASK_QUESTION') {
    return 'Ask a question';
  }
  if (artifact.shareIntent === 'COMPARE_DIRECTIONS') {
    return 'Compare directions';
  }
  if (artifact.shareIntent === 'ANSWER_GM_PROMPT') {
    return 'Answer GM prompt';
  }
  return 'Draft snapshot';
}

function readReplyTargetLabel(messages: GameChatState['messages'], replyTarget: GameChatReplyTarget | null): string | null {
  if (!replyTarget) {
    return null;
  }

  const targetMessage = messages.find((message) => message.messageId === replyTarget.targetMessageId);
  if (replyTarget.kind === 'CHARACTER_DRAFT') {
    const targetArtifact = targetMessage?.artifact?.kind === 'CHARACTER_DRAFT' ? targetMessage.artifact : null;
    if (!targetArtifact) {
      return 'Replying to shared draft';
    }
    return `Replying to ${targetArtifact.characterName} v${targetArtifact.snapshotVersion}`;
  }

  const targetArtifact = targetMessage?.artifact?.kind === 'GAME_PROMPT' ? targetMessage.artifact : null;
  if (!targetArtifact) {
    return 'Replying to GM prompt';
  }
  return `Replying to prompt: ${targetArtifact.title}`;
}
