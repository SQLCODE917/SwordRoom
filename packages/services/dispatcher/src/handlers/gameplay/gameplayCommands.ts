import {
  closeCombat,
  declareCombatAction,
  deriveCombatantFromCharacter,
  openCombatRound,
  resolveCombatTurn,
  resolveGameplayCheck,
  seedGameplaySession,
  selectGameplayProcedure,
} from '@starter/engine';
import type { CharacterItem } from '@starter/shared';
import { getGameplayLoopFixture } from '@starter/shared/fixtures';
import type { CommandHandler } from '../types.js';
import { requireActiveGame } from '../game/shared.js';

export const gmFrameGameplaySceneHandler: CommandHandler<'GMFrameGameplayScene'> = async (ctx, envelope) => {
  await requireActiveGame(ctx.db, envelope.gameId);
  const existing = await ctx.db.gameplayRepository.getSession(envelope.gameId);
  const fixture = getGameplayLoopFixture(envelope.payload.seedId);
  const memberships = await ctx.db.membershipRepository.listMembershipsForGame(envelope.gameId);

  const playerCombatants = (
    await Promise.all(
      memberships.map(async (membership) => {
        const character = await ctx.db.characterRepository.findOwnedCharacterInGame(envelope.gameId, membership.playerId);
        if (!character || character.status !== 'APPROVED') {
          return null;
        }
        const profile = await ctx.db.playerRepository.getPlayerProfile(membership.playerId);
        return deriveCombatantFromCharacter({
          actorId: membership.playerId,
          character,
          fallbackDisplayName: profile?.displayName ?? membership.playerId,
        });
      })
    )
  ).filter((combatant): combatant is NonNullable<typeof combatant> => combatant !== null);

  const seeded = seedGameplaySession({
    fixture,
    createdAt: envelope.createdAt,
    playerCombatants,
  });
  if (seeded.errors.length > 0) {
    const first = seeded.errors[0]!;
    const error = new Error(first.message);
    (error as Error & { code?: string }).code = first.code;
    throw error;
  }

  return {
    writes: [
      {
        kind: 'PUT_GAMEPLAY_SESSION',
        input: {
          gameId: envelope.gameId,
          state: seeded.state,
          createdAt: existing?.createdAt ?? envelope.createdAt,
          updatedAt: ctx.nowIso(),
        },
      },
      {
        kind: 'PUT_GAMEPLAY_EVENT',
        input: {
          gameId: envelope.gameId,
          eventId: `${envelope.commandId}:public`,
          audience: 'PUBLIC',
          eventKind: 'SCENE_FRAME',
          nodeId: 'SCENE_FRAME',
          actorId: envelope.actorId,
          title: fixture.scene.title,
          body: fixture.scene.summary,
          detail: {
            focusPrompt: fixture.scene.focus_prompt,
            location: fixture.scene.location,
            seedId: fixture.seedId,
          },
          createdAt: envelope.createdAt,
        },
      },
      {
        kind: 'PUT_GAMEPLAY_EVENT',
        input: {
          gameId: envelope.gameId,
          eventId: `${envelope.commandId}:gm`,
          audience: 'GM_ONLY',
          eventKind: 'SCENE_FRAME',
          nodeId: 'SCENE_FRAME',
          actorId: envelope.actorId,
          title: 'GM Scenario Notes',
          body: fixture.gm_only_transcript_contains.join(' '),
          detail: {
            enemyIds: fixture.enemies.map((enemy) => enemy.combatantId),
            enemyNames: fixture.enemies.map((enemy) => enemy.displayName),
          },
          createdAt: envelope.createdAt,
        },
      },
    ],
    inbox: [],
    notifications: [],
  };
};

