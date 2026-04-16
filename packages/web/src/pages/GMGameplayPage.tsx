import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { GameplayProcedure } from '@starter/shared';
import { type CommandEnvelopeInput } from '../api/ApiClient';
import { GameChatPanel } from '../components/GameChatPanel';
import { GameplayCard } from '../components/GameplayCard';
import { GameplayCommandStatusPanel } from '../components/GameplayCommandStatusPanel';
import { GameplayTimeseriesPanel } from '../components/GameplayTimeseriesPanel';
import { GameplayTranscriptPanel } from '../components/GameplayTranscriptPanel';
import { GMControlPanelTabs } from '../components/GMControlPanelTabs';
import { GMCurrentStepPanel } from '../components/GMCurrentStepPanel';
import { GMGraphPanel } from '../components/GMGraphPanel';
import { GMPlayModeNav } from '../components/GMPlayModeNav';
import { GMUtilitiesDock } from '../components/GMUtilitiesDock';
import { GMUtilitiesSheet } from '../components/GMUtilitiesSheet';
import { Panel } from '../components/Panel';
import {
  createGmPlaySearchParams,
  deriveGmControlModel,
  readGmPlayUiState,
  type GmPlayUiState,
  type GmUtilityId,
  type RecentCommandStatusEntry,
} from '../data/gmControlModel';
import { useGameChat } from '../hooks/useGameChat';
import { useGameplayView } from '../hooks/useGameplayView';
import { createCommandId, useCommandWorkflow } from '../hooks/useCommandStatus';
import { useGmGameplayFormState } from '../hooks/useGmGameplayFormState';
import { useMediaQuery } from '../hooks/useMediaQuery';

