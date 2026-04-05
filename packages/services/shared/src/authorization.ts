import { isArchivedGame, type PlayerRole } from '@starter/shared';
import type { DbAccess } from './db.js';

export interface GameActorContext {
  actorId: string;
  gameId: string;
  displayName: string | null;
  roles: PlayerRole[];
  gmPlayerId: string | null;
  isGameMaster: boolean;
}

export async function getGameActorContext(
  db: DbAccess,
  input: { gameId: string; actorId: string }
): Promise<GameActorContext> {
  const [game, profile, membership, entitlement] = await Promise.all([
    db.gameRepository.getGameMetadata(input.gameId),
    db.playerRepository.getPlayerProfile(input.actorId),
    db.membershipRepository.getMembership(input.gameId, input.actorId),
    db.entitlementRepository.getPlatformEntitlement(input.actorId),
  ]);

  const roles = mergeRoles(['PLAYER'], entitlement?.roles ?? [], membership?.roles ?? []);
  const gmPlayerId = game?.gmPlayerId ?? null;
  const isAdmin = roles.includes('ADMIN');
  const isGameMaster = isAdmin || (membership?.roles.includes('GM') ?? false);

  return {
    actorId: input.actorId,
    gameId: input.gameId,
    displayName: profile?.displayName ?? null,
    roles,
    gmPlayerId,
    isGameMaster,
  };
}

export async function getActorProfileRoles(db: DbAccess, actorId: string): Promise<PlayerRole[]> {
  const [entitlement, gmGames] = await Promise.all([
    db.entitlementRepository.getPlatformEntitlement(actorId),
    db.gameRepository.listGamesForGm(actorId),
  ]);

  return mergeRoles(['PLAYER'], entitlement?.roles ?? [], gmGames.length > 0 ? ['GM'] : []);
}

export async function isActorAdmin(db: DbAccess, actorId: string): Promise<boolean> {
  const entitlement = await db.entitlementRepository.getPlatformEntitlement(actorId);
  return entitlement?.roles.includes('ADMIN') ?? false;
}

export async function assertGameMasterActor(
  db: DbAccess,
  input: { gameId: string; actorId: string }
): Promise<GameActorContext> {
  const context = await getGameActorContext(db, input);

  if (!context.gmPlayerId) {
    throw withCode(new Error(`game not found or missing gmPlayerId: ${input.gameId}`), 'GAME_NOT_FOUND', 404);
  }

  const game = await db.gameRepository.getGameMetadata(input.gameId);
  if (!game || isArchivedGame(game)) {
    throw withCode(new Error(`game archived: ${input.gameId}`), 'GAME_ARCHIVED', 404);
  }

  if (!context.isGameMaster) {
    throw withCode(
      new Error(`GM authorization required for game "${input.gameId}" and actor "${input.actorId}"`),
      'GM_AUTH_REQUIRED',
      403
    );
  }

  return context;
}

export async function assertActorHasRole(
  db: DbAccess,
  input: { actorId: string; role: PlayerRole; gameId?: string }
): Promise<void> {
  if (input.role === 'PLAYER') {
    return;
  }

  const roles = input.gameId
    ? (await getGameActorContext(db, { gameId: input.gameId, actorId: input.actorId })).roles
    : await getActorProfileRoles(db, input.actorId);

  if (roles.includes('ADMIN') || roles.includes(input.role)) {
    return;
  }

  throw withCode(
    new Error(`role "${input.role}" required for actor "${input.actorId}"`),
    'ROLE_REQUIRED',
    403
  );
}

export async function assertCharacterOwnerOrGameMaster(
  db: DbAccess,
  input: { gameId: string; characterId: string; actorId: string }
): Promise<void> {
  const character = await db.characterRepository.getCharacter(input.gameId, input.characterId);
  if (!character) {
    throw withCode(
      new Error(`character not found: ${input.gameId}/${input.characterId}`),
      'CHARACTER_NOT_FOUND',
      404
    );
  }

  if (character.ownerPlayerId === input.actorId) {
    return;
  }

  await assertGameMasterActor(db, {
    gameId: input.gameId,
    actorId: input.actorId,
  });
}

function mergeRoles(...groups: ReadonlyArray<ReadonlyArray<string>>): PlayerRole[] {
  const roles = new Set<PlayerRole>();
  for (const group of groups) {
    for (const role of group) {
      if (role === 'PLAYER' || role === 'GM' || role === 'ADMIN') {
        roles.add(role);
      }
    }
  }
  if (!roles.has('PLAYER')) {
    roles.add('PLAYER');
  }
  return Array.from(roles);
}

function withCode(error: Error, code: string, statusCode: number): Error & { code: string; statusCode: number } {
  const enriched = error as Error & { code: string; statusCode: number };
  enriched.code = code;
  enriched.statusCode = statusCode;
  return enriched;
}
