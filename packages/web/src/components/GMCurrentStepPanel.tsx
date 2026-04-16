import { useRef } from 'react';
import type { GameplayCombatActionType, GameplayMovementMode, GameplayProcedure } from '@starter/shared';
import type { GameplayView } from '../api/ApiClient';
import type { GmControlModel, GmPlayMode, GmUtilityId } from '../data/gmControlModel';
import type { CommandStatusViewModel } from '../hooks/useCommandStatus';
import { GameplayRulesInfo } from './GameplayRulesInfo';
import type { useGmGameplayFormState } from '../hooks/useGmGameplayFormState';

const procedureOptions: GameplayProcedure[] = ['NO_ROLL', 'STANDARD_CHECK', 'DIFFICULTY_CHECK', 'COMBAT', 'MAGIC'];
const combatActionOptions: GameplayCombatActionType[] = ['ATTACK', 'CAST_MAGIC', 'MOVE', 'DELAY', 'DEFEND', 'OTHER'];
const movementModeOptions: GameplayMovementMode[] = ['FULL', 'NORMAL', 'STAND_STILL'];
const attackContextOptions = ['CHARACTER_TO_MONSTER', 'MONSTER_TO_CHARACTER', 'CHARACTER_TO_CHARACTER'] as const;

type GmFormState = ReturnType<typeof useGmGameplayFormState>;

interface GMCurrentStepPanelProps {
  gameplay: GameplayView | null;
  model: GmControlModel;
  forms: GmFormState;
  commandStatus: CommandStatusViewModel;
  isRunning: boolean;
  onLoadSample: () => Promise<void>;
  onSelectProcedure: () => Promise<void>;
  onResolveCheck: (procedure: Extract<GameplayProcedure, 'NO_ROLL' | 'STANDARD_CHECK' | 'DIFFICULTY_CHECK'>) => Promise<void>;
  onOpenCombat: () => Promise<void>;
  onSubmitCombatAction: () => Promise<void>;
  onResolveCombatTurn: () => Promise<void>;
  onCloseCombat: () => Promise<void>;
  onChangeMode: (mode: GmPlayMode) => void;
  onOpenUtility: (utility: GmUtilityId) => void;
}

