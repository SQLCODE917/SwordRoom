import {
  gameplayLoopGraphVersion,
  type CharacterItem,
  type GameplayActiveCheck,
  type GameplayAttackContext,
  type GameplayAutomaticResult,
  type GameplayCombatAction,
  type GameplayCombatActionType,
  type GameplayCombatant,
  type GameplayCombatRound,
  type GameplayMovementMode,
  type GameplayProcedure,
  type GameplaySessionState,
} from '@starter/shared';
import type { GameplayLoopFixture } from '@starter/shared/fixtures';

export interface GameplayDomainError {
  code: string;
  message: string;
}

export interface GameplayResult<TState = GameplaySessionState> {
  state: TState;
  errors: GameplayDomainError[];
}

export function deriveCombatantFromCharacter(input: {
  actorId: string;
  character: CharacterItem;
  fallbackDisplayName?: string | null;
}): GameplayCombatant {
  const { character } = input;
  const skillMap = new Map(character.draft.skills.map((skill) => [skill.skill.toLowerCase(), skill.level]));
  const martialLevel = Math.max(skillMap.get('fighter') ?? 0, skillMap.get('ranger') ?? 0, skillMap.get('thief') ?? 0);
  const highestSkillLevel = character.draft.skills.reduce((max, skill) => Math.max(max, skill.level), 0);
  const name = character.draft.identity.name.trim() || input.fallbackDisplayName?.trim() || input.actorId;
  const lifePoints = Math.max(character.draft.ability.lf, 1);

  return {
    combatantId: character.characterId,
    actorId: input.actorId,
    characterId: character.characterId,
    displayName: name,
    side: 'PLAYER',
    status: 'READY',
    lifePoints,
    maxLifePoints: lifePoints,
    stats: {
      intelligence: character.draft.ability.int,
      agility: character.draft.ability.agi,
      attackBase: martialLevel + character.draft.bonus.dex,
      evasionBase: martialLevel + character.draft.bonus.agi,
      bonusDamage: martialLevel + character.draft.bonus.str,
      damageReduction: highestSkillLevel,
      strikeBase: Math.max(4, martialLevel + character.draft.bonus.str + 4),
      defenseValue: Math.max(0, character.draft.bonus.agi - 1),
    },
  };
}

export function seedGameplaySession(input: {
  fixture: GameplayLoopFixture;
  createdAt: string;
  playerCombatants: GameplayCombatant[];
}): GameplayResult {
  const combatants: GameplayCombatant[] = [
    ...input.playerCombatants,
    ...input.fixture.enemies.map((enemy) => ({
      combatantId: enemy.combatantId,
      actorId: null,
      characterId: null,
      displayName: enemy.displayName,
      side: 'NPC' as const,
      status: 'READY' as const,
      lifePoints: enemy.lifePoints,
      maxLifePoints: enemy.lifePoints,
      stats: enemy.stats,
    })),
  ];

  return {
    state: {
      sessionId: 'main',
      scenarioId: input.fixture.seedId,
      graphVersion: gameplayLoopGraphVersion,
      currentNodeId: 'PLAYER_INTENT',
      status: 'ACTIVE',
      sceneTitle: input.fixture.scene.title,
      sceneSummary: input.fixture.scene.summary,
      focusPrompt: input.fixture.scene.focus_prompt,
      selectedProcedure: null,
      pendingIntentId: null,
      activeCheck: null,
      combatants,
      combat: null,
      updatedAt: input.createdAt,
      version: 1,
    },
    errors: [],
  };
}

export function selectGameplayProcedure(
  state: GameplaySessionState,
  input: {
    procedure: GameplayProcedure;
    actionLabel: string;
    baselineScore: number;
    modifiers: number;
    targetScore?: number | null;
    difficulty?: number | null;
    updatedAt: string;
  }
): GameplayResult {
  const currentNodeId = toProcedureNodeId(input.procedure);
  const activeCheck =
    input.procedure === 'STANDARD_CHECK' || input.procedure === 'DIFFICULTY_CHECK' || input.procedure === 'NO_ROLL'
      ? ({
          checkId: `${currentNodeId}:${input.updatedAt}`,
          procedure: input.procedure,
          actionLabel: input.actionLabel,
          baselineScore: input.baselineScore,
          modifiers: input.modifiers,
          targetScore: input.targetScore ?? null,
          difficulty: input.difficulty ?? null,
          playerRollTotal: null,
          gmRollTotal: null,
          automaticResult: null,
          outcome: 'PENDING',
          publicNarration: null,
          gmNarration: null,
        } satisfies GameplayActiveCheck)
      : null;

  return {
    state: {
      ...state,
      currentNodeId,
      selectedProcedure: input.procedure,
      activeCheck,
      updatedAt: input.updatedAt,
      version: state.version + 1,
    },
    errors: [],
  };
}

