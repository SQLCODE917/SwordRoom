import { useParams } from 'react-router-dom';
import { GameChatPanel } from '../components/GameChatPanel';
import { Panel } from '../components/Panel';
import { PregamePlanningPanel } from '../components/PregamePlanningPanel';
import { PregameWorkflowNav } from '../components/PregameWorkflowNav';
import { ButtonLink } from '../components/ButtonLink';
import { useAuthProvider } from '../auth/AuthProvider';
import { usePregamePlanning } from '../features/pregame-planning';
import { useGameChat } from '../hooks/useGameChat';

export function GameChatPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId ?? 'game-1';
  const auth = useAuthProvider();
  const chat = useGameChat(gameId);
  const planning = usePregamePlanning(gameId, true);
  const ownCharacterId = chat.chat.participants.find((participant) => participant.playerId === auth.actorId)?.characterId ?? null;

  return (
    <div className="l-page">
      <Panel title="Game Chat" subtitle={chat.chat.gameName || 'Current game chat.'}>
        <div className="l-col">
          <PregameWorkflowNav
            gameId={gameId}
            createTo={`/games/${encodeURIComponent(gameId)}/character/new`}
            sheetTo={
              ownCharacterId ? `/games/${encodeURIComponent(gameId)}/characters/${encodeURIComponent(ownCharacterId)}` : null
            }
          />

          <div className="c-pregame-workspace">
            <div className="c-pregame-workspace__main">
              <GameChatPanel
                chat={chat.chat}
                initialLoading={chat.initialLoading}
                error={chat.error}
                draftBody={chat.draftBody}
                setDraftBody={chat.setDraftBody}
                membersOpen={chat.membersOpen}
                setMembersOpen={chat.setMembersOpen}
                transcriptRef={chat.transcriptRef}
                isSending={chat.isSending}
                commandStatus={chat.commandStatus}
                onSendMessage={chat.sendMessage}
              />
            </div>

            <aside className="c-pregame-workspace__aside">
              <PregamePlanningPanel
                planningState={planning.state}
                actions={
                  <div className="l-row">
                    <ButtonLink to={`/games/${encodeURIComponent(gameId)}`}>Open Lobby</ButtonLink>
                    <ButtonLink to={`/games/${encodeURIComponent(gameId)}/character/new`}>Answer In Creator</ButtonLink>
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
