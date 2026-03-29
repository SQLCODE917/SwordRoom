export const RACES = ['HUMAN', 'DWARF', 'GRASSRUNNER', 'ELF', 'HALF_ELF'] as const;
export type Race = (typeof RACES)[number];

export const HALF_ELF_RAISED_BY = ['HUMANS', 'ELVES'] as const;
export type HalfElfRaisedBy = (typeof HALF_ELF_RAISED_BY)[number];

export const SUB_ABILITY_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export type SubAbilityKey = (typeof SUB_ABILITY_KEYS)[number];
export type SubAbilityScores = Record<SubAbilityKey, number>;

export interface AbilityScores {
  dex: number;
  agi: number;
  int: number;
  str: number;
  lf: number;
  mp: number;
}

export interface DerivedAbilities {
  DEX: number;
  AGI: number;
  INT: number;
  STR: number;
  LF: number;
  MP: number;
}

export interface SkillLevelLike {
  skill: string;
  level: number;
}

export interface BackgroundRuleRow {
  roll: number;
  name: string;
  startingSkills: SkillLevelLike[];
  startingExp: number;
  moneyMultiplier: number;
}

export interface RaceStartingRuleRow {
  race: Race;
  startingSkills: SkillLevelLike[];
  startingExp: number;
  moneyMultiplier: number;
  restrictions: string[];
}

export interface CharacterCreationSkillOption {
  skill: string;
  label: string;
  maxLevel: number;
}

export interface SkillLevelCostDescriptor {
  level: number;
  costExp: number | null;
  note?: string;
}

export interface CharacterSheetFieldOrderEntry {
  step: number;
  label: string;
}

export interface AgeModifierProfile {
  humanEquivalentAge: number | null;
  physicalRetainedSixths: number;
  mentalRetainedSixths: number;
}

export type RoundingMode = 'UP' | 'DOWN';

export const HUMAN_ABILITY_SCORE_GUIDANCE = {
  min: 4,
  max: 24,
  average: 14,
} as const;

export const ABILITY_BONUS_TABLE = [
  { min: 2, max: 5, bonus: 0 },
  { min: 6, max: 11, bonus: 1 },
  { min: 12, max: 17, bonus: 2 },
  { min: 18, max: 23, bonus: 3 },
  { min: 24, max: 29, bonus: 4 },
] as const;

export const PLAYER_CHARACTER_ADVENTURER_SKILLS = [
  'Fighter',
  'Thief',
  'Ranger',
  'Sage',
  'Bard',
  'Sorcerer',
  'Shaman',
  'Priest',
] as const;

export const NON_PLAYER_ADVENTURER_SKILLS = ['Dark Priest', 'Dragon Priest'] as const;

export const ADVENTURER_SKILLS = [
  ...PLAYER_CHARACTER_ADVENTURER_SKILLS,
  ...NON_PLAYER_ADVENTURER_SKILLS,
] as const;

export const RUNE_MASTER_SKILLS = ['Sorcerer', 'Shaman', 'Priest'] as const;

export const GENERAL_SKILL_EXAMPLES = [
  'Merchant',
  'Farmer',
  'Fisher',
  'Sailor',
  'Craftsman',
  'King',
  'Princess',
] as const;

export const DWARF_CRAFTSMAN_SKILLS = [
  'Carpentry',
  'Smithing',
  'Woodworking',
  'Stonemasonry',
  'Gem Crafting',
] as const;

export const subAbilityRollFormulasByRace: Record<Race, Record<SubAbilityKey, string>> = {
  HUMAN: { A: '2D', B: '2D', C: '2D', D: '2D', E: '2D', F: '2D', G: '2D', H: '2D' },
  DWARF: { A: '2D+6', B: '1/2D', C: '1D+4', D: '1D', E: '1D+4', F: '1D+6', G: '2D+4', H: '2D+4' },
  GRASSRUNNER: { A: '1D+6', B: '2D+4', C: '1D+6', D: '1D', E: '1/2D', F: '1/2D', G: '2D+6', H: '2D+4' },
  ELF: { A: '1D+6', B: '1D+6', C: '1D+6', D: '1D+6', E: '1D', F: '1/2D', G: '1D+4', H: '1D+6' },
  HALF_ELF: { A: '1D+4', B: '1D+6', C: '1D+4', D: '1D+6', E: '1D+2', F: '1D+2', G: '1D+4', H: '2D' },
};

