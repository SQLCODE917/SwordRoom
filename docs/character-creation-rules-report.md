# Character Creation Rules Audit Report

Source of truth: [docs/sword-world-character-creation.md](/workspaces/hello-world-monorepo/docs/sword-world-character-creation.md)

## Summary

The character-creation rules are now centralized in [packages/shared/src/rules/characterCreation.ts](/workspaces/hello-world-monorepo/packages/shared/src/rules/characterCreation.ts), and the engine plus web preview logic consume that shared module instead of maintaining separate hard-coded tables.

## Rule mismatches fixed

- Corrected the character-creation EXP table to match the rulebook:
  - `Fighter`, `Thief`, and `Priest` cap at level 2 during creation.
  - `Ranger`, `Sage`, and `Bard` can reach level 3.
  - `Shaman` can reach level 2.
  - `Sorcerer` caps at level 1 during creation unless already granted by a starting package.
  - `Fighter 1` now costs `1000`, not `500`.
  - `Sage 1` now uses the `Ranger / Sage / Bard` cost column (`500`).
- Enforced race-based skill restrictions during EXP spending:
  - Dwarf blocks `Sorcerer` and `Shaman`.
  - Grassrunner blocks all rune master skills.
  - Elf blocks `Priest`.
  - Half-elf raised by elves blocks `Priest`.
- Added validation that half-elves must declare `raisedBy` before race-dependent creation rules run.
- Added shaman armor validation: only cloth, soft leather, or hard leather are allowed; shields remain forbidden.
- Added required-strength range validation when catalog items include min/max range data.
- Corrected ammunition price specs in the equipment roster to match the document:
  - `Arrows`: `10 for 12`
  - `Quarrels`: `10 for 12`
  - `Bullets`: `5 for 20`
- Updated the vertical-slice fixture data so it no longer encodes the outdated EXP table.

## Test suites by section

- `0 - Dice notation and rounding`: [packages/shared/src/rules/characterCreation.test.ts](/workspaces/hello-world-monorepo/packages/shared/src/rules/characterCreation.test.ts)
- `1 - Ability Scores`: [packages/shared/src/rules/characterCreation.test.ts](/workspaces/hello-world-monorepo/packages/shared/src/rules/characterCreation.test.ts)
- `2 - Skills (Skill Types + Adventurer Level)`: [packages/shared/src/rules/characterCreation.test.ts](/workspaces/hello-world-monorepo/packages/shared/src/rules/characterCreation.test.ts)
- `3 - Races (PC races + rule characteristics)`: [packages/shared/src/rules/characterCreation.test.ts](/workspaces/hello-world-monorepo/packages/shared/src/rules/characterCreation.test.ts)
- `4 - Character Creation Procedure`: [packages/engine/src/index.test.ts](/workspaces/hello-world-monorepo/packages/engine/src/index.test.ts)
- `5 - Equipment Tables (Weapons, Armor, Shields, Gear)`: [packages/shared/src/rules/equipmentRoster.test.ts](/workspaces/hello-world-monorepo/packages/shared/src/rules/equipmentRoster.test.ts)
- `6 - Restrictions on weapons/armor based on skills`: [packages/engine/src/index.test.ts](/workspaces/hello-world-monorepo/packages/engine/src/index.test.ts)
- `7 - Purchase other equipment`: [packages/shared/src/rules/equipmentRoster.test.ts](/workspaces/hello-world-monorepo/packages/shared/src/rules/equipmentRoster.test.ts)
- `8 - Fill out the character sheet`: [packages/shared/src/rules/characterCreation.test.ts](/workspaces/hello-world-monorepo/packages/shared/src/rules/characterCreation.test.ts)
- `9 - Optional rule that can affect character creation: Age-based ability changes`: [packages/shared/src/rules/characterCreation.test.ts](/workspaces/hello-world-monorepo/packages/shared/src/rules/characterCreation.test.ts)

## Verification run

- `pnpm --filter @starter/shared test`
- `pnpm --filter @starter/engine test`
- `pnpm --filter @starter/web test`
- `pnpm --filter @starter/services-dispatcher test`
- `pnpm --filter @starter/services-api test`
- `pnpm build`
- `pnpm type-check`

## Coverage

Installed `@vitest/coverage-v8@1.6.1` to match the repo’s `vitest@1.6.1`.

Coverage runs executed:

- `pnpm --filter @starter/shared exec vitest run src/rules/characterCreation.test.ts src/rules/equipmentRoster.test.ts --coverage --coverage.reporter=text-summary --coverage.reporter=json-summary --coverage.reportsDirectory=coverage-rulebook`
- `pnpm --filter @starter/engine exec vitest run src/index.test.ts --coverage --coverage.reporter=text-summary --coverage.reporter=json-summary --coverage.reportsDirectory=coverage-rulebook`

Coverage artifacts:

- [coverage-summary.json](/workspaces/hello-world-monorepo/packages/shared/coverage-rulebook/coverage-summary.json)
- [coverage-summary.json](/workspaces/hello-world-monorepo/packages/engine/coverage-rulebook/coverage-summary.json)

Scoped coverage for the rule modules under those 10 suites:

- [packages/shared/src/rules/characterCreation.ts](/workspaces/hello-world-monorepo/packages/shared/src/rules/characterCreation.ts): lines/statements `83.07%`, functions `60.00%`, branches `69.56%`
- [packages/shared/src/rules/equipmentRoster.ts](/workspaces/hello-world-monorepo/packages/shared/src/rules/equipmentRoster.ts): lines/statements `94.28%`, functions `83.33%`, branches `76.92%`
- [packages/engine/src/index.ts](/workspaces/hello-world-monorepo/packages/engine/src/index.ts): lines/statements `79.29%`, functions `90.47%`, branches `66.86%`

## Remaining limitation

The optional age-based ability rule is now implemented and tested in the shared rules layer, but it is not yet exposed as a persisted wizard toggle in the command schema or UI. The core creation flow still uses the normal, non-optional path unless a caller applies that shared helper explicitly.
