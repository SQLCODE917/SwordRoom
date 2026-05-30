import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { readGMGameMode } from '../features/gameplay-lifecycle/gmGameMode';
import { GMGameplayPage } from './GMGameplayPage';
import { PregameLobbyPage } from './PregameLobbyPage';

export function GMGamePage() {
  const params = useParams<{ gameId: string }>();
  const [searchParams] = useSearchParams();
  const gameId = params.gameId ?? 'game-1';
  const mode = readGMGameMode(searchParams.get('mode'));

  if (mode === 'play') {
    return <Navigate to={`/games/${encodeURIComponent(gameId)}/play`} replace />;
  }

  if (mode === 'gm-play') {
    return <GMGameplayPage />;
  }

  return <PregameLobbyPage />;
}
