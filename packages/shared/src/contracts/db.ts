import { z } from 'zod';

export const characterStatusSchema = z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED']);
export const commandStatusSchema = z.enum(['ACCEPTED', 'PROCESSING', 'PROCESSED', 'FAILED']);
export const characterRaceSchema = z.enum(['HUMAN', 'DWARF', 'GRASSRUNNER', 'ELF', 'HALF_ELF']);
export const raisedBySchema = z.enum(['HUMANS', 'ELVES']).nullable();
export const gameVisibilitySchema = z.enum(['PUBLIC', 'PRIVATE']);
export const gameLifecycleStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);
export const playerRoleSchema = z.enum(['PLAYER', 'GM', 'ADMIN']);
export const platformRoleSchema = z.enum(['ADMIN']);
export const gameInviteStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED']);
export const gameChatSenderRoleSchema = z.enum(['PLAYER', 'GM']);

export type CharacterStatus = z.infer<typeof characterStatusSchema>;
export type CommandStatus = z.infer<typeof commandStatusSchema>;
export type CharacterRace = z.infer<typeof characterRaceSchema>;
export type RaisedBy = z.infer<typeof raisedBySchema>;
export type GameVisibility = z.infer<typeof gameVisibilitySchema>;
export type GameLifecycleStatus = z.infer<typeof gameLifecycleStatusSchema>;
export type PlayerRole = z.infer<typeof playerRoleSchema>;
export type PlatformRole = z.infer<typeof platformRoleSchema>;
export type GameInviteStatus = z.infer<typeof gameInviteStatusSchema>;
export type GameChatSenderRole = z.infer<typeof gameChatSenderRoleSchema>;

export type PkSk = { pk: string; sk: string };
export const PLAYER_CHARACTER_LIBRARY_PREFIX = 'PLAYER_CHARACTER_LIBRARY::';

export function toPlayerCharacterLibraryGameId(playerId: string): string {
  return `${PLAYER_CHARACTER_LIBRARY_PREFIX}${playerId}`;
}

export function isPlayerCharacterLibraryGameId(gameId: string): boolean {
  return gameId.startsWith(PLAYER_CHARACTER_LIBRARY_PREFIX);
}

export function getPlayerIdFromCharacterLibraryGameId(gameId: string): string | null {
  if (!isPlayerCharacterLibraryGameId(gameId)) {
    return null;
  }
  return gameId.slice(PLAYER_CHARACTER_LIBRARY_PREFIX.length) || null;
}

export const gameStateKeys = {
  gameMetadata: (gameId: string): PkSk => ({ pk: `GAME#${gameId}`, sk: 'METADATA' }),
  character: (gameId: string, characterId: string): PkSk => ({
    pk: `GAME#${gameId}`,
    sk: `CHAR#${characterId}`,
  }),
  gameMember: (gameId: string, playerId: string): PkSk => ({
    pk: `GAME#${gameId}`,
    sk: `MEMBER#${playerId}`,
  }),
  gameInvite: (gameId: string, inviteId: string): PkSk => ({
    pk: `GAME#${gameId}`,
    sk: `INVITE#${inviteId}`,
  }),
  gameChatMessage: (gameId: string, createdAtIso: string, messageId: string): PkSk => ({
    pk: `GAME#${gameId}`,
    sk: `CHAT#${createdAtIso}#${messageId}`,
  }),
  gmInboxItem: (gameId: string, createdAtIso: string, promptId: string): PkSk => ({
    pk: `GM#${gameId}`,
    sk: `INBOX#${createdAtIso}#${promptId}`,
  }),
  playerProfile: (playerId: string): PkSk => ({ pk: `PLAYER#${playerId}`, sk: 'PROFILE' }),
  platformEntitlement: (playerId: string): PkSk => ({ pk: `PLAYER#${playerId}`, sk: 'ENTITLEMENTS#PLATFORM' }),
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
  name: z.string(),
  visibility: gameVisibilitySchema,
  lifecycleStatus: gameLifecycleStatusSchema.optional().default('ACTIVE'),
  archivedAt: z.string().nullable().optional().default(null),
  archivedByPlayerId: z.string().nullable().optional().default(null),
  createdByPlayerId: z.string(),
  gmPlayerId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int(),
});

