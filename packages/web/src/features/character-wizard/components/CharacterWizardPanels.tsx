import { type Dispatch, type ReactNode, type SetStateAction, useId } from 'react';
import type { CharacterItem } from '../../../api/ApiClient';
import type { PregamePlanningPrompt } from '../../../api/ApiClient';
import {
  HALF_ELF_RAISED_BY,
  RACES,
  computeAbilityBonus,
  subAbilityRollFormulasByRace,
  type HalfElfRaisedBy,
  type Race,
  type SubAbilityKey,
} from '../../../data/characterCreationReference';
import {
  backgroundOptions,
  describeSkillLevelCosts,
  roll2dTotal,
  skillOptions,
  type EquipmentOption,
} from '../../../data/characterCreationPurchasing';
import { CHARACTER_SHARE_INTENT_OPTIONS, readCharacterIdentityName } from '../index.js';
import type { CharacterPlanningFocusViewModel } from '../planningFocus.js';
import type { CharacterShareIntent, InventoryCategory, InventoryQuantitiesKey, SaveButtonState, WizardMode, WizardState } from '../types.js';
import type { createCharacterWizardViewModel } from '../viewModel.js';

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

type CharacterWizardViewModel = ReturnType<typeof createCharacterWizardViewModel>;

interface FieldOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export function CharacterWizardAutofillControls(props: {
  isExecutingCommand: boolean;
  savedCharacters: CharacterItem[];
  selectedSavedCharacterId: string;
  currentCharacterId: string;
  onSelectSavedCharacter: (characterId: string) => void;
}) {
  const selectableCharacters = props.savedCharacters.filter((item) => item.characterId !== props.currentCharacterId);

  return (
    <FieldSelect
      label="Start From"
      value={props.selectedSavedCharacterId}
      options={[
        ...(selectableCharacters.length > 0 ? [] : [{ value: '', label: 'No saved characters available' }]),
        ...selectableCharacters.map((item) => ({
          value: item.characterId,
          label: `${readCharacterIdentityName(item) || item.characterId} (${item.status})`,
        })),
      ]}
      onChange={props.onSelectSavedCharacter}
      disabled={props.isExecutingCommand || selectableCharacters.length === 0}
    />
  );
}

export function RaceStepPanel(props: {
  active: boolean;
  isExecutingCommand: boolean;
  state: WizardState;
  view: CharacterWizardViewModel;
  onRaceChange: (race: Race) => void;
  onRaisedByChange: (raisedBy: HalfElfRaisedBy) => void;
}) {
  return (
    <WizardStep title="1) Race" enabled={props.active}>
      <FieldSelect
        label="Race"
        value={props.state.race}
        options={raceOptions}
        onChange={(value) => props.onRaceChange(value as Race)}
        disabled={props.isExecutingCommand}
      />
      <FieldSelect
        label="Raised by"
        value={props.state.raisedBy}
        options={raisedByOptions}
        onChange={(value) => props.onRaisedByChange(value as HalfElfRaisedBy)}
        disabled={props.state.race !== 'HALF_ELF' || props.isExecutingCommand}
        hint="Only used when race is HALF_ELF."
      />
      <InfoList
        lines={[
          `Background table path: ${props.view.backgroundEligible ? 'Table 1-5' : 'Race table 1-6'}`,
          `Current derived STR / MP preview: ${props.view.derived.STR} / ${props.view.derived.MP}`,
        ]}
      />
    </WizardStep>
  );
}

