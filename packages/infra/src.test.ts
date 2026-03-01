import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const TEMPLATE_PATH = resolve(HERE, 'templates/character-creation-vertical-slice.yaml');

describe('infra scaffold', () => {
  it('is intentionally TODO/future only and tied to async-layer contract', () => {
    const template = readFileSync(TEMPLATE_PATH, 'utf8');
    expect(template).toContain('TODO / future');
    expect(template).toContain('commands.fifo');
    expect(template).toContain('commandApi');
    expect(template).toContain('dispatcher');
    expect(template).toContain('notifier');
  });
});
