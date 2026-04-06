import { z } from 'zod';

export const GAMEPLAY_NODE_IDS = [
  'SCENE_FRAME',
  'PLAYER_INTENT',
  'PROCEDURE_SELECTION',
  'NO_ROLL',
  'STANDARD_CHECK',
  'DIFFICULTY_CHECK',
  'COMBAT_ROUND',
  'WEAPON_ATTACK',
  'DAMAGE',
  'AFTERMATH',
  'MAGIC',
] as const;

export const GAMEPLAY_PROCEDURES = ['NO_ROLL', 'STANDARD_CHECK', 'DIFFICULTY_CHECK', 'COMBAT', 'MAGIC'] as const;
export const GAMEPLAY_EVENT_KINDS = [
  'SCENE_FRAME',
  'INTENT_SUBMITTED',
  'PROCEDURE_SELECTED',
  'CHECK_RESOLVED',
  'COMBAT_OPENED',
  'COMBAT_ACTION_SUBMITTED',
  'COMBAT_TURN_RESOLVED',
  'COMBAT_CLOSED',
] as const;
export const GAMEPLAY_AUDIENCES = ['PUBLIC', 'GM_ONLY'] as const;
export const GAMEPLAY_SESSION_STATUSES = ['ACTIVE', 'IN_COMBAT', 'CLOSED'] as const;
export const GAMEPLAY_COMBATANT_SIDES = ['PLAYER', 'NPC'] as const;
export const GAMEPLAY_COMBATANT_STATUSES = ['READY', 'UNCONSCIOUS', 'DEFEATED'] as const;
export const GAMEPLAY_COMBAT_ACTION_TYPES = ['ATTACK', 'CAST_MAGIC', 'MOVE', 'DELAY', 'DEFEND', 'OTHER'] as const;
export const GAMEPLAY_MOVEMENT_MODES = ['FULL', 'NORMAL', 'STAND_STILL'] as const;
export const GAMEPLAY_CHECK_OUTCOMES = ['PENDING', 'SUCCESS', 'FAILURE'] as const;
export const GAMEPLAY_ATTACK_CONTEXTS = [
  'CHARACTER_TO_MONSTER',
  'MONSTER_TO_CHARACTER',
  'CHARACTER_TO_CHARACTER',
] as const;
export const GAMEPLAY_AUTOMATIC_RESULTS = ['DOUBLE_SIX', 'DOUBLE_ONE'] as const;
export const GAMEPLAY_SEED_IDS = ['rpg_sample_tavern'] as const;

export const gameplayNodeIdSchema = z.enum(GAMEPLAY_NODE_IDS);
export const gameplayProcedureSchema = z.enum(GAMEPLAY_PROCEDURES);
export const gameplayEventKindSchema = z.enum(GAMEPLAY_EVENT_KINDS);
export const gameplayAudienceSchema = z.enum(GAMEPLAY_AUDIENCES);
export const gameplaySessionStatusSchema = z.enum(GAMEPLAY_SESSION_STATUSES);
export const gameplayCombatantSideSchema = z.enum(GAMEPLAY_COMBATANT_SIDES);
export const gameplayCombatantStatusSchema = z.enum(GAMEPLAY_COMBATANT_STATUSES);
export const gameplayCombatActionTypeSchema = z.enum(GAMEPLAY_COMBAT_ACTION_TYPES);
export const gameplayMovementModeSchema = z.enum(GAMEPLAY_MOVEMENT_MODES);
export const gameplayCheckOutcomeSchema = z.enum(GAMEPLAY_CHECK_OUTCOMES);
export const gameplayAttackContextSchema = z.enum(GAMEPLAY_ATTACK_CONTEXTS);
export const gameplayAutomaticResultSchema = z.enum(GAMEPLAY_AUTOMATIC_RESULTS);
export const gameplaySeedIdSchema = z.enum(GAMEPLAY_SEED_IDS);

export type GameplayNodeId = z.infer<typeof gameplayNodeIdSchema>;
export type GameplayProcedure = z.infer<typeof gameplayProcedureSchema>;
export type GameplayEventKind = z.infer<typeof gameplayEventKindSchema>;
export type GameplayAudience = z.infer<typeof gameplayAudienceSchema>;
export type GameplaySessionStatus = z.infer<typeof gameplaySessionStatusSchema>;
export type GameplayCombatantSide = z.infer<typeof gameplayCombatantSideSchema>;
export type GameplayCombatantStatus = z.infer<typeof gameplayCombatantStatusSchema>;
export type GameplayCombatActionType = z.infer<typeof gameplayCombatActionTypeSchema>;
export type GameplayMovementMode = z.infer<typeof gameplayMovementModeSchema>;
export type GameplayCheckOutcome = z.infer<typeof gameplayCheckOutcomeSchema>;
export type GameplayAttackContext = z.infer<typeof gameplayAttackContextSchema>;
export type GameplayAutomaticResult = z.infer<typeof gameplayAutomaticResultSchema>;
export type GameplaySeedId = z.infer<typeof gameplaySeedIdSchema>;

