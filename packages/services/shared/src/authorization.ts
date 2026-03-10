import type { DbAccess } from './db.js';

export interface GameActorContext {
  actorId: string;
  gameId: string;
  displayName: string | null;
  roles: string[];
  gmPlayerId: string | null;
  isGameMaster: boolean;
}

export async function getGameActorContext(
  db: DbAccess,
  input: { gameId: string; actorId: string }
): Promise<GameActorContext> {
  const [game, profile, membership] = await Promise.all([
    db.gameRepository.getGameMetadata(input.gameId),
    db.playerRepository.getPlayerProfile(input.actorId),
    db.membershipRepository.getMembership(input.gameId, input.actorId),
  ]);

  const roles = Array.from(new Set([...(profile?.roles ?? inferRolesFromActorId(input.actorId)), ...(membership?.roles ?? [])]));
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

export async function assertGameMasterActor(
  db: DbAccess,
  input: { gameId: string; actorId: string }
): Promise<GameActorContext> {
  const context = await getGameActorContext(db, input);

  if (!context.gmPlayerId) {
    throw withCode(new Error(`game not found or missing gmPlayerId: ${input.gameId}`), 'GAME_NOT_FOUND', 404);
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
  input: { actorId: string; role: 'PLAYER' | 'GM' | 'ADMIN' }
): Promise<void> {
  const profile = await db.playerRepository.getPlayerProfile(input.actorId);
  const roles = profile?.roles ?? inferRolesFromActorId(input.actorId);
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

function withCode(error: Error, code: string, statusCode: number): Error & { code: string; statusCode: number } {
  const enriched = error as Error & { code: string; statusCode: number };
  enriched.code = code;
  enriched.statusCode = statusCode;
  return enriched;
}

function inferRolesFromActorId(actorId: string): Array<'PLAYER' | 'GM' | 'ADMIN'> {
  const roles = new Set<'PLAYER' | 'GM' | 'ADMIN'>(['PLAYER']);
  if (actorId.startsWith('gm-')) {
    roles.add('GM');
  }
  if (actorId.startsWith('admin-')) {
    roles.add('ADMIN');
  }
  return Array.from(roles);
}
