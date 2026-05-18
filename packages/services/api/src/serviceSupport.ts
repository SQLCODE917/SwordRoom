import { isActiveGame, gameplayLoopGraph } from '@starter/shared';
import { getActorProfileRoles, type DbAccess } from '@starter/services-shared';
import type { GameplayViewResponse, ReadApis } from './apiTypes.js';
import type { ApiServiceDependencies } from './index.js';

export async function withEffectiveProfileRoles(
  db: DbAccess,
  profile: Awaited<ReturnType<DbAccess['playerRepository']['getPlayerProfile']>> extends infer T ? Exclude<T, null> : never
) {
  return {
    ...profile,
    roles: await getActorProfileRoles(db, profile.playerId),
  };
}

export function resolveApiAuthEnv(deps: ApiServiceDependencies): Record<string, string | undefined> {
  if (!deps.jwtBypass) {
    return process.env;
  }

  return {
    ...process.env,
    AUTH_MODE: process.env.AUTH_MODE ?? 'dev',
    ALLOW_DEV_AUTH: process.env.ALLOW_DEV_AUTH ?? '1',
  };
}

export function createApiError(message: string, code: string, statusCode: number): Error & { code: string; statusCode: number } {
  const error = new Error(message) as Error & { code: string; statusCode: number };
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

export async function requireActiveGameMetadata(db: DbAccess, gameId: string) {
  const game = await db.gameRepository.getGameMetadata(gameId);
  assertActiveGame(gameId, game);
  return game;
}

export function assertActiveGame(
  gameId: string,
  game: Awaited<ReturnType<DbAccess['gameRepository']['getGameMetadata']>>
): asserts game is NonNullable<Awaited<ReturnType<DbAccess['gameRepository']['getGameMetadata']>>> {
  if (!game) {
    throw createApiError(`game not found: ${gameId}`, 'GAME_NOT_FOUND', 404);
  }
  if (!isActiveGame(game)) {
    throw createApiError(`game archived: ${gameId}`, 'GAME_ARCHIVED', 404);
  }
}

export function readCharacterIdentityName(character: { draft: { identity: { name: string } }; characterId: string }): string {
  const name = character.draft.identity.name.trim();
  return name || character.characterId;
}

export function formatChatDisplayName(name: string, role: 'PLAYER' | 'GM'): string {
  return role === 'GM' ? `@${name}` : name;
}

export async function buildGameplayView(
  db: DbAccess,
  gameId: string,
  view: 'PLAYER' | 'GM'
): Promise<GameplayViewResponse | null> {
  const [game, session, memberships, publicEvents, gmOnlyEvents] = await Promise.all([
    db.gameRepository.getGameMetadata(gameId),
    db.gameplayRepository.getSession(gameId),
    db.membershipRepository.listMembershipsForGame(gameId),
    db.gameplayRepository.queryEvents(gameId, 'PUBLIC'),
    view === 'GM' ? db.gameplayRepository.queryEvents(gameId, 'GM_ONLY') : Promise.resolve([]),
  ]);
  assertActiveGame(gameId, game);

  if (!session) {
    return null;
  }

  const participants = await Promise.all(
    memberships.map(async (membership) => {
      const [profile, character] = await Promise.all([
        db.playerRepository.getPlayerProfile(membership.playerId),
        db.characterRepository.findOwnedCharacterInGame(gameId, membership.playerId),
      ]);
      return {
        playerId: membership.playerId,
        displayName: character?.draft.identity.name.trim() || profile?.displayName?.trim() || membership.playerId,
        role: membership.roles.includes('GM') ? 'GM' : 'PLAYER',
        characterId: character?.characterId ?? null,
      } as const;
    })
  );

  const sortedParticipants = participants.sort((left, right) => {
    if (left.role !== right.role) {
      return left.role === 'GM' ? -1 : 1;
    }
    return left.displayName.localeCompare(right.displayName);
  });

  return {
    gameId: game.gameId,
    gameName: game.name,
    view,
    graph: gameplayLoopGraph,
    participants: sortedParticipants,
    session: session.state,
    publicEvents: publicEvents.map(toGameplayEventRecord),
    ...(view === 'GM' ? { gmOnlyEvents: gmOnlyEvents.map(toGameplayEventRecord) } : {}),
  };
}

export function toGameplayEventRecord(event: Awaited<ReturnType<DbAccess['gameplayRepository']['queryEvents']>>[number]) {
  return {
    eventId: event.eventId,
    gameId: event.gameId,
    audience: event.audience,
    eventKind: event.eventKind,
    nodeId: event.nodeId,
    actorId: event.actorId,
    title: event.title,
    body: event.body,
    detail: event.detail,
    createdAt: event.createdAt,
  };
}

export type ReadApisSubset<TKey extends keyof ReadApis> = Pick<ReadApis, TKey>;
