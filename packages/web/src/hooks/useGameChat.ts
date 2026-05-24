import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type {
  GameChatChannel,
  GameChatReplyTarget,
  SharedCharacterDraftArtifact,
  SharedCharacterDraftReaction,
  SharedGamePromptArtifact,
} from '@starter/shared';
import { createApiClient, type CommandEnvelopeInput, type GameChatMessage, type GameChatParticipant } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { logWebFlow, summarizeError } from '../logging/flowLog';
import { createCommandId, useCommandWorkflow } from './useCommandStatus';
import { formatCharacterDraftReaction } from '../features/pregame-planning/reactions';

export interface GameChatState {
  gameId: string;
  gameName: string;
  participants: GameChatParticipant[];
  messages: GameChatMessage[];
}

const emptyChatState: GameChatState = {
  gameId: '',
  gameName: '',
  participants: [],
  messages: [],
};

export function useGameChat(
  gameId: string,
  options?: {
    channel?: GameChatChannel;
    initialDraftBody?: string | null;
    activeArtifactMessageId?: string | null;
    activePromptMessageId?: string | null;
  }
): {
  chat: GameChatState;
  initialLoading: boolean;
  error: string | null;
  draftBody: string;
  setDraftBody: (value: string) => void;
  activeReplyTarget: GameChatReplyTarget | null;
  clearReplyTarget: () => void;
  beginReplyToCharacterDraft: (input: {
    targetMessageId: string;
    artifact: SharedCharacterDraftArtifact;
  }) => void;
  beginReplyToPrompt: (input: {
    targetMessageId: string;
    artifact: SharedGamePromptArtifact;
  }) => void;
  membersOpen: boolean;
  setMembersOpen: (value: boolean) => void;
  transcriptRef: RefObject<HTMLDivElement>;
  isSending: boolean;
  commandStatus: ReturnType<typeof useCommandWorkflow>['status'];
  sendMessage: () => Promise<void>;
  sendCharacterDraftReaction: (input: {
    targetMessageId: string;
    artifact: SharedCharacterDraftArtifact;
    reaction: SharedCharacterDraftReaction;
  }) => Promise<void>;
} {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const channel = options?.channel ?? 'LOBBY';
  const [chat, setChat] = useState<GameChatState>(emptyChatState);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [activeReplyTarget, setActiveReplyTarget] = useState<GameChatReplyTarget | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const initialDraftAppliedRef = useRef<string | null>(null);
  const hasLoadedRef = useRef(false);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const { status: commandStatus, isRunning: isSending, submitEnvelopeAndAwait } = useCommandWorkflow();

  useEffect(() => {
    const normalizedDraft = typeof options?.initialDraftBody === 'string' ? options.initialDraftBody : null;
    if (!normalizedDraft || normalizedDraft.trim() === '') {
      return;
    }
    if (initialDraftAppliedRef.current === normalizedDraft) {
      return;
    }
    setDraftBody((current) => (current.trim() === '' ? normalizedDraft : current));
    initialDraftAppliedRef.current = normalizedDraft;
  }, [options?.initialDraftBody]);

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
        channel,
        background,
      });
      try {
        const next = await api.getGameChat(gameId, channel);
        if (cancelled) {
          return;
        }
        setChat({
          gameId: next.gameId,
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
          channel,
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
          channel,
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
  }, [api, auth.actorId, auth.mode, channel, gameId]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) {
      transcript.scrollTop = transcript.scrollHeight;
    }
  }, [chat.messages.length]);

  useEffect(() => {
    if (activeReplyTarget !== null) {
      return;
    }

    if (options?.activeArtifactMessageId) {
      const targetMessage = chat.messages.find((message) => message.messageId === options.activeArtifactMessageId);
      const targetArtifact = targetMessage?.artifact?.kind === 'CHARACTER_DRAFT' ? targetMessage.artifact : null;
      if (targetMessage && targetArtifact) {
        setActiveReplyTarget({
          kind: 'CHARACTER_DRAFT',
          targetMessageId: targetMessage.messageId,
          characterId: targetArtifact.characterId,
          snapshotVersion: targetArtifact.snapshotVersion,
        });
        return;
      }
    }

    if (options?.activePromptMessageId) {
      const targetMessage = chat.messages.find((message) => message.messageId === options.activePromptMessageId);
      const targetArtifact = targetMessage?.artifact?.kind === 'GAME_PROMPT' ? targetMessage.artifact : null;
      if (targetMessage && targetArtifact) {
        setActiveReplyTarget({
          kind: 'GAME_PROMPT',
          targetMessageId: targetMessage.messageId,
          promptId: targetArtifact.promptId,
        });
      }
    }
  }, [activeReplyTarget, chat.messages, options?.activeArtifactMessageId, options?.activePromptMessageId]);

  function clearReplyTarget() {
    setActiveReplyTarget(null);
  }

  function beginReplyToCharacterDraft(input: {
    targetMessageId: string;
    artifact: SharedCharacterDraftArtifact;
  }) {
    setDraftBody((current) => buildCharacterDraftReplyDraft(input.artifact, current));
    setActiveReplyTarget({
      kind: 'CHARACTER_DRAFT',
      targetMessageId: input.targetMessageId,
      characterId: input.artifact.characterId,
      snapshotVersion: input.artifact.snapshotVersion,
    });
  }

  function beginReplyToPrompt(input: {
    targetMessageId: string;
    artifact: SharedGamePromptArtifact;
  }) {
    setDraftBody((current) => buildPromptReplyDraft(input.artifact, current));
    setActiveReplyTarget({
      kind: 'GAME_PROMPT',
      targetMessageId: input.targetMessageId,
      promptId: input.artifact.promptId,
    });
  }

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
          ...(channel === 'PLAY' ? { channel: 'PLAY' as const } : {}),
          replyTarget: activeReplyTarget ?? undefined,
        },
      } satisfies CommandEnvelopeInput<'SendGameChatMessage'>);
      setDraftBody('');
      setActiveReplyTarget(null);
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
            artifact: undefined,
            replyTarget: activeReplyTarget ?? undefined,
            createdAt,
          },
        ],
      }));
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : String(sendError));
    }
  }

  async function sendCharacterDraftReaction(input: {
    targetMessageId: string;
    artifact: SharedCharacterDraftArtifact;
    reaction: SharedCharacterDraftReaction;
  }) {
    const commandId = createCommandId();
    const createdAt = new Date().toISOString();
    const reactionLabel = formatCharacterDraftReaction(input.reaction);
    setError(null);

    const envelope = {
      commandId,
      gameId,
      type: 'SendGameChatMessage',
      schemaVersion: 1,
      createdAt,
      payload: {
        body: `Reaction: ${reactionLabel}`,
        ...(channel === 'PLAY' ? { channel: 'PLAY' as const } : {}),
        artifact: {
          kind: 'CHARACTER_DRAFT_REACTION',
          targetMessageId: input.targetMessageId,
          characterId: input.artifact.characterId,
          snapshotVersion: input.artifact.snapshotVersion,
          characterName: input.artifact.characterName,
          reaction: input.reaction,
        },
      },
    } satisfies CommandEnvelopeInput<'SendGameChatMessage'>;

    try {
      await submitEnvelopeAndAwait('React to shared draft', envelope);
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
            body: envelope.payload.body,
            artifact: envelope.payload.artifact,
            createdAt,
          },
        ],
      }));
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : String(sendError));
    }
  }

  return {
    chat,
    initialLoading,
    error,
    draftBody,
    setDraftBody,
    activeReplyTarget,
    clearReplyTarget,
    beginReplyToCharacterDraft,
    beginReplyToPrompt,
    membersOpen,
    setMembersOpen,
    transcriptRef,
    isSending,
    commandStatus,
    sendMessage,
    sendCharacterDraftReaction,
  };
}

