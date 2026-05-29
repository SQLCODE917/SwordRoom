import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
      <Panel
        title={view.title}
        subtitle={view.subtitle}
        footer={
          view.status === 'ready' ? undefined : <LobbyActions actions={view.actions} />
        }
      >
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
              <LobbyStatus metrics={view.statusMetrics} hint={view.statusHint} />

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
                  prompt={view.prompt}
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
                <InfoList lines={[view.prompt.text]} />
              )}

              <SectionTitle title="Party Roster" />
              <PartyRoster rows={view.rosterRows} />
            </div>

            <div className="l-col l-grow">
              <SectionTitle title="Recent Activity" />
              <ActivityLog entries={view.recentActivityEntries} />
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
  return <h3 className={`t-h4 ${styles.sectionTitle}`}>{title}</h3>;
}

function InfoList({ lines }: { lines: readonly string[] }) {
  return (
    <div className={`c-note c-note--info ${styles.infoList}`}>
      {lines.map((line) => (
        <div className={`t-small ${styles.infoListItem}`} key={line}>
          {line}
        </div>
      ))}
    </div>
  );
}

function LobbyStatus(input: {
  metrics: ReadonlyArray<{ label: string; value: string; tone: 'neutral' | 'attention' | 'ready' }>;
  hint: string;
}) {
  return (
    <div className={`c-note c-note--info ${styles.statusBoard}`}>
      <dl className={styles.statusMetrics}>
        {input.metrics.map((metric) => (
          <div className={styles.statusMetric} data-tone={metric.tone} key={metric.label}>
            <dt className="t-small">{metric.label}</dt>
            <dd className="t-small">{metric.value}</dd>
          </div>
        ))}
      </dl>
      <div className={`t-small ${styles.statusHint}`}>{input.hint}</div>
    </div>
  );
}

function ActivityLog(input: {
  entries: ReadonlyArray<{
    key: string;
    timeLabel: string;
    actorLabel: string;
    message: string;
    kind: 'message' | 'prompt' | 'draft' | 'reaction' | 'claim';
  }>;
}) {
  if (input.entries.length === 0) {
    return (
      <div className={`c-note c-note--info ${styles.activityEmpty}`}>
        <div className="t-small">No activity yet.</div>
      </div>
    );
  }

  return (
    <ol className={styles.activityLog} aria-label="Pregame recent activity">
      {input.entries.map((entry) => (
        <li
          className={[
            styles.activityEntry,
            entry.kind !== 'message' ? styles.activityEntryWithKind : '',
          ]
            .filter(Boolean)
            .join(' ')}
          key={entry.key}
        >
          <time className={`t-small ${styles.activityTime}`}>{entry.timeLabel}</time>
          <span className={`t-small ${styles.activityActor}`}>{entry.actorLabel}</span>
          {entry.kind !== 'message' ? (
            <span className={`t-small ${styles.activityKind}`}>{entry.kind.toUpperCase()}</span>
          ) : null}
          <span className={`t-small ${styles.activityMessage}`}>{entry.message}</span>
        </li>
      ))}
    </ol>
  );
}

function PartyRoster(input: {
  rows: ReadonlyArray<{
    key: string;
    displayName: string;
    roleLabel: string;
    characterLabel: string;
    characterTo: string | null;
  }>;
}) {
  return (
    <ol className={styles.rosterList} aria-label="Pregame party roster">
      {input.rows.map((row) => (
        <li className={styles.rosterItem} key={row.key}>
          <span className="t-small">
            <span>{row.displayName}</span>
            <span className={styles.rosterRole}>({row.roleLabel})</span>
            <span className={styles.rosterDivider}>-</span>
            {row.characterTo ? (
              <Link className={styles.rosterCharacterLink} to={row.characterTo}>
                {row.characterLabel}
              </Link>
            ) : (
              <span className={styles.rosterNoCharacter}>{row.characterLabel}</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

function GmPromptWidget(input: {
  prompt: { text: string };
  canEdit: boolean;
  isEditing: boolean;
  draft: string;
  isSaving: boolean;
  onStartEdit: () => void;
  onDraftChange: (value: string) => void;
  onCancelEdit: () => void;
  onSave: () => void;
}) {
  const promptText = input.prompt.text.trim() || 'No GM planning prompt is active yet.';

  if (!input.canEdit || !input.isEditing) {
    return (
      <div className={`c-note c-note--info ${styles.promptCard}`}>
        {input.canEdit ? (
          <button
            className={styles.promptReadButton}
            type="button"
            disabled={input.isSaving}
            aria-label="Edit GM prompt"
            onClick={input.onStartEdit}
          >
            <span className="t-small">{promptText}</span>
            <span className={`t-small ${styles.promptEditHint}`}>Edit prompt</span>
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
