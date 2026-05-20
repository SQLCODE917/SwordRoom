import { z } from 'zod';

export const pregameRoleSchema = z.enum(['FRONTLINE', 'HEALER', 'SCOUT', 'ARCANE']);
export type PregameRole = z.infer<typeof pregameRoleSchema>;
export const sharedCharacterDraftIntentSchema = z.enum(['DRAFT_SNAPSHOT', 'ASK_QUESTION', 'COMPARE_DIRECTIONS', 'ANSWER_GM_PROMPT']);
export type SharedCharacterDraftIntent = z.infer<typeof sharedCharacterDraftIntentSchema>;

export const sharedCharacterDraftArtifactSchema = z.object({
  kind: z.literal('CHARACTER_DRAFT'),
  characterId: z.string(),
  snapshotVersion: z.number().int(),
  characterName: z.string().trim().min(1).max(120),
  race: z.string().trim().min(1).max(60),
  status: z.string().trim().min(1).max(40),
  shareIntent: sharedCharacterDraftIntentSchema.optional(),
  promptId: z.string().trim().min(1).max(120).optional(),
  contextNote: z.string().trim().min(1).max(280).optional(),
  abilitySummary: z.array(z.string().trim().min(1).max(40)).max(3),
  skillSummary: z.array(z.string().trim().min(1).max(60)).max(3),
});

export const sharedGamePromptArtifactSchema = z.object({
  kind: z.literal('GAME_PROMPT'),
  promptId: z.string(),
  title: z.string().trim().min(1).max(80),
  prompt: z.string().trim().min(1).max(280),
  suggestedRoles: z.array(pregameRoleSchema).max(4),
});

export const sharedPartyRoleClaimArtifactSchema = z.object({
  kind: z.literal('PARTY_ROLE_CLAIM'),
  claimId: z.string(),
  characterId: z.string(),
  snapshotVersion: z.number().int(),
  characterName: z.string().trim().min(1).max(120),
  roles: z.array(pregameRoleSchema).min(1).max(2),
  note: z.string().trim().min(1).max(160).optional(),
});

export const sharedChatArtifactSchema = z.discriminatedUnion('kind', [
  sharedCharacterDraftArtifactSchema,
  sharedGamePromptArtifactSchema,
  sharedPartyRoleClaimArtifactSchema,
]);

export type SharedCharacterDraftArtifact = z.infer<typeof sharedCharacterDraftArtifactSchema>;
export type SharedGamePromptArtifact = z.infer<typeof sharedGamePromptArtifactSchema>;
export type SharedPartyRoleClaimArtifact = z.infer<typeof sharedPartyRoleClaimArtifactSchema>;
export type SharedChatArtifact = z.infer<typeof sharedChatArtifactSchema>;
