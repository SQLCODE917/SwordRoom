import { describe, expect, it } from 'vitest';
import { loadVerticalSliceFixtures } from '@starter/shared';
import {
  applyStartingPackage,
  computeAbilitiesAndBonuses,
  createDraftState,
  finalizeCharacter,
  purchaseEquipment,
  spendStartingExp,
  submitForApproval,
  type CharacterCreationState,
  type EquipmentCart,
  type StartingPackageTables,
  type SubAbility,
} from './index.js';

const fixturesDoc = loadVerticalSliceFixtures() as Record<string, unknown>;
const fixtures = fixturesDoc.fixtures as Array<Record<string, unknown>>;
const rulebookRefs = fixturesDoc.rulebook_context_refs as Record<string, unknown>;
const engineContract = fixturesDoc.engine_contract as Record<string, unknown>;

const tables: StartingPackageTables = {
  backgroundsRows: (rulebookRefs.backgrounds_table_1_5 as { rows: Record<string, unknown> }).rows as Record<
    string,
    any
  >,
  raceRows: (rulebookRefs.starting_experience_by_race_table_1_6 as { rows: Record<string, unknown> }).rows as Record<
    string,
    any
  >,
};

const rollFormulasBySubAbility = (
  ((rulebookRefs.determining_sub_ability_scores_table_1_3 as { extracted_table: Record<string, unknown> })
    .extracted_table ?? {}) as Record<string, Record<string, string>>
);

const itemCatalog = (
  (
    (engineContract.minimal_item_catalog_rules_for_slice as { items: Record<string, unknown> })?.items ?? {}
  ) as Record<string, { category: string; req_str?: number; tags?: string[] }>
);

describe('Phase 1 - computeAbilitiesAndBonuses', () => {
  for (const fixture of fixtures.filter((entry) => String(entry.id).startsWith('good.'))) {
    const id = String(fixture.id);

    it(`computes abilities/bonuses for ${id}`, () => {
      const inputs = fixture.inputs as Record<string, unknown>;
      const expected = fixture.expected as Record<string, unknown>;

      const sub = deriveSubAbilityFromFixtureInputs(inputs);
      const state = createDraftState({
        characterId: String(fixture.characterId),
        race: readRaceCode(inputs),
        raisedBy: readRaisedBy(inputs),
        subAbility: sub,
      });

      const result = computeAbilitiesAndBonuses(state);
      expect(result.errors).toEqual([]);
      expect(result.state.ability).toEqual(expected.derived_ability);
      expect(result.state.bonus).toEqual(expected.derived_bonus);
    });
  }
});

describe('Phase 1 - applyStartingPackage', () => {
  for (const fixture of fixtures.filter((entry) => String(entry.id).startsWith('good.'))) {
    const id = String(fixture.id);

    it(`applies starting package for ${id}`, () => {
      const inputs = fixture.inputs as Record<string, unknown>;
      const expected = fixture.expected as Record<string, unknown>;

      const computed = computeAbilitiesAndBonuses(
        createDraftState({
          characterId: String(fixture.characterId),
          race: readRaceCode(inputs),
          raisedBy: readRaisedBy(inputs),
          subAbility: deriveSubAbilityFromFixtureInputs(inputs),
        })
      );

      const apply = applyStartingPackage(
        computed.state,
        {
          backgroundRoll2dTotal: readBackgroundRollTotal(inputs),
          startingMoneyRoll2dTotal: readStartingMoneyRollTotal(inputs),
          useOrdinaryCitizenShortcut: false,
          craftsmanSkill: readCraftsmanSkill(inputs),
        },
        tables
      );

      expect(apply.errors).toEqual([]);

      const expectedPackage = expected.starting_package as Record<string, unknown>;
      expect(apply.state.startingPackage?.startingExpTotal).toBe(expectedPackage.starting_exp_total);
      expect(apply.state.startingPackage?.startingMoneyGamels).toBe(expectedPackage.starting_money_gamels);

      const expectedSkills = (expectedPackage.starting_skills as Array<Record<string, unknown>>).map((skill) => ({
        skill: String(skill.skill),
        level: Number(skill.level),
      }));
      expect(apply.state.startingPackage?.startingSkills).toEqual(expectedSkills);

      const background = expectedPackage.background as Record<string, unknown> | undefined;
      if (background) {
        expect(apply.state.startingPackage?.backgroundName).toBe(background.name);
        expect(apply.state.startingPackage?.backgroundRoll2dTotal).toBe(background.roll2d_total);
      }
    });
  }

  it('returns MISSING_BACKGROUND_ROLL and does not mutate state for bad.human_missing_background_roll', () => {
    const fixture = getFixtureById('bad.human_missing_background_roll');
    const inputs = fixture.inputs as Record<string, unknown>;

    const baseState = createDraftState({
      characterId: String(fixture.characterId),
      race: 'HUMAN',
      subAbility: (inputs.subAbility_direct ?? {}) as SubAbility,
    });
    const before = structuredClone(baseState);

    const result = applyStartingPackage(baseState, {}, tables);

    expect(result.errors[0]?.code).toBe('MISSING_BACKGROUND_ROLL');
    expect(result.state).toEqual(before);
  });
});

