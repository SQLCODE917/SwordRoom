import { z } from 'zod';

export const COMMAND_TYPES = [
  'CreateGame',
  'SetGameVisibility',
  'InvitePlayerToGameByEmail',
  'AcceptGameInvite',
  'RejectGameInvite',
  'SaveCharacterDraft',
  'CreateCharacterDraft',
  'SetCharacterSubAbilities',
  'ApplyStartingPackage',
  'SpendStartingExp',
  'PurchaseStarterEquipment',
  'ConfirmCharacterAppearanceUpload',
  'DeleteCharacter',
  'SendGameChatMessage',
  'SubmitCharacterForApproval',
  'GMReviewCharacter',
] as const;

export const commandTypeSchema = z.enum(COMMAND_TYPES);
export type CommandType = z.infer<typeof commandTypeSchema>;

export const createGamePayloadSchema = z.object({
  name: z.string().min(1),
});

export const setGameVisibilityPayloadSchema = z.object({
  gameId: z.string(),
  expectedVersion: z.number().int(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']),
});

export const invitePlayerToGameByEmailPayloadSchema = z.object({
  gameId: z.string(),
  email: z.string().email(),
});

export const acceptGameInvitePayloadSchema = z.object({
  gameId: z.string(),
  inviteId: z.string(),
});

export const rejectGameInvitePayloadSchema = z.object({
  gameId: z.string(),
  inviteId: z.string(),
});

export const saveCharacterDraftPayloadSchema = z.object({
  characterId: z.string(),
  expectedVersion: z.number().int().nullable().optional(),
  race: z.string(),
  raisedBy: z.string().nullable().optional(),
  subAbility: z.object({
    A: z.number().int(),
    B: z.number().int(),
    C: z.number().int(),
    D: z.number().int(),
    E: z.number().int(),
    F: z.number().int(),
    G: z.number().int(),
    H: z.number().int(),
  }),
  backgroundRoll2dTotal: z.number().int().optional(),
  startingMoneyRoll2dTotal: z.number().int().optional(),
  craftsmanSkill: z.string().optional(),
  merchantScholarChoice: z.enum(['MERCHANT', 'SAGE']).optional(),
  generalSkillName: z.string().optional(),
  identity: z
    .object({
      name: z.string(),
      age: z.number().nullable().optional(),
      gender: z.string().nullable().optional(),
    }),
  purchases: z.array(
    z.object({
      skill: z.string(),
      targetLevel: z.number().int(),
    })
  ),
  cart: z.record(z.string(), z.unknown()),
  noteToGm: z.string().optional(),
});

export const createCharacterDraftPayloadSchema = z.object({
  characterId: z.string(),
  race: z.string(),
  raisedBy: z.string().nullable().optional(),
});

export const setCharacterSubAbilitiesPayloadSchema = z.object({
  characterId: z.string(),
  subAbility: z.object({
    A: z.number().int(),
    B: z.number().int(),
    C: z.number().int(),
    D: z.number().int(),
    E: z.number().int(),
    F: z.number().int(),
    G: z.number().int(),
    H: z.number().int(),
  }),
});

export const applyStartingPackagePayloadSchema = z.object({
  characterId: z.string(),
  backgroundRoll2d: z.number().int().optional(),
  backgroundRoll2dTotal: z.number().int().optional(),
  startingMoneyRoll2dTotal: z.number().int().optional(),
  useOrdinaryCitizenShortcut: z.boolean().optional(),
});

export const spendStartingExpPayloadSchema = z.object({
  characterId: z.string(),
  purchases: z.array(
    z.object({
      skill: z.string(),
      targetLevel: z.number().int(),
    })
  ),
});

export const purchaseStarterEquipmentPayloadSchema = z.object({
  characterId: z.string(),
  cart: z.record(z.string(), z.unknown()),
});

export const confirmCharacterAppearanceUploadPayloadSchema = z.object({
  characterId: z.string(),
  s3Key: z.string(),
});

export const deleteCharacterPayloadSchema = z.object({
  characterId: z.string(),
});

export const sendGameChatMessagePayloadSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});

export const submitCharacterForApprovalPayloadSchema = z.object({
  characterId: z.string(),
  expectedVersion: z.number().int(),
});

export const gmReviewCharacterPayloadSchema = z.object({
  characterId: z.string(),
  decision: z.enum(['APPROVE', 'REJECT']),
  gmNote: z.string().optional(),
});

