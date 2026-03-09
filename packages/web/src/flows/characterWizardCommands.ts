import type { ApiClient, CommandEnvelopeInput, CommandType } from '../api/ApiClient';
import type { Race, SubAbilityScores } from '../data/characterCreationReference';

interface WizardCommandContext {
  api: ApiClient;
  gameId: string;
  characterId: string;
}

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
  subAbility: { A: 9, B: 8, C: 6, D: 7, E: 7, F: 12, G: 8, H: 6 },
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
    armor: ['cloth_armor'],
    shields: [],
    gear: [],
  },
  submitNoteToGm: 'Ready for review',
};

export async function submitCreateCharacterDraft(
  input: WizardCommandContext & { race: Race; raisedBy: 'HUMANS' | 'ELVES' }
): Promise<string> {
  const response = await input.api.postCommand({
    envelope: buildEnvelope(input.gameId, 'CreateCharacterDraft', {
      characterId: input.characterId,
      race: input.race,
      raisedBy: input.race === 'HALF_ELF' ? input.raisedBy : null,
    }),
  });
  return response.commandId;
}

export async function submitSaveCharacterDraft(
  input: WizardCommandContext & {
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
  }
): Promise<string> {
  const response = await input.api.postCommand({
    envelope: buildEnvelope(input.gameId, 'SaveCharacterDraft', {
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
    }),
  });
  return response.commandId;
}

export async function submitSetCharacterSubAbilities(
  input: WizardCommandContext & { subAbility: SubAbilityScores }
): Promise<string> {
  const response = await input.api.postCommand({
    envelope: buildEnvelope(input.gameId, 'SetCharacterSubAbilities', {
      characterId: input.characterId,
      subAbility: input.subAbility,
    }),
  });
  return response.commandId;
}

export async function submitApplyStartingPackage(
  input: WizardCommandContext & {
    backgroundRoll2dTotal: number;
    startingMoneyRoll2dTotal: number;
  }
): Promise<string> {
  const response = await input.api.postCommand({
    envelope: buildEnvelope(input.gameId, 'ApplyStartingPackage', {
      characterId: input.characterId,
      backgroundRoll2dTotal: input.backgroundRoll2dTotal,
      startingMoneyRoll2dTotal: input.startingMoneyRoll2dTotal,
    }),
  });
  return response.commandId;
}

export async function submitSpendStartingExp(
  input: WizardCommandContext & {
    purchases: Array<{ skill: string; targetLevel: number }>;
  }
): Promise<string> {
  const response = await input.api.postCommand({
    envelope: buildEnvelope(input.gameId, 'SpendStartingExp', {
      characterId: input.characterId,
      purchases: input.purchases,
    }),
  });
  return response.commandId;
}

export async function submitPurchaseStarterEquipment(
  input: WizardCommandContext & {
    cart: {
      weapons: string[];
      armor: string[];
      shields: string[];
      gear: string[];
    };
  }
): Promise<string> {
  const response = await input.api.postCommand({
    envelope: buildEnvelope(input.gameId, 'PurchaseStarterEquipment', {
      characterId: input.characterId,
      cart: input.cart,
    }),
  });
  return response.commandId;
}

export async function submitCharacterForApproval(
  input: WizardCommandContext & {
    expectedVersion: number;
  }
): Promise<string> {
  const response = await input.api.postCommand({
    envelope: buildEnvelope(input.gameId, 'SubmitCharacterForApproval', {
      characterId: input.characterId,
      expectedVersion: input.expectedVersion,
    }),
  });
  return response.commandId;
}

function buildEnvelope<T extends CommandType>(
  gameId: string,
  type: T,
  payload: CommandEnvelopeInput<T>['payload']
): CommandEnvelopeInput<T> {
  return {
    commandId: createCommandId(),
    gameId,
    type,
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    payload,
  } as CommandEnvelopeInput<T>;
}

function createCommandId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const nowHex = Date.now().toString(16).padStart(12, '0').slice(-12);
  return `00000000-0000-4000-8000-${nowHex}`;
}
