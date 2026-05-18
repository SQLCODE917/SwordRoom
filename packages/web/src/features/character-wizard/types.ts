import type { CharacterItem } from '../../api/ApiClient';
import type { HalfElfRaisedBy, Race, SubAbilityScores } from '../../data/characterCreationReference';

export interface CharacterSnapshot {
  status: string;
  version: number | null;
  subAbility: SubAbilityScores | null;
  ability: Record<string, number> | null;
  skills: Array<{ skill: string; level: number }>;
}

export interface WizardState {
  gameId: string;
  characterId: string;
  race: Race;
  raisedBy: HalfElfRaisedBy;
  subAbility: SubAbilityScores;
  backgroundRoll2dTotal: number;
  moneyRoll2dTotal: number;
  craftsmanSkill: string;
  merchantScholarChoice: '' | 'MERCHANT' | 'SAGE';
  generalSkillName: string;
  name: string;
  gender: string;
  age: string;
  purchases: Array<{ skill: string; targetLevel: number }>;
  equipment: {
    weaponQuantities: Record<string, number>;
    armorQuantities: Record<string, number>;
    shieldQuantities: Record<string, number>;
    gearQuantities: Record<string, number>;
  };
  submitNoteToGm: string;
}

export type WizardMode = 'apply' | 'library';
export type WizardStepKey = 'race' | 'dice' | 'background' | 'identity' | 'exp' | 'equipment' | 'submit';
export type SaveButtonState = 'idle' | 'saving' | 'saved';

export interface FieldOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type InventoryCategory = 'weapon' | 'armor' | 'shield' | 'gear';
export type InventoryQuantitiesKey = 'weaponQuantities' | 'armorQuantities' | 'shieldQuantities' | 'gearQuantities';

export type CharacterRecord = CharacterItem;
