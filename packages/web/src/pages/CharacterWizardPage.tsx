import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PregameRole } from '@starter/shared';
import { useParams } from 'react-router-dom';
import { toPlayerCharacterLibraryGameId } from '@starter/shared/contracts/db';
import { createApiClient } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { CommandStatusPanel } from '../components/CommandStatusPanel';
import { Panel } from '../components/Panel';
import { Stepper, type StepperItem } from '../components/Stepper';
import {
  rollSubAbilitiesForRace,
  type HalfElfRaisedBy,
  type Race,
  type SubAbilityKey,
} from '../data/characterCreationReference';
import { computeSkillPurchasePreview } from '../data/characterCreationPurchasing';
import {
  applyFixtureAutofill,
  BackgroundStepPanel,
  buildInitialState,
  CharacterSnapshot,
  CharacterWizardAutofillControls,
  createCharacterId,
  createCharacterWizardViewModel,
  DiceStepPanel,
  EquipmentStepPanel,
  ExpStepPanel,
  hydrateWizardStateFromCharacter,
  IdentityStepPanel,
  InventoryCategory,
  InventoryQuantitiesKey,
  normalizePurchasesForBaseSkills,
  RaceStepPanel,
  SnapshotView,
  SubmitStepPanel,
  useCharacterWizardRouteContext,
  useCharacterWizardWorkflow,
  WizardMode,
  WizardState,
  WizardStepKey,
} from '../features/character-wizard';
import { PREGAME_ROLE_LABELS, PREGAME_ROLE_ORDER, usePregamePlanning } from '../features/pregame-planning';
import { useCommandWorkflow } from '../hooks/useCommandStatus';
import { logWebFlow } from '../logging/flowLog';

const stepTitles = ['Race', 'Dice A-H', 'Background rolls', 'Name/identity', 'EXP spend', 'Equipment cart', 'Submit'];

export function CharacterWizardPage() {
  const params = useParams<{ gameId?: string; playerId?: string; characterId?: string }>();
  const routeKey = `${params.gameId ?? ''}:${params.playerId ?? ''}:${params.characterId ?? ''}`;

  return <CharacterWizardPageContent key={routeKey} params={params} />;
}

