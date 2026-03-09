import { type Dispatch, type ReactNode, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createApiClient, type CharacterItem, type CommandStatusResponse } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { CommandStatusPanel } from '../components/CommandStatusPanel';
import { Panel } from '../components/Panel';
import { Stepper, type StepperItem } from '../components/Stepper';
import {
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
  name: string;
  gender: string;
  age: string;
  fighterLevel: number;
  cart: {
    mage_staff: boolean;
    cloth_armor: boolean;
  };
  submitNoteToGm: string;
}

function buildInitialState(): WizardState {
  return {
    gameId: 'game-1',
    characterId: 'char-human-1',
    race: 'HUMAN',
    raisedBy: 'HUMANS',
    subAbility: rollSubAbilitiesForRace('HUMAN'),
    backgroundRoll2dTotal: 3,
    moneyRoll2dTotal: 9,
    name: '',
    gender: '',
    age: '',
    fighterLevel: 1,
    cart: {
      mage_staff: true,
      cloth_armor: true,
    },
    submitNoteToGm: 'Ready for review',
  };
}

const stepTitles = ['Race', 'Dice A-H', 'Background rolls', 'Name/identity', 'EXP spend', 'Equipment cart', 'Submit'];
type WizardStepKey = 'race' | 'dice' | 'background' | 'identity' | 'exp' | 'equipment' | 'submit';
type SaveButtonState = 'idle' | 'saving' | 'saved';

const initialSaveButtonState: Record<WizardStepKey, SaveButtonState> = {
  race: 'idle',
  dice: 'idle',
  background: 'idle',
  identity: 'idle',
  exp: 'idle',
  equipment: 'idle',
  submit: 'idle',
};

