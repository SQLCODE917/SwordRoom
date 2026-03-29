import {
  canRaceAcquireSkill,
  computeAbilityBonuses,
  computeAbilityScores,
  divideAndRound,
  getCharacterCreationSkillCost,
  getCharacterCreationSkillMaxLevel,
  isPlayerCharacterAdventurerSkill,
  startingPackageTables as sharedStartingPackageTables,
} from '@starter/shared/rules/characterCreation';
import {
  isStrengthWithinRequiredRange,
  resolveEffectiveRequiredStrength,
  resolvePrice,
} from '@starter/shared/rules/equipmentRoster';
import type {
  AbilityScores,
  CharacterCreationState,
  EngineError,
  EngineResult,
  EquipmentCart,
  FinalizeRequirements,
  ItemCatalogEntry,
  SkillLevel,
  SpendPurchaseInput,
  StartingPackage,
  StartingPackageTables,
  SubAbility,
} from './types.js';

export type {
  AbilityScores,
  CharacterCreationState,
  EngineError,
  EngineResult,
  EquipmentCart,
  FinalizeRequirements,
  ItemCatalogEntry,
  SkillLevel,
  SpendPurchaseInput,
  StartingPackage,
  StartingPackageTables,
  SubAbility,
} from './types.js';
export * from './games.js';

export function createDraftState(input: {
  characterId: string;
  race?: CharacterCreationState['race'];
  raisedBy?: CharacterCreationState['raisedBy'];
  subAbility?: SubAbility;
  skills?: SkillLevel[];
  ability?: Partial<AbilityScores>;
  identity?: CharacterCreationState['identity'];
  startingPackage?: CharacterCreationState['startingPackage'];
}): CharacterCreationState {
  return {
    characterId: input.characterId,
    race: input.race,
    raisedBy: input.raisedBy,
    subAbility: input.subAbility,
    ability: input.ability ? { ...zeroAbility(), ...input.ability } : undefined,
    skills: input.skills ? [...input.skills] : [],
    identity: input.identity,
    startingPackage: input.startingPackage,
    status: 'DRAFT',
    completeness: false,
  };
}

export function computeAbilitiesAndBonuses(state: CharacterCreationState): EngineResult {
  if (!state.subAbility) {
    return withError(state, 'MISSING_SUBABILITY', 'subAbility is required', null);
  }

  const ability = computeAbilityScores(state.subAbility);
  const bonus = computeAbilityBonuses(ability);

  return {
    state: {
      ...state,
      ability,
      bonus,
    },
    errors: [],
  };
}

