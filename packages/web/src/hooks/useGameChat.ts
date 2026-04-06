import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createApiClient, type CommandEnvelopeInput, type GameChatMessage, type GameChatParticipant } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { logWebFlow, summarizeError } from '../logging/flowLog';
import { createCommandId, useCommandWorkflow } from './useCommandStatus';

export interface GameChatState {
  gameName: string;
  participants: GameChatParticipant[];
  messages: GameChatMessage[];
}

const emptyChatState: GameChatState = {
  gameName: '',
  participants: [],
  messages: [],
};

export function useGameChat(gameId: string): {
  chat: GameChatState;
  initialLoading: boolean;
  error: string | null;
  draftBody: string;
  setDraftBody: (value: string) => void;
  membersOpen: boolean;
  setMembersOpen: (value: boolean) => void;
  transcriptRef: RefObject<HTMLDivElement>;
  isSending: boolean;
  commandStatus: ReturnType<typeof useCommandWorkflow>['status'];
  sendMessage: () => Promise<void>;
} {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const [chat, setChat] = useState<GameChatState>(emptyChatState);
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

  return {
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
    sendMessage,
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
