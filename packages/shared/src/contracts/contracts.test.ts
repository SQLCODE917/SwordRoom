import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { COMMAND_TYPES, anyCommandEnvelopeSchema } from './commands.js';
import { ENGINE_ERROR_CODES, engineErrorSchema } from './errors.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ASYNC_DOC_PATH = resolve(HERE, '../../../../docs/vertical-slice.character-creation.async-layer.yaml');
const ENGINE_DOC_PATH = resolve(HERE, '../../../../docs/vertical-slice.character-creation.engine.yaml');
const FIXTURE_DOC_PATH = resolve(HERE, '../../../../fixtures/vertical-slice.character-creation.fixtures.yaml');

describe('contract constants', () => {
  it('command types align with async-layer contract', () => {
    const asyncDoc = readFileSync(ASYNC_DOC_PATH, 'utf8');
    for (const commandType of COMMAND_TYPES) {
      expect(asyncDoc).toContain(`type: ${commandType}`);
    }
  });

  it('error codes align with engine+fixture contracts', () => {
    const engineDoc = readFileSync(ENGINE_DOC_PATH, 'utf8');
    const fixtureDoc = readFileSync(FIXTURE_DOC_PATH, 'utf8');
    expect(engineDoc).toContain('Validation returns stable error codes');
    for (const code of ENGINE_ERROR_CODES) {
      expect(fixtureDoc).toContain(`\"${code}\"`);
    }
  });
});

describe('runtime schemas', () => {
  it('validates command envelope payload by type', () => {
    const result = anyCommandEnvelopeSchema.safeParse({
      commandId: '29f61013-8f47-4f5f-9456-9f07a88e5893',
      gameId: 'game-1',
      actorId: 'player-1',
      type: 'GMReviewCharacter',
      schemaVersion: 1,
      payload: {
        characterId: 'char-1',
        decision: 'APPROVE',
      },
      createdAt: '2026-03-01T00:00:00.000Z',
    });

    expect(result.success).toBe(true);
  });

  it('validates engine error shape and code enum', () => {
    const good = engineErrorSchema.safeParse({
      code: 'MISSING_SUBABILITY',
      message: 'sub ability missing',
      details: null,
    });
    expect(good.success).toBe(true);

    const bad = engineErrorSchema.safeParse({
      code: 'NOT_A_REAL_CODE',
      message: 'x',
      details: null,
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      const issue = bad.error.issues[0];
      expect(issue.code).toBe(z.ZodIssueCode.invalid_value);
    }
  });
});
