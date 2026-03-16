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

const AUTH_STATE_CHANGE_EVENT = 'sw-auth-state-change';

export function useAuthProvider(): AuthProvider {
  const provider = useContext(AuthProviderContext);
  if (!provider) {
    throw new Error('AuthProviderContext is missing');
  }
  return provider;
}

export function notifyAuthStateChanged(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(AUTH_STATE_CHANGE_EVENT));
}

export function subscribeToAuthState(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = () => {
    listener();
  };
  const handleCustomEvent = () => {
    listener();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(AUTH_STATE_CHANGE_EVENT, handleCustomEvent);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(AUTH_STATE_CHANGE_EVENT, handleCustomEvent);
  };
}
