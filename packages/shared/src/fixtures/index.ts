import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { z } from 'zod';
import { engineErrorCodeSchema, type EngineErrorCode } from '../contracts/errors.js';
export * from './gameplayLoop.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES_PATH = resolve(HERE, '../../../../fixtures/vertical-slice.character-creation.fixtures.yaml');

const fixtureEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  gameId: z.string(),
  actorId: z.string(),
  characterId: z.string(),
  expected: z
    .object({
      error: z
        .object({
          code: engineErrorCodeSchema,
        })
        .partial()
        .optional(),
      errors: z
        .array(
          z.object({
            code: engineErrorCodeSchema,
          })
        )
        .optional(),
    })
    .passthrough()
    .optional(),
}).passthrough();

export const verticalSliceFixturesDocumentSchema = z.object({
  doc_type: z.literal('fixtures'),
  slice: z.literal('character_creation_vertical_slice'),
  version: z.number(),
  fixtures: z.array(fixtureEntrySchema),
  command_sequences_for_integration: z.array(z.record(z.string(), z.unknown())).optional(),
}).passthrough();

export type VerticalSliceFixturesDocument = z.infer<typeof verticalSliceFixturesDocumentSchema>;

export interface NormalizedFixture {
  id: string;
  title: string;
  gameId: string;
  actorId: string;
  characterId: string;
  scenario: 'good' | 'bad' | 'unknown';
  expectedErrorCodes: EngineErrorCode[];
}

export interface NormalizedFixtureSet {
  fixtures: NormalizedFixture[];
  byId: Record<string, NormalizedFixture>;
}

export function loadVerticalSliceFixturesYamlText(): string {
  return readFileSync(FIXTURES_PATH, 'utf8');
}

export function loadVerticalSliceFixtures(): VerticalSliceFixturesDocument {
  const parsed = parse(loadVerticalSliceFixturesYamlText());
  return verticalSliceFixturesDocumentSchema.parse(parsed);
}

export function normalizeFixtures(doc: VerticalSliceFixturesDocument): NormalizedFixtureSet {
  const fixtures = doc.fixtures.map((item) => {
    const expectedErrorCodes: EngineErrorCode[] = [];
    if (item.expected?.error?.code) {
      expectedErrorCodes.push(item.expected.error.code);
    }
    for (const err of item.expected?.errors ?? []) {
      expectedErrorCodes.push(err.code);
    }

    return {
      id: item.id,
      title: item.title,
      gameId: item.gameId,
      actorId: item.actorId,
      characterId: item.characterId,
      scenario: item.id.startsWith('good.') ? 'good' : item.id.startsWith('bad.') ? 'bad' : 'unknown',
      expectedErrorCodes,
    } satisfies NormalizedFixture;
  });

  const byId = Object.fromEntries(fixtures.map((fixture) => [fixture.id, fixture]));
  return { fixtures, byId };
}

export function loadAndNormalizeVerticalSliceFixtures(): NormalizedFixtureSet {
  return normalizeFixtures(loadVerticalSliceFixtures());
}
