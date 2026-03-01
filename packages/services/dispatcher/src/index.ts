import type { CommandEnvelope, CommandType } from '@starter/shared';

export type CommandHandler = (command: CommandEnvelope) => { ok: true };

const registeredTypes: ReadonlyArray<CommandType> = [
  'CreateCharacterDraft',
  'SetCharacterSubAbilities',
  'ApplyStartingPackage',
  'SpendStartingExp',
  'PurchaseStarterEquipment',
  'SubmitCharacterForApproval',
  'GMReviewCharacter',
];

export function listRegisteredCommandTypes(): ReadonlyArray<CommandType> {
  return registeredTypes;
}