export const averageAbilityScoresByRace: Record<Race, DerivedAbilities> = {
  HUMAN: { DEX: 14, AGI: 14, INT: 14, STR: 14, LF: 14, MP: 14 },
  GRASSRUNNER: { DEX: 20.5, AGI: 20.5, INT: 13, STR: 4, LF: 15, MP: 24 },
  DWARF: { DEX: 15, AGI: 9.5, INT: 11, STR: 17, LF: 20.5, MP: 22 },
  ELF: { DEX: 19, AGI: 19, INT: 19, STR: 5.5, LF: 9.5, MP: 17 },
  HALF_ELF: { DEX: 17, AGI: 17, INT: 17, STR: 11, LF: 13, MP: 14.5 },
};

export const backgroundRules: BackgroundRuleRow[] = [
  {
    roll: 2,
    name: 'Savage',
    startingSkills: [
      { skill: 'Fighter', level: 1 },
      { skill: 'Ranger', level: 1 },
    ],
    startingExp: 2000,
    moneyMultiplier: 100,
  },
  {
    roll: 3,
    name: 'Rune Master',
    startingSkills: [
      { skill: 'Sorcerer', level: 1 },
      { skill: 'Sage', level: 1 },
    ],
    startingExp: 2000,
    moneyMultiplier: 200,
  },
  {
    roll: 4,
    name: 'Villain',
    startingSkills: [{ skill: 'Thief', level: 1 }],
    startingExp: 2500,
    moneyMultiplier: 200,
  },
  {
    roll: 5,
    name: 'Traveler',
    startingSkills: [{ skill: 'Bard', level: 1 }],
    startingExp: 3000,
    moneyMultiplier: 200,
  },
  {
    roll: 6,
    name: 'Hunter',
    startingSkills: [{ skill: 'Ranger', level: 1 }],
    startingExp: 3000,
    moneyMultiplier: 200,
  },
  {
    roll: 7,
    name: 'Ordinary Citizen',
    startingSkills: [{ skill: 'GeneralSkill_CHOSEN_BY_GM', level: 3 }],
    startingExp: 3000,
    moneyMultiplier: 200,
  },
  {
    roll: 8,
    name: 'Merchant/Scholar',
    startingSkills: [{ skill: 'Merchant_3_OR_Sage_1', level: 0 }],
    startingExp: 3000,
    moneyMultiplier: 200,
  },
  {
    roll: 9,
    name: 'Mercenary',
    startingSkills: [{ skill: 'Fighter', level: 1 }],
    startingExp: 2500,
    moneyMultiplier: 200,
  },
  {
    roll: 10,
    name: 'Priest',
    startingSkills: [{ skill: 'Priest', level: 1 }],
    startingExp: 2500,
    moneyMultiplier: 200,
  },
  {
    roll: 11,
    name: 'Curse Specialist',
    startingSkills: [{ skill: 'Shaman', level: 1 }],
    startingExp: 2000,
    moneyMultiplier: 200,
  },
  {
    roll: 12,
    name: 'Noble',
    startingSkills: [
      { skill: 'Fighter', level: 1 },
      { skill: 'Sage', level: 1 },
    ],
    startingExp: 2000,
    moneyMultiplier: 500,
  },
];

export const raceStartingRules: Record<Race, RaceStartingRuleRow | null> = {
  HUMAN: null,
  DWARF: {
    race: 'DWARF',
    startingSkills: [{ skill: 'CraftsmanSkill_CHOSEN', level: 5 }],
    startingExp: 3000,
    moneyMultiplier: 300,
    restrictions: ['Can see in the dark', 'Cannot acquire Sorcerer or Shaman'],
  },
  GRASSRUNNER: {
    race: 'GRASSRUNNER',
    startingSkills: [
      { skill: 'Thief', level: 1 },
      { skill: 'Ranger', level: 1 },
    ],
    startingExp: 3000,
    moneyMultiplier: 200,
    restrictions: ['Can communicate with plants and insects', 'Cannot acquire rune master skills'],
  },
  ELF: {
    race: 'ELF',
    startingSkills: [{ skill: 'Shaman', level: 1 }],
    startingExp: 2000,
    moneyMultiplier: 200,
    restrictions: ['Cannot acquire Priest'],
  },
  HALF_ELF: null,
};

