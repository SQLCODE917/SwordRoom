import { useMemo } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ButtonLink } from '../components/ButtonLink';
import { Panel } from '../components/Panel';
import { readGMGameMode } from '../features/gameplay-lifecycle/gmGameMode';
import { deriveGameplayPhaseGate } from '../features/gameplay-lifecycle/phaseGate';
import { useGameLifecycle } from '../hooks/useGameLifecycle';
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
    return <Navigate to={`/gm/${encodeURIComponent(gameId)}/play`} replace />;
  }

  const lifecycleState = useGameLifecycle(gameId, { poll: 'none' });
  const phaseGate = deriveGameplayPhaseGate(lifecycleState.lifecycle);
  const phaseLabel = phaseGate.phase;
  const phaseDescription = useMemo(() => {
    if (lifecycleState.initialLoading) {
      return 'Loading game lifecycle...';
    }
    if (lifecycleState.error) {
      return lifecycleState.error;
    }
    if (phaseGate.isLive) {
      return 'Gameplay is live. Continue in Play or GM Play; Lobby remains available for planning context.';
    }
    return 'Gameplay has not started yet. Use Lobby for the pregame loop, then open GM Play to frame the first scene.';
  }, [lifecycleState.error, lifecycleState.initialLoading, phaseGate.isLive]);

  return (
    <div className="l-page">
      <Panel
        title="GM Game"
        subtitle={`Game ${gameId}`}
        footer={
          <div className="l-row">
            <span className="c-btn c-btn--nav t-small active" role="link" aria-current="page">
              Lobby
            </span>
            <ButtonLink to={`/gm/games/${encodeURIComponent(gameId)}?mode=play`}>Play</ButtonLink>
            <ButtonLink to={`/gm/games/${encodeURIComponent(gameId)}?mode=gm-play`}>GM Play</ButtonLink>
          </div>
        }
      >
        <div className={`c-note ${lifecycleState.error ? 'c-note--error' : 'c-note--info'}`}>
          <span className="t-small">{`Phase: ${phaseLabel}`}</span>
          <span className="t-small">{phaseDescription}</span>
        </div>
      </Panel>

      <PregameLobbyPage />
    </div>
  );
}
