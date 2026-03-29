import { describe, expect, it } from 'vitest';
import {
  isDevAuthEnabled,
  resolveActorIdentity,
  resolveActorIdentityFromAuthorizerClaims,
  resolveAuthMode,
} from './auth.js';

describe('resolveActorIdentity', () => {
  it('fails closed when AUTH_MODE is missing', () => {
    expect(() => resolveAuthMode({})).toThrow(/AUTH_MODE must be explicitly set/);
  });

  it('accepts the dev actor header in dev mode only when local dev auth is explicitly enabled', async () => {
    await expect(
      resolveActorIdentity({
        env: { AUTH_MODE: 'dev', ALLOW_DEV_AUTH: '1' },
        bypassAllowed: false,
        devActorIdHeader: 'player-aaa',
      })
    ).resolves.toMatchObject({
      actorId: 'player-aaa',
      authMode: 'dev',
      roles: ['PLAYER'],
    });
  });

  it('prefers bypassActorId over the dev actor header when both are present', async () => {
    await expect(
      resolveActorIdentity({
        env: { AUTH_MODE: 'dev', ALLOW_DEV_AUTH: '1' },
        bypassAllowed: true,
        bypassActorId: 'gm-zzz',
        devActorIdHeader: 'player-aaa',
      })
    ).resolves.toMatchObject({
      actorId: 'gm-zzz',
      authMode: 'dev',
      roles: ['PLAYER'],
    });
  });

  it('rejects dev auth when the explicit local opt-in is missing', async () => {
    await expect(
      resolveActorIdentity({
        env: { AUTH_MODE: 'dev' },
        bypassAllowed: false,
        devActorIdHeader: 'player-aaa',
      })
    ).rejects.toThrow(/ALLOW_DEV_AUTH=1 is required/);
  });

  it('rejects dev auth in AWS runtimes', async () => {
    await expect(
      resolveActorIdentity({
        env: {
          AUTH_MODE: 'dev',
          ALLOW_DEV_AUTH: '1',
          AWS_EXECUTION_ENV: 'AWS_Lambda_nodejs20.x',
        },
        bypassAllowed: false,
        devActorIdHeader: 'player-aaa',
      })
    ).rejects.toThrow(/not allowed in AWS runtimes/);
  });

  it('requires OIDC_ISSUER in oidc mode', async () => {
    await expect(
      resolveActorIdentity({
        env: { AUTH_MODE: 'oidc' },
        bypassAllowed: false,
        authorizationHeader: 'Bearer token',
      })
    ).rejects.toThrow(/OIDC_ISSUER is required/);
  });
});

describe('isDevAuthEnabled', () => {
  it('is true only for explicit local dev auth', () => {
    expect(isDevAuthEnabled({ AUTH_MODE: 'dev', ALLOW_DEV_AUTH: '1' })).toBe(true);
    expect(isDevAuthEnabled({ AUTH_MODE: 'dev' })).toBe(false);
    expect(
      isDevAuthEnabled({
        AUTH_MODE: 'dev',
        ALLOW_DEV_AUTH: '1',
        AWS_LAMBDA_FUNCTION_NAME: 'api-staging',
      })
    ).toBe(false);
  });
});


describe('resolveActorIdentityFromAuthorizerClaims', () => {
  it('maps trusted authorizer claims into an oidc identity', () => {
    expect(
      resolveActorIdentityFromAuthorizerClaims({
        sub: 'player-aaa',
        email: 'Player@Example.com',
        email_verified: 'true',
        name: 'Local Player',
      })
    ).toEqual({
      actorId: 'player-aaa',
      authMode: 'oidc',
      displayName: 'Local Player',
      email: 'Player@Example.com',
      emailNormalized: 'player@example.com',
      emailVerified: true,
      roles: ['PLAYER'],
    });
  });

  it('rejects missing required claims', () => {
    expect(() =>
      resolveActorIdentityFromAuthorizerClaims({
        sub: 'player-aaa',
        email_verified: 'true',
        name: 'Local Player',
      })
    ).toThrow(/missing email/);
  });
});