export function applyStartingPackage(
  state: CharacterCreationState,
  input: {
    backgroundRoll2dTotal?: number;
    startingMoneyRoll2dTotal?: number;
    useOrdinaryCitizenShortcut?: boolean;
    craftsmanSkill?: string;
    merchantScholarChoice?: 'MERCHANT' | 'SAGE';
    generalSkillName?: string;
  },
  tables: StartingPackageTables = sharedStartingPackageTables as StartingPackageTables
): EngineResult {
  if (!state.race) {
    return withError(state, 'MISSING_RACE', 'race is required', null);
  }
  if (state.race === 'HALF_ELF' && !state.raisedBy) {
    return withError(
      state,
      'MISSING_RAISED_BY_FOR_HALF_ELF',
      'raisedBy is required for half-elf characters',
      null
    );
  }

  const isHumanBackgroundPath =
    state.race === 'HUMAN' || (state.race === 'HALF_ELF' && state.raisedBy === 'HUMANS');

  if (isHumanBackgroundPath) {
    if (!input.backgroundRoll2dTotal && !input.useOrdinaryCitizenShortcut) {
      return withError(state, 'MISSING_BACKGROUND_ROLL', 'background roll is required', null);
    }

    const roll = input.useOrdinaryCitizenShortcut ? 7 : input.backgroundRoll2dTotal;
    const row = roll ? tables.backgroundsRows[String(roll)] : undefined;
    if (!row) {
      return withError(state, 'MISSING_BACKGROUND_ROLL', 'background roll table row not found', {
        roll2d: roll ?? null,
      });
    }

    const choiceError = validateStartingSkillChoices(state, row.starting_skills, {
      merchantScholarChoice: input.merchantScholarChoice,
      generalSkillName: input.generalSkillName,
    });
    if (choiceError) {
      return choiceError;
    }

    const moneyMultiplier = parseDiceMoneyMultiplier(row.money);
    const moneyGamels = (input.startingMoneyRoll2dTotal ?? 0) * moneyMultiplier;
    const startingSkills = resolveStartingSkills(row.starting_skills, {
      merchantScholarChoice: input.merchantScholarChoice,
      generalSkillName: input.generalSkillName,
    });

    const startingPackage: StartingPackage = {
      source: 'BACKGROUND_TABLE_1_5',
      backgroundName: row.name,
      backgroundRoll2dTotal: roll,
      startingSkills,
      startingExpTotal: row.starting_exp,
      expUnspent: row.starting_exp,
      startingMoneyGamels: moneyGamels,
      restrictions: [],
    };

    return {
      state: {
        ...state,
        startingPackage,
        skills: cloneSkills(startingSkills),
      },
      errors: [],
    };
  }

  const raceKey = resolveRaceTableKey(state);
  const row = raceKey ? tables.raceRows[raceKey] : undefined;
  if (row) {
    const missingCraftsmanChoice = row.starting_skills.some((skill) => skill.skill === 'CraftsmanSkill_CHOSEN');
    if (missingCraftsmanChoice && !input.craftsmanSkill?.trim()) {
      return withError(
        state,
        'MISSING_STARTING_PACKAGE_CHOICE',
        'dwarf starting package requires a craftsman skill choice',
        { required: 'craftsmanSkill' }
      );
    }

    const moneyMultiplier = parseDiceMoneyMultiplier(String(row.money));
    const moneyGamels = (input.startingMoneyRoll2dTotal ?? 0) * moneyMultiplier;

    const startingSkills = row.starting_skills.map((skill) => {
      if (skill.skill === 'CraftsmanSkill_CHOSEN') {
        return { skill: input.craftsmanSkill ?? skill.skill, level: skill.level };
      }
      return { ...skill };
    });

    const startingExpTotal = Number(row.pre_adventure_exp);
    const restrictions = Array.isArray(row.restrictions) ? [...row.restrictions] : [];

    const startingPackage: StartingPackage = {
      source: 'RACE_TABLE_1_6',
      startingSkills,
      startingExpTotal,
      expUnspent: startingExpTotal,
      startingMoneyGamels: moneyGamels,
      restrictions,
    };

    return {
      state: {
        ...state,
        startingPackage,
        skills: cloneSkills(startingSkills),
      },
      errors: [],
    };
  }

  return withError(state, 'MISSING_BACKGROUND_ROLL', 'unsupported race path for slice', {
    race: state.race,
  });
}

