import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export interface VerifyLocalOidcJwtInput {
  authorizationHeader?: string;
  issuer: string;
  audience?: string;
}

export interface VerifiedOidcIdentity {
  actorId: string;
  claims: JWTPayload;
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function verifyLocalOidcJwt(input: VerifyLocalOidcJwtInput): Promise<VerifiedOidcIdentity> {
  const token = extractBearerToken(input.authorizationHeader);
  const jwks = getOrCreateJwks(input.issuer);

  const verification = await jwtVerify(token, jwks, {
    issuer: input.issuer,
    audience: input.audience || undefined,
  });

  const sub = verification.payload.sub;
  if (!sub) {
    throw new Error('OIDC JWT payload missing sub');
  }

  return {
    actorId: sub,
    claims: verification.payload,
  };
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

function getOrCreateJwks(issuer: string) {
  const normalizedIssuer = issuer.replace(/\/$/, '');
  const jwksUri = `${normalizedIssuer}/protocol/openid-connect/certs`;

  let jwks = jwksCache.get(jwksUri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUri));
    jwksCache.set(jwksUri, jwks);
  }
  return jwks;
}