export const gameplayGraphNodeSchema = z.object({
  id: gameplayNodeIdSchema,
  label: z.string(),
  shortLabel: z.string(),
  description: z.string(),
  desktop: z.object({
    x: z.number(),
    y: z.number(),
  }),
  mobileOrder: z.number().int(),
});

export const gameplayGraphEdgeSchema = z.object({
  from: gameplayNodeIdSchema,
  to: gameplayNodeIdSchema,
  label: z.string().nullable().optional(),
});

export const gameplayParticipantSchema = z.object({
  playerId: z.string(),
  displayName: z.string(),
  role: z.enum(['PLAYER', 'GM']),
  characterId: z.string().nullable(),
});

export const gameplayCombatantStatsSchema = z.object({
  intelligence: z.number().int(),
  agility: z.number().int(),
  attackBase: z.number().int(),
  evasionBase: z.number().int(),
  bonusDamage: z.number().int(),
  damageReduction: z.number().int(),
  strikeBase: z.number().int(),
  defenseValue: z.number().int(),
});

export const gameplayCombatantSchema = z.object({
  combatantId: z.string(),
  actorId: z.string().nullable(),
  characterId: z.string().nullable(),
  displayName: z.string(),
  side: gameplayCombatantSideSchema,
  status: gameplayCombatantStatusSchema,
  lifePoints: z.number().int(),
  maxLifePoints: z.number().int(),
  stats: gameplayCombatantStatsSchema,
});

export const gameplayCombatActionSchema = z.object({
  actionId: z.string(),
  roundNumber: z.number().int(),
  actorCombatantId: z.string(),
  actorId: z.string().nullable(),
  targetCombatantId: z.string().nullable(),
  actionType: gameplayCombatActionTypeSchema,
  movementMode: gameplayMovementModeSchema,
  delayToOrderZero: z.boolean(),
  summary: z.string(),
  announcedAt: z.string(),
});

export const gameplayActiveCheckSchema = z.object({
  checkId: z.string(),
  procedure: gameplayProcedureSchema,
  actionLabel: z.string(),
  baselineScore: z.number().int(),
  modifiers: z.number().int(),
  targetScore: z.number().int().nullable(),
  difficulty: z.number().int().nullable(),
  playerRollTotal: z.number().int().nullable(),
  gmRollTotal: z.number().int().nullable(),
  automaticResult: gameplayAutomaticResultSchema.nullable(),
  outcome: gameplayCheckOutcomeSchema,
  publicNarration: z.string().nullable(),
  gmNarration: z.string().nullable(),
});

export const gameplayCombatRoundSchema = z.object({
  roundNumber: z.number().int(),
  announcementOrder: z.array(z.string()),
  resolutionOrder: z.array(z.string()),
  declaredActions: z.array(gameplayCombatActionSchema),
  resolvedActionIds: z.array(z.string()),
  openedAt: z.string(),
});

export const gameplayCombatStateSchema = z.object({
  currentRoundNumber: z.number().int().nullable(),
  rounds: z.array(gameplayCombatRoundSchema),
  aftermathSummary: z.string().nullable(),
});

export const gameplaySessionStateSchema = z.object({
  sessionId: z.string(),
  scenarioId: z.string(),
  graphVersion: z.number().int(),
  currentNodeId: gameplayNodeIdSchema,
  status: gameplaySessionStatusSchema,
  sceneTitle: z.string(),
  sceneSummary: z.string(),
  focusPrompt: z.string(),
  selectedProcedure: gameplayProcedureSchema.nullable(),
  pendingIntentId: z.string().nullable(),
  activeCheck: gameplayActiveCheckSchema.nullable(),
  combatants: z.array(gameplayCombatantSchema),
  combat: gameplayCombatStateSchema.nullable(),
  updatedAt: z.string(),
  version: z.number().int(),
});

export const gameplayEventDetailSchema = z.record(z.string(), z.unknown());

const pkSkSchema = z.object({
  pk: z.string(),
  sk: z.string(),
});