export function DiceStepPanel(props: {
  active: boolean;
  isExecutingCommand: boolean;
  state: WizardState;
  view: CharacterWizardViewModel;
  onSetSubAbility: (key: SubAbilityKey, value: number) => void;
  onRollSubAbilities: () => void;
}) {
  return (
    <WizardStep title="2) Dice A-H" enabled={props.active}>
      <div className="l-split">
        <fieldset className="l-col l-grow" disabled={props.isExecutingCommand}>
          <div className="l-split">
            <div className="l-col l-grow">
              <FieldNumber
                label={`A (${subAbilityRollFormulasByRace[props.state.race].A})`}
                value={props.state.subAbility.A}
                min={1}
                onChange={(value) => props.onSetSubAbility('A', value)}
              />
              <FieldNumber
                label={`B (${subAbilityRollFormulasByRace[props.state.race].B})`}
                value={props.state.subAbility.B}
                min={1}
                onChange={(value) => props.onSetSubAbility('B', value)}
              />
              <FieldNumber
                label={`C (${subAbilityRollFormulasByRace[props.state.race].C})`}
                value={props.state.subAbility.C}
                min={1}
                onChange={(value) => props.onSetSubAbility('C', value)}
              />
              <FieldNumber
                label={`D (${subAbilityRollFormulasByRace[props.state.race].D})`}
                value={props.state.subAbility.D}
                min={1}
                onChange={(value) => props.onSetSubAbility('D', value)}
              />
            </div>
            <div className="l-col l-grow">
              <FieldNumber
                label={`E (${subAbilityRollFormulasByRace[props.state.race].E})`}
                value={props.state.subAbility.E}
                min={1}
                onChange={(value) => props.onSetSubAbility('E', value)}
              />
              <FieldNumber
                label={`F (${subAbilityRollFormulasByRace[props.state.race].F})`}
                value={props.state.subAbility.F}
                min={1}
                onChange={(value) => props.onSetSubAbility('F', value)}
              />
              <FieldNumber
                label={`G (${subAbilityRollFormulasByRace[props.state.race].G})`}
                value={props.state.subAbility.G}
                min={1}
                onChange={(value) => props.onSetSubAbility('G', value)}
              />
              <FieldNumber
                label={`H (${subAbilityRollFormulasByRace[props.state.race].H})`}
                value={props.state.subAbility.H}
                min={1}
                onChange={(value) => props.onSetSubAbility('H', value)}
              />
            </div>
          </div>
          <button
            className={`c-btn ${props.isExecutingCommand ? 'is-disabled' : ''}`.trim()}
            type="button"
            disabled={props.isExecutingCommand}
            onClick={props.onRollSubAbilities}
          >
            Roll A-H
          </button>
        </fieldset>
        <div className="l-col l-grow">
          <div className="l-split">
            <StatBox label="DEX" value={props.view.derived.DEX} bonus={computeAbilityBonus(props.view.derived.DEX)} tone="dex" />
            <StatBox label="AGI" value={props.view.derived.AGI} bonus={computeAbilityBonus(props.view.derived.AGI)} tone="agi" />
            <StatBox label="INT" value={props.view.derived.INT} bonus={computeAbilityBonus(props.view.derived.INT)} tone="int" />
          </div>
          <div className="l-split">
            <StatBox label="STR" value={props.view.derived.STR} bonus={computeAbilityBonus(props.view.derived.STR)} tone="str" />
            <StatBox label="LF" value={props.view.derived.LF} bonus={computeAbilityBonus(props.view.derived.LF)} tone="lf" />
            <StatBox label="MP" value={props.view.derived.MP} bonus={computeAbilityBonus(props.view.derived.MP)} tone="mp" />
          </div>
        </div>
      </div>
    </WizardStep>
  );
}

