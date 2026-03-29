import { describe, expect, it } from 'vitest';
import {
  ADVENTURER_SKILLS,
  GENERAL_SKILL_EXAMPLES,
  HUMAN_ABILITY_SCORE_GUIDANCE,
  PLAYER_CHARACTER_ADVENTURER_SKILLS,
  RACES,
  adultRecognitionAges,
  applyAgeBasedAbilityAdjustments,
  averageAbilityScoresByRace,
  canRaceAcquireSkill,
  characterCreationSkillOptions,
  characterSheetFieldOrder,
  computeAbilityBonus,
  computeAdventurerLevel,
  divideAndRound,
  getRestrictedSkillsForRace,
  genderRules,
  humanAgeGuidance,
  nameGuidance,
  resolveAgeModifierProfile,
  rollFormula,
} from './characterCreation.js';

describe('0 - Dice notation and rounding', () => {
  it('turns dice notation into integers for 1D, 2D, and 1/2D', () => {
    const min = () => 0;
    const max = () => 0.999999;

    expect(rollFormula('1D', min)).toBe(1);
    expect(rollFormula('2D', min)).toBe(2);
    expect(rollFormula('1/2D', min)).toBe(1);
    expect(rollFormula('1/2D', max)).toBe(3);
    expect(rollFormula('2D+6', min)).toBe(8);
  });

  it('rounds up by default and supports explicit round down', () => {
    expect(divideAndRound(5, 2)).toBe(3);
    expect(divideAndRound(5, 2, 'UP')).toBe(3);
    expect(divideAndRound(5, 2, 'DOWN')).toBe(2);
    expect(divideAndRound(13, 6)).toBe(3);
    expect(divideAndRound(13, 6, 'DOWN')).toBe(2);
  });
});

describe('1 - Ability Scores', () => {
  it('keeps the six core ability scores and uses floor(score / 6) for bonuses', () => {
    expect(Object.keys(averageAbilityScoresByRace.HUMAN)).toEqual(['DEX', 'AGI', 'INT', 'STR', 'LF', 'MP']);
    expect(computeAbilityBonus(5)).toBe(0);
    expect(computeAbilityBonus(6)).toBe(1);
    expect(computeAbilityBonus(17)).toBe(2);
    expect(computeAbilityBonus(24)).toBe(4);
    expect(computeAbilityBonus(30)).toBe(5);
  });

  it('captures the human starting-score guidance from the rulebook', () => {
    expect(HUMAN_ABILITY_SCORE_GUIDANCE).toEqual({
      min: 4,
      max: 24,
      average: 14,
    });
    expect(averageAbilityScoresByRace.HUMAN).toEqual({
      DEX: 14,
      AGI: 14,
      INT: 14,
      STR: 14,
      LF: 14,
      MP: 14,
    });
  });
});

describe('2 - Skills (Skill Types + Adventurer Level)', () => {
  it('separates PC-legal adventurer skills from non-PC adventurer skills', () => {
    expect(PLAYER_CHARACTER_ADVENTURER_SKILLS).toEqual([
      'Fighter',
      'Thief',
      'Ranger',
      'Sage',
      'Bard',
      'Sorcerer',
      'Shaman',
      'Priest',
    ]);
    expect(ADVENTURER_SKILLS).toContain('Dark Priest');
    expect(ADVENTURER_SKILLS).toContain('Dragon Priest');
    expect(GENERAL_SKILL_EXAMPLES).toContain('Merchant');
  });

  it('computes Adventurer Level as the highest adventurer-skill level only', () => {
    expect(
      computeAdventurerLevel([
        { skill: 'Merchant', level: 5 },
        { skill: 'Ranger', level: 2 },
        { skill: 'Fighter', level: 1 },
      ])
    ).toBe(2);
  });
});

