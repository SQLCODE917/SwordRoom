import type { CommandEnvelopeInput } from '../../api/ApiClient';
import type { SharedCharacterDraftArtifact } from '@starter/shared';
import { createCommandId } from '../../hooks/useCommandStatus';
import type { Race, SubAbilityScores } from '../../data/characterCreationReference';

export interface WizardAutofillValues {
  race: Race;
  raisedBy: 'HUMANS' | 'ELVES';
  subAbility: SubAbilityScores;
  backgroundRoll2dTotal: number;
  startingMoneyRoll2dTotal: number;
  identity: {
    name: string;
    age: string;
    gender: string;
  };
  purchases: Array<{ skill: string; targetLevel: number }>;
  cart: {
    weapons: string[];
    armor: string[];
    shields: string[];
    gear: string[];
  };
  submitNoteToGm: string;
}

export const goodHumanRuneMasterAutofill: WizardAutofillValues = {
  race: 'HUMAN',
  raisedBy: 'HUMANS',
  subAbility: { A: 6, B: 4, C: 5, D: 4, E: 4, F: 6, G: 4, H: 5 },
  backgroundRoll2dTotal: 3,
  startingMoneyRoll2dTotal: 9,
  identity: {
    name: 'Ducard Sample II',
    age: '24',
    gender: 'M',
  },
  purchases: [{ skill: 'Fighter', targetLevel: 1 }],
  cart: {
    weapons: ['mage_staff'],
    armor: [],
    shields: [],
    gear: [],
  },
  submitNoteToGm: 'Ready for review',
};

export function buildSaveCharacterDraftEnvelope(input: {
  gameId: string;
  characterId: string;
  expectedVersion?: number | null;
  race: Race;
  raisedBy: 'HUMANS' | 'ELVES';
  subAbility: SubAbilityScores;
  backgroundRoll2dTotal?: number;
  startingMoneyRoll2dTotal?: number;
  craftsmanSkill?: string;
  merchantScholarChoice?: 'MERCHANT' | 'SAGE';
  generalSkillName?: string;
  identity: {
    name: string;
    age: number | null;
    gender: string | null;
  };
  purchases: Array<{ skill: string; targetLevel: number }>;
  cart: {
    weapons: string[];
    armor: string[];
    shields: string[];
    gear: string[];
  };
  noteToGm?: string;
}): CommandEnvelopeInput<'SaveCharacterDraft'> {
  return {
    commandId: createCommandId(),
    gameId: input.gameId,
    type: 'SaveCharacterDraft',
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    payload: {
      characterId: input.characterId,
      expectedVersion: input.expectedVersion ?? null,
      race: input.race,
      raisedBy: input.race === 'HALF_ELF' ? input.raisedBy : null,
      subAbility: input.subAbility,
      backgroundRoll2dTotal: input.backgroundRoll2dTotal,
      startingMoneyRoll2dTotal: input.startingMoneyRoll2dTotal,
      craftsmanSkill: input.craftsmanSkill,
      merchantScholarChoice: input.merchantScholarChoice,
      generalSkillName: input.generalSkillName,
      identity: input.identity,
      purchases: input.purchases,
      cart: input.cart,
      noteToGm: input.noteToGm,
    },
  };
}

export function buildSubmitCharacterForApprovalEnvelope(input: {
  gameId: string;
  characterId: string;
  expectedVersion: number;
}): CommandEnvelopeInput<'SubmitCharacterForApproval'> {
  return {
    commandId: createCommandId(),
    gameId: input.gameId,
    type: 'SubmitCharacterForApproval',
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    payload: {
      characterId: input.characterId,
      expectedVersion: input.expectedVersion,
    },
  };
}

export function buildShareCharacterDraftEnvelope(input: {
  gameId: string;
  body: string;
  artifact: SharedCharacterDraftArtifact;
}): CommandEnvelopeInput<'SendGameChatMessage'> {
  return {
    commandId: createCommandId(),
    gameId: input.gameId,
    type: 'SendGameChatMessage',
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    payload: {
      body: input.body,
      artifact: input.artifact,
    },
  };
}