export function GMCurrentStepPanel({
  gameplay,
  model,
  forms,
  commandStatus,
  isRunning,
  onLoadSample,
  onSelectProcedure,
  onResolveCheck,
  onOpenCombat,
  onSubmitCombatAction,
  onResolveCombatTurn,
  onCloseCombat,
  onChangeMode,
  onOpenUtility,
}: GMCurrentStepPanelProps) {
  const procedureRef = useRef<HTMLElement | null>(null);
  const resolveRef = useRef<HTMLElement | null>(null);
  const openCombatRef = useRef<HTMLElement | null>(null);
  const declareCombatRef = useRef<HTMLElement | null>(null);
  const resolveCombatRef = useRef<HTMLElement | null>(null);
  const closeCombatRef = useRef<HTMLElement | null>(null);

  async function handleAction(actionId: string) {
    switch (actionId) {
      case 'LOAD_SAMPLE':
        await onLoadSample();
        break;
      case 'OPEN_CHAT_MODE':
        onChangeMode('chat');
        break;
      case 'OPEN_TIMESERIES_UTILITY':
        onOpenUtility('timeseries');
        break;
      case 'OPEN_TRANSCRIPT_UTILITY':
      case 'FOCUS_PLAYER_INTENT':
      case 'RESUME_SCENE':
        onOpenUtility('transcript');
        break;
      case 'OPEN_STATUS_UTILITY':
        onOpenUtility('status');
        break;
      case 'SELECT_PROCEDURE':
        procedureRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      case 'RESOLVE_NO_ROLL':
      case 'RESOLVE_STANDARD_CHECK':
      case 'RESOLVE_DIFFICULTY_CHECK':
        resolveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      case 'OPEN_COMBAT':
        openCombatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      case 'DECLARE_COMBAT_ACTION':
        declareCombatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      case 'PREPARE_COMBAT_RESOLUTION':
      case 'RESOLVE_COMBAT_TURN':
      case 'CONTINUE_COMBAT_ROUND':
        resolveCombatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      case 'CLOSE_COMBAT':
        closeCombatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
    }
  }

  return (
    <section className="c-gm-panel" aria-label="Current step panel">
      <div className="l-row">
        <div className="l-col l-tight">
          <h2 className="t-h4">Current Step</h2>
          <span className="t-small">{model.currentStep.description}</span>
        </div>
        <span className="c-gameplay-card__fact">{model.currentStep.title}</span>
      </div>

      <div className={`c-note ${commandStatus.state === 'Failed' ? 'c-note--error' : 'c-note--info'}`}>
        <span className="t-small">{commandStatus.message}</span>
      </div>

      <StepActionGrid
        title="GM Actions"
        actions={model.currentStep.primaryActions}
        isRunning={isRunning}
        onAction={handleAction}
      />

      {model.currentStep.secondaryActions.length > 0 ? (
        <StepActionGrid
          title="Support Tools"
          actions={model.currentStep.secondaryActions}
          isRunning={false}
          onAction={handleAction}
          compact
        />
      ) : null}

      <StepNextSteps nextSteps={model.currentStep.nextSteps} />

      <GameplayRulesInfo topicId={model.currentStep.infoTopicId} />

      {model.currentStep.kind === 'no_session' ? null : renderCurrentStepDetails()}

      <section ref={procedureRef} className="c-gm-step-sections__anchor" aria-label="Procedure controls">
        {(model.currentStep.kind === 'player_intent' ||
          model.currentStep.kind === 'procedure_selection' ||
          model.currentStep.kind === 'magic') ? (
          <ProcedureSelectionSection
            currentStepKind={model.currentStep.kind}
            gameplay={gameplay}
            forms={forms}
            isRunning={isRunning}
            onSelectProcedure={onSelectProcedure}
          />
        ) : null}
      </section>

      <section ref={resolveRef} className="c-gm-step-sections__anchor" aria-label="Check resolution controls">
        {(model.currentStep.kind === 'no_roll' ||
          model.currentStep.kind === 'standard_check' ||
          model.currentStep.kind === 'difficulty_check') ? (
          <CheckResolutionSection
            currentStepKind={model.currentStep.kind}
            forms={forms}
            isRunning={isRunning}
            onResolveCheck={onResolveCheck}
          />
        ) : null}
      </section>

      <section ref={openCombatRef} className="c-gm-step-sections__anchor" aria-label="Open combat controls">
        {model.currentStep.kind === 'combat_round' || model.currentStep.kind === 'magic' ? (
          <OpenCombatSection
            forms={forms}
            isRunning={isRunning}
            onOpenCombat={onOpenCombat}
            title="Open Combat Round"
            subtitle={
              model.currentStep.kind === 'magic'
                ? 'Escalate the magic action into combat timing when action order matters.'
                : 'Start the current combat round so declarations and action order can begin.'
            }
          />
        ) : null}
      </section>

      <section ref={declareCombatRef} className="c-gm-step-sections__anchor" aria-label="Combat declaration controls">
        {(model.currentStep.kind === 'combat_round' || model.currentStep.kind === 'damage') ? (
          <GMCombatDeclarationSection gameplay={gameplay} forms={forms} isRunning={isRunning} onSubmitCombatAction={onSubmitCombatAction} />
        ) : null}
      </section>

      <section ref={resolveCombatRef} className="c-gm-step-sections__anchor" aria-label="Combat resolution controls">
        {(model.currentStep.kind === 'combat_round' ||
          model.currentStep.kind === 'weapon_attack' ||
          model.currentStep.kind === 'damage') ? (
          <CombatResolutionSection
            gameplay={gameplay}
            currentStep={model.currentStep}
            forms={forms}
            isRunning={isRunning}
            onResolveCombatTurn={onResolveCombatTurn}
          />
        ) : null}
      </section>

      <section ref={closeCombatRef} className="c-gm-step-sections__anchor" aria-label="Close combat controls">
        {(model.currentStep.kind === 'combat_round' || model.currentStep.kind === 'damage') ? (
          <CloseCombatSection forms={forms} isRunning={isRunning} onCloseCombat={onCloseCombat} />
        ) : null}
      </section>
    </section>
  );

  function renderCurrentStepDetails() {
    switch (model.currentStep.kind) {
      case 'scene_frame':
        return (
          <EventSummarySection
            title="Recent Table State"
            emptyText="The table is waiting for the next state change."
            items={model.currentStep.recentEvents.map((event) => ({
              key: event.eventId,
              title: event.title,
              body: event.body,
              meta: event.nodeId,
            }))}
          />
        );
      case 'player_intent':
        return (
          <EventSummarySection
            title="Recent Intents"
            emptyText="No submitted intents yet."
            items={model.currentStep.recentIntents.map((event) => ({
              key: event.eventId,
              title: event.title,
              body: event.body,
              meta: event.detail.characterId ? String(event.detail.characterId) : event.nodeId,
            }))}
          />
        );
      case 'procedure_selection':
        return (
          <EventSummarySection
            title="Procedure Context"
            emptyText="No recent intent context found."
            items={model.currentStep.recentIntents.map((event) => ({
              key: event.eventId,
              title: event.title,
              body: event.body,
              meta: event.nodeId,
            }))}
          />
        );
      case 'combat_round':
        return <CombatRoundSummary currentStep={model.currentStep} />;
      case 'weapon_attack':
        return <WeaponAttackSummary currentStep={model.currentStep} />;
      case 'damage':
        return <DamageSummary currentStep={model.currentStep} />;
      case 'aftermath':
        return (
          <section className="c-gm-step-section">
            <div className="l-row">
              <h3 className="t-h4">Aftermath Summary</h3>
            </div>
            <div className="c-note c-note--info">
              <span className="t-small">{model.currentStep.aftermathSummary ?? 'No aftermath summary recorded yet.'}</span>
            </div>
          </section>
        );
      case 'magic':
        return (
          <section className="c-gm-step-section">
            <div className="l-row">
              <h3 className="t-h4">Magic Control</h3>
            </div>
            <div className="c-note c-note--info">
              <span className="t-small">
                Use the current fiction to decide whether the spell should resolve like a standard check or move into combat timing.
              </span>
            </div>
          </section>
        );
      case 'no_roll':
      case 'standard_check':
      case 'difficulty_check':
        return (
          <section className="c-gm-step-section">
            <div className="l-row">
              <h3 className="t-h4">Active Check</h3>
            </div>
            <div className="c-note c-note--info">
              <span className="t-small">{model.currentStep.activeCheckLabel ?? 'No active check label is currently loaded.'}</span>
            </div>
          </section>
        );
      case 'no_session':
        return null;
    }
  }
}