export function resolveGameplayCheck(
  state: GameplaySessionState,
  input: {
    procedure: Extract<GameplayProcedure, 'NO_ROLL' | 'STANDARD_CHECK' | 'DIFFICULTY_CHECK'>;
    actionLabel: string;
    baselineScore: number;
    modifiers: number;
    targetScore?: number | null;
    difficulty?: number | null;
    playerRollTotal?: number | null;
    gmRollTotal?: number | null;
    publicNarration: string;
    gmNarration?: string | null;
    updatedAt: string;
  }
): GameplayResult {
  const resolution = computeCheckResolution({
    procedure: input.procedure,
    baselineScore: input.baselineScore,
    modifiers: input.modifiers,
    targetScore: input.targetScore ?? null,
    difficulty: input.difficulty ?? null,
    playerRollTotal: input.playerRollTotal ?? null,
    gmRollTotal: input.gmRollTotal ?? null,
  });

  return {
    state: {
      ...state,
      currentNodeId: 'SCENE_FRAME',
      selectedProcedure: null,
      pendingIntentId: null,
      activeCheck: {
        checkId: `${input.procedure}:${input.updatedAt}`,
        procedure: input.procedure,
        actionLabel: input.actionLabel,
        baselineScore: input.baselineScore,
        modifiers: input.modifiers,
        targetScore: input.targetScore ?? null,
        difficulty: input.difficulty ?? null,
        playerRollTotal: input.playerRollTotal ?? null,
        gmRollTotal: input.gmRollTotal ?? null,
        automaticResult: resolution.automaticResult,
        outcome: resolution.outcome,
        publicNarration: input.publicNarration,
        gmNarration: input.gmNarration ?? null,
      },
      updatedAt: input.updatedAt,
      version: state.version + 1,
    },
    errors: [],
  };
}

export function openCombatRound(
  state: GameplaySessionState,
  input: { updatedAt: string }
): GameplayResult {
  const readyCombatants = state.combatants.filter((combatant) => combatant.status === 'READY');
  const roundNumber = (state.combat?.currentRoundNumber ?? 0) + 1;
  const round: GameplayCombatRound = {
    roundNumber,
    announcementOrder: [...readyCombatants]
      .sort((left, right) => compareAnnouncements(left, right))
      .map((combatant) => combatant.combatantId),
    resolutionOrder: [...readyCombatants]
      .sort((left, right) => compareResolution(left, right, false))
      .map((combatant) => combatant.combatantId),
    declaredActions: [],
    resolvedActionIds: [],
    openedAt: input.updatedAt,
  };

  return {
    state: {
      ...state,
      currentNodeId: 'COMBAT_ROUND',
      status: 'IN_COMBAT',
      selectedProcedure: 'COMBAT',
      combat: {
        currentRoundNumber: roundNumber,
        rounds: [...(state.combat?.rounds ?? []), round],
        aftermathSummary: state.combat?.aftermathSummary ?? null,
      },
      updatedAt: input.updatedAt,
      version: state.version + 1,
    },
    errors: [],
  };
}

export function declareCombatAction(
  state: GameplaySessionState,
  input: {
    roundNumber: number;
    actorCombatantId: string;
    actorId: string | null;
    targetCombatantId?: string | null;
    actionType: GameplayCombatActionType;
    movementMode: GameplayMovementMode;
    delayToOrderZero: boolean;
    summary: string;
    announcedAt: string;
  }
): GameplayResult {
  const round = state.combat?.rounds.find((entry) => entry.roundNumber === input.roundNumber);
  if (!round) {
    return withGameplayError(state, 'COMBAT_ROUND_NOT_FOUND', `combat round ${input.roundNumber} not found`);
  }

  const action: GameplayCombatAction = {
    actionId: `${input.actorCombatantId}:${input.roundNumber}`,
    roundNumber: input.roundNumber,
    actorCombatantId: input.actorCombatantId,
    actorId: input.actorId,
    targetCombatantId: input.targetCombatantId ?? null,
    actionType: input.actionType,
    movementMode: input.movementMode,
    delayToOrderZero: input.delayToOrderZero,
    summary: input.summary,
    announcedAt: input.announcedAt,
  };

  const rounds = state.combat!.rounds.map((entry) => {
    if (entry.roundNumber !== input.roundNumber) {
      return entry;
    }

    const declaredActions = [
      ...entry.declaredActions.filter((current) => current.actorCombatantId !== input.actorCombatantId),
      action,
    ];
    const resolutionOrder = resolveCombatActionOrder(state.combatants, declaredActions);
    return {
      ...entry,
      declaredActions,
      resolutionOrder,
    };
  });

  return {
    state: {
      ...state,
      currentNodeId: 'COMBAT_ROUND',
      combat: {
        ...state.combat!,
        rounds,
      },
      updatedAt: input.announcedAt,
      version: state.version + 1,
    },
    errors: [],
  };
}