export function spendStartingExp(
  state: CharacterCreationState,
  input: { purchases: SpendPurchaseInput[] }
): EngineResult {
  if (state.race === 'HALF_ELF' && !state.raisedBy) {
    return withError(
      state,
      'MISSING_RAISED_BY_FOR_HALF_ELF',
      'raisedBy is required for half-elf characters',
      null
    );
  }

  const starting = state.startingPackage;
  if (!starting) {
    return withError(state, 'EXP_INSUFFICIENT', 'starting package is required', null);
  }

  const skillMap = new Map(state.skills.map((skill) => [normalizeSkillName(skill.skill), { ...skill }]));
  const hasSorcerer = (skillMap.get('sorcerer')?.level ?? 0) > 0;
  const hasSage = (skillMap.get('sage')?.level ?? 0) > 0;

  const targetBySkill = new Map<string, number>();
  for (const purchase of input.purchases) {
    const normalized = normalizeSkillName(purchase.skill);
    if (!isPlayerCharacterAdventurerSkill(purchase.skill)) {
      return withError(state, 'GENERAL_SKILL_NOT_ALLOWED_WITH_STARTING_EXP', 'skill cannot be purchased at creation', {
        skill: purchase.skill,
      });
    }
    if (
      state.race &&
      !canRaceAcquireSkill(state.race, state.raisedBy ?? null, purchase.skill)
    ) {
      return withError(state, 'SKILL_RESTRICTED_BY_RACE', 'race cannot acquire this skill during character creation', {
        race: state.race,
        raisedBy: state.raisedBy ?? null,
        skill: purchase.skill,
      });
    }
    const maxLevel = getCharacterCreationSkillMaxLevel(purchase.skill);
    if (maxLevel === null || purchase.targetLevel > maxLevel) {
      return withError(
        state,
        'GENERAL_SKILL_NOT_ALLOWED_WITH_STARTING_EXP',
        'skill level cannot be purchased at creation',
        { skill: purchase.skill, targetLevel: purchase.targetLevel, maxLevel }
      );
    }
    const currentTarget = targetBySkill.get(normalized) ?? 0;
    targetBySkill.set(normalized, Math.max(currentTarget, purchase.targetLevel));
  }

  const buysSorcerer = (targetBySkill.get('sorcerer') ?? 0) >= 1;
  const buysSage = (targetBySkill.get('sage') ?? 0) >= 1;

  if (!hasSorcerer && !hasSage && buysSorcerer && !buysSage) {
    return withError(
      state,
      'SORCERER_SAGE_BUNDLE_REQUIRED',
      'must buy Sorcerer + Sage bundle when neither skill exists',
      null
    );
  }

  let totalCost = 0;
  const usesSorcererSageBundle = !hasSorcerer && !hasSage && buysSorcerer && buysSage;
  if (usesSorcererSageBundle) {
    totalCost += 2000;
  }

  for (const [normalized, targetLevel] of targetBySkill.entries()) {
    const current = skillMap.get(normalized)?.level ?? 0;

    for (let nextLevel = current + 1; nextLevel <= targetLevel; nextLevel += 1) {
      if (usesSorcererSageBundle && nextLevel === 1 && (normalized === 'sorcerer' || normalized === 'sage')) {
        continue;
      }

      const cost = getCharacterCreationSkillCost({
        skill: normalized,
        nextLevel,
        hasSage,
      });
      if (cost === null) {
        return withError(
          state,
          'GENERAL_SKILL_NOT_ALLOWED_WITH_STARTING_EXP',
          'skill level cannot be purchased at creation',
          { skill: normalized, nextLevel }
        );
      }
      totalCost += cost;
    }
  }

  if (totalCost > starting.expUnspent) {
    return withError(state, 'EXP_INSUFFICIENT', 'not enough starting EXP', {
      totalCost,
      expUnspent: starting.expUnspent,
    });
  }

  for (const [normalized, targetLevel] of targetBySkill.entries()) {
    const existing = skillMap.get(normalized);
    if (existing) {
      existing.level = Math.max(existing.level, targetLevel);
    } else {
      skillMap.set(normalized, { skill: toDisplaySkillName(normalized), level: targetLevel });
    }
  }

  const nextSkills = [...skillMap.values()];
  const expUnspent = starting.expUnspent - totalCost;

  return {
    state: {
      ...state,
      skills: nextSkills,
      startingPackage: {
        ...starting,
        expUnspent,
      },
    },
    errors: [],
  };
}

