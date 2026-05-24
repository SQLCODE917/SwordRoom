import type { GameplayLifecycle } from '../../api/ApiClient';

export interface GameplayPhaseGate {
  phase: GameplayLifecycle['phase'];
  isPregame: boolean;
  isLive: boolean;
  shouldLoadGameplay: boolean;
}

export function deriveGameplayPhaseGate(lifecycle: Pick<GameplayLifecycle, 'phase'> | null | undefined): GameplayPhaseGate {
  const phase: GameplayLifecycle['phase'] = lifecycle?.phase === 'LIVE' ? 'LIVE' : 'PREGAME';
  return {
    phase,
    isPregame: phase === 'PREGAME',
    isLive: phase === 'LIVE',
    shouldLoadGameplay: phase === 'LIVE',
  };
}