export function resolveCombatTurn(
  state: GameplaySessionState,
  input: {
    roundNumber: number;
    actionId: string;
    actorCombatantId: string;
    targetCombatantId: string;
    attackContext: GameplayAttackContext;
    attackerBase: number;
    attackerRollTotal: number;
    fixedTargetScore?: number | null;
    defenderBase?: number | null;
    defenderRollTotal?: number | null;
    baseDamage: number;
    bonusDamage: number;
    defenseValue: number;
    damageReduction: number;
    updatedAt: string;
  }
): GameplayResult {
  const combat = state.combat;
  if (!combat) {
    return withGameplayError(state, 'COMBAT_NOT_OPEN', 'combat must be opened before resolving turns');
  }

  const round = combat.rounds.find((entry) => entry.roundNumber === input.roundNumber);
  if (!round) {
    return withGameplayError(state, 'COMBAT_ROUND_NOT_FOUND', `combat round ${input.roundNumber} not found`);
  }

  const resolution = computeAttackResolution(input);
  const combatants = state.combatants.map((combatant) => {
    if (combatant.combatantId !== input.targetCombatantId || resolution.damage <= 0) {
      return combatant;
    }
    const nextLifePoints = Math.max(0, combatant.lifePoints - resolution.damage);
    const status =
      nextLifePoints <= 0 ? (combatant.side === 'NPC' ? 'DEFEATED' : 'UNCONSCIOUS') : combatant.status;
    return {
      ...combatant,
      lifePoints: nextLifePoints,
      status,
    };
  });

  const rounds = combat.rounds.map((entry) => {
    if (entry.roundNumber !== input.roundNumber) {
      return entry;
    }
    return {
      ...entry,
      resolvedActionIds: entry.resolvedActionIds.includes(input.actionId)
        ? entry.resolvedActionIds
        : [...entry.resolvedActionIds, input.actionId],
    };
  });

  return {
    state: {
      ...state,
      currentNodeId: resolution.hit ? 'DAMAGE' : 'COMBAT_ROUND',
      combatants,
      combat: {
        ...combat,
        rounds,
      },
      updatedAt: input.updatedAt,
      version: state.version + 1,
    },
    errors: [],
  };
}

export function closeCombat(
  state: GameplaySessionState,
  input: { summary: string; updatedAt: string }
): GameplayResult {
  return {
    state: {
      ...state,
      currentNodeId: 'AFTERMATH',
      status: 'ACTIVE',
      selectedProcedure: null,
      combat: state.combat
        ? {
            ...state.combat,
            aftermathSummary: input.summary,
          }
        : null,
      updatedAt: input.updatedAt,
      version: state.version + 1,
    },
    errors: [],
  };
}

export function computeCheckResolution(input: {
  procedure: Extract<GameplayProcedure, 'NO_ROLL' | 'STANDARD_CHECK' | 'DIFFICULTY_CHECK'>;
  baselineScore: number;
  modifiers: number;
  targetScore: number | null;
  difficulty: number | null;
  playerRollTotal: number | null;
  gmRollTotal: number | null;
}): { outcome: 'SUCCESS' | 'FAILURE'; automaticResult: GameplayAutomaticResult | null } {
  if (input.procedure === 'NO_ROLL') {
    return { outcome: 'SUCCESS', automaticResult: null };
  }

  const playerRoll = input.playerRollTotal ?? 0;
  if (playerRoll === 12) {
    return { outcome: 'SUCCESS', automaticResult: 'DOUBLE_SIX' };
  }
  if (playerRoll === 2) {
    return { outcome: 'FAILURE', automaticResult: 'DOUBLE_ONE' };
  }

  const finalScore = input.baselineScore + playerRoll + input.modifiers;
  if (input.procedure === 'STANDARD_CHECK') {
    return {
      outcome: finalScore >= (input.targetScore ?? Number.POSITIVE_INFINITY) ? 'SUCCESS' : 'FAILURE',
      automaticResult: null,
    };
  }

  const secretTarget = (input.difficulty ?? 0) + (input.gmRollTotal ?? 0);
  return {
    outcome: finalScore >= secretTarget ? 'SUCCESS' : 'FAILURE',
    automaticResult: null,
  };
}

