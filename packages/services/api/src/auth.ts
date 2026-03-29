import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export type AuthMode = 'dev' | 'oidc';
export type ResolvedIdentityRole = 'PLAYER' | 'GM' | 'ADMIN';

interface OidcDiscoveryDocument {
  issuer?: string;
  jwks_uri?: string;
}

export interface ResolvedActorIdentity {
  actorId: string;
  authMode: AuthMode;
  displayName: string;
  email: string | null;
  emailNormalized: string | null;
  emailVerified: boolean;
  roles: ResolvedIdentityRole[];
}

export interface ResolveActorIdInput {
  authorizationHeader?: string;
  bypassActorId?: string;
  devActorIdHeader?: string;
  bypassAllowed: boolean;
  env?: Record<string, string | undefined>;
}

const discoveryCache = new Map<string, Promise<OidcDiscoveryDocument>>();
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function resolveActorId(input: ResolveActorIdInput): Promise<string> {
  return (await resolveActorIdentity(input)).actorId;
}

export async function resolveActorIdentity(input: ResolveActorIdInput): Promise<ResolvedActorIdentity> {
  const env = input.env ?? process.env;
  const mode = resolveAuthMode(env);
  const actorId = readDevActorId(input);

  if (mode === 'dev') {
    assertDevAuthAllowed(env);
    if (input.bypassAllowed && actorId) {
      return createDevIdentity(actorId);
    }
    if (input.bypassAllowed) {
      throw unauthorized('missing bypassActorId for dev auth');
    }
    if (actorId) {
      return createDevIdentity(actorId);
    }
    throw unauthorized('missing dev actor identity for dev auth');
  }

  if (!input.bypassAllowed && actorId) {
    throw unauthorized('dev auth headers are not allowed when AUTH_MODE=oidc');
  }

  const issuer = requiredEnv(env, 'OIDC_ISSUER');
  return verifyOidcIdentity(input.authorizationHeader, issuer, env.OIDC_AUDIENCE);
}

export function resolveAuthMode(env: Record<string, string | undefined> = process.env): AuthMode {
  const raw = env.AUTH_MODE?.trim();
  if (!raw) {
    throw new Error('AUTH_MODE must be explicitly set to "dev" or "oidc"');
  }
  if (raw !== 'dev' && raw !== 'oidc') {
    throw new Error(`unsupported AUTH_MODE: ${raw}`);
  }
  return raw;
}

export function isAwsRuntime(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.AWS_EXECUTION_ENV || env.AWS_LAMBDA_FUNCTION_NAME);
}

export function isDevAuthEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.AUTH_MODE === 'dev' && env.ALLOW_DEV_AUTH === '1' && !isAwsRuntime(env);
}

function assertDevAuthAllowed(env: Record<string, string | undefined>): void {
  if (env.ALLOW_DEV_AUTH !== '1') {
    throw new Error('ALLOW_DEV_AUTH=1 is required when AUTH_MODE=dev');
  }
  if (isAwsRuntime(env)) {
    throw new Error('AUTH_MODE=dev is not allowed in AWS runtimes');
  }
}

function readDevActorId(input: ResolveActorIdInput): string {
  if (typeof input.bypassActorId === 'string' && input.bypassActorId.trim() !== '') {
    return input.bypassActorId.trim();
  }
  if (typeof input.devActorIdHeader === 'string' && input.devActorIdHeader.trim() !== '') {
    return input.devActorIdHeader.trim();
  }
  return '';
}

function createDevIdentity(actorId: string): ResolvedActorIdentity {
  return {
    actorId,
    authMode: 'dev',
    displayName: actorId,
    email: null,
    emailNormalized: null,
    emailVerified: false,
    roles: ['PLAYER'],
  };
}

async function verifyOidcIdentity(
  authorizationHeader: string | undefined,
  issuer: string,
  audience?: string
): Promise<ResolvedActorIdentity> {
  const token = extractBearerToken(authorizationHeader);
  const metadata = await loadOidcDiscovery(issuer);
  const normalizedIssuer = normalizeUrl(issuer);
  const resolvedIssuer = normalizeUrl(metadata.issuer ?? normalizedIssuer);
  const jwksUri = metadata.jwks_uri;
  if (!jwksUri) {
    throw new Error(`OIDC discovery metadata is missing jwks_uri for issuer ${normalizedIssuer}`);
  }

  const jwks = getOrCreateJwks(jwksUri);
  const verification = await jwtVerify(token, jwks, {
    issuer: resolvedIssuer,
    audience: audience || undefined,
  });

  if (!verification.payload.sub) {
    throw new Error('OIDC JWT payload missing sub');
  }

  return toOidcIdentity(verification.payload);
}

async function loadOidcDiscovery(issuer: string): Promise<OidcDiscoveryDocument> {
  const normalizedIssuer = normalizeUrl(issuer);
  let discovery = discoveryCache.get(normalizedIssuer);
  if (!discovery) {
    const discoveryUrl = `${normalizedIssuer}/.well-known/openid-configuration`;
    discovery = fetch(discoveryUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`OIDC discovery request failed: ${response.status} ${response.statusText}`);
        }
        return (await response.json()) as OidcDiscoveryDocument;
      });
    discoveryCache.set(normalizedIssuer, discovery);
  }
  return discovery;
}

function getOrCreateJwks(jwksUri: string) {
  let jwks = jwksCache.get(jwksUri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUri));
    jwksCache.set(jwksUri, jwks);
  }
  return jwks;
}

export function resolveActorIdentityFromAuthorizerClaims(
  claims: Record<string, unknown> | undefined
): ResolvedActorIdentity | null {
  if (!claims) {
    return null;
  }

  const actorId = requireClaimString(claims, 'sub');
  const email = requireClaimString(claims, 'email');
  const normalizedEmail = email.toLowerCase();
  const emailVerified = requireBooleanishClaim(claims, 'email_verified');
  const displayName = requireClaimString(claims, 'name');

  return {
    actorId,
    authMode: 'oidc',
    displayName,
    email,
    emailNormalized: normalizedEmail,
    emailVerified,
    roles: ['PLAYER'],
  };
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
      [payload.given_name, payload.family_name]
        .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
        .join(' '),
      payload.preferred_username,
      normalizedEmail,
      actorId,
    ]) ?? actorId;

  return {
    actorId,
    authMode: 'oidc',
    displayName,
    email,
    emailNormalized: normalizedEmail,
    emailVerified: payload.email_verified === true,
    roles: ['PLAYER'],
  };
}

function requireClaimString(claims: Record<string, unknown>, name: string): string {
  const value = claims[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`OIDC authorizer claims missing ${name}`);
  }
  return value.trim();
}

function requireBooleanishClaim(claims: Record<string, unknown>, name: string): boolean {
  const value = claims[name];
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  throw new Error(`OIDC authorizer claims missing ${name}`);
}

function extractBearerToken(authorizationHeader?: string): string {
  if (!authorizationHeader) {
    throw new Error('missing Authorization header');
  }

  const token = authorizationHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || token === authorizationHeader) {
    throw new Error('invalid Authorization header');
  }
  return token;
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/$/, '');
}

function requiredEnv(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required when AUTH_MODE=oidc`);
  }
  return value;
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
