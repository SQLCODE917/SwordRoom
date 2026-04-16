import type { GameplayNodeId, GameplayProcedure } from './contracts/gameplay.js';

export const GAMEPLAY_GM_ACTION_IDS = [
  'LOAD_SAMPLE',
  'OPEN_CHAT_MODE',
  'OPEN_TIMESERIES_UTILITY',
  'OPEN_TRANSCRIPT_UTILITY',
  'OPEN_STATUS_UTILITY',
  'FOCUS_PLAYER_INTENT',
  'SELECT_PROCEDURE',
  'RESOLVE_NO_ROLL',
  'RESOLVE_STANDARD_CHECK',
  'RESOLVE_DIFFICULTY_CHECK',
  'OPEN_COMBAT',
  'DECLARE_COMBAT_ACTION',
  'PREPARE_COMBAT_RESOLUTION',
  'RESOLVE_COMBAT_TURN',
  'CONTINUE_COMBAT_ROUND',
  'CLOSE_COMBAT',
  'RESUME_SCENE',
] as const;

export type GameplayGmActionId = (typeof GAMEPLAY_GM_ACTION_IDS)[number];
export type GameplayInfoTopicId = GameplayNodeId;

export interface GameplayStepDescriptor {
  nodeId: GameplayNodeId;
  nextNodeIds: GameplayNodeId[];
  defaultProcedure: GameplayProcedure | null;
  gmActionIds: GameplayGmActionId[];
  infoTopicId: GameplayInfoTopicId;
}

export const gameplayStepDescriptorByNodeId: Record<GameplayNodeId, GameplayStepDescriptor> = {
  SCENE_FRAME: {
    nodeId: 'SCENE_FRAME',
    nextNodeIds: ['PLAYER_INTENT'],
    defaultProcedure: null,
    gmActionIds: ['FOCUS_PLAYER_INTENT', 'OPEN_CHAT_MODE', 'OPEN_TRANSCRIPT_UTILITY', 'OPEN_TIMESERIES_UTILITY', 'OPEN_STATUS_UTILITY'],
    infoTopicId: 'SCENE_FRAME',
  },
  PLAYER_INTENT: {
    nodeId: 'PLAYER_INTENT',
    nextNodeIds: ['PROCEDURE_SELECTION'],
    defaultProcedure: null,
    gmActionIds: ['SELECT_PROCEDURE', 'OPEN_CHAT_MODE', 'OPEN_TRANSCRIPT_UTILITY', 'OPEN_TIMESERIES_UTILITY'],
    infoTopicId: 'PLAYER_INTENT',
  },
  PROCEDURE_SELECTION: {
    nodeId: 'PROCEDURE_SELECTION',
    nextNodeIds: ['NO_ROLL', 'STANDARD_CHECK', 'DIFFICULTY_CHECK', 'COMBAT_ROUND', 'MAGIC'],
    defaultProcedure: null,
    gmActionIds: ['SELECT_PROCEDURE', 'OPEN_CHAT_MODE', 'OPEN_TRANSCRIPT_UTILITY', 'OPEN_STATUS_UTILITY'],
    infoTopicId: 'PROCEDURE_SELECTION',
  },
  NO_ROLL: {
    nodeId: 'NO_ROLL',
    nextNodeIds: ['SCENE_FRAME'],
    defaultProcedure: 'NO_ROLL',
    gmActionIds: ['RESOLVE_NO_ROLL', 'OPEN_TRANSCRIPT_UTILITY', 'OPEN_STATUS_UTILITY'],
    infoTopicId: 'NO_ROLL',
  },
  STANDARD_CHECK: {
    nodeId: 'STANDARD_CHECK',
    nextNodeIds: ['SCENE_FRAME'],
    defaultProcedure: 'STANDARD_CHECK',
    gmActionIds: ['RESOLVE_STANDARD_CHECK', 'OPEN_TRANSCRIPT_UTILITY', 'OPEN_STATUS_UTILITY'],
    infoTopicId: 'STANDARD_CHECK',
  },
  DIFFICULTY_CHECK: {
    nodeId: 'DIFFICULTY_CHECK',
    nextNodeIds: ['SCENE_FRAME'],
    defaultProcedure: 'DIFFICULTY_CHECK',
    gmActionIds: ['RESOLVE_DIFFICULTY_CHECK', 'OPEN_TRANSCRIPT_UTILITY', 'OPEN_STATUS_UTILITY'],
    infoTopicId: 'DIFFICULTY_CHECK',
  },
  COMBAT_ROUND: {
    nodeId: 'COMBAT_ROUND',
    nextNodeIds: ['WEAPON_ATTACK', 'AFTERMATH'],
    defaultProcedure: 'COMBAT',
    gmActionIds: ['DECLARE_COMBAT_ACTION', 'PREPARE_COMBAT_RESOLUTION', 'CLOSE_COMBAT', 'OPEN_STATUS_UTILITY'],
    infoTopicId: 'COMBAT_ROUND',
  },
  WEAPON_ATTACK: {
    nodeId: 'WEAPON_ATTACK',
    nextNodeIds: ['DAMAGE', 'COMBAT_ROUND'],
    defaultProcedure: 'COMBAT',
    gmActionIds: ['RESOLVE_COMBAT_TURN', 'OPEN_STATUS_UTILITY', 'OPEN_TRANSCRIPT_UTILITY'],
    infoTopicId: 'WEAPON_ATTACK',
  },
  DAMAGE: {
    nodeId: 'DAMAGE',
    nextNodeIds: ['COMBAT_ROUND'],
    defaultProcedure: 'COMBAT',
    gmActionIds: ['CONTINUE_COMBAT_ROUND', 'PREPARE_COMBAT_RESOLUTION', 'CLOSE_COMBAT', 'OPEN_STATUS_UTILITY'],
    infoTopicId: 'DAMAGE',
  },
  AFTERMATH: {
    nodeId: 'AFTERMATH',
    nextNodeIds: ['SCENE_FRAME'],
    defaultProcedure: null,
    gmActionIds: ['RESUME_SCENE', 'OPEN_TRANSCRIPT_UTILITY', 'OPEN_CHAT_MODE'],
    infoTopicId: 'AFTERMATH',
  },
  MAGIC: {
    nodeId: 'MAGIC',
    nextNodeIds: ['STANDARD_CHECK', 'COMBAT_ROUND'],
    defaultProcedure: 'MAGIC',
    gmActionIds: ['SELECT_PROCEDURE', 'OPEN_COMBAT', 'OPEN_TRANSCRIPT_UTILITY'],
    infoTopicId: 'MAGIC',
  },
};

export const gameplayStepDescriptors = Object.values(gameplayStepDescriptorByNodeId);

export function readGameplayStepDescriptor(nodeId: GameplayNodeId): GameplayStepDescriptor {
  return gameplayStepDescriptorByNodeId[nodeId];
}
