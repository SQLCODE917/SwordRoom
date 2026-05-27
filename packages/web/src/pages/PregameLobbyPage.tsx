import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ButtonLink } from '../components/ButtonLink';
import { Panel } from '../components/Panel';
import { PregameWorkflowNav } from '../components/PregameWorkflowNav';
import { createPregameLobbyViewModel, usePregameLobby } from '../features/pregame-lobby';
import { buildGamePromptArtifact, buildPostGamePromptEnvelope, DEFAULT_GM_PREGAME_PROMPT_TEXT } from '../features/pregame-planning';
import { useCommandWorkflow } from '../hooks/useCommandStatus';
import styles from './PregameLobbyPage.module.css';

export function PregameLobbyPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId ?? 'game-1';
  const lobby = usePregameLobby(gameId);
  const view = useMemo(() => createPregameLobbyViewModel(lobby.state), [lobby.state]);
  const { isRunning, submitEnvelopeAndAwait } = useCommandWorkflow();
  const [gmPromptDraft, setGmPromptDraft] = useState('');
  const [gmPromptSeed, setGmPromptSeed] = useState('');
  const [isPromptEditing, setIsPromptEditing] = useState(false);
  const currentPromptText =
    lobby.state.status === 'ready' ? (lobby.state.planning.activePrompt?.prompt.trim() ?? '') : '';

  useEffect(() => {
    if (lobby.state.status !== 'ready' || !lobby.state.actorContext.isGameMaster) {
      return;
    }
    const nextSeed = lobby.state.planning.activePrompt?.prompt.trim() || DEFAULT_GM_PREGAME_PROMPT_TEXT;
    setGmPromptDraft((current) => {
      if (current.trim() === '' || current === gmPromptSeed) {
        return nextSeed;
      }
      return current;
    });
    setGmPromptSeed(nextSeed);
  }, [lobby.state, gmPromptSeed]);

  async function savePrompt() {
    if (lobby.state.status !== 'ready' || !lobby.state.actorContext.isGameMaster) {
      return;
    }
    const baselinePrompt = (lobby.state.planning.activePrompt?.prompt ?? '').trim();
    const nextPrompt = gmPromptDraft.trim();
    if (nextPrompt.length === 0) {
      return;
    }
    if (nextPrompt === baselinePrompt) {
      setIsPromptEditing(false);
      return;
    }

    const promptPayload = buildGamePromptArtifact({ prompt: nextPrompt });

    const terminal = await submitEnvelopeAndAwait(
      'Post pregame prompt',
      buildPostGamePromptEnvelope({
        gameId,
        body: promptPayload.body,
        artifact: promptPayload.artifact,
      })
    );
    if (terminal.status === 'PROCESSED') {
      await lobby.refresh();
      setIsPromptEditing(false);
    }
  }

  return (
    <div className="l-page">
      <Panel title={view.title} subtitle={view.subtitle} footer={<LobbyActions actions={view.actions} />}>
        <div className={`c-note ${view.noticeTone === 'error' ? 'c-note--error' : 'c-note--info'}`}>
          <span className="t-small">{view.notice}</span>
        </div>

        {view.status === 'live' ? (
          <div className="c-note c-note--info">
            <div className="t-small">Lobby pregame planning is complete for now.</div>
            <div className="t-small">Continue in Play for player-facing scene flow, or GM Play for operator controls.</div>
          </div>
        ) : null}

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
              <SectionTitle title="Lobby Status" />
              <InfoList lines={view.statusLines} />

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
                      onClick={() => setIsPromptEditing(true)}
                    >
                      {view.primaryAction.label}
                    </button>
                  )}
                </div>
                <div className="t-small">{view.primaryAction.detail}</div>
              </div>

              <SectionTitle title="GM Prompt" />
              {lobby.state.status === 'ready' ? (
                <GmPromptWidget
                  prompt={currentPromptText}
                  canEdit={lobby.state.actorContext.isGameMaster}
                  isEditing={isPromptEditing}
                  draft={gmPromptDraft}
                  isSaving={isRunning}
                  onStartEdit={() => setIsPromptEditing(true)}
                  onDraftChange={setGmPromptDraft}
                  onCancelEdit={() => {
                    setGmPromptDraft(currentPromptText || DEFAULT_GM_PREGAME_PROMPT_TEXT);
                    setIsPromptEditing(false);
                  }}
                  onSave={() => void savePrompt()}
                />
              ) : (
                <InfoList lines={view.promptLines} />
              )}

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

function GmPromptWidget(input: {
  prompt: string;
  canEdit: boolean;
  isEditing: boolean;
  draft: string;
  isSaving: boolean;
  onStartEdit: () => void;
  onDraftChange: (value: string) => void;
  onCancelEdit: () => void;
  onSave: () => void;
}) {
  const promptText = input.prompt.trim() || 'No GM planning prompt is active yet.';

  if (!input.canEdit || !input.isEditing) {
    return (
      <div className={`c-note c-note--info ${styles.promptCard}`}>
        {input.canEdit ? (
          <button className={styles.promptReadButton} type="button" disabled={input.isSaving} onClick={input.onStartEdit}>
            <span className="t-small">{promptText}</span>
            <span className={`t-small ${styles.promptReadHint}`}>Click to edit</span>
          </button>
        ) : (
          <div className="t-small">{promptText}</div>
        )}
      </div>
    );
  }

  const saveDisabled = input.isSaving || input.draft.trim().length === 0;

  return (
    <div className={`c-note c-note--info ${styles.promptCard}`}>
      <label className={`c-field ${styles.promptField}`}>
        <span className="c-field__label">Prompt text</span>
        <textarea
          className={`c-field__control c-gameplay__textarea ${styles.promptTextarea}`}
          value={input.draft}
          disabled={input.isSaving}
          onChange={(event) => input.onDraftChange(event.target.value)}
        />
      </label>
      <div className={styles.promptActions}>
        <button className={`c-btn ${saveDisabled ? 'is-disabled' : ''}`.trim()} type="button" disabled={saveDisabled} onClick={input.onSave}>
          Save Prompt
        </button>
        <button className={`c-btn ${input.isSaving ? 'is-disabled' : ''}`.trim()} type="button" disabled={input.isSaving} onClick={input.onCancelEdit}>
          Cancel
        </button>
      </div>
    </div>
  );
}
