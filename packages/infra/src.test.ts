import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const TEMPLATE_PATH = resolve(HERE, 'templates/character-creation-vertical-slice.yaml');
const DEPLOYMENT_CONTRACT_PATH = resolve(HERE, '../../docs/deployment.aws-cdk.github-actions.yaml');
const AGENTS_PATH = resolve(HERE, 'AGENTS.md');
const SYNTH_TEMPLATE_PATH = resolve(HERE, 'cdk.out/swordworld-staging-app.template.json');

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

  it('includes an AWS CDK deployment contract for agents', () => {
    const contract = readFileSync(DEPLOYMENT_CONTRACT_PATH, 'utf8');

    expect(contract).toContain('doc_type: implementation_contract');
    expect(contract).toContain('topic: aws_deployment_via_cdk_and_github_actions');
    expect(contract).toContain('deliverable: aws_cdk_iac_with_github_actions_oidc_deploy');
    expect(contract).toContain('package_of_record: packages/infra');
    expect(contract).toContain('path: packages/services/api/src/lambda.ts');
    expect(contract).toContain('path: packages/services/dispatcher/src/lambda.ts');
    expect(contract).toContain('id: deploy-08-add-github-actions-staging-deploy');
    expect(contract).toContain('id: deploy-09-add-github-actions-production-deploy');
  });

  it('points infra agents at the deployment contract', () => {
    const agents = readFileSync(AGENTS_PATH, 'utf8');

    expect(agents).toContain('docs/deployment.aws-cdk.github-actions.yaml');
    expect(agents).toContain('GitHub Actions with AWS OIDC');
    expect(agents).toContain('server.ts');
    expect(agents).toContain('worker.ts');
  });

  it('synthesizes explicit unauthenticated preflight routes for the HTTP API', () => {
    const template = JSON.parse(readFileSync(SYNTH_TEMPLATE_PATH, 'utf8')) as {
      Resources?: Record<string, { Type?: string; Properties?: Record<string, unknown> }>;
    };

    const routeProperties = Object.values(template.Resources ?? {})
      .filter((resource) => resource.Type === 'AWS::ApiGatewayV2::Route')
      .map((resource) => resource.Properties ?? {});

    expect(routeProperties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          RouteKey: 'OPTIONS /',
          AuthorizationType: 'NONE',
        }),
        expect.objectContaining({
          RouteKey: 'OPTIONS /{proxy+}',
          AuthorizationType: 'NONE',
        }),
        expect.objectContaining({
          RouteKey: 'ANY /',
          AuthorizationType: 'JWT',
        }),
        expect.objectContaining({
          RouteKey: 'ANY /{proxy+}',
          AuthorizationType: 'JWT',
        }),
      ])
    );
  });
});