export function BackgroundStepPanel(props: {
  active: boolean;
  isExecutingCommand: boolean;
  state: WizardState;
  view: CharacterWizardViewModel;
  onUpdateState: Dispatch<SetStateAction<WizardState>>;
  normalizePurchasesForBaseSkills: (
    purchases: Array<{ skill: string; targetLevel: number }>,
    baseSkills: Array<{ skill: string; level: number }>
  ) => Array<{ skill: string; targetLevel: number }>;
}) {
  return (
    <WizardStep title="3) Background rolls" enabled={props.active}>
      <fieldset className="l-col" disabled={props.isExecutingCommand}>
        {props.view.backgroundEligible ? (
          <>
            <FieldSelect
              label="Background result"
              value={String(props.state.backgroundRoll2dTotal)}
              options={backgroundOptions.map((option) => ({
                value: String(option.roll),
                label: `${option.roll} - ${option.label}`,
              }))}
              onChange={(value) =>
                props.onUpdateState((prev) => ({ ...prev, backgroundRoll2dTotal: Number(value), purchases: [] }))
              }
            />
            <button
              className={`c-btn ${props.isExecutingCommand ? 'is-disabled' : ''}`.trim()}
              type="button"
              disabled={props.isExecutingCommand}
              onClick={() =>
                props.onUpdateState((prev) => ({ ...prev, backgroundRoll2dTotal: roll2dTotal(), purchases: [] }))
              }
            >
              Roll Background 2D
            </button>
            {props.state.backgroundRoll2dTotal === 8 ? (
              <FieldSelect
                label="Merchant / Scholar choice"
                value={props.state.merchantScholarChoice}
                options={merchantScholarOptions}
                onChange={(value) =>
                  props.onUpdateState((prev) => ({
                    ...prev,
                    merchantScholarChoice: value as WizardState['merchantScholarChoice'],
                    purchases: props.normalizePurchasesForBaseSkills(prev.purchases, props.view.startingPreview.startingSkills),
                  }))
                }
                hint="Merchant 3 or Sage 1 must be selected for background roll 8."
              />
            ) : null}
            {props.state.backgroundRoll2dTotal === 7 ? (
              <FieldText
                label="GM-approved general skill"
                value={props.state.generalSkillName}
                onChange={(value) => props.onUpdateState((prev) => ({ ...prev, generalSkillName: value }))}
                hint="Required for Ordinary Citizen."
              />
            ) : null}
          </>
        ) : null}
        {props.view.isDwarfPath ? (
          <FieldText
            label="Craftsman skill"
            value={props.state.craftsmanSkill}
            onChange={(value) => props.onUpdateState((prev) => ({ ...prev, craftsmanSkill: value }))}
            hint="Dwarves start with one level 5 craftsman skill."
          />
        ) : null}
        <FieldSelect
          label="Starting money roll"
          value={String(props.state.moneyRoll2dTotal)}
          options={rollOptions}
          onChange={(value) => props.onUpdateState((prev) => ({ ...prev, moneyRoll2dTotal: Number(value) }))}
          hint="Manual select or roll 2D."
        />
        <button
          className={`c-btn ${props.isExecutingCommand ? 'is-disabled' : ''}`.trim()}
          type="button"
          disabled={props.isExecutingCommand}
          onClick={() => props.onUpdateState((prev) => ({ ...prev, moneyRoll2dTotal: roll2dTotal() }))}
        >
          Roll Money 2D
        </button>
      </fieldset>
      <InfoList
        lines={[
          props.view.backgroundEligible ? props.view.backgroundLabel : 'Background table not applicable for this race path.',
          `Starting skills: ${formatSkillList(props.view.startingPreview.startingSkills)}`,
          `Starting EXP / remaining EXP: ${props.view.startingPreview.expTotal} / ${props.view.purchasePreview.expUnspent}`,
          `Starting money / remaining money: ${props.view.startingPreview.moneyGamels} / ${props.view.equipmentPreview.moneyRemaining}`,
        ]}
      />
      <ErrorList errors={props.view.startingPreview.errors} />
    </WizardStep>
  );
}

export function IdentityStepPanel(props: {
  active: boolean;
  isExecutingCommand: boolean;
  state: WizardState;
  view: CharacterWizardViewModel;
  onUpdateState: Dispatch<SetStateAction<WizardState>>;
}) {
  return (
    <WizardStep title="4) Name/identity" enabled={props.active}>
      <fieldset className="l-col" disabled={props.isExecutingCommand}>
        <FieldText
          label="Name"
          value={props.state.name}
          onChange={(value) => props.onUpdateState((prev) => ({ ...prev, name: value }))}
          errorText={props.view.nameError}
          isError={props.state.name.trim() === ''}
        />
        <div className="l-split">
          <FieldText
            label="Gender"
            value={props.state.gender}
            onChange={(value) => props.onUpdateState((prev) => ({ ...prev, gender: value }))}
          />
          <FieldText
            label="Age"
            value={props.state.age}
            onChange={(value) => props.onUpdateState((prev) => ({ ...prev, age: value }))}
          />
        </div>
      </fieldset>
    </WizardStep>
  );
}

export function ExpStepPanel(props: {
  active: boolean;
  isExecutingCommand: boolean;
  state: WizardState;
  view: CharacterWizardViewModel;
  isSkillTargetAffordable: (skill: string, targetLevel: number, baseLevel: number) => boolean;
  onUpdateSkillPurchase: (skill: string, targetLevel: number, baseLevel: number) => void;
}) {
  return (
    <WizardStep title="5) EXP spend" enabled={props.active}>
      <fieldset className="l-col" disabled={props.isExecutingCommand}>
        {skillOptions.map((option) => {
          const baseLevel = findSkillLevel(props.view.startingPreview.startingSkills, option.skill);
          const currentTarget = findPurchaseTargetLevel(props.state.purchases, option.skill) ?? baseLevel;
          const levels = Array.from({ length: option.maxLevel + 1 }, (_, index) => index);
          const levelCosts = describeSkillLevelCosts(props.view.startingPreview.state, option.skill, option.maxLevel);
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
                disabled: level !== baseLevel && !props.isSkillTargetAffordable(option.skill, level, baseLevel),
              }))}
              onChange={(value) => props.onUpdateSkillPurchase(option.skill, Number(value), baseLevel)}
              hint={`Base ${baseLevel}. Costs: ${costSchedule}. Final skills: ${formatSkillList(props.view.purchasePreview.skills)}`}
            />
          );
        })}
      </fieldset>
      <InfoList
        lines={[
          `Starting skills: ${formatSkillList(props.view.startingPreview.startingSkills)}`,
          `Current adventurer skills: ${formatSkillList(props.view.purchasePreview.skills)}`,
          `EXP remaining: ${props.view.purchasePreview.expUnspent}`,
        ]}
      />
      <ErrorList errors={props.view.purchasePreview.errors} />
    </WizardStep>
  );
}