export const submitGameplayIntentHandler: CommandHandler<'SubmitGameplayIntent'> = async (ctx, envelope) => {
  await requireActiveGame(ctx.db, envelope.gameId);
  await requireGameplayMembership(ctx, envelope.gameId, envelope.actorId);
  const existing = await requireGameplaySession(ctx, envelope.gameId);
  const profile = await ctx.db.playerRepository.getPlayerProfile(envelope.actorId);
  const character = await requirePlayableCharacter(ctx, {
    gameId: envelope.gameId,
    actorId: envelope.actorId,
    characterId: envelope.payload.characterId ?? null,
  });
  const speaker = character.draft.identity.name.trim() || profile?.displayName?.trim() || character.characterId;

  return {
    writes: [
      {
        kind: 'PUT_GAMEPLAY_SESSION',
        input: {
          gameId: envelope.gameId,
          state: {
            ...existing.state,
            currentNodeId: 'PROCEDURE_SELECTION',
            pendingIntentId: envelope.commandId,
            updatedAt: ctx.nowIso(),
            version: existing.state.version + 1,
          },
          createdAt: existing.createdAt,
          updatedAt: ctx.nowIso(),
        },
      },
      {
        kind: 'PUT_GAMEPLAY_EVENT',
        input: {
          gameId: envelope.gameId,
          eventId: envelope.commandId,
          audience: 'PUBLIC',
          eventKind: 'INTENT_SUBMITTED',
          nodeId: 'PLAYER_INTENT',
          actorId: envelope.actorId,
          title: `${speaker} declares an intent`,
          body: envelope.payload.body,
          detail: {
            characterId: character.characterId,
          },
          createdAt: envelope.createdAt,
        },
      },
    ],
    inbox: [],
    notifications: [],
  };
};

export const gmSelectGameplayProcedureHandler: CommandHandler<'GMSelectGameplayProcedure'> = async (ctx, envelope) => {
  await requireActiveGame(ctx.db, envelope.gameId);
  const existing = await requireGameplaySession(ctx, envelope.gameId);
  const selected = selectGameplayProcedure(existing.state, {
    procedure: envelope.payload.procedure,
    actionLabel: envelope.payload.actionLabel,
    baselineScore: envelope.payload.baselineScore,
    modifiers: envelope.payload.modifiers,
    targetScore: envelope.payload.targetScore ?? null,
    difficulty: envelope.payload.difficulty ?? null,
    updatedAt: ctx.nowIso(),
  });

  return {
    writes: [
      {
        kind: 'PUT_GAMEPLAY_SESSION',
        input: {
          gameId: envelope.gameId,
          state: selected.state,
          createdAt: existing.createdAt,
          updatedAt: ctx.nowIso(),
        },
      },
      {
        kind: 'PUT_GAMEPLAY_EVENT',
        input: {
          gameId: envelope.gameId,
          eventId: `${envelope.commandId}:public`,
          audience: 'PUBLIC',
          eventKind: 'PROCEDURE_SELECTED',
          nodeId: selected.state.currentNodeId,
          actorId: envelope.actorId,
          title: `GM selects ${envelope.payload.procedure}`,
          body: envelope.payload.publicPrompt,
          detail: {
            actionLabel: envelope.payload.actionLabel,
          },
          createdAt: envelope.createdAt,
        },
      },
      {
        kind: 'PUT_GAMEPLAY_EVENT',
        input: {
          gameId: envelope.gameId,
          eventId: `${envelope.commandId}:gm`,
          audience: 'GM_ONLY',
          eventKind: 'PROCEDURE_SELECTED',
          nodeId: selected.state.currentNodeId,
          actorId: envelope.actorId,
          title: `GM procedure details`,
          body:
            envelope.payload.gmPrompt ??
            `baseline=${envelope.payload.baselineScore}, modifiers=${envelope.payload.modifiers}, target=${envelope.payload.targetScore ?? 'n/a'}, difficulty=${envelope.payload.difficulty ?? 'n/a'}`,
          detail: {
            actionLabel: envelope.payload.actionLabel,
            baselineScore: envelope.payload.baselineScore,
            modifiers: envelope.payload.modifiers,
            targetScore: envelope.payload.targetScore ?? null,
            difficulty: envelope.payload.difficulty ?? null,
          },
          createdAt: envelope.createdAt,
        },
      },
    ],
    inbox: [],
    notifications: [],
  };
};

