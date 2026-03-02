import type { AuthMode, AuthProvider } from './AuthProvider';

interface WebEnv {
  VITE_AUTH_MODE?: string;
  VITE_DEV_ACTOR_ID?: string;
  VITE_OIDC_BEARER_TOKEN?: string;
}

export function createDevAuthProvider(env = import.meta.env as WebEnv): AuthProvider {
  const mode = parseMode(env.VITE_AUTH_MODE);
  const actorId = env.VITE_DEV_ACTOR_ID ?? 'player-aaa';
  const oidcToken = env.VITE_OIDC_BEARER_TOKEN;

  return {
    mode,
    actorId,
    async withAuthHeaders(headers?: HeadersInit): Promise<Headers> {
      const merged = new Headers(headers ?? {});
      if (mode === 'oidc' && oidcToken) {
        merged.set('Authorization', `Bearer ${oidcToken}`);
      }
      return merged;
    },
    withActor<T extends Record<string, unknown>>(body: T): T & { bypassActorId?: string } {
      if (mode === 'dev') {
        return { ...body, bypassActorId: actorId };
      }
      return body;
    },
  };
}

function parseMode(rawMode: string | undefined): AuthMode {
  return rawMode === 'oidc' ? 'oidc' : 'dev';
}
