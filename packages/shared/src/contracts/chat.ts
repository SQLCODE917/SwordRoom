import { z } from 'zod';

export const sharedCharacterDraftArtifactSchema = z.object({
  kind: z.literal('CHARACTER_DRAFT'),
  characterId: z.string(),
  snapshotVersion: z.number().int(),
  characterName: z.string().trim().min(1).max(120),
  race: z.string().trim().min(1).max(60),
  status: z.string().trim().min(1).max(40),
  abilitySummary: z.array(z.string().trim().min(1).max(40)).max(3),
  skillSummary: z.array(z.string().trim().min(1).max(60)).max(3),
});

export type SharedCharacterDraftArtifact = z.infer<typeof sharedCharacterDraftArtifactSchema>;