export function purchaseEquipment(
  state: CharacterCreationState,
  input: { cart: EquipmentCart },
  catalog: Record<string, ItemCatalogEntry>
): EngineResult {
  const charStr = state.ability?.str ?? 0;
  const errors: EngineError[] = [];

  const allItemIds = [...input.cart.weapons, ...input.cart.armor, ...input.cart.shields, ...input.cart.gear];
  const totalCost = allItemIds.reduce((sum, itemId) => {
    const item = catalog[itemId];
    if (!item) {
      return sum;
    }
    return sum + resolveCatalogItemCost(item, charStr);
  }, 0);
  const moneyAvailable = state.startingPackage?.startingMoneyGamels ?? 0;

  for (const itemId of allItemIds) {
    const item = catalog[itemId];
    if (!item) {
      continue;
    }

    if (!isCatalogStrengthWithinRange(item, charStr)) {
      errors.push({
        code: 'EQUIPMENT_RESTRICTED_BY_SKILL',
        message: 'item required strength range must include character STR',
        details: { reason: 'REQ_STR_RANGE_MISMATCH', itemId, charStr },
      });
      continue;
    }

    const reqStr = resolveCatalogRequiredStrength(item, charStr);
    if (reqStr > charStr) {
      errors.push({
        code: 'EQUIPMENT_REQ_STR_TOO_HIGH',
        message: 'item required strength is higher than character STR',
        details: { itemId, reqStr, charStr },
      });
    }
  }

  const variablePriceItem = allItemIds.find((itemId) => isVariablePriceItem(catalog[itemId], charStr));
  if (variablePriceItem) {
    errors.push({
      code: 'EQUIPMENT_RESTRICTED_BY_SKILL',
      message: 'variable-price equipment cannot be auto-purchased during character creation',
      details: { reason: 'VARIABLE_PRICE_ITEM_NOT_SUPPORTED_IN_CREATION', itemId: variablePriceItem },
    });
  }

  if (totalCost > moneyAvailable) {
    errors.push({
      code: 'INSUFFICIENT_STARTING_MONEY',
      message: 'equipment total cost exceeds available starting money',
      details: { totalCost, moneyAvailable },
    });
  }

  const hasSorcerer = state.skills.some((skill) => normalizeSkillName(skill.skill) === 'sorcerer');
  const hasShaman = state.skills.some((skill) => normalizeSkillName(skill.skill) === 'shaman');
  const hasThief = state.skills.some((skill) => normalizeSkillName(skill.skill) === 'thief');
  const hasRanger = state.skills.some((skill) => normalizeSkillName(skill.skill) === 'ranger');
  const thiefArmorLimit = divideAndRound(charStr, 2);

  if (hasSorcerer) {
    if (input.cart.shields.length > 0) {
      errors.push({
        code: 'EQUIPMENT_RESTRICTED_BY_SKILL',
        message: 'sorcerer cannot use shield',
        details: { reason: 'SORCERER_FORBIDS_SHIELD' },
      });
    }

    if (!input.cart.weapons.includes('mage_staff')) {
      errors.push({
        code: 'MISSING_REQUIRED_EQUIPMENT',
        message: 'sorcerer requires mage_staff',
        details: { required: ['mage_staff'] },
      });
    }

    const invalidArmor = input.cart.armor.find((itemId) => !hasAnyTag(catalog[itemId], ['LIGHT']));
    if (invalidArmor) {
      errors.push({
        code: 'EQUIPMENT_RESTRICTED_BY_SKILL',
        message: 'sorcerer armor must be cloth or soft leather',
        details: { reason: 'SORCERER_ARMOR_RESTRICTED', itemId: invalidArmor },
      });
    }
  }

  if (hasShaman && input.cart.shields.length > 0) {
    errors.push({
      code: 'EQUIPMENT_RESTRICTED_BY_SKILL',
      message: 'shaman cannot use shield',
      details: { reason: 'SHAMAN_FORBIDS_SHIELD' },
    });
  }

  if (hasShaman) {
    const invalidArmor = input.cart.armor.find((itemId) => !hasAnyTag(catalog[itemId], ['SHAMAN_ARMOR_OK']));
    if (invalidArmor) {
      errors.push({
        code: 'EQUIPMENT_RESTRICTED_BY_SKILL',
        message: 'shaman armor must be cloth, soft leather, or hard leather',
        details: { reason: 'SHAMAN_ARMOR_RESTRICTED', itemId: invalidArmor },
      });
    }
  }

  if (hasRanger || hasThief) {
    const invalidArmor = input.cart.armor.find((itemId) => {
      const item = catalog[itemId];
      const isRingMail = hasAnyTag(item, ['METAL_EXCEPTION_FOR_RANGER_THIEF']);
      const isMetal = hasAnyTag(item, ['METAL']);
      if (isMetal && !isRingMail) {
        return true;
      }
      return false;
    });

    if (invalidArmor) {
      errors.push({
        code: 'EQUIPMENT_RESTRICTED_BY_SKILL',
        message: 'ranger or thief cannot use this armor',
        details: { reason: 'RANGER_THIEF_ARMOR_RESTRICTED', itemId: invalidArmor },
      });
    }
  }

  if (hasRanger) {
    const heavyArmor = input.cart.armor.find((itemId) => resolveCatalogRequiredStrength(catalog[itemId], charStr) > thiefArmorLimit);
    if (heavyArmor) {
      errors.push({
        code: 'EQUIPMENT_RESTRICTED_BY_SKILL',
        message: 'ranger armor must be at most half STR',
        details: { reason: 'RANGER_ARMOR_REQ_STR_TOO_HIGH', itemId: heavyArmor, reqStr: resolveCatalogRequiredStrength(catalog[heavyArmor], charStr), charStr },
      });
    }
  }

  if (hasThief) {
    const heavyWeapon = input.cart.weapons.find((itemId) => resolveCatalogRequiredStrength(catalog[itemId], charStr) > thiefArmorLimit);
    if (heavyWeapon) {
      errors.push({
        code: 'EQUIPMENT_RESTRICTED_BY_SKILL',
        message: 'thief weapon must be at most half STR',
        details: { reason: 'THIEF_WEAPON_REQ_STR_TOO_HIGH', itemId: heavyWeapon, reqStr: resolveCatalogRequiredStrength(catalog[heavyWeapon], charStr), charStr },
      });
    }

    const heavyArmor = input.cart.armor.find((itemId) => resolveCatalogRequiredStrength(catalog[itemId], charStr) > thiefArmorLimit);
    if (heavyArmor) {
      errors.push({
        code: 'EQUIPMENT_RESTRICTED_BY_SKILL',
        message: 'thief armor must be at most half STR',
        details: { reason: 'THIEF_ARMOR_REQ_STR_TOO_HIGH', itemId: heavyArmor, reqStr: resolveCatalogRequiredStrength(catalog[heavyArmor], charStr), charStr },
      });
    }
  }

  if (errors.length > 0) {
    return { state, errors };
  }

  return {
    state: {
      ...state,
      equipmentCart: {
        weapons: [...input.cart.weapons],
        armor: [...input.cart.armor],
        shields: [...input.cart.shields],
        gear: [...input.cart.gear],
      },
    },
    errors: [],
  };
}

