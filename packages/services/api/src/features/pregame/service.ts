import type { PregameRole } from '@starter/shared';
import type { PregamePlanningResponse } from '../../apiTypes.js';
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
): ReadApisSubset<'getPregamePlanning'> {
  return {
    async getPregamePlanning(gameId: string, actorId: string): Promise<PregamePlanningResponse> {
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
    },
  };
}
