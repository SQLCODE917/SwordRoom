import type {
  GameplayCharacterCombatProfile,
  GameplaySceneSeedInput,
} from '@starter/engine';
import type { CharacterItem } from '@starter/shared';
import { getGameplayLoopFixture } from '@starter/shared/fixtures';

export function toGameplaySceneSeed(
  fixture: ReturnType<typeof getGameplayLoopFixture>
): GameplaySceneSeedInput {
  return {
    scenarioId: fixture.seedId,
    sceneTitle: fixture.scene.title,
    sceneSummary: fixture.scene.summary,
    focusPrompt: fixture.scene.focus_prompt,
    enemies: fixture.enemies.map((enemy) => ({
      combatantId: enemy.combatantId,
      displayName: enemy.displayName,
      lifePoints: enemy.lifePoints,
      stats: enemy.stats,
    })),
  };
}

export function toGameplayCharacterCombatProfile(
  character: CharacterItem,
  actorId: string,
  fallbackDisplayName?: string | null
): GameplayCharacterCombatProfile {
  return {
    actorId,
    characterId: character.characterId,
    fallbackDisplayName,
    identityName: character.draft.identity.name,
    abilities: {
      agi: character.draft.ability.agi,
      int: character.draft.ability.int,
      lf: character.draft.ability.lf,
    },
    bonuses: {
      dex: character.draft.bonus.dex,
      agi: character.draft.bonus.agi,
      str: character.draft.bonus.str,
    },
    skills: character.draft.skills,
  };
}
