import { createContext, useContext } from 'react';

export type AuthMode = 'dev' | 'oidc';

export interface AuthProvider {
  mode: AuthMode;
  actorId: string;
  isAuthenticated: boolean;
  withAuthHeaders(headers?: HeadersInit): Promise<Headers>;
  withActor<T extends Record<string, unknown>>(body: T): T & { bypassActorId?: string };
}

export const AuthProviderContext = createContext<AuthProvider | null>(null);

export function useAuthProvider(): AuthProvider {
  const provider = useContext(AuthProviderContext);
  if (!provider) {
    throw new Error('AuthProviderContext is missing');
  }
  return provider;
}