export function finalizeCharacter(
  state: CharacterCreationState,
  requirements: FinalizeRequirements = { requireIdentityName: true }
): EngineResult {
  const isComplete = Boolean(
    state.race &&
      state.ability &&
      state.bonus &&
      state.startingPackage &&
      (!requirements.requireIdentityName || state.identity?.name)
  );

  if (!isComplete) {
    return withError(state, 'CHARACTER_NOT_COMPLETE', 'character is not complete', null);
  }

  return {
    state: {
      ...state,
      completeness: true,
    },
    errors: [],
  };
}

export function submitForApproval(state: CharacterCreationState): EngineResult {
  const finalized = finalizeCharacter(state);
  if (finalized.errors.length > 0) {
    return finalized;
  }

  return {
    state: {
      ...finalized.state,
      status: 'PENDING',
    },
    errors: [],
  };
}

function withError(
  state: CharacterCreationState,
  code: EngineError['code'],
  message: string,
  details: Record<string, unknown> | null
): EngineResult {
  return {
    state,
    errors: [{ code, message, details }],
  };
}

function parseDiceMoneyMultiplier(formula: string): number {
  const match = formula.match(/^2D\*(\d+)$/i);
  if (!match) {
    return 0;
  }
  return Number(match[1]);
}

function normalizeSkillName(skill: string): string {
  return skill.trim().toLowerCase();
}

function cloneSkills(skills: SkillLevel[]): SkillLevel[] {
  return skills.map((skill) => ({ ...skill }));
}

function resolveRaceTableKey(state: CharacterCreationState): string | null {
  if (state.race === 'HALF_ELF' && state.raisedBy === 'ELVES') {
    return 'ELF';
  }
  if (state.race === 'HALF_ELF' && state.raisedBy === 'HUMANS') {
    return null;
  }
  return state.race ?? null;
}