export function computeAttackResolution(input: {
  attackContext: GameplayAttackContext;
  attackerBase: number;
  attackerRollTotal: number;
  fixedTargetScore?: number | null;
  defenderBase?: number | null;
  defenderRollTotal?: number | null;
  baseDamage: number;
  bonusDamage: number;
  defenseValue: number;
  damageReduction: number;
}): { hit: boolean; damage: number } {
  const hit = resolveHit(input);
  if (!hit) {
    return { hit: false, damage: 0 };
  }

  const damage = Math.max(0, input.baseDamage + input.bonusDamage - input.defenseValue - input.damageReduction);
  return { hit: true, damage };
}

function resolveHit(input: {
  attackContext: GameplayAttackContext;
  attackerBase: number;
  attackerRollTotal: number;
  fixedTargetScore?: number | null;
  defenderBase?: number | null;
  defenderRollTotal?: number | null;
}): boolean {
  if (input.attackContext === 'CHARACTER_TO_MONSTER') {
    if (input.attackerRollTotal === 12) {
      return true;
    }
    if (input.attackerRollTotal === 2) {
      return false;
    }
    return input.attackerBase + input.attackerRollTotal >= (input.fixedTargetScore ?? Number.POSITIVE_INFINITY);
  }

  if (input.attackContext === 'MONSTER_TO_CHARACTER') {
    const defenderRoll = input.defenderRollTotal ?? 0;
    if (defenderRoll === 12) {
      return false;
    }
    if (defenderRoll === 2) {
      return true;
    }
    return (input.defenderBase ?? 0) + defenderRoll < (input.fixedTargetScore ?? Number.POSITIVE_INFINITY);
  }

  const defenderRoll = input.defenderRollTotal ?? 0;
  if (input.attackerRollTotal === 12 && defenderRoll !== 12) {
    return true;
  }
  if (defenderRoll === 12 && input.attackerRollTotal !== 12) {
    return false;
  }
  if (input.attackerRollTotal === 2 && defenderRoll !== 2) {
    return false;
  }
  if (defenderRoll === 2 && input.attackerRollTotal !== 2) {
    return true;
  }
  return input.attackerBase + input.attackerRollTotal > (input.defenderBase ?? 0) + defenderRoll;
}

function resolveCombatActionOrder(combatants: GameplayCombatant[], actions: GameplayCombatAction[]): string[] {
  return [...actions]
    .sort((left, right) => {
      const leftCombatant = combatants.find((combatant) => combatant.combatantId === left.actorCombatantId);
      const rightCombatant = combatants.find((combatant) => combatant.combatantId === right.actorCombatantId);
      return compareResolution(leftCombatant ?? null, rightCombatant ?? null, left.delayToOrderZero || right.delayToOrderZero, left, right);
    })
    .map((action) => action.actorCombatantId);
}

function compareAnnouncements(left: GameplayCombatant, right: GameplayCombatant): number {
  if (left.stats.intelligence !== right.stats.intelligence) {
    return left.stats.intelligence - right.stats.intelligence;
  }
  return left.displayName.localeCompare(right.displayName);
}

function compareResolution(
  left: GameplayCombatant | null,
  right: GameplayCombatant | null,
  hasDelayOverride: boolean,
  leftAction?: GameplayCombatAction,
  rightAction?: GameplayCombatAction
): number {
  const leftDelay = leftAction?.delayToOrderZero ?? false;
  const rightDelay = rightAction?.delayToOrderZero ?? false;
  if (hasDelayOverride && leftDelay !== rightDelay) {
    return leftDelay ? 1 : -1;
  }
  const leftAgility = left?.stats.agility ?? 0;
  const rightAgility = right?.stats.agility ?? 0;
  if (leftAgility !== rightAgility) {
    return rightAgility - leftAgility;
  }
  return (left?.displayName ?? '').localeCompare(right?.displayName ?? '');
}

function toProcedureNodeId(procedure: GameplayProcedure): GameplaySessionState['currentNodeId'] {
  switch (procedure) {
    case 'NO_ROLL':
      return 'NO_ROLL';
    case 'STANDARD_CHECK':
      return 'STANDARD_CHECK';
    case 'DIFFICULTY_CHECK':
      return 'DIFFICULTY_CHECK';
    case 'COMBAT':
      return 'COMBAT_ROUND';
    case 'MAGIC':
      return 'MAGIC';
  }
}

function withGameplayError(
  state: GameplaySessionState,
  code: string,
  message: string
): GameplayResult {
  return {
    state,
    errors: [{ code, message }],
  };
}