export const raceCharacteristicNotes: Record<Race, readonly string[]> = {
  HUMAN: ['No race-based adventurer skill restrictions.'],
  DWARF: [
    'Can see in the dark.',
    'Has level 5 in one craftsman general skill.',
    'Unable to learn ancient magic or spirit magic.',
  ],
  GRASSRUNNER: [
    'Has Thief 1.',
    'Has Ranger 1.',
    'Can communicate with plants and insects.',
    'Cannot learn any runes.',
  ],
  ELF: ['Has Shaman 1.', 'Unable to learn holy magic.'],
  HALF_ELF: ['Raised-by-human and raised-by-elf paths use different creation restrictions.'],
};

export const backgroundsByRoll: Record<number, string> = Object.fromEntries(
  backgroundRules.map((row) => [
    row.roll,
    `${row.name} (${formatSkillList(row.startingSkills)}, EXP ${row.startingExp}, money 2D*${row.moneyMultiplier})`,
  ])
);

export const backgroundOptions = backgroundRules.map((row) => ({
  roll: row.roll,
  label: row.name,
}));

export const characterCreationSkillOptions: CharacterCreationSkillOption[] = [
  { skill: 'Fighter', label: 'Fighter', maxLevel: 2 },
  { skill: 'Thief', label: 'Thief', maxLevel: 2 },
  { skill: 'Ranger', label: 'Ranger', maxLevel: 3 },
  { skill: 'Sage', label: 'Sage', maxLevel: 3 },
  { skill: 'Bard', label: 'Bard', maxLevel: 3 },
  { skill: 'Priest', label: 'Priest', maxLevel: 2 },
  { skill: 'Shaman', label: 'Shaman', maxLevel: 2 },
  { skill: 'Sorcerer', label: 'Sorcerer', maxLevel: 1 },
];

export const characterSheetFieldOrder: CharacterSheetFieldOrderEntry[] = [
  { step: 1, label: 'Player Name' },
  { step: 2, label: 'Race' },
  { step: 3, label: 'Sub-Ability Scores' },
  { step: 4, label: 'Ability Scores' },
  { step: 5, label: 'Ability Bonuses' },
  { step: 6, label: 'Origin' },
  { step: 7, label: 'Starting Experience Points' },
  { step: 8, label: 'Starting Skills' },
  { step: 9, label: 'Money' },
  { step: 10, label: 'Gender' },
  { step: 11, label: 'Age' },
  { step: 12, label: 'Character Name' },
  { step: 13, label: 'Increase Skills' },
  { step: 14, label: 'Adventurer Level' },
  { step: 15, label: 'Purchase Equipment' },
];

export const humanAgeGuidance = {
  recommendedMin: 15,
  recommendedMax: 30,
  lifespan: 100,
  averageAlecrastLifespan: 50,
} as const;

export const adultRecognitionAges = {
  DWARF: 30,
  GRASSRUNNER: 40,
  ELF: 100,
  HALF_ELF: {
    HUMANS: 15,
    ELVES: 30,
  },
} as const;

export const genderRules = {
  mechanicalDifferences: false,
  supportedSexes: ['male', 'female'] as const,
} as const;

export const nameGuidance = {
  style: 'Alecrast names are usually western-style.',
  ordering: 'Usually first name then last name.',
  supportsFirstNameOnly: true,
  supportsAliases: true,
  disallowExamples: ['Purely Japanese names', 'Purely Chinese names'],
} as const;

const restrictedSkillsByRaceKey: Record<string, readonly string[]> = {
  HUMAN: [],
  DWARF: ['Sorcerer', 'Shaman'],
  GRASSRUNNER: [...RUNE_MASTER_SKILLS],
  ELF: ['Priest'],
  HALF_ELF_HUMANS: [],
  HALF_ELF_ELVES: ['Priest'],
};

const characterCreationSkillCosts: Record<string, Record<number, number>> = {
  fighter: { 1: 1000, 2: 1500 },
  thief: { 1: 1000, 2: 1500 },
  ranger: { 1: 500, 2: 1000, 3: 1500 },
  sage: { 1: 500, 2: 1000, 3: 1500 },
  bard: { 1: 500, 2: 1000, 3: 1500 },
  priest: { 1: 1000, 2: 1500 },
  shaman: { 1: 1500, 2: 2000 },
  sorcerer: { 1: 2000 },
};

