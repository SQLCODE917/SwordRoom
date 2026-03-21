import {
  applyStartingPackage,
  computeAbilitiesAndBonuses,
  createDraftState,
  purchaseEquipment,
  spendStartingExp,
  type CharacterCreationState,
  type EquipmentCart,
  type ItemCatalogEntry,
  type StartingPackageTables,
  type SubAbility,
} from '@starter/engine';
import {
  equipmentRoster,
  equipmentRosterById,
  resolveEquipmentRosterItem,
  type EquipmentRosterCategory,
  type EquipmentRosterItem,
} from '@starter/shared/rules/equipmentRoster';
import {
  backgroundOptions as sharedBackgroundOptions,
  characterCreationSkillOptions,
  describeCharacterCreationSkillCosts,
  startingPackageTables as sharedStartingPackageTables,
  type HalfElfRaisedBy,
  type Race,
  type SkillLevelCostDescriptor,
} from '@starter/shared/rules/characterCreation';

export interface BackgroundOption {
  roll: number;
  label: string;
}

export interface SkillOption {
  skill: string;
  label: string;
  maxLevel: number;
}

export interface EquipmentOption {
  itemId: string;
  label: string;
  category: EquipmentRosterCategory;
  group: string;
  usage?: string;
  costGamels: number;
  priceLabel: string;
  variablePrice: boolean;
  canMeetRequiredStrength: boolean;
  reqStr: number;
  reqStrMin?: number;
  reqStrMax?: number;
  tags?: string[];
  usedFor?: string;
}

export interface StartingPackagePreview {
  state: CharacterCreationState | null;
  errors: string[];
  backgroundName: string | null;
  startingSkills: Array<{ skill: string; level: number }>;
  expTotal: number;
  expUnspent: number;
  moneyGamels: number;
}

export interface PurchasePreview {
  state: CharacterCreationState | null;
  errors: string[];
  skills: Array<{ skill: string; level: number }>;
  expUnspent: number;
}

export interface EquipmentPreview {
  state: CharacterCreationState | null;
  errors: string[];
  moneyRemaining: number;
  totalCost: number;
}

export const backgroundOptions: BackgroundOption[] = sharedBackgroundOptions.map((option) => ({ ...option }));
export const skillOptions: SkillOption[] = characterCreationSkillOptions.map((option) => ({ ...option }));

export const starterEquipmentOptions: EquipmentOption[] = equipmentRoster.map((item) =>
  toEquipmentOption(item, 10)
);

const startingPackageTables = sharedStartingPackageTables as StartingPackageTables;

const itemCatalog: Record<string, ItemCatalogEntry> = Object.fromEntries(
  Object.values(equipmentRosterById).map((item) => [
    item.itemId,
    {
      category: item.category,
      cost_g: resolveEquipmentRosterItem(item.itemId, 10)?.costGamels ?? 0,
      req_str: resolveEquipmentRosterItem(item.itemId, 10)?.effectiveReqStr ?? 0,
      req_str_min: resolveEquipmentRosterItem(item.itemId, 10)?.reqStrMin ?? 0,
      req_str_max: resolveEquipmentRosterItem(item.itemId, 10)?.reqStrMax ?? null,
      price_spec: item.priceSpec,
      usage: item.usage,
      used_for: item.usedFor,
      tags: item.tags ?? [],
    },
  ])
);

export function computeStartingPackagePreview(input: {
  characterId: string;
  race: Race;
  raisedBy: HalfElfRaisedBy;
  subAbility: SubAbility;
  backgroundRoll2dTotal?: number;
  startingMoneyRoll2dTotal?: number;
  craftsmanSkill?: string;
  merchantScholarChoice?: 'MERCHANT' | 'SAGE';
  generalSkillName?: string;
}): StartingPackagePreview {
  const base = computeAbilitiesAndBonuses(
    createDraftState({
      characterId: input.characterId,
      race: input.race as CharacterCreationState['race'],
      raisedBy: input.race === 'HALF_ELF' ? input.raisedBy : null,
      subAbility: input.subAbility,
    })
  );

  if (base.errors.length > 0) {
    return {
      state: null,
      errors: base.errors.map((error) => error.message),
      backgroundName: null,
      startingSkills: [],
      expTotal: 0,
      expUnspent: 0,
      moneyGamels: 0,
    };
  }

  const applied = applyStartingPackage(
    base.state,
    {
      backgroundRoll2dTotal: input.backgroundRoll2dTotal,
      startingMoneyRoll2dTotal: input.startingMoneyRoll2dTotal,
      craftsmanSkill: input.craftsmanSkill,
      merchantScholarChoice: input.merchantScholarChoice,
      generalSkillName: input.generalSkillName,
    },
    startingPackageTables
  );

  if (applied.errors.length > 0) {
    return {
      state: null,
      errors: applied.errors.map((error) => error.message),
      backgroundName: null,
      startingSkills: [],
      expTotal: 0,
      expUnspent: 0,
      moneyGamels: 0,
    };
  }

  return {
    state: applied.state,
    errors: applied.errors.map((error) => error.message),
    backgroundName: applied.state.startingPackage?.backgroundName ?? null,
    startingSkills: applied.state.startingPackage?.startingSkills ?? [],
    expTotal: applied.state.startingPackage?.startingExpTotal ?? 0,
    expUnspent: applied.state.startingPackage?.expUnspent ?? 0,
    moneyGamels: applied.state.startingPackage?.startingMoneyGamels ?? 0,
  };
}