export const gmResolveGameplayCheckHandler: CommandHandler<'GMResolveGameplayCheck'> = async (ctx, envelope) => {
  await requireActiveGame(ctx.db, envelope.gameId);
  const existing = await requireGameplaySession(ctx, envelope.gameId);
  const resolved = resolveGameplayCheck(existing.state, {
    procedure: envelope.payload.procedure,
    actionLabel: envelope.payload.actionLabel,
    baselineScore: envelope.payload.baselineScore,
    modifiers: envelope.payload.modifiers,
    targetScore: envelope.payload.targetScore ?? null,
    difficulty: envelope.payload.difficulty ?? null,
    playerRollTotal: envelope.payload.playerRollTotal ?? null,
    gmRollTotal: envelope.payload.gmRollTotal ?? null,
    publicNarration: envelope.payload.publicNarration,
    gmNarration: envelope.payload.gmNarration ?? null,
    updatedAt: ctx.nowIso(),
  });

  return {
    writes: [
      {
        kind: 'PUT_GAMEPLAY_SESSION',
        input: {
          gameId: envelope.gameId,
          state: resolved.state,
          createdAt: existing.createdAt,
          updatedAt: ctx.nowIso(),
        },
      },
      {
        kind: 'PUT_GAMEPLAY_EVENT',
        input: {
          gameId: envelope.gameId,
          eventId: `${envelope.commandId}:public`,
          audience: 'PUBLIC',
          eventKind: 'CHECK_RESOLVED',
          nodeId: envelope.payload.procedure === 'DIFFICULTY_CHECK' ? 'DIFFICULTY_CHECK' : 'STANDARD_CHECK',
          actorId: envelope.actorId,
          title: `${envelope.payload.actionLabel}`,
          body: envelope.payload.publicNarration,
          detail: {
            procedure: envelope.payload.procedure,
            outcome: resolved.state.activeCheck?.outcome ?? null,
            targetScore:
              envelope.payload.procedure === 'DIFFICULTY_CHECK' ? null : (envelope.payload.targetScore ?? null),
          },
          createdAt: envelope.createdAt,
        },
      },
      {
        kind: 'PUT_GAMEPLAY_EVENT',
        input: {
          gameId: envelope.gameId,
          eventId: `${envelope.commandId}:gm`,
          audience: 'GM_ONLY',
          eventKind: 'CHECK_RESOLVED',
          nodeId: envelope.payload.procedure === 'DIFFICULTY_CHECK' ? 'DIFFICULTY_CHECK' : 'STANDARD_CHECK',
          actorId: envelope.actorId,
          title: 'GM check outcome',
          body:
            envelope.payload.gmNarration ??
            `playerRoll=${envelope.payload.playerRollTotal ?? 'n/a'}, gmRoll=${envelope.payload.gmRollTotal ?? 'n/a'}, outcome=${resolved.state.activeCheck?.outcome ?? 'n/a'}`,
          detail: {
            baselineScore: envelope.payload.baselineScore,
            modifiers: envelope.payload.modifiers,
            targetScore: envelope.payload.targetScore ?? null,
            difficulty: envelope.payload.difficulty ?? null,
            playerRollTotal: envelope.payload.playerRollTotal ?? null,
            gmRollTotal: envelope.payload.gmRollTotal ?? null,
            outcome: resolved.state.activeCheck?.outcome ?? null,
            automaticResult: resolved.state.activeCheck?.automaticResult ?? null,
          },
          createdAt: envelope.createdAt,
        },
      },
    ],
    inbox: [],
    notifications: [],
  };
};

