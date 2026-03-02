import { createRemoteJWKSet, jwtVerify } from 'jose';

export type AuthMode = 'dev' | 'oidc';

export interface ResolveActorIdInput {
  authorizationHeader?: string;
  bypassActorId?: string;
  bypassAllowed: boolean;
  env?: Record<string, string | undefined>;
}

export async function resolveActorId(input: ResolveActorIdInput): Promise<string> {
  if (input.bypassAllowed) {
    if (!input.bypassActorId) {
      throw new Error('JWT bypass enabled but bypassActorId not provided');
    }
    return input.bypassActorId;
  }

  const env = input.env ?? process.env;
  const mode = (env.AUTH_MODE ?? 'dev') as AuthMode;

  if (mode === 'dev') {
    return input.bypassActorId ?? env.DEV_ACTOR_ID ?? 'player-aaa';
  }

  if (mode === 'oidc') {
    const issuer = env.KEYCLOAK_ISSUER;
    if (!issuer) {
      throw new Error('KEYCLOAK_ISSUER is required when AUTH_MODE=oidc');
    }

    return verifyOidcSub(input.authorizationHeader, issuer, env.OIDC_AUDIENCE);
  }

  throw new Error(`unsupported AUTH_MODE: ${mode}`);
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

async function verifyOidcSub(
  authorizationHeader: string | undefined,
  issuer: string,
  audience?: string
): Promise<string> {
  if (!authorizationHeader) {
    throw new Error('missing Authorization header');
  }
  const token = authorizationHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || token === authorizationHeader) {
    throw new Error('invalid Authorization header');
  }

  const normalizedIssuer = issuer.replace(/\/$/, '');
  const jwksUri = `${normalizedIssuer}/protocol/openid-connect/certs`;
  const jwks = getOrCreateJwks(jwksUri);
  const verification = await jwtVerify(token, jwks, {
    issuer: normalizedIssuer,
    audience: audience || undefined,
  });

  if (!verification.payload.sub) {
    throw new Error('OIDC JWT payload missing sub');
  }
  return verification.payload.sub;
}

function getOrCreateJwks(jwksUri: string) {
  let jwks = jwksCache.get(jwksUri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUri));
    jwksCache.set(jwksUri, jwks);
  }
  return jwks;
}