function readSenderDisplayName(participants: GameChatParticipant[], actorId: string): string {
  return participants.find((participant) => participant.playerId === actorId)?.displayName ?? actorId;
}

function readSenderRole(participants: GameChatParticipant[], actorId: string): 'PLAYER' | 'GM' {
  return participants.find((participant) => participant.playerId === actorId)?.role ?? 'PLAYER';
}

function readSenderCharacterId(participants: GameChatParticipant[], actorId: string): string | null {
  return participants.find((participant) => participant.playerId === actorId)?.characterId ?? null;
}

function buildCharacterDraftReplyDraft(artifact: SharedCharacterDraftArtifact, currentDraftBody: string): string {
  const prefix = `About ${artifact.characterName} v${artifact.snapshotVersion}: `;
  return appendReplyPrefix(prefix, currentDraftBody);
}

function buildPromptReplyDraft(artifact: SharedGamePromptArtifact, currentDraftBody: string): string {
  const prefix = `About ${artifact.title}: `;
  return appendReplyPrefix(prefix, currentDraftBody);
}

function appendReplyPrefix(prefix: string, currentDraftBody: string): string {
  const trimmedDraft = currentDraftBody.trim();
  if (!trimmedDraft) {
    return prefix;
  }
  if (trimmedDraft.includes(prefix)) {
    return currentDraftBody;
  }
  return `${currentDraftBody.trimEnd()}\n${prefix}`;
}
