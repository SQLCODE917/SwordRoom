import type { GameChatParticipantResponse } from '../../apiTypes.js';
import type { ApiServiceDependencies } from '../../index.js';
import { assertActiveGame, buildGameplayView, formatChatDisplayName, readCharacterIdentityName, type ReadApisSubset } from '../../serviceSupport.js';

export function createGameplayReadApis(
  deps: ApiServiceDependencies
): ReadApisSubset<'getGameChat' | 'getGameplayLifecycle' | 'getPlayerGameplayView' | 'getGmGameplayView'> {
  return {
    async getGameChat(gameId: string) {
      const [game, memberships, messages] = await Promise.all([
        deps.db.gameRepository.getGameMetadata(gameId),
        deps.db.membershipRepository.listMembershipsForGame(gameId),
        deps.db.chatRepository.queryMessages(gameId),
      ]);
      assertActiveGame(gameId, game);

      const participantRecords = await Promise.all(
        memberships.map(async (membership) => {
          const [profile, character] = await Promise.all([
            deps.db.playerRepository.getPlayerProfile(membership.playerId),
            deps.db.characterRepository.findOwnedCharacterInGame(gameId, membership.playerId),
          ]);
          const role: GameChatParticipantResponse['role'] = membership.roles.includes('GM') ? 'GM' : 'PLAYER';
          const baseName = character
            ? readCharacterIdentityName(character)
            : (profile?.displayName?.trim() || membership.playerId);
          return {
            playerId: membership.playerId,
            displayName: formatChatDisplayName(baseName, role),
            sortName: baseName.toLocaleLowerCase(),
            role,
            characterId: character?.characterId ?? null,
          };
        })
      );

      const participants = participantRecords
        .sort((left, right) => {
          if (left.role !== right.role) {
            return left.role === 'GM' ? -1 : 1;
          }
          return left.sortName.localeCompare(right.sortName);
        })
        .map(({ sortName: _sortName, ...participant }) => participant);

      return {
        gameId: game.gameId,
        gameName: game.name,
        participants,
        messages: messages.map((message) => ({
          messageId: message.messageId,
          senderPlayerId: message.senderPlayerId,
          senderDisplayName: formatChatDisplayName(message.senderNameSnapshot, message.senderRole),
          senderRole: message.senderRole,
          senderCharacterId: message.senderCharacterId,
          body: message.body,
          artifact: message.artifact,
          replyTarget: message.replyTarget,
          createdAt: message.createdAt,
        })),
      };
    },

    async getPlayerGameplayView(gameId: string) {
      return buildGameplayView(deps.db, gameId, 'PLAYER');
    },

    async getGmGameplayView(gameId: string) {
      return buildGameplayView(deps.db, gameId, 'GM');
    },

    async getGameplayLifecycle(gameId: string) {
      const [game, session] = await Promise.all([
        deps.db.gameRepository.getGameMetadata(gameId),
        deps.db.gameplayRepository.getSession(gameId),
      ]);
      assertActiveGame(gameId, game);

      const hasGameplaySession = session !== null;
      return {
        gameId: game.gameId,
        phase: hasGameplaySession ? 'LIVE' : 'PREGAME',
        hasGameplaySession,
      } as const;
    },
  };
}
