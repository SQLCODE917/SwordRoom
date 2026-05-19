import { describe, expect, it } from 'vitest';
import {
  startingPackageTables as sharedStartingPackageTables,
} from '@starter/shared/rules/characterCreation';
import { equipmentRosterById, resolveEquipmentRosterItem } from '@starter/shared/rules/equipmentRoster';
import {
  applyStartingPackage,
  computeAbilitiesAndBonuses,
  createDraftState,
  purchaseEquipment,
  spendStartingExp,
  type CharacterCreationState,
  type ItemCatalogEntry,
  type StartingPackageTables,
} from './index.js';

const startingPackageTables = sharedStartingPackageTables as StartingPackageTables;

const itemCatalog: Record<string, ItemCatalogEntry> = Object.fromEntries(
  Object.values(equipmentRosterById).map((item) => {
    const resolved = resolveEquipmentRosterItem(item.itemId, 10);
    return [
      item.itemId,
      {
        category: item.category,
        req_str: resolved?.effectiveReqStr ?? 0,
        req_str_min: resolved?.reqStrMin ?? 0,
        req_str_max: resolved?.reqStrMax ?? null,
        cost_g: resolved?.costGamels ?? 0,
        price_spec: item.priceSpec,
        usage: item.usage,
        used_for: item.usedFor,
        tags: item.tags ?? [],
      } satisfies ItemCatalogEntry,
    ];
  })
);

