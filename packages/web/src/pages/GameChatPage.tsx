import { useParams } from 'react-router-dom';
import { GameChatPanel } from '../components/GameChatPanel';
import { Panel } from '../components/Panel';
import { useGameChat } from '../hooks/useGameChat';

export function GameChatPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId ?? 'game-1';
  const chat = useGameChat(gameId);

  return (
    <div className="l-page">
      <Panel title="Game Chat" subtitle={chat.chat.gameName || 'Current game chat.'}>
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
      </Panel>
    </div>
  );
}
