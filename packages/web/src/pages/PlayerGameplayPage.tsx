import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { GameplayCombatActionType, GameplayMovementMode } from '@starter/shared';
import { type CommandEnvelopeInput } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { GameChatPanel } from '../components/GameChatPanel';
import { GameplayCard } from '../components/GameplayCard';
import { GameplayEventFeed } from '../components/GameplayEventFeed';
import { GameplayGraph } from '../components/GameplayGraph';
import { Panel } from '../components/Panel';
import { useGameChat } from '../hooks/useGameChat';
import { useGameplayView } from '../hooks/useGameplayView';
import { createCommandId, useCommandWorkflow } from '../hooks/useCommandStatus';

const combatActionOptions: GameplayCombatActionType[] = ['ATTACK', 'CAST_MAGIC', 'MOVE', 'DELAY', 'DEFEND', 'OTHER'];
const movementModeOptions: GameplayMovementMode[] = ['FULL', 'NORMAL', 'STAND_STILL'];

export function PlayerGameplayPage() {
  const params = useParams<{ gameId: string }>();
  const auth = useAuthProvider();
  const gameId = params.gameId ?? 'game-1';
  const gameplayState = useGameplayView(gameId, 'PLAYER');
  const chat = useGameChat(gameId);
  const { status: commandStatus, isRunning, submitEnvelopeAndAwait } = useCommandWorkflow();

  const [intentBody, setIntentBody] = useState('');
  const [combatActorCombatantId, setCombatActorCombatantId] = useState('');
  const [combatTargetCombatantId, setCombatTargetCombatantId] = useState('');
  const [combatActionType, setCombatActionType] = useState<GameplayCombatActionType>('ATTACK');
  const [combatMovementMode, setCombatMovementMode] = useState<GameplayMovementMode>('NORMAL');
  const [combatDelay, setCombatDelay] = useState(false);
  const [combatSummary, setCombatSummary] = useState('');

  const gameplay = gameplayState.gameplay;
  const currentRound = gameplay?.session.combat?.rounds[gameplay.session.combat.rounds.length - 1] ?? null;
  const ownParticipant = gameplay?.participants.find((participant) => participant.playerId === auth.actorId) ?? null;
  const ownParticipantCharacterId = ownParticipant?.characterId ?? null;
  const ownCombatant =
    gameplay?.session.combatants.find((combatant) => combatant.actorId === auth.actorId && combatant.side === 'PLAYER') ??
    (ownParticipantCharacterId
      ? gameplay?.session.combatants.find(
          (combatant) => combatant.characterId === ownParticipantCharacterId && combatant.side === 'PLAYER'
        ) ?? null
      : null);
  const canSubmitIntent = Boolean(ownCombatant) && gameplay?.session.status !== 'IN_COMBAT';
  const intentAvailabilityText = !ownCombatant
    ? 'Join this game with an approved character to submit intents.'
    : gameplay?.session.status === 'IN_COMBAT'
      ? 'Combat is open, so character actions are declared in the combat panel.'
      : 'Describe what your character does next.';
  const availableTargets = useMemo(
    () =>
      (gameplay?.session.combatants ?? []).filter(
        (combatant) => combatant.combatantId !== ownCombatant?.combatantId && combatant.status === 'READY'
      ),
    [gameplay?.session.combatants, ownCombatant?.combatantId]
  );

  useEffect(() => {
    if (ownCombatant && combatActorCombatantId === '') {
      setCombatActorCombatantId(ownCombatant.combatantId);
    }
  }, [combatActorCombatantId, ownCombatant]);

  useEffect(() => {
    if (availableTargets.length > 0 && combatTargetCombatantId === '') {
      setCombatTargetCombatantId(availableTargets[0]!.combatantId);
    }
  }, [availableTargets, combatTargetCombatantId]);

  return (
    <div className="l-page">
      <Panel
        title="Player Play"
        subtitle={
          gameplay?.gameName
            ? `${gameplay.gameName} player view with public transcript and live chat.`
            : 'Player gameplay view with public transcript and live chat.'
        }
      >
        <div className={`c-note ${gameplayState.error ? 'c-note--error' : 'c-note--info'}`}>
          <span className="t-small">
            {gameplayState.error ??
              (gameplayState.initialLoading
                ? 'Loading gameplay view...'
                : gameplay
                  ? 'Current scene, current phase, and public transcript are shown here.'
                  : 'The GM has not loaded the gameplay scene yet. Chat stays available while you wait.')}
          </span>
        </div>

        <div className="c-gameplay__layout">
          <div className="c-gameplay__main">
            {gameplay ? (
              <>
                <SceneSummaryCard
                  sceneTitle={gameplay.session.sceneTitle}
                  sceneSummary={gameplay.session.sceneSummary}
                  focusPrompt={gameplay.session.focusPrompt}
                  status={gameplay.session.status}
                  currentNodeId={gameplay.session.currentNodeId}
                  selectedProcedure={gameplay.session.selectedProcedure}
                  activeCheckLabel={gameplay.session.activeCheck?.actionLabel ?? null}
                  activeCheckOutcome={gameplay.session.activeCheck?.outcome ?? null}
                  roundNumber={currentRound?.roundNumber ?? null}
                />

                <GameplayGraph
                  nodes={gameplay.graph.nodes}
                  edges={gameplay.graph.edges}
                  currentNodeId={gameplay.session.currentNodeId}
                />

                <PlayerActionPanel
                  intentBody={intentBody}
                  setIntentBody={setIntentBody}
                  canSubmitIntent={canSubmitIntent}
                  canSubmitCombatAction={Boolean(currentRound && ownCombatant)}
                  intentAvailabilityText={intentAvailabilityText}
                  intentPlaceholder={
                    ownCombatant
                      ? 'Step between the thugs and the poster girl.'
                      : 'Join this game with an approved character to submit intents.'
                  }
                  combatActorCombatantId={combatActorCombatantId}
                  setCombatActorCombatantId={setCombatActorCombatantId}
                  combatTargetCombatantId={combatTargetCombatantId}
                  setCombatTargetCombatantId={setCombatTargetCombatantId}
                  combatActionType={combatActionType}
                  setCombatActionType={setCombatActionType}
                  combatMovementMode={combatMovementMode}
                  setCombatMovementMode={setCombatMovementMode}
                  combatDelay={combatDelay}
                  setCombatDelay={setCombatDelay}
                  combatSummary={combatSummary}
                  setCombatSummary={setCombatSummary}
                  currentRoundNumber={currentRound?.roundNumber ?? null}
                  availableTargets={availableTargets.map((combatant) => ({
                    combatantId: combatant.combatantId,
                    displayName: combatant.displayName,
                  }))}
                  isRunning={isRunning}
                  commandStatus={commandStatus}
                  onSubmitIntent={() => void submitIntent()}
                  onSubmitCombatAction={() => void submitCombatAction()}
                />

                <CombatantStatusPanel combatants={gameplay.session.combatants} />

                <GameplayEventFeed
                  title="Public Transcript"
                  events={gameplay.publicEvents}
                  emptyText="Public transcript will appear as the gameplay loop advances."
                />
              </>
            ) : (
              <div className="c-placeholder">
                <span className="t-small">Waiting for the GM to load the sample scene.</span>
              </div>
            )}
          </div>

          <aside className="c-gameplay__aside">
            <Panel title="Game Chat" subtitle={chat.chat.gameName || 'Current game chat'}>
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
          </aside>
        </div>
      </Panel>
    </div>
  );

  async function submitIntent() {
    const body = intentBody.trim();
    if (!body) {
      return;
    }

    await submitEnvelopeAndAwait('Submit intent', {
      commandId: createCommandId(),
      gameId,
      type: 'SubmitGameplayIntent',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      payload: {
        body,
        characterId: ownCombatant?.characterId ?? ownParticipant?.characterId ?? null,
      },
    } satisfies CommandEnvelopeInput<'SubmitGameplayIntent'>);
    setIntentBody('');
    await gameplayState.refresh();
  }

  async function submitCombatAction() {
    if (!currentRound || !combatActorCombatantId) {
      return;
    }

    await submitEnvelopeAndAwait('Declare combat action', {
      commandId: createCommandId(),
      gameId,
      type: 'SubmitCombatAction',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      payload: {
        roundNumber: currentRound.roundNumber,
        actorCombatantId: combatActorCombatantId,
        targetCombatantId: combatTargetCombatantId || null,
        actionType: combatActionType,
        movementMode: combatMovementMode,
        delayToOrderZero: combatDelay,
        summary: combatSummary.trim() || `${combatActionType} ${combatTargetCombatantId || ''}`.trim(),
      },
    } satisfies CommandEnvelopeInput<'SubmitCombatAction'>);
    setCombatSummary('');
    await gameplayState.refresh();
  }
}

