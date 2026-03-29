import type { CharacterItem, CommandLogItem, GameMetadataItem, PlayerRole } from '@starter/shared';
import { assertActorHasRole, isActorAdmin, type DbAccess } from '@starter/services-shared';
import { resolveActorIdentity, type ResolvedActorIdentity } from './auth.js';

interface RequireActorInput {
  authorizationHeader?: string;
  devActorIdHeader?: string;
  bypassActorId?: string;
  bypassAllowed: boolean;
}

export async function requireActor(input: RequireActorInput): Promise<ResolvedActorIdentity> {
  return resolveActorIdentity({
    bypassAllowed: input.bypassAllowed,
    authorizationHeader: input.authorizationHeader,
    devActorIdHeader: input.devActorIdHeader,
    bypassActorId: input.bypassActorId,
  });
}

export async function requireRole(input: {
  db: DbAccess;
  identity: ResolvedActorIdentity;
  role: PlayerRole;
  gameId?: string;
}): Promise<void> {
  await assertActorHasRole(input.db, {
    actorId: input.identity.actorId,
    role: input.role,
    gameId: input.gameId,
  });
}

export async function requireGameAccess(input: {
  db: DbAccess;
  identity: ResolvedActorIdentity;
  gameId: string;
  characterId?: string;
}): Promise<{ game: GameMetadataItem; character: CharacterItem | null }> {
  const game = await input.db.gameRepository.getGameMetadata(input.gameId);
  if (!game) {
    throw withCode(new Error(`game not found: ${input.gameId}`), 'GAME_NOT_FOUND', 404);
  }

  if (await isActorAdmin(input.db, input.identity.actorId)) {
    return {
      game,
      character: input.characterId ? await requireCharacter(input.db, input.gameId, input.characterId) : null,
    };
  }

  if (input.characterId) {
    const character = await requireCharacter(input.db, input.gameId, input.characterId);
    if (character.ownerPlayerId === input.identity.actorId) {
      return { game, character };
    }

    const membership = await input.db.membershipRepository.getMembership(input.gameId, input.identity.actorId);
    if (membership) {
      return { game, character };
    }

    throw withCode(
      new Error(`character access required for actor "${input.identity.actorId}" and ${input.gameId}/${input.characterId}`),
      'CHARACTER_ACCESS_REQUIRED',
      403
    );
  }

  const membership = await input.db.membershipRepository.getMembership(input.gameId, input.identity.actorId);
  if (membership) {
    return { game, character: null };
  }

  throw withCode(
    new Error(`game access required for actor "${input.identity.actorId}" and game "${input.gameId}"`),
    'GAME_ACCESS_REQUIRED',
    403
  );
}

export async function requireCommandAccess(input: {
  db: DbAccess;
  identity: ResolvedActorIdentity;
  commandId: string;
}): Promise<CommandLogItem> {
  const entry = await input.db.commandLogRepository.get(input.commandId);
  if (!entry) {
    throw withCode(new Error(`command not found: ${input.commandId}`), 'COMMAND_NOT_FOUND', 404);
  }

  if ((await isActorAdmin(input.db, input.identity.actorId)) || entry.actorId === input.identity.actorId) {
    return entry;
  }

  throw withCode(
    new Error(`command access required for actor "${input.identity.actorId}" and command "${input.commandId}"`),
    'COMMAND_ACCESS_REQUIRED',
    403
  );
}

async function requireCharacter(db: DbAccess, gameId: string, characterId: string): Promise<CharacterItem> {
  const character = await db.characterRepository.getCharacter(gameId, characterId);
  if (!character) {
    throw withCode(new Error(`character not found: ${gameId}/${characterId}`), 'CHARACTER_NOT_FOUND', 404);
  }
  return character;
}

function withCode(error: Error, code: string, statusCode: number): Error & { code: string; statusCode: number } {
  const enriched = error as Error & { code: string; statusCode: number };
  enriched.code = code;
  enriched.statusCode = statusCode;
  return enriched;
}
