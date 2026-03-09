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
import type { HalfElfRaisedBy, Race } from './characterCreationReference';

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
  category: 'weapon' | 'armor' | 'shield';
  costGamels: number;
  reqStr: number;
  reqStrMin?: number;
  reqStrMax?: number;
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

export interface SkillLevelCostDescriptor {
  level: number;
  costExp: number | null;
  note?: string;
}

export const backgroundOptions: BackgroundOption[] = [
  { roll: 2, label: 'Savage' },
  { roll: 3, label: 'Rune Master' },
  { roll: 4, label: 'Villain' },
  { roll: 5, label: 'Traveler' },
  { roll: 6, label: 'Hunter' },
  { roll: 7, label: 'Ordinary Citizen' },
  { roll: 8, label: 'Merchant / Scholar' },
  { roll: 9, label: 'Mercenary' },
  { roll: 10, label: 'Priest' },
  { roll: 11, label: 'Curse Specialist' },
  { roll: 12, label: 'Noble' },
];

export const skillOptions: SkillOption[] = [
  { skill: 'Fighter', label: 'Fighter', maxLevel: 3 },
  { skill: 'Thief', label: 'Thief', maxLevel: 2 },
  { skill: 'Ranger', label: 'Ranger', maxLevel: 1 },
  { skill: 'Priest', label: 'Priest', maxLevel: 1 },
  { skill: 'Sage', label: 'Sage', maxLevel: 1 },
  { skill: 'Bard', label: 'Bard', maxLevel: 1 },
  { skill: 'Shaman', label: 'Shaman', maxLevel: 1 },
  { skill: 'Sorcerer', label: 'Sorcerer', maxLevel: 2 },
];

export const starterEquipmentOptions: EquipmentOption[] = [
  { itemId: 'mage_staff', label: "Mage's Staff", category: 'weapon', costGamels: 200, reqStr: 0, reqStrMin: 1, reqStrMax: 10 },
  { itemId: 'broadsword', label: 'Broadsword', category: 'weapon', costGamels: 200, reqStr: 8, reqStrMin: 8, reqStrMax: 16 },
  { itemId: 'cloth_armor', label: 'Cloth Armor', category: 'armor', costGamels: 30, reqStr: 0 },
  { itemId: 'soft_leather_armor', label: 'Soft Leather Armor', category: 'armor', costGamels: 80, reqStr: 4 },
  { itemId: 'ring_mail', label: 'Ring Mail', category: 'armor', costGamels: 160, reqStr: 10 },
  { itemId: 'small_shield', label: 'Small Shield', category: 'shield', costGamels: 60, reqStr: 6 },
];

const startingPackageTables: StartingPackageTables = {
  backgroundsRows: {
    '2': {
      name: 'Savage',
      starting_skills: [
        { skill: 'Fighter', level: 1 },
        { skill: 'Ranger', level: 1 },
      ],
      starting_exp: 2000,
      money: '2D*100',
    },
    '3': {
      name: 'Rune Master',
      starting_skills: [
        { skill: 'Sorcerer', level: 1 },
        { skill: 'Sage', level: 1 },
      ],
      starting_exp: 2000,
      money: '2D*200',
    },
    '4': {
      name: 'Villain',
      starting_skills: [{ skill: 'Thief', level: 1 }],
      starting_exp: 2500,
      money: '2D*200',
    },
    '5': {
      name: 'Traveler',
      starting_skills: [{ skill: 'Bard', level: 1 }],
      starting_exp: 3000,
      money: '2D*200',
    },
    '6': {
      name: 'Hunter',
      starting_skills: [{ skill: 'Ranger', level: 1 }],
      starting_exp: 3000,
      money: '2D*200',
    },
    '7': {
      name: 'Ordinary Citizen',
      starting_skills: [{ skill: 'GeneralSkill_CHOSEN_BY_GM', level: 3 }],
      starting_exp: 3000,
      money: '2D*200',
    },
    '8': {
      name: 'Merchant / Scholar',
      starting_skills: [{ skill: 'Merchant_3_OR_Sage_1', level: 0 }],
      starting_exp: 3000,
      money: '2D*200',
    },
    '9': {
      name: 'Mercenary',
      starting_skills: [{ skill: 'Fighter', level: 1 }],
      starting_exp: 2500,
      money: '2D*200',
    },
    '10': {
      name: 'Priest',
      starting_skills: [{ skill: 'Priest', level: 1 }],
      starting_exp: 2500,
      money: '2D*200',
    },
    '11': {
      name: 'Curse Specialist',
      starting_skills: [{ skill: 'Shaman', level: 1 }],
      starting_exp: 2000,
      money: '2D*200',
    },
    '12': {
      name: 'Noble',
      starting_skills: [
        { skill: 'Fighter', level: 1 },
        { skill: 'Sage', level: 1 },
      ],
      starting_exp: 2000,
      money: '2D*500',
    },
  },
  raceRows: {
    DWARF: {
      pre_adventure_exp: 3000,
      money: '2D*300',
      starting_skills: [{ skill: 'CraftsmanSkill_CHOSEN', level: 5 }],
      restrictions: ['Can see in the dark', 'Cannot acquire Shaman or Sorcerer'],
    },
    GRASSRUNNER: {
      pre_adventure_exp: 3000,
      money: '2D*200',
      starting_skills: [
        { skill: 'Ranger', level: 1 },
        { skill: 'Thief', level: 1 },
      ],
      restrictions: ['Can communicate with plants and insects', 'Cannot acquire any Rune Master skills'],
    },
    ELF: {
      pre_adventure_exp: 2000,
      money: '2D*200',
      starting_skills: [{ skill: 'Shaman', level: 1 }],
      restrictions: ['Cannot acquire Priest'],
    },
    HALF_ELF: {
      pre_adventure_exp: { raised_by_elves: 'Same as ELF', raised_by_humans: 'Same as HUMAN (Table 1-5)' },
      money: { raised_by_elves: 'Same as ELF', raised_by_humans: 'Same as backgrounds (Table 1-5)' },
      starting_skills: [],
      restrictions: { raised_by_elves: ['Cannot acquire Priest'], raised_by_humans: [] },
    },
    HUMAN: {
      pre_adventure_exp: 'Same as backgrounds (Table 1-5)',
      money: 'Same as backgrounds',
      starting_skills: [],
      restrictions: [],
    },
  },
};

