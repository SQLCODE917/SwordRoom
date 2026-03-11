import { type Dispatch, type ReactNode, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { createApiClient, type CharacterItem, type CommandStatusResponse } from '../api/ApiClient';
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
  type SubAbilityScores,
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
  goodHumanRuneMasterAutofill,
  submitCharacterForApproval,
  submitSaveCharacterDraft,
} from '../flows/characterWizardCommands';
import { describeFailure, type CommandStatusViewModel } from '../hooks/useCommandStatus';
import { logWebFlow, summarizeError } from '../logging/flowLog';

interface CharacterSnapshot {
  status: string;
  version: number | null;
  subAbility: SubAbilityScores | null;
  ability: Record<string, number> | null;
  skills: Array<{ skill: string; level: number }>;
}

interface WizardState {
  gameId: string;
  characterId: string;
  race: Race;
  raisedBy: HalfElfRaisedBy;
  subAbility: SubAbilityScores;
  backgroundRoll2dTotal: number;
  moneyRoll2dTotal: number;
  craftsmanSkill: string;
  merchantScholarChoice: '' | 'MERCHANT' | 'SAGE';
  generalSkillName: string;
  name: string;
  gender: string;
  age: string;
  purchases: Array<{ skill: string; targetLevel: number }>;
  equipment: {
    weaponQuantities: Record<string, number>;
    armorQuantities: Record<string, number>;
    shieldQuantities: Record<string, number>;
    gearQuantities: Record<string, number>;
  };
  submitNoteToGm: string;
}

type WizardStepKey = 'race' | 'dice' | 'background' | 'identity' | 'exp' | 'equipment' | 'submit';
type SaveButtonState = 'idle' | 'saving' | 'saved';

interface FieldOption {
  value: string;
  label: string;
  disabled?: boolean;
}

type InventoryCategory = 'weapon' | 'armor' | 'shield' | 'gear';
type InventoryQuantitiesKey = 'weaponQuantities' | 'armorQuantities' | 'shieldQuantities' | 'gearQuantities';

const stepTitles = ['Race', 'Dice A-H', 'Background rolls', 'Name/identity', 'EXP spend', 'Equipment cart', 'Submit'];

const initialSaveButtonState: Record<WizardStepKey, SaveButtonState> = {
  race: 'idle',
  dice: 'idle',
  background: 'idle',
  identity: 'idle',
  exp: 'idle',
  equipment: 'idle',
  submit: 'idle',
};

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

function buildInitialState(gameId: string, characterId: string): WizardState {
  return {
    gameId,
    characterId,
    race: 'HUMAN',
    raisedBy: 'HUMANS',
    subAbility: rollSubAbilitiesForRace('HUMAN'),
    backgroundRoll2dTotal: 3,
    moneyRoll2dTotal: 9,
    craftsmanSkill: '',
    merchantScholarChoice: '',
    generalSkillName: '',
    name: '',
    gender: '',
    age: '',
    purchases: [],
    equipment: {
      weaponQuantities: {},
      armorQuantities: {},
      shieldQuantities: {},
      gearQuantities: {},
    },
    submitNoteToGm: 'Ready for review',
  };
}