describe('Phase 1 - spendStartingExp', () => {
  it('applies deterministic spend for good.human_rune_master_sorcerer_starter', () => {
    const fixture = getFixtureById('good.human_rune_master_sorcerer_starter');
    const inputs = fixture.inputs as Record<string, unknown>;
    const expected = fixture.expected as Record<string, unknown>;

    const applied = applyStartingPackage(
      computeAbilitiesAndBonuses(
        createDraftState({
          characterId: String(fixture.characterId),
          race: readRaceCode(inputs),
          subAbility: deriveSubAbilityFromFixtureInputs(inputs),
        })
      ).state,
      {
        backgroundRoll2dTotal: readBackgroundRollTotal(inputs),
        startingMoneyRoll2dTotal: readStartingMoneyRollTotal(inputs),
      },
      tables
    );

    const spend = spendStartingExp(applied.state, {
      purchases: (((inputs.exp_spend as Record<string, unknown>).purchases ?? []) as Array<Record<string, unknown>>).map(
        (purchase) => ({
          skill: String(purchase.skill),
          targetLevel: Number(purchase.targetLevel),
        })
      ),
    });

    expect(spend.errors).toEqual([]);

    const expectedSpend = expected.exp_after_spend as Record<string, unknown>;
    expect(spend.state.startingPackage?.expUnspent).toBe(expectedSpend.unspentExpExpected);
    expect(spend.state.skills).toEqual(
      (expectedSpend.skillsExpected as Array<Record<string, unknown>>).map((skill) => ({
        skill: String(skill.skill),
        level: Number(skill.level),
      }))
    );
  });

  it('returns SORCERER_SAGE_BUNDLE_REQUIRED and does not mutate state', () => {
    const fixture = getFixtureById('bad.sorcerer_only_discount_when_neither');
    const inputs = fixture.inputs as Record<string, unknown>;
    const startingState = inputs.starting_state as Record<string, unknown>;
    const startingPackageOverride = startingState.starting_package_override as Record<string, unknown>;

    const state = createDraftState({
      characterId: String(fixture.characterId),
      race: readRaceCode(startingState),
      skills: (startingPackageOverride.starting_skills as Array<Record<string, unknown>>).map((skill) => ({
        skill: String(skill.skill),
        level: Number(skill.level),
      })),
      startingPackage: {
        source: 'BACKGROUND_TABLE_1_5',
        startingSkills: (startingPackageOverride.starting_skills as Array<Record<string, unknown>>).map((skill) => ({
          skill: String(skill.skill),
          level: Number(skill.level),
        })),
        startingExpTotal: Number(startingPackageOverride.starting_exp_total),
        expUnspent: Number(startingPackageOverride.exp_unspent),
        startingMoneyGamels: 0,
        restrictions: [],
      },
    });
    const before = structuredClone(state);

    const spend = spendStartingExp(state, {
      purchases: (((inputs.exp_spend as Record<string, unknown>).purchases ?? []) as Array<Record<string, unknown>>).map(
        (purchase) => ({
          skill: String(purchase.skill),
          targetLevel: Number(purchase.targetLevel),
          costExpOffered: Number(purchase.costExpOffered),
        })
      ),
    });

    expect(spend.errors[0]?.code).toBe('SORCERER_SAGE_BUNDLE_REQUIRED');
    expect(spend.state).toEqual(before);
  });
});

