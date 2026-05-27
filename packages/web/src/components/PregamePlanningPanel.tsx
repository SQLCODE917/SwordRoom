import type { ReactNode } from 'react';
import type { PregameRole } from '@starter/shared';
import { PREGAME_ROLE_LABELS, PREGAME_ROLE_ORDER } from '../features/pregame-planning';
import type { PregamePlanningState } from '../features/pregame-planning/usePregamePlanning';
import { Panel } from './Panel';

interface PregamePlanningPanelProps {
  planningState: PregamePlanningState;
  actions?: ReactNode;
  disabled?: boolean;
  onClaimRole?: (role: PregameRole) => Promise<void>;
}

export function PregamePlanningPanel({
  planningState,
  actions = null,
  disabled = false,
  onClaimRole,
}: PregamePlanningPanelProps) {
  if (planningState.status === 'disabled') {
    return null;
  }

  if (planningState.status === 'loading') {
    return (
      <Panel title="Pregame Planning" subtitle="Shared planning context for this game.">
        <div className="c-note c-note--info">
          <span className="t-small">Loading pregame planning context...</span>
        </div>
      </Panel>
    );
  }

  if (planningState.status === 'error') {
    return (
      <Panel title="Pregame Planning" subtitle="Shared planning context for this game.">
        <div className="c-note c-note--error">
          <span className="t-small">{planningState.message}</span>
        </div>
      </Panel>
    );
  }

  const planning = planningState.planning;
  const viewerIsMember = planning.viewer?.isMember === true;
  const suggestedRoleLabels = (planning.activePrompt?.suggestedRoles ?? []).map((role) => PREGAME_ROLE_LABELS[role]);

  return (
    <Panel
      title="Pregame Planning"
      subtitle="Shared planning context for this game."
      footer={actions ?? <span className="t-small">Use Lobby, Chat, and Create together to keep the party aligned.</span>}
    >
      <div className="c-note c-note--info c-pregame-planning__summary">
        <div className="t-small">
          {planning.activePrompt
            ? `${planning.activePrompt.senderDisplayName}: ${planning.activePrompt.prompt}`
            : 'No GM planning prompt is active yet.'}
        </div>
        <div className="t-small">
          {suggestedRoleLabels.length > 0
            ? `Suggested roles: ${suggestedRoleLabels.join(', ')}`
            : 'No structured role suggestions are attached to the current prompt.'}
        </div>
      </div>

      {onClaimRole ? (
        <div className="l-row">
          {PREGAME_ROLE_ORDER.map((role) => {
            const claimDisabled = disabled || !viewerIsMember;

            return (
              <button
                key={role}
                className={`c-btn ${claimDisabled ? 'is-disabled' : ''}`.trim()}
                type="button"
                disabled={claimDisabled}
                onClick={() => void onClaimRole(role)}
                title={!viewerIsMember ? 'Join the game before posting structured planning updates.' : undefined}
              >
                {`Claim ${PREGAME_ROLE_LABELS[role]}`}
              </button>
            );
          })}
        </div>
      ) : null}
    </Panel>
  );
}