export function CharacterWizardPage() {
  const params = useParams<{ gameId: string; characterId?: string }>();
  const routeGameId = params.gameId ?? 'game-1';
  const generatedCharacterIdRef = useRef<string>(createCharacterId());
  const routeCharacterId = params.characterId ?? generatedCharacterIdRef.current;
  const isEditMode = typeof params.characterId === 'string' && params.characterId.trim() !== '';
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);

  const [state, setState] = useState<WizardState>(() => buildInitialState(routeGameId, routeCharacterId));
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const stepPanelRefs = useRef<Array<HTMLElement | null>>([]);
  const commandStatusRef = useRef<HTMLDivElement | null>(null);
  const commandStatusScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const [stepError, setStepError] = useState<string>(' ');
  const [snapshot, setSnapshot] = useState<CharacterSnapshot | null>(null);
  const [lastSavedFingerprint, setLastSavedFingerprint] = useState<string | null>(null);
  const [saveStateByStep, setSaveStateByStep] = useState<Record<WizardStepKey, SaveButtonState>>(
    () => initialSaveButtonState
  );
  const [commandStatus, setCommandStatus] = useState<CommandStatusViewModel>({
    state: 'Idle',
    commandId: null,
    message: 'No command submitted yet.',
    errorCode: null,
    errorMessage: null,
  });
  const saveResetTimersRef = useRef<Record<WizardStepKey, ReturnType<typeof setTimeout> | null>>({
    race: null,
    dice: null,
    background: null,
    identity: null,
    exp: null,
    equipment: null,
    submit: null,
  });

  useEffect(() => {
    setState(buildInitialState(routeGameId, routeCharacterId));
    setSnapshot(null);
    setLastSavedFingerprint(null);
    setStepError(' ');
  }, [routeCharacterId, routeGameId]);

  useEffect(() => {
    logWebFlow('WEB_CHARACTER_WIZARD_MOUNT', {
      gameId: state.gameId,
      characterId: state.characterId,
      isEditMode,
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
  }, [isEditMode, state.characterId, state.gameId]);

  useEffect(() => {
    return () => {
      for (const timer of Object.values(saveResetTimersRef.current)) {
        if (timer) {
          clearTimeout(timer);
        }
      }
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

  const derived = useMemo(() => computeDerivedAbilities(state.subAbility), [state.subAbility]);
  const backgroundEligible = resolveBackgroundEligibility(state.race, state.raisedBy);
  const isDwarfPath = state.race === 'DWARF';
  const equipmentOptions = useMemo(() => getEquipmentOptionsForStrength(derived.STR), [derived.STR]);
  const equipmentCart = useMemo(() => buildEquipmentCart(state.equipment), [state.equipment]);
  const startingPreview = useMemo(
    () =>
      computeStartingPackagePreview({
        characterId: state.characterId,
        race: state.race,
        raisedBy: state.raisedBy,
        subAbility: state.subAbility,
        backgroundRoll2dTotal: backgroundEligible ? state.backgroundRoll2dTotal : undefined,
        startingMoneyRoll2dTotal: state.moneyRoll2dTotal,
        craftsmanSkill: state.craftsmanSkill.trim() || undefined,
        merchantScholarChoice: state.merchantScholarChoice || undefined,
        generalSkillName: state.generalSkillName.trim() || undefined,
      }),
    [
      backgroundEligible,
      state.backgroundRoll2dTotal,
      state.characterId,
      state.craftsmanSkill,
      state.generalSkillName,
      state.merchantScholarChoice,
      state.moneyRoll2dTotal,
      state.race,
      state.raisedBy,
      state.subAbility,
    ]
  );
  const purchasePreview = useMemo(
    () => computeSkillPurchasePreview(startingPreview.state, state.purchases),
    [startingPreview.state, state.purchases]
  );
  const equipmentPreview = useMemo(
    () => computeEquipmentPreview(purchasePreview.state, equipmentCart),
    [equipmentCart, purchasePreview.state]
  );
  const nameError = state.name.trim() === '' ? 'Name is required.' : ' ';
  const stateFingerprint = useMemo(() => serializeWizardState(state), [state]);
  const isDirty = lastSavedFingerprint === null || lastSavedFingerprint !== stateFingerprint;
  const canEditDraft = snapshot?.status !== 'PENDING' && snapshot?.status !== 'APPROVED';
  const previewErrors = [...startingPreview.errors, ...purchasePreview.errors, ...equipmentPreview.errors];
  const isDraftReadyForSubmit =
    state.name.trim() !== '' &&
    startingPreview.state !== null &&
    purchasePreview.state !== null &&
    equipmentPreview.state !== null &&
    previewErrors.length === 0;
  const canSubmitForApproval = !isExecutingCommand && canEditDraft && isDraftReadyForSubmit;
  const backgroundLabel = backgroundsByRoll[state.backgroundRoll2dTotal] ?? 'No background result for this roll.';
  const availableMoney = purchasePreview.state?.startingPackage?.startingMoneyGamels ?? 0;

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
              `Background table path: ${backgroundEligible ? 'Table 1-5' : 'Race table 1-6'}`,
              `Current derived STR / MP preview: ${derived.STR} / ${derived.MP}`,
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
                <StatBox label="DEX" value={derived.DEX} bonus={computeAbilityBonus(derived.DEX)} tone="dex" />
                <StatBox label="AGI" value={derived.AGI} bonus={computeAbilityBonus(derived.AGI)} tone="agi" />
                <StatBox label="INT" value={derived.INT} bonus={computeAbilityBonus(derived.INT)} tone="int" />
              </div>
              <div className="l-split">
                <StatBox label="STR" value={derived.STR} bonus={computeAbilityBonus(derived.STR)} tone="str" />
                <StatBox label="LF" value={derived.LF} bonus={computeAbilityBonus(derived.LF)} tone="lf" />
                <StatBox label="MP" value={derived.MP} bonus={computeAbilityBonus(derived.MP)} tone="mp" />
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
      isError: startingPreview.errors.length > 0,
      panel: (
        <WizardStep title="3) Background rolls" enabled={activeStepIndex === 2}>
          <fieldset className="l-col" disabled={isExecutingCommand}>
            {backgroundEligible ? (
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
                        purchases: normalizePurchasesForBaseSkills(prev.purchases, startingPreview.startingSkills),
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
            {isDwarfPath ? (
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
              backgroundEligible ? backgroundLabel : 'Background table not applicable for this race path.',
              `Starting skills: ${formatSkillList(startingPreview.startingSkills)}`,
              `Starting EXP / remaining EXP: ${startingPreview.expTotal} / ${purchasePreview.expUnspent}`,
              `Starting money / remaining money: ${startingPreview.moneyGamels} / ${equipmentPreview.moneyRemaining}`,
            ]}
          />
          <ErrorList errors={startingPreview.errors} />
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
              errorText={nameError}
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
      isError: purchasePreview.errors.length > 0,
      panel: (
        <WizardStep title="5) EXP spend" enabled={activeStepIndex === 4}>
          <fieldset className="l-col" disabled={isExecutingCommand}>
            {skillOptions.map((option) => {
              const baseLevel = findSkillLevel(startingPreview.startingSkills, option.skill);
              const currentTarget = findPurchaseTargetLevel(state.purchases, option.skill) || baseLevel;
              const levels = Array.from({ length: option.maxLevel - baseLevel + 1 }, (_, index) => baseLevel + index);
              const levelCosts = describeSkillLevelCosts(startingPreview.state, option.skill, option.maxLevel);
              const costSchedule = formatSkillCostSchedule(levelCosts);

              return (
                <FieldSelect
                  key={option.skill}
                  label={option.label}
                  value={String(currentTarget)}
                  options={levels.map((level) => ({
                    value: String(level),
                    label:
                      level === baseLevel
                        ? `${level} (starting)`
                        : formatSkillLevelOptionLabel(
                            level,
                            levelCosts.find((entry) => entry.level === level)?.costExp ?? null,
                            levelCosts.find((entry) => entry.level === level)?.note
                          ),
                    disabled: level !== baseLevel && !isSkillTargetAffordable(option.skill, level, baseLevel),
                  }))}
                  onChange={(value) => updateSkillPurchase(option.skill, Number(value), baseLevel)}
                  hint={`Base ${baseLevel}. Costs: ${costSchedule}. Final skills: ${formatSkillList(purchasePreview.skills)}`}
                />
              );
            })}
          </fieldset>
          <InfoList
            lines={[
              `Starting skills: ${formatSkillList(startingPreview.startingSkills)}`,
              `Current adventurer skills: ${formatSkillList(purchasePreview.skills)}`,
              `EXP remaining: ${purchasePreview.expUnspent}`,
            ]}
          />
          <ErrorList errors={purchasePreview.errors} />
        </WizardStep>
      ),
      action: renderSaveButton('exp', activeStepIndex === 4),
    },
    {
      id: 'step-equipment',
      title: stepTitles[5]!,
      isError: equipmentPreview.errors.length > 0,
      panel: (
        <WizardStep title="6) Equipment cart" enabled={activeStepIndex === 5}>
          <fieldset className="l-col" disabled={isExecutingCommand}>
            {renderInventorySections({
              category: 'weapon',
              title: 'Weapons',
              options: equipmentOptions,
              quantities: state.equipment.weaponQuantities,
              availableMoney,
              selection: state.equipment,
              onQuantityChange: setInventoryQuantity,
            })}
            {renderInventorySections({
              category: 'armor',
              title: 'Armor',
              options: equipmentOptions,
              quantities: state.equipment.armorQuantities,
              availableMoney,
              selection: state.equipment,
              onQuantityChange: setInventoryQuantity,
            })}
            {renderInventorySections({
              category: 'shield',
              title: 'Shields',
              options: equipmentOptions,
              quantities: state.equipment.shieldQuantities,
              availableMoney,
              selection: state.equipment,
              onQuantityChange: setInventoryQuantity,
            })}
            {renderInventorySections({
              category: 'gear',
              title: 'Other Equipment',
              options: equipmentOptions,
              quantities: state.equipment.gearQuantities,
              availableMoney,
              selection: state.equipment,
              onQuantityChange: setInventoryQuantity,
            })}
          </fieldset>
          <InfoList
            lines={[
              `Cart: ${formatCartSummary(equipmentCart)}`,
              `Total cost: ${equipmentPreview.totalCost} G`,
              `Money remaining: ${equipmentPreview.moneyRemaining} G`,
            ]}
          />
          <ErrorList errors={equipmentPreview.errors} />
        </WizardStep>
      ),
      action: renderSaveButton('equipment', activeStepIndex === 5),
    },
    {
      id: 'step-submit',
      title: stepTitles[6]!,
      isError: !isDraftReadyForSubmit,
      panel: (
        <WizardStep title="7) Submit" enabled={activeStepIndex === 6}>
          <fieldset className="l-col" disabled={isExecutingCommand}>
            <FieldText
              label="Note to GM"
              value={state.submitNoteToGm}
              onChange={(value) => setState((prev) => ({ ...prev, submitNoteToGm: value }))}
              hint="Submit saves the current draft first if needed, then submits the saved revision."
            />
            <button
              className={`c-btn ${canSubmitForApproval ? '' : 'is-disabled'}`.trim()}
              type="button"
              disabled={!canSubmitForApproval}
              onClick={() => void executeFinalSubmit()}
            >
              {snapshot?.status === 'PENDING' ? 'Submitted For Review' : 'Submit Character For Approval'}
            </button>
            <InfoList
              lines={[
                snapshot?.status === 'PENDING'
                  ? 'This character is already pending GM review.'
                  : isDirty || !snapshot || snapshot.version === null
                    ? 'Submit will save the current draft first, then send it for review.'
                    : 'Submit uses the current saved draft revision.',
                `Ready to submit: ${isDraftReadyForSubmit ? 'yes' : 'no'}`,
              ]}
            />
            <ErrorList errors={state.name.trim() === '' ? ['Name is required.'] : previewErrors} />
          </fieldset>
        </WizardStep>
      ),
      action: renderSaveButton('submit', activeStepIndex === 6),
    },
  ];

  return (
    <div className="l-page">
      <Panel
        title={isEditMode ? 'Edit Character Draft' : 'Character Wizard'}
        subtitle={
          isEditMode
            ? 'Edit an existing character draft. Each save and submit sends one command, then polls until terminal.'
            : 'Create a new character. Each save and submit sends one command, then polls until terminal.'
        }
      >
        <div className="l-col">
          <div className="c-note c-note--info">
            <span className="t-small">Autofill uses fixture good.human_rune_master_sorcerer_starter.</span>
          </div>
          <button
            className={`c-btn ${isExecutingCommand || !import.meta.env.DEV ? 'is-disabled' : ''}`.trim()}
            type="button"
            disabled={isExecutingCommand || !import.meta.env.DEV}
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

              <Panel title="Current Character Snapshot" subtitle="Read-only snapshot from GET /games/{gameId}/characters/{characterId}">
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
        targetLevel <= baseLevel
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
    if (!startingPreview.state) {
      return false;
    }

    const candidatePurchases =
      targetLevel <= baseLevel
        ? state.purchases.filter((entry) => entry.skill !== skill)
        : [...state.purchases.filter((entry) => entry.skill !== skill), { skill, targetLevel }];
    const candidatePreview = computeSkillPurchasePreview(startingPreview.state, candidatePurchases);
    return !candidatePreview.errors.includes('not enough starting EXP');
  }

  async function executeFinalSubmit() {
    setStepError(' ');
    scheduleCommandStatusScroll();
    setIsExecutingCommand(true);
    logWebFlow('WEB_CHARACTER_WIZARD_EXECUTE_START', {
      gameId: state.gameId,
      characterId: state.characterId,
      race: state.race,
      raisedBy: state.raisedBy,
      backgroundRoll2dTotal: state.backgroundRoll2dTotal,
      moneyRoll2dTotal: state.moneyRoll2dTotal,
      purchases: state.purchases.map((entry) => `${entry.skill}:${entry.targetLevel}`),
      cart: equipmentCart,
      namePresent: state.name.trim().length > 0,
      noteToGmPresent: state.submitNoteToGm.trim().length > 0,
      expectedVersion: snapshot?.version ?? null,
    });
    try {
      if (!isDraftReadyForSubmit) {
        throw new Error(previewErrors[0] ?? 'Complete the required fields before submitting for approval.');
      }

      let nextSnapshot = snapshot;
      if (!nextSnapshot || nextSnapshot.version === null || isDirty) {
        setSaveButtonState('submit', 'saving');
        nextSnapshot = await saveCurrentDraft('submit');
        setSaveButtonState('submit', 'saved');
      }

      if (!nextSnapshot || nextSnapshot.version === null) {
        throw new Error('Draft save did not return a versioned character snapshot.');
      }

      const expectedVersion = nextSnapshot.version;
      await submitCommandAndAwait('Submit for approval', () =>
        submitCharacterForApproval({
          api,
          gameId: state.gameId,
          characterId: state.characterId,
          expectedVersion,
        })
      );

      await refreshSnapshot({ syncWizardState: true });
      logWebFlow('WEB_CHARACTER_WIZARD_EXECUTE_OK', {
        gameId: state.gameId,
        characterId: state.characterId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveButtonState('submit', 'idle');
      logWebFlow('WEB_CHARACTER_WIZARD_EXECUTE_FAILED', {
        gameId: state.gameId,
        characterId: state.characterId,
        ...summarizeError(error),
      });
      setStepError(message);
      setCommandStatus((prev) => ({
        ...prev,
        state: 'Failed',
        message: 'Command failed.',
        errorCode: prev.errorCode,
        errorMessage: message,
      }));
    } finally {
      setIsExecutingCommand(false);
    }
  }

  function renderSaveButton(stepKey: WizardStepKey, enabled: boolean) {
    const buttonState = saveStateByStep[stepKey];
    const isSaving = buttonState === 'saving';
    const isSaved = buttonState === 'saved';
    const canSave = enabled && !isExecutingCommand && canEditDraft;

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

  async function submitCommandAndAwait(label: string, submit: () => Promise<string>) {
    setCommandStatus({
      state: 'Idle',
      commandId: null,
      message: `${label} submitting...`,
      errorCode: null,
      errorMessage: null,
    });
    logWebFlow('WEB_CHARACTER_WIZARD_STEP_SUBMIT_START', {
      gameId: state.gameId,
      characterId: state.characterId,
      label,
    });
    const commandId = await submit();
    setCommandStatus({
      state: 'Queued',
      commandId,
      message: `${label} queued.`,
      errorCode: null,
      errorMessage: null,
    });
    logWebFlow('WEB_CHARACTER_WIZARD_STEP_SUBMIT_ACCEPTED', {
      gameId: state.gameId,
      characterId: state.characterId,
      label,
      commandId,
    });

    const terminal = await pollUntilTerminal(commandId);
    if (terminal.status === 'PROCESSED') {
      logWebFlow('WEB_CHARACTER_WIZARD_STEP_SUBMIT_OK', {
        gameId: state.gameId,
        characterId: state.characterId,
        label,
        commandId,
      });
      return;
    }

    logWebFlow('WEB_CHARACTER_WIZARD_STEP_SUBMIT_FAILED', {
      gameId: state.gameId,
      characterId: state.characterId,
      label,
      commandId,
      errorCode: terminal.errorCode,
      errorMessage: terminal.errorMessage,
    });
    throw new Error(
      describeFailure({
        errorCode: terminal.errorCode,
        errorMessage: terminal.errorMessage,
      })
    );
  }

  async function saveStepProgress(stepKey: WizardStepKey) {
    setStepError(' ');
    scheduleCommandStatusScroll();
    setIsExecutingCommand(true);
    setSaveButtonState(stepKey, 'saving');
    setCommandStatus({
      state: 'Idle',
      commandId: null,
      message: `Saving ${stepKey}...`,
      errorCode: null,
      errorMessage: null,
    });
    logWebFlow('WEB_CHARACTER_WIZARD_SAVE_START', {
      gameId: state.gameId,
      characterId: state.characterId,
      stepKey,
    });

    try {
      await saveCurrentDraft(stepKey);
      setSaveButtonState(stepKey, 'saved');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveButtonState(stepKey, 'idle');
      setStepError(message);
      logWebFlow('WEB_CHARACTER_WIZARD_SAVE_FAILED', {
        gameId: state.gameId,
        characterId: state.characterId,
        stepKey,
        ...summarizeError(error),
      });
      setCommandStatus((prev) => ({
        ...prev,
        state: 'Failed',
        message: 'Save failed.',
        errorCode: prev.errorCode,
        errorMessage: message,
      }));
    } finally {
      setIsExecutingCommand(false);
    }
  }

  async function saveCurrentDraft(stepKey: WizardStepKey): Promise<CharacterSnapshot> {
    const payload = buildSaveProgressPayload(stepKey);
    const commandId = await submitSaveCharacterDraft({
      api,
      gameId: state.gameId,
      characterId: state.characterId,
      ...payload,
    });

    setCommandStatus({
      state: 'Queued',
      commandId,
      message: `Save queued for ${stepKey}.`,
      errorCode: null,
      errorMessage: null,
    });
    logWebFlow('WEB_CHARACTER_WIZARD_SAVE_ACCEPTED', {
      gameId: state.gameId,
      characterId: state.characterId,
      stepKey,
      commandId,
    });

    const terminal = await pollUntilTerminal(commandId);
    if (terminal.status !== 'PROCESSED') {
      throw new Error(describeFailure(terminal));
    }

    const refreshed = await refreshSnapshot({ syncWizardState: true });
    if (!refreshed) {
      throw new Error('Character snapshot missing after save.');
    }
    logWebFlow('WEB_CHARACTER_WIZARD_SAVE_OK', {
      gameId: state.gameId,
      characterId: state.characterId,
      stepKey,
      commandId,
    });
    return refreshed;
  }

  function buildSaveProgressPayload(stepKey: WizardStepKey): Omit<
    Parameters<typeof submitSaveCharacterDraft>[0],
    'api' | 'gameId' | 'characterId'
  > {
    logWebFlow('WEB_CHARACTER_WIZARD_SAVE_PAYLOAD_BUILT', {
      gameId: state.gameId,
      characterId: state.characterId,
      stepKey,
      expectedVersion: snapshot?.version ?? null,
      backgroundApplied: backgroundEligible || isDwarfPath,
      noteToGmPresent: state.submitNoteToGm.trim().length > 0,
      purchases: state.purchases.map((entry) => `${entry.skill}:${entry.targetLevel}`),
      cart: equipmentCart,
    });

    const payload: Omit<Parameters<typeof submitSaveCharacterDraft>[0], 'api' | 'gameId' | 'characterId'> = {
      expectedVersion: snapshot?.version ?? null,
      race: state.race,
      raisedBy: state.raisedBy,
      subAbility: state.subAbility,
      startingMoneyRoll2dTotal: state.moneyRoll2dTotal,
      craftsmanSkill: state.craftsmanSkill.trim() || undefined,
      merchantScholarChoice: state.merchantScholarChoice || undefined,
      generalSkillName: state.generalSkillName.trim() || undefined,
      identity: {
        name: state.name,
        age: parseOptionalNumber(state.age),
        gender: state.gender.trim() ? state.gender.trim() : null,
      },
      purchases: state.purchases,
      cart: equipmentCart,
      noteToGm: state.submitNoteToGm,
    };

    if (backgroundEligible) {
      payload.backgroundRoll2dTotal = state.backgroundRoll2dTotal;
    }

    return payload;
  }

  function setSaveButtonState(stepKey: WizardStepKey, nextState: SaveButtonState) {
    const existingTimer = saveResetTimersRef.current[stepKey];
    if (existingTimer) {
      clearTimeout(existingTimer);
      saveResetTimersRef.current[stepKey] = null;
    }

    setSaveStateByStep((prev) => ({
      ...prev,
      [stepKey]: nextState,
    }));

    if (nextState === 'saved') {
      saveResetTimersRef.current[stepKey] = setTimeout(() => {
        setSaveStateByStep((prev) => ({
          ...prev,
          [stepKey]: 'idle',
        }));
        saveResetTimersRef.current[stepKey] = null;
      }, 1400);
    }
  }

  async function pollUntilTerminal(commandId: string): Promise<CommandStatusResponse> {
    const intervals = [400, 800, 1200, 1800, 2600];
    let attempt = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const response = await api.getCommandStatus(commandId);
      if (!response) {
        await sleep(intervals[Math.min(attempt, intervals.length - 1)] ?? 2600);
        attempt += 1;
        continue;
      }

      const mapped = mapStatus(response);
      setCommandStatus(mapped);
      logWebFlow('WEB_CHARACTER_WIZARD_STATUS_POLLED', {
        gameId: state.gameId,
        characterId: state.characterId,
        commandId,
        status: response.status,
        errorCode: response.errorCode,
      });

      if (response.status === 'PROCESSED' || response.status === 'FAILED') {
        return response;
      }

      await sleep(intervals[Math.min(attempt, intervals.length - 1)] ?? 2600);
      attempt += 1;
    }
  }

  async function refreshSnapshot(options?: { syncWizardState?: boolean }): Promise<CharacterSnapshot | null> {
    logWebFlow('WEB_CHARACTER_WIZARD_SNAPSHOT_REFRESH_START', {
      gameId: state.gameId,
      characterId: state.characterId,
    });
    try {
      const item = await api.getCharacter(state.gameId, state.characterId);
      if (!item) {
        setSnapshot(null);
        setLastSavedFingerprint(null);
        logWebFlow('WEB_CHARACTER_WIZARD_SNAPSHOT_REFRESH_MISS', {
          gameId: state.gameId,
          characterId: state.characterId,
        });
        return null;
      }

      const draft = (item as Record<string, unknown>).draft;
      const hydratedState = hydrateWizardStateFromCharacter(item as CharacterItem, state);
      if (options?.syncWizardState) {
        setState(hydratedState);
      }
      setLastSavedFingerprint(serializeWizardState(hydratedState));
      const nextSnapshot = {
        status: String((item as Record<string, unknown>).status ?? 'UNKNOWN'),
        version: typeof (item as Record<string, unknown>).version === 'number' ? ((item as Record<string, unknown>).version as number) : null,
        subAbility: draft && typeof draft === 'object' ? (((draft as Record<string, unknown>).subAbility as SubAbilityScores) ?? null) : null,
        ability: draft && typeof draft === 'object' ? (((draft as Record<string, unknown>).ability as Record<string, number>) ?? null) : null,
        skills:
          draft && typeof draft === 'object' && Array.isArray((draft as Record<string, unknown>).skills)
            ? (((draft as Record<string, unknown>).skills as Array<{ skill: string; level: number }>) ?? [])
            : [],
      };
      setSnapshot(nextSnapshot);
      logWebFlow('WEB_CHARACTER_WIZARD_SNAPSHOT_REFRESH_OK', {
        gameId: state.gameId,
        characterId: state.characterId,
        status: String((item as Record<string, unknown>).status ?? 'UNKNOWN'),
        version: nextSnapshot.version,
      });
      return nextSnapshot;
    } catch (error) {
      logWebFlow('WEB_CHARACTER_WIZARD_SNAPSHOT_REFRESH_FAILED', {
        gameId: state.gameId,
        characterId: state.characterId,
        ...summarizeError(error),
      });
      throw error;
    }
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

function mapStatus(response: CommandStatusResponse): CommandStatusViewModel {
  if (response.status === 'FAILED') {
    return {
      state: 'Failed',
      commandId: response.commandId,
      message: describeFailure(response),
      errorCode: response.errorCode,
      errorMessage: response.errorMessage,
    };
  }

  if (response.status === 'PROCESSED') {
    return {
      state: 'Processed',
      commandId: response.commandId,
      message: 'Command processed.',
      errorCode: null,
      errorMessage: null,
    };
  }

  if (response.status === 'PROCESSING') {
    return {
      state: 'Processing',
      commandId: response.commandId,
      message: 'Command processing.',
      errorCode: null,
      errorMessage: null,
    };
  }

  return {
    state: 'Queued',
    commandId: response.commandId,
    message: 'Command queued.',
    errorCode: null,
    errorMessage: null,
  };
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
  return (
    <div className={`c-field ${props.disabled ? 'is-disabled' : ''} ${props.isError ? 'is-error' : ''}`.trim()}>
      <label className="c-field__label">{props.label}</label>
      <input
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
  return (
    <div className={`c-field ${props.disabled ? 'is-disabled' : ''}`.trim()}>
      <label className="c-field__label">{props.label}</label>
      <select
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
  return (
    <div className={`c-field ${props.disabled ? 'is-disabled' : ''}`.trim()}>
      <label className="c-field__label">{props.label}</label>
      <input
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createCharacterId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `char-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `char-${Date.now().toString(16).slice(-8)}`;
}

function serializeWizardState(state: WizardState): string {
  return JSON.stringify({
    race: state.race,
    raisedBy: state.raisedBy,
    subAbility: state.subAbility,
    backgroundRoll2dTotal: state.backgroundRoll2dTotal,
    moneyRoll2dTotal: state.moneyRoll2dTotal,
    craftsmanSkill: state.craftsmanSkill,
    merchantScholarChoice: state.merchantScholarChoice,
    generalSkillName: state.generalSkillName,
    name: state.name,
    gender: state.gender,
    age: state.age,
    purchases: state.purchases,
    equipment: state.equipment,
    submitNoteToGm: state.submitNoteToGm,
  });
}

function hydrateWizardStateFromCharacter(item: CharacterItem, fallback: WizardState): WizardState {
  const record = item as Record<string, unknown>;
  const draft = record.draft && typeof record.draft === 'object' ? (record.draft as Record<string, unknown>) : {};
  const identity = draft.identity && typeof draft.identity === 'object' ? (draft.identity as Record<string, unknown>) : {};
  const background = draft.background && typeof draft.background === 'object' ? (draft.background as Record<string, unknown>) : {};
  const starting = draft.starting && typeof draft.starting === 'object' ? (draft.starting as Record<string, unknown>) : {};
  const purchases = draft.purchases && typeof draft.purchases === 'object' ? (draft.purchases as Record<string, unknown>) : {};
  const startingSkills = Array.isArray(starting.startingSkills)
    ? ((starting.startingSkills as Array<Record<string, unknown>>).map((skill) => ({
        skill: String(skill.skill),
        level: Number(skill.level),
      })) as Array<{ skill: string; level: number }>)
    : [];
  const skills = Array.isArray(draft.skills)
    ? ((draft.skills as Array<Record<string, unknown>>).map((skill) => ({
        skill: String(skill.skill),
        level: Number(skill.level),
      })) as Array<{ skill: string; level: number }>)
    : [];
  const weaponItems = Array.isArray(purchases.weapons) ? purchases.weapons : [];
  const armorItems = Array.isArray(purchases.armor) ? purchases.armor : [];
  const shieldItems = Array.isArray(purchases.shields) ? purchases.shields : [];
  const gearItems = Array.isArray(purchases.gear) ? purchases.gear : [];
  const backgroundRoll = typeof background.roll2d === 'number' ? background.roll2d : fallback.backgroundRoll2dTotal;
  const backgroundKind = typeof background.kind === 'string' ? background.kind : null;

  return {
    ...fallback,
    gameId: typeof record.gameId === 'string' ? record.gameId : fallback.gameId,
    characterId: typeof record.characterId === 'string' ? record.characterId : fallback.characterId,
    race: typeof draft.race === 'string' ? (draft.race as Race) : fallback.race,
    raisedBy: typeof draft.raisedBy === 'string' ? (draft.raisedBy as HalfElfRaisedBy) : fallback.raisedBy,
    subAbility:
      draft.subAbility && typeof draft.subAbility === 'object'
        ? (draft.subAbility as SubAbilityScores)
        : fallback.subAbility,
    backgroundRoll2dTotal: backgroundRoll,
    moneyRoll2dTotal: typeof starting.moneyRoll2d === 'number' ? starting.moneyRoll2d : fallback.moneyRoll2dTotal,
    craftsmanSkill: inferCraftsmanSkill(draft.race, startingSkills),
    merchantScholarChoice: inferMerchantScholarChoice(backgroundKind, startingSkills),
    generalSkillName: inferGeneralSkillName(backgroundRoll, startingSkills),
    name: typeof identity.name === 'string' ? identity.name : fallback.name,
    gender: typeof identity.gender === 'string' ? identity.gender : fallback.gender,
    age: typeof identity.age === 'number' ? String(identity.age) : fallback.age,
    purchases: deriveSkillPurchases(startingSkills, skills),
    equipment: {
      weaponQuantities: readPurchasedQuantities(weaponItems),
      armorQuantities: readPurchasedQuantities(armorItems),
      shieldQuantities: readPurchasedQuantities(shieldItems),
      gearQuantities: readPurchasedQuantities(gearItems),
    },
    submitNoteToGm: typeof draft.noteToGm === 'string' ? draft.noteToGm : fallback.submitNoteToGm,
  };
}

function findSkillLevel(skills: Array<{ skill: string; level: number }>, skillName: string): number {
  return (
    skills.find((skill) => skill.skill.trim().toLowerCase() === skillName.trim().toLowerCase())?.level ?? 0
  );
}

function deriveSkillPurchases(
  startingSkills: Array<{ skill: string; level: number }>,
  skills: Array<{ skill: string; level: number }>
): Array<{ skill: string; targetLevel: number }> {
  return skillOptions
    .map((option) => {
      const baseLevel = findSkillLevel(startingSkills, option.skill);
      const currentLevel = findSkillLevel(skills, option.skill);
      return currentLevel > baseLevel ? { skill: option.skill, targetLevel: currentLevel } : null;
    })
    .filter((entry): entry is { skill: string; targetLevel: number } => entry !== null);
}

function findPurchaseTargetLevel(
  purchases: Array<{ skill: string; targetLevel: number }>,
  skillName: string
): number {
  return (
    purchases.find((purchase) => purchase.skill.trim().toLowerCase() === skillName.trim().toLowerCase())?.targetLevel ?? 0
  );
}

function inferCraftsmanSkill(
  race: unknown,
  startingSkills: Array<{ skill: string; level: number }>
): string {
  if (race !== 'DWARF') {
    return '';
  }
  const craftsman = startingSkills.find((skill) => skill.level === 5);
  return craftsman?.skill === 'CraftsmanSkill_CHOSEN' ? '' : (craftsman?.skill ?? '');
}

function inferMerchantScholarChoice(
  backgroundKind: string | null,
  startingSkills: Array<{ skill: string; level: number }>
): WizardState['merchantScholarChoice'] {
  if (backgroundKind === 'MERCHANT') {
    return 'MERCHANT';
  }
  if (backgroundKind === 'SCHOLAR') {
    return 'SAGE';
  }
  if (startingSkills.some((skill) => skill.skill === 'Merchant')) {
    return 'MERCHANT';
  }
  return '';
}

function inferGeneralSkillName(
  backgroundRoll: number,
  startingSkills: Array<{ skill: string; level: number }>
): string {
  if (backgroundRoll !== 7) {
    return '';
  }

  const generalSkill = startingSkills[0]?.skill ?? '';
  return generalSkill === 'GeneralSkill_CHOSEN_BY_GM' ? '' : generalSkill;
}

function readPurchasedQuantities(items: unknown[]): Record<string, number> {
  const quantities: Record<string, number> = {};
  for (const item of items) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as Record<string, unknown>;
    if (typeof record.itemId !== 'string') {
      continue;
    }
    const qty = typeof record.qty === 'number' ? record.qty : 1;
    quantities[record.itemId] = (quantities[record.itemId] ?? 0) + qty;
  }
  return quantities;
}

function normalizePurchasesForBaseSkills(
  purchases: Array<{ skill: string; targetLevel: number }>,
  baseSkills: Array<{ skill: string; level: number }>
): Array<{ skill: string; targetLevel: number }> {
  return purchases.filter((purchase) => purchase.targetLevel > findSkillLevel(baseSkills, purchase.skill));
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
    return `Lv${level} (n/a)`;
  }
  return note ? `Lv${level} (${costExp} EXP, ${note})` : `Lv${level} (${costExp} EXP)`;
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

function buildEquipmentCart(selection: WizardState['equipment']): {
  weapons: string[];
  armor: string[];
  shields: string[];
  gear: string[];
} {
  const toItems = (quantities: Record<string, number>) =>
    Object.entries(quantities).flatMap(([itemId, qty]) => Array.from({ length: qty }, () => itemId));

  return {
    weapons: toItems(selection.weaponQuantities),
    armor: toItems(selection.armorQuantities),
    shields: toItems(selection.shieldQuantities),
    gear: toItems(selection.gearQuantities),
  };
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

function toInventoryQuantitiesFromIds(itemIds: string[]): Record<string, number> {
  const quantities: Record<string, number> = {};
  for (const itemId of itemIds) {
    quantities[itemId] = (quantities[itemId] ?? 0) + 1;
  }
  return quantities;
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