describe('3 - Races (PC races + rule characteristics)', () => {
  it('lists the five playable races and their race-based acquisition restrictions', () => {
    expect(RACES).toEqual(['HUMAN', 'DWARF', 'GRASSRUNNER', 'ELF', 'HALF_ELF']);
    expect(getRestrictedSkillsForRace('DWARF', null)).toEqual(['Sorcerer', 'Shaman']);
    expect(getRestrictedSkillsForRace('GRASSRUNNER', null)).toEqual(['Sorcerer', 'Shaman', 'Priest']);
    expect(getRestrictedSkillsForRace('ELF', null)).toEqual(['Priest']);
    expect(getRestrictedSkillsForRace('HALF_ELF', 'ELVES')).toEqual(['Priest']);
  });

  it('answers race-specific acquisition legality', () => {
    expect(canRaceAcquireSkill('DWARF', null, 'Fighter')).toBe(true);
    expect(canRaceAcquireSkill('DWARF', null, 'Sorcerer')).toBe(false);
    expect(canRaceAcquireSkill('GRASSRUNNER', null, 'Shaman')).toBe(false);
    expect(canRaceAcquireSkill('HALF_ELF', 'HUMANS', 'Priest')).toBe(true);
  });
});

describe('8 - Fill out the character sheet', () => {
  it('keeps the rulebook field order through Adventurer Level and equipment purchase', () => {
    expect(characterSheetFieldOrder.slice(0, 5)).toEqual([
      { step: 1, label: 'Player Name' },
      { step: 2, label: 'Race' },
      { step: 3, label: 'Sub-Ability Scores' },
      { step: 4, label: 'Ability Scores' },
      { step: 5, label: 'Ability Bonuses' },
    ]);
    expect(characterSheetFieldOrder[13]).toEqual({ step: 14, label: 'Adventurer Level' });
    expect(characterSheetFieldOrder[14]).toEqual({ step: 15, label: 'Purchase Equipment' });
  });

  it('keeps adventurer-skill max levels aligned with the creation table', () => {
    expect(characterCreationSkillOptions).toEqual([
      { skill: 'Fighter', label: 'Fighter', maxLevel: 2 },
      { skill: 'Thief', label: 'Thief', maxLevel: 2 },
      { skill: 'Ranger', label: 'Ranger', maxLevel: 3 },
      { skill: 'Sage', label: 'Sage', maxLevel: 3 },
      { skill: 'Bard', label: 'Bard', maxLevel: 3 },
      { skill: 'Priest', label: 'Priest', maxLevel: 2 },
      { skill: 'Shaman', label: 'Shaman', maxLevel: 2 },
      { skill: 'Sorcerer', label: 'Sorcerer', maxLevel: 1 },
    ]);
  });
});

describe('9 - Optional rule that can affect character creation: Age-based ability changes', () => {
  it('applies human aging penalties with default rounding up', () => {
    const adjusted = applyAgeBasedAbilityAdjustments(
      { dex: 17, agi: 14, int: 13, str: 19, lf: 20, mp: 14 },
      { race: 'HUMAN', age: 55 }
    );

    expect(adjusted).toEqual({
      dex: 15,
      agi: 12,
      int: 13,
      str: 16,
      lf: 17,
      mp: 14,
    });
  });

  it('treats dwarf and half-elf old age as human age after halving, rounded up', () => {
    expect(resolveAgeModifierProfile({ race: 'DWARF', age: 101 })).toEqual({
      humanEquivalentAge: 51,
      physicalRetainedSixths: 5,
      mentalRetainedSixths: 6,
    });
    expect(resolveAgeModifierProfile({ race: 'HALF_ELF', raisedBy: 'ELVES', age: 100 })).toEqual({
      humanEquivalentAge: 50,
      physicalRetainedSixths: 6,
      mentalRetainedSixths: 6,
    });
  });

  it('ignores elf aging after adulthood while preserving the core age guidance constants', () => {
    expect(resolveAgeModifierProfile({ race: 'ELF', age: 150 })).toEqual({
      humanEquivalentAge: null,
      physicalRetainedSixths: 6,
      mentalRetainedSixths: 6,
    });
    expect(adultRecognitionAges.ELF).toBe(100);
    expect(humanAgeGuidance).toEqual({
      recommendedMin: 15,
      recommendedMax: 30,
      lifespan: 100,
      averageAlecrastLifespan: 50,
    });
    expect(genderRules.mechanicalDifferences).toBe(false);
    expect(nameGuidance.supportsAliases).toBe(true);
  });
});
