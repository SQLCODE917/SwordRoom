import type { CharacterItem } from '../../api/ApiClient';
import { skillOptions } from '../../data/characterCreationPurchasing';
import { rollSubAbilitiesForRace, type HalfElfRaisedBy, type Race, type SubAbilityScores } from '../../data/characterCreationReference';
import type { WizardState } from './types.js';

export function buildInitialState(gameId: string, characterId: string): WizardState {
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

export function createCharacterId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `char-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `char-${Date.now().toString(16).slice(-8)}`;
}

export function serializeWizardState(state: WizardState): string {
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

export function hydrateWizardStateFromCharacter(item: CharacterItem, fallback: WizardState): WizardState {
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
      weaponQuantities: toInventoryQuantitiesFromPurchasedItems(weaponItems),
      armorQuantities: toInventoryQuantitiesFromPurchasedItems(armorItems),
      shieldQuantities: toInventoryQuantitiesFromPurchasedItems(shieldItems),
      gearQuantities: toInventoryQuantitiesFromPurchasedItems(gearItems),
    },
    submitNoteToGm: typeof draft.noteToGm === 'string' ? draft.noteToGm : fallback.submitNoteToGm,
  };
}

export function buildEquipmentCart(selection: WizardState['equipment']): {
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

export function toInventoryQuantitiesFromIds(itemIds: string[]): Record<string, number> {
  const quantities: Record<string, number> = {};
  for (const itemId of itemIds) {
    quantities[itemId] = (quantities[itemId] ?? 0) + 1;
  }
  return quantities;
}

export function readCharacterIdentityName(item: CharacterItem): string {
  const record = item as Record<string, unknown>;
  const draft = record.draft && typeof record.draft === 'object' ? (record.draft as Record<string, unknown>) : {};
  const identity = draft.identity && typeof draft.identity === 'object' ? (draft.identity as Record<string, unknown>) : {};
  return typeof identity.name === 'string' ? identity.name.trim() : '';
}

export function normalizePurchasesForBaseSkills(
  purchases: Array<{ skill: string; targetLevel: number }>,
  baseSkills: Array<{ skill: string; level: number }>
): Array<{ skill: string; targetLevel: number }> {
  return purchases.filter((purchase) => purchase.targetLevel !== findSkillLevel(baseSkills, purchase.skill));
}

function findSkillLevel(skills: Array<{ skill: string; level: number }>, skillName: string): number {
  return skills.find((skill) => skill.skill.trim().toLowerCase() === skillName.trim().toLowerCase())?.level ?? 0;
}

function deriveSkillPurchases(
  startingSkills: Array<{ skill: string; level: number }>,
  skills: Array<{ skill: string; level: number }>
): Array<{ skill: string; targetLevel: number }> {
  return skillOptions
    .map((option) => {
      const baseLevel = findSkillLevel(startingSkills, option.skill);
      const currentLevel = findSkillLevel(skills, option.skill);
      return currentLevel !== baseLevel ? { skill: option.skill, targetLevel: currentLevel } : null;
    })
    .filter((entry): entry is { skill: string; targetLevel: number } => entry !== null);
}

function inferCraftsmanSkill(race: unknown, startingSkills: Array<{ skill: string; level: number }>): string {
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

function inferGeneralSkillName(backgroundRoll: number, startingSkills: Array<{ skill: string; level: number }>): string {
  if (backgroundRoll !== 7) {
    return '';
  }

  const generalSkill = startingSkills[0]?.skill ?? '';
  return generalSkill === 'GeneralSkill_CHOSEN_BY_GM' ? '' : generalSkill;
}

function toInventoryQuantitiesFromPurchasedItems(items: unknown[]): Record<string, number> {
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
