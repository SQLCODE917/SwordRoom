import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ButtonLink } from '../components/ButtonLink';
import { Panel } from '../components/Panel';
import { useGameLifecycle } from '../hooks/useGameLifecycle';
import { PregameLobbyPage } from './PregameLobbyPage';

export function GMGamePage() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId ?? 'game-1';
  const lifecycleState = useGameLifecycle(gameId, { poll: 'none' });
  const phaseLabel = lifecycleState.lifecycle?.phase ?? 'PREGAME';
  const phaseDescription = useMemo(() => {
    if (lifecycleState.initialLoading) {
      return 'Loading game lifecycle...';
    }
    if (lifecycleState.error) {
      return lifecycleState.error;
    }
    if (phaseLabel === 'LIVE') {
      return 'Gameplay is live. Use Play or GM Play to continue the current session.';
    }
    return 'Gameplay has not started yet. Use Lobby for the pregame loop, or open GM Play to frame the first scene.';
  }, [lifecycleState.error, lifecycleState.initialLoading, phaseLabel]);

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
            <ButtonLink to={`/games/${encodeURIComponent(gameId)}/play`}>Play</ButtonLink>
            <ButtonLink to={`/gm/${encodeURIComponent(gameId)}/play`}>GM Play</ButtonLink>
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