export function GMGameplayPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId ?? 'game-1';
  const gameplayState = useGameplayView(gameId, 'GM');
  const chat = useGameChat(gameId);
  const { status: commandStatus, isRunning, submitEnvelopeAndAwait } = useCommandWorkflow();
  const [searchParams, setSearchParams] = useSearchParams();
  const parsedUiState = readGmPlayUiState(searchParams);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [recentCommandStatuses, setRecentCommandStatuses] = useState<RecentCommandStatusEntry[]>([]);
  const lastRecordedCommandIdRef = useRef<string | null>(null);

  const gameplay = gameplayState.gameplay;
  const forms = useGmGameplayFormState(gameplay);
  const controlModel = useMemo(
    () =>
      deriveGmControlModel({
        gameplay,
        commandStatus,
        recentCommandStatuses,
      }),
    [commandStatus, gameplay, recentCommandStatuses]
  );

  useEffect(() => {
    if (!parsedUiState.needsNormalization) {
      return;
    }
    setSearchParams(createGmPlaySearchParams(parsedUiState.state), { replace: true });
  }, [parsedUiState.needsNormalization, parsedUiState.state, setSearchParams]);

  useEffect(() => {
    if (
      !commandStatus.commandId ||
      (commandStatus.state !== 'Processed' && commandStatus.state !== 'Failed') ||
      lastRecordedCommandIdRef.current === commandStatus.commandId
    ) {
      return;
    }

    lastRecordedCommandIdRef.current = commandStatus.commandId;
    setRecentCommandStatuses((current) => [
      {
        ...commandStatus,
        capturedAt: new Date().toISOString(),
      },
      ...current.filter((entry) => entry.commandId !== commandStatus.commandId),
    ].slice(0, 5));
  }, [commandStatus]);

  const gameplayFacts = gameplay
    ? [
        `Current node: ${gameplay.session.currentNodeId}`,
        `Status: ${gameplay.session.status}`,
        ...(gameplay.session.selectedProcedure ? [`Procedure: ${gameplay.session.selectedProcedure}`] : []),
        ...(gameplay.session.combat?.currentRoundNumber ? [`Round: ${gameplay.session.combat.currentRoundNumber}`] : []),
      ]
    : ['Current node: not started', 'Status: waiting for sample'];

  const utilityContent = parsedUiState.state.utility ? renderUtilityContent(parsedUiState.state.utility) : null;

  return (
    <div className="l-page">
      <Panel
        title="GM Play"
        subtitle={
          gameplay?.gameName
            ? `${gameplay.gameName} mobile-first GM control center with step-focused play and integrated chat.`
            : 'Mobile-first GM control center with step-focused play and integrated chat.'
        }
      >
        <div className={`c-note ${gameplayState.error ? 'c-note--error' : 'c-note--info'}`}>
          <span className="t-small">
            {gameplayState.error ??
              (gameplayState.initialLoading
                ? 'Loading GM gameplay view...'
                : gameplay
                  ? 'Current Step is the primary operator surface; graph, utilities, and chat stay available without crowding the main action.'
                  : 'Load the RPG sample to start the gameplay loop for this game.')}
          </span>
        </div>

        <div className="c-gm-play">
          <GameplayCard
            eyebrow="GM View"
            title={gameplay?.session.sceneTitle ?? 'No Gameplay Session'}
            summary={gameplay?.session.sceneSummary ?? 'Load the sample scene to seed the tavern encounter and begin GM play.'}
            focusPrompt={gameplay?.session.focusPrompt ?? 'Seed the scene, then guide the table through intents, procedures, and combat from one operator workspace.'}
            facts={gameplayFacts}
            ariaLabel="GM gameplay card"
            compact={parsedUiState.state.mode === 'chat'}
          />

          <GMPlayModeNav
            activeMode={parsedUiState.state.mode}
            onChangeMode={(mode) => updateUiState({ mode })}
          />

          {parsedUiState.state.mode === 'control' ? (
            <div className={`c-gm-workspace ${isDesktop && parsedUiState.state.utility ? 'has-utility-dock' : ''}`.trim()}>
              <div className="c-gm-workspace__main">
                <GMControlPanelTabs
                  activePanel={parsedUiState.state.panel}
                  onChangePanel={(panel) => updateUiState({ panel })}
                />

                {parsedUiState.state.panel === 'step' ? (
                  <GMCurrentStepPanel
                    gameplay={gameplay}
                    model={controlModel}
                    forms={forms}
                    commandStatus={commandStatus}
                    isRunning={isRunning}
                    onLoadSample={loadSample}
                    onSelectProcedure={selectProcedureCommand}
                    onResolveCheck={resolveCheckCommand}
                    onOpenCombat={openCombat}
                    onSubmitCombatAction={submitCombatAction}
                    onResolveCombatTurn={resolveCombat}
                    onCloseCombat={closeCombatCommand}
                    onChangeMode={(mode) => updateUiState({ mode })}
                    onOpenUtility={(utility) => updateUiState({ utility })}
                  />
                ) : gameplay ? (
                  <GMGraphPanel
                    gameplay={gameplay}
                    selectedNodeId={forms.selectedNodeId}
                    onSelectNode={forms.setSelectedNodeId}
                  />
                ) : (
                  <section className="c-gm-panel" aria-label="Whole gameplay graph">
                    <div className="c-note c-note--info">
                      <span className="t-small">Load the gameplay sample to inspect the live graph with GM data.</span>
                    </div>
                  </section>
                )}
              </div>

              {isDesktop ? (
                <GMUtilitiesDock
                  utility={parsedUiState.state.utility}
                  onClose={() => updateUiState({ utility: null })}
                >
                  {utilityContent}
                </GMUtilitiesDock>
              ) : null}
            </div>
          ) : (
            <section className="c-gm-chat-mode" aria-label="GM chat mode">
              <div className="l-row">
                <button type="button" className="c-btn" onClick={() => updateUiState({ mode: 'control' })}>
                  Back to Control Center
                </button>
              </div>
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
            </section>
          )}
        </div>
      </Panel>

      {!isDesktop ? (
        <GMUtilitiesSheet
          utility={parsedUiState.state.utility}
          onClose={() => updateUiState({ utility: null })}
        >
          {utilityContent}
        </GMUtilitiesSheet>
      ) : null}
    </div>
  );

  async function loadSample() {
    await submitEnvelopeAndAwait('Load RPG sample', {
      commandId: createCommandId(),
      gameId,
      type: 'GMFrameGameplayScene',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      payload: {
        seedId: 'rpg_sample_tavern',
      },
    } satisfies CommandEnvelopeInput<'GMFrameGameplayScene'>);
    await gameplayState.refresh();
  }

  async function selectProcedureCommand() {
    await submitEnvelopeAndAwait('Select procedure', {
      commandId: createCommandId(),
      gameId,
      type: 'GMSelectGameplayProcedure',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      payload: {
        procedure: forms.procedureForm.procedure,
        actionLabel: forms.procedureForm.actionLabel.trim() || 'Scene action',
        baselineScore: toInt(forms.procedureForm.baselineScore),
        modifiers: toInt(forms.procedureForm.modifiers),
        targetScore: forms.procedureForm.procedure === 'DIFFICULTY_CHECK' ? null : toNullableInt(forms.procedureForm.targetScore),
        difficulty: forms.procedureForm.procedure === 'DIFFICULTY_CHECK' ? toNullableInt(forms.procedureForm.difficulty) : null,
        publicPrompt: forms.procedureForm.publicPrompt.trim() || 'GM selects a procedure.',
        gmPrompt: forms.procedureForm.gmPrompt.trim() || undefined,
      },
    } satisfies CommandEnvelopeInput<'GMSelectGameplayProcedure'>);
    await gameplayState.refresh();
  }

  async function resolveCheckCommand(procedureOverride: Extract<GameplayProcedure, 'NO_ROLL' | 'STANDARD_CHECK' | 'DIFFICULTY_CHECK'>) {
    await submitEnvelopeAndAwait('Resolve check', {
      commandId: createCommandId(),
      gameId,
      type: 'GMResolveGameplayCheck',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      payload: {
        procedure: procedureOverride,
        actionLabel: forms.procedureForm.actionLabel.trim() || 'Scene action',
        baselineScore: toInt(forms.procedureForm.baselineScore),
        modifiers: toInt(forms.procedureForm.modifiers),
        targetScore: procedureOverride === 'DIFFICULTY_CHECK' ? null : toNullableInt(forms.procedureForm.targetScore),
        difficulty: procedureOverride === 'DIFFICULTY_CHECK' ? toNullableInt(forms.procedureForm.difficulty) : null,
        playerRollTotal: procedureOverride === 'NO_ROLL' ? null : toNullableInt(forms.checkResolutionForm.playerRollTotal),
        gmRollTotal: procedureOverride === 'DIFFICULTY_CHECK' ? toNullableInt(forms.checkResolutionForm.gmRollTotal) : null,
        publicNarration: forms.checkResolutionForm.publicNarration.trim() || 'The fiction moves forward.',
        gmNarration: forms.checkResolutionForm.gmNarration.trim() || undefined,
      },
    } satisfies CommandEnvelopeInput<'GMResolveGameplayCheck'>);
    await gameplayState.refresh();
  }

  async function openCombat() {
    await submitEnvelopeAndAwait('Open combat round', {
      commandId: createCommandId(),
      gameId,
      type: 'GMOpenCombatRound',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      payload: {
        summary: forms.combatOpenForm.combatSummary.trim() || 'Combat begins.',
      },
    } satisfies CommandEnvelopeInput<'GMOpenCombatRound'>);
    await gameplayState.refresh();
  }

  async function submitCombatAction() {
    const currentRound = gameplay?.session.combat?.rounds[gameplay.session.combat.rounds.length - 1] ?? null;
    if (!currentRound || !forms.gmCombatDeclarationForm.gmCombatActorCombatantId) {
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
        actorCombatantId: forms.gmCombatDeclarationForm.gmCombatActorCombatantId,
        targetCombatantId: forms.gmCombatDeclarationForm.gmCombatTargetCombatantId || null,
        actionType: forms.gmCombatDeclarationForm.gmCombatActionType,
        movementMode: forms.gmCombatDeclarationForm.gmCombatMovementMode,
        delayToOrderZero: forms.gmCombatDeclarationForm.gmCombatDelay,
        summary: forms.gmCombatDeclarationForm.gmCombatSummary.trim() || 'Combat action declared.',
      },
    } satisfies CommandEnvelopeInput<'SubmitCombatAction'>);
    forms.gmCombatDeclarationForm.setGmCombatSummary('Combat action declared.');
    await gameplayState.refresh();
  }

  async function resolveCombat() {
    const currentRound = gameplay?.session.combat?.rounds[gameplay.session.combat.rounds.length - 1] ?? null;
    if (!currentRound) {
      return;
    }

    await submitEnvelopeAndAwait('Resolve combat turn', {
      commandId: createCommandId(),
      gameId,
      type: 'GMResolveCombatTurn',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      payload: {
        roundNumber: currentRound.roundNumber,
        actionId: forms.combatResolutionForm.resolveActionId || `${forms.combatResolutionForm.resolveActorCombatantId}:${currentRound.roundNumber}`,
        actorCombatantId: forms.combatResolutionForm.resolveActorCombatantId,
        targetCombatantId: forms.combatResolutionForm.resolveTargetCombatantId,
        attackContext: forms.combatResolutionForm.resolveAttackContext,
        attackerBase: toInt(forms.combatResolutionForm.attackerBase),
        attackerRollTotal: toInt(forms.combatResolutionForm.attackerRoll),
        fixedTargetScore: toNullableInt(forms.combatResolutionForm.fixedTargetScore),
        defenderBase: forms.combatResolutionForm.resolveAttackContext === 'CHARACTER_TO_MONSTER' ? null : toNullableInt(forms.combatResolutionForm.defenderBase),
        defenderRollTotal: forms.combatResolutionForm.resolveAttackContext === 'CHARACTER_TO_MONSTER' ? null : toNullableInt(forms.combatResolutionForm.defenderRoll),
        baseDamage: toInt(forms.combatResolutionForm.baseDamage),
        bonusDamage: toInt(forms.combatResolutionForm.bonusDamage),
        defenseValue: toInt(forms.combatResolutionForm.defenseValue),
        damageReduction: toInt(forms.combatResolutionForm.damageReduction),
        narration: forms.combatResolutionForm.combatNarration.trim() || 'A combat turn resolves.',
      },
    } satisfies CommandEnvelopeInput<'GMResolveCombatTurn'>);
    await gameplayState.refresh();
  }

  async function closeCombatCommand() {
    await submitEnvelopeAndAwait('Close combat', {
      commandId: createCommandId(),
      gameId,
      type: 'GMCloseCombat',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      payload: {
        summary: forms.closeCombatForm.closeSummary.trim() || 'Combat closes.',
      },
    } satisfies CommandEnvelopeInput<'GMCloseCombat'>);
    await gameplayState.refresh();
  }

  function updateUiState(nextPartial: Partial<GmPlayUiState>) {
    const nextState = {
      ...parsedUiState.state,
      ...nextPartial,
    };
    setSearchParams(createGmPlaySearchParams(nextState));
  }

  function renderUtilityContent(utility: GmUtilityId) {
    switch (utility) {
      case 'timeseries':
        return <GameplayTimeseriesPanel events={controlModel.timeseries} />;
      case 'transcript':
        return (
          <GameplayTranscriptPanel
            transcriptMode={parsedUiState.state.transcript}
            onTranscriptModeChange={(transcript) => updateUiState({ transcript })}
            publicEvents={controlModel.publicTranscript}
            gmEvents={controlModel.gmTranscript}
          />
        );
      case 'status':
        return <GameplayCommandStatusPanel status={commandStatus} history={recentCommandStatuses} />;
    }
  }
}

function toInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableInt(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