export const startingPackageTables = {
  backgroundsRows: Object.fromEntries(
    backgroundRules.map((row) => [
      String(row.roll),
      {
        name: row.name,
        starting_skills: row.startingSkills.map((skill) => ({ ...skill })),
        starting_exp: row.startingExp,
        money: `2D*${row.moneyMultiplier}`,
      },
    ])
  ),
  raceRows: {
    HUMAN: {
      pre_adventure_exp: 'Same as Table 1-5',
      money: 'Same as Table 1-5',
      starting_skills: [],
      restrictions: [],
    },
    DWARF: {
      pre_adventure_exp: 3000,
      money: '2D*300',
      starting_skills: raceStartingRules.DWARF?.startingSkills.map((skill) => ({ ...skill })) ?? [],
      restrictions: [...(raceStartingRules.DWARF?.restrictions ?? [])],
    },
    GRASSRUNNER: {
      pre_adventure_exp: 3000,
      money: '2D*200',
      starting_skills: raceStartingRules.GRASSRUNNER?.startingSkills.map((skill) => ({ ...skill })) ?? [],
      restrictions: [...(raceStartingRules.GRASSRUNNER?.restrictions ?? [])],
    },
    ELF: {
      pre_adventure_exp: 2000,
      money: '2D*200',
      starting_skills: raceStartingRules.ELF?.startingSkills.map((skill) => ({ ...skill })) ?? [],
      restrictions: [...(raceStartingRules.ELF?.restrictions ?? [])],
    },
    HALF_ELF: {
      pre_adventure_exp: { raised_by_elves: 'Same as ELF', raised_by_humans: 'Same as HUMAN (Table 1-5)' },
      money: { raised_by_elves: 'Same as ELF', raised_by_humans: 'Same as HUMAN (Table 1-5)' },
      starting_skills: [],
      restrictions: { raised_by_elves: ['Cannot acquire Priest'], raised_by_humans: [] },
    },
  },
};

export function divideAndRound(value: number, divisor: number, mode: RoundingMode = 'UP'): number {
  if (mode === 'DOWN') {
    return Math.floor(value / divisor);
  }
  return Math.ceil(value / divisor);
}

export function rollFormula(formula: string, rng: () => number = Math.random): number {
  const normalized = formula.trim().toUpperCase();
  const match = normalized.match(/^(1\/2D|1D|2D)(?:\+(\d+))?$/);
  if (!match) {
    throw new Error(`unsupported roll formula: ${formula}`);
  }

  const base = match[1];
  const bonus = Number(match[2] ?? 0);

  if (base === '1/2D') {
    return divideAndRound(rollD6(rng), 2) + bonus;
  }

  const count = base === '2D' ? 2 : 1;
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    total += rollD6(rng);
  }
  return total + bonus;
}

export function rollSubAbilitiesForRace(race: Race, rng: () => number = Math.random): SubAbilityScores {
  const formulas = subAbilityRollFormulasByRace[race];
  return {
    A: rollFormula(formulas.A, rng),
    B: rollFormula(formulas.B, rng),
    C: rollFormula(formulas.C, rng),
    D: rollFormula(formulas.D, rng),
    E: rollFormula(formulas.E, rng),
    F: rollFormula(formulas.F, rng),
    G: rollFormula(formulas.G, rng),
    H: rollFormula(formulas.H, rng),
  };
}

export function computeAbilityScores(subAbility: SubAbilityScores): AbilityScores {
  return {
    dex: subAbility.A + subAbility.B,
    agi: subAbility.B + subAbility.C,
    int: subAbility.C + subAbility.D,
    str: subAbility.E + subAbility.F,
    lf: subAbility.F + subAbility.G,
    mp: subAbility.G + subAbility.H,
  };
}

export function computeDerivedAbilities(subAbility: SubAbilityScores): DerivedAbilities {
  const ability = computeAbilityScores(subAbility);
  return {
    DEX: ability.dex,
    AGI: ability.agi,
    INT: ability.int,
    STR: ability.str,
    LF: ability.lf,
    MP: ability.mp,
  };
}

export function computeAbilityBonus(score: number): number {
  return divideAndRound(score, 6, 'DOWN');
}

export function computeAbilityBonuses(ability: AbilityScores): AbilityScores {
  return {
    dex: computeAbilityBonus(ability.dex),
    agi: computeAbilityBonus(ability.agi),
    int: computeAbilityBonus(ability.int),
    str: computeAbilityBonus(ability.str),
    lf: computeAbilityBonus(ability.lf),
    mp: computeAbilityBonus(ability.mp),
  };
}

export function isAdventurerSkill(skill: string): boolean {
  return ADVENTURER_SKILLS.some((entry) => normalizeSkillName(entry) === normalizeSkillName(skill));
}