export const commandPayloadSchemaByType = {
  CreateGame: createGamePayloadSchema,
  SetGameVisibility: setGameVisibilityPayloadSchema,
  InvitePlayerToGameByEmail: invitePlayerToGameByEmailPayloadSchema,
  AcceptGameInvite: acceptGameInvitePayloadSchema,
  RejectGameInvite: rejectGameInvitePayloadSchema,
  SaveCharacterDraft: saveCharacterDraftPayloadSchema,
  CreateCharacterDraft: createCharacterDraftPayloadSchema,
  SetCharacterSubAbilities: setCharacterSubAbilitiesPayloadSchema,
  ApplyStartingPackage: applyStartingPackagePayloadSchema,
  SpendStartingExp: spendStartingExpPayloadSchema,
  PurchaseStarterEquipment: purchaseStarterEquipmentPayloadSchema,
  ConfirmCharacterAppearanceUpload: confirmCharacterAppearanceUploadPayloadSchema,
  DeleteCharacter: deleteCharacterPayloadSchema,
  SendGameChatMessage: sendGameChatMessagePayloadSchema,
  SubmitCharacterForApproval: submitCharacterForApprovalPayloadSchema,
  GMReviewCharacter: gmReviewCharacterPayloadSchema,
} as const;

const commandEnvelopeBaseSchema = z.object({
  commandId: z.string().uuid(),
  gameId: z.string(),
  actorId: z.string(),
  schemaVersion: z.number().int(),
  createdAt: z.string(),
});

export const commandEnvelopeSchemaByType = {
  CreateGame: commandEnvelopeBaseSchema.extend({
    type: z.literal('CreateGame'),
    payload: createGamePayloadSchema,
  }),
  SetGameVisibility: commandEnvelopeBaseSchema.extend({
    type: z.literal('SetGameVisibility'),
    payload: setGameVisibilityPayloadSchema,
  }),
  InvitePlayerToGameByEmail: commandEnvelopeBaseSchema.extend({
    type: z.literal('InvitePlayerToGameByEmail'),
    payload: invitePlayerToGameByEmailPayloadSchema,
  }),
  AcceptGameInvite: commandEnvelopeBaseSchema.extend({
    type: z.literal('AcceptGameInvite'),
    payload: acceptGameInvitePayloadSchema,
  }),
  RejectGameInvite: commandEnvelopeBaseSchema.extend({
    type: z.literal('RejectGameInvite'),
    payload: rejectGameInvitePayloadSchema,
  }),
  SaveCharacterDraft: commandEnvelopeBaseSchema.extend({
    type: z.literal('SaveCharacterDraft'),
    payload: saveCharacterDraftPayloadSchema,
  }),
  CreateCharacterDraft: commandEnvelopeBaseSchema.extend({
    type: z.literal('CreateCharacterDraft'),
    payload: createCharacterDraftPayloadSchema,
  }),
  SetCharacterSubAbilities: commandEnvelopeBaseSchema.extend({
    type: z.literal('SetCharacterSubAbilities'),
    payload: setCharacterSubAbilitiesPayloadSchema,
  }),
  ApplyStartingPackage: commandEnvelopeBaseSchema.extend({
    type: z.literal('ApplyStartingPackage'),
    payload: applyStartingPackagePayloadSchema,
  }),
  SpendStartingExp: commandEnvelopeBaseSchema.extend({
    type: z.literal('SpendStartingExp'),
    payload: spendStartingExpPayloadSchema,
  }),
  PurchaseStarterEquipment: commandEnvelopeBaseSchema.extend({
    type: z.literal('PurchaseStarterEquipment'),
    payload: purchaseStarterEquipmentPayloadSchema,
  }),
  ConfirmCharacterAppearanceUpload: commandEnvelopeBaseSchema.extend({
    type: z.literal('ConfirmCharacterAppearanceUpload'),
    payload: confirmCharacterAppearanceUploadPayloadSchema,
  }),
  DeleteCharacter: commandEnvelopeBaseSchema.extend({
    type: z.literal('DeleteCharacter'),
    payload: deleteCharacterPayloadSchema,
  }),
  SendGameChatMessage: commandEnvelopeBaseSchema.extend({
    type: z.literal('SendGameChatMessage'),
    payload: sendGameChatMessagePayloadSchema,
  }),
  SubmitCharacterForApproval: commandEnvelopeBaseSchema.extend({
    type: z.literal('SubmitCharacterForApproval'),
    payload: submitCharacterForApprovalPayloadSchema,
  }),
  GMReviewCharacter: commandEnvelopeBaseSchema.extend({
    type: z.literal('GMReviewCharacter'),
    payload: gmReviewCharacterPayloadSchema,
  }),
} as const;