export function EquipmentStepPanel(props: {
  active: boolean;
  isExecutingCommand: boolean;
  state: WizardState;
  view: CharacterWizardViewModel;
  onQuantityChange: (category: InventoryCategory, itemId: string, quantity: number) => void;
}) {
  return (
    <WizardStep title="6) Equipment cart" enabled={props.active}>
      <fieldset className="l-col" disabled={props.isExecutingCommand}>
        {renderInventorySections({
          category: 'weapon',
          title: 'Weapons',
          options: props.view.equipmentOptions,
          quantities: props.state.equipment.weaponQuantities,
          availableMoney: props.view.availableMoney,
          selection: props.state.equipment,
          onQuantityChange: props.onQuantityChange,
        })}
        {renderInventorySections({
          category: 'armor',
          title: 'Armor',
          options: props.view.equipmentOptions,
          quantities: props.state.equipment.armorQuantities,
          availableMoney: props.view.availableMoney,
          selection: props.state.equipment,
          onQuantityChange: props.onQuantityChange,
        })}
        {renderInventorySections({
          category: 'shield',
          title: 'Shields',
          options: props.view.equipmentOptions,
          quantities: props.state.equipment.shieldQuantities,
          availableMoney: props.view.availableMoney,
          selection: props.state.equipment,
          onQuantityChange: props.onQuantityChange,
        })}
        {renderInventorySections({
          category: 'gear',
          title: 'Other Equipment',
          options: props.view.equipmentOptions,
          quantities: props.state.equipment.gearQuantities,
          availableMoney: props.view.availableMoney,
          selection: props.state.equipment,
          onQuantityChange: props.onQuantityChange,
        })}
      </fieldset>
      <InfoList
        lines={[
          `Cart: ${formatCartSummary(props.view.equipmentCart)}`,
          `Total cost: ${props.view.equipmentPreview.totalCost} G`,
          `Money remaining: ${props.view.equipmentPreview.moneyRemaining} G`,
        ]}
      />
      <ErrorList errors={props.view.equipmentPreview.errors} />
    </WizardStep>
  );
}

export function SubmitStepPanel(props: {
  active: boolean;
  isExecutingCommand: boolean;
  shareState: SaveButtonState;
  state: WizardState;
  view: CharacterWizardViewModel;
  snapshot: { status: string; version: number | null } | null;
  wizardMode: WizardMode;
  onUpdateState: Dispatch<SetStateAction<WizardState>>;
  onExecuteFinalAction: () => void;
  onShareDraftToChat: () => void;
}) {
  const canShareToChat =
    props.wizardMode === 'apply' &&
    props.view.canEditDraft &&
    props.view.isDraftReadyForSubmit &&
    !props.isExecutingCommand;
  const isSharing = props.shareState === 'saving';
  const isShared = props.shareState === 'saved';

  return (
    <WizardStep title={props.wizardMode === 'library' ? '7) Create Character' : '7) Submit'} enabled={props.active}>
      <fieldset className="l-col" disabled={props.isExecutingCommand}>
        <FieldText
          label="Note to GM"
          value={props.state.submitNoteToGm}
          onChange={(value) => props.onUpdateState((prev) => ({ ...prev, submitNoteToGm: value }))}
          hint={
            props.wizardMode === 'library'
              ? 'Create saves the current draft to your character library.'
              : 'Submit saves the current draft first if needed, then submits the saved revision.'
          }
        />
        <button
          className={`c-btn ${props.view.canExecuteFinalAction ? '' : 'is-disabled'}`.trim()}
          type="button"
          disabled={!props.view.canExecuteFinalAction}
          onClick={props.onExecuteFinalAction}
        >
          {props.view.finalActionLabel}
        </button>
        {props.wizardMode === 'apply' ? (
          <button
            className={`c-btn ${canShareToChat ? '' : 'is-disabled'} ${isSharing ? 'is-loading' : ''}`.trim()}
            type="button"
            disabled={!canShareToChat}
            onClick={props.onShareDraftToChat}
          >
            {isSharing ? 'Sharing...' : isShared ? 'Shared To Chat' : 'Share Draft To Chat'}
          </button>
        ) : null}
        <InfoList
          lines={[
            props.wizardMode === 'library'
              ? props.view.isDirty || !props.snapshot || props.snapshot.version === null
                ? 'Create will save the current draft to your saved characters.'
                : 'Create updates the current saved character draft.'
              : props.snapshot?.status === 'PENDING'
                ? 'This character is already pending GM review.'
                : props.view.isDirty || !props.snapshot || props.snapshot.version === null
                  ? 'Submit will save the current draft first, then send it for review.'
                  : 'Submit uses the current saved draft revision.',
            `Ready to ${props.wizardMode === 'library' ? 'create' : 'submit'}: ${props.view.isDraftReadyForSubmit ? 'yes' : 'no'}`,
            props.wizardMode === 'apply'
              ? 'Share Draft To Chat saves the current draft revision first, then posts a character summary card into game chat.'
              : 'Personal library characters cannot be shared into a game chat from this route.',
          ]}
        />
        <ErrorList errors={props.state.name.trim() === '' ? ['Name is required.'] : props.view.previewErrors} />
      </fieldset>
    </WizardStep>
  );
}

