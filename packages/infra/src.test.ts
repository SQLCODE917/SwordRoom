import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const TEMPLATE_PATH = resolve(HERE, 'templates/character-creation-vertical-slice.yaml');

describe('infra scaffold', () => {
  it('declares core async-layer resources from contract', () => {
    const template = readFileSync(TEMPLATE_PATH, 'utf8');

    expect(template).toContain('AWS::Cognito::UserPool');
    expect(template).toContain('AWS::ApiGatewayV2::Api');
    expect(template).toContain('AWS::ApiGatewayV2::Authorizer');
    expect(template).toContain('commands.fifo');
    expect(template).toContain('commands-dlq');
    expect(template).toContain('FunctionName: commandApi');
    expect(template).toContain('FunctionName: dispatcher');
    expect(template).toContain('FunctionName: notifier');
    expect(template).toContain('TableName: GameState');
    expect(template).toContain('TableName: CommandLog');
  });
});