describe('4 - Character Creation Procedure', () => {
  it('computes A-H into the six ability scores and bonuses before later creation steps', () => {
    const result = computeAbilitiesAndBonuses(
      createDraftState({
        characterId: 'char-human-step-2',
        race: 'HUMAN',
        subAbility: { A: 9, B: 8, C: 6, D: 7, E: 7, F: 12, G: 8, H: 6 },
      })
    );

    expect(result.errors).toEqual([]);
    expect(result.state.ability).toEqual({
      dex: 17,
      agi: 14,
      int: 13,
      str: 19,
      lf: 20,
      mp: 14,
    });
    expect(result.state.bonus).toEqual({
      dex: 2,
      agi: 2,
      int: 2,
      str: 3,
      lf: 3,
      mp: 2,
    });
  });

  it('uses the human background table and non-human race starts from the shared rule tables', () => {
    const human = applyStartingPackage(
      computeAbilitiesAndBonuses(
        createDraftState({
          characterId: 'char-human-background',
          race: 'HUMAN',
          subAbility: { A: 7, B: 7, C: 7, D: 7, E: 7, F: 7, G: 7, H: 7 },
        })
      ).state,
      {
        backgroundRoll2dTotal: 3,
        startingMoneyRoll2dTotal: 9,
      },
      startingPackageTables
    );

    expect(human.errors).toEqual([]);
    expect(human.state.startingPackage).toMatchObject({
      source: 'BACKGROUND_TABLE_1_5',
      backgroundName: 'Rune Master',
      backgroundRoll2dTotal: 3,
      startingExpTotal: 2000,
      startingMoneyGamels: 1800,
      startingSkills: [
        { skill: 'Sorcerer', level: 1 },
        { skill: 'Sage', level: 1 },
      ],
    });

    const dwarf = applyStartingPackage(
      computeAbilitiesAndBonuses(
        createDraftState({
          characterId: 'char-dwarf-start',
          race: 'DWARF',
          subAbility: { A: 15, B: 3, C: 8, D: 2, E: 10, F: 8, G: 13, H: 15 },
        })
      ).state,
      {
        craftsmanSkill: 'Smithing',
        startingMoneyRoll2dTotal: 6,
      },
      startingPackageTables
    );

    expect(dwarf.errors).toEqual([]);
    expect(dwarf.state.startingPackage).toMatchObject({
      source: 'RACE_TABLE_1_6',
      startingExpTotal: 3000,
      startingMoneyGamels: 1800,
      startingSkills: [{ skill: 'Smithing', level: 5 }],
    });
  });

  it('requires half-elves to declare who raised them before applying creation rules', () => {
    const result = applyStartingPackage(
      computeAbilitiesAndBonuses(
        createDraftState({
          characterId: 'char-half-elf-missing-raised-by',
          race: 'HALF_ELF',
          subAbility: { A: 8, B: 9, C: 8, D: 9, E: 6, F: 6, G: 8, H: 7 },
        })
      ).state,
      {
        startingMoneyRoll2dTotal: 7,
      },
      startingPackageTables
    );

    expect(result.errors[0]?.code).toBe('MISSING_RAISED_BY_FOR_HALF_ELF');
  });

  it('enforces the special background choices for Merchant/Scholar and Ordinary Citizen', () => {
    const state = computeAbilitiesAndBonuses(
      createDraftState({
        characterId: 'char-background-choice',
        race: 'HUMAN',
        subAbility: { A: 7, B: 7, C: 7, D: 7, E: 7, F: 7, G: 7, H: 7 },
      })
    ).state;

    const merchantScholar = applyStartingPackage(
      state,
      {
        backgroundRoll2dTotal: 8,
        startingMoneyRoll2dTotal: 7,
      },
      startingPackageTables
    );
    const ordinaryCitizen = applyStartingPackage(
      state,
      {
        backgroundRoll2dTotal: 7,
        startingMoneyRoll2dTotal: 7,
      },
      startingPackageTables
    );

    expect(merchantScholar.errors[0]?.code).toBe('MISSING_STARTING_PACKAGE_CHOICE');
    expect(ordinaryCitizen.errors[0]?.code).toBe('GENERAL_SKILL_REQUIRES_GM_CHOICE');
  });

  it('uses the rulebook EXP table, including the Sorcerer/Sage bundle and creation-time level caps', () => {
    const runeMaster = applyStartingPackage(
      computeAbilitiesAndBonuses(
        createDraftState({
          characterId: 'char-rune-master',
          race: 'HUMAN',
          subAbility: { A: 9, B: 8, C: 6, D: 7, E: 7, F: 12, G: 8, H: 6 },
        })
      ).state,
      {
        backgroundRoll2dTotal: 3,
        startingMoneyRoll2dTotal: 9,
      },
      startingPackageTables
    );

    const fighterSpend = spendStartingExp(runeMaster.state, {
      purchases: [{ skill: 'Fighter', targetLevel: 1 }],
    });
    expect(fighterSpend.errors).toEqual([]);
    expect(fighterSpend.state.startingPackage?.expUnspent).toBe(1000);

    const bundleBase = createDraftState({
      characterId: 'char-sorc-bundle',
      race: 'HUMAN',
      skills: [],
      startingPackage: {
        source: 'BACKGROUND_TABLE_1_5',
        startingSkills: [],
        startingExpTotal: 3000,
        expUnspent: 3000,
        startingMoneyGamels: 0,
        restrictions: [],
      },
    });
    const sorcererOnly = spendStartingExp(bundleBase, {
      purchases: [{ skill: 'Sorcerer', targetLevel: 1 }],
    });
    const sorcererAndSage = spendStartingExp(bundleBase, {
      purchases: [
        { skill: 'Sorcerer', targetLevel: 1 },
        { skill: 'Sage', targetLevel: 1 },
      ],
    });
    const rangerThree = spendStartingExp(bundleBase, {
      purchases: [{ skill: 'Ranger', targetLevel: 3 }],
    });
    const fighterThree = spendStartingExp(bundleBase, {
      purchases: [{ skill: 'Fighter', targetLevel: 3 }],
    });
    const sorcererTwo = spendStartingExp(bundleBase, {
      purchases: [{ skill: 'Sorcerer', targetLevel: 2 }],
    });

    expect(sorcererOnly.errors[0]?.code).toBe('SORCERER_SAGE_BUNDLE_REQUIRED');
    expect(sorcererAndSage.errors).toEqual([]);
    expect(sorcererAndSage.state.startingPackage?.expUnspent).toBe(1000);
    expect(rangerThree.errors).toEqual([]);
    expect(rangerThree.state.startingPackage?.expUnspent).toBe(0);
    expect(fighterThree.errors[0]?.code).toBe('GENERAL_SKILL_NOT_ALLOWED_WITH_STARTING_EXP');
    expect(sorcererTwo.errors[0]?.code).toBe('GENERAL_SKILL_NOT_ALLOWED_WITH_STARTING_EXP');
  });

  it('allows target level 0 to deselect a starting skill from the applied package', () => {
    const runeMaster = applyStartingPackage(
      computeAbilitiesAndBonuses(
        createDraftState({
          characterId: 'char-rune-master-zero',
          race: 'HUMAN',
          subAbility: { A: 9, B: 8, C: 6, D: 7, E: 7, F: 12, G: 8, H: 6 },
        })
      ).state,
      {
        backgroundRoll2dTotal: 3,
        startingMoneyRoll2dTotal: 9,
      },
      startingPackageTables
    );

    const removedSorcererAndSage = spendStartingExp(runeMaster.state, {
      purchases: [
        { skill: 'Sorcerer', targetLevel: 0 },
        { skill: 'Sage', targetLevel: 0 },
      ],
    });

    expect(removedSorcererAndSage.errors).toEqual([]);
    expect(removedSorcererAndSage.state.startingPackage?.expUnspent).toBe(2000);
    expect(removedSorcererAndSage.state.skills).toEqual([]);
  });

  it('rejects adventurer skills blocked by race restrictions during EXP spending', () => {
    const elf = createDraftState({
      characterId: 'char-elf-priest',
      race: 'ELF',
      raisedBy: null,
      skills: [{ skill: 'Shaman', level: 1 }],
      startingPackage: {
        source: 'RACE_TABLE_1_6',
        startingSkills: [{ skill: 'Shaman', level: 1 }],
        startingExpTotal: 2000,
        expUnspent: 2000,
        startingMoneyGamels: 0,
        restrictions: ['Cannot acquire Priest'],
      },
    });

    const result = spendStartingExp(elf, {
      purchases: [{ skill: 'Priest', targetLevel: 1 }],
    });

    expect(result.errors[0]?.code).toBe('SKILL_RESTRICTED_BY_RACE');
    expect(result.errors[0]?.details).toMatchObject({
      race: 'ELF',
      skill: 'Priest',
    });
  });
});

