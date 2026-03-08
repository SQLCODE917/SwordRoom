import { z } from 'zod';

export const COMMAND_TYPES = [
  'CreateCharacterDraft',
  'SetCharacterSubAbilities',
  'ApplyStartingPackage',
  'SpendStartingExp',
  'PurchaseStarterEquipment',
  'ConfirmCharacterAppearanceUpload',
  'SubmitCharacterForApproval',
  'GMReviewCharacter',
] as const;

export const commandTypeSchema = z.enum(COMMAND_TYPES);
export type CommandType = z.infer<typeof commandTypeSchema>;

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

export const submitCharacterForApprovalPayloadSchema = z.object({
  characterId: z.string(),
  noteToGm: z.string().optional(),
  identity: z
    .object({
      name: z.string(),
      age: z.number().nullable().optional(),
      gender: z.string().nullable().optional(),
    })
    .optional(),
});

export const gmReviewCharacterPayloadSchema = z.object({
  characterId: z.string(),
  decision: z.enum(['APPROVE', 'REJECT']),
  gmNote: z.string().optional(),
});

export const commandPayloadSchemaByType = {
  CreateCharacterDraft: createCharacterDraftPayloadSchema,
  SetCharacterSubAbilities: setCharacterSubAbilitiesPayloadSchema,
  ApplyStartingPackage: applyStartingPackagePayloadSchema,
  SpendStartingExp: spendStartingExpPayloadSchema,
  PurchaseStarterEquipment: purchaseStarterEquipmentPayloadSchema,
  ConfirmCharacterAppearanceUpload: confirmCharacterAppearanceUploadPayloadSchema,
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
  commandEnvelopeSchemaByType.CreateCharacterDraft,
  commandEnvelopeSchemaByType.SetCharacterSubAbilities,
  commandEnvelopeSchemaByType.ApplyStartingPackage,
  commandEnvelopeSchemaByType.SpendStartingExp,
  commandEnvelopeSchemaByType.PurchaseStarterEquipment,
  commandEnvelopeSchemaByType.ConfirmCharacterAppearanceUpload,
  commandEnvelopeSchemaByType.SubmitCharacterForApproval,
  commandEnvelopeSchemaByType.GMReviewCharacter,
]);

export type CreateCharacterDraftPayload = z.infer<typeof createCharacterDraftPayloadSchema>;
export type SetCharacterSubAbilitiesPayload = z.infer<typeof setCharacterSubAbilitiesPayloadSchema>;
export type ApplyStartingPackagePayload = z.infer<typeof applyStartingPackagePayloadSchema>;
export type SpendStartingExpPayload = z.infer<typeof spendStartingExpPayloadSchema>;
export type PurchaseStarterEquipmentPayload = z.infer<typeof purchaseStarterEquipmentPayloadSchema>;
export type ConfirmCharacterAppearanceUploadPayload = z.infer<typeof confirmCharacterAppearanceUploadPayloadSchema>;
export type SubmitCharacterForApprovalPayload = z.infer<typeof submitCharacterForApprovalPayloadSchema>;
export type GMReviewCharacterPayload = z.infer<typeof gmReviewCharacterPayloadSchema>;

export type CommandPayloadByType = {
  CreateCharacterDraft: CreateCharacterDraftPayload;
  SetCharacterSubAbilities: SetCharacterSubAbilitiesPayload;
  ApplyStartingPackage: ApplyStartingPackagePayload;
  SpendStartingExp: SpendStartingExpPayload;
  PurchaseStarterEquipment: PurchaseStarterEquipmentPayload;
  ConfirmCharacterAppearanceUpload: ConfirmCharacterAppearanceUploadPayload;
  SubmitCharacterForApproval: SubmitCharacterForApprovalPayload;
  GMReviewCharacter: GMReviewCharacterPayload;
};

export type CommandEnvelope<T extends CommandType = CommandType> = {
  [K in CommandType]: z.infer<(typeof commandEnvelopeSchemaByType)[K]>;
}[T];

export type AnyCommandEnvelope = z.infer<typeof anyCommandEnvelopeSchema>;