function ProcedureSelectionSection(input: {
  currentStepKind: 'player_intent' | 'procedure_selection' | 'magic';
  gameplay: GameplayView | null;
  forms: GmFormState;
  isRunning: boolean;
  onSelectProcedure: () => Promise<void>;
}) {
  const availableProcedures =
    input.currentStepKind === 'magic' ? (['STANDARD_CHECK', 'COMBAT'] as GameplayProcedure[]) : procedureOptions;

  return (
    <form
      className="c-gm-step-section"
      onSubmit={(event) => {
        event.preventDefault();
        void input.onSelectProcedure();
      }}
    >
      <div className="l-row">
        <h3 className="t-h4">Choose Procedure</h3>
      </div>
      <div className="c-gm-procedure-grid">
        {availableProcedures.map((option) => (
          <button
            key={option}
            type="button"
            className={`c-gm-procedure-card ${input.forms.procedureForm.procedure === option ? 'is-selected' : ''}`.trim()}
            aria-pressed={input.forms.procedureForm.procedure === option}
            onClick={() => input.forms.procedureForm.setProcedure(option)}
          >
            <span className="c-gm-procedure-card__title">{option}</span>
            <span className="t-small">{readProcedureDescription(option)}</span>
          </button>
        ))}
      </div>
      <label className="c-field">
        <span className="c-field__label">Action label</span>
        <input className="c-field__control" value={input.forms.procedureForm.actionLabel} disabled={input.isRunning} onChange={(event) => input.forms.procedureForm.setActionLabel(event.target.value)} />
      </label>
      <div className="c-gameplay-ops__row">
        <NumberField label="Baseline" value={input.forms.procedureForm.baselineScore} disabled={input.isRunning} onChange={input.forms.procedureForm.setBaselineScore} />
        <NumberField label="Modifiers" value={input.forms.procedureForm.modifiers} disabled={input.isRunning} onChange={input.forms.procedureForm.setModifiers} />
        <NumberField label="Target" value={input.forms.procedureForm.targetScore} disabled={input.isRunning || input.forms.procedureForm.procedure === 'DIFFICULTY_CHECK' || input.forms.procedureForm.procedure === 'COMBAT' || input.forms.procedureForm.procedure === 'MAGIC'} onChange={input.forms.procedureForm.setTargetScore} />
        <NumberField label="Difficulty" value={input.forms.procedureForm.difficulty} disabled={input.isRunning || input.forms.procedureForm.procedure !== 'DIFFICULTY_CHECK'} onChange={input.forms.procedureForm.setDifficulty} />
      </div>
      <label className="c-field">
        <span className="c-field__label">Public prompt</span>
        <textarea className="c-field__control c-gameplay__textarea" value={input.forms.procedureForm.publicPrompt} disabled={input.isRunning} onChange={(event) => input.forms.procedureForm.setPublicPrompt(event.target.value)} />
      </label>
      <label className="c-field">
        <span className="c-field__label">GM prompt</span>
        <textarea className="c-field__control c-gameplay__textarea" value={input.forms.procedureForm.gmPrompt} disabled={input.isRunning} onChange={(event) => input.forms.procedureForm.setGmPrompt(event.target.value)} />
      </label>
      <button className={`c-btn ${input.isRunning ? 'is-disabled' : ''}`.trim()} type="submit" disabled={input.isRunning}>
        Select Procedure
      </button>
    </form>
  );
}