describe('6 - Restrictions on weapons/armor based on skills', () => {
  it('requires light armor for rangers and light weapons plus light armor for thieves', () => {
    const ranger = purchaseEquipment(
      makeEquipmentState({
        characterId: 'char-ranger-heavy-armor',
        strength: 10,
        skills: [{ skill: 'Ranger', level: 1 }],
      }),
      {
        cart: {
          weapons: ['broadsword'],
          armor: ['chain_mail_armor'],
          shields: [],
          gear: [],
        },
      },
      itemCatalog
    );

    expect(ranger.errors.map((error) => error.details?.reason)).toContain('RANGER_THIEF_ARMOR_RESTRICTED');
    expect(ranger.errors.map((error) => error.details?.reason)).toContain('RANGER_ARMOR_REQ_STR_TOO_HIGH');

    const thief = purchaseEquipment(
      makeEquipmentState({
        characterId: 'char-thief-heavy-kit',
        strength: 10,
        skills: [{ skill: 'Thief', level: 1 }],
      }),
      {
        cart: {
          weapons: ['broadsword'],
          armor: ['ring_mail'],
          shields: [],
          gear: [],
        },
      },
      itemCatalog
    );

    expect(thief.errors.map((error) => error.details?.reason)).toContain('THIEF_WEAPON_REQ_STR_TOO_HIGH');
    expect(thief.errors.map((error) => error.details?.reason)).toContain('THIEF_ARMOR_REQ_STR_TOO_HIGH');
  });

  it('enforces sorcerer staff, shield, and armor restrictions', () => {
    const result = purchaseEquipment(
      makeEquipmentState({
        characterId: 'char-sorcerer-restrictions',
        strength: 10,
        skills: [
          { skill: 'Sorcerer', level: 1 },
          { skill: 'Sage', level: 1 },
        ],
      }),
      {
        cart: {
          weapons: ['broadsword'],
          armor: ['splint_armor'],
          shields: ['small_shield'],
          gear: [],
        },
      },
      itemCatalog
    );

    expect(result.errors.map((error) => error.details?.reason)).toContain('SORCERER_FORBIDS_SHIELD');
    expect(result.errors.map((error) => error.details?.reason)).toContain('SORCERER_ARMOR_RESTRICTED');
    expect(result.errors.find((error) => error.code === 'MISSING_REQUIRED_EQUIPMENT')?.details).toEqual({
      required: ['mage_staff'],
    });
  });

  it('rejects mage_staff for non-sorcerers even when their STR is in range', () => {
    const result = purchaseEquipment(
      makeEquipmentState({
        characterId: 'char-priest-staff',
        strength: 8,
        skills: [{ skill: 'Priest', level: 1 }],
      }),
      {
        cart: {
          weapons: ['mage_staff'],
          armor: [],
          shields: [],
          gear: [],
        },
      },
      itemCatalog
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'EQUIPMENT_RESTRICTED_BY_SKILL',
        message: 'equipment "mage_staff" requires Sorcerer skill',
        details: expect.objectContaining({
          reason: 'SORCERER_REQUIRED_ITEM',
          itemId: 'mage_staff',
        }),
      })
    );
  });

  it('allows mage_staff for sorcerers above STR 10 by using the STR 10 version', () => {
    const result = purchaseEquipment(
      makeEquipmentState({
        characterId: 'char-rune-master-heavy',
        strength: 16,
        skills: [
          { skill: 'Sorcerer', level: 1 },
          { skill: 'Sage', level: 1 },
          { skill: 'Priest', level: 1 },
        ],
      }),
      {
        cart: {
          weapons: ['mage_staff'],
          armor: [],
          shields: [],
          gear: [],
        },
      },
      itemCatalog
    );

    expect(result.errors).toEqual([]);
    expect(result.state.equipmentCart).toEqual({
      weapons: ['mage_staff'],
      armor: [],
      shields: [],
      gear: [],
    });
  });

  it('limits shamans to cloth, soft leather, or hard leather and forbids shields', () => {
    const result = purchaseEquipment(
      makeEquipmentState({
        characterId: 'char-shaman-restrictions',
        strength: 12,
        skills: [{ skill: 'Shaman', level: 1 }],
      }),
      {
        cart: {
          weapons: ['quarterstaff'],
          armor: ['ring_mail'],
          shields: ['small_shield'],
          gear: [],
        },
      },
      itemCatalog
    );

    expect(result.errors.map((error) => error.details?.reason)).toContain('SHAMAN_FORBIDS_SHIELD');
    expect(result.errors.map((error) => error.details?.reason)).toContain('SHAMAN_ARMOR_RESTRICTED');
  });

  it('rejects equipment whose required-strength range does not include the character STR when range metadata exists', () => {
    const result = purchaseEquipment(
      makeEquipmentState({
        characterId: 'char-fighter-range-mismatch',
        strength: 18,
        skills: [{ skill: 'Fighter', level: 1 }],
      }),
      {
        cart: {
          weapons: ['broadsword'],
          armor: [],
          shields: [],
          gear: [],
        },
      },
      itemCatalog
    );

    expect(result.errors).toEqual([
      expect.objectContaining({
        code: 'EQUIPMENT_RESTRICTED_BY_SKILL',
        details: expect.objectContaining({
          reason: 'REQ_STR_RANGE_MISMATCH',
          itemId: 'broadsword',
          charStr: 18,
        }),
      }),
    ]);
  });
});

function makeEquipmentState(input: {
  characterId: string;
  strength: number;
  skills: Array<{ skill: string; level: number }>;
}): CharacterCreationState {
  return createDraftState({
    characterId: input.characterId,
    race: 'HUMAN',
    ability: { str: input.strength },
    skills: input.skills,
    startingPackage: {
      source: 'BACKGROUND_TABLE_1_5',
      startingSkills: input.skills,
      startingExpTotal: 0,
      expUnspent: 0,
      startingMoneyGamels: 9999,
      restrictions: [],
    },
  });
}
