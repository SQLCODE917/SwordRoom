import type { CharacterDraft, GameInviteItem, PlayerInboxItem } from '@starter/shared';
import type { CommandHandler } from '../types.js';
import { assertExpectedGameVersion, requireActiveGame } from './shared.js';

const archivedGameMemberMessage = (gameName: string) => `Game "${gameName}" was deleted by the GM.`;
const archivedInviteMessage = (gameName: string) =>
  `Invitation to ${gameName} was cancelled because the game was deleted.`;
const archivedPendingCharacterMessage = 'Application closed because the game was deleted.';
const archivedPendingCharacterGmNote = 'This game was deleted before your application was reviewed.';

export const archiveGameHandler: CommandHandler<'ArchiveGame'> = async (ctx, envelope) => {
  const game = await requireActiveGame(ctx.db, envelope.payload.gameId);
  assertExpectedGameVersion(game, envelope.payload.expectedVersion);
  const updatedAt = ctx.nowIso();

  const [memberships, invites, characters, gmInboxItems] = await Promise.all([
    ctx.db.membershipRepository.listMembershipsForGame(game.gameId),
    ctx.db.inviteRepository.listInvitesForGame(game.gameId),
    ctx.db.characterRepository.listCharactersForGame(game.gameId),
    ctx.db.inboxRepository.queryGmInbox(game.gameId),
  ]);

  const pendingInvites = invites.filter((invite) => invite.status === 'PENDING');
  const pendingCharacters = characters.filter((character) => character.status === 'PENDING');
  const pendingCharacterIds = new Set(pendingCharacters.map((character) => character.characterId));
  const invitePromptLookups = await Promise.all(
    pendingInvites.map(async (invite) => ({
      invite,
      prompt: findInvitePrompt(await ctx.db.inboxRepository.queryPlayerInbox(invite.invitedPlayerId), invite),
    }))
  );

  const pendingApplicantIds = new Set(pendingCharacters.map((character) => character.ownerPlayerId));
  const pendingInvitePlayerIds = new Set(pendingInvites.map((invite) => invite.invitedPlayerId));
  const memberNotificationPlayerIds = memberships
    .map((membership) => membership.playerId)
    .filter(
      (playerId, index, items) =>
        playerId !== envelope.actorId &&
        !pendingApplicantIds.has(playerId) &&
        !pendingInvitePlayerIds.has(playerId) &&
        items.indexOf(playerId) === index
    );

  return {
    writes: [
      {
        kind: 'UPDATE_GAME_METADATA_WITH_VERSION',
        input: {
          gameId: game.gameId,
          expectedVersion: game.version,
          next: {
            name: game.name,
            visibility: game.visibility,
            lifecycleStatus: 'ARCHIVED',
            archivedAt: envelope.createdAt,
            archivedByPlayerId: envelope.actorId,
            createdByPlayerId: game.createdByPlayerId,
            gmPlayerId: game.gmPlayerId,
            updatedAt,
          },
        },
      },
      ...pendingInvites.map((invite) => toCancelledInviteWrite(invite, updatedAt, envelope.createdAt)),
      ...pendingCharacters.map((character) => ({
        kind: 'UPDATE_CHARACTER_WITH_VERSION' as const,
        input: {
          gameId: character.gameId,
          characterId: character.characterId,
          expectedVersion: character.version,
          next: {
            ownerPlayerId: character.ownerPlayerId,
            draft: {
              ...character.draft,
              gmNote: archivedPendingCharacterGmNote,
            } satisfies CharacterDraft,
            status: 'REJECTED' as const,
            updatedAt,
            submittedAt: character.submittedAt ?? null,
            submittedDraftVersion: character.submittedDraftVersion ?? null,
          },
        },
      })),
      ...gmInboxItems
        .filter((item) => item.kind === 'PENDING_CHARACTER' && item.ref.characterId && pendingCharacterIds.has(item.ref.characterId))
        .map((item) => ({
          kind: 'DELETE_GM_INBOX_ITEM' as const,
          input: {
            gameId: item.gameId,
            createdAt: item.createdAt,
            promptId: item.promptId,
          },
        })),
      ...invitePromptLookups
        .filter((entry): entry is { invite: GameInviteItem; prompt: PlayerInboxItem } => entry.prompt !== null)
        .map((entry) => ({
          kind: 'DELETE_PLAYER_INBOX_ITEM' as const,
          input: {
            playerId: entry.invite.invitedPlayerId,
            createdAt: entry.prompt.createdAt,
            promptId: entry.prompt.promptId,
          },
        })),
    ],
    inbox: [
      ...memberNotificationPlayerIds.map((playerId) => ({
        kind: 'PLAYER_INBOX_ITEM' as const,
        input: {
          playerId,
          promptId: `${envelope.commandId}:member:${playerId}`,
          gameId: game.gameId,
          kind: 'ACTION_REQUIRED' as const,
          ref: { commandId: envelope.commandId, playerId },
          message: archivedGameMemberMessage(game.name),
          createdAt: envelope.createdAt,
          readAt: null,
        },
      })),
      ...pendingInvites.map((invite) => ({
        kind: 'PLAYER_INBOX_ITEM' as const,
        input: {
          playerId: invite.invitedPlayerId,
          promptId: `${envelope.commandId}:invite:${invite.inviteId}`,
          gameId: game.gameId,
          kind: 'ACTION_REQUIRED' as const,
          ref: { inviteId: invite.inviteId, commandId: envelope.commandId, playerId: invite.invitedPlayerId },
          message: archivedInviteMessage(game.name),
          createdAt: envelope.createdAt,
          readAt: null,
        },
      })),
      ...pendingCharacters.map((character) => ({
        kind: 'PLAYER_INBOX_ITEM' as const,
        input: {
          playerId: character.ownerPlayerId,
          promptId: `${envelope.commandId}:pending:${character.characterId}`,
          gameId: game.gameId,
          kind: 'CHAR_REJECTED' as const,
          ref: { characterId: character.characterId, commandId: envelope.commandId },
          message: archivedPendingCharacterMessage,
          createdAt: envelope.createdAt,
          readAt: null,
        },
      })),
    ],
    notifications: [],
  };
};

function toCancelledInviteWrite(invite: GameInviteItem, updatedAt: string, respondedAt: string) {
  return {
    kind: 'UPDATE_GAME_INVITE_WITH_VERSION' as const,
    input: {
      gameId: invite.gameId,
      inviteId: invite.inviteId,
      expectedVersion: invite.version,
      next: {
        invitedPlayerId: invite.invitedPlayerId,
        invitedEmailNormalized: invite.invitedEmailNormalized,
        invitedByPlayerId: invite.invitedByPlayerId,
        status: 'CANCELLED' as const,
        updatedAt,
        respondedAt,
      },
    },
  };
}

function findInvitePrompt(playerInbox: PlayerInboxItem[], invite: GameInviteItem): PlayerInboxItem | null {
  return (
    playerInbox.find(
      (item) => item.kind === 'GAME_INVITE' && (item.promptId === invite.inviteId || item.ref.inviteId === invite.inviteId)
    ) ?? null
  );
}