function CheckResolutionSection(input: {
  currentStepKind: 'no_roll' | 'standard_check' | 'difficulty_check';
  forms: GmFormState;
  isRunning: boolean;
  onResolveCheck: (procedure: Extract<GameplayProcedure, 'NO_ROLL' | 'STANDARD_CHECK' | 'DIFFICULTY_CHECK'>) => Promise<void>;
}) {
  const procedureByStep = {
    no_roll: 'NO_ROLL',
    standard_check: 'STANDARD_CHECK',
    difficulty_check: 'DIFFICULTY_CHECK',
  } as const;
  const procedure = procedureByStep[input.currentStepKind];

  return (
    <form
      className="c-gm-step-section"
      onSubmit={(event) => {
        event.preventDefault();
        void input.onResolveCheck(procedure);
      }}
    >
      <div className="l-row">
        <h3 className="t-h4">Resolve Check</h3>
      </div>
      <div className="c-gameplay-ops__row">
        <NumberField label="Player roll" value={input.forms.checkResolutionForm.playerRollTotal} disabled={input.isRunning || procedure === 'NO_ROLL'} onChange={input.forms.checkResolutionForm.setPlayerRollTotal} />
        {procedure === 'DIFFICULTY_CHECK' ? (
          <NumberField label="GM roll" value={input.forms.checkResolutionForm.gmRollTotal} disabled={input.isRunning} onChange={input.forms.checkResolutionForm.setGmRollTotal} />
        ) : null}
      </div>
      <label className="c-field">
        <span className="c-field__label">Public narration</span>
        <textarea className="c-field__control c-gameplay__textarea" value={input.forms.checkResolutionForm.publicNarration} disabled={input.isRunning} onChange={(event) => input.forms.checkResolutionForm.setPublicNarration(event.target.value)} />
      </label>
      <label className="c-field">
        <span className="c-field__label">GM narration</span>
        <textarea className="c-field__control c-gameplay__textarea" value={input.forms.checkResolutionForm.gmNarration} disabled={input.isRunning} onChange={(event) => input.forms.checkResolutionForm.setGmNarration(event.target.value)} />
      </label>
      <button className={`c-btn ${input.isRunning ? 'is-disabled' : ''}`.trim()} type="submit" disabled={input.isRunning}>
        Resolve Check
      </button>
    </form>
  );
}

function OpenCombatSection(input: {
  forms: GmFormState;
  isRunning: boolean;
  onOpenCombat: () => Promise<void>;
  title: string;
  subtitle: string;
}) {
  return (
    <form
      className="c-gm-step-section"
      onSubmit={(event) => {
        event.preventDefault();
        void input.onOpenCombat();
      }}
    >
      <div className="l-row">
        <h3 className="t-h4">{input.title}</h3>
      </div>
      <div className="c-note c-note--info">
        <span className="t-small">{input.subtitle}</span>
      </div>
      <label className="c-field">
        <span className="c-field__label">Combat summary</span>
        <textarea className="c-field__control c-gameplay__textarea" value={input.forms.combatOpenForm.combatSummary} disabled={input.isRunning} onChange={(event) => input.forms.combatOpenForm.setCombatSummary(event.target.value)} />
      </label>
      <button className={`c-btn ${input.isRunning ? 'is-disabled' : ''}`.trim()} type="submit" disabled={input.isRunning}>
        Open Combat Round
      </button>
    </form>
  );
}