function CharacterWizardPageContent({
  params,
}: {
  params: Readonly<{ gameId?: string; playerId?: string; characterId?: string }>;
}) {
  const auth = useAuthProvider();
  const routePlayerId = params.playerId ?? null;
  const wizardMode: WizardMode = routePlayerId ? 'library' : 'apply';
  const routeGameId = params.gameId ?? (routePlayerId ? toPlayerCharacterLibraryGameId(routePlayerId) : 'game-1');
  const generatedCharacterIdRef = useRef<string>(createCharacterId());
  const routeCharacterId = params.characterId ?? generatedCharacterIdRef.current;
  const isEditMode = typeof params.characterId === 'string' && params.characterId.trim() !== '';
  const api = useMemo(() => createApiClient({ auth }), [auth]);

  const [state, setState] = useState<WizardState>(() => buildInitialState(routeGameId, routeCharacterId));
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const stepPanelRefs = useRef<Array<HTMLElement | null>>([]);
  const commandStatusRef = useRef<HTMLDivElement | null>(null);
  const commandStatusScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stepError, setStepError] = useState<string>(' ');
  const [snapshot, setSnapshot] = useState<CharacterSnapshot | null>(null);
  const [selectedSavedCharacterId, setSelectedSavedCharacterId] = useState('');
  const [lastSavedFingerprint, setLastSavedFingerprint] = useState<string | null>(null);
  const { status: commandStatus, isRunning: isExecutingCommand, submitEnvelopeAndAwait } = useCommandWorkflow();

  useEffect(() => {
    setState(buildInitialState(routeGameId, routeCharacterId));
    setSnapshot(null);
    setSelectedSavedCharacterId('');
    setLastSavedFingerprint(null);
    setStepError(' ');
  }, [routeCharacterId, routeGameId]);

  const { routeReady, routeError, savedCharacters } = useCharacterWizardRouteContext({
    actorId: auth.actorId,
    api,
    isEditMode,
    routeGameId,
    routePlayerId,
    wizardMode,
  });

  useEffect(() => {
    if (!routeReady || routeError) {
      return;
    }
    logWebFlow('WEB_CHARACTER_WIZARD_MOUNT', {
      gameId: state.gameId,
      characterId: state.characterId,
      isEditMode,
      wizardMode,
    });
    if (!isEditMode) {
      logWebFlow('WEB_CHARACTER_WIZARD_SKIP_INITIAL_SNAPSHOT', {
        gameId: state.gameId,
        characterId: state.characterId,
        reason: 'NEW_CHARACTER_ROUTE',
      });
      return;
    }
    void refreshSnapshot({ syncWizardState: true });
  }, [isEditMode, routeError, routeReady, state.characterId, state.gameId, wizardMode]);

  useEffect(() => {
    return () => {
      if (commandStatusScrollTimeoutRef.current) {
        clearTimeout(commandStatusScrollTimeoutRef.current);
      }
    };
  }, []);

  const setStepPanelRef = useCallback(
    (index: number) => (element: HTMLElement | null) => {
      stepPanelRefs.current[index] = element;
    },
    []
  );

  const setActiveStepAndScroll = useCallback((nextStepIndex: number) => {
    setActiveStepIndex(nextStepIndex);
  }, []);

  useEffect(() => {
    const panel = stepPanelRefs.current[activeStepIndex];
    if (!panel) {
      return;
    }

    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    panel.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }, [activeStepIndex]);

  const view = useMemo(
    () =>
      createCharacterWizardViewModel({
        state,
        snapshot,
        isExecutingCommand,
        lastSavedFingerprint,
        wizardMode,
      }),
    [state, snapshot, isExecutingCommand, lastSavedFingerprint, wizardMode]
  );
  const pregamePlanning = usePregamePlanning(routeGameId, wizardMode === 'apply');

  const { saveStateByStep, shareState, saveStepProgress, executeFinalAction, shareDraftToChat, claimPartyRoleInChat, refreshSnapshot } = useCharacterWizardWorkflow({
    api,
    routePlayerId,
    wizardMode,
    state,
    snapshot,
    view,
    setState,
    setSnapshot,
    setLastSavedFingerprint,
    setStepError,
    submitEnvelopeAndAwait,
    revealCommandStatus: scheduleCommandStatusScroll,
    onPregamePlanningChanged: pregamePlanning.refresh,
  });

  const steps: StepperItem[] = [
    {
      id: 'step-race',
      title: stepTitles[0]!,
      panel: (
        <RaceStepPanel
          active={activeStepIndex === 0}
          isExecutingCommand={isExecutingCommand}
          state={state}
          view={view}
          onRaceChange={handleRaceChange}
          onRaisedByChange={handleRaisedByChange}
        />
      ),
      action: renderSaveButton('race', activeStepIndex === 0),
    },
    {
      id: 'step-dice',
      title: stepTitles[1]!,
      panel: (
        <DiceStepPanel
          active={activeStepIndex === 1}
          isExecutingCommand={isExecutingCommand}
          state={state}
          view={view}
          onSetSubAbility={(key, value) => setSubAbility(setState, key, value)}
          onRollSubAbilities={() => setState((prev) => ({ ...prev, subAbility: rollSubAbilitiesForRace(prev.race), purchases: [] }))}
        />
      ),
      action: renderSaveButton('dice', activeStepIndex === 1),
    },
    {
      id: 'step-background',
      title: stepTitles[2]!,
      isError: view.startingPreview.errors.length > 0,
      panel: (
        <BackgroundStepPanel
          active={activeStepIndex === 2}
          isExecutingCommand={isExecutingCommand}
          state={state}
          view={view}
          onUpdateState={setState}
          normalizePurchasesForBaseSkills={normalizePurchasesForBaseSkills}
        />
      ),
      action: renderSaveButton('background', activeStepIndex === 2),
    },
    {
      id: 'step-name',
      title: stepTitles[3]!,
      isError: state.name.trim() === '',
      panel: (
        <IdentityStepPanel
          active={activeStepIndex === 3}
          isExecutingCommand={isExecutingCommand}
          state={state}
          view={view}
          onUpdateState={setState}
        />
      ),
      action: renderSaveButton('identity', activeStepIndex === 3),
    },
    {
      id: 'step-exp',
      title: stepTitles[4]!,
      isError: view.purchasePreview.errors.length > 0,
      panel: (
        <ExpStepPanel
          active={activeStepIndex === 4}
          isExecutingCommand={isExecutingCommand}
          state={state}
          view={view}
          isSkillTargetAffordable={isSkillTargetAffordable}
          onUpdateSkillPurchase={updateSkillPurchase}
        />
      ),
      action: renderSaveButton('exp', activeStepIndex === 4),
    },
    {
      id: 'step-equipment',
      title: stepTitles[5]!,
      isError: view.equipmentPreview.errors.length > 0,
      panel: (
        <EquipmentStepPanel
          active={activeStepIndex === 5}
          isExecutingCommand={isExecutingCommand}
          state={state}
          view={view}
          onQuantityChange={setInventoryQuantity}
        />
      ),
      action: renderSaveButton('equipment', activeStepIndex === 5),
    },
    {
      id: 'step-submit',
      title: stepTitles[6]!,
      isError: !view.isDraftReadyForSubmit,
      panel: (
        <SubmitStepPanel
          active={activeStepIndex === 6}
          isExecutingCommand={isExecutingCommand}
          state={state}
          view={view}
          snapshot={snapshot}
          shareState={shareState}
          wizardMode={wizardMode}
          onUpdateState={setState}
          onExecuteFinalAction={() => void executeFinalAction()}
          onShareDraftToChat={() => void shareDraftToChat()}
        />
      ),
      action: renderSaveButton('submit', activeStepIndex === 6),
    },
  ];

  if (!routeReady) {
    return (
      <div className="l-page">
        <Panel title="Character Wizard" subtitle="Loading route context.">
          <div className="c-note c-note--info">
            <span className="t-small">Loading wizard...</span>
          </div>
        </Panel>
      </div>
    );
  }

  if (routeError) {
    return (
      <div className="l-page">
        <Panel title="Character Wizard" subtitle="Route validation failed.">
          <div className="c-note c-note--error">
            <span className="t-small">{routeError}</span>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="l-page">
      <Panel
        title={isEditMode ? 'Edit Character Draft' : wizardMode === 'library' ? 'Create Personal Character' : 'Character Wizard'}
        subtitle={
          isEditMode
            ? 'Edit an existing character draft. Each save and final action sends one command, then polls until terminal.'
            : wizardMode === 'library'
              ? 'Create a character in your saved character library. Saving and creating persist drafts owned by the signed-in player.'
              : 'Create a new character application for a public game. Each save and submit sends one command, then polls until terminal.'
        }
      >
        <div className="l-col">
          {wizardMode === 'apply' ? (
            <PregamePlanningContext
              planningState={pregamePlanning.state}
              disabled={isExecutingCommand || shareState === 'saving'}
              onClaimRole={claimPartyRoleInChat}
            />
          ) : null}

          <CharacterWizardAutofillControls
            isExecutingCommand={isExecutingCommand}
            savedCharacters={savedCharacters}
            selectedSavedCharacterId={selectedSavedCharacterId}
            currentCharacterId={state.characterId}
            onAutofillFixture={() => {
              logWebFlow('WEB_CHARACTER_WIZARD_AUTOFILL_APPLIED', {
                gameId: state.gameId,
                characterId: state.characterId,
                fixtureId: 'good.human_rune_master_sorcerer_starter',
              });
              applyFixtureAutofill(setState);
              setStepError(' ');
            }}
            onSelectSavedCharacter={(value) => {
              if (!value) {
                return;
              }
              const selected = savedCharacters.find((item) => item.characterId === value);
              if (!selected) {
                return;
              }
              setSelectedSavedCharacterId(value);
              const hydrated = hydrateWizardStateFromCharacter(selected, state);
              setState({
                ...hydrated,
                gameId: state.gameId,
                characterId: state.characterId,
              });
              setStepError(' ');
            }}
          />

          <div className="c-note c-note--error">
            <span className="t-small">{stepError}</span>
          </div>

          <div className="l-split">
            <div className="l-col l-grow">
              <Stepper
                steps={steps}
                activeStepIndex={activeStepIndex}
                onStepChange={setActiveStepAndScroll}
                getPanelRef={setStepPanelRef}
              />
              <div className="l-sticky-bottom l-row">
                <button
                  className={`c-btn ${activeStepIndex === 0 || isExecutingCommand ? 'is-disabled' : ''}`.trim()}
                  type="button"
                  disabled={activeStepIndex === 0 || isExecutingCommand}
                  onClick={() => setActiveStepAndScroll(Math.max(0, activeStepIndex - 1))}
                >
                  Previous
                </button>
                <button
                  className={`c-btn ${activeStepIndex === steps.length - 1 || isExecutingCommand ? 'is-disabled' : ''}`.trim()}
                  type="button"
                  disabled={activeStepIndex === steps.length - 1 || isExecutingCommand}
                  onClick={() => setActiveStepAndScroll(Math.min(steps.length - 1, activeStepIndex + 1))}
                >
                  Next
                </button>
              </div>
            </div>

            <div className="l-col l-grow">
              <div ref={commandStatusRef}>
                <Panel title="Command Status" subtitle="Fixed region for no-jump UX.">
                  <CommandStatusPanel status={commandStatus} />
                </Panel>
              </div>

              <Panel
                title="Current Character Snapshot"
                subtitle={
                  wizardMode === 'library'
                    ? 'Read-only snapshot from GET /players/{playerId}/characters/{characterId}'
                    : 'Read-only snapshot from GET /games/{gameId}/characters/{characterId}'
                }
              >
                <SnapshotView snapshot={snapshot} />
              </Panel>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );

  function handleRaceChange(nextRace: Race) {
    setState((prev) => ({
      ...prev,
      race: nextRace,
      raisedBy: nextRace === 'HALF_ELF' ? prev.raisedBy : 'HUMANS',
      subAbility: rollSubAbilitiesForRace(nextRace),
      craftsmanSkill: nextRace === 'DWARF' ? prev.craftsmanSkill : '',
      merchantScholarChoice: '',
      generalSkillName: '',
      purchases: [],
      equipment: { weaponQuantities: {}, armorQuantities: {}, shieldQuantities: {}, gearQuantities: {} },
    }));
  }

  function handleRaisedByChange(nextRaisedBy: HalfElfRaisedBy) {
    setState((prev) => ({
      ...prev,
      raisedBy: nextRaisedBy,
      merchantScholarChoice: '',
      generalSkillName: '',
      purchases: [],
      equipment: { weaponQuantities: {}, armorQuantities: {}, shieldQuantities: {}, gearQuantities: {} },
    }));
  }

  function updateSkillPurchase(skill: string, targetLevel: number, baseLevel: number) {
    setState((prev) => ({
      ...prev,
      purchases:
        targetLevel === baseLevel
          ? prev.purchases.filter((entry) => entry.skill !== skill)
          : [...prev.purchases.filter((entry) => entry.skill !== skill), { skill, targetLevel }].sort((left, right) =>
              left.skill.localeCompare(right.skill)
            ),
    }));
  }

  function setInventoryQuantity(category: InventoryCategory, itemId: string, quantity: number) {
    setState((prev) => {
      const key = getInventoryQuantitiesKey(category);
      const nextQuantities = { ...prev.equipment[key] };
      if (quantity <= 0) {
        delete nextQuantities[itemId];
      } else {
        nextQuantities[itemId] = quantity;
      }
      return {
        ...prev,
        equipment: {
          ...prev.equipment,
          [key]: nextQuantities,
        },
      };
    });
  }

  function isSkillTargetAffordable(skill: string, targetLevel: number, baseLevel: number): boolean {
    if (targetLevel <= baseLevel) {
      return true;
    }
    if (!view.startingPreview.state) {
      return false;
    }

    const candidatePurchases =
      targetLevel === baseLevel
        ? state.purchases.filter((entry) => entry.skill !== skill)
        : [...state.purchases.filter((entry) => entry.skill !== skill), { skill, targetLevel }];
    const candidatePreview = computeSkillPurchasePreview(view.startingPreview.state, candidatePurchases);
    return !candidatePreview.errors.includes('not enough starting EXP');
  }

  function renderSaveButton(stepKey: WizardStepKey, enabled: boolean) {
    const buttonState = saveStateByStep[stepKey];
    const isSaving = buttonState === 'saving';
    const isSaved = buttonState === 'saved';
    const canSave = enabled && !isExecutingCommand && view.canEditDraft;

    return (
      <button
        className={`c-btn ${canSave ? '' : 'is-disabled'} ${isSaving ? 'is-loading' : ''}`.trim()}
        type="button"
        disabled={!canSave}
        onClick={() => void saveStepProgress(stepKey)}
      >
        {isSaving ? (
          <>
            <span className="c-btn__spinner" aria-hidden="true" />
            <span>Saving...</span>
          </>
        ) : isSaved ? (
          '✓ Saved'
        ) : (
          'Save'
        )}
      </button>
    );
  }

  function scrollCommandStatusIntoView() {
    const region = commandStatusRef.current;
    if (!region) {
      return;
    }

    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    region.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  function scheduleCommandStatusScroll() {
    if (commandStatusScrollTimeoutRef.current) {
      clearTimeout(commandStatusScrollTimeoutRef.current);
      commandStatusScrollTimeoutRef.current = null;
    }

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          scrollCommandStatusIntoView();
        });
      });
    } else {
      scrollCommandStatusIntoView();
    }

    commandStatusScrollTimeoutRef.current = setTimeout(() => {
      scrollCommandStatusIntoView();
      commandStatusScrollTimeoutRef.current = null;
    }, 180);
  }

}