export function computeSkillPurchasePreview(
  startingState: CharacterCreationState | null,
  purchases: Array<{ skill: string; targetLevel: number }>
): PurchasePreview {
  if (!startingState) {
    return {
      state: null,
      errors: [],
      skills: [],
      expUnspent: 0,
    };
  }

  const spent = spendStartingExp(startingState, { purchases });
  if (spent.errors.length > 0) {
    return {
      state: null,
      errors: spent.errors.map((error) => error.message),
      skills: spent.state.skills,
      expUnspent: spent.state.startingPackage?.expUnspent ?? 0,
    };
  }
  return {
    state: spent.state,
    errors: spent.errors.map((error) => error.message),
    skills: spent.state.skills,
    expUnspent: spent.state.startingPackage?.expUnspent ?? 0,
  };
}

export function computeEquipmentPreview(
  state: CharacterCreationState | null,
  cart: EquipmentCart
): EquipmentPreview {
  if (!state) {
    return {
      state: null,
      errors: [],
      moneyRemaining: 0,
      totalCost: 0,
    };
  }

  const totalCost = [...cart.weapons, ...cart.armor, ...cart.shields, ...cart.gear].reduce((sum, itemId) => {
    const resolved = resolveEquipmentRosterItem(itemId, state.ability?.str ?? 0);
    return sum + Number(resolved?.costGamels ?? 0);
  }, 0);
  const purchased = purchaseEquipment(state, { cart }, itemCatalog);
  if (purchased.errors.length > 0) {
    return {
      state: null,
      errors: purchased.errors.map((error) => error.message),
      moneyRemaining: (state.startingPackage?.startingMoneyGamels ?? 0) - totalCost,
      totalCost,
    };
  }
  return {
    state: purchased.state,
    errors: purchased.errors.map((error) => error.message),
    moneyRemaining: (state.startingPackage?.startingMoneyGamels ?? 0) - totalCost,
    totalCost,
  };
}

export function getEquipmentOptionsForStrength(characterStrength: number): EquipmentOption[] {
  return equipmentRoster.map((item) => toEquipmentOption(item, characterStrength));
}

export function describeSkillLevelCosts(
  state: CharacterCreationState | null,
  skill: string,
  maxLevel: number
): SkillLevelCostDescriptor[] {
  return describeCharacterCreationSkillCosts(state?.skills, skill).filter((entry) => entry.level <= maxLevel);
}

export function roll2dTotal(rng: () => number = Math.random): number {
  return rollD6(rng) + rollD6(rng);
}

export function toSingleSelectCart(selection: {
  weapon: string;
  armor: string;
  shield: string;
}): EquipmentCart {
  return {
    weapons: selection.weapon ? [selection.weapon] : [],
    armor: selection.armor ? [selection.armor] : [],
    shields: selection.shield ? [selection.shield] : [],
    gear: [],
  };
}

function rollD6(rng: () => number): number {
  return Math.floor(rng() * 6) + 1;
}

function toEquipmentOption(item: EquipmentRosterItem, characterStrength: number): EquipmentOption {
  const resolved = resolveEquipmentRosterItem(item.itemId, characterStrength);
  return {
    itemId: item.itemId,
    label: item.label,
    category: item.category,
    group: item.group,
    usage: item.usage,
    costGamels: resolved?.costGamels ?? 0,
    priceLabel: resolved?.priceLabel ?? String(item.priceSpec),
    variablePrice: resolved?.variablePrice ?? false,
    canMeetRequiredStrength: resolved?.canMeetRequiredStrength ?? true,
    reqStr: resolved?.effectiveReqStr ?? 0,
    reqStrMin: resolved?.reqStrMin ?? 0,
    reqStrMax: resolved?.reqStrMax ?? undefined,
    tags: item.tags ?? [],
    usedFor: item.usedFor,
  };
}
