import { describe, expect, it } from 'vitest';
import type { CharacterItem } from '@starter/shared';
import { getGameplayLoopFixture } from '@starter/shared/fixtures';
import {
  toGameplayCharacterCombatProfile,
  toGameplaySceneSeed,
} from './mappers.js';

describe('gameplay engine mappers', () => {
  it('maps gameplay fixtures into engine scene seeds', () => {
    const fixture = getGameplayLoopFixture('rpg_sample_tavern');

    expect(toGameplaySceneSeed(fixture)).toEqual({
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
    });
  });

  it('maps approved characters into engine combat profiles', () => {
    const character = createCharacter({
      actorId: 'player-1',
      characterId: 'char-hero',
      name: 'Asha',
    });

    expect(
      toGameplayCharacterCombatProfile(character, 'player-1', 'Fallback Name')
    ).toEqual({
      actorId: 'player-1',
      characterId: 'char-hero',
      fallbackDisplayName: 'Fallback Name',
      identityName: 'Asha',
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
    });
  });
});

function createCharacter(input: {
  actorId: string;
  characterId: string;
  name: string;
}): CharacterItem {
  return {
    pk: `GAME#game-1`,
    sk: `CHAR#${input.characterId}`,
    type: 'Character',
    gameId: 'game-1',
    characterId: input.characterId,
    ownerPlayerId: input.actorId,
    status: 'APPROVED',
    draft: {
      race: 'HUMAN',
      raisedBy: null,
      subAbility: { A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1, H: 1 },
      ability: { dex: 12, agi: 14, int: 11, str: 10, lf: 15, mp: 8 },
      bonus: { dex: 2, agi: 3, int: 1, str: 1, lf: 4, mp: 2 },
      background: { kind: null, roll2d: null },
      starting: {
        expTotal: 3000,
        expUnspent: 500,
        moneyGamels: 1200,
        moneyRoll2d: 7,
        startingSkills: [],
      },
      skills: [{ skillId: 'fencer', level: 2 }],
      purchases: { weapons: [], armor: [], shields: [], gear: [] },
      appearance: { imageKey: null, imageUrl: null, updatedAt: null },
      identity: { name: input.name, age: 19, gender: 'FEMALE' },
      noteToGm: null,
      gmNote: null,
    },
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    version: 1,
  };
}
