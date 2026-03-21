import { describe, expect, it } from 'vitest';
import {
  equipmentRosterById,
  isStrengthWithinRequiredRange,
  parseRequiredStrength,
  resolveEquipmentRosterItem,
  resolvePrice,
} from './equipmentRoster.js';

describe('5 - Equipment Tables (Weapons, Armor, Shields, Gear)', () => {
  it('parses required-strength ranges and resolves formula pricing from the rulebook tables', () => {
    expect(parseRequiredStrength('8~16')).toEqual({ min: 8, max: 16 });
    expect(parseRequiredStrength('14~')).toEqual({ min: 14, max: null });
    expect(resolvePrice('x20+40', 14)).toEqual({
      costGamels: 320,
      variablePrice: false,
      priceLabel: '320 G',
    });
  });

  it('keeps representative weapon, armor, and shield entries aligned with the tables', () => {
    expect(resolveEquipmentRosterItem('broadsword', 14)).toMatchObject({
      usage: '1H',
      reqStrMin: 8,
      reqStrMax: 16,
      effectiveReqStr: 14,
      costGamels: 320,
    });
    expect(resolveEquipmentRosterItem('mage_staff', 19)).toMatchObject({
      usage: '2H',
      reqStrMin: 1,
      reqStrMax: 10,
      effectiveReqStr: 10,
      costGamels: 200,
    });
    expect(resolveEquipmentRosterItem('ring_mail', 10)).toMatchObject({
      reqStrMin: 5,
      reqStrMax: 12,
      effectiveReqStr: 10,
      costGamels: 340,
    });
    expect(resolveEquipmentRosterItem('small_shield', 10)).toMatchObject({
      reqStrMin: 1,
      reqStrMax: 1,
      costGamels: 60,
    });
  });

  it('keeps projectile and usage metadata aligned with table annotations', () => {
    expect(equipmentRosterById.dagger.tags).toContain('throwable');
    expect(equipmentRosterById.boomerang.tags).toContain('made_for_throwing');
    expect(equipmentRosterById.short_bow.tags).toContain('shooting');
    expect(equipmentRosterById.bastard_sword.usage).toBe('1~2H');
    expect(isStrengthWithinRequiredRange('8~16', 14)).toBe(true);
    expect(isStrengthWithinRequiredRange('8~16', 18)).toBe(false);
  });
});

describe('7 - Purchase other equipment', () => {
  it('keeps Table 1-11 gear prices aligned for fixed-price and bundle items', () => {
    expect(resolveEquipmentRosterItem('rucksack_leather', 10)?.costGamels).toBe(50);
    expect(resolveEquipmentRosterItem('lantern', 10)?.costGamels).toBe(40);
    expect(resolveEquipmentRosterItem('thieves_tools', 10)?.costGamels).toBe(100);
    expect(resolveEquipmentRosterItem('arrows', 10)).toMatchObject({
      costGamels: 10,
      variablePrice: false,
      priceLabel: '10 G / 12',
    });
  });

  it('marks open-ended prices as variable while still preserving their minimum listed value', () => {
    expect(resolveEquipmentRosterItem('musical_instrument', 10)).toMatchObject({
      costGamels: 100,
      variablePrice: true,
      priceLabel: '100+ G',
    });
    expect(resolveEquipmentRosterItem('one_serving_of_rations', 10)).toMatchObject({
      costGamels: 7,
      variablePrice: true,
      priceLabel: '7+ G',
    });
  });
});