function GMCombatDeclarationSection(input: {
  gameplay: GameplayView | null;
  forms: GmFormState;
  isRunning: boolean;
  onSubmitCombatAction: () => Promise<void>;
}) {
  const currentRound = input.gameplay?.session.combat?.rounds[input.gameplay.session.combat.rounds.length - 1] ?? null;

  return (
    <form
      className="c-gm-step-section"
      onSubmit={(event) => {
        event.preventDefault();
        void input.onSubmitCombatAction();
      }}
    >
      <div className="l-row">
        <h3 className="t-h4">Declare GM/NPC Action</h3>
      </div>
      <div className="c-note c-note--info">
        <span className="t-small">{currentRound ? `Round ${currentRound.roundNumber} is collecting actions.` : 'Open combat before declaring actions.'}</span>
      </div>
      <label className="c-field">
        <span className="c-field__label">Actor combatant</span>
        <select className="c-field__control" value={input.forms.gmCombatDeclarationForm.gmCombatActorCombatantId} disabled={input.isRunning || !currentRound} onChange={(event) => input.forms.gmCombatDeclarationForm.setGmCombatActorCombatantId(event.target.value)}>
          <option value="">Select actor</option>
          {(input.gameplay?.session.combatants ?? []).map((combatant) => (
            <option key={combatant.combatantId} value={combatant.combatantId}>
              {combatant.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="c-field">
        <span className="c-field__label">Target combatant</span>
        <select className="c-field__control" value={input.forms.gmCombatDeclarationForm.gmCombatTargetCombatantId} disabled={input.isRunning || !currentRound} onChange={(event) => input.forms.gmCombatDeclarationForm.setGmCombatTargetCombatantId(event.target.value)}>
          <option value="">Select target</option>
          {(input.gameplay?.session.combatants ?? []).map((combatant) => (
            <option key={combatant.combatantId} value={combatant.combatantId}>
              {combatant.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="c-field">
        <span className="c-field__label">Action</span>
        <select className="c-field__control" value={input.forms.gmCombatDeclarationForm.gmCombatActionType} disabled={input.isRunning || !currentRound} onChange={(event) => input.forms.gmCombatDeclarationForm.setGmCombatActionType(event.target.value as GameplayCombatActionType)}>
          {combatActionOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="c-field">
        <span className="c-field__label">Movement</span>
        <select className="c-field__control" value={input.forms.gmCombatDeclarationForm.gmCombatMovementMode} disabled={input.isRunning || !currentRound} onChange={(event) => input.forms.gmCombatDeclarationForm.setGmCombatMovementMode(event.target.value as GameplayMovementMode)}>
          {movementModeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="c-field">
        <span className="c-field__label">Summary</span>
        <input className="c-field__control" value={input.forms.gmCombatDeclarationForm.gmCombatSummary} disabled={input.isRunning || !currentRound} onChange={(event) => input.forms.gmCombatDeclarationForm.setGmCombatSummary(event.target.value)} />
      </label>
      <label className="c-field__check">
        <input
          className="c-field__control c-field__control--check"
          type="checkbox"
          checked={input.forms.gmCombatDeclarationForm.gmCombatDelay}
          disabled={input.isRunning || !currentRound}
          onChange={(event) => input.forms.gmCombatDeclarationForm.setGmCombatDelay(event.target.checked)}
        />
        <span className="t-small">Delay to order zero</span>
      </label>
      <button className={`c-btn ${input.isRunning || !currentRound ? 'is-disabled' : ''}`.trim()} type="submit" disabled={input.isRunning || !currentRound}>
        Declare Combat Action
      </button>
    </form>
  );
}

function CombatResolutionSection(input: {
  gameplay: GameplayView | null;
  currentStep: GmControlModel['currentStep'];
  forms: GmFormState;
  isRunning: boolean;
  onResolveCombatTurn: () => Promise<void>;
}) {
  const currentRound = input.gameplay?.session.combat?.rounds[input.gameplay.session.combat.rounds.length - 1] ?? null;
  const unresolvedActions =
    input.currentStep.kind === 'combat_round' ||
    input.currentStep.kind === 'weapon_attack' ||
    input.currentStep.kind === 'damage'
      ? input.currentStep.unresolvedActions
      : [];

  return (
    <form
      className="c-gm-step-section"
      onSubmit={(event) => {
        event.preventDefault();
        void input.onResolveCombatTurn();
      }}
    >
      <div className="l-row">
        <h3 className="t-h4">Resolve Combat Turn</h3>
      </div>
      {unresolvedActions.length > 0 ? (
        <div className="c-gm-unresolved-list" aria-label="Unresolved combat actions">
          {unresolvedActions.map((action) => (
            <button
              key={action.actionId}
              type="button"
              className={`c-gm-unresolved-list__item ${input.forms.combatResolutionForm.resolveActionId === action.actionId ? 'is-selected' : ''}`.trim()}
              aria-pressed={input.forms.combatResolutionForm.resolveActionId === action.actionId}
              onClick={() => {
                input.forms.combatResolutionForm.setResolveActionId(action.actionId);
                input.forms.combatResolutionForm.setResolveActorCombatantId(action.actorCombatantId);
                input.forms.combatResolutionForm.setResolveTargetCombatantId(action.targetCombatantId ?? '');
              }}
            >
              <span>{action.summary}</span>
              <span className="t-small">{action.actorCombatantId}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="c-note c-note--info">
          <span className="t-small">No unresolved combat actions remain.</span>
        </div>
      )}
      <label className="c-field">
        <span className="c-field__label">Action</span>
        <select className="c-field__control" value={input.forms.combatResolutionForm.resolveActionId} disabled={input.isRunning || !currentRound} onChange={(event) => input.forms.combatResolutionForm.setResolveActionId(event.target.value)}>
          <option value="">Select action</option>
          {(currentRound?.declaredActions ?? []).map((action) => (
            <option key={action.actionId} value={action.actionId}>
              {action.summary}
            </option>
          ))}
        </select>
      </label>
      <label className="c-field">
        <span className="c-field__label">Actor combatant</span>
        <select className="c-field__control" value={input.forms.combatResolutionForm.resolveActorCombatantId} disabled={input.isRunning || !currentRound} onChange={(event) => input.forms.combatResolutionForm.setResolveActorCombatantId(event.target.value)}>
          <option value="">Select actor</option>
          {(input.gameplay?.session.combatants ?? []).map((combatant) => (
            <option key={combatant.combatantId} value={combatant.combatantId}>
              {combatant.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="c-field">
        <span className="c-field__label">Target combatant</span>
        <select className="c-field__control" value={input.forms.combatResolutionForm.resolveTargetCombatantId} disabled={input.isRunning || !currentRound} onChange={(event) => input.forms.combatResolutionForm.setResolveTargetCombatantId(event.target.value)}>
          <option value="">Select target</option>
          {(input.gameplay?.session.combatants ?? []).map((combatant) => (
            <option key={combatant.combatantId} value={combatant.combatantId}>
              {combatant.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="c-field">
        <span className="c-field__label">Attack context</span>
        <select className="c-field__control" value={input.forms.combatResolutionForm.resolveAttackContext} disabled={input.isRunning || !currentRound} onChange={(event) => input.forms.combatResolutionForm.setResolveAttackContext(event.target.value as (typeof attackContextOptions)[number])}>
          {attackContextOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <div className="c-gameplay-ops__row">
        <NumberField label="Attacker base" value={input.forms.combatResolutionForm.attackerBase} disabled={input.isRunning || !currentRound} onChange={input.forms.combatResolutionForm.setAttackerBase} />
        <NumberField label="Attacker roll" value={input.forms.combatResolutionForm.attackerRoll} disabled={input.isRunning || !currentRound} onChange={input.forms.combatResolutionForm.setAttackerRoll} />
        <NumberField label="Fixed target" value={input.forms.combatResolutionForm.fixedTargetScore} disabled={input.isRunning || !currentRound} onChange={input.forms.combatResolutionForm.setFixedTargetScore} />
        <NumberField label="Defender base" value={input.forms.combatResolutionForm.defenderBase} disabled={input.isRunning || !currentRound || input.forms.combatResolutionForm.resolveAttackContext === 'CHARACTER_TO_MONSTER'} onChange={input.forms.combatResolutionForm.setDefenderBase} />
        <NumberField label="Defender roll" value={input.forms.combatResolutionForm.defenderRoll} disabled={input.isRunning || !currentRound || input.forms.combatResolutionForm.resolveAttackContext === 'CHARACTER_TO_MONSTER'} onChange={input.forms.combatResolutionForm.setDefenderRoll} />
      </div>
      <div className="c-gameplay-ops__row">
        <NumberField label="Base damage" value={input.forms.combatResolutionForm.baseDamage} disabled={input.isRunning || !currentRound} onChange={input.forms.combatResolutionForm.setBaseDamage} />
        <NumberField label="Bonus damage" value={input.forms.combatResolutionForm.bonusDamage} disabled={input.isRunning || !currentRound} onChange={input.forms.combatResolutionForm.setBonusDamage} />
        <NumberField label="Defense value" value={input.forms.combatResolutionForm.defenseValue} disabled={input.isRunning || !currentRound} onChange={input.forms.combatResolutionForm.setDefenseValue} />
        <NumberField label="Damage reduction" value={input.forms.combatResolutionForm.damageReduction} disabled={input.isRunning || !currentRound} onChange={input.forms.combatResolutionForm.setDamageReduction} />
      </div>
      <label className="c-field">
        <span className="c-field__label">Narration</span>
        <textarea className="c-field__control c-gameplay__textarea" value={input.forms.combatResolutionForm.combatNarration} disabled={input.isRunning || !currentRound} onChange={(event) => input.forms.combatResolutionForm.setCombatNarration(event.target.value)} />
      </label>
      <button className={`c-btn ${input.isRunning || !currentRound ? 'is-disabled' : ''}`.trim()} type="submit" disabled={input.isRunning || !currentRound}>
        Resolve Combat Turn
      </button>
    </form>
  );
}

function CloseCombatSection(input: {
  forms: GmFormState;
  isRunning: boolean;
  onCloseCombat: () => Promise<void>;
}) {
  return (
    <form
      className="c-gm-step-section"
      onSubmit={(event) => {
        event.preventDefault();
        void input.onCloseCombat();
      }}
    >
      <div className="l-row">
        <h3 className="t-h4">Close Combat</h3>
      </div>
      <label className="c-field">
        <span className="c-field__label">Aftermath summary</span>
        <textarea className="c-field__control c-gameplay__textarea" value={input.forms.closeCombatForm.closeSummary} disabled={input.isRunning} onChange={(event) => input.forms.closeCombatForm.setCloseSummary(event.target.value)} />
      </label>
      <button className={`c-btn ${input.isRunning ? 'is-disabled' : ''}`.trim()} type="submit" disabled={input.isRunning}>
        Close Combat
      </button>
    </form>
  );
}

function StepActionGrid(input: {
  title: string;
  actions: GmControlModel['currentStep']['primaryActions'];
  isRunning: boolean;
  onAction: (actionId: string) => void | Promise<void>;
  compact?: boolean;
}) {
  return (
    <section className="c-gm-step-actions" aria-label={input.title}>
      <div className="l-row">
        <h3 className="t-h4">{input.title}</h3>
      </div>
      <div className={`c-gm-step-actions__grid ${input.compact ? 'is-compact' : ''}`.trim()}>
        {input.actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className={`c-gm-step-actions__card ${action.enabled && !input.isRunning ? '' : 'is-disabled'}`.trim()}
            aria-label={action.label}
            disabled={!action.enabled || input.isRunning}
            title={action.disabledReason}
            onClick={() => {
              void input.onAction(action.id);
            }}
          >
            <span className="c-gm-step-actions__title">{action.label}</span>
            <span className="t-small">{action.enabled ? action.description : action.disabledReason}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function StepNextSteps({ nextSteps }: { nextSteps: GmControlModel['currentStep']['nextSteps'] }) {
  return (
    <section className="c-gm-next-steps" aria-label="Possible next steps">
      <div className="l-row">
        <h3 className="t-h4">Possible Next Steps</h3>
      </div>
      <div className="c-gm-next-steps__grid">
        {nextSteps.map((step) => (
          <article key={step.nodeId} className={`c-gm-next-steps__card ${step.enabled ? '' : 'is-disabled'}`.trim()}>
            <div className="c-gm-next-steps__title">{step.label}</div>
            <div className="t-small">{step.enabled ? step.description : step.disabledReason}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function EventSummarySection(input: {
  title: string;
  emptyText: string;
  items: Array<{ key: string; title: string; body: string; meta: string }>;
}) {
  return (
    <section className="c-gm-step-section">
      <div className="l-row">
        <h3 className="t-h4">{input.title}</h3>
      </div>
      {input.items.length === 0 ? (
        <div className="c-gameplay-feed__empty t-small">{input.emptyText}</div>
      ) : (
        <div className="c-gameplay-actions-list">
          {input.items.map((item) => (
            <article key={item.key} className="c-gameplay-actions-list__item">
              <div className="c-gameplay-status__header">
                <span>{item.title}</span>
                <span className="t-small">{item.meta}</span>
              </div>
              <div className="t-small">{item.body}</div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function CombatRoundSummary({ currentStep }: { currentStep: Extract<GmControlModel['currentStep'], { kind: 'combat_round' }> }) {
  return (
    <section className="c-gm-step-section">
      <div className="l-row">
        <h3 className="t-h4">Round Control</h3>
      </div>
      <div className="c-gameplay-status__meta">
        <span className="c-gameplay-card__fact">{currentStep.roundNumber ? `Round ${currentStep.roundNumber}` : 'No round open'}</span>
        <span className="c-gameplay-card__fact">Announcement: {currentStep.announcementOrder.join(' -> ') || 'n/a'}</span>
        <span className="c-gameplay-card__fact">Resolution: {currentStep.resolutionOrder.join(' -> ') || 'n/a'}</span>
      </div>
      <EventSummarySection
        title="Declared Actions"
        emptyText="No combat declarations yet."
        items={currentStep.declaredActions.map((action) => ({
          key: action.actionId,
          title: action.summary,
          body: `${action.actorCombatantId} using ${action.actionType} with ${action.movementMode}`,
          meta: action.delayToOrderZero ? 'order 0' : `round ${action.roundNumber}`,
        }))}
      />
    </section>
  );
}

function WeaponAttackSummary({ currentStep }: { currentStep: Extract<GmControlModel['currentStep'], { kind: 'weapon_attack' }> }) {
  return (
    <section className="c-gm-step-section">
      <div className="l-row">
        <h3 className="t-h4">Selected Action</h3>
      </div>
      <div className="c-note c-note--info">
        <span className="t-small">
          {currentStep.selectedAction
            ? `${currentStep.selectedAction.summary} (${currentStep.selectedAction.actorCombatantId} -> ${currentStep.selectedAction.targetCombatantId ?? 'no target'})`
            : 'No unresolved combat action is currently selected.'}
        </span>
      </div>
    </section>
  );
}

function DamageSummary({ currentStep }: { currentStep: Extract<GmControlModel['currentStep'], { kind: 'damage' }> }) {
  return (
    <section className="c-gm-step-section">
      <div className="l-row">
        <h3 className="t-h4">Damage Outcome</h3>
      </div>
      <div className="c-note c-note--info">
        <span className="t-small">{currentStep.latestResolution?.body ?? 'No public combat outcome has been recorded yet.'}</span>
      </div>
      <div className="c-gameplay-status__grid">
        {currentStep.combatSnapshot.map((combatant) => (
          <article key={combatant.combatantId} className={`c-gameplay-status__card c-gameplay-status__card--${combatant.side.toLowerCase()}`}>
            <div className="c-gameplay-status__header">
              <span>{combatant.displayName}</span>
              <span className="t-small">{combatant.side}</span>
            </div>
            <div className="t-small">LP {combatant.lifePoints}/{combatant.maxLifePoints}</div>
            <div className="t-small">Status {combatant.status}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function NumberField(input: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="c-field">
      <span className="c-field__label">{input.label}</span>
      <input className="c-field__control" inputMode="numeric" value={input.value} disabled={input.disabled} onChange={(event) => input.onChange(event.target.value)} />
    </label>
  );
}

function readProcedureDescription(procedure: GameplayProcedure): string {
  switch (procedure) {
    case 'NO_ROLL':
      return 'Directly adjudicate the fiction when uncertainty is not meaningful.';
    case 'STANDARD_CHECK':
      return 'Run a public target check.';
    case 'DIFFICULTY_CHECK':
      return 'Run a hidden target check with in-fiction feedback only.';
    case 'COMBAT':
      return 'Move toward combat timing and action order.';
    case 'MAGIC':
      return 'Treat the action as a magic-specific branching point.';
  }
}
