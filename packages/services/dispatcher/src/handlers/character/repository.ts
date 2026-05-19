import { isPlayerCharacterLibraryGameId, type CharacterItem } from '@starter/shared';
import type { DbAccess } from '@starter/services-shared';

export async function requireCharacter(db: DbAccess, gameId: string, characterId: string): Promise<CharacterItem> {
  const character = await db.characterRepository.getCharacter(gameId, characterId);
  if (!character) {
    throw new Error(`character not found: ${gameId}/${characterId}`);
  }
  return character;
}

export async function assertActorCanCreateCharacterInGame(
  db: DbAccess,
  input: { gameId: string; actorId: string; existingCharacterId?: string | null }
): Promise<void> {
  if (isPlayerCharacterLibraryGameId(input.gameId)) {
    return;
  }

  const existing = await db.characterRepository.findOwnedCharacterInGame(input.gameId, input.actorId);
  if (!existing || existing.characterId === input.existingCharacterId) {
    return;
  }

  const error = new Error(
    `player "${input.actorId}" already has character "${existing.characterId}" in game "${input.gameId}"`
  );
  (error as Error & { code?: string }).code = 'PLAYER_ALREADY_HAS_CHARACTER_IN_GAME';
  throw error;
}
