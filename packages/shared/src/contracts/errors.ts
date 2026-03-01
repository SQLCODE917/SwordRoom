import { z } from 'zod';

export const ENGINE_ERROR_CODES = [
  'MISSING_RACE',
  'MISSING_RAISED_BY_FOR_HALF_ELF',
  'MISSING_SUBABILITY',
  'MISSING_BACKGROUND_ROLL',
  'GENERAL_SKILL_REQUIRES_GM_CHOICE',
  'EXP_INSUFFICIENT',
  'GENERAL_SKILL_NOT_ALLOWED_WITH_STARTING_EXP',
  'SORCERER_SAGE_BUNDLE_REQUIRED',
  'EQUIPMENT_RESTRICTED_BY_SKILL',
  'EQUIPMENT_REQ_STR_TOO_HIGH',
  'MISSING_REQUIRED_EQUIPMENT',
  'CHARACTER_NOT_COMPLETE',
] as const;

export const engineErrorCodeSchema = z.enum(ENGINE_ERROR_CODES);

export type EngineErrorCode = z.infer<typeof engineErrorCodeSchema>;

export const engineErrorSchema = z.object({
  code: engineErrorCodeSchema,
  message: z.string(),
  details: z.record(z.string(), z.unknown()).nullable(),
});

export type EngineError = z.infer<typeof engineErrorSchema>;