export function isPlayerCharacterAdventurerSkill(skill: string): boolean {
  return PLAYER_CHARACTER_ADVENTURER_SKILLS.some((entry) => normalizeSkillName(entry) === normalizeSkillName(skill));
}

export function isRuneMasterSkill(skill: string): boolean {
  return RUNE_MASTER_SKILLS.some((entry) => normalizeSkillName(entry) === normalizeSkillName(skill));
}

export function computeAdventurerLevel(skills: SkillLevelLike[]): number {
  let highest = 0;
  for (const skill of skills) {
    if (isAdventurerSkill(skill.skill)) {
      highest = Math.max(highest, skill.level);
    }
  }
  return highest;
}

export function resolveBackgroundEligibility(race: Race, raisedBy: HalfElfRaisedBy | null): boolean {
  return race === 'HUMAN' || (race === 'HALF_ELF' && raisedBy === 'HUMANS');
}

export function getRestrictedSkillsForRace(race: Race, raisedBy: HalfElfRaisedBy | null): string[] {
  if (race === 'HALF_ELF') {
    return [...(restrictedSkillsByRaceKey[`HALF_ELF_${raisedBy ?? 'HUMANS'}`] ?? [])];
  }
  return [...(restrictedSkillsByRaceKey[race] ?? [])];
}

export function canRaceAcquireSkill(race: Race, raisedBy: HalfElfRaisedBy | null, skill: string): boolean {
  return !getRestrictedSkillsForRace(race, raisedBy).some(
    (restricted) => normalizeSkillName(restricted) === normalizeSkillName(skill)
  );
}

export function getCharacterCreationSkillMaxLevel(skill: string): number | null {
  const option = characterCreationSkillOptions.find(
    (candidate) => normalizeSkillName(candidate.skill) === normalizeSkillName(skill)
  );
  return option?.maxLevel ?? null;
}

export function getCharacterCreationSkillCost(input: {
  skill: string;
  nextLevel: number;
  hasSage: boolean;
}): number | null {
  const normalizedSkill = normalizeSkillName(input.skill);
  if (normalizedSkill === 'sorcerer' && input.nextLevel === 1 && input.hasSage) {
    return 1500;
  }
  return characterCreationSkillCosts[normalizedSkill]?.[input.nextLevel] ?? null;
}

export function describeCharacterCreationSkillCosts(
  currentSkills: SkillLevelLike[] | null | undefined,
  skill: string
): SkillLevelCostDescriptor[] {
  const normalizedSkill = normalizeSkillName(skill);
  const maxLevel = getCharacterCreationSkillMaxLevel(skill) ?? 0;
  const baseLevel =
    currentSkills?.find((entry) => normalizeSkillName(entry.skill) === normalizedSkill)?.level ?? 0;
  const hasSorcerer =
    (currentSkills?.find((entry) => normalizeSkillName(entry.skill) === 'sorcerer')?.level ?? 0) > 0;
  const hasSage =
    (currentSkills?.find((entry) => normalizeSkillName(entry.skill) === 'sage')?.level ?? 0) > 0;

  return Array.from({ length: Math.max(0, maxLevel - baseLevel) }, (_, index) => {
    const level = baseLevel + index + 1;

    if (normalizedSkill === 'sorcerer' && level === 1 && !hasSorcerer && !hasSage) {
      return { level, costExp: 2000, note: 'bundle with Sage 1' };
    }

    if (normalizedSkill === 'sage' && level === 1 && !hasSorcerer && !hasSage) {
      return { level, costExp: 500, note: 'or 2000 total with Sorcerer 1 bundle' };
    }

    return {
      level,
      costExp: getCharacterCreationSkillCost({
        skill,
        nextLevel: level,
        hasSage,
      }),
    };
  });
}

