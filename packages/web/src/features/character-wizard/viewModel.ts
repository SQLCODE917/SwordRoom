import { backgroundsByRoll, computeDerivedAbilities, resolveBackgroundEligibility } from '../../data/characterCreationReference';
import {
  computeEquipmentPreview,
  computeSkillPurchasePreview,
  computeStartingPackagePreview,
  getEquipmentOptionsForStrength,
} from '../../data/characterCreationPurchasing';
import { buildEquipmentCart, serializeWizardState } from './state.js';
import type { CharacterSnapshot, WizardMode, WizardState } from './types.js';

export function createCharacterWizardViewModel(input: {
  state: WizardState;
  snapshot: CharacterSnapshot | null;
  isExecutingCommand: boolean;
  lastSavedFingerprint: string | null;
  wizardMode: WizardMode;
}) {
  const derived = computeDerivedAbilities(input.state.subAbility);
  const backgroundEligible = resolveBackgroundEligibility(input.state.race, input.state.raisedBy);
  const isDwarfPath = input.state.race === 'DWARF';
  const equipmentOptions = getEquipmentOptionsForStrength(derived.STR);
  const equipmentCart = buildEquipmentCart(input.state.equipment);
  const startingPreview = computeStartingPackagePreview({
    characterId: input.state.characterId,
    race: input.state.race,
    raisedBy: input.state.raisedBy,
    subAbility: input.state.subAbility,
    backgroundRoll2dTotal: backgroundEligible ? input.state.backgroundRoll2dTotal : undefined,
    startingMoneyRoll2dTotal: input.state.moneyRoll2dTotal,
    craftsmanSkill: input.state.craftsmanSkill.trim() || undefined,
    merchantScholarChoice: input.state.merchantScholarChoice || undefined,
    generalSkillName: input.state.generalSkillName.trim() || undefined,
  });
  const purchasePreview = computeSkillPurchasePreview(startingPreview.state, input.state.purchases);
  const equipmentPreview = computeEquipmentPreview(purchasePreview.state, equipmentCart);
  const nameError = input.state.name.trim() === '' ? 'Name is required.' : ' ';
  const stateFingerprint = serializeWizardState(input.state);
  const isDirty = input.lastSavedFingerprint === null || input.lastSavedFingerprint !== stateFingerprint;
  const canEditDraft = input.snapshot?.status !== 'PENDING' && input.snapshot?.status !== 'APPROVED';
  const previewErrors = [...startingPreview.errors, ...purchasePreview.errors, ...equipmentPreview.errors];
  const isDraftReadyForSubmit =
    input.state.name.trim() !== '' &&
    startingPreview.state !== null &&
    purchasePreview.state !== null &&
    equipmentPreview.state !== null &&
    previewErrors.length === 0;
  const canExecuteFinalAction = !input.isExecutingCommand && canEditDraft && isDraftReadyForSubmit;
  const backgroundLabel = backgroundsByRoll[input.state.backgroundRoll2dTotal] ?? 'No background result for this roll.';
  const availableMoney = purchasePreview.state?.startingPackage?.startingMoneyGamels ?? 0;
  const finalActionLabel =
    input.wizardMode === 'library'
      ? input.snapshot ? 'Update Character' : 'Create Character'
      : input.snapshot?.status === 'PENDING'
        ? 'Submitted For Review'
        : 'Submit Character For Approval';

  return {
    derived,
    backgroundEligible,
    isDwarfPath,
    equipmentOptions,
    equipmentCart,
    startingPreview,
    purchasePreview,
    equipmentPreview,
    nameError,
    stateFingerprint,
    isDirty,
    canEditDraft,
    previewErrors,
    isDraftReadyForSubmit,
    canExecuteFinalAction,
    backgroundLabel,
    availableMoney,
    finalActionLabel,
  };
}