export const anyCommandEnvelopeSchema = z.discriminatedUnion('type', [
  commandEnvelopeSchemaByType.CreateGame,
  commandEnvelopeSchemaByType.SetGameVisibility,
  commandEnvelopeSchemaByType.InvitePlayerToGameByEmail,
  commandEnvelopeSchemaByType.AcceptGameInvite,
  commandEnvelopeSchemaByType.RejectGameInvite,
  commandEnvelopeSchemaByType.SaveCharacterDraft,
  commandEnvelopeSchemaByType.CreateCharacterDraft,
  commandEnvelopeSchemaByType.SetCharacterSubAbilities,
  commandEnvelopeSchemaByType.ApplyStartingPackage,
  commandEnvelopeSchemaByType.SpendStartingExp,
  commandEnvelopeSchemaByType.PurchaseStarterEquipment,
  commandEnvelopeSchemaByType.ConfirmCharacterAppearanceUpload,
  commandEnvelopeSchemaByType.DeleteCharacter,
  commandEnvelopeSchemaByType.SendGameChatMessage,
  commandEnvelopeSchemaByType.SubmitCharacterForApproval,
  commandEnvelopeSchemaByType.GMReviewCharacter,
]);

export type CreateGamePayload = z.infer<typeof createGamePayloadSchema>;
export type SetGameVisibilityPayload = z.infer<typeof setGameVisibilityPayloadSchema>;
export type InvitePlayerToGameByEmailPayload = z.infer<typeof invitePlayerToGameByEmailPayloadSchema>;
export type AcceptGameInvitePayload = z.infer<typeof acceptGameInvitePayloadSchema>;
export type RejectGameInvitePayload = z.infer<typeof rejectGameInvitePayloadSchema>;
export type CreateCharacterDraftPayload = z.infer<typeof createCharacterDraftPayloadSchema>;
export type SaveCharacterDraftPayload = z.infer<typeof saveCharacterDraftPayloadSchema>;
export type SetCharacterSubAbilitiesPayload = z.infer<typeof setCharacterSubAbilitiesPayloadSchema>;
export type ApplyStartingPackagePayload = z.infer<typeof applyStartingPackagePayloadSchema>;
export type SpendStartingExpPayload = z.infer<typeof spendStartingExpPayloadSchema>;
export type PurchaseStarterEquipmentPayload = z.infer<typeof purchaseStarterEquipmentPayloadSchema>;
export type ConfirmCharacterAppearanceUploadPayload = z.infer<typeof confirmCharacterAppearanceUploadPayloadSchema>;
export type DeleteCharacterPayload = z.infer<typeof deleteCharacterPayloadSchema>;
export type SendGameChatMessagePayload = z.infer<typeof sendGameChatMessagePayloadSchema>;
export type SubmitCharacterForApprovalPayload = z.infer<typeof submitCharacterForApprovalPayloadSchema>;
export type GMReviewCharacterPayload = z.infer<typeof gmReviewCharacterPayloadSchema>;

export type CommandPayloadByType = {
  CreateGame: CreateGamePayload;
  SetGameVisibility: SetGameVisibilityPayload;
  InvitePlayerToGameByEmail: InvitePlayerToGameByEmailPayload;
  AcceptGameInvite: AcceptGameInvitePayload;
  RejectGameInvite: RejectGameInvitePayload;
  SaveCharacterDraft: SaveCharacterDraftPayload;
  CreateCharacterDraft: CreateCharacterDraftPayload;
  SetCharacterSubAbilities: SetCharacterSubAbilitiesPayload;
  ApplyStartingPackage: ApplyStartingPackagePayload;
  SpendStartingExp: SpendStartingExpPayload;
  PurchaseStarterEquipment: PurchaseStarterEquipmentPayload;
  ConfirmCharacterAppearanceUpload: ConfirmCharacterAppearanceUploadPayload;
  DeleteCharacter: DeleteCharacterPayload;
  SendGameChatMessage: SendGameChatMessagePayload;
  SubmitCharacterForApproval: SubmitCharacterForApprovalPayload;
  GMReviewCharacter: GMReviewCharacterPayload;
};

export type CommandEnvelope<T extends CommandType = CommandType> = {
  [K in CommandType]: z.infer<(typeof commandEnvelopeSchemaByType)[K]>;
}[T];

export type AnyCommandEnvelope = z.infer<typeof anyCommandEnvelopeSchema>;
