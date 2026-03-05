import { type Dispatch, type ReactNode, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createApiClient, type CommandStatusResponse } from '../api/ApiClient';
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
  submitApplyStartingPackage,
  submitCharacterForApproval,
  submitCreateCharacterDraft,
  submitPurchaseStarterEquipment,
  submitSetCharacterSubAbilities,
  submitSpendStartingExp,
} from '../flows/characterWizardCommands';
import type { CommandStatusViewModel } from '../hooks/useCommandStatus';

interface CharacterSnapshot {
  status: string;
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

export function CharacterWizardPage() {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);

  const [state, setState] = useState<WizardState>(() => buildInitialState());
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const stepPanelRefs = useRef<Array<HTMLElement | null>>([]);
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const [stepError, setStepError] = useState<string>(' ');
  const [snapshot, setSnapshot] = useState<CharacterSnapshot | null>(null);
  const [commandStatus, setCommandStatus] = useState<CommandStatusViewModel>({
    state: 'Idle',
    commandId: null,
    message: 'No command submitted yet.',
    errorCode: null,
    errorMessage: null,
  });

  useEffect(() => {
    void refreshSnapshot();
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            disabled={activeStepIndex !== 0 || isExecutingCommand}
          />
          <FieldSelect
            label="Raised by"
            value={state.raisedBy}
            options={['HUMANS', 'ELVES']}
            onChange={(value) => setState((prev) => ({ ...prev, raisedBy: value as HalfElfRaisedBy }))}
            disabled={activeStepIndex !== 0 || state.race !== 'HALF_ELF' || isExecutingCommand}
            hint="Only used when race is HALF_ELF."
          />
          <button
            className={`c-btn ${isExecutingCommand ? 'is-disabled' : ''}`.trim()}
            type="button"
            disabled={isExecutingCommand || activeStepIndex !== 0}
            onClick={() =>
              void executeAndAdvance(async () =>
                submitCreateCharacterDraft({
                  api,
                  gameId: state.gameId,
                  characterId: state.characterId,
                  race: state.race,
                  raisedBy: state.raisedBy,
                })
              )
            }
          >
            Create Character Draft
          </button>
        </WizardStep>
      ),
    },
    {
      id: 'step-dice',
      title: stepTitles[1]!,
      panel: (
        <WizardStep title="2) Dice A-H" enabled={activeStepIndex === 1}>
          <div className="l-split">
            <fieldset className="l-col l-grow" disabled={activeStepIndex !== 1 || isExecutingCommand}>
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
                disabled={isExecutingCommand || activeStepIndex !== 1}
                onClick={() => setState((prev) => ({ ...prev, subAbility: rollSubAbilitiesForRace(prev.race) }))}
              >
                Roll A-H
              </button>
              <button
                className={`c-btn ${isExecutingCommand ? 'is-disabled' : ''}`.trim()}
                type="button"
                disabled={isExecutingCommand || activeStepIndex !== 1}
                onClick={() =>
                  void executeAndAdvance(async () =>
                    submitSetCharacterSubAbilities({
                      api,
                      gameId: state.gameId,
                      characterId: state.characterId,
                      subAbility: state.subAbility,
                    })
                  )
                }
              >
                Save Sub-Abilities
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
    },
    {
      id: 'step-background',
      title: stepTitles[2]!,
      panel: (
        <WizardStep title="3) Background rolls" enabled={activeStepIndex === 2}>
          <fieldset className="l-col" disabled={activeStepIndex !== 2 || !backgroundEligible || isExecutingCommand}>
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
            <button
              className={`c-btn ${isExecutingCommand ? 'is-disabled' : ''}`.trim()}
              type="button"
              disabled={isExecutingCommand || activeStepIndex !== 2 || !backgroundEligible}
              onClick={() =>
                void executeAndAdvance(async () =>
                  submitApplyStartingPackage({
                    api,
                    gameId: state.gameId,
                    characterId: state.characterId,
                    backgroundRoll2dTotal: state.backgroundRoll2dTotal,
                    startingMoneyRoll2dTotal: state.moneyRoll2dTotal,
                  })
                )
              }
            >
              Apply Starting Package
            </button>
          </fieldset>
          <div className="c-note c-note--info">
            <span className="t-small">{backgroundEligible ? backgroundLabel : 'Background table not applicable.'}</span>
          </div>
        </WizardStep>
      ),
    },
    {
      id: 'step-name',
      title: stepTitles[3]!,
      isError: state.name.trim() === '',
      panel: (
        <WizardStep title="4) Name/identity" enabled={activeStepIndex === 3}>
          <fieldset className="l-col" disabled={activeStepIndex !== 3 || isExecutingCommand}>
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
    },
    {
      id: 'step-exp',
      title: stepTitles[4]!,
      panel: (
        <WizardStep title="5) EXP spend" enabled={activeStepIndex === 4}>
          <fieldset className="l-col" disabled={activeStepIndex !== 4 || isExecutingCommand}>
            <FieldText label="Skill" value="Fighter" onChange={() => undefined} disabled />
            <FieldNumber
              label="Target level"
              value={state.fighterLevel}
              min={1}
              max={1}
              onChange={() => setState((prev) => ({ ...prev, fighterLevel: 1 }))}
              hint="Minimal fixture path: Fighter level 1."
            />
            <button
              className={`c-btn ${isExecutingCommand ? 'is-disabled' : ''}`.trim()}
              type="button"
              disabled={isExecutingCommand || activeStepIndex !== 4}
              onClick={() =>
                void executeAndAdvance(async () =>
                  submitSpendStartingExp({
                    api,
                    gameId: state.gameId,
                    characterId: state.characterId,
                    purchases: [{ skill: 'Fighter', targetLevel: state.fighterLevel }],
                  })
                )
              }
            >
              Spend Starting EXP
            </button>
          </fieldset>
        </WizardStep>
      ),
    },
    {
      id: 'step-equipment',
      title: stepTitles[5]!,
      panel: (
        <WizardStep title="6) Equipment cart" enabled={activeStepIndex === 5}>
          <fieldset className="l-col" disabled={activeStepIndex !== 5 || isExecutingCommand}>
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
            <button
              className={`c-btn ${isExecutingCommand ? 'is-disabled' : ''}`.trim()}
              type="button"
              disabled={isExecutingCommand || activeStepIndex !== 5}
              onClick={() =>
                void executeAndAdvance(async () =>
                  submitPurchaseStarterEquipment({
                    api,
                    gameId: state.gameId,
                    characterId: state.characterId,
                    cart: {
                      weapons: state.cart.mage_staff ? ['mage_staff'] : [],
                      armor: state.cart.cloth_armor ? ['cloth_armor'] : [],
                      shields: [],
                      gear: [],
                    },
                  })
                )
              }
            >
              Purchase Starter Equipment
            </button>
          </fieldset>
        </WizardStep>
      ),
    },
    {
      id: 'step-submit',
      title: stepTitles[6]!,
      panel: (
        <WizardStep title="7) Submit" enabled={activeStepIndex === 6}>
          <fieldset className="l-col" disabled={activeStepIndex !== 6 || isExecutingCommand}>
            <FieldText
              label="Note to GM"
              value={state.submitNoteToGm}
              onChange={(value) => setState((prev) => ({ ...prev, submitNoteToGm: value }))}
              hint="Included in SubmitCharacterForApproval."
            />
            <button
              className={`c-btn ${isExecutingCommand ? 'is-disabled' : ''}`.trim()}
              type="button"
              disabled={isExecutingCommand || activeStepIndex !== 6}
              onClick={() =>
                void executeAndAdvance(async () =>
                  submitCharacterForApproval({
                    api,
                    gameId: state.gameId,
                    characterId: state.characterId,
                    noteToGm: state.submitNoteToGm,
                  })
                )
              }
            >
              Submit Character For Approval
            </button>
          </fieldset>
        </WizardStep>
      ),
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
              <Panel title="Command Status" subtitle="Fixed region for no-jump UX.">
                <CommandStatusPanel status={commandStatus} />
              </Panel>

              <Panel title="Current Character Snapshot" subtitle="Read-only snapshot from GET /games/{gameId}/characters/{characterId}">
                <SnapshotView snapshot={snapshot} />
              </Panel>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );

  async function executeAndAdvance(submit: () => Promise<string>) {
    setStepError(' ');
    setIsExecutingCommand(true);
    try {
      const commandId = await submit();
      setCommandStatus({
        state: 'Queued',
        commandId,
        message: 'Command queued.',
        errorCode: null,
        errorMessage: null,
      });

      const terminal = await pollUntilTerminal(commandId);
      if (terminal.status === 'PROCESSED') {
        await refreshSnapshot();
        setActiveStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
        return;
      }

      const verbatim = `${terminal.errorCode ?? ''} ${terminal.errorMessage ?? ''}`.trim();
      setStepError(verbatim || 'Command failed without a backend message.');
    } catch (error) {
      setStepError(error instanceof Error ? error.message : String(error));
      setCommandStatus((prev) => ({
        ...prev,
        state: 'Failed',
        message: 'Command failed.',
        errorCode: prev.errorCode,
        errorMessage: error instanceof Error ? error.message : String(error),
      }));
    } finally {
      setIsExecutingCommand(false);
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

      if (response.status === 'PROCESSED' || response.status === 'FAILED') {
        return response;
      }

      await sleep(intervals[Math.min(attempt, intervals.length - 1)] ?? 2600);
      attempt += 1;
    }
  }

  async function refreshSnapshot() {
    const item = await api.getCharacter(state.gameId, state.characterId);
    if (!item) {
      setSnapshot(null);
      return;
    }

    const draft = (item as any).draft;
    setSnapshot({
      status: String((item as any).status ?? 'UNKNOWN'),
      subAbility: draft?.subAbility ?? null,
      ability: draft?.ability ?? null,
      skills: Array.isArray(draft?.skills) ? draft.skills : [],
    });
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
      message: 'Command failed.',
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

function WizardStep({ title, enabled, children }: { title: string; enabled: boolean; children: ReactNode }) {
  return (
    <div className="l-col">
      <h3 className="c-stepper__title t-h3">{title}</h3>
      <div aria-disabled={!enabled}>{children}</div>
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
