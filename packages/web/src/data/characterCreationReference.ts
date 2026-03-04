export const RACES = ['HUMAN', 'DWARF', 'GRASSRUNNER', 'ELF', 'HALF_ELF'] as const;
export type Race = (typeof RACES)[number];

export const HALF_ELF_RAISED_BY = ['HUMANS', 'ELVES'] as const;
export type HalfElfRaisedBy = (typeof HALF_ELF_RAISED_BY)[number];

export const SUB_ABILITY_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export type SubAbilityKey = (typeof SUB_ABILITY_KEYS)[number];
export type SubAbilityScores = Record<SubAbilityKey, number>;

export const subAbilityRollFormulasByRace: Record<Race, Record<SubAbilityKey, string>> = {
  HUMAN: { A: '2D', B: '2D', C: '2D', D: '2D', E: '2D', F: '2D', G: '2D', H: '2D' },
  DWARF: { A: '2D+6', B: '1/2D', C: '1D+4', D: '1D', E: '1D+4', F: '1D+6', G: '2D+4', H: '2D+4' },
  GRASSRUNNER: { A: '1D+6', B: '2D+4', C: '1D+6', D: '1D', E: '1/2D', F: '1/2D', G: '2D+6', H: '2D+4' },
  ELF: { A: '1D+6', B: '1D+6', C: '1D+6', D: '1D+6', E: '1D', F: '1/2D', G: '1D+4', H: '1D+6' },
  HALF_ELF: { A: '1D+4', B: '1D+6', C: '1D+4', D: '1D+6', E: '1D+2', F: '1D+2', G: '1D+4', H: '2D' },
};

export interface DerivedAbilities {
  DEX: number;
  AGI: number;
  INT: number;
  STR: number;
  LF: number;
  MP: number;
}

export function computeDerivedAbilities(subAbility: SubAbilityScores): DerivedAbilities {
  return {
    DEX: subAbility.A + subAbility.B,
    AGI: subAbility.B + subAbility.C,
    INT: subAbility.C + subAbility.D,
    STR: subAbility.E + subAbility.F,
    LF: subAbility.F + subAbility.G,
    MP: subAbility.G + subAbility.H,
  };
}

export function computeAbilityBonus(ability: number): number {
  return Math.floor(ability / 6);
}

export const backgroundsByRoll: Record<number, string> = {
  2: 'Savage (Fighter 1 + Ranger 1, EXP 2000, money 2D*100)',
  3: 'Rune Master (Sorcerer 1 + Sage 1, EXP 2000, money 2D*200)',
  4: 'Villain (Thief 1, EXP 2500, money 2D*200)',
  5: 'Traveler (Bard 1, EXP 3000, money 2D*200)',
  6: 'Hunter (Ranger 1, EXP 3000, money 2D*200)',
  7: 'Ordinary citizen (General skill by GM 3, EXP 3000, money 2D*200)',
  8: 'Merchant/Scholar (Merchant 3 OR Sage 1, EXP 3000, money 2D*200)',
  9: 'Mercenary (Fighter 1, EXP 2500, money 2D*200)',
  10: 'Priest (Priest 1, EXP 2500, money 2D*200)',
  11: 'Curse Specialist (Shaman 1, EXP 2000, money 2D*200)',
  12: 'Noble (Fighter 1 + Sage 1, EXP 2000, money 2D*500)',
};

export function resolveBackgroundEligibility(race: Race, raisedBy: HalfElfRaisedBy): boolean {
  return race === 'HUMAN' || (race === 'HALF_ELF' && raisedBy === 'HUMANS');
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

export function rollFormula(formula: string, rng: () => number = Math.random): number {
  const normalized = formula.trim().toUpperCase();
  const match = normalized.match(/^(1\/2D|1D|2D)(?:\+(\d+))?$/);
  if (!match) {
    throw new Error(`unsupported roll formula: ${formula}`);
  }

  const base = match[1];
  const bonus = Number(match[2] ?? 0);

  if (base === '1/2D') {
    return Math.ceil(rollD6(rng) / 2) + bonus;
  }

  const diceCount = base === '2D' ? 2 : 1;
  let total = 0;
  for (let i = 0; i < diceCount; i += 1) {
    total += rollD6(rng);
  }
  return total + bonus;
}

function rollD6(rng: () => number): number {
  return Math.floor(rng() * 6) + 1;
}
