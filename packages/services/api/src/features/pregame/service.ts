import type { PregameRole } from '@starter/shared';
import type { PregameDigestEntryResponse, PregamePlanningResponse } from '../../apiTypes.js';
import type { ApiServiceDependencies } from '../../index.js';
import { assertActiveGame, formatChatDisplayName, type ReadApisSubset } from '../../serviceSupport.js';

const PREGAME_ROLE_LABELS: Record<PregameRole, string> = {
  FRONTLINE: 'Frontline',
  HEALER: 'Healer',
  SCOUT: 'Scout',
  ARCANE: 'Arcane Support',
};

export function createPregameReadApis(
  deps: ApiServiceDependencies
): ReadApisSubset<'getPregamePlanning' | 'getMyPregameDigest'> {
  return {
    async getPregamePlanning(gameId: string, actorId: string): Promise<PregamePlanningResponse> {
      return readPregamePlanning(deps, gameId, actorId);
    },

    async getMyPregameDigest(playerId: string): Promise<PregameDigestEntryResponse[]> {
      const games = await deps.db.gameRepository.listGamesForPlayer(playerId);
      const entries = await Promise.all(
        games.map(async (game) => {
          const [planning, ownCharacter] = await Promise.all([
            readPregamePlanning(deps, game.gameId, playerId),
            deps.db.characterRepository.findOwnedCharacterInGame(game.gameId, playerId),
          ]);
          return buildPregameDigestEntry({
            planning,
            ownCharacter,
          });
        })
      );

      return entries
        .filter((entry): entry is PregameDigestEntryResponse => entry !== null)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
  };
}

async function readPregamePlanning(
  deps: ApiServiceDependencies,
  gameId: string,
  actorId: string
): Promise<PregamePlanningResponse> {
  const [game, membership, messages] = await Promise.all([
    deps.db.gameRepository.getGameMetadata(gameId),
    deps.db.membershipRepository.getMembership(gameId, actorId),
    deps.db.chatRepository.queryMessages(gameId, { channel: 'LOBBY' }),
  ]);
  assertActiveGame(gameId, game);

  const activePromptMessage =
    [...messages]
      .reverse()
      .find((message) => message.artifact?.kind === 'GAME_PROMPT') ?? null;

  const latestClaimsByCharacterId = new Map<string, PregamePlanningResponse['recentClaims'][number]>();
  for (const message of [...messages].reverse()) {
    if (message.artifact?.kind !== 'PARTY_ROLE_CLAIM') {
      continue;
    }
    if (latestClaimsByCharacterId.has(message.artifact.characterId)) {
      continue;
    }
    latestClaimsByCharacterId.set(message.artifact.characterId, {
      claimId: message.artifact.claimId,
      characterId: message.artifact.characterId,
      snapshotVersion: message.artifact.snapshotVersion,
      characterName: message.artifact.characterName,
      roles: message.artifact.roles,
      note: message.artifact.note ?? null,
      senderDisplayName: formatChatDisplayName(message.senderNameSnapshot, message.senderRole),
      createdAt: message.createdAt,
    });
  }

  const recentClaims = [...latestClaimsByCharacterId.values()]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 4);

  return {
    gameId: game.gameId,
    gameName: game.name,
    viewer: {
      isMember: membership !== null,
      isGameMaster: membership?.roles.includes('GM') ?? false,
    },
    activePrompt:
      activePromptMessage?.artifact?.kind === 'GAME_PROMPT'
        ? {
            promptId: activePromptMessage.artifact.promptId,
            title: activePromptMessage.artifact.title,
            prompt: activePromptMessage.artifact.prompt,
            suggestedRoles: activePromptMessage.artifact.suggestedRoles,
            senderDisplayName: formatChatDisplayName(activePromptMessage.senderNameSnapshot, activePromptMessage.senderRole),
            createdAt: activePromptMessage.createdAt,
          }
        : null,
    recentClaims,
  };
}

function buildPregameDigestEntry(input: {
  planning: PregamePlanningResponse;
  ownCharacter: Awaited<ReturnType<ApiServiceDependencies['db']['characterRepository']['findOwnedCharacterInGame']>>;
}): PregameDigestEntryResponse | null {
  const latestClaim = input.planning.recentClaims[0] ?? null;
  const activePrompt = input.planning.activePrompt;

  if (input.ownCharacter && input.ownCharacter.status === 'DRAFT' && activePrompt) {
    return {
      digestId: `${input.planning.gameId}:edit`,
      gameId: input.planning.gameId,
      gameName: input.planning.gameName,
      headline: activePrompt.title,
      detail: 'Your draft can still move toward the current GM prompt.',
      destination: 'EDIT_CHARACTER',
      characterId: input.ownCharacter.characterId,
      createdAt: activePrompt.createdAt,
    };
  }

  if (!input.ownCharacter && activePrompt) {
    return {
      digestId: `${input.planning.gameId}:create`,
      gameId: input.planning.gameId,
      gameName: input.planning.gameName,
      headline: activePrompt.title,
      detail: 'Create a character draft and answer the current GM prompt.',
      destination: 'CREATE_CHARACTER',
      characterId: null,
      createdAt: activePrompt.createdAt,
    };
  }

  if (activePrompt) {
    return {
      digestId: `${input.planning.gameId}:lobby`,
      gameId: input.planning.gameId,
      gameName: input.planning.gameName,
      headline: activePrompt.title,
      detail: activePrompt.prompt,
      destination: 'LOBBY',
      characterId: input.ownCharacter?.characterId ?? null,
      createdAt: activePrompt.createdAt,
    };
  }

  if (latestClaim) {
    return {
      digestId: `${input.planning.gameId}:chat`,
      gameId: input.planning.gameId,
      gameName: input.planning.gameName,
      headline: `${latestClaim.characterName} updated party roles`,
      detail: `${latestClaim.characterName} claimed ${latestClaim.roles.map((role) => PREGAME_ROLE_LABELS[role]).join(', ')}.`,
      destination: 'CHAT',
      characterId: input.ownCharacter?.characterId ?? null,
      createdAt: latestClaim.createdAt,
    };
  }

  return null;
}
