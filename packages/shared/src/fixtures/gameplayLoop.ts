import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { z } from 'zod';
import {
  gameplayCombatantStatsSchema,
  gameplaySeedIdSchema,
} from '../contracts/gameplay.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES_PATH = resolve(HERE, '../../../../fixtures/gameplay-loop.fixtures.yaml');

const gameplayFixtureEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  gameId: z.string(),
  seedId: gameplaySeedIdSchema,
  scene: z.object({
    title: z.string(),
    summary: z.string(),
    focus_prompt: z.string(),
    location: z.string(),
  }),
  enemies: z.array(
    z.object({
      combatantId: z.string(),
      displayName: z.string(),
      lifePoints: z.number().int(),
      stats: gameplayCombatantStatsSchema,
    })
  ),
  public_transcript_contains: z.array(z.string()),
  gm_only_transcript_contains: z.array(z.string()),
  scripted_rolls: z
    .object({
      standard_check: z
        .object({
          player_roll_total: z.number().int(),
          baseline_score: z.number().int(),
          modifiers: z.number().int(),
          target_score: z.number().int(),
        })
        .optional(),
      difficulty_check: z
        .object({
          player_roll_total: z.number().int(),
          gm_roll_total: z.number().int(),
          baseline_score: z.number().int(),
          modifiers: z.number().int(),
          difficulty: z.number().int(),
        })
        .optional(),
      combat_attack: z
        .object({
          attacker_roll_total: z.number().int(),
          base_damage: z.number().int(),
        })
        .optional(),
    })
    .optional(),
});

export const gameplayLoopFixturesDocumentSchema = z.object({
  doc_type: z.literal('fixtures'),
  slice: z.literal('gameplay_loop_vertical_slice'),
  version: z.number(),
  fixtures: z.array(gameplayFixtureEntrySchema),
});

export type GameplayLoopFixturesDocument = z.infer<typeof gameplayLoopFixturesDocumentSchema>;
export type GameplayLoopFixture = z.infer<typeof gameplayFixtureEntrySchema>;

export function loadGameplayLoopFixturesYamlText(): string {
  return readFileSync(FIXTURES_PATH, 'utf8');
}

export function loadGameplayLoopFixtures(): GameplayLoopFixturesDocument {
  return gameplayLoopFixturesDocumentSchema.parse(parse(loadGameplayLoopFixturesYamlText()));
}

export function getGameplayLoopFixture(seedId: z.infer<typeof gameplaySeedIdSchema>): GameplayLoopFixture {
  const fixture = loadGameplayLoopFixtures().fixtures.find((entry) => entry.seedId === seedId);
  if (!fixture) {
    throw new Error(`gameplay loop fixture not found for seedId "${seedId}"`);
  }
  return fixture;
}
