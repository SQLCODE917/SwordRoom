import { type Dispatch, type ReactNode, type SetStateAction, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toPlayerCharacterLibraryGameId } from '@starter/shared/contracts/db';
import { createApiClient } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { CommandStatusPanel } from '../components/CommandStatusPanel';
import { Panel } from '../components/Panel';
import { Stepper, type StepperItem } from '../components/Stepper';
import {
  HALF_ELF_RAISED_BY,
  RACES,
  backgroundsByRoll,
  computeAbilityBonus,
  computeDerivedAbilities,
  resolveBackgroundEligibility,
  rollSubAbilitiesForRace,
  subAbilityRollFormulasByRace,
  type HalfElfRaisedBy,
  type Race,
  type SubAbilityKey,
} from '../data/characterCreationReference';
import {
  backgroundOptions,
  computeEquipmentPreview,
  computeSkillPurchasePreview,
  computeStartingPackagePreview,
  describeSkillLevelCosts,
  getEquipmentOptionsForStrength,
  roll2dTotal,
  skillOptions,
} from '../data/characterCreationPurchasing';
import {
  buildInitialState,
  CharacterSnapshot,
  createCharacterId,
  FieldOption,
  goodHumanRuneMasterAutofill,
  hydrateWizardStateFromCharacter,
  InventoryCategory,
  InventoryQuantitiesKey,
  normalizePurchasesForBaseSkills,
  readCharacterIdentityName,
  toInventoryQuantitiesFromIds,
  useCharacterWizardRouteContext,
  useCharacterWizardWorkflow,
  WizardMode,
  WizardState,
  WizardStepKey,
  createCharacterWizardViewModel,
} from '../features/character-wizard';
import { useCommandWorkflow } from '../hooks/useCommandStatus';
import { logWebFlow } from '../logging/flowLog';

const stepTitles = ['Race', 'Dice A-H', 'Background rolls', 'Name/identity', 'EXP spend', 'Equipment cart', 'Submit'];

const rollOptions: FieldOption[] = Array.from({ length: 11 }, (_, index) => {
  const total = index + 2;
  return { value: String(total), label: String(total) };
});

