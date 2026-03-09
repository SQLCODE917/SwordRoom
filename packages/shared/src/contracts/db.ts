import { z } from 'zod';

export const characterStatusSchema = z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED']);
export const commandStatusSchema = z.enum(['ACCEPTED', 'PROCESSING', 'PROCESSED', 'FAILED']);
export const characterRaceSchema = z.enum(['HUMAN', 'DWARF', 'GRASSRUNNER', 'ELF', 'HALF_ELF']);
export const raisedBySchema = z.enum(['HUMANS', 'ELVES']).nullable();

export type CharacterStatus = z.infer<typeof characterStatusSchema>;
export type CommandStatus = z.infer<typeof commandStatusSchema>;
export type CharacterRace = z.infer<typeof characterRaceSchema>;
export type RaisedBy = z.infer<typeof raisedBySchema>;

export type PkSk = { pk: string; sk: string };

export const gameStateKeys = {
  gameMetadata: (gameId: string): PkSk => ({ pk: `GAME#${gameId}`, sk: 'METADATA' }),
  character: (gameId: string, characterId: string): PkSk => ({
    pk: `GAME#${gameId}`,
    sk: `CHAR#${characterId}`,
  }),
  gmInboxItem: (gameId: string, submittedAtIso: string, characterId: string): PkSk => ({
    pk: `GM#${gameId}`,
    sk: `PENDING_CHAR#${submittedAtIso}#${characterId}`,
  }),
  playerProfile: (playerId: string): PkSk => ({ pk: `PLAYER#${playerId}`, sk: 'PROFILE' }),
  playerInboxItem: (playerId: string, createdAtIso: string, promptId: string): PkSk => ({
    pk: `PLAYER#${playerId}`,
    sk: `INBOX#${createdAtIso}#${promptId}`,
  }),
};

export const commandLogKeys = {
  command: (commandId: string): PkSk => ({ pk: `COMMAND#${commandId}`, sk: 'METADATA' }),
};

const pkSkSchema = z.object({ pk: z.string(), sk: z.string() });

export const skillLevelSchema = z.object({
  skill: z.string(),
  level: z.number().int(),
});

export const subAbilitySchema = z.object({
  A: z.number(),
  B: z.number(),
  C: z.number(),
  D: z.number(),
  E: z.number(),
  F: z.number(),
  G: z.number(),
  H: z.number(),
});

export const abilitySchema = z.object({
  dex: z.number(),
  agi: z.number(),
  int: z.number(),
  str: z.number(),
  lf: z.number(),
  mp: z.number(),
});

const purchasedItemSchema = z.object({
  itemId: z.string(),
  reqStr: z.number(),
  costGamels: z.number(),
});

const purchasedGearSchema = z.object({
  itemId: z.string(),
  qty: z.number(),
  costGamels: z.number(),
});

export const characterDraftSchema = z.object({
  race: characterRaceSchema,
  raisedBy: raisedBySchema,
  subAbility: subAbilitySchema,
  ability: abilitySchema,
  bonus: abilitySchema,
  background: z.object({
    kind: z
      .enum([
        'SAVAGE',
        'RUNE_MASTER',
        'VILLAIN',
        'TRAVELER',
        'HUNTER',
        'ORDINARY_CITIZEN',
        'MERCHANT',
        'SCHOLAR',
        'MERCENARY',
        'PRIEST',
        'CURSE_SPECIALIST',
        'NOBLE',
      ])
      .nullable(),
    roll2d: z.number().nullable(),
  }),
  starting: z.object({
    expTotal: z.number(),
    expUnspent: z.number(),
    moneyGamels: z.number(),
    moneyRoll2d: z.number().nullable(),
    startingSkills: z.array(skillLevelSchema),
  }),
  skills: z.array(skillLevelSchema),
  purchases: z.object({
    weapons: z.array(purchasedItemSchema),
    armor: z.array(purchasedItemSchema),
    shields: z.array(purchasedItemSchema),
    gear: z.array(purchasedGearSchema),
  }),
  appearance: z
    .object({
      imageKey: z.string().nullable(),
      imageUrl: z.string().nullable(),
      updatedAt: z.string().nullable(),
    })
    .optional(),
  identity: z.object({
    name: z.string(),
    age: z.number().nullable(),
    gender: z.string().nullable(),
  }),
  noteToGm: z.string().nullable().optional(),
  gmNote: z.string().nullable(),
});

export const gameMetadataItemSchema = pkSkSchema.extend({
  type: z.literal('GameMetadata'),
  gameId: z.string(),
  gmPlayerId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int(),
});

export const playerProfileItemSchema = pkSkSchema.extend({
  type: z.literal('PlayerProfile'),
  playerId: z.string(),
  displayName: z.string(),
  roles: z.array(z.enum(['PLAYER', 'GM'])),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const characterItemSchema = pkSkSchema.extend({
  type: z.literal('Character'),
  characterId: z.string(),
  gameId: z.string(),
  ownerPlayerId: z.string(),
  status: characterStatusSchema,
  draft: characterDraftSchema,
  submittedAt: z.string().nullable().optional(),
  submittedDraftVersion: z.number().int().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int(),
});

export const gmInboxItemSchema = pkSkSchema.extend({
  type: z.literal('GMInboxItem'),
  gameId: z.string(),
  characterId: z.string(),
  ownerPlayerId: z.string(),
  status: z.literal('PENDING'),
  submittedAt: z.string(),
});

export const playerInboxItemSchema = pkSkSchema.extend({
  type: z.literal('PlayerInboxItem'),
  promptId: z.string(),
  gameId: z.string(),
  kind: z.enum(['CHAR_SUBMITTED', 'CHAR_APPROVED', 'CHAR_REJECTED', 'ACTION_REQUIRED']),
  ref: z.object({
    characterId: z.string().nullable(),
    commandId: z.string().nullable(),
  }),
  message: z.string(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
});

export const commandLogItemSchema = pkSkSchema.extend({
  type: z.literal('Command'),
  commandType: z.string(),
  commandId: z.string(),
  gameId: z.string(),
  actorId: z.string(),
  status: commandStatusSchema,
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  idempotencyKey: z.string(),
  resultRef: z.object({
    characterId: z.string().nullable(),
  }),
});

export const gameStateItemSchema = z.discriminatedUnion('type', [
  gameMetadataItemSchema,
  playerProfileItemSchema,
  characterItemSchema,
  gmInboxItemSchema,
  playerInboxItemSchema,
]);

export type GameMetadataItem = z.infer<typeof gameMetadataItemSchema>;
export type PlayerProfileItem = z.infer<typeof playerProfileItemSchema>;
export type SkillLevel = z.infer<typeof skillLevelSchema>;
export type SubAbility = z.infer<typeof subAbilitySchema>;
export type Ability = z.infer<typeof abilitySchema>;
export type CharacterDraft = z.infer<typeof characterDraftSchema>;
export type CharacterItem = z.infer<typeof characterItemSchema>;
export type GMInboxItem = z.infer<typeof gmInboxItemSchema>;
export type PlayerInboxItem = z.infer<typeof playerInboxItemSchema>;
export type CommandLogItem = z.infer<typeof commandLogItemSchema>;
export type GameStateItem = z.infer<typeof gameStateItemSchema>;
