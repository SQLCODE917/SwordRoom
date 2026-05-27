import { useParams, useSearchParams } from 'react-router-dom';
import { GameChatPanel } from '../components/GameChatPanel';
import { Panel } from '../components/Panel';
import { PregamePlanningPanel } from '../components/PregamePlanningPanel';
import { PregameWorkflowNav } from '../components/PregameWorkflowNav';
import { useAuthProvider } from '../auth/AuthProvider';
import { ButtonLink } from '../components/ButtonLink';
import { appendCharacterWizardEntryContext } from '../features/character-wizard';
import { usePregamePlanning } from '../features/pregame-planning';
import { useGameChat } from '../hooks/useGameChat';
import styles from './GameChatPage.module.css';

export function GameChatPage() {
  const params = useParams<{ gameId: string }>();
  const [searchParams] = useSearchParams();
  const auth = useAuthProvider();
  const gameId = params.gameId ?? 'game-1';
  const activeArtifactMessageId = searchParams.get('artifact');
  const activePromptMessageId = searchParams.get('prompt');
  const chat = useGameChat(gameId, {
    channel: 'LOBBY',
    initialDraftBody: searchParams.get('draft'),
    activeArtifactMessageId,
    activePromptMessageId,
  });
  const planning = usePregamePlanning(gameId, true);
  const creatorLink = readChatCreatorLink(chat.chat, auth.actorId);
  const creatorFocus = planning.state.status === 'ready' && planning.state.planning.activePrompt ? 'prompt' : 'revise';
  const creatorTarget = appendCharacterWizardEntryContext(creatorLink.to, {
    entrySource: 'chat',
    focus: creatorFocus,
  });

  return (
    <div className="l-page">
      <Panel title="Game Chat" subtitle={chat.chat.gameName || 'Current game chat.'}>
        <div className="l-col">
          <PregameWorkflowNav
            gameId={gameId}
            createTo={`/games/${encodeURIComponent(gameId)}/character/new`}
            charactersTo={`/games/${encodeURIComponent(gameId)}/characters`}
          />

          <div className="c-pregame-workspace">
            <div className="c-pregame-workspace__main">
              <GameChatPanel
                chat={chat.chat}
                initialLoading={chat.initialLoading}
                draftBody={chat.draftBody}
                setDraftBody={chat.setDraftBody}
                activeReplyTarget={chat.activeReplyTarget}
                onClearReplyTarget={chat.clearReplyTarget}
                membersOpen={chat.membersOpen}
                setMembersOpen={chat.setMembersOpen}
                transcriptRef={chat.transcriptRef}
                isSending={chat.isSending}
                onSendMessage={chat.sendMessage}
                onReactToArtifact={chat.sendCharacterDraftReaction}
                onReplyToArtifact={chat.beginReplyToCharacterDraft}
                activeArtifactMessageId={activeArtifactMessageId}
              />
            </div>

            <aside className={`c-pregame-workspace__aside ${styles.planningAside}`}>
              <PregamePlanningPanel
                planningState={planning.state}
                actions={
                  <div className="l-row">
                    <ButtonLink to={creatorTarget}>{creatorLink.label}</ButtonLink>
                  </div>
                }
              />
            </aside>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function readChatCreatorLink(
  chat: { gameId: string; participants: Array<{ playerId: string; characterId: string | null }> },
  actorId: string
): { to: string; label: string } {
  const actorCharacterId = chat.participants.find((participant) => participant.playerId === actorId)?.characterId ?? null;
  if (actorCharacterId) {
    return {
      to: `/games/${encodeURIComponent(chat.gameId)}/characters/${encodeURIComponent(actorCharacterId)}/edit`,
      label: 'Edit my Character',
    };
  }
  return {
    to: `/games/${encodeURIComponent(chat.gameId)}/character/new`,
    label: 'Create a new Character',
  };
}
