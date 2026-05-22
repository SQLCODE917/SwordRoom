import { Navigate, useSearchParams } from 'react-router-dom';
import { PlayerInboxPage } from './PlayerInboxPage';
import { useGmGames } from '../hooks/useGmGames';

const PLAYER_INBOX_PATH = '/inbox?mode=player';

export function InboxRoutePage() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');

  if (mode !== 'gm') {
    return <PlayerInboxPage />;
  }

  return <InboxGMModeRoute requestedGameId={searchParams.get('gameId')} />;
}

function InboxGMModeRoute({ requestedGameId }: { requestedGameId: string | null }) {
  const { games, loading } = useGmGames();
  const requestedOrFirstGameId = requestedGameId ?? games[0]?.gameId ?? null;

  if (loading) {
    return null;
  }

  if (!requestedOrFirstGameId) {
    return <Navigate to={PLAYER_INBOX_PATH} replace />;
  }

  return <Navigate to={`/gm/${encodeURIComponent(requestedOrFirstGameId)}/inbox`} replace />;
}