export function ShareCheckpointPanel(props: {
  isExecutingCommand: boolean;
  shareState: SaveButtonState;
  canShare: boolean;
  activeStepTitle: string;
  shareIntent: CharacterShareIntent;
  shareNote: string;
  activePrompt: PregamePlanningPrompt | null;
  onShareIntentChange: (value: CharacterShareIntent) => void;
  onShareNoteChange: (value: string) => void;
  onShare: () => void;
}) {
  const isSharing = props.shareState === 'saving';
  const isShared = props.shareState === 'saved';

  return (
    <fieldset className="l-col" disabled={props.isExecutingCommand}>
      <div className="c-note c-note--info c-pregame-planning__summary">
        <div className="t-small">{`Current checkpoint: ${props.activeStepTitle}`}</div>
        <div className="t-small">
          {props.activePrompt ? `GM prompt: ${props.activePrompt.title}` : 'No active GM prompt is available right now.'}
        </div>
      </div>

      <div className="l-col" role="radiogroup" aria-label="Share type">
        {CHARACTER_SHARE_INTENT_OPTIONS.map((option) => {
          const disabled = option.value === 'ANSWER_GM_PROMPT' && !props.activePrompt;

          return (
            <label className="c-field__check" key={option.value}>
              <input
                aria-label={option.label}
                className="c-field__control c-field__control--check"
                type="radio"
                name="share-intent"
                checked={props.shareIntent === option.value}
                disabled={disabled}
                onChange={() => props.onShareIntentChange(option.value)}
              />
              <span className="t-small">{option.label}</span>
            </label>
          );
        })}
      </div>

      <FieldTextArea
        label={
          props.shareIntent === 'ASK_QUESTION'
            ? 'Question for chat'
            : props.shareIntent === 'COMPARE_DIRECTIONS'
              ? 'Directions to compare'
              : 'Optional note'
        }
        value={props.shareNote}
        onChange={props.onShareNoteChange}
        hint={
          props.shareIntent === 'ASK_QUESTION'
            ? 'Ask the GM or party something specific about this build.'
            : props.shareIntent === 'COMPARE_DIRECTIONS'
              ? 'Describe the two directions you want feedback on, such as role, risk, or tone.'
            : props.shareIntent === 'ANSWER_GM_PROMPT'
              ? 'Add a short note about how this update answers the active prompt.'
              : 'Add a short note if you want to frame what feedback you want.'
        }
      />

      <button
        className={`c-btn ${props.canShare ? '' : 'is-disabled'} ${isSharing ? 'is-loading' : ''}`.trim()}
        type="button"
        disabled={!props.canShare}
        onClick={props.onShare}
      >
        {isSharing ? 'Sharing...' : isShared ? 'Shared To Chat' : 'Share Update'}
      </button>

      <InfoList
        lines={[
          'Share Update saves the current draft revision first, then posts a structured artifact into game chat.',
          props.shareIntent === 'ANSWER_GM_PROMPT'
            ? 'This update will be linked to the active GM prompt.'
            : 'Shared artifacts preserve this checkpoint even after later edits.',
        ]}
      />
    </fieldset>
  );
}