const itemCatalog: Record<string, ItemCatalogEntry> = {
  mage_staff: { category: 'weapon', cost_g: 200, req_str: 0, tags: ['SORCERER_REQUIRED'] },
  cloth_armor: { category: 'armor', cost_g: 30, req_str: 0, tags: ['LIGHT'] },
  soft_leather_armor: { category: 'armor', cost_g: 80, req_str: 4, tags: ['LIGHT'] },
  ring_mail: { category: 'armor', cost_g: 160, req_str: 10, tags: ['METAL_EXCEPTION_FOR_RANGER_THIEF'] },
  small_shield: { category: 'shield', cost_g: 60, req_str: 6, tags: [] },
  broadsword: { category: 'weapon', cost_g: 200, req_str: 8, tags: [] },
};

const creationSkillCosts: Record<string, Record<number, number>> = {
  fighter: { 1: 1500, 2: 1500, 3: 1500 },
  thief: { 1: 1000, 2: 1000 },
  ranger: { 1: 500 },
  priest: { 1: 1000 },
  sage: { 1: 1000 },
  bard: { 1: 500 },
  shaman: { 1: 1500 },
  sorcerer: { 1: 2000, 2: 2000 },
};

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

  const totalCost = [...cart.weapons, ...cart.armor, ...cart.shields, ...cart.gear].reduce(
    (sum, itemId) => sum + Number(itemCatalog[itemId]?.cost_g ?? 0),
    0
  );
  const purchased = purchaseEquipment(state, { cart }, itemCatalog);
  return {
    state: purchased.state,
    errors: purchased.errors.map((error) => error.message),
    moneyRemaining: (state.startingPackage?.startingMoneyGamels ?? 0) - totalCost,
    totalCost,
  };
}

export function describeSkillLevelCosts(
  state: CharacterCreationState | null,
  skill: string,
  maxLevel: number
): SkillLevelCostDescriptor[] {
  const normalizedSkill = normalizeSkillName(skill);
  const baseLevel = state?.skills.find((entry) => normalizeSkillName(entry.skill) === normalizedSkill)?.level ?? 0;
  const hasSorcerer = (state?.skills.find((entry) => normalizeSkillName(entry.skill) === 'sorcerer')?.level ?? 0) > 0;
  const hasSage = (state?.skills.find((entry) => normalizeSkillName(entry.skill) === 'sage')?.level ?? 0) > 0;

  return Array.from({ length: Math.max(0, maxLevel - baseLevel) }, (_, index) => {
    const level = baseLevel + index + 1;

    if (normalizedSkill === 'sorcerer' && level === 1 && !hasSorcerer && !hasSage) {
      return {
        level,
        costExp: 2000,
        note: 'bundle with Sage 1',
      };
    }

    if (normalizedSkill === 'sage' && level === 1 && !hasSorcerer && !hasSage) {
      return {
        level,
        costExp: 1000,
        note: 'or 2000 total with Sorcerer 1 bundle',
      };
    }

    return {
      level,
      costExp: creationSkillCosts[normalizedSkill]?.[level] ?? null,
    };
  });
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

function normalizeSkillName(skill: string): string {
  return skill.trim().toLowerCase();
}