export const gmOpenCombatRoundHandler: CommandHandler<'GMOpenCombatRound'> = async (ctx, envelope) => {
  await requireActiveGame(ctx.db, envelope.gameId);
  const existing = await requireGameplaySession(ctx, envelope.gameId);
  const opened = openCombatRound(existing.state, {
    updatedAt: ctx.nowIso(),
  });

  return {
    writes: [
      {
        kind: 'PUT_GAMEPLAY_SESSION',
        input: {
          gameId: envelope.gameId,
          state: opened.state,
          createdAt: existing.createdAt,
          updatedAt: ctx.nowIso(),
        },
      },
      {
        kind: 'PUT_GAMEPLAY_EVENT',
        input: {
          gameId: envelope.gameId,
          eventId: envelope.commandId,
          audience: 'PUBLIC',
          eventKind: 'COMBAT_OPENED',
          nodeId: 'COMBAT_ROUND',
          actorId: envelope.actorId,
          title: `Combat round ${opened.state.combat?.currentRoundNumber ?? 1} begins`,
          body: envelope.payload.summary,
          detail: {
            roundNumber: opened.state.combat?.currentRoundNumber ?? 1,
            announcementOrder: opened.state.combat?.rounds.at(-1)?.announcementOrder ?? [],
            resolutionOrder: opened.state.combat?.rounds.at(-1)?.resolutionOrder ?? [],
          },
          createdAt: envelope.createdAt,
        },
      },
    ],
    inbox: [],
    notifications: [],
  };
};

export const submitCombatActionHandler: CommandHandler<'SubmitCombatAction'> = async (ctx, envelope) => {
  await requireActiveGame(ctx.db, envelope.gameId);
  const membership = await requireGameplayMembership(ctx, envelope.gameId, envelope.actorId);
  const existing = await requireGameplaySession(ctx, envelope.gameId);
  const actingCombatant =
    existing.state.combatants.find((combatant) => combatant.combatantId === envelope.payload.actorCombatantId) ?? null;
  if (!actingCombatant) {
    throw codedError(
      `combatant "${envelope.payload.actorCombatantId}" is not part of gameplay session "${envelope.gameId}"`,
      'COMBAT_ACTION_ACTOR_NOT_FOUND'
    );
  }

  if (actingCombatant.side === 'NPC') {
    if (!membership.roles.includes('GM')) {
      throw codedError(
        `combat action actor "${envelope.payload.actorCombatantId}" requires GM authority`,
        'COMBAT_ACTION_GM_REQUIRED'
      );
    }
  } else {
    const ownedCharacter = await requirePlayableCharacter(ctx, {
      gameId: envelope.gameId,
      actorId: envelope.actorId,
      characterId: actingCombatant.characterId,
    });
    if (envelope.payload.actorCombatantId !== ownedCharacter.characterId) {
      throw codedError(
        `combat action actor "${envelope.payload.actorCombatantId}" is not owned by "${envelope.actorId}"`,
        'COMBAT_ACTION_OWNER_REQUIRED'
      );
    }
  }

  const declared = declareCombatAction(existing.state, {
    roundNumber: envelope.payload.roundNumber,
    actorCombatantId: envelope.payload.actorCombatantId,
    actorId: envelope.actorId,
    targetCombatantId: envelope.payload.targetCombatantId ?? null,
    actionType: envelope.payload.actionType,
    movementMode: envelope.payload.movementMode,
    delayToOrderZero: envelope.payload.delayToOrderZero ?? false,
    summary: envelope.payload.summary,
    announcedAt: envelope.createdAt,
  });
  if (declared.errors.length > 0) {
    const first = declared.errors[0]!;
    const error = new Error(first.message);
    (error as Error & { code?: string }).code = first.code;
    throw error;
  }

  return {
    writes: [
      {
        kind: 'PUT_GAMEPLAY_SESSION',
        input: {
          gameId: envelope.gameId,
          state: declared.state,
          createdAt: existing.createdAt,
          updatedAt: ctx.nowIso(),
        },
      },
      {
        kind: 'PUT_GAMEPLAY_EVENT',
        input: {
          gameId: envelope.gameId,
          eventId: envelope.commandId,
          audience: 'PUBLIC',
          eventKind: 'COMBAT_ACTION_SUBMITTED',
          nodeId: 'COMBAT_ROUND',
          actorId: envelope.actorId,
          title: `Action declared`,
          body: envelope.payload.summary,
          detail: {
            roundNumber: envelope.payload.roundNumber,
            actorCombatantId: envelope.payload.actorCombatantId,
            targetCombatantId: envelope.payload.targetCombatantId ?? null,
            actionType: envelope.payload.actionType,
            movementMode: envelope.payload.movementMode,
            delayToOrderZero: envelope.payload.delayToOrderZero ?? false,
          },
          createdAt: envelope.createdAt,
        },
      },
    ],
    inbox: [],
    notifications: [],
  };
};

