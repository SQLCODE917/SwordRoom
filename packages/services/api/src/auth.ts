import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export type AuthMode = 'dev' | 'oidc';

export interface ResolvedActorIdentity {
  actorId: string;
  authMode: AuthMode;
  displayName: string;
  email: string | null;
  emailNormalized: string | null;
  emailVerified: boolean;
  roles: Array<'PLAYER' | 'GM' | 'ADMIN'>;
}

export interface ResolveActorIdInput {
  authorizationHeader?: string;
  bypassActorId?: string;
  bypassAllowed: boolean;
  env?: Record<string, string | undefined>;
}

export async function resolveActorId(input: ResolveActorIdInput): Promise<string> {
  return (await resolveActorIdentity(input)).actorId;
}

export async function resolveActorIdentity(input: ResolveActorIdInput): Promise<ResolvedActorIdentity> {
  const env = input.env ?? process.env;
  const mode = (env.AUTH_MODE ?? 'dev') as AuthMode;
  const actorId = typeof input.bypassActorId === 'string' ? input.bypassActorId.trim() : '';

  if (input.bypassAllowed) {
    if (actorId) {
      return createDevIdentity(actorId);
    }
    throw unauthorized('missing bypassActorId for dev auth');
  }

  if (mode === 'dev') {
    if (actorId) {
      return createDevIdentity(actorId);
    }
    throw unauthorized('missing bypassActorId for dev auth');
  }

  if (mode === 'oidc') {
    const issuer = env.KEYCLOAK_ISSUER;
    if (!issuer) {
      throw new Error('KEYCLOAK_ISSUER is required when AUTH_MODE=oidc');
    }

    return verifyOidcIdentity(input.authorizationHeader, issuer, env.OIDC_AUDIENCE);
  }

  throw new Error(`unsupported AUTH_MODE: ${mode}`);
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function createDevIdentity(actorId: string): ResolvedActorIdentity {
  const roles = new Set<'PLAYER' | 'GM' | 'ADMIN'>(['PLAYER']);
  if (actorId.startsWith('gm-')) {
    roles.add('GM');
  }
  if (actorId.startsWith('admin-')) {
    roles.add('ADMIN');
  }

  return {
    actorId,
    authMode: 'dev',
    displayName: actorId,
    email: null,
    emailNormalized: null,
    emailVerified: false,
    roles: Array.from(roles),
  };
}

async function verifyOidcIdentity(
  authorizationHeader: string | undefined,
  issuer: string,
  audience?: string
): Promise<ResolvedActorIdentity> {
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

  return toOidcIdentity(verification.payload);
}

function getOrCreateJwks(jwksUri: string) {
  let jwks = jwksCache.get(jwksUri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUri));
    jwksCache.set(jwksUri, jwks);
  }
  return jwks;
}

function toOidcIdentity(payload: JWTPayload): ResolvedActorIdentity {
  const actorId = payload.sub;
  if (!actorId) {
    throw new Error('OIDC JWT payload missing sub');
  }

  const email = typeof payload.email === 'string' ? payload.email : null;
  const normalizedEmail = email?.trim().toLowerCase() ?? null;
  const displayName =
    firstNonEmptyString([
      payload.name,
      [payload.given_name, payload.family_name].filter((part): part is string => typeof part === 'string' && part.trim() !== '').join(' '),
      payload.preferred_username,
      normalizedEmail,
      actorId,
    ]) ?? actorId;

  const roles = new Set<'PLAYER' | 'GM' | 'ADMIN'>(['PLAYER']);
  for (const candidate of extractOidcRoleClaims(payload)) {
    if (candidate === 'PLAYER' || candidate === 'GM' || candidate === 'ADMIN') {
      roles.add(candidate);
    }
  }

  return {
    actorId,
    authMode: 'oidc',
    displayName,
    email,
    emailNormalized: normalizedEmail,
    emailVerified: payload.email_verified === true,
    roles: Array.from(roles),
  };
}

function extractOidcRoleClaims(payload: JWTPayload): string[] {
  const roles: string[] = [];

  const realmAccess = payload.realm_access;
  if (realmAccess && typeof realmAccess === 'object' && Array.isArray((realmAccess as { roles?: unknown }).roles)) {
    roles.push(...((realmAccess as { roles: unknown[] }).roles.filter((value): value is string => typeof value === 'string')));
  }

  const resourceAccess = payload.resource_access;
  if (resourceAccess && typeof resourceAccess === 'object') {
    for (const clientAccess of Object.values(resourceAccess as Record<string, unknown>)) {
      if (
        clientAccess &&
        typeof clientAccess === 'object' &&
        Array.isArray((clientAccess as { roles?: unknown }).roles)
      ) {
        roles.push(
          ...((clientAccess as { roles: unknown[] }).roles.filter((value): value is string => typeof value === 'string'))
        );
      }
    }
  }

  return roles;
}

function firstNonEmptyString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }
  return null;
}

function unauthorized(message: string): Error & { statusCode: number; code: string } {
  const error = new Error(message) as Error & { statusCode: number; code: string };
  error.statusCode = 401;
  error.code = 'AUTH_REQUIRED';
  return error;
}
