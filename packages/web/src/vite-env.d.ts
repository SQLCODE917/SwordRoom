/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_MODE?: 'dev' | 'oidc';
  readonly VITE_DEV_ACTOR_ID?: string;
  readonly VITE_OIDC_BEARER_TOKEN?: string;
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