export function resolveAgeModifierProfile(input: {
  race: Race;
  raisedBy?: HalfElfRaisedBy | null;
  age: number;
}): AgeModifierProfile {
  const humanEquivalentAge = resolveHumanEquivalentAge(input.race, input.raisedBy ?? null, input.age);
  if (humanEquivalentAge === null) {
    return {
      humanEquivalentAge: null,
      physicalRetainedSixths: 6,
      mentalRetainedSixths: 6,
    };
  }

  if (humanEquivalentAge >= 3 && humanEquivalentAge <= 5) {
    return { humanEquivalentAge, physicalRetainedSixths: 5, mentalRetainedSixths: 5 };
  }
  if (humanEquivalentAge >= 6 && humanEquivalentAge <= 8) {
    return { humanEquivalentAge, physicalRetainedSixths: 4, mentalRetainedSixths: 4 };
  }
  if (humanEquivalentAge >= 9 && humanEquivalentAge <= 10) {
    return { humanEquivalentAge, physicalRetainedSixths: 3, mentalRetainedSixths: 3 };
  }
  if (humanEquivalentAge >= 11 && humanEquivalentAge <= 12) {
    return { humanEquivalentAge, physicalRetainedSixths: 2, mentalRetainedSixths: 2 };
  }
  if (humanEquivalentAge >= 13 && humanEquivalentAge <= 14) {
    return { humanEquivalentAge, physicalRetainedSixths: 1, mentalRetainedSixths: 1 };
  }
  if (humanEquivalentAge >= 51 && humanEquivalentAge <= 60) {
    return { humanEquivalentAge, physicalRetainedSixths: 5, mentalRetainedSixths: 6 };
  }
  if (humanEquivalentAge >= 61 && humanEquivalentAge <= 70) {
    return { humanEquivalentAge, physicalRetainedSixths: 4, mentalRetainedSixths: 6 };
  }
  if (humanEquivalentAge >= 71 && humanEquivalentAge <= 80) {
    return { humanEquivalentAge, physicalRetainedSixths: 3, mentalRetainedSixths: 6 };
  }
  if (humanEquivalentAge >= 81 && humanEquivalentAge <= 90) {
    return { humanEquivalentAge, physicalRetainedSixths: 2, mentalRetainedSixths: 6 };
  }
  if (humanEquivalentAge >= 91) {
    return { humanEquivalentAge, physicalRetainedSixths: 1, mentalRetainedSixths: 6 };
  }

  return {
    humanEquivalentAge,
    physicalRetainedSixths: 6,
    mentalRetainedSixths: 6,
  };
}

export function applyAgeBasedAbilityAdjustments(
  ability: AbilityScores,
  input: {
    race: Race;
    raisedBy?: HalfElfRaisedBy | null;
    age: number;
  }
): AbilityScores {
  const profile = resolveAgeModifierProfile(input);
  return {
    dex: retainAbilitySixths(ability.dex, profile.physicalRetainedSixths),
    agi: retainAbilitySixths(ability.agi, profile.physicalRetainedSixths),
    int: retainAbilitySixths(ability.int, profile.mentalRetainedSixths),
    str: retainAbilitySixths(ability.str, profile.physicalRetainedSixths),
    lf: retainAbilitySixths(ability.lf, profile.physicalRetainedSixths),
    mp: retainAbilitySixths(ability.mp, profile.mentalRetainedSixths),
  };
}

function resolveHumanEquivalentAge(
  race: Race,
  raisedBy: HalfElfRaisedBy | null,
  age: number
): number | null {
  if (race === 'HUMAN') {
    return age;
  }

  if (race === 'ELF') {
    return age < adultRecognitionAges.ELF ? age : null;
  }

  const adulthood = resolveAdultRecognitionAge(race, raisedBy);
  if (age < adulthood) {
    return age;
  }

  return divideAndRound(age, 2);
}

function resolveAdultRecognitionAge(race: Race, raisedBy: HalfElfRaisedBy | null): number {
  if (race === 'DWARF') {
    return adultRecognitionAges.DWARF;
  }
  if (race === 'GRASSRUNNER') {
    return adultRecognitionAges.GRASSRUNNER;
  }
  if (race === 'ELF') {
    return adultRecognitionAges.ELF;
  }
  if (race === 'HALF_ELF') {
    return raisedBy === 'ELVES' ? adultRecognitionAges.HALF_ELF.ELVES : adultRecognitionAges.HALF_ELF.HUMANS;
  }
  return humanAgeGuidance.recommendedMin;
}

function retainAbilitySixths(score: number, retainedSixths: number): number {
  return divideAndRound(score * retainedSixths, 6);
}

function rollD6(rng: () => number): number {
  return Math.floor(rng() * 6) + 1;
}

function normalizeSkillName(skill: string): string {
  return skill.trim().toLowerCase();
}

function formatSkillList(skills: SkillLevelLike[]): string {
  return skills
    .map((skill) => {
      if (skill.skill === 'Merchant_3_OR_Sage_1') {
        return 'Merchant 3 / Sage 1';
      }
      if (skill.skill === 'GeneralSkill_CHOSEN_BY_GM') {
        return 'General skill 3 (GM choice)';
      }
      return `${skill.skill} ${skill.level}`;
    })
    .join(' + ');
}