export const gmResolveCombatTurnHandler: CommandHandler<'GMResolveCombatTurn'> = async (ctx, envelope) => {
  await requireActiveGame(ctx.db, envelope.gameId);
  const existing = await requireGameplaySession(ctx, envelope.gameId);
  const resolved = resolveCombatTurn(existing.state, {
    roundNumber: envelope.payload.roundNumber,
    actionId: envelope.payload.actionId,
    actorCombatantId: envelope.payload.actorCombatantId,
    targetCombatantId: envelope.payload.targetCombatantId,
    attackContext: envelope.payload.attackContext,
    attackerBase: envelope.payload.attackerBase,
    attackerRollTotal: envelope.payload.attackerRollTotal,
    fixedTargetScore: envelope.payload.fixedTargetScore ?? null,
    defenderBase: envelope.payload.defenderBase ?? null,
    defenderRollTotal: envelope.payload.defenderRollTotal ?? null,
    baseDamage: envelope.payload.baseDamage,
    bonusDamage: envelope.payload.bonusDamage,
    defenseValue: envelope.payload.defenseValue,
    damageReduction: envelope.payload.damageReduction,
    updatedAt: ctx.nowIso(),
  });
  if (resolved.errors.length > 0) {
    const first = resolved.errors[0]!;
    const error = new Error(first.message);
    (error as Error & { code?: string }).code = first.code;
    throw error;
  }

  return {
    writes: [
      {
        kind: 'PUT_GAMEPLAY_SESSION',
        input: {
          gameId: envelope.gameId,
          state: resolved.state,
          createdAt: existing.createdAt,
          updatedAt: ctx.nowIso(),
        },
      },
      {
        kind: 'PUT_GAMEPLAY_EVENT',
        input: {
          gameId: envelope.gameId,
          eventId: `${envelope.commandId}:public`,
          audience: 'PUBLIC',
          eventKind: 'COMBAT_TURN_RESOLVED',
          nodeId: 'WEAPON_ATTACK',
          actorId: envelope.actorId,
          title: 'Combat turn resolved',
          body: envelope.payload.narration,
          detail: {
            roundNumber: envelope.payload.roundNumber,
            actionId: envelope.payload.actionId,
            actorCombatantId: envelope.payload.actorCombatantId,
            targetCombatantId: envelope.payload.targetCombatantId,
          },
          createdAt: envelope.createdAt,
        },
      },
      {
        kind: 'PUT_GAMEPLAY_EVENT',
        input: {
          gameId: envelope.gameId,
          eventId: `${envelope.commandId}:gm`,
          audience: 'GM_ONLY',
          eventKind: 'COMBAT_TURN_RESOLVED',
          nodeId: 'WEAPON_ATTACK',
          actorId: envelope.actorId,
          title: 'GM combat math',
          body: `attackerBase=${envelope.payload.attackerBase}, attackerRoll=${envelope.payload.attackerRollTotal}, damageBase=${envelope.payload.baseDamage}`,
          detail: {
            attackContext: envelope.payload.attackContext,
            attackerBase: envelope.payload.attackerBase,
            attackerRollTotal: envelope.payload.attackerRollTotal,
            fixedTargetScore: envelope.payload.fixedTargetScore ?? null,
            defenderBase: envelope.payload.defenderBase ?? null,
            defenderRollTotal: envelope.payload.defenderRollTotal ?? null,
            baseDamage: envelope.payload.baseDamage,
            bonusDamage: envelope.payload.bonusDamage,
            defenseValue: envelope.payload.defenseValue,
            damageReduction: envelope.payload.damageReduction,
          },
          createdAt: envelope.createdAt,
        },
      },
    ],
    inbox: [],
    notifications: [],
  };
};

