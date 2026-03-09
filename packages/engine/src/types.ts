import type { EngineErrorCode } from '@starter/shared';

export type RaceCode = 'HUMAN' | 'DWARF' | 'GRASSRUNNER' | 'ELF' | 'HALF_ELF';
export type RaisedBy = 'HUMANS' | 'ELVES' | null;
export type CharacterStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SkillLevel {
  skill: string;
  level: number;
}

export interface SubAbility {
  A: number;
  B: number;
  C: number;
  D: number;
  E: number;
  F: number;
  G: number;
  H: number;
}

export interface AbilityScores {
  dex: number;
  agi: number;
  int: number;
  str: number;
  lf: number;
  mp: number;
}

export interface StartingPackage {
  source: 'BACKGROUND_TABLE_1_5' | 'RACE_TABLE_1_6';
  backgroundName?: string;
  backgroundRoll2dTotal?: number;
  startingSkills: SkillLevel[];
  startingExpTotal: number;
  expUnspent: number;
  startingMoneyGamels: number;
  restrictions: string[];
}

export interface EquipmentCart {
  weapons: string[];
  armor: string[];
  shields: string[];
  gear: string[];
}

export interface CharacterCreationState {
  characterId: string;
  race?: RaceCode;
  raisedBy?: RaisedBy;
  subAbility?: SubAbility;
  ability?: AbilityScores;
  bonus?: AbilityScores;
  startingPackage?: StartingPackage;
  skills: SkillLevel[];
  identity?: {
    name?: string;
    age?: number | null;
    gender?: string | null;
  };
  equipmentCart?: EquipmentCart;
  status: CharacterStatus;
  completeness: boolean;
}

export interface EngineError {
  code: EngineErrorCode;
  message: string;
  details: Record<string, unknown> | null;
}

export interface EngineResult {
  state: CharacterCreationState;
  errors: EngineError[];
}

export interface BackgroundTableRow {
  name: string;
  starting_skills: SkillLevel[];
  starting_exp: number;
  money: string;
}

export interface RaceTableRow {
  pre_adventure_exp: number | string | Record<string, unknown>;
  money: string | Record<string, unknown>;
  starting_skills: SkillLevel[];
  restrictions: string[] | Record<string, string[]>;
}

export interface StartingPackageTables {
  backgroundsRows: Record<string, BackgroundTableRow>;
  raceRows: Record<string, RaceTableRow>;
}

export interface SpendPurchaseInput {
  skill: string;
  targetLevel: number;
  costExpOffered?: number;
}

export interface ItemCatalogEntry {
  category: string;
  cost_g?: number;
  req_str?: number;
  tags?: string[];
}

export interface FinalizeRequirements {
  requireIdentityName: boolean;
}