export const gameplaySessionItemSchema = pkSkSchema.extend({
  type: z.literal('GameplaySession'),
  gameId: z.string(),
  state: gameplaySessionStateSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const gameplayEventRecordSchema = z.object({
  eventId: z.string(),
  gameId: z.string(),
  audience: gameplayAudienceSchema,
  eventKind: gameplayEventKindSchema,
  nodeId: gameplayNodeIdSchema,
  actorId: z.string().nullable(),
  title: z.string(),
  body: z.string(),
  detail: gameplayEventDetailSchema,
  createdAt: z.string(),
});

export const gameplayEventItemSchema = pkSkSchema.extend({
  type: z.literal('GameplayEvent'),
  eventId: z.string(),
  gameId: z.string(),
  audience: gameplayAudienceSchema,
  eventKind: gameplayEventKindSchema,
  nodeId: gameplayNodeIdSchema,
  actorId: z.string().nullable(),
  title: z.string(),
  body: z.string(),
  detail: gameplayEventDetailSchema,
  createdAt: z.string(),
});

export const gameplayGraphSchema = z.object({
  nodes: z.array(gameplayGraphNodeSchema),
  edges: z.array(gameplayGraphEdgeSchema),
});

export const gameplayViewModeSchema = z.enum(['PLAYER', 'GM']);

export const gameplayViewResponseSchema = z.object({
  gameId: z.string(),
  gameName: z.string(),
  view: gameplayViewModeSchema,
  graph: gameplayGraphSchema,
  participants: z.array(gameplayParticipantSchema),
  session: gameplaySessionStateSchema,
  publicEvents: z.array(gameplayEventRecordSchema),
  gmOnlyEvents: z.array(gameplayEventRecordSchema).optional(),
});

export const gmFrameGameplayScenePayloadSchema = z.object({
  seedId: gameplaySeedIdSchema.default('rpg_sample_tavern'),
});

export const submitGameplayIntentPayloadSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  characterId: z.string().nullable().optional(),
});

export const gmSelectGameplayProcedurePayloadSchema = z.object({
  procedure: gameplayProcedureSchema,
  actionLabel: z.string().trim().min(1).max(200),
  baselineScore: z.number().int().default(0),
  modifiers: z.number().int().default(0),
  targetScore: z.number().int().nullable().optional(),
  difficulty: z.number().int().nullable().optional(),
  publicPrompt: z.string().trim().min(1).max(500),
  gmPrompt: z.string().trim().min(1).max(1000).optional(),
});

export const gmResolveGameplayCheckPayloadSchema = z.object({
  procedure: z.enum(['NO_ROLL', 'STANDARD_CHECK', 'DIFFICULTY_CHECK']),
  actionLabel: z.string().trim().min(1).max(200),
  baselineScore: z.number().int().default(0),
  modifiers: z.number().int().default(0),
  targetScore: z.number().int().nullable().optional(),
  difficulty: z.number().int().nullable().optional(),
  playerRollTotal: z.number().int().min(2).max(12).nullable().optional(),
  gmRollTotal: z.number().int().min(2).max(12).nullable().optional(),
  publicNarration: z.string().trim().min(1).max(2000),
  gmNarration: z.string().trim().min(1).max(2000).optional(),
});

export const gmOpenCombatRoundPayloadSchema = z.object({
  summary: z.string().trim().min(1).max(1000),
});

export const submitCombatActionPayloadSchema = z.object({
  roundNumber: z.number().int().positive(),
  actorCombatantId: z.string(),
  targetCombatantId: z.string().nullable().optional(),
  actionType: gameplayCombatActionTypeSchema,
  movementMode: gameplayMovementModeSchema,
  delayToOrderZero: z.boolean().optional().default(false),
  summary: z.string().trim().min(1).max(1000),
});

export const gmResolveCombatTurnPayloadSchema = z.object({
  roundNumber: z.number().int().positive(),
  actionId: z.string(),
  actorCombatantId: z.string(),
  targetCombatantId: z.string(),
  attackContext: gameplayAttackContextSchema,
  attackerBase: z.number().int(),
  attackerRollTotal: z.number().int().min(2).max(12),
  fixedTargetScore: z.number().int().nullable().optional(),
  defenderBase: z.number().int().nullable().optional(),
  defenderRollTotal: z.number().int().min(2).max(12).nullable().optional(),
  baseDamage: z.number().int(),
  bonusDamage: z.number().int().default(0),
  defenseValue: z.number().int().default(0),
  damageReduction: z.number().int().default(0),
  narration: z.string().trim().min(1).max(2000),
});

export const gmCloseCombatPayloadSchema = z.object({
  summary: z.string().trim().min(1).max(2000),
});

export type GameplayGraphNode = z.infer<typeof gameplayGraphNodeSchema>;
export type GameplayGraphEdge = z.infer<typeof gameplayGraphEdgeSchema>;
export type GameplayParticipant = z.infer<typeof gameplayParticipantSchema>;
export type GameplayCombatantStats = z.infer<typeof gameplayCombatantStatsSchema>;
export type GameplayCombatant = z.infer<typeof gameplayCombatantSchema>;
export type GameplayCombatAction = z.infer<typeof gameplayCombatActionSchema>;
export type GameplayActiveCheck = z.infer<typeof gameplayActiveCheckSchema>;
export type GameplayCombatRound = z.infer<typeof gameplayCombatRoundSchema>;
export type GameplayCombatState = z.infer<typeof gameplayCombatStateSchema>;
export type GameplaySessionState = z.infer<typeof gameplaySessionStateSchema>;
export type GameplaySessionItem = z.infer<typeof gameplaySessionItemSchema>;
export type GameplayEventRecord = z.infer<typeof gameplayEventRecordSchema>;
export type GameplayEventItem = z.infer<typeof gameplayEventItemSchema>;
export type GameplayViewResponse = z.infer<typeof gameplayViewResponseSchema>;