describe('Phase 1 - purchaseEquipment', () => {
  it('passes for good.human_rune_master_sorcerer_starter', () => {
    const fixture = getFixtureById('good.human_rune_master_sorcerer_starter');
    const inputs = fixture.inputs as Record<string, unknown>;
    const expected = fixture.expected as Record<string, unknown>;

    const base = spendStartingExp(
      applyStartingPackage(
        computeAbilitiesAndBonuses(
          createDraftState({
            characterId: String(fixture.characterId),
            race: readRaceCode(inputs),
            subAbility: deriveSubAbilityFromFixtureInputs(inputs),
          })
        ).state,
        {
          backgroundRoll2dTotal: readBackgroundRollTotal(inputs),
          startingMoneyRoll2dTotal: readStartingMoneyRollTotal(inputs),
        },
        tables
      ).state,
      {
        purchases: (((inputs.exp_spend as Record<string, unknown>).purchases ?? []) as Array<Record<string, unknown>>).map(
          (purchase) => ({
            skill: String(purchase.skill),
            targetLevel: Number(purchase.targetLevel),
          })
        ),
      }
    ).state;

    const result = purchaseEquipment(
      base,
      { cart: normalizeEquipmentCart(inputs.equipment_cart as Record<string, unknown>) },
      itemCatalog
    );

    const equipmentValidation = expected.equipment_validation as Record<string, unknown>;
    expect(result.errors).toEqual([]);
    expect(equipmentValidation.shouldPass).toBe(true);
  });

  it('returns expected error codes and does not mutate state for bad equipment fixtures', () => {
    const equipmentBadFixtures = [
      getFixtureById('bad.sorcerer_cannot_buy_shield_and_requires_staff'),
      getFixtureById('bad_req_str_too_high'),
    ];

    for (const fixture of equipmentBadFixtures) {
      const inputs = fixture.inputs as Record<string, unknown>;
      const expected = fixture.expected as Record<string, unknown>;
      const minimal = inputs.state_minimal as Record<string, unknown>;

      const state = createDraftState({
        characterId: String(fixture.characterId),
        race: readRaceCode(minimal),
        skills: ((minimal.skills ?? []) as Array<Record<string, unknown>>).map((skill) => ({
          skill: String(skill.skill),
          level: Number(skill.level),
        })),
        ability: ((minimal.ability ?? {}) as Partial<CharacterCreationState['ability']>) ?? {},
      });

      const before = structuredClone(state);
      const result = purchaseEquipment(
        state,
        { cart: normalizeEquipmentCart(inputs.equipment_cart as Record<string, unknown>) },
        itemCatalog
      );

      const expectedCodes = expected.errors
        ? (expected.errors as Array<Record<string, unknown>>).map((error) => String(error.code))
        : [String((expected.error as Record<string, unknown>).code)];

      expect(result.errors.map((error) => error.code)).toEqual(expectedCodes);
      expect(result.state).toEqual(before);
    }
  });
});

describe('Phase 1 - finalizeCharacter + submitForApproval', () => {
  it('finalizes and submits good.human_rune_master_sorcerer_starter', () => {
    const fixture = getFixtureById('good.human_rune_master_sorcerer_starter');
    const inputs = fixture.inputs as Record<string, unknown>;
    const expected = fixture.expected as Record<string, unknown>;

    const equipped = purchaseEquipment(
      spendStartingExp(
        applyStartingPackage(
          computeAbilitiesAndBonuses(
            createDraftState({
              characterId: String(fixture.characterId),
              race: readRaceCode(inputs),
              subAbility: deriveSubAbilityFromFixtureInputs(inputs),
              identity: inputs.identity as CharacterCreationState['identity'],
            })
          ).state,
          {
            backgroundRoll2dTotal: readBackgroundRollTotal(inputs),
            startingMoneyRoll2dTotal: readStartingMoneyRollTotal(inputs),
          },
          tables
        ).state,
        {
          purchases: (((inputs.exp_spend as Record<string, unknown>).purchases ?? []) as Array<Record<string, unknown>>).map(
            (purchase) => ({
              skill: String(purchase.skill),
              targetLevel: Number(purchase.targetLevel),
            })
          ),
        }
      ).state,
      { cart: normalizeEquipmentCart(inputs.equipment_cart as Record<string, unknown>) },
      itemCatalog
    ).state;

    const finalized = finalizeCharacter(equipped);
    expect(finalized.errors).toEqual([]);
    expect(finalized.state.completeness).toBe(true);

    const submitted = submitForApproval(finalized.state);
    expect(submitted.errors).toEqual([]);

    const lifecycle = (expected.lifecycle ?? {}) as Record<string, unknown>;
    expect(equipped.status).toBe(lifecycle.status_before_submit);
    expect(submitted.state.status).toBe(lifecycle.status_after_submit);
  });
});

function getFixtureById(id: string): Record<string, unknown> {
  const fixture = fixtures.find((entry) => String(entry.id) === id);
  if (!fixture) {
    throw new Error(`fixture not found: ${id}`);
  }
  return fixture;
}