function PregamePlanningContext(props: {
  planningState: ReturnType<typeof usePregamePlanning>['state'];
  disabled: boolean;
  onClaimRole: (role: PregameRole) => Promise<void>;
}) {
  if (props.planningState.status === 'disabled') {
    return null;
  }

  if (props.planningState.status === 'loading') {
    return (
      <div className="c-note c-note--info">
        <span className="t-small">Loading pregame planning context...</span>
      </div>
    );
  }

  if (props.planningState.status === 'error') {
    return (
      <div className="c-note c-note--error">
        <span className="t-small">{props.planningState.message}</span>
      </div>
    );
  }

  const planning = props.planningState.planning;
  const openRoles = planning.partyNeeds.filter((need) => need.isOpen);

  return (
    <div className="c-note c-note--info">
      <div className="t-small">
        {planning.activePrompt
          ? `${planning.activePrompt.senderDisplayName}: ${planning.activePrompt.prompt}`
          : 'No GM planning prompt is active yet.'}
      </div>
      <div className="t-small">
        {openRoles.length > 0
          ? `Open roles: ${openRoles.map((need) => need.label).join(', ')}`
          : 'All tracked party roles currently have at least one claim.'}
      </div>
      <div className="l-row">
        {PREGAME_ROLE_ORDER.map((role) => {
          const need = planning.partyNeeds.find((entry) => entry.role === role) ?? null;
          const disabled = props.disabled || !planning.viewer.isMember;

          return (
            <button
              key={role}
              className={`c-btn ${disabled ? 'is-disabled' : ''}`.trim()}
              type="button"
              disabled={disabled}
              onClick={() => void props.onClaimRole(role)}
              title={
                !planning.viewer.isMember
                  ? 'Join the game before posting structured planning updates.'
                  : undefined
              }
            >
              {need?.isOpen ? `Claim ${PREGAME_ROLE_LABELS[role]}` : `Reinforce ${PREGAME_ROLE_LABELS[role]}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function setSubAbility(
  setState: Dispatch<SetStateAction<WizardState>>,
  key: SubAbilityKey,
  value: number
): void {
  setState((prev) => ({
    ...prev,
    subAbility: {
      ...prev.subAbility,
      [key]: clamp(value, 1, 20),
    },
    purchases: [],
  }));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getInventoryQuantitiesKey(category: InventoryCategory): InventoryQuantitiesKey {
  if (category === 'weapon') {
    return 'weaponQuantities';
  }
  if (category === 'armor') {
    return 'armorQuantities';
  }
  if (category === 'shield') {
    return 'shieldQuantities';
  }
  return 'gearQuantities';
}