export function PlanningFocusPanel(props: { focus: CharacterPlanningFocusViewModel }) {
  return (
    <div className="l-col">
      <div className="c-note c-note--info c-pregame-planning__summary">
        <div className="t-small">{props.focus.headline}</div>
        <div className="t-small">{props.focus.detail}</div>
      </div>
      <InfoList lines={props.focus.lines} />
    </div>
  );
}

export function SnapshotView({ snapshot }: { snapshot: { status: string; ability: Record<string, number> | null; skills: Array<{ skill: string; level: number }> } | null }) {
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
    <div className={`c-stat-box c-stat-box--${props.tone}`}>
      <div className="c-stat-box__label">{props.label}</div>
      <div className="c-stat-box__value">{props.value}</div>
      <div className="c-stat-box__meta">{props.bonus >= 0 ? `+${props.bonus}` : String(props.bonus)}</div>
    </div>
  );
}

function FieldText(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  isError?: boolean;
  errorText?: string;
}) {
  const fieldId = useId();

  return (
    <label className={`c-field ${props.isError ? 'is-error' : ''}`.trim()} htmlFor={fieldId}>
      <span className="c-field__label">{props.label}</span>
      <input
        id={fieldId}
        aria-label={props.label}
        className="c-field__control"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
      <span className="c-field__hint">{props.isError ? props.errorText : props.hint ?? ' '}</span>
    </label>
  );
}

function FieldTextArea(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const fieldId = useId();

  return (
    <label className="c-field" htmlFor={fieldId}>
      <span className="c-field__label">{props.label}</span>
      <textarea
        id={fieldId}
        aria-label={props.label}
        className="c-field__control c-gameplay__textarea"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
      {props.hint ? <span className="c-field__hint">{props.hint}</span> : null}
    </label>
  );
}

function FieldSelect(props: {
  label: string;
  value: string;
  options: FieldOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const fieldId = useId();

  return (
    <label className="c-field" htmlFor={fieldId}>
      <span className="c-field__label">{props.label}</span>
      <select
        id={fieldId}
        aria-label={props.label}
        className="c-field__control"
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.options.map((option) => (
          <option key={`${props.label}-${option.value}`} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="c-field__hint">{props.hint ?? ' '}</span>
    </label>
  );
}

function FieldNumber(props: {
  label: string;
  value: number;
  min?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const fieldId = useId();

  return (
    <label className="c-field" htmlFor={fieldId}>
      <span className="c-field__label">{props.label}</span>
      <input
        id={fieldId}
        aria-label={props.label}
        className="c-field__control"
        type="number"
        min={props.min ?? 0}
        value={String(props.value)}
        disabled={props.disabled}
        onChange={(event) => props.onChange(Number(event.target.value))}
      />
      <span className="c-field__hint">Manual entry is allowed.</span>
    </label>
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

function findSkillLevel(skills: Array<{ skill: string; level: number }>, skillName: string): number {
  return skills.find((skill) => skill.skill.trim().toLowerCase() === skillName.trim().toLowerCase())?.level ?? 0;
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

function formatStrengthRequirement(option: EquipmentOption): string {
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

function isWeaponStrengthAllowed(option: EquipmentOption): boolean {
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
  options: EquipmentOption[]
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

function getEquipmentCost(itemId: string, options: EquipmentOption[]): number {
  return options.find((option) => option.itemId === itemId)?.costGamels ?? 0;
}

function calculateEquipmentTotalCost(selection: WizardState['equipment'], options: EquipmentOption[]): number {
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
  options: EquipmentOption[];
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
                onChange={(value) => input.onQuantityChange(input.category, option.itemId, Math.max(0, Math.min(max, value)))}
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

function formatInventoryItemLabel(option: EquipmentOption, quantity: number): string {
  const lineTotal = option.costGamels * quantity;
  if (option.category === 'gear') {
    return `${option.label} (${option.priceLabel}) [${lineTotal} G]`;
  }
  return `${option.label} (${option.priceLabel}, STR ${formatStrengthRequirement(option)})${option.usage ? `, ${option.usage}` : ''} [${lineTotal} G]`;
}

function formatInventoryItemHint(option: EquipmentOption, isStrengthBlocked: boolean): string {
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
  options: EquipmentOption[],
  blocked: boolean
): number {
  if (blocked) {
    return currentQuantity;
  }

  let max = currentQuantity;
  while (max < 99 && isEquipmentQuantityAffordable(category, itemId, max + 1, availableMoney, selection, options)) {
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