function readRaceCode(inputs: Record<string, unknown>): CharacterCreationState['race'] {
  const race = inputs.race as Record<string, unknown> | undefined;
  return (race?.code as CharacterCreationState['race']) ?? undefined;
}

function readRaisedBy(inputs: Record<string, unknown>): CharacterCreationState['raisedBy'] {
  const race = inputs.race as Record<string, unknown> | undefined;
  return (race?.raisedBy as CharacterCreationState['raisedBy']) ?? undefined;
}

function readBackgroundRollTotal(inputs: Record<string, unknown>): number | undefined {
  const dice = inputs.dice as Record<string, unknown> | undefined;
  const direct = dice?.background_roll_2d as number[] | undefined;
  return direct ? direct.reduce((sum, value) => sum + Number(value), 0) : undefined;
}

function readStartingMoneyRollTotal(inputs: Record<string, unknown>): number | undefined {
  const dice = inputs.dice as Record<string, unknown> | undefined;
  const direct = dice?.starting_money_roll_2d as number[] | undefined;
  return direct ? direct.reduce((sum, value) => sum + Number(value), 0) : undefined;
}

function readCraftsmanSkill(inputs: Record<string, unknown>): string | undefined {
  const choices = inputs.starting_choices as Record<string, unknown> | undefined;
  return choices?.craftsman_skill ? String(choices.craftsman_skill) : undefined;
}

function normalizeEquipmentCart(input: Record<string, unknown>): EquipmentCart {
  return {
    weapons: ((input.weapons ?? []) as unknown[]).map((item) => String(item)),
    armor: ((input.armor ?? []) as unknown[]).map((item) => String(item)),
    shields: ((input.shields ?? []) as unknown[]).map((item) => String(item)),
    gear: ((input.gear ?? []) as unknown[]).map((item) => String(item)),
  };
}

function deriveSubAbilityFromFixtureInputs(inputs: Record<string, unknown>): SubAbility {
  const direct = inputs.subAbility_direct as Record<string, unknown> | undefined;
  if (direct) {
    return toSubAbility(direct);
  }

  const dice = inputs.dice as Record<string, unknown> | undefined;
  const subAbilityRolls = dice?.subAbility_rolls as Record<string, unknown> | undefined;
  if (subAbilityRolls) {
    return {
      A: sumDice(subAbilityRolls.A as unknown[]),
      B: sumDice(subAbilityRolls.B as unknown[]),
      C: sumDice(subAbilityRolls.C as unknown[]),
      D: sumDice(subAbilityRolls.D as unknown[]),
      E: sumDice(subAbilityRolls.E as unknown[]),
      F: sumDice(subAbilityRolls.F as unknown[]),
      G: sumDice(subAbilityRolls.G as unknown[]),
      H: sumDice(subAbilityRolls.H as unknown[]),
    };
  }

  const raw = dice?.raw as Record<string, unknown> | undefined;
  const race = readRaceCode(inputs);
  if (!raw || !race) {
    throw new Error('fixture does not contain subAbility inputs');
  }

  const derived: Record<string, number> = {};
  for (const key of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
    const formula = rollFormulasBySubAbility[key]?.[race];
    if (!formula) {
      throw new Error(`missing formula for ${key}/${race}`);
    }

    derived[key] = evaluateRollFormulaFromRaw(key, formula, raw);
  }

  return toSubAbility(derived);
}

function evaluateRollFormulaFromRaw(
  key: string,
  formula: string,
  raw: Record<string, unknown>
): number {
  const match = formula.match(/^(2D|1D|1\/2D)(?:\+(\d+))?$/i);
  if (!match) {
    throw new Error(`unsupported formula for ${key}: ${formula}`);
  }

  const base = match[1].toUpperCase();
  const plus = Number(match[2] ?? 0);

  let value = 0;
  if (base === '2D') {
    value = sumDice(raw[`${key}_2d`] as unknown[]);
  } else if (base === '1D') {
    value = sumDice(raw[`${key}_1d`] as unknown[]);
  } else {
    value = Math.ceil(sumDice(raw[`${key}_1d`] as unknown[]) / 2);
  }

  return value + plus;
}

function sumDice(values: unknown[]): number {
  let total = 0;
  for (const value of values ?? []) {
    total += Number(value);
  }
  return total;
}

function toSubAbility(input: Record<string, unknown>): SubAbility {
  return {
    A: Number(input.A),
    B: Number(input.B),
    C: Number(input.C),
    D: Number(input.D),
    E: Number(input.E),
    F: Number(input.F),
    G: Number(input.G),
    H: Number(input.H),
  };
}