const raceOptions: FieldOption[] = RACES.map((race) => ({ value: race, label: race }));
const raisedByOptions: FieldOption[] = HALF_ELF_RAISED_BY.map((value) => ({ value, label: value }));
const merchantScholarOptions: FieldOption[] = [
  { value: '', label: 'Choose one' },
  { value: 'MERCHANT', label: 'Merchant 3' },
  { value: 'SAGE', label: 'Sage 1' },
];

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

  const { saveStateByStep, saveStepProgress, executeFinalAction, refreshSnapshot } = useCharacterWizardWorkflow({
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
  });

  const steps: StepperItem[] = [
    {
      id: 'step-race',
      title: stepTitles[0]!,
      panel: (
        <WizardStep title="1) Race" enabled={activeStepIndex === 0}>
          <FieldSelect
            label="Race"
            value={state.race}
            options={raceOptions}
            onChange={(value) => handleRaceChange(value as Race)}
            disabled={isExecutingCommand}
          />
          <FieldSelect
            label="Raised by"
            value={state.raisedBy}
            options={raisedByOptions}
            onChange={(value) => handleRaisedByChange(value as HalfElfRaisedBy)}
            disabled={state.race !== 'HALF_ELF' || isExecutingCommand}
            hint="Only used when race is HALF_ELF."
          />
          <InfoList
            lines={[
              `Background table path: ${view.backgroundEligible ? 'Table 1-5' : 'Race table 1-6'}`,
              `Current derived STR / MP preview: ${view.derived.STR} / ${view.derived.MP}`,
            ]}
          />
        </WizardStep>
      ),
      action: renderSaveButton('race', activeStepIndex === 0),
    },
    {
      id: 'step-dice',
      title: stepTitles[1]!,
      panel: (
        <WizardStep title="2) Dice A-H" enabled={activeStepIndex === 1}>
          <div className="l-split">
            <fieldset className="l-col l-grow" disabled={isExecutingCommand}>
              <div className="l-split">
                <div className="l-col l-grow">
                  <FieldNumber
                    label={`A (${subAbilityRollFormulasByRace[state.race].A})`}
                    value={state.subAbility.A}
                    min={1}
                    onChange={(value) => setSubAbility(setState, 'A', value)}
                  />
                  <FieldNumber
                    label={`B (${subAbilityRollFormulasByRace[state.race].B})`}
                    value={state.subAbility.B}
                    min={1}
                    onChange={(value) => setSubAbility(setState, 'B', value)}
                  />
                  <FieldNumber
                    label={`C (${subAbilityRollFormulasByRace[state.race].C})`}
                    value={state.subAbility.C}
                    min={1}
                    onChange={(value) => setSubAbility(setState, 'C', value)}
                  />
                  <FieldNumber
                    label={`D (${subAbilityRollFormulasByRace[state.race].D})`}
                    value={state.subAbility.D}
                    min={1}
                    onChange={(value) => setSubAbility(setState, 'D', value)}
                  />
                </div>
                <div className="l-col l-grow">
                  <FieldNumber
                    label={`E (${subAbilityRollFormulasByRace[state.race].E})`}
                    value={state.subAbility.E}
                    min={1}
                    onChange={(value) => setSubAbility(setState, 'E', value)}
                  />
                  <FieldNumber
                    label={`F (${subAbilityRollFormulasByRace[state.race].F})`}
                    value={state.subAbility.F}
                    min={1}
                    onChange={(value) => setSubAbility(setState, 'F', value)}
                  />
                  <FieldNumber
                    label={`G (${subAbilityRollFormulasByRace[state.race].G})`}
                    value={state.subAbility.G}
                    min={1}
                    onChange={(value) => setSubAbility(setState, 'G', value)}
                  />
                  <FieldNumber
                    label={`H (${subAbilityRollFormulasByRace[state.race].H})`}
                    value={state.subAbility.H}
                    min={1}
                    onChange={(value) => setSubAbility(setState, 'H', value)}
                  />
                </div>
              </div>
              <button
                className={`c-btn ${isExecutingCommand ? 'is-disabled' : ''}`.trim()}
                type="button"
                disabled={isExecutingCommand}
                onClick={() => setState((prev) => ({ ...prev, subAbility: rollSubAbilitiesForRace(prev.race), purchases: [] }))}
              >
                Roll A-H
              </button>
            </fieldset>
            <div className="l-col l-grow">
              <div className="l-split">
                <StatBox label="DEX" value={view.derived.DEX} bonus={computeAbilityBonus(view.derived.DEX)} tone="dex" />
                <StatBox label="AGI" value={view.derived.AGI} bonus={computeAbilityBonus(view.derived.AGI)} tone="agi" />
                <StatBox label="INT" value={view.derived.INT} bonus={computeAbilityBonus(view.derived.INT)} tone="int" />
              </div>
              <div className="l-split">
                <StatBox label="STR" value={view.derived.STR} bonus={computeAbilityBonus(view.derived.STR)} tone="str" />
                <StatBox label="LF" value={view.derived.LF} bonus={computeAbilityBonus(view.derived.LF)} tone="lf" />
                <StatBox label="MP" value={view.derived.MP} bonus={computeAbilityBonus(view.derived.MP)} tone="mp" />
              </div>
            </div>
          </div>
        </WizardStep>
      ),
      action: renderSaveButton('dice', activeStepIndex === 1),
    },
    {
      id: 'step-background',
      title: stepTitles[2]!,
      isError: view.startingPreview.errors.length > 0,
      panel: (
        <WizardStep title="3) Background rolls" enabled={activeStepIndex === 2}>
          <fieldset className="l-col" disabled={isExecutingCommand}>
            {view.backgroundEligible ? (
              <>
                <FieldSelect
                  label="Background result"
                  value={String(state.backgroundRoll2dTotal)}
                  options={backgroundOptions.map((option) => ({
                    value: String(option.roll),
                    label: `${option.roll} - ${option.label}`,
                  }))}
                  onChange={(value) => setState((prev) => ({ ...prev, backgroundRoll2dTotal: Number(value), purchases: [] }))}
                />
                <button
                  className={`c-btn ${isExecutingCommand ? 'is-disabled' : ''}`.trim()}
                  type="button"
                  disabled={isExecutingCommand}
                  onClick={() => setState((prev) => ({ ...prev, backgroundRoll2dTotal: roll2dTotal(), purchases: [] }))}
                >
                  Roll Background 2D
                </button>
                {state.backgroundRoll2dTotal === 8 ? (
                  <FieldSelect
                    label="Merchant / Scholar choice"
                    value={state.merchantScholarChoice}
                    options={merchantScholarOptions}
                    onChange={(value) =>
                      setState((prev) => ({
                        ...prev,
                        merchantScholarChoice: value as WizardState['merchantScholarChoice'],
                        purchases: normalizePurchasesForBaseSkills(prev.purchases, view.startingPreview.startingSkills),
                      }))
                    }
                    hint="Merchant 3 or Sage 1 must be selected for background roll 8."
                  />
                ) : null}
                {state.backgroundRoll2dTotal === 7 ? (
                  <FieldText
                    label="GM-approved general skill"
                    value={state.generalSkillName}
                    onChange={(value) => setState((prev) => ({ ...prev, generalSkillName: value }))}
                    hint="Required for Ordinary Citizen."
                  />
                ) : null}
              </>
            ) : null}
            {view.isDwarfPath ? (
              <FieldText
                label="Craftsman skill"
                value={state.craftsmanSkill}
                onChange={(value) => setState((prev) => ({ ...prev, craftsmanSkill: value }))}
                hint="Dwarves start with one level 5 craftsman skill."
              />
            ) : null}
            <FieldSelect
              label="Starting money roll"
              value={String(state.moneyRoll2dTotal)}
              options={rollOptions}
              onChange={(value) => setState((prev) => ({ ...prev, moneyRoll2dTotal: Number(value) }))}
              hint="Manual select or roll 2D."
            />
            <button
              className={`c-btn ${isExecutingCommand ? 'is-disabled' : ''}`.trim()}
              type="button"
              disabled={isExecutingCommand}
              onClick={() => setState((prev) => ({ ...prev, moneyRoll2dTotal: roll2dTotal() }))}
            >
              Roll Money 2D
            </button>
          </fieldset>
          <InfoList
            lines={[
              view.backgroundEligible ? view.backgroundLabel : 'Background table not applicable for this race path.',
              `Starting skills: ${formatSkillList(view.startingPreview.startingSkills)}`,
              `Starting EXP / remaining EXP: ${view.startingPreview.expTotal} / ${view.purchasePreview.expUnspent}`,
              `Starting money / remaining money: ${view.startingPreview.moneyGamels} / ${view.equipmentPreview.moneyRemaining}`,
            ]}
          />
          <ErrorList errors={view.startingPreview.errors} />
        </WizardStep>
      ),
      action: renderSaveButton('background', activeStepIndex === 2),
    },
    {
      id: 'step-name',
      title: stepTitles[3]!,
      isError: state.name.trim() === '',
      panel: (
        <WizardStep title="4) Name/identity" enabled={activeStepIndex === 3}>
          <fieldset className="l-col" disabled={isExecutingCommand}>
            <FieldText
              label="Name"
              value={state.name}
              onChange={(value) => setState((prev) => ({ ...prev, name: value }))}
              errorText={view.nameError}
              isError={state.name.trim() === ''}
            />
            <div className="l-split">
              <FieldText
                label="Gender"
                value={state.gender}
                onChange={(value) => setState((prev) => ({ ...prev, gender: value }))}
              />
              <FieldText label="Age" value={state.age} onChange={(value) => setState((prev) => ({ ...prev, age: value }))} />
            </div>
          </fieldset>
        </WizardStep>
      ),
      action: renderSaveButton('identity', activeStepIndex === 3),
    },
    {
      id: 'step-exp',
      title: stepTitles[4]!,
      isError: view.purchasePreview.errors.length > 0,
      panel: (
        <WizardStep title="5) EXP spend" enabled={activeStepIndex === 4}>
          <fieldset className="l-col" disabled={isExecutingCommand}>
            {skillOptions.map((option) => {
              const baseLevel = findSkillLevel(view.startingPreview.startingSkills, option.skill);
              const currentTarget = findPurchaseTargetLevel(state.purchases, option.skill) ?? baseLevel;
              const levels = Array.from({ length: option.maxLevel + 1 }, (_, index) => index);
              const levelCosts = describeSkillLevelCosts(view.startingPreview.state, option.skill, option.maxLevel);
              const costSchedule = formatSkillCostSchedule(levelCosts);

              return (
                <FieldSelect
                  key={option.skill}
                  label={option.label}
                  value={String(currentTarget)}
                  options={levels.map((level) => ({
                    value: String(level),
                    label: formatSkillTargetOptionLabel({
                      level,
                      baseLevel,
                      costExp: levelCosts.find((entry) => entry.level === level)?.costExp ?? null,
                      note: levelCosts.find((entry) => entry.level === level)?.note,
                    }),
                    disabled: level !== baseLevel && !isSkillTargetAffordable(option.skill, level, baseLevel),
                  }))}
                  onChange={(value) => updateSkillPurchase(option.skill, Number(value), baseLevel)}
                  hint={`Base ${baseLevel}. Costs: ${costSchedule}. Final skills: ${formatSkillList(view.purchasePreview.skills)}`}
                />
              );
            })}
          </fieldset>
          <InfoList
            lines={[
              `Starting skills: ${formatSkillList(view.startingPreview.startingSkills)}`,
              `Current adventurer skills: ${formatSkillList(view.purchasePreview.skills)}`,
              `EXP remaining: ${view.purchasePreview.expUnspent}`,
            ]}
          />
          <ErrorList errors={view.purchasePreview.errors} />
        </WizardStep>
      ),
      action: renderSaveButton('exp', activeStepIndex === 4),
    },
    {
      id: 'step-equipment',
      title: stepTitles[5]!,
      isError: view.equipmentPreview.errors.length > 0,
      panel: (
        <WizardStep title="6) Equipment cart" enabled={activeStepIndex === 5}>
          <fieldset className="l-col" disabled={isExecutingCommand}>
            {renderInventorySections({
              category: 'weapon',
              title: 'Weapons',
              options: view.equipmentOptions,
              quantities: state.equipment.weaponQuantities,
              availableMoney: view.availableMoney,
              selection: state.equipment,
              onQuantityChange: setInventoryQuantity,
            })}
            {renderInventorySections({
              category: 'armor',
              title: 'Armor',
              options: view.equipmentOptions,
              quantities: state.equipment.armorQuantities,
              availableMoney: view.availableMoney,
              selection: state.equipment,
              onQuantityChange: setInventoryQuantity,
            })}
            {renderInventorySections({
              category: 'shield',
              title: 'Shields',
              options: view.equipmentOptions,
              quantities: state.equipment.shieldQuantities,
              availableMoney: view.availableMoney,
              selection: state.equipment,
              onQuantityChange: setInventoryQuantity,
            })}
            {renderInventorySections({
              category: 'gear',
              title: 'Other Equipment',
              options: view.equipmentOptions,
              quantities: state.equipment.gearQuantities,
              availableMoney: view.availableMoney,
              selection: state.equipment,
              onQuantityChange: setInventoryQuantity,
            })}
          </fieldset>
          <InfoList
            lines={[
              `Cart: ${formatCartSummary(view.equipmentCart)}`,
              `Total cost: ${view.equipmentPreview.totalCost} G`,
              `Money remaining: ${view.equipmentPreview.moneyRemaining} G`,
            ]}
          />
          <ErrorList errors={view.equipmentPreview.errors} />
        </WizardStep>
      ),
      action: renderSaveButton('equipment', activeStepIndex === 5),
    },
    {
      id: 'step-submit',
      title: stepTitles[6]!,
      isError: !view.isDraftReadyForSubmit,
      panel: (
        <WizardStep title={wizardMode === 'library' ? '7) Create Character' : '7) Submit'} enabled={activeStepIndex === 6}>
          <fieldset className="l-col" disabled={isExecutingCommand}>
            <FieldText
              label="Note to GM"
              value={state.submitNoteToGm}
              onChange={(value) => setState((prev) => ({ ...prev, submitNoteToGm: value }))}
              hint={
                wizardMode === 'library'
                  ? 'Create saves the current draft to your character library.'
                  : 'Submit saves the current draft first if needed, then submits the saved revision.'
              }
            />
            <button
              className={`c-btn ${view.canExecuteFinalAction ? '' : 'is-disabled'}`.trim()}
              type="button"
              disabled={!view.canExecuteFinalAction}
              onClick={() => void executeFinalAction()}
            >
              {view.finalActionLabel}
            </button>
            <InfoList
              lines={[
                wizardMode === 'library'
                  ? view.isDirty || !snapshot || snapshot.version === null
                    ? 'Create will save the current draft to your saved characters.'
                    : 'Create updates the current saved character draft.'
                  : snapshot?.status === 'PENDING'
                    ? 'This character is already pending GM review.'
                    : view.isDirty || !snapshot || snapshot.version === null
                      ? 'Submit will save the current draft first, then send it for review.'
                      : 'Submit uses the current saved draft revision.',
                `Ready to ${wizardMode === 'library' ? 'create' : 'submit'}: ${view.isDraftReadyForSubmit ? 'yes' : 'no'}`,
              ]}
            />
            <ErrorList errors={state.name.trim() === '' ? ['Name is required.'] : view.previewErrors} />
          </fieldset>
        </WizardStep>
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
          <div className="c-note c-note--info">
            <span className="t-small">Autofill uses fixture good.human_rune_master_sorcerer_starter.</span>
          </div>
          <button
            className={`c-btn ${isExecutingCommand ? 'is-disabled' : ''}`.trim()}
            type="button"
            disabled={isExecutingCommand}
            onClick={() => {
              logWebFlow('WEB_CHARACTER_WIZARD_AUTOFILL_APPLIED', {
                gameId: state.gameId,
                characterId: state.characterId,
                fixtureId: 'good.human_rune_master_sorcerer_starter',
              });
              setState((prev) => ({
                ...prev,
                race: goodHumanRuneMasterAutofill.race,
                raisedBy: goodHumanRuneMasterAutofill.raisedBy,
                subAbility: { ...goodHumanRuneMasterAutofill.subAbility },
                backgroundRoll2dTotal: goodHumanRuneMasterAutofill.backgroundRoll2dTotal,
                moneyRoll2dTotal: goodHumanRuneMasterAutofill.startingMoneyRoll2dTotal,
                craftsmanSkill: '',
                merchantScholarChoice: '',
                generalSkillName: '',
                name: goodHumanRuneMasterAutofill.identity.name,
                age: goodHumanRuneMasterAutofill.identity.age,
                gender: goodHumanRuneMasterAutofill.identity.gender,
                purchases: goodHumanRuneMasterAutofill.purchases,
                equipment: {
                  weaponQuantities: toInventoryQuantitiesFromIds(goodHumanRuneMasterAutofill.cart.weapons),
                  armorQuantities: toInventoryQuantitiesFromIds(goodHumanRuneMasterAutofill.cart.armor),
                  shieldQuantities: toInventoryQuantitiesFromIds(goodHumanRuneMasterAutofill.cart.shields),
                  gearQuantities: toInventoryQuantitiesFromIds(goodHumanRuneMasterAutofill.cart.gear),
                },
                submitNoteToGm: goodHumanRuneMasterAutofill.submitNoteToGm,
              }));
              setStepError(' ');
            }}
          >
            Autofill from fixture
          </button>
          <FieldSelect
            label="Autofill from saved character"
            value={selectedSavedCharacterId}
            options={[
              { value: '', label: savedCharacters.length > 0 ? 'Choose a saved character' : 'No saved characters available' },
              ...savedCharacters
                .filter((item) => item.characterId !== state.characterId)
                .map((item) => ({
                  value: item.characterId,
                  label: `${readCharacterIdentityName(item) || item.characterId} (${item.status})`,
                })),
            ]}
            onChange={(value) => {
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
            disabled={isExecutingCommand || savedCharacters.length === 0}
            hint="Copies the selected saved character into the current wizard without changing this draft's owner or target."
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

function SnapshotView({ snapshot }: { snapshot: CharacterSnapshot | null }) {
  if (!snapshot) {
    return (
      <div className="c-note c-note--info">
        <span className="t-small">No character snapshot found yet.</span>
      </div>
    );
  }

  return (
    <div className="l-col">
      <div className="c-note c-note--ok">
        <span className="t-small">status: {snapshot.status}</span>
      </div>
      <div className="c-note c-note--info">
        <span className="t-small">abilities: {snapshot.ability ? JSON.stringify(snapshot.ability) : 'not set'}</span>
      </div>
      <div className="c-note c-note--info">
        <span className="t-small">
          skills: {snapshot.skills.length > 0 ? snapshot.skills.map((s) => `${s.skill}:${s.level}`).join(', ') : 'none'}
        </span>
      </div>
    </div>
  );
}

function WizardStep({
  title,
  enabled,
  children,
}: {
  title: string;
  enabled: boolean;
  children: ReactNode;
}) {
  return (
    <div className="l-col">
      <h3 className="c-stepper__title t-h3">{title}</h3>
      <div className={enabled ? 'is-active' : ''}>{children}</div>
    </div>
  );
}

function StatBox(props: { label: string; value: number; bonus: number; tone: 'dex' | 'agi' | 'int' | 'str' | 'lf' | 'mp' }) {
  return (
    <div className={`c-stat c-stat--${props.tone}`}>
      <div className="c-stat__label t-small">{props.label}</div>
      <div className="c-stat__value t-h3">{props.value}</div>
      <div className="c-stat__sub t-small">bonus {props.bonus >= 0 ? `+${props.bonus}` : props.bonus}</div>
    </div>
  );
}

function FieldText(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
  errorText?: string;
  isError?: boolean;
}) {
  const fieldId = useId();

  return (
    <div className={`c-field ${props.disabled ? 'is-disabled' : ''} ${props.isError ? 'is-error' : ''}`.trim()}>
      <label className="c-field__label" htmlFor={fieldId}>
        {props.label}
      </label>
      <input
        id={fieldId}
        className="c-field__control"
        value={props.value}
        disabled={props.disabled}
        aria-invalid={props.isError || undefined}
        onChange={(event) => props.onChange(event.target.value)}
      />
      <div className="c-field__hint">{props.hint ?? ' '}</div>
      <div className="c-field__err">{props.errorText ?? ' '}</div>
    </div>
  );
}

function FieldSelect(props: {
  label: string;
  value: string;
  options: readonly FieldOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const fieldId = useId();

  return (
    <div className={`c-field ${props.disabled ? 'is-disabled' : ''}`.trim()}>
      <label className="c-field__label" htmlFor={fieldId}>
        {props.label}
      </label>
      <select
        id={fieldId}
        className="c-field__control"
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.options.map((option) => (
          <option key={`${props.label}-${option.value}-${option.label}`} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <div className="c-field__hint">{props.hint ?? ' '}</div>
      <div className="c-field__err"> </div>
    </div>
  );
}

function FieldNumber(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  hint?: string;
  disabled?: boolean;
}) {
  const fieldId = useId();

  return (
    <div className={`c-field ${props.disabled ? 'is-disabled' : ''}`.trim()}>
      <label className="c-field__label" htmlFor={fieldId}>
        {props.label}
      </label>
      <input
        id={fieldId}
        className="c-field__control"
        type="number"
        value={props.value}
        min={props.min}
        max={props.max}
        disabled={props.disabled}
        onChange={(event) => props.onChange(Number(event.target.value || 0))}
      />
      <div className="c-field__hint">{props.hint ?? ' '}</div>
      <div className="c-field__err"> </div>
    </div>
  );
}

function InfoList({ lines }: { lines: string[] }) {
  return (
    <div className="c-note c-note--info">
      <div className="l-col">
        {lines.map((line) => (
          <span key={line} className="t-small">
            {line}
          </span>
        ))}
      </div>
    </div>
  );
}

function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="c-note c-note--error">
      <div className="l-col">
        {errors.map((error) => (
          <span key={error} className="t-small">
            {error}
          </span>
        ))}
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

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function findSkillLevel(skills: Array<{ skill: string; level: number }>, skillName: string): number {
  return (
    skills.find((skill) => skill.skill.trim().toLowerCase() === skillName.trim().toLowerCase())?.level ?? 0
  );
}

function findPurchaseTargetLevel(
  purchases: Array<{ skill: string; targetLevel: number }>,
  skillName: string
): number | null {
  return purchases.find((purchase) => purchase.skill.trim().toLowerCase() === skillName.trim().toLowerCase())?.targetLevel ?? null;
}

function formatSkillList(skills: Array<{ skill: string; level: number }>): string {
  return skills.length > 0 ? skills.map((skill) => `${skill.skill}:${skill.level}`).join(', ') : 'none';
}

function formatCartSummary(cart: { weapons: string[]; armor: string[]; shields: string[]; gear: string[] }): string {
  const counts = new Map<string, number>();
  for (const itemId of [...cart.weapons, ...cart.armor, ...cart.shields, ...cart.gear]) {
    counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
  }
  if (counts.size === 0) {
    return 'empty';
  }
  return [...counts.entries()].map(([itemId, qty]) => (qty > 1 ? `${itemId} x${qty}` : itemId)).join(', ');
}

function formatSkillCostSchedule(
  costs: Array<{ level: number; costExp: number | null; note?: string }>
): string {
  if (costs.length === 0) {
    return 'no additional levels available';
  }

  return costs
    .map((cost) => {
      if (cost.costExp === null) {
        return `Lv${cost.level} n/a`;
      }
      return cost.note ? `Lv${cost.level} ${cost.costExp} EXP (${cost.note})` : `Lv${cost.level} ${cost.costExp} EXP`;
    })
    .join(', ');
}

function formatSkillLevelOptionLabel(level: number, costExp: number | null, note?: string): string {
  if (costExp === null) {
    return `Level ${level} (n/a)`;
  }
  return note ? `Level ${level} (${costExp} EXP, ${note})` : `Level ${level} (${costExp} EXP)`;
}

function formatSkillTargetOptionLabel(input: {
  level: number;
  baseLevel: number;
  costExp: number | null;
  note?: string;
}): string {
  if (input.level === 0) {
    return input.baseLevel > 0 ? 'Level 0 (deselect)' : 'Level 0';
  }

  if (input.level === input.baseLevel && input.baseLevel > 0) {
    return `Level ${input.level} (starting)`;
  }

  return formatSkillLevelOptionLabel(input.level, input.costExp, input.note);
}

function formatStrengthRequirement(
  option: { reqStr: number; reqStrMin?: number; reqStrMax?: number }
): string {
  if (option.reqStrMin === undefined) {
    return String(option.reqStr);
  }

  return formatStrengthRange(option.reqStrMin, option.reqStrMax, option.reqStr);
}

function formatStrengthRange(min: number, max: number | undefined, characterStrength: number): string {
  if (characterStrength < min) {
    return max === undefined ? `${min}~` : `${min}~${max}`;
  }

  const effectiveStrength = max === undefined ? characterStrength : Math.min(characterStrength, max);

  if (max === undefined) {
    return effectiveStrength === min ? `(${min})~` : `${min}~(${effectiveStrength})`;
  }

  if (effectiveStrength <= min) {
    return `(${min})~${max}`;
  }

  if (effectiveStrength >= max) {
    return `${min}~(${max})`;
  }

  return `${min}~(${effectiveStrength})~${max}`;
}

function isWeaponStrengthAllowed(
  option: { category: string; canMeetRequiredStrength?: boolean; reqStr: number; reqStrMin?: number }
): boolean {
  if (option.category === 'gear') {
    return true;
  }
  return option.canMeetRequiredStrength ?? true;
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

function getEquipmentQuantities(
  selection: WizardState['equipment'],
  category: InventoryCategory
): Record<string, number> {
  return selection[getInventoryQuantitiesKey(category)];
}

function isEquipmentQuantityAffordable(
  category: InventoryCategory,
  itemId: string,
  quantity: number,
  availableMoney: number,
  selection: WizardState['equipment'],
  options: ReturnType<typeof getEquipmentOptionsForStrength>
): boolean {
  const nextSelection: WizardState['equipment'] = {
    ...selection,
    [getInventoryQuantitiesKey(category)]: {
      ...getEquipmentQuantities(selection, category),
      [itemId]: quantity,
    },
  };
  return calculateEquipmentTotalCost(nextSelection, options) <= availableMoney;
}

function getEquipmentCost(itemId: string, options: ReturnType<typeof getEquipmentOptionsForStrength>): number {
  return options.find((option) => option.itemId === itemId)?.costGamels ?? 0;
}

function calculateEquipmentTotalCost(
  selection: WizardState['equipment'],
  options: ReturnType<typeof getEquipmentOptionsForStrength>
): number {
  return (['weapon', 'armor', 'shield', 'gear'] as InventoryCategory[]).reduce((sum, category) => {
    const quantities = getEquipmentQuantities(selection, category);
    return (
      sum +
      Object.entries(quantities).reduce(
        (categorySum, [itemId, qty]) => categorySum + getEquipmentCost(itemId, options) * qty,
        0
      )
    );
  }, 0);
}

function renderInventorySections(input: {
  category: InventoryCategory;
  title: string;
  options: ReturnType<typeof getEquipmentOptionsForStrength>;
  quantities: Record<string, number>;
  availableMoney: number;
  selection: WizardState['equipment'];
  onQuantityChange: (category: InventoryCategory, itemId: string, quantity: number) => void;
}): ReactNode {
  const categoryOptions = input.options.filter((option) => option.category === input.category);
  const groups = new Map<string, typeof categoryOptions>();
  for (const option of categoryOptions) {
    const existing = groups.get(option.group) ?? [];
    existing.push(option);
    groups.set(option.group, existing);
  }

  return (
    <div className="l-col">
      <h4 className="t-small">{input.title}</h4>
      {[...groups.entries()].map(([group, options]) => (
        <div key={`${input.category}-${group}`} className="l-col">
          <h5 className="t-small">{formatGroupLabel(group)}</h5>
          {options.map((option) => {
            const quantity = input.quantities[option.itemId] ?? 0;
            const isStrengthBlocked = !isWeaponStrengthAllowed(option);
            const max = resolveMaxAffordableQuantity(
              input.category,
              option.itemId,
              quantity,
              input.availableMoney,
              input.selection,
              input.options,
              option.variablePrice || isStrengthBlocked
            );
            const disableInput = option.variablePrice || (isStrengthBlocked && quantity === 0);

            return (
              <InventoryQuantityField
                key={option.itemId}
                label={formatInventoryItemLabel(option, quantity)}
                max={max}
                value={quantity}
                disabled={disableInput}
                onChange={(value) =>
                  input.onQuantityChange(input.category, option.itemId, Math.max(0, Math.min(max, value)))
                }
                hint={formatInventoryItemHint(option, isStrengthBlocked)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function formatGroupLabel(group: string): string {
  return group.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatInventoryItemLabel(
  option: ReturnType<typeof getEquipmentOptionsForStrength>[number],
  quantity: number
): string {
  const lineTotal = option.costGamels * quantity;
  if (option.category === 'gear') {
    return `${option.label} (${option.priceLabel}) [${lineTotal} G]`;
  }
  return `${option.label} (${option.priceLabel}, STR ${formatStrengthRequirement(option)})${option.usage ? `, ${option.usage}` : ''} [${lineTotal} G]`;
}

function formatInventoryItemHint(
  option: ReturnType<typeof getEquipmentOptionsForStrength>[number],
  isStrengthBlocked: boolean
): string {
  if (option.variablePrice) {
    return 'Open-ended market price; minimum shown from the rulebook.';
  }
  if (isStrengthBlocked) {
    return `Requires STR ${formatStrengthRequirement(option)}.`;
  }
  if (option.category === 'gear' && option.usedFor) {
    return `Used for: ${formatGroupLabel(option.usedFor)}.`;
  }
  return ' ';
}

function resolveMaxAffordableQuantity(
  category: InventoryCategory,
  itemId: string,
  currentQuantity: number,
  availableMoney: number,
  selection: WizardState['equipment'],
  options: ReturnType<typeof getEquipmentOptionsForStrength>,
  blocked: boolean
): number {
  if (blocked) {
    return currentQuantity;
  }

  let max = currentQuantity;
  while (
    max < 99 &&
    isEquipmentQuantityAffordable(category, itemId, max + 1, availableMoney, selection, options)
  ) {
    max += 1;
  }
  return max;
}

function InventoryQuantityField(props: {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const options = Array.from({ length: props.max + 1 }, (_, index) => index);

  return (
    <div className={`c-inventory-row ${props.disabled ? 'is-disabled' : ''}`.trim()}>
      <div className="c-inventory-row__main">
        <label className="c-inventory-row__label">{props.label}</label>
        <select
          className="c-field__control c-inventory-row__control"
          value={String(props.value)}
          disabled={props.disabled}
          onChange={(event) => props.onChange(Number(event.target.value))}
          aria-label={`${props.label} quantity`}
        >
          {options.map((quantity) => (
            <option key={`${props.label}-${quantity}`} value={String(quantity)}>
              {quantity}
            </option>
          ))}
        </select>
      </div>
      <div className="c-inventory-row__hint">{props.hint ?? ' '}</div>
    </div>
  );
}