export const playerProfileItemSchema = pkSkSchema.extend({
  type: z.literal('PlayerProfile'),
  playerId: z.string(),
  displayName: z.string(),
  email: z.string().email().nullable(),
  emailNormalized: z.string().nullable(),
  emailVerified: z.boolean(),
  roles: z.array(playerRoleSchema).optional().default(['PLAYER']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const platformEntitlementItemSchema = pkSkSchema.extend({
  type: z.literal('PlatformEntitlement'),
  playerId: z.string(),
  roles: z.array(platformRoleSchema),
  grantedByPlayerId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const gameMemberItemSchema = pkSkSchema.extend({
  type: z.literal('GameMember'),
  gameId: z.string(),
  playerId: z.string(),
  roles: z.array(z.enum(['PLAYER', 'GM'])),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const gameInviteItemSchema = pkSkSchema.extend({
  type: z.literal('GameInvite'),
  inviteId: z.string(),
  gameId: z.string(),
  invitedPlayerId: z.string(),
  invitedEmailNormalized: z.string(),
  invitedByPlayerId: z.string(),
  status: gameInviteStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  respondedAt: z.string().nullable(),
  version: z.number().int(),
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

export const gameChatMessageItemSchema = pkSkSchema.extend({
  type: z.literal('GameChatMessage'),
  messageId: z.string(),
  gameId: z.string(),
  senderPlayerId: z.string(),
  senderRole: gameChatSenderRoleSchema,
  senderCharacterId: z.string().nullable(),
  senderNameSnapshot: z.string(),
  body: z.string(),
  createdAt: z.string(),
});

const inboxRefSchema = z.object({
  characterId: z.string().nullable().optional(),
  commandId: z.string().nullable().optional(),
  inviteId: z.string().nullable().optional(),
  playerId: z.string().nullable().optional(),
});

export const gmInboxItemSchema = pkSkSchema.extend({
  type: z.literal('GMInboxItem'),
  promptId: z.string(),
  gameId: z.string(),
  kind: z.enum(['PENDING_CHARACTER', 'GAME_INVITE_ACCEPTED', 'GAME_INVITE_REJECTED']),
  ref: inboxRefSchema,
  ownerPlayerId: z.string().nullable().optional(),
  message: z.string(),
  createdAt: z.string(),
  submittedAt: z.string().nullable().optional(),
  readAt: z.string().nullable().optional(),
});

export const playerInboxItemSchema = pkSkSchema.extend({
  type: z.literal('PlayerInboxItem'),
  promptId: z.string(),
  gameId: z.string(),
  kind: z.enum(['CHAR_SUBMITTED', 'CHAR_APPROVED', 'CHAR_REJECTED', 'ACTION_REQUIRED', 'GAME_INVITE']),
  ref: inboxRefSchema,
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
  platformEntitlementItemSchema,
  gameMemberItemSchema,
  gameInviteItemSchema,
  characterItemSchema,
  gameChatMessageItemSchema,
  gmInboxItemSchema,
  playerInboxItemSchema,
]);

export type GameMetadataItem = z.infer<typeof gameMetadataItemSchema>;
export type PlayerProfileItem = z.infer<typeof playerProfileItemSchema>;
export type PlatformEntitlementItem = z.infer<typeof platformEntitlementItemSchema>;
export type GameMemberItem = z.infer<typeof gameMemberItemSchema>;
export type GameInviteItem = z.infer<typeof gameInviteItemSchema>;
export type SkillLevel = z.infer<typeof skillLevelSchema>;
export type SubAbility = z.infer<typeof subAbilitySchema>;
export type Ability = z.infer<typeof abilitySchema>;
export type CharacterDraft = z.infer<typeof characterDraftSchema>;
export type CharacterItem = z.infer<typeof characterItemSchema>;
export type GameChatMessageItem = z.infer<typeof gameChatMessageItemSchema>;
export type GMInboxItem = z.infer<typeof gmInboxItemSchema>;
export type PlayerInboxItem = z.infer<typeof playerInboxItemSchema>;
export type CommandLogItem = z.infer<typeof commandLogItemSchema>;
export type GameStateItem = z.infer<typeof gameStateItemSchema>;

export function isArchivedGame(game: { lifecycleStatus?: GameLifecycleStatus | null }): boolean {
  return game.lifecycleStatus === 'ARCHIVED';
}

export function isActiveGame(game: { lifecycleStatus?: GameLifecycleStatus | null }): boolean {
  return !isArchivedGame(game);
}
