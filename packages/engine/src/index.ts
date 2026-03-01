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

  const sub = state.subAbility;
  const ability: AbilityScores = {
    dex: sub.A + sub.B,
    agi: sub.B + sub.C,
    int: sub.C + sub.D,
    str: sub.E + sub.F,
    lf: sub.F + sub.G,
    mp: sub.G + sub.H,
  };

  const bonus: AbilityScores = {
    dex: Math.floor(ability.dex / 6),
    agi: Math.floor(ability.agi / 6),
    int: Math.floor(ability.int / 6),
    str: Math.floor(ability.str / 6),
    lf: Math.floor(ability.lf / 6),
    mp: Math.floor(ability.mp / 6),
  };

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
  },
  tables: StartingPackageTables
): EngineResult {
  if (!state.race) {
    return withError(state, 'MISSING_RACE', 'race is required', null);
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

    const moneyMultiplier = parseDiceMoneyMultiplier(row.money);
    const moneyGamels = (input.startingMoneyRoll2dTotal ?? 0) * moneyMultiplier;

    const startingPackage: StartingPackage = {
      source: 'BACKGROUND_TABLE_1_5',
      backgroundName: row.name,
      backgroundRoll2dTotal: roll,
      startingSkills: row.starting_skills.map((item) => ({ ...item })),
      startingExpTotal: row.starting_exp,
      expUnspent: row.starting_exp,
      startingMoneyGamels: moneyGamels,
      restrictions: [],
    };

    return {
      state: {
        ...state,
        startingPackage,
        skills: cloneSkills(startingPackage.startingSkills),
      },
      errors: [],
    };
  }

  if (state.race === 'DWARF') {
    const row = tables.raceRows.DWARF;
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
  const starting = state.startingPackage;
  if (!starting) {
    return withError(state, 'EXP_INSUFFICIENT', 'starting package is required', null);
  }

  const skillMap = new Map(state.skills.map((skill) => [normalizeSkillName(skill.skill), { ...skill }]));
  const hasSorcerer = (skillMap.get('sorcerer')?.level ?? 0) > 0;
  const hasSage = (skillMap.get('sage')?.level ?? 0) > 0;

  const buysSorcerer = input.purchases.some(
    (purchase) => normalizeSkillName(purchase.skill) === 'sorcerer' && purchase.targetLevel >= 1
  );
  const buysSage = input.purchases.some(
    (purchase) => normalizeSkillName(purchase.skill) === 'sage' && purchase.targetLevel >= 1
  );

  if (!hasSorcerer && !hasSage && buysSorcerer && !buysSage) {
    return withError(
      state,
      'SORCERER_SAGE_BUNDLE_REQUIRED',
      'must buy Sorcerer + Sage bundle when neither skill exists',
      null
    );
  }

  let totalCost = 0;

  for (const purchase of input.purchases) {
    const normalized = normalizeSkillName(purchase.skill);
    const current = skillMap.get(normalized)?.level ?? 0;

    for (let nextLevel = current + 1; nextLevel <= purchase.targetLevel; nextLevel += 1) {
      totalCost += expCostForLevel(nextLevel);
    }
  }

  if (totalCost > starting.expUnspent) {
    return withError(state, 'EXP_INSUFFICIENT', 'not enough starting EXP', {
      totalCost,
      expUnspent: starting.expUnspent,
    });
  }

  for (const purchase of input.purchases) {
    const normalized = normalizeSkillName(purchase.skill);
    const existing = skillMap.get(normalized);
    if (existing) {
      existing.level = Math.max(existing.level, purchase.targetLevel);
    } else {
      skillMap.set(normalized, { skill: purchase.skill, level: purchase.targetLevel });
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

  const allItemIds = [...input.cart.weapons, ...input.cart.armor, ...input.cart.shields];

  for (const itemId of allItemIds) {
    const item = catalog[itemId];
    if (!item) {
      continue;
    }

    const reqStr = item.req_str ?? 0;
    if (reqStr > charStr) {
      errors.push({
        code: 'EQUIPMENT_REQ_STR_TOO_HIGH',
        message: 'item required strength is higher than character STR',
        details: { itemId, reqStr, charStr },
      });
    }
  }

  const hasSorcerer = state.skills.some((skill) => normalizeSkillName(skill.skill) === 'sorcerer');
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

function expCostForLevel(level: number): number {
  return level * 500;
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

function zeroAbility(): AbilityScores {
  return { dex: 0, agi: 0, int: 0, str: 0, lf: 0, mp: 0 };
}