function SceneSummaryCard(input: {
  sceneTitle: string;
  sceneSummary: string;
  focusPrompt: string;
  status: string;
  currentNodeId: string;
  selectedProcedure: string | null;
  activeCheckLabel: string | null;
  activeCheckOutcome: string | null;
  roundNumber: number | null;
}) {
  return (
    <GameplayCard
      eyebrow="Scene"
      title={input.sceneTitle}
      summary={input.sceneSummary}
      focusPrompt={input.focusPrompt}
      ariaLabel="Current scene"
      facts={[
        `State: ${input.currentNodeId}`,
        `Status: ${input.status}`,
        ...(input.selectedProcedure ? [`Procedure: ${input.selectedProcedure}`] : []),
        ...(input.activeCheckLabel ? [`Check: ${input.activeCheckLabel}`] : []),
        ...(input.activeCheckOutcome ? [`Outcome: ${input.activeCheckOutcome}`] : []),
        ...(input.roundNumber ? [`Round: ${input.roundNumber}`] : []),
      ]}
    />
  );
}

function PlayerActionPanel(input: {
  intentBody: string;
  setIntentBody: (value: string) => void;
  canSubmitIntent: boolean;
  canSubmitCombatAction: boolean;
  intentAvailabilityText: string;
  intentPlaceholder: string;
  combatActorCombatantId: string;
  setCombatActorCombatantId: (value: string) => void;
  combatTargetCombatantId: string;
  setCombatTargetCombatantId: (value: string) => void;
  combatActionType: GameplayCombatActionType;
  setCombatActionType: (value: GameplayCombatActionType) => void;
  combatMovementMode: GameplayMovementMode;
  setCombatMovementMode: (value: GameplayMovementMode) => void;
  combatDelay: boolean;
  setCombatDelay: (value: boolean) => void;
  combatSummary: string;
  setCombatSummary: (value: string) => void;
  currentRoundNumber: number | null;
  availableTargets: Array<{ combatantId: string; displayName: string }>;
  isRunning: boolean;
  commandStatus: ReturnType<typeof useCommandWorkflow>['status'];
  onSubmitIntent: () => void;
  onSubmitCombatAction: () => void;
}) {
  return (
    <section className="c-gameplay-ops" aria-label="Player actions">
      <div className="l-row">
        <h3 className="t-h4">Your Actions</h3>
      </div>
      <div className={`c-note ${input.commandStatus.state === 'Failed' ? 'c-note--error' : 'c-note--info'}`}>
        <span className="t-small">{input.commandStatus.message}</span>
      </div>

      <div className="c-gameplay-ops__grid">
        <form
          className="c-gameplay-ops__panel"
          onSubmit={(event) => {
            event.preventDefault();
            input.onSubmitIntent();
          }}
        >
          <h4 className="t-h4">Intent</h4>
          <div className="c-note c-note--info">
            <span className="t-small">{input.intentAvailabilityText}</span>
          </div>
          <label className="c-field">
            <span className="c-field__label">What does your character do?</span>
            <textarea
              className="c-field__control c-gameplay__textarea"
              value={input.intentBody}
              disabled={input.isRunning || !input.canSubmitIntent}
              onChange={(event) => input.setIntentBody(event.target.value)}
              placeholder={input.intentPlaceholder}
            />
          </label>
          <button
            className={`c-btn ${input.isRunning || input.intentBody.trim() === '' || !input.canSubmitIntent ? 'is-disabled' : ''}`.trim()}
            type="submit"
            disabled={input.isRunning || input.intentBody.trim() === '' || !input.canSubmitIntent}
          >
            Submit Intent
          </button>
        </form>

        <form
          className="c-gameplay-ops__panel"
          onSubmit={(event) => {
            event.preventDefault();
            input.onSubmitCombatAction();
          }}
        >
          <h4 className="t-h4">Combat Action</h4>
          <div className="c-note c-note--info">
            <span className="t-small">
              {input.currentRoundNumber ? `Round ${input.currentRoundNumber} is open.` : 'Combat action entry unlocks when a round opens.'}
            </span>
          </div>
          <label className="c-field">
            <span className="c-field__label">Your combatant</span>
            <input
              className="c-field__control"
              value={input.combatActorCombatantId}
              disabled
              onChange={(event) => input.setCombatActorCombatantId(event.target.value)}
            />
          </label>
          <label className="c-field">
            <span className="c-field__label">Action</span>
            <select
              className="c-field__control"
              value={input.combatActionType}
              disabled={input.isRunning || !input.canSubmitCombatAction}
              onChange={(event) => input.setCombatActionType(event.target.value as GameplayCombatActionType)}
            >
              {combatActionOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="c-field">
            <span className="c-field__label">Movement</span>
            <select
              className="c-field__control"
              value={input.combatMovementMode}
              disabled={input.isRunning || !input.canSubmitCombatAction}
              onChange={(event) => input.setCombatMovementMode(event.target.value as GameplayMovementMode)}
            >
              {movementModeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="c-field">
            <span className="c-field__label">Target</span>
            <select
              className="c-field__control"
              value={input.combatTargetCombatantId}
              disabled={input.isRunning || !input.canSubmitCombatAction || input.availableTargets.length === 0}
              onChange={(event) => input.setCombatTargetCombatantId(event.target.value)}
            >
              {input.availableTargets.length === 0 ? <option value="">No target</option> : null}
              {input.availableTargets.map((target) => (
                <option key={target.combatantId} value={target.combatantId}>
                  {target.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="c-field">
            <span className="c-field__label">Summary</span>
            <input
              className="c-field__control"
              value={input.combatSummary}
              disabled={input.isRunning || !input.canSubmitCombatAction}
              onChange={(event) => input.setCombatSummary(event.target.value)}
              placeholder="Rush Brando Boss with a short sword strike."
            />
          </label>
          <label className="c-field__check">
            <input
              className="c-field__control c-field__control--check"
              type="checkbox"
              checked={input.combatDelay}
              disabled={input.isRunning || !input.canSubmitCombatAction}
              onChange={(event) => input.setCombatDelay(event.target.checked)}
            />
            <span className="t-small">Delay to order zero</span>
          </label>
          <button
            className={`c-btn ${input.isRunning || !input.canSubmitCombatAction ? 'is-disabled' : ''}`.trim()}
            type="submit"
            disabled={input.isRunning || !input.canSubmitCombatAction}
          >
            Declare Combat Action
          </button>
        </form>
      </div>
    </section>
  );
}

function CombatantStatusPanel(input: {
  combatants: Array<{
    combatantId: string;
    displayName: string;
    side: string;
    status: string;
    lifePoints: number;
    maxLifePoints: number;
    stats: {
      intelligence: number;
      agility: number;
      attackBase: number;
      evasionBase: number;
      bonusDamage: number;
      damageReduction: number;
    };
  }>;
}) {
  return (
    <section className="c-gameplay-status" aria-label="Combatants">
      <div className="l-row">
        <h3 className="t-h4">Table Status</h3>
      </div>
      <div className="c-gameplay-status__grid">
        {input.combatants.map((combatant) => (
          <article key={combatant.combatantId} className={`c-gameplay-status__card c-gameplay-status__card--${combatant.side.toLowerCase()}`}>
            <div className="c-gameplay-status__header">
              <span>{combatant.displayName}</span>
              <span className="t-small">{combatant.side}</span>
            </div>
            <div className="t-small">LP {combatant.lifePoints}/{combatant.maxLifePoints}</div>
            <div className="t-small">Status {combatant.status}</div>
            <div className="t-small">
              INT {combatant.stats.intelligence} | AGI {combatant.stats.agility} | ATK {combatant.stats.attackBase} | EVA {combatant.stats.evasionBase}
            </div>
            <div className="t-small">DMG +{combatant.stats.bonusDamage} | DR {combatant.stats.damageReduction}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
