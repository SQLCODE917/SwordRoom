import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ButtonLink } from '../components/ButtonLink';
import { CommandStatusPanel } from '../components/CommandStatusPanel';
import { Panel } from '../components/Panel';
import { PregameWorkflowNav } from '../components/PregameWorkflowNav';
import { createPregameLobbyViewModel, usePregameLobby } from '../features/pregame-lobby';
import { buildPostGamePromptEnvelope, buildSuggestedGamePromptArtifact } from '../features/pregame-planning';
import { useCommandWorkflow } from '../hooks/useCommandStatus';

export function PregameLobbyPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId ?? 'game-1';
  const lobby = usePregameLobby(gameId);
  const view = useMemo(() => createPregameLobbyViewModel(lobby.state), [lobby.state]);
  const { status: commandStatus, isRunning, submitEnvelopeAndAwait } = useCommandWorkflow();

  async function postSuggestedPrompt() {
    if (lobby.state.status !== 'ready' || !lobby.state.actorContext.isGameMaster) {
      return;
    }
    const suggestedRoles = lobby.state.planning.partyNeeds.filter((need) => need.isOpen).map((need) => need.role);
    const prompt = buildSuggestedGamePromptArtifact({ suggestedRoles });

    const terminal = await submitEnvelopeAndAwait(
      'Post pregame prompt',
      buildPostGamePromptEnvelope({
        gameId,
        body: prompt.body,
        artifact: prompt.artifact,
      })
    );
    if (terminal.status === 'PROCESSED') {
      await lobby.refresh();
    }
  }

  return (
    <div className="l-page">
      <Panel title={view.title} subtitle={view.subtitle} footer={<LobbyActions actions={view.actions} />}>
        <CommandStatusPanel status={commandStatus} />
        <div className={`c-note ${view.noticeTone === 'error' ? 'c-note--error' : 'c-note--info'}`}>
          <span className="t-small">{view.notice}</span>
        </div>
        {view.status === 'ready' ? (
          <PregameWorkflowNav
            gameId={gameId}
            createTo={view.workflow.createTo}
            charactersTo={`/games/${encodeURIComponent(gameId)}/characters`}
          />
        ) : null}

        {view.status === 'ready' ? (
          <div className="l-split">
            <div className="l-col l-grow">
              <SectionTitle title="Pregame Status" />
              <InfoList lines={view.loopStatusLines} />

              <SectionTitle title="Next Move" />
              <div className="c-note c-note--info c-pregame-planning__summary">
                <div className="l-row">
                  {view.primaryAction.kind === 'route' ? (
                    <ButtonLink to={view.primaryAction.to}>{view.primaryAction.label}</ButtonLink>
                  ) : (
                    <button
                      className={`c-btn ${isRunning ? 'is-disabled' : ''}`.trim()}
                      type="button"
                      disabled={isRunning}
                      onClick={() => void postSuggestedPrompt()}
                    >
                      {view.primaryAction.label}
                    </button>
                  )}
                </div>
                <div className="t-small">{view.primaryAction.detail}</div>
              </div>

              <SectionTitle title="Planning Status" />
              <InfoList lines={view.summaryLines} />

              <SectionTitle title="GM Prompt" />
              <InfoList lines={view.promptLines} />
              {lobby.state.status === 'ready' && lobby.state.actorContext.isGameMaster ? (
                <div className="l-row">
                  <button
                    className={`c-btn ${isRunning ? 'is-disabled' : ''}`.trim()}
                    type="button"
                    disabled={isRunning}
                    onClick={() => void postSuggestedPrompt()}
                  >
                    Post Prompt For Open Roles
                  </button>
                </div>
              ) : null}

              <SectionTitle title="Party Roster" />
              <div className="c-table" role="table" aria-label="Pregame party roster">
                <div className="c-table__head c-table__row" role="row">
                  <div className="c-table__cell t-small">Member</div>
                  <div className="c-table__cell t-small">Role</div>
                  <div className="c-table__cell t-small">Character</div>
                </div>
                {view.rosterRows.map((row) => (
                  <div className="c-table__row" role="row" key={row.key}>
                    <div className="c-table__cell t-small">{row.displayName}</div>
                    <div className="c-table__cell t-small">{row.roleLabel}</div>
                    <div className="c-table__cell t-small">
                      {row.characterTo ? <ButtonLink to={row.characterTo}>Open {row.characterLabel}</ButtonLink> : row.characterLabel}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="l-col l-grow">
              <SectionTitle title="Party Needs" />
              <InfoList lines={view.partyNeedsLines} />

              <SectionTitle title="Recent Activity" />
              <div className="c-table" role="table" aria-label="Pregame recent activity">
                <div className="c-table__head c-table__row" role="row">
                  <div className="c-table__cell t-small">Member</div>
                  <div className="c-table__cell t-small">Message</div>
                  <div className="c-table__cell t-small">When</div>
                </div>
                {view.recentActivityRows.length === 0 ? (
                  <div className="c-table__row" role="row">
                    <div className="c-table__cell t-small">No pregame chat yet. Open Chat to start the planning thread.</div>
                  </div>
                ) : (
                  view.recentActivityRows.map((row) => (
                    <div className="c-table__row" role="row" key={row.key}>
                      <div className="c-table__cell t-small">{row.actorLabel}</div>
                      <div className="c-table__cell t-small">{row.body}</div>
                      <div className="c-table__cell t-small">{row.createdAtLabel}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

function LobbyActions({ actions }: { actions: ReadonlyArray<{ label: string; to: string; disabled?: boolean; disabledReason?: string | null }> }) {
  return (
    <div className="l-row">
      {actions.map((action) => (
        <ButtonLink
          key={`${action.label}:${action.to}`}
          to={action.to}
          disabled={action.disabled}
          disabledReason={action.disabledReason}
        >
          {action.label}
        </ButtonLink>
      ))}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h3 className="t-h4">{title}</h3>;
}

function InfoList({ lines }: { lines: readonly string[] }) {
  return (
    <div className="c-note c-note--info">
      {lines.map((line) => (
        <div className="t-small" key={line}>
          {line}
        </div>
      ))}
    </div>
  );
}