export const gmCloseCombatHandler: CommandHandler<'GMCloseCombat'> = async (ctx, envelope) => {
  await requireActiveGame(ctx.db, envelope.gameId);
  const existing = await requireGameplaySession(ctx, envelope.gameId);
  const closed = closeCombat(existing.state, {
    summary: envelope.payload.summary,
    updatedAt: ctx.nowIso(),
  });

  return {
    writes: [
      {
        kind: 'PUT_GAMEPLAY_SESSION',
        input: {
          gameId: envelope.gameId,
          state: closed.state,
          createdAt: existing.createdAt,
          updatedAt: ctx.nowIso(),
        },
      },
      {
        kind: 'PUT_GAMEPLAY_EVENT',
        input: {
          gameId: envelope.gameId,
          eventId: envelope.commandId,
          audience: 'PUBLIC',
          eventKind: 'COMBAT_CLOSED',
          nodeId: 'AFTERMATH',
          actorId: envelope.actorId,
          title: 'Combat ends',
          body: envelope.payload.summary,
          detail: {
            currentNodeId: closed.state.currentNodeId,
          },
          createdAt: envelope.createdAt,
        },
      },
    ],
    inbox: [],
    notifications: [],
  };
};

async function requireGameplaySession(
  ctx: GameplayHandlerContext,
  gameId: string
) {
  const session = await ctx.db.gameplayRepository.getSession(gameId);
  if (!session) {
    throw codedError(`gameplay session not found for game "${gameId}"`, 'GAMEPLAY_SESSION_NOT_FOUND');
  }
  return session;
}

type GameplayHandlerContext = Parameters<CommandHandler<'GMFrameGameplayScene'>>[0];

async function requireGameplayMembership(
  ctx: GameplayHandlerContext,
  gameId: string,
  actorId: string
) {
  const membership = await ctx.db.membershipRepository.getMembership(gameId, actorId);
  if (!membership) {
    throw codedError(`game access required for actor "${actorId}" and game "${gameId}"`, 'GAME_ACCESS_REQUIRED');
  }
  return membership;
}

async function requirePlayableCharacter(
  ctx: GameplayHandlerContext,
  input: {
    gameId: string;
    actorId: string;
    characterId?: string | null;
  }
): Promise<CharacterItem> {
  const character = input.characterId
    ? await ctx.db.characterRepository.getCharacter(input.gameId, input.characterId)
    : await ctx.db.characterRepository.findOwnedCharacterInGame(input.gameId, input.actorId);

  if (!character) {
    throw codedError(
      `approved character required for actor "${input.actorId}" in game "${input.gameId}"`,
      'GAMEPLAY_CHARACTER_REQUIRED'
    );
  }
  if (character.ownerPlayerId !== input.actorId) {
    throw codedError(
      `character "${character.characterId}" is not owned by "${input.actorId}"`,
      'GAMEPLAY_CHARACTER_OWNER_REQUIRED'
    );
  }
  if (character.status !== 'APPROVED') {
    throw codedError(
      `character "${character.characterId}" is not approved for gameplay`,
      'GAMEPLAY_CHARACTER_NOT_APPROVED'
    );
  }
  return character;
}

function codedError(message: string, code: string): Error {
  const error = new Error(message);
  (error as Error & { code?: string }).code = code;
  return error;
}