export function CharacterWizardPage() {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);

  const [state, setState] = useState<WizardState>(() => buildInitialState());
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const stepPanelRefs = useRef<Array<HTMLElement | null>>([]);
  const commandStatusRef = useRef<HTMLDivElement | null>(null);
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
    logWebFlow('WEB_CHARACTER_WIZARD_MOUNT', {
      gameId: state.gameId,
      characterId: state.characterId,
    });
    void refreshSnapshot({ syncWizardState: true });
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of Object.values(saveResetTimersRef.current)) {
        if (timer) {
          clearTimeout(timer);
        }
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
  const backgroundLabel = backgroundsByRoll[state.backgroundRoll2dTotal] ?? 'No background result for this roll.';
  const nameError = state.name.trim() === '' ? 'Name is required.' : ' ';
  const stateFingerprint = useMemo(() => serializeWizardState(state), [state]);
  const isDirty = lastSavedFingerprint === null || lastSavedFingerprint !== stateFingerprint;
  const canEditDraft = snapshot?.status !== 'PENDING' && snapshot?.status !== 'APPROVED';
  const isDraftReadyForSubmit = state.name.trim() !== '';
  const canSubmitForApproval =
    !isExecutingCommand && canEditDraft && isDraftReadyForSubmit;

  const steps: StepperItem[] = [
    {
      id: 'step-race',
      title: stepTitles[0]!,
      panel: (
        <WizardStep title="1) Race" enabled={activeStepIndex === 0}>
          <FieldSelect
            label="Race"
            value={state.race}
            options={['HUMAN', 'DWARF', 'GRASSRUNNER', 'ELF', 'HALF_ELF']}
            onChange={(value) => setState((prev) => ({ ...prev, race: value as Race }))}
            disabled={isExecutingCommand}
          />
          <FieldSelect
            label="Raised by"
            value={state.raisedBy}
            options={['HUMANS', 'ELVES']}
            onChange={(value) => setState((prev) => ({ ...prev, raisedBy: value as HalfElfRaisedBy }))}
            disabled={state.race !== 'HALF_ELF' || isExecutingCommand}
            hint="Only used when race is HALF_ELF."
          />
          <div className="c-note c-note--info">
            <span className="t-small">Save writes the current race and resets draft-dependent values for that race.</span>
          </div>
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
                onClick={() => setState((prev) => ({ ...prev, subAbility: rollSubAbilitiesForRace(prev.race) }))}
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
      panel: (
        <WizardStep title="3) Background rolls" enabled={activeStepIndex === 2}>
          <fieldset className="l-col" disabled={!backgroundEligible || isExecutingCommand}>
            <FieldNumber
              label="Background roll total"
              value={state.backgroundRoll2dTotal}
              min={2}
              max={12}
              onChange={(value) => setState((prev) => ({ ...prev, backgroundRoll2dTotal: clamp(value, 2, 12) }))}
              hint="Enabled only for HUMAN and HALF_ELF raised by HUMANS."
            />
            <FieldNumber
              label="Money roll total"
              value={state.moneyRoll2dTotal}
              min={2}
              max={12}
              onChange={(value) => setState((prev) => ({ ...prev, moneyRoll2dTotal: clamp(value, 2, 12) }))}
            />
          </fieldset>
          <div className="c-note c-note--info">
            <span className="t-small">{backgroundEligible ? backgroundLabel : 'Background table not applicable.'}</span>
          </div>
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
      panel: (
        <WizardStep title="5) EXP spend" enabled={activeStepIndex === 4}>
          <fieldset className="l-col" disabled={isExecutingCommand}>
            <FieldText label="Skill" value="Fighter" onChange={() => undefined} disabled />
            <FieldNumber
              label="Target level"
              value={state.fighterLevel}
              min={1}
              max={1}
              onChange={() => setState((prev) => ({ ...prev, fighterLevel: 1 }))}
              hint="Minimal fixture path: Fighter level 1."
            />
          </fieldset>
        </WizardStep>
      ),
      action: renderSaveButton('exp', activeStepIndex === 4),
    },
    {
      id: 'step-equipment',
      title: stepTitles[5]!,
      panel: (
        <WizardStep title="6) Equipment cart" enabled={activeStepIndex === 5}>
          <fieldset className="l-col" disabled={isExecutingCommand}>
            <FieldCheckbox
              label="mage_staff"
              checked={state.cart.mage_staff}
              onChange={(checked) =>
                setState((prev) => ({ ...prev, cart: { ...prev.cart, mage_staff: checked } }))
              }
            />
            <FieldCheckbox
              label="cloth_armor"
              checked={state.cart.cloth_armor}
              onChange={(checked) =>
                setState((prev) => ({ ...prev, cart: { ...prev.cart, cloth_armor: checked } }))
              }
            />
          </fieldset>
        </WizardStep>
      ),
      action: renderSaveButton('equipment', activeStepIndex === 5),
    },
    {
      id: 'step-submit',
      title: stepTitles[6]!,
      panel: (
        <WizardStep title="7) Submit" enabled={activeStepIndex === 6}>
          <fieldset className="l-col" disabled={isExecutingCommand}>
            <FieldText
              label="Note to GM"
              value={state.submitNoteToGm}
              onChange={(value) => setState((prev) => ({ ...prev, submitNoteToGm: value }))}
              hint="Submit will save the current draft first if needed."
            />
            <button
              className={`c-btn ${canSubmitForApproval ? '' : 'is-disabled'}`.trim()}
              type="button"
              disabled={!canSubmitForApproval}
              onClick={() => void executeFinalSubmit()}
            >
              {snapshot?.status === 'PENDING' ? 'Submitted For Review' : 'Submit Character For Approval'}
            </button>
            <div className="c-note c-note--info">
              <span className="t-small">
                {snapshot?.status === 'PENDING'
                  ? 'This character is already pending GM review.'
                  : !isDraftReadyForSubmit
                    ? 'Complete the required fields before submitting for review.'
                    : isDirty || !snapshot || snapshot.version === null
                      ? 'Submit will save the current draft first, then send it for review.'
                      : 'Submit uses the saved draft only.'}
              </span>
            </div>
          </fieldset>
        </WizardStep>
      ),
      action: renderSaveButton('submit', activeStepIndex === 6),
    },
  ];

  return (
    <div className="l-page">
      <Panel title="Character Wizard" subtitle="Each step action submits one command, then polls status until terminal.">
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
                name: goodHumanRuneMasterAutofill.identity.name,
                age: goodHumanRuneMasterAutofill.identity.age,
                gender: goodHumanRuneMasterAutofill.identity.gender,
                fighterLevel: goodHumanRuneMasterAutofill.purchases[0]?.targetLevel ?? 1,
                cart: {
                  mage_staff: goodHumanRuneMasterAutofill.cart.weapons.includes('mage_staff'),
                  cloth_armor: goodHumanRuneMasterAutofill.cart.armor.includes('cloth_armor'),
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

  async function executeFinalSubmit() {
    setStepError(' ');
    scrollCommandStatusIntoView();
    setIsExecutingCommand(true);
    logWebFlow('WEB_CHARACTER_WIZARD_EXECUTE_START', {
      gameId: state.gameId,
      characterId: state.characterId,
      race: state.race,
      raisedBy: state.raisedBy,
      backgroundRoll2dTotal: state.backgroundRoll2dTotal,
      moneyRoll2dTotal: state.moneyRoll2dTotal,
      fighterLevel: state.fighterLevel,
      namePresent: state.name.trim().length > 0,
      noteToGmPresent: state.submitNoteToGm.trim().length > 0,
      equipment: {
        mage_staff: state.cart.mage_staff,
        cloth_armor: state.cart.cloth_armor,
      },
      expectedVersion: snapshot?.version ?? null,
    });
    try {
      if (!isDraftReadyForSubmit) {
        throw new Error('Complete the required fields before submitting for approval.');
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
    scrollCommandStatusIntoView();
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
      backgroundApplied: backgroundEligible || state.race === 'DWARF',
      noteToGmPresent: state.submitNoteToGm.trim().length > 0,
    });

    const payload: Omit<Parameters<typeof submitSaveCharacterDraft>[0], 'api' | 'gameId' | 'characterId'> = {
      expectedVersion: snapshot?.version ?? null,
      race: state.race,
      raisedBy: state.raisedBy,
      subAbility: state.subAbility,
      identity: {
        name: state.name,
        age: parseOptionalNumber(state.age),
        gender: state.gender ? state.gender : null,
      },
      purchases: [{ skill: 'Fighter', targetLevel: state.fighterLevel }],
      cart: {
        weapons: state.cart.mage_staff ? ['mage_staff'] : [],
        armor: state.cart.cloth_armor ? ['cloth_armor'] : [],
        shields: [],
        gear: [],
      },
      noteToGm: state.submitNoteToGm,
    };

    if (backgroundEligible || state.race === 'DWARF') {
      payload.backgroundRoll2dTotal = state.backgroundRoll2dTotal;
      payload.startingMoneyRoll2dTotal = state.moneyRoll2dTotal;
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

      const draft = (item as any).draft;
      const hydratedState = hydrateWizardStateFromCharacter(item as CharacterItem, state);
      if (options?.syncWizardState) {
        setState(hydratedState);
      }
      setLastSavedFingerprint(serializeWizardState(hydratedState));
      const nextSnapshot = {
        status: String((item as any).status ?? 'UNKNOWN'),
        version: typeof (item as any).version === 'number' ? (item as any).version : null,
        subAbility: draft?.subAbility ?? null,
        ability: draft?.ability ?? null,
        skills: Array.isArray(draft?.skills) ? draft.skills : [],
      };
      setSnapshot(nextSnapshot);
      logWebFlow('WEB_CHARACTER_WIZARD_SNAPSHOT_REFRESH_OK', {
        gameId: state.gameId,
        characterId: state.characterId,
        status: String((item as any).status ?? 'UNKNOWN'),
        version: typeof (item as any).version === 'number' ? (item as any).version : null,
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
        <span className="t-small">
          abilities: {snapshot.ability ? JSON.stringify(snapshot.ability) : 'not set'}
        </span>
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
  options: readonly string[];
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
          <option key={option} value={option}>
            {option}
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
}) {
  return (
    <div className="c-field">
      <label className="c-field__label">{props.label}</label>
      <input
        className="c-field__control"
        type="number"
        value={props.value}
        min={props.min}
        max={props.max}
        onChange={(event) => props.onChange(Number(event.target.value || 0))}
      />
      <div className="c-field__hint">{props.hint ?? ' '}</div>
      <div className="c-field__err"> </div>
    </div>
  );
}

function FieldCheckbox(props: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="c-field">
      <label className="c-field__label">{props.label}</label>
      <label className="c-field__check">
        <input
          className="c-field__control c-field__control--check"
          type="checkbox"
          checked={props.checked}
          onChange={(event) => props.onChange(event.target.checked)}
        />
        <span className="t-small">Include</span>
      </label>
      <div className="c-field__hint"> </div>
      <div className="c-field__err"> </div>
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

function serializeWizardState(state: WizardState): string {
  return JSON.stringify({
    race: state.race,
    raisedBy: state.raisedBy,
    subAbility: state.subAbility,
    backgroundRoll2dTotal: state.backgroundRoll2dTotal,
    moneyRoll2dTotal: state.moneyRoll2dTotal,
    name: state.name,
    gender: state.gender,
    age: state.age,
    fighterLevel: state.fighterLevel,
    cart: state.cart,
    submitNoteToGm: state.submitNoteToGm,
  });
}

function hydrateWizardStateFromCharacter(item: CharacterItem, fallback: WizardState): WizardState {
  const record = item as Record<string, unknown>;
  const draft = record.draft && typeof record.draft === 'object' ? (record.draft as Record<string, unknown>) : {};
  const identity = draft.identity && typeof draft.identity === 'object' ? (draft.identity as Record<string, unknown>) : {};
  const purchases = draft.purchases && typeof draft.purchases === 'object' ? (draft.purchases as Record<string, unknown>) : {};
  const weapons = Array.isArray(purchases.weapons) ? purchases.weapons : [];
  const armor = Array.isArray(purchases.armor) ? purchases.armor : [];
  const skills = Array.isArray(draft.skills) ? draft.skills : [];
  const fighter = skills.find(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof (item as Record<string, unknown>).skill === 'string' &&
      String((item as Record<string, unknown>).skill).toLowerCase() === 'fighter'
  ) as Record<string, unknown> | undefined;

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
    backgroundRoll2dTotal:
      draft.background && typeof draft.background === 'object' && typeof (draft.background as Record<string, unknown>).roll2d === 'number'
        ? ((draft.background as Record<string, unknown>).roll2d as number)
        : fallback.backgroundRoll2dTotal,
    moneyRoll2dTotal:
      draft.starting && typeof draft.starting === 'object' && typeof (draft.starting as Record<string, unknown>).moneyRoll2d === 'number'
        ? ((draft.starting as Record<string, unknown>).moneyRoll2d as number)
        : fallback.moneyRoll2dTotal,
    name: typeof identity.name === 'string' ? identity.name : fallback.name,
    gender: typeof identity.gender === 'string' ? identity.gender : fallback.gender,
    age: typeof identity.age === 'number' ? String(identity.age) : fallback.age,
    fighterLevel: typeof fighter?.level === 'number' ? fighter.level : fallback.fighterLevel,
    cart: {
      mage_staff: weapons.some((entry) => readItemId(entry) === 'mage_staff'),
      cloth_armor: armor.some((entry) => readItemId(entry) === 'cloth_armor'),
    },
    submitNoteToGm: typeof draft.noteToGm === 'string' ? draft.noteToGm : fallback.submitNoteToGm,
  };
}

function readItemId(value: unknown): string | null {
  return value && typeof value === 'object' && typeof (value as Record<string, unknown>).itemId === 'string'
    ? ((value as Record<string, unknown>).itemId as string)
    : null;
}
