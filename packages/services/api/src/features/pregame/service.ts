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

const PREGAME_ROLE_ORDER: PregameRole[] = ['FRONTLINE', 'HEALER', 'SCOUT', 'ARCANE'];

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
    deps.db.chatRepository.queryMessages(gameId),
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

  const claimedByRole = new Map<PregameRole, string[]>();
  for (const claim of latestClaimsByCharacterId.values()) {
    for (const role of claim.roles) {
      claimedByRole.set(role, [...(claimedByRole.get(role) ?? []), claim.characterName]);
    }
  }

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
    partyNeeds: PREGAME_ROLE_ORDER.map((role) => ({
      role,
      label: PREGAME_ROLE_LABELS[role],
      isOpen: (claimedByRole.get(role) ?? []).length === 0,
      claimedBy: claimedByRole.get(role) ?? [],
    })),
    recentClaims,
  };
}

function buildPregameDigestEntry(input: {
  planning: PregamePlanningResponse;
  ownCharacter: Awaited<ReturnType<ApiServiceDependencies['db']['characterRepository']['findOwnedCharacterInGame']>>;
}): PregameDigestEntryResponse | null {
  const latestClaim = input.planning.recentClaims[0] ?? null;
  const openNeeds = input.planning.partyNeeds.filter((need) => need.isOpen);

  if (input.ownCharacter && input.ownCharacter.status === 'DRAFT' && openNeeds.length > 0) {
    return {
      digestId: `${input.planning.gameId}:edit`,
      gameId: input.planning.gameId,
      gameName: input.planning.gameName,
      headline: input.planning.activePrompt?.title ?? `Open roles in ${input.planning.gameName}`,
      detail: `Your draft can still move toward ${openNeeds.map((need) => need.label).join(', ')}.`,
      destination: 'EDIT_CHARACTER',
      characterId: input.ownCharacter.characterId,
      createdAt: input.planning.activePrompt?.createdAt ?? latestClaim?.createdAt ?? input.ownCharacter.updatedAt,
    };
  }

  if (!input.ownCharacter && openNeeds.length > 0) {
    return {
      digestId: `${input.planning.gameId}:create`,
      gameId: input.planning.gameId,
      gameName: input.planning.gameName,
      headline: input.planning.activePrompt?.title ?? `Party needs ${openNeeds.map((need) => need.label).join(', ')}`,
      detail: `Create a character if you want to cover ${openNeeds.map((need) => need.label).join(', ')}.`,
      destination: 'CREATE_CHARACTER',
      characterId: null,
      createdAt: input.planning.activePrompt?.createdAt ?? latestClaim?.createdAt ?? '',
    };
  }

  if (input.planning.activePrompt) {
    return {
      digestId: `${input.planning.gameId}:lobby`,
      gameId: input.planning.gameId,
      gameName: input.planning.gameName,
      headline: input.planning.activePrompt.title,
      detail: input.planning.activePrompt.prompt,
      destination: 'LOBBY',
      characterId: input.ownCharacter?.characterId ?? null,
      createdAt: input.planning.activePrompt.createdAt,
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