function resolveStartingSkills(
  skills: SkillLevel[],
  input: {
    merchantScholarChoice?: 'MERCHANT' | 'SAGE';
    generalSkillName?: string;
  }
): SkillLevel[] {
  return skills.map((item) => {
    if (item.skill === 'Merchant_3_OR_Sage_1') {
      return input.merchantScholarChoice === 'MERCHANT'
        ? { skill: 'Merchant', level: 3 }
        : { skill: 'Sage', level: 1 };
    }
    if (item.skill === 'GeneralSkill_CHOSEN_BY_GM') {
      return { skill: input.generalSkillName?.trim() || 'GeneralSkill_CHOSEN_BY_GM', level: item.level };
    }
    return { ...item };
  });
}

function validateStartingSkillChoices(
  state: CharacterCreationState,
  skills: SkillLevel[],
  input: {
    merchantScholarChoice?: 'MERCHANT' | 'SAGE';
    generalSkillName?: string;
  }
): EngineResult | null {
  if (skills.some((item) => item.skill === 'Merchant_3_OR_Sage_1') && !input.merchantScholarChoice) {
    return withError(
      state,
      'MISSING_STARTING_PACKAGE_CHOICE',
      'merchant/scholar background requires choosing Merchant or Sage',
      { required: 'merchantScholarChoice' }
    );
  }

  if (skills.some((item) => item.skill === 'GeneralSkill_CHOSEN_BY_GM') && !input.generalSkillName?.trim()) {
    return withError(
      state,
      'GENERAL_SKILL_REQUIRES_GM_CHOICE',
      'ordinary citizen background requires a GM-approved general skill name',
      { required: 'generalSkillName' }
    );
  }

  return null;
}

function toDisplaySkillName(normalizedSkill: string): string {
  return normalizedSkill.slice(0, 1).toUpperCase() + normalizedSkill.slice(1);
}

function hasAnyTag(item: ItemCatalogEntry | undefined, tags: string[]): boolean {
  const itemTags = item?.tags ?? [];
  return itemTags.some((tag) => tags.includes(String(tag)));
}

function resolveCatalogRequiredStrength(item: ItemCatalogEntry | undefined, characterStrength: number): number {
  if (!item) {
    return 0;
  }
  if (typeof item.req_str === 'number' && item.req_str_min === undefined) {
    return item.req_str;
  }
  return resolveEffectiveRequiredStrength(
    item.req_str_min !== undefined
      ? item.req_str_max === null || item.req_str_max === undefined
        ? `${item.req_str_min}~`
        : `${item.req_str_min}~${item.req_str_max}`
      : item.req_str ?? 0,
    characterStrength
  );
}

function resolveCatalogItemCost(item: ItemCatalogEntry, characterStrength: number): number {
  if (typeof item.cost_g === 'number' && item.price_spec === undefined) {
    return item.cost_g;
  }
  const effectiveRequiredStrength = resolveCatalogRequiredStrength(item, characterStrength);
  return resolvePrice(item.price_spec ?? item.cost_g ?? 0, effectiveRequiredStrength).costGamels;
}

function isVariablePriceItem(item: ItemCatalogEntry | undefined, characterStrength: number): boolean {
  if (!item) {
    return false;
  }
  return resolvePrice(item.price_spec ?? item.cost_g ?? 0, resolveCatalogRequiredStrength(item, characterStrength)).variablePrice;
}

function isCatalogStrengthWithinRange(item: ItemCatalogEntry | undefined, characterStrength: number): boolean {
  if (!item) {
    return true;
  }
  if (typeof item.req_str === 'number' && item.req_str_min === undefined && item.req_str_max === undefined) {
    return true;
  }
  const requiredStrength =
    item.req_str_min !== undefined
      ? item.req_str_max === null || item.req_str_max === undefined
        ? `${item.req_str_min}~`
        : `${item.req_str_min}~${item.req_str_max}`
      : item.req_str ?? 0;
  return isStrengthWithinRequiredRange(requiredStrength, characterStrength);
}

function zeroAbility(): AbilityScores {
  return { dex: 0, agi: 0, int: 0, str: 0, lf: 0, mp: 0 };
}
