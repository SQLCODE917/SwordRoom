import { describe, expect, it } from 'vitest';
import {
  computeEquipmentPreview,
  computeSkillPurchasePreview,
  computeStartingPackagePreview,
  roll2dTotal,
  toSingleSelectCart,
} from './characterCreationPurchasing';

const humanRuneMasterSubAbility = { A: 9, B: 8, C: 6, D: 7, E: 7, F: 12, G: 8, H: 6 };

describe('computeStartingPackagePreview', () => {
  it('requires a merchant or sage choice for background roll 8', () => {
    const preview = computeStartingPackagePreview({
      characterId: 'char-merchant-choice',
      race: 'HUMAN',
      raisedBy: 'HUMANS',
      subAbility: humanRuneMasterSubAbility,
      backgroundRoll2dTotal: 8,
      startingMoneyRoll2dTotal: 7,
    });

    expect(preview.errors).toEqual(['merchant/scholar background requires choosing Merchant or Sage']);
  });

  it('resolves merchant background choice into starting skills and money', () => {
    const preview = computeStartingPackagePreview({
      characterId: 'char-merchant-choice',
      race: 'HUMAN',
      raisedBy: 'HUMANS',
      subAbility: humanRuneMasterSubAbility,
      backgroundRoll2dTotal: 8,
      startingMoneyRoll2dTotal: 7,
      merchantScholarChoice: 'MERCHANT',
    });

    expect(preview.errors).toEqual([]);
    expect(preview.startingSkills).toEqual([{ skill: 'Merchant', level: 3 }]);
    expect(preview.expTotal).toBe(3000);
    expect(preview.moneyGamels).toBe(1400);
  });
});

describe('computeSkillPurchasePreview', () => {
  it('uses the creation EXP cost table for Fighter 1 after Rune Master start', () => {
    const starting = computeStartingPackagePreview({
      characterId: 'char-rune-master',
      race: 'HUMAN',
      raisedBy: 'HUMANS',
      subAbility: humanRuneMasterSubAbility,
      backgroundRoll2dTotal: 3,
      startingMoneyRoll2dTotal: 9,
    });

    const preview = computeSkillPurchasePreview(starting.state, [{ skill: 'Fighter', targetLevel: 1 }]);

    expect(preview.errors).toEqual([]);
    expect(preview.expUnspent).toBe(500);
    expect(preview.skills).toEqual([
      { skill: 'Sorcerer', level: 1 },
      { skill: 'Sage', level: 1 },
      { skill: 'Fighter', level: 1 },
    ]);
  });
});

describe('computeEquipmentPreview', () => {
  it('surfaces sorcerer equipment restrictions and money totals', () => {
    const starting = computeStartingPackagePreview({
      characterId: 'char-rune-master',
      race: 'HUMAN',
      raisedBy: 'HUMANS',
      subAbility: humanRuneMasterSubAbility,
      backgroundRoll2dTotal: 3,
      startingMoneyRoll2dTotal: 9,
    });

    const equipment = computeEquipmentPreview(
      starting.state,
      toSingleSelectCart({
        weapon: '',
        armor: 'cloth_armor',
        shield: 'small_shield',
      })
    );

    expect(equipment.errors).toContain('sorcerer cannot use shield');
    expect(equipment.errors).toContain('sorcerer requires mage_staff');
    expect(equipment.totalCost).toBe(100);
    expect(equipment.moneyRemaining).toBe(1700);
  });
});

describe('roll2dTotal', () => {
  it('rolls two d6 values', () => {
    const fixed = [0, 0.999];
    let index = 0;
    expect(roll2dTotal(() => fixed[index++] ?? 0)).toBe(7);
  });
});
